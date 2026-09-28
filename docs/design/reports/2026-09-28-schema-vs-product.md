# schema: what the database promises that no screen delivers (28 Sep 2026)

**Asked:** the critic seat found `record_entry` complete in the schema with zero application
code touching it. Find the rest, and separate three kinds — a deferral the brief ordered, a
gap nobody decided, and a promise on screen with nothing behind it. Two named checks:
`provenance` (D-62) and `surfaced_stats` (D-105).

**Method:** read `docs/team/TRAINING.md`, `CLAUDE.md` (§0, architecture, the 25 Aug schema
delta), `docs/09-Data-Model.html`, `docs/14-Permission-Tests.md` §D. Then a mechanical
cross-reference of every table, every `fn_*` and every `consent_event` value in
`supabase/migrations/` against `app/`, `lib/`, `components/` and `scripts/`. Then read-only
row counts from the shared dev database on 54322. Read-only throughout: no reseed, no write
suite, no port taken, `app/globals.css` and the legal renderer untouched.

`df -h /` before: 18Gi avail. After: 11Gi avail. The 7Gi is the two builders and the dev
server on the shared machine, not this seat — I wrote one file.

**The empirical baseline**, from the shared dev database, 28 Sep:

```
record_entry 0 · assessment_entry 0 · assessment_block 0 · assessment_session 0
competency 0 · growth_note 0 · match_appearance 0 · coach_authorship 0
investigation_grant 0 · investigation_access 0 · share_card_approval 0
experience_entry 12 · player_stat 287 · development_record 100 · consent_event 140
```

`consent_event` holds 11 of its 36 permitted event types. Nothing has ever written the other
25 in this database, and for five of them nothing in the product can.

**One thing I want to say before the list.** Three of these findings are only invisible
because **the seed writes what the code does not**. That pattern — a fixture hand-set to the
value the product would get wrong — appears at `scripts/dev-db.mts:131`, `lib/fixtures.ts:129`
and in the seeded consent log. Every one of them demos correctly and would be wrong for the
first real family. That is the most useful thing in this report.

---

## Ranked

| # | What | Kind | Cost to close |
|---|---|---|---|
| 1 | `record_entry` and the three mechanisms standing on it | **Part deferral, part undecided** | A screen (Dec) — but five of six entry types were never deferred by anyone |
| 2 | Consent-funnel delivery telemetry (D-78) | **Promise on screen** | ~half a day: one webhook branch, one new endpoint, or delete five labels |
| 3 | `fn_who_looked` — John's disclosure ruling | **Undecided gap** | A component on a screen that already exists |
| 4 | Club suspension → guardian notification | **Decided, tracked, half-built** | One form field + one column write |
| 5 | Share-card image renders numbers with no provenance tag | **Promise on screen** | One line of JSX |
| 6 | `STAT_SETS` imported by nothing — a keeper's defaults are wrong | **Undecided gap** | One line in `BuildForm.tsx` |
| 7 | `growth_note` — no permission layer, no screen, no test | **Undecided gap** | A decision, then a trigger and a screen |
| 8 | `match_appearance` | **Correct deferral** (D-66, runway step 7) | Nothing now |
| 9 | `assessment_entry` · `competency` · `assessment_block` · `assessment_session` | **Correct deferral, exactly as ordered** | Nothing now |

And two things the brief asked me to suspect that are **not** gaps: `surfaced_stats` ships
with a working control and explanatory copy, and `experience_entry` ships end to end. Both
written up below so the record is straight.

---

## 1 · `record_entry`: the deferral covers one of its six types, not all six

**Schema.** `supabase/migrations/0002_phase1_core.sql:231–241`. Six entry types:
`attendance · participation · effort_observation · milestone · coach_note ·
competency_observation`. The write engine is `fn_write_provenance`
(`0015_write_permissions.sql:32–88`) behind the trigger `record_entry_provenance_derived`
(`:93–117`) and the 48-hour window in `record_entry_edit_window` (`:120–133`).

**What reads it.** No application code. Three database mechanisms do:

- `fn_read_level` (`0003_permissions.sql:141–147`) returns the read level `authored_only`
  **only** when a `record_entry` row exists with `provenance = 'coach_verified'`.
- `record_erasure_keeps_counts` (`0026_authorship_after_erasure.sql:42–46`) builds
  `coach_authorship` by counting `coach_verified` entries at deletion time.
- `fn_my_authorship` (`0026:55`) reads those counts back for a coach.

**What writes it.** `scripts/permission-tests.mjs` (lines 226, 1017, 2273–2302) and nothing
else. Doc 14 §D1–D13 all pass — against synthetic inserts.

**Where the critic's finding needs splitting.** The brief's deferral is specific: *"Assess-a-
player **UI** (Stage 2 — December). Build now: the schema, the write-permission functions and
doc 14's section D tests. Build no assessment screens."* That is **category 1 and it has been
executed precisely.** `fn_write_provenance` exists, is tested, has zero app callers. Correct.

But an assessment is `competency_observation`. **Nobody ever deferred the other five.**
`attendance`, `participation`, `effort_observation`, `milestone` and `coach_note` are not
assessments, are not bands, need no `competency` row and no framework version. D-71's stated
reason for the type discriminator is *"so effort and participation are never second-class"* —
and today they are not second-class, they are absent. No register decision, no runway step and
no cut-line item covers them. That is a gap nobody decided, sitting inside a deferral that
looks like it covers everything.

**What a user would see if surfaced.** A `coach_note` on a player's record is one textarea for
a verified squad coach and one read-only card on the family's view — the whole "living record"
claim, at roughly a day's work, with the permission engine, provenance derivation and the
48-hour window already built and already green. `milestone` is the same shape.

**The cascade, and it is worth naming.** Because nothing writes a `coach_verified` entry:
`authored_only` is a read level unreachable in production and no screen branches on it (both
`fn_read_level` mentions in `app/`/`lib/` are comments — `lib/record-guard.ts:5` and
`app/club/squads/[squadId]/cv/[playerId]/page.tsx:35`); `coach_authorship` is permanently
empty; `fn_my_authorship` has no caller. D-48 — *"authoring coaches keep read-access to what
they wrote"* — is fully built, fully tested and structurally unreachable. It is not wrong. It
is waiting on one write path.

**Cost:** nothing but a component and a server action for `coach_note`. No migration. The
gate work is done.

---

## 2 · The guardian's consent log names five events nothing will ever write

**This is the clearest promise-with-nothing-behind-it in the product**, and it is on the one
screen whose stated job is to be complete.

`app/g/controls/[childId]/page.tsx:88–130` carries `EVENT_LINES`, a plain-English line for
every value in the `consent_event` vocabulary. Its own comment says *"EVERY event in the
consent_event vocabulary needs a line here."* Five of those lines can never render:

| Label a parent is promised | Line | Why it cannot appear |
|---|---|---|
| "That email reached your inbox" | `:94` | `email_delivered` |
| "You opened that email" | `:95` | `email_opened` |
| "That text reached your phone" | `:97` | `sms_delivered` |
| "You opened the permission page" | `:98` | `guardian_landed` |
| "Their age band changed" | `:119` | `age_transition` |

**What writes them: nothing.**

- **`email_delivered`.** `app/api/webhooks/resend/route.ts` is built, signature-verified, and
  on `email.delivered` it writes `message_outbox.delivered_at` — **a different table**. D-78 is
  explicit: *"Email and SMS provider delivery webhooks write into the same table."* They do
  not. The receipt exists; it is just not on the spine.
- **`email_opened`.** Declined on purpose at `resend/route.ts:73` — *"opened/clicked are not
  tracked: we do not need them."* I think that is the right privacy call. But the vocabulary
  value and the parent-facing label both survived the decision.
- **`sms_delivered`.** `app/api/webhooks/sms/route.ts` handles **inbound** STOP/START/HELP
  only. There is no SMS delivery-receipt endpoint anywhere in `app/api/`.
- **`guardian_landed`.** No `consent_event` write exists anywhere under `app/a/` (the guardian
  landing route). **But `scripts/dev-db.mts:131` seeds it.** So Deniz's controls screen reads
  "You opened the permission page" in the dev app and in the club demo, and a real guardian's
  log never will.
- **`age_transition`.** `app/api/jobs/daily/route.ts:57` writes `age_transition_notice` and no
  consent event. D-49's *"birthdays are logged"* is not logged where the parent reads.

**Why it costs more than five labels.** D-78's stated purpose is that *"'the parent ignored
us' and 'Gmail spam-foldered us'"* must be distinguishable. Today they are distinguishable in
`message_outbox` and indistinguishable on the spine and on the parent's screen. The 7am digest
and the SQL views D-78 specifies read the spine.

**Cost:** three lines in the Resend handler to insert `email_delivered` alongside the existing
update; one `guardian_landed` insert in `app/a/[id]/page.tsx`; one `age_transition` insert in
the daily job. A new endpoint for SMS receipts, or a decision not to. And for `email_opened`,
delete the value and the label — a vocabulary entry we have decided against should not sit in
a `check` constraint looking available. Whichever way each goes, **the seed must stop writing
events the product cannot**, or the next seat will keep verifying this screen against fiction.

---

## 3 · `fn_who_looked` — a guardian may ask who looked at their child's record, and no screen asks

**Schema.** `supabase/migrations/0025_john_rulings.sql:130–156` creates `investigation_grant`
and `investigation_access` with an append-only trigger. `fn_who_looked` (`0025:162–184`)
authorises the caller as the subject or an approved guardian and returns time, investigator
name, report id and what was accessed.

**What reads it.** Nothing in `app/`, `lib/` or `components/`. Two tests in
`scripts/permission-tests.mjs`.

The comment above it is the promise: *"a guardian may ask who looked at their child's record
and why, and get a straight answer."* The guardian controls screen already calls
`fn_send_log` in the same query (`app/g/controls/[childId]/page.tsx:73–75`) — and that
function's own comment records the identical defect being fixed once already: *"fn_send_log
has answered this correctly since 0025 and the suite has been green on it — and NOTHING IN
THE APP EVER CALLED IT."* `fn_who_looked` is the same bug, on the same screen, still open.

**What a user would see.** One more block under "Who has it": a dated list of "Elly Hart ·
investigating report #4128 · read the record". Empty for every family until an investigation
is ever granted, which is the honest answer and also why it is cheap.

**Cost:** one more subselect in a query that is already there, and one card. No migration.
This is a General Counsel ruling with a database implementation and no reader — the same class
of defect as `fn_send_log`, which we have already agreed is not acceptable.

---

## 4 · A club can be suspended today and no family is told

**Schema.** `0025_john_rulings.sql:190–191` adds `club.suspension_reason` with the closed list
`child_safety · administrative · non_payment`. The whole point of the column (`0025:186–189`):
only the child-safety class notifies families, because *"either every de-verification alarms
families or none does, and both are wrong."* `fn_guardians_to_notify_on_suspension`
(`0025:195–212`) returns exactly the right recipients — guardians whose live link went to that
club. `undo_token` (`0025:219`) and `app/undo/[token]/page.tsx` give them the one-tap off
switch. `clubDeverifiedEmail` (`lib/messages.ts:344`) is doc 15 §37, written.

**What writes `suspension_reason`.** Nothing. `app/ops/call/[clubId]/actions.ts:62–63` is the
only path that suspends a club — outcomes `suspended` and `takedown` both write
`club_state='suspended'` and never touch `suspension_reason`. So the operator cannot record
the class that decides whether families are warned.

**What calls the function.** Nothing. `fn_guardians_to_notify_on_suspension` is the only
`fn_*` in the schema with **zero app callers, zero SQL callers and zero tests**.

**This one is at least honest with itself.** `scripts/permission-tests.mjs:3344` lists
`clubDeverifiedEmail` as a named exemption — *"doc 15 §37: needs the child-safety reason class
on the verification call"* — and the suite fails if any other doc 15 message goes unsent. So
somebody saw this and wrote it down. I am not calling it undecided. I am calling it the
highest-consequence half-built chain in the product, because the **suspend button ships**: an
operator can take a club down for a child-safety reason this afternoon, families holding live
links to that club learn nothing, and the code to tell them is already written.

**Cost:** one radio group on the ops call form, one column in the existing `update`, and a
send loop in the same action. Everything downstream exists. This is hours, and it should not
wait for December.

---

## 5 · `provenance` (D-62) — present on six surfaces, absent on the one that is permanent

**The rule:** *"The UI always displays the tag... Never render a number without its source."*

**Every surface that renders a stat number, audited:**

| Surface | Tag | Fidelity |
|---|---|---|
| Public CV, all six callers | `components/cv/PlayerCV.tsx:43` — pill, "Self-reported" | Block-level, hardcoded |
| Print CV | `app/p/[token]/print/page.tsx:71` | Hardcoded |
| OG / social card | `app/p/[token]/opengraph-image.tsx:124` | Hardcoded |
| Squad roster (club side) | `app/club/squads/[squadId]/page.tsx:282` — "2026 · self-reported" | Hardcoded |
| Build form | `app/build/[recordId]/BuildForm.tsx:181` | Hardcoded |
| CV metadata / description | `lib/cv-meta.ts:40` | Hardcoded |
| **Guardian-approved share card** | **`app/g/card/[cardId]/image/route.tsx` — none** | **Missing** |

Coverage is good. One hole, and it is the worst one to have:

**`app/g/card/[cardId]/image/route.tsx:74–80`** renders up to three stat numbers at
`fontSize: big` — the largest type on the image — with the stat label under each and no
provenance tag anywhere in the composition (PITCH wordmark, name, squad number, positions,
three numbers). This is the artefact D-101 makes the guardian approve *because it cannot be
recalled*, and D-89 warns is *"cached permanently by every platform that meets the link."*
The public CV page can be revoked and re-tagged. This image cannot. **It is the one number in
the product that will outlive every correction we could make, and it is the one with no source
on it.**

**Cost:** one line of JSX beside the tiles. It is also the only D-62 item on this list that is
a safety-adjacent miss rather than housekeeping.

**The fidelity caveat, stated honestly.** Every tag above is a **hardcoded string**, not the
column. `lib/record-read.ts:69` and `lib/cv-build.ts:141` both select `provenance` per stat
row and ship it to the client; `PlayerCV.tsx`'s `StatTiles` (`:30–52`) discards it and prints
"Self-reported" for the block. Today that is always true, because `lib/cv-build.ts:36` is the
only writer and hardcodes `'self_reported'`. It stops being true the first time anything
writes a `coach_verified` stat — at which point a coach-verified number renders under a
self-reported label, which is the exact failure D-62 exists to prevent, on the surface a TD
reads. Per-tile derivation is a small change now and a live-data problem later.

**One related asymmetry.** `record_entry` has a database trigger that *derives* provenance from
the actor and rejects a supplied value (`0015:93–117`, doc 14 D8). `player_stat` has **no such
trigger** — its `provenance` is whatever the application passes. CLAUDE.md §Security 3 says
*"provenance is set by the server from the actor, never accepted from the request body."* One
path writes it and writes it correctly, so nothing is wrong today; the property is in the app
layer rather than the database, which is the one place the brief says it must not be. Cheap to
make structural while `player_stat` is the simpler of the two.

**Not numbers, but worth BUZ's eye:** the CV's *Football history* section carries a plain
provenance line (`PlayerCV.tsx:246–248` — "Earlier clubs are Deniz's own account of where they
played. Only the club at the top is one we hold on Pitch."). *Achievements* and *Other
football* carry none. The coach page already sets the pattern and says why
(`app/c/[slug]/page.tsx:229–234`). One line of copy, BUZ's approval, no code.

---

## 6 · `surfaced_stats` (D-105) — delivered. And `STAT_SETS` is dead code.

**The answer to the question asked: yes, a player can choose.**
`app/build/[recordId]/BuildForm.tsx:186–189` renders each of the four stat keys as a tile whose
label is a 44px tap target that toggles inclusion; unselected tiles drop to `opacity: 0.45`;
the selection posts as a hidden field (`:118`) and `lib/cv-build.ts:29` writes the array. The
never-zero rule is enforced on the read side at `PlayerCV.tsx:33–37` (selected **and**
positive, else no block at all). And it is explained on screen — `:182` reads **"Tap a name to
show or hide it"**. All four keys are choosable including `apps`, per BUZ 27 Aug. This one is
done, and done properly.

**The gap underneath it.** `STAT_SETS` (`lib/football.ts:53–59`) — which CLAUDE.md's schema
delta names as *"the default pre-selection"* — is exported and **imported by nothing**.
Records are created with `surfaced_stats = '{}'` (`app/join/actions.ts:114`,
`lib/guardian-flow.ts:244`), and `BuildForm.tsx:30` then falls back to a hardcoded
`['apps', 'goals', 'assists']` regardless of position.

**So a goalkeeper's build form opens with Goals and Assists lit and Clean sheets dimmed.**

`lib/fixtures.ts:53` even carries the comment *"the player's selection, position set by
default"*, and `:129` hand-sets Nate — the 17-year-old GK fixture built specifically to
exercise the GK stat set — to `['apps','clean_sheets']`. **The fixture is correct because
somebody typed it, so every screen and every screenshot looks right, and the first real
keeper gets it wrong.** This is exactly the class of bug the three house fixtures were created
to catch, defeated by seeding the fixture with the answer.

**Cost:** derive the position group from `positions[0]` and read `STAT_SETS` in `BuildForm`.
One line, no migration, no decision needed — the default is already specified in the brief.

---

## 7 · `growth_note` — a table, a doc 14 expectation, and nothing in between

**Schema.** `0002_phase1_core.sql:545–554`. `entered_by`, `height_cm`, `measured_on`. The
comment says *"guardian only, enforced in the permission layer"* and *"coach-invisible, no
classification (D-84)"*.

**What reads or writes it.** Nothing. Outside its own `create table` and the RLS loop at
`0002:571`, the string `growth_note` appears nowhere in the repository except `CLAUDE.md`, doc
09 and the critic's report. **No function, no trigger, no RLS policy, no test, no seed row, no
screen.** Zero rows in the dev database.

**Why this is a gap and not a deferral.** Doc 14 **D6** states an expectation about it today:
*"`guardian` writes an assessment → **Denied.** Guardians write growth notes (D-84) and
nothing else."* Half of that row is enforced (the guardian is denied assessments — via
`fn_write_provenance`, tested). The other half — that a guardian *can* write a growth note,
and that a coach cannot read one — has no implementation and no test. The table comment claims
enforcement "in the permission layer" and there is no permission layer for this table.

Defensively we are fine: RLS is default-deny with no policies, so nothing can touch it. But
"coach-invisible" is currently true by accident of there being no reader at all, not by a
rule. The moment a screen is added, the rule has to be written from scratch, and D-84 is a
child-safety-shaped decision (height data about a minor, deliberately with *no*
classification, deliberately invisible to a coach) — the kind the training pack says not to
guess.

**What a user would see.** A guardian-only row on their own child's page: "Height · 168cm ·
recorded 2026-09-12". Two fields, one date picker, invisible to everyone else.

**Cost:** a decision from BUZ on whether it ships at all (it is not on the launch scope table
either way), then a trigger asserting guardian-only writes and coach-invisible reads, a doc 14
row, and a small screen. Not a migration.

---

## 8 · `match_appearance` — correctly inert

`0002_phase1_core.sql:536–543`. Same absolute silence as `growth_note`: nothing reads it,
nothing writes it, no test, zero rows.

**This one is a correct deferral and I want it recorded as such.** D-66 is named in the runway
as step 7 — *"Next sprint (assessments + verified-club search + **minutes capture**, D-66)"* —
and doc 09 §⑤ lists it among the *"anticipated, on empty tables — free to change, specified
for clarity not urgency"* set. `minutes` is deliberately absent from `STAT_KEYS`
(`lib/football.ts:36–38` carries the note: *"(since 27 Aug) minutes — it returns as a DERIVED
number with D-66"*). The catalogue honesty limit is being respected. Nothing to do.

---

## 9 · The assessment tables — the deferral the brief ordered, executed exactly

`competency` (`0002:494–504`), `assessment_block` (`:506`), `assessment_session` (`:512`),
`assessment_entry` (`:519–534`). All four empty in the dev database. `assessment_entry`
appears in the codebase exactly once outside its migration —
`scripts/validate-migrations.mjs:92`.

**Everything the brief asked for is there and nothing it forbade is:**

- Bands, never numbers: `check (band in ('introduced','developing','consolidating','owns_it'))`
  (D-60). ✔
- Competency referenced by `competency_id` against a row unique on `(code,
  framework_version)`, never by name or slug (D-71, doc 14 D12). ✔
- `supersedes_entry_id` present; **no** unique constraint on `(record_id, competency_id,
  block_id)`, with a comment saying the absence is deliberate and not to add it (D-71, doc 14
  D13). ✔
- `entry_type` carries `moderation` and `td_sample` for the later TD pass. ✔
- `context_marker jsonb` for relative age in band (D-61/D-84). ✔
- `position_scope`, `band_descriptors` JSONB, `owner_club_id` nullable for the spine (D-60). ✔
- `session.mode` `player_major | competency_major` so the flow is learned empirically. ✔
- The write-permission functions built and doc 14 §D green. **No assessment screens.** ✔

The brief said *"that distinction is worth about a week, so do not guess it."* It was not
guessed. **This is the right answer and there is no gap here.** The only thing I would add is
that the deferral should be stated on the same list as the gaps, because reading the schema
cold makes all of these look identical to `growth_note`, and they are not.

---

## Two things that are not gaps, recorded so the next seat does not re-open them

**`experience_entry` ships end to end.** It was cut-line item 0 — *"the `experience_entry` UI
(schema stays regardless)"* — and it was not cut. Written by
`app/build/[recordId]/more/actions.ts:55`, deleted at `:66`, read on the CV by
`lib/record-read.ts:74–76` and `lib/cv-build.ts:146–148`, rendered under two headings
(`PlayerCV.tsx:225` Football history, `:255` Other football). D-72's mandatory test is present
and passing (`scripts/permission-tests.mjs:339–348`), including the static assertion that the
permission engine's source never mentions the table. `0028_football_history.sql` widened
`kind` to carry `previous_club` with the reasoning written down. Nothing to do.

**`surfaced_stats` ships** — see §6. The gap is `STAT_SETS`, not the control.

---

## What I did not check

- I did not render any screen. Everything above is source, schema and row counts. A seat with
  the browser should confirm §5's share-card hole and §6's GK default visually — both are
  one screenshot each, and §6 will look correct if it is checked against the seeded Nate
  rather than a newly created keeper.
- I did not read the whole of `docs/06-Register.html`; I took D-numbers from `CLAUDE.md` and
  doc 09. If any of D-62, D-66, D-78, D-84 or D-105 moved after 28 Aug, §5–§8 should be
  re-read against the register.
- `app/globals.css` and the legal page renderer were out of bounds and I did not open them.
  Nothing above depends on either.
- I did not check the club-demo database on 54323.

## Risks in what I am claiming

- My "nothing writes this" claims are grep-based across `app/`, `lib/`, `components/` and
  `scripts/`. A write performed through a string built at runtime would not show up. I saw no
  dynamic SQL construction anywhere, and the codebase uses parameterised literals throughout,
  so I think the risk is low — but §2's five events and §3's function are the ones worth a
  second pair of eyes, because they are the two findings a builder would act on first.
- §5's provenance claim rests on the composition of one `ImageResponse` tree. I read it in
  full; I did not render it.

## Lesson for the next seat

**Grep the seed before you trust a screen.** Three of the nine findings here are only
invisible because `scripts/dev-db.mts` or `lib/fixtures.ts` hand-writes the value the product
would get wrong — a `guardian_landed` consent row no code path creates, and a goalkeeper's
`surfaced_stats` no code path would choose. A fixture that encodes the correct answer instead
of exercising the code that produces it turns the house fixtures from a bug-finder into a
bug-hider. When a screen looks right, check whether the code or the seed made it right.
