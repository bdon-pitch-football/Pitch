// An invitation as ONE family member sees it — the player themself, or a
// parent. One query, read by the invitation page and its reply action, so
// the screen can never offer a reply the action refuses (D-117, D-153).
//
// Who may see it is fn_record_actor on the player's record: the player, or
// an approved guardian — and for an adult, a guardian only where the adult
// re-granted access, which is visibility and never the power to reply.
import 'server-only';
import { db } from './db';
import { isUuid } from './ids';

export type Band = 'u16' | '16_17' | '18plus';

export type InvitationView = {
  id: string;
  clubId: string;
  clubName: string;
  clubVerified: boolean;
  clubContactEmail: string | null;
  playerId: string;
  playerFirstName: string;
  band: Band;
  viewer: 'self' | 'guardian';
  kind: 'trial' | 'interested';
  note: string | null;
  trial: { title: string; date: string; timeVenue: string } | null;
  reply: { answer: string; note: string | null; approved: boolean; byPlayer: boolean } | null;
};

export async function invitationView(invitationId: string, viewerId: string): Promise<InvitationView | null> {
  if (!isUuid(invitationId)) return null;
  const { rows } = await db.query(
    `select i.id, i.body, c.id as club_id, c.name as club_name, c.club_state, c.contact_email,
       r.player_id, p.first_name, fn_age_band(p.dob) as band,
       fn_record_actor($2, dr.id) as viewer,
       (select row_to_json(t) from (
          select tn.title, to_char(tn.trial_on, 'Dy FMDD Mon') as date, tn.time_venue
          from trial_notice tn where tn.id = i.trial_notice_id) t) as trial,
       (select row_to_json(x) from (
          select ir.shared_fields, ir.approved_at, ir.replied_by
          from invitation_reply ir where ir.invitation_id = i.id) x) as reply
     from invitation i
     join registration r on r.id = i.registration_id
     join person p on p.id = r.player_id
     join development_record dr on dr.person_id = p.id
     join club c on c.id = i.club_id
     where i.id = $1`,
    [invitationId, viewerId],
  );
  const r = rows[0];
  if (!r || !r.viewer) return null;

  // The body is JSON written by the club's action; older rows may be plain
  // text. Either way it is hostile free text and is only ever rendered as text.
  let body: { kind?: string; note?: string } = {};
  try { body = typeof r.body === 'string' ? JSON.parse(r.body) : r.body; } catch { body = { note: String(r.body) }; }

  const shared = (r.reply?.shared_fields ?? {}) as { answer?: string; note?: string };
  return {
    id: r.id,
    clubId: r.club_id,
    clubName: r.club_name,
    clubVerified: r.club_state === 'verified',
    clubContactEmail: r.contact_email ?? null,
    playerId: r.player_id,
    playerFirstName: r.first_name,
    band: r.band as Band,
    viewer: r.viewer as 'self' | 'guardian',
    kind: body.kind === 'interested' ? 'interested' : 'trial',
    note: body.note ? String(body.note) : null,
    trial: r.trial ? { title: r.trial.title, date: r.trial.date, timeVenue: r.trial.time_venue } : null,
    reply: r.reply
      ? {
          answer: shared.answer ?? 'yes',
          note: shared.note ?? null,
          approved: Boolean(r.reply.approved_at),
          byPlayer: r.reply.replied_by === r.player_id,
        }
      : null,
  };
}
