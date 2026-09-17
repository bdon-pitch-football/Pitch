'use server';
// "Email me the link" on the page a parent lands on after approving. The
// parent has no password yet (approval creates the account, not a
// credential), so the way in is the password-reset email: doc 15 §10, the
// one message that exists for exactly this. No new message.
//
// The invitation id is all the page has, and it arrived by SMS, so it is
// treated as hostile: the parent is found from the approval's own consent
// row, their address never goes into the page, the answer is the same
// whatever happened, and it is rate-limited like /reset.
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { createReset } from '@/lib/auth';
import { checkRate } from '@/lib/ratelimit-db';
import { firstPasswordEmail, passwordResetEmail } from '@/lib/messages';
import { send } from '@/lib/messaging';

export async function emailSetupLink(formData: FormData) {
  const invitationId = String(formData.get('invitationId') ?? '');
  if (!isUuid(invitationId)) redirect('/');
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const ok = (await checkRate(`setup:${ip}`, 10, 60 * 60)) && (await checkRate(`setup:inv:${invitationId}`, 3, 24 * 60 * 60));
  if (ok) {
    const email = (await db.query(
      `select p.email from consent_event e join person p on p.id = e.actor_id
       where e.event = 'approved' and e.detail->>'invitation_id' = $1 and p.email is not null
       limit 1`, [invitationId])).rows[0]?.email as string | undefined;
    if (email) {
      const made = await createReset(email);
      if (made) {
        await send(made.firstPasswordChild ? firstPasswordEmail(made.token, made.firstPasswordChild) : passwordResetEmail(made.token), { address: made.sendTo });
      }
    }
  }
  redirect(`/a/${invitationId}/done?sent=1`);
}
