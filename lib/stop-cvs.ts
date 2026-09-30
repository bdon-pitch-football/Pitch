// The club's opt-out link in the CV email (doc 15 §19; John, 30 Sep §2: the
// email is treated as commercial, so it carries a working opt-out).
//
// The link names the send it came in — /stop-cvs?r=<request id>&t=<signature>
// — and never the address: an address in a URL ends up in logs, in history
// and in the Referer of whatever the club clicks next. The signature is what
// makes the link mean "the inbox this CV was sent to", so nobody can stop
// sends to a club by guessing request ids. Checked in constant time.
import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { isUuid } from './ids.ts';

// Signed with the session secret, on lib/session.ts's terms: no fallback in
// production. A known key would let anyone mint a stop link for any send.
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is not set — refusing to sign stop links with a known value');
  }
  return 'dev-only-secret-not-for-production';
};

/** The signature for one send's stop link. base64url HMAC-SHA256, 43 characters. */
export function stopCvsSig(requestId: string): string {
  return createHmac('sha256', secret()).update(`stop-cvs:${requestId.toLowerCase()}`).digest('base64url');
}

/** True only for a request id and the signature this app made for it. */
export function stopCvsValid(requestId: string, sig: string): boolean {
  if (!isUuid(requestId) || !/^[A-Za-z0-9_-]{43}$/.test(sig)) return false;
  const want = Buffer.from(stopCvsSig(requestId));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
