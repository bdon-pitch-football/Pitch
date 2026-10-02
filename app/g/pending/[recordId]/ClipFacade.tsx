'use client';
// The click-to-play façade for a clip on the parent's review (D-97): a tile
// with a play glyph and the source, and NOTHING from YouTube, Instagram or
// Veo loads until the parent presses it — then the clip opens in a new tab,
// sending no referrer. Never an embed on render (spec D, /g/pending).
import { T } from '@/lib/palette';

export default function ClipFacade({ title, url, source }: { title: string; url: string; source: string }) {
  const open = () => {
    // Only an address the clips page could have accepted (D-97's hosts).
    if (url.startsWith('https:')) window.open(url, '_blank', 'noopener,noreferrer');
  };
  return (
    <button type="button" className="facade" onClick={open} aria-label={`Play ${title}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M8 5.5 L18.5 12 L8 18.5 Z" /></svg>
      <span>{source}</span>
    </button>
  );
}
