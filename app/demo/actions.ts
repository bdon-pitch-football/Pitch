'use server';
// One tap, one seat. Demo only (lib/demo): outside a demo this signs nobody in.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { isDemo } from '@/lib/demo';
import { setSessionPersonId } from '@/lib/session';
import { SEATS } from './seats';

export async function takeSeat(formData: FormData) {
  if (!isDemo()) redirect('/signin');
  const seat = SEATS.find((s) => s.key === String(formData.get('seat') ?? ''));
  if (!seat) redirect('/demo');
  const { rows } = await db.query(`select id from person where email = $1`, [seat.email]);
  if (!rows[0]) redirect('/demo');
  await setSessionPersonId(rows[0].id as string);
  redirect('/home');
}
