# Benchmark — LinkedIn and its better-built peers

**Seat:** design, benchmark · **Date:** 23 Sep 2026 · **For:** Leo, then BUZ
**Question from BUZ:** is the app up to scratch on a laptop and a tablet? He named LinkedIn.

**Method and its limits.** Public material only: pages that render to a logged-out
visitor, published design-system documentation, and writing by the teams
themselves. I signed in to nothing. Where a product's behaviour is only visible
behind a login I say so and mark it as *reported, not seen* — that matters most
for LinkedIn, whose desktop shell is a members-only artefact. No screenshots of
other products are in this repo; everything below is described in words.

I read the Night Match charter and the Responsive section of `CLAUDE.md` first,
then measured our own shipped screens in `docs/design/screens/` at 1280 before
looking at anyone else's. `docs/design/reports/` was empty when I started, so
nothing here is downstream of the audit seat — where we agree, we agree
independently.

**One warning for whoever draws the mockups.** Width and row height are the
least-published numbers in this field. Atlassian and Shopify publish concrete
figures; Linear, Attio, Intercom, Ashby, Greenhouse and Stripe publish behaviour
and rationale and no pixel specs at all. Every "Linear uses 36px rows" figure in
circulation is somebody's measurement of a screenshot. I have not quoted one and
the proposal seat should not either — our own scale is D-140's and it does not
change at any breakpoint.

**Coverage.** LinkedIn and the work-surface products are covered properly.
Profile-as-product pages and dark interfaces at large widths are only partly
covered — see §7 for exactly what is missing and why it does not change a
verdict.

---

## 0 · The answer to the question you actually asked

> *Is a two-column reading surface — content plus a narrow contextual rail — the
> right answer for our 640px pages on a laptop, or is the right answer to make
> the single column better?*

**Make the single column better. Do not add a rail to a reading surface.**
Add rails only to the console frame, where one already exists, and only when the
rail holds *accountability* — who read this, what is live, what expires — never
suggestions.

Four reasons, in the order I'd defend them.

**1. LinkedIn's own public profile is a single column.** This is checkable
without an account. `linkedin.com/in/<person>` rendered to a logged-out visitor
is one column: header, about, articles, activity, experience, education,
similar profiles, footer. The three-column shell BUZ is picturing is the
*members'* view. The version a stranger-with-a-link reads — which is exactly the
situation of our public CV — is a document in one column. When BUZ says
"LinkedIn," the page he means is already built the way ours is built.

**2. LinkedIn moved the substance *out* of its profile rail, and what stayed is
what we are forbidden to build.** The rail used to hold "See connections" and
"Contact info"; both were moved into the main column, which left "People Also
Viewed" more prominent — a discovery module whose stated benefit is making a
profile "more discoverable"
([Mortimer, LinkedIn](https://www.linkedin.com/pulse/updates-your-linkedin-profile-layout-kerry-mortimer)).
Strip the engagement furniture from LinkedIn's profile rail and there is nothing
left in it. For us there is *less* than nothing: "players also viewed" under a
fourteen-year-old's CV is a recommender over minors and a pillar-zero breach
(D-21, pillar zero §4). The rail is not a neutral container we can fill with
something wholesome; on a profile page it is a shape that pulls recommendations
into itself.

**3. A rail is content, not container, and D-147 forbids that.** The 390px
artboards are the source of truth for content and order; desktop changes the
container. Any rail forces a decision about *which blocks move sideways*, and
that block must then reflow back into the single column at 1023px — where it
lands in an order the artboard never specified. Either it is duplicated (noise)
or demoted (a desktop/mobile content fork). This is exactly the failure mode
D-147's four constraints were written to prevent.

**4. Our emptiness is not a width problem.** The public CV at 1280 measures 62%
of the first screenful empty, but the void is at the *sides* of a well-made
604px column, and a reading column surrounded by dark field is what a document
is supposed to look like. The weak parts are inside the column: the highlight
cards are 604×165 rectangles that are mostly nothing, and there is no fixed
frame — no identity, no action, nothing to orient against once you scroll. Those
are density and anchoring problems. A rail fixes neither, and it would hide both
behind an apparently busier page.

**Where a rail *is* right, and we already have the proof.** Look at
`1280-player-home.png`. Left nav, a main column, and a right rail headed
"Who has read your registrations" — Riverside FC, the named technical director,
when he opened the CV, when he saw it in the list, and a "Take off this register"
control. That rail holds the answer to the only question that player actually
has, and the answer would be below the fold in one column. It is the best
desktop screen in the product, and the reason it works is that it holds
*accountability*, which is our product, rather than *recommendations*, which is
LinkedIn's.

**And the one design system that publishes numbers agrees with D-147.** Atlassian
is the only public system I found with hard layout figures, and it splits
exactly where we split: **fixed-narrow, 864px including margins, for long-form
reading**, because long line lengths "impair readability"; **fixed-wide,
1296px including margins**, recommended by name for "dashboards, directories,
search results"; and fluid width reserved for boards and canvases
([Atlassian](https://atlassian.design/foundations/grid)). Our 640px reading
column and 1200px console are the same two buckets, drawn tighter. Shopify
reaches the same place from the other side — full-width pages are for "resource
index pages" with many columns, default width for everything else
([Shopify](https://shopify.dev/docs/apps/design/layout)). The reconcilable rule
is that **column count decides, not viewport**: cap the list when it has few
columns, go wide only when the columns genuinely need the room. Our register has
five columns. It is correctly capped.

So: **console surfaces may have a rail and should earn it. Reading surfaces get
a better single column.** That line already exists in D-147; it needs enforcing,
not moving. If BUZ wants an outside opinion on whether 640 is too narrow, the
honest answer is that the only published spec for a reading column is 864px
*including margins*, and we are inside it.

---

## 1 · What our screens measure at 1280 (the evidence under everything below)

From `docs/design/screens/index.json` and the captures themselves. All 87
captures are 1280×800 first screenfuls; there is no 820 or 1440 set, which is
itself a gap — **nobody has measured the tablet BUZ asked about.**

| Screen | First screenful empty | Note |
|---|---|---|
| `/club/billing` (TD) | **80%** | three elements, ~500px of dead column below |
| `/jobs`, `/home` (brand-new) | 70% | a new account on a laptop is mostly background |
| `/signin` | 68% | |
| `/c/sam-kaya` (coach CV) | 63% | the best-looking page we have |
| `/p/dev-deniz` (public CV) | 62% | the acquisition engine |
| `/fc/riverside-fc` | 61% | |
| `/trials` | 59% | 300px of filters above 4 results |
| `/club/register` (TD) | 0% | fills the screenful; **9,645px tall** |

There is **no 820 set and no 1440 set**, so half of BUZ's question — the tablet —
has not been measured at all. Reading the breakpoints instead (P11) says an
ordinary iPad in portrait is below the 1024px console line and gets the phone
layout in a 560px column. That is very likely what he saw.

Five things I found that the rest of this report is built on:

- **`/club/register` is 9,645 pixels tall** — about twelve screenfuls — with no
  pagination and no in-page way back to the top. The filters *are* already
  sticky (`.console-filters`, `position: sticky; top: 0`) and the table head is
  sticky at `top: 92px`. Good instincts. But the filter card is ~290px tall and
  grows to ~330px once a filter is on, so when it sticks it permanently occupies
  a third of an 800px laptop viewport. Subtract the sticky head and the TD is
  working the register through a window about five rows deep.
- **The collapse already exists and is switched off at the width that needs
  it.** `app/trials/page.tsx:153` wraps the filters in
  `<details className="m-only trial-filters">`. `.m-only` is
  `display: none !important` above 1024px. So the phone gets a tidy "Filters"
  summary and the laptop gets the wall — backwards, because a phone scrolls
  past 300px happily and an 800px-tall laptop viewport cannot.
- **On `/trials` the filter block is 300px tall for 4 results**, and includes
  dead chips ("Men 0", "Women 0"). The controls outweigh what they control by
  about three to one.
- **The register's headline numerals use three hues at display size** — 100 in
  ink, 80 in accent, 10 in amber, 10 in purple. `--amber` and `--purple` are real
  tokens now (`globals.css:252–253`), added for status. At 11px inside a pill
  that is defensible. At ~48px/900 across the top of the screen the person who
  pays us is reading a traffic light, and the charter's single accent has
  quietly become three.
- **`/club/squads` renders a 900px-wide accent "Add it" button.** The charter
  fixes button height and radius and says nothing about width, so a phone
  button grew to fill a desktop card. That is the one place we broke
  "container, not content" in the *other* direction.

---

## 2 · LinkedIn, honestly

**The shell (reported, not seen).** Logged in, LinkedIn is three columns: a left
identity/shortcuts card, a centre feed, and a right rail of news and
suggestions, all inside a fixed maximum width so that past roughly 1200px the
columns stop growing and the page centres in whitespace. The 2016–2018 desktop
rebuild was stated as putting "conversations and content to the heart of the
platform"
([LinkedIn blog](https://www.linkedin.com/blog/member/product/linkedin-desktop-redesign-puts-conversations-and-content-at-the-center)),
which is an honest description: the rails exist to surround a feed, and the feed
is the business. **We have no feed and must never have one.** Two-thirds of the
argument for LinkedIn's shell does not apply to us.

**The profile page is a document.** Publicly verifiable: one column, sections in
a fixed order, dates right-aligned against role and organisation, an "about"
paragraph near the top, and a header of photo, name and one line. Our coach CV
(`/c/sam-kaya`) is already built this way and is the better page for it —
cover image, avatar overlapping it, philosophy, "Coaching now" as a highlighted
current row, then "Before that" as a dated list. That is the LinkedIn experience
list, done in our tokens, and it is craft worth keeping.

**What LinkedIn does badly and we should not inherit.**

- **The profile does not print.** Published guides note the browser print view
  "splits the profile awkwardly across multiple pages" and cuts sections. Rather
  than fix it, LinkedIn ships a *separate* Resume Builder template. That is the
  real lesson for our print-stylesheet fast-follow: a two-column page cannot
  become a one-column document cleanly, so don't print the page — render the
  document. (It is also a fifth argument against a rail on the CV.)
- **The logged-out list degrades to nothing.** LinkedIn's public jobs search is a
  single-column list with a collapsible left filter sidebar and a running count
  ("1,000+ … Jobs in Melbourne"), then an auth wall. The count and the left
  filter panel are worth taking; the wall is what a product does when the list
  is not the product.
- **Engagement metrics on a person.** Follower counts, reactions, "similar
  profiles." Every one of them is out for us on minors by pillar zero, and out
  on adults by D-03 — we are not a social network, including in the shapes we
  draw.

**Their own stated principle worth borrowing:** the 2021 refresh is described
as increased white space, removed divider lines and fewer icons
([Dowitcher](https://dowitcherdesigns.com/understanding-new-linkedin-layout/)).
Even LinkedIn's answer to density is to take things away.

---

## 3 · The patterns, ranked by what they'd do for Pitch

Each: the problem, how it looks in our tokens, which screen it changes, what it
costs, whether BUZ has to decide.

### P1 · A filter *summary* at desktop, not a filter wall — **ADAPT**

**Problem.** Controls outweigh results. On `/trials`, 300px of chips above four
listings. On `/club/register`, a 290–330px sticky block that eats a third of the
laptop viewport for the whole of a twelve-screenful scroll.

**How others solve it.** The field splits, and the split tells us which side to
take. Greenhouse keeps a **permanent** left-hand filter panel grouped into
expandable sections, and echoes what you chose back as removable tags at the top
of the results, the list adjusting as you go
([Greenhouse](https://support.greenhouse.io/hc/en-us/articles/360043184152-Candidate-and-prospect-filters)).
Linear **summons** the filter menu from a button (and the `F` key) and leaves
only the applied filters as a row in the view header
([Linear](https://linear.app/docs/filters)). Both keep the same two parts: the
*choosing* surface can be summoned; the *chosen* state is always visible.

A permanent filter rail is worth its space when the list is hundreds of rows
deep and the user lives there all day. **Ours mostly isn't.** A community club's
register is 20–100 families and our trials board today holds four notices, so we
should take Linear's side. Their stated principle is the argument in one line:
"Don't compete for attention you haven't earned"
([Linear](https://linear.app/now/behind-the-latest-design-refresh)).

**In our tokens — and we have already built most of it.** `app/trials/page.tsx`
holds the whole pattern: a `<details>` whose summary is a `Filters` chip with an
active count, and below it a row of removable applied-filter chips with the
result count and a `Clear` link. Both halves exist, at both widths. The only
thing wrong is which one shows: the `<details>` is `.m-only` and the open card
is `.d-only`. The code says why — *"At a laptop there is room, so the groups sit
open in a card instead"* — and that is the assumption I'd challenge. A laptop has
more room **across** and less room **down** than a phone, because a phone scroll
is cheap and an 800px viewport is not. The room the card is spending is the room
the list needs.

Keep the counted chips exactly as they are — `U13 · 17` is better than anyone
else's checkbox, because a TD reads the distribution of his own register off the
filter row, and that is real information. Change only when they're on screen:

- A closed state: one row, 44px tall — a `.chip` reading `Filters` with the
  active count, then the applied filters as removable chips, then
  `79 of 100 shown · Clear` (which we already render, but inside the card, so it
  has to lift out). One `.rule` hairline under it. That is the sticky element,
  ~60px instead of 330px.
- Open: today's card, unchanged, pushing the list down while it's open.
- Default open when nothing is chosen and the list is short; default closed once
  a filter is on or the list is longer than one screenful.

**This is not a reversal of the sticky decision — it is what makes it work.**
The comment on `.console-filters` says "scrolling ninety-nine rows should not
cost you the controls that narrowed them," and that is exactly right. The bug is
that a 330px sticky element costs you the rows instead. Sticky the summary,
scroll the card.

**Which screens.** `/trials` (both seats), `/club/register`, and any future
`ClubPeople` / held-queue list.

**Cost.** Small, and smaller than it looks. On `/trials` it is close to deleting
two class names: drop `.m-only` from the `<details>` and delete the `.d-only`
duplicate card, then let the `<details>` default to open when nothing is chosen.
The register needs its filter card wrapped the same way. Mobile parity improves
rather than degrades — the phone already has this and the laptop gains it. **No
content changes, no order changes**: strictly a container change, which is what
D-147 asks for.

**BUZ decision?** No. It contradicts nothing locked. It is arguably required by
D-147's "same content, same order."

**Also, separately — and this one is literally one line.** `/trials` already
omits filter groups that hold nothing: `agesHere` is the lookup narrowed to the
ages actually on the board, State renders only when `statesHere.length > 1`, and
Positions only when `posHere.length > 0`. That instinct is right and it is
already ours. Competition is the one group rendered straight from a `GENDERS`
constant, which is where `Men 0` and `Women 0` come from. Narrow it the same
way. A control that cannot change anything is furniture — the same rule as
D-70's never-zero stat tiles, omit rather than show a zero, applied to filters.

**And paginate.** Shopify's Polaris publishes a threshold: paginate above **50
items**, and support sorting and filtering whenever a list can be long
([Polaris index table](https://ownego.github.io/polaris-vue/components/IndexTable)).
Our register renders 100 rows into a 9,645px page. Our squad grouping means it
does not read as one undifferentiated run, which is most of the benefit — but
above roughly 50 rows the TD should be paging or the groups should collapse.
Collapsible group headers (Linear's are collapsible and grouping is a
first-class display option) are the cheaper of the two and fit our squads
exactly: `MiniRoos U9 · 10` collapses to one line.

---

### P2 · Open a row without losing the list — **ADAPT, and narrow it**

**Problem.** "Open the CV" on row 60 of a 9,645px register takes the TD to
another page. Coming back is a scroll, and he is doing this a hundred times in
one sitting during trial season. This is the single biggest thing standing
between our register and the tools this person already uses at work.

**How others solve it.** Two products converge on the same answer
independently. Linear has a **peek**: `Space` previews the focused row, their
docs comparing it to macOS Quick Look, and ↑/↓ move through adjacent issues
*while the preview updates*, so place is never lost
([Linear](https://linear.app/docs/peek)). Attio opens a resizable right-hand
drawer on row hover, **keeps the originating row highlighted**, and puts a
position counter in the drawer header — "1 of 500 in Entire Pipeline" — with
arrows moving to the previous and next record *in the current view's ordering*,
plus an expand control promoting the drawer to the full record page
([Attio](https://attio.com/help/reference/managing-your-data/records/create-and-view-records)).
Greenhouse's variant is the fallback when the detail needs the whole canvas: a
full-page profile with **prev/next arrows in the top-right**, links back to the
list top-left, and a header that **minimises on scroll** so the main panel gains
room while the actions stay reachable
([Greenhouse](https://support.greenhouse.io/hc/en-us/articles/11957068130971-Using-the-new-candidate-profile)).

**Where I would *not* follow them.** Our detail is a child's CV, and it is a
page with its own permissions, its own tokenised read path, its own OG card and
its own print behaviour. Re-rendering it inside a panel means a second
implementation of the most dangerous surface in the product (D-80: *exactly one*
server-side read path). Nobody should be tempted into that to win a scroll.

**The narrow version I'd actually build — Greenhouse's shape, not Attio's.**
Keep "Open the CV" as a real navigation to the real page — one implementation,
one read path — and fix the *return*:

- The register remembers scroll position and filter state on return.
- The CV page, when opened from a register, carries a back affordance that says
  where it goes (`‹ Back to the register · U15 Boys`), a position counter in
  Attio's phrasing (`3 of 17 in U15 Boys`, which reads just as well at
  `2 of 3`), and previous/next arrows through the *current filtered* list — so
  the TD works a squad without returning to the list at all.
- The CV's own header minimises on scroll rather than vanishing, which is P5's
  sticky identity strip doing double duty.

**Cost.** Moderate: a cursor in the URL, scroll restoration, and a variant of
the CV header. **Mobile parity:** the same prev/next appears on a phone — the
same capability at both widths, so D-147 constraint 3 is satisfied. It must be
built as a container feature: it changes nothing on the CV itself.

**BUZ decision?** **Yes, one.** Prev/next through a filtered register means the
TD moves between children's CVs without an intervening list — a small increase
in how fluently a club can browse minors. I believe it is the right trade
(everyone in that list put themselves there, through a parent, and the club is
verified — D-126), but it is a pillar-zero-adjacent change of *feel* and BUZ
should say yes out loud. It also wants a line in the audit log if opening a CV
from the register is logged today.

---

### P3 · The rail that holds accountability — **ADOPT, and extend it**

**Problem.** Console screens have ~370px of dead column to the right of a
605px content column. `/club/billing` is 80% empty. Filling that with navigation
we already have is what `/club/home` does today: its right-hand column of seven
buttons is the same seven links as the left sidebar, word for word. A rail that
repeats the nav is how a two-column layout makes a page *worse*.

**The pattern, from our own product.** `/home` for the player seat fills the same
space with "Who has read your registrations": per-club, the named person, what
they opened, when, and a control to withdraw. Nothing there is a suggestion;
every line is a fact about what happened to this person's data.

**Where to extend it.**

- **`/g/controls/<child>`** — the guardian screen. Today it is a single column
  and the "Who has read Deniz's registrations" block is below the fold at 1280.
  That is the thing a parent came for. Rail it.
- **`/home` for the parent seat** — 2,110px tall, a 605px column of
  "Waiting on you" cards and a 370px void. The rail should hold the children
  themselves: each child, whether their page is live or paused, and when their
  link expires. That is the standing state a parent checks; the column is the
  queue of things to do. State in the rail, work in the column.
- **`/club/home`** — replace the duplicated nav column with what a TD arriving
  on a Monday needs: what changed since he last looked, held registrations
  awaiting verification, trials closing this week.
- **`/club/billing`** — plan, next charge, the statement descriptor, and the
  cancel route (D-136 requires that route be reachable from club settings) sit
  fine in one column; the rail should hold nothing rather than something. An
  honest empty half-screen beats furniture.

**In our tokens.** `.console-frame` becomes
`232px minmax(0,1fr) 320px` on the screens that have rail content, and the rail
is `.card-sunken` — "sunken = read this" is already our rule and it is exactly
right for a rail. Section label in the 11px/800/0.14em kicker. No accent except
on a control.

**Cost.** Low; the grid exists. **Mobile parity:** the rail's content must be a
block that stacks under the main column below 1024px, in the order the artboard
gives it — which is how player `/home` already does it. **Strict rule:** a rail
may only ever hold a block that also exists on the phone. If it doesn't exist on
the phone, it isn't allowed on the laptop.

**BUZ decision?** No for the console screens — D-147 already grants a sidebar
and a 1200px frame there. **But flag:** `/home` for player and parent seats now
renders with the console frame, and those screens are not on D-147's console
list. `components/player-shell.tsx` records this as "D-147, amended 16 Sep." If
that amendment was made verbally it should go into the register as a numbered
decision, because "every screen is a reading surface unless it is on the console
list" is now false and the list is the only thing keeping this at two desktop
designs.

---

### P4 · One accent, and never at display size — **ADAPT**

**Problem.** Four colours of large numeral across the top of the register and TD
home. The charter has one accent. Linear's published position on the same
problem is to limit how much of their chrome colour enters the colour system,
and their principle is that structure "should be felt not seen"
([Linear](https://linear.app/now/behind-the-latest-design-refresh)).

**In our tokens.** Keep `--amber` and `--purple` for status pills at 9.5px —
three statuses genuinely need three distinguishable marks and a colourblind-safe
pair of shapes. But render the headline row as: `100` in `--ink` at display
weight, and `80 new · 10 shortlisted · 10 invited` as a secondary line at 13px,
each number in `--ink` with its label in `--muted`, the status *pill* carrying
the hue at pill size. One accent stays for one thing: the action.

**Which screens.** `/club/register`, `/club/home`, and the design page's own
status row.

**Cost.** Trivial. Mobile parity is automatic — this is the same fix at both
widths.

**BUZ decision?** **Yes.** `--amber` and `--purple` are token-set additions made
after the 24 Aug charter, which lists one accent. Whatever we do, the register
should record that the palette now has three status hues and where they may
appear. That is a two-line amendment, and without it the next person adds a
fourth.

---

### P5 · Make the CV a better document, not a wider one — **ADOPT**

**Problem.** 62% empty at 1280, and a stranger has no frame to hold onto once
the header scrolls away. Read.cv's whole proposition was that a profile could
feel "art-directed rather than algorithmically assembled"
([Hack Design](https://www.hackdesign.org/toolkit/read-cv/)) — a document, not a
record. Ours nearly is.

**Four moves inside the 640px column, no rail.**

1. **A sticky identity strip.** Once the hero scrolls past, a 56px bar: initials
   block or photo at 28px, `Deniz Yılmaz · AM · Riverside FC U15`, and on the
   right the one action the reader has. `--surface` over `--bg`, one `--line`
   hairline under it, no shadow. This is what LinkedIn's rail is *actually*
   doing for a reader — keeping identity present — and a strip does it in one
   column and prints away cleanly.
2. **Fix the highlight cards.** 604×165 with a play button in the middle of
   nothing is where the "empty" reading comes from. D-97 requires a click-to-play
   façade, so we cannot fetch a YouTube thumbnail before the reader presses play
   — but we can make the façade *ours*: the hero gradient, the pitch mark at low
   opacity, the title at 15px/800 and the description at 12.5px/500 filling the
   card rather than sitting in a strip along the bottom. Same height, no
   emptiness.
3. **Fill the sides with the page, not with content.** The void either side of the
   column should be the hero gradient continued and one very low-contrast pitch
   mark, so the page reads as *framed* rather than *unfinished*. No information
   goes there — nothing in the sides means nothing to reflow at 1023px and
   nothing to lose in print.
4. **Render the document, don't print the page** (see §2). The print stylesheet
   fast-follow should produce a one-column A4 artefact: name, positions, club,
   the surfaced stats, about, achievements, "other football," and the link —
   with highlights as printed URLs, because a video does not print. Seed it from
   DirectionB as the brief says.

**Which screens.** `/p/<token>` first, `/c/<slug>` second (the coach CV needs
only moves 1 and 4).

**Cost.** Move 1 is a small component and must exist on the phone too — it does,
as the same strip. Move 2 is pure CSS. Move 3 is a background. Move 4 is the
already-planned fast-follow, scoped correctly.

**BUZ decision?** No. All four are container and craft. Move 4's *scope* (a
separate document rather than a print stylesheet over the page) is worth
telling him, because it is slightly more work and materially better.

---

### P6 · A short list needs structure, not an apology — **ADAPT**

**Problem.** Our lists are usually short and will be short for the whole soft
launch. Four trials. A newly claimed club with six registrations. A brand-new
account whose `/home` is 70% empty at 1280, and a `/club/billing` at 80%. A flat
run of three rows under a heading reads as broken; the same three rows under
group headers read as organised.

**What the published material actually says, and what it doesn't.** Every design
system documents the *zero* state and almost none documents the *three-row*
state — that gap is itself the finding. What is citable is the taxonomy: Carbon
separates **first-use**, **no-results** and **error** as different screens
([Carbon](https://carbondesignsystem.com/patterns/empty-states-pattern/)), and
Polaris's tone rule is that an empty state should "never make merchants feel
unsuccessful or guilty"
([Polaris](https://polaris-react.shopify.com/components/layout-and-structure/empty-state)).
The common failure is shipping one component for both — so a list filtered to
nothing offers "create your first one" instead of "clear the filters."

**In our tokens.** Three moves, all cheap:

1. **Group headers rescue short lists.** The register already does this by squad
   and is the better page for it. `/trials` does not group at all — group it by
   month (`OCTOBER`, then `NOVEMBER`) in the 11px/800/0.14em kicker with a count
   on the right, and four notices stop looking like a stub.
2. **Separate the three empty states.** *Nothing yet* says what will appear here
   (we already have good copy for this on the design page — "Nothing yet beyond
   your approval…"). *Nothing matches* offers `Clear` and nothing else.
   *Nothing here for you* — the brand-new seat — is the one we currently do
   least well. No illustration: we have a pitch mark and a gradient, and
   Polaris's 200px illustration is a light-mode convention that would sit badly
   on `--bg`.
3. **Don't let a near-empty page stretch.** Atlassian's cap matters more at three
   rows than at three hundred. Ours is already capped, which is why our empty
   screens read as quiet rather than as desolate.

**Which screens.** `/trials` (grouping), `/club/register` (already right —
protect it), brand-new `/home`, `/club/billing`, and every "nothing yet" block
the design page flagged as "a heading over nothing."

**Cost.** Low. Grouping `/trials` by month is a sort and a header. **Mobile
parity is a gain, not a cost** — grouping helps a phone more than a laptop.

**BUZ decision?** No. But the copy for the three states is user-visible and
should go past the copy check before it ships.

---

### P7 · Structure felt, not seen — rows, not a card each — **ADAPT**

**Problem.** `/club/squads` renders each squad as a full 930×105 bordered card.
Eleven squads is eleven cards, which at 1280 is a stack of identical rectangles —
the "wall of grey" in its dark-mode form. The register's table is better: group
header, sticky column head, hairline rows.

**The published answer is subtraction, not striping.** Linear is the only team
in this group with a written rationale, and their fix for exactly this was to
*remove* dividing lines, dim the navigation chrome "by a few notches," reduce
and shrink icons, strip coloured backgrounds off them, and cut their theme
variables from 98 to three — base colour, accent, contrast — while raising the
contrast of content and lowering it on chrome
([Linear](https://linear.app/now/behind-the-latest-design-refresh),
[part II](https://linear.app/now/how-we-redesigned-the-linear-ui)). Their
principle: "Structure should be felt not seen." Not one product in this set
publicly advocates zebra striping. The vocabulary that actually recurs is:
hairline separators, group headers, one strong left-aligned first column,
**actions revealed on hover rather than drawn on every row**, and colour
reserved for a single status signal — Ashby's green/amber/red answers only "does
this one need me today?"
([Ashby](https://docs.ashbyhq.com/candidate-pipeline)).

**The hover point is the one we're missing.** Our register draws a full
`Open the CV` button *and* a `Shortlist` button on all 100 rows — 200 bordered
rectangles down a 9,645px page, which is most of the grey. Attio shows row
actions on hover. On our rows, `Open the CV` should be the player's name itself
(the row is the link), and `Shortlist` should appear on hover and on focus.
Keyboard and touch parity matter here: below 1024 the actions stay drawn, and at
every width they must be reachable by Tab, so the hover is an enhancement and
never the only route.

**We already have the right answer twice.** The club page's TRIALS block is one
bordered card holding two hairline-separated rows and a note at the bottom, and
it reads as a single object. The register's table is the same idea at scale. A
short list belongs inside one card; a long list belongs in one card with a
sticky head. Never one card per row.

**In our tokens.** The register's own treatment is the house pattern and squads
should adopt it: `.console-row` grid, a `.rule` hairline between rows,
`.console-row-hover` for the quiet hover we already wrote ("this is a list of
children, not a shopping cart" — a good comment, keep it), group header in the
kicker. Reserve the 16px bordered card for things you *act on*, which is the
surface rule we already have ("raised = act here, sunken = read this").

**Cost.** Low. Below 1024 squads stay as cards, which is what `.m-only` /
`.d-only` already does for the register — so this is a container change with a
precedent.

**BUZ decision?** No.

---

### P8 · Cap the primary button — **ADOPT**

A 900px-wide accent button on `/club/squads` is a phone control scaled up. The
charter fixes height (50px) and radius (14px) and is silent on width, and
silence is how a token set forks. Add: a primary button is at most 360px wide,
left-aligned in its card above 1024px, full-width below. Touch target unchanged
at 50px, so D-147 constraint 4 holds. Trivial cost, no decision needed.

---

### P9 · Say the count, always — **ADOPT**

LinkedIn's public jobs page leads with "1,000+ … Jobs in Melbourne" before the
list. We do this on the register (`79 of 100 shown`) and on `/trials`
(`4 trials`), but the trials count sits *below* a 300px filter block where
nobody reads it, and the register's sits inside the filter card. With P1 the
count belongs in the sticky summary line, which is the only element guaranteed
to be on screen. Trivial, no decision.

---

### P10 · Saved views and segments — **LEAVE, for now**

This is the most universal pattern in the whole benchmark and I am still saying
leave it. A saved filter set as a first-class object appears in every serious
work surface: Linear (created under Views or by saving an active filter set,
scoped to a team, favourited into the sidebar, subscribable, shareable by URL),
Attio (each view carrying its own columns, filters and sorts), Intercom (views
and folders in the sidebar with counts), Ashby (saved filter sets as tabs across
the top of the pipeline). Greenhouse's *lack* of them is the conspicuous gap in
that group. It is genuinely the next thing a TD would want after P1 — "my U15
shortlist" as a door.

But it is **new product, not a desktop container change**. D-147 forbids a
desktop-only capability, so it ships on the phone too or not at all; it adds a
stored object per club; and filters that are shareable by URL are a share
surface over a list of children, which is a permission question and not a design
one. Park it behind real demand from a claimed club in October, the same way
D-74 parked the club-page furniture. **Cheap half-measure available now:** our
filters already encode in the URL as query params (`/club/register?status=new`),
so a TD can bookmark one today. That is 90% of the value for none of the cost,
and worth one line of copy somewhere.

Same verdict, same reasoning, for **Intercom's two-layouts-one-shortcut** move
(`L` toggles a chat layout for the agent and a wide table layout for the shift
manager —
[Intercom](https://www.intercom.com/help/en/articles/7911926-customize-the-inbox-to-suit-you-and-how-you-work-best)).
Elegant, and exactly the sort of thing that becomes a desktop-only capability
nobody tested.

---

### P11 · The tablet, which is the half of the question nobody has measured — **ADOPT, this week**

**Nobody has looked.** `index.json` holds 87 captures and every one is 1280.
There is no 820 set and no 1440 set. BUZ asked about a laptop **and a tablet**
and we can currently answer half the question. Add 820 and 1440 to
`scripts/screens.mjs` before the proposal seat draws anything — cost is one
array.

**And I think I know what he'll find.** Reading the breakpoints rather than a
render: `.console-nav`, `.d-only` and the 640px reading column all switch on at
**`min-width: 1024px`**. Below that, `.console` caps at 560px, `.m-only`
renders, and the sidebar does not exist. Now put real tablets against that line:

| Device, portrait | CSS width | What it gets |
|---|---|---|
| iPad (10th gen) | 820 | phone layout, 560px column, no sidebar |
| iPad Air / Pro 11" | 834 | phone layout, 560px column, no sidebar |
| iPad Pro 12.9" | 1024 | console, sidebar, tables |
| any iPad, landscape | 1080–1366 | console, sidebar, tables |

So a technical director who opens the Interest Register on an ordinary iPad held
upright gets **a stack of mobile cards in a 560px column with ~135px of dead
gutter either side, and no sidebar** — a phone screen with margins. Turn the
same iPad sideways and he gets the full console. That cliff is per spec — D-147
says 640–1023 caps at 560 and pairs may go two-up — but the spec was written
about a browser window, and a tablet is not a small window, it is a device
someone is holding at a club meeting.

**What I'd do, and it is a smaller change than it sounds.** Do not add a
breakpoint — three is the rule and four is a fork. Instead:

1. **Raise the reading cap in the middle band from 560 to 640**, so the tablet
   and the laptop read the same column. There is no argument for 560 at 834px
   that isn't an argument for 560 at 1280, and the code already carries a
   comment calling the 560 cap on desktop "the tablet rule applied to desktop —
   the design system forking by omission." The same sentence runs backwards.
2. **Let the console sidebar and the desktop table appear at 834, not 1024** —
   i.e. move the console breakpoint down, keeping the reading breakpoint where
   it is. 232px of sidebar plus a 560px table fits inside 834 with room; the
   `.console-row` grid has a 140px minimum on its first column and would need
   its middle column to give, which is a `minmax` change, not a redesign.
3. If (2) is too much for the soft launch, the cheap version is (1) alone plus
   using the two-up allowance D-147 already grants in this band.

**Cost.** (1) is one line. (2) is one media query boundary and one `minmax`.
Both are container-only. **Neither adds a breakpoint, a feature or a token**, so
D-147's four constraints all hold.

**BUZ decision?** **Yes, for (2).** Moving the console boundary from 1024 to
834 changes which devices get which of the two desktop layouts, and D-147 names
1024 explicitly. It is a number in a locked decision and he should move it, not
us. **(1) needs no decision** — it removes an inconsistency the register already
calls out.

---

## 4 · What we should not copy, and why

- **The feed, and the three-column shell built to surround it.** We have no feed
  and must never have one (D-21, pillar zero §4; D-03 — never described as a
  social network). Two of LinkedIn's three columns are scaffolding for a
  business we do not have.
- **"People Also Viewed" / "Similar profiles" in any form.** A recommender over
  people, which under a minor's CV is a recommender over children. Out by
  pillar zero §4, and it is *the* thing LinkedIn's profile rail exists to hold.
  This is the hard reason the rail question has only one answer for the CV.
- **Follower counts, reactions, view counts rendered as social proof.** Note the
  difference from what we *do* show: player `/home`'s "who has read your
  registrations" is named, specific, revocable, and addressed to the subject.
  A number labelled "1,204 views" is the same data turned into a scoreboard. We
  ship the first and never the second.
- **Profile completeness as a score or a nag.** Our `5 of 6 done` bar is close to
  this line. It is fine as a build-time checklist on `/build`; it must never
  appear on a public CV or be phrased as a ranking, and it must never imply the
  page is worth less. Adjacent to D-85's banned "potential."
- **Density for its own sake.** Linear's 36px rows work because its users live
  there all day and navigate by keyboard. Our TD opens the register a few times
  a week, on a laptop, possibly on a club night. Our 44px minimum stands at every
  width (D-147 constraint 4) and I would not shrink a row by one pixel to fit
  more children on a screen.
- **An auth wall on a public list.** LinkedIn's logged-out jobs page gates the
  detail. Our trials index is a public promise (D-74) and our CV link works for a
  stranger by design (D-77, D-80). Never gate either.
- **A rail on the public CV** — for all of §0.

---

## 5 · What needs a decision from BUZ

1. **Prev/next through a filtered register** (P2). A club moving between
   children's CVs without returning to a list. I recommend yes; it needs saying
   out loud and probably an audit-log line.
2. **`--amber` and `--purple` are in the codebase and not in the charter** (P4).
   Ratify them as status-pill-only hues, or remove them. Either is fine; the
   silence is not.
3. **The console frame now wraps player and parent `/home`** (P3), recorded in
   code as "D-147, amended 16 Sep." If that amendment is not in the register, put
   it there with its own number — "every screen is a reading surface unless it is
   on the console list" is the sentence holding us to two desktop designs.
4. **Primary button max width** (P8) — a one-line charter addition.
5. **Print scope** (P5, move 4): a rendered one-column document rather than a
   print stylesheet over the page. Slightly more work, materially better, and it
   is what LinkedIn had to do in the end.
6. **The console breakpoint: 1024 or 834?** (P11). D-147 names 1024. At 1024 an
   ordinary iPad in portrait gets the phone layout with margins, and only the
   12.9" gets the console. This is the direct answer to the tablet half of BUZ's
   question and the number is his.

Nothing in P1, P6, P7, P9 or the first half of P11 contradicts a locked decision.

---

## 6 · Top five, with verdicts

| # | Pattern | Verdict |
|---|---|---|
| 1 | Filter **summary** at desktop, not a filter wall — counted chips behind a 44px sticky row carrying the applied filters and the count (P1) | **Adapt** |
| 2 | Keep your place in the list — scroll and filter restoration, plus a position counter and prev/next through the filtered register, without re-rendering the CV in a panel (P2) | **Adapt** |
| 3 | The rail holds accountability, never suggestions — extend player `/home`'s "who has read this" to guardian controls, parent home and TD home; delete the duplicated nav column (P3) | **Adopt** |
| 4 | A better single column on the CV — sticky identity strip, façades that fill their card, a framed void, a rendered print document (P5) | **Adopt** |
| 5 | The tablet cliff — an ordinary iPad in portrait sits below the 1024px console line and gets the phone layout in a 560px column (P11) | **Adapt** |

And the one to leave: **LinkedIn's profile rail**, because once the engagement
furniture is removed there is nothing in it we are allowed to put back.

---

## 7 · What is still open in this benchmark

Two of the four study areas are only partly covered and the proposal seat should
know which:

- **Profile-as-product pages beyond LinkedIn** — Read.cv, Behance, GitHub,
  Transfermarkt and the rest. I have LinkedIn's public profile first-hand and one
  line of published commentary on Read.cv. The specific question I did not get to
  is how those pages handle a *sparse* profile — a player with three facts — which
  matters to us more than to any of them, because our never-zero rule (D-70) means
  a real CV can legitimately carry two stat tiles and nothing else. P6 is my
  answer from first principles, not from their evidence.
- **Dark interfaces at large widths** — how many background elevations products
  like Linear, Vercel, Raycast, Supabase and Sentry actually use, how far apart
  the values sit, and whether they separate regions with hairlines, elevation or
  pure spacing. We have four surface values (`--bg`, `--surface`, `--surface-2`,
  `--surface-sunken`) plus `--line`, and I have not checked that spread against
  anyone's published guidance. Linear's published position — remove dividing
  lines, dim the chrome, raise content contrast — is the only citable thing I
  have, and it is in P7.

Neither gap changes any verdict above. Both would make the mockups better.

---

## Sources

- [LinkedIn — Bill Gates public profile (logged-out render)](https://www.linkedin.com/in/williamhgates)
- [LinkedIn — public jobs search (logged-out render)](https://www.linkedin.com/jobs/search)
- [LinkedIn blog — Desktop redesign puts conversations and content at the center](https://www.linkedin.com/blog/member/product/linkedin-desktop-redesign-puts-conversations-and-content-at-the-center)
- [LinkedIn engineering — Under the hood: updating LinkedIn's UI (Art Deco)](https://www.linkedin.com/blog/engineering/product-design/updating-linkedins-ui)
- [Kerry Mortimer — Updates to your LinkedIn profile layout (the right rail)](https://www.linkedin.com/pulse/updates-your-linkedin-profile-layout-kerry-mortimer)
- [Dowitcher Designs — Understanding the new LinkedIn layout](https://dowitcherdesigns.com/understanding-new-linkedin-layout/)
- [Linear — Behind the latest design refresh](https://linear.app/now/behind-the-latest-design-refresh)
- [Linear — How we redesigned the Linear UI (part II)](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Linear — Filters](https://linear.app/docs/filters) · [Custom views](https://linear.app/docs/custom-views) · [Peek](https://linear.app/docs/peek)
- [Attio — Create and view records (the preview drawer)](https://attio.com/help/reference/managing-your-data/records/create-and-view-records)
- [Attio — Create and manage table views](https://attio.com/help/reference/managing-your-data/views/create-and-manage-table-views)
- [Greenhouse — Candidate and prospect filters](https://support.greenhouse.io/hc/en-us/articles/360043184152-Candidate-and-prospect-filters)
- [Greenhouse — Using the new candidate profile](https://support.greenhouse.io/hc/en-us/articles/11957068130971-Using-the-new-candidate-profile)
- [Greenhouse — Visual candidate pipeline](https://support.greenhouse.io/hc/en-us/articles/4874727408795-Visual-Candidate-Pipeline)
- [Ashby — Candidate pipeline](https://docs.ashbyhq.com/candidate-pipeline)
- [Intercom — Customize the inbox (chat layout vs table layout)](https://www.intercom.com/help/en/articles/7911926-customize-the-inbox-to-suit-you-and-how-you-work-best)
- [Atlassian Design — Grid (864 / 1296 / fluid)](https://atlassian.design/foundations/grid) · [Dynamic table](https://atlassian.design/components/dynamic-table)
- [Shopify — Admin layout](https://shopify.dev/docs/apps/design/layout) · [Polaris index table](https://ownego.github.io/polaris-vue/components/IndexTable) · [Polaris empty state](https://polaris-react.shopify.com/components/layout-and-structure/empty-state)
- [Carbon — Empty states pattern](https://carbondesignsystem.com/patterns/empty-states-pattern/)
- [NN/g — Designing empty states in complex applications](https://www.nngroup.com/articles/empty-state-interface-design/)
- [Hack Design — Read.cv](https://www.hackdesign.org/toolkit/read-cv/)
- Our own: `docs/design/screens/` (87 captures at 1280), `app/globals.css`,
  `components/console-shell.tsx`, `components/player-shell.tsx`,
  `app/trials/page.tsx`.
