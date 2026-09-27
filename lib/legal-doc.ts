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

/** The one line of text the renderer adds to a legal document. */
export const versionLine = (version: string, date: string) =>
  `*Version ${version.replace(/^v/, '')} · ${date}*`;

export type RenderedLegalDoc = { doc: string; version: string; date: string; markdown: string };

/** A legal document as it is served: no drafting preamble, its version and
 *  date under the title, every clause exactly as published. */
export function legalDocument(file: string): RenderedLegalDoc {
  const doc = /^(\d+)-/.exec(file)?.[1];
  if (!doc) throw new Error(`not a legal document filename: ${file}`);
  const raw = fs.readFileSync(path.join(legalDir(), file), 'utf8');
  const version = registeredVersion(doc);
  // Read from the raw file: for doc 22 the only date for the current version
  // is in the change log, which is the block we are about to strip.
  const date = publishedDate(raw, version, doc);
  const lines = stripDraftingPreamble(raw).split('\n');
  lines.splice(headEnd(lines), 0, versionLine(version, date), '');
  return { doc, version, date, markdown: lines.join('\n') };
}
