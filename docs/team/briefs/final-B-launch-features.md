# Final round B — the four launch calls and coach-verified stats

For the tech-builder seat, from Leo. Read `docs/team/TRAINING.md`, `LESSONS.md`,
`CLAUDE.md`, `docs/06-Register.html` (D-84, D-63, D-160, D-164) and
`docs/team/APPROVALS-28-SEP.md` first. **Only the words in APPROVALS-28-SEP.md
may render.** The signed screen designs in `design-screens/` are the source of
truth for layout and for their own copy, except any line that states a price or
a date. Hold those lines and list them for BUZ.

## 1 · The front door, behind the launch-day switch (D-164)

- Build the product front door at `/` from the signed landing designs:
  - `LandingParent`, `LandingPlayer`, `LandingCoach`, `LandingClub`
  - `DeskLandingClub` for the laptop
  - `Home`, if it is the chooser
- It gives four ways in: sign up, find a club, trials, and claim your club.
- **The switch.** A single `app_config` switch, **off**, keeps the coming-soon
  page at `/`. Turning it on serves the front door. Nothing else changes.
- **Links.** `/claim/[slug]` and `/share-card/[recordId]` currently have no link
  from anywhere. Link them where the designs put them.
- **Checks:**
  - With the switch off, `/` is byte-for-byte today's page.
  - With it on, every link resolves.
  - No price renders.

## 2 · The CV states its context (D-84)

- Under the name, write "U15 · born Jan–Mar" (or Apr–Jun, Jul–Sep, Oct–Dec).
  Derive it at read time from the date of birth, in `Australia/Melbourne`.
- **Never** write a date of birth, an exact age or the year of birth.
- **Never** put it on the share card, the OG image or anything D-89 governs.
- The age group comes from the same place the CV already takes it. If a record
  has none, render nothing rather than guess.
- **Check:** a stranger with a link sees the quarter and the band, and the
  OG/share card carries neither.

## 3 · The country step (D-63)

- Use the approved words: "Where do you live?", with **Australia** and
  **Somewhere else**.
- Somewhere else shows "Pitch is only in Australia for now." and **collects
  nothing**, at any age: no email, no row.
- It goes before the date of birth, in every sign-up door.

## 4 · Premium rows, adults only (D-164, D-82)

- **Where:** 18+ player and coach pages, using the approved words, at most two
  rows per screen, following `Highlights18.dc.html`, with "Coming soon" in place
  of the design's month.
- **A tap** shows "Premium is coming. You're first in line." and logs one
  **anonymous** interest count per feature. Log no person id, no session and no
  IP.
- **Never under 18:** the checks cover a 16–17 coach and an under-18 on every
  screen.

## 5 · Coach-verified stats (D-160, approved behaviour)

- The write path:
  - a verified coach at the player's own club can mark a stat coach-verified;
  - the provenance is set by the server from the actor, never from the request;
  - when the player edits that stat, the new value is self-reported, and the
    coach's value stays in the history.
- **Where it shows:** the tile opens to show "Verified by <club> · <date>" or
  "Self-reported · entered <date>", two levels deep, pushing rather than
  overlaying (`docs/design/mockups/provenance-drill.html`).
- **Never the coach's name** to anyone outside the club.
- **Doc 14 row:** a link-holder reading a coach-verified stat learns the club
  and the date, and no person.

## Machine and method

- **Your tree:** `.claude/worktrees/builder-final-b` (Leo creates it).
- **Your ports:** database 54392, app 3190, Chrome CDP 9393. Stop your processes
  by port, never by name.
- **Migrations:** 0080 and up.
- **One other builder runs alongside you.** Before each suite, check the load
  and that no other seat's Chrome is running a layout pass.
- Every new check is proven red with its bug put back. Run every suite from a
  fresh seed in TRAINING §4 order.
- Write your report in `docs/team/reports/`, with every held string verbatim.
