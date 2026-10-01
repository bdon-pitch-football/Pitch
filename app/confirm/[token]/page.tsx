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
import { HeaderMark } from '@/components/Wordmark';
import { confirmAddress } from './actions';
import { addressProofIsLive } from '@/lib/auth';
import { T } from '@/lib/palette';
import { card } from '@/lib/ui';
import { claimSlug } from '@/lib/claim-return';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Confirm your email address', robots: { index: false, follow: false } };

export default async function ConfirmAddress({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ claim?: string }> }) {
  const { token } = await params;
  const claim = claimSlug((await searchParams).claim);
  const live = await addressProofIsLive(decodeURIComponent(token));

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>
          {live ? 'Confirm your email address' : 'This link isn’t live'}
        </h1>
        {/* The link opens inside the mail app as often as not. Confirming
            works there; the sign-in that follows would not carry. */}
        <OpenInBrowser path={`/confirm/${token}`} />
        {live ? (
          <form action={confirmAddress} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input type="hidden" name="token" value={token} />
            {claim && <input type="hidden" name="claim" value={claim} />}
            <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
              Press the button and this address is yours on Pitch. Until then, the account it belongs to signs in nowhere.
            </div>
            <button type="submit" className="btn btn-primary">Yes, it&rsquo;s me &mdash; continue</button>
          </form>
        ) : (
          <div role="note" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
              It may have been used already, or it may have lapsed. Either way, nothing is lost: use &ldquo;Reset it&rdquo; on the sign-in page and choose a password from the link we email you.
            </div>
            <a href="/signin" className="btn btn-secondary" style={{ color: T.secondary }}>Go to sign in</a>
          </div>
        )}
      </div>
    </div>
  );
}
