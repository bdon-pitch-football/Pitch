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
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Player CV', robots: { index: false, follow: false } };

export default async function SquadCv({ params }: { params: Promise<{ squadId: string; playerId: string }> }) {
  const { squadId, playerId } = await params;
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  if (!isUuid(squadId) || !isUuid(playerId)) notFound();

  // The roster answers with a record id only for someone who may read it;
  // an administrator gets null there, and this page is not-found for them.
  const row = (await db.query(
    `select r.record_id, fn_age_band(p.dob) as band
     from fn_squad_roster($1, $2) r join person p on p.id = r.player_id
     where r.player_id = $3 and r.record_id is not null`,
    [me, squadId, playerId],
  )).rows[0] as { record_id: string; band: string } | undefined;
  if (!row) notFound();
  const recordId = row.record_id;

  let cv: CvData | null;
  if (row.band === 'u16') {
    const v = await db.query(`select content from profile_version where record_id = $1 and status = 'approved'`, [recordId]);
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

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', background: T.bg }}>
        <div className="reading" style={{ width: '100%', padding: '14px 18px 0 18px', boxSizing: 'border-box' }}>
          <a href={`/club/squads/${squadId}`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, gap: 6, textDecoration: 'none', color: T.muted, fontSize: 13, fontWeight: 700 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 5 L8 12 L15 19" /></svg>
            The squad
          </a>
        </div>
      </div>
      <PlayerCV p={cv} />
    </>
  );
}
