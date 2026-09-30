'use server';
// The club's "stop them" (doc 15 §19; John, 30 Sep §2). No account: the link
// in the CV email is the authority, and its signature is what makes it one
// (lib/stop-cvs). The database does the stopping (fn_send_stop_request, 0160).
//
// Every outcome lands on the same done screen — a good link, a bad one, one
// the rate limit held — so this form tells nobody which request ids are real
// or which addresses were already stopped.
//
// Ids come from the FORM, not from bind(), so it works with no JavaScript
// (the same reason as app/send/[recordId]/actions.ts).
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { checkRate } from '@/lib/ratelimit-db';
import { stopCvsValid } from '@/lib/stop-cvs';

export async function stopCvs(formData: FormData) {
  const requestId = String(formData.get('r') ?? '').trim();
  const sig = String(formData.get('t') ?? '').trim();
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const allowed = await checkRate(`stop-cvs:ip:${ip}`, 20, 60 * 60);
  if (allowed && stopCvsValid(requestId, sig)) {
    await db.query('select fn_send_stop_request($1)', [requestId.toLowerCase()]);
  }
  redirect('/stop-cvs?done=1');
}
