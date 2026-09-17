// The consent stamp for a legal document (doc 32 B2): the version the legal
// register says is current, bound to the bytes actually served. A version
// string alone is an assertion (John, 3 Sep); the hash is what lets a consent
// row resolve, years later, to the exact text that person read.
//
// Read from docs/legal at request time, so a stamp can never describe a file
// other than the one on the page.
import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const LEGAL_FILES = {
  '20': '20-Privacy-Policy-Adult.md',
  '21': '21-Privacy-Policy-Child.md',
  '22': '22-Terms-of-Service.md',
} as const;
export type LegalDoc = keyof typeof LEGAL_FILES;

const dir = () => path.join(process.cwd(), 'docs', 'legal');

/** The current version from the legal register's table row, e.g. "v2.5". */
function registeredVersion(doc: LegalDoc): string {
  const reg = fs.readFileSync(path.join(dir(), '00-Legal-Register.md'), 'utf8');
  const row = reg.split('\n').find((l) => l.startsWith(`| **${doc}** |`));
  const v = row && /\*\*(v\d+\.\d+)\*\*/.exec(row)?.[1];
  if (!v) throw new Error(`legal register has no version for doc ${doc}`);
  return v;
}

export function legalStamp(doc: LegalDoc): string {
  const bytes = fs.readFileSync(path.join(dir(), LEGAL_FILES[doc]));
  const sha = createHash('sha256').update(bytes).digest('hex');
  return `${doc}@${registeredVersion(doc)}+sha256:${sha}`;
}
