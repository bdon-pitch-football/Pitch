# User seat: would anyone pay, and would anyone come back (28 September 2026)

Asked: four people — a technical director at $54 a month, a parent, a
fourteen-year-old, a volunteer coach. For each: what they get, what makes them
leave, what they expect and do not find. Then the two that matter: what is
missing that a person arriving from the real world assumes is there, and where
the product promises something the screen does not deliver.

Read-only. I changed no product code, wrote no product copy, ran no suite,
reseeded nothing shared. Every quoted string is verbatim from the running app
on 28 September 2026. Anything I suggest is marked as a suggestion.

## How I got in, and one thing the next seat needs

**Port 3000 was not listening** when I started (`curl` → no connection; nothing
in `lsof` on 3000). 54322, 54323 and 3030 were up. Rather than take 3000 or
54322 I ran my own pair, the way §4 of the training pack allows:

```
PITCH_DEV_DB_PORT=54334 node scripts/dev-db.mts
DEV_DB_PORT=54334 npx next dev -p 3110
```

**The two variables have different names, and that cost me a mistake worth
recording.** `scripts/dev-db.mts` reads `PITCH_DEV_DB_PORT` (line 674).
`lib/db.ts` reads `DEV_DB_PORT` (line 16). Following the instruction written in
`scripts/dev-db.mts` itself —

> `PITCH_DEV_DB_PORT=54332 node scripts/dev-db.mts` · `PITCH_DEV_DB_PORT=54332 npx next dev -p 3010`

— starts an app that ignores the variable and connects to **the shared
54322**, which serves one connection. I did exactly that for about two
minutes before I noticed (every seat rendered signed-out, because the person
ids I held did not exist in the database I had reached), and killed it. If a
builder lost their dev database connection around then, that was me. The fix is
Leo's call, not mine; the lesson is that the documented incantation is the one
that breaks isolation.

Seats walked: `td@example.com` (Marina, Riverside FC, verified, paying),
`kingsway@example.com` (Dana, verified, **not** paying), `sunbury@example.com`
(M., claimed, unverified), `admin@example.com` (Pat), `guardian@example.com`
(Alex), `nate@example.com` (16–17), Deniz (14, U15 — signed in by person id,
because no under-16 fixture has its own sign-in), `player@example.com` (Jordan,
adult), `coach@example.com` (Sam), `new@example.com` (Robin), and signed out.

**Every page I opened rendered.** The three redirects and one 404 I hit are
deliberate (recorded in their places below). No page failed.

Two builders are on the console breakpoint and the legal pages as I write, so I
have kept off layout measurements and I do not re-litigate the change-log
problem on the legal surfaces — it is unchanged and it is theirs.

---

## 1 · The technical director, $54 a month

### What he gets in month one that a spreadsheet and a WhatsApp group cannot give him

**Screen: `/club/register`.** Not the table — the sentence under it, which is
the product's own answer and is the correct one:

> **There is no download.** The register lives here, and a family who switches
> their link off disappears from it the same minute. A spreadsheet on someone's
> laptop could not do that.

That is the whole pitch in two sentences and it is true on the screen: 100
rows he never typed, each one a page the family maintains, each one revocable
by them. A spreadsheet is a photograph; this is a subscription to the truth.
Beside it, the line that sells the *year*:

> The keeper you haven't got room for in September is still on this list in
> March, when someone tears a hamstring.

**Second screen: `/club/post-trial`** — *"Goes on your club page and on the
trials board the same minute"*, plus *"It comes down by itself the day after
the trial, so nobody turns up to something that already happened."* One form,
two surfaces, self-expiring. His WhatsApp group cannot be read by a family who
is not in it, and his spreadsheet does not take itself down.

**Third: `/club/invite/<id>`** — *"Into Nate's Pitch account and their
parent's. Not an email, not a text… If they ignore it, you are told nothing.
Silence is an allowed answer."*

### But the $54 question is not spreadsheet-versus-Pitch. It is paid-versus-free.

I signed in as Dana at Kingsway Rovers — **verified, not subscribed** — and
this is what the free tier now does, on `/club/register`:

> **Interest in your trials**
> Players who registered interest in a trial you posted. **Invite any of them —
> it's free.**
> Georgia · CM · clips · U16–U18 and Seniors trials · Sun 25 Oct
> [Open the CV] [Invite to trial]

A free club posts a trial, receives the families who answer it, reads their
CVs, and invites them. **That is a complete recruitment cycle at $0.** What
$54 buys is named honestly two lines below:

> **The whole register is a plan**
> Everyone who registers interest in your club, all year — not only for a
> trial — with squads, filters and a shortlist.

So the paid product is the *standing* list. That is a real thing to sell. And
then:

**Paying makes one screen worse.** In `app/club/register/page.tsx` the
per-trial block is fetched only when the club is **not** subscribed:

```
const trialRows = c.club_state === 'verified' && !active ? … : [];
```

The day Riverside pays, "Interest in your trials" disappears. The people are
still in the register, but the register's filters are age, position and status
only (`searchParams: { pos, status, age }`) — **there is no trial filter**,
and `trial_tag` is selected into the row type on line 45 and never drawn. On
Marina's home the two October trials appear with no interest count; on Dana's
free home the trial reads **"1 interested"**.

Marina has two trials eleven and eighteen days out and **no screen in the
product answers "who is coming to the 11th"**. Dana, who pays nothing, has
exactly that screen. I looked for another route to it: no `/club/trials`, no
trial column, no trial chip, nothing in the sidebar (eight items, all walked).

### What makes him cancel in month three

1. **He cannot work the list.** `/club/register` at 1280 has **0 text inputs
   and 0 textareas** (I counted in the DOM, not by eye). No search on 100 rows.
   In this seed there are two players called **Dara** in the same age group,
   three rows apart, **both RB**, one with a line and one without, and nothing
   on either row or either CV distinguishes them: `created_at` is selected and
   never rendered, no age, no birth year, no birth quarter, no registration
   date, no squad they registered for. On the CV he gets the surname
   (`Nate Halloran` — an improvement since the 24th) and that is the only new
   fact.
2. **He still cannot write anything.** Three statuses (New, Shortlisted,
   Invited). The `note` column on the row is *the player's own line*, rendered
   in italics with quote marks. The only textarea on the whole club side is
   inside `/club/invite/<id>` — *"A line from you, if you want"* — which is a
   message to the family, not a note to himself. He watched a trial on Sunday;
   on Tuesday the product remembers nothing he thought. The `assessment_entry`
   and `growth_note` tables exist; migration 0015 says it plainly: *"the §D
   tests but no assessment screens"*.
3. **Every decision costs him his place.** The row now carries an inline
   **Shortlist**, which is real progress — but deciding means opening the CV,
   and `/club/register/cv/<id>` has three buttons and none of them is Shortlist
   or Invite. Back to a twelve-screen page, 82 times.
4. **He changed a trial and nobody was told.** `/club/post-trial` lists *"Your
   trials"* with a **Change** button, and `postTrial` does update the notice —
   good. But there is **no message in `lib/messages.ts` for a trial that
   changed or was cancelled** (I read the whole catalogue: 60-odd keys, nothing
   about a trial). He moves Sunday's ground, the twelve families who registered
   interest are told nothing, and half a squad drives to the wrong park. The
   month-three cancellation call is not about software; it is about that
   Sunday.
5. **The treasurer finds nothing to file.** `/club/billing`, paying, is still
   the whole page: *"Your plan · $54 a month / Manage or cancel this
   subscription."* No next charge date, no card, no history, **no tax
   invoice** — while the purchase screen he signed promises *"The receipt is
   addressed to the club, not to you, so it can be reimbursed without an
   argument."*
6. **The club is one person.** Pat, the club administrator at the same
   verified club, is redirected `/club/register → /home` (307, deliberate,
   D-154) and the item is absent from his sidebar. There is no
   `/club/people`, no seat management, nothing that moves the register to a new
   technical director when Marina leaves — the TD is recorded on the
   verification call (`verification_call.td_name`), reachable only from
   `/ops/call/<clubId>`. A club that pays annually and loses its TD in March
   has bought a login it cannot recover without ringing us.

### What he would expect to be here and is not — and where I looked

I went looking rather than guessing. Routes are from `find app -name page.tsx`
(59 pages), every club sidebar item opened, every filter followed.

| He expects | Where I looked | What is there |
|---|---|---|
| A search box | `/club/register` DOM, all three filter rows | 0 inputs, 0 textareas |
| "Who is coming to this trial" | `/club/register`, `/club/post-trial`, `/home`, sidebar, route list | Free tier only; no trial filter; `trial_tag` unrendered |
| A note on a player | every club screen; `assessment_*`, `growth_note` tables | Schema only ("no assessment screens", migration 0015) |
| A tax invoice / charge history | `/club/billing` both tiers | One price, one cancel link |
| Export or print of a shortlist | `/club/register` footer | Refused on purpose, and said so ("There is no download") |
| A second seat / handover | routes, `/club/roles`, `/club/squads` | None; TD recorded on the ops-side call |
| Telling registrants a trial moved | `lib/messages.ts` (whole catalogue) | No such message exists |
| Age or birth year on a CV | `/club/register/cv/<id>` | Squad grouping only |

One I expected to find missing and did not: he is **never told that his reads
are shown to the parent by name**. The parent's screen says *"Marina Petrovic ·
Technical director · Opened the CV, last 28 Sep 2026"*. The coach's screen
discloses it to the coach — *"every registration you open is recorded"* —
`/club/register` and the club CV say nothing of the kind; the only mention is a
comment in the source. I think that is a disclosure gap on the seat that pays,
and it is a safety-review call, not mine.

### Would he pay?

Not today, literally: the purchase screen ends **"Payments not switched on
yet"** (Stripe deferred, BUZ's call). When it is on: yes, but only for the
standing register and only if he can work it. Right now the free tier does his
October and the paid tier gives him a longer list, no search, no notes, no
per-trial view and no invoice. **In month one the free tier is the better
product for a club that only recruits at trials** — which is most clubs.

---

## 2 · The parent

### The moment she decides it is safe

`/a/dev-mila-text`, the page a club's link lands her on, in the first fifteen
seconds — four ticked cards, no hedging:

> **Mila started this and asked you to look** · Mila is 13. Nothing is live
> until you say so.
> Mila will not appear in any search. Under-16 profiles are not searchable on
> Pitch at all. · No one can contact them directly. Every approach comes to you
> together. · You hold the share link… expires every 90 days… · You see
> everything they see.

Still the best-written screen in the product. Two channels, two presses, no
auto-approve.

### The moment she decides it is worth her time

A different moment, weeks later, on `/g/controls/<child>`:

> **Who has read Deniz's registrations**
> Riverside FC · Registered 28 Sep 2026 · **Marina Petrovic · Technical
> director** · Saw it in the list last 28 Sep 2026
> Sunbury United · **Nobody at Sunbury United has read it yet.**
> Only people a club has named can read its register, and every time they do,
> it's recorded here.

A named adult, their role, what they opened, when — plus per-club **Switch
off** with the full address shown, Renew, Replace, a pause switch, and
*"Everything that's happened"* back to *"We were asked to set up their
profile"*. Nothing else in Australian junior football does this.

**They are not the same moment, and the gap between them is the product's
biggest commercial problem.** Safe is minute one and it is free. Worth-my-time
requires a stranger at a club to have opened her child's CV — an event she
does not control, may wait months for, and **is never told about**.

### What she gets in week six

I read the whole of `lib/messages.ts` and the only recurring senders in
`app/api/jobs/daily/route.ts`: `linkRenewalEmail`, `linkExpiringToClubsEmail`,
`pendingNudgeSms`, `sixteenthBirthdayEmail`.

**There is no message for "a club read your child's CV."** The single feature
that earns this product its place is pull-only. Deniz's link was made on 28
September and expires 27 December; the renewal email goes a week before —
**week twelve**. The 16th-birthday email is a genuinely lovely re-entry point
(*"turns 16 next month — one thing changes, and you choose"*) and it fires
once per child per lifetime.

So in week six: her four Waiting-on-you cards, if her children did something.
Otherwise nothing has happened, nothing has arrived, and the read receipts she
would care about sit on a screen she has no reason to open. She does not
churn — there is nothing to cancel — she simply stops visiting, and the pause
switch and the off-switch stop being used because nobody is looking.

Also unchanged from the 24th: the cards are stamped **"11 days ago"**, **"6
days ago"**, **"3 days ago"**, and the child's own policy says a send request
expires at fourteen days and is then deleted. The 11-day card is three days
from lapsing and does not say so.

---

## 3 · The fourteen-year-old

### Would he show it to a friend?

Yes — the preview at `/build/<record>/preview` and the public page at
`/p/dev-deniz` are genuinely good: the pitch diagram with his dot on it, the
ghosted squad number, three stat tiles he chose, clips with play buttons,
**Football history** with a green dot on the current club, a print view
(`/p/dev-deniz/print`, "Save as PDF") that is new since the last walk and is
exactly what you hand a scout on a clipboard.

And there is now a deliberate way to show people: `/share-card/<record>` —
*"Pitch makes you a card. You post it wherever you like — Instagram, Snap, a
group chat, anywhere"*, with *"Not your club, not your age group, not where you
live, not your face"* and *"No link back to your page. Someone who likes it has
to come and find Pitch themselves."* The restraint is right and I would not
touch it.

**But he never sees the card.** He picks between three words (Story · Square ·
Landscape), reads four bullets about what is on it, and presses **"Ask my
parent to approve it."** The renderer exists at
`app/g/card/[cardId]/image/route.tsx` — behind the *parent's* approval URL.
The one screen in the product whose entire subject is how something looks shows
the person making it nothing at all.

### Would he still be here next season?

**For an under-16 there is no reason to come back.** I want to be exact about
why, because it is not a bug and it is not laziness:

- His home has no read receipts. `app/home/page.tsx` line 641:
  `me.band !== 'u16' && …` with the comment *"doc 34 rule 6 (0047): a player
  16 or over sees who read their registrations; an under-16's parent sees it on
  their controls."* Nate (16) opens his phone and reads **"Marina Petrovic ·
  Technical director · Opened the CV last 28 Sep 2026"** — a technical director
  at a real club read his CV. Deniz (14), whose registration Marina also read
  in this same seed, sees nothing of it on his own home screen. **The one
  mechanic on the permitted list — who has read what — is switched off for the
  seat that would check it hourly.**
- No notification of any kind reaches a child except the parent-approval loop.
- `/trials` holds four notices and has no saved filter and no alert, so a
  keeper checking for a keeper's trial must keep coming back to a page that
  changes when a club we have not signed yet posts something.
- **The record does not grow.** `app/build/[recordId]/actions.ts` writes every
  stat with `season: '2026'`, and `components/cv/PlayerCV.tsx` renders
  `p.stats.filter((s) => s.season === '2026')`. There is no way to add a
  season, no way to see a past one, and in March 2027 his 2027 numbers
  overwrite his 2026 ones in place.

A suggestion, not a change: the permitted axis is already sitting there. An
under-16 seeing *"a club opened your page this week"* with no name — the club
is already on his screen as "You are on their register" — would give him the
one honest reason to return, and the parent keeps the names. That is BUZ's
call.

### What would embarrass him

- **The About placeholder is still a number 10's sentence** — *"Right-footed 10
  who plays between the lines. Working on my weak foot and pressing
  triggers…"* — shown to a goalkeeper, a centre-back and every kid who is not
  an attacking midfielder, in the one box where he has to describe himself.
- **"5 of 6 done" still never finishes**, for every player fixture I opened
  (Deniz, Nate, Jordan), because the missing step is always the photo. Sam the
  coach gets *"6 of 6 done · Every part of your page is filled in."*
- **His own preview still ends with instructions about him, to somebody else,
  in the third person with the wrong pronoun**: *"If you want Deniz at a trial…
  It goes to Deniz and their parent together, and a record is kept."*
- **He has to type the club's email address by hand.** This is the one I would
  fix first, because the product knows the answer. `/fc/westgate-rangers`
  offers **"Send my CV to Westgate Rangers"**; it links to plain
  `/send/<record>` with no club carried (the page accepts
  `asked | sent | error | off | link` and nothing else), so he arrives at an
  empty form: *"Club"*, *"Their email address"*, and the hint *"From the club's
  own trial notice. Check it's right — a wrong address just goes nowhere."*
  Our own row for that club holds
  `contact_email = 'secretary@westgaterangers.example.au'`
  (`scripts/dev-db.mts:551`), **and our listing of that club's trial shows no
  address at all** — so the notice he is told to read it from does not contain
  it. A fourteen-year-old is asked to guess, and warned that a wrong guess
  vanishes silently.

---

## 4 · The volunteer coach, against the promise

The brief, `CLAUDE.md` line 173, is specific:

> **the free coach tier stays complete for a volunteer** (coaching CV, one
> squad, assess your players, share sessions to that squad, jobs board) and is
> never shaved to drive conversion

| Promised | In the product | Evidence |
|---|---|---|
| Coaching CV | **Yes** | `/coach/edit` → `/c/sam-kaya`, public, with Copy; *"6 of 6 done"*; licences carry *"We don't check them and they unlock nothing — the only credential on your page a club confirmed is your Working With Children Check"* |
| One squad | **Partly, and not his** | `/coach/register` lists 14 players across **two** teams the club assigned him ("For the teams your club brought you in for"). He cannot create a squad, add anyone, or hold one that survives the club's decision |
| Assess your players | **No** | No screen anywhere. `competency`, `assessment_block`, `assessment_session`, `assessment_entry` exist; migration 0015: *"the §D tests but no assessment screens"*. D-160 (28 Sep) settled how a coach-verified stat is attributed — register only, no code |
| Share sessions to that squad | **No** | No screen, and **no table**: I listed every table in `supabase/migrations` — there is nothing for a session, a plan or a resource |
| Jobs board | **Yes** | `/jobs`, *"nothing here is ranked or recommended"*; `/jobs/<id>` with **"Put your name forward"** and **"Send it to Riverside FC"** |

**Two of five, one partly, two absent.** Worth saying plainly: the promise is a
*Stage-2* promise and nothing here is behind a paywall, so nothing has been
"shaved to drive conversion" — but a volunteer coach arriving today is handed
the two things that are about *him* (his CV, his next job) and none of the
three that are about *his players*.

Credit where it is due: the banned words are gone from this seat since the
24th. `/jobs` now reads *"This sends the club your coaching CV and whatever you
write"* and the button is *"Send it to Riverside FC"*. The coach register also
now discloses *"every registration you open is recorded"* — the sentence the
club console still lacks.

His week: `/coach/register` is 14 names, positions, the player's own line, and
**Open the CV** — *"You can read these. Inviting a family is for your technical
director."* There is still no field on this seat in which a coach can write one
word about a player. **He still has no Tuesday-night job**, and after he puts
his name forward for a role, no screen ever tells him what happened — the club
sees applicants and can **Close** the role; `/jobs/<id>` only remembers that he
sent. Nothing accumulates: in March his page is what it was in September.

---

## What is missing that a user would expect

Ranked by how early a real arrival hits it.

1. **A way to say who you are when you arrive.** Robin's home, unchanged:
   *"Adding a child, claiming a club page and building a player CV are not on
   this screen yet — tell us which you came for and we will point you at it"* —
   with nothing on the page to tell us with, while `/join` offers **Parent /
   Guardian — Approve and see their record** as one of four chips. A parent
   cannot start. Three of four personas are named on that screen as
   unsupported.
2. **A club chooser on `/send`.** We host the club pages, we hold the
   addresses, we published the trial notice — and the last step of our
   distribution engine is manual transcription by a child.
3. **A search box on a hundred-row paid list.**
4. **Anywhere for a club-side adult to write down what he saw.** Every seat
   asks for it: the TD after a trial, the coach after a session. The schema
   has been waiting since migration 0002.
5. **Being told when the thing you came for happens.** No message exists for
   "a club read your child's CV" (parent), "a club read your page" (player),
   "a trial you registered interest in has changed" (family), "the role you
   put your name forward for was filled" (coach). The product has an outbox, a
   daily cron and a consent event spine; it uses them for expiry and birthdays.
6. **A second season.** The tagline in `app/layout.tsx` is *"Pitch Football —
   every season on the record."* The stats table is keyed by season. The app
   writes and reads the string `'2026'`.
7. **A way to have the phone call we insist on.** `/club/register` unverified:
   *"Registrations are held until your club is verified — **a short phone call
   with us**"* — and the only control on the page is **Back**. No number, no
   booking, no "we ring within X". Four families are waiting on that screen.
8. **An invoice.**

---

## Where the product promises what the screen does not deliver

**1 · The free tier's two free things do not exist for the club that has just
arrived.** `/club/billing` as M. at Sunbury United (claimed, unverified):

> Sunbury United. **Your club page, your trial notices and CVs arriving by
> email are free and stay free.**
> Choose how you pay · $54 a month …

On the same account: `/club/post-trial` → **307 to `/home`** (deliberate), and
`/fc/sunbury-united` → **404** (it has no `public_slug`). The screen that
offers to charge him $54 a month names two free things he does not have, and
the screen that would let him earn them offers him a phone call he cannot
request.

**2 · "The receipt is addressed to the club, so it can be reimbursed without
an argument."** Verbatim on the purchase screen. `/club/billing` on the paying
club shows no receipt, no invoice, no charge history and no next charge date.

**3 · "We do not know your school."** The child-directed policy, rendered
inside the approval page the whole consent funnel passes through and at
`/privacy/family`:

> **We do not know your school.** There used to be a box for it and we took it
> away. Your school plus your age group would tell a stranger where you are on
> a Tuesday morning. It is not worth it. You can add it when you turn 18.

`/p/dev-deniz`, opened **signed out**, holding nothing but a link:

> Deniz Yılmaz · AM · LW · #10 · **Riverside FC — U15 Boys · Brunswick VIC**
> … Other football: **school · Northcote High 1st XI · 2026**

And `/build/<record>/more`, as the fourteen-year-old, offers **School** as the
first "Kind" chip. The schema comment is honest about the intent — *"Deliberately
ABSENT (D-114): any school field. School football lives in [experience_entry]"*
— but from the reader's side there is no difference between a school box and a
school entry: the stranger holding the link learns the school, the age group
and the suburb, which is the exact combination the policy names and refuses.
The policy says the box was taken away; the screen shows the school. **Not my
lane to resolve — this is `tech-safety-review` and BUZ, and it is the one
finding in this report I would move before any other.**

**4 · "Pitch makes you a card. You post it wherever you like."** `/share-card/<record>`
shows no card. The renderer lives behind the parent's URL.

**5 · "Her word · on a player's page."** The live pre-launch homepage
(`app/page.tsx` → `ComingSoon`) shows a coach's phone with
*"Deniz — two seasons, never missed a session. Reads the game early."*, and
tiles reading **11 SEASONS · 9 SQUADS · 140 PLAYERS**. A coach's word on a
player's page does not exist in the product — no assessment screen, no note
field, no coach comment anywhere — and D-160, decided today, is a register
entry with no code behind it. This is the copy that is collecting the waitlist.

**6 · The trials board's own instruction.** *"From the club's own trial notice.
Check it's right"* — our trial notices carry no address.

---

## The two answers, plainly

**Would anyone pay?**

The parent would, and she is not asked to. The read receipts are the only
thing in this product that nobody else in Australian junior football sells,
and they are given away to the person who values them most while the invoice
goes to the person who values them least — the club, for whom being read is a
cost, not a benefit.

The club will pay, but today the free tier is the better club product for
October, because it has the one screen a TD actually needs in trial season and
the paid tier removes it. **Payments are not switched on**, so the honest
present-tense answer is that nobody can.

**Would anyone come back?**

- **Parent:** she has a reason and the product never gives it to her. Nothing
  in six weeks tells her a club looked. Fix that one message and this seat
  compounds all season.
- **16–17 and adult player:** yes, and it is new since the last walk — read
  receipts on his own home screen, with a named technical director on it. That
  is the best come-back mechanic in the product and it is entirely inside the
  rules.
- **Under-16 player — the fourteen-year-old this product is built around:
  there is no reason to come back.** Once the page is approved his home screen
  is static, he is shown no reads, no alerts and no new season, and the only
  thing that ever changes is a nag to add a photo. Every mechanic that would
  bring him back exists in this product already and is pointed at somebody
  else.
- **Volunteer coach: there is no reason to come back** between the day he
  copies his link and the day he wants another job.
- **TD:** a reason to come back every Sunday in trial season, and a list he
  cannot search, annotate, or hold his place in.

The rule from the last walk still holds and today it has a price attached:
**Pitch is alive exactly where it shows you what somebody else can and cannot
see.** The product's problem is not that it lacks a feed. It is that it has
built the best read-receipt machine in junior football and shows it to three
people out of five.

---

## Risks and what I did not check

- I ran on **my own database on 54334 and app on 3110**, freshly seeded, so
  anything seed-dependent (the two audit-log rows the 24 Sep walk flagged, the
  *"Someone outside Deniz's club asked to reach them"* line) did not reproduce
  and I make no claim about them.
- **No layout or density measurements**, deliberately: the console breakpoint
  is being changed as I write.
- I did not press a single mutating button on any seat — no approvals, no
  sends, no shortlists, no upgrade — so every flow past the first screen is
  read from the screen and the action code, not walked.
- The legal change-log problem is unchanged on `/privacy`, `/terms`,
  `/privacy/family` and both `/a/…` approval pages. Not re-litigated here.
- One tooling defect recorded for Leo: `PITCH_DEV_DB_PORT` (db) versus
  `DEV_DB_PORT` (app), with the wrong pair documented inside
  `scripts/dev-db.mts`.

*Read-only walk. No product code changed, no product copy written, no suite
run, no shared database reseeded, port 3000 and 54322 untouched.*
