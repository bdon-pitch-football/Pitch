// A message nobody will send again keeps no words (doc 23: "We do not retain
// message bodies"; John, 1 Oct, §5.1; 0169).
//
// dispatch() empties a row's body and subject the moment the provider has it
// and the moment it is refused for good (lib/messaging). Two kinds of row
// slipped past that:
//   · one the sweep gives up on (safety review of John's batch, S-4, 2 Oct):
//     it claims a row at most six times (app/api/jobs/outbox, attempts < 6),
//     and a sixth transient failure left it unsent and unfailed — never sent,
//     never closed, never cleared — holding a raw share, undo, reset or
//     approval link and a child's first name and age, for good;
//   · one the OLD code sent between 0169 running and the new code going live
//     (S-5): 0169's backfill had already run, and the old dispatch() keeps
//     every body.
//
// So this is the ONE statement that clears them, run in three places that
// must not drift: 0169's backfill (byte for byte, pinned by the permission
// suite), the outbox sweep after every run, and scripts/scrub-sent-bodies.mjs
// for the straight-after-deploy re-run GO-LIVE asks for. Idempotent: a row
// already cleared does not match. A message still to go — queued, or with a
// try left — keeps its words, because they are what will be sent. The
// address stays (John is ruling on addresses).
//
// No framework here, so the permission suite and the script can import it.
export const SCRUB_SENT_BODIES = `update message_outbox
   set body = '', subject = null
 where (sent_at is not null or failed_at is not null or attempts >= 6)
   and (body <> '' or subject is not null)`;

/** How many rows SCRUB_SENT_BODIES would clear: its own predicate, counted. */
export const COUNT_SENT_BODIES = `select count(*)::int as n from message_outbox
${SCRUB_SENT_BODIES.slice(SCRUB_SENT_BODIES.indexOf(' where '))}`;
