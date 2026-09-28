// Next 16 renamed middleware.ts to proxy.ts (same job, Node.js runtime).
// The Content-Security-Policy (D-94 §8: "a real Content-Security-Policy — no
// unsafe-inline scripts"). Every other header in that list was already set in
// next.config.mjs; this one was missing, found 16 Sep.
//
// Scripts run only from this site and only with this request's nonce. Next
// reads the nonce from the request's CSP header and puts it on its own
// scripts, so no page has to. Inline STYLE is allowed: the design system is
// written as style attributes, and a style cannot run code.
//
// What may load from elsewhere, and why:
//   img-src    the Supabase storage host — profile photos and club crests
//   frame-src  youtube-nocookie.com — a clip embeds only after the viewer
//              presses play (D-97), and only through the privacy host
//   form-action Stripe's hosted Checkout and Portal (D-112), which a billing
//              action redirects to
// Nothing else. A page may not be framed by anyone (frame-ancestors 'none').
//
// Development adds what `next dev` needs and production must never have:
// eval for fast refresh, and the hot-reload websocket.
import { NextResponse, type NextRequest } from 'next/server';
import { PITCH_METHOD_HEADER } from '@/lib/link-preview';
import { frontDoorOpen } from '@/lib/front-door';

// ---- D-164 (1): the front door, behind the launch-day switch (0080) --------
// `/` is the coming-soon page, a static page this file does not touch while
// the switch is off — so it stays byte for byte what it was (render suite
// fd0). With the switch on, `/` is REWRITTEN to app/front-door: the address
// stays `/`, and nothing else about any other page changes. A direct request
// for /front-door goes back to `/`, so the front door has one address. If the
// switch cannot be read, the answer is the coming-soon page: unapproved words
// never go in front of the public because a query failed.
async function frontDoorFor(req: NextRequest): Promise<URL | 'home' | null> {
  const path = req.nextUrl.pathname;
  if (path === '/front-door') return 'home';
  if (path !== '/') return null;
  let open = false;
  try { open = await frontDoorOpen(); } catch { open = false; }
  if (!open) return null;
  const url = req.nextUrl.clone();
  url.pathname = '/front-door';
  return url;
}
// ---- end D-164 --------------------------------------------------------------

function policy(nonce: string): string {
  const dev = process.env.NODE_ENV !== 'production';
  const storage = (() => {
    try { return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : ''; }
    catch { return ''; }
  })();
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${storage ? ` ${storage}` : ''}`,
    "font-src 'self'",
    `connect-src 'self'${dev ? ' ws: wss:' : ''}`,
    'frame-src https://www.youtube-nocookie.com',
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
    "frame-ancestors 'none'",
  ].join('; ');
}

export async function proxy(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = policy(nonce);
  const headers = new Headers(req.headers);
  headers.set('content-security-policy', csp);
  // A page cannot see the request method, and the approval page must not
  // count a HEAD as a parent opening it (lib/link-preview). Always set, so a
  // caller cannot supply their own.
  headers.set(PITCH_METHOD_HEADER, req.method);
  // D-164 (1) — see frontDoorFor above.
  const door = await frontDoorFor(req);
  if (door === 'home') {
    const home = req.nextUrl.clone();
    home.pathname = '/';
    return NextResponse.redirect(home, 307);
  }
  const res = door ? NextResponse.rewrite(door, { request: { headers } }) : NextResponse.next({ request: { headers } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|assets/|dev-uploads/|preview/).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
