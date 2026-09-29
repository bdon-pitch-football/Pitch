'use server';
// Coaching roles a club is hiring for (0019). Posting one is club
// administration, so club_admin and technical_director both may — the same
// split as squads (D-93). A coach cannot post a role at their own club.
//
// This screen also carries the club administrator's door for ending the
// Technical Director's access (0100, D-48): see endTdAccess at the foot.
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

//
// Ids come from the FORM, not from bind(). A bound server action renders
// $ACTION_REF_n plus encrypted arguments only the client runtime resolves,
// so it 500s without JavaScript instead of degrading. Every id below was
// already re-checked server-side — bind() never made one trustworthy.
export async function closeRole(formData: FormData) {
  const roleId = String(formData.get('roleId') ?? '');
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const clubId = await clubIManage(me);
  if (!clubId) redirect('/home');
  // Closed, never deleted: the coaches who applied did a real thing and the
  // club should still be able to see who they were.
  await db.query(`update coaching_role set closed_at = now() where id = $1 and club_id = $2`, [roleId, clubId]);
  redirect('/club/roles?closed=1');
}

// Ending the club's Technical Director's access (D-48, D-93; 0100). D-93
// gives memberships to the administrator, so this is the administrator's
// door; Pitch's operator has the other, on the call sheet. The club is the
// one the session administers, never an id off the form, and the database
// decides both halves: fn_may_end_td (asked first, so a TD, a coach or a
// stranger pressing this lands back on the page having changed nothing) and
// fn_end_td, which asks the same question again, requires the reason, ends
// the role and writes the audit row. What the TD wrote is not touched.
// Naming a new TD is not here and cannot be: that is the verification call.
export async function endTdAccess(formData: FormData) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const clubId = await clubIManage(me);
  if (!clubId) redirect('/home');
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 500);
  const may = (await db.query('select fn_may_end_td($1, $2) as m', [me, clubId])).rows[0]?.m === true;
  if (!may || reason.length < 3) redirect('/club/roles');
  const ended = (await db.query('select fn_end_td($1, $2, $3) as p', [me, clubId, reason])).rows[0]?.p;
  redirect(ended ? '/club/roles?ended=1' : '/club/roles');
}
