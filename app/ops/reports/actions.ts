'use server';
// The operator's report desk (doc 32 A1, A2, A4, A5, C1). Every action here is
// operator-only, checked in the action itself, and records the operator.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { requireOperator } from '@/lib/ops-guard';

const back = (q = '') => redirect(`/ops/reports${q}`);
const text = (f: FormData, k: string, max = 300) => String(f.get(k) ?? '').trim().slice(0, max);

// The record a report points at: a player page is reported by the hex of its
// share token's hash (never the token).
async function recordForReport(reportId: string): Promise<string | null> {
  const r = (await db.query(`select subject_kind, subject_ref from report where id = $1`, [reportId])).rows[0];
  if (!r || r.subject_kind !== 'player_cv' || !/^[0-9a-f]{64}$/.test(r.subject_ref)) return null;
  return (await db.query(`select record_id from share_token where token_hash = decode($1, 'hex')`, [r.subject_ref])).rows[0]?.record_id ?? null;
}

/** A1/C1: hide a player's page while a report is looked at. Nothing is deleted. */
export async function holdRecord(formData: FormData) {
  const op = await requireOperator();
  const reportId = text(formData, 'reportId', 40);
  if (!isUuid(reportId)) back();
  const recordId = await recordForReport(reportId);
  if (!recordId) back('?error=unresolved');
  await db.query(
    `insert into content_hold (record_id, report_id, held_by, reason)
     select $1, $2, $3, $4 where not exists (select 1 from content_hold where record_id = $1 and released_at is null)`,
    [recordId, reportId, op.email, text(formData, 'reason') || 'Report under review'],
  );
  back('?done=held');
}

export async function releaseHold(formData: FormData) {
  await requireOperator();
  const holdId = text(formData, 'holdId', 40);
  if (isUuid(holdId)) await db.query(`update content_hold set released_at = now() where id = $1 and released_at is null`, [holdId]);
  back('?done=released');
}

/** Coach pages are taken down the coach's own way (0043), by the operator. */
export async function hideCoachPage(formData: FormData) {
  await requireOperator();
  const reportId = text(formData, 'reportId', 40);
  const r = isUuid(reportId) ? (await db.query(`select subject_ref from report where id = $1 and subject_kind = 'coach_cv'`, [reportId])).rows[0] : null;
  if (r) await db.query(`update coach_profile set hidden_at = coalesce(hidden_at, now()) where public_slug = $1`, [r.subject_ref]);
  back(r ? '?done=coach' : '?error=unresolved');
}

export async function closeReport(formData: FormData) {
  const op = await requireOperator();
  const reportId = text(formData, 'reportId', 40);
  const outcome = text(formData, 'outcome', 20);
  if (!isUuid(reportId) || !['removed', 'no_action', 'referred'].includes(outcome)) back('?error=outcome');
  await db.query(
    `update report set actioned_at = now(), actioned_by = $2, outcome = $3 where id = $1 and actioned_at is null`,
    [reportId, op.email, outcome],
  );
  back('?done=closed');
}

/** A4: an age-contradiction hold is released (or stays) on a person's call. */
export async function releaseSignupHold(formData: FormData) {
  await requireOperator();
  const personId = text(formData, 'personId', 40);
  if (isUuid(personId)) await db.query(`update person set signup_hold = false where id = $1 and signup_hold`, [personId]);
  back('?done=released');
}

/**
 * A2: one guardian's access. SUPPRESS first — reversible, nothing deleted.
 * Permanent removal only on a court order, and the order is recorded.
 */
export async function suppressGuardian(formData: FormData) {
  const op = await requireOperator();
  const guardianId = text(formData, 'guardianId', 40), childId = text(formData, 'childId', 40);
  const reason = text(formData, 'reason');
  if (!isUuid(guardianId) || !isUuid(childId) || reason.length < 3) back('?error=reason');
  await db.query(
    `update guardianship_link set revoked_at = now(), suppressed_at = now(), suppressed_by = $3, suppressed_reason = $4
     where guardian_id = $1 and child_id = $2 and approved_at is not null and revoked_at is null`,
    [guardianId, childId, op.email, reason],
  );
  back('?done=suppressed');
}

export async function restoreGuardian(formData: FormData) {
  await requireOperator();
  const guardianId = text(formData, 'guardianId', 40), childId = text(formData, 'childId', 40);
  if (isUuid(guardianId) && isUuid(childId)) {
    await db.query(
      `update guardianship_link set revoked_at = null, suppressed_at = null, suppressed_by = null, suppressed_reason = null
       where guardian_id = $1 and child_id = $2 and suppressed_at is not null`,
      [guardianId, childId],
    );
  }
  back('?done=restored');
}

export async function removeGuardianPermanently(formData: FormData) {
  const op = await requireOperator();
  const guardianId = text(formData, 'guardianId', 40), childId = text(formData, 'childId', 40);
  const order = text(formData, 'courtOrder', 120);
  if (!isUuid(guardianId) || !isUuid(childId) || order.length < 4) back('?error=order');
  // The link stays revoked; it simply stops being restorable. The order is
  // recorded as the reason, with who recorded it.
  await db.query(
    `update guardianship_link set suppressed_at = null,
       suppressed_by = $3, suppressed_reason = 'Court order: ' || $4
     where guardian_id = $1 and child_id = $2 and suppressed_at is not null`,
    [guardianId, childId, op.email, order],
  );
  back('?done=removed');
}
