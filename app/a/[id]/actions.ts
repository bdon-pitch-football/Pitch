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
// link from an approved one (D-77). Refused (no confirmed channel, approved,
// held, or not a channel link): back to /a exactly as it was, with no error
// and nothing that names the reason (John's condition 1). The button renders
// only after a channel is confirmed, so a refusal means a crafted request,
// and that person learns nothing new.
export async function endRequest(formData: FormData) {
  const code = String(formData.get('code') ?? '');
  const ended = await endPendingInvitation(code);
  redirect(ended ? '/a/closed' : `/a/${encodeURIComponent(code)}`);
}
