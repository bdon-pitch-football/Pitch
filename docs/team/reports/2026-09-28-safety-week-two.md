# safety review: a week of merges read adversarially (28 Sept 2026)

Asked: read `4fb65aa..HEAD` (0057, 0058, 0059, release hardening, `lib/safe-path.ts`,
D-160) against pillar zero, doc 14, the register and the security posture, plus the
two in-flight builders' work on the legal renderer. Answer Leo's four questions.
Read-only on product code.

Measured on: worktree `repo` (branch `app`), commit `62caad5`. `npm run -s test:perms`
— **1102 passed, 0 failed**. `df -h /`: **16Gi avail (52%) before, 7.2Gi (71%) after**;
I ran only `test:perms`, so ~9Gi went somewhere else on the machine during the window.

**Blockers: 1.** Must-fix: 6. Notes: 9.

---

## Blocker

### X1 · The Technical Director wall is address-only, and the console cannot show you when it went to the wrong human

`supabase/migrations/0058_td_on_the_call.sql:74-86` (`fn_td_on_call`),
`:152-181` (`fn_attach_recorded_td`), `:90-114` (`fn_club_td`),
`app/ops/call/[clubId]/page.tsx:41-68`, `app/ops/verification/page.tsx:62-66`.

0058 says, in its own words, that a `technical_director` membership is writable only
for "the person the verification call recorded". It is not. `td_name` is recorded and
**never compared to anything**. The whole wall is `lower(trim(vc.td_email)) =
lower(trim(p.email))`, and `person.email` is unique (`0002_phase1_core.sql:43`), so the
role attaches to whichever single Pitch account holds that address.

**The scenario.** Balmoral's secretary is on the verification call. Asked for the TD's
address she gives `coach@balmoralfc.example` — a role mailbox, which is what community
clubs give, and which is the same shape as the address the claim code goes to
(`app/claim/[slug]/actions.ts:70` sends it to `club.contact_email`). The operator types
"Jane Doe" and verifies the club. The account that actually holds `coach@...` on Pitch
belongs to the club treasurer, who claimed the page in August and is a `club_admin`.
She has proved that address. `fn_proof_attaches_td` or
`fn_club_verified_attaches_td` fires, `fn_attach_recorded_td` finds her by email,
she is 18+, and the trigger writes her a live `technical_director` membership.
`fn_read_level` (`0003_permissions.sql:117-122`) then returns `'full'` for her on
**every child at the club** — positions, stats, clips, coach notes, the record id, the
CV route.

That is doc 14 **H11** ("`club_admin_own` attempts any development-record read, by any
path — Denied"), **J13** ("`club_admin` cannot, by any path") and **A12b**, and it is
the sentence D-93 was written to produce: *"A treasurer made an admin to send invoices
must never be able to read a child's development notes."*

**And nothing on any screen shows it.** `fn_club_td` returns `vc.td_name` — the name the
operator typed — not the matched account's own name. So `/ops/verification` and the call
sheet both read "Technical Director **Jane Doe** · active", while the membership belongs
to the treasurer. There is no screen in the product that names the person who actually
holds the role.

**Smallest fix (two changes, no product decision in either):**
1. `fn_club_td` also returns the resolved account's own name and address
   (`p.first_name || ' ' || coalesce(p.last_name,'')`), and both ops screens render it
   beside the recorded name, so a mismatch is visible at the moment it happens.
2. `fn_attach_recorded_td` refuses when `lower(trim(vc.td_email)) =
   lower(trim(c.contact_email))` — a club's own published address is a mailbox, not a
   person, and 0058's whole premise is that the role attaches to a person.

Then take the residue to BUZ: a recorded name that resolves to an account with a
different name is a hold, not an attachment. Handover is already a named fast-follow;
this belongs with it.

**Caveat I owe you:** this is reasoned from the SQL and the schema, not executed. I did
not write fixtures into the shared dev database. It should be run before it is believed
*or* dismissed.

---

## Must-fix

### X2 · The TD needs no WWCC attestation anywhere, while the lesser role does

`supabase/migrations/0003_permissions.sql:117-122` (the A12 branch) against `:126-130`
(the A7 coach branch, which calls `fn_is_verified_adult`).

The coach branch requires `fn_is_verified_adult`. The TD branch does not. Doc 14 **N18**
requires "a live WWCC attestation" for the *lesser* grant — a coach reading the register
for up to three squads. Pillar zero 19 (D-98) says the permission engine keys off a
club-attested WWCC state. CLAUDE.md: "WWCC verification is free, mandatory and never a
paid feature — pillar zero."

Before 0058 this was latent, because TDs arrived by self-declaration and seeds. 0058
makes the verification call the **only** route to a TD, and that call asks nothing about
a WWCC — doc 27's sheet has no such field and the new fields are name and email. So the
one role with club-wide read of every child's development record at a club is now
granted through a path with no WWCC question in it.

**The suite cannot see this.** Both new fixtures hand the TD an attestation
(`scripts/permission-tests.mjs:3933`, `:4110`, both self-attested, `attested_by = $1`),
so adding the gate would not move a single check and removing it did not either. That is
the L19 shape: a check that cannot fail.

Doc 14 A12 as literally worded gives `td_own` full access without naming a WWCC, so per
TRAINING §3.8 I am not deciding it — but the asymmetry is the wrong way round and it
needs BUZ's ruling before the gate is called green. **Smallest fix if he says yes:**
`and fn_is_verified_adult(p_viewer)` on the A12 branch, plus a WWCC-attested field on
the call sheet, plus a check whose fixture does *not* pre-attest the TD.

### X3 · The claim refusal tells a verified club that something happened to a child it may no longer see

`app/club/squads/[squadId]/actions.ts:106` (`redirect(?error=1)`),
`app/club/squads/[squadId]/page.tsx:161` (the banner).

0059's own comment says the point of one predicate is that "nothing on the screen ever
reports that something happened to it". The `?error=1` branch does.

**The scenario.** A TD has the squad page open. It lists "Wren says they play here".
Wren's mother revokes the guardianship (or her 17-year-old's parent turns the send
switch off, or she turns 18, or the club is suspended between render and press). The TD
presses **Yes, they play here**. `fn_can_answer_claim` is now false, the row is not
found, the transaction rolls back, and the club is shown:

> That didn't go through. They may already be in this squad.

A claim that still stands answers `?done=confirmed`. So the two are distinguishable, and
the club is told both that Wren's state changed *and* a false reason for it — which reads
as "Wren joined another squad". Doc 14 **M6** and **D-138** say the club must not be able
to learn that. LESSONS **L12**: a stranger's no-op must look like success.

There is a real tension here, and I am naming it rather than resolving it: the same
file's comment at `:63-66` records a previous review's rule, "Nothing is reported as done
unless it was done (N3)". Both rules cannot hold on one branch.

**Smallest fix, and it satisfies both:** when `fn_can_answer_claim` refuses, redirect to
the bare `/club/squads/${squadId}` with no flag at all. Nothing is reported as done, and
nothing is reported as having happened; the claim is simply no longer on the list. Keep
`?error=1` for nothing, because there is no failure on this path a club can act on.

### X4 · The legal renderer unbinds the consent stamp from the text a guardian actually read

`lib/legal-stamp.ts:27-31` against new `lib/legal-doc.ts:142-153`
(worktree `.claude/worktrees/builder-legal-preamble`).

`legalStamp` hashes the bytes of `docs/legal/<file>`. Its own header says the hash is
"bound to the bytes actually served ... what lets a consent row resolve, years later, to
the exact text that person read." After this change the served markdown is not those
bytes. I ran `legalDocument()` over the five rendered documents:

| doc | version | words in source | words served | removed | line added |
|---|---|---|---|---|---|
| 20 Privacy (adult) | v2.7 | 6379 | 5063 | **1316** | `*Version 2.7 · 15 September 2026*` |
| 21 Privacy (child) | v2.5 | 3065 | 2337 | **728** | `*Version 2.5 · 15 September 2026*` |
| 22 Terms | v1.8 | 9216 | 7700 | **1516** | `*Version 1.8 · 7 September 2026*` |
| 24 Code of Conduct | v1.3 | 2042 | 1628 | 414 | `*Version 1.3 · 3 September 2026*` |
| 25 Complaints | v1.3 | 3029 | 2540 | 489 | `*Version 1.3 · 7 September 2026*` |

**The scenario.** A guardian approves at `app/a/[id]/page.tsx:93`, which renders doc 21
inside the flow. Her consent row is stamped `21@v2.5+sha256:<hash>`. Two years later we
resolve that hash to prove what she agreed to, and it produces a document containing 728
words she never saw — including "**NOT YET PUBLISHED**", "this restores work that was
lost, and the loss was my doing", and a paragraph explaining that a promise of
independent appeal had been live and was wrong. The hash no longer answers the question
it exists to answer.

**Smallest fix, one line:** `legalStamp` hashes
`legalDocument(LEGAL_FILES[doc]).markdown` rather than the raw bytes, and the handoff
says the stamp value changed for 20, 21 and 22.

### X5 · Doc 20 will serve two different versions, three lines apart, on the live privacy policy

Measured head of `/privacy` after the change:

```
# PITCH — Privacy Policy
*Version 2.7 · 15 September 2026*
**In one paragraph.** Pitch keeps a record of a footballer's development. ...
**Last updated:** 3 September 2026 · **Version:** 2.4 · **Applies to:** everything at www.pitchfootball.com.au
```

Two versions, two dates, on the published privacy policy. That is exactly the failure
`docs/legal/00-Legal-Register.md` records as the 7 September incident — *"The live file
also disagreed with itself — header v1.4, footer v1.3, body stamp `[1.0]`"* — and the
register exists to stop it recurring. The in-body line also names
`www.pitchfootball.com.au` against the canonical `pitchfootball.com.au` (the D-150
sweep).

The stale body line is not this change's fault. Putting a second, authoritative-looking
version line three lines above it is. **Smallest fix:** either correct the in-body line
in `docs/legal/20-Privacy-Policy-Adult.md` (which by immutability rule 1 is a new
version and therefore BUZ's and John's call, not the build's), or have the renderer not
add a version line to a document whose body already states one. Do not merge with both
on the page.

### X6 · Doc 21's rendered version line is sourced from the line that says it is a draft

`lib/legal-doc.ts:125-132` (`publishedDate`).

For doc 21 the only date for v2.5 in the file comes from the preamble being stripped:
`**Doc 21 · v2.5 draft · 15 September 2026 · NOT YET PUBLISHED.**` and
`**⚠️ v2.5, 15 September 2026 — D-153.**`. So the child privacy policy — the one shown
inside the guardian approval flow at the moment a parent decides — will assert
`Version 2.5 · 15 September 2026` with the words "draft" and "NOT YET PUBLISHED"
removed by the same commit that sourced the date from them.

Consent already stamps `21@v2.5`, so the honest resolution is publishing it, not
hiding the draft marker. **This is John's and BUZ's, not the build's.** Do not ship a
version line on a document whose only date lives on a "NOT YET PUBLISHED" line.

### X7 · The highest-privilege grant in the product writes nothing to the append-only log

`supabase/migrations/0058_td_on_the_call.sql:177-179`, against
`0052_squads_players.sql:32-44` (the consent-event vocabulary) and
`0037_register_named_persons.sql:46-49`.

`fn_attach_recorded_td` inserts the membership from inside a trigger. There is no word
for a role grant in the consent-event vocabulary, `membership` has no `granted_by`, and
the grant can fire weeks after the call on an unrelated event
(`person_proof_attaches_td`, `:231-235` — whenever that address is proved, by a confirm
link, a reset, or a guardian approval).

The *lesser* grant has all of it: `register_grant` carries `granted_by`, `granted_at`,
`revoked_at`, `revoked_by`.

**The scenario.** In March a club asks who was given access to its players' records, and
when. The answer has to be reconstructed from `verification_call.called_at` and
`membership.started_at`, and nothing states it as an event. D-94 §10: *"we do need to be
able to answer 'what was accessed, by whom, when' from the audit log — design for that
question now, because it is asked at the worst possible moment."*

**Smallest fix:** a new word in the consent-event vocabulary by migration (L5: new kinds
of event get their own word, never a borrowed one), written by `fn_attach_recorded_td`
with the club, the call id and the resolved person.

---

## Notes

### N1 · Leo's question 1 — yes, exactly one borrowed gate, and it fails loudly

`0059_squad_claims_read.sql:81` and `:113` get D-126 and M10 **only** through
`fn_can_work_squads`. Neither `fn_squad_claims` nor `fn_can_answer_claim` carries a
`club_state` predicate of its own; 0059's comment says so outright ("Since 0057 that is
one question"). Every other read on that page carries its own:
`fn_squad_roster` at `0054:287`, `fn_can_read_squad_player` at `0054:241`,
`fn_can_read_registration` at `0049:67`, `squad_request_rules` at `0054:205`,
`fn_join_squad` at `0054:367`.

So 0059's safety at a suspended club is entirely on loan from 0057. The combination you
asked about is real: revert 0057 — or make the split 0057's own comment says it declined
("may this person act for this club at all") — and the claims list and the answer path
silently reopen at a suspended club while every neighbour on the page stays shut.

**It would not be silent in the suite.** `SQ24i` (`permission-tests.mjs:4184`) calls
`fn_squad_claims` and `fn_can_answer_claim` against a suspended club, and M10e–M10n
measure the gate behaviourally. Nothing pins it *structurally* — `M10i` (`:4017-4020`)
asserts only that the two function bodies mention `fn_can_work_squads`, and no check
anywhere asserts that `fn_can_work_squads` mentions `fn_club_minor_facing`
(`grep fn_club_minor_facing scripts/permission-tests.mjs` → two hits, both 0022's own
unit test at `:1539`, `:1542`). So the answer is: one combination, and it goes red rather
than quiet. I would still put the predicate in 0059 in its own words, because "asked once,
somewhere else" is how 0057 happened.

### N2 · Two M10 rows now measure a query that is no longer in the product

`scripts/permission-tests.mjs:3951-3955`. The `waitingOnYou()` helper is labelled *"The
page's own 'Waiting on you' query (app/club/squads/[squadId]/page.tsx)"* and is a
verbatim copy of the inline query 0059 deleted. `M10f` and `M10m` assert against it. The
rule is covered elsewhere (SQ24i), so there is no hole — but L4 says a test label is a
claim, and L32 says a suite that reads a moved fixture is reading a fixture. Two rows in
the M10 block now say they measure the page and do not. **Smallest fix:** point
`waitingOnYou` at `fn_squad_claims` and reword the comment.

### N3 · Leo's question 2 — nothing legitimate broke, and here is what did change instead

I traced every caller. `fn_can_work_squads` has exactly two in app code
(`app/club/squads/[squadId]/page.tsx:55`, `.../actions.ts:29`) and four in SQL
(`0053:54`, `0054:181`, `0054:293`, `0059:81`+`:113`). Everything a suspended club
legitimately keeps reads `membership` directly and never touches it:

- `/club/billing` — `app/club/billing/page.tsx:25-33`. Works. The `past_due` panel at
  `:51-58` still renders, so a club can reach the portal and fix a card.
- `/club/squads` (the list) — `app/club/squads/page.tsx:32-38`. Works.
- `/club/roles`, `/club/post-trial`, `/club/page-edit`, `/home` — all membership-read.
- And **D-135 never reaches this gate at all**: payment failure sets
  `subscription_status` (`app/api/stripe/webhook/route.ts:60`), never `club_state`. Only
  an operator's call outcome of `suspended` or `takedown` sets `club_state='suspended'`
  (`app/ops/call/[clubId]/actions.ts:62-63`). So 0057's predicate is not on the dunning
  path.

**What nobody has named:** nothing in the product tells a club it is suspended.
`grep -rn suspended app components lib` finds no club-facing surface — only ops screens
and code comments. So a suspended club's TD clicking into a squad the list said had
eleven players gets a page that reads as an empty squad:

> Nobody yet. Families ask to join from their own page, and you can ask anyone on your
> register below. *(`page.tsx:191`)*

and, below it, the ask block still renders — it is gated on `fn_can_work_register`,
which has no verification predicate (`0037:64-70`) — saying:

> Nobody on your register is waiting for this squad. *(`page.tsx:343`)*

Both statements are false, and the squads list one click earlier counts the memberships
with no verification gate at all (`app/club/squads/page.tsx:50-52`), so the two screens
contradict each other. Out of my lane to fix and it is a product and copy decision, but a
club that cannot tell suspension from an empty squad will phone — and a club that
"fixes" it by removing and re-adding children writes `squad_left` rows into families'
timelines.

### N4 · Leo's question 3 — yes, and A17 arrives by a different door

`fn_can_answer_claim` (`0059:67-101`) asks: the club gate (`:81`), `fn_person_hidden`
(`:84`), `fn_can_act_on_squad` on the asker (`:90`), and already-in-this-squad (`:95-99`).
Both the list (`page.tsx:82`) and `answerClaim` (`actions.ts:79`) call it, in the same
words. `SQ24l` pins that the page no longer reads `squad_claim` itself.

**A17 is covered, but indirectly.** `fn_squad_roster` asks it directly, through
`fn_can_read_squad_player` (`0054:250-253`: u16 and no approved guardian → false).
`fn_can_answer_claim` never asks about the child's approval state; it asks about the
*asker's* standing, and for a u16 the only way to satisfy `fn_can_act_on_squad` is
`fn_can_leave_squad`'s approved-guardian branch (`0054:72-74`). Same answer today,
different question. If a claim ever becomes writable by anyone other than the player or
a guardian, the claims path has no A17 check of its own left. **Smallest hardening:** the
two-line u16 / `fn_has_approved_guardian` test, in `fn_can_answer_claim`'s own words.

The surname decision (first name only, both seats, `0059:44-61`) is right and is the
restrictive side, and it is written down where a reader will find it. `fn_register_active`
is correctly absent — D-158 puts squad lists and confirmation on the free side.

### N5 · Leo's question 4 — the narrow answer is "not material"; two things attached to it are

On the question as asked: **removing the drafting preamble is not a material change to
the agreement and I would not re-ask a guardian for it alone.** The preambles are version
history, apologies, `[LEGAL: ...]` markers and "NOT YET PUBLISHED" notes; the source
markdown is untouched; every clause, heading and sentence of every document is preserved
byte-for-byte (I ran it and diffed the heads). L16 already flagged that these pages serve
internal drafting notes, and serving a parent "this restores work that was lost, and the
loss was my doing" at the moment she decides whether to trust us with her child is worse
than any reading of materiality. The builder's instinct is right.

**But three things need saying before it merges, and two are loud:**

1. **X4** — the consent hash no longer describes the served text. That *is* material, and
   it is the one thing here that could not be repaired retrospectively.
2. **X5** — two versions on one published page. Not material to the agreement; fatal to
   the register's whole reason for existing.
3. **The determination is not the build's to make.** The register's version-stamping
   rules are explicit on both counts: *"Whether a change is material is **John's call**,
   and the register records it"* (rule 3), and *"`repo/lib/consent.ts` holds it, and it is
   bumped in the same commit that changes what `/privacy` serves — **never separately, in
   either direction**"*. This commit changes what `/privacy` serves. `lib/legal-doc.ts:7-10`
   makes the materiality call in a code comment. Whatever the right answer, it goes to
   John, is recorded in the register, and either bumps the version or records why it
   does not.

Two smaller observations on the same work, both fine: the register-table parse
(`renderedVersions`, `:39-54`) throws on two versions for one document, which is the
7 September defect turned into a check — good. And `renderedLegalDocs()` returns only
20/21/22/24/25, while `LEGAL_FILES` is 20/21/22, so `legalStamp` cannot be called for a
document the register does not list as rendered; doc 23 throws rather than guessing,
which is the right direction.

### N6 · D-160 holds against doc 14, and cannot be built from today's schema

**The decision is right and is stricter than D-62 requires.** Naming the club and not the
coach is correct on the reason given: the page is served to an unauthenticated stranger
holding a link (D-80), the club is already on that page via `fn_cv_club` (`0054:413-435`),
and a named adult plus their squad of children on a link-shared page is a disclosure for
presentational gain. Nothing in doc 14 contradicts it: J10 is satisfied, A2/A3 unaffected,
and E9 (`permission-tests.mjs:2080-2082`) already pins that the OG card carries no club,
age group or region — so the drill must never reach the card, and that is already
enforced. The inside-the-club carve-out is D-93's, unchanged.

**What will bite whoever builds it.** `player_stat` (`0002_phase1_core.sql:211-219`) has
`record_id, season, stat_key, value, source_experience_id, provenance` — and **no
`created_at`, no author, and no club**. So *neither* level-two string is derivable:

- "Self-reported · entered 14 Mar 2026" — there is no entry date on the row.
- "Verified by Riverside FC · 2 Sep 2026" — there is no verifying club and no date.

The tempting shortcut is to take the club from `fn_cv_club`, i.e. the child's *current*
membership. That would publish a **false attestation** — a stat verified at Riverside
would read "Verified by Kingsway Rovers" the week after she signs — and it would change
retroactively on a public page every time a child moves clubs, which is the opposite of
what provenance is for. The other shortcut is to join `record_entry.author_id` (the field
A10 uses), which puts the coach one join away from a stranger-readable page.

**Recommendation, structural not a check:** the schema addition stores the verifying
**club id and a date on the stat row** and nothing about the person, so the coach's
identity is not reachable from the public render path at all. Then D-160 is a property,
not a rule somebody has to remember.

Two paperwork items: the register says "doc 14 gains a row" and doc 14 has none
(`grep provenance docs/14-Permission-Tests.md` → D7, D8, J22 only), and the cited
`docs/design/mockups/provenance-drill.html` is **untracked** (`git status`), so the
citation points at a file that is not in the commit — S3/S4 shape.

### N7 · `lib/safe-path.ts` — I tried to break it and could not

Hexdumped the character class at `lib/safe-path.ts:35`: it is `[\x00-\x20\x7f]`, which
covers the tab and the newline WHATWG strips before parsing, every other C0 control,
space and DEL. The shape rule at `:38` catches `//` and `/\`. The parsed-pathname
re-check at `:70-77` catches `/..//evil.example`, `/.//x`, `/%2e%2e//x` and the backslash
spellings, which is the second-resolution path the comment describes and is the one that
matters with JavaScript on. One user, `app/squad/actions.ts:25`; `app/registers/actions.ts:12-20`
keeps a two-item allowlist that is stricter and is correctly commented "do not unify".

One observation, not a defect: `internalPath` returns `raw`, not the normalised path
(`:78`), so a value that passes lands in the `Location` header exactly as typed. That is
deliberate (reject, never repair) and safe today — but it means the guarantee rests on
the character class. Anyone who widens that class in future has removed the belt without
noticing, because the parser check only tests the pathname's first character.

### N8 · `answerClaim` has one branch for "I refused" and "something threw"

`app/club/squads/[squadId]/actions.ts:100-102`. The bare `catch {}` rolls back and lands
in the same `?error=1` as a deliberate refusal. Not a leak — the banner is generic and
nothing is logged, so J16 holds — but a real failure is indistinguishable from a refusal
in the logs as well as on the screen, and it is the same branch X3 asks you to change.
Connection handling is correct: only `client.query` inside the `db.connect()` block, the
`wake()` send is after `client.release()` (`:105`), and the `redirect` calls are outside
the `try` so `NEXT_REDIRECT` is not swallowed. L1 is clean.

### N9 · J3 and J17 are unenforced, and J17 is false today

`SUPABASE_SERVICE_ROLE_KEY` appears in **two** files: `lib/storage.ts:33` and
`lib/waitlist-db.ts:13`. Doc 14 J17 says exactly one file, J3 says exactly one route, and
**K2 names J3 as one of "the two that decay silently"** and requires it in CI on every
commit. `scripts/secret-scan.mjs` only looks for a secret *assigned* in an env file; no
script in `scripts/` counts the files (`grep -rln SUPABASE_SERVICE_ROLE_KEY scripts/` →
`secret-scan.mjs`, `demo.mjs`). So two of the gate's own conditions have no check behind
them.

Pre-existing, and nothing this week made it worse — `lib/storage.ts` got *stricter*
(`storageConfigured()` now refuses in a demo, `:44`, which closes a real hole where
`PITCH_DEMO=1 npm run dev` with real keys would have put a club's crest into the Sydney
bucket). But it is on the launch gate and it is cheap: one static check counting files.

---

## What I did not check

- **Only `test:perms`.** I did not run render, write, layout, corpus, palette,
  secret-scan or `tsc`. No reseed, no write suite, no ports taken.
- **No browser, no network trace.** So J14 and J27 (referrer leakage and the click-to-play
  façades) are unverified this week — doc 14 says both must be measured against a real
  trace and not read off the config — and E10/L40 timing indistinguishability is
  unmeasured.
- **X1 is reasoned, not executed.** I wrote no fixtures into the shared dev database, so
  the shared-mailbox attachment is read off the SQL and the schema. Run it.
- **`scripts/demo-layer.mts` (823 new lines), `scripts/demo-walk.mjs`, the demo-walk
  fixtures, the six new mockups and the four builder/QA reports** I read only at
  diff-shape level, not line by line.
- **`app/globals.css`** — not reviewed at all. The other in-flight builder
  (`builder-ipad-register`) sits at `6f56f70`, a different commit; I read only the legal
  worktree. Somebody should read that one.
- **`0055_row_level_security.sql`** — I confirmed the suite has an `R1` check for L26 and
  did not read the migration line by line, and I did not confirm `verification_call`'s
  RLS state after 0058 added columns to it (no new table, so L26 does not bite).
- **Doc 15 §13's held copy** against the corpus check — the copy seat's lane. The
  mechanism (`HELD_KEYS`, `lib/messaging.ts:63`, `app/api/jobs/daily/route.ts:40-62`) I
  did read and it is sound: the daily job does not write an `age_transition_notice` row
  while held, which is the trap that would have skipped those children forever, and
  `held4` pins it.

## Lesson for LESSONS.md

**A gate borrowed from a neighbouring function is a gate with one owner and two
dependants.** 0059 is safe at a suspended club only because 0057 put the predicate into
`fn_can_work_squads`, and 0059 says so in a comment rather than asking the question
itself. The suite catches a revert behaviourally, which is luck rather than design — the
structural check (`M10i`) only asserts that the two bodies mention the borrowed function,
not that the borrowed function still asks the thing. When a function starts answering a
question it was not named for, every caller that stops asking its own version is a caller
that will be wrong the day somebody splits it.
