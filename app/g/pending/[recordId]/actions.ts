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
import { requireRecordActor, requireRecordAuthor } from '@/lib/record-guard';

//
// FORM FIELDS, NOT bind(). A server action passed straight to
// <form action={fn}> is progressively enhanced — Next renders a plain POST
// with a stable action id and it works with no JavaScript. A BOUND one
// renders $ACTION_REF_n plus encrypted arguments only the client runtime can
// resolve, so without JS it returns a 500 rather than degrading, and it
// cannot be exercised by anything that is not a browser.
//
// Moving the id into the form costs nothing in safety: every one of these
// already re-checks its arguments server-side. bind() never made an argument
// trustworthy — the authorisation below did.
export async function approveChange(formData: FormData) {
  const recordId = String(formData.get('recordId') ?? '');
  // Guardian only. A child never approves their own edit, and silence never
  // publishes on its own.
  const { personId } = await requireRecordActor(recordId, ['guardian']);
  // EXACTLY the version the page drew (BUZ, 2 Oct; spec D): its id and a
  // hash of its content ride in the form. If the child changed it since the
  // page was rendered, nothing publishes and the parent is back on the
  // review, which now draws the version that waits — no new words.
  const approved = await approvePendingVersion(recordId, personId, String(formData.get('version') ?? ''));
  redirect(approved ? `/g/pending/${recordId}?done=1` : `/g/pending/${recordId}`);
}

// Share-link issuance (D-53): >=128-bit random token, stored hashed; the raw
// token exists only in the guardian's hands. U16 default expiry 90 days.
//
// An under-16's guardian only, asked of the database (fn_record_author, 0169):
// for a 16–17 the player shares and the guardian sees (John, 2 Oct, §5, the
// principle of N-10; doc 14 E15). Their guardian keeps everything else
// requireRecordActor gives them — this page, approving, the controls, the
// off-switch — and loses only this press. A refused press goes home and
// writes nothing, exactly as a stranger's does (D-77).
export async function issueShareLink(formData: FormData) {
  const recordId = String(formData.get('recordId') ?? '');
  const { personId, actor } = await requireRecordAuthor(recordId);
  if (actor !== 'guardian') redirect('/home');
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
