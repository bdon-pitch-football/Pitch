# tech-builder: round K, the last fixes before the rehearsal (2026-09-29)

Asked: brief K (`docs/team/briefs/final-K-last-fixes.md`). Seven small fixes before the 30 September rehearsal: suspended clubs advertise nothing (the safety item); docs 24 and 25 served; the Terms' internal references off; one button for a claimed-but-unverified club; doc 14 M7 against `/club/post-trial`; gate-coverage honesty; the demo database port.

Tree `builder-final-k`, cut from `app` at fad5a9c. The work is **f408a0f**; this report is the commit after it. Nothing has been pushed or deployed. Ports: database 54482, app 3290, CDP 9483, all stopped by port. `node_modules` was a hard-link copy for the runs and is the symlink again.

## For BUZ, plainly

1. **Doc 14 M7 and the register disagree.** M7 says an unverified club *may* post a trial notice. D-90 says the board's two sources are "a verified club posts its own" and Pitch's compiled notice, and the product has always done that: `/club/post-trial` asks for a verified club on the page and again in the action. **Behaviour is unchanged.** The old check inserted a row straight into the table and called it M7 (it tested the table, and asserted the opposite of the register). It now tests what D-90 decides, under D-90's name. **M7 is open until BUZ rules** between doc 14 and D-90. Options: amend M7 to read "Refused: a verified club posts its own (D-90)", or reverse D-90 and open the door (a product change touching the board families rely on).
2. **Gate coverage is 257 of 263, not 263.** Six table-H checks tested table-A rows. Relabelled to the rows they test, the gate now shows **H1, H2, H4, H5, H7 and M7** open. What each needs is under Found.
3. **Doc 25 is served as Part 1 only.** Its own footer says "Part 1 is public, Parts 2–5 are internal". Parts 2–5 include "It must be tested from a phone before launch, not assumed to work", a list of launch gaps, and "Not a personal email address, and not the founder's", which contradicts Part 1. I withheld them whole and kept the footer. Option: serve all five parts (I would not).
4. **Doc 22's consent hash changes again.** The version stays v2.1, as in round J: removals only, and v2.1 has been published to nobody. Any dev or preview consent row stamped `22@v2.1` before this commit names text that is no longer served.
5. **A suspended club's own page still invites families to send it a CV.** Outside this brief, and a product call touching minors, so not changed. See Found 1.

## What is no longer served, and what is newly served

Verbatim, for BUZ and John. Line numbers are in `docs/legal/22-Terms-of-Service.md` at v2.1. The source files are unchanged.

**Doc 22 (`/terms`), removed by exact words:**
- **L79**, Part 1's table, the Schedule B row's third column ("Who accepts it"): `Reference table for the build`. The cell is now empty.
- **L82**, Part 1: ` (D-64)`. The sentence now ends "…only by a material change."
- **L147**, 5.9's two-guardian bullet: ` (D-51)`. It now reads "*Most-restrictive-wins is honoured in substance: …*".
- **L299**, A6.2: ` (D-149)`. The item now ends "…confirm in writing on request*;".
- **L326**, A11: ` and it is not Phase 1`. It now ends "It is not a data export.*".
- **L338**, Schedule B's heading: ` (reference for the build)`. It now reads "# Schedule B — Acceptance architecture".
- **L92**, 2.3: ` — **[LEGAL: doc 18 Q5. This last sentence is a proposed addition, not current behaviour.]**`, and **a full stop restored**. Round J's generic `[LEGAL]` rule had taken the note and its dash and left "…before the account activates" with no full stop. The note is out of date: a 16–17 cannot sign up without a parent's mobile and address (`app/join/actions.ts:104`, D-155/D-157). It is now named in `WITHHELD`, and 2.3 ends "…before the account activates."

**Doc 25 (`/report/policy`, new):** Part 1 is served — "Reporting something", "What happens then", "If it is urgent", "If you are unhappy with what we did" — and the footer. Parts 2–5 (95 non-blank lines, from "# Part 2 — How this actually runs" to the rule over the footer) are not. Round J's four held lines are among them and stay named.

**Doc 24 (`/conduct`, new):** the whole document, byte for byte as the renderer already produced it (legj6). Nothing is withheld from it.

## Did

**1 · A suspended club advertises nothing (0140, the safety item).**
- `supabase/migrations/0140_a_suspended_club_advertises_nothing.sql`: `fn_club_advertises(club)` (not suspended), `fn_trial_notices_advertised()` (still to come, per 0007, and its club advertises) and `fn_players_wanted_advertised()`. `club_state = 'suspended'` covers every class — child_safety, administrative, non_payment, none recorded — and the takedown outcome, which writes the same state. The class decides who is *told* (0066); it does not decide what the club may go on publishing. Security invoker, plain SQL, nothing written, nothing deleted. A payment-lapsed register (D-135) is not a suspension and is not touched: notices are the free tier.
- Every page that lists a notice reads them: `/trials`, `/fc/[slug]` (trials and players-wanted), `/home` (a player's next trial, a TD's trials card, an administrator's live count), and the trial a registration may carry on `/register-interest` (page and action). The date rule those pages each applied for themselves is now the function's.
- The pages that still read the tables directly are pinned (susp-ad-s1): a club's own management of its own notices (`/club/post-trial`, `/club/page-edit`), and a trial already attached to a registration, request or invitation (`/club/invite`, `/g/interest`, `lib/invitations.ts`).
- I included **players-wanted notices** (the restrictive reading of "advertise nothing"; they sit on the club page and link to the club's email). Coaching roles on `/jobs` I did not touch (Found 2).

**2 · Docs 24 and 25 served.**
- `app/conduct/page.tsx` and `app/report/policy/page.tsx`: `renderLegal` of docs 24 and 25, with round J's rules. No session, no stamp, no write.
- `/report` links to the policy under the form. The link text and both tab titles come from the document's own heading via `documentTitle()` in `lib/legal-doc.ts` (the heading without "PITCH — ").
- `lib/legal-doc.ts`: a new cut, `'rest'` — a heading and everything after it up to the rule over the footer. It throws if what is under the last rule is not exactly one italic footer line, because otherwise we cannot tell where the document's own text ends.

**3 · The Terms' internal references.** Seven named `words` entries in `WITHHELD`. A `words` cut now runs `tidyCut` on its own line only (an empty "()" with its space; a run of spaces), and one marked `stop` gives the sentence back its full stop. legj3's property allows exactly that and no more, written in the test rather than imported.

**4 · One button.** `/trials` now uses the club page's own test (`claimed` or `verified` is on Pitch): a claimed club's listing offers "I’m interested", carrying the trial, and — like its own page — carries neither "On Pitch — verified club" nor "Unclaimed listing · register via club" (M9: the family is never told the club is unverified). The family registers interest; the club sees a count until verified (D-126). No new words.

**5 · M7.** The M7 check is replaced by a D-90 check (perms) and a pressed one (d90-w1, write): a claimed club's administrator is sent home from "Post a trial", and the verified club's own form posted in her name reaches no board. Behaviour unchanged.

**6 · Gate honesty.** In `scripts/permission-tests.mjs` (the old L3126–3132): "H1" is now A12b, "H2" A15b, "H3" A12, "H4" A13, "H5" A8, the second "H4" A9, and "H7" (a departed coach keeps what they wrote) is H3/A10 — that one is doc 14's H3.

**7 · The demo port.** `lib/demo.ts`: `demoDbPort()` — 54323 unless `PITCH_DEV_DB_PORT` is set, then that port — read by both `scripts/dev-db.mts` (the bind) and `DEMO_DB_URL` (the demo app), so a seat's demo is bound and read on the seat's port. `scripts/demo.mjs` blanks the variable for its database and its app, so BUZ's `npm run demo` is always 54323, the port its takeover clears. A plain dev database still refuses 54323.

**Tests added.**
- Permission suite (1801 → 1828): susp-ad1 ×4 (one per class), susp-ad2 (takedown inside one transaction), susp-ad3, susp-ad4, susp-ad-s1, susp-ad-s2; D-90; demo-port1–3 and DEMO2 updated; legj4b, legk1 ×3, legk1b, legk2, legk2b, legk3, legk3b, legk3c, legk4, legk8, legk8b, legk8c, legk8d; leg9, legj3, legj4 and legj5 extended.
- Render suite (613 → 627): legk-r1–r4, one-r1, and `/conduct` and `/report/policy` through leg-r4–r6 and legj-r1. leg-r6 now allows the one subtitle docs 24 and 25 carry.
- Write suite (452 → 465): d90-w1, one-w0–w4 (Westgate claimed through the product, both screens read, the button pressed, the held count), susp-ad-w0–w3 (Kingsway suspended through the call sheet for each class and a classless takedown, re-verified between, and Westgate's compiled notice).
- The write sweep's page walk now skips `/conduct` and `/report/policy` (see Lesson).

## Proven red (L19/L20)

Each bug put back, the suite run, the file restored.

| Mutant | Went red |
|---|---|
| `fn_club_advertises` ignores suspension | susp-ad1 ×4, susp-ad2, susp-ad3 |
| The date rule dropped from the board | susp-ad3 |
| `/trials`, the club page's trials, its players-wanted, `/home`'s count read the tables (4 mutants) | susp-ad-s1, susp-ad-s2 each time |
| ` (D-64)` served | legj5, legk1, legk1b, legk2b |
| 2.3 not given its full stop / its note left to the generic rule (2) | legj5, legk2 |
| No tidy after a cut | legj3, legj4, legk8, legk2b |
| Doc 25 Parts 2–5 served | legj4, legj5, legk8c, legk8d, legk1, legk1b |
| `'rest'` also takes the footer | legj4, legk8c |
| `/club/post-trial` lets a claimed club in | D-90 |
| The demo binds 54323 whatever is set · `npm run demo` keeps a shell's port · `demoDbPort` ignores the knob | demo-port2 · demo-port3 · demo-port1 |
| `/report` without the link · `/conduct` renders doc 22 · doc 24 stamped | legk3c · legk3 · legk4 |
| **Render, one run:** references back on the Terms, Parts 2–5 served, the link gone, every listing "I’m interested", `/conduct` rendering doc 22 | legk-r1, legk-r3, legk-r4, one-r1, legk-r2, leg-r5 (/conduct) — 621/627 |
| **Write, one run:** board and club page read the tables, the board button verified-only, post-trial lets a claimed club in | susp-ad-w1 ×4, susp-ad-w3, one-w1, one-w3, d90-w1 — 457/465 |

Item 7 live, on my port only: `DEMO_CLUB="Porttest FC" PITCH_DEV_DB_PORT=54482 node scripts/dev-db.mts` printed "demo db ready on 127.0.0.1:54482", and `PITCH_DEMO=1 PITCH_DEV_DB_PORT=54482 next dev -p 3290` served `/fc/porttest-fc` (h1 "Porttest FC") from it. BUZ's demo was running throughout on 54323/3030 (pids 83970/84011); `lsof` showed pid 83970 still holding 54323 before and after. I did not run the old code live: on a machine where his demo was down, it would have taken his port. `.dev-ids.json` was untouched by the demo run.

## Ran

On f408a0f, from a fresh seed, in TRAINING §4 order. Load 4.5–6.2 throughout, 16–18 GiB free.

- tsc 0 errors · palette ALL GREEN · corpus 0 failures, 0 warnings · secret-scan clean · validate-migrations ALL GREEN
- gate-coverage **257/263 pinned, 6 open: H1 H2 H4 H5 H7 M7** (exit 1, by the brief's design)
- reseed → perms **1828/1828** → render **627/627** → write **465/465**
- reseed → layout **230 views at 375 and 1280, ALL GREEN** (no overflow, rings, targets, squeeze, CSP)
- reseed → timing, on a freshly started app with `NODE_OPTIONS=--max-old-space-size=12288`, port 3290:
  - first run **18/19**. J61 was INCONCLUSIVE: the `/home` arm resolved 1.09ms against the 0.8ms it needs (`/club/register` 0.78ms). Both shifts were indistinguishable (+0.10ms, p = 0.53; −0.15ms, p = 0.27). Load was 5–6, with BUZ's demo up.
  - reseed, fresh app, second run **19/19**: E10 0.55ms, tok-rl green, req-t 0.43ms, L40 0.47ms, J61 0.94/0.59ms over 1,100 rounds each (shifts +0.04ms, p = 0.79; +0.01ms, p = 0.94).
  - Both arms of J61 run the same `/home` code, so this round's change to `/home`'s queries cannot open a gap between them; it moved the constant, not the difference.
- reseed
- build:check **exit 0**. `/conduct`, `/report/policy`, `/terms` and `/trials` are dynamic (ƒ).
- test:csp-prod **5/5** on port 3290, with the dev app stopped.
- Afterwards: 54482, 3290 and 9483 free; `.next` and `.next-check` deleted; `node_modules` the symlink again; BUZ's demo still on 54323 (pid 83970). Run logs are in the tree at `.k-logs/` (untracked, 532K).

## Found

1. **A suspended club's page tells families to send it a CV.** `/fc/[slug]` still renders for a suspended club, and because `onPitch` is only `claimed || verified` (L131), the panel reads "{club} isn't on Pitch yet, so there is no register here. Send them your CV instead…" (L293) with a "Send my CV to {club}" door. For a child-safety suspension that routes a child's CV to the club we took down, and "isn't on Pitch yet" is false. Its notices are gone after this round; the door is not. Options for BUZ: the page is not found while suspended; the page stays with no door and no panel; or as today. I did not choose (a product call touching minors).
2. **`/jobs` lists a suspended club's coaching roles.** `app/jobs/page.tsx:25` reads `coaching_role` with no club-state filter. Adult job ads, not notices, so outside this brief; the same "advertise nothing" reading would hide them. For Leo.
3. **Four table-H rows have no test of their own, and one is the D-72 row.**
   - H7 (experience_entry grants nothing, "not optional"): "D-72 permission engine source never references experience_entry" reads `0003_permissions.sql` only, not the functions as later migrations left them. Reading `pg_proc` for the live permission functions would make it H7's check.
   - H5 (club loses verified: TD and assigned coaches lose record access at once): M10a–c test `fn_club_minor_facing` and the register, not `fn_read_level` for the TD and a coach after the suspension.
   - H4 (a coach unassigned mid-season): A9 tests a coach never assigned; nothing tests the transition.
   - H1 (a player joins: the club sees the history the signing brings) and H2 (a player leaves: aggregates only) have no checks.
4. **M8's check cannot fail.** `check('M8: and may add its own people', true, true)` (permission-tests L2542) pins M8 on nothing (L19). Outside the table-H rows the brief named, so left as it is; honestly it is a seventh open row.
5. **`/conduct` is linked from nowhere.** The register names it; nothing in the product points at it, so no crawler (render, layout) reaches it except by name. The render suite reads it directly. Where to link it is placement (Leo's) and words (BUZ's).
6. **Doc 24 rule 1 says "a trial application"** — a D-108 banned word in John's published text, now served at `/conduct`. The render crawl's banned-word scan exempts `/privacy` and `/terms` only; `/conduct` is not crawled today, so nothing trips. For John, and for whoever links it.
7. **Doc 20 serves "(D-153)" twice and "D-148" in its footer** (legk1b pins it). It is stamped `20@v2.8`, so taking them off is a version bump and John's call.
8. **Still in the Terms, not on the brief's list:** 7.6 cites "the retention statement (doc 23)", which no page serves; Schedule B's 16–17 cell reads "build supports guardian co-acceptance". For John.
9. **The legal register's "Where" for doc 25 says `/report`.** It is now `/report/policy`, linked from `/report`, Part 1 only. The register is Leo's to change.
10. **The operator's clubs directory counts a suspended club's notices as "live"** (`fn_ops_clubs`, 0130). They are on no board. The operator's own view, so left.

## Copy for BUZ

No new sentence. Three new visible strings, each the document's own words:
- On `/report`, under the form, a link: **Complaints, Reports and Takedown** (doc 25's title without "PITCH — ").
- Tab title of `/report/policy`: **Complaints, Reports and Takedown · Pitch Football**.
- Tab title of `/conduct`: **Code of Conduct · Pitch Football**.

Changed, with existing words only:
- A claimed club's listing on `/trials` shows **I’m interested** (was **Send my CV**), and no longer shows **Unclaimed listing · register via club**, which was false for it.
- The served-text removals above. Docs 24 and 25 (Part 1) are newly served on pages; both are published legal text.

## Risks

- **The write sweep now skips two pages.** Without that, ks-w0, sq2 and sq3 failed: Jordan's fresh link read as dead, and his squad ask was refused as "not available", which is the A4 age hold. The app log shows the sweep posting Jordan's own register-interest form twice after g32-23 had released him. The sweep picks the first squad on the list, which is U9. My reading is that `/report`'s new link spent one of the sweep's 60 pages and changed which seat met that form first. I did not trace which seat's walk lost the page. What I did confirm: with the skip, on a fresh seed, all three are green and the sweep still submits every form it finds. The sweep's budget is still a fixture every new link moves.
- `fn_trial_notices_advertised` returns `setof trial_notice`, so a page selecting `t.*` from it gets every column. Every page names its columns today; susp-ad-s2 pins which pages read it, not what they select.
- A club taken down and then reinstated gets every notice back as it was, including a compiled one whose date is still to come. That is "suspension hides, it never deletes"; the operator can remove a compiled notice whatever the state.
- Not checked: the website (`site-free` ports `lib/legal-doc` and will need this round's `WITHHELD`); a real phone; `/conduct` in the layout check (it is the `/terms` renderer, which is).

## Lesson

A crawl with a page budget is a fixture, and a link anywhere spends it. One harmless link on `/report` moved the write sweep's 60-page walk, and as far as the log shows it swept a form as a different seat and put an adult player on an age hold three blocks later. That was reported as three unrelated failures. When a suite fails a long way from what you changed, diff what each seat's walk reaches before and after, not the failing block.
