import type { ReactNode } from 'react';
import { HeaderMark } from '@/components/Wordmark';
import { T } from '@/lib/palette';

// The §36/§37 undo's three screens (app/undo): the ask, Done and the not-live
// panel share a frame, and the ask and Done share their words.

export function UndoFrame({ children }: { children: ReactNode }) {
  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        {children}
      </div>
    </div>
  );
}

// The two sentences the ask makes, and Done repeats once they are true.
export const UNDO_WHAT = 'The club will not be able to open the page any more. Nothing is deleted, and you can make a new link whenever you want to.';

// John (1 Oct): this stays on Done. "I have recalled the email" is the single
// most likely misunderstanding on this screen.
export function NotUnsent() {
  return (
    <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, lineHeight: 1.55 }}>
      <b style={{ color: T.secondary }}>This does not un-send the email.</b> It has already arrived and nobody can recall it — not us, not you. What this stops is what it opens.
    </div>
  );
}
