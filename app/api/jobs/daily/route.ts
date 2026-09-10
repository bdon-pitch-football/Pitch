// Daily job (Vercel cron in production, same guard pattern as the digest):
// runs the D-17 purge. Age bands need no job — they are computed at read
// time; the 30-day birthday notifications join this route with messaging.
import { NextResponse } from 'next/server';
import { cronAllowed } from '@/lib/cron-policy';
import { db } from '@/lib/db';
import { sixteenthBirthdayEmail } from '@/lib/messages';
import { send } from '@/lib/messaging';

export async function GET(request: Request) {
  if (!cronAllowed(request.headers.get('authorization'), process.env.CRON_SECRET,
    process.env.NODE_ENV === 'production')) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { rows } = await db.query('select fn_purge_pending() as purged');
  // Cancellation + 30 days destroys a club's register (D-135). Suspension
  // never does: a family's child is never deleted because a card expired.
  const { rows: cancelled } = await db.query('select fn_purge_cancelled_registers() as n');
  // N14: a registration tagged to a trial goes 90 days after that trial, on
  // a clock that runs identically whether or not the club ever opened it.
  const { rows: pastTrials } = await db.query('select fn_purge_past_trials() as n');
  // U-1 (John): an unactioned request lapses at 14 days. Not for consistency
  // with D-17 but for D-25 — a composed-but-unsent request holds a child's
  // free text for no purpose once nobody is going to act on it, and
  // "indefinite is not a retention period; it is the absence of one".
  const { rows: lapsedSends } = await db.query('select fn_lapse_send_requests() as n');
  const { rows: lapsedInterest } = await db.query('select fn_lapse_interest_requests() as n');
  // U-4 (John): the operational abuse counter is ninety days, and it lives
  // nowhere near a child's record.
  const { rows: abuse } = await db.query('select fn_purge_abuse_signals() as n');

  // doc 15 §13, thirty days before a sixteenth birthday. The transition to
  // discoverable is gated on this having DELIVERED (doc 14 §B11), so the
  // notice row is created here and the provider receipt fills delivered_at.
  const { rows: turning } = await db.query('select * from fn_children_turning_16()');
  let noticed = 0;
  for (const t of turning as { child_id: string; first_name: string; guardian_email: string }[]) {
    const result = await send(sixteenthBirthdayEmail(t.first_name), { address: t.guardian_email });
    await db.query(
      `insert into age_transition_notice (child_id, outbox_id) values ($1, $2)
       on conflict (child_id) do nothing`,
      [t.child_id, result.queued ? result.id : null],
    );
    noticed++;
  }

  return NextResponse.json({
    ok: true,
    purged: rows[0].purged,
    cancelledRegisters: cancelled[0].n,
    pastTrialRegistrations: pastTrials[0].n,
    lapsedSendRequests: lapsedSends[0].n,
    lapsedInterestRequests: lapsedInterest[0].n,
    abuseSignalsPurged: abuse[0].n,
    birthdayNotices: noticed,
  });
}
