// "Where do you play?" (0052, D-158). A player from 16, or a parent for any
// child, picks the club and the squad; the club confirms it. Until then
// nothing changes and no club is told anything but the ask itself.
//
// Clubs are searchable here and children never are: this lists verified
// clubs, which are organisations, not people (D-126, D-18).
import { notFound, redirect } from 'next/navigation';
import { HeaderMark } from '@/components/Wordmark';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { getSessionPersonId } from '@/lib/session';
import { T } from '@/lib/palette';
import { card, fieldLabel } from '@/lib/ui';
import { askToJoinSquad } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Where you play', robots: { index: false, follow: false } };

export default async function ChooseSquad({ params, searchParams }: {
  params: Promise<{ personId: string }>;
  searchParams: Promise<{ club?: string; q?: string; error?: string; back?: string }>;
}) {
  const { personId } = await params;
  const { club, q, error, back } = await searchParams;
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  if (!isUuid(personId)) notFound();

  const who = (await db.query(
    `select p.first_name, fn_can_act_on_squad($2, p.id) as may,
            (select id from development_record where person_id = p.id) as record_id
     from person p where p.id = $1`,
    [personId, me],
  )).rows[0] as { first_name: string; may: boolean; record_id: string | null } | undefined;
  if (!who?.may) redirect('/home');

  const backTo = back === 'controls' ? `/g/controls/${personId}` : who.record_id ? `/build/${who.record_id}` : '/home';
  const mine = me === personId;
  const search = (q ?? '').trim().slice(0, 60);

  const clubs = (await db.query(
    `select id, name, suburb, state from club
     where club_state = 'verified' and ($1 = '' or name ilike '%' || $1 || '%')
     order by name limit 25`, [search],
  )).rows as { id: string; name: string; suburb: string | null; state: string | null }[];

  const picked = club && isUuid(club)
    ? (await db.query(`select id, name from club where id = $1 and club_state = 'verified'`, [club])).rows[0] as { id: string; name: string } | undefined
    : undefined;
  const squads = picked ? (await db.query(
    `select s.id, s.name, s.age_group, s.competition_gender, s.season from squad s
     where s.club_id = $1 order by s.name`, [picked.id],
  )).rows as { id: string; name: string; age_group: string | null; competition_gender: string | null; season: string }[] : [];

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: backTo, label: 'Back' }} />
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>{mine ? 'Where do you play?' : `Where does ${who.first_name} play?`}</h1>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>
            Pick the club and the team. The club confirms it, and then {mine ? 'your' : `${who.first_name}’s`} page shows it.
          </div>
        </div>

        {error && <div role="alert" style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>That didn’t go through. You may have asked this club already.</div>}

        {!picked ? (
          <>
            <form method="get" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 11 }}>
              {back && <input type="hidden" name="back" value={back} />}
              <label className="field"><span className="field-label">Find your club</span>
                <input id="club-search" name="q" defaultValue={search} placeholder="Type a club’s name" maxLength={60} />
              </label>
              <button type="submit" className="btn btn-secondary">Search</button>
            </form>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={fieldLabel}>{search ? 'Clubs that match' : 'Clubs on Pitch'}</div>
              {clubs.length === 0 ? (
                <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55 }}>
                  No club by that name yet. Clubs appear here once they’ve joined Pitch and we’ve verified them by phone.
                </div>
              ) : clubs.map((c) => (
                <a key={c.id} href={`/squad/${personId}?club=${c.id}${back ? `&back=${back}` : ''}`} className="lift"
                  style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textDecoration: 'none', color: T.ink, minHeight: 44 }}>
                  <span>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{c.name}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{[c.suburb, c.state].filter(Boolean).join(' ')}</span>
                  </span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6 l6 6 -6 6" /></svg>
                </a>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={fieldLabel}>{picked.name} — which team?</div>
              {squads.length === 0 ? (
                <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55 }}>
                  {picked.name} hasn’t added its teams yet. Ask them to add yours, and come back.
                </div>
              ) : squads.map((s) => (
                <form key={s.id} action={askToJoinSquad}>
                  <input type="hidden" name="personId" value={personId} />
                  <input type="hidden" name="squadId" value={s.id} />
                  <input type="hidden" name="back" value={backTo} />
                  <button type="submit" className="lift" style={{ ...card, width: '100%', textAlign: 'left', cursor: 'pointer', color: T.ink, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 56 }}>
                    <span>
                      <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{s.name}</span>
                      <span style={{ display: 'block', fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{[s.age_group, s.competition_gender, s.season].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: T.accent }}>Ask them</span>
                  </button>
                </form>
              ))}
            </div>
            <a href={`/squad/${personId}${back ? `?back=${back}` : ''}`} className="btn btn-ghost">A different club</a>
          </>
        )}

        <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55 }}>
          The club sees the name and the team you picked, and nothing else, until they confirm it. If they don’t, nothing happens and nobody is told.
        </div>
      </div>
    </div>
  );
}
