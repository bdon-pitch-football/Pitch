'use client';
// The click-to-play façade (D-97): NOTHING loads from a third party until
// the viewer presses play. YouTube then embeds via youtube-nocookie in a
// sandboxed iframe; other allowed hosts open in a new tab (no referrer —
// the page already sends none, and noreferrer belts it).
import { useState } from 'react';

const T = { surface: '#121b16', line: '#24322a', ink: '#eef5f0', muted: '#7d8f85', accent: '#3ddc84', onAccent: '#06130c' };

function youtubeId(url: string): string | null {
  const m = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,20})/.exec(url);
  return m?.[1] ?? null;
}

export default function ClipCard({ title, sub, url, gradientAlt }: {
  // sub is optional: a stack of cards repeating one subtitle reads as a bug,
  // so callers pass it on the first card and omit it after.
  title: string; sub?: string; url?: string; gradientAlt?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const ytId = url ? youtubeId(url) : null;

  const open = () => {
    if (!url) return;
    if (ytId) setPlaying(true);
    else window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {playing && ytId ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1`}
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="no-referrer"
          allow="autoplay; encrypted-media; picture-in-picture"
          style={{ width: '100%', aspectRatio: '16 / 9', border: 'none', display: 'block' }}
          title={title}
        />
      ) : (
        <button onClick={open} aria-label={url ? `Play ${title}` : title} style={{ all: 'unset', cursor: url ? 'pointer' : 'default', height: 96, background: `linear-gradient(135deg, ${gradientAlt ? '#182018' : '#1a2820'}, #101a14)`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: '100%', boxSizing: 'border-box' }}>
          <span style={{ width: 40, height: 40, borderRadius: 999, background: 'rgba(61,220,132,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={T.onAccent}><path d="M8 5 L19 12 L8 19 Z" /></svg>
          </span>
        </button>
      )}
      <div style={{ padding: '11px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: T.ink }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{sub}</div>}
      </div>
    </div>
  );
}
