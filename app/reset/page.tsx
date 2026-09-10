// Ask for a reset link. The message never varies — it is the same whether
// or not there is an account, because any difference tells a stranger
// whether an address is registered (doc 15 §10 amendment, D-94 §2).
import { HeaderMark } from '@/components/Wordmark';
import { requestReset } from './actions';

const T = {
  surface: '#121b16', surface2: '#1a2420', line: '#24322a', ink: '#eef5f0',
  secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84', onAccent: '#06130c',
};

export const metadata = { title: 'Reset your password', robots: { index: false, follow: false } };

export default async function Reset({ searchParams }: { searchParams: Promise<{ sent?: string; expired?: string }> }) {
  const { sent, expired } = await searchParams;
  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/signin', label: 'Sign in' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Reset your password</h1>
          {expired && <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>That link has been used or has expired. Ask for another one.</div>}
        </div>
        {sent ? (
          <div style={{ ...card, border: `1px solid ${T.accent}`, fontSize: 14, fontWeight: 700, color: T.secondary, lineHeight: 1.55 }}>
            If there&rsquo;s a Pitch account for that address, a reset link is on its way.
          </div>
        ) : (
          <form action={requestReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={card}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>Email</div>
              <input name="email" aria-label="Email" type="email" required placeholder="you@example.com" style={{ background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', padding: 0, width: '100%' }} />
            </label>
            <button type="submit" className="btn btn-primary">Email me a reset link</button>
            <div style={{ ...card, background: T.surface2, fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
              If the account belongs to someone under 16, the link goes to their parent — the same as everything else on that record.
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
