# The whole app, Floodlit: build handover (1 Oct 2026)

**From:** Head of Product Design. **To:** Leo and the tech team. **For approval:** BUZ, on the items marked below.
**BUZ, 1 Oct:** "go through the whole app, every persona screen and do the design specs based on what we liked … lay it all out for a handover to the build team."

## BUZ's approval (1 Oct 2026): "Yes to all, commit both and hand to Leo"

**Approved, build them:**
- the base pass;
- every spec as drawn;
- every "Recommended yes" decision below, including the defect fixes;
- the Head of Product Design rulings;
- the 12 new lines and the 7 removals;
- the lines listed under "to confirm as they stand": `FAILURE_COPY` as written and the coach page's December promise.

**Still not to build:**
- ~~**With John first.** D-PD-3, G-P1 with N-G1, and HC3.~~ **John cleared all three on 1 Oct, with conditions.** See the next section, which BUZ approved for building.
- **For BUZ with ops.** A-P7.
- **Not now, or don't build.** A-P2, C-P1, HD1, I-P3, I-P4, F-P6.
- ~~**Still open, one choice.** `/unsubscribe` "Join again any time."~~ **BUZ, 1 Oct: "Remove the unsubscribe line."** The line "Changed your mind? Join again any time." is removed from `app/unsubscribe/page.tsx` on this branch. The G mockup still draws it; ignore it there.
- **Billing lines.** The three lines F flagged get re-read before billing is switched on.

**For the register (Leo assigns the number at merge; the latest on both branches is D-173):** "BUZ, 1 Oct 2026: the whole app takes Floodlit (D-173) per `docs/design/specs/`. Consent answers carry equal weight: wherever a press gives something away, Yes and No are the same secondary button and nothing glows, superseding the green Yes in ParentApprovalV2, SendCVGuardian, InterestGuardian, ReapproveChanges, ShareApproval and GuardianReply. On a phone, each seat's one primary sits under its hero on `/home`. The operator console marks green only where work waits. The demo strip is dark with an amber Demo pill. The coach page and the jobs board take `.fl-wide`."

## John's rulings and BUZ's §36 call (1 Oct): all three cleared, so build them

**Source:** `13-Board-Room/JOHN-to-PRODUCT-DESIGN-three-rulings-1-oct.md`. **BUZ, 1 Oct: "Yes to the §36 window change, hand John's rulings to Leo."** The "with John first" items above are now approved, with John's conditions.

### 1 · G-P1: the undo link says whether it worked. **Build this first; John classes it as a defect.**

Today a §36 undo pressed after 24 hours silently does nothing, while the screen looks identical: a live false assurance.
- **Build G-P1 as specified:**
  - not-live panel on load (used, lapsed and unknown look identical);
  - "Done" only when a row was actually revoked;
  - "Go to sign in" plus the line N-G1;
  - the "This does not un-send the email" box stays on "Done".
- **John's addition: timing.** The not-live path does the same work as "Done": the same hashed comparison, the same cost. That way a stopwatch can't tell them apart (D-77, J2). Assert it by diffing two captured responses, as E9 and J40 do. Don't verify it by reading the handler.
- **BUZ amends U-2: §36's undo lives as long as the link it switches off, matching §37.**
  - **Code:** in `lib/send-dispatch.ts` (the `undo_token` insert, ~line 175), replace `now() + interval '24 hours'` with the §37 expression, `coalesce((select expires_at from share_token where id = $2), now() + interval '90 days')`.
  - **Records to amend** (the register moves first):
    - the U-2 entry ("for 24 hours, may revoke that link…", in `JOHN-to-LEO-doc06-entries.md` and doc 31);
    - doc 15 §36's header line, "Carries the twenty-four-hour undo.";
    - doc 14 L17's note;
    - any test that asserts the 24-hour expiry.
  - The §36 email body doesn't mention 24 hours, so no message copy changes.

### 2 · D-PD-3: a real "No" on `/a/[id]`

Approved, with John's conditions:
- **After one confirmed channel,** "Not now" (equal weight with Approve) purges the pending invitation at once, using the same purge as the 14-day job.
- **Record which channel ended it, and when,** so "who ended it" can be answered (as U-6).
- **The event is the existing `purged`** with reason `ended_by_recipient`. Don't add a new event. Assert the reason is **unreadable by any club actor** and **never surfaces to the child**.
- **No message to anyone.** Nobody is a guardian yet. An on-screen confirmation is all there is.
- **The child's waiting page changes its words, not its timing,** for both endings (expiry and ended): **"This request has closed. You can ask again whenever you like."**
  - "Expired" goes, because it's untrue when someone ended the request.
  - An immediate "expired" would let the child infer that a parent said no (D-17, U-1).
  - This line is new copy, carried by John's ruling and BUZ's hand-over.

### 3 · HC3: "call 000", identical in all three places

- **Change it on the report form, the report-received page and doc 25 so all three read word for word the same.** Use doc 25's sentence, which is John's approved legal text: **"If you believe a child is in immediate danger, call 000."**
  - The form's closing "In an emergency, call 000." becomes this sentence.
  - `FAILURE_COPY.urgent` becomes this sentence plus "Pitch is not an emergency service."
- **Don't add 131 444** to the emergency line.
- **fp12** moves with it.

## The unclaimed club page: John's D-172 rulings and BUZ's sentence (1 Oct)

**Source:** `13-Board-Room/JOHN-to-PRODUCT-DESIGN-unclaimed-page-three-questions-1-oct.md`.
**BUZ:** "Yes to the D-172 sentence, hand John's rulings to Leo." The sentence is now in D-172's note in `docs/06-Register.html`. **Copy it to the folder copy at merge.**

**The Floodlit unclaimed page (`/fc/[slug]` when `club_state = 'unclaimed'`) is no longer held.** It goes public when U1–U6 **and** these two new checks hold on the deployed site:
- **U1b (render):** the `fl-pitch-lines` SVG is byte-identical on two different unclaimed pages, and its stroke is never a club colour.
- **U5b (layout):** on an unclaimed page at 375×667, the banner's first line ("Pitch made this page from public information. {Club} has not claimed it.") is fully inside the first viewport. Test it with the longest seeded club name.

**Standing guardrails** (now in the register):
- **The nav on an unclaimed page stays generic:** never the club's name, a link about this club, or a "Claim" button. The claim stays below the banner.
- **The pitch drawing** stays generic, drawn inline (never a file) and neutral white.
- **No social proof on an unclaimed page, ever:** no count of clubs "on Pitch", no "clubs near you have claimed", no other clubs' logos.

## Club colours on the player CV: D-174 (BUZ, 1 Oct: "Yes, draft it and hand to Leo")

The register entry is **D-174** in `docs/06-Register.html` on this branch, marked Locked. **Confirm the number at merge** (D-173 is the latest on both branches), set the register version, and copy the entry to the folder copy. John's clearance: `13-Board-Room/JOHN-club-colours-on-the-player-CV-CLEARED-1-oct.md`.

**Before flipping `CV_WEARS_CLUB_COLOURS` to `true`, in this order:**
1. **Condition 1, a comment** beside `PRESETS` in `lib/club-colours.ts`: colours are only ever the club's own choice, never derived, sampled, averaged or scraped from a crest, photograph, kit or website.
2. **Condition 2, asserted:** the theme is null unless the current club is verified, and it follows a club change at once. **For an under-16, it changes only when the guardian approves the pending edit** (D-119), never on the pending version.
3. **Condition 3, the picker line** on `/club/page-edit`, where colours are chosen: **"Your colours appear on your club page, and on the CV of players who list your club as their current club."** This is new copy, carried by D-174.
4. **Condition 4, render coverage** of the CV with and without a club's colours, and of each clearing case (unverified, suspended, a club change, an under-16's pending change).
5. **Then flip the flag,** and update perms **cvc1** in the same commit. It currently pins the flag false "until John's ruling is recorded in the register", which is now true. **ctx4** (no colours on any card surface, D-89) stays exactly as it is.

Not cleared: colours on the coach page (needs its own ruling).

## What is in this folder

Every one of the 74 routes is in one of three places:
- **done**;
- **in a spec here**;
- **dev-only**: `/dev/*`, `/cv-preview`, `/preview/site`, not redesigned.

| Spec | Screens | Mockup (open from disk) | Build after base pass |
|---|---|---|---|
| `00-method.md` | The standard, the fixed rules, the spec format | — | — |
| `A-shells-and-homes.md` | **The base pass:** 24 shell parts (Frame, Seat bar, Rail/Console sidebar, Top bar, Page header, Panel, Well, Notice, Pill, List row, Stat, Empty tile, Table, Field, Door panel, Quiet shell, Failure shell…). **Plus `/home` for all eight seats.** | `floodlit-shells.html`, `floodlit-homes.html` | base pass **2 d** (moves all 74 pages), homes **2 d** |
| `C-player.md` | The CV builder (5 steps), Send my CV, share card, register interest, where do you play, SquadCard, `/manage`, print CV | `floodlit-player.html` (32 states) | **4 d** |
| `D-parent.md` | `/a` approval, done, `/g/card`, `/g/send`, `/g/interest`, `/g/pending`, `/g/invite`, `/g/controls`, `/join/waiting`, `/privacy/family` | `floodlit-parent.html` (39 states) | **3 d** |
| `E-coach.md` | Coach page, print, editor, register, jobs board, a role | `floodlit-coach-and-public.html` | **3½ d** |
| `F-club.md` | Register, register CV, squads, a squad, squad CV, roles, post a trial, page editor, invite (billing: none while off) | `floodlit-club.html` (33 states) | **5½ d** |
| `G-access.md` | `/confirm`, `/reset`, `/reset/[token]`, `/undo`, `/unsubscribe`, `/stop-cvs` | `floodlit-access-ops-demo.html` | **1 d** |
| `H-public.md` | `/report`, the five legal pages (one template), 404/500, the dead link, the footer | `floodlit-coach-and-public.html` | **1 d** |
| `I-ops.md` | The ten operator console routes | `floodlit-access-ops-demo.html` | **2½ d** |
| `J-demo.md` | `/demo` and the demo strip | `floodlit-access-ops-demo.html` | **½ d** |

**About 25 builder-days in total.** Only the base pass has to come first. After it, every group is independent and can be built in parallel.

**Already built** (reference, not in these specs):
- front door, persona landings, club page: `design/floodlit`, committed;
- player CV: `design/player-cv`, committed;
- trials board: `design/trials-board`, built and safety-reviewed (no blockers), with every suite green from a fresh seed (perms 1951, render 662, write 532, layout green), uncommitted;
- join, sign-in and claim: approved mockup `floodlit-join-signin-claim.html`.

## Build order (recommended)

1. **Base pass (A, steps 1–6).** CSS tokens, then `lib/ui` card, then `Frame`, then page header, then top bar, then the gallery. Step 4 depends on step 3; otherwise the logo vanishes at 1024.
2. **Demo (J).** Half a day, and BUZ shows it in every club meeting.
3. **Parent (D).** It carries the consent-button decision and removes four fake "No" controls.
4. **Club console (F).** The paying audience's laptop work surface.
5. **Homes (A, `/home`).** One seat at a time: administrator and unverified, TD, coach, player, parent, brand-new.
6. **Player (C).**
7. **Coach (E).**
8. **Access (G) and public (H).**
9. **Ops (I).**

**One branch, as with every design so far.** Each group goes through builder, then copy check, safety review and audit, then commit. Nothing merges to `app` or deploys without BUZ.

## Head of Product Design rulings (settled across groups; not for BUZ)

1. **The one glow.** `.fl-glow` goes on the screen's one primary *action*, in 390 reading order. It never goes on:
   - a button inside a list row (register, trials board, ops queue);
   - a consent answer (D, PD-0).

   A screen whose only primaries sit in rows has no glow. **Add a suite check: at most one `fl-glow` per rendered page.** This amends A part 18, "first `.btn-primary`".
2. **Remove in a list** is one text button, `.textbtn` (44px, text only), used in E, in F and in the approved trials/join mockups. `.btn-ghost` becomes an alias of it. `.console-btn` stays for table-row controls only.
3. **"New" stays green** on the club register (A part 15): green marks where work is waiting, the same rule as the ops queue (I-P1a).
4. **Dashed means "nothing to act on here"** (not yet, or no longer live). G's dashed glyph tile for a dead link is in.
5. **No literal colours.** J's demo strip uses `--line` for its hairline and lets the amber pill carry the state.
6. **Off-charter radii get normalised as part of the build:** `.cv-hero` and `.cv-avatar` (26px) and `ClipCard` (18px) become `--r-hero` (22) and `--r-card` (16).
7. **Print tokens** are C's (`--print-*`). E's coach print adopts them.
8. **Consent buttons may wrap** (`white-space: normal`) rather than truncate a club's name (D, `.fl-answer`).
9. **One line, both places:** the parent's empty state is "Nothing is waiting on you." on `/home` (A-N1) and on `/g/pending` (D-F2).

## Live defects found while designing (fix regardless of the redesign)

These are wrong in production today. Each spec has the detail.

| # | Where | What is wrong | Spec ref |
|---|---|---|---|
| 1 | `/home`, club administrator | Prints "$54 a month" whenever a payment state is active, which breaks D-163. Gate it on `billingEnabled()`. | A-P8 |
| 2 | `/home`, player | "Next trial" isn't filtered by age group: a 22-year-old and a 17-year-old are both shown a U14 & U15 Boys trial. | A-P4 |
| 3 | `/home`, operator | The Home door goes to `/home`, which falls through to the brand-new welcome. Read from source, not rendered. | A-P9 |
| 4 | `/g/card`, `/g/send`, `/g/interest`, `/g/pending` | "Not this one" is a plain `div` that does nothing. | D-PD-1 |
| 5 | `/g/pending`, `/g/send`, `/g/interest` | Three drawn buttons with no destination. | D-PD-2 |
| 6 | `/g/invite` | The two answers are painted wrong, so a saved "Interested, not that date" shows as "will be there". CSS only. | D |
| 7 | `/a/*` after approving | The second link lands on the root 404: "what was here may have been taken down". | D-PD-4 |
| 8 | `/g/pending` | The "approved" state renders when nothing was ever approved. | D-F2 |
| 9 | `/g/interest` | Refers to a "Manage page" that doesn't exist. | D-F3 |
| 10 | `/undo/[token]` | No after-state. The press shows the same question again, and after 24 h it silently does nothing. | G-P1 (with John) |
| 11 | `/reset/[token]` | Checks the link only after a password is typed. | G-P2 |
| 12 | `/unsubscribe` | "Join again any time." links to `/`, where there has been no waitlist since 1 Oct. | G C-G1 |
| 13 | `/share-card` | Tells an 18+ to ask a parent. | C-P9 |
| 14 | `/build/ready` | Offers "Send it to a club" to a 16–17 whose parent hasn't confirmed; it bounces to `/home`. | C-P7 |
| 15 | `/send`, `/register-interest` | A parent sending for their under-16 reads the child's words, then approves their own request by email. | C-P4 |
| 16 | `/fc/[slug]` | A parent's send button for a **16–17** child lands on `/home`. The button shouldn't render. | C-P4 note |
| 17 | `/share-card`, `/register-interest` | "Cancel" is a `div` with no destination. | C-P5 |
| 18 | `/build` | A failed photo upload shows nothing. | C-P6 |
| 19 | `/register-interest` | "Which squad" offers only "—" when the club has no squads. | C-P8 |
| 20 | `/coach/edit` | A JSX nesting slip puts the add-role form four sections below its list. | E3 |
| 21 | `/coach/edit`, no club | "We asked your club to confirm…" when nobody was asked. | EC4 |
| 22 | `/report?done=1` | "Contact your local police first", while the form and the policy say "call 000". | HC3 |
| 23 | 404 / 500 / report received | Every `FAILURE_COPY` line is still marked "AWAITING BUZ" in source, and live. | HC2 |
| 24 | `/club/register`, empty | Says the list was "just narrowed" when nothing was. | F-N1 |
| 25 | `/ops` | The "Approved" tile can print "Infinity% of sent". | I |
| 26 | `/ops/reports` | A suppressed parent link still shows the suppress form. | I |
| 27 | `/ops/verification`, no clubs | Draws the table head over nothing. | I |
| 28 | Demo strip | "Switch seat" is 24px tall, under the 44px floor. | J |

## Decisions for BUZ

**Recommended yes: they change a signed design or a fixed rule, so they need his word.**

| # | Decision |
|---|---|
| A-P1 | On a phone, each seat's one primary sits directly under its hero. This changes the fixed 390 order and is the biggest win for the five-second test. |
| D-PD-0 | Consent answers carry equal weight: Yes and No are the same secondary button, and nothing glows. This overrides the signed designs' green Yes. |
| I-P1 | Ops departs from its signed designs: green only where work waits, no red on the standing rules, and the chip becomes the pill. |
| J-P1 | The demo strip moves off solid green to a dark strip with an amber "Demo" pill. |
| E1 / E2 | The coach page, and the jobs board, go 1200 wide like the CV and the trials board. |
| F-P4 / I-P2 | Two-column laptop layouts: the page editor's sticky preview, and the call sheet with the claim beside the form. |
| C-P3 | The print CV carries the age-group line and Football history, as the screen CV does. |
| A-P5 | The brand-new home leads with the role picked at `/join`. This stores one field for adults only, which is a data-minimisation (D-25) call. |
| A-P3 | A claimed club's colours on its own seat, once club colours ship. |
| F-P1 | The register returns you to the same filtered row after a CV or an invite. |
| F-P2 | No zeros anywhere on the console (D-162), and an empty register shows no filters. |
| F-P3 | "Posted" shows the notice as the board will show it. |
| F-P5 | The weekday on club-posted listings. |
| C-P2 | The step tabs on all three build steps. |
| E4 / HD2 | Public nav on the signed-out coach page and the jobs board, and the logo links home on the report, 404 and 500 pages. |
| J-P2 | The club's crest on `/demo`. |
| A-P6 | "tell us" on the brand-new home becomes a mailto link; otherwise cut the line (N3). |

**The defect fixes above are also recommended yes.** They remove things that don't work: A-P4, A-P8, A-P9, C-P4…P9, D-PD-1, PD-2, PD-4, E3, G-P2.

**With John first:**
- D-PD-3: a real "No" on `/a`, which ends the request at once.
- G-P1 and its line N-G1: `/undo` after-states, which revise the D-77 reading.
- HC3: "call 000".

**For BUZ with ops:** A-P7, telling an unverified club when the verification call comes.

**Not now, or don't build:**
- A-P2: drop the door lists.
- C-P1: the two-column builder. **My call is not this round.** It moves two fields outside the `<form>` via the `form` attribute, which risks the write suite's form lookups.
- HD1: contents list on legal pages.
- I-P3: evidence on an empty reports desk.
- I-P4: clubs directory filters.
- F-P6: billing stays undrawn until Premium is priced.

## Words for BUZ

**New lines:**
1. "Nothing is waiting on you." (parent, `/home` and `/g/pending`)
2. "That photo didn't upload. Try a JPG or PNG under 8 MB." (`/build`)
3. "Profile photo" (`/build`, when a photo exists)
4. Parent-send lines on `/send` and `/register-interest`, mostly approved words shortened (C-N5):
   - "Send {first}'s CV"
   - "You send this one"
5. "…from Your family." (`/g/interest`, replaces "the Manage page")
6. "…Nothing is sent, and the club is simply not told." (`/g/invite`)
7. "{name} can see this too. Only {name} can reply." (`/g/invite`, guardian of an 18+)
8. "Sign in, and you can switch off any club's link from your child's controls." (`/undo`, with John)
9. "No club has claimed its page yet." (`/ops/verification`)
10. "Nothing yet today." (`/ops`)
11. "WWCC verified" in place of "WWCC" on the coach page chip
12. "call 000" in place of "contact your local police" (`/report?done=1`, with John)

**Removals:**
- "＋" from four add buttons;
- the repeated "Make a fresh link" heading;
- `/jobs` "This sends…" note;
- the dead link's third card;
- `/g/pending` "You can edit the words…" while editing isn't built;
- the brand-new "tell us" half (unless A-P6);
- `/coach/edit` "We asked your club…" when there is no club.

**To confirm as they stand:**
- every `FAILURE_COPY` line (HC2);
- the coach page's December promise (EC2);
- `/unsubscribe` "Join again any time." (remove, or point somewhere true);
- the three billing lines F flagged. They're unreachable while billing is off; re-read them before it flips.

**Approved words reused in new places** are listed per spec for copy check.

**Doc edit:** `docs/DEMO.md` "the green bar" line changes if J-P1 is approved.

## Suites that will move (change these in the same commit, never weaken them)

- **render ah3** and the failure-path and dead-link checks match `class="btn btn-primary"` exactly. Loosen them to `class="btn btn-primary[^"]*"` and keep ah3's count of 1.
- **render fp14** is the same exact-class issue. **fp12** finds "contact your local police first", so it moves with HC3.
- **ah12 and the D-162 zero sweep** read `class="numeral numeral-[lms]"`. Don't add a class to the numeral.
- **s3–s3e, s9** read the frame's `aria-label`, `seat-tab`, `console-nav` and `aria-current`. All are kept. The new glyph sits inside the link.
- **g32-r3** needs `<footer class="site-foot">` exactly. **leg-r4 and leg-r6** pin the legal markup, so the legal change stays CSS-only.
- **E11 and E11b:** `LinkState` keeps its exact signature and its source must never contain "photo" or "initials".
- **write-tests:**
  - they find the publish and take-down forms by the button's inner HTML, so no icon goes inside those two buttons;
  - they find consent forms by field, so every new "No" is an `<a>`, never a form;
  - they find the role form by its `org` field.
- **New checks to add:**
  - at most one `fl-glow` per page;
  - D-PD-4's four `/a` dead-link bodies are byte-identical;
  - the trials board's doors are tested for guardian and club seats as well as a player.
- **Layout:** squeeze-check 1024–1031 on every new two-column page, and the short-screen rule under 700px.
