# Safety review: John's batch (21a1225..build/john-batch, merged into build/full-release at 1961a42)

Reviewer: safety seat · 2 Oct 2026 · requested by Leo

**Read:** John's ruling (`13-Board-Room/JOHN-to-LEO-the-batch-photo-first-1-oct.md`), the builder's report, doc 14 (A, L, Q, R), doc 23 v1.7 (root `legal/23`), and the full diff 0ac2b62 + fae9c5a. I read every touched file in full on build/john-batch, plus these callers: `lib/record-guard`, `lib/record-read`, `lib/link-switch`, `lib/send-dispatch` (undo minting), `app/ops/call` (undo minting), `app/g/controls/actions` (renew), `app/g/pending`, `app/squad/actions`, `app/api/jobs/outbox`, `lib/guardian-flow`, 0020, 0048, 0054, 0077, 0120 and 0167. I also compared against build/photo-review (52eb643), which is not merged yet.

Line numbers are on build/full-release (1961a42).

---

## BLOCKERS

### B-1 · F14: a guardian's save publishes the child's unreviewed clips, achievements, other football and (after photo-review) photo

- `supabase/migrations/0169_john_batch.sql:133`: the only "child's change is waiting" test is `exists profile_version … status = 'pending'`.
- `lib/cv-build.ts:259,269`: `publishWith` → `buildSnapshot` snapshots the **whole live record**.
- Callers: `app/build/[recordId]/clips/actions.ts:54,64`, `app/build/[recordId]/more/actions.ts:36,46,71,81` and `lib/cv-build.ts:77`.

**Why it leaks.** A child's own clip, achievement or experience write goes to the live tables and creates **no** pending version (the builder's Found 6 confirms this). The u16 page clubs read is the approved snapshot (`lib/record-read.ts:115`), so until now those writes were held from clubs. F14's publication snapshots the live tables, finds no pending row, and makes all of it the approved version, with `approved_by` set to the guardian and an `edit_approved`/`guardian_edit` event naming the guardian.

**Scenario.**
1. Mia (14) adds a clip titled "Year 9 at St Kilda Secondary, Saturday 9am" on /build/clips. Nothing waits, and nobody is emailed.
2. Her dad opens /build/more and adds "Club B&F 2025".
3. `publishGuardianChange` sees no pending row and publishes.
4. Every club holding Mia's link now sees the clip. The /more page Dad saved from never showed it to him.
5. The history says "Dad changed the page", so the record attributes the child's content to the parent. On the actor question the record is untrue.

**After photo-review merges, this gets worse.**
- That branch writes a child's new photo to `person.photo_path` only, so it waits for a guardian (S-3 part 1).
- `buildSnapshot` reads `p.photo_path`.
- So **any** guardian edit puts the child's unapproved new face on the approved page, which reopens S-3.
- photo-review's own `publishGuardianPhoto` deliberately moves only the photo: "the rest of the live record may hold the child's unapproved edits, and those still wait". The two branches' designs contradict each other.

**There is also a race that reaches the same place for main-form edits.**
1. The guardian's snapshot is taken before the child's `saveCvDraft` commits.
2. `fn_publish_guardian_change`'s `for update` waits for that commit, then sees the new pending row and overwrites it with the guardian's snapshot. That snapshot does **not** contain the child's change (0169:134).
3. The guardian approves that pending version.
4. The child's About is now live-only with no pending row, so the next guardian edit publishes it unreviewed.

**Smallest fix.** Make every write a u16 child makes for themselves (`addClip`/`removeClip`, the four /more actions, and the photo route) upsert the pending version and write `edit_submitted`, as `saveCvDraft` does. This also closes Found 6 and doc 14 R1's "a clip title". The existing "pending exists → join" branch then covers every case. For the race, build the snapshot inside `fn_publish_guardian_change` after the `for update` (or take the row lock before `buildSnapshot`), not before it.

Add a check:
- a child adds a clip;
- the guardian adds an achievement;
- assert the approved content has no such clip.

### B-2 · N-10 is not closed: a 16–17's parent can still replace the 16–17's photo

- `app/build/[recordId]/photo/route.ts:21` still guards with `recordActor` (fn_record_actor), which answers 'guardian' for a 16–17's parent.
- `:49` then writes `person.photo_path`. For a 16–17 the live record **is** the page, so the parent's photo is public at once.
- build/photo-review has the same guard (`photo/route.ts:47`).

**Scenario.**
1. Nate (17) has a page.
2. His mother is signed in. /build/{id} now sends her to /home, but she (or anything she runs) POSTs a multipart form to `/build/{id}/photo`.
3. The upload succeeds and redirects to `/build/{id}?saved=1`, and every club holding Nate's link sees the photo she chose.

**Why this is a blocker.** John: "a guardian's write to a 16–17 record is denied … This is live today, so it goes in this release". Doc 14 R12, as committed, says it is asserted "on every `/build` surface". That claim is untrue on this route.

**Smallest fix.**
- Add a non-redirecting `recordAuthor(recordId)` to `lib/record-guard` (fn_record_author) and use it in the photo route, keeping the 303.
- Carry the same change into photo-review at merge.
- Add R12d: a 16–17's guardian POSTs a photo and `person.photo_path` is unchanged.

---

## SHOULD-FIX

### S-1 · The undo now outlives its holder's guardianship: it never re-checks who it was issued to

`app/undo/[token]/page.tsx:60` (load) and `:93` (press) judge "live" by the link's own expiry. Renew (`app/g/controls/[childId]/actions.ts:100`) gives **every** live link on the record another 90 days, so every outstanding undo for that record now lives as long as anyone keeps renewing. Before this change an undo died at its own mint date, which is at most the link's original expiry. Neither the load nor the press asks whether `u.issued_to` is still a guardian.

**Scenario.**
1. Parent A's guardianship of Mia is revoked, for example after a family dispute. Under A6, Parent A gets "Nothing".
2. Parent B keeps renewing the link Mia's club holds.
3. A year later Parent A opens the old §37 email and presses "Switch it off". Mia's club link dies.
4. Parent B's history shows "One club's link was switched off" with Parent A as the actor.

The effect is fail-safe (a switch-off, no disclosure), but it is a control held by someone doc 14 says holds nothing, and this change made it unbounded.

**Fix.** Add `and fn_record_actor(u.issued_to, st.record_id) = 'guardian'` to both predicates. The not-live panel stays identical, so D-77 is unaffected. Re-run jr-undo-t1/t2.

### S-2 · F14 with a child's change waiting: the guardian's edit silently doesn't publish, and a removal stays on the clubs' page

`0169_john_batch.sql:133-135` returns `'pending'`, and every caller ignores the return value and redirects as for a publish (`clips/actions.ts:54-55`, `more/actions.ts:46-47`, `actions.ts`).

**Scenario.**
1. Mia has an About edit waiting.
2. Her mother sees on /build/clips an old clip that names Mia's school, and presses Remove.
3. The removal joins the pending version, and the approved page every club reads still carries the clip.
4. Nothing tells her. She believes she took it down: the §36 false-assurance class.

This was in the builder's "Stopped on 2" for John, but the safety-relevant case is the **removal**, and the ruling question should say so.

**Smallest fix (no new words).** For a removal, also apply the deletion to the approved snapshot's array (jsonb, by title+url, or by achievement/experience fields). That publishes nothing of the child's. Anything more is John's call: options (a)/(c) in the builder's report.

### S-3 · With no NUMBER_HASH_KEY, an under-16's approval text is refused, not queued, and the screens then say a text went

`lib/messaging.ts:115` returns `sms_no_key` **before** the D-168 queue. `sendAndLog` writes nothing, and the invitation's SMS channel never exists. Because approval needs both channels (D-156), every under-16 and 16–17 sign-up made while the key is missing can never be approved. They die at 14 days.

What the family sees in the meantime:
- The child's waiting page (`app/join/waiting/[id]/page.tsx:99`) shows "{channels} · 04•• ••• 181", not TEXT_WAITING, because nothing is queued. It implies a text went.
- The parent's emailed /a says "Open the link we texted to you" (`app/a/[id]/page.tsx:100,166`).

So production fails closed, which is correct, and nothing falls back to sha256 (`lib/number-hash.ts:35`, verified, and no other hasher of numbers exists in app/, lib/ or scripts/). But it fails **silently**, and depends on one GO-LIVE row being followed.

**Fix (either):**
- Make a missing or short key loud in production: refuse to start, or put an /ops red line and a cron-health failure on it.
- Or queue a waiting text with no fingerprint and fingerprint it at release. `releaseWaitingTexts` already re-keys from `to_address` at `:304-315`, but 0120's check constraint needs a non-null hash, so that option needs a migration.

### S-4 · Sent bodies: stranded rows still keep raw credentials indefinitely

`lib/messaging.ts:250,260-264` clears the body on success and on permanent failure.

A row the sweep gives up on is different: `app/api/jobs/outbox/route.ts`, `attempts < 6`, with `failed_at` still null. It never sends, never fails and never clears, so it keeps its body forever. 0169's scrub (`:214`) skips it for the same reason. Those bodies hold:
- raw `/p/{token}`, `/undo/{token}`, `/reset/{token}` and `/a/{code}`, against D-80's "stored hashed";
- the child's first name and age.

That leaves doc 23's "we do not retain message bodies" untrue for exactly the messages that went wrong. `to_address` is also kept on every sent row indefinitely. Doc 23 says "we hold the fact of sending, not the message", which is arguable for an address. The builder flagged this for John. I agree it needs a ruling before doc 23 v1.7 syncs.

**Fix.** In the sweep (or the daily job), mark rows with `attempts >= 6` and `last_attempt_at` older than a day as failed (`'stranded'`) and clear the body and subject in the same statement. The ops failure list then shows them, too.

### S-5 · Push order: 0169 with the old code serving leaves bodies and STOPs behind

Order constraints:
- The new code cannot go first: `requireRecordAuthor` and `publishGuardianChange` call functions only 0169 creates, so /build would 500.
- So the migrations must go first. In the gap, the old `dispatch()` keeps writing bodies for every message it sends, and 0169's scrub is one-off.
- In the same gap the old webhook would record any STOP as plain sha256, which no keyed lookup will ever match (a Spam Act exposure), and 0169's empty-table guard has already passed.

**Required order:**
1. Set `NUMBER_HASH_KEY` in Production and Preview.
2. Confirm `select count(*) from sms_opt_out` = 0.
3. Apply 0167 → 0168 → 0169.
4. Push the code immediately.
5. Re-run 0169 §4's UPDATE. It is idempotent.
6. Re-check `sms_opt_out` = 0.

Write this into GO-LIVE. Today the builder lists only the migration order.

---

## NOTES

**N-1 · photo-review will contradict this batch at merge.**
- Its `publishGuardianPhoto` (photo-review `lib/cv-build.ts:171`) checks `fn_record_actor`, not `fn_record_author`.
- It writes `edit_approved` **with** a subject and **without** `kind: 'guardian_edit'`. The other guardian's history would then read "You approved a change" (`app/g/controls/[childId]/page.tsx:126`), which is false for them, instead of BUZ's line.
- Reconcile at merge: one publication path, the B-1 fix, `kind: 'guardian_edit'`.

**N-2 · 0167's No cannot scrub the meter row of a text that went straight out.**
- `send()` writes no `number_hash` on the outbox row (`lib/messaging.ts:178`). Only `fn_sms_queue` does.
- So 0167's `where number_hash in (select number_hash from message_outbox where invitation_id = …)` (`0167:110`) finds only queued texts.
- The keyed fingerprint of a directly-texted parent's number survives the No until the daily job zeroes it: more than 25 hours old, so up to about 49 hours. Doc 23 says "dropped after 24 hours".
- It is keyed now, so the exposure is small, but the after-page says "the details we held are deleted".
- Fix: store `h` on the outbox row in `send()` too.

**N-3 · With no key, the webhook answers 503 and the STOP is not recorded** (`app/api/webhooks/sms/route.ts:47`). As far as I know Twilio does not retry inbound webhooks. This only bites if the key is unset or changed after SMS has gone live. GO-LIVE says "never change it"; add "never unset it".

**N-4 · Grants and the security model are sound.**
- Neither new function is `security definer`, so there is no `search_path` exposure. Neither is any function in the repo.
- `fn_publish_guardian_change` is revoked from PUBLIC, anon and authenticated, and re-derives the guardian itself (`0169:127`). The guardian id always comes from the session through `requireRecordAuthor`, and `lib/cv-build` is `server-only`, not `'use server'`, so the function cannot be called as an action.
- `fn_record_author` keeps default grants, like `fn_record_actor`. It is invoker and RLS-bound, and I found no oracle in it.
- Minor: its authorship check runs before the `for update` (`0169:127-129`). This is harmless.
- `fn_record_author` also, correctly, drops the re-granted adult's guardian (L9), which `fn_record_actor` allowed to author.

**N-5 · What a 16–17's guardian kept and lost.**
- Kept: /build preview and ready, /g/pending (R11), /share-card, /register-interest, /send (fn_can_dispatch L6/L7), the controls, the held sends and squad claims (`fn_can_act_on_squad`).
- Lost: authorship only, as ruled.
- One visible loss: /build/more was the one surface that listed a legacy pre-D-161 school entry unfiltered, with Remove. Only the 16–17 can remove it now. Nothing public shows it.
- The builder's Found 7 (`issueShareLink` for a 16–17's parent) stands for John.
- An under-16's guardian still authors on every /build surface.

**N-6 · F15 verified.**
- No GET ends anything. `endRequest` is a server action, and `approve` diverts `answer=end` to it.
- The invitation id is refused. `mayEnd` is false with no channel, and `fn_end_pending_invitation` matches token hashes only.
- `confirmed` is read under the row lock from the pressed link's own column (`0167:178-185`), so it is truthful.
- No new oracle. F15 *removes* one: the No on an unconfirmed link used to tell the person at a wrong number that the other channel had been confirmed.
- One consequence for John: an unconfirmed holder can now end a **16–17's** request, and the 16–17 has no re-ask door until F5 is ruled. That was already true at the 14-day expiry.

**N-7 · The undo's event.**
- Actor = `issued_to`, the person it was mailed to. The link is a bearer link and forwardable, so "who pressed" is an inference.
- `club_name` comes from `fn_send_log(issued_to, child)`, which returns nothing for a non-guardian, so no club leaks.
- The event is written only when a link went off. The data-modifying CTE runs even though the final select doesn't read it, which is correct.
- Timing: the not-live paths (used, lapsed, off, never) keep the same shape. The new insert runs only on a live press, which already differs visibly (Done). **Not measured.** Run jr-undo-t1/t2.

**N-8 · `fn_consent_timeline.who` checks `approved_at` but not `revoked_at`** (`0169:180-184`). An ex-guardian's past edit still shows their first name to the remaining guardian. That is defensible as history, but the header says "only for an actor who is a guardian of the child".

**N-9 · Hashing agrees everywhere.** send(), the STOP check, `fn_sms_queue`, the meter insert, the webhook and the release re-key all use the one normaliser and key. `04xx xxx xxx` (the only shape /join accepts, `app/join/actions.ts:14`) and Twilio's `+614…` hash as one number. Separately, Found 8 (the provider is given the number un-normalised) must be fixed before SMS go-live.

**N-10 · The 0169 backfill is production-safe.**
- One UPDATE on sent and failed rows only.
- Row locks only, with no overlap with the sweep's unsent rows, and a small table since launch.
- Idempotent.
- `drop`/`create fn_consent_timeline` is in one transaction, and the old /g/controls query reads only the old columns.
- One catch: the `raise` in §3 aborts all of 0169, including N-10 and F14. The new code would then 500 on /build, so check the count first (S-5).

---

## Answers to Leo's seven, in one line each

1. **N-10.**
   - The photo route is still open to a 16–17's parent (B-2).
   - Nothing doc 14 gives that parent was lost beyond authorship (N-5).
   - An under-16's parent still authors.
   - The function's model is sound (N-4).
2. **F14.**
   - A child's edit **does** reach clubs unreviewed by riding a guardian's save (B-1).
   - The "joins pending" path holds only for main-form edits, and even there not under a race.
   - The actor is recorded as the guardian for content the child wrote.
   - The other guardian gets no message, as before for an approval. They now see a named history line, as ruled.
3. **F15.** Sound (N-6).
4. **Undo.**
   - It cannot reach another family's link.
   - It does outlive the holder's guardianship (S-1).
   - The event is clean (N-7).
   - Timing was not measured.
5. **Keyed hash.**
   - Production fails closed with no plain fallback.
   - Every component agrees (N-9).
   - 0167's scrub misses direct-sent texts (N-2).
   - With no key, an under-16's approval text is **refused, not queued** (S-3).
6. **Bodies.**
   - Nothing that a receipt, retry, the funnel, support or erasure needs is lost.
   - Stranded rows and addresses are still kept (S-4).
   - The backfill is safe (N-10).
7. **Order.** Not safe as listed. Use S-5's order.

## What I did not do

- **I did not run any suite.** That includes `test:perms`, the write and render suites and the timing suite. The full-release worktree is mid-run on its own database, the main checkout is on `app` (production code), and I was told not to check anything out.
- **I did not probe a database.** The john-batch DB on 54561 is down and I did not start one. B-1 and B-2 come from reading the code, with the lines cited. Each needs a red-first check.
- **I did not review build/photo-review as a change.** I read it only where it meets this batch.
- I did not check production counts (`sms_opt_out`, the S-4 leftovers), Resend or Twilio retention, or doc 15 beyond the §7 line.
- I did not check the layout or the copy.

**Count: 2 BLOCKER · 5 SHOULD-FIX · 10 NOTE**
