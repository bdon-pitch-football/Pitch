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
// any other route. HANDOVER lives in the database too (0100): a verified call
// naming somebody else ends the live TD in this same transaction, from the
// call's own trigger, so this action does nothing extra for it.
//
// THE SUSPENSION ALSO CARRIES ITS CLASS, AND THAT IS WHAT TELLS FAMILIES
// (doc 31 M11/L29; doc 15 §37; 0066). This was the only path in the product
// that suspends a club and it wrote `club_state='suspended'` and nothing else,
// so an operator could take a club down for a child-safety reason and every
// family holding a live link to that club learnt nothing — while the message,
// the undo token and the page it lands on had all been written for months.
//
// The mapping from class to "families are told" is John's ruling and it is a
// child-safety judgement, so it is NOT in this file. 0066 wrote it once, as
// fn_suspension_tells_families(class) — the one place BUZ changes it — and
// fn_guardians_to_notify_on_suspension asks it, returning nobody unless the
// club is suspended for a class that function says tells families. This
// action records the class the operator chose, asks the database who must be
// told, and sends to exactly that list (L23). It never revokes a link — the
// family made the disclosure and the family unmakes it, which is the whole of
// John's M11/L29.
import { randomBytes, createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { clubDeverifiedEmail } from '@/lib/messages';
import { send } from '@/lib/messaging';
import { requireOperator } from '@/lib/ops-guard';
import { isUuid } from '@/lib/ids';

// Doc 27's four outcomes, and the two of them that take a club down.
const SUSPENDS = new Set(['suspended', 'takedown']);
// 0025's closed list, repeated here only to refuse a value the form did not
// offer. Which of them tells a family is decided in Postgres, not here.
const SUSPENSION_CLASSES = ['child_safety', 'administrative', 'non_payment'];

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
  // The class of the suspension, recorded at the moment of suspension. A call
  // that did not suspend has none (0066 refuses one anyway), and a value the
  // form did not offer is no value: a missing or unrecognised class records
  // nothing and therefore tells nobody, which is the safe direction. It never
  // blocks the suspension — a safety action must not fail on a form field.
  const rawClass = SUSPENDS.has(outcome) ? f('suspension_reason') : '';
  const suspensionClass = SUSPENSION_CLASSES.includes(rawClass) ? rawClass : null;
  const client = await db.connect();
  try {
    await client.query('begin');
    const call = await client.query(
      `insert into verification_call
         (club_id, called_at, operator, number_called, number_source, answered_by,
          club_confirmed, person_confirmed, incorporated, authority_confirmed,
          outcome, notes, td_name, td_email, suspension_reason, policy_version)
       values ($1, now(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, '27@v1.0')
       returning id`,
      [clubId, f('operator'), f('number_called'), f('number_source'), f('answered_by') || null,
       f('club_confirmed') === 'yes', f('person_confirmed') === 'yes',
       f('incorporated') || 'unknown', f('authority_confirmed') || 'unknown',
       outcome, f('notes') || null,
       tdRecorded ? tdName : null, tdRecorded ? tdEmail : null, suspensionClass],
    );
    if (outcome === 'verified') {
      // The class of the last suspension goes with it. Left behind, it is a
      // stale answer to "why is this club down" sitting on a club that is up
      // — and 0066 reads it.
      await client.query(`update club set club_state='verified', verified_call_id=$2, suspension_reason=null where id=$1`, [clubId, call.rows[0].id]);
    } else if (SUSPENDS.has(outcome)) {
      await client.query(`update club set club_state='suspended', suspension_reason=$2 where id=$1`, [clubId, suspensionClass]);
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }

  // AFTER the transaction and after the client is released (L1): every send
  // below needs its own query, and this block used to be the reason there was
  // nothing here at all.
  //
  // The database decides who is told. An ordinary de-verification, a class the
  // operator did not record, and a club that is not actually suspended all
  // come back as an empty list, so nothing here needs to know which class
  // means what (doc 31 M11/L29, 0066).
  if (SUSPENDS.has(outcome)) {
    const { rows: toTell } = await db.query(
      `select * from fn_guardians_to_notify_on_suspension($1)`, [clubId]);
    for (const g of toTell as {
      guardian_id: string; guardian_email: string; child_first_name: string;
      token_id: string; club_name: string;
    }[]) {
      // The one-tap undo doc 15 §37 points at. Single-purpose, stored hashed,
      // and it can do exactly one thing: switch off the one link it was
      // minted against (0025, /undo/[token]).
      //
      // It lives as long as the link it switches off. §36's undo is a
      // twenty-four-hour window because U-2 says so; §37 has no window in the
      // ruling, and a button that dies before the link does would be a control
      // we promised and withdrew — "we have not switched it off for you" is
      // only honest while the switch still works.
      const undoRaw = randomBytes(24).toString('base64url');
      await db.query(
        `insert into undo_token (token_hash, share_token_id, issued_to, expires_at)
         values ($1, $2, $3,
           coalesce((select expires_at from share_token where id = $2), now() + interval '90 days'))`,
        [createHash('sha256').update(undoRaw).digest(), g.token_id, g.guardian_id],
      );
      await send(
        clubDeverifiedEmail(g.club_name, g.child_first_name, undoRaw),
        { address: g.guardian_email, personId: g.guardian_id },
      );
    }
  }
  redirect('/ops/verification');
}

// Ending a Technical Director's access (D-48, D-93; 0100). The operator's
// door; the club's administrator has the other one, on /club/roles. The
// operator is checked here, first, because the schema holds no operator
// identity (lib/ops-guard) — the same as every fn_ops_* function. The
// database then ends the live role, requires the reason, and writes the
// audit row naming the operator; it leaves everything the TD wrote alone.
// A missing reason goes nowhere: the field is required on the form, and a
// post without one is refused in the database and changes nothing.
export async function endTd(formData: FormData) {
  const op = await requireOperator();
  const clubId = String(formData.get('clubId') ?? '');
  if (!isUuid(clubId)) redirect('/ops/verification');
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 500);
  if (reason.length >= 3) {
    await db.query('select fn_ops_end_td($1, $2, $3, $4)', [op.personId, op.email, clubId, reason]);
  }
  redirect(`/ops/call/${clubId}`);
}
