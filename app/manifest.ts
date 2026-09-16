// The web app manifest (D-52: "installable — manifest + icons + iOS meta").
// It is what lets Chrome and Samsung Internet on Android offer "Install app",
// and it names the app on the home screen of any phone. iOS reads the name
// and colours from here too, but takes its icon from apple-touch-icon and
// only installs through Share → Add to Home Screen (app/layout.tsx).
//
// It opens at /home: installing is something a signed-in member does, and
// /home already sends anyone signed out to sign in. The public marketing
// page is not what you want behind an icon.
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/home',
    name: 'Pitch Football',
    short_name: 'Pitch',
    description: 'Your football, on the record.',
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b120e',
    theme_color: '#0b120e',
    lang: 'en-AU',
    categories: ['sports'],
    icons: [
      { src: '/assets/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/assets/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // The glyph sits inside the centre 80% circle, so a launcher can cut
      // the square to any shape without clipping it.
      { src: '/assets/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
