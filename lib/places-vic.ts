// The Victorian places file, read on the server (lib/places-vic-file has its
// name and where it came from). The board uses it for the CLUB's side only:
// a club's council (for its region) and its suburb's centre point (for
// "about {n} km", worked out in the browser). Nothing here is about a family.
import 'server-only';
import data from '@/public/places-vic.4306391711.json';
import { regionOfCouncil } from '@/lib/regions';

type Place = [name: string, postcode: number, lat: number, lng: number, council: number];
const { councils, places } = data as unknown as { councils: string[]; places: Place[] };

// A suburb as a person would compare it: case and spacing aside, and anything
// in brackets dropped — three live clubs carry their ground there ("Narre
// Warren North (Jack Thomas Reserve)"), and the file brackets the council of
// a name two councils share ("Ascot (Ballarat)").
export const suburbKey = (s: string | null | undefined) =>
  (s ?? '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

const byKey = new Map<string, Place[]>();
for (const p of places) {
  const k = suburbKey(p[0]);
  byKey.set(k, [...(byKey.get(k) ?? []), p]);
}

// A club's region, from its suburb as the club's page prints it. A suburb
// the file does not know, or one whose namesakes sit in two regions, gets no
// region: the club is then under "Any region" only, never guessed.
export function regionOfSuburb(suburb: string | null | undefined): string | null {
  const keys = new Set((byKey.get(suburbKey(suburb)) ?? []).map((p) => regionOfCouncil(councils[p[4]])));
  return keys.size === 1 ? [...keys][0] : null;
}

// The suburb's centre point, or null when the name is unknown or names two
// different places — a club is never placed by a guess.
export function centreOf(suburb: string | null | undefined): [number, number] | null {
  const pts = [...new Set((byKey.get(suburbKey(suburb)) ?? []).map((p) => `${p[2]},${p[3]}`))];
  return pts.length === 1 ? (pts[0].split(',').map(Number) as [number, number]) : null;
}
