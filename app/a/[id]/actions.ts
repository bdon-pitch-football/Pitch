'use server';
import { redirect } from 'next/navigation';
import { approveInvitation } from '@/lib/guardian-flow';

export async function approve(invitationId: string) {
  const result = await approveInvitation({ invitationId });
  // Approved, already-approved, purged and never-existed all land on the
  // same destination — the answer to a wrong id is never distinguishable.
  redirect(result ? `/a/${invitationId}/done` : '/');
}
