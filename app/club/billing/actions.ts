'use server';
// Starting checkout (D-136, D-137). The authority representation is recorded
// on OUR side before anyone reaches Stripe: a name, a role, and the tick.
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { legalStamp } from '@/lib/legal-stamp';
import { getSessionPersonId } from '@/lib/session';
import { billingEnabled, createCheckoutSession, createPortalSession, type PlanKey } from '@/lib/billing';

async function clubFor(personId: string) {
  const { rows } = await db.query(
    `select c.id, c.name, c.stripe_customer_id from club c
     join membership m on m.club_id = c.id and m.person_id = $1
       and m.role in ('technical_director','club_admin') and m.ended_at is null
     limit 1`,
    [personId],
  );
  return rows[0] ?? null;
}

export async function startCheckout(formData: FormData) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  // D-163: a server action is reachable by a POST whether or not the page
  // that renders it is. While billing is off nothing is recorded and nobody
  // is sent anywhere near Stripe.
  if (!(await billingEnabled())) redirect('/home');
  const club = await clubFor(me);
  if (!club) redirect('/home');

  const plan = (String(formData.get('plan') ?? 'register_monthly')) as PlanKey;
  const personName = String(formData.get('personName') ?? '').trim();
  const roleAtClub = String(formData.get('roleAtClub') ?? '').trim();
  const authorised = formData.get('authorised') === 'on';
  if (!personName || !roleAtClub || !authorised) redirect('/club/billing?error=1');

  await db.query(
    `insert into checkout_authority (club_id, person_name, role_at_club, authorised, plan, policy_version)
     values ($1,$2,$3,true,$4,$5)`,
    [club.id, personName, roleAtClub, plan, legalStamp('22')],
  );

  const h = await headers();
  const origin = h.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const session = await createCheckoutSession({ clubId: club.id, plan, origin });
  if ('unconfigured' in session) redirect('/club/billing?unconfigured=1');
  redirect(session.url);
}

export async function openPortal() {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  if (!(await billingEnabled())) redirect('/home');
  const club = await clubFor(me);
  if (!club?.stripe_customer_id) redirect('/club/billing?unconfigured=1');
  const h = await headers();
  const origin = h.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const session = await createPortalSession(club.stripe_customer_id, origin);
  if ('unconfigured' in session) redirect('/club/billing?unconfigured=1');
  redirect(session.url);
}
