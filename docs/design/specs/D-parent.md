# D — The parent / guardian screens: build spec

**Seat:** design-proposal, for the Head of Product Design, then Leo's build team. **Date:** 1 Oct 2026. **Branch:** design/player-cv (nothing committed).
**Mockup:** `docs/design/mockups/floodlit-parent.html`. It holds 39 states, each at 390 and 1280 with the same markup, and the 1280 frames are container queries. Seed names only; where the seed has no row for a state, Nate or Jordan stands in, and that is said on the artboard.
**Shell parts** are named as in `specs/A-shells-and-homes.md`: **Top bar**, **Page header** (`.pg-head`/`.pg-back`), **Page title**, **Section heading** (`.sec-h`), **Panel** (`.card`), **Well** (`.card-sunken`), **Notice**, **Pill**, **Hero panel**, **Door panel** (`.door`), **Frame**, **Rail**, **Seat bar**, **Quiet shell**, **Failure shell**, and the one-glow rule (part 18).

## Summary (5 lines max: what changes, what it fixes, size)
- **One idea: every question a parent is asked is one answer sheet.** It reads, in order: who is asking (the child's tile and the purple kicker) → the question → what happens if yes (one panel of tick rows) → what happens if not (the well) → **two equal answers** (`.fl-answer`). It sits in the door panel from 640px. The controls and Your family are lists, so they are pages, not panels.
- **The consent-button decision:** where a press gives something away, Yes and No are the same charter secondary button at the same size. They stack on a phone and sit two-up from 1024px. Nothing glows on a consent answer. A step that gives nothing away keeps the one glowing primary.
- **What it fixes:** today every consent screen uses the glowing green primary for Yes. No is a `div` that does nothing on four screens, an 11.5px muted footnote on the approval, and a narrow ghost on the squad invitation. On top of that: three drawn buttons have no destination, the invite's two answers are painted wrong, and a parent who has just approved reads "what was here may have been taken down".
- **Size:** after A's base pass, about **3 days**. The answer screens (card, send, interest, pending, invite) are M, `/a/[id]` is M, controls is M, and done, waiting and privacy are S each. Two page decisions (PD-1, PD-4) are about 1 hour each.

## Pages

### /a/[id]  ·  a parent (or a stranger) arriving signed out from a text or email; the child via "Show them my page"  ·  size M
- **Source:** `app/a/[id]/page.tsx`, `app/a/[id]/actions.ts`, `lib/guardian-flow.ts`, `app/legal/legal-page.tsx` (LegalBody).
- **States** (each for the under-16 and the 16–17 wording, 16–17 when `existing_child`):
  1. Opened by the invitation id: no channel, no form, a note.
  2. A channel link, not yet confirmed here: "Yes, it's me — continue".
  3. This channel confirmed, the other not yet: the "One more step" status.
  4. Both confirmed: the adult tick, Approve/Confirm, and the footnote.
  5. 4 with `?adult=1`: the tick panel turns amber.
  6. Dead link (approved, held, purged or never existed): `notFound()`, which serves the root 404 (**Failure shell**). `approve()` with a finished code redirects to `/`.
- **Phone (390):**
  - **Top bar** (logo right). No back link: nothing sits behind this page.
  - The ask head: the `.who-tile` (the child's initial), then the purple kicker, then the h1 at 27px, then the sub.
  - A **Section heading** ("If you approve" / "Once you confirm"), then **one Panel** holding the 4 (or 3) tick rows.
  - The policy `<details>` as a **Panel**: open for under-16, closed for 16–17. It contains the LegalBody and "Open it as a full page".
  - The end block for the state:
    - 1: the note panel;
    - 2: a panel holding the line and `btn btn-primary fl-glow`;
    - 3: the status panel with `.card-accent`;
    - 4: `<form>` holding the adult tick panel, then `.fl-answer`. Cell 1 is the Approve/Confirm button (`.btn-secondary`) with the yes-line under it. Cell 2 is a **Well** with the clock glyph and the no-line.
- **Laptop (1280):**
  - **Top bar** with the logo left.
  - The same column on the **Door panel** (640).
  - In state 4, `.fl-answer` goes two-up: the button and yes-line on the left, the do-nothing well on the right, at equal width.
- **Parts:**
  - Top bar, Door panel, Panel, Well, Section heading.
  - `.fl-answer` and `.ask` / `.who-tile` / `.kick-p` (new, below).
  - The promise label moves from `T.accent` to the Section heading. Green is an action, and this label isn't one.
  - The four promise rows stop being four hand-built panels and become one Panel with rows (gap 11). The ticks stay accent: the front door's approved tick.
  - Inside the embed only: `.pol-well h1, .pol-well h2 { font-size: 16px; font-weight: 800; }`. This keeps the embedded document from shouting a second 28px title under "The privacy policy we wrote for Mila". 16px is already on the scale.
- **Copy:**
  - Verbatim. The footnote `<div>` is split at its `<br/>` into two elements, in the same order: "Approving accepts the Terms & Privacy Policy on {name}'s behalf, and you can undo it any time." and "Not ready? Do nothing. If you don't approve, all of this is deleted after 14 days." The 16–17 line "Not {name}'s parent? Do nothing. This request is deleted after 14 days." goes in the well.
  - PD-4 reuses LinkState's words (see New copy).
- **Must not change:**
  - D-156: two channels, and a press, not a page load, confirms.
  - The adult tick stays `required`.
  - The form fields stay as they are: `code`, `adult`.
  - No bound actions (w19/w20c).
  - Pillar zero 1: nothing is live before approval.
  - Doc 32 B3: the policy is shown in the flow, open for under-16.
  - Opening the page confirms nothing (`recordGuardianLanded` only).
  - The dead link stays identical for all four causes (D-155: a hold reads as an approval).
- **Done when:**
  - The approve/confirm button carries `btn btn-secondary` and no `.btn-primary` renders in state 4.
  - The no-line renders in its own element at 12.5px or more (not 11.5px muted), in a well of the same width as the button at ≥1024.
  - w20, w20b, g32-r1, leg-r1…r7 and t16g still pass unchanged.
  - The phone order is identical to today's (head, promises, policy, end block).
  - With PD-4, `/a/bogus`, an approved code and a purged code return a byte-identical body.

### /a/[id]/done  ·  the parent just after approving (a hold reads the same)  ·  size S
- **Source:** `app/a/[id]/done/page.tsx`, `app/a/[id]/done/actions.ts`, `components/OpenInBrowser.tsx`.
- **States:**
  1. No password, not sent: "Email me the link".
  2. `?sent=1`: "Send it again".
  3. Has a password: "Sign in".
  4. No email: the support line.
  5. Inside an in-app browser: OpenInBrowser's amber notice above the step.
  6. 16–17 confirmed: no "Page not built yet".
  7. Dead id: 404.
- **Phone (390):**
  - Top bar.
  - Page title ("Your family" and its line).
  - Section heading "Your children", then a Panel with the child tile, the name, "Page not built yet" and the tick line.
  - Section heading "Next", then [OpenInBrowser notice], then the step Panel.
- **Laptop (1280):**
  - Top bar with the logo left, and the 640 `.reading` column. There is no door panel, because this is a page with a list on it.
- **Parts:**
  - Page title, Section heading, Panel, Notice (`.card-amber`).
  - `.fl-glow` on the first `.btn-primary`: "Email me the link" or "Sign in".
  - "Send it again" stays secondary.
- **Copy:** verbatim.
- **Must not change:**
  - The address never reaches the page. Only has_email and has_password leave the database.
  - A hold is indistinguishable from an approval.
  - The rate-limited email answer is the same whatever happened.
- **Done when:**
  - Exactly one `fl-glow` in states 1, 3 and 5, and none in 2 and 4.
  - The child tile is 52px at radius 16.
  - A hold and an approval render byte-identical bodies.

### /g/card/[cardId]  ·  a signed-in parent  ·  size S
- **Source:** `app/g/card/[cardId]/page.tsx`, `actions.ts`, `image/route.tsx`.
- **States:**
  1. Awaiting: the image, the well, and the answer.
  2. Approved (`?approved=1` or `approved_at`).
  3. Not yours, malformed or missing: 404.
  4. Signed out: redirect to /signin.
- **Phone (390):**
  - Top bar, then Page header (back "Your family").
  - The ask head ("{name} made a card" and the h1).
  - The image frame (`.card` with 12px padding, the image at radius 12).
  - The well ("…Once it's out, we can't take it back…").
  - `.fl-answer`: [Approve this card] [Not this one].
- **Laptop (1280):**
  - The door panel. The image frame is held to `max-width: 420px; margin: 0 auto` so the answer stays near the fold.
  - A story card also gets `max-height: 560px; width: auto`, so it is never cropped.
- **Parts:**
  - Door panel, Page header, `.fl-answer`, Well.
  - The image frame radius goes from 18 to 16 (`var(--r-card)`); 18 is off-charter (A, "off-charter radii").
- **Copy:** verbatim. "Not this one" becomes a link only with **PD-1**.
- **Must not change:**
  - D-101: the exact image is shown behind sign-in before it exists anywhere.
  - The approval hashes what was shown.
  - "Once it's out, we can't take it back" stays unsoftened and bold.
  - D-89: the card's content.
- **Done when:**
  - Both answers are `.btn.btn-secondary` of equal computed width and height at 390 and 1280.
  - "Not this one" is an `<a href="/home">` (PD-1), or, without PD-1, it is not drawn as a control (see PD-1).
  - The approved state has no button.

### /g/send/[requestId]  ·  a signed-in parent (the child asked to send)  ·  size M
- **Source:** `app/g/send/[requestId]/page.tsx`, `actions.ts`, `lib/send-dispatch.ts`.
- **States:**
  1. Awaiting.
  2. Sent (`?sent=1`, already dispatched, **or the daily limit**: byte-identical, L38).
  3. Stopped (0160: the club asked Pitch to stop): no button.
  4. Expired (the request is deleted by the U-1 job), not yours, or malformed: 404.
- **Phone (390):**
  - Page header.
  - The ask head (tile, "{name} asked you to send this", the h1 at 24px, the sub).
  - Section heading "It goes to", then a Panel with the address in mono and the "typed this" line.
  - A Panel "What the club receives" with 2 ticks, a hairline and 1 cross.
  - The well (do nothing).
  - `.fl-answer`: [Send it to {club}] [Not this one].
  - Sent: the h1 and its line. Stopped: a **Hero panel** with a neutral **Pill** "Not sent", the h1 and the line.
- **Laptop (1280):** the door panel, with the answer pair two-up.
- **Parts:**
  - Door panel, Section heading, Panel, Well, Hero panel, Pill, `.fl-answer`.
  - The address panel **loses its accent border**: the address is a fact to check, not an action.
  - The cross glyph goes from `T.red` to `T.muted`, because the line is a promise, not an alarm.
- **Copy:** verbatim. "Change the address" goes with **PD-2**.
- **Must not change:**
  - L38/L41: the limit is invisible, and the sent page is identical for a real send and for the limit.
  - U-11: the removed "if they reply" line stays removed.
  - D-138: doing nothing is complete.
  - The address shown is the child's typed address, in full.
- **Done when:**
  - sc-r10 still finds "Send it to Quarrymead United".
  - addr-w2 and every `forms(…).find(f => 'requestId' in f.fields)` still find the send form. **The No must be an `<a>`, never a second form carrying `requestId`.**
  - No accent border on the page.
  - The stopped state renders no button.

### /g/interest/[requestId]  ·  a signed-in parent (the child asked to go on a register)  ·  size M
- **Source:** `app/g/interest/[requestId]/page.tsx`, `actions.ts`.
- **States:**
  1. Awaiting.
  2. Awaiting, registered against a trial (doc 14 N2 line).
  3. Sent (`?sent=1` or dispatched).
  4. Expired, not yours, or malformed: 404.
- **Phone (390):**
  - Page header.
  - The ask head (the trial line sits inside it when present).
  - Section heading "What {name} wrote", then a Panel (squad, positions, a hairline, "{name}'s line").
  - Section heading "It goes to", then a Panel (club tile, name, the **Pill** `pill-live` "Verified club on Pitch" when verified), then the inbox line.
  - A Panel "What the club receives" with 3 ticks, a hairline and 2 crosses.
  - The well.
  - `.fl-answer`: [Register {name}'s interest] [Not this one].
- **Laptop (1280):** the door panel, with the pair two-up.
- **Parts:**
  - As for send.
  - "What {name} wrote" **loses its accent border**.
  - The trial line goes from `T.accent` 800 text to ink 800 with a stroke calendar glyph.
  - The hand-built green dot plus text becomes `pill pill-live`, with the same words.
- **Copy:** verbatim. "Edit what {name} wrote" goes with **PD-2**. F3 (the sent state) is listed below.
- **Must not change:**
  - The parent reads exactly what the child wrote before it reaches any register.
  - `disclosed_by = guardian`.
  - The club sees name, age and club only (the cross rows).
  - The club tile is initials only: no crest and no colour (D-172 cannot be reached here, and we don't add an image).
- **Done when:**
  - The write-suite `formOn(page, f => 'requestId' in f.fields)` posts the register form.
  - The trial line renders in ink with a glyph, and no accent text remains on the page.
  - The equal-pair checks from the card page pass here too.

### /g/pending/[recordId]  ·  a signed-in parent (the child changed the page, D-119)  ·  size M
- **Source:** `app/g/pending/[recordId]/page.tsx`, `actions.ts`, `lib/record-guard.ts`.
- **States:**
  1. A change waiting, with an approved version.
  2. A change waiting, nothing approved yet ("Nothing approved yet" over "(empty)").
  3. Approved, no link (`?done=1` **or no pending version at all**).
  4. `?link=`: the link shown once.
  5. Not the guardian, or a missing record: the guard's answer.
- **Phone (390):**
  - Page header.
  - The ask head ("Waiting on you", then the h1 at 26px).
  - Section heading "The About section", then the diff panel with `.card-purple` (a state: waiting on you).
  - The three tick rows.
  - `.fl-answer`: [Approve the change] [Not this one].
  - In state 3: the Page title, then `btn btn-primary fl-glow` "Get the share link".
  - In state 4: a Panel with the link in **ink mono**.
- **Laptop (1280):** the door panel.
- **Parts:**
  - `.card-purple` (A, Notice).
  - "The new version" label goes from `T.accent` to ink.
  - "Get the share link" goes from a hand-built 50px green `<button>` to the charter primary.
  - The link text goes from accent to ink mono: it is not a link you can press.
- **Copy:** verbatim. "Edit the words first" goes with **PD-2**. F1 and F2 are listed below.
- **Must not change:**
  - D-119: guardian only, silence never publishes, and the child never approves their own edit.
  - Clubs read the old version until approval.
  - The raw token lives only in the URL once (D-53).
- **Done when:**
  - The layout-check route `/g/pending/<deniz>` passes (44px targets).
  - There are exactly two controls in state 1, equal in size.
  - No inline-styled button remains on the page.

### /g/invite/[invitationId]  ·  a signed-in parent (the guardian views; the player's own views are the player group's)  ·  size M
- **Source:** `app/g/invite/[invitationId]/page.tsx`, `actions.ts`, `lib/invitations.ts`.
- **States (guardian):**
  1. Open.
  2. Open, with the child's draft (the amber panel).
  3. `?reply=1`: approving the child's draft.
  4. `?reply=1`: replying directly.
  5. Reply sent.
  6. A guardian of an 18+ player (visibility only, no buttons).
  7. Not yours, or malformed: 404.
- **Phone (390):**
  - Page header.
  - The ask head (the child's tile, the kicker, the h1 at 26px, the sub).
  - The club panel with `.card-purple` (club tile, name, `pill pill-live` "Verified club", "Their note").
  - [The draft panel with `.card-amber`], then the three tick rows.
  - `.fl-answer`: [Reply to {club} / Review and approve] [Not this time].
  - The well ("Not this time" does not…).
  - The reply form, in this order:
    1. the head;
    2. Section heading "{name}'s answer" with the two options;
    3. "What you hand over": the email checkbox panel and the phone panel;
    4. "Anything you want to say";
    5. the well;
    6. `.fl-answer`: [Approve and send to {club} / Send my reply] [Not this time (PD-1)].
- **Laptop (1280):** the door panel, with the pair two-up.
- **Parts:**
  - **The two answer options:** today the first option is painted accent whatever is chosen, and the radio is `opacity: 0` with no checked style. So a draft of "Interested, not that date" *shows* "Georgia will be there" as chosen. Fix (CSS only, no JS):
    ```css
    .opt { flex: 1; cursor: pointer; position: relative; }
    .opt input { position: absolute; opacity: 0; }
    .opt > div { min-height: 52px; border-radius: 14px; border: 1px solid var(--line); background: var(--surface-2); display: flex; align-items: center; justify-content: center; text-align: center; padding: 0 8px; font-size: 14px; font-weight: 800; color: var(--secondary); }
    .opt:has(input:checked) > div { background: rgba(61,220,132,.14); border: 1.5px solid var(--accent); color: var(--accent); }
    .opt:has(input:focus-visible) > div { outline: 2px solid var(--ink); outline-offset: 2px; }
    ```
    The 14px radius is the source's own. Weight goes 900 → 800, because 900 is for titles and both options become one weight.
  - "Not this time" goes from a hand-built bordered link to `.btn.btn-secondary` in the pair. The submit goes from `btn-primary` to `btn-secondary`.
- **Copy:** verbatim. F4 and F5 are listed below.
- **Must not change:**
  - D-117: the only club-to-family route.
  - P8/P9: nothing is shared by default, and field by field.
  - D-138: ignoring produces no club-visible state. **"Not this time" writes nothing.**
  - A guardian of an adult cannot reply.
  - The phone warning stays.
- **Done when:**
  - The chosen option (`defaultChecked`) is the one drawn in accent, in both draft states.
  - The write-suite posts through `formOn(html, f => 'invitationId' in f.fields)` unchanged.
  - The pair is equal in size in states 1, 2, 3 and 4.
  - State 6 renders no button.

### /g/controls/[childId]  ·  a signed-in parent, inside the parent Frame  ·  size M
- **Source:** `app/g/controls/[childId]/page.tsx`, `actions.ts`, `components/SquadCard.tsx`, `RegisterReaders.tsx`, `WhoLooked.tsx`, `components/player-shell.tsx` (guardianFrame).
- **States:**
  - Default (under-16).
  - 16–17 (the Sending switch).
  - `?link=` (the full link, once).
  - No live link.
  - Paused, and sending off.
  - `?off=1` and `?taken=1` status notices.
  - `?squad=` error.
  - A squad invitation, a squad claim, and no squad.
  - Sends empty or listed.
  - Readers empty or listed.
  - Who looked: nobody, or answered.
  - Timeline empty or full.
  - Not yours: 404.
- **Phone (390):**
  - **Frame** with the **Seat bar**. **Page header** (back "Your family", mark right).
  - [Status notice], then the name row ("Preview page" pill link).
  - SquadCard, then the link, Pause, [Sending], [the sends list], readers, who looked, the timeline, and Delete. **The order is unchanged.**
- **Laptop (1280):**
  - **Rail** (rail mark, seat card "Alex / Your family", Home · Children · Trials · Sign out).
  - The 640 column. The column's mark is hidden (A part 6); the back link stays.
- **Parts:**
  - Every `h2 style={label}` above a panel becomes the **Section heading** (`.sec-h`).
  - Renew/Replace go from hand-built 44px ghosts (radius 12, a third button) to `btn btn-secondary`, two-up in a 1fr 1fr grid.
  - The link line goes from accent to ink mono.
  - Delete goes from a hand-built 46px/radius-13 red button to `btn btn-secondary is-danger` (new, below). It stays one tap (D-26).
  - "Leave", "Cancel" and "Switch off" use `.console-btn` (44px).
  - The SquadCard invitation's Yes/No become `.fl-answer`, both `.btn-secondary`. Both forms already exist.
  - The switches keep their look; the green track is a control's "on".
- **Copy:** verbatim.
- **Must not change:**
  - L57: every send, with the recipient in full.
  - D-94 §4: the full link once, then only the hint.
  - The `EVENT_LINES` vocabulary.
  - No pronouns (D-25).
  - Doc 34 rule 6 readers, U-6 who looked.
  - Deletion stays one tap and cascades (`fn_erase_child`).
  - Every control writes the consent log.
  - D-82: no paid surface.
- **Done when:**
  - Every write-suite `formOn`/`forms(...).find` on this page still finds its form: pause, send switch, tokenId, invitationId (with `answer`), take-off, and leave.
  - tr7 and tr9 still pass.
  - No hand-built `<button style=…>` remains on the page.
  - Section headings carry the hairline.
  - At 1280 the rail shows the mark top left and the column shows no second mark.

### /join/waiting/[id]  ·  the under-16 child, after asking a parent  ·  size S
- **Source:** `app/join/waiting/[id]/page.tsx`.
- **States:**
  1. The text waits (D-168): the approved line.
  2. Text and email sent: the masked number.
  3. Development only: "Show them my page".
  4. Approved, purged or never existed: 404.
- **Phone (390):**
  - Top bar.
  - **Hero panel** ("Not live yet" as `pill pill-wait`, the h1 at 31px as built, the body).
  - Section heading "We asked", then a Panel.
  - The "Honestly? Just go and ask them." Panel.
  - The well (14 days).
- **Laptop (1280):** Top bar logo left, and the 640 column.
- **Parts:**
  - Hero panel (the float shadow).
  - Pill.
  - The ask panel **loses its accent border**: in production it holds no button, so the green points at nothing.
- **Copy:** verbatim. wait-r1 and wait-r2 read these strings; keep "14 days" bold inside one element.
- **Must not change:**
  - wait-r1: no page, photo or clips is promised.
  - The number stays masked, and it is not shown while the text waits (L25).
  - The dev link never renders in production.
- **Done when:**
  - wait-r1 and wait-r2 pass.
  - No accent border in production.
  - The hero carries `--shadow-float`.

### /privacy/family  ·  anyone (the child's policy; shown in the approval flow)  ·  size S
- **Source:** `app/privacy/family/page.tsx`, `app/legal/legal-page.tsx` (renderLegal, LEGAL_CSS), `components/quiet-shell.tsx`.
- **States:** the one page.
- **Phone (390):** the **Quiet shell** as A specifies (Top bar, logo right), `.reading`, then the document.
- **Laptop (1280):** Top bar logo left, and the 640 column.
- **Parts:**
  - Moves with A's quiet-shell change (PitchWordmark is deleted: it put the logo top left on a phone).
  - One edit in `LEGAL_CSS`: `.legal-doc h1 { letter-spacing: -.02em }` becomes `-0.015em`, because −0.02em is not one of the five. This moves `/privacy`, `/terms` and `/conduct` together. Whoever owns those takes it with theirs.
- **Copy:** the document, unchanged.
- **Must not change:** leg-r1…r7, g32-r2. The version line stays under the title.
- **Done when:**
  - The logo is top right at 390 and top left at 1280.
  - No letter-spacing outside the five values.
  - The legal suites pass.

## New shared parts (class, exact CSS, where used)

```css
/* THE ANSWER PAIR. Yes and No: the same button, the same size. Stacked on a phone,
   two-up from 1024. A long club name wraps inside its button instead of being cut;
   the button stays 46px unless a label needs a second line. */
.fl-answer { display: grid; grid-template-columns: 1fr; gap: 10px; }
@media (min-width: 1024px) { .fl-answer { grid-template-columns: 1fr 1fr; align-items: stretch; } }
.fl-answer > form { display: flex; margin: 0; }
.fl-answer .btn { white-space: normal; height: auto; min-height: 46px; padding: 10px 16px; text-align: center; line-height: 1.25; }

/* THE ASK HEAD. The child's tile, then who is asking (purple: a state, waiting on you). */
.ask { display: flex; flex-direction: column; gap: 8px; }
.ask-who { display: flex; align-items: center; gap: 12px; }
.who-tile { width: 52px; height: 52px; border-radius: var(--r-card); background: var(--surface-2); border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 900; color: var(--secondary); flex-shrink: 0; }
.kick-p { font-size: 11px; font-weight: 800; letter-spacing: var(--ls-caps); text-transform: uppercase; color: var(--purple); line-height: 1.4; }
@media (min-width: 640px) { .door .who-tile { background: var(--surface-hover); } }

/* THE DANGER SECONDARY. The charter secondary in the red state; not a third button. */
.btn-secondary.is-danger { background: transparent; border-color: var(--red); color: var(--red); font-weight: 800; }
```

- **`.fl-answer`** is used on the card, send, interest, pending and invite pages, on `/a/[id]` (state 4, where cell 2 is a well), and in SquadCard. SquadCard is shared with the player's own screens, so the player group moves with it.
  - The two-up breakpoint is 1024 and not 640 on purpose. At 640–1023 the door's content is 504px, so each cell would be 247px, and "Approve and send to Riverside FC" doesn't fit on one line.
  - `white-space: normal` and `height: auto` are a stretch of the charter's fixed 46px, and only when a label is longer than its cell. The alternative is truncating a club's name on a consent button, which must never happen.
- **`.who-tile`** is the done page's existing 52px tile, lifted into a class. It is used on every answer screen, done, and controls (at 48px there, as built).
- **`.is-danger`** is used for Delete on controls. Any other group's destructive button can use it.

## New copy for BUZ (current line → proposed line, why)

**Approved words in a new place** (not new, listed so copy check sees them):
- **PD-4, `/a/*` dead link:**
  - "This link doesn't open anything";
  - "It may have been switched off, it may have expired, or it may never have been a link at all. We don't say which.";
  - "That is deliberate. If we told you which, anyone could use a wrong link to find out whether a particular child is on Pitch. The answer is the same either way." (all from LinkState);
  - "Go to the start" (the failure path).
- **PD-1, the invite reply form:** "Not this time" beside the submit (from the same page's first screen).

**Lines that are wrong today** (the mockup uses them verbatim):

| # | Where | Current | Proposed | Why |
|---|---|---|---|---|
| F1 | /g/pending, tick 2 | "You can edit the words before you approve them." | Remove it while "Edit the words first" has no destination (PD-2). Restore it when editing is built. | It promises a control that doesn't exist. |
| F2 | /g/pending, approved state | "{name}'s page is approved" / "Clubs holding the link now read this version." | Render this state only after `?done=1`. With no change waiting, show the Page title "Nothing waiting on you" (**new line**). | Today it renders whenever nothing is pending, including when nothing was ever approved. |
| F3 | /g/interest, sent | "…from the Manage page." | "…from Your family." (**new**; or "from {name}'s controls") | There is no page called Manage. The control is "Take off this register" on the controls page. |
| F4 | /g/invite, the well | "…It closes this one invitation, and the club is simply not told." | "…Nothing is sent, and the club is simply not told." (**new**) | "Not this time" is a link to /home. It writes nothing and closes nothing (D-138 says exactly that). |
| F5 | /g/invite, guardian of an 18+ | "{name} can see this too. Nothing goes back to {club} until you approve a reply." | "{name} can see this too. Only {name} can reply." (**new**) | This parent cannot approve or reply (L9). |
| F6 | root 404, reached from `/a/*` after approving | "…or what was here may have been taken down." | Fixed by PD-4 (approved words, no new line). | A parent reads "taken down" about their child's page minutes after saying yes. |

## Product decisions for BUZ (not look; behaviour, numbers, doors)

> **1 Oct, John + BUZ:** PD-3 is cleared with conditions. The child's line for both endings is "This request has closed. You can ask again whenever you like."; the event is `purged` with reason `ended_by_recipient`; record the channel and the time; no message. See README, "John's rulings".

| # | Decision | What it buys | What it costs | Recommendation |
|---|---|---|---|---|
| **PD-0** | **Consent answers carry equal weight.** Yes is `.btn-secondary`, never the glowing primary, wherever a press gives something away. This departs from the signed designs (ParentApprovalV2, SendCVGuardian, InterestGuardian, ReapproveChanges, ShareApproval, GuardianReply), which draw Yes as the green primary; the source gives no other reason for it. | A stranger parent sees two answers, not one answer and a footnote. A product whose promise is "nothing happens until you say so" doesn't lean on the yes. | A consent press may convert a little less readily, and nothing measures it (no analytics on these pages, by design). | **Yes** |
| **PD-1** | **"Not this one" and "Not this time" become real links to `/home` (Your family)** on card, send, interest and pending (today a plain `div` that does nothing), and "Not this time" is added beside the reply-form submit. No state is written: the link goes where the page's own back link and silence already go (D-138; doc 15 §25: "the button and the silence must lead to the same place"). | No is a working control, as easy as Yes. It also removes four fake controls. | About 1 hour. One new `href` per page. The write suites locate forms by field, so **the No must be an `<a>`, not a form.** | **Yes.** Without it, equal weight can't be built: a `div` drawn as a button is a lie in a control. The fallback draws "Not this one" as plain muted text, not as a button. |
| **PD-2** | **Remove the three drawn buttons with no destination until they are built:** "Edit the words first" (pending), "Change the address" (send), "Edit what {name} wrote" (interest). | No dead controls on consent screens. BUZ made the same call for /join on 1 Oct and for "Send the text again" on /join/waiting. | It removes approved words from the screen, and F1 follows. | **Yes** |
| **PD-3** | **A real "No" on `/a/[id]`:** after one channel is confirmed, "Not now" ends the request at once (purges the pending invitation, and the child is told only that it expired, as today). | A wrong-number stranger, or a parent who says no, ends it now instead of leaving a child's name and date of birth for 14 days. | It is new behaviour on the consent spine, so it goes to John first. It needs a new consent event, a new message decision, and render and permission tests. About 1 day once ruled. | **Take it to John; not in this build.** Until then, the no-answer is the equal-size well. |
| **PD-4** | **A finished or unknown `/a/*` link renders LinkState's approved words** (no request-access form) at 200, identical for approved, held, purged and never-existed, instead of the root 404. | A parent who approved and opens the other link isn't told their child's page "may have been taken down". It still answers every cause the same (D-77's rule applied to approval links). | About 1 hour: a `FinishedLink` render in place of `notFound()` on `/a/[id]` and `/a/[id]/done`. r20b only checks `<500`. Needs a render check that the four bodies are byte-identical. | **Yes** |

Not proposed, and nothing drawn:
- a club crest on the invite or interest club tile (new content; D-172 questions for an unclaimed destination);
- a "who is asking" line naming Pitch on `/a` (new copy; the message the parent came from already says so);
- a two-column laptop layout for controls (a new width; D-173 keeps reading surfaces at 640).

## Build order and dependencies (which pages move with the base pass alone)

1. **With A's base pass alone** (no page edit): every `.card` spread gets the Floodlit panel; the root 404 (dead links on every page here) becomes the Failure shell; `/privacy/family` gets the Quiet shell's Top bar; controls gets the Frame, Rail, Seat bar and "you are here".
2. **`.fl-answer`, `.ask`/`.who-tile`/`.kick-p`, and `.is-danger`** go in globals.css (a `PARENT (D, 1 Oct)` block after A's `SHELLS`).
3. **The five answer screens together**, because they are one pattern: send → interest → card → pending → invite (with the `.opt` fix). This needs PD-0; PD-1 and PD-2 land in the same change if approved.
4. **`/a/[id]`**: the ask head, the promise panel, the split footnote and the `.fl-answer` with its well. PD-4 is separate and small.
5. **Controls**: section headings, charter buttons, `is-danger`, and the SquadCard pair (coordinate with the player group, since SquadCard renders on `/build`).
6. **done, waiting, privacy**: small, in any order.

Each screen goes through the full suites on a fresh seed, with before and after screenshots at 390 and 1280.

## Risks and suites likely to move (render/layout/perm tests that assert on classes or text)
- **Write suite, form lookup by field:**
  - `forms(html).find(f => 'requestId' in f.fields)` (send, interest);
  - `formOn(html, f => 'invitationId' in f.fields)` (invite, SquadCard with `answer`);
  - pending by `recordId`;
  - controls by `tokenId`, `childId` and `paused`.

  **Any No drawn as a form with the same field would be picked first.** PD-1's No is an `<a>`. SquadCard's No is already its own form with `answer=no`: keep its field order.
- **Render suite, text:**
  - w20/w20b (`Yes, it` and no "Approve this page" before both channels);
  - t16g ("Are you …'s parent?", "Confirm I'm their parent");
  - g32-r1 ("The privacy policy we wrote for Mila" plus `class="legal-doc"`);
  - leg-r1 (`<div class="legal-doc"…></div><style>`: **keep LegalBody's markup exactly**, and put the `.pol-well` class on a wrapper, not on the legal-doc div);
  - sc-r10 ("Send it to Quarrymead United");
  - wait-r1/r2.
- **Render suite, classes:** fp2 asserts `<a href="/home" class="btn btn-primary">` on the 404. A's failure shell adds `fl-glow`, which breaks this exact regex; that is A's to update. PD-4's page must keep the same anchor if it reuses the failure path.
- **The layout check** walks `/g/pending/<deniz>`. The answer buttons are ≥46px, and `.fl-answer .btn` must not fall under 44px when wrapped.
- **Permission suite:** no query changes. PD-3 alone would add tests (for John).
- **palette-check:** no new colour values. `rgba(61,220,132,.14)` is the existing selected tint (the join panel's `.choice.on`).
