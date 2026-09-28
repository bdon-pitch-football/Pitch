// DEV ONLY — flips the billing switch (D-163, 0075) for the HTTP suites.
//
// Billing is off at launch and the Stripe build stays behind the switch. The
// render and write suites have to press the billing screens both ways, and
// they cannot touch the database themselves — PGlite serves one connection
// and the app holds it — so the switch is flipped through the app, the same
// way /dev/outbox is read through it.
//
// Gated exactly as /dev/boom and /dev/outbox are: not found in production,
// and not found in a club demo either, where money must never switch on.
// POST only, so no crawl and no link preview can flip it by fetching a page.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isDemo } from '@/lib/demo';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production' || isDemo()) return new NextResponse(null, { status: 404 });
  const on = new URL(request.url).searchParams.get('on') === '1';
  await db.query(`update app_config set value = $1 where key = 'billing_enabled'`, [on ? 'true' : 'false']);
  const { rows } = await db.query('select fn_billing_enabled() as on');
  return NextResponse.json({ billing: rows[0].on === true });
}
