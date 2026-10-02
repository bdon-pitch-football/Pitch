// Builds public/places-vic.<hash>.json — every Victorian suburb and locality
// with its postcode, its council and a centre point (trials board filters,
// BUZ approved 2 Oct; docs/design/reports/2026-10-02-proposal-trials-v2.md §5
// and §6).
//
//   node scripts/places-vic.mjs            fetch from the ABS, write the file
//
// Then point lib/places-vic-file.ts (PLACES_FILE) and lib/places-vic.ts (its
// import) at the new name; the permission suite's pv checks fail until both
// name a file that is there and whose hash is its contents.
//
// Run it when the ABS publishes a new edition, never on a schedule: the file's
// name carries a hash of its contents, so a regenerated file is a new address
// and no browser keeps an old one.
//
// THE SOURCE, and it is the only one (Australian Bureau of Statistics, CC BY
// 4.0 — the credit it needs is lib/places-vic-file.ts's, pending BUZ):
//   · the localities and their centre points: ASGS Edition 3, Suburbs and
//     Localities 2021, the SAL_PT layer (one point per locality);
//   · the postcode of each: ASGS Edition 3, Postal Areas 2021 (POA_GEN), the
//     postal area the locality's point falls in;
//   · the council of each: Local Government Areas 2025 (LGA_GEN), the council
//     area the locality's point falls in. 2025, not 2021, so the names are
//     today's (Merri-bek, not Moreland).
// All three are read from the ABS's own map services at geo.abs.gov.au. A
// locality whose point falls in no boundary (the generalised coastline) takes
// the nearest one. A postal area holding no locality's point (3000: the
// city's point is in 3004) is given the locality whose boundary holds the
// postal area's own point (POA_PT), so every postcode finds a place.
//
// What the file holds is public geography, the same bytes for everyone. It is
// fetched whole by the browser when the Distance field is first focused, so
// fetching it says nothing about what anybody types (John, 2 Oct, Q1).
import { createHash } from 'node:crypto';
import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ABS = 'https://geo.abs.gov.au/arcgis/rest/services';
const SOURCES = {
  sal: `${ABS}/ASGS2021/SAL/MapServer/2`,
  salArea: `${ABS}/ASGS2021/SAL/MapServer/0`,
  poa: `${ABS}/ASGS2021/POA/MapServer/1`,
  poaPt: `${ABS}/ASGS2021/POA/MapServer/2`,
  lga: `${ABS}/ASGS2025/LGA/MapServer/1`,
};
const VERSION = 'ABS ASGS Edition 3: Suburbs and Localities 2021 (SAL_PT), Postal Areas 2021 (POA_GEN), Local Government Areas 2025 (LGA_GEN)';

async function all(layer, where, fields, geojson) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const q = new URLSearchParams({ where, outFields: fields, outSR: '4326', resultOffset: String(offset), resultRecordCount: '1000', f: geojson ? 'geojson' : 'json' });
    const r = await fetch(`${layer}/query?${q}`);
    if (!r.ok) throw new Error(`${layer}: ${r.status}`);
    const page = await r.json();
    const feats = page.features ?? [];
    out.push(...feats);
    if (feats.length < 1000) return out;
  }
}

// Rings of a GeoJSON Polygon or MultiPolygon, as [[lng, lat], ...] lists.
const polygons = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
const inRing = ([x, y], ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const contains = (g, pt) => polygons(g).some(([outer, ...holes]) => inRing(pt, outer) && !holes.some((h) => inRing(pt, h)));
const nearest = (g, [x, y]) => Math.min(...polygons(g).flat(2).map(([a, b]) => (a - x) ** 2 + (b - y) ** 2));
const locate = (areas, pt) => areas.find((a) => contains(a.geometry, pt)) ?? areas.reduce((best, a) => (nearest(a.geometry, pt) < nearest(best.geometry, pt) ? a : best));

const sal = await all(SOURCES.sal, "state_code_2021='2'", 'sal_code_2021,sal_name_2021', false);
const poa = (await all(SOURCES.poa, "poa_code_2021 like '3%'", 'poa_code_2021', true)).filter((f) => f.geometry);
const poaPt = await all(SOURCES.poaPt, "poa_code_2021 like '3%'", 'poa_code_2021', false);
const lga = (await all(SOURCES.lga, "STATE_CODE_2021='2'", 'LGA_CODE_2025,LGA_NAME_2025', true)).filter((f) => f.geometry);
console.log(`localities ${sal.length} · postal areas ${poa.length} · councils ${lga.length}`);

// "Preston (Vic.)" is Preston; "Ascot (Ballarat - Vic.)" keeps its council
// so the two Ascots stay two.
const tidy = (n) => n.replace(/ \(Vic\.\)$/, '').replace(/ - Vic\.\)$/, ')');
const councils = [...new Set(lga.map((f) => f.properties.LGA_NAME_2025))].sort();
const places = [];
for (const f of sal) {
  const pt = f.geometry?.points?.[0];
  if (!pt) continue;                       // "No usual address", "Migratory - Offshore - Shipping"
  const name = tidy(f.attributes.sal_name_2021);
  const postcode = Number(locate(poa, pt).properties.poa_code_2021);
  const council = councils.indexOf(locate(lga, pt).properties.LGA_NAME_2025);
  places.push([name, postcode, Math.round(pt[1] * 1000) / 1000, Math.round(pt[0] * 1000) / 1000, council]);
}
// A postal area no locality's point falls in would make its postcode match
// nothing — "Melbourne 3000" as well as "Melbourne 3004".
const covered = new Set(places.map((p) => p[1]));
for (const f of poaPt) {
  const code = Number(f.attributes.poa_code_2021), pt = f.geometry?.points?.[0];
  if (!pt || covered.has(code)) continue;
  // The locality whose boundary holds the postal area's point (asked of the
  // SAL boundaries themselves); failing that, the nearest locality point.
  const q = new URLSearchParams({ geometry: `${pt[0]},${pt[1]}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', where: "state_code_2021='2'", outFields: 'sal_name_2021', returnGeometry: 'false', f: 'json' });
  const hit = (await (await fetch(`${SOURCES.salArea}/query?${q}`)).json()).features?.[0]?.attributes?.sal_name_2021;
  const near = places.find((p) => hit && p[0] === tidy(hit))
    ?? places.reduce((best, p) => ((p[3] - pt[0]) ** 2 + (p[2] - pt[1]) ** 2 < (best[3] - pt[0]) ** 2 + (best[2] - pt[1]) ** 2 ? p : best));
  places.push([near[0], code, near[2], near[3], near[4]]);
  covered.add(code);
}
places.sort((a, b) => a[0].localeCompare(b[0], 'en-AU') || a[1] - b[1]);

const body = JSON.stringify({ v: VERSION, src: Object.values(SOURCES), licence: 'CC BY 4.0', councils, places });
const hash = createHash('sha256').update(body).digest('hex').slice(0, 10);
const root = fileURLToPath(new URL('../', import.meta.url));
for (const old of readdirSync(join(root, 'public')).filter((f) => /^places-vic\.[0-9a-f]+\.json$/.test(f))) rmSync(join(root, 'public', old));
writeFileSync(join(root, 'public', `places-vic.${hash}.json`), body);
console.log(`public/places-vic.${hash}.json · ${places.length} places · ${(body.length / 1024).toFixed(0)} KB`);
console.log(`now set PLACES_FILE in lib/places-vic-file.ts to '/places-vic.${hash}.json', and lib/places-vic.ts's import to match`);
