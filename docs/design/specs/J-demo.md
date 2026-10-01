# J — The club demo: build spec

**Seat:** design-proposal, for the Head of Product Design, then Leo's build team. **Date:** 1 Oct 2026. **Branch:** design/player-cv (nothing committed).
**Mockup:** `docs/design/mockups/floodlit-access-ops-demo.html`, section J (3 artboards, 390 and 1280, same markup).
**Context:** `docs/DEMO.md` and `DEMO-TD.md`. BUZ runs `npm run demo -- "Club FC"` on his laptop in club meetings, at port 3030 on the demo DB. The club watches his screen.
**Shell parts** are named as in `specs/A-shells-and-homes.md`: **top bar**, **frame**, **rail**, **seat card**, **seat bar**, **page title**, **section heading**, **pill**, **empty tile**, **hero panel**.

## Summary

- **One idea: the real product, clearly marked.** After a seat is taken, every page is the real Floodlit product (A's shells, the club console). The only demo thing on screen is one strip.
- **The strip is wrong today.** It is solid green, and green is an action (D-173 (4)). It marks a *mode*, which is a state, so it moves to a dark strip with the amber **pill** "Demo". Its "Switch seat" link is 24px tall today, below the 44px charter floor; it becomes 44px.
- **`/demo` itself** is drawn from the sign-up role card (the object a club secretary meets next, on `/join`):
  - a stroke glyph per seat;
  - the seat's role in muted caps (it was green);
  - two-up from 640px;
  - the club's own crest tile in the head, or the dashed initials tile for the `--unclaimed` run (D-172).
- **Size:** **S**, about half a day. One component, one page, and no behaviour change.

## Pages

### /demo  ·  BUZ in a club meeting (exists only under `npm run demo`)  ·  size S
- **Source:** `app/demo/page.tsx`, `app/demo/seats.ts`, `app/demo/actions.ts`, `lib/demo.ts`.
- **States:**
  1. **A claimed club** (the usual run): seven seats, and four "Open without signing in" links.
  2. **`--unclaimed`:** "Start here" (the club's page and Claim), three seats (Parent, Player 17, Player adult), and two open links.
  3. **Not a demo:** a 404 (`notFound()`), as today.
  4. A seat whose person row is missing: `takeSeat` redirects back to `/demo`. This state is invisible.
- **Phone (390):** order unchanged:
  1. The demo strip.
  2. Top bar (logo right, **not a link**, as HeaderMark today).
  3. **Head:** the club tile (52px) beside the page title "Pitch for {name}" and its line.
  4. `--unclaimed` only: the section heading "Start here" and two link cards.
  5. The section heading "Sign in as", then the seat cards.
  6. The section heading "Open without signing in", then the link cards.
  7. The footnote.
- **Laptop (1280):** the same column, in the reading width (`.col`, 640px at 1024+; this is a list, so it sits on the page, not on a door panel). **From 640px the seat cards and the link cards go two-up** ("pairs may go two-up", D-147). Reading order is row by row, the 390 order.
- **Parts:**
  - **Seat card** (`.choice`, from the approved join mockup's role card): `.fl-card` surface with `--shadow-card`, 16px radius, min-height 64px. Inside it:
    - a 40px `var(--r-well)` icon well with a stroke glyph from `console-shell` `ICONS`: register (TD), crest (admin), roles (coach), a lock (the club we haven't rung yet), children (parent), cv (both players);
    - the role in `.field-label`-sized muted caps (`10px/800`, `--ls-label`), **no longer accent**;
    - the name (15/800);
    - the line (12.5/500 secondary);
    - a chevron.

    It is still a `<form action={takeSeat}>` with `<button type="submit">` and the hidden `seat`.
  - **Link card:** the same `.choice` without the icon well.
  - **Club tile** (J-P2): a claimed club shows its crest image (`crest_path`) in the club page's 52px tile. An `--unclaimed` club shows the **empty tile** with its initials and no image (D-172). The demo's crest is always a claimed club's own image, or the plain shield the demo draws.
  - Section headings are `.sec-h` (on the page, above cards).
  - Page title: A §7. The footnote is `.small`.
  - **The glow:** there is no primary on this page. Every seat is a choice, and none is the next step.
- **Copy:** verbatim. These are the 23 Sep approved strings (DEMO.md) and the rest of the page as built:
  - "Pitch for {name}";
  - "Choose a seat. You can switch at any time from the bar at the top.";
  - "Nobody at {name} has claimed the page yet. Start at the top — the club seats appear once it is claimed.";
  - "Start here", "Sign in as", "Open without signing in";
  - every seat's who, name and what (`seats.ts`);
  - the four and two link titles and lines;
  - "Every player, parent and coach here is made up. Nothing in this demo sends an email or a text, or takes a payment."
- **Must not change:**
  - The three locks: no production build, the demo DB only, nothing leaves (`lib/demo`).
  - Every person is a fictional seed person. **Real children never go into a demo.**
  - The held seat shows a count and no names (D-126).
  - No price anywhere (D-163). "takes a payment" is a statement that it doesn't.
  - The unclaimed run shows nothing that is an image, or says it is with us (D-172).
- **Done when:**
  - [ ] No accent text on the page except links. The seat role is muted.
  - [ ] At ≥640 the seats are two-up. At 390 they are one column in `SEATS` order.
  - [ ] A seat is still a POST form with the `seat` field. `demo-walk.mjs` walks it unchanged.
  - [ ] The `--unclaimed` head tile is dashed with initials and no `<img>`.
  - [ ] Every card is ≥44px, and the chevrons are stroke SVGs.

### The demo strip (`components/DemoBar.tsx`) on every page in a demo  ·  BUZ and the club watching  ·  size S
- **Source:** `components/DemoBar.tsx`, rendered by `app/layout.tsx` when `isDemo()`.
- **States:** one. It appears above every page: public Floodlit pages (above the sticky **top bar**), framed seats (above the **frame**; the rail and seat bar are unchanged below it), and `/demo`.
- **Phone (390):** one row, 44px:
  1. the amber **pill** "Demo";
  2. "every person here is made up" (secondary, ellipsis if ever too long);
  3. "Switch seat" at the right, 44px tall, ink, 800.
- **Laptop (1280):** the same row inside `.fl-wide` (1200px), so the pill lines up with the logo in the top bar or the rail below it.
- **Parts and exact CSS** (new, below): `.demo-bar`, `.demo-bar-in`, `.demo-bar-t`, `.demo-bar-a`, and A's `.pill.pill-wait`. `role="note"` stays.
- **Copy:** the same words: "Demo" (now in the pill), "every person here is made up", "Switch seat". The "·" between the first two becomes the pill's edge. There are no new words.
- **Must not change:**
  - Server-rendered, and only when `isDemo()`.
  - "Switch seat" → `/demo`.
  - It is never sticky and never over the page's content. It pushes the page down by 44px, as today it pushes it by ~30.
- **Done when:**
  - [ ] No accent background. The pill is `pill-wait`.
  - [ ] "Switch seat" measures ≥44px tall (layout-check's target rule).
  - [ ] The strip does not overlap the sticky top bar or the rail at any width.
  - [ ] It fits one line at 375.

### A seat taken (every signed-in page in a demo)  ·  size — (A's)
- **Source:** the seat's own pages, for example `/home` in the club console (`ClubConsole`).
- **Nothing here is designed for the demo.** It is the real club console exactly as group A (frame, rail, seat card, seat bar, hero panel) and the club groups specify it, under the strip. The artboard draws the TD home's top only to show the strip in place. Its counts are illustrative (DEMO.md: 100 on the register).
- **Must not change:** the demo shows the real product and nothing staged. This is what makes it an honest demo.

## New shared parts (class, exact CSS, where used)

The demo strip goes in `app/globals.css` after the SHELLS block. It is used only by `components/DemoBar.tsx`.

```css
.demo-bar { background: var(--surface-sunken); border-bottom: 1px solid rgba(237,161,0,.45); }
.demo-bar-in { display: flex; align-items: center; gap: 8px; min-height: 44px; }
.demo-bar-t { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 700; color: var(--secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.demo-bar-a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 2px; font-size: 12.5px; font-weight: 800; letter-spacing: var(--ls-button); color: var(--ink); white-space: nowrap; text-decoration: none; }
.demo-bar-a:hover { color: var(--accent); }
```

```tsx
// components/DemoBar.tsx
<div role="note" className="demo-bar"><div className="fl-wide demo-bar-in">
  <span className="pill pill-wait">Demo</span>
  <span className="demo-bar-t">every person here is made up</span>
  <a href="/demo" className="demo-bar-a">Switch seat</a>
</div></div>
```

- The amber hairline is `--amber` at .45 alpha, written as a literal because there is no alpha token. If the Head of Design prefers no literal, use `border-bottom: 1px solid var(--line)` and let the pill carry the state alone.
- The seat card is the approved join mockup's `.choice` (+ `.ic`). If A or the join build has already shipped it under another name, use that. If not, its CSS is in `floodlit-access-ops-demo.html` (`.choice`, `.choices.two`), and it is the same as the join mockup's apart from the Floodlit surface and shadow.

## New copy for BUZ (current line → proposed line, why)

**None.** The strip's words are unchanged; "Demo" moves into the pill.

**One doc line becomes untrue** (not UI copy): `docs/DEMO.md` says "**The green bar** at the top says it's a demo." With J-P1 it should say "The bar at the top with the amber Demo tag says it's a demo." That's a doc edit for whoever owns DEMO.md, once BUZ says yes.

## Product decisions for BUZ (not look; behaviour, numbers, doors)

| # | Decision | What it buys | What it costs | Recommendation |
|---|---|---|---|---|
| **J-P1** | **The demo strip moves off green.** A dark strip with the amber "Demo" pill, and "Switch seat" at 44px. | Green keeps one meaning (an action) in front of the clubs BUZ is selling to. The strip reads as a label on the product, not as a button across the top of every page. The charter's 44px target is met. | 1 hour, plus the DEMO.md line. The strip is quieter than solid green: in a screenshot or a room it is still unmistakable (amber pill, first thing on every page), but less loud. | **Yes.** |
| **J-P2** | **The `/demo` head shows the club's crest tile** (the claimed club's crest, as on its club page), or the dashed initials tile for `--unclaimed`. | The first screen the club sees in the meeting is *their* club, in their crest, before any seat is chosen. That is the point of renaming the demo. | One more column in the page's existing query (`crest_path`). No new words, no new door. | **Yes.** |

**Not proposed.** A sticky strip that stays on screen while scrolling would fight the sticky top bar and rail (both `top: 0`), and a demo is shown from the top of each page anyway.

## Build order and dependencies

1. **DemoBar** (J-P1). It is independent of everything else and ships alone.
2. **A's base pass** (top bar, pill, empty tile, section heading, page title). Then `/demo`: the seat and link cards, two-up from 640, and the head tile (J-P2).
3. **Nothing else.** A seat taken is A's and the club groups' work, and the strip sits above it unchanged.

## Risks and suites likely to move

- **`scripts/demo-walk.mjs`, `demo.mjs`, `demo-layer.mts`** drive `/demo` by its forms and link text. The words and the `seat` field are unchanged. If a walk selects a seat by the accent colour or an inline style, it will move. It shouldn't.
- **`permission-tests.mjs`** checks that `/demo` is a 404 outside a demo and that `takeSeat` signs nobody in outside a demo. Neither changes.
- **`layout-check.mjs`** (if run in demo mode): the strip's 44px target now passes, where it would have failed at 24px. The strip adds 14px above every page in a demo, so any check that measures an absolute top offset in demo mode will move.
- **Screenshots and reels** made from the demo (`app-redesign-and-reels`) will show the new strip. Any held reel frames with the green bar would need re-rendering, if they are used again.
