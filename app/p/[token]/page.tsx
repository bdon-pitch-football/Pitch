// The public share-link page — the ONLY surface an unauthenticated stranger
// can reach a record through, and it reaches the data exclusively via
// lib/record-read (D-80). A dead link of any kind renders LinkState with a
// 200 — never a 404, never a different body (D-77).
import { createHash } from 'node:crypto';
import PlayerCV from '@/components/cv/PlayerCV';
import LinkState from '@/components/cv/LinkState';
import { readCvByToken } from '@/lib/record-read';
import { cvMetadata, DEAD_LINK_METADATA } from '@/lib/cv-meta';

export const dynamic = 'force-dynamic';

// Tokenised pages stay out of every index, always (D-95) — every branch below
// returns robots:noindex. The token is deliberately read again here rather
// than memoised across the metadata and body passes: D-94 §5 wants it
// re-checked on every read, and no cache on a child's record is worth the
// saving.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cv = await readCvByToken(token).catch(() => null);
  return cv ? cvMetadata(cv) : DEAD_LINK_METADATA;
}

export default async function SharedCv({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ asked?: string }>;
}) {
  const { token } = await params;
  const { asked } = await searchParams;
  const cv = await readCvByToken(token);
  if (!cv) return <LinkState token={token} asked={asked === '1'} />;
  // The operator finds the record from the hash; the token never leaves this page.
  const reportRef = createHash('sha256').update(token).digest('hex');
  return <PlayerCV p={cv} reportRef={reportRef} />;
}
