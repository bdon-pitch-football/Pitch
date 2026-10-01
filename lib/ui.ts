// Shared style pieces (16 Sep). The same card and the same labels were
// defined screen by screen — sixteen copies each — and "label" had come to
// mean three different things. The charter has exactly two:
//
//   sectionLabel — a section heading: 11px, 800, uppercase, 0.14em, muted
//                  (the inline twin of .panel-h, spec A part 8)
//   fieldLabel   — the caption inside a field or tile: 10px, 800, 0.06em
//
// Three public pages (club, coach CV, a coaching role) had drifted to 11px
// at 0.06em, which is neither; they use sectionLabel now.
import type { CSSProperties } from 'react';
import { T } from './palette';

/** The charter card: 16px radius, 15px 14px padding — the inline twin of
 *  .card, so it is the Floodlit panel too (D-173 (1), spec A part 9): the
 *  gradient surface and the card shadow, both tokens. */
export const card: CSSProperties = { background: 'var(--fl-surface)', border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', boxShadow: 'var(--shadow-card)' };

export const sectionLabel: CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted };

export const fieldLabel: CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted };
