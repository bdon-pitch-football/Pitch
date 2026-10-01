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
import { TopBarShell } from '@/components/console-shell';
import { G } from '@/components/player-parts';
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
  // `back` is a query string, so it is hostile (D-94 §3). It never becomes a
  // redirect — the line above compares it to one literal and the form below
  // carries backTo, which this page built. But it was also echoed raw into
  // every club link, uncapped and un-encoded. Carry the flag, not the value.
  const carry = back === 'controls' ? '&back=controls' : '';
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
    // A flow, so the Top bar (spec A part 5). A list is a page: no door.
    <TopBarShell>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: backTo, label: 'Back' }} />
        <div className="pg-titles">
          <h1 className="pg-title">{mine ? 'Where do you play?' : `Where does ${who.first_name} play?`}</h1>
          <div className="pg-sub" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
            Pick the club and the team. The club confirms it, and then {mine ? 'your' : `${who.first_name}’s`} page shows it.
          </div>
        </div>

        {error && <div role="alert" className="card card-amber c-say">That didn’t go through. You may have asked this club already.</div>}

        {!picked ? (
          <>
            {/* The light search field from / and /claim ("Find your club" is
                the same words there): one object wherever a family looks for
                a club. A GET form, so it searches with no JavaScript. */}
            <form method="get" className="c-gap">
              {carry && <input type="hidden" name="back" value="controls" />}
              <label htmlFor="club-search" className="field-label">Find your club</label>
              <div className="fl-search" style={{ maxWidth: 'none' }}>
                <span className="fl-search-field">
                  <span style={{ display: 'flex', color: '#5b6b62' }}>{G.search()}</span>
                  <input id="club-search" name="q" defaultValue={search} placeholder="Type a club’s name" maxLength={60} />
                </span>
                <button type="submit" className="btn btn-secondary">Search</button>
              </div>
            </form>
            <section className="c-gap">
              <h2 className="sec-h">{search ? 'Clubs that match' : 'Clubs on Pitch'}</h2>
              {clubs.length === 0 ? (
                // Dashed means "not yet" (spec A part 16).
                <div className="card empty">
                  <span className="empty-tile" aria-hidden />
                  <div className="empty-b">No club by that name yet. Clubs appear here once they’ve joined Pitch and we’ve verified them by phone.</div>
                </div>
              ) : (
                <div className="card rows">
                  {/* Each row stays an <a href="?club="> with the club's name as
                      its first text (clubs1, clubs2). */}
                  {clubs.map((c) => (
                    <a key={c.id} href={`/squad/${personId}?club=${c.id}${carry}`} className="row">
                      <span className="row-main">
                        <span className="row-t" style={{ fontSize: 15 }}>{c.name}</span>
                        <span className="row-s">{[c.suburb, c.state].filter(Boolean).join(' ')}</span>
                      </span>
                      <span className="row-chev">{G.chev()}</span>
                    </a>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            <section className="c-gap">
              <h2 className="sec-h">{picked.name} — which team?</h2>
              {squads.length === 0 ? (
                <div className="card empty">
                  <span className="empty-tile" aria-hidden />
                  <div className="empty-b">{picked.name} hasn’t added its teams yet. Ask them to add yours, and come back.</div>
                </div>
              ) : (
                <div className="card rows">
                  {/* Each team is a List row that is a submit button, ending in
                      the action word (green, because it is the action). */}
                  {squads.map((s) => (
                    <form key={s.id} action={askToJoinSquad} className="sq-row">
                      <input type="hidden" name="personId" value={personId} />
                      <input type="hidden" name="squadId" value={s.id} />
                      <input type="hidden" name="back" value={backTo} />
                      <button type="submit" className="row">
                        <span className="row-main">
                          <span className="row-t" style={{ fontSize: 15 }}>{s.name}</span>
                          <span className="row-s">{[s.age_group, s.competition_gender, s.season].filter(Boolean).join(' · ')}</span>
                        </span>
                        <span className="row-end">Ask them</span>
                      </button>
                    </form>
                  ))}
                </div>
              )}
            </section>
            <a href={`/squad/${personId}${carry ? '?back=controls' : ''}`} className="textbtn textbtn-block">A different club</a>
          </>
        )}

        <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.55 }}>
          The club sees the name and the team you picked, and nothing else, until they confirm it. If they don’t, nothing happens and nobody is told.
        </div>
      </div>
    </TopBarShell>
  );
}
