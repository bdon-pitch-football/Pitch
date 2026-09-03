import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://pitchfootball.com.au';
  return [{ url: base, changeFrequency: 'weekly', priority: 1 }];
}
