'use server';
// Guardian dispatch (D-99): a fresh token is minted for the send, the
// request is stamped, the consent log carries it. No email leaves yet —
// the Resend wiring sends doc 15's message when it lands; in development
// the link is surfaced for the guardian to pass on however they choose.
// Doing nothing remains a complete answer: an unsent request just sits,
// and nothing chases anyone (D-138).
import { redirect } from 'next/navigation';
import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { cvToClubEmail, sendMadeByOtherGuardianEmail } from '@/lib/messages';
import { send } from '@/lib/messaging';
import { checkRate } from '@/lib/ratelimit-db';
import { SEND_DAILY_CAP } from '@/lib/football';

//
// FORM FIELDS, NOT bind(). A server action passed straight to
// <form action={fn}> is progressively enhanced — Next renders a plain POST
// with a stable action id and it works with no JavaScript. A BOUND one
// renders $ACTION_REF_n plus encrypted arguments only the client runtime can
// resolve, so without JS it returns a 500 rather than degrading, and it
// cannot be exercised by anything that is not a browser.
//
// Moving the id into the form costs nothing in safety: every one of these
// already re-checks its arguments server-side. bind() never made an argument
// trustworthy — the authorisation below did.
export async function dispatchSend(formData: FormData) {
  const requestId = String(formData.get('requestId') ?? '');
  const guardianId = await getSessionPersonId();
  if (!guardianId) redirect('/signin');

  // L41: counted per SENDING ACTOR per day, never per recipient — a
  // per-recipient counter would let one sender learn that somebody else had
  // written to that club.
  //
  // L38/L42: when the limit bites, NOTHING is transmitted and the answer is
  // the same one a real send gives. No counter, no "sends remaining", no
  // greyed button, no error — any surface that reveals limit state is the
  // oracle the identical response exists to close. The link parameter is a
  // development affordance and is not rendered in production, so both paths
  // are the same page.
  const withinLimit = await checkRate(`send:actor:${guardianId}`, SEND_DAILY_CAP, 24 * 60 * 60);
  if (!withinLimit) {
    // U-4 (John): the consent log records what happened, never what was
    // attempted and stopped — a stranger's failed probe is not something
    // that happened to this child. The signal goes to a separate
    // operational store carrying the sender, the time and a reason, and no
    // recipient, no child and no content.
    await db.query(`insert into abuse_signal (actor_id, reason, surface) values ($1,'rate_limited','send')`, [guardianId]);
    redirect(`/g/send/${requestId}?sent=1`);
  }

  const raw = randomBytes(24).toString('base64url');
  const client = await db.connect();
  try {
    await client.query('begin');
    const req = await client.query(
      `select sr.id, sr.record_id, dr.person_id
       from share_request sr
       join development_record dr on dr.id = sr.record_id
       join guardianship_link g on g.child_id = dr.person_id and g.guardian_id = $2
         and g.approved_at is not null and g.revoked_at is null
       where sr.id = $1 and sr.dispatched_at is null
       for update of sr`,
      [requestId, guardianId],
    );
    if (req.rows.length === 0) {
      await client.query('rollback');
      redirect('/home'); // not yours / already sent / never existed — one answer
    }
    const r = req.rows[0];
    const tok = await client.query(
      `insert into share_token (record_id, token_hash, token_hint, issued_by, expires_at)
       values ($1,$2,$3,$4, now() + interval '90 days') returning id`,
      [r.record_id, createHash('sha256').update(raw).digest(), `${raw.slice(0, 4)}·${raw.slice(-4)}`, guardianId],
    );
    await client.query(
      `update share_request set dispatched_by=$2, dispatched_at=now(), share_token_id=$3 where id=$1`,
      [requestId, guardianId, tok.rows[0].id],
    );
    // L2 / L55: exactly one append-only row carrying recipient address,
    // timestamp, sending actor, initiating actor, token id and the band at
    // the moment of sending. The band is recorded rather than derived,
    // because L37 says a historic row stays as written when the player
    // turns 18. A token ID is stored, never the raw token (D-94 §1).
    await client.query(
      `insert into consent_event (event, actor_id, subject_id, detail)
       select 'share_dispatched', $1, $2,
              jsonb_build_object(
                'request_id', $3::uuid,
                'recipient', sr.destination,
                'token_id', $4::uuid,
                'initiating_actor', sr.requested_by,
                'band_at_send', fn_age_band(p.dob))
       from share_request sr
       join development_record dr on dr.id = sr.record_id
       join person p on p.id = dr.person_id
       where sr.id = $3`,
      [guardianId, r.person_id, requestId, tok.rows[0].id],
    );
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }

  // doc 15 §19: the CV lands at the club as a LINK — never a file, never a
  // photograph, never a date of birth, and never the word "trial".
  const d = await db.query(
    `select sr.destination, p.first_name, fn_age_band(p.dob) as band,
       date_part('year', age(p.dob))::int as age,
       dr.positions,
       coalesce((select c.name from membership m join club c on c.id = m.club_id
         where m.person_id = p.id and m.role = 'player' and m.ended_at is null limit 1), '') as club
     from share_request sr
     join development_record dr on dr.id = sr.record_id
     join person p on p.id = dr.person_id
     where sr.id = $1`,
    [requestId],
  );
  const row = d.rows[0];
  if (row) {
    const m = /<(.*)>/.exec(row.destination ?? '');
    const clubAddress = m?.[1] ?? row.destination;
    if (clubAddress) {
      await send(
        cvToClubEmail(row.first_name, row.age, (row.positions ?? []).join(', '), row.club, raw),
        { address: clubAddress },
      );
    }
  }
  // U-2 (John): the OTHER approved guardian is told immediately, and for 24
  // hours can revoke this link with one tap from the notification. Either
  // guardian may send alone — a send that waits for a second adult never
  // goes in a large number of real families — but the more restrictive
  // guardian's wish still prevails, a few minutes later rather than never.
  //
  // Sent AFTER the transaction commits and after the client is released.
  // The dev socket serves one connection; sending inside the transaction
  // would wait on a connection only this code holds.
  const others = await db.query(
    `select p.id, p.email, p.first_name
     from guardianship_link g
     join person p on p.id = g.guardian_id
     join development_record dr on dr.person_id = g.child_id
     join share_request sr on sr.record_id = dr.id
     where sr.id = $1 and g.guardian_id <> $2
       and g.approved_at is not null and g.revoked_at is null
       and p.email is not null`,
    [requestId, guardianId],
  );
  if (others.rows.length > 0) {
    const me = (await db.query(`select first_name from person where id = $1`, [guardianId])).rows[0];
    const child = await db.query(
      `select p.first_name, sr.destination, sr.share_token_id
       from share_request sr
       join development_record dr on dr.id = sr.record_id
       join person p on p.id = dr.person_id
       where sr.id = $1`,
      [requestId],
    );
    for (const other of others.rows as { id: string; email: string; first_name: string }[]) {
      const undoRaw = randomBytes(24).toString('base64url');
      await db.query(
        `insert into undo_token (token_hash, share_token_id, issued_to, expires_at)
         values ($1,$2,$3, now() + interval '24 hours')`,
        [createHash('sha256').update(undoRaw).digest(), child.rows[0].share_token_id, other.id],
      );
      await send(
        sendMadeByOtherGuardianEmail(
          me?.first_name ?? 'The other parent',
          child.rows[0].first_name,
          child.rows[0].destination ?? 'a club',
          undoRaw,
        ),
        { address: other.email, personId: other.id },
      );
    }
  }

  redirect(`/g/send/${requestId}?sent=1&link=${raw}`);
}
