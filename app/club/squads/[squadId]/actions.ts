'use server';
// The club's side of a squad (0052, D-158). Confirming a family's claim,
// inviting a player from the register, and taking someone out of a squad.
//
// Every id comes from the FORM and is re-checked here; the database decides
// whether any of it is allowed (0052's rules). A club that is not yours, or a
// squad that is not this club's, answers exactly as one that does not exist.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { getSessionPersonId } from '@/lib/session';
import { bareWakeEmail } from '@/lib/messages';
import { send } from '@/lib/messaging';

const field = (f: FormData, k: string) => String(f.get(k) ?? '');

/** The squad, if this session may work it. Anything else: /home. */
async function mySquad(squadId: string): Promise<{ me: string; clubId: string }> {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  if (!isUuid(squadId)) redirect('/home');
  const { rows } = await db.query(
    `select s.club_id from squad s where s.id = $1 and fn_can_work_squads($2, s.club_id)`,
    [squadId, me],
  );
  if (rows.length === 0) redirect('/home');
  return { me, clubId: rows[0].club_id as string };
}

/**
 * The bare wake (doc 15 §24, D-117): it says something is waiting and
 * nothing else — no name, no club, no squad. Whoever decides gets it: a
 * guardian for an under-16, the player and their guardians from 16.
 */
async function wake(personId: string) {
  const { rows } = await db.query(
    `select p.email, fn_age_band(p.dob) as band from person p where p.id = $1`, [personId]);
  const to: { id: string; email: string }[] = [];
  if (rows[0]?.band && rows[0].band !== 'u16' && rows[0].email) to.push({ id: personId, email: rows[0].email as string });
  const guardians = await db.query(
    `select g.guardian_id as id, p.email from guardianship_link g join person p on p.id = g.guardian_id
     where g.child_id = $1 and g.approved_at is not null and g.revoked_at is null and p.email is not null`, [personId]);
  to.push(...(guardians.rows as { id: string; email: string }[]));
  for (const person of to) await send(bareWakeEmail(), { address: person.email, personId: person.id });
}

export async function answerClaim(formData: FormData) {
  const squadId = field(formData, 'squadId');
  const claimId = field(formData, 'claimId');
  const yes = field(formData, 'answer') === 'yes';
  const { me } = await mySquad(squadId);
  if (!isUuid(claimId)) redirect(`/club/squads/${squadId}`);

  // The wake goes out AFTER the connection is back: the dev database serves
  // one connection, and sending while holding it waits on itself forever.
  let joined: string | null = null;
  const client = await db.connect();
  try {
    await client.query('begin');
    const claim = await client.query(
      `select id, person_id from squad_claim
       where id = $1 and squad_id = $2 and answered_at is null for update`,
      [claimId, squadId],
    );
    if (claim.rows.length > 0) {
      await client.query(`update squad_claim set answered_at = now(), answered_by = $2, confirmed = $3 where id = $1`,
        [claimId, me, yes]);
      if (yes) await client.query(`select fn_join_squad($1, $2, $3, 'claim')`, [claim.rows[0].person_id, squadId, me]);
      await client.query('commit');
      if (yes) joined = claim.rows[0].person_id as string;
    } else {
      await client.query('rollback');
    }
  } catch {
    await client.query('rollback');
  } finally {
    client.release();
  }
  if (joined) await wake(joined);
  redirect(`/club/squads/${squadId}?done=${yes ? 'confirmed' : 'declined'}`);
}

export async function inviteToSquad(formData: FormData) {
  const squadId = field(formData, 'squadId');
  const personId = field(formData, 'personId');
  const { me, clubId } = await mySquad(squadId);
  if (!isUuid(personId)) redirect(`/club/squads/${squadId}`);
  // Only someone the club can already see: a player on its own register.
  // There is no way to reach a child the club has not been shown (D-100).
  const ok = await db.query(
    `select 1 from registration r where r.player_id = $1 and r.club_id = $2 and r.withdrawn_at is null`,
    [personId, clubId],
  );
  if (ok.rows.length === 0) redirect(`/club/squads/${squadId}`);
  try {
    await db.query(
      `insert into squad_invitation (person_id, club_id, squad_id, invited_by) values ($1,$2,$3,$4)`,
      [personId, clubId, squadId, me],
    );
    await wake(personId);
  } catch {
    redirect(`/club/squads/${squadId}?error=1`);
  }
  redirect(`/club/squads/${squadId}?done=asked`);
}

export async function cancelInvitation(formData: FormData) {
  const squadId = field(formData, 'squadId');
  const invitationId = field(formData, 'invitationId');
  const { me } = await mySquad(squadId);
  if (isUuid(invitationId)) {
    await db.query(
      `update squad_invitation set answered_at = now(), answered_by = $2, accepted = false
       where id = $1 and squad_id = $3 and answered_at is null`,
      [invitationId, me, squadId],
    );
  }
  redirect(`/club/squads/${squadId}?done=cancelled`);
}

/** Out of the squad, not out of Pitch: the record is the player's (D-10). */
export async function removeFromSquad(formData: FormData) {
  const squadId = field(formData, 'squadId');
  const personId = field(formData, 'personId');
  const { me } = await mySquad(squadId);
  if (isUuid(personId)) {
    await db.query(
      `update membership set ended_at = now()
       where person_id = $1 and squad_id = $2 and role = 'player' and ended_at is null`,
      [personId, squadId],
    );
    await db.query(
      `insert into consent_event (event, actor_id, subject_id, detail)
       values ('squad_left', $1, $2, jsonb_build_object('squad_id',$3::uuid,'source','club'))`,
      [me, personId, squadId],
    );
  }
  redirect(`/club/squads/${squadId}?done=removed`);
}
