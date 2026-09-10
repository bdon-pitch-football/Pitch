// Who may trigger a scheduled job — the decision, with no framework around it
// so it can actually be run by a test. Same shape and same reasoning as
// lib/ops-policy.ts.
//
// Two of the three job routes compared the header against
// `Bearer ${process.env.CRON_SECRET}` with no check that the secret exists.
// With CRON_SECRET unset — which is the state of every deploy until somebody
// remembers to set it — that template renders the literal string
// "Bearer undefined", and anyone sending exactly that header is let in. The
// digest route and all three webhooks already refused on an absent secret;
// these two were the odd ones out.
//
// It matters because of what is behind them: /api/jobs/outbox dispatches the
// message queue, and D-81 is explicit that an unrated endpoint which can be
// made to send is how a small launch loses four figures overnight. The daily
// job emails guardians.
export function cronAllowed(
  authHeader: string | null | undefined,
  secret: string | undefined,
  isProduction: boolean,
): boolean {
  // Open in development so the walkthrough needs no configuration, exactly as
  // the operator console is.
  if (!isProduction) return true;
  // No secret configured admits NOBODY. The other reading — "nothing is set,
  // so let it through" — is the job endpoints standing open on first deploy.
  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}
