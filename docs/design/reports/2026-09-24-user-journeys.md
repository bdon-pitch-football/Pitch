# User seat: four people walking the product (24 September 2026)

Asked: walk Pitch as a 14-year-old, a parent, a volunteer coach and a technical
director. Say what actually lands, when, and where the screen does not deliver
what we promise. Read-only: I changed no product code, ran no suite, reseeded
nothing.

How I got in: the real sign-in form at `/signin` with an empty password for
`nate@example.com`, `td@example.com`, `sunbury@example.com`, and the same
`pitch_session` cookie `scripts/screens.mjs` mints for the other seats. Phone
at 375×812, laptop at 1280×800, both in Chrome.

One note before the walks, because it cost me twenty minutes and will cost the
next seat the same: **`.dev-ids.json` record ids no longer match the running
database.** `ids.children.nate.record_id` is `e76a5c7b…`; the app links
`82934970…`. Person ids are still right, so `screens.mjs` works, but anything
built on the record ids walks a record that is not there and sees a redirect to
`/home`, which reads exactly like a broken page. Not my lane — recording it.

---

## 1 · The fourteen-year-old

Seat walked: Deniz (14, AM/LW, Riverside FC) and Nate (16–17, GK, Northern
United) — Nate is the only minor in the seed with his own sign-in, so the
typing and previewing happened on his account and the under-16 differences were
read on Deniz's.

### The first five minutes, in order

**`/signin`.** Handsome. "Welcome back / One account, whichever seat you hold."
At 375px the content stops at about 1,130px of a 1,624px page — the bottom
third is empty background. It does not look broken; it looks like a page that
has not started yet.

**`/home`.** The first thing on the screen is a card that says **"Your page is
live"** with a green LIVE pill, his positions and number, and the link
`pitchfootball.com.au/p/····` — dotted out. That is the right first thing. Then
**"YOUR PAGE · 5 of 6 done"** with a green bar, and under it a single row:
**"Add a profile photo"**.

**The bar never finishes.** Deniz is 5 of 6. Nate is 5 of 6. Both are missing
the same step, and it is the one step that needs something off the camera roll
at a moment the kid is sitting on the couch. Sam the coach is "6 of 6 done ·
Every part of your page is filled in" and that line reads like a reward. A
player gets a permanent 83% and a nag. A kid who is not going to add a photo
tonight is told, every single time he opens the app, that he is incomplete.

**`/build/<record>` — Build your CV.** "Two minutes. Edit anything later." This
is the best screen in the product for this person. Three tabs (Your football ·
Highlights · Achievements), the photo affordance first, then name, then
positions as ten chips in two rows with **"Up to 3 · tap to order"** and a live
line underneath that read **"1 Goalkeeper"** when GK was selected. That numbered
ordering is genuinely good — it is the first thing on the screen that behaves
like a thing rather than a form.

Then the stats block: **"SEASON STATS · SELF-REPORTED / Tap a name to show or
hide it"**, four tiles reading `22 APPEARANCES`, `— GOALS`, `— ASSISTS`,
`7 CLEAN SHEETS`. Choosing which of your own numbers a club sees is a real
decision and it is handed to a 16-year-old plainly. Second thing that felt
alive.

**The About box is where he gets embarrassed.** The placeholder is
*"Right-footed 10 who plays between the lines. Working on my weak foot and
pressing triggers…"*. Nate is a goalkeeper. The one field where the kid has to
write about himself — the hardest box on any CV — hands him an example of a
different player in a different position. A keeper, a centre-back and a
fifteen-year-old who does not yet have words for what he does all get the
number 10's sentence to copy.

**`/build/<record>/preview`.** The moment. A banner: **"PREVIEW / This is
exactly what a club sees when you send your page."** Then the page: initials
block, a bird's-eye pitch diagram in the top corner with a dot on his position,
the squad number set huge and translucent behind it, `GK · #1 · Right footed`,
`Northern United SC — U18 Boys · Preston VIC`, a **Parent-approved** chip, two
stat tiles (22 appearances, 7 clean sheets — goals and assists correctly
absent, not zeroed), About, highlights with play buttons, achievements with
icons, a **Football history** list with a green dot on the current club, and
**Other football** with `REPRESENTATIVE` and `FUTSAL` tags.

**This is the answer to the screenshot test, and the answer is yes.** I would
have sent this at sixteen. The pitch diagram and the ghosted number are the two
details that make it look designed rather than generated.

Two things spoil the moment:

- The initials block sits where the face goes, so the one unfinished step is
  the largest element on the page he is proud of.
- Scroll to the bottom of his own preview and he reads a paragraph addressed to
  somebody else: **"There is no way to reply to a family through Pitch. … If you
  want Nate at a trial, post it on Pitch … It goes to Nate and their parent
  together, and a record is kept."** He is reading instructions to a club, about
  himself, in the third person, with the wrong pronoun. It is defensible — the
  banner did say *exactly* what a club sees — but the last thing a kid reads on
  his proudest screen is a rule about how nobody can talk to him.

### The first week

**`/build/<record>/clips`.** "Paste a link from YouTube, Instagram or Veo. **No
uploading, no waiting.**" Three clips listed, **"Your clips · 3 of 10 used"**,
and at the bottom **"Ten clips, free / Swap a clip out any time."** No lock, no
upsell. This is the screen that will keep a fourteen-year-old coming back, and
it costs him nothing.

**`/trials`.** "Trials board / Club trials listed below, by trial date."
Filters by age group, competition and positions wanted, every chip carrying its
own count (`U15 · 2`, `GK · 2`, `Women · 0`). Then: **4 trials**. Four. For a
U18 keeper exactly one of the four is his age group, and it is a seniors-and-
U16–U18 listing at a club he does not play for.

That is the seed, not the code — but the first-week value of this screen is
entirely a function of how many notices are on it, and four is a board a kid
checks once and does not come back to. The honesty line is good — "Some clubs
take your interest inside Pitch. The rest read a CV in their inbox like they
always have — the button on each listing tells you which. Last checked 24 Sep."

**`/send/<record>` — Send my CV.** For Nate: *"You send this yourself / Your
parent is told each time you send."* For Deniz: *"Your parent sends this one /
You're under 16, so we ask your parent to check the address and press send.
It's the same for every club."* — and the button reads **"Ask my parent to send
it"**, not "Send". Exactly right, and said in one sentence without a policy
paragraph.

**But he has to type the club's email address himself.** `[Their email address
· football@theclub.com.au]` with the hint *"From the club's own trial notice.
Check it's right — a wrong address just goes nowhere."* A fourteen-year-old who
arrived from a Riverside FC trial notice on our own board, on a club page we
host, with a contact route we hold, is asked to go and find an email address
and retype it — and is warned that if he gets it wrong the send silently
vanishes. This is the distribution engine and the last step of it is manual
transcription.

### The first season

By season's end the page is the thing he owns: **Football history** with three
clubs and a green dot on the current one, and the line *"Earlier clubs are
Nate's own account of where they played. Only the club at the top is one we
hold on Pitch."* That sentence is the whole product in twenty words, and it is
the reason the page survives a club change.

### Does it feel like his?

Yes, more than I expected — but it is his the way a good form's output is his,
not the way a profile he decorated is his. He chooses positions, their order,
which stats show, his clips, his sentence. He chooses nothing about how it
looks. There is one page, and every player's page is that page. For a first
season that is correct; by the second, the kid who has done everything has
nothing left to do.

**Alive:** the position chips numbering themselves; the stat tiles you can turn
off; the pitch diagram with his dot on it; "3 of 10 used"; the preview banner.
**Scrolled past without reading:** the footer legal line on every single screen,
the "What the club gets" three-bullet block on `/send` (read once, never again),
and the whole of the trials filter panel once I knew there were four trials.

---

## 2 · The parent, cold, suspicious, busy

Seat walked: the approval links `/a/dev-mila-text` and `/a/dev-mila-email`
signed out, then `/privacy`, `/terms`, `/privacy/family`, then Alex's guardian
seat.

### The first five minutes, in order

**`/a/dev-mila-text`** — the page a club's link actually lands on. It opens
better than anything else in the product:

> **MILA STARTED THIS AND ASKED YOU TO LOOK**
> **Approve Mila's page?**
> Mila is 13. Nothing is live until you say so.

Then four ticked cards: *"Mila will not appear in any search."* · *"No one can
contact them directly. Every approach comes to you together."* · *"You hold the
share link. It works only where you send it, expires every 90 days…"* · *"You
see everything they see."* Four promises, no hedging, fifteen seconds to read.
That is the best-written screen we have.

**Then the page falls over.** Directly beneath those four cards is a bordered
well headed *"The privacy policy we wrote for Mila / Your privacy on Pitch"*,
and the first words inside it, in bold, on the screen, are:

> ⚠️ v2.2, 3 September 2026 — this restores work that was lost, and the loss was
> my doing. On 1 September I filed pack v1.5, then revised it in place, keeping
> the same version number, so as not to create a phantom version. That made the
> second set of changes invisible.

A parent deciding whether a thirteen-year-old gets a profile is shown, as the
opening line of the policy written for her child, an internal incident
confession. Scrolling that well gives her, in order: a lesson written to a
colleague, *"Doc 21 · v2.5 draft · 15 September 2026 · **NOT YET PUBLISHED**"*,
*"Nothing here binds until BUZ numbers it in doc 06"*, an instruction — *"Publish
at pitchfootball.com.au/privacy/you. Link it from sign-up, from Build CV…"* —
and *"Do not let anyone tidy this into legal English"*, before it ever reaches
*"This page is for you, not your parents."*

**730 words of internal change log before the child's policy begins.** I
measured it.

It is not confined to the approval page:

| Screen | Words of internal change log before the document speaks | What she reads first |
|---|---|---|
| `/privacy` | **1,294** | "⚠️ v2.3 … the loss was my doing" |
| `/terms` | **1,401** | "⚠️ v1.6 … the loss was my doing" |
| `/privacy/family` | **730** | "⚠️ v2.2 … the loss was my doing" |

`/terms` also carries, in live product copy a club would read before paying:
*"This is a working draft written to be reviewed and corrected by a solicitor,
not to be published as it stands"*, *"suppression clause marked do-not-publish"*,
*"[LEGAL] — a question we cannot answer ourselves"*, and *"clause 8.3's plain
statement that an appeal is not independently reviewed."*

A suspicious parent's whole job on this screen is deciding whether we are
serious people. We hand her our internal notes about losing legal work and a
banner saying the document is a draft that is not published. **This is the
single most expensive thing in the product and it sits on the one screen the
entire consent funnel passes through.**

To be plain about what I am not saying: the policy text underneath is excellent
— *"We do not know your school. There used to be a box for it and we took it
away. Your school plus your age group would tell a stranger where you are on a
Tuesday morning."* A parent who reaches that sentence is converted. Almost none
of them will reach it.

**The rest of the approval flow is right.** The button is *"Yes, it's me —
continue"* after *"First, tell us this text reached you"*, and the email link is
a separate confirmation. Two channels, two presses, no auto-approve. I did not
press either, to leave Mila's fixture where the other seats found it.

### The first week

**`/home` as Alex — "Your family".** Three counters (`3 Links active`,
`0 Expiring in 30 days`, `7 Club registers`), then four **Waiting on you** cards,
each with a different sentence:

- *"Riverside FC would like Georgia at a trial — Georgia can see it too. Nothing
  goes back to the club until you approve a reply."*
- *"Nate wants to go on Riverside FC's register — There's a line about Nate, in
  Nate's own words. Read it before it goes — you can change it."*
- *"Georgia wants to send a CV to Sunbury United — Nothing has been sent. Check
  the address and it goes; do nothing and the request disappears on its own."*
- *"Deniz changed the page — Until you approve it, every club holding the link
  still reads the old version."*

Four items, four different stakes, four different sentences. No badge, no red
dot, no "1 unread". This is the screen that earns the trust the approval page
nearly lost.

**`/g/pending/…`** shows the old About and the new About stacked, with
*"You can edit the words before you approve them"* and *"Saying no leaves the
approved page exactly where it is."* A diff, for a parent, about a fourteen-
year-old's sentence. Nothing else in Australian junior sport does this.

**`/g/invite/…`** carries the line I would put on the website: *"Doing nothing is
a complete answer. They are told nothing either way."* And beneath "Not this
time": *"does not take Georgia off their register and does not count against
Georgia."*

### The first season

**`/g/controls/<child>` — Manage.** The payoff, and it is the strongest screen
in the product for anyone:

> **Who has read Deniz's registrations**
> Riverside FC · Registered 24 Sep 2026
> **Marina Petrovic · Technical director** · Opened the CV, last 24 Sep 2026 ·
> Saw it in the list, last 24 Sep 2026
> …
> Sunbury United · **Nobody at Sunbury United has read it yet.**

A named adult, their role, what they opened, when. Plus per-club **Switch off**
with the full address shown every time, Renew, Replace, a pause switch, and
**"Everything that's happened"** back to *"We were asked to set up their
profile"* on 20 June. No other product tells a parent who looked at their child.
**This is the value. It lands in week one and compounds all season.**

Two things in that timeline cost her:

- **"You changed the pause switch"** appears twice on the same day, with no time
  and no direction. Reading her own audit log she cannot tell whether she
  switched it on or off, or in which order. Every other row says what happened;
  the only row about a safety control does not.
- **"Someone outside Deniz's club asked to reach them"** sits in the timeline
  with no name, no date detail, no link and no button. It is the most alarming
  line on the page and the only one she cannot act on or find out more about.

And the four Waiting-on-you cards are stamped *"11 days ago"*, *"6 days ago"*,
*"3 days ago"* — but the child's own policy says a send request *"expires after
two weeks and is deleted"*. The card that is 11 days old is three days from
lapsing and does not say so. A busy parent's failure mode is exactly this.

### Where the screen does not deliver what we promise

A parent who signs up herself — the cold arrival we are designing for — lands
on the new-account home and reads:

> **"Adding a child, claiming a club page and building a player CV are not on
> this screen yet — tell us which you came for and we will point you at it."**

There is no way to tell us. No address, no button, no form on the page. The
sign-up screen at `/join` offers her a **"Parent / Guardian — Approve and see
their record"** chip; the account it creates cannot add a child and invites her
to contact a nobody. Three of our four personas are named in that sentence as
unsupported.

### Alive or form?

**Alive:** the four waiting cards; the About diff; "Doing nothing is a complete
answer"; the read receipts with Marina's name and role; the dead-link page,
which is the most self-assured screen we have — *"It may have been switched off,
it may have expired, or it may never have been a link at all. We don't say
which. That is deliberate."*
**Scrolled past:** the entire legal well on the approval page — I scrolled it as
a test, and a real parent scrolls past it or closes the tab; the three counters
on the family home (I never once needed "0 expiring in 30 days").

---

## 3 · The volunteer coach, Tuesday night, phone, car park, ten minutes

Seat walked: Sam Kaya, `coach@example.com`.

### The first five minutes

**`/home`.** Top card: **"Your coach page / Sam · Riverside FC /
pitchfootball.com.au/c/sam-kaya / Public · paste it wherever you talk to clubs
and families"** with a **Copy** button. Then **"Your page · 6 of 6 done / Every
part of your page is filled in."** Then four rows: Registrations for your teams
(**U14 Boys · U15 Girls** — names, never a count, as designed), Edit my coach
CV, See my public page, Coaching roles at clubs (2 open).

Five minutes is enough to copy the link and go. That is a real win and it is the
only thing on this seat that fits ten minutes in a car park.

**`/coach/edit`.** The best copy in the product: *"How you want to play … The
part a technical director actually reads, and the part a parent decides on. Say
it the way you'd say it at the coffee."* And on licences: *"These are your own
account and your page says so. We don't check them and they unlock nothing — the
only credential on your page a club confirmed is your Working With Children
Check."* A volunteer coach will believe that sentence and trust the rest of the
page because of it.

The photo field explains itself without a policy paragraph: *"We re-save the
image ourselves, which removes any location data the file was carrying."*

### The first week

**`/coach/register`.** Fourteen players across two teams: first name, positions,
their own line in quotes, **Open the CV**. Filters by team and position.

**And that is all he can do.** There is no field on this screen, or on any CV he
opens from it, in which a coach can write a single word. He watched these kids
for ninety minutes; he has ten minutes in the car; the product gives him a list
to read. The brief's own design constraint is *"one competency across a squad of
18 in under 90 seconds; resumable in 90-second chunks"* — that is Stage 2 and
correctly not built. But the consequence today is that **the coach seat has no
Tuesday-night job.** Everything on it is a Sunday-afternoon job: edit your CV,
copy your link, read a list, look at roles.

**`/jobs`.** "Clubs looking for coaches. Newest first — **nothing here is ranked
or recommended**." Two roles. The detail page is clean and the honesty is right:
*"They get your coaching CV and this message. They do not get your phone number
or your email address unless you write them above."*

**Two banned words are live on this seat.** `/jobs` carries *"**Applying** sends
the club your coaching CV and whatever you write"*, and the role page's button
reads **"Apply for this role"**. D-85/D-108 bars *application, applied* "for any
actor, on any surface". Whether the bar was meant to reach the coach jobs board
is BUZ's call, not mine — but as written it does, and the player-side vocabulary
("register interest") is enforced two screens away, which makes the jobs board
read as if it came from a different product.

### The first season

Publish, take down, republish — the link is stable and that is what a coach
needs, because he pastes it into emails that outlive the season. Nothing else
accumulates. By March his coach page is exactly what it was in September unless
he goes and edits it, and nothing in the product asks him to.

### Alive or form?

**Alive:** the Copy button with the real link beside it; "6 of 6 done · Every
part of your page is filled in"; "nothing here is ranked or recommended".
**Form:** `/coach/edit` is four stacked repeaters (roles, licences,
achievements) with Remove buttons — it is a good form and it is a form.
**Scrolled past:** the register, after the first read. There is nothing to do to
it.

---

## 4 · The technical director, laptop, 100 registrations, $54 a month

Seat walked: Marina, `td@example.com`, Riverside FC (verified), at 1280×800.

### The first five minutes

**`/home`.** Sidebar with eight items, crest block, **"Verified club"** in green.
Then four numerals: **100 On your register · 81 New · 13 Shortlisted · 6
Invited**, a primary row *"81 new on the register — Open a CV, shortlist, or
invite to a trial"*, the two upcoming trials, and the club page link with Copy.

He knows what he is looking at in four seconds. Good.

**`/club/register`.** A proper console — sidebar, content, a real table. The
reassurance line **"Every under-16 here was put on this register by a parent"**
is the right sentence in the right place. Three filter rows, every chip counted:
`All ages · 100`, `U14 · 9`, `No squad named · 13`, `New · 81`. Then the table,
grouped by squad.

Then I measured it:

| | |
|---|---|
| First player row begins at | **658px** down an 800px viewport |
| Players visible on the first screen | **1** of 100 |
| Full page height at 1280 wide | **9,628px — 12 screens** |
| Text inputs anywhere on the page | **0** |

**Seventy-one percent of the first screenful of our only paid surface is
chrome.** The stat block and three filter rows are handsome and they push the
product he is paying for below the fold. He came to work a list; he sees one
player.

**There is no search.** Not a box, not a field, nothing to type — I checked the
DOM. With 100 registrations and only first names in the table, there are already
**two players called Dara in the same age group**, three rows apart, both
`RB`. He cannot tell them apart without opening both CVs.

**The register opens on MiniRoos U9.** A TD working October trials for the 14s
and 15s scrolls past ten nine-year-olds to start.

### The first week — where it wastes his time, measured

Working a register means: read a line, open the CV, decide, shortlist, next.
I did that once and it costs him his place:

1. Scroll to a player — I was at `scrollY 2500`, roughly row 25.
2. Click **Open the CV**.
3. The CV opens: `Tobias · DM · RB · #15 · Right footed · Parent-approved`, one
   stat row, About. **There is no Shortlist button and no Invite button on the
   CV.** The only control is "The register", back.
4. Go back. **`scrollY` is 0.**

**Every single decision costs a full scroll back down a twelve-screen page.**
Eighty-one times, that is the difference between an evening's work and a task he
abandons. For the one persona who pays us, this is the most expensive thing in
the product after the legal pages.

The CV he opens is also thin for the decision he is making: first name, no
surname or initial, no age or birth year, no birth-quarter marker, no squad he
registered for, no date he registered. Everything that distinguishes one Dara
from another is on the row he just left.

And there is nowhere to write anything. He watched a trial on Sunday; on Tuesday
the product remembers three statuses — New, Shortlisted, Invited — and nothing
he thought. The club-side note exists on the registration row in the schema; it
is the player's own line that renders in the "Their line" column.

### What genuinely saves him time

**`/club/post-trial`.** Title, age groups as chips (nine common, ten more behind
"More age groups"), competition, date, time, ground, positions short of — and
*"Goes on your club page and on the trials board the same minute."* One form,
two places, no email to the league. That is real, it is week one, and it is
better than what he does now.

**`/club/invite/<id>`.** *"Into Goran's Pitch account and their parent's. Not an
email, not a text. … If they ignore it, you are told nothing. Silence is an
allowed answer."* A TD who has spent years chasing parents will read that and
understand the trade instantly.

**`/club/squads`** — *"These are the squads families choose from when they
register interest, and the groups your register is sorted into."* One sentence
that explains why he should bother filling it in.

### `/club/billing` — where the treasurer stops

The whole page:

> **The Interest Register**
> Riverside FC. Your club page, your trial notices and CVs arriving by email are
> free and stay free.
> **Your plan · $54 a month**
> Manage or cancel this subscription
> *Cancelling lives here in your club settings and takes about as long as signing
> up did. This charge shows on your statement as PITCH FOOTBALL.*

No next charge date. No card on file. No charge history. **No tax invoice** —
and our own Terms say a GST-registered supplier issues them, and D-137 says the
receipt is addressed to the club so a treasurer can be reimbursed. A committee
treasurer asked to approve $648 a year opens this page and finds one number and
a cancel link. The disclosure discipline (D-136) is honoured; the accounting is
not there.

### The unverified club — `sunbury@example.com`

The held register is exactly what was promised and I want it on the record as a
success:

> **4 waiting**
> Registrations are held until your club is verified — a short phone call with
> us. You'll see the list, and nothing about anyone under 18 reaches any club
> before that call. **Paying doesn't change it and can't.**

A count, not one name. The sidebar reads *"Awaiting verification — registrations
are held"* in amber.

**But the only other control on the page is "Back".** The screen names a phone
call and gives him no way to have it — no number, no address, no "book a time",
no "we will ring you within X". A club that has just claimed its page, possibly
paid, and has four families waiting, is told to wait for a call it cannot
request. At laptop width that screen is about 85% empty background.

### Alive or form?

**Alive:** the four numerals on club home; the counted filter chips; the amber
held-register banner; the invite screen's "Silence is an allowed answer".
**Form:** post-a-trial and squads, both fine.
**Scrolled past:** the whole stat-and-filter block on the register after the
first visit — and I had to scroll past it 81 times.

---

## Findings, ranked by what they cost that person

### The parent

1. **Every legal surface opens with our internal change log.** `/a/dev-mila-text`,
   `/a/dev-mila-email`, `/privacy` (1,294 words), `/terms` (1,401), and
   `/privacy/family` (730) all begin with *"⚠️ … the loss was my doing"*, and
   carry *"NOT YET PUBLISHED"*, *"Nothing here binds until BUZ numbers it in doc
   06"*, *"a working draft … not to be published as it stands"*, *"suppression
   clause marked do-not-publish"* and *"[LEGAL] — a question we cannot answer
   ourselves"*. Cost: the tab. This is on the approval page the entire consent
   funnel passes through. Nothing else on this list matters if this stays.
2. **A parent who signs up herself hits a dead end on screen one.** New-account
   home: *"Adding a child, claiming a club page and building a player CV are not
   on this screen yet — tell us which you came for and we will point you at it"*
   — with nothing on the page to tell us with, and a "Parent / Guardian" chip on
   `/join` that leads there.
3. **Waiting-on-you cards show age, not deadline.** "11 days ago" on a request
   that expires at 14 days and is then deleted. The failure mode is silent.
4. **"You changed the pause switch"**, twice on one day, no time, no direction —
   the only unreadable row in an otherwise exemplary audit log.
5. **"Someone outside Deniz's club asked to reach them"** — the most alarming
   line in the timeline and the only one with no detail and no action.

### The technical director

1. **Back from a CV returns to scroll position 0.** 81 new registrations ×
   a 12-screen page. Compounded by there being no Shortlist or Invite control on
   the CV itself, so the round trip is mandatory for every decision.
2. **No search on a 100-row register.** Zero text inputs on the page; two
   players named Dara, same age group, same position, three rows apart.
3. **One player visible on the first screen** (first row at 658px of 800). The
   paid surface is below the fold on the seat that pays.
4. **Nowhere for the TD to write anything.** Three statuses and no note; the
   "Their line" column is the player's words, not his.
5. **Billing has no invoice, no next charge date, no history** — against our own
   Terms and D-137's reimbursable-receipt reasoning.
6. **The held-register screen names a phone call and offers no way to request
   it.** Only control on the page: "Back".
7. The register CV omits everything that disambiguates a player — no surname or
   initial, no age, no birth quarter, no registration date, no squad.
8. Register opens on MiniRoos U9; no sort, and each player renders twice in the
   DOM (200 "Open the CV" links for 100 players).

### The fourteen-year-old

1. **He types the club's email address by hand**, warned that a wrong one
   "just goes nowhere" — after arriving from a trial notice on our own board,
   for a club whose page we host.
2. **The About placeholder is a number 10's sentence**, shown to a goalkeeper, a
   defender and every player who is not an attacking midfielder, in the one box
   where he has to describe himself.
3. **"5 of 6 done" never completes**, for every player, because the missing step
   is always the photo. The coach seat gets "Every part of your page is filled
   in"; the player gets a permanent nag.
4. **Four trials on the trials board.** Fixture depth, but the screen's entire
   first-week value is the count on it.
5. **His own preview ends with club-facing instructions about him**, third
   person, wrong pronoun: *"It goes to Nate and their parent together."*
6. The page is his to fill in, not his to make. Nothing on it is his choice of
   look, and by season two there is nothing left to do.

### The coach

1. **No Tuesday-night job exists.** Ten minutes in a car park buys him a list he
   can only read; every other action on the seat belongs to a Sunday afternoon.
2. **Banned words live on `/jobs`**: *"Applying sends the club your coaching
   CV"* and the button **"Apply for this role"** (D-85/D-108: "any actor, on any
   surface"). Whether the bar reaches the coach jobs board is BUZ's call.
3. Nothing on the coach seat accumulates across a season.

### Cross-cutting

- **"their" for a named individual** appears throughout the club and preview
  screens — *"Goran and their parent"*, *"It goes to Nate and their parent"*,
  *"Earlier clubs are Nate's own account of where they played"*. It reads as a
  template gap rather than as inclusive language, and it lands hardest on the
  screens where the reader is being asked to trust us with a specific child.
- **`.dev-ids.json` record ids are stale** against the running database. Not
  user-facing; it will cost the next seat time.

---

## BUZ's two tests, answered plainly

**"Does it serve its purpose and provide real value?"**

Yes, for two of the four, and the value is specific and it is not a
nice-to-have.

- **The parent gets something nobody else in Australian junior football gives
  her**: a named adult, their role, what they opened, when — plus a per-club
  off-switch, a diff of every change to her child's words, and a timeline back
  to the day we asked. It lands in week one and compounds all season. It is the
  reason to be here.
- **The kid gets a page he would genuinely send**, ten free clips, and a
  football history that survives the club changing. That lands in the first five
  minutes, at the preview.
- **The TD gets one real save — post a trial once, it lands in two places** —
  and then loses the time back on the register, which is the thing he pays for.
  Today he pays $54 a month for a list he cannot search, cannot annotate, and
  cannot work without losing his place every time he opens a CV. Net, in week
  one, I do not think it saves him time. By season it might, on trial-posting and
  invites alone.
- **The coach gets a stable public link.** That is real and it is the whole of
  it. There is no week and no season for this seat yet.

**Where we promise what the screen does not deliver:**
the held register promises a phone call and offers no way to get one; the new
account promises to point you at what you came for and has nothing to point
with; the Terms promise a tax invoice and billing shows none; and the approval
page promises a policy written for a thirteen-year-old and opens with an
engineer's incident note.

**"Interactive, layers, not just another app."**

In patches, and the patches are real: position chips that number themselves,
stat tiles you switch off, a diff of your child's own sentence, a held register
that shows a count and refuses the names, a dead-link page that tells you it is
refusing to tell you. Those are layers — the product behaves differently
depending on who is asking, and it says so on the screen.

The flat parts are the ones people spend the most time on: the register is a
long table, `/coach/edit` is four stacked repeaters, `/build` is a good form,
and everything below the fold on every screen is a form. The rule I would take
away is that **Pitch feels alive exactly where it shows you what somebody else
can and cannot see** — Marina's name in the read receipts, the amber "4
waiting", "Silence is an allowed answer", "We don't say which". Every one of
those moments is the permission engine made visible. Nothing else in the product
produces that feeling, and the screens that have none of it are the ones I
scrolled past.

---

*Read-only walk. No product code changed, no suite run, no database reseeded.
Any wording in this report marked as a suggestion is a suggestion; every quoted
string is verbatim from the running app at localhost:3000 on 24 September 2026.*
