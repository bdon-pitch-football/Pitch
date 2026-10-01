// "N of 6 done" on the builder's three steps (C-P2, BUZ 1 Oct): the same six
// real fields the first step counts as the family types (BuildForm), read
// once for the two steps that do not edit them. Nothing here is a score.
// Behind requireRecordActor on every page that calls it, like the rest of
// the builder's own reads.
import 'server-only';
import { db } from './db';

export async function buildProgress(recordId: string): Promise<{ done: number; total: number }> {
  const { rows } = await db.query(
    `select (p.photo_path is not null) as photo,
       coalesce(cardinality(dr.positions), 0) > 0 as positions,
       (dr.squad_number is not null) as num,
       (dr.about is not null and length(btrim(dr.about)) > 0) as about,
       exists(select 1 from player_stat ps where ps.record_id = dr.id and ps.season = '2026'
              and ps.source_experience_id is null and ps.value is not null and ps.value <> 0) as stats,
       exists(select 1 from highlight h where h.record_id = dr.id) as clips
     from development_record dr join person p on p.id = dr.person_id where dr.id = $1`,
    [recordId],
  );
  const r = rows[0] ?? {};
  const steps = [r.photo, r.positions, r.num, r.about, r.stats, r.clips];
  return { done: steps.filter(Boolean).length, total: steps.length };
}
