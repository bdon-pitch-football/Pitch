import type { MetadataRoute } from 'next';

// This page is indexed and should rank — it is the only Pitch page that
// should be (doc 29 §7, D-95). The token-bearing utility pages are not.
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
