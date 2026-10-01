# I — The operator console: build spec

**Seat:** design-proposal, for the Head of Product Design, then Leo's build team. **Date:** 1 Oct 2026. **Branch:** design/player-cv (nothing committed).
**Mockup:** `docs/design/mockups/floodlit-access-ops-demo.html`, section I (18 artboards, 390 and 1280, same markup, plus the TD panel's four states).
**Builds on:** the signed operator designs as built on 29 Sep (brief G: OpsToday, OpsVerification, OpsReports, OpsCall), brief I (Clubs), and the 23 Sep `ops-reports.html`. Where the 23 Sep proposal and the signed build differ, the signed build wins, and Floodlit wins over both.
**Shell parts** are named as in `specs/A-shells-and-homes.md`:
- **frame**, **rail** (with **rail mark** and **seat card**), **seat bar**, **More sheet**;
- **page header**, **panel**, **well**, **notice**, **pill**, **empty tile**, **table**;
- **home grid** (`.player-grid` alias), **field**, and **buttons and the one glow**.

## Summary

- **One idea: desk density, Floodlit manners.** The console keeps every word, row, form and door it has, and is re-drawn from A's parts only:
  - a table is one lifted card;
  - a form is **one panel** with hairline sections;
  - every state is a **pill**;
  - every empty list is the **empty tile**;
  - every standing rule is a **well**;
  - **green marks the row where work is waiting**, not every row.
- **What it fixes:**
  - Six-card call sheets.
  - Three hand-drawn copies of the same status chip.
  - Three differently built search rows.
  - A third field style on "Post a trial".
  - A 30px numeral off the numeral scale.
  - Red used for emphasis on rules that are not states.
  - A queue with twenty green buttons.
  - Blank screens on a quiet day (Today, and Verification with no claims).
- **At a laptop:** the call sheet and the club screen get two columns ("two jobs"). The claim and the TD stay beside the form while BUZ is on the phone. The phone order is unchanged.
- **Size:** A's base pass moves the rail, seat bar, tables and panels for free. The page edits are **about 2½ days** across ten routes (S–M each).

## Pages

Every page renders inside `OpsConsole` (frame, rail and seat bar) and opens with `OpsHeader`.

**After A:**
- The rail carries the **rail mark** (logo top left from 1024px) over the **seat card**: "Pitch operations" and the operator's email.
- The door counts are unchanged ("Verification 1", "Reports 2", never a zero).
- The seat bar shows Today · Verification · Reports · More. More holds Clubs, Lookup, Emergency switches, Home and Sign out.
- `OpsHeader` keeps its 17px title (A §7). Its HeaderMark becomes the **page header**: back link left, mark right on a phone, and at ≥1024 the mark hides (the rail has it) while the back link stays as a crumb. **The back link is kept at every width.** On the trial page it is the only way back to the club, and the rail does not carry it.

### /ops  ·  operator  ·  size S
- **Source:** `app/ops/page.tsx`, `components/console-shell.tsx` (OpsConsole, OpsHeader).
- **States:**
  1. A working day: any of the eight tiles, each omitted at zero (D-162). "Texts waiting for SMS" makes nine.
  2. Delivery failures present (table), or absent.
  3. **Quiet:** every tile is zero, so the page is the title and the footnote. It reads as broken (N-I2).
- **Phone (390):**
  1. Page header.
  2. Title "Today" and the date line.
  3. Tiles, two across.
  4. The failures panel (heading, guide line, table; each row is two lines).
  5. The count rule.
  6. Seat bar.
- **Laptop (1280):** rail. Tiles four across (`.ops-tiles`, unchanged). The failures table has four columns. The rule at the foot, as today.
- **Parts:**
  - Each tile becomes a **panel** (`.card`, via `card` in lib/ui, so the shadow comes from A) with `.panel-h`, the numeral `.numeral.numeral-m` (**34px; today 30px, which is not on the numeral scale**) and a `.hint` line.
  - A number is coloured only when it is that state, as today: Approved accent, Delivery failures red, Held / Awaiting / Asking / Texts amber.
  - The failures table sits inside the panel as a **table** with `box-shadow: none; background: var(--surface-2)` (a panel in a panel steps up, A §9).
  - The count rule becomes a **well** (`card-sunken`) with the info glyph. It was a raised card.
- **Copy:** verbatim: "Today" · "{Weekday D Month} · Australia/Melbourne" · the tile labels and lines ("Signups today", "to guardians", "{n}% of sent", "see below", "across {n} clubs", "clubs not yet verified", "oldest {n} days", "see Clubs", "Texts waiting for SMS", "parents' approval requests") · "Delivery failures — last 24 hours" · its guide line · "Channel" "When" "Provider said" · "Open in lookup" · "Everything on this page is a count. …". **New:** N-I2 (quiet day).
- **Must not change:**
  - Counts only. The page asks only `fn_ops_today`, `fn_ops_delivery_failures`, `fn_sms_queued_count` and `fn_club_requests_open` (ops-t1–t4).
  - The only door off the page is the lookup (D-79).
  - No zero is printed (D-162).
  - "Live subscriptions" stays out (D-163).
- **Done when:**
  - [ ] Tiles are panels with `data-ops-tile`, with the label `div` directly followed by the value `div` (the `ops-r2` regex depends on it).
  - [ ] The value uses `.numeral.numeral-m`.
  - [ ] The count rule is `card-sunken`.
  - [ ] (With N-I2) a day with every count at zero shows the empty tile with its one line, and no 0 anywhere.
  - [ ] `render-tests` ops-r2–r5 pass.

### /ops/verification  ·  operator  ·  size S
- **Source:** `app/ops/verification/page.tsx`.
- **States:**
  1. The queue: claimed clubs first, then verified and suspended.
  2. **Empty:** no club in those states. Today this renders the table's head row over nothing, with an empty subtitle (N-I1).
  3. **The TD line's six states:** none recorded; active; active on another name's account; waiting on their account; on hold (not the name on the call); the club's own address. A seventh, access ended, is dev-only words.
- **Phone (390):**
  1. Page header.
  2. The title and the count line.
  3. The standing rule.
  4. The table. Each row is the club's details full width, then held · state · action.
  5. Seat bar.
- **Laptop (1280):** the signed five-column table (Club · Claimed · Held · state · action). The columns are unchanged.
- **Parts:**
  - **table** (A §17).
  - The state is a **pill**: Awaiting call `pill-wait`, Verified `pill-live`, Suspended `pill-stop`. This replaces the inline chip.
  - **Green marks the work (I-P1a):** "Open call sheet" is `console-btn-primary` only on a row awaiting a call, and `console-btn` on the others.
  - The standing rule becomes a **well** with the shield-check glyph in `--secondary` and the first sentence in ink (I-P1b). The red triangle and the red colour go.
  - With N-I1, the empty state is the **empty tile**.
- **Copy:** verbatim, including every TD-line state and "No Technical Director recorded". **New:** N-I1.
- **Must not change:**
  - D-126: held registrations are a count here and nothing else.
  - There is no automated approve control anywhere.
  - The TD line renders `fn_club_td`'s answer and decides nothing (L23).
- **Done when:**
  - [ ] There is at most one `console-btn-primary` per awaiting row, and none on verified or suspended rows.
  - [ ] The state renders as `.pill` with its modifier.
  - [ ] The rule is `card-sunken` with no red.
  - [ ] (With N-I1) an empty queue shows the empty tile and no table head.
  - [ ] The table fits at 768 and at 1024–1031 (layout-check squeeze rule).

### /ops/call/[clubId]  ·  operator  ·  size M
- **Source:** `app/ops/call/[clubId]/page.tsx`, `app/ops/call/[clubId]/actions.ts`.
- **States:**
  1. The claim panel. It is omitted when there is no claimant. The held-count sentence shows only while claimed and held > 0.
  2. The TD panel in six states: none recorded; waiting; active, with the end-access form; on hold for a name mismatch, with the confirm button; club mailbox (red); access ended (secondary). See the mockup's TD panel artboard.
  3. The form, with its two unset questions (the action refuses the call without them).
  4. A malformed or unknown id → 404.
- **Phone (390):** order unchanged:
  1. Page header ("The queue").
  2. Title "Call sheet — {club}" and the suburb · email line.
  3. The claim panel.
  4. The TD panel.
  5. **The form as one panel**, its sections divided by hairlines:
     - Operator / Answered by;
     - The number — find it yourself;
     - The four questions;
     - Outcome / Why;
     - Technical Director;
     - Notes;
     - Log the call.
  6. Seat bar.
- **Laptop (1280):** `.call-grid`. The form is on the left, in the column minus the aside. The claim panel (sticky) and the TD panel are in a 320px aside on the right. **DOM order stays claim → TD → form**; the grid places them.
- **Parts:**
  - **panel** and `.ops-panel` / `.ops-sec` (new, below).
  - `.ops-field`, `.ops-input`, `.ops-seg`, `.ops-pair`: unchanged.
  - The section head "The number — find it yourself" goes from red to ink `.panel-h` (I-P1b: red is a state, and the bold sentence under it carries the weight).
  - The TD panel's state line keeps its colours: they **are** states (amber waiting or held, accent active, red mailbox).
  - "Log the call" is `.btn-primary.fl-glow`, the screen's one glow.
- **Copy:** verbatim, every label, note, option and guide line, including the approved name-held sentence and button, the ended sentence, and the suspension reasons.
- **Must not change:**
  - The thirteen log fields, their `name`s and values.
  - A blank `number_source` invalidates the call.
  - The first two questions start unanswered.
  - The role attaches only on the proved address (0058, 0121).
  - The child-safety reason decides who is told (0066).
  - The held number is never to be said on the call.
- **Done when:**
  - [ ] The form is a single `.card.ops-panel` whose sections are `.ops-sec` with hairlines between.
  - [ ] At ≥1024 the claim and TD panels sit in a 320px aside, and the claim panel stays in view while the form scrolls.
  - [ ] At 390 the order is claim → TD → form, as today.
  - [ ] Every posted field name and value is unchanged (write-tests td-w*).
  - [ ] One `.fl-glow`.

### /ops/reports  ·  operator  ·  size M
- **Source:** `app/ops/reports/page.tsx`, `app/ops/reports/actions.ts`.
- **States:**
  1. Open reports. The safety concerns (child account, own child, family safety) sort first and carry the amber edge.
  2. A player-page report identified (the hide form), or already hidden ("This page is hidden while you look.").
  3. A coach-page report (take down).
  4. A family-safety report (its guidance line).
  5. Empty lists: "No open reports.", "Nothing is hidden.", "Nobody is held.".
  6. Hidden pages present.
  7. Signup holds present.
  8. Parent search: nothing found, or links found (active, suppressed, removed).
  9. `?done=` in seven variants (accent notice), and `?error=` in four (amber notice).
- **Phone (390):**
  1. Page header.
  2. Title and line.
  3. The done or error notice.
  4. Open reports.
  5. Hidden pages.
  6. Age checks.
  7. One parent's access.
  8. Seat bar.

  The order is unchanged.
- **Laptop (1280):** **home grid** (`.player-grid`, 1fr + 320, as today). The aside is sticky. This keeps the signed layout. The 23 Sep idea ("the queue is the page, the rail holds standing state") is already how it's built.
- **Parts:**
  - Each report is a **panel**, with `card-amber` for the three safety concerns (a state: read first).
  - The facts stay `.ops-fact` wells.
  - "What they wrote" stays in a surface-2 well.
  - Each "Why" field, the court-order field and the outcome picker move onto the console's labelled 44px well (`.ops-field` + `.ops-input` / `select.ops-input`). They were hand-built label cards and an inline-styled select.
  - The parent search becomes `.ops-search` (new, below).
  - Each child link found is a **panel**, with its state as a pill: active `pill-live`, suppressed `pill-wait`, removed `.pill`.
  - "Remove permanently" sits in the page's only `card-red` panel with its court-order field, and keeps its red-edged secondary.
  - Every empty list is the **empty tile** with its existing line.
  - Section heads are `.sec-h`, because they sit on the page above panels.
  - done → `card card-accent`; error → `card card-amber`.
- **Copy:** verbatim: every CONCERN, KIND, DONE and ERR string, the 1800RESPECT guidance, "Suppress first; don't judge the dispute. …", "Hide this page while I look", "Take the coach page down", "Outcome…", "Removed" · "No action needed" · "Referred on", "Close report", "Show it again", "Checked — release", "The parent's email", "Find", "No parent account with that email.", "Parent of {child}", "Suppress this parent's access", "Restore access", "Court order reference", "Remove permanently".
- **Must not change:**
  - D-79: nothing opens a child's record. A player page is identified by its link's fingerprint, and a family by a first name.
  - Hiding is not deleting.
  - Permanent removal needs a court order.
  - The 1800RESPECT line is kept verbatim.
- **Done when:**
  - [ ] The safety concerns carry `card-amber` and sort first.
  - [ ] Every empty list is `.card.empty` with its existing sentence.
  - [ ] Every form field in the page is `.ops-field` / `.ops-input`.
  - [ ] Only the court-order panel is red-edged.
  - [ ] At 390 the order is unchanged; at 1280 the aside stays in view.

### /ops/support  ·  operator (on screen: "Lookup")  ·  size S
- **Source:** `app/ops/support/page.tsx`, `app/ops/support/actions.ts`.
- **States:**
  1. No query.
  2. No match ("Nothing matches that.").
  3. Results (up to 10): waiting, with the channel line and "Resend the approval request"; approved; held, with its D-155 sentence.
- **Phone (390):**
  1. Page header.
  2. Title and line.
  3. The rule.
  4. The search.
  5. The results.
  6. Seat bar.
- **Laptop (1280):** the same, in the console column. Results are rows in one **table** card.
- **Parts:**
  - The rule becomes a **well** with the lock glyph and its bold first sentence in ink. The red edge and red triangle go (I-P1b).
  - The search is `.ops-search`.
  - Results are `.ops-table` rows (`.ops-inv`), no longer separate `lift` cards.
  - The status is a **pill**: Approved `pill-live`, Held `pill-stop`, Waiting on the guardian `pill-wait`.
  - No match is the **empty tile**.
- **Copy:** verbatim.
- **Must not change:**
  - D-79: invitation state and resend only. There is no record, no impersonation, and every action is logged.
  - The URL stays `/ops/support`.
- **Done when:**
  - [ ] The three statuses render as pills.
  - [ ] Results are rows in one card.
  - [ ] The rule has no red.
  - [ ] "Resend the approval request" still posts `invitationId`.

### /ops/switches  ·  operator, often at 390 at night  ·  size M
- **Source:** `app/ops/switches/page.tsx`, `app/ops/switches/actions.ts`, `lib/sms-policy.ts`, `lib/ops-policy.ts`.
- **States:**
  - Links: on, or paused.
  - SMS: on; off; forced off in Vercel; spend nothing / some / with a limit.
  - Limit: set in Vercel, or not. A lowered limit present shows the "go back" form.
  - The log: empty, or up to 10 entries.
  - `?done=` in seven variants and `?error=` in six.
- **Phone (390):**
  1. Page header.
  2. Title and line.
  3. The notice.
  4. Pause shared links.
  5. Switch off every link.
  6. SMS (switch, limit, go back).
  7. The switch log.
  8. Seat bar.

  The order is unchanged.
- **Laptop (1280):** home grid, as today. The switch log is in the sticky aside.
- **Parts:**
  - Each switch is a **panel**. Its state is a **pill** (On `pill-live`, Paused / Off `pill-wait`), replacing the hand-built 7px-radius tags.
  - The paused links panel and the off SMS panel take `card-amber`. "Switch off every link" keeps `card-red` and the red-edged secondary.
  - The "Why", "What families will read", "Type SWITCH OFF EVERY LINK" and "Monthly limit" fields move onto `.ops-field` / `.ops-input` (hand-built label cards today).
  - The log becomes rows in one **table** card (`.ops-log`), not ten cards. An empty log is the **empty tile**.
  - **The glow:** only the "back on" primary glows ("Switch shared links back on" / "Switch SMS back on"), which today's code already makes the primary. In a normal state nothing glows.
- **Copy:** verbatim, every banner, explanation, button and log label (the SMS words are approved 30 Sep). "$x of $y spent this month" is SMS cost, not a Pitch price (D-163 untouched).
- **Must not change:**
  - Every switch needs a reason and is logged with the operator's name.
  - "Switch off every link" needs the typed phrase.
  - Vercel is the ceiling (off if either says off, and the lower cap wins).
  - The page shows counts and the log only (D-79).
- **Done when:**
  - [ ] Every state tag is a `.pill`.
  - [ ] All inputs are `.ops-input`.
  - [ ] The log is one `.ops-table`.
  - [ ] There is no `.fl-glow` in the normal state, and exactly one when links or SMS are off.
  - [ ] The page is usable at 375 (layout-check), including the 3-line textarea.

### /ops/clubs  ·  operator  ·  size S
- **Source:** `app/ops/clubs/page.tsx`, `app/ops/clubs/chip.tsx`, `app/ops/clubs/actions.ts`.
- **States:**
  1. Clubs asking to be added: present or absent.
  2. Search: all clubs, a query, or "Nothing matches that.".
  3. Rows in four states: unclaimed, awaiting a call, verified, suspended. Each has a live count or a dash, and its doors (Club page when there is a slug; Open call sheet unless unclaimed).
- **Phone (390):**
  1. Page header.
  2. Title with "Add a club".
  3. The asks panel.
  4. The search.
  5. The table (club; live · state; doors).
  6. Seat bar.
- **Laptop (1280):** the signed four-column table, unchanged.
- **Parts:**
  - The asks panel is `card card-amber` (work waiting). Its "Add" is `console-btn-primary`.
  - "Add a club" in the title is `console-btn-primary` **only when no ask is waiting**, and `console-btn` otherwise (I-P1a).
  - `StateChip` renders A's **pill**: `pill-live`, `pill-wait`, `pill-stop`, and `.pill` for Unclaimed. It keeps `data-club-state`.
  - The search is `.ops-search`.
  - No match is the **empty tile**.
- **Copy:** verbatim (brief I words, approved 29 Sep).
- **Must not change:**
  - No person's data. `fn_ops_clubs` returns club facts and a count; the administrator and TD are on the call sheet only (cur-s*).
  - Nothing on or about an unclaimed club says it is with us (D-172). The row says "Unclaimed".
- **Done when:**
  - [ ] `StateChip` outputs `.pill` with `data-club-state`.
  - [ ] There is one green on the page when no ask is waiting, and the asks' "Add"s otherwise.
  - [ ] The search is `.ops-search`, and no match shows the empty tile.
  - [ ] The table fits at 768 and at 1024–1031.

### /ops/clubs/[clubId]  ·  operator  ·  size M
- **Source:** `app/ops/clubs/[clubId]/page.tsx`, `listing-fields.tsx`, `chip.tsx`, `actions.ts`.
- **States:**
  1. Unclaimed: the edit form, curated trials, "Remove this listing".
  2. Claimed: no form, the call sheet door, curated trials.
  3. Verified or suspended: doors only. Trials show only if Pitch has notices.
  4. Sends: an address is held ("Stop CVs to this club"), sends are stopped ("CVs to this club are stopped."), or nothing.
  5. `?error=`: dup, fields, remove, refused.
  6. Unknown id → 404.
- **Phone (390):** order unchanged:
  1. Page header ("Clubs").
  2. Title, suburb, and state pill.
  3. The error notice.
  4. The doors.
  5. The listing form.
  6. Stop CVs.
  7. Trials (head with "Post a trial", then the notices).
  8. Remove this listing.
  9. Seat bar.
- **Laptop (1280):** `.club-grid`. The listing column is on the left (doors, form, stop, remove). The Trials column is on the right, 360px, with the notice cards. DOM order is unchanged; the grid places them.
- **Parts:**
  - The listing form is one **panel** (`.ops-panel`) with `ListingFields` unchanged. "Save changes" is `btn-secondary`, as today.
  - Each notice is a **panel**: the source link at 44px, doors in `.ops-doors`.
  - The state is a pill in the title action.
  - "Remove this listing" is a `<details>` panel whose "Remove" keeps its red-edged secondary.
  - Section head: `.panel-h`, "Trials".
- **Copy:** verbatim.
- **Must not change:**
  - The unclaimed listing is Pitch's and is edited here, logged with the operator's name.
  - Once claimed, the listing is the club's.
  - New notices only while unclaimed or claimed-unverified (D-90).
  - There is no empty Trials heading (D-162).
- **Done when:**
  - [ ] At ≥1024 the trials sit in a 360px right column.
  - [ ] At 390 the order is unchanged.
  - [ ] The listing is a single `.ops-panel`.
  - [ ] The state pill has `data-club-state`.
  - [ ] Every action posts the same hidden fields.

### /ops/clubs/[clubId]/trial  ·  operator  ·  size S
- **Source:** `app/ops/clubs/[clubId]/trial/page.tsx`.
- **States:**
  1. New.
  2. Editing (`?edit=`).
  3. Editing a notice people registered for: the date is read-only, with its line.
  4. `?error=`: ages, source, refused, fields.
  5. A club that is not unclaimed or claimed → 404.
- **Phone (390):**
  1. Page header (the club's name).
  2. Title "Post a trial" / "Change a trial", and the club.
  3. The error notice.
  4. One form panel:
     - Where you found it;
     - Which squad (title, age chips, competition chips);
     - When and where (date and time paired, then ground);
     - Positions (five across);
     - the "comes down by itself" well;
     - "Post it" / "Save changes", and "Cancel" when editing.
  5. Seat bar.
- **Laptop (1280):** the same panel, capped at **640px** (the reading width: a form is a door) and left-aligned beside the rail.
- **Parts:**
  - Every field moves from a 16px card with the label inside (the third field style) to `.ops-field` + `.ops-input`, the console's field, as on the call sheet and the listing.
  - The chips stay `.chip.pick`.
  - `.ops-panel` / `.ops-sec`.
  - The primary with the glow.
  - `btn-ghost` "Cancel".
- **Copy:** verbatim.
- **Must not change:**
  - "How to register" and "Where CVs should go" stay absent, on purpose (doc 14 J38).
  - It comes down the day after its date.
  - Only on unclaimed or claimed-unverified clubs (D-90).
- **Done when:**
  - [ ] There are no `label style={card}` fields left.
  - [ ] The panel is ≤640px at 1280.
  - [ ] The ages and positions post the same names.
  - [ ] The date is read-only when `registered`.

### /ops/clubs/new  ·  operator  ·  size S
- **Source:** `app/ops/clubs/new/page.tsx`, `listing-fields.tsx`.
- **States:**
  1. Blank.
  2. Prefilled from a club's ask (`?request=…`).
  3. `?error=dup` or fields.
- **Phone (390):**
  1. Page header.
  2. Title.
  3. The error notice.
  4. One form panel (the listing fields; primary "Add a club").
  5. Seat bar.
- **Laptop (1280):** the panel capped at 640px beside the rail.
- **Parts:** `.ops-panel`, `ListingFields`, `.fl-glow`.
- **Copy:** verbatim, including the prefilled source "Asked by the club on Pitch; address checked on its website".
- **Must not change:**
  - The claim code goes to the address entered here and nowhere else.
  - The database refuses duplicates and names the operator.
- **Done when:**
  - [ ] One panel ≤640px with one glowing primary.
  - [ ] The prefill is unchanged.
  - [ ] The error is an amber notice with `role="alert"`.

## New shared parts (class, exact CSS, where used)

These go in `app/globals.css`, in THE OPERATOR CONSOLE block, after `.ops-seg`.

```css
/* A form in the console is one panel; its groups are divided by hairlines, not separate cards. */
.ops-panel { display: flex; flex-direction: column; padding: 4px 16px; }
.ops-sec { display: flex; flex-direction: column; gap: 11px; padding: 16px 0; }
.ops-sec + .ops-sec { border-top: 1px solid var(--line); }
/* The console search: a 44px well and its button (Clubs, Lookup, Reports' parent search). */
.ops-search { display: flex; gap: 10px; align-items: center; }
.ops-search .ops-input { flex: 1; min-width: 0; }
/* A column that stays in view beside a long one (Reports, Switches, the call sheet's claim). */
@media (min-width: 1024px) { .ops-aside-sticky { position: sticky; top: 18px; } }
/* The call sheet at a laptop: the claim and the TD beside the form; DOM order claim, TD, form. */
.call-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; grid-template-areas: "claim" "td" "form"; }
.call-grid > * { min-width: 0; }
@media (min-width: 1024px) { .call-grid { grid-template-columns: minmax(0, 1fr) 320px; grid-template-areas: "form claim" "form td" "form ."; align-items: start; } }
/* One club: the listing on the left, its trials on the right; DOM order doors, listing, stop, trials, remove. */
.club-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; grid-template-areas: "doors" "listing" "stop" "trials" "remove"; }
.club-grid > * { min-width: 0; }
@media (min-width: 1024px) { .club-grid { grid-template-columns: minmax(0, 1fr) 360px; grid-template-areas: "doors trials" "listing trials" "stop trials" "remove trials" ". trials"; align-items: start; } }
.ga-claim { grid-area: claim; } .ga-td { grid-area: td; } .ga-form { grid-area: form; }
.ga-doors { grid-area: doors; } .ga-listing { grid-area: listing; } .ga-stop { grid-area: stop; } .ga-trials { grid-area: trials; } .ga-remove { grid-area: remove; }
```

- **Everything else is A's:**
  - pill (the ops state chip, the Lookup pill and the switch tags all become it);
  - empty tile;
  - well;
  - notice (the `?done=` / `?error=` lines become `card card-accent` / `card card-amber` / `card card-red`);
  - table;
  - home grid;
  - `.numeral-m` (existing).
- **Remove after the pass:** the inline chip in `verification/page.tsx`, the inline pill in `support/page.tsx`, the inline tags in `switches/page.tsx`, the local `input` and `well` styles in `reports/page.tsx` and `switches/page.tsx`, and the local `card` in `call/[clubId]/page.tsx`.

## New copy for BUZ (current line → proposed line, why)

| # | Where | Current | Proposed | Why |
|---|---|---|---|---|
| N-I1 | `/ops/verification`, only when no club is claimed, verified or suspended | *(a table head over nothing, and an empty subtitle)* | **No club has claimed its page yet.** | This is the likely state for the first days after launch. Today it looks like a failed load. It is a sentence, not a zero (D-162). |
| N-I2 | `/ops`, only when every tile is omitted | *(the title and the footnote only)* | **Nothing yet today.** | At 7am, and on quiet days, the console's home is blank. It says the counts ran and found nothing, without printing a 0. |

There are no other new words. Every label listed above is verbatim.

## Product decisions for BUZ (not look; behaviour, numbers, doors)

| # | Decision | What it buys | What it costs | Recommendation |
|---|---|---|---|---|
| **I-P1** | **Three departures from the signed operator designs** (look, but the signed designs are the source of truth, so they need a yes):<br>(a) green only where work waits: "Open call sheet" is secondary on verified or suspended rows, and "Add a club" is secondary while an ask waits;<br>(b) the two standing rules (Verification, Lookup) lose the red triangle and red edge, and become wells with the sentence in ink, because red is a state (D-173 (4));<br>(c) the queue's chip becomes A's pill (caps, 24px) everywhere in the console. | A queue of twenty clubs shows the one or two that need a call. The same state reads the same way on every screen, and red keeps one meaning on the console: failing or irreversible. | A few lines per page. `render-tests` and `layout-check` checks that match the chip's inline style or text case will move. | **Yes** to all three. |
| **I-P2** | **The call sheet's claim and TD sit beside the form at a laptop** (claim pinned). The same content, arranged (D-147), with the phone order unchanged. | "Do not mention that number on the call" and the TD's state stay in view while BUZ types during the call. | Half a day (grid, sticky, and a check at 1024–1031). | **Yes.** |
| **I-P3** | The 23 Sep proposal's **empty-desk evidence** on Reports: "Closed in 30 days", "Longest wait", "the last report was closed on …". | An empty desk proves it is worked. | A new query and four new lines. Not drawn. | **Not now.** Revisit when there are reports to count. |
| **I-P4** | **Filters on the Clubs directory** (state pills as filter chips). 183+ unclaimed listings since 30 Sep. | Finding "awaiting a call" among 190 rows. | It's a new feature, and search covers it today. | **Don't build.** Search by name or suburb is enough, and Verification already is the "awaiting" filter. |

## Build order and dependencies

1. **A's base pass.** With nothing else, this moves: the rail (mark, seat card, `--here`), the seat bar, every `.ops-table` (lifted), every `card`-spread panel (shadow), and the page header (the mark leaves the column at ≥1024). This is most of the visible change.
2. **The pill everywhere** (StateChip, the verification chip, the Lookup pill, the switch tags) and the **empty tile** on every empty list. These are small, mechanical, and cross-page.
3. **Wells for the rules** (Today, Verification, Lookup) and **green only on waiting rows** (I-P1).
4. **Forms:** `.ops-panel` on the call sheet (with `.call-grid`, I-P2), the club listing (with `.club-grid`), Add a club, and Post a trial (fields onto `.ops-field`).
5. **Reports and Switches:** fields onto `.ops-field`, `.ops-search`, the log as a table, and the glow rule.
6. **N-I1 and N-I2** once BUZ approves the words.

## Risks and suites likely to move

- **`render-tests.mjs` ops-r2** reads the tiles with a regex that expects `data-ops-tile` → label `div` → value `div`, adjacent. Keep that order and add classes only.
- **ops-r4** reads the count rule by text, which is unchanged.
- **ops-r5** counts the page's links. The empty tile adds none.
- **`render-tests` call-sheet checks** (brief G): the tracked-caps captions stay short and the radios post 0025's values. The section head's colour change does not affect them. Grid placement changes visual order only at ≥1024; the DOM order the tests read is unchanged.
- **`permission-tests.mjs`** (ops-t1–t4, cur-s*): no query changes anywhere in this spec. N-I1 and N-I2 use counts the pages already have (`rows.length`, `tiles.length`).
- **`layout-check.mjs`:**
  - the squeeze rule on the queue and clubs tables at 768 and 1024–1031 (the columns are unchanged, and the pill is narrower than the chip);
  - the 44px targets (unchanged);
  - the new 360px trials column on the club screen at 1024. The console column is 756px there, so the listing column gets 378px, and `.ops-pair` puts its fields two-up at about 180px each. **Check it. If it squeezes, the club grid starts at 1180 instead.** Flagged.
- **`write-tests.mjs`:** every form's field names are unchanged. The Post a trial fields change markup (card → `.ops-field`), not names.
- **Leo, found while designing (behaviour, not design):**
  1. `/ops` "Approved" tile: `sub = Math.round(100*approved/approvals_sent)`. On a day with approvals but none sent (approved today, sent yesterday) this prints **"Infinity% of sent"**. The sub should be omitted when `approvals_sent` is 0.
  2. `/ops/reports`: a **suppressed** link still shows the suppress form (the condition is `!l.revoked`). The mockup draws it without; the fix is `!l.revoked && !l.suppressed`.
  3. `/ops/verification` with no rows renders the table head over nothing, whatever N-I1's answer. At minimum, hide the head.
