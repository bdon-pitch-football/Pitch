'use server';
// "Send my CV" (D-99): never automated, never batched, never an attachment.
// u16: the child composes; the request routes to the guardian, who checks
// the address and presses send. The club address is typed from the club's
// own notice — hostile free text, validated as an email shape only.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { sendWaitingEmail } from '@/lib/messages';
import { send } from '@/lib/messaging';
import { requireRecordActor } from '@/lib/record-guard';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function composeSend(recordId: string, formData: FormData) {
  // Never trust the record id in the URL (D-94 §3).
  await requireRecordActor(recordId);
  const clubName = String(formData.get('clubName') ?? '').trim();
  const address = String(formData.get('address') ?? '').trim();
  if (!clubName || !EMAIL_RE.test(address)) redirect(`/send/${recordId}?error=1`);

  const client = await db.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `insert into share_request (record_id, requested_by, destination)
       select dr.id, dr.person_id, $2 from development_record dr where dr.id = $1
       returning id`,
      [recordId, `${clubName} <${address}>`],
    );
    await client.query(
      `insert into consent_event (event, subject_id, detail)
       select 'share_request_created', dr.person_id, jsonb_build_object('request_id', $2::uuid)
       from development_record dr where dr.id = $1`,
      [recordId, rows[0].id],
    );
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }

  // doc 15 §20: email only — an SMS manufactures pressure around a decision
  // deliberately designed to be pressure-free. The address is printed in full.
  const g = await db.query(
    `select p2.email, c.first_name from development_record dr
     join person c on c.id = dr.person_id
     join guardianship_link gl on gl.child_id = c.id and gl.approved_at is not null and gl.revoked_at is null
     join person p2 on p2.id = gl.guardian_id
     where dr.id = $1 and p2.email is not null limit 1`,
    [recordId],
  );
  if (g.rows[0]) {
    const rid = (await db.query(
      `select id from share_request where record_id = $1 and dispatched_at is null order by created_at desc limit 1`,
      [recordId],
    )).rows[0]?.id;
    if (rid) await send(sendWaitingEmail(g.rows[0].first_name, clubName, address, rid), { address: g.rows[0].email });
  }
  redirect(`/send/${recordId}?asked=1`);
}
