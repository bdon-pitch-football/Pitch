// SMS delivery receipts (D-78) — the other half of the sentence.
//
// "Email and SMS provider delivery webhooks write into the same table" is
// D-78's own wording, and the SMS half did not exist. The guardian approval
// SMS is the front door of this product: a child signs up, their parent gets a
// text, and nothing happens until they press it. Without a receipt, a text
// that never arrived and a parent who read it and did nothing are the same
// row, which makes the funnel — "the most important number in the business" —
// unreadable in the one place it matters most.
//
// WHAT IS VERIFIED HERE AND WHAT IS NOT. BUZ has deferred SMS sender
// registration to last, so no live receipt can be driven through this endpoint
// yet. What is proven: the signature scheme (lib/twilio-signature, exercised
// by the permission suite in both directions) and the spine write
// (fn_record_delivery, driven on the database). What is NOT proven is a real
// Twilio request arriving — the payload is Twilio's documented status
// callback, the same API this codebase already posts messages to and already
// receives inbound replies from, and nothing here is invented beyond that.
// The endpoint is deliberately narrow for that reason: two parameters read,
// everything else ignored.
//
// It carries no message content, no number and no child's name — a status and
// a provider id, and the database decides what that means.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyTwilioSignature } from '@/lib/twilio-signature';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const token = process.env.SMS_WEBHOOK_SECRET;
  if (!token) return NextResponse.json({ ok: false }, { status: 503 });

  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = String(v);

  if (!verifyTwilioSignature(request.url, params, request.headers.get('x-twilio-signature'), token)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // MessageSid is what lib/providers stored as provider_id when the message
  // went out; MessageStatus is the carrier's answer. Everything else Twilio
  // sends is ignored on purpose: an endpoint that reads only what it needs
  // cannot be surprised by a field changing shape.
  const sid = params.MessageSid ?? '';
  const status = params.MessageStatus ?? '';
  if (!sid) return NextResponse.json({ ok: true });

  // queued, sending and sent are progress, not outcomes — the row already
  // says it was sent. Only the two terminal answers are receipts.
  if (status === 'delivered') {
    await db.query('select fn_record_delivery($1, $2)', [sid, 'delivered']);
  } else if (status === 'undelivered' || status === 'failed') {
    // The reason is the provider's status word and never the message body
    // (0009). A bounce writes no spine row: D-78's vocabulary has no word for
    // one, and borrowing 'sms_delivered' for a failure would make the log lie.
    await db.query('select fn_record_delivery($1, $2, $3)', [sid, 'failed', status]);
  }
  return NextResponse.json({ ok: true });
}
