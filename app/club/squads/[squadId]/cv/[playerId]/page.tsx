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
import { assembleCv, cvClubColours, wornColours, type CvData } from '@/lib/record-read';
import { getSessionPersonId } from '@/lib/session';
import { STAT_LABELS, type StatKey } from '@/lib/football';
import { HeaderMark } from '@/components/Wordmark';
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
    // The club's colours follow the membership too (D-174, 0165).
    if (cv) cv = { ...cv, band: 'u16', ...(await cvClubColours(playerId)) };
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

  // A's page header in the CV's own column (F, 1 Oct), then the offers —
  // stacked on a phone, three across from 768 — then the card. The way back
  // lands on this player's row of the squad sheet (P1, BUZ 1 Oct).
  const head = (
    <>
      <HeaderMark back={{ href: `/club/squads/${squadId}#p-${playerId}`, label: 'The squad' }} />
      {onPage.length > 0 && (
        <div className="verify-strip">
          {onPage.map((v) => (
            <form key={v.stat_id} action={verifyStat} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="hidden" name="squadId" value={squadId} />
              <input type="hidden" name="playerId" value={playerId} />
              <input type="hidden" name="statId" value={v.stat_id} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--secondary)' }}>{STAT_LABELS[v.stat_key]}</span>
                <span className="tnum" style={{ fontSize: 15, fontWeight: 900, color: 'var(--ink)' }}>{v.value}</span>
              </div>
              <button type="submit" className="btn btn-secondary">{`Verify for ${v.club_name}`}</button>
            </form>
          ))}
        </div>
      )}
    </>
  );
  return <PlayerCV p={cv} {...wornColours(cv)} head={head} />;
}
