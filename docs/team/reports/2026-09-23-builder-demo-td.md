# builder: the club demo for a Technical Director (23 Sept 2026)

**Measured on:** worktree `.claude/worktrees/agent-a80be822d0ce359f7`, branch
`worktree-agent-a80be822d0ce359f7`, commit **aa0706d**. The demo is **stopped**
and ports 3030 / 54323 are free. Disk 7.8 GiB free at handover.

**Asked:** the demo only — a mode where the club starts unclaimed so BUZ can
show a club making its own page; a complete walk from the TD's seat with
something real behind every screen; the Interest Register clean and full in the
TD's own lens; a one-page run sheet; then QA's sixteen findings, in Leo's order.

---

## Did

**`scripts/demo-layer.mts`** (272 → 878 lines) — the whole of the data work.

- **`--unclaimed`.** A new branch that turns the demo club into the compiled
  listing it would really be the day before it joined: `club_state` unclaimed,
  the address from its own public notices, trials marked `source='compiled'`,
  and **deleted** — not hidden — every registration, membership, squad, seat,
  notice, alumni entry, video and coaching role, plus the philosophy, pathway,
  year and banner. Deleted rather than hidden because each of those is a state
  the product *cannot* produce for an unclaimed club: `/register-interest`
  accepts `claimed` or `verified` only, so a register there would be a lie. The
  state and its verification call move in one statement, because `club_check`
  refuses a verified club with no call behind it and refuses it in either order
  if they are written apart.
- **Ages that fit the team** (QA F2, Leo 1). The birth date now comes *from* the
  squad the family named — Australian junior football bands by calendar year, so
  an under-14 in 2026 was born in 2012 — and the list is true by construction
  rather than by a check. Moving a birth year moves the band, so `reconcileFamily`
  rewrites everything that depends on it: a guardian exists for every under-18
  (A17/D-96), an under-16 has an approved snapshot and a 16–17 has none (D-119),
  and an adult's guardian link is removed (D-49).
- **A register that reads like a hundred children** (F3, F4, Leo 2). Position-
  specific pools: 12 register lines and 10–12 "About" paragraphs per position
  group, never the same sentence twice inside one squad bucket, no pronoun (a
  line with "she" in it lands on a boy about half the time), no banned word —
  **"struggles with the physical side" was in my first draft and D-61 bars it**.
  Five current clubs plus a "between clubs" slice, six previous, ten honours on
  half the records, thirteen clip titles. Name pools 110 boys / 100 girls and 70
  surnames, both dispensed once each.
- **Seasons that add up** (F4). Bounded and position-shaped: nothing exceeds
  appearances, keepers get clean sheets, strikers do not out-assist their games.
  Zero is never written, so it is never drawn (D-70).
- **Every squad has a team** (F7, Leo 5). Eleven squads, 134 players, keepers
  first; the four BUZ opens get fourteen, the rest eleven. Each has their own
  record, season, clip and — where under 16 — their own approved snapshot.
- **Things waiting to be done** (Leo, task 2). Three families asking to be
  confirmed into a squad (U14 Boys, U15 Girls, U18 Boys), twelve registrations
  against each trial matched on age group *and* competition gender, twelve
  shortlisted rows ready to invite. The invitation waiting on a parent was
  already in the seed (Georgia's).
- **Invitations actually send** (F8, Leo 7). The cause: the seed's 96 parents had
  no address, and `sendInvitation` wakes guardians `where p.email is not null`.
  Every parent now has an `@example.com` address with a used `email_proof` row
  behind it, the way the database insists on (0056, L21). Verified by inviting a
  background player and watching the bare wake arrive in the outbox.
- **A held register to show** (F15, Leo 8). Sunbury United — claimed, never
  verified — gets 42 held registrations and a seat on `/demo`.
- **Trials on the day they name** (F5, Leo 4). The weekday is inside the free
  text; the shift moved only the date. Dates are now rolled forward to the
  weekday their own notice names, and tagged registrations move with them.
- **Six real organisations swapped out** (F11). `Preston Lions FC`, `Moreland
  Zebras FC`, `Pascoe Vale SC`, `Reservoir Juniors`, `Northcote High 1st XI` and
  `Point Cook Senior College` reach the demo from `lib/fixtures.ts` and are
  swapped for seed names here. **The fixture file is a finding, below, not a
  change I made.**

**`scripts/demo.mjs`** — `--unclaimed`, and a bare-flag list so a flag before the
club name no longer swallows it.
**`scripts/dev-db.mts`** — passes `DEMO_UNCLAIMED` through. Nothing else.
**`app/demo/page.tsx`** — an unclaimed demo opens on *Start here* (their page,
then claim it) and hides the club seats that do not exist yet.
**`app/demo/seats.ts`** — the "a club we haven't rung yet" seat.
**`app/dev/outbox/page.tsx`** — every `pitchfootball.com.au/…` in a message body
is *also* rendered as a link to the same path on this host. The claim story runs
through two links in that page and BUZ was otherwise copying a 32-character
token off a screen in a meeting. Built by splitting the string into React
children, never as HTML (D-94 §6); the words are unchanged.
**`scripts/permission-tests.mjs`** — DEMO6 replaced, see below.
**`scripts/demo-walk.mjs` + `scripts/demo-walks/`** — the run sheet, driven in
real Chrome. Nothing walked the demo before: the render and layout suites walk
the dev app on 3000.
**`docs/DEMO-TD.md`** (new) and **`docs/DEMO.md`**.

### The one check I changed, and why it is not a weakening

`DEMO6` read *"the demo renames the club only — it loads no person"* and tested
it with `/insert into person/ === false`. BUZ's 23 Sept instruction — squads with
players in them — makes that assertion false while the rule behind it (**nothing
about a real person ever enters a demo**, TRAINING §3.1) is untouched. Deleting
the check was the weak option. It is replaced by two that test the rule itself:

- `DEMO6a` — the layer reads no person from anywhere: no `fetch`, no
  `readFileSync` other than the crest the operator passed.
- `DEMO6b` — every address it writes ends `example.com`/`example.au` and every
  number is in the `+61 491 570 xxx` range ACMA reserves for fiction.

Both proved against broken code before being trusted (L19/L20): a `fetch` and a
`realclub.com.au` address were put in and each check failed on the right one.
**This is safety-adjacent and I would like the safety seat to read it.**

---

## Ran

| Suite / walk | Count |
|---|---|
| `npm run test:perms` | **1023 passed, 0 failed** (was 1021+1 fail — DEMO6) |
| `node scripts/gate-coverage.mjs` | 261 doc 14 rows, 261 pinned, 0 open |
| `python3 scripts/corpus-check.py` | 0 failures, 0 warnings |
| `node scripts/palette-check.mjs` | ALL GREEN (3 pre-existing raw hex, info only) |
| `node scripts/secret-scan.mjs` | no secrets |
| `node scripts/validate-migrations.mjs` | ALL GREEN (no migration changed) |
| `npx tsc --noEmit` | clean |
| Demo walk — the run sheet, real Chrome, 1280px | **39 checks, ALL GREEN** |
| Demo walk — the unclaimed claim, end to end | **51 checks, ALL GREEN**, from a fresh seed |
| Demo walk — widths | **24 page views at 1280 and 375, 0 overflowing** |
| Width check self-test (L19) | fails as designed: 900px page measured 908px on 375px |
| Register, measured in the demo database | 100 rows · 41 distinct About · 40 distinct lines · 18 blank · 5 current clubs · 18 clip titles |
| Ages against squads | 11 squads, **0 adults in any junior team**, every squad inside its own calendar-year band |
| Parents reachable | 77 of 77 under-18 registrants have a guardian with a proved address |
| Squad rosters | 134 players across 11 squads; no duplicate first name inside any squad |

**Not run, and why:** `test:render`, `write-tests` and `layout-check.mjs` need
the dev app on 3000 and the dev database on 54322, and **another session holds
both** (L8/L30). I did not take their ports. My changes outside the demo are
`app/dev/outbox` (dev-only; the render walk excludes `/dev/`) and `app/demo`
(exists only under `PITCH_DEMO=1`). Whoever has 3000 should run those three.

---

## Found — product, not demo. None of it changed.

1. **Nothing in the product links to `/claim/[slug]`.** Grep across `app`,
   `components`, `lib`: the only references are in two test files. A club can
   reach the claim page only by typing the URL. Worse, `/join`'s club door
   *promises* the button — *"open your club's page on Pitch and press **Claim
   your club**"* — and a brand-new club account's `/home` says *"claiming a club
   page… not on this screen yet"*. **The entire self-serve acquisition funnel
   has no front door.** The demo gets a card on `/demo` and the run sheet says
   plainly that the real link is not there yet.
2. **No CV states an age, a birth year or an age group** (QA F6, Leo 3). I
   checked before adding anything: `components/cv/PlayerCV.tsx` renders none,
   and D-84's birth-quarter marker is not built anywhere — `grep -rn quarter
   lib components app` returns nothing. The only age signal is the squad name,
   which exists for two of a hundred registrants. **It is a product gap, not a
   demo one**, and it is the first question a TD asks out loud. Run sheet tells
   BUZ to say so rather than guess.
3. **`fn_squad_askable` narrows by nothing but position** (QA F7, Leo 6), so
   Seniors Women is offered under-9 boys. The migration comment says it is
   deliberate. No demo data can work around it — the function returns the club's
   whole register regardless of the squad. Run sheet says do not open it.
4. **The unclaimed club page contradicts itself in two adjacent blocks** (QA
   F13). `app/fc/[slug]/page.tsx` renders *"How to register: go on Balmoral FC's
   register below"* whenever there is a trial, and immediately under it *"Balmoral
   FC isn't on Pitch yet, so there is no register here."* Reproduced at 08:34.
   It is on screen in the unclaimed story and I could not fix it in demo data —
   the trials are why the listing exists.
5. **`lib/fixtures.ts` carries four real Melbourne clubs and two real schools**
   (QA F11) on the football history of made-up children: `Preston Lions FC:103`,
   `Reservoir Juniors:104`, `Pascoe Vale SC:184`, `Moreland Zebras FC:185`,
   `Northcote High 1st XI:80`, `Point Cook Senior College:156`. L15 says seed
   names only. I swapped them **in the demo layer**; the fixture file itself is
   outside this task and is also what the dev app, the render tests and any
   screenshot use. Separately, `kind: 'school'` on a 14-year-old's page is a
   D-114 question that is the safety seat's, not mine.
6. **`/signin` does not carry a destination.** `/claim/balmoral-fc` redirects to
   sign-in and afterwards drops you on `/home`; the claim has to be found again.
7. **`/club/billing` says "$54 a month" and nothing else** (QA F14) — no "inc
   GST", no renewal, no next charge date, no annual option. D-136 wants price,
   frequency, renewal and cancellation on our page.
8. **PGlite prints its entire minified bundle on any query error.** One failed
   statement wrote hundreds of megabytes to a log and **took the machine to zero
   free disk at 07:41**, which is what killed the demo QA was walking. Anything
   that pipes the demo's output to a file should cap it (`| cut -c1-200`).

---

## Copy for BUZ — every new user-visible string, verbatim

Three, all on `/demo`, which is the demo's own front door and exists nowhere
else. Everything else BUZ will see is existing approved product copy.

**1. `app/demo/seats.ts` — the new seat (title, name, description):**
> A club we haven’t rung yet
> M. Harris
> Claimed their page, hasn’t been verified. Families are registering and the club sees a count and no names.

**2. `app/demo/page.tsx` — the unclaimed demo's opening line and its two cards:**
> Nobody at Balmoral FC has claimed the page yet. Start at the top — the club seats appear once it is claimed.

> START HERE
> Balmoral FC’s page
> The listing we built from their public notices. Nobody at the club has claimed it.

> Claim Balmoral FC
> Prove it is your club with a code to the club’s own address, then the page is yours.

**3. `app/demo/page.tsx` — one existing card relabelled for the unclaimed run:**
> The club’s inbox
> Every email and text Pitch sends, word for word — including the claim code.

`docs/DEMO-TD.md` is a script for BUZ, not product copy, but the sentences in it
are ones he will say out loud in front of a club and are worth his eye.

---

## Risks

- **The two stories are two runs.** Item 1 and items 2–3 cannot share one demo
  honestly: an unclaimed club has no register, no teams and no seats, and
  verification is a human act that a claim must never trigger (D-126). The run
  sheet makes the restart a deliberate break rather than a stumble. If BUZ wants
  one continuous story, that is a product decision about what a claim does, and
  it is not mine to make.
- **The claim story does not survive a second pass** on the same demo: the
  confirm link is single-use and the code expires. Restart before showing it.
  The run sheet says so; I hit it myself.
- **The startup is slower** — about 35 seconds to the database, against ten
  before, for 134 squad players and their families. Still well inside "start it
  before they sit down", but it is not ten seconds any more and `docs/DEMO.md`
  now says half a minute.
- **U18 Boys legitimately contains eighteen-year-olds**, whose CVs render the
  adult layout beside seventeen-year-olds'. That is correct football and correct
  product; I left it. If it reads oddly in the room it is a data choice to
  revisit, not a defect.
- **No CV has a photo.** 100 invented children cannot honestly have 100 faces,
  and putting four brand photographs on a hundred records would be worse than
  the initials block the design already specifies. A real register in week one
  looks like this. Said rather than fixed.
- **Not checked:** print views, real handsets, any width but 1280 and 375, the
  operator console, and the three suites that need port 3000.

---

## Lesson

**A demo is a product surface and nothing was walking it.** Every finding QA
raised had been in front of people for days — an adult in the under-13 girls'
list, a trial on the wrong weekday, ninety-six invitations that sent nothing —
because the render, write and layout suites walk the dev app and the demo's own
story was only ever checked by eye. `scripts/demo-walk.mjs` and
`scripts/demo-walks/` exist so the next change to the demo has to survive the
walk BUZ actually does. **And when a check stops being true because the product
moved, replace it with the rule it was standing in for — do not delete it.**
