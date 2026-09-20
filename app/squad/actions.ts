'use server';
// The family's side of a squad (0052, D-158): asking a club to confirm where
// you already play, answering a club's invitation, and leaving.
//
// Who may act is D-91's shape and the database decides it (fn_can_act_on_squad):
// an approved guardian always; the player themselves only from 16. An
// under-16 composes nothing here — their parent does it from the child's
// controls, the same way their parent sends.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { getSessionPersonId } from '@/lib/session';

const field = (f: FormData, k: string) => String(f.get(k) ?? '');

/** The player this session may act for, or home. */
async function actFor(personId: string): Promise<string> {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  if (!isUuid(personId)) redirect('/home');
  const { rows } = await db.query(`select fn_can_act_on_squad($1, $2) as ok`, [me, personId]);
  if (!rows[0]?.ok) redirect('/home');
  return me;
}

/** "I play here" — it changes nothing until the club confirms it. */
export async function askToJoinSquad(formData: FormData) {
  const personId = field(formData, 'personId');
  const squadId = field(formData, 'squadId');
  const back = field(formData, 'back') || '/home';
  const me = await actFor(personId);
  if (!isUuid(squadId)) redirect(`/squad/${personId}?error=1`);
  try {
    await db.query(
      `insert into squad_claim (person_id, club_id, squad_id, asked_by)
       select $1, s.club_id, s.id, $3 from squad s where s.id = $2`,
      [personId, squadId, me],
    );
  } catch {
    redirect(`/squad/${personId}?error=1`);
  }
  redirect(`${back}?squad=asked`);
}

/** The club asked; the family answers. Silence costs nothing (D-138). */
export async function answerSquadInvitation(formData: FormData) {
  const invitationId = field(formData, 'invitationId');
  const yes = field(formData, 'answer') === 'yes';
  const back = field(formData, 'back') || '/home';
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  if (!isUuid(invitationId)) redirect(back);

  const client = await db.connect();
  try {
    await client.query('begin');
    const inv = await client.query(
      `select si.id, si.person_id, si.squad_id from squad_invitation si
       where si.id = $1 and si.answered_at is null and fn_can_act_on_squad($2, si.person_id) for update`,
      [invitationId, me],
    );
    if (inv.rows.length > 0) {
      const i = inv.rows[0] as { id: string; person_id: string; squad_id: string };
      await client.query(`update squad_invitation set answered_at = now(), answered_by = $2, accepted = $3 where id = $1`,
        [i.id, me, yes]);
      if (yes) await client.query(`select fn_join_squad($1, $2, $3, 'invitation')`, [i.person_id, i.squad_id, me]);
    }
    await client.query('commit');
  } catch {
    await client.query('rollback');
  } finally {
    client.release();
  }
  redirect(`${back}?squad=${yes ? 'joined' : 'declined'}`);
}

/** Leaving is one tap and needs nobody's permission (D-10, D-26's shape). */
export async function leaveSquad(formData: FormData) {
  const personId = field(formData, 'personId');
  const back = field(formData, 'back') || '/home';
  const me = await actFor(personId);
  await db.query(
    `update membership set ended_at = now() where person_id = $1 and role = 'player' and ended_at is null`,
    [personId],
  );
  await db.query(
    `insert into consent_event (event, actor_id, subject_id, detail)
     values ('squad_left', $1, $2, jsonb_build_object('source','family'))`,
    [me, personId],
  );
  redirect(`${back}?squad=left`);
}

/** An open claim the family changes its mind about, before any answer. */
export async function withdrawClaim(formData: FormData) {
  const personId = field(formData, 'personId');
  const claimId = field(formData, 'claimId');
  const back = field(formData, 'back') || '/home';
  const me = await actFor(personId);
  if (isUuid(claimId)) {
    await db.query(
      `update squad_claim set answered_at = now(), answered_by = $2, confirmed = false
       where id = $1 and person_id = $3 and answered_at is null`,
      [claimId, me, personId],
    );
  }
  redirect(`${back}?squad=withdrawn`);
}
