# Whole-app Floodlit specs: method and format (1 Oct 2026)

**From:** Head of Product Design. **For:** the design seats writing each group's spec, then Leo's build team.
**BUZ, 1 Oct:** "go through the whole app, every persona screen and do the design specs based on what we liked … lay it all out for a handover to the build team."

## What "what we liked" means (the standard to match)

These are approved and built (D-173). Every other screen should look like it belongs with them:
- the front door and the four persona landings (`components/front-door/FrontDoor.tsx`);
- the club page (`app/fc/[slug]/page.tsx`);
- the player CV as a player card (`components/cv/PlayerCV.tsx`);
- the trials board, join, sign-in and claim (proposal approved: `docs/design/reports/2026-10-01-proposal-trials-and-join.md`, mockups `docs/design/mockups/floodlit-trials.html` and `floodlit-join-signin-claim.html`).

The parts, from `app/globals.css` (FLOODLIT and THE PLAYER CARD sections), `components/floodlit/SiteNav.tsx` and those files:
- **Surfaces:** `.fl-card` with `--shadow-card` (rest) and `--shadow-float` (lifted), `--fl-surface`, `--line`, `--r-card`.
- **Widths:** `.fl-wide` (1200px) for the front door, landings and club page; `.reading` (560/640) for reading surfaces. Any other width is a decision for BUZ, so flag it.
- **Logo** top-left from 1024px, top-right on phone (SiteNav).
- **Colour:** green means action. A claimed club's colours are identity (never for an unclaimed club, D-172). Amber, purple and red are states only.
- **Say it once.** No line repeats a heading, and no helper text restates the label.
- **One glowing primary per screen.**
- **A form is a door, a list is a page:** a step that asks for something sits in one panel; a list sits on the page.
- **Dashed means "not yet"** (the dashed tile).
- **The charter holds:** the type scale, five letter-spacings, radii, two buttons, stroke icons and ≥44px targets.

## Fixed (a spec may not change these)

- **Words.** Every user-visible word is reused verbatim. Any new or changed line goes in the group's "New copy" list for BUZ, with the reason. A line that is untrue today is flagged, never silently rewritten.
- **Which facts each seat sees:**
  - pillar zero;
  - the permission matrix (`docs` doc 14);
  - D-126: the held register shows counts only;
  - D-82: no paid surface for under-18s;
  - at most two quiet Premium rows for adults;
  - D-163: no price anywhere;
  - D-172: nothing on or about an unclaimed club is an image or says it's with us.
- **Content order on the phone** stays as it is.
- **Doors** stay: no route, button destination or form field is added or removed.
- **Behaviour** stays. A new number, feature or rule is a product decision for BUZ, listed separately.
- **No desktop-only feature.** The laptop gets the same content, arranged better (D-147).

## How to work

- Read source, not old screenshots. The captures in `docs/design/screens/` (24 Sep) are older than the current surface stack.
- Don't start a dev server and don't run the suites. The disk is tight and six seats are working at once. Work from source.
- Build on earlier approved thinking where it exists (`docs/design/mockups/*.html`, `docs/design/reports/*`), but Floodlit wins where they differ.
- Group A (the shells) is specified in parallel with the others. Groups C to J design the page **inside** the shell and refer to shell parts by the names in `specs/A-shells-and-homes.md`, or describe what they assume. If a group needs a **new shared part**, name it under "New shared parts" with a proposed class name. The Head of Product Design reconciles these across groups.

## Deliverables per group

1. **Mockup:** `docs/design/mockups/floodlit-<group>.html`. Follow the house style of `floodlit-trials.html`:
   - one self-contained file, no build step;
   - every page in every state the source can produce;
   - 390 and 1280 side by side, same markup, container queries.
2. **Spec:** `docs/design/specs/<letter>-<group>.md`, in exactly this shape:

```
# <Letter> — <Group>: build spec
## Summary (5 lines max: what changes, what it fixes, size)
## Pages
### <route>  ·  <who sees it>  ·  size S/M/L
- Source: files that render it
- States: every state the source produces (empty / waiting / full / error / held / dead link …)
- Phone (390): layout top to bottom
- Laptop (1280): layout (same content, arranged)
- Parts: Floodlit classes/tokens used; any new class with exact CSS
- Copy: "verbatim" / new lines → see New copy
- Must not change: the safety facts this screen carries (pillar zero, D-126, D-82, D-172 …)
- Done when: 3–6 checkable acceptance criteria (a builder and QA can tick them)
## New shared parts (class, exact CSS, where used)
## New copy for BUZ (current line → proposed line, why)
## Product decisions for BUZ (not look; behaviour, numbers, doors)
## Build order and dependencies (which pages move with the base pass alone)
## Risks and suites likely to move (render/layout/perm tests that assert on classes or text)
```

Don't commit, and don't touch any file outside your group's own mockup and spec.
