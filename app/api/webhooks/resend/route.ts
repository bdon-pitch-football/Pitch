// Resend delivery receipts (D-78).
//
// A send that was accepted by the provider and then bounced, or landed in a
// spam folder, is not the same event as a guardian who read it and did
// nothing — and the consent spine is the one place that difference has to be
// legible. Without receipts every send looks identical forever.
//
// The payload is signed with a Svix-style HMAC. An unsigned or wrongly signed
// body is refused, because this endpoint writes to the spine and anything
// that writes to the spine has to prove who it is.
import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

function verify(payload: string, headers: Headers, secret: string): boolean {
  const id = headers.get('svix-id');
  const ts = headers.get('svix-timestamp');
  const sig = headers.get('svix-signature');
  if (!id || !ts || !sig) return false;

  // Replay window. A receipt older than five minutes is not a receipt.
  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${ts}.${payload}`).digest('base64');
  // The header carries a space-separated list of `v1,<sig>` — any may match.
  return sig.split(' ').some((part) => {
    const value = part.split(',')[1] ?? '';
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export async function POST(request: Request) {
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ ok: false }, { status: 503 });

  const payload = await request.text();
  if (!verify(payload, request.headers, secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let event: { type?: string; data?: { email_id?: string } };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const providerId = event.data?.email_id;
  if (!providerId) return NextResponse.json({ ok: true });

  // Only the outcome is recorded. The reason column never carries message
  // content (0009) and a receipt must not become a second copy of the body.
  switch (event.type) {
    case 'email.delivered':
      await db.query(
        `update message_outbox set delivered_at = now() where provider_id = $1 and delivered_at is null`,
        [providerId],
      );
      break;
    case 'email.bounced':
    case 'email.complained':
      await db.query(
        `update message_outbox set failed_at = now(), failure_reason = $2 where provider_id = $1`,
        [providerId, event.type],
      );
      break;
    default:
      break; // opened/clicked are not tracked: we do not need them (D-99)
  }
  return NextResponse.json({ ok: true });
}
