'use server';
import { redirect } from 'next/navigation';
import { approveInvitation } from '@/lib/guardian-flow';

//
// FORM FIELD, NOT bind(). This one arrives from a MESSAGE — a parent taps a
// link in an SMS or an email, often landing in an in-app webview — and a
// bound action renders $ACTION_REF_n plus encrypted arguments the client
// runtime has to resolve, so without JavaScript it answers a 500 instead of
// working. It is the single most important write in the product: the moment
// a parent says yes.
export async function approve(formData: FormData) {
  const invitationId = String(formData.get('invitationId') ?? '');
  const result = await approveInvitation({ invitationId });
  // Approved, already-approved, purged and never-existed all land on the
  // same destination — the answer to a wrong id is never distinguishable.
  redirect(result ? `/a/${invitationId}/done` : '/');
}
