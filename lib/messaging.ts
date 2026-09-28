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
//   · a global monthly spend cap, and it is MANDATORY: no cap configured
//     refuses every SMS, exactly as the kill switch does (BUZ decision 5,
//     23 Sep; release seat R4). An empty variable is not "no limit".
//   · a kill switch a tired founder can hit at 11pm — from /ops/switches
//     (0070), not only from the environment. The environment stays the
//     ceiling: an operator can switch SMS off or lower the cap, never switch
//     on what SMS_KILL_SWITCH switched off or raise the cap above
//     SMS_MONTHLY_CAP_CENTS (lib/sms-policy).
// Credit is prepaid, never a card on file — that is an account setting, not
// code, and it is on the launch checklist.
import 'server-only';
import { createHash } from 'node:crypto';
import { db } from './db';
import { CATALOGUE_KEYS, DRAFT_KEYS, HELD_KEYS, type Composed } from './messages';
import { sendEmail, sendSms } from './providers';
import { replyToFor } from './reply-policy';
import { effectiveSmsCapCents, smsCapCents, smsSwitchedOff } from './sms-policy';

const KEYS = new Set<string>(CATALOGUE_KEYS);
// Drafts (lib/messages DRAFT_KEYS): written and wired, not yet approved. They
// queue in development, where the outbox is the inbox and nothing leaves the
// machine, and they are refused in production — so a flow that depends on one
// cannot ship until BUZ has approved the words and doc 15 carries them.
const DRAFTS = new Set<string>(DRAFT_KEYS);
// Held (lib/messages HELD_KEYS): approved words that BUZ has stopped sending.
// The text stays where it is — doc 14 §B11 defines a transition by one of
// these having delivered, so deleting the words deletes the gate — and the
// send is refused everywhere, in development too, so nothing can quietly
// re-wire it.
const HELD = new Set<string>(HELD_KEYS);
const SMS_PER_NUMBER_24H = 3;
const DEFAULT_SMS_COST_CENTS = 8;

export type SendResult =
  | { queued: true; id: string }
  | { queued: false; reason: 'not_in_catalogue' | 'not_approved' | 'held' | 'sms_killed' | 'sms_no_cap' | 'sms_rate_limited' | 'sms_cap_reached' | 'no_address' | 'sms_opted_out' };

/**
 * How a phone number is recognised without being stored.
 *
 * EXPORTED on purpose. The SMS meter, the opt-out list and the inbound STOP
 * webhook all have to agree on this byte for byte — a second copy of it
 * somewhere else is a STOP that silently never matches, which is the failure
 * mode you find out about from a complaint.
 */
export const numberHash = (n: string) => createHash('sha256').update(n.replace(/\s/g, '')).digest();

/**
 * Queue one message.
 *
 * `to.personId` is who it goes TO; `to.subjectId` is who it is ABOUT, and they
 * are rarely the same person — a guardian's approval email is addressed to the
 * parent and is about the child. The subject rides on the outbox row so that
 * when the provider's delivery receipt comes back, the spine row it writes
 * lands on the right person's consent log (D-78, 0065). Without it a receipt
 * arrives with nothing to attach it to.
 */
export async function send(msg: Composed, to: { address: string; personId?: string; subjectId?: string }): Promise<SendResult> {
  // The catalogue is the gate: if a message is not in doc 15, it does not send.
  if (!KEYS.has(msg.key) && !DRAFTS.has(msg.key)) return { queued: false, reason: 'not_in_catalogue' };
  // A draft never reaches a person. In production that is a refusal, not a
  // queued row nobody will ever receive.
  if (DRAFTS.has(msg.key) && process.env.NODE_ENV === 'production') {
    return { queued: false, reason: 'not_approved' };
  }
  // A held message does not send anywhere, and its words stay in the
  // catalogue (lib/messages HELD_KEYS says which and why).
  if (HELD.has(msg.key)) return { queued: false, reason: 'held' };
  if (!to.address) return { queued: false, reason: 'no_address' };

  if (msg.channel === 'sms') {
    if (process.env.SMS_KILL_SWITCH === 'true') return { queued: false, reason: 'sms_killed' };
    // The spend cap is mandatory (D-81, BUZ decision 5). No cap configured
    // refuses every SMS the same way the kill switch does — the refusal is
    // the recorded reason, so the outbox stays empty and the caller can say
    // what happened. Checked where money is actually spent: in development
    // the outbox IS the inbox and dispatch() is never called, so there is no
    // spend to cap; a message that CAN reach a provider cannot get past here
    // without one.
    const cap = smsCapCents(process.env.SMS_MONTHLY_CAP_CENTS);
    if (cap === null && process.env.NODE_ENV === 'production') {
      return { queued: false, reason: 'sms_no_cap' };
    }
    // The operator's switch (0070), read on every SMS so it takes effect on
    // the next one, not the next deploy. Off is off whichever side said it;
    // the cap in force is the lower of the two.
    const { rows: sw } = await db.query('select sms_off, sms_cap_cents from fn_sms_switch()');
    if (smsSwitchedOff(process.env.SMS_KILL_SWITCH, sw[0]?.sms_off)) return { queued: false, reason: 'sms_killed' };
    const limit = effectiveSmsCapCents(cap, sw[0]?.sms_cap_cents);

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

    if (limit !== null) {
      const { rows: spend } = await db.query('select fn_sms_spend_month() as c');
      if (spend[0].c + DEFAULT_SMS_COST_CENTS > limit) return { queued: false, reason: 'sms_cap_reached' };
    }
    await db.query('insert into sms_meter (number_hash, cents) values ($1,$2)', [h, DEFAULT_SMS_COST_CENTS]);
  }

  // attempts starts at 1: this row is claimed by the inline dispatch below,
  // so a sweep arriving a minute later does not treat it as untried.
  const { rows } = await db.query(
    `insert into message_outbox (message_key, channel, to_person, to_address, subject, body, subject_id, attempts, last_attempt_at)
     values ($1,$2,$3,$4,$5,$6,$7,1,now()) returning id`,
    [msg.key, msg.channel, to.personId ?? null, to.address, msg.subject ?? null, msg.body, to.subjectId ?? null],
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
  // Who the message is ABOUT. It goes on the spine row AND on the outbox row,
  // so the provider's delivery receipt writes its own spine row against the
  // same person (D-78, 0065) instead of against nobody.
  subjectId?: string,
): Promise<SendResult> {
  const result = await send(msg, { ...to, subjectId });
  if (result.queued) {
    await db.query(
      `insert into consent_event (event, subject_id, detail)
       values ($1, $2, jsonb_build_object('message_key', $3::text))`,
      [funnelEvent, subjectId ?? null, msg.key],
    );
  }
  return result;
}
