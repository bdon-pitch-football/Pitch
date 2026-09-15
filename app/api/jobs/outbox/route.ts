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
import { dispatch } from '@/lib/messaging';

export const dynamic = 'force-dynamic';

const BATCH = 50;

export async function GET(request: Request) {
  if (!cronAllowed(request.headers.get('authorization'), process.env.CRON_SECRET,
    process.env.NODE_ENV === 'production')) {
    return NextResponse.json({ ok: false }, { status: 401 });
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
  // Counts only. This response is read in a Vercel log, and a log is not a
  // place a child's name or a guardian's number ever goes.
  return NextResponse.json({ ok: true, claimed: rows.length, sent });
}
