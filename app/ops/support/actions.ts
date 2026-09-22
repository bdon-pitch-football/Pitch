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
import { ageOn } from '@/lib/age';
import { db } from '@/lib/db';
import { requireOperator } from '@/lib/ops-guard';
import { guardianApprovalEmail, guardianApprovalSms, guardianConfirmEmail16, guardianConfirmSms16 } from '@/lib/messages';
import { sendAndLog } from '@/lib/messaging';
import { reissueChannelToken } from '@/lib/guardian-flow';

//
// Ids come from the FORM, not from bind(). A bound server action renders
// $ACTION_REF_n plus encrypted arguments only the client runtime resolves,
// so it 500s without JavaScript instead of degrading. Every id below was
// already re-checked server-side — bind() never made one trustworthy.
export async function resendApproval(formData: FormData) {
  const invitationId = String(formData.get('invitationId') ?? '');
  await requireOperator();
  const { rows } = await db.query(
    `select first_name, dob, guardian_phone, guardian_email, child_id is not null as teen
     from pending_invitation where id = $1 and approved_at is null and held_at is null`,
    [invitationId],
  );
  const inv = rows[0];
  if (inv) {
    const age = ageOn(inv.dob) ?? 0;
    // Each channel gets a fresh link (D-156): tokens are stored hashed, so
    // the old one cannot be re-sent, and it stops working. A channel the
    // parent already confirmed stays confirmed.
    const smsToken = inv.guardian_phone ? await reissueChannelToken(invitationId, 'sms') : null;
    if (smsToken) {
      await sendAndLog((inv.teen ? guardianConfirmSms16 : guardianApprovalSms)(inv.first_name, age, smsToken), { address: inv.guardian_phone }, 'sms_sent');
    }
    const emailToken = inv.guardian_email ? await reissueChannelToken(invitationId, 'email') : null;
    if (emailToken) {
      await sendAndLog((inv.teen ? guardianConfirmEmail16 : guardianApprovalEmail)(inv.first_name, age, emailToken), { address: inv.guardian_email }, 'email_sent');
    }
  }
  redirect('/ops/support');
}
