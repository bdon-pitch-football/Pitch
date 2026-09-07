'use server';
// Coaching roles a club is hiring for (0019). Posting one is club
// administration, so club_admin and technical_director both may — the same
// split as squads (D-93). A coach cannot post a role at their own club.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';

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

export async function postRole(formData: FormData) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const clubId = await clubIManage(me);
  if (!clubId) redirect('/home');

  const title = String(formData.get('title') ?? '').trim().slice(0, 80);
  const ageGroup = String(formData.get('ageGroup') ?? '').trim();
  const detail = String(formData.get('detail') ?? '').trim().slice(0, 1500);
  const commitment = String(formData.get('commitment') ?? '').trim().slice(0, 120);
  const paid = formData.get('paid') === 'on';
  const closesOn = String(formData.get('closesOn') ?? '').trim();

  // Validate the age group against the lookup rather than trusting the form.
  const ageOk = ageGroup
    ? (await db.query(`select 1 from age_group where code = $1`, [ageGroup])).rows.length > 0
    : true;
  if (!title || !ageOk) redirect('/club/roles?error=1');

  await db.query(
    `insert into coaching_role (club_id, title, age_group, detail, commitment, paid, closes_on, posted_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [clubId, title, ageGroup || null, detail || null, commitment || null, paid, closesOn || null, me],
  );
  redirect('/club/roles?saved=1');
}

export async function closeRole(roleId: string) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const clubId = await clubIManage(me);
  if (!clubId) redirect('/home');
  // Closed, never deleted: the coaches who applied did a real thing and the
  // club should still be able to see who they were.
  await db.query(`update coaching_role set closed_at = now() where id = $1 and club_id = $2`, [roleId, clubId]);
  redirect('/club/roles?closed=1');
}
