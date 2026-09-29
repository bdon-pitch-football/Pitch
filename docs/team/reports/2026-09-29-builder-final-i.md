# tech-builder: Pitch curates the trials board, plus BUZ's four console calls (29 Sep 2026)

Asked: brief I. Give the operator an `/ops/clubs` directory, unclaimed club listings, and trial notices compiled from a club's own public notice (D-64, D-74, D-90), all through Postgres functions that name the operator. Then Leo's addition: BUZ's four operator-console calls of 29 Sep.

Did: tree `.claude/worktrees/builder-final-i`, branch `builder-final-i`. Commits `60661ec` and `10b477e` sit on a50870a, with `app` merged twice (`aab2a5e` fast-forward, then `acc043d`). The suites below were measured on `acc043d` plus the report commit.

- **`supabase/migrations/0130_pitch_curates_the_board.sql`**
  - New columns: `club.listing_source/listed_by/listed_by_email/listed_at` and `trial_notice.source_url/added_by/added_by_email`.
  - A NOT VALID check: a compiled notice carries a source URL and the address of whoever added it.
  - An append-only `curation_event` log, with RLS on.
  - The writes are `fn_ops_add_club`, `fn_ops_edit_club`, `fn_ops_remove_club`, `fn_ops_add_notice`, `fn_ops_edit_notice`, `fn_ops_check_notice` and `fn_ops_remove_notice`. Each one:
    - takes the operator as a person id plus their own address (0100's rule);
    - validates its input;
    - logs what it did.
  - What the functions enforce:
    - A duplicate listing (same name and suburb, ignoring case and spacing) is refused, under an advisory lock.
    - A listing's state is VIC or NSW only (D-04).
    - A listing must say where its details came from.
    - A notice needs a source URL. Its age groups must come from the lookup and its positions from the ten.
    - A notice cannot be dated in the past.
    - Compiled notices go only on unclaimed or claimed-unverified clubs.
    - Once someone has registered for a trial, its date is fixed.
    - Editing a notice moves `last_checked`.
    - Changing a listing's contact address voids any claim code already in flight.
    - Only an unclaimed listing can be edited or removed. A compiled notice can be removed whatever state its club is in.
  - **The wall.** A trigger refuses every insert, update or delete of a compiled notice, or of its age-group rows, unless `pitch.curating` is set. Only the functions set it, and only for their own transaction.
  - Reads: `fn_ops_clubs(q)` returns club facts and a count, with `%` and `_` in the search taken literally. `fn_ops_club` and `fn_ops_club_notices` also return the club's own address and the operator's. None of them returns a person.
- **`app/ops/clubs/`**
  - `page.tsx`: the directory. Every club in every state, a search, the state as the queue's chip, trials live (a dash, never 0), and the doors: the club page, plus the call sheet once somebody has claimed the club.
  - `new/page.tsx`: add a listing.
  - `[clubId]/page.tsx`:
    - the listing form (only while the club is unclaimed), stamped with who listed it;
    - the compiled notices, each with its stamps, its source link, and Change / Checked today / Remove;
    - Remove this listing, inside a `<details>`.
  - `[clubId]/trial/page.tsx`: the PostATrial form and its words, plus "Where you found it" for the source URL. "How to register" and "Where CVs should go" are left out on purpose: a compiled CV address would sit in front of a family's send (doc 14 J38).
  - `actions.ts`: six actions. Each checks `requireOperator` and the words switch, then makes one function call.
  - `chip.tsx` and `listing-fields.tsx` are shared pieces.
  - Rows use round G's pattern: stacked below 768, the table from 768.
- **`lib/ops-policy.ts`**: `CLUBS_WORDS_APPROVED` and `clubsScreensShown`. It is committed as **false**, so the screens run in development and are a 404 in production (see Found 1).
- **`components/console-shell.tsx`**: a "Clubs" rail door after Reports, behind the same switch, so the phone bar's three tabs are unchanged.
- **`app/globals.css`**: one new block, `.ops-clubrow`, `.ops-live` and `.ops-doors`, placed before the report-facts block.
- **Seed and demo**
  - `scripts/dev-db.mts` adds Westgate through `fn_ops_add_club` and `fn_ops_add_notice`, as Marina. Its date is `greatest(12 Oct, today)`, so a demo seeded after the 12th still starts.
  - `scripts/demo-layer.mts` opens the wall for its own run (session-level, reset in a `finally`) and stamps its compiled notices with a reserved-fiction URL and address.
  - Proven: an `--unclaimed` demo seed ran all the way through the demo layer.
- **The four calls (APPROVALS, 29 Sep)**
  - `/ops/switches`: "Nothing spent this month" when the spend is zero.
  - Call sheet: the "flag the subscription" line is removed.
  - "Support" is now "Lookup" in the rail, the h1 and the tab. The route stays `/ops/support`, and no `/ops/lookup` was added.
  - The first two questions start unanswered and are `required`. `logCall` records nothing, and sends you back to the sheet, unless both are yes or no.
  - **Call-sheet lines touched, for round H:**
    - `app/ops/call/[clubId]/page.tsx`: 57–68 (`Choice`, the new `unset`), 207–208 (the two questions), 217–219 (the removed line, now a comment).
    - `actions.ts`: 78–87.
- **Suites**
  - `permission-tests.mjs`: cur-1…22 and cur-s1…s4. Setup goes through `state()`, so a bug put back fails its own check instead of stopping the run.
  - `render-tests.mjs`: cur-r1…r7 and ops-r8…r11. `/ops/clubs` is added to the crawl and to s4.
  - `write-tests.mjs`: cur-w0…w14 and ops-w1.
  - `layout-check.mjs`: six `/ops/clubs` views.

Ran (fresh seed, TRAINING §4 order; everything was restarted by port):
- perms 1717/1717
- render 598/598, then write 437/437 (same seed)
- reseed, then layout 375 1280: 230 views, ALL GREEN, squeeze 0. The first pass, at load 16, had two failure-path views (`/fc/no-such-club`, `/dev/boom`) never render; the rerun was green.
- timing 18/19. **J61 is INCONCLUSIVE, because of load and noise, not a finding.** It could only resolve 2.70 ms (/home) and 1.80 ms (/club/register); the measured shift was −0.07 ms (p 0.81), not distinguishable. Load was 7–10 during the run. Leo reruns J61 on a quiet machine.
- tsc clean · palette ALL GREEN · corpus 0 failures · gate-coverage 263/263 · secret-scan clean · build:check ok · csp-prod 5/5 on 3260.
- **Red proofs** (logs in `.run/`, untracked):
  - perms: with the bugs put back, 23 checks went red (RLS1, cur-1…8, cur-12…21, cur-s1…s4). Removing the wall turned cur-9 and cur-11 red. A session-level flag that was never reset turned cur-9, cur-11, cur-12 and cur-17 red. Dropping ST from the ten turned cur-13 and cur-22 red.
  - render: 12 red (ops-r8…r11, cur-r1…r7, and r39 caught "Post a trial" linking to a 404).
  - write: ops-w1, cur-w1…w10 and cur-w12…w14 went red across four batches.
  - layout: forcing the phone row onto one line gave 7 squeezed `/ops/clubs` rows.
  - **Not red by name:** cur-10 (an over-broad wall stops the suite at an earlier block's own club-notice write), and cur-w0 and cur-w11. The last two are double-gated: `requireOperator`, then the database's operator check.

Found:
1. **The words switch is still off.** Leo relayed BUZ's advance approval, which is recorded in APPROVALS (29 Sep). My session's permission system refused the edit that set `CLUBS_WORDS_APPROVED = true` ("feature-flag write"). A partial write had landed before the refusal; I reverted it to the committed `false`. The clubs screens therefore work in development only. **Making them live is one line in `lib/ops-policy.ts`, for Leo or BUZ after the review.** cur-s4 passes either way.
2. **A club verified later keeps Pitch's compiled notices live.** They then render as "On Pitch — verified club" with "I'm interested". Pitch can no longer change or re-stamp them, only remove them. **Decision for BUZ:**
   - (a) leave them until they expire (as built);
   - (b) take compiled notices down at verification;
   - (c) hand them to the club as its own.
3. **Pre-existing: a claimed-unverified club gets two different answers.** For its notices, `/trials` says "Unclaimed listing · register via club" and offers "Send my CV". Its `/fc` page shows "Register my interest" and no marker (QA F13). The brief's marker holds on the board but not on that club's page. Not changed.
4. **Pre-existing: suspended clubs' notices still show.** `app/trials/page.tsx` and `/fc/[slug]` do not filter them out.
5. **Pre-existing: doc 14 M7 and the post-trial page disagree.** M7 permits a claimed-unverified club to post a notice; `/club/post-trial` requires a verified club.
6. **Trap, and my slip.** With `DEMO_CLUB` set, `dev-db.mts` ignores `PITCH_DEV_DB_PORT` and listens on 54323. My one run to prove the demo layer tried to bind BUZ's demo port. It failed with EADDRINUSE: nothing connected and his demo was untouched. Suggest dev-db honour or refuse the variable in demo mode.
7. **Disk ran out mid-run.** During the final chain free space fell to 605 MB, and then 1 GB, and a reseed failed with ENOSPC (my `.next` was 1.1–1.4 GB). I stopped, deleted my build output, waited until 13 GB was free, and reran the whole chain.

Copy for BUZ (new strings only; everything else is reused from PostATrial, the call sheet, the Lookup page or the board):
- "Clubs" (rail door and page title) · "Club" (tab title of one club's screen)
- "Add a club" (button, page title, submit)
- "Club name or suburb" (search) · "Search"
- "Club" · "Trials live" (table head) · "{n} live" (phone row; zero shows "—") · "Unclaimed" (chip)
- "Suburb" (field label) · "https://" (placeholder on "Where you found it", trial form)
- "Listed {29 Sep 2026} by {operator address}" · "Listed {29 Sep} by {operator address} · checked {29 Sep}"
- "Checked today" · "Remove" · "Remove this listing" · "Its page and its trials come down now."
- "A club with that name and suburb is already listed."
- "Fill in the name, suburb, state and where you found it."
- "This listing has more on it than Pitch added, so it cannot be removed here."
- "This club has claimed its page or been verified since, so that is the club’s to do now."
- "Paste the address of the club’s own notice, starting https://"
- The four calls' "Nothing spent this month" and "Lookup" are already approved.

Risks:
- **Rename moves the address.** Renaming an unclaimed listing changes its `/fc` slug, so the old link 404s, including a `/claim` page that somebody has open.
- **Duplicates are matched on the tidied exact name.** "Westgate Rangers" and "Westgate Rangers FC" count as two clubs.
- **Choices I made the restrictive way (Leo or BUZ may widen them):**
  - VIC and NSW only;
  - the source URL shows to the operator only (D-64: quiet);
  - no CV address or "how to register" on compiled notices;
  - removing a listing is a hard delete, with the curation log keeping a snapshot;
  - the operator is recorded by their signed-in address, not a typed name.
- **Not checked:**
  - layout at 640, 768 and 1024 (only 375 and 1280 were run);
  - a real phone;
  - production with the switch on.

Lesson: a check whose setup uses a bare query stops the whole suite when its own bug is put back, and hides every check after it. Build the setup through the same refusal-catching helper, so the proof fails by name.
