// Squads — what this club actually runs, and therefore what it takes
// registrations for. Pitch prescribes no competition structure (0017): the
// club says, and the interest register groups by what it said.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { addSquad, removeSquad } from './actions';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
  onAccent: '#06130c', amber: '#eda100',
};

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

const STAGE_LABEL: Record<string, string> = {
  miniroos: 'MiniRoos', junior: 'Juniors', youth: 'Youth', senior: 'Seniors',
};
const GENDERS = [
  ['boys', 'Boys'], ['girls', 'Girls'], ['mixed', 'Mixed'],
  ['open', 'Open'], ['men', 'Men'], ['women', 'Women'],
];

export default async function Squads({ searchParams }: {
  searchParams: Promise<{ added?: string; removed?: string; inuse?: string; error?: string }>;
}) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const { added, removed, inuse, error } = await searchParams;

  const club = await db.query(
    `select c.id, c.name from club c
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

  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };
  const label: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted };
  const field: React.CSSProperties = { background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3 };
  const input: React.CSSProperties = { background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 14.5, fontWeight: 700, fontFamily: 'inherit', padding: 0, width: '100%' };
  const stages = [...new Set(ages.map((a) => a.stage))];

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, color: T.ink, display: 'flex', justifyContent: 'center' }}>
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
            <div className="field" style={{ flex: 1, minWidth: 110 }}>
              <div className="field-label">Season</div>
              <input style={input} name="season" aria-label="Season" defaultValue="2026" required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">Add it</button>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
            Your age groups are yours. Boys and girls competitions rarely run the same ones, and they change between seasons and between states — so we don&rsquo;t decide them for you.
          </div>
        </form>

        {squads.map((s) => (
          <div key={s.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{s.name}</div>
              <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>
                {[s.age_group, s.competition_gender, s.season].filter(Boolean).join(' · ')}
                {(s.registrations > 0 || s.players > 0) && (
                  <> · <span style={{ color: T.secondary }}>{s.registrations} registered · {s.players} playing</span></>
                )}
              </div>
            </div>
            {s.registrations === 0 && s.players === 0 ? (
              <form action={removeSquad}><input type="hidden" name="squadId" value={s.id} />
                <button type="submit" style={{ height: 38, borderRadius: 11, border: `1px solid ${T.line}`, background: 'transparent', color: T.muted, fontSize: 12.5, fontWeight: 700, padding: '0 14px', cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
              </form>
            ) : (
              <div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, textAlign: 'right', maxWidth: 130 }}>In use — can&rsquo;t be removed</div>
            )}
          </div>
        ))}

        <Link href="/club/register" className="btn btn-ghost">Back to the register</Link>
      </div>
    </div>
  );
}
