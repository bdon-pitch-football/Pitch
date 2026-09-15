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
  title: 'Pitch Football | Your football, on one page',
  description:
    'Build your football CV once and send it to any club with a link. Pitch is a player development and pathway platform for players, parents, coaches and clubs. Starting in Australia. Join the waitlist.',
  keywords: ['football', 'soccer', 'player development', 'football CV', 'football trials', 'Australia', 'Melbourne'],
  openGraph: {
    title: 'Pitch Football | Your football, on one page',
    description:
      'Build your football CV once and send it to any club with a link. For players, parents, coaches and clubs. Starting in Australia.',
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
