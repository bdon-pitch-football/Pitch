'use client';
// The trials board's filters and list (app/trials/page.tsx reads the board;
// this draws it). A client component for one reason: Distance (BUZ approved
// 2 Oct; John, 2 Oct) is worked out on the family's device, so the chips'
// numbers and the rows have to be recounted there once a distance is set. The
// rules are lib/trials-filter's, the same ones the server's render uses, and
// with no JavaScript this is the server's render: every chip a link, every
// filtered view its own address, and no Distance group at all (proposal §6,
// point 9) — Region still answers "what's near me" everywhere.
//
// The distance itself — the place picked and the radius — lives in this
// component's state and nowhere else. It is never in the address, history,
// storage, a cookie, an analytics event or a request (John's Q1), so it
// survives a tap on another chip (a soft navigation keeps this component)
// and is gone after a reload or in a shared link, by design. The chip above
// the list reads only "Within {n} km", never the place, so a screenshot of
// the board does not carry where a family lives. It is the same for everyone,
// under-18s included (John's Q4), and nothing here asks the device where it is.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import TrialRow from '@/components/floodlit/TrialRow';
import NearField, { type Picked } from '@/components/floodlit/NearField';
import { groupByClubDay } from '@/lib/trials-board';
import { hrefFor, kmBetween, matches, type Chosen, type Facets, type Kind, type Near } from '@/lib/trials-filter';
import { REGIONS } from '@/lib/regions';
import { POSITIONS, type PositionCode } from '@/lib/football';
import { T } from '@/lib/palette';

export type BoardListing = {
  id: string; title: string; time_venue: string; notice: string | null;
  mon: string; day: string; wd: string; on_date: string; listed: string; checked: string; checked_on: string;
  club_id: string; club_name: string; club_state: string; public_slug: string | null;
  f: Facets;
};

const GENDERS: [string, string][] = [['boys', 'Boys'], ['girls', 'Girls'], ['men', 'Men'], ['women', 'Women']];
const STATES: Record<string, string> = { VIC: 'Victoria', NSW: 'New South Wales' };
const KINDS: [Kind, string][] = [['trial', 'Trials'], ['eoi', 'Expressions of interest']];
const RADII = [10, 20, 40];

const Chip = ({ to, on, children, title }: { to: string; on: boolean; children: React.ReactNode; title?: string }) => (
  <Link href={to} className="chip" aria-pressed={on} title={title}>{children}</Link>
);
const Group = ({ name, children }: { name: string; children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
    <div className="kicker">{name}</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{children}</div>
  </div>
);

export default function TrialsBoard({ upcoming, chosen, ages, positions, levels, doors }: {
  upcoming: BoardListing[]; chosen: Chosen; ages: string[]; positions: PositionCode[];
  levels: { code: string; label: string }[]; doors: boolean;
}) {
  const { age, gender, state, pos, kind, area, level } = chosen;
  // Distance renders only once this has run in a browser (no JavaScript, no
  // Distance), and its state is the board's, so the phone's panel and the
  // laptop rail show one choice.
  const [live, setLive] = useState(false);
  useEffect(() => setLive(true), []);
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [km, setKm] = useState(20);
  const near: Near = picked ? { at: picked.at, km } : null;
  const clearNear = () => { setPicked(null); setText(''); setKm(20); };

  const listings = upcoming.filter((l) => matches(l.f, chosen, near));
  // Each listing's kind is said once, by its section (BUZ, 2 Oct): the
  // trials, by trial date, then the expressions of interest, by closing date.
  // A filter matches listing by listing, so a row shows only its matching
  // lines and a row or section with none is not drawn. "N trials" counts the
  // trial listings; the second section's heading carries its own number.
  // Show hides the other kind's section entirely, and every filter only
  // narrows: the listings left keep the order they had (D-21, D-74).
  const trials = listings.filter((l) => l.f.kind === 'trial');
  const eois = listings.filter((l) => l.f.kind === 'eoi');
  const eoiOnly = kind === 'eoi';
  // The most recent check across what is shown — not the last row's, which
  // is the furthest-out trial and made a fresh board read stale (HoPD, 2 Oct).
  const newest = listings.reduce<BoardListing | null>((a, l) => (!a || l.checked_on > a.checked_on ? l : a), null);
  const lastChecked = newest ? newest.checked : null;

  // Each option shows how many listings it would leave, given the other
  // choices already made, a distance included — so nobody taps their way
  // into an empty board.
  const count = (next: Partial<Chosen>, n: Near = near) => upcoming.filter((l) => matches(l.f, { ...chosen, ...next }, n)).length;
  const within = (r: number) => (picked ? count({}, { at: picked.at, km: r }) : 0);
  // D-162: a filter chip whose count is zero is not shown — an option that
  // cannot change what you see is not an option. "Men 0" and "Women 0" sat
  // here as tappable chips leading to an empty board. A chip that is currently
  // SELECTED always stays, whatever its count, or it could not be taken off,
  // and the number on a chip is never a zero.
  const shows = (n: number, on: boolean) => n > 0 || on;
  const num = (n: number) => n > 0 && <span className="chip-count">{n}</span>;
  const statesHere = Object.keys(STATES).filter((k) => upcoming.some((l) => l.f.state === k));
  // Show, Region and Club level are offered only while two or more of their
  // options have listings under the other choices — with one, the group
  // could not change what you see (D-162), as State already does — and stay
  // while one is chosen, so it can be taken off.
  const kindsHere = KINDS.filter(([k]) => count({ kind: k }) > 0);
  const regionsHere = REGIONS.filter((r) => count({ area: r.key }) > 0);
  const levelsHere = levels.filter((l) => count({ level: l.code }) > 0);
  // Every region is Victorian. When a second state's listings arrive, State
  // leads and Region waits for Victoria to be chosen, so the chips of two
  // states never mix (proposal §5).
  const regionGroup = (regionsHere.length > 1 || area) && (statesHere.length < 2 || state === 'VIC');

  const href = (next: Partial<Chosen>) => hrefFor({ ...chosen, ...next });

  // What is chosen, in the panel's order, each a chip that takes only itself
  // off. "NPL clubs", never "NPL": that chip is what a family sees with the
  // panel shut, above a list of junior trials (§7b's honesty). "Within 20
  // km", never the place (John, Q1).
  const active = [
    state && { key: 'state', label: STATES[state], clear: href({ state: null }) },
    area && { key: 'area', label: REGIONS.find((r) => r.key === area)!.name, clear: href({ area: null }) },
    picked && { key: 'near', label: `Within ${km} km`, onClear: clearNear },
    age && { key: 'age', label: age === 'SEN' ? 'Seniors' : age, clear: href({ age: null }) },
    kind && { key: 'kind', label: KINDS.find(([v]) => v === kind)![1], clear: href({ kind: null }) },
    level && { key: 'level', label: `${levels.find((l) => l.code === level)!.label} clubs`, clear: href({ level: null }) },
    gender && { key: 'gender', label: GENDERS.find(([v]) => v === gender)![1], clear: href({ gender: null }) },
    pos && { key: 'pos', label: `${pos} wanted`, clear: href({ pos: null }) },
  ].filter(Boolean) as { key: string; label: string; clear?: string; onClear?: () => void }[];

  // A radius is a button, not a link: a distance never has an address.
  const radius = (r: number) => (
    <button key={r} type="button" className="chip" aria-pressed={km === r} onClick={() => setKm(r)}>{r} km{num(within(r))}</button>
  );
  // Distance (§6): one field, then — once a place is picked — the three
  // radii with what each would leave, 20 km chosen first, and the one line
  // that says what happens to what is typed.
  const distance = (where: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div className="kicker" id={`tb-dist-${where}`}>Distance</div>
      <NearField headingId={`tb-dist-${where}`} text={text} setText={setText} picked={picked}
        onPick={(p) => { setPicked(p); setKm(20); }} onClear={clearNear} />
      {picked && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {RADII.filter((r) => shows(within(r), km === r)).map(radius)}
        </div>
      )}
      <div className="near-note">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, marginTop: 2 }}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
        <span>Worked out on this device. Never sent to Pitch or saved.</span>
      </div>
    </div>
  );
  // The narrower questions sit behind one fold, More filters (HoPD, 2 Oct;
  // B2: Club level and Competition fold, Show stays out). Its second line
  // names what is inside in the groups' own headings, so nothing is folded
  // away unnamed — a group hidden at zero is not named — and it opens itself
  // whenever something inside it is chosen, so a choice is never hidden. A
  // <details>, so it works with no JavaScript, and the same markup on a
  // phone and in the laptop rail (D-147).
  const folded = [
    // Club level: the club's senior league, said so in one line under the
    // heading.
    (levelsHere.length > 1 || level) && { name: 'Club level', on: Boolean(level), body: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div className="kicker">Club level</div>
        <div className="tb-fnote">The club&rsquo;s senior league, not the trial&rsquo;s.</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          <Chip to={href({ level: null })} on={!level}>Any level</Chip>
          {levels.filter((l) => shows(count({ level: l.code }), level === l.code)).map((l) => <Chip key={l.code} to={href({ level: level === l.code ? null : l.code })} on={level === l.code}>{l.label}{num(count({ level: l.code }))}</Chip>)}
        </div>
      </div>
    ) },
    { name: 'Competition', on: Boolean(gender), body: (
      <Group name="Competition">
        <Chip to={href({ gender: null })} on={!gender}>All</Chip>
        {GENDERS.filter(([v]) => shows(count({ gender: v }), gender === v)).map(([v, t]) => <Chip key={v} to={href({ gender: gender === v ? null : v })} on={gender === v}>{t}{num(count({ gender: v }))}</Chip>)}
      </Group>
    ) },
    // Positions wanted stays hidden while no listing under the other choices
    // names a position — and so is not named in the fold either.
    (positions.some((c) => count({ pos: c }) > 0) || pos) && { name: 'Positions wanted', on: Boolean(pos), body: (
      <Group name="Positions wanted">
        <Chip to={href({ pos: null })} on={!pos}>Any</Chip>
        {positions.filter((c) => shows(count({ pos: c }), pos === c)).map((c) => <Chip key={c} to={href({ pos: pos === c ? null : c })} on={pos === c} title={POSITIONS[c].label}>{c}{num(count({ pos: c }))}</Chip>)}
      </Group>
    ) },
  ].filter(Boolean) as { name: string; on: boolean; body: React.ReactNode }[];
  // A link, not a control, like the club's register: every filtered view has
  // its own address, works with no JavaScript, and can be sent to a parent.
  // The order (HoPD, 2 Oct): where first, then the age every family picks,
  // then Show, then the fold.
  const groups = (where: string) => (
    <div className="tb-filters">
      {statesHere.length > 1 && (
        <Group name="State">
          <Chip to={href({ state: null })} on={!state}>Both</Chip>
          {statesHere.filter((k) => shows(count({ state: k }), state === k)).map((k) => <Chip key={k} to={href({ state: state === k ? null : k })} on={state === k}>{STATES[k]}{num(count({ state: k }))}</Chip>)}
        </Group>
      )}
      {regionGroup && (
        <Group name="Region">
          <Chip to={href({ area: null })} on={!area}>Any region</Chip>
          {REGIONS.filter((r) => shows(count({ area: r.key }), area === r.key)).map((r) => <Chip key={r.key} to={href({ area: area === r.key ? null : r.key })} on={area === r.key}>{r.name}{num(count({ area: r.key }))}</Chip>)}
        </Group>
      )}
      {live && distance(where)}
      <Group name="Age group">
        <Chip to={href({ age: null })} on={!age}>Any age</Chip>
        {ages.filter((a) => shows(count({ age: a }), age === a)).map((a) => <Chip key={a} to={href({ age: age === a ? null : a })} on={age === a}>{a === 'SEN' ? 'Seniors' : a}{num(count({ age: a }))}</Chip>)}
      </Group>
      {(kindsHere.length > 1 || kind) && (
        <Group name="Show">
          <Chip to={href({ kind: null })} on={!kind}>All</Chip>
          {KINDS.filter(([k]) => shows(count({ kind: k }), kind === k)).map(([k, t]) => <Chip key={k} to={href({ kind: kind === k ? null : k })} on={kind === k}>{t}{num(count({ kind: k }))}</Chip>)}
        </Group>
      )}
      {folded.length > 0 && (
        <details className="tb-more" open={folded.some((g) => g.on)}>
          <summary>
            <span className="tb-more-t">
              <span className="tb-more-h">More filters</span>
              <span className="tb-more-s">{folded.map((g) => g.name).join(' · ')}</span>
            </span>
            <svg className="tb-more-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
          </summary>
          <div className="tb-more-b">{folded.map((g) => <div key={g.name}>{g.body}</div>)}</div>
        </details>
      )}
    </div>
  );

  // P3 (BUZ, 1 Oct): a board with no trials at all shows only what is true
  // of it — no filters (there is nothing to filter) and no note about "the
  // button on each listing". A board filtered to nothing keeps both, so the
  // choice can be seen and taken off. P4: the empty board is not a dead end —
  // a signed-out visitor is offered the two doors (the page decides), in
  // words already approved on the club page and the club landing.
  const boardEmpty = upcoming.length === 0;

  // One club, one day (BUZ, 2 Oct): the club and the date said once, a line
  // per listing, in date order (lib/trials-board). With a distance set, each
  // row says how far its club's suburb is — on screen only, never in print
  // (John, Q2) — and says nothing at all rather than "about 0 km" (D-162).
  const rowsOf = (ls: BoardListing[]) => groupByClubDay(ls).map((row) => {
    const at = row[0].f.at;
    const about = picked && at ? Math.round(kmBetween(picked.at, at)) : 0;
    return (
      <TrialRow key={`${row[0].on_date}-${row[0].club_id}`} wd={row[0].wd} day={row[0].day} mon={row[0].mon}
        club={row[0].club_name} clubState={row[0].club_state} slug={row[0].public_slug} about={about > 0 ? about : undefined}
        lines={row.map((l) => ({ id: l.id, title: l.title.replace(' trials', ''), timeVenue: l.time_venue, listed: l.listed, checked: l.checked, notice: l.notice }))} />
    );
  });
  // Nothing in range: the next radius that has something, as the same chip
  // with its count, so the family never taps into another empty board.
  const emptyHere = eoiOnly ? eois.length === 0 : trials.length === 0;
  const wider = picked && emptyHere ? RADII.find((r) => r > km && upcoming.some((l) => matches(l.f, chosen, { at: picked.at, km: r }) && (eoiOnly ? l.f.kind === 'eoi' : l.f.kind === 'trial'))) : undefined;

  return (
    <div className={boardEmpty ? 'tb-body tb-bare' : 'tb-body'}>
      {!boardEmpty && (
        <aside className="tb-rail" aria-label="Filters">
          {/* Phone: the groups fold into one Filters button, and what is
              chosen stays on screen as chips you can take off one at a
              time. <details> opens and closes with no JavaScript. From 768
              the groups sit open in a card; from 1024 of board, beside the
              list as a rail (P1). */}
          <details className="m-only trial-filters">
            <summary className="chip" style={{ alignSelf: 'flex-start', cursor: 'pointer', listStyle: 'none' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M3 6h18M6 12h12M10 18h4" /></svg>
              Filters
              {active.length > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: 999, background: T.accent, color: T.onAccent, fontSize: 10.5, fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{active.length}</span>}
            </summary>
            <div className="fl-card" style={{ marginTop: 10 }}>{groups('m')}</div>
          </details>
          <div className="d-only fl-card">{groups('d')}</div>
        </aside>
      )}

      <div className="tb-list" style={boardEmpty ? { width: '100%' } : undefined}>
        <div className="tb-countrow">
          {active.map((a) => {
            const x = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>;
            return a.clear
              ? <Link key={a.key} href={a.clear} className="chip" aria-pressed="true" aria-label={`Remove ${a.label}`}>{a.label}{x}</Link>
              : <button key={a.key} type="button" className="chip" aria-pressed="true" aria-label={`Remove ${a.label}`} onClick={a.onClear}>{a.label}{x}</button>;
          })}
          {/* D-162 (Product Design, 2 Oct): never "0 trials". With no trial
              to count, the line below says so in words instead. */}
          {trials.length > 0 && !eoiOnly && (
            <div aria-live="polite" style={{ fontSize: 12.5, fontWeight: 700, color: T.muted, padding: '0 4px' }}>
              {trials.length} {trials.length === 1 ? 'trial' : 'trials'}
            </div>
          )}
          {active.length > 1 && <Link href="/trials" onClick={clearNear} style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 4px' }}>Clear</Link>}
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
        {emptyHere && (boardEmpty ? (
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
              <p><b>{active.length ? 'No trials listed for that yet.' : 'No trials listed yet.'}</b> An empty week is honest — we only list what a club has posted or published itself.</p>
              {wider && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{radius(wider)}</div>}
            </div>
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
  );
}
