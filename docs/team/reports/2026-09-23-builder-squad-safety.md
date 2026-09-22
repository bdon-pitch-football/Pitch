# build: package A — the squad and club-side fixes (2026-09-23)

Asked: BUZ's 23 Sep fix list, package A — B3, B4, M1–M6, M10, N2, N3, N8, R1 and QA's
two smaller ones — on `app`, base `e2d85ac`, migrations 0054 and 0055 only.

Did: two migrations, thirteen files, two suites. Committed as `7d7862a`.

**`supabase/migrations/0054_squad_safety.sql`** — every rule below is in Postgres, so the
page cannot be the thing that decides.
- **B3.** `fn_can_ask_to_squad(person, player, squad)` is the one predicate: the asker is
  the club's TD (D-154/N17), and the player has a registration this TD may actually read —
  `fn_can_read_registration`, per row, which already carries verification (D-126), the
  subscription and dunning state (D-135), the free tier's own-trials rule (P13/P18) and
  P19's refusals. `fn_squad_askable` is the list built from it, **first name only**, one row
  per player. `squad_request_rules` calls the same predicate, so the database refuses the
  `squad_invitation` the page hides.
- **B4.** `fn_can_act_on_squad`'s self branch now asks what `fn_can_dispatch` asks of a
  send (0048): from 16, an approved guardian **and** the guardian's send switch on. The
  guardian keeps acting while the switch is off, as with a send.
- **Leaving is a separate question.** `fn_can_leave_squad` — self from 16, an approved
  guardian under 18 — carries M3's age check and none of B4's conditions, because a child's
  way out must not depend on a parent's send switch (D-10, D-26's shape). `leaveSquad` and
  `withdrawClaim` use it; claiming and accepting use `fn_can_act_on_squad`. **This split is
  mine, not the list's — say if you want one question instead of two.**
- **M3.** The guardian branch refuses when the child's band is `18plus`, re-granted or not
  (D-49, P15). Same filter on the squad-invitation query in `app/home/page.tsx`.
- **M1/M5.** `fn_can_read_squad_player(person, squad, player)` = `fn_read_level(...) =
  'full'` + the under-16 approved-guardian check + the reader standing in this squad at this
  verified club. `fn_squad_roster` calls it **per row** and gates every field off the record
  behind it, `on_register` included. `cv/[playerId]` asks the same single question the way
  the register's CV route asks `fn_can_read_registration`.
- **M2, M10, BUZ 2 and 6.** `fn_join_squad` keeps memberships at the same club (playing up),
  ends other clubs' with **one `squad_left` per membership**, closes that player's other open
  claims and invitations, and re-checks at the join that the club is still verified, the
  player is not hidden and — for a claim — that the asker may still act.
- **BUZ's decision 2.** `fn_cv_club(person)` + `fn_approved_cv(record)`: the approved
  snapshot's `club`, `clubCrestPath`, `locality` and `squad` follow the membership; nothing
  else about the snapshot moves, so D-119 is untouched. `fn_token_read` and the three page
  readers (register CV, squad CV, the family's preview) all go through `fn_approved_cv`.
  QA's sqf6 passes on this.
- **M4 / BUZ 7.** `squad_invitation.withdrawn_at` and `.lapsed_at`. `fn_squad_asked` shows a
  declined invitation exactly as an unanswered one until the club takes it back or 30 days
  pass; `fn_lapse_squad_invitations()` runs in the daily job. A declined player cannot
  reappear on the askable list, which would say it for them.

**`supabase/migrations/0055_row_level_security.sql`** (R1) — `app_config`, `coach_invite`,
`register_grant`, `register_read_log`. No policies: every read goes through the service role
and a permission function (D-80), so enabled-and-policyless is the right shape.

Pages and actions:
- `app/club/squads/[squadId]/page.tsx` — askable and asked lists come from the two new
  functions; position chips derived from what the list actually holds; chips 44px (QA F4);
  the 60-row cap is stated (QA F7); the asked list is a first name.
- `app/club/squads/[squadId]/actions.ts` — `inviteToSquad` asks `fn_can_ask_to_squad`;
  `answerClaim` passes the claim's `asked_by` and reports `?error=1` when the join is
  refused (N3); `cancelInvitation` writes `withdrawn_at`, not an answer; `removeFromSquad`
  logs `squad_left` in the same statement as the update, so only a real change writes one (M6).
- `app/squad/actions.ts` — `back` must be a path with a single leading `/` or it becomes
  `/home` (N2); `leaveSquad` logs per membership actually ended (M6) and says nothing worked
  when nothing did; `answerSquadInvitation` ignores withdrawn and lapsed invitations.
- `components/SquadCard.tsx`, `app/home/page.tsx`, `app/g/controls/[childId]/page.tsx`,
  `app/build/[recordId]/page.tsx` — a withdrawn or lapsed invitation is not something to
  answer; one error line when an answer did not go through.
- `app/claim/[slug]/actions.ts` + `page.tsx` (N8 / BUZ 9) — a claimant becomes `club_admin`,
  full stop. The role radio group is gone.
- `app/api/jobs/daily/route.ts` — the squad lapse, nothing else touched.

Tests (L22 first): **SQ3** asserted "a 16–17 acts alone" and **SQ8** "joining ends every
other club" — both were the defects. They now assert the rule. 35 new checks in
`permission-tests.mjs` (SQ3b–h, SQ8b–h, SQ16–SQ22c, tap1, RLS1–2), 6 in `write-tests.mjs`
(sqf12–sqf17: first-name-only, the no-that-looks-like-silence, the off-site `back`).

L20 proofs — each bug put back, watched fail, restored:
`RLS1` (drop 0055) → fails naming all four tables · `SQ3`/`SQ3c` (old self branch) → fail ·
`SQ8`/`SQ8d` (end every membership) → fail · `SQ16–SQ19d` (old write rule + hand-written
list) → 6 fail, the unverified club leaking 2 rows and the suspended one 6 ·
`SQ21b`/`SQ21d` (old roster gate) → fail · `SQ22`/`SQ22b` (snapshot without the overlay) →
fail · `tap1` (chips back to 36px) → fails.

Ran: from a fresh seed, in the TRAINING §4 order, against a checkout of the commit
(`git archive HEAD`) — see Risks for why not in the working tree.

| Suite | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `test:perms` | **1003/1003** (was 967) |
| `test:render` | **369/369** |
| `write-tests` | **287/287**, 92/92 forms submitted (was 280/281 with sqf6 failing) |
| `layout-check 375 1280` | **182 views, 0 overflow, 0 unrendered** |
| `gate-coverage` | 261/261 pinned, 0 open |
| `palette-check` | green, 14/14 colours, 3 raw-hex infos (pre-existing) |
| `corpus-check.py` | 0 failures, 0 warnings |
| `secret-scan` | no secrets |
| `build:check` | exit 0, 22/22 static |

QA's sqf0–sqf11: all pass. sqf6 was the one failing check at hand-over and passes on BUZ's
decision 2. No sqf check needed changing.

Found:
- **Package B is in the same working tree and on the same ports.** Migration 0056, `app/join`,
  `app/signin`, `lib/auth.ts`, `lib/guardian-flow.ts`, `lib/messages.ts`, `lib/messaging.ts`,
  `scripts/dev-db.mts`, `scripts/layout-check.mjs`, `app/confirm/` and both test scripts are
  edited under me, and their dev database (54322) and app (3000) took mine over mid-run —
  the first layout run I did measured their seed and reported 16 phantom failures. Two seats
  cannot run the suites at once as the tooling stands: `dev-db.mts` hard-codes 54322 and
  `next dev` 3000. **Suggestion for Leo, not built: a `DEV_DB_PORT` env hook in `dev-db.mts`
  to match the `RENDER_BASE` one the three test scripts already have.**
- **There is now no route by which any club gets a Technical Director** (the consequence of
  N8 you asked me to check). Claiming makes an administrator; `/ops/call/[clubId]` records
  the call and sets `club_state`, and has no field for who the TD is; nothing else writes
  that role. So on live data, after this change, `fn_can_work_register` is false for every
  club: no register, no askable list, no squad-record reads. The dev seed writes TDs
  directly, which is why every suite is green. **This needs a product decision and it is
  yours/BUZ's:** (a) the call sheet gains "Technical Director — name and email", written as a
  membership when the outcome is `verified` (matches D-137's shape: a human, named, logged);
  (b) the club's own People screen lets an administrator appoint a TD after verification;
  (c) an operator-only control on the verification screen. I have built none of them.
- **The ops verification screen** (`app/ops/verification/page.tsx:22`) reads "claimed by
  <name>, <role>" from the first `technical_director` **or** `club_admin` membership — after
  N8 that line will read "club admin" for every newly claimed club. It still works and names
  a person; it just no longer distinguishes anything. Left as is.
- **A register grant alone no longer opens a squad player's record.** Under M1 the depth
  follows `fn_read_level`, which for a coach is doc 14 A7 — a WWCC-attested coach **assigned
  to that squad**. A coach brought in through the register-grant door with no squad
  membership (the seed's Sam) now sees names on a squad list and no record fields. That is
  doc 14's answer and it is what you asked for, but it narrows what 0053 shipped, so it
  should be a conscious call.
- `components/SquadCard.tsx` still does not say that yes ends the membership at another club
  (safety M2d). It is a copy change and was not on my list; the sentence is BUZ's to write.
- Still open from the safety review, outside package A: M7 (the "family can see who read it"
  line on the squad page is still not true — no name reaches `register_read_log`), M8, M9,
  N1, N4, N6, N7, and QA's F5 and F9.
- `scripts/_tmp-write-mine.mjs` — a 112 KB untracked copy of the write suite is sitting in
  `scripts/`. Not mine; left alone.
- Watch: `fn_squad_askable` calls `fn_can_read_registration` once per registration. On the
  dev seed (60+ rows at Riverside) the squad page renders in 50–200 ms; at a few hundred
  registrations this is the first thing to measure.

Copy for BUZ: three changes, all proposals.

1. `app/claim/[slug]/page.tsx` — **removed** the "Who are you at the club" question and its
   three options ("Technical Director — Runs the football side. From December, the only role
   that reads a player's development record." · "Club administrator — Runs the page, the
   teams and the trial notices. Never reads a player's development record, by any route." ·
   "Committee or president — Same as an administrator. You can hand the football side to your
   TD once you're in."), and **added** in their place:

   > What claiming makes you
   >
   > **Club administrator**
   > You run the page, the teams, the trial notices and the billing. **An administrator never
   > reads a player's development record, by any route.** Technical Director is confirmed on
   > the verification call, never chosen on a form.

2. `app/club/squads/[squadId]/page.tsx`, under "Ask someone from your register", when more
   than sixty people match:

   > Showing the first 60 of 74. Filter by a position to see the rest.

3. `components/SquadCard.tsx`, on the family's own screens, when an answer did not go
   through:

   > That didn't go through. Nothing changed — try again, and if it keeps happening the club
   > may no longer be on Pitch.

Behaviour that existing copy now describes differently (L25, for the copy seat): "Asked,
waiting on them · nothing happens unless they say yes" on the club's squad page now also
covers a family that answered no — which is the point of M4, but the sentence was written
when it could only mean silence.

Risks, and what I did not check:
- **Where I ran the suites.** The working tree holds package B's unfinished work, and its
  migration 0056 makes the permission suite's own fixtures throw, so nothing can be measured
  there today. Every number above comes from a checkout of my commit (`git archive HEAD`)
  with its own database (54325) and app (3100); the only difference from the commit is one
  line in `scripts/dev-db.mts` reading the port from the environment, which is test harness,
  not product. I staged my two test-file changes with `git hash-object`/`update-index` so
  that package B's in-flight checks were not swept into my commit; their working-tree copies
  are untouched. **Somebody should re-run the full sequence once both packages are in.**
- BUZ's decision 2 means an under-16's public CV club, crest and locality can change without
  a new guardian approval of that version. That is the decision as given; it is also the only
  part of the snapshot that now moves on its own, and it is worth one sentence back to BUZ
  that the crest and the club's suburb travel with the club name.
- I did not open any page in a browser myself beyond the layout check's headless Chrome.
- I did not test the 30-day lapse against a real clock — the check moves `created_at` back.
- I have not re-read the demo (`npm run demo`) since 0054; it will need a restart (L14).
- I did not touch `app/join/`, `lib/auth.ts`, `lib/guardian-flow.ts` or 0056.

Lesson: when two seats share one working tree, one dev database and one port, neither can
trust a failure — the first sixteen "failures" I chased were another builder's seed under my
app. Isolate the run (a checkout of your own commit, its own ports) before believing a red,
and stage by path so a commit carries your work and only yours.
