// Squads — what this club actually runs, and therefore what it takes
// registrations for. Pitch prescribes no competition structure (0017): the
// club says, and the interest register groups by what it said.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { ClubConsole } from '@/components/console-shell';
import { addSquad, removeSquad, inviteCoach, revokeCoach } from './actions';
import { fieldLabel } from '@/lib/ui';
import { AdderSummary } from '@/components/club/Adder';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Squads', robots: { index: false, follow: false } };

const STAGE_LABEL: Record<string, string> = {
  miniroos: 'MiniRoos', junior: 'Juniors', youth: 'Youth', senior: 'Seniors',
};
const GENDERS = [
  // D-68 as amended 15 Sep: four values, no mixed and no open.
  ['boys', 'Boys'], ['girls', 'Girls'], ['men', 'Men'], ['women', 'Women'],
];

export default async function Squads({ searchParams }: {
  searchParams: Promise<{ added?: string; removed?: string; inuse?: string; error?: string; coachAsked?: string; coachRemoved?: string; coachError?: string }>;
}) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const { added, removed, inuse, error, coachAsked, coachRemoved, coachError } = await searchParams;

  const club = await db.query(
    `select c.id, c.name, m.role from club c
     join membership m on m.club_id = c.id and m.person_id = $1
       and m.role in ('technical_director','club_admin') and m.ended_at is null
     limit 1`,
    [me],
  );
  if (club.rows.length === 0) redirect('/home');
  const c = club.rows[0];

  const ages = (await db.query(
    `select code, label, stage, sort from age_group order by sort`,
  )).rows as { code: string; label: string; stage: string; sort: number }[];

  const squads = (await db.query(
    `select s.id, s.name, s.age_group, s.competition_gender, s.season,
       (select count(*)::int from registration r
         where r.squad_target = s.id and r.withdrawn_at is null) as registrations,
       (select count(*)::int from membership m
         where m.squad_id = s.id and m.role = 'player' and m.ended_at is null) as players
     from squad s where s.club_id = $1
     order by coalesce(nullif(regexp_replace(coalesce(s.age_group,''),'\\D','','g'),'')::int, 999), s.name`,
    [c.id],
  )).rows as {
    id: string; name: string; age_group: string | null; competition_gender: string | null;
    season: string; registrations: number; players: number;
  }[];

  const label = fieldLabel;
  const stages = [...new Set(ages.map((a) => a.stage))];
  // D-154: only the TD brings coaches in, and only the TD sees who holds
  // register access (doc 34 rule 5) — the database decides that, not this
  // page (fn_club_register_grants, 0069), so an administrator asking gets no
  // rows. Invites that are still waiting are never listed — a list would tell
  // the TD which emails have accounts.
  const isTd = c.role === 'technical_director';
  const grants = (await db.query(
    `select person_id as id, name, teams, since from fn_club_register_grants($1, $2)`,
    [me, c.id],
  )).rows as { id: string; name: string; teams: string[]; since: string }[];

  return (
    <ClubConsole active="squads">
      <div className="console cc-page">
        <HeaderMark />
        <div className="pg-titles" style={{ gap: 2 }}>
          <h1 className="pg-title">Squads</h1>
          {/* P2 (BUZ, 1 Oct): "· 0 squads" is not printed; one is "1 squad"
              (BUZ, 1 Oct, via Leo). */}
          <div className="pg-sub" style={{ fontSize: 13.5 }}>
            {c.name}{squads.length > 0 && <> · <b style={{ color: 'var(--ink)' }}>{`${squads.length} ${squads.length === 1 ? 'squad' : 'squads'}`}</b></>}
          </div>
        </div>

        <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55 }}>
          These are the squads families choose from when they register interest, and the groups your register is sorted into. Add the ones you actually run — anything from MiniRoos to under 23s.
        </div>

        {added && <div className="cc-said cc-said-ok">Squad added. Families can register for it now.</div>}
        {removed && <div className="cc-said">Squad removed.</div>}
        {inuse && <div className="cc-said cc-said-warn">That squad has players or registrations in it, so it stays. Nobody gets removed from a list because a squad was tidied up.</div>}
        {error && <div className="cc-said cc-said-warn">Give it a name, an age group, who plays in it, and a season.</div>}

        {/* "Add a squad" folds behind one chip, and opens by itself when the
            club has none (F). Its heading is the summary: said once. */}
        <details className="cc-adder" open={squads.length === 0 || Boolean(error)}>
          <AdderSummary>Add a squad</AdderSummary>
          <form action={addSquad} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <label className="field">
              <div className="field-label">What you call it</div>
              <input name="name" aria-label="What you call it" placeholder="U14 Boys" required />
            </label>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: 1, minWidth: 150 }}>
                <div className="field-label">Age group</div>
                <select name="ageGroup" aria-label="Age group" defaultValue="U14">
                  {stages.map((st) => (
                    <optgroup key={st} label={STAGE_LABEL[st] ?? st}>
                      {ages.filter((a) => a.stage === st).map((a) => (
                        <option key={a.code} value={a.code}>{a.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: 1, minWidth: 130 }}>
                <div className="field-label">Who plays in it</div>
                <select name="gender" aria-label="Who plays in it" defaultValue="boys">
                  {GENDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <label className="field" style={{ flex: 1, minWidth: 110 }}>
                <div className="field-label">Season</div>
                <input name="season" aria-label="Season" defaultValue="2026" required />
              </label>
            </div>
            <button type="submit" className="btn btn-primary btn-auto-wide">Add it</button>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, lineHeight: 1.55 }}>
              Your age groups are yours. Boys and girls competitions rarely run the same ones, and they change between seasons and between states — so we don&rsquo;t decide them for you.
            </div>
          </form>
        </details>

        {/* One panel of squad rows; from 768 it is the table, with the two
            counts in their own columns and a dash for a zero (D-162). */}
        {squads.length > 0 && (
          <div className="card rows sq-list">
            <div className="sq-head" aria-hidden>
              <div>Squad</div><div>Registered</div><div>Playing</div><div /><div />
            </div>
            {squads.map((s) => (
              <div key={s.id} className="sq-row">
                <div style={{ minWidth: 0 }}>
                  <a href={`/club/squads/${s.id}`} className="sq-name">{s.name}</a>
                  <div className="sq-meta">
                    {[s.age_group, s.competition_gender, s.season].filter(Boolean).join(' · ')}
                    {/* D-162: a count that is zero is omitted, never printed. This line
                        said "0 playing" on ten of eleven squads in October, which is
                        true and reads as a broken page. Each figure shows only when
                        it has something to say. */}
                    {(s.registrations > 0 || s.players > 0) && (
                      <span className="sq-meta-n"> · <span style={{ color: 'var(--secondary)' }}>{[
                        s.registrations > 0 ? `${s.registrations} registered` : null,
                        s.players > 0 ? `${s.players} playing` : null,
                      ].filter(Boolean).join(' · ')}</span></span>
                    )}
                  </div>
                </div>
                <div className={s.registrations > 0 ? 'sq-n tnum' : 'sq-n none'} aria-hidden>{s.registrations > 0 ? s.registrations : '—'}</div>
                <div className={s.players > 0 ? 'sq-n tnum' : 'sq-n none'} aria-hidden>{s.players > 0 ? s.players : '—'}</div>
                <a href={`/club/squads/${s.id}`} className="sq-who">Who plays</a>
                <div className="sq-end">
                  {s.registrations === 0 && s.players === 0 ? (
                    <form action={removeSquad}><input type="hidden" name="squadId" value={s.id} />
                      <button type="submit" className="textbtn">Remove</button>
                    </form>
                  ) : (
                    <div className="sq-inuse">In use — can&rsquo;t be removed</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {isTd && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <h2 className="sec-h">Coaches who read your register</h2>
            <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55 }}>
              Bring in the coach who runs an age group and they can read the registrations for their teams — up to three teams each, and up to ten coaches. They can&rsquo;t invite a family or change anything, and every time they open one it&rsquo;s recorded.
            </div>
            {coachAsked && <div className="cc-said cc-said-ok">Done. If that&rsquo;s a coach&rsquo;s Pitch account, they&rsquo;ll see your request next time they sign in.</div>}
            {coachRemoved && <div className="cc-said">They can no longer read your register.</div>}
            {coachError && <div className="cc-said cc-said-warn">Give their Pitch email, pick one to three teams, and confirm you&rsquo;ve checked their Working with Children Check.</div>}
            {grants.length > 0 && (
              <div className="card rows sq-list">
                {grants.map((g) => (
                  <div key={g.id} className="grant-row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800 }}>{g.name}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500 }}>{g.teams.join(' · ')} · since {g.since}</div>
                    </div>
                    <form action={revokeCoach}><input type="hidden" name="personId" value={g.id} />
                      <button type="submit" className="textbtn">Remove</button>
                    </form>
                  </div>
                ))}
              </div>
            )}
            {squads.length > 0 && (
              <details className="cc-adder" open={grants.length === 0 || Boolean(coachError)}>
                <AdderSummary>Bring in a coach</AdderSummary>
                <form action={inviteCoach} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  <label className="field">
                    <div className="field-label">Their Pitch email</div>
                    <input name="email" type="email" aria-label="Their Pitch email" required />
                  </label>
                  <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <legend style={{ ...label, padding: 0, marginBottom: 6 }}>Their teams — up to three</legend>
                    {squads.map((s) => (
                      <label key={s.id} className="chip pick">
                        <input type="checkbox" name="squadIds" value={s.id} aria-label={s.name} /> {s.name}
                      </label>
                    ))}
                  </fieldset>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minHeight: 44, fontSize: 13, fontWeight: 700, color: 'var(--secondary)', lineHeight: 1.5, cursor: 'pointer' }}>
                    <input type="checkbox" name="wwcc" aria-label="I have checked their Working with Children Check" required style={{ marginTop: 3 }} />
                    I&rsquo;ve checked their Working with Children Check.
                  </label>
                  <button type="submit" className="btn btn-primary btn-auto-wide">Bring them in</button>
                </form>
              </details>
            )}
          </div>
        )}

        <Link href={isTd ? '/club/register' : '/home'} className="btn btn-ghost">{isTd ? 'Back to the register' : 'Back'}</Link>
      </div>
    </ClubConsole>
  );
}
