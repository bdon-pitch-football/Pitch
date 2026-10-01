# builder: the safety review's findings on John's batch: B-1 race, S-1, S-3, S-4 and S-5's re-run, erasure photos, two stale checks (2026-10-02)

Asked: fix the review's findings (`2026-10-02-safety-review-john-batch.md`) on `build/batch-fixes`. That branch is `build/full-release` at 16d7a59: John's batch with the photo fix merged. Leo's mid-task addition was `scripts/scrub-sent-bodies.mjs`, sharing one statement with 0169. Worktree `.claude/worktrees/batch-fixes`. Ports: DB 54571, app 3371, CDP 9571.

**Stopped on the main part of B-1** (child writes opening the pending version). See "Stopped on". Everything else is built.

## Did

- **lib/cv-build.ts: B-1, the race.** `publishWith` now runs four steps in one transaction:
  1. take the record's row lock (`select … from development_record … for update`);
  2. read the versions' photos;
  3. build the snapshot;
  4. ask `fn_publish_guardian_change`.

  Before this, the snapshot was read before any lock. A child's save committing in between had its pending version overwritten by a snapshot that lacked the change. Now a child's save in flight finishes before anything is read.
  - Both callers (`publishGuardianChange`, and `saveCvDraft`'s guardian branch) go through it.
  - The child's own save already takes the same row with its first statement.
  - No migration was needed.
- **app/undo/[token]/page.tsx: S-1.** The load and the press both ask `fn_record_actor(u.issued_to, <link's record>) = 'guardian'`.
  - A revoked holder's undo shows the one not-live panel, and its press switches nothing and writes nothing (D-77, A6).
  - An undo is only ever issued to a guardian (`lib/send-dispatch`, `app/ops/call`).
- **app/dev/undo/route.ts** (dev only): mints each undo to a guardian of the record's child, as the product does. It used to mint to the record's owner, which S-1 rightly makes not live. A record with no guardian gets a 400.
- **lib/deploy-secrets.mjs (new) and next.config.mjs: S-3.**
  - next.config's default export is now `(phase) => config`. On `phase-production-build` with `VERCEL_ENV` = production or preview, a missing, blank or under-32-character `NUMBER_HASH_KEY` throws before anything builds.
  - The message names the variable and never its value or length.
  - Development, `next dev`, and the suites' local build (no `VERCEL_ENV`) keep the dev key.
  - The runtime is unchanged and still fail-closed.
  - Proved directly: `VERCEL_ENV=production NEXT_DIST_DIR=.next-s3 npx next build` with no key exits 1 with "Refusing to build a deploy: NUMBER_HASH_KEY is not set…".
- **lib/sent-bodies.ts (new), 0169 §4 (edited in place), app/api/jobs/outbox/route.ts, scripts/scrub-sent-bodies.mjs (new): S-4, and Leo's S-5 re-run.**
  - **One statement**, `SCRUB_SENT_BODIES`: `body = '', subject = null` where the row was sent, failed, or reached `attempts >= 6`, and still holds words.
  - **Why `attempts >= 6` counts as given up:** the sweep claims only `attempts < 6`, and inline sends start at 1, so such a row is never sent again.
  - **0169's backfill** is that statement byte for byte.
  - **The sweep** runs it after every production run's sends. That clears given-up rows, and anything the old code sent with its words in the deploy gap, within the hour.
  - **The script:**
    - plans by default and clears with `--apply`;
    - prints counts only, never the URL, an address or a body;
    - requires `--ca` for a remote database, with TLS verified;
    - refuses 54322 and 54323 without `--i-mean-the-dev-db`;
    - counts with the statement's own predicate (`COUNT_SENT_BODIES`);
    - writes no SQL of its own.
  - **Addresses are untouched** (John's ruling pending).
- **app/g/controls/[childId]/actions.ts: erasure deletes the photo files (D-26).**
  - Before `fn_erase_child`, the button reads every photo path the child's rows name: the live record, plus every `profile_version` of any status.
  - After the erasure commits, it hands each path to `forgetPlayerPhoto`.
  - `removeImage` is still called from lib/cv-build alone (photo7).
  - The button still runs `fn_erase_child` once and deletes nothing itself, so erase6 is untouched. That is why the read is a plain query rather than a client transaction.
- **docs/team/GO-LIVE.md:**
  - The `NUMBER_HASH_KEY` row now says "Production and Preview" and that the build refuses without it.
  - New §5 gives the review's S-5 push order, with the scrub re-run as step 5. Leo may keep or cut this.
- **.env.example:** a two-line note that a deploy build refuses without the key.

## Ran

Final code, in the briefed order: reseed → `next dev -p 3371` → perms → render → write → reseed → restart → layout → the rest.

- **perms 2167/2167**. Baseline on 16d7a59 was 2153/2155, with D-94 §3 and act11 red.
- **render 826/826**
- **write 640/640**
- **layout 274 views at 375 and 1280, ALL GREEN**
- palette ALL GREEN (250 files)
- `tsc --noEmit -p .`: 0 errors
- `NEXT_DIST_DIR=.next-check next build`: exit 0
- `test:csp-prod` (port 3371, dev stopped): 5/5
- `corpus-check`: 0 failures
- `secret-scan`: none
- `gate-coverage`: 264/264, 0 open
- `validate-migrations`: ALL GREEN

My first render run went red at jr-undo-r3, because the dev minter issued undos to an adult owner. I moved the fixture (below) and re-ran the whole line from a fresh reseed.

**Timing (`TIMING_ROWS=jr-undo`, large-heap app on 3371, after layout):**

| Row | With S-1 | 16d7a59 (before S-1) |
|---|---|---|
| jr-undo-t1 (load) | **green**, resolution 0.47ms; used/lapsed/off vs never +-0.05ms, p ≥ 0.53 | green, resolution 0.47ms |
| jr-undo-t2 (press) | **red**, only the live arm: +0.22ms, p = 0.000027 | **red the same way**: live +0.22ms, p = 0.000017 |

On t2 with S-1, used, lapsed and off are not distinguishable (−0.02, +0.01 and +0.12ms). S-1 does not move the parity. The live-press gap comes from the batch (see Found 1).

**New checks (all `bf-`; none carries a doc 14 row id, L4):**
- **perms, 12:**
  - bf-race-1;
  - bf-undo-1 and bf-undo-2 (bf-undo-2 is the control: a current guardian's undo still works);
  - bf-s3-1, bf-s3-2 (calls next.config's export under each environment), bf-s3-3;
  - bf-s4-1 (0169 equals `SCRUB_SENT_BODIES`; the sweep runs it; the script imports it), bf-s4-2, bf-s4-3 (idempotent), bf-s4-4 (script rules);
  - bf-erase-1 (the button's own statement, run on a child with public and private paths in the live record and in approved, pending and superseded versions, plus another child's), bf-erase-2.
- **write, 1:** bf-erase-w1. x3 erases Deniz; his photo files on disk go from 1 to 0, and the address his builder drew goes from 200 to 404.

**Red on the unfixed code (L20):**
- **New perms checks against 16d7a59's product files:**
  - 11 of the 12 new checks went red: bf-race-1, bf-undo-1, bf-s3-1/2/3, bf-s4-1/2/3/4 and bf-erase-1/2.
  - bf-undo-2, the control, passed, by design.
  - Moved photo9 also went red.
- **Injected bugs:**
  - The scrub without `attempts >= 6`: bf-s4-2 red.
  - The press without the guardian check: bf-undo-1 red.
- **bf-erase-w1:** shown with a scratch probe, not committed, that makes the same assertions as the check, through the running app.
  - Old `actions.ts`: files 2 → 2, address 200 → 200.
  - Fixed: 1 → 0, 200 → 404.
  - The committed write check itself was not run against the old file.
- **D-94 §3 and act11:** red at baseline with their old regexes (`2153 passed, 2 failed`).

**Moved checks (none loosened):**
- **D-94 §3 (player photo)** and **act11 (photo route)** now also accept `recordAuthor(`, the route's non-redirecting guard on `fn_record_author`. The strength is the same as `recordActor`.
- **photo9** pins the new order inside `publishWith`: lock, then photos, then snapshot. Still forget-after-commit.
- **jb-body-2's** extraction regex accepts the widened predicate. Its row assertions are unchanged.
- **photo13** classifies `app/g/controls/[childId]/actions.ts` as `'erases'`.

**Fixture moved (L32):** jr-undo-r1/r2/r3 and timing jr-undo now mint against Nate's record (his parent is his guardian), not the adult player's. Render presses none of these. Timing is last, and a reseed follows it.

**scripts/scrub-sent-bodies.mjs against dev (54571):**
- Plan with my three test rows (given up, try left, sent with a body): 2.
- `--apply`: cleared 2, still holding 0.
- Plan again: 0. Apply again: cleared 0.
- The row with a try left kept its words, and every address stayed.
- Refusals: on 54322, on a remote URL without `--ca`, and with no URL. Each exits 1.

## Found

1. **jr-undo-t2 is red on 16d7a59 already.**
   - A live press is 0.22ms slower than a press on a never-existed token. That is the batch's switch-off event plus `fn_send_log`, which N-7 predicted and nobody measured.
   - It lands on Done, which already says the link went off, so the clock reveals nothing the page doesn't. But the gate row is red.
   - Leo: rescope the live arm, or make the not-live press do the same work. Not mine; not touched.
2. **S-1 adds a not-live state that no timing arm measures** (the holder is no longer a guardian).
   - It costs one `fn_record_actor` call that used, lapsed and off short-circuit past.
   - Only the ex-guardian holds such a token, and they already know the link exists. Not measured.
3. **Erasure leaves a 16–17's coach photo.**
   - `person.photo_path` can hold a coach key (photo-review: a 16–17 MiniRoos coach writes the same column). `forgetPlayerPhoto` takes player photos only, so a coach file survives the erasure.
   - Also, a legacy public copy that no row names any more is not found, by design.
4. **B-1 is live on this branch (probe on a fresh seed, through the app).**
   - Deniz adds a clip and a photo, and his link shows neither.
   - Alex adds an achievement on /build/more. The link now shows the achievement, the child's clip **and** the child's photo, and /g/pending says "Nothing is waiting on you."
   - The same probe also showed Found 6 of the batch report. Approving the seed's waiting About change from /g/pending published a clip that screen never showed.
5. **The scrub now runs hourly in the sweep, on every sent, failed or given-up row that still holds words.**
   - That is the statement 0169 runs; normally it matches nothing, because dispatch already cleared those rows.
   - It also closes S-5's gap on its own within the hour. The script is the belt.

## Stopped on

**B-1, the child's own writes (clips, achievements, other football, photo).** I built nothing here, as briefed: opening a pending version on those writes leaves a version the parent can neither see nor approve on /g/pending.
- The screen shows only the About diff, headed "Only this change needs you. Everything else stays exactly as you approved it." For a clip-only change that line is false, and the About diff shows the same text twice.
- `if (!done && !r.pending_about)` answers "Nothing is waiting on you." for a blank About, so such a version could never be approved, and every later guardian save would join it and publish nothing.

So B-1's leak stands on this branch, and **John's batch should not ship with F14 until this is ruled.** Production is unaffected: 0169 is not there, and before F14 a guardian's save waited for approval.

Options, for BUZ and John (not chosen):
- **(a) Leo's plan, with BUZ's words.** /g/pending shows what waits for each kind: the photo (photo-review proposed "The photo" / "No photo yet"), the clips, the achievements and other football. It tests that a pending version exists instead of `pending_about`. Then every child write upserts the pending version and writes `edit_submitted`, as `saveCvDraft` does, and 0169's join branch covers every case. This also closes doc 14 R1's "a clip title" and the batch report's Found 6. Needs words and a design pass.
- **(b) No new words: a guardian publishes only their own change.** The guardian's edit is applied to the approved snapshot as a delta: the field or row they touched. That is what photo-review's `publishGuardianPhoto` did for the photo, and what S-2's smallest fix proposes for removals. The child's live-only content keeps waiting. It does not fix Found 6: a child's clip still rides their next About edit unseen. It changes F14's "the page as it stands becomes the approved version", so John should confirm.
- **(c) Restrictive, no words:** a guardian's save never publishes while the live record holds child-written content the approved page lacks. That is S-2's silent non-publication again, and it still opens a version /g/pending cannot show.
- **(d) Hold F14 for clips, achievements, other football and photo** until (a). This is John's ruling to reopen.

Write tests (a) needs, all red today: child clip then parent achievement; child photo then parent achievement; the parent's save while either waits publishes nothing until approval.

**Not built, as briefed: S-2** (a parent's removal while a child's change waits silently doesn't publish). It needs words and John's ruling on the waiting case, and it interacts with whichever B-1 option is chosen.

## Copy for BUZ

None added, changed or removed. Not user-facing, for Leo:
- the build refusal in Vercel's log ("Refusing to build a deploy: NUMBER_HASH_KEY is not set, or is too short to be the real key (at least 32 characters). Without it production sends no SMS, so no under-16 could be approved. Set it in this Vercel environment (docs/team/GO-LIVE.md) and build again.");
- the script's count lines;
- the GO-LIVE §5 text.

## Migrations

**0169 edited in place** (not in production): §4's statement now also clears given-up rows, and the header says why. No 0170.

## Risks

- **The race fix is pinned by statement order (bf-race-1), not by two interleaved transactions.** PGlite serves one connection and there is no real Postgres on this machine, so no suite here can run the race. The reasoning is Postgres row locks under read committed.
- **Preview builds now fail without the key.** Set it in Preview too (GO-LIVE §2), or every preview deploy fails until it is set.
- **next.config is now a function.** Vercel and Next 16 support this (docs: next-config-js, async configuration). It was proved only by a local build, not on Vercel.
- **The scrub runs every hour.** It is cheap on a small table, but it has no index on `attempts`.
- **Photo deletion runs after the erasure commits.** A failed delete leaves an unnamed file, as `forgetPlayerPhoto` already accepts. An upload racing the erasure can still leave its new file behind.

## Lesson

A dev fixture that mints a credential for someone the product never issues it to stays green until the product starts asking who holds it. `/dev/undo` minted undos for the record's owner, and it took S-1 to show they were never like the real ones. Mint suite credentials for the person the product would.
