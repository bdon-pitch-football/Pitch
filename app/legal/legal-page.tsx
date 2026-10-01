import { marked } from 'marked';
import { QuietShell } from '@/components/quiet-shell';
import { legalDocument } from '@/lib/legal-doc';
import { T } from '@/lib/palette';

// The privacy policy and terms are served as real pages, not PDFs (doc 29 §7).
// Content comes from docs/legal — the authoritative markdown — through
// lib/legal-doc, which takes off the drafting preamble and puts the version and
// date the register and the document agree on under the title. Every clause,
// heading and sentence is the published text, unaltered.

const LEGAL_CSS = `
        .legal-doc h1 { font-size: 28px; font-weight: 900; letter-spacing: -.015em; color: var(--ink); line-height: 1.15; }
        .legal-doc h2 { font-size: 20px; font-weight: 800; letter-spacing: -.015em; color: var(--ink); margin-top: 2em; }
        .legal-doc h3 { font-size: 16px; font-weight: 800; color: var(--ink); margin-top: 1.6em; }
        .legal-doc strong { color: var(--ink); }
        .legal-doc table { border-collapse: collapse; width: 100%; font-size: 13px; }
        .legal-doc th, .legal-doc td { border: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }
        .legal-doc code { background: var(--surface); border-radius: 6px; padding: 1px 6px; font-size: 13px; }
        .legal-doc hr { border: none; border-top: 1px solid var(--line); margin: 2em 0; }
        .legal-doc table { display: block; overflow-x: auto; }
        .legal-doc th, .legal-doc td { min-width: 150px; }
`;
// The last rule (brief G, 29 Sep): at 375px a four-column table squeezed its
// cells to 73–117px and a sentence ran eight lines deep, one or two words to
// a line. A cell now keeps 150px and the table scrolls sideways inside its
// own box (the rule above it), which a phone does naturally. The layout
// check's squeeze rule found these; the page itself is otherwise unchanged.

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
