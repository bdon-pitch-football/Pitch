# builder: a number says where it came from, and a keeper's form opens on the keeper's set (2026-09-28)

**Asked:** three defects where the product holds the truth and renders something else:
1. The CV prints a fixed "Self-reported" over every stat.
2. The guardian-approved share card carries no provenance at all.
3. A goalkeeper's build form opens on the outfield set, and the GK fixture hid it.

Leo also asked me to audit every surface that renders a stat, for provenance and (D-162, added mid-task) for zeros.

**Tree:** worktree `builder-provenance-honesty`, branch of the same name, HEAD `f9e5d37`. It has `app` merged in three times (`c979a3b`, `2c9da1d`, `807efc1`, all merges, no rebase), so it contains `app` HEAD as of 807efc1. Own ports: app on 3062, dev database on 54362. Nothing pushed. `.next`, `.next-check` and the worktree's `node_modules` are deleted, and both ports are free.

**Disk (`df -h /`):** the first session started at 13Gi available. The machine then ran out of space mid-render during a three-builder rebuild (the coordinator's stop). This session started at 21Gi and ended at 19Gi.

---

## Did

### The rule, in one place: `lib/football.ts`
- **`PROVENANCE_LABELS`** has one word per value the column permits. It is typed `Record<Provenance, string>`, so a fourth value cannot compile without a word for it.
- **`provenanceLabel()`** reads a value that is outside the domain as the *weakest* claim. The database's check constraint makes such a value unreachable, so this is only a backstop.
- **`sharedProvenance(rows)`** returns the one source every number in a block shares, or `null`.
- **What I chose for a block whose rows differ** (Leo asked me to say): a caption is a statement about every number under it. So when the rows agree, the block is captioned once, exactly where it is today. When they differ, there is no block caption, and each number carries its own tag under its label. Nothing is averaged, and no number sits under a word that is untrue of it.

### Defect 1: the CV and its siblings

**`components/cv/PlayerCV.tsx`**
- The chip now reads the row.
- In a mixed block, each tile gets its own source.
- This covers all five routes that render the CV: `/p/[token]`, the register CV, the squad CV, the family preview and `/cv-preview`.

**`components/cv/StatTile.tsx`**
- Adds an optional `source` caption, drawn only for a mixed block: 9px/800, white at .72.
- .55 measured 4.51:1 on the hero, which I would not ship. .72 is 6.49:1 on the hero that actually renders, and 4.55:1 at the lightest corner of the re-pitched hero (see Found #1).

**`app/p/[token]/print/page.tsx` and `app/p/[token]/opengraph-image.tsx`**
- Same rule. These go beyond the three surfaces I was assigned, and I am saying so. They printed the same literal. The public OG image is cached permanently by every platform that meets the link, which makes it the same class of fault as defect 2. It was one expression each through the same helper.
- In the shared case the OG credit line is byte-identical to before: "Self-reported · pitchfootball.com.au".

### Defect 2: the guardian-approved share card (`app/g/card/[cardId]/image/route.tsx`)
- It now selects `provenance` with each value.
- A shared tag sits **above** the numbers, as the CV heads its block. I first drew it underneath; rendered, it sat directly under "APPEARANCES" and read as that one tile's tag. Mixed blocks get a tag under each number.
- D-89 still holds: the card carries first name, surname initial, number, positions, stats and a tag about the stats, nothing else. There is a suite check for it.
- **The landscape card (1200x630) was padded by width/14**, which is 86px top and bottom. It was already tight before I touched it (the badge touched the numbers), and the extra line pushed the wordmark into the name.
  - Padding now comes off the shorter side, 45px on landscape.
  - Square and story are taller than wide, so they are pixel-for-pixel unchanged.
  - I rendered all three sizes in the self-reported, mixed and all-coach-verified states, and the old route for comparison.

### Defect 3: the keeper's form

**`app/build/[recordId]/BuildForm.tsx`**
- The default is now `STAT_SETS[positionGroup(positions)]`, in place of the typed-in outfield three.
- **The default follows the positions being picked**, not only the stored ones. A record is created with no positions (`app/join/actions.ts`, `lib/guardian-flow.ts`), so a default read once on first load would give every new keeper the outfield set on their first visit, forever.
- A stored choice wins, and from the first tap the selection is the player's.
- The `surfaced` field is posted only once the player has chosen. The toggles gained `aria-pressed`: correct semantics for a toggle, and what the tests read instead of a colour.

**`app/build/[recordId]/actions.ts`**
- When no selection is posted, the **server** applies the default for the positions it is saving. Without that, a keeper with JavaScript off posts GK plus the outfield set in one request, and the stored choice then wins forever.

### The fixture that hid it (`lib/fixtures.ts`)
- All four house fixtures now take their selection from `STAT_SETS` through a small `player()` factory. None of them writes the answer down.
- **This moves the risk rather than removing it.** A wrong `STAT_SETS` would now change every fixture and still agree with itself. So the permission suite pins the five sets to doc 16 §2's words. I proved this: with GK set to the outfield three, "nate opens on the default for GK" still passes, and the doc 16 pin fails.
- **`tsconfig.json`** gains `allowImportingTsExtensions` (legal under `noEmit`). `lib/fixtures.ts` needs a *value* import of `STAT_SETS`, and `scripts/dev-db.mts` loads it through raw Node, which will not resolve an extensionless TypeScript import. I also tried `.js`: tsc accepts it and Node does not. `build:check` passes with the flag.
- **Other fixtures that pre-supply the answer.** I found three and did not touch them (seed and demo lanes):
  - `scripts/dev-db.mts:388`: the 100 bulk registrants hand-write a second copy of the sets as "GK or else outfield". That gives defenders the outfield set instead of DEF's four.
  - `scripts/demo-layer.mts:757-758`: a correct but hand-copied third implementation of `STAT_SETS`.
  - `scripts/demo-layer.mts:870`: hardcodes the outfield three for squads that include `['LB','CB']` defenders.
  - The schema seat's `guardian_landed` consent row seeded at `dev-db.mts:131` is the same pattern and is still open.

### D-162 inside my files
- Every stat surface already omitted a zero. The one hole was the build form, which printed a stored 0 back into its own input. That is the pre-filled zero D-70 names.
- **What I chose:** a typed 0 is absence. The row is removed at save, and the form never prints one.
- The alternative is "store it, never print it". The cost of that is a zero row that counts as "has stats" on `/home` (`app/home/page.tsx:88`, `value is not null`). Leo, reverse this if you want it the other way.

### Tests (`package.json` passes `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` to `test:perms`, the same as `test:paths`, because the suite now imports `lib/football.ts` and `lib/fixtures.ts`)

**Permission suite, 40 new checks.** No label starts with a doc 14 row id (L4): doc 14 says nothing about how a rendered number is captioned. They cover:
- every stat surface labels from the row, and none types a word;
- every surface handles a mixed block;
- the card reads provenance;
- the card carries nothing else (D-89);
- the label map equals the column's domain, and the three register words;
- five pure rule rows;
- the build form reads `STAT_SETS`, and a stored choice beats the default;
- five doc 16 set pins;
- the fixtures derive their selection;
- two build-form zero rows;
- seven surfaces omit a zero.

**Render suite:**
- `pv-r1`: the keeper's CV serves a source beside clean sheets.
- `pv-r2`: the keeper's form opens with Appearances and Clean sheets pressed, and not Goals or Assists.

**Write suite, `gk-w1` to `gk-w9`:**
- A keeper clears his selection, and the form falls back to the **keeper's** set.
- A post with no selection at all stores the keeper's set.
- The page a club sees shows Clean sheets and no Goals.
- A typed 0 re-opens as the placeholder, and the page drops the tile.

### Proved on the old code (L20)
- **Permission suite:** with the pre-change versions of the seven files put back, **14 of the new checks fail**. With `STAT_SETS.GK` broken, `sharedProvenance` averaging, and "Coach-verified" relabelled, **4 more fail**. The rest cannot fail on old code by construction (for example, the domain check), and I have not claimed they do.
- **Write suite, with only the bug put back** (the typed-in default and the old zero handling, `aria-pressed` kept): 343 passed, 4 failed. **`gk-w3`, `gk-w5`, `gk-w6` and `gk-w8` fail.**
  - `gk-w9` passes vacuously on the old code, because `gk-w5`'s failure had already emptied the selection.
  - `pv-r2` and `gk-w1` read the stored selection. They pass on the old code and are guards, not proofs.

### A coach-verified stat, rendered: the check Leo asked for, which no suite can hold
- It cannot be a committed render check, for three reasons:
  - nothing in the product writes a `coach_verified` stat;
  - the render suite cannot open the database (PGlite serves one connection, and next-server holds it);
  - seeding one would be the exact fixture-supplies-the-answer pattern this task removes.
- So I did it by hand: app stopped, row written through `pg`, app restarted, pages read. Temporary scripts deleted, database reseeded.
- **Mixed state (apps self-reported, clean sheets coach-verified):**
  - `/p/dev-nate` serves `22 | Appearances | Self-reported | 7 | Clean sheets | Coach-verified`, with no block chip. Print is the same.
  - The OG image and the square, landscape and story cards each show the right tag under each number.
  - A trimmed copy of `layout-check.mjs` measured `/p/dev-nate` and its print view: **9 views at 375/390/1280, 0 overflow.** The full layout check in that state was 188 views, all green.
- **All coach-verified:**
  - The CV chip reads "Coach-verified", and **"Self-reported" appears nowhere on the page or on print.**
  - The OG reads "Coach-verified · pitchfootball.com.au".
  - The card carries one "COACH-VERIFIED" above the numbers.
- The images are in `scratchpad/prov-honesty/*.png` for this session only. That scratchpad is shared across agents and gets swept, so re-render if you want them.

## Ran

Final run on `f9e5d37` (app `807efc1` merged), in TRAINING §4 order, each browser suite from a fresh seed:

| Check | Result |
|---|---|
| reseed → **perms** | **1290/1290** |
| **render** | **500/500** |
| reseed → **write** | **355/355** |
| reseed → **layout** 375 1280 | **196 views, 0 overflow**; chrome pass green (22 controls, 196 views) |
| **gate-coverage** | 262/262 pinned, 0 open |
| **palette-check** | ALL GREEN |
| **corpus-check** | 0 failures, 0 warnings |
| **secret-scan** | no secrets |
| **tsc** | clean |
| **build:check** | exit 0, compiled |

At the intermediate `2c9da1d` merge, perms was 1282/1283. The one failure was `qa-silent1` (`app/coach/edit/actions.ts` redirects to `?needs=profile`, and the page never reads it). It was pre-existing on `app` (no coach file differs), and it is fixed by the failure-path merge.

## Found

1. **`--hero` is declared twice in the same `:root`** (`app/globals.css:328` and `:362`), with no closing brace between them. The later one wins, and it is the *old charter* gradient. So the re-pitched hero the 28 Sep commit describes applies nowhere: every `var(--hero)` paints `#123326 → #0a1510`. This is the chrome seat's lane, and I did not touch it. My contrast numbers are measured against both heroes (above).
2. **D-162 zeros still live:**
   - `app/club/squads/page.tsx:141` prints "{n} registered · {n} playing". This is D-162's own example, and it is still there at 807efc1.
   - `app/trials/page.tsx:107/114/122/131`: filter chips carry a count that can be 0, and the gender chips render whether or not anything matches.
   - `app/club/squads/[squadId]/page.tsx:~201`: the position-group counts print "0" (muted) for an empty group, for example no goalkeepers.
   - None of these are my files. The D-162 suite check ("no rendered count is the digit zero") is not written yet.
3. **Provenance at lower fidelity than the row, untouched:**
   - The squad roster (`app/club/squads/[squadId]/page.tsx:282`, "2026 · self-reported") is the surface a TD reads. `fn_squad_roster` returns no provenance, so fixing it needs a migration.
   - The build form's heading "Season stats · self-reported" (`BuildForm.tsx:208`) is true of what the player types, and would sit over a coach-verified value once one exists.
   - `lib/cv-meta.ts:40` gives link previews the text "A self-reported football record on Pitch.".
   - All three need a decision or new copy, so they stay as they are.
4. **Must be settled before D-160 writes a `coach_verified` stat. This is a product decision, not mine.**
   - `lib/cv-build.ts:39`'s upsert does `do update set value = excluded.value` and **keeps the old provenance**. A player editing a coach-verified number would keep "Coach-verified" on a number they typed. `player_stat` also has no provenance trigger, unlike `record_entry` (0015).
   - Options:
     - (a) a player's edit resets it to self-reported;
     - (b) a verified row cannot be edited by the player;
     - (c) a trigger that derives provenance from the actor, as `record_entry` has.
5. **A u16's page freezes provenance at approval** (the snapshot carries it). A later verification appears only when the guardian approves a new version. That is D-119 working, and it errs toward the weaker claim, but BUZ should know before D-160.
6. **"Show nothing" is not remembered.** `surfaced_stats text[] default '{}'` cannot tell "switched every stat off" from "never chose", so the form re-lights the default on reload. The CV correctly shows no block. Persisting "none" is a product decision.
7. **L4 in the suite:**
   - `permission-tests.mjs` labels `Q3:`/`Q4:` test who may *approve* a card. Doc 14 Q3 is card *content* and Q4 is *URLs on a card*, so gate-coverage counts both as pinned when they are not.
   - The content checks that do exist (E12, J60) point at the public OG image, not at the approved card route.
   - My D-89 row covers the card route's content without a row id. I relabelled nothing.
8. `test:paths` (the safe-path suite) is not in TRAINING §4's list, so a normal sweep never runs it.
9. **Tooling traps:**
   - The session scratchpad is shared by every agent. A seat's `devdb.log` overwrote mine, and files vanished mid-run. Namespace a subdirectory.
   - A worktree with symlinked `node_modules` makes Turbopack refuse to start. `cp -Rl` (hardlinks) works and costs about 0 disk.
   - Headless Chrome `--window-size=375 --screenshot` lays the page out wider than 375. Only trust `layout-check`.
10. **The card's background is a pasted radial gradient.** ImageResponse cannot read CSS variables, and `lib/palette.ts` has no hero value. I added no gradient, and the tag contrast on it is 6.1–6.6:1.

## Copy for BUZ

**No user-visible string that can render today changed.** `pv-r1` and the render suite confirm "Self-reported" is served exactly where it was, and the OG credit line is unchanged.

**Two words are in the label map and render only when a stat carries that provenance.** Nothing can write such a stat today. They need BUZ's yes before D-160's write path merges. If he says no, it is one line in `lib/football.ts`.
- "Coach-verified". This is D-62's own word, and it is already on screen in the site preview as "Coach-verified development".
- "Official import". This is D-62's own word and is new to the screen.

**Visual changes to the approved artefact, for BUZ's eye:**
- On the share card, the source line sits above the numbers.
- On the landscape card, the margins go from 86px to 45px.

No other string is new. `aria-pressed` is a state, not copy.

## Risks

- The mixed-provenance branch cannot be reached by any suite until something writes a `coach_verified` stat. It is proven by hand once, plus pure rules and static checks, and a refactor could break it silently until D-160 lands.
- The `tsconfig` flag is global. `build:check` and `tsc` pass, but the other open branches have not run with it.
- The build form's live-following default is my reading of D-105. The alternative is that the default applies only on first open.
- The typed-0-is-absence rule is my reading of D-162.
- I did not check the club demo (54323), a real phone, or the story card at 3 tiles with mixed provenance. Square and landscape were rendered with 2 tiles.

## Lesson

**A fixture derived from the code agrees with the code by construction.** Stopping a fixture from pre-supplying the answer is not enough: pin the source it now derives from to the spec's own words, or the fixture goes on hiding the same bug from the other side.
