import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';
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
  title: 'Pitch Football — every season on the record. Coming soon.',
  description:
    'A goal lasts a second. The run took a season. Pitch keeps a footballer’s development on the record — for players, coaches, clubs and parents. Australia first, Melbourne first. Join the waitlist.',
  keywords: ['football', 'soccer', 'player development', 'football CV', 'grassroots football', 'Australia', 'Melbourne'],
  openGraph: {
    title: 'Pitch Football — every season on the record.',
    description:
      'A goal lasts a second. The run took a season. Pitch keeps the record — for players, coaches, clubs and parents. Australia first.',
    url: SITE_URL,
    siteName: 'Pitch Football',
    images: [{ url: '/assets/film-3.webp', width: 1600, height: 900 }],
    locale: 'en_AU',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/assets/brand/pitch-app-icon.svg', apple: '/assets/brand/app-icon-180.png' },
  alternates: { canonical: '/' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body className={archivo.className}>{children}</body>
    </html>
  );
}
