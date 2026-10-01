'use client';
// The coach's copy-link affordance (D-100, doc 14 L44).
//
// It writes to the clipboard and calls NO endpoint. Pitch never sends a
// coach's link on their behalf and there is no recipient field here, in the
// API, or anywhere else — L45 and L54 are about the absence of exactly this,
// and it would be the easiest thing in the world to add as a convenience.
import { useState } from 'react';

// compact: sits at the end of a link row (the coach's home, 16 Sep) rather
// than filling the width under it.
export default function CopyLink({ url, label, compact = false }: { url: string; label: string; compact?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(url); } catch { /* nothing to fall back to */ }
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
      // The charter secondary (spec C: it was hand-built at the same values).
      className="btn btn-secondary"
      style={compact ? { width: 'auto', padding: '0 16px', flexShrink: 0 } : { flexShrink: 0 }}
    >
      <span aria-live="polite">{done ? 'Copied' : label}</span>
    </button>
  );
}
