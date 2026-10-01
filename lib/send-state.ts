// What "Send my CV" should be for this viewer, on this record, right now.
// ONE query, read by both the page and the action — so the screen can never
// offer a send the action will refuse, or refuse one the action would allow.
//
// Postgres decides who may send (fn_can_dispatch); this only chooses which of
// five screens that answer produces.
import 'server-only';
import { db } from './db';

export type SendMode =
  | 'self'    // 16-17 or 18+, sending their own CV (doc 14 L5, L8)
  | 'off'     // 16-17 whose guardian has switched sending off (L6, L7)
  | 'ask'     // under 16, in their own seat: the child composes, the guardian sends (L1)
  | 'guardian' // under 16, their confirmed parent: the parent sends it themselves (L2; C-P4)
  | 'none';   // no send surface at all: paused, unapproved, or not the player's to send (L10, L11)

export async function sendState(recordId: string, viewerId: string) {
  const { rows } = await db.query(
    `select p.first_name, fn_age_band(p.dob) as band, p.id = $2 as is_self,
       fn_record_actor($2, dr.id) = 'guardian' as is_guardian,
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
  // C-P4 (BUZ, 1 Oct): a parent who opened this for their under-16 sends it
  // from here. It used to be 'ask' whoever was looking, so the parent read
  // the child's words and then approved their own request by email. The
  // branch keys on the database's two answers — a confirmed guardian of this
  // record (fn_record_actor: approved, not revoked), whom fn_can_dispatch
  // lets send — never on the viewer merely not being the child.
  else if (s.band === 'u16' && s.is_guardian && s.can) mode = 'guardian';
  else if (s.band === 'u16' && s.is_self) mode = 'ask';
  // Nobody else has an under-16's send surface. Every caller has already
  // passed requireRecordActor, so this is the belt: it used to be 'ask'.
  else if (s.band === 'u16') mode = 'none';
  else if (s.is_self && s.can) mode = 'self';
  else if (s.is_self && s.band === '16_17' && s.send_off) mode = 'off';
  else mode = 'none';
  return { firstName: s.first_name as string, band: s.band as 'u16' | '16_17' | '18plus', mode };
}
