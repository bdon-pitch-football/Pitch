# A — Shells and homes: build spec

**Seat:** design-proposal, for the Head of Product Design, then Leo's build team. **Date:** 1 Oct 2026. **Branch:** design/player-cv (nothing committed).
**Mockups:** `docs/design/mockups/floodlit-shells.html` (every shell part, 390 and 1280, same markup) and `docs/design/mockups/floodlit-homes.html` (/home for every seat, every state).

## Summary

- **What changes:** Floodlit (D-173) is applied to the building blocks, not to pages: the seat bar, the rail and console sidebar, the page header, the panel (`.card`), the hero panel, the stat, the pill, the list row, the empty tile, the table, the quiet shell and the failure shell. `/home` is then rebuilt on those parts for all eight seats.
- **What it fixes:** at 1024px and up the logo moves to the top of the rail (top left, D-173 (3)) instead of floating top right of a column. "Where you are" stops being green (green is an action, D-173 (4)). Every panel gets the card shadow from a token, so all 74 pages lift at once. Each home gets one glowing primary, so a stranger can see what the screen is for and what to do next.
- **Size:** the base pass is **M** (about 2 days: roughly 160 lines of CSS, and 7 components edited). The homes are **L** (about 2 days: one page file, no query changes).

---

## Shell parts

**Read this section first.** Groups C to J design inside these parts and refer to them **by the bold name**. Every value below is exact. The CSS goes in `app/globals.css`, in a new block called `SHELLS (A, 1 Oct)` placed directly after `THE PLAYER CARD`, unless a line says it edits an existing rule.

### Three new tokens (they name values FLOODLIT already uses)

```css
:root {
  --glass:      rgba(11,18,14,.72);   /* the nav bar's glass — .fl-nav already uses this value */
  --glass-line: rgba(255,255,255,.06); /* the nav bar's bottom hairline — .fl-nav already uses this value */
  --here:       rgba(255,255,255,.08); /* "you are here": the current door, never an action */
}
```

Then point `.fl-nav` at `var(--glass)` and `var(--glass-line)`. The nav bar looks exactly the same; the values just get names. None of these tokens has a `lib/palette.ts` twin (as with `--surface-hover`), so `palette-check` does not move.

### 1. Frame

This is `Frame` in `components/console-shell.tsx`, with `.console-frame` and `.seat-frame`.

- The geometry is unchanged. On a phone it is one column. From 1024px it is a 232px **rail** plus content, max 1200px (D-147, amended 16 Sep and 28 Sep).
- **Change:** every seat's frame paints `.floodlight`, so it is no longer a prop. The club frame was the only one that could render without it. `ClubConsole`'s `floodlight` prop becomes a no-op (keep the prop until the callers are cleaned up).

### 2. Seat bar (phone, below 1024px)

This is `.seat-tabs` and `.seat-tab`. It keeps the same doors, the same ≤4 rule (three doors plus More), and the same `aria-current` behaviour.

- **Change 1:** it takes the nav bar's glass, so the top bar and the bottom bar are one material.
- **Change 2:** the current door is **ink with a pill behind the icon**, not green. Green is an action (D-173 (4)), and "you are here" is a state.

```css
/* edits .seat-tabs */
.seat-tabs { background: var(--glass); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); border-top: 1px solid var(--glass-line); }
/* edits .seat-tab: gap 5px -> 4px, everything else as is */
.seat-tab { gap: 4px; }
/* new: the icon sits in a 52x28 pill slot */
.seat-tab-ic { display: flex; align-items: center; justify-content: center; width: 52px; height: 28px; border-radius: var(--r-pill); transition: background .16s var(--ease); }
/* edits the two current-state rules: accent -> ink */
.seat-tab[aria-current="page"], .seat-tab[data-current="true"] { color: var(--ink); font-weight: 800; }
.seat-tab[aria-current="page"] .seat-tab-ic, .seat-tab[data-current="true"] .seat-tab-ic { background: var(--here); }
```

- **Markup:** in `Frame`, wrap each bar glyph in `<span className="seat-tab-ic">`.
- **`Glyph`:** when `on` is true, the stroke becomes `var(--ink)`, not `var(--accent)`, in the bar, the rail and the sheet.

### 3. More sheet

This is `.seat-sheet`: the rest of a seat's doors, plus **Sign out**. It is still a `<details>` and still works with no JavaScript.

```css
/* edits .seat-sheet: the literal shadow goes (tokens only, D-173 (1)) */
.seat-sheet { background: var(--fl-surface); box-shadow: var(--shadow-float); }
.seat-sheet-link[aria-current="page"] { background: var(--here); color: var(--ink); box-shadow: none; }
.seat-sheet-link:hover { background: var(--here); }
```

### 4. Rail (player and parent seats) and console sidebar (club, coach and operator seats)

These are **one component** (`Frame`'s `.console-nav`) with **one stylesheet**. They are named separately only because the sidebar's head carries the club and its door counts.

From 1024px the rail gains the **rail mark**: the logo, top left (D-173 (3)). It sits above the **seat card**.

```css
/* edits .console-nav inside the >=1024 block */
.console-nav { padding: 18px 14px 22px 18px; background: var(--glass); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); border-right: 1px solid var(--glass-line); }
/* new */
.rail-mark { display: flex; align-items: center; min-height: 44px; padding: 0 10px; margin-bottom: 10px; }
.seat-card { display: flex; flex-direction: column; gap: 10px; padding: 14px 12px; margin: 0 0 14px 0; border-radius: var(--r-card); background: var(--fl-surface); border: 1px solid var(--line); box-shadow: var(--shadow-card); }
.seat-card-id { display: flex; align-items: center; gap: 11px; min-width: 0; }
.seat-card-name { font-size: 14.5px; font-weight: 900; line-height: 1.25; }
.seat-card-role { font-size: 12px; font-weight: 500; color: var(--muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* edits the current door: no accent bar */
.console-nav-link[aria-current="page"] { background: var(--here); color: var(--ink); box-shadow: none; }
.console-nav-link:hover { background: var(--here); color: var(--ink); }
```

- **Markup:**
  - In `Frame`, the rail becomes `<nav class="console-nav">` → `<div class="rail-mark"><Wordmark size={20} /></div>` → `<div class="seat-card">{head}</div>` → the doors → Sign out.
  - The rail mark is **not a link**. HeaderMark's mark isn't one today, and a link to `/` would be a new door.
  - Each seat's `head` (in `ClubConsole`, `CoachConsole`, `OpsConsole`, `playerFrame` and `guardianFrame`) moves its inline styles onto `.seat-card-id`, `.seat-card-name` and `.seat-card-role`. The words and the conditions stay the same.
- **Club seat card:** the crest tile (40px, `var(--r-well)`), the club name, then "Technical Director" or "Club administrator", then the **state line**.
  - The state line keeps its words: "Verified club", in accent with a dot; or "Awaiting verification — registrations are held", in amber with a dot.
  - The state line is drawn as a **pill** (part 12): `pill-live` for verified, `pill-wait` for awaiting. The long amber line wraps inside a pill with `height: auto; padding: 5px 10px; white-space: normal; line-height: 1.35`, as the modifier `.pill-wrap`.
- **Door counts** (`.console-nav-count`) are unchanged. They are never zero (D-162).
- **Sign out** stays last, pushed to the foot (`margin-top: auto`).

### 5. Top bar (pages with no frame)

This is `components/floodlit/SiteNav.tsx` with `links={[]}` and `signIn={false}`: the logo-only bar. On a phone the logo is on the right; from 1024px it is on the left.

**Every page that renders outside a seat frame** uses it:
- the quiet shell and the failure shell;
- the signed-out and brand-new `/home`;
- `Plain` in `player-shell.tsx`;
- the no-seat branches of `ClubConsole` and `CoachConsole`;
- the unframed flows (`/g/*` apart from controls, `/a/*`, `/confirm`, `/reset`, `/report` …) that other groups own.

- **Mechanism:** the wrapper that renders the top bar also adds `.has-topbar` to its root. That hides the page's own in-column mark at every width, so no page shows two logos:

```css
.has-topbar .pg-head-mark { display: none; }
.has-topbar .pg-head:not(:has(.pg-back)) { display: none; }
```

- **Back in a flow:** the page's own **page header** keeps the back link at every width, in the column. SiteNav's `back` prop is **not** used for signed-in flows, because SiteNav hides it from 1024px, which would make it a phone-only control (D-147). This matches the `.page-back` note in the approved trials/join proposal.

### 6. Page header

This is `HeaderMark` in `components/Wordmark.tsx`: the back link on the left, the mark on the right. It is used by 47 files, and this is the change that moves most of them.

```css
.pg-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 24px; }
.pg-back { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; margin: -10px 0; padding-right: 8px; font-size: 13px; font-weight: 700; color: var(--muted); text-decoration: none; }
.pg-back:hover { color: var(--ink); }
@media (min-width: 1024px) {
  /* The rail carries the mark, top left (D-173). The column's copy goes. */
  .console-frame .pg-head-mark { display: none; }
  .console-frame .pg-head:not(:has(.pg-back)) { display: none; }
}
```

- **Markup:** `HeaderMark` renders `<div className="pg-head">{back ? <a className="pg-back" …> : <span />}<span className="pg-head-mark"><Wordmark size={20} /></span></div>`. The inline styles move to the classes; the values are identical.
- On a phone nothing moves: back on the left, the logo top right.

### 7. Page title

This is the h1 and the line under it that open a reading page. Today it is written inline on about 40 pages at the same values.

```css
.pg-titles { display: flex; flex-direction: column; gap: 6px; }
.pg-title  { font-size: 26px; font-weight: 900; letter-spacing: var(--ls-title); line-height: 1.15; }
.pg-sub    { font-size: 14px; font-weight: 500; color: var(--secondary); line-height: 1.55; }
```

The console title stays `OpsHeader` (17px, the signed operator design), unchanged.

### 8. Section heading and panel heading

- **Section heading** (`.sec-h`) sits **on the page** above a group of panels. It is the CV's `.cv-h2`, reused under a shared name: the label, then a hairline running to the edge.
- **Panel heading** (`.panel-h`) sits **inside a panel**, with no hairline. It is today's `sectionLabel` from `lib/ui.ts`, with the same values.

```css
.sec-h   { display: flex; align-items: center; gap: 12px; margin: 0; font-size: 11px; font-weight: 800; letter-spacing: var(--ls-caps); text-transform: uppercase; color: var(--muted); }
.sec-h::after { content: ''; flex: 1; height: 1px; background: var(--line); }
.panel-h { margin: 0; font-size: 11px; font-weight: 800; letter-spacing: var(--ls-caps); text-transform: uppercase; color: var(--muted); }
```

`lib/ui.ts` keeps `sectionLabel` as the inline twin of `.panel-h`, and gains no new export.

### 9. Panel

This is `.card`, and `card` in `lib/ui.ts`. **This one change lifts every signed-in screen.** It is the Floodlit card: the same radius and padding, the gradient surface and the card shadow.

```css
/* edits .card */
.card { background: var(--fl-surface); border: 1px solid var(--line); border-radius: var(--r-card); padding: var(--card-pad); box-shadow: var(--shadow-card); }
/* a panel inside a panel steps UP one surface and carries no second shadow (action goes up) */
.card .card { background: var(--surface-2); box-shadow: none; }
/* edits .lift:hover: the literal shadow becomes the token */
.lift:hover { box-shadow: var(--shadow-float); }
```

```ts
// lib/ui.ts
export const card: CSSProperties = { background: 'var(--fl-surface)', border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', boxShadow: 'var(--shadow-card)' };
```

- `.fl-card` stays as the approved public-page class. `.card` now looks the same with padding included, so a group may use either.
- **Panel list** (`.card.rows`) is a panel with `padding: 0` that holds **list rows** (part 13).

### 10. Well

This is `.card-sunken`, and it is unchanged: `--surface-sunken`, a hairline, **no shadow**. It is for text you read: explanations, notes, the "why".

Disclosure goes down; action goes up (28 Sep). A well never gets the card shadow.

### 11. Notice

A **panel** with a state edge, for something that is waiting, held or needs you. The existing `.card-accent` and `.card-amber` stay; two tones are added. Amber, purple and red are states only (D-173 (4)).

```css
.card-purple { border-color: var(--purple); }
.card-red    { border-color: var(--red); }
.notice-k    { display: flex; align-items: center; gap: 7px; font-size: 10.5px; font-weight: 800; letter-spacing: var(--ls-caps); text-transform: uppercase; }
.notice-k::before { content: ''; width: 8px; height: 8px; border-radius: 999px; background: currentColor; flex-shrink: 0; }
```

- **Which tone.** Purple is a club's invitation (the register's own "Invited"). Amber is anything else waiting on you, held or needing you. Red is stopped or failed. **Green never marks a waiting state.** On /home this moves the parent's send, edit and squad-invitation items from accent to amber, and the interest request from purple to amber.
- The **lead notice** is the one thing to do next. It adds `.fl-float`, which gives it the lifted shadow.
- A lead notice's button is the screen's one glowing primary.

### 12. Pill

A status fact, **never a control** (it is not tappable, so the 44px rule does not apply). It replaces the hand-built "Live" and "Not sent yet" badges on `/home`, and `.tag` (whose 7px radius is not a charter radius) now aliases it.

```css
.pill { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: var(--r-pill); font-size: 9.5px; font-weight: 800; letter-spacing: var(--ls-label); text-transform: uppercase; white-space: nowrap; background: rgba(255,255,255,.1); color: var(--secondary); flex-shrink: 0; }
.pill::before { content: ''; width: 6px; height: 6px; border-radius: 999px; background: currentColor; flex-shrink: 0; }
.pill-live  { background: rgba(61,220,132,.16);  color: var(--accent); }
.pill-wait  { background: rgba(237,161,0,.16);   color: var(--amber); }
.pill-guard { background: rgba(171,135,224,.16); color: var(--purple); }
.pill-stop  { background: rgba(227,119,118,.16); color: var(--red); }
.pill-wrap  { height: auto; padding: 5px 10px; white-space: normal; line-height: 1.35; text-transform: none; letter-spacing: 0; font-size: 11px; }
/* edits .tag: pill radius */
.tag { border-radius: var(--r-pill); }
```

`.pill-wrap` is only for a sentence-long state (the club seat card's "Awaiting verification — registrations are held"). It keeps that line's current 11px/800 with no tracking.

### 13. List row and step row

- **List row** (`.row`) is one tappable line: a title, one quiet line under it, and a trailing end. The end is either the approved accent word ("Open", "Start") or a chevron.
- **Step row** (`.row-step`) is the 44px to-do well inside a panel ("Add a profile photo" and the like).

```css
.row { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 12px 14px; color: var(--ink); text-decoration: none; }
.rows > .row + .row { border-top: 1px solid var(--line); }
.rows > .row:hover { background: rgba(255,255,255,.04); }
.card.rows { padding: 0; overflow: hidden; }
.row-ic { width: 36px; height: 36px; border-radius: var(--r-well); background: var(--surface-2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.row-t { font-size: 14.5px; font-weight: 800; color: var(--ink); line-height: 1.3; }
.row-s { font-size: 12.5px; font-weight: 500; color: var(--muted); line-height: 1.45; }
.row-end { flex-shrink: 0; font-size: 12.5px; font-weight: 800; color: var(--accent); }
.row-chev { flex-shrink: 0; color: var(--muted); }
.row-step { display: flex; align-items: center; gap: 11px; min-height: 44px; padding: 0 12px; border-radius: var(--r-well); background: var(--surface-2); color: var(--ink); text-decoration: none; font-size: 13.5px; font-weight: 700; }
.row-step:hover { background: var(--surface-hover); }
```

- A single row can be its own panel: `class="card row"`, with the panel padding replaced by the row's.
- A **door list** is a `.card.rows.doors` whose rows carry a `.row-ic` stroke glyph, using the same `ICONS` as the rail, with `.doors .row-t { font-size: 14px; font-weight: 700; }` (the rail's own weight). It replaces every centred grey "menu card" (`...card, textAlign: 'center'`).
- **Two new stroke glyphs** in `ICONS`, for the player's door list: `clip` (`<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3Z"/>`) and `star` (`<path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6Z"/>`).

### 14. Hero panel

The seat's identity panel at the top of a home: `var(--hero)`, the 22px hero radius, and now the **floating shadow**.

```css
.hero-panel { position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 14px; padding: 18px 16px; border-radius: var(--r-hero); background: var(--hero); box-shadow: var(--shadow-float); }
@media (min-width: 1024px) { .hero-panel { padding: 24px 24px 22px; } }
.hero-id { display: flex; align-items: center; gap: 13px; min-width: 0; }
.hero-av { width: 52px; height: 52px; border-radius: var(--r-card); flex-shrink: 0; background: rgba(255,255,255,.12); border: 1.5px solid rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 900; object-fit: cover; }
.hero-h  { font-size: 21px; font-weight: 900; letter-spacing: var(--ls-title); line-height: 1.15; margin: 0; }
.hero-m  { font-size: 12.5px; font-weight: 500; color: rgba(255,255,255,.7); margin-top: 3px; }
.hero-well { background: rgba(11,18,14,.5); border: 1px solid var(--line); border-radius: var(--r-well); padding: 10px 10px 10px 13px; display: flex; align-items: center; gap: 10px; min-width: 0; }
```

- `.sheen` stays on the hero, as today.
- **Player-card variant:** the player's hero also carries the CV's ghost squad numeral, `.cv-num` from THE PLAYER CARD, reused exactly (same size, same stroke, `aria-hidden`). It renders only when there is a squad number. It is decoration, not a new type size: it is the approved card's own element.

### 15. Stat and stat row

A display numeral over a label. Omitted at zero, never shown as a 0 (D-162).

- **The numeral is the existing `class="numeral numeral-l|m|s"`, and its class string must not change.** The render suite finds zeros by that exact string (ah12, and the D-162 sweep), so a new class on the numeral would silently switch those checks off.
- The label is the new `.stat-l`, which replaces `className="kicker"` plus the inline colour.

```css
.stat-row { display: flex; align-items: flex-end; gap: 26px; flex-wrap: wrap; }
.stat-l { margin-top: 4px; font-size: 11px; font-weight: 800; letter-spacing: var(--ls-caps); text-transform: uppercase; color: var(--muted); }
.hero-panel .stat-l { color: rgba(255,255,255,.65); }
```

- Numerals are ink. This changes two: the parent's "Club registers" and the administrator's "Trials live" were accent (green is an action), and the administrator's "Coaching roles open" was secondary.
- A numeral takes a state colour only when the number **is** that state. These are the register's own status colours, unchanged:
  - New: `--accent`;
  - Shortlisted: `--amber`;
  - Invited: `--purple`;
  - Expiring in 30 days: `--amber`.
- The hero label moves from `.55` to `.65` alpha. Computed against the hero's lightest stop (`#24543c`), `.55` is 3.88:1, which is under AA for 11px caps; `.62` is 4.48:1, just under; `.65` is 4.75:1. (Against the darker stops the labels usually sit on, `.55` already passes. This covers the worst case.)

### 16. Empty tile

**Dashed means "not yet"** (it is the unclaimed crest's language, from the approved trials/claim proposal). It is never an illustration and never an apology.

```css
.empty-tile { border: 1.5px dashed rgba(255,255,255,.3); border-radius: var(--r-well); background: rgba(255,255,255,.04); flex-shrink: 0; }
.empty { display: flex; align-items: flex-start; gap: 14px; padding: 16px 14px; }
.empty > .empty-tile { width: 46px; height: 54px; }
.empty-t { display: block; font-size: 14.5px; font-weight: 800; color: var(--ink); margin-bottom: 3px; }
.empty-b { font-size: 12.5px; font-weight: 500; color: var(--secondary); line-height: 1.55; }
```

The empty state sits in a **panel**: `class="card empty"`. The first sentence is `.empty-t` and the rest is `.empty-b`, **inside one element**, so a suite reading one string still does.

### 17. Table

This is `.ops-table`, `.console-row`, `.console-head` and `.console-row-hover`. The same columns, breakpoints and minimums as today (the 768 and 1024 widths are measured and stay).

```css
/* edits .ops-table */
.ops-table { background: var(--fl-surface); box-shadow: var(--shadow-card); }
/* edits (>=768) */
.console-row-hover:hover { background: rgba(255,255,255,.04); }
.console-head { background: var(--fl-surface); }
```

- A register or people list that wraps its rows in `.card` gets the panel from part 9 for free.
- `.console-btn` (44px) is **unchanged** and still flagged. It was declared in 23 Sep's chrome proposal (D-c1) and never ratified; it is not this spec's to settle.

### 18. Buttons, and the one glow

The charter's two buttons are unchanged, as is `.btn-ghost` (the 44px "way out", flagged since 16 Sep).

- **The one rule:** `.fl-glow` goes on the **first `.btn-primary` in reading order** on the screen, and on no other.
  - Reading order is the 390 order, so the phone and the laptop agree.
  - A screen whose only primary is unavailable has no glow.
- One addition, from the approved mockups: `.btn-auto { width: auto; padding: 0 22px; }` for a button that sits inline on a laptop row. It is a width, not a third button.

### 19. Field

This is `.field`, and it is unchanged on the page. Two additions come from the approved join/claim proposal:

```css
.field[aria-invalid="true"] { border-color: var(--amber); }
@media (min-width: 640px) { .door .field { background: var(--surface-hover); } .door .card, .door .card-sunken { background: var(--surface-2); box-shadow: none; } }
```

### 20. Door panel

This is `.door`, from the approved trials/join proposal. It is the rule "a form is a door".

```css
.door { width: 100%; max-width: 560px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
@media (min-width: 640px)  { .door { margin-top: 28px; padding: 28px 28px 30px; background: var(--fl-surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow-float); } }
@media (min-width: 1024px) { .door { max-width: 640px; margin-top: 48px; padding: 34px 36px 36px; } }
```

- On a phone there is no panel: the 390 artboard is the column as drawn.
- A **list is a page**: a list never goes inside a door.

### 21. Quiet shell

This is `components/quiet-shell.tsx` (/unsubscribe, /manage, /stop-cvs, /privacy, /terms). It becomes **Top bar** + `.reading` column.

- **Widths:** the 460px default and the 640px `wide` stay as they are. A new `door` prop wraps the children in **door panel** for the three form pages.
- `PitchWordmark` is **deleted**: it put the logo **top left on a phone**, which reverses D-173 (3). The top bar carries the logo.
- The four pages drop their `<PitchWordmark />` line. That is the only edit in them.

```tsx
export function QuietShell({ children, wide, door }: { children: ReactNode; wide?: boolean; door?: boolean }) {
  return (
    <div className="floodlight has-topbar" style={{ minHeight: '100dvh', color: 'var(--ink)' }}>
      <SiteNav links={[]} signIn={false} />
      <main className="reading" style={{ maxWidth: wide ? undefined : 460, padding: '28px 18px 48px', boxSizing: 'border-box' }}>
        <div className={door ? 'door' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
      </main>
    </div>
  );
}
```

### 22. Failure shell

This is `components/FailureState.tsx`, and it is still one shell with no branch (the property that matters). The layout becomes:
1. **Top bar**;
2. the `.reading` column;
3. the glyph tile;
4. **page title** (heading plus reason as `.pg-sub`);
5. **well** (the why);
6. the way out.

- **Change 1:** the glyph tile's radius goes from 18 to `var(--r-card)`. 18 is not a charter radius.
- **Change 2:** the way-out button carries `.fl-glow`: it is the screen's one primary.
- `data-failure` stays on the root. The words are unchanged (they are still "awaiting BUZ", as its header says).

### 23. Home grid

This is `.player-grid`, renamed `.home-grid`. **Keep `.player-grid` as an alias**, because tests select it.

- **Phone:** one column, in the 390 order.
- **From 1024px:** main plus a 320px aside, gap 18px. The values are unchanged.
- **The parent's home joins it.** Today it is the one home in a 640px reading column. See Pages.

### 24. The gallery (`app/design/page.tsx`)

It is rebuilt as the **Floodlit** gallery: every part above, by its bold name, in the same order as this list. A row shows the part at 390 and at 1024+ side by side, using container queries (as the mockups do). It stays development-only (`notFound()` in production). The gallery's words are not user-facing, so they need no copy check.

### What the base pass alone moves, and what it can't

**Moves with the CSS and seven component edits, and nothing else:**
- every `.card` and every `...card` spread (50 files) gets the Floodlit surface and shadow;
- every framed page gets the new bar, rail, rail mark and "you are here" state;
- every `HeaderMark` page drops its duplicate mark at ≥1024 inside a frame;
- every `.ops-table` and every console head;
- the quiet shell and the failure shell;
- `.tag` becomes a pill.

**Can't be fixed by the base pass. Each needs a page edit, owned by that page's group:**
1. **Hand-built surfaces.** A `div` with `background: T.surface` and its own border, instead of `.card` or `card`. Grep `background: T.surface` and `background: 'var(--surface)'`.
2. **Off-charter radii.** 18px is used in 10 files, including the `/home` waiting queue, the build form and the send page.
3. **The one glow.** It is a class per page (part 18).
4. **Heroes.** Fifteen files paint `var(--hero)` inline; each moves onto **hero panel** to get the shadow.
5. **Unframed flows.** They need **top bar** plus **door panel**.
6. **Inline buttons.** Hand-built buttons that are neither `.btn` nor `.console-btn` (for example the parent home's "Manage": 46px, radius 14, hand-built).
7. **Hand-built badges.** Inline "pills" and badges.
8. **Headings.** `sectionLabel` used above a group of panels, where it should become the **section heading** with a hairline.

## Pages

All eight seats are one file, `app/home/page.tsx`. It renders `WhileYouWereAway`, `SquadCard`, `RegisterReaders`, `RegisterPaused` and `CopyLink`.

**The one idea for every home: three layers.**
1. **Who and where you are.** This is the **hero panel**.
2. **The one thing to do next.** This is the lead **notice**, or the screen's single glowing primary.
3. **Everything else, as quiet rows.** The centred grey menu cards become one **door list**, with the same doors, words and conditions.

The mockup draws every state below at 390 and 1280: `docs/design/mockups/floodlit-homes.html`.

**Rules for every seat:**
- **No query changes.** Every value drawn is one the page already selects.
- **Phone order is unchanged** (the one proposed exception is P1, which is BUZ's call).
- **The page header** is `HeaderMark`. Inside a frame, the mark leaves the column from 1024px.
- **The glow** goes on the first `.btn-primary` in 390 reading order, and on no other.
- **The column:** each framed home keeps `className="console h-rise"` and the **home grid**.
- **The inline `<style>` block in `Shell`** (its `homeRise` keyframes) is deleted. globals.css has carried the same rules since 16 Sep.

### /home · player 18+ · size M

- **Source:** `app/home/page.tsx`, the player branch (`children.length === 0 && me.record_id`). It renders `WhileYouWereAway`, `SquadCard` (`mine`), `RegisterReaders` and `CopyLink`. The frame is `PlayerFrame`.
- **States:**
  - the link is live (hint and expiry), or it has not been sent;
  - a club's invitation, or none;
  - 1–5 of 6 steps done, or all six done;
  - the squad card in each of its four states (no club / waiting on the club / in a squad / a squad invitation) plus its error;
  - a next trial, or none;
  - back after 60 days or more (`fn_note_arrival`), or not;
  - on a register (readers block), or not.
- **Phone (390):**
  1. page header;
  2. While you were away (**well**);
  3. **hero panel**, player-card variant:
     - avatar;
     - "Your page is live" or "Your page";
     - positions and number;
     - the Live or Not sent yet **pill**;
     - the link hint in a **hero well**, or the not-sent line;
  4. the invitation (**notice**, purple, as a **list row** ending "Open");
  5. the page **panel**: **panel heading**, "N of 6 done", bar, up to two **step rows** or "Every part of your page is filled in.", then Preview my page (secondary);
  6. Where you play (**section heading** plus the squad card's panel);
  7. the next trial (a **panel** holding the approved **trial row**, date first);
  8. Send my CV to a club (**primary, glowing**);
  9. **door list**: Build your CV · Trials near you · Highlights · Achievements;
  10. Who has read your registrations.
- **Laptop (1280):** the rail on the left, holding the rail mark and a seat card (Jordan · Marchfield City FC). The **home grid** holds items 2–7 in the main column, and 8–10 in the 320px aside.
- **Parts:** hero panel, `.cv-num`, pill, hero well, notice, list row, panel, step row, section heading, trial row, primary with the glow, door list, well. **No new class** beyond the shell parts.
- **Copy:** all verbatim.
- **The squad card's buttons.** "Leave", "Cancel" and "Not this one" are hand-built 44px outline buttons at an 11px radius: off-charter, and a fourth button style. This spec only moves their radius to `var(--r-well)`. Whether they become `.btn-ghost` belongs with the chrome proposal's open D-c1, not here.
- **Must not change:**
  - `club_status` never reaches the player (D-108, N10): the trial row says only "You are on their register";
  - the link shows the **hint**, never the token (D-80);
  - no paid surface for an under-18 (D-82). This seat has none either way; the two Premium rows live on the builder, not here.
- **Done when:**
  1. at 1280 the rail shows the logo top left, and the column shows no second logo;
  2. exactly one element on the page has `fl-glow`, and it is Send my CV to a club;
  3. the four menu cards are one door list with the same four hrefs and labels, and there is no `text-align:center` left outside the navs;
  4. the ghost numeral renders only when `squad_number` is set;
  5. every number and word matches the seed at 390 and 1280.

### /home · player 16–17 · size S (on top of the 18+ work)

- **Source:** the same branch. `me.band === '16_17'`.
- **States:**
  - **parent confirmed:**
    - Send my CV to a club is the glowing primary;
    - Share my CV is the secondary;
    - the invitation line is "Your parent can see it too." or, for a draft, "Your reply is with your parent to approve.";
    - the readers block shows;
  - **parent not yet confirmed (0048):**
    - the amber **notice** "Waiting on your parent" replaces Send;
    - there is no Send door in the bar or the rail (the frame's `can_send`);
    - **no glow on the screen**: its only primary is unavailable, and the notice itself says "Keep building your page in the meantime".
- **Phone and laptop:** as for 18+.
- **Must not change:**
  - Share my CV is offered only with a confirmed parent (D-101, D-164);
  - the 16–17 send rule (0048);
  - `WhileYouWereAway` and `RegisterReaders` stay the database's to refuse. They render nothing for an under-16, and the page does not decide.
- **Under-16 player with their own login.** This is the same page with Share my CV, and without the readers block or While you were away (the database refuses both). It is drawn by the 16–17 state, so it has no artboard of its own.
- **Done when:**
  1. with `has_guardian = false`, no `/send/` link exists anywhere in the HTML (page, bar, rail), and no `fl-glow` either;
  2. with a guardian, Share my CV is the only secondary directly under Send.

### /home · parent (children in different states) · size M

- **Source:** the guardian branch. It renders `WhileYouWereAway`. The frame is `GuardianFrame`, which gives one door per child up to two, then one Children door.
- **States:**
  - back after 60 days or more;
  - the hero's three counts, each omitted at zero, and the whole hero omitted when all three are zero;
  - the waiting queue: every item, oldest first:
    - a club's trial invitation (or a child's draft reply to it);
    - a send request;
    - a registration request;
    - a pending page edit;
    - a squad invitation (under-18 children only);
  - nothing waiting;
  - one, two, or three or more children;
  - each child: approved only; link live; link expiring in 30 days or fewer; on registers.
- **Phone (390):**
  1. page header;
  2. **page title**: "Your family" plus its line;
  3. While you were away (**well**);
  4. the stats **hero panel** (Links active · Expiring in 30 days, amber · Club registers);
  5. the queue:
     - the first item is the lead **notice**: tone edge, lifted, **primary with the glow**;
     - the rest are **panels** with a secondary button;
     - each opens with the **notice kicker** "Waiting on you" and its age on the right;
  6. Trials near you (**list row**);
  7. Your children (**section heading** plus a **panel** per child). Each child panel has the status rows and **Manage** as a real `.btn .btn-secondary`: 46px, the same word, no longer hand-built.
- **Laptop (1280):** the page title spans the top. The **home grid** puts items 3–6 in the main column and **Your children in the 320px aside**, so what is waiting and who it is about sit side by side.
  - This is the one layout change on this seat. Today the parent's home is the only home in a 640px column beside the rail.
  - The phone order is untouched: the children are last in both.
- **Parts:** page title, well, hero panel, stat row, notice (purple / amber), primary with the glow, list row, section heading, panel, secondary button, home grid. **Nothing new.**
- **Tone change (look only):**
  - a club's trial invitation keeps purple;
  - send, interest, edit and squad-invitation items go **amber**. Today they are accent or purple, and green is an action (D-173 (4)).
  - "Club registers" goes ink.
- **Copy:** verbatim, except N1 and N2 (see New copy).
- **Must not change:**
  - the queue is oldest-first, and only the top item gets the primary;
  - an adult child's squad invitation is never on the list (M3, D-49);
  - "Doing nothing is a complete answer" stays wherever it is said;
  - no count of 0 (D-162);
  - the child's first name is the only identity shown. This is the parent's own screen, and D-89 is not in play.
- **Done when:**
  1. at 1280 the children render in the aside and the queue in the main column; at 390 the order is the source order;
  2. exactly one `fl-glow` (the oldest item), or none when nothing waits;
  3. no queue item uses `--accent` as its tone;
  4. ret-r1b still holds: "While you were away" comes before "Waiting on you";
  5. with three children the bar reads Home · Children · Trials · More.

### /home · coach · size M

- **Source:** the coach branch. It renders `CopyLink` and the `answerCoachInvite` forms. The frame is `CoachConsole`.
- **States:**
  - published (link plus Copy);
  - adult but unpublished;
  - under 18 ("Your coach page can go public once you turn 18.");
  - 0–6 steps done;
  - one or more club invitations, each with Accept / Not now;
  - reading teams, or not;
  - open roles, or none.
- **Phone (390):**
  1. page header;
  2. **hero panel**:
     - photo or initial;
     - "Your coach page";
     - name and club;
     - the public link in a **hero well** with Copy (secondary, auto width), or the not-yet line;
  3. each invitation: a purple **notice**, lifted, with Accept (**primary**) and Not now (secondary) as a pair;
  4. the page **panel** (as the player's);
  5. Registrations for your teams (**list row**, team names as its line);
  6. Edit my coach CV (**primary**);
  7. **door list**: See my public page · Registrations · Coaching roles at clubs, with "N open" as the row end.
- **Laptop:** items 2–5 main, 6–7 aside.
- **Glow:** the first primary in reading order. That is **Accept** when an invitation waits, and **Edit my coach CV** otherwise.
- **Must not change:**
  - the coach's link is copied by the coach and never sent by Pitch (D-100, L44). There is still no recipient field;
  - an under-18 coach cannot publish (0042).
- **Done when:**
  1. with an invitation, `fl-glow` is on Accept only;
  2. no "0 of 6 done" is ever drawn;
  3. the three aside cards are one door list with the same hrefs.

### /home · club technical director (verified) · size M

- **Source:** the club branch, `isTd && verified`. The register counts come from `fn_register_rows`, aggregated in the database. It renders `CopyLink`. The frame is `ClubConsole`.
- **States:**
  - register counts (the numbers row is omitted when the register is empty; each tile is omitted at zero);
  - N new, or none;
  - up to three trials with their interested counts, or none (the "Coming up" empty sentence);
  - a public slug, or none;
  - billing on or off.
- **Phone (390):**
  1. page header;
  2. **hero panel**:
     - crest initial;
     - club name;
     - "Marina · Technical Director";
     - the **pill** "Verified club";
     - **stat row**: On your register (l) · New (accent) · Shortlisted (amber) · Invited (purple);
  3. "N new on the register": a **list row** in a panel with an accent edge, lifted, because it is the action;
  4. Coming up: a **panel** of approved **trial rows** with "N interested", or the **empty tile** with the approved sentence;
  5. the club page link panel with Copy;
  6. Register (**primary, glowing**);
  7. **door list**: Post a trial · Squads · Crest & club page · Coaching roles ("N open") · Your club page · Plan & billing (only while billing is on).
- **Laptop:** items 2–5 main, 6–7 aside.
- **Must not change:**
  - only the TD sees register numbers (D-154), and only when verified (D-126);
  - the counts are totals from the database, never rows;
  - no child's name reaches this page;
  - no price (D-163).
- **Done when:**
  1. the six centred menu cards are gone, replaced by one door list with identical hrefs and labels (render s-checks: the frame's doors are all still on /home);
  2. `fl-glow` is on Register only;
  3. the empty "Coming up" draws the dashed tile, with its sentence as one element.

### /home · club administrator (verified) · size S

- **Source:** the club branch, `!isTd && verified`. Its queries are `admin`, `canDo` (`fn_club_register_readers`) and `plan`. It renders `CopyLink` and `RegisterPaused`.
- **States:**
  - the hero numbers (squads / trials live / roles open, each omitted at zero, and the row omitted when all three are zero);
  - the TD's name, or none;
  - Coming up with trials, or empty;
  - What a family cannot see yet (the crest, the philosophy, both, or absent);
  - the public page, or no slug;
  - Who can do what here;
  - the plan active, in grace or suspended.
- **Phone (390):**
  1. page header;
  2. **hero panel**: crest, name, "Pat · Club administrator", the Verified **pill**, the **stat row** (all ink), and the line "The register is Marina's. You keep the club's page, its squads, its notices.";
  3. Post a trial notice (**primary, glowing**);
  4. Coming up (**panel**, trial rows with no counts, plus the "comes off the board" line), or the **empty tile**;
  5. What a family cannot see yet (a **panel** of **list rows** ending "Add it" / "Write it", plus the footnote);
  6. Your club page (**well**: link, Copy the link and Open it as two secondary buttons at auto width, a hairline, "Public and live…");
  7. Who can do what here (**well**);
  8. Plan;
  9. the payment notice (amber **notice**, `RegisterPaused`).
- **Laptop:** items 2–5 main, 6–9 aside.
- **One restyle:** "Open it" was a 44px, 999-radius outlined link, which is a third button style. It becomes the secondary button, with the same word and href.
- **Must not change:**
  - no registration, no child and no count of children on this screen (D-93, D-154; render ah1b, ah8);
  - the D-93 wall as the database says it (L23);
  - **the Plan block prints a price.** Today it is hidden only because billing is off. See P8.
- **Done when:**
  1. render checks ah1–ah12 pass, with ah3 read as "exactly one `btn-primary`" (see Risks);
  2. Open it is a `.btn-secondary`;
  3. the hero numbers are ink.

### /home · unverified club (held register) · size S

- **Source:** the club branch, `!verified`. Before verification the seat is always an administrator: a TD comes only from the verification call (0058).
- **States:** "N waiting", or "Nobody is waiting yet"; the crest and philosophy missing or present; Who can do what here.
- **Phone (390):**
  1. page header;
  2. **hero panel**:
     - crest, name, "M. · Club administrator";
     - the amber **pill** (`.pill-wrap`) "Awaiting verification — registrations are held";
     - the held count as the hero's one **stat**: the numeral, plus the label "waiting" (the same words as "4 waiting"), or the sentence "Nobody is waiting yet" at zero;
  3. What a family cannot see yet;
  4. Register (**primary, glowing**);
  5. Who can do what here.
- **Laptop:** 2–3 main, 4–5 aside.
- **Must not change:**
  - D-126: a count and nothing else;
  - no Post a trial, no Coming up (only a verified club posts, D-90 and 0152);
  - "Nobody is waiting yet" stays words (D-162).
- **Done when:**
  1. the held number is a `numeral numeral-l` and the only number on the page;
  2. there is no `/club/post-trial` link anywhere, including the bar and the rail.

### /home · brand-new account (nothing yet) and signed out · size S

- **Source:** the no-seat branch and the signed-out branch. Both use the unframed `Shell`.
- **States:**
  - brand-new (Robin Newman);
  - signed out;
  - a session with no person row ("Signed out.").
  - The operator also lands here (see P9).
- **Phone (390):**
  - **top bar** (logo right);
  - **page title**: "Welcome, Robin" plus its line;
  - one **door list** of four rows, each with a glyph, its title, its one-line reason and its approved end word (Start / Open):
    - Build a coach CV;
    - Trials near you;
    - Coaching roles at clubs;
    - Here for a club? Find your club;
  - the grey line (N3);
  - Sign out (ghost).
  - **Signed out:** the top bar, then a **door panel** with "Welcome back", its line and Sign in (**primary, glowing**).
- **Laptop:** the top bar with the logo top left. A 640 reading column, centred (no frame, no rail). The signed-out door panel is lifted from 640px.
- **Glow:** none on the brand-new home: nothing tells us which door is Robin's (P5).
- **Must not change:** no new door; Sign out stays on the screen (it is the one home with no bar, BUZ 28 Sep).
- **Done when:**
  1. the logo is top left at 1280 and top right at 390, and there is one logo;
  2. the four rows are one panel with identical hrefs;
  3. signed out, Sign in is the only primary and it glows.


## New shared parts (class, exact CSS, where used)

Every part is defined with exact CSS under **Shell parts** above. New class names, for the Head of Product Design's reconciliation:

| Part | Classes | Where used |
|---|---|---|
| Tokens | `--glass`, `--glass-line`, `--here` | bar, rail, nav bar, current door |
| Seat bar | `.seat-tab-ic` | every framed page (phone) |
| Rail and console sidebar | `.rail-mark`, `.seat-card`, `.seat-card-id`, `.seat-card-name`, `.seat-card-role` | every framed page (≥1024) |
| Top bar | `.has-topbar` (on the wrapper around SiteNav) | every unframed page |
| Page header | `.pg-head`, `.pg-back`, `.pg-head-mark` | `HeaderMark` (47 files) |
| Page title | `.pg-titles`, `.pg-title`, `.pg-sub` | reading pages |
| Section and panel heading | `.sec-h`, `.panel-h` | everywhere |
| Notice | `.card-purple`, `.card-red`, `.notice-k` | states |
| Pill | `.pill`, `.pill-live`, `.pill-wait`, `.pill-guard`, `.pill-stop`, `.pill-wrap` | status facts; `.tag` aliases it |
| List row, step row, door list | `.row`, `.rows`, `.doors`, `.row-ic`, `.row-main`, `.row-t`, `.row-s`, `.row-end`, `.row-chev`, `.row-step` | rows and doors |
| Hero panel | `.hero-panel`, `.hero-id`, `.hero-av`, `.hero-h`, `.hero-m`, `.hero-well` | homes, and any group's identity panel |
| Stat | `.stat-row`, `.stat-l` (the numeral keeps `.numeral .numeral-*`) | homes, the jobs board, billing |
| Empty tile | `.empty-tile`, `.empty`, `.empty-t`, `.empty-b` | every empty state |
| Buttons | `.btn-auto` (width only) | inline laptop buttons |
| Door panel | `.door` (from the approved trials/join proposal, now global) | every form page |
| Home grid | `.home-grid` (`.player-grid` kept as an alias) | /home |
| Icons | `ICONS.clip`, `ICONS.star` | player door list |

**For the other groups, three usage rules:**
1. The glow goes on the first primary in 390 reading order, and on no other.
2. Green never marks a waiting state: purple is a club's invitation, amber is anything else waiting or held, red is stopped.
3. A centred grey card that is really a link to another page becomes a **door list** row.

## New copy for BUZ (current line → proposed line, why)

| # | Where | Current | Proposed | Why |
|---|---|---|---|---|
| N1 | /home, parent, when nothing is waiting | *(nothing: the queue is simply absent)* | **Nothing is waiting on you.** (in the dashed "not yet" tile) | The five-second test. An empty space is indistinguishable from a failed load, and D-162's rule is that absence belongs in words. **New line.** |
| N2 | /home, parent, Trials near you | Every notice we hold, newest first | Every notice we hold, by date | **Untrue today.** The board is in trial-date order ("Club trials listed below, by trial date."). The replacement is an approved line, already used on the brand-new home. |
| N3 | /home, brand-new | Adding a child and building a player CV are not on this screen yet — tell us which you came for and we will point you at it. | *Either* keep it and make "tell us" a link (P6), *or* cut to: **Adding a child and building a player CV are not on this screen yet.** | **Untrue today.** There is nothing on the page to tell us with (critic 24 Sep, user-value 28 Sep). |
| — | /home, player, the page panel's heading "Your page" under the hero "Your page is live" | — | *(flagged, no proposal)* | Say it once (D-173 (5)): the same two words, twice in a row. For BUZ, if he wants the panel renamed. |

No other line changes. The mockups set every other word verbatim.

## Product decisions for BUZ (not look; behaviour, numbers, doors)

| # | Decision | What it buys | What it costs | Recommendation |
|---|---|---|---|---|
| **P1** | **On a phone, a seat's one primary sits directly under its hero**: the player's Send my CV to a club, the coach's Edit my coach CV, the TD's Register. (The administrator's is already there.) This changes the 390 order, which is fixed. | The five-second test on the device most players and parents use. Today Send is the sixth block down on a phone, and first on a laptop. | An order change in three branches, and render-order checks move. The laptop is unaffected. | **Yes.** It is the single largest gain for BUZ's test. |
| **P2** | **Say it once: drop the door list on the TD's, coach's and player's homes where the rail or bar carries the same door.** | Quieter homes. | It breaks the frame's invariant (console-shell: "the sidebar is a second way to the same doors /home offers", checked by the render suite): the frame's doors would no longer be on /home. It would need a new rule and new checks. Highlights and Achievements are not frame doors, so they stay either way. | **Not now.** The door list already makes them quiet. |
| **P3** | **A claimed club's own colours on its seat's hero and its seat-card crest** (`clubTheme()`, which already refuses unclaimed and suspended clubs). Buttons stay green. | D-173 (4) says the club's colours are its identity. The people who run the page are the only ones who don't see them. | /home selects the club's two colour columns: one join, no new data. | **Yes**, once the club page ships its colours. |
| **P4** | **The player's "next trial" only picks a trial for the player's own age group.** Today it picks the next notice at any club the player is on the register of, whatever its age group. In the seed, Jordan (22) and Nate (17) are both shown Riverside's "U14 & U15 Boys trials". | The one dated thing on the player's home stops being wrong for most players. | A filter in the query, matching the trial's age groups against the player's. It needs a rule for adults ("SEN") and players with no squad. | **Yes.** |
| **P5** | **The brand-new home leads with the role picked at /join.** That door becomes a lifted panel with the glowing primary, in approved words. | The five-second test for the one screen every new person sees. | Storing the chosen role on the account: one field, adults only (this home never belongs to a child). It is a data-minimisation call (D-25). | **Yes.** |
| **P6** | **"tell us" on the brand-new home becomes a link** to the one user-facing contact address. | A dead end gets an exit. | A new door (a mailto). | **Yes**, or N3's cut. |
| **P7** | **An unverified club is told what happens next**: when the verification call comes, or how to ask for it. | The screen's real next step. Today the only primary is Register, which shows a count. | An ops promise we must keep, plus words for BUZ. No such process is written down. | **For BUZ with ops.** Not a design call. |
| **P8** | **Gate the administrator's Plan block on `billingEnabled()`**, as the sidebar door already is. | D-163 ("no price anywhere") holds by rule, not by accident. Today the block prints "$54 a month" whenever a payment state is active. | One condition. | **Yes.** |
| **P9** | **An operator's Home door goes to `/ops`**, not `/home`. `OpsConsole` links Home to `/home`. An operator whose account holds no club, coach, player or parent seat falls through to the brand-new branch and gets the welcome ("Build a coach CV"…). This comes from reading the source; it has not been rendered. | The operator's Home is their home. | A door changes destination. | **Yes.** |

## Build order and dependencies (which pages move with the base pass alone)

1. **Tokens and CSS** (Shell parts 0, 2, 3, 4, 8–17, 19, 20). There are no markup changes yet. This alone moves:
   - every `.card` and every `card` spread (50 files);
   - `.ops-table` and console heads (the ops, register and people screens);
   - `.tag` → pill;
   - the current-door colour in every frame.
2. **`lib/ui.ts` card** (part 9). This moves the remaining inline `...card` users.
3. **`Frame`** (parts 1–4): the rail mark, the seat card, the glyph slot, the ink current door, and `floodlight` always on. Then the five seat heads (club, coach, operator, player, parent) move onto the seat-card classes. This moves every framed page: 9 club, 6 coach, 11 operator and 7 player/parent files.
4. **`HeaderMark` → page header** (part 6). This moves 47 files. **Depends on 3**: otherwise the logo disappears at 1024 before the rail carries it.
5. **The top bar** in `QuietShell`, `FailureState`, `Plain` and the no-seat branches of `ClubConsole` and `CoachConsole` (parts 5, 21, 22). Delete `PitchWordmark` and its four imports.
6. **`/design` gallery** (part 24).
7. **`/home`**, one seat at a time. Each is independent after steps 1–5:
   1. administrator and unverified (S; closest already);
   2. TD (M);
   3. coach (M);
   4. player 18+ and then 16–17 (M);
   5. parent, including the home-grid move (M);
   6. brand-new and signed out (S).

**Pages that move with the base pass alone (steps 1–5):** all 74, to the extent they use `.card`, `card`, `HeaderMark`, a frame or a shell. **Pages that need their own edit:** the eight kinds listed under "What the base pass alone moves, and what it can't", owned by their groups.

## Risks and suites likely to move (render/layout/perm tests that assert on classes or text)

- **Exact class strings break with the glow.** Adding `fl-glow` changes `class="btn btn-primary"` to `class="btn btn-primary fl-glow"`. These checks match the old string exactly:
  - render **ah3** (`/class="btn btn-primary"/g`, count must be 1);
  - render line ~2121, the failure path (`<a href="/home" class="btn btn-primary">`);
  - render line ~2254, the dead-link page (`class="btn btn-primary"[^>]*>Ask the family`).

  Change them to `class="btn btn-primary[^"]*"` in the same commit. **Do not weaken ah3's count.**
- **Numeral class.** ah12 and the D-162 zero sweep read `class="numeral numeral-[lms]"`. The spec keeps that exact string (part 15). A builder adding a class to the numeral would silently switch the checks off.
- **Frame checks s3–s3e and s9** read `aria-label="… bar"`, `class="seat-tab"`, `class="console-nav"` and `aria-current`. All are kept exactly. The new glyph `<span class="seat-tab-ic">` sits **inside** the link, so the `href…aria-current` regexes still match.
- **ah4** counts `text-align:center` outside the navs on the administrator's home; after this spec it is 0 on every home. **ah5–ah11** words are unchanged.
- **ret-r1 / ret-r1b** find "While you were away" and the hero's first line ("Links active", "Your page is live") as their own text lines. Keep each label in its own element.
- **Layout check:**
  - The failure path needs a visible mark, an h1 and a `/home` link. The top bar's Wordmark is a `div` holding the SVG circle, so it passes.
  - The squeeze rule: the 320px aside holds only rows and wells. The door-list rows' titles are single words, so nothing squeezes.
  - Tap targets: pills are not controls; every row is ≥44px (56px).
- **Visual risk: double shadow.** Nested `.card` inside `.card` loses its shadow by rule (`.card .card`), but a `card` spread nested inline does not. Watch the build form and the send page, which nest hand-built cards.
- **palette-check:** the three new tokens are CSS-only, with no `T` twin (as `--surface-hover` has none). No change expected.
- **One-glow drift.** The rule is per page, and nothing enforces it. A suite check ("at most one `fl-glow` per rendered page") is cheap and would keep it. Recommended to Leo's team.
