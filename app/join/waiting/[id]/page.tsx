// WaitingForParent.dc.html — the pending state (D-17). Nothing exists
// publicly; if nobody approves within 14 days everything purges.
// No SMS/email actually sends yet (doc 15 wiring comes with Twilio/Resend);
// in development the approval link is surfaced on-screen instead.
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPendingInvitation } from '@/lib/guardian-flow';
import { HeaderMark } from '@/components/Wordmark';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
  onAccent: '#06130c', amber: '#eda100', purple: '#a479e2',
};

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

const maskPhone = (p: string) => {
  const d = p.replace(/\s/g, '');
  return d.length >= 7 ? `${d.slice(0, 4)} ··· ${d.slice(-3)}` : '····';
};

export default async function Waiting({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await getPendingInvitation(id);
  if (!inv || inv.approved_at) notFound();

  const channels = inv.guardian_email ? 'Text and email sent' : 'Text sent';
  const initials = (inv.first_name as string).slice(0, 1).toUpperCase();

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />

        <div style={{ borderRadius: 22, background: 'linear-gradient(160deg, #123326 0%, #0c1d14 60%, #0a1510 100%)', padding: '26px 20px 24px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,.10)', borderRadius: 999, padding: '6px 12px' }}>
              <div style={{ width: 7, height: 7, borderRadius: 999, background: T.amber }} />
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.82)' }}>Not live yet</div>
            </div>
          </div>
          <div style={{ fontSize: 31, fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.015em' }}>Your page is<br />built. One<br />person to go.</div>
          <div style={{ fontSize: 14.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Everything you&rsquo;ve made is saved. Nobody can see it — not clubs, not coaches, not us — until a parent says yes.</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted }}>We asked</div>
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(164,121,226,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={T.purple} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20 c0-3.6 2.9-6 6.5-6 s6.5 2.4 6.5 6" /></svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{inv.guardian_name}</div>
              <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{channels} · {maskPhone(inv.guardian_phone ?? '')}</div>
            </div>
          </div>
        </div>

        <div style={{ borderRadius: 18, background: 'linear-gradient(160deg, #123326, #0c1d14)', border: `1px solid ${T.accent}`, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 900 }}>Honestly? Just go and ask them.</div>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>A text is easy to miss and easy to put off. Show them the page on your phone.</div>
          {/* DEV ONLY: no SMS sends yet — this is where the guardian's doc-15
              link goes. In dev it opens the approval page directly. */}
          {process.env.NODE_ENV !== 'production' && (
            <Link href={`/a/${inv.id}`} style={{ background: T.accent, color: T.onAccent, borderRadius: 14, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, textDecoration: 'none' }}>Show them my page</Link>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted }}>What you made</div>
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 56, height: 56, borderRadius: 17, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 900, color: T.secondary, flexShrink: 0 }}>{initials}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{inv.first_name}</div>
              <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>Page not started yet — build it while you wait</div>
            </div>
          </div>
          <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, fontWeight: 700, color: T.secondary }}>Keep editing it while you wait</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, fontWeight: 700, color: T.secondary }}>Send the text again</div>
          <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, fontWeight: 700, color: T.muted }}>Wrong number? Change who we ask</div>
        </div>

        <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7 v5.5 l3.5 2" /></svg>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>If nobody approves it within <b style={{ color: T.secondary }}>14 days</b> we delete all of it — the page, the photo, the clips. You can start again any time.</div>
        </div>
      </div>
    </div>
  );
}
