import type { ReactNode } from 'react';
import SiteNav from '@/components/floodlit/SiteNav';
import { T } from '@/lib/palette';

// The parent screens, Floodlit (spec D, 1 Oct): docs/design/specs/D-parent.md
// and the mockup floodlit-parent.html.
//
// An unframed flow gets the Top bar (spec A part 5): the logo top right on a
// phone, top left from 1024px. The mark is NOT a link here, as the old
// in-column mark was not: these pages are reached from a text, an email or a
// parent's own home, and a link to / would be a door none of them had.
// `.has-topbar` hides the page header's own copy of the mark, so no page shows
// two; the page header's back link stays, in the column, at every width.
//
// A question is a DOOR (part 20): the phone column as drawn, lifted onto a
// panel from 640px. A page with a list on it (Your family after approving, the
// closed and dead links) is the reading column instead — a list is a page.
export function ParentPage({ children, page = false }: { children: ReactNode; page?: boolean }) {
  return (
    <div className="floodlight has-topbar" style={{ minHeight: '100dvh', color: 'var(--ink)', display: 'flex', flexDirection: 'column' }}>
      <SiteNav links={[]} signIn={false} />
      <main className="fl-wide pd-flow">
        <div className={page ? 'pd-col' : 'door'}>{children}</div>
      </main>
    </div>
  );
}

// The ask head: the child's tile, then who is asking, then the question and
// its one line. Every answer screen starts here. The kicker is a state: purple
// for a club's invitation (spec A part 11), amber (`wait`) for a send, a
// registration or a page edit waiting on the parent — the tone its notice has
// on the home (spec D as amended, audit ruling 11, 2 Oct).
export function AskHead({ initial, kicker, title, size = 26, sub, children, wait = false }: {
  initial?: string; kicker: ReactNode; title: ReactNode; size?: number; sub?: ReactNode; children?: ReactNode; wait?: boolean;
}) {
  return (
    <div className="ask">
      <div className="ask-who">
        {initial && <div className="who-tile" aria-hidden>{initial}</div>}
        <div className={wait ? 'kick-p wait' : 'kick-p'}>{kicker}</div>
      </div>
      <h1 style={{ fontSize: size, fontWeight: 900, lineHeight: size >= 27 ? 1.12 : 1.15, letterSpacing: '-0.015em' }}>{title}</h1>
      {sub && <div className="pd-sub">{sub}</div>}
      {children}
    </div>
  );
}

export const TickGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
);
// The "never" row: a promise, not an alarm, so it is muted, not red.
export const CrossGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 6 L18 18 M18 6 L6 18" /></svg>
);
export const InfoGlyph = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7.5 v5" /><circle cx="12" cy="16.2" r="0.6" fill={T.muted} /></svg>
);
export const ClockGlyph = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7 v5.5 l3.5 2" /></svg>
);
export const CalendarGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="5.5" width="16" height="14.5" rx="2.5" /><path d="M4 10 h16 M8.5 3.5 v4 M15.5 3.5 v4" /></svg>
);
export const ChevronGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9 l6 6 l6 -6" /></svg>
);

// Dashed: nothing to act on here (Head of Product Design ruling 4).
export function DashedTile({ children }: { children: ReactNode }) {
  return <div><div className="pd-gtile">{children}</div></div>;
}
// A closed door: the request has closed, either ending (PD-3).
export const ClosedGlyph = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="6" y="3.5" width="12" height="17" rx="1.5" /><path d="M14.5 12.5 v.01" /></svg>
);
