import type { Metadata } from 'next';
import { unsubscribeByToken } from '@/lib/waitlist-db';
import { PitchWordmark, QuietShell } from '@/components/quiet-shell';

// One click sets unsubscribed_at. No confirmation step, no retention question
// (doc 29 §5). Works with no account, from any device.

export const metadata: Metadata = {
  title: 'Unsubscribe — Pitch Football',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const token = typeof t === 'string' && /^[a-f0-9]{16,64}$/.test(t) ? t : null;
  const done = token ? await unsubscribeByToken(token) : false;

  return (
    <QuietShell>
      <PitchWordmark />
      {done ? (
        <>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.02em', margin: 0 }}>
            You’re off the list.
          </h1>
          <p style={{ fontSize: 14.5, color: '#b9c8bf', fontWeight: 500, lineHeight: 1.6, margin: 0 }}>
            We won’t email you. That’s the whole action — there was nothing else to remove.
          </p>
          <p style={{ fontSize: 13, color: '#7d8f85', fontWeight: 600, margin: 0 }}>
            Changed your mind? <a href="/">Join again any time.</a>
          </p>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.02em', margin: 0 }}>
            That link didn’t work.
          </h1>
          <p style={{ fontSize: 14.5, color: '#b9c8bf', fontWeight: 500, lineHeight: 1.6, margin: 0 }}>
            The unsubscribe link may have been cut short by your mail app. Try copying the whole
            link from the email, or reply to any email from us and we’ll take you off by hand.
          </p>
        </>
      )}
    </QuietShell>
  );
}
