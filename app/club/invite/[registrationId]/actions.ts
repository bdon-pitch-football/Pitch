'use server';
// Sending an invitation (D-117): it lands INSIDE Pitch, the only club→family
// route. Creating it also moves the registration to 'invited'. The outbound
// notification, when messaging lands, is a bare wake — no name, no club, no
// message (doc 15 §24); the substance stays here.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { bareWakeEmail, bareWakeSms } from '@/lib/messages';
import { send } from '@/lib/messaging';

export async function sendInvitation(registrationId: string, formData: FormData) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const body = String(formData.get('body') ?? '').trim().slice(0, 400);
  const kind = String(formData.get('kind') ?? 'trial');

  const client = await db.connect();
  try {
    await client.query('begin');
    const reg = await client.query(
      `select r.id, r.club_id, r.player_id from registration r
       where r.id = $1 and r.withdrawn_at is null
         and fn_can_work_register($2, r.club_id)
         and exists (select 1 from club c where c.id = r.club_id and c.club_state = 'verified')
         and fn_register_active(r.club_id)
       for update`,
      [registrationId, me],
    );
    if (reg.rows.length === 0) {
      await client.query('rollback');
      redirect('/club/register');
    }
    const r = reg.rows[0];
    await client.query(
      `insert into invitation (club_id, registration_id, body) values ($1,$2,$3)`,
      [r.club_id, registrationId, JSON.stringify({ kind, note: body })],
    );
    await client.query(`select fn_set_club_status($1, $2, 'invited')`, [me, registrationId]);
    await client.query(
      `insert into consent_event (event, actor_id, subject_id, detail)
       values ('invitation_created', $1, $2, jsonb_build_object('registration_id', $3::uuid))`,
      [me, r.player_id, registrationId],
    );
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }

  // doc 15 §24: a BARE WAKE. No child's name, no club name, no message, no
  // hint of what it is about — a phone face-up on a bench shows nothing.
  const g = await db.query(
    `select p2.email from registration r
     join person c on c.id = r.player_id
     join guardianship_link gl on gl.child_id = c.id and gl.approved_at is not null and gl.revoked_at is null
     join person p2 on p2.id = gl.guardian_id
     where r.id = $1 and p2.email is not null limit 1`,
    [registrationId],
  );
  if (g.rows[0]) await send(bareWakeEmail(), { address: g.rows[0].email });
  void bareWakeSms; // SMS half sends once the sender ID is registered (D-81)
  redirect('/club/register');
}
