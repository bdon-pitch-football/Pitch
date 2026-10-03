// The guardian consent spine (D-17): the child door creates a PENDING
// INVITATION holding first name + DOB + guardian contact ONLY — no profile,
// no CV, nothing else exists until a guardian approves. Approval is one
// transaction that creates the accounts, the link and the consent-log rows
// together; doc 08's "done" line for foundations is exactly this function.
//
// No message sends from here yet: sending arrives with the Resend/Twilio
// wiring, using doc 15's copy verbatim. If a message is not in doc 15 it
// does not send — and nothing sends at all until then.
import 'server-only';
import { ageOn } from './age';
import { db } from './db';
import { isUuid } from './ids';
import { createHash, randomBytes } from 'node:crypto';
import { guardianApprovalEmail, guardianApprovalSms, guardianConfirmEmail16, guardianConfirmSms16 } from './messages';
import { sendAndLog } from './messaging';
import { normaliseNumber } from './number-hash';

// Consent stamps (doc 32 B2): the registered version bound to the bytes of
// the file actually served — lib/legal-stamp. They were hand-kept strings
// (doc@version, typed by hand) and had already fallen behind the register.
import { legalStamp } from './legal-stamp';

// Two links, one per channel (D-156). Each is a random token, stored only as
// a hash, so the table yields no working link. Resending a channel mints a
// fresh token for it (the old link stops working); a confirmation already
// made stays made.
const newToken = () => randomBytes(24).toString('base64url');
export const hashToken = (t: string) => createHash('sha256').update(t).digest();

export async function createPendingInvitation(input: {
  firstName: string;
  dob: string; // ISO date from the DOB gate
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string; // required (D-157)
  childId?: string;      // a 16–17 who already has an account (D-155 as amended)
}): Promise<{ id: string }> {
  // One number, one form (John, 3 Oct, §4): E.164, written here at the point
  // of entry by the function that makes Twilio's To and the STOP fingerprint
  // (lib/number-hash). No "as typed" copy is kept. Every door that reaches
  // this has already refused anything but an Australian mobile, so a number
  // that does not normalise is a bug, and nothing is written for it.
  const guardianPhone = normaliseNumber(input.guardianPhone);
  if (!guardianPhone) throw new Error('not an Australian mobile');
  const smsToken = newToken();
  const emailToken = newToken();
  let invitationId = '';
  const client = await db.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `insert into pending_invitation (first_name, dob, guardian_name, guardian_phone, guardian_email, sms_token_hash, email_token_hash, child_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [input.firstName.trim(), input.dob, input.guardianName.trim(), guardianPhone, input.guardianEmail.trim(),
        hashToken(smsToken), hashToken(emailToken), input.childId ?? null],
    );
    await client.query(
      `insert into consent_event (event, detail) values ('invite_created', jsonb_build_object('invitation_id', $1::uuid))`,
      [rows[0].id],
    );
    await client.query('commit');
    invitationId = rows[0].id as string;
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }

  // doc 15 §1 + §2: the guardian approval request, each with its own link.
  //
  // These MUST run after client.release(). Calling out to anything that
  // needs its own connection while still holding this one deadlocks against
  // a single-connection pool — the request waits for a connection only it
  // can free.
  const age = ageOn(input.dob) ?? 0;
  // An under-16's parent approves a page (§1, §2); a 16–17's parent confirms
  // they are the parent (§1b, §2b).
  const sms = input.childId ? guardianConfirmSms16 : guardianApprovalSms;
  const email = input.childId ? guardianConfirmEmail16 : guardianApprovalEmail;
  // Who the two messages are ABOUT (D-78, 0065). A 16–17 already has a person
  // row, so their funnel — sent, delivered, landed, confirmed — is legible on
  // their own consent log. An under-16 has no row yet: nothing about them
  // exists until their parent approves, which is D-17 working as intended, so
  // those rows carry the invitation in `detail` and no subject. At approval
  // the database attaches them to the child's log (0077; BUZ, 28 Sep,
  // decision 8) — linked, never rewritten — so the parent's "We emailed you"
  // line is there on the controls screen.
  const subject = input.childId;
  await sendAndLog(sms(input.firstName.trim(), age, smsToken), { address: guardianPhone, invitationId }, 'sms_sent', subject);
  await sendAndLog(email(input.firstName.trim(), age, emailToken), { address: input.guardianEmail.trim(), invitationId }, 'email_sent', subject);
  return { id: invitationId };
}

/** A fresh link for one channel (the support console's resend). */
export async function reissueChannelToken(invitationId: string, channel: 'sms' | 'email'): Promise<string | null> {
  if (!isUuid(invitationId)) return null;
  const token = newToken();
  const col = channel === 'sms' ? 'sms_token_hash' : 'email_token_hash';
  const r = await db.query(
    `update pending_invitation set ${col} = $2 where id = $1 and approved_at is null and held_at is null returning id`,
    [invitationId, hashToken(token)],
  );
  return r.rowCount ? token : null;
}

export async function getPendingInvitation(id: string) {
  // A mangled link is a dead link, not a crash. This one arrives by SMS and
  // messaging apps truncate and decorate links routinely, so it is the id in
  // this product most likely to turn up malformed.
  if (!isUuid(id)) return null;
  const { rows } = await db.query(
    `select id, first_name, dob, guardian_name, guardian_phone, guardian_email, approved_at, created_at
     from pending_invitation where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Is this invitation's text to the parent still waiting for SMS (D-168,
 * 0120)? The child's waiting screen asks, so it never says a text went that
 * has not.
 */
export async function invitationTextWaiting(id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const { rows } = await db.query('select fn_invitation_sms_queued($1) as q', [id]);
  return rows[0]?.q === true;
}

// The parent's page (/a/[code]) is reached three ways: the texted link, the
// emailed link, or the invitation id (the child's "Show them my page"). Only
// the first two carry a channel. The page shows the child's first name and
// age and nothing else, so that is all this reads — never the parent's
// phone or email (D-25).
export type ApprovalLink = {
  id: string; first_name: string; dob: string; approved_at: string | null; held_at: string | null;
  channel: 'sms' | 'email' | null; sms_confirmed: boolean; email_confirmed: boolean;
  existing_child: boolean; // a 16–17 naming a parent, not an under-16's new page
};

export async function resolveApprovalLink(code: string): Promise<ApprovalLink | null> {
  if (!code || code.length > 200) return null;
  const byId = isUuid(code);
  const { rows } = await db.query(
    `select id, first_name, dob, approved_at, held_at, child_id is not null as existing_child,
       sms_confirmed_at is not null as sms_confirmed, email_confirmed_at is not null as email_confirmed,
       case when $2 then null when sms_token_hash = $3 then 'sms' else 'email' end as channel
     from pending_invitation
     where case when $2 then id = $1::uuid else (sms_token_hash = $3 or email_token_hash = $3) end`,
    [byId ? code : '00000000-0000-0000-0000-000000000000', byId, hashToken(code)],
  );
  return (rows[0] ?? null) as ApprovalLink | null;
}

// Kept for the done page, which is addressed by invitation id.
export async function getInvitationForParentPage(id: string) {
  if (!isUuid(id)) return null;
  const { rows } = await db.query(
    `select id, first_name, dob, approved_at, held_at, child_id is not null as existing_child from pending_invitation where id = $1`,
    [id],
  );
  return (rows[0] ?? null) as { id: string; first_name: string; dob: string; approved_at: string | null; held_at: string | null; existing_child: boolean } | null;
}

/**
 * The parent reached the permission page (D-78, `guardian_landed`).
 *
 * The funnel's whole purpose is to separate "the message never arrived" from
 * "it arrived and nothing happened", and this is the state in the middle: the
 * one word in D-78's vocabulary that means the page was opened. It was in the
 * vocabulary, rendered on the guardian's own screen as "You opened the
 * permission page", seeded into the dev fixture — and written by nothing, so
 * on real data it could never appear (L13).
 *
 * Once per invitation, not once per visit: the log is append-only and a parent
 * reloading a page four times did not open it four times.
 *
 * The subject is the child where one exists (a 16–17 naming their parent). For
 * an under-16 nothing about the child exists yet, by D-17, so the row carries
 * the invitation and no subject.
 *
 * It is a page load, and a link in an SMS or an email is routinely fetched by
 * the messaging app's own preview bot. Leo's call (28 Sep): the page does not
 * call this for a HEAD or for a known link-preview fetcher (lib/link-preview).
 * That list is a heuristic and says so; a fetcher we have not named can still
 * write this row. D-78 defines the state as the page being opened; writing it
 * on the first press instead would be the same moment as
 * `email_verified`/`sms_verified` and tell the funnel nothing new.
 */
export async function recordGuardianLanded(invitationId: string, channel: 'sms' | 'email' | null): Promise<void> {
  if (!isUuid(invitationId)) return;
  // The rule lives in fn_record_guardian_landed (0065), where the permission
  // suite drives it: once per open invitation, nothing after approval or a hold.
  await db.query('select fn_record_guardian_landed($1::uuid, $2)', [invitationId, channel]);
}

/** "Yes, it's me — continue" (D-156). A press, never a page load. */
export async function confirmChannel(code: string): Promise<boolean> {
  const link = await resolveApprovalLink(code);
  if (!link || !link.channel || link.approved_at || link.held_at) return false;
  const col = link.channel === 'sms' ? 'sms_confirmed_at' : 'email_confirmed_at';
  const r = await db.query(
    `update pending_invitation set ${col} = now() where id = $1 and ${col} is null returning id`, [link.id]);
  if (r.rowCount) {
    await db.query(
      `insert into consent_event (event, detail) values ($1, jsonb_build_object('invitation_id', $2::uuid))`,
      [link.channel === 'sms' ? 'sms_verified' : 'email_verified', link.id],
    );
  }
  return true;
}

/**
 * "No, end this request" (D-PD-3; John, 1 Oct). A press, never a page load.
 *
 * The database decides everything (0167, fn_end_pending_invitation): the code
 * must be one of the two channel links — confirmed or not (F15) — and the
 * invitation must be neither approved nor held. Then it runs the SAME
 * deletion as the fourteen-day purge — the row, what its messages carried,
 * one subjectless `purged` event with the reason, the channel type and
 * whether that link had been confirmed — and nothing else. Only the hash leaves this file, as
 * everywhere else a link is matched. No message goes to anyone: nobody is a
 * guardian yet. A refusal changes nothing, and the caller treats it as if
 * nothing had been pressed.
 */
export async function endPendingInvitation(code: string): Promise<boolean> {
  if (!code || code.length > 200) return false;
  const { rows } = await db.query('select fn_end_pending_invitation($1) as ended', [hashToken(code)]);
  return rows[0]?.ended === true;
}

// Approval: the guardian's tap, once both channels are confirmed (D-156) and
// the guardian has declared they are 18 or over (D-155). One transaction:
// guardian person + child person + approved guardianship + empty
// development record + the consent rows that prove it, stamped with the
// doc@version texts in force (D-144).
//
// If the email names an account under 18 by date of birth, nothing is linked
// and the invitation is HELD (D-155). The caller cannot tell the difference:
// both return the invitation id, and the pages read the same.
export async function approveInvitation(input: {
  code: string;
  adultDeclared: boolean;
}): Promise<{ invitationId: string } | null> {
  const link = await resolveApprovalLink(input.code);
  if (!link || !link.channel || !input.adultDeclared) return null;
  const client = await db.connect();
  try {
    await client.query('begin');
    const inv = await client.query(
      `select id, first_name, dob, guardian_name, guardian_email, child_id from pending_invitation
       where id = $1 and approved_at is null and held_at is null
         and sms_confirmed_at is not null and email_confirmed_at is not null
       for update`,
      [link.id],
    );
    if (inv.rows.length === 0) {
      await client.query('rollback');
      // Already approved or already held: the same answer as a fresh approval.
      return link.approved_at || link.held_at ? { invitationId: link.id } : null;
    }
    const p = inv.rows[0];

    const existing = (await client.query(
      `select id, dob is not null and fn_age_band(dob) <> '18plus' as minor,
         email_proved_at is null as unproved
       from person where lower(email) = lower($1)`,
      [p.guardian_email],
    )).rows[0];
    if (existing?.minor) {
      // D-155: never linked, never told. An operator sees the hold.
      await client.query(`update pending_invitation set held_at = now() where id = $1`, [p.id]);
      await client.query('commit');
      return { invitationId: p.id };
    }

    const gName: string = p.guardian_name ?? '';
    const guardianId = existing?.id ?? (await client.query(
      `insert into person (first_name, last_name, email) values ($1,$2,$3) returning id`,
      [gName.split(' ')[0] || 'Guardian', gName.split(' ').slice(1).join(' ') || null, p.guardian_email],
    )).rows[0].id;

    // B2 (safety review, 22 Sep; L21). Before 0056, a person row already
    // holding this address was linked to the child whatever it was: someone
    // who knew a parent's address could sign up with it, wait, and be handed
    // that parent's child — the record, the link, the sends, pause and
    // deletion — while the parent, who never set a password, saw nothing.
    //
    // The person standing here has just proved this address on BOTH channels
    // (D-156): they were texted and emailed, and pressed on each. So the
    // approval is what settles who owns the account. Any password set on it
    // before now was set by somebody who could not open this inbox, and it
    // goes — along with any reset link outstanding from before this moment.
    // Whoever holds the inbox keeps the account; whoever typed the address
    // keeps nothing. They are told nothing, exactly as D-155's hold tells
    // nobody: the person on this page is the one we know is real.
    const cleared = existing?.unproved
      ? (await client.query(`delete from auth_credential where person_id = $1 returning person_id`, [guardianId])).rowCount ?? 0
      : 0;
    if (existing?.unproved) {
      await client.query(`delete from auth_reset where person_id = $1 and used_at is null`, [guardianId]);
    }
    // The email channel of this invitation was confirmed by a press, so the
    // address is proved — for a fresh account and for one that was sitting
    // here unproved. The database refuses the guardianship link otherwise
    // (0056), which is what makes this a property rather than a habit.
    await client.query(
      `update person set email_proved_at = coalesce(email_proved_at, now()) where id = $1`, [guardianId]);
    await client.query(`update person set adult_declared_at = coalesce(adult_declared_at, now()) where id = $1`, [guardianId]);
    // An under-16's page is created now. A 16–17 already exists (0048): the
    // parent is linked to them, and nothing else about them changes.
    const childId: string = p.child_id ?? (await client.query(
      `insert into person (first_name, dob, dob_locked) values ($1,$2,true) returning id`,
      [p.first_name, p.dob],
    )).rows[0].id;

    await client.query(
      `insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`,
      [guardianId, childId],
    );
    if (!p.child_id) await client.query(`insert into development_record (person_id) values ($1)`, [childId]);
    await client.query(`update pending_invitation set approved_at = now() where id = $1`, [p.id]);

    // The consent log IS the product's proof. Guardian approval is the ToS
    // acceptance on the child's behalf (CLAUDE.md launch scope). The adult
    // declaration rides on the approval row (D-155).
    const ev = (event: string, policy: string | null, extra: Record<string, unknown> = {}) =>
      client.query(
        `insert into consent_event (event, actor_id, subject_id, detail, policy_version)
         values ($1,$2,$3, jsonb_build_object('invitation_id', $4::uuid) || $6::jsonb, $5)`,
        [event, guardianId, childId, p.id, policy, JSON.stringify(extra)],
      );
    // The approval row carries what the approval did to the account, because
    // the approval is the only thing that can do it: the address was proved
    // here, and a password set on it by somebody else was cleared here (B2).
    // "What happened, by whom, when" is answerable from this one row.
    await ev('approved', null, {
      adult_declared: true, channels: ['sms', 'email'], email_proved: true,
      ...(cleared ? { credential_cleared: true } : {}),
      ...(p.child_id ? { kind: 'parent_confirmed' } : {}),
    });
    // A 16–17 accepted the terms themselves at sign-up; only an under-16's
    // parent accepts them on the child's behalf.
    if (!p.child_id) {
      await ev('tos_accepted', legalStamp('22'));
      // The child's policy, shown on the approval page (B3), on their behalf.
      await ev('policy_accepted', legalStamp('21'), { on_behalf_of_child: true });
    }
    // The parent's own account is an adult account: doc 20.
    await client.query(
      `insert into consent_event (event, actor_id, subject_id, detail, policy_version)
       values ('policy_accepted', $1, $1, jsonb_build_object('invitation_id', $2::uuid), $3)`,
      [guardianId, p.id, legalStamp('20')],
    );

    await client.query('commit');
    return { invitationId: p.id };
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}
