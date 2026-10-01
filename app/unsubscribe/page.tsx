import type { Metadata } from 'next';
import { unsubscribeByToken } from '@/lib/waitlist-db';
import { QuietShell } from '@/components/quiet-shell';
import { GlyphTile } from '@/components/FailureState';
import { MAIL_OFF_GLYPH } from '@/components/door-glyphs';

// One click sets unsubscribed_at. No confirmation step, no retention question
// (doc 29 §5). Works with no account, from any device.

export const metadata: Metadata = {
  title: 'Unsubscribe',
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

  // Floodlit (spec G): the quiet shell as a door, `wide` so it is the same
  // width as /signin. The title is the page title (26px at the charter's
  // title spacing; it was 28px at -.02em, not one of the five) with its line
  // as .pg-sub (Head of Product Design ruling 5). The tick
  // tile only when the token matched; the dashed one only when it did not.
  // There is no button: one click already did it (doc 29 §5).
  return (
    <QuietShell wide door>
      {done ? (
        <>
          <GlyphTile state="done">{MAIL_OFF_GLYPH}</GlyphTile>
          <div className="pg-titles">
            <h1 className="pg-title">
              You’re off the list.
            </h1>
            <p className="pg-sub" style={{ margin: 0 }}>
              We won’t email you. That’s the whole action — there was nothing else to remove.
            </p>
          </div>
        </>
      ) : (
        <>
          <GlyphTile state="dead">{MAIL_OFF_GLYPH}</GlyphTile>
          <div className="pg-titles">
            <h1 className="pg-title">
              That link didn’t work.
            </h1>
            <p className="pg-sub" style={{ margin: 0 }}>
              The unsubscribe link may have been cut short by your mail app. Try copying the whole
              link from the email, or reply to any email from us and we’ll take you off by hand.
            </p>
          </div>
        </>
      )}
    </QuietShell>
  );
}
