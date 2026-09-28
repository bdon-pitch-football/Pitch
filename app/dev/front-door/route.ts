// DEV ONLY — flips the front-door switch (D-164, 0080) for the HTTP suites.
//
// The render suite has to read `/` both ways — the coming-soon page byte for
// byte with the switch off, and every link of the front door with it on — and
// it cannot touch the database itself (PGlite serves one connection and the
// app holds it). So the switch is flipped through the app, exactly as
// /dev/billing flips billing.
//
// Gated as /dev/billing is: not found in production and not found in a club
// demo. POST only, so no crawl and no link preview can flip it.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isDemo } from '@/lib/demo';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production' || isDemo()) return new NextResponse(null, { status: 404 });
  const on = new URL(request.url).searchParams.get('on') === '1';
  await db.query(`update app_config set value = $1 where key = 'front_door_open'`, [on ? 'true' : 'false']);
  const { rows } = await db.query('select fn_front_door_open() as open');
  return NextResponse.json({ frontDoor: rows[0].open === true });
}
