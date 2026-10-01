'use server';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { saveCvDraft } from '@/lib/cv-build';
import { STAT_KEYS, STAT_SETS, positionGroup, type StatKey } from '@/lib/football';
import { requireRecordAuthor } from '@/lib/record-guard';

//
// Ids come from the FORM, not from bind(). A bound server action renders
// $ACTION_REF_n plus encrypted arguments only the client runtime resolves,
// so it 500s without JavaScript instead of degrading. Every id below was
// already re-checked server-side — bind() never made one trustworthy.
export async function saveDraft(formData: FormData) {
  const recordId = String(formData.get('recordId') ?? '');
  // Never trust the record id in the URL (D-94 §3). Who may write it is the
  // database's answer: the owner, or an under-16's guardian (N-10, 0169).
  const author = await requireRecordAuthor(recordId);
  const positions = String(formData.get('positions') ?? '').split(',').filter(Boolean);
  const chosenStats = formData.get('surfaced') === null ? null : String(formData.get('surfaced'));
  const stats: Partial<Record<StatKey, number | null>> = {};
  for (const k of STAT_KEYS) {
    const raw = String(formData.get(`stat_${k}`) ?? '').trim();
    const n = Math.max(0, parseInt(raw, 10) || 0);
    // A typed 0 is absence, not a value (D-70 as generalised by D-162): the
    // row is removed rather than stored, so nothing can print the digit back
    // into the form or count a keeper with no clean sheets as having stats.
    // Every page already omitted it; what is left is that it stops existing.
    stats[k] = raw === '' || n === 0 ? null : n;
  }
  await saveCvDraft(recordId, {
    positions,
    squadNumber: formData.get('squadNumber') ? Number(formData.get('squadNumber')) : null,
    foot: (formData.get('foot') as 'Left' | 'Right') || null,
    about: String(formData.get('about') ?? ''),
    // D-105: the form posts `surfaced` once the player has chosen. When it is
    // ABSENT they have not, so the default is the position set — worked out
    // here from the positions being saved in this same request, because a
    // record is created with no positions and the form has to be able to save
    // a first choice of position and the default that belongs to it at once.
    // With no JavaScript there is no other moment at which that could happen.
    surfacedStats: (chosenStats === null
      ? [...STAT_SETS[positionGroup(positions)]]
      : chosenStats.split(',').filter(Boolean)) as StatKey[],
    stats,
    season: '2026',
  }, author);
  // A page with all six of its parts gets the moment rather than the same
  // form again — once. Coming back to edit a finished page saves quietly.
  const { rows } = await db.query(
    `select (p.photo_path is not null) as has_photo, cardinality(dr.positions) > 0 as has_positions,
       dr.squad_number is not null as has_number,
       (dr.about is not null and length(btrim(dr.about)) > 0) as has_about,
       exists(select 1 from player_stat ps where ps.record_id = dr.id and ps.value is not null) as has_stats,
       exists(select 1 from highlight h where h.record_id = dr.id) as has_clips
     from development_record dr join person p on p.id = dr.person_id where dr.id = $1`,
    [recordId],
  );
  const r = rows[0];
  const complete = r && r.has_photo && r.has_positions && r.has_number && r.has_about && r.has_stats && r.has_clips;
  redirect(complete ? `/build/${recordId}/ready` : `/build/${recordId}?saved=1`);
}
