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
const secret = () => process.env.SESSION_SECRET || 'dev-only-secret-not-for-production';

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
