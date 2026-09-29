// Who may open the operator console — the decision, with no framework around
// it so it can actually be run by a test.
//
// This is the most privileged surface in the product: the console that
// verifies a club, suspends a club, and re-sends a guardian's approval. Its
// authorisation used to be asserted by two regexes over lib/ops-guard.ts, and
// the gate is deliberately open in development so the walkthrough needs no
// configuration — which meant nothing driving the running app could exercise
// it either. "The source contains the right words" was the only evidence for
// the one door that matters most.
//
// Separated from the redirect, it is ordinary code with ordinary inputs and
// the suite runs the whole matrix against it.
export function operatorAllowed(
  email: string | null | undefined,
  allowRaw: string | undefined,
  isProduction: boolean,
): boolean {
  // No identity, no console — in every environment. A signed-in session whose
  // person row carries no email is not an operator anywhere.
  if (!email) return false;
  if (!isProduction) return true;
  const allow = (allowRaw ?? '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  // An empty allowlist admits NOBODY. The failure mode of the other reading —
  // "no list configured, so let everyone in" — is the console standing open
  // on the first deploy, before anyone has thought about it.
  if (allow.length === 0) return false;
  return allow.includes(email.trim().toLowerCase());
}

// Typed in full before every live link is switched off (0044). It cannot be
// undone, so a click is not enough.
export const REVOKE_ALL_PHRASE = 'SWITCH OFF EVERY LINK';

// ⚠ AWAITING BUZ. The clubs directory and the notices Pitch compiles (brief I,
// 0130) are built, and their words are new: every string on /ops/clubs that is
// not already on a signed screen is listed verbatim in the brief I report.
// Until BUZ approves them the screens and their rail door exist in
// development only, where the suites drive them; in production /ops/clubs is
// a 404 and every action under it refuses. Flip this to true in the same
// commit that records his yes (docs/team/APPROVALS-28-SEP.md).
export const CLUBS_WORDS_APPROVED = false;
export function clubsScreensShown(isProduction: boolean): boolean {
  return CLUBS_WORDS_APPROVED || !isProduction;
}
