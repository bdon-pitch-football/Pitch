// Spam Act: consent must be provable, not asserted (doc 29 §3).
// CONSENT_TEXT is the exact wording on screen beside the submit button — the
// form renders THIS constant and the API stores THIS constant, so the stored
// consent can never drift from what the person actually read.
export const CONSENT_TEXT =
  'An email and who you are. Nothing else. You are 18 or over — under 18, a parent joins for you. ' +
  'Sent by Pitch Football (EBSD Enterprises Pty Ltd, ABN 65 701 879 718), Melbourne — one email when we open, unsubscribe in it.';

// 'doc@version' per legal/00-Legal-Register.md — doc 20 is at v2.4 (draft).
// Two placeholders remain before publication: doc 22's registered-office
// street number (from the ASIC record) and the publication date (stamped at
// deploy). Bump this when the published version changes.
//
// DELIBERATELY STILL v2.4 (20 Sep). The wording above came across from the
// app branch, where this constant reads '20@v2.7' and is paired with a
// POLICY_SHA256 of the doc 20 file as served. Neither could come with it:
// docs/legal/20-Privacy-Policy-Adult.md on this branch IS v2.4, and /privacy
// serves that file directly (app/legal/legal-page.tsx reads the markdown at
// request time). Writing '20@v2.7' here would have this branch record a
// consent against a policy version nobody visiting it can read — the exact
// failure the version string exists to prevent, and the thing the app
// branch's own note forbids: bump this in the same commit that changes what
// /privacy serves, never separately, in either direction.
//
// The new sentences are safe against v2.4 on their own: v2.4 already names
// EBSD Enterprises Pty Ltd and ABN 65 701 879 718 (§ "The company holding
// your information"), and the form has always been 18-and-over. So the
// wording moved and the version did not, which is the honest pairing —
// consent_text is stored verbatim either way.
//
// To move to '20@v2.7' this branch needs doc 20 v2.7 itself (and the v2.5/
// v2.6 versions it supersedes, retained under legal/_superseded/), plus the
// S13 corpus check that binds POLICY_SHA256 to the served bytes. Until that
// text is here, this stays where the served policy is.
export const POLICY_VERSION = '20@v2.4';

export const ROLES = ['player', 'coach', 'club', 'parent'] as const;
export type Role = (typeof ROLES)[number];

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
