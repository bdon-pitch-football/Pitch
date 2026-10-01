// The single answer to "may the person holding this session act on this
// record?" — used by every family-facing route that takes a record id from
// the URL (0020).
//
// Deliberately NOT fn_read_level. Reading and acting are different questions:
// a squad coach reads a child's record in full and must never be able to edit
// it, compose a registration on their behalf, or approve their share card.
//
// The failure mode is the same one the link-state page uses (D-77): a record
// that is not yours is indistinguishable from a record that does not exist.
// Both send you home. Neither confirms anything.
import 'server-only';
import { redirect } from 'next/navigation';
import { db } from './db';
import { isUuid } from './ids';
import { getSessionPersonId } from './session';

export type RecordActor = 'self' | 'guardian';

export async function recordActor(recordId: string): Promise<{ personId: string; actor: RecordActor } | null> {
  const personId = await getSessionPersonId();
  if (!personId) return null;
  // A malformed id is not yours, which is the same answer as not existing.
  // Reaching Postgres with it would raise instead of answering.
  if (!isUuid(recordId)) return null;
  const { rows } = await db.query(`select fn_record_actor($1,$2) as actor`, [personId, recordId]);
  const actor = rows[0]?.actor as RecordActor | null;
  return actor ? { personId, actor } : null;
}

/**
 * Require that the session may act on this record, optionally in one specific
 * capacity.
 *
 * Two outcomes, and the split matters:
 *
 *   no session at all      -> /signin, because signing in is the fix
 *   signed in, not yours   -> /home
 *
 * The second answer is IDENTICAL whether the record belongs to someone else
 * or does not exist at all, which is the D-77 rule applied here: a coach who
 * guesses a record id learns nothing either way. What it must not do is
 * bounce an already-signed-in person to a sign-in page — that tells them
 * nothing useful and reads as broken.
 */
export async function requireRecordActor(
  recordId: string,
  allow: RecordActor[] = ['self', 'guardian'],
): Promise<{ personId: string; actor: RecordActor }> {
  // Calls recordActor rather than repeating its query. It used to have its
  // OWN copy of the lookup, so the uuid guard added to recordActor sat on one
  // of two paths and /build/<malformed> still reached Postgres and 500'd —
  // the same shape as the number-hash that was written twice. Two functions
  // answering one question is one of them being wrong later.
  const found = await recordActor(recordId);
  if (!found) {
    // No session is a different destination from "not yours", and that is the
    // only distinction this function is allowed to make.
    if (!(await getSessionPersonId())) redirect('/signin');
    redirect('/home');
  }
  if (!allow.includes(found.actor)) redirect('/home');
  return found;
}

/**
 * Require that the session may WRITE this record: author its page — the
 * build form, its clips, its achievements and other football.
 *
 * Narrower than requireRecordActor, and asked of the database
 * (fn_record_author, 0169): the owner, or an approved guardian of an UNDER-16
 * (N-10; John, 1 Oct). A 16–17's page is theirs. Their guardian holds
 * visibility and the off-switch (D-22, D-51) — the controls, the send log,
 * approving a share card or an invitation reply — and keeps every one of
 * those through requireRecordActor and the functions behind them. Only
 * authorship goes. Same two answers as requireRecordActor: no session goes
 * to /signin, anything else that is not an author goes /home, indistinguishable
 * from a record that does not exist.
 */
export async function requireRecordAuthor(recordId: string): Promise<{ personId: string; actor: RecordActor }> {
  const personId = await getSessionPersonId();
  if (!personId) redirect('/signin');
  const actor = isUuid(recordId)
    ? ((await db.query(`select fn_record_author($1,$2) as actor`, [personId, recordId])).rows[0]?.actor as RecordActor | null)
    : null;
  if (!actor) redirect('/home');
  return { personId, actor };
}
