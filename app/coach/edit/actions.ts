'use server';
// Coach CV editing (D-75). The profile publishes without WWCC — verification
// is what unlocks anything to do with players, and it is free on every tier.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { COACH_CLIP_CAP } from '@/lib/football';

export async function saveCoachProfile(formData: FormData) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const region = String(formData.get('region') ?? '').trim();
  const philosophy = String(formData.get('philosophy') ?? '').trim();
  const badges = String(formData.get('badges') ?? '').split('|').map((b) => b.trim()).filter(Boolean);
  // The coach's OWN address, published by their own choice. Rendered to
  // clubs and adults, absent for a signed-in minor (0027). This is not Pitch
  // handing over somebody else's details, which stays forbidden (D-100).
  const contact = String(formData.get('publicContact') ?? '').trim().slice(0, 120);
  await db.query(
    `insert into coach_profile (person_id, region, philosophy, badges, public_contact)
     values ($1,$2,$3,$4,$5)
     on conflict (person_id) do update set region=$2, philosophy=$3, badges=$4, public_contact=$5`,
    [me, region || null, philosophy || null, badges, contact || null],
  );
  redirect('/coach/edit?saved=1');
}

export async function addRole(formData: FormData) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const title = String(formData.get('title') ?? '').trim();
  const org = String(formData.get('org') ?? '').trim();
  const from = String(formData.get('from') ?? '').trim();
  const to = String(formData.get('to') ?? '').trim();
  if (title && org) {
    await db.query(
      `insert into coach_role (coach_profile_id, title, org_name, started_year, ended_year, sort)
       select cp.id, $2, $3, $4, $5, coalesce((select max(sort)+1 from coach_role where coach_profile_id = cp.id), 0)
       from coach_profile cp where cp.person_id = $1`,
      [me, title, org, from || null, to || null],
    );
  }
  redirect('/coach/edit');
}

export async function removeRole(roleId: string) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  await db.query(
    `delete from coach_role cr using coach_profile cp
     where cr.id = $1 and cr.coach_profile_id = cp.id and cp.person_id = $2`,
    [roleId, me],
  );
  redirect('/coach/edit');
}

// ---------------------------------------------------------------------------
// Clips (0019). A LINK, never a file — the same decision as club video, the
// same allowlist, the same click-to-play façade (D-97). Capped at five: a
// coach reel is a shortlist, not an archive.
// ---------------------------------------------------------------------------
const CLIP_HOSTS = /^(https:\/\/)(www\.)?(youtube\.com|youtu\.be|instagram\.com|veo\.co|app\.veo\.co)\//i;

export async function addCoachClip(formData: FormData) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const { rows } = await db.query(`select id from coach_profile where person_id = $1`, [me]);
  if (rows.length === 0) redirect('/coach/edit?clip=noprofile');
  const profileId = rows[0].id as string;

  const url = String(formData.get('url') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim().slice(0, 80);
  if (!title || !CLIP_HOSTS.test(url) || url.length > 400) redirect('/coach/edit?clip=bad');

  // The cap is checked server-side. A form that hides the button is a
  // courtesy; this is the rule.
  const { rows: n } = await db.query(
    `select count(*)::int as c, coalesce(max(sort), -1) + 1 as next from coach_clip where coach_profile_id = $1`,
    [profileId],
  );
  if (n[0].c >= COACH_CLIP_CAP) redirect('/coach/edit?clip=full');

  await db.query(
    `insert into coach_clip (coach_profile_id, url, title, sort) values ($1,$2,$3,$4)`,
    [profileId, url, title, n[0].next],
  );
  redirect('/coach/edit?saved=clip');
}

export async function removeCoachClip(clipId: string) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  await db.query(
    `delete from coach_clip where id = $1 and coach_profile_id in
       (select id from coach_profile where person_id = $2)`,
    [clipId, me],
  );
  redirect('/coach/edit?removed=clip');
}

// ---------------------------------------------------------------------------
// Applying for a coaching role (0019). 18+ and a coach profile, both checked
// in Postgres so the app cannot route around either.
// ---------------------------------------------------------------------------
export async function applyForRole(roleId: string, formData: FormData) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const ok = await db.query(`select fn_can_apply_for_role($1) as ok`, [me]);
  if (!ok.rows[0].ok) redirect(`/jobs/${roleId}?cannot=1`);

  const message = String(formData.get('message') ?? '').trim().slice(0, 1200);
  const open = await db.query(
    `select 1 from coaching_role where id = $1 and closed_at is null
       and (closes_on is null or closes_on >= (now() at time zone 'Australia/Melbourne')::date)`,
    [roleId],
  );
  if (open.rows.length === 0) redirect(`/jobs/${roleId}?closed=1`);

  await db.query(
    `insert into role_application (role_id, coach_id, message) values ($1,$2,$3)
     on conflict (role_id, coach_id) do nothing`,
    [roleId, me, message || null],
  );
  redirect(`/jobs/${roleId}?applied=1`);
}
