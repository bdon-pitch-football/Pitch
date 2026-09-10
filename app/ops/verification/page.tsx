// OpsVerification.dc.html — the queue of claimed clubs awaiting BUZ's call
// (D-126). Console surface. Dev-gated until operator auth exists; there is
// no automated approve control here or anywhere.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';
import { requireOperator } from '@/lib/ops-guard';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
  amber: '#eda100', red: '#e34948',
};

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Club verification', robots: { index: false, follow: false } };

export default async function OpsVerification() {
  await requireOperator();
  const { rows } = await db.query(
    `select c.id, c.name, c.suburb, c.state, c.club_state,
       (select count(*)::int from registration r where r.club_id = c.id and r.withdrawn_at is null) as held,
       (select p.first_name || ' ' || coalesce(p.last_name,'') || ', ' || m.role
        from membership m join person p on p.id = m.person_id
        where m.club_id = c.id and m.role in ('technical_director','club_admin') and m.ended_at is null
        limit 1) as claimant
     from club c where c.club_state in ('claimed','verified','suspended')
     order by case c.club_state when 'claimed' then 0 else 1 end, c.created_at desc`,
  );
  const awaiting = rows.filter((r) => r.club_state === 'claimed').length;
  const heldTotal = rows.filter((r) => r.club_state === 'claimed').reduce((s, r) => s + r.held, 0);

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="console" style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 40px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/home' }} />
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 800 }}>Verification</h1>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{awaiting} clubs awaiting a call · {heldTotal} registrations held</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M12 3 L22 20 H2 Z" /><path d="M12 9.5 v4.5" /><circle cx="12" cy="16.8" r="0.6" fill={T.red} /></svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.45 }}>Nothing about a person under 18 reaches any club on this list until you have made the call.</div>
            <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>Held registrations are hidden from the club entirely — it sees a count and nothing else. Payment does not change that and cannot.</div>
          </div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '6px 14px' }}>
          {rows.map((r, i) => (
            <div key={r.id} className="lift" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 12px', margin: '0 -12px', borderRadius: 12, borderTop: i === 0 ? 'none' : `1px solid ${T.surface2}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{r.name}</div>
                <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 500 }}>{[
                  [r.suburb, r.state].filter(Boolean).join(' '),
                  r.claimant ? `claimed by ${r.claimant.replace('_', ' ')}` : null,
                ].filter(Boolean).join(' · ')}</div>
              </div>
              <div style={{ width: 40, textAlign: 'center', fontSize: 13, fontWeight: 900, color: r.club_state === 'claimed' ? T.amber : T.muted }}>{r.club_state === 'claimed' ? r.held : '—'}</div>
              <div style={{ background: T.surface2, borderRadius: 999, padding: '4px 10px', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: r.club_state === 'verified' ? T.accent : r.club_state === 'suspended' ? T.red : T.amber }}>
                {r.club_state === 'verified' ? 'Verified' : r.club_state === 'suspended' ? 'Suspended' : 'Awaiting call'}
              </div>
              <Link href={`/ops/call/${r.id}`} style={{ border: `1px solid ${T.line}`, borderRadius: 12, height: 36, padding: '0 12px', display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 700, color: T.secondary, textDecoration: 'none', flexShrink: 0 }}>Open call sheet</Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
