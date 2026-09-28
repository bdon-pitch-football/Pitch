# Device audit — every width (24 September 2026)

> **Filed by Leo on 2026-09-28**, four days late, from the device seat's
> handover. That seat's operating rules forbade it writing report files, so it
> reported in full to me and I did not file it — and the gap was found by the
> next builder, who reached for the write-up behind a decision it was
> implementing and found only data. **The data was always committed and is
> cited below; the argument was in one transcript.** A measurement nobody can
> find is a measurement that gets taken twice.

**Evidence, all committed:**

| | |
|---|---|
| `docs/design/screens/` | **450 PNGs** — 5 widths × 90 screens |
| `docs/design/screens/index.json` | 450 rows: emptiness, overflow, sidebar/tab-bar state, page height |
| `docs/design/screens/columns.json` | 420 rows: the real painted column width, measured off the pixels |
| `docs/design/screens/touch-targets.json` | 336 rows: every control under 44px |
| `docs/design/screens/cliff/` | **34 PNGs at 1023 and 1025** — the breakpoint photographed |

Measured at **390, 820, 1024, 1280, 1440**, every page as every seat, plus an
`ops` seat added by hand because nothing in the product links to `/ops` and the
link-walk cannot reach it. Chrome with device-metrics emulation at
`deviceScaleFactor: 1` — CSS pixels, not a retina panel, not iOS Safari, and
not a real finger.

## A correction to the brief this seat was given

**"All 172 captures are 1280 wide" was wrong.** 86 were 1280 and **86 were
already 820** — the previous audit did capture the tablet. The benchmark seat
wrote at 07:58 and the 820 set landed at 07:59; it read a one-minute-stale
directory and I repeated its claim without checking. What was genuinely
missing was **390, 1024 and 1440**, and the breakpoint itself had never been
photographed.

## 0 · Why this machine kept running out of disk — ours, not the images

`scripts/screens.mjs` and `scripts/layout-check.mjs` each handed Chrome a fresh
`--user-data-dir` and never removed it. **45 orphaned profiles totalling
4.1 GB**, plus 14 headless Chrome processes still running from finished runs.

```
before capture   9.8 GiB free
after capture    7.7 GiB free      (42 MB of PNGs, ~2 GB of new leak)
after cleanup   12.0 GiB free      (4.3 GiB recovered)
```

**The screenshots cost 42 MB. The tooling cost a hundred times that.** Fixed at
`6f56f70` (L36); the interrupt path is still leaky and is recorded as open.

## 1 · The 1024 cliff, photographed

`cliff/1023-club-td-club_register.png` against `cliff/1025-club-td-club_register.png`
— same page, same seat, same data, **two pixels of window width apart.**

| | 1023px | 1025px |
|---|---|---|
| Sidebar | **none** | 232px, crest + club + role + 7 items |
| Bottom bar | **phone tab bar, 86px** | none |
| Content column | **525px** (51% of window) | 758px (74%) |
| The register | **stacked cards** | **a table** |
| Player rows above the fold | **1, clipped under the tab bar** | 2 complete |
| Filter pills | 8 rows, 300px | 4 rows |

| Device, portrait | CSS width | What it got |
|---|---|---|
| iPad 10th gen | 820 | **phone layout** |
| iPad Air / Pro 11" | 834 | **phone layout** |
| iPad Pro 12.9" | 1024 | console — *and see §2* |
| Any iPad, landscape | 1080–1366 | console |

**Closed 2026-09-28** by BUZ's call: the table from 768, the rail still at
1024 (D-147 amended). `/ops/*` fell off the same cliff — an operator triaging a
child-safety report on an iPad got the phone tab bar.

## 2 · The one iPad that got the console is the width where it didn't fit

The register overflowed horizontally in an **8-pixel band** — 1024 to 1031,
which is exactly iPad Pro 12.9" portrait. `.console-row`'s grid minimums came
to 744px; 1024 does not leave that after the sidebar and nested padding.

The cheapest showstopper on the list, and **the numbers in the proposal that
followed were wrong** — the builder measured the real budget at 724, not 702,
and found the proposed 690 does not fit at 768. Measuring was the difference
between a fix and a relocation. Also: the row's right edge pins at 1031px for
every viewport from 1024 up, so the spill is `1031 − viewport` — 7px at 1024
down to **1px at 1030**, which the check's `vw + 1` threshold cannot see.
Confirming that fix at 1030 teaches you nothing.

## 3 · Phone first — the phone is the good one, by a distance

Emptiness is the share of the first screenful nobody drew anything on.

| Width | Viewport | Mean empty | Median | Over 60% | Over 70% |
|---|---|---|---|---|---|
| **390** | 390×844 | **14%** | **11%** | **0 of 90** | **0** |
| 820 | 820×1180 | 37% | 40% | 17 of 90 | 7 |
| 1024 | 1024×800 | 36% | 44% | 12 of 90 | 3 |
| 1280 | 1280×800 | 42% | 54% | 21 of 90 | 4 |
| 1440 | 1440×800 | 45% | 58% | **27 of 90** | 9 |

And the column, measured off the pixels rather than off the CSS:

| Width | Median painted column | Share of the window |
|---|---|---|
| 390 | 356px | **91%** |
| 820 | 524px | 64% |
| 1024 | 608px | 59% |
| 1280 | 608px | 48% |
| 1440 | 608px | **42%** |

**The column stops growing at 1024 and the window doesn't.** That is the whole
desktop story in one row.

**Verdict: the phone experience is the good one, not the tolerated one.** Zero
screens at 390 are more than 60% empty. `390-signed-out-p_dev_deniz.png` would
pass the screenshot test — a sixteen-year-old would send it to a club.

Three phone costs, one on the money path: `/club/register` never collapses its
filters on a phone (**zero player rows above the fold**) while `/trials` solves
that exact problem one route away; `/join`'s consent tick is a **23×23px
checkbox** — the one control that writes a legal consent record, at half the
charter's own minimum; and `/report`'s 1800 number is a 14px tap target at
every width.

**Touch targets, measured properly:** an earlier pass over-counted, because
`.field` is usually a `<label>` wrapping its input, so a 16px input inside a
50px well is a 50px target. Re-measured against the effective tappable box,
**21 of 84 screens carry a control under 44px and the set is identical at every
width.** The charter's rule holds nearly everywhere.

## 4 · What is wrong but not broken

- **A 608px strip with 416px of black each side at 1440** — the public CV, the
  acquisition engine, the first thing a club sees. Every reading surface, plus
  `/club/billing` and `/club/post-trial`, which D-147 names as *console*
  surfaces rendering as reading columns.
- **The emptiest screens get emptier monotonically.** `/club/billing`
  47 → 73 → 75 → 80 → **82%**. Attached to the only revenue in the product.
- **`/ops/reports` puts its whole weight in the margin** — median painted
  column **324px in a 1440px window, 23%**, the narrowest in the product. A
  stranger would assume it half-loaded.
- **`club-admin` `/home` says everything twice** — the sidebar's six items and
  the right rail's same six, 640px apart, with no accent primary anywhere.
- **The tablet wastes the tablet** — 524px of content in an 820px window.
- **The register gave the TD 300px of chrome above 150px of data** at every
  desktop width. Rows visible in the first screenful: 1440 → 2 · 1280 → 2 ·
  1025 → 2 · 1023 → 1 clipped · 820 → 1 · 390 → **0**.
- **The Pitch mark is 400px from the corner at 1440**, because on reading
  surfaces it sits at the right edge of the 608px column. The rule is "top
  right corner, no exceptions".

## 5 · The three that are good — the standard

**`/club/register` at 1032 and up.** A real table, aligned columns, filter chips
carrying live counts, one status colour meaning the same thing in the pill and
the stat row, and the child-safety sentence *above* the data.

**`/ops/verification`.** The least empty console screen at every width. 73px
rows, four aligned columns, one action in the same place on every row, and a
red-bordered banner stating the invariant — *"Nothing about a person under 18
reaches any club on this list until you have made the call"* — **before a
single club name. Rule above data.** `/ops/reports`, one click away, does the
exact opposite.

**`player` `/home`.** The flattest emptiness curve in the product (16 → 39 → 40
→ 42 → 47; everything else climbs 15–35 points), and the only three-column
layout that earns its rail — because the rail holds **real information**: who
has read your registrations, named, with dates.

## 6 · What could not be measured

- **Real devices.** Emulation is geometry, not ergonomics. **Nobody has put
  this product on an actual iPad**, and the in-app-browser SMS path explicitly
  needs real handsets.
- **Landscape.** Portrait widths only.
- **Motion.** Every capture is ~400ms after load, so the CV's stat tiles are
  photographed mid-animation everywhere — a finding as well as an artefact.
- **`/squad/[personId]?back=controls`** hung the capture twice and is the one
  screen with no picture at any width.
- **Data drift.** The shared dev database was reseeded twice mid-session by
  another seat; the register's NEW count reads 78, 79 and 81 in captures taken
  hours apart. Layout findings are unaffected — **do not quote a number out of
  a screenshot.**
- `tables: 0` in the index is a dud column: the register's "table" is a CSS
  grid, not a `<table>`.
