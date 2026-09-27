# Research — layers and life: what makes a product feel alive when nobody is performing

**Seat:** design, research · **Date:** 24 Sep 2026 · **For:** Leo, then BUZ
**Question from BUZ:** the app should be *"interactive, have layers, and not just be another app"*, and it should *"serve its purpose and provide real value to the users."* What does that mean in built products, and which mechanics can we use?

**The constraint that defines the question.** Pitch has, permanently and by design, no feed, no likes, no follows, no comments, no DMs and no recommender (pillar zero §4, D-21; D-03). Every mechanic in the mainstream engagement playbook depends on other people's attention. So this report is not "how do we get engagement" — it is *what is left when you delete the audience*, and the honest answer is: less than the industry thinks, but the part that remains is better suited to us than to any of them.

**Method and its limits.** Public material only: live marketing and product pages, published documentation, support articles written by the teams themselves, and one peer-reviewed paper. I signed in to nothing and opened no authenticated surface. No screenshots of other products are in the repo; everything is described in words. Where I am reasoning rather than citing, I say so.

**Housekeeping.** I could not run `df -h /` — this seat has no shell tool. My disk footprint is this one text file plus a 248KB research PDF that a fetch cached into the session scratch area outside the repo. Nothing was downloaded into `repo/`.

**What I did not re-do.** The 23 Sep seats already covered laptop density, LinkedIn's shell, profile-as-product widths, and dark-mode elevation ladders. I have not repeated any of it; where I lean on their measurements I cite the report. Read `2026-09-23-research-profile-pages-and-dark-ui.md` §B alongside §4 below — that is the token evidence and this is the behaviour.

---

## 0 · The answer, before the evidence

Three sentences, and the rest of the report is the working.

**"Layers" should mean depth in the record, never depth in z-index.** Every product I studied that feels genuinely layered without a social graph gets that feeling from one move: a number on the surface, and underneath it the *provenance* of that number — where it came from, when, who says so. Apple Health, Oura and GitHub all do this; a social profile does the opposite, getting thinner the deeper you go. We already hold the data this needs. D-62 forces a `provenance` field on every stat from day one and requires the UI to always display the tag. Today we render that tag flat. Rendering it as a layer is the single largest "this is not just another app" move available to us, and it costs no new data, no new permission and no new screen.

**"Alive" without an audience comes from the calendar, not from the app.** The products that manage it — Strava's Year in Sport, Apple's Activity Trends, tax software, fantasy sports — are pulled by a real-world rhythm rather than pushing notifications into a flat year. Australian community football hands us the strongest rhythm of any of them: Football Victoria's 2025 JBNPL trial window opened **Monday 14 October**, A-League academy trials ran **30 September to 7 November**, and clubs operating outside those parameters face *"fines, loss of competition points and removal from the competition structures"* ([Football Victoria](https://footballvictoria.com.au/news/2025-jbnpl-format-and-trial-window-confirmed)). That is not a marketing calendar. It is a regulated window, which means it is a limit as much as an opportunity — and that distinction is the whole safety argument in §3.

**"Real value" is the product remembering, in a year when the user does not.** The best-supported finding in this report is academic, not commercial: people lapse. Epstein and colleagues' lived informatics model — which won a 10-year impact award at UbiComp 2025 — found people lapse in four distinct ways, *"forgetting to track, difficulty managing upkeep, intentionally skipping entries, and suspending tracking"*, and modelled **resuming as a normal stage rather than a failure** ([Epstein et al., UbiComp 2015](https://dl.acm.org/doi/10.1145/2750858.2804250); [award](https://www.hcde.washington.edu/news/article/2025-10-15/professor-sean-munson-and-collaborators-recognized-10-year-impact-award)). Our user will be gone from March to September. The design consequence is concrete and nearly free: the screen a returning family lands on must lead with *what changed while they were away*, never with what they failed to do.

Everything below is downstream of those three.

---

## 1 · The mechanics, with verdicts

Each: what it is, who does it, why it works, the Night Match form, which Pitch screen, the safety cost, verdict. Mobile parity is stated once here rather than eleven times: **none of these is a desktop-only or mobile-only capability** (D-147 constraint 3). Every one ships at 390px first.

---

### M1 · The provenance drill — one number, and underneath it where the number came from · **ADOPT**

**What it is.** A surface-level figure that opens, in place, into the evidence behind it. Apple Health runs four levels: Summary → a category chart → *Show All Data* → an individual reading with its **source app and timestamp** → an *About* explainer for the metric itself. Oura runs two: a single Readiness Score 0–100, and beneath it **seven named contributors** each phrased as a question the user actually has — *"How well did I sleep last night compared to normal?"*, *"How much load is my body under from my recent activity levels?"* ([Oura](https://ouraring.com/blog/readiness-score/)).

**Why it works.** The depth *increases* credibility. A social profile gets thinner as you dig — under the follower count there is nothing. Under a Health number there is a timestamped reading from a named device. Nielsen's rule is worth obeying exactly: progressive disclosure *"satisfies two conflicting user needs"* — power and simplicity — but designs beyond two disclosure levels *"typically have low usability because users often get lost"* ([NN/g](https://www.nngroup.com/articles/progressive-disclosure/)). Apple gets away with four because Health is a reference tool people live in. **We should build exactly two.**

**Night Match form.** A stat tile on the CV is today a number, a label and a provenance tag. Make the tile a disclosure: tapping it expands a `.card-sunken` well *inside* the stats block — same 12px inner-well radius, one `--line` hairline, no shadow, no overlay — carrying two or three lines:

```
GOALS   14                                      Self-reported
─────────────────────────────────────────────────────────────
Entered by Deniz, 14 March 2026
2026 season · Riverside FC U15
2025 season · 9
```

Kicker at 11px/800/0.14em `--muted`; values in `--ink`; nothing in accent. Where a stat is `coach_verified`, the second line names the coach and the club and the date — which is the moment the CV stops being a claim and becomes a record. That is the whole product, drawn.

**Which screens.** `/p/[token]` first (it is the acquisition engine and the quality bar), `/c/[slug]` second, `/build/[recordId]` third.

**Cost.** Low in code; zero in schema. It must **push, not overlay** — a `<details>` expanding in flow, not a modal. Vercel's published guidance is the reason: *"The page is normally one continuous canvas"* and you *"earn a surface or boundary only when it communicates selection, interaction, warning, contrast, or a real grouping"* ([Vercel](https://vercel.com/design.md), via the 23 Sep dark-UI research). A modal over a child's CV is also a second render of the most dangerous surface in the product, which D-80 exists to prevent.

**Safety cost — real, and I cannot fully discharge it.** Every layer added below the surface is another layer that leaks if the token leaks. The disclosure must be served by the same single tokenised read path (D-80), must respect the age band (a 14-year-old's expanded tile must not name a coach in a way that hands a stranger a contact route — pillar zero §2), and must never surface club-side state: `club_status` never reaches a player (D-108) and must not reach a link-holder either. The `experience_entry` rows in particular must expand to free text and a type chip and nothing that looks like an affiliation, because D-72 says they grant access to nobody and the UI should not imply otherwise.

**BUZ decision?** **Yes, one line.** What a *stranger with a link* sees at level two versus what a *verified club* sees is a permission question, not a design one. CLAUDE.md is explicit: if a permission question is not answered in doc 14, ask BUZ — do not decide it.

---

### M2 · Design the return, not the streak · **ADOPT** *(cheapest real win in this report)*

**What it is.** Treating a months-long absence as the expected case and building the re-entry screen for it, rather than building machinery to prevent the absence.

**Why it works, and the contrast that proves it.** Duolingo publishes both halves of the argument in its own words. They state plainly that for veteran learners *"we tap into 'loss aversion,' an internal bias in your brain that makes you particularly averse to losing something, like a learning streak"*, and they publish the numbers: learners reaching a 7-day streak are **3.6× more likely** to complete their course; streak animations lifted 7-day retention **+1.7%** ([Duolingo](https://blog.duolingo.com/how-duolingo-streak-builds-habit/)). It works. It is also, precisely and by its own description, an engineered aversive state, and CLAUDE.md already forbids it over a minor: *"notifications to minors are strictly functional — no streaks, no re-engagement prompts, ever"* (D-65 as amended by D-81).

Against that, the research: lapsing is one of four ordinary behaviours, not a failure mode, and resuming is a modelled stage ([Epstein et al.](https://dl.acm.org/doi/10.1145/2750858.2804250)). A seasonal product with a nine-month off-season is the purest case of this that exists.

**Night Match form.** `/home` for a returning family opens on a `.card-sunken` block headed `WHILE YOU WERE AWAY`, rendered **only** when the last session was more than ~60 days ago, containing facts and no verbs aimed at the user:

```
WHILE YOU WERE AWAY
Riverside FC read Deniz's CV on 3 May.
Your share link expires on 12 October.
Community trials open in three weeks.
```

Each line already exists as data: the read ledger (M5), the D-53 90-day expiry state, and the curated trials index. No "you haven't updated in six months". No completeness score. No nag. Existing copy on our design page already has the right register for this and should be the model.

**Which screens.** `/home` (player, parent and coach seats), `/g/controls/[childId]`.

**Cost.** Trivial — copy plus ordering plus one `last_seen` comparison. Note `/home` is already 2,110px tall in the parent seat per the 23 Sep audit; this block goes **above** the queue, not below it.

**Safety cost.** Nearly none, with one rule: this block is rendered *on arrival*, never *pushed*. The moment it becomes an email or an SMS it is a re-engagement prompt, and to a minor that is banned outright. For a guardian it would still be a marketing send, which launch does not have (D-65).

**BUZ decision?** No. It contradicts nothing. The copy is user-visible and goes past the copy check.

---

### M3 · The season is the container of the record · **ADOPT** *(needs an artboard update)*

**What it is.** Organising the record by the unit the user's life is organised by, so the page is a history rather than a bio.

**Who does it.** Strava's Best Efforts tracks *"your fastest times at benchmark running and cycling distances"* across your whole history, and — the part that matters most to us — *"Your PRs (Personal Records) are private to you and aren't affected by privacy settings"* ([Strava](https://support.strava.com/hc/en-us/articles/216918487-All-Time-PRs)). The record-keeping half of Strava is private by construction; the leaderboard half is the social product bolted beside it. We want the first and are forbidden the second, and Strava shows they separate cleanly.

Apple Activity Trends adds the discipline: **it takes 180 days of data before trends exist at all**, comparing the last 90 days to the last 365 ([Apple support, via published guides](https://support.apple.com/guide/iphone/see-your-activity-history-trends-and-awards-iph4c34a8a95/ios)). Strava's personal Year in Sport requires at least three activities before it will generate. Both products refuse to draw the comparison until it is real. That is the same instinct as our never-zero rule (D-70), applied to time instead of to stats.

**Night Match form.** The stats block on the CV groups by season, most recent first, each season a `.card-sunken` well with the season in the 11px/800/0.14em kicker and the club as a `--muted` second line. Seasons with no data are **absent**, never rendered empty — the never-zero rule extended from tiles to seasons. A player with one season gets one well and the page does not look holed, because a single well reads as a card and a single empty row reads as a bug. GitHub's technique, measured first-hand by the 23 Sep seat, is the precedent: **silent omission for authored sections, and the page simply ends.**

**Which screens.** `/p/[token]`, `/build/[recordId]`, and the print document.

**Cost.** Low in code — `player_stat` is already keyed `(record_id, season, stat_key, source_experience_id)`, so the grouping is a sort. **But this is content, not container.** D-147 is explicit that the 390px artboards are the source of truth for content and order, and this changes the order on the phone too. So it is a design change that needs the artboards updated and BUZ's sign-off, not a quiet container fix.

**Safety cost.** Grouping data we already hold and already render is not new collection (D-25 is satisfied). The real cost is subtler: a season-by-season record of a 14-year-old makes *gaps* legible. A missing 2025 season may be an injury, a family that could not pay fees, or a kid who stopped playing — and a club reads this page. My mitigation is that absent seasons are silently omitted rather than shown as a gap in a sequence, which is exactly why I would not build the grid in K1 below.

**BUZ decision?** **Yes** — user-visible content change on a signed screen.

---

### M4 · "Last season, in place" — the record answering you while you write to it · **ADAPT**

**What it is.** Showing what you entered last time, at the moment you are entering this time. Hevy and Strong do this in the set row: the previous session's weight and reps sit greyed in the field you are about to fill. Hevy's own framing: *"Staying motivated is easier when you can see how far you've come"* ([Hevy](https://www.hevyapp.com/)).

**Why it works.** It converts a blank form — the single most abandoned object in software — into a continuation. Nothing social is happening; the product is simply the only thing in the world that remembers.

**Night Match form, and the amendment I would insist on.** D-70 is unusually specific here and it constrains the mechanic: the edit form *"shows a muted placeholder, never a pre-filled zero, because a form showing zeros invites people to leave them and reads as already-saved."* So we cannot prefill last season's number into this season's field — that is the same defect wearing a nicer jumper. Instead, put it **beside** the field, not in it:

```
Goals · 2026 season     [        ]     2025: 9
```

Right-aligned, 12.5px/500, `--muted`, no accent, no arrow, no delta, no "+5". A fact, not a scoreboard.

**Which screens.** `/build/[recordId]`, the season rollover flow.

**Safety cost — and this is why it is adapt, not adopt.** Our stats are `self_reported` and a child can see last year's number while typing this year's. That is an invitation to inflate, and CLAUDE.md already treats inflation as an existential quality risk: the catalogue is deliberately limited to appearances, goals, assists, clean sheets and minutes because *"nobody counts them, everybody estimates upward, and a moat around invented numbers is not a moat"* (D-11 via the 25 Aug delta). A visible prior number plus a self-report field is a mild inflation pump aimed at a fourteen-year-old. The delta display (`+5`) would be a strong one — never build it. Even the plain prior value is a judgement call I would rather BUZ made than I did.

**BUZ decision?** **Yes, small.** Is showing last season's self-reported number beside this season's field acceptable, given the inflation risk? I lean yes without the delta. I would not ship it without him saying so.

---

### M5 · State and consequence: the read ledger, deepened · **ADOPT**

**What it is.** The interface visibly changing because of what the user did — and, for us, because of what was done *to* them.

**We already have the best version of this in the product.** The 23 Sep benchmark found it: player `/home` carries "Who has read your registrations" — the named club, the named technical director, when he opened the CV, and a control to come off the register. That seat called it *"the best desktop screen in the product"* and the reason is exactly this report's thesis: it holds accountability rather than recommendations.

**The layering move.** Apply M1's pattern to it. Each read is a dated row; the row opens in place into what was visible at that moment and the revocation control sits inside the same well:

```
Riverside FC                                       3 May, 7:42pm
  Opened by Tom Ellery, Technical Director
  What they could see: CV, positions, 2026 stats, 4 clips
  [ Take Deniz off this register ]
```

The consequence is legible and reversible in the same object. That is "state and consequence" with a child-safety payload instead of an engagement payload — and it is the thing no competitor can copy, because it requires an append-only consent spine (D-78) and a computed permission engine to produce honestly.

**Which screens.** `/home` (player and parent seats), `/g/controls/[childId]`, and — per the 23 Sep P3 — in the console rail where one is earned.

**Cost.** Low. The audit log is already append-only and CLAUDE.md already requires we be able to answer *"what was accessed, by whom, when"* from it. This is a read view over data we are obliged to hold anyway.

**Safety cost.** It improves our posture rather than costing us anything — with one honest caveat in §5.

**BUZ decision?** No. But the copy is delicate; see the objection in §5.

---

### M6 · Milestones that are dated and permanent — the half of gamification that survives · **ADAPT**

**What it is.** A dated, permanent marker of something that actually happened, as opposed to a counter measuring how often you open an app.

**The contrast.** Apple's Activity Awards are earned for real events — a new Move record, a perfect week, 100/365/500 Move goals — and are viewable in a dedicated Awards area. The published criticism is instructive: users report that awards *"only display the most recent time they were accomplished"* and want the full dated history back ([Apple discussions](https://discussions.apple.com/thread/256083194)). People want the ledger, not the badge. Duolingo's streak is the opposite object: a counter whose only referent is the counter.

**Night Match form.** We already have the schema. D-71's `entry` type discriminator includes `milestone`. Render milestones on the record as dated lines in the player's own history and, where the guardian approves, on the CV:

```
MILESTONES
First XI debut · Riverside FC · 3 May 2026
100th appearance · 19 July 2026
```

No badge art. No counter. No "you're on a roll". Stroke SVGs only if anything at all, per the charter — and I would use none. The kicker plus dates carries it.

**Which screens.** `/build/[recordId]`, `/p/[token]`, the print document.

**Cost.** Low, but note it is an authored entry, so for an under-16 it inherits D-119: an edit returns to the guardian, approved and pending versions both exist, and the record never blanks during pending.

**Safety cost.** Milestones authored by a club could become a soft ranking of children ("Player of the Month"). I would restrict the vocabulary at launch to facts about the player's own participation — debuts, appearance counts, team achievements — and explicitly exclude anything comparative. D-85's banned language applies: no "potential", no "elite" under U13.

**BUZ decision?** **Yes** — the milestone vocabulary is a product rule, and a closed list is safer than free text on a page a club reads.

---

### M7 · Seasonality: the product changes shape four times a year · **ADOPT, with a copy rule**

**What it is.** Value arriving in bursts tied to a real calendar rather than being spread evenly and artificially across a year.

**Who does it.** Strava's Year in Sport is the commercial archetype — an annual personal recap, gated on having at least three activities, and *"Only you will be able to see your Year In Sport on your Progress page"* ([Strava Help](https://support.strava.com/hc/en-us/articles/22067973274509-Your-Year-in-Sport)). Private, bounded, annual.

But the more useful models are the regulated ones, because they are what our users actually live inside. Football Victoria publishes hard windows — NPL trials from **Monday 14 October 2024**, A-League academies **30 September to 7 November**, U14 through U17 — with sanctions for clubs operating outside them ([FV](https://footballvictoria.com.au/news/2025-jbnpl-format-and-trial-window-confirmed)). US college recruiting runs the same machinery at national scale: the NCAA divides the year into *contact, evaluation, quiet, recruiting shutdown and dead periods*, and for most sports coaches cannot reach out to a recruit until **June 15 or September 1 going into junior year** ([NCSA](https://www.ncsasports.org/ncaa-eligibility-center/recruiting-rules/recruiting-calendar)).

**Why this is the most important finding in the report.** Those calendars are not growth mechanics. **They are child-protection instruments.** A dead period exists so that adults cannot contact children out of season. Which means the correct reading of "seasonality" for Pitch is inverted from how a growth team would read it: the window is a **limit** we display, not an **urgency** we manufacture.

**Night Match form.** One block on `/home`, headed `WHAT'S ON`, whose content is the calendar and never a recommender:

```
WHAT'S ON
Community trials are on now.               4 near you →
NPL trial window opens 14 October.
```

In the off-season the same block renders plainly and points at the record instead — *"Nothing is on until September. The quiet months are when the record gets built."* Chronological, curated, and sourced only the two ways D-90 allows: a verified club posts its own notice, or we compile one from the club's own public notice. Pair it with the 23 Sep P6 recommendation to group `/trials` by month, which makes four notices read as organised rather than as a stub.

**Which screens.** `/home` (all seats), `/trials`.

**The copy rule, and it is non-negotiable.** Never *"clubs are looking — update your CV now."* That is manufactured urgency aimed at a child and a nervous parent, which is the exact emotional lever the Australian youth-football industry has been pulling for thirty years and the reason D-85 bans "potential" outright. The block states what is happening and when. It never states what the reader should feel about it.

**Cost.** Low in code, **high in standing human commitment** — see the objection in §5.

**BUZ decision?** **Yes.** New user-visible content on `/home`, and someone has to own the weekly check.

---

### M8 · Craft: layer without shadow and without gradient · **ADOPT (a, b, d) / ADAPT (c)**

Four moves, all inside tokens we already have.

**(a) Depth into the record goes down; action goes up.** Carbon's layering model is the clearest published statement of the idea — *"the dark themes lighten with every layer: Gray100 → Gray90 → Gray80"* ([Carbon](https://carbondesignsystem.com/elements/color/overview/)). Our ladder already does this: `--bg #0b120e` → `--surface #121b16` → `--surface-2 #1a2420`, plus `--surface-sunken #0e1712` (`globals.css:234–241`). We also already have the right rule written down — *"raised = act here, sunken = read this."* Extend it into a disclosure rule: **every level of disclosure renders sunken inside its parent**, so level two is visibly *inside* level one without a single shadow. The 23 Sep seat computed that a good dark elevation step is a **1.05–1.10:1 contrast change** across five independent systems — barely visible, and that is the point. Ours should sit in the same band.

**(b) The hairline does the elevation work; the shadow is atmosphere.** Primer's floating shadow tokens all begin with a `0 0 0 1px` ring, and Material's Android docs say outright that shadows *"have less contrast with the dark background colors"* (both via the 23 Sep research, §B2). Our `--line #24322a` is already calibrated in the decorative band. Rule: **we never add a shadow to make a layer.** If a thing needs to feel raised, it gets a hairline and a surface step.

**(c) The transition is the layer.** Material's container transform *"creates a visible connection between two distinct UI elements by seamlessly transforming one element into another"*, so that when a card becomes a detail page the user identifies the page as *"an expanded version of the card"* ([Material](https://m2.material.io/design/motion/the-motion-system.html)). For us the one place this pays is the register row → CV navigation, where it answers "where am I" without needing a rail — complementing the 23 Sep P2 rather than duplicating it. **Adapt, tightly:** 120–180ms, transform and opacity only, fully removed under `prefers-reduced-motion`, and it must remain a real navigation to the real page. It is a visual continuity cue, never a second render of the CV (D-80).

**(d) The inset accent edge.** We already ship `box-shadow: inset 3px 0 0 var(--accent)` on the current nav item (`globals.css:194`). That is a genuine material cue — the accent reads as lying *under* the surface and showing at the cut edge — and it costs one line. Use it to mark **the season you are currently reading** in M3's stack. Never for status; status stays in pills at 9.5px, per the 23 Sep P4 finding that our single accent had quietly become three.

**Cost.** (a), (b) and (d) are CSS and a rule in the charter. (c) is a small amount of code and a reduced-motion branch. **BUZ decision?** No, except that (a)'s disclosure rule is worth writing into the charter so the next person does not reach for a shadow.

---

### M9 · The pending version, made legible to the child · **ADOPT**

**What it is.** A child authors; an adult approves; the child can see their own work waiting rather than staring at a void.

**Who does it.** Seesaw is the closest structural analogue to our guardian spine that exists: children document their own learning in a journal, and *family members view approved work* — teacher approval gates what the family sees ([Seesaw Help](https://help.seesaw.me/hc/en-us/articles/205803229-Using-The-Learning-Journal-to-engage-with-your-student-s-work)). The instructive contrast is ClassDojo, whose behaviour-point system means teachers must choose whether *"families see all points, positive-only, or no feedback points"* ([ClassDojo Help](https://help.classdojo.com/hc/en-us/articles/360010117191-Who-Can-See-a-Student-s-Portfolio-Posts)). Same population, same adults, opposite object: one shows a child's work, the other shows a child's conduct score to adults.

**Night Match form.** D-119 already gives us both halves — an approved version and a pending version, clubs always read the approved one, *"the record never blanks during pending"*, and silence never auto-publishes. The craft addition is to render the pending diff **in place** on the child's own view: the changed block in `--secondary` inside a dashed `--line` border, with one plain line beneath it, parent-readable and not policy narration — *"Your mum is looking at this."* The wait becomes legible instead of a void, which is the difference between a product that feels alive and one that feels broken.

**Which screens.** `/build/[recordId]`, `/g/pending/[recordId]`, `/g/controls/[childId]`.

**Cost.** Low — both versions already exist by decision. **Safety cost:** none; it strictly improves comprehension of a control we are already required to have. **BUZ decision?** No, but the one line of copy is user-visible.

---

## 2 · My own ideas, killed by pillar zero

BUZ asked for this reasoning explicitly, and it is worth as much as the proposals.

**K1 · A contribution graph for the record.** GitHub's dated activity grid is the canonical "record that grows" visual and my first instinct. It is dead twice over. First, the 23 Sep seat measured that GitHub **force-renders** the contribution graph on a sparse profile while silently omitting authored sections, and called the empty graph *"the single most exposing element on a sparse GitHub profile."* Second, and fatally: over a child, a grid of football activity is a picture of injury, of a family that could not pay fees, of a kid who stopped playing — rendered on a page a club reads, in a fixed comparable format. That is adjacent to pillar zero §11 (a minor's public CV never shows a negative number) in spirit even though no number is negative. **Killed.**

**K2 · "Others at your club added clips this week" / "players like you".** A recommender over people, which over our population is a recommender over children. Out by pillar zero §4 and D-21. **Killed** — and worth noting this is the same shape the 23 Sep seat killed in LinkedIn's profile rail. It keeps trying to get in.

**K3 · A streak or a weekly goal for a child.** Duolingo publishes that it works and publishes that the mechanism is loss aversion. CLAUDE.md's rule is absolute: no streaks, no re-engagement prompts, ever (D-65/D-81). **Killed** — and I would go further: do not build it for adults either, because the same component then exists in the codebase one boolean away from a minor.

**K4 · Percentiles or peer comparison of any kind.** "You're in the top 20% of U15 attacking midfielders on Pitch." Strava does this in Year in Sport and it is the most engaging single element in that product. For us it is a ranking of minors, and it collides with D-85's banned "potential" head-on. **Killed** — and the enforcement should be structural: do not compute cross-player aggregates at all, so the UI rule cannot be quietly relaxed later. This also constrains M2 — **the comparison set is the person's own record, forever.**

**K5 · A view *count* for a minor.** M5 is named, dated and revocable. "1,204 views" is the identical data turned into a scoreboard, and `who-viewed-your-CV` is already scoped as an 18+ premium row. **Killed for minors**, and the distinction — named-and-revocable yes, aggregate-count no — should be written down, because the count is one `SELECT COUNT(*)` away at all times.

**K6 · Any notification that brings a child back.** "Three clubs looked at you this week" is the most effective retention message this product could ever send and it is banned outright for minors. Safety-relevant messages go to guardian and child together (D-19). **Killed.**

**K7 · A "Deniz's 2026 season" share card.** Spotify Wrapped's entire value is that it is shareable, and this is the one killed idea I would take back to BUZ rather than bury, because a lawful path exists. D-101 as amended means the guardian sees the exact artefact as an image before it can leave, and D-89 caps what a minor's card may carry: first name plus surname initial, positions, squad number, stats, nothing else — no surname, no club, no age group, no region. A season card is buildable inside those rules. But the *instinct* that makes Wrapped work — make it irresistible to post — is precisely the instinct pillar zero exists to stop, and it must never be prompted to the child. **Downgraded** to: a printable season page for the family, and an approved image only via the existing D-101 path, never auto-generated and never suggested. **BUZ decision.**

**K8 · Unlocking depth with use.** "Complete your record to unlock your season view." Gamified progression over a child, and adjacent to the profile-completeness nag the 23 Sep seat already flagged as a line we are close to. **Killed.** Depth is either in the product or it is not.

---

## 3 · What we should not copy from others, and why

- **Duolingo's streak and its loss-aversion framing.** Their own published words describe an engineered aversive state. Effective, documented, and banned here.
- **ClassDojo-style conduct points on a child, visible to adults.** The opposite object to a development record: it measures compliance, it is comparative, and it goes to adults. Seesaw's work-portfolio-with-approval is the model to take instead.
- **UCAS showing a teenager "unsuccessful."** UCAS Hub displays decision statuses to 17-year-olds including *unsuccessful* — *"that provider has decided not to offer you a place"* ([UCAS](https://www.ucas.com/applying/after-you-apply/clearing-and-results-day/results-day/what-your-application-status-means)). This is a live, at-scale demonstration of exactly what D-108 bans: *application, applied, declined, rejected, unsuccessful* appear nowhere in our product, for any actor, on any surface. Worth showing BUZ, because it is outside evidence that the decision is not fussiness — it is the difference between a child reading a rejection and a child reading nothing at all.
- **NCSA/Hudl-style recruiting exposure.** NCSA markets that *"more than 35,000 college coaches actively search NCSA profiles every year"* ([NCSA](https://www.ncsasports.org/recruiting)). Searchable minors is the default in that category. Ours is the inverse and must stay so: U16s appear in **no** search surface, 16–17s only to verified clubs and verified coaches with a guardian off-switch (pillar zero §2–3, D-22).
- **Strava's social layer.** Kudos, segment leaderboards ranking people, the feed. Take Best Efforts and PRs — the private record-keeping half — and nothing else.
- **Bento-style tile grids for a sparse profile.** The 23 Sep seat's rule and it is exactly right: *a grid advertises what is missing; a single column just ends.* Our never-zero rule means a legitimate CV may carry two stat tiles.
- **Material's elevation ramp.** Lighten-with-depth as a monotonic ramp produces mud in dark themes; two to four planes is the convergent answer across every system the 23 Sep seat measured. We have four. Stop there.
- **Any recap that is designed to be posted.** See K7.

---

## 4 · The five most worth building, with the objection I could not answer

| # | Mechanic | Verdict |
|---|---|---|
| 1 | **The provenance drill** (M1) — one number, and underneath it where it came from, who says so, when | **Adopt** |
| 2 | **Design the return, not the streak** (M2) — `WHILE YOU WERE AWAY` on `/home`, facts only | **Adopt** |
| 3 | **The season as the container** (M3) — the record grouped by season, empty seasons absent | **Adopt** (artboards) |
| 4 | **The read ledger, deepened** (M5) — each read a dated row that opens into what was visible, revocation inside it | **Adopt** |
| 5 | **Seasonality as the shape of `/home`** (M7) — `WHAT'S ON` as a calendar, never as urgency | **Adopt** (owner needed) |

**1 · The provenance drill.** *Objection I cannot answer:* it makes the CV materially more useful to a stranger holding a link. Every layer below the surface is another layer that leaks if the token leaks. My only answer is that the tokenised read path is the one thing we test hardest and budget five days for — and that is an argument about engineering discipline, not a design argument. If BUZ wants a design answer, the honest one is to gate level two on the viewer being a verified club, and accept that a parent forwarding the link to a family friend then sees less than a TD does. That is a permission decision, not mine.

**2 · Design the return.** *Objection:* I cannot tell you it will work. The evidence that people lapse is strong and peer-reviewed. The evidence that a well-built re-entry screen brings them back is not published anywhere I found — every product that has measured this measured it alongside push notifications, which we do not have. It is cheap enough that being wrong costs a day, but I could not find a product that proves it.

**3 · The season as the container.** *Objection:* for a fourteen-year-old at their first club there is exactly one season, and every mechanic here is at its weakest on day one — which is precisely when we are trying to acquire. The record gets better every year and our whole soft launch happens in year zero. I do not have a good answer beyond "build it anyway because the shape of the data is not on the cut line", which is true and is not the same as it looking good in October.

**4 · The read ledger.** *Objection:* it is the most honest thing in the product and it may also be the thing that frightens a parent into deleting the account. *"Riverside FC opened Deniz's CV four times in April"* reads as diligence to one parent and as surveillance to another, and I genuinely do not know which a Melbourne parent hears. That is a copy test with three real families, not a design decision, and it should happen during shakedown when warm families run the flow.

**5 · Seasonality on `/home`.** *Objection:* the calendar is real but our data about it is manual by decision — D-74 and D-90 keep the trials index hand-curated, two sources only, with added-on and last-checked stamps. A `WHAT'S ON` block that is wrong in the first week of October is worse than no block at all, and it is a standing weekly human commitment that nobody has been assigned. I cannot answer who checks it every Monday. Until someone's name is on that, the block should render only what carries a fresh last-checked stamp, and render nothing when it does not.

---

## 5 · Decisions this report needs from BUZ

1. **M1** — what a stranger-with-a-link sees at disclosure level two versus a verified club. A permission question; doc 14 territory; not mine to decide.
2. **M3** — user-visible content and order change on signed artboards (season grouping).
3. **M4** — may a self-reported field show last season's value beside it, given the inflation risk? I lean yes, without any delta display.
4. **M6** — the milestone vocabulary should be a closed list, not free text, on a page a club reads.
5. **M7** — new content on `/home`, plus an owner for the weekly calendar check.
6. **K7** — a season artefact for a family: printable page yes; approved image via the D-101 path only, never prompted to the child. Confirm or kill.

---

## 6 · What is still open

- **Whoop's monthly performance assessment** and **Garmin Connect** are the two closest "record that grows" products in sport that I did not get behind, because their substantive material is behind a login. Both are reported to do the "you versus you, over months" narrative well. I have excluded them rather than repeat second-hand descriptions.
- **The Epstein CHI'16 follow-up** (*Beyond Abandonment to Next Steps*) would give the six named reasons people stop tracking, which would sharpen M2's copy considerably. The PDF would not render on this machine (no poppler). The UbiComp'15 model gave me the four lapse behaviours and that was enough for the argument, but somebody should read the CHI'16 paper before the re-entry copy is written.
- **Sleeper and other seasonal sports products** that visibly change shape between off-season, draft, season and finals would be the best craft reference for M7. I did not get to them and they are chat-and-league-heavy, so the transferable part is narrow.
- **No first-party design writing exists** for any youth-sport recruiting product I looked at. Everything in §3 about that category comes from their marketing pages, which is enough to say what they do and not enough to say why.

---

## Sources

- [Duolingo — How the streak builds a habit (loss aversion, retention figures)](https://blog.duolingo.com/how-duolingo-streak-builds-habit/)
- [Epstein, Ping, Fogarty, Munson — A Lived Informatics Model of Personal Informatics, UbiComp 2015](https://dl.acm.org/doi/10.1145/2750858.2804250) · [10-year impact award, 2025](https://www.hcde.washington.edu/news/article/2025-10-15/professor-sean-munson-and-collaborators-recognized-10-year-impact-award) · [Beyond Abandonment to Next Steps, CHI 2016](https://dl.acm.org/doi/10.1145/2858036.2858045)
- [Nielsen Norman Group — Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- [Oura — The Readiness Score and its contributors](https://ouraring.com/blog/readiness-score/)
- [Apple Support — Activity history, trends and awards](https://support.apple.com/guide/iphone/see-your-activity-history-trends-and-awards-iph4c34a8a95/ios) · [Apple discussions — award history request](https://discussions.apple.com/thread/256083194)
- [Strava — All-Time PRs ("private to you")](https://support.strava.com/hc/en-us/articles/216918487-All-Time-PRs) · [Best Efforts](https://support.strava.com/hc/en-us/articles/19685360245005-Best-Efforts-Overview) · [Your Year in Sport](https://support.strava.com/hc/en-us/articles/22067973274509-Your-Year-in-Sport)
- [Hevy — history, previous sets and personal records](https://www.hevyapp.com/)
- [Day One — features, On This Day, calendar view](https://dayoneapp.com/features/)
- [Football Victoria — 2025 JBNPL format and trial window confirmed](https://footballvictoria.com.au/news/2025-jbnpl-format-and-trial-window-confirmed)
- [NCSA — NCAA recruiting calendar (contact, evaluation, quiet, dead periods)](https://www.ncsasports.org/ncaa-eligibility-center/recruiting-rules/recruiting-calendar) · [NCSA recruiting overview](https://www.ncsasports.org/recruiting)
- [UCAS — what your application status means](https://www.ucas.com/applying/after-you-apply/clearing-and-results-day/results-day/what-your-application-status-means)
- [Seesaw — using the Learning Journal](https://help.seesaw.me/hc/en-us/articles/205803229-Using-The-Learning-Journal-to-engage-with-your-student-s-work) · [ClassDojo — who can see a student's portfolio posts](https://help.classdojo.com/hc/en-us/articles/360010117191-Who-Can-See-a-Student-s-Portfolio-Posts)
- [IBM Carbon — colour and the layering model](https://carbondesignsystem.com/elements/color/overview/)
- [Material Design — the motion system (container transform)](https://m2.material.io/design/motion/the-motion-system.html)
- Ours: `CLAUDE.md` (pillar zero, D-62, D-70, D-71, D-90, D-101, D-108, D-119, D-147), `app/globals.css` (surface ladder, `--surface-sunken`, inset accent), `app/home/page.tsx`, `docs/design/reports/2026-09-23-benchmark-linkedin-and-peers.md`, `docs/design/reports/2026-09-23-research-profile-pages-and-dark-ui.md`
