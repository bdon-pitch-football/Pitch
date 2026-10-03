# release: ready for "keys are in" (2026-09-22)

Asked: three things. (1) Prove 0051–0053 are safe against a database that already holds data. (2) Cross-check the environment. (3) Write an ordered "keys are in" runbook that BUZ can read on its own.

**Blocking the keys day (before anyone creates a production key):**
- **R1:** four public tables have no RLS.
- **R2:** no suite can run against the real database.
- **R3:** `lib/db.ts` has no TLS set-up and uses one connection in production.
- **R4:** an empty `SMS_MONTHLY_CAP_CENTS` means no SMS cap at all.

The safety review's B1–B4 (22 Sep) still block launch as well.

---

## Did

- **`scripts/migration-on-data.mjs` (new, kept as a standing check).**
  - It uses its own in-process PGlite. It opens no port, so it can't reach 54322 or 54323.
  - It applies 0001–`--base` (default 0050), loads fictional rows, then applies each newer migration inside a transaction.
  - For each migration it reports:
    - the relation locks held until commit, read from `pg_locks`;
    - table rewrites, spotted when `relfilenode` changes;
    - any change to existing values, from an md5 of every row over the columns that existed before;
    - what new columns wrote onto old rows;
    - whether a second run succeeds (tried in a transaction that is then rolled back).
  - It runs two scenarios. "Clean" uses rows the product or seed could write. "Dirty" uses rows that break every new cap.
  - Before a migration it counts, per CHECK constraint, how many rows it would reject, and prints those checks as read-only SQL for the live database.
  - A self-test runs first (L19). A fake migration that changes a value, rewrites a table and can't be re-run must show up as all three, or the script exits 2.
  - I kept it because every migration after launch meets live rows. For a future base, move `--base` and add that migration's pre-flight queries. The seed only uses columns that exist at 0050.
- **`scripts/apply-migrations.mjs` (new).** This is how migrations reach the real database. Until now there was no runner and no record of what had been applied, and 0051/0052 fail if run twice.
  - It only plans unless given `--apply`.
  - It keeps a ledger in `pitch_meta.applied_migration`, outside `public`, so the Data API never exposes it.
  - Each file runs in one transaction together with its ledger row, under `lock_timeout 5s`.
  - It refuses to:
    - apply to a database that has tables but no ledger;
    - run a file that changed after it was applied;
    - apply a pending file numbered below one already applied;
    - connect to 54322 or 54323;
    - connect to a remote database without `--ca` (TLS with the certificate checked).
  - It never prints the connection string, only host and database name.
  - `--fingerprint` / `--local-fingerprint` hash the public schema (columns, constraints, indexes, triggers, function bodies, RLS flags) from the live database and from PGlite, so we can prove the live schema matches the one the suites tested. `--dump` prints the lines to diff.
  - Tested against a scratch PGlite socket on 127.0.0.1:54399, now stopped:
    - the plan listed 53 pending;
    - `--apply` gave 53 OK, and the next plan showed 0 pending;
    - remote and local fingerprints matched (`4f2ae585…`);
    - a tampered ledger hash gave STOP;
    - an out-of-order pending file gave STOP;
    - re-applying 0051 failed and rolled back;
    - port 54322 was refused, and a remote URL without `--ca` was refused.
- No product code changed. Nothing is committed: both scripts are untracked, for Leo to review.

## Ran

- validate-migrations 65/65 (53 files + 12 invariants)
- perms 967/967 (env1 ✓, env2 ✓, env3 ✓, DEMO1–7 ✓)
- gate 261 pinned, 0 open
- secret-scan: no secrets
- `tsc --noEmit` clean
- migration-on-data:
  - self-test 3/3 detected
  - clean scenario: 0051–0053 all apply
  - dirty scenario: stops at 0051, as it should
- Scale timing in PGlite:
  - 0051 against 20,000 clubs: 13 ms
  - 0052 against 1,000,000 `consent_event` rows: 145 ms
  - 0053: 2 ms
- `isDemo()` run directly:
  - `NODE_ENV=production PITCH_DEMO=1` throws;
  - `production` with `"true"` or `""` returns false;
  - `development` with `1` returns true.
- **Not run:** render, write and layout. They need the shared dev database and app, which other seats are using, and write changes data. I didn't start `npm run demo` either: its takeover would replace a demo BUZ might be running. Ports 3030 and 54323 were free when I checked, but I left them alone.

### Deliverable 1: 0051–0053 against a database with data

| | 0051 club page editing | 0052 squads | 0053 roster depth |
|---|---|---|---|
| **Locks (held to commit)** | `club` ACCESS EXCLUSIVE (3 CHECKs scan the table); `alumni_entry` and `players_wanted_notice` ACCESS EXCLUSIVE; `person` SHARE ROW EXCLUSIVE (new FKs) | **`consent_event` ACCESS EXCLUSIVE** (drops and re-adds the CHECK, then scans every row); `club`, `squad` and `person` SHARE ROW EXCLUSIVE (FKs from the new tables) | No table locks. Drop and recreate of `fn_squad_roster` only |
| **Rewrites** | None. `created_at … default now()` is a fast default with no rewrite | None | None |
| **Silent changes to existing rows** | Every existing `alumni_entry` gets **the same `created_at`, the moment of the migration**. `added_by`, `adults_confirmed_by` and `adults_confirmed_at` stay null on old rows. The new trigger is **INSERT-only**, so old entries stay on the public wall unconfirmed, and an UPDATE isn't re-confirmed. The app has no update path today (`app/club/page-edit/actions.ts` only inserts and deletes) | None. The new event list contains all 33 words from 0033 plus 3 new ones, so no existing row can fail. All 33 kinds were loaded and all survived | None. The return shape grows by 8 columns, and `select *` callers get more columns, not fewer |
| **Rejects existing rows?** | Yes, if any are out of range, and then the whole file rolls back. Dirty scenario counts: philosophy >400: 1 · pathway >80: 1 · established not `^(18\|19\|20)\d\d$`: 3 (`Est. 1974`, `1974 ` with a trailing space, `1790`) · wanted title empty or >60: 2 · wanted detail >100: 1 · alumni line empty or >80: 2 | No | No |
| **Re-runnable?** | **No.** Fails at `created_at already exists` | **No.** Fails at `squad_claim already exists`. Run outside a transaction, the drop-then-add pair could leave `consent_event` with no CHECK if the add failed | **Yes** (`drop … if exists` + create) |
| **Order with code** | Migrate first, then deploy the code that writes the new columns | Migrate first | Migrate first. Old code on the new schema is fine. New code on the old schema breaks the squad page |

On launch day all three run against an empty database, so none of this bites then. It bites on every later migration. For those:
- When a CHECK goes onto a busy table (`consent_event`), use `ADD CONSTRAINT … NOT VALID` and then `VALIDATE CONSTRAINT`. The validate step takes SHARE UPDATE EXCLUSIVE and doesn't block writes.
- Use `if not exists` where it's cheap.
- Only ever apply through `apply-migrations.mjs`: one transaction, lock_timeout, the ledger.

### Deliverable 2: environment

The code reads 26 variables across `app/`, `lib/`, `proxy.ts`, `components/` and `next.config.mjs`. All are in `.env.example`, apart from `NODE_ENV` (platform) and `NEXT_DIST_DIR` (build tooling, set only by `build:check` and the demo). Nothing in `.env.example` is left unread.

| Variable | Secret | Who sets it, where |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | no (project URL; used in CSP, storage and waitlist) | BUZ · Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | BUZ · Vercel |
| `SUPABASE_DB_URL` | **yes** (holds the DB password) | BUZ · Vercel = the **transaction pooler** (port 6543). Keys-day file = the **session pooler** (port 5432), for migrations |
| `SUPABASE_STORAGE_BUCKET` | no | BUZ · Vercel (`public-images`) |
| `RESEND_API_KEY`, `EMAIL_WEBHOOK_SECRET` | **yes** | BUZ · Vercel |
| `EMAIL_FROM`, `EMAIL_REPLY_TO`, `DIGEST_TO` | no | BUZ · Vercel |
| `SMS_ACCOUNT_SID` | no (identifier) | BUZ · Vercel |
| `SMS_API_KEY` | **yes** | BUZ · Vercel. **It must be the Twilio Auth Token.** `lib/providers.ts:77` signs in as `AccountSID:SMS_API_KEY`, so a Twilio "API key" (SK…) would get 401 on every send. `.env.example` doesn't say this |
| `SMS_WEBHOOK_SECRET` | **yes** (the same Auth Token) | BUZ · Vercel |
| `SMS_LONG_NUMBER`, `SMS_KILL_SWITCH` | no | BUZ · Vercel. The kill switch only takes effect after a **redeploy** |
| `SMS_MONTHLY_CAP_CENTS` | no | BUZ · Vercel. **Empty or 0 means no cap** (`lib/messaging.ts:63-64`, `if (cap > 0)`) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | **yes** | BUZ · Vercel. Test keys in Preview, live keys in Production |
| `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL` | no | BUZ · Vercel. Test-mode price IDs are different from live ones |
| `SESSION_SECRET`, `CRON_SECRET` | **yes** | BUZ · Vercel. Different values per environment |
| `NEXT_PUBLIC_SITE_URL` | no | BUZ · Vercel. For Preview, set it to the `app` branch alias, or test emails link to the marketing site on `main` |
| `OPS_EMAILS` | no | BUZ · Vercel. Empty means nobody can reach `/ops`, including the kill switches |
| `WAITLIST_ENABLED` | no | BUZ · Vercel |
| `TZ` | no | Not needed. The database pins Australia/Melbourne explicitly (`fn_age_band`, 0003), and all 7 JS date formatters pass `timeZone`. Vercel may not accept `TZ` as a name, and that doesn't matter |
| `PITCH_DEMO` | no | **Never set anywhere except `npm run demo`** |

- **`NEXT_PUBLIC_` check:** only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SITE_URL` exist. Neither is a secret. There is no anon key and no publishable Stripe key.
- **`PITCH_DEMO` can't be on in production. I ran this, not just read it.**
  - `isDemo()` throws when `PITCH_DEMO=1` under `NODE_ENV=production`.
  - `lib/db.ts:12` calls it when the module loads, and `app/layout.tsx:73` calls it on every page, so a build or request with it set fails closed.
  - Any other value ("true", "") means demo off, which is the safe way to fail.
  - Vercel runs both Preview and Production builds with `NODE_ENV=production`.
- **The demo can't send anything:** `scripts/demo.mjs` blanks every outbound key. I confirmed in `@next/env` that a variable already set to `""` isn't filled from `.env.local`.

## Found

- **R1 · Four public tables have no row-level security:** `app_config`, `coach_invite`, `register_grant`, `register_read_log`. I checked all 73 tables after 0053.
  - On Supabase the Data API exposes `public`, and default privileges grant anon full table rights. RLS with no policies is the only thing that shuts them.
  - Anyone holding the project's anon key could then:
    - read `register_read_log` (who at a club opened which child's registration);
    - read `coach_invite`;
    - write `register_grant` (limited only by the 0037 triggers);
    - flip `app_config.onboarding_paused`.
  - The anon key isn't in our code, but Supabase doesn't treat it as a secret.
  - No suite check caught this. The fingerprint now records RLS flags, but that isn't an assertion.
  - Builder: add a migration enabling RLS on all four, and a perms check that every public table has `relrowsecurity`. Revoking anon and authenticated privileges on `public` tables and functions is worth considering too; `lib/waitlist-db.ts` uses service_role, which bypasses RLS anyway.
- **R2 · "Suites green on the target database" can't be done yet.**
  - `permission-tests.mjs` always builds its own PGlite and ignores `SUPABASE_DB_URL`.
  - render, write and layout need `.dev-ids.json` from the dev seed and a running app.
  - The `.env.example` comment "doc 14's tests run against the database" means a PostgreSQL engine, not the Sydney database.
  - Pointing the seed or the write suite at production would put fictional people in production.
  - Options for Leo:
    - (a) A free Sydney **staging** project, plus a builder change so the permission suite and the seed accept a URL. This is the honest way to run the suites against a real Supabase.
    - (b) Accept fingerprint parity as the substitute: the live schema hashes identical to the one the 967 checks tested.
  - The runbook does (b) either way and adds (a) if chosen.
  - The migrations have only ever run on PostgreSQL **18.3** (PGlite 0.5.8). A new Supabase project will probably be 17.x. I found none of the 18-only features I searched for, but only a real apply proves it.
- **R3 · `lib/db.ts` has no TLS set-up and a pool of one connection in production.**
  - With `?sslmode=require`, pg 8 treats it as verify-full against Node's CA store. Supabase's certificate chains to Supabase's own CA, so I expect the connection to fail (not checked against a real project).
  - Without sslmode, pg connects in plaintext, unless BUZ turns on "Enforce SSL", in which case it fails.
  - `max: 1` is unconditional, despite the comment, so on Vercel every concurrent request in an instance queues behind one connection. The L1 deadlock class applies in production too.
  - Builder: pass `ssl: { ca }` (the Supabase CA is a public certificate and can live in the repo), and raise `max` outside development.
- **R4 · An empty `SMS_MONTHLY_CAP_CENTS` means no SMS spend cap.** CLAUDE.md says the controls exist "before the first verification message". Builder: in production, refuse to send when the cap is unset. The runbook sets it anyway.
- **R5 · Vercel plan.** `vercel.json` registers an hourly cron (`/api/jobs/outbox`). My understanding is that Hobby allows only daily crons and isn't for commercial use. I haven't checked Vercel's current terms. BUZ should expect Pro.
- **R6 · Previews can't get webhooks by default.** Vercel Authentication blocks Stripe, Resend and Twilio from a preview. The runbook uses "Protection Bypass for Automation". The bypass value goes only into those dashboards and the keys-day file.
- **R7 · Vercel adds `X-Robots-Tag: noindex` to every preview.** So a noindex header on a preview proves nothing. On preview the runbook checks the page's own `<meta name="robots">`. The header check has to be repeated on pitchfootball.com.au on launch day.
- **R8 · The SMS kill switch is an environment variable.** Turning it off takes a Vercel edit plus a redeploy (minutes). Twilio's own controls are faster. The runbook times both.
- Minor: `app/api/digest/route.ts` and `lib/storage.ts` don't call `isDemo()`. The demo is still safe because `demo.mjs` blanks their keys. It's still one lock where DEMO.md says there are three.
- `.env.example` says `hello@send.pitchfootball.com.au`, CLAUDE.md says `mail.`. `.env.example` is newer, and it has to match the subdomain BUZ verifies in Resend.

## Copy for BUZ

None. The runbook below is an internal operating document, not product copy.

## Risks

- Everything here was proved on PGlite and a scratch socket, never on Supabase:
  - Supabase's Postgres version;
  - pgcrypto resolving through `extensions`;
  - how the pooler presents TLS;
  - how the fingerprint text renders on 17.

  Keys-day steps 5 and 7 are where each of these first meets reality.
- I didn't open the go-live checklist, as asked. The cross-check covers the code, `.env.example` and the WALKTHROUGH summary only.
- I didn't exercise the demo (see Ran).
- The dirty scenario only covers the caps 0051 adds. The column fingerprint compares values, not types.

## Lesson

A migration that passes on an empty database has only proved its syntax. Before trusting a new migration, check what it locks, what it writes onto old rows, and whether it can run twice (`node scripts/migration-on-data.mjs --base <last applied>`).

---
---

# Keys day: the runbook

For BUZ, readable on its own. **BUZ** = you, in a browser or on your phone. **LEO** = Leo, running commands on the laptop.

**Rules for the whole day.**
- No key, password or secret is ever typed into chat, a message, or a file other than the ones named below.
- Production values never go in `.env.local`. The dev app reads that file, so the dev app and the test suites would start using production.
- The one local file for today is `.env.keysday.local`. Git ignores it, and you delete it at the end.
- Nothing is pushed or deployed without you saying so in your own words.

**Before the day (LEO, then Leo confirms to BUZ it's done):** fixes for R1 (RLS), R3 (TLS and pool) and R4 (SMS cap) are merged on `app` and green. Leo decides on R2 (staging project yes or no).

### Part A: accounts (BUZ, any order; each has lead time)

1. **BUZ · Twilio.** Upgrade the account and add **prepaid** credit with **auto-recharge off**. Buy an Australian **long number** and file the regulatory bundle it asks for; this can take days. Under Messaging → Settings → Geo permissions, allow **Australia only**.
   *Verified when:* the number shows as active, and Geo permissions lists only Australia.
2. **BUZ · Resend.** Domains → Add `send.pitchfootball.com.au`. Copy the DNS records it shows into your domain host. Add a DMARC record on the apex (`_dmarc.pitchfootball.com.au`, `v=DMARC1; p=none; rua=mailto:<your inbox>`).
   *Verified when:* every record on the Resend domain page says "Verified".
3. **BUZ · Supabase (production).** New project named `pitch-prod`, region **Sydney (ap-southeast-2)**. This can't be changed later. Save the database password in your password manager only. Upgrade to **Pro** and turn on the **Point-in-time recovery** add-on.
   *Verified when:* Project Settings → General shows Sydney, and Database → Backups shows point-in-time recovery enabled.
4. **BUZ · Supabase (staging), only if Leo chose it for R2.** Same again, named `pitch-staging`, Sydney, free plan, no add-ons.
5. **BUZ · Supabase settings (on each project).**
   - Database → SSL Configuration: switch on **Enforce SSL**, then **Download certificate**. Save it as `supabase/rehearsal-ca.crt` in the repo folder. It's a public certificate, not a key.
   - Storage → New bucket `public-images`, **Public** on.
   - Settings → API: check that exposed schemas is `public` only.
6. **BUZ · Stripe, in test mode.**
   - Products: one product, two prices in AUD, tax-inclusive: **$54 monthly** and **$329 yearly**.
   - Settings → Billing → Customer portal: press Save once, so the portal exists.
   - Webhooks come in step 11.
   *Verified when:* both prices show in test mode.
7. **BUZ · Vercel.** Expect to need **Pro** (R5).
   - On the project connected to this repo: Settings → Deployment Protection. Turn **Vercel Authentication** on for Preview. Generate a **Protection Bypass for Automation** value.
   - Settings → Git: make sure pushing a branch other than `main` makes a **Preview**, not Production.

### Part B: the database (LEO runs, BUZ says go)

8. **BUZ · the keys file.** In Terminal:
   `cd "/Users/bdonmez22/Desktop/Life/Work/Pitch 3.0/repo" && touch .env.keysday.local && open -e .env.keysday.local`
   Paste these lines, save, close:
   - `SUPABASE_DB_URL=`: Supabase → Connect → **Session pooler** string, with your password in it.
   - `PREVIEW_URL=`: fill in after step 12.
   - `VERCEL_BYPASS=`: the bypass value from step 7.
   - `CRON_SECRET=`: the same value you'll give Vercel in step 10.

   If Leo chose staging, point `SUPABASE_DB_URL` at **staging** first. Parts B–D then run on staging, and step 9 is repeated for production at the end.
   *Verified by LEO:* `git check-ignore -v .env.keysday.local` names the `.env*.local` rule, and `node scripts/secret-scan.mjs` says no secrets.
9. **LEO · migrations.**
   - Plan (changes nothing):
     `node --env-file=.env.keysday.local scripts/apply-migrations.mjs --ca supabase/rehearsal-ca.crt`
     Expect: `Postgres 17.x` (or whatever Supabase gives), `applied: 0 · pending: 54` (53 plus the R1 fix), and a list of files. This also proves TLS works with the certificate checked.
   - **BUZ says "apply".** Then LEO runs the same command with `--apply`.
     Expect: one `OK` per file, then `done`. On any `FAIL`, that file rolled back. Stop and report. Nothing is retried by hand.
10. **LEO · the schema matches what the suites tested.**
    `node scripts/apply-migrations.mjs --local-fingerprint` and
    `node --env-file=.env.keysday.local scripts/apply-migrations.mjs --ca supabase/rehearsal-ca.crt --fingerprint`
    Expect: the same hash. If they differ, run both with `--dump`, diff them, and explain every line. Known suspects: how Postgres 17 prints some definitions, and `extensions.gen_random_bytes` in the waitlist default. Also check that every `rls|` line ends `:true`.
11. **LEO · the suites against the real database.**
    - Without staging: `npm run test:perms` locally. That proves the schema, and step 10 proves the live schema is the same one.
    - With staging: the builder's URL mode of the permission suite against staging, then the seed and render/write against the preview from step 12.
    Report counts, not "green".

### Part C: the private preview (needs BUZ's explicit OK to push)

12. **BUZ · Vercel environment variables.** Settings → Environment Variables, scope **Preview**, branch `app` only. Enter every variable in the env table above:
    - Stripe **test** keys and test price IDs;
    - `SUPABASE_DB_URL` = the **Transaction pooler** string (port 6543) of staging, or of prod if there's no staging;
    - `NEXT_PUBLIC_SITE_URL` = the preview branch address;
    - `SMS_MONTHLY_CAP_CENTS` = a real number (e.g. `2000` for $20);
    - `SMS_KILL_SWITCH=false`;
    - `OPS_EMAILS` = your email;
    - a fresh `SESSION_SECRET` (`openssl rand -base64 48`, run in your own Terminal).

    **Don't** add `PITCH_DEMO`, and leave Production-scope variables alone.
13. **BUZ says "push app".** Then **LEO** runs `git push origin app`. This is the first push of `app` ever.
    *Verified when:* Vercel shows a Preview for `app` marked Ready, the build log has no errors, and functions show region `syd1`. Put the branch address in `PREVIEW_URL` in the keys file.
14. **BUZ · webhooks, pointed at the preview.** Every URL ends with `?x-vercel-protection-bypass=<the bypass value>`.
    - Stripe (test) → Developers → Webhooks → `<preview>/api/stripe/webhook`, events `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed`. Put the signing secret in Vercel as `STRIPE_WEBHOOK_SECRET`.
    - Resend → Webhooks → `<preview>/api/webhooks/resend`, events delivered, bounced, complained. The signing secret goes in as `EMAIL_WEBHOOK_SECRET`.
    - Twilio → your number → "A message comes in" → `<preview>/api/webhooks/sms`, HTTP POST.
    - Then redeploy the preview (Deployments → ⋯ → Redeploy), so the new variables are live.

### Part D: prove each piece

15. **BUZ · you can reach the switches.** On the preview, create your own adult account at `/join` with the email in `OPS_EMAILS`, then sign in and open `/ops/switches`. Press **Pause every shared link**, open `/p/anything` (you should see the dead-link page), then switch it back on. **Don't** press "Switch off every link" (it can't be undone).
    *Verified when:* both actions appear in the switch log with your email.
16. **BUZ · a real test email.** On the preview, use "Forgot password" for your own account.
    *Verified when:* it lands in your inbox, not spam, from `hello@send.pitchfootball.com.au`. In Gmail, "Show original" shows SPF, DKIM and DMARC as PASS. Within a minute, LEO (or you, in the Supabase SQL editor) sees `select event, at from consent_event order by id desc limit 5` include `email_delivered`.
17. **BUZ · a real test SMS.** At `/join`, start an under-16 sign-up for a made-up child (e.g. "Test Fixture"). Put **your own** mobile as the parent's number.
    *Verified when:* the text arrives from the long number with the link on our own domain. Reply **STOP**; the reply arrives, and `select count(*) from sms_opt_out` goes up by one. Afterwards, delete the made-up child through the product's own deletion, so nothing fictional stays behind.
18. **BUZ · a Stripe test checkout.**
    - Claim a club using a name already in our seed (e.g. "Riverside FC"; never a real club's). Verify it yourself in `/ops/verification` with a made-up call record.
    - As its TD, open Billing and choose monthly. Pay with card `4242 4242 4242 4242`, any future date, any CVC.
    *Verified when:* you land back on Billing and the plan reads the Interest Register. Stripe (test) → Webhooks shows a 200 for each event. Opening "Manage billing" gets you the Stripe portal, and cancelling there changes the plan state in Pitch.
19. **LEO · the scheduled jobs answer only with the secret.** Previews don't run crons, so LEO calls one by hand:
    `node --env-file=.env.keysday.local -e "for (const a of [true,false]) fetch(process.env.PREVIEW_URL+'/api/jobs/outbox',{headers:{'x-vercel-protection-bypass':process.env.VERCEL_BYPASS,...(a?{authorization:'Bearer '+process.env.CRON_SECRET}:{})}}).then(r=>console.log(a?'with':'without', r.status))"`
    Expect: `with 200`, `without 401`.
20. **LEO · noindex on tokenised pages.** Run it on the preview for `/p/x`, `/a/x`, `/reset/x`, `/undo/x`, `/unsubscribe?token=x` and `/manage?token=x`, with the bypass header. Expect all three of these:
    - the HTML contains `<meta name="robots" content="noindex, nofollow"`;
    - `/p/x` carries `Referrer-Policy: no-referrer` and `Cache-Control: no-store`;
    - `/trials` has **no** robots meta.

    Vercel stamps noindex on every preview, so the **header** check (`X-Robots-Tag: noindex, nofollow` on `/p/x` only) is repeated against `https://pitchfootball.com.au` on launch day.
21. **BUZ · the backup really restores, on the production project, before any real family is in it.**
    - In the Supabase SQL editor:
      `create schema restore_probe; create table restore_probe.m (label text, at timestamptz default now()); insert into restore_probe.m (label) values ('before'); select now();`
    - Write down the time it shows. Wait **five minutes**, then run `insert into restore_probe.m (label) values ('after');`
    - Database → Backups → Point in time: restore to **two minutes after** the time you wrote down. If a "restore to a new project" option is offered, use it; otherwise restore in place (fine today, because nothing real is in it yet).
    - Note how many minutes the restore takes. That's our real recovery time.
    *Verified when:* `select label from restore_probe.m` returns only `before`. Then LEO reruns steps 9 (plan) and 10: expect `pending: 0` and the same hash. Finally, run `drop schema restore_probe cascade;`.
22. **BUZ · time the SMS kill switch.** In Vercel, set `SMS_KILL_SWITCH=true` (Preview) and redeploy. Try step 17's sign-up again: no text should arrive. Set it back to `false` and redeploy. Write down the minutes it took end to end. Also find, without pressing, Twilio's faster brake: Console → your number, and the account's messaging geo permissions.

### Part E: close the day

23. **BUZ** deletes `.env.keysday.local` (`rm .env.keysday.local` in the repo folder). Every value now lives only in your password manager and in Vercel. **LEO** runs `node scripts/secret-scan.mjs --history` and expects no secrets.
24. **LEO** writes down the numbers:
    - Postgres version;
    - how many files were applied;
    - the fingerprint hash;
    - the suite counts;
    - the restore minutes;
    - the kill-switch minutes;
    - the webhook status codes.

    Anything that wasn't green goes back to BUZ before launch day is even discussed.

If any value was ever pasted anywhere it shouldn't have been, **rotate it first and investigate second.**
