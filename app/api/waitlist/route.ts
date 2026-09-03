import { NextRequest, NextResponse } from 'next/server';
import { insertWaitlist } from '@/lib/waitlist-db';
import { CONSENT_TEXT, POLICY_VERSION, ROLES, EMAIL_RE, type Role } from '@/lib/consent';
import { rateLimited } from '@/lib/ratelimit';

export const runtime = 'nodejs';

// Doc 29 §4:
// - validate server-side, never trust the client
// - store consent_text and policy_version as they were at that moment
// - rate-limit by IP
// - identical response whether or not the address already exists
// - never log the address
// - send no confirmation email
//
// Doc 29 §7: the form does not go public until the privacy policy and terms
// are live. WAITLIST_ENABLED=true is the switch; anything else keeps it shut
// in production. Development stays open so the flow can be exercised.

const OK = NextResponse.json({ ok: true });

export async function POST(req: NextRequest) {
  const enabled =
    process.env.WAITLIST_ENABLED === 'true' || process.env.NODE_ENV !== 'production';
  if (!enabled) {
    return NextResponse.json({ ok: false, reason: 'closed' }, { status: 503 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, reason: 'rate' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid' }, { status: 400 });
  }

  const { email, role } = (body ?? {}) as { email?: unknown; role?: unknown };
  if (
    typeof email !== 'string' ||
    email.length > 254 ||
    !EMAIL_RE.test(email) ||
    typeof role !== 'string' ||
    !ROLES.includes(role as Role)
  ) {
    return NextResponse.json({ ok: false, reason: 'invalid' }, { status: 400 });
  }

  const result = await insertWaitlist({
    email,
    role,
    consent_text: CONSENT_TEXT,
    policy_version: POLICY_VERSION,
    source: 'web',
  });

  switch (result) {
    case 'ok':
    case 'duplicate':
      // Identical body and status either way — "you're already on the list"
      // is an email-enumeration oracle (doc 29 §4).
      return OK;
    case 'unconfigured':
      // Local development without Supabase env: accept without storing so the
      // page can be exercised. In production this is a hard failure.
      if (process.env.NODE_ENV !== 'production') return OK;
      return NextResponse.json({ ok: false, reason: 'unavailable' }, { status: 503 });
    default:
      return NextResponse.json({ ok: false, reason: 'error' }, { status: 500 });
  }
}
