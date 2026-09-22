# Review: builder D, Technical Director on the call (23 Sep)

Report: `../reports/2026-09-23-builder-td-on-call.md` · branch
`worktree-agent-af83a872cd5bec212`, commit `49c6497` · Reviewer: Leo

**Accepted. Merge held until after BUZ's Balmoral meeting (24 Sep)** — not
because of any doubt about the work, but because the club demo BUZ is walking
tomorrow is seeded against `app` as it stands, and this changes how a club gets
a TD. It merges the moment the meeting is done, with a demo re-run behind it.

What the seat did well:
- **Chose triggers over a sign-in check**, and said why: the register would
  otherwise switch on when somebody last opened a browser. Recorded → active is
  driven by the two facts that matter (the club became verified; the address
  became proved), wherever they happen.
- **Left no exceptions**: the migration ends any pre-existing `technical_director`
  row the new path would not have written, so the rule is true of the data as
  well as of future writes.
- **Fixed the seed and the permission fixtures** rather than letting them bypass
  the rule — the thing L13 and N-new-1 warned about, done without being asked.
- **Found a mislabelled H10** (a check pinning a doc 14 row it did not test) and
  made it the real H10. That is L4 again, found by a seat that was not looking
  for it.

To BUZ, with the rest: nobody tells a recorded Technical Director that they are
one — no doc 15 message exists, and inventing one is not the builder's call;
and doc 27's verification-call script is now two fields and one question behind
the build. Proposed wording is in the report.

New lesson: L31.
