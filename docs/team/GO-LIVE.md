# Go-live: the launch runbook

BUZ set launch day as **1 October**. This page is the order of events. Nothing
reaches production without BUZ's explicit go at step 4. The `app` branch has
never been pushed.

## 1 · BUZ, today (things with lead time)

| # | What | Where | State |
|---|---|---|---|
| 1a | **SMS: Twilio account plus an Australian mobile number** (D-81). The account was upgraded 29 Sep with US$50 prepaid and auto-recharge off. The Regulatory Bundle (EBSD ENTERPRISES PTY LTD, AU mobile, business) was **sent for review 29 Sep**, which takes up to 5 business days. **After approval:** BUZ buys the AU mobile number and attaches the bundle, then pastes `SMS_*` into Vercel. Leo points the number's inbound webhook at `/api/webhooks/sms` and sends a test text. | Twilio console | **In review.** Under-18s still register from launch day, with their texts queued (D-168). |
| 1b | Email records on `send.pitchfootball.com.au`: DKIM, return path, DMARC `p=none` | DNS host | **Live** (checked 29 Sep with `dig`) |
| 1c | **Supabase project in Sydney, on Pro.** `rxcgttfosftfgybftogo` is in ap-southeast-2 and was upgraded to Pro on 29 Sep. Daily backups are showing (7 days). Point-in-time recovery is not added yet (BUZ's call: add it once real families are on). Storage objects (photos, crests) are not in the backups. | supabase.com | **Done.** The project also holds the live site's waitlist and the social images, so check for name clashes in the rehearsal. The restore test uses "Restore to new project" into a temporary copy, which is deleted afterwards (ask BUZ before creating it). |
| 1d | ~~help@ forward~~ **not needed.** Replies go straight to BUZ (D-169). | | **Done by decision** |

## 2 · BUZ, tomorrow: production values in Vercel (Leo never sees a secret)

Paste each into Vercel → Project → Settings → Environment Variables, **Production**
and **Preview**:

| Variable | Value / where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_CA_CERT`, `SUPABASE_STORAGE_BUCKET` | the Sydney project (Settings → API / Database). The CA certificate is required; a missing one fails the connection, never silently. |
| `SESSION_SECRET` | `openssl rand -base64 48`. Nobody can sign in without it. |
| `NUMBER_HASH_KEY` | **Production, BEFORE the push that carries 0169** (John's batch, 1 Oct, §5.2). `openssl rand -base64 48`, as a Secret; at least 32 characters. It keys the STOP list's and the SMS meter's number fingerprints (HMAC, never a plain hash). **Without it production refuses every SMS, including the parent's approval text that otherwise waits for Twilio (D-168): no under-16 sign-up could be approved until it is set.** Set it once and never change it: every STOP recorded is keyed with it. 0169 also stops itself if `sms_opt_out` is not empty (`select count(*) from sms_opt_out` must be 0 first; it is, with no SMS ever live). |
| `CRON_SECRET` | `openssl rand -base64 32`. Without it the three crons refuse: no purges, no expiries, no reminders. |
| `OPS_EMAILS` | `burak.donmez@pitch-football.com`. Empty means nobody can open `/ops`. |
| `RESEND_API_KEY`, `EMAIL_WEBHOOK_SECRET` | Resend (API keys; Webhooks → signing secret) |
| `EMAIL_FROM` | `Pitch <hello@send.pitchfootball.com.au>`, the verified sending domain. The code sends it as **Pitch Football** whatever name is here (E3, 1 Oct); only the address is read. |
| Resend → Domains → `send.pitchfootball.com.au` → Configuration | **Open tracking OFF and click tracking OFF**, before any HTML email sends (spec K, 1 Oct). Every email now carries an HTML part, and with either switch on Resend adds a pixel or rewrites every link — surveillance of a parent reading about their own child (doc 14 J41's reasoning). The code asks for neither; only the dashboard can turn them on. |
| `EMAIL_REPLY_TO` | `burak.donmez@pitch-football.com` (D-169). No help@ inbox. |
| `NEXT_PUBLIC_SITE_URL` | `https://pitchfootball.com.au` |
| `TZ` | `Australia/Melbourne` |
| `DIGEST_TO` | `burak.donmez@pitch-football.com` |
| `SMS_ACCOUNT_SID`, `SMS_API_KEY`, `SMS_LONG_NUMBER`, `SMS_WEBHOOK_SECRET`, `SMS_MONTHLY_CAP_CENTS` | **after 1a clears.** `SMS_WEBHOOK_SECRET` is the Twilio **auth token**. Leave all empty until then: SMS refuses cleanly. |
| `STRIPE_*` | **leave empty.** Billing is off until further notice (D-163). |
| `WAITLIST_ENABLED` | `false` once the product front door is on |
| `PITCH_DEMO`, `PITCH_DEV_DB_PORT` | **never set in production.** A production build refuses to start in demo mode. |

## 3 · Leo, tomorrow: the preview rehearsal (never production)

**Where it runs, decided 29 Sep:**
- **The production database** (`rxcgttfosftfgybftogo`) already holds
  `public.waitlist`, with **5 real sign-ups**, and the social-image storage
  bucket. Its `waitlist` matches `0001_waitlist.sql` column for column. It was
  created from that file, but never recorded in the migration history.
- **The rehearsal runs on a Supabase branch.** It is a disposable copy, Pro
  plan; the branch's cost (cents an hour) is confirmed with BUZ before it is
  created, and it is deleted after. All migrations, `0001`–`0130`+, run on the
  branch. The Vercel **Preview** environment points at the branch;
  **Production** points at the real project.
- **The preview deploy needs one go from BUZ: push the `app` branch to
  GitHub.** It has never been pushed. Vercel builds a preview from it
  automatically. Production keeps deploying `main` (the website) until launch
  day.
- **Launch day on production:** record `0001` as already applied (the table is
  there, with its 5 rows untouched), then run `0002` onward in order, after
  the preflight queries.


1. **Migrations onto the empty Sydney database, in order.** Run the preflight
   queries first (`RELEASE-PREFLIGHT.md`). On an empty database they return
   nothing.
2. **Deploy the `app` build to a Vercel preview**, pinned to `syd1`. Check:
   - The front door: switch on in the preview's database, `curl -sI /` must be
     200, never a 307 loop (RELEASE-PREFLIGHT).
   - One real sign-up of an adult, email through Resend to a real inbox, and
     the delivery receipt arriving in the consent log.
   - `/ops` opens for BUZ and nobody else.
   - The production security header (`test:csp-prod` against the preview URL)
     and `noindex` on every under-18 and tokenised page (doc 32 A6: verified
     on the deployed site, not in the source).
   - The three crons answer `401` without `CRON_SECRET` and run with it.
3. **The restore test (doc 32 C2):** restore the Sydney project to a point in
   time into a scratch project, and check the tables are there. A backup
   nobody has restored is a hypothesis.

## 3b · What the 30 September rehearsal proved, and what it taught

**Proved on real infrastructure** (Supabase branch `Rehersal`, Vercel preview of `app` at eb390ad):
- All 94 migrations apply cleanly on Supabase Postgres 17.6 through `scripts/apply-migrations.mjs`, and the schema fingerprint matches PGlite entry for entry (1,376 entries; PGlite additionally lists NOT NULL as constraints, which Supabase keeps on the columns).
- The app on Vercel (syd1) reads the database: `/trials`, `/jobs`, `/signin`, `/join`, the four legal pages all 200.
- Headers on every page: CSP without `unsafe-inline`, HSTS, `nosniff`, and `noindex` on the preview.
- The three crons answer 401 without `CRON_SECRET`; `/ops` redirects a stranger.
- **The front door on Vercel:** with `front_door_open` true, `/` answers 200 with the product front page. **No 307 loop** (the open question in RELEASE-PREFLIGHT is answered).

**Taught (do it this way on launch morning):**
- **`TZ` cannot be set on Vercel** (a reserved name). Nothing needs it: `lib/age.ts` and every SQL date name `Australia/Melbourne` explicitly (doc 14 G9).
- **Pasting `NAME=value` lines into Vercel's Key box resets the form to Config and Production.** Paste first, *then* set Type = Secret and Environments, then Save.
- **After saving a variable, Vercel offers "Redeploy". Press Dismiss.** That button rebuilds *Production*. (It rebuilt the website twice on 30 Sep: same code, same settings, no visible change.)
- **Put secrets on the clipboard one command at a time and paste straight away**; a clipboard holds one thing. Check the shape before saving (Leo can check line names and lengths without reading values).
- **A database password must be URL-safe in `SUPABASE_DB_URL`.** Supabase's generated passwords contain symbols; `set-rehearsal-url.mjs` style entry (typed or pasted into a prompt, encoded by the script) avoids hand-editing. A value that is not a `postgresql://` URL shows up as `getaddrinfo ENOTFOUND base` in the logs.
- **A failed database connection does not break `/`:** it reads as "front door closed" and serves coming-soon. Check `/trials` returns 200 after every deploy.
- **The bucket `public-images`** must be created by hand (step 4.2).

## 3c · Went live: 30 September, about 6pm (BUZ: "We need to be live before midnight")

Done in this order, each production step by BUZ's own hand, each checked by Leo:
1. Production database password reset; entered through a hidden prompt into `.env.production-db.local` (git-ignored, never printed).
2. Migrations: `apply-migrations.mjs --baseline-waitlist --apply`: 0001 recorded (made by hand 3 Sep), 0002–0156 applied. Waitlist: 5 rows, untouched. Ledger 94.
3. Vercel Production settings added: `SUPABASE_DB_URL`, `SESSION_SECRET` (secrets), `SUPABASE_CA_CERT`, `OPS_EMAILS`, `SUPABASE_STORAGE_BUCKET`. Existing ones checked correct.
4. Bucket `public-images` created, public.
5. Front door opened in the database **before** the switch, so the app's old coming-soon copy was never served.
6. Vercel Production branch changed from `main` to **`app`**; BUZ pushed; the app went live on pitchfootball.com.au.

**Found and fixed on the night:**
- **Production's `RESEND_API_KEY` (3 Sep) never worked** (HTTP 400, never reached this Resend account). Replaced with `pitch-production2`. Two rows share the name (Preview, Production): edit the one whose environment says Production.
- **Every session was revoked half a second after sign-in:** production prefetched the "Sign out" links (`GET /signout`). Fixed in de2868c: `prefetch={false}` on every Sign out link, and `/signout` answers a prefetch with 204 and touches nothing. Checks signout-p1/p2. Development never prefetches, so no suite could have seen it: **check sign-in on the live site after every deploy that touches navigation.**

**Now true, and easy to forget:**
- **Every push to `app` deploys to production.** Nothing is pushed without BUZ's go.
- **Rollback:** Vercel → Deployments → the last good production deploy → ⋯ → Instant Rollback (or "Site: free until further notice" for the old website). Nothing in the database is lost.

## 4 · 1 October: BUZ's go

1. BUZ says go. Leo promotes the verified preview to production on
   `pitchfootball.com.au`. The coming-soon site's `main` is kept, so rolling
   back is one redeploy.
2. **Create the storage bucket** `public-images` in the production project,
   **public-read** (Storage → New bucket, or `insert into storage.buckets (id,
   name, public) values ('public-images', 'public-images', true)`). No
   migration creates it; without it, crest and photo uploads fail. (Found in
   the 30 Sep rehearsal.)
3. **Flip the front door on** in the production database, then `curl -sI /`
   must return 200.
4. **The waitlist's one email (promised on the site: "one email, at launch").**
   BUZ sends it himself from his own address, one email per person and never
   CC'd together. Leo drafts each one in BUZ's Gmail on launch morning, from
   the `waitlist` rows not unsubscribed. The words are held for BUZ's approval
   (drafted 29 Sep). A reply of "unsubscribe" is the opt-out; Leo records any
   in `waitlist.unsubscribed_at`.
5. **Kill switches rehearsed from BUZ's phone:** pause shared links, and
   switch SMS off and back on.
6. **Under-18s** open the day 1a clears (if BUZ chooses to launch adults,
   coaches and clubs first).

## Rollback

- Redeploy `main` (the coming-soon site) in Vercel.
- The database stays. Nothing a family did is lost.
- Flip the front door off.
