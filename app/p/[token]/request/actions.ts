'use server';
// Request access from the link-state page (D-77, doc 14 C6/C7/C8).
//
// The whole design is in what this action does NOT tell the caller. A dead
// token, a token that never existed, a second request inside 24 hours, and a
// request that was genuinely sent all produce the SAME redirect. Anything
// else is an oracle: "you have already asked" reveals that the first request
// found something, which is precisely what the link-state page exists to
// hide.
//
// C8: the guardian's silence is a complete answer. Nothing here creates a
// state the requester can observe, and nothing schedules a follow-up.
import { redirect } from 'next/navigation';
import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { accessRequestEmail } from '@/lib/messages';
import { send } from '@/lib/messaging';

export async function requestAccess(token: string, formData: FormData) {
  const name = String(formData.get('name') ?? '').trim().slice(0, 80);
  const role = String(formData.get('role') ?? '').trim().slice(0, 120);
  const done = `/p/${token}?asked=1`;
  if (!name || !role) redirect(`/p/${token}?asked=0`);

  // Resolve the token WITHOUT going through the read path — we need the row
  // even when it is dead, which is the one case the read path refuses.
  // Nothing about the record is selected: only the ids needed to notify.
  const { rows } = await db.query(
    `select st.id as token_id, p.first_name,
       (select p2.email from guardianship_link g join person p2 on p2.id = g.guardian_id
        where g.child_id = p.id and g.approved_at is not null and g.revoked_at is null
          and p2.email is not null limit 1) as guardian_email
     from share_token st
     join development_record dr on dr.id = st.record_id
     join person p on p.id = dr.person_id
     where st.token_hash = $1`,
    [createHash('sha256').update(token).digest()],
  );

  const row = rows[0];
  if (!row) redirect(done); // never existed — same answer

  const allowed = (await db.query(`select fn_access_request_allowed($1) as ok`, [row.token_id])).rows[0].ok;
  if (!allowed) redirect(done); // C7: silently accepted, not sent

  await db.query(
    `insert into access_request (share_token_id, requester_name, requester_role) values ($1,$2,$3)`,
    [row.token_id, name, role],
  );
  if (row.guardian_email) {
    await send(accessRequestEmail(row.first_name, name, role), { address: row.guardian_email });
  }
  redirect(done);
}
