# Final round H: what BUZ's walkthrough found, and the words he approved

For the tech-builder seat, from Leo. Launch is **1 October**. Keep each change
small and exact. **The words below are approved**
(`docs/team/APPROVALS-28-SEP.md`, the 29 Sep sections). Use them verbatim and
nothing else.

## Behaviour

1. **The stat count-up flashes "0".** CV stat tiles fade in and count from 0 to
   the value, so for a moment a child's CV shows "0 appearances" (D-162).
   Start the count at the real value: render the final number first, with the
   animation as decoration only. Under `prefers-reduced-motion`, no animation.
   Check: the served HTML and the first painted frame show the real value.
2. **"While you were away" is out of date order** (seen: 20 Aug, 28 Dec,
   25 Oct). Put it in one clear order (past events newest first, then upcoming
   soonest first), or chronological. Choose one, apply it on every seat that
   shows the card, and check it.
3. **The Premium tap jumps to the top.** Tapping a locked row reloads to
   `?first=1` at the top, so "Premium is coming. You're first in line." is
   never seen. Keep the viewer at the rows: an anchor, or no full reload.
   Check that the confirmation is in view after the tap.
4. **A made-up suburb.** Round E's rename made "Quarrymead" the club's suburb
   too ("Quarrymead VIC"). Localities stay real (L15). Give Quarrymead United
   a real Victorian suburb that is not its own name. Check the seed and demo
   layer for any other made-up locality.

## Approved words to make live

- `/home` (club administrator): "…its notices and its plan." becomes
  "…its notices."
- `/club/register` (held club): remove "Paying doesn't change it and can't."
- `/ops/verification`: remove "Payment does not change that and cannot."
  Round G is rebuilding this page. If G has merged, apply it there. If not,
  leave it and tell Leo.
- `/join`, guardian step: "Give us one way to reach them." becomes "Give us
  their mobile and email."
- `/join`, Somewhere else: "Pitch is only in Australia for now." becomes
  "Pitch is only open in Australia."
- **The coach's verify button: "Verify for {club}".** Render round B's held
  button now, so a verified coach at the player's own club can mark a stat
  coach-verified in production. It uses the existing server-side provenance
  rule.
- **The front door's parent row:** the sub-line becomes "Approve and see their
  record". Keep the row's link to `/join`.
- **Doc 15 §9 is retired.** Mark it retired in `docs/15-Message-Copy.md`, with
  the reason (the page and the consent promise one email, when we open), and
  make sure nothing sends it.
- **Doc 15 §4 stays unwired (D-167).** Mark it held in doc 15, with the
  reason.

## Machine and method

- **Tree:** `.claude/worktrees/builder-final-h`.
- **Ports:** database 54452, app 3250, Chrome CDP 9453. Point every probe at
  3250. Never touch 3000, 54322, 3030 or 54323.
- **Migrations:** 0120 and up, if any.
- **Another builder runs beside you.** Check the load and free disk before
  each suite, and wait for other seats' Chrome before a layout pass.
- Prove every check red. Run every suite from a fresh seed in TRAINING §4
  order, plus `test:timing` (under load 8), `test:csp-prod` and
  `build:check`.
- Write your report to `docs/team/reports/2026-09-29-builder-final-h.md`.
