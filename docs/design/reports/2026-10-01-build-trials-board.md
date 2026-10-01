# Build: the trials board, Floodlit (1 Oct 2026)

**From:** the builder seat, for the Head of Product Design, then Leo and BUZ.
**Approved:** BUZ, 1 Oct, "Yes to all" to P1–P4 and N1 (`2026-10-01-proposal-trials-and-join.md`).
**Design:** `docs/design/mockups/floodlit-trials.html` (six states).
**Worktree:** `.claude/worktrees/trials-board`, branch `design/trials-board` off `94a3b4a`. App 3041, database 54341, layout DevTools 9341.
**Status:** nothing is committed. Nothing is pushed or deployed.

---

## What changed

| File | What |
|---|---|
| `app/trials/page.tsx` | Rebuilt the render. The query, the filters, the counts, D-162, chronological order and the analytics mount are unchanged, and it still makes one `fn_trial_notices_advertised()` read (susp-ad-s2). |
| `components/floodlit/TrialRow.tsx` (new) | The board's trial row, drawn as the club page's row: the date leads (28px numeral and month), then the title and time/place, then the stamps. "Listed" is a prop. The one action uses the charter buttons: "I'm interested" is the 50px primary, "Send my CV" the 46px secondary. |
| `app/globals.css` | New section, THE TRIALS BOARD, after THE PLAYER CARD. It adds no new token or colour. |
| `scripts/render-tests.mjs` | Four new checks, tb1–tb4. |
| `scripts/write-tests.mjs` | Five new checks, empty-w0–w4, at the end of the last block. |
| `docs/06-Register.html` | D-173 `w` block: the trials-board sentence, verbatim as briefed. |
| `CLAUDE.md` | "The trials board" added to the Floodlit public pages row and to change (2)'s list. |

**P1, the 1200px layout and the rail.**
- The board sits in `.fl-wide`, inside its own container (`.tb-root`, container queries, the same approach as the CV).
- From 1024px of board width, the filters are a 300px sticky rail beside the list. On a window under 700px tall the rail scrolls with the page.
- From 768px, a row puts its button beside it.
- On a phone the filter panel is unchanged: the `<details class="m-only trial-filters"><summary>` that t3 reads.
- The 390 order is unchanged: title, filters, chosen chips and the count, the note, the listings.

**P2, the nav bar.**
- Signed out, the board wears `SiteNav`, with "Find your club", "Trials" (marked current) and "Sign in".
- Signed in, it stays in `TrialsFrame` as today: the player's or parent's frame, or the plain page for a club or coach seat, with the logo top right.
- `components/player-shell.tsx` is untouched.

**P3, the empty board.**
- A board with no trials at all shows no filters and no how-it-works note.
- A board filtered to nothing keeps both.

**P4, the two doors.**
- They show on the empty board, to signed-out visitors only.
- "Build a CV first — it is what the club reads" goes to `/join` as the secondary button.
- The club card uses "For clubs & technical directors" (in amber, as on the club landing) and "Put your trials where families can find them.", with "Claim your club page" going to `/claim`. That is the one primary on the screen, with the glow.

**N1.**
- "No trials listed yet." shows on the unfiltered empty board.
- "No trials listed for that yet." stays wherever something is chosen.
- In both cases the line is one `<p>`, with the first sentence bolded inside it.

**Fixed items, held:**
- Every other word is verbatim.
- The four filters stay: age group, competition, state (still only when more than one state), and positions wanted.
- Every listing keeps its "checked" date.
- "The club's own notice" is still exactly `<a href=… target="_blank" rel="noopener noreferrer" class="fl-own">The club's own notice</a>`, so link-n1 and link-n2 read it unchanged.
  - The external mark in the design is drawn by the stylesheet (a CSS mask with a `data:` SVG, which `img-src` allows), so the link's words stay its only content.
- Nothing new is shown about an unclaimed club (D-172).
- A suspended club's notices still come only through the database's answer.
- Analytics is unchanged (an-p3, an-r).

---

## The counts

These come from one run on a fresh seed after the disk was freed. Dev server and database were restarted on 3041/54341, and only one dev server was running.

| Order | Suite | Result |
|---|---|---|
| 0 | reseed | done |
| 1 | palette | 7 OK, 0 FAIL |
| 2 | tsc | 0 errors |
| 3 | perms | 1951 passed, 0 failed |
| 4 | render | 662 passed, 0 failed (the 4 new tb checks included) |
| 5 | write | 529 passed, 0 failed (the 5 new empty-w checks included) |
| 6 | reseed | done |
| 7 | layout 375 1280 | 238 page views, ALL GREEN |
| extra | layout 1024 1031 (the rail's tightest band, as the proposal asked) | 238 page views, ALL GREEN |

**Two things happened on the way, both put right before the counted run:**
- **empty-w3 failed on the first write run, and it was my test, not the product.** I had used Jordan as "a player". By the end of the write suite Jordan has a child linked, so he sits in the Parent frame (parent comes before player, as on `/home`). The board rendered correctly for him: the empty line showed and there were no doors. The check now uses Nate, who is still a player at that point.
- **The first layout run crashed in the `/join` Continue probe** (an evaluate that returned nothing, before any trials page). That was a cold compile. `/join` is untouched here. After a reseed, the rerun was green.

---

## Tests: none existing changed, nine added

**No existing check was rewritten.** t1–t5b, t3, z4, s19, one-r1, link-n1, link-n2, the one-w and susp-ad checks, and every other check that reads `/trials` pass unchanged.

**New render checks** (they need the seeded board):
- **tb1 (P2):** signed out, the board carries the public nav with Trials marked current, plus Sign in. A player sees their own frame and no public nav.
- **tb2:** every listing's action is `btn btn-primary fl-glow` ("I'm interested", carrying `?trial=`) or `btn btn-secondary` ("Send my CV"). No pill.
- **tb3 (P3, filtered side):** `?gender=girls&pos=GK` shows 0 trials and keeps the `trial-filters` details, the groups and the note. It shows the approved line as one `<p>` and not N1.
- **tb4 (P4):** the doors never show on a board with trials, or on one filtered to nothing.

**New write checks** (the empty board can only exist once every notice is off, which is the end of the write suite):
- **empty-w0:** every club still listing a notice is suspended through the operator's call sheet, the same door the block already uses for Kingsway and Westgate. On this seed that was Riverside FC and Kingsway Rovers. The board then shows 0 trials.
- **empty-w1 (P3, N1):** no filters, no groups and no note. "No trials listed yet." shows as one element, and "for that" does not appear.
- **empty-w2 (P4):** `/join` is the secondary and `/claim` the primary. Both approved club-landing lines are present. There is exactly one `btn-primary` on the page.
- **empty-w3:** Nate (a player, signed in) sees the empty board in the Player frame with no doors.
- **empty-w4:** an old link (`?gender=girls`) on the empty board keeps "Remove Girls" and says the approved "for that" line.

**Proof that each new check fails on broken markup.** I ran the same expressions against the page as built, then against deliberate breakages, then restored the files and confirmed with `cmp`:

| Breakage | Checks that failed |
|---|---|
| P3 undone (the empty board shows its filters and note) | empty-w1, w2, w3 |
| N1 undone | empty-w1, w3 |
| Doors shown to a signed-in seat | empty-w3 |
| SiteNav removed | tb1 |
| "Send my CV" put back on a `chip` | tb2 |
| A filtered-to-nothing board treated as empty | tb3, tb4 |
| The empty line split into two elements | tb3 |

---

## Screens against the mockup

**Captures:** `/private/tmp/claude-502/-Users-bdonmez22-Desktop-Life-Work-Pitch-3-0/adca61ff-729e-405b-9eb7-6c2d4cb5e557/scratchpad/shots/`

| Captures | State |
|---|---|
| `out-390`, `out-820`, `out-1280` | Full board, signed out, on the seed |
| `player-390`, `player-1280` | Jordan, the player frame, on the seed |
| `filtered-empty-390`, `filtered-empty-1280` | `?gender=girls&pos=GK` |
| `filtered-boys-1280` | `?gender=boys` |
| `empty-out-390`, `empty-out-820`, `empty-out-1280` | The true empty board, signed out (captured after the write suite had suspended every listing club) |
| `empty-player-390`, `empty-player-1280` | Nate, the true empty board, player frame |

I captured with a scratch CDP script, because `demo-walk.mjs` has no way to hold a session. Every capture has scrollWidth equal to its width.

**Matches:** the nav, the rail at 1280, the row (date first, stamps, the club's link with its mark, and the button beside the row from 768 or under it on a phone), the filtered-to-nothing state, and the empty board with its three dashed tiles and two doors, at 390, 820 and 1280.

**Where the build differs, for the head of design:**
1. **The signed-in board at 1280 has no rail.**
   - The rail is a container query at 1024px of board, as in the mockup.
   - Beside the seat's 232px rail, the board gets 968px, so it lays out as the 820 tablet does: the filter card is above a full-width list.
   - The mockup draws only signed-out states. If the frame should get the rail too, the threshold would be about 960px of board.
2. **Every "I'm interested" row glows (`fl-glow`), as the mockup draws it.**
   - The proposal's own list says "one glowing primary per screen".
   - I followed the mockup. Say if the row buttons should drop the glow.
3. **Dates read "01 Oct", not the mockup's "1 Oct".** That is the query's existing `DD Mon` format, and I left it unchanged.
4. **The club page keeps its own trial row.** The proposal suggested pulling it into the shared component. The club page wasn't in this brief and its row works differently (the whole row is a link, with a chevron and no button), so `TrialRow` is board-only and drawn to the club page's measurements. Folding the two together is a separate change.
5. **An old filtered link on a board with no trials at all** (`?gender=girls` when nothing is listed) is treated as the empty board:
   - no filters and no note;
   - the "Remove Girls" chip stays, so the choice can be taken off;
   - the approved "for that" line shows;
   - the doors show if signed out.

   The mockup doesn't draw this case. I chose it because there is nothing to filter.

---

## Words

- **New:** only N1, "No trials listed yet.", which BUZ approved on 1 Oct.
- **Approved words in a new place:**
  - "Build a CV first — it is what the club reads" (from the club page);
  - "For clubs & technical directors", "Put your trials where families can find them." and "Claim your club page" (from the club landing);
  - "Find your club", "Trials" and "Sign in" (the nav bar).
- **No other user-visible string was added.** The filter rail's `aria-label` reuses "Filters".

## For the tech team (13-Board-Room)

- **Nothing I needed is outside my lane.** No migration, permission function, `lib/record-read.ts`, proxy or CSP change.
- **The register's second copy.** `docs/06-Register.html` changed (the D-173 sentence). Per TRAINING, Leo copies it byte for byte to `../06-Design-Decisions-Register.html` when this lands on `app`. I didn't touch the folder copy.
- **The write suite's last block now also suspends Riverside FC** (any club still listing a notice), to empty the board. Only addr-w3 runs after it, and it doesn't read clubs. Reseed after the write suite, as always.

---

## Follow-up: the Head of Product Design's calls (1 Oct)

| # | Call | What I did |
|---|---|---|
| 1 | Signed-in seats keep the filter card above the list, with no rail | Kept as built. |
| 2 | The rows drop the glow. The glow belongs only to the screen's one primary | CSS only: `.fl-trial-foot .btn-primary.fl-glow` and its `:hover` get `box-shadow: none`. The markup is unchanged, so tb2 still reads `btn btn-primary fl-glow`. "I'm interested" stays the solid 50px primary. "Claim your club page" keeps its glow. |
| 3 | "01 Oct" stays | Unchanged. It's with Leo. |
| 4 | The club page's row stays its own | Unchanged. |
| 5 | An old filtered link on a board with no trials | Kept as built. |

**Re-run from a fresh seed, one dev server (3041/54341):**

| Order | Suite | Result |
|---|---|---|
| 0 | reseed | done |
| 1 | palette (the stylesheet changed) | 7 OK, 0 FAIL |
| 2 | tsc | 0 errors |
| 3 | render | 662 passed, 0 failed |
| 4 | reseed | done |
| 5 | layout 375 1280 | 238 page views, ALL GREEN |

After a further reseed, I recaptured `out-1280.png` and `player-1280.png` into `docs/design/screens/trials-board-1-oct/`. Afterwards I stopped the server and the database by port and deleted `.next`. Nothing is committed.

---

## Follow-up: the safety review's three fixes (1 Oct)

The review is `2026-10-01-trials-board-safety-review.md`. It found 0 blockers.

- **M1, the register.** The D-173 sentence now carries P4's limit and N1's line, and adds nothing else: "…and an empty board hides its filters and its how-it-works note and, to signed-out visitors only, offers the two doors in words already approved. Its one new line, &ldquo;No trials listed yet.&rdquo;, is approved (N1)." It uses `&mdash;` with no literal dash: the file has 135 literal "—", the same count as HEAD. Leo still copies it to the folder copy.
- **N2, the door check covers three seats.** `empty-w3` now reads a player (Nate, the Player frame), a guardian (Jordan, the Parent frame by then) and a club seat (Marina, TD, no seat frame). Each must see the line and neither door.
- **N1, the suspend-all loop fails loudly.**
  - New check `empty-w0a` counts any listed club that is unknown to the fixtures, whose call sheet has no form, or whose call sheet answers 400 or higher.
  - The whole block sits in a `try`, so an exception becomes a counted FAIL and the summary always prints.

**Proved before the clean run:**
- **N1:** I injected an unknown slug and a club id with no call sheet into the write suite. The run gave `531 passed, 1 failed - empty-w0a … (no-such-club: not a seeded club; ghost-club: the call sheet could not be pressed (…'fields'))`. The rest of the block ran, and the summary printed. The file was then restored and checked with `cmp`.
- **N2:**
  - With doors shown to every signed-in seat, all three `empty-w3` rows failed.
  - With doors shown to the club seat only (the frame-keyed rule the review describes), the club TD row failed.
  - The page was then restored and checked with `cmp`.

**The clean run, from a fresh seed, one dev server (3041/54341):**

| Order | Suite | Result |
|---|---|---|
| 0 | reseed | done |
| 1 | palette | 7 OK, 0 FAIL |
| 2 | tsc | 0 errors |
| 3 | perms | 1951 passed, 0 failed |
| 4 | render | 662 passed, 0 failed |
| 5 | write | 532 passed, 0 failed (the 8 empty-board checks included: w0a, w0, w1, w2, w3 ×3, w4) |
| 6 | reseed | done |
| 7 | layout 375 1280 | 238 page views, ALL GREEN |

Afterwards I stopped the server and the database by port and deleted `.next`. Nothing is committed.
