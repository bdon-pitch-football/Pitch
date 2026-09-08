'use client';
// The coach's copy-link affordance (D-100, doc 14 L44).
//
// It writes to the clipboard and calls NO endpoint. Pitch never sends a
// coach's link on their behalf and there is no recipient field here, in the
// API, or anywhere else — L45 and L54 are about the absence of exactly this,
// and it would be the easiest thing in the world to add as a convenience.
import { useState } from 'react';

export default function CopyLink({ url, label }: { url: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(url); } catch { /* nothing to fall back to */ }
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
      style={{
        background: '#1a2420', border: '1px solid #24322a', color: '#eef5f0',
        borderRadius: 14, height: 46, fontSize: 14, fontWeight: 700,
        cursor: 'pointer', fontFamily: 'inherit', width: '100%',
      }}
    >
      {done ? 'Copied' : label}
    </button>
  );
}
