# Final round E: what the walkthrough rehearsal found

For the tech-builder seat, from Leo. Everything here was found by clicking
through the product in a real browser. **No new user-visible copy.** Where a fix
needs words, hold them and list them. Words BUZ has not approved do not render.

1. **Sign-up: Continue with no date of birth does nothing.** On `/join`, with
   the first name filled, the box ticked and the date empty, Continue does
   nothing and says nothing. A child or parent is left with a dead button.
   Show the field as missing using the form's existing error pattern, if one
   is already approved for a missing field. If none exists, hold the words for
   BUZ and make the button do the browser's own required-field prompt in the
   meantime, so it is never silent. Add a check that fails if Continue does
   nothing.
2. **The four role buttons on `/join` have no accessible name.** A screen
   reader announces "button" four times. Give each the name it already shows
   ("Player", "Coach", "Parent / Guardian", "Club"), and add a check in the
   layout pass.
3. **"Somewhere else" has no way back.** Add the product's existing back
   affordance to that screen, so a mis-tap is not a dead end.
4. **"1 clubs awaiting a call"** at `app/ops/verification/page.tsx:57`.
   Pluralise it properly. It is operator-only, but it is still wrong.
5. **A fixture named after a real suburb.** "Sunbury United" in
   `scripts/dev-db.mts` and `scripts/demo-layer.mts` breaks the fixture rule
   (L15): an invented club is never named after a real suburb. Rename it
   everywhere (seed, demo layer, fixtures, docs, every suite expectation) to
   an invented name that is not a real Australian place. Check the other
   names in `CURRENT` and `PREVIOUS` in `demo-layer.mts` against the same
   rule, and list any you are unsure of for Leo.
6. **The front door is client-rendered.** With the launch switch on, `/` serves
   HTML with no text; the content appears only after JavaScript runs. It is
   the one page meant to rank (doc 29 §7), and a crawler or a slow phone sees
   an empty page. Server-render it. Add a check that `/` with the switch on
   serves its heading and all four ways in as HTML text.

**Machine and method:**
- **Tree:** `.claude/worktrees/builder-final-e`.
- **Ports:** database 54422, app 3220, Chrome CDP 9423. Point `RENDER_BASE`
  and every probe at your own port, and write your app's log inside your
  tree.
- **Other processes:** Leo's demo is running on 3030/54323 and the dev app on
  3000/54322. Do not touch either.
- **Migrations:** 0096 and up, if any.
- Prove every check red. Run every suite from a fresh seed in TRAINING §4
  order, plus `test:timing` (only under load 8), `test:csp-prod` and
  `build:check`.
- Write your report in `docs/team/reports/`, and list the held copy
  verbatim.
