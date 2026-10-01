# F — The club console: build spec

## Summary
- **What changes:** the ten `/club/*` routes are rebuilt from the parts the public pages already use. That means A's panel, table, pill, page header and door, plus the trial row from `/fc` and `/trials`, the role row from `/jobs`, and the club hero from `/fc/[slug]`. **A list is a page:** one panel of rows, and the table from 768. **A form is a door:** one panel. A create form above a list folds behind one chip, and it opens by itself when the list is empty.
- **What it fixes:**
  - a card per child on the register and on the squad sheet;
  - three button styles that aren't the charter's (outlined "Ask them", outlined "Shortlist", outlined "Not this squad");
  - thirteen captions that never matched `.field-label` (post-trial);
  - an invite choice that never shows as picked;
  - a CV back bar floating at 640 above a 1200 page;
  - zero counts printed on four screens;
  - an empty register that says "the list is … just narrowed".
- **What it doesn't touch:** every word, door, field, read and the 390 order.
- **Size:** about 5½ days after A's base pass: register L (1½ d), squads M, a squad M, roles M, post-trial M, page-edit L (1 d), invite M (½ d), the two CV wrappers S, billing none. **Mockup:** `docs/design/mockups/floodlit-club.html` (33 states, 390 and 1280).

**Shell parts used** (names from `A-shells-and-homes.md`): Frame · Seat bar · More sheet · console sidebar with rail mark and seat card · Top bar · Page header (`.pg-head`, `.pg-back`) · Page title (`.pg-title`, `.pg-sub`) · Section heading (`.sec-h`) · Panel heading (`.panel-h`) · Panel (`.card`) · Well (`.card-sunken`) · Notice (`.card-accent`, `.card-amber`) · Pill (`.pill`, `.tag` alias) · List row (`.card.rows` > `.row`) · Stat row · Empty tile (`.card.empty`, `.empty-tile`) · Table (`.console-row`, `.console-head`, `.ops-table`) · Buttons (the one glow) · Field · Door panel (`.door`). **In the mockup the frame is drawn in outline only**; where it differs from A, A is right.

## Pages

### /club/register  ·  TD at a verified club; TD or administrator at an unverified club  ·  size L
- **Source:** `app/club/register/page.tsx`, `app/club/register/actions.ts`, `components/RegisterPaused.tsx`, `components/console-shell.tsx`.
- **States:**
  1. **Held** (unverified: "{n} waiting" and the sentence, nothing else; D-126).
  2. **Held with zero** (prints "0 waiting" today).
  3. **Verified with registrations** (the numerals, the shield line, filters, squad buckets and the footer).
  4. **Filtered** ("n of N shown · Clear").
  5. **Filtered to nothing** ("Nobody matches that yet…").
  6. **Verified, nobody yet.** Today this renders the filter card with zero chips and the "narrowed" sentence.
  7. **Trials-only** (verified, `fn_register_active` false). **Unreachable while `billing_enabled` is false**; with it on, it shows "Interest in your trials", its rows or its empty line, and "The whole register is a plan".
  8. **Payment paused** (`RegisterPaused state="suspended"`), behind the same switch.
  9. **Per row:**
     - status New, Shortlisted or Invited;
     - with or without a note;
     - with or without clips;
     - **invitable or not.** A child whose profile is paused, or an under-16 with no approved guardian, keeps the row but has no Open the CV and no invite (P19). A New row keeps Shortlist.
  10. **Redirects:** signed out → /signin; no seat → /home; an administrator at a verified club → /home (N17).
- **Phone (390):**
  1. page header (mark only);
  2. page title "Interest register" with the club name;
  3. the stat row (Players 56; New, Shortlisted, Invited at 34), **zero stats omitted (P2)**;
  4. the shield line, as a **well**;
  5. the filter panel: three groups ("Which age group", "Where they play", "Where you're up to") and the shown/Clear line;
  6. **per bucket:** the title (17/900), the sub-line and the count, then **one panel holding that bucket's rows**. Each row has:
     - the name (15/800) and "positions · clips";
     - the status pill, top right;
     - the note in a well;
     - the buttons: Open the CV `.btn-secondary` 46; Shortlist `.btn-secondary` 46; Invite to trial `.btn-primary` 50 with no glow; Invitation sent `.btn-secondary` in secondary ink;
  7. the footer: "There is no download." as a well, "New, shortlisted, invited — and nothing else" as a panel, and the family line;
  8. Back.
  
  Held state: title, **one `.card-amber` notice** with "{n} waiting" (22/900 amber, **one text node**) and the sentence, then Back.
- **Laptop (1280):**
  - The title and the stat row share one line, with the numbers right-aligned (A's stat row).
  - The filter panel is sticky (`.console-filters`, as built). From 1024 each group is one line, with a 128px label column.
  - Each bucket's panel is **the table** from 768: `.console-head`, then `.console-row` with the columns unchanged (`minmax(128px,1fr) minmax(148px,1.5fr) 100px 116px minmax(120px,180px)`). The buttons are `.console-btn` / `.console-btn-primary`, and "Invitation sent" is a 44px text link in secondary ink.
  - The footer's well and panel sit side by side from 768.
  - Nothing is added.
- **Parts:**
  - A: page header, page title, stat row, well, panel, table, pill, empty tile, `.console-btn`.
  - **The two renders stay two renders** (`.d-only` table, `.m-only` rows), as built. They only move into one panel per bucket; the mockup's single markup is a drawing convenience.
  - New: `.reg-bucket` (the bucket title row) and the phone row `.reg-row` (see New shared parts).
- **Copy:** all verbatim: "Interest register", "Players", "New", "Shortlisted", "Invited", "Every under-16 here was put on this register by a parent.", the three filter labels, "All ages · {n}", "Any position", "Everyone", "{n} of {N} shown", "Clear", "No squad named", "They registered with the club, not a squad", "Player", "Their line", "Status", "Open the CV", "Shortlist", "Invite to trial", "Invitation sent", "Nobody matches that yet. Show everyone — the list is the same list, just narrowed.", the footer's three blocks, "Back", "{n} waiting" and its sentence, "Interest in your trials" and its line, "Nobody has registered interest in your trials yet. Post a trial and families register from it.", "The whole register is a plan" and its line, "See the Interest Register". New: none. **N1** reuses a line in a new place.
- **Must not change:**
  - D-126: held means a count, and no name, age, position, note or token in the response body (doc 14 M1).
  - N6: the row shows first name, positions, squad and note only; no surname, age, DOB, contact or school.
  - P19: a refused row has no CV or invite link, and looks like a row that never had one.
  - D-122: no download or export.
  - D-154/N22: every read is logged against a named person, and filters narrow the drawing, not the read.
  - D-108: no fourth status.
  - D-163: no price, and the trials-only branch stays behind the switch.
- **Done when:**
  1. At 390, each bucket is one panel with hairline rows, and the order is identical to today's.
  2. At 1280, the table columns line up across buckets, with no horizontal scroll at 768, 1024–1031 and 1280 (layout check).
  3. The held page contains no fixture first name and matches `/\d+ waiting/` (r33–r35, free-r5).
  4. A refused row renders with no `/club/register/cv/` or `/club/invite/` link.
  5. No button on the page is outlined, transparent or hand-built; every button is `.btn-*` or `.console-btn*`.
  6. With P2, no "· 0" chip and no zero numeral renders.

### /club/register/cv/[registrationId]  ·  the TD, or a coach granted that squad  ·  size S
- **Source:** `app/club/register/cv/[registrationId]/page.tsx`, `components/cv/PlayerCV.tsx` (group C's, unchanged).
- **States:**
  - an under-16 (the approved snapshot, "Parent-approved", and the no-reply note);
  - a 16–17 or 18+ player (the live assembly);
  - **not found**, for a malformed id, a refusal, or an administrator (one global not-found, same as absence);
  - the back link is "The register" for the TD and "Registrations" for a coach (to `/coach/register`).
- **Phone (390):** PlayerCV's own logo-only bar, then **A's page header with the back link** inside the CV's `.fl-wide` column, then the card and the story as C draws them.
- **Laptop (1280):** the same. The back link sits at the left edge of the 1200 column, above the 440 card (not in a 640 column above the bar, as today). It is visible at every width (A part 5: SiteNav's `back` is not used for signed-in flows).
- **Parts:** A's page header and top bar (PlayerCV's SiteNav). **Build note:** PlayerCV gains an optional `head` slot rendered inside `.fl-wide` before `.cv-grid`, so the wrapper stops rendering its own `.reading` bar. That is a prop, not a door.
- **Copy:** verbatim: "The register", "Registrations", and everything inside PlayerCV.
- **Must not change:**
  - `fn_can_read_registration` decides everything, and a refusal is not-found;
  - the u16 page is the approved snapshot (D-119);
  - the `consent_event` and `register_read_log` writes (N22);
  - `robots: noindex` (D-95);
  - no pending edit is shown.
- **Done when:**
  1. One nav bar only, at every width.
  2. At 1280 the back link's left edge equals the card's left edge.
  3. s11b, s12d and s12e stay green.
  4. With P1, Back lands on the same filtered register, scrolled to the row.

### /club/squads  ·  TD or administrator (verified or not)  ·  size M
- **Source:** `app/club/squads/page.tsx`, `app/club/squads/actions.ts`.
- **States:**
  - **Squads:** none; one or more; each row removable (no registrations or players) or in use.
  - **Flashes:** added, removed, in use, error, coach asked, coach removed, coach error.
  - **The TD's coaches block:** the heading and the well; the grants list; "Bring in a coach" only once there's a squad.
  - **Administrator:** no coaches block, and Back goes to /home. For the TD, Back is "Back to the register".
- **Phone (390):**
  1. page header;
  2. the title "Squads" and "{club} · {n} squads" (**"· 0 squads" omitted, P2**);
  3. the intro well;
  4. flashes;
  5. **"Add a squad" as a chip-summary `<details>`**: closed when squads exist, `open` when there are none. Inside it, the form as a panel: its heading moves into the summary, the fields and the hint stay, and "Add it" is `.btn-primary`;
  6. **one panel of squad rows:** the name link, the meta line "age · gender · season · {n} registered · {n} playing" (zeros omitted, as built), "Who plays", and Remove (`.console-btn`) or "In use — can't be removed";
  7. the TD block: `.sec-h` "Coaches who read your register", the well, flashes, **one panel of grant rows** (name, "teams · since", Remove), and "Bring in a coach" as a chip-summary `<details>` with its form panel;
  8. Back.
- **Laptop (1280):**
  - The squad panel is a **table** from 768: Squad (name and meta) · Registered · Playing · Who plays · the action. Columns are `minmax(0,1fr) 96px 80px 96px 190px`.
  - The counts are 15/900 numerals, with "—" for zero. The phone line's counts hide from 768.
  - "In use — can't be removed" sits on one line.
  - The create button is `width:auto` from 1024 (`.btn-auto`).
- **Parts:** A: panel, table, list row, well, `.sec-h`, field, buttons. New: `.cc-adder` (chip-summary disclosure) and `.cc-said` (flash).
- **Copy:** verbatim: every line on the page, including "Add a squad" (now the summary) and "Bring in a coach" (now the summary). **Say it once:** neither heading is repeated inside its opened panel.
- **Must not change:**
  - N23/D-154: only the TD sees the grants;
  - pending invites are never listed (no account oracle);
  - N18: caps are enforced at write;
  - the WWCC tick is attested, never a number (D-98).
- **Done when:**
  1. With squads, the form is closed. With none, it's open. Both work with JavaScript off.
  2. Every row ends at the same x from 768.
  3. No `0` is printed in a count.
  4. The administrator sees no coaches block.
  5. The layout check's squads visit (line 563) passes at 390, 768, 1024 and 1280.

### /club/squads/[squadId]  ·  TD (reads and works); administrator (works, names only); a granted coach (reads, no frame)  ·  size M
- **Source:** `app/club/squads/[squadId]/page.tsx`, `app/club/squads/[squadId]/actions.ts`.
- **States:**
  - **flash:** done (five words) or error;
  - **Waiting on you** (claims) or not;
  - **empty squad** ("Nobody yet…");
  - **the shape tiles**, including the "No {position} yet" words and the amber "No position yet" count;
  - **position groups**;
  - **per player:** readable or not (record id), clips, stats, and the source caption (shared or per-number);
  - **the reader:** a reader note for the administrator, and another for a coach who can't work the squad;
  - **Asked, waiting on them**;
  - **the ask list** (TD only): position chips, empty-for-position, empty, and over the cap of 60;
  - **not found** for anyone who can't read the squad.
- **Phone (390):** the order as built:
  1. page header, back "Squads";
  2. the title and meta, with "· {n} playing";
  3. flashes;
  4. **Waiting on you** as a `.card-accent` notice per claim. "Yes, they play here" is `.btn-primary` and **the screen's one glow**; "Not this squad" is `.btn-secondary`, where today it's hand-built outlined;
  5. **In this squad:** the shape tiles in one panel, then per group a `.panel-h` and **one panel of player rows**. Each row has:
     - the number tile (40);
     - the name, and "foot · since · On your register";
     - the positions as pick-order pills. **The first is lit in ink, not green**, because it's a fact;
     - the clips count;
     - the stats line with its source caption;
     - Open the CV (text link) and Remove (`.console-btn`).
     
     Then the reader note if any;
  6. **Asked:** one panel of rows, each with "Take it back" (`.console-btn`);
  7. **Ask someone:** the well, the position chips, one panel of rows, and the over-cap well. **"Ask them" is `.console-btn-primary`**, where today it's accent-outlined.
- **Laptop (1280):**
  - From 1024 each player row is one line: number · name and meta · positions and clips · actions, with the stats line under the middle columns.
  - The ask rows put the name in a 110px column and the pills beside it.
  - The claim notice puts its buttons on the right from 768.
- **Parts:** A: page header, page title, notice, panel, list row, pill, well, buttons, `.console-btn`. New: `.sq-player` (the player row grid) and `.pos-pill` (a pick-order pill; see New shared parts).
- **Copy:** verbatim, all of it, including the five `said` lines, "1st/2nd/3rd", "{n} clips", the stat labels, "2026 · self-reported" and the three sources. New: none.
- **Must not change:**
  - D-93: an administrator gets names and no record (no tile, positions, stats or CV link);
  - D-138: a no looks exactly like silence ("Asked" stays until taken back or lapsed);
  - D-62: every number carries its source, and an unapproved source is never shown;
  - D-70/D-162: a stat nobody has is omitted, and the "No keeper yet" words stay;
  - the asks are the database's answer (`fn_squad_askable`), with first names only;
  - the cap of 60 with its sentence.
- **Done when:**
  1. There's one glow at most, on the claim's primary.
  2. No accent-outlined or transparent button remains.
  3. The first-choice pill is not green.
  4. The administrator's render has no `/cv/` link and no number tile.
  5. At 1024 no row wraps its actions under the name.

### /club/squads/[squadId]/cv/[playerId]  ·  TD or a granted coach  ·  size S
- **Source:** `app/club/squads/[squadId]/cv/[playerId]/page.tsx`, `actions.ts` (`verifyStat`), PlayerCV.
- **States:**
  - a u16 snapshot, or a live 16+ record;
  - with 0–3 "Verify for {club}" offers (only numbers on this page, as shown, self-reported, 2026);
  - not found.
- **Phone (390):**
  1. PlayerCV's bar;
  2. the page header with back "The squad";
  3. the verify offers stacked, each a panel with "{Stat label} {value}" and `.btn-secondary` "Verify for {club}";
  4. the CV.
- **Laptop (1280):** the offers sit three across from 768 inside `.fl-wide`, above the CV grid.
- **Parts:** A: page header and panel; PlayerCV's `head` slot (as above). New: `.verify-strip` (a grid of three from 768).
- **Copy:** verbatim: "The squad", the stat labels, and "Verify for {club_name}" (BUZ, 29 Sep).
- **Must not change:**
  - D-160: the club is named, never the coach;
  - what may be verified comes from `fn_verifiable_stats`;
  - nothing the parent hasn't approved is shown or offered (D-119);
  - the `squad_record_opened` consent event.
- **Done when:**
  1. The offers render only for on-page numbers (as today).
  2. There's one bar.
  3. The back link is visible at 1280.

### /club/roles  ·  TD or administrator  ·  size M
- **Source:** `app/club/roles/page.tsx`, `app/club/roles/actions.ts`.
- **States:**
  - flashes: saved, closed, error, and ended (the TD's name);
  - no roles;
  - roles open and closed (closed ones at .65 with "· closed", and no Close button);
  - per role: applicants or "Nobody yet.", and each applicant with or without a coach slug and a message;
  - the administrator's TD row (`fn_may_end_td`), or nothing.
- **Phone (390):**
  1. page header;
  2. the title "Coaching roles" and "{club} · {n} open" (**"· 0 open" omitted, P2**);
  3. flashes;
  4. **"Post a role" as a chip-summary `<details>`** (open when there are no roles) holding the form panel;
  5. **one panel per role, drawn as the /jobs row:** the title (16/900), the Paid/Volunteer pill (neutral, as E specifies for /jobs), "age · commitment · Paid|Volunteer", and Close (`.console-btn`). Applicants sit in wells under it: the name, "Their coaching CV", and the message;
  6. the privacy well;
  7. the TD row panel (administrator only): `.panel-h` "Technical Director", the name, the "Why" field and `.btn-secondary` "End their access";
  8. Back.
- **Laptop (1280):** the same column in the console main. Role panels stay one per row, because applicants make them uneven.
- **Parts:** A: panel, pill, well, field, buttons. `.jr` row padding from E (the /jobs row). `.cc-adder`, `.cc-said`.
- **Copy:** verbatim, all. The applicant's message is data. New: none.
- **Must not change:**
  - `fn_role_applications` gates the applicants;
  - no contact details unless the coach wrote them;
  - D-48/D-93: only the administrator can end the TD's access, and the TD's name comes from the audit row, never the URL.
- **Done when:**
  1. A role here and the same role on `/jobs` share title, pill and line styling.
  2. With no roles, the form is open.
  3. The TD row appears only for `fn_may_end_td`.
- **What it produces (checked against E-coach.md, /jobs):**
  - Role → the row title;
  - "This role is paid" → the Paid/Volunteer pill;
  - Age group · Commitment → the line under the club, or "Details inside" when both are blank;
  - About the role and Closes → `/jobs/[id]` only;
  - `fn_coaching_roles_advertised` decides what's on the board.

  Nothing here changes it.

### /club/post-trial  ·  TD or administrator at a verified club  ·  size M
- **Source:** `app/club/post-trial/page.tsx`, `app/club/post-trial/actions.ts`.
- **States:**
  - new;
  - `?edit=` (with "Editing" on the list row; the date is read-only with its line when registered);
  - `?error=1` and `?error=ages`;
  - `?posted` and `?updated` (the confirmation);
  - "Your trials" empty (no list) or not;
  - "More age groups" open or closed (open when editing a trial that uses them);
  - redirect for an unverified club (→ /home).
- **Phone (390):**
  1. page header, back "Back";
  2. **the door** (A part 20) holding:
     - the title, and its line with the club name;
     - the four sections, each a `.panel-h` label then `.field` wells. **Every caption is on `.field-label` inside a `.field`**, which fixes today's cards;
     - the pick chips (`.chip.pick`): ages, competition, the 5×2 position grid;
     - the sunken "It comes down by itself…" well;
     - `.btn-primary` with the glow (Post it / Save changes) and Cancel (text button) when editing;
  3. **"Your trials"** after the door: `.panel-h`, then one panel of rows, each **the board's trial row in compact form**: the date numeral and month (the `.tr-date` part), the title, the age groups, and Change (`.console-btn`) or "Editing".
  
  Posted: the door with the 24/900 confirmation line and the muted line.
- **Laptop (1280):** from 1024 `.cc-split`: the door in the first column and "Your trials" as a sticky 300px column beside it. It's the same DOM order, and a list beside the door that edits it. Below 1024 it stacks as on the phone.
- **Parts:** A: door, field, pick chips, well, buttons, the one glow. The trial row's `.tr-date` (floodlit-trials.html, shared with /fc and /trials). New: `.cc-split`.
- **Copy:** verbatim, all, including "Change a trial", "Pick at least one age group, so families can find it.", "Fill in the title, date, time and ground.", "People have registered for this date, so it stays as it is.", "Editing", "Change", "More age groups", both confirmation lines, and "No age group yet". The list row's line keeps `{date} · {ages}` as built. New: none.
- **Must not change:**
  - the notice is text-only;
  - auto-expiry the day after;
  - a registered date is locked;
  - both sources' rules (D-90);
  - "Where CVs should go" defaults to the club's contact address;
  - the form works without JavaScript.
- **Done when:**
  1. Every caption renders at 10px (the layout check's rule).
  2. The door has one glowing primary.
  3. At 1280 "Your trials" sits beside the door, with no horizontal scroll at 1024.
  4. At 390 the order is identical to today's.
- **What it produces (checked against floodlit-trials.html):**
  - Notice title → "{club} · {title minus ' trials'}";
  - Date → the numeral and month;
  - Time · Ground → the meta line as typed (**no weekday for a club-posted notice; see P5**);
  - Age groups, Competition, Positions → the board's filters;
  - "Where CVs should go" → Send my CV;
  - on `/fc/[slug]` the same row takes the month in the club's trim colour.

### /club/page-edit  ·  TD or administrator (claimed or verified; an unclaimed club has no seat)  ·  size L
- **Source:** `app/club/page-edit/page.tsx`, `actions.ts`, `crest/route.ts`, `banner/route.ts`, `lib/club-colours.ts`.
- **States:**
  - flashes: saved, crest bad, banner bad, video bad; story bad, colours bad, wanted bad or full, and alumni tick, bad or full (these are inside their forms);
  - crest: none or set;
  - banner: none or set;
  - colours: none (Pitch green), a preset, or custom. "Go back to Pitch green" appears only when set. A suspended club's preview stays green (`clubTheme` → null);
  - lists: players wanted (0–6), alumni (0–12) and videos, each empty or not;
  - public slug: set or not.
- **Phone (390):**
  1. page header;
  2. the title "Your club page" and the club;
  3. flashes;
  4. seven form panels in the built order: About your club, Club crest, Banner, Club colours, Players wanted, Alumni wall, Club video;
  5. **each form's list sits under it as one panel of rows** (title, detail, Remove as `.console-btn`), where today there's a card per item;
  6. the link card;
  7. Back.
  
  The crest tile with no crest is **the dashed empty tile** ("not yet"). The Banner and Club colours panels each carry **the club hero preview**: the `/fc/[slug]` hero drawn at preview size with the "Club" and "Verified club" pills, the crest tile, the name, "Est. · place", the pathway, the trim border and the colours. The banner photo sits behind it when there is one.
- **Laptop (1280):**
  - **P4:** from 1024 `.cc-split` (340px): the forms in the first column, and **one sticky preview** in the second. It's the same hero part, plus Squads / Trials coming and the first trial row with its month in the trim colour. The two in-form previews hide from 1024.
  - Without P4: the forms sit in a 640 column beside the rail, with the in-form previews, as today.
- **Parts:** A: page header, page title, panel, field, well, empty tile, buttons (the glow on "Save", the first primary). `.filefield` and the preset radios (as built). New: `.club-hero-preview` (see New shared parts) and `.cc-split`.
- **Copy:** verbatim, all, including every hint, both child-safety lines ("Never name anyone under 18." …, "Keep the title about the club, not about a child." …), the 12 preset names, "No crest yet — your page shows a letter until you add one.", "Upload another to replace it.", "No banner yet", "Your club page link" and "Go back to Pitch green". New: none. The aside's label "Your club page" reuses the page title; if BUZ prefers no label there, drop it.
- **Must not change:**
  - D-172: an unclaimed club has no colours, no image and no seat here;
  - `clubTheme()` does the contrast arithmetic and nobody is told their colours are wrong;
  - buttons stay green whatever the colours;
  - uploads are re-saved and stripped (the security posture, §7);
  - the alumni 18+ tick is required;
  - video is a link and a façade (D-97);
  - the caps (6, 12) are enforced at write.
- **Done when:**
  1. The preview and `/fc/[slug]`'s hero use the same hero, trim and crest colours for the same stored values (read from `clubTheme`, one function).
  2. A club with no crest shows the dashed tile in the form and the preview.
  3. Every list is one panel of rows.
  4. With P4, the preview is visible beside every form at 1280 and absent below 1024. At 1024 the form column is ≥352px.
  5. There's one glow ("Save").

### /club/billing  ·  nobody, while billing is off  ·  size none now
- **Source:** `app/club/billing/page.tsx`.
- **States:** today the only reachable one is **redirect to /home** (`billingEnabled()` false, D-163). Behind the switch: unsubscribed (the plan form), active, grace, suspended, cancelled, and the flashes paid, unconfigured and error.
- **Phone / Laptop:** nothing renders. The rail and the seat bar carry no "Plan & billing" door (console-shell, as built).
- **Parts / Copy:** none drawn. **No price appears in the mockup or in this spec** (D-163).
- **Must not change:**
  - the redirect;
  - no door to the page while the switch is off (free-r2, the nav check at render-tests 1759–1766);
  - the D-136/D-137 disclosure and authority tick stay in the code, whole, behind the switch.
- **Done when:** free-r2 stays green and no F change touches this file. The page gets its own pass when BUZ prices Premium (P6). Until then A's base pass (`.card` → panel) restyles it for free, and that is enough.

### /club/invite/[registrationId]  ·  the TD at a verified club, for an invitable registration  ·  size M
- **Source:** `app/club/invite/[registrationId]/page.tsx`, `actions.ts`.
- **States:**
  - compose, for a minor (u16 or 16–17) or an adult; from the register, or from a trial registration (the lead line names the trial, and the trial tile shows its date);
  - compose with `?cannot` (the red refusal);
  - sent (no reply);
  - replied: "Will be there" or "Interested, but not that date", with or without a note, and with email, phone, both or nothing handed over;
  - not found (malformed, refused, an administrator, P19).
- **Phone (390):**
  1. **A's top bar** (logo only; the page has no frame, as today);
  2. the page header with back "The register", in the column, at every width;
  3. **the door** holding:
     - the kicker (the club name, **muted, not amber**);
     - the title "Invite {name}" and the lead line;
     - "What you're sending" as two tiles (**`:has(input:checked)` styling, which fixes the tile that never shows as picked**);
     - the message `.field` and its line;
     - "Where this actually goes" (the hero panel, as approved; ticks in accent, crosses in `--red`);
     - the `.btn-primary` send with the glow;
     - Cancel as a text button.
  
  Sent: the door with the title and one panel sentence. Replied: the door with the title and a `.card-accent` holding the answer (ink, 16/900), the note, `.panel-h` "What they handed over", and the details or the "No contact details…" line. Both end with "Back to the register".
- **Laptop (1280):** the same door centred (A part 20: 640, lifted), under the top bar, with the back link above the door.
- **Parts:** A: top bar, page header, door, field, notice, buttons. New: `.choice-tile` (see New shared parts).
- **Copy:** verbatim, all eight "where" lines, both send labels, "Football only." (with the minor's second sentence), the refusal, the sent sentence, both answers, "What they handed over", and "No contact details. That is their choice, and it is allowed." The refusal box moves from `rgba(227,73,72,…)` to the `--red` token.
- **Must not change:**
  - P1–P20: one invitation per registration, and no second message;
  - the club sees sent or answered only, never read or lapsed (P7);
  - a minor's reply comes through only after a parent approves it;
  - the message is refused at write if it holds contact details;
  - not-found for any refusal.
- **Done when:**
  1. Picking "We're interested" shows it as picked, with JavaScript off.
  2. No amber on the page.
  3. The refusal uses `--red`.
  4. s11c stays green.

## New shared parts (class, exact CSS, where used)

These are **proposed for the Head of Product Design to reconcile** with A and the other groups.

```css
/* A create form behind one chip — the trials board's <details> disclosure. Open by default when its list is empty. Squads (x2), roles. */
.cc-adder > summary { list-style: none; cursor: pointer; display: inline-flex; }
.cc-adder > summary::-webkit-details-marker { display: none; }
.cc-adder > summary::marker { content: ''; }
.cc-adder > summary.chip { color: var(--ink); font-weight: 800; }
.cc-adder[open] > summary { border-color: var(--accent); }
.cc-adder[open] > .card { margin-top: 10px; }

/* A flash line after a server action. Squads (7), a squad (2), roles (4), page-edit (4), post-trial (2). */
.cc-said { border-radius: var(--r-card); padding: 13px 14px; font-size: 13px; font-weight: 700; line-height: 1.5; color: var(--secondary); background: var(--fl-surface); border: 1px solid var(--line); box-shadow: var(--shadow-card); }
.cc-said-ok { border-color: var(--accent); }
.cc-said-warn { border-color: var(--amber); }
.cc-said-bad { background: rgba(227,119,118,.12); border-color: rgba(227,119,118,.45); color: var(--ink); box-shadow: none; }

/* A door and the list it edits, side by side from 1024. Post-trial (300px), page-edit P4 (340px). */
.cc-split { display: flex; flex-direction: column; gap: 22px; }
@media (min-width: 1024px) {
  .cc-split { display: grid; grid-template-columns: minmax(0,1fr) var(--cc-aside, 300px); gap: 28px; align-items: start; }
  .cc-split > aside { position: sticky; top: 24px; display: flex; flex-direction: column; gap: 9px; }
  .console-frame .cc-split .door { max-width: none; margin: 0; }
}
@media (max-width: 1023px) { .cc-split .cc-only-wide { display: none; } }
@media (min-width: 1024px) { .cc-split .cc-only-narrow { display: none; } }

/* A door inside the console frame sits beside the rail, not mid-window (the D-147 rule, for A's door). */
@media (min-width: 1024px) { .console-frame .door { margin-left: 0; margin-top: 0; } }

/* The register bucket title row. */
.reg-bucket { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding-top: 4px; }
.reg-bucket-t { font-size: 17px; font-weight: 900; letter-spacing: var(--ls-title); }
.reg-bucket-s { font-size: 12px; font-weight: 500; color: var(--muted); }
.reg-bucket-n { font-size: 12px; font-weight: 800; color: var(--muted); }

/* The register's phone row: rows inside one bucket panel (the .m-only render). */
.reg-row { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 10px 12px; padding: 14px 0; }
.reg-row + .reg-row { border-top: 1px solid var(--line); }
.reg-row-note { grid-column: 1 / -1; background: var(--surface-sunken); border-radius: var(--r-well); padding: 10px 12px; font-size: 12.5px; font-style: italic; font-weight: 500; color: var(--secondary); line-height: 1.5; }
.reg-row-act { grid-column: 1 / -1; display: flex; gap: 8px; }
.reg-row-act > .btn { flex: 1; }

/* A pick-order position pill (squad sheet, ask list). The first choice is lit in ink: a fact, not a button. */
.pos-pill { display: inline-flex; align-items: center; gap: 6px; border-radius: var(--r-pill); padding: 4px 10px; background: var(--surface-2); border: 1px solid var(--line); }
.pos-pill.first { background: rgba(255,255,255,.08); border-color: var(--secondary); }
.pos-pill-k { font-size: 9.5px; font-weight: 800; letter-spacing: var(--ls-label); text-transform: uppercase; color: var(--muted); }
.pos-pill.first .pos-pill-k { color: var(--ink); }
.pos-pill-v { font-size: 12.5px; font-weight: 700; color: var(--ink); }

/* The squad sheet's player row: one line from 1024. */
.sq-player { display: grid; grid-template-columns: 40px minmax(0,1fr); gap: 10px 12px; align-items: center; padding: 14px 0; }
.sq-player + .sq-player { border-top: 1px solid var(--line); }
.sq-player > .sq-pos, .sq-player > .sq-stats, .sq-player > .sq-act { grid-column: 1 / -1; }
.sq-act { display: flex; gap: 10px; align-items: center; justify-content: flex-end; }
@media (min-width: 1024px) {
  .sq-player { grid-template-columns: 40px minmax(160px,1.1fr) minmax(0,1.6fr) auto; padding: 12px 10px; }
  .sq-player > .sq-pos { grid-column: auto; }
  .sq-player > .sq-stats { grid-column: 2 / 4; }
  .sq-player > .sq-act { grid-column: 4; grid-row: 1; }
}

/* Verify offers above a club-side CV: stacked, then three across. */
.verify-strip { display: flex; flex-direction: column; gap: 8px; padding-top: 14px; }
@media (min-width: 768px) { .verify-strip { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; } }

/* A radio shown as a tile, which reads its own checked state (invite "What you're sending"). Same idea as .pick. */
.choice-tile { flex: 1; position: relative; min-height: 62px; border-radius: var(--r-btn); border: 1px solid var(--line); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 6px 8px; text-align: center; cursor: pointer; }
.choice-tile > input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
.choice-tile b { font-size: 13px; font-weight: 700; color: var(--muted); }
.choice-tile span { font-size: 10.5px; font-weight: 500; color: var(--muted); }
.choice-tile:has(> input:checked) { background: rgba(61,220,132,.14); border: 1.5px solid var(--accent); }
.choice-tile:has(> input:checked) b { font-weight: 900; color: var(--accent); }
.choice-tile:has(> input:checked) span { font-weight: 700; color: var(--secondary); }
.choice-tile:has(> input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }

/* The /fc/[slug] hero at preview size (page-edit). Colours come from clubTheme() inline, exactly as /fc does. */
.club-hero-preview { border-radius: 14px; overflow: hidden; border: 1px solid var(--line); background: var(--bg); }
.chp-in { position: relative; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; padding: 18px 14px 16px; }
.chp-crest { width: 56px; height: 56px; border-radius: 15px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 21px; border: 1px solid rgba(238,245,240,.16); box-shadow: var(--shadow-float); overflow: hidden; }
.chp-name { font-size: 22px; font-weight: 900; letter-spacing: var(--ls-title); line-height: 1.05; } /* fixed: a preview is not the hero headline */
.chp-sub { font-size: 12px; font-weight: 500; color: rgba(255,255,255,.8); }
.chp-path { font-size: 11.5px; font-weight: 500; color: rgba(255,255,255,.64); }
.chp-row { display: grid; grid-template-columns: 48px minmax(0,1fr); gap: 10px; align-items: center; padding: 12px 14px; }
```

**Reconciliation notes for the Head of Product Design (not for BUZ):**
- **Row primaries don't glow.** A's rule puts `.fl-glow` on the first `.btn-primary` in reading order. The register's phone rows carry one `.btn-primary` per shortlisted child, and the first of them shouldn't glow: the register has no screen-level primary. F asks for: "row actions never glow".
- **"Remove" in a list.** F uses `.console-btn` (A part 17). E proposes `.textbtn` (a 44px text button) for the same job. Pick one for both groups.
- **New is green.** F follows A part 15 (the New numeral and pill in `--accent`). F's own view is that New is a resting state and green is an action, so New would be neutral. It's not drawn, and it's A's call.
- **The club seat card's crest tile** could show the club's crest, or its initial on the club's trim colour once colours are set: identity, D-173 (4). That's A's part; F doesn't need it.

## New copy for BUZ (current line → proposed line, why)

| # | Where | Current | Proposed | Why |
|---|---|---|---|---|
| N1 | `/club/register`, verified, **no registrations at all** (with P2) | "Nobody matches that yet. Show everyone — the list is the same list, just narrowed." | **"Nobody has registered interest in your trials yet. Post a trial and families register from it."**, reused verbatim from the trials-only branch of the same file | The current line isn't true here: nothing was narrowed. The reused line is approved and true. It is narrower than the whole truth, since families also register from the club page. If BUZ wants that said, it's a new line and goes to copy check. The filtered-to-nothing case keeps the current line. |

**Lines flagged, not rewritten:**
- "The whole register is a plan", "See the Interest Register" and the billing page's "Your club page, your trial notices and CVs arriving by email are free and stay free." aren't true of today's product (D-163). All three are **unreachable while billing is off**, so nothing changes now. They must be re-read before the switch flips.
- Nothing else found untrue.

## Product decisions for BUZ (not look; behaviour, numbers, doors)

| # | Decision | What it buys | What it costs | F's view |
|---|---|---|---|---|
| **P1** | **The return.** "Open the CV" and "Invite to trial" carry the register's filters and the row's anchor. The CV's "The register" link and the invite's back link return to `/club/register?age=…&pos=…&status=…#r-{id}`. The server accepts only those three known parameters, whitelisted as the page already does. | A TD working 100 rows gets back to the row they left, filtered as they left it. Today every CV visit drops them at the top of an unfiltered list. It's the fix the 23 Sep proposal chose instead of a CV drawer (one read path, D-80). | ½ day. A `back` search param on two routes, validated against the register's own filter keys, and a row `id`. One render check. | **Yes.** It's the single biggest time-saver for the person who uses this most. |
| **P2** | **D-162 on the club console.** Zero is omitted everywhere F renders a count: the register's New/Shortlisted/Invited numerals and "· 0" chips, "0 waiting" (the sentence stays alone), "· 0 squads", and "· 0 open". An **empty verified register shows no filter panel** (the trials board's P3 logic), with N1. | The same rule as every other screen, and an empty club stops looking broken. | 2 hours. The render checks that count "Shortlisted" (w11) still pass on the seed, which has all three. | **Yes.** |
| **P3** | **The posted confirmation shows the notice as the board will**: the trial row, with an inert, secondary button. | The club sees its listing exactly as a family will before it leaves the page. No new words. | 2 hours. New content on a confirmation, and a render check. | Yes, but after P1 and P2. |
| **P4** | **Page editor, laptop: one sticky preview of the club page** beside the forms from 1024. It shows the hero with crest, banner and colours, the counts, and the first trial row. The two in-form previews hide at that width. | Every save is seen where a family sees it. The preview finally looks like `/fc/[slug]`. | ½ day. Two new reads of the club's own public counts (squads, advertised trials; no child data), and the preview becomes one component shared with the in-form ones. The laptop shows one preview where the phone shows two. It's the same content, but it's a D-147 call. | **Yes.** |
| **P5** | **The weekday on a club-posted notice.** A Pitch-compiled notice reads "Sun 9:00 AM · Riverside Park, Pitch 2". A club-posted one reads "9:00 AM · Riverside Park, Pitch 2", because the form asks for the time and the date separately. Fix it on the board: `/trials` and `/fc` prefix `to_char(trial_on,'Dy')` to the meta line **for `source = 'club'` only**. | Every listing reads the same, and families check the day first. | 1 hour in H's pages, plus one render check. Writing the weekday into `time_venue` instead would break the edit form, which splits on " · ". | Yes. It's H's page to change. |
| **P6** | **Billing stays undrawn** until Premium is priced. Then `/club/billing` gets its own Floodlit pass, from 23 Sep's `club-billing.html` thinking (who reads the register, the statement descriptor). The charge history (D-c6) is deferred. | No price anywhere, and no design work spent on a screen nobody can reach. | Nothing now. | Yes. |

No route, door, field or permission is added by any of these. P1 adds query parameters to two existing routes, and P4 adds two reads of public counts.

## Build order and dependencies

1. **A's base pass first.** Once `.card` becomes the Floodlit panel, `.tag` becomes a pill, and the page header and door exist, `/club/*` gets about 60% of its look for free. That includes every panel, flash, well and list card, and the billing page (untouched otherwise).
2. **Moves with the base pass alone:**
   - `/club/roles` (plus `.cc-adder` and the neutral Paid pill);
   - the invite (plus `.choice-tile`, the muted kicker and `--red`);
   - both CV wrappers (plus PlayerCV's `head` slot, with group C).
3. **The register** (L): bucket panels, the phone row, the pills, the 1024 filter rows, then **P2** and **P1** in the same pass. `.d-only`/`.m-only` stay.
4. **Squads, then a squad:** `.cc-adder`, the table, `.sq-player`, `.pos-pill`, and "Ask them" / "Not this squad" onto the charter's buttons.
5. **Post a trial:** field wells, then `.cc-split` with the compact trial rows. **P5** is with group H.
6. **Page editor:** the list panels, the dashed crest tile, `.club-hero-preview` from `/fc`'s hero code, then **P4**.
7. **P3** last.

## Risks and suites likely to move

- **render-tests.mjs:**
  - **r33–r35 and free-r5:** "{n} waiting" must stay one text node, and no fixture name may appear in the held body.
  - **r36–r38:** every row keeps its `/club/register/cv/{id}` link in the HTML (the `.d-only` render counts; keep both renders).
  - **w9–w11:** the Shortlist form keeps its hidden `registrationId`/`status`. The "Shortlisted" occurrences can only rise.
  - **the rail/door parity check at 687–689:** no door is added or removed.
  - **s10–s12f** (administrator and coach not-found);
  - **free-r2 and the billing nav checks (1651–1766):** untouched.
- **layout-check.mjs:**
  - the register table at 768 and 1024–1031. The filter's 128px label column only moves the chips, not the table.
  - `/club/squads` and a squad at 390, 768, 1024 and 1280 (line 563): the new squads table columns sum to 510px plus the name, which fits 678 at 768.
  - page-edit with P4 at 1024: the form column is 352px, the phone's width.
  - post-trial's `.cc-split` at 1024: the door is 392px.
  - the 10px `.field-label` rule, now matched on post-trial.
- **permission-tests.mjs / doc 14:** no read changes. M1, N6, N16–N24 and P6/P7/P19 are unaffected by the look. **P1** adds a query string. Its test: a `back` value with any key other than age/pos/status, or any path other than `/club/register`, is ignored.
- **palette-check.mjs:** no new token. The invite's refusal moves *onto* `--red`.
- **Copy check:** only N1's reuse and the moved summaries ("Add a squad", "Post a role", "Bring in a coach", reused headings) are new placements.
- **Busy clubs:** the register renders every row, with no paging (400 rows is roughly 4× today's DOM). Not a design change, and not proposed here. If a club passes about 300, the age chips are the relief valve, as built. Watch it; don't build for it.
