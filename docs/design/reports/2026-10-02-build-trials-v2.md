# Build: the trials board, v2 (2 Oct 2026)

**From:** the builder seat, for Leo, then the Head of Product Design and BUZ.
**Approved:** BUZ, 2 Oct, "yes" to the design and all its words (`design/player-cv` e4a84d9, specs README "Trials board v2"). John's ruling of the same day on the unclaimed disclaimer.
**Design:** `docs/design/reports/2026-10-02-proposal-trials-v2.md` and `docs/design/mockups/floodlit-trials-v2.html` (f9b79b0).
**Worktree:** `.claude/worktrees/trials-v2`, branch `build/trials-v2` off `83dd981`. Database 54591, app 3391, layout DevTools 9591. csp-prod ran on 3391 after the dev app had stopped.
**Built:** parts 1–4 of the design: the quiet marker, the weekday, the EOI section, and one row per club per day with the shorter card. **Held:** Region (`?area=`) and Distance. They wait for John's four questions.

---

## What changed

| File | What |
|---|---|
| `lib/trials-board.ts` (new) | Pure functions, with no database read: `isEoi` (the time starts "EOI closes"), `splitTimeVenue` (at the first " · "), `startMinutes` (from the front of the time: "6:45–7:45 pm" is 18:45, a weekday in front is skipped, and an unparsed time is null and sorts last) and `groupByClubDay`. Rows are ordered by date, then earliest start, then club name. Lines in a row are ordered by start. The sort is stable. |
| `components/floodlit/TrialRow.tsx` | Now one club, one day. The date block is the weekday over the numeral (`numeral fl-trial-day`, unchanged) and the month. The club's name comes next, with its state beside it, then a `<ul>` of `<li class="fl-trial-line" data-listing>`. A venue every line shares moves up under the name. The stamps and "The club's own notice" sit once in the foot when every line shares them; otherwise each line carries its own. An unclaimed row has one "Send my CV" in the foot. A club on Pitch has one "I'm interested" per line, each carrying its own `?trial=` (D-153); a one-line row carries it in the foot. `data-unclaimed` is on the `<article>` and on every `<li>` of an unclaimed club. The post-trial preview (`inert`) is unchanged in behaviour. |
| `app/trials/page.tsx` | The query adds `wd` (`upper(to_char(trial_on,'Dy'))`), `on_date` and `club_id`. It is still one `fn_trial_notices_advertised()` read (susp-ad-s2). Listings are filtered exactly as before, then split into trials and EOIs, and each part is grouped. "N trials" counts trial listings. The section "Expressions of interest" has its own number and "By closing date.", and is not drawn when empty. The note is now two `<p>`: the approved sentence, then the intro line with "Last checked". Chip counts are unchanged (all listings, both sections). The empty line shows only when both sections are empty. |
| `app/globals.css` | THE TRIAL ROW becomes v2: phone padding 14/14/10; weekday 10px/900 `--ls-label` muted; club 16/800; venue 13 muted; lines 14/700 and 13 muted; a multi-line row has a 1px `--line` rule at 10px in. No divider: `.fl-trial-foot` has no border. The stamps sit over the notice on the left with the button on the right; from 768px the foot sits beside the row. `.fl-own` keeps `min-height: 44px` with `margin: -8px 0`, so its box is a 44px target that reaches over the stamp line. `.tb-how` paragraphs, plus `.tb-sec`, `.tb-sec-n` and `.tb-sec-sub` for the second section. There is no new token, colour, radius, weight or size. `letter-spacing: normal` resets the section number from the heading's title spacing. |
| `app/club/post-trial/page.tsx` | The "Posted" preview draws the v2 row. Its stamps read `FMDD Mon` ("2 Oct", as the board does; it said "02 Oct"). |
| `app/fc/[slug]/page.tsx` | The club page's date blocks gain the weekday (`fl-trial-wd`). Nothing else changed there (see "Left"). |
| `scripts/dev-db.mts` | Westgate Rangers (fictional, compiled, unclaimed) gets three fixtures through `fn_ops_add_notice`. The first is "U12 Boys trials", same day and same notice as its U13s, at "Mon 4:30 PM", written after the U13s so the row must order by time. The other two are expressions of interest ("Senior women…", "U16 Girls…") at "EOI closes", "Online — see the club's notice", closing `greatest(30 Nov, today + 30)`, from two different notices. Their ids go to `.dev-ids.json` as `boardV2Notices`. |
| `scripts/render-tests.mjs` | New block tv1–tv5 (nine checks), and link-n2 moved (below). |
| `scripts/write-tests.mjs` | New tv-w0. cur-w6, cur-w9, cur-w11 and `listingOf` moved (below). |
| `scripts/layout-check.mjs` | New tb-foot pass on `/trials` at every width. |

## Strings, verbatim

**Added** (all approved by BUZ, 2 Oct):
- "Unclaimed" (the row marker);
- "Unclaimed listings are compiled by Pitch from each club's own public notice. Those clubs have not claimed their page." (the note, rendered with ’);
- "Expressions of interest";
- "By closing date.";
- MON TUE WED THU FRI SAT SUN (derived from the date).

The section heading's number is a count.

**Removed:**
- "Unclaimed listing · register via club";
- the " · " that joined "Club · title" on the board's rows and the post-trial preview. The name and the title are now two elements, as the design says.

**Moved:** " Last checked {d Mon}." now ends the new second sentence of the note rather than the first, as drawn.
**Reformatted:** the post-trial preview's "Listed 02 Oct · checked 02 Oct" now reads "Listed 2 Oct · checked 2 Oct".

## The counts (fresh seed, the order as briefed)

| Step | Result |
|---|---|
| perms | 2206 passed, 0 failed |
| render | 836 passed, 0 failed (827 before, plus tv1–tv5's nine) |
| write | 660 passed, 0 failed (659 before, plus tv-w0) |
| reseed, next dev restarted, layout 375 1280 | 274 page views, 0 failed, 0 chrome failures. tb-foot: 10 rows (5 rows × 2 widths) |
| palette | ALL GREEN (8 OK) |
| `tsc --noEmit` | 0 errors |
| `NEXT_DIST_DIR=.next-check next build` | built |
| csp-prod | 5 passed, 0 failed |
| corpus | 0 failures, 0 warnings |
| secret scan | no secrets found |
| gate coverage | 266 of 266 doc 14 rows pinned, 0 open |

## New checks, each shown red

**Against the old markup.** The page, row, CSS, post-trial and club page were put back from 83dd981, with the new seed and the new suites. Render then went 827 passed, 9 failed, and the 9 failures were exactly the new ones:

| Check | What it holds | Red on the old markup with |
|---|---|---|
| tv1 | Each unclaimed row has exactly one `<span class="fl-trial-state un">Unclaimed</span>`, with `data-unclaimed` on the `<article>` and every `<li>`. A verified row carries neither and keeps `<span class="fl-trial-state">On Pitch — verified club</span>`. "Unclaimed listing ·" and "register via club" are nowhere. | 0 unclaimed rows; the retired line present |
| tv1b | The intro line, verbatim, once. | 0 |
| tv2 | Every date block's weekday is its own date's, on the board and on `/fc/riverside-fc` and `/fc/westgate-rangers`. | no weekday on 7 rows and both pages |
| tv3 | The section is there with "Expressions of interest", its number and "By closing date.". No "EOI closes" line sits above it, and every line below it is one. Its number is its lines. Each line has its "checked" stamp and the club's own notice. Rows are in closing-date order. | no section |
| tv3b | `?gender=women` gives "0 trials", the section with 1, and no empty line. `?gender=men` gives no section and the approved line. | "1" trials |
| tv4 | `<li data-listing>` count = trials + EOIs. No club appears twice on one day. A multi-line row exists. Westgate's lines are U12 then U13 (time order, not insertion). Rows are in date order. | 0 lines |
| tv4b | `?age=U13` draws Westgate's U13 line alone; `?age=U12` its U12 line alone; `?age=U17` no Westgate row. On each, the count is of listings. | no lines |
| tv4c | Each age and competition chip's number = the listings its board draws (11 chips). | every chip "draws 0" |
| tv5 | `.fl-trial-foot` has no `border-top` and is not a column. `.fl-own` is ≥44px. Every row's one door is in its foot, with a shared notice beside it. | `border-top` present |

**Layout, tb-foot:**
- On the old markup it failed 7 rows at 375 ("a 1px divider above the foot").
- With the foot forced into a column (mutation M5), it failed "the notice link (780–824) and the button (828–876) are not on one line" at 375, and the same at 1280.

## Existing checks that moved, and why (same strength or stronger)

All moved because the row's markup moved on purpose: one row per club per day, with the name and title in two elements and the state above the stamp.

- **render link-n2:** it now splits the board on `<article` instead of `>Listed `. The state sits above the stamp now, so splitting at "Listed" handed each verified row's "On Pitch" to the row before it. The assertion is unchanged (no verified row carries "The club's own notice"). **Red with M4** (a verified row given a notice link): `[true, false]`.
- **write cur-w6:**
  - it was `/Brackenfold Rovers · U11 Girls/` plus "Unclaimed listing · register via club" anywhere on the board. Westgate's row alone satisfied the second half.
  - It is now: Brackenfold's own `<article>` (name element plus line title) carries `data-unclaimed`, its own "Unclaimed" and its "Send my CV". That is stronger.
  - **Red with M2** (marker dropped): `[…, true, false, true]`. **Red with M3** (line title not drawn).
- **write cur-w9, cur-w11:** the joined string became `rowOf(board, 'Brackenfold Rovers', 'U11 & U12 Girls')`. **Red with M3.**
- **write `listingOf`** (one-w1, susp-ad-w*):
  - it was a slice from "Club · " to the end of the first door. It is now the club's `<article>` that holds its door.
  - one-w1's label test changed from `/Unclaimed listing|verified club/` to `/Unclaimed|verified club/`: a claimed club still carries no label.
  - **Red with M1** (a claimed club drawn as unclaimed): `[false, false, true, false]`.
- **write tv-w0 (new), and why the seed's fixtures come off first:**
  - The write sweep stops at 60 pages per seat. The three fixtures add pages: the U12 and Women chips, and a `?trial=` view each.
  - Those pages moved which seat met Jordan's forms first, and ks-w0, sq2 and sq3 went red. That is L32's shape, as the crawl's own comments record for brief K and B1.
  - Measured: base code with only the new seed failed the same three; the untouched base was 659/659.
  - Skipping the chips in the crawl reshuffled it the other way and crashed at ks-w0's setup, so it was reverted.
  - So the write suite removes the three fixtures first, through the operator's own Remove. tv-w0 checks: 3 removed, no "U12 Boys", no section, 4 lines (the board the sweep always walked).
  - Removal leaves only `curation_event` rows, and no page renders those.

## For the tech team (13-Board-Room), not built

1. **`trial_notice.kind`**:
   - the column: `text not null default 'trial' check (kind in ('trial','eoi'))`, backfilled where `time_venue like 'EOI closes%'`;
   - the desk's CSV, `fn_ops_add_notice` and `sync-trials` take it.
   - This is the design's recommendation. Until it lands, `lib/trials-board.isEoi` reads the "EOI closes" prefix, which is the design's interim. When the column exists, `isEoi` should read it, and the query should select it.
2. **Time and ground as two columns.** Today they are joined with " · ", and the row splits at the first one. A ground containing " · " or a time-less club post ("Ground" alone) is read as the time.

## Left, and calls for the Head of Product Design / Leo

- **Two places where Leo's brief and the 390 artboard differ.** I followed the artboard.
  - The brief put the marker in the footer. The design puts it beside the club's name, and the foot holds the stamps and notice on the left and the button on the right.
  - The brief said each line keeps its own notice link and stamp. The design draws them once in the foot when every line shares them, and per line when they differ. No listing loses its link.
- **"0 trials" beside expressions of interest.** On a filter that leaves EOIs and no trials (e.g. `?gender=women` on the seed), the count reads "0 trials", the section shows, and there is no empty line. No state draws this.
- **The intro line shows whenever the note does**, including on a view where every row shown is verified.
- **Seed times still say "Sun 9:00 AM".** The design asked to drop "Sun". I did not, because `scripts/demo-layer.mts` (`alignTrialsToTheirOwnWeekday`) rolls the demo's dates to the weekday written in that text. Dropping it un-pins BUZ's demo trials from the weekend. So the seed's verified rows read SUN / 11 / OCT and then "Sun 9:00 AM". The live desk data carries no weekday.
- **The demo board shows the v2 fixtures.** Westgate grouped plus two EOIs. They are fictional and from the same seed.
- **`/fc/[slug]` got only the weekday.** The design says the club page "uses the same row". It doesn't: it has its own linked rows that pick a trial (D-153), and v2 draws no club-page state. So the club page:
  - still lists EOIs among its trials and counts them in "N trials coming";
  - prints the numeral as `DD` ("05");
  - keeps a day's notices in insertion order.

  See `after-fc-westgate-390.png`. This needs a design state.
- **Other date blocks are untouched:** `/home` (`chp-row`), the post-trial "Your trials" list (`pt-trial`) and `ClubHeroPreview`. They are console and home blocks the design did not draw.
- **Region and Distance are held.** There is nothing for them in the code.

## Screens

`docs/design/reports/2026-10-02-trials-v2-shots/` (untracked):
- `before-trials-390.png` and `before-trials-1280.png`: the base board on the base seed;
- `after-trials-390.png`, `after-trials-1280.png` and `after-fc-westgate-390.png`: the fresh seed.

Compared with the mockup's default state at 390 and 1280:
- **Matches:** the date block (weekday, numeral, month); the name and grey "Unclaimed" (or green "On Pitch — verified club"); the shared venue under the name; the ruled lines in a multi-line row; the foot of stamps and notice beside "Send my CV"; the section rule; "Expressions of interest 2" and "By closing date."; per-line stamps where the notices differ; at 1280, the foot beside the row.
- **Differences:**
  - the data is the seed, not the live board;
  - the verified sample in the mockup keeps its venue in the line, while the build moves a venue every line shares up for every row (one rule);
  - the "N" in the corner is `next dev`'s overlay.

The servers are stopped, and `.next` and `.next-check` are deleted.
