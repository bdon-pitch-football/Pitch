'use server';
// Server actions for the child sign-up door (D-17). Validation is
// server-side; the client is never trusted for age or identity.
import { redirect } from 'next/navigation';
import { createPendingInvitation } from '@/lib/guardian-flow';

const AU_MOBILE = /^04\d{2}\s?\d{3}\s?\d{3}$/;

export async function startPendingInvitation(formData: FormData) {
  const firstName = String(formData.get('firstName') ?? '').trim();
  const dob = String(formData.get('dob') ?? '').trim();
  const guardianName = String(formData.get('guardianName') ?? '').trim();
  const guardianPhone = String(formData.get('guardianPhone') ?? '').trim();
  const guardianEmail = String(formData.get('guardianEmail') ?? '').trim();

  if (!firstName || !dob || !guardianName || !AU_MOBILE.test(guardianPhone)) {
    redirect('/join?error=1');
  }
  const { id } = await createPendingInvitation({
    firstName,
    dob,
    guardianName,
    guardianPhone,
    guardianEmail: guardianEmail || undefined,
  });
  redirect(`/join/waiting/${id}`);
}
