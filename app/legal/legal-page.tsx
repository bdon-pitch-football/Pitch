import { marked } from 'marked';
import { QuietShell } from '@/components/quiet-shell';
import { legalDocument } from '@/lib/legal-doc';
import { T } from '@/lib/palette';

// The privacy policy and terms are served as real pages, not PDFs (doc 29 §7).
// Content comes from docs/legal — the authoritative markdown — through
// lib/legal-doc, which takes off the drafting preamble and puts the version and
// date the register and the document agree on under the title. Every clause,
// heading and sentence is the published text, unaltered.

// One reading template for every legal document (spec H, BUZ 1 Oct): the page
// title's size and spacing (it was 28px; -.015em on a 20px h2 is gone, and
// nothing here is outside the five letter-spacings); a subtitle in secondary;
// the version line as a plain muted label, NOT italic — Archivo has no italic
// file loaded, so every <em> was a faked slant; a second top-level heading as
// a part break; tables in a sunken well that scrolls sideways; the empty
// header row of a key/value table hidden. CSS only: the markup renderLegal
// emits is unchanged (leg-r4, leg-r6), and the <style> stays directly after
// the div. No contents list (HD1: not now). `a.cell-link` is build/full-
// release's (cellLinks(): a link that is the whole of a table cell gets the
// 44px target); the rule is here so the two sides merge as one block.
//
// Brief G, 29 Sep, kept: at 375px a four-column table squeezed its cells to
// 73–117px and a sentence ran eight lines deep, one or two words to a line. A
// cell keeps 150px and the table scrolls sideways inside its own box, which
// a phone does naturally. The layout check's squeeze rule found these.
const LEGAL_CSS = `
        .legal-doc { font-size: 14.5px; color: var(--secondary); font-weight: 500; line-height: 1.65; }
        .legal-doc h1 { font-size: 26px; font-weight: 900; letter-spacing: var(--ls-title); color: var(--ink); line-height: 1.15; margin: 0; }
        .legal-doc h1 ~ h1 { font-size: 22px; margin-top: 40px; padding-top: 28px; border-top: 1px solid var(--line); }
        .legal-doc h1 + h3 { font-size: 16px; font-weight: 700; color: var(--secondary); margin-top: 8px; line-height: 1.4; }
        .legal-doc > p:first-of-type > em:only-child { display: inline-block; font-style: normal; font-size: 12px; font-weight: 700; color: var(--muted); margin-top: 4px; }
        .legal-doc h2 { font-size: 20px; font-weight: 800; color: var(--ink); margin: 36px 0 0; line-height: 1.25; }
        .legal-doc h3 { font-size: 16px; font-weight: 800; color: var(--ink); margin: 1.6em 0 0; }
        .legal-doc p { margin: 12px 0 0; }
        .legal-doc strong { color: var(--ink); font-weight: 700; }
        .legal-doc em { font-style: normal; color: var(--ink); }
        .legal-doc a { color: var(--accent); font-weight: 700; }
        .legal-doc a.cell-link { display: inline-flex; align-items: center; min-height: 44px; }
        .legal-doc ul, .legal-doc ol { padding-left: 20px; margin: 10px 0 0; }
        .legal-doc li { margin: 5px 0; }
        .legal-doc table { display: block; overflow-x: auto; border-collapse: separate; border-spacing: 0; width: 100%; font-size: 13px; margin-top: 14px; border: 1px solid var(--line); border-radius: var(--r-well); background: var(--surface-sunken); }
        .legal-doc th, .legal-doc td { border-bottom: 1px solid var(--line); padding: 9px 12px; text-align: left; vertical-align: top; min-width: 150px; }
        .legal-doc tr:last-child td { border-bottom: 0; }
        .legal-doc thead:has(th:empty) { display: none; }
        .legal-doc code { background: var(--surface-2); border-radius: 6px; padding: 1px 6px; font-size: 13px; }
        .legal-doc hr { border: 0; border-top: 1px solid var(--line); margin: 2em 0; }
`;

// A document rendered inside another page (doc 32 B3: doc 21 is SHOWN in the
// approval flow, not merely linked). Same source, same renderer, same styles.
export function LegalBody({ file }: { file: string }) {
  const html = marked.parse(legalDocument(file).markdown, { async: false });
  return (
    <>
      <div className="legal-doc" style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: html }} />
      <style>{LEGAL_CSS}</style>
    </>
  );
}

export function renderLegal(file: string) {
  const html = marked.parse(legalDocument(file).markdown, { async: false });

  return (
    <QuietShell wide>
      <div
        className="legal-doc"
        style={{ fontSize: 14.5, color: T.secondary, fontWeight: 500, lineHeight: 1.65 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <style>{LEGAL_CSS}</style>
    </QuietShell>
  );
}
