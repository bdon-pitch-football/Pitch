// Region on the trials board (BUZ approved 2 Oct; docs/design/reports/
// 2026-10-02-proposal-trials-v2.md §5; John, 2 Oct, Q3). A listing's region
// is its CLUB's: the club's own suburb, its council, the council's region.
// The family supplies nothing, and nothing about where anyone lives is in it.
//
// A region is a group of whole councils, and never anything finer (John: "the
// region list never gets finer than a council group" — a region that named a
// single suburb would make the address bar a locator, and comes back to him).
// So there is no suburb here, only councils, and every council is in exactly
// one region (the permission suite's rg-council checks both). The councils are
// spelt as the ABS's Local Government Areas 2025 spells them, which is how
// lib/places-vic's file names them.
//
// The order is fixed — Melbourne first, then regional — and never by count.
// The keys are the address (`/trials?area=mel-north`), checked against this
// list and ignored if unknown (D-94 §6). No key is a suburb's name, so an
// address never reads as one ("bendigo-region", never "bendigo"). A club's region is worked out from
// its suburb in lib/places-vic, on the server.

export type Region = { key: string; name: string; councils: string[] };

export const REGIONS: Region[] = [
  { key: 'mel-north', name: 'Melbourne North', councils: ['Banyule', 'Darebin', 'Hume', 'Merri-bek', 'Nillumbik', 'Whittlesea'] },
  { key: 'mel-west', name: 'Melbourne West', councils: ['Brimbank', 'Hobsons Bay', 'Maribyrnong', 'Melton', 'Moonee Valley', 'Wyndham'] },
  { key: 'mel-east', name: 'Melbourne East', councils: ['Boroondara', 'Knox', 'Manningham', 'Maroondah', 'Monash', 'Whitehorse'] },
  { key: 'mel-south', name: 'Melbourne South', councils: ['Bayside (Vic.)', 'Glen Eira', 'Kingston (Vic.)', 'Stonnington'] },
  { key: 'mel-south-east', name: 'Melbourne South-East', councils: ['Cardinia', 'Casey', 'Frankston', 'Greater Dandenong'] },
  { key: 'inner-mel', name: 'Inner Melbourne', councils: ['Melbourne', 'Port Phillip', 'Yarra'] },
  { key: 'mornington-peninsula', name: 'Mornington Peninsula', councils: ['Mornington Peninsula'] },
  { key: 'yarra-ranges', name: 'Yarra Ranges', councils: ['Yarra Ranges'] },
  { key: 'ballarat-region', name: 'Ballarat', councils: ['Ballarat', 'Hepburn', 'Moorabool', 'Pyrenees'] },
  { key: 'bendigo-region', name: 'Bendigo', councils: ['Greater Bendigo', 'Mount Alexander', 'Loddon', 'Central Goldfields', 'Macedon Ranges'] },
  { key: 'geelong-surf-coast', name: 'Geelong & Surf Coast', councils: ['Greater Geelong', 'Surf Coast', 'Queenscliffe', 'Golden Plains'] },
  { key: 'gippsland', name: 'Gippsland', councils: ['Baw Baw', 'Latrobe (Vic.)', 'Wellington', 'East Gippsland', 'South Gippsland', 'Bass Coast'] },
  { key: 'shepparton-ne', name: 'Shepparton & North East', councils: ['Greater Shepparton', 'Campaspe', 'Moira', 'Strathbogie', 'Mitchell', 'Murrindindi', 'Benalla', 'Wangaratta', 'Mansfield', 'Alpine', 'Indigo', 'Wodonga', 'Towong'] },
  { key: 'western-vic', name: 'Western Victoria', councils: ['Warrnambool', 'Moyne', 'Corangamite', 'Colac Otway', 'Glenelg', 'Southern Grampians', 'Ararat', 'Northern Grampians', 'Horsham', 'West Wimmera', 'Hindmarsh', 'Yarriambiack', 'Buloke', 'Gannawarra', 'Swan Hill', 'Mildura'] },
];

const byCouncil = new Map(REGIONS.flatMap((r) => r.councils.map((c) => [c, r.key] as const)));
export const regionOfCouncil = (council: string): string | null => byCouncil.get(council) ?? null;
