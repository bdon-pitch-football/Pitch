'use server';
// Club video. A LINK, never a file — the video stays on YouTube or Veo and
// the public page renders a click-to-play façade (D-97). The host allowlist
// is the same one the player clips use; anything else is refused rather than
// coerced (D-94 §6).
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { isUuid } from '@/lib/ids';
import { PRESETS, isHex } from '@/lib/club-colours';

const HOSTS = /^(https:\/\/)(www\.|m\.)?(youtube\.com|youtu\.be|instagram\.com|veo\.co|app\.veo\.co)\//i;

async function clubIManage(personId: string): Promise<string | null> {
  const { rows } = await db.query(
    `select c.id from club c
     join membership m on m.club_id = c.id and m.person_id = $1
       and m.role in ('technical_director','club_admin') and m.ended_at is null
     limit 1`,
    [personId],
  );
  return rows[0]?.id ?? null;
}

export async function addClubVideo(formData: FormData) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const clubId = await clubIManage(me);
  if (!clubId) redirect('/home');

  const url = String(formData.get('url') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim().slice(0, 80);
  if (!title || !HOSTS.test(url) || url.length > 400) redirect('/club/page-edit?video=bad');

  const { rows } = await db.query(`select coalesce(max(sort), -1) + 1 as next from club_video where club_id = $1`, [clubId]);
  await db.query(
    `insert into club_video (club_id, url, title, sort, added_by) values ($1,$2,$3,$4,$5)`,
    [clubId, url, title, rows[0].next, me],
  );
  redirect('/club/page-edit?saved=video');
}

//
// Ids come from the FORM, not from bind(). A bound server action renders
// $ACTION_REF_n plus encrypted arguments only the client runtime resolves,
// so it 500s without JavaScript instead of degrading. Every id below was
// already re-checked server-side — bind() never made one trustworthy.
export async function removeClubVideo(formData: FormData) {
  const videoId = String(formData.get('videoId') ?? '');
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const clubId = await clubIManage(me);
  if (!clubId) redirect('/home');
  if (isUuid(videoId)) await db.query(`delete from club_video where id = $1 and club_id = $2`, [videoId, clubId]);
  redirect('/club/page-edit?removed=video');
}

// ---------------------------------------------------------------------------
// The rest of the page (0051, BUZ 19 Sep): the philosophy, pathway line and
// year founded; players-wanted notices; the alumni wall. All club-authored
// free text on a public page — hostile, escaped on output, capped here and
// again in the database. Out-of-range input is refused, never trimmed to fit.
// ---------------------------------------------------------------------------
const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

async function manager(): Promise<{ me: string; clubId: string }> {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const clubId = await clubIManage(me);
  if (!clubId) redirect('/home');
  return { me, clubId };
}

export async function saveClubStory(formData: FormData) {
  const { clubId } = await manager();
  const philosophy = text(formData, 'philosophy');
  const pathway = text(formData, 'pathway');
  const founded = text(formData, 'founded');
  const year = new Date().getFullYear();
  if (philosophy.length > 400 || pathway.length > 80
      || (founded && (!/^(18|19|20)\d{2}$/.test(founded) || Number(founded) > year))) {
    redirect('/club/page-edit?story=bad#story');
  }
  await db.query(
    `update club set philosophy = $2, pathway_line = $3, established = $4 where id = $1`,
    [clubId, philosophy || null, pathway || null, founded || null],
  );
  redirect('/club/page-edit?saved=story#story');
}

export async function addWanted(formData: FormData) {
  const { me, clubId } = await manager();
  const title = text(formData, 'title');
  const detail = text(formData, 'detail');
  if (!title || title.length > 60 || detail.length > 100) redirect('/club/page-edit?wanted=bad#wanted');
  const { rows } = await db.query(`select count(*)::int as n from players_wanted_notice where club_id = $1`, [clubId]);
  if (rows[0].n >= 6) redirect('/club/page-edit?wanted=full#wanted');
  await db.query(
    `insert into players_wanted_notice (club_id, title, detail, added_by) values ($1,$2,$3,$4)`,
    [clubId, title, detail || null, me],
  );
  redirect('/club/page-edit?saved=wanted#wanted');
}

export async function removeWanted(formData: FormData) {
  const { clubId } = await manager();
  const id = text(formData, 'wantedId');
  if (isUuid(id)) await db.query(`delete from players_wanted_notice where id = $1 and club_id = $2`, [id, clubId]);
  redirect('/club/page-edit?removed=wanted#wanted');
}

// The alumni wall never names anyone under 18. We cannot check an age, so the
// person adding the entry confirms it, and that confirmation is stored with
// the entry (0051 refuses an entry without it).
export async function addAlumni(formData: FormData) {
  const { me, clubId } = await manager();
  // Two fields, joined the way the public page splits them: "who → where".
  const who = text(formData, 'who');
  const to = text(formData, 'to');
  const detail = text(formData, 'detail');
  const line = to ? `${who} → ${to}` : who;
  if (formData.get('adults') !== 'yes') redirect('/club/page-edit?alumni=tick#alumni');
  if (!who || who.length > 40 || to.length > 40 || line.length > 80 || detail.length > 80) redirect('/club/page-edit?alumni=bad#alumni');
  const { rows } = await db.query(
    `select count(*)::int as n, coalesce(max(sort), -1) + 1 as next from alumni_entry where club_id = $1`, [clubId]);
  if (rows[0].n >= 12) redirect('/club/page-edit?alumni=full#alumni');
  await db.query(
    `insert into alumni_entry (club_id, line, detail, sort, added_by, adults_confirmed_by, adults_confirmed_at)
     values ($1,$2,$3,$4,$5,$5,now())`,
    [clubId, line, detail || null, rows[0].next, me],
  );
  redirect('/club/page-edit?saved=alumni#alumni');
}

export async function removeAlumni(formData: FormData) {
  const { clubId } = await manager();
  const id = text(formData, 'alumniId');
  if (isUuid(id)) await db.query(`delete from alumni_entry where id = $1 and club_id = $2`, [id, clubId]);
  redirect('/club/page-edit?removed=alumni#alumni');
}

// ---------------------------------------------------------------------------
// Club colours (0160, D-173, BUZ 1 Oct). A preset pair in one tap, or the
// club's own two colours. Out-of-shape input is refused, never coerced. The
// database refuses colours on an unclaimed club; the public page ignores them
// there too (lib/club-colours).
// ---------------------------------------------------------------------------
export async function saveClubColours(formData: FormData) {
  const { clubId } = await manager();
  const choice = text(formData, 'preset');
  let pair: { primary: string; secondary: string } | null = null;
  if (/^\d{1,2}$/.test(choice) && PRESETS[Number(choice)]) {
    const p = PRESETS[Number(choice)];
    pair = { primary: p.primary, secondary: p.secondary };
  } else if (choice === 'custom') {
    const primary = text(formData, 'primary').toLowerCase();
    const secondary = text(formData, 'secondary').toLowerCase();
    if (isHex(primary) && isHex(secondary)) pair = { primary, secondary };
  }
  if (!pair) redirect('/club/page-edit?colours=bad#colours');
  await db.query(
    `update club set colour_primary = $2, colour_secondary = $3 where id = $1 and club_state <> 'unclaimed'`,
    [clubId, pair.primary, pair.secondary],
  );
  redirect('/club/page-edit?saved=colours#colours');
}

export async function clearClubColours() {
  const { clubId } = await manager();
  await db.query(`update club set colour_primary = null, colour_secondary = null where id = $1`, [clubId]);
  redirect('/club/page-edit?removed=colours#colours');
}
