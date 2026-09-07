'use server';
// The guardian's approval of an under-16's edit (D-119), and the share link
// that follows it.
//
// Both of these used to take the guardian's id as an ARGUMENT — a
// client-supplied identity, which D-94 §3 forbids outright: "Never trust a
// client-supplied id, role, age, provenance or club — derive all of them
// server-side from the session and the database." Anyone able to call the
// action could have named themselves the guardian and published a child's
// pending edit. The id now comes from the session and the guard, and the
// parameter is gone so it cannot come back by habit.
import { redirect } from 'next/navigation';
import { createHash, randomBytes } from 'node:crypto';
import { approvePendingVersion } from '@/lib/cv-build';
import { db } from '@/lib/db';
import { requireRecordActor } from '@/lib/record-guard';

export async function approveChange(recordId: string) {
  // Guardian only. A child never approves their own edit, and silence never
  // publishes on its own.
  const { personId } = await requireRecordActor(recordId, ['guardian']);
  await approvePendingVersion(recordId, personId);
  redirect(`/g/pending/${recordId}?done=1`);
}

// Share-link issuance (D-53): >=128-bit random token, stored hashed; the raw
// token exists only in the guardian's hands. U16 default expiry 90 days.
export async function issueShareLink(recordId: string) {
  const { personId } = await requireRecordActor(recordId, ['guardian']);
  const raw = randomBytes(24).toString('base64url'); // 192 bits
  await db.query(
    `insert into share_token (record_id, token_hash, issued_by, expires_at)
     values ($1, $2, $3, now() + interval '90 days')`,
    [recordId, createHash('sha256').update(raw).digest(), personId],
  );
  await db.query(
    `insert into consent_event (event, actor_id, detail) values ('share_issued', $2, jsonb_build_object('record_id', $1::uuid))`,
    [recordId, personId],
  );
  redirect(`/g/pending/${recordId}?done=1&link=${raw}`);
}
