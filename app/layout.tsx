import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '700', '800', '900'],
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pitchfootball.com.au';

// Positioning discipline (D-03): a player development and pathway platform —
// never described as a social network, anywhere, including meta tags.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Every page sets its own title through this template; the default is the
  // fallback for anything that forgets. It used to be the waitlist landing
  // page's title, hardcoded here and inherited by all 51 pages — so a coach's
  // public CV, a club page and the free PDF export all announced themselves
  // as "Coming soon." The landing page now carries that copy itself.
  title: {
    default: 'Pitch Football — every season on the record.',
    template: '%s · Pitch Football',
  },
  description:
    'A goal lasts a second. The run took a season. Pitch keeps a footballer’s development on the record — for players, coaches, clubs and parents. Australia first. Join the waitlist.',
  keywords: ['football', 'soccer', 'player development', 'football CV', 'grassroots football', 'Australia', 'Melbourne'],
  openGraph: {
    title: 'Pitch Football — every season on the record.',
    description:
      'A goal lasts a second. The run took a season. Pitch keeps the record — for players, coaches, clubs and parents. Australia first.',
    siteName: 'Pitch Football',
    images: [{ url: '/assets/film-3.webp', width: 1600, height: 900 }],
    locale: 'en_AU',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/assets/brand/pitch-app-icon.svg', apple: '/assets/brand/app-icon-180.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body className={archivo.className}>
        {children}
        {/* Vercel Web Analytics — cookieless aggregate counts only (doc 29 §9
            allows privacy-respecting aggregates; no third-party tag, served
            same-origin). Inert until enabled on the Vercel dashboard. */}
        <Analytics />
      </body>
    </html>
  );
}
