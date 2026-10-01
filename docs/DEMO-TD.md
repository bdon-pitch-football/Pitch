# Run sheet — a Technical Director, on your laptop

One page. Hold it in the meeting. Everything in the demo is made up except the
club's name, suburb, ground and crest.

**Before you sit down**

```bash
cd "/Users/bdonmez22/Desktop/Life/Work/Pitch 3.0/repo" && npm run demo -- "Balmoral FC" --suburb Balmoral --state VIC --ground "Balmoral Reserve"
```

Add `--crest ~/Downloads/balmoral.png` if you saved their badge. Then click
through every step below once, so no page has to build while he is watching.
Leave the browser on **/demo**.

---

## The walk — about twelve minutes

**1 · Their page.** `/demo` → *Balmoral FC's page*.

> "This is your club on Pitch, as a family sees it. Trials at the top with the
> date, your teams from MiniRoos to seniors, girls' teams on their own rows,
> and the pathway wall at the bottom. Families go on your register from here."

**2 · The register.** *Switch seat* → **Marina Petrovic**, then **Register**.
This is the screen he is being sold. Let him scroll.

> "A hundred families have put their child in front of you. Sorted into your
> own teams, because the family picked the team when they registered. Eighty-two
> you haven't looked at, twelve you've shortlisted, six you've invited."

Then use the filters in front of him — **U15**, then **GK**, then
**Shortlisted** — and say what they cost:

> "That's your keeper shortage, in two clicks. Where does that list live at
> Balmoral now?"

**3 · One CV.** Open any **Open the CV** on the register.

> "Their positions in their own order of preference, the season they entered
> themselves — and it says self-reported, because it is — their line about
> themselves, their clips, where they played before. And 'Parent-approved',
> because for an under-16 their parent approved every word on that page."

Ask him: *"How long does it take you to learn that much about a player today?"*

**4 · A team.** **Squads** → **U14 Boys** (that one, because a family is
waiting on it).

> "Everyone in the team, keepers first, with what each of them says they are.
> Free, on every tier. And at the top, a family asking you to confirm their
> son plays here — that's you keeping your own list right, in one tap. There's
> one waiting on the U15 Girls and the U18s as well."

**5 · The invitation. This is the moment.** Back to **Register** → filter
**Shortlisted** → **Invite to trial** on **Nate** → read the box out before
you press:

> "It goes into their Pitch account and their parent's, together. Not an email
> to the child. You get no phone number and no email address. If they ignore
> it, you are told nothing — silence is an allowed answer."

Press send. Then *Switch seat* → **Alex** (parent): the invitation is there.
Then `/demo` → **What families receive**: the only thing that left the building
says *"Something is waiting in your Pitch account."* No club, no child, no
message.

**6 · The safety answer.** He will ask *"what stops you giving my players'
details to anyone who signs up?"* — *Switch seat* → **M. Harris, a club we
haven't rung yet** → **Register**.

> "Forty-two families have registered with this club. It sees the number and
> not one name, because nobody here has rung them yet. Paying doesn't change
> it and can't. You'll get that call too."

**7 · What a coach and an administrator get.** *Switch seat* → **Sam Kaya** →
**Registrations**: two teams, fourteen players, no way to invite anyone. Then
**Pat Nguyen**: no Register in the menu at all.

> "Your treasurer can run the page and never read a child's
> record. Your U14 coach reads their own two teams and nothing else. That's
> the database deciding, not a setting somebody could get wrong."

**8 · What it costs.** No screen for this one.

> "It's free, all of it, the register included. Your club page,
> your trial notices, CVs arriving by email and coach verification too. If
> that ever changes, you'll hear it from me well before it does."

Never name a future price or a date for one (D-163).

---

## The three that land hardest

1. **The register with the filters moving** (step 2). Everything else is
   detail.
2. **The held register** (step 6) — the answer to the only hard question.
3. **What the invitation actually sends** (step 5) — a parent's screen and a
   message with no name in it, side by side.

---

## If he asks "how would Balmoral get its own page?"

That is a **second run**, not a detour — stop the demo (Ctrl+C) and start it
again with `--unclaimed`:

```bash
npm run demo -- "Balmoral FC" --suburb Balmoral --state VIC --ground "Balmoral Reserve" --unclaimed
```

Balmoral starts as the listing we built from their public notices — their
trials and nothing they wrote. Then, on `/demo`:

1. **Balmoral FC's page** — *"compiled from public information, not affiliated
   until claimed."*
2. **Claim Balmoral FC** → it asks you to sign in → **Create an account** →
   **Club** → your name, a date of birth, `you@balmoralfc.example.au`, a
   password (ten characters).
3. **The club's inbox** (`/dev/outbox`) → *"Confirm your email address"* → open
   the link in it, press the button, sign in.
4. **Claim Balmoral FC** again → **Send me the code**. The code goes to the
   address on Balmoral's own public notices, never one you typed. Read it out
   of the inbox, put it in, claim.
5. **Crest & club page** → write the philosophy, the pathway, the year founded,
   save, then **Squads** → add a team. Open the public page and it is all
   there. (There is no **Post a trial** yet: a club that has only claimed
   posts trials after the verification call.)

> "Claiming gets you the page and your squads. It cannot make you
> verified — only the phone call does that, and trial notices and anything
> about a child wait until it happens."

---

## What not to open

- **"Who plays" on a squad page**, below the team sheet. It lists the whole
  register whatever the team is, so a senior squad is offered under-9s. It is
  a known gap and it is with the tech team.
- **Any clip.** The façade is right — nothing loads until you press — but there
  is no video behind a made-up link.
- **The ops console** (`/ops/…`). That is ours, not a club's.
- **A CV's age.** No CV states an age or a birth year yet. If he asks, say so:
  *"the age group the family registered for is what you see; the birth year is
  on the list for the next build."* Do not guess one off a squad name.
- **A 404.** A dead link is a blank dark page. Use the back button, not a URL.

## What not to say

- No date for anything on the roadmap. "Coming soon."
- Don't load their players in, even if they offer. Real children never go into
  a demo.
- Not *potential*, not *applicant*, not *rejected*. Football, never soccer.
- Nothing from this demo gets photographed, screenshotted or posted. Their name
  beside made-up children is fine across a table and nowhere else.
