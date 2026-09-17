// A NON-LIVE preview of the restructured pre-registration site (BUZ, 15 Sep:
// "show me a restructured non live version… don't deploy it yet"). Linked
// from nowhere, noindex, and not the page at "/". The live site stays
// components/coming-soon until BUZ approves this one.
//
// The hero carries the REAL public player page — the PlayerCV component the
// product serves, rendered from a fictional adult fixture — rather than a
// drawing of one. Every other screen is a capture of the dev app at device
// size, signed in as the fictional seats (public/preview/).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PlayerCV from '@/components/cv/PlayerCV';
import { JORDAN } from '@/lib/fixtures';
import SitePreview from '@/components/site-preview/SitePreview';

export const metadata: Metadata = {
  title: { absolute: 'Pitch Football — your football, on one page (preview)' },
  robots: { index: false, follow: false },
};

export default function PreviewSite() {
  // The live site is on main now (16 Sep); this mock-up never ships.
  if (process.env.NODE_ENV === 'production') notFound();
  // The fixture carries no band (it is derived from DOB at read time in the
  // product), and PlayerCV falls back to the minor treatment when the band is
  // absent — which put a "Parent-approved" chip on a 22-year-old. Stated here.
  return <SitePreview liveCv={<PlayerCV p={{ ...JORDAN, band: '18plus' }} />} />;
}
