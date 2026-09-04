'use server';
// Resend an approval request (D-79). The support console may re-send and
// nothing more; the SMS controls in the send layer still apply, so a resend
// cannot be used to hammer a number.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { guardianApprovalEmail, guardianApprovalSms } from '@/lib/messages';
import { sendAndLog } from '@/lib/messaging';

export async function resendApproval(invitationId: string) {
  const { rows } = await db.query(
    `select first_name, dob, guardian_phone, guardian_email
     from pending_invitation where id = $1 and approved_at is null`,
    [invitationId],
  );
  const inv = rows[0];
  if (inv) {
    const age = Math.floor((Date.now() - new Date(inv.dob).getTime()) / (365.25 * 24 * 3600 * 1000));
    if (inv.guardian_phone) {
      await sendAndLog(guardianApprovalSms(inv.first_name, age, invitationId), { address: inv.guardian_phone }, 'sms_sent');
    }
    if (inv.guardian_email) {
      await sendAndLog(guardianApprovalEmail(inv.first_name, age, invitationId), { address: inv.guardian_email }, 'email_sent');
    }
  }
  redirect('/ops/support');
}
