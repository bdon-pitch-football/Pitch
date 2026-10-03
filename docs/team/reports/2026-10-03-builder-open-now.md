# builder: "Open now" expressions of interest on the trials board (3 Oct 2026)

Asked: build open-now EOIs (no closing date) for the trials board and the club page, approved by BUZ on 3 Oct with John's 3 Oct ruling. That means: a data model with a 7-day lapse computed when the board is read, a desk "closed" that takes a row off at once, the "Open now" group, the D-74 clarification, the desk rules, seed fixtures and tests. Worktree `build/open-now`, from 7d70d94.

Did:
- **`supabase/migrations/0173_open_now_eois.sql`** (new):
  - `trial_notice.trial_on` is now nullable, but only on a compiled notice. An undated notice must carry `confirmed_open_at` (when the desk last saw the form open) and `form_url` (the form the desk watches; https; never shown).
  - Three CHECK constraints enforce that. A dated notice can carry neither column, and a club's own notice can never be undated.
  - `fn_trial_notice_current(trial_on, confirmed_open_at)` holds the date rule once: a dated notice is current until its day has passed; an undated one while `now() < confirmed_open_at + 7 days`; a null stamp is never current. `fn_trial_notices_advertised` calls it, so the lapse is computed at read time. There is no job and nothing stored.
  - `fn_trial_notice_check`, `fn_ops_add_notice` and `fn_ops_edit_notice` gain `p_form_url text default null` as their last parameter. Each old signature is dropped first, so every existing 11-argument caller still works.
  - An undated add or edit stamps `confirmed_open_at = now()` and stores the ground alone. A time is refused. `fn_ops_check_notice` moves `confirmed_open_at` on an undated notice, which also brings a lapsed one back.
  - The operator's live counts use the same rule. The operator's list of a club's notices also keeps lapsed open-now notices, so they can be taken down.
  - A "closed" is the desk's existing `gone` (`fn_ops_remove_notice`), unchanged, and it is off at once.
- **`lib/trials-board.ts`**:
  - `kindOf(open, timeVenue)` means no date or "EOI closes" is an EOI. The board and `/fc` both use it.
  - `groupOpenNow` makes one row per club and notice, ordered by club name (case-insensitive), then title, with lines ordered by title.
- **`app/trials/page.tsx`**: reads `open_now`. "checked" comes from `confirmed_open_at` (Melbourne date) on open rows and from `last_checked` otherwise. The `checked_on` that feeds "Last checked" uses the same source.
- **`components/floodlit/TrialsBoard.tsx`**:
  - "By closing date." is drawn only when there are dated EOIs (B1).
  - Then comes the `tb-grp` group: "Open now" with its count, and "No closing date given. By club name." (B2).
  - The section number, Show chip, filters and region counts all count open rows as EOIs.
- **`components/floodlit/TrialRow.tsx`**:
  - `open` variant: OPEN, then a 24px stroke form icon (aria-hidden), then NOW, in the weekday, numeral and month slots. The ground moves under the club, and there is no closing line.
  - "The club's own notice" is always in the foot, before the button. That holds even when the lines' stamps differ: each line keeps its stamp text and the foot carries the one notice link.
  - On a claimed club, the door carries no `?trial=`.
- **`app/fc/[slug]/page.tsx`**:
  - Under "Expressions of interest", "By closing date." appears only over dated EOIs. Then comes "Open now" (in the page's own section-label style) with "No closing date given. By club name." and rows by title.
  - Open rows have the OPEN/NOW block, "checked {seen open}" and the club's own notice. They are not links onto `#play?trial=`, so an undated notice can never be the trial tag.
- **`app/globals.css`**: `.fl-trial-ic` and `.tb-grp`. Every size already exists; no new token.
- **Undated notices kept out of reads that need a day**: `app/home/page.tsx` (the player's next trial, and the club card's three trials), `app/club/page-edit/page.tsx` (the preview's first trial), and both `app/register-interest/[recordId]` files (the registration's trial tag).
- **`scripts/sync-trials.mjs`**:
  - The export adds `form_url`, `confirmed_open_at` and `lapsed`, and includes lapsed open-now notices so the desk can `check` or `gone` them.
  - Changes accept blank `trial_on` plus blank `time` plus `form_url` and refuse anything else. Calls pass `p_form_url`.
  - It prints "{n} lapsed (7 days without a check)", and the brake counts only visible notices.
- **`scripts/check-trial-links.mjs`**: also knocks on `form_url`, so a dead form takes the notice down. It never writes `confirmed_open_at`.
- **`scripts/dev-db.mts`** seeds Quillhaven FC (Thornbury) and Ondabrook United SC (Reservoir), both invented, through the operator's own functions:
  - two live Quillhaven lines from one page, seen open today and a day ago;
  - one Quillhaven line lapsed (seen 8 days ago);
  - one Quillhaven line closed (a `gone`);
  - Ondabrook seen open 2 days ago and re-read today.

  All of them are added to `boardV2Notices`, so the write suite removes them before its sweep (L32).
- **Tests**:
  - perms on-db1–8;
  - render on-r1–7;
  - updated tv2, tv3, tv4b (and its SEC regex), tv9 (now `kindOf`), tf-region1 (the new clubs' region) and write tv-w0 (8 fixtures removed, no `tb-grp`).
- **Docs**:
  - `docs/06-Register.html`: D-74 carries BUZ's sentence verbatim, plus its source.
  - `docs/team/TRIALS-DESK.md`: an "Open now" section with the add test, the 7-day re-confirm, the take-down triggers, moves, lapsed notices, the brake and the CSVs.
  - `docs/team/trials-desk-open-now-prompts.md`: diffs for the two desk prompts (see Found).

Commits on `build/open-now`: 92dfeb2 (the build), then this report.

Ran (on 92dfeb2, worktree open-now, ports 54671/3471/9671/9672, fresh seed, TRAINING order):
- perms 2246/2246
- render 902/902
- write 662/662
- reseed, restart, routes warmed
- layout 274 views at 375 and 1280, all green
- palette green
- tsc 0
- `.next-check` build exit 0
- csp-prod 5/5
- corpus 0 failures
- secret-scan clean
- gate 267/267

The first full run had render 900/902: fd0 and fd4 (the coming-soon page hash) failed once, right after a cold compile. The same hash matched on that server minutes later, and the second full run was green. The page is untouched, so this is a cold-compile flake.

Red proofs:
- **On 7d70d94's app, lib, seed and migrations** (new suites only): perms 8 failed, exactly on-db1–8 (2238 others passed). Render failed on-r1–7, plus the reworded tv9.
- **Targeted, on the new code:**
  - lapse set to 30 days: on-db3 and on-db4 go red;
  - lapse 30 days, the board's stamp back to `last_checked`, and the button moved ahead of the notice in the foot: on-r1, r3, r4, r5 and r7 go red.

  Each was restored, and the restored code passed both full runs.

Migration safety: I applied 0173 to a PGlite at 0172 holding compiled notices (dated, an EOI, and one past). It changed no row, the board and the operator's reads were byte-identical, all three constraints were validated, and an 11-argument add still works. The ledger refuses a second run. `scripts/migration-on-data.mjs --base 0172` itself crashes in its own fixture (`fn_td_membership_write_rule`) before reaching 0173. That is a pre-existing script problem, not this migration.

Found:
1. **The desk prompts are not in the repo.** `trials-watch.md` and `trials-check.md` live in `Pitch 3.0/.claude/agents/`, and the 5:30am schedule reads them directly. Editing them would change tonight's scheduled run before production can store an undated notice, so I did not edit them. The exact diffs are in `docs/team/trials-desk-open-now-prompts.md`. Apply them when 0173 and the two scripts are on production.
2. **Deploy order matters.** Production's current `/trials` code would draw an undated row as a trial with a blank date. The order is: migration and code first, the prompts last, and no open-now `add` before both.
3. **Out of lane, pre-existing:** on an unclaimed club's page, every dated notice row links `/fc/<slug>?trial=<id>#play`. The play panel then says "For {title} — {club} can invite you to it.", which an unclaimed club cannot do. Seen on `/fc/westgate-rangers?trial=…` (app/fc/[slug]/page.tsx, `pickedTrial`). I did not change it for dated rows; open-now rows never show it.
4. **`/fc` shows "By club name."** on a page with one club. It is literally true, but it reads oddly. Both lines were used there as asked.
5. **The ops console** lists open-now notices, lapsed ones included, with a blank date. Its Edit form requires a date, so an operator can only take one down or make it dated there. The desk works through `sync-trials`. No new console words were added.
6. **Disk:** 7.4–8 GiB free during the run. Other worktrees hold about 2 GB each: regions-fix, filters-release and trials-filters.

Copy for BUZ (new, verbatim, the approved four only):
- "OPEN"
- "NOW"
- "Open now"
- "No closing date given. By club name."

Reused unchanged: "Expressions of interest", "By closing date.", "Listed … · checked …", "checked …", "The club's own notice", "Send my CV", "I'm interested", "Unclaimed", "Online — see the club's notice" (desk-written ground). The register line and the desk docs are internal.

Risks:
- **Reviving a lapsed notice is my choice.** A `check` on a lapsed open-now notice puts it back on the board on its own, with the words BUZ approved, and the checker must open every such check. The stricter alternative is that a lapsed notice can only be removed and then re-added through BUZ. Leo or BUZ to rule.
- **Undated notices are never a registration's trial tag.** The board door on a claimed club drops `?trial=`, and register-interest ignores an undated id. This is the restrictive choice.
- **No `kind` column.** An undated notice is an EOI by definition. Dated EOIs still rely on "EOI closes".
- **Screen readers** hear "OPEN NOW" from the literal text. No visually hidden text was added.
- **The render checks are seed-relative.** If a render run starts more than about 5 days after the seed, Ondabrook lapses and on-r fails. The dev database is in memory, so every run reseeds.
- **Not checked:** a real Google Form or JotForm against the link checker; the timing suite; the club demo.

Lesson: a desk prompt that a schedule reads is live configuration even though it is only a markdown file. Change it with the deploy, not with the branch.
