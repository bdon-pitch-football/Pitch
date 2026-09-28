// Spam Act: consent must be provable, not asserted (doc 29 §3).
// CONSENT_TEXT is the exact wording on screen beside the submit button — the
// form renders THIS constant and the API stores THIS constant, so the stored
// consent can never drift from what the person actually read.
export const CONSENT_TEXT =
  'An email and who you are. Nothing else. You are 18 or over — under 18, a parent joins for you. ' +
  'Sent by Pitch Football (EBSD Enterprises Pty Ltd, ABN 65 701 879 718), Melbourne — one email when we open, unsubscribe in it.';

// 'doc@version' per legal/00-Legal-Register.md.
// Doc 20 is at v2.8 (28 Sep 2026): the drafting preamble no longer renders, so
// the served bytes changed. John ruled it NOT material and ruled the version
// still bumps, so every consent row names exactly the text that was shown —
// and no guardian is re-asked, because nothing in the agreement moved (doc 35
// ruling 1).
//
// Rows already written keep the version they were written with. 20@v2.4 and
// 20@v2.5 are retained unaltered under legal/_superseded/ and in git history,
// because a consent row must resolve to the exact text that person read.
// Bump this in the same commit that changes what /privacy serves — never
// separately, in either direction.
export const POLICY_VERSION = '20@v2.8';

// ---------------------------------------------------------------------------
// A version string is an assertion until it is bound to bytes (John, 3 Sep).
// The binding USED TO live here as a typed constant — POLICY_SHA256, the hash
// of the policy FILE — and a second path stamped with a hash of the SERVED
// text. On 28 Sep that meant doc 20 had two different hashes in one codebase:
// the waitlist wrote e8268292… and the consent path wrote 4de5b506…, for the
// same document. Only one of them described what a person actually read.
//
// Both constants are gone. Every stamp now comes from legalStamp() in
// lib/legal-stamp.ts, which hashes the text AS SERVED — one answer, derived
// rather than typed, so it cannot drift from the page. The suite fails if a
// 64-hex hash is ever typed into lib/ or app/ again (jr3).


export const ROLES = ['player', 'coach', 'club', 'parent'] as const;
export type Role = (typeof ROLES)[number];

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
