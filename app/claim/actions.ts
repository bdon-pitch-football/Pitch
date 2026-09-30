'use server';
// "Tell us your club" (0159). A signed-in adult with a confirmed address asks
// for a club that is not on Pitch; the ask lands in the operator's queue and
// BUZ adds the club after checking the address is the club's own, because the
// claim code will go to it.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';

const text = (f: FormData, k: string, max: number) => String(f.get(k) ?? '').trim().slice(0, max);

export async function askForClub(formData: FormData) {
  const me = await getSessionPersonId();
  const name = text(formData, 'name', 120);
  if (!me) redirect('/signin');
  const suburb = text(formData, 'suburb', 80);
  const state = text(formData, 'state', 3) === 'NSW' ? 'NSW' : 'VIC';
  const email = text(formData, 'email', 254);
  try {
    await db.query('select fn_club_request_add($1, $2, $3, $4, $5)', [me, name, suburb, state, email]);
  } catch (e) {
    const code = (e as { code?: string }).code;
    const why = code === 'unique_violation' ? 'listed' : code === 'insufficient_privilege' ? 'account'
      : /three open/.test(String((e as Error).message)) ? 'many' : 'check';
    redirect(`/claim?asked=${why}&q=${encodeURIComponent(name)}`);
  }
  redirect(`/claim?asked=ok&club=${encodeURIComponent(name)}`);
}
