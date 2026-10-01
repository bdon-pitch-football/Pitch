'use server';
// Post a trial (D-74/D-90 source='club'): goes on the club page and the
// trials board the same minute; comes down by itself the day after.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { POSITIONS } from '@/lib/football';
import { isUuid } from '@/lib/ids';

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
  if (!title || !trialOn || !timeVenue) redirect(`/club/post-trial?error=1${f('trial_id') ? `&edit=${encodeURIComponent(f('trial_id'))}` : ''}`);

  // D-68 as amended 16 Sep. Every value is checked against its closed list
  // rather than taken as sent (D-94 §6): age groups against the lookup
  // (D-73), gender against the four, positions against the ten (D-92).
  const asked = [...new Set(formData.getAll('ages').map((v) => String(v)))];
  const ages = asked.length
    ? (await db.query(`select code from age_group where code = any($1::text[])`, [asked])).rows.map((r) => r.code as string)
    : [];
  if (ages.length === 0) redirect(`/club/post-trial?error=ages${f('trial_id') ? `&edit=${encodeURIComponent(f('trial_id'))}` : ''}`);
  const gender = ['boys', 'girls', 'men', 'women'].includes(f('gender')) ? f('gender') : null;
  const positions = [...new Set(formData.getAll('positions').map((v) => String(v).trim().toUpperCase()))]
    .filter((code) => code in POSITIONS);

  // "Change it once" (the launch walkthrough): a club edits its OWN posted
  // trial — never one Pitch compiled (D-90). Once anybody has registered
  // interest for it, the date is fixed here: moving it would leave families
  // holding the day they signed up for. The last-checked stamp moves (D-74).
  const trialId = f('trial_id');
  if (trialId) {
    if (!isUuid(trialId)) redirect('/club/post-trial');
    const own = (await db.query(
      `select t.id, to_char(t.trial_on, 'YYYY-MM-DD') as trial_on,
         exists(select 1 from registration r where r.trial_notice_id = t.id and r.withdrawn_at is null) as registered
       from trial_notice t where t.id = $1 and t.club_id = $2 and t.source = 'club'`,
      [trialId, club.rows[0].id],
    )).rows[0];
    if (!own) redirect('/club/post-trial');
    const client = await db.connect();
    try {
      await client.query('begin');
      await client.query(
        `update trial_notice set title = $2, trial_on = $3, time_venue = $4, position_needs = $5,
           competition_gender = $6, how_to_register = $7, cv_email = $8,
           last_checked = (now() at time zone 'Australia/Melbourne')::date
         where id = $1`,
        [trialId, title, own.registered ? own.trial_on : trialOn, timeVenue, positions, gender,
         f('how') || null, f('cv_email') || null],
      );
      await client.query(`delete from trial_notice_age_group where trial_notice_id = $1`, [trialId]);
      await client.query(
        `insert into trial_notice_age_group (trial_notice_id, age_group) select $1, a from unnest($2::text[]) as a`,
        [trialId, ages],
      );
      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
    redirect('/club/post-trial?updated=1');
  }

  // One statement, so a notice never exists without the age groups that make
  // it findable.
  const made = await db.query(
    `with t as (
       insert into trial_notice (club_id, title, trial_on, time_venue, position_needs, competition_gender, how_to_register, cv_email, source)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'club') returning id)
     insert into trial_notice_age_group (trial_notice_id, age_group)
     select t.id, a from t, unnest($9::text[]) as a
     returning trial_notice_id`,
    [club.rows[0].id, title, trialOn, timeVenue, positions, gender,
     f('how') || null, f('cv_email') || null, ages],
  );
  // P3 (BUZ, 1 Oct): the confirmation draws the notice as the board will, so
  // it names which notice. The page reads it back only if it is this club's
  // own, advertised notice — the id is a pointer, never an authority.
  redirect(`/club/post-trial?posted=1&trial=${made.rows[0].trial_notice_id}`);
}
