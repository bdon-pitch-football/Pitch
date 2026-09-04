'use server';
// Guardian dispatch of a register-interest request: creates the registration
// (disclosed_by = guardian) and stamps the request, one transaction. Doing
// nothing lets the request disappear by itself (D-138).
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';

export async function dispatchInterest(requestId: string) {
  const guardianId = await getSessionPersonId();
  if (!guardianId) redirect('/signin');

  const client = await db.connect();
  try {
    await client.query('begin');
    const req = await client.query(
      `select rr.id, rr.record_id, rr.club_id, rr.squad_target, rr.positions, rr.note, dr.person_id
       from registration_request rr
       join development_record dr on dr.id = rr.record_id
       join guardianship_link g on g.child_id = dr.person_id and g.guardian_id = $2
         and g.approved_at is not null and g.revoked_at is null
       where rr.id = $1 and rr.dispatched_at is null
       for update of rr`,
      [requestId, guardianId],
    );
    if (req.rows.length === 0) {
      await client.query('rollback');
      redirect('/home'); // not yours / already sent / never existed — one answer
    }
    const r = req.rows[0];
    const reg = await client.query(
      `insert into registration (player_id, club_id, squad_target, positions, note, disclosed_by, policy_version)
       values ($1,$2,$3,$4,$5,$6,'20@v2.4') returning id`,
      [r.person_id, r.club_id, r.squad_target, r.positions, r.note, guardianId],
    );
    await client.query(
      `update registration_request set dispatched_by=$2, dispatched_at=now(), registration_id=$3 where id=$1`,
      [requestId, guardianId, reg.rows[0].id],
    );
    await client.query(
      `insert into consent_event (event, actor_id, subject_id, detail)
       values ('registration_created', $1, $2, jsonb_build_object('request_id', $3::uuid))`,
      [guardianId, r.person_id, requestId],
    );
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  redirect(`/g/interest/${requestId}?sent=1`);
}
