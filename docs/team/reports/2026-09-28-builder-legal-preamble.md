# builder: John's 28 Sep rulings on the legal preamble — BLOCKED on the consent path, nothing new committed (2026-09-28)

Asked: land the preamble work exactly as John ruled (doc 35, "Rulings — 2026-09-28"): merge `app` in; bump every stamped document past any version recorded anywhere, with `lib/consent.ts` in the same commit; route the waitlist through `legalStamp` so doc 20 has one hash; remove the `[DO NOT PUBLISH UNTIL BUILT]` class of clause; reconcile the register; drop the "not yet published" colophons; prove each change red before green.

**Status: stopped before committing, on purpose.** Everything except the consent path is done and sits uncommitted in the worktree. The auto-mode classifier refused me access to `lib/consent.ts` ("Modify Shared Resources"). I have not tried to get there another way. The register's own rule is that the consent version moves **in the same commit** as what `/privacy` serves — "never separately, in either direction" — so committing the document bumps without `consent.ts` would break the rule the ruling rests on. **The branch head is still the reviewed state plus the merge (`713a692`). Nothing below is committed. `app` has not been touched.** A backup of the uncommitted diff (295 lines) is at `/private/tmp/claude-502/-Users-bdonmez22-Desktop-Life-Work-Pitch-3-0/bbdfd9b3-bb4b-452b-b38e-ede06a74b953/scratchpad/rulings-uncommitted.patch`.

Did:

- **Merged `app` into `builder-legal-preamble`, no rebase: commit `713a692`.** One conflict: both sides had appended to the end of `scripts/permission-tests.mjs` (my `leg1`–`leg18`, and QA's `qa-silent1`/`fail1`–`fail6`). I kept both, legal block first. Perms on the merged tree: 1,284/1,284. **This merge is committed.**
- **Versions (uncommitted).** Each new version is strictly newer than any version recorded anywhere in the repo for that document: the register table, the register prose, the document's change log and footer, `_superseded/`, and every `NN@vX.Y` in `lib/`, `app/`, `scripts/` and `docs/`.

  | doc | highest recorded | new | why this number |
  |---|---|---|---|
  | 20 | v2.7 (table, document) | **v2.8** | next after 2.7 |
  | 21 | v2.5 (table, document) | **v2.6** | next after 2.5 |
  | 22 | **v1.9** (document header and footer; the table said v1.8) | **v2.0** | It has to be newer than 1.9. "v1.10" reads as older than v1.9 to anyone comparing decimals, and every version in the corpus has a single digit after the point, so v2.0 is the only next number nobody can misorder. |
  | 24 | v1.3 | **v1.4** | Ruling 1 covers the preamble strip on every document, and 24's served text changes (preamble and footer). |
  | 25 | v1.3 | **v1.4** | same as 24 |

  All of them are dated 28 September 2026, because that is when the served text changed. Each document gets a new first entry in its (unserved) change log, which is also where `publishedDate` finds the date.
- **Register (uncommitted).** The table is now v2.8 / v2.6 / v2.0 / v1.4 / v1.4. The prose is now `20@v2.8`, `21@v2.6`, `22@v2.0`. I added a paragraph recording John's ruling, because the register says "whether a change is material is John's call, and the register records it."
- **Colophons (uncommitted).** In every footer I changed exactly three things: the version, its date, and the status words `draft` and `not yet published`. Everything else stays byte for byte, including the entity naming on all five and doc 22's "for legal review" (see Risks for why I read the ruling this narrowly).
- **Doc 20's own "Version:" line (uncommitted).** It said 2.4 and now says 2.8, with "Last updated" moved to match (ruling 3: each document names one version). The `www.` domain on that line is unchanged; nobody ruled on it.
- **Ruling 2 was not carried out, deliberately. See Found 1.** No clause was removed.
- **Checks (uncommitted).** Permission suite `jr1`–`jr6`; render suite `leg-r7` and `leg-r8`. `leg-r3` and `leg-r5` now read the expected version from the register through `lib/legal-doc` instead of a typed number, so a bump cannot leave the suite asserting the old one.

Ran (worktree `builder-legal-preamble`, DB 54325, app 3006; `df -h /` was 18–20 GiB free throughout, never under 6):

- **Red on today's tree, before any document edit (the merged head `713a692` plus the new checks):**
  - perms: `jr1` ×4 (21, 22, 24, 25 serve "not yet published"); `jr2` ×3 (doc 20: body says v2.4, prose says v2.6; doc 21: prose says v2.4; doc 22: header and colophon say v1.9); `jr3` (waitlist stamps `e8268292a4f5…`, the consent path `477ae5496166…`); `jr4` (`lib/consent.ts` has a typed hash).
  - render: `leg-r7`, and `leg-r8` on `/privacy/family` and `/terms`.
- **After the edits I could make: perms 1,295 passed, 3 failed.** All three failures are the blocked consent path: `jr2` doc 20 ("consent says v2.7"), `jr3` (waitlist still `e8268292a4f5…`, served doc 20 now `4de5b506785d…`) and `jr4`.
- **render 514/514**, including every `leg-r*`.
- **corpus-check: 2 failures.** S13 (`POLICY_SHA256` no longer matches doc 20; this is the consent path again) and S2 (see Found 4).
- **Not run this round:** write, layout, tsc, `build:check`. Nothing is landing, and write mutates. For reference, last round: write 305/311 with the six `sqf4*` red at the branch point too; layout 188 views with 0 overflow. `.next` and `.next-check` are deleted, and 3006 and 54325 are stopped by port.
- **`jr5`/`jr6` proven able to fail (L19):** adding any new "do not publish"-class line turns `jr5` red, and an answer from John that removes a held line turns `jr6` red until the set is emptied.

**Served text, byte for byte.** I diffed what `legalDocument()` serves for all five documents before and after. The only changed served lines are the version line under each title, doc 20's "Last updated" line, and the five footers. Every other served line is identical. The existing `leg5` still proves that every served line below the title is a verbatim substring of the source.

Found:

1. **Ruling 2 rests on a premise the codebase contradicts, and I left the clause served.** The only clause of the `[DO NOT PUBLISH UNTIL BUILT]` class is doc 22 §6.5 Suppression. Its capability is doc 32 **A1**: "a player's record can be made wholly invisible on request — no public page, no working link, no club listing — without deleting it". Migration `0049_launch_gate_controls.sql` built A1 and A2 on 17 September in nearly those words (`fn_person_hidden`, guardian pause, operator hold), and permission checks `g32-p1`–`p4` pin them green. John's own gate, **doc 32 B6**, says: *"If A1 and A2 are green, 6.5 may publish. If they are not, it must not."* A1's box also asks that a person has done it once on a test record, and that box is unticked. So "is 6.5 built?" already has two of John's answers on it, and the note under the clause (*"Status: not built. Today a guardian can pause a profile…"*) predates 0049. Removing 6.5 might take a promise we keep out of the Terms; stripping only its marker would publish it on my say-so. Per your instruction, I left it served and listed it. **Needs John:** is A1 green (tick doc 32 A1/A2), and then either 6.5 publishes with its marker and status note removed, or it comes out. Four served lines are held, pinned by `jr5` so nothing joins them quietly:
   - doc 22 §6.5 — `**[DO NOT PUBLISH UNTIL BUILT] 6.5 Suppression.** A guardian, or a club acting on a family's request, may ask for a player's record to be made entirely invisible — no public page, no club listing, no appearance anywhere — without deleting it. We act on those requests immediately and without asking why.` Waits on: doc 32 A1 (and A2).
   - The note under it — `*Status: not built. Today a guardian can pause a profile and disable its share link, which is less than this clause promises. Publishing it before the capability exists would be a promise to a frightened family that we cannot keep. See doc 19 recommendation 1.*`
   - Open-items row 4 — `| 4 | **Suppression clause promises a capability that does not exist yet — do not publish** | 6.5 | Must not publish before it is built |`
   - Open-items row 5 — `| 5 | **Guardian-contact gate at 2.3 is not current behaviour — do not publish** | 2.3 | Must not publish before it is built |`. This row is ambiguous twice over: the sentence it refers to is inside `[DRAFTED] 2.3` and carries its own `[LEGAL: doc 18 Q5. This last sentence is a proposed addition, not current behaviour.]`, which you told me not to touch.

   **Consequence: your proof "no rendered legal page contains `[DO NOT PUBLISH`" is not green, and I have not made it look green.** `jr5` pins the four lines and `jr6` forces the set to be emptied when John answers.
2. **`[DRAFTED]`, `[OUTLINE]` and `[LEGAL: doc 18 Qn]` markers still served, for John.** 88 in total, all untouched. Line numbers are in the edited source, which is +2 from `app`.
   - **doc 22, `[OUTLINE]` (4):** line 100 §3.3; line 161 §6.4; line 309 §A12; line 345 (Part 9 consequences).
   - **doc 22, `[LEGAL: doc 18 …]` (9):** 84 (§2.3, Q5); 100 (§3.3, Q7); 110 (§4.3, Q4); 128 (§5.5, Q6); 161 (§6.4, Q4); 188 (§8.1, Q11); 196 (Q11, the $2,000 floor); 226 (Schedule A banner, Q11); 325 (acceptance table, Q7).
   - **doc 25, `[LEGAL: doc 18 Q6 …]` (1):** line 137.
   - **doc 22, `[DRAFTED]` (74):** lines 57, 61, 80, 82, 84, 86–92, 96, 98, 102, 106, 108–114, 118–136, 139, 140, 145, 149, 153–159, 169–184, 188, 190, 198, 204–208, 228–234, 244–258, 269–277, 288, 290, 297–315, 335. These are the clause headings of §0.1–§8.6, Schedule A (A1–A13.2) and Part 9.
3. **The consent path — the blocked part — is where the remaining red is, and it is what makes this unlandable today.** `lib/consent.ts` still says `POLICY_VERSION = '20@v2.7'` and still types `POLICY_SHA256` (the file hash). `app/api/waitlist/route.ts` still stamps waitlist rows with `POLICY_STAMP`. So doc 20 currently has **two** hashes (waitlist `e8268292a4f5…` vs served `4de5b506785d…`). What is needed, all in the same commit as the document bumps:
   - `POLICY_VERSION = '20@v2.8'` and its stale comment ("Doc 20 is at v2.6");
   - delete `POLICY_SHA256` and `POLICY_STAMP`;
   - the waitlist route stamps `legalStamp('20')`;
   - corpus S13 rewritten to assert the rule rather than the constant (no typed hash in `lib/consent.ts`, and the waitlist uses `legalStamp`), because once the constant is gone S13 fails by design (L33).

   **Needs your call, or BUZ's permission for me to touch `lib/consent.ts`.**
4. **Corpus S2 calls today's date a dead-runway date.** `DEAD_DATES` matches `2[18] Sep…`. Two trips were my own wording in the unserved change log and the register, and I rephrased those. The third is **served**: doc 20's `**Last updated:** 28 September 2026`, because "Last updated:" is not in S2's closed list of dateline lead-ins ("current as of", "as at", "as of", "dated"). Proposed fix, not applied (it is another seat's check): add `last updated:` to that closed list, the same class as false positive #10.
5. **The register's "Still recommended and not yet built: store a SHA-256 of the rendered document … on the consent row" is now stale:** `legalStamp` does exactly that. Unchanged, because John did not rule on it.
6. **Doc 23 was left alone.** Your message says the colophons go on "docs 21–25". Doc 23 (Retention) is internal and not rendered anywhere, and John's reason — "these versions are the published ones" — does not reach a document that is not published. Removing "not yet published" from it would assert something untrue. **Needs John** only if he meant 23 as well.
7. Still true from last round: `sqf4b`–`g` are red at `app` (the test expects `squad=declined`, a banned word); `build:check` rewrites `next-env.d.ts`; and `lib/db.ts` reads `DEV_DB_PORT` while `dev-db.mts` reads `PITCH_DEV_DB_PORT`.

Copy for BUZ: nothing new beyond what John's rulings require. Every served string that changed, verbatim:

- Version lines (the same pattern as last round, which is still awaiting your approval; new values):
  - `Version 2.8 · 28 September 2026` (/privacy)
  - `Version 2.6 · 28 September 2026` (/privacy/family and the approval flow)
  - `Version 2.0 · 28 September 2026` (/terms)
  - `Version 1.4 · 28 September 2026` (docs 24 and 25, no route yet)
- Doc 20: `**Last updated:** 3 September 2026 · **Version:** 2.4 · **Applies to:** everything at www.pitchfootball.com.au` → `**Last updated:** 28 September 2026 · **Version:** 2.8 · **Applies to:** everything at www.pitchfootball.com.au`
- Footers (the entity naming is unchanged on all five):
  - doc 20: `· doc 20 · v2.7 draft · 15 September 2026 · supersedes v2.4,` → `· doc 20 · v2.8 · 28 September 2026 · supersedes v2.4,` (rest unchanged)
  - doc 21: `· doc 21 · v2.5 draft · 15 September 2026 · not yet published*` → `· doc 21 · v2.6 · 28 September 2026*`
  - doc 22: `· doc 22 · v1.9 · 7 September 2026 · not yet published · for legal review ·` → `· doc 22 · v2.0 · 28 September 2026 · for legal review ·` (rest unchanged)
  - doc 24: `· doc 24 · v1.3 draft · 3 September 2026 · not yet published · forms Schedule C` → `· doc 24 · v1.4 · 28 September 2026 · forms Schedule C` (rest unchanged)
  - doc 25: `· doc 25 · v1.3 draft · 7 September 2026 · not yet published · Part 1 is public` → `· doc 25 · v1.4 · 28 September 2026 · Part 1 is public` (rest unchanged)

Unserved legal text also changed (the change log and the register), verbatim. Each change-log entry is followed by a `>` line:

- **doc 20:** `> **v2.8, 28 September 2026 — published. No clause changes.** What changed is what a reader is shown: these drafting notes are no longer served, the "Last updated" line and the footer name this version, and the footer no longer calls it a draft. John, doc 35 ruling 1: removing the preamble from what is served is not material; the version bumps so that a consent row names exactly the text that was shown, and nobody is re-asked. Ruling 3: these versions are the published ones.`
- **doc 21:** `> **v2.6, 28 September 2026 — published. No clause changes, and no change a reader could re-measure.** These drafting notes are no longer served — this is the policy shown inside the guardian approval flow (doc 32 B3) — and the footer names this version and no longer says it is a draft or unpublished.` followed by the same two ruling sentences as doc 20.
- **doc 22:** `> **v2.0, 28 September 2026 — published. No clause changes.** These drafting notes are no longer served, and the footer names this version and no longer says it is unpublished. **Why v2.0 and not v1.10:** v1.9 is already recorded in this document while the register said v1.8, so the next number had to be newer than both — and v1.10 reads as older than v1.9 to anyone comparing decimals. **Clause 6.5 and open items 4 and 5 are unchanged and still served:** ruling 2 removes clauses describing capabilities that are not built, and 6.5 describes doc 32 A1, which migration 0049 built on 17 September; doc 32 B6 says 6.5 may publish if A1 and A2 are green. That question is with John.` followed by the same two ruling sentences.
- **doc 24:** `> **v1.4, 28 September 2026 — published. No rule changes.** These drafting notes are no longer served, and the footer names this version and no longer calls it a draft or unpublished. It still names the entity, because this footer is the only place the served document does.` followed by the same two ruling sentences.
- **doc 25:** as doc 24, with "No clause changes." in place of "No rule changes."
- **Register:**
  - The five table cells: v2.7→v2.8, v2.5→v2.6, v1.8→v2.0, v1.3→v1.4, v1.3→v1.4.
  - The prose: `currently \`20@v2.6\`, \`21@v2.4\`, \`22@v1.8\`` → `currently \`20@v2.8\`, \`21@v2.6\`, \`22@v2.0\``.
  - One new paragraph: `**The materiality ruling on the record (John, doc 35 rulings 1 and 3, dated 28 September 2026):** removing the drafting preamble from what is served is **not material**, and **no guardian is re-asked**, because nothing in the agreement changed. **The version still bumps**, so that every consent row names exactly the text that was shown: doc 20 **v2.8**, doc 21 **v2.6**, doc 22 **v2.0**, doc 24 **v1.4**, doc 25 **v1.4**, each newer than any version previously recorded for it anywhere (doc 22 is v2.0 because v1.9 had been recorded in the document while this table said v1.8). These are the published versions, and their footers no longer say otherwise.`

Risks:

- **Do not commit the uncommitted tree as it stands.** It moves the served text of `/privacy` without moving `lib/consent.ts`, which is the exact split the register forbids, and three permission checks plus S13 are red because of it.
- **I read "the colophons go" narrowly:** I removed the status words and kept each footer, with the version updated. Your message could be read as removing the whole footer on 21 and 22. I chose the reading that changes less legal text and keeps a version in each footer, which is what ruling 3 asks each document to have. If John meant the whole line, that is a one-line change per document.
- **Doc 22 would land as a "published" v2.0 that still serves "[DO NOT PUBLISH UNTIL BUILT] 6.5"** until John answers Found 1. That is today's served text renumbered, not a regression, but it is contradictory on its face and will need another version (v2.1) when he answers.
- **Every stamp changes value** when this lands: the three stamped documents get new served hashes, and the waitlist moves off the file hash. Pre-launch, dev rows only.

Lesson: an instruction can carry a factual premise that the code has already made false. "Remove the clauses whose capabilities aren't built" was a clean ruling; the only clause it named describes a capability built eleven days earlier, and John's own launch gate (doc 32 B6) had already written the rule for that case. Before carrying out a ruling about the product's state, check the state (L28, L13).
