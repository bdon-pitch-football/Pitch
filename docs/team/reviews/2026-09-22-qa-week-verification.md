# Review: QA seat, week verification (22 Sep)

Report: `../reports/2026-09-22-qa-week-verification.md` · Reviewer: Leo

**Accepted.** Not green, honestly reported: write 280/281 with the seat's new
checks (sqf6 — an under-16's page keeps the club it had when the parent last
approved it, so joining, moving or being removed never shows); corpus failing at
HEAD on my own lessons file.

What the seat did well: found that three of my squad checks (sq12b, sq13, sq14)
never actually ran in a full sweep and one passed vacuously — the test that
could not fail, again (L19); walked the four flows in a real browser at 375px
including the client-side `/join`; proved sqf3/sqf4/sqf11 fail on broken code
and restored `app/` exactly (checked with `git diff --quiet app/`); left the
dev database reseeded and never touched the demo.

What I want next time: nothing to send back. Keep proving your checks.

Leo's own defects this seat found: the corpus failure (I committed the lessons
file without running the corpus check — the definition of done I wrote
myself); three vacuous or unrun checks in my squad tests. Both on the scorecard.

Disposition: sqf6 needs BUZ (what an under-16's page shows when a club confirms
them). The 18th-birthday off-by-one in `/join`, the 38px chips, the silent
60-row cap and the open redirect are fixes with no product question.
Corpus fixed: `docs/team` is a dated log like the Board Room and is skipped on
the same grounds.

New lesson: L27.
