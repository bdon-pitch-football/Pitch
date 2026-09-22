# Lessons — read before every task

Every entry is something that actually went wrong on this codebase, what the
rule is now, and how to check for it. Newest last. Leo adds to this after every
review; nobody deletes from it. Where a lesson became a check in the suite,
it says which.

---

**L1 · Don't hold the database while you do something else (20 Sep).**
Confirming a squad claim held a `db.connect()` client, then sent an email that
needed its own query. The dev pool has one connection, so it waited on itself
forever and every later request queued behind it.
*Rule:* inside a `db.connect()` block, only `client.query`. Emails, other
queries and redirects happen after `client.release()`.
*Check:* read every `db.connect()` you touch down to its `finally`.

**L2 · Gate everything that comes off the record, not just the record id (20 Sep).**
The first squad list hid the record id from a club administrator but still
returned positions and squad numbers — both off the development record, which
D-93 gives an administrator none of.
*Rule:* every field sourced from `development_record`, `player_stat`,
`highlight` or `profile_version` is gated by the same answer as the record id.
*Check:* permission suite SQ6b.

**L3 · The console shell lays its children in a row (21 Sep).**
Build your CV handed the shell two blocks; on a 390px phone the page was 444px
wide and the form started 54px off the left edge. A content capture found it,
not us.
*Rule:* hand the shell one block. The shell now stacks below 1024px anyway.
*Check:* `node scripts/layout-check.mjs 375 1280` on any change to a page's
structure. Permission suite shell1–3.

**L4 · A test label is a claim (20 Sep).**
Doc 14 row H6 was counted as covered by a check labelled "H6" that actually
tested H4. Gate coverage said 261/261 and one of them was false.
*Rule:* a label starting with a doc 14 row id must test that row, as doc 14
words it. When in doubt, no row id.
*Check:* when you add a labelled check, read the row in `docs/14-Permission-Tests.md`.

**L5 · One event, one meaning (20 Sep).**
Squad changes were written as `outside_contact_logged`, the event for a
stranger approaching a child. An audit log where one word means two things
cannot answer "what happened".
*Rule:* new kinds of event get their own word in the consent-event vocabulary,
added by migration. Permission suite C3/C4 counts writers.

**L6 · A `[recordId]` route is a family surface (20 Sep).**
Anything under a `[recordId]` path must call `requireRecordActor`. A club-side
page keyed by a record id tripped the rule; the fix was to key it by the player
(as the register keys by registration), not to weaken the check.
*Check:* permission suite act11.

**L7 · Reseed before you trust a failure (standing).**
The write suite mutates the database. Running it twice, or running render after
it, produces failures that are not bugs.
*Rule:* reseed → perms → render → write → reseed.

**L8 · Stop the dev database by port, never by name (20 Sep).**
`pkill -f dev-db.mts` also killed the club demo's database — the same command
line — mid-demo.
*Rule:* `kill $(lsof -ti :54322 -sTCP:LISTEN)` for dev; the demo is 54323.

**L9 · Renaming a route folder needs a dev-server restart (20 Sep).**
After renaming `[recordId]` to `[playerId]` the running server kept the old
route list and 404'd every page under it ("different slug names for the same
dynamic path").
*Rule:* restart the preview after any route rename, then check the page.

**L10 · Client-component forms can't be posted from a script (21 Sep).**
`/join` is a client page; its server-action ids are not in the HTML. A fetch
test posts to nothing and reports nothing.
*Rule:* test client-page forms in the browser. Server-rendered forms: use the
form's own hidden fields, merged as `{ ...form.fields, ...extra }` (a duplicate
key sends the first value).

**L11 · Scope page-text assertions to a section (20 Sep).**
A removed player reappears lower down as someone the club may ask. "Their name
is on the page" was true and meaningless.
*Rule:* slice the page from one heading to the next before asserting.

**L12 · A stranger's no-op must look like success (20 Sep).**
Answering someone else's invitation redirects exactly as a real answer does
(D-77) — so a test that checks the redirect learns nothing.
*Rule:* assert on the state (the invitation is still open), not the response.

**L13 · Seed data proves nothing about production (20 Sep).**
Every CV in the demo showed a current club, because the seed wrote club
memberships. Nothing in the product could — so no real player's CV would ever
have shown one.
*Rule:* for anything a page shows, ask "what writes this in production?" and
find the code. If only the seed writes it, it is a gap.

**L14 · The demo keeps the database it started with (21 Sep).**
After a migration, the running demo still has the old schema.
*Rule:* restart the demo after any migration before anyone opens it.

**L15 · Never use a real club's name as fictional data (20 Sep).**
Two "former clubs" chosen for demo players could have belonged to real clubs.
*Rule:* use names already in the seed (Riverside FC, Kingsway Rovers FC,
Northern United SC, Westgate Rangers, Sunbury United, Coburg City FC,
Brunswick Juniors SC) or ask.

**L16 · Read what a public page actually serves (17 Sep).**
The legal pages render their markdown as-is, internal drafting notes and all.
*Rule:* for any rendered document, read the served page, not the source file.

**L17 · Every string a person sees goes to BUZ, verbatim (standing).**
Including error messages, empty states and button labels.

**L18 · Dates in en-AU say "Sept" (20 Sep).**
The product writes "Sep". Normalise.

**L19 · A check that cannot fail is not a check (22 Sep).**
The first layout check measured the page against `window.innerWidth`, which a
phone browser widens to fit an overflowing page — so nothing could ever look
too wide. It reported all green. Its own self-test caught it.
*Rule:* every new check proves it can fail before it is trusted.

**L20 · Prove a regression check on the old code (standing).**
*Rule:* put the bug back, watch the check fail, restore. The layout check was
proven this way on 22 Sep against the 21 Sep overflow.
