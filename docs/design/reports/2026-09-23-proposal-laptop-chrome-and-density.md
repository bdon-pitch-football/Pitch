# Proposal — the chrome, the worst screens, the console density, and the CV

**Seat:** design, proposal · **Date:** 23 Sep 2026 · **For:** Leo, then BUZ
**Question from BUZ (23 Sep):** on a laptop or a tablet does the background look very
empty? Is the app up to scratch? Can we make it look better? He named LinkedIn.

**Read first:** `2026-09-23-audit-laptop-and-tablet.md` (our own screens, measured) and
`2026-09-23-benchmark-linkedin-and-peers.md` (what others do). The research report on
profile pages and dark UI tokens did not exist when I started, so no number in this
proposal is borrowed from it; everything measured here is measured off our own captures
or read out of our own code.

**Nothing in this proposal changes product code.** Seven standalone HTML mockups in
`docs/design/mockups/`, real tokens, real seed content, 1280 and 390 in the same file.
232KB for all seven — hand-written, no images, no fonts, no libraries.

---

## The answer in one paragraph

The three seats agree, independently. **The 640px reading column is not the problem and
we are not copying LinkedIn's profile rail** — LinkedIn's own logged-out profile is a
single column, and the rail on its members' view holds "People Also Viewed", which under
a fourteen-year-old's CV is a recommender over children and a pillar-zero breach. The
emptiness BUZ is seeing is **vertical, below the fold**, and it has one cause repeated
across every thin screen in the product:

> **Every empty screen we have shows what you can *do* and never what is *the case*.**
> Billing shows a price and no history. The report desk shows an empty queue and no
> evidence of work. A club administrator's home shows six doors and no state. The jobs
> board shows three numbers and no context. Squads shows names and hides the counts in a
> grey sentence.

So the one idea running through all seven mockups is: **state, not furniture.** Fill the
space below the fold and beside the column with facts about this person's or this club's
data — what is live, who read it, what expires, what is waiting, what was paid — in the
surface that already means *read this* (`.card-sunken`), and never with more buttons.
Where there is genuinely nothing to say, say that, with a date on it.

Underneath that sits the cheaper half of the answer, and it is the half a technical
director actually notices in ten seconds: **the chrome is inconsistent in four ways, and
three of them are bugs rather than design decisions.** That is mockup 1 and it is what I
would build first.

---

## What I would build, in value-for-effort order

| # | Mockup | Screens it changes | Effort | Verdict |
|---|---|---|---|---|
| 1 | `chrome.html` | all 86 | hours | **build first** |
| 2 | `player-cv.html` (moves 2 and 3) | `/p/<token>`, `/c/<slug>` | half a day | build second |
| 3 | `empty-states.html` | `/jobs`, brand-new `/home` | half a day | build third |
| 4 | `club-billing.html` | `/club/billing` | ~1 day | build |
| 5 | `club-squads.html` | `/club/squads`, `/club/squads/<id>` | ~1 day | build |
| 6 | `club-home-admin.html` | club-admin `/home` | ~1 day | build |
| 7 | `ops-reports.html` | `/ops/reports` | half a day | build last |
| — | `player-cv.html` move 1 (sticky strip) | `/p/`, `/c/` | ~1 day | build, after 1–7 |

**Not at all:** a rail on the public CV · a CV preview drawer inside the register ·
the billing charge history *for launch*. Reasons at the end.

---

## 1 · `chrome.html` — the chrome, made consistent

**Build first.** It is the cheapest work in the round and it is the only item that
touches every screen in the product.

### What is wrong now

Four things, shown side by side in the mockup rather than listed:

**A. The Pitch mark lands in four horizontal positions at one window width** — right edge
at 892 (22 screens), 940 (28), 1056 (2), 1220 (15) — and on `/privacy` and `/terms`
(18 screens) it moves to the **top left**. BUZ's 24 Aug rule is "top right corner on
every screen, no exceptions". What is built is "top right of whatever container this page
happens to use". On a phone every container is the same width, so this is invisible at
390 and appears only on a laptop.

**B. Five button treatments where the charter allows two:** the correct 50px accent and
46px surface-2, plus a 56px "Open the CV" on the register, a 44px accent "I'm interested"
on `/trials`, and a ~42px **accent-outlined** "Ask them" on `/club/squads/<id>`. The
outline is the one that reads wrong — a fourth visual language for "this is an action",
on exactly one screen. Plus a 900px-wide accent "Add it" on `/club/squads`: the charter
fixes button height and radius and is silent on width, and silence is how a token set
forks.

**C. Two form languages one sidebar click apart — and it is a CSS scope bug, not a second
design.** `globals.css:307` scopes the label to `.field > .field-label`.
`/club/post-trial` and `/club/billing` put `className="field-label"` inside a `card`
inline style, not a `.field`, so **the rule never matches** and thirteen field labels
inherit 16px body ink. They are not styled differently; they are not styled at all.

**D. Three desktop layouts where D-147 declares two.** Reading (640 centred), console wide
(232 + 932), and an undeclared third — 232 + ~594 + a 320px rail — on player, coach and
club `/home` and `/ops/reports`.

### What the change does

One header rail, max 1200px, centred, 18px padding: the mark's right edge is **1222px at
1280, on every screen**, the exit sits on the left of the same row, and a console screen's
club identity moves into it (which gives the sidebar 60px of its height back). One
unscoped `.field-label` selector fixes all thirteen fields. The button set becomes four
declared roles with no accent outline anywhere and a 360px cap on a primary above 1024px.
And the third layout gets named with a rule that stops it spreading (below).

### What it costs

Hours. The wordmark fix is hoisting one component out of each page's column into the
frame. The label fix is one selector plus wrapping two forms. The button fix is deleting
one style and capping one width.

### What it does NOT change

Nothing on any screen, in any order, in any words. Every one of these is the container
(D-147). At 390 all four defects are invisible today and stay invisible after — they exist
only because a laptop has room for containers of different widths.

---

## 2 · `player-cv.html` — a better single column on the page that matters most

Two of the four moves are half a day and give the largest visual return in the product;
the third is a background; the fourth is a day and can wait.

### What is wrong now

61% empty at 1280, and every weak part is **inside** the column. The highlight façades are
604 × 96 rectangles with a play button in the middle of nothing — that is where most of
the "empty" reading on this page comes from. The sides are bare background, so the page
reads unfinished rather than framed. The squad-number watermark is clipped mid-glyph by
the card edge and collides with the position map. The stat tiles arrive on a staggered
entrance (0.28s + 0.09s each) and **count up from zero**, so every tile reads "0" for the
first frames — on a CV built around never showing one — and at 820 they form a descending
staircase. On 4G at a ground, the staircase is what a club sees first. There is no fixed
frame: once the hero scrolls away, nothing says whose page this is.

### What the change does

- **Façades that fill their card** (half a day, pure CSS): our hero gradient, the pitch
  mark at low opacity, the title at 15px/800 and its line at 12.5px/500 in the card rather
  than in a strip beneath it, and the honest label *"YouTube · nothing loads until you
  press play"* — which turns D-97's privacy control into something the reader can see us
  doing.
- **The sides become the page** (an hour): the floodlight gradient continued and one very
  low-contrast pitch mark in each margin. **No information goes there, ever** — which is
  what makes it safe: nothing to reflow at 1023px, nothing to lose in print.
- **Two fixes that cost minutes:** clip the watermark to whole glyphs and move it off the
  map's corner; land the stat tiles together at their real values.
- **A sticky 56px identity strip** (a day, do it after the rest): initials, `Deniz Yılmaz ·
  AM · Riverside FC U15`, and the one action, on `--surface` over `--bg` with one hairline
  and no shadow. It prints away cleanly, which is why it is a strip and not a rail.

### What it does NOT change

Not one fact on the page, not one word, not the order of the sections, not the 640px
column. No rail. No "similar players", no view count, no follower count, no completeness
score — none of which may ever appear on a page about a child. The never-zero rule is
untouched and strengthened.

---

## 3 · `empty-states.html` — `/jobs` and a brand-new `/home`

Both 70% at 1280, empty for opposite reasons: `/jobs` is **short** (a real list with two
things in it), a brand-new `/home` is **first-use** (a real account with nothing on it).
Carbon's taxonomy, in our words: an empty screen must say **what will appear here, when,
and the one thing worth doing now.** No illustration — we have a pitch mark and a gradient.
No apology.

**`/jobs`:** group the board by when a role closes, and put on each row what a coach
actually decides on — club and verified state, locality, age group, commitment, paid or
volunteer, posted date, closing date. Two roles under two dated headers read as a board;
two cards under a bare title read as a stub. It is the same move that makes
`/club/register` our best screen: it groups by squad, so even a short register looks
organised. Cost: a sort and a header, over fields already on the row.

**Brand-new `/home`:** the three doors get a sentence each, and the fold gets filled with
what is true about the account right now — Australia, nothing about an under-16 exists
until a parent approves, one tap deletes everything. And the dead line gets a route: today
the screen ends *"tell us which you came for and we will point you at it"* **with nothing
to tell us with**. That is the single most fixable sentence in the product. Cost: markup
and copy; this branch runs when `children.length === 0` and makes no query at all.

**Does NOT change:** no new capability, no onboarding wizard, no role-picking step that
would fork signup, no change to the board's chronological order. **All new copy on both
screens goes past the copy check, including the D-85 banned-words pass.**

---

## 4 · `club-billing.html` — the emptiest screen, on the page attached to $54 a month

80% at 1280, 74% at 820 — the worst single screen in the product at either width. Four
elements finished by y=330 with 470px below and 386px beside, and it is a **named console
surface in D-147** (`ClubBilling`) rendering as a 604px reading column. It shows the price
and nothing else: no next charge, no receipt address, no record of what was paid, and no
answer to the only question a treasurer asks a subscription page — *what is this buying
us?* It also carries a "< Back" above a page whose sidebar item is already highlighted.

The change moves it to the width it was already given and fills it with facts about this
club's money and this club's register: next charge, the statement descriptor
(**PITCH FOOTBALL** — the thing D-136 exists to stop a treasurer ringing the bank about),
who the receipt is addressed to, who agreed to it and when, and a rail holding what the
register has done since the last charge and **who reads it**. The cancel route stays
exactly where D-136 requires it.

**The permission detail is the good part.** An administrator reads no registration
(D-93, D-154), so for Robyn the rail renders without the numbers and says so in words:
*"The register is the technical director's. You keep the club's page, its squads, its
notices and this page — and you can pay for the register without being able to read it."*
A constraint spoken is better than a constraint discovered by clicking something and
getting nothing.

**Does NOT change:** not the price, not the plans, not one word of the D-136 disclosure or
the D-137 authority tick, not the checkout flow, not the unpaid form's content or order.

---

## 5 · `club-squads.html` — the width without the density

D-147: console surfaces get "tables not stacked cards". `/club/register` and
`/ops/verification` are real tables and are the two best screens we have. `/club/squads`
is eleven bordered cards at ~105px — 1,150px of scroll for eleven rows — and
`/club/squads/<id>` is the same with ~700px of each 932px row empty. Worse: **the "Add a
squad" form sits above the list**, so a TD running eleven squads scrolls past a creation
form every single time; and "In use — can't be removed" wraps to two lines on a different
baseline, so no two rows end in the same place.

The change is the register's own treatment: group headers by stage with counts, sticky
column head, hairline rows, and the counts the page already queries — **registered** and
**playing** — as their own right-aligned numeric columns. The creation form stays first in
the order (D-147: the artboard decides order) but collapses behind a 44px "Add a squad"
chip — the same `<details>` disclosure the trials board already ships — 44px instead of
~330px, **at both widths**. The detail page becomes a squad sheet: player, positions in
pick order, clips, this season's surfaced stats, one action column, and "Ask them" as the
console primary, which is how the accent-outlined button leaves the product.

Cost is low and it has a precedent: `.console-row`, `.console-head`, `.console-row-hover`
and the `.d-only` / `.m-only` pair all ship today on `/club/register`, and below 1024px the
squads stay as cards exactly as the register's rows already do.

**Does NOT change:** no squad data, no new field, no new query, no change of order. Row
height stays 52px with a 44px target inside it — we do not shrink a row to fit more
children on a screen. And the never-zero instinct holds: a squad nobody has registered for
shows a dash, not a nought.

---

## 6 · `club-home-admin.html` — the worst first-run impression we have

63% at 1280, and a club administrator is very often the first person at a club to open
Pitch. Two failures, both from rendering one screen for two people. **The gradient hero was
built for the technical director** and carries her 100 / 80 / 10 / 10 register row; an
administrator has no register access, so the same card renders three lines and ~50px of
blank and reads as a card that failed to load. **And the right rail is six identical
secondary buttons with no primary** — which is the sidebar immediately to its left, word
for word. There is no accent on the screen at all, so the eye has nowhere to land.

The change gives the hero the three numbers she *is* entitled to — squads, live trial
notices, open coaching roles, none of which touches a registration — one accent primary
("Post a trial notice"), a "Coming up" block with dates and how long each notice has been
on the board, a two-item "what a family cannot see yet" list (**two things, not a score** —
a completeness percentage on a club page is the LinkedIn habit we are not copying), and a
rail holding the club page's URL, when it was last changed, and **who can do what here**.

That last block is the one I would fight for. It is the only place in the product where
the D-93 role split is said out loud to the person it constrains.

**Does NOT change:** no registration count, no child's name, no held-registration detail
reaches this screen. Not the TD's version of this page. Not the sidebar.

---

## 7 · `ops-reports.html` — the heavy column is the narrow one

72% at 1280. The 594px main column holds one card reading "No open reports." and 600px of
nothing; the 320px rail carries three sections of dense copy, a held-accounts panel, a
search field and the 1800RESPECT guidance, ending in a court-order field. The page's whole
weight is in its margin, and it breaks the rail rule the rest of this proposal asks for: a
rail holds **state you read**; this one holds **tools you work**.

The change inverts it. The queue becomes the page, at `/ops/verification`'s density, with
the invariant above the data as that screen does it. "One parent's access" moves into the
main column as what it is — deliberate, slow, separate work. The rail holds the two things
that are genuinely standing state: what is hidden right now, and who is held at signup.

**The empty state is the half that matters most,** because this desk is empty most days.
Today it says "No open reports." and looks broken. **An empty queue should be evidence, not
absence:** nothing open, *seven closed in thirty days*, *longest wait four hours*, *the
last one closed 19 Sep at 8:21pm*. That is the screen that answers a regulator, and it
costs one `count(*)`.

I have put it last on value-for-effort only because the audience is us. On the day it
matters it is the most important screen in the company.

**Does NOT change:** nothing about what an operator can do or to whom. D-79 holds
untouched. No copy is softened — 1800RESPECT, "suppress first", and the court-order
requirement are quoted verbatim from the page as built.

---

## Decisions for BUZ

These are the places where the work needs a rule I am not allowed to write. Each is
**what it buys / what it costs**.

**D-c1 · The button set: ratify four, or cut back to two.**
The charter says two and no third. The code already ships four — `.btn-primary` (50px),
`.btn-secondary` (46px), `.btn-ghost` (44px) and `.console-btn` / `.console-btn-primary`
(44px) — and `globals.css` flags both extras as deliberate stretches awaiting a D-number.
The ghost exists because "Not now" and "Back" were bare links with no 44px hit area, which
is an accessibility requirement; the console pair exists because a table row at 50px is
not a table.
*Buys:* the accent-outlined button and the 56px and 44px one-offs become obviously wrong
and get deleted, and the next person adds nothing.
*Costs:* the charter sentence "there is no third button" stops being literally true; it
becomes "there are four roles and no fifth". **Plus one line:** a primary button is at most
360px wide above 1024px, full width below.

**D-c2 · Where "top right" is measured from.**
Option A (drawn in the mockup): the **page frame's** right edge — one x on every screen,
1222px at 1280. Option B: the **content column's** right edge — which is what is built and
which yields four different x values because our containers are different widths.
*A buys:* the rule as literally written, and the mark stops moving as you navigate.
*A costs:* on a 640px reading page the mark sits ~280px from the column, which is further
from the content than it is today.
*Either way:* `/privacy` and `/terms` currently put it top **left** and have no Night Match
backdrop at all — that is a straight bug on 18 screens and should be fixed under whichever
option BUZ picks.

**D-c3 · The third desktop layout: name it, or fold it in.**
D-147 says two, and three are built. The third is also genuinely our best screen — player
`/home`'s "Who has read your registrations". I do not recommend deleting it. The rule I
would write, drawn in `chrome.html`:
> A console surface may carry a 320px right rail, and the rail may hold **only** a block
> that states what has happened to this person's or this club's data. Never navigation the
> sidebar already holds, never a suggestion. **The test:** if the block would be a lie
> tomorrow because nobody did anything, it belongs in the rail; if it would say the same
> thing forever, it is furniture. **The parity rule:** a rail may only hold a block that
> also exists on the 390px artboard.
*Buys:* the dashboards stop being a fourth design by accident; club `/home`'s six duplicated
buttons fail the test and `/ops/reports` fails it backwards, which is most of mockups 6
and 7 decided for free.
*Costs:* three desktop layouts to hold in your head instead of two.
**Related and separate:** `components/player-shell.tsx` records "D-147, amended 16 Sep" —
the console frame now wraps player and parent `/home`, which are not on D-147's console
list. If that amendment was verbal it needs its own number, because "every screen is a
reading surface unless it is on the console list" is the sentence holding us to two.

**D-c4 · The console breakpoint: 1024 or 834?**
D-147 names 1024. **Every iPad except the 12.9" is below that line in portrait** — an
iPad 10th gen is 820 CSS px, an Air/Pro 11" is 834 — so a technical director who opens the
Interest Register on an ordinary iPad held upright gets a stack of phone cards in a 560px
column with ~135px of dead gutter either side and no sidebar. Turn it sideways and he gets
the full console. This is the direct answer to the tablet half of BUZ's question.
*Buys (moving to 834):* the device a TD actually holds at a club meeting gets the console.
*Costs:* one media-query boundary and one `minmax` on `.console-row`; it changes which
devices get which of the two desktop layouts, and 1024 is a number inside a locked
decision. **Separately and needing no decision:** the middle band caps reading at 560 while
1024+ caps at 640, and `globals.css` already calls the 560 cap on desktop "the design
system forking by omission". The same sentence runs backwards — raise the middle band to
640 and a tablet and a laptop read the same column.

**D-c5 · The palette additions.**
`lib/palette.ts` and `globals.css` carry `--amber`, `--purple`, `--red` and a third surface
level `--surface-sunken` that the Design section of `CLAUDE.md` does not list. They are
used coherently (NEW green / SHORTLISTED amber / INVITED purple; sunken = read this) and
this proposal leans on the sunken surface throughout.
*Buys:* ratifying them as **status-pill-only hues plus one sunken surface** makes the
rule enforceable and stops a fourth hue arriving.
*Costs:* the charter's "one accent" line needs two lines of amendment. **And one rule I
would add with it:** never a status hue at display size. The register renders 100 in ink,
80 in accent, 10 in amber and 10 in purple at ~48px/900, and the person who pays us is
reading a traffic light.

**D-c6 · Billing charge history.**
The mockup shows three paid charges with receipt links. We store subscription state only,
so this needs an `invoice.paid` webhook writing a row.
*Buys:* a treasurer can produce a receipt without emailing us.
*Costs:* a webhook, a table and a migration. **I would ship the page without it** and add
it the first time a club asks.

**D-c7 · Print scope.**
The benchmark found that LinkedIn could not make a two-column profile print and shipped a
separate résumé renderer instead. Our fast-follow should **render a one-column document**,
not print the page.
*Buys:* a TD printing CVs for trial day gets an artefact instead of a broken page.
*Costs:* slightly more than a print stylesheet, and materially better.

---

## What I would not build at all

**A rail on the public CV.** Once the engagement furniture is removed there is nothing
LinkedIn's profile rail holds that we are allowed to put back — "similar profiles" under a
fourteen-year-old is a recommender over children (pillar zero §4, D-21). And a rail forces
a decision about which blocks move sideways, which must then reflow at 1023px in an order
the 390px artboard never specified. That is exactly the fork D-147's four constraints were
written to prevent. The answer for a reading surface is a better single column, which is
mockup 2.

**A CV preview drawer inside the register.** The benchmark describes Attio's peek/drawer
and it is genuinely the nicest pattern in that field. Our detail is a child's CV with its
own permissions, its own tokenised read path, its own OG card and its own print behaviour,
and D-80 allows **exactly one** server-side read path. Re-rendering it in a panel means a
second implementation of the most dangerous surface in the product, to win a scroll.
Nobody should be tempted into that. If the scroll is worth fixing, fix the *return* —
scroll and filter restoration — not the render.

**The billing charge history, for launch.** See D-c6. Defer, not never.

---

## The mockups

All in `docs/design/mockups/`. Each carries its own case, its own "what it does not
change", and both widths in the same file.

| File | One line |
|---|---|
| `chrome.html` | The four chrome inconsistencies shown side by side, and one header rail that puts the mark at 1222px on every screen |
| `player-cv.html` | Deniz's CV with façades that fill their card, the sides treated as margin, and a 56px sticky identity strip — no rail |
| `empty-states.html` | `/jobs` grouped by closing date, and a brand-new `/home` whose dead sentence finally has a route |
| `club-billing.html` | The $54 page at console width, carrying the next charge, the descriptor, the receipt address and who reads the register |
| `club-squads.html` | Eleven squads as one table grouped by stage, the creation form collapsed to a 44px chip, and a squad sheet on the detail page |
| `club-home-admin.html` | A hero with the numbers an administrator is allowed, one primary, and a rail that says who can do what here |
| `ops-reports.html` | The queue becomes the page, and an empty queue reads as evidence rather than absence |

**Seed content only:** Riverside FC, Kingsway Rovers FC, Northern United SC, Deniz Yılmaz,
Nate Halloran, Georgia Whitcombe, Marina Petrovic, Sam Kaya, Robyn Callister — the house
fixtures in `lib/fixtures.ts`, all deliberately and checkably fictional. No real child
appears anywhere in this proposal, and no lorem.
