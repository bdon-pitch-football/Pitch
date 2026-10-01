# Copy check: Floodlit redesign (D-173), 1 Oct 2026

**Branch:** `design/floodlit` (worktree `.claude/worktrees/floodlit`), diffed against `app`.
**Files:** `components/front-door/FrontDoor.tsx`, `app/fc/[slug]/page.tsx`, `components/floodlit/SiteNav.tsx`.
**Verdict: PASS WITH FIXES.** Nothing breaks a banned-word or child-safety rule. Three lines make promises we can't keep for every reader (F1 to F3). They need fixing, or BUZ needs to accept them knowingly, before this goes live.

`git diff app` also shows deletions in `docs/team/APPROVALS-28-SEP.md`, `docs/team/TRIALS-DESK.md` and `scripts/sync-trials.mjs`. They aren't this branch's work: `app` moved one commit ahead (9dfc7c3, the trials desk) after the worktree was cut at 319d8df.

---

## 1 · Approval list for BUZ

Every new or changed string, word for word, grouped by screen. **23 strings await approval.** 13 are new wordings: the 11 in the build report plus 2 screen-reader labels the report missed. The other 10 are already-approved words in a new place or with a new destination.

### Nav bar, on every Floodlit page (`/`, the four landings, `/fc/[slug]`) — `SiteNav.tsx`

| # | String | Status |
|---|---|---|
| 1 | **Find your club** (link, laptop only) | New as a nav link (it's the `/claim` page title) |
| 2 | **Trials** (link, laptop only) | New as a nav link |
| 3 | **Sign in** | Approved words, now on every Floodlit page |
| 4 | **Back** (phone, landings only) | Approved (HeaderMark), new component |
| 5 | Screen-reader label on the logo: **Pitch Football, home** | **New, not in the build report** |
| 6 | Screen-reader label on the link group: **Pitch** | **New, not in the build report** |

### `/` the front door — `FrontDoor.tsx` `Chooser`

| # | String | Status |
|---|---|---|
| 7 | Heading: **Your club's page is already built.** | **New.** See F1 |
| 8 | Kicker over it: **For clubs & technical directors** | Approved (club landing), new place |
| 9 | **Search for your club, then claim its page. We email a code to the club's own address to check it's you.** | Approved (`/claim` page), new place |
| 10 | Search field placeholder and screen-reader label: **Club name or suburb**; button: **Search** | Approved (`/claim`), new place (also on the club landing) |
| 11 | **Browse trials without an account** | Approved. Now a text link in the hero, and a secondary button on the player landing |

Unchanged and in the same words: "Somebody should be writing this down." (now a second-level heading rather than the page heading), "Seasons end. Coaches move. Clubs change. The record should be the thing that stays.", "Who are you?", the four doors (club now first, parent now opens its own landing), "Under 16, nothing exists until a parent approves it.", "Already have an account? Sign in".

### `/?for=parent` — `Parent`

| # | String | Status |
|---|---|---|
| 12 | Under the hero button: **Under 16, nothing exists until a parent approves it.** | Approved (chooser), new place. See F8 |

### `/?for=club` — `Club`

| # | String | Status |
|---|---|---|
| 13 | Closing button **Claim your club page** now goes to Find your club (`/claim`), not `/join` | Approved words, new destination. The destination is more honest than before |

The hero button is replaced by the club search (row 10). Every other line on the player, coach and club landings is word for word as before.

### `/fc/[slug]`, unclaimed page, the new claim panel — `page.tsx:473–489`

| # | String | Status |
|---|---|---|
| 14 | Kicker: **Is this your club?** | Approved (D-172 banner), now twice on the page. See F6 |
| 15 | Title: **Claim {Club}** | **New** |
| 16 | **Your crest and your philosophy** | **New** |
| 17 | **Every squad you run, MiniRoos to seniors** | **New.** See F5 |
| 18 | **Trial notices families can find** | **New.** See F3 |
| 19 | **One list of every player who wants to join** | **New.** See F3, F4 |
| 20 | Button: **This is our club — claim it** | **New.** See F6 |
| 21 | **We email a code to the club's own address to check it's you.** | Approved (`/claim`), new place. See F2 |

### `/fc/[slug]`, claimed, verified or suspended page, right-hand card — `page.tsx:491–499`

| # | String | Status |
|---|---|---|
| 22 | Label: **The club** | **New.** See F7 |
| 23 | **{suburb} {state}** then **Est. {year} · {n} squads** (or **1 squad**) | **New** wording ("squad"/"squads"). See F7 |

Everything else on the club page is word for word as it was: the D-172 banner (still first, still in body text), "Claim it", "Ask us to update or remove it", "Verified club" (verified only, now shown in capitals by CSS), "Trials coming", "checked {date}", "The club's own notice", "How to register: …", "Our philosophy", "Want to play here?" and its six buttons, the squad hints, "Players wanted", "Email the club", "Ask on the register", "Club video", "Nothing loads until you press play", "The pathway is real", the alumni footnote, "{Club} is looking for coaches", "{n} open role(s)", "See them", "Report this page", and both meta descriptions.

---

## 2 · Problems

### F1 · Honesty: the front-door heading isn't true for every club that reads it (fix)
`components/front-door/FrontDoor.tsx:363`: **"Your club's page is already built."**
The club list is Victoria only: `content/sales/pipeline/clubs-vic-full-2026.csv` has 213 rows and every one is VIC. NSW is a launch market (D-04). `/claim` itself expects clubs that aren't listed ("Not here? Tell us your club", "We'll add {club} within a day", `app/claim/page.tsx:42,75`). For an NSW club, or any Victorian club not on the list, the headline is false, and it's the first line a club reads.
**Smallest fix:** "Your club's page **might** already be built." (the green span stays on "already built."). Update `want` in render test fd5 (`scripts/render-tests.mjs`, which pins the heading) to match.

### F2 · Honesty: "We email a code…" is false for about a third of unclaimed pages (fix)
`app/fc/[slug]/page.tsx:487` shows **"We email a code to the club's own address to check it's you."** on every unclaimed page. But 69 of the 213 rows in the club CSV have no contact email, and `scripts/import-clubs.mjs` loads those clubs with `contact_email` null. For those clubs, `/claim/[slug]` (`page.tsx:63–70`) says the opposite: "there is nowhere for us to send a code … we will call the club instead".
**Smallest fix, no new words:** render the line only when `c.contact_email` is set. The page already selects that column, and the button still leads to `/claim/[slug]`, which explains the phone route honestly.
(The same sentence in the front-door hero, `FrontDoor.tsx:364`, is `/claim`'s general description and does no harm there. No change needed.)

### F3 · Honesty: two panel lines promise what claiming alone doesn't turn on (fix, or BUZ accepts knowingly)
`app/fc/[slug]/page.tsx:479`: under "Claim {Club}", **"Trial notices families can find"** and **"One list of every player who wants to join"** read as what claiming gives. Claiming gives neither:
- Only a **verified** club posts a trial notice (D-90, migration 0152, doc 14 M7: "Nobody advertises a trial to families until BUZ has rung the club").
- Registrations are **held** until verification, and the club sees a count and nothing else (D-126).

On an unclaimed page that already shows compiled notices, the first line also reads oddly.
**Smallest fix, no new words:** drop those two lines. The panel keeps "Your crest and your philosophy" and "Every squad you run".
**If BUZ wants them kept:** add one line under the list, new words for approval: "Trial notices and the list switch on once we've rung the club."
The approved club landing ("What a claimed page carries: Trial notices …", `FrontDoor.tsx:309–310`) has the same gap. It's older than 0152, isn't in this diff, and should follow whatever BUZ decides here.

### F4 · Product vocabulary: "wants to join" (fix, if the line stays)
`page.tsx:479`: **"One list of every player who wants to join"**. "Join" is our word for signing up to Pitch (`/join`), and it's one letter from "joined", which D-172 bans on exactly this kind of page. The product's name for this list is the register, and a player "registers interest".
**Smallest fix, no new words:** use the approved club-landing line, "Every player who wants to be at your club, in one list" (`FrontDoor.tsx:318`).

### F5 · Consistency: near-copy of an approved line (minor)
`page.tsx:479`: **"Every squad you run, MiniRoos to seniors"** vs the approved "Every squad you run" / "MiniRoos through to seniors" (`FrontDoor.tsx:311`).
**Fix:** "Every squad you run" alone, or "Every squad you run, MiniRoos through to seniors".

### F6 · Say it once (D-173 (5)): the unclaimed page asks "Is this your club?" twice, and on a phone the claim pitch sits above the family's way in (fix the kicker; ordering is BUZ's call)
- The same question appears at `page.tsx:247` (banner) and `:476` (panel kicker), with three claim wordings on one page: "Claim it" (`:250`), "Claim {Club}" (`:477`) and "This is our club — claim it" (`:486`).
- Below 1024px, `fl-aside-first-m` (`app/globals.css:966`) moves the panel **above** Trials and "Want to play here?". Families are the main readers of an unclaimed page on a phone, and they now read two club-directed claim pitches before the way to send a CV.
- The button also switches voice: the list says "Your …" to the reader, then the button speaks as the club ("our club").

**Smallest fix:** drop the panel's "Is this your club?" kicker (the title already asks it). Button: "Claim it" (approved), or keep the new one if BUZ likes it. Ordering: remove `fl-aside-first-m` so family content comes first on a phone. That's a design call; I'm raising it for BUZ, not deciding it.

### F7 · Say it once: the "The club" card repeats the hero (minor)
`page.tsx:491–499`: place, "Est. {year}" and "{n} squads" are already in the hero line (`:215`) and the "Squads" numeral (`:222–224`) a few centimetres away. They're new words that add no information.
**Smallest fix:** drop the card. If BUZ wants the right column filled, approve "The club" and "{n} squads" / "1 squad" as listed.

### F8 · Voice and say it once: parent landing (minor)
`FrontDoor.tsx:194`: **"Under 16, nothing exists until a parent approves it."** under the parent's button. The page talks to the parent as "you", and the first card below says the same thing in second person ("Nothing exists until you say so", `:199`).
**Fix:** drop it from the parent hero. It stays on `/`, where it belongs.

### F9 · Screen-reader labels not in the build report (minor, needs approval either way)
`components/floodlit/SiteNav.tsx:21`: **"Pitch Football, home"**. The product calls itself "Pitch" on every screen.
**Fix:** "Pitch, home".
`:23`: **"Pitch"** on the link group is announced as "Pitch, navigation". That's acceptable; "Main" is clearer.

### F10 · Corpus check fails because of this branch (fix)
`python3 scripts/corpus-check.py` → `FAIL S7 tally says 165 locked, actual 166`. D-173 was added as Locked, but the header tally wasn't bumped.
**Fix:** `docs/06-Register.html:76`, `<b>165</b> locked` → `<b>166</b> locked`.

---

## 3 · What passed

- **Signed words verbatim.** I extracted every string from the `app` and branch versions of `FrontDoor.tsx` and `page.tsx` and diffed the sets. No approved word was removed or altered in either file; the only changes are the additions listed above. I also read both files line by line for text built from code expressions, where the extractor can't see.
- **Doc 15 / `lib/messages.ts`:** nothing in this change sends a message. Not applicable.
- **Banned words** (D-85, D-108, content rules): none in any new or changed string. No soccer, no footy, no elite. `npm run -s test:perms`: url1 OK, ban1 OK, 1916 passed, 0 failed.
- **D-163:** no "free", price, "for now" or "limited" on the front door. Render test fd3 is unchanged.
- **D-172:** no partner, member, joined, "on Pitch", verified or official in any unclaimed-page string. The banner is word for word and still first in the hero. No photograph or crest on an unclaimed page. "Verified club" shows only for `verified`. The claimed-only meta line ("on Pitch") is still gated.
- **Age and identity:** no claim that Pitch verifies age or identity.
- **Australian English:** clean, including "MiniRoos".

## 4 · Outside this copy check

- **Concurrent work.** While I was checking, a club-colours pass appeared in this tree (`app/club/page-edit/*`, `lib/club-colours.ts`, `supabase/migrations/0160_club_colours.sql`, test scripts). Its change to `/fc/[slug]` is styling only and adds no words (checked). **The page editor's strings aren't covered here** and need their own copy check.
- **Out of this diff, but the front door now sends clubs there:** `app/claim/page.tsx:78` says "That club is already **on Pitch**. Search for it above." about a listed club that may be unclaimed, which is the phrase D-172 keeps off unclaimed pages. Smallest fix: "That club is already listed. Search for it above."
- **For design, not copy:**
  - `FrontDoor.tsx:194` uses `fontWeight: 600` (the charter says write 700).
  - The nav's "Find your club" and "Trials" are hidden below 1024px (`globals.css:907`), so on `/fc/[slug]` they're a laptop-only way in (D-147).
  - The club landing puts "Who reads a child's record" after the Interest Register now; the words haven't changed, but the 390px artboard governs order.
