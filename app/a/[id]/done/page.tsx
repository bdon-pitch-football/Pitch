// Post-approval landing — GuardianHome.dc.html, reduced to what exists
// after a first approval: the family header and the child card with its
// approved line. Grows into the full guardian dashboard.
import { notFound } from 'next/navigation';
import { getPendingInvitation } from '@/lib/guardian-flow';
import { HeaderMark } from '@/components/Wordmark';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your family', robots: { index: false, follow: false } };

export default async function Done({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await getPendingInvitation(id);
  if (!inv || !inv.approved_at) notFound();

  const approvedDate = new Date(inv.approved_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', timeZone: 'Australia/Melbourne' });

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Your family</h1>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Everything about your children on Pitch, and every control over it, is here.</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted }}>Your children</div>
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: T.secondary, flexShrink: 0 }}>{(inv.first_name as string)[0]}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{inv.first_name}</div>
                <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>Page not built yet</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
              <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500 }}>Approved by you on {approvedDate}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, border: `1px solid ${T.line}`, borderRadius: 13, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, fontWeight: 700, color: T.secondary }}>See the page</div>
              <div style={{ flex: 1, background: T.surface2, borderRadius: 14, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>Manage</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
