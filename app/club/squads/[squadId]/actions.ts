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
  // Nothing is reported as done unless it was done (N3, 22 Sep): a claim from
  // a guardian who has since been revoked, or at a club that has since been
  // suspended, is refused by fn_join_squad — and the club is told that,
  // rather than "confirmed".
  let ok = false;
  const client = await db.connect();
  try {
    await client.query('begin');
    const claim = await client.query(
      `select id, person_id, asked_by from squad_claim
       where id = $1 and squad_id = $2 and answered_at is null for update`,
      [claimId, squadId],
    );
    if (claim.rows.length > 0) {
      await client.query(`update squad_claim set answered_at = now(), answered_by = $2, confirmed = $3 where id = $1`,
        [claimId, me, yes]);
      // M10: who asked is re-checked at the join, weeks later.
      const done = yes
        ? (await client.query(`select fn_join_squad($1, $2, $3, 'claim', $4) as ok`,
            [claim.rows[0].person_id, squadId, me, claim.rows[0].asked_by])).rows[0].ok as boolean
        : true;
      if (done) {
        await client.query('commit');
        ok = true;
        if (yes) joined = claim.rows[0].person_id as string;
      } else {
        await client.query('rollback');
      }
    } else {
      await client.query('rollback');
    }
  } catch {
    await client.query('rollback');
  } finally {
    client.release();
  }
  if (joined) await wake(joined);
  if (!ok) redirect(`/club/squads/${squadId}?error=1`);
  // 'no', never 'declined': D-108's banned words are banned on every
  // surface, and the address bar is one (QA F8). The banner this keys is
  // unchanged.
  redirect(`/club/squads/${squadId}?done=${yes ? 'confirmed' : 'no'}`);
}

export async function inviteToSquad(formData: FormData) {
  const squadId = field(formData, 'squadId');
  const personId = field(formData, 'personId');
  const { me, clubId } = await mySquad(squadId);
  if (!isUuid(personId)) redirect(`/club/squads/${squadId}`);
  // Only someone the club can already see: a player its own register shows
  // IT, which is the database's answer and not this page's (0054, L23).
  // There is no way to reach a child the club has not been shown (D-100).
  const ok = await db.query(`select fn_can_ask_to_squad($1, $2, $3) as ok`, [me, personId, squadId]);
  if (!ok.rows[0]?.ok) redirect(`/club/squads/${squadId}`);
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

/**
 * The club takes its own ask back. This is the club's act, not the family's
 * answer, so it is recorded as its own thing (withdrawn_at) — a decline and a
 * silence stay identical on the club's screen, and a withdrawal empties the
 * row from it whether or not the family ever answered (D-138, 0054).
 */
export async function cancelInvitation(formData: FormData) {
  const squadId = field(formData, 'squadId');
  const invitationId = field(formData, 'invitationId');
  await mySquad(squadId);
  if (isUuid(invitationId)) {
    await db.query(
      `update squad_invitation set withdrawn_at = now()
       where id = $1 and squad_id = $2 and withdrawn_at is null`,
      [invitationId, squadId],
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
    // One statement, so the timeline says a child came out of a squad only
    // where one actually did (M6): posting a person id that is not in this
    // squad used to write "came out of a club squad" into their guardian's
    // timeline anyway.
    await db.query(
      `with out as (
         update membership set ended_at = now()
         where person_id = $1 and squad_id = $2 and role = 'player' and ended_at is null
         returning person_id)
       insert into consent_event (event, actor_id, subject_id, detail)
       select 'squad_left', $3, o.person_id, jsonb_build_object('squad_id',$2::uuid,'source','club')
       from out o`,
      [personId, squadId, me],
    );
  }
  redirect(`/club/squads/${squadId}?done=removed`);
}
