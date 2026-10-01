import type { ReactNode } from 'react';
import Link from 'next/link';

// The player's screens, Floodlit (spec C, 1 Oct): docs/design/specs/C-player.md
// and the mockup floodlit-player.html. The parts every one of them shares, so
// Send, Register interest and the share card draw one outcome, one checklist
// and one who-sends row, not three hand-built copies of each. Styling only:
// the words are always the caller's.

const svg = (d: ReactNode, size = 18, w = 2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);
export const G = {
  tick: (s = 15) => svg(<path d="M5 12.5 l4.5 4.5 L19 7" />, s, 2.4),
  cross: (s = 15) => svg(<path d="M6 6 L18 18 M18 6 L6 18" />, s, 2.4),
  send: (s = 18) => svg(<><path d="M21 3 L10 14" /><path d="M21 3 L14.5 21 L10 14 L3 9.5 Z" /></>, s),
  people: (s = 18) => svg(<><circle cx="9" cy="8" r="2.6" /><circle cx="16.5" cy="9.5" r="2" /><path d="M4.5 20 c0-3 2-5 4.5-5 s4.5 2 4.5 5 M14 20 c0-2.4 1.2-4 2.5-4 s2.5 1.6 2.5 4" /></>, s),
  info: (s = 17) => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7.5 v5" /><path d="M12 16.2h.01" /></>, s),
  cal: (s = 13) => svg(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 11h18" /></>, s, 2.2),
  chev: (s = 18) => svg(<path d="M9 6 l6 6 -6 6" />, s),
  plus: (s = 16) => svg(<path d="M12 5v14M5 12h14" />, s, 2.2),
  play: (s = 16) => svg(<path d="M8 5 L19 12 L8 19 Z" />, s),
  cam: (s = 24) => svg(<><path d="M5 8 h2.5 l1.5-2 h6 l1.5 2 H19 a1.5 1.5 0 0 1 1.5 1.5 v8 A1.5 1.5 0 0 1 19 19 H5 a1.5 1.5 0 0 1-1.5-1.5 v-8 A1.5 1.5 0 0 1 5 8 Z" /><circle cx="12" cy="13" r="3.2" /></>, s),
  eye: (s = 15) => svg(<><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>, s, 2.2),
  lock: (s = 15) => svg(<><rect x="4" y="10.5" width="16" height="10" rx="2" /><path d="M8 10.5 V7.5 A4 4 0 0 1 16 7.5 V10.5" /></>, s),
  clock: (s = 16) => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, s, 2.6),
  search: (s = 18) => svg(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>, s, 2.2),
};

/** A one-line Notice: "Saved.", a refusal. Accent is done, amber is waiting or refused, purple is the parent's. */
export function Say({ tone, role, children }: { tone: 'accent' | 'amber' | 'purple'; role?: 'status' | 'alert'; children: ReactNode }) {
  return <div role={role} className={`card card-${tone} c-say`}>{children}</div>;
}

/** An outcome (asked, sent, off, not sent, on the register): kicker, title, body, nothing between them. */
export function Outcome({ tone, kicker, title, children }: { tone: 'accent' | 'amber' | 'muted'; kicker: string; title: string; children: ReactNode }) {
  return (
    <div role="status" className={`card fl-float c-notice${tone === 'amber' ? ' card-amber' : ''}`}>
      <div className={`notice-k k-${tone}`}>{kicker}</div>
      <h1 className="notice-h">{title}</h1>
      <div className="notice-b">{children}</div>
    </div>
  );
}

/** One row of a checklist: a tick is given, a cross is not given. Neither is red. */
export function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <div className={ok ? 'check' : 'check no'}>{ok ? G.tick() : G.cross()}<div>{children}</div></div>;
}

/** Who presses send. Purple when it is the parent (the guardian state). */
export function Who({ guard, icon, title, children }: { guard?: boolean; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="card who">
      <div className={guard ? 'row-ic guard' : 'row-ic'}>{icon}</div>
      <div className="row-main">
        <div className="row-t">{title}</div>
        <div className="c-s2">{children}</div>
      </div>
    </div>
  );
}

/** The builder's header, the same on all three steps (C-P2): title, Preview, progress, the step chips. */
export function BuildHeader({ recordId, title, sub, done, total, here, preview = false }: {
  recordId: string; title: string; sub: string; done: number; total: number;
  here: 'Your football' | 'Highlights' | 'Achievements'; preview?: boolean;
}) {
  const steps: [string, string][] = [
    ['Your football', `/build/${recordId}`], ['Highlights', `/build/${recordId}/clips`], ['Achievements', `/build/${recordId}/more`],
  ];
  return (
    <div className="build-top">
      <div className="build-head">
        <div className="pg-titles">
          <h1 className="pg-title">{title}</h1>
          <div className="pg-sub" style={{ fontSize: 13.5 }}>{sub}</div>
        </div>
        {preview && <a href={`/build/${recordId}/preview`} className="chip" style={{ flexShrink: 0, color: 'var(--ink)', fontWeight: 800, letterSpacing: 'var(--ls-button)' }}>{G.eye()}Preview</a>}
      </div>
      <div className="prog">
        <div className="prog-row">
          <div className="panel-h">Your page</div>
          <div className="prog-n" aria-live="polite">{done} of {total} done</div>
        </div>
        <div className="prog-bar" aria-hidden><i style={{ width: `${Math.round((done / total) * 100)}%` }} /></div>
      </div>
      <nav className="build-steps" aria-label="Build steps">
        {steps.map(([label, href]) => label === here
          ? <span key={label} className="chip" aria-current="page">{label}</span>
          : <a key={label} href={href} className="chip">{label}</a>)}
      </nav>
    </div>
  );
}

/** The way out under a door's primary. */
export const TextLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className="textbtn textbtn-block">{children}</Link>
);
