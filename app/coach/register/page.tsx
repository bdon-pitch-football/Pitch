// A coach's registrations (D-154): read-only, and only the registrations
// aimed at the teams their club brought them in for. fn_register_rows
// decides what comes back; fn_can_read_registration decides which rows may
// open a CV, with every refusal the TD's view has (P19). Every row served is
// a read by a named person, and is logged (doc 32 C4a).
//
// No invite, no status, no shortlist: the one club-to-family route keeps one
// set of hands (D-117), recorded in D-154 as the more restrictive reading.
//
// Filters (BUZ, 15 Sep: "like the club view filtering"): by team and by
// position. As on the club register, they are applied AFTER the permission
// function, never inside the query that decides what this person may read —
// narrowing a list is a different question from being allowed to read it.
// There is no status filter because a coach sees no status.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { CoachConsole } from '@/components/console-shell';
import { POSITIONS } from '@/lib/football';
import { T } from '@/lib/palette';
import { card, sectionLabel } from '@/lib/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Registrations', robots: { index: false, follow: false } };

type Row = {
  registration_id: string; player_first_name: string; positions: string[]; note: string | null;
  squad_id: string | null; squad_name: string | null; has_clips: boolean;
};

export default async function CoachRegister({ searchParams }: {
  searchParams: Promise<{ pos?: string; team?: string }>;
}) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const { pos, team } = await searchParams;

  const clubs = (await db.query(
    `select distinct c.id, c.name from register_grant g join club c on c.id = g.club_id
     where g.person_id = $1 and g.revoked_at is null
       and g.squad_id in (select fn_register_grant_squads($1, g.club_id))
     order by c.name`,
    [me],
  )).rows as { id: string; name: string }[];
  if (clubs.length === 0) redirect('/home');

  const sections: { club: string; rows: Row[]; readable: Set<string> }[] = [];
  for (const c of clubs) {
    const rows = (await db.query(`select * from fn_register_rows($1, $2)`, [me, c.id])).rows as Row[];
    const readable = new Set((await db.query(
      `select r.id from registration r where r.club_id = $2 and fn_can_read_registration($1, r.id)`, [me, c.id],
    )).rows.map((x: { id: string }) => x.id));
    if (rows.length > 0) {
      await db.query(
        `insert into register_read_log (person_id, registration_id, surface) select $1, unnest($2::uuid[]), 'list'`,
        [me, rows.map((r) => r.registration_id)],
      );
    }
    sections.push({ club: c.name, rows, readable });
  }

  // ---- filters, over what the database already allowed -------------------
  const all = sections.flatMap((s) => s.rows);
  const teams = [...new Map(all.filter((r) => r.squad_id).map((r) => [r.squad_id as string, r.squad_name ?? ''])).entries()]
    .map(([id, name]) => ({ id, name, n: all.filter((r) => r.squad_id === id).length }));
  const usedPositions = (Object.keys(POSITIONS) as (keyof typeof POSITIONS)[])
    .filter((p) => all.some((r) => r.positions.includes(p)));
  const posOk = pos && usedPositions.includes(pos as keyof typeof POSITIONS) ? pos : null;
  const teamOk = team && teams.some((t) => t.id === team) ? team : null;
  const keep = (r: Row) => (!posOk || r.positions.includes(posOk)) && (!teamOk || r.squad_id === teamOk);
  const shown = all.filter(keep).length;
  const qs = (next: { pos?: string | null; team?: string | null }) => {
    const p = new URLSearchParams();
    const np = next.pos === undefined ? posOk : next.pos;
    const nt = next.team === undefined ? teamOk : next.team;
    if (nt) p.set('team', nt);
    if (np) p.set('pos', np);
    const s = p.toString();
    return s ? `/coach/register?${s}` : '/coach/register';
  };

  const label = sectionLabel;
  const filterLabel: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted };

  return (
    <CoachConsole active="register">
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/home' }} />
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Registrations</h1>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>For the teams your club brought you in for.</div>
        </div>

        {all.length > 0 && (
          <div className="console-filters" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 11 }}>
            {teams.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={filterLabel}>Which team</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  <Link href={qs({ team: null })} className="chip" aria-pressed={!teamOk}>All teams · {all.length}</Link>
                  {teams.map((t) => (
                    <Link key={t.id} href={qs({ team: t.id })} className="chip" aria-pressed={teamOk === t.id}>
                      {t.name} · {t.n}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={filterLabel}>Where they play</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                <Link href={qs({ pos: null })} className="chip" aria-pressed={!posOk}>Any position</Link>
                {usedPositions.map((p) => (
                  <Link key={p} href={qs({ pos: p })} className="chip" aria-pressed={posOk === p} title={POSITIONS[p].label}>
                    {p}
                  </Link>
                ))}
              </div>
            </div>
            {(posOk || teamOk) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${T.line}`, paddingTop: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: T.secondary }}>{shown} of {all.length} shown</div>
                <Link href="/coach/register" style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Clear</Link>
              </div>
            )}
          </div>
        )}

        {sections.map((sec) => {
          const rows = sec.rows.filter(keep);
          const bySquad = new Map<string, Row[]>();
          for (const r of rows) {
            const k = r.squad_name ?? '';
            bySquad.set(k, [...(bySquad.get(k) ?? []), r]);
          }
          return (
            <div key={sec.club} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <h2 style={label}>{sec.club}</h2>
              {sec.rows.length === 0 && (
                <div style={{ ...card, fontSize: 13, fontWeight: 500, color: T.muted }}>No one has registered for your teams yet.</div>
              )}
              {sec.rows.length > 0 && rows.length === 0 && (
                <div style={{ ...card, fontSize: 13, fontWeight: 500, color: T.muted }}>Nobody matches these filters.</div>
              )}
              {[...bySquad.entries()].map(([squad, list]) => (
                <div key={squad} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <div style={{ fontSize: 14, fontWeight: 900 }}>{squad} <span style={{ color: T.muted, fontWeight: 700 }}>· {list.length}</span></div>
                  {list.map((r) => (
                    <div key={r.registration_id} data-registration={r.registration_id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800 }}>{r.player_first_name}</div>
                        <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{r.positions.join(' · ')}{r.has_clips && ' · clips'}</div>
                      </div>
                      {r.note && (
                        <div style={{ background: T.surface2, borderRadius: 12, padding: '10px 12px', fontSize: 12.5, fontStyle: 'italic', color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>&ldquo;{r.note}&rdquo;</div>
                      )}
                      {sec.readable.has(r.registration_id) && (
                        <Link href={`/club/register/cv/${r.registration_id}`} style={{ background: T.surface2, borderRadius: 14, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: T.ink, textDecoration: 'none' }}>Open the CV</Link>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })}

        <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, lineHeight: 1.55 }}>
          You can read these. Inviting a family is for your technical director, and every registration you open is recorded.
        </div>
        <Link href="/home" className="btn btn-ghost">Back</Link>
      </div>
    </CoachConsole>
  );
}
