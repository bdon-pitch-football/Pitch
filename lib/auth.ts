// Credentials (D-80, D-94 §2). The interface is the contract: production
// swaps the implementation for Supabase Auth (the D-52 stack decision)
// without any caller changing.
//
// Three disciplines this file exists to hold:
//  · Identical responses. Sign-in and reset must behave the same whether or
//    not the account exists — same body, same timing (D-94 §2). Callers get
//    a boolean they are expected to IGNORE for routing purposes.
//  · Reset tokens are stored hashed, single-use, one hour. A database dump
//    must not yield a working link.
//  · An under-16's reset goes to the guardian, never to the child (§10
//    amendment, D-19).
//  · An address nobody has proved signs in nowhere (0056, L21). The answer
//    comes from fn_email_proved, and the same scrypt work runs either way —
//    an unproved account must be indistinguishable from a wrong password and
//    from no account at all (D-94 §2).
import 'server-only';
import { createHash, randomBytes, randomUUID, scrypt as _scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db';
import { revokeEverySession } from './session';

const scrypt = promisify(_scrypt) as (p: string, s: string, k: number) => Promise<Buffer>;
const KEYLEN = 64;

/** The same scrypt work as setPassword, stored nowhere (join: timing). */
export async function hashPasswordForTiming(password: string): Promise<void> {
  await scrypt(password, randomBytes(16).toString('hex'), KEYLEN);
}

// Setting a password ends every live session for this person (0062) —
// INCLUDING the one doing the setting, and that is the decision rather than an
// oversight. A parent changing their password believes it locks the other
// person out; if we exempted "the session doing the resetting" then whoever
// holds a captured cookie AND intercepts one reset email keeps their session
// while the parent is the one who has to sign in again. The exemption would
// be worth nothing anyway: the reset flow already ends at /signin?reset=1 and
// the sign-up doors sign nobody in, so no path in the product loses anything
// it had. It costs one sign-in and it is the more restrictive answer.
export async function setPassword(personId: string, password: string): Promise<void> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, KEYLEN)).toString('hex');
  await db.query(
    `insert into auth_credential (person_id, password_hash) values ($1,$2)
     on conflict (person_id) do update set password_hash = $2, updated_at = now()`,
    [personId, `${salt}:${derived}`],
  );
  await revokeEverySession(personId);
}

// Always does the same work, whether or not the person or credential exists,
// so timing cannot be used to enumerate accounts.
export async function verifyPassword(email: string, password: string): Promise<string | null> {
  const { rows } = await db.query(
    `select p.id, ac.password_hash, fn_email_proved(p.id) as proved from person p
     left join auth_credential ac on ac.person_id = p.id
     where lower(p.email) = lower($1)`,
    [email],
  );
  const stored = rows[0]?.password_hash as string | undefined;
  // A decoy hash keeps the work identical for a non-existent account.
  const [salt, derived] = (stored ?? `${'0'.repeat(32)}:${'0'.repeat(KEYLEN * 2)}`).split(':');
  const candidate = await scrypt(password, salt, KEYLEN);
  const expected = Buffer.from(derived, 'hex');
  const match =
    candidate.length === expected.length && timingSafeEqual(candidate, expected);
  // The proof check comes AFTER the same work, and says nothing of its own:
  // a right password on an unproved account is the same answer as a wrong
  // one (L21, B1/B2 — whoever typed that address may not own it).
  return stored && match && rows[0].proved === true ? (rows[0].id as string) : null;
}

// The link a sign-up door sends (0056). The token is returned to the CALLER
// to put in a message; only its hash is stored, as for a reset. Seven days:
// nothing about it is urgent, and a lapsed one is recoverable through the
// doc 15 §10 reset link, which sets a password and proves the address at once.
export async function createAddressProof(personId: string): Promise<string> {
  const token = randomBytes(24).toString('base64url');
  await db.query(
    `insert into email_proof (person_id, token_hash, expires_at)
     values ($1, $2, now() + interval '7 days')`,
    [personId, createHash('sha256').update(token).digest()],
  );
  return token;
}

/** "Yes, it's me" on the door's link. Single-use; the database marks the proof. */
export async function useAddressProof(token: string): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const { rows } = await db.query('select fn_use_email_proof($1) as person_id',
    [createHash('sha256').update(token).digest()]);
  return (rows[0]?.person_id as string | null) ?? null;
}

/** Is there a live, unopened link for this token? Used to render the page. */
export async function addressProofIsLive(token: string): Promise<boolean> {
  if (!token || token.length > 200) return false;
  const { rows } = await db.query(
    `select 1 from email_proof where token_hash = $1 and used_at is null and expires_at > now()`,
    [createHash('sha256').update(token).digest()],
  );
  return rows.length > 0;
}

// Reset: the token is returned to the CALLER to put in a message; only its
// hash is stored. For an under-16 the recipient is the guardian.
// firstPasswordChild: set when this account has never had a password and is
// an approved guardian — the reset email is then doc 15 §10a ("Set your Pitch
// password", naming the child they approved most recently), not §10.
export async function createReset(email: string): Promise<{ token: string; sendTo: string; firstPasswordChild: string | null } | null> {
  const { rows } = await db.query(
    `select p.id, p.email, fn_age_band(p.dob) as band,
       (select p2.email from guardianship_link g join person p2 on p2.id = g.guardian_id
        where g.child_id = p.id and g.approved_at is not null and g.revoked_at is null
          and p2.email is not null limit 1) as guardian_email,
       -- A parent is created at approval with no date of birth (lib/
       -- guardian-flow), and fn_age_band reads a missing DOB as under 16 —
       -- the restrictive default. Without this, the reset went to the
       -- parent's own "guardian", who does not exist, and a newly approved
       -- parent could never set a password or sign in to manage their child.
       (p.dob is null and exists(select 1 from guardianship_link g2
          where g2.guardian_id = p.id and g2.approved_at is not null and g2.revoked_at is null)) as dobless_guardian,
       case when not exists(select 1 from auth_credential ac where ac.person_id = p.id) then
         (select c.first_name from guardianship_link g3 join person c on c.id = g3.child_id
          where g3.guardian_id = p.id and g3.approved_at is not null and g3.revoked_at is null
          order by g3.approved_at desc limit 1)
       end as first_password_child
     from person p where lower(p.email) = lower($1)`,
    [email],
  );
  const p = rows[0];
  if (!p) return null;

  const recipient = p.band === 'u16' && !p.dobless_guardian ? p.guardian_email : p.email;
  if (!recipient) return null;

  const token = randomBytes(24).toString('base64url');
  // Inserting this one kills every link outstanding for this person — the
  // auth_reset_one_live trigger (0062), not a line here, so no future route
  // that sends a reset can forget it.
  // §10a only when the email is going to the account holder themselves — and
  // that is also the only case in which using the link proves the ADDRESS on
  // the account (0056). An under-16's reset goes to their parent, which
  // proves the parent's inbox and says nothing about the child's.
  const ownMail = recipient === p.email;
  await db.query(
    `insert into auth_reset (person_id, token_hash, expires_at, proves_person_id)
     values ($1, $2, now() + interval '1 hour', $3)`,
    [p.id, createHash('sha256').update(token).digest(), ownMail ? p.id : null],
  );
  return { token, sendTo: recipient, firstPasswordChild: ownMail ? (p.first_password_child ?? null) : null };
}

// Single use, and using one kills every other live link for that person
// (0062). All three rules — marked used in the same statement that reads it so
// two simultaneous uses cannot both succeed, the siblings revoked with it, and
// the 0056 address proof written once the row is used — live in
// fn_use_auth_reset, because a reset link is a key to an account and the
// question "is this key still a key" must have exactly one answer (L23).
export async function consumeReset(token: string): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const { rows } = await db.query('select fn_use_auth_reset($1) as person_id',
    [createHash('sha256').update(token).digest()]);
  return (rows[0]?.person_id as string | null) ?? null;
}

// A device we have not seen before (doc 15 §33). Never an IP, never a city.
export async function isNewDevice(personId: string, userAgent: string): Promise<boolean> {
  const hash = createHash('sha256').update(`${personId}:${userAgent}`).digest();
  const { rows } = await db.query(
    `insert into auth_device (person_id, device_hash) values ($1,$2)
     on conflict (person_id, device_hash) do nothing returning id`,
    [personId, hash],
  );
  return rows.length > 0;
}

export const newSessionId = () => randomUUID();
