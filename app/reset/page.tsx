// Ask for a reset link. The message never varies — it is the same whether
// or not there is an account, because any difference tells a stranger
// whether an address is registered (doc 15 §10 amendment, D-94 §2).
import { HeaderMark } from '@/components/Wordmark';
import { QuietShell } from '@/components/quiet-shell';
import { GlyphTile } from '@/components/FailureState';
import { KEY_GLYPH, MAIL_GLYPH } from '@/components/door-glyphs';
import { requestReset } from './actions';

export const metadata = { title: 'Reset your password', robots: { index: false, follow: false } };

export default async function Reset({ searchParams }: { searchParams: Promise<{ sent?: string; expired?: string }> }) {
  const { sent, expired } = await searchParams;

  // Floodlit (spec G): the door. The way back to sign-in is the page
  // header's back link, in the column at every width (A part 5: SiteNav's
  // back hides from 1024px). The key tile goes dashed for a finished link;
  // the sent answer keeps it solid as an envelope and carries NO tick — the
  // page must not say anything was sent, because the answer is identical
  // whether or not there is an account (D-94 §2).
  return (
    <QuietShell wide door>
      <HeaderMark back={{ href: '/signin', label: 'Sign in' }} />
      <GlyphTile state={!sent && expired ? 'dead' : 'ask'}>{sent ? MAIL_GLYPH : KEY_GLYPH}</GlyphTile>
      <h1 className="pg-title">Reset your password</h1>
      {/* The reason you are here, so it is the amber notice above the form
          and it is announced. */}
      {expired && <div role="status" className="card card-amber" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--secondary)', lineHeight: 1.55 }}>That link has been used or has expired. Ask for another one.</div>}
      {sent ? (
        <div role="status" className="card card-accent" style={{ fontSize: 14, fontWeight: 700, color: 'var(--secondary)', lineHeight: 1.55 }}>
          If there&rsquo;s a Pitch account for that address, a reset link is on its way.
        </div>
      ) : (
        <form action={requestReset} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <label className="field">
            <span className="field-label">Email</span>
            <input name="email" aria-label="Email" type="email" required placeholder="you@example.com" />
          </label>
          <button type="submit" className="btn btn-primary fl-glow">Email me a reset link</button>
          <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, lineHeight: 1.55 }}>
            If the account belongs to someone under 16, the link goes to their parent — the same as everything else on that record.
          </div>
        </form>
      )}
    </QuietShell>
  );
}
