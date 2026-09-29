# Final round G: the operator console, rebuilt to its signed design, and made to work on a phone

For the tech-builder seat, from Leo. BUZ saw the console in the walkthrough
and said "i dont like this … fix it."

**What is wrong, measured on 29 Sep at 375px:**

1. **`/ops/verification`.** Each club row is one flex row holding four things:
   the details, the held count, the status chip and "Open call sheet". The
   chip and the button refuse to shrink, so the details column is squeezed to
   about one word wide ("claimed / by / M. / Harris").
2. **`/ops/call/[clubId]`.** It drifted from the signed design
   (`design-screens/OpsCall.dc.html`). The guidance is written INTO the field
   labels, in tracked capitals ("OPERATOR — THE HUMAN. NAMED, EVERY TIME. NEVER
   'SYSTEM', NEVER 'ADMIN'."). Every yes/unknown answer sits in its own tall
   box.
3. **No design exists for the console at phone width.** The signed Ops designs
   are laptop-only. But the brief's 11pm kill switches assume BUZ is on his
   phone.

## What to build

- **Match the signed designs** for layout, hierarchy and words:
  `design-screens/OpsCall.dc.html`, `OpsVerification.dc.html`,
  `OpsReports.dc.html` and `OpsToday.dc.html`.
  - Guidance is ordinary sentence-case text under a short section heading
    ("The number — find it yourself", then one line).
  - Field labels are short.
  - The four questions are one group, and each answer is a compact choice
    (segmented buttons or a select), not a tall box.
  - **Use only words that are already on screen today or in those signed
    designs.** Where the signed design has words the built screen lacks, you
    may use the signed design's words. They are BUZ-approved by being signed.
  - **Hold any new word**, and list it for BUZ.
  - Nothing money-related from the signed designs ("Money" tab, "Live
    subscriptions", "Authorised to subscribe", "Payment does not change
    that"): billing is off (D-163), so leave those out and list them.
- **A phone layout for every `/ops` screen,** designed in the charter:
  - On a queue row under 640px, the club details go full width on top, and
    the count, status and button sit in one row beneath.
  - The call sheet is one column.
  - The switches stay as they are (they read well), but check them.
  - Touch targets stay at 44px or more.
- **Laptop:** at 1024px and up, match the signed laptop design: rail plus
  content, and a table for the queue.
- **A new layout check** in `scripts/layout-check.mjs`: on every page at every
  width, no text container that holds words may render narrower than 120px
  while its text wraps to more than three lines. Squeezed columns fail by
  name. Prove it red on today's `/ops/verification` at 375px. It must catch
  this class of problem anywhere in the product, so fix whatever else it
  finds or list it.

## Order, because another builder is on the call sheet

Round F (TD handover) is editing `app/ops/call/[clubId]/*` and
`app/club/roles/*` right now.

1. Do `/ops/verification`, `/ops/reports`, `/ops/support`, `/ops/switches`,
   the ops shell and the new layout check first.
2. Do not touch `app/ops/call/*` until Leo tells you round F has merged. Then
   merge `app` and do the call sheet, keeping F's "End this Technical
   Director's access" card and its approved words exactly.

## Machine and method

- **Tree:** `.claude/worktrees/builder-final-g`.
- **Ports:** database 54442, app 3240, Chrome CDP 9443. Point `RENDER_BASE`
  and every probe at 3240, and write your log in your tree.
- **Never touch** 3000, 54322, 3030 or 54323. BUZ's demo is live on 3030.
- **Migrations:** 0110 and up, if any.
- **One other builder is running** (F, on 54432/3230/9433). Check the load
  and free disk before each suite. Before a layout pass, wait until 9433 is
  free. Run `test:timing` only under load 8.
- Prove every new check red. Run every suite from a fresh seed in TRAINING
  §4 order, plus `test:timing`, `test:csp-prod` and `build:check`.
- **Screenshots:** before and after each ops screen at 375 and 1280, saved
  in your tree under `.run/shots/`, and listed in your report.
- Write your report to `docs/team/reports/2026-09-29-builder-final-g.md`,
  with held words verbatim.
