'use server';
import { redirect } from 'next/navigation';
import { createHash, randomBytes } from 'node:crypto';
import { approvePendingVersion } from '@/lib/cv-build';
import { db } from '@/lib/db';

export async function approveChange(recordId: string, guardianId: string) {
  await approvePendingVersion(recordId, guardianId);
  redirect(`/g/pending/${recordId}?done=1`);
}

// Share-link issuance (D-53): >=128-bit random token, stored hashed; the raw
// token exists only in the guardian's hands. U16 default expiry 90 days.
export async function issueShareLink(recordId: string, guardianId: string) {
  const raw = randomBytes(24).toString('base64url'); // 192 bits
  await db.query(
    `insert into share_token (record_id, token_hash, issued_by, expires_at)
     values ($1, $2, $3, now() + interval '90 days')`,
    [recordId, createHash('sha256').update(raw).digest(), guardianId],
  );
  await db.query(
    `insert into consent_event (event, actor_id, detail) values ('share_issued', $2, jsonb_build_object('record_id', $1::uuid))`,
    [recordId, guardianId],
  );
  redirect(`/g/pending/${recordId}?done=1&link=${raw}`);
}
