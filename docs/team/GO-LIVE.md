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
| `CRON_SECRET` | `openssl rand -base64 32`. Without it the three crons refuse: no purges, no expiries, no reminders. |
| `OPS_EMAILS` | `burak.donmez@pitch-football.com`. Empty means nobody can open `/ops`. |
| `RESEND_API_KEY`, `EMAIL_WEBHOOK_SECRET` | Resend (API keys; Webhooks → signing secret) |
| `EMAIL_FROM` | `Pitch <hello@send.pitchfootball.com.au>`, the verified sending domain |
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
