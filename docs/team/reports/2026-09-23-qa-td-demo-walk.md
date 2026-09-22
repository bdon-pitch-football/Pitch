# QA: the TD's journey through the club demo (23 Sept 2026)

**Asked:** walk the Balmoral FC demo on `localhost:3030` as a sceptical technical
director would, at 1280 and then 375, and say every place it looks wrong, thin
or confusing before BUZ demos it tomorrow. Read-mostly; report, never fix.

**Did:** no product code, no repo file and no migration was touched. The only
things I wrote are three throwaway harnesses in the session scratchpad — a page
walker (cookie jar + HTML-to-text), a register-row parser, and a width check
cribbed from `scripts/layout-check.mjs` with its self-test kept (L19). Nothing
was added to the suite. I clicked through flows, which mutates: one shortlist,
two trial invitations, one family self-removal (below).

**Measured on:** `http://localhost:3030`, Balmoral FC. **Not one tree.** The demo
on 3030 was taken over and reseeded three times while I walked it (F1), so:

| When | Served from | What I measured there |
|---|---|---|
| 07:35–07:41 | BUZ's demo (pid 17649) | public club page, first look |
| 07:42–07:57 | worktree `agent-a80be822d0ce359f7` (pid 39061), club **verified + subscribed** | the whole TD journey, 50 CV opens, all counts, both widths |
| 07:58 → | same worktree (pids 21217 then 27738), club **unclaimed** (`--unclaimed`) | trials board, unclaimed club page, claim screen |

Product code in that worktree is byte-identical to the repo for every file I
cite (`components/cv/PlayerCV.tsx`, `app/club/register/page.tsx`,
`app/club/squads/[squadId]/page.tsx`, `supabase/migrations/0054_squad_safety.sql`).
`scripts/demo-layer.mts` and `scripts/dev-db.mts` differ — the worktree's
demo-layer is 641 lines against the repo's 272 — so **every data finding below
is against the builder's in-progress demo, not BUZ's**, and the two data
findings I could re-measure after the last reseed (F5, F13) were still there.

**Ran (counts, not adjectives):**

| Suite / walk | Count |
|---|---|
| Width check, real Chrome, TD seat, 1280px | 12 views, 0 overflowing |
| Width check, real Chrome, TD seat, 375px | 12 views, 0 overflowing |
| Width-check self-test (L19) | fails as designed: 600px page measured 608px on a 375px screen |
| Register rows parsed off the served HTML | 100 rows, 11 squad buckets |
| Register CV pages opened | 50 loads, 44 distinct players |
| Register filters exercised | 11 (`pos` ×3, `status` ×3, `age` ×2, two combined, two invalid) |
| Filter arithmetic | every filtered count matched its chip; 82+12+6 = 100 |
| Club-side write actions | 1 shortlist, 2 invitations (counters moved correctly each time) |
| Family-side removal | 1 — register went 100 → 99 and the open CV link died |
| Seats walked | TD, club administrator, coach, parent, adult player, signed out |
| Seat I could not walk | unverified / held club — **no such seat exists** (F15) |
| Tap targets under 44px | 3 per page at 1280, 1–3 at 375 (banner + footer links) |

---

## Findings, worst first

### F1 · The demo does not stay up. Three takeovers and a dead minute in 25 minutes of walking — **showstopper**
**Page:** all of them.
The demo on 3030 is not being served from BUZ's repo. It is served from
`repo/.claude/worktrees/agent-a80be822d0ce359f7`, and `scripts/demo.mjs`'s
`takeOver()` kills whatever is holding 3030 and 54323 and replaces it. Process
start times: 07:35 (pid 17649) → 07:41:55 (39061) → ~07:58 (21217) → 27738.
At 07:59 the port refused connections outright for about a minute.
Every takeover is a fresh in-memory seed: **every id changes, every session is
signed out, and everything the TD did in the meeting disappears.** I watched my
own TD session become invalid mid-walk and land on `/signin`.
The machine is also at 100% disk — free space measured at 871 MiB, then 268 MiB,
then 4.0 GiB, and it hit **zero** at 07:41 (every shell call returned ENOSPC for
several minutes, which is the same moment the demo first died).
**What a TD would think:** nothing, if it holds. If it goes at the wrong moment
he watches the founder get logged out of his own product and lose the shortlist
he just built.
**Fix belongs to:** whoever is running the builder. One demo per machine, and
free disk on that laptop before tomorrow.

### F2 · An adult sits inside the under-13 girls' list — **showstopper**
**Page:** `/club/register`, and the CVs underneath it.
The register groups by the squad the family named. In a sample of 34 CVs I found
three whose CV renders the **18+** layout (no "Parent-approved" chip, no "there
is no way to reply" block — `components/cv/PlayerCV.tsx:101`, `isMinor = p.band
!== '18plus'`, so this is the permission layer's own answer, not a guess):

- **Maeve Mensah — adult — in "U13 Girls"**
- **Rania Kowalski — adult — in "U17 Girls"**
- **Xavier Tran — adult — in "MiniRoos U9"** (found in a separate pass over all ten U9 rows)

Conversely the "U21 Men" bucket held four minors in the same sample.
**What a TD would think:** "There is a grown woman in my under-13 girls list."
On a child-safety product that is the one sentence you cannot recover from in a
meeting. He will not care that the family typed the squad.
**Most likely responsible:** the demo seed assigns `registration.squad_target`
without reference to `fn_age_band(person.dob)` — `scripts/dev-db.mts` (worktree
copy), the block that creates the 96 background registrations.

### F3 · The register's one written line is blank on half the rows and repeats on the rest — **looks amateur**
**Page:** `/club/register`, the "Their line" column. Parsed from the served HTML,
all 100 rows:

- **45 of 100** rows show `—`.
- The other 55 carry **7 distinct sentences between them.**
- "Left-footed, comfortable either side." appears **16 times**; "Moved to the
  area in July. Looking for a club." 11; "Played every game last season. Want a
  step up." 10; "Plays in front of the back four. Two seasons at this level." 9.
- Two of them land adjacent in the same bucket: MiniRoos U9 rows 2 and 5 are both
  "Left-footed, comfortable either side."

**What a TD would think:** "These are not real people." It is the only column on
the screen that is supposed to be a human voice, and it is a four-line rotation.

### F4 · Open ten CVs and you have read three — **looks amateur**
**Page:** `/club/register/cv/[registrationId]`. 50 loads, 44 distinct players:

- **0 of 44 had a profile photo** (only Deniz, a house fixture, has one). Every
  other CV opens on a two-letter initials block.
- **15 distinct "About" paragraphs across 34 sampled CVs**; the most common
  appears 5 times.
- **15 of 34** carry the identical highlights block: "Goals and assists, 2026 /
  Goals, assists & link play".
- **24 of 34** have no achievements at all.
- Every player's current club is one of exactly **three** (Westgate Rangers
  Altona ×11, Northern United Preston ×11, Coburg City Coburg ×10), and every
  previous club is one of three.

The keepers are the worst case. Pia Novak, Jarrah Osei and Cormac Osei open with
the **same About, same current club, same previous club, same clip title** —
only the numbers and the names differ. Two of them share a surname.
**What a TD would think:** "You have generated this." Which is true, and fine —
but he is being sold the depth of the register, and the depth is three people
wearing ninety-six names.
**Most likely responsible:** `scripts/demo-layer.mts` `enrichRegistrants()` —
`ABOUT_GK` has 3 entries, `CURRENT` 3, `PREVIOUS` 3, and all three are indexed
on `i % 3`, so any two players sharing `i mod 3` are identical in all three.

### F5 · A trial that says "Sun 9:00 AM" falls on a Thursday — **looks amateur**
**Page:** `/fc/balmoral-fc`, `/trials`, and the TD's `/club/post-trial`.
The club page card reads **"OCT 15 · U14 & U15 Boys trials · Sun 9:00 AM"**.
15 Oct 2026 is a **Thursday**. The TD's own console names the same notice
"**Thu** 15 Oct". The trials board does it twice more — "OCT 16 · Westgate
Rangers · **Mon** 5:30 PM" (16 Oct is a Friday), "OCT 22 ... **Sun** 10:00 AM"
(a Thursday).
**Why:** `scripts/dev-db.mts:438` seeds `trial_on = '2026-10-11'` (a Sunday) with
the weekday baked into the free text `time_venue = 'Sun 9:00 AM · …'`;
`scripts/demo-layer.mts` then shifts `trial_on` by the days since 19 Sept and
never touches the text. The drift grows one day per day: **tomorrow it reads
"Sun 9:00 AM" on Friday 16 Oct.**
**What a TD would think:** community trials are on weekends. He will spot this
in two seconds and it makes him doubt the dates on every other screen.
Re-measured after the last reseed at 08:00 — still wrong.

### F6 · A CV never says how old the player is — **looks amateur, arguably a showstopper for the sale**
**Page:** every `/club/register/cv/…`.
In 44 distinct CVs, **not one carried an age, a date of birth, a birth year or a
birth-quarter marker.** The only age signal on the page is the squad name in the
club line, and that exists only for the two players who are in a Balmoral squad
(Deniz "— U15 Boys", Nate "— U18 Boys"). For the other 42 the club line is just
"Northern United SC · Preston VIC".
The register list does not carry it either; the age-group chips describe the
squad the family named, which F2 shows is not the player's age.
**What a TD would think:** "How old is he?" is the first question about every
player alive, and the product's answer is a squad name typed by a parent. He
will ask it out loud, tomorrow.
*(Stated as a TD's judgement, not as a defect: D-25 minimisation may be why. If
the answer is "the age band is derivable and we choose not to show it", that is
worth a sentence on the screen rather than silence.)*

### F7 · Ten of eleven squads say "0 playing", and "Who plays" offers under-9s to the senior women — **looks amateur**
**Page:** `/club/squads`, `/club/squads/[squadId]`.
Counts straight off the page: MiniRoos U9 "10 registered · **0 playing**", U13
Boys 5/0, U13 Girls 12/0, U14 Boys 9/0, U15 Boys 6/**1**, U15 Girls 5/0, U16
Boys 6/0, U17 Girls 9/0, U18 Boys 11/0, U21 Men 14/0, Seniors Women 0 playing.
The club has 100 registrations and **one** player in a squad.
Underneath, "Ask someone from your register" shows **60 rows on every squad —
the same 60**, whatever the squad is. Seniors Women is offered Amir and Arlo
from the junior register; MiniRoos U9 is offered the same 60. Only the handful
who named that squad are marked "asked for this team" (U15 Boys 6 of 60, U13
Girls 12 of 60, MiniRoos U9 10 of 60, **Seniors Women 0 of 60**).
**Where:** `app/club/squads/[squadId]/page.tsx:98-107` filters only by position;
`fn_squad_askable` (`supabase/migrations/0054_squad_safety.sql:145`) returns the
club's whole register with no age-group or competition-gender narrowing. The
comment there says that is deliberate ("a club puts a player where it needs
them"). I am not proposing a behaviour change — but in the room, a senior
women's squad suggesting eight-year-old boys is the wrong kind of wrong.
**What a TD would think:** "So the squads are empty and the suggestions are
random." The one squad with a player in it (Deniz, U15 Boys) is genuinely good:
positions ranked 1st/2nd, 2 clips, 18/11/7 self-reported. That card is the
answer to Leo's question — it does tell a coach something useful. There is just
one of it.

### F8 · Inviting anyone but the four house fixtures sends nothing — **looks amateur**
**Page:** `/club/invite/[registrationId]` → `/dev/outbox`.
I invited Goran (a background player) to a trial: the counters moved (new 81,
shortlisted 12, invited 7) and the screen said "It is in Goran's Pitch account
and their parent's." The outbox stayed at **5 messages** — nothing was
generated. I then invited Deniz (a fixture with a real guardian account): outbox
**5 → 6**, and the parent's home showed "today · Balmoral FC would like Deniz at
a trial" within seconds.
So the register's headline action is inert for 96 of 100 rows, and the screen
says otherwise.
**What a TD would think:** nothing, unless BUZ invites a background player and
then opens "What families receive" to show the wake — which is exactly the
demo's best sequence. **Tell BUZ to invite Deniz, Georgia or Nate, never a
name from the list.**

### F9 · The CV page has no buttons on it — **looks amateur**
**Page:** `/club/register/cv/[registrationId]`.
The page renders **zero forms**. You read a player's whole CV, decide you want
him, and there is nothing to press: no Shortlist, no Invite, not even a link
back to his row. The only way out is "The register" at the top, which returns
you to the top of a hundred-row list with your place lost.
**What a TD would think:** "So I open a CV in one tab and shortlist in another."
He will say it out loud on about the fourth CV.

### F10 · Every 404 is a blank page — **looks amateur**
**Page:** anywhere. There is no `not-found.tsx` or `error.tsx` under `app/`.
`/nonsense`, `/fc/not-a-club`, a squad id that does not exist and — the one that
matters — **a CV link for a registration a family has just removed** all return
404 with an empty body. In the demo browser that is a blank dark screen with no
navigation.
This sits directly on the best moment in the product (F-strong-1): the family
takes the child off, the TD refreshes the CV he had open, and the story ends on
a blank page instead of "this family has taken themselves off your register".

### F11 · Invented facts and real clubs' names attached to a real club — **looks amateur / a rule we wrote**
**Page:** `/fc/balmoral-fc` (verified variant) and several CVs.
- The club page carries **"Est. 1974"**, a philosophy paragraph, a pathway line
  and a three-entry alumni wall ("Marco V. → NPL Victoria, Balmoral juniors
  2012–2018"; "Aylin D. → State representative squad"). None of it is Balmoral's.
  The 23 Sept exception in TRAINING §3.1 allows the club's **name, suburb,
  ground and crest and nothing else about them**; a founding year and an alumni
  history are things about them.
- The house fixtures' football history names **Preston Lions FC**, **Moreland
  Zebras FC**, **Pascoe Vale SC** and **Reservoir Juniors** (`lib/fixtures.ts:103,
  104, 184, 185`, from doc 16 §fixtures). L15 says seed names only. In a room in
  Melbourne the TD knows those clubs.
- Deniz (14) shows **"school — Northcote High 1st XI"** under Other football
  (`lib/fixtures.ts:80`). D-114 is "no school field on any under-18 CV". An
  `experience_entry` of kind `school` is not the same object as a school field,
  but it puts a named real school on a 14-year-old's page in front of a club.
  **Safety seat's call, not mine — flagging, not asserting.**
**What a TD would think:** on the alumni wall, "we never produced a Marco V." —
and then he wonders what else on the screen is made up.

### F12 · A YouTube link labelled "Veo clip" — **minor, but it is on the CV**
**Page:** any keeper's CV, e.g. Pia Novak.
`components/cv/PlayerCV.tsx:189` derives the clip's subtitle from the player's
**position group**, not from the clip: `group === 'GK' ? 'Veo clip' : 'Goals,
assists & link play'`. Every keeper's first clip says "Veo clip" — and the demo
inserts `https://www.youtube.com/watch?v=demo-<i>` for all of them
(`scripts/demo-layer.mts`, `enrichRegistrants`). It cuts the other way too: I
found one card titled "Saves and distribution, 2026" subtitled "Goals, assists
& link play".
Those demo URLs are not real videos either, so **pressing play shows a YouTube
error**. The façade is correct (nothing loads until you press) — there is just
nothing behind it.

### F13 · The unclaimed club page contradicts itself in two adjacent blocks — **looks amateur** (current build only)
**Page:** `/fc/balmoral-fc` as served right now (`--unclaimed`).
The trials block ends with "**How to register:** go on Balmoral FC's register
below and your CV goes with you." Immediately under it: "Balmoral FC isn't on
Pitch yet, **so there is no register here.** Send them your CV instead."
The first line is `trial_notice.how_to_register`, written for a claimed club and
still rendered on a listing that has no register.
Everything else about this variant is good (see the strong moments).

### F14 · Plan & billing does not answer a treasurer's questions — **minor**
**Page:** `/club/billing` (verified + subscribed).
The whole plan block is: "$54 a month" and "Manage or cancel this subscription".
No "inc GST" (D-109/D-112 price both inc GST), **no next charge date**, no
mention that it renews, and no sight of the annual option. D-136 wants price,
frequency, renewal and how to cancel on our page.
**What a TD would think:** "What exactly am I taking to the committee?"

### F15 · The held-register promise cannot be shown — **looks amateur (for the pitch), and it is the strongest claim we have**
**Page:** `/demo`.
Leo asked me to switch to the unverified club seat. **There isn't one.**
`app/demo/seats.ts` has six seats and every club seat belongs to the verified,
subscribed club; the administrator's register redirects to `/home` at a verified
club by design (`app/club/register/page.tsx:83`). In the current unclaimed
build there is no club seat at all — the picker offers parent, 17-year-old and
adult player only.
So the one screen that proves D-126 — *"{n} waiting. Registrations are held
until your club is verified… Paying doesn't change it and can't"*
(`app/club/register/page.tsx:216-219`) — is not reachable in the demo. It is the
answer to the only hard question a technical director asks, and BUZ cannot show
it. **I could not walk it, so I am not reporting it as working.**

### F16 · Small things a sceptic notices — **minor**
- **The ground is a placeholder.** The verified build rendered "Balmoral home
  ground, Pitch 2" (`demo-layer.mts` falls back to `${short} home ground` when
  `--ground` is not passed). The current build passes it and shows "Balmoral
  Reserve" — make sure tomorrow's run does too.
- **The club page has no `og:image`** (0 occurrences) but declares
  `twitter:card=summary_large_image`. Shared into a parent WhatsApp group it
  unfurls as a blank card. The crest `<img>` also carries `alt=""`.
- **Position filter chips carry no counts** on the register ("GK", "ST") while
  the age and status chips do ("U13 · 17", "New · 82"). Clicking GK to discover
  it is 13 is a guess every time.
- **The trials board offers filters that return nothing** — "Men 0", "Women 0".
- **"Invitation sent" is all you ever see again.** Re-opening a sent invitation
  shows no date, no copy of the line the TD typed, nothing sent.
- **On the current build, `/demo`'s "Start here → Claim Balmoral FC" card
  bounces a signed-out visitor to `/signin`,** and the picker offers no club
  account to sign in with. BUZ will tap the top card first.

---

## The three strongest moments — lean on these

1. **The family takes the child off, and the club's screen changes while you
   watch.** On `/g/controls/[childId]` the parent gets "Who has read Deniz's
   registrations — **Marina Petrovic, Technical director · Opened the CV, last
   23 Sep · Saw it in the list, last 23 Sep**", then one tap: "Take off this
   register. The club isn't told why, and anything Deniz wrote to them is
   deleted." I did it, switched back to the TD, and the register went **100 →
   99**, Deniz was gone, and the CV link the TD had open returned nothing. The
   register footer's claim — "a family who switches their link off disappears
   from it the same minute. A spreadsheet on someone's laptop could not do that"
   — is true, and it is demonstrable in about forty seconds. *(Do it on a
   fixture, and mind F10: the dead link lands on a blank page.)*

2. **What the club administrator cannot see.** Sign in as Pat Nguyen and there
   is **no Register in the navigation at all**; `/club/register` redirects to
   home. Open a squad and she sees the player's name and "In the squad since 23
   Sep" — no positions, no stats, no CV — with the line printed on the page:
   *"You run the club page, the squads and the notices. What a player put in
   their record is for the technical director and that squad's own coaches."*
   Then the coach seat: Sam Kaya sees exactly 14 registrations, his two teams
   (U14 Boys · 9, U15 Girls · 5), can open a CV and has no button to invite
   anyone. Three seats, three different answers, all computed.

3. **The invitation, and the message that carries no name.** `/club/invite/…`
   says it plainly before you send: *"Where this actually goes — into Goran's
   Pitch account and their parent's. Not an email, not a text… You get no phone
   number and no email address… If they ignore it, you are told nothing.
   Silence is an allowed answer."* Send it to **Deniz** and the parent's home
   shows it immediately, while `/dev/outbox` shows what actually left the
   building: *"Something is waiting in your Pitch account."* No club, no child,
   no message. That is the product's whole argument in two screens.

*(Runner-up, and the answer to "can you make a club verified by paying": the
claim screen in the current build — "Claiming gets you the page and trial
notices. Verified status is separate… **Claiming can't make a club verified.
Only the phone call does that.**")*

---

## What I did not open

- **The unverified / held club register** — no seat exists (F15). Not walked,
  not claimed as working.
- **The claim flow past the first screen.** I read `/claim/balmoral-fc` and did
  not submit it: claiming would have changed the builder's demo state.
- **Anything that presses play on a clip** (façade tested, third-party load not).
- **The four fixtures' full family journeys** — I used the parent seat only for
  the removal and to confirm the invitation landed. Nate's and Georgia's own
  flows, the send-a-CV flow, `/g/pending`, `/g/send`, `/g/card` were not walked.
- **The coach's public page, the jobs board, sign-up, reset, report, privacy,
  terms, the operator console** — outside the TD's journey.
- **Print views** (`/p/[token]/print`, `/c/[slug]/print`) — a TD prints CVs for
  trial day, and nobody has looked at them; worth someone's hour.
- **Any width other than 1280 and 375**, and no test on a real handset.
- **The register at 100 rows on a phone** was measured for overflow only, not
  judged for usability.

## Risks

- Every data finding (F2–F5, F7, F8, F11, F12) was measured against the
  **builder's worktree**, which is mid-rebuild. Some may already be fixed in
  their working copy; F5 and F13 survived the 08:00 reseed.
- The mutations I made (1 shortlist, 2 invitations, 1 removal) were wiped by the
  reseeds. Nothing I did persists in the demo now.
- I did not touch port 3000, the dev database on 54322, or any repo file.

## Copy for BUZ

None — I wrote no user-visible string. Strings quoted above are existing product
copy, quoted so Leo can judge them; the contradiction in F13 and the missing GST
and renewal wording in F14 are copy decisions for the copy seat.

## Lesson for the next seat

**A demo port is a shared resource with a kill switch in it.** `scripts/demo.mjs`
`takeOver()` kills whatever holds 3030/54323 — so a builder iterating on demo
data silently destroys the demo anyone else is walking, and reseeds the database
under them. Twice during this walk the ids I was holding stopped existing, and
once the port refused connections. Before a QA pass or a meeting, one demo on the
machine, and whoever measures says which tree and which pid it was measured on.
