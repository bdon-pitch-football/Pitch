// The ONE way an under-16 goes onto a club's register: a guardian dispatches
// a registration request (D-108, D-91). The registration (disclosed_by = the
// guardian), the stamp on the request and the consent row, in the caller's
// transaction.
//
// It lived inside /g/interest's action, the guardian answering their child's
// request. C-P4 (BUZ, 1 Oct) gave the parent a second door — composing it
// themselves on /register-interest — and both doors call this, so what the
// club's register and the parent's log receive cannot differ between them.
//
// Standing is re-checked HERE, under the row lock: a guardian who acts for
// this child (fn_guardian_controls, 0177 — so never once they are 18), a child their parents have not paused (L18: a
// request a pause lands on cannot be dispatched, whichever door it came
// through; safety review N-3), and a request not already dispatched. Returns the
// registration id, or null for every way it cannot happen — not yours,
// already sent, never existed. One answer, deliberately.
import 'server-only';
import type { PoolClient } from 'pg';
import { legalStamp } from './legal-stamp';

export async function dispatchInterestRequest(client: PoolClient, requestId: string, guardianId: string): Promise<string | null> {
  const req = await client.query(
    `select rr.id, rr.record_id, rr.club_id, rr.squad_target, rr.positions, rr.note, dr.person_id,
       rr.trial_notice_id, (select tn.trial_on from trial_notice tn where tn.id = rr.trial_notice_id) as trial_on
     from registration_request rr
     join development_record dr on dr.id = rr.record_id
     join person p on p.id = dr.person_id
     where rr.id = $1 and rr.dispatched_at is null
       -- Safety review F3 (4 Oct): a guardian dispatches for an under-16 only
       -- (D-91, doc 14 N4). From 16 the player registers, so a request
       -- composed at 15 is sent by nobody — the F1 rule, for the register.
       and fn_age_band(p.dob) = 'u16'
       -- 0177: a guardian who acts for this child — never an adult's parent,
       -- even holding a request the child made before 18 (D-49, P15).
       and fn_guardian_controls($2, dr.person_id)
       and not coalesce((select gs.profile_paused from guardian_setting gs where gs.child_id = dr.person_id), false)
     for update of rr`,
    [requestId, guardianId],
  );
  if (req.rows.length === 0) return null;
  const r = req.rows[0];
  const reg = await client.query(
    // The trial the child registered against travels onto the registration,
    // so the club can invite to it — and on the free tier, invite at all (D-153).
    `insert into registration (player_id, club_id, squad_target, positions, note, trial_notice_id, trial_on, disclosed_by, policy_version)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    // Only a DATED notice is a trial tag (0173): an open-now expression of
    // interest has no day to invite to, and a tag with no date would never
    // purge (N14). The belt behind fn_ops_edit_notice's refusal.
    [r.person_id, r.club_id, r.squad_target, r.positions, r.note, r.trial_on ? r.trial_notice_id : null, r.trial_on ?? null, guardianId, legalStamp('20')],
  );
  await client.query(
    `update registration_request set dispatched_by=$2, dispatched_at=now(), registration_id=$3 where id=$1`,
    [requestId, guardianId, reg.rows[0].id],
  );
  await client.query(
    `insert into consent_event (event, actor_id, subject_id, detail)
     values ('registration_created', $1, $2, jsonb_build_object('request_id', $3::uuid))`,
    [guardianId, r.person_id, requestId],
  );
  return reg.rows[0].id as string;
}
