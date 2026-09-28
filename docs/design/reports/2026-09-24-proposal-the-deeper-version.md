# The deeper version — five mockups, one idea

**24 September 2026 · the proposal seat.** Read-only on product code; nothing in `app/`,
`lib/` or `components/` was touched. Everything below is `docs/design/mockups/`.

> **This is an example. It changes nothing in the product.** BUZ asked to be shown what
> "much better" looks like, so it is drawn rather than argued. Every mockup opens
> standalone from disk with no network and no build step, and carries a laptop width and
> 390 in the same page.

---

## The one idea

Five seats wrote four reports and they converge on a single sentence:

**Depth should mean depth in the record, and it should be visible.**

Everything in this set is that sentence applied to a different screen. A stat that opens
into where the number came from. A billing page where "read this" and "act here" are two
different materials. A returning family that is shown what happened rather than what they
missed. A register that is a list instead of a hundred objects. And a surface ladder wide
enough that "inside" and "on top of" are things the eye can tell apart.

It is one idea five times, not five ideas once. That is deliberate: the reason the product
reads flat is not that it lacks ideas, it is that the ideas it has are one unit of contrast
apart.

---

## The order I would build them

| # | Mockup | Effort | Why here |
|---|---|---|---|
| **0** | **Not a mockup — a one-line CSS fix**, found while drawing #2 | **minutes** | `.field-label` is written as `.field > .field-label`, and is used on 19 divs that are not children of `.field`. Nineteen form captions across four club-seat screens render as body text. Best ratio in the document by a distance. |
| **1** | `register-834.html` | **~1 day** | A defect against the only person who pays us, on the device he carries. Two media queries and five column widths. |
| **2** | `the-return.html` | **~½ day** | One `last_seen` comparison and four facts we already hold. Changes how the product feels to the family with no new data. |
| **3** | `provenance-drill.html` | **2–3 days**, one of them the permission line | Lowest urgency, highest ceiling. This is the thing that makes Pitch structurally not a profile page. |
| **4** | `surface-stack.html` | **~½ day of values, plus a BUZ decision** | Changes every screen at once. Held to fourth only because it forces a charter question (`--hero`) and a two-set commit. |
| **5** | `plan-and-billing.html` | **~½ day** | Genuinely the worst-made screen, and a treasurer sees it twice a year. Fix the label today, redraw the page when the money screens are next open. |

**Build first: `register-834.html`.** It is the cheapest thing here, it removes a
showstopper against a paying customer, and it is the only item whose absence costs someone
money rather than delight.

**Would not build at all:** see the last section. Three things, and one of them is a
mockup BUZ asked for.

---

## 1 · `provenance-drill.html` — a stat opens into where it came from

**Mockup:** `docs/design/mockups/provenance-drill.html` · 1280 and 390 · **the tiles are
live — press one.**

**What it changes.** `components/cv/PlayerCV.tsx:43` renders the whole of D-62 as a 9px
pill above the stat row: *Self-reported*, once, attached to the block rather than to the
number. The tile becomes a disclosure. Pressing it pushes open a well **inside the stats
block** carrying the date it was entered, the season and the squad; inside that well, one
more level explains what `self_reported` means. Two levels, no third. When a stat is
`coach_verified` the same well names the coach, their club and the date — and the CV stops
being a claim and becomes a record.

**What it costs.** Low in code, **zero in schema**. `player_stat` is already keyed
`(record_id, season, stat_key, source_experience_id)` with `provenance`; the row's
`created_at` and the squad are already on the page. `StatTile` becomes a
`<details name="stat">` — the native exclusive accordion, no JavaScript, one open at a
time, still correct with the bundle stalled. The real cost is one rule, not one day:
**everything the well reveals comes back through the single tokenised read path (D-80)**,
not a second route and not a client fetch. An hour on day one, a rewrite later.

**What I deliberately did not do.**
- **No modal.** A modal over a child's CV is a second render of the most dangerous surface
  in the product. It pushes, it never overlays.
- **No third level.** Past two, people get lost. Apple Health runs four and survives it
  because people live in Health; nobody lives in a CV.
- **No change to the closed state.** Collapsed, the row is pixel-identical to what ships.
- **No read count, no "viewed 12 times", no comparison to another player.** The mechanic
  rewards attention to a number already on the page, once, and then closes.
- **I did not answer the permission question.** At level two, does a stranger holding the
  link see the coach's *name*? The mockup draws the restrictive answer — link-holders get
  "a coach at Riverside FC", verified clubs get the name — because CLAUDE.md says choose
  the more restrictive option and say what you chose. **It is a doc 14 question and it is
  BUZ's.**

---

## 2 · `plan-and-billing.html` — the money screen, set properly

**Mockup:** `docs/design/mockups/plan-and-billing.html` · 1440-evidence, 1280 and 390.
**Supersedes `club-billing.html` (23 Sep)**, which proposed the same content and was not
built. The new part is the setting, not the words.

**What it changes.** The price becomes a display numeral because it is the fact the page
exists for; the charge date sits beside it at the same rank; the four things a treasurer
has to quote to a committee — statement descriptor, receipt address, who it is addressed
to, who agreed and when (D-137 already captures all of it) — move into a sunken well,
because you read them rather than act on them. Exactly one thing on the screen is green:
the only button. The page moves to the console width D-147 already grants it
(`ClubBilling` is on the console list) instead of rendering as a 604px reading column at
82% empty.

**And the bug.** `app/club/billing/page.tsx:68` writes `className="field-label"`, and the
only rule for that class is `.field > .field-label` at `globals.css:307` — a direct-child
selector. The div is inside a `card`, not a `.field`. **The rule never matches**, which is
exactly why the price is three pixels larger than its own label. The same defect appears on
`/club/post-trial` (8×), `/club/invite` (2×) and `/register-interest` (4×) — **19 captions
across four files**, this page's five included. `/club/roles`, `/club/squads`,
`/club/page-edit`, `/join` and `/squad` use the class correctly inside a real `.field`,
which is what makes it easy to miss. Changing the selector to `.field-label` fixes all
nineteen in one line.

**What it costs.** Half a day plus that line. Everything on the proposed page is already
on the row except **What you have paid**, which needs an `invoice.paid` webhook writing
a row — charges are not stored today, only subscription state. Ship without it.

**What I deliberately did not do.** Not the price, not the plans, not one word of the
D-136 disclosure or the D-137 tick, not the checkout form, not where cancelling lives. No
new copy except four strings, all marked. And **no upsell of any kind** on a page a
volunteer treasurer opens once a year.

---

## 3 · `the-return.html` — a family coming back after sixty days

**Mockup:** `docs/design/mockups/the-return.html` · 1280 and 390.

**What it changes.** `/home` does not know how long you have been gone. A parent back after
eleven weeks gets the identical page to one who was here yesterday — and the first thing
they read is a queue of things waiting on *them*, the oldest marked "2 months ago". The
proposal puts a sunken `WHILE YOU WERE AWAY` block above that queue, rendered only when the
last session was more than ~60 days ago, carrying four dated facts:

- a named person at a named club opened the CV, on a date — from the read ledger;
- the share link's expiry date, and what happens on it — D-53, already rendered elsewhere
  on this page;
- **nobody outside the child's own club asked to reach them** — from the consent spine;
- the trial window, as a date.

Count the verbs aimed at the reader. There are none. Two of the four facts are the absence
of something happening, which is what a parent most wants and what no engagement-shaped
product would ever print.

**What it costs.** **The cheapest real thing in this set.** One comparison and four queries
the product already runs somewhere. No new table, no new permission, no new screen.

**What I deliberately did not do.**
- **It renders on arrival and is never pushed.** The moment it is an email or an SMS it is
  a re-engagement prompt — banned outright over a minor (D-65/D-81), and a marketing send
  to a guardian, which launch does not have.
- **Nothing on the player's home.** A fourteen-year-old returning after the off-season gets
  no ledger of who looked at him, because that is precisely the mechanic that would make
  him check. The read ledger stays where doc 34 already puts it.
- **No count of reads.** A number that only goes up is a score, and a quiet month then
  reads as a bad month.
- No streak, no completeness percentage, no "you haven't updated in six months", no grid,
  no badge.
- **A gap I found rather than filled:** there is no guardian in `lib/fixtures.ts`. The one
  seat holding every consent decision in the product has no house fixture, so the parent's
  own name in that mockup is marked as a suggestion. That is worth fixing before it is
  worth drawing.

---

## 4 · `register-834.html` — the console on an iPad in portrait

**Mockup:** `docs/design/mockups/register-834.html` · 834 now, 1024 with the 7px drawn,
834 proposed, 390 unchanged.

**What it changes.** Two failures with one cause.

*The cliff.* `globals.css:195` and `:533` put the console behind `min-width: 1024px`. An
iPad Pro 12.9" in portrait is exactly 1024, so it lands on the first pixel of a design that
assumes more room: `/club/register` reports `overflowPx: 7` at 1024 and `0` at 1280, and
the named offenders are `DIV.console-row console-head` and every `console-row` under it. A
fixed 232px sidebar plus five hard column minimums does not fit, and a grid with hard
minimums does not fold — it spills.

*The expensive one.* 768, 810, 820 and 834 all fall **below** the breakpoint, so the paid
surface renders as stacked cards. **At 820 the register is 17,347px tall. The same register
at 1280 is 9,645px.** A technical director working a hundred families on an iPad reads one
clipped card at a time.

The proposal separates two things D-147 says in one breath — *sidebar instead of tab bar*
and *table instead of cards*. They do not need the same breakpoint. Below 1024 the club
seat already carries the phone tab bar, so navigation is solved at 834 without a sidebar,
which frees the whole width for the table. Table from 768; sidebar still at 1024. The row's
column minimums come down from 744px to 690px in the same pass, which is what repairs the
1024 overflow.

**What it costs.** Very low: two media queries and five numbers in one
`grid-template-columns`. The cost that is real is verification — six console screens × five
widths to re-photograph, which the device seat's harness already does.

**This is a change to D-147, so it is a decision, not a fix.** *What it buys:* the paying
seat becomes usable on the device club officials actually own, and the 7px goes away. *What
it costs:* one more layout to check per console screen, and the "640–1023 caps at 560px"
line now has a written exception or someone will helpfully undo it. *What it does not
cost:* a forked system — it is still two desktop layouts, one of which starts earlier.

**What I deliberately did not do.** No search box, even though the register has zero text
inputs and two children called Dara in the same age group three rows apart. No sort. No
club-side note field. No fix for "back from a CV returns to scroll position 0", which is
the most expensive defect on that screen and is a routing problem, not a layout one. All
four are real and all four are in the journeys report. **None of them belongs smuggled into
a breakpoint change**, least of all a new text input on a surface full of children.

---

## 5 · `surface-stack.html` — the ladder, with the figures under it

**Mockup:** `docs/design/mockups/surface-stack.html` · both ladders side by side, then the
same real screen drawn on each at 1280 and at 390.

**What it changes.** Four values, and the page colour is not one of them.

| Token | Now | Proposed | Step |
|---|---|---|---|
| `--bg` | `#0b120e` | **unchanged** | the page |
| `--surface-sunken` | `#0e1712` | **`#152019`** | 1.13 above the page |
| `--surface` | `#121b16` | **`#1e2a23`** | 1.13 above sunken · **1.27 above the page** |
| `--surface-2` | `#1a2420` | **`#23342b`** | 1.13 above the card |
| `--line` | `#24322a` | **`#2f4638`** | 1.46 above the card |

Today a card sits on the page at **1.079 : 1** and a sunken well sits inside a card at
**1.038 : 1**. Carbon's published dark ladder steps are 1.20 and 1.31; this proposal sits
between them. With it comes the rule that is worth more than the numbers: **depth into the
record goes down, action goes up — every level of disclosure renders sunken inside its
parent.** That rule is what makes mockup 1 read as *inside* the stat block with no shadow
at all, which is why this file is last in the set and first in dependency order.

**Three consequences, stated because they are the cost.**

1. **`--muted` must move too.** Lifting the card drops `#7d8f85` from 5.14 to **4.35 : 1**
   on it — below AA for small text. `#8a9d92` restores it (5.19 on the card, 4.58 on
   `--surface-2`). Not optional.
2. **`body` and `--bg` must be reconciled** (`globals.css:6` is `#070b09`, which is not
   `--bg`). One line; removes a phantom sixth level nobody decided on.
3. **`--hero` will then sit below the cards and look wrong.** Its middle stop is 1.09
   against the page; the new card is 1.27. A hero darker than the cards on it inverts the
   stack. **The gradient is named in the charter, so I have not touched it — but this
   change forces the question, and it is BUZ's to answer.**

**What I deliberately did not do.** No new level — still five, same names. **No shadow
anywhere**: hairline plus a real surface step is the elevation. No change to accent, amber,
purple, red, the type scale, the letter-spacings, the radii, the button heights or the 44px
floor. And no light mode.

**The honest limit.** Moving the tokens only changes screens that use the tokens, and
adoption is roughly one in eight; `scripts/palette-check.mjs` asserts `lib/palette.ts` and
`:root` are identical, so both move in the same commit or CI fails. The second half of the
job — components off inline hexes and onto `var(--token)` — is worth doing whether or not
the values ever change.

---

## What I did not build, and why

**The club administrator's home.** BUZ's list asked for it fifth; I have not drawn it, and
that is a judgement I want on the record rather than buried. **It is already drawn:**
`docs/design/mockups/club-home-admin.html`, 23 September, proposing exactly the fix the
critic's report describes — the rail stops repeating the sidebar word for word, the hero
carries the three numbers an administrator is entitled to (squads, live notices, open
roles, none of which touches a registration), and the screen gets one primary action. I
checked `app/home/page.tsx:344–365` today: **it has not been built.** A second drawing of
an unbuilt proposal is noise, and two mockups of one screen a day apart make a decision
harder rather than easier. The answer is the same as yesterday's: build the one that exists.

**Three mechanics I would not build at all**, each of which I caught myself reaching for
while drawing this set:

1. **A read counter on the returning family's block** — "your CV has been read 7 times".
   It reads as a score, it only goes up, and a quiet month becomes a bad month over a
   fourteen-year-old's page.
2. **A `WHAT'S ON` seasonality block on `/home`.** The research seat is right that the
   football calendar is the real rhythm, but the block is only honest if someone owns a
   weekly check, and an out-of-date "trials are on now" is worse than no block. Low code
   cost, standing human cost. **Not until someone's name is on it.**
3. **A search box on the register**, in this pass. The register needs one badly. It is
   still a new text input on a list of children, and it needs its own decision with its own
   rate-limit and audit questions answered — not a free ride on a CSS change.

---

## What needs BUZ, by name

Nothing in these files changes a rule that is his. Four things wait on him:

1. **D-147** — does the console table start at 768 instead of 1024? (mockup 4; cost and
   benefit written out above and in the file)
2. **The provenance permission line** — at level two, does a stranger holding the link see
   the coach's name, or only the club? A doc 14 question. The mockup draws the restrictive
   answer. (mockup 1)
3. **`--hero`** — the charter names the gradient, and the new ladder puts the hero below
   the cards. Re-pitch it in the same pass, or hold the whole ladder. (mockup 5)
4. **Copy.** Every string in every mockup that a user would read and that is not already in
   the product is marked with a dotted underline, and each file says so at the top.
   Nothing underlined is approved. I have not written product copy.

---

## Housekeeping

- Mockups: `provenance-drill.html`, `plan-and-billing.html`, `the-return.html`,
  `register-834.html`, `surface-stack.html`, plus `_tokens.css` (a reference copy of the
  token block, not loaded by anything — each file inlines its own so it opens from disk).
- All content is the house fixtures (`lib/fixtures.ts`) and the demo seed's own register
  lines (`scripts/demo-layer.mts`). No lorem. No real child.
- Read-only on product code. Disk checked before and after: 12Gi free, unchanged.
