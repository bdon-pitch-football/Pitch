import 'server-only';
// Switch off the link ONE send created, and leave every other link working
// (D-53: a link is revocable at any time). Used by a guardian on their
// child's controls and by a player 16 or over on their own send screen.
//
// Every argument is hostile (D-94 §3). The token id is checked against the
// send log AS THE ACTOR SEES IT — fn_send_log already returns nothing to
// anyone but the person and their approved guardians — so an id for a link
// that is not yours is indistinguishable from one that does not exist.
// An under-16 does not switch links off themselves: their guardian does,
// the same way their guardian sends (D-91).
import { db } from './db';
import { isUuid } from './ids';

export async function switchOffOneLink(actorId: string, personId: string, tokenId: string): Promise<boolean> {
  if (!isUuid(tokenId) || !isUuid(personId)) return false;
  const client = await db.connect();
  try {
    await client.query('begin');
    if (actorId === personId) {
      const band = (await client.query(`select fn_age_band(dob) as b from person where id = $1`, [personId])).rows[0]?.b;
      if (band === 'u16') { await client.query('rollback'); return false; }
    }
    const row = (await client.query(
      `select club_name from fn_send_log($1, $2) where token_id = $3 and live limit 1`,
      [actorId, personId, tokenId],
    )).rows[0];
    if (!row) { await client.query('rollback'); return false; }
    const done = await client.query(
      `update share_token set revoked_at = now() where id = $1 and revoked_at is null returning id`,
      [tokenId],
    );
    if (done.rows.length === 1) {
      // One append-only row, same vocabulary as Replace, told apart by kind
      // so the timeline can say what actually happened.
      await client.query(
        `insert into consent_event (event, actor_id, subject_id, detail)
         values ('share_revoked', $1, $2, jsonb_build_object('kind', 'one', 'token_id', $3::uuid, 'club_name', $4::text))`,
        [actorId, personId, tokenId, row.club_name ?? null],
      );
    }
    await client.query('commit');
    return done.rows.length === 1;
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}
