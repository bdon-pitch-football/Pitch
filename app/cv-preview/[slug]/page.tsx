// DEV-ONLY fixture preview of the public player CV. This route does not
// exist in production — the real page is the single tokenised read path
// (D-80), which renders through the database's fn_token_read decision.
// This exists so BUZ can see and approve the CV design against all three
// house fixtures before any real data flows.
import { notFound } from 'next/navigation';
import PlayerCV from '@/components/cv/PlayerCV';
import { PLAYER_FIXTURES } from '@/lib/fixtures';

export const metadata = { title: 'CV preview', robots: { index: false, follow: false } };

export default async function CvPreview({ params }: { params: Promise<{ slug: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { slug } = await params;
  const fixture = PLAYER_FIXTURES.find((f) => f.slug === slug);
  if (!fixture) notFound();
  return <PlayerCV p={fixture} />;
}
