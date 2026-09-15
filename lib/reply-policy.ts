// Where a reply to one of our emails goes — the decision, with no framework
// around it so the suite can run it. Same shape as ops-policy and cron-policy.
//
// John's U-11 ruling: there is no inbound reply route, and the CV a family
// sends a club (doc 15 §19) tells the club that replies reach nobody. That
// email carried a Reply-To anyway — a single global address, set to a
// person's own work inbox — so a club hitting reply on a child's CV would
// have landed in that inbox: breaking the email's own promise, breaking the
// ruling, and putting correspondence about a child in a personal mailbox.
//
// §19 now sends with no Reply-To at all. Replies fall back to the From
// address on the send. subdomain, which has no inbound MX (see
// docs/dns-records-resend.md §4) — so they genuinely reach nobody.
//
// Every other message keeps a Reply-To, because several of them ask for a
// reply ("reply to this email and we will do it", "just hit reply") — and it
// is the SUPPORT inbox, never a person.

/** Messages a reply must never reach anyone from. */
export const NO_REPLY_KEYS: ReadonlySet<string> = new Set(['doc15.§19']);

export function replyToFor(messageKey: string | undefined, supportAddress: string | undefined): string | undefined {
  // A message we cannot identify fails closed: no Reply-To rather than a
  // guess. A retried row that lost its key must not pick one up.
  if (!messageKey) return undefined;
  if (NO_REPLY_KEYS.has(messageKey)) return undefined;
  return supportAddress || undefined;
}
