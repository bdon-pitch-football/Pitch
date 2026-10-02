# builder: the /ops signups count, and two audit seeds (2026-10-02)
Asked: (1) why /ops Today's "SIGNUPS TODAY 211" sat over a breakdown summing to 194, fix it, and add a check that's red on the old code; (2) a seed with an under-16's waiting change of every kind and private photos; (3) a way to capture the TD register without polluting the seed. Branch `build/audit-tech`, from `app` at f8fa273.

Did:
- **Cause.** Reproduced on a fresh seed: `fn_ops_today()` = 211 total, against 101 player + 85 parent + 2 coach + 6 club = 194. Nothing was counted twice, no Melbourne-midnight boundary was involved, and 0110, 0157 and 0158 agreed with each other. The total counted every `person` row made today, while the line counted only rows with one of four hats, so the 17 rows with no hat were in the total and in no part of the line:
  - 1 team manager (Tomas). The club hat asked only for a TD or an administrator.
  - 3 accounts holding nothing else (Robin, Casey, the B2 Priya). That is exactly what the **club door** makes (`createClubAccount`: "an ACCOUNT and nothing else") until its claim, so every club person who has signed up and not yet claimed is in the total and missing from the line. This is the production-relevant part: clubs are the one audience this week.
  - 13 rows with no address and nothing on them (12 seed "Register Parent" rows, plus the investigator). These are not accounts and no door makes one.
- **`supabase/migrations/0171_signups_add_up.sql`.** The header gives the reasons.
  - Each signup gets exactly one hat:
    - club: TD, administrator or team manager;
    - coach: a coach page or a coach seat;
    - parent;
    - player;
    - then club again: an account with a sign-in address and nothing else, which is the club door's account before its claim. The parent door is closed, so no other door makes this shape.
  - A row with no hat is not counted, so `signups_total` is the sum of the four by construction.
  - No new label: "club" is the club door's own word on /join and in the digest.
  - The rule now lives in one place, `fn_ops_day(date, text[])`. `fn_ops_day(date)` and `fn_ops_today()`'s signup and approval columns read it, so the three copies cannot drift (L23).
  - Signatures and result columns are unchanged (ops-t1, d1–d3 green).
  - Seed result: 200 = 102 + 86 + 2 + 10.
- **Tests.**
  - `permission-tests.mjs`: three new checks.
    - ops-t9: the total equals the sum before and after adding a club-door account, a team manager, a coach seat with no page and a no-address row.
    - ops-t10: the same holds for the 7am count, with and without exclusions.
    - ops-t11: the hat rule is written once.
  - `render-tests.mjs` ops-r12: the served tile's value equals the sum of its own line. This is the audit's exact view.
  - `write-tests.mjs` today-w4: the same check after a day of pressed doors.
  - Proof against the old code (0171 removed): perms 2209/3, with ops-t9 getting `[false,false,4,0,0]` (total +4, line +0), plus ops-t10 and ops-t11 red. With 0171 restored: 2212/0.
- **Seed 1, `scripts/dev-db.mts`.** Its own `if (!DEMO)` block, after Thornbeck.
  - People: Noemi Varga (parent, `pending.parent@example.com`) and Ivo Varga (born 14 May 2012), both invented.
  - Built the way production writes it:
    - the live tables first;
    - the approved version as a snapshot of them, in buildSnapshot's shape;
    - then Ivo's edits to the live tables;
    - the waiting version as a second snapshot.
  - Changes, one of every kind: About; photo (two private `pitch-private:` keys, the old one kept by the approved version); highlights (one added, one removed); "Clubs before this one" (one added); achievements (one added, one removed); other football (a tournament added); details (positions, number 8→10, foot Right→Left, goals 4→7).
  - The photos are drawn silhouettes on a flat colour. No real face, and no brand photography on a child.
  - The seed refuses to start unless the diff shows all seven kinds between two different private photos.
  - Isolation (L32): Noemi is in no suite's seat list. Ivo has no club, squad, registration or share link.
  - Ids are in `.dev-ids.json` under `pendingReview`, and a line in the seed's console.
- **Seed 2, `scripts/screens.mjs --register`.** The smallest thing that works. It adds no fixture, so no count anywhere moves.
  - It photographs `/club/register` as Marina and `/coach/register` as Sam, full height, at the given widths.
  - It then stops the database by port (L8) and reseeds on the same port.
  - It refuses to run without an explicit `PITCH_DEV_DB_PORT`, and refuses 54323.
  - I chose this over a throwaway TD club. That option would add a club, a TD and roughly 100 copied registrations, and would move the ops tiles and /ops/clubs. It would also photograph a register that isn't Riverside's, and would need a second coach seat as well.

Ran (`build/audit-tech`, this tree; DB 54621, app 3421, CDP 9621, in the brief's order):
- reseed;
- `next dev` on 3421;
- perms 2212/2212;
- render 828/828;
- write 664/664 (ks-w0, sq2 and sq3 green);
- reseed, then restarted next dev;
- layout: 274 views at 375 and 1280, 0 overflow, all green;
- palette green · tsc 0 errors · build:check ok · csp-prod 5/5 · corpus 0 failures · secret-scan clean · gate-coverage 267/267 · validate-migrations ok (0171).
- Also checked, outside the suites:
  - `/g/pending/<Ivo>` as Noemi (after the write suite) returns 200, with the seven sections in spec order. Both `<img>` addresses are `/private-photo/…?e=&s=` and serve 200 `image/jpeg` with `private, max-age=600`.
  - `--register` at 375 and 1280 wrote 4 PNGs and reseeded. Afterwards `register_read_log` holds only the seed's 2 rows.

Found:
- (a) The seed writes 12 "Register Parent" person rows for bulk registrants who are 18 or over, linked to nothing. Production can't create that state (L13). After 0171 they no longer reach the count. The seed itself is not mine to change; I left it.
- (b) Robin, Casey and the B2 Priya carry no `tos_accepted`, unlike a real door account. That's harmless here.
- (c) A plain `screens.mjs` run, and every layout run, walks the TD's /home links into `/club/register`. Any capture taken *after* those runs in the same seed sees extra reads. TRAINING's reseed order already covers the suites; design captures should run `--register` last or reseed.
- (d) A full-height capture of a page with the fixed console rail draws the rail's "Sign out" mid-page. This is an artefact of the capture, not the page.
- (e) The parent scratchpad is shared between seats: another seat's `next dev` wrote into my `next.log`. I moved to `scratchpad/audit-tech/`.

Copy for BUZ: None in the product. Fixture data only, not UI copy: Ivo's About ("Box-to-box midfielder who loves a tackle and a long pass." → "Box-to-box midfielder who wins it back and plays forward quickly. Working on my left foot every Tuesday."), the achievement, club, futsal and tournament names, and the clip titles. Club names are reused from the seed (L15).

Risks:
- Counting an account with nothing else as "club" infers the door from what the account holds. It is true today, because the parent door is closed. A future door that writes nothing would be miscounted as club. The alternative is a new label (for example "no seat yet"), which would need BUZ's words. Leo to confirm, or take it to BUZ.
- The total no longer counts rows that are not accounts. None exist in production; this is a definitional change to 0110's "every new row".
- A coach seat with no coach page now counts as coach, where it used to count as nothing.
- `--register` needs `next dev` restarted afterwards. It says so, but does not do it.
- The timing suite was not run (not in the brief).

Lesson: a scratchpad shared with the parent session is shared with every seat it spawned. Give your logs a folder of your own, or you'll read another seat's server as yours.
