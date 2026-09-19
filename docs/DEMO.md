# Pitch — club demo

Pitch on your laptop, renamed to the club you're meeting. Every player,
parent and coach in it is made up, and it never sends an email or a text or
takes a payment.

## Before the meeting

In Terminal:

```bash
cd "/Users/bdonmez22/Desktop/Life/Work/Pitch 3.0/repo" && npm run demo -- "Albion Rovers FC" --suburb Cairnlea --state VIC --ground "Kevin Flint Memorial Reserve"
```

Change the club, suburb and ground each time. Only the club name is
required. About ten seconds later your browser opens at
**http://localhost:3030/demo**.

- **Their crest:** save it from their website as a PNG or JPG and add
  `--crest ~/Downloads/their-crest.png`. Without it the demo draws a plain
  shield with their initials.
- **Starting clean:** every start is a fresh demo. Press **Ctrl+C** in
  Terminal to stop it, then run the command again.
- **Open pages early.** Click through the seats once before the meeting.
  The first visit to each page takes a few seconds to build; after that
  it's instant.
- The demo runs alongside the normal development app without touching it.

## In the meeting (about ten minutes)

The green bar at the top says it's a demo. **Switch seat** takes you back to
the list of seats at any time.

1. **Their club page.** On /demo, choose *Their club's page*. This is what a
   family sees: trials, teams from MiniRoos to seniors, girls' teams on
   their own rows.
2. **The Technical Director.** Choose *Marina Petrovic*.
   - Home: 100 players on the register, with how many are new or
     shortlisted and how many have been invited.
   - **Register:** every player who has registered interest, sorted by
     team. Open a CV. Shortlist someone and invite them to a trial.
   - Ask them: *where does your EOI list live now?*
3. **A coach.** Switch to *Sam Kaya*. They see only the two teams the TD
   gave them, never the whole club.
4. **The club administrator.** Switch to *Pat Nguyen*. They run the page,
   teams and trials, but see no child's details. A treasurer made an admin
   never reads a child's record.
5. **The parent.** Switch to *Alex*. The trial invitation from step 2 is
   waiting for them. Nothing goes back to the club until the parent says so.
   Then open *What families receive* on /demo to show the email itself.
6. **The price.** The Interest Register is $54 a month, cancel any time, or
   $329 a year. The club page, teams, trial notices, CVs by email and WWCC
   verification are free.

## What not to say

- Don't name a date for anything on the roadmap. Say "coming soon".
- Don't load their players into the demo, even if they offer. Real children
  never go into a demo.
- Don't use the words *potential*, *applicant* or *rejected*.
- Say *football*, not soccer.

## How it stays safe

- The demo runs only on your laptop, and only when started with
  `npm run demo`. A live build refuses to start in demo mode.
- It uses its own throwaway database on its own port, whatever else is set
  up on the laptop, including real keys.
- It can't send email or texts, can't reach Stripe, and can't write to the
  waitlist. Messages wait in *What families receive* instead.
