'use server';
// Replying to an invitation (D-117, D-153). Field by field, nothing shared by
// default, and ignoring it produces no state the club can see (D-138).
//
//   18+                the player's reply goes to the club when they send it
//   under 18, player   the reply is a DRAFT — a parent is woken to approve it
//   under 18, parent   approves the player's draft, or replies directly
//
// The database is what enforces the approval (invitation_reply_approval): a
// reply is only 'answered' once approved, and only a parent may approve a
// minor's. This action is the family's door onto that.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { getSessionPersonId } from '@/lib/session';
import { invitationView } from '@/lib/invitations';
import { bareWakeEmail, familyRepliedEmail } from '@/lib/messages';
import { send } from '@/lib/messaging';

const PHONE_RE = /^\+?[\d\s()-]{8,20}$/;

//
// FORM FIELDS, NOT bind(). A server action passed straight to
// <form action={fn}> is progressively enhanced — Next renders a plain POST
// with a stable action id and it works with no JavaScript. A BOUND one
// renders $ACTION_REF_n plus encrypted arguments only the client runtime can
// resolve, so without JS it returns a 500 rather than degrading.
export async function sendReply(formData: FormData) {
  const invitationId = String(formData.get('invitationId') ?? '');
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  if (!isUuid(invitationId)) redirect('/home');

  const v = await invitationView(invitationId, me);
  // Not yours, never existed — one answer.
  if (!v) redirect('/home');
  if (v.reply?.approved) redirect(`/g/invite/${invitationId}`);

  const minor = v.band !== '18plus';
  const answerRaw = String(formData.get('answer') ?? 'yes');
  const answer = answerRaw === 'interested_not_date' ? 'interested_not_date' : 'yes';
  const note = String(formData.get('note') ?? '').trim().slice(0, 400);

  // Under 18, the player writes a draft. It goes nowhere until a parent approves.
  if (v.viewer === 'self' && minor) {
    const shared = { answer, ...(note ? { note } : {}) };
    await db.query(
      `insert into invitation_reply (invitation_id, replied_by, shared_fields) values ($1,$2,$3)
       on conflict (invitation_id) do update set shared_fields = excluded.shared_fields, replied_by = excluded.replied_by
       where invitation_reply.approved_at is null`,
      [invitationId, me, JSON.stringify(shared)],
    );
    // doc 15 §24: a bare wake to every parent — no child's name, no club, no message.
    const guardians = await db.query(
      `select p.email from guardianship_link g join person p on p.id = g.guardian_id
       where g.child_id = $1 and g.approved_at is not null and g.revoked_at is null and p.email is not null`,
      [v.playerId],
    );
    for (const g of guardians.rows as { email: string }[]) await send(bareWakeEmail(), { address: g.email });
    redirect(`/g/invite/${invitationId}`);
  }

  // The approver: an adult answering for themselves, or a parent of a minor.
  // A guardian of an adult holds visibility only (L9's reasoning).
  if (v.viewer === 'guardian' && !minor) redirect('/home');

  const myEmail = formData.get('share_email') === 'on'
    ? ((await db.query('select email from person where id = $1', [me])).rows[0]?.email as string | undefined) ?? null
    : null;
  const phoneRaw = String(formData.get('share_phone') ?? '').trim();
  const phone = PHONE_RE.test(phoneRaw) ? phoneRaw : null;
  // P8/P9: each detail travels only because it was chosen, and the reply may
  // carry none at all. What is stored is what the club reads — the actual
  // address or number, not a switch that pointed at nothing.
  const shared = { answer, ...(note ? { note } : {}), ...(myEmail ? { email: myEmail } : {}), ...(phone ? { phone } : {}) };

  const client = await db.connect();
  try {
    await client.query('begin');
    await client.query(`select id from invitation where id = $1 for update`, [invitationId]);
    await client.query(
      `insert into invitation_reply (invitation_id, replied_by, shared_fields, approved_by, approved_at)
       values ($1,$2,$3,$2,now())
       on conflict (invitation_id) do update
         set shared_fields = excluded.shared_fields, approved_by = excluded.approved_by, approved_at = now()
         where invitation_reply.approved_at is null`,
      [invitationId, me, JSON.stringify(shared)],
    );
    await client.query(`update invitation set read_at = coalesce(read_at, now()) where id = $1`, [invitationId]);
    await client.query(
      `insert into consent_event (event, actor_id, subject_id, detail)
       values ('invitation_replied', $1, $2, jsonb_build_object('invitation_id', $3::uuid))`,
      [me, v.playerId, invitationId],
    );
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }

  // doc 15 §28: the club is told a family replied, and nothing else.
  if (v.clubContactEmail) await send(familyRepliedEmail(v.clubName), { address: v.clubContactEmail });
  redirect(`/g/invite/${invitationId}`);
}
