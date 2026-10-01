# Safety review: the Floodlit player CV (1 Oct 2026)

Asked: an adversarial read of the player CV redesign against pillar zero, doc 14 and the register.
Tree: `.claude/worktrees/player-cv`, branch `design/player-cv` at f725a27 (off design/floodlit). The change is the uncommitted diff against HEAD in eight files: `components/cv/PlayerCV.tsx`, `StatTile.tsx`, `ClipCard.tsx`, `lib/club-colours.ts`, `app/globals.css` (THE PLAYER CARD), `scripts/permission-tests.mjs` (hist13), `CLAUDE.md` and `docs/06-Register.html` (D-173).

**Blockers: 0 · must-fix: 2 · notes: 7.**

## What I ran

- `npm run -s test:perms` (PGlite, in-process): **1948 passed, 0 failed.**
- A throwaway render probe, since deleted. It transpiled the real components with the repo's TypeScript, rendered `PlayerCV` to static HTML with `react-dom/server`, and asserted on the markup for bands `u16`, `16_17`, `18plus` and absent. The fixture was DENIZ plus a quarter, one school and one futsal entry, a zero stat, a negative stat, and club colours passed as a *verified* club (red and white).

| | u16 | 16_17 | 18plus | absent |
|---|---|---|---|---|
| Parent-approved | yes | yes | **no** | yes |
| No-reply notice | yes | yes | **no** | yes |
| School entry (D-161) | **no** | **no** | yes | **no** |
| Futsal entry | yes | yes | yes | yes |
| Context line "U15 · born Jan–Mar" (D-84) | yes | yes | yes | yes |
| Zero tile / negative tile (D-70, D-67) | none | none | none | none |
| Links on the page | `/`, `/report?…` | same | same | same |
| iframe or third-party host before press (D-97) | none | none | none | none |
| Club colour in the markup, flag off | none | none | none | none |
| `<button>` holds only phrasing content | ok | ok | ok | ok |

`clubTheme` gave a theme for `claimed`, `verified`, an invented `dispute` state and `undefined`. It refused only `unclaimed` and `suspended` (see N1).

## Checked and holding

- **Nothing new comes off the record (L2).** I compared the rendered fields old against new: photo, initials, positions, squad number, name, context line, foot, crest, club, squad, locality, band gates, stats and provenance, about, clips, achievements, previous clubs, other football, report ref. The set is the same. Only the arrangement changed. The squad number is still drawn twice (background numeral and chip), as it was before.
- **Band gates.** Parent-approved (`PlayerCV.tsx:228`) and the no-reply notice (`:337`) are still `isMinor`, and a missing band counts as a minor. D-161 still goes through `renderableExperience` (`:172`). The never-zero, positive-only filter (`:65-68`) is unchanged.
- **D-62 / D-160.** `sharedProvenance` and `provenanceLine` are unchanged. The drill still names a club and never a coach: A20d is green and `fn_stat_public` has no person field. The `:has()` sibling selectors still work because `.drill-row` and `.drill-wells` are still siblings inside `.cv-stats`. The layout check's st1 selectors (`.drill-row > *`) still match the new structure.
- **D-162.** The tile no longer carries `cv-rise`, and the new `cvRise` keyframe (globals.css) is transform-only with no opacity. The page is complete at rest. hist13 follows the reduced-motion rule into globals.css and can still fail if that rule is removed. L33 is satisfied: the check was moved, not deleted.
- **D-97.** The poster is CSS gradients and inline SVG, with nothing to fetch. The iframe's `src`, `sandbox`, `referrerPolicy` and `allow` are byte-identical to HEAD. The non-YouTube path is still `window.open(…, 'noopener,noreferrer')`. A `<button>` holding `<span>` and `<svg>` is valid HTML.
- **D-89.** No social-card surface is touched. `app/p/[token]/opengraph-image.tsx` and `app/g/card/[cardId]/image/route.tsx` import neither `club-colours` nor `PlayerCV`. ctx4 is green.
- **The logo link on a tokenised page.** `SiteNav` now renders `<a href="/">` (SiteNav.tsx:21), where the old `HeaderMark` logo was not a link. This does not leak the token:
  - `/p/:token*` is served `Referrer-Policy: no-referrer` (next.config.mjs:45-51). The later rule overrides the global `strict-origin-when-cross-origin`, and this is pinned by csp-p9 in source and by cspb4 against the built app.
  - The link is a plain `<a>`, so nothing is prefetched, and it stays same-origin.
  - "Report this page" was already a link out.
  - `signIn={false}`, so no sign-in door appears on the CV.
- **The held colours path.** It is prop-only. No caller passes `clubColours` or `clubState`: I checked all six (`/p/[token]`, `/club/register/cv`, `/club/squads/…/cv`, `/build/[recordId]/preview`, `/cv-preview`, `/preview/site`). With the flag off, `theme` is `null` whatever is passed, which the probe confirmed. With the flag on and no data path, `clubTheme(null, …)` is still `null`, so flipping the flag alone changes nothing on screen. Turning it on for real needs a new read, and that belongs in `lib/record-read.ts`. Colour values go through `isHex` and arithmetic before they reach an inline style, so a colour cannot inject CSS.
- **The other callers.** `/club/register/cv/[registrationId]` and `/club/squads/[squadId]/cv/[playerId]` still decide who may read (`fn_can_read_registration`, `fn_can_read_squad_player`) before any render. An administrator still gets not-found. The verify forms live in the caller's bar above the CV and are untouched. `/build/[recordId]/preview` is still behind `requireRecordActor`. `/cv-preview` and `/preview/site` are `notFound()` in production.
- **Out of scope, and nothing new:** no SQL, no `record-read` change, no service-role use, no message, no consent-log write, no form or id handling. No new user-visible string: every word on the page is the one HEAD had.
- **D-147 constraints 1 and 3.** DOM order is card then story at every width. Nothing is hidden at any width, and the CV passes no `back`, so `.fl-nav-back`'s desktop `display:none` does not apply.

## Must-fix

**M1 · The colours hold is enforced by nobody, and a comment says a suite checks it.**
`lib/club-colours.ts:85`: "Flip to true on John's word; the render suite checks both states." No suite references `CV_WEARS_CLUB_COLOURS`: `grep` over `scripts/` finds nothing, and the render and layout suites have no CV colour check.
- Scenario: a builder flips the flag while wiring the read for the club page, or merges it "on" by accident. Every child's CV whose club has colours then wears them, before John has cleared it. Every suite stays green.
- This is L4 (a comment making a false claim about coverage) and L19 (no check can fail).
- Smallest fix, both in the permission suite:
  - pin `CV_WEARS_CLUB_COLOURS = false` in source, with a label saying it changes only with John's ruling recorded in the register;
  - extend ctx4 so the three card surfaces never import `club-colours` or read `colour_primary`/`colour_secondary` (this pins D-89 for colours as well as for the quarter).
- Then correct the comment, or write the render check it describes.

**M2 · D-147 constraint 2: body text now scales with the viewport.**
`app/globals.css:1000`, `.cv-about { font-size: clamp(18px, 2.2vw, 22px) }`, and `:989`, `.cv-name { font-size: clamp(38px, 11vw, 54px) }`.
- The only exception BUZ approved is "the Floodlit hero headline and a club's name in its hero" (CLAUDE.md, D-173). A player's name in their own card is arguably a hero headline. The About paragraph is body copy and is not covered.
- The new D-173 note for the CV (register and CLAUDE.md) extends the width, not the type exception.
- There is also the 640–1023px band. D-147 says reading surfaces cap at 560px there, and the new CLAUDE.md row covers the CV only from 1024px, but the CV now runs full-bleed at 640–1023.
- This is not a child-safety defect. It is a register conformance defect on a page the register itself calls the most important.
- Smallest fix: fix About at one size, and either fix the name or have BUZ extend the type exception and the 640–1023 row to the CV in words.

## Notes

**N1 · When colours are switched on, gate by an allowlist and source them where the club line comes from.** `lib/club-colours.ts:70` refuses `unclaimed` and `suspended` only.
- `claimed` means the club is not verified (D-126). The probe also showed an invented future state and `undefined` passing.
- `fn_cv_club` does name a merely-claimed club on a child's CV (it excludes only `suspended`). So once the flag is on, an unverified claimant's colours would dress a child's page as that club's identity.
- `PlayerCV.tsx:174` defaults a missing `clubState` to `unclaimed`, so today's callers fail closed.
- For the tech team, when John clears it:
  - use CV colours for `verified` only (the more restrictive answer);
  - return the colours from `fn_cv_club`, in the same row as the club name and under the same state gate, through `lib/record-read`;
  - pass them from all four real callers, including `/build/[recordId]/preview`, whose banner says "This is exactly what a club sees".

**N2 · A comment on a tokenised page is wrong.** `PlayerCV.tsx:182-183`: "No links on a tokenised page — the reader was handed one link." The page carries two links (`/` and Report). They are safe, as shown above. Correct the comment so nobody later relies on it.

**N3 · ClipCard: the subtitle is no longer read to screen readers.** `ClipCard.tsx:53` still sets `aria-label="Play {title}"`, and that label now overrides the caption that moved inside the button.
- On `/fc/[slug]` and `/c/[slug]` (ClipCard is shared) the subtitle is "Nothing loads until you press play", the D-97 reassurance. Screen-reader users no longer hear it.
- Smallest fix: give the subtitle an id and add `aria-describedby`.
- This change reaches those two pages too, which the brief does not mention.

**N4 · A sticky card can hide the provenance well on short laptop screens.** `globals.css:983`, `.cv-cardcol { position: sticky; top: 76px }`.
- If the card is taller than the viewport less 76px (a 1280×720 or 1366×768 laptop, a two-line name, a provenance well open), its bottom stays below the fold until the reader reaches the end of the story column.
- A TD taps a number and appears to get nothing. D-160 says the number opens in place.
- I did not measure this. QA should run the layout check at 1280×720 and 1366×768 with wells open on a CV with clips and achievements.
- Smallest fix: `max-height: calc(100dvh - 88px); overflow: auto` on the sticky column, or stick only under a `min-height` media query.

**N5 · `/preview/site` (dev only) now breaks.** The CV sits inside a 300px Phone frame, but the grid follows viewport media queries, so on a laptop it lays out a 440px column in 300px. The page is `notFound()` in production, so this is cosmetic only.

**N6 · The club views' bar does not line up with the CV.** The back bar and verify forms sit in a 640px `.reading` column above a 1200px, left-aligned layout, and the sticky nav docks below them. The logo now takes a TD or coach from the console to `/`. There is no permission change. This is a design task.

**N7 · Outside my lane, for design, copy and Leo:**
- Literal colours and shadows where D-173 (1) and the charter say tokens: hero gradient `PlayerCV.tsx:176-178`, `globals.css:988` and `:1006`.
- Amber used as decoration on achievements, where D-173 (4) says amber is a state only.
- The register edit has no version bump. The folder copy must be synced with `cmp` when this lands on `app` (TRAINING, "two copies").
- Pre-existing, not in this diff: `/club/register/cv` writes `outside_contact_logged` for a club's own read (L5).

## What I did not check

- **Suites.** I ran no render, write, layout, CSP, timing, `tsc` or `build:check`. The one-minute load average was 195 on 14 cores, with other seats' `next dev` servers running, and TRAINING and L37 say wait rather than start. Everything here about rendered pages comes from reading the source and from the static-HTML probe, not from a browser.
- **Visuals.** I did not look at the page at any width, measure contrast of the new hero and chips, or check focus rings on the poster button (`all: unset`, as before).
- **BUZ's words.** I did not verify the quoted 1 Oct call ("Yes to all three, build it") beyond its presence in the register diff.
- **The colours read path.** It does not exist yet, so N1 is advice for it, not a finding against it.
