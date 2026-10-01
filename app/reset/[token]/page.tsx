// Set a new password. The token is single-use and expires in an hour; it is
// only ever compared as a hash.
import { redirect } from 'next/navigation';
import OpenInBrowser from '@/components/OpenInBrowser';
import { QuietShell } from '@/components/quiet-shell';
import { GlyphTile } from '@/components/FailureState';
import { KEY_GLYPH } from '@/components/door-glyphs';
import { submitNewPassword } from '../actions';
import { resetLinkLive } from '@/lib/auth';

export const metadata = { title: 'Set a new password', robots: { index: false, follow: false } };

export default async function SetPassword({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ short?: string }>;
}) {
  const { token } = await params;
  const { short } = await searchParams;
  // G-P2 (BUZ, 1 Oct): a used, replaced or expired link says so before a
  // password is typed into it — the same page the press lands on (0164).
  if (!(await resetLinkLive(token))) redirect('/reset?expired=1');
  const act = submitNewPassword;

  // Floodlit (spec G): the door, the key tile, one field, one glowing
  // primary. The short-password line is the amber notice, announced, and the
  // field takes the amber edge (A part 19, aria-invalid).
  return (
    <QuietShell wide door>
      <GlyphTile>{KEY_GLYPH}</GlyphTile>
      <h1 className="pg-title">Set a new password</h1>
      {/* The emailed link most often opens inside the mail app. Setting the
          password works there; the sign-in that follows would not carry. */}
      <OpenInBrowser path={`/reset/${token}`} />
      {short && <div role="alert" className="card card-amber" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--secondary)', lineHeight: 1.55 }}>Use at least ten characters.</div>}
      <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}><input type="hidden" name="token" value={token} />
        <label className="field">
          <span className="field-label">New password</span>
          <input name="password" type="password" required minLength={10} aria-invalid={short ? 'true' : undefined} />
        </label>
        <button type="submit" className="btn btn-primary fl-glow">Save it</button>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, lineHeight: 1.5 }}>This signs you out everywhere else once you sign back in.</div>
      </form>
    </QuietShell>
  );
}
