// Daily job (Vercel cron in production, same guard pattern as the digest):
// runs the D-17 purge. Age bands need no job — they are computed at read
// time; the 30-day birthday notifications join this route with messaging.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sixteenthBirthdayEmail } from '@/lib/messages';
import { send } from '@/lib/messaging';

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { rows } = await db.query('select fn_purge_pending() as purged');
  // Cancellation + 30 days destroys a club's register (D-135). Suspension
  // never does: a family's child is never deleted because a card expired.
  const { rows: cancelled } = await db.query('select fn_purge_cancelled_registers() as n');

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

  return NextResponse.json({
    ok: true,
    purged: rows[0].purged,
    cancelledRegisters: cancelled[0].n,
    birthdayNotices: noticed,
  });
}
