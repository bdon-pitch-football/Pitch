// How a phone number is recognised without being stored (D-81; John, 1 Oct,
// §5.2; safety review B-1).
//
// The SMS meter's per-number limit, the STOP list and the inbound STOP
// webhook all have to recognise one number as the same number, byte for
// byte — a second way of doing it is a STOP that silently never matches.
// lib/messaging exports this as numberHash, and that is the only door.
//
// KEYED, NEVER PLAIN. A plain sha256 of an Australian mobile is one of about
// 10^8 inputs, so it is recovered in seconds: it IS the number. So the hash
// is HMAC-SHA256 under a server secret, NUMBER_HASH_KEY, which lives in the
// environment and nowhere else. Development and the suites use a fixed key
// that is published here on purpose (it protects nothing, and lets every
// seat's outbox and STOP list agree). Production has NO fallback: with no
// key there is no hash, and with no hash no SMS is queued, sent or matched
// (lib/messaging) — failing closed, never back to a plain hash.
//
// ONE SHAPE FOR ONE NUMBER. A parent types "0400 818 181"; Twilio reports a
// STOP from "+61400818181". Hashing what each side happened to hold made
// them two numbers, so a STOP never matched the number we text. Both are
// reduced to the one international form first: spaces, dashes, dots and
// brackets go, and an Australian mobile written nationally (04…), without
// its plus (614…) or with it (+614…) is written +614….
//
// AND IT IS THE NUMBER WE TEXT (John, 2 Oct, §5: "normalise to E.164 (+61)
// before sending"). The same function hands Twilio its `To` (lib/messaging
// dispatch), reads the STOP webhook's `From` and makes the fingerprint, so
// the number sent to, the number heard from and the number recognised are
// one string. Australian mobiles only (D-63: accounts are Australia-only, and
// every number we text was typed into an Australian sign-up as 04…). Anything
// else — a landline, an overseas number, too few digits — is not a number we
// text: null, and every caller refuses it, the way /join refuses it.
import { createHmac } from 'node:crypto';

const DEV_KEY = 'pitch-dev-number-hash-key-not-a-secret';
// A key shorter than this is a typo or a placeholder, not a secret.
const MIN_KEY_LENGTH = 32;

/** The key in force, or null when production has none (fail closed). */
export function numberHashKey(
  env: { NUMBER_HASH_KEY?: string; NODE_ENV?: string } = { NUMBER_HASH_KEY: process.env.NUMBER_HASH_KEY, NODE_ENV: process.env.NODE_ENV },
): string | null {
  const k = env.NUMBER_HASH_KEY?.trim();
  if (env.NODE_ENV === 'production') return k && k.length >= MIN_KEY_LENGTH ? k : null;
  return k || DEV_KEY;
}

/** The one form a number takes — sent to, heard from and hashed: an
 *  Australian mobile in E.164 (+614…), or null for anything else. */
export function normaliseNumber(n: string): string | null {
  const s = n.replace(/[\s\-().]/g, '');
  const m = /^(?:\+61|61|0)(4\d{8})$/.exec(s);
  return m ? `+61${m[1]}` : null;
}

/** HMAC-SHA256 of the number under the key, or null with no key or no
 *  number we would text. */
export function keyedNumberHash(n: string, key: string | null): Buffer | null {
  const e164 = normaliseNumber(n);
  if (!key || !e164) return null;
  return createHmac('sha256', key).update(e164).digest();
}
