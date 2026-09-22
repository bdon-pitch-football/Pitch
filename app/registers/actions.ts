'use server';
// "Take off this register" (D-108; doc 14 N7). A parent, or a player 16 or
// over for themselves, takes a registration off a club's register. The
// database decides who may (fn_withdraw_registration) and empties the note in
// the same statement. The club is not told why; the row just leaves its list.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { getSessionPersonId } from '@/lib/session';

// Only two places show this control, so only two places are ever returned to.
// This is an ALLOWLIST of the two, which is stricter than lib/safe-path's
// internalPath — that one admits any internal path, this one admits two. No
// control character, absolute URL or dot segment passes it. Do not "unify"
// it with the helper: that would widen it to the whole product.
function backTo(raw: string): string {
  if (raw === '/home') return '/home';
  const m = /^\/g\/controls\/([0-9a-f-]{36})$/.exec(raw);
  return m && isUuid(m[1]) ? raw : '/home';
}

export async function takeOffRegister(formData: FormData) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const registrationId = String(formData.get('registrationId') ?? '');
  const back = backTo(String(formData.get('back') ?? ''));
  if (!isUuid(registrationId)) redirect(back);

  const player = (await db.query(
    `select r.player_id, fn_age_band(p.dob) as band from registration r join person p on p.id = r.player_id where r.id = $1`,
    [registrationId],
  )).rows[0];
  // A player takes their own off only from sixteen; under that, the parent does.
  if (!player || (player.player_id === me && player.band === 'u16')) redirect(back);

  const ok = (await db.query('select fn_withdraw_registration($1, $2) as ok', [me, registrationId])).rows[0]?.ok === true;
  if (ok) {
    await db.query(
      `insert into consent_event (event, actor_id, subject_id, detail)
       values ('registration_withdrawn', $1, $2, jsonb_build_object('registration_id', $3::uuid))`,
      [me, player.player_id, registrationId],
    );
  }
  redirect(`${back}${ok ? '?taken=1' : ''}#readers`);
}
