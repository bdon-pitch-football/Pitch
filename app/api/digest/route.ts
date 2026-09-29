import { NextRequest, NextResponse } from 'next/server';
import { cronAllowed } from '@/lib/cron-policy';
import { db } from '@/lib/db';
import { digestMessage } from '@/lib/digest';
import { digestCounts } from '@/lib/waitlist-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The daily digest (doc 29 §6): one email a day, only when there were signups.
// Counts by role, running total, total unsubscribed. NO email addresses in the
// body — BUZ opens Supabase for that. Daily, not per-signup.
//
// Triggered by Vercel Cron (see vercel.json). Vercel sends its crons with
// an Authorization header when CRON_SECRET is set — required in production.

export async function GET(req: NextRequest) {
  if (!cronAllowed(req.headers.get('authorization'), process.env.CRON_SECRET,
    process.env.NODE_ENV === 'production')) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const counts = await digestCounts(since);
  // D-168 (0120): how many parents' approval texts are still waiting for SMS,
  // so the backlog is watched clearing. Counts only. The words are held until
  // BUZ approves them (lib/digest), so in production this adds nothing yet.
  const queued = (await db.query('select fn_sms_queued_count() as n')).rows[0]?.n ?? 0;
  const showQueued = process.env.NODE_ENV !== 'production';
  if (!counts && !(showQueued && queued > 0)) {
    return NextResponse.json({ ok: false, reason: 'unconfigured' }, { status: 503 });
  }

  // If nothing happened, send nothing (doc 29 §6).
  const message = digestMessage(counts, queued, showQueued);
  if (!message) {
    return NextResponse.json({ ok: true, sent: false, ...(counts ?? {}) });
  }

  // In development nothing leaves the machine (lib/messaging's rule): the
  // digest is composed and answered as JSON, counts only, and not sent.
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.json({ ok: true, sent: false, subject: message.subject, text: message.text });
  }

  const to = process.env.DIGEST_TO || 'burak.donmez@pitch-football.com';
  const from = process.env.EMAIL_FROM || 'Pitch <hello@send.pitchfootball.com.au>';
  const replyTo = process.env.EMAIL_REPLY_TO || 'burak.donmez@pitch-football.com';
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, reason: 'no-resend-key' }, { status: 503 });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      reply_to: replyTo,
      subject: message.subject,
      text: message.text,
    }),
  });

  return NextResponse.json({ ok: res.ok, sent: res.ok, newTotal: counts?.newTotal ?? 0, queued });
}
