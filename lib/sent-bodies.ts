// A message nobody will send again keeps no words, and after 30 days no
// address (doc 23: "We do not retain message bodies"; John, 1 Oct, §5.1;
// 0169; John, 2 Oct, §3: "Addresses are kept 30 days for support … then
// cleared. The try count stays.").
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
// THE ADDRESS (John, 2 Oct). It stays while support may be asked "did my
// message arrive?" — 30 days from the moment the message stopped being one we
// will send: sent, refused for good, or given up on after its sixth try (its
// last try). Then it is blanked. The row stays, with its key, channel, times,
// provider id, invitation and try count (`attempts`), so receipts still land
// (fn_record_delivery reads none of what goes) and support can still count
// the tries for an invitation (app/ops/support, by invitation once the
// address has gone).
//
// So this is the ONE statement that clears them, run in three places that
// must not drift: 0169's backfill (byte for byte, pinned by the permission
// suite), the outbox sweep after every run, and scripts/scrub-sent-bodies.mjs
// for the straight-after-deploy re-run GO-LIVE asks for. Idempotent: a row
// already cleared does not match. A message still to go — queued, or with a
// try left — keeps its words and its address, because they are what will be
// sent.
//
// No framework here, so the permission suite and the script can import it.

// When a message stopped being one we will send, 30 days ago or more: sent,
// refused for good, or (given up on) its last try.
const ENDED_30_DAYS_AGO = `coalesce(sent_at, failed_at, last_attempt_at, created_at) < now() - interval '30 days'`;
// Nobody will send it again.
const ENDED = `(sent_at is not null or failed_at is not null or attempts >= 6)`;

export const SCRUB_SENT_BODIES = `update message_outbox
   set body = '', subject = null,
       to_address = case when ${ENDED_30_DAYS_AGO} then '' else to_address end
 where ${ENDED}
   and (body <> '' or subject is not null or (to_address <> '' and ${ENDED_30_DAYS_AGO}))`;

/** How many rows SCRUB_SENT_BODIES would clear: its own predicate, counted. */
export const COUNT_SENT_BODIES = `select count(*)::int as n from message_outbox
${SCRUB_SENT_BODIES.slice(SCRUB_SENT_BODIES.indexOf(' where '))}`;

/** Of those, how many still hold an address past its 30 days. */
export const COUNT_STALE_ADDRESSES = `select count(*)::int as n from message_outbox
 where ${ENDED}
   and to_address <> '' and ${ENDED_30_DAYS_AGO}`;
