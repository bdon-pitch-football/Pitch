// SignIn.dc.html — copy verbatim. One door, four seats. In development the
// password path is inert and the email match signs in directly; production
// swaps in Supabase Auth behind the same form. Responses are identical
// whether or not an account exists (D-94 §2 — no enumeration).
import OpenInBrowser from '@/components/OpenInBrowser';
import { HeaderMark } from '@/components/Wordmark';
import { signIn } from './actions';
import { FAILURE_COPY } from '@/components/FailureState';
import { T } from '@/lib/palette';
import { fieldLabel } from '@/lib/ui';

export const metadata = { title: 'Sign in', robots: { index: false, follow: false } };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ out?: string; reset?: string; joined?: string; confirmed?: string; refused?: string }> }) {
  const { out, reset, joined, confirmed, refused } = await searchParams;
  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', flexDirection: 'column', gap: 3 };
  const label = fieldLabel;
  const input: React.CSSProperties = { background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', padding: 0, width: '100%' };

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <style>{`@keyframes doorRise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .door > * { animation: doorRise .5s cubic-bezier(.22,1,.36,1) both; }
        .door > *:nth-child(2) { animation-delay: .05s } .door > *:nth-child(3) { animation-delay: .1s }
        .door > *:nth-child(4) { animation-delay: .15s } .door > *:nth-child(5) { animation-delay: .2s }
        @media (prefers-reduced-motion: reduce) { .door > * { animation: none } }`}</style>
      <div className="door reading" style={{ width: '100%', minHeight: '100dvh', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <OpenInBrowser path="/signin" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Welcome back</h1>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500 }}>
            {/* "You're set up" was true before 0056 and is not now: the
                account exists and signs in nowhere until the link we emailed
                is opened (L21, L25 \u2014 copy that describes behaviour goes stale
                silently). The line is the same whether the address was free
                or already had an account, because the answer must be (D-94
                \u00a72). */}
            {out ? 'Signed out on this device.' : reset ? 'Password saved. Sign in with it.'
              : confirmed ? 'Address confirmed. Sign in with the password you chose.'
              : joined ? 'Check your email. There\u2019s a link in it that confirms the address is yours \u2014 open it and you can sign in.'
              : 'One account, whichever seat you hold.'}
          </div>
        </div>
        {/* Every refusal lands here with this one line, whatever caused it
            (app/signin/actions.ts). role=alert, because a person who has just
            pressed Sign in and been sent back needs telling, and a screen
            reader was previously told nothing at all. */}
        {refused && (
          <div role="alert" style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13.5, fontWeight: 700, color: T.secondary, lineHeight: 1.55 }}>
            {FAILURE_COPY.signInRefused}
          </div>
        )}
        <form action={signIn} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {/* The visible label is a LABEL, not a div beside the input. It
                looked identical and read as "edit text, blank" to anyone
                using a screen reader — on the product's front door. Wrapping
                associates them implicitly, so no id/htmlFor pair to keep in
                sync, and it widens the tap target onto the label text. */}
            <label style={card}><div style={label}>Email</div><input style={input} name="email" type="email" placeholder="you@example.com" required /></label>
            <label style={card}><div style={label}>Password</div><input style={input} name="password" type="password" placeholder="••••••••" /></label>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <button type="submit" className="btn btn-primary">Sign in</button>
            {/* This was a second submit button on the password form, and no
                emailed sign-in link exists (doc 15 has no such message), so in
                production it signed nobody in. The emailed link that does
                exist is §10's: choose a password. */}
            <a href="/reset" className="btn btn-secondary" style={{ color: T.secondary }}>No password yet? Email me a link</a>
          </div>
        </form>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.muted, textAlign: 'center' }}>Forgotten your password? <a href="/reset" style={{ color: T.accent, fontWeight: 800, textDecoration: 'none' }}>Reset it</a></div>
        <div style={{ height: 1, background: T.line, margin: '4px 0' }} />
        <div className="card-sunken" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7.5 v5" /><circle cx="12" cy="16.2" r="0.6" fill={T.muted} /></svg>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>A parent, a player, a coach and a club all sign in here. What you see afterwards depends on the seat, not the door.</div>
        </div>
        <div style={{ marginTop: 'auto', fontSize: 13, fontWeight: 700, color: T.muted, textAlign: 'center' }}>New to Pitch? <a href="/join" style={{ color: T.accent, fontWeight: 800, textDecoration: 'none' }}>Create an account</a></div>
      </div>
    </div>
  );
}
