// DEV ONLY — the clock passes a seeded child's sixteenth birthday, for the
// write suite (John, 3 Oct, N-5: n5-1 "the clock passes the 16th birthday
// (Melbourne midnight) with the job not run").
//
// The suite cannot move the clock, and it cannot reach the database itself —
// PGlite serves one connection and the app holds it — so it asks the app, as
// it does for /dev/billing. One child, named by id: their date of birth
// becomes sixteen years before today in Melbourne (G9), and their record is
// dated a year back, as a page kept since they were fifteen would be. It runs
// no job and touches nothing else, so what every surface serves afterwards is
// the read path's answer alone (G7).
//
// Gated exactly as /dev/billing is: not found in production, and not found in
// a club demo. POST only, so no crawl and no link preview can reach it.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isDemo } from '@/lib/demo';
import { isUuid } from '@/lib/ids';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production' || isDemo()) return new NextResponse(null, { status: 404 });
  const child = new URL(request.url).searchParams.get('child') ?? '';
  if (!isUuid(child)) return new NextResponse(null, { status: 400 });
  await db.query(
    `update person set dob = ((now() at time zone 'Australia/Melbourne')::date - interval '16 years')::date where id = $1`,
    [child],
  );
  await db.query(`update development_record set created_at = now() - interval '1 year' where person_id = $1`, [child]);
  const { rows } = await db.query(`select fn_age_band(dob) as band from person where id = $1`, [child]);
  return NextResponse.json(rows[0] ?? null);
}
