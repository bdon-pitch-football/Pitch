// TrialsIndex.dc.html — the public trials board (D-74, D-90). One
// chronological noticeboard: no recommender, no personalisation, ever.
// Every listing carries its stamps; anything past its date never renders,
// and nothing of a suspended club's does (0140). A club on Pitch — claimed or
// verified — gets the in-Pitch route; unclaimed listings say plainly they
// were compiled and route via the club.
import Link from 'next/link';
import { TrialsFrame } from '@/components/player-shell';
import { db } from '@/lib/db';
import Wordmark from '@/components/Wordmark';
import { POSITIONS, type PositionCode } from '@/lib/football';
import { T } from '@/lib/palette';
import PublicAnalytics from '@/components/PublicAnalytics';

export const dynamic = 'force-dynamic';

// Public and indexable — the noticeboard is a reason for a parent to find us.
export const metadata = {
  title: 'Trials',
  description: 'Open football trials in Victoria and New South Wales, by age group, region and position.',
  alternates: { canonical: '/trials' },
};

const GENDERS: [string, string][] = [['boys', 'Boys'], ['girls', 'Girls'], ['men', 'Men'], ['women', 'Women']];
const STATES: Record<string, string> = { VIC: 'Victoria', NSW: 'New South Wales' };

type Params = { age?: string; gender?: string; state?: string; pos?: string };

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

  // Chronological and filtered only by what the family chose. No recommender,
  // no personalisation, ever (D-74).
  // A notice names every age group it is for (D-68 as amended 16 Sep), in
  // the lookup's own order, so "U14 & U15" is found under both.
  // What is on the board is the database's answer (0140): still to come, and
  // never a suspended club's, whatever the class of its suspension.
  const { rows } = await db.query(
    `select t.id, t.title, t.time_venue, t.source, t.competition_gender, t.position_needs,
       array(select ta.age_group from trial_notice_age_group ta join age_group ag on ag.code = ta.age_group
             where ta.trial_notice_id = t.id order by ag.sort) as age_groups,
       upper(to_char(t.trial_on, 'Mon')) as mon, to_char(t.trial_on, 'FMDD') as day,
       to_char(t.added_on, 'DD Mon') as listed, to_char(t.last_checked, 'DD Mon') as checked,
       c.name as club_name, c.club_state, c.public_slug, c.state
     from fn_trial_notices_advertised() t join club c on c.id = t.club_id
     order by t.trial_on`,
  );
  type Listing = {
    title: string; time_venue: string; source: string; mon: string; day: string; age_groups: string[];
    competition_gender: string | null; position_needs: string[]; state: string | null;
    id: string; listed: string; checked: string; club_name: string; club_state: string; public_slug: string | null;
  };
  const upcoming = rows as Listing[];
  // The age filter offers the groups the board holds right now, in the
  // lookup's order — not a fixed list that missed U17 and seniors.
  const lookup = (await db.query(`select code, sort from age_group order by sort`)).rows as { code: string }[];
  const agesHere = lookup.map((a) => a.code).filter((code) => upcoming.some((l) => l.age_groups.includes(code)));
  const age = raw.age && lookup.some((a) => a.code === raw.age) ? raw.age : null;
  const matches = (l: Listing, f: { age: string | null; gender: string | null; state: string | null; pos: string | null }) =>
    (!f.age || l.age_groups.includes(f.age)) && (!f.gender || l.competition_gender === f.gender)
    && (!f.state || l.state === f.state) && (!f.pos || (l.position_needs ?? []).includes(f.pos));
  const current = { age, gender, state, pos };
  const listings = upcoming.filter((l) => matches(l, current));
  const lastChecked = listings.length ? listings[listings.length - 1].checked : null;

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

  const href = (next: Partial<typeof current>) => {
    const p = new URLSearchParams();
    const merged = { ...current, ...next };
    if (merged.age) p.set('age', merged.age);
    if (merged.gender) p.set('gender', merged.gender);
    if (merged.state) p.set('state', merged.state);
    if (merged.pos) p.set('pos', merged.pos);
    const qs = p.toString();
    return qs ? `/trials?${qs}` : '/trials';
  };

  const active = [
    age && { key: 'age', label: age === 'SEN' ? 'Seniors' : age, clear: href({ age: null }) },
    gender && { key: 'gender', label: GENDERS.find(([v]) => v === gender)![1], clear: href({ gender: null }) },
    state && { key: 'state', label: STATES[state], clear: href({ state: null }) },
    pos && { key: 'pos', label: `${pos} wanted`, clear: href({ pos: null }) },
  ].filter(Boolean) as { key: string; label: string; clear: string }[];

  const groupLabel: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted };
  const Chip = ({ to, on, children, title }: { to: string; on: boolean; children: React.ReactNode; title?: string }) => (
    <Link href={to} className="chip" aria-pressed={on} title={title}>{children}</Link>
  );
  // A link, not a control, like the club's register: every filtered view has
  // its own address, works with no JavaScript, and can be sent to a parent.
  const groups = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={groupLabel}>Age group</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          <Chip to={href({ age: null })} on={!age}>Any age</Chip>
          {agesHere.filter((a) => shows(count({ age: a }), age === a)).map((a) => <Chip key={a} to={href({ age: age === a ? null : a })} on={age === a}>{a === 'SEN' ? 'Seniors' : a}<span className="chip-count">{count({ age: a })}</span></Chip>)}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={groupLabel}>Competition</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          <Chip to={href({ gender: null })} on={!gender}>All</Chip>
          {GENDERS.filter(([v]) => shows(count({ gender: v }), gender === v)).map(([v, t]) => <Chip key={v} to={href({ gender: gender === v ? null : v })} on={gender === v}>{t}<span className="chip-count">{count({ gender: v })}</span></Chip>)}
        </div>
      </div>
      {statesHere.length > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={groupLabel}>State</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            <Chip to={href({ state: null })} on={!state}>Both</Chip>
            {statesHere.filter((k) => shows(count({ state: k }), state === k)).map((k) => <Chip key={k} to={href({ state: state === k ? null : k })} on={state === k}>{STATES[k]}<span className="chip-count">{count({ state: k })}</span></Chip>)}
          </div>
        </div>
      )}
      {posHere.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={groupLabel}>Positions wanted</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            <Chip to={href({ pos: null })} on={!pos}>Any</Chip>
            {posHere.filter((c) => shows(count({ pos: c }), pos === c)).map((c) => <Chip key={c} to={href({ pos: pos === c ? null : c })} on={pos === c} title={POSITIONS[c].label}>{c}<span className="chip-count">{count({ pos: c })}</span></Chip>)}
          </div>
        </div>
      )}
    </div>
  );

  // One of the four pages analytics may count (lib/analytics-scope).
  return (
    <>
    <TrialsFrame>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Wordmark size={20} /></div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Trials board</h1>
            <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>Club trials listed below, by trial date.</div>
          </div>
        </div>

        {/* Phone: the four groups fold into one Filters button, and what is
            chosen stays on screen as chips you can take off one at a time.
            <details> opens and closes with no JavaScript. At a laptop there is
            room, so the groups sit open in a card instead. */}
        <details className="m-only trial-filters">
          <summary className="chip" style={{ alignSelf: 'flex-start', cursor: 'pointer', listStyle: 'none' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M3 6h18M6 12h12M10 18h4" /></svg>
            Filters
            {active.length > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: 999, background: T.accent, color: T.onAccent, fontSize: 10.5, fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{active.length}</span>}
          </summary>
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', marginTop: 10 }}>{groups}</div>
        </details>
        <div className="d-only" style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' }}>{groups}</div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: -4 }}>
          {active.map((a) => (
            <Link key={a.key} href={a.clear} className="chip" aria-pressed="true" aria-label={`Remove ${a.label}`}>
              {a.label}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
            </Link>
          ))}
          <div aria-live="polite" style={{ fontSize: 12.5, fontWeight: 700, color: T.muted, padding: '0 4px' }}>
            {listings.length} {listings.length === 1 ? 'trial' : 'trials'}
          </div>
          {active.length > 1 && <Link href="/trials" style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 4px' }}>Clear</Link>}
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '13px 14px', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7 v5.5 l3.5 2" /></svg>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, lineHeight: 1.5 }}>Some clubs take your interest inside Pitch. The rest read a CV in their inbox like they always have — the button on each listing tells you which.{lastChecked ? ` Last checked ${lastChecked}.` : ''}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {listings.length === 0 && (
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', fontSize: 13, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
              No trials listed for that yet. An empty week is honest — we only list what a club has posted or published itself.
            </div>
          )}
          {listings.map((l) => {
            const verified = l.club_state === 'verified';
            // The same test the club page uses (app/fc/[slug]): a club that has
            // claimed its page has a register, verified or not. The board sent a
            // claimed club's families to "Send my CV" while its own page offered
            // the register — two answers to one question. One button now: the
            // family registers interest, and until the club is verified it sees
            // a count and nothing else (D-90, D-126). Nor is the family told the
            // club is unverified (doc 14 M9), so a claimed club carries neither
            // label, exactly as its own page shows neither.
            const onPitch = verified || l.club_state === 'claimed';
            return (
              <div key={l.club_name + l.title} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ background: verified ? 'rgba(61,220,132,.12)' : T.surface2, borderRadius: verified ? 11 : 12, padding: '7px 10px', textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.06em', color: verified ? T.accent : T.muted }}>{l.mon}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{l.day}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{l.club_name} · {l.title.replace(' trials', '')}</div>
                  <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{l.time_venue}</div>
                  <div style={{ fontSize: 10, color: T.muted, fontWeight: 700 }}>Listed {l.listed} · checked {l.checked}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 8 }}>
                    {verified || !onPitch ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 999, background: verified ? T.accent : T.placeholder }} />
                        <div style={{ fontSize: 10.5, fontWeight: verified ? 800 : 700, color: verified ? T.accent : T.muted }}>
                          {verified ? 'On Pitch — verified club' : 'Unclaimed listing · register via club'}
                        </div>
                      </div>
                    ) : <div />}
                    {/* These were two styled boxes that did nothing when pressed — the
                        board's only call to action, dead for every family. They
                        open the club's page at its door now: the register of a
                        club on Pitch, carrying this trial so the club can invite
                        to it (D-153), or an unclaimed club's "send my CV". */}
                    {l.public_slug && (onPitch ? (
                      <Link href={`/fc/${l.public_slug}?trial=${l.id}#play`} style={{ background: T.accent, color: T.onAccent, borderRadius: 999, padding: '0 14px', minHeight: 44, display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 900, textDecoration: 'none', flexShrink: 0 }}>I&rsquo;m interested</Link>
                    ) : (
                      <Link href={`/fc/${l.public_slug}#play`} style={{ border: `1px solid ${T.line}`, color: T.secondary, borderRadius: 999, padding: '0 14px', minHeight: 44, display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>Send my CV</Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TrialsFrame>
    <PublicAnalytics />
    </>
  );
}
