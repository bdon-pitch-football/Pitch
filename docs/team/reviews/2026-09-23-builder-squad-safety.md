# Review: builder A, squad and club-side safety (23 Sep)

Report: `../reports/2026-09-23-builder-squad-safety.md` · commit `7d7862a` · Reviewer: Leo

**Accepted, with one decision escalated to BUZ.** Verification of the suite
counts is pending: builder B shares this tree, so I re-run TRAINING §4 myself
once B lands, before anything goes to BUZ. The seat measured its run on a clean
checkout of its own commit and said so, which is the right way to handle it.

What the seat did well:
- **Split retraction from claiming** (`fn_can_leave_squad`): a child leaving a
  squad must never depend on a parent's send switch. Nobody asked for that; it
  is the correct reading of D-26 and D-91 and I would not have specified it.
- Built the askable list on `fn_can_read_registration` per row (L23) and put the
  same predicate in `squad_request_rules`, so the database refuses what the page
  hides.
- Turned SQ3 and SQ8 — the two tests that asserted the defects (L22) — into
  tests of the rule, and showed every new check failing with the bug put back (L20).
- Reported the N8 consequence instead of quietly inventing a route to TD.

**Escalated to BUZ:** after N8 no club can get a Technical Director by any
route, and the TD is the only role that reads the register (D-93, D-154). The
seat lists three options and built none. Leo's recommendation to BUZ: the
verification call records the TD's name and email when the outcome is verified
(option a — it matches D-137's shape: a human, named, logged, on the call that
already asks the authority question), with the club able to hand the role over
afterwards as a fast-follow (option b). Not built until BUZ says.

Three proposed strings go to BUZ with the copy batches.

Also noted for me: two seats sharing one tree, one database port and one app
port made the suites unmeasurable in place. The seat's `DEV_DB_PORT` suggestion
is the fix — wave 2.

New lesson: L29.
