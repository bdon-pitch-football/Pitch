'use server';
import { redirect } from 'next/navigation';
import { approveInvitation, confirmChannel, endPendingInvitation } from '@/lib/guardian-flow';

//
// FORM FIELDS, NOT bind(). These arrive from a MESSAGE — a parent taps a link
// in an SMS or an email, often landing in an in-app webview — and a bound
// action renders $ACTION_REF_n plus encrypted arguments the client runtime
// has to resolve, so without JavaScript it answers a 500 instead of working.
// This is the single most important write in the product: the moment a
// parent says yes.

// "Yes, it's me — continue" (D-156). The press confirms this link's channel;
// the page load that brought the parent here did not.
export async function confirmIt(formData: FormData) {
  const code = String(formData.get('code') ?? '');
  await confirmChannel(code);
  redirect(`/a/${encodeURIComponent(code)}`);
}

export async function approve(formData: FormData) {
  // Safety review N-3 (1 Oct): the No sits inside this form's markup and
  // reaches its own form through the `form` attribute. A browser that ignored
  // the attribute would post the No HERE — so the No carries answer=end, and
  // a press that says "end" ends, never approves. Nothing else posts it.
  if (formData.get('answer') === 'end') return endRequest(formData);
  const code = String(formData.get('code') ?? '');
  const adultDeclared = formData.get('adult') === 'on';
  if (!adultDeclared) redirect(`/a/${encodeURIComponent(code)}?adult=1`);
  const result = await approveInvitation({ code, adultDeclared });
  // Approved, held (D-155), already-approved, purged and never-existed land
  // on as few destinations as possible, and a hold is indistinguishable from
  // an approval.
  redirect(result ? `/a/${result.invitationId}/done` : '/');
}

// "No, end this request" (D-PD-3). Its own form, posting the code and nothing
// else, after the approve form. Ended: the after-state at a fixed address that
// ignores the code, so nothing on it — or in the address bar — tells an ended
// link from an approved one (D-77). Refused (approved, held, or not a channel
// link): back to /a exactly as it was, with no error
// and nothing that names the reason (John's condition 1). The button renders
// on either channel link, confirmed or not (F15), and never on the invitation
// id — so a refusal means a crafted request, and that person learns nothing
// new. A server action is a POST: opening the link never ends anything.
export async function endRequest(formData: FormData) {
  const code = String(formData.get('code') ?? '');
  const ended = await endPendingInvitation(code);
  redirect(ended ? '/a/closed' : `/a/${encodeURIComponent(code)}`);
}
