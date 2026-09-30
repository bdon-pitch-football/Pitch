/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  // A production build and `next dev` must not share a directory. Running
  // `next build` while the dev server is live overwrites its chunks, and the
  // dev server then serves unstyled, 500-ing pages — which looks exactly like
  // a CSS bug and is not one. `npm run build:check` sets NEXT_DIST_DIR so the
  // two never collide.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // No developer badge in front of a club (npm run demo).
  devIndicators: process.env.PITCH_DEMO === '1' ? false : undefined,

  // Development only. By default `next dev` throws a compiled page away after
  // a minute unused, and the test suites walk dozens of pages — so the server
  // spent the whole run recompiling the same routes at 10-20s each, climbed to
  // several GB and 400% CPU, and the suites crawled (16 Sep, three times in a
  // day). Keep compiled pages for an hour. No effect on a production build.
  onDemandEntries: { maxInactiveAge: 60 * 60 * 1000, pagesBufferLength: 200 },

  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      // /unsubscribe and /manage carry a bearer token in the URL — never leak it.
      { source: '/unsubscribe', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] },
      { source: '/manage', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] },
      // Tokenised CV pages: a minor's share token must never reach a third
      // party via the Referer header (D-94 §5), and the pages carry noindex
      // in metadata AND here as a belt (D-95).
      {
        source: '/p/:token*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      // D-172 U4: an unclaimed club page is kept out of search engines by its
      // meta tag AND this header. The header is sent on every club page for
      // now — no club has claimed yet. Before the first club is verified it
      // must follow club_state instead, or a claimed club stays hidden too.
      { source: '/fc/:slug*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
};

export default nextConfig;
