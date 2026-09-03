// Spam Act: consent must be provable, not asserted (doc 29 §3).
// CONSENT_TEXT is the exact wording on screen beside the submit button — the
// form renders THIS constant and the API stores THIS constant, so the stored
// consent can never drift from what the person actually read.
export const CONSENT_TEXT =
  'An email and who you are. Nothing else. Sent by Pitch Football, Melbourne — one email when we open, unsubscribe in it.';

// 'doc@version' per legal/00-Legal-Register.md — doc 20 is at v2.4 (draft).
// Two placeholders remain before publication: doc 22's registered-office
// street number (from the ASIC record) and the publication date (stamped at
// deploy). Bump this when the published version changes.
export const POLICY_VERSION = '20@v2.4';

export const ROLES = ['player', 'coach', 'club', 'parent'] as const;
export type Role = (typeof ROLES)[number];

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
