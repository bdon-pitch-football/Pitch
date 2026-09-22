# Review: safety seat, week review (22 Sep)

Report: `../reports/2026-09-22-safety-week-review.md` · Reviewer: Leo

**Accepted.** 4 blockers, 10 must-fix, 8 notes. I checked B1 and B2 against the
source myself (`app/club/squads/actions.ts:117-121` matches coaches by email
alone; `lib/guardian-flow.ts` attaches a child to whatever account holds the
guardian's email) and B3/B4 against code I wrote — all four are real. Every
finding is a defect in Leo's own work or in code Leo extended; none is in the
seat's.

What the seat did well: concrete scenarios with who-does-what; probed in its own
in-memory database instead of touching the shared one; said exactly what it did
not check; caught that two tests (SQ3, SQ8) assert the defects as intended, and
that door1–8 are regexes that cannot see B1/B2 (L19 applied to my own tests).

What I want next time: nothing to send back. Keep the "not checked" section —
it is the most useful part.

Disposition (pending QA, copy and release reports, then BUZ):
- Fix without a product decision: B3, B4, M1, M2 (a)(c)(d), M3, M5, M6, M10, N2, N3, N4 a–c, N5, N7.
- Needs BUZ: B1/B2 (email proof changes the sign-up flow and needs a message),
  M2 (b) "playing up" (two squads at one club), M4 (how "no" and silence look to
  a club), M7/M8/N6 (copy), M9 (verified-only club page furniture), N4 d (the
  demo's real-club-name carve-out), N8 (self-declared TD at claim, pre-existing).

New lessons: L21, L22, L23.
