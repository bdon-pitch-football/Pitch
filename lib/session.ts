// Session abstraction. Supabase Auth is the production session store (D-80:
// session ONLY — verification is modelled in verification_challenge, never
// phone-OTP sign-in). Until that wiring lands, development uses a signed
// httpOnly cookie carrying the person id. The interface is the contract;
// swapping the implementation must not touch any caller.
//
// Cookie rules (D-94 §2): httpOnly, sameSite=lax, secure in production,
// never localStorage.
import 'server-only';
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { db } from './db';
import { isUuid } from './ids';

const COOKIE = 'pitch_session';
// The cookie is only worth the secret that signs it. This fell back to a
// literal string that is committed to this repository, AND SESSION_SECRET
// WAS NOT IN .env.example — so the documented way to configure production
// produced an app whose sessions were signed with a known constant. Anyone
// who could read that constant could mint `pitch_session=<any person id>.
// <hmac>` and be that person: a guardian, a club's technical director, an
// operator.
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

export async function getSessionPersonId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const [id, sig] = raw.split('.');
  if (!id || !sig) return null;
  const expect = sign(id);
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!isUuid(id)) return null;

  // A signature only proves the cookie was minted here — not that the person
  // still exists. A guardian's deletion removes person rows, and any session
  // issued before that stayed valid: every action then wrote person_id into
  // a foreign key and got a database error instead of a sign-in screen.
  // Being signed in as somebody who no longer exists is not being signed in.
  const { rows } = await db.query(`select 1 from person where id = $1`, [id]);
  if (rows.length === 0) return null;
  return id;
}

export async function setSessionPersonId(personId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, `${personId}.${sign(personId)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
