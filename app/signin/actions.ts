'use server';
// Dev sign-in: email match → session. Identical outcome whether or not the
// account exists (no enumeration): always redirect to /home; /home renders
// a signed-out state when there is no session. Production replaces the
// lookup with Supabase Auth behind the same form.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { setSessionPersonId } from '@/lib/session';

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (email) {
    const { rows } = await db.query(`select id from person where lower(email) = $1`, [email]);
    if (rows[0]) await setSessionPersonId(rows[0].id);
  }
  redirect('/home');
}
