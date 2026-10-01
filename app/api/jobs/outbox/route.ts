// The outbox sweep — the safety net under the send path, not the send path.
//
// send() writes the row and then dispatches inline, so the ordinary message
// goes out in the same request that created it. This exists for the case that
// ruins a consent flow: the row is written, the instance dies or the provider
// times out, and a parent's approval SMS sits in a table forever with nobody
// looking at it.
//
// Rows are claimed with `for update skip locked`, so two overlapping runs
// cannot send the same message twice — which matters more here than
// throughput, because the duplicate would be a second text to a parent about
// their child.
import { NextResponse } from 'next/server';
import { cronAllowed } from '@/lib/cron-policy';
import { db } from '@/lib/db';
import { dispatch, releaseWaitingTexts } from '@/lib/messaging';
import { SCRUB_SENT_BODIES } from '@/lib/sent-bodies';

export const dynamic = 'force-dynamic';

const BATCH = 50;

export async function GET(request: Request) {
  if (!cronAllowed(request.headers.get('authorization'), process.env.CRON_SECRET,
    process.env.NODE_ENV === 'production')) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Doc 23: the SMS meter holds a number's fingerprint for 24 hours and no
  // longer (John, 2 Oct, §4; 0170). Forgotten past 23 hours on every run, so
  // with an hour between runs none is held past 24. Every environment: it
  // sends nothing, and the meter is written in development too.
  const forgotten = (await db.query('select fn_sms_forget_numbers() as n')).rows[0].n as number;

  // D-168 (0120): then, the parents' approval texts that waited for SMS.
  // Released oldest first, the moment SMS can send, under every control the
  // send path has (lib/messaging releaseWaitingTexts, fn_sms_release). A
  // queued row is never claimed by the sweep below: it has not been metered,
  // and the release is the only door that meters it.
  const released = await releaseWaitingTexts(BATCH);

  // In development nothing leaves the machine (lib/messaging): the outbox is
  // the inbox, and a released text is delivered by being released. The
  // provider calls below run in production only — before this line the sweep
  // ran here too, and a key in a developer's .env.local would have sent a
  // real message from a fixture row.
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.json({ ok: true, forgotten, released: released.length, claimed: 0, sent: 0 });
  }
  let sentReleased = 0;
  for (const r of released) {
    if (await dispatch(r.id, 'sms', r.to_address, '', r.body, r.message_key)) sentReleased += 1;
  }

  // The claim is a WRITE, and that is the whole point. This used to `select
  // ... for update skip locked`, commit, and only then call the provider —
  // which held the row locks for the microseconds between the select and the
  // commit and released them before any work happened. Two overlapping runs
  // would each select the same rows and each send them, and the thing that
  // gets sent twice here is a text to a parent about their child.
  //
  // Stamping attempts and last_attempt_at inside the same statement is what
  // actually claims the row: a concurrent run's own `last_attempt_at` filter
  // then excludes it.
  const { rows } = await db.query(
    `update message_outbox set attempts = attempts + 1, last_attempt_at = now()
     where id in (
       select id from message_outbox
       where sent_at is null and failed_at is null
         -- A text still waiting for SMS (0120) is the release's, never the
         -- sweep's: it has not been metered, and this would send it unmetered.
         and (queued_for_sms_at is null or released_at is not null)
         -- Give the inline attempt a minute to finish before a sweep decides
         -- the row is stranded, or a slow provider gets two sends.
         and created_at < now() - interval '1 minute'
         -- Six tries over a widening window, then it is somebody's problem
         -- to look at rather than something to keep hammering.
         and attempts < 6
         and (last_attempt_at is null or last_attempt_at < now() - interval '5 minutes')
       order by created_at
       limit $1
       for update skip locked
     )
     returning id, message_key, channel, to_address, subject, body`,
    [BATCH],
  );

  let sent = 0;
  for (const r of rows as { id: string; message_key: string; channel: string; to_address: string; subject: string | null; body: string }[]) {
    if (await dispatch(r.id, r.channel, r.to_address, r.subject ?? '', r.body, r.message_key)) sent += 1;
  }
  // A row on its sixth try that failed again is never claimed again, so it is
  // never sent and never closed — and dispatch() clears words only on those
  // two. Nothing will send it, so it keeps no body (safety review S-4, 2 Oct;
  // doc 23). The one statement 0169 ran (lib/sent-bodies), so it also clears
  // anything the old code sent with its words before this deploy (S-5), and
  // every address 30 days after its message ended (John, 2 Oct, §3).
  await db.query(SCRUB_SENT_BODIES);
  // Counts only. This response is read in a Vercel log, and a log is not a
  // place a child's name or a guardian's number ever goes.
  return NextResponse.json({ ok: true, forgotten, released: released.length, claimed: rows.length, sent: sent + sentReleased });
}
