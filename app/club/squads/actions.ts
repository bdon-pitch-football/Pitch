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

const GENDERS = ['boys', 'girls', 'mixed', 'open', 'men', 'women'];

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

export async function removeSquad(squadId: string) {
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
