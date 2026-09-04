'use server';
// The verification call (D-126, D-137, doc 27). The ONLY path to
// club_state='verified': a logged human call carrying operator, timestamp
// and number_source, linked in the same transaction. Outcomes map exactly
// to doc 27: verified · not_verified · suspended · takedown.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';

export async function logCall(clubId: string, formData: FormData) {
  const f = (k: string) => String(formData.get(k) ?? '').trim();
  const outcome = f('outcome');
  const client = await db.connect();
  try {
    await client.query('begin');
    const call = await client.query(
      `insert into verification_call
         (club_id, called_at, operator, number_called, number_source, answered_by,
          club_confirmed, person_confirmed, incorporated, authority_confirmed,
          outcome, notes, policy_version)
       values ($1, now(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, '27@v1.0')
       returning id`,
      [clubId, f('operator'), f('number_called'), f('number_source'), f('answered_by') || null,
       f('club_confirmed') === 'yes', f('person_confirmed') === 'yes',
       f('incorporated') || 'unknown', f('authority_confirmed') || 'unknown',
       outcome, f('notes') || null],
    );
    if (outcome === 'verified') {
      await client.query(`update club set club_state='verified', verified_call_id=$2 where id=$1`, [clubId, call.rows[0].id]);
    } else if (outcome === 'suspended' || outcome === 'takedown') {
      await client.query(`update club set club_state='suspended' where id=$1`, [clubId]);
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  redirect('/ops/verification');
}
