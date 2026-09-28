'use server';
// Achievements + "other football" (D-72). experience_entry is free text
// with NO club FK and no permission surface — a type chip and text, never
// a taxonomy of school competitions.
//
// Every action here checks WHO IS ASKING first. They did not, and the page
// was only closed because it 404'd in production — which is a deploy flag,
// not an authorisation model. A server action stays callable whether or not
// its page renders, so the guard belongs in the action.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { EXPERIENCE_KINDS } from '@/lib/football';
import { requireRecordActor } from '@/lib/record-guard';

//
// Ids come from the FORM, not from bind(). A bound server action renders
// $ACTION_REF_n plus encrypted arguments only the client runtime resolves,
// so it 500s without JavaScript instead of degrading. Every id below was
// already re-checked server-side — bind() never made one trustworthy.
export async function addAchievement(formData: FormData) {
  const recordId = String(formData.get('recordId') ?? '');
  await requireRecordActor(recordId);
  const title = String(formData.get('title') ?? '').trim();
  const detail = String(formData.get('detail') ?? '').trim();
  if (title) {
    await db.query(
      `insert into achievement (record_id, title, detail, sort)
       values ($1,$2,$3,(select coalesce(max(sort)+1,0) from achievement where record_id=$1))`,
      [recordId, title, detail || null],
    );
  }
  redirect(`/build/${recordId}/more`);
}

export async function removeAchievement(formData: FormData) {
  const recordId = String(formData.get('recordId') ?? '');
  const id = String(formData.get('achievementId') ?? '');
  await requireRecordActor(recordId);
  await db.query(`delete from achievement where id=$1 and record_id=$2`, [id, recordId]);
  redirect(`/build/${recordId}/more`);
}

export async function addExperience(formData: FormData) {
  const recordId = String(formData.get('recordId') ?? '');
  await requireRecordActor(recordId);
  const kind = String(formData.get('kind') ?? '');
  // A previous club is an experience entry and nothing more: it is written
  // to the same table, with the same provenance, and it grants access to
  // nobody (D-72). Typing a club's name here does not tell that club, does
  // not create a membership, and does not let them read anything.
  const orgName = String(formData.get('orgName') ?? '').trim();
  const period = String(formData.get('period') ?? '').trim();
  // Which kinds this record may write is the DATABASE's answer, not this
  // action's: no school on an under-18 (D-161, 0061 refuses the insert
  // outright). Asked here so a kind that is not on offer is treated exactly
  // like any other kind that is not on the list — nothing is written, nothing
  // is said — rather than surfacing as an error page on a crafted post.
  const allowed = (await db.query(`select fn_experience_public($1,$2) as ok`, [recordId, kind])).rows[0]?.ok === true;
  if ((EXPERIENCE_KINDS as readonly string[]).includes(kind) && allowed && orgName) {
    await db.query(
      `insert into experience_entry (record_id, kind, org_name, season_label) values ($1,$2,$3,$4)`,
      [recordId, kind, orgName, period || null],
    );
  }
  redirect(`/build/${recordId}/more`);
}

export async function removeExperience(formData: FormData) {
  const recordId = String(formData.get('recordId') ?? '');
  const id = String(formData.get('experienceId') ?? '');
  await requireRecordActor(recordId);
  await db.query(`delete from experience_entry where id=$1 and record_id=$2`, [id, recordId]);
  redirect(`/build/${recordId}/more`);
}
