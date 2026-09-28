// DEV ONLY — empties the rate limiter's counters, for the timing suite.
//
// Doc 14 E10 samples each dead link a thousand times and more, to see a
// millisecond. The token path's limit (lib/record-read, 300 reads of a link an
// hour) is there to stop exactly that from a stranger, so the suite would
// otherwise be measuring the limit instead of the link after its first few
// hundred rounds. It clears the counters between batches, the way a reseed
// would, and the limit itself is measured in its own row. The suite cannot
// touch the database itself — PGlite serves one connection and the app holds
// it — so it asks the app, as it does for /dev/billing.
//
// Gated exactly as /dev/billing is: not found in production, and not found in
// a club demo. POST only, so no crawl and no link preview can reach it.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isDemo } from '@/lib/demo';

export const dynamic = 'force-dynamic';

export async function POST() {
  if (process.env.NODE_ENV === 'production' || isDemo()) return new NextResponse(null, { status: 404 });
  await db.query('delete from rate_hit');
  return NextResponse.json({ cleared: true });
}
