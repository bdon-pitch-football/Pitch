# builder: the chrome pass — focus ring, surface stack, caption (28 Sep 2026)

**Asked (Leo):** three changes in the token and chrome layer, in order — give every
form control a focus ring, make the three surfaces perceptible with a contrast
check to hold them, and fix the `.field-label` child selector — then four
under-44px controls sent mid-task, plus a written costing of three
charter-vs-code disagreements.

**Tree:** worktree `builder-chrome-pass`, branch `builder-chrome-pass`, off `app`
at `a67b70b`, merged up to `app` `7656d0a`. Commits `ee6b218` (the work) and
`86ad15a` (the merge). Own ports throughout: database **54328**, app **3028**,
DevTools **9338**. Nothing pushed, nothing deployed, no real account or key.

---

## Did

### 1 · The focus ring — `app/globals.css`, 23 component files

`:focus-visible { outline: 2px solid #3ddc84 }` was declared in the 4 Sep motion
pass at specificity (0,1,0) and lost twice over:

- `input:focus, select:focus { outline: none }` (globals.css top) is **(0,1,1)**
  and beat it — and so did `.field input, .field textarea, .field select {
  outline: none }`, which nobody had counted;
- **26 inline `outline: 'none'` declarations across 24 files** beat every
  selector there is. I found them myself rather than trusting the number: 24
  files is right, and the permission suite prints the list.

Measured the way the design seat found it — `Input.dispatchKeyEvent` Tab, not
`el.focus()`, because `:focus-visible` is a question about *how* focus arrived.
On the old code, at **both 390 and 1280**: `/signin` 2 of 2 controls ringless,
`/join` 2 of 2, `/report` 3 of 3, `/reset` 1 of 1, `/reset/[token]` 1 of 1, the
D-77 request-access form on `/p/dev-expired` 2 of 2 — every one reporting
`outlineStyle: none`, while every button and link beside them showed the ring.

Fixed at the token layer: both stylesheet suppressors deleted, the ring declared
off `var(--accent)`, and **`!important`** so that the next inline style cannot
take it away again. Twenty-five of the 26 inline overrides removed
(`border: 'none', outline: 'none',` → `border: 'none',`). The 26th is
`app/club/billing/page.tsx:18`, held by another seat this week — the `!important`
means the ring renders there anyway; the one-line tidy-up is in **Found** below.

`.field:focus-within` and `.filefield:hover` lose their background nudge: the
well already turns its border accent and the control inside it now carries its
own ring, and that third signal would have put `--muted` at 4.07:1 on the
caption inside a focused field once the surfaces came up.

### 2 · The surface stack — `app/globals.css`, `lib/palette.ts`, `scripts/palette-check.mjs`

Re-derived, not copied from `docs/design/mockups/surface-stack.html`. The
derivation, which is in the `:root` comment so the next seat inherits the
reasoning and not just the numbers:

- **The rule first:** *disclosure goes down, action goes up.* The page is the
  datum, a well you read sits below the card it is in, a control you act on sits
  above it, the hairline does the elevation work — **no shadow, no glow** added
  anywhere.
- **"Sunken" cannot mean darker than the page.** `--bg #0b120e` is **1.107:1**
  off pure black, so there is no room underneath it. Every level goes up from
  the page and sunken means below the *card*, which is the only place
  `.card-sunken` is ever used. The proposal's upward ladder was forced, not
  chosen; that is worth knowing because it is also why `--muted` has to move.
- **The step is the largest one small grey text survives.** Solving
  "`--muted` holds 4.5:1 on the topmost surface" for three equal steps gives a
  ceiling of **1.136**, so the step is **1.13**. `--muted` derived independently
  as the smallest value on its own tint line that holds 4.5 with margin — it
  came out at **#8a9d92**, the same value the proposal reached. Two independent
  derivations landing on one hex is the strongest thing I can say about it.
- **`--line` keeps the 1.31:1 it had against a card**, measured against the new
  topmost surface, so the hairline does not lose its job as the surfaces come up
  to meet it.

| token | was | now | measured |
|---|---|---|---|
| `--bg` | `#0b120e` | unchanged | the datum |
| `--surface-sunken` | `#0e1712` | `#15201a` | 1.132 above the page |
| `--surface` | `#121b16` | `#1d2b23` | 1.135 above sunken |
| `--surface-2` | `#1a2420` | `#25332c` | 1.117 above the card |
| `--line` | `#24322a` | `#32463b` | 1.31 above `--surface-2`, 1.46 above the card |
| `--muted` | `#7d8f85` | `#8a9d92` | 4.61 on `--surface-2` (AA) |

**A card now reads 1.285:1 against the page (was 1.079) and a well 1.135:1
inside its card (was 1.038).**

Three things came with it that the brief did not name and the code required:

- **`body` stopped painting an unnamed sixth level.** `background: #070b09` is
  no token; the page sat 1.044 above it, so `--bg` was itself a raised surface.
  It is `var(--bg)` now. `components/quiet-shell.tsx` carried the same literal
  (`/privacy`, `/terms`, `/manage`, `/unsubscribe`) and is on `T.bg`.
- **The interaction layer had no tokens and all three of its literals inverted.**
  `#1d2a24` (focused field, hovered file drop), `#1f2c26` (hovered secondary and
  console buttons) and `#2e3f36` (hovered card border) are all **darker** than
  the surfaces they now sit on — 1.13, 1.10 and 1.10 the wrong way. A hover would
  have dimmed the thing you were pointing at. They are two tokens now,
  `--surface-hover #2b3c34` and `--line-hover #384e42`, one step up, with no
  `lib/palette.ts` twin on purpose (a hover state is only expressible in CSS).
- Two stale `var(--token, #oldhex)` fallbacks in globals.css, and
  `a { color: #3ddc84 }` / `.navlink:hover` moved onto their tokens.

`scripts/palette-check.mjs` **measured no contrast at all** before today. It now
measures: the three ladder steps (≥1.10), a card against the page (≥1.20), a
well inside a card (≥1.10), `--line` on every surface it borders (≥1.25), that a
hover goes **up**, that `.card`/`.card-sunken` carry **no `box-shadow`**, and
every text-token/surface pair the product paints, by role: 4.5 (AA small text)
for `ink`, `secondary`, `muted`, `accent`, `amber`; 3.0 for `purple`, `red`,
`placeholder`, each with the arithmetic for why in the file. It prints the whole
32-cell table on every run.

### 3 · `.field-label` — one selector

`.field > .field-label` is a **child** selector and 19 of the 53 elements
carrying the class are not children of a `.field`: `/club/post-trial` 8,
`/club/billing` 5, `/register-interest` 4, `/club/invite` 2 — a caption above a
bare card, or a `<legend>`. The rule never matched, so nineteen captions
rendered as inherited body text; measured in Chrome at 16px/400 where the class
says 10px/800. That is why the price on the billing page was set three pixels
larger than its own label. `.field > label` stays scoped (a bare `<label>` in a
well is a caption; a `<label>` anywhere else is not). The places that use it
correctly inside a real `.field` do not move — same three declarations, and the
chrome pass reads every one of them on every page view.

### 4 · The four controls under 44px (mid-task)

Measured as the **effective tappable box** — a `.field` is usually a `<label>`
wrapping its input, so a 16px input in a 50px well is a 50px target. Confirmed
identical at all nine console widths.

- **`/report`, the 1800RESPECT number** — 79×14px, inline in the safety card,
  aimed at a parent who has just read *"If you or your child aren't safe at
  home"*. Now `display: inline-flex; min-height: 44px; margin: -11px 0;
  white-space: nowrap` — 44px of target, taken back out of the line so the
  paragraph does not grow, and the number cannot break across lines.
- **`/join`, the consent tick** — 354×23 at 390, 604×23 at 1280. The `<label>`
  wraps the input so the label *is* the target; it was 23px because it is one
  line of 12px text. `min-height: 44`.
- **`/club/roles`, the "Paid role" tick** — the same shape, the same fix. Not on
  the list I was sent; it fell out of the same measurement.
- **`/build/[recordId]/more`, the six "other football" kind chips** — 28px tall,
  **and with no checked state at all**: six identical pills, one of which is
  already selected and never said so. Replaced with the product's own
  `.chip.pick` (globals.css, the same idiom as `/club/post-trial`), which
  carries the 44px floor and the checked state together.
- **"Report this page"** — `#3a4a42` at **2.11:1**, the lowest-contrast text in
  the product, on `app/fc/[slug]/page.tsx:427` and `app/c/[slug]/page.tsx:319`.
  Both on `T.muted` now (**6.61:1** on the new page colour). The third site the
  design seat named, `components/cv/PlayerCV.tsx:284`, was **already** on
  `T.muted` — that finding was 2 of 3, not 3 of 3.
- **`/report`'s concern radios: not a defect.** Their labels already carry
  `min-height: 44` and wrap the input, so the effective box is 44px. Measured,
  not assumed.
- **Left alone: the inline links in prose.** `/privacy` and `/terms` (`mailto:`
  and `www.` links, 14–40px tall), `/signin`'s "Reset it" 49×14 and "Create an
  account" 119×14, `/club/register`'s "Clear" 34×14. Each needs a per-screen
  layout decision about that paragraph, and the legal renderer is another seat's
  file this week. The new check **reports** them (12 of them, named) rather than
  failing on them, and says why in the code.

### 5 · The checks — and each one fails on the old code

- `scripts/permission-tests.mjs`, **static, no server** — `ring1` (nothing in the
  stylesheet switches a control's outline off), `ring2` (the ring is 2px of the
  accent token and carries `!important`), `ring3` (no screen re-asserts
  `outline: 'none'`, with the one held file named and dated), `lbl1` (the caption
  rule is a class, not a child of `.field`), `lbl2` (and the nineteen captions
  are still on those four screens, so `lbl1` is not vacuous). Comments are
  stripped before the regexes run — both rules are *quoted* in the comment above
  them, and the first version of `ring1` found the explanation and called it the
  defect.
- `scripts/palette-check.mjs` — the stack, the hairline, the hover direction, no
  shadows, and the 32 text pairs.
- `scripts/layout-check.mjs`, **the chrome pass** — real Tab keypresses at 390
  and 1280 over the six signed-out forms; every `.field-label`'s computed size
  and the page's computed background on every one of the walk's views; and the
  effective tap box of every control, button, `summary` and `tel:` link. It has
  its own **two-way self-test** (L19) that rebuilds the exact broken cascade in a
  `data:` URL — `:focus-visible` at (0,1,0) under `input:focus { outline: none }`
  at (0,1,1) — and refuses to report anything unless it reads *none* on the
  suppressed field and *2px* on the `!important` one. A blind instrument is
  worse than no instrument, and this class of check is exactly where that
  happens.

**The L20 proof, run by putting the old code back** (`git checkout ee6b218^ --`
on the 28 product files, scripts left at HEAD), then restoring:

| check | on the old code |
|---|---|
| palette-check | **7 failures**: three ladder steps at 1.04/1.04/1.10, card 1.08 on the page, well 1.04 in the card, `--line` 1.19 on `--surface-2`, and the two hover tokens missing |
| `ring1` | `[true,true,true]` — all three suppressors present |
| `ring2` | no `var(--accent)`, no `!important` |
| `ring3` | **24 files** listed, which is where the number in the brief comes from |
| `lbl1` | `.field > .field-label` present, `.field-label` absent |
| chrome pass | **219 failures**: focus ring 12 (every page × both widths), `.field-label` 8 view-groups (9 captions), page colour 188 (every view), touch targets 11 distinct controls |

`lbl2` passes on the old code by design — it is the vacuity guard, not the
defect check. The only other red in the proof run was `A19`, an artefact of
reverting `app/build/[recordId]/more/page.tsx` past the D-161 merge.

---

## Ran

From a fresh seed, in TRAINING §4 order, on `86ad15a`, database 54328 / app 3028:

**perms 1148/1148 · render 392/392 · reseed · write 315/315 · reseed · layout 188
views at 375 and 1280, 0 overflow · layout console 846 views at 375·768·820·834·1023·1024·1031·1032·1280, 0 overflow**

Chrome pass, both layout runs: **22 controls tabbed to at 390 and 1280, 0
ringless · 188 (then 846) views read for `.field-label` and the page colour, 0
wrong · 0 controls under 44px · 12 prose links reported.**

Also: `tsc --noEmit` 0 errors · `palette-check` ALL GREEN (5 OK, the stack at
1.13 · 1.13 · 1.12, card 1.28 on the page, well 1.13 in the card) ·
`gate-coverage` 262 rows / 262 pinned / 0 open · `corpus-check` 0 failures 0
warnings · `secret-scan` none · `test:paths` all passed · `build:check` compiled
successfully. `bp1`–`bp7` green: the 768 console breakpoint has not moved.

**`test:render` is not read-only** — it shortlisted a registrant on the run
above, and the write suite ran after a reseed, not after it.

**Disk.** `df -h /` at my start: 15Gi available (42% used) — it was 20Gi when
this session opened and other seats were building. At the end: **16Gi (40%)**.
I cleaned up after myself and after a killed run: `.next-check` (90MB) twice,
and **152MB of leaked `pitch-layout-*` Chrome profiles** plus four orphan Chrome
processes on port 9338, left by my own layout run when the parent shell was
killed mid-flight. The script removes its profile on a clean exit; it cannot on a
kill. Worth knowing for L36.

**The merge:** `git merge`, not rebase — the branch was already committed and
measured, and a merge keeps both sides for whoever resolves this into `app`.
**One conflict, `app/build/[recordId]/more/page.tsx`, and both sides were
right:** `app` replaced `OTHER_FOOTBALL_KINDS` with `kinds` from
`experienceKindsOffered(band)` (D-161) and renamed the placeholder to
`e.g. Ashvale Lions FC`; I replaced the hand-rolled pill with `.chip.pick`.
Kept both — `kinds.map` inside `.chip.pick`, and **every word of `app`'s merged
in untouched**, Ashvale included. `scripts/permission-tests.mjs` merged cleanly.

**The file I share with the provenance seat:** `app/build/[recordId]/BuildForm.tsx`,
**one line, line 17**, the shared `input` style constant:
`{ background: 'transparent', border: 'none', outline: 'none', color: T.ink, … }`
→ `{ background: 'transparent', border: 'none', color: T.ink, … }`. Nothing else
in that file is touched, by me.

---

## Found

**A product decision I did not make, and will not.** On `/report`, *"In an
emergency, call 000"* is plain text, not a link. Making it a `tel:` link would
give it a 44px target like the 1800RESPECT number — and would also mean that a
mis-tap on a phone dials emergency services. I took the more restrictive answer
(left it as text) because that is the rule when a safety question is unclear, and
I am naming it rather than deciding it. **Options:** (a) leave as text — a
reader who needs 000 knows how to dial it; (b) make it a `tel:` link with a 44px
target and accept the mis-dial risk; (c) make it a 44px **non-link** emphasis so
the number is as findable as the other one without being tappable. No new word is
needed for any of the three.

**The surface change needs a D-number before it ships.** `--bg`, `--surface`,
`--surface-2`, `--line` and `--muted` are named in the Night Match charter. The
code is a **proposal in a branch** — nothing pushed, nothing deployed — and it
says so in `:root` and in `lib/palette.ts`.

**`--hero` is the knock-on I could not avoid and did not touch.** Against the new
card, the gradient's three stops now measure 1.074 **above**, 1.184 **below**,
1.261 **below** — so two of three stops sit *under* the ordinary cards on the
same page, and a hero panel is now darker than the plain cards beside it. The
stack is inverted at the top. If the hue is kept and the darkest stop has to
clear the card by one step, it comes out at `#1a3629` with the middle stop at
`#173726` — offered as arithmetic, not as a choice. **It is a charter value and
it is BUZ's.** It matters less than it sounds only because of the next finding.

**Three text tokens are below AA on the new top surface, and two of them were
already below it.** `placeholder` 3.65 → **3.03**, `red` 4.03 → **3.34**,
`purple` 4.87 → **4.04**. Two of them cannot be fixed by moving the surface:
`#e34948` reaches at most **4.31:1** on pure black and `#6b7d73` at most
**4.81:1**, so neither can hold AA on any Night Match surface at all — and
lifting `placeholder` to AA on `--surface-2` would require it to be *brighter
than today's `--muted`*, which inverts the ink ramp. `purple` is the one this
change actually broke: it was passing and now is not. All three carry a 3.0 floor
in `palette-check` with the arithmetic written out. **A decision for BUZ:** lift
`purple` (and possibly `red`), or accept and know. I did not choose.

**One line for whoever holds `app/club/billing/page.tsx`:** line 18, delete
`outline: 'none',` from the `input` constant. `ring3` names that file as a dated
exemption; take the exemption out when that branch lands.

**Charter vs code — what it would cost to close each, as asked.**

1. **`--hero`: 21 gradient declarations in the product, `var(--hero)` used 0
   times — and it is not a find-and-replace.** Eleven distinct variants, and only
   **9** are the charter's three-stop form; 8 are a two-stop version ending on
   the *wrong* colour, so replacing them changes what renders. Worse, **the
   product has hero gradients the charter cannot express**: amber
   (`#2b2415 → #14170f`, 4 sites) and purple (`#1b1426 → #0f0d17 → #0b120e`) for
   the caution and guardian surfaces. So closing this is: decide the hero's value
   (blocked on the finding above) → add `--hero`, `--hero-amber`,
   `--hero-purple` → 21 call sites → one `palette-check` rule forbidding a
   `linear-gradient(160deg …)` literal outside `:root`. **Half a day, one
   commit, and a BUZ decision at the front of it** — the decision is the long
   pole, not the work.
2. **Token adoption: 103 `var(--…)` against 1,422 `T.…` in the product — one in
   fourteen.** Every `T.*` site *did* move with today's values because `T` is one
   file, so the fork has not happened; it is still a fork waiting to. This is not
   one job, it is ~90 files of mechanical work that must be done screen by screen
   with a render pass after each, because an inline style and a class are not
   interchangeable where specificity matters — today's `!important` on the focus
   ring is exactly that lesson. **Two to three days, best spent one seat-screen
   at a time behind whatever feature work touches that screen anyway.** The
   cheap 80%: the ~30 `T.surface`/`T.line` card literals that `.card` already
   expresses.
3. **The type scale: 73% of type in a 4-pixel band in half-pixel steps. NOT
   attempted, and it should not be attempted as a sweep.** 12.5, 13 and 13.5 are
   one size and nobody has perceived a half-pixel step, but collapsing them
   changes ~490 declarations and every one of them can change a wrap point, a
   column fit and a tap target — the console table's five columns are budgeted in
   *measured* pixels (`bp5`), and the 1024–1031 spill was 7px. It is also a
   charter change (D-140's tokens). **Cost: one day to define the scale and get
   a D-number, then two to three days of migration with the nine-width layout
   check after every screen, and it cannot be split across seats** — half a
   scale is worse than the eight sizes. Do it as its own task with nothing else
   in the tree.

**Outside my lane, seen in passing:** `corpus-check` failed at `a67b70b` with two
S2 hits (a dead-runway date in `docs/design/reports/2026-09-24-audit-every-device.md`);
the `app` merge fixed it and it is clean now — worth knowing that it was red at a
commit somebody may have measured. And `/privacy` and `/terms` publish a real
person's email address as their contact route in 6 places; that is the legal
seat's call, not a defect I should touch.

---

## Copy for BUZ

**None.** No user-visible string is added, removed or changed. The nineteen
captions that now render at 10px carry the words they always carried; the
"other football" chips keep `EXPERIENCE_KIND_LABELS` verbatim; the 1800RESPECT
number, the consent sentence and "Report this page" are untouched as text. The
only thing awaiting BUZ is the **colour** decision (the five surface tokens, and
`--hero`, `purple`, `red`, `placeholder` behind them) and the `000` question
above.

---

## Risks

- **The surface values are unapproved charter values.** Everything measured
  green with them; none of it is BUZ's yes.
- **`--hero` is now inverted** against the cards on the same page. That is a
  real visual regression on every screen with a hero panel, and it is the one
  thing in this pass I have left worse than I found it. It cannot be fixed
  without a charter decision.
- **`!important` on the focus ring is a blunt instrument.** It is deliberate —
  twenty-four files proved that a selector is not enough — but any future
  component that legitimately needs a different focus treatment will have to
  change globals.css rather than its own file. I think that is the right place
  for that argument to happen.
- **I did not see any of this on a real screen.** Every contrast figure is exact
  arithmetic from the hexes and every measurement is Chrome's computed style; how
  a 1.285:1 step *feels* on BUZ's monitor in daylight is a judgement nobody has
  made yet. Someone should look at `/club/billing`, `/club/register` and
  `/p/dev-deniz` at 1280 before this goes further.
- **Not checked:** the OG image route and the print stylesheet, both of which
  carry their own colour literals outside the token set (the print sheet
  deliberately). The demo on 3030/54323 was not touched or restarted — after a
  merge carrying migration 0061 it holds the old schema (L14), which is the
  release seat's to know.
- The chrome pass adds two `Runtime.evaluate` calls per page view, so
  `test:layout:console` is slower than it was — about 6 minutes for 846 views.

---

## Lesson

**A rule in a stylesheet is a claim about the cascade, and the cascade is where
it dies.** Three separate rules in this pass were written correctly, reviewed,
and then beaten by something later or more specific: `:focus-visible` by a
one-class `:focus` rule and then by inline styles, `.field-label` by its own
child combinator, and `--surface-sunken` by a value that made it invisible.
Every one of them read as done in the file. **So when you add a token, a class
or a selector, prove it in a browser on a page that uses it — computed style,
real event — and make that proof the check.** A design system that has only been
read is a memo.
