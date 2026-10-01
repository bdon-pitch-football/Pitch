# builder: the form save publishes only what the guardian changed, one transaction per guardian write, the other guardian's approval line (2026-10-02)

Asked: fix the safety review of "parent's change only" (`2026-10-02-safety-review-parents-change-only.md`):
- **B-1 (blocker):** a guardian's form save published every field;
- **S-1:** the waiting line shown to a guardian;
- **S-2:** two transactions, lock order, and an add that doubles;
- **item (a):** the approval event names the child, with BUZ's approved line "{first name} approved a change." for the other guardian;
- **John's added test:** an unchanged form over a waiting change publishes nothing.

Started from build/full-release at d35a365. Same worktree and ports (DB 54571, app 3371, CDP 9571). /g/pending, lib/messaging and the outbox jobs are untouched.

## Did

- **lib/cv-build.ts `saveCvDraft`: B-1.**
  - The transaction now starts with the record's lock and the age band (`… for update of dr`), before any write.
  - For an under-16's guardian, `formState` reads the form's fields and its own stats for the form's season (`player_stat`, `source_experience_id is null`) **before** the write, and again **after**.
  - `formPatch` then builds the patch from what moved:
    - `set` gets each field whose value changed (positions, squadNumber, foot, about, surfacedStats).
    - `stats` gets each stat key whose value changed. Its entries are that key's entries from `fn_stat_public` for that season, so the patch carries exactly what the page would show for it, or nothing if the guardian blanked it.
  - A save that changes nothing publishes nothing and logs nothing (`formPatch` returns null).
  - `FORM_FIELDS_PATCH`, the every-field patch, is gone.
- **0169 `fn_cv_patch`, edited in place.**
  - `stats` is no longer a field `set` accepts.
  - A new `stats` part: `{season, keys, entries}` replaces only this version's entries for (season, key ∈ keys). Every other season, and every coach verification, stays as that version had it. It refuses an entry outside the change.
  - A form save may carry `set` and `stats` together as one change. A clip, achievement or other-football entry is still one change, alone.
  - `add` is now idempotent: an entry the version already holds (by equality) is not appended again (S-2 b).
- **`writeRecord(recordId, author, write)` (new, lib/cv-build): S-2 a.** In one transaction it:
  1. takes the record's lock;
  2. runs the action's live write;
  3. if the author is an under-16's guardian, publishes the returned patch through `publishPatch`;
  4. commits.

  Photos are forgotten after the release (L1). All six clips/more actions now write through it, and none writes or publishes outside it. The photo route keeps `publishGuardianChange`.
- **`approvePendingVersion`.**
  - It takes the record's lock first, which is the order every version writer now takes: the record, then its versions.
  - Its `edit_approved` event names the child as subject (item a), so the approval reaches the family history.
- **0169 `fn_consent_timeline`.**
  - It returns `mine` (the viewer is the actor).
  - `who` now also names the approver of a child's change for any viewer who is **not** that approver. It is still only a guardian of this child, and still a first name.
- **app/g/controls/[childId]/page.tsx.** For `edit_approved` that is not a guardian's own edit:
  - **"You approved a change"** for the approver (`mine`, the existing line);
  - **"{first name} approved a change."** for the other guardian (BUZ, 2 Oct);
  - the existing fallback "Something was recorded" if the approver is no longer a guardian.
- **app/build/[recordId]/page.tsx and BuildForm.tsx: S-1.** "Your parent will see this change before it goes out." shows only when the reader is the child (`actor === 'self'`). A guardian gets the plain "Saved." No new words.
- **docs/team/APPROVALS-28-SEP.md.** BUZ's 2 Oct line, recorded under its own heading.
- **app/undo/[token]/page.tsx (found by the timing suite).** The press's spend now also requires `lk.revoked_at is null`, so an undo whose link is already off spends nothing and asks no guardian question. That is the same work as a lapsed one. Nothing visible changes: the load already reads an off link as not live. The fix takes the already-off arm from +0.22ms to −0.04ms against a never-link (D-77). **bf-undo-3** pins it, and was red with the line removed.

## Ran

Final code, TRAINING order. Each reseed restarts the app.

| Suite | Result |
|---|---|
| perms | **2194/2194** |
| render | **826/826** |
| write | **652/652** |
| layout | **274 views at 375 and 1280, ALL GREEN** |
| timing (fresh large-heap app) | **23/24**; L40 alone on a fresh app **4/4**, resolution 0.94ms (detail below) |
| palette | ALL GREEN |
| tsc | 0 errors |
| `.next-check` build | exit 0 |
| csp-prod | 5/5 |
| corpus | 0 |
| secret-scan | none |
| gate-coverage | 265/265 |
| validate-migrations | ALL GREEN |

**Timing, in detail.**
- **First full run: 22/24.**
  - **jr-undo-t2 was red.** The already-off press was +0.22ms (p = 0.000018). It leaned that way in every earlier run with S-1: +0.12, +0.09, against +0.05 before S-1. On an already-off link, the press spent the undo and asked `fn_record_actor`, which no other not-live press does. **Fixed** (below).
  - **J61 was inconclusive,** from machine noise. It is a club page, which I did not touch.
- **Second full run, after the fix: 23/24.**
  - **jr-undo-t2 is green.** The already-off press is now −0.04ms (p = 0.44), and every not-live arm is under 0.1ms.
  - **J61 is green** (0.70/0.82ms).
  - **L40 was inconclusive** (resolution 1.41ms, n 117). It is the send rate limit, which I did not touch.
- **L40 re-run alone** on a fresh app: green (0.94ms).

**New checks, none with a doc 14 row id:**
- **perms:**
  - **bf-form-1:** the order is lock, then the before-read, then the write, then the after-read, then the patch. Only moved fields and moved stats are patched, per entry from `fn_stat_public`, and nothing when nothing moved. The every-field patch is gone.
  - **bf-s2-1:** `writeRecord` locks first and publishes before the commit. No clips/more action writes or publishes outside it. `approvePendingVersion` locks the record before any version.
  - **bf-patch-8:** an `add` the version already holds changes nothing; a new entry is still added.
  - **bf-appr-1:** this is the other guardian's view, which needs two guardians, and no fixture child has two. The approval statement from `approvePendingVersion` is run against a child with two guardians. The approver sees `{who: null, mine: true}` and the other sees `{who: 'Imogen', mine: false}`. The page draws exactly those words.
- **write** (Georgia, inside the "parent's change only" block):
  - **bf-form-w1** (John's): Georgia's About and an apps stat of 87 wait. Her parent's form is prefilled with both. Saving it **unchanged** leaves the page clubs read word for word as it was, with no history line.
  - **bf-form-w2** (the review's): her parent changes **only the foot**. Clubs see the new foot and still the old About and old stat. Her About still waits. One "Alex changed the page."
  - **bf-form-w3** (S-1): Georgia reads "Your parent will see this change before it goes out." Her parent reads only "Saved.".
  - **bf-appr-w1:** her parent approves, and his history gains one "You approved a change". Her About goes up with his foot.

**Moved checks, none loosened:**

| Check | Why it moved |
|---|---|
| bf-patch-1 | its fixture's `stats` is now the page's real shape (an array). The form step uses `stats` per entry, and the result asserts 2025's coach-verified goals did not move |
| bf-patch-6 | gains four cases: `set.stats` refused; an entry outside the change refused (two ways); `set` + `stats` together accepted |
| jb-f14-6 | now pins the before/after `formPatch` in the guardian branch, and `writeRecord` for every clips/more action |
| bf-race-1 | the save's first statement is the record lock, before the update |
| photo6 | the forget-after-release doors are four now (`writeRecord` added) |

**Red on the unfixed code (L20).** I put d35a365's versions of the seven product files back and kept the new tests. d35a365 carries 7b8fdbe's patch code byte for byte; its 0169 differs from 7b8fdbe only in another builder's §4 clean-up.
- **perms: 9 red:** photo6, jb-f14-6, bf-race-1, bf-patch-1, bf-patch-6, bf-form-1, bf-s2-1, bf-patch-8, bf-appr-1.
- **bf-undo-3:** red with the one `lk.revoked_at is null` line removed (`got [0, false, …]`: the already-off press spent the undo).
- **write: 4 red, each for the reported defect:**
  - **bf-form-w1:** the unchanged save changed the page, added a history line, and put Georgia's waiting About on it: `got [… false, false, true]`.
  - **bf-form-w2:** the foot-only save published her About and the stat of 87: `got [… true, true …]`.
  - **bf-form-w3:** the parent read the "your parent" line.
  - **bf-appr-w1:** the approval added no history line (0).

## Found

1. **A guardian's stat edit keeps the row's provenance.**
   - `saveCvDraft`'s upsert (`on conflict … do update set value`) changes a coach-verified stat's value and keeps it `coach_verified`, with the club and date. That is true for any author, and it predates this work.
   - The guardian's patch now carries exactly that entry, so a parent who edits a verified number publishes it still marked verified.
   - **Leo/John:** should an edit reset provenance to `self_reported`?
2. **An unchanged form can still move `surfacedStats`.**
   - When the live record has none chosen, the form posts no `surfaced` field, and the action saves the position default.
   - That counts as the guardian's change. It derives from positions, carries none of the child's content, and publishes only the stats choice.
3. **The review's N-1 and N-2 stand** (a first approval is still blind to clips and the photo; a child's own removal stays on the page). John's line "Until it ships, a child's new clips and achievements must not be approvable unseen" belongs to the /g/pending build, which is not mine.

## Stopped on

Nothing.

## Copy for BUZ

- **"{first name} approved a change."**: BUZ's, approved 2 Oct, now built (recorded in APPROVALS).
- Nothing new. The S-1 change only hides an existing line from the guardian.

## Migrations

0169 edited in place: `fn_cv_patch` (stats per entry, idempotent add) and `fn_consent_timeline` (`mine`, and `who` for the other guardian's view). No 0170.

## Risks

- **The lock order is pinned by statement order, not run.** PGlite serves one connection, so no deadlock was run here (bf-s2-1).
- **The before/after diff compares the form's own fields and its own season's stats.** A stat in another season can't be edited from the form, so it never moves through it.
- **Approval lines now reach the history.** Every approval since this change appears in both guardians' histories. Approvals made before it stay subject-less and invisible.

## Lesson

A form is a snapshot, not a change. When the form is prefilled from a draft that someone else wrote, "what they posted" and "what they did" are different things. Diff before and after the write, under the same lock, and publish the difference.
