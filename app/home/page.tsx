// The signed-in landing. Guardian seat renders GuardianHome.dc.html's
// family view (copy verbatim, grown from the approved-child card already
// shipped at /a/[id]/done); a player seat lands on their build surface.
// Signed-out renders a quiet prompt back to the door — the same page for
// every wrong turn, no enumeration.
import Link from 'next/link';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
  onAccent: '#06130c', amber: '#eda100',
};

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div style={{ minHeight: '100dvh', background: T.bg, color: T.ink, display: 'flex', justifyContent: 'center' }}>
    <div style={{ width: '100%', maxWidth: 560, minHeight: '100dvh', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
      <HeaderMark />
      {children}
    </div>
  </div>
);

export default async function Home() {
  const personId = await getSessionPersonId();
  if (!personId) {
    return (
      <Shell>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Welcome back</div>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500 }}>One account, whichever seat you hold.</div>
        </div>
        <Link href="/signin" style={{ background: T.accent, color: T.onAccent, borderRadius: 14, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, textDecoration: 'none' }}>Sign in</Link>
      </Shell>
    );
  }

  const { rows } = await db.query(
    `select p.first_name,
       (select id from development_record where person_id = p.id) as record_id,
       (select coalesce(json_agg(json_build_object(
           'id', c.id, 'firstName', c.first_name,
           'recordId', (select id from development_record where person_id = c.id),
           'approvedOn', to_char(g.approved_at at time zone 'Australia/Melbourne', 'DD Month'),
           'hasPending', exists(select 1 from profile_version pv
              join development_record dr2 on dr2.id = pv.record_id
              where dr2.person_id = c.id and pv.status = 'pending')
         )), '[]'::json)
        from guardianship_link g join person c on c.id = g.child_id
        where g.guardian_id = p.id and g.approved_at is not null and g.revoked_at is null) as children
     from person p where p.id = $1`,
    [personId],
  );
  const me = rows[0];
  if (!me) return <Shell><div style={{ fontSize: 14, color: T.secondary, fontWeight: 500 }}>Signed out.</div></Shell>;
  const children: { id: string; firstName: string; recordId: string | null; approvedOn: string; hasPending: boolean }[] = me.children;

  // Player seat: straight to their own build surface.
  if (children.length === 0 && me.record_id) {
    return (
      <Shell>
        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Build your CV</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <Link href={`/build/${me.record_id}`} style={{ background: T.accent, color: T.onAccent, borderRadius: 14, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, textDecoration: 'none' }}>Build your CV</Link>
          <Link href={`/build/${me.record_id}/clips`} style={{ border: `1px solid ${T.line}`, color: T.secondary, borderRadius: 14, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Highlights</Link>
          <Link href={`/build/${me.record_id}/more`} style={{ border: `1px solid ${T.line}`, color: T.secondary, borderRadius: 14, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Achievements &amp; other football</Link>
        </div>
      </Shell>
    );
  }

  // Guardian seat: the family view.
  return (
    <Shell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Your family</div>
        <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Everything about your children on Pitch, and every control over it, is here.</div>
      </div>
      {children.some((c) => c.hasPending) && (
        <div style={{ borderRadius: 18, background: 'linear-gradient(160deg, #123326, #0c1d14)', border: `1px solid ${T.accent}`, padding: 17, display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: 999, background: T.accent }} />
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.accent }}>Waiting on you</div>
          </div>
          {children.filter((c) => c.hasPending).map((c) => (
            <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 17, fontWeight: 900 }}>{c.firstName} changed {c.firstName === 'Georgia' ? 'her' : 'his'} page</div>
              <Link href={`/g/pending/${c.recordId}`} style={{ background: T.accent, color: T.onAccent, borderRadius: 14, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, textDecoration: 'none' }}>Review it</Link>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted }}>Your children</div>
        {children.map((c) => (
          <div key={c.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: T.secondary, flexShrink: 0 }}>{c.firstName[0]}</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{c.firstName}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
              <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500 }}>Approved by you on {c.approvedOn?.trim()}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link href={`/g/pending/${c.recordId}`} style={{ flex: 1, background: T.surface2, borderRadius: 14, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: T.ink, textDecoration: 'none' }}>Manage</Link>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
