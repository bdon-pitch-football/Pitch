// OpsVerification.dc.html — the queue of claimed clubs awaiting BUZ's call
// (D-126). Console surface. Dev-gated until operator auth exists; there is
// no automated approve control here or anywhere.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';
import { OpsConsole } from '@/components/console-shell';
import { requireOperator } from '@/lib/ops-guard';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Club verification', robots: { index: false, follow: false } };

// 'Sep', as every other date in the product writes it (en-AU gives 'Sept').
const day = (d: string) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Melbourne' }).replace('Sept', 'Sep');

// The middle of the queue's Technical Director line. Every value in it comes
// from fn_club_td; nothing here decides anything (L23). Four states, because
// since 0060 there are four: the club's own address was recorded and nobody
// can hold the role, the role is live on an account under another name, the
// role is live, or it is waiting on that address being confirmed.
const tdState = (r: { active: boolean; club_mailbox: boolean; name_matches: boolean | null; account_name: string | null }) =>
  r.club_mailbox ? 'the club\u2019s own address, so nobody holds the role'
    : r.active && r.name_matches === false ? `active on ${r.account_name}\u2019s account`
    : r.active ? 'active'
    : 'waiting on their account';

export default async function OpsVerification() {
  await requireOperator();
  const { rows } = await db.query(
    `select c.id, c.name, c.suburb, c.state, c.club_state,
       (select count(*)::int from registration r where r.club_id = c.id and r.withdrawn_at is null) as held,
       (select p.first_name || ' ' || coalesce(p.last_name,'') || ', ' || m.role
        from membership m join person p on p.id = m.person_id
        where m.club_id = c.id and m.role in ('technical_director','club_admin') and m.ended_at is null
        limit 1) as claimant,
       td.td_name, td.recorded_at, td.recorded_by, td.active,
       td.account_name, td.name_matches, td.club_mailbox
     from club c
     -- Who the club's Technical Director is, whether the role is live, and
     -- since 0060 whose account the recorded address actually is: the
     -- database's own answer (fn_club_td), one row per club or none.
     left join lateral (select * from fn_club_td(c.id)) td on true
     where c.club_state in ('claimed','verified','suspended')
     order by case c.club_state when 'claimed' then 0 else 1 end, c.created_at desc`,
  );
  const awaiting = rows.filter((r) => r.club_state === 'claimed').length;
  const heldTotal = rows.filter((r) => r.club_state === 'claimed').reduce((s, r) => s + r.held, 0);

  return (
    <OpsConsole active="verification">
      <div className="console" style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 40px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/home' }} />
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 800 }}>Verification</h1>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{awaiting} club{awaiting === 1 ? '' : 's'} awaiting a call · {heldTotal} registration{heldTotal === 1 ? '' : 's'} held</div>
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
                {/* One line, and since 0060 it says where the role landed as
                    well as what was recorded: a club's own address can never
                    hold it, and an account under another name is named. */}
                <div style={{ fontSize: 11.5, fontWeight: 500, color: r.td_name ? (r.club_mailbox ? T.red : r.active ? T.accent : T.amber) : T.muted }}>
                  {r.td_name
                    ? `Technical Director ${r.td_name} · ${tdState(r)} · recorded by ${r.recorded_by} on ${day(r.recorded_at)}`
                    : 'No Technical Director recorded'}
                </div>
              </div>
              <div style={{ width: 40, textAlign: 'center', fontSize: 13, fontWeight: 900, color: r.club_state === 'claimed' ? T.amber : T.muted }}>{r.club_state === 'claimed' ? r.held : '—'}</div>
              <div style={{ background: T.surface2, borderRadius: 999, padding: '4px 10px', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: r.club_state === 'verified' ? T.accent : r.club_state === 'suspended' ? T.red : T.amber }}>
                {r.club_state === 'verified' ? 'Verified' : r.club_state === 'suspended' ? 'Suspended' : 'Awaiting call'}
              </div>
              <Link href={`/ops/call/${r.id}`} style={{ border: `1px solid ${T.line}`, borderRadius: 12, height: 44, padding: '0 14px', display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 700, color: T.secondary, textDecoration: 'none', flexShrink: 0 }}>Open call sheet</Link>
            </div>
          ))}
        </div>
      </div>
    </OpsConsole>
  );
}
