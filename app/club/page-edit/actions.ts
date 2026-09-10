'use server';
// Club video. A LINK, never a file — the video stays on YouTube or Veo and
// the public page renders a click-to-play façade (D-97). The host allowlist
// is the same one the player clips use; anything else is refused rather than
// coerced (D-94 §6).
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';

const HOSTS = /^(https:\/\/)(www\.)?(youtube\.com|youtu\.be|instagram\.com|veo\.co|app\.veo\.co)\//i;

async function clubIManage(personId: string): Promise<string | null> {
  const { rows } = await db.query(
    `select c.id from club c
     join membership m on m.club_id = c.id and m.person_id = $1
       and m.role in ('technical_director','club_admin') and m.ended_at is null
     limit 1`,
    [personId],
  );
  return rows[0]?.id ?? null;
}

export async function addClubVideo(formData: FormData) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const clubId = await clubIManage(me);
  if (!clubId) redirect('/home');

  const url = String(formData.get('url') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim().slice(0, 80);
  if (!title || !HOSTS.test(url) || url.length > 400) redirect('/club/page-edit?video=bad');

  const { rows } = await db.query(`select coalesce(max(sort), -1) + 1 as next from club_video where club_id = $1`, [clubId]);
  await db.query(
    `insert into club_video (club_id, url, title, sort, added_by) values ($1,$2,$3,$4,$5)`,
    [clubId, url, title, rows[0].next, me],
  );
  redirect('/club/page-edit?saved=video');
}

//
// Ids come from the FORM, not from bind(). A bound server action renders
// $ACTION_REF_n plus encrypted arguments only the client runtime resolves,
// so it 500s without JavaScript instead of degrading. Every id below was
// already re-checked server-side — bind() never made one trustworthy.
export async function removeClubVideo(formData: FormData) {
  const videoId = String(formData.get('videoId') ?? '');
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const clubId = await clubIManage(me);
  if (!clubId) redirect('/home');
  await db.query(`delete from club_video where id = $1 and club_id = $2`, [videoId, clubId]);
  redirect('/club/page-edit?removed=video');
}
