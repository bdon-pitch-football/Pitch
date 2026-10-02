# Build: the follow-up audit's ten fixes, `/g/pending` and both registers (2 Oct 2026)

**Seat:** design builder. **Brief:** Leo (head of technology). The fixes come from the Head of Product Design's follow-up audit, `2026-10-02-audit-followup-pending-and-register.md` (design/player-cv), and spec D as amended: no strike-through on old details values.
**Branch:** `build/polish-2`, off live `app` at bbbc10b.
**Ports:** DB 54651, app 3451, layout CDP 9651, screens CDP 9652.
**Words:** no new visible words. There are two new screen-reader strings, both from the approved mockup (listed at the end).

## What changed

| # | Audit row | Fix | Where |
|---|---|---|---|
| 1 | #1 | The register table's status column is now 116px (was 100). The SHORTLISTED pill is about 109px, so it no longer runs into "Open the CV". The column minimums now total 676px against 678px of room at 768. Measured at 768, 820, 834, 1023, 1024, 1031, 1032 and 1280: no row and no page overflows. | `globals.css` `.console-row` |
| 2 | #2 | `.ph-pair` is a caption row plus a photo row. Each `<figure>` spans both rows as a subgrid. The longer caption sets the row height for both sides, so the photos start level. Markup is unchanged. | `globals.css` |
| 3 | #3 | Notes on `/club/register` are no longer faux italic. `font-style: italic` is gone from `.reg-line.has` and `.reg-row-note`, matching `/coach/register`. | `globals.css` |
| 4 | #4 | `.console-row > :last-child { justify-self: start }`. Shortlist and Invite to trial now sit one 12px gap after "Open the CV" (the gap was 107px at 1280). The inline `justify-content: flex-end` no longer did anything, so it is gone. | `globals.css`, `club/register/page.tsx` |
| 5 | #6 | `/coach/register` filter chips are tighter: 11px a side instead of 14, scoped to `.creg-filters`. A `min-width` keeps every chip a 44px target (a chip is content-box, so 20 + 22 + 2 = 44). At 375 the position chips now run 5 + 5, where "ST" used to sit alone on a third line. | `globals.css`, `coach/register/page.tsx` |
| 6 | #7 | `/g/pending` photos have screen-reader names: `{name}’s approved photo` and `{name}’s new photo`. This is the mockup's wording (`floodlit-parent.html` #pa-all) and it uses U+2019. A "No photo yet" tile has no image, so it gets no name. | `g/pending/[recordId]/page.tsx` |
| 7 | #9 | In a details row, the arrow and the new value are wrapped together (`.det-to`), so a wrap can't leave the arrow at the end of the old line. `.det` aligns on the baseline (it was `flex-start`, which put the 12.5px label 2px off the 13.5px value). | page, `globals.css` |
| 8 | #10 | The old value in a details row is muted, not struck through: the `<s>` and `.det-o s` are gone. The About's old text and Removed list rows keep their strike, as spec D says. | page, `globals.css` |
| 9 | #11 | `.reg-foot` uses `align-items: stretch`, so the two footer panels start and end level from 768 up. | `globals.css` |
| 10 | #8 | Seed: a second isolated child for the review (see below). | `scripts/dev-db.mts` |

**The seed.** The new fixture is Tobin Calloway, 12, and his parent Odile (`pending.empty@example.com`). Both are invented. They are isolated the same way Noemi and Ivo are: Odile is in no suite's list of seats, and Tobin has no club, squad, registration or share link.

What Odile approved:
- no photo;
- no number;
- his right foot;
- two assists;
- a school entry, "Tarrowvale Secondary College". Tarrowvale is the seed's existing invented place. The entry is written into the approved version's content, the way a pre-0061 snapshot would hold it, because the live table now refuses it.

What Tobin changed since:
- he added a photo;
- he set his number to 4;
- he cleared his foot;
- he saved his assists as 0.

The fixture checks itself when the seed runs: The photo and Football details only, rows `Number: — → 4`, `Preferred foot: Right → —` and `Assists: 2 → —`, and the school in none of them. The seed records it in `.dev-ids.json` as `pendingReviewEmpty {guardian, child, record, school}`. The seed log prints it as "empty-sides review".

## Counts (from a fresh seed, in TRAINING order)

| Step | Suite | Result |
|---|---|---|
| 1 | reseed, `next dev -p 3451` | — |
| 2 | perms | 2214/2214 |
| 3 | render | 874/874 (869 before, plus pp-r1 to pp-r5) |
| 4 | write | 662/662 |
| 5–6 | reseed, restart `next dev` | — |
| 7 | layout 375 1280 | 274 page views, ALL GREEN. That includes 58 audit views (ap-l) and 9 follow-up views (pp-l1 to pp-l8), with 0 failures. |
| 8 | palette | 8/8 |
| 8 | tsc | exit 0, no output |
| 8 | `NEXT_DIST_DIR=.next-check next build` | exit 0 |
| 8 | csp-prod | 5/5 |
| 8 | corpus | 0 failures, 0 warnings |
| 8 | secret-scan | no secrets found |
| 8 | gate-coverage | 267/267 pinned, 0 open |

**Layout flake, recorded rather than smoothed over.** The first layout run in the sequence, and a second run on a fresh reseed, both stopped in the `/join` pass (j1). The line was `JSON.parse("undefined")` when setting the date of birth. That is code and a page this build doesn't touch. A debug copy of the same check, run on the same database, passed. So did a third official run on a fresh reseed with a fresh `next dev`: that is the green result above. On bbbc10b product code the same check also passed j1. It looks like timing on a cold dev server, not this change.

## Tests added, and red on bbbc10b

Every new check was run against bbbc10b's four product files with this branch's seed and tests: `globals.css`, the pending page and both register pages.

| Check | What it pins | On bbbc10b |
|---|---|---|
| pp-r1 (render) | Noemi's review of Ivo, read-only: the seven sections in order, the four details rows as text, both photos at signed `/private-photo/` URLs, no glow, two equal answers. This page was read by no suite before. | Green, because it is coverage, not a regression. A mutation proves it can fail: dropping the stat's provenance in `lib/pending-diff.ts` turns it red ("Goals: 4 → 7"). |
| pp-r2 (render) | The alt text is exactly `Ivo’s approved photo`, `Ivo’s new photo` and `Tobin’s new photo`. The "No photo yet" tile appears once. | **Red**: `alt=""` |
| pp-r3 (render) | No `<s>` and no line-through in any details row (4 rows for Ivo, 3 for Tobin). | **Red**: 4 struck rows and 2 struck rows |
| pp-r4 (render) | The arrow and the new value share `.det-to`, and the arrow is `aria-hidden`. | **Red** |
| pp-r5 (render) | Odile's review of Tobin: The photo and Football details only, "No photo yet" on the approved side, the three "—" rows, no `det-n">0`, the school nowhere in the HTML or the payload, no Other football. | Green, because it is coverage. Mutations prove it can fail: (a) dropping the school filter in `pendingDiff` adds Other football and the school; (b) drawing a blank stat as "0" gives "Assists: 2 → 0". A third try, letting a 0 through `statValue`, stayed green, because `fn_stat_public` already drops a 0 in the database. The zero is guarded twice. |
| pp-l1 (layout, 768/1024/1280) | In every table row, the status pill stays inside its cell and is at least 11.5px from "Open the CV". At least one shortlisted row must be measured. | **Red**: Shortlisted 9px past its cell, at all three widths |
| pp-l2 (layout, 768/1024/1280) | The last column's button starts no more than 13px after "Open the CV". | **Red**: 65, 89 and 107px |
| pp-l3 (layout, 768/1024/1280, 375) | Every note in the table and in the phone rows is `font-style: normal`. | **Red**: 55/55 at each width |
| pp-l4 (layout, 768/1024/1280) | The footer's two panels have the same top and bottom (±1px). | **Red**: bottoms 46px apart |
| pp-l5 (layout, 375) | No position chip on `/coach/register` sits alone on a line, and every chip is at least 44×44. | **Red**: `[["ST"]]` |
| pp-l6 (layout, 375/1280, Ivo and Tobin) | The two `.ph` tiles share a top and a height (±0.5px). | **Red**: 12px apart, all four views |
| pp-l7 (layout, 375/1280, Ivo and Tobin) | The arrow's midline sits on the first line of the new value. The label's baseline equals the value's (±0.5px), measured with a zero-height inline-block wherever the label and value share a line. A long Positions row puts its value under the label, as the artboard draws it. | **Red**: Ivo's Positions arrow stranded at 375, every single-line label 2px off |
| pp-l8 (layout, 375/1280, Ivo and Tobin) | No element in `.det-o` computes to line-through. | **Red** |

No existing check was changed. The write suite's bf-pend-w5 still reads `<div class="det">` rows by text and is green: the new wrapper is a `<span>`, so the first `</div>` still ends the row.

**L32.** `/g/pending` for both isolated reviews is now read by the render suite (pp-r) and the layout check (pp-l), by GET only, as each child's own guardian. Nothing on either page is pressed, and neither version moves. The comments in `dev-db.mts` and on the `.dev-ids.json` entries now say so.

## Screenshots

`docs/design/reports/2026-10-02-polish-2-shots/` (untracked): before and after for `/club/register`, `/coach/register`, `/g/pending` (Ivo) and `/g/pending` (Tobin), each at 375 and 1280, full height. "Before" means bbbc10b's product code with this branch's seed, because Tobin doesn't exist on bbbc10b. Compared by eye with `floodlit-parent.html` #pa-all and #pa-details:
- the photos are level;
- the arrow leads the new value;
- old values are muted and not struck.

## For the tech team

Nothing. No migration, permission function, `lib/record-read.ts`, proxy or CSP change.

## Copy for BUZ

There are no new visible words. Two new screen-reader strings come verbatim from the approved mockup (`floodlit-parent.html` #pa-all, "words approved 2 Oct"), with `{name}` as the child's first name:
- `{name}’s approved photo`
- `{name}’s new photo`
