# safety review: Floodlit redesign, D-173 (1 Oct 2026)

**Asked (Leo):** an adversarial read of `design/floodlit` against pillar zero, D-172, D-126, doc 14, the CSP, and D-147 constraint 3. I was also asked to confirm that every session-aware door on the club page behaves as it does on `app`, and that the three changed render expectations are honest.

**What I measured, and on which tree.** The worktree `.claude/worktrees/floodlit`, branch `design/floodlit`. HEAD is `319d8df`, and nothing on the branch is committed. `app` is one commit ahead (`9dfc7c3`, docs and `scripts/sync-trials.mjs` only), with no overlap. **The tree changed while I was reviewing it.** It started as the six files in the brief. By the end it also held club colours: `supabase/migrations/0160_club_colours.sql`, `lib/club-colours.ts`, `app/club/page-edit/{actions,page}.tsx`, and new checks in `scripts/permission-tests.mjs` and `scripts/write-tests.mjs`. I read the club-colours work too, but less deeply than the three surfaces I was asked about. The state I measured is `git status` at 23:12 on 30 Sep.

**Ran:** `npm run -s test:perms`, twice. First run: **1916 passed, 0 failed**, on the tree before club colours. Second run: **1922 passed, 0 failed**, on the tree with club colours, including col1–col6. I did not run render, write, layout or timing (see "Not checked").

**Result: 0 blockers · 3 must-fix · 8 notes.** I found no path by which this change exposes a child's data, reaches an unverified club, or weakens a door.

---

## What holds (checked, no finding)

- **The club page's session-aware doors match `app`.** I compared the old and new `app/fc/[slug]/page.tsx` branch by branch (new lines 314–362):
  - **Unclaimed:** signed out gets "Sign in to send your CV". A player with a record gets `/send/<own record>`. A parent gets one `/send/<child record>` per approved, unrevoked under-16. Anyone else gets `/join`.
  - **Claimed or verified:** signed out gets "Sign in to register your interest". A player gets `/register-interest/<own record>?club=<id>`, and a parent gets one link per under-16. The squad and trial ids only travel if they were found in the club's own server-read lists (`picked`, `pickedTrial`), so a forged `?squad=` or `?trial=` is dropped.
  - **Suspended:** the `#play` panel is still behind `!suspended`, and the squad chips are still inert `<span>`s. `susp-ad-s4` passes.
  - The session query (lines 108–119) and the under-16 filter are byte-identical to `app`. No new read of `development_record`, `player_stat`, `highlight` or `profile_version`.
- **D-126.** Nothing new sends, registers or shows anything about a minor to any club. The register and send flows are the same routes as before.
- **D-172 on an unclaimed page:**
  - The **crest is now suppressed** (`c.crest_path && !unclaimed`, line 200). On `app` it rendered whenever `crest_path` was set, and the demo club's reset keeps its crest, so this is a tightening.
  - Club colours are refused three times over for an unclaimed club: by the database (0160 `club_colours_claimed_only`), by `clubTheme()` (it returns null for unclaimed and suspended), and by the hero branch, which uses a fixed Pitch gradient.
  - Otherwise the page is unchanged from `app`. The banner is unchanged in wording, `data-unclaimed-banner` and size, and it sits in the hero ahead of the body at every width. The removal door `/report?page=…` is unchanged, the meta robots tag is unchanged, and the proxy `X-Robots-Tag` is unchanged (the curl showed `noindex, nofollow` on `/fc/brindlewood-rovers-sc` and `/fc/westgate-rangers`).
  - The claim panel's words say nothing about affiliation.
- **The CSP allows the photographs, with no change.** `lib/csp.ts` has `img-src 'self' data: blob: <storage>`, and `/assets/*.webp` is same-origin, so `'self'` covers the CSS `background-image: url(/assets/…)`. The url is in a `style` attribute, which `style-src 'self' 'unsafe-inline'` already allows. The proxy matcher excludes `/assets/`. No new host appears in any directive. I confirmed the served header on the builder's dev server at port 3036.
- **The photographs.** I looked at film-1, film-2, film-4, film-5 and story-2. All show adults, none shows a child, and no real club's kit or crest can be read. They are used only on the front door and the landings, never on `/fc/*`.
- **Injection.** No `dangerouslySetInnerHTML`, and every query is parameterised. Colour hex values reach inline styles only after `^#[0-9a-f]{6}$` passes, both in `isHex` and in the database check.
- **The club-colours action.** `saveClubColours` and `clearClubColours` take no club id from the form. `manager()` derives it from an active `technical_director` or `club_admin` membership, and anyone else is redirected to `/home` (D-77). Bad input is refused, not coerced. Write-suite cc5 asserts on state, not on the redirect (L12).
- **The test changes are honest.**
  - **fd2b** is *stricter*: it now also requires `/claim` and `/?for=parent`.
  - **fd2c** moves the parent row from `/join` to `/?for=parent`. D-173's register text and BUZ's quote ("each persona should have their own entry") both say that.
  - **fd5** swaps the h1 to the club-first line D-173 describes.

  None of the three loosens a safety assertion. fd2c still requires the approved words, and still requires that the retired line is absent.
- **D-147 and the club page's CSS `order`.** `.fl-aside-first-m { order: -1 }` below 1024px only reorders. `.fl-main` and `.fl-aside` hold the same DOM at every width, and nothing in `fl-club-body`, `fl-main`, `fl-aside` or `fl-sticky` is `display:none` at any width. So no door on the club page body exists at one width only. The exception is the nav bar (M1).

---

## Must-fix

### M1 · The nav links are desktop-only (D-147 constraint 3)
- **Where:** `app/globals.css:907` (`.fl-nav-links { display: none; }`) and `:914`. Rendered by `components/floodlit/SiteNav.tsx:23`. Fed from `app/fc/[slug]/page.tsx:169` and `components/front-door/FrontDoor.tsx:413-414`.
- **Scenario:** A parent opens `/fc/riverside-fc` on a 390px phone. On a laptop the same page offers "Find your club" (`/claim`) and "Trials" (`/trials`); on the phone neither exists anywhere on the page. The parent (`/?for=parent`) and coach (`/?for=coach`) landings are the same: their only way to `/claim` and `/trials` is the laptop nav. D-147 constraint 3 says "no desktop-only or mobile-only feature, ever", and the 15 Sep amendment says "a link that exists at 1024px and not at 390px is a desktop-only capability". Both targets are public pages, so no permission differs. The rule still breaks, and nothing checks for it: the render suite's s1/s2 parity checks cover the console sidebar, not this nav.
- **Smallest fix:** draw `.fl-nav-links` at every width, for example as a second row under 1024px, or pass the same links into the page body. Add a static check that `.fl-nav-links` is never `display:none`.

### M2 · The demo reset will fail once a demo club has picked colours
- **Where:** `scripts/demo-layer.mts:233-236`, against `supabase/migrations/0160_club_colours.sql:25-26`. This is out of my lane (release), but the failure is concrete.
- **Scenario:** In a club meeting, BUZ claims the demo club and shows "Crest & club page", and someone picks "Navy and white". The next reset runs `update club set club_state = 'unclaimed', … banner_path = null` without clearing the colours. `club_colours_claimed_only` refuses the update, the reset throws, and the demo cannot start clean for the next club. Perms col4 proves the database refuses exactly this.
- **Smallest fix:** add `colour_primary = null, colour_secondary = null` to that `update`, and run the demo reset once with colours set.

### M3 · No render, write or layout count exists for the tree as it stands
- **Where:** the builder's dev server (port 3036, dev database port 54336).
- **Scenario:** At 23:10, every `/fc/*` page on the builder's server answered **500**, with `column c.colour_primary does not exist`. The running dev database predates 0160 (L14). The report's "Render suite: 648 passed" and "Layout check… all green" were measured before club colours touched `app/fc/[slug]/page.tsx`, so no suite has rendered the club page as it will merge.
- **Smallest fix:** reseed, then run perms → render → write → reseed → layout at 375 and 1280 on the final tree. Put the counts and the commit in the handoff (L30).

---

## Notes

### N1 · The banner photograph is not gated on `unclaimed`; the crest is
- **Where:** `app/fc/[slug]/page.tsx:133` and `:180-182`.
- **Why it is only a note:** `hasBanner` is `Boolean(c.banner_path)`, whatever the club's state. Today an unclaimed club with a banner cannot happen: only an active TD or administrator uploads one (`app/club/page-edit/banner/route.ts`), and the only path back to `unclaimed` (the demo reset) clears `banner_path`. But the page's own comment (lines 161–163) claims "no image of any kind", and the crest two lines down carries the guard the banner lacks. If a club ever goes back to unclaimed another way, or someone loads a banner by SQL, U1 fails on the live site.
- **Fix:** `const hasBanner = Boolean(c.banner_path) && !unclaimed;`, and update the perms regex that pins `const hasBanner = Boolean(c.banner_path)` (`scripts/permission-tests.mjs:4746`).

### N2 · U5 cannot fail, and the redesign is what it should have caught
- **Where:** `scripts/render-tests.mjs:2491`.
- **The problem:** `bannerAt < Math.max(brind.html.indexOf('>Trials<'), brind.html.length)` always compares against `html.length`, so the fourth assertion is vacuous (L19). Written as intended, it would now **fail**: the nav's `<a …>Trials</a>` comes before the banner in the DOM. So do "Find your club" and "Sign in", which on a phone sit above the hero.
- **What to do:** John's U5 says the banner comes "before anything else on the page is offered". Ask John whether Pitch's own nav counts as "offered". Either way, fix the check to measure from the end of `<header class="fl-nav">`, and prove it fails on a build with the banner moved below the trials (L20). This matters because the 183 unclaimed pages are already live.

### N3 · "Sign in" is shown to people who are signed in
- **Where:** `components/floodlit/SiteNav.tsx:36` and `app/fc/[slug]/page.tsx:169`. `signIn` defaults to true, and the page knows `me` but does not pass it.
- **Scenario:** A signed-in parent sees "Sign in" in the bar directly above "Register Deniz's interest". `/signin` does not redirect a signed-in user. On a shared family device, a child can sign in over the parent's session from the club page. That was already possible by typing `/signin`, so it is not a new capability, but it is a new, prominent door.
- **Fix:** `signIn={!me}`.

### N4 · The Back link is phone-only
- **Where:** `app/globals.css:915`.
- It goes to `/`, which the logo also links to at every width, so no capability differs. No action needed. I record it so the next D-147 parity check does not flag it as new.

### N5 · On a phone, reading and focus order differ from the visual order
- **Where:** `app/globals.css:966` and `app/fc/[slug]/page.tsx:470`.
- On an unclaimed page below 1024px, the claim panel is drawn above "Want to play here?" but comes after it in the DOM. Keyboard and screen-reader users meet the doors in a different order from sighted users. This is accessibility, not safety. The doors are the same at both widths.

### N6 · The drawn pitch lines on an unclaimed hero
- **Where:** `app/fc/[slug]/page.tsx:173-178`.
- D-172's never-list includes "any image". This is an inline SVG drawing of pitch markings, not a file, so U1 passes, and it carries nothing of the club's. I read it as outside John's rule, which is about things the club owns. It is worth one line to John, because the rule's words are wider than its reason.

### N7 · The register and the brief are out of step
- **Register header:** `docs/06-Register.html` still says `165 locked`, but it holds 166 `st lk` entries now that D-173 is in.
- **Brief ahead of the register:** `CLAUDE.md` now records "The one type exception (BUZ, 1 Oct)" (`clamp()` on the hero headline and the club name), and D-173 in the register does not. The type exception also amends D-147 constraint 2. The register moves first.
- **Folder copy:** Leo copies the register into the Pitch 3.0 folder on merge (TRAINING, "two copies").

### N8 · The demo's unclaimed club no longer shows its crest
- **Where:** `app/fc/[slug]/page.tsx:200`.
- This is correct under D-172, and a fix. It does change what the room sees before the claim, which BUZ's 23 Sep demo exception described as "the club's own name, suburb, ground and crest". Tell the release seat and BUZ before the next meeting, so it is not read as a bug.

---

## Not checked
- **Render, write, layout, timing and CSP-prod suites.** I did not run them. They mutate the database, the builder's dev database is on a stale schema (M3), and this seat is read-only. Every width claim above comes from reading the CSS and the DOM, not from a browser at 375 or 1280.
- **The club-colours editor in a browser.** I did not open it. I relied on perms col1–col6 and read write-suite cc1–cc7 without running them.
- **The persona landings' wording.** I did not check it against the signed screens beyond the safety claims. I spot-checked seven, and all were already on `app` and in `design-screens/`. Honesty and approval are the copy seat's lane.
- **`/claim` search and `/trials`.** I did not re-audit them. They are unchanged, and the front door only links to them.
- **Whether the 183 live unclaimed club records hold a non-null `banner_path` or colour columns in production.** I have no production access. The colour columns do not exist there until 0160 runs.
