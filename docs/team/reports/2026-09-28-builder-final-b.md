# builder: final round B — the four launch calls, coach-verified stats, the erasure wipe (28 Sep)

Asked: build D-164's four calls (front door behind a switch, the CV's context marker, the country step, adult-only Premium rows), D-160's coach-verified stats, and D-166's erasure wipe, per `docs/team/briefs/final-B-launch-features.md`. Render only APPROVALS-28-SEP words, and hold every signed-design line that states a price, a date or free places.

Tree `.claude/worktrees/builder-final-b`, branch `builder-final-b`. The work commit is 46088ec. `app` moved during the round (builder-launch-gaps merged), so it was merged in, not rebased (e4b9a90). Two layout faults the suites found were fixed in 1775cbd. The last commit carries this report and the desk bar's 44px "Sign in". Every number below was measured on the merged tree. Migrations 0080–0084.

## Did

**1 · The front door, behind the launch-day switch (D-164 (1)).**
- `0080_front_door_switch.sql`: `app_config 'front_door_open' = 'false'` and `fn_front_door_open()`, the only reader. Only the literal `true` opens it: a typo does not, and neither does a missing row. It is the same shape as 0075's billing switch.
- `app/page.tsx` is **not touched**. My first build made `/` ask the database, and that alone changed the page: an async page streams its `<title>` and metadata into the body and adds Suspense markers. So `proxy.ts`, in its own delimited block, rewrites `/` to `app/front-door` only when the switch is on. It fails closed: if the switch can't be read, the answer is the coming-soon page. A direct request for `/front-door` gets a 307 back to `/`, so the front door has one address. `app/front-door/page.tsx` also returns not-found while the switch is off. The method-stamping line for `lib/link-preview` is untouched.
- `components/front-door/FrontDoor.tsx`:
  - The chooser follows Home.dc.html. The landings are LandingParent, LandingPlayer, LandingCoach and LandingClub, each at `/?for=<seat>`, so the whole front door sits behind the one switch.
  - DeskLandingClub's accent band and top bar, with its "Sign in" link, appear from 1024px.
  - Held lines are **not in the file** (list below), so they cannot render by accident.
  - The links from the chooser to the landings are plain `<a>`, not `<Link>`. A prefetch skips the proxy and would have fetched `/` as the coming-soon page.
  - The designs' two off-palette persona colours (#d95926, #3987e5) are mapped to tokens, following the precedent set on the register screen.
- `app/dev/front-door/route.ts` flips the switch for the suites. It is gated exactly as `/dev/billing` is: POST only, no production, no demo.
- Links that pointed nowhere:
  - Unclaimed club pages (`/fc/[slug]`) now carry "Claim your club", linking to `/claim/[slug]`. The /join club door already told people to "press Claim your club", and that button didn't exist.
  - `/home` gives a player under 18 with a confirmed parent a "Share my CV" button (Main.dc.html's second button), linking to `/share-card/[recordId]`. An adult isn't offered it, because a share card is an under-18's, approved by a parent (D-101).

**2 · The CV states its context (D-84).**
- `0082_cv_states_its_context.sql`: `fn_birth_quarter(date)` returns 'Jan–Mar' / 'Apr–Jun' / 'Jul–Sep' / 'Oct–Dec', or null. `fn_approved_cv` now stamps `birthQuarter` on the way out, the same place it already adds the club line and the D-161 filter. It is never stored. `lib/record-read.ts`'s live assembly reads `fn_birth_quarter(p.dob)` beside the band.
- `PlayerCV` puts "U15 · born Jan–Mar" directly under the name. The age group is the one the page already carries (the confirmed squad). The marker only renders for a "U" plus number group, which is the shape of every approved string. Anything else, including an adult's "SEN", or a missing age group or quarter, renders nothing.
- The OG image, the share-card image and `lib/cv-meta.ts` don't read it (D-89).

**3 · The country step (D-63).** `/join` now opens on "Where do you live?" with "Australia" and "Somewhere else", before the name and the date of birth, in every door on the page (player, parent pending invitation, coach, club).
- **Somewhere else** shows "Pitch is only in Australia for now." and nothing else. There is no field, no form, no action and no request.
- **Australia** reveals the existing form, and both forms that create anything carry `country=AU`.
- **Server:** all four actions in `app/join/actions.ts` call `inAustralia()` first, before the rate limiter writes a row, and redirect to `/join` otherwise. The answer is not stored.

**4 · Premium rows, adults only (D-164 (4), D-82).**
- `0081_premium_interest_count.sql`: `premium_interest(feature, taps)` with RLS. That is the whole table: no person, no session, no IP, no per-tap time.
- `fn_premium_interest(person, feature)` adds one only if the person is 18+ by `fn_age_band`, so a form posted from anywhere can't record a minor's interest. The person id is read to answer that question and is not written.
- `components/PremiumRows.tsx` follows Highlights18: two rows, each with a lock, a PREMIUM tag and "Coming soon", then the tap line. It has no price.
- It renders only under `band === '18plus'` on `/build/[recordId]/clips`, and under `c.adult` on `/coach/edit`.
- `components/premium-actions.ts` decides where to redirect from what the form says it was on, never from a client-supplied path. After a tap, the page says "Premium is coming. You’re first in line."

**5 · Coach-verified stats (D-160, approved default 7).** `0083_coach_verified_stats.sql`:
- `player_stat` gains:
  - `entered_at`. Rows that exist when the migration runs take the migration time, which only affects seed data, because `app` has never been deployed.
  - `verified_club_id`, `verified_by` and `verified_at`.
- `player_stat_history` is new and append-only by trigger. Only an erasure may take a name off a row, or delete rows with the erased child's record.
- **`fn_verify_stat(actor, stat)`:**
  - Who may verify is the existing answer: `fn_write_provenance` must return `coach_verified`, which covers a WWCC-attested squad coach or the TD at a verified club.
  - The club it names is the player's own club where the actor holds that pen.
  - It sets the provenance, the club, the actor and the time. Nothing comes from a request.
  - It refuses zeros and stats that come from an "other football" source.
- **The trigger:**
  - No insert may arrive as `coach_verified`, and no update may promote a row, except inside `fn_verify_stat` for its one row.
  - Changing the value (the player's edit, which is the same upsert `lib/cv-build` runs) copies the old row to the history and comes back `self_reported`, with no club and no coach.
  - Re-saving the same number changes nothing.
  - Deleting a stat (the player blanks it) keeps a verified row in the history.
- **`fn_stat_public(record)`** is what every page reads, through `lib/record-read` and `lib/cv-build`'s snapshot. Per stat it returns the value, the provenance, `enteredOn` and, when verified, `verifiedClub` and `verifiedOn`, all as Melbourne dates. It has no field that could carry a person.
- **The tile.** It opens in place to "Verified by <club> · <date>" or "Self-reported · entered <date>". The line comes from `provenanceLine` in `lib/football.ts`. There are two levels:
  - It pushes the page down rather than overlaying it.
  - It uses no JavaScript: a checkbox per tile, and a second tap closes it.
  - A tile with nothing true to say (an official import, or a snapshot approved before 0083) doesn't open.
- Doc 14 gains **A20**: "`token` (live) reading a `coach_verified` stat — The verifying club and the date, and no person."
- **Seed:** Sam gets the U15 Boys squad that doc 16 §3b already gives him ("verified coach, squad-scoped access"). He verifies Deniz's goals through `fn_verify_stat`, and Deniz's approved snapshot takes its stats from `fn_stat_public`, standing in for the next approval. Without this, no seat in the dev database held that pen at all.

**6 · D-166 (`0084_erasure_wipes_free_text.sql`).**
- `fn_erase_child` now nulls `report.reason` and `investigation_access.what` for rows about the child. This happens before anything that ties those rows to the child is deleted or unlinked.
- A report counts as being about the child if it is tied to them in any of four ways:
  - an investigation grant on them;
  - a `content_hold` on their record;
  - a player_cv report whose reference is one of their share tokens' hashes (compared as hex, so a non-hash reference can't make `decode()` throw and roll the erasure back);
  - a coach_cv report on their own coach page.
- The log's append-only trigger lets exactly one update through, following 0067's `fn_is_erasing_name` pattern. It has to be inside `pitch.erasing`, on a row whose grant is on that child, setting only `what` to NULL, with every other column unchanged. Delete is still always refused.
- `what` loses NOT NULL, and a new trigger keeps the rule for new rows.
- It also takes an erased verifier's name off `player_stat` and `player_stat_history`.

## Ran

From a fresh seed, in TRAINING §4 order as `app` now words it (reseed → perms → render → write → reseed → layout → timing → reseed), on 54392 / 3190 / 9393. The load average was 3.6–5.0 throughout, with 17–19 GiB free. The suites were measured at **1775cbd**. After that, one style-only change widened the desk bar's "Sign in" link to 44px, and layout was re-run on it from a fresh seed.

- **perms:** 1620/1620. That is 1523 on `ec1a03a`, plus 61 from this round, plus the rest from the launch-gaps merge.
- **render:** 564/565. The one failure is **not mine**; see Found 1. This round adds 29 checks.
- **write:** 393/393.
- **layout 375/1280:** 206 views, ALL GREEN.
  - 22 controls were tabbed to.
  - The injected script was refused under the real policy.
  - The views include the five front-door views at each width (switch on, then off) and Deniz's CV with every well open.
- **timing:** 11/12.
  - E10 and J61 pass (resolution 0.70 ms and 0.94/0.66 ms).
  - **L40 fails: a real send is 2.05 ms slower than a limited one.** This was already red and already reported: builder-launch-gaps, Found 1, "failed on all eight runs, at +2.04 to +2.76 ms". Nothing here touches the send path.
  - The first full run had E10 and J61 INCONCLUSIVE (resolution 1.02 ms and 2.11 ms) at a load of about 7. They passed on the second run.
- **gate-coverage:** 263/263. A20 was added and pinned. E9 and E10 are now pinned by the timing suite, as launch-gaps changed the counter.
- **tsc:** clean.
- **palette:** ALL GREEN.
- **corpus:** 0 failures, 0 warnings.
- **secret-scan:** no secrets.
- **validate-migrations:** ALL GREEN.
- **build:check:** green. The proxy and `/front-door` are in the build.
- **test:csp-prod:** 5/5, on 3190 with the dev app stopped.

**The first full run found two layout faults in my own work, both fixed in 1775cbd:**
- Each stat's hidden checkbox measured as a 1×1 touch target, because the label that was the real target pointed at it from outside. The checkbox now sits inside the tile's label, and `:has()` opens the well.
- The ring pass found no fields on `/join`, because the page now opens on the country question. The pass now chooses Australia first.

**The merge also broke 5 of builder-launch-gaps' SMS write checks** (sms-w3/4/6/9/11): their drill signed up without the country step. Their sign-up now carries `country=AU`, like every other sign-up in the write suite.

**Proved red with the bug put back (L19/L20):**

| Bug put back | What went red |
|---|---|
| `/` asking the database (my first build) | fd0, fd4 |
| "Build my CV — free" and a dead link on the front door | fd2, fd3, fd-p3 |
| Marker removed, and the quarter added to og:description | ctx-r1, ctx-r4, ctx4 |
| A date of birth rendered, and any age group accepted | ctx-r2, ctx-r3, ctx5 |
| Premium rows shown to every band, and the age check dropped | prem-r5, prem2, prem2c, prem4 |
| A `last_person` column | prem3 |
| The tap landing without its confirmation | prem-w2, prem-w3 |
| The country check removed, and the page opening on the old step | ctry1, ctry3, ctry-r1, ctry-r2, ctry-w1, ctry-w2 |
| An input on the Somewhere else screen | ctry2 |
| The switch seeded on | fd-p1 |
| The insert guard removed, and the edit demotion removed | cv3, cv3b, cv5, cv5b, cv6 |
| The coach's name added to `fn_stat_public` and the tile | A20, A20b, A20d, A20e, prov-r1, prov-r2 |
| The D-166 wipe removed | erase7, erase7b, erase7c |
| The claim and share links removed | link-r1, link-r2 |

Each was restored and re-run green.

## Found

1. **`app` itself is red on render free-r1, and it isn't from this round.** The operator walk reaches `/ops/switches`, and builder-launch-gaps' SMS card (which renders outside production) reads "$0.00 spent this month". builder-final-a's free-r1 reads that as a price. The two were merged into `app` in 21d07a9, and neither branch's render run included the other's change. My diff doesn't touch `app/ops/switches` or free-r1. Fixing it is the launch-gaps owner's call: exempt the dev-only card, or drop the dollar figure when it is zero (D-162 also bars a printed zero).
2. **`scripts/migration-on-data.mjs` (from its default base 0050) stops at 0076.** Its fixture writes `email_opened` rows, and 0076's new CHECK rejects them, so it never reaches 0080–0084. With `--base 0077`, its own seed trips the 0058 TD rule. This isn't mine. It means the tool can't currently say what a migration after 0075 does to live data.
3. **The approved country line says "for now", and D-163 as amended says copy never says "for now".** APPROVALS-28-SEP approves "Pitch is only in Australia for now.", and D-164 itself writes "Australia-only for now". I rendered the approved words because the brief requires them and D-163's rule is about price. BUZ should confirm, or give a replacement. The Home design's "accounts are Australian at launch" is held for the same reason.
4. **The parent landing's button goes to a closed door.** LandingParent's "Set up your child’s profile" goes to `/join`, where the parent role says "This door is not open yet." A parent can't start a profile: the child starts it. The options for BUZ are:
   - reword the button;
   - point it at a page that explains the child-first flow;
   - open a parent-created door (D-17's first door, never built).
5. **No design carries a "find a club" way in, and no club search ships at launch (D-74).** The front door has sign up, trials, claim and sign in. I didn't invent a fourth. The options are:
   - label a link to `/trials` as finding a club;
   - build a club directory (a scope decision);
   - drop it.
6. **Front-door claims to check before the switch flips** (L25):
   - Parent: "One tap deletes it — You or your child". There is a guardian delete; I found no child-initiated delete.
   - Parent: "We keep a record that consent was given and withdrawn — nothing else." After erasure the investigation trail also survives (U-6, now without its text), as do entries the child wrote on someone else's record.
   - Coach: "The number itself is never shown or stored." That matches the product today, but D-98 leaves open whether we may hold the number.
7. **When a coach's verification reaches a u16's public page is BUZ's call.** A u16's page is the approved snapshot (D-119), so a verification appears with the next version the guardian approves. That is what I built, as the restrictive answer. The alternative is to show it at once, the way the club line already follows membership (BUZ's decision 2, `fn_cv_club`).
8. **The coach's button to verify a stat has no approved words, so it is not rendered.** Until it is, nothing in production calls `fn_verify_stat` (L13). Only the seed does, on the real function. A proposed label is below.
9. **D-166 names two columns; one more free-text column on the trail is not wiped.** `investigation_grant.extended_reason` is typed when a grant is extended once. It is listed by name in the new property check (erase7g), so it is visible. It is for BUZ and John.
10. **A report tied to two children loses its reason when either child is erased.** The text may name the erased child, so I chose the restrictive direction.
11. **The guardian approval page (`/a/[id]`) creates the parent's account and has no country step.** It isn't a sign-up door on `/join`, and a parent approving an Australian child's account from abroad is a question for BUZ, so I left it.
12. **fd0 pins a hash of the coming-soon page** (nonces and build chunks set aside), measured on `app` HEAD's own proxy and on mine: identical. Any deliberate change to the coming-soon page or the root layout must re-pin it in the same commit; the failure prints the new hash (L32).
13. **Doc 14 row A20 was added by a builder**, as D-160 says doc 14 gains it and the brief asks. Leo should read the row's wording.
14. **The DeskLandingClub design puts the logo at the left of its top bar.** I kept the wordmark top right (the "no exceptions" rule) and put only "Sign in" in the bar.
15. **A Premium tap counts taps, not people.** Anyone who taps twice counts twice. That is the price of keeping no identity.
16. **The seed changed a fixture that suites read** (L32). Sam now holds doc 16's U15 Boys coaching membership, so in dev he is Deniz's squad-scoped coach. That widens the pages the coach seat reaches. Render, write and layout are green with it. Anyone reading Sam's pages as a fixture should know.

## Copy for BUZ

**Rendering now, words from APPROVALS-28-SEP:**
- CV marker: "U15 · born Jan–Mar" (and "Apr–Jun", "Jul–Sep", "Oct–Dec"; the group is the player's own, for example "U18 · born Apr–Jun").
- Country step: "Where do you live?" · "Australia" · "Somewhere else" · "Pitch is only in Australia for now."
- Premium rows:
  - "Unlimited clips" and "See who viewed your CV", each with the tag "Premium" (drawn uppercase: PREMIUM) and "Coming soon".
  - "Tap a locked feature to be first in line."
  - After a tap: "Premium is coming. You’re first in line." (with a typographic apostrophe, as elsewhere in the product).

**Rendering now, not in APPROVALS-28-SEP. Please confirm:**
- The opened stat tile: "Verified by Riverside FC · 29 Sep 2026" and "Self-reported · entered 29 Sep 2026" (the patterns "Verified by <club> · <date>" and "Self-reported · entered <date>", as written in D-160 and the brief; "Sep" as D-160's own example writes it). Above each line is a small label made of existing words: "Goals · 11" (the stat's label and its number).
- "Share my CV" on a 16–17's home (the /share-card page's own heading, and Main.dc.html's button).
- "Claim your club" on an unclaimed club page (the phrase /join already uses, and the claim page's title).

**Behind the off switch. Needed before the front door is turned on, verbatim.** The tab title is "Pitch Football — every season on the record." and the description is "Seasons end. Coaches move. Clubs change. The record should be the thing that stays." (both new, based on the coming-soon title and Home.dc.html).

*Chooser (Home.dc.html):*
- "Somebody should be writing this down."
- "Seasons end. Coaches move. Clubs change. The record should be the thing that stays."
- "Who are you?"
- "A player" / "Your complete player passport"
- "A parent" / "Set up and control your child’s profile"
- "A coach" / "Six years of coaching on one page"
- "A club" / "Create your digital home ground"
- "Browse trials without an account"
- "Under 16, nothing exists until a parent approves it."
- "Already have an account?" "Sign in"
- "Back" (the header link on each landing)

*Parent (LandingParent):*
- "For parents"
- "Your kid’s football, kept properly."
- "Every season, every club, every goal they were proud of — in one record that belongs to them. Not a spreadsheet on someone's laptop that disappears when the coach does."
- "Set up your child’s profile" (twice)
- "You hold the keys"
- "This is a record about a child. The controls sit with you."
- "Nothing exists until you say so" / "Under 16, nothing your child builds is visible to anyone until you approve it — not to a club, not to a search, not to us. If you do nothing, it deletes itself in fourteen days."
- "Under-16s cannot be searched for" / "Not "hidden by default". There is no search on Pitch that reaches an under-16 — not for clubs, not for coaches, not for us. It is not a setting that can be switched on."
- "Nobody messages your child" / "There is no way to send a message to a child on Pitch. If a club wants to talk, it comes to you and your child together, and it is written down."
- "One tap deletes it" / "You or your child, any time, no reason needed. We keep a record that consent was given and withdrawn — nothing else."
- "What it's actually for"
- "A CV worth sending to a club" / "Position, squad number, the clubs they've played for, what they achieved, a couple of clips. Two minutes to build. It looks like something, which matters more at fourteen than anyone admits."
- "And a way to send it" / "Your child asks to send their CV to a club. It comes to you first — you check the address, you press send. The club gets a link you can switch off, not a file that stays in their inbox."
- "Coming soon"
- "What your child's coach is actually working on with them"
- "Everything they've done, kept — even when they change clubs"
- "Game time you don't have to count from the sideline"
- "Clubs finding your child when they're old enough"
- "Australia first · Data stored in Australia"

*Player (LandingPlayer):*
- "For players · 18 and over"
- "Stop retyping your football."
- "Every preseason you write the same email. Clubs, positions, what you did last year, a highlights link that expires. Build it once, keep it for good, send it in one tap."
- "Build my CV" (twice)
- "Two minutes, then it's yours"
- "Your position, your number, your clubs" / "Pick up to three positions from a real list. Add the clubs you've played for, and the football that happened outside them — school, futsal, rep sides."
- "The numbers you choose to show" / "Appearances, goals, assists, clean sheets. You pick which of them go on your page, so a keeper isn't stuck showing three zeros where the goals go."
- "Clips that stay put" / "YouTube, Instagram or Veo."
- "Sending it"
- "Send it to a club without writing an email."
- "Find a club or a trial notice, check the address, send. The club opens a page, not an attachment — so if you change clubs in March, what they’re looking at changes too. And you can switch the link off whenever you like."
- "One tap. No cover letter. No attachment."
- "Coming soon"
- "Clubs finding you, not just you finding clubs"
- "Your coach's word on your record, not only your own"
- "Every season you play, kept — whatever club you end up at"
- "Clubs asking to see your CV"
- "Nothing here promises a club will call you."
- "Australia first"

*Coach (LandingCoach):*
- "For coaches"
- "Six years of coaching, on one page."
- "Clubs, squads, badges, the way you actually want to play."
- "Build my coach CV" (twice)
- "One link, two jobs"
- "Going for a job" / "Send it to a club instead of a paragraph in WhatsApp. It exports to PDF too, for the clubs that still want one attached."
- "Building a squad" / "Copy the link into the group chat, the club newsletter, wherever you already talk to families. A parent deciding where to send their kid can read who you are before they meet you."
- "You copy your link and share it yourself. Pitch never sends it for you, and never gives you a player’s or family’s contact details."
- "Verified means something"
- "Your check, confirmed by your club" / "Your club confirms you hold a current check, and that is all anyone sees. The number itself is never shown or stored."
- "Coming soon"
- "Every season you coach becomes proof when you go for the next job"
- "A whole squad tracked in fifteen minutes"
- "The game-time question answered before a parent asks it"
- "You see your own record before your club does"
- "One place for your squad, instead of three group chats"
- "Australia first"

*Club (LandingClub, and DeskLandingClub from 1024px):*
- "Sign in" (the desk bar)
- "For clubs & technical directors"
- "Put your trials where families can find them."
- "Claim your club’s page, put your trial dates on it, and give families one place to check that isn’t a Facebook post they had to be following you to see."
- "Claim your club page" (twice)
- "What a claimed page carries"
- "Trial notices" / "Age group, date, ground, and the positions you're actually short of. Listings expire on their own, so nobody turns up to a trial that happened last month."
- "Every squad you run" / "MiniRoos through to seniors, each team a row of its own. Add one, retire one, in a tap."
- "Who you've produced" / "The pathway wall — where your juniors went on to."
- "Who reads a child’s record" / "You, and the verified coaches on that player’s squad. Not your administrators, not an unverified coach, not a rival club, and not us." (In the design this sits inside the Founding XI card. It stands alone here because that card is held.)
- "The Interest Register" / "Every player who wants to be at your club, in one list, all year — not forty emails and a form you built yourself in the fortnight before a trial."
- "Players register their interest inside Pitch. Nothing for you to build."
- "Filter by position, age and squad. The gap in your squad, in one tap."
- "The players you can’t take this year are still there next year."
- "Coming soon"
- "Never lose a player because nobody knew he was available"
- "Know what every squad is working on without asking four coaches"
- "Show a parent what their fees bought, in numbers"
- "Keep a player’s whole history when he moves up an age group"
- "Recruit the coach you want, with a record you can actually read"
- "Australia first"

**HELD: signed-design lines not rendered anywhere (price, date, "at launch", "for now", free places).**

*Home.dc.html:*
- "Free for every player under 18, and for every parent."
- "Australia first — accounts are Australian at launch."

*LandingParent:*
- "Free for every player under 18." (under the first button)
- "Free for every player under 18" (the second half of the footer)

*LandingPlayer:*
- "Build my CV — free" (both buttons; rendered as "Build my CV")
- "Three on the free tier."
- "What it costs" · "Free" · "$0" · "The whole CV, three clips, and sending to clubs. No time limit." · "Pro · Coming December" · "$79 /yr" · "Unlimited clips, and clubs asking for your CV. Opens December — tap to be first in line."

*LandingCoach:*
- "Build my coach CV — free" (both buttons; rendered as "Build my coach CV")
- "Hiring season runs September to December, and a coach with nothing written down turns up to it with a text message."
- "Free on every tier."
- "What it costs" · "Free" · "$0" · "The whole coach CV, your public link, and verification. Everything a volunteer coach needs." · "Pro · Coming December" · "$79 /yr" · "See which clubs opened your CV" · "Verified references from your clubs" · "Opens December — tap to be first in line."

*LandingClub / DeskLandingClub:*
- The Founding XI card, all of it:
  - "Founding XI"
  - "Be one of the first eleven clubs"
  - "Eleven clubs shape what Pitch becomes. You sit in the room on the roadmap — what gets built next, and what gets built at all — because a technical director knows what this game needs better than we do. A pillar under a product built to make football better for everyone in it: the player, the parent, the coach and the club."
  - "Recognition, never advantage. No search preference, no ranking, no edge for your players over any other club’s. That rule matters more to us than the badge does."
  - "Register interest in the Founding XI"
  - "The programme opens after launch. Registering now puts your club in front of us first."
  - No registration route for it exists either.
- "What it costs" · "Free, and it stays free" · "$0" · "Your club page, your squads, trial notices on the board, and players sending you their CV by email. No card, no trial period."
- "$329" · "for 12 months, inc GST" · "Save $319" · "$54" · "a month, inc GST" · "Cancel any time"
- "Paid by card, and your register opens the same minute. Paying buys you organisation, never access — the parent approval and the switch-off-able link are the same on both tiers."

*Highlights18.dc.html:*
- "More clips with Pro"
- "Coming December" (twice; "Coming soon" is used in its place, as approved)

**Proposed, not rendered (needs words):** the coach's control for verifying a number. The proposal is a secondary button "Confirm this number" on the squad CV page, shown only to a coach who holds the pen. The control, and so the server action that would call `fn_verify_stat`, wait for BUZ.

## Risks

- **`/` now costs one `select` per request in the proxy.** It fails closed to the coming-soon page, but a slow database makes `/` slow.
- **Links to `/` elsewhere in the product.** A client-side `<Link>` prefetch skips the proxy. Both existing links to `/` are plain `<a>`; a future `<Link href="/">` would prefetch the coming-soon page while the switch is on.
- **The drill has not been tried** with a screen reader or on a handset. The layout check measures it open at 375 and 1280.
- **The desk layout of the front door is only checked for overflow.** Nobody has looked at it against DeskLandingClub by eye.
- **Only the dev app has been tested with the switch on.** `build:check` builds the proxy and the front door, but nothing has served the built front door.

## Lesson

A page that awaits anything is not the same page. Next streams an async page's metadata into the body and wraps it in Suspense markers. So "unchanged while switched off" has to live outside the page, here a proxy rewrite, and it has to be proved by comparing bytes. Reading the component doesn't prove it.
