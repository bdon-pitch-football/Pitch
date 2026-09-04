'use server';
// Post a trial (D-74/D-90 source='club'): goes on the club page and the
// trials board the same minute; comes down by itself the day after.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';

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

  await db.query(
    `insert into trial_notice (club_id, title, trial_on, time_venue, position_needs, how_to_register, cv_email, source)
     values ($1,$2,$3,$4,$5,$6,$7,'club')`,
    [club.rows[0].id, title, trialOn, timeVenue,
     f('positions').split(',').filter(Boolean), f('how') || null, f('cv_email') || null],
  );
  redirect('/club/post-trial?posted=1');
}
