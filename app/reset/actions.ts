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
  const ok = await checkRate(`reset:${ip}`, 10, 60 * 60);

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
