# design-builder: Floodlit group J, the club demo (1 Oct 2026)

Asked: Leo, building J (J-P1 and J-P2, approved by BUZ on 1 Oct) on `build/demo` off `app` at 9f2b62b. The spec is `design/player-cv:docs/design/specs/J-demo.md` plus its README, and the mockup is `floodlit-access-ops-demo.html` (section J and its approvals box).
Ports: DB 54411, app 3211, CDP 9411. I never touched 3030/54323.

## Did
- **`components/DemoBar.tsx`**: the strip is now the spec's exact markup. It sits on a dark strip (`.demo-bar`) inside `.fl-wide`, with the amber `pill pill-wait` "Demo", the line, and "Switch seat" at 44px. `role="note"`, the `/demo` link and the `isDemo()` gate are unchanged, and nothing is inline any more.
- **`app/globals.css`**: new block "THE CLUB DEMO", placed after SHELLS, as the spec asks:
  - the strip CSS. The hairline is `--line` (HoPD ruling 5, no literal colour);
  - the choice card `.choices`/`.choices.two`/`.choice` (+ `.ic .main .k .t .s .ch`), named as in the mockup so the join build can reuse it;
  - the head tile `.demo-tile`/`.demo-tile-crest`;
  - the column helpers.

  Two-up from 640px is a media query. One correction to the mockup: it uses `@container`, which only works because its artboards are containers.
- **`app/demo/page.tsx`**:
  - The top bar is `SiteNav` with the logo only and no link, as HeaderMark had it.
  - The head has the 52px club tile: the claimed club's crest (`crest_path`, J-P2), or for `--unclaimed` the dashed `empty-tile` with initials and no `<img>` (D-172).
  - Section headings are `.sec-h`. Seat cards have a stroke glyph (console-shell ICONS, plus a local lock for the held seat), the role in muted caps, and a chevron. Link cards are the same card without a glyph.
  - Each seat is still `<form action={takeSeat}>` with the hidden `seat` field.
  - No glow and no primary.
  - The query adds one column, `crest_path`.
- **`docs/DEMO.md`**: the approved doc line. "The green bar at the top" becomes "The bar at the top with the amber Demo tag".

## Ran (from a fresh seed, in TRAINING order)
palette 8 OK / 0 FAIL · tsc 0 errors · perms 1980/1980 · render 686/686 · write 543/543 · reseed · layout 238 views at 375+1280, all green · corpus 0 failures / 0 warnings · secret-scan clean · gate-coverage 263/263 pinned · build:check (`.next-check`) compiled · csp-prod 5/5.

Demo mode (my ports, the `dev-db` + `next dev` halves of `npm run demo` run by hand):
- Strip: 45px tall (44 plus the hairline). "Switch seat" is 44px. It stays on one line at 375 with nothing clipped, is `position: static`, and never overlaps the top bar or the rail, at rest or scrolled.
- Pill x=80. That equals the top-bar logo at 1280. On a framed page the rail logo is at 68; the mockup measures the same 80/68.
- `/demo`: 11 cards, the smallest 69px at 375 and 82px at 1280. One column at 375, two at 1280. 0 glows. Every chevron is an SVG.
- Walks:
  - `widths.txt` 30/30.
  - `run-sheet.txt` 38/39. The one failure is step 8, billing: `/club/billing` redirects to `/home` while `billingEnabled()` is false (D-163). This predates the build.
  - `unclaimed-claim.txt` 9/51, the same step-for-step on base 9f2b62b with my edits stashed. The drift is on `/fc`, `/join` and `/dev/outbox`, not on `/demo`.

## Tests touched
- **`dfx-J-28`, rewritten.** It read an inline `minHeight` on the strip's link, and the spec's exact markup moves that into the `.demo-bar-a` class. It now requires the link to be exactly `<a href="/demo" className="demo-bar-a">Switch seat</a>`, with no inline style, and reads `min-height` from the class's own rule.
- **New:** `dm-J1` (dark strip, amber pill, no green, never sticky, one line), `dm-J2` (shown only under `isDemo()`), `dm-J3` (a seat is still a POST form with `seat`), `dm-J4` (no glow or primary; the role is muted), `dm-J5` (unclaimed never gets an image; claimed gets its crest), `dm-J6` (two-up from 640px).
- **Proof:** one mutation per check, applied at once: link to 24px, pill-live, gate removed, field renamed, role accent, crest ungated, two-up at 1024. Result: exactly these 7 failed, and the other 1973 passed. Then I restored the sources.

## Copy for BUZ
- **No new words.** "Demo · every person here is made up" became "Demo" (in the pill) plus "every person here is made up", as the spec specifies.
- The unclaimed tile shows the club's initials, e.g. "CF". They are derived from the name.

## Left / for Leo
- `docs/WALKTHROUGH.md:19` still says "in the green bar". The spec named only DEMO.md, so I didn't change it.
- `run-sheet.txt` step 8 and `unclaimed-claim.txt` are stale against `app`. Both predate this work and belong to whoever owns the demo walks.
- Screenshots are in `docs/design/reports/2026-10-01-demo-shots/`, untracked.
