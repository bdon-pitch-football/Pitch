# safety review: everything Leo built alone, 19–22 Sep (2026-09-22)

Asked: an adversarial read of 16a8f5f..bfbb405 on `app` (squads 0052/0053, the coach and club sign-up doors, player preview, club page editing 0051, demo mode). Docs-only commits skipped.

Did: read TRAINING, LESSONS, CLAUDE.md pillar zero + security, doc 14 §§A, H, N, P, J. Read every product file the range touches in full, plus the code they lean on (`lib/guardian-flow.ts`, `lib/auth.ts`, `app/coach/invite/actions.ts`, `app/claim/[slug]/actions.ts`, `lib/record-read.ts`, `lib/storage.ts`, 0037/0048/0049). Ran two throwaway probes against their own in-memory PGlite (all migrations applied, my own fixtures). Both are deleted. No product code changed. The dev database and the dev app were not touched.

Ran: `npm run -s test:perms`: **967 passed, 0 failed**. It is green, but the suite passes with every finding below still in the code. SQ3 and SQ8 assert two of the defects as intended behaviour, and door1–8 are source regexes (see Found, N5). I did not run render, write or layout, because QA holds the shared dev DB and app today.

**Count: 4 blockers, 10 must-fix, 8 notes.**

---

## Found: blockers

### B1 · A stranger can take a real coach's place and read children's records (new in b7ba029)
- **Where:** `app/join/actions.ts:139-151` (coach door: an account with a password and a `coach_profile` for any email, with no proof the person controls that address), `app/club/squads/actions.ts:117-121` (`inviteCoach` matches the coach by `lower(p.email)` + `coach_profile` + 18plus), `app/coach/invite/actions.ts:30-66` (accepting writes the coach membership, a WWCC attestation in the TD's name, and up to three register grants), `0053:52` (a register grant now also means full record read on the squad list and `cv/[playerId]`).
- **Scenario:** an adult knows the email of a club's real coach, `sam@…`. They sign up at `/join` as a coach with that email and their own password. Nothing is sent to Sam. The TD then brings Sam in from Squads, types `sam@…`, ticks "I checked their WWCC" and picks U14 Boys. The invite lands in the stranger's account. They accept. They now hold a coach membership, a WWCC attestation and grants for U14 Boys. That lets them read that team's registrations, and through 0052/0053 every U14 player's positions, number, foot, stats and clip count, and the full CV at `/club/squads/<id>/cv/<playerId>`. The one thing Sam gets is the doc 15 §12 "you're verified" email, sent to an account he doesn't have.
- **Smallest fix:** no credential and no `coach_profile` becomes usable until the address has been proved by a link sent to it. `inviteCoach` matches only accounts whose email is proved.

### B2 · Pre-registering a parent's email makes you that child's guardian (pre-existing; b7ba029 adds two more doors)
- **Where:** all three adult doors (`app/join/actions.ts:67-71`, `139-143`, `196-200`) create a password-bearing `person` for any email without proof. `lib/guardian-flow.ts:186-201` (`approveInvitation`) attaches the child to **the existing person with that email** if their DOB says adult.
- **Scenario:** someone who knows a parent's address (an estranged ex-partner, say) signs up through the new club door as `mum@…` with an adult DOB and their own password. Later the child starts sign-up and names `mum@…`. The real mother confirms on SMS and email and approves. The guardianship link is written to the account the attacker holds the password for. The attacker signs in and has every guardian control: the record, the link, sends, the squad card, pause and deletion. The mother never set a password, so nothing tells her anything is wrong.
- **Smallest fix:** the same email proof as B1. And `approveInvitation` never attaches a child to an existing account whose email was never proved: create a fresh guardian person, or have the approver prove control of the account.

### B3 · The squad page shows a club every registrant's full name, with no verification, subscription or guardian gate (D-126, doc 14 P18/P19, N17)
- **Where:** `app/club/squads/[squadId]/page.tsx:94-118` ("Ask someone from your register", TD only) and `actions.ts:88-94` (`inviteToSquad` checks only that a non-withdrawn registration exists). `squad_request_rules` (`0052:101-129`) checks nothing about a registration.
- **Scenario (probed):** a person claims an unverified club and picks "Technical Director" at claim time, which is self-declared. They add a squad and open it. `fn_register_rows` gives them 0 rows. The squad page lists `Kid Fourteen` with positions `ST, CM`: **first and last name**, where the register itself gives only a first name. The same happens for a **suspended** club. For a **verified club on the free tier**, the list includes registrants who never came through the club's own trial (P13/P18), and the invite insert succeeds (probed: `ok`). It also ignores the D-135 dunning hide and the P19 refusals (a u16 with no approved guardian).
- **Smallest fix:** build the askable list from the database's register answer: `fn_register_rows` ∪ `fn_trial_interest_rows`, or a new function that applies `fn_can_read_registration` per row. Show the first name only. Put the same predicate in `squad_request_rules` for `squad_invitation`, so the database refuses what the page hides.

### B4 · A 16–17 with no confirmed parent can hand a club their whole record (0048, D-22, D-91)
- **Where:** `0052:88-95` (`fn_can_act_on_squad`): the self branch asks only that the band is not u16.
- **Scenario (probed):** a 17-year-old signs up. Their parent hasn't confirmed yet, so `fn_can_dispatch` is `false` and they cannot send their CV (0048). They go to `/squad/<me>` and claim U14 at a verified club. The claim insert returns `ok`. The TD confirms. The TD and the granted coaches now get the live record on the squad list and the live CV. That is more than a send would have given them. The same path ignores the parent's "Sending is off" switch (`guardian_setting.send_disabled`). No parent is told when the claim is made.
- **Smallest fix:** in the self branch, require `fn_has_approved_guardian(p_person)` and `not send_disabled` for `16_17`, the same as `fn_can_dispatch`. Tell the guardian when a 16–17 claims (the bare wake is enough).

---

## Found: must-fix

**M1 · The squad read path computes its own answer instead of using the one the product already has.** `0053:50-58`, `app/club/squads/[squadId]/cv/[playerId]/page.tsx:35-52`. Probed: a u16 whose only guardian link is revoked or suppressed (the 0049 A2 case) still returns `record_id` and a readable CV to the TD. `fn_token_read` and `fn_can_read_registration` refuse the same child. The coach branch also uses register grants, while `fn_read_level` (A7) uses squad membership, so there are two answers to "which coach is on this squad". *Fix:* gate every record field per row on `fn_read_level(p_person, p.id) = 'full'`, plus the u16 approved-guardian check.

**M2 · "One club at a time" silently moves children and drops squads.** `0052:137-153`, `components/SquadCard.tsx:66-87`. Probed:
- (a) A parent claims Bee FC for their child and, before Bee answers, accepts an invitation from Verified FC. Once a membership exists, the card shows it and **hides the still-open Bee claim**, so the family can't see or cancel it. Weeks later Bee confirms. The child is **moved** to Bee FC, Verified FC's TD loses the child with no word, and the public CV now says Bee.
- (b) A player in U14 who is also asked into U15 at the **same club** (playing up) loses U14.
- (c) No `squad_left` is written for the ended memberships. The parent's timeline shows "went into a club squad" twice and never "came out".
- (d) The invitation card doesn't say that yes ends the current club.

*Fix:* joining closes the player's other open claims and invitations; each ended membership writes its own `squad_left`; memberships at the same club are not ended; the card states the consequence. SQ8 currently asserts the harmful behaviour.

**M3 · A parent keeps squad control after their child turns 18.** `0052:92-94` has no age check. Probed: `fn_can_act_on_squad(formerGuardian, adult) = true`, while `fn_read_level` says `public`. The parent can claim, accept or decline, and **Leave** for their adult child. The home query at `app/home/page.tsx:751-758` also shows them the adult child's squad invitations (P3: "no guardian anywhere"; P15: a re-granted guardian gets visibility, not control). *Fix:* the guardian branch requires the child's band ≠ `18plus`, with no re-grant exception. Same filter on the home query.

**M4 · The club can tell "no" from silence (D-138, doc 14 P6 by analogy).** `page.tsx:80-85` and `101`. An ignored invitation stays under "Asked, waiting on them" indefinitely. A declined one disappears, and the player comes back into the askable list. *Fix:* the club's view of an invitation must be the same whether it was declined or ignored. Keep an answered-no invitation shown exactly like an open one until the club takes it back, or lapse both on the same clock.

**M5 · "On your register" is shown to a club administrator (N17, D-154).** `0053:88` returns `on_register` outside the `v_reads` gate, and `page.tsx:236` renders it for everyone. That is a register fact the administrator may not have. *Fix:* gate `on_register` by the TD/grant answer. Add it to SQ6b.

**M6 · False consent-log events can be written into any child's history.** `app/club/squads/[squadId]/actions.ts:126-136` inserts `squad_left` whether or not a row changed. An administrator who posts `removeFromSquad` with any person id they have seen (a registrant, say) writes "came out of a club squad" into that child's guardian timeline. `app/squad/actions.ts:82-90` has the same shape. *Fix:* log only when `rowCount > 0`, in the same statement or transaction as the update.

**M7 · "The family can see who read it" is not true for squad reads.** `page.tsx:295` tells a granted coach so. The CV page writes `squad_record_opened` (`cv/[playerId]/page.tsx:56-60`), which the guardian sees as "club opened their record" with no name (`app/g/controls/[childId]/page.tsx:118`). It never reaches `register_read_log` or `RegisterReaders`. *Fix:* show the reader's name on that line, or change the copy (BUZ's call).

**M8 · A u16 is shown buttons they can't use, and told it worked.** `SquadCard` renders with `mine` on the child's own `/home` and `/build`: "Yes, I play there", "Leave", "Cancel", "Add your club". Each one is refused, and the redirect says `?squad=joined` or `left`. D-91 wants this said plainly. *Fix:* for a u16, render the card read-only with "Your parent answers this."

**M9 · Unverified and suspended clubs can publish an alumni wall and players-wanted notices.** `app/club/page-edit/actions.ts:90-132` checks the role only, and `app/fc/[slug]/page.tsx:338, 371` renders for any state. The only guard against naming a child is a tick the claimant gives themselves. The brief has the wall seeded by us during onboarding. *Fix (the more restrictive reading):* writes, or at least rendering, require `club_state = 'verified'`.

**M10 · Acting on an old request doesn't re-check who is still allowed.** `answerClaim` (`actions.ts:57-80`) and `answerSquadInvitation` (`app/squad/actions.ts:54-74`) re-check nothing when they join:
- A claim made by a guardian who has **since been revoked or suppressed** can still be confirmed.
- An invitation from a club that has **since been suspended** can still be accepted, and the public CV then shows that club.
- A suspended club's administrator still sees pending claimants' names (probed: 1 row).

*Fix:* `fn_join_squad` re-checks that the club is verified, the player is not hidden, and (for a claim) `fn_can_act_on_squad(asked_by, person)`. The claims list filters on verified.

---

## Found: notes

- **N1** · No rate limit on any sign-up door (D-94 §2: every unauthenticated endpoint). This makes B1/B2 cheap at scale.
- **N2** · `back` comes from the form and becomes the redirect target (`app/squad/actions.ts:30,42,49,74,80,91,98,107`). Next's origin check blunts cross-site use. Still, accept only paths that start with a single `/`.
- **N3** · `answerClaim` and `answerSquadInvitation` swallow every error and redirect with success words (`done=confirmed`, `squad=joined`). L12 applies to strangers, not to the person who acted.
- **N4 · Demo mode.** The claim holds for the database (a constant URL, whatever `SUPABASE_DB_URL` says), email and SMS (`lib/providers`), Stripe and the waitlist. In production, `PITCH_DEMO=1` makes every page throw, which fails closed. Gaps:
  - (a) `lib/storage.ts:32-37` is not gated on `isDemo()`. Only the launcher's env blanking keeps a demo upload out of the real bucket, so `PITCH_DEMO=1 npm run dev` with keys in `.env.local` would write there.
  - (b) Card approval fetches `NEXT_PUBLIC_SITE_URL`, which is not blanked, or `localhost:3000` (`app/g/card/[cardId]/actions.ts:41-43`). A demo reaches the production site or the dev app, and hashes the wrong image.
  - (c) `next dev` (`scripts/demo.mjs:74`) listens on every interface, so anyone on the meeting's Wi-Fi can open `:3030/demo` and take any seat with no password. The data is fictional; bind to `127.0.0.1` anyway.
  - (d) TRAINING §3.1 says "no real club's name used for fictional data", and the demo renames the fictional club to the real club BUZ is meeting. BUZ approved the demo. His carve-out should be written down, and nothing captured from a demo should leave the room.
- **N5 · Tests that can't fail on these bugs (L19).**
  - SQ3 asserts a 16–17 acts alone (B4). SQ8 asserts the silent move (M2).
  - door1–8 grep the source. door7 counts `on conflict (email) do nothing` and cannot see B1/B2.
  - SQ6b doesn't check `on_register` (M5).
  - Nothing covers the askable list (B3).
- **N6** · Preview says "exactly what a club sees", but a paused or held child is seen by no club. Copy for BUZ.
- **N7** · The 0051 alumni trigger runs `before insert` only, so an `update` could strip the confirmation. There is no app path that does this today.
- **N8** · Pre-existing, outside the range: the club claim lets the claimant **self-declare** Technical Director (`app/claim/[slug]/actions.ts:80`). CLAUDE.md says a TD is never self-declared, and this is what gives B3 its unverified-club version.

Copy for BUZ: none new from this seat. M7, M8 and N6 are existing strings that need BUZ's decision.

Risks, and what I did not check:
- I did not run render, write or layout, or look at any page in a browser. All page-level findings come from reading the code plus database probes.
- I did not walk B1/B2 end to end through the running app. They are from reading the code, confirmed against the source of `verifyPassword`, `approveInvitation` and `answerCoachInvite`.
- I did not read the whole diff of `scripts/demo-layer.mts` or `scripts/layout-check.mjs`, apart from DEMO6/7.
- I did not check timing equality of the new doors beyond reading them.
- I did not re-audit CSP or headers for the new routes.
- I did not check whether `/api/digest` can send in a demo. It can't today, but only because `digestCounts` returns null through the waitlist lock.

Lesson: an email address is not a person until they have clicked a link sent to it. Every door that creates a credential, and every lookup that matches people "by email" (coach invites, guardian approval), is a place where someone who knows an address can become that person.
