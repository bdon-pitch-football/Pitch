// Doc 14 coverage: which enumerated rows the suite actually pins.
//
// The gate is "doc 14 green" (D-47, D-131), and green means every enumerated
// case is asserted — so the count has to be measurable rather than claimed.
// This reads the spec and the suite and reports the difference.
//
// Three things it has to understand, each of which caused a wrong number
// before it did:
//   · combined labels — 'C3/C4: ...' pins two rows
//   · template-literal labels — check(`N6: ... ${x}`) inside a loop
//   · John's rulings (doc 31) are labelled U-1, U-2, U-5 and so on, and
//     those are what pin the rows doc 14 left unruled
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The repo carries its own copy of doc 14 (docs/), which is what CI has. The
// working folder's copy is the fallback.
const specPath = [
  fileURLToPath(new URL('../docs/14-Permission-Tests.md', import.meta.url)),
  fileURLToPath(new URL('../../14-Permission-Test-Spec.md', import.meta.url)),
].find((p) => existsSync(p));
if (!specPath) { console.error('doc 14 not found'); process.exit(1); }
const spec = readFileSync(specPath, 'utf8');
// The permission suite, and the timing suite (28 Sep): doc 14 §K conditions 3,
// 7 and 10 — E10, L40, J61 — are timing measurements against the running app,
// and until then they were "pinned" here by structural checks in the
// permission suite that tested something else under their labels (L4). Those
// checks keep their place under their own names; the rows are pinned only by
// the suite that measures them. A pinned row is a row with a test; whether the
// test passes is that suite's answer, not this script's.
const suite = ['./permission-tests.mjs', './timing-tests.mjs']
  .map((f) => readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8')).join('\n');

const ids = new Set([...spec.matchAll(/^\| ([A-Z]{1,2}\d+[a-z]?) \|/gm)].map((m) => m[1]));

// A ruling in doc 31 is what answers a row doc 14 declined to answer.
const RULED = { 'U-1': ['L16'], 'U-2': ['L17'], 'U-3': ['L43'], 'U-5': ['L58'], 'U-6': ['L60'], 'U-11': ['L27'] };

const labels = [...suite.matchAll(/(?:check|expectFail)\(\s*(?:'([^']+)'|`([^`]+)`)/g)]
  .map((m) => m[1] ?? m[2]);

const pinned = new Set();
for (const label of labels) {
  for (const tok of label.split(':')[0].split(/[/,\s]+/)) {
    if (ids.has(tok)) pinned.add(tok);
    else {
      const base = /^([A-Z]{1,2}\d+)/.exec(tok)?.[1];
      if (base && ids.has(base)) pinned.add(base);
    }
    for (const [ruling, rows] of Object.entries(RULED)) {
      if (tok.startsWith(ruling)) rows.forEach((r) => ids.has(r) && pinned.add(r));
    }
  }
}

const open = [...ids].filter((r) => !pinned.has(r)).sort();
console.log(`doc 14 enumerated rows: ${ids.size}`);
console.log(`pinned by the suite:    ${pinned.size}`);
console.log(`open:                   ${open.length}${open.length ? '  ' + open.join(' ') : ''}`);
process.exit(open.length === 0 ? 0 : 1);
