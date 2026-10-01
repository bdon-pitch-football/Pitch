'use server';
// Highlights (D-88, D-120): ten free under 18, three on adult free — the
// generous tier is the child's, deliberately. added_as_minor is derived
// server-side from DOB at insert and grandfathers the clip permanently.
// Only YouTube/Instagram/Veo hosts are accepted (D-97's allowlist).
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { CLIP_LIMIT_ADULT_FREE, CLIP_LIMIT_UNDER_18 } from '@/lib/football';
import { ITEM_SQL, publishGuardianChange } from '@/lib/cv-build';
import { requireRecordAuthor } from '@/lib/record-guard';

const HOSTS = /^(https:\/\/)(www\.)?(youtube\.com|youtu\.be|instagram\.com|veo\.co|app\.veo\.co)\//i;

//
// Ids come from the FORM, not from bind(). A bound server action renders
// $ACTION_REF_n plus encrypted arguments only the client runtime resolves,
// so it 500s without JavaScript instead of degrading. Every id below was
// already re-checked server-side — bind() never made one trustworthy.
export async function addClip(formData: FormData) {
  const recordId = String(formData.get('recordId') ?? '');
  // Never trust the record id in the URL (D-94 §3).
  const { personId, actor } = await requireRecordAuthor(recordId);
  const url = String(formData.get('url') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  if (!HOSTS.test(url) || !title) redirect(`/build/${recordId}/clips?error=1`);

  let item: Record<string, unknown> | undefined;
  const client = await db.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `select fn_age_band(p.dob) as band,
              (select count(*)::int from highlight where record_id = $1) as used
       from development_record dr join person p on p.id = dr.person_id where dr.id = $1 for update`,
      [recordId],
    );
    const band = rows[0].band as string;
    const cap = band === '18plus' ? CLIP_LIMIT_ADULT_FREE : CLIP_LIMIT_UNDER_18;
    if (rows[0].used >= cap) {
      await client.query('rollback');
      redirect(`/build/${recordId}/clips?full=1`);
    }
    item = (await client.query(
      `insert into highlight (record_id, url, title, added_as_minor) values ($1,$2,$3,$4)
       returning ${ITEM_SQL.highlights} as item`,
      [recordId, url, title, band !== '18plus'],
    )).rows[0]?.item;
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  // F14: a guardian's own change to an under-16's page is its own approval —
  // this one clip, and no clip of the child's (parent's change only, 2 Oct).
  if (actor === 'guardian' && item) await publishGuardianChange(recordId, personId, { add: { list: 'highlights', item } });
  redirect(`/build/${recordId}/clips`);
}

export async function removeClip(formData: FormData) {
  const recordId = String(formData.get('recordId') ?? '');
  const clipId = String(formData.get('clipId') ?? '');
  // Never trust the record id in the URL (D-94 §3).
  const { personId, actor } = await requireRecordAuthor(recordId);
  // A guardian's removal reaches clubs at once, even while a change of the
  // child's waits (S-2; John, 2 Oct).
  const gone = await db.query(`delete from highlight where id = $1 and record_id = $2 returning ${ITEM_SQL.highlights} as item`, [clipId, recordId]);
  if (actor === 'guardian' && gone.rows[0]) await publishGuardianChange(recordId, personId, { remove: { list: 'highlights', item: gone.rows[0].item } });
  redirect(`/build/${recordId}/clips`);
}
