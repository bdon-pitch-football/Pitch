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
// brackets go, and an Australian number written nationally (0…) or without
// its plus (61…) is written +61…. Anything else is hashed as it stands.
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

/** The one form a number is hashed in. */
export function normaliseNumber(n: string): string {
  const s = n.replace(/[\s\-().]/g, '');
  if (/^0\d{9}$/.test(s)) return `+61${s.slice(1)}`;
  if (/^61\d{9}$/.test(s)) return `+${s}`;
  return s;
}

/** HMAC-SHA256 of the number under the key, or null with no key. */
export function keyedNumberHash(n: string, key: string | null): Buffer | null {
  if (!key) return null;
  return createHmac('sha256', key).update(normaliseNumber(n)).digest();
}
