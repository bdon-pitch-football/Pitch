'use client';
// Copies a PUBLIC link — a coach's page (D-100: stable, public, copied by the
// coach and pasted wherever they already talk to people). Never a player's
// tokenised link: that one is stored hashed and cannot be shown in full.
// Without JavaScript the link text is still there to select.
import { useState } from 'react';

export default function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn btn-secondary" style={{ width: 'auto', padding: '0 16px', flexShrink: 0 }}
      onClick={async () => {
        try { await navigator.clipboard.writeText(url); setDone(true); window.setTimeout(() => setDone(false), 2200); } catch { /* the text stays selectable */ }
      }}>
      <span aria-live="polite">{done ? 'Copied' : 'Copy'}</span>
    </button>
  );
}
