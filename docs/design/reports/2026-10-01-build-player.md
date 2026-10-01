# design-builder: Floodlit group C, the player's screens (1 Oct 2026)

Asked (Leo): build spec C (`design/player-cv:docs/design/specs/C-player.md`, mockup `floodlit-player.html`, README approvals of 1 Oct) on `build/player` off `app` c912cf4. Restyle only. Not C-P1, not C-P4. Keep `form="cv"` on Number and Preferred foot. Mid-task (Leo, BUZ-approved): the photo refusal line becomes "That file didn’t work. A PNG or JPEG under 8MB."

Worktree `.claude/worktrees/player`. Ports: app 3261, dev DB 54461, layout CDP 9461.

## What changed

- **`app/globals.css`**: new block `PLAYER SCREENS (C, 1 Oct)` after A's SHELLS block.
  - Tokens `--cv-hero-bg` and `--print-*` (CSS-only, same values as before).
  - `.textbtn` (spec E's rule, verbatim) plus a `.textbtn-block` variant.
  - `.chip[aria-current]` as "you are here".
  - Notice tones and `.notice-h/.notice-b`, `.checks`, `.pos-grid`.
  - The builder: `.cv-edit`, progress, `.stats4`, `.stat-in`.
  - Clip panel, Premium rows, ticket, `.pv-strip`, share-card shapes and silhouettes, club tile, team rows, print sheet.
  - Helpers are prefixed `c-` so they can't collide with other groups.
- **`components/player-parts.tsx`** (new): `Outcome`, `Check`, `Who`, `Say`, `BuildHeader`, `TextLink`, and stroke glyphs. Send, Register interest and the share card draw one of each.
- **`lib/build-progress.ts`** (new): "N of 6 done" for `/clips` and `/more` (C-P2). It counts the same six fields the builder counts, behind `requireRecordActor`.
- **`/build`** (`BuildForm.tsx`, `page.tsx`):
  - The card (`.cv-edit`) holds photo, name, positions, number and foot. Number and foot carry `form="cv"`, and the story form is `form#cv`.
  - The progress fill is `--secondary`. Positions gain `aria-pressed`. "Save & preview" is `.btn-primary.fl-glow`.
  - N2 is in place. The photo line is Leo's approved text.
  - SquadCard moves inside the column, under Save.
- **`/clips`**: C-P2 header. The form is a Door. Clips are panels with a neutral play mark and the source word. The Empty tile drops the "＋" (N3). Remove is `.textbtn`.
- **`/more`**: C-P2 header. Panel lists and `.textbtn` Remove. The kind is a dotless Pill. Add buttons are the secondary with a stroke plus (N3).
- **`/preview` and `PlayerCV.tsx`**: PlayerCV gains an optional `above` slot, rendered after `SiteNav`. The strip (`.pv-strip`) sits under the CV's nav, so the page has one header. The edge is purple when a change is waiting. `/p/[token]` never passes `above`.
- **`/ready`**: the moment is a Door with the ticket (`--cv-hero-bg`, the number behind it, an `aria-hidden` badge).
  - The link hint is ink monospace.
  - One glow, and none while waiting. "Keep building" is the text button.
- **`/send`**:
  - Compose is a Door. "Sending to" heads both wells, and each well carries its own label (`aria-invalid` on `?error=1`).
  - "What the club gets" is a Well with secondary ticks and muted crosses.
  - The who row is neutral or purple. Cancel is the text button.
  - Your links are a Panel list under the Door, with an Empty tile when there are none. N4: the repeated heading is gone.
  - The four outcomes are one lifted Notice (no `--hero`).
  - `composeSend`, dispatch, the prefill and `sc-`/`ve-` are untouched.
- **`CopyLink`**: now `.btn .btn-secondary` (same values).
- **`/share-card`**:
  - The Top bar, and a Door.
  - Shapes are `:has()` radio tiles drawn as silhouettes, with no text and no data.
  - The `.checks` well and the purple who row.
  - "Asked" is the same Notice, with the kicker "Waiting on your parent".
- **`/register-interest`** (`page.tsx`, `InterestForm.tsx`): the Top bar and a Door. The club panel has no accent. The trial line is secondary with a calendar glyph. Positions use `.pos-grid`. The rest follows the `.checks`, Who and Notice pattern above.
- **`/squad`**: the Top bar.
  - Search is the light `.fl-search` field (GET, `q`).
  - Clubs and teams are Panel lists. Club rows are still `<a href="?club=">` with the name first. Team rows are submit buttons ending in "Ask them".
  - Empty states are Empty tiles. "A different club" is the text button.
- **SquadCard**: list rows with `.console-btn` Leave and Cancel, and an amber error Notice. The invitation keeps D's equal pair, with no green edge.
- **`/manage`**: the Quiet shell `door`.
  - Page title, `.field` wells, accent and amber Notices, and Save as `.btn-primary.fl-glow`.
  - No `#0a110d`, no weight 600, no −0.02em.
- **Print** (`page.tsx`, `PrintButton.tsx`, `Wordmark.tsx`):
  - The sheet is on `--print-*`, with `.sheet-h` headings and `numeral numeral-m`.
  - All letter-spacings are from the five. The typed "PITCH" becomes the Wordmark: `Wordmark` gains an optional `color`, and its default is unchanged.
  - "Save as PDF" is `.btn-primary.btn-auto`.
  - C-P3: the context line and Football history, read from the same `readCvByToken` result.
- **`PremiumRows`**: panels with a neutral Pill and a muted "Coming soon". This is shared, so `/coach/edit` changes too.

## Counts

Fresh seed, TRAINING order: reseed, perms, render, write, reseed, restart `next dev`, layout.

| Suite | Result |
|---|---|
| perms | 2020/2020 |
| render | 714/714 |
| write | 567/567 |
| layout 375 1280 | 250 views, ALL GREEN |
| palette | ALL GREEN |
| tsc | clean |
| build:check | ok, 99 routes |
| csp-prod | 5/5 |
| corpus | 0 failures |
| secret-scan | none |
| gate-coverage | 263/263, 0 open |

The first perms run failed `cvcol7`: preview passed `above` after `wornColours`. I moved `above` before the spread rather than changing the check.

**GET crawl:** 198 page×seat views, fresh seed, before and after. Door changes:
- C-P2's two step links on every `/clips` and `/more` view;
- the print button gains `type="button"`.

Text changes are all approved or decorative:
- C-P2 header words;
- N3 "＋" removals and N4;
- the photo line;
- the top bar's logo copy;
- the decorative squad number;
- the clip poster's source word;
- the "Waiting on your parent" kicker;
- C-P3 print lines.

There is one seed-noise report id.

## Tests touched, and why

- **write `forms()`** now honours the `form` attribute: controls with `form="X"` belong to form `#X`, and controls naming another form are dropped. This is the README's "teach it the form attribute". Without it the suite would post the builder without number and foot.
- **render `dfx-C-P6`**: the line changed on purpose (Leo/BUZ). It now also asserts that the old line is gone.
- **New:**
  - render `pl-fl1`–`pl-fl12`;
  - write `pl-fl-w1`: after the keeper saves, Nate's number is still 1 and his foot still Right.
- **Proven on broken markup** (`form="cv"` removed and the old line put back):
  - `pl-fl1` failed (`[true,false,false,true,true]`);
  - `dfx-C-P6` failed;
  - `pl-fl-w1` failed (number `null`, foot lost). The suite blanked them exactly as a browser would.

  The same render run also failed `E9/E10` (timing) once, right after a hot reload. It is green on the clean run.

## Strings

**Added:**
- "That file didn’t work. A PNG or JPEG under 8MB." (Leo/BUZ, replacing "That photo didn’t upload. Try a JPG or PNG under 8 MB.");
- "Profile photo" (N2, shows only once a photo exists);
- "Waiting on your parent" as the share card's "asked" kicker (approved words, new place);
- the C-P2 header words on `/clips` and `/more`;
- the clip poster's source word (YouTube, Instagram or Veo; `aria-hidden`);
- on print, the context line and the Football history lines.

**My call, for copy check:** on print I added the CV's own sentence, "Earlier clubs are {first}’s own account of where they played. Only the club at the top is one we hold on Pitch." The mockup leaves it out. I kept the more restrictive and honest version (D-72). Remove it if BUZ prefers the mockup.

**Removed:**
- "＋" from four buttons (N3);
- the "Make a fresh link" heading (N4);
- "PITCH" typed on print (now the Wordmark).

## Not done, and handed on

- C-P1 and C-P4 (C-P4 needs words and a dispatch ruling).
- `PlayerCV`'s hero literal still duplicates `--cv-hero-bg`, and `.cv-hero`/`.cv-avatar` are still at 26px (ruling 6). Leo said not to restyle the CV, so these belong to the CV group.
- `.btn-ghost` is not yet an alias of `.textbtn` (ruling 2). It would touch other groups' pages.
- `/manage`'s form states can't render locally (no Supabase waitlist), so only the broken-link state is captured.
- The `off` state ("Sending is off") isn't seeded, so it has no screenshot. Its render path is the same `Outcome`.
- Not touched: migrations, permission functions, `record-read`, `send-dispatch`, proxy/CSP.
- **For the tech team:** nothing.
- `globals.css`, `CopyLink`, `PremiumRows` and `Wordmark` are shared with groups A, E and F, so expect merge contact there.

## Screenshots

`docs/design/reports/2026-10-01-player-shots/` (untracked, 26 MB):
- 41 states × 390 and 1280;
- `before-*` from c912cf4 (stash) and `after-*`, both page-tall.

Compared with the mockup: the card on its gradient with the number behind it, the ticket, the silhouettes, Door panels from 640, Notices with no `--hero`, and the print sheet in ink.
