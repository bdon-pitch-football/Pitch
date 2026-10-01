// Refuses a legal sync that would go backwards (John, 1 Oct: "Being careful is
// not a control; a check that refuses the sync is"). Run it BEFORE copying any
// file from the root `legal/` folder into `repo/docs/legal/`:
//
//   node scripts/legal-sync-check.mjs            # from repo/
//
// It compares the two copies of the legal register (doc 00) row by row, and
// every document that exists in both places:
//   · a document's version in the root register may never be OLDER than the
//     app's — that is the 30 Sep and 1 Oct failure, twice;
//   · a document whose text differs between the two must carry a NEWER
//     version in the root register — a published version is immutable (doc
//     00), so changed words under the same number are refused too;
//   · and the consent identifiers line may never name an older version.
// Exit 0 means the sync may go ahead; anything else names each file and why.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('../docs/legal/', import.meta.url));
const ROOT = process.env.LEGAL_ROOT ? process.env.LEGAL_ROOT.replace(/\/?$/, '/') : fileURLToPath(new URL('../../legal/', import.meta.url));
if (!existsSync(ROOT)) { console.error(`no root legal folder at ${ROOT}`); process.exit(2); }

const versions = (register) => {
  const out = new Map();
  for (const line of register.split('\n')) {
    const m = /^\|\s*\*\*(\d{2})\*\*\s*\|[^|]*\|\s*\*\*v(\d+)\.(\d+)\*\*/.exec(line);
    if (m) out.set(m[1], [Number(m[2]), Number(m[3])]);
  }
  return out;
};
const cmp = (a, b) => (a[0] - b[0]) || (a[1] - b[1]);
const show = (v) => (v ? `v${v[0]}.${v[1]}` : 'none');
const ids = (register) => new Map([...register.matchAll(/`(\d{2})@v(\d+)\.(\d+)`/g)].map((m) => [m[1], [Number(m[2]), Number(m[3])]]));

const appReg = readFileSync(join(APP, '00-Legal-Register.md'), 'utf8');
const rootReg = readFileSync(join(ROOT, '00-Legal-Register.md'), 'utf8');
const appV = versions(appReg), rootV = versions(rootReg);
const problems = [];

for (const [doc, a] of appV) {
  const r = rootV.get(doc);
  if (!r) problems.push(`doc ${doc}: in the app's register (${show(a)}) but missing from the root's`);
  else if (cmp(r, a) < 0) problems.push(`doc ${doc}: the root register says ${show(r)}, older than the app's ${show(a)}`);
}
for (const [doc, a] of ids(appReg)) {
  const r = ids(rootReg).get(doc);
  if (r && cmp(r, a) < 0) problems.push(`consent identifier ${doc}@: the root says ${show(r)}, older than the app's ${show(a)}`);
}
const appFiles = new Set(readdirSync(APP));
for (const f of readdirSync(ROOT)) {
  if (!appFiles.has(f) || f.startsWith('00-') || !/^\d{2}-.*\.(md|html)$/.test(f)) continue;
  const doc = f.slice(0, 2);
  if (readFileSync(join(ROOT, f), 'utf8') === readFileSync(join(APP, f), 'utf8')) continue;
  const r = rootV.get(doc), a = appV.get(doc);
  if (r && a && cmp(r, a) <= 0) problems.push(`${f}: its text differs from the app's under the same version (${show(r)}) — either the root copy is behind (bring the app's copy down first) or its words changed without a new version`);
}

if (problems.length === 0) {
  console.log(`legal sync check · ${rootV.size} register rows and every shared file compared · the root is not behind the app: the sync may go ahead`);
  process.exit(0);
}
console.log(`legal sync check · REFUSED — ${problems.length} problem${problems.length === 1 ? '' : 's'}. Do not copy anything into repo/docs/legal:`);
for (const p of problems) console.log(`  ✗ ${p}`);
process.exit(1);
