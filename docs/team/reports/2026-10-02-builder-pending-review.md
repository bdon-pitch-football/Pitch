# builder: the full /g/pending review, every child write waiting on it, and doc 14 D14 (2026-10-02)

Asked (Leo, last build of the release; BUZ said "Yes" to both):
- **A.** The full `/g/pending` review, in BUZ's words (design d502bee #sec-pend-all, artboards 7–7e, spec D).
- **B.** Every write an under-16 makes for themselves opens the waiting version.
- **C.** An edited verified stat becomes self-reported again (John, `JOHN-to-LEO-edited-stat-loses-verification-2-oct.md`), with a doc 14 row.

Branch `build/batch-fixes`, starting at 4a5b169. Same worktree and ports (DB 54571, app 3371, CDP 9571).

## Did

- **lib/pending-diff.ts (new, pure).** `pendingDiff(approved, pending)` compares the approved and waiting versions kind by kind:
  - **About, photo:** old value against new.
  - **The four lists** (Highlights, Clubs before this one, Achievements, Other football): counted added and removed entries. Entries are compared by their fields, so key order is ignored, and a null field counts the same as a missing one.
  - **Football details:** one row per changed field, "{label}: {old} → {new}", with the builder's labels (Positions, Number, Preferred foot, stat names) and "—" for empty. A stat of 0 reads "—", and 0 → empty is no change. A changed stat carries its new value's source label, which after any edit is "Self-reported".
  - **School entries** never count and never render (D-161).
  - `changedKinds()` is the list of sections the page renders, in the page's order.
- **app/g/pending/[recordId]/page.tsx: one section per changed kind,** in order: About, The photo, Highlights, Clubs before this one, Achievements, Other football, Football details.
  - Each section uses the About's own purple diff card.
  - **Photos:** both sides are signed private addresses (`imageSrc`), minted after the guardian check. A path that is not private is never drawn. A side with no photo shows the "No photo yet" tile.
  - **Clips:** a click-to-play façade (new `ClipFacade.tsx`). Nothing loads until it is pressed, and then the clip opens in a new tab with no referrer. No iframe.
  - **"Nothing is waiting on you."** shows only when no kind differs. The old `pending_about` test is gone.
  - **The Approve form** carries the waiting version's id and the md5 of its content.
- **app/g/pending/[recordId]/actions.ts and `approvePendingVersion`.**
  - The approval finds the waiting version only by that id and hash.
  - A version that has changed since the page was drawn is refused: nothing publishes, and the press lands back on `/g/pending/{id}`. No new words.
- **B: one waiting path for every child write (`submitChildChange` in lib/cv-build).** The build form's save, every clips and more action, and the photo route all use it.
  - `writeRecord` takes the record lock with the age band. An under-16's own write opens or updates the waiting version and sends doc 15 §30 to every guardian after the commit.
  - The photo route now writes through `writeRecord`. The old path, where a child's photo rode the next save unseen, is gone.
  - The parent's patch rules are unchanged.
- **0169, edited in place.**
  - **A waiting version the guardian's patch makes identical to the page is deleted.** That happens when the child's only change was a field the guardian then decided, so nothing of the child's waits any more and /home stops saying something waits.
  - **List removals and the idempotent add** compare entries with nulls stripped, the same tolerance the review uses.
- **C: doc 14 D14 (new row, §D).** "A non-coach edit to a coach-verified stat's value … provenance becomes self_reported", tested for player, guardian and coach.
  - The behaviour already existed in 0083's `player_stat_provenance_guard` trigger. My earlier "Found 1" (that an edited verified stat kept its provenance) was wrong. No product change was needed.
- **app/globals.css:** the review's parts (`.ph-pair`/`.ph`, `.facade`, `.row.chg`, `.row-t.gone`, `.det*`, `.pill-chg`), all on tokens.
- **docs/team/APPROVALS-28-SEP.md:** BUZ's /g/pending words under a 2 Oct heading.

## Ran

Final code, TRAINING order: reseed → `next dev -p 3371` → perms → render → write → reseed → restart → layout → timing (fresh large-heap app) → the rest.

| Suite | Result |
|---|---|
| perms | **2206/2206** |
| render | **826/826** |
| write | **659/659** |
| layout | **274 views at 375 and 1280, ALL GREEN** |
| timing | **24/24** |
| palette | ALL GREEN |
| tsc | 0 |
| `.next-check` build | exit 0 |
| csp-prod | 5/5 |
| corpus | 0 |
| secret-scan | none |
| gate-coverage | **266/266**, 0 open (D14 added) |
| validate-migrations | ALL GREEN |

**New checks:**
- **perms:**
  - pd-1 to pd-4: one section per kind and no other; 7b (blank About plus a photo shows The photo, never "Nothing is waiting"); detail rows, "—" never 0, Self-reported; school never; first page; a second copy of an entry.
  - pd-5: the page source.
  - pd-6: exactness, id plus hash.
  - pd-7: an identical waiting version is dropped, while one with content of the child's keeps waiting.
  - pb-1: every child write uses one path.
  - D14, D14b, D14c: player, guardian, coach.
- **write:**
  - bf-pend-w0: Deniz's first photo; "No photo yet" beside a signed new one.
  - bf-pend-w1: a clip alone waits, shows under Highlights alone as Added, and is approved seen.
  - bf-pend-w2: the same for an achievement.
  - bf-pend-w3: a photo waits at once with no save; The photo alone; both images signed and private; approved.
  - bf-pend-w4: a press on a version that moved is refused, back on the review, which now shows both changes.
  - bf-pend-w5: Football details "Appearances: 87 → 31 Self-reported", a blanked stat "—", never a 0.
  - bf-pend-w6: "Nothing is waiting on you." once everything is approved.

**Red on 4a5b169 (L20).** I put 4a5b169's `lib/cv-build.ts`, /g/pending page and actions, photo route and globals.css back, removed the two new files, and kept the new tests:
- **perms: 11 red:** photo8, photo13, photo13c, bf-s2-1, pd-1, pd-2, pd-3, pd-4, pd-5, pd-6, pb-1.
- **pd-7:** red with only its one delete line removed from 0169.
- **D14, D14b, D14c: green on 4a5b169, and they cannot be red.** The rule has been in the database since 0083.
- **write: 7 red,** each for the defect:
  - bf-pend-w0: no photo section, because the photo did not wait;
  - bf-pend-w1, w2: no section, because "Nothing is waiting";
  - bf-pend-w3: no photo section;
  - bf-pend-w4: no version in the form;
  - bf-pend-w5: About only;
  - bf-b1-w6: one submission, not four.
- **bf-pend-w6** (the end state) passes on both, by design.

**Moved checks (none loosened):**

| Check | Change |
|---|---|
| photo4 | reads the route's statement on `client.query` |
| photo8 | the route writes only through `writeRecord`, handing over `{ set: { photoPath } }` |
| photo13, photo13c | classify the review (mints) and pending-diff (rules) |
| bf-s2-1 | the lock comes with the band, plus the child branch |
| bf-b1-w6 | "Georgia submitted a change" ×4, since her clip, achievement and photo now wait |
| jb-f14-w4 | after her parent decides her only field, her About is gone from the review and it says "Nothing is waiting on you." |
| photo-w3 | after his parent's photo decides his only change, nothing waits and the page keeps the parent's photo |

**Screenshots** (untracked) are in `docs/design/reports/2026-10-02-pending-shots/`:
- `every-change-{390,1280}.png`, from a state built through the app as Deniz: his first photo, a clip added and one removed, a previous club, an achievement, futsal, positions, number, appearances, assists blanked, About;
- one crop per section at each width, `every-change-{width}-{section}.png`;
- `nothing-waiting-{390,1280}.png`.

The same scratch run measured the every-kind state: scrollWidth equals the viewport at 390 and 1280, and no control is under 44px.

## Found

1. **Each child write now sends doc 15 §30 to every guardian.** Five clips is five emails per parent. That is the same path as the build form's save, as briefed, but it is new volume. BUZ or John may want one email per waiting version.
2. **A change only to which stats show (`surfacedStats`) is not drawn.** Spec D lists no label for it, so on its own it reads "Nothing is waiting on you." and publishes with the next approval. The same applies to the snapshot's club and squad fields, which change only through the club and guardian flows. A waiting version that differs from the page only in such fields stays, unshown, and /home's "waiting" line still counts it.
3. **The layout check does not walk an every-kind variant** (spec D's done-when). I measured it in the scratch run above, not in the suite. Adding it needs a seed child with every kind waiting.
4. **The seed's approved snapshots are fixture-shaped, not `buildSnapshot`-shaped** (no `note` key, a school entry). The review and the patch now compare entries tolerantly, which is how I found it.
5. **An under-18's photo still at a public address** (before `scripts/private-photos.mts` runs) shows on the review as the camera glyph only. It is never drawn from a public URL.

## Stopped on

Nothing.

## Copy for BUZ

**Added, BUZ's words verbatim (approved 2 Oct):**
- "Everything that changed is below. The rest stays exactly as you approved it."
- "The photo"
- "Football details"
- "Added"
- "Removed"
- "No photo yet"

**Removed:** "Only this change needs you. Everything else stays exactly as you approved it."

**Existing words in new places:** "Highlights", "Clubs before this one", "Achievements", "Other football", "Positions", "Number", "Preferred foot", the stat names, "Self-reported", the kind pills, YouTube/Instagram/Veo, "You approved this on {date}", "Nothing approved yet", "The new version", "(empty)", "—", and the aria-label "Play {title}" (ClipCard's).

## Migrations

0169 edited in place (the publication drops an identical waiting version; list matches strip nulls). No 0170. Doc 14 gains D14.

## Risks

- The approval's exactness compares `md5(content::text)`, which is stable for jsonb, but **an unchanged page re-rendered after any child write is refused once**. That is by design.
- The façade opens the clip in a new tab instead of playing inline.
- **Not checked on a phone by hand.**

## Lesson

A review screen is only as honest as its diff. The first run showed "changes" that were key order and null-versus-missing between versions written by different code. Compare entries by the fields that render, and test against the oldest shape a version can have.
