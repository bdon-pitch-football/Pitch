// What "Send my CV" should be for this viewer, on this record, right now.
// ONE query, read by both the page and the action — so the screen can never
// offer a send the action will refuse, or refuse one the action would allow.
//
// Postgres decides who may send (fn_can_dispatch); this only chooses which of
// four screens that answer produces.
import 'server-only';
import { db } from './db';

export type SendMode =
  | 'self'    // 16-17 or 18+, sending their own CV (doc 14 L5, L8)
  | 'off'     // 16-17 whose guardian has switched sending off (L6, L7)
  | 'ask'     // under 16: the child composes, the guardian sends (L1)
  | 'none';   // no send surface at all: paused, unapproved, or not the player's to send (L10, L11)

export async function sendState(recordId: string, viewerId: string) {
  const { rows } = await db.query(
    `select p.first_name, fn_age_band(p.dob) as band, p.id = $2 as is_self,
       fn_can_dispatch($2, dr.id) as can,
       coalesce(gs.send_disabled, false) as send_off,
       coalesce(gs.profile_paused, false) as paused,
       fn_has_approved_guardian(p.id) as approved
     from development_record dr
     join person p on p.id = dr.person_id
     left join guardian_setting gs on gs.child_id = p.id
     where dr.id = $1`,
    [recordId, viewerId],
  );
  const s = rows[0];
  if (!s) return null;
  let mode: SendMode;
  if (s.paused || (s.band === 'u16' && !s.approved)) mode = 'none';
  else if (s.band === 'u16') mode = 'ask';
  else if (s.is_self && s.can) mode = 'self';
  else if (s.is_self && s.band === '16_17' && s.send_off) mode = 'off';
  else mode = 'none';
  return { firstName: s.first_name as string, band: s.band as 'u16' | '16_17' | '18plus', mode };
}
