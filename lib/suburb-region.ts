// The suburb → region and suburb → centre lookups, kept free of the server
// and of the file itself so a test can drive them with the real file
// (lib/places-vic.ts hands them the data). Nothing here is about a family.
import { regionOfCouncil } from './regions.ts';

export type Place = [name: string, postcode: number, lat: number, lng: number, council: number];

// A suburb as a person would compare it: case and spacing aside, and anything
// in brackets dropped — three live clubs carry their ground there ("Narre
// Warren North (Jack Thomas Reserve)"), and the file brackets the council of
// a name two councils share ("Ascot (Ballarat)").
export const suburbKey = (s: string | null | undefined) =>
  (s ?? '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

export function placeLookup({ councils, places }: { councils: string[]; places: Place[] }) {
  const byKey = new Map<string, Place[]>();
  for (const p of places) {
    const k = suburbKey(p[0]);
    byKey.set(k, [...(byKey.get(k) ?? []), p]);
  }

  // A club's region, from its suburb as the club's page prints it. A suburb
  // the file does not know, or one whose namesakes sit in two regions, gets no
  // region: the club is then under "Any region" only, never guessed.
  //
  // Two shapes the live list carries are read, never guessed (Head of Product
  // Design, 2 Oct: Ballarat City's nine listings sat in no region):
  //   · a town the file only knows by its parts — "Ballarat" is Ballarat
  //     Central, East and North: the parts' region, when they all share one;
  //   · two suburbs in one field — "Albert Park / Port Melbourne", "Langwarrin
  //     (seniors…); Frankston (juniors…)": their region, when they agree.
  // When they do not agree (Parkville; Avondale Heights), there is no region.
  const placesOf = (k: string): Place[] => {
    const exact = byKey.get(k);
    if (exact) return exact;
    if (!k) return [];
    const family: Place[] = [];
    for (const [name, ps] of byKey) if (name.startsWith(`${k} `)) family.push(...ps);
    return family;
  };
  function regionOfSuburb(suburb: string | null | undefined): string | null {
    const parts = suburbKey(suburb).split(/\s*[;/]\s*/).filter(Boolean);
    if (parts.length === 0) return null;
    const regions = new Set<string | null>();
    for (const part of parts) {
      const found = placesOf(part);
      if (found.length === 0) return null;
      for (const p of found) regions.add(regionOfCouncil(councils[p[4]]));
    }
    return regions.size === 1 ? [...regions][0] : null;
  }

  // The suburb's centre point, or null when the name is unknown or names two
  // different places — a club is never placed by a guess.
  function centreOf(suburb: string | null | undefined): [number, number] | null {
    const pts = [...new Set((byKey.get(suburbKey(suburb)) ?? []).map((p) => `${p[2]},${p[3]}`))];
    return pts.length === 1 ? (pts[0].split(',').map(Number) as [number, number]) : null;
  }
  return { regionOfSuburb, centreOf };
}
