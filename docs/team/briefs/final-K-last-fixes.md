# Final round K: the last fixes before the rehearsal

For the tech-builder seat, from Leo. Launch is **1 October**, and the rehearsal
is on 30 September. `app` is fully green at ab4659a:
- perms 1801, render 613, write 452
- layout ALL GREEN
- timing 19/19 (on the large-heap timing server; see TRAINING §4)
- csp-prod 5/5, gate 263/263

Keep every change small. **No new user-visible words** except where noted.

1. **A suspended club's trial notices still show** on `/trials` and on its
   club page (round I found this). **This is the safety item.** A club
   suspended for any class must advertise nothing. Hide its notices from the
   board, from its page, and from any listing or feed, whether club-posted or
   Pitch-compiled. Enforce it in the read the pages use (a Postgres function
   or view), not in each page. Prove it red, and cover every suspension class.
2. **Docs 24 and 25 are served nowhere.** The register says `/conduct`
   (Code of Conduct) and `/report` (Complaints and Takedown). `/conduct` is a
   404, and `/report` is only the form.
   - Serve doc 24 at `/conduct` through the same renderer as `/terms`
     (`renderLegal` / `LegalBody`, with round J's rules applied).
   - Make doc 25 reachable from `/report`, with no account: either rendered
     under the form, or at `/report/policy` linked from it. Link text is the
     document's own title, which is already published words.
   - Checks: both pages serve their document with no drafting, and their
     consent stamps are unaffected (neither is consented to).
3. **The Terms still serve internal references** inside clauses: "D-64",
   "D-51", "D-149", "not Phase 1", "reference for the build".
   - Remove them with round J's exact-text withholding rule, never by
     rewording.
   - Where a removal leaves a dangling "(" or a double space, the rule cleans
     that.
   - Remove 2.3's out-of-date "not current behaviour" note: 16–17 guardian
     contact is built (`app/join/actions.ts:104`).
   - Restore a full stop wherever a removal took a sentence's own.
   - Extend J's property check: every clause that stays is the source minus
     the listed removals only.
4. **One button for a claimed-but-unverified club.** Today the trials board
   and the club's own page offer different actions. Make them the same,
   following D-90 and D-126: the family registers interest, and the club sees
   a held count until verified. Check it both ways.
5. **Doc 14 M7 against `/club/post-trial`.** M7 lets an unverified club post
   a trial; the code requires a verified one. D-90 (a verified club posts its
   own) supports the code. **Don't change behaviour.** Relabel or amend the
   check so it tests what the register decides, and report the discrepancy
   for Leo to take to BUZ.
6. **Gate-coverage honesty.** Round H found up to five table-H rows counted
   as covered by checks that test a different row (the H8 mistake). Relabel
   each check to the row it actually tests. Let gate-coverage show whatever
   is then honestly open, and list those rows.
7. **`dev-db.mts` with `DEMO_CLUB` ignores `PITCH_DEV_DB_PORT`** and binds
   54323 (BUZ's demo port). An explicitly set port must win. The demo keeps
   54323 as its default. Prove it with a check.

## Machine and method

- **Tree:** `.claude/worktrees/builder-final-k`.
- **Ports:** database 54482, app 3290, Chrome CDP 9483. Never touch 3000,
  54322, 3030 or 54323.
- **You are the only builder.** Check free disk (6 GiB or more) and load
  before every build or suite, and delete `.next` and `.next-check` promptly.
- **Timing:** run `test:timing` against your own dev server started with
  `NODE_OPTIONS=--max-old-space-size=12288` (TRAINING §4).
- Prove every check red. Run every suite from a fresh seed in TRAINING §4
  order, plus `build:check` and `test:csp-prod`.
- Write your report to `docs/team/reports/2026-09-29-builder-final-k.md`.
