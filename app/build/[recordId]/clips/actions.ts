'use server';
// Highlights (D-88, D-120): ten free under 18, three on adult free — the
// generous tier is the child's, deliberately. added_as_minor is derived
// server-side from DOB at insert and grandfathers the clip permanently.
// Only YouTube/Instagram/Veo hosts are accepted (D-97's allowlist).
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { CLIP_LIMIT_ADULT_FREE, CLIP_LIMIT_UNDER_18 } from '@/lib/football';
import { requireRecordActor } from '@/lib/record-guard';

const HOSTS = /^(https:\/\/)(www\.)?(youtube\.com|youtu\.be|instagram\.com|veo\.co|app\.veo\.co)\//i;

export async function addClip(recordId: string, formData: FormData) {
  // Never trust the record id in the URL (D-94 §3).
  await requireRecordActor(recordId);
  const url = String(formData.get('url') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  if (!HOSTS.test(url) || !title) redirect(`/build/${recordId}/clips?error=1`);

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
    await client.query(
      `insert into highlight (record_id, url, title, added_as_minor) values ($1,$2,$3,$4)`,
      [recordId, url, title, band !== '18plus'],
    );
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  redirect(`/build/${recordId}/clips`);
}

export async function removeClip(recordId: string, clipId: string) {
  // Never trust the record id in the URL (D-94 §3).
  await requireRecordActor(recordId);
  await db.query(`delete from highlight where id = $1 and record_id = $2`, [clipId, recordId]);
  redirect(`/build/${recordId}/clips`);
}
