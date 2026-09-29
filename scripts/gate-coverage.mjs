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
import { RULINGS } from './rulings.mjs';

// The repo carries its own copy of doc 14 (docs/), which is what CI has. The
// working folder's copy is the fallback.
const specPath = [
  fileURLToPath(new URL('../docs/14-Permission-Tests.md', import.meta.url)),
  fileURLToPath(new URL('../../14-Permission-Test-Spec.md', import.meta.url)),
].find((p) => existsSync(p));
if (!specPath) { console.error('doc 14 not found'); process.exit(1); }
const spec = readFileSync(specPath, 'utf8');
// Every suite that tests a doc 14 row, not only the permission suite (28 Sep).
// Some rows can only be tested against the running app: doc 14 §K conditions
// 3, 7 and 10 — E10, L40, J61 — are timing measurements (timing-tests), and
// E9's identical timing is in the render suite. Until 28 Sep those rows were
// "pinned" here by structural checks in the permission suite that tested
// something else under their labels (L4); those checks keep their place under
// their own names, and the rows are pinned by the suites that measure them.
// A pinned row is a row with a test; whether the test passes is that suite's
// answer, not this script's.
const SUITES = ['./permission-tests.mjs', './render-tests.mjs', './write-tests.mjs', './timing-tests.mjs'];
const suite = SUITES.map((f) => readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8')).join('\n');

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

// A row waiting on BUZ has both versions of its check written, and the
// suites run whichever scripts/rulings.mjs names (brief L). Until it names
// one, the row is open whatever labels exist for it: a check written for a
// ruling nobody has made pins nothing.
const awaiting = Object.entries(RULINGS).filter(([row, r]) => r === 'pending' && ids.has(row)).map(([row]) => row);
for (const row of awaiting) pinned.delete(row);

const open = [...ids].filter((r) => !pinned.has(r)).sort();
console.log(`doc 14 enumerated rows: ${ids.size}`);
console.log(`pinned by the suite:    ${pinned.size}`);
console.log(`open:                   ${open.length}${open.length ? '  ' + open.join(' ') : ''}`);
if (awaiting.length) console.log(`awaiting BUZ's ruling:  ${awaiting.sort().join(' ')} (scripts/rulings.mjs)`);
process.exit(open.length === 0 ? 0 : 1);
