# Audit: the Floodlit player CV, as built, against its approved design

**Date:** 1 Oct 2026 · **Seat:** design audit · **Build:** worktree `player-cv` (branch design/player-cv, uncommitted), served at http://localhost:3037, fresh seed, read-only
**Design:** the published preview `scratchpad/proto/player-cv.html`, rendered in headless Chrome at the same widths
**Pages:** `/p/dev-deniz`, `/p/dev-nate`, `/p/dev-jordan`, `/p/dev-georgia`, `/p/dev-expired` at 390, 820 and 1280. Extra checks: 1024×768, 1280×720, 1440×790 (a 13" laptop's Chrome viewport), stat wells opened, and long names and a long clip title injected into the page (DOM only, nothing submitted).
**Captures:** `/private/tmp/claude-502/-Users-bdonmez22-Desktop-Life-Work-Pitch-3-0/adca61ff-729e-405b-9eb7-6c2d4cb5e557/scratchpad/audit-cv/` (build `<who>-<w>.png`, design `proto-*.png`, zooms `z-*.png`, stress tests `long*-*.png`, `drill-*.png`, `v720-*.png`, `mba-scroll.png`)

**Verdict.** The build matches the design closely. The layout, the card, the order of sections, the stat block and the notice all follow the preview, and both agreed differences are in: the first position chip is outlined, and the achievement icons are neutral. The stats show in the first screenful at every width, including 1280×720 and 390×844. The 1280×720 rule works: the card is `position: static` there and scrolls away with the page. There is one showstopper, and it came from the design, not the build: a long surname gets cut off. The rest is spacing and edge cases. The worst of those show on a laptop.

---

## Findings, worst first

### 1. Showstopper: long surnames are cut off, and a laptop is where it is worst
`.cv-name` is `clamp(38px, 11vw, 54px)`. It is sized by the **viewport**, but on desktop it sits in a **440px card**. From about 490px wide it is always 54px, so at every laptop width it has only 386px to fit into. There is no `overflow-wrap`, and the hero has `overflow: hidden`. So any single word wider than about 386px (roughly 13 letters of Archivo 900) is cut off at the card's rounded edge. There is no wrap and no ellipsis.
- `long3-1280.png`: **"Konstantinidis"** runs into the card's right border. The last letter is sliced.
- `long-1280.png`, `long-1024.png`: in **"Papadopoulos-Nguyen"** the hyphen falls under the edge.
- `long2-390.png`: on a phone, **"Christodoulopoulos"** shows as "Christodoulopou".

For a Melbourne club market, 13–18 letter Greek, Italian and Turkish surnames are ordinary, not an edge case. The name is the headline on this page. A cut-off child's name, on the page a family sends to a club, looks broken. The preview has the same CSS, so this bug came from the design. It still ships. None of the five seeded players triggers it, which is why nobody has seen it.

### 2. Looks amateur, all widths: every title touches the line under it
The body's `line-height` is `normal`, which is about 1.07 for Archivo. The preview ran at 1.45. So every title-and-meta pair in the story has nothing between the two lines. A 16px club name sits in a 17px box, and its 12.5px meta line starts 0px below it. This affects the football history timeline, the achievement cards, other football, the club block in the card and the clip captions. Compare `z-b-ach.png` (build) with `z-p-ach.png` (design): in the design, "Riverside FC / U15 Boys · now" reads as a heading with a caption under it, and in the build it reads as one squashed label. It is most visible at 1280, where the history column has room around it and the rows still look crammed.

### 3. Looks amateur, worst on a laptop: the short-laptop rule catches ordinary laptops
`@media (max-height: 820px) { .cv-cardcol { position: static } }` does what it was asked to do at 1280×720 (checked: `static`, and the card scrolls off, `v720-scroll.png`). But 820px of viewport height also includes a 13" MacBook Air in Chrome (a viewport of about 1440×790) and every 1366×768 laptop. On those, after one scroll, the left 40% of the screen is empty beside the story (`mba-scroll.png`, Nate at 1440×790). It reads as unfinished. So the sticky card, which is the point of the desktop layout, will be missing on the machine BUZ most likely demos on.

The card is 541px tall, and 607px with a stat well open. With the 76px sticky offset that is 683px, which fits in 720. A rule that checks whether the card fits the viewport, rather than a fixed 820, would keep the design on those screens. This is a decision for the builder and the safety reviewer (N4), not something I change.

### 4. Looks amateur, 1024 to about 1100px: clip titles run into the play button
At 1024 the story column is 468px, and each clip card is 228px wide by 142px tall (16:10). "Season highlights 2026" wraps to two lines and ends up 2px under the play button (`z-1024clips.png`). A longer title, "Full match vs Northern United — second half, Round 14", sets over the green button (`long-1024.png`). At the same width the achievement titles also wrap to two lines ("U15 League — / Runners up"). This is also an iPad in landscape and a small laptop window.

### 5. Looks amateur: the pressed stat tile
When you open a stat's provenance well, the tile gets a square-cornered grey slab. On the first tile the "18" and its labels sit flush against the slab's left edge with no inset. The slab covers the hairline divider and meets the 12px-radius well below it with a square edge (`z-drill390.png`, `z-drill1280.png`). The well itself is good. The selected state looks unfinished.

### 6. Minor: three of the four players have no crest, and the club block changes shape
Only Riverside FC has a crest, so on Deniz's card the club line is indented behind a 28px shield. On Nate, Jordan and Georgia the club line starts at the left edge with nothing beside it. The design shows an initials tile ("NU", "MC") for these. With 183 unclaimed clubs and no crests, the no-crest version will be the common case, so it should be designed for rather than simply falling out of the conditional. If a tile is added, it stays neutral on an unclaimed club (D-172).

### 7. Minor: widows in card titles
"Golden Boot — State League / **2**" leaves the "2" alone on its own line (`jordan-1280.png`, and in the design too). The achievement and clip titles have no `text-wrap: balance` / `pretty`.

### 8. Minor, 820: the notice stops short of the right edge
The "no way to reply" notice has `maxWidth: 680`. At 820 every other block runs to x=792 and the notice stops at about 745 (`deniz-820`, `nate-820`, `georgia-820`). At 1024 and 1280 the column is narrower than 680, so the edges line up there.

### 9. Minor: provenance and colour weight
In the build, COACH-VERIFIED is set exactly like SELF-REPORTED (9px/800 at .72 white). The one number a coach vouched for can only be told apart by reading the tiny caps. Separately, the goals number is always green. On Deniz it is coach-verified, but on Nate, Jordan and Georgia it is self-reported. A reader will take green to mean "checked", and under D-173 green means an action. Both are in the approved design, so they are for the design lead or BUZ, not a build defect.

### 10. Minor: things the build does differently from the preview
- The clips' "01 / 02 / 03" ghost numerals are gone, and so is the "Nothing loads until you press play" caption. The safety review records the caption change. Check whether dropping the numerals was deliberate.
- The nav has no "Sign in" on the right at 1280. It looks deliberate (tokenised page).
- The About text is a fixed 18px where the design grew to 22px. **The build is right** (D-173: body copy never scales).
- On a phone and at 820 the design set the stats in a darker band closing off the hero. The build uses a hairline, so the hero fades into the page. This is acceptable, but the card reads a little less like one object at those widths.
- The GK's ghost "1" shows as stray vertical lines behind the pitch diagram (`nate-1280`). This is in the design too.
- The footer's left edge (40px at 1280, 18px at 820) does not line up with the content edge (80 / 28). The footer is a shared site component.

### Not changed: `/p/dev-expired`
Not in the diff, and it renders as before at all three widths. For the record, two older issues sit outside this change. At 1280 it has no nav bar and puts the logo top right in a 640 column, while the live CV at the same URL shape has the Floodlit nav with the logo top left. And it stacks two explainer panels one after the other, which breaks "say it once".

---

## First-frame emptiness per capture

This is my own measure, not `screens.mjs`: the share of 10px blocks in the first 880px (844 on a phone) that are flat colour. Flat card fills count as empty, so the figures run high. Use them to compare the build with the design, not as absolute numbers.

| Page | 390 build / design | 820 build / design | 1280 build / design |
|---|---|---|---|
| Deniz (U15, mixed provenance) | 64 / 60 | 79 / 77 | 74 / 73 |
| Nate (17, GK) | 64 / 60 | 81 / 80 | 77 / 73 |
| Jordan (adult) | 66 / 59 | 77 / 79 | 75 / 75 |
| Georgia (U15 girl) | 61 / n/a | 80 / n/a | 76 / n/a |
| Expired | 59 / n/a | 78 / n/a | 85 / n/a |

The build sits within about 4 points of the design everywhere. The tighter line-height (finding 2) accounts for most of the small rise. Georgia is the sparsest page: one clip, one achievement and one futsal entry, so the right half of the story is empty at 820 and 1280. It reads as a quiet record rather than a broken one, because empty sections are left out rather than drawn as bare headings.

## What is genuinely good, the standard for the rest

1. **Deniz at 1280 (`deniz-1280.png`).** The card is one composed object. Initials, name, context, chips, club, provenance and the season numbers read in one pass, and the stat numbers are the loudest thing after the name. The edges line up: the logo at x=80 is the card's left edge, and every section rule, clip pair and achievement pair ends at 1200. On a laptop this is the page a club should see.
2. **The phone (`deniz-390.png`, `nate-390-first.png`).** The hero runs full-bleed, then the stats, then About. For a normal name, the name and all the numbers are in the first screenful. Nothing is squeezed, and the order is the order a coach wants.
3. **820 looks intentional (`jordan-820.png`, `deniz-820.png`).** It is not a phone stretched wide. The hero uses the width, the name runs on one line, the three stats take thirds, and clips and achievements go to two columns on shared gutters. The logo's right edge sits on the content edge.
