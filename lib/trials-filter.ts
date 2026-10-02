// The trials board's filters, as one pure function (BUZ approved 2 Oct;
// docs/design/reports/2026-10-02-proposal-trials-v2.md §5–§7). The same code
// decides what a filtered view shows on the server, for the board as it
// arrives (and with no JavaScript), and in the browser once a distance is
// set — so every chip's number is true with a distance on as well (D-162).
//
// A filter only ever narrows. Nothing here sorts, scores or ranks: the board
// keeps its date order whatever is chosen (pillar zero 4, D-21, D-74).
// Every facet is a public fact about a listing or its CLUB — the club's
// suburb, its council's region, its senior league — never about a family.

export type Kind = 'trial' | 'eoi';
export type Facets = {
  ages: string[];
  gender: string | null;
  pos: string[];
  state: string | null;
  kind: Kind;
  area: string | null;              // the club's region (lib/regions)
  level: string | null;             // the club's senior league (0172)
  at: [number, number] | null;      // the club's suburb's centre (lib/places-vic)
};
export type Chosen = {
  age: string | null; gender: string | null; state: string | null; pos: string | null;
  kind: Kind | null; area: string | null; level: string | null;
};
// A distance is the browser's alone: a point the family picked and a
// radius, held in a component's state and never in the address (John, 2 Oct).
export type Near = { at: [number, number]; km: number } | null;

export const NONE: Chosen = { age: null, gender: null, state: null, pos: null, kind: null, area: null, level: null };

// Great-circle distance in km. "about {n} km" is this, rounded.
export function kmBetween(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// A club with no centre point is never within any distance: it cannot be
// placed, so it is not guessed.
export const within = (f: Facets, near: Near) => !near || (f.at !== null && kmBetween(near.at, f.at) <= near.km);

export function matches(f: Facets, c: Chosen, near: Near = null): boolean {
  return (!c.age || f.ages.includes(c.age)) && (!c.gender || f.gender === c.gender)
    && (!c.state || f.state === c.state) && (!c.pos || f.pos.includes(c.pos))
    && (!c.kind || f.kind === c.kind) && (!c.area || f.area === c.area)
    && (!c.level || f.level === c.level) && within(f, near);
}

// Every filtered view has its own address (D-74), in a fixed order. The
// distance is never in it.
export function hrefFor(c: Chosen): string {
  const p = new URLSearchParams();
  if (c.age) p.set('age', c.age);
  if (c.gender) p.set('gender', c.gender);
  if (c.state) p.set('state', c.state);
  if (c.pos) p.set('pos', c.pos);
  if (c.area) p.set('area', c.area);
  if (c.level) p.set('level', c.level);
  if (c.kind) p.set('kind', c.kind);
  const qs = p.toString();
  return qs ? `/trials?${qs}` : '/trials';
}
