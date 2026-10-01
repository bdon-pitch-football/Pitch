# E — Coach: build spec

**Seat:** design-proposal, for the Head of Product Design, then Leo's build team. **Date:** 1 Oct 2026. **Branch:** design/player-cv (nothing committed).
**Mockup:** `docs/design/mockups/floodlit-coach-and-public.html`, group E: 16 states, each at 390 and 1280 in the same markup. Shell parts are A's (`specs/A-shells-and-homes.md`), referred to by their bold names.

## Summary

- **What changes:** the coach's public page is rebuilt from the player card's own parts (`THE PLAYER CARD` in globals.css), so player, coach and club read as one family. The editor, the registrations and the jobs board move onto A's parts: one **panel** per form, one **field** well, the charter's two buttons, **pill**, **list row**, **stat row**, **empty tile**.
- **What it fixes:** the coach page is the last public profile still drawn in the old 640 column with a hand-built hero. The editor has three field styles, a one-off primary (radius 15, weight 900) and four "＋ Add" buttons that are a third button. Green is used as decoration: licence stars, "Paid", "Current", the Clubs numeral. The December line uses amber, which is a state, for "not yet".
- **Size:** about 3½ days after A's base pass: `/c` M (1 day), `/coach/edit` M (1 day), `/jobs` and `/jobs/[roleId]` S (½ day, plus 2 hours with E2), `/coach/register` S (3 hours), `/c/…/print` S (2 hours).

## Pages

### /c/[slug]  ·  anyone (public, indexable)  ·  size M
- **Source:** `app/c/[slug]/page.tsx`, `components/cv/ClipCard.tsx`, `components/cv/CopyLink.tsx`. Not touched: `app/c/[slug]/opengraph-image.tsx`.
- **States:**
  - full (Sam Kaya);
  - sparse (Marina Petrovic: no banner, no photo, no philosophy, no licences, wins or clips);
  - banner or no banner;
  - photo or initials;
  - crest (only for a club held by live membership whose name matches the current role's org) or none;
  - Years coaching and/or Clubs (Clubs only when above 1), or neither;
  - WWCC attested or not;
  - no current role (the well "Not currently attached to a club.");
  - no past roles (no "Before that");
  - licences and wins (and the own-account line when either exists);
  - clips;
  - contact shown or absent (absent when the coach published none, and absent from the response for a signed-in minor, L48–L51);
  - unknown slug → the 404 (H).
- **Phone (390):**
  1. **Top bar**, logo-only, the logo not a link (as today).
  2. The **coach card**, full-bleed:
     - the banner strip (bleeds to the card edges) with the photo overlapping it by 46px, and the Coach pill on the right;
     - the name as `.cv-name`;
     - the current title;
     - crest + "org · region";
     - Years coaching and Clubs as one `.cv-stats` band (two 52px tiles, a hairline between them);
     - the WWCC pill at the card's foot (the Parent-approved pill's style).
  3. The story, in `.cv-story`, each section under `.cv-h2`:
     - **Coaching philosophy** as `.cv-about` (18px ink, 40ch);
     - **Coaching now**: one `.cv-timeline`. The current role is `.cv-stop-now`, "Before that" is a small label inside the same line, and the past roles are `.cv-stop` rows with their years right-aligned;
     - **Licences & qualifications**: a **panel list** of **list rows** (star in `.row-ic`, stroke in secondary, year at the end);
     - **As a coach**: `.fl-grid-2` of panels (44px icon well, stroke secondary);
     - the own-account line (12px muted, 60ch);
     - **Sessions & clips**: `.fl-grid-2` ClipCards, the first carrying "Nothing loads until you press play";
     - the December line, with a dashed ring instead of the amber dot;
     - **Getting in touch** as one panel;
     - "Copy this link" and "Print or save as PDF" as two secondaries;
     - "Report this page".
  4. Footer.
- **Laptop (1280):** with **E1**, `.fl-wide` plus `.cv-grid`: the card is a sticky 440px column on the left and the story on the right, exactly the player CV's geometry. The clip and win grids go two-up from 768, and the two share buttons go two-up from 640. Without E1, the same markup sits in the 640 column (the card full-width at the top) and the name is fixed at 28px.
- **Parts:**
  - A: **Top bar**, **panel**, **panel list**, **list row**, **well**;
  - player card: `.cv-grid`, `.cv-cardcol`, `.cv-hero`, `.cv-avatar`, `.cv-name`, `.cv-stats`, `.cv-tile-num`, `.cv-h2`, `.cv-about`, `.cv-timeline`, `.cv-stop`, `.cv-stop-now`, `.fl-grid-2`;
  - new (see New shared parts): `.cv-banner`, `.cv-top`, `.cv-kind`, `.cv-line`, `.cv-where`, `.cv-pill`, `.cv-foot`, `.cv-tiles`, `.cv-tile-l`, `.cv-tl-h`, `.cv-stop-row`, `.soon`, `.notyet-dot`, `.share`, `.report-link`, `.win`, `.win-ic`.
  - The card background is the player card's green (the `heroBg` fallback in `PlayerCV.tsx`), **never a club's colours** (not proposed; it would need John, as `CV_WEARS_CLUB_COLOURS` did).
  - The Clubs numeral goes from accent to ink (A part 15).
  - The licence and win icons go from accent to secondary.
- **Copy:** every string is verbatim: "Coach", "Years coaching", "Clubs", "WWCC", "Coaching philosophy", "Coaching now", "Since {year}", "Before that", "{from} — {to}", "Not currently attached to a club.", "Licences & qualifications", "As a coach", "Licences and results above are {first}'s own account. The Working With Children Check is the one thing on this page a club confirmed.", "Sessions & clips", "Nothing loads until you press play", "Players developed and improvement delivered arrive here in December.", "Getting in touch", "For clubs and other adults. {name} published this themselves — it is their own address, not one we handed over.", "Copy this link", "Print or save as PDF", "Report this page". See EC2 and EC3.
- **Must not change:**
  - D-98: WWCC is a chip only when a club attested it, and never a number;
  - the crest rule (membership only, name match, 0006, D-72 discipline);
  - L48–L51: the contact is absent from the body for a signed-in minor;
  - L46: the page carries no token (do not import anything with "token" in its name or path; `lib/palette` is named for this reason);
  - L44/L45/L54: copy only, no send;
  - D-97: click-to-play;
  - the canonical and indexability;
  - the report link's `kind=coach_cv`.
- **Done when:**
  1. At 390 the DOM order is: card (photo, Coach, name, title, crest line, stats, WWCC), then philosophy, Coaching now, Before that, licences, As a coach, own-account line, clips, December line, contact, copy/print, report. r26 ("Years coaching" before "Coaching philosophy") still passes.
  2. crest-r1 and crest-r2 still find the crest `src` and "Riverside FC · Melbourne VIC" before "Coaching now".
  3. At 1280 (E1), the card is sticky at `top: 76px` in a 440px column, the story column starts at the card's top, and under 700px of height the card scrolls (the player CV's rule).
  4. No accent colour on the page except the WWCC shield, the timeline's current dot, the play buttons and the contact link.
  5. Marina's page renders with no empty heading, and the name fits the card at 390 with no clipping (the `--name-len` rule).

### /c/[slug]/print  ·  anyone  ·  size S
- **Source:** `app/c/[slug]/print/page.tsx`, `app/p/[token]/print/PrintButton.tsx` (shared with the player's print).
- **States:**
  - full;
  - no philosophy, licences, wins or clips (each section omitted);
  - roles only;
  - the button hidden in print (`.no-print`).
- **Phone (390):** the white sheet with 18px sides (it is 28px today, which crowds a phone): "Save as PDF" right-aligned, then the name, the line, the credentials line, the sections, the own-account line, the clips as titles, the address.
- **Laptop (1280):** the same sheet, max 760px, centred. No change.
- **Parts:**
  - C's print tokens (`--print-paper`, `--print-ink`, `--print-2`, `--print-muted`, `--print-line`; see `specs/C-player.md`) replace the literals `#ffffff`, `#3a4a42`, `#5c6f65` and `#e6ece9`, so the coach sheet and the player sheet are one light surface;
  - the own-account note moves from `T.muted` (#8a9d92 on white, about 3.2:1) to `--print-muted`;
  - `PrintButton` is shared with the player's print and is restyled once, as C specifies (`.btn-primary.btn-auto`, no longer 44px/radius 10/800). The coach print takes it unchanged.
- **Copy:** verbatim. See EC3 ("WWCC verified").
- **Must not change:** it prints what the page shows (licences and the own-account line included); no clip loads; `robots: noindex`; the title is the PDF's filename (D-121).
- **Done when:**
  1. No hex literal is left in the file.
  2. The own-account line measures ≥4.5:1.
  3. The button is C's, and is hidden in print.
  4. The sheet uses the same tokens as the player's print.

### /coach/edit  ·  a signed-in coach (any age; the frame only for a coach seat)  ·  size M
- **Source:** `app/coach/edit/page.tsx`, `components/PremiumRows.tsx` (restyled only by A's **panel**), `components/FailureState.tsx` (`FAILURE_COPY.coachNeedsProfile`), `components/console-shell.tsx` (`CoachConsole`).
- **States:**
  - notices (`?saved`, `?published`, `?hidden`, `?clip=bad|full|noprofile`, `?photo=bad`, `?banner=bad`, `?needs=profile`);
  - photo or none;
  - banner or none;
  - roles, licences, wins and clips each empty or listed;
  - clips at the cap (the add form is gone);
  - adult (contact field and Premium rows) or under 18 (neither);
  - public page: live, down, never published, or under 18;
  - Premium tapped (`?first=1`);
  - WWCC confirmed or waiting (with or without a club);
  - no coach seat (a TD or admin, or no profile yet): no frame, the page on the plain floodlight (A: the no-seat branch of `CoachConsole` gets the **top bar**).
- **Phone (390), in today's order:**
  1. **Page header** (Back) and **page title** ("Build your coach CV" / "Five minutes. Edit anything later.");
  2. the notice slot (A's **notice**: accent for Saved and Live, amber for every "didn't work", a plain **panel** for "Your page is down");
  3. **Your photo** panel (66px well at `--r-card`, the dashed **filefield**, "Save the photo" secondary, the EXIF line);
  4. the profile panel:
     - "Full name" as a read-only well, then Region and "How clubs reach you — optional" (adult only) as **fields**;
     - "How you want to play" as a **panel heading** over the textarea field, then its help line;
     - "Save & preview" as the primary with the glow;
  5. **Where you've coached**: a **section heading** with "Newest first" at its end, then a **panel list** of **list rows** (title, "Current" as a **pill**, "org · from — to", "Remove" as a 44px text button);
  6. **Banner** panel: the preview; "No banner yet" is an **empty tile**;
  7. **Licences & qualifications**: section heading, the rows, then an add panel with Licence, Who issued it and Year (the last two two-up from 640), "Add a licence", and the note;
  8. **What you've done as a coach**: section heading, the rows, then an add panel with What happened and Where and when (two-up from 640), "Add an accomplishment", and the note;
  9. the add-role panel (2×2 fields, "Add a role");
  10. **Sessions & clips · n of 5**: section heading, the rows (title, URL ellipsised, Remove), the add panel with its two lines, then the two Premium rows (adult);
  11. **Your public page**: section heading and its panel, four ways;
  12. "Coaching roles at clubs" as a secondary button;
  13. **Working With Children Check**: section heading, the panel (36px icon well, green when confirmed, amber when waiting), the footnote.
- **Laptop (1280):**
  - the coach **Frame**: the 232px **rail** with the rail mark and the seat card (first name, club), and My CV current;
  - the page header's mark is hidden (A);
  - the 640 reading column sits beside the rail;
  - same order, and pairs two-up from 640. Nothing moves beside the column.
- **Parts:**
  - A: **Frame**, **Rail**, **Seat bar**, **Page header**, **Page title**, **Section heading**, **Panel heading**, **Panel**, **Panel list**, **List row**, **Pill**, **Notice**, **Empty tile**, **Field**, **Buttons and the one glow**;
  - globals: `.filefield` (its border becomes the empty tile's dashed `rgba(255,255,255,.3)`: dashed means not yet);
  - every hand-built `input` style moves into `.field` (`fieldLabel` becomes `.field-label`);
  - "Save & preview" becomes `className="btn btn-primary fl-glow"`, replacing the inline radius-15/900 button;
  - the four add buttons become `btn btn-secondary`, with a 16px stroke plus (`<path d="M12 5v14M5 12h14"/>`) replacing the "＋" glyph;
  - every "Remove" is one text button: 44×44 minimum, 12px/700, muted, no border. The clip row's outlined 44px button goes;
  - "Publish my page" is `btn btn-primary` with no glow (it is not the first primary).
- **Copy:**
  - verbatim, every line in the source, including the `FAILURE_COPY.coachNeedsProfile` line (still awaiting BUZ, see H HC2);
  - the only visible change is the "＋" character becoming an icon;
  - see EC4.
- **Must not change:**
  - D-82: no Premium rows and no contact field under 18, decided by the database band;
  - at most two Premium rows (D-164(4)); no price (D-163);
  - D-98: "Don't send us the number", and no field for it;
  - every form's `action`, every field `name` (`region`, `publicContact`, `philosophy`, `title`, `issuer`, `year`, `detail`, `org`, `from`, `to`, `url`, `roleId`, `licenceId`, `achievementId`, `clipId`, `photo`, `banner`);
  - the multipart posts to `/coach/edit/photo` and `/coach/edit/banner`;
  - "Publish my page" and "Take my page down" stay the button's only content (write-tests find those forms by the submit button's inner HTML).
- **Done when:**
  1. The page has exactly one `.fl-glow`, on "Save & preview".
  2. No `input` or `textarea` outside a `.field`.
  3. No button that is neither `.btn-primary`, `.btn-secondary` nor the 44px text button.
  4. The under-18 render (Nate) shows neither Premium rows nor the contact field (the existing render checks at 1377/2451 pass).
  5. At 1280 there is one logo (the rail's).
  6. The E3 order only if BUZ approves it.

### /coach/register  ·  a coach with a live register grant (D-154)  ·  size S
- **Source:** `app/coach/register/page.tsx`.
- **States:**
  - full (grouped by club, then squad);
  - filtered (`?team`, `?pos`) with "{shown} of {all} shown · Clear";
  - filtered to nothing ("Nobody matches these filters.");
  - nobody registered ("No one has registered for your teams yet.", with no filters);
  - a row the database won't open (no button);
  - a row with or without a note;
  - one team (no "Which team" group);
  - no grant → 307 to /home (unchanged).
- **Phone (390):**
  1. page header and page title;
  2. the filters in one **panel** ("Which team" and "Where they play" as field labels over `.chip` rows);
  3. per club, a **section heading**; per squad, "{squad} · {n}" at 14/900;
  4. each registration its own **panel**: first name 16/800, positions line, the note in a 12px-radius well, then "Open the CV" as `btn btn-secondary`;
  5. the **well** with the recorded-reads line;
  6. "Back" (`.btn-ghost`).
- **Laptop (1280):** the coach frame, Registrations current, the 640 column beside the rail. One column: the notes are sentences, and two-up would squeeze them.
- **Parts:**
  - A: **Frame**, **Page header**, **Page title**, **Panel**, **Section heading**, **Empty tile** (both empty lines), **Well**;
  - globals `.chip`;
  - the note loses `font-style: italic`, since Archivo has no italic file and the browser fakes one. The quotes stay.
- **Copy:** verbatim, including "All teams · {n}" and "{team} · {n}" as written (keep the middot in the text; do not convert it to `.chip-count`).
- **Must not change:**
  - D-154/D-117: no invite, no status, no shortlist;
  - the filters apply after `fn_register_rows`, never inside it;
  - every row served is logged (`register_read_log`);
  - "Open the CV" renders only when `fn_can_read_registration` says so;
  - `data-registration` stays on each row.
- **Done when:**
  1. The s12 render checks (filters, forged params, 307) pass unchanged.
  2. "Open the CV" is a 46px secondary.
  3. Both empty lines sit in the empty tile as one element.
  4. No italic.

### /jobs  ·  anyone; a coach sees it in the coach frame  ·  size S (+2 hours with E2)
- **Source:** `app/jobs/page.tsx`.
- **States:**
  - roles (newest first);
  - none ("No open roles right now. …", with no numbers);
  - signed out, or a non-coach (no frame, the **top bar**);
  - a coach seat (the frame, Roles current).
- **Phone (390):**
  1. top bar;
  2. **page title** ("Coaching roles" and its line);
  3. the **stat row**: Open roles at 56, Paid and Clubs at 34, **all numerals ink** (Clubs keeps secondary as today);
  4. each role its own **panel** used as a **list row**: title 16/800, "{club} · Verified" (accent stays on "Verified"), "{age} · {commitment}" or "Details inside", then at the end the pay **pill** ("Paid" or "Volunteer", both neutral) and a chevron;
  5. the well (see EC1);
  6. "Back".
- **Laptop (1280):** with **E2**, `.fl-wide`: the title block and the stat row share one line (the numbers right-aligned), and the rows go two-up. The well and Back stay at 640. Without E2, the same markup sits in the 640 column. In the coach frame, the rows go two-up in the frame's main column from 1024 under E2.
- **Parts:**
  - A: **Top bar**, **Frame**, **Page title**, **Stat row**, **Panel**, **List row**, **Pill**, **Empty tile**, **Well**;
  - `.jr` sets the row padding (16/16/14 on a phone, 18/20 from 768), the trial row's padding.
- **Copy:**
  - verbatim: "Coaching roles", "Clubs looking for coaches. Newest first — nothing here is ranked or recommended.", "Open role(s)", "Paid", "Clubs", "Volunteer", " · Verified", "Details inside", "No open roles right now. Clubs post here through the season, and most of it happens between September and December.", "Back";
  - the empty line is split into `.empty-t` and `.empty-b` inside one element;
  - see EC1.
- **Must not change:**
  - D-74/0151: chronological, no recommender, nothing from a suspended club;
  - no personalisation;
  - `PublicAnalytics` stays beside the console, not inside it (L3, and analytics may start only here on a signed-out visit);
  - s9: no `console-nav` for a non-coach.
- **Done when:**
  1. No accent on Paid.
  2. Each role is one link with a ≥56px row.
  3. The empty state shows no numbers.
  4. The analytics layout pass still counts /jobs.
  5. With E2 at 1280, two columns and no horizontal scroll at 1024–1031.

### /jobs/[roleId]  ·  anyone; applying needs an adult coach profile  ·  size S
- **Source:** `app/jobs/[roleId]/page.tsx`, `app/coach/edit/actions.ts` (`applyForRole`, unchanged).
- **States:**
  - signed out ("Sign in to put your name forward");
  - can apply (the form);
  - `?sent` (accent notice), then already in ("Your name is in for this one. The club has your CV.");
  - `?cannot` (amber notice);
  - no coach profile (panel with "Build one");
  - closed (`closed_at`, and `?closed`);
  - an unknown or suspended club's role → 404.
- **Phone (390):**
  1. top bar (signed out) or the coach frame;
  2. **page title**: the role title, then the club (still a link to `/fc/{slug}`, secondary) with " · Verified club" in accent, then the meta line;
  3. the notice;
  4. **About the role** (a section heading, then the body at 14px, pre-wrap, 64ch);
  5. the action: the primary, or one **panel** holding "Put your name forward", the textarea field, "Send it to {club}" (the glowing primary) and its line;
  6. "All roles" (`.btn-ghost`).
- **Laptop (1280):** the 640 reading column, centred under the top bar, or beside the rail in the frame.
- **Parts:** A: **Top bar**, **Frame**, **Page title**, **Section heading**, **Notice**, **Panel**, **Well**, **Field**, **Buttons and the one glow**.
- **Copy:** verbatim. One render fix: **"This role has closed." renders once.** When `?closed` and `closed_at` are both true, show the closed **well** only and drop the amber notice. This is not new copy; it removes a duplicate line.
- **Must not change:**
  - D-108: no "applied" or "application" on screen or in the address (`?sent`);
  - no contact details are passed on;
  - the form's `roleId` and `message` names.
- **Done when:**
  1. One glowing primary in each state that has a primary.
  2. The closed line appears once.
  3. The club name is still a ≥44px link.
  4. The dead-job 404 checks (render 2130–2149) pass.

## New shared parts (class, exact CSS, where used)

Everything below goes in globals.css under a new `THE COACH CARD (E, 1 Oct)` block, directly after `THE PLAYER CARD`, as `@media` (the mockup writes the same rules as container queries).

```css
/* The coach card: the player card's sibling. Used on /c/[slug]; .cv-pill and
   .cv-tiles are lifted from PlayerCV's inline styles so the player CV can adopt them. */
.cv-banner { position: relative; height: 150px; margin: -28px -18px 0; overflow: hidden; }
@media (min-width: 640px)  { .cv-banner { height: 170px; margin: -30px -28px 0; } }
@media (min-width: 1024px) { .cv-banner { height: 160px; margin: -30px -26px 0; } }
.cv-banner img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cv-banner::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(10,21,16,0) 42%, rgba(10,21,16,.78) 100%); }
.cv-top { position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; }
.cv-banner + .cv-top { margin-top: -46px; align-items: flex-end; }
.cv-banner + .cv-top .cv-avatar { border: 3px solid #0e1b14; box-shadow: 0 0 0 1px rgba(238,245,240,.18), 0 10px 26px rgba(0,0,0,.5); }
.cv-kind { display: inline-flex; align-items: center; height: 24px; padding: 0 11px; border-radius: var(--r-pill); border: 1px solid rgba(255,255,255,.22); background: rgba(6,19,12,.5); font-size: 10px; font-weight: 800; letter-spacing: var(--ls-label); text-transform: uppercase; color: rgba(255,255,255,.72); }
.cv-line { position: relative; margin-top: 10px; font-size: 14px; font-weight: 700; color: rgba(255,255,255,.84); }
.cv-where { position: relative; display: flex; align-items: center; gap: 9px; margin-top: 6px; font-size: 12.5px; font-weight: 500; color: rgba(255,255,255,.62); }
.cv-where img { width: 28px; height: 28px; object-fit: contain; flex-shrink: 0; }
.cv-pill { position: relative; display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 11px; border-radius: var(--r-pill); background: rgba(0,0,0,.3); font-size: 10.5px; font-weight: 800; letter-spacing: var(--ls-label); text-transform: uppercase; color: rgba(255,255,255,.78); }
.cv-foot { position: relative; display: flex; margin-top: 16px; }
.cv-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.cv-tiles > :first-child { margin-left: -12px; }
.cv-tiles > * + * { border-left: 1px solid rgba(255,255,255,.12); }
.cv-tile-l { font-size: 10.5px; font-weight: 800; letter-spacing: var(--ls-label); color: rgba(255,255,255,.72); text-transform: uppercase; margin-top: 6px; }
.cv-tl-h { position: relative; margin: 2px 0 12px; font-size: 11px; font-weight: 800; letter-spacing: var(--ls-caps); text-transform: uppercase; color: var(--muted); }
.cv-stop-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
/* "Not yet": the dashed ring, the empty tile's language at dot size (was an amber dot). */
.soon { display: flex; align-items: center; gap: 9px; font-size: 12px; font-weight: 500; line-height: 1.5; color: var(--muted); }
.notyet-dot { width: 14px; height: 14px; border-radius: var(--r-pill); border: 1.5px dashed rgba(255,255,255,.3); flex-shrink: 0; }
.share { display: flex; flex-direction: column; gap: 8px; }
@media (min-width: 640px) { .share { display: grid; grid-template-columns: 1fr 1fr; } }
.report-link { display: flex; align-items: center; justify-content: center; min-height: 44px; font-size: 11.5px; font-weight: 700; color: var(--muted); text-decoration: none; }
.win { display: flex; align-items: center; gap: 14px; padding: 16px; }
.win-ic { width: 44px; height: 44px; border-radius: var(--r-well); background: var(--surface-2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
/* The role row on /jobs: the trial row's padding on A's list row. */
.jr { padding: 16px 16px 14px; align-items: flex-start; }
@media (min-width: 768px) { .jr { padding: 18px 20px; } }
/* E2 only */
@media (min-width: 1024px) { .jobs-wide .jb-head { flex-direction: row; align-items: flex-end; justify-content: space-between; gap: 28px; } .jobs-wide .jobs { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; } }
/* A 44px text button ("Remove"): the way to take one thing out of a list. */
.textbtn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; min-width: 44px; padding: 0 6px; font-size: 12px; font-weight: 700; color: var(--muted); background: none; border: 0; cursor: pointer; font-family: inherit; flex-shrink: 0; }
```

- `.report-link` is the same thing `PlayerCV` and `fc/[slug]` write inline for "Report this page". They may adopt it; that's not in this spec.
- `.textbtn` is the "Remove" pattern. It is also used in the approved trials/join mockups. For the Head of Product Design to reconcile with A's `.btn-ghost` flag.

## New copy for BUZ (current line → proposed line, why)

| # | Where | Current line | Proposed | Why |
|---|---|---|---|---|
| EC1 | `/jobs`, the well under the list | "This sends the club your coaching CV and whatever you write. It does not send them your phone number or your email — if you want to be reached that way, say so in your message." | **Remove it from the list.** | Nothing on the list page sends anything, so "This sends" points at a button that isn't there. The role page already says the same thing under the form that does send ("They get your coaching CV and this message…"). Say it once. If BUZ says no, it stays as drawn. |
| EC2 | `/c/[slug]` | "Players developed and improvement delivered arrive here in December." | **No change proposed. Reconfirm that it is still true.** | It is a dated promise on a public, indexed page (D-53, honest promises). The mockup draws it with the dashed "not yet" ring instead of the amber dot. |
| EC3 | `/c/[slug]` WWCC chip | "WWCC" | **"WWCC verified"** | The print says "WWCC verified". Pillar zero 8 names "WWCC verified" as the one state allowed on a public page. A parent reading the chip alone ("WWCC") can't tell whether it is a check held or a check confirmed. One fact, one phrase. If no, the print stays "WWCC verified" and the page "WWCC". |
| EC4 | `/coach/edit`, WWCC panel, coach with **no club** | "We asked your club to confirm you hold a current check." | **Omit this sentence when the coach holds no club membership.** The rest of the panel stays. | With no membership, nobody was asked, so the line is untrue for a coach who hasn't joined a club (Marnie in the seed). No new words. It is a condition on an existing line. |

## Product decisions for BUZ (not look; behaviour, numbers, doors)

| # | Decision | What it buys | What it costs | Recommendation |
|---|---|---|---|---|
| **E1** | **The coach page joins the player CV's D-173 extension:** `.fl-wide` from 1024 with the card sticky on the left, and the coach's name scaling like the player's (`.cv-name` clamp). D-173 names the front door, landings, club page and player CV only, so this is one more page off 640 and one more use of the type exception. | The coach's link (D-100, never-cut, Sep–Dec is hiring season) looks like the other two public profiles on the laptop where a TD or committee reads it. One component family, not two. | About half a day more than the 640 version. The layout check needs a pass at 1024–1031 and under 700px of height. | **Yes** |
| **E2** | **/jobs takes `.fl-wide` from 1024, with the rows two-up.** It follows the trials board (P1). | A committee member or coach on a laptop sees the roles side by side, not a 640 strip between two 1200 pages. | 2 hours. Only worth it if P1 is yes; the two boards should match. | **Yes if P1 is yes**, otherwise no |
| **E3** | **Fix the editor's order:** move Banner up under Your photo, and move the add-role form under Where you've coached. Today the JSX nests Banner, Licences and Accomplishments inside the roles block, so on a phone the add-role form lands four sections below its list. Nothing added or removed. | A coach adds a role where the roles are. The two image uploads sit together. | 30 minutes. It changes the 390 order, which is BUZ's. write-tests find the role form by its `org` field, so they still pass. | **Yes** |
| **E4** | **The public links** ("Find your club · Trials · Sign in") **on the signed-out `/c/[slug]` and `/jobs`**, and the coach page's logo becomes a link home, as on the club page (P2 for `/trials`). | The coach page and the board stop being dead ends for a parent or club person who arrives from a pasted link. | New doors. The render suite gets link checks. No new words (approved nav words). | **Yes for /jobs; yes for /c** |

Not proposed, and why:
- **The coach page wearing a club's colours.** It would need the same John clearance as `CV_WEARS_CLUB_COLOURS`, and a coach can hold two clubs.
- **A "similar coaches" or recommended-roles row.** D-74 forbids it.

## Build order and dependencies

1. **A's base pass first.** With `.card` becoming the Floodlit panel, `/coach/register`, `/jobs` and `/jobs/[roleId]` get about 70% of their look for free. Their remaining work is the pill, the text button, the empty tile and the `.jr` padding.
2. **`/c/[slug]`**: the new block, then the page (E1 decides the width). It is the highest-value page in the group: the coach's public link.
3. **`/coach/edit`**: fields, buttons and the text button (E3 if approved).
4. **`/jobs` and `/jobs/[roleId]`** (E2 with P1; EC1 if approved).
5. **`/coach/register`**.
6. **`/c/…/print`**, after C's print tokens and `PrintButton` land (C owns both; this page only adopts them).

## Risks and suites likely to move

- **render-tests:**
  - r24–r26 (order: licences newest first; "Years coaching" before "Coaching philosophy"): keep the DOM order;
  - crest-r1/r2 slice the HTML before the first "Coaching now": the crest and "Riverside FC · Melbourne VIC" must stay in the card, before the story;
  - s9 (no `console-nav` on /jobs for a non-coach);
  - s12a–g (coach register filters and 307);
  - the analytics pass on /jobs;
  - 1317 (the coach print is among pages checked for a title);
  - 1377/2433/2451 (the minor's editor: no Premium, no contact).
- **write-tests:**
  - 1588–1606 find the publish and take-down forms by `f.submit === 'Publish my page'` / `'Take my page down'`, the submit button's **inner HTML**. Put no icon in those two buttons;
  - 324–341 find the add-role form by the `org` field (safe under E3);
  - the photo and banner posts.
- **permission-tests:**
  - L46 (the word "token" must not appear in the coach page source);
  - L44/L45/L54 (no send route);
  - L48–L51 (the contact absent for a minor).
- **layout-check:**
  - `/c/sam-kaya` and `/coach/edit` are start pages. The squeeze rule applies to the two-up licence and accomplishment pairs at 640–767. The name clamp at 1024–1031 needs a look;
  - `.field-label` stays 10px (the layout check's rule).
- **Fonts:** the mockup renders 800 from the 900 file. The app loads the real 800.
