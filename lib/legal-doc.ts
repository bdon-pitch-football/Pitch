// What a legal page SERVES, as against what docs/legal HOLDS.
//
// Every document in docs/legal opens with the drafting preamble: the version
// history, what changed and why, what is not built yet, what BUZ has not
// numbered. It is the record of how the document got here — doc 20's own
// preamble is the reason it is retained — so nothing in this file edits the
// source. Until now every legal surface served it: 1,294 words on /privacy
// before the policy spoke, and the same block inside the guardian approval
// flow (doc 32 B3), where the first thing a parent read while deciding whether
// to trust us with their child was that the policy they were being asked to
// accept was not published and that some of our work had been lost.
//
// WHAT THIS FILE DOES NOT DECIDE. This changes what /privacy serves, and the
// legal register is explicit on both of the questions that follow from that:
// whether a change is material, and therefore whether a guardian is re-asked,
// is JOHN'S call and the register records it; and the consent version is
// bumped in the same commit that changes what /privacy serves. Neither has
// been done here. No version is bumped in this commit and nothing in this
// comment is a ruling that one is unnecessary — see the 28 Sep builder report.
//
// Two things have to hold together, or the page is wrong in the other
// direction: strip the preamble and NOTHING else, and keep the document's
// identity on screen. Consent is stamped `20@v2.7`, so the version is the
// legally load-bearing fact; a policy with no version is worse than one with a
// preamble. The version comes from the legal register at render time — the
// same answer that goes on a consent row — and its date from the document. If
// either cannot be resolved we throw, because a legal page that silently
// renders no version is this bug wearing different clothes.
import fs from 'node:fs';
import path from 'node:path';

const MONTH = 'January|February|March|April|May|June|July|August|September|October|November|December';

const legalDir = () => path.join(process.cwd(), 'docs', 'legal');

/**
 * The register's "Rendered in the product" table: doc number → current version.
 * That table only. The internal table below it carries versions too, and a
 * specification's version is not a published document's.
 */
export function renderedVersions(registerMd: string): Map<string, string> {
  const start = registerMd.indexOf('**Rendered in the product:**');
  if (start === -1) throw new Error('legal register: no "Rendered in the product" table');
  const end = registerMd.indexOf('**Internal', start);
  const rows = new Map<string, string>();
  for (const line of registerMd.slice(start, end === -1 ? undefined : end).split('\n')) {
    const m = /^\|\s*\*\*(\d+)\*\*\s*\|[^|]*\|\s*\*\*(v\d+\.\d+)\*\*\s*\|/.exec(line);
    if (!m) continue;
    const seen = rows.get(m[1]);
    // Two versions for one document is how 7 September happened.
    if (seen && seen !== m[2]) throw new Error(`legal register: doc ${m[1]} is listed at ${seen} and ${m[2]}`);
    rows.set(m[1], m[2]);
  }
  if (rows.size === 0) throw new Error('legal register: the rendered-document table has no rows');
  return rows;
}

/** The current version of one document, e.g. "v2.7". Read at render time, so a
 *  bump in the register reaches the page without a code change. */
export function registeredVersion(doc: string): string {
  const reg = fs.readFileSync(path.join(legalDir(), '00-Legal-Register.md'), 'utf8');
  const v = renderedVersions(reg).get(doc);
  if (!v) throw new Error(`legal register has no version for doc ${doc}`);
  return v;
}

/** Every document the register lists as rendered in the product. */
export function renderedLegalDocs(): { doc: string; version: string }[] {
  const reg = fs.readFileSync(path.join(legalDir(), '00-Legal-Register.md'), 'utf8');
  return [...renderedVersions(reg)].map(([doc, version]) => ({ doc, version }));
}

/**
 * Where a document's head ends: the title, and the one subtitle heading docs
 * 24 and 25 carry under it. Everything from here on is the document itself.
 *
 * A single H3–H6 subtitle, and no more. An H2 is a section — it ends the head —
 * and a second heading means we have walked into the body, which would let a
 * blockquote of real content look like a preamble.
 */
function headEnd(lines: string[]): number {
  let i = 1, subtitles = 0;
  while (i < lines.length) {
    if (lines[i].trim() === '') { i++; continue; }
    if (subtitles === 0 && /^#{3,6}\s+\S/.test(lines[i])) { subtitles++; i++; continue; }
    break;
  }
  return i;
}

/**
 * Strip the drafting preamble, and only that.
 *
 * A preamble is a contiguous run of markdown blockquote lines in the
 * document's HEAD — after the title and its optional subtitle, with nothing
 * else before it — together with the thematic break that closes it, because a
 * page should not open with a horizontal rule under its title.
 *
 * A blockquote anywhere else is content and is left alone: doc 22's Schedule A
 * opens with one and doc 25 quotes itself twice in Part 4. On a document whose
 * head holds no such run this returns the markdown unchanged, byte for byte.
 */
export function stripDraftingPreamble(markdown: string): string {
  const lines = markdown.split('\n');
  // No title, no head. We do not guess where a document begins.
  if (!/^#\s+\S/.test(lines[0] ?? '')) return markdown;
  const from = headEnd(lines);
  if (!lines[from]?.startsWith('>')) return markdown;
  let i = from;
  while (i < lines.length && lines[i].startsWith('>')) i++;
  let to = i; // exclusive
  let j = i;
  while (j < lines.length && lines[j].trim() === '') j++;
  if (j < lines.length && /^-{3,}\s*$/.test(lines[j])) to = j + 1;
  lines.splice(from, to - from);
  // Whatever the preamble left behind, one blank line where it stood.
  while (lines[from - 1]?.trim() === '' && lines[from]?.trim() === '') lines.splice(from, 1);
  return lines.join('\n');
}

/**
 * The date the document itself gives for a version — from its change log or
 * its footer. The register says which version is current; the document says
 * when that version was written. If the document dates one version twice and
 * differently, we do not choose between them.
 */
export function publishedDate(markdown: string, version: string, doc = '?'): string {
  const re = new RegExp(
    `${version.replace(/\./g, '\\.')}(?:\\s+draft)?\\s*[,·]\\s*(\\d{1,2} (?:${MONTH}) \\d{4})`, 'g');
  const dates = [...new Set([...markdown.matchAll(re)].map((m) => m[1]))];
  if (dates.length === 0) throw new Error(`doc ${doc}: the document gives no date for ${version}`);
  if (dates.length > 1) throw new Error(`doc ${doc}: ${version} is dated ${dates.join(' and ')}`);
  return dates[0];
}

// ---------------------------------------------------------------------------
// What a clause marker means on a served page (brief J, 29 Sep).
//
// John drafts in the open. A finished clause carries [DRAFTED]; a position
// nobody has written yet carries [OUTLINE]; a question for counsel sits inside
// the clause as [LEGAL: doc 18 Qn …]; a clause describing something that has
// not been operated carries [DO NOT PUBLISH UNTIL BUILT]. Doc 37 asked him what
// a page does with each. He answered item 1 only, so its "if you say nothing"
// column is what these rules carry out:
//
//   item 2 · [DRAFTED] labels finished text: the label goes, the clause stays.
//   item 3 · [DO NOT PUBLISH UNTIL BUILT]: the clause is not served until he
//            ticks it, and the marker comes off in the source when he does.
//   item 4 · [OUTLINE]: not served. The Terms never promise what isn't written.
//   item 6 · [LEGAL: …]: the question goes and the clause stays — except the
//            two he would hold, the $2,000 floor and the five-year period.
//
// The source keeps every marker, as it keeps the preamble: it is the record of
// what is still open with counsel. Nothing here rewords a clause. Every rule
// REMOVES, and every removal that is not a marker is named in WITHHELD by its
// exact words, so a rule can never reach text nobody listed. If a named clause
// cannot be found exactly once — because John has since edited it — we throw
// rather than serve it: a hold that silently lapses is a published clause.
//
// Brief K (29 Sep) adds three things, and none of them is a rewording:
//   · the Terms' internal references — D-numbers, "not Phase 1", "for the
//     build" — go by their exact words, like any other drafting note;
//   · where a named removal leaves "()" or a double space behind, that line is
//     tidied, and where it took the full stop that ended a sentence, the full
//     stop comes back (`stop`). Nothing else on the line moves;
//   · doc 25 is served at last (/report/policy), and its own footer says "Part
//     1 is public, Parts 2–5 are internal". So Parts 2–5 are withheld whole
//     ('rest'), and the footer that says so stays.
// ---------------------------------------------------------------------------

/** The label, the bold around it when it is bolded alone, and the one space after it. */
const DRAFTED_LABEL = /\*\*\[DRAFTED\]\*\* |\[DRAFTED\] /g;
/** A counsel question, bold or not, with the one space or em dash that hangs it on the clause. */
const LEGAL_NOTE = /(?: —)? ?(\*\*)?\[LEGAL\b[^\]]*\]\1(?: —(?= ))?/g;
/** A clause that is not served at all while it carries one of these. */
const UNSERVED = /\[OUTLINE\]|\[DO NOT PUBLISH\b[^\]]*\]/;
/** Anything left of a marker after the rules have run. */
const ANY_MARKER = /\[DRAFTED\]|\[OUTLINE\]|\[LEGAL\b|\[DO NOT PUBLISH\b/;
const RULE = /^-{3,}\s*$/;

/** What a named removal leaves behind on its own line, and nothing else: an
 *  empty "()" with the space before it, and a run of spaces inside the line.
 *  Only ever run on a line a 'words' cut has just touched. */
export const tidyCut = (line: string) =>
  line.replace(/ ?\(\s*\)/g, '').replace(/(\S) {2,}(?=\S)/g, '$1 ');

export type Withheld = {
  doc: string;
  /** 'line': the one line opening with `text` — the whole blockquote, if it
   *  opens one. 'section': the heading opening with `text`, to the next rule
   *  or heading of its rank. 'words': exactly `text`, cut from its line.
   *  'rest': the heading opening with `text`, and everything after it up to
   *  the document's closing rule; the rule and the footer under it stay. */
  cut: 'line' | 'section' | 'words' | 'rest';
  text: string;
  /** held: John's default holds it (doc 37 item 6). drafting: a note about
   *  the document, like the preamble (brief J item 5), or a reference to our
   *  own working papers (brief K item 3). unwritten: a clause whose words are
   *  not yet written (doc 37 item 4, by its reasoning). internal: a part the
   *  document itself says is not public (brief K item 2). */
  why: 'held' | 'drafting' | 'unwritten' | 'internal';
  /** 'words' only: the cut took the full stop that ended its sentence, and
   *  the sentence gets it back. */
  stop?: true;
};

export const WITHHELD: readonly Withheld[] = [
  // Doc 37 item 6, held by default: the five-year record period (doc 18 Q6).
  { doc: '22', cut: 'words', why: 'held', text: ' We keep records of reports and what we did about them for five years.' },
  // Doc 37 item 6, held by default: the $2,000 liability floor (doc 18 Q11).
  { doc: '22', cut: 'line', why: 'held', text: '- **(b) For everything else**, our aggregate liability is limited to the greater of' },
  // 4.3's first sentence is a placeholder pointing at 6.4, an [OUTLINE] that
  // item 4 takes off the page. The rest of 4.3 is written and stays.
  { doc: '22', cut: 'words', why: 'unwritten', text: 'Where Pitch records that a coach holds a Working With Children Check, that record is [description under legal review — see 6.4]. ' },
  { doc: '22', cut: 'line', why: 'drafting', text: '*Note: this was open at v1.0 and is now settled by the register' },
  { doc: '22', cut: 'words', why: 'drafting', text: ' *(Reconciles 7.4, Schedule A9 and doc 20, which said different things at v1.0. This states the deletion case; A9 states the leaving case. Both trace to D-48 and D-26.)*' },
  { doc: '22', cut: 'line', why: 'drafting', text: '> **What is on sale, and what is not.**' },
  { doc: '22', cut: 'line', why: 'drafting', text: '*Why the wording changed at v1.9:' },
  { doc: '22', cut: 'line', why: 'drafting', text: '*The figures that stood here — $54 a month, or $329 for twelve months — are history' },
  { doc: '22', cut: 'section', why: 'drafting', text: '## Open items summary' },
  { doc: '22', cut: 'words', why: 'drafting', text: " · for legal review · revised on Leo's entity-and-GST brief and reconciled to register v4.1 (D-148, D-109 as amended)" },
  // Brief K item 3: references to our own working papers, inside clauses that
  // stay. The register's D-numbers mean nothing to a reader and are not ours
  // to cite at them; "Phase 1" and "the build" are how we plan, not terms.
  { doc: '22', cut: 'words', why: 'drafting', text: 'Reference table for the build' },
  { doc: '22', cut: 'words', why: 'drafting', text: ' (D-64)' },
  { doc: '22', cut: 'words', why: 'drafting', text: ' (D-51)' },
  { doc: '22', cut: 'words', why: 'drafting', text: ' (D-149)' },
  { doc: '22', cut: 'words', why: 'drafting', text: ' and it is not Phase 1' },
  { doc: '22', cut: 'words', why: 'drafting', text: ' (reference for the build)' },
  // 2.3's counsel question called its last sentence "a proposed addition, not
  // current behaviour". It is current behaviour: a 16–17 cannot sign up
  // without a parent's mobile and address (app/join/actions.ts, D-155/D-157).
  // Named here rather than left to the [LEGAL] rule, because the note ended
  // the sentence and the sentence needs its full stop back.
  { doc: '22', cut: 'words', why: 'drafting', stop: true, text: ' — **[LEGAL: doc 18 Q5. This last sentence is a proposed addition, not current behaviour.]**' },
  // Doc 25's five-year period, in Part 4. Part 4 is withheld as internal
  // below (brief K), and these stay named anyway: the day Part 4 is made
  // public, the period is still off it until John says otherwise.
  { doc: '25', cut: 'line', why: 'held', text: '| Report received: what, when, from whom (or that it was anonymous) | 5 years |' },
  { doc: '25', cut: 'line', why: 'held', text: '| Decision, action taken, who took it, when | 5 years |' },
  { doc: '25', cut: 'line', why: 'held', text: '**The tension, named:** five years of records about children' },
  // Brief K item 2: doc 25 is served at /report/policy, and its footer says
  // "Part 1 is public, Parts 2–5 are internal". Parts 2–5 are how the inbox is
  // run — triage classes, what is still a gap before launch, what an
  // investigator may open — and the document does not publish them.
  { doc: '25', cut: 'rest', why: 'internal', text: '# Part 2 — How this actually runs' },
];

/**
 * Apply the marker rules and the named removals to a document whose preamble
 * has already gone. A document with nothing to withhold comes back byte for
 * byte — which is what keeps the consent hashes of docs 20 and 21 where they
 * were.
 */
export function withholdUnpublished(doc: string, markdown: string): string {
  const lines = markdown.split('\n');
  const one = (hit: (l: string) => boolean, text: string) => {
    const at = lines.flatMap((l, i) => (hit(l) ? [i] : []));
    if (at.length !== 1) throw new Error(`doc ${doc}: "${text.slice(0, 48)}…" is withheld and is in the document ${at.length} times, not once`);
    return at[0];
  };
  const drop = new Set<number>();
  for (const w of WITHHELD.filter((x) => x.doc === doc)) {
    if (w.cut === 'words') {
      const i = one((l) => l.includes(w.text), w.text);
      if (lines[i].split(w.text).length !== 2) throw new Error(`doc ${doc}: "${w.text.slice(0, 48)}…" is withheld and appears twice in one line`);
      lines[i] = tidyCut(lines[i].replace(w.text, w.stop ? '.' : ''));
    } else if (w.cut === 'rest') {
      const i = one((l) => l.startsWith(w.text), w.text);
      if (!/^#+\s/.test(lines[i])) throw new Error(`doc ${doc}: "${w.text}" is withheld to the footer and is not a heading`);
      // The closing rule is the one with nothing under it but the footer: one
      // italic line. Anything else under the last rule means we cannot tell
      // where the document's own text ends, and we do not guess.
      const end = lines.findLastIndex((l) => RULE.test(l));
      const under = lines.slice(end + 1).filter((l) => l.trim() !== '');
      if (end <= i || under.length !== 1 || !/^\*[^*].*\*$/.test(under[0])) {
        throw new Error(`doc ${doc}: "${w.text}" is withheld to the footer and no closing rule and footer follow it`);
      }
      for (let j = i; j < end; j++) drop.add(j);
    } else if (w.cut === 'line') {
      const i = one((l) => l.startsWith(w.text), w.text);
      drop.add(i);
      if (lines[i].startsWith('>')) for (let j = i + 1; j < lines.length && lines[j].startsWith('>'); j++) drop.add(j);
    } else {
      const i = one((l) => l.startsWith(w.text), w.text);
      const rank = /^(#+)\s/.exec(lines[i])?.[1].length;
      if (!rank) throw new Error(`doc ${doc}: "${w.text}" is withheld as a section and is not a heading`);
      drop.add(i);
      for (let j = i + 1; j < lines.length; j++) {
        const h = /^(#+)\s/.exec(lines[j]);
        if (RULE.test(lines[j]) || (h && h[1].length <= rank)) break;
        drop.add(j);
      }
    }
  }
  // A clause carrying [OUTLINE] or [DO NOT PUBLISH …] goes whole, with the
  // italic note hanging under it (6.5's "Status: not built" is its own).
  lines.forEach((l, i) => {
    if (!UNSERVED.test(l)) return;
    drop.add(i);
    if (/^(- |\||>)/.test(l)) return;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() === '') continue;
      if (!/^\*[^*]/.test(lines[j])) break;
      drop.add(j);
    }
  });

  // Where something went, one blank line and one rule where two met — and
  // only there, so a document nothing was taken from is not touched at all.
  const out: string[] = [];
  let seam = false;
  lines.forEach((l, i) => {
    const kept = drop.has(i) ? '' : l.replace(LEGAL_NOTE, '').replace(DRAFTED_LABEL, '');
    if (drop.has(i) || (kept !== l && kept.trim() === '')) { seam = true; return; }
    if (seam && kept.trim() === '' && out.at(-1)?.trim() === '') return;
    if (seam && RULE.test(kept) && RULE.test(out.findLast((x) => x.trim() !== '') ?? '')) return;
    if (kept.trim() !== '') seam = false;
    out.push(kept);
  });
  const served = out.join('\n');
  const left = ANY_MARKER.exec(served);
  if (left) throw new Error(`doc ${doc}: a clause marker survived the render rules: ${served.slice(left.index, left.index + 60)}`);
  return served;
}

/** The one line of text the renderer adds to a legal document. */
export const versionLine = (version: string, date: string) =>
  `*Version ${version.replace(/^v/, '')} · ${date}*`;

export type RenderedLegalDoc = { doc: string; version: string; date: string; markdown: string };

/** A document's own title, as a link to it says it (brief K item 2): its
 *  heading, without the "PITCH — " every document in docs/legal opens with. */
export function documentTitle(file: string): string {
  const head = legalDocument(file).markdown.split('\n')[0];
  const m = /^#\s+(?:PITCH\s+—\s+)?(.+?)\s*$/.exec(head);
  if (!m) throw new Error(`${file}: the document has no title`);
  return m[1];
}

/** A legal document as it is served: no drafting preamble, no clause marker
 *  and nothing WITHHELD, its version and date under the title, and every
 *  clause that stays exactly as published. */
export function legalDocument(file: string): RenderedLegalDoc {
  const doc = /^(\d+)-/.exec(file)?.[1];
  if (!doc) throw new Error(`not a legal document filename: ${file}`);
  const raw = fs.readFileSync(path.join(legalDir(), file), 'utf8');
  const version = registeredVersion(doc);
  // Read from the raw file: for doc 22 the only date for the current version
  // is in the change log, which is the block we are about to strip.
  const date = publishedDate(raw, version, doc);
  const lines = withholdUnpublished(doc, stripDraftingPreamble(raw)).split('\n');
  lines.splice(headEnd(lines), 0, versionLine(version, date), '');
  return { doc, version, date, markdown: lines.join('\n') };
}
