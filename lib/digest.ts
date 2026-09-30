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

// The day before on Pitch itself (BUZ, 30 Sep: "set up no. 2"). The same
// counts as the operator's Today screen (fn_ops_day, 0157), for yesterday in
// Melbourne, plus the last 24 hours' failed sends and the clubs waiting on a
// call. Counts only: no name, address or id (D-79).
export interface DigestDay {
  label: string;          // e.g. 'Wed 30 Sep'
  signups: number; player: number; parent: number; coach: number; club: number;
  approvalsSent: number; approved: number;
  failures: number;       // sends that failed in the last 24 hours
  awaitingCall: number;   // claimed clubs waiting for BUZ's verification call
  clubAsks?: number;      // clubs a club person asked us to add (0159), still open
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function dayLines(d: DigestDay): string[] {
  const lines = [`Yesterday on Pitch (${d.label})`, ''];
  if (d.signups > 0) {
    const split = ([['Player', d.player], ['Parent', d.parent], ['Coach', d.coach], ['Club', d.club]] as const)
      .filter(([, n]) => n > 0).map(([r, n]) => `${r} ${n}`).join(' · ');
    lines.push(`New accounts: ${d.signups}${split ? ` (${split})` : ''}`);
  } else {
    lines.push('New accounts: none');
  }
  if (d.approvalsSent > 0) lines.push(`Approval requests sent to parents: ${d.approvalsSent} · Approved: ${d.approved}`);
  if (d.awaitingCall > 0) lines.push(`Clubs waiting for your verification call: ${d.awaitingCall}`);
  if ((d.clubAsks ?? 0) > 0) lines.push(`Clubs asking to be added: ${d.clubAsks}`);
  if (d.failures > 0) lines.push(`Emails or texts that failed to send (last 24 hours): ${d.failures}`);
  lines.push('');
  return lines;
}

const dayHappened = (d: DigestDay | null | undefined): d is DigestDay =>
  !!d && (d.signups > 0 || d.approvalsSent > 0 || d.failures > 0 || d.awaitingCall > 0 || (d.clubAsks ?? 0) > 0);

/** The subject and body, or null when there is nothing to say. Counts only. */
export function digestMessage(w: DigestWaitlist | null, queuedTexts: number, showQueued: boolean, day?: DigestDay | null):
  { subject: string; text: string } | null {
  const waitlist = w !== null && w.newTotal > 0;
  const queued = showQueued && queuedTexts > 0;
  const today = dayHappened(day);
  if (!waitlist && !queued && !today) return null;
  const lines: string[] = [];
  if (today) lines.push(...dayLines(day));
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
  lines.push(today
    ? 'Counts only — no names or addresses in this email, by design. Today so far: pitchfootball.com.au/ops'
    : 'Addresses live in Supabase — no emails in this digest by design.');
  return {
    subject: today ? `Pitch — ${day.signups > 0 ? plural(day.signups, 'new account', 'new accounts') : 'no new accounts'} yesterday`
      : waitlist ? `Pitch waitlist — ${w.newTotal} new (${w.total} total)` : queuedTextsSubject(queuedTexts),
    text: lines.join('\n'),
  };
}
