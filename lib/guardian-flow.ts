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
import { db } from './db';
import { isUuid } from './ids';
import { createHash, randomBytes } from 'node:crypto';
import { guardianApprovalEmail, guardianApprovalSms } from './messages';
import { sendAndLog } from './messaging';

// doc@version stamps (legal/00-Legal-Register.md): published versions at
// approval time. Bump when the published documents change.
const TOS_VERSION = '22@v1.7';
const PRIVACY_VERSION = '20@v2.4';

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
}): Promise<{ id: string }> {
  const smsToken = newToken();
  const emailToken = newToken();
  let invitationId = '';
  const client = await db.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `insert into pending_invitation (first_name, dob, guardian_name, guardian_phone, guardian_email, sms_token_hash, email_token_hash)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [input.firstName.trim(), input.dob, input.guardianName.trim(), input.guardianPhone.trim(), input.guardianEmail.trim(),
        hashToken(smsToken), hashToken(emailToken)],
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
  const age = Math.floor((Date.now() - new Date(input.dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  await sendAndLog(guardianApprovalSms(input.firstName.trim(), age, smsToken), { address: input.guardianPhone.trim() }, 'sms_sent');
  await sendAndLog(guardianApprovalEmail(input.firstName.trim(), age, emailToken), { address: input.guardianEmail.trim() }, 'email_sent');
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

// The parent's page (/a/[code]) is reached three ways: the texted link, the
// emailed link, or the invitation id (the child's "Show them my page"). Only
// the first two carry a channel. The page shows the child's first name and
// age and nothing else, so that is all this reads — never the parent's
// phone or email (D-25).
export type ApprovalLink = {
  id: string; first_name: string; dob: string; approved_at: string | null; held_at: string | null;
  channel: 'sms' | 'email' | null; sms_confirmed: boolean; email_confirmed: boolean;
};

export async function resolveApprovalLink(code: string): Promise<ApprovalLink | null> {
  if (!code || code.length > 200) return null;
  const byId = isUuid(code);
  const { rows } = await db.query(
    `select id, first_name, dob, approved_at, held_at,
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
    `select id, first_name, dob, approved_at, held_at from pending_invitation where id = $1`,
    [id],
  );
  return (rows[0] ?? null) as { id: string; first_name: string; dob: string; approved_at: string | null; held_at: string | null } | null;
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
      `select id, first_name, dob, guardian_name, guardian_email from pending_invitation
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
      `select id, dob is not null and fn_age_band(dob) <> '18plus' as minor from person where lower(email) = lower($1)`,
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
    await client.query(`update person set adult_declared_at = coalesce(adult_declared_at, now()) where id = $1`, [guardianId]);
    const child = await client.query(
      `insert into person (first_name, dob, dob_locked) values ($1,$2,true) returning id`,
      [p.first_name, p.dob],
    );
    const childId = child.rows[0].id;

    await client.query(
      `insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`,
      [guardianId, childId],
    );
    await client.query(`insert into development_record (person_id) values ($1)`, [childId]);
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
    await ev('approved', null, { adult_declared: true, channels: ['sms', 'email'] });
    await ev('tos_accepted', TOS_VERSION);
    await ev('policy_accepted', PRIVACY_VERSION);

    await client.query('commit');
    return { invitationId: p.id };
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}
