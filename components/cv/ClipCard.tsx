'use client';
// The click-to-play façade (D-97): NOTHING loads from a third party until
// the viewer presses play. YouTube then embeds via youtube-nocookie in a
// sandboxed iframe that tells YouTube only which site it is on (see the
// iframe); other allowed hosts open in a new tab (no referrer — the page
// already sends none, and noreferrer belts it).
import { useId, useState } from 'react';
import { T } from '@/lib/palette';
import { youtubeId } from '@/lib/youtube-id';

export default function ClipCard({ title, sub, url, gradientAlt }: {
  // sub is optional: a stack of cards repeating one subtitle reads as a bug,
  // so callers pass it on the first card and omit it after.
  title: string; sub?: string; url?: string; gradientAlt?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const subId = useId();
  const ytId = url ? youtubeId(url) : null;

  const open = () => {
    if (!url) return;
    if (ytId) setPlaying(true);
    else window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Floodlit (D-173): a poster, not a grey slot — pitch markings, a big play
  // button and the title on the picture. Still a façade: nothing here loads
  // from a third party, and there is no thumbnail to fetch (D-97).
  const caption = (
    <>
      {/* spans, not divs: the caption sits inside a <button> on the poster */}
      <span style={{ display: 'block', fontSize: 16, fontWeight: 900, letterSpacing: '-0.015em', lineHeight: 1.2, color: T.ink }}>{title}</span>
      {sub && <span id={subId} style={{ display: 'block', fontSize: 12.5, color: T.secondary, fontWeight: 500, marginTop: 3 }}>{sub}</span>}
    </>
  );
  return (
    <div className="fl-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {playing && ytId ? (
        <>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1`}
            sandbox="allow-scripts allow-same-origin allow-presentation"
            // YouTube refuses an embed that names no site (its "Error 153",
            // since late 2025), so the player alone is sent this site's
            // ORIGIN — https://pitchfootball.com.au, never the page's path,
            // so a share token in a CV's address cannot travel. Every other
            // request from the page stays no-referrer (next.config.mjs).
            referrerPolicy="strict-origin"
            allow="autoplay; encrypted-media; picture-in-picture"
            style={{ width: '100%', aspectRatio: '16 / 9', border: 'none', display: 'block' }}
            title={title}
          />
          <div style={{ padding: '12px 16px 14px 16px' }}>{caption}</div>
        </>
      ) : (
        <button onClick={open} aria-label={url ? `Play ${title}` : title} aria-describedby={sub ? subId : undefined} style={{ all: 'unset', cursor: url ? 'pointer' : 'default', position: 'relative', display: 'block', width: '100%', aspectRatio: '16 / 10', minHeight: 210, boxSizing: 'border-box',
          background: `radial-gradient(80% 90% at ${gradientAlt ? '30%' : '70%'} 0%, rgba(42,106,73,.75), transparent 70%), linear-gradient(160deg, #18251e, #0c140f)` }}>
          <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="1.5" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <rect x="-5" y="20" width="330" height="200" /><line x1="160" y1="20" x2="160" y2="220" /><circle cx="160" cy="120" r="42" />
          </svg>
          <span style={{ position: 'absolute', left: 18, top: 18, width: 52, height: 52, borderRadius: 999, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-accent)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={T.onAccent} aria-hidden><path d="M8 5 L19 12 L8 19 Z" /></svg>
          </span>
          <span style={{ position: 'absolute', left: 18, right: 18, bottom: 16, top: 84, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', lineHeight: 1.35 }}>{caption}</span>
        </button>
      )}
    </div>
  );
}
