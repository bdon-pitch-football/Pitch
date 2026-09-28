// The consent stamp for a legal document (doc 32 B2): the version the legal
// register says is current, bound to the bytes actually served. A version
// string alone is an assertion (John, 3 Sep); the hash is what lets a consent
// row resolve, years later, to the exact text that person read.
//
// "Actually served" is the whole of it, and it is the bytes the PAGE renders —
// not the file in docs/legal. The two are not the same: the file keeps its
// drafting preamble and the page does not (lib/legal-doc). Hashing the file
// would resolve a guardian's row to a document carrying 728 words she was
// never shown, including the sentence saying the policy is not published —
// which is the exact failure this hash exists to prevent (safety seat, 28 Sep).
import 'server-only';
import { createHash } from 'node:crypto';
import { legalDocument, registeredVersion } from '@/lib/legal-doc';

export const LEGAL_FILES = {
  '20': '20-Privacy-Policy-Adult.md',
  '21': '21-Privacy-Policy-Child.md',
  '22': '22-Terms-of-Service.md',
} as const;
export type LegalDoc = keyof typeof LEGAL_FILES;

// Both halves come from lib/legal-doc: the version it reads out of the
// register, and the document it renders. Two readings of one table, or two
// renderings of one document, is two places to be wrong (L23).
export function legalStamp(doc: LegalDoc): string {
  const served = legalDocument(LEGAL_FILES[doc]).markdown;
  const sha = createHash('sha256').update(served).digest('hex');
  return `${doc}@${registeredVersion(doc)}+sha256:${sha}`;
}
