// Confirm your email address (0056, blockers B1/B2, LESSONS L21).
//
// The link the three sign-up doors send. Until it is pressed, the account it
// belongs to signs in nowhere and no child can be linked to it — so this page
// is the whole difference between an address somebody typed and an address
// somebody holds.
//
// Every non-live token — used, lapsed, never existed — serves the SAME panel,
// in the same words, as the link-state page does for share tokens (D-77): a
// confirm link must not tell a stranger which addresses have accounts.
import OpenInBrowser from '@/components/OpenInBrowser';
import { QuietShell } from '@/components/quiet-shell';
import { GlyphTile } from '@/components/FailureState';
import { LINK_GLYPH, MAIL_GLYPH } from '@/components/door-glyphs';
import { confirmAddress } from './actions';
import { addressProofIsLive } from '@/lib/auth';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Confirm your email address', robots: { index: false, follow: false } };

export default async function ConfirmAddress({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const live = await addressProofIsLive(decodeURIComponent(token));

  // Floodlit (spec G): a link from a message opens one door. The top bar
  // (its logo links home, Head of Product Design ruling 1), then the door
  // panel from 640px; on a phone the column is the door, so the inner card
  // went. The glyph tile is solid while the link asks and dashed when it is
  // not live — and the not-live panel is still ONE panel, in the same words,
  // for a used, a lapsed and a never-existed token (D-77, D-94 §2).
  return (
    <QuietShell wide door>
      <GlyphTile state={live ? 'ask' : 'dead'}>{live ? MAIL_GLYPH : LINK_GLYPH}</GlyphTile>
      <h1 className="pg-title">
        {live ? 'Confirm your email address' : 'This link isn’t live'}
      </h1>
      {/* The link opens inside the mail app as often as not. Confirming
          works there; the sign-in that follows would not carry. */}
      <OpenInBrowser path={`/confirm/${token}`} />
      {live ? (
        <form action={confirmAddress} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <input type="hidden" name="token" value={token} />
          <p style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55, margin: 0 }}>
            Press the button and this address is yours on Pitch. Until then, the account it belongs to signs in nowhere.
          </p>
          <button type="submit" className="btn btn-primary fl-glow">Yes, it&rsquo;s me &mdash; continue</button>
        </form>
      ) : (
        <div role="note" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <p style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55, margin: 0 }}>
            It may have been used already, or it may have lapsed. Either way, nothing is lost: use &ldquo;Reset it&rdquo; on the sign-in page and choose a password from the link we email you.
          </p>
          <a href="/signin" className="btn btn-secondary">Go to sign in</a>
        </div>
      )}
    </QuietShell>
  );
}
