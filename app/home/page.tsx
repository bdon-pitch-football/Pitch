// The signed-in landing — elevated pass (v3 discipline). Guardian seat:
// GuardianHome.dc.html with real status rows (approved date, live-link
// expiry, register count) and the priority ladder of waiting cards.
// Player seat: their page as it stands today, then the build actions.
// Signed-out: one quiet prompt. Copy stays verbatim to the signed screens.
import Link from 'next/link';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { POSITIONS, type PositionCode } from '@/lib/football';
import { answerCoachInvite } from '@/app/coach/invite/actions';
import { PlayerFrame, GuardianFrame } from '@/components/player-shell';
import RegisterReaders from '@/components/RegisterReaders';
import { ClubConsole, CoachConsole } from '@/components/console-shell';
import CopyLink from '@/components/cv/CopyLink';
import { T } from '@/lib/palette';
import { card, sectionLabel } from '@/lib/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Home', robots: { index: false, follow: false } };

const label = sectionLabel;

// framed: the page sits inside a seat's frame, which already paints the
// floodlight and fills the height — so the Shell brings only its column.
const Shell = ({ children, framed }: { children: React.ReactNode; framed?: boolean }) => framed ? (
  <div className="h-rise reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
    <HeaderMark />
    {children}
  </div>
) : (
  <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
    <style>{`
      @keyframes homeRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      .h-rise > * { animation: homeRise .55s cubic-bezier(.22,1,.36,1) both; }
      .h-rise > *:nth-child(2) { animation-delay: .06s } .h-rise > *:nth-child(3) { animation-delay: .12s }
      .h-rise > *:nth-child(4) { animation-delay: .18s } .h-rise > *:nth-child(5) { animation-delay: .24s }
      @media (prefers-reduced-motion: reduce) { .h-rise > * { animation: none } }
    `}</style>
    <div className="h-rise reading" style={{ width: '100%', minHeight: '100dvh', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
      <HeaderMark />
      {children}
    </div>
  </div>
);

const StatusRow = ({ color, path, children }: { color: string; path: string; children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
    <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500 }}>{children}</div>
  </div>
);

export default async function Home() {
  const personId = await getSessionPersonId();
  if (!personId) {
    return (
      <Shell>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Welcome back</h1>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500 }}>One account, whichever seat you hold.</div>
        </div>
        <Link href="/signin" className="btn btn-primary">Sign in</Link>
      </Shell>
    );
  }

  const { rows } = await db.query(
    `select p.first_name, p.photo_path, fn_age_band(p.dob) as band,
       (select id from development_record where person_id = p.id) as record_id,
       -- D-153: a player sees an invitation a club sent them. Until now only a
       -- guardian could, so an adult a club invited was never told anything.
       (select row_to_json(q4) from (
          select i.id, cl4.name as club,
            exists(select 1 from invitation_reply ir4 where ir4.invitation_id = i.id and ir4.approved_at is null) as draft
          from invitation i
          join registration r4 on r4.id = i.registration_id
          join club cl4 on cl4.id = i.club_id
          where r4.player_id = p.id
            and not exists (select 1 from invitation_reply ir5 where ir5.invitation_id = i.id and ir5.approved_at is not null)
          order by i.created_at desc limit 1) q4) as my_invitation,
       (select row_to_json(rec) from (
          select dr.positions, dr.squad_number, dr.foot,
            (select count(*)::int from highlight h where h.record_id = dr.id) as clips,
            (dr.about is not null and length(btrim(dr.about)) > 0) as has_about,
            exists(select 1 from player_stat ps where ps.record_id = dr.id and ps.value is not null) as has_stats,
            -- The live link, as the guardian's controls screen shows it: the
            -- HINT, never the token. The token is stored hashed and cannot be
            -- reconstructed here (D-80), so this page states what is true and
            -- sends people to the route that actually dispatches a link.
            (select row_to_json(tk) from (
               select st.token_hint,
                 to_char(st.expires_at at time zone 'Australia/Melbourne', 'DD Month') as expires
               from share_token st
               where st.record_id = dr.id and st.revoked_at is null and st.paused = false
                 and (st.expires_at is null or st.expires_at > now())
               order by st.issued_at desc limit 1) tk) as link
          from development_record dr where dr.person_id = p.id) rec) as my_page,
       -- What is coming up: the next trial at a club this player is already on
       -- the register of. Never their club_status, which no player ever sees
       -- (D-108, doc 14 N10).
       (select row_to_json(nx) from (
          select cl7.name as club, tn.title,
            to_char(tn.trial_on, 'Mon') as month, to_char(tn.trial_on, 'FMDD') as day, tn.time_venue
          from registration r7
          join club cl7 on cl7.id = r7.club_id
          join trial_notice tn on tn.club_id = r7.club_id
          where r7.player_id = p.id and r7.withdrawn_at is null
            and tn.trial_on >= (now() at time zone 'Australia/Melbourne')::date
          order by tn.trial_on limit 1) nx) as next_trial,
       (select count(*)::int from registration r8 where r8.player_id = p.id and r8.withdrawn_at is null) as my_registers,
       fn_has_approved_guardian(p.id) as has_guardian,
       (select row_to_json(cl) from (
          select c2.id, c2.name, c2.club_state, c2.public_slug, m.role,
            (select count(*)::int from registration r6 where r6.club_id = c2.id and r6.withdrawn_at is null) as register_count
          from membership m join club c2 on c2.id = m.club_id
          where m.person_id = p.id and m.role in ('technical_director','club_admin') and m.ended_at is null
          limit 1) cl) as club_seat,
       (select row_to_json(co) from (
          -- The link shows only while the page is live: published, not taken
          -- down (0043), and its owner an adult (0042).
          select case when cp.hidden_at is null and fn_coach_page_public(cp.id) then cp.public_slug end as public_slug,
            fn_age_band(p.dob) = '18plus' as adult,
            (cp.philosophy is not null and length(btrim(cp.philosophy)) > 0) as has_philosophy,
            exists(select 1 from coach_role cr where cr.coach_profile_id = cp.id) as has_role,
            exists(select 1 from coach_licence cl where cl.coach_profile_id = cp.id) as has_licence,
            exists(select 1 from coach_clip cc where cc.coach_profile_id = cp.id) as has_clip,
            -- The team NAMES this coach reads, never a count of who registered:
            -- counting would mean handing this page the rows, which is a read
            -- by a named person that D-154 logs where the rows are shown.
            (select coalesce(array_agg(distinct sq.name order by sq.name), '{}') from register_grant g2
               join squad sq on sq.id = g2.squad_id
              where g2.person_id = p.id and g2.revoked_at is null
                and g2.squad_id in (select fn_register_grant_squads(p.id, g2.club_id))) as register_team_names,
            (select count(*)::int from coaching_role r9 join club c9 on c9.id = r9.club_id
              where r9.closed_at is null
                and (r9.closes_on is null or r9.closes_on >= (now() at time zone 'Australia/Melbourne')::date)) as open_roles,
            (select c3.name from membership m2 join club c3 on c3.id = m2.club_id
             where m2.person_id = p.id and m2.role = 'coach' and m2.ended_at is null limit 1) as club,
            -- D-154: the teams whose registrations this coach reads today.
            (select count(*)::int from register_grant g
             where g.person_id = p.id and g.revoked_at is null
               and g.squad_id in (select fn_register_grant_squads(p.id, g.club_id))) as register_teams,
            (select coalesce(json_agg(json_build_object('id', ci.id, 'club', c4.name,
                'teams', (select array_agg(sq.name order by sq.name) from squad sq where sq.id = any(ci.squad_ids)))), '[]'::json)
             from coach_invite ci join club c4 on c4.id = ci.club_id
             where ci.person_id = p.id and ci.answered_at is null) as invites
          from coach_profile cp where cp.person_id = p.id) co) as coach_seat,
       (select coalesce(json_agg(json_build_object(
           'id', c.id, 'firstName', c.first_name, 'photo', c.photo_path,
           'recordId', (select id from development_record where person_id = c.id),
           'approvedOn', to_char(g.approved_at at time zone 'Australia/Melbourne', 'DD Month'),
           'linkExpiry', (select to_char(st.expires_at at time zone 'Australia/Melbourne', 'DD Month')
              from share_token st join development_record dr5 on dr5.id = st.record_id
              where dr5.person_id = c.id and st.revoked_at is null and st.paused = false
                and (st.expires_at is null or st.expires_at > now())
              order by st.issued_at desc limit 1),
           -- Days rather than a date, because "expiring in 11 days" is the
           -- figure a parent acts on and "08 December" is the one they have
           -- to work out.
           'expiresInDays', (select (st.expires_at::date - (now() at time zone 'Australia/Melbourne')::date)
              from share_token st join development_record dr7 on dr7.id = st.record_id
              where dr7.person_id = c.id and st.revoked_at is null and st.paused = false
                and st.expires_at is not null and st.expires_at > now()
              order by st.issued_at desc limit 1),
           'pendingAt', (select max(pv.created_at) from profile_version pv
              join development_record dr6 on dr6.id = pv.record_id
              where dr6.person_id = c.id and pv.status = 'pending'),
           'registers', (select count(*)::int from registration r5 where r5.player_id = c.id and r5.withdrawn_at is null),
           'hasPending', exists(select 1 from profile_version pv
              join development_record dr2 on dr2.id = pv.record_id
              where dr2.person_id = c.id and pv.status = 'pending'),
           'invitation', (select row_to_json(q3) from (
              select i.id, i.created_at as at, cl2.name as club,
                exists(select 1 from invitation_reply ird where ird.invitation_id = i.id and ird.approved_at is null) as draft
              from invitation i
              join registration r2 on r2.id = i.registration_id
              join club cl2 on cl2.id = i.club_id
              where r2.player_id = c.id
                -- a player's draft is still waiting on the parent, so it stays on the list
                and not exists (select 1 from invitation_reply ir where ir.invitation_id = i.id and ir.approved_at is not null)
              order by i.created_at desc limit 1) q3),
           'sendRequest', (select row_to_json(q) from (
              select sr.id, sr.created_at as at, sr.destination from share_request sr
              join development_record dr3 on dr3.id = sr.record_id
              where dr3.person_id = c.id and sr.dispatched_at is null
              order by sr.created_at desc limit 1) q),
           'interestRequest', (select row_to_json(q2) from (
              select rr.id, rr.created_at as at, cl.name as club from registration_request rr
              join development_record dr4 on dr4.id = rr.record_id
              join club cl on cl.id = rr.club_id
              where dr4.person_id = c.id and rr.dispatched_at is null
              order by rr.created_at desc limit 1) q2)
         )), '[]'::json)
        from guardianship_link g join person c on c.id = g.child_id
        where g.guardian_id = p.id and g.approved_at is not null and g.revoked_at is null) as children
     from person p where p.id = $1`,
    [personId],
  );
  const me = rows[0];
  if (!me) return <Shell><div style={{ fontSize: 14, color: T.secondary, fontWeight: 500 }}>Signed out.</div></Shell>;
  const children: {
    id: string; firstName: string; photo: string | null; recordId: string | null; approvedOn: string;
    linkExpiry: string | null; expiresInDays: number | null; registers: number;
    hasPending: boolean; pendingAt: string | null;
    invitation: { id: string; at: string; club: string; draft: boolean } | null;
    sendRequest: { id: string; at: string; destination: string } | null;
    interestRequest: { id: string; at: string; club: string } | null;
  }[] = me.children;

  const clubSeat = me.club_seat as { id: string; name: string; club_state: string; public_slug: string | null; role: string; register_count: number } | null;
  const coachSeat = me.coach_seat as {
    public_slug: string | null; adult: boolean; club: string | null; register_teams: number;
    has_philosophy: boolean; has_role: boolean; has_licence: boolean; has_clip: boolean;
    register_team_names: string[]; open_roles: number;
    invites: { id: string; club: string; teams: string[] }[];
  } | null;

  // Club seat: TD or administrator — inside the club's frame (D-147 as
  // amended 16 Sep). This was a register count and six grey links. It is now
  // what a club comes back for: what is waiting on the register, the trials
  // coming up, and its own page with the link to copy.
  //
  // The register numbers come from fn_register_rows — the same permission
  // function the register page reads — aggregated IN THE DATABASE, so only
  // totals reach this page and no child's details do. Only the technical
  // director sees them: under D-154 an administrator reads no registration,
  // and before verification the club sees a held count and nothing else
  // (D-126).
  if (clubSeat) {
    const verified = clubSeat.club_state === 'verified';
    const isTd = clubSeat.role === 'technical_director';
    const counts = verified && isTd
      ? Object.fromEntries((await db.query(
          `select club_status, count(*)::int as n from fn_register_rows($1, $2) group by club_status`,
          [personId, clubSeat.id],
        )).rows.map((r: { club_status: string; n: number }) => [r.club_status, r.n])) as Record<string, number>
      : {};
    const onRegister = Object.values(counts).reduce((a, b) => a + b, 0);
    const trials = verified ? (await db.query(
      `select t.id, t.title, to_char(t.trial_on, 'Mon') as month, to_char(t.trial_on, 'FMDD') as day, t.time_venue,
         (select count(*)::int from registration r where r.trial_notice_id = t.id and r.withdrawn_at is null) as interested
       from trial_notice t
       where t.club_id = $1 and t.trial_on >= (now() at time zone 'Australia/Melbourne')::date
       order by t.trial_on limit 3`,
      [clubSeat.id],
    )).rows as { id: string; title: string; month: string; day: string; time_venue: string; interested: number }[] : [];
    const openRoles = (await db.query(
      `select count(*)::int as n from coaching_role where club_id = $1 and closed_at is null
         and (closes_on is null or closes_on >= (now() at time zone 'Australia/Melbourne')::date)`,
      [clubSeat.id],
    )).rows[0].n as number;
    const pageUrl = clubSeat.public_slug ? `pitchfootball.com.au/fc/${clubSeat.public_slug}` : null;
    const tile = (n: number, word: string, color: string) => (
      <div>
        <div className="numeral numeral-m" style={{ color }}>{n}</div>
        <div className="kicker" style={{ marginTop: 4, color: 'rgba(255,255,255,.55)' }}>{word}</div>
      </div>
    );

    return (
      <ClubConsole active="home" floodlight>
        <div className="console h-rise" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
          <HeaderMark />
          <div className="player-grid">
          <div>
            <div className="sheen" style={{ borderRadius: 22, background: 'linear-gradient(160deg, #123326 0%, #0c1d14 60%, #0a1510 100%)', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div aria-hidden style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,.12)', border: '1.5px solid rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, flexShrink: 0 }}>{clubSeat.name[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1 style={{ fontSize: 21, fontWeight: 900, letterSpacing: '-0.015em', lineHeight: 1.15, margin: 0 }}>{clubSeat.name}</h1>
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.7)', fontWeight: 500, marginTop: 3 }}>
                    {me.first_name} · {isTd ? 'Technical Director' : 'Club administrator'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: verified ? T.accent : T.amber }} />
                <div style={{ fontSize: 11.5, fontWeight: 800, color: verified ? T.accent : T.amber }}>
                  {verified ? 'Verified club' : 'Awaiting verification — registrations are held'}
                </div>
              </div>
              {verified && isTd && onRegister > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
                  <div>
                    <div className="numeral numeral-l" style={{ color: T.ink }}>{onRegister}</div>
                    <div className="kicker" style={{ marginTop: 4, color: 'rgba(255,255,255,.55)' }}>On your register</div>
                  </div>
                  {tile(counts.new ?? 0, 'New', T.accent)}
                  {tile(counts.shortlisted ?? 0, 'Shortlisted', T.amber)}
                  {tile(counts.invited ?? 0, 'Invited', T.purple)}
                </div>
              )}
              {!verified && (
                <div style={{ fontSize: 17, fontWeight: 900 }}>{clubSeat.register_count} waiting</div>
              )}
            </div>

            {verified && isTd && (counts.new ?? 0) > 0 && (
              <Link href="/club/register?status=new" className="lift" style={{ ...card, display: 'flex', alignItems: 'center', gap: 13, textDecoration: 'none', border: `1px solid ${T.accent}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 900, color: T.ink }}>{counts.new} new on the register</div>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: T.muted }}>Open a CV, shortlist, or invite to a trial.</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
              </Link>
            )}

            {verified && (
              <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h2 style={label}>Coming up</h2>
                {trials.length === 0 ? (
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: T.secondary, lineHeight: 1.5 }}>No trials coming up. Post one and it goes on your club page and the trials board the same minute.</div>
                ) : trials.map((t) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div aria-hidden style={{ width: 46, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, background: T.surface2, borderRadius: 12, padding: '7px 0' }}>
                      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.accent }}>{t.month}</div>
                      <div className="tnum" style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, color: T.ink }}>{t.day}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{t.title}</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: T.muted }}>{t.time_venue}</div>
                    </div>
                    {isTd && t.interested > 0 && <div style={{ fontSize: 12, fontWeight: 800, color: T.accent, flexShrink: 0 }}>{t.interested} interested</div>}
                  </div>
                ))}
              </div>
            )}

            {pageUrl && (
              <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.accent, overflowWrap: 'anywhere' }}>{pageUrl}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 500, color: T.muted }}>Your club page · public</div>
                </div>
                <CopyLink url={`https://${pageUrl}`} label="Copy" compact />
              </div>
            )}
          </div>

          <div>
            {/* D-154: a named person reads the register — the TD. An administrator
                keeps the club's page, squads, trials and billing, and before
                verification the waiting count, which holds no child's details. */}
            {(isTd || !verified) && (
              <Link href="/club/register" className="btn btn-primary">Register</Link>
            )}
            {verified && (
              <Link href="/club/post-trial" className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Post a trial</Link>
            )}
            <Link href="/club/squads" className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Squads</Link>
            <Link href="/club/page-edit" className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Crest &amp; club page</Link>
            <Link href="/club/roles" className="lift" style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textDecoration: 'none' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.secondary }}>Coaching roles</div>
              {openRoles > 0 && <div style={{ fontSize: 12, fontWeight: 800, color: T.accent }}>{openRoles} open</div>}
            </Link>
            {clubSeat.public_slug && (
              <Link href={`/fc/${clubSeat.public_slug}`} className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Your club page</Link>
            )}
            <Link href="/club/billing" className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Plan &amp; billing</Link>
          </div>
          </div>
        </div>
      </ClubConsole>
    );
  }

  // Coach seat — inside the coach's frame (D-147, amended 16 Sep). This was
  // the same title-and-grey-buttons menu the player's home was. It is now
  // the state of the coach's football: their public page and its link to
  // copy (D-100 — public by design, so it CAN be shown in full, unlike a
  // player's), how complete the page is, the teams they read for a club,
  // and the roles clubs are hiring for.
  if (coachSeat) {
    const url = coachSeat.public_slug ? `pitchfootball.com.au/c/${coachSeat.public_slug}` : null;
    const steps = [
      { done: Boolean(me.photo_path), label: 'Add a profile photo' },
      { done: coachSeat.has_philosophy, label: 'Write how you coach' },
      { done: coachSeat.has_role, label: 'Add a coaching role' },
      { done: coachSeat.has_licence, label: 'Add a licence or course' },
      { done: coachSeat.has_clip, label: 'Add a session clip' },
      // The last step is the one that makes the rest findable. An under-18
      // cannot publish (0042), so it is not a step for them.
      ...(coachSeat.adult ? [{ done: Boolean(coachSeat.public_slug), label: 'Publish your page' }] : []),
    ];
    const done = steps.filter((x) => x.done).length;
    const todo = steps.filter((x) => !x.done).slice(0, 2);
    return (
      <CoachConsole active="home">
        <div className="console h-rise" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
          <HeaderMark />
          <div className="player-grid">
          <div>
            <div className="sheen" style={{ borderRadius: 22, background: 'linear-gradient(160deg, #123326 0%, #0c1d14 60%, #0a1510 100%)', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                {me.photo_path ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={me.photo_path} alt="" width={52} height={52} className="avatar-ring" style={{ borderRadius: 16, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div aria-hidden style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 19, flexShrink: 0 }}>{me.first_name[0]}</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1 style={{ fontSize: 21, fontWeight: 900, letterSpacing: '-0.015em', lineHeight: 1.15, margin: 0 }}>Your coach page</h1>
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.7)', fontWeight: 500, marginTop: 3 }}>{me.first_name}{coachSeat.club ? ` · ${coachSeat.club}` : ''}</div>
                </div>
              </div>
              {url ? (
                <div style={{ background: 'rgba(11,18,14,.5)', border: `1px solid ${T.line}`, borderRadius: 12, padding: '8px 8px 8px 13px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.accent, overflowWrap: 'anywhere' }}>{url}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 500, color: 'rgba(255,255,255,.6)' }}>Public · paste it wherever you talk to clubs and families</div>
                  </div>
                  <CopyLink url={`https://${url}`} label="Copy" compact />
                </div>
              ) : (
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,.7)', lineHeight: 1.5 }}>{coachSeat.adult ? 'Your page gets its own link once you publish it.' : 'Your coach page can go public once you turn 18.'}</div>
              )}
            </div>

            {coachSeat.invites.map((inv) => (
              <div key={inv.id} style={{ ...card, border: `1.5px solid ${T.accent}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800 }}>{inv.club} wants you as their coach for {inv.teams.join(', ')}</div>
                <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>You&rsquo;ll be able to read the registrations for those teams. You won&rsquo;t be able to invite a family or change anything, and every one you open is recorded.</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <form action={answerCoachInvite} style={{ flex: 1, display: 'flex' }}><input type="hidden" name="inviteId" value={inv.id} /><input type="hidden" name="answer" value="accept" />
                    <button type="submit" className="btn btn-primary">Accept</button>
                  </form>
                  <form action={answerCoachInvite} style={{ flex: 1, display: 'flex' }}><input type="hidden" name="inviteId" value={inv.id} /><input type="hidden" name="answer" value="decline" />
                    <button type="submit" className="btn btn-secondary">Not now</button>
                  </form>
                </div>
              </div>
            ))}

            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <h2 style={label}>Your page</h2>
                <div style={{ fontSize: 12, fontWeight: 800, color: T.secondary }}>{done} of {steps.length} done</div>
              </div>
              <div aria-hidden style={{ height: 6, borderRadius: 999, background: T.surface2, overflow: 'hidden' }}>
                <div style={{ width: `${Math.round((done / steps.length) * 100)}%`, height: 6, borderRadius: 999, background: T.accent }} />
              </div>
              {todo.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {todo.map((t) => (
                    <Link key={t.label} href="/coach/edit" className="lift" style={{ display: 'flex', alignItems: 'center', gap: 11, minHeight: 44, background: T.surface2, borderRadius: 12, padding: '0 12px', textDecoration: 'none' }}>
                      <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: T.ink }}>{t.label}</div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
                    </Link>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12.5, fontWeight: 500, color: T.secondary, lineHeight: 1.5 }}>Every part of your page is filled in.</div>
              )}
            </div>

            {coachSeat.register_teams > 0 && (
              <Link href="/coach/register" className="lift" style={{ ...card, display: 'flex', alignItems: 'center', gap: 13, textDecoration: 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.ink }}>Registrations for your teams</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: T.muted }}>{coachSeat.register_team_names.join(' · ')}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
              </Link>
            )}
          </div>

          <div>
            <Link href="/coach/edit" className="btn btn-primary">Edit my coach CV</Link>
            {coachSeat.public_slug && (
              <Link href={`/c/${coachSeat.public_slug}`} className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>See my public page</Link>
            )}
            {coachSeat.register_teams > 0 && (
              <Link href="/coach/register" className="lift" style={{ ...card, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Registrations</Link>
            )}
            <Link href="/jobs" className="lift" style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textDecoration: 'none' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.secondary }}>Coaching roles at clubs</div>
              {coachSeat.open_roles > 0 && <div style={{ fontSize: 12, fontWeight: 800, color: T.accent }}>{coachSeat.open_roles} open</div>}
            </Link>
          </div>
          </div>
        </div>
      </CoachConsole>
    );
  }

  // Player seat. This was a title and four grey buttons on a screen with
  // 400px of nothing under them (BUZ, 16 Sep: "it looks like just words
  // slapped on an app"). It is now the state of your football: whether your
  // page is live, how much of it is built and what to do next, and what is
  // coming up — inside the player frame, so no screen is a dead end.
  if (children.length === 0 && me.record_id) {
    const pg = me.my_page as {
      positions: string[]; squad_number: number | null; foot: string | null; clips: number;
      has_about: boolean; has_stats: boolean;
      link: { token_hint: string | null; expires: string | null } | null;
    } | null;
    const next = me.next_trial as { club: string; title: string; month: string; day: string; time_venue: string } | null;
    const rec = me.record_id as string;

    // Six things make a page worth sending. Each one is a real field, and
    // each undone one links to the screen that fills it in — nothing here is
    // a score, and nothing is invented.
    const steps = [
      { done: Boolean(me.photo_path), label: 'Add a profile photo', href: `/build/${rec}` },
      { done: (pg?.positions?.length ?? 0) > 0, label: 'Pick your positions', href: `/build/${rec}` },
      { done: pg?.squad_number != null, label: 'Add your squad number', href: `/build/${rec}` },
      { done: Boolean(pg?.has_about), label: 'Write your About line', href: `/build/${rec}` },
      { done: Boolean(pg?.has_stats), label: 'Add a season stat', href: `/build/${rec}` },
      { done: (pg?.clips ?? 0) > 0, label: 'Add a highlight clip', href: `/build/${rec}/clips` },
    ];
    const done = steps.filter((x) => x.done).length;
    const todo = steps.filter((x) => !x.done).slice(0, 2);
    const live = Boolean(pg?.link);

    return (
      <PlayerFrame active="home">
        <div className="console h-rise" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
          <HeaderMark />
          <div className="player-grid">
          <div>
          <div className="sheen" style={{ borderRadius: 22, background: 'linear-gradient(160deg, #123326 0%, #0c1d14 60%, #0a1510 100%)', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
              {me.photo_path ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={me.photo_path} alt="" width={52} height={52} className="avatar-ring" style={{ borderRadius: 16, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div aria-hidden style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 19, flexShrink: 0 }}>{me.first_name[0]}</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: 21, fontWeight: 900, letterSpacing: '-0.015em', lineHeight: 1.15, margin: 0 }}>
                  {live ? 'Your page is live' : 'Your page'}
                </h1>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.7)', fontWeight: 500, marginTop: 3 }}>
                  {[
                    (pg?.positions ?? []).join(' · ') || null,
                    pg?.squad_number ? `#${pg.squad_number}` : null,
                    me.first_name ? null : null,
                  ].filter(Boolean).join(' · ') || 'No positions picked yet'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: live ? 'rgba(61,220,132,.16)' : 'rgba(255,255,255,.1)', borderRadius: 999, padding: '5px 10px', flexShrink: 0 }}>
                <div aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: live ? T.accent : T.muted }} />
                <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: live ? T.accent : 'rgba(255,255,255,.75)' }}>{live ? 'Live' : 'Not sent yet'}</div>
              </div>
            </div>
            {live ? (
              <div style={{ background: 'rgba(11,18,14,.5)', border: `1px solid ${T.line}`, borderRadius: 12, padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.accent }}>pitchfootball.com.au/p/{pg?.link?.token_hint ?? '····'}</div>
                <div style={{ fontSize: 11.5, fontWeight: 500, color: 'rgba(255,255,255,.6)' }}>
                  {pg?.link?.expires ? `Live · expires ${pg.link.expires.trim()}` : 'Live · no expiry'}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,.7)', lineHeight: 1.5 }}>
                You haven&rsquo;t sent your page to anyone yet. It goes to a club as a link.
              </div>
            )}
          </div>

          {me.my_invitation && (
            <Link href={`/g/invite/${me.my_invitation.id}`} className="lift" style={{ ...card, border: `1px solid ${T.purple}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textDecoration: 'none' }}>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 900, color: T.ink }}>{me.my_invitation.club} would like you at a trial</div>
                <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>
                  {me.my_invitation.draft ? 'Your reply is with your parent to approve.' : me.band === '18plus' ? 'Reply when you are ready — or don’t.' : 'Your parent can see it too.'}
                </div>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, flexShrink: 0 }}>Open</div>
            </Link>
          )}

          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <h2 style={label}>Your page</h2>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.secondary }}>{done} of {steps.length} done</div>
            </div>
            <div aria-hidden style={{ height: 6, borderRadius: 999, background: T.surface2, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((done / steps.length) * 100)}%`, height: 6, borderRadius: 999, background: T.accent }} />
            </div>
            {todo.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {todo.map((t) => (
                  <Link key={t.label} href={t.href} className="lift" style={{ display: 'flex', alignItems: 'center', gap: 11, minHeight: 44, background: T.surface2, borderRadius: 12, padding: '0 12px', textDecoration: 'none' }}>
                    <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: T.ink }}>{t.label}</div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
                  </Link>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, fontWeight: 500, color: T.secondary, lineHeight: 1.5 }}>Every part of your page is filled in.</div>
            )}
          </div>

          {next && (
            <Link href="/trials" className="lift" style={{ ...card, display: 'flex', alignItems: 'center', gap: 13, textDecoration: 'none' }}>
              <div aria-hidden style={{ width: 46, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, background: T.surface2, borderRadius: 12, padding: '7px 0' }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.accent }}>{next.month}</div>
                <div className="tnum" style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, color: T.ink }}>{next.day}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.ink }}>{next.club} · {next.title}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: T.muted }}>{next.time_venue}</div>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: T.accent, marginTop: 2 }}>You are on their register</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
            </Link>
          )}

          </div>

          <div>
            {me.band === '16_17' && !me.has_guardian ? (
              // 0048: a 16–17 sends only once a parent has confirmed.
              <div role="status" style={{ ...card, border: `1px solid ${T.amber}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>Waiting on your parent</div>
                <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>
                  We&rsquo;ve texted and emailed them to confirm they&rsquo;re your parent. Once they do, you can send your CV to clubs. Keep building your page in the meantime.
                </div>
              </div>
            ) : (
              <Link href={`/send/${rec}`} className="btn btn-primary">Send my CV to a club</Link>
            )}
            <div style={{ display: 'flex', gap: 9 }}>
              <Link href={`/build/${rec}`} className="lift" style={{ ...card, flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Build your CV</Link>
              <Link href="/trials" className="lift" style={{ ...card, flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Trials near you</Link>
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <Link href={`/build/${rec}/clips`} className="lift" style={{ ...card, flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Highlights</Link>
              <Link href={`/build/${rec}/more`} className="lift" style={{ ...card, flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.secondary, textDecoration: 'none' }}>Achievements</Link>
            </div>
            {/* doc 34 rule 6 (0047): a player 16 or over sees who read their
                registrations; an under-16's parent sees it on their controls. */}
            {me.band !== 'u16' && me.my_registers > 0 && (
              <div style={{ marginTop: 16 }}>
                <RegisterReaders viewerId={personId as string} personId={personId as string} name={null} />
              </div>
            )}
          </div>
          </div>
        </div>
      </PlayerFrame>
    );
  }

  // THE FIRST SCREEN A REAL USER SEES, and it used to be a title, one
  // sentence and NOTHING ELSE — no link, no next step, a complete dead end
  // at the exact moment somebody has just decided to trust us. Every fixture
  // person already had something, so nobody had ever rendered it.
  //
  // These are the doors that actually work for an account with nothing on
  // it. Nothing here is aspirational: each one is a page that exists.
  if (children.length === 0) {
    return (
      <Shell>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Welcome, {me.first_name}</h1>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Your account is set up. Here is what you can do with it.</div>
        </div>

        <Link href="/coach/edit" className="lift" style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textDecoration: 'none' }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 900, color: T.ink }}>Build a coach CV</div>
            <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>Your roles, your licences, one link to send</div>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, flexShrink: 0 }}>Start</div>
        </Link>

        <Link href="/trials" className="lift" style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textDecoration: 'none' }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 900, color: T.ink }}>Trials near you</div>
            <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>Every notice we hold, by date</div>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, flexShrink: 0 }}>Open</div>
        </Link>

        <Link href="/jobs" className="lift" style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textDecoration: 'none' }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 900, color: T.ink }}>Coaching roles at clubs</div>
            <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>Nothing here is ranked or recommended</div>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, flexShrink: 0 }}>Open</div>
        </Link>

        <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
          Adding a child, claiming a club page and building a player CV are not on this screen yet — tell us which you came for and we will point you at it.
        </div>
        <Link href="/signout" className="btn btn-ghost">Sign out</Link>
      </Shell>
    );
  }

  // How long something has been sitting there. A parent scanning this page is
  // asking "what have I left?" and a date makes them work it out.
  const waitedFor = (iso: string): string => {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (days < 1) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 14) return `${days} days ago`;
    if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  // Every waiting item in ONE list, OLDEST FIRST — the thing that has been
  // waiting longest is the thing to do next, and that is the only ordering
  // here anybody can defend. Before this the cards came out grouped by type
  // and three of the four carried a full-width accent button, so nothing led
  // and the quiet one was quiet for no reason.
  type Waiting = { key: string; kind: 'invite' | 'send' | 'interest' | 'edit';
                   at: string; href: string; tone: string; title: string; body?: string; cta: string };
  const waiting: Waiting[] = [
    ...children.filter((c) => c.invitation).map((c) => ({
      key: c.invitation!.id, kind: 'invite' as const, at: c.invitation!.at,
      href: `/g/invite/${c.invitation!.id}`, tone: T.purple,
      title: c.invitation!.draft
        ? `${c.firstName} wants to reply to ${c.invitation!.club}`
        : `${c.invitation!.club} would like ${c.firstName} at a trial`,
      body: c.invitation!.draft
        ? `Nothing goes to the club until you approve it.`
        : `${c.firstName} can see it too. Nothing goes back to the club until you approve a reply.`,
      cta: 'Review it',
    })),
    ...children.filter((c) => c.sendRequest).map((c) => ({
      key: c.sendRequest!.id, kind: 'send' as const, at: c.sendRequest!.at,
      href: `/g/send/${c.sendRequest!.id}`, tone: T.accent,
      title: `${c.firstName} wants to send a CV to ${/^(.*) </.exec(c.sendRequest!.destination ?? '')?.[1] ?? 'a club'}`,
      body: 'Nothing has been sent. Check the address and it goes; do nothing and the request disappears on its own.',
      cta: 'Review it',
    })),
    ...children.filter((c) => c.interestRequest).map((c) => ({
      key: c.interestRequest!.id, kind: 'interest' as const, at: c.interestRequest!.at,
      href: `/g/interest/${c.interestRequest!.id}`, tone: T.purple,
      title: `${c.firstName} wants to go on ${c.interestRequest!.club}\u2019s register`,
      body: `There\u2019s a line about ${c.firstName}, in ${c.firstName}\u2019s own words. Read it before it goes — you can change it.`,
      cta: 'Read it',
    })),
    ...children.filter((c) => c.hasPending && c.pendingAt).map((c) => ({
      key: `edit-${c.id}`, kind: 'edit' as const, at: c.pendingAt!,
      href: `/g/pending/${c.recordId}`, tone: T.accent,
      title: `${c.firstName} changed the page`,
      body: 'Until you approve it, every club holding the link still reads the old version.',
      cta: 'Review it',
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  // The three figures a parent actually wants, and we hold all of them. This
  // page had no hero and no numbers at all — the club page gets a crest and
  // numerals, and the person we most need to reassure got a title.
  const linksActive = children.filter((c) => c.linkExpiry).length;
  const expiringSoon = children.filter((c) => c.expiresInDays !== null && c.expiresInDays <= 30).length;
  const clubsHolding = children.reduce((n, c) => n + c.registers, 0);

  // Guardian seat — inside the parent's frame (D-147, amended 16 Sep).
  return (
    <GuardianFrame active="home">
    <Shell framed>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Your family</h1>
        <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Everything about your children on Pitch, and every control over it, is here.</div>
      </div>

      {/* The state of things, in three numbers. Nothing here is new data —
          it is what the child cards below already say, added up, which is
          the form a parent can take in at a glance. */}
      <div style={{ borderRadius: 22, background: 'linear-gradient(160deg, #123326 0%, #0c1d14 60%, #0a1510 100%)', padding: '20px 20px 18px 20px', display: 'flex', alignItems: 'flex-end', gap: 26, flexWrap: 'wrap' }}>
        <div>
          <div className="numeral numeral-m" style={{ color: T.ink }}>{linksActive}</div>
          <div className="kicker" style={{ marginTop: 4, color: 'rgba(255,255,255,.55)' }}>{linksActive === 1 ? 'Link active' : 'Links active'}</div>
        </div>
        <div>
          <div className="numeral numeral-m" style={{ color: expiringSoon > 0 ? T.amber : 'rgba(255,255,255,.45)' }}>{expiringSoon}</div>
          <div className="kicker" style={{ marginTop: 4, color: 'rgba(255,255,255,.55)' }}>Expiring in 30 days</div>
        </div>
        <div>
          <div className="numeral numeral-m" style={{ color: 'var(--accent)' }}>{clubsHolding}</div>
          <div className="kicker" style={{ marginTop: 4, color: 'rgba(255,255,255,.55)' }}>{clubsHolding === 1 ? 'Club register' : 'Club registers'}</div>
        </div>
      </div>

      {/* Oldest first, and only the top one carries the accent button. Three
          primary buttons in a row is the same as none. */}
      {waiting.map((w, i) => (
        <div key={w.key} className={i === 0 ? 'sheen' : 'lift'} style={{
          borderRadius: 18, padding: 17, display: 'flex', flexDirection: 'column', gap: 12,
          background: i === 0 ? 'linear-gradient(160deg, #123326, #0c1d14)' : T.surface,
          border: `1px solid ${i === 0 ? w.tone : T.line}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: 999, background: w.tone }} />
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: w.tone }}>Waiting on you</div>
            <div style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: T.muted }}>{waitedFor(w.at)}</div>
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, lineHeight: 1.2 }}>{w.title}</div>
          {w.body && <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>{w.body}</div>}
          <Link href={w.href} className={i === 0 ? 'btn btn-primary' : 'btn btn-secondary'}>{w.cta}</Link>
        </div>
      ))}

      {/* The public trials board shipped in launch scope (D-74, D-90) and
          NOTHING IN THE PRODUCT LINKED TO IT — it existed and no user could
          find it. This is a parent's entry point; the player seat has the
          same link below its build cards. */}
      <Link href="/trials" className="lift" style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textDecoration: 'none' }}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 900, color: T.ink }}>Trials near you</div>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>Every notice we hold, newest first</div>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, flexShrink: 0 }}>Open</div>
      </Link>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <h2 id="children" style={label}>Your children</h2>
        {children.map((c) => (
          <div key={c.id} className="lift" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {c.photo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={c.photo} alt="" width={52} height={52} className="avatar-ring" style={{ borderRadius: 16, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 52, height: 52, borderRadius: 16, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: T.secondary, flexShrink: 0 }}>{c.firstName[0]}</div>
              )}
              <div style={{ fontSize: 16, fontWeight: 800 }}>{c.firstName}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <StatusRow color={T.accent} path="M5 12.5 l4.5 4.5 L19 7">Approved by you on {c.approvedOn?.trim()}</StatusRow>
              {c.linkExpiry && <StatusRow color={T.accent} path="M10 13 a4 4 0 0 1 0-6 l3-3 a4 4 0 0 1 6 6 l-1.5 1.5 M14 11 a4 4 0 0 1 0 6 l-3 3 a4 4 0 0 1-6-6 l1.5-1.5">Link active · expires {c.linkExpiry.trim()}</StatusRow>}
              {c.registers > 0 && <StatusRow color={T.muted} path="M4 6 h16 M4 12 h16 M4 18 h10">On {c.registers} club register{c.registers === 1 ? '' : 's'}</StatusRow>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link href={`/g/controls/${c.id}`} style={{ flex: 1, background: T.surface2, borderRadius: 14, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: T.ink, textDecoration: 'none' }}>Manage</Link>
            </div>
          </div>
        ))}
      </div>
    </Shell>
    </GuardianFrame>
  );
}
