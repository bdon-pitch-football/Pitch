# Proposal: the trials board, sign-up, sign-in and the claim, Floodlit (1 Oct 2026)

**From:** the proposal seat, for the Head of Product Design, then BUZ.
**Screens:** Leo's brief §5, items 3 and 4: `/trials`, `/join`, `/signin`, `/claim`, `/claim/[slug]`.
**Mockups (open from disk, no build):**
- `docs/design/mockups/floodlit-trials.html`: 6 states.
- `docs/design/mockups/floodlit-join-signin-claim.html`: 23 states.

Every state is drawn at 390 and 1280 side by side. It is the **same markup** in both frames: the frames are CSS containers and the page's breakpoints are container queries, so the mockup can't show a laptop anything the phone doesn't have (D-147). The 1280 frames are shown at 56%, and a tick box at the top switches them to actual size.

**Nothing committed, nothing in the app touched.** Only these three files are new.

---

## The idea, once

**These screens are built from the parts the club page and the front door already use.** Nothing new is invented:
- the nav bar;
- the floodlight;
- `.fl-card` and its two shadows;
- the club page's trial row;
- the light search field from `/`;
- the dashed "not yet" tile from the unclaimed club page;
- one field well (`.field`);
- one glowing primary per screen.

Two rules follow from it:

1. **A form is a door, a list is a page.**
   - A step that asks for something sits in one Floodlit panel.
   - A page that shows a list (the board, Find your club) sits on the page.
   - On a phone there is no panel. The 390 artboard is the column as drawn, and from 640px the same column is lifted onto the panel. That is a container change, not a content change.
2. **Dashed means "not yet".** The dashed tile is used in four places:
   - where a date would be on an empty board;
   - an unclaimed club's tile on the claim page;
   - the overseas path;
   - the club with no address.

   On the claimed screen, the dashed tile turns solid.

**What this proposal does NOT change:**
- **Words.** Every word is verbatim from the five files. New lines are listed separately below.
- **Content.** The fields each screen shows, and their order on the 390 artboard, stay the same.
- **The trials board rules.** Listings stay chronological with no recommender, and the four filters stay. Every listing keeps its "checked" date and "The club's own notice" link.
- **Country.** It is asked first, and the overseas path collects nothing.
- **D-172.** Nothing on or about an unclaimed club is an image or says it is with us.
- **Price.** None anywhere (D-163).
- **The charter rules.** No charter rule changes. The type scale, the five letter-spacings, the radii, the two buttons, stroke icons and 44px targets all hold. The logo keeps its own existing −0.035em. It is the Wordmark as built, not a new value.

---

## The screens, ordered by value for effort

### 1. The trials board (`/trials`) — build first

**What is wrong now:**
- The board is empty today ("0 trials"), so the empty state is what almost everyone sees. What they get is:
  - a filter card offering "Any age" and "All";
  - a note explaining "the button on each listing" when there are no listings;
  - one grey sentence.
- On a laptop, the board is a 640px island between two 1200px Floodlit pages (the club page and `/`), and both of them link to it from their nav.
- The listing row is drawn differently from the same trial on the club page:
  - on the board: a 14px title, a grey date box, and 44px pill buttons (a third button the charter doesn't have);
  - on the club page: a 16px title and a 28px date numeral.

**What the change does for the person:**
- A parent sees the same object on the board and on the club page. The date leads, as on the club page, and the stamps and the club's own notice sit where they sit on the club page.
- The one action per row moves onto the charter buttons:
  - "I'm interested" is the 50px primary;
  - "Send my CV" is the 46px secondary.
- "The club's own notice" is drawn as the club's link (underlined secondary text with an external mark), never as a Pitch action (John, 30 Sep).
- On a laptop (if **P1**), the filters sit in a sticky rail beside the list, so what's chosen and what it leaves are visible together.
- The empty board is honest and designed. If **P3** and **P4** are approved, it also becomes a way forward instead of a dead end.

**What it costs:**
- About a day with no decisions:
  - pull the club page's trial row into one shared component (it takes "Listed" as a prop, because only the board shows it);
  - put SiteNav on the signed-out board;
  - restyle the filters.
- P1 adds about half a day (the rail, plus the 1024–1031 layout check).
- P3 and P4 add about 2 hours, plus one new render check for the empty board.
- **Tests to keep green:**
  - **t3:** the phone filters must stay a `<details class="trial-filters"><summary>`.
  - **link-n2:** it splits cards on `>Listed `, so keep "Listed" at the start of its own element.
  - **z4:** no zero-count chip.
  - **The empty line:** keep it in one element (the mockup bolds the first sentence inside the same `<p>`) so the render suite still reads one string.

**What it does NOT change:**
- the order: title, filters, chosen chips and count, the how-it-works note, listings;
- chronological sorting with no recommender (D-74);
- the four filters (region is still the state, and the State group still shows only when there is more than one state);
- the chip counts and D-162;
- the signed-in seat frames (a player or parent sees the board inside their tab bar or rail);
- the analytics on this page.

### 2. Find your club and the claim (`/claim`, `/claim/[slug]`) — build second

**What is wrong now:**
- The front door's club search sends a club secretary from a full-width Floodlit hero to a plain 640px column with a different search field.
- The claim steps use three field styles on three screens.
- Twenty-three states exist and none of them feels like the page the secretary just came from.
- This is the one conversion clubs make, and clubs are the one audience.

**What the change does for the person:**
- The secretary types into the same light field on `/` and on `/claim`, in the same words.
- The claim steps sit on one panel with one glowing action each.
- The club's tile is the same dashed tile as on its unclaimed page, and it turns solid when claimed.
- The code is one large field: 34px display numerals, paste and one-time-code autofill, no JavaScript needed.
- "The code didn't work" gets an amber edge on the field as well as the approved line.

**What it costs:** about a day. Server components only, no new behaviour. The write sweep skips `/claim` (the Floodlit build note), so the render suite carries it.

**What it does NOT change:**
- The code still goes only to the club's own public address, masked on screen (John, D-172).
- The role is still stated, never chosen (D-93, doc 14 H10).
- The no-address route is still the phone call.
- "Tell us your club" still needs an account.

### 3. Sign-in (`/signin`) — build third

**What is wrong now:**
- The fields are 16px surface cards, while sign-up's are 12px wells, so the two doors into one product disagree.
- At 1280 it's a bare column with the logo top right, under a Floodlit nav elsewhere.

**What the change does for the person:**
- The page matches the door they came through (the logo-only nav, top left from 1024px) and the panel they'll see on `/join`.
- A refusal marks both fields in amber, because the one refusal line names both. There is still no enumeration (D-94 §2).

**What it costs:** 2–3 hours.

**What it does NOT change:** the words, the order, the emailed-link door as the secondary, or the entrance animation (it can stay).

### 4. Sign-up (`/join`) — build last

**What is wrong now:**
- Continue is a one-off button: radius 15, weight 900, and a 45% opacity that looks disabled when it isn't.
- The notes use the button radius (14).
- The roles are one long column on a laptop.
- "Why does a parent have to do this?" is drawn like a link but is a plain `div` that goes nowhere.

**What the change does for the person:**
- It's the same panel as sign-in and the claim.
- From 640px the roles go two-up, and first name and date of birth pair up ("pairs may go two-up", D-147). The reading order is unchanged.
- A closed door says why in amber, and Continue is visibly unavailable only when it is.
- For the club funnel (every secretary signs up here before they can claim), the Club role's own line already says a code and a phone call come next. The mockup shows that path end to end.

**What it costs:** about a day. It's a client component with seven steps and states, and the write suite drives its forms, so every `name` and the `country=AU` hidden field stay exactly as they are.

**What it does NOT change:**
- The country is still asked first, and the overseas path still collects nothing: no field, no form, no request (D-63, D-164(3)).
- The under-16 path is still the pending invitation.
- The under-18 guardian fields stay the same.
- No sign-up-step logic changes.

### What I would build first, and what I would not build at all

- **Build first: the trials board, with P1, P3 and P4 if BUZ agrees.** It's the most-seen public page in this set, every Floodlit nav links to it, and today it's empty for almost every visitor. It's also the cheapest win, because the row already exists on the club page.
- **Then the claim, then sign-in, then sign-up.**
- **Do not build these, from the concept prototype (`pitch-floodlit.html`, `mocks/trials.html`):**
  - **The role question inside the claim** ("Secretary / Technical director / President / Committee"). Choosing Technical Director on a form is exactly what D-93 and doc 14 H10 removed. This one is not a matter of taste.
  - **Six single-digit code boxes.** They need JavaScript for focus and paste. One field does both natively.
  - **The claim as a modal sheet over the club page.** Today every step is its own server-rendered address (`?sent=1`, `?bad=1`). A sheet would need JavaScript and would lose those addresses.
  - **A bottom tab bar on the signed-out board.** That's the player seat's frame, and signed-in visitors already have it.

---

## Product decisions for BUZ

Numbered for this proposal. Each needs a yes or no. None changes a charter rule. P1 and P2 extend D-173's scope.

| # | Decision | What it buys | What it costs | My recommendation |
|---|---|---|---|---|
| **P1** | **The trials board takes the Floodlit width** (`.fl-wide`, 1200px) from 1024px, with the filters as a sticky rail beside the list. Today D-173 (2) names only the front door, landings, club page and CV. | A laptop parent sees what's chosen and what it leaves together. The board stops being a 640px island between two 1200px pages that link to it. | Half a day. One more page off the 640px reading rule. The layout check needs a pass at 1024–1031, where the rail is tightest. | **Yes** |
| **P2** | **The public nav bar** (Find your club · Trials · Sign in) **on the signed-out `/trials` and on `/claim`**. `/join`, `/signin` and `/claim/[slug]` get the logo-only bar (logo right on a phone, left from 1024px). | The two pages every Floodlit nav links to link back. The auth steps stay focused. | New link placements for the render suite. No new words, because all three are approved nav words. | **Yes** |
| **P3** | **An empty board shows only what is true of an empty board**: with no trials at all, no filters and no how-it-works note. This extends D-162's logic ("an option that cannot change what you see is not an option"). A filtered-to-nothing board keeps both. | The most-seen state stops showing controls with nothing to control, and a note about buttons that aren't there. | 1 hour, and one render check for the empty board (t2 and t3 still pass on the seed, which has trials). | **Yes** |
| **P4** | **Two doors on the empty board, signed-out visitors only, in words already approved elsewhere:**<br>• "Build a CV first — it is what the club reads" (from the club page), a secondary button to `/join`;<br>• "For clubs & technical directors", "Put your trials where families can find them." and "Claim your club page" (from the club landing), a primary button to `/claim`. | The empty board isn't a dead end. A family gets ready for when a notice appears, and a club person landing here is pointed at the one thing that fills the board. | New content on the board, so the render suite gets two checks, and copy check sees the lines in a new place. | **Yes**. It's the only way the empty board earns its visits without new words. |

**New behaviour in the concept prototype.** These are product decisions separate from the look, and **none is in my mockups**:

| # | Idea from the concept | Why it is a product decision | My recommendation |
|---|---|---|---|
| C1 | **"Follow a club — we'll email you the day it posts."** | It's a new email that isn't a transaction (D-65 says transactional only at launch). It needs a consent record, a doc 15 message and an unsubscribe. It also stores which clubs a family, possibly a child's, is watching. | **Not now.** It's the most useful idea in the concept. Bring it back as its own brief with John. |
| C2 | **"Clubs near you", with distances ("3.2 km")** | It needs the visitor's location, which may be a child's. And "near you" is personalisation, which D-74 rules out on the board. | **No** on the board. A club directory is a separate question. |
| C3 | **The trial-season chart, "Most clubs post trials from mid-October."** | It's a factual claim we have no data for, and new copy. | **No**, until our own notices can show it. |
| C4 | **League tier on club rows** ("State League 2", "NPL") | It's a new field we don't hold. | **No**. |
| C5 | **"Near Sunshine" as a filter** | Region today is the state (no region taxonomy, D-74). A suburb or area taxonomy is new data. | **Later**, with a real taxonomy. |
| C6 | **A club-colours step inside the claim** | The colours form lives in Crest & club page and is limited to a TD or an administrator. Adding a step to the claim changes the claim flow. | **No** in the claim. A claimed club already sets its colours in the page editor. |
| C7 | **A role question in the claim** | It conflicts with D-93 and doc 14 H10. | **Never**. |
| C8 | **"Claimed · verification call next" pill on a claimed club** | Doc 14 M9 says families aren't told a club is unverified. | **No**. |

---

## Copy for BUZ

**New lines (only one):**

| # | Where | Line | Why |
|---|---|---|---|
| N1 | `/trials`, empty board, **only when nothing is filtered** (with P3) | **No trials listed yet.** | The approved line, "No trials listed for that yet.", is right for a filtered board and reads oddly on an unfiltered one. The rest of the sentence is unchanged. If BUZ says no, the approved line stays as it is. |

**Approved words in a new place (not new, listed so copy check sees them):**
- **With P4, on the empty board:**
  - "Build a CV first — it is what the club reads" (from the club page);
  - "For clubs & technical directors", "Put your trials where families can find them." and "Claim your club page" (from the club landing).
- **With P2, on `/trials` and `/claim`:** "Find your club", "Trials", "Sign in" (the nav bar's approved words).

**Existing lines that are wrong today.** These need BUZ as copy, not design. The mockups use them verbatim.

1. **`/claim`:** "That club is already **on Pitch**. Search for it above." This is said about a listed club that may be unclaimed, which is the phrase D-172 keeps off unclaimed pages. The copy check already suggested "That club is already listed. Search for it above." It's still open.
2. **`/claim/[slug]`, step 1:** "Claiming gets you the page and **trial notices**." This has the same problem as copy check F3 on the club page: only a verified club posts a trial notice (D-90, 0152). The claimed screen on the same flow says so itself ("Posting trials … waits for verification").
3. **`/claim/[slug]`, step 2:** "You run the page, the teams and **the trial notices**." Same issue as line 2, milder, because an administrator does run them once the club is verified.
4. **`/join`, under 16:** "Why does a parent have to do this?" It's a plain `div` that looks like a link and goes nowhere. Either it links to an approved page, or it goes. The mockup draws it as plain text.

---

## Notes for Leo's team (found while designing, not design)

- **The claim loses the club at sign-in.** `/claim/[slug]` sends a signed-out visitor to `/signin` with no way back, and after sign-in they land on `/home` and have to find the club again. This is the path every new secretary takes from their unclaimed page. A return path through sign-in would fix it. It's behaviour, so it's for you and BUZ.
- **Three field styles become one.** Sign-in uses surface cards, sign-up and the ask use `.field` wells, and the claim uses cards. The mockups put all of them on `.field`. `.field-label` stays at 10px, which is the layout check's rule.
- **Inside the ≥640px panel, wells step up one surface** (`--surface-hover` on `--fl-surface`), and cards inside it use `--surface-2`: action goes up, disclosure goes down, as in globals.css. These are existing tokens. The mockup adds no colour.
- **Back in a flow.** SiteNav hides its back link from 1024px, because on the landings the logo is the way home. In a flow, "Back" means the previous step, so hiding it would make it a phone-only control (D-147). The mockups keep one Back at every width: in the bar on a phone, and at the top of the panel from 1024px.
- **Fonts in the mockups.** `assets/fonts` has no 800 file, so 800 renders as 900 in the mockups only.

---

## Build order

1. **`/trials`**:
   - shared `TrialRow` with the club page;
   - SiteNav (P2);
   - charter buttons on rows;
   - the empty state (as the rules stand; P3, P4 and N1 if approved);
   - the rail (P1 if approved).
2. **`/claim` and `/claim/[slug]`**: the light search field, the panel, the dashed tile, the single code field.
3. **`/signin`**: the panel and the one field well.
4. **`/join`**: the panel, roles two-up, and pairs from 640px. Every form `name` and hidden field stays as it is.

Each screen goes through the full suites on a fresh seed before and after screenshots at 390 and 1280, as the brief's §7 describes.
