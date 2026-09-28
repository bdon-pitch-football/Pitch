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
import { T } from '@/lib/palette';
import { card, fieldLabel } from '@/lib/ui';

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
  const field: React.CSSProperties = { background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3 };
  const input: React.CSSProperties = { background: 'transparent', border: 'none', color: T.ink, fontSize: 14.5, fontWeight: 700, fontFamily: 'inherit', padding: 0, width: '100%' };
  const stages = [...new Set(ages.map((a) => a.stage))];
  // D-154: only the TD brings coaches in, and only the TD sees who holds
  // register access (doc 34 rule 5). Invites that are still waiting are
  // never listed — a list would tell the TD which emails have accounts.
  const isTd = c.role === 'technical_director';
  const grants = isTd ? (await db.query(
    `select p.id, trim(p.first_name || ' ' || coalesce(p.last_name, '')) as name,
       array_agg(s.name order by s.name) as teams,
       to_char(min(g.granted_at) at time zone 'Australia/Melbourne', 'FMDD Mon') as since
     from register_grant g join person p on p.id = g.person_id join squad s on s.id = g.squad_id
     where g.club_id = $1 and g.revoked_at is null
     group by p.id, p.first_name, p.last_name order by name`,
    [c.id],
  )).rows as { id: string; name: string; teams: string[]; since: string }[] : [];

  return (
    <ClubConsole active="squads">
      <div className="console" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Squads</h1>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>
            {c.name} · <b style={{ color: T.ink }}>{squads.length} squads</b>
          </div>
        </div>

        <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55 }}>
          These are the squads families choose from when they register interest, and the groups your register is sorted into. Add the ones you actually run — anything from MiniRoos to under 23s.
        </div>

        {added && <div style={{ ...card, border: `1px solid ${T.accent}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>Squad added. Families can register for it now.</div>}
        {removed && <div style={{ ...card, fontSize: 13, fontWeight: 700, color: T.secondary }}>Squad removed.</div>}
        {inuse && <div style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>That squad has players or registrations in it, so it stays. Nobody gets removed from a list because a squad was tidied up.</div>}
        {error && <div style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>Give it a name, an age group, who plays in it, and a season.</div>}

        <form action={addSquad} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>Add a squad</div>
          <label className="field">
            <div className="field-label">What you call it</div>
            <input style={input} name="name" aria-label="What you call it" placeholder="U14 Boys" required />
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
              <input style={input} name="season" aria-label="Season" defaultValue="2026" required />
            </label>
          </div>
          <button type="submit" className="btn btn-primary">Add it</button>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
            Your age groups are yours. Boys and girls competitions rarely run the same ones, and they change between seasons and between states — so we don&rsquo;t decide them for you.
          </div>
        </form>

        {squads.map((s) => (
          <div key={s.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <a href={`/club/squads/${s.id}`} style={{ fontSize: 15, fontWeight: 800, color: T.ink, textDecoration: 'none', minHeight: 44, display: 'flex', alignItems: 'center' }}>{s.name}</a>
              <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>
                {[s.age_group, s.competition_gender, s.season].filter(Boolean).join(' · ')}
                {(s.registrations > 0 || s.players > 0) && (
                  <> · <span style={{ color: T.secondary }}>{s.registrations} registered · {s.players} playing</span></>
                )}
              </div>
            </div>
            <a href={`/club/squads/${s.id}`} style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, textDecoration: 'none', minHeight: 44, display: 'flex', alignItems: 'center', flexShrink: 0 }}>Who plays</a>
            {s.registrations === 0 && s.players === 0 ? (
              <form action={removeSquad}><input type="hidden" name="squadId" value={s.id} />
                <button type="submit" style={{ height: 44, borderRadius: 11, border: `1px solid ${T.line}`, background: 'transparent', color: T.muted, fontSize: 12.5, fontWeight: 700, padding: '0 14px', cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
              </form>
            ) : (
              <div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, textAlign: 'right', maxWidth: 130 }}>In use — can&rsquo;t be removed</div>
            )}
          </div>
        ))}

        {isTd && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <h2 style={label}>Coaches who read your register</h2>
            <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55 }}>
              Bring in the coach who runs an age group and they can read the registrations for their teams — up to three teams each, and up to ten coaches. They can&rsquo;t invite a family or change anything, and every time they open one it&rsquo;s recorded.
            </div>
            {coachAsked && <div style={{ ...card, border: `1px solid ${T.accent}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>Done. If that&rsquo;s a coach&rsquo;s Pitch account, they&rsquo;ll see your request next time they sign in.</div>}
            {coachRemoved && <div style={{ ...card, fontSize: 13, fontWeight: 700, color: T.secondary }}>They can no longer read your register.</div>}
            {coachError && <div style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>Give their Pitch email, pick one to three teams, and confirm you&rsquo;ve checked their Working with Children Check.</div>}
            {grants.map((g) => (
              <div key={g.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{g.name}</div>
                  <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{g.teams.join(' · ')} · since {g.since}</div>
                </div>
                <form action={revokeCoach}><input type="hidden" name="personId" value={g.id} />
                  <button type="submit" style={{ height: 44, borderRadius: 11, border: `1px solid ${T.line}`, background: 'transparent', color: T.muted, fontSize: 12.5, fontWeight: 700, padding: '0 14px', cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
                </form>
              </div>
            ))}
            {squads.length > 0 && (
              <form action={inviteCoach} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 11 }}>
                <div style={{ fontSize: 14, fontWeight: 900 }}>Bring in a coach</div>
                <label className="field">
                  <div className="field-label">Their Pitch email</div>
                  <input style={input} name="email" type="email" aria-label="Their Pitch email" required />
                </label>
                <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <legend style={{ ...label, padding: 0, marginBottom: 6 }}>Their teams — up to three</legend>
                  {squads.map((s) => (
                    <label key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 12px', borderRadius: 999, border: `1px solid ${T.line}`, fontSize: 13, fontWeight: 700, color: T.secondary, cursor: 'pointer' }}>
                      <input type="checkbox" name="squadIds" value={s.id} aria-label={s.name} /> {s.name}
                    </label>
                  ))}
                </fieldset>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minHeight: 44, fontSize: 13, fontWeight: 700, color: T.secondary, lineHeight: 1.5, cursor: 'pointer' }}>
                  <input type="checkbox" name="wwcc" aria-label="I have checked their Working with Children Check" required style={{ marginTop: 3 }} />
                  I&rsquo;ve checked their Working with Children Check.
                </label>
                <button type="submit" className="btn btn-primary">Bring them in</button>
              </form>
            )}
          </div>
        )}

        <Link href={isTd ? '/club/register' : '/home'} className="btn btn-ghost">{isTd ? 'Back to the register' : 'Back'}</Link>
      </div>
    </ClubConsole>
  );
}
