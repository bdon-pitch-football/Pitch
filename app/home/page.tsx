// The signed-in landing — elevated pass (v3 discipline). Guardian seat:
// GuardianHome.dc.html with real status rows (approved date, live-link
// expiry, register count) and the priority ladder of waiting cards.
// Player seat: their page as it stands today, then the build actions.
// Signed-out: one quiet prompt. Copy stays verbatim to the signed screens.
//
// FLOODLIT (spec A, the homes; BUZ approved 1 Oct). Every seat's home is the
// same three layers, built only from the shell parts in globals.css:
//   1. who and where you are — the HERO PANEL;
//   2. the one thing to do next — the lead notice, or the screen's single
//      glowing primary (.fl-glow, Head of Product Design ruling 1);
//   3. everything else as quiet rows — the centred grey menu cards are one
//      DOOR LIST, with the same doors, words and conditions.
// A-P1 (approved): on a phone each seat's one primary sits directly under its
// hero. The DOM order is the phone order (.hg-top, .hg-lead, .hg-main,
// .hg-aside); from 1024px named grid areas put the primary back at the head
// of the aside, so the laptop is unchanged. No query below changed for this.
import Link from 'next/link';
import { SUPPORT_EMAIL } from '@/lib/support';
import { db } from '@/lib/db';
import { waitingRecords } from '@/lib/cv-build';
import { imageSrc } from '@/lib/storage';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { answerCoachInvite } from '@/app/coach/invite/actions';
import { PlayerFrame, GuardianFrame } from '@/components/player-shell';
import RegisterReaders from '@/components/RegisterReaders';
import RegisterPaused from '@/components/RegisterPaused';
import WhileYouWereAway from '@/components/WhileYouWereAway';
import SquadCard from '@/components/SquadCard';
import { ClubConsole, CoachConsole, TopBarShell, ICONS, type IconKey } from '@/components/console-shell';
import CopyLink from '@/components/cv/CopyLink';
import { billingEnabled, PRICES } from '@/lib/billing';
import { T } from '@/lib/palette';
import { ADMIN_NO_TD_LINE } from '@/lib/home-copy';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Home', robots: { index: false, follow: false } };

// The two homes with no seat — signed out, and an account with nothing on it
// yet — render outside a frame, so they take the TOP BAR (spec A part 5): the
// logo top right on a phone, top left from 1024px, and .has-topbar hides the
// column's own mark so there is one logo at every width. The reading column
// is 640 from 1024px, centred. Its old inline <style> block (homeRise) is
// gone: globals.css has carried the same rules since 16 Sep.
const Shell = ({ children }: { children: React.ReactNode }) => (
  <TopBarShell>
    <div className="h-rise reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
      <HeaderMark />
      {children}
    </div>
  </TopBarShell>
);

// A framed home's column: `console h-rise` and the home grid inside it.
const COLUMN: React.CSSProperties = { width: '100%', display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' };

const StatusRow = ({ color, path, children }: { color: string; path: string; children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
    <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500 }}>{children}</div>
  </div>
);

// The row's way on (spec A part 13): a chevron where the row has no end word.
const Chev = () => (
  <span className="row-chev">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
  </span>
);

// One row of a DOOR LIST: the frame's own glyph, the door's word, and its end
// word or a chevron. The same href and label the centred card carried.
type DoorParts = { icon: IconKey; label: string; sub?: string; end?: React.ReactNode };
const DoorInner = ({ icon, label, sub, end }: DoorParts) => (
  <>
    <span className="row-ic">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--secondary)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS[icon]}</svg>
    </span>
    <span className="row-main">
      <span className="row-t">{label}</span>
      {sub && <span className="row-s">{sub}</span>}
    </span>
    {end ? <span className="row-end">{end}</span> : <Chev />}
  </>
);
// `rail`: the frame's rail carries this door too, so from 1024 the aside
// drops it (audit ruling 6, BUZ 2 Oct). A door with a live count or a reason
// line the rail lacks is never marked. Below 1024 every door shows.
const Door = ({ href, rail = false, ...parts }: DoorParts & { href: string; rail?: boolean }) => (
  <Link href={href} className={rail ? 'row rail-dup' : 'row'}><DoorInner {...parts} /></Link>
);

// The approved TRIAL ROW, date first (the club page's and the board's day
// numeral and month), sized for a home panel. The date is decoration for a
// screen reader, as it was: the title and the time say it in words.
const TrialLine = ({ day, month, first, children, end }: { day: string; month: string; first: boolean; children: React.ReactNode; end?: React.ReactNode }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr) auto', columnGap: 12, alignItems: 'center', ...(first ? {} : { borderTop: `1px solid ${T.line}`, paddingTop: 12 }) }}>
    <div aria-hidden style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="numeral fl-trial-day">{day}</div>
      <div className="fl-trial-mon" style={{ textTransform: 'uppercase' }}>{month}</div>
    </div>
    <div style={{ minWidth: 0 }}>{children}</div>
    {end ?? <span />}
  </div>
);

export default async function Home({ searchParams }: { searchParams: Promise<{ taken?: string; squad?: string }> }) {
  const { taken, squad } = await searchParams;
  const personId = await getSessionPersonId();
  if (!personId) {
    // A form is a door (spec A part 20): the two lines and Sign in sit in one
    // door panel from 640px. Sign in is the only primary, so it glows.
    return (
      <Shell>
        <div className="door">
          <div className="pg-titles">
            <h1 className="pg-title">Welcome back</h1>
            <div className="pg-sub">One account, whichever seat you hold.</div>
          </div>
          <Link href="/signin" className="btn btn-primary fl-glow">Sign in</Link>
        </div>
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
                 to_char(st.expires_at at time zone 'Australia/Melbourne', 'FMDD FMMonth') as expires
               from share_token st
               where st.record_id = dr.id and st.revoked_at is null and st.paused = false
                 and (st.expires_at is null or st.expires_at > now())
               order by st.issued_at desc limit 1) tk) as link
          from development_record dr where dr.person_id = p.id) rec) as my_page,
       -- What is coming up: the next trial at a club this player is already on
       -- the register of. Never their club_status, which no player ever sees
       -- (D-108, doc 14 N10). Only a notice the board itself would show (0140):
       -- a suspended club's trial is not put in front of a child here either.
       (select row_to_json(nx) from (
          select cl7.name as club, tn.title,
            to_char(tn.trial_on, 'Mon') as month, to_char(tn.trial_on, 'FMDD') as day, tn.time_venue
          from registration r7
          join club cl7 on cl7.id = r7.club_id
          join fn_trial_notices_advertised() tn on tn.club_id = r7.club_id
          where r7.player_id = p.id and r7.withdrawn_at is null
            -- A trial has a day; an open-now expression of interest (0173)
            -- has none, so it is never "what is coming up".
            and tn.trial_on is not null
            -- A-P4 (BUZ, 1 Oct, option a): only a trial for the age group of
            -- the player's own current squad. Age group lives on the squad,
            -- never the person (D-68, D-25), so a player with no squad is
            -- shown no next trial rather than one for somebody else's age.
            and exists (select 1 from membership m7
                          join squad s7 on s7.id = m7.squad_id
                          join trial_notice_age_group ta7 on ta7.trial_notice_id = tn.id and ta7.age_group = s7.age_group
                         where m7.person_id = p.id and m7.role = 'player' and m7.ended_at is null)
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
            (select count(*)::int from fn_coaching_roles_advertised()) as open_roles,
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
           'approvedOn', to_char(g.approved_at at time zone 'Australia/Melbourne', 'FMDD FMMonth'),
           'linkExpiry', (select to_char(st.expires_at at time zone 'Australia/Melbourne', 'FMDD FMMonth')
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
           'registers', (select count(*)::int from registration r5 where r5.player_id = c.id and r5.withdrawn_at is null),
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
  // Photos as addresses for this read (John's ruling §1): the person's own,
  // and each child's — the query above returns only children this session is
  // an approved, unrevoked guardian of.
  me.photo_path = await imageSrc(me.photo_path);
  for (const c of me.children as { photo: string | null }[]) c.photo = await imageSrc(c.photo);
  // "{child} changed the page" is listed only when something waits on this
  // parent by the ONE answer the review gives (lib/cv-build waitingRecords,
  // Leo 2 Oct): never for a change only to which stats are shown, or to the
  // club line, which /g/pending does not draw and calls "Nothing is waiting".
  {
    const kids = me.children as { recordId: string | null; hasPending?: boolean; pendingAt?: string | null }[];
    const waiting = await waitingRecords(kids.map((c) => c.recordId).filter((x): x is string => Boolean(x)));
    for (const c of kids) { c.pendingAt = c.recordId ? waiting.get(c.recordId) ?? null : null; c.hasPending = c.pendingAt !== null; }
  }
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
       from fn_trial_notices_advertised() t
       where t.club_id = $1 and t.trial_on is not null
       order by t.trial_on limit 3`,
      [clubSeat.id],
    )).rows as { id: string; title: string; month: string; day: string; time_venue: string; interested: number }[] : [];
    // What is on the board for this club (0151), as its trials card above
    // counts what is on the board: none while it is suspended.
    const openRoles = (await db.query(
      `select count(*)::int as n from fn_coaching_roles_advertised() where club_id = $1`,
      [clubSeat.id],
    )).rows[0].n as number;
    const pageUrl = clubSeat.public_slug ? `pitchfootball.com.au/fc/${clubSeat.public_slug}` : null;
    // D-163: free until further notice. While billing is off (0075) there is no plan to
    // go and look at, so the door to one is not drawn — the same condition
    // the sidebar uses, from the same function.
    const billing = await billingEnabled();
    // D-162: a zero is never rendered as a value or a count — it is omitted.
    // A squad with no confirmed players in October and a squad nobody has
    // filled in are not the same thing, and "0" makes them identical.
    // The numeral keeps `numeral numeral-m` exactly: the zero sweep reads it.
    const tile = (n: number, word: string, color: string) => n > 0 ? (
      <div>
        <div className="numeral numeral-m" style={{ color }}>{n}</div>
        <div className="stat-l">{word}</div>
      </div>
    ) : null;

    // THE ADMINISTRATOR'S HOME (club-home-admin.html, 23 Sep; BUZ asked for it
    // 28 Sep). It was the technical director's screen rendered for somebody
    // with none of her access: the hero carried a register row an
    // administrator correctly cannot have (D-93, D-154), so it drew three
    // lines and 50px of blank and read as a card that failed to load — and the
    // right rail was the sidebar again, word for word, as six identical grey
    // buttons with no primary action anywhere on the screen. It is very often
    // the first Pitch screen anybody at a club opens.
    //
    // What replaces it: the three numbers an administrator IS entitled to —
    // squads, live notices, open roles, none of which touches a registration —
    // one accent action, the club's public state, and a plain statement of
    // their own limits. Not one registration and not one child's name reaches
    // this screen.
    const admin = !isTd ? (await db.query(
      `select
         (select count(*)::int from squad s where s.club_id = $1) as squads,
         -- Live means on the board (0140): a suspended club has none live.
         (select count(*)::int from fn_trial_notices_advertised() t where t.club_id = $1) as trials_live,
         c.crest_path is null as no_crest,
         (c.philosophy is null or length(btrim(c.philosophy)) = 0) as no_philosophy
       from club c where c.id = $1`,
      [clubSeat.id],
    )).rows[0] as { squads: number; trials_live: number; no_crest: boolean; no_philosophy: boolean } : null;
    // Who can do what here — the one place in the product where D-93's role
    // split is said out loud to the person it constrains. The database's
    // answer, never assembled here (L23): the same function /club/billing
    // reads, so the two screens cannot disagree about who reads the register.
    const canDo = !isTd ? (await db.query(
      `select reader_id, reader_name, role_label, scope, squad_names,
         to_char(since at time zone 'Australia/Melbourne', 'FMDD Mon') as since
       from fn_club_register_readers($1, $2)`,
      [personId, clubSeat.id],
    )).rows as { reader_id: string; reader_name: string | null; role_label: string; scope: 'whole' | 'squads' | 'none'; squad_names: string[]; since: string | null }[] : [];
    const theTd = canDo.find((r) => r.scope === 'whole');
    // B2: is there a Technical Director with an account? A technical_director
    // membership is only ever attached to a person whose own email is proved
    // (0100, fn_attach_recorded_td), so a TD row in the database's answer
    // above IS a TD with an account. No new query.
    const hasTd = canDo.some((r) => r.role_label === 'Technical Director');
    const plan = !isTd ? (await db.query(
      `select fn_register_payment_state($1, c.id) as pay_state, c.plan,
         to_char(c.current_period_end at time zone 'Australia/Melbourne', 'FMDD Mon') as renews
       from club c where c.id = $2`,
      [personId, clubSeat.id],
    )).rows[0] as { pay_state: string | null; plan: string | null; renews: string | null } : null;
    // What an administrator's own row says, in words rather than as a shrug.
    const canDoLine = (r: typeof canDo[number]) =>
      r.scope === 'whole' ? 'Technical Director — the register, and the club\u2019s development record'
      : r.scope === 'squads' ? `Coach — the registrations for ${r.squad_names.join(' and ')}${r.since ? `, since ${r.since}` : ''}`
      // Live copy fix 1 (BUZ, 1 Oct): there is no plan while billing is off
      // (D-163), so "and the plan" returns only with the switch.
      : r.role_label === 'Club administrator' ? (billing
        ? 'Club administrator — the page, squads, notices, coaching roles and the plan. No registrations.'
        : 'Club administrator — the page, squads, notices and coaching roles. No registrations.')
      : `${r.role_label} — no registrations.`;

    // FLOODLIT (spec A): one hero for every club seat — the crest initial, the
    // club, who you are, the club's state as a PILL, and the numbers this seat
    // is entitled to as a STAT ROW (the TD's register totals in their state
    // colours; the administrator's furniture in ink; before verification the
    // held count and nothing else, D-126).
    const tdHome = verified && isTd;
    const hero = (
      <div className="hero-panel sheen">
        <div className="hero-id">
          <div aria-hidden className="hero-av">{clubSeat.name[0]}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="hero-h">{clubSeat.name}</h1>
            <div className="hero-m">
              {me.first_name} · {isTd ? 'Technical Director' : 'Club administrator'}
            </div>
          </div>
        </div>
        <span className={verified ? 'pill pill-live' : 'pill pill-wait pill-wrap'} style={{ alignSelf: 'flex-start' }}>
          {verified ? 'Verified club' : 'Awaiting verification — registrations are held'}
        </span>
        {verified && isTd && onRegister > 0 && (
          <div className="stat-row" style={{ gap: 24 }}>
            <div>
              <div className="numeral numeral-l" style={{ color: T.ink }}>{onRegister}</div>
              <div className="stat-l">On your register</div>
            </div>
            {tile(counts.new ?? 0, 'New', T.accent)}
            {tile(counts.shortlisted ?? 0, 'Shortlisted', T.amber)}
            {tile(counts.invited ?? 0, 'Invited', T.purple)}
          </div>
        )}
        {/* The administrator's numbers. Squads, notices and roles are the
            club's own furniture — no registration, no count of children,
            nothing about anybody under 18. Each is omitted at zero (D-162)
            rather than printed as a 0 beside a label, and all three are ink:
            they are facts, not actions or states. */}
        {verified && !isTd && admin && (admin.squads > 0 || admin.trials_live > 0 || openRoles > 0) && (
          <div className="stat-row">
            {admin.squads > 0 && (
              <div>
                <div className="numeral numeral-l" style={{ color: T.ink }}>{admin.squads}</div>
                <div className="stat-l">{admin.squads === 1 ? 'Squad you run' : 'Squads you run'}</div>
              </div>
            )}
            {tile(admin.trials_live, 'Trials live', T.ink)}
            {tile(openRoles, openRoles === 1 ? 'Coaching role open' : 'Coaching roles open', T.ink)}
          </div>
        )}
        {verified && !isTd && theTd?.reader_name && (
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.62)', fontWeight: 500, lineHeight: 1.6 }}>
            The register is {theTd.reader_name.split(' ')[0]}&rsquo;s. You keep the club&rsquo;s page, its squads, its notices.
          </div>
        )}

        {/* D-162: the held count is a fact about absence when it is zero,
            and a fact about absence belongs in words, not as a 0. Above zero
            it is the hero's one stat: the numeral and the word "waiting". */}
        {!verified && (clubSeat.register_count > 0 ? (
          <div className="stat-row">
            <div>
              <div className="numeral numeral-l" style={{ color: T.ink }}>{clubSeat.register_count}</div>
              <div className="stat-l">waiting</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 17, fontWeight: 900 }}>Nobody is waiting yet</div>
        ))}
      </div>
    );

    // A-P7 (BUZ, 1 Oct, option A): an unverified club is told what happens
    // next — a call, to a number we find ourselves — and its one glow is the
    // step that moves it forward. Register stays, as a secondary, so no door
    // is lost (D-147).
    const whatNext = !verified && (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 className="panel-h">What happens next</h2>
        <div style={{ fontSize: 14.5, fontWeight: 900 }}>A short phone call with us</div>
        <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>We ring {clubSeat.name} on a number we find ourselves, not one you give us. Let the club know to expect us.</div>
        <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`A good time to ring ${clubSeat.name}`)}`} className="btn btn-primary fl-glow">Email us a good time to ring</a>
        <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, overflowWrap: 'anywhere' }}>{SUPPORT_EMAIL}</div>
      </div>
    );

    // Coming up: the approved trial row, date first. Empty, it is the dashed
    // "not yet" tile with its sentence as ONE element (ah12c reads it whole).
    const comingUp = verified && (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 className="panel-h">Coming up</h2>
        {trials.length === 0 ? (
          <div className="empty" style={{ padding: '4px 0 0 0' }}>
            <div className="empty-tile" aria-hidden />
            <div className="empty-b">No trials coming up. Post one and it goes on your club page and the trials board the same minute.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {trials.map((t, i) => (
              <TrialLine key={t.id} day={t.day} month={t.month} first={i === 0}
                end={isTd && t.interested > 0 ? <div style={{ fontSize: 12, fontWeight: 800, color: T.muted, flexShrink: 0 }}>{t.interested} interested</div> : undefined}>
                <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.3 }}>{t.title}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: T.muted }}>{t.time_venue}</div>
              </TrialLine>
            ))}
          </div>
        )}
        {!isTd && trials.length > 0 && (
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.6 }}>A notice comes off the board by itself the day after its date. Nobody has to remember.</div>
        )}
      </div>
    );

    // What a family cannot see yet. Two things, and the block is absent when
    // neither is missing — never a completeness score, and never an empty
    // prompt (D-74's objection to the three dropped club-page blocks, and
    // D-162's). Each is a list row ending in its own word.
    const missing = !isTd && admin && (admin.no_crest || admin.no_philosophy) && (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h2 className="panel-h">What a family cannot see yet</h2>
        <div className="rows">
          {admin.no_crest && (
            <Link href="/club/page-edit" className="row" style={{ padding: '10px 0' }}>
              <span className="row-main">
                <span className="row-t" style={{ fontSize: 13.5 }}>Your crest</span>
                <span className="row-s" style={{ fontSize: 12 }}>The page shows an initial where the crest goes.</span>
              </span>
              <span className="row-end">Add it</span>
            </Link>
          )}
          {admin.no_philosophy && (
            <Link href="/club/page-edit" className="row" style={{ padding: '10px 0' }}>
              <span className="row-main">
                <span className="row-t" style={{ fontSize: 13.5 }}>How the club plays</span>
                <span className="row-s" style={{ fontSize: 12 }}>The section is left out rather than shown empty.</span>
              </span>
              <span className="row-end">Write it</span>
            </Link>
          )}
        </div>
        <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.6 }}>Two things, not a score. A club page with nothing missing is not a better club.</div>
      </div>
    );

    const linkPanel = pageUrl && isTd && (
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="link-1" style={{ fontSize: 13, fontWeight: 800, color: T.accent }}>{pageUrl}</div>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: T.muted }}>Your club page · public</div>
        </div>
        <CopyLink url={`https://${pageUrl}`} label="Copy" compact />
      </div>
    );

    // THE TECHNICAL DIRECTOR'S DOORS: the six centred grey menu cards are one
    // door list, with the same hrefs, labels and conditions. It still repeats
    // the sidebar — dropping it is A-P2, which is "not now" — but quietly.
    const doors = isTd && (
      <div className="card rows doors">
        {verified && <Door href="/club/post-trial" icon="trials" label="Post a trial" rail />}
        <Door href="/club/squads" icon="children" label="Squads" rail />
        <Door href="/club/page-edit" icon="crest" label="Crest & club page" rail />
        <Door href="/club/roles" icon="roles" label="Coaching roles" end={openRoles > 0 ? <>{openRoles} open</> : undefined} rail={!(openRoles > 0)} />
        {clubSeat.public_slug && <Door href={`/fc/${clubSeat.public_slug}`} icon="page" label="Your club page" rail />}
        {/* D-163: the same switch as the sidebar's door (perms free5d). */}
        {billing && (
          <Link href="/club/billing" className="row rail-dup"><DoorInner icon="card" label="Plan & billing" /></Link>
        )}
      </div>
    );

    // The administrator's aside: the club's public state, not a second copy
    // of the sidebar. Every door here is still in the frame beside it (D-147:
    // the rail is a second way to the same doors, never a new one).
    const adminAside = !isTd && (
      <>
        {pageUrl && (
          <div className="card-sunken" style={{ padding: '16px 15px', display: 'flex', flexDirection: 'column', gap: 11 }}>
            <h2 className="panel-h">Your club page</h2>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.accent, overflowWrap: 'anywhere' }}>{pageUrl}</div>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              <CopyLink url={`https://${pageUrl}`} label="Copy the link" compact />
              {/* Was a 44px, 999-radius outlined link — a third button style.
                  The charter's secondary now, the same word and href. */}
              <Link href={`/fc/${clubSeat.public_slug}`} className="btn btn-secondary btn-auto" style={{ padding: '0 16px' }}>Open it</Link>
            </div>
            <hr style={{ height: 1, background: T.line, border: 'none', margin: 0 }} />
            <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.6 }}>
              Public and live.{admin && admin.trials_live > 0 ? ' Your trial notices are on it and on the trials board.' : ''}
            </div>
          </div>
        )}

        {/* The safety story on the screen an administrator meets first, and
            the only place D-93's split is said out loud to the person it
            constrains. The database's answer, not this page's (L23). */}
        {canDo.length > 0 && (
          <div className="card-sunken" style={{ padding: '16px 15px', display: 'flex', flexDirection: 'column', gap: 11 }}>
            <h2 className="panel-h">Who can do what here</h2>
            {canDo.map((r, i) => (
              <div key={r.reader_id} style={{ borderTop: i === 0 ? undefined : `1px solid ${T.line}`, paddingTop: i === 0 ? 0 : 11 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink }}>
                  {r.reader_id === personId ? 'You' : r.reader_name ?? 'A club member'}
                </div>
                <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, marginTop: 2, lineHeight: 1.5 }}>{canDoLine(r)}</div>
              </div>
            ))}
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.6 }}>
              A treasurer who sends the invoices should not be able to read a child&rsquo;s development notes. That is on purpose.
            </div>
          </div>
        )}

        {/* D-163: no price anywhere while billing is off — by rule, from the
            same switch as the sidebar's door, not by the accident of
            fn_register_payment_state answering 'free' (A-P8). */}
        {billing && plan?.pay_state === 'active' && (
          <Link href="/club/billing" className="card-sunken lift" style={{ padding: '16px 15px', display: 'flex', flexDirection: 'column', gap: 6, textDecoration: 'none' }}>
            <h2 className="panel-h">Plan</h2>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink }}>
              {(plan.plan === 'register_annual' ? PRICES.register_annual : PRICES.register_monthly).label}
              {plan.renews ? ` · next charge ${plan.renews.trim()}` : ''}
            </div>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.6 }}>The receipt is addressed to the club, not to you, so it can be reimbursed without an argument.</div>
          </Link>
        )}
        {billing && plan && (plan.pay_state === 'grace' || plan.pay_state === 'suspended') && (
          <RegisterPaused state={plan.pay_state} billingLink />
        )}
      </>
    );

    return (
      <ClubConsole active="home">
        <div className="console home-col h-rise" style={COLUMN}>
          <HeaderMark />
          {tdHome ? (
            // The verified TD (A-P1): hero, then Register — the seat's one
            // primary — then what is new, what is coming up, and the page.
            // D-154: a named person reads the register, the TD.
            <div className="home-grid hg-p1">
              <div className="hg-top">{hero}</div>
              <div className="hg-lead">
                <Link href="/club/register" className="btn btn-primary fl-glow">Register</Link>
              </div>
              <div className="hg-main">
                {(counts.new ?? 0) > 0 && (
                  <Link href="/club/register?status=new" className="card card-accent row fl-float lift">
                    <span className="row-main">
                      <span className="row-t">{counts.new} new on the register</span>
                      <span className="row-s">Open a CV, shortlist, or invite to a trial.</span>
                    </span>
                    <Chev />
                  </Link>
                )}
                {comingUp}
                {linkPanel}
              </div>
              <div className="hg-aside">{doors}</div>
            </div>
          ) : (
            // The administrator (the one accent action, Post a trial notice,
            // already sits under the hero) and the unverified club.
            <div className="home-grid">
              <div>
                {hero}
                {whatNext}
                {verified && !isTd && (
                  <Link href="/club/post-trial" className="btn btn-primary fl-glow">Post a trial notice</Link>
                )}
                {/* B2 (BUZ, 1 Oct; spec A, mockup #ad-notd): after verification
                    the TD may never be told to sign up. While no TD has an
                    account, an amber notice directly under the one primary
                    says so — a state, so no button and no glow — and the
                    hero has no "The register is…" line to name nobody.
                    Nothing is sent to anyone. */}
                {verified && !isTd && !hasTd && (
                  <div role="status" className="card card-amber" data-no-td style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, lineHeight: 1.5 }}>{ADMIN_NO_TD_LINE}</div>
                )}
                {comingUp}
                {missing}
                {linkPanel}
              </div>
              <div>
                {/* Before verification the waiting count, which holds no
                    child's details — a secondary since A-P7. */}
                {!verified && (
                  <Link href="/club/register" className="btn btn-secondary">Register</Link>
                )}
                {doors}
                {adminAside}
              </div>
            </div>
          )}
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
        <div className="console home-col h-rise" style={COLUMN}>
          <HeaderMark />
          <div className="home-grid hg-p1">
          <div className="hg-top">
            <div className="hero-panel sheen">
              <div className="hero-id">
                {me.photo_path ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={me.photo_path} alt="" width={52} height={52} className="hero-av avatar-ring" />
                ) : (
                  <div aria-hidden className="hero-av">{me.first_name[0]}</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1 className="hero-h">Your coach page</h1>
                  <div className="hero-m">{me.first_name}{coachSeat.club ? ` · ${coachSeat.club}` : ''}</div>
                </div>
              </div>
              {url ? (
                <div className="hero-well">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="link-1" style={{ fontSize: 13, fontWeight: 800, color: T.accent }}>{url}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 500, color: 'rgba(255,255,255,.6)' }}>Public · paste it wherever you talk to clubs and families</div>
                  </div>
                  <CopyLink url={`https://${url}`} label="Copy" compact />
                </div>
              ) : (
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,.7)', lineHeight: 1.5 }}>{coachSeat.adult ? 'Your page gets its own link once you publish it.' : 'Your coach page can go public once you turn 18.'}</div>
              )}
            </div>
          </div>

          {/* The coach's one primary, and the screen's one glow — with or
              without an invitation (spec A; A-P1 puts it under the hero). */}
          <div className="hg-lead">
            <Link href="/coach/edit" className="btn btn-primary fl-glow">Edit my coach CV</Link>
          </div>

          <div className="hg-main">
            {/* A club's invitation is a purple notice, lifted. Accepting joins
                the coach to a club, so Accept and Not now take D-PD-0's equal
                weight: the same secondary, the same width, and neither glows
                (Head of Product Design, 1 Oct). Both are the forms they were. */}
            {coachSeat.invites.map((inv) => (
              <div key={inv.id} className="card card-purple fl-float" style={{ borderWidth: 1.5, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800 }}>{inv.club} wants you as their coach for {inv.teams.join(', ')}</div>
                <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>You&rsquo;ll be able to read the registrations for those teams. You won&rsquo;t be able to invite a family or change anything, and every one you open is recorded.</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <form action={answerCoachInvite} style={{ flex: 1, display: 'flex' }}><input type="hidden" name="inviteId" value={inv.id} /><input type="hidden" name="answer" value="accept" />
                    <button type="submit" className="btn btn-secondary">Accept</button>
                  </form>
                  <form action={answerCoachInvite} style={{ flex: 1, display: 'flex' }}><input type="hidden" name="inviteId" value={inv.id} /><input type="hidden" name="answer" value="decline" />
                    <button type="submit" className="btn btn-secondary">Not now</button>
                  </form>
                </div>
              </div>
            ))}

            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <h2 className="panel-h">Your page</h2>
                {/* D-162: "0 of 6 done" prints a zero as a value. The bar
                    below says the same thing without it. */}
                {done > 0 && <div style={{ fontSize: 12, fontWeight: 800, color: T.secondary }}>{done} of {steps.length} done</div>}
              </div>
              <div aria-hidden style={{ height: 6, borderRadius: 999, background: T.surface2, overflow: 'hidden' }}>
                <div style={{ width: `${Math.round((done / steps.length) * 100)}%`, height: 6, borderRadius: 999, background: T.accent }} />
              </div>
              {todo.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {todo.map((t) => (
                    <Link key={t.label} href="/coach/edit" className="row-step lift">
                      <span style={{ flex: 1 }}>{t.label}</span>
                      <Chev />
                    </Link>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12.5, fontWeight: 500, color: T.secondary, lineHeight: 1.5 }}>Every part of your page is filled in.</div>
              )}
            </div>

            {coachSeat.register_teams > 0 && (
              <Link href="/coach/register" className="card row lift">
                <span className="row-main">
                  <span className="row-t" style={{ fontSize: 14 }}>Registrations for your teams</span>
                  <span className="row-s" style={{ fontSize: 12 }}>{coachSeat.register_team_names.join(' · ')}</span>
                </span>
                <Chev />
              </Link>
            )}
          </div>

          {/* The three aside cards are one door list, with the same hrefs. */}
          <div className="hg-aside">
            <div className="card rows doors">
              {coachSeat.public_slug && <Door href={`/c/${coachSeat.public_slug}`} icon="page" label="See my public page" />}
              {coachSeat.register_teams > 0 && <Door href="/coach/register" icon="register" label="Registrations" rail />}
              <Door href="/jobs" icon="roles" label="Coaching roles at clubs" end={coachSeat.open_roles > 0 ? <>{coachSeat.open_roles} open</> : undefined} rail={!(coachSeat.open_roles > 0)} />
            </div>
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

    // The return (0064). fn_note_arrival records nothing and answers nothing
    // for an under-16, so a fourteen-year-old's visits are not timestamped and
    // this block does not render for them — the refusal is the database's, not
    // this page's, and doc 34 rule 6 (who may see a read receipt) is untouched.
    const awaySince = (await db.query('select fn_note_arrival($1) as since', [personId])).rows[0].since as string | null;

    // F5 (BUZ approved the words, 1 Oct): a 16–17 whose parent has not
    // confirmed (0048). Their own request is the open pending_invitation that
    // names them (child_id); this reads only whether one is open and whether
    // its text is still waiting for SMS (D-168, fn_invitation_sms_queued) —
    // nothing about the parent. No open request means it has CLOSED, and the
    // two endings (the parent ended it, or 14 days passed) read the same: the
    // purge leaves nothing to tell them apart, and the words must not either
    // (D-17, U-1). The re-ask door is not drawn until John rules (F5).
    const parentAsk = me.band === '16_17' && !me.has_guardian ? ((await db.query(
      `select fn_invitation_sms_queued(pi.id) as text_queued from pending_invitation pi
        where pi.child_id = $1 and pi.approved_at is null
        order by pi.created_at desc limit 1`,
      [personId],
    )).rows[0] as { text_queued: boolean } | undefined) ?? 'closed' : null;

    return (
      <PlayerFrame active="home">
        <div className="console home-col h-rise" style={COLUMN}>
          <HeaderMark />
          <div className="home-grid hg-p1">
          <div className="hg-top">
          {awaySince && <WhileYouWereAway viewerId={personId as string} since={awaySince} />}
          {/* The player-card variant of the hero: the CV's own ghost squad
              number (.cv-num, reused as is), drawn only when there is one. */}
          <div className="hero-panel sheen">
            {pg?.squad_number ? <span className="cv-num" aria-hidden>{pg.squad_number}</span> : null}
            <div className="hero-id has-pill" style={{ alignItems: 'flex-start' }}>
              {me.photo_path ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={me.photo_path} alt="" width={52} height={52} className="hero-av avatar-ring" />
              ) : (
                <div aria-hidden className="hero-av">{me.first_name[0]}</div>
              )}
              <div className="hero-t">
                <h1 className="hero-h">
                  {live ? 'Your page is live' : 'Your page'}
                </h1>
                <div className="hero-m">
                  {[
                    (pg?.positions ?? []).join(' · ') || null,
                    pg?.squad_number ? `#${pg.squad_number}` : null,
                    me.first_name ? null : null,
                  ].filter(Boolean).join(' · ') || 'No positions picked yet'}
                </div>
              </div>
              {/* A status fact, never a control. Not sent yet is neutral: it
                  is a fact, not a warning. */}
              <span className={live ? 'pill pill-live' : 'pill'}>{live ? 'Live' : 'Not sent yet'}</span>
            </div>
            {live ? (
              <div className="hero-well" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
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
          </div>

          {/* The seat's one primary, directly under the hero on a phone
              (A-P1), at the head of the aside on a laptop. */}
          <div className="hg-lead">
            {parentAsk === 'closed' ? (
              // F5: the request has closed, for either ending. Not "waiting",
              // and nothing that says which ending it was.
              <div role="status" className="card card-amber" data-parent-ask="closed" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, lineHeight: 1.5 }}>This request has closed. You can ask again whenever you like.</div>
              </div>
            ) : parentAsk ? (
              // 0048: a 16–17 sends only once a parent has confirmed. The
              // screen's only primary is unavailable, so nothing glows. While
              // the text still waits for SMS, "We've texted" would be untrue
              // (D-168), so the approved queued line says what did happen.
              <div role="status" className="card card-amber" data-parent-ask={parentAsk.text_queued ? 'text-queued' : 'asked'} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>Waiting on your parent</div>
                <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>
                  {parentAsk.text_queued
                    ? 'We\u2019ve emailed them, and their text follows shortly. Once they do, you can send. Keep building your page in the meantime.'
                    : <>We&rsquo;ve texted and emailed them to confirm they&rsquo;re your parent. Once they do, you can send your CV to clubs. Keep building your page in the meantime.</>}
                </div>
              </div>
            ) : (
              <Link href={`/send/${rec}`} className="btn btn-primary fl-glow">Send my CV to a club</Link>
            )}
            {/* Main.dc.html's second button. /share-card had no link from
                anywhere (D-164). A share card is an under-18's, approved as an
                image by their parent (D-101) — so it is offered where there is
                a confirmed parent to approve it, and to nobody else. */}
            {me.band !== '18plus' && me.has_guardian && (
              <Link href={`/share-card/${rec}`} className="btn btn-secondary">Share my CV</Link>
            )}
          </div>

          <div className="hg-main">
          {me.my_invitation && (
            <Link href={`/g/invite/${me.my_invitation.id}`} className="card card-purple row lift">
              <span className="row-main">
                <span className="row-t">{me.my_invitation.club} would like you at a trial</span>
                <span className="row-s">
                  {me.my_invitation.draft ? 'Your reply is with your parent to approve.' : me.band === '18plus' ? 'Reply when you are ready — or don’t.' : 'Your parent can see it too.'}
                </span>
              </span>
              <span className="row-end">Open</span>
            </Link>
          )}

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <h2 className="panel-h">Your page</h2>
              {done > 0 && <div style={{ fontSize: 12, fontWeight: 800, color: T.secondary }}>{done} of {steps.length} done</div>}
            </div>
            <div aria-hidden style={{ height: 6, borderRadius: 999, background: T.surface2, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((done / steps.length) * 100)}%`, height: 6, borderRadius: 999, background: T.accent }} />
            </div>
            {todo.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {todo.map((t) => (
                  <Link key={t.label} href={t.href} className="row-step lift">
                    <span style={{ flex: 1 }}>{t.label}</span>
                    <Chev />
                  </Link>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, fontWeight: 500, color: T.secondary, lineHeight: 1.5 }}>Every part of your page is filled in.</div>
            )}
            <Link href={`/build/${rec}/preview`} className="btn btn-secondary">Preview my page</Link>
          </div>

          {/* Where they play (0052). A club reaches a CV only as a confirmed
              squad, so this is the door to the club line on their page. */}
          <SquadCard personId={personId as string} firstName={me.first_name as string} back="/home" mine said={squad} />

          {next && (
            <Link href="/trials" className="card lift" style={{ display: 'block', textDecoration: 'none', color: T.ink }}>
              <TrialLine day={next.day} month={next.month} first end={<Chev />}>
                <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.3, color: T.ink }}>{next.club} · {next.title}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: T.muted }}>{next.time_venue}</div>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: T.accent, marginTop: 2 }}>You are on their register</div>
              </TrialLine>
            </Link>
          )}
          </div>

          <div className="hg-aside">
            {/* The four menu cards are one door list: the same four hrefs and
                labels, each with the frame's own glyph. */}
            <div className="card rows doors">
              <Door href={`/build/${rec}`} icon="cv" label="Build your CV" rail />
              <Door href="/trials" icon="trials" label="Trials near you" rail />
              <Door href={`/build/${rec}/clips`} icon="clip" label="Highlights" />
              <Door href={`/build/${rec}/more`} icon="star" label="Achievements" />
            </div>
            {/* doc 34 rule 6 (0047): a player 16 or over sees who read their
                registrations; an under-16's parent sees it on their controls. */}
            {me.band !== 'u16' && (me.my_registers > 0 || Boolean(taken)) && (
              <RegisterReaders viewerId={personId as string} personId={personId as string} name={null} back="/home" taken={Boolean(taken)} />
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
    // Four doors in one door list, each with its glyph, its one-line reason
    // and its approved end word. Nothing glows: nothing on the page says
    // which door is this person's (A-P5 would; it needs a stored field).
    return (
      <Shell>
        <div className="pg-titles">
          <h1 className="pg-title">Welcome, {me.first_name}</h1>
          <div className="pg-sub" style={{ lineHeight: 1.55 }}>Your account is set up. Here is what you can do with it.</div>
        </div>

        {/* A-P5 (approved) leads with the role picked at /join. Nothing stores
            that role yet (it is one adult-only field, D-25, for the tech
            team), so for an account with no stored role — every account that
            lands here today: a coach account has a coach page and a player
            one a record — "Find your club" goes first (live copy fix 3,
            BUZ 1 Oct). An order change only; no new words. */}
        <div className="card rows">
          {/* A new club account lands here with no seat until it claims (30 Sep). */}
          <Door href="/claim" icon="crest" label="Here for a club? Find your club" sub="Search for it and claim its page" end="Open" />
          <Door href="/coach/edit" icon="cv" label="Build a coach CV" sub="Your roles, your licences, one link to send" end="Start" />
          <Door href="/trials" icon="trials" label="Trials near you" sub="Every notice we hold, by date" end="Open" />
          <Door href="/jobs" icon="roles" label="Coaching roles at clubs" sub="Nothing here is ranked or recommended" end="Open" />
        </div>

        {/* A-P6 (BUZ, 1 Oct): "tell us" was a dead end — there was nothing on
            the page to tell us with. It is a mailto to the one user-facing
            address; every other word of the line is unchanged. */}
        <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
          Adding a child and building a player CV are not on this screen yet — <a href={`mailto:${SUPPORT_EMAIL}`}>tell us</a> which you came for and we will point you at it.
        </div>
        {/* This screen is the one home with no shell and therefore no bar, so
            it carries the way out itself. Every other seat gets it from the
            console shell's rail and sheet (BUZ, 28 Sep). */}
        <Link href="/signout" prefetch={false} className="btn btn-ghost">Sign out</Link>
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
  //
  // Tone (spec A, look only): a club's trial invitation is purple; a send,
  // a registration, a page edit and a squad invitation are amber — anything
  // else waiting. Green is an action and never marks a wait (D-173 (4)).
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
      href: `/g/send/${c.sendRequest!.id}`, tone: T.amber,
      title: `${c.firstName} wants to send a CV to ${/^(.*) </.exec(c.sendRequest!.destination ?? '')?.[1] ?? 'a club'}`,
      body: 'Nothing has been sent. Check the address and it goes; do nothing and the request disappears on its own.',
      cta: 'Review it',
    })),
    ...children.filter((c) => c.interestRequest).map((c) => ({
      key: c.interestRequest!.id, kind: 'interest' as const, at: c.interestRequest!.at,
      href: `/g/interest/${c.interestRequest!.id}`, tone: T.amber,
      title: `${c.firstName} wants to go on ${c.interestRequest!.club}\u2019s register`,
      body: `There\u2019s a line about ${c.firstName}, in ${c.firstName}\u2019s own words. Read it before it goes — you can change it.`,
      cta: 'Read it',
    })),
    ...children.filter((c) => c.hasPending && c.pendingAt).map((c) => ({
      key: `edit-${c.id}`, kind: 'edit' as const, at: c.pendingAt!,
      href: `/g/pending/${c.recordId}`, tone: T.amber,
      title: `${c.firstName} changed the page`,
      body: 'Until you approve it, every club holding the link still reads the old version.',
      cta: 'Review it',
    })),
    ...((await db.query(
      `select si.id, si.created_at as at, c.name as club, s.name as squad, ch.first_name, ch.id as child_id
       from squad_invitation si
       join club c on c.id = si.club_id join squad s on s.id = si.squad_id
       join person ch on ch.id = si.person_id
       join guardianship_link g on g.child_id = si.person_id and g.guardian_id = $1
         and g.approved_at is not null and g.revoked_at is null
       -- M3: at 18 a guardianship is visibility, never control (D-49, P15) —
       -- so an adult child's invitation is not a parent's to answer, and it
       -- is not on their list. A re-grant does not bring it back.
       where si.answered_at is null and si.withdrawn_at is null and si.lapsed_at is null
         and fn_age_band(ch.dob) <> '18plus'`,
      [personId],
    )).rows as { id: string; at: string; club: string; squad: string; first_name: string; child_id: string }[])
      .map((r) => ({
        key: r.id, kind: 'invite' as const, at: r.at,
        href: `/g/controls/${r.child_id}`, tone: T.amber,
        title: `${r.club} would like ${r.first_name} in ${r.squad}`,
        body: `Saying yes puts the team on ${r.first_name}\u2019s page and lets that team\u2019s coaches read their record. Doing nothing is a complete answer.`,
        cta: 'Review it',
      })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  // The three figures a parent actually wants, and we hold all of them. This
  // page had no hero and no numbers at all — the club page gets a crest and
  // numerals, and the person we most need to reassure got a title.
  const linksActive = children.filter((c) => c.linkExpiry).length;
  const expiringSoon = children.filter((c) => c.expiresInDays !== null && c.expiresInDays <= 30).length;
  const clubsHolding = children.reduce((n, c) => n + c.registers, 0);

  // The return (0064). A parent gone from March to September comes back to a
  // queue of their own omissions, oldest first, and nothing at all about what
  // happened to their child's record in those months — which is the one
  // question they came back with. Three dated facts, above the queue, and then
  // the page is the page. Never sent: it is computed on arrival and read on
  // arrival, because the moment it becomes a send it is a re-engagement prompt
  // (D-65 as amended by D-81).
  const awaySince = (await db.query('select fn_note_arrival($1) as since', [personId])).rows[0].since as string | null;

  // B1 (live defect; BUZ, 1 Oct): nothing linked a parent to /build, so an
  // approved under-16's page could never be started. Each child card gets the
  // door "Build {first}'s page" — drawn only where the DATABASE says this
  // parent may act on the record: fn_record_actor, the very question /build's
  // guard asks (requireRecordActor). An adult child's record is their own
  // (D-49), so their card never shows a door that would bounce. Record ids
  // in, the subset out — no child's details are read here.
  //
  // Spec A (B1): the door is an UNDER-16's only — a 16–17 or an adult builds
  // their own page — and while that child has no approved page and nothing
  // waits in the queue, it is the screen's one glowing primary (the real next
  // step); otherwise a secondary. "No approved page" is the same fact the
  // preview reads (no profile_version approved, D-119): a yes/no, never the
  // page's content.
  const buildable = new Map(((await db.query(
    `select dr.id::text as id,
       exists(select 1 from profile_version pv where pv.record_id = dr.id and pv.status = 'approved') as has_page
     from development_record dr join person p on p.id = dr.person_id
     where dr.id = any($2::uuid[]) and fn_age_band(p.dob) = 'u16'
       and fn_record_actor($1, dr.id) = 'guardian'`,
    [personId, children.map((c) => c.recordId).filter((x): x is string => Boolean(x))],
  )).rows as { id: string; has_page: boolean }[]).map((r) => [r.id, r.has_page]));
  // The one child whose door glows, if any: the first under-16 with no page,
  // and only when nothing is waiting on the parent.
  const glowFor = waiting.length === 0
    ? children.find((c) => c.recordId && buildable.get(c.recordId) === false)?.id ?? null
    : null;

  // Guardian seat — inside the parent's frame (D-147, amended 16 Sep). It
  // joins the home grid (spec A): what is waiting in the main column and the
  // children in the 320px aside from 1024px, so what is waiting and who it is
  // about sit side by side. On a phone the order is the source order, and the
  // children are last.
  return (
    <GuardianFrame active="home">
      <div className="console home-col h-rise" style={COLUMN}>
      <HeaderMark />
      <div className="pg-titles">
        <h1 className="pg-title">Your family</h1>
        <div className="pg-sub">Everything about your children on Pitch, and every control over it, is here.</div>
      </div>

      <div className="home-grid">
      <div>
      {awaySince && <WhileYouWereAway viewerId={personId as string} since={awaySince} />}

      {/* The state of things, in three numbers. Nothing here is new data —
          it is what the child cards below already say, added up, which is
          the form a parent can take in at a glance.

          D-162: a zero is never one of those numbers. "0 Expiring in 30 days"
          is the best possible news rendered as the shape of a problem, and a
          parent with no live link at all was shown "0 Links active" beside a
          child who has never been sent anywhere. Each tile is omitted at zero
          and the whole hero is omitted when there is nothing to put in it —
          the child cards below say the same things in words. Amber marks the
          one number that is a state; the other two are ink. */}
      {(linksActive > 0 || expiringSoon > 0 || clubsHolding > 0) && (
        <div className="hero-panel">
          <div className="stat-row">
            {linksActive > 0 && (
              <div>
                <div className="numeral numeral-m" style={{ color: T.ink }}>{linksActive}</div>
                <div className="stat-l">{linksActive === 1 ? 'Link active' : 'Links active'}</div>
              </div>
            )}
            {expiringSoon > 0 && (
              <div>
                <div className="numeral numeral-m" style={{ color: T.amber }}>{expiringSoon}</div>
                <div className="stat-l">Expiring in 30 days</div>
              </div>
            )}
            {clubsHolding > 0 && (
              <div>
                <div className="numeral numeral-m" style={{ color: T.ink }}>{clubsHolding}</div>
                <div className="stat-l">{clubsHolding === 1 ? 'Club register' : 'Club registers'}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Oldest first, and only the top one carries the primary — the
          screen's one glow — on a lifted notice with its tone edge. Three
          primary buttons in a row is the same as none. With nothing waiting
          the page says so, in the dashed "not yet" tile (N1, BUZ 1 Oct): an
          empty space reads as a page that failed to load. */}
      {waiting.length === 0 ? (
        <div className="card empty">
          <div className="empty-tile" aria-hidden />
          <div><span className="empty-t">Nothing is waiting on you.</span></div>
        </div>
      ) : waiting.map((w, i) => (
        <div key={w.key} className={i === 0 ? 'card fl-float' : 'card'} style={{
          padding: i === 0 ? '16.5px 15.5px' : '17px 16px', display: 'flex', flexDirection: 'column', gap: 12,
          ...(i === 0 ? { border: `1.5px solid ${w.tone}` } : {}),
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="notice-k" style={{ color: w.tone }}>Waiting on you</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: T.muted }}>{waitedFor(w.at)}</span>
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, lineHeight: 1.2 }}>{w.title}</div>
          {w.body && <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>{w.body}</div>}
          <Link href={w.href} className={i === 0 ? 'btn btn-primary fl-glow' : 'btn btn-secondary'}>{w.cta}</Link>
        </div>
      ))}

      {/* The public trials board shipped in launch scope (D-74, D-90) and
          NOTHING IN THE PRODUCT LINKED TO IT — it existed and no user could
          find it. This is a parent's entry point; the player seat has the
          same link in its door list. N2 (BUZ, 1 Oct): the board is in trial-
          date order, so "newest first" was untrue — the approved line the
          brand-new home already uses replaces it. */}
      <Link href="/trials" className="card row lift">
        <span className="row-main">
          <span className="row-t">Trials near you</span>
          <span className="row-s">Every notice we hold, by date</span>
        </span>
        <span className="row-end">Open</span>
      </Link>
      </div>

      <div>
        <h2 id="children" className="sec-h">Your children</h2>
        {children.map((c) => (
          <div key={c.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
            {/* Manage was a hand-built 46px button; it is the charter's
                secondary now — the same word, the same href. B1's door sits
                directly above it. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {c.recordId && buildable.has(c.recordId) && (
                <Link href={`/build/${c.recordId}`} className={c.id === glowFor ? 'btn btn-primary fl-glow' : 'btn btn-secondary'}>Build {c.firstName}&rsquo;s page</Link>
              )}
              <Link href={`/g/controls/${c.id}`} className="btn btn-secondary">Manage</Link>
            </div>
          </div>
        ))}
      </div>
      </div>
      </div>
    </GuardianFrame>
  );
}
