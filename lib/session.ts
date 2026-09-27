// Session abstraction. Supabase Auth is the production session store (D-80:
// session ONLY — verification is modelled in verification_challenge, never
// phone-OTP sign-in). Until that wiring lands, development uses a signed
// httpOnly cookie carrying an opaque session token. The interface is the
// contract; swapping the implementation must not touch any caller.
//
// Cookie rules (D-94 §2): httpOnly, sameSite=lax, secure in production,
// never localStorage.
//
// THE COOKIE IS NOT THE SESSION — the row is (0061). It used to be: the value
// was the person id plus an HMAC of the person id, which made it a permanent
// bearer token for that account. Nothing could be revoked, because there was
// nothing to revoke: signing out deleted the browser's copy and a cookie
// captured beforehand still opened /home afterwards, still opened it after the
// password was changed, and still opened it after signing back in.
//
// So: the cookie carries a random token, the database holds its hash against a
// person, an issued-at and a revoked-at, and every read asks the database
// whether that session is still a session. The HMAC stays — it is what lets a
// forged or mangled cookie be refused without a database lookup, so guessing
// at tokens never reaches the table.
import 'server-only';
import { cookies } from 'next/headers';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { db } from './db';

const COOKIE = 'pitch_session';
// The cookie is only worth the secret that signs it. This fell back to a
// literal string that is committed to this repository, AND SESSION_SECRET
// WAS NOT IN .env.example — so the documented way to configure production
// produced an app whose sessions were signed with a known constant. Anyone
// who could read that constant could mint a cookie and be that person: a
// guardian, a club's technical director, an operator. (A known secret is no
// longer enough on its own — a forged cookie now also has to name a session
// the database issued — but that is a second lock, not a reason to weaken
// the first.)
//
// Production has no fallback. It fails on the first request rather than at
// build, because a secret should not have to exist to compile — but it
// fails loudly, which is the only acceptable behaviour for this one.
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is not set — refusing to sign sessions with a known value');
  }
  return 'dev-only-secret-not-for-production';
};

const sign = (v: string) => createHmac('sha256', secret()).update(v).digest('base64url');
// 192 bits of CSPRNG, base64url — the same shape and the same standard as a
// share token and a reset token (D-94 §4). Never sequential, never derived
// from a person id, and stored only as a hash.
const newToken = () => randomBytes(24).toString('base64url');
const hashOf = (token: string) => createHash('sha256').update(token).digest();

/**
 * The token out of a cookie value, or null. Refuses anything this app did not
 * mint, in constant time, before the database is touched.
 */
function tokenFromCookie(raw: string | undefined): string | null {
  if (!raw) return null;
  const [token, sig] = raw.split('.');
  if (!token || !sig) return null;
  // A hashed lookup is cheap but it is still a lookup; nothing longer than a
  // token we mint is worth one.
  if (token.length > 200) return null;
  const expect = sign(token);
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return token;
}

export async function getSessionPersonId(): Promise<string | null> {
  const jar = await cookies();
  const token = tokenFromCookie(jar.get(COOKIE)?.value);
  if (!token) return null;
  // The database decides, on every read: revoked, lapsed, never existed, or
  // belonging to a person who no longer exists are one answer here.
  const { rows } = await db.query('select fn_session_person($1) as person_id', [hashOf(token)]);
  return (rows[0]?.person_id as string | null) ?? null;
}

export async function setSessionPersonId(personId: string): Promise<void> {
  const token = newToken();
  // The lifetime is the database's (fn_session_issue), so the cookie and the
  // row cannot disagree about when this session is over.
  const { rows } = await db.query('select fn_session_issue($1,$2) as expires_at', [personId, hashOf(token)]);
  const jar = await cookies();
  jar.set(COOKIE, `${token}.${sign(token)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(rows[0].expires_at as string),
  });
}

/**
 * Sign out. Revokes the session itself, then drops the browser's copy — in
 * that order, because the second one is the only part that used to happen and
 * it is the part that does nothing to anyone holding the cookie already.
 */
export async function clearSession(): Promise<void> {
  const jar = await cookies();
  const token = tokenFromCookie(jar.get(COOKIE)?.value);
  if (token) await db.query('select fn_session_revoke($1)', [hashOf(token)]);
  jar.delete(COOKIE);
}

/**
 * Every live session for this person is over — the point of a new password
 * (lib/auth setPassword). Returns how many there were.
 */
export async function revokeEverySession(personId: string): Promise<number> {
  const { rows } = await db.query('select fn_sessions_revoke_all($1) as n', [personId]);
  return Number(rows[0].n);
}
