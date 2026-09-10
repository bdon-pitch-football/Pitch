// Build your CV — BuildProfile.dc.html (copy verbatim; positions as
// tap-to-select chips; ChooseStats/Highlights screens follow). Dev-gated
// until sessions exist: in production this route requires auth.
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import BuildForm from './BuildForm';
import { requireRecordActor } from '@/lib/record-guard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Build your CV', robots: { index: false, follow: false } };

export default async function Build({ params, searchParams }: { params: Promise<{ recordId: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { recordId } = await params;
  await requireRecordActor(recordId);
  const { saved } = await searchParams;
  const { rows } = await db.query(
    `select dr.id, p.first_name, coalesce(p.last_name,'') as last_name, p.photo_path, dr.positions, dr.squad_number, dr.foot,
            coalesce(dr.about,'') as about, dr.surfaced_stats,
            (select coalesce(json_object_agg(stat_key, value), '{}'::json) from player_stat
              where record_id = dr.id and season='2026' and source_experience_id is null) as stats,
            exists(select 1 from profile_version where record_id = dr.id and status='pending') as has_pending
     from development_record dr join person p on p.id = dr.person_id where dr.id = $1`,
    [recordId],
  );
  if (rows.length === 0) notFound();
  return <BuildForm record={JSON.parse(JSON.stringify(rows[0]))} saved={saved === '1'} />;
}
