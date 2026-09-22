# build: the Technical Director comes off the verification call (2026-09-23)

Asked: BUZ's option A — a club gets its Technical Director on the verification call and
nowhere else — as migration 0058, enforced in Postgres, with the operator screen and the
tests; handover out of scope.

Did: one migration, three product files, three suite files. Branch
`worktree-agent-af83a872cd5bec212` (its own worktree, cut from `app` at `28b083c`), commit
**`49c6497`**. Not pushed.

**`supabase/migrations/0058_td_on_the_call.sql`** — the whole rule is here; the action is
only a caller.

- **The call records the person.** `verification_call.td_name` and `.td_email`, with a
  check constraint that refuses them on any call whose outcome is not `verified` — so the
  TD is captured at the same moment as the verification, against the operator and the
  timestamp already on that row (D-137: a human, named, logged).
- **What it grants, and when.** `fn_td_membership_write_rule` refuses a
  `technical_director` membership unless **all four** hold: the club is `verified` (D-126),
  a verified call for that club recorded this person's address (D-93), the address is
  **proved** (`fn_email_proved`, 0056, L21), and the person is 18+ (D-82 — club-wide read
  across children's records is never held by a minor). It fires on insert **and** update,
  so reviving an ended membership is re-checked; ending one is untouched, which is what
  keeps doc 14 H9 working.
- **Where the attachment happens, and why there.** Two triggers, on the two events that
  can make the rule true: `club_verified_attaches_td` (the club becomes verified, or is
  re-verified, with a TD recorded) and `person_proof_attaches_td` (that address becomes
  proved, by any of the three routes 0056 accepts). **Not a check on sign-in:** sign-in is
  one door of several — a guardian approval, a reset and the confirm link all prove an
  address — so a check there would be a rule only some paths obey, and a club's register
  would switch on when somebody last opened a browser rather than when the proof happened.
  `fn_attach_recorded_td` is quiet by design (returns null, never raises) because both
  callers are triggers on events that happen whether or not there is a TD to attach.
- **`fn_club_td(club)`** is the one answer the screens read: who, recorded when, by whom,
  and whether the role is live (L23 — no page builds its own version of this).
- **No grandfathering.** The migration ends any live `technical_director` membership the
  path would not have written, so the invariant is true of the table, not only of future
  writes. There is no production data; on a dev database it is a reseed.
- **Handover is out of scope** (BUZ: fast-follow) and says so in the migration header and
  on the call sheet, which is where a reader looks for it.

Product:

- **`app/ops/call/[clubId]/actions.ts`** — records the two fields, and drops them when the
  outcome is not `verified` (the table refuses them anyway). It does **not** write the
  membership: the database decides.
- **`app/ops/call/[clubId]/page.tsx`** — the two fields, the sentence under them, and a
  panel above the form showing the club's current TD: name, address, recorded by whom and
  when, and active or waiting.
- **`app/ops/verification/page.tsx`** — the same in one line per club in the queue, from
  `fn_club_td` through a lateral join.

Seeds and fixtures (they wrote the role directly and now cannot):

- **`scripts/dev-db.mts`** — Riverside's and Kingsway's calls record their TD, and proving
  the address is what attaches the membership. `tdOrThrow` makes a seat that did not
  attach a loud failure rather than a quiet one. Plus `DEV_DB_PORT` (default 54322,
  unchanged for anyone who sets nothing) — the hook both 23 Sep builders asked for, so a
  second worktree can run a suite (L30). Harness, never a product path.
- **`scripts/permission-tests.mjs`** — `recordTd()` builds a TD the way the operator does;
  for a club that must stay unverified it puts `club_state` and `verified_call_id` back
  afterwards, which is the real shape "verified, named its TD, later lost verification"
  (H5/M10) and keeps M4's expectFail honest.
- **L4 fix in my lane:** the check labelled `H10: reinstating the role restores it` tested
  no doc 14 row — H10 is "a person self-declares `technical_director`". Relabelled `H9c`,
  and the real H10 is now written. Table H has more of this (the suite's `H8` tests doc
  14's H9, and so on); I left the rest alone and am reporting it.

Tests — 15 new in the permission suite (`td1`–`td12`, `H10`), 8 in the write suite
(`td-w1`–`td-w6b`, which walk the real console: the queue, the sheet, the press, and the
person's own confirm link), plus the operator console added to the layout check's deep list
(nothing in the product links to it, so neither the queue nor the call sheet — the most
field-dense form we have — had ever been measured).

**L20 — every new check proved able to fail**, each on a throwaway copy of the tree with
one rule removed and nothing else touched:

| Rule put back | What failed |
|---|---|
| write-rule trigger removed + the old self-declared TD written into the fixture | `td1 td2 H10 td3 td7 td8b td9 td10 td10b td12` (10) |
| `verification_call_td_with_verified` constraint removed | `td4` |
| the proof requirement removed from the attach and the rule | `td5 td7 td8` |
| `person_proof_attaches_td` removed | `td8` |
| the club-verified check removed from both | `td11 td12` |
| the 18+ check removed from both | `td10 td10b` |
| `logCall` stops storing the two fields (write suite, real app) | `td-w4 td-w5 td-w5b td-w6 td-w6b` |

Ran: the full TRAINING §4 sequence, from a fresh seed, in order (reseed → perms → render →
write → reseed → layout), in my own worktree on its own ports (database 54326, app 3200 —
the other builder's 54322/3000 were never touched), **measured on the committed tree
`49c6497`**:

| Suite | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run test:perms` | **1037/1037**, 0 failed (was 1022) |
| `npm run test:render` | **369/369**, 0 failed |
| `node scripts/write-tests.mjs` | **303/303**, 0 failed, 92/92 forms submitted (was 295) |
| `node scripts/layout-check.mjs 375 1280` | **188 page views, 0 overflow** (was 184) |
| `node scripts/gate-coverage.mjs` | 261/261 rows pinned, 0 open |
| `node scripts/palette-check.mjs` | green, 14/14 colours, 3 raw-hex infos (pre-existing) |
| `python3 scripts/corpus-check.py` | 0 failures, 0 warnings |
| `node scripts/secret-scan.mjs` | no secrets |
| `SUPABASE_DB_URL=… npm run build:check` | exit 0, compiled, 22/22 static, `/ops/call/[clubId]` present |

Found:

1. **Nobody tells the recorded TD.** No message goes to the address on the call — nothing
   in doc 15 covers one, and D-154 set the precedent that the coach grant sends nothing.
   So today the club must tell its own TD to sign up with **that exact address**; if they
   use another one, the role never attaches and the screen says "waiting" forever. Doc 27's
   script has BUZ saying it on the call, which may well be enough. **If BUZ wants a
   message, it is a product decision and a doc 15 addition; I did not make one.**
2. **Doc 27 is now one question and two log fields behind the build.** Its log table lists
   thirteen fields and the call sheet writes fifteen, and its script never asks for the
   TD's email. The sheet still stamps `policy_version '27@v1.0'`. The doc is BUZ's own
   one-pager and I did not edit it. Proposed, for him: a question at step 5 —
   *"Last one: who's your technical director, and what's the best email for them? They're
   the only person at the club who'll be able to see anyone who registers with you, and it
   only switches on once they've confirmed that address from their own account."* — plus
   `td_name` and `td_email` in the log table and a bump to `27@v1.1`.
3. **A typo in the address is silent, and so is an under-18 account on it.** The screen
   says "waiting on their account" in both cases; it cannot distinguish "nobody has that
   address yet" from "an account we will never give the role to". That is deliberate (the
   console should not answer "does this address have a Pitch account"), but an operator
   could chase a ghost. Say if you want the operator told more; it is a decision about
   what the console may disclose, so I did not take it.
4. **`scripts/migration-on-data.mjs` writes a `technical_director` membership directly**
   into its base-schema fixture, so when 0058 applies it will report that membership being
   ended. That is the tool doing its job, and the release seat should expect the line. Not
   my file to change; not changed.
5. **The queue's "claimed by …" line** still reads from the first `technical_director` or
   `club_admin` membership, which after 0054 is "club admin" for every newly claimed club
   (builder A reported this). Untouched — the new TD line sits beside it and says the part
   that matters.
6. **Two clubs named "Kingsway Rovers FC"** in the dev seed (a player fixture's club at
   Altona, and the free verified club at Brunswick West). They sit next to each other on
   the verification queue and read as a duplicate. Pre-existing; not mine.
7. **The machine ran out of disk twice during this work.** The worktree's `.next` dev cache
   reached 1.1 GB and this session's scratchpad held 3.4 GB of an earlier builder's
   checkouts; with both cleared the volume has about 4 GB free, which is not much for a
   seat that runs a build. Worth knowing before QA runs the sweep.

Copy for BUZ — every new user-visible string, verbatim, all operator-console only
(nobody outside Pitch reads any of them), all proposals:

**Call sheet, the two new fields**

```
Technical Director — the name they gave you on the call. Recorded only when the outcome is verified.
```
placeholder: `Full name`

```
Technical Director — their email address, as the club gave it
```
placeholder: `name@club.example.au`

**Call sheet, the note under those two fields**

```
This is the only way a club gets a Technical Director — never a form, never a claim, never someone saying so. The role switches on when that person confirms the address on their own Pitch account, and not before.
```

**Call sheet, the panel above the form** — label `Technical Director`, then the name, the
address, and one of:

```
Active. Recorded by BUZ on 23 Sep 2026.
```
```
Waiting on their account. Recorded by BUZ on 23 Sep 2026. The role switches on the moment that address is confirmed on Pitch.
```
```
None recorded. Until this call records one, nobody at this club can open its register.
```

**Verification queue, one line per club**

```
Technical Director Marina Petrovic · active · recorded by BUZ on 23 Sep 2026
```
```
Technical Director Casey Duarte · waiting on their account · recorded by BUZ on 23 Sep 2026
```
```
No Technical Director recorded
```

Risks, and what I did not check:

- **Handover's absence has a shape, and it is worth reading twice.** A later call naming
  someone else **adds** a TD; it does not end the first one. A club that changes its TD
  ends up with two live TDs, both reading the register, until the fast-follow. Nothing in
  the product removes one — only ending the membership in the database, or the club losing
  verification (which ends the reads, not the row). This is the decision as given; it is
  the first thing the fast-follow has to fix.
- **A correction is an addition too.** If the operator mistypes the address, the fix is a
  fresh call with the right one — which records a second TD, per the line above.
- The migration's cleanup ends any TD membership that the path would not have written. On
  a live database that would be a real capability being withdrawn; there is no production
  data, and the dev database is a reseed.
- I opened the console in a browser only through the layout check's headless Chrome. **QA
  should look at `/ops/verification` and a call sheet at 375 and 1280 with their own eyes.**
- I ran the write suite twice without a reseed at one point while chasing the forms count
  (L7, my slip). Every number reported above comes from a fresh-seed run on the committed
  tree; the extra run measured nothing and is not in the table.
- The demo needs a restart after this migration before anyone opens it (L14).
- I touched none of 0057's files: `lib/db.ts`, `lib/messaging.ts`, `app/join/page.tsx`,
  `app/club/squads/actions.ts`, `scripts/demo.mjs`, `lib/storage.ts`, the daily job.
  **Somebody should re-run the sequence once 0057 and 0058 are both in.**
- `next-env.d.ts` is machine-written and kept flipping between `.next-demo` and
  `.next-check`; I left it at HEAD rather than committing the churn.

Lesson: **a rule that waits on somebody else's action needs a watcher, not a check at a
door.** The role here can only become real when a person proves an address, and the
tempting place to notice that is sign-in — where it would have been a rule only some paths
obey, and a club's register would have switched on according to who last opened a browser.
Hanging it on the event itself (the proof, and the verification) meant the seed, the tests
and the product all take the same path, and it is why the fixtures had to become honest:
the permission suite can no longer write the role it is testing.
