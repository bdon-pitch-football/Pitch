// Daily job (Vercel cron in production, same guard pattern as the digest):
// runs the D-17 purge. Age bands need no job — they are computed at read
// time; the 30-day birthday notifications join this route with messaging.
import { NextResponse } from 'next/server';
import { cronAllowed } from '@/lib/cron-policy';
import { db } from '@/lib/db';
import { linkExpiringToClubsEmail, linkRenewalEmail, pendingNudgeSms, sixteenthBirthdayEmail } from '@/lib/messages';
import { reissueChannelToken } from '@/lib/guardian-flow';
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

  // doc 15 §3, day 10: once. The texted link is re-minted for the reminder
  // (tokens are stored hashed, so the old one cannot be re-sent); a press
  // already made on it still counts (D-156).
  const { rows: nudges } = await db.query('select * from fn_pending_nudges()');
  let nudged = 0;
  for (const n of nudges as { invitation_id: string; first_name: string; guardian_phone: string }[]) {
    const code = await reissueChannelToken(n.invitation_id, 'sms');
    if (!code) continue;
    await send(pendingNudgeSms(n.first_name, code), { address: n.guardian_phone });
    await db.query(
      `insert into consent_event (event, detail) values ('nudge_sent', jsonb_build_object('invitation_id', $1::uuid))`,
      [n.invitation_id],
    );
    nudged++;
  }

  // doc 15 §5 / §23, a week before a guardian-held link expires: once per
  // link, one email per child and day, naming the clubs when any hold it.
  const { rows: expiring } = await db.query('select * from fn_links_to_remind()');
  let reminded = 0;
  for (const x of expiring as { child_id: string; first_name: string; expires_on: string; token_ids: string[]; clubs: string[]; emails: string[] }[]) {
    const msg = x.clubs.length > 0
      ? linkExpiringToClubsEmail(x.first_name, x.expires_on, x.clubs, x.child_id)
      : linkRenewalEmail(x.first_name, x.expires_on, x.child_id);
    for (const address of x.emails) await send(msg, { address });
    await db.query(`update share_token set renewal_reminded_at = now() where id = any($1::uuid[])`, [x.token_ids]);
    reminded++;
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
    approvalNudges: nudged,
    linkReminders: reminded,
  });
}
