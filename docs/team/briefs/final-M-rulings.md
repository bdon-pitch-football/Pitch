# Final round M: build BUZ's 30 September rulings

For the tech-builder seat, from Leo. Launch is **1 October**. `app` is at
0b7e121 and the gate reads **263/263** (M8 ruled: D-154 stands). Every
suite is green (round L's report). **No new user-visible words** in this
round. If any item seems to need one, stop and report it.

Read D-170 and D-171 in `docs/06-Register.html`, doc 14 table H, round L's
report (`docs/team/reports/2026-09-29-builder-final-l.md`, "For BUZ" and
"Found"), and `docs/team/LESSONS.md` L4, L19 and L20, and round L's lesson.

## 1 · D-170: leaving a club withdraws that family's registrations at it

- When a player's **last** player membership at a club ends (Leave, or
  signing for another club via `fn_join_squad`), withdraw every interest
  registration that player holds at that club **in the same transaction**.
- Use the family's own withdrawal path, whatever it does today (the note is
  emptied, D-128, doc 14 N7; the consent log gets its usual row). Do not
  write a second withdrawal.
- A player still in another squad at the same club keeps the registration.
- Enforce it in Postgres (a trigger or the membership-ending function), not
  in the page.
- Checks, proved red: after Leave, the TD's register has no row and
  `fn_can_read_registration` is false; the note is empty; transfer does the
  same at the old club; a two-squad player leaving one squad keeps it.
  Extend round L's H2 checks in both suites.

## 2 · D-171: while a club is not verified, nobody at it reads a child

- `fn_read_level` (and anything else that grants `authored_only`) must not
  grant it through a club that is not `verified`: suspended (any class),
  taken down, or claimed after a failed call (0150).
- It comes back when a verification call restores the club. Nothing is
  deleted.
- D-48 still holds for a coach who **leaves** a club that stays verified:
  they keep `authored_only`. Pin both sides.
- Round L's H5 checks used non-authoring coaches. Add authoring coaches to
  H5 in both suites, for every way out of verified.

## 3 · Two smaller fixes from round L's "Found"

- **`fn_cv_club` names a suspended club on a child's CV** (share link,
  preview, register). A club that is suspended or taken down is not named;
  the CV renders as it does for a player with no club. Check every surface
  that calls it.
- **A club that is not verified shows none of its own players-wanted
  notices**, the same rule as 0152 for trials. Pitch-compiled notices stay.
  Enforce it in the read the pages use.

## Not in scope

- The call sheet gets no warning (BUZ ruled: no new words).
- A production writer for a coach's squad membership (L13) waits for
  December.
- The write suite's crash-not-fail robustness (round L, Found 5): fix it only
  if a block you touch trips it.

## Machine and method

- **Tree:** `.claude/worktrees/builder-final-m`.
- **Ports:** database 54502, app 3310, Chrome CDP 9503. Start your dev
  server with `NODE_OPTIONS=--max-old-space-size=12288`.
- Never touch 3000, 54322, 3030 or 54323.
- **Migrations:** 0153 and up.
- **You are the only builder.** Keep free disk at 6 GiB or more; delete
  `.next` and `.next-check` promptly.
- Prove every check red. Run every suite from a fresh seed in TRAINING §4
  order, plus `build:check`, `test:csp-prod`, `test:timing` and
  `gate-coverage` (must stay 263/263).
- **Report:** return it as your final message in TRAINING §6 format, with
  the gate number at the top. Leo files it.
