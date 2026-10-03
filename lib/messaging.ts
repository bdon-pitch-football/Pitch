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
import { after } from 'next/server';
import { db } from './db';
import { CATALOGUE_KEYS, DRAFT_KEYS, HELD_KEYS, type Composed } from './messages';
import { sendEmail, sendSms, type Dispatch } from './providers';
import { replyToFor } from './reply-policy';
import { renderEmail } from './email-html';
import { isDemo } from './demo';
import { keyedNumberHash, normaliseNumber, numberHashKey } from './number-hash';
import { effectiveSmsCapCents, smsCanSend, smsCapCents, smsProviderConfigured, smsSwitchedOff } from './sms-policy';

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
// D-168 (0120): the texts that WAIT when SMS cannot send, instead of being
// refused — the parent's approval request (doc 15 §1) and the 16–17's
// "confirm you're their parent" (§1b). Approval needs both channels (D-24,
// D-156), so refusing these while SMS is down made every under-18 sign-up
// impossible to approve. Nothing else queues: a kill switch that saved up
// every text for later would not be a kill switch.
const QUEUE_UNTIL_SMS_SENDS = new Set<string>(['doc15.§1', 'doc15.§1b']);

export type SendResult =
  // `waiting`: written, and held until SMS can send (0120). Not sent, so the
  // spine is not told a text went — fn_sms_release tells it when one does.
  | { queued: true; id: string; waiting?: true }
  | { queued: false; reason: 'not_in_catalogue' | 'not_approved' | 'held' | 'sms_killed' | 'sms_no_cap' | 'sms_no_key' | 'sms_rate_limited' | 'sms_cap_reached' | 'no_address' | 'sms_not_a_mobile' | 'sms_opted_out' };

/**
 * How a phone number is recognised without being stored.
 *
 * EXPORTED on purpose. The SMS meter, the opt-out list and the inbound STOP
 * webhook all have to agree on this byte for byte — a second copy of it
 * somewhere else is a STOP that silently never matches, which is the failure
 * mode you find out about from a complaint.
 *
 * Keyed (HMAC-SHA256 under NUMBER_HASH_KEY), never a plain sha256 (John,
 * 1 Oct, §5.2): lib/number-hash. NULL in production with no key, and every
 * caller treats null as "no SMS": nothing is queued, sent or recorded.
 */
export const numberHash = (n: string): Buffer | null => keyedNumberHash(n, numberHashKey());

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
// `invitationId` (0077): the pending invitation a guardian-approval message
// belongs to. An under-16 has no person row until approval (D-17), so the
// outbox row carries the invitation instead, and the provider's delivery
// receipt can be attached to the child's log when the parent approves.
export async function send(msg: Composed, to: { address: string; personId?: string; subjectId?: string; invitationId?: string }): Promise<SendResult> {
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
    // An Australian mobile, or no text (D-63; John, 2 Oct, §5): the one form
    // lib/number-hash reads is the one Twilio is given, and a number it
    // cannot read is refused here, before anything is written or metered —
    // the same answer /join gives it.
    const e164 = normaliseNumber(to.address);
    if (!e164) return { queued: false, reason: 'sms_not_a_mobile' };
    // And from here on the number IS that form (John, 3 Oct, §4): the outbox
    // row, the queue, the fingerprint and the provider's To are one string,
    // so the outbox says exactly where a text went and nothing keeps the
    // number as it was typed.
    to = { ...to, address: e164 };
    const cap = smsCapCents(process.env.SMS_MONTHLY_CAP_CENTS);
    // The operator's switch (0070), read on every SMS so it takes effect on
    // the next one, not the next deploy. Off is off whichever side said it;
    // the cap in force is the lower of the two.
    const { rows: sw } = await db.query('select sms_off, sms_cap_cents from fn_sms_switch()');

    const h = numberHash(to.address);
    // No key, no SMS (§5.2): production without NUMBER_HASH_KEY cannot
    // recognise a number, so it can neither honour a STOP nor count three a
    // day — and it never falls back to a plain hash. Refused, with the
    // reason, before anything is written; a waiting text cannot be queued
    // without its fingerprint either.
    if (!h) return { queued: false, reason: 'sms_no_key' };
    // STOP means stop. Doc 15 §15 promises "we won't text this number again"
    // and until 0031 there was nowhere to record that anybody had said it, so
    // the promise was unenforceable. It is checked BEFORE the meter, because
    // a message we must not send should not spend a cent of the cap either —
    // and before the queue (D-168), because a text we must never send should
    // not wait to be sent either.
    const { rows: out } = await db.query(
      `select 1 from sms_opt_out where number_hash = $1
         and (opted_in_at is null or opted_in_at < opted_out_at)`,
      [h],
    );
    if (out.length > 0) return { queued: false, reason: 'sms_opted_out' };

    // D-168 (0120): SMS cannot send — switched off, or in production no cap
    // or no provider yet. The parent's approval text is written down and
    // waits; the outbox job releases it, oldest first, under every control
    // below, the first time SMS can send. Its three-a-day limit is counted
    // at queue time too, queued texts with sent ones (fn_sms_queue).
    const canSend = smsCanSend({
      production: process.env.NODE_ENV === 'production',
      envKill: process.env.SMS_KILL_SWITCH,
      dbOff: sw[0]?.sms_off,
      envCap: cap,
      providerConfigured: smsProviderConfigured(
        { sid: process.env.SMS_ACCOUNT_SID, key: process.env.SMS_API_KEY, from: process.env.SMS_LONG_NUMBER }, isDemo()),
    });
    if (!canSend && QUEUE_UNTIL_SMS_SENDS.has(msg.key) && to.invitationId) {
      const { rows: q } = await db.query(
        'select fn_sms_queue($1,$2,$3,$4,$5,$6,$7,$8) as id',
        [msg.key, to.personId ?? null, to.address, msg.body, to.subjectId ?? null, to.invitationId, h, SMS_PER_NUMBER_24H],
      );
      return q[0]?.id ? { queued: true, id: q[0].id as string, waiting: true } : { queued: false, reason: 'sms_rate_limited' };
    }

    if (process.env.SMS_KILL_SWITCH === 'true') return { queued: false, reason: 'sms_killed' };
    // The spend cap is mandatory (D-81, BUZ decision 5). No cap configured
    // refuses every SMS the same way the kill switch does — the refusal is
    // the recorded reason, so the outbox stays empty and the caller can say
    // what happened. Checked where money is actually spent: in development
    // the outbox IS the inbox and dispatch() is never called, so there is no
    // spend to cap; a message that CAN reach a provider cannot get past here
    // without one.
    if (cap === null && process.env.NODE_ENV === 'production') {
      return { queued: false, reason: 'sms_no_cap' };
    }
    if (smsSwitchedOff(process.env.SMS_KILL_SWITCH, sw[0]?.sms_off)) return { queued: false, reason: 'sms_killed' };
    const limit = effectiveSmsCapCents(cap, sw[0]?.sms_cap_cents);

    const { rows: cnt } = await db.query('select fn_sms_count_24h($1) as n', [h]);
    if (cnt[0].n >= SMS_PER_NUMBER_24H) return { queued: false, reason: 'sms_rate_limited' };

    if (limit !== null) {
      const { rows: spend } = await db.query('select fn_sms_spend_month() as c');
      if (spend[0].c + DEFAULT_SMS_COST_CENTS > limit) return { queued: false, reason: 'sms_cap_reached' };
    }
    await db.query('insert into sms_meter (number_hash, cents) values ($1,$2)', [h, DEFAULT_SMS_COST_CENTS]);
  }

  // attempts starts at 1: this row is claimed by the dispatch below, which
  // runs after the response, so a sweep arriving a minute later does not
  // treat it as untried.
  const { rows } = await db.query(
    `insert into message_outbox (message_key, channel, to_person, to_address, subject, body, subject_id, invitation_id, attempts, last_attempt_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,1,now()) returning id`,
    [msg.key, msg.channel, to.personId ?? null, to.address, msg.subject ?? null, msg.body, to.subjectId ?? null, to.invitationId ?? null],
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
  //
  // AFTER the response, never inside it (doc 14 L40, D-99; 29 Sep). The
  // provider is a network round trip to another continent, and a request
  // that waits for it answers tens to hundreds of milliseconds later than
  // one that sent nothing. That gap was the oracle: a send refused by the
  // daily limit (L38) answered faster than a real one, and a request-access
  // or a sign-in that emails someone answered slower than one that did not.
  // The row above is the durable part and it is already written; delivery
  // is Next's after() (next/server — it runs once the response has gone,
  // including after a redirect). If the instance dies before it runs, the
  // row was claimed with attempts = 1 and the outbox sweep picks it up five
  // minutes later, exactly as it does for a provider that timed out.
  // Nothing is awaited or thrown from here: a failure is recorded by
  // dispatch() on the row, and an error escaping into the platform's log
  // could carry an address (D-94 §1).
  if (process.env.NODE_ENV === 'production') {
    after(() => dispatch(id, msg.channel, to.address, msg.subject ?? '', msg.body, msg.key).then(() => undefined, () => undefined));
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
  // An email goes as text and HTML, both made here from the row's own words
  // (lib/email-html): the text with https:// on its links (E8), and the HTML
  // drawn from that text. Rendered at dispatch, not stored, so a retried row
  // renders exactly as its first attempt and the outbox keeps doc 15's words.
  const mail = channel === 'sms' ? null : renderEmail(messageKey, subject, body);
  // A text goes to Twilio in E.164 (+614…), never as typed (John, 2 Oct, §5):
  // the one form lib/number-hash makes, so the number sent to is the number
  // the STOP list and the meter know. This is the only door to sendSms — the
  // inline send, the sweep, the release and the STOP reply all come through
  // here. A row whose address is not an Australian mobile is refused for
  // good without reaching the provider, as the provider refuses an invalid
  // number (a 4xx: permanent, words cleared).
  const smsTo = mail === null ? normaliseNumber(address) : null;
  const result: Dispatch = mail !== null
    ? await sendEmail(address, subject, mail.text, replyToFor(messageKey, process.env.EMAIL_REPLY_TO), mail.html)
    : smsTo ? await sendSms(smsTo, body) : { ok: false, reason: 'not_a_mobile', permanent: true };

  // Doc 23: "We do not retain message bodies" (John, 1 Oct, §5.1; 0169). The
  // body and subject are cleared the moment the provider has the message,
  // and the moment it is refused for good: nothing reads them after that.
  // What stays is what the receipts and the funnel read — the provider id,
  // channel, key, subject person and invitation — and the address, which
  // the support console counts tries by, for 30 days (lib/sent-bodies clears
  // it hourly after that; John, 2 Oct, §3). A transient failure keeps its
  // body for the retry. Development never dispatches, so its outbox keeps every
  // word: /dev/outbox is the inbox the suites read.
  if (result.ok) {
    await db.query(
      `update message_outbox set sent_at = now(), provider_id = $2, body = '', subject = null
       where id = $1 and sent_at is null`,
      [id, result.providerId],
    );
    return true;
  }
  // failure_reason never carries message content (0009) — a provider status
  // and nothing else. A permanent failure is closed out so the sweep stops
  // retrying it; a transient one is left for the next run.
  await db.query(
    `update message_outbox set failed_at = case when $3 then now() else null end,
       failure_reason = $2,
       body = case when $3 then '' else body end,
       subject = case when $3 then null else subject end
     where id = $1`,
    [id, result.reason, result.permanent],
  );
  return false;
}

/**
 * Release the parents' texts that waited for SMS (D-168, 0120).
 *
 * Asks the same question send() asks — can a text leave now? — and only on a
 * yes hands the queue to fn_sms_release, which applies every control in the
 * database: the operator's switch, three a day per number, the monthly cap in
 * force, STOP, and an invitation that is still open (a purged, approved or
 * held one sends nothing). Oldest first. The environment's half of "can a
 * text leave" (the kill switch, the mandatory cap, a provider configured) can
 * only be read here, which is why the question is asked twice.
 *
 * It hands the released rows back and sends none of them: the caller — the
 * outbox job, never a request — gives each to dispatch() in production. In
 * development the outbox is the provider — /dev/outbox is the inbox, the
 * "dev fake" — so a released text is delivered by being released, and
 * nothing leaves the machine. (Nothing in this file awaits a provider, L40.)
 */
export type ReleasedText = { id: string; message_key: string; to_address: string; body: string };
export async function releaseWaitingTexts(batch = 50): Promise<ReleasedText[]> {
  const cap = smsCapCents(process.env.SMS_MONTHLY_CAP_CENTS);
  const { rows: sw } = await db.query('select sms_off, sms_cap_cents from fn_sms_switch()');
  const canSend = smsCanSend({
    production: process.env.NODE_ENV === 'production',
    envKill: process.env.SMS_KILL_SWITCH,
    dbOff: sw[0]?.sms_off,
    envCap: cap,
    providerConfigured: smsProviderConfigured(
      { sid: process.env.SMS_ACCOUNT_SID, key: process.env.SMS_API_KEY, from: process.env.SMS_LONG_NUMBER }, isDemo()),
  });
  if (!canSend) return [];
  // §5.2 (0169): a text that waited from before the STOP list was keyed
  // carries a plain hash, which no keyed STOP or meter row will ever match.
  // A waiting text still holds its address, so it is re-keyed from it here,
  // before anything is released — and with no key nothing is released.
  const key = numberHashKey();
  if (!key) return [];
  const { rows: waiting } = await db.query(
    `select id, to_address, number_hash from message_outbox
     where queued_for_sms_at is not null and released_at is null and failed_at is null and sent_at is null`,
  );
  for (const w of waiting as { id: string; to_address: string; number_hash: Buffer }[]) {
    const h = keyedNumberHash(w.to_address, key);
    if (h && !h.equals(w.number_hash)) {
      await db.query('update message_outbox set number_hash = $2 where id = $1', [w.id, h]);
    }
  }
  const limit = effectiveSmsCapCents(cap, sw[0]?.sms_cap_cents);
  const { rows } = await db.query(
    'select id, message_key, to_address, body from fn_sms_release($1,$2,$3,$4)',
    [limit, DEFAULT_SMS_COST_CENTS, SMS_PER_NUMBER_24H, batch],
  );
  return rows as ReleasedText[];
}

// Convenience: queue a message and log it on the consent-funnel spine (D-78),
// so the funnel and the outbox never disagree.
export async function sendAndLog(
  msg: Composed,
  to: { address: string; personId?: string; invitationId?: string },
  funnelEvent: 'email_sent' | 'sms_sent' | 'nudge_sent',
  // Who the message is ABOUT. It goes on the spine row AND on the outbox row,
  // so the provider's delivery receipt writes its own spine row against the
  // same person (D-78, 0065) instead of against nobody.
  subjectId?: string,
): Promise<SendResult> {
  const result = await send(msg, { ...to, subjectId });
  // A waiting text (0120) has not gone, so the spine does not say it has:
  // fn_sms_release writes this same row the moment it does.
  if (result.queued && !result.waiting) {
    // The invitation rides on the spine row too (0077), so an under-16's
    // "We emailed you" can be attached to their log at approval — linked,
    // never rewritten.
    await db.query(
      `insert into consent_event (event, subject_id, detail)
       values ($1, $2, jsonb_build_object('message_key', $3::text)
         || case when $4::uuid is null then '{}'::jsonb else jsonb_build_object('invitation_id', $4::uuid) end)`,
      [funnelEvent, subjectId ?? null, msg.key, to.invitationId ?? null],
    );
  }
  return result;
}
