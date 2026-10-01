# H — The public extras: build spec

**Seat:** design-proposal, for the Head of Product Design, then Leo's build team. **Date:** 1 Oct 2026. **Branch:** design/player-cv (nothing committed).
**Mockup:** `docs/design/mockups/floodlit-coach-and-public.html`, group H: 9 states, each at 390 and 1280 in the same markup. Shell parts are A's (`specs/A-shells-and-homes.md`), referred to by their bold names.

## Summary

- **What changes:** every page a person lands on by accident or by duty becomes one quiet page, built from A's parts:
  - the **top bar** and the reading column;
  - a form goes in A's **door panel** (`/report`);
  - every "nothing here" shares A's **failure shell** (the 404, the 500, and the dead link as its sibling);
  - every legal document shares one reading template (`.legal-doc` on A's **quiet shell**).
- **What it fixes:**
  - the legal pages put the logo top left on a phone;
  - the legal title uses a sixth letter-spacing (−0.02em) and a faked italic;
  - `/report`'s choices are bare radios;
  - the report-received page marks an urgent safety line in green (an action colour);
  - the dead link's two "read this" cards use two different surfaces;
  - the glyph tile uses an 18px radius.
- **Size:** about 1 day after A's base pass. Most of it is CSS: the legal template, `/report`, `LinkState` and the footer are S each; the 404 and 500 move with A's failure shell and need no page edit beyond it.

## Pages

### /report  ·  anyone, no account  ·  size S
- **Source:** `app/report/page.tsx` (`app/report/actions.ts` unchanged), `components/FailureState.tsx` (`FAILURE_COPY.reportDone`), `lib/legal-doc.ts` (`documentTitle`).
- **States:**
  - the form, with `?page` and `?kind` carried as hidden fields;
  - the form with no `?page`;
  - done (`?done=1`): the same page whether or not the rate limit bit and whether or not an email was given.
- **Phone (390):**
  1. **Top bar**.
  2. The **door panel** holds, in today's order:
     - the **page title** ("Report this page" and its line);
     - the fieldset: its legend is a field label ("What's it about — optional"), then four choice rows (`.field-opt`, 48px, the radio inside the well; the checked row takes the accent edge). "Something else" stays checked by default;
     - the 1800RESPECT **well**, with the phone number as an accent link at a 44px target;
     - "What's wrong — optional" as a textarea **field**;
     - "Your email — optional, if you'd like a reply" as a **field**;
     - the own-child **well**;
     - "Send the report" as the glowing primary;
     - the policy link ("Complaints, Reports and Takedown", accent, 44px).
  3. Footer.
- **Done (390):**
  1. The same door, holding the heading "We've received your report";
  2. the urgent line as A's amber **notice** (it was `.card-accent`, a green edge);
  3. the thanks line (13.5px secondary);
  4. "Go to the start" as a secondary.
- **Laptop (1280):** the top bar with the logo at the left, then the door lifted onto its panel (max 640, `--shadow-float`), centred. Inside the panel, fields step up to `--surface-hover` and wells to `--surface-2` (A part 19).
- **Parts:**
  - A: **Top bar**, **Door panel**, **Page title**, **Field**, **Well**, **Notice**, **Buttons and the one glow**;
  - new: `.field-opt` (see New shared parts);
  - `fieldset.opts` loses its card: the rows are the choice.
- **Copy:** verbatim. The done page's lines are `FAILURE_COPY` and are still awaiting BUZ (HC2). See HC3.
- **Must not change:**
  - D-64: no account and no reason needed;
  - doc 32 A5: the four concern values `child_account`, `own_child`, `family_safety`, `other`, with `other` checked;
  - the field names `subjectRef`, `subjectKind`, `concern`, `reason`, `reporterEmail`;
  - doc 35 5a: every report is saved, and the done page is identical whatever the rate limit did;
  - the heading-above-urgent-above-thanks order (fp11, fp12).
- **Done when:**
  1. The form posts exactly the fields it posts today (write-tests 1980–2005 pass).
  2. The four choices are each ≥48px and fully tappable.
  3. One `.fl-glow` on the form.
  4. The done page's urgent line has an amber edge and comes before the thanks.
  5. At 1280 there is one logo, top left.

### /privacy, /privacy/family, /terms, /conduct, /report/policy  ·  anyone  ·  size S (one template, CSS only)
- **Source:** `app/legal/legal-page.tsx` (`renderLegal`, `LegalBody`, `LEGAL_CSS`), `components/quiet-shell.tsx`, and the five page files. No change to `lib/legal-doc.ts` or to any document.
- **States:**
  - a document with a title and a version line (20, 21, 22);
  - a document with a title, a subtitle (h3) and a version line (24, 25);
  - a second top-level heading in the body ("# Part 1 — …", doc 25);
  - tables, including key/value tables whose header row is empty (`| | |`);
  - lists;
  - `LegalBody` embedded in the guardian approval flow (`/a/*`, doc 32 B3). It uses the same stylesheet, so it moves too; the flow itself is another group's page.
- **Phone (390):**
  1. **Top bar**: the logo top right, replacing `PitchWordmark` top left (A part 21);
  2. then, in the reading column:
     - the title (26/900, `--ls-title`);
     - the subtitle in secondary (16/700) where one exists;
     - the version line as a plain 12px/700 muted label, not italic;
     - the body at 14.5px secondary, line-height 1.65;
     - section headings at 20/800, 36px above;
     - sub-headings at 16/800;
     - tables in a sunken well with a 12px radius that scrolls sideways (cells keep their 150px minimum);
     - a second top-level heading becomes a part break (22px, with a hairline 28px above);
  3. footer (with the entity line).
- **Laptop (1280):** the top bar with the logo at the left, and the 640 column centred (A's quiet shell `wide`). Nothing else moves. There is no contents rail (a laptop-only feature; see HD1).
- **Parts:**
  - A: **Top bar**, **Quiet shell** (`wide`);
  - `.legal-doc`, restyled with the exact CSS below. `LEGAL_CSS` is replaced wholesale.

```css
.legal-doc { font-size: 14.5px; color: var(--secondary); font-weight: 500; line-height: 1.65; }
.legal-doc h1 { font-size: 26px; font-weight: 900; letter-spacing: var(--ls-title); color: var(--ink); line-height: 1.15; margin: 0; }
.legal-doc h1 ~ h1 { font-size: 22px; margin-top: 40px; padding-top: 28px; border-top: 1px solid var(--line); }
.legal-doc h1 + h3 { font-size: 16px; font-weight: 700; color: var(--secondary); margin-top: 8px; line-height: 1.4; }
.legal-doc > p:first-of-type > em:only-child { display: inline-block; font-style: normal; font-size: 12px; font-weight: 700; color: var(--muted); margin-top: 4px; }
.legal-doc h2 { font-size: 20px; font-weight: 800; color: var(--ink); margin: 36px 0 0; line-height: 1.25; }
.legal-doc h3 { font-size: 16px; font-weight: 800; color: var(--ink); margin: 1.6em 0 0; }
.legal-doc p { margin: 12px 0 0; }
.legal-doc strong { color: var(--ink); font-weight: 700; }
.legal-doc em { font-style: normal; color: var(--ink); }            /* Archivo has no italic file loaded */
.legal-doc a { color: var(--accent); font-weight: 700; }
.legal-doc ul, .legal-doc ol { padding-left: 20px; margin: 10px 0 0; }
.legal-doc li { margin: 5px 0; }
.legal-doc table { display: block; overflow-x: auto; border-collapse: separate; border-spacing: 0; width: 100%; font-size: 13px; margin-top: 14px; border: 1px solid var(--line); border-radius: var(--r-well); background: var(--surface-sunken); }
.legal-doc th, .legal-doc td { border-bottom: 1px solid var(--line); padding: 9px 12px; text-align: left; vertical-align: top; min-width: 150px; }
.legal-doc tr:last-child td { border-bottom: 0; }
.legal-doc thead:has(th:empty) { display: none; }                 /* the key/value tables' empty header row */
.legal-doc code { background: var(--surface-2); border-radius: 6px; padding: 1px 6px; font-size: 13px; }
.legal-doc hr { border: 0; border-top: 1px solid var(--line); margin: 2em 0; }
```

- **Copy:** every clause is the published text, unaltered. No word is added.
- **Must not change:**
  - **the markup `renderLegal` emits.** leg-r4 reads `<div class="legal-doc"…>…</div><style>`, and leg-r6 reads `<h1>…</h1>\s*(<h3>…</h3>\s*)?<p><em>Version`. Style it; do not restructure it, and keep the `<style>` directly after the div;
  - the version line (legally load-bearing: consent is stamped `doc@version`);
  - `robots: noindex`;
  - nothing on these pages is stamped as consent (lib/legal-stamp).
- **Done when:**
  1. leg-r1 to leg-r8 pass unchanged.
  2. The logo is top right at 390 and top left from 1024.
  3. No letter-spacing outside the five values.
  4. No faked italic.
  5. A key/value table shows no empty header row.
  6. At 375px a four-column table scrolls inside its well, and the layout check's squeeze rule stays clean.

### app/not-found.tsx and app/error.tsx (FailureState)  ·  anyone  ·  size XS (moves with A's failure shell)
- **Source:** `app/not-found.tsx`, `app/error.tsx`, `components/FailureState.tsx`.
- **States:**
  - the 404: one body for every `notFound()` and every unmatched URL (a dead club slug, an expired job, a registrant a guardian paused);
  - the 500, with "Try again" and "Go to the start".
- **Phone (390):**
  1. **Top bar**;
  2. the reading column (A part 22):
     - the glyph tile (56px, `--r-card`, the stroke glyph in muted);
     - the **page title**, with the reason as its line;
     - the why in a **well**;
     - the way out as the glowing primary (and, on the 500, "Go to the start" as the secondary);
  3. footer.
- **Laptop (1280):** the top bar with the logo at the left, and the 640 column centred. Not a door: there is nothing to fill in.
- **Parts:** A: **Failure shell**, **Top bar**, **Page title**, **Well**, **Buttons and the one glow**. Nothing beyond A.
- **Copy:** verbatim `FAILURE_COPY`. Every string is still marked "AWAITING BUZ" in source (HC2).
- **Must not change:**
  - no props and no branch (doc 14: a denial answers as if the thing does not exist);
  - `data-failure` on the root;
  - nothing about the error is rendered (D-94 §1);
  - `<title>` in `error.tsx`.
- **Done when:**
  1. The failure-path render checks (fp1 to fp13) and the dead-link equivalence checks (render 2130–2149: "two dead job links", "a dead club slug and a dead job link") pass.
  2. The glyph radius is 16.
  3. One glow.

### The dead link — components/cv/LinkState.tsx (/p/[token] and /p/[token]/print, every non-live token)  ·  anyone  ·  size S
- **Source:** `components/cv/LinkState.tsx`, `app/p/[token]/request/actions.ts` (unchanged).
- **States:**
  - the form (with a token; every dead-link render has one);
  - asked (`?asked=1`): the same reply whether a request was sent, dropped as a repeat inside 24 hours, or aimed at a token that never existed.
  - There is no other state. Expired, revoked, paused, guardian-disabled and never-existed are **one body** (D-77).
- **Phone (390):**
  1. The **top bar exactly as the live CV draws it**: `SiteNav signIn={false} homeLink={false}`, so the logo is not a link and there is no sign-in. Live and dead links can then never differ in their chrome.
  2. The failure shell's composition:
     - the lock glyph tile;
     - the **page title** ("This link doesn't open anything" and its line);
     - the "That is deliberate…" **well**;
     - the "Not signed in as a verified club?…" **well**, with its info glyph (it was `--surface-2`; both "read this" cards are now wells, see HC1);
     - then one **panel**: "Were you sent this link?" (16/800), its line, "Your name" and "Your role and club" as **fields**, and "Ask the family" as the glowing primary.
  3. Asked: the panel holds the reply line instead of the form. Nothing else moves.
  4. Footer.
- **Laptop (1280):** the top bar with the logo at the left, and the 640 column centred, as for the 404.
- **Parts:** A: **Failure shell** composition, **Top bar**, **Page title**, **Well**, **Panel**, **Field**, **Buttons and the one glow**.
- **Copy:** verbatim. See HC1.
- **Must not change:**
  - **D-77:** 200, identical copy, structure and timing for every kind of dead link. Add nothing that depends on the kind, the token, the viewer or the time;
  - no name, no club, no photo, no age, no initials, no squad number;
  - the component's signature, exactly `LinkState({ token, asked }: { token?: string; asked?: boolean })` (E11);
  - the source must still name no record field (E11b's word list includes `photo`, `initials`, `positions`: do not use those words even in a class name or comment);
  - the one rate-limited request (one per token per 24h);
  - the form's `token`, `name` and `role` fields;
  - `noindex` and `no-referrer` on the page (dead5, dead6).
- **Done when:**
  1. E11, E11b, E11c and dead3–dead6 pass.
  2. fp14 is updated for the glow class (see Risks) and passes.
  3. `/p/dev-expired`, `/p/dev-revoked` and a random token render byte-identical bodies apart from the token in the form.
  4. The bar matches the live CV's bar.

### components/SiteFooter.tsx  ·  every page (the entity line only outside a seat)  ·  size S
- **Source:** `components/SiteFooter.tsx`, `.site-foot` in globals.css, `lib/entity.ts`.
- **States:**
  - public page (the entity line and three links);
  - signed-in page (the three links only; BUZ, 30 Sep, option 1);
  - the front door (renders its own, `onFrontPage`);
  - under a seat bar on a phone (the existing 90px bottom clearance).
- **Phone (390):** the entity line wraps above the links; the links (Privacy, Terms, Report a page) are 44px targets.
- **Laptop (1280):** the entity line on the left and the links on the right, max 1200.
- **Parts:** it edits `.site-foot` only. Its side padding follows `.fl-wide` (18 / 28 / 40), so its edges line up with the top bar's on every Floodlit page, and its top rule becomes the bar's hairline (`--glass-line`):

```css
.site-foot { max-width: var(--wide); margin: 0 auto; padding: 18px 18px 26px; display: flex; flex-wrap: wrap; gap: 6px 18px; justify-content: space-between; align-items: center; font-size: 11.5px; font-weight: 500; color: var(--muted); border-top: 1px solid var(--glass-line); }
@media (min-width: 640px)  { .site-foot { padding-left: 28px; padding-right: 28px; } }
@media (min-width: 1024px) { .site-foot { padding-left: 40px; padding-right: 40px; } }
```

- **Copy:** verbatim, from `ENTITY_LINE`, "Privacy", "Terms" and "Report a page".
- **Must not change:**
  - doc 32 B4/B5 (report on every page; the entity named on public and legal pages);
  - the safe-path rule (only `/c/…`, `/fc/…`, `/trials`, `/jobs` ever go into `?page`; never a token);
  - the element must stay exactly `<footer class="site-foot">`, because g32-r3 reads that literal. Add no second class.
- **Done when:**
  1. g32-r3 to g32-r6 pass.
  2. At 1280 on `/fc/riverside-fc` the footer's left edge lines up with the logo's.
  3. The footer clears the seat bar on a phone.

## New shared parts (class, exact CSS, where used)

```css
/* A field well as a choice: a radio (or checkbox) inside the well, the whole row the target.
   Used on /report. The trials/join proposal's .choice is the big version with an icon; this is the plain one. */
.field-opt { display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 10px 14px; border: 1px solid var(--line); border-radius: var(--r-well); background: var(--surface-2); font-size: 13.5px; font-weight: 700; color: var(--secondary); cursor: pointer; }
.field-opt input { width: 18px; height: 18px; accent-color: var(--accent); margin: 0; flex-shrink: 0; }
.field-opt:has(input:checked) { border-color: var(--accent); color: var(--ink); }
.field-opt:has(input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (min-width: 640px) { .door .field-opt { background: var(--surface-hover); } }
fieldset.opts { border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
fieldset.opts > legend { padding: 0; margin-bottom: 8px; }

```

- The light print surface is C's (`--print-*`, `specs/C-player.md`). E's coach print adopts it; H adds no token.
- `.legal-doc` (restyled) and `.site-foot` (edited) are existing classes; their exact CSS is above.

## New copy for BUZ (current line → proposed line, why)

> **1 Oct, John + BUZ:** HC3 is cleared. The form, the received page and doc 25 all read "If you believe a child is in immediate danger, call 000." No 131 444. See README, "John's rulings".

| # | Where | Current line | Proposed | Why |
|---|---|---|---|---|
| HC1 | Dead link, the third card | "Not signed in as a verified club? Then there is nothing on this page for you, and there is nothing more we will tell you." | **Remove the card.** | The page says "we don't say which" three times: in the reason line, in "That is deliberate…", and here. This card also contradicts the form directly under it, which invites anyone who was sent the link, not only verified clubs. The request-for-verified-clubs variant it was written for "arrives with auth" (LinkState's header). Say it once. If BUZ says no, it stays, drawn as a well. |
| HC2 | 404, 500, report received, and the coach editor's "needs profile" line | Every string in `FAILURE_COPY` (`components/FailureState.tsx`) | **No change proposed. These need approval as they stand.** | The source marks them "⚠ AWAITING BUZ. None of this is approved copy", listed in `docs/team/reports/2026-09-28-builder-failure-path.md`. They are live on every 404 and 500. The mockup uses them verbatim. |
| HC3 | `/report?done=1`, the urgent line | "If it concerns a child's immediate safety, contact your local police first; we are not an emergency service." | "If it concerns a child's immediate safety, **call 000** first; we are not an emergency service." | The form above it says "In an emergency, call 000", and the policy says "call 000". A frightened parent should meet one instruction, not two. This moves fp12, which finds the line by "contact your local police first". If BUZ says no, nothing changes. |

## Product decisions for BUZ (not look; behaviour, numbers, doors)

| # | Decision | What it buys | What it costs | Recommendation |
|---|---|---|---|---|
| HD1 | **A contents list on the legal pages** ("On this page", a `<details>` at the top listing the h2s, at every width). | A parent can find "Deleting" in a 20-section policy on a phone. | New content that repeats the headings (say it once), and a new door per section. A rail version would be a laptop-only feature (D-147), so it can only be the same disclosure at both widths. | **Not now.** Bring it back if support mail shows people can't find sections. |
| HD2 | **The logo links home on `/report`, the 404 and the 500.** This comes from A's top bar (`SiteNav` default `homeLink`). Today `HeaderMark`'s mark is not a link. | A way off every accident page, which the 28 Sep report fix had to add by hand to one page. | One new door per page. **Not on the dead link:** it keeps the live CV's unlinked bar. | **Yes**, and settle it with A, since it is A's part |

## Build order and dependencies

1. **A's base pass**: the top bar, quiet shell, failure shell, door panel, notice and field. The 404 and 500 are then done, and the legal pages lose their top-left logo.
2. **`.legal-doc`**: the CSS block above, replacing `LEGAL_CSS`. It moves five pages and the approval flow's embedded policy.
3. **`/report`**: the door, `.field-opt`, and the amber notice on done (HC3 if approved).
4. **`LinkState`**: the live CV's bar, the wells, and one panel for the form (HC1 if approved).
5. **`.site-foot`**: three lines of CSS.

## Risks and suites likely to move

- **render-tests:**
  - **fp14** reads `/class="btn btn-primary"[^>]*>Ask the family/`. The glow makes the class `btn btn-primary fl-glow`, so change the regex to `/class="btn btn-primary[^"]*"[^>]*>Ask the family/`. The same applies to any other check that reads `class="btn btn-primary"` literally on a page that gains the glow (grep it once before building);
  - fp11–fp13: keep the h1 exact and the order;
  - fp12 moves if HC3 is approved;
  - leg-r1 to leg-r8: CSS only, so the markup is untouched;
  - g32-r3 needs the literal `<footer class="site-foot">`.
- **permission-tests:**
  - E11 (the LinkState signature);
  - E11b (the forbidden words in LinkState's source, including `photo` and `initials`);
  - E11c;
  - dead3–dead6;
  - the legal-doc property checks (legj1–8) do not touch the CSS.
- **write-tests:** 1980–2005 post `/report` by its field names. 157 skips `/conduct` and `/report/policy` links; unchanged.
- **layout-check:**
  - `/report` and `/report?done=1` are start and ring pages;
  - the `.field-opt` rows must keep ≥44px;
  - the legal tables are the squeeze rule's old finding. Keep `min-width: 150px` and the sideways scroll.
- **The one D-77 hazard:** a designer tidying `LinkState` must not add anything that varies, such as a different glyph for "expired", a date, or a "renew" hint. The page is one body by construction, and that is the property that matters, not the look.
