// The one page every non-live link serves (D-77): expired, revoked, paused,
// guardian-disabled, never existed — identical copy, identical structure,
// for all of them. No name, no club, no photo, no age. Faithful to
// LinkState.dc.html (anon variant; the verified-club request-access variant
// arrives with auth).
import { HeaderMark } from '@/components/Wordmark';
import { requestAccess } from '@/app/p/[token]/request/actions';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84', onAccent: '#06130c',
};

export default function LinkState({ token, asked }: { token?: string; asked?: boolean }) {
  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5 V7.5 a4 4 0 0 1 8 0 v3" /></svg>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.015em' }}>This link doesn&rsquo;t open anything</h1>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>It may have been switched off, it may have expired, or it may never have been a link at all. We don&rsquo;t say which.</div>
        </div>
        <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' }}>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>That is deliberate. If we told you which, anyone could use a wrong link to find out whether a particular child is on Pitch. The answer is the same either way.</div>
        </div>
        <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7.5 v5" /><circle cx="12" cy="16.2" r="0.6" fill={T.muted} /></svg>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>Not signed in as a verified club? Then there is nothing on this page for you, and there is nothing more we will tell you.</div>
        </div>

        {/* The one affordance on this page (D-77, doc 14 C6). The requester
            types their own name and role and the family decides. The reply
            below is the SAME whether a request was sent, silently dropped as
            a repeat inside 24 hours, or aimed at a token that never existed —
            anything else tells a stranger their guess found something. */}
        {token && (asked ? (
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.secondary, lineHeight: 1.55 }}>
              If there is a family at the other end of this link, they have your name and your role. Whether they answer is up to them, and we will not ask again on your behalf.
            </div>
          </div>
        ) : (
          <form action={requestAccess} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', flexDirection: 'column', gap: 11 }}><input type="hidden" name="token" value={token} />
            <div style={{ fontSize: 14, fontWeight: 900 }}>Were you sent this link?</div>
            <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
              Tell the family who you are and they can send you a new one. We pass on exactly what you type and nothing else.
            </div>
            <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>Your name</div>
              <input name="name" required maxLength={80} style={{ background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 14.5, fontWeight: 700, fontFamily: 'inherit', padding: 0, width: '100%' }} />
            </div>
            <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>Your role and club</div>
              <input name="role" required maxLength={120} placeholder="Technical Director, Riverside FC" style={{ background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 14.5, fontWeight: 700, fontFamily: 'inherit', padding: 0, width: '100%' }} />
            </div>
            <button type="submit" style={{ background: T.surface2, border: `1px solid ${T.line}`, color: T.ink, borderRadius: 14, height: 46, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Ask the family</button>
          </form>
        ))}
      </div>
    </div>
  );
}
