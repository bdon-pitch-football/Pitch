import type { ReactNode } from 'react';
import SiteNav from '@/components/floodlit/SiteNav';

// Shared dark shell for the small utility pages (/unsubscribe, /manage,
// /stop-cvs, /privacy, /terms) — Night Match tones, reading-column width.
//
// Floodlit (spec A part 21): the top bar carries the logo — top right on a
// phone, top left from 1024px (D-173 (3)). It replaces PitchWordmark, which
// put the logo top LEFT on a phone. The mark still links to /, as
// PitchWordmark's did: the same door, in the bar. The 460px column and the
// 640px `wide` one are unchanged; `door` wraps a form page's children in the
// door panel (part 20) for the groups that adopt it.
export function QuietShell({ children, wide, door }: { children: ReactNode; wide?: boolean; door?: boolean }) {
  return (
    <div className="floodlight has-topbar" style={{ minHeight: '100dvh', color: 'var(--ink)' }}>
      <SiteNav links={[]} signIn={false} />
      <main className="reading" style={{ maxWidth: wide ? 640 : 460, padding: '28px 18px 48px', boxSizing: 'border-box' }}>
        {/* A door takes .door's own column and 18px gap (part 20). */}
        <div className={door ? 'door' : undefined} style={door ? undefined : { display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
      </main>
    </div>
  );
}
