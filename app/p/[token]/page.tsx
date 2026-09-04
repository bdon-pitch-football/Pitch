// The public share-link page — the ONLY surface an unauthenticated stranger
// can reach a record through, and it reaches the data exclusively via
// lib/record-read (D-80). A dead link of any kind renders LinkState with a
// 200 — never a 404, never a different body (D-77).
import PlayerCV from '@/components/cv/PlayerCV';
import LinkState from '@/components/cv/LinkState';
import { readCvByToken } from '@/lib/record-read';

// Tokenised pages: out of every index, always (D-95).
export const metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function SharedCv({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cv = await readCvByToken(token);
  if (!cv) return <LinkState />;
  return <PlayerCV p={cv} />;
}
