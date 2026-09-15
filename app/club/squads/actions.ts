'use server';
// Squad management. A club decides which age groups it takes registrations
// for — Pitch does not prescribe a competition structure (0017). The register
// then groups by whatever the club actually runs.
//
// Authorisation is the D-93 split: club_admin and technical_director both
// manage squads, because squads are club administration rather than
// development data. A coach cannot, and neither can anyone else.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { isUuid } from '@/lib/ids';

// D-68 as amended 15 Sep: four values, no mixed and no open.
const GENDERS = ['boys', 'girls', 'men', 'women'];

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

export async function addSquad(formData: FormData) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const clubId = await clubIManage(me);
  if (!clubId) redirect('/home');

  const name = String(formData.get('name') ?? '').trim().slice(0, 60);
  const ageGroup = String(formData.get('ageGroup') ?? '').trim();
  const gender = String(formData.get('gender') ?? '').trim();
  const season = String(formData.get('season') ?? '').trim().slice(0, 12);

  // Validate against the lookup rather than trusting the form. The age group
  // arrives from a client and every client-supplied value is hostile
  // (D-94 §3) — an unknown code would create a squad that sorts nowhere.
  const ok = await db.query(`select 1 from age_group where code = $1`, [ageGroup]);
  if (!name || !season || ok.rows.length === 0 || !GENDERS.includes(gender)) {
    redirect('/club/squads?error=1');
  }

  await db.query(
    `insert into squad (club_id, name, age_group, competition_gender, season)
     values ($1,$2,$3,$4,$5)`,
    [clubId, name, ageGroup, gender, season],
  );
  redirect('/club/squads?added=1');
}

//
// Ids come from the FORM, not from bind(). A bound server action renders
// $ACTION_REF_n plus encrypted arguments only the client runtime resolves,
// so it 500s without JavaScript instead of degrading. Every id below was
// already re-checked server-side — bind() never made one trustworthy.
export async function removeSquad(formData: FormData) {
  const squadId = String(formData.get('squadId') ?? '');
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const clubId = await clubIManage(me);
  if (!clubId) redirect('/home');

  // Never delete a squad somebody is standing in. A registration or a
  // membership pointing at it is a family's or a player's record, and
  // removing the squad underneath them would either orphan the row or
  // cascade into something that is not ours to delete.
  const { rows } = await db.query(
    `select
       (select count(*)::int from registration where squad_target = $1 and withdrawn_at is null) as regs,
       (select count(*)::int from membership where squad_id = $1 and ended_at is null) as members`,
    [squadId],
  );
  if (rows[0].regs > 0 || rows[0].members > 0) redirect('/club/squads?inuse=1');

  await db.query(`delete from squad where id = $1 and club_id = $2`, [squadId, clubId]);
  redirect('/club/squads?removed=1');
}

// ---------------------------------------------------------------------------
// D-154: the TD brings a coach in to read the registrations for their teams.
// Only the TD (doc 34, D-154). The coach accepts inside Pitch; nothing is
// sent, because doc 15 carries no such message.
//
// N24: the answer is IDENTICAL whether or not the email belongs to a Pitch
// coach account, so this form can never be used to find out who is on Pitch.
async function clubIRunAsTd(personId: string): Promise<string | null> {
  const { rows } = await db.query(
    `select c.id from club c
     join membership m on m.club_id = c.id and m.person_id = $1
       and m.role = 'technical_director' and m.ended_at is null
     limit 1`,
    [personId],
  );
  return rows[0]?.id ?? null;
}

export async function inviteCoach(formData: FormData) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const clubId = await clubIRunAsTd(me);
  if (!clubId) redirect('/home');

  const email = String(formData.get('email') ?? '').trim().toLowerCase().slice(0, 200);
  const squadIds = [...new Set(formData.getAll('squadIds').map(String).filter(isUuid))];
  const wwcc = formData.get('wwcc') !== null;
  const ours = squadIds.length === 0 ? [] : (await db.query(
    `select id from squad where club_id = $1 and id = any($2::uuid[])`, [clubId, squadIds],
  )).rows;
  if (!email.includes('@') || squadIds.length < 1 || squadIds.length > 3 || ours.length !== squadIds.length || !wwcc) {
    redirect('/club/squads?coachError=1');
  }

  const coach = await db.query(
    `select p.id from person p join coach_profile cp on cp.person_id = p.id
     where lower(p.email) = $1 and fn_age_band(p.dob) = '18plus' and p.id <> $2`,
    [email, me],
  );
  if (coach.rows.length > 0) {
    try {
      await db.query(
        `insert into coach_invite (club_id, person_id, invited_by, squad_ids, wwcc_checked)
         values ($1,$2,$3,$4::uuid[],true)
         on conflict (club_id, person_id) where answered_at is null
         do update set squad_ids = excluded.squad_ids, invited_by = excluded.invited_by, created_at = now()`,
        [clubId, coach.rows[0].id, me, squadIds],
      );
    } catch {
      // Refused at write for any reason: the TD is told exactly what they
      // would have been told otherwise.
    }
  }
  redirect('/club/squads?coachAsked=1');
}

export async function revokeCoach(formData: FormData) {
  const personId = String(formData.get('personId') ?? '');
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const clubId = await clubIRunAsTd(me);
  if (!clubId || !isUuid(personId)) redirect('/home');
  await db.query(
    `update register_grant set revoked_at = now(), revoked_by = $3
     where club_id = $1 and person_id = $2 and revoked_at is null`,
    [clubId, personId, me],
  );
  redirect('/club/squads?coachRemoved=1');
}
