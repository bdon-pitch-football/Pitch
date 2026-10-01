# Safety review: C-P4, a parent sends or registers for their under-16 in one press (1 Oct 2026)

Seat: safety. Read-only on product code. The change is commit 85bc7c7 on build/c-p4, from 3c5b7b5. cf1a712 is the builder's report. I also read the HoPD follow-up c6c543e, which landed on build/full-release while I was reading.

`git diff 56b6a0a build/c-p4` also shows the full-release work that c-p4 does not have, such as 0167/0168. I left that out and reviewed the commit itself.

**What I read whole:**
- `lib/send-state.ts`, `lib/send-dispatch.ts`, `lib/interest-dispatch.ts`, `lib/record-guard.ts`
- `app/send/[recordId]/{actions,page}.tsx`, `app/register-interest/[recordId]/{actions,page,InterestForm}.tsx`
- `app/g/send/[requestId]/*`, `app/g/interest/[requestId]/*` (the old /g/interest action read at 3c5b7b5)
- `app/registers/actions.ts`, `components/RegisterReaders.tsx`
- The family door and the timeline in `app/g/controls/[childId]/page.tsx`
- The `/fc/[slug]` family doors
- Migrations: `fn_can_dispatch` (0021/0048), `fn_record_actor` (0020), the share_request triggers (0015/0021), `fn_send_blocked` (0160), `fn_withdraw_registration` (0095), `fn_register_rows`, `fn_person_hidden` (0049), D-170 (0153), the erasure in 0084
- Doc 14 tables L and N, doc 23 (retention), TRAINING, LESSONS, CLAUDE.md pillar zero and security
- The full-release safety review (S-2)

**Suite.** `npm run -s test:perms` in the full-release worktree: **2098 passed, 0 failed.** I wrote no probe scripts. The findings below come from reading the code. The duplicate-registration finding is backed by the builder's own observation that H2 saw three Riverside registrations from one child.

---

## BLOCKER

### B-1 · The parent's door puts a child on the same club's register again on every press, and "Take off this register" then takes off only one of them

**Where:**
- `app/register-interest/[recordId]/actions.ts:94-114`: the guardian branch always inserts and dispatches. Compare `:116-127`, where the self path applies "one register entry per club" and only updates the trial.
- `lib/interest-dispatch.ts:31-36`: an unconditional `insert into registration`.
- `app/registers/actions.ts:36` and `0095 fn_withdraw_registration`: withdraws one registration id.
- `components/RegisterReaders.tsx:46`: the banner "Taken off. That club's register no longer has {name} on it."
- `fn_register_rows`: lists every live row.

**Scenario.**
1. Alex registers Deniz (14) on Riverside's register from Riverside's club page.
2. A week later Riverside posts a trial. Alex opens the trial and presses "Register Deniz's interest" (`/register-interest/…?club=…&trial=…`) and then "Put Deniz on the register". Nothing on the screen says Deniz is already on that register.
3. A **second** live registration is created: same child, same club, with `registration_created` logged again. A double-press or a resubmit after Back does the same, and there is no rate limit on this door.
4. The TD now sees Deniz twice on the register.
5. Later Alex decides Riverside should stop reading Deniz. He opens Deniz's controls and presses "Take off this register" on one card. He reads "Taken off. That club's register no longer has Deniz on it."
6. The other registration is still live, so the TD (and any coach granted that squad) keeps opening Deniz's CV through it (N16).

The approved words on this screen and on its outcome promise "Their access ends when you do" (`InterestForm.tsx:205-207`, `page.tsx:91-92`). That promise is false here.

**Why this is worse because of C-P4.** /g/interest had the same gap (builder Found 5). There, every duplicate needed the child to compose an ask and the parent to approve it. Now it is the parent's normal door, reached in one press from every club and trial page.

The family's controls do show two cards, which limits the harm. But the banner after the press is false, and the parent has just been told one press ends the club's access. This is a consent withdrawal that does not withdraw, on a child's data (D-128, N7's intent).

**Smallest fix.** Apply the self path's existing rule to the guardian branch.
- Under the request's row lock, look for a live `registration` for (child, club).
- If there is one, insert nothing. Attach the trial when one was chosen, as the self path does at `:124-126`, and land on the same `?registered=1`.

That is a rule the product already has, not new behaviour. If BUZ wants a different rule, the belt is for `takeOffRegister` to withdraw every live registration for that (player, club). The banner would then be true whatever made the duplicates, including /g/interest's.

---

## SHOULD-FIX

### S-1 · A parent's own send is logged as initiated by the child (the S-2 class)

**Where:**
- `app/send/[recordId]/actions.ts:84-90`: `requested_by = dr.person_id`, the child.
- `lib/send-dispatch.ts:74`: `'initiating_actor', sr.requested_by`.

**Scenario.** Alex sends Deniz's CV to "Northern United" from /send. The append-only `share_dispatched` row says `actor_id = Alex` and `initiating_actor = Deniz`. Deniz never saw this send and never asked for it.

Doc 14 L2/L55 make "initiating actor" a field of the send row precisely to answer "who decided this". After C-P4, for every parent-direct send the answer is wrong, permanently.

The question gets asked in a family dispute ("did my son ask to be sent to that club?"). It also gets asked when Deniz turns 18 and reads his own log (L58/U-5 aside).

The family-facing words are fine:
- The timeline line is passive ("Deniz's CV was sent to a club").
- The other guardian's §email names Alex as sender, because `actorId ≠ personId`.

The audit row is what is wrong. It is the same class as the full-release review's S-2: a parent's act recorded as the child's.

**Smallest fix.** Keep `requested_by` as the child, which leaves the erasure keys in 0084 alone. Give `dispatchShareRequest` an optional `initiatingActor` argument. The /send guardian branch passes `personId`, and the detail writes it instead of `sr.requested_by`.

Nothing in erasure reads `consent_event.detail`. The builder raised this as Found 8 and left it as a decision. My recommendation is to make the row true before the push.

### S-2 · A parent's rate-limited send leaves no trace anywhere. The self door shows "didn't go", and /g/send leaves the ask waiting.

**Where:** `app/send/[recordId]/actions.ts:67-76`, specifically `:73`, where `send_held` is written for `'self'` only.

**Scenario.** It is trial season. Alex sends CVs for two children (SEND_DAILY_CAP is 10 per actor). His 11th press lands on "Sent. It's gone to the club as a link." That is correct and required by L38.

What differs is afterwards:
- **18+ player (self door):** their list later says "This one didn't go. You can send it again later." (0046, John 17 Sep §3, APP 10).
- **/g/send:** the held press leaves the child's ask on the parent's /home, so it visibly hasn't gone.
- **The parent's one-press door:** it writes nothing. The controls list never shows the send, and no line ever tells Alex it did not go. He believes the club has Deniz's CV.

The builder's comment ("/g/send's limited press writes nothing either") is true, but the request /g/send leaves behind is the signal.

**Smallest fix.** Write a `send_held` row for the guardian press too, keyed to the child (`person_id = the child`, club name only), and render it in the controls' "where it went" list with 0046's "didn't go" line. Alternatively, put the gap to John as an APP 10 question.

The endpoint stays byte-identical either way. The oracle is the response, not the parent's own list, per John's 17 Sep ruling.

---

## NOTE

- **N-1 · The rewired tests.** Of the six, five kept their assertions and moved to the seat doc 14 L1/N1 names:
  - x0j–l, sc-w1, f1, susp-w `sendTo` and addr-w are no weaker.
  - **sc-w6 lost one thing** (`scripts/write-tests.mjs:1153`). It was the only *behavioural* proof that a press from the parent's seat to a club that asked Pitch to stop (0160) is refused. Now it presses as the child, and no C-P4 test sends from the parent's door to a stopped address (C-P4-w9 says it avoids Brindlewood on purpose).
  - The rule still holds by construction: `actions.ts:60` runs before the mode branch, `sc-s2` pins that structurally, and `sc-s1` plus the dispatch's own `not fn_send_blocked` are the belt.
  - Add one post from `alex` to the stopped club in the sc block, expecting `?blocked=1` and no §19.
  - There is also no addr-w-style byte-identity check for the parent's limited press on /send. `lim-floor3` covers its floor structurally, because the guardian branch sits inside the measured slice.
- **N-2 · A dispatch that throws leaves the request behind.** `app/send/[recordId]/actions.ts:84-95`. The `share_request` insert commits on its own, before `dispatchShareRequest`'s transaction. The delete runs only when dispatch *returns* null.
  - If dispatch throws (a trigger raise, a DB error, a function timeout), an undispatched request stays with `requested_by = the child`.
  - It shows on both guardians' /home as the child's ask (`app/home/page.tsx:243-247`), and the second guardian could send it. This is what the builder says cannot happen.
  - The odds are low. Fix by deleting in a `catch`/`finally`, or by inserting inside the dispatch transaction.
- **N-3 · `dispatchInterestRequest` re-checks guardianship under the lock, but not pause** (`lib/interest-dispatch.ts:20-31`).
  - On the parent's door, `sendState` checked pause milliseconds earlier, outside the transaction.
  - On /g/interest it is never checked, which is pre-existing: a request composed before guardian 2 paused can still be dispatched by guardian 1.
  - `fn_person_hidden` hides a paused child from every register, so the club sees nothing. But a row is written that L18's "cannot be dispatched" says should not exist.
  - Now that this is "the ONE way", one predicate here fixes both doors: `and not coalesce((select profile_paused from guardian_setting where child_id = dr.person_id), false)`.
- **N-4 · Pre-existing, inherited by the new door: a content hold does not stop a send.** Neither `fn_can_dispatch` nor `sendState` reads `content_hold`. A parent can send a held child's CV in one press, and the club's first click lands on a dead link. L11's "a send that resolves to the link-state page misleads the club" applies.
- **N-5 · Pre-existing: positions are unvalidated free text on every register door** (`app/register-interest/[recordId]/actions.ts:40`).
  - The code does `split(',').slice(0,3)`, with no check against the ten positions and no length cap. The only DB check is `cardinality <= 3`.
  - Whatever is posted reaches the club's register in the N6 payload, bypassing N15's note filter.
  - On the parent door the parent is the author. The 16–17 self door has no reviewer at all.
  - Fix: `positions.filter(p => p in POSITIONS)` in the action, and a `<@ fn_positions_ten()` check on `registration`.
- **N-6 · Pre-existing: the registration consent row does not name the club or trial** (`lib/interest-dispatch.ts:44-47`). Its detail is `{request_id}` only. The `registration_request` it points to is deleted with the child's record (cascade), so after erasure the row cannot say which club. Doc 23 line 90 and doc 14 N3 say it records "a named club for a named trial". Add `club_id` and `trial_notice_id` to the detail, once, here.
- **N-7 · Pre-existing: the other guardian is not told of a registration.** Sends notify them (L17). Registrations only appear in the shared timeline. D-51 says "both notified". No doc 14 row covers registrations, so this is BUZ's or John's call. C-P4 makes this the main door.
- **N-8 · Words, on the parent's view only.**
  - **/send** still shows the child-addressed sub and well (`page.tsx:134,160-163`): "Your CV goes as a link…", "A link to your CV", "If you switch your link off…", "Not your phone number, your email or your address". This is builder Found 1. None of it misleads about *who sends*, because the title and the who-row say the parent does.
  - The well drops /g/send's "No contact details for you or {name} — not now, and not if they reply". That is the one line telling a parent the club gets neither of their contacts.
  - **/register-interest** contains no send-a-CV words (render C-P4-r3 pins this). It drops /g/interest's "Verified club on Pitch" pill (`app/g/interest/[requestId]/page.tsx:108`). A parent now cannot tell a verified club from a claimed-but-unverified one, whose register holds the child unseen (D-126). Copy check and BUZ.
- **N-9 · Not measured.** L40 timing for the parent's /send press (limited against real) with a second guardian. The real path does the undo-token and §-notice work for the other guardian, and no fixture has one (builder Risk 1). test:timing was not run.
- **N-10 · N2's consent-screen checks** (`permission-tests.mjs:1074-1079`) read `/g/send` only. Neither of the parent's two new consent screens is pinned for N2's four things. They do render all four today: club, trial, what travels, and the note.
- **N-11 · c6c543e (HoPD follow-up) is clean.**
  - The `/fc` pause filter is a UI convenience. The server still answers `'none'`.
  - `generateMetadata` puts the child's first name in the tab title only when `sendState` returns `'guardian'`. It returns the plain title for anyone else.

## Checked and clean

- **Who reaches `'guardian'`.** Only an approved, unrevoked guardian (`fn_record_actor`) of an approved, unpaused under-16 (`fn_can_dispatch` 0048), checked in that order after pause.
  - A revoked or unapproved guardian, another family's parent, a coach with full read, the TD, the 16–17's parent and the child all get `'none'` or `'ask'`. Perms C-P4-1..4 confirm this, and write C-P4-w9/w10 confirm it over HTTP.
  - An administrator gets nothing: `fn_record_actor` is null, so `requireRecordActor` sends them to /home, the same as for a record that does not exist (D-77).
  - Signed out goes to /signin.
- **No TOCTOU through the page.**
  - Both actions re-run `requireRecordActor` and `sendState` themselves. There is no hidden mode field.
  - Club, squad and trial are re-checked server-side (`club_state in ('claimed','verified')`, so suspended and unclaimed clubs are excluded; squad and trial must belong to that club; trial via `fn_trial_notices_advertised`).
  - Sends re-check `fn_can_dispatch` and `fn_send_blocked` under `for update`, and the share_request trigger is the belt.
- **Rate limit and floor.** Same key (`send:actor:<id>`), same cap, same `abuse_signal`, same `?sent=1` landing, same floor as /g/send. A failed dispatch can only come from the parent's own standing changing or a stop racing the press. It reveals nothing about a club address or the limit.
- **The /g/interest transaction moved byte for byte.** Every SQL string is identical apart from indentation. `legalStamp('20')` and the `for update of rr` are unchanged. /g/interest's behaviour and its one answer for not-yours, already-sent and never-existed are kept.
- **No missing consent record.** The parent door writes exactly the approval's `registration_created` row: actor = guardian, subject = child. Leaving out the child's "requested" row is correct: nobody asked, and that row is builder Found 4's L5 problem anyway. Doc 23 and doc 14 require the disclosure row, which is present. The same holds for `share_dispatched` on sends, apart from S-1.
- **D-170.** Leaving a club withdraws *every* live registration there (`fn_left_club_withdraws` loops), so duplicates do not survive a leave. Only the family's per-card "Take off" leaves one behind (B-1).
- **D-126.** A register at a claimed-but-unverified club is held, the same as the child's door (`fn_register_rows` requires `verified`). A CV by email goes to any address the family types, as L29 allows.
- **Database and code hygiene.**
  - The guardian interest branch holds `db.connect()` with only `client.query` inside, and redirects after `release()` (L1).
  - Every query is parameterised. There is no `dangerouslySetInnerHTML` and no new token read outside `lib/record-read.ts`. There is no service-role use. No message is outside doc 15, and §20 is correctly not sent.

## Not checked

- I did not run the render, write, layout or timing suites. The tree belongs to another seat's run.
- I did not probe B-1 or N-2 against a live database. Both come from the code paths cited and the builder's H2 observation.
- I did not read the 0167/0168 work or anything else in the 56b6a0a..c-p4 range that is not in 85bc7c7 or c6c543e.
- I have not checked real-browser double-submit behaviour of the register button (B-1's double-press variant).

**Count: 1 BLOCKER · 2 SHOULD-FIX · 11 NOTE**
