// Set a new password. The token is single-use and expires in an hour; it is
// only ever compared as a hash.
import { HeaderMark } from '@/components/Wordmark';
import { submitNewPassword } from '../actions';
import { T } from '@/lib/palette';
import { card } from '@/lib/ui';

export const metadata = { title: 'Set a new password', robots: { index: false, follow: false } };

export default async function SetPassword({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ short?: string }>;
}) {
  const { token } = await params;
  const { short } = await searchParams;
  const act = submitNewPassword;

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Set a new password</h1>
        {short && <div style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>Use at least ten characters.</div>}
        <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}><input type="hidden" name="token" value={token} />
          <label style={card}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>New password</div>
            <input name="password" type="password" required minLength={10} style={{ background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', padding: 0, width: '100%' }} />
          </label>
          <button type="submit" className="btn btn-primary">Save it</button>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>This signs you out everywhere else once you sign back in.</div>
        </form>
      </div>
    </div>
  );
}
