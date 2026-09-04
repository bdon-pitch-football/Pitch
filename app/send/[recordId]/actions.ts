'use server';
// "Send my CV" (D-99): never automated, never batched, never an attachment.
// u16: the child composes; the request routes to the guardian, who checks
// the address and presses send. The club address is typed from the club's
// own notice — hostile free text, validated as an email shape only.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function composeSend(recordId: string, formData: FormData) {
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
  redirect(`/send/${recordId}?asked=1`);
}
