'use server';
// Resend an approval request (D-79). The support console may re-send and
// nothing more; the SMS controls in the send layer still apply, so a resend
// cannot be used to hammer a number.
//
// Same defect as the call log: the console page was operator-only and the
// action was not. Anybody reaching the action id could make Pitch text and
// email a named guardian's phone about a named child, once per invitation
// id, without an account. The send layer's caps limited the blast radius;
// they were never the authorisation.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireOperator } from '@/lib/ops-guard';
import { guardianApprovalEmail, guardianApprovalSms } from '@/lib/messages';
import { sendAndLog } from '@/lib/messaging';

//
// Ids come from the FORM, not from bind(). A bound server action renders
// $ACTION_REF_n plus encrypted arguments only the client runtime resolves,
// so it 500s without JavaScript instead of degrading. Every id below was
// already re-checked server-side — bind() never made one trustworthy.
export async function resendApproval(formData: FormData) {
  const invitationId = String(formData.get('invitationId') ?? '');
  await requireOperator();
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
