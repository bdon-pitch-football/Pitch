# Go-live: the launch runbook

BUZ set launch day as **1 October**. This page is the order of events. Nothing
reaches production without BUZ's explicit go at step 4. The `app` branch has
never been pushed.

## 1 · BUZ, today (things with lead time)

| # | What | Where | State |
|---|---|---|---|
| 1a | **SMS: Twilio account plus an Australian mobile number** (D-81). The account was upgraded 29 Sep with US$50 prepaid and auto-recharge off. The Regulatory Bundle (EBSD ENTERPRISES PTY LTD, AU mobile, business) was **sent for review 29 Sep**, which takes up to 5 business days. **After approval:** BUZ buys the AU mobile number and attaches the bundle, then pastes `SMS_*` into Vercel. Leo points the number's inbound webhook at `/api/webhooks/sms` and sends a test text. | Twilio console | **In review.** Under-18s still register from launch day, with their texts queued (D-168). |
| 1b | Email records on `send.pitchfootball.com.au`: DKIM, return path, DMARC `p=none` | DNS host | **Live** (checked 29 Sep with `dig`) |
| 1c | **Supabase project in Sydney, on Pro**, with point-in-time recovery | supabase.com | Not started. The region cannot be changed later. |
| 1d | **`help@pitchfootball.com.au` forwards to BUZ's inbox.** It is the Reply-To on every email (U-11). | email host | Not started |

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
| `EMAIL_REPLY_TO` | `help@pitchfootball.com.au` |
| `NEXT_PUBLIC_SITE_URL` | `https://pitchfootball.com.au` |
| `TZ` | `Australia/Melbourne` |
| `DIGEST_TO` | `burak.donmez@pitch-football.com` |
| `SMS_ACCOUNT_SID`, `SMS_API_KEY`, `SMS_LONG_NUMBER`, `SMS_WEBHOOK_SECRET`, `SMS_MONTHLY_CAP_CENTS` | **after 1a clears.** `SMS_WEBHOOK_SECRET` is the Twilio **auth token**. Leave all empty until then: SMS refuses cleanly. |
| `STRIPE_*` | **leave empty.** Billing is off until further notice (D-163). |
| `WAITLIST_ENABLED` | `false` once the product front door is on |
| `PITCH_DEMO`, `PITCH_DEV_DB_PORT` | **never set in production.** A production build refuses to start in demo mode. |

## 3 · Leo, tomorrow: the preview rehearsal (never production)

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
2. **Flip the front door on** in the production database, then `curl -sI /`
   must return 200.
3. **Kill switches rehearsed from BUZ's phone:** pause shared links, and
   switch SMS off and back on.
4. **Under-18s** open the day 1a clears (if BUZ chooses to launch adults,
   coaches and clubs first).

## Rollback

- Redeploy `main` (the coming-soon site) in Vercel.
- The database stays. Nothing a family did is lost.
- Flip the front door off.
