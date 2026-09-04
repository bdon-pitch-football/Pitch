/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
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
    ];
  },
};

export default nextConfig;
