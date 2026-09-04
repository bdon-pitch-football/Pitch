'use server';
// Claiming a club (ClaimClub.dc.html): claiming gets the page and trial
// notices. Verified status is SEPARATE — a person checks the club against
// Football Victoria's register (D-126); claiming can never set it. The
// email-code proof rides verification_challenge; until Resend lands the
// dev flow completes the claim directly and it appears in the ops queue.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';

export async function claimClub(slug: string, formData: FormData) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const role = String(formData.get('role') ?? '');
  const mapped = role === 'technical_director' ? 'technical_director' : 'club_admin';

  const client = await db.connect();
  try {
    await client.query('begin');
    const club = await client.query(
      `select id, club_state from club where public_slug = $1 for update`,
      [slug],
    );
    if (club.rows.length === 0 || club.rows[0].club_state !== 'unclaimed') {
      await client.query('rollback');
      redirect(`/claim/${slug}?taken=1`);
    }
    await client.query(`update club set club_state = 'claimed' where id = $1`, [club.rows[0].id]);
    await client.query(
      `insert into membership (person_id, club_id, role) values ($1,$2,$3)`,
      [me, club.rows[0].id, mapped],
    );
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  redirect(`/claim/${slug}?claimed=1`);
}
