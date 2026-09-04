'use server';
// Achievements + "other football" (D-72). experience_entry is free text
// with NO club FK and no permission surface — a type chip and text, never
// a taxonomy of school competitions.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { EXPERIENCE_KINDS } from '@/lib/football';

export async function addAchievement(recordId: string, formData: FormData) {
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

export async function removeAchievement(recordId: string, id: string) {
  await db.query(`delete from achievement where id=$1 and record_id=$2`, [id, recordId]);
  redirect(`/build/${recordId}/more`);
}

export async function addExperience(recordId: string, formData: FormData) {
  const kind = String(formData.get('kind') ?? '');
  const orgName = String(formData.get('orgName') ?? '').trim();
  const period = String(formData.get('period') ?? '').trim();
  if ((EXPERIENCE_KINDS as readonly string[]).includes(kind) && orgName) {
    await db.query(
      `insert into experience_entry (record_id, kind, org_name, season_label) values ($1,$2,$3,$4)`,
      [recordId, kind, orgName, period || null],
    );
  }
  redirect(`/build/${recordId}/more`);
}

export async function removeExperience(recordId: string, id: string) {
  await db.query(`delete from experience_entry where id=$1 and record_id=$2`, [id, recordId]);
  redirect(`/build/${recordId}/more`);
}
