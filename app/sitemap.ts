import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';

// The homepage used to be the only entry, which was right when the whole site
// was a waitlist page. Claimed club pages and coach CVs are public, stable and
// meant to be found (D-74, D-100), so they belong here.
//
// Tokenised pages never do, at any age (D-95) — there is no branch below that
// could add one, which is the point of listing only these two tables.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://pitchfootball.com.au';
  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/trials`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/jobs`, changeFrequency: 'daily', priority: 0.6 },
  ];

  try {
    const clubs = await db.query(
      "select public_slug from club where public_slug is not null and club_state = 'claimed'");
    for (const c of clubs.rows) entries.push({ url: `${base}/fc/${c.public_slug}`, changeFrequency: 'weekly', priority: 0.7 });

    // Coaches are adults with a public link they chose to have (D-100).
    const coaches = await db.query('select public_slug from coach_profile cp where public_slug is not null and fn_coach_page_public(cp.id)');
    for (const c of coaches.rows) entries.push({ url: `${base}/c/${c.public_slug}`, changeFrequency: 'weekly', priority: 0.6 });
  } catch {
    // A sitemap is not worth a 500 on a cold database.
  }

  return entries;
}
