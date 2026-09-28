# builder: free at launch, and the approved copy goes live (2026-09-28)

Asked: brief `final-A-free-and-approved.md`. Two parts. First, D-163: a verified club's register is active while billing is off, the switch lives in one place, and no price renders anywhere while it is off. Second, make live the copy in `APPROVALS-28-SEP.md`, and only that copy.

Tree: `.claude/worktrees/builder-final-a`, branch `builder-final-a`, cut from `app` at 8ab378a. `app` moved during the work (to 1b3c9d4: D-163 amended, D-165, D-166). I merged it at c42564d; I did not rebase. Every suite below ran on **3ed0e9c**.
- Ports: db 54382, app 3180, CDP 9383. I checked 9373 was not listening before layout.
- I stopped my own processes by port. `.next` and `.next-check` are deleted, and the `node_modules` symlink is restored.
- Free space was 8.0 GiB at the start, 6.7 GiB at its lowest (after layout) and 9.9 GiB at the end. The 1-minute load went to 18.3 once, while the first compile ran; I waited it out before running any suite.

## Did

### 1 · D-163: billing is one switch, off by default

**`supabase/migrations/0075_free_until_further_notice.sql`**
- Adds `app_config.billing_enabled = 'false'` and `fn_billing_enabled()`, which is the only reader. Anything other than the literal `'true'` counts as off, and so does a missing row. A typo in a config change cannot switch payment on.
- Rewrites `fn_register_active`:
  - **Billing off:** the club must be `club_state = 'verified'`, and no subscription column is read.
  - **Billing on:** 0068's rule, byte for byte.
- The off branch checks verification itself. Every current caller already refuses an unverified club, but with billing off the gate would otherwise say "yes" for any club, and a future caller that forgot the check would read children off a claimed page. D-126 is enforced inside the gate as well as in front of it.
- `fn_register_payment_state` gains the value `'free'`. It is returned only after the membership check, so a stranger still gets null. `/home` and `/club/register` draw nothing about money for it: no plan card, no dunning card, no "See the Interest Register".
- D-93's grants are untouched.

**App side**
- `lib/billing.ts`: `billingEnabled()` asks `fn_billing_enabled()`.
- `/club/billing` redirects to `/home` while billing is off.
- `startCheckout` and `openPortal` both refuse before recording anything.
- The Stripe webhook answers 503 before it reads the payload. So doc 15 §31 and §32 stay in the code and never send.
- The "Plan & billing" door is only drawn when billing is on, both in the sidebar (`console-shell`) and on the TD's `/home` rail.
- `PRICES` renders in two places only, `/club/billing` and the admin plan card, and both are behind the switch.

**`/` on `app` (the old coming-soon)**
- It still quoted $54/$329 in two places. `SHOW_PRICING` goes back to `false` (BUZ's own 3 Sep state), and the club-scene price note now sits behind the same flag.
- Its FAQ item "What will it cost?" is **removed**. Its answer promised clubs a paid register "when we open". The approved website answer says "at launch", which D-163 as amended forbids. A replacement is held below.

**Things the brief listed that need no change**
- **The plan choice at claim does not exist in the code.** `/claim/[slug]` has no plan step, so there was nothing to remove. The D-137 tick moves nowhere: it stays on the dormant checkout.
- The demo seed shows no price with billing off: Riverside is still `active` in the seed, but its payment state now reads `free`. `/demo` shows none either. `docs/DEMO.md` already said free.

**`app/dev/billing/route.ts` (new, dev only)**
- POST `?on=1|0` flips the switch for the render and write suites, which cannot reach PGlite. It reads the answer back.
- It returns 404 in production and in a club demo, and answers POST only.

### 2 · The approved copy

- **`email_opened`**
  - `0076_no_open_tracking.sql` drops the word from `consent_event`'s CHECK. It reads the live constraint with `pg_get_constraintdef`, removes that one word and re-adds the rest. It does not restate the list, because the launch-gaps builder owns 0070–0074 and a restated list would silently drop any word they add. It raises if the constraint or the word is not there.
  - The label is gone from `/g/controls`.
  - The `NO_WRITER_BY_DECISION` entry is deleted, and F8h is satisfied.
  - The Resend webhook's comment is corrected.
  - `ctl5/ctl6` now read the vocabulary from the database, not from 0002's text. 0002's list still says `email_opened` and would have demanded a line for a word the database now refuses (L33).
- **Who looked**
  - `WHO_LOOKED_APPROVED = true`. The gate line stays, so un-approving is still one line.
  - Rows show `reportRef(id)`: the first 8 hex digits in capitals, e.g. "report 3F9A21C0". The full uuid appears nowhere, including the `data-look` attribute, which used to carry it.
  - The footer reads `SUPPORT_EMAIL`.
- **One contact address**
  - New `lib/support.ts` exports `SUPPORT_EMAIL = 'burak.donmez@pitch-football.com'`.
  - It is a literal, not an environment variable, for the reason `.env.example` already gives: copy that changes with the environment is copy nobody reviewed.
  - `lib/messages.ts` sets `HELP = SUPPORT_EMAIL`. That is one line plus an import, kept inside my own block.
  - The address now comes from the constant on `/join` (3 places), `/a/[id]/done`, `/claim/[slug]` (2), and `WhoLooked`.
  - Doc 15: all 20 occurrences are replaced, and rule 6 names the address and the constant.
  - `.env.example`'s comment is corrected.
- **Ops call sheet:** the approved label, the three options and the note are live. The posted values are unchanged. The **six Technical Director strings were already live** (builder-td-wall shipped them in `0060`'s screens). I checked all six against its report, verbatim, and changed nothing.
- **Squad screen:** `SOURCES_SAID_HERE` now names all three sources. The set stays, so a fourth source stays off that screen until it is approved.
- **Under-16 funnel lines** (`0077_early_funnel_joins_the_log.sql`)
  - `message_outbox.invitation_id` is new.
  - `sendAndLog` and `send` carry the invitation: in the approval request (`lib/guardian-flow`), the operator resend and the day-10 nudge.
  - `fn_record_delivery` copies the invitation onto the delivery row.
  - New table `consent_event_link (event, child, invitation, linked_at)`. It is append-only, using the same trigger function as `consent_event`, and has RLS on.
  - A trigger on the `approved` row links the invitation's **subjectless** rows written before that approval. It links only the nine funnel words and only for an **under-16** invitation (`pending_invitation.child_id is null`). Nothing is rewritten: those rows keep `subject_id = null`.
  - `fn_consent_timeline(viewer, person)` is the one read. The viewer must be the person or an approved, unrevoked guardian, the same wall as `fn_who_looked`. The controls page now reads it.
- **Doc 15 §32:** "one reminder at day seven, one at suspension" is out, with a dated note. This is a doc edit only.

### 3 · The suites

- **Perms:** `billingOn()` wraps the Stripe-build blocks (§M, D-153, SQ18–19, the 0063/0068 money block). Everything else runs with billing off, which is the launch configuration.
- **Render and write:** `billingSwitch()` does the same through `/dev/billing`. The `/club/billing` sidebar checks moved into the billing-on block, as b15 and b15b.

## New checks, each proven red with its bug put back (L19, L20)

| Bug put back | Went red |
|---|---|
| Billing on by default | free0 |
| Off branch returns `true` for any club | free1, free1c, free1d |
| Gate ignores the switch (0068's body) | free2, free2b, free2c, free2d, free1c, free1d; render free-r4, free-r4b, free-r1 ("$54 a month" on the admin home), free-r3, free-r6, free-r6b |
| Payment state without `'free'` | free3, free3c; with the switch ignored as well: free4 (and money1–5) |
| Switch read loosely (`TRUE`, `yes`, `1`, `on`, ` true`) | free0b ×5 |
| `fn_register_count` returns 0 | free1b (and the existing D-126 checks) |
| Page gate / action gate / webhook gate removed | free5, free5b, free5c; render free-r2 ×4; write bw0 |
| Sidebar and home door unconditional; admin plan card not gated on `active` | free5d, free5e; render free-r3 ×5, free-r6 |
| Sidebar never shows the door; TD rail card hidden | render b15 ×2, b15b |
| Held register branch disabled | render free-r5 |
| `SHOW_PRICING = true` | render free-r1 (`/`, every seat) |
| 0076 removed | D-78c2, ctl6 |
| Label put back | D-78c3, F8f |
| `HELP` typed as the old address | support1, support3, support4, support5; write support-w1 |
| A new message builder that throws | support2 (39 of 40) |
| `/join` types the new address literally | support6 |
| `data-look` / row back to the uuid | who1; render r5c, r5f |
| `reportRef` 12 characters | who2 |
| Footer typed as the old address | who3, support5; render r5g, support-r1 |
| Link trigger dropped | funnel1, funnel1b; write funnel-w2, funnel-w3 |
| No event filter, no under-16 restriction | funnel3, funnel6 |
| Timeline without the guardian wall | funnel4, funnel4b |
| Link table's immutability trigger dropped | funnel5 |
| Trigger rewrites `consent_event.subject_id` (immutability dropped) | funnel2 |
| `limit 5` in the timeline | ctl3 |
| Writers stop carrying the invitation | funnel7 |
| Dev route unguarded | dev1, J53 |
| Old squad label set | copy-held2 |
| Pin at 0 | render free-r1c (10 lines) |

**Three of my checks could not fail when first written.** I found each one by putting its bug back, and fixed each in its own commit:
- `free0` read a value a later block had restored. It now reads the value at boot (a51df0b).
- `support-w1` searched HTML in which `/dev/outbox` splits "help@" from its linked domain. It now strips the tags first (756f28a).
- `b15b` found the billing door in the sidebar, not in the TD's rail. It now removes the navs before looking (373b05f).

## Ran (on 3ed0e9c, fresh seed, TRAINING §4 order)

| Suite | Result | Change from `app` |
|---|---|---|
| perms | **1523/1523** | 1477, +46 |
| render | **533/533** | 526; +23 added, −16 billing-sidebar checks moved to b15/b15b |
| write | **375/375** | 369, +6 |
| layout 375/1280 | **ALL GREEN, 192 views** | CDP 9383, after a reseed |

- tsc: exit 0
- palette: ALL GREEN
- corpus: 0 failures, 0 warnings
- gate-coverage: 260/262. E9 and E10 are open, as on `app`.
- secret-scan: clean
- validate-migrations: ALL GREEN
- `build:check`: exit 0

## Found

1. **`/terms` still states prices: 10 lines** of doc 22 (A6.1's $54/$329, A5.1's $329 cooling-off, the $2,000 floor and the $100 million cap).
   - This is John's question (doc 36 item 1), and I did not touch a legal document.
   - The render price check exempts `/terms` by name and pins the count at 10 (`free-r1c`). Any new dollar line fails, and when John's Schedule A lands the pin has to drop.
   - **This is the one place the brief's "any page in the render suite" is not literally met.** Leo, it is your call whether that exemption stands.
2. **The bare-wake SMS (§24) grows from 160 characters to 166, so from 1 segment to 2.** The new address is 6 characters longer.
   - Measured on every SMS in the catalogue: the others stay at the segment count they already had (§1: 278→284, 2 segments).
   - §24 is the message that goes most often, so this doubles its cost against D-81's cap. BUZ's address, BUZ's call.
3. **Reply-To still points at the old inbox.**
   - `EMAIL_REPLY_TO` is documented as `help@pitchfootball.com.au`, and U-11e asserts it is "the support inbox, not a person". A reply to any email therefore goes to help@, while the body now says burak.donmez@.
   - The brief listed screens, bodies and SMS, not the header. Changing it means rewriting U-11e's premise, so I left both as they are.
   - `CLAUDE.md`'s env block also still says `SUPPORT_EMAIL=help@…`. I did not edit `CLAUDE.md`.
4. **`email_opened` is still named in two documents:** `CLAUDE.md` §8 and register D-78. The register moves only by BUZ's call.
5. **`docs/DEMO.md:100`** says "Everything is free at launch", which D-163 as amended forbids.
6. **Sentences about paying that no longer describe anything while billing is off:**
   - the held register: "Paying doesn't change it and can't."
   - the ops call sheet: "they flag the subscription, not the safety check".

   They name no price, and removing words is still copy, so I left them.
7. **An operator cannot look up a short reference.** `/ops/reports` shows no reference, so a parent quoting "report 3F9A21C0" has to be matched by hand. It needs a lookup, or the same reference on the ops queue.
8. **The 16–17 funnel has the same gap, and decision 8 does not cover it.**
   - `invite_created` and the two confirmations carry no subject for a teen either, so they are missing from a teen's log.
   - The operator resend never passes the teen's `child_id` as the subject.
   - I linked nothing for 16–17s.
9. **Some funnel rows will not attach:**
   - A delivery receipt that arrives **after** approval carries the invitation but is not linked. The trigger fires once, at approval.
   - Invitations already open when 0077 ships have send and receipt rows with no invitation id. Only `invite_created`, the landing, the confirmations and the nudge attach for those.
10. **`components/FailureState.tsx` is still marked "AWAITING BUZ".** Its 404 and 500 copy is approved in APPROVALS. It was not in my brief.
11. **`/preview/site`** (dev-only, 404 in production) still renders $54/$329. The render suite fetches it for A19, but it is outside the crawl and outside my check.
12. **`/join`'s club-line address is invisible to the render crawl.** It sits in a client-rendered branch, so only the static checks `support5` and `support6` cover it.

## Copy for BUZ

**Live now, as approved** (APPROVALS-28-SEP), verbatim:
- **Who looked**
  - Heading: "Who at Pitch has looked at {Name}’s record"
  - Empty state: "Nobody at Pitch has opened {Name}’s record."
  - Fallback name: "Someone at Pitch"
  - Row: "Looking into a report · {what}"
  - Row date: "{date} · report {REF}". **REF is my format under your default:** the first eight characters of the report id, in capitals, e.g. "report 3F9A21C0".
  - Footer: "Somebody at Pitch can open a child’s record only while a report about it is open, and only for as long as that report is open. Every time one of us does, it is written down here and it cannot be edited or removed. Ask us why at burak.donmez@pitch-football.com and we will tell you."
- **Ops call sheet**
  - Label: "Why — recorded only when the outcome is suspended or takedown. It decides whether families are told."
  - Options:
    - "A child-safety reason — families are told"
    - "Administrative — paperwork, officials, a claim nobody recognised"
    - "Non-payment"
  - Note: "Choose the child-safety reason only for a child-safety reason. Every family holding a live link they sent to this club is emailed once: that the club is no longer verified, nothing about why, and a button that switches their own link off. We do not switch it off for them. The other two reasons end this club’s access and tell nobody."
- **Squad screen:** "Coach-verified" and "Official import".
- **Contact address:** "burak.donmez@pitch-football.com" replaces help@ in every doc 15 message and on `/join`, `/a/[id]/done`, `/claim/[slug]` and the who-looked card. The surrounding words are unchanged.
- **Removed:** "You opened that email".

**Removed with no replacement** (D-163; removals, no new words):
- The coming-soon pricing section
- The coming-soon line "Interest Register: $54 a month, cancel anytime — or $329 for twelve months."
- The coming-soon FAQ item "What will it cost?"

**Doc 15 wording** (a doc, not a screen):
- Rule 6 gains: "The address is burak.donmez@pitch-football.com — BUZ, 28 Sep: his direct address is the one contact a user sees, replacing help@ in every message here. It comes from one constant (`lib/support.ts`)."
- §32's "Never" line now ends "…or a second channel. One email." It is followed by: "Amended 28 Sep (BUZ, decision 9 in `docs/team/APPROVALS-28-SEP.md`). This section used to promise "one reminder at day seven, one at suspension". Neither was ever written, so the promise comes out until wording exists and goes to BUZ. §31 and §32 are dormant anyway: billing is off until further notice (D-163), and neither message sends while it is."

**Held, not live:** the coming-soon FAQ answer to "What will it cost?". This is your approved website answer with "at launch" taken out, per D-163 as amended:
> "Everything is free for everyone: players, coaches, club pages and the Interest Register. Players under 18 are free, and that won’t change. We may add paid options for adults and clubs later, and we’ll tell you before anything changes."

## Risks

- **Migration 0076 depends on how Postgres prints the constraint.** It assumes `pg_get_constraintdef` prints `'email_opened'::text, `. That held on PGlite. If Supabase prints it differently, the migration **raises**; it does not silently do nothing.
- **Merge overlap with the launch-gaps builder.** Shared files: `lib/messages.ts` (the `HELP` line, one import, one comment), `lib/messaging.ts` (`send`/`sendAndLog` signatures, the outbox insert) and `scripts/permission-tests.mjs` (new blocks, and edits to ctl3, ctl5, J53, F8, copy-held1/2 and §A6). Doc 15's address replacement touches every section that carries the address, including §4 and §9 if they carry it.
- **A suite aborted mid-block leaves billing on** in the dev database. The next reseed clears it.
- **Webhook refusals while billing is off.** If Stripe is ever configured and billing is later switched off, Stripe retries the 503s and may disable the endpoint.
- Not checked:
  - the Supabase-hosted Postgres form of 0076
  - a real Resend delivery receipt carrying `invitation_id` end to end
  - the 1024 breakpoint (layout ran at 375 and 1280, as TRAINING asks)

## Lesson

A check that switches state has to read its answer before the rest of the suite moves it, and a check that reads a rendered page has to read what the reader sees. Three of my own checks passed against the bug they were written for: one read a switch a later block had reset, one searched HTML the dev inbox had split, and one found a door in the sidebar rather than in the rail it was about. None of them showed anything wrong until the bug was put back, which is why putting the bug back is not optional.
