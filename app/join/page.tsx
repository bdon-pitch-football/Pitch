import type { Metadata } from 'next';
import Join from '@/components/site/Join';
import { roleFromAd } from '@/lib/ad-role';

// Where a paid click lands (20 Sep). The front page stays exactly as it is for
// everyone who arrives by any other route; this page exists because a click
// that has to scroll 12,500px to find the form does not find it.
//
// Not indexed: the front page is the only Pitch page that should rank
// (doc 29 §7, D-95), and an ad landing page competing with it in search is
// the opposite of the point. It is not in the sitemap either.
export const metadata: Metadata = {
  title: 'Join the waitlist — Pitch Football',
  description:
    'Join the Pitch Football waitlist. One email when we open. For players, parents, coaches and clubs.',
  robots: { index: false, follow: false },
};

// The ad's own tag picks the role, on the server, so the first paint already
// says the right words — no swap after hydration and no layout shift.
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const q = await searchParams;
  return <Join initialRole={roleFromAd({ utm_content: q.utm_content, role: q.role })} />;
}
