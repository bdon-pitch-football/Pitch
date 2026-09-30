// Sign out. A route handler rather than a page because only a handler (or a
// server action) may write cookies, and the cookie IS the session.
//
// This answers GET on purpose. A forged cross-site request can therefore sign
// somebody out — which costs them one sign-in and reveals nothing — and in
// exchange a parent handing the laptop back can reach it by typing the word.
// That trade is only acceptable because signing out destroys no data; nothing
// else in this product answers a state change on GET.
import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

// A prefetch is not a person asking to leave. In production Next prefetches
// the links on a page, and a prefetched /signout revoked the session half a
// second after every sign-in (30 Sep, first night live: every click signed the
// founder out). The links say prefetch={false}; this is the second lock, so no
// future link can do it again. A prefetch gets a harmless 204 and nothing else.
function isPrefetch(request: Request): boolean {
  const h = request.headers;
  return h.has('next-router-prefetch') || h.get('purpose') === 'prefetch'
    || (h.get('sec-purpose') ?? '').includes('prefetch') || h.get('x-middleware-prefetch') === '1';
}

export async function GET(request: Request) {
  if (isPrefetch(request)) return new NextResponse(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  await clearSession();
  return NextResponse.redirect(new URL('/signin?out=1', request.url));
}
