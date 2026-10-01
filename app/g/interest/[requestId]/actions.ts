'use server';
// Guardian dispatch of a register-interest request: creates the registration
// (disclosed_by = guardian) and stamps the request, one transaction. Doing
// nothing lets the request disappear by itself (D-138). The writes themselves
// are lib/interest-dispatch.ts, which the parent's own door on
// /register-interest uses too (C-P4).
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { dispatchInterestRequest } from '@/lib/interest-dispatch';
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
export async function dispatchInterest(formData: FormData) {
  const requestId = String(formData.get('requestId') ?? '');
  const guardianId = await getSessionPersonId();
  if (!guardianId) redirect('/signin');

  const client = await db.connect();
  try {
    await client.query('begin');
    const done = await dispatchInterestRequest(client, requestId, guardianId);
    if (!done) {
      await client.query('rollback');
      redirect('/home'); // not yours / already sent / never existed — one answer
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  redirect(`/g/interest/${requestId}?sent=1`);
}
