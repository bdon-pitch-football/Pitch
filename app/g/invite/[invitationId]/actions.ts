'use server';
// The guardian's reply (D-117): field by field, nothing shared by default.
// Ignoring the invitation produces no state the club can see (D-138) — and
// declining ('Not this time') tells the club nothing either.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';

export async function sendReply(invitationId: string, formData: FormData) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const shared: Record<string, boolean | string> = {
    answer: String(formData.get('answer') ?? 'yes'),
    phone: formData.get('share_phone') === 'on',
    email: formData.get('share_email') === 'on',
    coach: formData.get('share_coach') === 'on',
  };
  const note = String(formData.get('note') ?? '').trim().slice(0, 400);
  if (note) shared.note = note;

  const client = await db.connect();
  try {
    await client.query('begin');
    const inv = await client.query(
      `select i.id, dr.person_id from invitation i
       join registration r on r.id = i.registration_id
       join person p on p.id = r.player_id
       join development_record dr on dr.person_id = p.id
       join guardianship_link g on g.child_id = p.id and g.guardian_id = $2
         and g.approved_at is not null and g.revoked_at is null
       where i.id = $1 for update of i`,
      [invitationId, me],
    );
    if (inv.rows.length === 0) {
      await client.query('rollback');
      redirect('/home');
    }
    await client.query(
      `insert into invitation_reply (invitation_id, replied_by, shared_fields) values ($1,$2,$3)`,
      [invitationId, me, JSON.stringify(shared)],
    );
    await client.query(`update invitation set read_at = coalesce(read_at, now()) where id = $1`, [invitationId]);
    await client.query(
      `insert into consent_event (event, actor_id, subject_id, detail)
       values ('invitation_replied', $1, $2, jsonb_build_object('invitation_id', $3::uuid))`,
      [me, inv.rows[0].person_id, invitationId],
    );
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  redirect('/home');
}
