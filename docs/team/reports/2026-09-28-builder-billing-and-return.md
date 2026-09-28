# build: /club/billing, the return, and a club administrator's home (28 Sep 2026)

**Tree:** `.claude/worktrees/builder-billing-return`, branch `builder-billing-return`.
**Measured on:** `c8cb1ae`, off `app` at `4c08f91` (merged in, not rebased).
**Ports:** database 54361, app 3061, Chrome CDP 9361/9363. Nobody else's.

Asked: build `plan-and-billing.html` and `the-return.html`; fix two faults on the
billing screen and surface the suspended state on the register; then (mid-task)
build `club-home-admin.html`, merge `app`, and apply D-162 to every count on
billing and both homes.

---

## Did

**`supabase/migrations/0063_money_says_one_thing.sql`** — two functions, because
two club screens each worked out the same thing for themselves and disagreed.

* `fn_register_payment_state(person, club)` → `null` (not the club's TD or
  administrator) · `unsubscribed` · `active` · `grace` · `suspended` ·
  `cancelled`. Whether the register is readable is not re-derived: it asks
  `fn_register_active`, which is the one answer to that.
* `fn_club_register_readers(person, club)` → who at this club can read the
  register: the TD, every coach holding a live grant, every administrator and
  every team manager, each with `scope` (`whole` / `squads` / `none`), the team
  names, and since when. Computed from membership, the grant row, the WWCC
  attestation and verification at read time — doc 14 N23, and D-93's wall as
  data. For a granted coach "since when" is the **grant** date, not when they
  joined the club.

**`supabase/migrations/0064_the_return.sql`** — `person.last_seen_at`,
`returned_at`, `returned_from` (three columns, all overwritten, never appended
to), `fn_note_arrival(person)` and `fn_return_facts(viewer, since)`.

**`app/club/billing/page.tsx`** — rewritten to the mockup's shape.
`className="reading"` → `"console"` + `player-grid`: measured in Chrome, the
page's own column goes from the 640px `.reading` cap to **968px** at both 1280
and 1440, laid out as `594px + 320px`. The price is `numeral numeral-l` with its
caption under it; the next charge date is `numeral numeral-m` beside it, and
renders **only** while the subscription is running. One accent thing on the
screen: the button. `.card-sunken` holds the statement descriptor and the
subscription state; the rail holds "Who reads it" and "If a payment fails".

Three fixes on the way:

1. `error` was declared in the searchParams type and never destructured, so
   Subscribe without D-137's tick — or with a name that is only spaces, which
   `required` lets through — returned `?error=1` with the fields emptied and
   nothing said. It is destructured and there is a `role="alert"`.
2. A club **in dunning** was shown "Choose how you pay" and never the hosted
   portal, which is the one control that replaces a declined card. A club with
   any subscription now gets the portal; only `unsubscribed` and `cancelled`
   get checkout.
3. The five captions on this page used `className="field-label"`, whose only
   rule is `.field > .field-label` — a direct-child selector, and they are
   children of a card. They use `lib/ui`'s `sectionLabel` / `fieldLabel` objects
   now. **The selector itself is still wrong** — see Found.

**`app/club/register/page.tsx`** — the dunning branch only, as instructed. A
suspended club now renders `RegisterPaused` **above** "Interest in your trials".
Its `active` still comes from `fn_register_active`; the new bit is
`fn_register_payment_state`, so the two screens read one answer.

**`components/RegisterPaused.tsx`** — the failed-payment words in one place, two
states (`grace` / `suspended`), one clause of tense between them. Three screens
render it.

**`app/home/page.tsx`** — three things.

* **The return.** `fn_note_arrival` on arrival for the guardian seat and the
  16+/adult player seat; `WhileYouWereAway` when it returns a window. Three
  dated facts above the queue. No button in the block at all.
* **The administrator's home.** The hero carries squads / trials live / coaching
  roles open and the sentence saying whose the register is. One accent action:
  "Post a trial notice". The rail's six grey menu cards are gone (measured: 5
  centred menu cards in the body at `4c08f91`, 0 now; the TD's rail is
  untouched at 5) and in their place: the club page's URL with Copy/Open, "Who
  can do what here" from `fn_club_register_readers`, and the plan. Plus "What a
  family cannot see yet" (crest, philosophy), absent when neither is missing.
* **D-162** — see below.

**`components/WhileYouWereAway.tsx`** — the block. Dates formatted in Postgres in
Melbourne (`to_char` gives "Sep", not en-AU's "Sept" — L18).

**`lib/billing.ts`** — `PRICES` gains `numeral` and `per`, so the price can be a
display numeral and a caption without being two strings in two places.

**`scripts/dev-db.mts`** — fixtures for the four paths nothing walked:
Coburg City FC (verified, payment failed, grace lapsed, no crest, no
philosophy, no public page) with a TD (Felix Moreau), an administrator (Robyn
Callister) and a team manager (Tomas Villa); two away families (Alex 80 days,
Nate 70) and two seeded register reads; and Riverside's `plan` and
`current_period_end`, which the webhook writes in production and the seed never
set. **Fixture warning (L32):** the guardian and 16–17 homes now carry the
return block on every fresh seed, and any check reading either page is reading
this fixture.

### D-162 — every count I found on billing and both homes

| Where | Was | Now |
|---|---|---|
| guardian hero, three tiles | `0 Links active`, `0 Expiring in 30 days`, `0 Club registers` | each tile omitted at zero; the whole hero omitted when all three are |
| club hero, register tiles | `New 0` / `Shortlisted 0` / `Invited 0` | `tile()` returns null at zero |
| club hero, unverified | `0 waiting` | `Nobody is waiting yet` |
| player page-completeness | `0 of 6 done` | omitted; the bar says the same absence |
| coach page-completeness | `0 of 6 done` | omitted |
| administrator hero (new) | — | squads / trials live / roles open, each omitted at zero |
| `/club/billing` | — | renders **no count at all** |

The rule's other half is left alone: "No trials coming up. Post one and it goes
on your club page and the trials board the same minute." and "Nobody has
registered interest in your trials yet." stay exactly as written. `z1`/`z2`
assert that no rendered numeral on `/home` (seven seats) or `/club/billing` is
the digit zero.

### The two mockup facts I did not build, and one line I could not

* **The card's last four and the receipt address** — not added, on instruction
  and on D-25. `money10` asserts the billing page mentions no `last4`,
  `card_brand`, `receipt_email` or similar; `b8` asserts the served HTML carries
  no "Visa", "ending in", "••••" or "Receipts go to".
* **"What you have paid"** (the invoice list) — not built. Charges are not
  stored; it needs an `invoice.paid` webhook writing a row. The mockup says cut
  it if the day is not there.
* **"What it is doing"** (100 on your register / 12 since 14 Sep) — not built.
  It was not in the four facts I was given, "since you last paid" needs a period
  start we do not reliably hold, and a register count on this page means a
  second read of children's rows on a money screen. Reported, not shipped.
* **"Last changed 9 Sep, by you"** on the administrator's club-page block — not
  built. There is no such timestamp on `club`, and adding one properly means
  writing it from five places (philosophy/pathway/established, crest upload,
  banner, players-wanted, alumni). A "last changed" that moves when the
  philosophy changes and not when the crest does is a lie. **Cost: one column,
  one `update ... set page_updated_at = now()` in each of the five writers,
  about an hour.** Not mine to start without a word.

---

## Ran

From a fresh seed, in TRAINING §4 order, on 54361/3061, at `c8cb1ae`:

| Suite | Result |
|---|---|
| `scripts/validate-migrations.mjs` | ALL GREEN (64 migrations + 18 structural) |
| `npm run test:perms` | **1237 / 1237** |
| `npm run test:render` | **469 / 469** |
| reseed → `node scripts/write-tests.mjs` | **338 / 338** |
| `node scripts/gate-coverage.mjs` | 262 doc 14 rows, **262 pinned, 0 open** |
| `node scripts/palette-check.mjs` | ALL GREEN (3 pre-existing raw hex, `app/manifest.ts`, `app/layout.tsx`) |
| `python3 scripts/corpus-check.py` | 0 failures, 0 warnings |
| `node scripts/secret-scan.mjs` | no secrets found |
| `npx tsc --noEmit` | clean |
| `npm run test:paths` | all safe-path checks passed |
| `SUPABASE_DB_URL=… npm run build:check` | built |
| `node scripts/layout-check.mjs 375 768 820 1024 1280` | **470 page views, 0 overflow** |

Call sites added: perms **+61**, render **+66**, write **+6** against `4c08f91`.

`test:render` is not read-only (it shortlists a registrant), so it ran before
anything I measured and the database was reseeded before the write suite.

**`df -h /`:** 20 GiB free before, **18 GiB after** the build check, 20 GiB after
I deleted `.next` and `.next-check` — which I have done, per L37.

### Proved red on today's code (L20)

*Database, with eight deliberate defects put back in the two migrations and the
register page — ten named checks went red and the rest stayed green:*
`O4c` (grace never reports suspension) · `money8b` (the register page decides a
payment state from the status column again) · `readers4` (an administrator sees
everybody when only a TD should widen) · `ret2` (the away window shortened to
six days) · `ret4b`, `ret4c` (the u16 refusal removed from `fn_note_arrival` —
a fourteen-year-old's visits get a timestamp) · `ret5` (the refusal removed from
`fn_return_facts`) · `ret6b` (a list load buries a CV opened) · `ret10`,
`ret10d` (the `last_checked` predicate removed — a stale trial date renders).

*Pages, with `app/home/page.tsx` and `app/club/billing/page.tsx` restored to
`4c08f91`:* **38 render checks red** — every `b*`, `ret-r*` and `ah*`, and
`z1` for a parent, which proves D-162 was genuinely being broken on a guardian's
home ("0 Expiring in 30 days").

*Write:* `bw5`'s property measured directly against the old page —
`/club/billing?error=1` served no such words. `bw2`–`bw4` pass on the old code
because the action already redirected; the defect was only ever that the page
said nothing.

---

## Found

1. **`.field-label` is still broken for 14 captions on three other screens.**
   `app/globals.css:341` defines it only as `.field > .field-label`. I fixed my
   five by using `lib/ui`'s style objects; `/club/post-trial` (8×),
   `/club/invite` (2×) and `/register-interest` (4×) still render their captions
   as body text. **The one-line fix — make the selector `.field-label` — belongs
   to whoever owns `app/globals.css` this week, not to me.**
2. **`.kicker` in `globals.css:547` uses `--ls-label` (0.06em).** The charter
   says section labels are 0.14em, and `lib/ui`'s `sectionLabel` is 0.14em. Two
   section-label styles, and the class is the wrong one. I used `sectionLabel`.
   Same owner as (1).
3. **`/club/squads` has its own inline `register_grant` query** for "who holds
   register access" (`page.tsx`, pinned by the existing `N23` check as a source
   match). That is a second answer to "who reads the register" and it is exactly
   the shape 0059 fixed for squad claims (L23). It should call
   `fn_club_register_readers`. Out of my lane; not touched.
4. **`fn_register_readers` (0047) says "Technical director"; everything else in
   the product says "Technical Director".** My new function says "Technical
   Director" (charter, D-93, `console-shell.tsx`). The odd one out is on a
   family screen, so changing it is a copy change and BUZ's.
5. **A cancelled club drops to the free-tier register with nothing said**, the
   same silence I was asked to fix for dunning. `fn_register_payment_state`
   returns `cancelled` and nothing renders for it, because "touch only the
   dunning branch" was the instruction and cancellation is a different truth
   (D-135's 30-day clock). One card's worth of work and one decision about what
   it says.
6. **A club in the 14-day grace sees nothing on its register.** `grace` keeps
   `fn_register_active` true, so the register renders in full and the only
   warning is on `/club/billing`. Arguably the grace card belongs there too;
   again, the dunning branch was the brief.
7. **With more than one child, the return block can mix them** — the most
   important read is about one child and the soonest expiry about another. Each
   line names its own child so it is not wrong, but it reads slightly
   disjointed. A per-child block is a bigger design question.

---

## Copy for BUZ — every new or changed user-visible string, verbatim

Nothing here ships until you approve it. The mockups mark their own suggestions;
these are those, plus anything I had to write to make a state true.

### `/club/billing`

Changed (one clause added to a built sentence):

> Cancelling lives here in your club settings and takes about as long as signing up did. Cancelling stops the next charge. Nothing is deleted, and the families who registered stay registered.

New, from the mockup:

> a month, including GST
> for twelve months, including GST
> Next charge
> unless you cancel before then
> On your statement
> Your subscription
> Who reads it
> If a payment fails

New, the subscription state in one word each (`Cancelled` cannot render today —
a cancelled club gets checkout, not the plan card):

> Active
> Payment outstanding
> Paused
> Cancelled

New, the reader rows (built from the database's answer):

> Technical Director · the whole register
> Coach · U14 Boys · U15 Girls
> Club administrator — reads no registration
> Team manager — reads no registration

Changed — the existing family-facing sentence with "here" dropped, because on
this screen the reads are not recorded on this screen:

> Only people a club has named can read its register, and every time they do, it's recorded.

New, the error nobody was shown:

> Nothing has been charged. We need your name, your role at the club, and the tick that says you're authorised.

Moved, not new — the built `past_due` copy, now in `RegisterPaused`:

> We couldn't take your payment
> Nothing has changed yet. We'll keep trying for the next fortnight. If it's still not sorted, the register is paused — your coaches stop seeing the list. **Nothing is deleted.** The families who registered stay registered, and everything comes back the moment a payment goes through.

New — the same words in the present tense, for a club whose grace has run out:

> We couldn't take your payment
> The register is paused — your coaches stop seeing the list. **Nothing is deleted.** The families who registered stay registered, and everything comes back the moment a payment goes through.

### `/home` — the return

> While you were away

The three lines, assembled from database facts (names, roles, clubs and dates
are data, not copy):

> {Reader}, {role} at {Club}, opened {Child}'s CV.
> {Reader}, {role} at {Club}, opened your CV.
> {Reader}, {role} at {Club}, saw {Child} on their register.
> {Reader}, {role} at {Club}, saw you on their register.
> {Child}'s link expires. Clubs holding it stop being able to open the page that day.
> Your link expires. Clubs holding it stop being able to open the page that day.
> The next trial we hold a notice for. Last checked {date}.

The mockup's fourth line — "Nobody outside Riverside FC asked to reach Deniz." —
is **not built**. It was not in the three facts I was given, and an absence
claim needs certainty about every channel an approach can arrive on.

### `/home` — a club administrator

> Squad you run
> Squads you run
> Trials live
> Coaching role open
> Coaching roles open
> The register is {Name}'s. You keep the club's page, its squads, its notices and its plan.
> Post a trial notice
> A notice comes off the board by itself the day after its date. Nobody has to remember.
> What a family cannot see yet
> Your crest
> The page shows an initial where the crest goes.
> Add it
> How the club plays
> The section is left out rather than shown empty.
> Write it
> Two things, not a score. A club page with nothing missing is not a better club.
> Your club page
> Copy the link
> Open it
> Public and live.
> Your trial notices are on it and on the trials board.
> Who can do what here
> You
> Technical Director — the register, and the club's development record
> Coach — the registrations for {teams}, since {date}
> Club administrator — the page, squads, notices, coaching roles and the plan. No registrations.
> Team manager — no registrations.
> A treasurer who sends the invoices should not be able to read a child's development notes. That is on purpose.
> Plan

Changed by D-162 (this one replaces a printed zero):

> Nobody is waiting yet

Re-used verbatim from the built checkout page, in a new place:

> The receipt is addressed to the club, not to you, so it can be reimbursed without an argument.
> Paying does not verify your club and cannot. Nothing about a player under 18 reaches you until we have spoken to someone at the club by phone.

---

## Two decisions that are yours, not mine

**1 · What a fourteen-year-old's "while you were away" block actually contains,
and whether it should render at all.**

Read receipts are sixteen-and-over: `fn_register_readers` gives an under-16
asking about themselves an empty set, and doc 34 rule 6 puts a child's read
ledger on the guardian's screens until sixteen. I did not touch that.

So for an under-16 the best line in the block does not exist, and what is left
is **two facts, both of which are already on their own page**: when their share
link expires (their hero says "Live · expires 12 October") and the next trial
notice (their page already links "Trials near you", and `next_trial` already
names one). The answer is "almost nothing", which is the finding.

`the-return.html` says outright that nothing goes on a player's home —
"a fourteen-year-old coming back after the off-season gets no ledger of who
looked at him, because that is the mechanic that would make him check". The
instruction that commissioned it says to build what is lawful for each band.
Where those disagree I took the restrictive side and put it in the database, in
both halves: **`fn_note_arrival` writes no timestamp of an under-16's visits at
all, and `fn_return_facts` answers an under-16 nothing.** So no under-16 sees
the block, and no page can assemble one by calling the parts.

The options, if you want it:
* **(a) as shipped** — nothing for an under-16, and nothing recorded about when
  they visit. Two facts they already have, not repeated.
* **(b) the two lawful lines** — link expiry and the trial date, on a
  fourteen-year-old's home after 60 days away. Costs: a `last_seen_at` on a
  child's row, and a block whose only new information is a date they can already
  see.
* **(c) link expiry only**, without the trial date, so nothing on a child's
  screen points outward after an absence.

**2 · The administrator sees the whole reader list, where I first built her own
row only.** `club-home-admin.html` draws Marina and Sam by name on Robyn's home
and argues it is the only place D-93's split is said out loud to the person it
constrains. Doc 14 N23 names the technical director and O11 attaches "must not
widen any minor-facing permission" to the administrator reading billing. I read
the design as settling it and widened the function — it carries no registration,
no child, no count of children, so nothing minor-facing moved (`readers4b`
asserts the column list). It is still a widening and it is written into the
migration header. Say the word and it is one line back.

---

## Risks, and what I did not check

* **The 24-hour window the return block stays up, and the 30-day freshness a
  trial notice must have, are product numbers I chose.** Both are named in the
  migration and both are one line. 60 days came from the review.
* **`fn_note_arrival` writes on a GET.** `/home` is `force-dynamic`, so every
  arrival is one `update person`. A Next prefetch of `/home` would count as an
  arrival — which is why the return is a 24-hour window rather than a
  one-render flash, so a prefetch cannot swallow it. I did not test prefetch
  behaviour in a production build.
* **I did not reproduce the mockups' emptiness percentages.** My first attempt
  at measuring "% of the viewport carrying something" reported 100% for every
  page at every width, which is a check that cannot fail (L19), so I threw it
  away. What I did measure in Chrome: the billing column is **968px** at 1280
  and 1440, laid out `594px + 320px`, where it was capped at 640px by
  `.reading`. Page height 989px against a 900px viewport.
* **The suspended-club fixture is new and only two suites walk it.** A safety
  read of Coburg City FC from every seat would be worth doing.
* **`docs/design/mockups/plan-and-billing.html` and `the-return.html` are
  untracked** in this tree and on `app`. I read them and deliberately did not
  commit another seat's design files; my commits cite them by path.
* Not run: `npm run demo`. Nothing here touches the demo layer, but 0063/0064
  are migrations and a running demo keeps the schema it started with (L14).

## Lesson

**A fixture that never fails is a suite that never ran the interesting path —
and the cheapest way to find that out is to write the check first.** Four of my
red-proof runs failed on the *test*, not the product: `ret6`/`ret7` assumed
"the only read in the window" of a guardian whose register the suite has been
loading for a thousand checks; `ret12` matched the word "times" inside
`timestamptz`; `ah4` counted sidebar words that the phone tab bar legitimately
repeats at another breakpoint (D-147: same doors at every width). Each one
looked exactly like a defect in the code. The habit that caught all four was
printing the actual value into the label — `check(\`ret-r2: … (${line ?? 'no
read line'})\`)` — so a red check says what it saw rather than `expected true,
got false`. Do that on any check that reads a rendered page; the page is a
fixture and the fixture moves (L32).
