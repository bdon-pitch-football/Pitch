'use client';
// The 500 for a failure in the root layout itself, which app/error.tsx cannot
// catch. It REPLACES the root layout, so it must carry its own <html> and
// <body> — and it gets none of globals.css, no Archivo, no site footer, no
// custom properties. Every colour here is therefore a literal from
// lib/palette (the one copy of the Night Match values, so palette-check still
// sees them) rather than a var(--token) that would resolve to nothing.
//
// Same rule as app/error.tsx: it renders nothing about the error.
import { FAILURE_COPY } from '@/components/FailureState';
import { T } from '@/lib/palette';

const c = FAILURE_COPY.error;

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en-AU">
      <body style={{ margin: 0, background: T.bg, color: T.ink, fontFamily: 'system-ui, sans-serif' }}>
        <title>{c.title}</title>
        <div data-failure="error" style={{ minHeight: '100dvh', display: 'flex', justifyContent: 'center', background: T.bg }}>
          <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
            {/* The mark, top right, with no chrome to hang it on (BUZ, 24 Aug:
                no exceptions). Drawn here rather than imported, because this
                document has no stylesheet to lean on. */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', fontWeight: 900, fontSize: 20, letterSpacing: '-.035em', color: T.ink, lineHeight: 1 }}>
                P
                <svg viewBox="0 0 74 97" style={{ height: '.715em', width: 'auto', margin: '0 -.085em', display: 'block' }} fill="none">
                  <line x1="37" y1="6.5" x2="37" y2="90.5" stroke={T.accent} strokeWidth="13" strokeLinecap="round" />
                  <circle cx="37" cy="48.5" r="32" fill="none" stroke={T.accent} strokeWidth="10" />
                </svg>
                TCH
              </div>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.015em', margin: 0 }}>{c.heading}</h1>
            <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>{c.reason}</div>
            <div style={{ background: T.sunken, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>{c.why}</div>
            <button type="button" onClick={() => retry()} style={{ height: 50, borderRadius: 14, fontSize: 15, fontWeight: 800, letterSpacing: '0.02em', background: T.accent, color: T.onAccent, border: 'none', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>{c.action}</button>
            <a href="/" style={{ height: 46, borderRadius: 14, fontSize: 14, fontWeight: 700, letterSpacing: '0.02em', background: T.surface2, color: T.ink, border: `1px solid ${T.line}`, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', boxSizing: 'border-box' }}>{c.home}</a>
          </div>
        </div>
      </body>
    </html>
  );
}
