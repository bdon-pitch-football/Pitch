// The product front door (D-164 (1)), served AT `/` — never at this path.
//
// `/` is the coming-soon page, and it stays the very same static page, byte
// for byte (render suite fd0), until the launch-day switch is on (0080). Then
// proxy.ts rewrites `/` here. Making `/` itself ask the database would have
// changed today's page: an async page streams its metadata and its body
// differently, which is the thing BUZ said must not move before go-live.
//
// This path is not a second address for the front door: proxy.ts sends a
// direct request for it back to `/`, and the page answers not-found while the
// switch is off in any case. The words go to BUZ before the switch is turned on.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import FrontDoor, { FRONT_DOOR_SEATS, type FrontDoorSeat } from '@/components/front-door/FrontDoor';
import { frontDoorOpen } from '@/lib/front-door';
import PublicAnalytics from '@/components/PublicAnalytics';
import SiteFooter from '@/components/SiteFooter';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'Pitch Football — every season on the record.' },
  description: 'Seasons end. Coaches move. Clubs change. The record should be the thing that stays.',
  alternates: { canonical: '/' },
  openGraph: { url: process.env.NEXT_PUBLIC_SITE_URL || 'https://pitchfootball.com.au' },
};

export default async function FrontDoorPage({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  if (!(await frontDoorOpen())) notFound();
  const seat = (await searchParams).for ?? '';
  // Served at `/`, so it is the front door analytics may count (lib/analytics-scope).
  // Doc 32 B4 and B5 on the busiest page: who we legally are, and Report a page.
  return <><FrontDoor seat={(FRONT_DOOR_SEATS as readonly string[]).includes(seat) ? seat as FrontDoorSeat : null} /><SiteFooter onFrontPage /><PublicAnalytics /></>;
}
