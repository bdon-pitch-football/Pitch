# Final round J: the Terms a parent reads on 1 October, with no drafting in them

For the tech-builder seat, from Leo.

**Where things stand:**
- John ruled on Schedule A: Terms **v2.1**, committed at 8e4bbc7.
- He did not answer doc 37's items 2–6, so **the defaults written in doc 37
  apply.** Read `docs/legal/37-For-John-before-launch.md` first; it is the
  authority for this round.
- **v2.1 has not been published to anyone yet.** The app is not live, and the
  website serves its own v2.0. So these changes finish v2.1 before it ships.
  **No new version number**, unless a document other than 22 changes what it
  serves (see below).

## The rule of this round: nothing John wrote is reworded

These are removals and render rules only. Every clause that stays is served
word for word.

1. **Item 2, `[DRAFTED]` labels:** strip them at render, in `lib/legal-doc.ts`,
   as the preamble is stripped. The source file keeps them. The label and the
   single space after it go; nothing else.
2. **Item 3, §6.5 Suppression** (`[DO NOT PUBLISH UNTIL BUILT]`): **not
   served** until John ticks his box. Build a render rule that drops a clause
   carrying that marker, whole. Leo operates suppression on the preview on
   30 Sep and sends John the log; if he ticks it, the marker comes off in a
   later version.
3. **Item 4, the five `[OUTLINE]` clauses:** not served. Same render rule:
   a paragraph carrying `[OUTLINE]` is dropped whole. That covers 3.3, 6.4,
   A12, the Part 8 consequences paragraph, and the table cell.
4. **Item 6, the `[LEGAL: doc 18 …]` notes:** the bracketed note is not served;
   the clause it sits in is. **Except two clauses, which are held (not served
   at all) by John's default:**
   - the **$2,000 liability floor** (doc 22, the Q11 clause in Part 8);
   - the **five-year record period**, wherever it appears (doc 22 §5.5's
     record sentence, doc 25 Part 4, and doc 23's retention row). Hold only
     the sentence or row that states the period, not the whole section.
     Name exactly what you held in your report.
5. **Internal drafting tables and notes in the body** (for example the open
   questions table near the end of doc 22: "do not publish", "Must not
   publish before it is built", "Whether a 14-day cooling-off…"): not served.
   They are drafting, like the preamble. List every block you drop.
6. **Versions:**
   - Doc 22 stays v2.1 (unpublished).
   - If doc 25's or doc 23's served text changes, bump its version in its own
     change note and in `00-Legal-Register.md`'s rendered table, and nowhere
     else. Keep the preamble a single contiguous block: a blank line inside it
     makes the page serve the whole old preamble (it happened on 29 Sep).
   - Consent stamps come from `legalStamp()`, so they follow automatically.

## Checks, each proven red

- `/terms`, `/privacy`, `/privacy/family`, `/report` and `/conduct` serve no
  `[DRAFTED]`, `[OUTLINE]`, `[LEGAL`, `[DO NOT PUBLISH`, "do not publish",
  "must not publish", "not yet published" or "for legal review".
- **The held clauses** are absent from what is served, and present in the
  source.
- **Every clause that stays is byte-identical** to the source minus the
  stripped markers. Write this as a property, so a render rule can never eat
  real text.
- `free-r1c` updated to the new count of dollar lines on `/terms`, with the
  reason.

## Machine and method

- **Tree:** `.claude/worktrees/builder-final-j`.
- **Ports:** database 54472, app 3270, Chrome CDP 9473. Point every probe at
  3270. **Never touch** 3000, 54322, 3030 or 54323.
- Check the load and free disk before each suite. Wait for other seats'
  Chrome before a layout pass.
- Run every suite from a fresh seed in TRAINING §4 order, plus `test:timing`
  (under load 8), `test:csp-prod` and `build:check`.
- Write your report to `docs/team/reports/2026-09-29-builder-final-j.md`.
  **Put the exact list of what is no longer served at the top.** BUZ and John
  will read that part.
