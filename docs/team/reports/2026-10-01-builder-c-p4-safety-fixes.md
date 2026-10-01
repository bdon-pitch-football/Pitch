# builder: C-P4, the safety review's fixes (1 Oct)

Asked: Leo asked me to:
- bring build/c-p4 up to build/full-release;
- fix B-1, S-1, S-2, N-1 and N-3 from `2026-10-01-safety-review-c-p4.md`, each with a check shown red on the unfixed code;
- add HoPD's wording on the parent's /send.

Did:
- `git merge build/full-release`: a fast-forward to e43cf0f. It includes c6c543e (the tab title, and /fc hiding the parent's buttons for a paused child).
- **B-1:** `app/register-interest/[recordId]/actions.ts`. The parent's door now follows the self path's one-entry-per-club rule.
  - The child's row is locked first, so two presses at once cannot both find nothing.
  - If the child is already on that club's register, nothing new is written. A trial chosen now goes onto the existing entry, and the press lands on `?registered=1`, exactly as the self path does.
- **B-1 belt:** `app/registers/actions.ts` (`takeOffRegister`). After the pressed entry comes off, every other live entry the player has at that club comes off too.
  - Each one goes through `fn_withdraw_registration`, the database's own answer, and gets its own `registration_withdrawn` row.
  - No permission function changed.
- **S-1:** `lib/send-dispatch.ts`. A new optional `initiatingActor` argument. The consent row writes `coalesce($5, sr.requested_by)`.
  - The /send guardian branch passes the parent.
  - /g/send and the player's own door pass nothing, so their rows are unchanged.
  - `requested_by` stays the child, so erasure (0084) is untouched.
- **S-2:** `app/send/[recordId]/actions.ts`. A parent's limited press writes a `send_held` row (0046) on the child: the club name only.
  - `app/g/controls/[childId]/page.tsx` lists it under "Where {name}’s CV has been sent", using the existing line "This one didn’t go. You can send it again later." It shows no address, no switch and no number.
  - The read is gated by `fn_record_actor(viewer, record) = 'guardian'`.
  - No new words, event or migration. The landing is unchanged (C-P4-w16).
- **N-3:** `lib/interest-dispatch.ts`. One predicate under the lock (`not profile_paused`), shared by /g/interest and the parent's door.
- **HoPD:** `app/send/[recordId]/page.tsx`. In the parent's view only, the third row of "What the club gets" is /g/send's line, with the same characters as /g/send. The child's view is unchanged.
- **Tests:**
  - **Perms:**
    - C-P4-6 (S-1) runs `lib/send-dispatch`'s own consent statement with each door's arguments, and pins the call sites.
    - C-P4-7 (N-3) runs `lib/interest-dispatch`'s own select, paused and then unpaused.
  - **Render:** C-P4-r9 (HoPD).
  - **Write:**
    - sc-w6b (N-1): the parent's press to a stopped club gets `?blocked=1` and no §19.
    - C-P4-w12, the belt: /g/interest makes a duplicate, and one take-off ends both (register CV 404 for each).
    - C-P4-w13 (B-1): two more presses, one from the trial, still leave one live entry, and the trial is now on it (the TD's invite page says "registered interest in").
    - C-P4-w14: taking that entry off ends the TD's access (404).
    - C-P4-w15 (N-3): paused between page and press, /g/interest registers nothing, even after the pause lifts. Unpaused, the same press goes.
    - C-P4-w16: the parent's limited press is byte-identical to their real one.
    - C-P4-w17 (S-2): the held press shows as "didn't go" on the child's controls, and nothing reaches the club.
  - The register half of the comparison block moved to Deniz at Kingsway, so its take-offs stay out of H2's (D-170) count on Georgia (L32).

Ran (e43cf0f plus these changes, from a fresh seed, in TRAINING order, app restarted after the second reseed, ports 54531/3331/9531):
- perms 2100/2100
- render 821/821
- write 614/614
- layout 274 views, all green
- palette all green
- tsc clean
- build ok
- csp-prod 5/5
- corpus 0 failures, 0 warnings
- secret-scan clean
- gate 263/263

Unfixed-code proof (e43cf0f's product files, new tests):

| Suite | Red on the unfixed code |
|---|---|
| perms | C-P4-6, C-P4-7 |
| render | C-P4-r9 |
| write | C-P4-w12, w13, w14, w15, w17 |
| write, via mutant | sc-w6b |

- sc-w6b guards a rule that already held, so I proved it with a mutant: the parent's door skips the `?blocked=1` check. It went red. The dispatch's own `fn_send_blocked` still sent nothing.
- C-P4-w16 passes on both, by design: it pins L38.

Found:
1. **S-2 side effect.** `send_held` keyed on the child also appears in the child's own "Your links" once they are 16 and send for themselves, because YourLinks reads `send_held` for self. They already see every send their parent made (fn_send_log), so this is consistent. But it is a parent's held press shown to the child, so it is listed for John.
2. **HoPD's words.** Leo's message quoted "No contact details for you or {first}" and called it /g/send's approved line. /g/send's line is "No contact details for you or {first} — not now, and not if they reply." I used /g/send's line whole.
3. **N-2 is not fixed** (it was not in the list). A dispatch that *throws* still leaves the parent's request behind.

Copy for BUZ:
- /send, parent view: "No contact details for you or {first} — not now, and not if they reply." This is /g/send's approved line, now also on the parent's /send. It replaces "Not your phone number, your email or your address. They never get those." there only.
- Controls, held parent send: "This one didn’t go. You can send it again later." This is 0046's approved line, now also on the parent's controls list.

Risks:
- The one-entry rule is enforced in the app, under a row lock, not by a unique index. /g/interest still makes duplicates (pre-existing); the belt makes the take-off true regardless.
- test:timing was not run.

Lesson: a fixture that takes things off a child's register changes every later count of that child's timeline. Before a block writes to a child, grep the suite for checks that count that child's lines (H2 here).
