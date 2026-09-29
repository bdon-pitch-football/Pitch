# builder: final G — the operator console, rebuilt to its signed design and made to work on a phone (29 Sept 2026)

**Tree:** `.claude/worktrees/builder-final-g`, branch `builder-final-g`, cut from `app` at `287a5d4`.

**Commits:**
* `d4dfe85` — part 1: the queue, the frame, reports/support/switches, Today, and the squeeze check.
* `c0d3c3e` — merged `app`: docs only, including BUZ approving the payment-sentence removal.
* `3a7ded1` — merged `app` again: round F (`ac6ddcb`) and H's `80f66ce`, after Leo said F had merged.
  * `/ops/verification` conflicted, and I kept both sides.
  * F's "access ended" state, its `ended_at` column and its filtered TD line are carried into my layout exactly.
* `e981fc8` — part 2: the call sheet.

There was no rebase. `app` has not moved since `3a7ded1`.

**Measured on:** `e981fc8`. Every suite ran from a fresh seed in TRAINING §4 order after the second merge.
**Ports:** database 54442, app 3240, Chrome CDP 9443. I stopped everything by port only, and never touched 3000, 54322, 3030 or 54323. Before each layout pass I waited for 9433 (F) and later 9453 (H) to be free. Logs, red-proof logs and screenshots are in `.run/` in my tree (untracked).
**Migrations:** `0110_ops_today_counts.sql`.
**Machine:**
* Load was 4.98–14.08 on 14 cores. I waited out 14.08 before starting `next dev`.
* Every `test:timing` run started under 8 (5.63–7.63). During each run the load climbed to 9–12, with round H running beside me.
* Free disk fell to **5.6 GiB** before `build:check`. I stopped, deleted my own `.next` (1.4 GiB) to get back to 7.0 GiB, and then built.
* `.next` and `.next-check` are deleted, my database is stopped, and `node_modules` is back to its symlink. The runs used a `cp -al` hard-link copy.

Asked: brief G, plus Leo's addition.
* **Brief G:** rebuild the operator console to its signed designs (OpsCall, OpsVerification, OpsReports, OpsToday), with a phone layout for every `/ops` screen and the signed table at a laptop.
* **The new check:** a layout check that fails squeezed columns by name, proven red on today's `/ops/verification`.
* **Leo's addition** (BUZ: "build both"): a Today dashboard at `/ops`, counts only.
* **The call sheet:** after round F merged, carrying F's TD card and handover through the redesign.

## Did

### 1 · The squeeze check (`scripts/layout-check.mjs`)
* **The rule.** A view fails when an element's own words sit in a box narrower than **120px** that wraps to **more than three lines**.
  * Lines are counted from the text's own line boxes: a Range over the direct text nodes, counting distinct tops.
  * Hidden elements, anything inside an `<svg>`, and the contents of a closed `<details>` are skipped. The phone bar's shut More sheet measured 36px wide on the first run and was a false positive.
* **What a failure says.** It names the element (tag.class), its first 48 characters, its width, its line count, the page, the width and the seat.
* **Where it runs.** On every walked view, every front-door and failure view, and every DEEP page.
* **Self-test, both ways (L19).** The same sentence in a 60px column must be named, and in a 300px column must not be.
* **DEEP now also walks** `/ops`, `/ops/reports`, `/ops/support`, `/ops/support?q=guardian@example.com` and `/ops/switches`. Until now only the queue and the call sheet were measured.
* **Proven red** on the unfixed code at 375 (`.run/layout-red-375.log`, exit 1). It named 35 squeezed columns:
  * **`/ops/verification`, 8 of them.** For example, "Quarrymead VIC · claimed by M. Harris, club admi…" was **1px wide, 9 lines**, and "Technical Director Felix Moreau · active · recor…" was **37px wide, 12 lines**.
  * **`/terms` and `/privacy`, 18.** Legal tables at 73–117px, one sentence 8 lines deep.
  * **The More sheet, 9.** The false positive, now skipped.

### 2 · `/ops/verification`
* **From 768px it is the signed table** (D-147 as amended: the table wherever there is room, the rail from 1024).
  * The columns are **Club · Claimed · Held · status · action**.
* **Below 768 each club is two lines.** The details are full width on top, then the claim date, then count · status · button in one row.
* **Claimed is the design's column.**
  * The date comes from the claimant's seat, `min(membership.started_at)` (0030).
  * While the club waits it reads "29 Sep · today", and after verification the date alone. A zero day reads "today", the design's own word.
* **Status pill and button as signed.**
  * The pill is 12px/700 sentence case.
  * The button is `console-btn console-btn-primary` at 44px (D-147; the design's is 40px).
* **Warning card as signed.** "Payment does not change that and cannot." is **removed**, which BUZ approved on 29 Sep.
* **Zeros are left out (D-162).** A club with nothing held shows "—", and a zero part of the subtitle is dropped.
* **Kept as they were:**
  * F's development-only "access ended" state;
  * the TD line, which write-tests td-w2 and tde-w8 read.

### 3 · The operator frame (`components/console-shell.tsx`)
* **`OpsConsole` is async now.** It calls `requireOperator()` for the operator's own address and runs one count query.
* **The rail head is the signed one:** "Pitch operations" over the operator's address.
* **The doors:** Today (`/ops`) · Verification (count of clubs awaiting a call) · Reports (count of open reports) · Support · Emergency switches · Home.
  * A count shows only when it is above zero.
  * **"Money" is left out** (D-163).
* **`OpsHeader`** is the signed title row: 17px/800 title, a muted line, and an optional right-hand action. The back link and the logo sit top right, per the charter. Every ops page uses it.

### 4 · Reports, Support, Switches
* **Reports.** Each report's facts sit in the signed labelled wells:
  * **Report** ("received …");
  * **About**;
  * **From** (only when the reporter left an address);
  * **What they wrote**, in its own well.

  "Reply to: {email}" is gone. Every button and form is unchanged (write g32-* green).
* **Support.** The signed title row and pill. `console-btn` replaces two hand-drawn outlined buttons.
* **Switches.** The title row only. The switches are unchanged. I checked them at 375 and 1280, and sms-p7 and sms-p8 hold.

### 5 · Today, at `/ops` (`app/ops/page.tsx`, `0110_ops_today_counts.sql`)
* **Two read-only (`stable`) functions, no argument.**
  * **`fn_ops_today()`** returns one row of twelve integers.
  * **`fn_ops_delivery_failures()`** returns `channel, failed_at, provider_said` for the last 24 hours. The provider's status word only, never the address or the message.
  * The header comment gives each count's meaning and cites D-78, D-79, D-126 and D-162.
* **What each count reads.**
  * **Signups today** counts accounts created today (Melbourne), by first hat: club seat, then coach page, then parent, then player record.
  * **Approvals sent** counts distinct invitations with an `email_sent` or `sms_sent` row on the spine today.
  * **Approved** counts **of those** the ones approved, so "% of sent" cannot pass 100.
  * **Registrations** are live registrations, and the clubs they are at.
  * **Held** means live registrations at claimed clubs, the queue's own figure.
  * **Clubs awaiting a call** comes with the oldest wait in days.
* **The page asks the database for those two things only.** It links nowhere but `/ops/support` ("Open in lookup", no query string).
* **The tiles.** Two across on a phone, four from 768. A zero tile, or a zero part of a line, is omitted (D-162).
* **"Live subscriptions" is left out.** The footer sentence is the signed one.

### 6 · The call sheet (`app/ops/call/[clubId]/page.tsx`), after F merged
* **The claim card, in the design's words:** "Claimed {29 September} by {name}." While the club waits and has registrations held, it adds "**{n} registrations held.** Do not mention that number on the call."
* **F's TD card is carried through untouched.** That covers its approved words, the {Name}/{Club} confirmation that doubles as the card's status after an ending, the Why well and "End this Technical Director's access". Only its section head is now the charter's section label.
* **The handover-on-call behaviour lives in 0100 and `logCall`, neither of which I touched.** Every posted field name and value is the same.
* **The guidance comes out of the labels**, as sentences under short section heads:
  * **Operator / Answered by.** Each has a short label with its old guidance as a line beneath.
  * **"The number — find it yourself".** The design's two sentences, then **Number called** and **Where you found it**, then "A blank here invalidates the call and the flag cannot be set." That sentence is true: `validate-migrations` M4 has the database refuse a blank source.
  * **"The four questions", as one group.** Club confirmed / Person confirmed / Incorporated / Authority confirmed.
    * Each answer is a **segmented choice**: real radios in 44px segments, with the same values (yes/no, unknown/yes/no) and the same defaults the selects had.
    * Under the group: "Ask *"who would that be?"* — never *"is it {claimant}?"*…", the design's line with the real claimant's name.
  * **Outcome and Why stay selects.** The approved Why label keeps its words. Its second sentence now sits under the control instead of inside the label.
  * **Technical Director.** Name / Email address, with their old guidance beneath.
  * **Notes.** The design's head and line.
* **Layout.** One column on a phone, pairs two-up from 640px, and the signed content width at a laptop.

### 7 · Other things the squeeze check found
* Legal tables (`app/legal/legal-page.tsx`) keep 150px cells and scroll sideways inside their own box. The text is untouched.

### 8 · Tests
* **Permission suite** (+8), ops-t1 to ops-t8:
  * the result columns from the catalogue;
  * the function bodies' select lists;
  * the page's exact query text and its only link;
  * the functions driven: a joiner, a sent-and-approved invitation, an older request approved today (in neither figure), and a failed text whose number and body appear nowhere in the answer.
* **Render** (+10):
  * s4/s4b now cover `/ops` and `/ops/reports`;
  * ops-r2 to ops-r5 for Today: tiles, never a zero, the footer, no door but the lookup;
  * ops-r6: the call sheet's tracked-caps captions are 32 characters or fewer;
  * ops-r7: the four questions are radio groups with their old values, and no select.
* **Write** (+3), today-w1 to w3. After a day of presses, Approvals sent is 4, Approved is 2 with "50% of sent" agreeing, and no zero.
* **Layout.**
  * The squeeze rule.
  * Every Today tile drawn inside the screen, not a zero, and at least one tile.

## Ran

On `e981fc8`, fresh seed, §4 order:

| Suite | Result |
|---|---|
| perms | **1690/1690** (1682 on `app` after F + my 8) |
| render | **585/585** (+10 mine) |
| write | **421/421** (+3 mine) |
| layout 375 1280 | **ALL GREEN, 218 views** |
| layout 640 768 1024 | **ALL GREEN, 327 views** (the call sheet's pair breakpoint and the table and rail edges) |
| layout, console widths (375 768 820 834 1023 1024 1031 1032 1280) | **ALL GREEN, 981 views**, on part 1 before the call sheet |
| timing | **18/19**, J61 INCONCLUSIVE, see below |
| tsc | 0 errors |
| palette | ALL GREEN |
| corpus | 0 failures, 0 warnings |
| gate-coverage | 263 pinned, 0 open |
| secret-scan | no secrets |
| validate-migrations | ALL GREEN |
| build:check | built, all six `/ops` routes dynamic |
| test:csp-prod | **5/5** |

**J61 is inconclusive, not failing.**
* I ran timing three times on a fresh seed and a fresh app. Each started under load 8, and each saw the load rise to 9–12 as round H worked beside me. One further run I stopped myself when F merged.
* Every run: J61 said **not distinguishable** on both pages.
  * `/home`: shift +0.20ms (p 0.28), then +0.16ms (p 0.68).
  * `/club/register`: shift −0.06ms (p 0.65), then −0.53ms (p 0.10).
* But its resolution was 1.13–1.88ms against the 1ms bar, so the suite calls it inconclusive.
* The other 18 rows, including E10, tok-rl, req-t and L40, resolved at 0.47–0.82ms and passed.
* J61 reads `/home` and `/club/register` for a held club, and I changed neither page. It needs one run on a quiet machine, which I could not get today.

**Red proofs.** Each check was run with the bug put back, then restored and checked with `cmp`:

| Check | Bug put back | Result |
|---|---|---|
| squeeze | today's `/ops/verification` | 35 named failures at 375 |
| ops-t1 to t5, t8 | a text column on `fn_ops_today`; `to_address` on the failures function; `select first_name from person` in the page; a lookup link built from data | 6 FAIL |
| ops-t6 | the player hat dropped | FAIL `[1,0,1,1]` |
| ops-t7 | approved counted all-time | FAIL `[2,1,false]` |
| ops-r2, ops-r5 | a 0 tile; a link to `/ops/call/…` on Today | both FAIL |
| layout Today | the 0 tile | FAIL |
| today-w1 | the tile relabelled | FAIL |
| today-w2, today-w3 | % off by one, and a 0 tile | both FAIL |
| ops-r6, ops-r7 | F's call sheet, restored for one render run | both FAIL. ops-r6 listed "Operator — the human. Named, every time. Never "system", never "admin"." and eight more; ops-r7 found `[[],[],[],[],true]` |

The first today-w1 red crashed w2 on a null. I made w2 null-safe, re-proved it, and re-ran the whole line.

**Screenshots,** all as the operator seat, in `.run/shots/`:
* **`before/`** (from `287a5d4`) and **`after/`** (from `e981fc8`, fresh seed). Each has `ops_verification`, `ops_reports`, `ops_support`, `ops_support_q_guardian@example.com`, `ops_switches` and `ops_call` at 375 and 1280.
* **`after/ops-375.png` and `after/ops-1280.png`:** Today, which has no "before".
* **`after-write/ops-*.png`:** Today with every tile and the delivery-failure table. The state is after the write suite plus two failed sends inserted by hand, with the app stopped. The database was reseeded after.

## Found

1. **`/terms` serves our drafting notes (L16), out of lane, not fixed.**
   * The served page includes "**[OUTLINE]** 3.3 Children aged 16 and 17. **[LEGAL: doc 18 Q7.]** … Counsel to settle."
   * It includes an open-questions table with rows reading "**Suppression clause promises a capability that does not exist yet — do not publish**" and "**Guardian-contact gate at 2.3 is not current behaviour — do not publish**", each with "Must not publish before it is built".
   * The footer says "… v2.0 · 28 September 2026 · **for legal review** · …".
   * Source: `docs/legal/22-Terms-of-Service.md` lines 100, 325 and 356–357. `lib/legal-doc.ts` strips the preamble only. This needs a call before 1 Oct.
2. **`/ops/switches` prints "$0.00 spent this month".** That is a zero (D-162), but render free-r1d exempts the operator's own spend. It needs a ruling.
3. **The call sheet keeps an existing sentence about money:** "…they flag the subscription, not the safety check." With billing off (D-163) it describes nothing live. I left it because it was already on screen.
4. **The call sheet's four answers default to yes / yes / unknown / unknown**, exactly as the selects did. A safety reviewer may prefer no default on "Club confirmed" and "Person confirmed", so the operator has to choose. That is a behaviour change, so I did not make it.
5. **The design calls the lookup "Lookup", and our door is "Support".** "Open in lookup" lands on a page titled Support.
6. **Provider failure words show raw** ("undelivered", "email.bounced", "http_400"). A friendly mapping would be new words.
7. **Not built, because the product has no such thing or it is about money:**
   * the design's "Doc 27 — the script" and "Close the report" buttons;
   * the single-report view in OpsReports (time-boxed access, "Take the clip down");
   * `OpsLookup.dc.html`;
   * the call sheet's "Verify {club}" / "Not verified — log and leave held" button pair (the four-value outcome select stays);
   * the call sheet's "What this writes" card, which names payment;
   * the call sheet's subtitle "Doc 27 · set the flag afterwards, never during the call".
8. **A club that signed up but has not claimed holds no hat.** It is in "Signups today" but in none of its parts.

## Copy for BUZ

**From the signed designs, placed on screen:**
* **Rail:** "Pitch operations" · "Today" · the counts beside Verification and Reports.
* **Queue:** "Club" · "Claimed" · "Held". The Claimed cell reads "{d Mon} · today", "{d Mon} · 1 day ago" or "{d Mon} · {n} days ago", and "{d Mon}" once verified.
* **Reports:** "Report" with "received {d Mon, h:mm am}" · "About" · "From" · "What they wrote".
* **Today:**
  * header: "Today" · "{Weekday} {d} {Month} · Australia/Melbourne";
  * tiles and their lines:
    * "Signups today" · "{n} player · {n} parent · {n} coach · {n} club";
    * "Approvals sent" · "to guardians";
    * "Approved" · "{n}% of sent";
    * "Delivery failures" · "{n} SMS · {n} email · see below";
    * "Registrations" · "across {n} club(s)";
    * "Held" · "clubs not yet verified";
    * "Clubs awaiting a call" · "oldest {n} day(s)";
  * the failure table: "Delivery failures — last 24 hours" · "These are the ones worth acting on. A guardian who never received the SMS reads as "the parent ignored us" everywhere else in the funnel." · "Channel" · "When" · "Provider said" · "SMS"/"Email" · "Open in lookup";
  * the footer: "Everything on this page is a count. No name, no record, and no way to get to one from here — the only route to an individual is a lookup against a contact detail somebody gave you.";
  * the tab title "Today".
* **Call sheet:**
  * the claim card: "Claimed {d Month} by {Name}." · "{n} registration(s) held." · "Do not mention that number on the call.";
  * the number: "The number — find it yourself" · "Ring the number you found. Never the number on the claim form." · "Ringing the claimant's own number confirms only that they own the phone they wrote down." · "Number called" · "Where you found it" · "A blank here invalidates the call and the flag cannot be set.";
  * the questions: "The four questions" · "Is this the club?" · "Ask "who would that be?" — never "is it {claimant}?". Offering the name leaves them nothing to do but agree.";
  * notes: "Notes" · "Anything that felt off belongs here even if you verified anyway."

**Existing words, split out of a label into a short label and a line beneath** (no word added):
* "Operator" + "The human. Named, every time. Never "system", never "admin"."
* "Answered by" + "Name and role as they gave it."
* "The actual number dialled."
* "Club confirmed"
* "Person confirmed" + "Did they independently name the claimant?"
* "Incorporated" and "Authority confirmed", each + "As answered."
* "Why" + "Recorded only when the outcome is suspended or takedown. It decides whether families are told." These are your approved words, split.
* "The name they gave you on the call. Recorded only when the outcome is verified."
* "As the club gave it."
* The answers now read "Yes", "No" and "Unknown", capitalised.
* "Verifying releases every held registration to this club." now sits under Outcome.

**Assembled from words already on screen, listed so you can see them:**
* **Call sheet:** the captions "Name" and "Email address", and a red "*" marking the three required fields.
* **Queue:** "{n} held" on a phone row.
* **Today:** "coach" and "email" in its sub-lines.

**Removed:**
* "Payment does not change that and cannot." You approved this.
* "Reply to: {email}". The address is now under "From".
* The rail kicker "Operator".

**Held, because billing is off (D-163):** "Money" · "Live subscriptions" / "1 monthly · 1 annual" · "Authorised to subscribe?" / "Yes — treasurer confirms".

**For you to decide:** should the "Support" door become the design's "Lookup"?

**No other new words.**

## Risks

* **J61 has not been seen green on this tree.** I think it is machine noise: it was never distinguishable, its resolution was 1.13–1.88ms, and I did not change its pages. It needs one run on a quiet machine before this merges.
* **"Today" is my definition, and Leo should confirm it is the figure BUZ wants.** It means the Melbourne date, and Approved means a share of today's sends, not approvals made today.
* **Only permanent failures are listed.** A transient one being retried does not appear.
* **No suite draws the delivery-failure table on seed data.** I saw it only in the hand-made screenshot. The functions behind it are driven in ops-t8.
* **ops-t3 reads select lists by stripping WHERE, ON and EXISTS clauses line by line**, which is crude. ops-t1, t2 and t8 are the firm guarantees.
* **Every ops page now makes one more small count query and a second `requireOperator`**, the one the frame makes.
* **The call sheet's radios are visually hidden inputs inside 44px segments.** The keyboard reaches them and they show the ring, but the focus-ring walk (RING_PAGES) does not include the call sheet.
* **The legal-table CSS also applies to the approval flow's embedded doc 21.** Layout is green there.

Lesson: a page can fit the screen and still be unreadable. The overflow check measured where the page ended, and `/ops/verification` passed it with a column 1px wide. Measure where the words land. That is a check in the suite now.
