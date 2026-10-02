// TrialsIndex.dc.html — the public trials board (D-74, D-90). One
// chronological noticeboard: no recommender, no personalisation, ever.
// Every listing carries its stamps; anything past its date never renders,
// and nothing of a suspended club's does (0140). A club on Pitch — claimed or
// verified — gets the in-Pitch route; an unclaimed club's row is marked
// "Unclaimed", once, and the note above the list says once what that means
// (John, 2 Oct). v2 (BUZ, 2 Oct): one row per club per day, and expressions
// of interest in their own section below the trials.
import Link from 'next/link';
import { TrialsFrame } from '@/components/player-shell';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';
import { POSITIONS, type PositionCode } from '@/lib/football';
import { T } from '@/lib/palette';
import PublicAnalytics from '@/components/PublicAnalytics';
import SiteNav from '@/components/floodlit/SiteNav';
import TrialRow from '@/components/floodlit/TrialRow';
import { groupByClubDay, isEoi } from '@/lib/trials-board';
import { getSessionPersonId } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Public and indexable — the noticeboard is a reason for a parent to find us.
export const metadata = {
  title: 'Trials',
  description: 'Open football trials in Victoria and New South Wales, by age group, region and position.',
  alternates: { canonical: '/trials' },
};

const GENDERS: [string, string][] = [['boys', 'Boys'], ['girls', 'Girls'], ['men', 'Men'], ['women', 'Women']];
const STATES: Record<string, string> = { VIC: 'Victoria', NSW: 'New South Wales' };
// Show (BUZ, 2 Oct: "Level, trial or expression of interest on top of the
// location"): the two kinds a listing can be, in the board's section order,
// each in the words its section already uses.
const KINDS: [Kind, string][] = [['trial', 'Trials'], ['eoi', 'Expressions of interest']];
type Kind = 'trial' | 'eoi';

type Params = { age?: string; gender?: string; state?: string; pos?: string; kind?: string };

export default async function TrialsBoard({ searchParams }: { searchParams: Promise<Params> }) {
  const raw = await searchParams;
  // D-74: the board's day-one filters are age group, region, competition
  // gender and positions wanted. It shipped with two of the four. Region is
  // the club's STATE — Victoria and New South Wales first (D-04) — because no
  // region taxonomy exists yet and inventing one here would be a guess.
  // Anything not on these lists is ignored rather than trusted (D-94 §6).
  const gender = GENDERS.some(([v]) => v === raw.gender) ? raw.gender! : null;
  const state = raw.state && raw.state in STATES ? raw.state : null;
  const pos = raw.pos && raw.pos in POSITIONS ? raw.pos : null;
  const kind = KINDS.some(([v]) => v === raw.kind) ? raw.kind as Kind : null;

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
       upper(to_char(t.trial_on, 'Mon')) as mon, to_char(t.trial_on, 'FMDD') as day,
       upper(to_char(t.trial_on, 'Dy')) as wd, to_char(t.trial_on, 'YYYY-MM-DD') as on_date,
       to_char(t.added_on, 'FMDD Mon') as listed, to_char(t.last_checked, 'FMDD Mon') as checked,
       to_char(t.last_checked, 'YYYY-MM-DD') as checked_on,
       c.id as club_id, c.name as club_name, c.club_state, c.public_slug, c.state
     from fn_trial_notices_advertised() t join club c on c.id = t.club_id
     order by t.trial_on`,
  );
  type Listing = {
    title: string; time_venue: string; source: string; source_url: string | null; mon: string; day: string; wd: string; on_date: string; age_groups: string[];
    competition_gender: string | null; position_needs: string[]; state: string | null;
    id: string; listed: string; checked: string; checked_on: string; club_id: string; club_name: string; club_state: string; public_slug: string | null;
  };
  const upcoming = rows as Listing[];
  // The age filter offers the groups the board holds right now, in the
  // lookup's order — not a fixed list that missed U17 and seniors.
  const lookup = (await db.query(`select code, sort from age_group order by sort`)).rows as { code: string }[];
  const agesHere = lookup.map((a) => a.code).filter((code) => upcoming.some((l) => l.age_groups.includes(code)));
  const age = raw.age && lookup.some((a) => a.code === raw.age) ? raw.age : null;
  const kindOf = (l: Listing): Kind => (isEoi(l.time_venue) ? 'eoi' : 'trial');
  const matches = (l: Listing, f: { age: string | null; gender: string | null; state: string | null; pos: string | null; kind: Kind | null }) =>
    (!f.age || l.age_groups.includes(f.age)) && (!f.gender || l.competition_gender === f.gender)
    && (!f.state || l.state === f.state) && (!f.pos || (l.position_needs ?? []).includes(f.pos))
    && (!f.kind || kindOf(l) === f.kind);
  const current = { age, gender, state, pos, kind };
  const listings = upcoming.filter((l) => matches(l, current));
  // Each listing's kind is said once, by its section (BUZ, 2 Oct): the
  // trials, by trial date, then the expressions of interest, by closing date.
  // A filter matches listing by listing, so a row shows only its matching
  // lines and a row or section with none is not drawn. "N trials" counts the
  // trial listings; the second section's heading carries its own number.
  // Show hides the other kind's section entirely, and only ever narrows: the
  // listings left keep the order they had (D-21, D-74).
  const trials = listings.filter((l) => kindOf(l) === 'trial');
  const eois = listings.filter((l) => kindOf(l) === 'eoi');
  const eoiOnly = kind === 'eoi';
  // The most recent check across what is shown — not the last row's, which
  // is the furthest-out trial and made a fresh board read stale (HoPD, 2 Oct).
  const newest = listings.reduce<Listing | null>((a, l) => (!a || l.checked_on > a.checked_on ? l : a), null);
  const lastChecked = newest ? newest.checked : null;

  // Each option shows how many trials it would leave, given the other
  // choices already made — so nobody taps their way into an empty board.
  const count = (next: Partial<typeof current>) => upcoming.filter((l) => matches(l, { ...current, ...next })).length;
  // D-162: a filter chip whose count is zero is not shown — an option that
  // cannot change what you see is not an option. "Men 0" and "Women 0" sat
  // here as tappable chips leading to an empty board. A chip that is currently
  // SELECTED always stays, whatever its count, or it could not be taken off.
  const shows = (n: number, on: boolean) => n > 0 || on;
  const statesHere = Object.keys(STATES).filter((k) => upcoming.some((l) => l.state === k));
  const posHere = (Object.keys(POSITIONS) as PositionCode[]).filter((c) => upcoming.some((l) => (l.position_needs ?? []).includes(c)));
  // Show is offered only while both kinds are on the board under the other
  // choices — with one kind at zero it could not change what you see (D-162)
  // — and stays while one is chosen, so it can be taken off.
  const kindsHere = KINDS.filter(([k]) => count({ kind: k }) > 0);

  const href = (next: Partial<typeof current>) => {
    const p = new URLSearchParams();
    const merged = { ...current, ...next };
    if (merged.age) p.set('age', merged.age);
    if (merged.gender) p.set('gender', merged.gender);
    if (merged.state) p.set('state', merged.state);
    if (merged.pos) p.set('pos', merged.pos);
    if (merged.kind) p.set('kind', merged.kind);
    const qs = p.toString();
    return qs ? `/trials?${qs}` : '/trials';
  };

  const active = [
    age && { key: 'age', label: age === 'SEN' ? 'Seniors' : age, clear: href({ age: null }) },
    gender && { key: 'gender', label: GENDERS.find(([v]) => v === gender)![1], clear: href({ gender: null }) },
    state && { key: 'state', label: STATES[state], clear: href({ state: null }) },
    pos && { key: 'pos', label: `${pos} wanted`, clear: href({ pos: null }) },
    kind && { key: 'kind', label: KINDS.find(([v]) => v === kind)![1], clear: href({ kind: null }) },
  ].filter(Boolean) as { key: string; label: string; clear: string }[];

  const Chip = ({ to, on, children, title }: { to: string; on: boolean; children: React.ReactNode; title?: string }) => (
    <Link href={to} className="chip" aria-pressed={on} title={title}>{children}</Link>
  );
  // A link, not a control, like the club's register: every filtered view has
  // its own address, works with no JavaScript, and can be sent to a parent.
  const groups = (
    <div className="tb-filters">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div className="kicker">Age group</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          <Chip to={href({ age: null })} on={!age}>Any age</Chip>
          {agesHere.filter((a) => shows(count({ age: a }), age === a)).map((a) => <Chip key={a} to={href({ age: age === a ? null : a })} on={age === a}>{a === 'SEN' ? 'Seniors' : a}<span className="chip-count">{count({ age: a })}</span></Chip>)}
        </div>
      </div>
      {(kindsHere.length > 1 || kind) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div className="kicker">Show</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            <Chip to={href({ kind: null })} on={!kind}>All</Chip>
            {KINDS.filter(([k]) => shows(count({ kind: k }), kind === k)).map(([k, t]) => <Chip key={k} to={href({ kind: kind === k ? null : k })} on={kind === k}>{t}<span className="chip-count">{count({ kind: k })}</span></Chip>)}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div className="kicker">Competition</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          <Chip to={href({ gender: null })} on={!gender}>All</Chip>
          {GENDERS.filter(([v]) => shows(count({ gender: v }), gender === v)).map(([v, t]) => <Chip key={v} to={href({ gender: gender === v ? null : v })} on={gender === v}>{t}<span className="chip-count">{count({ gender: v })}</span></Chip>)}
        </div>
      </div>
      {statesHere.length > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div className="kicker">State</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            <Chip to={href({ state: null })} on={!state}>Both</Chip>
            {statesHere.filter((k) => shows(count({ state: k }), state === k)).map((k) => <Chip key={k} to={href({ state: state === k ? null : k })} on={state === k}>{STATES[k]}<span className="chip-count">{count({ state: k })}</span></Chip>)}
          </div>
        </div>
      )}
      {posHere.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div className="kicker">Positions wanted</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            <Chip to={href({ pos: null })} on={!pos}>Any</Chip>
            {posHere.filter((c) => shows(count({ pos: c }), pos === c)).map((c) => <Chip key={c} to={href({ pos: pos === c ? null : c })} on={pos === c} title={POSITIONS[c].label}>{c}<span className="chip-count">{count({ pos: c })}</span></Chip>)}
          </div>
        </div>
      )}
    </div>
  );

  // P3 (BUZ, 1 Oct): a board with no trials at all shows only what is true
  // of it — no filters (there is nothing to filter) and no note about "the
  // button on each listing". A board filtered to nothing keeps both, so the
  // choice can be seen and taken off. P4: the empty board is not a dead end —
  // a signed-out visitor is offered the two doors, in words already approved
  // on the club page and the club landing. One primary, and it is the club's.
  const boardEmpty = upcoming.length === 0;
  const me = await getSessionPersonId();
  const doors = boardEmpty && !me;

  // One club, one day (BUZ, 2 Oct): the club and the date said once, a line
  // per listing, in date order (lib/trials-board).
  const rowsOf = (ls: Listing[]) => groupByClubDay(ls).map((row) => (
    <TrialRow key={`${row[0].on_date}-${row[0].club_id}`} wd={row[0].wd} day={row[0].day} mon={row[0].mon}
      club={row[0].club_name} clubState={row[0].club_state} slug={row[0].public_slug}
      lines={row.map((l) => ({
        id: l.id, title: l.title.replace(' trials', ''), timeVenue: l.time_venue, listed: l.listed, checked: l.checked,
        notice: l.source !== 'club' && l.source_url ? l.source_url : null,
      }))} />
  ));

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

      <div className={boardEmpty ? 'tb-body tb-bare' : 'tb-body'}>
        {!boardEmpty && (
          <aside className="tb-rail" aria-label="Filters">
            {/* Phone: the four groups fold into one Filters button, and what
                is chosen stays on screen as chips you can take off one at a
                time. <details> opens and closes with no JavaScript. From 768
                the groups sit open in a card; from 1024 of board, beside the
                list as a rail (P1). */}
            <details className="m-only trial-filters">
              <summary className="chip" style={{ alignSelf: 'flex-start', cursor: 'pointer', listStyle: 'none' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M3 6h18M6 12h12M10 18h4" /></svg>
                Filters
                {active.length > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: 999, background: T.accent, color: T.onAccent, fontSize: 10.5, fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{active.length}</span>}
              </summary>
              <div className="fl-card" style={{ marginTop: 10 }}>{groups}</div>
            </details>
            <div className="d-only fl-card">{groups}</div>
          </aside>
        )}

        <div className="tb-list" style={boardEmpty ? { width: '100%' } : undefined}>
          <div className="tb-countrow">
            {active.map((a) => (
              <Link key={a.key} href={a.clear} className="chip" aria-pressed="true" aria-label={`Remove ${a.label}`}>
                {a.label}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
              </Link>
            ))}
            {/* D-162 (Product Design, 2 Oct): never "0 trials". With no trial
                to count, the line below says so in words instead. */}
            {trials.length > 0 && !eoiOnly && (
              <div aria-live="polite" style={{ fontSize: 12.5, fontWeight: 700, color: T.muted, padding: '0 4px' }}>
                {trials.length} {trials.length === 1 ? 'trial' : 'trials'}
              </div>
            )}
            {active.length > 1 && <Link href="/trials" style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 4px' }}>Clear</Link>}
          </div>

          {!boardEmpty && (
            <div className="card-sunken tb-how">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7 v5.5 l3.5 2" /></svg>
              {/* John, 2 Oct: the unclaimed line, said once — here, in body
                  text — and one quiet "Unclaimed" on each row it is true of. */}
              <div>
                <p>Some clubs take your interest inside Pitch. The rest read a CV in their inbox like they always have — the button on each listing tells you which.</p>
                <p>Unclaimed listings are compiled by Pitch from each club&rsquo;s own public notice. Those clubs have not claimed their page.{lastChecked ? ` Last checked ${lastChecked}.` : ''}</p>
              </div>
            </div>
          )}

          {/* The empty line is ONE element, its first sentence set as a title
              inside it, so it still reads as one sentence. N1 (BUZ, 1 Oct):
              "No trials listed yet." when nothing is chosen; the approved
              "No trials listed for that yet." when something is. Drawn where
              the trial list would be whenever no TRIAL is shown, so a view
              that leaves only expressions of interest says it in words and
              they follow below it (Product Design, 2 Oct). With Show on
              "Expressions of interest" there is no trial list to stand in
              for, so the line is drawn only if nothing at all is left. */}
          {(eoiOnly ? eois.length === 0 : trials.length === 0) && (boardEmpty ? (
            <div className="fl-card tb-emptyb">
              <div className="tb-art" aria-hidden><div className="fl-dash" /><div className="fl-dash" /><div className="fl-dash" /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
                <p><b>{active.length ? 'No trials listed for that yet.' : 'No trials listed yet.'}</b> An empty week is honest — we only list what a club has posted or published itself.</p>
                {doors && <Link href="/join" className="btn btn-secondary tb-fam">Build a CV first — it is what the club reads</Link>}
              </div>
            </div>
          ) : (
            <div className="fl-card tb-empty">
              <div className="fl-dash" aria-hidden />
              <p><b>{active.length ? 'No trials listed for that yet.' : 'No trials listed yet.'}</b> An empty week is honest — we only list what a club has posted or published itself.</p>
            </div>
          ))}
          {doors && (
            <div className="fl-card tb-clubdoor">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                <span className="kicker" style={{ color: T.amber }}>For clubs &amp; technical directors</span>
                <h2>Put your trials where families can find them.</h2>
              </div>
              <Link href="/claim" className="btn btn-primary fl-glow">Claim your club page</Link>
            </div>
          )}

          {/* A club on Pitch — claimed or verified — has a register, and the
              row offers it, as the club's own page does; a claimed club carries
              no label, as its own page carries none (D-90, D-126, doc 14 M9).
              An unclaimed club's row is marked "Unclaimed". John, 30 Sep: a
              notice Pitch compiled links to the club's own notice. */}
          {!eoiOnly && rowsOf(trials)}
          {/* Show on "Expressions of interest" (Product Design, 2 Oct): the
              count line goes, so the heading leads with its number, the
              rule above it goes (nothing sits above it), and the number is
              what a screen reader hears change. */}
          {eois.length > 0 && (
            <>
              <div className={eoiOnly ? 'tb-sec first' : 'tb-sec'}>
                <h2>Expressions of interest<span className="tb-sec-n" aria-live={eoiOnly ? 'polite' : undefined}>{eois.length}</span></h2>
                <div className="tb-sec-sub">By closing date.</div>
              </div>
              {rowsOf(eois)}
            </>
          )}
        </div>
      </div>
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
