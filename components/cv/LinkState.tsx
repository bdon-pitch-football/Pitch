// The one page every non-live link serves (D-77): expired, revoked, paused,
// guardian-disabled, never existed — identical copy, identical structure,
// for all of them. No name, no club, no photo, no age. Faithful to
// LinkState.dc.html (anon variant; the verified-club request-access variant
// arrives with auth).
const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84', onAccent: '#06130c',
};

export default function LinkState() {
  return (
    <div style={{ minHeight: '100dvh', background: T.bg, color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <svg width="26" height="26" viewBox="0 0 26 26"><rect width="26" height="26" rx="8" fill={T.accent} /><rect x="5" y="6.5" width="16" height="13" rx="1.5" fill="none" stroke={T.onAccent} strokeWidth="1.6" /><line x1="13" y1="6.5" x2="13" y2="19.5" stroke={T.onAccent} strokeWidth="1.6" /><circle cx="13" cy="13" r="2.7" fill="none" stroke={T.onAccent} strokeWidth="1.6" /></svg>
          <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '0.02em' }}>Pitch</div>
        </div>
        <div>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5 V7.5 a4 4 0 0 1 8 0 v3" /></svg>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.015em' }}>This link doesn&rsquo;t open anything</div>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>It may have been switched off, it may have expired, or it may never have been a link at all. We don&rsquo;t say which.</div>
        </div>
        <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' }}>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>That is deliberate. If we told you which, anyone could use a wrong link to find out whether a particular child is on Pitch. The answer is the same either way.</div>
        </div>
        <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7.5 v5" /><circle cx="12" cy="16.2" r="0.6" fill={T.muted} /></svg>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>Not signed in as a verified club? Then there is nothing on this page for you, and there is nothing more we will tell you.</div>
        </div>
      </div>
    </div>
  );
}
