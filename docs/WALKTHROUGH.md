# Pitch — walkthrough

**Everything below runs on your machine only.** The app lives on the local
`app` branch, which has never been pushed. pitchfootball.com.au is the
marketing site on `main`, and only changes when you say so.

Two things need to be running. The desktop app starts both for you; if you
ever need to start them by hand:

```bash
cd "/Users/bdonmez22/Desktop/Life/Work/Pitch 3.0/repo" && node scripts/dev-db.mts
```

then in a second terminal:

```bash
cd "/Users/bdonmez22/Desktop/Life/Work/Pitch 3.0/repo" && npm run dev
```

**http://localhost:3000 is still the old coming-soon page, on purpose.** The
app starts at **http://localhost:3000/signin**.

## Seats

Leave the password box empty: in development an account with no password
signs in on the email alone, so you can hop between seats. Production has no
such shortcut. **Go to `/signout` before changing seats.**

| Who | Email | Lands on |
|---|---|---|
| Alex — parent of Deniz, Nate and Georgia | `guardian@example.com` | Your family |
| Jordan — adult player | `player@example.com` | Player home |
| Nate — 16–17 player | `nate@example.com` | Player home |
| Sam Kaya — coach | `coach@example.com` | Coach home |
| Marina — Technical Director, Riverside FC (verified) | `td@example.com` | Club home |
| Pat — club administrator | `admin@example.com` | Club home |
| Sunbury United — claimed, not verified | `sunbury@example.com` | Club home |
| Kingsway — verified, free plan | `kingsway@example.com` | Club home |
| A brand-new account | `new@example.com` | Nothing yet |

Pages that need no sign-in: `/p/dev-deniz` (a player's CV as a club sees it),
`/p/dev-jordan` (an adult's), `/p/dev-revoked` (a dead link), `/trials`,
`/c/sam-kaya` (coach page), `/fc/riverside-fc` (club page), `/dev/outbox`
(the local stand-in for the inbox).

---

## What changed in the redesign (15–16 Sep)

Every signed-in seat now sits inside a frame: a sidebar on a laptop and a
tab bar on a phone. A frame only offers pages that seat's home already links
to, and the render tests check this for every seat. Try each one at phone
width (the desktop app's Viewport menu) and at laptop width.

### 1 · The player — `player@example.com`, then `nate@example.com`

- **Home** is a dashboard now: how far through the six steps you are, the
  next trial that fits you, and your link.
- **Build your CV** shows progress as you type: the "5 of 6 done" bar
  moves live as you fill in number, about and stats. Positions are short codes in two rows. Tap one and its full
  name shows underneath.
- Finish all six and you land on **the moment** (`/build/…/ready`): your page
  is ready, or live, or, for an under-16, sent to your parent.
- **Trials** has filters: age group (only the groups actually on the board),
  gender, state and position. They sit behind a button on a phone and in a card
  on a laptop. Chips remove one filter at a time, with counts.

### 2 · The parent — `guardian@example.com`

- A tab per child, or one **Children** tab once there are more than two.
- **Manage** a child, then **Everything that's happened**: every club a CV
  went to now has its own **Switch off**. It switches off that one club's
  link and leaves the rest alone. You get a confirmation, and the history
  says "One club's link was switched off".
- The four waiting items (trial invite, a send to approve, a register
  request, a changed page) work as before.

### 3 · The coach — `coach@example.com`

- **Coach home** has the steps to a finished coach page, the teams you read
  the register for (names only, never a count), open roles and a copy button
  for your page.
- Tabs: Home · My CV · Registrations (only if a club gave you access) · Roles.
- **Publish (17 Sep):** at the bottom of **My CV**, *Publish my page* gives
  the coach a link made from their name (`/c/sam-kaya`, or `-2` if that's
  taken). *Take my page down* hides it. Publishing again brings back the
  same link, because coaches paste it into emails that stay around.
- **New (your call, 17 Sep; D-100 amended, register v4.14):** a coach page is an adult's page. Someone under 18
  can keep a coach profile, but it can never be given a public link or a
  public contact. The database refuses both, the page and sitemap won't show
  one, and the editor doesn't offer the contact field to an under-18. Sign
  in as `nate@example.com` and open `/coach/edit` to see it.

### 4 · The club — `td@example.com`

- **Club home** is new: how many are on the register (the TD only), your
  trials with how many are interested, open roles, and your page link.
- Tabs on a phone: Home · Register · Squads, then **More** for the rest.
- **Post a trial** picks age groups, gender and positions as chips. **Your
  trials** lists what you've posted, and **Change** edits one. The date locks
  once anyone has registered.
- **Register**: the table fits the card at laptop width, and the status chips
  use the palette.
- Sign in as `sunbury@example.com` and open Register: a count and not one
  name, until you verify them.

### 5 · You, the operator

**/ops/verification** has the same frame with its own bar. Open Sunbury's
call sheet, log it as verified, then sign back in as `sunbury@example.com`
and watch the register go from a count to named players.

---

## Overnight, 16–17 Sep

- **Coach pages are adults only** (above). Migration 0042, with seven
  permission checks and two render checks.
- **Security headers:** every page now carries a Content-Security-Policy.
  Scripts run only from this site and only with a one-time code for that
  request, and no other site can frame a page. Every page renders fresh per
  request so the code is always there.
- **Tap targets:** every text box sits inside a card that is the tap target,
  so the whole card (at least 44px) focuses the field. Save as PDF is 44px.
  Links inside sentences are left as they are, which the accessibility
  standard allows.
- **A dead link fixed:** "Copy this link" on a coach page copied
  `pitchfootball.com.au/<name>` with no `/c/`. It copies the real address now.
- **A full sweep:** every page, as every seat, at phone and laptop width.
  Result in the summary.

---

## Running the checks

```bash
npm run test:perms
```

Permission and gate checks against Postgres and the source. No server needed.

```bash
npm run test:render
```

Fetches the real pages as each seat and reads what they serve. Needs both
processes running.

Also: `node scripts/write-tests.mjs` (it changes the dev database, so
restart `dev-db.mts` afterwards), `node scripts/gate-coverage.mjs`,
`node scripts/palette-check.mjs`, `python3 scripts/corpus-check.py` and
`npx tsc --noEmit`.

Last full run (17 Sep, overnight): typecheck clean · palette green ·
render 330/330 · write 92/92 · permission 827/827 · gate 261/261 open 0 ·
corpus clean. Also checked in a production build: 400 page views across
10 seats with no security-policy errors, and the pages come alive
(builder progress, trials filters).

---

## What to tell me

Anything that feels wrong, ugly, slow or confusing, and any copy that doesn't
sound like you.
