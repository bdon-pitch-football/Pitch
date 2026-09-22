# design audit: laptop and tablet — does the background look empty? (23 Sep 2026)

**Asked (BUZ, 23 Sep):** on a laptop or a tablet does the background look very empty?
Is the app up to scratch? Can we make it look better? He named LinkedIn as the
comparison. A benchmark seat is studying LinkedIn and peers separately; this
report judges our own product only.

**Material.** Every page as every seat at 1280 and 820, opened and looked at —
`docs/design/screens/`, 172 captures over 86 distinct screens. I added two sets
that the capture script had never reached, because `scripts/screens.mjs` follows
links from each seat's `/home` and **no seat links to `/ops`**: the four operator
console screens and `/club/squads/<id>`. Both are now in `screens/` and
`index.json`.

**Two caveats on the numbers before anything else.**

1. The brief said "every page reports its content box as the full width with no
   gutter". That is a measurement artefact, not the layout. `EMPTINESS()` takes
   the widest of `body > div, main, .console, .reading`, which is the full-bleed
   page wrapper — so `contentWidth` is always 1280 and `sideGutter` always 0.
   **Read `emptyPercent`; ignore `contentWidth` and `sideGutter`.** The real
   reading column measures **604px** on the captures (640 minus 18px padding
   each side), centred — which is D-147 built correctly.
2. Figures in the captures drifted between runs (Deniz's appearances read 16,
   then 17, then 18). The dev database was being written to by something else
   during the session. Three consecutive fetches of `/p/dev-deniz` now return
   identical values, so this is not a read-side write. Numbers in screenshots are
   illustrative; the layout findings are not affected.

**Nothing in this report changes product code or writes product copy.** Where a
finding argues with the charter or D-147, I say so and stop — those are BUZ's
decisions.

---

## Answer to BUZ, in his terms

### 1. Where it looks empty on a laptop, and why

**The 604px column is not the problem. What sits in it is.** A 640px column in a
1280px window is exactly what the charter asked for, and on the screens whose job
is *one read or one decision* it reads as calm and deliberate — `/g/pending`,
`/g/invite`, `/p/dev-deniz`, `/c/sam-kaya`, `/fc/riverside-fc`, `/report`.
A parent lands on one question with nothing else competing for them. That is the
charter working.

It reads as **unfinished** on the screens whose job is *working a list or picking
an action*, because a tool sitting in a 604px slot with 386px of black beside it
looks like the page failed to fill:

| Screen | Above the fold at 1280 | Below the fold |
|---|---|---|
| `/club/billing` (80%) | Title, one "$54 a month" card, one button, one grey line — all done by y=330 | Nothing. 470px of background, and 386px more to the right of the column |
| `/jobs` (70%) | Title, a 3-stat row, two role cards, one note card — done by y=540 | Nothing |
| `brand-new` `/home` (70%) | Welcome line, three 60px cards, a grey paragraph, "Sign out" — done by y=480 | Nothing |
| `/signin` (68%) | The form is complete by y=548 | A 200px void, then "New to Pitch? Create an account" flushed to the viewport bottom |
| `coach` `/home` (67%) | Coach page card, progress card, one registrations row, right rail of four buttons — done by y=410 | Nothing, across all 1010px |
| `club-admin` `/home` (63%) | A gradient hero card holding three lines and 50px of blank, two trial rows, a copy-link row | Nothing |

The pattern is consistent: **the emptiness is vertical, below the fold, not a
margin problem.** Every one of those screens finishes in the top half of the
viewport and then stops. On a 13-inch laptop the bottom 40–50% of every one of
them is bare background. That is what BUZ is seeing.

**At 820 it is different and mostly better.** The tablet drops the sidebar for a
bottom tab bar and a 524px column — 64% of the window, against 47% at 1280 — so
most screens read denser on an iPad than on a laptop. The exceptions are the
screens that were already thin: `/club/billing` at **74%** is the worst single
screen in the product at either width — four elements at the top of an 1180px
screen and 800px of black under them.

### 2. Where it is genuinely good

Three screens set the standard. They are listed in full at the end of this
report: **`/club/register`**, **`/ops/verification`**, and **`player` `/home`**
(with `player-16-17` `/home`). Honourable mention to **`/g/pending`**, which is
the clearest example in the product of empty space reading as calm rather than
as unfinished.

### 3. Is it up to scratch

**Judged as a technical director opening it on a laptop for the first time:**
mostly yes, with one thing that would end the meeting. The Interest Register and
the verification console would make him believe us — they are dense, tabular,
honest about provenance, and they lead with the safety line before the data. He
would not think a hobbyist built those.

What **looks amateur** to him, in those words:

- The Pitch mark moves. It lands at four different horizontal positions at the
  same window width, and on `/privacy` and `/terms` it moves to the **top left**.
  You notice it on the third page.
- Billing is three elements in a black field. The page attached to $54 a month
  looks like a placeholder.
- Squads is eleven stacked cards where a table was asked for.
- And the one that actually closes the laptop: **`/privacy` and `/terms` publish
  our internal change log.** Before clause 1 a reader gets version notes,
  D-numbers, "BUZ's call, 3 September 2026", and an engineer's first-person
  apology ("this restores work that was lost, and the loss was my doing"). That
  is not an empty-space problem and it is not in my lane to fix, but it is the
  first thing a careful TD reads and it is the worst thing in the product.

**Judged as a parent on a tablet:** the guardian flows are the best-composed
thing we have made. `/g/pending` and `/g/invite` put one decision on the screen,
show the exact diff, and state three promises in plain words. A parent would
trust that.

What **looks amateur** to her:

- A 450px void between the reassurance ticks and the buttons on `/g/invite` at
  820, with a footnote card *after* the buttons — so the buttons are neither
  anchored to the bottom nor sitting in the flow.
- Five identical "WAITING ON YOU" cards on `/home`, three of them with the same
  "Review it" button, and coloured dots that encode a real distinction
  (club-initiated vs child-initiated) that nothing on screen explains.
- "**0** EXPIRING IN 30 DAYS" — a rendered zero on the parent dashboard, on a
  product whose CV is built around never showing one.
- The last card clipped under the tab bar with no fade or shadow to say so.

**Verdict.** The product is not amateur. The **chrome** is. Nothing structural is
broken and no screen is wrong; what fails is consistency — one wordmark position,
one button set, one form-label style, one console density. Those are cheap fixes
with a disproportionate effect, and they are what separates us from LinkedIn far
more than any amount of background does.

### 4. The console surfaces

**Do they use the width the charter gives them? Half of them, and it is exactly
backwards from what D-147 says.**

| Screen | On D-147's console list? | Renders as | Verdict |
|---|---|---|---|
| `/club/register` | **yes** (`InterestRegister`) | sidebar + 932px, real table | correct |
| `/club/squads` | no | sidebar + 932px, stacked cards | width yes, density no |
| `/club/squads/<id>` | no | sidebar + 932px, stacked cards | width yes, density no |
| `/club/roles` | no | sidebar + 932px, form over list | width yes |
| `/club/page-edit` | no | sidebar + **604px** | narrow |
| `/club/billing` | **yes** (`ClubBilling`) | sidebar + **604px**, 386px dead right | **wrong** |
| `/club/post-trial` | **yes** (`PostATrial`) | sidebar + **604px**, 386px dead right | **wrong** |
| `/ops/verification` | **yes** (operator console) | sidebar + 932px, real table | correct — the best of them |
| `/ops/switches` | **yes** | sidebar + 594 + a rail holding one empty card | half |
| `/ops/reports` | **yes** | main column empty, rail carries everything | **wrong** |
| `/ops/support` | **yes** | sidebar + 932px, one search field, 500px of nothing | thin by design (D-79), reads unfinished |

**Does the register read like a tool someone works in all season? Yes — it is the
best screen in the product.** Full width, a real table with aligned columns, the
filter chips carry live counts, the status colour means the same thing in the
pill and in the stat row above, and the child-safety line sits above the data
rather than buried under it. Two things stop it being perfect: every row carries
a full-height "Open the CV" button so a screenful is ten heavy buttons stacked;
and the right-hand action column mixes a button ("Shortlist") with plain text
("Invitation sent"), so the column has no consistent edge.

---

## The ten worst, worst first

Rated **showstopper** / **looks amateur** / **minor**. Worst-on-a-laptop is the
ordering, because that is the question BUZ asked.

### 1 · `/privacy` and `/terms` publish our internal change log — **showstopper**

`1280-signed-out-privacy.png`, `1280-signed-out-terms.png` · all eight seats ·
14,782px and 19,582px tall.

The first ~2,000 words a reader meets, above clause 1, are the document's version
history: D-numbers, "BUZ's call, 3 September 2026", a materiality ruling written
in the first person, and an engineer's apology. `app/legal/legal-page.tsx` renders
`docs/legal/20-Privacy-Policy-Adult.md` whole, and the markdown's internal
blockquote goes out with it. The same renderer (`LegalBody`) shows the child
policy **inside the guardian approval flow** — so this is also what a parent meets
at the moment they are deciding.

Also on these two pages, and mine to call: a **⚠️ emoji** (charter: "stroke SVGs
only, never emoji"), the Pitch mark at the **top left** (BUZ's 24 Aug rule: top
right, no exceptions), and a bare near-black background with no Night Match hero
gradient, so they do not look like our product at all.

Out of the audit seat's lane to fix — this is copy-check, legal and Leo. Named
because it is the first thing a careful TD reads.

### 2 · `/club/billing` — 80% at 1280, 74% at 820 — **looks amateur**

`1280-club-td-club_billing.png`, `820-club-admin-club_billing.png` · both club
seats.

The emptiest screen in the product, and it is the one attached to $54 a month.
At 1280: a title, one card reading "$54 a month", one button, one grey line —
finished by y=330, with 470px of background below and 386px beside. At 820 it is
worse: 800px of black. A paying customer opens this to check what they are on and
finds a page that looks unbuilt. It is also a **named console surface in D-147**
rendering as a 604px reading column (see finding 5).

Redundant too: a "< Back" link above a page that already has the sidebar item
highlighted.

### 3 · `/ops/reports` — 72% — the heavy column is the narrow one — **looks amateur**

`1280-ops-ops_reports.png`.

The main (left, 594px) column holds one empty-state card — "No open reports." —
and then 600px of nothing. The right rail (320px) carries three sections of dense
copy, a held-accounts panel and a search field, including the 1800RESPECT
guidance. The page's weight is in its margin. A stranger would assume it had
half-loaded. This screen and `/ops/support` (74%) had never been captured at all
before this audit.

### 4 · There are three desktop layouts, not two — **looks amateur** · *argues with D-147*

Measured across the 1280 captures:

- **Reading:** 604px column, centred — public pages, auth, `/report`, `/trials`, `/g/*`.
- **Console wide:** 270px sidebar + 932px content — `/club/register`, `/club/squads`, `/club/roles`, `/ops/*`.
- **A third, unnamed:** 270px sidebar + ~594px main + ~320px right rail —
  `player` `/home`, `player-16-17` `/home`, `coach` `/home`, `club-td` `/home`,
  `club-admin` `/home`.

D-147 says "**two** desktop layouts, no more… that is what makes this two desktop
designs rather than seventy-five". The third one is the reason the dashboards
feel like a different product from the console. **This is BUZ's decision, not
mine** — the rail is genuinely good on `player` `/home` (finding: it is one of
the three best screens). The call to make is whether D-147 gains a third layout
on purpose, or the dashboards fold into the console layout. It should not stay
undeclared.

### 5 · The charter's console list and the code's console list are opposites — **looks amateur** · *argues with D-147*

D-147 names the console surfaces: `InterestRegister`, `ClubPeople`,
`ClubDashboard`, `ClubHeldQueue`, **`ClubBilling`**, **`PostATrial`**, and the
operator console.

`ClubBilling` and `PostATrial` both render as 604px reading columns with 386px of
dead space to their right (`1280-club-td-club_billing.png`,
`1280-club-td-club_post_trial.png`). Meanwhile `/club/squads`, `/club/roles` and
`/club/page-edit` — none of them on the list — render wide. Exactly backwards.
`/club/post-trial` is a nine-field form with a date picker and two pill grids
squeezed into 604px while a third of the window sits empty beside it.

### 6 · The Pitch mark lands in four different places at the same window width — **looks amateur** · *argues with BUZ's own rule*

Measured: the wordmark's right edge across all 1280 captures.

| Right edge | Screens | Where |
|---|---|---|
| **892px** | 22 | `/club/billing`, `/club/page-edit`, `/club/post-trial` |
| **940px** | 28 | public pages, auth, `/report`, `/trials`, `/g/*`, dashboards without a sidebar |
| **1056px** | 2 | `/build/<id>` |
| **1220px** | 15 | `/club/register`, `/club/squads`, `/club/roles`, `/ops/*`, `club-*` `/home` |
| **top left** | 18 | `/privacy`, `/terms` |

BUZ's 24 Aug placement rule is "top right corner on every screen, no exceptions".
What is built is "top right of whatever container this page happens to use" —
which on a 1280 laptop means the mark jumps up to 328px as you navigate, and
crosses the page entirely on the legal pages. On a phone all containers are the
same width, so this is invisible at 390 and only appears on a laptop. It is the
cheapest fix on this list and probably the most visible.

### 7 · Squads uses the width but not the density — **looks amateur** · *argues with D-147*

`1280-club-td-club_squads.png`, `1280-club-td-club_squads_<id>.png`.

D-147: console surfaces get "**tables not stacked cards**". `/club/register` and
`/ops/verification` are real tables. `/club/squads` is eleven stacked cards at
~105px each — 1,150px of scroll for eleven rows that carry a name, a meta line, a
"Who plays" link and a two-line right-aligned grey label. `/club/squads/<id>` is
the same: 85px cards in which ~700px of each 932px row is empty.

Two more things on those pages: the **"Add a squad" form sits above the list**, so
a TD running eleven squads scrolls past a creation form every single time; and
"In use — can't be removed" wraps to two lines and sits on a different baseline
from "Who plays", so the right edge of every row is ragged.

### 8 · `club-admin` `/home` — an empty hero and six identical buttons — **looks amateur**

`1280-club-admin-home.png` · 63%.

The gradient hero card that carries 100 / 80 / 10 / 10 for the technical director
carries three lines of text and ~50px of blank for the club administrator,
because an administrator has no register access (correct, per D-93) — but the
component was not designed for the version with nothing in it. It reads as a
card that failed to load.

Worse: the right rail is **six identical secondary buttons with no primary**.
There is no accent on the screen at all, so the eye has nowhere to land. This is
the worst first-run impression of any signed-in seat, and a club administrator is
often the first person at a club to open Pitch.

### 9 · Five button treatments where the charter allows two — **looks amateur** · *argues with the charter*

Charter: primary `height 50px · radius 14px · accent`; secondary `height 46px ·
surface-2`. "**There is no third button.**" Measured at 1280:

| Height | Style | Where |
|---|---|---|
| 50px | accent fill | `/signin` "Sign in", "Add it", "Post it", "Save", "Approve the change" — correct |
| 46px | surface-2 | `/signin` "Email me a link", "Not this time" — correct |
| **56px** | surface-2 | `/club/register` "Open the CV" |
| **44px** | accent fill | `/trials` "I'm interested" |
| **~42px** | **accent outline** | `/club/squads/<id>` "Ask them" |
| ~36px | small surface pill | "Copy", "Look up", "Find" |
| — | bare text link | "Sign out", "Not this one", "Take off this register" |

The accent **outline** is the one that reads wrong — it is a fourth visual
language for "this is an action", and it appears only on one screen.

### 10 · Two form languages one click apart inside the same console — **looks amateur**

`1280-club-td-club_roles.png` vs `1280-club-td-club_post_trial.png`.

`/club/roles` and `/club/squads` label their fields **11px uppercase, tracked,
muted** — ROLE, AGE GROUP, COMMITMENT, CLOSES. `/club/post-trial`, one sidebar
item away, labels them **15px sentence-case in ink** with the value in
placeholder grey below — Notice title, Date, Time, Ground. Same session, same
sidebar, same user, two different ideas of what a form field looks like.
`/club/page-edit` uses the first style, `/build/<id>` uses the first style, so
`/club/post-trial` is the outlier — but a TD posting a trial hits it on their
second click.

---

## Everything else worth writing down

| # | Finding | Rating |
|---|---|---|
| 11 | `parent` `/home`: three cards labelled "WAITING ON YOU" with **two different dot colours** (purple `#9273ca`, accent `#3ddc84`) and **three different button weights** for the same kind of action. The colour encodes a real distinction — club-initiated vs child-initiated — and nothing on screen says so. | looks amateur |
| 12 | `parent` `/home`: "**0** EXPIRING IN 30 DAYS" rendered in the stat row. The never-zero rule (D-70) governs player stats, not this — but it is the same instinct, and a zero on the parent dashboard reads as a bug. | looks amateur |
| 13 | `/p/dev-deniz` stat tiles arrive on a **staggered entrance animation** (`cv-rise`, `animationDelay: 0.28 + i × 0.09s`) that is still visibly running 350ms after load — at 820 the three tiles form a descending staircase with the third almost invisible. It settles correctly by 2.5s. On 4G at a ground the staircase is what a club sees first. The counter also **counts up from 0**, so every tile reads "0" for the first frames on a CV built around never showing one. Respects `prefers-reduced-motion`. | looks amateur |
| 14 | `/p/dev-deniz`: the squad-number watermark ("10") is **clipped by the card's right edge** mid-glyph and collides with the pitch-mark logo tile. Two decorative elements occupying the same corner. | minor |
| 15 | `/fc/riverside-fc` and `/c/sam-kaya` share the **same stock banner photograph** — the same player in black with a green 9. A TD who opens his club page and his coach's page sees one picture twice. | looks amateur |
| 16 | `/join`: the "Continue" button renders `#216d43` — the **disabled** accent — at full text opacity. It is the only accent element on the screen, so the page's one call to action reads as a broken colour rather than as a disabled state. | looks amateur |
| 17 | `/signin`: "New to Pitch? Create an account" is flushed to the **viewport bottom** with a 200px void above it. The link is orphaned from the form it belongs to. | minor |
| 18 | `/g/invite`: a **170px void at 1280, 450px at 820** between the reassurance ticks and the buttons — and a footnote card *after* the buttons, so they are neither bottom-anchored nor in flow. `/g/pending` has the same shape without the footnote and reads as calm; this one does not. | looks amateur |
| 19 | `/trials`: 22 filter pills wrap to **six rows** inside the 604px column, orphaning "Seniors · 1" and "ST · 1" on rows of their own. A filter bar is a tool, not a reading surface — at 932px it would be three tidy rows. Also renders "**Men 0**" and "**Women 0**" pills: filters that lead nowhere. | minor |
| 20 | Stat rows are the same component in three different clothes: naked on the background (`/jobs`), inside a gradient hero (`club-td` `/home`, `/p/`), inside a plain card (`parent` `/home`). Their columns are sized by label width, so the numerals never line up to a grid. | minor |
| 21 | `/ops/*` sidebar reads "**OPERATOR**" with no crest, name or role, where every club sidebar carries all three. The most privileged console is the one that does not say who you are. | minor |
| 22 | `/ops/verification`: an **unlabelled column of em-dashes** between the club name and the status pill — it is a held-registration count, with no header and no explanation of the dash. | minor |
| 23 | "< Back" appears above pages that already have the sidebar item highlighted — `/club/billing`, `/club/post-trial`, all four `/ops/*`. Two navigation systems, one screen. | minor |
| 24 | `/ops/support` (74%, the emptiest after billing) and `/ops/switches` (50%): both put an empty-state card alone in a column and leave 500–600px under it. Deliberately thin surfaces (D-79), but the empty state is where the thinness shows. | minor |
| 25 | `scripts/screens.mjs` cannot reach `/ops/*` — it enumerates each seat's links from `/home`, and nothing links to the operator console. The most privileged screens in the product were unphotographed and untracked. Fixed for this report by capturing them separately; worth a permanent path list in the script. | minor |
| 26 | Out of lane, for safety review: `app/legal/legal-page.tsx` uses `dangerouslySetInnerHTML` on markdown from `docs/legal/`. Repo-controlled, not user input — but the security posture in `CLAUDE.md` says "never", so it should be an explicit exception rather than an unremarked one. | out of lane |
| 27 | For Leo: `lib/palette.ts` carries `amber`, `purple` and `red` tokens that the **Design charter section of `CLAUDE.md` does not list**. They are used coherently (`NEW` green / `SHORTLISTED` amber / `INVITED` purple, matching pill and stat colour) and I am not arguing against them — the charter text is simply stale. | out of lane |

---

## Every screen, with its emptiness figure

Share of the **first screenful** with nothing drawn on it, at each width. Sorted
by the 1280 figure. Full-height page for context. Captures in
`docs/design/screens/`; `index.json` has the per-row detail.

| Screen | Seat | 1280 | 820 | Page height |
|---|---|---|---|---|
| `/club/billing` | club-td | 80% | 73% | 889 |
| `/club/billing` | club-admin | 80% | 74% | 889 |
| `/ops/support` | ops | 74% | 76% | 889 |
| `/ops/reports` | ops | 72% | 61% | 889 |
| `/jobs` | signed-out | 70% | 73% | 889 |
| `/home` | brand-new | 70% | 74% | 889 |
| `/jobs` | brand-new | 70% | 73% | 889 |
| `/g/invite/<id>` | player-16-17 | 69% | 68% | 969 |
| `/signin` | signed-out | 68% | 72% | 889 |
| `/jobs` | coach | 68% | 67% | 889 |
| `/home` | coach | 67% | 62% | 889 |
| `/privacy` | player-16-17 | 66% | 0% | 1007 |
| `/g/pending/<id>` | parent | 64% | 70% | 889 |
| `/c/sam-kaya` | signed-out | 63% | 47% | 2111 |
| `/c/sam-kaya` | coach | 63% | 47% | 2111 |
| `/home` | club-admin | 63% | 51% | 889 |
| `/g/invite/<id>` | parent | 62% | 64% | 889 |
| `/g/invite/<id>` | parent | 62% | 68% | 889 |
| `/p/dev-deniz` | signed-out | 61% | 45% | 1660 |
| `/fc/riverside-fc` | signed-out | 61% | 47% | 2229 |
| `/fc/riverside-fc` | club-td | 61% | 47% | 2227 |
| `/fc/riverside-fc` | club-admin | 61% | 47% | 2227 |
| `/join` | signed-out | 60% | 65% | 889 |
| `/trials` | signed-out | 59% | 62% | 1179 |
| `/trials` | brand-new | 59% | 62% | 1179 |
| `/g/send/<id>` | parent | 57% | 63% | 889 |
| `/report` | signed-out | 56% | 54% | 977 |
| `/trials` | player | 56% | 56% | 1179 |
| `/report` | player | 56% | 54% | 977 |
| `/trials` | player-16-17 | 56% | 56% | 1179 |
| `/report` | player-16-17 | 56% | 54% | 977 |
| `/trials` | parent | 56% | 56% | 1179 |
| `/report` | parent | 56% | 54% | 977 |
| `/report` | coach | 56% | 54% | 977 |
| `/report` | club-td | 56% | 54% | 977 |
| `/report` | club-admin | 56% | 54% | 977 |
| `/report` | brand-new | 56% | 54% | 977 |
| `/home` | parent | 55% | 39% | 2110 |
| `/g/interest/<id>` | parent | 55% | 49% | 1088 |
| `/coach/edit` | brand-new | 55% | 40% | 2979 |
| `/build/<id>` | player | 54% | 39% | 1328 |
| `/build/<id>` | player-16-17 | 54% | 39% | 1328 |
| `/coach/register` | coach | 54% | 38% | 2859 |
| `/home` | club-td | 54% | 40% | 889 |
| `/g/controls/<id>` | parent | 53% | 37% | 2111 |
| `/g/controls/<id>` | parent | 53% | 37% | 1895 |
| `/g/controls/<id>` | parent | 53% | 37% | 1942 |
| `/send/<id>` | player | 52% | 43% | 1078 |
| `/build/<id>/preview` | player | 52% | 40% | 1601 |
| `/build/<id>/clips` | player | 52% | 54% | 889 |
| `/build/<id>/more` | player | 52% | 37% | 1389 |
| `/home` | player-16-17 | 52% | 38% | 1308 |
| `/send/<id>` | player-16-17 | 52% | 42% | 1096 |
| `/build/<id>/preview` | player-16-17 | 52% | 42% | 1980 |
| `/build/<id>/clips` | player-16-17 | 52% | 45% | 1045 |
| `/build/<id>/more` | player-16-17 | 52% | 37% | 1470 |
| `/coach/edit` | coach | 52% | 37% | 4162 |
| `/club/post-trial` | club-td | 52% | 33% | 1606 |
| `/club/post-trial` | club-admin | 52% | 34% | 1606 |
| `/ops/switches` | ops | 50% | 43% | 929 |
| `/home` | player | 42% | 38% | 889 |
| `/ops/verification` | ops | 40% | 56% | 889 |
| `/privacy` | signed-out | 0% | 0% | 14782 |
| `/terms` | signed-out | 0% | 0% | 19582 |
| `/privacy` | player | 0% | 0% | 14782 |
| `/terms` | player | 0% | 0% | 19582 |
| `/terms` | player-16-17 | 0% | 0% | 19582 |
| `/privacy` | parent | 0% | 0% | 14782 |
| `/terms` | parent | 0% | 0% | 19582 |
| `/privacy` | coach | 0% | 0% | 14782 |
| `/terms` | coach | 0% | 0% | 19582 |
| `/club/register` | club-td | 0% | 0% | 9645 |
| `/club/squads` | club-td | 0% | 0% | 2400 |
| `/club/page-edit` | club-td | 0% | 0% | 3322 |
| `/club/roles` | club-td | 0% | 0% | 1005 |
| `/club/register?status=new` | club-td | 0% | 0% | 8106 |
| `/privacy` | club-td | 0% | 0% | 14782 |
| `/terms` | club-td | 0% | 0% | 19582 |
| `/club/squads` | club-admin | 0% | 0% | 1839 |
| `/club/page-edit` | club-admin | 0% | 0% | 3322 |
| `/club/roles` | club-admin | 0% | 0% | 1005 |
| `/privacy` | club-admin | 0% | 0% | 14782 |
| `/terms` | club-admin | 0% | 0% | 19582 |
| `/privacy` | brand-new | 0% | 0% | 14782 |
| `/terms` | brand-new | 0% | 0% | 19582 |
| `/club/squads/<id>` | club-td | 0% | 0% | 5667 |

**A 0% row means the first screenful is entirely covered, not that the screen is
good.** `/privacy` is 0% and is finding 1. The figure measures coverage, nothing
else.

---

## The three that are genuinely good — this is the standard

### `/club/register` (club-td, 0% at 1280) — `1280-club-td-club_register.png`

The best screen in the product and the one every other console screen should be
measured against. It uses the full 932px; it is a **real table** with aligned
columns (player · their line · status · open · action); the filter chips carry
live counts so the TD knows what a filter costs before pressing it; the status
colour means the same thing in the pill and in the stat row above it; and the
child-safety sentence — "Every under-16 here was put on this register by a
parent" — sits *above* the data rather than in a footnote. It reads like
something a technical director would keep open all season, which is the whole
point of it.

Fix the two small things (ten stacked "Open the CV" buttons per screenful; a
right-hand column that alternates between a button and plain text) and this is
finished work.

### `/ops/verification` (40%) — `1280-ops-ops_verification.png`

The tightest table we have: 73px rows, four aligned columns, one action per row
in the same place every time, and a red-bordered banner that states the
invariant — "Nothing about a person under 18 reaches any club on this list until
you have made the call" — before a single club name appears. It puts the rule
above the data. That is the pattern the register also uses and it is why both
screens feel serious.

### `player` `/home` (42%) and `player-16-17` `/home` (52%) — `1280-player-home.png`

The only three-column screen that earns its right rail. The rail is not four
stacked buttons pretending to be content — it is one accent primary ("Send my CV
to a club"), a 2-up grid of four secondaries, and then a **real panel with real
information in it**: who has read your registrations, named, with dates, and
"Nobody at Sunbury United has read it yet" where nobody has. That last line is
the product's voice at its best — honest about the empty case instead of hiding
it. Compare the same rail on `coach` `/home` and `club-admin` `/home`, which have
the buttons and none of the content, and you can see exactly what is missing from
them.

**Honourable mention — `/g/pending` (64%).** The emptiness figure is high and the
screen is right. One decision, the exact change shown as a strikethrough diff,
three plain promises, two buttons and a quiet third option. Nothing else on the
page. This is what "empty reads as calm" looks like, and it is the argument for
keeping the 640px reading column exactly as D-147 specifies it.

---

**Ran:** `node scripts/screens.mjs --widths 1280,820` from `repo/` (174 captures),
plus two targeted capture runs for `/ops/*` and `/club/squads/<id>` that the
script's link-following cannot reach. Dev app on 3000 and the dev database were
used as found and not reseeded. Ports 3030 and 54323 (BUZ's demo) untouched.

**Changed:** nothing in the product. Added to `docs/design/screens/`: nine PNGs
(`1280`/`820` × four `/ops` screens, plus `/club/squads/<id>`) and their rows in
`index.json` (172 rows, 86 distinct screens).

**Lesson for the next seat:** `index.json`'s `contentWidth` and `sideGutter` are
measured against the full-bleed page wrapper, so they read 1280 and 0 on every
screen and mean nothing. Trust `emptyPercent`, and measure the real column off
the pixels. Also: `scripts/screens.mjs` writes `index.json` with **only the
widths in that run**, so `--widths 820` silently destroys the 1280 rows — always
pass every width you want kept.
