# builder: one email per waiting version, one answer to "waiting", the review for an under-16's guardian only (2026-10-02)

Asked (Leo, after the /g/pending merge at 651219e, then the safety review of that build):
1. Email volume: doc 15 §30 goes once per waiting version.
2. One definition of "waiting", shared by /home, the email and /g/pending.
3. S-1: the review and its Approve are for an under-16's guardian only.
4. N-3: a child's add-then-remove floods nobody.
5. S-2 stays as briefed.

Fast-forwarded `build/batch-fixes` to `build/full-release` (651219e, then dc2e16d with the review). Same worktree and ports (DB 54571, app 3371, CDP 9571).

## Did

- **lib/pending-diff.ts: `isWaiting(approved, pending)`.** A waiting version waits only if it exists and differs from the approved page in a kind the review draws. That is the one definition everything below now uses.
  - The club, squad and locality lines are not drawn. They come from the membership, not from the child, and are overlaid at read by `fn_cv_club`.
  - Which stats are shown (`surfacedStats`) is not drawn either.
  - Neither of those ever makes a version wait.
- **lib/cv-build.ts.**
  - **`submitChildChange`, the one path for every write a child makes:**
    - It reads the approved and waiting content before the write.
    - If the record no longer leaves anything for a guardian to see (`!isWaiting`: an add then a remove, or a change only to which stats are shown), any waiting version is deleted. Nothing is sent and no `edit_submitted` is logged (review N-3). The change stays on the live record, so the next waiting version is built from it.
    - Otherwise it upserts the waiting version and logs as before. It tells the guardians only if the version was **not already waiting** (`tell = !isWaiting(approved, before)`), which is once per waiting version.
    - `saveCvDraft` and `writeRecord` send the email only on that `tell`.
  - **`waitingRecords(recordIds)` (new):** record → when the waiting version was written, for the records where `isWaiting`.
- **The surfaces that say something waits now ask `waitingRecords`.** Before, each asked only whether a pending row existed.
  - `/home`: the parent's "{child} changed the page" item.
  - `/build/[recordId]`: the child's "Your parent will see this change before it goes out."
  - `/build/[recordId]/preview` and `/ready`: the waiting lines.
  - `/g/pending` already used the same diff.
- **app/g/pending/[recordId]/page.tsx and actions.ts (review S-1).** The page and `approveChange` now ask `requireRecordAuthor` and send anyone whose actor is not `'guardian'` home. That is the E15 pattern: `fn_record_author` answers 'guardian' only for an under-16's approved guardian. A 16–17's guardian, or a re-granted guardian of an adult, is no longer shown a version left from before the sixteenth birthday, and can approve nothing.
  - The approved state's share-link press is now offered to everyone who reaches the page, because only the guardian it would let mint can reach it.
  - Stale comments updated (L25).
- **Doc 14 R13 (new row, §R):** "A guardian of a 16–17 (or a re-granted guardian of an 18+) opens `/g/pending` or presses its Approve | **Denied** …".

## Ran

Final code, TRAINING order: reseed → `next dev -p 3371` → perms → render → write → reseed → restart → layout → timing (fresh large-heap app) → the rest.

| Suite | Result |
|---|---|
| perms | **2209/2209** |
| render | **826/826** |
| write | **663/663** |
| layout | **274 views at 375 and 1280, ALL GREEN** |
| timing | **24/24** |
| palette | ALL GREEN |
| tsc | 0 |
| `.next-check` build | exit 0 |
| csp-prod | 5/5 |
| corpus | 0 |
| secret-scan | none |
| gate-coverage | **267/267**, 0 open (R13 added) |
| validate-migrations | ALL GREEN |

**New checks (none mislabelled, L4):**
- **perms:**
  - **pw-1:** `isWaiting` is false for no version, for a change only to which stats are shown, and for a club, squad or locality change. It is true for anything the child wrote, and for anything at all when nothing is approved yet.
  - **pw-2:** /home, the builder, the preview and ready ask `waitingRecords`, and none asks only whether a pending row exists. `isWaiting` is the review's diff. A write that leaves nothing to see drops the version and tells nobody. The email goes once, when a version first waits.
  - **R13:** `fn_record_author` is null for Nate's guardian and for Marcus's (an adult), and 'guardian' for Georgia's. The page and the Approve both send home before anything is read or approved.
- **write** (in the photo block, before the sweep gives Alex a coach seat; from then on his /home is the coach console, which lists no child):
  - **bf-wait-w1:** /home and /g/pending agree. Both list Deniz's waiting About change, and neither does once it is approved. Then a change only to which of his stats are shown: neither lists anything, and no email goes.
  - **bf-mail-w1:** three achievements in a row send one §30 email per guardian, and both surfaces list the change.
  - **R13:** Alex on `/g/pending/{Nate}` and `?done=1` gets 307 to /home, and a crafted Approve with the review's own form gets /home.
  - **bf-mail-w2:** Deniz adds an achievement and removes it. Nothing waits on either surface, and only the add sent an email.

**Red on 451c6e0 (L20).** I put 451c6e0's versions of the eight product files back and kept the new tests:
- **perms red:** pw-1, pw-2, pb-1, R13, E15b, and act12 (shown on its own; it now reads only `approveChange`, because the share press's identical lines had made it match on the old file).
- **write: 4 red, each for the defect:**
  - **bf-wait-w1:** /home listed a display-only change and an email went.
  - **bf-mail-w1:** three emails instead of one.
  - **R13:** 200 for Nate's guardian, and the press landed on `/g/pending/{Nate}` instead of home.
  - **bf-mail-w2:** /home still listed the version the remove had emptied.
- I re-ran the old-code write proof after correcting bf-wait-w1's fixture (below). The same 4 were red, and bf-wait-w1 now shows the disagreement itself: `[true,false]`, /home listing a change the review calls "Nothing is waiting on you.".

**Moved checks (none loosened):**

| Check | Change |
|---|---|
| act12 | the approval asks the author rule, read from `approveChange` alone |
| jb-n10-2 | /g/pending is no longer among the surfaces a 16–17's guardian keeps |
| E15b | the page itself is the author rule; the 16–17's guardian keeps `fn_record_actor` everywhere else |
| pb-1 | the child path returns `tell` |

**A fixture correction, said out loud (L32).** The seed writes Deniz's waiting About into the version only, never onto his live record, which no real save does. After it is approved, any later save of his reads as an About change. bf-wait-w1 therefore carries the approved About in its display-only save, and the comment says why.

## Found

1. **The review's S-2 stands as briefed.** A change only to which stats are shown is not drawn, does not make anything wait, and rides the next approval. The harm is bounded, because every stat value is still diffed.
2. **Review N-5 is not built:** a waiting version left from before 16 still holds its photo. With R13 nobody can see or approve it any more, but the row and its private photo stay until erasure. A cleanup at the sixteenth birthday (R11) would end that; that is for John.
3. **Review N-1 (other football's note) and N-2 (stats keyed by season and key, the first entry only) are unchanged.** Neither is reachable from an app path today.
4. **`edit_submitted` is still logged for each write that leaves something waiting,** so "Georgia submitted a change" appears per clip while a version waits. Only the email is once per version.

## Stopped on

Nothing.

## Copy for BUZ

None added, changed or removed.

## Migrations

None. Doc 14 gains R13.

## Risks

- **Each waiting surface now loads both versions' content** to compute the diff. On /home that is per child.
- **A guardian who was emailed and then sees the child undo their own change** lands on "Nothing is waiting on you." That is true, and needs no words.

## Lesson

"Is something waiting" was answered five times, by five queries asking whether a row existed. One function, called by every surface, is the only way they can agree. A test that asks two surfaces the same question is what found the seed's fake waiting About.
