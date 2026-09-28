// The Content-Security-Policy (D-94 §8: "a real Content-Security-Policy — no
// unsafe-inline scripts"), as a decision with no framework around it, so the
// permission suite can ask it for the production policy without building the
// app. Same shape as sms-policy, cron-policy, ops-policy. proxy.ts is the only
// caller; it supplies the nonce and says whether this is `next dev`.
//
// Scripts run only from this site and only with this request's nonce. Next
// reads the nonce from the request's CSP header and puts it on its own
// scripts, so no page has to. 'strict-dynamic' lets a script that already
// carries the nonce load the chunks it needs, and nothing else. Inline STYLE is
// allowed: the design system is written as style attributes, and a style
// cannot run code.
//
// What may load from elsewhere, and why:
//   img-src     the Supabase storage host — profile photos and club crests
//   frame-src   youtube-nocookie.com — a clip embeds only after the viewer
//               presses play (D-97, components/cv/ClipCard.tsx), and only
//               through the privacy host. Instagram and Veo clips are NOT
//               framed: the façade opens them in a new tab with no referrer,
//               so neither host is listed here. A host is added the day the
//               façade frames it, not before.
//   form-action Stripe's hosted Checkout and Portal (D-112). The billing
//               action answers with a redirect to Stripe, and a browser
//               applies form-action to where a form submission lands, so the
//               two hosts are listed here. Stripe is a navigation, never an
//               embed: it appears in no other directive.
// Nothing else. No page may be framed by anyone (frame-ancestors 'none'); the
// X-Frame-Options header in next.config.mjs says the same for older browsers.
//
// Development adds exactly two things `next dev` needs and production must
// never have: eval, which React uses in development to rebuild server error
// stacks in the browser (node_modules/next/dist/docs/01-app/02-guides/
// content-security-policy.md), and the hot-reload websocket. "Development"
// means NODE_ENV === 'development' and nothing else: a test run or an unset
// variable gets the production policy, which is the stricter of the two.

export function contentSecurityPolicy(
  nonce: string,
  opts: { dev: boolean; storageOrigin?: string },
): string {
  const { dev, storageOrigin } = opts;
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${storageOrigin ? ` ${storageOrigin}` : ''}`,
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

/** The storage host's origin, or '' when it is unset or not a URL. */
export function storageOrigin(url: string | undefined): string {
  try { return url ? new URL(url).origin : ''; } catch { return ''; }
}
