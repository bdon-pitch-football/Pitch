import type { Metadata } from 'next';
import ComingSoon from '@/components/coming-soon/ComingSoon';
import PublicAnalytics from '@/components/PublicAnalytics';

// The waitlist copy lives here, on the one page it describes, rather than at
// the root where every other page inherited it.
export const metadata: Metadata = {
  title: { absolute: 'Pitch Football — every season on the record. Coming soon.' },
  alternates: { canonical: '/' },
  openGraph: { url: process.env.NEXT_PUBLIC_SITE_URL || 'https://pitchfootball.com.au' },
};

// One of the four pages analytics may count (lib/analytics-scope).
export default function Home() {
  return <><ComingSoon /><PublicAnalytics /></>;
}
