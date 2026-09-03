import type { ReactNode } from 'react';

// Shared dark shell for the small utility pages (/unsubscribe, /manage,
// /privacy, /terms) — Night Match tones, reading-column width.

export function QuietShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div style={{ minHeight: '100vh', background: '#070b09', color: '#eef5f0', display: 'flex', justifyContent: 'center', padding: '64px 24px' }}>
      <div style={{ width: '100%', maxWidth: wide ? 640 : 460, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {children}
      </div>
    </div>
  );
}

export function PitchWordmark() {
  return (
    <a href="/" style={{ display: 'inline-flex', alignItems: 'center', fontWeight: 900, fontSize: 22, letterSpacing: '-.035em', color: '#eef5f0', lineHeight: 1, textDecoration: 'none', marginBottom: 8 }}>
      P
      <svg viewBox="0 0 74 97" style={{ height: '.715em', width: 'auto', margin: '0 -.085em', display: 'block' }} fill="none">
        <line x1="37" y1="6.5" x2="37" y2="90.5" stroke="#3ddc84" strokeWidth="13" strokeLinecap="round" />
        <circle cx="37" cy="48.5" r="32" fill="none" stroke="#3ddc84" strokeWidth="10" />
      </svg>
      TCH
    </a>
  );
}
