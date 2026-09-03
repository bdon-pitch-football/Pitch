import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import { PitchWordmark, QuietShell } from '@/components/quiet-shell';

// The privacy policy and terms are served as real pages, not PDFs (doc 29 §7).
// Content comes straight from docs/legal — the authoritative markdown. Four
// placeholders (registered office, privacy contact, appeals contact,
// publication date) remain until the solicitor resolves them; the waitlist
// form stays gated (WAITLIST_ENABLED) until they do.

export function renderLegal(file: string) {
  const raw = fs.readFileSync(path.join(process.cwd(), 'docs', 'legal', file), 'utf8');
  const html = marked.parse(raw, { async: false });

  return (
    <QuietShell wide>
      <PitchWordmark />
      <div
        className="legal-doc"
        style={{ fontSize: 14.5, color: '#b9c8bf', fontWeight: 500, lineHeight: 1.65 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <style>{`
        .legal-doc h1 { font-size: 28px; font-weight: 900; letter-spacing: -.02em; color: #eef5f0; line-height: 1.15; }
        .legal-doc h2 { font-size: 20px; font-weight: 800; letter-spacing: -.015em; color: #eef5f0; margin-top: 2em; }
        .legal-doc h3 { font-size: 16px; font-weight: 800; color: #eef5f0; margin-top: 1.6em; }
        .legal-doc strong { color: #eef5f0; }
        .legal-doc table { border-collapse: collapse; width: 100%; font-size: 13px; }
        .legal-doc th, .legal-doc td { border: 1px solid #24322a; padding: 8px 10px; text-align: left; vertical-align: top; }
        .legal-doc code { background: #121b16; border-radius: 6px; padding: 1px 6px; font-size: 13px; }
        .legal-doc hr { border: none; border-top: 1px solid #24322a; margin: 2em 0; }
      `}</style>
    </QuietShell>
  );
}
