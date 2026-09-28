# release: where this product actually is (2026-09-28)

**Asked:** measure the product against its own brief row by row — what ships, what
is missing, what is half-built while looking finished — with evidence rather than
impression, and separate what is ours from what is BUZ's.

**Did:** read-only. No product file, migration, seed or document was changed. The
only file I wrote is this report. I did not touch port 3000 or the dev database on
54322, did not reseed, and did not run the write suite. A demo was already running
on 3030/54323 when I started (pids 19988/19944) — **I did not restart it**, because
`npm run demo` kills whatever holds those ports and another seat or BUZ is in it.
I read it over HTTP instead (`GET /demo` → 200, 45,949 bytes, current build).

Disk, as required: **18Gi free before, 7.6Gi free after** (`df -h /`). I deleted
nothing. See Risks — that number is not mine and it matters.

---

## Ran

| Check | Result |
|---|---|
| `node scripts/gate-coverage.mjs` | doc 14 enumerated rows **261**, pinned **261**, open **0** — and the denominator is wrong; see F1 |
| `node scripts/validate-migrations.mjs` | **59 migrations, ALL GREEN** on an empty database, plus 18 named post-conditions |
| `node scripts/migration-on-data.mjs --base 0050` | clean scenario: **9 new migrations applied**, 0 table rewrites, 1 data change (0058, membership 6→6), **6 of 9 are not re-runnable**; dirty scenario: **0051 FAILS**, 7 pre-flight queries printed |
| `node scripts/secret-scan.mjs` | no secrets found |
| `node scripts/palette-check.mjs` | ALL GREEN, 181 files; 3 raw hex in `app/manifest.ts`, `app/layout.tsx` |
| `python3 scripts/corpus-check.py` | **3 failures, 0 warnings** — all three S2 false positives on another seat's report dated today (`docs/design/reports/2026-09-28-schema-vs-product.md`) |
| `npx tsc --noEmit` | 0 errors |
| `GET http://127.0.0.1:3030/demo` | 200 |
| **Not run, and why** | `test:render`, `test:write`, `test:layout` — no app on 3000 and the dev pool serves one connection (L30), so I could not start one without taking a shared port. `test:perms` — it inserts fixtures, and TRAINING §4 says reseed → perms; I was told not to reseed, so a failure would not have been trustworthy (L7). **Last measured elsewhere: perms 967/967 (2026-09-22, two seats independently).** |

---

## Found

### Part 1 · The launch-scope table, row by row

| Brief row (ships at launch) | State | Where |
|---|---|---|
| Player CV — photo, positions, squad number, club, achievements, stats, other football, highlight links, share link | **Built** | `app/p/[token]/page.tsx`, `components/cv/PlayerCV.tsx`, `lib/record-read.ts`, `app/build/[recordId]/{,photo,clips,more,preview,ready}` |
| … **birth-quarter context marker (D-84)** | **Absent** | nothing in `app/`, `components/`, `lib/`. `development_record.context_marker jsonb` exists (0002:528) and no code writes or reads it. `lib/record-read.ts` returns `dob: ''` — **no CV states an age or a birth year either.** Confirmed, as briefed |
| "Send my CV" to a club (D-99) | **Built, all three bands** | `app/send/[recordId]/`, `app/g/send/[requestId]/`, `lib/send-dispatch.ts`, `lib/send-state.ts`. Entry points: `/home`, `/fc/[slug]`, `/build/[recordId]/ready` |
| The coach's link (D-100) | **Built** | `app/c/[slug]/page.tsx` + `components/cv/CopyLink.tsx`; separate resolver from `/p` (no token, no expiry) |
| Coach CV + PDF export + stable public link | **Built** | `app/coach/edit/`, `app/c/[slug]/`, `app/c/[slug]/print/`; WWCC as a chip from `wwcc_attestation`, never a number |
| Claimed club page — crest, philosophy, pathway, teams incl. girls', trial notices, players-wanted, contact route, **alumni wall** | **Built** | `app/fc/[slug]/page.tsx`, `app/club/page-edit/` (`addAlumni` requires the 18+ tick, caps 12 entries) |
| Public trials index, curated, four filters, stamps, auto-expire | **Built** | `app/trials/page.tsx` — age group · competition gender · **state as "region"** · positions wanted; `added_on` / `last_checked` rendered; expiry in the query |
| Sign-up: role select + DOB age gate + **country step** + ToS/Privacy acceptance + guardian approval | **Partly built.** Role select, DOB gate, ToS tick and the whole guardian spine are built (`app/join/`, `app/a/[id]/`, `lib/guardian-flow.ts`). **The country step (D-63) does not exist** — no `country` field anywhere in `app/`, `lib/`, `components/` | — |
| Report & takedown (D-64) | **Built** | `app/report/`, `app/ops/reports/`; `components/SiteFooter.tsx` puts it on every page **except `/`** (F7) |
| **The bench — overseas waitlist (D-63)** | **Absent** | no route, no component, no reference to "bench", "overseas" or "substitution" anywhere in the product |
| Guardian linked view, consent log, revocation, deletion | **Built, complete** | `app/g/controls/[childId]/page.tsx`: link, pause, sending switch, where the CV has been sent, full `consent_event` timeline, delete-everything; `components/RegisterReaders.tsx` answers "who read my child's registration" |
| §0 · Interest Register, paid | **Built minus the money.** Register, held view, statuses, grants, read log, caps: `app/club/register/`, `app/coach/register/`, `app/register-interest/[recordId]/`, `0047`. Stripe: `lib/billing.ts` + `app/api/stripe/webhook/route.ts` complete in code, **unconfigured, and no receipt is ever sent** (F5) | — |
| §0 · Club verification, never payment | **Built** | `app/ops/verification/`, `app/ops/call/[clubId]/`, `0058`; `validate-migrations` proves `verified` without a logged human call is impossible |
| §0 · Pending version for an under-16 edit (D-119) | **Built** | `app/g/pending/[recordId]/`, `lib/cv-build.ts`, doc 15 §30 sends |
| §0 · **Share cards approved as images (D-101)** | **Built and unreachable** | `app/share-card/[recordId]/`, `app/g/card/[cardId]/` exist and work; **`grep -rn "share-card" app components lib` outside its own folder returns nothing.** No screen links to it (F3) |
| §0 · Invitations, the only club→family route | **Built** | `app/club/invite/[registrationId]/`, `app/g/invite/[invitationId]/`; bare wake in doc 15 §24; body filter in `0036` |
| §0 · Sign-in, password reset, club dashboard, billing | **Built** | `app/signin/`, `app/reset/`, `app/home/` (club seat), `app/club/billing/` |
| Premium surfaces "seeded, not sold" — locked PREMIUM rows on 18+ accounts with an anonymous interest count | **Absent** | `grep -rn "PREMIUM\|Premium arrives" app components` → nothing. `Highlights18.dc.html` and `PitchPro.dc.html` are signed screens with no route |
| **The public front door** | **Absent** | `app/page.tsx` renders `components/coming-soon/ComingSoon.tsx`. Its only links are `/privacy` and `/terms`. **Nothing on `pitchfootball.com.au/` reaches `/join`, `/signin`, `/trials`, `/fc/…` or `/c/…`.** The five signed landing screens (`LandingPlayer`, `LandingParent`, `LandingCoach`, `LandingClub`, `DeskLandingClub`) have no route at all. The brief's build-order step 0 says the waitlist page "flips to the sign-up flow at soft launch" — **the flip is not built** (F2) |

Explicitly-not-at-launch rows were checked too and are correctly absent: no assessment
screens (schema and write functions only), no feed or follow, no export/CSV/download of
more than one registration, no club-page sponsor CTA or ground-status banner, no native app.

### Part 2 · Doc 14 — what the gate actually pins

**F1 · `gate-coverage` says 261/261, and 48 of doc 14's rows are not in the
denominator.** The script counts rows matched by `/^\| ([A-Z]{1,2}\d+[a-z]?) \|/gm`
— markdown **table** rows. **J1–J48 are written as bullets**, so only J49–J61 are
counted. Section J is "the negative suite — tests that must FAIL to pass … these
are the ones that actually leak", and doc 14 §K condition 2 names it explicitly.
Measured: of J1–J48, exactly **two (J1, J23)** carry a `J`-labelled check in the
perms suite. Many are genuinely covered under other labels (`D-94 …` for constant
time, hashed resets, no `dangerouslySetInnerHTML`; `E5`/`E6` for noindex and
referrer; `cpa7` for the sitemap) — but **nothing measures the gap**, so no one
can tell a covered J row from an uncovered one. Two that I could not find covered
anywhere, under any label:

- **J3 / J17 — the service-role key in exactly one file.** It is read in **two**:
  `lib/storage.ts:33` and `lib/waitlist-db.ts:13`. Neither is the tokenised read
  path (`lib/record-read.ts` goes through the Postgres pool), so the *intent* —
  no record-read path holds the key — holds. But doc 14 §K condition 2 says
  "J3 and J11 run in CI on every commit — they are the two that decay silently",
  and **J3 runs nowhere**: `grep -rln SERVICE_ROLE scripts/` returns only
  `secret-scan.mjs` (which looks for literal values in env files) and `demo.mjs`.
  `.env.example` documents the two-file state. Either the row moves in the
  register or the code moves; today the gate is silent. **J11 is fine** — it now
  runs over `app/` and `components/` visible text (perms suite ~4685) and in the
  render suite `m7`, so L24 is closed.
- **Timing.** `grep -inE "timing|hrtime|performance.now|tolerance"` over
  `permission-tests.mjs`, `render-tests.mjs` and `write-tests.mjs` finds **no
  wall-clock measurement anywhere**. Doc 14 §K conditions **3 (E10), 7 (L40) and
  10 (J61)** each say "a test, not a hope", "within a tolerance band", "by diffing
  two captured responses, not by reading the handler". All three are currently met
  by **structural proxies** — "the page branches on one boolean", "the limit does
  not diverge", "the withdrawn row is indistinguishable in the query". Those are
  good checks. They are not the three conditions as written. **Three of the ten
  things "green" means are asserted by proxy.**

**A label is still a claim (L4 recurring).** The `E`-labelled block does not line
up with doc 14 §E. `E5` in the suite tests noindex (doc 14 J26); doc 14 E5 is
"guardian disables the profile". `E6` tests the referrer policy (J14); doc 14 E6
is the 89-day renewal reminder. `E10` tests that the link-state page branches on
one boolean; doc 14 E10 is the timing comparison. `E11` tests that signing out
destroys the session; doc 14 E11 is the link-state page body. Four labels, four
different rows, all counted as pinned. The behaviours themselves are covered
elsewhere (`rm5`/`rm6` for the reminder, `E4` for the body) — the **coverage
number** is what is wrong, not the product.

**Rows pinned by a test over a capability no screen exposes:**

| Doc 14 | Pinned by | The capability |
|---|---|---|
| **B1–B11** (appearing in search) | `fn_searchable` (0003, 0013) | **There is no search surface in the product for anyone.** `grep` for a search input across `app/` and `components/` returns nothing; `fn_searchable` has no caller in `app/` or `lib/`. Verified-club search is December (D-53) |
| **B10, B11** specifically | the delivery-receipt gate | doc 15 §13 is **held** (`HELD_KEYS`, BUZ decision 3, 2026-09-23). B11 defines the sixteenth-birthday transition as that message having delivered, so **no 16–17 is discoverable at all**, and **no screen reads or writes `guardian_setting.discovery_disabled`** — the parent's switch the message promises does not exist. `lib/messages.ts:816` says so in as many words. The restrictive answer, chosen deliberately; but four pinned rows describe a band capability the product does not have |
| **D1–D13** (writing to the record) | write-permission functions | by design — the brief says build the schema and the tests, no assessment screens. Correct, and worth stating so nobody reads §D green as "assessments ship" |
| **Q1–Q10** (share cards) | `share_card_approval` + routes | the flow is built and **no screen links to it** (F3) |
| **O1–O11, J49** (money) | `fn_apply_subscription`, route enumeration | Stripe is unconfigured; **§31/§32 never send** (F5) |
| **N13, N14, I2, U-1** (purges) | `fn_purge_*`, `fn_lapse_*` | the functions are tested; in production they only run if `CRON_SECRET` is set in Vercel and the three crons fire. Never yet run against a real project |

### Part 3 · Doc 15 — what is written, what is built, what sends

Doc 15 declares **41 numbered sections**. `lib/messages.ts` builds **39 keys**.

- **Written in doc 15, no builder in code (5):** **§4** second-guardian
  notification · **§9** waitlist confirmation · **§11** squad invite to an
  under-16 · **§25** and **§26** the invitation to a guardian / to a 16–17.
  §25/§26 land in-app (rendered by `app/g/invite/…`, correct — an in-app object
  is not an outbound message), and §11's outbound is the §24 bare wake, which is
  the safer shape. **§4 and §9 are real holes:** F5 and doc 14 F5 require both
  guardians notified on any guardian action — today only `§36` (a send by the
  other guardian) does it — and **`app/api/waitlist/route.ts` stores the row and
  sends nothing**, so a person who signs up on the live site gets silence, and the
  Spam Act consent record has no confirmation leg.
- **Built and sent from a real path (34).** Verified by call-graph, not by
  reading: guardian approval (`app/ops/support/actions.ts`, `lib/guardian-flow.ts`),
  the nudge, STOP/HELP, the whole send flow, the access request, the card and edit
  approvals, sign-in notice, claim code, resets, deletion, reports, coach
  verification, the switch-off notice.
- **Built, nothing calls them (5), each with a reason the suite already carries**
  (`NOT_YET` in `permission-tests.mjs`): `verificationCodeSms` (§14 — approval
  uses two links, D-156, not codes) · `sendRequestLapsedEmail` (§35) ·
  `clubDeverifiedEmail` (§37) · `paymentTakenEmail` (§31) · `paymentFailedEmail`
  (§32).
- **Held (1):** §13, above.
- **Draft (1):** §10b, sent today from `app/join/actions.ts` while its key is in
  `DRAFT_KEYS` — that is deliberate and `lib/messaging` governs it, but it means a
  message BUZ has not approved is the one a new account receives. Copy seat's call,
  flagged not fixed.

**F5 · The two payment messages will still not send on the day Stripe is
connected.** The suite's reason — "Stripe is not connected yet" — is true and
incomplete. `app/api/stripe/webhook/route.ts` handles
`checkout.session.completed`, `customer.subscription.created/updated`,
`invoice.payment_failed`, `customer.subscription.deleted`, and **calls no message
builder in any branch**. `invoice.payment_succeeded` is not handled at all, so
§31 has no trigger event. D-136 requires "a receipt on every charge, so a confused
treasurer emails us before ringing their bank". Turning the keys on does not
produce one. This is an exception list hiding missing wiring rather than a missing
account.

### Part 4 · Doc 32 — the other half of the gate

**A · the PIA's four (A1–A7).** All seven are **built in source**; none has been
*operated by a person on a real project*, because there is no real project.
A1 guardian pause and A2 suppress-then-1800RESPECT (`suppressed_at`,
`app/ops/reports/actions.ts`), A3 `person.dob_locked`, A4 the hold
(`0048`, `app/ops/support/`, D-155), A5 `/report` with a closed concern list,
A6 `noindex` in `lib/cv-meta.ts` + `X-Robots-Tag` in `next.config.mjs` + sitemap
built from two tables only, A7 the click-to-play façade (`components/cv/ClipCard.tsx`,
`youtube-nocookie`, sandboxed iframe). **A6's own words are "verified on the
deployed site, not in the source" — that cannot be answered today**, and it is
the one whose failure is permanent.

Two source-level notes inside A6:
- `app/sitemap.ts` selects `club_state = 'claimed'`. **A club that becomes
  `verified` drops out of the sitemap.** Not a safety failure — an acquisition one,
  and the opposite of what was intended.
- `X-Robots-Tag` is set for `/p/:token*` only. Everything else relies on
  per-page `robots` metadata. I checked all 64 `page.tsx` files: **57 emit it,
  7 do not** — `/`, `/join`, `/trials`, `/jobs`, `/jobs/[roleId]`, `/c/[slug]`,
  `/fc/[slug]` — and all seven are meant to be indexable. `/p/[token]/print`
  has none in the page but inherits both the header and `cvMetadata`. **Source is
  consistent.** The deployed check stands.

**B · documents and consent.** B1 (`S13`), B2 (`legalStamp`, version + sha256 of
the served bytes — perms `g32-p6/p7`), B3 (doc 21 rendered *inside*
`app/a/[id]/page.tsx` via `LegalBody`), B5 (entity line in the footer **and** on
the homepage), B5a (invitation body filtered at write, `0036`) are **green in
source**. **B4 is green on every page except `/`** (F7). **B6 is red as served:**
`docs/legal/22-Terms-of-Service.md` is rendered verbatim and still contains
`**[DO NOT PUBLISH UNTIL BUILT] 6.5 Suppression.**` at line 161, plus a table at
354–355 naming 6.5 and 2.3 as must-not-publish, plus 2 `[LEGAL]` markers and 3
"placeholder" references; doc 20 carries 2 placeholders; doc 21 carries one
"Nothing here binds until BUZ numbers it". **A builder is stripping the drafting
preamble as I write** — noting, not re-litigating. What that work should not miss:
the markers are *inside the clauses*, not only in the preamble, and A1/A2 now being
built means 6.5 may finally publish — that is a decision for BUZ and John, not a
deletion.

**C · operational.** C4a and **C4b are now closed** — doc 32 v1.4 says "no screen
answers the question for a guardian or for support"; `components/RegisterReaders.tsx`
answers it on `/g/controls/[childId]` and on the player's own `/home`, off
`fn_register_readers` (0047). C4c (two channels, `0045`) and C4d (a 16–17's guardian
is a verified adult, `0048`) are built. **C1, C2, C3 and C5's deployed half cannot
be answered by us** — see Part 5.

**The reconciliation doc 32 exists for:** doc 14 could go green and, measured
today, **doc 32 would still have at least B6 red and A6, C1, C2, C3 unanswerable.**
That is the document being right.

### Part 5 · The things a launch needs that are not features

**BUZ's, not ours. No engineering in any of these:**

| | What | Cost if late |
|---|---|---|
| 1 | **SMS sender registration** with an Australian provider + a long number for STOP/HELP (D-81). Days to weeks of lead time we do not control | **Nothing.** Zero guardian approvals complete: `0045` requires two channels, and one of them is SMS. No child record can exist |
| 2 | **SPF, DKIM, DMARC** on the transactional subdomain, within 48h of the domain landing; warm it with real traffic (D-81). `docs/dns-records-resend.md` has the records | Every message in doc 15 spam-folders. `0078`'s event spine can tell "Gmail filtered us" from "the parent ignored us" **only if the Resend webhook is wired** |
| 3 | **Supabase project in Sydney, Pro, with PITR — and one restore actually performed** (doc 32 C2, doc 14 condition 6) | No project exists today. Region cannot be changed after creation |
| 4 | **Operate the one-action takedown from a phone** (doc 32 C1, doc 14 condition 5) | The one control that lets a company of one meet a statutory removal window |
| 5 | **A standing contact at the AFP and at eSafety** (doc 32 C3) | A first call in a crisis is the wrong first call. Nothing has been done about it |
| 6 | **Verify `noindex` on the deployed site** (doc 32 A6) | A page indexed once is in a cache we do not control |
| 7 | **Sign doc 28** (10 minutes, explicitly not launch-blocking) | — |

**Ours (the environment), and every one of these is a variable nobody has ever
set.** `.env.example` documents every variable the code reads except the
tooling-only set below, no secret carries `NEXT_PUBLIC_`, and `PITCH_DEMO` cannot
survive a production build (`lib/demo.ts` throws). Ranked by what an empty value
does in production:

| Variable | Empty means | Who sets it |
|---|---|---|
| `SMS_MONTHLY_CAP_CENTS` | **no SMS at all** — `lib/sms-policy.ts` returns null and `lib/messaging.ts` refuses every send. Deliberate (D-81, BUZ decision 5). Combined with C4c: **no guardian approval can complete** | BUZ, in Vercel |
| `SESSION_SECRET` | the app refuses to sign a session — nobody can sign in. No fallback in production, by design | BUZ (`openssl rand -base64 48`) |
| `SUPABASE_DB_URL`, `SUPABASE_CA_CERT`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_STORAGE_BUCKET` | no database, no uploads. The CA note in `.env.example` is right: a missing certificate fails the connection, it never silently stops checking | BUZ, from the Sydney project |
| `CRON_SECRET` | all three crons refuse in production → **no purges, no lapses, no reminders, no digest**. D-17's 14-day purge is a promise to a parent | BUZ, in Vercel |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_WEBHOOK_SECRET` | no email; and with no webhook secret the consent spine cannot distinguish a bounce from silence | BUZ |
| `SMS_ACCOUNT_SID`, `SMS_API_KEY`, `SMS_LONG_NUMBER`, `SMS_WEBHOOK_SECRET` | no SMS, and no STOP/HELP — which doc 15 §15 promises in writing | BUZ, after item 1 above |
| `OPS_EMAILS` | **nobody can open `/ops`** — no verification, no reports queue, no kill switches. `lib/ops-guard.ts` is explicit: empty = nobody | BUZ |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL` | `billingConfigured()` is false and the UI says so plainly. **The paid tier does not ship.** D-113 already decided this is the thing that gets cut, not the gate | BUZ |
| `WAITLIST_ENABLED` | the form stays shut — correct while doc 20/22 placeholders remain | BUZ, after B6 |
| `DIGEST_TO` | has a default value committed; the 7am digest goes to one address | set |

**Kill switches (D-94 §10) — two of three are reachable at 11pm.**
`/ops/switches` gives a global pause on public profile serving and revoke-every-live-token,
both logged with a name and a reason, both behind `OPS_EMAILS`. **The SMS spend
cap and kill switch are environment variables only** — flipping `SMS_KILL_SWITCH`
means editing Vercel and redeploying, which is not a tired founder on a phone.
The brief lists all three as switches. This one is not a switch yet.

**One documentation defect, mine:** `.env.example` documents **`DEV_DB_PORT`** and
says "Set the SAME value on both". `lib/db.ts:16` reads `DEV_DB_PORT`;
`scripts/dev-db.mts:674` reads **`PITCH_DEV_DB_PORT`**. A seat following the file
gets a dev database on the shared 54322 while its app looks elsewhere — exactly
the collision L30 was written about. **The suite check cannot catch it:** `db8`
tests `/DEV_DB_PORT \|\| 54322/`, which matches as a substring of
`PITCH_DEV_DB_PORT || 54322`. A check that cannot fail is not a check (L19).
Dev-only, so no launch cost; real cost to whichever seat loses a morning to it.

### Part 6 · Migrations

**Empty database: 59 files, all green, in order.** Against a database that already
has rows (`--base 0050`, so 0051–0059 are "new"):

- **Locks.** 0051 takes `AccessExclusive` on `club`, `alumni_entry` and
  `players_wanted_notice`; 0052 on `consent_event` (and `Share` on the two new
  squad tables); 0054 on `squad_invitation`; 0055 on `app_config`, `coach_invite`,
  `register_grant`, `register_read_log`; 0056 on `person`, `auth_reset`,
  `email_proof`; 0058 on `verification_call`. **`AccessExclusive` on `person` and
  on `club` blocks every read of those tables for the length of the transaction** —
  short on today's data, not necessarily short on a year's.
- **Rewrites: none, in any of the nine.** All added columns are nullable with no
  default, so no table is rewritten. That is the right shape and it was not luck.
- **Data changed:** 0058 only, `membership` (6 rows touched, backfilling the TD).
- **Re-runnable: 3 of 9** (0053, 0055, 0057). Six fail on a second run with
  "already exists" — fine for a forward-only chain, **but it means a half-applied
  deploy cannot be retried by re-running the file**; it has to be finished by hand.
  Worth knowing before the first migration against a live Supabase.
- **The dirty scenario is the useful one: 0051 FAILS on real data** —
  `club_philosophy_len` is violated by an existing row. The script prints the seven
  read-only pre-flight queries to run against the live database first. **Any deploy
  that includes 0051 must run those seven queries and fix or truncate the offending
  rows before the migration, or the deploy rolls back mid-flight.**
- **Two safety notes the script surfaced, both in 0051's alumni guardrail:** an
  alumni entry that predates the migration **stays on the public wall with no "18
  or over" confirmation** (the trigger is `before insert` only), and an
  unconfirmed entry **can still be UPDATED** without re-confirmation. There is no
  product UPDATE path today (`page-edit/actions.ts` has add and remove only), so
  this is defence-in-depth rather than a live hole — and `before insert or update`
  is a one-line migration. Given the rule is "an alumni entry never names a person
  under 18", I would take the one line.
- **RLS:** `0055` is the file L26 produced. Every `create table` after it is
  followed by `enable row level security`, and `validate-migrations` asserts it.

---

## Ranked by what it costs

**Blocks a launch (nothing here is ours to close alone):**

1. **SMS sender registration and the Supabase Sydney project do not exist.** Days
   to weeks of other people's lead time, and every other row waits behind them.
   Without them: no guardian approval completes, no restore can be tested, and
   doc 32 A6, C1 and C2 cannot be answered. **BUZ.**
2. **Doc 32 B6 — the served Terms still say `[DO NOT PUBLISH UNTIL BUILT]`.** A
   published document promising a capability by its own admission. Cheap to fix,
   in flight, and it is a legal surface: **BUZ and John decide whether 6.5
   publishes**, not the builder deleting the marker.
3. **Three of doc 14's ten green conditions (E10, L40, J61) are met by proxy, and
   J3 runs nowhere.** The gate's own §K names timing indistinguishability as a
   test, not a hope. Somebody has to either build the measurement or take it to
   BUZ as a documented proxy. **Leo's call; the work is a builder's.**
4. **No front door.** `pitchfootball.com.au/` is still the coming-soon page and
   links only to Privacy and Terms; `/claim/[slug]` has no link from anywhere in
   the product; `/share-card/[recordId]` has no link from anywhere. A soft launch
   to ten warm families survives this by pasting URLs. A club that hears about us
   and types the domain **cannot find the register we are charging for.** One nav
   block and three links; the copy needs BUZ.

**Costs a family:**

5. **No CV states an age, a birth year, or D-84's birth-quarter marker.** A
   fourteen-year-old and a seventeen-year-old CV are indistinguishable to the TD
   reading them, which is the one fact that makes everything else on the page
   mean something. D-84's whole point is that a January boy and a December boy in
   the same band are not the same player. Confirmed absent; **a product decision
   about what a minor's page may show, so it goes to BUZ, not to a builder.**
6. **Doc 15 §4 never sends.** D-51 and doc 14 F5 say both guardians are notified
   on any guardian action. Today only a send by the other guardian notifies. A
   parent can be surprised by what the other parent did to their child's record.
7. **§9 never sends.** Somebody who signs up on the live site gets silence, and
   the Spam Act consent record has no confirmation leg.
8. **The SMS kill switch is not reachable from a phone.** The night it is needed
   is the night nobody wants to be editing Vercel.

**Costs a club:**

9. **The paid tier cannot take money** (no Stripe keys), and **when it can, no
   receipt is sent** (F5). D-136 promises a receipt on every charge.
10. **A verified club drops out of the sitemap** (`app/sitemap.ts`). The clubs we
    have spoken to on the phone are the ones Google cannot find.
11. **0051 fails against real club data.** Seven pre-flight queries, printed, must
    run before that migration meets a live database.

**Costs nothing yet, worth a line:** no country step (D-63 — accounts are
Australia-only and nothing asks), no bench screen, no PREMIUM locked rows (so the
price-validation tap data the brief asks for does not exist), no
Content-Security-Policy header in `next.config.mjs` at all (the brief's §8 asks
for "a real CSP — no `unsafe-inline` scripts"), and `/privacy` and `/terms` are
`noindex` — which for a company's own policies is probably backwards.

---

## In flight, noted not re-litigated

- **The console breakpoint.** `app/globals.css` in this tree still switches the
  console frame at `min-width: 1024px` (lines 195–206, 413, 463) with
  `.console { max-width: 560px }` below it. The 768 change is not in the main tree
  yet. When it lands, the four constraints that matter are the ones that fork the
  design system: same content and order, **no type-scale change at any
  breakpoint**, no width-only capability, and ≥44px targets. `scripts/layout-check.mjs`
  takes two widths — 768 will need to be one of them, or the new breakpoint is
  unmeasured.
- **The legal preamble.** `app/legal/legal-page.tsx` renders `docs/legal/*.md`
  through `marked` as-is (L16), so whatever the file holds is what a parent reads
  — on `/privacy`, `/terms` **and inside the guardian approval flow** via
  `LegalBody` (doc 32 B3). Two things the stripping work should not miss: the
  `[DO NOT PUBLISH UNTIL BUILT]` markers are inside the clauses, not only in the
  preamble; and any change to those bytes changes the **sha256 in every consent
  stamp** written from that moment (`lib/legal-stamp.ts`), so it is a document
  version bump, not a tidy-up.

---

## Copy for BUZ

**None.** I wrote no user-visible string. Four strings other seats will need your
approval for, and I am naming them rather than drafting them: whatever the
homepage says to get a person into the product; whatever a club sees that leads it
to `/claim`; the sentence a share card offers a family; and doc 15 §4 and §9 if
they are to send.

---

## Risks — what could still be wrong, and what I did not check

- **I did not run perms, render, write or layout.** Perms is the gate and the
  honest reason I did not run it is that it inserts fixtures and I was told not to
  reseed, so I could not have trusted a red (L7). Every count in Part 2 is a
  static read of the suite source, not a run. **"perms 967/967" is a figure from
  2026-09-22, not from me.**
- **Everything in Part 4 section A is a source read.** Doc 32's own instruction is
  "has somebody done it and seen it work". I have not seen any of it happen on a
  real project, because there is no real project. Do not let this report be read as
  those rows being green.
- **I could not verify anything about Vercel, Supabase, Stripe, Resend or Twilio.**
  No dashboard, no API, no key. Every "never been set" above is inferred from
  `.env.example` being empty and from the code's unconfigured branches, not from
  looking at the project.
- **Four other worktrees are live** (`.claude/worktrees/`, 4.0G). Everything I cite
  is from the main tree. Where my call-graph scan first reported "no production
  caller" for the guardian approval messages it was reading worktree copies — I
  re-ran it scoped to the main tree, and `lib/guardian-flow.ts` and
  `app/ops/support/actions.ts` do call them. Any seat doing the same scan should
  exclude `.claude/`.
- **Disk: 18Gi free at the start of this session, 7.6Gi at the end.** I deleted
  nothing and I do not know the whole cause; `.next` is 1.2G, `.next-demo` 434M,
  `.claude/worktrees` 4.0G, and two dev servers were compiling throughout. At
  7.6Gi a `next build` is not comfortable. **Somebody should clean up the finished
  worktrees before the first real deploy** — not me, not today, they are in use.
- **The demo:** I confirmed the running one serves (200, current build) but I did
  **not** start a clean one with `npm run demo -- "Club FC"`, because that kills
  whatever holds 3030 and 54323 and somebody is in it. L14 still applies to
  whoever is in it: **0051–0059 have landed since, so any demo started before them
  has the old schema and must be restarted before anyone opens it.**

---

## Lesson

**L35 · A coverage number is only as honest as its denominator.** `gate-coverage`
reported 261/261 and the gate has 309 enumerated cases — the 48 rows of section J
are bullets, not table rows, so the regex never saw them, and section J is the half
of doc 14 that describes the leaks. The same script's `ids` set is what makes four
mislabelled `E` checks read as four pinned rows. *Rule:* when a check reports
"N of N", read the code that builds N before believing it, and make the script
print what it excluded. A denominator nobody has counted is a coverage number
nobody has.

*Corollary for anyone writing in `docs/`:* `corpus-check.py` S2 fails on the
literal strings "28 Sep", "21 Sep", "9 Sep", "11–15 Sep" and "30 Oct" anywhere in
a live file. This report uses ISO dates for exactly that reason, and the three
failures in the run above are another seat's report tripping the same wire.
