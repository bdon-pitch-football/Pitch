# tech-builder: round L, close the gate (2026-09-29)

**Gate: 262/263.** The one open row is **M8**, and a missing test is not the reason it is open. Doc 14 says an unverified club may add a coach or an administrator. D-154 (locked) and D-93 say it may not, and so do the product and the database. M8 needs BUZ's ruling, and both versions of its check are written. **M7 is closed** under BUZ's ruling (D-90 stands). Round K's count was 257/263.

*Filed by Leo from the builder's handback: this seat cannot write report files.*

Asked: brief L. Pin H1, H2, H4, H5, H7 and M8 as doc 14 words them, through the real read paths, each proved red. Leave M7 open with both versions written. Then three follow-ups. Mid-task you relayed BUZ's M7 ruling: merge `app`, switch M7 to D-90, prove it red, close it. Done.

- **Tree:** `builder-final-l`, cut at 184f94a, with `app` merged at 6ce29a6 (a merge, not a rebase).
- **Commits:** **ca14408** (table H, 0150, 0151, follow-ups) and **f72fcdc** (M7 ruled, 0152).
- **State:**
  - Nothing pushed or deployed.
  - My ports (54492, 3300, 9493) are free.
  - Ports 3000, 54322, 3030 and 54323 were never touched and are still up.
  - `.next` and `.next-check` are deleted, and `node_modules` is the symlink again.
  - Logs are in `.l-logs/` (untracked, 3.1M).

## Launch blocker, found and fixed: a failed call did not end verification (0150)

Doc 27 re-calls a verified club on a change of claimant, every year, and on any report, and the call sheet offers "not verified" on every club.

- **The bug:** that outcome wrote its row and nothing else. A verified club that failed re-verification stayed `verified`, and its TD and coaches kept reading children. H5 did not hold.
- **The fix:** `supabase/migrations/0150_a_failed_call_ends_verification.sql`. A trigger on `verification_call` (on insert, or on an edit of `outcome`) moves a *verified* club to `claimed` in the same transaction as the call.
- **What it leaves alone:**
  - It is not a suspension: no class is recorded and nobody is told.
  - A claimed club stays claimed, and a suspended club stays suspended with its class.
  - Nothing is deleted, and `verified_call_id` is kept.
- **Proved:** with 0150 removed, H5 (failed call), nv1 and nv4 fail in the permission suite, and H5 (failed call) fails in the write suite.
- **For BUZ:** this is the restrictive reading of doc 27 and H5. The alternative, that a failed re-verification changes nothing, would contradict H5 and needs a register entry.

## For BUZ, plainly

1. **M8 is doc 14 against D-154 and D-93, the same shape M7 was.**
   - The only way a club brings a coach in is the TD's invitation. `coach_invite_rules` (0037) refuses anyone else, and D-154 records "only the technical director brings a coach in".
   - A TD exists only once a verification call names one (0058).
   - No screen adds an administrator at any club.
   - So an unverified club adds nobody. The old check was `check('M8: …', true, true)`.
   - **Options:**
     - (a) Amend doc 14 M8 to "Refused". That is the product as it is: set `scripts/rulings.mjs` M8 to `'D-154'`, one line, and the gate reads 263/263.
     - (b) Amend D-154 and build a door for adding coaches and administrators. N18i would have to change too. I proved this: with the doc-14 version on and the database opened for it, M8 passes and N18i fails.
   - I did not choose.
2. **M7 is closed as ruled, and the rule now lives in the database (0152).** The D-90 refusal used to be only `/club/post-trial`'s own query, and doc 14's first rule is that its tests run against the database.
   - 0152 refuses a club's own notice for a club that is not verified, whether written for it or moved onto it.
   - It also closes a hole that 0150 would have opened. A club that fails its call is `claimed` and would have kept advertising the notices it posted while verified. The board now shows a club's own notices only while it is verified.
   - Compiled notices are untouched, and nothing is deleted.
3. **Leaving a squad does not withdraw the family's registration at that club.** The TD can still open the CV from the register, under the registration's own consent (N16).
   - The CV no longer names the club; the H2 register check pins that.
   - Options: (a) keep it as now; (b) leaving also withdraws that club's registrations.
   - I did not choose.
4. **H5 and D-48 disagree at one edge.** A coach at a club that loses verification keeps `authored_only` on the entries they wrote.
   - No page reads `authored_only` today (Stage 2), so nothing is exposed now.
   - Options: authorship survives a deverification, or it does not while the club is suspended.
   - The H5 checks use non-authoring coaches, and their labels say so.

## Did

**Table H, permission suite** (`scripts/permission-tests.mjs`). It builds its own world: Previous FC, Signing FC, a TD, two coaches and three children. Each row runs the reads before the event, then the event, then the same reads **inside the event's transaction**. The reads go through the functions the pages call: `fn_read_level`, `fn_can_read_squad_player`, `fn_squad_roster`, `fn_can_read_registration`, `fn_register_rows`, `fn_write_provenance`, `fn_verify_club` and `fn_approved_cv`.
- **H1 ×8:**
  - A claim from a stranger or from the under-16 alone is refused.
  - The parent's claim changes nothing until the club answers, and the join asks for the family's consent again.
  - The log shows `squad_left` from the old club and `squad_joined` at the new one.
  - `fn_join_squad` is the one writer of a player membership, across `app/`, `lib/`, `components/` and `pg_proc`.
  - After the signing, the TD and the coach read the whole record, and the served CV carries the previous club and the 2025 season.
- **H2 ×4:**
  - A transfer drops the old club at once, and its authoring coach keeps `authored_only`.
  - On Leave, the TD drops to none and the coach to `authored_only`. The squad CV and the pen close, and the roster loses the child but keeps its count.
  - The register CV names no club.
  - A 16-17 drops to the B3 floor (`public`).
- **H4 ×3:**
  - The coach is on two squads, both ways the database knows one: a squad membership (A7) and a register grant (D-154).
  - Ending the membership closes the record, the squad CV, the roster fields and the pen for that squad.
  - Removing the grant closes that squad's registrations and screen.
  - The other squad stays open both times.
- **H5 ×7:** a live baseline of 15 reads, then six ways out of verified: suspension for child_safety, administrative, non_payment and no class; takedown; and a failed call. Each drops all 15 reads inside the call's transaction, and a verified call restores them.
- **H7 ×4:**
  - The engine is read from `pg_proc` as it exists now: 80 functions, found from the "who may" roots plus a call-graph closure plus the triggers on tables that carry access. None of them names `experience_entry`.
  - No other function, policy or view names it.
  - The catalogue shows its only foreign key is to its record, and the only one into it is a stat's source.
  - Behaviourally: 216 answers (every person × 3 children × 11 questions) are identical before and after 54 entries naming the club by name, id and slug in every kind.
  - The old 0003-only check keeps its D-72 label, with a comment. It stayed green under the H7 mutant.

**Table H, write suite** (`scripts/write-tests.mjs`). A new block runs straight after the TD block on Riverside and hands every seat back.
- **H4:** Marina's Remove on /club/squads. Sam loses both team screens, the registrations and a CV. He is then brought back through the real invitation.
- **H5:** five call-sheet outcomes. Marina loses the register CVs, the squad and the squad CV. Sam loses the squad CV, his teams, the registrations and /coach/register. A verified call restores each one.
- **H2:** Alex presses Leave. Marina's screen drops Deniz, and neither she nor Sam can open his CV.
- **H1:**
  - A stranger's "Ask them" is sent home, and nothing waits on the club.
  - Alex asks, and the club reads nothing until it confirms.
  - After the confirm, the CV shows Elderslie Juniors SC and the 2025 award.

**M7/M8 switch** (`scripts/rulings.mjs`, new). Both versions are written. M7 is set to `'D-90'` (ruled) and M8 to `'pending'`. `scripts/gate-coverage.mjs` keeps a pending row open and prints "awaiting BUZ's ruling".

**Follow-ups:**
1. `app/fc/[slug]/page.tsx`: a suspended club's page draws no "Want to play here?" panel and none of its doors, and its squad chips are plain names without the hint.
2. `0151_a_suspended_club_hires_nobody.sql`: `fn_coaching_roles_advertised()` is read by `/jobs`, the club page card, both counts on `/home` and the apply action. `/jobs/[roleId]` 404s for a suspended club.
3. The legal register's "Where" for doc 25 is now `/report/policy`.

**Fixtures changed for 0152:**
- susp-ad1's club is verified before it posts.
- P13e's trial is written with the trigger off for that one insert, the seed's pattern for rows written before a rule.

## Proven red (L19/L20)

Every mutant was restored afterwards. DB mutants were built from the live `pg_proc` definitions.

| Mutant | Went red |
|---|---|
| 0150 removed | perms H5 failed call, nv1, nv4 · write H5 failed call |
| The served CV drops history | perms H1 history · write H1 history (run C) |
| A claim from anyone · the join does not re-ask | perms H1 stranger (the suite then stops) · H1 re-ask, H1 log, SQ8g |
| A player's ended membership still counts · the squad CV ignores it | perms H2 ×2–3, H1, H4, H5 · H2 leave, transfer, 16-17, H4 |
| A coach's ended squad still counts · a revoked grant resolves | perms H4 membership · H4 grant, N21d, N21f |
| Access through any club that is not unclaimed | perms H5 ×6, td13 · write H5 ×5 (run D) |
| `fn_read_level` grants on an entry naming the club | perms H7 ×3, H2 (the old D-72 check stayed green) |
| A helper naming the table, called by the engine, granting nothing | perms H7 engine and nothing-else (the matrix stays green, correctly) |
| Jobs ignore suspension · `/jobs` reads the table · panel drawn · register back to `/report` | susp-ad5 ×5 · susp-ad-s3 · susp-ad-s4 · legl1 |
| 0152 removed · post-trial admits a claimed club | perms M7 · perms M7 · write M7 (run B) |
| Write run A: Remove no-op, no 0150, "Ask them" skips the family check, suspended page/jobs/role page | H4, c5, c5b, H5 failed call, H1 stranger, susp-ad-w5 ×4 |
| Write run B: Leave no-op | H2, then knock-on failures and a later crash |
| Switch set to D-90 + D-154 · doc 14 · doc 14 with the product opened | 263/263 · M7 and M8 fail · M7 and M8 pass, N18i fails |

## Ran

All on f72fcdc, from a fresh seed, in TRAINING §4 order. Load was 4–8 throughout, with 14–19 GiB free.

- tsc 0 errors · palette ALL GREEN · corpus 0 failures, 0 warnings · secret-scan clean · validate-migrations ALL GREEN
- gate-coverage **262/263, open M8 (awaiting BUZ)**. It exits 1 by design until M8 is ruled.
- reseed → perms **1867/1867** (+39) → render **627/627** → write **485/485** (+20)
- reseed → layout **230 views at 375 and 1280, ALL GREEN**
- reseed → timing on a fresh app with the 12 GB heap: **19/19**. E10 resolution 0.51ms, tok-rl 0.51ms, req-t 0.39ms, L40 0.63ms, J61 0.90/0.70ms.
- build:check **exit 0** (`/fc/[slug]`, `/jobs`, `/jobs/[roleId]` are dynamic) · test:csp-prod **5/5** on 3300 with the dev app stopped

## Found

1. **In production, nothing writes a coach's squad membership; only the seed does (L13).**
   - A7's `coach_own_v` therefore cannot exist for a real coach.
   - A granted coach sees squad names and the registrations, never a squad CV.
   - The only unassign is the TD's Remove, which takes all of a coach's teams at once.
   - H4 is pinned on both kinds of assignment. For Leo.
2. **`fn_cv_club` names a suspended club on a child's CV** (share link, preview, register). Not changed.
3. **A club that fails its call keeps its players-wanted notices,** and nobody has ruled whether a claimed club may post them. Not changed.
4. **The write suite prints `SKIP sq12b/sq13/sq14`,** as it did before this round. It is a log line, not a check.
5. **Later write blocks crash rather than fail** when membership state is wrong (L2104 `forms(...).find` undefined). This is a suite robustness point.

## Copy for BUZ

There is no new string. What families now see differently, all in existing words:
- **A suspended club's page** no longer shows "Want to play here?" or its doors: "Send my CV to {club}", "Sign in to send your CV", "Register my interest" and "Build a CV first — it is what the club reads". The hint "Tap a squad to go on the register for it." is gone too, and the squad chips are no longer links.
- **A suspended club's coaching roles** are off `/jobs` and off the club page ("{club} is looking for coaches"), and each role's own page is not found.
- **A club that fails its call** shows no self-posted trial until it is verified again. Compiled notices stay.
- **Documentation only:** doc 25's "Where" now reads "`/report/policy` (Part 1), linked from the `/report` form · **reachable without an account, from any page**".

## Risks

- **0150 is live the first time an operator records "not verified" on a verified club,** including for a missed call (doc 27: "Nobody answers, three attempts: Not verified"). The call sheet does not warn about this, and adding a warning would need words from BUZ.
- **A club that loses verification between opening "Post a trial" and posting it** now hits 0152's refusal and gets the action's generic failure. I did not press that path.
- **The H7 engine discovery is a name pattern plus a call closure.** A future function that decides access alone, under an unusual name, would be missed. "Nothing else names it" covers that today.
- **Not checked:** a real phone, the website, and the demo. The demo needs a restart after 0150–0152 (L14).

## Lesson

A rule that lives in a page's query can be forgotten by the next page, and a suite that reads the page's source only proves that page. M7 was "held" by one `where club_state = 'verified'` pinned with a regex. Then 0150, a fix for a different row, created the one state (verified, then claimed) where that rule no longer covered the board. When you add a state transition, list every rule that assumed the transition could not happen.
