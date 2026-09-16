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

export function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = policy(nonce);
  const headers = new Headers(req.headers);
  headers.set('content-security-policy', csp);
  const res = NextResponse.next({ request: { headers } });
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
