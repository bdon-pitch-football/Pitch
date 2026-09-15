// The ONE path by which a CV reaches a club (D-99).
//
// This used to live inside the guardian's action, which meant it was the only
// way anything was ever sent — so a 16-17 or an adult pressing "send" had no
// path at all. fn_can_dispatch has permitted both since 0021, and doc 14 L5
// and L8 have been green in Postgres the whole time; the product simply never
// called it for anyone but a guardian. Every sender goes through here now, and
// Postgres — not the caller — decides whether this actor may send this record:
// the request is only picked up if fn_can_dispatch says yes, and the triggers
// on share_request and share_token refuse the row otherwise.
//
// Returns null for every way a send can fail to happen: not yours, already
// sent, never existed, not permitted. One answer, deliberately.
import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { db } from './db';
import { childSentCvEmail, cvSentToPlayerEmail, cvToClubEmail, sendMadeByOtherGuardianEmail } from './messages';
import { send } from './messaging';

type Band = 'u16' | '16_17' | '18plus';

export async function dispatchShareRequest(requestId: string, actorId: string): Promise<{ raw: string; band: Band } | null> {
  const raw = randomBytes(24).toString('base64url');
  let personId = '';
  let band: Band = 'u16';
  const client = await db.connect();
  try {
    await client.query('begin');
    // L20: standing is re-checked HERE, at dispatch, never carried from the
    // moment a request was composed or approved. The band is the band now (G1).
    const req = await client.query(
      `select sr.id, sr.record_id, dr.person_id, fn_age_band(p.dob) as band
       from share_request sr
       join development_record dr on dr.id = sr.record_id
       join person p on p.id = dr.person_id
       where sr.id = $1 and sr.dispatched_at is null
         and fn_can_dispatch($2, sr.record_id)
       for update of sr`,
      [requestId, actorId],
    );
    if (req.rows.length === 0) {
      await client.query('rollback');
      return null;
    }
    const r = req.rows[0];
    personId = r.person_id;
    band = r.band;
    const tok = await client.query(
      `insert into share_token (record_id, token_hash, token_hint, issued_by, expires_at)
       values ($1,$2,$3,$4, now() + interval '90 days') returning id`,
      [r.record_id, createHash('sha256').update(raw).digest(), `${raw.slice(0, 4)}·${raw.slice(-4)}`, actorId],
    );
    await client.query(
      `update share_request set dispatched_by=$2, dispatched_at=now(), share_token_id=$3 where id=$1`,
      [requestId, actorId, tok.rows[0].id],
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
      [actorId, r.person_id, requestId, tok.rows[0].id],
    );
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }

  // Everything below is sent AFTER the transaction commits and after the
  // client is released. The dev socket serves one connection; sending inside
  // the transaction would wait on a connection only this code holds.
  const d = await db.query(
    `select sr.destination, p.first_name, p.email,
       date_part('year', age(p.dob))::int as age, dr.positions,
       coalesce((select c.name from membership m join club c on c.id = m.club_id
         where m.person_id = p.id and m.role = 'player' and m.ended_at is null limit 1), '') as club
     from share_request sr
     join development_record dr on dr.id = sr.record_id
     join person p on p.id = dr.person_id
     where sr.id = $1`,
    [requestId],
  );
  const row = d.rows[0];
  if (!row) return { raw, band };
  const clubName = /^(.*) </.exec(row.destination ?? '')?.[1] ?? 'the club';
  const clubAddress = /<(.*)>/.exec(row.destination ?? '')?.[1] ?? row.destination;
  const selfSend = actorId === personId;

  // doc 15 §19: the CV lands at the club as a LINK — never a file, never a
  // photograph, never a date of birth, and never the word "trial".
  if (clubAddress) {
    await send(
      cvToClubEmail(row.first_name, row.age, (row.positions ?? []).join(', '), row.club, raw,
        selfSend ? 'self' : 'family', band),
      { address: clubAddress },
    );
  }

  if (selfSend) {
    // doc 15 §21: the receipt goes to the player who pressed send, and says
    // plainly that the club cannot reply — who hears from a club follows the
    // band (John, U-11).
    if (row.email) {
      await send(cvSentToPlayerEmail(clubName, band), { address: row.email, personId });
    }
    // doc 15 §22 / doc 14 L5: a 16-17's guardians are told on EVERY send, one
    // message per send per guardian — no digest, no batching, no roll-up.
    if (band === '16_17') {
      const guardians = await db.query(
        `select p.id, p.email from guardianship_link g join person p on p.id = g.guardian_id
         where g.child_id = $1 and g.approved_at is not null and g.revoked_at is null and p.email is not null`,
        [personId],
      );
      for (const g of guardians.rows as { id: string; email: string }[]) {
        await send(childSentCvEmail(row.first_name, clubName, clubAddress, personId), { address: g.email, personId: g.id });
      }
    }
    return { raw, band };
  }

  // U-2 (John): the OTHER approved guardian is told immediately, and for 24
  // hours can revoke this link with one tap from the notification. Either
  // guardian may send alone — a send that waits for a second adult never
  // goes in a large number of real families — but the more restrictive
  // guardian's wish still prevails, a few minutes later rather than never.
  const others = await db.query(
    `select p.id, p.email, p.first_name
     from guardianship_link g
     join person p on p.id = g.guardian_id
     join development_record dr on dr.person_id = g.child_id
     join share_request sr on sr.record_id = dr.id
     where sr.id = $1 and g.guardian_id <> $2
       and g.approved_at is not null and g.revoked_at is null
       and p.email is not null`,
    [requestId, actorId],
  );
  if (others.rows.length > 0) {
    const me = (await db.query(`select first_name from person where id = $1`, [actorId])).rows[0];
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
  return { raw, band };
}
