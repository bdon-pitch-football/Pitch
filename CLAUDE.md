# PITCH — Build Brief (CLAUDE.md)

> **Version:** built from **Design Decisions Register v4.1 (D-01 – D-148), 28 Aug 2026**. If the register is newer than this line, re-read it first.
>
> **READ §0 BELOW BEFORE ANYTHING ELSE.** Forty-seven decisions were made on 27–28 August and several of them reverse things stated further down this file. Where §0 and a later section disagree, **§0 wins** and the later section is stale.
>
> **START WITH DOC 17.** `17-Handover-to-Claude-Code.md` is the orientation — what you are building, the six mistakes this codebase invites, and the order to work in. Four minutes. Read it before this file.
>
> **Then these four. They are not background — they are the spec.**
>
> | | |
> |---|---|
> | **doc 17** — Handover | Orientation. Read first. |
> | **doc 06** — the register | The single source of truth. Every decision, by number. |
> | **doc 14** — Permission Test Specification | **The definition of the launch gate.** ~120 enumerated cases plus a negative suite. If a permission question is not answered here, ask BUZ — do not decide it. |
> | **doc 15** — Transactional Message Copy | Every message the product sends at launch, written out. **If a message is not in doc 15, it does not send.** |
> | **doc 16** — Football Reference | The closed position list, the stat catalogue, and the three house fixtures as complete data. |
> | **`legal/00-Legal-Register.md`** | Which legal document is authoritative, where each renders, and **the `doc@version` consent-stamping rule: a published version is immutable, retained forever, and a material change re-asks the guardian.** |
>
> **What this file is:** the repo-root brief for Claude Code. It distils the Pitch 3.0 design docs (00–09, in BUZ's "Pitch 3.0" folder) into build instructions. The **Design Decisions Register (doc 06)** is the single source of truth — decisions are cited here by number (D-xx). If something isn't covered here or in the register, ask BUZ; never invent product behaviour. 🔒 decisions are settled unless BUZ explicitly reopens them.

---

## The company in three lines

- **Mission (D-01):** *Pitch is where football's people prove who they are. We give everyone in the game a living record of their development, a network that sees it, and a stage for what they've achieved.*
- **Positioning discipline (D-03):** Pitch is a **player development and pathway platform** — never described as a social network, anywhere: page titles, meta tags, app manifest, marketing copy, code comments that might leak into public view.
- **Market:** Australia — Victoria + NSW first (D-04). Australian spelling in all UI copy.

## §0 · What changed on 27 August — read this first

Forty-seven decisions (D-102 to D-148). Where this section and anything later in the file disagree, **this section wins.**

### The six things that are new product

| | |
|---|---|
| **The Interest Register ships in Phase 1, and it is paid** | D-108, D-130. A player registers interest in a **club** — a trial is a tag on that registration, never a separate object. The club works a filterable year-round list with club-side-only statuses. **$54/month or $329/year, both inc GST, Stripe, card only** (D-109 as amended, D-112, D-148). The free tier keeps the club page, trial notices and CVs by email. **~~Phase 1.5~~ is superseded.** |
| **Club verification, and it is not payment** | **D-126 — the single most important decision in this section.** No fact about a person under 18 reaches a club until a human has verified that club. `verified` is set only by an operator action carrying a name, a timestamp and the answer to the authority question (D-137). **It cannot be set by a webhook, a payment, a claim or a job.** Registrations arriving before verification are **held**: the club sees a count and nothing else. |
| **An edit to an under-16 page returns to the guardian** | D-119. An under-16 record now has an **approved version and a pending version**. Clubs always read the approved one. The record never blanks during pending. Silence never auto-publishes. |
| **Share cards are approved as images** | D-101 as amended. The guardian sees the exact artefact before it can leave. No image is generated or given a URL before approval, and once approved it cannot be recalled — say so rather than implying a control we do not have. |
| **Invitations are the only club→family route** | D-117. An invitation lands **inside Pitch**, not an inbox. The outbound notification is a bare wake carrying no name, no club, no message. The guardian chooses field by field what to share back; nothing is shared by default. **A guardian ignoring it produces no state the club can see** (D-138). |
| **Sign-in, password reset, club dashboard, billing** | All previously missing, all now designed. See `design-screens/`. |

### The five things that reverse something stated later in this file

1. **Payments ship.** D-112 supersedes D-87's invoice-and-bank-transfer entirely. **Stripe hosted Checkout and hosted Customer Portal only, never embedded card fields** — that is what keeps us at PCI SAQ-A. Subscription state is a flag written **only by webhook**; the permission check reads that flag and nothing else.
2. **PDF export is free** on every tier, players and coaches (D-121). It is not a Pro feature. Do not draw a lock on it.
3. **Free clips are ten under 18 and three at 18+** (D-120). This is deliberate and has been "corrected" once by someone assuming it was a bug. See doc 16 §3c.
4. **No export, download or CSV exists anywhere** (D-122). Route enumeration must return nothing that serialises more than one registration.
5. **No school field on any under-18 CV** (D-114).

### The four invariants — build these as properties, not as checks

These came from John (GC) and two of them corrected defects in the design. **Doc 14 tests each one.**

- **Revocation empties the note in the same transaction** (D-128, doc 14 N7). The structured note lives on the registration row, not behind the token. Killing the link does not touch it. *"Nothing readable survives"* is only true if the note is emptied atomically.
- **Payment failure suspends; it never deletes** (D-135, doc 14 O4/O5). Registrations are hidden during dunning, destroyed only on cancellation + 30 days. **A family's child is never deleted because a club's card expired.**
- **`club_status` never reaches a player** (D-108, doc 14 N10). Three values, no fourth. `declined`, `rejected` and `unsuccessful` cannot be written.
- **No club-to-player message exists outside the guardian path** (doc 14 P11). Route enumeration, not a permission check.

### The date

**There isn't one.** D-131 replaced the dated runway with a soft launch as early as we can honestly do one — no marketing, small warm network, find the bugs first. **D-47's gate is unchanged: doc 14 green, or we do not go.** D-113 stands — if the matrix is not green, the payment tier is cut rather than the date kept.

**Quiet is not a lower bar.** A failure with ten families is the same failure; it is simply one nobody writes about.

### Vocabulary that is a data constraint, not a style preference

The words **application, applied, declined, rejected, unsuccessful** do not appear in the product, for any actor, on any surface (D-108 extends D-85). A player *registers interest*. There is nothing to be turned down from, and that is load-bearing — it is what keeps the register out of the Online Safety Act's feedback-feature analysis.

---

## Pillar zero — child safety (never a feature, always structural)

These are architectural invariants. Any code path that violates one is a critical bug, whatever else it achieves.

1. **Under-16 profiles do not exist until a verified guardian approves** (D-17). Two doors, one gate: parent-created, or child-initiated as a *pending invitation* (first name + DOB + guardian contact ONLY, auto-purged after 14 days if unapproved). The CV is built after approval, never before.
2. **Minors are visible, never contactable** (D-18, D-19). No DMs to minors ever. U16s appear in **no search surface**. Their CV link is shared by the guardian. Any outside-club approach routes to guardian + child **together**, and is logged.
3. **16–17s are discoverable to verified clubs and verified coaches only** (D-22). Guardian is notified and holds the off-switch. Contact stays guardian-mediated until 18 (D-20).
4. **No recommender, endless feed, likes, comments, follows, or DMs for minors** (D-21). Any minor-facing list is chronological and scoped to their own club.
5. **Data minimisation** (D-25): strictly-necessary fields only. **No geolocation, no behavioural tracking, no analytics events on minors** beyond what the feature itself requires.
6. **One-tap deletion** for guardian and child, cascading correctly through the record (D-26). Authoring coaches retain anonymised counts only after erasure (D-48).
7. Marketing surfaces target parents and 18+ players, never children (D-06).
8. **CV share links are tokenised** (D-53): revocable and regenerable at any time; U16 links default to **90-day expiry** (guardian can shorten/extend/disable, one-tap renew, reminder nudge before lapse); the guardian can pause a U16 profile entirely. **WWCC numbers are verification-only — never rendered on any public page**; at most a "WWCC verified" state shows.
9. **A share link that is no longer live never 404s, and never leaks existence** (D-77). One page serves *every* non-live token state — expired, renewed away, guardian-disabled, never existed — with **identical copy and identical response timing**, so a stranger cannot probe whether a given player exists. It shows **no name, no club, no photo, no age**: only that this profile is managed by the player's family. One rate-limited "request access" (one per token per 24h) in which the requester types their own name and role for the guardian to see. **The guardian's default answer is allowed to be silence** — there is no "remind the parent to renew" affordance for a stranger.
10. **`experience_entry` ("other football") grants access to nobody, ever** (D-72). It has zero permission surface, no foreign key to club, and cannot participate in the "inside the club" computation. **This invariant carries a test that is not optional.** Free-text organisation names are unverified user input; if they touch the permission engine we have built a hole into a child's record.
11. **A minor's public CV never shows a negative number** (D-67). No goals conceded, no errors, no cards — ever, for any under-18. Clean sheets yes.
12. **Under-18 accounts never render a paid surface of any kind** (D-82) — including 16–17-year-olds who coach MiniRoos.
13. **Support tooling can never read a child's record** (D-79).
14. **Under-18s get TEN highlight clips, free** (D-88) — not three. Three was written for an adult who can upgrade; a minor never sees a paid surface (D-82), so the same cap charged a child for being a child with no door out. **And clips added while a minor are grandfathered permanently** — a player who built nine clips at 17 loses none of them on their eighteenth birthday; the free-adult cap of three applies only to clips added from 18 onward. Implement in the D-49 age transition. Adults on free: three; premium: unlimited.
15. **A minor's social card carries pride, never locator data** (D-89). The Open Graph image is cached permanently by every platform that meets the link, which outlives D-53's 90-day expiry, pause and regenerate. For an under-18 the card carries **first name + surname initial, position(s), squad number, stats — and nothing else**: no surname, no club, no age group, no region. 18+ cards carry full detail.
16. **Under-18 pages are excluded from search engines** (D-95) — `noindex`, `nofollow`, sitemap exclusion, robots disallow, on every under-18 page and every tokenised page. We tell parents no search can find their child; that is true of ours and false of Google's without this.
17. **Age assurance — and the constraint that comes with it** (D-96). Build: DOB locked against upward amendment · **the age-contradiction hold** (an account declaring adulthood while naming a junior age group is held at signup and routed to a human — a hold, **never an automatic rejection**) · a report-an-account route · **guardian contact required at 16–17 signup**, because D-22's off-switch and D-20's routed contact are unbuildable with no guardian on the record. **Never collect government ID.** And in copy, anywhere: **never state or imply that Pitch verifies age.** We ask, a guardian confirms on two channels, a club later corroborates. That is all we may claim.
18. **Third-party embeds are click-to-play façades** (D-97) — nothing reaches YouTube, Instagram or Veo until a viewer presses play. Build this *and* the referrer policy: the façade is the control, the header is the belt behind it.
19. **The permission engine keys off a club-attested WWCC state, never a check number** (D-98). Whether we may hold or display the number is unresolved (doc 18 Q5); keying the gate off a boolean makes the build indifferent to the answer. Never render, log or return the number anywhere.
20. **A U16 asks to share; the guardian sends** (D-91). The child's CV carries a normal "Share my CV" button — they should be able to act on their own page — and the action routes to the guardian to dispatch, said plainly on screen. 16–17: the player shares, guardian visible. 18+: independent. The support console exposes invitation state and re-send only; no impersonation, no record access, every action logged.

## Launch scope — **soft launch, gated not dated** (D-131, 27 Aug) · no marketing until the gate is green

**Three CVs on one component spine, plus the guardian consent spine:**

| Ships at launch | Explicitly NOT at launch |
|---|---|
| Player CV — profile photo, **positions (multi-select, max 3, from the closed 10-position list in doc 16 — D-69, D-92)** + squad number, club, achievements, **position-aware self-reported stats (D-70)**, **"other football" entries (D-72)**, highlight **links** (YouTube/Instagram/Veo embeds — **10 for under-18s, 3 on adult free, unlimited on premium; D-120, D-88 — D-38 is superseded and its 3-clip figure is wrong**), public share link, **birth-quarter context marker (D-84)** | Assess-a-player **UI** (Stage 2 — December). **Build now: the schema, the write-permission functions and doc 14’s section D tests. Build no assessment screens.** That distinction is worth about a week, so do not guess it. |
| **"Send my CV" to a club (D-99)** — from a club page or a trial notice, the family sends the CV as a **tokenised link** to that club's own contact address. **u16: the child composes, the guardian reviews the address and presses send** (D-91). 16–17: the player sends, guardian notified every time and holds the off-switch. 18+: sends alone. **Never automated, never batched, never a file attachment.** This is the distribution engine, not a feature | |
| **The coach's link (D-100)** — stable, public, **copied by the coach** and pasted wherever they already talk to people. Two jobs: applying to a club for a position, and recruiting players and parents. **Pitch never sends it on their behalf and never hands a coach anyone's contact details** | Any "share with a player" / "invite a player" affordance — a discovery surface for minors wearing a helpful label (D-100, doc 14 §J43) |
| Coach CV — roles, clubs, credentials, philosophy, WWCC verified state (never the number), share link, **plus PDF export and a stable public link** (D-75). **Protected above the club page on the cut line** — one coach brings 15–20 families at zero acquisition cost, and Sep–Dec is coach hiring season | Feed, follow/connect, any social graph (Stage 3) |
| **Claimed club page** (scope reduced 25 Aug — D-74) — crest, philosophy, pathway, **teams & age groups as first-class rows including girls'/women's teams** (D-68), text-only trial notices, players-wanted notices, contact route, **plus the alumni pathway wall** (text list, "produced &rarr; went on to" — reinstated by BUZ 25 Aug). A club page is claimed or unclaimed; unclaimed carries the D-64 disclaimer | **DROPPED from launch by D-74, 25 Aug:** the full club-CV treatment · the **sponsor CTA** · the **ground-status banner** (match-day admin, contradicts D-59; a stale "Training ON" banner is worse than none). All three are empty on day one — an unclaimed page full of empty prompts is a vacant shop, and a TD who claims it fills in two fields, gets called away, and leaves that half-finished version of his club on our site forever. They earn their way back from real claimed-club demand in October. **ALUMNI WALL — build it, with guardrails.** **Alumni wall guardrails (added with the reinstatement):** it is club-authored free text on a public page, which is a pillar-zero surface. **An alumni entry never names a person under 18.** A club may write "a 2019 U13 now in an NPL squad" but not the child's name — naming a minor on a public page is a guardian-consent question, and a club admin typing a name is not consent. Named entries are 18+ only. **The wall renders only when it has content** — never an empty prompt on an unclaimed page, which was the whole objection to the other three. It is **seeded during onboarding**: the club names three players across the coffee table and we type them in, which turns the component from an empty field into a conversation prop. Also NOT at launch: verified-club search (December sprint) |
| **Public trials index — manually curated at launch** (D-74). One chronological, filterable noticeboard. No recommender, no personalisation, ever. **Filters from day one: age group · region · competition gender · positions wanted** (D-68). **Every listing carries added-on and last-checked stamps and auto-expires past its date.** **Two sources only (D-90): a verified club posts its own notice, or Pitch adds one compiled from the club's own public notice** (carrying the D-64 unclaimed disclaimer). There is no public tip-off or submission route — a public route on a page families rely on invites unverified listings about children's trials from anyone. **The promise is a defined slice we can genuinely fill, stated plainly — never "every trial in Victoria"** | Club-submitted trial notices / submission system (fast-follow with D-54). A stale listing costs a user permanently; an empty week does not |
| Sign-up with role select + DOB age gate + **country step** (D-63: accounts Australia-only at launch) + **ToS/Privacy acceptance** (adults tick; for U16s the guardian's approval IS the acceptance on the child's behalf — version-stamped into the consent log); guardian approval flow | ~~Trials application register — Phase 1.5~~ **SUPERSEDED 27 Aug. The Interest Register is IN Phase 1 and paid — D-108, D-130. See §0.** |
| **Report & takedown (D-64)** — a quiet "Report this page" affordance on every public page → complaints queue; removal-on-request for any parent whose child appears in someone else's content; uploader rights-warranty lives in the ToS | |
| **The bench (overseas waitlist, D-63)** — non-AU visitors land on the substitution-board screen; adults may leave an email; under-18s are never asked for any detail (anonymous aggregate counts only: country + age band + month, no IP retained) | |
| Guardian linked view of their child; consent log; revocation; deletion | Premium tiers and their contents (D-111, open). **Payments now SHIP — see §0.** |
|  | Native app (checkpoint at Stage 2 planning in December — D-52) |

**Cut line — re-cut 27 Aug (D-74, D-75 as amended). Date holds, scope bends.**

- **Never cut:** guardian/consent spine · player CV · CV quality · **coach CV** · **both send-links (D-99, D-100)**.
- **Cut in this order if days slip:** 0. the `experience_entry` UI (schema stays regardless) → 1. trials index depth → 2. club-page furniture (philosophy, alumni wall) down to the trial notice and the claim → 3. social-card polish (D-76 must render; it need not be beautiful).
- **The send-links are on the never-cut line because they are the distribution engine, not a feature** (D-75 as amended 27 Aug). Cutting them ships a CV with nowhere to go, which is the one version of this product that cannot work.
- **The schema is not on the cut line at all.** Features bend; the shape of the data does not. Every schema item in this brief ships whatever else does.

**HARD GATE — no date, and that is the point (D-131).** The permission matrix, enforced in Postgres, with exactly one tokenised read path, must be green. **It is green or we do not launch** — there is no date left to trade against it, which removes the usual reason people quietly weaken a gate. If it will not go green, **the paid tier is cut rather than the gate lowered** (D-113). This is a go/no-go, not an aspiration: we do not ship a maybe on a child's record. Every other estimate in this brief is residual to this one.

**The two calendar tasks that are day-one or worthless (D-81).** Neither is engineering effort; both are lead time we do not control, and both silently destroy the consent funnel if they are late:

1. **SMS sender registration** with an Australian provider, plus an Australian long number so we can receive STOP/HELP replies. Australian A2P messaging is tightening toward registered sender IDs and registration runs days to weeks — most of our runway.
2. **Email deliverability on a domain with zero sending reputation:** publish SPF, DKIM and DMARC (p=none with reporting) within 48 hours of the domain landing; send transactional mail from a dedicated subdomain; route all internal and test traffic through the real sender from day one to warm it. **Keep the marketing blitz on a completely separate subdomain and stream** *(whether the blitz keeps its own date is OPEN — see D-150)* — one spam-flagged blast must never be able to take the consent emails down with it.

**The quality bar:** the public player CV page is the product, the marketing, and the acquisition engine. It must be the most beautiful thing built — the screenshot test is *"would a 16-year-old proudly send this to a club?"* Everything else can be merely good.

## Design — the Night Match charter (chosen by BUZ, 24 Aug)

**The signed screen designs are the source of truth for every launch screen** — their HTML/CSS source lives in `design-screens/` beside this brief (one file per screen; ignore the `<x-dc>`/`<helmet>`/`support.js` wrapper — the inner markup and inline styles are the design). Match them faithfully; do not restyle.

**Tokens:** background `#0b120e` · surface `#121b16` · surface-2 `#1a2420` · line `#24322a` · ink `#eef5f0` · secondary `#b9c8bf` · muted `#7d8f85` · placeholder `#6b7d73` · accent `#3ddc84` (text on accent `#06130c`) · hero gradient `160deg #123326 → #0c1d14 → #0a1510`.
**Type:** Archivo (500/700/800/900), system-ui fallback. **Only those four weights are loaded — `font-weight: 600` is not a weight we have** and the browser silently renders it as 700, so write 700. Section labels: 11px, 800, uppercase, letter-spacing 0.14em, muted. **Letter-spacing has exactly five values: `0.14em` (tracked caps) · `0.06em` (light caps and labels) · `0.02em` (buttons, small labels) · `-0.015em` (titles 22px+) · `-0.04em` (display numerals).** Nothing else. **Radii:** **16px** cards and bordered panels, 12px inner wells, 22px hero, 999px pills. **Padding:** cards are `15px 14px`. **Buttons:** primary `height 50px · radius 14px · 15px/800 · #3ddc84 on #06130c`; secondary `height 46px · radius 14px · 14px/700 · #1a2420`. There is no third button. **Icons:** stroke SVGs only, never emoji. **Logo:** the bird's-eye pitch mark (green tile, boundary + halfway line + centre circle). Placement rule (BUZ, 24 Aug): **top right corner on every screen**, no exceptions.
**Copy principle (BUZ, 24 Aug):** compliance speaks on screen ONLY where it's functional (something the user must do) or where the reader is a parent who wants it — everywhere else the architecture protects silently. No policy narration in player-facing UI.
**Age-variant rendering:** the same screen renders differently by account age — e.g. Highlights is clean for under-18s, carries locked premium rows for 18+ (see `Highlights.dc.html` vs `Highlights18.dc.html`).
**Theme (BUZ, 24 Aug): dark-only at launch — Night Match IS the brand.** Do not build a light mode. BUT implement every colour as a CSS custom property with the Night Match values as defaults (theme-ready tokens), so a future light theme is a token-set addition, not a redesign. The one light surface, as a **fast-follow after launch**: a light print stylesheet for the public CV page only (TDs print CVs for trial day; dark pages drink ink) — seed its look from `DirectionB` (the editorial light exploration) if useful.

## Stack (D-52 — locked)

- **TypeScript everywhere, strict mode.** Next.js (App Router). Mobile-first responsive web app, installable (manifest + icons + iOS meta).

**Responsive — build it in, never retrofit it (D-147).** Three breakpoints and **two** desktop layouts, no more:

| Width | What happens |
|---|---|
| **< 640px** | Mobile. The 390px artboards **as drawn**. Full-bleed column, 18px side padding. |
| **640 – 1023px** | Content column caps at **560px**, centred. Pairs may go two-up. |
| **≥ 1024px — reading surfaces** | Column caps at **640px**, centred, page background fills. CV, club page, landing, auth, guardian and player flows. |
| **≥ 1024px — console surfaces** | **Sidebar + content, max 1200px, tables not stacked cards.** `InterestRegister`, `ClubPeople`, `ClubDashboard`, `ClubHeldQueue`, `ClubBilling`, `PostATrial`, and the operator console. |

**Every screen is a reading surface unless it is on the console list.** That is what makes this two desktop designs rather than seventy-five.

**Four constraints, and breaking any of them forks the design system:** the 390px artboards remain the source of truth for **content, order and copy** — desktop changes the container, never what is on the screen; **the type scale does not change at any breakpoint** (D-140's tokens hold — bumping font sizes on desktop is how a token set quietly forks); **no desktop-only or mobile-only feature, ever** — same permissions, same actions, because a capability on one and not the other is a permission surface nobody tested; and **touch targets stay ≥44px at every width** (the 50px/46px buttons already satisfy this — do not shrink them for desktop).

**Why this matters more than it looks:** the persona most likely to be on a laptop is the **technical director working the Interest Register** — the one who pays us — and their screens are the most data-dense in the product. The public CV page is worse: it is the acquisition engine and the first thing a club ever sees. Public CV pages server-rendered with full Open Graph/social preview tags — they must unfurl beautifully in WhatsApp/Instagram/iMessage.
- **Supabase**: Postgres in the **Sydney region** (D-29 — personal data resides in Australia), Supabase Auth, Storage for profile images and club crests.
- **Vercel** for deploys; pin serverless functions to Sydney. **Resend** (email) + **Twilio** (SMS) for the guardian verification waterfall (D-24: declared DOB → guardian email + separate SMS; never self-declaration alone; never government ID).
- No additional services without a reason written down. Boring wins.

## Architecture rules (from doc 09 — read it before designing schema)

**The separation everything hangs on:** a **person**, their **profiles**, and their **record** are three different objects. One account per human; roles are hats (coach-and-parent is one login). Profiles are the public faces (the three CVs). The development record is player-owned and portable (D-10, D-48).

**The objects:** Person/Account · Profile (player/coach/club) · DevelopmentRecord · Assessment (schema now — **criterion-referenced competency bands, never numeric ratings** (D-60); 48h author-edit window then immutable, superseding corrections, full version history, D-50) · Competency + ClubFramework (schema anticipated now, feature later — spine competencies are cross-club comparable; club-layer competencies travel as attributed history; frameworks are versioned so old assessments resolve against the version in force)

**Profile photos:** players, coaches and clubs (crest) upload a profile image; initials-block fallback when none. **For under-16s the photo is part of the guardian-controlled profile** — the guardian uploads or approves it through the same consent flow as everything else; no separate policy copy on screen. Photos live in Supabase Storage (Sydney), are resized server-side (never serve originals), carry no EXIF/location metadata after processing, and are deleted in the D-26 cascade. The Build-CV screen leads with the photo affordance ("Add profile photo — every good CV has one").

**Premium surfaces — seeded, not sold:** under-18 accounts NEVER render premium/paid surfaces of any kind (D-06/D-30/D-33 — the same screen renders clean for minors). On 18+ player and coach accounts, show locked premium rows (PREMIUM tag) for: unlimited clips + reel builder, who-viewed-your-CV. No payment UI exists until Stage 5. Tapping a locked row shows "Premium arrives this season — you're first in line" and **logs an anonymous interest count per feature** — that tap data validates conversion against the now-settled price. **D-34/D-82 (settled 25 Aug): one adult price — $79/year paid up front, or $9.99/month, rolling twelve months from purchase, two feature sets by role.** Three conditions that are product rules, not marketing: **the free coach tier stays complete for a volunteer** (coaching CV, one squad, assess your players, share sessions to that squad, jobs board) and is never shaved to drive conversion; **WWCC verification is free, mandatory and never a paid feature** — pillar zero; and **premium never re-ranks verified data in a club's search** (V1). Keep it quiet: at most two locked rows per screen, no banners, no popups.

**Provenance (D-62):** every stat and record entry carries a `provenance` field — `self_reported | coach_verified | official_import` — from day one. No public API exists for Australian community football data, so `official_import` is empty at launch; it exists so a future Dribl/Veo partnership needs zero migration. The UI always displays the tag: Stage 1 stats visibly read "Self-reported". Never render a number without its source. · GuardianshipLink (≤2 guardians, equal visibility, either approves, both notified, most-restrictive-wins — D-51) · Club (with verified status — manual verification in v1) · Membership (club/squad, role, season — **a squad is a lens, not a container**; U16 squad invites route to the guardian) · RegistrantRecord (club-owned, minimal fields, links to a Person only on guardian consent — schema now, feature later) · VerificationStatus (adults: WWCC + club affiliation — a **permission gate**, not a badge — D-22, D-28) · ConsentEvent/AuditLog (append-only).

### The 25 August schema delta (D-67 to D-73, D-78, D-80, D-84) — build it this way from the first migration

Ranked by what it costs to get wrong. Rows 1–3 are the argument; the rest is housekeeping.

1. **Stats are rows, not columns** (D-70), **and the player chooses which of them surface** (D-105 — `surfaced_stats text[]` on the record, IN THE FIRST MIGRATION; `STAT_SETS` below is the default pre-selection, not the renderer; all four keys are choosable including `apps` — BUZ 27 Aug; the never-zero rule still decides whether a selected stat renders, and if nothing is selected the whole stats block is omitted rather than rendered empty). A `player_stat` table keyed by `(record_id, season, stat_key, source_experience_id)` with `provenance`. **The stat catalogue lives in TypeScript, not Postgres**, so adding "saves" or "minutes" later is a code change with zero migration:
   ```ts
   STAT_SETS = {
     GK:  ['apps','clean_sheets'],
     DEF: ['apps','clean_sheets','goals','assists'],
     MID: ['apps','goals','assists'],
     FWD: ['apps','goals','assists'],
     UNSET:['apps','goals','assists'],
   }
   ```
   Max four tiles rendered; **null stats are omitted, never shown as zero, and the page must not look broken without them** — that is the actual design work.
   **The never-zero rule, and it is load-bearing:** omit a tile on **null OR zero**. Values are **nullable with no zero default** — never `NOT NULL DEFAULT 0`, which is what fingers type reflexively and which makes a keeper, a brand-new player and a striker in a drought byte-identical. **No form coerces blank to 0**; the edit form shows a muted placeholder, never a pre-filled zero, because a form showing zeros invites people to leave them and reads as already-saved.
   *Why it matters more than the position-aware sets do:* the CV only becomes a goals-and-assists leaderboard because everyone renders the same three numbers whether they mean anything or not. **Deleting the zeros is what defuses that.** Two or three confident tiles also balance better than four with holes in them. **Catalogue honesty limit:** appearances, goals, assists, clean sheets, minutes only. Self-reported tackles, interceptions, duels won and saves are excluded by design — nobody counts them, everybody estimates upward, and a moat around invented numbers is not a moat (D-11).
2. **The atomic unit of the record is a typed `entry`** (D-71) — a type discriminator (`attendance | participation | effort_observation | milestone | coach_note | competency_observation`), **not** a competency-scores table with other things bolted on. Get this wrong and effort and participation are second-class forever. And the immutable unit for assessments is the **`assessment_entry`** — one player, one competency, one band, one author, one moment; "an assessment" is a *derived grouping* by (player, block). Two rules that carry D-50 and D-60: entries reference competencies by **`(competency_id, framework_version)`**, never by name or slug; and there is **no unique constraint on `(record_id, competency_id, block_id)`** — append-only supersession is what leaves room for a later moderation entry without a migration.
3. **`experience_entry` sits outside Membership and outside the permission engine** (D-72). `kind` (school/futsal/representative/ntc_academy/tournament/other), `org_name` as free text with **no FK to club — deliberately**, provenance always `self_reported`. **Write the test that asserts it grants nothing to anyone.** No taxonomy: a type chip and free text, never a dropdown of school competitions.
4. **`positions text[]`** — ordered, max 3, TS-validated — replaces `primary_position`/`secondary_position` (D-69). GK is a pickable position. **There is no `position_status` / "finding" state.** `position_group` is **derived at read time** from `positions[0]`, never stored.
5. **`competition_gender` and `age_group` live on the SQUAD and the trial notice — never on a Person** (D-68, D-25). Put the D-25 citation in the schema comment so nobody helpfully adds it later. `trial_notice` also carries `position_needs text[]` — "goalkeepers wanted" is the most common notice in Australian community football.
6. **Age groups, competition tiers and gendered pathways are lookup tables, never enums** (D-73).
7. **`verification_challenges`** (channel, hashed token, sent_at, verified_at, attempts, expiry), read by the permission function (D-80). **Supabase Auth is for session only.** Do **not** use phone-OTP sign-in as the second factor — it collides with the email identity and costs days in account-linking and rate-limit fights.
8. **The consent-funnel event spine** (D-78): append-only, fixed vocabulary, one row per transition (`invite_created, email_sent, email_delivered, email_opened, sms_sent, sms_delivered, guardian_landed, email_verified, sms_verified, approved, nudge_sent, purged`). **Email and SMS provider delivery webhooks write into the same table** — without them "the parent ignored us" and "Gmail spam-foldered us" are indistinguishable. No dashboard: SQL views plus one 7am digest email.
9. **Empty tables, specified now for clarity not urgency:** `competency` (+ `position_scope: all|gk|outfield`, `band_descriptors` JSONB, unique on `(code, framework_version)`) · `assessment_block` · `assessment_session` (optional header, `mode: player_major|competency_major`) · `match_appearance` (D-66) · `growth_note` (guardian-entered height + date only, coach-invisible, no classification — D-84).

**The one rule of construction: permissions are COMPUTED, never stored.** No `is_visible` flags on users. Every access decision derives from (age band + guardianship state + membership + verification) at read time, through a single policy module. This is what makes birthdays automatic and the matrix testable.

### The tokenised read path — the single most dangerous surface in the product (D-80)

The share link must work for an **unauthenticated stranger**, and Row Level Security has no clean way to express "no session, but this bearer token grants read of exactly this one record." Whatever you build, it ends in a server route holding the service-role key — and that route becomes the one place on earth where a U16's record can leak. Four rules, non-negotiable:

- **Exactly ONE server-side read path** for token access. Not one per surface. One. **The OG image endpoint, the link-state page, the request-access handler and the coach-CV PDF export all call that one route internally** — they never hold the key and never query directly. That is what makes the single-file assertion (J17) survivable.
- **The service-role key exists in that route and nowhere else** in the codebase.
- **Permissions are computed in a Postgres function**, so the matrix is enforced at the database and the application cannot route around it.
- **The test suite runs against the database, not the app layer.**

Budget 4–5 days and treat every other estimate in this brief as residual. **Green, or we do not go.**

**The permission matrix (encode as policy functions; every cell gets a test):**

| Action on a player | Under 16 | 16–17 | 18+ |
|---|---|---|---|
| View profile/CV | Link-holders (guardian-shared) + own club | Anyone with link + own club + verified viewers via search | Public |
| Appear in search | **Never** — no search surface exists | Verified clubs & verified coaches only | Everyone |
| Initiate contact | Outside own club → guardian + child together, logged. No DMs ever. | Routed to guardian + player together | Direct |
| Assess (write to record) | Verified coach at their own club only | Same | Same |
| Share the CV link | Guardian only | Player (guardian visible) | Player |
| Delete the record | Guardian or child — one tap, cascades | Guardian or player (most-restrictive-wins) | Player |

**Club roles (D-93).** `Membership.role` is: `player · coach · technical_director · team_manager · club_admin · guardian`. **A Technical Director is a role, not a profile type** — they hold a coach CV that renders "Technical Director, <club>", and squad data lives on the club, never on them personally. **Club administrator and Technical Director are different powers:** an administrator manages the club page, squads, memberships and notices and has **no development-record access at all**; the TD has club-wide development access. A treasurer made an admin to send invoices must never be able to read a child's development notes. **TD is granted by the club and confirmed at club verification — never self-declared** — and a departing TD loses club-wide access immediately, keeping only what they authored (D-48). A person holding two roles gets the **union**, computed at read time, never stored.

**Club visibility:** the TD and squad-assigned verified coaches see full records of **current** players (including history a signing brings — consented at joining). On departure the club drops to aggregates; authoring coaches keep read-access to what they wrote (D-48).

**The age state machine (D-49):** birthdays are automatic state transitions, guardian notified 30 days ahead. At 16: network capability unlocks (countdown moment UI — D-20) + verified-audience discoverability (guardian off-switch). At 18: full independence — guardian visibility auto-expires; the adult can re-grant. Implement as a scheduled job + derived age-band function; never trust a stored band.

## Security — the standing posture (D-94)

**Build this with security at the front, not bolted on at the end.** We hold the personal data of children in a jurisdiction with a statutory privacy tort and a children's privacy code arriving. A breach here is not an outage — it is the end of the company and a genuine harm to real families. Treat every item below as a requirement, not a recommendation, and **when a security decision is unclear, choose the more restrictive option and tell BUZ what you chose.**

**The mental model: assume the attacker has a valid share link.** Not a hacker with a zero-day — a person who was legitimately sent a child's CV link and now wants more than they were given. Every control below is aimed at that person, because that is who actually exists.

### 1 · Secrets

- **The service-role key lives in ONE server route and nowhere else** (D-80). CI asserts this with a repo-wide static check on every commit.
- Nothing secret in the client bundle. Anything prefixed `NEXT_PUBLIC_` is public — treat it as printed on a billboard.
- **No secret, token, or personal data in logs, error messages, or exception traces**, including third-party error reporting. A stack trace containing a share token is a leaked record.
- `.env.local` never committed. **Secret scanning in CI.** If a key is ever exposed, rotate first and investigate second.

### 2 · Session and authentication

- Supabase Auth for **session only** (D-80). Session cookies `httpOnly`, `secure`, `sameSite=Lax`. **Never store a session token in `localStorage`** — an XSS then owns the account.
- **Enumeration:** sign-up, sign-in and password-reset responses must be identical whether or not the account exists. Same body, same timing. This is the same rule as the link-state page (D-77), applied to auth.
- **Rate-limit every unauthenticated endpoint**: sign-in, reset, OTP send and verify, the request-access affordance, and the token read path. Lock out on repeated failure against a single identifier *and* a single IP.

### 3 · Authorisation — default deny

- Every query is scoped server-side. **Never trust a client-supplied id, role, age, provenance or club** — derive all of them server-side from the session and the database (D-71's `provenance` is set by the server from the actor, never accepted from the request body).
- Permissions computed in a Postgres function so the application cannot route around them (D-80). A new endpoint that forgets to check is the most likely bug in this codebase; the database is what makes that survivable.
- **New code path that reads a record? It goes through the same function. No exceptions, no "just this once for the admin page."**

### 4 · The share token itself

- **Cryptographically random, at least 128 bits.** Never sequential, never derived from a user id, never guessable.
- **Stored hashed**, compared in constant time. A database dump must not yield working links.
- Expiry, revocation and pause enforced **server-side on every read** — never in the client, never cached past the check.

### 5 · Two vectors specific to our design — do not skip these

**Referrer leakage through highlight embeds.** A minor's CV page carries a share token in its URL *and* embeds third-party video (YouTube, Instagram, Veo). By default a browser sends the full referring URL to those third parties — which hands a working token to someone else's servers, permanently, in their logs. **Set `Referrer-Policy: no-referrer` on every tokenised page**, use `youtube-nocookie.com`, sandbox every embed iframe, and allow only the specific hosts we support. Verify it in the network tab before shipping, not by reading the code.

**The OG image endpoint outlives revocation.** Social platforms fetch and cache the card, sometimes for good (D-89 is why a minor's card carries no locator data). The endpoint must **re-check the token on every request**, must not be cacheable beyond a short window, and must return a generic Pitch card — never a real identity — for any token that is not live.

### 6 · User content and injection

- **All free text is hostile:** "About", `experience_entry.org_name`, alumni entries, club philosophy, trial notices. Escape on output; **never `dangerouslySetInnerHTML`**, never render user text as HTML or markdown.
- Parameterised queries only. If raw SQL is ever necessary, it is parameterised — no string interpolation, ever.
- **Validate at the boundary with a schema** (zod or equivalent) on every route handler, including shape, length and range. Reject rather than coerce.

### 7 · Uploads (profile photos and club crests)

- **Verify type by file content, not by extension or the client's declared MIME.**
- **Re-encode every image server-side** — that both strips EXIF/GPS (already required) and neutralises a payload hidden in a valid image.
- **No SVG uploads.** SVG is a script container.
- Hard size caps, storage outside any executable path, served via signed URLs with short expiry.

### 8 · Headers and transport

HTTPS everywhere with HSTS. A real **Content-Security-Policy** — no `unsafe-inline` scripts. `X-Content-Type-Options: nosniff`, `X-Frame-Options`/`frame-ancestors` to deny framing of authenticated pages, `Referrer-Policy: no-referrer` as above.

### 9 · Dependencies and CI

Boring, few, pinned by lockfile. **Automated dependency audit in CI**, and treat a critical advisory in anything on the request path as a stop-work item. CI also runs: the doc 14 negative suite, the service-role static check, secret scanning, and the banned-words check (D-85).

### 10 · Backups, audit and incident readiness

- Supabase **Pro with point-in-time recovery** — and **test a restore before launch.** A backup nobody has restored is a hypothesis.
- The **consent and audit log is append-only at the storage level** with no update or delete path in code. It is what makes an incident investigable and what proves consent; it is not a nice-to-have.
- **Kill switches that a tired founder can hit at 11pm:** SMS spend cap (D-81), a global pause on public profile serving, and the ability to revoke all live tokens at once.
- A breach involving children's data is notifiable in Australia. **We do not need an incident plan written in code, but we do need to be able to answer "what was accessed, by whom, when" from the audit log** — design for that question now, because it is asked at the worst possible moment.

### The rule underneath all of it

**Data minimisation is the strongest security control we have** (D-25). Every field we do not collect is a field that cannot leak, cannot be subpoenaed, and cannot be got wrong. When a feature can be built with less personal data, build it with less — and if you are ever unsure whether we need a field, we do not.

## Engineering conventions

- **Tests:** the permission matrix and the age state machine get exhaustive tests before any UI exists — every cell, every transition, every guardian edge case (two guardians disagreeing → most restrictive wins). These tests are the product's licence to operate.
- **Seed/dev data:** fictional people only, clearly fictional names. Never real minors' data in any environment. **Three house fixtures, built on day one of the sprint — 29 Aug, before any screen** (they are the test data every screen is built against, and they find the bugs for free):
  - **Deniz Yılmaz**, 14, attacking midfielder, Riverside FC — the existing house persona.
  - **A 17-year-old goalkeeper** — exercises D-67 (no negative numbers), the GK stat set, *and* the full 16–17 permission band (D-22 discoverability on, guardian off-switch present, contact still guardian-mediated) against a real rendered page rather than a synthetic test row. That is a safety win, not a diversity win.
  - **A 15-year-old girl at a community club** (Georgia Whitcombe — full data in doc 16) — exercises D-68's squad-level gender, the girls' rows on a club page, and the index filter.
  Building against Deniz alone means the GK layout and the girls'-squad label get discovered in the last week, which is exactly when there is no time to fix them. These three also become the launch screenshot set: **no marketing asset ships with only Deniz in it.**
- **Consent log:** append-only at the storage level; no update/delete paths in code.
- **Performance:** the public CV page must be fast on a phone on 4G at a football ground — server-rendered, image-optimised, no blocking scripts.
- **Accessibility:** semantic HTML, contrast-safe in light and dark, tap targets ≥44px.
- **Copy tone:** plain language, parent-readable, Australian English. The doc 04 consent screen is the benchmark: promises stated outright ("No one can contact Deniz directly").
- **Secrets/env:** `.env.local` never committed; document every variable in `.env.example`. The launch set:

```
# Supabase — project in the SYDNEY region (D-29)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # used in ONE server route only (D-80). CI asserts this.
SUPABASE_DB_URL=                # tests run against the database, not the app layer

# Email — Resend, transactional subdomain, separate from marketing (D-81)
RESEND_API_KEY=
EMAIL_FROM="Pitch <hello@mail.pitchfootball.com.au>"   # transactional subdomain, NOT the apex (D-81)
EMAIL_WEBHOOK_SECRET=           # delivery receipts feed the consent event spine (D-78)

# SMS — Australian provider, registered sender ID, prepaid credit (D-81)
SMS_API_KEY=
SMS_SENDER_ID=
SMS_LONG_NUMBER=                # inbound STOP/HELP handling
SMS_WEBHOOK_SECRET=
SMS_MONTHLY_CAP_CENTS=          # global spend cap
SMS_KILL_SWITCH=false

# App
NEXT_PUBLIC_SITE_URL=https://pitchfootball.com.au
SUPPORT_EMAIL=help@pitchfootball.com.au
DIGEST_RECIPIENTS=              # the 7am consent-funnel digest (D-78)
TZ=Australia/Melbourne          # age transitions evaluate here, never UTC (doc 14, G9)
```

## Build order (the doc 08 runway, v2.0 — **the dates below are dead; the order is not**)

> **D-131 removed the runway's dates.** Read what follows as a **sequence**, not a calendar. Where a step names a date, the date is gone and the dependency it encoded is not: the waitlist page still ships first because it proves the domain, hosting and mail pipeline; the permission suite is still green before UI; the SMS controls are still in place before a single verification message is sent. **The gate is doc 14, not a Monday.**

0. **FIRST DEPLOY, this week — the waitlist landing page** (`design-screens/JoinWaitlist.dc.html`, then `WaitlistConfirmed.dc.html`): a static page at `pitchfootball.com.au` — email capture (adults only; the "18+ — ask a parent" line is load-bearing), role chips, Spam-Act-compliant storage with unsubscribe. Proves domain + hosting + Resend pipeline before anything else; Anna's bio link from day one; flips to the sign-up flow at soft launch. (The overseas "bench" screen is separate and post-launch — this is the Australian pre-launch page.)
0b. **DAY ONE, 29 Aug, before any screen — the three house fixtures** (see Engineering conventions). They are the test data everything else is built against.
1. **29 Aug – ~3 Sep — foundations:** repo, deploy pipeline, Supabase project (Sydney), auth, roles, DOB age gate, guardianship link + approval flow end-to-end, consent log, deletion cascade, **permission-matrix test suite green — enforced in Postgres, one tokenised read path**. Plus two tests that are not optional: `experience_entry` grants nothing to anyone, ever (D-72); and the 17-year-old GK fixture renders correctly across the full 16–17 band matrix. *Done when: a parent can approve a child, and it is all logged.*
2. **4 – 7 Sep — the player CV, and it is the week that must be beautiful:** player profile + public CV page + share link first (most time, highest bar) → `positions[]` + position-aware `player_stat` tiles + GK emphasis + the no-negative-numbers rule (D-67, D-69, D-70) → birth-quarter marker (D-84) → highlights embeds + edit flows → **social/OG card rendering for a shared CV** (D-76, ~1 day — for a parent the shared link *is* the product) → **the link-state page** (D-77, ~1.5 days).
3. **8 – 10 Sep — breadth and plumbing:** coach CV + PDF export + **stable public link, no token, separate implementation from the player token** (D-75, D-100) → **the send-link flow: compose → guardian confirm-address → send → consent-log row (D-99), with the rate limit indistinguishable from success** → claimed club page with girls'/women's team rows (D-74) → trial notices + curated trials index with age/region/gender/positions filters → **consent-funnel event spine with provider delivery webhooks and the 7am digest** (D-78, ~1.5 days) → **support console** (D-79, ~1 day) → **in-app-browser link handling for SMS** (~1 day: the guardian taps the SMS, lands in an embedded webview, the session does not carry, the magic link burns, and our instrumentation records it as "parent did not approve" — needs an "open in your browser" interstitial, tested on real iOS and Android handsets over shakedown, never a simulator). `experience_entry` UI ships here **only if** the achievements list is already a generic repeatable component and that day is green; otherwise it drops to the first fast-follow. *Feature-complete is the last safe merge, and the cut line fires here if needed.*
4. **11 – 13 Sep — shakedown:** safety test suites green (the only launch-blocker class), warm families run the full flow unaided, same-day fixes. **Go/no-go Sun 13 Sep.**
5. **Live, quietly** — no marketing push, a small warm network (D-131). **A blitz, Melbourne-first, only after a week of live hardening**, and only if the quiet week was clean.
6. **~5 Oct — the post-cut flow (D-86).** Every player not selected leaves with their record intact, their coach's development targets written down, and a list of clubs still trialling within travel distance. Timed to the Victorian window (community trials early Oct, NPL from 14 Oct). Mostly the trials index pointed at a different week. Fully D-53 compliant — not discovery, *what is next*.
7. Next sprint (assessments + verified-club search + **minutes capture**, D-66): UX designed in October; build start set at sprint planning.

~~**The money calendar is not a build dependency (D-87).** Club revenue needs an ABN, a bank account, an invoice template and a one-page club agreement by 1 Nov — no engineering. Payments do **not** need to switch on with the December search.~~ **Superseded by D-112 on 27 August. Money is now a build dependency and it ships at launch.** There is no invoice template and no one-page signed agreement: a club claims its page, chooses Free or the Interest Register, and pays by card in the same session.

**What checkout must capture, and it is not a formality (D-137).** The person's **name**, their **role at the club**, and a tick reading **"I am authorised by [Club] to enter this agreement on its behalf."** Many community clubs are unincorporated associations with no legal personality — there is nothing to bind and a volunteer's signature would have had the identical defect. The tick turns an anonymous assent into an identified representation, and BUZ's verification call asks the same question independently. **The receipt is addressed to the club, not to the person**, so a treasurer can be reimbursed without an argument.

**And the disclosure is ours, not Stripe's (D-136).** The price, the frequency, that it renews and how to cancel appear **on our page, before the customer reaches Stripe**. Cancelling is reachable from the club's own settings inside Pitch — not only from an emailed receipt somebody deleted in March. **A 14-day cooling-off on the annual plan, full refund, no questions.** Plus a clear statement descriptor and a receipt on every charge, so a confused treasurer emails us before ringing their bank.

## Notifications (D-65) — transactional only at launch

Launch ships **email + SMS transactional messages only** (Resend + Twilio): guardian approval request, day-10 pending-invite nudge, 90-day link-expiry renewal reminder, report/takedown confirmations, waitlist confirmation, password reset. No notification centre, no push, no marketing sends. **AMENDED 25 Aug (D-81) — SMS at launch is guardian verification ONLY.** Trial alerts go by **email and web push**, never SMS at launch. A player following five clubs across four notices in the Sep–Oct window is twenty messages — roughly $1,200 per thousand users per year against $150 for signup, or about $13,500/year at ten thousand users, driven entirely by other people's posting behaviour. That is unpriced write access to our cost base. SMS trial alerts become a **paid** feature later, which turns our worst cost line into a price fence. With the trial-register fast-follow (D-54): application submitted/received confirmations (email, plus SMS to the club only) and **opt-in "new trial posted" alerts** by age group/region — chronologically triggered, never algorithmically selected, addressed to the guardian for U16s, unsubscribe in every message.

**SMS controls required before the first verification message, non-negotiable (D-81):** max **3** verification messages per number per 24h · a **global monthly spend cap with a kill switch** · **prepaid credit, never a card on file** (SMS pumping fraud against an unrated OTP endpoint can burn four figures overnight and is one of the most common ways a small launch loses real money in week one) · **STOP/HELP handling** on an Australian long number · **never a third-party link shortener in a consent SMS** — shortened links are a filtering signal; use our own domain. **Hard rule: notifications to minors are strictly functional — no streaks, no re-engagement prompts, ever.** Safety-relevant messages go to guardian AND child together (D-19). In-app centre = December sprint; push = Stage 3 with comms.

## Legal plumbing (D-64) — quiet by design

- **Canonical domain: `pitchfootball.com.au`** — all share links and OG tags use it, and it is the only domain a user ever sees. **Transactional email sends from a dedicated subdomain and marketing from a separate one (D-81)** — one spam-flagged blast must never be able to take the consent emails down.
- **Acceptance logging:** every ToS/privacy acceptance (who, which version, when, on whose behalf) is a consent-log event. Terms are versioned; re-acceptance flows only on material changes.
- **Collection notices:** one muted line at each point of data collection ("Why we ask" pattern), never modal, never a wall of text — BUZ's rule: only where needed, never loud on facing pages.
- **Waitlist & parent emails:** Spam Act compliant — identified sender (Pitch, pitchfootball.com.au), working unsubscribe, consent recorded.
- **Unclaimed listings:** carry `unclaimed` state + the disclaimer ("compiled from public information — not affiliated until claimed") in the listing detail/ToS, not shouted in the list UI.
- **Retention:** a plain retention statement in settings/privacy policy; inactive-account handling per the policy the solicitor confirms.
- **16–17 ToS acceptance model is an OPEN legal question** — build the guardian-acceptance path so it can extend to 16–17 if the solicitor requires it.

## Working rules

- Design-complete before code (D-40): if a behaviour isn't specified in docs 06–09 or this brief, ask BUZ — never guess product behaviour, especially anything touching minors.
- BUZ approves anything user-visible before it ships; propose, don't surprise (his standing rule).
- When a decision needs changing, name it by D-number and take it to BUZ; the register moves first, then the code.
- **Banned language (D-85), and this is a credibility rule, not a style preference.** **"Potential"** appears nowhere — no potential score, potential rating, potential indicator, ever. It is the word that has sold false hope to Australian parents for thirty years, and an experienced technical director closes the laptop when he sees it. Also barred: **"elite"** on anything under U13 · **"talent identification"** for children under 10 · **"insights"** · **"struggling"** (D-61). The tactical corner maps onto the six Ps (Pressure, Protection, Positioning, Possession, Penetration, Presence) so a coach can fill an FA Talent ID form from Pitch notes without retyping — borrow the common tongue, never invent a fifth corner.
- **Assessment design constraint, restated (D-12, amended 25 Aug):** not "2 minutes per player" — **one competency across a squad of 18 in under 90 seconds; resumable in 90-second chunks; state saved on every tap; never a session you have to finish.** And the rule that outranks the numbers: **never ask a coach to enter something he did not already observe** — that is the moment an honest coach starts guessing, and a guessing coach makes the whole record worthless. Bands carry forward by default; twelve items max; notes optional. **Design for the sofa at 9pm, not the carpark** — design for the couch and the carpark comes free.
- **Support ownership (D-79):** Elly owns a shared inbox with a stated one-business-day response and no 24/7 pretence. Engineering builds the console and nothing else. A support address goes **inside the SMS itself** — the person whose SMS never arrived cannot use an in-app help link.
- Honest-promises discipline (D-53): launch copy sells the CV, never discovery ("club search switches on in December — players already on Pitch get found first"); family-facing copy says plainly that coach feedback arrives in December; the data-export right for families and clubs is stated in the terms.

---
*Pitch 3.0 · build brief v1.0 · drafted 24 Aug 2026 from docs 00–09 · rename this file to `CLAUDE.md` at the repo root*
