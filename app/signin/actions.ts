'use server';
// Sign-in (D-94 §2). The rule is that the response is IDENTICAL whether or
// not the account exists — not that it says nothing. This ended in
// redirect('/home') on every path, success or not, and /home signed out
// renders "Welcome back / One account, whichever seat you hold." So a
// mistyped password looked like an outage, and the product had conflated
// "don't leak existence" with "say nothing".
//
// Now every refusal — wrong password, no such account, an address nobody has
// proved, the rate limit — lands on ONE page with ONE line, the same line for
// every cause (components/FailureState: signInRefused). There is nothing in
// the query, the body or the status to tell the four apart, so the oracle is
// still shut and a person is told the truth.
//
// Dev convenience: an account with no password set signs in on email alone,
// so the fixture logins in the walkthrough keep working. Production requires
// a credential (and swaps this layer for Supabase Auth). Either way the
// address must have been proved (0056): an account nobody has proved signs
// in nowhere, on any path.
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { setSessionPersonId } from '@/lib/session';
import { checkRate } from '@/lib/ratelimit-db';
import { isNewDevice, verifyPassword } from '@/lib/auth';
import { newSignInEmail } from '@/lib/messages';
import { send } from '@/lib/messaging';

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const okIp = await checkRate(`signin:ip:${ip}`, 20, 15 * 60);
  const okId = email ? await checkRate(`signin:id:${email}`, 10, 15 * 60) : true;

  let personId: string | null = null;
  if (email && okIp && okId) {
    if (password) {
      personId = await verifyPassword(email, password);
    } else if (process.env.NODE_ENV !== 'production') {
      // The proof rule holds on this path too (0056, L21): a fixture signs in
      // because its address was proved, not because the suite needs it to.
      const { rows } = await db.query(
        `select p.id from person p left join auth_credential ac on ac.person_id = p.id
         where lower(p.email) = $1 and ac.person_id is null and fn_email_proved(p.id)`,
        [email],
      );
      personId = rows[0]?.id ?? null;
    }
  }

  if (personId) {
    await setSessionPersonId(personId);
    // doc 15 §33 — a sign-in from a device we have not seen. Never an IP,
    // never a city, never a device string.
    const ua = h.get('user-agent') ?? 'unknown';
    if (await isNewDevice(personId, ua)) {
      const { rows } = await db.query(
        `select coalesce(
           (select p2.email from guardianship_link g join person p2 on p2.id = g.guardian_id
            where g.child_id = p.id and g.approved_at is not null and g.revoked_at is null
              and p2.email is not null limit 1),
           -- A parent made at approval has no DOB, which reads as under 16;
           -- they are still the account holder (see lib/auth createReset).
           case when fn_age_band(p.dob) = 'u16'
                 and not (p.dob is null and exists(select 1 from guardianship_link g3
                   where g3.guardian_id = p.id and g3.approved_at is not null and g3.revoked_at is null))
                then null else p.email end) as recipient
         from person p where p.id = $1`,
        [personId],
      );
      const to = rows[0]?.recipient as string | null;
      if (to) {
        const when = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
        await send(newSignInEmail(when), { address: to, personId });
      }
    }
    redirect('/home');
  }
  // One destination for every refusal, reached from four different causes.
  // Never branch this on WHY (D-94 §2, the D-77 oracle rule).
  redirect('/signin?refused=1');
}
