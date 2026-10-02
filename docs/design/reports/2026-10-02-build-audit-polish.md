# Build: the post-release audit's ruled fixes (2 Oct 2026)

**Seat:** design builder. **Brief:** Leo (CTO), from the Head of Product Design's rulings on `2026-10-02-audit-live-signed-in.md` and `-public.md` (design/player-cv, 1f86577). Leo added three items: the aside doors (spec A delta, daf3faa), the Premium rows (John, 2 Oct), and the WWCC heading (BUZ, verbatim).
**Branch:** `build/audit-polish`, off `app` at f8fa273 (what is live).
**Ports:** DB 54611, app 3411, CDP 9611.
**Words:** no new words beyond the three approved ones listed at the end.

## What changed

| Audit row | Fix | Where |
|---|---|---|
| Signed-in #1, copy fix | `/g/interest` before it is sent: the tick now reads "…off the register any time from {name}’s controls. Their access ends when you do." This is the approved line, as the sent state and `/register-interest` already said it. | `app/g/interest/[requestId]/page.tsx` |
| #2, D-162 | `/coach/edit`: "Sessions & clips" gets no "· n of 5" when n is 0. | `app/coach/edit/page.tsx` |
| #5 | A framed reading column is centred in the content area. The one CSS rule that pinned it to the rail is gone. That fixes `/send`, `/g/controls`, `/coach/edit`, `/build/clips` and `/build/more` (each was −164px). | `app/globals.css` |
| #6, A-P2, BUZ | From 1024px, the home aside drops each door the rail carries (`.rail-dup`), unless it has a count or a reason line, and an empty list isn't drawn. Below 1024 nothing changes. | `app/home/page.tsx`, `globals.css` |
| #7 | From 640 to 1023px, a framed home (`.home-col`, `.home-grid`) is capped at 560px and centred, so its logo sits where `/build`'s does. | `home/page.tsx`, `globals.css` |
| #8 | `/club/roles`: Close sits at the row's end (`.jr > .jr-top` stretches), and the duplicate Back is removed. | `club/roles/page.tsx`, `globals.css` |
| #9, public #5 | These are now ink or muted, not green: "You" (ink), "n interested" (muted), an active TD line on `/ops/verification` (ink), and every landing's persona label (ink; amber and purple are gone). | `home`, `ops/verification`, `FrontDoor.tsx` |
| #10, public #7 | Radii are now tokens: `.cv-hero` and `.cv-avatar` 26 → `--r-hero`; `.cv-chip` 9, the CV's 8, 13, 14 and 7 → well/card/pill; the clip card 18 → card; `.pd-club-tile` 13; `.who-tile` 15; `.club-hero-preview` 14; `.chp-crest` 15; the swatch 7; `.fl-nav-link` 10; `.fl-door` 18. | `globals.css`, `PlayerCV`, `ClipCard`, `g/controls`, `page-edit` |
| #11, spec D | "Waiting on you" is amber (`.kick-p.wait`) on `/g/interest` and `/g/pending`. A club's invitation stays purple. | `parent-sheet.tsx` |
| #13 | The coach's and TD's home link is one line with an ellipsis (`.link-1`), with Copy beside it. | `home/page.tsx`, `globals.css` |
| #14 | The build tab label is now "Your football history". | `player-parts.tsx`, `build/more` |
| #16 | Below 400px the player hero is a grid: the pill sits under the title, on its left edge, and "Your page is live" stays on one line. | `home/page.tsx`, `globals.css` |
| #17 | Dates are `FMDD` everywhere outside `/trials` and `/fc` (home, controls, post-trial, page-edit preview, clips, ops switches and support). | 7 files |
| #19 | `/register-interest` and `/share-card` now use `/g/*`'s panel header: Back is inside the panel. `/register-interest` also gets the signed-in footer, with no entity line. | `InterestForm.tsx`, `share-card`, `SiteFooter.tsx` |
| #20 | `/club/post-trial`: "Which squad" now heads the age-group and competition pickers, and Notice title stands above it. | `club/post-trial/page.tsx` |
| Public #4 | `/`: the second headline is fixed at 24px. Only the hero headline scales. | `FrontDoor.tsx` |
| Public #10 | `/jobs`: Back is its own width, with its word on the title's edge. | `globals.css` |
| Public #14 | Legal tables sit in a scrolling well (`.legal-table`), so each table is the full width at 1280. A key/value row's value sits on its label's baseline. | `legal-page.tsx` |
| Public #15, signed-in TAP | Small links now give a 44px target: a legal link gets 15px of block padding (it doesn't change the line), and the front door's foot "Sign in" gets `minWidth: 44` (it was 43.59px). | `legal-page.tsx`, `FrontDoor.tsx` |
| #21, John | No locked Premium row renders anywhere. One switch, `PREMIUM_ROWS_ON = false` (`lib/premium.ts`): the rows return null and a tap redirects home before it reads or writes anything. "See who viewed your CV" is removed from the rows, switch or no switch. | `lib/premium.ts`, `PremiumRows.tsx`, `premium-actions.ts` |
| #18, BUZ 2 Oct | WWCC heading for a coach with no club: "Confirmed once you join a club". | `coach/edit/page.tsx` |

**Seed:** I added one fictional coach, Hollis Brennan, at Tarrowvale. He has a coach page and a membership but no check confirmed yet, so "Waiting on {club}" has a seat. Accepting an invitation always attests, so no product path reaches that state.

## Counts (final run, fresh seed, in the order given)

| Step | Suite | Result |
|---|---|---|
| 1–2 | Reseed, then `next dev -p 3411` | — |
| 3 | perms | 2210/2210 (f8fa273 with these tests: 2208 pass, 2 fail — prem5 and prem6) |
| 4 | render | 842/842 |
| 5 | write | 660/660 |
| 6–7 | Reseed, then restart `next dev` | — |
| 8 | layout 375 1280 | 274 page views, 0 failures, plus 58 audit views (ap-l1–l11), 0 failures |
| 9 | palette | 8/8 |
| 9 | tsc | clean |
| 9 | `next build` (.next-check) | exit 0 |
| 9 | csp-prod | 5/5 |
| 9 | corpus | 0 failures |
| 9 | secret-scan | none |
| 9 | gate-coverage | 267/267 |

## Tests touched, and why

| Check | Status | Why |
|---|---|---|
| ap-r1 … ap-r15 (render) | New | One check per ruled row the markup shows. ap-r14 and ap-r15 cover the whole crawl: no Premium row, and no leading-zero date outside `/trials` and `/fc`. |
| ap-l1 … ap-l11 (layout) | New | The geometry: centring, the 820 cap, the pill, the link box, Close, Back, legal hairlines, the 24px headline, radii, 44px links, the aside at 1280 and 375. |
| prem6 (perms) | New | The one switch, off. The rows and the tap both return early. |
| prem-r1, r2, r4 (render) | Inverted on purpose (John) | Same pages, same strength: they now require no row. |
| prem5 (perms) | Changed on purpose | Rows the source can draw: 2 → 1, and "who viewed" is forbidden. |
| prem-w1 (write) | Inverted | It now requires no Premium form. |
| prem-w2, w2b, w3 (write) | Retired, with the reason in the file | There is nothing to press. What they guarded stays covered by prem1–prem3b, prem6 and ap-r14. |
| pr1 (layout) | Inverted | No row at 390 or 1280. |
| s16, s24 (render) | Reworded only, strength unchanged | They now say "below 1024" (spec A delta). The markup still holds every door. |

**Proof the new and changed checks are red on broken code:**
- The app code was set aside with `git stash` and the f8fa273 app was run against the new tests, on a fresh seed:
  - render: all 18 new or changed checks failed (prem-r3 and prem-r5 are unchanged and passed both ways);
  - layout: every ap-l id failed, and so did pr1;
  - perms: prem5 and prem6 failed;
  - write: prem-w1 failed.
- ap-l3 was strengthened after the after-shots showed the title dropping under the avatar. It is red on that broken CSS: "beside the avatar false".

## Not done, and why

**Out of my lane (another builder owns it):**
- #3 and #15: `/join`, `/signin`, `/claim`.
- The `/fc` hero count, `/trials` month labels, OCT date blocks (including those on homes and post-trial), the `/fc` crest radius 26, `/fc`'s `'DD'` day, the unclaimed pages' two primaries, DOM order and three report links.
- #22: the `/ops` count.

**Needs BUZ:**
- #8: "Paid" said twice on `/club/roles` (removing it is BUZ's word).
- #12: follows #6.

**Not ruled this round:**
- The landings' green section kickers, green step numerals, and the amber and purple card icons. Only the persona labels were ruled.
- `/privacy`'s `code` radius of 6.
- The share-card artwork radii.

**Found:**
- `/jobs` role cards at 1024 and up stack the pill under the title, centred. `.jr { display: flex; flex-direction: column }` from `/club/roles` (globals.css, spec F) also hits the board's `.row.jr`. This predates the build (the before shot is identical). The fix is to scope that rule to `.cc-page .jr`.
- The page-edit preview now prints "2", while `/fc` still prints "02" until the trials builder moves `/fc`.
- John's Terms v2.3 (GST figures out of A6.2) is placed in root. Syncing `docs/legal/22` into the app is the tech team's.

## Words changed (all approved)

- "You can take {name} off the register any time from {name}’s controls. Their access ends when you do." This is copy fix F3, now said in one more place.
- Tab "Achievements" → "Your football history". This is the page's approved title.
- "Confirmed once you join a club". BUZ, 2 Oct, recorded in APPROVALS-28-SEP.md.
- **Removed:** "· 0 of 5", the `/club/roles` Back, the Premium rows' words, and the entity line on `/register-interest`'s footer.

**Screenshots:** `docs/design/reports/2026-10-02-audit-polish-shots/` (untracked). There are before and after shots at 375 and 1280, with 820 for the homes. The front door was captured with its switch on.
