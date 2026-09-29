# Final round I: the clubs directory, and adding trials from a club's own public notice

For the tech-builder seat, from Leo. BUZ: "build both". Launch is **1 October**,
and at launch the trials board is **curated by Pitch** (D-74, D-90). Today the
only way a club or a notice gets in is the seed script, so on launch day the
board is empty unless clubs post their own. This round gives the operator the
tools.

Read `CLAUDE.md` (the trials index, D-64, D-68, D-74, D-90),
`design-screens/PostATrial.dc.html`, `ClubCV.dc.html`,
`OpsVerification.dc.html`, the existing `app/club/post-trial/*` and
`/fc/[slug]`, and the unclaimed-listing handling already built (`/claim`,
the D-64 disclaimer).

## Build, operator-only (`requireOperator`)

1. **`/ops/clubs`: every club, in every state** (unclaimed, claimed,
   verified, suspended), with a search by name or suburb. Each row shows the
   name, suburb and state, the state as a chip, trial notices live, and a link
   to its public page and, where one exists, its call sheet. **No person's
   data.** A club's admin and TD are not shown here; they are on the call
   sheet. Use the phone layout round G sets for the console: rows stack under
   640px.
2. **Add an unclaimed club listing:**
   - **Fields:** name, suburb, state, the club's own public contact address,
     and a **source** field, required (where the details came from, e.g. "club
     website /contact"), as number_source is on the call sheet.
   - The listing is `unclaimed` and carries the D-64 disclaimer where it
     already renders.
   - It is claimed later through `/claim`, unchanged.
   - Refuse a duplicate by name and suburb.
3. **Add a trial notice compiled from the club's own public notice (D-90):**
   - Built on the `PostATrial` design and the club's own post-trial form
     fields: squad or age group, competition gender, date, time, ground, and
     positions wanted.
   - Plus a **required source URL**: the club's own public notice.
   - Each notice records who added it and when (the "added on" stamp), and
     "last checked", which the operator can re-stamp with one button.
   - It expires the day after its date, exactly as club-posted notices do.
   - It appears on `/trials` and the club page with the unclaimed marker and
     the button unclaimed listings already get ("Send my CV"). A verified
     club's own notices are unchanged.
   - Only ever on an unclaimed or claimed-unverified club. A verified club
     posts its own.
4. **Edit and remove** both, from the same screens, each logged with the
   operator's name.

## Rules

- **All of it in Postgres functions**, with the operator named, as the call
  sheet does. No other route can write these.
- **No public submission route**, ever (D-90).
- **Copy:** reuse the signed designs' words and the existing post-trial words.
  Hold every new string and list it verbatim for BUZ, in one short list. He
  approves it in one pass. The screens work without the held words in
  development and are not shown in production until he approves them.

## Machine and method

- **Tree:** `.claude/worktrees/builder-final-i`.
- **Ports:** database 54462, app 3260, Chrome CDP 9463. Point every probe at
  3260. Never touch 3000, 54322, 3030 or 54323.
- **Migrations:** 0130 and up.
- **Round G** is rebuilding the ops shell. Merge `app` when G lands, and use
  its shell and phone layout. Until then, keep your pages in their own files.
- Prove every check red. Run every suite from a fresh seed in TRAINING §4
  order, plus `test:timing` (under load 8), `test:csp-prod` and
  `build:check`.
- Write your report to `docs/team/reports/2026-09-29-builder-final-i.md`.
