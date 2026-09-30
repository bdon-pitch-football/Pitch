# Floodlit build — front door, persona entries, club page (1 Oct 2026)

**Asked (BUZ, 1 Oct):** "Yes to all five charter changes, start building." and "each persona should have their own entry to the app, similar to like the club one."
**Recorded as:** D-173 (register v4.32) and the Night Match section of `CLAUDE.md`.
**Branch:** `design/floodlit`, in its own worktree. Nothing pushed, nothing deployed, nothing in production touched.

## What changed

| Surface | Before | Now |
|---|---|---|
| `/` (front door) | A 640px column: slogan card, four equal text rows, the club last | Club-first. Full-width match-night photo, "Your club's page might already be built.", a club search (the same `GET /claim` that Find your club answers), then the four personas as photo doors |
| `/?for=player` `parent` `coach` `club` | Text cards in a 640px column | Each persona has its own entry: its own photograph, headline and first action, then its sections two or three across on a laptop. The club's first action is the club search |
| The parent door | Went straight to `/join` (29 Sep) | Opens the parent's own landing, whose button goes to `/join` (BUZ, 1 Oct) |
| The club landing's button | `/join` | `/claim` (Find your club): claiming is the thing a club does |
| `/fc/[slug]` | A 640px column | Full-width hero; from 1024px trials, the way in and teams on the left and who the club is on the right. Every door, word and test marker it had is kept |
| `/fc/[slug]`, unclaimed | Banner card only | Pitch lines drawn behind the name (inline, not an image file), the D-172 banner unchanged and first, and a claim panel: what claiming turns on, and one button |
| Tokens | No shadows | `--shadow-card`, `--shadow-float`, `--shadow-accent`, `.fl-card`, `.fl-wide` (1200px), `SiteNav` |

The rest of the product (signed-in screens, the CV, the console) is untouched in this pass.

## Checks

- Render suite: **648 passed, 0 failed**, against a fresh seed on its own port. That includes John's U1–U6 on unclaimed pages, the D-172 banned-words check, fd0–fd5, r21–r23 and link-r1/n1.
- Three front door checks changed because the design changed on purpose, not because they failed: **fd2c** (the parent door now opens `/?for=parent`), **fd5** (the heading is now the club-first line) and **fd2b** (now also requires `/claim` and `/?for=parent`).
- Layout check at 375 and 1280: **all green** (no overflow, 44px targets, focus rings, CSP).
- Palette check: all green. Typecheck: clean.

## New words — approved by BUZ, 1 Oct ("approve the words")

Approved as listed. Every other word on these pages is already approved and used word for word.

| Where | Line |
|---|---|
| `/` heading | **Your club's page might already be built.** (BUZ, 1 Oct, on copy check F1: "Change it to might") |
| Nav bar, every Floodlit page | **Find your club** · **Trials** · Sign in |
| Unclaimed club page, claim panel title | **Claim {Club}** |
| Unclaimed club page, what claiming turns on | **Your crest and your philosophy** · **Every squad you run, MiniRoos to seniors** · **Trial notices families can find** · **One list of every player who wants to join** |
| Unclaimed club page, button | **This is our club — claim it** |
| Claimed club page, side card | **The club** (label) · **{n} squads** |

Reused from elsewhere, unchanged: the `/` hero line and the search's "Club name or suburb"/"Search" (from Find your club), "For clubs & technical directors", "Is this your club?", "We email a code to the club's own address to check it's you.", "Browse trials without an account" (now also a button on the player landing), "Under 16, nothing exists until a parent approves it." (now also under the parent landing's button).

## Open, for BUZ

1. **Decided (BUZ, 1 Oct: "Keep the scaling").** One type rule is bent. D-147 says the type scale never changes by width. The Floodlit hero headline scales from 38px on a phone to 76px on a laptop (and a club's name from 32px to 60px), because a 76px line doesn't fit a phone and a 38px line looks lost on a laptop. Keep the scaling (and add it to D-173), or fix the size at one value?
2. **Started (BUZ, 1 Oct: "start club colours").** Club colours (change 4) need a place to live. A claimed club can't set its colours yet. Doing that needs two columns on `club`, a colour picker in the club page editor, and an automatic contrast check. That's a migration, so it's the next step, not in this pass.
3. **Photos.** The front door and landings use the match-night set already on the live site (all adults, no real club). If a real photo shoot happens, those files are the only thing to swap.

## Later on 1 Oct — club colours, review fixes, final suite

- **BUZ:** "Keep the scaling, approve the words, start club colours", and "For clubs · free" on `/` (no count of clubs). The count line was only ever in the clickable preview, which is updated too.
- **Club colours:** migration 0161 (renumbered from 0160 at hand-over; a proposal for Leo's team to own, per his brief §8), `lib/club-colours.ts`, a Club colours form in Crest & club page (12 pairs, or the club's own two), and the claimed club page wearing them: the hero, a stripe, the crest tile when there's no crest, and the trial months. Buttons stay green. Unclaimed or suspended clubs never get colours; the database, the theme function and the page each refuse them. White text holds 4.5:1 and the trim 3:1 for any colour a club picks (perms col6).
- **Copy check fixes (no new words):**
  - The claim panel drops "Trial notices families can find" and "One list of every player who wants to join", because claiming doesn't switch those on; verification does. It also drops its duplicate "Is this your club?".
  - "Every squad you run" loses "MiniRoos to seniors".
  - The email-code line shows only where the club has an address.
  - The claimed page's "The club" card is gone, because the hero already says it.
  - The parent landing drops the repeated under-16 line.
  - The logo is read out as "Pitch, home".
- **Safety review fixes:**
  - The nav links show at every width (D-147); a palette check now guards this.
  - The demo reset clears colours.
  - No banner photo on an unclaimed page.
  - No "Sign in" for a signed-in visitor.
  - John's U5 check can fail again.
- **Final suites, fresh seed, TRAINING order:** perms 1922/0 · render 648/0 · write 516/0 (97/97 forms) · layout 375+1280 green (232 views) · palette green · typecheck clean.
- **Decided (BUZ, 1 Oct):** the heading is "Your club's page might already be built." (copy check F1).
