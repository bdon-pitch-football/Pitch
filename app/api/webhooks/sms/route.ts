// Inbound SMS — STOP, START and HELP (D-81, doc 15 §15).
//
// The STOP reply was written and there was nothing to receive it: doc 15
// promised "we won't text this number again" and no endpoint existed to hear
// somebody say it. An unsubscribe facility that does not work is not an
// unsubscribe facility, and for commercial SMS in Australia that is a
// compliance problem, not a nicety.
//
// This is also why the sender is a long number rather than an alphanumeric
// sender ID: an alphanumeric sender cannot receive a reply at all.
//
// The reply we send back is itself from the catalogue — a STOP confirmation
// is a message like any other, and doc 15 is closed.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { helpReplySms, stopReplySms } from '@/lib/messages';
import { dispatch, numberHash, sendAndLog } from '@/lib/messaging';
// Twilio signs the URL plus the sorted POST body with the auth token. The
// check lives in lib/twilio-signature because the delivery-status callback
// next door has to make the identical one (0065).
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

  const from = params.From ?? '';
  // Carriers deliver STOP in any case and often with punctuation attached.
  const word = (params.Body ?? '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (!from) return NextResponse.json({ ok: true });

  // Keyed (§5.2, lib/number-hash). With no key there is no way to recognise
  // the number, so the STOP cannot be recorded — and with no key no SMS goes
  // either (lib/messaging). Answered as unavailable, exactly like a missing
  // webhook secret, so Twilio's log shows a failure rather than a success.
  const h = numberHash(from);
  if (!h) return NextResponse.json({ ok: false }, { status: 503 });
  if (['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(word)) {
    await db.query(
      `insert into sms_opt_out (number_hash) values ($1)
       on conflict (number_hash) do update set opted_out_at = now(), opted_in_at = null`,
      [h],
    );
    // The confirmation is the ONE message allowed to a number that has just
    // opted out, so it is sent before the send layer would refuse it.
    await forceReply(from, stopReplySms().key, stopReplySms().body);
  } else if (word === 'START' || word === 'UNSTOP') {
    await db.query(`update sms_opt_out set opted_in_at = now() where number_hash = $1`, [h]);
  } else if (word === 'HELP' || word === 'INFO') {
    await sendAndLog(helpReplySms(), { address: from }, 'sms_sent');
  }
  // Anything else is a human replying to an automated number. There is no
  // inbound route to a family through Pitch, at any tier, for anybody
  // (John, U-11) — so it is not forwarded anywhere. It is simply not read.
  return NextResponse.json({ ok: true });
}

/**
 * The opt-out confirmation, written to the outbox and dispatched directly.
 *
 * It cannot go through send(): that now refuses a number on the STOP list,
 * which is the whole point, and this is the single message the list itself
 * requires us to deliver.
 */
async function forceReply(address: string, key: string, body: string): Promise<void> {
  const { rows } = await db.query(
    `insert into message_outbox (message_key, channel, to_address, body)
     values ($1,'sms',$2,$3) returning id`,
    [key, address, body],
  );
  if (process.env.NODE_ENV === 'production') {
    await dispatch(rows[0].id as string, 'sms', address, '', body);
  }
}
