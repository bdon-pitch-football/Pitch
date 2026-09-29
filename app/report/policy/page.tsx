import type { Metadata } from 'next';
import { renderLegal } from '@/app/legal/legal-page';
import { documentTitle } from '@/lib/legal-doc';

// Doc 25, Complaints and Takedown (legal register: "/report · reachable
// without an account, from any page"). /report is the form and served none of
// it until brief K; the form links here. The document says Part 1 is public
// and Parts 2–5 are internal, so Part 1 is what is served (lib/legal-doc,
// WITHHELD). No account, no consent, no stamp.
export const metadata: Metadata = {
  title: documentTitle('25-Complaints-and-Takedown.md'),
  robots: { index: false, follow: false }, // only the front page ranks (doc 29 §7)
};

export default function ComplaintsPolicyPage() {
  return renderLegal('25-Complaints-and-Takedown.md');
}
