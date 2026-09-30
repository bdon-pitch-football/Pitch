# Copy check: Floodlit player CV, 1 Oct 2026

**Branch:** `design/player-cv` (worktree `.claude/worktrees/player-cv`). Uncommitted changes checked against `HEAD`.
**User-visible files:** `components/cv/PlayerCV.tsx`, `components/cv/StatTile.tsx`, `components/cv/ClipCard.tsx`. The other files in the diff are `CLAUDE.md`, `docs/06-Register.html`, `lib/club-colours.ts` (a flag, held off), `app/globals.css` and `scripts/permission-tests.mjs`. They put no words on a screen. The only `content:` values in the new CSS are `''`.
**Brief:** no word changes at all.
**Verdict: PASS WITH FIXES.** No sighted reader sees a word change. Every string and every band gate is byte-identical to `HEAD`. There is one real loss: a screen reader no longer hears the clip subtitle (F1). There are also two small screen-reader and link points (F2, F3). None of them touches a banned word, doc 15, or a minor-only line.

---

## 1 · Approval list for BUZ

**3 items await BUZ's look. None has a new word.** Two are the same facts in a new arrangement. One is an approved string that is new to this screen. Everything else on the page is listed after them, word for word, so BUZ can confirm nothing moved.

### Awaiting a look (same words, new form or new place)

| # | Where | Before (HEAD) | Now | Meaning changed? |
|---|---|---|---|---|
| A1 | Card, under the name | One line: **AM · LW · #10 · Right footed** | Four chips: **AM** · **LW** · **#10** · **Right footed**. The first position is filled green, as its dot on the map already was. | **No.** The same four facts in the same order. The only new signal is the green fill on the first position, and the map already said that (the first dot has always been the filled, pinging one). |
| A2 | Card, club block | One line: **Riverside FC — U15 Blue · Brunswick VIC** | Two lines beside the crest: **Riverside FC — U15 Blue**, then **Brunswick VIC** smaller and dimmer | **No, as built.** The locality sits inside the crest-and-club block, one step down in weight, so it reads as the club's suburb. It would change meaning if it ever came out of that block and sat alone under the name, where it would read as the child's suburb. The comment at `PlayerCV.tsx:210` says so. Keep it nested. |
| A3 | Nav bar, top of the CV (every caller: `/p/[token]`, club register and squad views, build preview) | No link. HeaderMark showed only the wordmark. | Screen-reader label on the logo: **Pitch, home** (a link to `/`) | Words approved 1 Oct (Floodlit build, SiteNav). New on this screen. See F3. |

### Unchanged — confirmed byte-identical to HEAD (mechanical extraction plus a fixed-string grep of each one)

**Card (hero)**
- `{firstName} {lastName}` (h1)
- `{ageGroup} · born {quarter}`, e.g. **U15 · born Jan–Mar** (only when both halves are present, as before)
- `{club} — {squad}` (em dash, as before)
- **Parent-approved** (minors only, `isMinor`, the same gate). It now shows in tracked caps, *PARENT-APPROVED*. The source text is unchanged and screen readers still read "Parent-approved".
- **Season 2026** (now 11px tracked caps instead of 10px)
- Provenance chip: `PROVENANCE_LABELS[shared]`, only while every tile shares one source (the same rule)
- Stat labels: `STAT_LABELS[key]`. Per-tile source: `provenanceLabel(...)` when sources differ.
- Drill well: **`{STAT LABEL} · {value}`** and `provenanceLine(...)`, e.g. **Verified by Riverside FC · 2 Sep 2026** / **Self-reported · entered 14 Mar 2026**
- Hidden checkbox label: `STAT_LABELS[key]`

**Story**
- Section headings: **About** · **Highlights** · **Achievements** · **Football history** · **Other football**. They are now passed through `sectionTitle()` with the same text. Each is still omitted when its section is empty.
- Clip subtitle, first card only: **Goals, assists & link play**, or **Veo clip** for a keeper
- Clip button label: **Play {title}**, or `{title}` with no URL
- Football history: `{club}`, `{squad} · now`, `{orgName}`, `{period}`
- **Earlier clubs are {firstName}’s own account of where they played. Only the club at the top is one we hold on Pitch.** The current club still heads the new vertical timeline, so "at the top" still holds at every width.
- Other football: **NTC** / `{kind}`, `{orgName}`, `{period} · {note}`
- **There is no way to reply to a family through Pitch.** (minors only, the same gate)
- **At any tier, for anybody — it is the same rule for every under-18 on here. If you want {firstName} at a trial, post it on Pitch: families register their interest from your trial, and that is where you can invite them. It goes to {firstName} and their parent together, and a record is kept.** (minors only, the same gate)
- **Report this page**. The same href, now a 44px tap target.

**Band check.** `isMinor = p.band !== '18plus'` is unchanged, and it still gates exactly two things: Parent-approved and the no-reply notice. `renderableExperience(p.otherFootball, p.band)` is unchanged. No string now renders for a band it did not render for before. Nothing that rendered for a band has been removed. The club-colours theme is not gated by band, but `CV_WEARS_CLUB_COLOURS = false`, so it renders nothing today (see N2).

**Removed.** No words were removed. Three things did change:
- The big squad number behind the name is now `aria-hidden`. Screen readers no longer read a bare "10" before the name. The **#10** chip still carries it.
- The club row no longer renders when both club and squad name are empty. Before, that state could print a bare " · Brunswick VIC". Live records can't reach it: `record-read.ts:202-206` and `cv-build.ts:182-184` take the locality from the same membership as the club.
- The clip subtitle has gone for screen readers (F1).

---

## 2 · Problems

### F1 · The clip subtitle is no longer read by screen readers. `components/cv/ClipCard.tsx:35`, `:53`, `:61`
**Rule:** anything removed. The brief says every string should be as before, for every reader.
Before, **Goals, assists & link play** / **Veo clip** sat under the button as plain text. Now the caption sits *inside* the `<button>`, and that button has `aria-label={url ? \`Play ${title}\` : title}`. An `aria-label` replaces the button's content as its accessible name, so VoiceOver and TalkBack say "Play {title}, button" and never read the subtitle. The title survives because it is inside the label. The subtitle does not.
**Smallest fix:** give the subtitle span an id and point the button at it:
```tsx
const subId = useId();              // ClipCard is already a client component
<span id={subId} …>{sub}</span>
<button aria-label={…} aria-describedby={sub ? subId : undefined} …>
```
The words stay the same.

### F2 · The card's new region label repeats the name. `components/cv/PlayerCV.tsx:188`
**Rule:** consistency and plain reading. It adds no new word, but it is a new accessible string.
`<section aria-label={\`${p.firstName} ${p.lastName}\`}>` makes a screen reader say the player's name as a region and then again as the h1 straight after. It exposes nothing new, because it is the same data as the h1.
**Smallest fix:** `aria-labelledby` pointing at an id on the h1 (`cv-name`), instead of a second copy of the name. Or drop the label.

### F3 · The CV now carries a link, and the code comment says it doesn't. `components/cv/PlayerCV.tsx:182-184`
**Rule:** honesty, in the code's own promise. A copy-adjacent point, and Leo's call.
The comment says "No links on a tokenised page — the reader was handed one link." But `SiteNav` always renders the logo as `<a href="/" aria-label="Pitch, home">`, and HEAD's `HeaderMark` had no link. The token does not leak: `/p/:token*` is served `Referrer-Policy: no-referrer` (`next.config.mjs`). This link also appears in the club register and squad CV views and in the build preview. There it is a second header under their own back bars, and it takes a signed-in TD to the public front door.
**Smallest fix, pick one:** (a) render the wordmark without its link on the CV, as HeaderMark did; or (b) keep the link and correct the comment. Either way the words are already approved.

---

## 3 · Notes (no fix needed for this change)

- **N1 · Chips and locality.** They don't change meaning (A1, A2 above). Keep the locality inside the crest block.
- **N2 · Preview honesty when club colours go on.** `app/build/[recordId]/preview` tells a player or parent: "This is exactly what a club sees when you send your page." Today that holds, because the flag is off and no caller passes `clubColours`. When John clears the flag, the preview has to get the same `clubColours`/`clubState` as `/p/[token]`. If it doesn't, that sentence becomes untrue for a claimed club. Please add this to the flag's checklist.
- **N3 · Already true at HEAD, not a drift.** If `p.club` is empty and earlier clubs exist, "Only the club at the top is one we hold on Pitch" points at a club the player typed in themselves. Live records can't reach that state today, because a CV needs a current membership. If they ever can, the smallest fix is to render the second sentence only when `p.club` is set.
- **N4 · Outside my lane, for design review.** Achievement icons moved from green to amber (`PlayerCV.tsx:272-275`), and D-173(4) says amber is a state colour only. The filled green first-position chip may read as a button, and D-173(4) says green is an action. Neither is a word, so both are flagged here without a ruling.
- **Banned words.** None in the changed files (a grep for potential, insights, struggling, elite, talent identification, application/applied/declined/rejected/unsuccessful, soccer, footy). The two "free text" hits are code comments.
- **Doc 15 and `lib/messages.ts`.** The CV sends nothing. The on-page no-reply notice keeps its HEAD wording. It comes from John's U-11 ruling (the same sentences as doc 15 §377), and `hist11` still pins it.
- **Honesty.** There is no age or identity claim, no free/paid claim, no coming-soon promise and no invented control. Provenance labels still name the club and never a coach.
- **Checks run:**
  - `npm run -s test:perms`: **1948 passed, 0 failed**. That includes `ban1` (no D-108 words on any screen), `url1`, `hist10`–`hist13`. `hist13` now reads `.cv-rise` from `globals.css`, where the rule moved; the property checked is the same.
  - `python3 scripts/corpus-check.py`: **1 failure, not from this change.** S2 flags '15 Sep' in `docs/design/reports/2026-10-01-floodlit-safety-review.md`. That file is committed at HEAD and is not in this diff.
