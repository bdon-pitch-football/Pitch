'use server';
// A coach answers a club's request to read the registrations for their teams
// (D-154). Accepting makes them the club's coach (if they were not already),
// records the club's WWCC attestation against the TD who confirmed they
// checked it (D-98), and writes one grant per team. The database decides
// whether any of it is allowed (0037's grant rules): verified club, the TD's
// request, at most three teams, at most ten coaches.
//
// Ids come from the FORM, not from bind(): a bound action 500s without
// JavaScript. The invite is re-read here against the signed-in person.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { getSessionPersonId } from '@/lib/session';

export async function answerCoachInvite(formData: FormData) {
  const inviteId = String(formData.get('inviteId') ?? '');
  const accept = String(formData.get('answer') ?? '') === 'accept';
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  if (!isUuid(inviteId)) redirect('/home');

  let failed = false;
  const client = await db.connect();
  try {
    await client.query('begin');
    const inv = await client.query(
      `select id, club_id, invited_by, squad_ids from coach_invite
       where id = $1 and person_id = $2 and answered_at is null for update`,
      [inviteId, me],
    );
    if (inv.rows.length === 0) {
      await client.query('rollback');
    } else {
      const i = inv.rows[0] as { id: string; club_id: string; invited_by: string; squad_ids: string[] };
      if (accept) {
        await client.query(
          `insert into membership (person_id, club_id, role)
           select $1, $2, 'coach'
           where not exists (select 1 from membership where person_id = $1 and club_id = $2 and role = 'coach' and ended_at is null)`,
          [me, i.club_id],
        );
        await client.query(
          `insert into wwcc_attestation (person_id, club_id, attested_by)
           select $1, $2, $3
           where not exists (select 1 from wwcc_attestation where person_id = $1 and club_id = $2 and revoked_at is null)`,
          [me, i.club_id, i.invited_by],
        );
        for (const squadId of i.squad_ids) {
          await client.query(
            `insert into register_grant (club_id, person_id, squad_id, granted_by)
             select $1, $2, $3, $4
             where not exists (select 1 from register_grant where person_id = $2 and squad_id = $3 and revoked_at is null)`,
            [i.club_id, me, squadId, i.invited_by],
          );
        }
      }
      await client.query(`update coach_invite set answered_at = now(), accepted = $2 where id = $1`, [i.id, accept]);
      await client.query('commit');
    }
  } catch {
    await client.query('rollback');
    failed = true;
  } finally {
    client.release();
  }
  redirect(failed ? '/home?coachInvite=failed' : '/home');
}
