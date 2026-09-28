'use server';
// Password reset (doc 15 §10 + its amendment). The screen copy never varies:
// "If there's a Pitch account for that address, a reset link is on its way."
// For an under-16 the link goes to the guardian, never the child (D-19).
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { consumeReset, createReset, setPassword } from '@/lib/auth';
import { checkRate } from '@/lib/ratelimit-db';
import { firstPasswordEmail, passwordResetEmail } from '@/lib/messages';
import { send } from '@/lib/messaging';

export async function requestReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  // TWO limits, and the second one is the one that matters here. The IP is
  // read from a header the caller sets, so a cap on it alone caps nobody:
  // QA pressed this 28 times with the header varied and got 24 reset emails
  // to one named person's address in seconds — an email bomb aimed at a real
  // inbox, fired through the transactional sending domain whose reputation
  // is a day-one, lead-time-critical asset (D-81). Sign-in and the join doors
  // have always had a per-identifier cap; this route did not.
  //
  // Three per hour per address, chosen as the more restrictive answer and
  // flagged as a choice (D-94's rule when a security decision is unclear): a
  // reset token lives one hour and issuing one now invalidates the last, so
  // there is no legitimate use for a fourth in the same hour. It matches the
  // three-per-address shape already used on the setup link (/a/[id]/done).
  //
  // The limit is consulted for EVERY address, before anything looks the
  // address up, and the answer below is the same redirect either way — a cap
  // that only engages for real accounts, or that says it engaged, is an
  // account-enumeration oracle (D-94 §2, doc 14 J18).
  const okIp = await checkRate(`reset:ip:${ip}`, 10, 60 * 60);
  const okAddress = email ? await checkRate(`reset:addr:${email}`, 3, 60 * 60) : true;
  const ok = okIp && okAddress;

  if (email && ok) {
    const made = await createReset(email);
    if (made) {
        await send(made.firstPasswordChild ? firstPasswordEmail(made.token, made.firstPasswordChild) : passwordResetEmail(made.token), { address: made.sendTo });
      }
  }
  // Identical either way.
  redirect('/reset?sent=1');
}

//
// Ids come from the FORM, not from bind(). A bound server action renders
// $ACTION_REF_n plus encrypted arguments only the client runtime resolves,
// so it 500s without JavaScript instead of degrading. Every id below was
// already re-checked server-side — bind() never made one trustworthy.
export async function submitNewPassword(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  if (password.length < 10) redirect(`/reset/${token}?short=1`);
  const personId = await consumeReset(token);
  if (!personId) redirect('/reset?expired=1');
  await setPassword(personId, password);
  redirect('/signin?reset=1');
}
