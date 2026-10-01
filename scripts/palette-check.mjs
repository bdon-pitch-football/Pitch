// Keeps the palette in ONE place (16 Sep). Fails when:
//   1. lib/palette.ts and globals.css :root disagree on any colour, or
//   2. a screen declares its own palette object again, or
//   3. THE SURFACE STACK CANNOT BE SEEN, or a token pair the product renders
//      falls below its contrast floor (28 Sep).
// Reports (without failing) how many raw token hexes are still written
// inline, which is the next layer of the clean-up.
//
// (3) is new and it is the thing this file was missing: until today it proved
// the two copies of the palette AGREED and measured nothing about whether the
// agreed values worked. They did not. A card sat 1.079:1 from the page and a
// well 1.038:1 from the card — 1.00 is identical — so five named surface
// levels lived inside 10% of one channel and the eye saw one surface. The
// values were right in the file and wrong on the screen, which is exactly the
// kind of defect a check that only compares two files cannot find.
//
//   node scripts/palette-check.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');

// The old website, kept on this branch for a one-line rollback. Not app UI.
const EXEMPT = new Set(['components/site-preview/SitePreview.tsx', 'components/coming-soon/ComingSoon.tsx',
  'components/coming-soon/data.ts', 'lib/palette.ts']);

const tokensSrc = read('lib/palette.ts');
const values = Object.fromEntries([...tokensSrc.slice(0, tokensSrc.indexOf('} as const')).matchAll(/(\w+):\s*'(#[0-9a-f]{6})'/gi)].map((m) => [m[1], m[2].toLowerCase()]));
const vars = Object.fromEntries([...tokensSrc.slice(tokensSrc.indexOf('CSS_VAR')).matchAll(/(\w+):\s*'(--[\w-]+)'/g)].map((m) => [m[1], m[2]]));
const css = read('app/globals.css');
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
const cssVals = Object.fromEntries([...rootBlock.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2].toLowerCase()]));

let failures = 0;
const fail = (msg) => { failures += 1; console.log(`FAIL ${msg}`); };
const ok = (msg) => console.log(`OK   ${msg}`);

const keys = Object.keys(values);
if (keys.length < 10) fail(`lib/palette.ts parsed only ${keys.length} colours`);
for (const k of keys) {
  if (!vars[k]) fail(`T.${k} has no CSS_VAR entry`);
  else if (cssVals[vars[k]] !== values[k]) fail(`T.${k} ${values[k]} but ${vars[k]} is ${cssVals[vars[k]] ?? 'missing'} in globals.css`);
}
if (!failures) ok(`lib/palette.ts and globals.css agree on all ${keys.length} colours`);

const files = [];
const walk = (d) => {
  for (const n of readdirSync(join(root, d))) {
    if (['node_modules', '.next', '.git', 'public'].includes(n)) continue;
    const p = join(d, n);
    if (statSync(join(root, p)).isDirectory()) walk(p);
    else if (/\.(tsx?|mjs)$/.test(n)) files.push(p);
  }
};
for (const d of ['app', 'components', 'lib']) walk(d);

const tokenHex = new Set(Object.values(values));
let inline = 0; const inlineFiles = new Map();
const palettes = [];
for (const f of files) {
  if (EXEMPT.has(f)) continue;
  const s = read(f);
  // An object literal holding three or more colours is a palette.
  for (const m of s.matchAll(/\{([^{}]*)\}/g)) {
    const n = (m[1].match(/:\s*'#[0-9a-f]{3,8}'/gi) ?? []).length;
    if (n >= 3) { palettes.push(f); break; }
  }
  const hits = (s.match(/#[0-9a-f]{6}\b/gi) ?? []).filter((h) => tokenHex.has(h.toLowerCase())).length;
  if (hits) { inline += hits; inlineFiles.set(f, hits); }
}
if (palettes.length) fail(`a screen declares its own palette again: ${palettes.join(', ')} — import { T } from '@/lib/palette'`);
else ok(`no screen declares its own palette (${files.length - EXEMPT.size + 1} files checked)`);

// ---------------------------------------------------------------------------
// THE SURFACE STACK AND THE CONTRAST FLOORS (28 Sep).
//
// WCAG relative luminance, straight from the spec. Every ratio below is
// computed from the token hexes, so it is exact arithmetic about what the
// product renders, not a judgement about how it feels.
// ---------------------------------------------------------------------------
const chan = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const r2 = (n) => n.toFixed(2);

// THE LADDER. The rule the charter half-wrote and this makes enforceable:
// DISCLOSURE GOES DOWN, ACTION GOES UP. The page is the datum, a well you read
// sits below the card it is in, a control you act on sits above it, and the
// hairline does the elevation work — no shadow, no glow.
//
// "Sunken" cannot mean darker than the page: --bg #0b120e is 1.107:1 off pure
// black, so there is no room underneath it. Every level goes up from the page
// and sunken means below the CARD, which is the only place .card-sunken is
// ever used.
//
// The floor is 1.10 per step. Below about 1.10 a surface step is not a step:
// the eye reads the hairline and nothing else, which is what "the app looks
// flat" has meant all along. It FAILS on the old values (1.039, 1.038, 1.103).
const LADDER = [
  ['--bg', '--surface-sunken', 1.10, 'a well is a step above the page'],
  ['--surface-sunken', '--surface', 1.10, 'a card is a step above a well'],
  ['--surface', '--surface-2', 1.10, 'a control is a step above the card'],
];
for (const [below, above, floor, why] of LADDER) {
  const got = ratio(cssVals[below], cssVals[above]);
  if (got < floor) fail(`stack: ${below} -> ${above} is ${r2(got)}:1, under the ${floor} floor — ${why}`);
}
const card = ratio(cssVals['--bg'], cssVals['--surface']);
const well = ratio(cssVals['--surface'], cssVals['--surface-sunken']);
if (card < 1.20) fail(`stack: a card reads ${r2(card)}:1 against the page; a card must read as an object (1.20 floor)`);
if (well < 1.10) fail(`stack: a well reads ${r2(well)}:1 inside its card (1.10 floor) — .card-sunken is the level nobody adopted because it looked like nothing`);
if (!failures) ok(`the surface stack is visible: card ${r2(card)}:1 on the page, well ${r2(well)}:1 in the card, steps ${LADDER.map(([b, a]) => r2(ratio(cssVals[b], cssVals[a]))).join(' · ')}`);

// THE HAIRLINE. It is the elevation, so it has to be seen on every surface it
// borders. 1.25 is the visibility it already had against a card (1.31) with
// rounding room, not a new ambition.
for (const sfc of ['--bg', '--surface-sunken', '--surface', '--surface-2']) {
  const got = ratio(cssVals['--line'], cssVals[sfc]);
  if (got < 1.25) fail(`hairline: --line is ${r2(got)}:1 on ${sfc}, under 1.25 — the border is what does the elevation work here`);
}

// NO SHADOW, NO GLOW. The stack earns its depth from the surface step plus the
// hairline. A resting shadow on a card would be a second, contradictory
// elevation system and it renders as mud on a dark page.
for (const cls of ['.card', '.card-sunken']) {
  const rule = new RegExp(`\\${cls} +\\{[^}]*\\}`).exec(css)?.[0] ?? '';
  if (/box-shadow/.test(rule)) fail(`${cls} carries a box-shadow — the hairline and the surface step are the elevation`);
}

// A HOVER GOES UP. The interaction layer's two tokens sit a step above the
// resting surface and the resting hairline. Not a nicety: the three literals
// they replaced were chosen against the old surfaces and every one of them
// ended up DARKER than the surface it sits on, so pointing at a button would
// have dimmed it.
for (const [state, resting] of [['--surface-hover', '--surface-2'], ['--line-hover', '--line']]) {
  if (!cssVals[state]) { fail(`hover: ${state} is missing from globals.css :root`); continue; }
  const got = ratio(cssVals[state], cssVals[resting]);
  if (lum(cssVals[state]) <= lum(cssVals[resting])) fail(`hover: ${state} ${cssVals[state]} is DARKER than ${resting} ${cssVals[resting]} — a hover goes up`);
  else if (got < 1.08) fail(`hover: ${state} is ${r2(got)}:1 from ${resting}, which nobody will see`);
  else ok(`a hover goes up: ${state} is ${r2(got)}:1 above ${resting}`);
}

// THE TEXT FLOORS, by role, on every surface the product paints behind text.
//   ink / secondary / muted   4.5  — WCAG AA for small text, and all three
//                                    carry body copy and 10-12px captions.
//   accent / amber            4.5  — both carry small bold labels and counts.
//   purple / red / placeholder 3.0 — see the note below. Not a lower standard
//                                    chosen for convenience: 4.5 is
//                                    arithmetically unreachable for two of
//                                    them anywhere in a dark theme.
// #e34948 (--red) reaches at most 4.31:1 on PURE BLACK and #6b7d73
// (--placeholder) at most 4.81:1, so neither can hold AA on any Night Match
// surface; both are carried at 3.0 and named in the 28 Sep handoff as a
// decision for BUZ (lift the hue, or keep it and know). --purple holds 4.5 on
// the page and the sunken well and 4.04 on --surface-2, which the 28 Sep
// surface change caused; also in the handoff.
const FLOOR = { ink: 4.5, secondary: 4.5, muted: 4.5, accent: 4.5, amber: 4.5, purple: 3.0, red: 3.0, placeholder: 3.0 };
const SURFACES = ['bg', 'sunken', 'surface', 'surface2'];
const rows = [];
for (const [t, floor] of Object.entries(FLOOR)) {
  const line = [];
  for (const sfc of SURFACES) {
    const got = ratio(values[t], values[sfc]);
    line.push(`${sfc} ${r2(got)}`);
    if (got < floor) fail(`contrast: T.${t} on T.${sfc} is ${r2(got)}:1, under its ${floor} floor`);
  }
  rows.push(`  ${t.padEnd(12)} floor ${floor}  ${line.join('  ')}`);
}
const onAccent = ratio(values.onAccent, values.accent);
if (onAccent < 4.5) fail(`contrast: T.onAccent on T.accent is ${r2(onAccent)}:1 — that is every primary button's label`);
console.log(`info contrast, every token pair the product paints text on (${r2(onAccent)}:1 on the accent button):`);
for (const r of rows) console.log(r);

const top = [...inlineFiles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f, n]) => `${relative('.', f)} ${n}`);
console.log(`info ${inline} token colours still written as raw hex (next layer): ${top.join(' · ')}`);
// ---- no token is declared twice in one block -------------------------------
// On 28 Sep --hero was re-pitched (BUZ) and this check stayed green while the
// OLD value kept rendering everywhere: the new declaration sat at the top of
// :root and the charter's original was still twenty lines further down in the
// same block, and in CSS the LATER declaration wins. Every colour measurement
// above read the new value and was right about it; the page was drawing the
// other one. A value that is correct and not the one in force is the worst
// kind of green, so declaring a custom property twice in one rule is a failure.
{
  const cssSrc = read('app/globals.css').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of cssSrc.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().split('\n').pop().trim();
    const seen = new Map();
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:/g)) {
      seen.set(d[1], (seen.get(d[1]) ?? 0) + 1);
    }
    for (const [name, n] of seen) {
      if (n > 1) fail(`${name} is declared ${n} times in \`${sel}\` — only the last one renders, whatever this check measured above`);
    }
  }
}

// ---- a section label is tracked at 0.14em -----------------------------------
// The charter: "Section labels: 11px, 800, uppercase, letter-spacing 0.14em".
// .kicker is the section label, and on 28 Sep it resolved to --ls-label,
// 0.06em — the light-caps value — so every section label drawn with the
// class was tracked at the wrong one of the five values, and nothing here
// looked at letter-spacing at all. Any rule in globals.css with the section
// label's shape must RESOLVE (through :root) to 0.14em, and .kicker must be
// one of them, so removing the class cannot make this pass.
{
  const cssSrc = read('app/globals.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const rootDecls = Object.fromEntries([...(cssSrc.match(/:root\s*\{([^{}]*)\}/)?.[1] ?? '')
    .matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const resolve = (v) => { let x = (v ?? '').trim(), n = 0;
    while (/^var\((--[\w-]+)\)$/.test(x) && n++ < 5) x = (rootDecls[x.match(/^var\((--[\w-]+)\)$/)[1]] ?? '').trim();
    return x; };
  const shaped = [];
  for (const m of cssSrc.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const body = m[2];
    if (/font-size:\s*11px/.test(body) && /font-weight:\s*800/.test(body) && /text-transform:\s*uppercase/.test(body)) {
      shaped.push({ sel: m[1].trim().split('\n').pop().trim(), ls: resolve(body.match(/letter-spacing:\s*([^;]+)/)?.[1]) });
    }
  }
  const wrong = shaped.filter((r) => r.ls !== '0.14em');
  if (!shaped.some((r) => r.sel === '.kicker')) fail('.kicker is not in globals.css with the section label\u2019s shape (11px, 800, uppercase)');
  else if (wrong.length) for (const r of wrong) fail(`\`${r.sel}\` is a section label (11px/800/uppercase) tracked at ${r.ls || 'nothing'} — the charter says 0.14em`);
  else ok(`section labels: ${shaped.length} rule(s) with the charter\u2019s shape, every one at 0.14em (${shaped.map((r) => r.sel).join(', ')})`);
}

// D-147 constraint 3, on the Floodlit nav (safety review M1, 1 Oct): the
// nav's links are the way to Find your club and Trials, so no width may hide
// them. Any rule that sets .fl-nav-links to display:none fails here.
{
  const hidden = [...css.matchAll(/([^{}]*\.fl-nav-links[^{}]*)\{([^}]*)\}/g)].filter((m) => /display\s*:\s*none/.test(m[2]));
  if (hidden.length) fail(`nav: .fl-nav-links is hidden by "${hidden[0][1].trim()}" — the same links at every width (D-147)`);
  else ok('nav: the Floodlit nav links are never hidden at any width (D-147)');
}

console.log(failures ? `\n${failures} failed` : '\nALL GREEN');
process.exit(failures ? 1 : 0);
