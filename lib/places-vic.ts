// The Victorian places file, read on the server (lib/places-vic-file has its
// name and where it came from). The board uses it for the CLUB's side only:
// a club's council (for its region) and its suburb's centre point (for
// "about {n} km", worked out in the browser). Nothing here is about a family.
import 'server-only';
import data from '@/public/places-vic.4306391711.json';
import { placeLookup, suburbKey, type Place } from '@/lib/suburb-region';

const lookup = placeLookup(data as unknown as { councils: string[]; places: Place[] });
export { suburbKey };
export const regionOfSuburb = lookup.regionOfSuburb;
export const centreOf = lookup.centreOf;
