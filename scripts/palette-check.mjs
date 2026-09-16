// Keeps the palette in ONE place (16 Sep). Fails when:
//   1. lib/palette.ts and globals.css :root disagree on any colour, or
//   2. a screen declares its own palette object again.
// Reports (without failing) how many raw token hexes are still written
// inline, which is the next layer of the clean-up.
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

const top = [...inlineFiles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f, n]) => `${relative('.', f)} ${n}`);
console.log(`info ${inline} token colours still written as raw hex (next layer): ${top.join(' · ')}`);
console.log(failures ? `\n${failures} failed` : '\nALL GREEN');
process.exit(failures ? 1 : 0);
