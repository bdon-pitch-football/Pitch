'use server';
// Post a trial (D-74/D-90 source='club'): goes on the club page and the
// trials board the same minute; comes down by itself the day after.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { POSITIONS } from '@/lib/football';

export async function postTrial(formData: FormData) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const club = await db.query(
    `select c.id from club c join membership m on m.club_id = c.id and m.person_id = $1
       and m.role in ('technical_director','club_admin') and m.ended_at is null
     where c.club_state = 'verified' limit 1`,
    [me],
  );
  if (club.rows.length === 0) redirect('/home');

  const f = (k: string) => String(formData.get(k) ?? '').trim();
  const title = f('title');
  const trialOn = f('trial_on');
  const timeVenue = [f('time'), f('ground')].filter(Boolean).join(' · ');
  if (!title || !trialOn || !timeVenue) redirect('/club/post-trial?error=1');

  // D-68 as amended 16 Sep. Every value is checked against its closed list
  // rather than taken as sent (D-94 §6): age groups against the lookup
  // (D-73), gender against the four, positions against the ten (D-92).
  const asked = [...new Set(formData.getAll('ages').map((v) => String(v)))];
  const ages = asked.length
    ? (await db.query(`select code from age_group where code = any($1::text[])`, [asked])).rows.map((r) => r.code as string)
    : [];
  if (ages.length === 0) redirect('/club/post-trial?error=ages');
  const gender = ['boys', 'girls', 'men', 'women'].includes(f('gender')) ? f('gender') : null;
  const positions = [...new Set(formData.getAll('positions').map((v) => String(v).trim().toUpperCase()))]
    .filter((code) => code in POSITIONS);

  // One statement, so a notice never exists without the age groups that make
  // it findable.
  await db.query(
    `with t as (
       insert into trial_notice (club_id, title, trial_on, time_venue, position_needs, competition_gender, how_to_register, cv_email, source)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'club') returning id)
     insert into trial_notice_age_group (trial_notice_id, age_group)
     select t.id, a from t, unnest($9::text[]) as a`,
    [club.rows[0].id, title, trialOn, timeVenue, positions, gender,
     f('how') || null, f('cv_email') || null, ages],
  );
  redirect('/club/post-trial?posted=1');
}
