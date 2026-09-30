// A club's own colours (D-173 change 4, BUZ 1 Oct: "start club colours").
//
// Colour has one job each: green is an action, a club's colours are its
// identity. They dress a CLAIMED club's page — hero, stripe, crest tile, the
// month on a trial — and never an unclaimed one (D-172: "club colours as the
// page's identity" is on its never-list). Buttons stay green whatever the
// club picks, so "what do I press" never changes from page to page.
//
// A club can pick anything, so the page cannot trust what it is given. White
// text has to stay readable on the hero, and the trim has to stay visible on
// the dark page. Both are enforced here by arithmetic, not by hoping: a colour
// that would fail is darkened (the hero) or swapped for the other colour or
// ink (the trim) until it passes. Nobody is told their colours are wrong.

export type ClubColours = { primary: string; secondary: string };

const HEX = /^#[0-9a-f]{6}$/;
export const isHex = (s: unknown): s is string => typeof s === 'string' && HEX.test(s);

// Twelve pairs that cover most Victorian club kits, so most clubs pick in one
// tap. Named by colour, never by any club.
export const PRESETS: { name: string; primary: string; secondary: string }[] = [
  { name: 'Claret and gold', primary: '#7a1f35', secondary: '#f2b134' },
  { name: 'Navy and white', primary: '#0f2f66', secondary: '#f1f1ee' },
  { name: 'Royal blue and white', primary: '#1b4fb3', secondary: '#f1f1ee' },
  { name: 'Red and white', primary: '#b3202a', secondary: '#f1f1ee' },
  { name: 'Red and black', primary: '#b3202a', secondary: '#141414' },
  { name: 'Black and gold', primary: '#141414', secondary: '#e8c24a' },
  { name: 'Black and white', primary: '#141414', secondary: '#f1f1ee' },
  { name: 'Green and white', primary: '#0d5b3a', secondary: '#f1f1ee' },
  { name: 'Green and gold', primary: '#0d5b3a', secondary: '#f2c230' },
  { name: 'Sky blue and navy', primary: '#5aa7de', secondary: '#0f2f66' },
  { name: 'Purple and gold', primary: '#4b2a7a', secondary: '#f5d547' },
  { name: 'Orange and black', primary: '#e0661b', secondary: '#141414' },
];

const INK = '#eef5f0';
const PAGE = '#0b120e';

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c: number[]) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const chan = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const lum = (h: string) => { const [r, g, b] = rgb(h).map(chan); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (a: string, b: string, t: number) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v + (B[i] - v) * t)); };

/** Darken towards black until white text holds `floor` on it. */
function darkenFor(base: string, floor: number): string {
  let c = base;
  for (let t = 0.08; contrast(INK, c) < floor && t <= 1; t += 0.08) c = mix(base, '#000000', t);
  return c;
}

export type ClubTheme = {
  /** The hero's lit end: the club's main colour, darkened only as far as white text needs. */
  hero: string;
  /** The hero's dark end, fading into the page. */
  heroDeep: string;
  /** The trim: stripe, crest tile, the month on a trial. Always visible on the page. */
  trim: string;
  /** Text on the trim (the crest tile's initial). */
  onTrim: string;
};

/**
 * The theme a claimed club's page wears. `null` for an unclaimed club or a
 * club with no colours: the page then keeps Pitch's own hero.
 */
export function clubTheme(colours: Partial<ClubColours> | null | undefined, clubState: string): ClubTheme | null {
  if (clubState === 'unclaimed' || clubState === 'suspended') return null;
  if (!colours || !isHex(colours.primary) || !isHex(colours.secondary)) return null;
  const hero = darkenFor(colours.primary, 4.5);
  const heroDeep = mix(hero, PAGE, 0.7);
  // The trim sits on the dark page and on the hero; 3:1 is the floor for a
  // stripe or a label. The secondary colour first, then the primary, then ink.
  const trim = [colours.secondary, colours.primary, INK].find((c) => contrast(c, PAGE) >= 3 && contrast(c, heroDeep) >= 3) ?? INK;
  const onTrim = contrast(PAGE, trim) >= contrast(INK, trim) ? PAGE : INK;
  return { hero, heroDeep, trim, onTrim };
}

// A player's CV wearing their current club's colours (BUZ, 1 Oct: yes). Held
// OFF until John clears it: on a child's page the club is already named, but
// its colours are a new visual signal, and BUZ was told John would see it
// first (13-Board-Room, 1 Oct). Never on a card either way (D-89). Flip to
// true on John's word, recorded in the register — perms cvc1 pins it false
// until then, and ctx4 keeps every card surface away from colours for good.
export const CV_WEARS_CLUB_COLOURS = false;
