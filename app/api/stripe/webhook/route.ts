// The Stripe webhook — the ONLY writer of subscription state (D-112).
// Signature verified before anything is read. Events are recorded by id so a
// replay cannot double-apply. Payment failure SUSPENDS and never deletes
// (D-135): registrations are hidden during dunning and destroyed only on
// cancellation, thirty days later, by the daily job.
//
// It is also the only place a charge becomes a receipt (D-136). Two things
// were missing here on 28 Sep and both of them only fail on the day money is
// switched on, which is the worst day to find them:
//
//  · invoice.payment_succeeded was not handled at all, and no branch called
//    any message builder — so doc 15 §31 and §32 were written, approved and
//    wired to nothing. D-136 requires a receipt on every charge and a named
//    statement descriptor, because a treasurer who cannot place a line on a
//    bank statement rings their bank, and a chargeback costs more than the
//    subscription.
//  · an invoice event could never resolve a club. Stripe does not copy a
//    subscription's metadata onto the invoice's own `metadata` — it arrives
//    under `subscription_details` — so `meta.club_id` was empty on every
//    invoice event and the dunning branch (D-135) returned "ignored". The club
//    is now resolved from the payload where it is, and from our own
//    stripe_customer_id where it is not.
//
// The receipt goes to the CLUB's own address and nowhere else (D-137, doc 14
// O2), and it carries no child data of any kind (doc 14 O10).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paymentFailedEmail, paymentTakenEmail } from '@/lib/messages';
import { send } from '@/lib/messaging';
import { clubIdFromEvent, invoiceFacts, melbourneDay, receiptFields } from '@/lib/receipts';
import { billingEnabled } from '@/lib/billing';

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

/** The club, for the receipt. Name, plan and its own mailbox — nothing else. */
async function billingClub(clubId: string) {
  const { rows } = await db.query(
    'select name, plan, contact_email from club where id = $1', [clubId]);
  if (rows.length === 0) return null;
  return { name: rows[0].name as string, plan: rows[0].plan as string | null, contactEmail: rows[0].contact_email as string | null };
}

export async function POST(request: Request) {
  // D-163: free at launch. While billing is off (0075) nothing here runs —
  // no event is recorded, no subscription state is written, and doc 15 §31
  // and §32 never send. It answers exactly as an unconfigured webhook does,
  // before the payload is read.
  if (!(await billingEnabled())) return NextResponse.json({ ok: false }, { status: 503 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ ok: false }, { status: 503 });

  const payload = await request.text();
  if (!verify(payload, request.headers.get('stripe-signature'), secret)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const event = JSON.parse(payload) as { id: string; type: string; created?: number; data: { object: Record<string, unknown> } };

  // Idempotency: a replayed event is acknowledged and ignored. This also keeps
  // the receipt to one per charge — a replay sends no second tax invoice.
  const seen = await db.query('select 1 from stripe_event where id = $1', [event.id]);
  if (seen.rows.length > 0) return NextResponse.json({ ok: true, duplicate: true });
  await db.query('insert into stripe_event (id, kind) values ($1,$2)', [event.id, event.type]);

  const obj = event.data.object;
  const customer = typeof obj.customer === 'string' ? obj.customer : null;
  // Where the club id actually lives, per event kind (lib/receipts), and our
  // own customer id as the fallback. Reading it from our own row is not a
  // second writer of anything: it only answers "whose club is this".
  const clubId = clubIdFromEvent(obj)
    ?? (customer
      ? ((await db.query('select id from club where stripe_customer_id = $1', [customer])).rows[0]?.id as string | undefined) ?? null
      : null);
  if (!clubId) return NextResponse.json({ ok: true, ignored: true });

  const periodEnd = typeof obj.current_period_end === 'number'
    ? new Date(obj.current_period_end * 1000).toISOString() : null;
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
      // The window offered here only starts a grace when none is running:
      // fn_apply_subscription keeps the first failure's date through every
      // later past_due event, and only a payment clears it (0068). Stripe
      // sends this event on every retry, so it used to restart the fortnight.
      await apply(status, status === 'past_due' ? graceWindow() : null);
      break;
    }
    case 'invoice.payment_succeeded': {
      // A receipt, and NOTHING ELSE. Subscription state is written by the
      // subscription events above, which Stripe emits alongside this one; a
      // second branch writing status here would be a second answer racing the
      // first, and the ordering guard in 0032 protects the club row from a
      // stale event, not from us applying the same fact twice from two places.
      // The brief's §0 is explicit: the flag is written only by webhook — and
      // it is worth exactly as much when only one branch of the webhook writes
      // it.
      const facts = invoiceFacts(obj);
      const club = await billingClub(clubId);
      if (!facts || !club) break;
      const paidAt = eventAt ? new Date(eventAt) : new Date();
      const receipt = receiptFields(club, facts, paidAt);
      // No club mailbox, no receipt. We never fall back to whoever's card it
      // was (D-137, doc 14 O2).
      if (!receipt) break;
      await send(paymentTakenEmail(receipt.receipt), { address: receipt.to });
      break;
    }
    case 'invoice.payment_failed': {
      // Stripe retries a failed card several times over the fortnight and
      // sends this event on EVERY attempt. Two things follow, and both were
      // wrong when this branch first became reachable (28 Sep):
      //
      //  · The grace is fourteen days from the FIRST failure (D-135, doc 14
      //    O4). fn_apply_subscription keeps a grace already running whatever
      //    it is handed (0068); this branch still reads it first, because
      //    whether one was running is what decides the email below.
      //  · doc 15 §32 is one email, not one per retry — and the date in it is
      //    the date the database will actually act on.
      const { rows: [before] } = await db.query(
        'select subscription_status, grace_until from club where id = $1', [clubId]);
      const already = before?.subscription_status === 'past_due' && before?.grace_until != null;
      const grace = already ? new Date(before.grace_until).toISOString() : graceWindow();
      await apply('past_due', grace);
      // doc 15 §32 — D-135 in message form: nothing has changed yet, nothing
      // is deleted, and the register pauses at the end of the fortnight. It
      // goes to the club's own address; no message goes to any family, ever,
      // about a club's failed payment.
      if (!already) {
        const club = await billingClub(clubId);
        if (club?.contactEmail) {
          const attemptedAt = eventAt ? new Date(eventAt) : new Date();
          await send(paymentFailedEmail(club.name, melbourneDay(attemptedAt), melbourneDay(new Date(grace))),
            { address: club.contactEmail });
        }
      }
      break;
    }
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
