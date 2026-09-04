'use server';
// Server actions for the child sign-up door (D-17). Validation is
// server-side; the client is never trusted for age or identity.
import { redirect } from 'next/navigation';
import { createPendingInvitation } from '@/lib/guardian-flow';

const AU_MOBILE = /^04\d{2}\s?\d{3}\s?\d{3}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function startPendingInvitation(formData: FormData) {
  const firstName = String(formData.get('firstName') ?? '').trim();
  const dob = String(formData.get('dob') ?? '').trim();
  const guardianName = String(formData.get('guardianName') ?? '').trim();
  const guardianPhone = String(formData.get('guardianPhone') ?? '').trim();
  const guardianEmail = String(formData.get('guardianEmail') ?? '').trim();

  if (!firstName || !dob || !guardianName || !AU_MOBILE.test(guardianPhone)) {
    redirect('/join?error=1');
  }
  const { id } = await createPendingInvitation({
    firstName,
    dob,
    guardianName,
    guardianPhone,
    guardianEmail: guardianEmail || undefined,
  });
  redirect(`/join/waiting/${id}`);
}


// 16–17 and 18+ branches (D-96, D-49). A fresh 16–17 signup without a
// guardian contact is incomplete, not merely unverified — the off-switch
// and routed contact are unbuildable without one. Adults walk straight in.
// Both accept the ToS themselves (logged, version-stamped).
export async function createAccount(formData: FormData) {
  const { db } = await import('@/lib/db');
  const { setSessionPersonId } = await import('@/lib/session');
  const firstName = String(formData.get('firstName') ?? '').trim();
  const dob = String(formData.get('dob') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const guardianName = String(formData.get('guardianName') ?? '').trim();
  const guardianPhone = String(formData.get('guardianPhone') ?? '').trim();
  if (!firstName || !dob || !EMAIL_RE.test(email)) redirect('/join?error=1');

  const client = await db.connect();
  let personId: string;
  try {
    await client.query('begin');
    const band = (await client.query('select fn_age_band($1::date) as b', [dob])).rows[0].b as string;
    if (band === 'u16') { await client.query('rollback'); redirect('/join'); }
    if (band === '16_17' && (!guardianName || !AU_MOBILE.test(guardianPhone))) {
      await client.query('rollback'); redirect('/join?error=1');
    }
    const person = await client.query(
      `insert into person (first_name, dob, dob_locked, email) values ($1,$2,true,$3)
       on conflict (email) do update set first_name = person.first_name returning id`,
      [firstName, dob, email],
    );
    personId = person.rows[0].id;
    await client.query(`insert into development_record (person_id) values ($1) on conflict (person_id) do nothing`, [personId]);
    if (band === '16_17') {
      const g = await client.query(
        `insert into person (first_name, last_name) values ($1,$2) returning id`,
        [guardianName.split(' ')[0], guardianName.split(' ').slice(1).join(' ') || null],
      );
      await client.query(
        `insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now()) on conflict do nothing`,
        [g.rows[0].id, personId],
      );
    }
    await client.query(
      `insert into consent_event (event, actor_id, subject_id, policy_version, detail)
       values ('tos_accepted',$1,$1,'22@v1.7','{}'), ('policy_accepted',$1,$1,'20@v2.4','{}')`,
      [personId],
    );
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  await setSessionPersonId(personId);
  redirect('/home');
}