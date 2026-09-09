// Spam Act: consent must be provable, not asserted (doc 29 §3).
// CONSENT_TEXT is the exact wording on screen beside the submit button — the
// form renders THIS constant and the API stores THIS constant, so the stored
// consent can never drift from what the person actually read.
export const CONSENT_TEXT =
  'An email and who you are. Nothing else. You are 18 or over — under 18, a parent joins for you. ' +
  'Sent by Pitch Football (EBSD Enterprises Pty Ltd, ABN 65 701 879 718), Melbourne — one email when we open, unsubscribe in it.';

// 'doc@version' per legal/00-Legal-Register.md.
// Doc 20 is at v2.6 (7 Sep 2026). v2.5 named Vercel and Supabase, the two
// processors handling visitor and waitlist data; v2.6 carries the doc 31
// rulings. No placeholders remain in doc 20 or doc 22.
//
// Rows already written keep the version they were written with. 20@v2.4 and
// 20@v2.5 are retained unaltered under legal/_superseded/ and in git history,
// because a consent row must resolve to the exact text that person read.
// Bump this in the same commit that changes what /privacy serves — never
// separately, in either direction.
export const POLICY_VERSION = '20@v2.6';

// ---------------------------------------------------------------------------
// A version string is an assertion until it is bound to bytes (John, 3 Sep).
// D-144 requires that we can render the EXACT text a given person agreed to,
// years later. 'doc@version' alone does not guarantee that: two files can
// carry one version number, and on 7 September two of them did.
//
// POLICY_SHA256 is the SHA-256 of docs/legal/20-Privacy-Policy-Adult.md as
// served. The corpus check (S13) fails if this constant and that file ever
// disagree, so it cannot rot silently.
//
// POLICY_STAMP is what goes on the consent row. It needs no schema change --
// policy_version is already text -- which is why it could be done today.
// THIS CANNOT BE ADDED RETROSPECTIVELY: rows written before it keep
// '20@v2.4' and resolve through legal/_superseded/ and git instead.
export const POLICY_SHA256 = '1be16e97930ea8b62ece19d20e62dcefb2ac59bd2a6d4ee2a7706488fedcac19';
export const POLICY_STAMP = `${POLICY_VERSION}+sha256:${POLICY_SHA256}`;

export const ROLES = ['player', 'coach', 'club', 'parent'] as const;
export type Role = (typeof ROLES)[number];

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
