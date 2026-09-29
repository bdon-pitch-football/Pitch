# tech-builder: round H, the walkthrough fixes, D-168 and default 5 (2026-09-29)

Asked: brief H (`docs/team/briefs/final-H-walkthrough-fixes.md`). That covered four walkthrough fixes, BUZ's approved words from 29 Sep, D-168 (under-18s register at launch with the parent's text queued), approved default 5 (a TD name mismatch is held for a human), and the H8→H9 label.

Branch `builder-final-h`, cut from `app` at 80f66ce. It has six commits. Three are mine:
- 506d27b: the round.
- f5c9954: the waiting screen and the live TD words.
- 8e7bce8: the waiting screen's title.

Three are merges of `app`:
- af44513: round G, where the round-H work was carried onto G's screens.
- ff31518: BUZ's 29 Sep approvals.
- c3a9e59: Terms v2.1 and brief J.

The head is **c3a9e59**. Nothing has been pushed.

**The run stopped short because the disk filled.** At about 14:25 the disk went to 318 MB free, with load 17, while other seats were building. Bash could not create its own output file. Following TRAINING §4 and L37, I stopped my app, database and Chrome by port, killed my own write run, and deleted `.next`. I have not started a build since.

Three things were **not run** on the final head:
- `build:check`
- `test:csp-prod`
- a post-merge layout pass

Each needs a 1.2–2.4 GB build or a running app. Leo should run them on a quiet machine before merging. Every other number below is labelled with the commit it was measured on.

## Did

### D-168: the parent's text waits until SMS can send (migration 0120, the most important item)

**The problem.** Before this round, a child's sign-up with SMS off sent the parent's email and refused the text (`sms_killed`, or `sms_no_cap` in production). Approval needs both channels (D-24, D-156). So every under-18 sign-up could not be approved from its first minute, and it purged at day 14.

**`lib/sms-policy.ts`: `smsCanSend` and `smsProviderConfigured`.** One answer to "can a text leave now?":
- Not when either kill switch is on.
- In production, not without a cap or without all three Twilio values.
- In development the outbox is the provider (the dev fake). So "switched off" is the only way to see the queue there.

**`lib/messaging.ts` `send()`: approval texts are queued, not refused.**
- When SMS cannot send, the parent's approval text (doc 15 §1 and §1b, and only those) goes through `fn_sms_queue`. Everything else is refused as before.
- STOP is now checked before the queue.
- `sendAndLog` writes no `sms_sent` for a waiting text. The release writes that row when the text goes.
- `releaseWaitingTexts()` asks `smsCanSend` and then calls `fn_sms_release`. It sends nothing itself (L40's rule for this file).

**0120 `fn_sms_queue`.**
- A queued text is an outbox row with `queued_for_sms_at` set: not metered, not on the spine.
- Three a day per number is counted at queue time as well, with queued texts counted alongside sent ones. Without this, a stranger's number could have fifty texts lined up for it.
- A newer text for the same invitation retires an older queued one (`superseded`, body emptied). A resend kills the older text's link (D-156).

**0120 `fn_sms_release`: the one door out.**
- Takes queued texts oldest first.
- Applies the operator's switch, three a day per number (counted live, so a backlog of six releases three), the monthly cap in force, and STOP.
- Requires the invitation to still be open. A purged, approved or held invitation's text is closed and emptied, never sent.
- On release it meters the text, stamps `released_at` and writes `sms_sent` with the invitation.

**0120 `fn_purge_pending`.** It now closes and empties every unsent row of an invitation before deleting it.

**0120 `fn_pending_nudges`: the day-10 nudge skips an invitation whose text is still waiting.** I found this on the way (Found 3). The nudge re-mints the texted link, which would kill the link inside the waiting text. While SMS is off, the nudge itself is refused anyway.

**Also in 0120:** `fn_sms_queued_count()` and `fn_invitation_sms_queued()`.

**`app/api/jobs/outbox/route.ts`.**
- Releases the queue first.
- The retry sweep never claims a waiting row, which would send it unmetered.
- In development it now returns before any provider call. This is a change beyond the brief. Before it, the sweep in development handed rows to Resend and Twilio, so a key in `.env.local` would have sent a real message from a fixture row. My new write checks call this route in development, so I closed that. Leo may prefer it as its own commit.

**`app/join/waiting/[id]/page.tsx`: the waiting screen.**
- It stops saying "Text and email sent" while the text waits (L25), and shows only the masked number.
- It renders the brief's line only while the text waits. At first it was held (development only). It went live after BUZ approved it; see "After merging `app`" below.

**`lib/digest.ts` (new) and `app/api/digest/route.ts`: the 7am digest.**
- The digest carries the queued-text count. Its words are held: development only.
- It still sends nothing when nothing happened.
- In development the route now returns the composed digest as JSON and does not send.

**`app/dev/outbox/page.tsx`.** The dev inbox leaves out a text until it is released. It then appears, dated at its release.

**`.env.example`.** It says an approval text queues rather than being refused.

**The Today dashboard.** Round G merged mid-round. Today now asks one more count, `select fn_sms_queued_count() as n`, and shows it as a tile. The tile's words are held: development only. ops-t4 now expects three queries.

### Approved default 5: a TD name mismatch is held for a human (migration 0121)

**`fn_td_name_matches`.** Case and whitespace aside, the names are equal, or the surnames are equal and one first name is the other's initial ("D. Kovac", "D Kovac", "Dana Kovac"). Anything else is held: middle name, nickname, typo, surname alone.

**Where the check lives.** It sits inside `fn_td_on_call`, beside 0058/0060/0100, so the wall trigger, the attach and the call sheet share one answer (L23). A mismatched account does not attach, and a hand-written row is refused.

**`td_name_confirmation`.** Append-only, row-level security on, no foreign keys (0044's pattern). It records which operator, when, which call, which account, and both names as they stood.

**`fn_ops_confirm_td_name(operator, email, club)`.**
- The operator is a real person, identified by their own address.
- The confirmation is bound to that call.
- It never confirms the club's mailbox.
- It attaches the role in the same transaction.

**`fn_club_td`.** Its `name_matches` column is now the rule's answer; it was 0060's exact compare. It also gains `name_confirmed`.

**A new call is a new question.** A later call recording the same address under a non-matching name ends the live TD through 0100's own trigger. That is the hold, the restrictive answer.

**"Spent" changes from `>=` to `>`.** The call's own ending (same instant) no longer spends the call, so an operator can resolve that hold without a third call. This changes a 0100 rule. It only matters where a call ends someone at its own moment, which is now only the name case. It is proven by tdn5b.

**0121's sweep.** It ends any live mismatched TD through `fn_td_ends`, with a new cause `name_held`. It ends nothing in the seed or the demo.

**The call sheet (`app/ops/call/[clubId]/page.tsx`, `actions.ts` `confirmTdName`).**
- It shows the approved "This is not the name recorded on the call." beside the account's own name.
- **It no longer shows "The role goes to this account, not to the name above."**, because that is now false (L25).
- The held state and the confirm button were built held, in development only. They went live under BUZ's advance approval; see "After merging `app`" below.

**The permission-suite fixture.** `recordTd` now records the person's own name on the call. The Callsheet FC fixture's "Robin Recorded" is a two-part name.

### The coach's "Verify for {club}" (migration 0122)

**`fn_verify_club`.** The club selection moved out of `fn_verify_stat` into its own function, which `fn_verify_stat` now asks. The club on the button and the club written on the stat are one answer.

**`fn_verifiable_stats(actor, record)`.** Returns rows only when `fn_write_provenance` gives `coach_verified`. It returns only numbers above zero that the player entered directly and that are still self-reported.

**The squad CV page (`app/club/squads/[squadId]/cv/[playerId]/`).**
- It renders a card above the CV for each offered number: its label (from `STAT_LABELS`), the value, and the button "Verify for {club}".
- It offers **only a number on the page as shown**. For an under-16 that is the parent's approved snapshot (D-119), so a club is never shown a number the parent has not approved.
- The press (`actions.ts` `verifyStat`) checks `fn_can_read_squad_player`, then `fn_verify_stat`.

**What the seed shows.** The TD, Marina, is offered nothing, because the seed attests Sam's Working With Children Check and not hers (`fn_is_verified_adult`, 0015). The button follows the database's answer, not the role's name.

### The four walkthrough fixes

1. **`components/cv/StatTile.tsx`: no count-up, no state, no JavaScript.** The tile renders its value. The tile rises and the number "settles" (a scale); both stop under reduced motion. Every frame of a count-up is a false number, not only the 0.
2. **`components/WhileYouWereAway.tsx`.** One `order by` in the one query every seat renders: what happened, newest first, then what is coming, soonest first. Today counts as happened.
3. **`components/premium-actions.ts` and `PremiumRows.tsx`.** The tap redirects to `?first=1#premium`. The rows' form is `id="premium"` with a scroll margin.
4. **`scripts/dev-db.mts`.** Quarrymead United is in **Diggers Rest VIC**. I found a second made-up locality, Tarrowvale City FC in "Tarrowvale", and it is now in **Hoppers Crossing VIC**. No other made-up locality is in the seed, the fixtures or the demo layer. The demo takes the suburb from `--suburb`.

### BUZ's approved words, made live

- `/home` for a club administrator: "…its squads, its notices." (verbatim; see Found 7).
- `/club/register`: "Paying doesn't change it and can't." is removed.
- `/join`: "Give us their mobile and email." and "Pitch is only open in Australia."
- The front door's parent row: sub-line "Approve and see their record", **and the row now links to `/join`**. It linked to the parent landing, `/?for=parent`; see Found 5.
- Doc 15: §9 is marked **RETIRED**, with the reason. §4 is marked **HELD** under D-167. Neither has a key in `lib/messages.ts`, and `/api/waitlist` sends nothing.
- `/ops/verification`: **not done.** Round G has not merged, and that page is G's. The sentence "Payment does not change that and cannot." is still there on `app`.

### After merging `app`: G's console and BUZ's 29 Sep approvals

- **The call sheet.** G's rebuilt layout, carrying all of the round H state described above.
- **`/ops/verification`.** G had already left out "Payment does not change that and cannot." Its `tdState` would have said "waiting on their account" for a held name mismatch, which is false since 0121. It now says "on hold: not the name on the call", and it selects `name_confirmed`.
- **The child's waiting screen, rewritten in BUZ's approved words (APPROVALS, "approve 1 and 2").**
  - The tab title is "Waiting for your parent · Pitch Football". It is set as an absolute title, because `/join`'s layout title stops the root template reaching it.
  - The heading is "One person to go." (now an `<h1>`), and the body and footer are as approved.
  - "What you made / build it while you wait / keep editing" is gone. The "Honestly?" card is unchanged.
  - The queued-text line is now **live**: it replaces "Text and email sent · …" while the text waits, and "Text and email sent" returns when the text has gone.
  - New checks wait-r1 and wait-r2 fail if the page promises a page, a photo or clips (proved red on the old wording, which it caught on "Your page is").
- **The TD name-mismatch words are live.** BUZ approved them in advance and delegated the review to Leo (APPROVALS, "Approved in advance"; Leo's instruction). They are listed below for that review.

### The label

The check "H8: a departed technical director…" is now **H9**. Doc 14 H8 ("an experience_entry naming a real club exactly") is now pinned by the check that actually tests it: "Bayview SC" is the exact name of a verified fixture club, and it grants that club's coach nothing. Gate coverage stays at 263/263, now honestly for H8 and H9 (but see Found 6).

### What I touched under `app/ops`

Every hunk against `app` at a95393a (`git diff -U0 a95393a HEAD -- app/ops`):

**`call/[clubId]/actions.ts`:** one new export, `confirmTdName`, after `endTd` (new lines 168–183). Nothing existing changed.

**`call/[clubId]/page.tsx`:**
- line 26: the import gains `confirmTdName`.
- after line 72: `NAME_HELD_STATE` and `NAME_HELD_CONFIRM`, with their comment (8 lines).
- line 107: the `td` row type gains `name_confirmed`, and `heldForName` is computed.
- after line 139: a comment.
- line 142: the mismatch sentence loses its second half.
- after line 157: the `heldForName ? NAME_HELD_STATE` branch.
- after line 159: the confirm `<form>` (8 lines).

**`verification/page.tsx`:**
- line 40: `NAME_HELD_STATE` and `tdState`'s type.
- after line 41: the held branch.
- line 65: the query selects `td.name_confirmed`.

**`page.tsx` (Today):**
- after line 38: the held `HELD_WAITING_TEXTS` constant.
- after line 55: the `fn_sms_queued_count()` query.
- after line 71: the tile.

**Not touched:** switches, reports and support.

## Ran

All on this tree: database 54452, app 3250, CDP 9453. Each suite ran from a fresh seed in TRAINING §4 order.

| Suite | Result | Commit |
|---|---|---|
| perms | 1742/1742 | c3a9e59 (and 8e7bce8) |
| render | 593/593 | 8e7bce8 |
| write | 436/436 | f5c9954 (a) |
| layout 375 1280 | 206 page views, 0 overflow, 0 chrome failures; new walkthrough pass 8 views, 0 failures | 506d27b (b) |
| timing | 17 passed, 2 failed (c) | 506d27b |
| gate-coverage | 263/263 pinned, 0 open | c3a9e59 |
| palette | green | c3a9e59 |
| corpus | green | c3a9e59 |
| secret-scan | no secrets | c3a9e59 |
| tsc | clean | c3a9e59 (before the last docs-only merge: 8e7bce8) |
| validate-migrations | green | 8e7bce8 |
| build:check | **not run** (disk) | |
| test:csp-prod | **not run** (disk) | |

(a) The write run on 8e7bce8 was killed when the disk filled. The only change after f5c9954 is the waiting page's `metadata.title`.

(b) Not rerun after merging G, because of the disk. G's own squeeze check and my walkthrough pass are merged into one summary (conflict resolved by hand). **Leo should run it.**

(c) Timing, measured at load 6–9:
- **tok-rl** flagged +0.48 ms (p = 0.000024, resolution 0.70 ms) between "never a link, from an address over its limit" and "never a link". Both arms serve the same dead-link page. This round's diff touches none of `proxy.ts`, `lib/record-read.ts`, the rate limiters or `app/p`. The other two arms were not distinguishable.
- **J61** is INCONCLUSIVE: resolution 0.78–1.17 ms against the 0.8 ms it needs, and no shift seen (p = 0.37 and 0.67).
- I believe both come from load, not from code. As instructed, I did not loop on them. Leo reruns timing on a quiet machine.

**Every new check was proven red with its bug put back** (harness `.run/red.py`, which restores every file after each run; the logs are in `.run/`, untracked). After the merges I also proved these red:
- tdn9: the queue says "waiting" for a held name.
- tdn9b: the Today tile shows in production.
- ops-t4: Today does not ask the count.
- tdn-w1b and sms-w4d: the queue state or the tile is gone.
- sms-w5d: the release never happens.
- tdn8b: the held state or the button is missing.
- wait-r1 and wait-r2: the old waiting-screen wording.

Before the merges:

- **perms, D-168:**
  - q1: the provider is ignored in production.
  - q2: the old refusing send.
  - q2b: `sms_sent` is written at queue time.
  - q2c: the sign-up's text carries no invitation.
  - q3: the text is metered at queue time.
  - q4: the release ignores the switch.
  - q5: the release ignores the cap.
  - q6: the release never happens.
  - q6c: the sweep claims waiting rows.
  - q7: the purge leaves the text, with and without the release's open check.
  - q7b: a held invitation's text is sent.
  - q8: no limit at queue time.
  - q8b: no limit at release.
  - q9: STOP is ignored.
  - q10: no supersede.
  - q11: the digest never carries the count.
  - q11b: the held line shows in production.
  - q12: the nudge chases a waiting text.
- **perms, default 5:**
  - tdn1: no initial allowed.
  - tdn2/2c: no name check (round F's state).
  - tdn3: the operator is not checked.
  - tdn3b: the confirmation does not attach.
  - tdn4: the confirmation is mutable.
  - tdn5b: spent stays `>=`.
  - tdn6: the sheet uses an exact compare.
  - tdn7: the mailbox can be confirmed.
  - tdn8: the action skips `requireOperator`.
  - tdn8b: the false sentence is kept, or the held button shows in production.
- **perms, verify button:**
  - cv10b: offered to anybody.
  - cv10c: verified numbers are offered again.
  - cv10d: two club answers.
  - cv11: numbers that are not on the page are offered.
  - cv11b: no squad check.
- **perms, other:**
  - fx2: Quarrymead is back, or Tarrowvale is back.
  - doc15-9, doc15-4: the notes are unmarked.
  - hist12: the count-up is back.
  - hist13: `.settle` moves under reduced motion.
- **render:**
  - ret-r12 and ret-r12b: the old order, which reads 29 Sep, 28 Dec, 11 Oct.
  - vfy-r1: no button.
  - fd2c and fd5: the parent row goes back to its landing.
  - r35: the register sentence is back.
  - ah2: "its plan" is back.
- **write:**
  - sms-w4b and sms-w5b: the old send path.
  - sms-w4c: the release ignores the switch.
  - prem-w2 and prem-w2b: no anchor.
  - tdn-w1: no name check.
  - tdn-w3: the confirm does nothing.
  - vfy-w2: no authority check.
  - vfy-w3: the press does nothing.
- **layout:**
  - st1: the old StatTile from HEAD~1. It showed 29–30 different values in 3 s.
  - st1b: `.settle` moves under reduced motion.
  - pr1: the redirect has no anchor, so the confirmation is out of view at 390 and 1280.

**Checks retired or changed:**
- hist12 and hist13 asserted the count-up's internals (`useState(value)`, `useBeforePaint`). They now assert that there is no count.
- r35, ah2, fd2b, ctry2, the /join j3 heading and prem-w2 were updated to the approved words and behaviour.
- The SMS drill (sms-w4…w11) was updated to D-168: the text waits instead of vanishing, and the counts are +1.
- `scripts/demo-walks/run-sheet.txt` no longer expects the removed sentence.

## Found

1. **Done during the round, after G merged:** Today's tile (held words), and the queue's held-name state (now live under the delegated approval). G had already removed "Payment does not change that and cannot." The waiting screen's other chip, "Not live yet", is not in BUZ's list and I left it. It implies a page, where the approved body says "approve your page"; Leo may want to ask.
2. **The generic outbox retry sweep ignores the kill switch** (pre-existing). An SMS row written while SMS was on, whose first attempt failed transiently, is retried after the switch goes off. Waiting rows are excluded, so this is only the old path. I did not fix it.
3. **The day-10 nudge writes `nudge_sent` even when `send()` refused the text** (pre-existing, `app/api/jobs/daily/route.ts`). The same loop also re-mints the texted link. I fixed the part that D-168 made dangerous: a waiting text is no longer nudged (q12). The log line written for a refused nudge is still there.
4. **"On demand" release.** The queue releases hourly (the Vercel cron), or when someone calls `/api/jobs/outbox` with `CRON_SECRET`. Switching SMS on at `/ops/switches` does not release it; that page is G's. Worst case, a queued text waits up to 59 minutes after SMS comes on. Calling `releaseWaitingTexts()` from the switch-on action would close that gap.
5. **The parent landing, `/?for=parent`, is now linked from nowhere.** APPROVALS and the brief both say the parent row leads to `/join`, so it does. The landing is still served, and its CTA still goes to `/join`. If Leo meant "keep the link as it is", it's one line in `components/front-door/FrontDoor.tsx` (`seat === 'parent' ? '/join' : …`) and fd2b/fd2c/fd5.
6. **Other doc 14 table-H labels are wrong in the same way H8 was (L4). Gate coverage counts these rows as pinned.** Permission-tests lines 3124–3130:
   - "H1: the club administrator gets membership and contact only" (H1 is "a player joins a club").
   - "H2: the team manager the same" (H2 is "a player leaves").
   - "H3: the TD gets the record" (H3 is "a coach leaves").
   - "H5: an unattested coach…" (H5 is "the club loses verified status").
   - "H7: a departed coach keeps only what they authored" (H7 is the experience_entry invariant; this check actually tests H3).
   - Two checks are labelled H4.
   
   I didn't relabel them: that isn't in the brief, and each needs someone to find the check that really tests the row, or write one. **263/263 is overstated by up to five rows.**
7. **The approved `/home` line, applied verbatim, reads "You keep the club's page, its squads, its notices."** It has no "and". BUZ may want "its squads and its notices".
8. **Doc 15 §36 is still in `CATALOGUE_KEYS` and wired, and doc 15 has no hold note on it.** D-167 names it held. It can only fire with a second guardian, which nothing at launch creates.
9. **`site/README.md` §4 still specifies a waitlist confirmation email to the signer.** That is the website backend's spec, not this app. If the live website's backend sends one, it contradicts §9's retirement.
10. **`docs/DEMO-TD.md` line 74 has BUZ saying "Paying doesn't change it and can't."** in the meeting script. It is stale under D-163.
11. **A Technical Director gets the verify button only with an attested WWCC**, like any coach: 0015's `fn_write_provenance` requires `fn_is_verified_adult` for both. The seed's TD, Marina, has none, so she gets no button, which is correct per that rule. Whether a TD should be able to verify without an attested check is BUZ's call.

## Copy for BUZ

**Made live, approved 28 and 29 Sep (verbatim), including the waiting screen:**
- The tab title: "Waiting for your parent · Pitch Football"
- "One person to go."
- "We’ve asked your parent to approve your page. Until they say yes, nothing about you is on Pitch — not for clubs, not for coaches, not for us."
- "If nobody approves within 14 days, we delete what you told us. You can start again any time."
- While the text waits: "We’ve emailed your parent. Their text follows shortly."

The rest:
- "The register is {first name}’s. You keep the club’s page, its squads, its notices."
- "You’re {age}, so a parent has to approve your page before anyone can see it. Give us their mobile and email."
- "Pitch is only open in Australia."
- "Verify for {club}" (for example "Verify for Riverside FC"). It sits beside the existing stat label and the number, for example "Appearances" and "18".
- The front door's parent row: "A parent" / "Approve and see their record".

**Removed, with no new words:**
- `/club/register`: "Paying doesn’t change it and can’t." (approved).
- The call sheet: "The role goes to this account, not to the name above." It is false since 0121; the first half, "This is not the name recorded on the call.", stays.
- The waiting screen: "Text and email sent" is not shown while the text waits. The masked number alone shows.

**Live under BUZ's advance approval, for Leo's review** (round H's TD name-mismatch words):
1. Call sheet, for a held mismatch: "On hold. The role stays off until you confirm this is the person the club named, or record a new call with the right name."
2. Call sheet button: "This is the person the club named"
3. `/ops/verification` line state: "on hold: not the name on the call", read as "Technical Director {recorded name} · on hold: not the name on the call · recorded by {operator} on {date}".

**Still held (new words, development only, not live):**
4. The 7am digest line: "Parents’ texts waiting for SMS: {n}"
5. The digest subject, when the queue is the only news: "Pitch — {n} parents’ text waiting for SMS" (with "texts" for more than one).
6. The Today tile: label "Texts waiting for SMS", sub-line "parents’ approval requests".

Doc 15's new §9 and §4 notes are internal documentation, not product copy.

## Risks

- **Twilio.** Nothing has sent a real text: in production the release hands rows to the unchanged `dispatch()`. The first real queued text goes out whenever SMS is switched on. If the Vercel cap, Twilio values or `CRON_SECRET` are missing, the queue waits, silently except for the digest line once it is approved.
- **SMS off for more than 14 days.** The parent's queued text is then purged with its invitation, which is D-17 as written. The child would have to sign up again.
- **"Spent" changed from `>=` to `>` (0121 over 0100).** This is reasoned and tested (tdn5b, plus all of 0100's td* checks green), but it is a change to F's rule, and F should know.
- **The name rule is deliberately strict.** A middle name, or "Dan" for "Daniel", is held. That is the restrictive reading of "never auto-passes". In production the operator has no button until the words are approved, so every mismatch needs a new call.
- **pr1 relies on Next's hash scroll after a server-action redirect.** Tested in Chrome at 390 and 1280, not in Safari or on a handset.
- **The layout check's new pass mutates** the anonymous Premium tap count by 4 per run.
- **Not run on the final head:** `build:check`, `test:csp-prod`, and the layout pass after G's merge. The disk was the reason, not a failure.
  - The waiting page gained an `<h1>` and lost a block.
  - The call sheet's held state gained a button.
  - Both need the layout and squeeze passes run.
- **What I didn't check:** the demo (3030 is BUZ's) and `migration-on-data.mjs` (known to stop at 0076, round B Found 2).

## Lesson

A second copy of a text's link can be killed by code that never touches the text. The day-10 nudge re-mints the SMS token, and a queued text carries the old one. When a message can now wait, find every path that rotates what's inside it.
