# C — The player's screens: build spec

**Seat:** design-proposal, for the Head of Product Design, then Leo's build team. **Date:** 1 Oct 2026. **Branch:** design/player-cv (nothing committed).
**Mockup:** `docs/design/mockups/floodlit-player.html` — 32 states, every one at 390 and 1280 from the same markup (one string per artboard, placed in both frames).
**Shell parts** are spec A's, by their bold names (`specs/A-shells-and-homes.md` § Shell parts). This spec designs only what sits inside them.

## Summary (5 lines max: what changes, what it fixes, size)

- **One idea: everything a player makes is the player card.** The builder's first step draws the five card fields (photo, name, positions, number, foot) on the card's own gradient; preview shows the real card under one header; "ready" shows the card's ticket; the share card's shapes are card silhouettes; the print CV is the card in ink. Everything a player *asks* (send, register, where you play, /manage) is a **Door panel**, and every list is on the page.
- **What it fixes:** green used for places, facts and states instead of actions (progress bar, trial line, link hint, ticks, four status heroes including "Sending is off"); three hand-built third buttons; two headers on the preview; a share-card picker whose chosen state never moves; a print sheet with three off-scale letter-spacings and a typed "PITCH"; the /manage logo top-left on a phone.
- **Size:** about 4 days after A's base pass (12 pages: 1 M, 11 S), plus half a day if BUZ approves P1. No query, route, field or permission changes, except the ones in "Product decisions".

## Pages

### /build/[recordId] (Your football)  ·  player 18+, 16–17, under 16; a parent via `requireRecordActor`  ·  size M (+S for P1)
- **Source:** `app/build/[recordId]/page.tsx`, `BuildForm.tsx`, `actions.ts`, `photo/route.ts`; `components/SquadCard.tsx`; `components/player-shell.tsx` (PlayerFrame).
- **States:** first visit, bare record (0 of 6; no photo, no positions, blank number, the UNSET stat set on); part-built; `?saved=1` (with or without `has_pending` for an under-16); uploading a photo ("Uploading…"); a photo chosen with no JavaScript (Upload photo button shows); `?squad=` answers from SquadCard (only `error` renders); photo refused (`?photo=bad`: **renders nothing today**, see P6). A complete save redirects to /ready.
- **Phone (390), top to bottom (order unchanged):**
  1. Frame with Seat bar (Home · My CV · Trials · More; My CV current).
  2. Page header: "Back" left, mark right.
  3. Page title "Build your CV" + line, with the Preview link (`.chip` + eye glyph, 44px) on the right.
  4. Progress: Panel heading "Your page" + "N of 6 done"; the 6px bar fill is **`--secondary`**, not accent.
  5. Step links as `.chip`s; the current one is `aria-current="page"` drawn as A's "you are here" (`background: var(--here)`, ink, no border), not an accent fill.
  6. `?saved=1`: Notice `.card.card-accent` "Saved."; when `has_pending`, the same Notice with **`.card-purple`** (the change is now the parent's).
  7. **The card** (`.cv-edit`, new): the squad number as the decorative `.cv-num` behind (only when a number is typed; `aria-hidden`); the photo form (avatar tile 92px, dashed when empty, + title and line; the `.filefield` below it; the no-JS Upload button unchanged); "Full name" + the name at 22/900; Positions (label, "Up to 3 · tap to order", `.pos-grid`, the live full-name line); Number | Preferred foot as two `.field` wells, 92px + 1fr.
  8. Section heading "About" + textarea in a `.field` well.
  9. Section heading "Season stats · self-reported" with "Tap a name to show or hide it" (`--secondary`, not accent) + the four stat tiles.
  10. "Save & preview": `.btn-primary.fl-glow` (was a hand-built button: radius 15, weight 900).
  11. Section heading "Where you play" + SquadCard (see its own entry).
- **Laptop (1280):** Frame with the Rail (rail mark top left, seat card, My CV current). **As the rules stand:** the same column at 640 beside the rail. **With P1:** the column widens to `max-width: 1000px` and `.build-grid` lays out two columns: the card (400px, `position: sticky; top: 18px`) on the left, items 8–11 on the right, exactly where the CV puts its card and its story. Header, progress, steps and the saved Notice stay full width above. DOM order is the phone order.
- **Parts:** Frame, Seat bar, Rail, Page header, Page title, Panel heading, Section heading, Notice, Field, Buttons (one glow), `.chip`. New: `--cv-hero-bg`, `.cv-edit`, `.pos-grid`/`.pos`, `.build-grid`, `.stats4` (page-local, below).
  ```css
  .build-top { display: flex; flex-direction: column; gap: 12px; }
  .prog-bar { height: 6px; border-radius: var(--r-pill); background: var(--surface-2); overflow: hidden; }
  .prog-bar > i { display: block; height: 6px; border-radius: var(--r-pill); background: var(--secondary); transition: width .3s var(--ease); }
  .build-grid { display: flex; flex-direction: column; gap: 18px; }
  .build-story { display: flex; flex-direction: column; gap: 18px; }
  @media (min-width: 1024px) {            /* P1 only */
    .build-col { max-width: 1000px; }
    .build-grid { display: grid; grid-template-columns: 400px minmax(0, 1fr); gap: 28px; align-items: start; }
    .build-cardcol { position: sticky; top: 18px; }
  }
  .stats4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .stat-in { background: var(--fl-surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow-card); padding: 0 6px; display: flex; flex-direction: column; align-items: center; }
  .stat-in input { background: transparent; border: 0; color: var(--ink); text-align: center; font-size: 19px; font-weight: 900; min-height: 44px; width: 100%; }
  .stat-in button { min-height: 44px; width: 100%; background: none; border: 0; font-size: 9px; font-weight: 700; letter-spacing: var(--ls-label); text-transform: uppercase; color: var(--accent); }
  .stat-in.off { opacity: .45; } .stat-in.off button { color: var(--muted); }
  ```
  **Form structure for the card:** the photo form stays its own `<form>` (it posts to `/build/[id]/photo`). The main form becomes `<form id="cv" class="build-story">` holding the hidden inputs, About, stats and Save; the Number input and the foot select sit inside the card and carry **`form="cv"`**. No JavaScript is needed and the posted fields are identical. The position buttons gain `aria-pressed` (their `aria-label` stays).
- **Copy:** all verbatim: "Build your CV", "Two minutes. Edit anything later.", "Preview", "Your page", "{n} of 6 done", "Your football", "Highlights", "Achievements", "Saved.", "Your parent will see this change before it goes out.", "Add profile photo", "Optional, but every good CV has one.", "Choose a photo" / "Choose a new photo" / "Uploading…", "JPG or PNG.", "Upload photo", "Full name", "Positions", "Up to 3 · tap to order", "Not sure what a code means? Tap it and the full name shows here.", "Number", "Preferred foot", "About", the About placeholder, "Season stats · self-reported", "Tap a name to show or hide it", the four stat labels, "Save & preview". New lines → N1, N2.
- **Must not change:** D-70/D-162: blank stats open as the "—" placeholder, never a 0, and a typed 0 is still removed by the action. D-105: the set follows the positions being picked until the player chooses. D-119: an under-16's save goes to pending. The photo route stays content-checked and re-encoded (D-94 §7). The card never wears club colours in the builder (the CV only may, behind `CV_WEARS_CLUB_COLOURS`).
- **Done when:**
  1. At 390 the reading order is photo, name, positions, number/foot, About, stats, Save, Where you play, and a save posts the same fields as today with JavaScript off.
  2. The card uses `var(--cv-hero-bg)` and no literal gradient; the decorative number is `aria-hidden` and absent when the number is blank.
  3. No accent on the progress fill, the current step or the stats hint; the only glow is on "Save & preview".
  4. pv-r2 still passes (Nate opens with Appearances and Clean sheets pressed).
  5. With P1: at 1024–1280 the card column is sticky and nothing overflows at 1024 (the rail leaves 792px).

### /build/[recordId]/clips (Highlights)  ·  player; a parent  ·  size S
- **Source:** `app/build/[recordId]/clips/page.tsx`, `actions.ts`; `components/PremiumRows.tsx`.
- **States:** empty (0 of cap); some; full (no empty slot); `?error=1`; `?full=1`; 18+ with the two Premium rows; 18+ after a tap (`?first=1`); under 18 (no Premium, cap 10).
- **Phone:** Page header "Back to the CV" → Page title "Highlights" + line → amber Notices for `error`/`full` → **Door panel** form: Field "Video link" (gets `aria-invalid="true"` on `?error=1`), Field "Title", "Add highlight" `.btn-primary.fl-glow` → Section heading "Your clips · N of cap used" → clip Panels (poster 88px with a **neutral** play glyph and the source word; title; "YouTube · added {date}"; "Remove" 44px text button) → Empty tile panel "Add another clip / Three clips, free" (or "Ten clips, free") while slots remain → "Swap a clip out any time." → 18+ only: the two Premium rows.
- **Laptop:** the same column at 640 beside the rail; the Door lifts onto its panel from 640.
- **Parts:** Door panel, Field, Notice, Section heading, Panel, Empty tile, Pill. Premium rows become Panels with a neutral `.pill` "Premium" and "Coming soon" in `--muted` 10px/800 caps (both were accent). The poster's play glyph is `rgba(255,255,255,.72)`: nothing plays on this screen, so it must not look like the CV's green play button.
- **Copy:** verbatim; "＋ Add another clip" loses its "＋" character (a stroke plus sits in the Empty tile) → listed as N3 (character removal, same words).
- **Must not change:** D-88/D-120 caps (10 under 18, 3 adult free), grandfathering; D-82: nothing Premium for any under-18 or for a parent viewing a child (prem-r5); at most two quiet rows; D-163 no price; D-97: this screen embeds nothing.
- **Done when:** (1) no "＋" glyph character remains; (2) prem-r5 passes; (3) the form is a Door and the list is not inside it; (4) every Remove is ≥44×44.

### /build/[recordId]/more (Your football history)  ·  player; a parent  ·  size S
- **Source:** `app/build/[recordId]/more/page.tsx`, `actions.ts`.
- **States:** each of the three lists empty or filled; kinds offered by band (no School under 18, D-161); legacy school rows still listed with Remove.
- **Phone:** Page header "Back to the CV" → Page title + line → three sections, each: Section heading; a Panel list (`.card.rows`) of rows (Other football rows lead with a neutral `.pill` for the kind) with "Remove"; the add form as a Panel with `.field` wells and a **`.btn-secondary`** with a stroke plus ("Add a club", "Add achievement", "Add other football"). The D-72 sentence stays under the clubs form as `.help`.
- **Laptop:** same column at 640.
- **Parts:** Section heading, Panel list, Pill, Field, `.chip.pick` (unchanged radios), Buttons. No primary on this page, so no glow.
- **Copy:** verbatim; the three "＋" characters go (N3).
- **Must not change:** D-72 (free text, grants nothing, and the sentence that says so stays visible); D-161 kinds from the database band; nothing here deletes a row except Remove.
- **Done when:** (1) A19 passes (no `name="kind" value="school"` for Deniz, present for Jordan; Marlowe High still listed); (2) the add buttons are the 46px secondary; (3) the kind tag is a Pill (999px), not a 7px tag.

### /build/[recordId]/preview  ·  the player; a parent  ·  size S
- **Source:** `app/build/[recordId]/preview/page.tsx`; `components/cv/PlayerCV.tsx` (one new optional prop).
- **States:** self, live record (16+); self under 16 with a pending change (waiting line, player wording); a parent with a pending change (waiting line + "Review the changes"); no approved snapshot for an under-16 → `notFound()` (unchanged; flagged in Risks).
- **Phone:** the CV's own nav bar (logo right) → **`.pv-strip`**: "Back to editing" / "Back to {first}" (`.pg-back`), then a compact Notice with Panel heading-style kicker "Preview" (`.notice-k.k-accent`), the sentence, the waiting line and, for a parent, "Review the changes" on its own 44px row. Edge: `.card-accent`; **`.card-purple` when waiting**. → the CV, untouched.
- **Laptop:** the strip sits in `.fl-wide` so it aligns with the card grid; from 1024 the back link and the Notice share one row (`.pv-strip` row).
- **Parts:** PlayerCV gains `above?: React.ReactNode`, rendered **after** `<SiteNav>` and before `.cv-root`. `/p/[token]` never passes it. New `.pv-strip` (below).
  ```css
  .pv-strip { display: flex; flex-direction: column; gap: 10px; padding-top: 14px; }
  @media (min-width: 1024px) { .pv-strip { flex-direction: row; align-items: flex-start; gap: 18px; padding-top: 18px; } .pv-strip > .card { flex: 1; } }
  ```
- **Copy:** verbatim ("Back to editing", "Back to {first}", "Preview", both "This is exactly what a club sees…" lines, both waiting lines, "Review the changes").
- **Must not change:** D-80/D-119: under 16 reads `fn_approved_cv`, 16+ the live assembly; `requireRecordActor`; noindex; no social card. Copy-check N2 stands: when club colours switch on, this page must pass the same `clubColours`/`clubState` as `/p/[token]`, or its first sentence becomes untrue.
- **Done when:** (1) the page has one nav bar; (2) pv3–pv8 pass; (3) the token page's HTML is byte-identical with and without this change.

### /build/[recordId]/ready  ·  the player  ·  size S
- **Source:** `app/build/[recordId]/ready/page.tsx`.
- **States:** ready (no live token); live (hint shown); waiting (under 16 with a pending change).
- **Phone:** Frame → Page header (mark only) → **Door panel**: the **ticket** (`.ticket`: `--cv-hero-bg`, radius `--r-card`, `--shadow-float`, the squad number as `.cv-num`, the approved one-line summary in a dark pill, a 30px badge top right: accent tick, or amber clock when waiting) → h1 (30/900) + line → live only: Panel "Your link" with the hint in **ink monospace** (it is not a link) + line → buttons: "Send it to a club" `.btn-primary.fl-glow` (absent when waiting), "Preview my page" and "Find a trial" `.btn-secondary`, "Keep building" 44px text button.
- **Laptop:** the Door at 640 beside the rail.
- **Parts:** Door panel, Panel, Buttons; new `.ticket` uses `--cv-hero-bg`.
  ```css
  .ticket { position: relative; overflow: hidden; width: 100%; min-height: 110px; padding: 22px 18px; display: flex; align-items: center; justify-content: center; border-radius: var(--r-card); background: var(--cv-hero-bg); border: 1px solid rgba(255,255,255,.08); box-shadow: var(--shadow-float); }
  .ticket .cv-num { font-size: 190px; top: -18px; right: -8px; }
  .ticket-line { position: relative; display: inline-flex; align-items: center; background: rgba(0,0,0,.3); border: 1px solid rgba(255,255,255,.12); border-radius: var(--r-pill); padding: 9px 15px; font-size: 13px; font-weight: 800; }
  .ticket .badge { position: absolute; right: 12px; top: 12px; width: 30px; height: 30px; border-radius: var(--r-pill); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 3px rgba(11,18,14,.6); }
  ```
- **Copy:** verbatim ("Your page is ready" / "Your page is live" / "Sent to your parent", both lines, "Your link", the hint, "Switch your link off any time…", the four buttons).
- **Must not change:** says "ready" until a token exists, and only ever shows the hint (D-80); nothing celebrated for a pending under-16 change (D-119).
- **Done when:** (1) the hint is not accent-coloured and not a link; (2) one glow, none when waiting; (3) the badge and the ring are `aria-hidden`.

### /send/[recordId] (Send my CV)  ·  player 18+ and 16–17 ('self'), under 16 ('ask'); a parent reaches 'ask' from a club page  ·  size M
- **Source:** `app/send/[recordId]/page.tsx`, `actions.ts`; `lib/send-state.ts`; `components/cv/CopyLink.tsx`.
- **States:** compose self (18+; 16–17 with "Your parent is told each time you send."); compose ask (under 16); prefilled from a club (`?club=`: role address checked within 90 days → the "publishes on its own website" line; a person's address → name only); `?error=1`; `?sent=1`; `?asked=1`; off (the parent switched sending off); blocked (`?blocked=1` or the club asked Pitch to stop); Your links: empty / live / switched off / held ("This one didn't go."); `?off=1` (one link switched off); `?link=` (fresh link, shown once). `mode === 'none'` (paused, unapproved, **a 16–17 with no confirmed parent**, a parent of a 16–17) redirects to /home, where the 16–17 sees the approved "Waiting on your parent" Notice.
- **Phone:** Frame (Send is under More on the phone, current in the rail) → Page header "Back" → **Door panel**: Page title "Send my CV" + line; amber Notice on `?error=1` (both wells get `aria-invalid="true"`); Panel heading "Sending to" over two Fields, **"Club"** and **"Their email address"** (the label moves inside the well; the section label above it goes, because "Sending to" now heads both), then the `.help` line; a Well (`.card-sunken.checks`) "What the club gets" with the three rows; the who-sends row (Panel + `.row-ic`: neutral send glyph for self, **purple** people glyph for ask); "Send it now" / "Ask my parent to send it" `.btn-primary.fl-glow`; "Cancel" 44px text link. → below the Door (self only): Section heading "Your links"; the fresh-link Notice (`.card-accent`, ink monospace URL, "Copy the link" as `.btn-secondary`, the once-only line); `?off=1` Notice; a Panel list of sends (club, date · address, held line; `.console-btn` "Switch off" or muted "Switched off"); empty → Empty tile panel "You haven't sent your CV to a club yet."; the "Make a fresh link" Panel.
- **Outcomes** (asked, sent, off, not sent): Page header + one **Notice**, lifted (`.fl-float`): `.notice-k` then `.notice-h` then `.notice-b`, in that order with nothing between. Dot: amber for asked (with `.card-amber`), accent for sent, muted for off and not sent. They were four `--hero` gradients: green behind "Sending is off".
- **Laptop:** Door and list in the one 640 column beside the rail.
- **Parts:** Frame, Page header, Page title, Door panel, Field, Panel heading, Well, Notice, Section heading, Panel list, Empty tile, `.console-btn`. New: `.checks`, `.notice-h`. CopyLink moves onto `.btn .btn-secondary` (same values).
- **Copy:** verbatim throughout. N4 (the repeated "Make a fresh link").
- **Must not change:** D-99 never automated, batched or attached; D-91 the under-16 composes and the parent sends; 16–17 parent told every time; L38: a rate-limited send lands on exactly the "Sent." page, and "Your links" shows it as one that didn't go, **never a number**; 0160: a prefilled address is shown **in full**; a stopped club gets "Not sent" with no form, no reason and nothing about the club; **D-172: nothing on this screen draws an unclaimed club** (no crest, tile, initials or colour: its name in the field only); U-5: an under-16 never sees Your links.
- **Done when:** (1) sc-r1–sc-r7 pass (input names `clubName`/`address` and their values unchanged; "Not sent We can't send to this club through Pitch Nothing has been sent." still reads as one string); (2) no `--hero` on this page; (3) the ticks are `--secondary`, the crosses `--muted`, and nothing on the page is red; (4) one glow; (5) with a parent session on an under-16's record the page is unchanged until P4 is decided.

### /share-card/[recordId]  ·  under 18 with a confirmed parent (linked from /home only)  ·  size S
- **Source:** `app/share-card/[recordId]/page.tsx`, `actions.ts`.
- **States:** compose; `?asked=1`. Reachable by URL for an 18+ (see P9).
- **Phone:** Top bar (logo only, `.has-topbar`) → Page header "Back" → **Door panel**: Page title "Share my CV" + line; Panel heading "Pick a shape" + three `.shape` radio tiles (each a card silhouette drawn in CSS, plus its name); a Well `.checks` "What's on it" (four rows; ✓ `--secondary`, ✗ `--muted`, no red); the who row, purple, "Your parent sees it first"; "Ask my parent to approve it" `.btn-primary.fl-glow`; "Cancel" (P5). **Asked:** Page header + amber Notice: kicker "Waiting on your parent" (approved words from /send, new place), title and body verbatim.
- **Laptop:** Top bar logo left; the Door centred at 640.
- **Parts:** Top bar, Page header, Door panel, Well, `.checks`, Notice, `.notice-h`. Page-local `.shape`/`.sil`:
  ```css
  .shapes { display: flex; gap: 8px; }
  .shape { flex: 1; position: relative; cursor: pointer; }
  .shape > input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
  .shape-in { min-height: 44px; display: flex; flex-direction: column; align-items: center; gap: 9px; padding: 12px 8px; border-radius: var(--r-card); background: var(--fl-surface); border: 1px solid var(--line); box-shadow: var(--shadow-card); }
  .shape:has(> input:checked) .shape-in { border: 1.5px solid var(--accent); padding: 11.5px 7.5px; }
  .shape:has(> input:focus-visible) .shape-in { outline: 2px solid var(--accent); outline-offset: 2px; }
  .shape-n { font-size: 12px; font-weight: 700; color: var(--secondary); }
  .shape:has(> input:checked) .shape-n { font-weight: 900; color: var(--ink); }
  .sil { position: relative; overflow: hidden; border-radius: 6px; background: var(--cv-hero-bg); border: 1px solid rgba(255,255,255,.12); }   /* 34x60 · 52x52 · 64x34, as today */
  ```
  The silhouette's inner bars are decorative `<i aria-hidden>` blocks (photo, name bar, two chip shapes, stats rule): **no text, no record data**.
- **Copy:** verbatim. "Waiting on your parent" reused (listed under New copy as approved-words-new-place).
- **Must not change:** D-101: nothing is generated or given a URL here, the email carries no preview; D-89: no club colours, no surname, club, age group or region; the shape is still a real radio posting `shape`.
- **Done when:** (1) the chosen tile follows the checked radio with no JavaScript; (2) the silhouettes contain no text node; (3) no `--hero` and no red.

### /register-interest/[recordId]  ·  player 18+, 16–17 ('self'), under 16 ('ask'); a parent from the club page  ·  size S
- **Source:** `app/register-interest/[recordId]/page.tsx`, `InterestForm.tsx`, `actions.ts`.
- **States:** self 18+; self 16–17 ("Your parent can see which clubs you are on."); ask; with a trial (`?trial=`); a squad preselected (`?squad=`); a club with no squads (P8); `?registered=1`; `?asked=1`; off; `?error=1` (renders nothing: only reachable by a crafted post, leave it).
- **Phone:** Top bar → Page header "Back" → **Door panel**: Page title + line; field label "Interested in" + club Panel (initials tile, name, suburb; the trial as **`--secondary`** text with a calendar glyph, was accent); Field "Which squad" (select); "Where you'd play": `.pos-grid` (on = tint, no order numbers) + full-name line + help; "One line, if you want" + counter + textarea Field + help; Well `.checks` (two ✓, hairline, two ✗); who row (neutral tick for self, purple for ask); the sunken "Being on a register…" Well; primary with glow; "Cancel" (P5). **Outcomes:** the Send outcome Notice: "On the register" (accent), "Waiting on your parent" (amber), "Sending is off" (muted).
- **Laptop:** Top bar logo left; the Door centred at 640.
- **Parts:** Top bar, Page header, Door panel, Field, Panel, Well, Notice, `.checks`, `.pos-grid`, `.notice-h`.
- **Copy:** verbatim.
- **Must not change:** D-108 vocabulary (nothing to be turned down from); only claimed/verified clubs; the squad and trial are conveniences, never grants; the D-96 age-contradiction hold stays silent on screen; the gate is `lib/send-state`, the same as Send.
- **Done when:** (1) no accent text that isn't an action; (2) the positions post the same comma list; (3) the outcomes use the same Notice as Send.

### /squad/[personId] (Where do you play?)  ·  a player from 16; a parent for any child  ·  size S
- **Source:** `app/squad/[personId]/page.tsx`, `app/squad/actions.ts`.
- **States:** the club list; search results; no match; a club picked with teams; a club with no teams; `?error=1`; the parent's wording ("Where does {first} play?", back to controls).
- **Phone:** Top bar → Page header "Back" → Page title + line → amber Notice on error → search: field label "Find your club" + **the light search field** (`.fl-search`, the one on `/` and `/claim`) with "Search" as `.btn-secondary` at the field's 58px → Section heading "Clubs on Pitch" / "Clubs that match" + one Panel list of `<a>` rows (name, suburb and state, chevron); no match → Empty tile panel. Picked: Section heading "{club} — which team?" + Panel list of submit-button rows ending in the accent word "Ask them"; no teams → Empty tile panel; "A different club" 44px text button. The closing Well stays last.
- **Laptop:** Top bar; the column centred at 640.
- **Parts:** Top bar, Page header, Page title, Notice, `.fl-search`, Section heading, Panel list, List row, Empty tile, Well.
- **Copy:** verbatim.
- **Must not change:** clubs are organisations, never people; only verified clubs list (D-126); a child is never searchable; `back` is compared to one literal and never echoed; the ask tells the club only the name and the team.
- **Done when:** (1) clubs1/clubs2 pass: each club row is still `<a href="/squad/…?club=…">` with the name as its first text; (2) the search posts `q` with no JavaScript; (3) every row is ≥44px.

### SquadCard (inside /build and /g/controls)  ·  player; parent  ·  size S
- **Source:** `components/SquadCard.tsx`.
- **States:** nothing yet (row link "Add your club"); waiting on the club (Cancel); in a squad (Leave); invited (Yes / Not this one); `said=error`.
- **Phone/Laptop:** Section heading "Where you play" / "Where {first} plays" (was `sectionLabel` above panels) → List rows as `class="card row"`: waiting and in-squad end with **`.console-btn`** "Cancel" / "Leave" (were hand-built 44px, radius 11); the invitation is a Notice `.card-accent` with "Yes, … there" `.btn-primary` (**no glow**: the page's glow is its own primary) and "Not this one" **`.btn-secondary`** (was a hand-built ghost); error is an amber Notice.
- **Copy:** verbatim.
- **Must not change:** a club reaches a CV only from a confirmed membership; declining looks to the club like silence (D-138); the answer forms post the same fields.
- **Done when:** no hand-built button remains; the invitation's two buttons wrap onto two lines at 320px without squeezing.

### /manage  ·  a waitlist address holder, no account (token only)  ·  size S
- **Source:** `app/manage/page.tsx`, `actions.ts`; `components/quiet-shell.tsx` (A part 21).
- **States:** no or bad token ("That link didn't work."); the form; `?saved=1`; `?e=invalid|taken|error`; unsubscribed (extra sentence).
- **Phone:** A's **Quiet shell** with `door`: Top bar (logo right) → Door panel at 460: Page title "Your waitlist details." + line → Notice accent "Saved." / amber refusal (was a red literal) → Field "Email" (`aria-invalid` on a refusal), Field "I'm here as" (select) → "Save" `.btn-primary.fl-glow` (was 54px) → the unsubscribe line.
- **Laptop:** Top bar logo left; the Door centred at 460.
- **Parts:** Quiet shell, Door panel, Page title, Notice, Field, Buttons.
- **Copy:** verbatim. The title moves from 28px/−0.02em to Page title (26px/−0.015em); the line's 600 becomes 700.
- **Must not change:** the token is the only credential (doc 29 §5); noindex; robots disallow.
- **Done when:** no literal colour, no 600 weight, no −0.02em; the logo is top right at 390.

### /p/[token]/print  ·  anyone holding a live link (a TD on trial day)  ·  size S
- **Source:** `app/p/[token]/print/page.tsx`, `PrintButton.tsx`.
- **States:** live CV (shared provenance line, or per-tile provenance when the tiles differ); no stats; no About/achievements/other football (sections omitted); dead token → `LinkState` (unchanged, D-77).
- **Phone and laptop (one sheet, max 760px, on `--print-paper`):** "Save as PDF" as `.btn-primary.btn-auto`, right (`.no-print`) → head: name 34/900/−0.015em, the positions · number · foot line, the club — squad line, the **Wordmark** right (in ink) → stats band: `.numeral-m` numbers (34px, −0.04em), labels 10.5/800/0.06em caps, the provenance line right → sections with the CV's own heading (label + hairline, 11px/800/0.14em): About, Achievements, Other football → footer line. **With P3:** the D-84 context line under the club line, and Football history (current club "now" + previous clubs) between Achievements and Other football.
- **Parts:** new print tokens and `.sheet-*` (below); Wordmark.
- **Copy:** verbatim ("Save as PDF", section names, the footer line).
- **Must not change:** D-121 free, never locked; the same single tokenised read path (D-80); a dead token renders LinkState at 200, never 404 (D-77); no school on an under-18's sheet (D-161); D-67 no negative numbers; a stat renders only when positive.
- **Done when:** (1) every letter-spacing on the sheet is one of the five; (2) no literal colour outside the `--print-*` tokens; (3) A19 print checks pass for Deniz, Nate and Jordan; (4) the sheet prints on one A4 page for Nate.

## New shared parts (class, exact CSS, where used)

All go in `app/globals.css` in a block `PLAYER SCREENS (C, 1 Oct)` after A's `SHELLS` block. None needs a `lib/palette.ts` twin (CSS-only, like `--surface-hover` and A's three).

```css
:root {
  /* The card's own gradient. Today a literal in PlayerCV.tsx (heroBg's default branch); PlayerCV reads this token instead. */
  --cv-hero-bg: radial-gradient(120% 70% at 20% -10%, #2a6a49 0%, #1f5a3d 30%, transparent 72%), linear-gradient(180deg, #173a29 0%, #0b120e 100%);
  /* The one light surface (the charter's print sheet). The same literals the print pages use today, named. */
  --print-paper: #ffffff; --print-ink: #0b120e; --print-2: #3f5145; --print-muted: #5b6b60; --print-line: #d7ded9;
}

/* The checklist: what the club gets / what's on the card / what the register shows. A cross is "not given", not danger: no red. */
.checks { display: flex; flex-direction: column; gap: 10px; }
.checks-t { font-size: 13.5px; font-weight: 800; color: var(--ink); }
.check { display: flex; align-items: flex-start; gap: 10px; font-size: 12.5px; font-weight: 500; line-height: 1.5; color: var(--secondary); }
.check > svg { flex-shrink: 0; margin-top: 2px; color: var(--secondary); }
.check.no > svg { color: var(--muted); }
.checks > hr { height: 1px; border: 0; margin: 2px 0; background: var(--line); }

/* An outcome's title inside a Notice (Send, Register interest, Share card; /g/send can use it too). */
.notice-h { font-size: 22px; font-weight: 900; letter-spacing: var(--ls-title); line-height: 1.2; }
.notice-b { font-size: 13.5px; font-weight: 500; color: var(--secondary); line-height: 1.55; }

/* The ten-position picker (build, register interest). */
.pos-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
.pos { width: 100%; min-height: 44px; border-radius: var(--r-pill); display: flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 800; background: transparent; border: 1px solid var(--line); color: var(--muted); cursor: pointer; }
.pos[aria-pressed="true"] { background: rgba(61,220,132,.14); border-color: transparent; color: var(--accent); }
.pos.lead { background: var(--accent); color: var(--on-accent); font-weight: 900; }   /* build only: choice 1 */
.pos > i { font-style: normal; font-size: 9px; font-weight: 900; opacity: .6; margin-right: 3px; }   /* build only: the order number */
.pos-line { font-size: 12.5px; font-weight: 700; color: var(--secondary); line-height: 1.45; }
.pos-line.none { color: var(--placeholder); }

/* The card as an editing surface (build step 1; the parts the CV draws, on the CV's gradient). */
.cv-edit { position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 16px; padding: 20px 16px 18px; border-radius: var(--r-hero); background: var(--cv-hero-bg); border: 1px solid rgba(255,255,255,.08); box-shadow: var(--shadow-float); }
.cv-edit > * { position: relative; }
.cv-edit > .cv-num { position: absolute; font-size: 260px; }
.cv-edit .field { background: rgba(0,0,0,.28); border-color: rgba(255,255,255,.12); }
.cv-edit .field-label { color: rgba(255,255,255,.72); }
.cv-edit .filefield { background: rgba(0,0,0,.22); border-color: rgba(255,255,255,.3); }
.cv-edit .filefield-hint { color: rgba(255,255,255,.62); }
.cv-edit .pos { border-color: rgba(255,255,255,.16); color: rgba(255,255,255,.72); }
.cv-edit .pos[aria-pressed="true"] { background: rgba(61,220,132,.16); }
.cv-edit .pos-line { color: rgba(255,255,255,.84); } .cv-edit .pos-line.none { color: rgba(255,255,255,.62); }
.cv-edit .cv-avatar.dash { border: 1.5px dashed rgba(255,255,255,.3); background: rgba(255,255,255,.04); box-shadow: none; }

/* The print sheet. */
.sheet { max-width: 760px; margin: 0 auto; color: var(--print-ink); }
.sheet-h { display: flex; align-items: center; gap: 12px; margin-bottom: 7px; font-size: 11px; font-weight: 800; letter-spacing: var(--ls-caps); text-transform: uppercase; color: var(--print-muted); }
.sheet-h::after { content: ''; flex: 1; height: 1px; background: var(--print-line); }
.sheet-nl { margin-top: 5px; font-size: 10.5px; font-weight: 800; letter-spacing: var(--ls-label); text-transform: uppercase; color: var(--print-muted); }
```
Also used across groups: `/g/send` and `/g/interest` (guardian group) carry the same checklist rows and should take `.checks`; `/c/[slug]/print` (coach group) should take the print tokens and `.sheet-*`.

**Two notes for the Head, outside my files:** `.cv-hero` (26px at ≥1024) and `.cv-avatar` (26px) in THE PLAYER CARD use a radius the charter doesn't have; the mockup draws both at `--r-hero` (22). `ClipCard` uses radius 18. Worth one line in the CV group's list.

## New copy for BUZ (current line → proposed line, why)

| # | Where | Current | Proposed | Why |
|---|---|---|---|---|
| N1 | /build, photo refused (`?photo=bad`, with P6) | nothing renders | **"That photo didn't upload. Try a JPG or PNG under 8 MB."** | The route redirects there on a bad file, an 8 MB+ file or a storage failure, and the page says nothing. 8 MB is the route's real cap. |
| N2 | /build, photo block when a photo exists | "Add profile photo" (beside the photo) | **"Profile photo"** | The title asks for a photo that is already there. |
| N3 | clips, more | "＋ Add another clip", "＋ Add a club", "＋ Add achievement", "＋ Add other football" | the same words, without the "＋" character | The plus becomes a stroke icon (charter: stroke icons). Same words. |
| N4 | /send, Your links | heading "Make a fresh link" above a button "Make a fresh link" | drop the heading | Say it once: the button carries the words, the line under it the consequence. |
| N5 | /send and /register-interest, a parent composing for their under-16 (with P4) | the child's lines: "Ask my parent to send it", "Your parent sends this one", "You're under 16, so we ask your parent…" | title **"Send {first}'s CV"** (the club page's approved "Send {first}'s CV to {club}", shortened); who row **"You send this one"** + the approved /g/send line "You can pause or replace {first}'s link any time — the club's access stops when you do."; button "Send it now" (approved) | Today the parent reads words addressed to the child and then approves their own request from an email. |

**Approved words in a new place (not new, listed for copy check):** "Waiting on your parent" as the kicker of the share-card "Asked" Notice (from /send).

**Existing lines that are untrue in a state the source can produce:**
1. /share-card for an 18+ (by URL): "Ask my parent to approve it", "Your parent sees it first": an adult has no parent on the record (P9).
2. /send and /register-interest in 'ask' mode read by a parent: the child's wording (P4, N5).
3. /build/ready for a 16–17 whose parent hasn't confirmed: "Send it to a club" leads to /send, which bounces to /home (P7).

## Product decisions for BUZ (not look; behaviour, numbers, doors)

| # | Decision | What it buys | What it costs | Recommend |
|---|---|---|---|---|
| **P1** | **The builder's first step takes two columns from 1024px** (max 1000px beside the rail): the card sticky on the left, About, stats and Save on the right. D-173 (2) names only the front door, landings, club page and CV. | The builder looks like the thing it builds: the card where the CV puts it, and the whole step visible at once. | Half a day; one more page off the 640 rule; the `form="cv"` attribute (see Risks). The 390 is identical either way. | **Yes** |
| **P2** | **The three build steps share the header**: "N of 6 done" and the step links on /clips and /more too (today only on step 1; the other two have "Back to the CV"). | The builder reads as one object with three tabs, not one page and two islands. | New link placements on two pages (existing destinations). | **Yes**, later than the rest |
| **P3** | **The print CV carries what the screen CV carries**: the D-84 context line ("U18 · born Apr–Jun") and Football history. | The printed sheet a TD holds on trial day is the same object as the page; the history is the part a TD asks about. | Content added to a printed page that outlives the link. Both are already on the screen CV to the same reader; neither is on a card (D-89 untouched). | **Yes** |
| **P4** | **A parent who opens Send / Register interest for their under-16 (from the club page's "Send {first}'s CV" / "Register {first}'s interest") sends it themselves**, from that screen. `fn_can_dispatch` already allows the guardian; `send-state` returns 'ask' whoever is viewing. | Removes a loop where a parent asks themselves by email. | A send-state branch (viewer is guardian → 'guardian'), the N5 lines, and a write-test. Also found: for a **16–17** child the same club-page button lands the parent on /home (send-state 'none'); that button should not render for a 16–17 child (club page group). | **Yes** |
| **P5** | **"Cancel" on /share-card and /register-interest goes to /home**, as it does on /send. Today it is a `div` with no destination. | A dead control stops looking live. | A new destination on two pages. (Or remove it: the Page header already has Back.) | **Yes** (link) |
| **P6** | **Show the photo refusal** (N1) on `?photo=bad`. | A family knows the photo didn't take. | A searchParam read and one line. | **Yes** |
| **P7** | **/build/ready hides "Send it to a club" for a 16–17 with no confirmed parent**, as /home does. | No button that bounces. | One condition. | **Yes** |
| **P8** | **"Which squad" on /register-interest when the club has no squads**: today it offers only "—". Hide the field in that state. | No empty control. | A field removed in one state (it posts nothing either way). | **Yes** |
| **P9** | **/share-card redirects an 18+ to /home** (as /send does for 'none'). It is linked only for under-18s with a confirmed parent. | No page telling an adult to ask a parent. | One condition. | **Yes** |

**Not recommended, considered:** wrapping /share-card, /register-interest and /squad in the seat frame (they are flows, and flows keep the Top bar, as join and claim do); a live render of the share card on the compose page (D-101: generating a preview is generating the image); the claimed club's colours on the register-interest club tile (allowed by D-173 (4), but the page doesn't read them and it is a new query for a 44px tile).

## Build order and dependencies (which pages move with the base pass alone)

**Move with A's base pass alone (no page edit):** the Frame, Seat bar and Rail on /build, /clips, /more, /ready and /send; every `card` spread (Floodlit surface and shadow); HeaderMark → Page header (the mark hides at ≥1024 inside the frame); /manage almost entirely (Quiet shell + `door`, and deleting `<PitchWordmark />`).

**Then, in this order:**
1. **Shared parts:** `--cv-hero-bg` (and PlayerCV reads it), `.checks`, `.notice-h`/`.notice-b`, `.pos-grid`. ~½ day.
2. **Send + Register interest + Share card** together: Door panel, Fields, `.checks`, the outcome Notice (one component used by all three: `Outcome({ tone, kicker, title, children })`), the shape tiles. ~1 day. Highest traffic of the group: Send is the distribution engine.
3. **The builder step 1** (`.cv-edit`, `form="cv"`, P1 if approved) + SquadCard. ~1 day.
4. **Ready** (ticket) and **Preview** (PlayerCV `above` slot, `.pv-strip`). ~½ day.
5. **Print** (tokens, sheet parts, Wordmark; P3 if approved). ~½ day.
6. **Clips, More, Squad** (Door, Panel lists, Empty tiles, `.fl-search`). ~½ day.
7. Decisions P4–P9 as BUZ answers them; each is independent and small.

**What I would build first:** step 2 (Send and its two siblings): it is the screen that moves a CV to a club, and it is where green currently paints "Sending is off". **What I would not build:** a live share-card preview, and the frame around the flows (above).

## Risks and suites likely to move (render/layout/perm tests that assert on classes or text)

- **write-tests (forms driven by `name`):** P1's `form="cv"` puts Number and Preferred foot outside the `<form>` element. A browser posts them; a test that collects inputs *between* `<form>` tags would not. Check how write-tests builds the /build post before merging P1; if it parses by nesting, teach it the `form` attribute or keep those two inputs inside the form and lay the card out with `display: contents` instead.
- **render-tests pv-r2:** `<button … aria-pressed="true" …>Appearances</button>`: the stat toggle's text must stay bare (no icon or span inside).
- **render-tests A19 (more):** `name="kind" value="school"` radios; keep `.chip.pick` radio markup as is.
- **render-tests pv3–pv8:** the preview's words and the `/g/pending/` link; noindex; redirects for coach/TD/stranger/anon.
- **render-tests clubs1/clubs2:** club rows are `<a href="/squad/…?club=…">` with the name as the first text node; don't wrap the name in anything before it.
- **render-tests prem-r5:** no "Premium" or "first in line" text and no `name="feature"` for a 16–17 or a parent's view of a child's clips.
- **render-tests sc-r1–sc-r7 and link-r2:** `clubName`/`address` input names and values; the contiguous outcome string; no "Your links" on the blocked page; /home's `/share-card/` link text "Share my CV".
- **render-tests A19 print + D-77:** `/p/dev-deniz/print`, `/p/dev-nate/print`, `/p/dev-jordan/print`; a dead token on `/print` still renders LinkState at 200.
- **layout-check:** 44px targets (shape tiles, Remove, `.console-btn`, "Review the changes"); the squeeze rule on the invitation's two buttons at 320; the P1 grid at 1024–1031 (the rail leaves 792px: 400 + 28 + 364).
- **palette-check:** `--cv-hero-bg` and `--print-*` are CSS-only; confirm the check's allowlist takes them as it takes `--surface-hover` and A's three.
- **Known, unchanged:** an under-16 with no approved snapshot gets `notFound()` on /preview (a guardian reaches it only after approving, so rare); left as is.
