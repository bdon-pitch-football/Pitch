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

const KEYS = new Set<string>(CATALOGUE_KEYS);
const SMS_PER_NUMBER_24H = 3;
const DEFAULT_SMS_COST_CENTS = 8;

export type SendResult =
  | { queued: true; id: string }
  | { queued: false; reason: 'not_in_catalogue' | 'sms_killed' | 'sms_rate_limited' | 'sms_cap_reached' | 'no_address' };

const numberHash = (n: string) => createHash('sha256').update(n.replace(/\s/g, '')).digest();

export async function send(msg: Composed, to: { address: string; personId?: string }): Promise<SendResult> {
  // The catalogue is the gate: if a message is not in doc 15, it does not send.
  if (!KEYS.has(msg.key)) return { queued: false, reason: 'not_in_catalogue' };
  if (!to.address) return { queued: false, reason: 'no_address' };

  if (msg.channel === 'sms') {
    if (process.env.SMS_KILL_SWITCH === 'true') return { queued: false, reason: 'sms_killed' };

    const h = numberHash(to.address);
    const { rows: cnt } = await db.query('select fn_sms_count_24h($1) as n', [h]);
    if (cnt[0].n >= SMS_PER_NUMBER_24H) return { queued: false, reason: 'sms_rate_limited' };

    const cap = Number(process.env.SMS_MONTHLY_CAP_CENTS ?? 0);
    if (cap > 0) {
      const { rows: spend } = await db.query('select fn_sms_spend_month() as c');
      if (spend[0].c + DEFAULT_SMS_COST_CENTS > cap) return { queued: false, reason: 'sms_cap_reached' };
    }
    await db.query('insert into sms_meter (number_hash, cents) values ($1,$2)', [h, DEFAULT_SMS_COST_CENTS]);
  }

  const { rows } = await db.query(
    `insert into message_outbox (message_key, channel, to_person, to_address, subject, body)
     values ($1,$2,$3,$4,$5,$6) returning id`,
    [msg.key, msg.channel, to.personId ?? null, to.address, msg.subject ?? null, msg.body],
  );
  const id = rows[0].id as string;

  // Provider dispatch. Adapters land when the accounts exist (BUZ's list);
  // until then the row simply waits in the outbox and dev reads it there.
  const provider = msg.channel === 'sms' ? process.env.SMS_API_KEY : process.env.RESEND_API_KEY;
  if (provider && process.env.NODE_ENV === 'production') {
    // Deliberately not implemented until the accounts are live: sending from
    // an unwarmed domain or an unregistered sender ID damages deliverability
    // for the consent emails, which is the one thing we cannot afford (D-81).
    // The adapter writes sent_at/provider_id here and the webhook writes the
    // receipt into the same row.
  }
  return { queued: true, id };
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
