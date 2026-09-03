'use server';

import { redirect } from 'next/navigation';
import { updateByToken } from '@/lib/waitlist-db';
import { ROLES, EMAIL_RE, type Role } from '@/lib/consent';

// /manage allows a change of email or role, with no account, from any device
// (doc 29 §5). The unsub token is the only credential.

export async function updateEntry(formData: FormData) {
  const token = String(formData.get('t') ?? '');
  const email = String(formData.get('email') ?? '').trim();
  const role = String(formData.get('role') ?? '');

  if (!/^[a-f0-9]{16,64}$/.test(token)) redirect('/manage');

  if (email.length > 254 || !EMAIL_RE.test(email) || !ROLES.includes(role as Role)) {
    redirect(`/manage?t=${token}&e=invalid`);
  }

  const result = await updateByToken(token, { email, role });
  if (result === 'duplicate') redirect(`/manage?t=${token}&e=taken`);
  if (result !== 'ok') redirect(`/manage?t=${token}&e=error`);
  redirect(`/manage?t=${token}&saved=1`);
}
