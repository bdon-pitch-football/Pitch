# Build — the call sheet, I-P2 (1 Oct 2026)

**Seat:** design-builder, briefed by Leo. **Branch:** `build/call-sheet`, off `build/full-release` at 3dba52d. **Worktree:** `.claude/worktrees/call-sheet`. **Ports:** app 3341, dev DB 54541, CDP 9541.
**Spec:** `design/player-cv:docs/design/specs/I-ops.md`, "/ops/call/[clubId] · operator · size M". **Mockup:** `floodlit-access-ops-demo.html` #i-call and #i-call-td. BUZ approved I-P2 ("Yes").

## What changed

`app/ops/call/[clubId]/page.tsx`. This is markup only. No word, field, name, value, action or query changed.
- The form is one `.card.ops-panel` (`.ga-form`). Its seven groups are `.ops-sec`, with hairlines between them: Operator/Answered by · The number · The four questions · Outcome/Why · Technical Director · Notes · the §39 line and Log the call.
- The claim panel, the TD panel and the form are the children of `.call-grid`, in DOM order claim → TD → form. The claim panel is `.card.ga-claim.ops-aside-sticky` and the TD panel is `.card.ga-td`.
- "The number — find it yourself" is now an ink `.panel-h`. It was red. The bold sentence under it stays.
- The B2 prompt is `.ops-say` and keeps `data-td-ask`. Its words are the `TD_ASK` constant, unchanged.
- The §39 line is still `{s39Line(s39To)}` from `fn_verified_call_addressee`, still `data-s39`, and still directly above the button.
- "Log the call" is `.btn-primary.fl-glow`, the only glow on the page.
- The local `card`, `input` and `section` style objects are removed, along with the `lib/ui` import (`card`, `fieldLabel`, `sectionLabel`).
  - Captions are now `.panel-h`.
  - "The account holding that address" is now `.field-label`.
  - The end-access "Why" is now an `.ops-field` / `.ops-input` well, as #i-call-td draws it.
- The TD state colours are unchanged.

`app/globals.css`:
- New: `.ops-say { border-left: 3px solid var(--line); padding-left: 11px; }`.
- **`.call-grid` fixed.** Measured in Chrome, it was wrong in two ways, both on a club with no claimant (Westgate):
  - At 1280 the form spans three `auto` rows, so its height was shared out among them, and the TD panel sat at y=799 instead of 123.
  - At 390 the empty "claim" row left an extra 18px above the TD panel.
- The fix:
  - Below 1024: a flex column (DOM order is drawn order), as `.club-grid` already does.
  - At ≥1024: `grid-template-rows: auto auto 1fr`, `row-gap: 0`, and an 18px margin under the claim.

## Every state, before and after

`crawl.mjs` (scratch, not committed) ran on a fresh seed with the old markup, and again with the new. It covers 17 states:
- the seven sheets: the six clubs plus Quarrymead;
- a malformed id and an unknown id (both 404);
- the TD states, driven through the sheet's own forms:
  - waiting (Quarrymead, Casey, as td-w*);
  - active (Casey confirms; Kingsway and Riverside fresh);
  - ended (Kingsway, through the operator's door, as tde-w*);
  - held for a name (Riverside);
  - confirmed after the hold;
  - club mailbox (Kingsway);
- a child-safety suspension and a not-verified call.

For each state it compared:
- visible text in order;
- every link's attributes;
- every form, with each control's attributes except class and style (name, type, value, required, checked, placeholder, min and max length, aria-label, action ids, option values);
- every `data-*` marker.

**Result: 100 of 102 facets are identical.** The two that differ are the `data-next-error-stack` on the two 404s. That is Next's dev-only stack trace, and it names a recompiled chunk file.

## The counts

The order is the brief's, from a fresh seed.

| Suite | Result |
|---|---|
| reseed → `next dev -p 3341` | dev db ready on 127.0.0.1:54541 |
| `npm run test:perms` | 2091 passed, 0 failed |
| `npm run test:render` | 802 passed, 0 failed (796 before, plus the 6 new cs-r checks) |
| `node scripts/write-tests.mjs` | 592 passed, 0 failed |
| reseed, restart `next dev` | ready |
| `layout-check.mjs 375 768 1023 1024 1031 1280` | 798 page views (24 failure-path). ALL GREEN. cs1: 12 views |
| `palette-check.mjs` | 8 OK, 0 FAIL |
| `npx tsc --noEmit -p .` | 0 errors |
| `NEXT_DIST_DIR=.next-check npx next build` | exit 0 |
| `CSP_CHECK_PORT=3341 npm run test:csp-prod` | 5 passed, 0 failed |
| `corpus-check.py` | 0 failures, 0 warnings (174 decisions, 167 locked) |
| `secret-scan.mjs` | No secrets found |
| `gate-coverage.mjs` | 263 of 263 doc 14 rows pinned, 0 open |

## Tests added

Each one was run on the old markup or CSS and failed.

`scripts/render-tests.mjs`. These read Quarrymead (claimed, §39 will send) and Westgate (no claim, will not):
- **cs-r1:** the form is one `.card.ops-panel`. Its top level is hidden inputs plus exactly seven `div.ops-sec`, with no card inside it. On the old markup it fails: there was no panel.
- **cs-r2:** `.call-grid`'s own children, in order:
  - claimed: `ga-claim.ops-aside-sticky` → `ga-td` → `ga-form`;
  - unclaimed: `ga-td` → `ga-form`.
  - Old markup: fails (no grid).
- **cs-r3:** exactly one `fl-glow`, and it is on "Log the call". Old markup: fails (0 glows).
- **cs-r4:** the Technical Director section opens with `.ops-say` and the B2 words, verbatim in quotes, before its fields. The `.ops-say` rule is in globals.css as specified. Old markup: fails.
- **cs-r5:** the panel's last section is the §39 line and the button and nothing else, in both forms ("…emails M. to confirm it." and "…sends no email, so don't promise one."). Old markup: fails. That the line comes from the function stays pinned at source by perms `jr-s39-sheet-b`.
- **cs-r6:** the number head is `.panel-h` in ink, never red, and the bold sentence is still there. Old markup: fails (it was red inline).

`scripts/layout-check.mjs`:
- **cs1:** at ≥1024 the claim and the TD are a 320px column right of the form.
  - The TD sits 18px under the claim, or level with the form's top when there is no claim.
  - The form starts at the top of the grid.
  - The claim is still on screen with the form scrolled half way.
- Below 1024: one column, claim → TD → form, 18px apart, starting at the grid's top.
- Proved three ways:
  - Old markup: 4 of 4 views fail.
  - New markup with the old `.call-grid`: fails at 375 ("first panel starts 18px below the top of the grid") and at 1280 ("the TD panel starts at 799, not 123").
  - New CSS with the sticky rule removed: fails at 1280 ("the claim is off screen (-747–-651 on 844px)").
- I also added Quarrymead's and Westgate's sheets to the 'club TD' deep list, so the overflow, squeeze and target checks measure both shapes. Riverside was the only sheet measured before.

## Tests moved

Each moved because the markup it pins moved on purpose, and each is as strong as before.
- **render `jr-s39-r1`:** the button in the "line directly above Log the call" regex is now `class="btn btn-primary fl-glow"`. It still requires the line and the button to be adjacent. On the old markup it fails.
- **perms `jr-s39-sheet-b`:** the same move in the source regex (`className="btn btn-primary fl-glow"`). On the old page it fails (2090 passed, 1 failed).
- **render `ops-r6`:** it used to find captions only by an inline `text-transform:uppercase`. It now also finds `class="panel-h"` and `class="field-label"`, because the captions moved onto the part.
  - It reads 19 captions on both the old and the new markup.
  - Proved: with a long `.panel-h` caption ("Answered by — name and role as they gave it") it fails.

## Screens

Untracked, in `docs/design/reports/2026-10-01-call-sheet-shots/`, at 390 and 1280:
- Quarrymead: claimed, 4 held, no TD;
- Westgate: unclaimed;
- Kingsway: TD active, with the end-access door.

Compared with #i-call they match:
- one panel with hairlines;
- the aside at 320px with the claim pinned;
- the ink number head;
- the B2 rule;
- the single glow;
- the phone order unchanged.

## Left for the tech team / open

- **`.card.ops-panel` padding.** `.card` is declared after `.ops-panel` in globals.css, so on every `card ops-panel` the card's `15px 14px` wins over the spec's `4px 16px`. This affects the call sheet, `/ops/clubs/new`, `/ops/clubs/[clubId]` and the trial form. I left it alone because it moves three pages outside this brief. The one-line fix is `.card.ops-panel { padding: 4px 16px; }`.
- **The §39 line's style.** It keeps the sheet's `guide` style, as John's ruling was built. #i-call draws it as an ink `.hint`, with a second muted line quoting the won't-send form. I did not change it: the words and the line were fenced as landed.
- No migration, permission function, record read, proxy or CSP was touched. Nothing was pushed, merged or deployed.
- No new copy.
