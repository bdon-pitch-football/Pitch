'use server';
// The verification call (D-126, D-137, doc 27). The ONLY path to
// club_state='verified': a logged human call carrying operator, timestamp
// and number_source, linked in the same transaction. Outcomes map exactly
// to doc 27: verified · not_verified · suspended · takedown.
//
// The gate was on the PAGE and not on the action. A server action exported
// from a 'use server' module is a public endpoint whether or not its page
// renders, so /ops/call/[clubId] being operator-only bought nothing: anybody
// who could reach the action id could set club_state='verified' on any club
// in the country — which is the single most powerful write in the product,
// because verification is what turns a paying club's register from a count
// into named children (D-126). The table check only requires that a call row
// exists, and a forged call writes one.
//
// The call also records the club's Technical Director — name and address,
// captured at the same moment as a `verified` outcome (BUZ, 23 Sep; D-93's
// "granted by the club and confirmed at club verification"; D-137's named,
// timestamped human). Recording is all this action does: 0058 decides when
// the role attaches, and refuses a `technical_director` membership written by
// any other route. HANDOVER — changing a club's TD, or taking one off — is
// NOT here and is not anywhere yet: BUZ has it as a fast-follow. A later call
// naming someone else records that person; it does not end the first one.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireOperator } from '@/lib/ops-guard';

//
// Ids come from the FORM, not from bind(). A bound server action renders
// $ACTION_REF_n plus encrypted arguments only the client runtime resolves,
// so it 500s without JavaScript instead of degrading. Every id below was
// already re-checked server-side — bind() never made one trustworthy.
export async function logCall(formData: FormData) {
  const clubId = String(formData.get('clubId') ?? '');
  await requireOperator();
  const f = (k: string) => String(formData.get(k) ?? '').trim();
  const outcome = f('outcome');
  // A call that did not verify the club confirms nobody's role either, so the
  // two fields are dropped rather than stored against it (the table refuses
  // them anyway — 0058).
  const tdName = outcome === 'verified' ? f('td_name') : '';
  const tdEmail = outcome === 'verified' ? f('td_email').toLowerCase() : '';
  const tdRecorded = tdName !== '' && tdEmail.includes('@');
  const client = await db.connect();
  try {
    await client.query('begin');
    const call = await client.query(
      `insert into verification_call
         (club_id, called_at, operator, number_called, number_source, answered_by,
          club_confirmed, person_confirmed, incorporated, authority_confirmed,
          outcome, notes, td_name, td_email, policy_version)
       values ($1, now(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, '27@v1.0')
       returning id`,
      [clubId, f('operator'), f('number_called'), f('number_source'), f('answered_by') || null,
       f('club_confirmed') === 'yes', f('person_confirmed') === 'yes',
       f('incorporated') || 'unknown', f('authority_confirmed') || 'unknown',
       outcome, f('notes') || null,
       tdRecorded ? tdName : null, tdRecorded ? tdEmail : null],
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
