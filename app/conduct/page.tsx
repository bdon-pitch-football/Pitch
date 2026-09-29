import type { Metadata } from 'next';
import { renderLegal } from '@/app/legal/legal-page';
import { documentTitle } from '@/lib/legal-doc';

// Doc 24, the Code of Conduct (legal register: served at /conduct; it forms
// Schedule C of the terms). It was a 404 until brief K. The same renderer and
// the same rules as /terms, and nobody consents to it on its own, so nothing
// here stamps anything (lib/legal-stamp knows docs 20, 21 and 22 only).
export const metadata: Metadata = {
  title: documentTitle('24-Code-of-Conduct.md'),
  robots: { index: false, follow: false }, // only the front page ranks (doc 29 §7)
};

export default function ConductPage() {
  return renderLegal('24-Code-of-Conduct.md');
}
