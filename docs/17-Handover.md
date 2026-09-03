# 17 · Handover to Claude Code — start here

> **You are building Pitch.** This is the first thing to read. It will take four minutes and it will save you from the six mistakes this codebase is most likely to invite.
>
> Written by Leo (CTO) for the first build session, 25 August 2026. **Revised 27 August** — the product changed substantially that day and this file said several things that are now the opposite of true. If you are reading a copy without a §0 in `CLAUDE.md`, stop and find a newer one.

---

## 1 · What you are building, in five lines

**Pitch is a player development and pathway platform for Australian football.** A player — often a child — owns a living record of their football: their CV, their season, eventually their coach-verified development. Clubs and coaches can see it when they are allowed to. Nobody can contact a child directly, ever.

**There is no launch date.** A soft launch, as early as we can honestly do one: no marketing, a small warm network of families and clubs, to find the bugs before anyone is watching (D-131). **The gate is unchanged and it is not a date** — doc 14's permission suite is green or we do not go (D-47). If the suite is not green, the paid tier gets cut rather than the launch being kept (D-113). **Quiet is not a lower bar.** A failure with ten families is the same failure; it is simply one nobody writes about.

**Phase 1 is seven things.** The player CV · the club page, whose job is posting trials · the coach CV · a player sending their CV to a club by link · a coach sending their CV by link · **the Interest Register** · **the guardian-side invitation path**. Behind them sits the guardian consent spine, which is the legal floor and is never cut.

**The two send-links are still the point.** A player emails a Pitch link to a club as part of a normal application; a technical director opens it in the exact moment he is assessing players; that is how clubs arrive on Pitch, rather than being sold to. **They are free and they stay free** — the safe thing is the free thing, deliberately (D-129).

**But the Interest Register now ships too, and it is what a club pays for** (D-108, D-130). A player registers interest in a **club**; a trial is a tag on that registration, never a separate object; the club works a filterable year-round list. **$54/month or $329/year, both inc GST, Stripe, card only** (D-109 as amended, D-112, D-148). An earlier version of this file told you not to build it. That instruction is dead — see `CLAUDE.md` §0.

**The founder is BUZ.** He starts a full-time job shortly. He has evenings. Respect that in everything you propose.

---

## 2 · The one thing that makes this project different

**Most of your users are children, and about half of the design decisions in this repo exist to protect them.**

That has a practical consequence for you: **when something is ambiguous, the answer is not "pick the sensible default."** The sensible default is usually wrong here, because the sensible default was designed for adults. A 404 that differs from a 403 is fine in most products and is an information leak in this one. A friendly "this link has expired" message is good UX everywhere else and is a privacy failure here.

So: **if a behaviour is not specified in doc 06, doc 14 or this file, stop and ask BUZ. Never invent product behaviour, and never, ever invent it for anything touching a minor.**

That is not caution for its own sake. It is the single instruction that matters most in this repo.

---

## 3 · What to read, in this order

| Order | Doc | What it is | When you need it |
|---|---|---|---|
| 1 | **This file** | Orientation | Now |
| 2 | **`CLAUDE.md`** (doc 10) | The build brief — stack, architecture rules, invariants, scope, build order | Before any code |
| 3 | **doc 14** — Permission Test Spec | ~120 enumerated permission cases + a negative suite. **This is the launch gate.** | Before writing the permission layer, which is first |
| 4 | **doc 16** — Football Reference | Positions, stat catalogue, the three house fixtures as complete data | Day one — fixtures come before screens |
| 5 | **`design-screens/`** | **Seventy-five signed screens**, six sections (five personas plus pre-launch), plus `canvas.json` and `walk-the-pitch.html` — open that one in a browser and click through every journey. Source of truth for every launch screen | When you build UI |
| 6 | **doc 15** — Message Copy | Every email, SMS **and in-app club message** the product sends, written out | When you wire messaging |
| 7 | **doc 06** — the Register | **148 numbered decisions**, 142 locked and only six unresolved. The single source of truth. **Start at D-102 to D-148 — they are the 27 August re-scope and several of them reverse older decisions** | Whenever you need to know *why* |
| 8 | **doc 09** — Stage 0 Foundations | The object model and the schema delta. **v1.3 — read §⓪ first**: six objects joined on 27 August (`registration`, `club_state` + `verification_call`, the approved/pending pair, `invitation`, `subscription`, `share_card_approval`) and where §⓪ disagrees with anything later in that file, §⓪ wins | When designing tables — which is before almost everything |
| 9 | **`legal/`** | The legal pack, and **`legal/00-Legal-Register.md` first** — it says which document is authoritative, what version, where each one renders, and the version-stamping rule consent depends on. Docs 20, 21, 22, 24 and 25 are **rendered surfaces, not background**; doc 23 is a specification (every deletion job implements a row of it) | When you build the legal pages, the consent log and the deletion jobs |

**Everything else has been archived out of your way.** The background docs written before decisions moved (00–05, 07, 08, 11, 12), the whole Board Room, and the legal pack now live under `_archive/` and are **not in your repo at all**. If someone hands you a document that is not in the table above, it is not spec — check it against the register before you act on a word of it.

**One in particular: do not read `04-Stage1-UI.html` as a design.** It describes five earlier screens and it contradicts the signed ones. `design-screens/` is the design.

**And there are superseded screens inside `design-screens/` itself**, under `_superseded/`. They are kept for history and they are not spec. If a screen exists in both places, the one in the top-level folder wins.

---

## 3b · What goes in the repo — and what deliberately does not

The Pitch 3.0 folder is BUZ's working archive. **The repo is a curated subset.** Copy in exactly this:

| From the folder | Into the repo as | Why |
|---|---|---|
| `10-Build-Brief-CLAUDE.md` | `CLAUDE.md` at the root | The build brief. Claude Code reads it automatically. |
| `17-Handover-to-Claude-Code.md` | `docs/17-Handover.md` | This file. |
| `06-Design-Decisions-Register.html` | `docs/06-Register.html` | The source of truth. |
| `09-Stage0-Foundations.html` | `docs/09-Data-Model.html` | The object model. |
| `14-Permission-Test-Spec.md` | `docs/14-Permission-Tests.md` | The launch gate. |
| `15-Message-Copy.md` | `docs/15-Message-Copy.md` | Every message that sends. |
| `16-Football-Reference.md` | `docs/16-Football-Reference.md` | Positions, stats, fixtures. |
| `05-Australian-Compliance.html` | `docs/05-Compliance.html` | Background for the safety architecture. Not a spec. |
| `27-Club-Verification-Call.md` | `docs/27-Verification-Call.md` | **The operator protocol behind D-126.** Its thirteen log fields are the schema for the verification record — build the table from this file. |
| `legal/` **(whole folder, minus `_superseded/`)** | `docs/legal/` | The instruments. **Read `00-Legal-Register.md` first** — it names the authoritative version of each, where it renders, and the `doc@version` stamping rule. Docs 20, 21, 22, 24, 25 are rendered; 19, 23, 26 are internal specs; **doc 23 is a spec, not a policy — every deletion job implements a row of it.** |
| `design-screens/` | `design-screens/` | All seventy-four, whole, minus `_superseded/`. |

**Do NOT copy into the repo:**

- **`13-Board-Room/`** — the executive team's working files. It is full of **drafts, superseded positions and arguments that were later overruled**: a pricing term sheet that is explicitly not confirmed, a recommendation to delete a product line that BUZ then reinstated, scope proposals that were cut. Every file in there is a proposal, not a decision. **If you read it as specification you will build things that were rejected.** Decisions live in doc 06 and nowhere else.
- **Docs 00–04, 07, 08, 11, 12** — background and stale, per above.
- **`_to_delete/`** — exactly what it says.
- **`PROJECT-INSTRUCTIONS.md`** — BUZ's own working notes, not build input.
- **`content/`** — Anna's social content and lexicon. Marketing, not product.
- **`pitch-3.0-project-pack.zip`** — an old archive of the folder.

**The rule underneath all of that:** a decision is only real if it is in doc 06 with a D-number. Anything else you find — a memo, a draft, a board record, a note in a folder — is someone thinking out loud, however confident it sounds.

**Decisions are cited everywhere as `D-xx`.** When this repo says "D-70", it means decision 70 in doc 06. If a doc and the register disagree, **the register wins** and you should tell BUZ the doc is stale.

---

## 4 · Your first session, in order

1. **Repo, deploy pipeline, Supabase project — Sydney region.** Not the default region. Personal data resides in Australia (D-29).
2. **`.env.example` from the list in `CLAUDE.md`.** Nothing secret ever committed.
3. **The three house fixtures from doc 16 — before any screen.** Deniz (14, attacking midfielder), Nate (17, goalkeeper), Georgia (15, U16 Girls). They are the test data every screen is built against. Building against Deniz alone means you discover the goalkeeper layout and the girls' club rows in the last week, which is exactly when there is no time to fix them.
4. **The schema, per `CLAUDE.md`'s "25 August schema delta".** Nine numbered items. Get these right in the first migration — three of them are catastrophic to retrofit and free to do now.
5. **The permission layer, enforced in Postgres, with exactly one tokenised read path.** Then doc 14's tests, running against the database.
6. **Only then, UI.**

**The gate:** the permission suite in doc 14 is green, or we do not launch. That is a decision already made (D-47, restated 27 Aug as D-131) — it is not to be re-argued under pressure, and it is not something to work around by loosening a test. **There is no date to trade against it any more**, which removes the usual reason people quietly weaken a gate.

**Doc 14 has grown to 243 rows across sections A–R**, including a ten-condition gate. Three of those conditions were added on 27 August and one of them — **M4, that no automated path can set a club's `verified` flag** — is the single row that, if it fails, means a card payment is all that stands between an adult and a child's details.

---

## 5 · Ten things you will be tempted to do. Don't.

These are not hypothetical. Each is the obvious, competent, industry-standard move — and each is wrong here for a specific reason.

**1. You will reach for Row Level Security to protect the share link. It cannot express this.**
The tokenised link must work for a stranger with **no session**. RLS has no clean way to say "no session, but this bearer token grants read of exactly this one record." What you actually need is one server route holding the service-role key — and that route becomes the single place on earth where a child's record can leak. So: **exactly ONE such route** (not one per surface), **the service-role key appears nowhere else in the codebase**, permissions are computed in a Postgres function so the app cannot route around them, and the tests run against the database. See D-80 and doc 14 §J3.

**2. You will want to return a helpful message when a link is dead. Don't.**
Expired, revoked, guardian-disabled and never-existed must return **identical copy and identical response timing**. A different message — or a measurably different response time — tells a stranger whether a given child exists on Pitch. That is an existence oracle, and it is the exact thing the 90-day expiry was designed to prevent. Same rule for rate limits: hitting the request-access limit returns the same response as succeeding. See D-77 and doc 14 §C7, §E10.

**3. You will want to store the age band, or an `is_visible` flag. Never.**
Every permission derives at read time from age band + guardianship state + membership + verification. A stored flag goes stale on a birthday, and birthdays here are legal state transitions, not cosmetic ones. **There is no `is_visible`, `can_view`, `is_public` or stored age band anywhere in this system**, and doc 14 §J1 asserts their absence.

**4. You will want to add stat columns to the profile table. They are rows.**
`player_stat` keyed by `stat_key`, with the catalogue in TypeScript. Four columns would mean that from launch day every real family writes into a shape that physically cannot express "clean sheets" — and the fix becomes a live-data migration across children's records, under a public page, in December. Three hours now; a week later. See D-70.

**5. You will want to use Supabase phone-OTP as the second verification factor. It will cost you three days.**
It collides with the email identity and you will spend the time fighting account linking and rate limits. Supabase Auth is for **session only**. Model verification yourself with a `verification_challenges` table the permission function reads. See D-80.

**6. You will want to write copy. It is already written.**
Every message the product sends is in **doc 15**, word for word, including the guardian approval SMS — which is the first thing a parent ever sees from us and was written very deliberately. **If a message is not in doc 15, it does not send.** Same for screens: `design-screens/` is the source of truth, match it faithfully, do not restyle, do not "improve" it. Same for seed data: doc 16 has all three fixtures in full. Nothing here needs lorem ipsum.

**7. You will let something automatic set a club's `verified` flag. Nothing may.**
Not a successful payment, not a claim code, not a domain match, not a backfill job, not a webhook. **`verified` is set only by an operator action that carries a human's name, a timestamp and the answer to the authority question** (D-126, D-137). BUZ makes the phone call himself. The reason this is stated so hard: it was nearly not true. Screens were drawn showing "Verified club" badges before anything could set the flag, and the only remaining gate would have been a card that cleared. **Payment is not a safety control.** Doc 14 §M4 asserts it.

**8. You will treat a suspended subscription as a reason to delete. It never is.**
A club's card fails, Stripe retries, we grace for fourteen days, then the register is **suspended** — registrations hidden from the club, not destroyed. Deletion runs only on cancellation, thirty days later (D-135, doc 14 §O4/O5). The sentence to keep: **a family's child is never deleted because a club's card expired.** A commercial mechanism must not be able to reach a child's record.

**9. You will render the live page for an under-16 with a pending edit. Render the approved one.**
An under-16 record has an **approved version and a pending version** (D-119). A club holding a link always reads the approved one. The page never blanks while an edit is pending, and **no timeout ever publishes a pending version** — silence keeps the last approved page live, indefinitely (doc 14 §R7). Build the reminder you are about to build, and doc 15 §30 becomes a lie.

**10. You will add a `declined` status to a registration, because every list like this has one.**
There are exactly three club-side statuses and none of them is a verdict. **`declined`, `rejected` and `unsuccessful` cannot be written, and the words do not appear in the product for any actor on any surface** (D-108 extending D-85). This is not tone policing: an interest register with no decision owed is what keeps us out of the Online Safety Act's feedback-feature analysis. It is load-bearing, and it is asserted in doc 14 §N10.

---

## 6 · Hard rules, in one place

Violating any of these is a critical bug regardless of what else the code achieves. The full list is `CLAUDE.md`'s pillar zero (sixteen invariants); these are the ones you will brush against most often.

- **No under-16 appears in any search surface.** There is no search for U16s at all — assert it at the query layer, not the UI (D-53).
- **No DMs to a minor, ever.** No message endpoint accepts a minor as a recipient (D-21).
- **An under-16 profile does not exist until a guardian approves it.** A pending invitation holds first name, DOB and guardian contact only, and purges itself after 14 days (D-17).
- **No negative statistic on a minor's public CV** — no goals conceded, no errors, no cards. Clean sheets are fine (D-67).
- **No premium, price or payment element on any under-18 account** (D-82).
- **A WWCC number is never rendered, logged, or returned by any API** — only a boolean verified state (D-53).
- **No geolocation. No behavioural analytics on minors** (D-25).
- **Support tooling cannot read a child's record** — invitation state and resend only (D-79).
- **`experience_entry` grants access to nobody, ever.** It has no foreign key to a club and never enters the permission engine. This one carries a mandatory test (D-72).
- **Banned words, checked in CI:** "potential", "insights", "struggling" appear nowhere; "elite" on nothing under U13; "talent identification" on nothing under 10 (D-85).
- **Every age transition evaluates in `Australia/Melbourne`**, never UTC (doc 14 §G9).
- **Pitch never sends a minor's record to anybody — the family does** (D-99). No bulk send, no saved recipients, no scheduled or system-initiated send, no PDF or file attachment on an under-18 record, and no send path that does not have a live human of the right age at the keyboard.
- **No "share with a player" affordance exists, under any label** (D-100). It will not arrive as a bad decision; it will arrive as an obvious one.
- **The coach link and the player token share no implementation** — stable-and-public versus tokenised-and-expiring. One shared resolver breaks the safer of the two (D-100, doc 14 §J39).
- **Under-18 pages carry `noindex`/`nofollow` and appear in no sitemap** (D-95). We tell parents no search can find their child.
- **Third-party embeds are click-to-play façades** (D-97) — nothing loads until the viewer presses play.
- **Never state or imply that Pitch verifies age** (D-96), in any copy, anywhere. We ask; a guardian confirms on two channels; a club later corroborates.
- **No fact about a person under 18 reaches a club that is not `verified`.** A claimed-but-unverified club has a page and can post notices; registrations arriving before verification are **held**, and the club sees a count and nothing else (D-126).
- **Revocation empties the note in the same transaction.** The structured note lives on the registration row, not behind the token — killing the link does not touch it. "Nothing readable survives" is only true if the note is emptied atomically (D-128, doc 14 §N7).
- **No export, download or CSV exists anywhere.** Not for a club, not for an admin, not behind a flag. Route enumeration must return nothing that serialises more than one registration (D-122, doc 14 §N12).
- **No club-to-player message exists outside the guardian path.** This is a route-enumeration property, not a permission check (doc 14 §P11).
- **A club's approach reaches a family as a bare wake** — no name, no club, no message — and the substance stays inside Pitch (D-117, doc 15 §24). **Ignoring it produces no state the club can see**: no "seen", no "pending", no counter (D-138).
- **No school field on any under-18 CV** (D-114).
- **Free clips are ten under 18 and three at 18+** (D-120). It looks like a bug and it is not; it has been "corrected" once already. See doc 16 §3c.
- **PDF export is free on every tier**, players and coaches (D-121). Do not draw a lock on it.
- **Stripe is hosted Checkout and the hosted Customer Portal only — never embedded card fields.** That is what keeps us at PCI SAQ-A. Subscription state is a flag written **only by webhook**, and the permission check reads that flag and nothing else (D-112). **No billing surface is reachable from any player, family or under-18 view**, including portal links and Stripe receipt emails (D-82, D-88).
- **Stripe never receives child data** (doc 14 §O10).
- **`club_admin` cannot read a development record. Ever, by any path.** A club administrator is a registrar/treasurer role — the club page, squads, memberships, notices. Club-wide development access belongs to `technical_director` only, and TD is granted by the club, never self-declared (D-93).

---

## 6b · Security is a build principle here, not a phase (D-94)

`CLAUDE.md` has the full posture. The part to carry in your head while writing anything:

**The attacker to design against is not a stranger with a zero-day. It is someone who was legitimately sent a child's share link and now wants more than they were given** — a coach at a rival club, a parent, an agent. That person exists in real numbers. Design for them and the exotic threats mostly take care of themselves.

Four that will bite in this specific codebase:

1. **Referrer leakage.** A minor's CV has a token in the URL and embeds third-party video. Without `Referrer-Policy: no-referrer` the browser hands a working token to YouTube's servers. Check it in the network tab, not in the code.
2. **The OG image endpoint** must re-check the token every request — platforms cache that card more or less forever.
3. **All free text is hostile.** "About", org names, alumni entries, club philosophy. Escape on output; never `dangerouslySetInnerHTML`.
4. **Never trust the client for id, role, age, provenance or club.** Derive every one of them server-side.

**When a security decision is unclear, take the more restrictive option and say what you chose.** Nobody here will be annoyed that you were careful.

---

## 7 · How to work with BUZ

- **He approves anything user-visible before it ships.** Propose, don't surprise. This is his standing rule and it predates you.
- **When a decision needs changing, name it by D-number and take it to him.** The register moves first, then the code — never the reverse.
- **Do not soften a decision to make an implementation easier.** If a locked decision is genuinely blocking you, that is a conversation, not a workaround.
- **He is not a full-time founder.** A question that could have been answered by reading doc 06 costs him an evening. A question that genuinely needs him is always worth asking.
- **Tell him plainly when something is late or won't fit.** The cut line (D-74, D-75) exists precisely so scope bends instead of dates — using it is expected, not a failure.

---

## 8 · What "done" looks like

**Foundations (first block).** A parent can approve a child, end to end, and every step is logged. The permission suite runs against the database and is green. `experience_entry` grants nothing to anyone — proven by a test. The 17-year-old goalkeeper fixture renders correctly across the full 16–17 band.

**The player CV (second block).** This is the week that has to be beautiful. The public CV page is the product, the marketing and the acquisition engine at once. The bar is a single question: **would a 16-year-old proudly send this to a club?** Everything else in the build can be merely good. This cannot.

**Breadth (third block).** Coach CV with PDF export, claimed club page, curated trials board, consent-funnel instrumentation, support console.

**The register and the money (fourth block).** A player registers interest; the registration is **held** until BUZ has verified the club by phone; a verified club opens a filterable year-round list; a guardian revokes and the row goes withdrawn and the note empties in the same transaction. Then Stripe: hosted Checkout, hosted Portal, the webhook as the only writer of subscription state, a failed card that suspends and never deletes. **Done here means doc 14 sections M, N and O are green** — not that a payment succeeded once.

**Shakedown.** Real families run the full flow unaided, on real handsets across Telstra, Optus and Vodafone. Not a simulator — the SMS in-app-browser problem only appears on real phones.

---

## 9 · One last thing

The hardest part of this codebase is not technical. It is that a lot of the work looks like over-engineering until you remember who it is for.

An identical-timing error page, a permission function in Postgres rather than in the app, a test that asserts a column *doesn't* exist — none of these would survive a code review at a normal startup. They are here because the person on the other side of the query is often twelve years old, and because everything else in this product is built on families believing we meant it.

If you find yourself about to simplify one of them, that is the moment to ask.

— Leo, CTO

---

*Doc 17 · Handover to Claude Code · **v1.1 · 27 Aug 2026** · written from register **v4.1 (D-01 – D-148)** · read this first, then `CLAUDE.md` — and read `CLAUDE.md` §0 before anything below it.*

*v1.1 removes the launch date, removes the instruction not to build the Interest Register, adds the legal pack to the repo set, adds four temptations (verification, suspension, the pending version, the declined status) and twelve hard rules, and corrects the screen count from fifteen to seventy-four.*
