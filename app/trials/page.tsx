// TrialsIndex.dc.html — the public trials board (D-74, D-90). One
// chronological noticeboard: no recommender, no personalisation, ever.
// Every listing carries its stamps; anything past its date never renders,
// and nothing of a suspended club's does (0140). A club on Pitch — claimed or
// verified — gets the in-Pitch route; an unclaimed club's row is marked
// "Unclaimed", once, and the note above the list says once what that means
// (John, 2 Oct). v2 (BUZ, 2 Oct): one row per club per day, and expressions
// of interest in their own section below the trials. The filters package
// (BUZ approved 2 Oct): Region, Distance, Show and Club level. Open now (BUZ
// approved 3 Oct, 0173): an expression of interest with no closing date is
// on the board while the trials desk keeps seeing its form open — the
// database's answer, seven days from the last time it did.
//
// This page reads the board and decides what the address asks for; the
// board itself is drawn by components/floodlit/TrialsBoard, which runs the
// same filter rules (lib/trials-filter) in the browser once a distance is set.
import { TrialsFrame } from '@/components/player-shell';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';
import { POSITIONS, type PositionCode } from '@/lib/football';
import { T } from '@/lib/palette';
import PublicAnalytics from '@/components/PublicAnalytics';
import SiteNav from '@/components/floodlit/SiteNav';
import TrialsBoard, { type BoardListing } from '@/components/floodlit/TrialsBoard';
import { kindOf } from '@/lib/trials-board';
import { NONE, type Chosen, type Kind } from '@/lib/trials-filter';
import { REGIONS } from '@/lib/regions';
import { centreOf, regionOfSuburb } from '@/lib/places-vic';
import { getSessionPersonId } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Public and indexable — the noticeboard is a reason for a parent to find us.
export const metadata = {
  title: 'Trials',
  description: 'Open football trials in Victoria and New South Wales, by age group, region and position.',
  alternates: { canonical: '/trials' },
};

const GENDERS = ['boys', 'girls', 'men', 'women'];
const STATES = ['VIC', 'NSW'];
const KINDS: Kind[] = ['trial', 'eoi'];

type Params = { age?: string; gender?: string; state?: string; pos?: string; kind?: string; area?: string; level?: string };

export default async function TrialsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const raw = await searchParams;

  // Chronological and filtered only by what the family chose. No recommender,
  // no personalisation, ever (D-74).
  // A notice names every age group it is for (D-68 as amended 16 Sep), in
  // the lookup's own order, so "U14 & U15" is found under both.
  // What is on the board is the database's answer (0140): still to come, and
  // never a suspended club's, whatever the class of its suspension.
  const { rows } = await db.query(
    `select t.id, t.title, t.time_venue, t.source, t.source_url, t.competition_gender, t.position_needs,
       array(select ta.age_group from trial_notice_age_group ta join age_group ag on ag.code = ta.age_group
             where ta.trial_notice_id = t.id order by ag.sort) as age_groups,
       coalesce(upper(to_char(t.trial_on, 'Mon')), '') as mon, coalesce(to_char(t.trial_on, 'FMDD'), '') as day,
       coalesce(upper(to_char(t.trial_on, 'Dy')), '') as wd, coalesce(to_char(t.trial_on, 'YYYY-MM-DD'), '') as on_date,
       t.trial_on is null as open_now,
       to_char(t.added_on, 'FMDD Mon') as listed,
       -- An open-now row's "checked" is the day the desk last saw its form
       -- open (John, 3 Oct): the stamp and the seven days are one fact. Never
       -- last_checked, which a dated notice's re-read moves.
       to_char(case when t.trial_on is null then (t.confirmed_open_at at time zone 'Australia/Melbourne')::date
                    else t.last_checked end, 'FMDD Mon') as checked,
       to_char(case when t.trial_on is null then (t.confirmed_open_at at time zone 'Australia/Melbourne')::date
                    else t.last_checked end, 'YYYY-MM-DD') as checked_on,
       c.id as club_id, c.name as club_name, c.club_state, c.public_slug, c.state, c.suburb,
       cl.level
     from fn_trial_notices_advertised() t join club c on c.id = t.club_id
     left join fn_club_levels_current() cl on cl.club_id = c.id
     order by t.trial_on`,
  );
  // Club level (0172; John, 2 Oct): the CLUB's senior league, joined to the
  // listings the board already reads its way, so the filter sees exactly the
  // clubs the board does. Only the level's code is read — never the league as
  // its source names it — because no row ever shows the league. A club with
  // no source has no row, so no level, and is in no level chip; nor does a
  // level checked more than twelve months ago (fn_club_levels_current). The levels
  // are the lookup's, in its order (D-73).
  const levels = (await db.query(`select code, label from competition_tier order by sort`)).rows as { code: string; label: string }[];
  type Row = {
    id: string; title: string; time_venue: string; source: string; source_url: string | null; competition_gender: string | null;
    position_needs: string[]; age_groups: string[]; mon: string; day: string; wd: string; on_date: string; open_now: boolean; listed: string; checked: string;
    checked_on: string; club_id: string; club_name: string; club_state: string; public_slug: string | null; state: string | null;
    suburb: string | null; level: string | null;
  };
  // What the browser is given: each listing as the board draws it, and its
  // facets — public facts about it and its CLUB (lib/trials-filter). The
  // region and the centre point are the club's, from the club's suburb; the
  // suburb itself is not sent.
  const upcoming: BoardListing[] = (rows as Row[]).map((l) => ({
    id: l.id, title: l.title, time_venue: l.time_venue, notice: l.source !== 'club' && l.source_url ? l.source_url : null,
    mon: l.mon, day: l.day, wd: l.wd, on_date: l.on_date, open: l.open_now, listed: l.listed, checked: l.checked, checked_on: l.checked_on,
    club_id: l.club_id, club_name: l.club_name, club_state: l.club_state, public_slug: l.public_slug,
    f: {
      ages: l.age_groups, gender: l.competition_gender, pos: l.position_needs ?? [], state: l.state,
      kind: kindOf(l.open_now, l.time_venue), area: regionOfSuburb(l.suburb), level: l.level, at: centreOf(l.suburb),
    },
  }));
  // The age filter offers the groups the board holds right now, in the
  // lookup's order — not a fixed list that missed U17 and seniors.
  const lookup = (await db.query(`select code, sort from age_group order by sort`)).rows as { code: string }[];
  const ages = lookup.map((a) => a.code).filter((code) => upcoming.some((l) => l.f.ages.includes(code)));
  const positions = (Object.keys(POSITIONS) as PositionCode[]).filter((c) => upcoming.some((l) => l.f.pos.includes(c)));

  // D-74: the board's day-one filters are age group, region, competition
  // gender and positions wanted. Region is the club's region (lib/regions:
  // its suburb, its council, the council's group, BUZ approved 2 Oct), under
  // the club's state while the board holds one state. Anything not on these
  // lists is ignored rather than trusted (D-94 §6).
  const pick = <V extends string>(v: string | undefined, allowed: readonly V[]) => (allowed as readonly string[]).includes(v ?? '') ? v as V : null;
  const chosen: Chosen = {
    ...NONE,
    age: pick(raw.age, lookup.map((a) => a.code)),
    gender: pick(raw.gender, GENDERS),
    state: pick(raw.state, STATES),
    pos: pick(raw.pos, Object.keys(POSITIONS)),
    kind: pick(raw.kind, KINDS),
    area: pick(raw.area, REGIONS.map((r) => r.key)),
    level: pick(raw.level, levels.map((l) => l.code)),
  };

  // P4: the empty board's two doors are for a signed-out visitor.
  const me = await getSessionPersonId();
  const doors = upcoming.length === 0 && !me;

  const board = (
    <main className="fl-wide tb">
      {/* Signed in, the page header carries the logo, top right on a phone.
          It is HeaderMark so the shared rules decide where it goes (spec A
          parts 5 and 6): in a seat frame the rail carries it from 1024px,
          and with no seat frame the top bar does. Signed out, it is in the
          nav. */}
      {me && <HeaderMark />}
      <div className="tb-head">
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em', lineHeight: 1.15 }}>Trials board</h1>
        <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>Club trials listed below, by trial date.</div>
      </div>
      <TrialsBoard upcoming={upcoming} chosen={chosen} ages={ages} positions={positions} levels={levels} doors={doors} />
    </main>
  );

  // P2 (BUZ, 1 Oct): signed out, the board wears the public nav bar, as the
  // front door and the club pages that link to it do. Signed in, it stays in
  // the seat's own frame, as it always has (D-147 as amended 16 Sep).
  // One of the four pages analytics may count (lib/analytics-scope).
  return (
    <>
    {me ? (
      <TrialsFrame><div className="tb-root">{board}</div></TrialsFrame>
    ) : (
      <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', flexDirection: 'column' }}>
        <SiteNav links={[{ href: '/claim', label: 'Find your club' }, { href: '/trials', label: 'Trials', current: true }]} />
        <div className="tb-root">{board}</div>
      </div>
    )}
    <PublicAnalytics />
    </>
  );
}
