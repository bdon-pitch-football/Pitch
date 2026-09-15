// The send layer (doc 15, D-81, D-78).
//
// Everything queues into message_outbox first. In development nothing leaves
// the machine — you read the outbox. In production a provider adapter picks
// the row up and writes its delivery receipt back, which is what makes
// "ignored us" and "spam-foldered us" distinguishable (D-78).
//
// SMS controls are enforced HERE, before the first verification message ever
// sends (D-81), because SMS pumping against an unrated endpoint is one of the
// most common ways a small launch loses real money in week one:
//   · max 3 messages per number per 24 hours
//   · a global monthly spend cap
//   · a kill switch a tired founder can hit at 11pm
// Credit is prepaid, never a card on file — that is an account setting, not
// code, and it is on the launch checklist.
import 'server-only';
import { createHash } from 'node:crypto';
import { db } from './db';
import { CATALOGUE_KEYS, type Composed } from './messages';
import { sendEmail, sendSms } from './providers';
import { replyToFor } from './reply-policy';

const KEYS = new Set<string>(CATALOGUE_KEYS);
const SMS_PER_NUMBER_24H = 3;
const DEFAULT_SMS_COST_CENTS = 8;

export type SendResult =
  | { queued: true; id: string }
  | { queued: false; reason: 'not_in_catalogue' | 'sms_killed' | 'sms_rate_limited' | 'sms_cap_reached' | 'no_address' | 'sms_opted_out' };

/**
 * How a phone number is recognised without being stored.
 *
 * EXPORTED on purpose. The SMS meter, the opt-out list and the inbound STOP
 * webhook all have to agree on this byte for byte — a second copy of it
 * somewhere else is a STOP that silently never matches, which is the failure
 * mode you find out about from a complaint.
 */
export const numberHash = (n: string) => createHash('sha256').update(n.replace(/\s/g, '')).digest();

export async function send(msg: Composed, to: { address: string; personId?: string }): Promise<SendResult> {
  // The catalogue is the gate: if a message is not in doc 15, it does not send.
  if (!KEYS.has(msg.key)) return { queued: false, reason: 'not_in_catalogue' };
  if (!to.address) return { queued: false, reason: 'no_address' };

  if (msg.channel === 'sms') {
    if (process.env.SMS_KILL_SWITCH === 'true') return { queued: false, reason: 'sms_killed' };

    const h = numberHash(to.address);
    // STOP means stop. Doc 15 §15 promises "we won't text this number again"
    // and until 0031 there was nowhere to record that anybody had said it, so
    // the promise was unenforceable. It is checked BEFORE the meter, because
    // a message we must not send should not spend a cent of the cap either.
    const { rows: out } = await db.query(
      `select 1 from sms_opt_out where number_hash = $1
         and (opted_in_at is null or opted_in_at < opted_out_at)`,
      [h],
    );
    if (out.length > 0) return { queued: false, reason: 'sms_opted_out' };
    const { rows: cnt } = await db.query('select fn_sms_count_24h($1) as n', [h]);
    if (cnt[0].n >= SMS_PER_NUMBER_24H) return { queued: false, reason: 'sms_rate_limited' };

    const cap = Number(process.env.SMS_MONTHLY_CAP_CENTS ?? 0);
    if (cap > 0) {
      const { rows: spend } = await db.query('select fn_sms_spend_month() as c');
      if (spend[0].c + DEFAULT_SMS_COST_CENTS > cap) return { queued: false, reason: 'sms_cap_reached' };
    }
    await db.query('insert into sms_meter (number_hash, cents) values ($1,$2)', [h, DEFAULT_SMS_COST_CENTS]);
  }

  // attempts starts at 1: this row is claimed by the inline dispatch below,
  // so a sweep arriving a minute later does not treat it as untried.
  const { rows } = await db.query(
    `insert into message_outbox (message_key, channel, to_person, to_address, subject, body, attempts, last_attempt_at)
     values ($1,$2,$3,$4,$5,$6,1,now()) returning id`,
    [msg.key, msg.channel, to.personId ?? null, to.address, msg.subject ?? null, msg.body],
  );
  const id = rows[0].id as string;

  // Dispatch. The row exists first and always: if the provider call throws,
  // crashes the instance, or succeeds in a way we never hear about, the
  // message is still on the spine and the retry sweep can find it. Writing
  // the row after a successful send would lose exactly the sends we most
  // need to be able to explain.
  //
  // In development nothing leaves the machine — /dev/outbox is the inbox —
  // and that stays true whether or not a key happens to be in the shell.
  if (process.env.NODE_ENV === 'production') {
    await dispatch(id, msg.channel, to.address, msg.subject ?? '', msg.body, msg.key);
  }
  return { queued: true, id };
}

/**
 * Hand one queued row to its provider and record what happened.
 *
 * Exported so the retry sweep can call it for a row that was written but
 * never went out — an instance dying between the insert and the provider
 * call is the ordinary case, not the exotic one.
 */
export async function dispatch(
  id: string, channel: string, address: string, subject: string, body: string,
  // Which doc 15 message this is. It decides the Reply-To (lib/reply-policy),
  // and it must travel with a retried row too, or a re-sent §19 would pick up
  // an address the first attempt never had.
  messageKey?: string,
): Promise<boolean> {
  // Deliberately does NOT stamp attempts. The CALLER claims the row — the
  // sweep in the same statement that selects it, and send() in the insert —
  // because a claim that happens after the row has been handed out is not a
  // claim at all.
  const result = channel === 'sms'
    ? await sendSms(address, body)
    : await sendEmail(address, subject, body, replyToFor(messageKey, process.env.EMAIL_REPLY_TO));

  if (result.ok) {
    await db.query(
      `update message_outbox set sent_at = now(), provider_id = $2 where id = $1 and sent_at is null`,
      [id, result.providerId],
    );
    return true;
  }
  // failure_reason never carries message content (0009) — a provider status
  // and nothing else. A permanent failure is closed out so the sweep stops
  // retrying it; a transient one is left for the next run.
  await db.query(
    `update message_outbox set failed_at = case when $3 then now() else null end,
       failure_reason = $2 where id = $1`,
    [id, result.reason, result.permanent],
  );
  return false;
}

// Convenience: queue a message and log it on the consent-funnel spine (D-78),
// so the funnel and the outbox never disagree.
export async function sendAndLog(
  msg: Composed,
  to: { address: string; personId?: string },
  funnelEvent: 'email_sent' | 'sms_sent' | 'nudge_sent',
  subjectId?: string,
): Promise<SendResult> {
  const result = await send(msg, to);
  if (result.queued) {
    await db.query(
      `insert into consent_event (event, subject_id, detail)
       values ($1, $2, jsonb_build_object('message_key', $3::text))`,
      [funnelEvent, subjectId ?? null, msg.key],
    );
  }
  return result;
}
