// The Stripe webhook — the ONLY writer of subscription state (D-112).
// Signature verified before anything is read. Events are recorded by id so a
// replay cannot double-apply. Payment failure SUSPENDS and never deletes
// (D-135): registrations are hidden during dunning and destroyed only on
// cancellation, thirty days later, by the daily job.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

function verify(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  if (!parts.t || !parts.v1) return false;
  const expected = createHmac('sha256', secret).update(`${parts.t}.${payload}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ ok: false }, { status: 503 });

  const payload = await request.text();
  if (!verify(payload, request.headers.get('stripe-signature'), secret)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const event = JSON.parse(payload) as { id: string; type: string; created?: number; data: { object: Record<string, unknown> } };

  // Idempotency: a replayed event is acknowledged and ignored.
  const seen = await db.query('select 1 from stripe_event where id = $1', [event.id]);
  if (seen.rows.length > 0) return NextResponse.json({ ok: true, duplicate: true });
  await db.query('insert into stripe_event (id, kind) values ($1,$2)', [event.id, event.type]);

  const obj = event.data.object;
  const meta = (obj.metadata ?? {}) as Record<string, string>;
  const clubId = meta.club_id;
  if (!clubId) return NextResponse.json({ ok: true, ignored: true });

  const periodEnd = typeof obj.current_period_end === 'number'
    ? new Date(obj.current_period_end * 1000).toISOString() : null;
  const customer = typeof obj.customer === 'string' ? obj.customer : null;
  // Stripe does not guarantee ordering. The event's own timestamp goes to
  // the function, which ignores anything older than the last one applied to
  // this club — otherwise a late "active" resurrects a cancelled register.
  const eventAt = typeof event.created === 'number' ? new Date(event.created * 1000).toISOString() : null;
  const apply = (status: string, grace: string | null) =>
    db.query('select fn_apply_subscription($1,$2,$3,$4::timestamptz,$5::timestamptz,$6,$7::timestamptz)',
      [clubId, status, null, periodEnd, grace, customer, eventAt]);
  const graceWindow = () => new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();

  switch (event.type) {
    case 'checkout.session.completed':
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const status = String(obj.status ?? 'active');
      // Fourteen days of grace before the register is suspended (D-135).
      await apply(status, status === 'past_due' ? graceWindow() : null);
      break;
    }
    case 'invoice.payment_failed':
      await apply('past_due', graceWindow());
      break;
    case 'customer.subscription.deleted':
      // Suspends. Nothing is deleted here — the 30-day job does that, and
      // only on cancellation.
      await apply('canceled', null);
      break;
    default:
      return NextResponse.json({ ok: true, ignored: true });
  }
  return NextResponse.json({ ok: true });
}
