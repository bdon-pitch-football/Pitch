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
