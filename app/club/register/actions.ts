'use server';
// Register actions: every move goes through the Postgres functions — the
// app cannot route around fn_set_club_status's authorisation, and there is
// deliberately NO action here that could ever read as a verdict (N10/N11).
// There is also no export, no CSV, no download — not behind a flag (D-122).
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';

export async function setStatus(registrationId: string, status: 'new' | 'shortlisted' | 'invited') {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  await db.query(`select fn_set_club_status($1, $2, $3)`, [me, registrationId, status]);
  redirect('/club/register');
}
