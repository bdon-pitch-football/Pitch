'use server';
// "Verify for {club}" (D-160; BUZ 29 Sep). A coach at the player's own club
// marks a number on this CV coach-verified.
//
// The database decides everything: fn_verify_stat (0083, 0122) writes the
// provenance, the club, the coach and the time from the ACTOR, never from
// this form, and refuses anyone without the pen — a coach of another squad,
// another club, an unverified club, an administrator, the family. The ids
// here only say which number was pressed; the squad check keeps the press on
// the page it came from, exactly as the page itself is gated.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { getSessionPersonId } from '@/lib/session';

export async function verifyStat(formData: FormData) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const squadId = String(formData.get('squadId') ?? '');
  const playerId = String(formData.get('playerId') ?? '');
  const statId = String(formData.get('statId') ?? '');
  if (!isUuid(squadId) || !isUuid(playerId) || !isUuid(statId)) redirect('/home');
  // The stat must be this player's, read from where this reader may read
  // them (fn_can_read_squad_player) — or nothing happens and the answer is
  // the same page, as it is for any refusal.
  const { rows } = await db.query(
    `select 1 from player_stat ps join development_record dr on dr.id = ps.record_id
      where ps.id = $1 and dr.person_id = $2 and fn_can_read_squad_player($3, $4, $2)`,
    [statId, playerId, me, squadId],
  );
  if (rows.length > 0) await db.query('select fn_verify_stat($1, $2)', [me, statId]);
  redirect(`/club/squads/${squadId}/cv/${playerId}`);
}
