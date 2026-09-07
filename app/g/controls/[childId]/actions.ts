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

function newToken() {
  const raw = randomBytes(24).toString('base64url');
  return { raw, hash: createHash('sha256').update(raw).digest(), hint: `${raw.slice(0, 4)}·${raw.slice(-4)}` };
}

export async function replaceLink(childId: string, recordId: string) {
  const guardianId = await assertGuardian(childId);
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
export async function renewLink(childId: string, recordId: string) {
  const guardianId = await assertGuardian(childId);
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

export async function setPause(childId: string, paused: boolean) {
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

export async function deleteEverything(childId: string) {
  const guardianId = await assertGuardian(childId);
  const client = await db.connect();
  try {
    await client.query('begin');
    await client.query(
      `insert into consent_event (event, actor_id, subject_id, detail) values ('deletion_requested',$1,$2,'{}')`,
      [guardianId, childId],
    );
    // the record cascades: stats, entries, clips, versions, tokens, requests
    await client.query(`delete from development_record where person_id=$1`, [childId]);
    await client.query(`delete from membership where person_id=$1`, [childId]);
    await client.query(`delete from guardian_setting where child_id=$1`, [childId]);
    await client.query(`update guardianship_link set revoked_at=now() where child_id=$1 and revoked_at is null`, [childId]);
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
