import type { MetadataRoute } from 'next';

// The landing page, the trials index, claimed club pages and coach CVs are
// indexable and should rank. Token-bearing pages are not — and note they are
// NOT disallowed here on purpose: they carry `X-Robots-Tag: noindex` (see
// next.config.mjs), and a crawler must be able to FETCH a page to read that
// header. Disallowing them as well would leave a URL discovered from an
// external link indexable-but-uncrawled, which is weaker, not stronger.
// D-95 names robots-disallow as one of four controls; on this one point the
// four do not compose, and the header is the stronger of the two.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/unsubscribe', '/manage', '/api/'],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://pitchfootball.com.au'}/sitemap.xml`,
  };
}
