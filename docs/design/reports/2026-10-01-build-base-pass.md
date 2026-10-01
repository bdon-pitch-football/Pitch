# design-builder: the Floodlit base pass, spec A steps 1–6

Asked (Leo, for BUZ's approved specs): build the base pass of `docs/design/specs/A-shells-and-homes.md`: CSS tokens, `lib/ui` card, `Frame`, page header, top bar, the gallery. Shared styling only: no word changes, no door added or removed, no behaviour change. Not the `/home` rebuild, not groups C–J.

Worktree `.claude/worktrees/base-pass`, branch `build/base-pass` off `build/floodlit` 8192a9b. Ports: app 3181, dev DB 54381, layout CDP 9381.

## What changed

**Step 1, CSS (`app/globals.css`).** There is a new block, `SHELLS (A, 1 Oct)`, placed after THE PLAYER CARD. It is 140 lines (80 of them rules, 10.6 KB) and holds:
- the three tokens `--glass`, `--glass-line` and `--here`;
- `.seat-tab-ic`, the rail mark and seat card, `.has-topbar`;
- the page header (`.pg-head`, `.pg-back`, plus the ≥1024 rule that hides the column mark inside `.console-frame`);
- page title, section and panel heading, `.card .card`, notice tones and `.notice-k`;
- the pill family, the list, step and door rows, the hero panel, stat, empty tile, `.btn-auto`;
- `.field[aria-invalid]` and the door panel.

These existing rules were edited in place, as the spec marks them:
- `.card` (Floodlit surface and `--shadow-card`);
- `.lift:hover` (token);
- `.console-nav` ≥1024 (glass);
- the current door in the rail, the bar and the sheet (`--here` and ink, no green and no accent bar);
- `.seat-tabs` (glass), `.seat-tab` (gap 4);
- `.seat-sheet` (tokens);
- `.tag` (pill radius);
- `.ops-table` (panel), `.console-row-hover` and `.console-head`;
- `.fl-nav` (the named tokens, same values);
- `.home-grid`, added as an alias beside `.player-grid`.

**Step 2.** The `lib/ui.ts` card now uses `var(--fl-surface)` and `var(--shadow-card)`.

**Step 3, `Frame`** (`components/console-shell.tsx`):
- The floodlight is always on. The `floodlight` prop is kept as a no-op.
- The rail is now rail mark (Wordmark, not a link), then seat card, then doors, then Sign out.
- Each bar glyph sits in `.seat-tab-ic`. The current glyph is ink.
- The five seat heads (club, coach, operator, player, parent) use the seat-card classes. The club's state line is a pill (`pill-live`, or `pill-wait pill-wrap`) with the same words and conditions.
- New `TopBarShell`: SiteNav logo-only, `homeLink={false}`, plus `.has-topbar`. It is used by the no-seat branches of `ClubConsole` and `CoachConsole`, and by `Plain` in `components/player-shell.tsx`.
- `ICONS.clip` and `ICONS.star` are added.

**Step 4, `HeaderMark`.** It now renders `.pg-head`, `.pg-back` and `.pg-head-mark`, with the same values. This was done after step 3. Measured:
- 27 page/seat pairs at 390, 1023, 1024 and 1280 (108 views) each show exactly one visible logo;
- it is on the right below 1024 and on the left from 1024;
- this covers framed, top-bar, quiet and failure pages and the public pages.

**Step 5, the shells.**
- `QuietShell` is top bar plus `.reading` (460, or 640 wide), and gains a `door` prop. Nothing uses the prop yet.
- `PitchWordmark` is deleted, along with its five uses on four pages.
- The QuietShell top bar keeps `homeLink` on, because `PitchWordmark` was a link to `/`. This is the same door, now in the bar.
- `FailureState` uses the top bar (not a link, as before), `.pg-title`/`.pg-sub`, and the glyph tile at `--r-card`.
- The way-out primary on 404 and 500 carries `fl-glow`.

**Step 6.** `/design` is rebuilt as the Floodlit gallery. It is dev-only (`notFound()` in production) and shows parts 1–23 by name, each at 390 and at 1024+, using container-query twins.

**Needed by the new one-glow check, or by the base pass itself (styling only):**
- `components/floodlit/TrialRow.tsx`: the row's "I'm interested" loses `fl-glow`. The CSS already cancelled its shadow, so this is a visual no-op, and the dead CSS override is removed. This is ruling 1: never glow a button inside a list row.
- `app/fc/[slug]/page.tsx`:
  - a parent with several children: only the first child's button glows;
  - an unclaimed page: the claim card leads at 390, so it keeps the glow and the send panel's primary is solid.
- `components/front-door/FrontDoor.tsx`: `Close` repeated the hero CTA with a second glow on all four persona landings. The repeat is now solid.
- `app/trials/page.tsx`: the signed-in board's hand-built logo is now `HeaderMark`, and looks identical on a phone. Without this change it doubled with the rail at ≥1024, and with the top bar for coach, club and brand-new seats.
- `app/signin/page.tsx`: the page-local `door` class (rise animation only) is renamed `signin-door`. The global `.door` would otherwise have turned `/signin` into a full-height panel from 640px.

## Proof that words and doors did not move

I wrote my own GET-only crawler (scratchpad, not committed). It covers every seeded seat (16) and every page reachable from `/home` plus the deep pages, which is 923 page×seat views on a fresh seed both times. Each view records its visible text lines and doors: link hrefs, form actions, field names, hidden values and button types.

- **Doors:** 0 differences.
- **Text:** 595 views gain exactly one "P" plus "TCH". That is the logo itself: the rail mark, or the top bar, sitting in the HTML beside the page header's copy, which CSS hides.
- **Noise from the seed, not markup:**
  - one seed timestamp (`/ops/reports` "received … am");
  - 2 or 3 views where seeded rows that share a timestamp come back in a different order (the same lines). This also varied between two baseline runs.

## Counts, fresh seed, in TRAINING order

| Suite | Result |
|---|---|
| perms | 1961/1961 |
| render | 666/666 (was 665; +1 is glow1) |
| write | 534/534 |
| layout, 375 768 820 834 1023 1024 1031 1032 1280 | 1071 views, ALL GREEN (36 failure-path) |
| layout, 375 and 1280 alone (earlier run) | 238 views, green |
| palette | ALL GREEN |
| tsc | clean |
| build:check | clean, 99 routes |
| csp-prod | 5/5 |
| corpus | 0 failures |
| secret-scan | none |
| gate-coverage | 263/263, 0 open |

One flake: the first 375/1280 layout run died inside the `/join` j1 step (`JSON.parse(undefined)`: `input[type=date]` wasn't there yet), on a page this pass doesn't touch. The rerun and both full-width runs were green.

## Tests touched, and why

- **palette-check, "NO SHADOW, NO GLOW".** It failed `.card` for having any box-shadow. D-173 (1) and spec A part 9 put `--shadow-card` on every panel on purpose. The check is rewritten as: `.card`'s shadow must be exactly `var(--shadow-card)`, and `.card-sunken` has none. I proved it fails three ways: a literal shadow on `.card`, a shadow on the well, and no shadow at all.
- **render tb2.** It matched the row's `btn btn-primary fl-glow`. The row has no glow by design now (ruling 1), so it matches `class="btn btn-(primary|secondary)"` exactly. A glow returning to a row fails here as well as in glow1.
- **render fp2** (the failure-path check the README lists). It changes from `class="btn btn-primary"` to `class="btn btn-primary[^"]*"`, because the way out now glows. It still requires a primary to `/home`.
- **render glow1 (new): at most one `fl-glow` per page,** over all 1204 pages the suite serves. It counts markup only, because Next's payload repeats every className.
  - On its first run it found the four persona landings (2 each). They are fixed above.
  - Proven again by putting the glow back on TrialRow: `/trials` counted 3 under the check's own counter, then 0 once restored.
- **Not touched:**
  - ah3, fp12 and fp14: the base pass doesn't change `/home`, the report confirmation or LinkState;
  - g32-r3 and leg-r4/r6: the footer and legal markup are unchanged, and `legal-doc` is still followed directly by `<style>`;
  - E11: LinkState is untouched;
  - the write suite's form lookups: no form, button or field is touched.

## Not done: needs new words or a new door, or isn't the base pass

- **No new copy.** Strings that render in new places are already approved:
  - SiteNav's `aria-label="Pitch, home"` on the quiet shell's mark link (it was the bare mark link before);
  - the club state line, now inside a pill. The verified pill is uppercase by CSS; the HTML text is unchanged.
- **HD2** (the logo links home on the 404, 500 and report pages) would be a new door. The failure-shell mark stays a non-link, as it was. It belongs to group H.
- **P9** (the operator's Home door goes to `/ops`) changes a door. It is not done; it belongs to the homes job.
- **Not in the base pass, per spec "What the base pass can't":**
  - hand-built `background: T.surface` surfaces (e.g. local `card` consts in `/signin`, `/ops/call`, `/build/*/clips` and `/build/*/more`);
  - 18px radii;
  - inline `--hero` heroes (so the `/home` heroes don't have the float shadow yet);
  - the unframed flows (`/g/*`, `/a/*`, `/report`, `/signin`…), which keep the in-column mark top right at every width until their groups move them onto the top bar.
- **Visual changes beyond the spec's own lines, all from ruling 1:**
  - the persona landings' closing CTA, the unclaimed club page's send button and a second child's button lose their glow;
  - the trial row's glow class goes, which is not visible.
- **For the tech team: none.** No migration, no permission function, no `record-read`, no proxy or CSP change.

## Screenshots

These are in `docs/design/reports/2026-10-01-base-pass-shots/` as `before-*` and `after-*`, at 390 and 1280. They cover:
- `/home` as player, parent, club administrator and TD;
- `/club/register` (TD);
- `/trials`, signed out and as a player;
- `/fc/riverside-fc`, `/p/dev-deniz` and `/report`, all signed out.

The PNGs are 40 files, 13 MB, and are left untracked: no PNG has ever been committed under `docs/`. I compared the after set with the mockup (`floodlit-shells.html`):
- rail mark top left, seat card, `--here` current door, no second logo;
- seat bar glass and pill;
- failure and quiet shells;
- panels with the card shadow.
