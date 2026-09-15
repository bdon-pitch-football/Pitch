// A coach's registrations (D-154): read-only, and only the registrations
// aimed at the teams their club brought them in for. fn_register_rows
// decides what comes back; fn_can_read_registration decides which rows may
// open a CV, with every refusal the TD's view has (P19). Every row served is
// a read by a named person, and is logged (doc 32 C4a).
//
// No invite, no status, no shortlist: the one club-to-family route keeps one
// set of hands (D-117), recorded in D-154 as the more restrictive reading.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { CoachConsole } from '@/components/console-shell';

const T = {
  surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85',
};

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Registrations', robots: { index: false, follow: false } };

type Row = {
  registration_id: string; player_first_name: string; positions: string[]; note: string | null;
  squad_id: string | null; squad_name: string | null; has_clips: boolean;
};

export default async function CoachRegister() {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');

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

  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };
  const label: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted };

  return (
    <CoachConsole active="register">
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/home' }} />
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Registrations</h1>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>For the teams your club brought you in for.</div>
        </div>

        {sections.map((sec) => {
          const bySquad = new Map<string, Row[]>();
          for (const r of sec.rows) {
            const k = r.squad_name ?? '';
            bySquad.set(k, [...(bySquad.get(k) ?? []), r]);
          }
          return (
            <div key={sec.club} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <h2 style={label}>{sec.club}</h2>
              {sec.rows.length === 0 && (
                <div style={{ ...card, fontSize: 13, fontWeight: 500, color: T.muted }}>No one has registered for your teams yet.</div>
              )}
              {[...bySquad.entries()].map(([squad, rows]) => (
                <div key={squad} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <div style={{ fontSize: 14, fontWeight: 900 }}>{squad} <span style={{ color: T.muted, fontWeight: 700 }}>· {rows.length}</span></div>
                  {rows.map((r) => (
                    <div key={r.registration_id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
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
