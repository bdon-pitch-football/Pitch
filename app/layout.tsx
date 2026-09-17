import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { connection } from 'next/server';
import './globals.css';
import SiteFooter from '@/components/SiteFooter';

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
  // apple-touch-icon is square and fully green: iOS draws its own rounded
  // corners and fills any transparency with black.
  icons: { icon: '/assets/brand/pitch-app-icon.svg', apple: '/assets/brand/apple-touch-icon.png' },
  // iOS home screen (D-52): opens without Safari's bars, named "Pitch",
  // status bar over the dark page. Android reads app/manifest.ts.
  appleWebApp: { capable: true, title: 'Pitch', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#0b120e',
  colorScheme: 'dark',
  // black-translucent puts the page under the status bar and the home
  // indicator; the frame pads itself with the safe-area insets.
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Every page renders per request, because the Content-Security-Policy
  // (proxy.ts) carries a fresh nonce each time and Next stamps it on its
  // scripts while rendering. A page built ahead of time would ship scripts
  // with no nonce, and the browser would refuse to run them.
  await connection();
  return (
    // data-scroll-behavior: globals.css sets smooth scrolling for in-page
    // anchors. Next 16 stopped switching it off during a page change, so this
    // asks it to, and moving between pages stays instant.
    <html lang="en-AU" data-scroll-behavior="smooth">
      <body className={archivo.className}>
        {children}
        <SiteFooter />
        {/* Vercel Web Analytics — cookieless aggregate counts only (doc 29 §9
            allows privacy-respecting aggregates; no third-party tag, served
            same-origin). Inert until enabled on the Vercel dashboard. */}
        <Analytics />
      </body>
    </html>
  );
}
