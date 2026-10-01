# Safety review: build/full-release (3c91a00) against app (2aae30a), 1 Oct 2026

Seat: safety. Read-only on product code. I read the diff with `git diff refs/heads/app...build/full-release`, read every touched file whole where it matters (`git show build/full-release:<path>`), and read John's PD-3/§39 memo, the john-rulings builder report, CLAUDE.md (pillar zero, D-80, D-94), and LESSONS. I extracted every SQL string from every changed file on both branches and diffed them, so the list of changed or new queries below is complete for `app/`, `components/` and `lib/`. Proxy, CSP and `next.config` are untouched.

**Suites.** `npm run -s test:perms` in the full-release worktree (in-memory PGlite, no ports): **2091 passed, 0 failed.** I also ran a throwaway probe against an in-memory database with every migration applied (since deleted). Its results are quoted in B-1 and S-1.

---

## BLOCKER

### B-1 · The parent's phone number survives "No, end this request" as an unkeyed hash that can be reversed in seconds
**Where:** `supabase/migrations/0167_a_parent_can_end_the_request.sql:85-93` (the scrub clears `body`, `subject` and `to_address`, but not `number_hash`); `lib/messaging.ts:69` (`numberHash` is a plain `sha256` of the number); `lib/messaging.ts:161` (`sms_meter` insert); `app/a/closed/page.tsx:28`.

**Scenario.** A parent confirms the email, then presses "No, end this request", and lands on /a/closed, which says "the details we held are deleted." In the database:
- The invitation's queued text keeps `message_outbox.number_hash`. While SMS waits (D-168), every invitation has one.
- Every text that actually went keeps a row in `sms_meter`, permanently.

Both values are `sha256('04xxxxxxxx')`. `AU_MOBILE` limits the input to 10^8 values. My probe recovered `0412345678` from the meter row in 168 ms on a partial sweep; the full space takes about a minute on one core. That is the parent's number.

John's condition 2 says "not a hash of either … that line must be true in the database, not just on screen", and he weighed even a *keyed* hash as a fingerprint he would not keep. The builder flagged these hashes (Found 2) as hashes. What John has not been told is that they cannot protect the number. The same applies to §3's "nothing will be kept" and to the 14-day purge, which now runs this same deletion.

**Smallest fix**, either of:
- In `fn_purge_pending_invitation`, also set `number_hash = null, queued_for_sms_at = null` on the invitation's closed rows. The `message_outbox_queued_text` check needs `queued_for_sms_at` cleared or the check relaxed for failed rows. Then stop keeping `sms_meter.number_hash` past the 24-hour window the per-number limit needs: a prune job, with the column made nullable, so the monthly spend still adds up from `cents`.
- Or put this fact in front of John and get a recorded ruling before the push, plus a doc 23 retention line for the meter.

The release must not ship the /a/closed sentence while it is false in the database.

---

## SHOULD-FIX

### S-1 · State 3b: an unconfirmed link ends the request, and the log names a channel nobody confirmed
**Where:** `0167:128-147` (`fn_end_pending_invitation` requires *either* channel confirmed, not the pressed one); `app/a/[id]/page.tsx:91,156`.

**Scenario.** The parent confirms the email link. The SMS went to a mistyped number. The stranger holding that SMS link opens it and sees "No, end this request" under "Yes, it's me". They press it without confirming anything, and the request is gone.

Probe result: `ended via unconfirmed sms link: true`, and the event detail is `{"reason":"ended_by_recipient","channel":"sms"}`. John's answerability framing is "whoever controlled the guardian contact the child gave us, **confirmed on** {email|SMS}". For this ending, that sentence is false. The harm ceiling is a re-ask, which John accepted for a wrong "No", but the record is wrong. This is HoPD F15, still open.

**Smallest fix:** add one predicate to `fn_end_pending_invitation`, `(case when sms_token_hash = p_token_hash then sms_confirmed_at else email_confirmed_at end) is not null`, and drop the `EndButton` at line 156. Or keep the 3b button and record `channel_confirmed: false`. John's call, before push.

### S-2 · B1: a parent's own edits are logged and announced as the child's
**Where:** `lib/cv-build.ts:66-69` (`edit_submitted` is written with no `actor_id`); `app/g/controls/[childId]/page.tsx:108` (it renders as "`{name}` submitted a change"); `lib/cv-build.ts:84-95` (the §30 email goes to the first guardian, `limit 1`); `app/build/[recordId]/ready/page.tsx` ("Sent to your parent").

**Scenario.** A parent presses the new "Build Mila's page" door and saves. Both guardians' consent history now says "Mila submitted a change". The §30 email tells a parent (possibly the one who just edited) that Mila's changes are waiting, and the parent is shown "Sent to your parent".

**Not a bypass of pending review.** The save still lands as a pending `profile_version` for an under-16 (`cv-build.ts:55-70`), and clubs keep reading `fn_approved_cv`. But the audit log now gives a wrong answer to "who did this", and one word carries two meanings (L5).

**Smallest fix:** write `actor_id` on `edit_submitted` from the session in `saveDraft` and render the actor's name. Whether a guardian's own edit is approved by being made is F14, John's.

### S-3 · Pre-existing, surfaced by the B1 question "what can they write at /build": a photo bypasses the guardian's review and outlives the link
**Where:** `app/build/[recordId]/photo/route.ts:44-49`; `lib/storage.ts` (`putImage` upserts to a fixed public key with `immutable, max-age=31536000`).

**Scenario.** A 14-year-old (`self`) uploads a new photo. It overwrites `player/{recordId}.jpg`, which is the same URL stored in the *approved* snapshot's `photoPath`. Every club and link-holder sees the new photo with no pending version and no guardian review (D-119). A CDN that cached the old image may keep serving it for a year instead, so even the guardian cannot be sure what clubs see.

The URL is in a public bucket and is unaffected by revoking or pausing the link: anyone who opened the CV once keeps a working URL to the child's face (CLAUDE.md §7, "signed URLs with short expiry").

The photo route is not in this diff, so this does not block this push. It is a live D-119 gap, though, and B1 now sends parents through the same route.

**Fix (Leo to scope):** for an under-16, write the photo to a new versioned key and put it in the pending snapshot rather than on `person.photo_path`. Serve photos signed and short-lived.

### S-4 · Message bodies from purges before 0167 are not cleaned up
**Where:** `0167` has no one-off backfill. `message_outbox.invitation_id` is `on delete set null` (0077:59), so rows from earlier 14-day purges can no longer be found by invitation.

**Scenario.** Any invitation purged in production before 0167 still has the child's first name and age in `body` and the parent's address in `to_address`, with `invitation_id` null.

**Smallest fix:** first count production rows with `invitation_id is null and to_person is null and message_key in ('doc15.§2','doc15.§2b','doc15.§3') and body <> ''`, and the 16–17 keys as well. Production went live on 30 Sep, so this is probably zero. If it isn't, add one `update … set body = '', subject = null, to_address = ''` to 0167.

### S-5 · Deploy order: migrations first, or two pages fail with a 500
**Where:** `app/ops/call/[clubId]/page.tsx:144` calls `fn_verified_call_addressee` (0168); `lib/guardian-flow.ts:221` calls `fn_end_pending_invitation` (0167).

**Scenario.** If the code goes live before the migrations, every call sheet returns a 500, and a parent pressing "No, end this request" gets a 500 instead of /a/closed.

Both migrations are safe to apply *before* the code:
- Old code only calls `fn_purge_pending()`, whose new body works.
- `fn_verified_call_recipient` returns the same rows as 0166 and keeps its revoked grants.

Both are safe after the code too. They cannot be reversed, because 0167 deletes on its first job run.

**Note for Leo/John:** applying 0167 changes the 14-day job's footprint at once (it now scrubs *sent* messages; builder Found 1). John should confirm that before it is applied.

---

## NOTE

- **N-1 · `/join/waiting` says "approved" in words, and held still reads as waiting** (`app/join/waiting/[id]/page.tsx:65`). Approved now shows "Your parent said yes." A held invitation still shows "One person to go". A child who typed their own or a sibling's address as the parent's (the D-155 case) can now read that the press was held rather than approved. Before F3 the same split existed as 404 against the waiting page, so this is not new in kind. Whether D-155's "a hold reads as an approval everywhere" covers the child's page is John's call.
- **N-2 · An early close is itself a signal.** Ended and expired requests render identically (John's condition 3 is met as worded). But a request that closes on day 2 tells the under-16 on /join/waiting, and a 16–17 on /home (`app/home/page.tsx:855-860`), that someone said No. This is inherent to the feature; worth one line to John so it is a known property.
- **N-3 · The No button sits inside the Approve form** (`app/a/[id]/page.tsx:188`). It relies on `form="pd-end"`. A client that ignored the `form` attribute would submit Approve. The `required` adult tick limits this and every current engine supports the attribute. The fail-safe layout is to render the No button outside the approve `<form>`.
- **N-4 · `/signin?claim=` names a club in any state** (`app/signin/page.tsx:23`). It shows "Sign in to claim X" for clubs that are already claimed, verified or suspended. Those names are public on /fc/[slug] and no person data is read, so this is not an enumeration. Limiting it to `club_state = 'unclaimed'` would stop the door offering a claim that /claim then refuses.
- **N-5 · The §10b link now carries `?claim={slug}`** (`lib/messages.ts`, `confirmAddressEmail`). Doc 15 §10b was not amended to show this. When someone else typed your address, the email you receive now tells you which club they were claiming. Low; add it to doc 15 or accept it.
- **N-6 · The §39 line on the sheet can still over-promise** (`app/ops/call/[clubId]/page.tsx:330`, `actions.ts:91,114`). `logCall` accepts outcome `verified` with `person_confirmed = no`. The sheet then says "emails {first name}" and the send sends nothing. This is the pre-existing permissive verify; doc 27 forbids that combination, but the action does not.
- **N-7 · An /undo switch-off writes no consent event** (pre-existing; builder Found 6). The family's log cannot answer who switched off a link through /undo.
- **N-8 · Provider-side copies.** Resend and the SMS provider keep each approval message's body (child's first name and age) and address, keyed by the `provider_id` we keep. "The details we held are deleted" may need John's scope ruling on processors.
- **N-9 · A 16–17 whose request closed is told "You can ask again whenever you like", but F5's re-ask door is not drawn** (`app/home/page.tsx:914-918`). This fails closed: they can never send. But the sentence names an action they cannot find (L25). It is BUZ-approved copy, held pending John's F5 ruling.
- **N-10 · Pre-existing:** `fn_record_actor` returns `guardian` for the parent of a 16–17, and of a re-granted adult. Such a parent can open `/build/{teen record}` by URL and edit the teen's *live* page directly. B1 correctly hides the door for anyone but an under-16; the route itself does not.

---

## Checked and clean

- **0167 trigger and grants.** Only the app's own connection can run either function: both are revoked from PUBLIC, anon and authenticated (`0167:153-165`). The invitation id the child holds cannot end anything: only a token hash matches, and /a draws no button for `here === null`. A refusal redirects to `/a/{code}` unchanged.
- **0167 race and event.** Approve and End both lock `for update` with `approved_at is null`, so they cannot both succeed. The `purged` event has no subject and no actor, and its detail is only `reason`, `channel` and `invitation_id` (probe confirmed). No app code or club-callable function reads `ended_by_recipient`. `fn_consent_timeline` returns only the person's own rows and approval-linked rows, so the event reaches no child's or club's screen.
- **0167 scope.** The outbox scrub reaches only messages tagged to the invitation: the guardian's §1/§2/§2b, the §3 nudge, and ops resends. Nothing addressed to the child is touched.
- **0167 enumeration.** No timing or enumeration oracle: /a/closed is a fixed address, an ended `/a/{code}` renders `FinishedLink`, and `/join/waiting` for an ended id takes the never-existed path.
- **0168.** Same answer as 0166, with one function shared between the sheet and the send. The sheet shows a first name only and sits behind `requireOperator` before any query runs.
- **F7.** `claimSlug` accepts only `[a-z0-9-]` and at most 80 characters, so no open redirect is possible. Sign-in refusal is the same redirect for every cause, carrying only the requester's own slug.
- **Register `back` parameter.** `lib/register-back.ts` always rebuilds a `/club/register` path, so it is not an open redirect: other origins, other paths, extra keys, hashes and duplicate keys are all dropped.
- **P3 "posted" preview.** It reads only `fn_trial_notices_advertised()` rows for the caller's own verified club.
- **F12 Invite door.** It shows only when `fn_can_work_register` is true (TD) and `fn_can_invite` agrees. A coach gets neither.
- **B1 doors and preview.** The home door subset is `u16` plus `fn_record_actor = 'guardian'`, and the controls door is guardian-gated and `u16` only. The empty preview sits behind `requireRecordActor`, and `buildProgress` is only called after that guard.
- **`operatorHasSeat`.** It reads the operator's own rows only, behind `requireOperator`.
- **Emails.** `lib/email-html.ts` escapes every value and includes no image or pixel. Buttons come only from doc 15's per-message label list, with URLs anchored to `https://pitchfootball.com.au/`. Footer links come only from template lines after the last sign-off; I checked that no message interpolates user text there. The From header is fixed to "Pitch Football" on the environment's address.
- **Coverage.** No new `dangerouslySetInnerHTML`, no new service-role use, and no new token read outside `lib/record-read.ts`. Every new query is parameterised.

## Not checked

- Resend's open and click tracking settings, the live Supabase grants, and production row counts (S-4).
- Real-device behaviour of `form=` in in-app webviews.
- The render, write, timing and layout suites (not rerun; Leo reports them green).
- `globals.css` and the 829/776/290-line suite diffs, except where perms exercised them.
- Club-side reads of an under-16's *live* `development_record` columns, which `saveCvDraft` updates before approval. No query changed there in this diff.

**Count: 1 BLOCKER · 5 SHOULD-FIX · 10 NOTE**
