# Safety review: "parent's change only" (9e50d2f..7b8fdbe, merged into build/full-release at 08906b4)

Reviewer: safety seat · 2 Oct 2026 · requested by Leo

**Read:** the builder's report (`2026-10-02-builder-parents-change-only.md`), John's four conditions (`13-Board-Room/JOHN-to-LEO-parents-change-only-and-addenda-4-5-2-oct.md`), B-1 in `2026-10-02-safety-review-john-batch.md`, LESSONS L1/L2/L5/L20, and the whole diff. I read these files in full at 7b8fdbe: `lib/cv-build.ts`, 0169, `app/build/[recordId]/{actions.ts,page.tsx,clips/actions.ts,more/actions.ts,photo/route.ts}` and `lib/record-guard.ts`. I also read the parts of `BuildForm.tsx`, `/g/pending` (page and actions), `fn_stat_public` (0083) and the bf-patch-1..7 and bf-30-1 tests that bear on this change. I also read earlier `buildSnapshot` shapes on `app` (production) and 9e50d2f to check that removal-by-equality matches.

**Line numbers** are at 7b8fdbe. On build/full-release they are the same for `lib/` and `app/build/`. For 0169 on build/full-release, add 3 (the §4 comment grew), e.g. `fn_publish_guardian_change` is at :217.

---

## BLOCKER

### B-1 · A guardian's form save publishes every form field the child changed, unreviewed, as "{guardian} changed the page."

- `app/build/[recordId]/page.tsx:19-23`: the guardian's form is prefilled from the **live** record (`dr.about`, `dr.positions`, `dr.squad_number`, `dr.foot`, `dr.surfaced_stats`, the 2026 `player_stat` rows). For an under-16 with a change waiting, the live record **is** the child's unreviewed draft, because `saveCvDraft` writes live before it opens the pending version.
- `BuildForm.tsx:174-210`: every field is posted on every save, whether or not it was touched (`about`, `foot`, `squadNumber`, `positions`, `surfaced`, `stat_*`).
- `lib/cv-build.ts:50-53` writes the posted values to live. Then `:84` reads `FORM_FIELDS_PATCH` (`:327-330`), which is **every** form field plus `fn_stat_public(dr.id)` (every season and every provenance), and `:85` publishes all of it as `{ set: fields }`.
- `fn_cv_patch` (0169:168-175) sets every key it is given.

So the patch carries every field on the form, not the fields the guardian changed. This is the subtle case in the brief, and it is live.

**Scenario.**
1. Georgia (14) changes her About to "Year 9 at St Kilda Secondary, I train Tuesdays at Elsternwick Park". It goes to the pending version, and both parents get doc 15 §30.
2. Before looking at /g/pending, her dad Alex opens /build/{id} to fix her squad number. Her new About is in the textarea, and nothing marks it as unreviewed. He changes 7 to 9 and presses Save.
3. `FORM_FIELDS_PATCH` reads `about` = Georgia's text. `fn_publish_guardian_change` supersedes the approved version with one carrying her About (and any positions, foot or stats she changed), approved by Alex.
4. Every club holding Georgia's link now reads the school and the training ground.
5. The history says "Alex changed the page." That attributes the child's words to the parent: the false-actor half of the original B-1.
6. /g/pending still shows her About as waiting, says "Until you approve it, every club holding Georgia's link still reads the old version." (`app/g/pending/[recordId]/page.tsx:109`), and offers "Not this one". That line is now false, and "Not this one" cannot take the text back off the page.

The same happens with a Save that changes nothing at all: one press publishes the child's whole waiting form change.

**Conditions broken:**
- Condition 1: the approved page differs by more than the guardian's edit.
- Condition 2's premise: the guardian never "decided" the About.
- Condition 4: the line names the wrong author.

**Why the suites are green.** bf-patch-1/2 call `fn_publish_guardian_change` directly with a hand-built patch. jb-f14-w4 has the parent change the About itself. No check drives the form with a field the guardian left alone while the child's value for it waits. bf-patch-7 pins that the patch and the snapshot share `FORM_FIELDS_SQL`, which is exactly the problem: the patch is a snapshot of the form fields.

**Smallest fix.**
1. In the guardian branch of `saveCvDraft`, take the record lock and read `FORM_FIELDS_PATCH` **before** the update at `:50`.
2. Read it again after the update and before `publishPatch`.
3. Pass only the keys whose value changed. If nothing changed, skip the publish.
4. `stats` must be diffed per entry (season and key), not as one array. Build the published array from the **approved** version's `stats` with only the entries the guardian changed replaced, added or removed. Otherwise touching one stat publishes all of the child's unreviewed stat changes, and every coach verification on live, which also closes the builder's "stats ride along" risk.

A field the guardian really edits still publishes their whole value (condition 2: they saw it and decided it).

**Test to add (write suite):**
1. The child changes About and one stat.
2. The guardian saves the form with only the foot changed.
3. Assert that the approved `about` and `stats` are unchanged, `foot` is changed, and the pending version still holds the child's About and stat.

Prove it red on 7b8fdbe (L20).

---

## SHOULD-FIX

### S-1 · After the guardian's save, the build page tells them their change is waiting for "your parent"

`BuildForm.tsx:80-81` shows "Saved. Your parent will see this change before it goes out." whenever `has_pending` is true, whoever saved. Since this change, a guardian's save while the child's change waits **has published** (bf-patch-2).

**Scenario.**
1. Alex removes a clip naming the school while Georgia's About waits.
2. The clip is off the clubs' page at once, but the page tells him, in purple, that it has not gone out and is waiting on a parent.

Before 7b8fdbe this was roughly true, because the guardian's edit joined the pending version. Now it is false in the reassuring-the-wrong-way direction: it hides that something went live.

**Fix.** Show that line only to the child (`actor === 'self'`, which the page already has from `requireRecordAuthor`). The guardian gets the plain "Saved.". No new words.

### S-2 · The guardian's live write and the publication are two transactions, so a removal can be lost and an add can double

- `clips/actions.ts:28-54` then `:57`.
- `:68` then `:69` (removeClip).
- `more/actions.ts:40-46`, `:55-56` and `:93-99`.
- Each of these commits the live insert or delete, then calls `publishGuardianChange` in a fresh transaction.

`publishPatch` exists to run inside the caller's transaction, and `saveCvDraft` uses it that way.

**(a) A removal that never reaches the page.**
1. `approvePendingVersion` (`lib/cv-build.ts:148-163`) locks the pending row, then the approved row, and never takes the `development_record` lock.
2. `versionPhotos` (`:275-279`) locks the approved and pending rows in one statement, in scan order.
3. Guardian A presses Approve on /g/pending in the same second Guardian B presses Remove on a clip. That can deadlock. If Postgres aborts B's publication, B's live delete has already committed. The clip is still on the approved page, B gets a 500, and on reload /build/clips no longer lists the clip, so there is nothing left to press.

This is the S-2 case John said must never wait.

**(b) An add that doubles.**
1. The guardian's `addClip` commits the live row.
2. The child's `saveCvDraft` (u16 self) then rebuilds the pending version from live, which now includes that clip.
3. The guardian's publication then runs `fn_cv_patch` "add" on the pending version (0169:186-197 appends unconditionally).
4. The pending version holds the clip twice. Approving it puts a duplicate clip on the page and miscounts `highlightsUsed`.

**Fix.**
- In each action, do the live write and `publishPatch` in one transaction on one client, with the record lock taken first. `publishGuardianChange` stays for the photo route.
- Have `approvePendingVersion` take `select 1 from development_record where id=$1 for update` first, so every version writer locks in the same order.

---

## NOTES

**N-1 · No page yet: nothing publishes, but the first approval is still blind.**
- `publishPatch`'s `no_page` branch (`lib/cv-build.ts:304-310`) opens the pending version from the **whole** live record, including the child's unreviewed clips, achievements and photo. I confirm nothing is published there. 0169:233-236 returns before any approved row is written, and record-read 404s a u16 with no approved version.
- But /g/pending (`page.tsx:88-104`) shows only the About, under "Only this change needs you. Everything else stays exactly as you approved it." with "Nothing approved yet". The guardian therefore approves the child's clips and photo unseen. That is the builder's Found 2 and is the same as pre-F14 first pages, so it is not a regression, but it should be in John's Found 2 ruling.
- **Separately:** if the guardian's first save is a clip or a photo and the record has no About, the opened pending version has `about: ''`. /g/pending's `!r.pending_about` (`:43`) then shows "Nothing is waiting on you." with no Approve, so the page can never publish. This fails closed and is not a safety problem, but the /home door it serves dead-ends.

**N-2 · A child's own removal is invisible to the guardian and stays on the clubs' page.**
1. Georgia deletes a clip that is on the approved page (say it names her school). Her delete writes live only and opens no pending version (Found 2).
2. /build/clips, which shows live, no longer lists it, so her mother cannot remove it and believes it is gone.
3. Clubs keep reading it until the next approval.

A crafted removal cannot reach an approved entry the guardian cannot see: every removal deletes a live row scoped by `record_id` and carries that row's own shape. But the reverse gap exists. This is pre-existing and needs a ruling (should a child's removal patch the approved page, given it only takes content away?). Put it to John alongside Found 2.

**N-3 · "remove" drops the first equal entry.**
- 0169:200-203. If the child adds an exact duplicate (same title and URL, or same org and period) of an approved entry and the guardian removes the child's copy, the approved copy goes. This takes more off the page, never less, so it is safe.
- Shapes match across production (`app`), 9e50d2f and 7b8fdbe for all four lists, and no code path updates a highlight, achievement or experience row in place, so a guardian's removal of an approved entry will match.

**N-4 · Who can invoke it.** Every door asks `requireRecordAuthor` / `recordAuthor`, which uses `fn_record_author`:
- **Child:** `self`, never publishes.
- **A 16–17's guardian, a revoked or unapproved guardian, a stranger, a coach or an administrator:** null, sent to /home or /signin (D-77).

Inside the database:
- `fn_publish_guardian_change` takes the record row lock (0169:221) **before** it asks `fn_record_author` (`:223`), so a revocation between the app's check and the publication publishes nothing.
- It is SECURITY INVOKER and revoked from public, anon and authenticated (`:253-262`).
- `fn_cv_patch` is executable by public, but it is pure and immutable and touches no table.
- No function in the repo sets `search_path`, and none is SECURITY DEFINER, so neither is a regression here.
- Every patch is built server-side from database rows. No posted value reaches `fn_cv_patch` as a key or a list name, and its allowlists (0169:170, :181) refuse names, club, locality, other lists and two operations at once (bf-patch-6).

**N-5 · §30 recipients are right.**
- `EDIT_WAITING_TO` (`lib/cv-build.ts:130-136`) selects approved, unrevoked links with an address, `distinct on (p2.email)`, with no `limit 1`, and the loop at `:123-126` sends one message per row. A revoked or unapproved guardian is excluded and an address shared by two links gets one message.
- A guardian's own save sets no `waitsOnGuardian`, so it sends nothing.
- **Minor:** the loop awaits `send` serially after commit. If one send throws, the rest are skipped and the child sees an error for a save that did commit. This is the same as before.

**N-6 · Conditions 3 and 4 hold.**
- `approvePendingVersion` promotes the pending row as it stands (bf-patch-4). Live, which every later child snapshot is rebuilt from, already carries the guardian's change, because the guardian's write goes to live first.
- `fn_consent_timeline` names a guardian of this child only on `edit_approved/guardian_edit` (0169:282-287), and only the guardians' controls page reads it, so the child is never told.
- Condition 3 and condition 1 are only as true as B-1 allows: today the "guardian's change" can include the child's fields.

---

## What I did not check

- **I did not run `npm run -s test:perms`.** Leo said the full-release worktree is running suites, and the suite reseeds the shared dev database. For the same reason I wrote no probe against the database. B-1 is shown from the code path (prefill from live → every field posted → `FORM_FIELDS_PATCH` read after the write → `{ set: fields }`), not from a run.
- I did not run the deadlock in S-2 (a). The lock orders are read from the code.
- I did not re-review doc 14 rows, the photo-review merge beyond the photo route, or the /g/pending share-link change on full-release.
- I did not check on a phone.

**Count: 1 BLOCKER, 2 SHOULD-FIX, 6 NOTES.**
