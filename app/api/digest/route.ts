import { NextRequest, NextResponse } from 'next/server';
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
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && (!secret || auth !== `Bearer ${secret}`)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const counts = await digestCounts(since);
  if (!counts) {
    return NextResponse.json({ ok: false, reason: 'unconfigured' }, { status: 503 });
  }

  // If nothing happened, send nothing (doc 29 §6).
  if (counts.newTotal === 0) {
    return NextResponse.json({ ok: true, sent: false, ...counts });
  }

  const to = process.env.DIGEST_TO || 'burak.donmez@pitch-football.com';
  const from = process.env.EMAIL_FROM || 'Pitch <hello@send.pitchfootball.com.au>';
  const replyTo = process.env.EMAIL_REPLY_TO || 'burak.donmez@pitch-football.com';
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, reason: 'no-resend-key' }, { status: 503 });
  }

  const roleLine = (['player', 'coach', 'club', 'parent'] as const)
    .map((r) => `${r[0].toUpperCase() + r.slice(1)}: ${counts.newByRole[r] ?? 0}`)
    .join(' · ');

  const text = [
    `New signups in the last 24 hours: ${counts.newTotal}`,
    roleLine,
    '',
    `Running total: ${counts.total}`,
    `Unsubscribed: ${counts.unsubscribed}`,
    '',
    'Addresses live in Supabase — no emails in this digest by design.',
  ].join('\n');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      reply_to: replyTo,
      subject: `Pitch waitlist — ${counts.newTotal} new (${counts.total} total)`,
      text,
    }),
  });

  return NextResponse.json({ ok: res.ok, sent: res.ok, newTotal: counts.newTotal });
}
