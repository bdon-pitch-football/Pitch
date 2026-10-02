# Safety review: the full /g/pending review, every child write waiting on it, doc 14 D14 (4a5b169..451c6e0, merged into build/full-release at 651219e)

Reviewer: safety seat · 2 Oct 2026 · requested by Leo

**Read:**
- the builder's report (`2026-10-02-builder-pending-review.md`);
- today's two earlier safety reviews (john-batch, parents-change-only);
- doc 14 §D (D14) and §R (R1–R12), E15;
- the full diff;
- every touched file in full: `app/g/pending/[recordId]/{page,actions,ClipFacade}.tsx|ts`, `lib/pending-diff.ts`, `lib/cv-build.ts`, `app/build/[recordId]/photo/route.ts`, 0169.

I also read these callers and neighbours:
- `app/build/[recordId]/{clips,more}/actions.ts`, `app/build/[recordId]/actions.ts` (season source);
- `lib/record-guard.ts`, `lib/record-read.ts` (`readCvByToken`), `lib/player-photo.ts`, `lib/storage.ts imageSrc`;
- `components/cv/PlayerCV.tsx` (what a club actually sees);
- 0020 `fn_record_actor`, 0054 `fn_token_read`, 0082 `fn_approved_cv`, 0083 (`player_stat_provenance_guard`, `fn_stat_public`, `fn_verify_stat`), 0067 `fn_is_erasing_name`, 0061 (school).

Line numbers are on build/full-release (651219e). Those files are byte-identical to 451c6e0.

**Probe.** I ran `pendingDiff` directly in Node, pure with no database, against crafted approved and waiting versions, then deleted the script. Results are quoted where used.

---

## BLOCKERS

None.

---

## SHOULD-FIX

### S-1 · A 16–17's guardian (and an adult's re-granted guardian) can open /g/pending, see the leftover waiting photo, clips and lists, and press Approve

**Where:**
- `app/g/pending/[recordId]/page.tsx:52`: `requireRecordActor(recordId, ['guardian'])`.
- `app/g/pending/[recordId]/actions.ts:33`: the same guard on `approveChange`.

**Why.** `requireRecordActor` asks `fn_record_actor` (0020), and that returns `'guardian'` for an approved, unrevoked guardian of **any** under-18, plus a re-granted guardian of an 18+. Authorship is the narrower `fn_record_author` (u16 only). E15 already moved the share-link press onto it, but the review and the approval were not moved. `approvePendingVersion` (`lib/cv-build.ts:178`) asks no band.

**Why a waiting version survives.** Nothing deletes a waiting version at the 16th birthday:
- the only `delete from profile_version` is 0169:299;
- `fn_purge_pending` purges invitations only.

**Scenario.**
1. Deniz, 15, uploads a new photo and adds two clips. Both now wait, as this change intends.
2. His mother doesn't get to it. Deniz turns 16 and, on his own page, which is now the page (D-119, R8), he replaces that photo and deletes one of the clips.
3. His mother opens `/g/pending/{recordId}`, which is reachable from the old doc 15 §30 email.
4. She sees the photo Deniz has since replaced, drawn via a freshly minted signed URL (`page.tsx:125-127`), and the deleted clip as a façade she can press.
5. She presses **Approve the change**. It succeeds:
   - `edit_approved` is logged with her as actor;
   - the family history tells the other guardian "{first name} approved a change.";
   - for a 16–17 that event describes nothing, because `fn_token_read` serves the live record and never the approved snapshot (0054).

**Rules broken.**
- R4: "Who may read `pending`: exactly two, the child and the approving guardian." A 16–17 has no approving guardian.
- R8: "the machinery is reachable only for u16".
- R11 says a version composed at 15 publishes under 16–17 rules, which means the live page with nothing to approve.

**What this change made worse.** Before it, this route leaked only the About. It now draws the photo, clips, lists and stats. The guardian keeps visibility of the live page (D-22), so the exposure is the stale version, including a photo the 16–17 chose to replace. That is not catastrophic, but it is exactly what Leo asked about.

**Smallest fix.**
- In both places, ask `recordAuthor` / `requireRecordAuthor` and require `actor === 'guardian'`, the E15 pattern.
- A 16–17's guardian then gets `/home`, as for any record that isn't theirs (D-77).
- Add a perms row: a 16–17's guardian GETs `/g/pending` and is sent home, and the approval POST is refused with nothing logged. Use the same seed as E15.
- See N-5 for the leftover row itself.

### S-2 · A change the review never draws still publishes on Approve: `surfacedStats` (the builder's Found 2, confirmed)

**Where:**
- `lib/pending-diff.ts:84-123`: the stats a page shows (`surfacedStats`) are never compared.
- `page.tsx:75`: "Nothing is waiting on you." whenever no drawn kind differs.

The approval hash (`lib/cv-build.ts:190-193`) pins the whole content, so the undrawn field is approved with whatever *was* drawn.

**Probe.** `surfacedStats: ['appearances'] → ['appearances','goals']` yields `changedKinds = []`.

**Scenario.**
1. Georgia, 14, changes only which stat tiles show.
2. Both guardians get doc 15 §30, and /home says something waits.
3. `/g/pending` says "Nothing is waiting on you." There is no Approve button, so nobody can clear it.
4. Next week she edits her About. Her mother sees one About card and approves, and the tile change publishes with it, unseen.

**Bounded harm.** Every stat **value** is diffed whether or not it is surfaced (`pending-diff.ts:104-112`). So this can only re-arrange numbers a parent has already approved: no new text, no new number. That is why it is SHOULD-FIX and not BLOCKER. It still breaks the one promise this change makes, "the parent sees every change before approving it", and leaves a waiting version nobody can resolve.

**Smallest fix.**
- Add a Football details row when `surfacedStats` differs, using the existing stat labels on each side. The row label is new copy, so BUZ needs to approve it.
- Until then, count a `surfacedStats` difference in `changedKinds`, so the page offers the Approve with the existing heading rather than "Nothing is waiting on you."

The other undrawn snapshot fields are not reachable by a child today:
- `firstName`/`lastName`: no app path updates a person's name.
- `club`, `clubCrestPath`, `locality`, `squad`: overlaid at read by `fn_approved_cv` → `fn_cv_club` (0082), so the snapshot's copy is never what a club sees.
- `season`, `slug`, `dob`, `highlightsUsed`: not rendered from the snapshot.

---

## NOTES

### N-1 · Other football's `note` is compared but never drawn

**Where:** `page.tsx:194-199` draws kind, orgName and period. `ITEM_SQL.otherFootball` (`lib/cv-build.ts:424`) carries `note`, and PlayerCV renders it to clubs (`components/cv/PlayerCV.tsx:348`, `{e.period} · {e.note}`).

**Probe.** A note-only change classifies as `otherFootball` changed. The parent would see an "Added" row and a "Removed" row that look identical, without the text clubs will read.

**Not exploitable today:** `addExperience` (`more/actions.ts:85`) writes no notes, and no other app path writes `experience_entry.notes`.

**Fix (one line, before any notes field ships):** add `{sub(c.item.note)}` to the row.

### N-2 · Stats diff fidelity

`pending-diff.ts:107-112` keys by `season|key` and takes the **first** entry on each side (`find`). `fn_stat_public` can return more than one entry per season and key, because experience-sourced rows are ordered after the form's.

- **Duplicate entries.** A second entry's change is invisible. Probe: adding a second `2026|appearances` entry yields `[]`. No app path writes `source_experience_id` stats today.
- **Provenance-only changes are not drawn.** A coach verification made after the last approval rides along unseen, naming the verifying club and date. It is legitimate (`fn_verify_stat`), but unseen.
- **The row label omits the season.** The form only writes `'2026'` (`app/build/[recordId]/actions.ts:45`), but an approved fixture-shaped snapshot with older seasons gives two indistinguishable "Appearances" rows.

### N-3 · One email and one `edit_submitted` per child write, including writes that change nothing visible

`writeRecord` → `tellGuardiansItWaits` (`lib/cv-build.ts:309`) runs on every child clip, achievement, other-football or photo write, even when the new waiting version equals the old one, or equals the approved page.

**Scenario.** A child who adds and removes a clip twenty times:
- sends twenty doc 15 §30 emails to every guardian;
- writes twenty `edit_submitted` events;
- leaves a waiting version identical to the page, so the email lands on "Nothing is waiting on you."

There is no new message and the event word is right (L5), but it is a nuisance vector and a sender-reputation cost.

**Smallest fix:**
- In `submitChildChange`, delete the waiting version when it equals the approved content, mirroring 0169:299.
- Email and log only when the waiting content actually changed (compare before the upsert).

BUZ or John to rule on one email per waiting version (the builder's Found 1).

### N-4 · The 0169 drop (0169:299) logs nothing

When a guardian's patch makes the child's waiting version identical to the page, the row is deleted. The child's `edit_submitted` stays in the family history with no resolution.

This is not wrong: nothing of the child's was lost. The probe and the reasoning:
- the comparison is exact `jsonb` equality against the full new page, so it cannot drop a real change;
- a version written before 0169 that differs only in shape (no `note` key, say) is never equal, so it fails safe and stays.

John may want the history to say what happened.

### N-5 · A waiting version left from before 16 keeps its photo in the private bucket indefinitely

`PHOTO_STILL_SHOWN` (`lib/player-photo.ts:116`) counts `pending`. So the photo a 16–17 replaced is never forgotten while that row exists. That is data minimisation, and it pairs with S-1.

**Fix:** discard a waiting version once the band is no longer u16 (R11 governs), then `forgetPlayerPhoto`.

### N-6 · A public-path under-18 photo is approved unseen

If a waiting or approved photo is still a public path, the tile shows only the camera glyph (`page.tsx:125,128-132`, the builder's Found 5). The parent can then approve a photo they cannot see.

This is only possible before `scripts/private-photos.mts` runs. Keep that script immediately after the deploy in GO-LIVE, before parents are emailed.

### N-7 · 0169 was edited in place

Prod is safe: the `app` branch tops out at 0166. Any dev or demo DB that applied the earlier 0169 has neither the drop rule nor `jsonb_strip_nulls` matching until it is reseeded.

### N-8 · The clip façade is sound

- `ClipFacade.tsx:11` opens only `https:` URLs, which blocks `javascript:` and `data:`. The check is case-sensitive and server-trimmed.
- The button has no `href`, so with no JavaScript nothing loads.
- `window.open(..., 'noopener,noreferrer')` sends no referrer or opener.
- The real gate is the server allowlist at `clips/actions.ts:11` (https plus the three hosts).
- Cosmetic only: `sourceOf` (`page.tsx:32-33`) labels any other host "Veo", which affects legacy or seed rows only.

---

## Answers to Leo's eight, one line each

1. **Exactness.**
   - The id and hash are checked against the database under the record lock in one transaction (`lib/cv-build.ts:188-193`), and every child writer takes the same lock (`:54-57`, `:287-291`), so there is no TOCTOU.
   - The hash is not trusted: the form's value must equal `md5(content::text)` recomputed in SQL.
   - Another child's version is excluded by `record_id = $1`, and the record is guard-checked.
   - A newer version fails the hash.
   - The pinned content includes undrawn fields (S-2).
2. **Signed photos.**
   - Minted only after the guard, for 10 minutes; never drawn from a public path.
   - A revoked guardian or a stranger goes `/home`; signed out goes `/signin`; the child, a coach or a club admin goes `/home`.
   - **A 16–17's guardian does see a leftover waiting photo** (S-1).
3. **Façade.** Validated client-side to `https:` and server-side to the three hosts; no `javascript:` or `data:` (N-8).
4. **School.** Filtered on both sides of the diff (`pending-diff.ts:88,121`) and at snapshot build (`fn_experience_public`). Never drawn.
5. **Child writes.**
   - The form (`saveCvDraft:98-101`), clips (add/remove), achievements, other football and previous clubs (add/remove), and the photo route all go through `submitChildChange` for a u16 'self'.
   - I found no other app writer of `highlight`, `achievement`, `experience_entry`, `player_stat`, `development_record` page fields or `person.photo_path` for a player.
   - None reaches the approved page unreviewed.
6. **Normalisation.**
   - Only null-versus-missing and key order are folded. Both render identically.
   - An empty string versus a value, and an empty string versus null, still count as changes (probe), so nothing is hidden by the normalisation.
   - Undrawn fields are hidden (S-2, N-1, N-2).
7. **The drop rule.** Exact `jsonb` equality with the new page, so it cannot drop a real change (N-4).
8. **D14 and 0083.** Confirmed.
   - `player_stat_provenance_guard` is a BEFORE UPDATE trigger, author-blind: any value change resets to `self_reported`, clears club, coach and date, and keeps the history.
   - Its only bypasses are `pitch.verifying = old.id`, set transaction-local only inside `fn_verify_stat` (0083) and the 0122 verifier, and `fn_is_erasing_name`, which requires every other column unchanged.
   - Blank-then-re-enter is DELETE (history kept) then INSERT, which refuses `coach_verified`.
   - The guardian's patch takes its entries from `fn_stat_public` after the trigger, so it publishes `self_reported`.
   - No later migration touches the trigger.

---

## What I did not check

- **I did not run `npm run -s test:perms` or any suite.** Leo asked for git-only reads while other worktrees run suites. So I have not seen pd-1..7, pb-1, D14/b/c or the bf-pend-w* checks pass on this tree.
- I made no database probe. S-1 is from reading `fn_record_actor` and the absence of any pending cleanup, not from a live request.
- I did not read /home's "waiting" count code. I relied on the builder's statement that it counts any pending row.
- I did not review the new test code beyond grepping for /g/pending coverage. There is no test of a 16–17's guardian on the review or the approval, only E15's share link.
- I did not check CSS or layout, Next's server-action origin checks, CSP for the signed image host, or behaviour on a phone.

**Count: 0 BLOCKER, 2 SHOULD-FIX, 8 NOTE.**
