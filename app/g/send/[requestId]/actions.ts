'use server';
// Guardian dispatch (D-99): a fresh token is minted for the send, the
// request is stamped, the consent log carries it. No email leaves yet —
// the Resend wiring sends doc 15's message when it lands; in development
// the link is surfaced for the guardian to pass on however they choose.
// Doing nothing remains a complete answer: an unsent request just sits,
// and nothing chases anyone (D-138).
import { redirect } from 'next/navigation';
import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';

export async function dispatchSend(requestId: string) {
  const guardianId = await getSessionPersonId();
  if (!guardianId) redirect('/signin');

  const raw = randomBytes(24).toString('base64url');
  const client = await db.connect();
  try {
    await client.query('begin');
    const req = await client.query(
      `select sr.id, sr.record_id, dr.person_id
       from share_request sr
       join development_record dr on dr.id = sr.record_id
       join guardianship_link g on g.child_id = dr.person_id and g.guardian_id = $2
         and g.approved_at is not null and g.revoked_at is null
       where sr.id = $1 and sr.dispatched_at is null
       for update of sr`,
      [requestId, guardianId],
    );
    if (req.rows.length === 0) {
      await client.query('rollback');
      redirect('/home'); // not yours / already sent / never existed — one answer
    }
    const r = req.rows[0];
    const tok = await client.query(
      `insert into share_token (record_id, token_hash, token_hint, issued_by, expires_at)
       values ($1,$2,$3,$4, now() + interval '90 days') returning id`,
      [r.record_id, createHash('sha256').update(raw).digest(), `${raw.slice(0, 4)}·${raw.slice(-4)}`, guardianId],
    );
    await client.query(
      `update share_request set dispatched_by=$2, dispatched_at=now(), share_token_id=$3 where id=$1`,
      [requestId, guardianId, tok.rows[0].id],
    );
    await client.query(
      `insert into consent_event (event, actor_id, subject_id, detail)
       values ('share_dispatched', $1, $2, jsonb_build_object('request_id', $3::uuid))`,
      [guardianId, r.person_id, requestId],
    );
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  redirect(`/g/send/${requestId}?sent=1&link=${raw}`);
}
