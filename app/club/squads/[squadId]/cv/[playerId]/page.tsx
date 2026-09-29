// A squad player's CV, read from inside the club (0052, D-158).
//
// The authorisation is the squad itself: fn_squad_roster answers with a
// record id ONLY for someone who may read that squad's records — the
// technical director, or a coach the club granted this squad. An
// administrator gets a null record id there, so this page is not-found for
// them (D-93: a treasurer never reads a child's record).
//
// The club never sees a pending edit: an under-16's page is the guardian-
// approved snapshot (D-119), exactly as the register's own CV view does it.
// One assembly, three authorisations — the token, the registration, the squad.
// Keyed by the PLAYER, not their record, exactly as the register's view is
// keyed by the registration: a record id in a club-side path is a family
// surface's shape, and the guard that belongs on those is not what authorises
// this one.
import { notFound, redirect } from 'next/navigation';
import PlayerCV from '@/components/cv/PlayerCV';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { assembleCv, type CvData } from '@/lib/record-read';
import { getSessionPersonId } from '@/lib/session';
import { STAT_LABELS, type StatKey } from '@/lib/football';
import { T } from '@/lib/palette';
import { card } from '@/lib/ui';
import { verifyStat } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Player CV', robots: { index: false, follow: false } };

export default async function SquadCv({ params }: { params: Promise<{ squadId: string; playerId: string }> }) {
  const { squadId, playerId } = await params;
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  if (!isUuid(squadId) || !isUuid(playerId)) notFound();

  // The same shape as the register's own CV route: one question, asked of
  // the database, and a no is the same not-found as a squad that is not
  // there. fn_can_read_squad_player is fn_read_level (doc 14 table A) plus
  // where the reader is standing — the product's answer to "who may read
  // this child", never a second one computed here (0054, L23).
  const row = (await db.query(
    `select dr.id as record_id, fn_age_band(p.dob) as band
     from person p join development_record dr on dr.person_id = p.id
     where p.id = $1 and fn_can_read_squad_player($2, $3, p.id)`,
    [playerId, me, squadId],
  )).rows[0] as { record_id: string; band: string } | undefined;
  if (!row) notFound();
  const recordId = row.record_id;

  let cv: CvData | null;
  if (row.band === 'u16') {
    // The approved snapshot, with the club line following the membership
    // (BUZ, 23 Sep) — one function, so the club's view, the family's preview
    // and the share link cannot drift apart.
    const v = await db.query(`select fn_approved_cv($1) as content`, [recordId]);
    cv = (v.rows[0]?.content as CvData | null) ?? null;
    if (cv) cv = { ...cv, band: 'u16' };
  } else {
    cv = await assembleCv(recordId, playerId, row.band);
  }
  if (!cv) notFound();

  // Every read of a child's record carries a name, and the family can ask for
  // it (doc 32 C4a, doc 34 rule 6).
  await db.query(
    `insert into consent_event (event, actor_id, subject_id, detail)
     values ('squad_record_opened', $1, $2, jsonb_build_object('squad_id',$3::uuid))`,
    [me, playerId, squadId],
  );

  // "Verify for {club}" (D-160; BUZ's words, 29 Sep). What may be verified
  // and which club it would name are the database's answers (0122,
  // fn_verifiable_stats — empty for anyone without the pen). The page adds
  // one rule of its own: it offers only a number that is ON this page, as
  // shown. For an under-16 the page is the parent's approved snapshot
  // (D-119), so a live number the parent has not approved is never shown to
  // the club here, and a coach never confirms a number they cannot see. The
  // tiles are the 2026 season's surfaced stats, as PlayerCV draws them.
  const offered = (await db.query(
    `select stat_id, season, stat_key, value, club_name from fn_verifiable_stats($1, $2)`, [me, recordId],
  )).rows as { stat_id: string; season: string; stat_key: StatKey; value: number; club_name: string }[];
  const onPage = offered.filter((v) => v.season === '2026' && cv!.surfacedStats.includes(v.stat_key)
    && cv!.stats.some((s) => s.season === v.season && s.key === v.stat_key && s.value === v.value && s.provenance === 'self_reported'));

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', background: T.bg }}>
        <div className="reading" style={{ width: '100%', padding: '14px 18px 0 18px', boxSizing: 'border-box' }}>
          <a href={`/club/squads/${squadId}`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, gap: 6, textDecoration: 'none', color: T.muted, fontSize: 13, fontWeight: 700 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 5 L8 12 L15 19" /></svg>
            The squad
          </a>
          {onPage.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '6px 0 14px 0' }}>
              {onPage.map((v) => (
                <form key={v.stat_id} action={verifyStat} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input type="hidden" name="squadId" value={squadId} />
                  <input type="hidden" name="playerId" value={playerId} />
                  <input type="hidden" name="statId" value={v.stat_id} />
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.secondary }}>{STAT_LABELS[v.stat_key]}</span>
                    <span className="tnum" style={{ fontSize: 15, fontWeight: 900, color: T.ink }}>{v.value}</span>
                  </div>
                  <button type="submit" className="btn btn-secondary">{`Verify for ${v.club_name}`}</button>
                </form>
              ))}
            </div>
          )}
        </div>
      </div>
      <PlayerCV p={cv} />
    </>
  );
}
