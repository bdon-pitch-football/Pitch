# G — Access utilities: build spec

**Seat:** design-proposal, for the Head of Product Design, then Leo's build team. **Date:** 1 Oct 2026. **Branch:** design/player-cv (nothing committed).
**Mockup:** `docs/design/mockups/floodlit-access-ops-demo.html`, section G (15 states, 390 and 1280, same markup).
**Not redrawn:** `/join`, `/signin`, `/claim`, `/claim/[slug]` are approved in `floodlit-join-signin-claim.html`. This group uses their door.
**Shell parts** are named as in `specs/A-shells-and-homes.md`: **top bar**, **page header**, **page title**, **door panel**, **quiet shell**, **field**, **notice**, **well**, **buttons and the one glow**.

## Summary

- **One idea: a link from a message opens one door.** Every page reached from an email or a text becomes the approved sign-in door: top bar, a **door panel** from 640px, one title, one line, at most one glowing button. Its first object is the **glyph tile** (FailureState's tile, extracted). The tile says what happened: solid while the link asks for something, a tick when it is done, dashed when the link is not live.
- **What it fixes:** five pages built three ways (HeaderMark column, QuietShell with the logo top left on a phone, a hand-built button on `/undo`), two titles off the charter (28px at −0.02em), and a reset "expired" line that reads as ordinary grey text.
- **Found while designing:** `/undo/[token]` has no after-state. After the press it shows the same question again, and after 24 hours it silently does nothing (G-P1). `/reset/[token]` never checks its link until you have typed a password (G-P2).
- **Size:** S per page, **about 1 day** for all five with the base pass in place. G-P1 adds about half a day (behaviour, with John).

## Pages

### /confirm/[token]  ·  anyone who has just signed up, from the confirm email  ·  size S
- **Source:** `app/confirm/[token]/page.tsx`, `app/confirm/[token]/actions.ts`, `components/OpenInBrowser.tsx`, `components/Wordmark.tsx` (HeaderMark).
- **States:**
  1. Live link (the ask).
  2. Live link opened inside a mail or social app (OpenInBrowser shown above the ask).
  3. Not live: used, lapsed or never existed. This is **one panel for all three** (D-77, D-94 §2).
  4. After a good press → `/signin?confirmed=1` (approved sign-in mockup). After a failed press → state 3.
- **Phone (390):**
  1. Top bar, logo right, **not a link** (`SiteNav homeLink={false}`: HeaderMark's mark was never a link).
  2. Glyph tile (mail; dashed link when not live).
  3. Page title.
  4. OpenInBrowser, if shown.
  5. The body line (`.body`).
  6. The button: primary with the glow when live; secondary "Go to sign in" when not live.

  The inner `card` that wraps the line and the button goes away: the door is the surface.
- **Laptop (1280):** the same column on the **door panel** (640 from 1024), top bar with the logo left.
- **Parts:** top bar, door panel, page title, `.glyph-tile` (new, below), `.btn-primary.fl-glow`, `.btn-secondary`. OpenInBrowser becomes a **notice** (`card card-amber`): its two buttons stay `btn-secondary`, so the one green is the confirm.
- **Copy:** verbatim: "Confirm your email address" · "This link isn't live" · "Press the button and this address is yours on Pitch. Until then, the account it belongs to signs in nowhere." · "Yes, it's me — continue" · "It may have been used already, or it may have lapsed. Either way, nothing is lost: use "Reset it" on the sign-in page and choose a password from the link we email you." · "Go to sign in". OpenInBrowser's words are unchanged.
- **Must not change:**
  - The press proves the address, never the page load (D-156). The form posts `token` as a field, not `bind()`.
  - The dead panel is identical for used, lapsed and unknown tokens (D-77). Nothing says whether an account exists (D-94 §2).
- **Done when:**
  - [ ] At 390 there is no card inside the column. At ≥640 the column sits on `.door` with `--shadow-float`.
  - [ ] There is exactly one `.btn-primary` (with `.fl-glow`) in the live state, and none in the dead state.
  - [ ] The glyph tile is solid when live and `.is-dashed` when dead.
  - [ ] The logo is not an `<a>`.
  - [ ] The form still posts `token` and works with JavaScript off.

### /reset  ·  anyone signed out who forgot a password (from /signin)  ·  size S
- **Source:** `app/reset/page.tsx`, `app/reset/actions.ts`.
- **States:**
  1. The form.
  2. `?expired=1`: a reset link that was used or ran out, with the form.
  3. `?sent=1`: the same answer for every address, no form.
- **Phone (390):**
  1. Top bar (logo right, not a link).
  2. **Page header** with the back link "Sign in" → `/signin`, in the column, **at every width** (A §5: SiteNav's `back` is not used in a flow).
  3. Glyph tile: a key. It is dashed in state 2, and a solid mail tile in state 3.
  4. Page title.
  5. State 2 only: an amber **notice** with the expired line, `role="status"`.
  6. A **field** (Email).
  7. Primary "Email me a reset link", with the glow.
  8. The under-16 line as a **well** (`card-sunken`). Today it is a raised surface-2 card. It is something you read, so it goes down.

  State 3 replaces 6–8 with the accent **notice** (`card card-accent`). The tile stays solid and **carries no tick**: the page must not claim anything was sent.
- **Laptop (1280):** the same column on the door panel. The back link sits at the top of the panel.
- **Parts:** top bar, page header (`.pg-back`), door panel, `.glyph-tile`, **field** (was a 16px card with the label inside), notice (`card-amber`, `card-accent`), well, `.fl-glow`.
- **Copy:** verbatim: "Sign in" (back) · "Reset your password" · "That link has been used or has expired. Ask for another one." · "Email" · "you@example.com" · "Email me a reset link" · "If the account belongs to someone under 16, the link goes to their parent — the same as everything else on that record." · "If there's a Pitch account for that address, a reset link is on its way."
- **Must not change:**
  - The sent answer is the same whatever the address (D-94 §2, doc 14 J18). The two rate limits and the single redirect stay.
  - An under-16's link goes to the guardian (D-19).
- **Done when:**
  - [ ] The input is a `.field` well (label inside, `name="email"`, `type="email"`, `required`).
  - [ ] The expired line is an amber notice announced with `role="status"`, above the form.
  - [ ] The sent state shows no tick and no form.
  - [ ] "Sign in" back link is visible at 390 and at 1280.
  - [ ] The under-16 line is `card-sunken`.

### /reset/[token]  ·  the holder of a reset link (from email; for an under-16, the parent)  ·  size S
- **Source:** `app/reset/[token]/page.tsx`, `app/reset/actions.ts` (`submitNewPassword`).
- **States:**
  1. The form.
  2. Opened inside a mail app (OpenInBrowser, as on /confirm).
  3. `?short=1`: fewer than ten characters.
  4. Dead link. **Today this is only reached after submitting**, via `/reset?expired=1` (see G-P2).
- **Phone (390):**
  1. Top bar (logo not a link).
  2. Glyph tile (key).
  3. Page title.
  4. OpenInBrowser notice, if shown.
  5. `?short=1`: amber notice, `role="alert"`, and the field takes `aria-invalid="true"` (the amber edge, A §19).
  6. The field "New password".
  7. Primary "Save it", with the glow.
  8. The small consequence line.
- **Laptop (1280):** the same column on the door panel.
- **Parts:** as /reset. The field is the **field** well (it was a card).
- **Copy:** verbatim: "Set a new password" · "Use at least ten characters." · "New password" · "Save it" · "This signs you out everywhere else once you sign back in."
- **Must not change:**
  - The token is single-use, one hour, compared as a hash.
  - It is posted as a form field (no `bind()`, works with JavaScript off).
  - `minLength=10` stays, and so does the server check.
- **Done when:**
  - [ ] The field is `.field` with `name="password" type="password" minLength=10`.
  - [ ] `?short=1` shows the amber notice and the field's `aria-invalid`.
  - [ ] One glowing primary.
  - [ ] (With G-P2) a dead token redirects on load to `/reset?expired=1`.

### /undo/[token]  ·  the other parent (doc 15 §36) or a family after a club's suspension (§37), from email  ·  size S (M with G-P1)
- **Source:** `app/undo/[token]/page.tsx` (the server action `revoke` is inline); the tokens come from `lib/send-dispatch.ts` (24 hours) and the messages from `lib/messages.ts`.
- **States:**
  - **Today:** one. The ask renders for every token, before and after the press. The action has no redirect, and the page reads no state (drawn as "after the press, today", tagged red).
  - **Proposed (G-P1):**
    1. The ask (live token).
    2. **Done** (the press revoked a live link).
    3. **Not live** (used, lapsed or unknown: one panel, D-77).
- **Phone (390), the ask:**
  1. Top bar (logo not a link).
  2. Glyph tile (link-off).
  3. Page title "Switch this link off?".
  4. The body line.
  5. Primary "Switch it off", with the glow. **It was a hand-built button** (inline styles, radius 14), and becomes `.btn .btn-primary`.
  6. The "does not un-send" well (`card-sunken`, as today).
  7. "Not now" as the 44px way out (`.btn-ghost`, A §18) → `/home`.

  **Done:** tick tile, "Done", and the ask's first two sentences, now true. No button.
  **Not live:** dashed tile, "This link isn't live", the /confirm line's first sentence plus one new sentence (N-G1), and secondary "Go to sign in" → `/signin`.
- **Laptop (1280):** the same column on the door panel.
- **Parts:** top bar, door panel, `.glyph-tile` (three states), `.btn-primary.fl-glow`, well, `.btn-ghost`, `.btn-secondary`.
- **Copy:** verbatim: "Switch this link off?" · "The club will not be able to open the page any more. Nothing is deleted, and you can make a new link whenever you want to." · "Switch it off" · "This does not un-send the email. It has already arrived and nobody can recall it — not us, not you. What this stops is what it opens." · "Not now". With G-P1, "Done" (from /stop-cvs) and "This link isn't live" / "It may have been used already, or it may have lapsed." (from /confirm), plus **N-G1**.
- **Must not change:**
  - The link can do one thing only: switch off one share token that already exists. It never reads the record or the child, and never sends anything.
  - No sign-in is required to use it (a parent who has just been told something alarming meets no login wall).
  - The press is a POST with the token as a form field.
  - The not-live panel is one panel for every non-live token (D-77).
- **Done when:**
  - [ ] The button is `.btn.btn-primary.fl-glow`, and no inline button styles remain.
  - [ ] "Not now" is a 44px target.
  - [ ] (With G-P1) after the press the page shows Done for a live token and Not live for any other. The Done state's words are true, because the action checked the update's row count.
  - [ ] (With G-P1) the not-live panel's markup is identical for used, lapsed and unknown tokens.
  - [ ] `write-tests` undo still revokes (the §37 test at `scripts/write-tests.mjs` ~l.2850).

### /unsubscribe  ·  anyone on the old waitlist, from its email  ·  size S
- **Source:** `app/unsubscribe/page.tsx`, `components/quiet-shell.tsx`, `lib/waitlist-db.ts`.
- **States:**
  1. Done (the token matched).
  2. The link didn't work (bad or cut-short token).
- **Phone (390):**
  1. Top bar (the logo **is** a link: PitchWordmark linked to `/`, so the link is kept).
  2. Glyph tile: mail-off. It carries the tick in state 1 and is dashed in state 2.
  3. Page title.
  4. The body line.
  5. State 1 only: the small line with its link.

  There is no button.
- **Laptop (1280):** the same, on the door panel.
- **Parts:** **quiet shell** with `door` and `wide` (A §21). `wide` is needed so the door is the same 560/640 as `/signin`; the default 460 would make these two doors narrower than the other three. Also page title and `.glyph-tile`.
  - **Type fix:** the title goes from 28px at `-.02em` to the page title (26px, `--ls-title`), because −0.02em is not one of the five letter-spacings.
- **Copy:** verbatim: "You're off the list." · "We won't email you. That's the whole action — there was nothing else to remove." · "Changed your mind? Join again any time." · "That link didn't work." · "The unsubscribe link may have been cut short by your mail app. Try copying the whole link from the email, or reply to any email from us and we'll take you off by hand."
  - "Join again any time." is **flagged**, not rewritten (C-G1 below). **BUZ, 1 Oct: removed.** The whole line "Changed your mind? Join again any time." is gone from the page; the mockup predates the decision.
- **Must not change:** one click unsubscribes. There is no confirmation step and no retention question (doc 29 §5). It works with no account.
- **Done when:**
  - [ ] No `PitchWordmark` in the page. The top bar's logo is a link to `/`.
  - [ ] The title is 26px at `var(--ls-title)`.
  - [ ] The tick tile shows only in state 1, and the dashed tile only in state 2.
  - [ ] The door panel width matches `/signin` at 1280.

### /stop-cvs  ·  a club's inbox, from the CV email's opt-out link  ·  size S
- **Source:** `app/stop-cvs/page.tsx`, `app/stop-cvs/actions.ts`, `lib/stop-cvs.ts`.
- **States:**
  1. The ask. It is the same for a good signature, a bad one or none.
  2. `?done=1`. Every outcome lands here: good, bad, or held by the rate limit.
- **Phone (390):**
  1. Top bar (logo is a link, as today).
  2. Glyph tile: a stopped CV. It carries the tick in state 2.
  3. Page title.
  4. The body line.
  5. State 1: primary "Stop them", with the glow.
- **Laptop (1280):** the same, on the door panel.
- **Parts:** quiet shell with `door wide`, page title (the same type fix as /unsubscribe), `.glyph-tile`, `.fl-glow`.
- **Copy:** verbatim: "Stop CVs to this address?" · "Pitch won't send CVs to this address again. Families can still contact the club in other ways." · "Stop them" · "Done" · "Pitch won't send CVs to this address again."
- **Must not change:**
  - Opening the link changes nothing (mail scanners). The press does it, with no JavaScript.
  - The page is identical whatever the link says, and no address is shown or carried.
  - Every outcome lands on the same done screen.
- **Done when:**
  - [ ] The ask and done screens render identically for good, bad and missing `r`/`t`.
  - [ ] There is one glowing primary on the ask and none on done.
  - [ ] The hidden fields `r` and `t` are unchanged.
  - [ ] `permission-tests` and `render-tests` stop-cvs checks pass unchanged.

## New shared parts (class, exact CSS, where used)

**`.glyph-tile`** is extracted from `GlyphTile` in `components/FailureState.tsx` and exported from there as `GlyphTile({ state?: 'ask' | 'done' | 'dead', children })`. It goes in `app/globals.css`, SHELLS block, after **empty tile**. A §22 already moves its radius to `--r-card`. Used by every page in G, and by FailureState (state `ask`, unchanged look).

```css
.glyph-tile { position: relative; width: 56px; height: 56px; border-radius: var(--r-card); background: var(--surface-2); border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--ink); }
@media (min-width: 640px) { .door .glyph-tile { background: var(--surface-hover); } }
/* dead: the link is not live (dashed = "not yet" / nothing here now) */
.glyph-tile.is-dashed { border: 1.5px dashed rgba(255,255,255,.3); background: rgba(255,255,255,.04); color: var(--muted); }
/* done: the approved claim "done tile" tick, as a child span */
.glyph-tick { position: absolute; right: -7px; bottom: -7px; width: 24px; height: 24px; border-radius: 999px; background: var(--accent); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 3px var(--bg); }
@media (min-width: 640px) { .door .glyph-tick { box-shadow: 0 0 0 3px var(--surface); } }
```

- **Markup for done:** `<div class="glyph-tile"><svg …/><span class="glyph-tick" aria-hidden><svg 13px tick stroke var(--on-accent), stroke-width 3/></span></div>`.
- **Glyphs** are stroke SVGs at 24px, stroke-width 1.8 (FailureState's):
  - mail (`/confirm`, `/reset` sent);
  - key (`/reset`, `/reset/[token]`);
  - link-off (`/undo`);
  - link (not live);
  - mail-off (`/unsubscribe`);
  - a CV with a stroke through it (`/stop-cvs`).

  The paths are in the mockup's `I` table.
- **Note for the Head of Design:** dashed here means "this link is not live". That extends "dashed means not yet" to "nothing here now". I think it is the same sentence ("there is nothing to act on here"), but it's your call to reconcile.

No other new part. The notes are A's **notice** (`card-amber`, `card-accent`); the fields are A's **field**; the door is A's **door panel**.

## New copy for BUZ (current line → proposed line, why)

| # | Where | Current | Proposed | Why |
|---|---|---|---|---|
| N-G1 | `/undo/[token]`, not-live panel (only with G-P1) | *(no such panel: the page asks again)* | "It may have been used already, or it may have lapsed. **Sign in, and you can switch off any club's link from your child's controls.**" | The first sentence is /confirm's, verbatim. The second is new. It tells a parent whose 24-hour link lapsed that the link may still be on, and where the switch is (`/g/controls/[childId]`, "Switch off"). **John should see it**: it is the §36/§37 promise. |

**Approved words used in a new place (with G-P1):**
- "Done" (from /stop-cvs);
- "This link isn't live" and "Go to sign in" (from /confirm);
- the ask's own first two sentences, reused as the done line.

**Existing line that is untrue today (C-G1).** `/unsubscribe`: "Changed your mind? **Join again any time.**" links to `/`. Since 1 Oct `/` is the front door, and there is no waitlist left to join. It is drawn verbatim. Either BUZ removes the line, or it points somewhere true. That's a copy decision, not design.

## Product decisions for BUZ (not look; behaviour, numbers, doors)

> **1 Oct, John + BUZ:** G-P1 is cleared. Build it first; it's a defect. The not-live path must match "Done" in timing too. BUZ amended U-2: §36's undo now lives as long as its link. See README, "John's rulings".

| # | Decision | What it buys | What it costs | Recommendation |
|---|---|---|---|---|
| **G-P1** | **`/undo` tells the parent what happened.**<br>• On load, a non-live undo token shows one "This link isn't live" panel, the same for used, lapsed and unknown, as `/confirm` does.<br>• After the press, the action redirects to a Done state **only if its update revoked a row**, and otherwise to the not-live panel.<br>• The not-live panel adds one door: "Go to sign in" → `/signin`. | Today a parent presses "Switch it off" and sees the same question again. After 24 hours the press silently does nothing and the club can still open the page. It's the safety email's own promise ("this takes one tap"), and today the screen can't say whether it was kept. | About half a day. The page reads `undo_token` (used / expired). The action checks `rowCount` and redirects (`?done=1`), and the page needs two new states. One new door and one new line (N-G1). It **revises the file's D-77 reading** ("a spent link, a wrong one and a live one all end on the same page"). `/confirm` already draws live versus not-live for a token only its holder has, and that leaks nothing to a stranger, but **John should confirm**. | **Yes, with John.** It's the most valuable thing in this group. |
| **G-P2** | **`/reset/[token]` checks its link on load** and sends a dead one straight to `/reset?expired=1`. Today it finds out only after the password has been typed. | The person doesn't type a new password into a dead link. The screen matches `/confirm`. | 1 hour. It needs a read-only "is this reset token live" helper beside `consumeReset` in `lib/auth.ts`. There are no new words (the expired line exists). | **Yes.** |

## Build order and dependencies

1. **A's base pass first** (top bar, door panel, quiet shell `door`, field, notice, A §22's radius). After it, `/unsubscribe` and `/stop-cvs` move with **only** the `door wide` prop and the title fix.
2. **`GlyphTile` extraction** (the three states), then `/confirm` and `/reset` (the page header back link, field, notices).
3. **`/reset/[token]`** (field, short state). Add G-P2 if approved.
4. **`/undo/[token]`**: the charter button and the 44px "Not now". G-P1 follows as its own change once BUZ and John say yes.

## Risks and suites likely to move

- **`render-tests.mjs` / `layout-check.mjs`** read `/confirm`, `/reset` and `/stop-cvs`:
  - text checks on the titles and lines should hold (the words are unchanged);
  - any check that looks for the old inner `card` or `HeaderMark` markup will move;
  - `layout-check`'s 44px and squeeze rules should pass, and "Not now" becomes a real 44px target.
- **`write-tests.mjs`** posts `/confirm`, `/reset`, `/reset/[token]`, `/undo/[token]` and `/stop-cvs` by form fields. Every `name` and hidden field is unchanged. With G-P1, the undo post gains a redirect: the test at ~l.2852 should follow it and assert the Done state.
- **`permission-tests.mjs`** covers `/reset` and `/stop-cvs` (no enumeration, identical answers). The new markup must stay identical across the outcomes those tests compare.
- **The in-app browser note** is only visible with an in-app user agent, so check it by hand with a Gmail or Instagram UA string at 390.
