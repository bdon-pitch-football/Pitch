// Twilio's request signature, in one place (D-81).
//
// Two endpoints receive from Twilio — the inbound STOP/HELP reply and the
// delivery status callback — and both have to agree byte for byte on how a
// signature is checked. A second copy of a security primitive is the same
// mistake lib/messaging warns about for numberHash: it fails silently and you
// find out from a complaint, or worse, from something that should have been
// refused and was not.
//
// The scheme is Twilio's own and it is not a guess: the full request URL,
// then every POST parameter appended as key+value in sorted key order,
// HMAC-SHA1 with the account's auth token, base64. Compared in constant time.
//
// Pure on purpose — no database, no environment — so the permission suite can
// drive it directly and prove it refuses a wrong signature.
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyTwilioSignature(
  url: string, params: Record<string, string>, header: string | null, token: string,
): boolean {
  if (!header || !token) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const expected = createHmac('sha1', token).update(data).digest('base64');
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
