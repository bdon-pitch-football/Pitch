'use server';
// Coach CV editing (D-75). The profile publishes without WWCC — verification
// is what unlocks anything to do with players, and it is free on every tier.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';

export async function saveCoachProfile(formData: FormData) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const region = String(formData.get('region') ?? '').trim();
  const philosophy = String(formData.get('philosophy') ?? '').trim();
  const badges = String(formData.get('badges') ?? '').split('|').map((b) => b.trim()).filter(Boolean);
  await db.query(
    `insert into coach_profile (person_id, region, philosophy, badges)
     values ($1,$2,$3,$4)
     on conflict (person_id) do update set region=$2, philosophy=$3, badges=$4`,
    [me, region || null, philosophy || null, badges],
  );
  redirect('/coach/edit?saved=1');
}

export async function addRole(formData: FormData) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const title = String(formData.get('title') ?? '').trim();
  const org = String(formData.get('org') ?? '').trim();
  const from = String(formData.get('from') ?? '').trim();
  const to = String(formData.get('to') ?? '').trim();
  if (title && org) {
    await db.query(
      `insert into coach_role (coach_profile_id, title, org_name, started_year, ended_year, sort)
       select cp.id, $2, $3, $4, $5, coalesce((select max(sort)+1 from coach_role where coach_profile_id = cp.id), 0)
       from coach_profile cp where cp.person_id = $1`,
      [me, title, org, from || null, to || null],
    );
  }
  redirect('/coach/edit');
}

export async function removeRole(roleId: string) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  await db.query(
    `delete from coach_role cr using coach_profile cp
     where cr.id = $1 and cr.coach_profile_id = cp.id and cp.person_id = $2`,
    [roleId, me],
  );
  redirect('/coach/edit');
}
