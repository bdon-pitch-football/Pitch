'use server';
// Register actions: every move goes through the Postgres functions — the
// app cannot route around fn_set_club_status's authorisation, and there is
// deliberately NO action here that could ever read as a verdict (N10/N11).
// There is also no export, no CSV, no download — not behind a flag (D-122).
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';

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
export async function setStatus(formData: FormData) {
  const registrationId = String(formData.get('registrationId') ?? '');
  const asked = String(formData.get('status') ?? '');
  // The status is a closed set of three and always has been (D-108, N10):
  // anything else is not a value this product can hold, so it is refused
  // rather than coerced.
  const status = (['new', 'shortlisted', 'invited'] as const).find((s) => s === asked);
  if (!status) redirect('/club/register');
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  await db.query(`select fn_set_club_status($1, $2, $3)`, [me, registrationId, status]);
  redirect('/club/register');
}
