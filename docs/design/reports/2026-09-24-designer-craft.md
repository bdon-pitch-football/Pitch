# designer: is it beautifully made? (24 Sep 2026)

**Asked (Leo):** judge the craft, as a designer judges a portfolio piece. Not "is
it usable" — the user seat has that. Typography, colour, space, consistency; the
best screen and the worst; and BUZ's brief for the round — *"interactive, have
layers and not just be another app"* — read as a question about depth, materials
and restraint.

**Material.** `CLAUDE.md` Night Match charter · `docs/team/TRAINING.md` ·
`docs/design/reports/2026-09-23-audit-laptop-and-tablet.md` · `app/globals.css`
(592 lines) · `lib/palette.ts` · `lib/ui.ts` · the captures in
`docs/design/screens/` · exhaustive counts over `app/`, `components/`, `lib/`.
**Widths:** 1280 and 820 were complete (86 each); the **390 set landed from the
capture seat while I was writing** and I have read it (42 screens) — it sharpens
two findings below rather than changing any. **1024 and 1440 had not arrived**, so
no judgement here rests on them.

**Nothing changed.** Read-only. No product copy is proposed; where wording would
help I say so and stop, because every user-visible string is BUZ's.

**A note on scope before the numbers.** Roughly three quarters of the raw colour
drift in this repo (436 of 594 hardcoded hexes) is in
`components/coming-soon/ComingSoon.tsx` and `components/site-preview/`, which are
the marketing surfaces, not the product. I have kept them separate throughout. The
product is far cleaner than a naive grep suggests, and the team that consolidated
`lib/palette.ts` on 16 Sep did real work. **The findings below are about the
product.**

---

## The short answer

The product is **well organised and under-designed**. Somebody built a proper
token layer, named the radii, named the five letter-spacings, wrote a
`.card-sunken` for depth and a `.numeral` tier for display figures — and then
almost nobody used them. `--hero` is referenced **zero times**. `var(--*)` is used
81 times against 1,316 `T.*` literals. The depth token that exists specifically to
create layers is applied to 30 of 450 cards.

So the honest answer to BUZ's brief is the uncomfortable one: **the app is not
flat because someone chose flatness. It is flat because the decisions that would
have given it layers were made, written down, and then not carried out.** The
design system is a memo, not a material.

And the single measurement that explains the whole feeling is this one.

---

## 1 · The surface stack is, perceptually, one colour — **highest cost**

`app/globals.css:6, 232–241` · `lib/palette.ts:17–21`

Five surface levels ship. Their WCAG contrast against each other:

| Pair | Ratio |
|---|---|
| a `.card` against the page (`--surface` on `--bg`) | **1.07 : 1** |
| `.card-sunken` against `.card` | **1.04 : 1** |
| `--line` (the border) against `--surface` | 1.31 : 1 |

1.00:1 is *identical*. Put the green channel side by side and the whole system —
page, sunken, card, card-2, border — lives between **G=11 and G=36 out of 255**.
Five named levels inside 10% of one channel, in steps of 5, 5, 4 and 9 units.

**This is the layers answer.** A card is not sitting on the page; it is drawn on
the page with a hairline. The only thing doing the separating is the 1px border,
which is why the product reads as a wireframe that got coloured in — outlines
everywhere, elevation nowhere. And `--surface-sunken` (`globals.css:241`), added
explicitly because *"Two levels forced every card to look identical, which is most
of why the app reads flat"*, is **1.04:1 from the thing it was meant to sit below**.
The author diagnosed it correctly and then picked a value that cannot be seen.

Two aggravating details:

- **`body` is `#070b09`** (`globals.css:6`), which is *not* `--bg` `#0b120e`. So
  there is an unnamed sixth level under everything, and `--bg` is itself a raised
  surface. Nobody decided that; it is a leftover.
- **The product carries 12 `box-shadow` declarations in all of `app/`.** The
  coming-soon marketing page carries 24. **The marketing site has twice the
  material vocabulary of the product it advertises.** Of the product's 12, not one
  is a resting elevation on a card — they are all avatar rings and banner edges
  (`app/fc/[slug]/page.tsx:170`, `app/c/[slug]/page.tsx:131`,
  `app/coach/edit/page.tsx:171`, `app/club/page-edit/page.tsx:117`).

**The 390 captures narrow where this costs us, and it is worth being precise.** At
phone width the cards tile nearly edge-to-edge, the stack is short, and the 1px
border carries the separation adequately — `390-player-home.png` does not read as
flat. **The surface-stack failure is overwhelmingly a desktop failure**, because at
1280 a card sits in a field of near-identical black with 386px beside it and the
hairline is the only thing saying "this is an object". That is the same complaint
BUZ raised as "empty", arriving by a different route: the laptop looks empty partly
because the things on it barely register as things.

The only real elevation in the product is `.lift:hover`
(`globals.css:132–136`, `0 8px 28px rgba(0,0,0,.35)`) — **a shadow that exists
only under a mouse pointer.** On a phone it never renders at all. The product's
depth is opt-in, hover-only, and therefore invisible to most of its users most of
the time.

**What genuine material actually exists, in full:** the backdrop blur on the phone
tab bar (`globals.css:427`), the `.avatar-ring` (`globals.css:172`, 3 uses), the
`.seat-sheet` drop shadow (`globals.css:452`, 1 use), and the `.sheen` gradient
sweep (5 uses). Four gestures, three of them used once or twice. That is the whole
inventory.

---

## 2 · Typography: 28 sizes, two perceptible tiers — **very high cost**

The charter asks for one family, four weights, a fixed scale. Two of the three
hold. The scale does not.

**Weights are nearly clean, and that is a win worth recording.** `font-weight:
600` appears **32 times**, but **only 6 of those are in the product** — 26 are in
the marketing components. The six:

`app/manage/page.tsx:18` and `:83` · `app/build/[recordId]/BuildForm.tsx:151` ·
`app/register-interest/[recordId]/InterestForm.tsx:88` ·
`app/g/invite/[invitationId]/page.tsx:127` · `app/unsubscribe/page.tsx:36`

`app/manage/page.tsx:18` is the worst of the six because it is a **shared button
style constant** — so every button on Manage renders at 700 where the charter says
800. The other five are single labels. Cheap to fix; someone has clearly been
policing this already.

**The scale is the real problem.** 1,363 font-size declarations, **66 distinct
values; 28 distinct in the core product UI**. A fixed scale is 8 to 12 values.
Worse than the count is the distribution:

| Size | Uses | | Size | Uses |
|---|---|---|---|---|
| 12.5 | 221 | | 14.5 | 50 |
| 13 | 167 | | 11.5 | 34 |
| 12 | 163 | | 15.5 | 10 |
| 14 | 158 | | 26 | 48 |
| 13.5 | 100 | | 34 | 3 |
| 15 | 75 | | 36 | 1 |
| 11 | 63 | | 56 | 1 |

**Eight sizes between 11px and 15px account for 997 of 1,363 declarations — 73% of
all type in the product sits inside a 4-pixel band**, in half-pixel steps. 12.5 and
13 are not two sizes. Nobody has ever perceived a half-pixel step. What the product
actually has is roughly **two tiers: "small" and "title"** — and eight spellings of
the first one.

That is your "everything whispering". Hierarchy is being attempted with a
difference that does not exist, so the work lands on weight and colour alone, which
is why so many screens read as one texture.

Meanwhile **the display tier is defined and unused.** `globals.css:282–285` gives
`.numeral` / `-l` (56px) / `-m` (34px) / `-s` (22px) with `-0.04em` and tabular
figures. Usage: `.numeral-l` **4**, `.numeral-m` **15**, `.numeral-s` **1**. The
file's own comment says it: *"the product renders almost every number as body
text. A register of ninety-nine players should say ninety-nine like it means it."*
The charter has a voice for numbers and the product almost never uses it.

**Where hierarchy is doing real work:** `/club/register` — `100 PLAYERS` at display
size beside three smaller hued state numerals, with the label tracked and muted
beneath. That is one screen using three tiers correctly, and it is visibly the best
screen in the product. `/p/dev-deniz` — "Deniz Yılmaz" at 900/-0.015em over a muted
meta line. Right.

**Where everything shouts:** nowhere, honestly. The product has the opposite fault.

**Where everything whispers:** `/club/billing`. "Your plan" is ~14px secondary;
"**$54 a month**" is ~17px/800 ink. **Three pixels of difference between a label
and the price of the product.** The page attached to our entire club revenue sets
its one number in body text. `.numeral-l` exists for exactly this.

### Two typographic faults that are small and genuinely embarrassing

**Faux italics on the Interest Register.** `app/layout.tsx:10–14` loads Archivo at
`weight: ['500','700','800','900']` and **no italic style**. Five places set
`fontStyle: 'italic'`:

- `app/club/register/page.tsx:240` and `:381` — **the family's own words about
  their child**, quoted on the screen the paying customer stares at all season
- `app/coach/register/page.tsx:157` · `app/club/invite/[registrationId]/page.tsx:75`
  · `app/g/invite/[invitationId]/page.tsx:201`

With no italic face loaded, every one of those renders as a **browser-synthesised
oblique** — the roman mechanically sheared. The one moment the product speaks in a
parent's voice, it does it in a fake italic. Either load the italic or set quotes
some other way; slanting Archivo by machine is the kind of thing a designer sees
instantly and cannot unsee.

**The wordmark breaks the letter-spacing rule.** `components/Wordmark.tsx:8` sets
`letterSpacing: '-.035em'`. The charter allows exactly five values and that is not
one of them. It is a sixth value, and it is on the brand mark — the one element the
charter is most insistent about.

Across the product the tracking discipline is otherwise good: 284 declarations,
**64 off-charter, and 51 of those 64 are in marketing, the OG image or the print
stylesheet.** In the product proper it is about seven strays
(`app/manage/page.tsx`, `app/unsubscribe/page.tsx:30`, `app/legal/legal-page.tsx:15`,
`components/quiet-shell.tsx:19`, `Wordmark.tsx:8`). That is a system being held.

**The exception that matters:** `app/p/[token]/opengraph-image.tsx` sets tracking
in **pixels** — `-30px` (`:90`), `-6px` (`:102`), `7px` (`:95`), `3.5px` (`:120`),
`-3px` (`:119`), `-1.5px` (`:35`) — and `app/g/card/[cardId]/image/route.tsx:63–77`
computes it arithmetically. The charter calls the shared card *"the product"* for a
parent. **It is the one artefact typeset entirely outside the type system.** Satori
constrains what is possible here, so this is a "know it and own it", not a
scolding — but it should be a named exception with its own scale, not six loose px
values.

---

## 3 · Colour: the extra hues are earning their place; the accent is not — **high cost**

**The four off-charter tokens are good work and the charter text is what is
stale.** `lib/palette.ts:20, 28–30` ships `sunken`, `amber`, `purple`, `red`. Three
of them carry consistent meaning across the whole product:

- **amber = held / waiting / shortlisted**, 124 uses, and the same hue is the
  form-error border on ~28 cards. One colour, two jobs (a caution state and a
  validation state) — defensible, related, and applied without exception.
- **purple = the guardian**, 54 uses. Used with real discipline: the kicker on
  every parent-originated screen (`app/g/*`), the 36–44px person-icon tile at
  `rgba(164,121,226,.18)`, the `INVITED` chip and its matching numeral. A parent's
  colour, consistently.
- **red = destructive and "not shared"**, 44 uses. Delete panels, revoke-all, and
  the 15px cross in the what-is-and-isn't-shared lists. Never decorative.

**Recommendation: take these to BUZ for D-numbers and update the charter, rather
than treating them as drift.** A product with six actor-states and one accent
cannot say anything; this is the system growing correctly. Two caveats:

- `app/club/register/page.tsx:31–33` carries a comment asserting *"Purple is a
  charter token already."* It is not — `CLAUDE.md` does not list it. A comment
  that grants itself permission is how a token set forks quietly.
- Two hues exist outside `lib/palette.ts` altogether: **`#d95926` orange** (the
  coach persona, declared locally at `components/site-preview/SitePreview.tsx:25`
  and `components/coming-soon/data.ts:7`) and **`#3987e5` blue**, still rendering
  an `Invited` tag at `app/design/page.tsx:94` after the register replaced it with
  purple. The design page is showing a colour the product no longer uses.

**The accent is the problem, and it is a restraint problem.** `#3ddc84` is
referenced **380 times across 65 of roughly 90 coloured files**, in four
incompatible notations (`T.accent` 218 · raw hex 60 · `var(--accent)` 32 ·
`C.accent` 14) plus **23 distinct alpha tints** of `rgba(61,220,132,…)` — including
`.1` and `.10` spelled both ways, and a de-facto "accent wash" at `.14` used 20
times with `.12`, `.16`, `.07` as near-duplicates nobody can distinguish.

But the count is not the finding. **Where it is spent is.** `globals.css:16`:

```css
a { color: #3ddc84; }
```

Every link in the product is accent. Look at `1280-club-admin-home.png`: the
loudest, greenest thing on the screen is the string
`pitchfootball.com.au/fc/riverside-fc` — a **URL you read** — while the **Copy
button beside it**, the actual action, is `surface-2` grey. The green points at the
noun and the grey points at the verb. Exactly backwards, on the club
administrator's first-run screen.

And then the inverse, on the page that matters most commercially:
`1280-club-td-club_billing.png` has **no accent anywhere** except the sidebar's
active-row bar and a 6px "Verified club" dot. The only action on a paid surface is
a secondary button. When accent is on every link it stops meaning "act here", and
the screens that most need a focal point no longer have a way to make one.

**Even the good screen shows the strain.** `390-player-home.png` is the
best-composed screen in the product and it carries **six accent elements at once**:
the `LIVE` pill, the URL string, the progress-bar fill, "You are on their
register", the `Send my CV to a club` primary, and the active tab. The button still
wins — it is the only *filled* one — but it is winning against five competitors it
should not have. Fill, not hue, is doing the work; the hue has been spent down to
nothing.

**One accent, spent on actions, is worth more than one accent spent everywhere.**

### The gradient

The charter has one: `160deg #123326 → #0c1d14 → #0a1510`. `globals.css:257`
correctly defines it as `--hero`.

**`var(--hero)` is used zero times.** The gradient is hardcoded as a literal in
**five different variants**:

| Variant | Uses |
|---|---|
| `160deg, #123326 0%, #0c1d14 60%, #0a1510 100%` (correct) | 8 |
| `160deg, #123326, #0c1d14` (two-stop, wrong final colour) | 8 |
| `160deg, #123326, #0a1510` (middle stop skipped) | 2 |
| `160deg, #123326 0%, #0c1d14 100%` | 1 |
| `160deg, #16281f 0%, #0e1b15 72%` (different greens entirely) | 1 |

**`app/home/page.tsx` carries both the three-stop and the two-stop version** — so
two hero cards on one screen do not match, and the half of the product that uses
the two-stop variant ends on `#0c1d14` where the other half ends on `#0a1510`.
There is also a **second, undeclared page gradient**: `.floodlight`
(`globals.css:167–170`, 61 uses) using `#17422e` and `#10281c`, neither of which is
a token. It is a nice effect. It is also the most-used gradient in the product and
it is in no charter.

---

## 4 · Space and rhythm

**Card padding is a single value and it is a phone value.** `--card-pad: 15px 14px`
(`globals.css:273`), applied by `.card` 450 times. The charter set it against 390px
artboards. At a 604px reading column and a 932px console it is thin — 14px of side
padding inside a 900px card is a 1.5% gutter, and it is why wide cards read as
strips rather than panels. D-147 forbids changing the *type scale* across
breakpoints for good reason; it says nothing about padding, and padding is the
correct lever. **One extra step at ≥1024px would do more for the "empty laptop"
complaint than any amount of new content.**

**Radii are disciplined** — 16/12/22/14/999 named at `globals.css:260–264` — with
one stray: `.tag { border-radius: 7px }` (`globals.css:499`), a sixth radius on the
status chips.

**Where the eye goes first, on the six screens that matter:**

| Screen | Eye lands on | Should land on | Verdict |
|---|---|---|---|
| `/club/register` | `100 PLAYERS` | the register | **right** |
| `/p/dev-deniz` | "Deniz Yılmaz" | the player | **right** |
| `/ops/verification` | the red-bordered invariant banner | the rule, then the data | **right** |
| `player` `/home` | the accent "Send my CV to a club" | the one action | **right** |
| `club-admin` `/home` | the green URL string | "Post a trial" | **wrong** |
| `/club/billing` | nothing — no focal point exists | the plan, then the action | **wrong** |

Four of six are right. Both failures are the same failure: no accent on the action.

**Vertical rhythm** is the weakest part of the space work, and it is a consequence
of finding 1. Long pages are a stack of equal-weight bordered rectangles with
equal gaps, so there is no phrasing — no sense of "this group, then that group".
`/coach/edit` is 4,162px tall at 1280 and reads as one undifferentiated column;
`/club/squads/<id>` puts **four `.card-sunken` explanatory wells on one screen**
(`app/club/squads/[squadId]/page.tsx:190, 326, 340, 368`) that, at 1.04:1, are
indistinguishable from the cards they sit among. The sunken level is being used
correctly and semantically — it simply cannot be seen.

---

## 5 · Consistency as craft — the counts

**Buttons: the charter allows two. Five ship.** `globals.css:365–396`:

1. `.btn-primary` — 50px, accent, 800 — correct
2. `.btn-secondary` — 46px, surface-2, 700 — correct
3. `.btn-ghost` — 44px, transparent, muted (14 uses) — **self-flagged in the file**
   as *"a stretch and is flagged"*, with an accessibility justification that is
   sound: a 44px hit area for "Not now" is a requirement, not a style
4. `.console-btn` — 44px, 13px, `--r-well` radius (11 uses)
5. `.console-btn-primary` — accent variant (1 use)

Plus `.chip` (55 uses, 44px, pill) which is button-shaped and pressable. The
prior audit measured **seven** treatments in pixels; the source says five classes
plus inline one-offs. The ghost and the console pair both have real reasons — but
*"there is no third button"* now means five, and the file knows it. **Take the
ghost and the console density to BUZ as amendments; they are defensible. What is
not defensible is that `.console-btn-primary` exists once**, so a console table
has an accent action on exactly one screen.

**The section label is defined twice, with different tracking.** This is the
cleanest example of drift in the repo:

- `lib/ui.ts:16` — `sectionLabel`: 11px, 800, uppercase, muted, **`0.14em`**
- `app/globals.css:513` — `.kicker`: 11px, 800, uppercase, muted, **`var(--ls-label)` = 0.06em**

Same object. Same size, weight, case, colour. **Two different letter-spacings**,
in the two files that each describe themselves as the single definition. `.kicker`
is used 65 times. The charter is explicit — *"Section labels: 11px, 800, uppercase,
letter-spacing 0.14em, muted"* — so **`globals.css:513` is simply wrong**, and
`lib/ui.ts`'s own header comment ("The charter has exactly two") was written by
someone fixing this very class of bug in a different file.

**The token layer is 6% adopted.** 81 `var(--*)` against **1,316 `T.*`** in `app/`.
`globals.css:228` says *"Components move onto them screen by screen."* Two hundred
and thirty lines of token layer are carrying 6% of the product. This is not
cosmetic: the charter's theme-readiness requirement (*"implement every colour as a
CSS custom property… so a future light theme is a token-set addition, not a
redesign"*) is, today, not met, and the light print stylesheet for the public CV is
a named fast-follow.

**Logo:** the prior audit measured four horizontal positions plus top-left on the
legal pages, against BUZ's "top right, no exceptions". I confirm the cause is
structural, not scattered: `Wordmark.tsx:32` renders `HeaderMark` inside whatever
container the page uses, so the mark is top-right *of the column*, not of the
screen. One component, four positions. Nothing to count further — it is one fix.

**Off-charter one-off surface colours** used for hover and focus states, none of
them tokens: `#1d2a24` (`globals.css:305`, `:349` — focused field, hovered file
drop), `#1f2c26` (`:376`, `:394` — hovered secondary and console buttons),
`#2e3f36` (`:134`, with `!important` — hovered card border). These are the
interaction layer, and the interaction layer has no tokens at all.

---

## 6 · The one that is genuinely well made, and the one that would embarrass us

### Well made: `/club/register` — `1280-club-td-club_register.png`

The user seat and the audit seat both called this the best screen. From my seat
the reason is specifically typographic and chromatic, and it is worth naming so it
can be copied:

**It is the only screen in the product that uses three type tiers and four hues
with a rule.** `100` at display size in ink is the whole; `79 / 11 / 10` one tier
down in accent / amber / purple are the parts; `PLAYERS / NEW / SHORTLISTED /
INVITED` are tracked muted caps beneath. Then **the same three hues reappear
unchanged** in the filter chips and again in the row pills, so the colour is a
legend you learn once at the top of the page and then read all the way down. That
is a system doing work, not decoration. The filter chips carry live counts so you
know what a filter costs before you press it, and the child-safety line sits
*above* the data.

It is also the screen where the wells are doing something: the quoted note sits in
a `surface2` well at 12.5px, inset from the row. It is the one place a layer is
visible, and it is visible because it used `--surface-2` rather than
`--surface-sunken`.

Three things stop it being finished: the quote is a **faux italic**
(`app/club/register/page.tsx:240, :381`); the two right-hand columns are
**unheaded**; and the last column alternates between an accent button and plain
grey text, so it has no consistent edge.

### Would embarrass us: `/club/billing` — `1280-club-td-club_billing.png`

Not because it is empty — the audit seat covered the emptiness, and empty is not
automatically a fault (`/g/pending` is empty and excellent). It is because
**every craft decision available was declined.**

On a 1280 laptop the page is four elements. In design terms:

- The price — **the number this entire business runs on** — is set at 17px/800,
  three pixels larger than its own label. `.numeral-l` (56px, 900, `-0.04em`,
  tabular) exists at `globals.css:282–283` and would have made this page mean
  something in one line of markup.
- The plan card (`--surface`) and the action button (`--surface-2`) are the same
  width, the same radius, and **1.10:1 apart in contrast**. Two identical grey
  strips, one of which is information and one of which is the only thing you can
  do. Nothing distinguishes them.
- `.card-sunken` exists precisely for *"a well for content you read rather than act
  on"*. The plan card is read-only. It is not used.
- **There is no accent on the page.** The one action is secondary. `app/club/billing/page.tsx`
  references accent 3 times, all in the sidebar chrome.
- The card keeps `15px 14px` phone padding at 604px wide, so the most important
  card in the club's experience of us is an 80px strip.

A technical director opens this to check what he is paying for and finds a page
that looks unbuilt — while the register two clicks away looks like a serious tool.
**The gap between those two screens is the gap between "we have a design system"
and "we used it."**

---

## 7 · BUZ's brief: layers, materials, restraint

> *"interactive, have layers and not just be another app"*

**What gives a flat dark UI layers without becoming decoration** is four things,
and we have credible versions of three of them already:

1. **Separation you can actually see** — surface steps far enough apart to read
   without a border. Ours are 1.04–1.07:1. **This is the whole finding.**
2. **Light with a direction** — one consistent source, so raised things are lighter
   at the top and sunken things are darker. `.floodlight` (`globals.css:167`) does
   exactly this at page level, 61 uses, and it is the best idea in the stylesheet.
   Nothing at *component* level obeys it: every card is a flat fill.
3. **Shadow as information, not effect** — a resting elevation that says "this is
   above that". We have one, on hover only.
4. **One real material** — the tab bar's `backdrop-filter: blur(10px)` over
   `rgba(11,18,14,.94)` (`globals.css:427`). It is the only thing in the product
   that behaves like a physical surface, and it is used once, on phones.

**What is flat because nobody decided, rather than because someone chose
flatness** — this was the actual question, and the answer is specific:

- `--surface-sunken` was decided (correctly, with a comment explaining why) and
  then given a value 1.04:1 from its neighbour. **The decision was made; the value
  was not.**
- `--hero` was decided and then used zero times.
- `.numeral` was decided and then used 20 times out of hundreds of numbers.
- `.lift` was decided and then attached to a hover state, which most of our users
  do not have.
- The token layer was decided and then adopted at 6%.

Every one of those is a decision that was made and not carried. **That is a
different and much cheaper problem than a design that chose wrong** — the thinking
is done and written down in `globals.css`; it needs to be spent.

**On restraint, one honest counter-note.** The charter's instinct — two buttons,
seven tokens, five letter-spacings, one gradient — is right, and the product is
better for having been held to it. But restraint with nothing to be restrained
about is just absence. `/club/billing` is not restrained; it is unfinished, and it
looks unfinished. `/g/pending` is restrained, and reads as calm, because the few
things on it are *made*. The difference is craft, not quantity.

---

## The three things I would change first, given a day

**1 · Re-pitch the surface stack and add one resting elevation.**
`app/globals.css:232–241`. Widen the steps so `--surface` reads against `--bg` and
`--surface-sunken` reads below `--surface` — roughly 2 : 1 and 1.4 : 1 rather than
1.07 and 1.04 — and reconcile `body` (`:6`) with `--bg`. Then give `.card` a
resting shadow, not a hover one, lit from the same direction as `.floodlight`.
**This is the layers brief, it touches four lines, and it changes every one of the
450 cards in the product at once.** Nothing else on this list comes close for
effect per line changed. It needs a palette-check update and a D-number, because it
moves charter values.

**2 · Collapse the type scale and switch the display tier on.**
Eight sizes between 11 and 15 become three. `12.5`, `13` and `13.5` — 488
declarations — are one size. Then spend `.numeral-l` where a number is the point:
the price on `/club/billing`, the stat tiles on the public CV, the counts on every
dashboard. **The product currently has two perceptible type tiers; this gives it
four**, and it is the difference between a screen that is legible and a screen that
is composed.

**3 · Make the accent mean "act here", and put the gradient behind its token.**
Remove the blanket `a { color: #3ddc84 }` (`globals.css:16`) so green stops
labelling nouns, and give `/club/billing` and `club-admin` `/home` a primary
action. In the same pass, replace the five hardcoded gradient variants with
`var(--hero)` — the token is already correct at `globals.css:257`, it is a
find-and-replace across ~20 call sites, and it silently fixes the two mismatched
hero cards on `app/home/page.tsx`.

*(Honourable fourth, ten minutes: `globals.css:513` `.kicker` should be
`var(--ls-caps)`, not `var(--ls-label)`. It is 65 uses of a section label set at
the wrong tracking, against an unambiguous charter line.)*

---

**Found, outside my lane:**

- **For copy check / Leo:** the faux-italic quotes at
  `app/club/register/page.tsx:240, :381` render a family's own words in a
  machine-sheared face. Whether to load Archivo italic or restyle the quote is a
  design call; that it currently ships synthesised is a defect.
- **For Leo:** `app/design/page.tsx:94` still renders the retired `#3987e5` blue
  `Invited` tag that `app/club/register/page.tsx:31` says was replaced by purple.
  Our own design reference page is out of date with the product.
- **For BUZ, as decisions:** `sunken`, `amber`, `purple` and `red` are used
  coherently and should get D-numbers and a charter update rather than being
  carried as drift. Same for `.btn-ghost` (44px accessibility floor) and the
  console button density. The charter text is the stale artefact here, not the code.
- **Still true from 23 Sep and worth repeating:** `/privacy` and `/terms` publish
  our internal change log. It is still the worst thing a careful reader meets.

**Copy for BUZ:** none. No user-visible string is proposed or changed in this
report.

**Ran:** no suites — this seat measures, it does not build. Counts are `grep`/`rg`
with `sort | uniq -c` over `app/`, `components/`, `lib/` (no `node_modules`);
contrast ratios are WCAG relative luminance computed from the token hex values.
**Changed:** nothing in the product, and no capture. Only this report.

**Risks / not checked:** 1024 and 1440 had not been captured when I read
`screens/`, so nothing here is judged at those widths — and 1024 is exactly where
D-147 switches layout, so a finding could hide there. The 390 set arrived late and
I read it, but less thoroughly than 1280. Contrast ratios come from the hexes, not
from a calibrated display — the *ratios* are exact, how visible a 1.07:1 step feels
on BUZ's screen in daylight is a judgement. I did not open the running app on 3000
beyond what the captures show, did not reseed anything, and did not touch 3030 or
54323.

**Lesson:** when a stylesheet contains a comment explaining why a token was added,
check whether the token's *value* delivers what the comment promises.
`--surface-sunken` has a paragraph of correct reasoning above a number that makes
it invisible. The reasoning passing review is not the same as the design working.
