# Pitch — walkthrough script

**Everything below runs on your machine only.** Nothing is live. The site at
pitchfootball.com.au is still the coming-soon page; the app lives on the local
`app` branch, which has never been pushed.

Both servers are already running. If you ever need to restart them:

```bash
cd "/Users/bdonmez22/Desktop/Life/Work/Pitch 3.0/repo" && node scripts/dev-db.mts
```

then in a second terminal:

```bash
cd "/Users/bdonmez22/Desktop/Life/Work/Pitch 3.0/repo" && npm run dev
```

The app is at **http://localhost:3000**.

Sign in with any of these. **Leave the password box empty** — these four seats
have no password set, and in development an account without one signs in on the
email alone so you can hop between seats freely. (In production that shortcut
does not exist; a password is required.)

| Who | Email |
|---|---|
| Alex — parent of all three players | `guardian@example.com` |
| Marina — Technical Director, Riverside FC | `td@example.com` |
| Sam Kaya — coach | `coach@example.com` |
| Sunbury United — claimed but NOT yet verified | `sunbury@example.com` |

**To change seats, go to `/signout` first** — otherwise you are still wearing the
last hat and the pages will look wrong.

If you want to see the real password machinery, do this once with Alex:
`/reset` → type `guardian@example.com` → the screen says *"If there's a Pitch
account for that address, a reset link is on its way"* (it says exactly that
whether or not the account exists — the message is not allowed to tell a
stranger who has an account) → open **`/dev/outbox`**, which is the local stand-in
for the inbox until Resend is wired, and follow the reset link → set a password →
sign in with it. That link then dies: opening it a second time refuses and sends
you back to `/reset`. Alex now needs that password, so remember it or reset again.

---

## 1 · The stranger — what a club sees when a link arrives

Open these without signing in. This is the product's front door.

1. **http://localhost:3000/p/dev-deniz** — Deniz's CV as a club sees it.
   *Watch:* the stats count up like a scoreboard, the small pitch in the hero
   pings his position, "Parent-approved", a clip you can press play on
   (nothing loads from YouTube until you do).
2. **http://localhost:3000/p/dev-nate** — the keeper test. Two numbers only,
   and no negative statistic exists anywhere. Does it still look worth sending?
3. **http://localhost:3000/p/dev-georgia** — the sparse test: modest numbers,
   one clip. Does it still look like a real CV?
4. **http://localhost:3000/p/dev-expired** — an expired link.
   Then **/p/dev-revoked**, then make one up: **/p/anything**.
   *Watch:* all three are the identical page. Nobody can use a wrong link to
   find out whether a child is on Pitch.
5. **http://localhost:3000/p/dev-deniz/opengraph-image** — the card that shows
   in WhatsApp. First name + initial, never his club or age.

Public pages worth a look: **/c/sam-kaya** (coach CV), **/fc/riverside-fc**
(club page — girls' and women's squads as first-class rows, alumni wall),
**/trials** (the board: verified clubs vs compiled listings).

---

## 2 · The parent — sign in as `guardian@example.com`

You land on **Your family**. Three children, each with their real status.
There are four things waiting on you — open each:

1. **Riverside FC would like Georgia at a trial** → *Review it*.
   *Watch:* Georgia has not been told. Read the club's note, then
   *Reply* — everything you could hand over starts switched **off**.
2. **Georgia wants to send her CV to Sunbury United** → *Review it*.
   *Watch:* the address she typed, what the club gets and never gets, and
   "do nothing and this disappears by itself".
3. **Nate wants to go on Riverside's register** → *Read it*.
   *Watch:* his exact words, before they reach anyone.
4. **Deniz changed his page** → *Review it*.
   *Watch:* his old words struck through against the new ones. Until you
   approve, every club holding his link still reads the old version.

Then **Manage** on any child — the cockpit:
- His link (shown as a fragment; the full link only ever appears once, when
  it's made)
- **Renew** / **Replace** — replacing kills the old one for everyone, instantly
- The **pause** switch — flip it, then open his `/p/` link in another tab: dead.
  Flip it back: alive.
- **Everything that's happened** — your consent history in plain words
- **Delete everything** — the honest copy about the one thing we keep

---

## 3 · The player — sign in as an adult you create

Go to **http://localhost:3000/join**, choose Player, use a birthday that makes
you 18+, tick the terms, and create an account with any email. You land on your
own build surface: **Build your CV** (positions as tap chips, your number,
about, stats where blank stays blank — no zeros), **Highlights** (paste a
YouTube link), **Achievements & other football**.

To see the under-16 door instead, start again with a birthday that makes you 14
— you'll be asked for a parent's name and mobile, then land on
*"Your page is built. One person to go."*

---

## 4 · The club — sign in as `td@example.com`

**http://localhost:3000/club/register** — the Interest Register, the thing
clubs pay for.
- On a wide window it's a table; on a phone it's cards. Same data, same actions.
- Nate is shortlisted → **Invite to trial** opens the composer. Read
  "Where this actually goes" before you send.
- **Open the CV** on any row.
- Read the two cards at the bottom: *There is no download* and
  *New, shortlisted, invited — and nothing else*.

**http://localhost:3000/club/post-trial** — post a trial; it appears on the
club page and the trials board the same minute.

Now sign in as **`sunbury@example.com`** and open **/club/register** again.
*Watch:* a count and not one name — "Paying doesn't change it and can't."

---

## 5 · You, the operator

**http://localhost:3000/ops/verification** — clubs awaiting your call, with
their held counts. Open Sunbury's **call sheet**: the thirteen fields, your
name required as operator, and where you found the number required.
Log it as **verified** — then sign back in as `sunbury@example.com` and watch
the register go from a bare count to named players.

---

## What to tell me

Anything that feels wrong, ugly, slow, confusing, or off-brand. Screens I
should push harder on. Copy that doesn't sound like you. I'll take the list as
the punch list — the full design polish pass is still deliberately open.
