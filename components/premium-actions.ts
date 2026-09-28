'use server';
// A tap on a locked Premium row (D-164 (4), 0081). The database counts it —
// one anonymous tap for that feature, and only if the person pressing is an
// adult — and keeps nothing about who pressed. Nothing here logs the person,
// the session or the address either: the id is read to ask the age question
// and goes no further.
//
// Where the press lands is decided here from what the form says it was on,
// never from a path the client supplies (lib/safe-path's reason, D-94 §3).
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';

export async function tapPremium(formData: FormData) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const feature = String(formData.get('feature') ?? '');
  const on = String(formData.get('on') ?? '');
  await db.query('select fn_premium_interest($1, $2)', [me, feature]);
  if (on === 'clips') {
    const rec = (await db.query('select id from development_record where person_id = $1', [me])).rows[0]?.id as string | undefined;
    redirect(rec ? `/build/${rec}/clips?first=1` : '/home');
  }
  redirect(on === 'coach' ? '/coach/edit?first=1' : '/home');
}
