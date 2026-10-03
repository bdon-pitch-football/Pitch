'use server';
// Register interest (D-108), in every band (D-153).
//
//   under 16  the child composes; the request routes to the guardian (D-91)
//             — and the guardian, composing here themselves, sends it (C-P4)
//   16–17     the player registers themselves (doc 14 N4)
//   18+       the player registers alone (N5)
//
// It used to know only the first. An adult or a 16-17 pressing "Register my
// interest" composed a request that only a guardian could ever dispatch — so
// for anyone without one it never became a registration, the club never saw
// them, and a club could never invite them. The same dead end the send flow
// had. Who may act is the send gate (lib/send-state): the same pause, the
// same 16-17 switch, because going on a register is sending the CV.
//
// A trial arriving from a notice is recorded on the registration, so the club
// can invite to that trial — and, on the free tier, so it can invite at all.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { legalStamp } from '@/lib/legal-stamp';
import { POSITIONS } from '@/lib/football';
import { signupHoldEmail } from '@/lib/messages';
import { send } from '@/lib/messaging';
import { isUuid } from '@/lib/ids';
import { dispatchInterestRequest } from '@/lib/interest-dispatch';
import { requireRecordActor } from '@/lib/record-guard';
import { sendState } from '@/lib/send-state';

//
// Ids come from the FORM, not from bind(). A bound server action renders
// $ACTION_REF_n plus encrypted arguments only the client runtime resolves,
// so it 500s without JavaScript instead of degrading. Every id below was
// already re-checked server-side — bind() never made one trustworthy.
export async function composeInterest(formData: FormData) {
  const recordId = String(formData.get('recordId') ?? '');
  // Never trust the record id in the URL (D-94 §3).
  const { personId } = await requireRecordActor(recordId);
  const clubId = String(formData.get('clubId') ?? '');
  const squadRaw = String(formData.get('squadId') ?? '');
  const trialRaw = String(formData.get('trialId') ?? '');
  // Only the ten positions (D-92), never free text: whatever is posted here
  // reaches the club's register, and it does not pass the note filter (C-P4
  // safety review N-5). Unknown values are dropped, as post-trial drops them.
  const positions = [...new Set(String(formData.get('positions') ?? '').split(',').map((v) => v.trim().toUpperCase()))]
    .filter((v) => v in POSITIONS).slice(0, 3);
  const note = String(formData.get('note') ?? '').trim().slice(0, 140);
  if (!isUuid(clubId)) redirect(`/register-interest/${recordId}?error=1`);

  const state = await sendState(recordId, personId);
  if (!state || state.mode === 'none') redirect('/home');
  // L6/N4: sending is switched off — nothing is created (L56).
  if (state.mode === 'off') redirect(`/register-interest/${recordId}?club=${clubId}`);

  // A register belongs to a club that is on Pitch. An unclaimed listing has
  // nobody to read one; that family sends a CV instead.
  const club = await db.query(`select id from club where id = $1 and club_state in ('claimed','verified')`, [clubId]);
  if (club.rows.length === 0) redirect('/home');

  // The squad and trial are conveniences, never grants: dropped unless they
  // are this club's, and a trial only while it is on the board (0140).
  const squadId = isUuid(squadRaw)
    && (await db.query('select 1 from squad where id = $1 and club_id = $2', [squadRaw, clubId])).rows.length > 0
    ? squadRaw : null;
  // A4 / D-96, the age-contradiction hold. An adult naming a junior squad
  // (U17 or younger) is held for a person to look at — never rejected, and
  // told nothing different: the registration is made as usual, and while the
  // hold stands the person is hidden from every club (fn_person_hidden, 0049)
  // and their links answer as dead. U18 and up are not a contradiction for an
  // eighteen-year-old.
  if (squadId && state.band === '18plus') {
    const ag = (await db.query('select age_group from squad where id = $1', [squadId])).rows[0]?.age_group as string | null;
    const n = ag ? Number(/^U(\d+)$/.exec(ag)?.[1]) : NaN;
    if (Number.isFinite(n) && n <= 17) {
      const first = await db.query(
        `update person set signup_hold = true, signup_hold_at = coalesce(signup_hold_at, now())
         where id = $1 and not signup_hold returning email`,
        [personId],
      );
      // doc 15 §17, once, when the hold is first set: non-accusatory, and
      // it tells an under-18 how to get in properly.
      const email = first.rows[0]?.email as string | undefined;
      if (email) await send(signupHoldEmail(), { address: email, personId });
    }
  }

  // A trial tag is a dated notice: an open-now expression of interest (0173)
  // has no day for a club to invite to.
  const trial = isUuid(trialRaw)
    ? ((await db.query(
        `select id, trial_on from fn_trial_notices_advertised()
         where id = $1 and club_id = $2 and trial_on is not null`,
        [trialRaw, clubId])).rows[0] ?? null)
    : null;

  // C-P4 (BUZ, 1 Oct): a parent registering their under-16 does it from
  // here. The request their child would have composed, dispatched in the same
  // transaction by the one function /g/interest's press calls — so the club's
  // register and the parent's log get exactly what an approval gives them,
  // and a request that cannot go leaves nothing behind. No 'requested' row:
  // nobody asked anybody.
  if (state.mode === 'guardian') {
    let done: string | null = null;
    const client = await db.connect();
    try {
      await client.query('begin');
      // Safety review B-1: one register entry per club, the self path's rule
      // below. Every press used to add another entry, and "Take off this
      // register" took one away, so the club kept reading the child through
      // the rest. The child's row is locked first, so two presses at once
      // cannot both find nothing.
      const child = (await client.query(
        `select p.id from development_record dr join person p on p.id = dr.person_id where dr.id = $1 for update of p`,
        [recordId],
      )).rows[0]?.id as string | undefined;
      const existing = child ? (await client.query(
        `select id from registration where player_id = $1 and club_id = $2 and withdrawn_at is null limit 1`,
        [child, clubId],
      )).rows[0]?.id as string | undefined : undefined;
      if (existing) {
        // Already on this club's register. A trial chosen now is recorded on
        // it, so the club can invite to that trial — exactly as for a player.
        if (trial) {
          await client.query(`update registration set trial_notice_id = $2, trial_on = $3 where id = $1`,
            [existing, trial.id, trial.trial_on]);
        }
        done = existing;
      } else {
        const { rows } = await client.query(
          `insert into registration_request (record_id, club_id, squad_target, positions, note, trial_notice_id)
           values ($1,$2,$3,$4,$5,$6) returning id`,
          [recordId, clubId, squadId, positions, note || null, trial?.id ?? null],
        );
        done = await dispatchInterestRequest(client, rows[0].id, personId);
      }
      await client.query(done ? 'commit' : 'rollback');
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
    if (!done) redirect('/home');
    redirect(`/register-interest/${recordId}?club=${clubId}&registered=1`);
  }

  if (state.mode === 'self') {
    const existing = await db.query(
      `select id from registration where player_id = $1 and club_id = $2 and withdrawn_at is null limit 1`,
      [personId, clubId],
    );
    if (existing.rows[0]) {
      // Already on this club's register: one register entry per club. A trial
      // chosen now is recorded on it, so the club can invite to that trial.
      if (trial) {
        await db.query(`update registration set trial_notice_id = $2, trial_on = $3 where id = $1`,
          [existing.rows[0].id, trial.id, trial.trial_on]);
      }
    } else {
      const { rows } = await db.query(
        `insert into registration (player_id, club_id, squad_target, positions, note, trial_notice_id, trial_on, disclosed_by, policy_version)
         values ($1,$2,$3,$4,$5,$6,$7,$1,$8) returning id`,
        [personId, clubId, squadId, positions, note || null, trial?.id ?? null, trial?.trial_on ?? null, legalStamp('20')],
      );
      await db.query(
        `insert into consent_event (event, actor_id, subject_id, detail)
         values ('registration_created', $1, $1, jsonb_build_object('registration_id', $2::uuid))`,
        [personId, rows[0].id],
      );
    }
    redirect(`/register-interest/${recordId}?club=${clubId}&registered=1`);
  }

  // Under 16: composed here, sent by a guardian.
  const { rows } = await db.query(
    `insert into registration_request (record_id, club_id, squad_target, positions, note, trial_notice_id)
     values ($1,$2,$3,$4,$5,$6) returning id`,
    [recordId, clubId, squadId, positions, note || null, trial?.id ?? null],
  );
  await db.query(
    `insert into consent_event (event, subject_id, detail)
     select 'registration_created', dr.person_id, jsonb_build_object('request_id', $2::uuid, 'stage', 'requested')
     from development_record dr where dr.id = $1`,
    [recordId, rows[0].id],
  );
  redirect(`/register-interest/${recordId}?club=${clubId}&asked=1`);
}
