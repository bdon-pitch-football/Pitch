// OpsVerification.dc.html — the queue of claimed clubs awaiting BUZ's call
// (D-126). Console surface. Dev-gated until operator auth exists; there is
// no automated approve control here or anywhere.
//
// Rebuilt to the signed design (brief G, 29 Sep): the signed table from 768px
// — Club · Claimed · Held · status · action — and on a phone each club on two
// lines, the details full width over the count, the status and the button.
// The signed warning's last sentence ("Payment does not change that") is
// left out while billing is off (D-163), and held for BUZ.
import Link from 'next/link';
import { db } from '@/lib/db';
import { OpsConsole, OpsHeader } from '@/components/console-shell';
import { requireOperator } from '@/lib/ops-guard';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Club verification', robots: { index: false, follow: false } };

// 'Sep', as every other date in the product writes it (en-AU gives 'Sept').
const day = (d: string) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Melbourne' }).replace('Sept', 'Sep');

// The signed "Claimed" column: "30 Aug · 2 days ago" while the club waits,
// the date alone once it is verified. Days are Melbourne days. Never "0 days"
// (D-162): the day of the claim is "today", in the design's own word.
const short = (d: string) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'Australia/Melbourne' }).replace('Sept', 'Sep');
const ago = (days: number) => days <= 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;

// The middle of the queue's Technical Director line. Every value in it comes
// from fn_club_td; nothing here decides anything (L23). Four states, because
// since 0060 there are four: the club's own address was recorded and nobody
// can hold the role, the role is live on an account under another name, the
// role is live, or it is waiting on that address being confirmed.
//
// A fifth since 0100: the access was ended after the call named them, and
// "waiting on their account" would be false. The words for it are NOT
// approved, so they render in development only (brief F: no new copy in
// production). In production the line carries no state rather than a wrong
// one, and the call sheet says what happened in BUZ's approved words.
const HELD_ENDED_STATE = process.env.NODE_ENV !== 'production' ? 'access ended' : null;
// A sixth since 0121 (brief H): a proved account under another name is HELD
// for a human, and "waiting on their account" would be false. Round H's
// name-mismatch words, approved in advance by BUZ with Leo's review (29 Sep).
const NAME_HELD_STATE = 'on hold: not the name on the call';
const tdState = (r: { active: boolean; club_mailbox: boolean; name_matches: boolean | null; account_name: string | null; ended_at: string | null; name_confirmed: boolean | null }) =>
  !r.club_mailbox && r.ended_at ? HELD_ENDED_STATE :
  !r.club_mailbox && !r.active && r.name_matches === false && !r.name_confirmed ? NAME_HELD_STATE :
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
       -- When the club was claimed: the claimant's seat began then, and it
       -- is the only row the claim writes that carries a time (0030).
       (select min(m.started_at) from membership m
        where m.club_id = c.id and m.role in ('technical_director','club_admin')) as claimed_at,
       (select ((now() at time zone 'Australia/Melbourne')::date
                - (min(m.started_at) at time zone 'Australia/Melbourne')::date)
        from membership m
        where m.club_id = c.id and m.role in ('technical_director','club_admin')) as claimed_days,
       td.td_name, td.recorded_at, td.recorded_by, td.active,
       td.account_name, td.name_matches, td.club_mailbox, td.ended_at, td.name_confirmed
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

  const chip = (state: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', background: T.surface2, borderRadius: 999, padding: '7px 14px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
      color: state === 'verified' ? T.accent : state === 'suspended' ? T.red : T.amber }}>
      {state === 'verified' ? 'Verified' : state === 'suspended' ? 'Suspended' : 'Awaiting call'}
    </span>
  );

  return (
    <OpsConsole active="verification">
      <div className="console" style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 40px 18px', boxSizing: 'border-box' }}>
        <OpsHeader title="Verification"
          sub={[
            // Never a zero (D-162): a part with nothing in it is left out.
            awaiting > 0 ? `${awaiting} club${awaiting === 1 ? '' : 's'} awaiting a call` : null,
            heldTotal > 0 ? `${heldTotal} registration${heldTotal === 1 ? '' : 's'} held` : null,
          ].filter(Boolean).join(' · ')} />
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden><path d="M12 8.5 v5" /><circle cx="12" cy="17" r="0.6" fill={T.red} /><path d="M10.3 3.6 L2.6 17.4 A1.9 1.9 0 0 0 4.3 20.3 H19.7 A1.9 1.9 0 0 0 21.4 17.4 L13.7 3.6 a1.9 1.9 0 0 0 -3.4 0 Z" /></svg>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.4 }}>Nothing about a person under 18 reaches any club on this list until you have made the call.</div>
            <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 700, lineHeight: 1.55, marginTop: 2 }}>Held registrations are hidden from the club entirely — it sees a count and nothing else.</div>
          </div>
        </div>
        <div className="ops-table">
          <div className="ops-head" aria-hidden>
            <div>Club</div><div>Claimed</div><div>Held</div><div /><div />
          </div>
          {rows.map((r) => (
            <div key={r.id} className="ops-row console-row-hover">
              <div className="ops-club">
                <div style={{ fontSize: 14, fontWeight: 800 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, marginTop: 2, lineHeight: 1.45 }}>{[
                  [r.suburb, r.state].filter(Boolean).join(' '),
                  r.claimant ? `claimed by ${r.claimant.replace('_', ' ')}` : null,
                ].filter(Boolean).join(' · ')}</div>
                {/* One line, and since 0060 it says where the role landed as
                    well as what was recorded: a club's own address can never
                    hold it, and an account under another name is named. */}
                <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.45, color: r.td_name ? (r.club_mailbox ? T.red : r.ended_at ? T.muted : r.active ? T.accent : T.amber) : T.muted }}>
                  {r.td_name
                    ? [`Technical Director ${r.td_name}`, tdState(r), `recorded by ${r.recorded_by} on ${day(r.recorded_at)}`].filter(Boolean).join(' · ')
                    : 'No Technical Director recorded'}
                </div>
              </div>
              <div className="ops-when" style={{ fontSize: 13, color: T.muted, fontWeight: 500 }}>{r.claimed_at
                ? (r.club_state === 'claimed' ? `${short(r.claimed_at)} · ${ago(r.claimed_days)}` : short(r.claimed_at))
                : null}</div>
              <div className="ops-held" style={{ fontSize: 13, fontWeight: 800, color: r.club_state === 'claimed' ? T.amber : T.muted, whiteSpace: 'nowrap' }}>
                {r.club_state === 'claimed' && r.held > 0
                  ? <>{r.held}<span className="ops-held-word"> held</span></>
                  : '—'}
              </div>
              <div className="ops-status">{chip(r.club_state)}</div>
              <div className="ops-action">
                <Link href={`/ops/call/${r.id}`} className="console-btn console-btn-primary">Open call sheet</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </OpsConsole>
  );
}
