// DEV ONLY — the database's read level for one viewer and one person, for the
// write suite.
//
// Doc 14 H5 and D-171 (0154): while a club is not verified, an authoring coach
// or TD at it keeps no 'authored_only' read. No screen reads 'authored_only'
// until the December assessments, so a suite that presses the operator's real
// call sheet has no page on which the difference between 'authored_only' and
// 'none' shows — and a check that cannot see the difference cannot fail on it
// (L19). The suite cannot ask the database itself (PGlite serves one
// connection and the app holds it), so it asks the app, as it does for
// /dev/billing. It answers fn_read_level and nothing else; it reads no field
// of any record.
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
  const q = new URL(request.url).searchParams;
  const viewer = q.get('viewer') ?? '', person = q.get('person') ?? '';
  if (!isUuid(viewer) || !isUuid(person)) return new NextResponse(null, { status: 400 });
  const { rows } = await db.query('select fn_read_level($1, $2) as level', [viewer, person]);
  return NextResponse.json({ level: rows[0].level });
}
