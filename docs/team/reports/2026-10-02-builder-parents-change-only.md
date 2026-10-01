# builder: B-1 closed by "parent's change only", John's four conditions, and §30 to every guardian (2026-10-02)

Asked:
- Build BUZ's option (b) for B-1 ("parent's change only", 2 Oct). John confirmed it the same day with four conditions (`13-Board-Room/JOHN-to-LEO-parents-change-only-and-addenda-4-5-2-oct.md`).
- Add two of John's rulings in lib/cv-build: (a) the approval event names the child; (b) §30 goes to every guardian.
- Branch `build/batch-fixes`, from 9e50d2f, in the same worktree and on the same ports (DB 54571, app 3371, CDP 9571).
- Not touched, as briefed: lib/messaging.ts, the outbox jobs, /g/pending.

## Did

- **0169 §2, edited in place: the publication is a patch.**
  - **`fn_cv_patch(content, patch)` (new, immutable).** It applies exactly one guardian change:
    - `{"set": {...}}`: only `positions`, `squadNumber`, `foot`, `about`, `surfacedStats`, `stats` and `photoPath`;
    - `{"add": {list, item}}`: appends one entry; `previousClubs` is kept in the snapshot's order (period, newest first);
    - `{"remove": {list, item}}`: drops the first entry equal to the item, never every look-alike.
    - Lists: `highlights`, `achievements`, `otherFootball` and `previousClubs` only. `highlightsUsed` is recounted.
    - It raises on anything else: a name, a club, the locality, another list, two changes at once, or an empty patch.
  - **`fn_publish_guardian_change(record, guardian, patch)`, same signature, new body:**
    1. Takes the record's row lock, then asks `fn_record_author = 'guardian'` under it.
    2. Patches the **pending** version, if one exists. On a field both touched, the guardian's value wins (condition 2), and approving the child's change later cannot revert the guardian's (condition 3).
    3. Patches the **approved** version: it supersedes it and inserts the patched version, approved by the guardian, with one `edit_approved` event (actor the guardian, subject the child, kind `guardian_edit`), so the history reads "{guardian first name} changed the page." (condition 4).
    4. Returns:
       - `unchanged` when the approved page did not move (e.g. removing a clip only the child's waiting version had): no version, no event;
       - `pending` when there is no approved version but a waiting one, which is patched and nothing publishes;
       - `no_page` when there is neither: nothing written.
  - **The header is rewritten.** The old "the guardian's change joins the pending version and nothing publishes" rule is gone.
- **lib/cv-build.ts:**
  - **`publishWith` is retired;** it snapshotted the whole live record. `publishPatch(client, record, guardian, patch, season)` replaces it: lock, then the versions' photos, then the database's patch.
  - **`no_page` (no approved version, none waiting): nothing publishes.** The pending version is opened from the record as it stands, which is how every under-16's first page worked before F14. The first approval on /g/pending carries it. There is no `edit_submitted` and no email. This is the only place a guardian's save reads the whole record, and it publishes nothing. **This is my reading of "the first approval carries it, as today"** (see Found 1).
  - **`publishGuardianChange(recordId, guardianId, patch)`** now takes the patch. It still forgets superseded photos after the commit.
  - **The build form's guardian branch** patches exactly the form's fields. It reads them from `FORM_FIELDS_SQL`, the expression the snapshot itself now uses, plus `fn_stat_public`.
  - **`ITEM_SQL`** gives the snapshot's shape for a clip, an achievement, other football and a previous club. `buildSnapshot` and every action use it, so a removal matches by equality, byte for byte.
  - **(b) doc 15 §30** now goes to every approved, unrevoked guardian with an address, one message each (`EDIT_WAITING_TO`, with no `limit 1`).
- **Clips and more actions** hand over the one entry they wrote or deleted, read from the same statement (`returning ${ITEM_SQL…}`):
  - `addClip` / `removeClip` → `highlights`;
  - `addAchievement` / `removeAchievement` → `achievements`;
  - `addExperience` / `removeExperience` → `previousClubs` for a previous club, `otherFootball` for anything else.
- **Photo route:** a guardian's upload publishes `{ set: { photoPath } }` and nothing else. The child's upload is unchanged: the live record only.
- **scripts/timing-tests.mjs:** jr-undo now mints against Deniz's record. E10 pauses Nate earlier in the full run, and a paused record takes no new link, so the minter got a 500.

## Ran

Final code, full TRAINING order: reseed → `next dev -p 3371` → perms → render → write → reseed → restart → layout → timing (large-heap app) → reseed → the rest.

| Suite | Result |
|---|---|
| perms | **2175/2175** |
| render | **826/826** |
| write | **647/647** |
| layout | **274 views at 375 and 1280, ALL GREEN** |
| timing | **23/24**; the red row is below |
| palette | ALL GREEN |
| tsc | 0 errors |
| `.next-check` build | exit 0 |
| csp-prod | 5/5 |
| corpus | 0 |
| secret-scan | none |
| gate-coverage | 264/264 |
| validate-migrations | ALL GREEN |

The one red timing row is **jr-undo-t2**: the live press is +0.34ms, p = 1.7e-9. The not-live arms are fine (−0.13, −0.12 and +0.09ms). This row was already red on 16d7a59, before S-1 (my last report). It is not from this change.

**New checks, none with a doc 14 row id (L4):**
- **perms:**
  - bf-patch-1: condition 1. The approved JSON before and after differs by exactly the patched keys for each kind (form fields, a clip added, an achievement removed, the photo, a previous club), and each list by that one entry. A removal of something the page never had returns `unchanged` and writes no version.
  - bf-patch-2: condition 2, the clash. The guardian's value is in the approved version and in the waiting version, the child's other waiting fields are untouched and unpublished, no outbox row is written, and only the guardian's event is logged.
  - bf-patch-3: S-2. A removal is off the approved page at once while a change waits, and off the waiting version too.
  - bf-patch-4: condition 3. Approval keeps the guardian's words, photo, previous club and removals, and approval rebuilds nothing from the live record.
  - bf-patch-5: no page. `no_page` writes nothing; a waiting version is patched with no approved version and no event; `publishPatch` opens the pending version.
  - bf-patch-6: `fn_cv_patch`'s refusals.
  - bf-patch-7: no guardian save copies the whole record. The snapshot is built only for the child's own save and for `no_page`, and the field and item expressions are shared.
  - bf-30-1: §30's recipients are the two approved, unrevoked guardians with an address, never the revoked one, the unapproved one or one with no address. There is no `limit 1`, and the loop sends one message each.
- **write** (Georgia, after jb-f14-w4):
  - bf-b1-w1 (her clip), bf-b1-w2 (her achievement), bf-b1-w3 (her photo): with nothing waiting, each stays off the page clubs read when her parent saves something else, while the parent's change publishes at once.
  - bf-b1-w4: with her change waiting, the parent's clip removal is gone at once and the parent's new achievement is on the page at once.
  - bf-b1-w5: approving her change keeps both.
  - bf-b1-w6: the history has "Alex changed the page." ×5 and "Georgia submitted a change" ×1. Her clip, achievement and photo add no line.
  - bf-b1-w7: a 16–17's and an adult's own achievement is on their page at once.

**Moved checks** (each was pinning the old rule, now replaced):

| Check | Before | Now |
|---|---|---|
| **jb-f14-3** | "with the child's change waiting… NOTHING publishes" | publishes; the waiting version takes the guardian's value on the field both touched, the rest still waits |
| **jb-f14-w4** | "the parent's edit joins it and publishes nothing" | publishes at once; the waiting version shows the parent's About, not the child's; one history line; no email |
| **photo-w3** | "the parent's photo joins it and nothing publishes" | the club sees the parent's photo at once; the child's is deleted; approving keeps the parent's photo |
| **jb-f14-1, jb-f14-4** | took a whole page | take a patch |
| **jb-f14-6, photo8, photo9, bf-race-1** | the old shapes | the patch shapes: `publishPatch`, `{ set: fields }`, `{ set: { photoPath: rel } }`, `{ add|remove: { list } }` |

**Red on 9e50d2f (L20).** I put 9e50d2f's `lib/cv-build.ts`, 0169, clips/more actions and photo route back, kept the new tests, and ran them:
- **perms: 14 red.** photo8, photo9, jb-f14-1/3/6, bf-race-1, bf-patch-1 to 7, bf-30-1.
- **write: 7 red.** photo-w3, jb-f14-w4, bf-b1-w1 to w4, bf-b1-w6.
  - **w1, w2 and w3 failed for the leak itself:** her clip, her achievement and her photo appeared on the page after the parent's save.
  - **bf-b1-w5 and bf-b1-w7 passed on both, by design.** w7 is the 16–17/adult control. w5 holds on the old code too, because the old code joined the waiting version and published nothing.

## Found

1. **"No page yet" needed a reading, and I chose one: confirm or overrule.**
   - Read literally ("nothing publishes"), a guardian building a page the child never saved would never get one. /home's "Build {first}'s page" door, which glows for exactly that child (B1, live 1 Oct), would lead nowhere.
   - So with no approved version and none waiting, the guardian's save opens the pending version from the record as it stands, as before F14, and nothing publishes until a guardian approves it on /g/pending.
   - The alternative is to write nothing at all, which is one line in `publishPatch`.
2. **A child's own clip, achievement or photo still opens no pending version.**
   - Under (b) they wait on the live record, and then ride the child's next own save into the version a guardian approves on /g/pending.
   - /g/pending shows only the About ("Only this change needs you. Everything else stays exactly as you approved it."), so the guardian approves them unseen. bf-b1-w5 walks exactly that path: Georgia's clip and achievement go up with her About.
   - John's §5 says "B-1's fix (every write a child makes for themselves opens the pending version) answers it". That was option (a), which is not what was built. **His Found-6 ruling is not met.** It needs the /g/pending words, which are BUZ's, and /g/pending, which is outside this brief.
3. **John's ask for a doc 14 row and a deny on a 16–17's parent minting a share link from /g/pending** (his §5) is not in this brief and is not built.

## Stopped on

**(a) The guardian approval event names the child: not built.**
- The family history draws `edit_approved` as "You approved a change" for every viewer. With the child as subject, the **other** guardian would see "You approved a change" for an approval they did not give.
- The safety review flagged that line as false for them (N-1).
- No words exist for another guardian's view of an approval. The history has "{guardian first name} changed the page." only for a guardian's own edit, and the fallback "Something was recorded".
- I stopped, as briefed.
- Options for BUZ: proposed **"{guardian first name} approved a change."** for the other guardian (the approver keeps "You approved a change"), carried by `who` exactly as `guardian_edit` is today. Or keep the event subject-less until there are words.

## Copy for BUZ

None added, changed or removed. Proposed and **not** built: "{guardian first name} approved a change." (Stopped on).

## Migrations

0169 edited in place (§2: `fn_cv_patch` added and `fn_publish_guardian_change` rewritten; header rewritten). No 0170.

## Risks

- **Concurrency is untested on a live database.** The lock order is pinned by the statement order in the code (bf-race-1), not run against a real database.
- **Whatever reaches clubs, the live record stays the child's draft.** A guardian's removal of a clip that is also in the child's waiting version takes it out of both. A guardian's change to a field the child's waiting version has *not* changed overwrites that field in the waiting version with the guardian's saved value. The form showed it, so it is what they saw.
- **The form patch includes `stats`** as `fn_stat_public` returns them for every season, not only the form's. Coach-verified stats change only through the coach path, but they ride a guardian's form save into the approved page.
- **`previousClubs` ordering after an add** follows `period` as text, as the snapshot's `season_label` ordering does.
- **Not checked by hand on a phone.**

## Lesson

A rule written as "nothing publishes when X" needs its empty case read against every door that leads there. "No approved page" is also the parent's first page, and the literal rule would have closed that door without a test going red, because no fixture builds a first page from the parent's side. Ask what the empty state is *for* before choosing what it does.
