// Build your CV — BuildProfile.dc.html (copy verbatim; positions as
// tap-to-select chips; ChooseStats/Highlights screens follow). Dev-gated
// until sessions exist: in production this route requires auth.
import { notFound } from 'next/navigation';
import { PlayerFrame } from '@/components/player-shell';
import { db } from '@/lib/db';
import { imageSrc } from '@/lib/storage';
import BuildForm from './BuildForm';
import { requireRecordAuthor } from '@/lib/record-guard';
import SquadCard from '@/components/SquadCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Build your CV', robots: { index: false, follow: false } };

export default async function Build({ params, searchParams }: { params: Promise<{ recordId: string }>; searchParams: Promise<{ saved?: string; squad?: string; photo?: string }> }) {
  const { recordId } = await params;
  const { personId: actor, actor: author } = await requireRecordAuthor(recordId);
  const { saved, squad, photo } = await searchParams;
  const { rows } = await db.query(
    `select dr.id, dr.person_id, p.first_name, coalesce(p.last_name,'') as last_name, p.photo_path, dr.positions, dr.squad_number, dr.foot,
            coalesce(dr.about,'') as about, dr.surfaced_stats,
            (select coalesce(json_object_agg(stat_key, value), '{}'::json) from player_stat
              where record_id = dr.id and season='2026' and source_experience_id is null) as stats,
            exists(select 1 from profile_version where record_id = dr.id and status='pending') as has_pending,
            (select count(*)::int from highlight h where h.record_id = dr.id) as clips
     from development_record dr join person p on p.id = dr.person_id where dr.id = $1`,
    [recordId],
  );
  if (rows.length === 0) notFound();
  // The photo as an address for this read, after the actor check above
  // (John's ruling §1): an under-18's is private.
  rows[0].photo_path = await imageSrc(rows[0].photo_path);
  return (
    <PlayerFrame active="cv">
      {/* ONE child for the shell. Two made it lay them side by side, and on a
          390px phone the first screen a new player ever sees started 54px off
          the left edge (GTM's report, 21 Sep). The shell now stacks below the
          console width as well — belt and braces, because the next page to
          add a second block would have done the same thing. */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* "Your parent will see this change" is the child's to read, never the
            guardian's: since "parent's change only" (2 Oct) a guardian's save
            has gone out even while the child's change waits (safety review
            S-1), so they get the plain "Saved.". */}
        <BuildForm record={JSON.parse(JSON.stringify(rows[0]))} saved={saved === '1'} photoBad={photo === 'bad'} child={author === 'self'}>
          {/* Where they play (0052): a club on a CV is a confirmed membership,
              and this is the only place a family can start one. Last in the
              column, under Save (spec C, the 390 order). */}
          <SquadCard personId={rows[0].person_id as string} firstName={rows[0].first_name as string}
            back={`/build/${recordId}`} mine={actor === rows[0].person_id} said={squad} />
        </BuildForm>
      </div>
    </PlayerFrame>
  );
}
