'use server';
// The operator's doors onto the curated board (brief I; D-74, D-90, D-64;
// 0130). Every write here is ONE call to a Postgres function that names the
// operator — the same shape as fn_ops_end_td on the call sheet. The action
// checks the operator first (the schema holds no operator identity,
// lib/ops-guard), reads the form, and hands the database the decision: what is
// a duplicate, which clubs may carry a compiled notice, what a notice must
// say, and the audit row. Nothing here writes a table itself, and 0130's wall
// refuses a compiled notice written any other way.
//
// A server action is a public endpoint whether or not its page renders, so
// every one of these checks requireOperator itself, and refuses while the
// screens are held (lib/ops-policy), exactly as the pages 404.
//
// redirect() throws, so it never sits inside the try that catches the
// database's refusal: the try decides an outcome, the redirect follows it.
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireOperator } from '@/lib/ops-guard';
import { clubsScreensShown } from '@/lib/ops-policy';
import { POSITIONS } from '@/lib/football';
import { isUuid } from '@/lib/ids';

async function operator() {
  const op = await requireOperator();
  if (!clubsScreensShown(process.env.NODE_ENV === 'production')) notFound();
  return op;
}

// The database's refusals, by SQLSTATE: 23505 a duplicate listing, 23514 a
// field it will not take. Anything else is a fault, and is thrown.
async function attempt<T>(run: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; code: 'dup' | 'fields' | 'refused' }> {
  try {
    return { ok: true, value: await run() };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === '23505') return { ok: false, code: 'dup' };
    if (code === '23514') return { ok: false, code: 'fields' };
    if (code === '42501' || code === '23503' || code === 'P0002') return { ok: false, code: 'refused' };
    throw e;
  }
}

const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const listing = (f: FormData) =>
  [text(f, 'name'), text(f, 'suburb'), text(f, 'state'), text(f, 'contact') || null, text(f, 'source')];

export async function addClub(formData: FormData) {
  const op = await operator();
  const r = await attempt(async () => (await db.query(
    'select fn_ops_add_club($1, $2, $3, $4, $5, $6, $7) as id',
    [op.personId, op.email, ...listing(formData)])).rows[0].id as string);
  if (!r.ok) redirect(`/ops/clubs/new?error=${r.code}`);
  // Added from a club's own ask (0159): the ask is done.
  const request = text(formData, 'request');
  if (isUuid(request)) await db.query('select fn_ops_club_request_close($1, $2, $3, $4)', [op.personId, op.email, request, 'added']);
  redirect(`/ops/clubs/${r.value}`);
}

// A club's ask that will not be added (0159): not a club, a duplicate under
// another name, or an address that is not the club's own.
export async function dismissClubRequest(formData: FormData) {
  const op = await operator();
  const request = text(formData, 'request');
  if (!isUuid(request)) redirect('/ops/clubs');
  await db.query('select fn_ops_club_request_close($1, $2, $3, $4)', [op.personId, op.email, request, 'dismissed']);
  redirect('/ops/clubs');
}

export async function editClub(formData: FormData) {
  const op = await operator();
  const clubId = text(formData, 'clubId');
  if (!isUuid(clubId)) redirect('/ops/clubs');
  const r = await attempt(() => db.query(
    'select fn_ops_edit_club($1, $2, $3, $4, $5, $6, $7, $8)',
    [op.personId, op.email, clubId, ...listing(formData)]));
  redirect(r.ok ? `/ops/clubs/${clubId}` : `/ops/clubs/${clubId}?error=${r.code}`);
}

export async function removeClub(formData: FormData) {
  const op = await operator();
  const clubId = text(formData, 'clubId');
  if (!isUuid(clubId)) redirect('/ops/clubs');
  const r = await attempt(() => db.query('select fn_ops_remove_club($1, $2, $3)', [op.personId, op.email, clubId]));
  redirect(r.ok ? '/ops/clubs' : `/ops/clubs/${clubId}?error=remove`);
}

// A notice compiled from the club's own public notice (D-90): the club's own
// post-trial fields, plus the address of the notice it came from. Positions
// are read against the ten as the club's form reads them (D-92), and the
// database checks them again.
export async function saveNotice(formData: FormData) {
  const op = await operator();
  const clubId = text(formData, 'clubId');
  const noticeId = text(formData, 'notice_id');
  if (!isUuid(clubId) || (noticeId && !isUuid(noticeId))) redirect('/ops/clubs');
  const back = `/ops/clubs/${clubId}/trial${noticeId ? `?edit=${noticeId}&` : '?'}`;
  const ages = [...new Set(formData.getAll('ages').map((v) => String(v)))];
  const positions = [...new Set(formData.getAll('positions').map((v) => String(v).trim().toUpperCase()))]
    .filter((code) => code in POSITIONS);
  const gender = ['boys', 'girls', 'men', 'women'].includes(text(formData, 'gender')) ? text(formData, 'gender') : null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text(formData, 'trial_on')) ? text(formData, 'trial_on') : null;
  // The same two messages the club's own form gives, before the database is
  // asked; the database refuses the same things whatever this says.
  if (ages.length === 0) redirect(`${back}error=ages`);
  if (!text(formData, 'title') || !date || !text(formData, 'time') || !text(formData, 'ground')) redirect(`${back}error=1`);
  if (!/^https?:\/\/[^\s/]+\.\S+$/.test(text(formData, 'source_url'))) redirect(`${back}error=source`);
  const args = [text(formData, 'title'), ages, gender, date, text(formData, 'time'), text(formData, 'ground'),
    positions, text(formData, 'source_url')];
  const r = await attempt(() => noticeId
    ? db.query('select fn_ops_edit_notice($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [op.personId, op.email, noticeId, ...args])
    : db.query('select fn_ops_add_notice($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [op.personId, op.email, clubId, ...args]));
  if (!r.ok) redirect(`${back}error=${r.code === 'fields' ? '1' : r.code}`);
  redirect(`/ops/clubs/${clubId}`);
}

// "Last checked", re-stamped: one button, the operator named (D-74).
export async function checkNotice(formData: FormData) {
  const op = await operator();
  const clubId = text(formData, 'clubId'), noticeId = text(formData, 'notice_id');
  if (!isUuid(clubId) || !isUuid(noticeId)) redirect('/ops/clubs');
  const r = await attempt(() => db.query('select fn_ops_check_notice($1, $2, $3)', [op.personId, op.email, noticeId]));
  redirect(r.ok ? `/ops/clubs/${clubId}` : `/ops/clubs/${clubId}?error=${r.code}`);
}

export async function removeNotice(formData: FormData) {
  const op = await operator();
  const clubId = text(formData, 'clubId'), noticeId = text(formData, 'notice_id');
  if (!isUuid(clubId) || !isUuid(noticeId)) redirect('/ops/clubs');
  const r = await attempt(() => db.query('select fn_ops_remove_notice($1, $2, $3)', [op.personId, op.email, noticeId]));
  redirect(r.ok ? `/ops/clubs/${clubId}` : `/ops/clubs/${clubId}?error=${r.code}`);
}
