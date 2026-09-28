// Next 16 renamed middleware.ts to proxy.ts (same job, Node.js runtime).
// The Content-Security-Policy (D-94 §8: "a real Content-Security-Policy — no
// unsafe-inline scripts"). Every other header in that list was already set in
// next.config.mjs; this one was missing, found 16 Sep.
//
// The policy itself, and why each host is in it, is lib/csp.ts — a plain
// function, so the permission suite can read the production policy without a
// build. This file only mints the nonce and hands the header to Next and to
// the browser. Next reads the nonce from the REQUEST's header and stamps it on
// its own scripts while rendering, which is why every page renders per
// request (app/layout.tsx calls connection()).
import { NextResponse, type NextRequest } from 'next/server';
import { contentSecurityPolicy, storageOrigin } from './lib/csp';

export function proxy(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce, {
    dev: process.env.NODE_ENV === 'development',
    storageOrigin: storageOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL),
  });
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
