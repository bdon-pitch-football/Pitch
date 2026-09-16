'use server';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { saveCvDraft } from '@/lib/cv-build';
import { STAT_KEYS, type StatKey } from '@/lib/football';
import { requireRecordActor } from '@/lib/record-guard';

//
// Ids come from the FORM, not from bind(). A bound server action renders
// $ACTION_REF_n plus encrypted arguments only the client runtime resolves,
// so it 500s without JavaScript instead of degrading. Every id below was
// already re-checked server-side — bind() never made one trustworthy.
export async function saveDraft(formData: FormData) {
  const recordId = String(formData.get('recordId') ?? '');
  // Never trust the record id in the URL (D-94 §3).
  await requireRecordActor(recordId);
  const positions = String(formData.get('positions') ?? '').split(',').filter(Boolean);
  const stats: Partial<Record<StatKey, number | null>> = {};
  for (const k of STAT_KEYS) {
    const raw = String(formData.get(`stat_${k}`) ?? '').trim();
    stats[k] = raw === '' ? null : Math.max(0, parseInt(raw, 10) || 0);
  }
  await saveCvDraft(recordId, {
    positions,
    squadNumber: formData.get('squadNumber') ? Number(formData.get('squadNumber')) : null,
    foot: (formData.get('foot') as 'Left' | 'Right') || null,
    about: String(formData.get('about') ?? ''),
    surfacedStats: String(formData.get('surfaced') ?? '').split(',').filter(Boolean) as StatKey[],
    stats,
    season: '2026',
  });
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
