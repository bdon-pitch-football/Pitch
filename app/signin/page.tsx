// SignIn.dc.html — copy verbatim. One door, four seats. In development the
// password path is inert and the email match signs in directly; production
// swaps in Supabase Auth behind the same form. Responses are identical
// whether or not an account exists (D-94 §2 — no enumeration).
import { HeaderMark } from '@/components/Wordmark';
import { signIn } from './actions';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', placeholder: '#6b7d73',
  accent: '#3ddc84', onAccent: '#06130c',
};

export const metadata = { robots: { index: false, follow: false } };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ out?: string; reset?: string }> }) {
  const { out, reset } = await searchParams;
  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', flexDirection: 'column', gap: 3 };
  const label: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted };
  const input: React.CSSProperties = { background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', padding: 0, width: '100%' };

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <style>{`@keyframes doorRise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .door > * { animation: doorRise .5s cubic-bezier(.22,1,.36,1) both; }
        .door > *:nth-child(2) { animation-delay: .05s } .door > *:nth-child(3) { animation-delay: .1s }
        .door > *:nth-child(4) { animation-delay: .15s } .door > *:nth-child(5) { animation-delay: .2s }
        @media (prefers-reduced-motion: reduce) { .door > * { animation: none } }`}</style>
      <div className="door" style={{ width: '100%', maxWidth: 560, minHeight: '100dvh', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Welcome back</div>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500 }}>
            {out ? 'Signed out on this device.' : reset ? 'Password saved. Sign in with it.' : 'One account, whichever seat you hold.'}
          </div>
        </div>
        <form action={signIn} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={card}><div style={label}>Email</div><input style={input} name="email" type="email" placeholder="you@example.com" required /></div>
            <div style={card}><div style={label}>Password</div><input style={input} name="password" type="password" placeholder="••••••••" /></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <button type="submit" className="btn btn-primary">Sign in</button>
            <button type="submit" style={{ background: 'transparent', border: `1px solid ${T.line}`, color: T.secondary, borderRadius: 14, height: 46, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Email me a link instead</button>
          </div>
        </form>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.muted, textAlign: 'center' }}>Forgotten your password? <a href="/reset" style={{ color: T.accent, fontWeight: 800, textDecoration: 'none' }}>Reset it</a></div>
        <div style={{ height: 1, background: T.line, margin: '4px 0' }} />
        <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7.5 v5" /><circle cx="12" cy="16.2" r="0.6" fill={T.muted} /></svg>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>A parent, a player, a coach and a club all sign in here. What you see afterwards depends on the seat, not the door.</div>
        </div>
        <div style={{ marginTop: 'auto', fontSize: 13, fontWeight: 700, color: T.muted, textAlign: 'center' }}>New to Pitch? <a href="/join" style={{ color: T.accent, fontWeight: 800, textDecoration: 'none' }}>Create an account</a></div>
      </div>
    </div>
  );
}
