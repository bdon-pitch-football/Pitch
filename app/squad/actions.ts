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
import { internalPath } from '@/lib/safe-path';
import { getSessionPersonId } from '@/lib/session';

const field = (f: FormData, k: string) => String(f.get(k) ?? '');

/**
 * Where to go back to. It comes off the form, so it is a place inside Pitch
 * or it is /home (safety N2: a same-origin post measured a 303 to an external
 * site). The rule used to live here as one regular expression, which a tab
 * walked straight through — a browser strips tabs before it parses a
 * Location, so "/<TAB>/evil.example" arrived as "//evil.example". lib/
 * safe-path holds the whole test now, and a suite pins it.
 */
const backTo = (raw: string): string => internalPath(raw);

/**
 * The player this session may ASK for: a claim, or a yes to a club's
 * invitation. From 16 the player, and only with a parent confirmed and their
 * send switch on; for an under-16 the guardian, and never for an adult child
 * (0054 — B4 and M3).
 */
async function actFor(personId: string): Promise<string> {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  if (!isUuid(personId)) redirect('/home');
  const { rows } = await db.query(`select fn_can_act_on_squad($1, $2) as ok`, [me, personId]);
  if (!rows[0]?.ok) redirect('/home');
  return me;
}

/**
 * The player this session may RETRACT for: leaving, or taking back a claim
 * nobody has answered. The same people, minus the conditions that only make
 * sense for putting a club on a page — a way out is never conditional
 * (D-10, D-26's shape).
 */
async function retractFor(personId: string): Promise<string> {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  if (!isUuid(personId)) redirect('/home');
  const { rows } = await db.query(`select fn_can_leave_squad($1, $2) as ok`, [me, personId]);
  if (!rows[0]?.ok) redirect('/home');
  return me;
}

/** "I play here" — it changes nothing until the club confirms it. */
export async function askToJoinSquad(formData: FormData) {
  const personId = field(formData, 'personId');
  const squadId = field(formData, 'squadId');
  const back = backTo(field(formData, 'back'));
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
  const back = backTo(field(formData, 'back'));
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  if (!isUuid(invitationId)) redirect(back);

  // A stranger's answer is a no-op that redirects exactly as a real one does
  // (D-77, L12). This flag is for the person who DID act: it is false only
  // when their own yes could not be carried out — a club suspended since the
  // ask, a child since paused (M10) — and then nothing says it worked (N3).
  let ok = true;
  const client = await db.connect();
  try {
    await client.query('begin');
    const inv = await client.query(
      `select si.id, si.person_id, si.squad_id from squad_invitation si
       where si.id = $1 and si.answered_at is null and si.withdrawn_at is null and si.lapsed_at is null
         and fn_can_act_on_squad($2, si.person_id) for update`,
      [invitationId, me],
    );
    if (inv.rows.length > 0) {
      const i = inv.rows[0] as { id: string; person_id: string; squad_id: string };
      await client.query(`update squad_invitation set answered_at = now(), answered_by = $2, accepted = $3 where id = $1`,
        [i.id, me, yes]);
      if (yes) {
        ok = (await client.query(`select fn_join_squad($1, $2, $3, 'invitation') as ok`,
          [i.person_id, i.squad_id, me])).rows[0].ok as boolean;
      }
    }
    if (ok) await client.query('commit'); else await client.query('rollback');
  } catch {
    ok = false;
    await client.query('rollback');
  } finally {
    client.release();
  }
  if (!ok) redirect(`${back}?squad=error`);
  redirect(`${back}?squad=${yes ? 'joined' : 'declined'}`);
}

/** Leaving is one tap and needs nobody's permission (D-10, D-26's shape). */
export async function leaveSquad(formData: FormData) {
  const personId = field(formData, 'personId');
  const back = backTo(field(formData, 'back'));
  const me = await retractFor(personId);
  // One statement, one squad_left per membership that actually ended (M6):
  // the log used to say a child came out of a squad whether or not any row
  // changed, and a guardian's timeline is not a place for that.
  const out = await db.query(
    `with gone as (
       update membership set ended_at = now()
       where person_id = $1 and role = 'player' and ended_at is null
       returning squad_id, club_id)
     insert into consent_event (event, actor_id, subject_id, detail)
     select 'squad_left', $2, $1, jsonb_build_object('squad_id', g.squad_id, 'club_id', g.club_id, 'source','family')
     from gone g`,
    [personId, me],
  );
  if (!out.rowCount) redirect(`${back}?squad=error`);
  redirect(`${back}?squad=left`);
}

/** An open claim the family changes its mind about, before any answer. */
export async function withdrawClaim(formData: FormData) {
  const personId = field(formData, 'personId');
  const claimId = field(formData, 'claimId');
  const back = backTo(field(formData, 'back'));
  const me = await retractFor(personId);
  if (isUuid(claimId)) {
    await db.query(
      `update squad_claim set answered_at = now(), answered_by = $2, confirmed = false
       where id = $1 and person_id = $3 and answered_at is null`,
      [claimId, me, personId],
    );
  }
  redirect(`${back}?squad=withdrawn`);
}
