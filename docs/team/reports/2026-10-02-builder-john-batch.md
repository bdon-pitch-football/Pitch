# builder: John's batch — F15, F14, N-10, the undo, the STOP-list hash, sent bodies, doc 15 v1.5 §7 (2026-10-02)

Asked: build John's batch (JOHN-to-LEO-the-batch-photo-first-1-oct, BUZ: "John, take the batch") on `build/john-batch` from 21a1225, plus Leo's two mid-task additions (the 14-day job's event says `expired`; BUZ's F14 history line). Worktree `.claude/worktrees/john-batch`; ports DB 54561, app 3361, CDP 9561. Not the photo side of F14 or S-3.

Commit: **0ac2b62** (the batch) plus a second commit carrying this report and an APPROVALS check-id fix. Nothing pushed, merged or deployed.

Did:
- **supabase/migrations/0167_a_parent_can_end_the_request.sql** (edited in place; not in production). F15: `fn_end_pending_invitation` no longer requires a confirmed channel. Either channel link ends the request; the invitation id, an approved or a held request still refuse. The `purged` event detail is `{reason: 'ended_by_recipient', channel, confirmed, invitation_id}`. `confirmed` is the pressed link's own channel flag. `fn_purge_pending` now passes `{reason: 'expired'}` (Leo). Header comment rewritten to say why.
- **supabase/migrations/0169_john_batch.sql** (new). Four parts, each explained in its header:
  1. N-10: `fn_record_author(person, record)` returns `'self'` for the owner, `'guardian'` only for an approved, unrevoked guardian of an **under-16**, and null for everyone else. `fn_record_actor` is unchanged.
  2. F14: `fn_publish_guardian_change(record, guardian, content)`.
     - It acts only when `fn_record_author` says guardian.
     - It supersedes the approved version, inserts the new approved one (approved_by and created_by = the guardian), and writes one `edit_approved` (actor guardian, subject child, kind `guardian_edit`).
     - If the child's own change is pending, it writes the content into that pending version, publishes nothing and returns `'pending'` (see Stopped on, 2).
     - Revoked from PUBLIC, anon and authenticated.
     - `fn_consent_timeline` is recreated with a `who` column: the actor's first name, only on guardian_edit rows, and only if they are a guardian of that child.
  3. §5.2: stops with an exception if `sms_opt_out` has any row. Sets `sms_meter.number_hash` to the zero fingerprint (the cents stay). Comments updated. An empty table needs nothing.
  4. §5.1: empties `body` and `subject` on every outbox row already sent or closed.
- **lib/record-guard.ts**: `requireRecordAuthor(recordId)` asks `fn_record_author`. It answers the same way as `requireRecordActor`: /signin with no session, /home otherwise.
- **/build editors** now call `requireRecordAuthor`: `app/build/[recordId]/page.tsx`, `actions.ts`, `clips/page.tsx`, `clips/actions.ts`, `more/page.tsx`, `more/actions.ts`.
- **lib/cv-build.ts**:
  - `saveCvDraft(recordId, draft, author)`: an under-16's guardian publishes through `publishWith`, with no `edit_submitted` and no email. The child's own edit is pending as before.
  - The §30 email now goes **only** when a child's own edit waits. A 16–17's own save used to email their parent "an edit is waiting" for nothing (jb-n10-w2).
  - **Exported for the photo builder: `publishGuardianChange(recordId: string, guardianId: string, season = '2026'): Promise<'published' | 'pending' | null>`.** Call it after the write, outside any open transaction (L1).
- **clips/more actions**: after a guardian's write that changed something, they call `publishGuardianChange`.
- **app/g/controls/[childId]/page.tsx**: the history reads `who` and renders `${who} changed the page.` for guardian_edit rows.
- **app/a/[id]/page.tsx, actions.ts, lib/guardian-flow.ts**: F15. The No renders on either channel link before "Yes, it's me" (`mayEnd = here !== null`), in its own POST form. Comments updated. The state-4 "Not {name}'s parent? Do nothing…" line is untouched.
- **app/undo/[token]/page.tsx** (§6):
  - The load and the press judge "in date" by the **link's** expiry (`coalesce(st.expires_at, u.expires_at)`), so Renew carries the undo with it.
  - The press, in the same statement, writes `share_revoked` with `{kind: 'one', token_id, club_name (from fn_send_log), by: 'undo'}`. The actor is the undo's `issued_to` guardian and the subject is the child. It is written only when a link actually went off.
  - **app/dev/undo/route.ts**: "lapsed" now lapses the link too.
- **lib/number-hash.ts** (new):
  - HMAC-SHA256 under `NUMBER_HASH_KEY`. Development and the suites use a fixed published dev key. Production with no key, or a key under 32 characters, gets null.
  - AU numbers are normalised, so "0400 818 181" and Twilio's "+61400818181" hash as one number.
- **lib/messaging.ts**:
  - `numberHash` is the keyed one.
  - `send()` refuses with `sms_no_key` before the STOP list, the queue and the meter.
  - `releaseWaitingTexts` returns nothing with no key, and re-keys waiting texts from their own address before `fn_sms_release`.
  - `dispatch()` empties body and subject on success and on permanent failure.
- **app/api/webhooks/sms/route.ts**: 503 with no key.
- **lib/messages.ts** and **docs/15-Message-Copy.md**: doc 15 v1.5's §7 line and footer entry, and nothing else (see Stopped on, 1).
- **docs/14-Permission-Tests.md**: new row **R12** (a guardian's write to a 16–17 record is denied).
- **.env.example**: `NUMBER_HASH_KEY`.
- **docs/team/GO-LIVE.md**: the `NUMBER_HASH_KEY` row, to be set before the push.
- **docs/team/APPROVALS-28-SEP.md**: BUZ's 1 Oct F14 line.

Ran (final code; fresh reseed; order as briefed):
- **perms 2133/2134**. The one red is **jr-doc27-sync**, which is outside this change: root doc 27 is now v1.1 (John's batch §5.5) and the repo's copy is still v1.0.
- **render 825/826**. The one red is **m9-3**, red on 21a1225 as well (proven below).
- **write 624/624**.
- Reseeded and restarted next dev, then **layout 274 views at 375 and 1280, ALL GREEN**.
- palette ALL GREEN · tsc 0 errors · `NEXT_DIST_DIR=.next-check next build` exit 0 · csp-prod 5/5 · corpus 0 failures · secret-scan clean · gate-coverage 264/264, 0 open · validate-migrations ALL GREEN.
- legal-sync-check passes, with `LEGAL_ROOT` pointing at the root `legal/`. From a worktree it cannot find the root by itself (exit 2).
- **New checks (all `jb-`, plus R12):**
  - perms 32: jb-f15-1/1b/2; R12/R12b/R12c; jb-n10-1..3; jb-f14-1/1b/1c/2/2b/3/4/5/6; jb-undo-1..4; jb-hash-1..5; jb-body-1..3; jb-s7.
  - render 1: jb-f15-r1.
  - write 9: jb-f15-w1, jb-undo-w1, R12, jb-n10-w1/w2, jb-f14-w1..w4.
- **Moved checks, and why** (none loosened):
  - **jr-pd3-1** is no longer refused for "no channel confirmed (either link)", because F15 removed that rule. That case is now **jb-f15-1**, which asserts it ends and records `confirmed: false`. Every other refusal stays, and the invitation id with no channel pressed was added.
  - **jr-pd3-1b**: the same, on the remaining refusals.
  - **jr-pd3-3**: the detail keys gain `confirmed`, asserted false for the unconfirmed link pressed.
  - **jr-pd3-2b**: also asserts `confirmed: false`.
  - **jr-purge-1** expects keys `['invitation_id','reason']` and reason `expired` (Leo). It is red on the old function.
  - **act11** accepts `requireRecordAuthor` as checking who is asking.
  - **jr-pd3-r2**: before any press, both links now show the No (`[true,true,false]`, was `[false,false,false]`).
  - **jr-pd3-w1**: the fresh links show the No, `[true,true]`. The crafted press on a link is gone, because it would now end the request; that press is jb-f15-w1. The crafted press by invitation id stays refused, and "opening ends nothing" is kept.
  - **jr-pd3-w8**: its `name="answer" value="end"` regex now accepts either attribute order, because React writes `value` before `name`. Same strength.
- **L20 (red on old code):**
  - The new perms suite against base code: jb-f15-1/1b/2, jr-pd3-3, jr-pd3-2b and jr-purge-1 red, then a crash at `fn_record_author` (absent).
  - Two rounds of injected bugs in scratch copies made every jb perms check red on its own bug. Bugs injected:
    - the band check removed from fn_record_author;
    - one editor back on requireRecordActor;
    - edit_submitted written instead of the event;
    - the pending-join removed;
    - the email flag set on the guardian branch;
    - the undo back on u.expires_at;
    - the undo's logging CTE removed;
    - a plain sha256 numberHash;
    - a dev-key fallback in production;
    - the 0169 guard and scrub disabled;
    - dispatch not clearing;
    - the old §7 line;
    - the old history line;
    - approved_by null;
    - PUBLIC execute granted;
    - the re-key removed;
    - requireRecordAuthor asking fn_record_actor.
  - The new render and write suites against the base app (code restored to 21a1225 in place, reseeded, then restored to HEAD): jr-pd3-r2, jb-f15-r1, jr-pd3-w1, jb-f15-w1, jb-undo-w1, R12, jb-n10-w2 and jb-f14-w1..w4 all red. jb-n10-w1, R12c, jb-n10-2 and jb-body-3 assert what must not change, and pass on both by design.

Found:
1. **The outbox bodies (§5.1), John's question answered.**
   - Before this change, every message in `message_outbox`, of every doc 15 key, email and SMS, kept its `body`, `subject` and `to_address` **indefinitely** after `sent_at` was set.
   - Nothing cleared a row except three things:
     - (a) a pending invitation's purge or No (0167, today's branch);
     - (b) a child's erasure, which deletes rows `to_person`/`subject_id` = the child (0067/0084);
     - (c) waiting texts that closed (purged, superseded, opted out, invitation closed), which got `body = ''`.
   - Those bodies carry **raw credentials**:
     - §19's `/p/{share token}` (a working link to a child's CV, against D-80's "stored hashed");
     - §36/§37's `/undo/{token}`;
     - §10b/§11's `/reset/{token}` and `/confirm/{token}`;
     - §1/§2's `/a/{code}`.
   - They also carry the child's first name and age.
   - So doc 23's "we do not retain message bodies" was untrue in production from launch, for every sent message.
   - What reads body after send: nothing in production.
     - `fn_record_delivery` reads provider_id, channel, subject_id, message_key and invitation_id.
     - `fn_ops_delivery_failures` reads channel, failed_at and failure_reason.
     - `/ops/support` counts §1/§2 rows **by to_address**, so the address is kept.
     - `/dev/outbox` and the write suites read bodies in **development**, where `dispatch()` never runs and `sent_at` stays null, so dev is untouched.
   - Built: clear at send and at permanent failure, plus a one-off scrub in 0169.
   - **Still retained:** a row that is queued or transiently failing keeps its body until it sends or closes. A row stranded after 6 attempts keeps it indefinitely, and the address stays on every row. **John to amend doc 23 or ask for an address-retention rule.**
2. **jr-doc27-sync is red from outside.** Root doc 27 was bumped to v1.1 (batch §5.5). The repo copy is v1.0, and calls are still stamped `27@v1.0`. **Leo**: sync it, and decide the `policy_version`.
3. **m9-3 is red on 21a1225 too** (shown by running it against the base app). It compares Riverside (which has seed squads, so "Which squad" renders) with the held Quarrymead (no squads), so "differ only by the pill" cannot hold. The test needs like-for-like clubs. Not touched.
4. **`edit_approved` from `approvePendingVersion` has no `subject_id`.** "You approved a change" (EVENT_LINES) therefore never reaches any family history, and today a co-guardian sees nothing when the other approves a child's edit. Not changed. F14's "what the other guardian gets today" is, honestly, nothing. **John/Leo.**
5. **The §30 email goes to one guardian only** (`limit 1`). D-51 says both are notified. Not changed.
6. **A child's clips, achievements and other football create no pending version.** They go live inside the next approved snapshot, and /g/pending's diff shows only About. Doc 14 R1 names "a clip title" as creating one. This is a gap that predates this change.
7. **`/g/pending` → `issueShareLink` (`requireRecordActor(['guardian'])`) lets a 16–17's parent mint a share link to the 16–17's CV.** Doc 14's 16–17 sharer is the player. N-10 is authorship only, so it is unchanged. **John to rule.** Also `fn_can_act_on_squad` lets a parent pick any child's squad (D-158); unchanged.
8. **The SMS provider is handed the number as typed** (`lib/providers sendSms`), not E.164. Check this with Twilio before SMS go-live. The hash now normalises, so a STOP matches either form.
9. **The photo route** (`app/build/[recordId]/photo/route.ts`, not touched) still guards with `recordActor`, so a 16–17's parent can upload their photo. N-10 needs it on the author question, and F14 needs it to call `publishGuardianChange`. **Leo to route to the photo builder.**
10. **The timing suite was not run** (it is not in the brief's line). The live undo press now also inserts a consent row and asks `fn_send_log`. QA should re-run jr-undo-t2.

Stopped on:
1. **Doc 15: the copy was not made whole.** legal-sync-check passes, but root v1.5 was written from text older than the repo's. It lacks spec K's BUZ-approved E1 (rule 12), E3 (rule 9's sender name) and E7 (GSM-7 hyphens in §3 and §15). Copying it would revert those, and `lib/messages` would no longer match. I applied only v1.5's delta (the §7 line and the footer's v1.5 entry). Repo and root still differ by exactly those E-edits. **Leo/John**: back-port E1/E3/E7 into root before the next sync.
2. **F14 with a child's edit already waiting is not in the ruling.** A record has one draft, so a guardian's snapshot carries the child's waiting change with it. I built the restrictive answer: the guardian's change joins the pending version and nothing publishes (jb-f14-3, jb-f14-w4). **John to choose:**
   - (a) publish the whole draft, child's change included, and retire the pending (the guardian saw the main-form fields but not the clips or achievements);
   - (b) as built;
   - (c) block the guardian's edit until they review the child's, which needs new words.
3. **Words**: none invented. The undo uses the existing "One club’s link was switched off". If a guardian-edit row has no first name (the actor is no longer anyone's guardian record), it shows the existing fallback "Something was recorded".

Copy for BUZ:
- New on `/g/controls` history: **"{guardian first name} changed the page."** (BUZ, 1 Oct, approved). Replaces the stopgap.
- Changed in doc 15 §7 (email "We've received your report"): **"We aim to respond within one business day. If you believe a child is in immediate danger, call 000. Pitch is not an emergency service."** It replaces "…If it concerns a child's immediate safety, contact your local police first; we are not an emergency service." (doc 15 v1.5, John.)
- Existing words in new places:
  - "No, end this request" now shows on `/a` before "Yes, it’s me".
  - "One club’s link was switched off" now appears after an undo.
- Removed: none.
- Not user-facing, for Leo:
  - doc 14 R12's wording;
  - the GO-LIVE row;
  - the `.env.example` note.

Env: **`NUMBER_HASH_KEY`** (new). Production must have it before the push carrying 0169: `openssl rand -base64 48`, at least 32 characters, never changed. Without it every SMS is refused, **including the under-16 approval text that would otherwise wait** (D-168). No key was printed or committed. The dev key in `lib/number-hash.ts` is a published constant.

Migrations, apply order: 0167 (edited: F15 and `expired`) → 0168 (unchanged) → **0169_john_batch.sql** (Leo renumbers if the photo builder also took 0169).

N-10 callers checked:
- **Moved to the author question:** /build page, actions, clips page and actions, more page and actions.
- **Kept on `requireRecordActor`/`recordActor`/`fn_record_actor`, unchanged:**
  - /build preview (the parent's preview, linked from controls) and /build ready;
  - /g/pending page and actions;
  - /share-card page and actions;
  - /register-interest page and actions;
  - /send page and actions (`fn_can_dispatch` decides);
  - /home's build door (already u16-only);
  - /g/controls held sends;
  - lib/invitations (viewer, for 16–17 reply approvals);
  - lib/send-state.
- **Not touched:** the /build photo route (Found 9).
- **Database:** no function calls `fn_record_actor`. It is unchanged, and act1–act10, F9b and R12c are green.

Risks:
- Setting the key late blocks under-16 approvals.
- 0169 drops and recreates `fn_consent_timeline`; the only callers are the controls page and the suites.
- Each guardian clip or achievement change writes a new approved version, and superseded rows accumulate.
- Not checked by hand on a phone. The /a No is a plain POST form (write suite, no JavaScript).

Lesson: a suite run late in the write file can find its seat signed out. The sessions block revokes Alex's seeded session, so any check that acts as the parent belongs above it (my first run read `/signin` for all of them).
