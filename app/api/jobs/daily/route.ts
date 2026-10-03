// Daily job (Vercel cron in production, same guard pattern as the digest):
// runs the D-17 purge. Age bands need no job — they are computed at read
// time; the 30-day birthday notifications join this route with messaging.
import { NextResponse } from 'next/server';
import { cronAllowed } from '@/lib/cron-policy';
import { forgetPlayerPhoto } from '@/lib/cv-build';
import { db } from '@/lib/db';
import { isHeld, linkExpiringToClubsEmail, linkRenewalEmail, pendingNudgeSms, sixteenthBirthdayEmail } from '@/lib/messages';
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
  // BUZ, 23 Sep: a squad invitation nobody answered and one answered no both
  // lapse thirty days after the ask, so a club's screen can never be read as
  // an answer (D-138). Nothing is deleted; the row stops being live.
  const { rows: lapsedSquad } = await db.query('select fn_lapse_squad_invitations() as n');
  // U-4 (John): the operational abuse counter is ninety days, and it lives
  // nowhere near a child's record.
  const { rows: abuse } = await db.query('select fn_purge_abuse_signals() as n');
  // Sessions that expired or were revoked more than thirty days ago (0069,
  // D-25). A session row answers nothing once it is dead, and nothing deleted
  // one before this. This is allowed where deleting from the consent log is
  // not: a session row is operational state, not the append-only record of
  // what a family agreed to, and consent_event is untouched here.
  const { rows: sessions } = await db.query('select fn_purge_sessions() as n');
  // doc 14 F8: a guardian reading the consent log sees "every approval,
  // revocation, share, outside-contact attempt and age transition". Bands are
  // computed and never stored (D-49), so a birthday is not an event anything
  // was recording — the guardian's screen had a line for it that nothing could
  // ever write. This appends one row per band a person reaches. It looks back
  // seven days so a missed morning is caught up, and the band is the
  // idempotency key, so nothing is ever written twice (0065).
  const { rows: bands } = await db.query('select fn_record_age_transitions() as n');
  // A birthday publishes nothing (John, 3 Oct, N-5 (A); doc 14 R11). The
  // waiting version left from under 16 can never be approved after the
  // birthday (R13), so it is deleted, with one content-free event on the
  // child (fn_clear_waiting_at_16, 0174). It never publishes: until the
  // player's own first write at 16 or over, every surface serves the last
  // version a guardian approved, and the read path holds that whether or not
  // this ran (G7). The photo a deleted version named goes only if nothing
  // still shows it — never the one the live record names (S-3).
  // N3 (0177): one failure never stops the rest of the job. The function
  // already goes on past a record that fails; this carries the job past the
  // step itself, and past one photo that will not go. Logged without an id.
  let cleared: { record_id: string; photo: string | null }[] = [];
  try {
    cleared = (await db.query('select record_id, photo from fn_clear_waiting_at_16()')).rows;
  } catch {
    console.error('daily: the birthday clear did not run; the rest of the job goes on');
  }
  for (const c of cleared) {
    try { await forgetPlayerPhoto(c.record_id, c.photo); } catch { console.error('daily: one photo from the birthday clear was not removed; the rest go on'); }
  }

  // doc 15 §13, thirty days before a sixteenth birthday. The transition to
  // discoverable is gated on this having DELIVERED (doc 14 §B11), so the
  // notice row is created here and the provider receipt fills delivered_at.
  //
  // HELD (BUZ decision 3, 23 Sep). The gate stays here, visible and whole:
  // while §13 is held no notice row is written, nothing delivers, and
  // fn_searchable (0013) therefore keeps every 16–17 out of every search —
  // which is the restrictive half of B11 and the right answer while the
  // parent's switch does not exist. Writing a row with no send would be the
  // dangerous shortcut: fn_children_turning_16() skips a child who already
  // has one, so the day this sends again those children would be skipped
  // forever. lib/messages HELD_KEYS lists what has to exist before it sends,
  // and lib/messaging refuses the send even if this block is reached.
  const held = isHeld('doc15.§13');
  let noticed = 0;
  if (!held) {
    const { rows: turning } = await db.query('select * from fn_children_turning_16()');
    for (const t of turning as { child_id: string; first_name: string; guardian_email: string }[]) {
      const result = await send(sixteenthBirthdayEmail(t.first_name), { address: t.guardian_email });
      await db.query(
        `insert into age_transition_notice (child_id, outbox_id) values ($1, $2)
         on conflict (child_id) do nothing`,
        [t.child_id, result.queued ? result.id : null],
      );
      noticed++;
    }
  }

  // doc 15 §3, day 10: once. The texted link is re-minted for the reminder
  // (tokens are stored hashed, so the old one cannot be re-sent); a press
  // already made on it still counts (D-156).
  const { rows: nudges } = await db.query('select * from fn_pending_nudges()');
  let nudged = 0;
  for (const n of nudges as { invitation_id: string; first_name: string; guardian_phone: string }[]) {
    const code = await reissueChannelToken(n.invitation_id, 'sms');
    if (!code) continue;
    await send(pendingNudgeSms(n.first_name, code), { address: n.guardian_phone, invitationId: n.invitation_id });
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
    lapsedSquadInvitations: lapsedSquad[0].n,
    abuseSignalsPurged: abuse[0].n,
    sessionsPurged: sessions[0].n,
    ageTransitionsLogged: bands[0].n,
    waitingVersionsClearedAt16: cleared.length,
    birthdayNotices: noticed,
    // Says so out loud, so a run that sends nothing is not read as a run that
    // found nobody (doc 14 §B11 depends on the difference).
    birthdayNoticesHeld: held,
    approvalNudges: nudged,
    linkReminders: reminded,
  });
}
