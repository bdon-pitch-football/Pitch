# build: the Technical Director wall is a person, not a mailbox (28 Sept 2026)

Asked: fix X1 from the 28 Sept safety review — `fn_attach_recorded_td` must refuse
the club's own `contact_email`, and `fn_club_td` must name the account the role
actually landed on — prove it against a database before and after, and write the
residue up for BUZ without building it.

Measured on: worktree `.claude/worktrees/builder-td-wall`, branch `builder-td-wall`
off `app` at `62caad5`; the work is commit `3c90b0d`. My own ports:
dev database `54341`, app `3021`. `df -h /`: **6.7Gi avail (73%) at start,
17Gi (38%) at finish** — it went *up*; see Found 3.

---

## Did

### 1 · `supabase/migrations/0060_td_is_a_person_not_a_mailbox.sql` (new)

**The refusal, and it is in two places on purpose.** The header says why at
length; the short version:

- **`fn_td_on_call` gains the predicate** — `lower(trim(vc.td_email)) <>
  lower(trim(coalesce(c.contact_email, '~no contact address~')))`. That function
  is the single answer 0058 built for "did a call record this person as this
  club's TD", and the wall trigger already asks it. Putting the rule anywhere
  else would be a second answer to one question (L23). Putting it here means
  every writer of the live role inherits it — the trigger, the seed, an action,
  and any later route that forgets.
- **`fn_attach_recorded_td` now asks `fn_td_on_call`** instead of repeating its
  own copy of the join, and so refuses the same address, quietly, on its own.
  It has to: it runs *inside* triggers on events that happen whether or not
  there is a TD to attach — a club becoming verified, a call being logged, an
  address being proved. If it had selected the mailbox holder and let the
  trigger raise, an **operator verifying a club would have got an exception
  instead of a verified club**, and D-126's release of every held registration
  would have failed with it. 0058 already promised this function was "quiet by
  design ... returns null rather than raising"; this keeps that true.
  So: the trigger is still the guarantee, and the attach is the caller that now
  asks before it writes.
- **The sentinel matters.** `coalesce(..., '~no contact address~')` — a club that
  recorded no contact address must not match every TD address ever recorded.
  `td19` is the check that would go red if somebody simplified it to `coalesce(
  c.contact_email, '')` and the constraint on `td_email` ever loosened.
- **`fn_club_td` gains four columns** — `account_name`, `account_email`,
  `name_matches`, `club_mailbox`. Return type change, so it is a `drop` and a
  `create`; every existing column keeps its name, position and meaning, and
  both ops screens and the two existing suite checks select by name.
  `name_matches` is compared in SQL, once, so neither screen works it out
  (L23), and is **null** rather than false when no account resolves — "we do
  not know" is not "they do not match".
- **0058's sweep is re-run** against the rule it should have carried, for the
  reason 0058 gives: a rule installed with exceptions left behind is a rule with
  exceptions. No new table, so L26 does not bite.

Not done, deliberately: nothing about the WWCC asymmetry (X2), nothing about
handover, and no refusal of an attach to a differently *named* human — that last
one is Risks/Residue below and it is BUZ's.

### 2 · `app/ops/call/[clubId]/page.tsx` and `app/ops/verification/page.tsx`

Both render the database's new answer and decide nothing themselves. The call
sheet card gains an "account holding that address" block (name and address of the
resolved account) and a mismatch line; the status line gains a fourth state for
the mailbox case, because after change 1 the old third state — *"Waiting on their
account ... the role switches on the moment that address is confirmed"* — would
have been a false sentence on an operator's screen for an address that can never
switch on (L25). The queue's one-line status gains the same two states through a
small `tdState()` helper whose every input comes from `fn_club_td`.

Colour: `T.red` for the mailbox case against `T.amber` for waiting, because amber
on that card means "this will resolve itself" and this one never will. No new
token.

### 3 · `scripts/permission-tests.mjs` — ten checks, both directions

A new fixture built the way it happens rather than described: a club whose
`contact_email` is `coach@mailboxfc.example`, the club's treasurer holding that
address on her own account with it **proved** (she had to prove it to read the
claim code, so L21 is satisfied and is not what stands in the way), a
`club_admin` membership, a 14-year-old in a squad with an approved guardian and a
record — then a verified call recording the mailbox as the TD under the name
"Robin Recorded".

| label | what it pins |
|---|---|
| `td13` | before the call, an unverified club gives her nothing at all (A14) |
| **`H11`** | a club administrator reads no development record, **and a call recording the club's own address is not a path to one** — doc 14 H11 is worded "by any path", and verifying the club was that path |
| `td14` | the attach refuses in silence rather than picking up whoever holds the mailbox |
| `td15` | and the role cannot be written to her by hand either (the trigger, not the caller) |
| **`J13`** | no register reader and no `fn_td_on_call` answer in the person holding the club's inbox |
| `td16` | `fn_club_td` names **Tessa Treasurer** beside the recorded "Robin Recorded", and flags the address as the club's own |
| `td17` | the other direction — the club is rung back, gives the TD's **own** address, and the role attaches and reads `full` (A12) while the treasurer drops back to `membership_only` |
| `td18` | and the console then names the same human twice |
| `td19` | a club that recorded **no** contact address at all still gets its TD |
| `td20` | structural, the N1 shape: the predicate lives in the one answer, and the attach asks that answer rather than carrying a copy |

Two labels carry doc 14 row ids and were read against the rows before use (L4);
the other eight deliberately do not.

---

## Ran

Order per TRAINING §4 from a fresh seed, on `3c90b0d`, dev database `54341`,
app `3021`:

- **reseed** (`PITCH_DEV_DB_PORT=54341 node scripts/dev-db.mts`)
- **perms — 1112 passed, 0 failed.** (1102 at `62caad5` per the safety report; +10.)
- **render — 369 passed, 0 failed.**
- **write — 305 passed, 6 failed.** All six are `sqf4b`–`sqf4g` and are
  **pre-existing at `app` HEAD, not mine** — see Found 1. The three write checks
  that read the TD console (`td-w4`, `td-w5b`, `td-w6b`) passed unchanged.
- **reseed**, then **layout — 188 page views at 375 and 1280px, 0 overflow.**
- **A second layout measurement, 190 views, 0 overflow**, with the new card and
  the new queue line actually on screen (see "Proved" below) — run from a
  scratch copy of the check on DevTools port 9343, because 9333 was taken;
  Found 2.
- `gate-coverage` 261/261 rows pinned, 0 open · `palette-check` ALL GREEN
  (3 pre-existing raw hex, unchanged) · `corpus-check` 0 failures, 0 warnings ·
  `secret-scan` no secrets · `npx tsc --noEmit` clean ·
  `SUPABASE_DB_URL=… npm run build:check` built.

### Proved, not reasoned — both directions, executed

**Before.** I built the scenario against every migration in order and measured
it before writing a line of the fix. `fn_read_level(treasurer, child)` returned
**`none`** before the call and **`full`** the moment the call was logged; the
treasurer held `club_admin` *and* a live `technical_director`; `fn_club_td`
reported `"td_name":"Robin Recorded" … "active":true`. **X1 is real and the
mechanism is exactly as the safety seat read it.**

**After.** The same fixture: `full` → **`membership_only`**, no
`technical_director` membership, `fn_can_work_register` false, and `fn_club_td`
reports `account_name:"Tessa Treasurer", name_matches:false, club_mailbox:true,
active:false`.

**The regression proven on the old code (L20).** I removed the two lines of
predicate from 0060 and re-ran: **1105 passed, 7 failed**, with

```
FAIL H11: a club administrator reads no development record, and a call recording
     the club's own address is not a path to one (D-93)
     — expected "membership_only", got "full"
FAIL td15: … — write was allowed and must not be
```

then restored and re-ran to 1112/0. So the before-direction is measured *inside
the suite*, on the old code, and cannot pass by accident.

**And read off the served page, not the source (L16).** Driving the real call
sheet as the operator, the three states serve:

- *the club's own address* — sheet: "Robin Recorded ·
  football@sunburyunited.example.au · This is the club's own contact address,
  not a person's, so nobody holds the role. …"; queue: "Technical Director Robin
  Recorded · the club's own address, so nobody holds the role · recorded by BUZ
  on 28 Sep 2026".
- *a proved account under another name* — sheet: "The account holding that
  address / **Dana Kovac** / kingsway@example.com / This is not the name recorded
  on the call. …  Active."; queue: "Technical Director Robin Recorded · **active
  on Dana Kovac's account**".
- *the matching case* — Riverside is byte-unchanged: "Technical Director Marina
  Petrovic · active · recorded by BUZ on 28 Sep 2026".

The middle one is the residue below, rendered. Before today that call put a live
club-wide read of every child at Sunbury on Dana Kovac's account and **printed
somebody else's name next to it**.

---

## Found

1. **Six write-suite checks assert a banned word the product correctly stopped
   using.** `scripts/write-tests.mjs:1233-1245` (`sqf4b`–`sqf4g`) expect
   `/home?squad=declined`; `app/squad/actions.ts:118` has served
   `?squad=${yes ? 'joined' : 'no'}` since **2e55439 (23 Sep, release
   hardening)** — correctly, because "declined" is banned on every surface
   including the address bar (D-108) and the permission suite's own `url1 (F8)`
   enforces it. The product moved and the test did not (L32). Nothing to do with
   this change; not mine to fix. **Smallest fix:** `declined` → `no` in those six
   expectations. Worth knowing that the write suite has been six-red at HEAD and
   the last report to run it did not say so.
2. **`scripts/layout-check.mjs:24` hard-codes the DevTools port 9333**, so two
   seats cannot run it at once — and the loser does not fail cleanly, it fails
   with `SyntaxError: "undefined" is not valid JSON` at `:132`, which reads like
   a broken page. My first run was clean because I checked the port was free
   first; my second collided with another seat's Chrome. Same shape as L8 and
   L30, one layer down. **Smallest fix:** `Number(process.env.PITCH_CDP_PORT ||
   9333)`, and say which port a run used.
3. **Free space moved 10Gi upward during my window**, the opposite direction to
   the safety seat's report an hour earlier (6.7Gi avail at my start, 22Gi thirty
   minutes later, 17Gi at finish, with a `build:check` and four PGlite seeds of
   mine in between). Nothing I ran freed 15Gi. Something on this machine is
   creating and releasing several gigabytes on its own — the number in anybody's
   report is a snapshot of a moving figure and should not be read as a delta
   caused by their run. `.claude/worktrees` is not it: my worktree's
   `node_modules` is an APFS clone (`cp -c`) and cost no measurable space.
4. **A symlinked `node_modules` cannot run the dev app.** Turbopack panics —
   "Symlink [project]/node_modules is invalid, it points out of the filesystem
   root" — and the panic arrives *after* "Ready", so the app looks up and serves
   nothing. `cp -c -R` (APFS clone) works and costs no disk. Worth a line in
   TRAINING §4 for the next seat told to work in its own worktree.
5. **Out of my lane, restating the safety seat's X2 because my fixture walks
   straight past it.** `fn_attach_recorded_td` writes a live
   `technical_director` — club-wide read of every child's record — with **no
   WWCC question anywhere on the path**, while the lesser coach grant requires
   `fn_is_verified_adult`. My `td17` attaches Robin Recorded with no attestation
   and reads `full`. That is doc 14 A12 as literally worded, so it is not a
   defect I may fix, and it is the wrong way round.

6. **`npm run build:check` rewrites `next-env.d.ts`** to `import "./.next-check/
   types/..."` and leaves it that way, so the working tree comes back dirty and a
   later `tsc --noEmit` reads a directory the build may have removed. I restored
   the file; nothing is committed with it. Harmless once you know, and it is
   exactly the kind of uncommitted change a seat sweeps into somebody else's
   commit (L30). Whoever owns the release checklist may want the script to put it
   back.

---

## Copy for BUZ

**Six new strings, all on the operator console** (`requireOperator`, dev-gated,
no club or family ever sees them). Nothing here has been approved and nothing
ships until it is. No banned word; Australian English; "Sep" per L18.

Call sheet, `/ops/call/[clubId]`, inside the Technical Director card:

1. *(field label)* `The account holding that address`
2. `This is not the name recorded on the call. The role goes to this account, not to the name above.`
3. `This is the club's own contact address, not a person's, so nobody holds the role. Recorded by BUZ on 28 Sep 2026. Ring the club back and record the Technical Director's own address.`
   — the operator's name and the date are the recorded values, as the two existing sentences in that card already do.

Call sheet, appended to the existing note under the two Technical Director fields
(the sentence before it is unchanged):

4. `Ask for that person's own address: a club inbox belongs to whoever reads it, and the role cannot attach to one.`

Verification queue, `/ops/verification`, the middle of the existing one-line
status (the line reads `Technical Director {recorded name} · {this} · recorded by
{operator} on {date}`):

5. `the club's own address, so nobody holds the role`
6. `active on Dana Kovac's account` — the pattern is `active on {the account's own name}'s account`

---

## Risks

**The residue, and it is a product decision — not mine and not Leo's.**

A recorded name that resolves to a **differently named** account still attaches.
Today's fix refuses only the club's own published address, which needs no
decision: a mailbox cannot be a person under any reading of D-93. But the shape
that remains is the one my own screen-read produced by accident — the operator
types "Robin Recorded", the club gives `kingsway@example.com`, and **Dana Kovac**
gets a live club-wide read of every child at that club. The only thing standing
between that and a child's development record is that an operator now sees a
second name on the page.

**The question for BUZ:** should a recorded name resolving to an account under a
different name be a **hold** — recorded, visible, nothing attached, an operator
rings back — rather than an attach?

**What it would cost.** Small to build, and the cost is not the code:

- *Build:* `fn_td_on_call` gains the same name comparison `fn_club_td` already
  computes (one predicate, one place, the wall and the attach both inherit it);
  the two ops screens gain a held state; two or three checks. **Half a day.**
- *The real cost is false holds, and they are not rare.* "Rob Recorded" for
  Robert, "Dana Kovac" against an account reading "D Kovac", a married name, a
  Turkish or Vietnamese given name typed by ear down a phone line, an operator
  who typed the surname first. Every one of those is a club whose register does
  not open until somebody rings back — and D-154 makes the TD the **only**
  register reader, so a false hold is a paying club that cannot see the thing it
  pays for. The fuzzier the match, the weaker the wall.
- *Two things it needs that do not exist:* a screen or route that **releases**
  a hold (an operator confirming "yes, that is her, she has married since"), and
  a word in the consent-event vocabulary for it — which is safety seat X7's
  point, that the highest-privilege grant in the product currently writes nothing
  to the append-only log at all. Without the release route a hold is a dead end
  and the register never opens; that is L29's shape exactly, and it is why I did
  not build half of it.
- *A middle option, if he wants one:* attach as today, and require the operator
  to tick "I confirm this is the person named on the call" on the sheet before
  the outcome can be `verified` when the names differ — the D-137 pattern of
  turning an anonymous assent into an identified representation, applied to the
  operator instead of the club. Cheaper, no false holds, no release route, and it
  puts a named human behind the mismatch. **I am not choosing between these.**

**What I did not check.** No browser network trace, so J14/J27 are unverified by
me. I did not read `app/globals.css` or the legal renderer — both are other
seats' live work and I stayed out. I did not run `test:paths`. The 190-view layout
measurement used a scratch copy of the check (port only); the committed suite is
untouched. And I did not verify whether the demo layer (`scripts/demo-layer.mts`)
records a `td_email` equal to a club's `contact_email` — it records none today
(`grep td_email` finds only the dev seed), but a demo built for a club whose
mailbox is its published address would now show the new red line, which is the
right answer and is worth a look before the next demo (L14: restart it after a
migration).

---

## Lesson

**A wall made of one field is a wall around one field.** 0058 recorded two facts
about the club's Technical Director — a name and an address — and built the whole
guarantee on the address, because the address is the one that joins. The name sat
on the row, was printed on two screens as though it were the answer, and was
compared to nothing; the screens then reported the wrong human with complete
confidence, which is worse than reporting nothing. When a new rule records more
than one fact about a person, say in the migration which of them is load-bearing
and which is decoration — and if a screen prints the decoration, make it print
the load-bearing one beside it.
