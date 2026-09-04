// The guardian consent spine (D-17): the child door creates a PENDING
// INVITATION holding first name + DOB + guardian contact ONLY — no profile,
// no CV, nothing else exists until a guardian approves. Approval is one
// transaction that creates the accounts, the link and the consent-log rows
// together; doc 08's "done" line for foundations is exactly this function.
//
// No message sends from here yet: sending arrives with the Resend/Twilio
// wiring, using doc 15's copy verbatim. If a message is not in doc 15 it
// does not send — and nothing sends at all until then.
import 'server-only';
import { db } from './db';

// doc@version stamps (legal/00-Legal-Register.md): published versions at
// approval time. Bump when the published documents change.
const TOS_VERSION = '22@v1.7';
const PRIVACY_VERSION = '20@v2.4';

export async function createPendingInvitation(input: {
  firstName: string;
  dob: string; // ISO date from the DOB gate
  guardianName: string;
  guardianPhone: string;
  guardianEmail?: string;
}): Promise<{ id: string }> {
  const client = await db.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `insert into pending_invitation (first_name, dob, guardian_name, guardian_phone, guardian_email)
       values ($1,$2,$3,$4,$5) returning id`,
      [input.firstName.trim(), input.dob, input.guardianName.trim(), input.guardianPhone.trim(), input.guardianEmail?.trim() || null],
    );
    await client.query(
      `insert into consent_event (event, detail) values ('invite_created', jsonb_build_object('invitation_id', $1::uuid))`,
      [rows[0].id],
    );
    await client.query('commit');
    return { id: rows[0].id };
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}

export async function getPendingInvitation(id: string) {
  const { rows } = await db.query(
    `select id, first_name, dob, guardian_name, guardian_phone, guardian_email, approved_at, created_at
     from pending_invitation where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// Approval: the guardian's single tap. One transaction (D-17, D-26's
// auditability): guardian person + child person + approved guardianship +
// empty development record + the consent rows that prove it, stamped with
// the doc@version texts in force (D-144).
export async function approveInvitation(input: {
  invitationId: string;
}): Promise<{ childId: string; guardianId: string } | null> {
  const client = await db.connect();
  try {
    await client.query('begin');
    const inv = await client.query(
      `select id, first_name, dob, guardian_name from pending_invitation
       where id = $1 and approved_at is null for update`,
      [input.invitationId],
    );
    if (inv.rows.length === 0) {
      await client.query('rollback');
      return null; // already approved, purged, or never existed — one answer
    }
    const p = inv.rows[0];

    const gName: string = p.guardian_name ?? '';
    const guardian = await client.query(
      `insert into person (first_name, last_name) values ($1,$2) returning id`,
      [gName.split(' ')[0] || 'Guardian', gName.split(' ').slice(1).join(' ') || null],
    );
    const child = await client.query(
      `insert into person (first_name, dob, dob_locked) values ($1,$2,true) returning id`,
      [p.first_name, p.dob],
    );
    const guardianId = guardian.rows[0].id;
    const childId = child.rows[0].id;

    await client.query(
      `insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`,
      [guardianId, childId],
    );
    await client.query(`insert into development_record (person_id) values ($1)`, [childId]);
    await client.query(`update pending_invitation set approved_at = now() where id = $1`, [p.id]);

    // The consent log IS the product's proof. Guardian approval is the ToS
    // acceptance on the child's behalf (CLAUDE.md launch scope).
    const ev = (event: string, policy: string | null) =>
      client.query(
        `insert into consent_event (event, actor_id, subject_id, detail, policy_version)
         values ($1,$2,$3, jsonb_build_object('invitation_id', $4::uuid), $5)`,
        [event, guardianId, childId, p.id, policy],
      );
    await ev('approved', null);
    await ev('tos_accepted', TOS_VERSION);
    await ev('policy_accepted', PRIVACY_VERSION);

    await client.query('commit');
    return { childId, guardianId };
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}
