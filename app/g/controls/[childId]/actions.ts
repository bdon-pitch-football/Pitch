'use server';
// Guardian controls (D-53, D-26). Renew extends life on a fresh token;
// Replace kills the old one in the same transaction — anyone holding it
// stops being able to open the page immediately. Pause stops everything
// outward-facing (A16). Deletion cascades the record and keeps exactly one
// thing: the consent-log proof that permission was given and withdrawn.
import { redirect } from 'next/navigation';
import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { switchOffOneLink } from '@/lib/link-switch';

async function assertGuardian(childId: string): Promise<string> {
  const g = await getSessionPersonId();
  if (!g) redirect('/signin');
  const { rows } = await db.query(
    `select 1 from guardianship_link where guardian_id=$1 and child_id=$2 and approved_at is not null and revoked_at is null`,
    [g, childId],
  );
  if (rows.length === 0) redirect('/home'); // not yours — same answer as not existing
  return g;
}

// The record id is a SECOND argument and it was never checked against the
// child. assertGuardian proved the caller was the guardian of childId and
// then replaceLink went on to mint a token for whatever recordId it was
// handed — so any approved guardian could revoke another family's links and
// walk away with a live share token to that child's CV, returned in the URL.
// An exported server action is a public endpoint: every argument is hostile,
// not just the first (D-94 §3).
async function assertChildsRecord(childId: string, recordId: string): Promise<void> {
  const { rows } = await db.query(
    `select 1 from development_record where id = $1 and person_id = $2`,
    [recordId, childId],
  );
  if (rows.length === 0) redirect('/home');
}

function newToken() {
  const raw = randomBytes(24).toString('base64url');
  return { raw, hash: createHash('sha256').update(raw).digest(), hint: `${raw.slice(0, 4)}·${raw.slice(-4)}` };
}

// FORM FIELDS, NOT bind(). A server action passed to <form action={fn}> is
// progressively enhanced — Next renders a plain POST with a stable action id
// and it works with no JavaScript at all. A BOUND one is not: it renders
// $ACTION_REF_n plus encrypted arguments that only the client runtime can
// resolve, so submitting it without JS returns a 500.
//
// These four are the guardian's controls — renew, replace, pause, delete.
// They are the safety promises of the whole product, and they were the four
// that needed JavaScript to work. They are also, for the same reason, the
// four that could not be tested without driving a browser.
//
// Taking the ids from the form costs nothing in safety: every argument was
// already hostile and already re-checked here. bind() never made them
// trustworthy — assertGuardian and assertChildsRecord did.
export async function replaceLink(formData: FormData) {
  const childId = String(formData.get('childId') ?? '');
  const recordId = String(formData.get('recordId') ?? '');
  const guardianId = await assertGuardian(childId);
  await assertChildsRecord(childId, recordId);
  const t = newToken();
  const client = await db.connect();
  try {
    await client.query('begin');
    await client.query(`update share_token set revoked_at=now() where record_id=$1 and revoked_at is null`, [recordId]);
    await client.query(
      `insert into share_token (record_id, token_hash, token_hint, issued_by, expires_at) values ($1,$2,$3,$4, now() + interval '90 days')`,
      [recordId, t.hash, t.hint, guardianId],
    );
    await client.query(
      `insert into consent_event (event, actor_id, subject_id, detail) values ('share_revoked',$1,$2,'{}'), ('share_issued',$1,$2,'{}')`,
      [guardianId, childId],
    );
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  redirect(`/g/controls/${childId}?link=${t.raw}`);
}

// Renew: same link, another 90 days. No new token needed — nothing to show.
export async function renewLink(formData: FormData) {
  const childId = String(formData.get('childId') ?? '');
  const recordId = String(formData.get('recordId') ?? '');
  const guardianId = await assertGuardian(childId);
  await assertChildsRecord(childId, recordId);
  // Only a link that is still ALIVE gets another 90 days. Without the expiry
  // clause this also revived tokens that had already lapsed — someone handed
  // a link 91 days ago would silently get access back, which is the opposite
  // of what a parent pressing "Renew" believes they are doing.
  await db.query(
    `update share_token set expires_at = now() + interval '90 days'
     where record_id=$1 and revoked_at is null and paused=false
       and (expires_at is null or expires_at > now())`,
    [recordId],
  );
  await db.query(
    `insert into consent_event (event, actor_id, subject_id, detail) values ('share_issued',$1,$2, jsonb_build_object('renewed',true))`,
    [guardianId, childId],
  );
  redirect(`/g/controls/${childId}`);
}

export async function setPause(formData: FormData) {
  const childId = String(formData.get('childId') ?? '');
  const paused = String(formData.get('paused') ?? '') === 'true';
  const guardianId = await assertGuardian(childId);
  await db.query(
    `insert into guardian_setting (child_id, profile_paused, updated_by) values ($1,$2,$3)
     on conflict (child_id) do update set profile_paused=$2, updated_by=$3, updated_at=now()`,
    [childId, paused, guardianId],
  );
  await db.query(
    `insert into consent_event (event, actor_id, subject_id, detail) values ('share_paused',$1,$2, jsonb_build_object('paused',$3::boolean))`,
    [guardianId, childId, paused],
  );
  redirect(`/g/controls/${childId}`);
}

// L6/L7: a 16-17's own sending, on or off. fn_can_dispatch has honoured this
// switch since 0021, and doc 15 §22 tells the parent "the switch is yours" —
// but nothing on this screen could change it, so the promise pointed at a
// column. Off stops the PLAYER sending; either guardian setting it is enough
// (most restrictive wins), and the player is told only that it is off.
export async function setSendSwitch(formData: FormData) {
  const childId = String(formData.get('childId') ?? '');
  const off = String(formData.get('sendOff') ?? '') === 'true';
  const guardianId = await assertGuardian(childId);
  await db.query(
    `insert into guardian_setting (child_id, send_disabled, updated_by) values ($1,$2,$3)
     on conflict (child_id) do update set send_disabled=$2, updated_by=$3, updated_at=now()`,
    [childId, off, guardianId],
  );
  await db.query(
    `insert into consent_event (event, actor_id, subject_id, detail) values ('send_switch_changed',$1,$2, jsonb_build_object('send_disabled',$3::boolean))`,
    [guardianId, childId, off],
  );
  redirect(`/g/controls/${childId}`);
}

export async function deleteEverything(formData: FormData) {
  const childId = String(formData.get('childId') ?? '');
  const guardianId = await assertGuardian(childId);
  const client = await db.connect();
  try {
    await client.query('begin');
    await client.query(
      `insert into consent_event (event, actor_id, subject_id, detail) values ('deletion_requested',$1,$2,'{}')`,
      [guardianId, childId],
    );
    // D-26, one tap, cascading correctly through the record. This had NEVER
    // completed: the guardianship link was REVOKED rather than deleted, and
    // then the person delete hit that surviving row's foreign key. Every
    // press rolled back and returned a 500, for all three fixtures, and
    // nothing had ever driven this button to notice.
    //
    // The child is the subject of far more tables than the four that were
    // here. Everything below is a row ABOUT the child; each one goes.
    // Deliberately NOT here: consent_event, which carries no foreign key to
    // person precisely so the audit of an erasure survives the erasure, and
    // anything authored by someone else, which is theirs (D-48).
    //
    // the record cascades: stats, entries, clips, versions, tokens, requests
    await client.query(`delete from development_record where person_id=$1`, [childId]);
    await client.query(`delete from membership where person_id=$1`, [childId]);
    // A club's invitation, and any reply, reference the registration with no
    // cascade — so deleting a child a club had invited would roll back.
    await client.query(`delete from invitation_reply where invitation_id in (
      select i.id from invitation i join registration r on r.id = i.registration_id where r.player_id=$1)`, [childId]);
    await client.query(`delete from invitation where registration_id in (select id from registration where player_id=$1)`, [childId]);
    await client.query(`delete from registration where player_id=$1`, [childId]);
    await client.query(`delete from share_request where requested_by=$1 or dispatched_by=$1`, [childId]);
    await client.query(`delete from share_card_approval where requested_by=$1 or approved_by=$1`, [childId]);
    await client.query(`delete from registration_request where dispatched_by=$1`, [childId]);
    await client.query(`delete from invitation_reply where replied_by=$1`, [childId]);
    await client.query(`delete from verification_challenge where person_id=$1`, [childId]);
    await client.query(`delete from message_outbox where to_person=$1`, [childId]);
    await client.query(`delete from undo_token where issued_to=$1`, [childId]);
    await client.query(`delete from abuse_signal where actor_id=$1`, [childId]);
    await client.query(`delete from investigation_grant where subject_id=$1 or investigator_id=$1`, [childId]);
    // A 16-17 may coach MiniRoos (D-82), so these can exist for a minor.
    await client.query(`delete from role_application where coach_id=$1`, [childId]);
    await client.query(`delete from coach_profile where person_id=$1`, [childId]);
    await client.query(`delete from wwcc_attestation where person_id=$1 or attested_by=$1`, [childId]);
    await client.query(`delete from guardian_setting where child_id=$1 or updated_by=$1`, [childId]);
    await client.query(`delete from guardianship_link where child_id=$1 or guardian_id=$1`, [childId]);
    await client.query(`delete from person where id=$1`, [childId]);
    await client.query(
      `insert into consent_event (event, actor_id, detail) values ('deletion_completed',$1,'{}')`,
      [guardianId],
    );
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  redirect('/home');
}

// "Take one off": the link one club has stops opening the page, and every
// other club's keeps working. lib/link-switch re-checks the id against this
// guardian's own view of the send log, so a forged id does nothing.
export async function switchOffOne(formData: FormData) {
  const childId = String(formData.get('childId') ?? '');
  const g = await assertGuardian(childId);
  const ok = await switchOffOneLink(g, childId, String(formData.get('tokenId') ?? ''));
  redirect(`/g/controls/${childId}${ok ? '?off=1' : ''}`);
}
