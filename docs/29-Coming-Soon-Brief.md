# 29 · Build brief — the coming-soon website

| | |
|---|---|
| **From** | Leo — CTO / Technical Founder |
| **To** | Claude Code |
| **Date** | 3 September 2026 |
| **Scope** | **The pre-launch website. Nothing else.** |
| **Design** | **Build exactly what Claude Design delivered.** One content change only — the pricing. Everything else stays as designed. |
| **Entity** | EBSD Enterprises Pty Ltd · ACN 701 879 718 · ABN 65 701 879 718 · trading as Pitch Football |

---

## 1 · What to build

A **single-page site** at `pitchfootball.com.au`, plus the three small server routes the form needs.

| | |
|---|---|
| **Stack** | Next.js (App Router) + TypeScript, deployed to **Vercel** |
| **Database** | **Supabase, Sydney region** — already provisioned. Personal data resides in Australia (D-29); the region cannot be changed |
| **Email** | **Resend.** From `hello@send.pitchfootball.com.au`, **Reply-To `burak.donmez@pitch-football.com`** |
| **Routes** | `/` · `POST /api/waitlist` · `GET /unsubscribe` · `GET /manage` |

---

## 2 · The design — build it as delivered

**Source of truth: `site/Pitch Website - Coming Soon v2.dc.html`.**
**Specification: `site/README.md`** — 31KB of colours, type, spacing, radii, copy and interaction detail. **Read it before writing markup.**

**Fidelity is high. Recreate it pixel-close.** The interactive pieces — the shooting range, the tactics board, the slide-to-send, the persona switching — are the page's personality and are in scope.

It is a design reference, not production code: rebuild it properly in the target stack rather than copying the prototype's DOM.

### The only content change: pricing

**Already applied to the file you have. Do not revert it.**

> **$54 a month incl. GST, cancel anytime — or $329 for twelve months.**

The design read `$53.90` / `$328.90`, which is `$49 + 10%`. **D-109 sets round, GST-inclusive figures deliberately** — many community clubs are not GST-registered and cannot reclaim a markup, and a price that grows between the page and the card is what D-136 exists to prevent. Both figures appear twice: in the clubs section and in the pricing tier.

### Two repairs that do not change how the page looks

Both are already applied. **Neither alters the design — they stop it breaking.**

**Images.** Thirteen PNGs totalling **39MB** are now **WebP at ~1.4MB**, resized to 1600px. Originals are in `site/assets-orig/`. At 39MB the page is unusable on a phone on mobile data, which is exactly the person it is for. **It looks identical.**

**Three expiring image URLs removed.** The file referenced signed Google Cloud Storage URLs alongside the local assets. **Signed URLs expire** — those images would have 404'd on their own, without anyone touching the page. The local copies were already there and are now the only source.

### Everything else stays

**Including the Founding XI section, in full, as designed.** BUZ's call, made explicitly.

> **Recorded so it is a decision and not an oversight.** Our General Counsel has drafted clause **A5.3** of the terms of service stating that founding-club arrangements *"are agreed individually… and there are no published terms for it."* The page publishes four: a founding mark, a direct line to the builders, first to shape Club Pro, and a cap of eleven clubs. **That is our own website contradicting our own contract**, which is a different thing from a design preference. Leo has raised it three times; BUZ has ruled to keep it. **Build it as designed** and John will be told it is live.

Also unchanged: the statistics shown on the mock cards, the fixture names, and the persona accent colours as Claude Design set them.

---

## 3 · The database — one table

The form has to post somewhere. **One table, and nothing else.**

```sql
create table public.waitlist (
  id             uuid primary key default gen_random_uuid(),
  email          text        not null,
  role           text        not null check (role in ('player','coach','club','parent')),
  created_at     timestamptz not null default now(),

  -- Spam Act: consent must be provable, not asserted
  consent_at     timestamptz not null default now(),
  consent_text   text        not null,   -- the exact words on screen when they submitted
  policy_version text        not null,   -- 'doc@version', e.g. '20@v2.2'
  source         text        not null default 'web',

  -- unsubscribe has to work before the first send, not after
  unsub_token     text       not null default encode(gen_random_bytes(24),'hex'),
  unsubscribed_at timestamptz
);

create unique index waitlist_email_key on public.waitlist (lower(email));
create index waitlist_created_idx on public.waitlist (created_at desc);

alter table public.waitlist enable row level security;
-- No policies. The anon key cannot touch this table.
-- Inserts go through one server route holding the service-role key.
```

**Four rules about it:**

**It is a dead end, not the seed of a user table.** The page says *"being on this list isn't an account, and it doesn't hold a place."* **A waitlist row must never become an account automatically.** At launch these people get one email and sign up like anyone else.

**Nothing about a child is stored.** The form asks 18+ or under 18; if under, it takes a parent's address. **That declaration routes the form and is then discarded.** No column records it. We hold an adult's email, as we would for anyone.

**RLS on, no policies.** The service-role key lives in exactly one route.

**No export endpoint.** BUZ reads the table in Supabase.

---

## 4 · `POST /api/waitlist`

- Validate server-side. Never trust the client.
- **Store `consent_text` and `policy_version` as they were at that moment.**
- **Rate-limit by IP.** This form will be scraped.
- **Identical response whether or not the address already exists** — *"you're already on the list"* is an email-enumeration oracle.
- Never log the address.
- **Send no confirmation email.** The page promises *"nothing before that"*: one email, at launch, and no other.

---

## 5 · `/unsubscribe` and `/manage`

Both take `?t=<unsub_token>`, and **both must work with no account, from any device** — that is what the confirmation state promises.

`/unsubscribe` sets `unsubscribed_at`. **One click. No confirmation step, no retention question.** `/manage` allows a change of email or role.

**These must exist before the first email is sent.** A send without a working unsubscribe is a Spam Act breach.

---

## 6 · The daily digest

One email a day to `burak.donmez@pitch-football.com`, **only when there were signups**:

- New since the last digest, **counts by role**
- Running total, and total unsubscribed
- **No email addresses in the body** — BUZ opens Supabase for that

Vercel cron. **Daily, not per-signup** — a per-signup alert is muted in week two and unread by week three. **If nothing happened, send nothing.**

---

## 7 · Three things that gate the form going public

**The privacy policy and terms must be live first.** The footer links them; they are at `docs/legal/`, docs 20 and 22. **Four placeholders remain** — registered office, privacy contact, appeals contact, publication date. **Do not enable the form until those resolve.** Serve them as real pages, not PDFs.

**Identified sender and a working unsubscribe** on everything (D-64, D-81).

**This page is indexed and should rank.** It is the only Pitch page that should be — every under-18 surface in the product carries `noindex` (D-95).

---

## 8 · CI

A GitHub Action running `python3 scripts/corpus-check.py .` on every push. Twelve assertions that the documents agree with each other. Exits non-zero on failure.

---

## 9 · Out of scope

**Do not build any part of the Pitch application.** No player, guardian, club, coach, registration, CV, permission engine, or schema beyond the one table above. **Phase 1 is a separate build and starting it here prejudges decisions that have not been made.**

**No analytics beyond privacy-respecting aggregate counts.** No Google Analytics, no Meta pixel, no session recording, no third-party tag. A page aimed at football families does not ship a tracker, and every processor has to be named in a privacy policy.

**No third-party form service.** The email goes to our own database in Sydney.

---

## 10 · Environment

Documented in `.env.example` with the reasoning attached; set in Vercel's environment settings. **Nothing secret is ever committed.** The service-role key appears in exactly one route — **assert that in CI if you can.**

---

*Doc 29 · Coming-soon build brief · v1.1 · 3 Sep 2026 · Leo (CTO) · the website only · design as delivered, pricing excepted*
