// The glyphs for the doors a link from a message opens (spec G, the mockup's
// glyph table). Stroke SVGs at 24px, stroke-width 1.8, in the tile's own
// colour (`currentColor`: ink when solid, muted when dashed). Never emoji.
// They sit inside GlyphTile (components/FailureState.tsx).
import type { ReactNode } from 'react';

const glyph = (children: ReactNode) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>{children}</svg>
);

/** An envelope: /confirm's ask, and /reset once the request is taken. */
export const MAIL_GLYPH = glyph(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>);
/** An envelope, struck through: /unsubscribe. */
export const MAIL_OFF_GLYPH = glyph(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /><path d="M3 3l18 18" /></>);
/** A key: /reset and /reset/[token]. */
export const KEY_GLYPH = glyph(<><circle cx="8" cy="15" r="4" /><path d="m10.8 12.2 8.2-8.2" /><path d="m16 7 2.5 2.5" /><path d="m13.5 9.5 2 2" /></>);
/** A link: a link that is not live (/confirm's dead panel). */
export const LINK_GLYPH = glyph(<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>);
/** A CV, struck through: /stop-cvs. */
export const CV_OFF_GLYPH = glyph(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6" /><path d="M3 3l18 18" /></>);
