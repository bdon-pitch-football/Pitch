# Pitch — the full walkthrough

The whole product, every seat, in the order a real season meets it. This is
for BUZ seeing what has been built. It is not the club meeting: that is
`DEMO.md` and `DEMO-TD.md`, which are ten minutes and one club's view.

Everyone in it is made up. It runs on the laptop only and sends nothing. The
messages it would have sent wait in **What families receive** on /demo.

**Rehearsed on 29 Sep** (Leo, fresh demo, every act). What behaved differently from
this script is corrected below, and what needs fixing is in round E.

## Start

```bash
cd "/Users/bdonmez22/Desktop/Life/Work/Pitch 3.0/repo" && npm run demo -- "Ashvale Lions FC"
```

It opens at http://localhost:3030/demo. **Switch seat** in the bar at the top (the amber Demo tag)
brings you back to the list at any time.

## Act 1 · The front door (nobody signed in) — about 5 minutes

1. **The front door** `/`: today it is the coming-soon page. The launch-day
   switch (D-164) cannot be flipped inside a demo, by design, so show it on the
   development app (`localhost:3000`, `POST /dev/front-door?on=1`). It has
   "Somebody should be writing this down", then *Who are you?* (player, parent,
   coach, club), *Browse trials without an account*, and sign-in. Switch it
   back off afterwards.
2. **The trials index** `/trials`: one chronological noticeboard, filtered by
   age group, region, gender and position. There is no recommender. Filter
   chips with nothing behind them are hidden (D-162).
3. **A club page**: crest, philosophy, pathway, teams from MiniRoos to
   seniors, girls' teams on their own rows, and the alumni wall. Open
   **Report this page** at the foot to show that every public page has it.
4. **Jobs** `/jobs`: coaching roles, where a coach can "put your name
   forward".
5. **The legal pages** `/privacy` and `/terms`: the published text, with no
   drafting preamble. The Terms still carry clause markers and Schedule A's
   price until John answers doc 36; say so rather than scroll past it.

## Act 2 · A family arrives — about 8 minutes

6. **Sign up** `/join`: "Where do you live?" first. Pick *Somewhere else*
   once to show that Pitch says it is Australia-only and collects nothing
   (D-63). Then role and date of birth. Enter a 14-year-old
   and see what happens: **the child's profile does not exist yet.** They
   leave first name, date of birth and a parent's contact, and nothing else.
7. **The parent's approval**: open the message in *What families receive*,
   follow it, and approve. Only then can the CV be built. Every step lands in
   the consent log.
8. **Switch to Alex (parent of Deniz 14, Georgia 15, Nate 17).** This is the
   guardian's home.
   - **Deniz's CV**: open it the way a club would. Look at the stat tiles
     (never a zero, never a negative), the "Self-reported" tag on every
     number, the clips (façades until play is pressed) and "U14 · born
     Jan–Mar" under the name (D-84). Open the share card to show the marker
     is not on it.
   - **An edit waiting for the parent** (D-119): the club still sees the
     approved version. Nothing publishes on silence.
   - **The share card**: the parent sees the exact image before it can leave.
     It shows a first name and initial, positions, number and stats, and no
     club or age.
   - **Send my CV to a club**: the child composes, and the parent checks the
     address and presses send.
   - **Controls**: the link's expiry, pause, a new link, and **who at Pitch
     has looked** at the record, and why. For every real family it is empty,
     and it says so.
   - **A trial invitation**: it arrives inside Pitch, not by email. The parent
     chooses field by field what goes back to the club.
9. **A dead link** `/p/<anything>`: expired, never existed or switched off
   all look the same. The page shows no name, no club and no photo, and
   takes the same time to load.

## Act 3 · The players themselves — about 4 minutes

10. **Switch to Nate (17, goalkeeper).** Nate sends their own CV and the
    parent is told every time. The keeper's stat set shows clean sheets and
    never goals conceded. There are no paid surfaces, because Nate is under
    18.
11. **Switch to Jordan (adult) → My CV → Highlights.** The same CV spine with
    two quiet locked "Premium" rows, and three free clips instead of ten. Tap a row: "Premium is
    coming. You're first in line." It is counted anonymously, with no price
    shown (D-163). Nate's page, one step earlier, has none of this.

## Act 4 · The club side — about 10 minutes

12. **Switch to Sam Kaya (coach).** Their coach CV and the stable public link
    they copy themselves. They see only the two teams the TD gave them.
13. **Switch to Marina Petrovic (TD).** On a laptop this is the console
    layout: rail, table, detail.
    - **The Interest Register**: sort and filter, open a CV, shortlist, and
      invite to a trial. The statuses stay on the club's side and never
      reach the family.
    - **Squads**: keepers first, with "No goalkeeper yet" where a squad has
      none.
    - **Roles**: who holds which power at the club.
14. **Switch to Pat Nguyen (admin).** They run the page, the teams, the
    trials and the alumni wall. They cannot read a child's record. There is
    no billing to show: Pitch is free, the register included
    (D-163).
15. **Switch to M. Harris (a club we haven't rung).** The register shows a
    count and not one name. Paying does not change that. Only a verification
    call does.

## Act 5 · Behind the counter — about 5 minutes

16. **The operator console** `/ops`:
    - **Verification**: the call that makes a club verified, with a name,
      the time and the authority question. This is the only way a club
      becomes verified.
    - **Reports**: every report lands here, including the twelfth from the
      same address in an hour.
    - **Support**: invitation state and re-send only. There is no way into
      a child's record from here.
    - **Switches**: the 11pm kill switches, now including SMS, which can be
      switched off from a phone.
    - **A child-safety suspension**: suspend a club with the child-safety
      reason and open *What families receive* to see the notice each family
      gets, with its one-tap switch-off (D-165).

## Act 6 · Every device — about 3 minutes

17. Re-open three screens at phone, iPad and laptop width: the CV, the
    register and the parent's home. The content is the same, the container
    differs, and nothing you can do on one is missing on the other.

**Total: about 35 minutes.** Stop anywhere; nothing depends on finishing.
