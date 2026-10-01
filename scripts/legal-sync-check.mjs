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
// And doc 15 (John, 1 Oct), the other document the code must match, which
// lives outside docs/legal/: the root's `15-Message-Copy.md` against the app's
// `docs/15-Message-Copy.md`, by the version in each one's footer, under the
// same two rules — never older, and never different words under the same
// version. Its root copy sits beside the root `legal/` folder.
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

// Doc 15. Its version is the newest `*vX.Y` that opens a footer line (v1.1's
// note and v1.2's footer stay in the file as history). A root copy that does
// not exist is a problem, not a pass: the check would otherwise say "may go
// ahead" about a file it never read.
const DOC15_APP = fileURLToPath(new URL('../docs/15-Message-Copy.md', import.meta.url));
const DOC15_ROOT = join(ROOT, '..', '15-Message-Copy.md');
const doc15Version = (text) => [...text.matchAll(/^\*v(\d+)\.(\d+)\b/gm)]
  .map((m) => [Number(m[1]), Number(m[2])]).sort(cmp).pop();
if (!existsSync(DOC15_ROOT)) problems.push(`15-Message-Copy.md: no root copy at ${DOC15_ROOT}`);
else {
  const rootText = readFileSync(DOC15_ROOT, 'utf8'), appText = readFileSync(DOC15_APP, 'utf8');
  const r = doc15Version(rootText), a = doc15Version(appText);
  if (!r || !a) problems.push(`15-Message-Copy.md: no version footer in the ${!r ? 'root' : 'app'} copy`);
  else if (cmp(r, a) < 0) problems.push(`15-Message-Copy.md: the root copy says ${show(r)}, older than the app's ${show(a)}`);
  else if (rootText !== appText && cmp(r, a) === 0) problems.push(`15-Message-Copy.md: its text differs from the app's under the same version (${show(r)}) — either the root copy is behind (bring the app's copy down first) or its words changed without a new version`);
}

if (problems.length === 0) {
  console.log(`legal sync check · ${rootV.size} register rows, every shared file and doc 15 compared · the root is not behind the app: the sync may go ahead`);
  process.exit(0);
}
console.log(`legal sync check · REFUSED — ${problems.length} problem${problems.length === 1 ? '' : 's'}. Do not copy anything into repo/docs/legal or repo/docs/15-Message-Copy.md:`);
for (const p of problems) console.log(`  ✗ ${p}`);
process.exit(1);
