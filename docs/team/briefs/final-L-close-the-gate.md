# Final round L: close the gate

For the tech-builder seat, from Leo. **D-47: doc 14 is green or we do not
launch.** Round K made the gate honest, and it now reads **257/263**. Open:
**H1, H2, H4, H5, H7, M7**, plus **M8**, whose check (`true, true`) cannot
fail. Launch is **1 October**.

Read `docs/14-Permission-Tests.md` table H and rows M7/M8, round K's report
(`docs/team/reports/2026-09-29-builder-final-k.md`, "what each open H row
needs"), and `docs/team/LESSONS.md` L4, L19 and L20.

## 1 · Pin each row as doc 14 words it, through the real read paths

For each row, write the check doc 14 describes, run through the database
functions and the pages a person actually uses (not a table read), and prove
it red by breaking the behaviour.

- **H1 Player joins a club:** consented at joining. The club sees the history
  the signing brings (D-48).
- **H2 Player leaves a club:** the club drops to aggregates. From that moment
  no `td_own` or `coach_own_v` reads the full record. Read through the
  register, the squad screen, and a CV opened from either.
- **H4 Coach unassigned from a squad mid-season:** loses read on that squad's
  players immediately.
- **H5 Club loses verified status:** all minor data access is revoked
  immediately, for currently assigned coaches and the TD. Test every way a
  club leaves `verified` (suspended, takedown, not_verified).
- **H7 `experience_entry` grants nothing, ever:** round K found the existing
  check reads only `0003_permissions.sql`. Make it read the permission
  functions **as they exist now**, from `pg_proc` (every function that
  decides access), and assert none references `experience_entry`. Also
  assert, behaviourally, that an entry naming a club grants that club
  nothing. **This test is not optional (CLAUDE.md pillar zero 10).**
- **M8 `club_unverified` adds a coach or an administrator:** permitted. Write
  a check that can fail.
- **M7:** waits on BUZ (doc 14 says permitted; D-90 and the code say not).
  Leave it open, and write both versions of the check so the ruling is a
  one-line switch.

**If any behaviour does not hold, that is a launch blocker.** Fix it in
Postgres, prove it, and put it at the top of your report.

## 2 · Three small follow-ups from round K (restrictive defaults; Leo will tell BUZ)

- **A suspended club's own page still invites families** to "Send my CV to
  {club}". Remove the send affordance from a suspended club's page: the most
  restrictive reading of "a suspended club advertises nothing". No new words.
- **`/jobs` still lists a suspended club's coaching roles.** Hide them the
  way round K hid notices, in the database read.
- **The legal register's "Where" for doc 25** says `/report`. Make it
  `/report/policy`. Documentation only.

## Machine and method

- **Tree:** `.claude/worktrees/builder-final-l`.
- **Ports:** database 54492, app 3300, Chrome CDP 9493. Start your dev
  server with `NODE_OPTIONS=--max-old-space-size=12288`.
- Never touch 3000, 54322, 3030 or 54323.
- **Migrations:** 0150 and up.
- **You are the only builder.** Keep free disk at 6 GiB or more.
- Run every suite from a fresh seed in TRAINING §4 order, plus `build:check`,
  `test:csp-prod` and `test:timing`.
- **Report:** `docs/team/reports/2026-09-29-builder-final-l.md`. Put the gate
  number at the top.
