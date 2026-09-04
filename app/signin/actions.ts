'use server';
// Dev sign-in: email match → session. Identical outcome whether or not the
// account exists (no enumeration): always redirect to /home; /home renders
// a signed-out state when there is no session. Production replaces the
// lookup with Supabase Auth behind the same form.
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { setSessionPersonId } from '@/lib/session';
import { checkRate } from '@/lib/ratelimit-db';

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  // Limit by IP and by identifier (D-94 §2). Whatever happens, the outcome
  // below is identical — a limit message would be an enumeration oracle.
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const okIp = await checkRate(`signin:ip:${ip}`, 20, 15 * 60);
  const okId = email ? await checkRate(`signin:id:${email}`, 10, 15 * 60) : true;

  if (email && okIp && okId) {
    const { rows } = await db.query(`select id from person where lower(email) = $1`, [email]);
    if (rows[0]) await setSessionPersonId(rows[0].id);
  }
  redirect('/home');
}
