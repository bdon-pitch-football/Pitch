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
import 'server-only';
import { createHash, randomBytes, randomUUID, scrypt as _scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db';

const scrypt = promisify(_scrypt) as (p: string, s: string, k: number) => Promise<Buffer>;
const KEYLEN = 64;

/** The same scrypt work as setPassword, stored nowhere (join: timing). */
export async function hashPasswordForTiming(password: string): Promise<void> {
  await scrypt(password, randomBytes(16).toString('hex'), KEYLEN);
}

export async function setPassword(personId: string, password: string): Promise<void> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, KEYLEN)).toString('hex');
  await db.query(
    `insert into auth_credential (person_id, password_hash) values ($1,$2)
     on conflict (person_id) do update set password_hash = $2, updated_at = now()`,
    [personId, `${salt}:${derived}`],
  );
}

// Always does the same work, whether or not the person or credential exists,
// so timing cannot be used to enumerate accounts.
export async function verifyPassword(email: string, password: string): Promise<string | null> {
  const { rows } = await db.query(
    `select p.id, ac.password_hash from person p
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
  return stored && match ? (rows[0].id as string) : null;
}

// Reset: the token is returned to the CALLER to put in a message; only its
// hash is stored. For an under-16 the recipient is the guardian.
export async function createReset(email: string): Promise<{ token: string; sendTo: string } | null> {
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
          where g2.guardian_id = p.id and g2.approved_at is not null and g2.revoked_at is null)) as dobless_guardian
     from person p where lower(p.email) = lower($1)`,
    [email],
  );
  const p = rows[0];
  if (!p) return null;

  const recipient = p.band === 'u16' && !p.dobless_guardian ? p.guardian_email : p.email;
  if (!recipient) return null;

  const token = randomBytes(24).toString('base64url');
  await db.query(
    `insert into auth_reset (person_id, token_hash, expires_at)
     values ($1, $2, now() + interval '1 hour')`,
    [p.id, createHash('sha256').update(token).digest()],
  );
  return { token, sendTo: recipient };
}

// Single use: the row is marked used in the same statement that reads it, so
// two simultaneous uses cannot both succeed.
export async function consumeReset(token: string): Promise<string | null> {
  const { rows } = await db.query(
    `update auth_reset set used_at = now()
     where id = (
       select id from auth_reset
       where token_hash = $1 and used_at is null and expires_at > now()
       limit 1)
     returning person_id`,
    [createHash('sha256').update(token).digest()],
  );
  return rows[0]?.person_id ?? null;
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
