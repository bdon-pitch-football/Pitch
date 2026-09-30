// Next 16 renamed middleware.ts to proxy.ts (same job, Node.js runtime).
// The Content-Security-Policy (D-94 §8: "a real Content-Security-Policy — no
// unsafe-inline scripts"). Every other header in that list was already set in
// next.config.mjs; this one was missing, found 16 Sep.
//
// The policy itself, and why each host is in it, is lib/csp.ts — a plain
// function, so the permission suite can read the production policy without a
// build. This file mints the nonce and hands the header to Next and to the
// browser, and stamps the request method for lib/link-preview. Next reads the
// nonce from the REQUEST's header and stamps it on its own scripts while
// rendering, which is why every page renders per request (app/layout.tsx
// calls connection()).
import { NextResponse, type NextRequest } from 'next/server';
import { contentSecurityPolicy, storageOrigin } from './lib/csp';
import { PITCH_METHOD_HEADER } from '@/lib/link-preview';
import { frontDoorOpen } from '@/lib/front-door';
import { clubPageNoindex } from '@/lib/club-robots';

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

// ---- D-172 U4: the club page's X-Robots-Tag follows club_state -------------
// Was a blanket header in next.config.mjs on every /fc page, which would have
// kept a claimed club out of search too. The page's own meta tag reads the
// same column (lib/club-robots). Anything under /fc that is not one slug is a
// 404, and is answered noindex like any slug the database does not know.
async function clubPageRobots(path: string): Promise<string | null> {
  if (!path.startsWith('/fc/')) return null;
  const m = /^\/fc\/([^/]+)\/?$/.exec(path);
  let slug: string | null = null;
  try { slug = m ? decodeURIComponent(m[1]) : null; } catch { slug = null; }
  if (slug && !(await clubPageNoindex(slug))) return null;
  return 'noindex, nofollow';
}
// ---- end D-172 U4 -----------------------------------------------------------

export async function proxy(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce, {
    dev: process.env.NODE_ENV === 'development',
    storageOrigin: storageOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL),
  });
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
  // D-172 U4 — see clubPageRobots above.
  const robots = await clubPageRobots(req.nextUrl.pathname);
  if (robots) res.headers.set('X-Robots-Tag', robots);
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
