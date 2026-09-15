'use server';
// Sending an invitation (D-117, D-153): it lands INSIDE Pitch — the only
// club-to-family route — and it now reaches whoever it is for.
//
//   under 18  every parent, and the player, are woken (doc 15 §24 — a bare
//             wake: no name, no club, no message). The content stays in Pitch.
//   18+       the player gets doc 15 §27, which names the club and nothing more.
//
// It used to wake one guardian and nobody else — so an adult a club invited
// was never told, and a 16-17 never saw their own invitation.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { getSessionPersonId } from '@/lib/session';
import { adultInvitationEmail, bareWakeEmail, bareWakeSms } from '@/lib/messages';
import { send } from '@/lib/messaging';

//
// Ids come from the FORM, not from bind(). A bound server action renders
// $ACTION_REF_n plus encrypted arguments only the client runtime resolves,
// so it 500s without JavaScript instead of degrading. Every id below was
// already re-checked server-side — bind() never made one trustworthy.
export async function sendInvitation(formData: FormData) {
  const registrationId = String(formData.get('registrationId') ?? '');
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  if (!isUuid(registrationId)) redirect('/club/register');
  const body = String(formData.get('body') ?? '').trim().slice(0, 400);
  const kind = String(formData.get('kind') ?? 'trial') === 'interested' ? 'interested' : 'trial';

  let invitationId = '';
  let player = { id: '', band: 'u16', email: null as string | null, club: '' };
  const client = await db.connect();
  try {
    await client.query('begin');
    // fn_can_invite decides — including the free tier (D-153). And one
    // invitation per registration: P10, no second message.
    const reg = await client.query(
      `select r.id, r.club_id, r.player_id, r.trial_notice_id, fn_age_band(p.dob) as band, p.email, c.name as club_name
       from registration r join person p on p.id = r.player_id join club c on c.id = r.club_id
       where r.id = $1 and fn_can_invite($2, r.id)
         and not exists (select 1 from invitation i where i.registration_id = r.id)
       for update of r`,
      [registrationId, me],
    );
    if (reg.rows.length === 0) {
      await client.query('rollback');
      redirect('/club/register');
    }
    const r = reg.rows[0];
    player = { id: r.player_id, band: r.band, email: r.email, club: r.club_name };
    const inv = await client.query(
      `insert into invitation (club_id, registration_id, body, trial_notice_id) values ($1,$2,$3,$4) returning id`,
      [r.club_id, registrationId, JSON.stringify({ kind, note: body }), kind === 'trial' ? r.trial_notice_id : null],
    );
    invitationId = inv.rows[0].id;
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

  // Sent after the transaction and after the client is released.
  if (player.band === '18plus') {
    if (player.email) await send(adultInvitationEmail(player.club, invitationId), { address: player.email, personId: player.id });
  } else {
    const guardians = await db.query(
      `select p.id, p.email from guardianship_link g join person p on p.id = g.guardian_id
       where g.child_id = $1 and g.approved_at is not null and g.revoked_at is null and p.email is not null`,
      [player.id],
    );
    for (const g of guardians.rows as { id: string; email: string }[]) {
      await send(bareWakeEmail(), { address: g.email, personId: g.id });
    }
    if (player.email) await send(bareWakeEmail(), { address: player.email, personId: player.id });
  }
  void bareWakeSms; // SMS half sends once the sender ID is registered (D-81)
  redirect(`/club/invite/${registrationId}`);
}
