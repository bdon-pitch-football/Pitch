# design-builder: /join, /signin and /claim, Floodlit (2 Oct 2026)

**Asked (Leo):** build the approved Floodlit design for `/join`, `/signin`, `/claim` and `/claim/[slug]` (`design/player-cv:docs/design/mockups/floodlit-join-signin-claim.html`, BUZ 1 Oct, with P1–P4 and the copy fixes). Live, these were still the pre-Floodlit shell: no nav, the logo top right at 1280, and 74–87% of the first screen empty (audit 2 Oct, public #1, #2, #9, #11; signed-in #3).

**Where:** branch `build/audit-join` from `app` at f8fa273, worktree `.claude/worktrees/audit-join`. Ports: DB 54601, app 3401, CDP 9601.

## What changed

- **`app/signin/page.tsx`.** The logo-only top bar (spec A part 5; P2: the logo links home), then the door panel (part 20). The fields moved onto the `.field` well. Sign in is the one glow. The refusal is an amber notice, and both fields take `aria-invalid` (the same for every cause, D-94 §2). F7's door now shows the club under the heading (#c-signin): the dashed initials tile, the place, and the Unclaimed pill while the club is unclaimed. "New to Pitch? Create an account" now sits inside the door after the content; it was pinned to the foot of the screen (audit #11). "Reset it" and "Create an account" are 44px targets (they were 14px). OpenInBrowser is kept. The form, its fields and the hidden `claim` input are unchanged.
- **`app/join/page.tsx`.** Logo-only bar, and every step in the door. The country and role questions use the shared `.choice` card. From 640px the roles go two-up and the first name and date of birth pair up (D-147). The amber notes moved onto `.card.card-amber` (radius 14 → 16). Continue moved onto the charter primary (it was a 15px-radius, 900-weight one-off) and glows unless the door is closed. Somewhere else gets the dashed globe tile. The Back on the account and parent steps was an icon-only button; it is now the page header's back with the word (a button, so the typed name and date are kept). The country gate, every age rule, and every action, name and hidden value are unchanged.
- **`app/claim/page.tsx`.** The public bar (P2): Find your club as the current page, Trials, and Sign in when signed out. A list is a page, so the content sits in the reading column (`.door-col`), not in a panel. The search is the front door's light field, and Search is the one glow. Result rows are `.fl-card`. Their Claim is a 50px primary: the inline `height:44px` is gone (audit #9), and it never glows. Signed in, "Tell us your club" is a panel from 640px. The `font-weight: 600` is gone (audit ruling → 700).
- **`app/claim/[slug]/page.tsx`.** Every step is in the door under the logo-only bar. Step 1 has the club row (dashed tile and Unclaimed pill, D-172), the masked address, and the verification line, unchanged. Step 2 has one code field set at the 34px numeral, with `aria-invalid` and `role="alert"` on a bad code. "Send it again" is the text button. The claimed screen has the solid tile with the tick and a glowing "Go to your club"; nothing on it says verified. The no-address screen has the dashed phone tile. **B2:** the shared-address warning stays on the claimed screen. It now also shows on step 1, directly above the button, as #c-shared and README walkthrough row 4 place it.
- **`components/doors/ClubRow.tsx` (new).** The club row shared by step 1 and F7's sign-in door. It takes only a name and a place, so it cannot draw a crest or a colour (D-172).
- **`app/globals.css`.** A new section, THE WAYS IN, built from tokens and the existing parts (`.door`, `.field`, `.choice`, `.pill`, `.glyph-tile`, `.fl-search`). One rule added to an existing part: `.door .choice:not(.on) .ic` lifts one step inside the panel, as `.door .glyph-tile` already does (the mockup's icon wells disappear there).

## Ran (official order, fresh seed, ports 54601/3401/9601)

| Suite | Count |
|---|---|
| reseed | dev db ready on 127.0.0.1:54601 |
| perms | **2209/2209** |
| render | **835/835** (827 before + 8 new) |
| write | **663/663** |
| reseed, next dev restarted | ok |
| layout 375 1280 | **274 views, 0 overflow**, chrome 0, join pass 8 presses, ways in 16 views 0 failures, ALL GREEN |
| palette | ALL GREEN (8 OK lines) |
| `tsc --noEmit -p .` | 0 errors |
| `NEXT_DIST_DIR=.next-check next build` | exit 0 |
| test:csp-prod | **5/5** |
| corpus-check | 0 failures, 0 warnings |
| secret-scan | no secrets |
| gate-coverage | 267/267 pinned, 0 open |

F7's checks are green (f7-r1, f7-r2, f7-w1), and so are D-94's (fp9, fp10, sr1–sr4), ctry-r1/r2, fyc-r1–r5, wt2, w15/w16, iab-r1/r2, glow1 and layout j1–j3.

**One unexplained red, not reproduced.** In my first official run, write was 662/663: x2 failed on `/g/pending/<record>` "Approve the change" (the parent's review, new in the last merge; none of my pages link to it or hold a form on it). I then ran write on a fresh seed alone: 663/663. I reran the whole official order from step 1: 663/663. Nothing I changed adds a link the write sweep follows (`/` and `/claim` are skipped), or a form, for a signed-in seat. I am reporting it for QA as a possible flake in x2 on `/g/pending`.

## Tests added (nothing existing was changed)

- **render `wi-r1`–`wi-r6` (8 checks).** They cover: the top bar (one header, the logo first in it as a link home, `.has-topbar`, no second mark); the logo-only bar on every door; /claim's public bar, with and without Sign in; one door panel on every door and none on the list; the one glow and which button carries it, on 12 views; the result row's Claim at 50px, unglowed, plus the light search field; F7's club row (dashed tile, pill, no image); and no font-weight 600, with the sign-in foot inside the door. **Red on the old markup: 8 of 8** (I swapped the four pages and globals.css back to HEAD with the dev server running).
- **layout `wi-l1`–`wi-l4` (the "ways in" pass, 8 views per width).** They cover: the logo's pixels (from 1024 it leads the bar on the left; below 1024 it is within 40px of the right edge); a door is a lifted panel from 640 and the column as drawn on a phone; one visible glow; and sign-in's foot within 40px of the well above it. **Red on the old markup:** every one of the 16 views fails. **The logo-position rule alone:** I put the old markup back, then broke only `.fl-nav-brand { order: 1 }` at ≥1024. All 8 views at 1280 failed wi-l1 ("1135px from the left").
- **Suites that read these pages (L32):** j3 (the Back after Somewhere else), the focus-ring pass on /signin and /join, f7-r1's hidden-input regex and the write sweep's sign-in form are all unchanged and green. The write sweep reaches the same pages: the new links are `/`, `/claim`, `/trials` and `/signin`, and the first two are skipped. A form-level diff (actions, names, hidden values, option values) of old against new is identical on all four pages.

## Copy for BUZ: every visible string that changed

All the approved copy fixes were already live and match the mockup word for word: the F2 claim line, step 2's line, "That club is already listed.", the removed guardian line, and the A-P7 claimed line. Nothing else was reworded. Changes:
1. `/join` account and under-16 steps: **"Back"** now shows as a word (it was an icon with `aria-label="Back"`). Source: #j-account, #j-parent.
2. `/claim` bar: **"Find your club" · "Trials" · "Sign in"** (signed in: the first two). Source: P2, approved nav words.
3. `/signin?claim={slug}`: the club row under the heading, which shows **{Club}**, **{suburb} {state}** and **"Unclaimed"** (the claim step's own word). Source: #c-signin.
4. `/claim/{slug}` step 1: **"This is the club’s shared address. It can run the page, but your Technical Director signs up with their own email address to read the register."** now also shows above "Send me the code" when the account's address is the club's published one. Source: #c-shared; README walkthrough table row 4.

## Left, or for the tech team

- **B2 on `/join` 3b** (README row 4: "and `/join` 3b once F7 carries the club there") is **not built.** It would have to compare the typed address with the club's published address before the account exists. That means either sending the full club address to a client page, which goes against D-172's masking ruling, or a server check inside `createClubAccount`. That is behaviour, and it is the tech team's call.
- **No suite renders B2 in either place.** The seed has no account whose email is a club's contact address. A fixture would let render pin both placements.
- **Back placement:** I followed spec A part 5 (the page header's back, in the column at every width, as `/reset` does) rather than the mockup (in the bar on a phone, at the top of the panel from 1024). It is one control at every width, and j3 is untouched. On a phone it sits under the bar instead of in it.
- **Audit #12 (say it once on `/signin?claim`)** is words, so it is for BUZ. The mockup keeps both lines.
- **Audit #16:** `.btn-secondary` measures 48px because `.btn` has no `box-sizing`. This is a global fix, not mine, and it shows here on "No password yet?" and "Sign in to tell us your club".
- Shared parts win over the mockup's one-offs: GlyphTile is 56px (the mockup draws 52/64), and the Unclaimed pill is `.pill.pill-wait` (letter-spacing 0.06em, not 0.14em).
- Screenshots, before and after at 375 and 1280 (25 states each, 50 per set), are in `docs/design/reports/2026-10-02-join-signin-claim-shots/` (untracked).
