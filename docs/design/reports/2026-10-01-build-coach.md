# design-builder: Floodlit group E, the coach screens (1 Oct 2026)

Asked: Leo. Build group E (the coach page, its print, the editor, the registrations page, the jobs board and one role), as BUZ approved it on 1 Oct. Work on `build/coach`, off `app` at c912cf4. Sources: `design/player-cv:docs/design/specs/E-coach.md`, its README, and the coach part of the mockup `floodlit-coach-and-public.html` (the "Reflects BUZ's approvals of 1 Oct" box).
Ports: DB 54471, app 3271, CDP 9471. I never touched 3000/54322 or 3030/54323.
Approved and built: E1, E2, E4, EC1, EC2 (kept as it is) and EC3. E3 and EC4 were already live at c912cf4; their checks (dfx-E3, dfx-EC4) still pass. Club colours are **not** on the coach page (not cleared, a coach can hold two clubs). The coach screens have no invitation pair, so D-PD-0 does not come up.

## Did
- **`app/globals.css`**: two new blocks, placed after THE PLAYER CARD.
  - **THE COACH CARD.** The spec's CSS, with one change: the banner's bleed queries a named container, `.coach-root`, instead of `@media`. That container is the one `.cv-hero`'s padding reads, so the bleed and the padding can never sit a scrollbar apart at 1024–1039. The card is `.cv-hero-coach`: the player card's green fallback, with no club colour.
  - **THE COACH SCREENS.** `.textbtn` (Remove), `.panel`, `.pn-t`, `.note`, `.field-help`, `.sec-aside`, `.grid2`/`.pair2`, the banner preview `.banprev-*`, the jobs board `.jb*`/`.jr*` (E2 from 1024), and C's `--print-*` tokens with the `.ps-*` sheet.
- **`app/c/[slug]/page.tsx`** (E1, E4, EC3): rebuilt from the player card's parts.
  - Layout: `.fl-wide .cv-grid`, with the card in the sticky 440px `.cv-cardcol` and the story under `.cv-h2`.
  - The card, top to bottom: banner, photo, the Coach pill, the name (`--name-len` clamp), the role, crest and "org · region", one `.cv-tiles` band, then "WWCC verified" in the pill.
  - The story: "Coaching now" is one `.cv-timeline` with "Before that" inside it. Licences are a panel list. Wins are a `.fl-grid-2`. The own-account line follows. Clips are two-up. The December line has the dashed ring. Then the contact panel, the two share buttons two-up from 640, and `.report-link`.
  - Signed out, the nav carries the public links and a logo that goes home. Signed in, it is the logo alone, not a link.
  - Unchanged: the query (crest from membership, ordering), `showContact &&`, `kind=coach_cv`, and nothing named "token" in the code.
- **`app/c/[slug]/print/page.tsx`**: the sheet uses C's print tokens and its phone sides are 18px. The own-account line is `--print-muted`. No hex literal is left.
- **`app/p/[token]/print/PrintButton.tsx`**: C's button, `btn btn-primary btn-auto` inside `.no-print .print-bar`. This button is shared with the player's print.
- **`app/coach/edit/page.tsx`**: one panel per form, and every input sits in a `.field` well.
  - "Save & preview" is `btn btn-primary fl-glow`. "Publish my page" is a primary with no glow.
  - The four add buttons are secondaries with a stroke plus in place of "＋". Every Remove is a `.textbtn`.
  - "Current" is a neutral pill. Headings are `.sec-h`.
  - The order is E3's, as it was. Every action, field name and line is unchanged.
- **`components/cv/CopyLink.tsx`**: `className="btn btn-secondary"` (compact: `btn-auto`) replaces the hand-written style, which drew the same 46/14/700 well. Same words, still clipboard-only.
- **`app/coach/register/page.tsx`**: page title, and the filters in one panel under `.field-label`s. Each club sits under a `.sec-h`, and each registration is its own panel. "Open the CV" is the secondary. The note is no longer italic. Both empty lines sit in the empty tile. The squad head's `14px/900` line and `data-registration` are kept byte for byte (s12b, s13).
- **`app/jobs/page.tsx`** (E2, E4, EC1):
  - Signed out, the public nav bar. A coach seat gets the coach frame. Any other seat gets the logo-only top bar, as before.
  - From 1024px the title sits beside a stat row, and the stat row keeps `numeral numeral-l|m`, all in ink.
  - The roles are `card row jr` links with a neutral pill and a chevron, two-up from 1024.
  - An empty board uses the empty tile and shows no numbers. The "This sends…" well is removed.
  - `PublicAnalytics` stays beside the shell.
- **`app/jobs/[roleId]/page.tsx`**: page title, notices, the "About the role" `.sec-h`, and the form as one panel with a field well and the glowing primary. Signed out, "Sign in to put your name forward" glows. "This role has closed." now shows once: the closed panel alone when the role is closed.

## Words
- Added: "WWCC verified" (EC3, on the coach page chip). "Find your club", "Trials" and "Sign in" in the nav of the signed-out `/c/[slug]` and `/jobs` (E4; these are the approved nav words).
- Removed: "WWCC" (replaced). The "＋" glyph from "Add a role", "Add a licence", "Add an accomplishment" and "Add a clip"; the words stay and the glyph is now an icon. The `/jobs` well "This sends the club your coaching CV and whatever you write. It does not send them your phone number or your email — if you want to be reached that way, say so in your message." (EC1). The duplicate "This role has closed." when both apply.
- GET crawl: 43 states, every seat, before and after on a fresh seed. These are the only word changes. The only new doors are `/`, `/claim`, `/signin` and `/trials`, on the signed-out `/c/*` and `/jobs` (E4). No door was removed. Every form keeps its action and field names, and the only submit text that changed is the four add buttons losing "＋". No status code changed.

## Ran (from a fresh seed, in TRAINING order)
- palette: all green.
- tsc: 0 errors.
- perms: 2019/2020. The one failure is **L45/L54**, and it comes from the worktree's name, not from the product. That check matches `/send.*coach|coach.*send/` against the **absolute** path of every file under `app/`, and this tree lives at `.../worktrees/coach/app/send/...`. The same files, copied to a path without "coach", give **2020/2020**. Relative to `app/`, 0 files match.
- render: 712/712.
- write: 567/567.
- Reseed, then restart `next dev`.
- layout 375+1280: 250 views, all green.
- corpus: 0 failures, 0 warnings.
- secret-scan: clean.
- gate-coverage: 263/263.
- build:check (`.next-check`): exit 0.
- csp-prod: 5/5.

Measured by hand:
- At 1280 the card is sticky at `top: 76px` in a 440px column, and still at 76 after scrolling. Under 700px of height it is `static`.
- No horizontal scroll at 390, 700, 1024, 1031 or 1280.
- `/jobs` is two columns at 1024 and 1031, and in the coach frame at 1024. It is one column at 1023.
- The editor's two-up pairs are 243px wide at 640 and 767.
- Every Remove is 44px tall.
- At 1280, the editor shows one logo, the rail's.

## Tests touched
- **New render checks `co1`–`co10`:**
  - the 390 DOM order;
  - "WWCC verified" with no number;
  - the player-card parts, with no inline hero style and no club colour;
  - tiles present and never 0;
  - E4's doors signed out, and none signed in;
  - EC1 and ink numerals;
  - exactly one glow on the editor, on Save & preview;
  - charter buttons only, no "＋", no styled input, at least 10 `.textbtn` Removes;
  - the register's secondary and no italic;
  - the print sheet's tokens and button.
- **New write check `co-w1`:** Kingsway posts a role and closes it, and `/jobs/<id>?closed=1` says "This role has closed." once. It runs first in the write run, because the run suspends every club later and a suspended club's role is a 404.
- **Proof:** all 10 render checks failed against c912cf4 with my changes stashed, 0 of 10 passing. `co-w1` counted 2 there. All 11 pass on the build.
- No existing check was changed or loosened.

## For the tech team
- The L45/L54 check reads absolute paths. On any worktree or checkout whose path contains "coach" (or "send"/"invite" with "player"), it fails for no product reason. Suggested fix: test `relative(appDir, f)`. Not changed here: tests change only where the spec says so.
- `PrintButton` and the `--print-*` tokens are C's (spec C). I added both exactly as C specifies, because E's done-when needs them. The player print now has the same button. If `build/player` lands them too, take either copy; the values are identical.
- `CopyLink` is shared with `/home`, `/send` and `OpenInBrowser`. They now render the class-based secondary, which looks the same.
- HoPD ruling 2 makes `.btn-ghost` an alias of `.textbtn`. It is not aliased here, because doing it would restyle every Back button in the app. That is for the base-pass owner.

Screenshots: `docs/design/reports/2026-10-01-coach-shots/{before,after}/`, 31 states at 390 and 1280 each (untracked).
