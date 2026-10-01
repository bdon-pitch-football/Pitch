# Safety review: the trials board, Floodlit (1 Oct 2026)

**From:** the safety seat, for the Head of Product Design, then Leo.
**Change:** the uncommitted work in `.claude/worktrees/trials-board` (branch `design/trials-board`, off `94a3b4a`). Files: `app/trials/page.tsx`, `components/floodlit/TrialRow.tsx` (new), `app/globals.css`, `scripts/render-tests.mjs`, `scripts/write-tests.mjs`, `docs/06-Register.html`, `CLAUDE.md`. Builder's report: `2026-10-01-build-trials-board.md`.
**Result:** 0 blockers, 1 must-fix, 6 notes. `npm run -s test:perms`: 1951 passed, 0 failed.

---

## Must-fix

### M1. The register records the doors without P4's limit: "signed-out visitors only"
- **Where:** `docs/06-Register.html:923` (the new sentence at the end of the D-173 `w` block).
- **What it says:** "an empty board hides its filters and offers the two doors."
- **What BUZ approved:** P4 in `2026-10-01-proposal-trials-and-join.md:176` is "Two doors on the empty board, **signed-out visitors only**, in words already approved elsewhere". The register leaves out the limit, so it records more than BUZ approved.
- **Scenario:** a later builder reads D-173 as the rule and puts the doors on the signed-in empty board as well. A 13-year-old in the player frame then sees "Claim your club page", and the register backs the builder up. The code is right today (`page.tsx:156`). The record is what the next change will be checked against.
- **Smallest fix:** "…and an empty board hides its filters and note and, to signed-out visitors only, offers the two doors in words already approved; "No trials listed yet." is approved (N1)." Use `&mdash;` rather than a literal "—" to match the rest of the file. Leo then copies it byte for byte to the folder copy.

---

## Notes

### N1. The write-suite block leaks no state and weakens no check, but it can skip a club silently or crash the run
- **Where:** `scripts/write-tests.mjs:3495`.
- **State leak: none found.**
  - The diff only adds lines. No existing check or helper was edited.
  - The block is the last one in its scope. Only `addr-w3` runs after it, and that reads `tokenWatch`. The five call-sheet posts only add to `tokenWatch.redirects`, which is asserted `> 100`, so they can't push it toward failing.
  - Riverside and Kingsway stay suspended at the end. Every other suite already expects a reseed after the write suite, and the suite prints that warning.
- **The rough edge:**
  - `if (ids.clubs[slug])` silently skips any listed club the fixtures don't know. That is still loud in the end, because `empty-w0`'s count would not reach 0.
  - `logCall` dereferences `form.fields` with no guard. If a listed club's call sheet has no outcome form (for example, one of the 183 loaded unclaimed clubs given a compiled notice in a future seed), the suite throws a TypeError. It then never reaches `addr-w3` or the pass/fail summary.
- **Fix (optional):** assert `listed.every((s) => ids.clubs[s])` inside `empty-w0`, and guard `form` in the loop.

### N2. The door rule is right, but the test covers only one kind of signed-in visitor
- **Where:** `page.tsx:155-156`; the test is `write-tests.mjs:3513`.
- **The code is correct.** `doors = boardEmpty && !me`, and `me` is `getSessionPersonId()`, the same check `PublicAnalytics` uses. Any live session gets no doors: player, guardian, under-16, coach, club administrator or TD, whatever their frame. A revoked or forged cookie counts as signed out, which is also correct.
- **The gap:** `empty-w3` checks only Nate, who is 17 and in the player frame.
- **Scenario for a regression:** someone switches the rule to `!seat` so it matches `TrialsFrame`'s `resolveSeat()`. That returns null for a club or coach seat, so a signed-in coach or club administrator would get the doors, and no check would catch it.
- **Fix (optional):** add a guardian (the parent frame) and Marina (a club seat) to `empty-w3`.

### N3. Signed-out children still see the club door, which adds no new route
- **What happens:** a child who isn't signed in sees "Claim your club page" on the empty board.
- **Why it adds nothing:** the signed-out nav's "Find your club" already goes to the same `/claim` on every board. Whether `/claim` keeps a child out is outside this change, and I didn't review it.

### N4. The month is green on every row, including unclaimed ones
- **Where:** `app/globals.css:1053` (`.fl-trial-mon`).
- **What changed:** the old board tinted the date green only for a verified club and grey for the rest. Now every row's month is accent green.
- **Why it isn't a D-172 breach:** the words still say "Unclaimed listing · register via club", and the club page's own row does the same (`app/fc/[slug]/page.tsx:272`).
- **Still worth a look:** D-173 (4) says "green is an action", and a month isn't one. This is for the Head of Product Design, not a safety fix.

### N5. CLAUDE.md is right only for signed-out visitors
- **Where:** `CLAUDE.md:139` and `:155`. They match P1: the board is added to the 1200px list, with "the filters as a rail beside the list".
- **The gap:** a signed-in seat at 1280 gets no rail. The builder lists this as difference 1.
- **Nothing else:** neither CLAUDE.md edit says anything BUZ didn't approve.

### N6. BUZ's "Yes to all" is recorded nowhere except this change
- The proposal file has no BUZ response. The quote appears only in the builder's report and in the new register line.
- I couldn't check it against BUZ's own message. Leo should confirm it before it lands.

---

## What I checked and found clean
- **One read.** The page reads the board only through `fn_trial_notices_advertised()`, with the query unchanged (`page.tsx:49-58`). A suspended club is still removed by the database's answer, not by the page.
- **D-21.** The board is still `order by t.trial_on`. `me` only chooses the frame and the doors. It never filters, orders or personalises what is listed.
- **D-90.** The source logic is unchanged (`page.tsx:246`, `TrialRow.tsx:45`), with `rel="noopener noreferrer"`. `source_url` is limited to `https?://` when it is written (`0130_pitch_curates_the_board.sql:245`).
- **D-162 and D-172.** `TrialRow` shows no crest, image or club colours. The unclaimed label and the secondary "Send my CV" to `/fc/<slug>#play` are unchanged. D-162's zero-count chips are unchanged.
- **D-163.** There is no price anywhere.
- **CSP.** The live header on :3041 carries `img-src 'self' data: blob:` (`lib/csp.ts:46`), so the static `data:` SVG mask (`globals.css:1063`) is allowed. It holds no user input, and `style-src` was already `'unsafe-inline'`.
- **Analytics on minors.** `<PublicAnalytics />` is unchanged. It is mounted once for both frames and returns nothing to any session. `analyticsBeforeSend` still strips the filter query.
- **Caching.** The page is `force-dynamic`, so the signed-out HTML (with the doors) is never cached and served to someone with a session.
- **Nothing new on the server.** There is no new route, server action, permission function, `lib/record-read.ts` use, service-role use or SQL beyond the existing query. No `dangerouslySetInnerHTML` is used, and every database string is rendered as React text.
- **Words.** The door and nav words are the approved ones from P4 and P2, and N1 is the only new line.

## What I did not check
- **The render, write and layout suites.** I didn't run them, because they change the dev database the builder is using on :54341. I relied on the builder's counts and on reading the checks.
- **The signed-in empty board.** I didn't draw it myself. For "no doors when signed in" I relied on the code and on `empty-w3`.
- **`/claim` and `/join`.** I didn't review how they handle a child.
- **BUZ's quote.** I didn't check "Yes to all" against his message.
- **The folder copy of the register.**
- **The CSS glow and box-shadow lines,** which I skipped as briefed.
