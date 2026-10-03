# build: release hardening — the wire to the database, the SMS cap, and a message we stopped sending (2026-09-23)

Asked: wave two of BUZ's 23 Sep approvals — R3 (TLS and the production pool), R4/decision 5 (the SMS cap is mandatory), decision 3 (hold doc 15 §13 the copy seat's way), the coach lookup onto proved addresses (B1's second half), QA's smaller items, the demo's two locks (N4a/N4c), and a `DEV_DB_PORT` hook.

**Branch and commit: `worktree-agent-a8b16ad66290ff4d0` at `2e55439`**, one commit on top of `app` at `28b083c`, in my own worktree (`repo/.claude/worktrees/agent-a8b16ad66290ff4d0`). Nothing pushed. Nothing on `app` touched.

---

## Did

### 1 · R3 — the database client (`lib/db.ts`, new `lib/db-policy.ts`)

The decision moved out of `lib/db` into a policy module with no framework around it, the same shape as `ops-policy` / `cron-policy` / `reply-policy`, so the suite can run it. It answers one question — **is this the local PGlite socket, or a real database** — and both halves of R3 fall out of it.

- **TLS, verified.** A real database now gets `ssl: { ca, rejectUnauthorized: true }`. It is never `false` and never `rejectUnauthorized: false`; there is no code path to either.
- **The connection string does not get a vote.** Every ssl parameter (`sslmode`, `sslrootcert`, `sslcert`, `sslkey`, `sslnegotiation`, `ssl`) is stripped out of the string before pg sees it. This is not tidiness: **pg merges the parsed connection string OVER the config object** (`node_modules/pg/lib/connection-parameters.js:59`), and `pg-connection-string` reads `sslmode=require` as `rejectUnauthorized: false`. So a URL pasted from a dashboard at 11pm could switch verification off underneath an explicit config, silently. I proved that it does — check `db12` below. A string with nothing to strip is returned byte for byte, because re-serialising a URL rewrites its percent-encoding and the password is in it.
- **The CA.** `SUPABASE_CA_CERT` (the PEM text, on one variable) or `supabase/rehearsal-ca.crt` in the repo, in that order. It is Supabase's **public** certificate, not a secret. With neither, we verify against Node's trust store — still verify-full, so a missing certificate shows up as a connection that **fails**, never as one that stops checking.
- **Pool size: `max: 5`, `idleTimeoutMillis: 10_000`, in production only.** Why five: this is per serverless instance and the ceiling that matters is Supabase's pooler, not ours (five times however many instances Vercel runs). Five is enough for an instance to serve concurrent requests, and enough that a request needing a second query while holding a client — LESSONS L1, which is a deadlock rather than an annoyance once `max` is 1 — finds one instead of waiting on itself. It is a judgement, not a measurement; see Risks. Idle is 10s rather than 0 because a real database charges for an idle connection and a serverless instance is idle most of its life.
- **Development is untouched, deliberately:** loopback keeps `max: 1`, `idleTimeoutMillis: 0`, `allowExitOnIdle: false`, no TLS. The comment explaining why 0 is load-bearing stayed with it.

**How I tested a TLS path with no Supabase project.** `scripts/permission-tests.mjs` now stands up a **fake Postgres** on loopback: it reads the 8-byte SSLRequest, answers `S`, hands the socket to a `tls.Server` holding a certificate signed by a CA generated with `openssl` into a temp directory, and counts what it is given — a completed handshake, or plaintext. Four outcomes, all measured, none asserted from reading code:

| | result |
|---|---|
| the pinned CA | TLS completes, nothing in plaintext (`db9`) |
| no CA | refused, `UNABLE_TO_VERIFY_LEAF_SIGNATURE` (`db10`) |
| a valid certificate for another host | refused, `ERR_TLS_CERT_ALTNAME_INVALID` — verify-**full**, not verify-ca (`db11`) |
| `?sslmode=disable` in the URL under an explicit ssl config | **plaintext** — the demonstration of why the string is stripped (`db12`) |

If `openssl` is missing, the four print `SKIP … the TLS path was NOT measured` rather than passing in silence.

### 2 · R4 / decision 5 — the SMS spend cap is mandatory (`lib/messaging.ts`, new `lib/sms-policy.ts`)

`Number(process.env.SMS_MONTHLY_CAP_CENTS ?? 0)` followed by `if (cap > 0)` read an unset variable as *no cap*, which is the state of every deploy until somebody remembers. `smsCapCents()` returns **null for unset, empty, whitespace, zero, negative or not-a-number** — null is a refusal, never a licence — and `send()` refuses with `reason: 'sms_no_cap'`, the same shape as the kill switch, before the meter is charged and before an outbox row exists.

**One choice I made and am flagging:** the refusal fires where money can actually be spent — `NODE_ENV === 'production'`, which is the only place `dispatch()` is called. In development the outbox *is* the inbox, nothing reaches a provider and there is nothing to cap; making it unconditional would have stopped every guardian SMS in every seat's dev database and demo without protecting a cent. It is the same idiom the draft-message refusal already uses. If Leo or BUZ wants it unconditional, it is a one-line change and every seat then needs the variable set.

`.env.example` says it in words (verbatim below).

### 3 · Decision 3 — doc 15 §13 is held, the copy seat's way (item 47)

- **`lib/messages.ts`**: the words are unchanged. A new `HELD_KEYS` list carries `doc15.§13` with the dated hold note as a comment, and — the part that matters for the next person — **what has to be true before it comes off the list**: the switch exists (a screen reading and writing `guardian_setting.discovery_disabled`), the search it describes exists, the link names the real page, and BUZ has ruled on the default and re-approved the words. `§13` stays in `CATALOGUE_KEYS`.
- **`lib/messaging.ts`**: a held key is refused **everywhere, development included** (`reason: 'held'`), so no future caller can start it again by accident.
- **`app/api/jobs/daily/route.ts`**: the gate is left visible and whole. The block is still there, guarded by `isHeld('doc15.§13')`, with the comment saying what the hold means: while it is held **no notice row is written**, nothing delivers, and `fn_searchable` (0013) keeps every 16–17 out of every search — B11's restrictive half, which is the right answer while no parent is being told. Writing a row with no send would have been the dangerous shortcut: `fn_children_turning_16()` skips a child who already has one, so those children would be skipped forever on the day it sends again. The response now says `birthdayNoticesHeld: true`, so a run that sends nothing is not read as a run that found nobody.
- **`docs/15-Message-Copy.md`**: the dated hold note above §13, the three edits the words need before they can send, and where the hold lives in the code.
- **Nothing claims a 16–17 search.** `components/site-preview/SitePreview.tsx` carried "Verified clubs and coaches can search for players 16 and over…" in the "Next" list. It is held with §13 (copy batch 3, item 45) and a comment says why and what brings it back. `held6` scans every file under `app/` and `components/` for the claim, so a new one fails the suite.

### 4 · The coach lookup, on proved addresses (`app/club/squads/actions.ts`)

One condition added to the lookup in `inviteCoach`: `and fn_email_proved(p.id)` — the database's answer, never the column. Nothing else changed, because nothing else needed to: the action already ends at one `redirect('/club/squads?coachAsked=1')` whatever it finds, so a club typing a real coach's address gets the identical answer whether that address is proved, unproved, or on no account at all (D-154/N24).

`scripts/dev-db.mts` gains the fixture that shape needs: an account carrying a coach's address **and a coach page**, with the link we sent still unopened.

### 5 · QA's smaller items

- **F5, the eighteenth-birthday off-by-one.** Four places worked an age out as `Math.floor((Date.now() - dob) / (365.25 * 24 * 3600 * 1000))`. Over eighteen years the quarter-day rounding lands just short, so on the birthday itself it said seventeen and `/join` refused an adult coach or club person the database would have let through. New `lib/age.ts` gives **the calendar answer the database gives**, in Australia/Melbourne, mirroring `fn_age_band` (0003); `app/join/page.tsx`, `lib/guardian-flow.ts`, `app/a/[id]/page.tsx` and `app/ops/support/actions.ts` all use it (the last three print an age to a parent, and were wrong on the same day). `age1` compares the app's answer with `fn_age_band`'s on seven boundary dates including three birthdays; `age4` fails if any screen or library works an age out for itself again.
- **F4, tap targets.** The chips were already fixed on `app`. "Review the changes" (`app/build/[recordId]/preview/page.tsx`) was a 14px link inside a sentence that wrapped over two lines with a dead gap between them; it is its own 44px row now, same words, same destination.
- **F8, banned words in the address bar.** `?done=declined` → `?done=no`, `?squad=declined` → `?squad=no`, and the copy seat's follow-up for Leo `?applied=1` → `?sent=1`. The banner text keyed off them is unchanged (it is copy batch 1, waiting on BUZ). New check `url1` reads every `redirect(...)` under `app/` for a banned word in a query.
- Already fixed on `app` before I started, so I left them: F1's restrictive half (sqf6 passes), F2, F3, F4's chips, F6 (corpus is clean at this commit), F7 (the sixty-row cap now says so). F9 is product-lane observation.

### 6 · The demo (`scripts/demo.mjs`, `lib/storage.ts`, `lib/demo.ts`, `docs/DEMO.md`)

- `next dev -H 127.0.0.1`: the demo is served to the laptop it runs on and not to the meeting's Wi-Fi (N4c). The take-over matcher still recognises the running demo.
- `storageConfigured()` asks `isDemo()`, like `lib/billing`, `lib/waitlist-db` and `lib/providers` (N4a). The launcher's key-blanking was the only thing keeping a demo upload out of the Sydney bucket, and that is the launcher's care, not a property of the module. A demo writes to `public/dev-uploads` as dev does.
- `lib/demo.ts`'s "three locks" comment and `docs/DEMO.md`'s "How it stays safe" now say both of these.

### 7 · `DEV_DB_PORT` (`scripts/dev-db.mts`, `lib/db.ts`, `.env.example`)

Set the same value on both and a seat has its own dev database and app (L30):

```bash
DEV_DB_PORT=54332 node scripts/dev-db.mts
DEV_DB_PORT=54332 npx next dev -p 3010          # then RENDER_BASE=http://127.0.0.1:3010 for the suites
```

Unset is the shared 54322, so nothing changes for anyone who does not set it. 54323 is refused — a seat's database must never land on the demo's port (L8). `.dev-ids.json` was already per-tree. **This is how every count below was measured**, while another seat's dev database and app held 54322 and 3000 throughout and a demo held 54323/3030 for part of it.

---

## Ran

Everything below is **`2e55439` in `…/worktrees/agent-a8b16ad66290ff4d0`**, on my own dev database (`DEV_DB_PORT=54332`) and app (`127.0.0.1:3010`), in TRAINING §4 order from a fresh seed: reseed → perms → render → write → reseed → layout.

| Suite | Count |
|---|---|
| `npm run test:perms` | **1059 passed, 0 failed** (1022 on `app` at 28b083c + 37 new) |
| `npm run test:render` | **369 passed, 0 failed** |
| `node scripts/write-tests.mjs` | **296 passed, 0 failed** (295 + `c1c`) |
| `node scripts/layout-check.mjs 375 1280` | **184 page views, 0 overflow, 0 unrendered** |
| `node scripts/gate-coverage.mjs` | **261 rows pinned, 0 open** |
| `node scripts/validate-migrations.mjs` | **68 checks, ALL GREEN** (no migration in this package) |
| `node scripts/palette-check.mjs` | ALL GREEN (3 raw-hex infos, unchanged) |
| `python3 scripts/corpus-check.py` | **0 failures, 0 warnings** (QA's F6 is clean at this commit) |
| `node scripts/secret-scan.mjs` | No secrets |
| `npx tsc --noEmit` | 0 errors |
| `SUPABASE_DB_URL=… npm run build:check` | exit 0, 22/22 static, 82 route lines |

**New checks: 37 in the permission suite, 1 in the write suite.**
`db1`–`db12` (the pool shape, the stripping, four real TLS handshakes), `cap1`–`cap6`, `held1`–`held6`, `coach1`–`coach5`, `age1`–`age4`, `url1`, `db5b`, `DEMO4b`, `DEMO4c`. None carries a doc 14 row id, because none of them is a doc 14 row (L4); `coach2` names B1 and `held`/`db`/`cap` name the safety and release report ids they close.

**L20 — every one of them shown failing with the bug put back.** I reverted all twelve changes at once (the pool to one connection with no TLS, the cap back to `?? 0`, the §13 send and the site-preview line back, `fn_email_proved` out of the lookup, the 365.25 formula back, `?squad=declined` back, `lib/storage` and the demo's bind back, `DEV_DB_PORT` back to a literal), ran the suite and restored from byte-for-byte backups. **18 failed**, and the set is exactly the claims: `db2 db3 db5 db8 db9 db11 cap3 cap4 held2 held3 held6 coach1 coach2 age4 url1 DEMO4b DEMO4c` plus `env2` (which caught `DEV_DB_PORT` going stale in `.env.example` — not one of mine, and a good sign). The suite is green again at `2e55439`.

Two of the new checks were **rewritten because the first version could not fail** (L19), and only the reversion run showed it: `url1` read a redirect only as far as its first quote, so it could never see `${yes ? 'joined' : 'declined'}`; `cap4` compared an `indexOf` of −1, which is also "before". Both fail correctly now.

**Walked in a real browser (L10 — `/join` is a client page, so a script posting its action proves nothing about the form):** headless Chrome on `/join`, both doors, three dates each.

| Date of birth | Coach door | Club door |
|---|---|---|
| eighteenth birthday today (2008-09-23) | Continue **enabled** | Continue **enabled** |
| turns 18 tomorrow | disabled, amber notice | disabled |
| seventeen | disabled, amber notice | disabled |

Before this change the first row was disabled — QA's F5. Also ran the daily job on the live dev app: `{"birthdayNotices":0,"birthdayNoticesHeld":true,…}`.

---

## Found

In my lane, fixed: everything in Did. Outside it, or outside this package — reported, not touched:

1. **The laptop's disk was down to 876 MB free** (926 GB volume, 96% used) and every `next dev` and build needs more than that; a build failed with ENOSPC mid-task. I deleted two regenerable build caches in the **main checkout** — `.next-check` and `.next-demo` — to get room, which cost nothing but the next demo's first page build. `repo/.next` is 1.6 GB and belongs to the dev server another seat is running. `~/Library/Caches` is 5.1 GB, 3.3 GB of it Chrome's; that is BUZ's to clear, not mine. **This will stop someone's run today.**
2. **A worktree cannot use a symlinked `node_modules`.** Next refuses it ("points out of the filesystem root"), so I copied the main checkout's 374 MB into my tree. Three builder worktrees is another gigabyte. Worth a line in TRAINING if builders are going to keep their own trees.
3. **`scripts/apply-migrations.mjs` strips `sslmode` from the URL but not `sslrootcert`, `sslcert`, `sslkey` or `sslnegotiation`.** Any one of them makes `pg-connection-string` build its own `ssl` object, which then overrides the explicit `{ ca, rejectUnauthorized: true }` — the same trap `lib/db-policy` now closes for the app. One line for the release seat: `for (const p of ['sslmode','sslrootcert','sslcert','sslkey','sslnegotiation']) url.searchParams.delete(p);`
4. **The same script's dev-database refusal only knows 54322 and 54323.** With `DEV_DB_PORT` a seat's database can be on any port, and migrations could be applied to it by hand. It should refuse any loopback host unless `--i-mean-the-dev-db`.
5. **`app/club/squads/[squadId]/page.tsx:139` still says "Asked. It's waiting in their account — we told them nothing by email."** QA measured `doc15.§24.email` leaving the outbox at that moment. It is copy batch 1's item and waiting on BUZ, so I left the words alone — but it is an untruth on a live screen and it is about a child's club.
6. **The jobs board still says "apply", "applied" and "Applying" on screen** (copy batch 1, items 33–39, waiting on BUZ). I changed only the address bar; the visible words are BUZ's to approve.
7. **N4b is still open:** `scripts/demo.mjs` does not blank `NEXT_PUBLIC_SITE_URL` (a demo's card approval reaches the production site or the dev app) or `DIGEST_TO`, and `app/api/digest/route.ts` still does not ask `isDemo()`. Small, and outside this package.
8. **`.env.example` still does not say `SMS_API_KEY` must be the Twilio Auth Token** (release R2's finding). `lib/providers.ts:77` signs in as `AccountSID:SMS_API_KEY`, so an `SK…` API key 401s on every send. One comment line, and it is the sort of thing that is discovered at 11pm on keys day.
9. **Something killed my dev database twice mid-task** (exit 143, once after the render/write runs and once between suites), while the shared 54322 survived. I could not attribute it. If a seat is running `pkill -f dev-db.mts`, that is L8 and it now reaches other people's trees as well as the demo.
10. **A decision this package does not make:** if `SUPABASE_CA_CERT` is not set in Vercel, the app verifies against Node's trust store and will almost certainly **fail to connect** to Supabase rather than connect insecurely. That is the right failure, and it means keys day has a new required variable. The release runbook's step 5 already has BUZ downloading the certificate; it now also needs pasting into Vercel.

---

## Copy for BUZ

Four things, all verbatim. Nothing else user-visible changed.

**1 · Doc 15 §13 gains this note, above its unchanged words** (`docs/15-Message-Copy.md`). This is the copy seat's proposal from batch 1 item 47, with the second and third paragraphs folded in:

> **HELD 23 Sep 2026 (BUZ) — this message does not send.** The switch it offers does not exist: no screen in the product reads or writes `guardian_setting.discovery_disabled`. The words below stay here because doc 14 §B11 defines the sixteen-year-old transition by this message having been delivered — deleting them deletes the gate. They are the approved copy for the day the switch is built, and they are not to be edited to fit its absence.
>
> While it is held, no parent is told about the change at sixteen — so **discovery stays off at sixteen** (the more restrictive answer), and no screen anywhere may say clubs can search for players who are sixteen or seventeen. Three edits the words need before they can ever send: "Leave it on, or turn it off: pitchfootball.com.au" must name the real page it links to; "him/his" becomes "them/their", because the product holds no gender for a child (D-25) and cannot write the version below; and "Verified clubs and coaches will be able to find him in a search" has to be re-read against whatever search actually exists then (D-53). In the code: `HELD_KEYS` in `lib/messages.ts`, which `lib/messaging.ts` refuses and `app/api/jobs/daily` checks before it looks for anyone to send to.

The consequence, stated plainly: **no guardian receives the turning-16 email from now on**, and no 16- or 17-year-old becomes discoverable, because the database gates that on this message having been delivered.

**2 · One line removed from the site preview** (`/preview/site`, the "Next · Coming soon" list). Removed, not reworded:

> **Clubs find players** — Verified clubs and coaches can search for players 16 and over. Under 18 only with a parent's okay, and never under 16.

(This is batch 3's item 45, first half. The second half — "Coach-verified development — Coaches record what they see in plain language, and it's marked as verified." — I left alone: it is held for a different reason and is the copy seat's to reword.)

**3 · Three things the address bar says, changed** (no on-screen words changed with them):

| Was | Now | Where |
|---|---|---|
| `?done=declined` | `?done=no` | after a club's squad invitation is answered no |
| `?squad=declined` | `?squad=no` | after a family answers a squad invitation no |
| `?applied=1` | `?sent=1` | after a coach sends their CV for a role |

**4 · `.env.example`, the SMS cap** — not product copy, but it is the sentence that decides whether a text ever sends:

> `SMS_MONTHLY_CAP_CENTS=` — global monthly spend cap, IN CENTS (2000 = $20 a month). MANDATORY, and empty never means "no limit": with this unset, blank, zero or not a number, production sends NO SMS at all and every attempt is refused with a reason (D-81, BUZ decision 5, 23 Sep). SMS pumping fraud against an unrated endpoint burns four figures overnight, so the safe reading of "nobody set a cap" is "nobody has authorised any spend" — not "spend anything".

`docs/DEMO.md`'s "How it stays safe" gains two lines (internal, for BUZ's own use in a meeting): that a demo "can't put an uploaded crest anywhere but this laptop", and "It is served to this laptop only. Nobody else on the meeting's Wi-Fi can open it, even if they know the address."

---

## Risks

- **Nothing here has met Supabase.** The TLS path is proved against a fake Postgres with a certificate I generated; the pooler's real handshake, Supabase's Postgres version and its own CA are all still unmet. Keys day step 9 is where that first happens, and `scripts/apply-migrations.mjs --ca` proves it before the app does.
- **`max: 5` is reasoning, not a measurement.** I did not load-test it and cannot, without a real project. If Vercel runs many instances, five each could crowd the pooler; the number is one line in `lib/db-policy`.
- **`SUPABASE_CA_CERT` is a new required variable in practice.** The `supabase/rehearsal-ca.crt` fallback is there for local and CLI use; I would not rely on a repository file being present in a serverless bundle, and I did not test that it is.
- **The SMS-cap refusal is production-scoped** (see Did §2). In development an unset cap still queues to the outbox, as it always has.
- **Holding §13 means doc 14 B11's *positive* path cannot occur in production** until the hold is lifted. It is still exercised in the database by the permission suite, which is where doc 14 is enforced — but no real account will ever take it while the hold stands, and B10/G2 describe a transition that now cannot fire.
- I did not build the guardian's discovery switch, and I did not decide the default at sixteen. Both are BUZ's.
- `isLocalSocket` decides by host, so a `SUPABASE_DB_URL` pointed at `127.0.0.1` (the CI build command) gets the dev shape and no TLS. That is intended and it means a *remote* database reached over an SSH tunnel on loopback would not be verified. Nothing does that today.
- The write suite proves the coach lookup gives the same answer for an unproved address; that **no row is written** is proved at the database, by running the action's own SQL. There is no app-level way to see the absence, because an unproved account cannot sign in to look.
- I did not re-walk the club door's own under-18 notice; my browser probe only matched the coach door's wording.
- I touched two regenerable build caches in the main checkout to make room on disk (Found 1). Nothing tracked, nothing anyone was using.

---

## Lesson

**A check that reads source can be blind in a way only the reversion run reveals.** Both `url1` and `cap4` passed on the fixed code, looked right in review, and could not have failed on the bug they were written for — one stopped reading at the first quote, the other compared an `indexOf` of −1. Neither would have been caught by running the suite green. Put the bug back before you believe a new check (L19/L20), and when the check is a regex over source, put the bug back *in the exact shape it had* — a ternary inside a template literal, not the tidy version you imagined.
