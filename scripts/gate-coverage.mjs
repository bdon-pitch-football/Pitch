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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const spec = readFileSync(fileURLToPath(new URL('../../14-Permission-Test-Spec.md', import.meta.url)), 'utf8');
const suite = readFileSync(fileURLToPath(new URL('./permission-tests.mjs', import.meta.url)), 'utf8');

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
