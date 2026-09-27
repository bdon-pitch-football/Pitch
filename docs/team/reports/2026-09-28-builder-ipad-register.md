# build: the console table starts at 768, the rail still at 1024 (2026-09-28)

Asked: BUZ's 28 Sep call — move the console's table/cards switch to **768px**, keep the
232px sidebar at **1024px**, amend **D-147** in the register as part of the commit, and
repair the register's horizontal overflow in the 1024–1031 band; measure it, do not trust
either side's arithmetic.

Did: four files plus the register, in my own worktree `.claude/worktrees/builder-ipad-register`
on branch **`builder-ipad-register`**, cut from `app` at **`6f56f70`**. Commits
**`58c52ae`** (the change) and **`<REPORT_SHA>`** (this report). Not pushed. No migration —
this decides nothing about who may read what, so there is nothing for Postgres to answer.

**`docs/06-Register.html` — D-147, amended 28 Sep 2026.** The register moved first and the
CSS cites it. The amendment records BUZ's call, the reason (*"is there room for a table"*
and *"is there room for a 232px rail beside it"* are two questions and D-147 answered both
with 1024), and the evidence by file: the device seat's 450 captures at 390/820/1024/1280/1440
with `index.json`, and the 34 at 1023/1025 in `screens/cliff/` with `cliff.json`, in which
`/club/register` carries `overflowPx: 7` at 1024 and `0` at 1280 with `DIV.console-row
console-head` named. It also writes down the two things a later reader cannot infer: that
**1024 is narrower for the row than 820 is** (the rail costs 232 where 1024 only gains 204),
and that *"640–1023 caps at 560px"* now carries **one exception — console surfaces from
768px**, because a table cannot live in 560. It notes BUZ chose 768 over the 834 in the
mockup's filename, and that all four D-147 constraints hold.

**`app/globals.css` — one media query became two.**

- **`@media (min-width: 768px)` — the table.** `.d-only { display: grid }`, `.m-only
  { display: none }`, `.console { max-width: 1200px }` and `.console-row`'s columns. The
  column cap has to move with the switch or the rows render into a 560px column and spill
  ~120px, which is the same defect one breakpoint lower.
- **`@media (min-width: 1024px)` — the rail, and only the rail.** `.console-frame`'s
  `232px minmax(0, 1fr)` grid, `.console-nav`, and `.console-main` going back to a row.
  `.seat-tabs { display: none }` also stays at 1024, untouched — **that is the whole idea:
  at 768–1023 a tablet now gets the table _and_ the phone tab bar**, so navigation is solved
  without a rail and the full width goes to the table.
- The sticky filters, the row hover and the sticky table head moved from 1024 to 768 with
  the table. They are the table's manners, not the rail's; a TD on an iPad scrolls the same
  hundred families.
- **The column minimums: 744 → 660, measured, not derived.** Chrome says the five columns
  and their four 12px gaps get `viewport − 90` below 1024 and `min(1200, viewport) − 322` at
  1024 and up. The comment in the file carries the four figures and names 768 as the tightest
  width, because the next person to change a padding needs to know which width binds.
  Content minimums measured the same way (widest cell content, nowrap, over all 111 rows):
  `Shortlisted` 94, `Open the CV` 110, `Invite to trial` 115 — so status is 100, the CV
  column 116, the action column min 120. No cell is narrower than what goes in it.

**`scripts/permission-tests.mjs` — `bp1`–`bp7`, seven static checks** beside `shell1`–`shell3`.
They brace-match the media blocks (a regex cannot read nested rules) and assert: the table
switches at 768 and not at 1024 (`bp1`); the console column stops capping at 560 there
(`bp2`); the 232px rail still waits for 1024 (`bp3`); the tab bar still goes at 1024, so the
tablet keeps both (`bp4`); **the columns fit the narrowest width the table renders at**, by
parsing the track list out of the CSS and comparing its sum to the two measured budgets
(`bp5`); the chrome those budgets were measured through has not moved, so changing a padding
turns `bp5`'s tripwire red rather than making it quietly wrong (`bp6`); and the register
still decides table-or-cards in CSS alone, never from a width it read in JavaScript (`bp7`,
which is D-147 constraint 3 — no capability at one width and not another). Labels are
lowercase, so they cannot be mistaken for a doc 14 row id (L4).

**`scripts/layout-check.mjs` — two tooling lines, no behaviour change.** `LAYOUT_CDP_PORT`
moves the DevTools port off 9333 the way `PITCH_DEV_DB_PORT` moves the database, because two
seats running this at once in two worktrees would otherwise attach to each other's browser
and measure each other's app (L30). And the header now names the nine console widths and says
why 375 and 1280 cannot see this bug.

**`package.json` — `test:layout:console`** runs the nine widths. `test:layout` is left at
`375 1280`: the nine widths are 846 page views and about forty minutes, which is the wrong
default for every sweep, and `bp5` covers the arithmetic in every sweep for free.

Ran: fresh seed each time, on my own ports — dev database **54332** (`PITCH_DEV_DB_PORT`
plus `DEV_DB_PORT`, both, see Found 3), app **3010**. Never touched 3000, 54322 or 54323;
every stop was by port (L8). Order per TRAINING §4: reseed → perms → render → write →
reseed → layout.

- **perms 1109/1109** · **render 369/369** · **write 305 passed, 6 failed** — the six are
  `sqf4b`–`sqf4g`, **pre-existing at `6f56f70`** and diagnosed in Found 1; I did not fix
  them and I have not called this suite green.
- **layout 846 page views at 375, 768, 820, 834, 1023, 1024, 1031, 1032, 1280px — 0 too
  wide.** Its self-test ran and passed: it aborts with exit 2 if a 600px page does not
  measure wider than a 375px screen, and it did not abort.
- gate-coverage **261/261 rows pinned, 0 open** · palette-check **181 files, all green**
  · corpus-check **0 failures, 0 warnings** · secret-scan **no secrets** ·
  `test:paths` **all passed** · `tsc --noEmit` **clean** · `build:check` **exit 0**.

**The register, per width, measured in Chrome (`document.scrollWidth` against the device
width — never `innerWidth`, L19), as the club TD:**

| width | before | after | before height | after height | what renders now |
|---|---|---|---|---|---|
| 375 | 375, 0 over | 375, 0 over | 18,042 | 18,042 | cards + tab bar — **unchanged** |
| 768 | 768, 0 over | 768, 0 over | 17,343 | **9,870** | table + tab bar (was cards) |
| 820 | 820, 0 over | 820, 0 over | 17,343 | **9,870** | table + tab bar (was cards) |
| 834 | 834, 0 over | 834, 0 over | 17,343 | **9,831** | table + tab bar (was cards) |
| 1023 | 1023, 0 over | 1023, 0 over | 17,343 | **9,732** | table + tab bar (was cards) |
| 1024 | **1031, +7 over — FAIL** | 1024, 0 over | 9,691 | 9,730 | table + rail |
| 1031 | 1031, 0 over | 1031, 0 over | 9,691 | 9,730 | table + rail |
| 1032 | 1032, 0 over | 1032, 0 over | 9,691 | 9,730 | table + rail |
| 1280 | 1280, 0 over | 1280, 0 over | 9,645 | 9,645 | table + rail |

An iPad in portrait went from 17,343px of scroll to 9,870. The after-height at 1024 is 39px
taller than before because the columns are narrower and a note or two wraps one more line.

**The budget, measured, which is the part both sides of the argument had wrong:**

| width | the row's content box | the 5 columns + 4 gaps get | old needed 744 | new needs 660 |
|---|---|---|---|---|
| 768 | 698 | **678** | short by 66 | 18 spare |
| 820 | 750 | 730 | short by 14 | 70 spare |
| 834 | 764 | 744 | exactly 0 | 84 spare |
| 1023 | 953 | 933 | fits | fits |
| 1024 | 722 | **702** | short by 42 | 42 spare |
| 1280 | 898 | 878 | fits | fits |

**The regression check fails on the old code, proven both ways (L20).**

1. *Static.* `git show HEAD:app/globals.css > app/globals.css` → `bp1`, `bp2`, `bp5`, `bp6`
   red, 1105 passed / 4 failed. `bp3`, `bp4` and `bp7` stay green on the old CSS **on
   purpose** — they assert what must not move.
2. *Static, the half that matters.* The new split breakpoints with the **old 744px
   minimums** → `bp5` alone red, and for the right reason: *"the row's five columns fit the
   narrowest width the table renders at (they need 744px) — expected [5,true,true], got
   [5,false,false]"*. 1108 passed / 1 failed.
3. *Browser.* Old CSS, `node scripts/layout-check.mjs 1024`:
   `FAIL 1024px · club TD · /club/register — page 1031px wide on a 1024px screen; widest:
   div.console-row by 7px ("PLAYER THEIR LINE STATUS")`, twice (plain and `?status=new`),
   2 of 94 views. Restored, `1024 768` → ALL GREEN, 188 views.

`df -h /`: **18Gi available before, 22Gi after.** It dipped to 7.5Gi mid-run; ~2.4GiB of
that is two `next dev` caches (1.2GiB each — the main tree's and my worktree's, which is a
standing cost of one-builder-per-tree), and 167MB was one Chrome profile leaked by a layout
run I killed (Found 4), removed by hand. No capture-script leak: the only `pitch-*`
directories left in temp are 0B.

Found:

1. **The write suite's six reds are the suite asserting a banned word, not a safety defect,
   and they were red at `6f56f70`.** `app/squad/actions.ts:118` redirects to
   `?squad=${yes ? 'joined' : 'no'}`; `scripts/write-tests.mjs` `sqf4b`–`sqf4g` expect
   `?squad=declined`. **`declined` is banned by D-108**, and the permission suite's own
   `url1 (F8)` forbids a banned word in a redirect query string — so the product was
   corrected and the six expectations were not. **The property they exist to test is
   intact:** all five hostile `back` values (absolute, protocol-relative, backslash,
   tab-escaped, double-parse) land on `/home?squad=no`, and the honest one lands on
   `/g/controls/<child>?squad=no`. Doc 14 N2 is enforced; only the literal is stale. Six
   string literals to fix, and it is not my task to choose them (L22, L33). Proof it is
   pre-existing: `git grep -n "squad=declined" 6f56f70 -- scripts`.
2. **`docs/design/reports/2026-09-24-audit-every-device.md` does not exist.** My brief cited
   it. `docs/design/reports/` has five 2026-09-24 files and none is the audit. All the data
   it describes *is* committed (`index.json`, `columns.json`, `touch-targets.json`,
   `cliff/cliff.json`) and I worked from that, so nothing was lost — but the write-up
   either was never committed or is named something else, and it is the only file in the
   evidence chain a reviewer would reach for first.
3. **`db8` cannot fail on the thing it claims to pin.** `lib/db.ts:16` reads `DEV_DB_PORT`;
   `scripts/dev-db.mts:674` reads `PITCH_DEV_DB_PORT`, and its own comment says the team
   settled on the namespaced name. `db8` asserts *"DEV_DB_PORT moves the dev database and
   the app together"* with `/DEV_DB_PORT \|\| '54322'/` and `/DEV_DB_PORT \|\| 54322/` —
   and `PITCH_DEV_DB_PORT` **contains** `DEV_DB_PORT`, so the check passes while the two
   halves read two different variables. I had to set both to start a stack. One knob, one
   name, and the check anchored (`(?<!PITCH_)` or read the app's name out of the script's
   own comment). L19.
4. **`layout-check.mjs` leaks its Chrome profile when it is interrupted.** Cleanup hangs off
   `process.on('exit')` only, so SIGTERM and SIGINT skip it; one killed run left 167MB in
   `/var/folders/.../T/pitch-layout-*`. L36 fixed the clean path and not the interrupted
   one, and interrupting a forty-minute run is the normal case. A
   `process.on('SIGINT'/'SIGTERM')` that calls `stop()` and re-raises closes it.
5. **`npm run build:check` leaves the tree dirty and points it at a directory it deletes.**
   It rewrites the generated `next-env.d.ts` from `./.next/dev/types/...` to
   `./.next-check/types/...` and never puts it back. A sweep that runs `build:check` before
   committing sweeps that in, and the next `tsc --noEmit` resolves against a dist dir
   `next dev` does not write. I restored it by hand (`git checkout -- next-env.d.ts`).
6. **The overflow band is 1024–1030, and the check only sees 1024–1029.** On the old CSS the
   row's right edge is pinned at **exactly 1031px** for every viewport from 1024 up: the rail
   fixes the row's left edge at 267 and the columns cannot shrink below their minimums. So
   the spill is `1031 − viewport` — 7px at 1024, 3 at 1028, 2 at 1029, **1 at 1030**, 0 at
   1031. The layout check's threshold is `doc > vw + 1`, so it goes red for **1024–1029**
   only: at 1030 the page is genuinely 1px too wide and the check stays green. Anyone
   "confirming the fix" by sampling 1030 would have learnt nothing either way.
7. **The proposal's sums were wrong in both directions and its conclusion was still right.**
   It compared 744 against 724 and reported *"about 20px too wide"* against an instrumented
   7; the real budget at 1024 is **702** — it missed the row's own 10px a side and the card's
   1px border — so the row is **42px** too wide for its card, of which only 7 pass the
   viewport because the card is already inset 18px. And *"690 fits in 718 at 834"* is right
   by luck: 834 gives **744**, not 718. The part that matters: **690 does not fit at 768**,
   where only 678 is available, so building the proposal's five numbers literally would have
   moved the same defect from 1024 down to 768 — the width BUZ actually chose. Measuring it
   was not belt-and-braces; it was the difference between a fix and a relocation.
8. Cosmetic, not fixed, flagged: `.console-head` sticks at a hard `top: 92px`, tuned to the
   filter card's height at one width. It was already a fixed number across 1024–1440 and now
   applies from 768 too, where that card is taller because the chips wrap into a narrower
   column. Nothing overflows; the sticky head can sit a few px off the filters' bottom edge.
   Re-tuning it is a design question, not a breakpoint one.
9. Not a defect, recorded because I measured it: at 375 the register reports one `span` 13px
   past the edge without widening the document — identical before and after this change, and
   correctly not a failure (the layout check decides on `document.scrollWidth`, and an
   element clipped by an ancestor does not widen it).

Copy for BUZ: **None.** No user-visible string is added, changed or removed. The register
amendment is an internal document, CSS comments are comments, and the `bp1`–`bp7` labels are
suite output. What *is* newly visible without being new copy: at 768–1023 the trials board's
four filter groups now sit open in a card instead of behind the **Filters** button — the
same strings, the same links, already approved, and already what ≥1024 does. See Risks 2.

Risks:

1. **The one thing BUZ's words do not say, and the decision requires.** A table needs the
   width, so `.console` stops capping at 560px from 768 — and `.console` is shared. That
   changes `/club/squads`, `/club/squads/[squadId]`, `/club/roles`, `/ops/verification`,
   `/ops/reports`, `/ops/support`, `/ops/switches` and `/dev/outbox` at 768–1023 from a
   centred 560px column to the full width (measured: `/club/squads` 3,125px tall at 375 →
   2,594 at 768 → 2,521 at 1023; `/ops/verification` 1,053 at both 768 and 1023). None of
   them overflows at any of the nine widths, none has a table, and all of them are lists on
   D-147's console list, where the 15 Sep amendment says *"a table to 1200px where the
   screen is a list"*. I judged that consistent rather than a second decision, and wrote it
   into the amendment as such. **If BUZ meant the register alone, say so and it is one line
   to scope back** — it would want its own modifier class rather than the shared `.console`,
   and then a club seat would show a full-width register beside a 560px squads page at the
   same width, which reads as a bug.
2. **The trials board is a public page and moves with `.d-only`.** At 768–1023 the filters
   are open instead of collapsed (1,179px tall against 1,019 collapsed, fits the 560px
   reading column, no overflow at 375/768/1023/1024). Right, I think — it is what a laptop
   already did and there is room — but it is a visible change on a public surface nobody
   has seen at that width, and one screenshot would settle it.
3. **The status column has 6px of slack** (100px against 94px measured for `Shortlisted`).
   If Archivo fails to load and the fallback is wider, that chip wraps to two lines. It
   cannot overflow — the cell is fixed and the chip wraps — so it is cosmetic. `club_status`
   has exactly three values and no fourth (D-108), so no longer label can appear without a
   register change.
4. **I did not re-photograph anything.** The device seat's 450+34 captures are now stale for
   six console screens across the tablet band. `scripts/screens.mjs` is the tool and that is
   the device seat's call, not mine.
5. **I did not test a real iPad.** Chrome device emulation at 1024×900 is not an iPad Pro
   12.9" in Safari: no rubber-banding, a different scrollbar model, and `100dvh` on
   `.console-nav` behaves differently under Safari's collapsing toolbars. The arithmetic is
   device-independent; Safari's viewport behaviour is not. Somebody should open
   `/club/register` on a real 12.9" and a real 10.2" before this is called done.
6. **Nothing here went near the demo, the migrations or any permission function**, so no
   demo restart is needed (L14) and no read of a child's data changed path. The page serves
   byte-identical HTML at every width — CSS chooses the variant — which is why render stayed
   at 369/369 and why there is no new permission surface to test.
7. **The write suite is not green** (305/311) and I left it that way. Anything gated on
   "every suite green" is blocked on Found 1, which is somebody's decision and not mine.

Lesson: **Do not edit the tree while a browser suite is reading it.** I started the
nine-width layout run, then swapped `globals.css` twice to prove the regression check — and
the dev server hot-reloaded underneath the run, so forty minutes of measurements were taken
against three different stylesheets, silently, with no error and a plausible-looking result
waiting at the end. I killed it and paid the forty minutes again. L32's rule is that a suite
reading a rendered page is reading a fixture; one level up, **a browser suite is reading the
working tree as its fixture.** Finish the edits, then measure, and never prove a regression
against old code while a measurement is in flight.
