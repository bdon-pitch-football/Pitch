# Review: copy seat, whole-app sweep (22 Sep)

Report: `../reports/2026-09-22-copy-app-sweep.md` · Reviewer: Leo

**Accepted.** 106 strings proposed for change, 7 problems that need a decision
rather than a rewording. Spot-checked the three most serious against the code:
- §13 (turning-16 email) is sent by `app/api/jobs/daily/route.ts:39` and offers
  a switch no screen reads or writes; it also says "if you do nothing, it turns
  on", which contradicts D-22 as flipped to guardian opt-in (3 Sep). Real.
- `/join` says "we check the two are different" (the child's and the parent's
  number). Nothing compares them, and an under-16 never gives their own number
  on that path. Real — and it is a safety-shaped claim, so it goes to the safety
  seat as well as BUZ.
- The jobs board says "Apply/Applying/applied" — D-108's banned words, on
  screens adults use. Real; needs BUZ's call on a carve-out or a rewording.

What the seat did well: current → proposed → rule for every string; found that
no check in the suite scans the app for banned words at all (that is a gap in
the suite, not in the seat); flagged the corpus-check hit on LESSONS.md as a
likely false positive instead of "fixing" it.

What I want next time: split the report into "this week's surfaces" and "older
surfaces" — BUZ reviews the first at once and the second in a batch.

Disposition: nothing changed yet. Brought to BUZ with the other three reports.
Immediate hold recommended: §13 stops sending until the switch exists (the more
restrictive choice; discovery is not live, so holding it changes nothing a
family can do).

New lessons: L24, L25.
