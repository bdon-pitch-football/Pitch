// Daily job (Vercel cron in production, same guard pattern as the digest):
// runs the D-17 purge. Age bands need no job — they are computed at read
// time; the 30-day birthday notifications join this route with messaging.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { rows } = await db.query('select fn_purge_pending() as purged');
  return NextResponse.json({ ok: true, purged: rows[0].purged });
}
