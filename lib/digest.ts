// What the 7am digest says — the decision, with no framework around it so the
// suite can run it (the same shape as lib/sms-policy and lib/cron-policy).
//
// Two things can be in it: the waitlist's day (doc 29 §6, as before) and,
// from D-168, how many parents' approval texts are still waiting for SMS, so
// BUZ watches the backlog clear once SMS is live (0120, fn_sms_queued_count).
// Nothing happened, nothing sends — the waitlist's rule, kept for both.
//
// The queued-texts words are NOT approved yet. They are held the same way as
// the operator console's held words: `showQueued` is false in production until
// BUZ approves them, and then the digest is exactly what it was before 0120.

export interface DigestWaitlist {
  newByRole: Record<string, number>;
  newTotal: number;
  total: number;
  unsubscribed: number;
}

// HELD (brief H, D-168): proposed words, listed verbatim in the round H report.
export const queuedTextsLine = (n: number) => `Parents’ texts waiting for SMS: ${n}`;
export const queuedTextsSubject = (n: number) => `Pitch — ${n} parents’ text${n === 1 ? '' : 's'} waiting for SMS`;

/** The subject and body, or null when there is nothing to say. Counts only. */
export function digestMessage(w: DigestWaitlist | null, queuedTexts: number, showQueued: boolean):
  { subject: string; text: string } | null {
  const waitlist = w !== null && w.newTotal > 0;
  const queued = showQueued && queuedTexts > 0;
  if (!waitlist && !queued) return null;
  const lines: string[] = [];
  if (waitlist) {
    const roleLine = (['player', 'coach', 'club', 'parent'] as const)
      .map((r) => `${r[0].toUpperCase() + r.slice(1)}: ${w.newByRole[r] ?? 0}`)
      .join(' · ');
    lines.push(
      `New signups in the last 24 hours: ${w.newTotal}`,
      roleLine,
      '',
      `Running total: ${w.total}`,
      `Unsubscribed: ${w.unsubscribed}`,
      '',
    );
  }
  if (queued) lines.push(queuedTextsLine(queuedTexts), '');
  lines.push('Addresses live in Supabase — no emails in this digest by design.');
  return {
    subject: waitlist ? `Pitch waitlist — ${w.newTotal} new (${w.total} total)` : queuedTextsSubject(queuedTexts),
    text: lines.join('\n'),
  };
}
