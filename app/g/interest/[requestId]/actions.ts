'use server';
// Guardian dispatch of a register-interest request: creates the registration
// (disclosed_by = guardian) and stamps the request, one transaction. Doing
// nothing lets the request disappear by itself (D-138).
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { legalStamp } from '@/lib/legal-stamp';
import { getSessionPersonId } from '@/lib/session';

//
// FORM FIELDS, NOT bind(). A server action passed straight to
// <form action={fn}> is progressively enhanced — Next renders a plain POST
// with a stable action id and it works with no JavaScript. A BOUND one
// renders $ACTION_REF_n plus encrypted arguments only the client runtime can
// resolve, so without JS it returns a 500 rather than degrading, and it
// cannot be exercised by anything that is not a browser.
//
// Moving the id into the form costs nothing in safety: every one of these
// already re-checks its arguments server-side. bind() never made an argument
// trustworthy — the authorisation below did.
export async function dispatchInterest(formData: FormData) {
  const requestId = String(formData.get('requestId') ?? '');
  const guardianId = await getSessionPersonId();
  if (!guardianId) redirect('/signin');

  const client = await db.connect();
  try {
    await client.query('begin');
    const req = await client.query(
      `select rr.id, rr.record_id, rr.club_id, rr.squad_target, rr.positions, rr.note, dr.person_id,
         rr.trial_notice_id, (select tn.trial_on from trial_notice tn where tn.id = rr.trial_notice_id) as trial_on
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
      // The trial the child registered against travels onto the registration,
      // so the club can invite to it — and on the free tier, invite at all (D-153).
      `insert into registration (player_id, club_id, squad_target, positions, note, trial_notice_id, trial_on, disclosed_by, policy_version)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [r.person_id, r.club_id, r.squad_target, r.positions, r.note, r.trial_notice_id, r.trial_on, guardianId, legalStamp('20')],
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
