# build: a suspended club on its own squad pages, and the claims list behind it (2026-09-23)

Asked: two pieces of safety round 2, X1 — doc 14 M10 and D-126.
**(1)** `fn_can_work_squads` never looked at `club_state`, so a suspended club kept a
minor-facing surface: work out what a verified-only gate costs at every call site, split
the function if that is honest, choose the more restrictive reading, prove every check on
the broken code. **(2)** Then build the finding I handed back: the "Waiting on you" claims
list is the only read on that page that is not a database function, and it does not ask
A17 — build `fn_squad_claims`, find the whole set of questions it is missing, decide what a
club administrator sees and say why, and check the answer path as well as the list.
Do not touch what a family sees or the demo layer.

Did: two migrations, two product files, two script files. Branch
**`builder-suspended-club`** in its own worktree, cut from `app` at **`d9cf74f`**, commits
**`44fada5`** and **`26ed7e0`**. Not pushed, nothing deployed, no real account or key
touched. **0058 left alone** — Leo is holding `0058_td_on_the_call.sql` on another branch,
so this is 0057 and 0059 with the gap intact.

---

## Part 1 — `44fada5` · `supabase/migrations/0057_suspended_club_squads.sql`

**I confirmed the three consequences against a database before fixing anything**, not off
the source. A throwaway probe built the migrations into PGlite, made a verified club with a
TD, an administrator, an approved guardian and two thirteen-year-olds, took a claim and an
invitation while the club was still verified, then suspended it:

| Leo's consequence | What the database actually did |
|---|---|
| 1 · the page's claim list returns first **and last** name | **Confirmed.** `"Wren Kavanagh"` — the register gives a club a first name only |
| 2 · `fn_squad_asked` returns first names | **Confirmed**, to the TD *and* to the administrator |
| 3 · the club can still act | **Partly.** Confirming a child in and inviting one were **already refused** — 0054 replaced 0052's `fn_join_squad` and `squad_request_rules` and both re-check `club_state`. 0052:120 and 0052's rule are dead code. What was still open, and is not in the brief: **answering a family's claim "no"** (that branch of `answerClaim` never reaches `fn_join_squad`), **taking an invitation back**, and **removing a child from a squad** — which takes the club line off that child's approved page, because `fn_cv_club` follows the membership |

`fn_can_work_squads` now asks `fn_club_minor_facing(p_club)` first — the name the product
already gives the question (0022, written for M10/M11), so this is reuse, not a second
answer (L23).

**Not split into two functions, and that is the honest answer here.** A split needs a
second question — "may this person act for this club at all" — with somewhere to be asked,
and there is nowhere. Every live caller is a squad surface about children:
`page.tsx:55`, that page's `actions.ts:23`, `fn_squad_asked` (0054:181) and
`fn_squad_roster`'s administrator branch (0054:293, already behind a verified check at
0054:287). 0052:120 and 0053:54 sit in function bodies 0054 dropped and replaced. A second
function would have had no callers, and an uncalled permission function is a thing people
later call by mistake.

**What it costs at every call site:** a `claimed`, never-verified club loses nothing it had
(a claim, an invitation and a membership can only exist at a verified club, so all three
lists were already empty for it — `SQ23`/`SQ23b`); adding and removing its own squads,
bringing coaches in, editing the club page, the crest, coaching roles and trial notices all
read `membership` directly and are untouched; **D-135's survival set is untouched** —
billing and the Stripe portal, and `/home` reading `club_state` itself to say the club is
not verified, so a suspended club can still see that it is suspended and still reach its
card. A suspended club loses three acts, and nothing is stranded: an invitation lapses on
its own at thirty days, and the family's way out is `fn_can_leave_squad`, which deliberately
asks nothing about the club (D-10, `M10l`).

**Read at the page, not asserted from the source** (L16). With the seed club suspended, the
TD is served the squad **200** with no child's name, no "Waiting on you" and no Remove
button, under the shell's existing "registrations are held" line; the **administrator gets
404**, which is the page's own existing answer for "nobody may read this squad". No new
code path and no new words.

## Part 2 — `26ed7e0` · `supabase/migrations/0059_squad_claims_read.sql`

**The whole set of questions it was missing**, worked out against its two neighbours rather
than taken from a list. `fn_squad_roster` and `fn_squad_asked` each resolve the club from
the squad, refuse unless the club is minor-facing, ask who is reading and apply
`fn_person_hidden`. The inline query had `fn_person_hidden` and a page boolean, so:

1. **A18 — the consent behind the ask.** A claim exists only because an approved guardian
   made it. Revoke that guardianship and the row stayed, so a **verified** club kept reading
   a thirteen-year-old's first **and last** name for an act `fn_join_squad` already refused
   to complete (SQ8g).
2. **The same shape at 16–17** when a parent turns the send switch off (B4), and **at
   eighteen** with a parent's claim still open (M3, D-49). Both are now `false` at
   `fn_can_act_on_squad` and both were still on the screen.
3. **Nothing to answer.** `fn_squad_asked` drops anyone already in the squad; this did not,
   so a player who arrived by another door left a stale claim the club could press — and
   pressing it only ever reported a failure about that child.
4. **The club gate lived on the page**, not in the read.

**One predicate, asked by the list and by the answer.** `fn_can_answer_claim(p_person,
p_claim)` is the whole rule, per row; `fn_squad_claims` filters on it and `answerClaim()`'s
`select … for update` now carries it. So a claim the club cannot see is a claim it cannot
act on, in the same words, and the disappearance is silent. **Measured end to end:** with
the guardianship revoked, the TD's and the administrator's pages serve no "Waiting on you"
section at all, and posting the decline form captured while the claim was still visible
returns **`303 → /club/squads/<id>?error=1`** — byte-identical to the answer a claim that
never existed gets — with the row untouched (`answered_at`, `confirmed` and `answered_by`
all still `null`).

**The decision I made, and it is the restrictive side (TRAINING §3.8), written into the
migration comment: the first name, and not the surname — technical director and club
administrator alike.** The page's two models disagree. `fn_squad_roster` gives both seats a
surname, but those are children the club has already confirmed into a squad and knows.
`fn_squad_asked` gives a first name only, "as the register gives it", for a child who is
**not** in the squad yet. A claim is the second shape: the family is asking and nothing has
been agreed, and the register's own closed payload is a first name (D-115) — a club that
may not have a surname from its register may not have one from a claim against the same
squad, or the claim is a way around the register. **The cost is real and belongs to BUZ:** a
TD with two children called Wren in one age group has less to go on. The honest answer if
that bites is a product decision about what a family's own ask may carry, not a quiet
surname here. Verified at the page: the claim card serves `Deniz`, not `Deniz Yılmaz`, to
both seats.

**`scripts/dev-db.mts`** — one line, `PITCH_DEV_DB_PORT`, so two builders can run the suites
at once without reseeding each other (L30). It deliberately cannot move the demo's port. I
ran everything on **54422 / 3100** and never touched 54322 or 3000.

## Which checks I proved by putting the bug back (L20)

Twenty-five new checks. Both reversions were done, watched fail, restored, watched pass.

**Part 1 — 0057 reverted to 0052's body. Fail on the old code, pass on the new — six:**
`M10e` (the gate, TD and administrator), `M10f` (first and last name on the claim list — got
`1,1`), `M10g` (`fn_squad_asked` — got `1,1`), `M10n` (the three writes all ran: the claim
closed, the invitation withdrawn, the child removed — `[[true,true,true],[false,false,0]]`),
`M10m`, `SQ23`.

**Part 2 — 0059's predicate reverted to the old set of questions (club gate +
`fn_person_hidden`) and the page reverted to the inline query. Fail on the old, pass on the
new — seven:** `SQ24c` (revoked guardianship, both seats), `SQ24d` (and it cannot be
answered), `SQ24e` (the send switch), `SQ24f` (turned 18), `SQ24g` (already in the squad),
`SQ24k`, `SQ24l` (the page no longer queries `squad_claim` and no longer renders a surname).

**Cannot fail on these bugs, so I proved they can fail at all (L19) with a different
mutation — two:** `M10h` and `M10i` are static/`pg_proc` checks on the page, its actions and
the two new function bodies. I rewrote `mySquad`'s query to drop `fn_can_work_squads` and
re-gated the claims list on `squad.td`, watched both fail, restored with `git checkout`.

**Green either way by design, and saying so — ten:** `M10d` is the before-picture;
`M10j`/`M10k` pin what 0054 already refused, so M10 covers the whole page and not just the
half that was broken; `M10l` and `SQ23b` are the not-stranded and nothing-to-lose claims;
`SQ24`/`SQ24b` (first name only) are fixed by the function's return type, so the surname
decision is pinned by `SQ24l` instead; `SQ24h` (paused child) and `SQ24i` (suspended club)
and `SQ24j` (a coach) are questions the list has to **keep**, not ones that were missing.

## Ran

Everything in TRAINING §4, in order, in my own worktree, on my own ports, from a fresh seed,
**except the layout check — see below.**

**reseed → perms 1048/1048 · render 369/369 · write 302/302.** Then gate coverage
**261/261 pinned, 0 open** · palette green · corpus **0 failures, 0 warnings** · secret scan
clean · `tsc --noEmit` exit 0 · `npm run build:check` exit 0.

Perms was 1023 at `d9cf74f`, 1036 after part 1, **1048** after part 2: twenty-five new
checks, none removed.

**Two things the numbers need said out loud.**

1. **Render is 369, not the 371 in the brief.** Measured, not assumed: I stashed the change,
   removed the migration, reseeded and ran the suite at `d9cf74f` in the same worktree —
   **369/369** there too. The total is loop-generated over the pages a crawl reaches, so it
   moves with database state.
2. **The perms suite now reads 1045/1048, and three of those failures are on `app` and are
   not mine.** See Found §1. At 09:31 it was 1048/1048; at 09:37 the same tree gave 1045.

**The layout check was NOT re-run for part 2, and that is a gap I am naming rather than
papering over.** It ran clean on this branch for part 1 — **184 page views at 375 and
1280px, 0 overflowing**. Since then the only change to any page's markup is one
interpolation inside an unchanged element:

```
-  <div style={{ fontSize: 15, fontWeight: 800 }}>{name(cl)} says they play here</div>
+  <div style={{ fontSize: 15, fontWeight: 800 }}>{cl.first_name} says they play here</div>
```

No element added, removed, restyled or reordered, and the text is strictly shorter. I could
not run it anyway: the machine hit **ENOSPC** mid-run (Found §3) and a dev `.next` for the
full crawl is ~1.1 GiB against 781 MiB free. **QA should run it before merge on a machine
with room** — I am not claiming it from an argument.

Disk: **6.6 GiB free when I started, 800 MiB now**, and it reached zero between the write
suite and the layout check. My worktree accounts for **428 MB** of that (a clone-on-write
`node_modules`); I deleted my `.next` and `.next-check` and stopped both my servers.
Everything piped to a file was capped at 200 columns.

## Found

1. **`app` at `d9cf74f` fails three doc 14 checks for two hours and twenty-four minutes
   every day, and it is failing right now.** `rm5`, `rm6` and `rm10` (`1020/1023` at the
   base commit, measured, with my migrations moved aside and the base suite file checked
   out). Not mine, and not flaky — reproducible while the window is open.
   **The cause, exactly.** `fn_links_to_remind` (`0050_reminders.sql:52`) groups by
   `(d.expires_at at time zone 'Australia/Melbourne')::date` — one reminder per child per
   expiry **date**, which reads correct. The fixture builds two links **2 hours 24 minutes
   apart** (`permission-tests.mjs`: `tok(kidRec, 6.5)` and `tok(kidRec, 6.6)`, where the
   helper multiplies by 24, so 156h and 158.4h) and asserts they are always one group. They
   are one group only while no Melbourne midnight falls between them. Measured at 09:37
   Melbourne: `t1 → 29/09 9:37 pm`, `t2 → 30/09 12:01 am`, different dates, two rows.
   `t1`'s time of day is `now + 12h`, so **the suite fails whenever it is run between about
   09:36 and 12:00 Melbourne time.** The check is what is wrong, not the function: the two
   links should be put on the same Melbourne date by construction. Left for whoever owns
   0050 — it is outside X1 and it is a one-line fixture change, but it is a doc 14 red and
   the gate is doc 14.
2. **`npm run build:check` leaves `next-env.d.ts` dirty, pointing at a build artefact.** It
   rewrites the imports to `./.next-check/types/…`; `next dev` rewrites them back to
   `./.next/dev/types/…`. My first commit swept the file in and I amended it out. **The main
   tree has been carrying that modification uncommitted** (`M next-env.d.ts` was already
   there when I started). If it is ever committed in the `.next-check` form, everyone's
   `next dev` types break. Worth a `.gitignore` line or a note, by whoever owns the build
   scripts.
3. **The machine ran out of disk during this task** (6.6 GiB → 0). The two biggest items are
   not mine: the main tree's `.next` is **1.1 GiB** and grew while another session's dev
   server ran, and `~/Library/Caches` is **2.7 GiB**. Anything needing a full dev crawl
   (layout, render, write) needs about 1.5 GiB of headroom, and there is not that much.
4. **No other club surface has the inline-query shape**, which is what Leo asked me to check
   and not fix. The three neighbours that join `person` all gate the row **in the `WHERE`**
   with a permission function: `/club/invite/[registrationId]` (`fn_can_invite`),
   `/club/register/cv/[registrationId]` (`fn_can_read_registration`) and
   `/club/squads/[squadId]/cv/[playerId]` (`fn_can_read_squad_player`).
   `/club/squads/page.tsx:72` joins `person` for register grants — adults, club-internal,
   behind `isTd`. `/ops/reports` reads children's first names with plain queries, but behind
   `requireOperator()`, which is the support console's own lane (D-79) and not mine to judge.
5. **A claim has no clock.** An invitation lapses at thirty days (`fn_lapse_squad_invitations`,
   BUZ's decision 7); a family's claim sits on a verified club's screen until somebody
   answers it. Whether a family's own ask should expire is a product decision and I have not
   made it.
6. **Copy: "Awaiting verification" is shown to a suspended club.**
   `components/console-shell.tsx:161` and `app/home/page.tsx:282` render
   `Awaiting verification — registrations are held` for every non-verified state. Under
   D-135 a club whose card failed is not awaiting a phone call, and after 0057 this is the
   only line a suspended TD gets on the squad page. Copy seat's.
7. **Dead code that reads like live rules.** 0052's `fn_can_work_squads` write branch
   (0052:120), 0052's `fn_join_squad` and 0053's `fn_squad_roster` were all dropped and
   replaced by 0054 but still read as the rule when you open those files — which is how
   0052:120 came to be named as a live consequence.

## Copy for BUZ

**No user-visible string is added, removed or changed.** Two changes in what an existing
string renders, both on `/club/squads/[squadId]`, both needing your eye:

1. The claim card's heading keeps its exact wording and now carries the child's **first name
   only**, never the surname — the same rule the "Asked, waiting on them" list beside it
   already follows. Verbatim, unchanged:

   > `{first name} says they play here`

   On screen today: **"Deniz Yılmaz says they play here"**. On screen after this: **"Deniz
   says they play here"**. Nothing else on the card moves — `Asked 12 Sep · their family
   sent this`, `Yes, they play here` and `Not this squad` are all untouched.

2. A suspended club, and a club whose claim is no longer standing behind an approved
   guardian, no longer sees the `Waiting on you` section at all — existing words, shown to
   fewer people. A suspended club's administrator gets the existing not-found page.

## Risks

- **The layout check has not been run against part 2** (above). The argument that it cannot
  have regressed is strong and it is still an argument.
- **The three writes in part 1 are proved at the gate and in the source, not by pressing the
  button at a suspended club.** `write-tests.mjs` cannot read or write the database (its own
  header says so), so it cannot suspend a club, and the product's only suspend route is the
  operator console — using it mid-suite would leave the seed club suspended for everything
  after. `M10n` therefore runs `mySquad`'s query verbatim and then each action's own
  statement, and `M10h` pins that all four exported actions go through `mySquad`. I read the
  page end-to-end at a suspended club; I did not POST those three actions there. **Part 2's
  answer path I did POST**, and it is in the numbers above.
- **I did not touch the demo layer and did not run the demo.** I read
  `scripts/demo-layer.mts` far enough to be sure of the blast radius: the normal demo club is
  verified, and `--unclaimed` deletes every squad and membership before setting
  `club_state = 'unclaimed'`, so there is no squad page to reach in either walk. If the demo
  is restarted after this merges, note L14 — it keeps the schema it started with.
- **`fn_can_work_register` still does not ask about `club_state`.** Every caller I read
  applies the verification itself, so I found no hole — but it is the same shape as the bug
  I just fixed, and I did not audit every caller. Worth a safety read rather than a patch.
- Nothing here changes what a family sees. `fn_can_leave_squad`, `fn_can_act_on_squad`, the
  guardian controls and the token path are untouched, and `M10l` pins that a family can still
  take their child out of a suspended club's squad.

## Lesson

**A permission check that groups by a calendar date can pass or fail depending on the hour
you run it.** `rm5`'s fixture spaces two links 2h24m apart and asserts they land on one
date; for 2h24m of every day they do not. This is L19 from the other end — not a check that
cannot fail, but a check that fails on the clock rather than on the code, which is worse,
because the next person to see it red will assume they broke something and go looking in
their own diff. **When a check depends on `now()`, construct the fixture in the units the
function groups by** — put both links on the same Melbourne date explicitly, rather than
trusting that two nearby timestamps will stay on one.

Secondary, from part 1: **when a brief names line numbers, open the later migration first.**
Three of the call sites in the X1 write-up were in function bodies a later migration had
already dropped, and the consequence it did not name — a suspended club removing a child
from a squad, which changes that child's page — was the one actually still open. The file
that defines a function is not the source of truth for what it does; `pg_proc` is.
