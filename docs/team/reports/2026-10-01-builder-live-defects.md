# builder: the live defects from the Floodlit specs (1 Oct 2026)
Asked: on a branch of my own off `app` (95e8c4a), fix the live defects the Head of Product Design listed (`design/player-cv:docs/design/specs/README.md`, "Live defects found while designing"), BUZ's approved "Recommended yes" fixes first (A-P8, then D-PD-1, then the rest), plus the pure defects #6, #8, #24–#28. Not #10, #12, #22, #23; #9 and #21 only with approved words. No new words. Never push, never merge.

Did (branch `fix/live-defects`, commit 258ba44 on 95e8c4a, not pushed, not merged):

Fixed, by defect number in the README table:
- **#1 A-P8** · `app/home/page.tsx`: the administrator's Plan block (the only place `/home` prints `$54`) and the payment notice are drawn only when `billingEnabled()` is on, the same switch as the sidebar door. Before, only `fn_register_payment_state` answering `'free'` kept them off.
- **#3 A-P9** · `components/console-shell.tsx`: the operator's Home door goes to `/ops`.
- **#4 D-PD-1** · `app/g/{card,send,interest,pending}/…/page.tsx`: "Not this one" is a `<Link href="/home">`, styled as before (muted text, 44px), still inside the form but not a field, so no form lookup moves. `app/g/invite/[invitationId]/page.tsx`: "Not this time" is added beside the reply form's submit, as a link (the first screen's existing control and words).
- **#5 D-PD-2** + **D-F1** · removed "Edit the words first" (pending), "Change the address" (send), "Edit what {name} wrote" (interest), and the pending tick "You can edit the words before you approve them."
- **#6** · `app/globals.css` (new `.opt` block, the spec's CSS verbatim) and the invite reply form: each answer is a `label.opt` whose look follows its own checked radio. No JavaScript.
- **#7 D-PD-4** · `components/cv/LinkState.tsx`: a new `FinishedLink` (no props) says LinkState's three approved sentences and the failure path's "Go to the start" at 200. `app/a/[id]/page.tsx` and `app/a/[id]/done/page.tsx` return it where they called `notFound()`. LinkState's signature is unchanged (E11) and its words now live in one constant both read. The landing write (`recordGuardianLanded`) still comes after the finished-link answer.
- **#8 D-F2** · `app/g/pending/[recordId]/page.tsx`: with no change waiting and no `?done=1`, the page says "Nothing is waiting on you." The approved state renders only after `?done=1`.
- **#9 D-F3** · `/g/interest` sent state: "…from the Manage page." becomes "…from Your family." (approved line 5).
- **#11 G-P2** · `supabase/migrations/0164_reset_link_checked_on_load.sql` adds `fn_auth_reset_live(bytea)`: read-only, the same predicate `fn_use_auth_reset` selects with, never marks a link used, execute revoked from public/anon/authenticated (0122's pattern). `lib/auth.ts` `resetLinkLive()`; `app/reset/[token]/page.tsx` redirects a dead link to `/reset?expired=1` before drawing the form. The press still goes through `fn_use_auth_reset`.
- **#13 C-P9** · `app/share-card/[recordId]/page.tsx` redirects an 18+ to `/home`; `actions.ts` refuses an 18+ too, before a `share_card_approval` row is written (no row nobody can approve).
- **#14 C-P7** · `app/build/[recordId]/ready/page.tsx`: "Send it to a club" shows only when `sendState()` gives this viewer a screen (`mode !== 'none'`), the same gate `/send` and its action read.
- **#17 C-P5** · "Cancel" on `/share-card` and `/register-interest` (`InterestForm.tsx`) is a link to `/home`.
- **#18 C-P6** · `app/build/[recordId]/page.tsx` + `BuildForm.tsx`: `?photo=bad` shows the approved refusal line in an amber notice.
- **#19 C-P8** · `InterestForm.tsx`: no "Which squad" field when the club has no squads (it posted nothing either way).
- **#20 E3** · `app/coach/edit/page.tsx`: the JSX nesting is undone. Order is now photo, banner, profile, Where you've coached (list, then its add form), licences, accomplishments, clips. Nothing added or removed; the role form keeps its `org` field.
- **#21 EC4** · `/coach/edit` WWCC panel: "We asked {club} to confirm you hold a current check." only when the coach holds a club membership (an approved removal).
- **#24 F-N1** · `app/club/register/page.tsx`: an empty register says the trials branch's approved line; "just narrowed" only when a filter emptied a non-empty list.
- **#25** · `app/ops/page.tsx`: the Approved tile's "% of sent" is omitted when nothing was sent today.
- **#27** · `app/ops/verification/page.tsx`: with no clubs, the approved line "No club has claimed its page yet." instead of a table head over nothing.
- **#28** · `components/DemoBar.tsx`: "Switch seat" is 44px tall; the strip lost its 7px padding, so it grows 16px. Still green (J-P1 was not in my brief).

Already fixed on `app`: **#16** (C-P4 note) — `app/fc/[slug]/page.tsx` already filters a parent's send/register buttons to under-16 children.

Left, and why:
- **#2 A-P4** (next trial by age group): the spec itself says "It needs a rule for adults ('SEN') and players with no squad", and no rule is settled. Age group lives on the squad, never on a person (D-68, D-25), so deriving it from a date of birth is a product decision. Options for Leo/BUZ: (a) match the trial's age groups against the squad the player is in or registered for, and show no next trial when there is none (most restrictive, no new words); (b) same, but fall back to today's behaviour when there is no squad; (c) derive an age group from the birth year (needs a D-number; touches D-68/D-25).
- **#15 C-P4** (a parent sends for their under-16 from `/send` and `/register-interest`): not built. It is a new dispatch path on a child's send, and the approved words do not cover the screens. `/send` would get the title, the who row and the button (N5) but keep "Pick who it goes to. Your CV goes as a link…" and three "What the club gets" rows addressed to the child; `/register-interest` has no approved parent words at all ("Send {first}'s CV" and "Send it now" are not register words). Needs: words for both screens, and a ruling that a guardian composing on `/send` dispatches in one press (requested_by = the guardian, `fn_can_dispatch` already allows it, the other guardian's U-2 undo still fires), plus a `SendMode` `'guardian'` and a write test. I can build it in about half a day once the words exist.
- **#10 G-P1, #22 HC3**: with John. **#23 HC2**: BUZ's copy. Not touched.
- **#26** (`/ops/reports` suppress form on a suppressed link): not a live defect. 0049's check constraint (`suppressed_at is null or revoked_at is not null`) makes every suppressed link a revoked one, so `!l.revoked` already hides the form. I changed the page, then found the new check passed on the old code, and reverted the page. The behaviour is pinned by write g32-16b.
- **#12 /unsubscribe**: not touched as instructed. Note: the removal is on `design/player-cv` only; `app` still renders "Changed your mind? Join again any time."

Tests (every new check is `dfx-`; each was run against the 95e8c4a code, results under "Proof on the old code"):
- perms (static and database): dfx-A-P8, dfx-A-P9, dfx-PD-1s ×4 (incl. `/g/card`, which has no seeded card), dfx-G-P2, dfx-G-P2b (`fn_auth_reset_live` vs `fn_use_auth_reset`: newest live, replaced/expired/never false, asking uses nothing), dfx-I-25, dfx-I-27, dfx-F-N1, dfx-J-28, dfx-C-P9b.
- render (read-only): dfx-PD-1 ×3 and dfx-PD-2 ×3 as served, dfx-D-F1, dfx-D-F2/F2b, dfx-PD-4/4b (three dead `/a/` codes, one body; done page dead or unapproved, one body, no family), dfx-C-P8, dfx-C-P5/5b, dfx-C-P9, dfx-C-P6, dfx-E3, dfx-EC4.
- write: dfx-PD-4 (approved, held and never-existed `/a/` links one body), dfx-C-P7/7b (Tess before and after her parent confirms), dfx-D-F3, dfx-D-6, dfx-PD-1b, dfx-G-P2/2b; g32-16b pins #26's non-defect.
- Proof on the old code (L20): the 95e8c4a app with these suites, its own seed and ports. perms: all 13 dfx checks failed, plus land5 (and dfx-G-P2b throws without 0163). render: 17 of 18 dfx checks failed; dfx-D-F2b, the "after an approval" control, passes on both. write: dfx-PD-4, dfx-C-P7, dfx-D-F3, dfx-D-6, dfx-PD-1b, dfx-G-P2, dfx-G-P2b, ia2h and ia3b failed; dfx-C-P7b (the after-confirmation control) and g32-16b pass on both.
- Changed because the product changed, never loosened: write ia2h and ia3b asserted 404 for a finished `/a/` link and now assert the finished-link page (200, the words, no form, no "taken down", and the two links identical); perms land5 asserted `notFound()` before `recordGuardianLanded(` and now asserts the `FinishedLink` return before it; write sess-w13/w15 opened a dead reset link to find the form, which no longer exists, so they press with the live link's form carrying the dead token (the action must still refuse, and does); write e4's draft answer is now "Interested, not that date" so dfx-D-6 can see which answer is drawn chosen (e5–e8 do not read the answer).
- Fixtures: `scripts/dev-db.mts` seeds a live reset link `/reset/dev-reset` for Robin, and `scripts/layout-check.mjs`'s focus-ring walk uses it in place of `/reset/dev-none`, which since G-P2 no longer draws the new-password form (the ring check would have silently stopped measuring it).

Ran (fresh seed, worktree `agent-ae8951f8b6c15cc3c`, db 54351, app 3051, CDP 9351; on 95e8c4a + this change):
- perms 1965/1965
- render 679/679
- write 528/528
- layout: 238 views at 375 and 1280, all green. One of three runs failed /join j1b ("Continue landed on 'What’s your position?'"); /join is untouched, and the rerun from a fresh seed was green.
- timing, on a large-heap app (NODE_OPTIONS=--max-old-space-size=12288), two runs:
  - run 1, load 8–12: 17/19. E10 and J61 inconclusive (resolution 1.13ms and 3.48ms). No shift found: largest +0.17ms, p = 0.23.
  - run 2, load 4–6: 18/19. E10 green at 0.70ms. J61 inconclusive at 1.13 and 1.02ms, shifts +0.01ms (p = 0.95) and −0.00ms (p = 0.99). J61 reads the held club's `/home` and `/club/register`; this change adds no query to either path.
- tsc clean
- build:check ok
- csp-prod 5/5
- corpus clean
- secret-scan clean
- gate-coverage 263/263
- palette all green

Found:
- A-P8 was not printing a price on `app` today: with billing off, `fn_register_payment_state` answers `'free'`, so the block could not render. The fix makes it hold by rule, as the spec asks.
- A-P9 as specified leaves two operator doors to `/ops` (Today and Home), and `OpsHeader`'s default back link still goes to `/home`, which falls through to the brand-new welcome for an operator with no other seat. Not changed.
- `/g/pending` with nothing waiting no longer offers "Get the share link". A guardian issues links from the controls page and after an approval (`?done=1`), so nothing is lost that I can find; say if you want it back.
- Approved lines I did not use because they were not in my brief: D-F4 ("…Nothing is sent, and the club is simply not told.", `/g/invite` well — the current "It closes this one invitation" is untrue, D-138), D-F5 (guardian of an 18+), C-N2 ("Profile photo"), N-I2 ("Nothing yet today." on `/ops`).

Copy for BUZ (all from the approved list or approved words in a new place; nothing new):
- New lines used (approved, BUZ 1 Oct): "Nothing is waiting on you." (`/g/pending`) · "You can take {name} off the register any time from Your family. Their access ends when you do." (`/g/interest`, sent; was "…from the Manage page.") · "That photo didn’t upload. Try a JPG or PNG under 8 MB." (`/build?photo=bad`) · "No club has claimed its page yet." (`/ops/verification`, empty).
- Approved words in a new place: "Not this time" (beside the `/g/invite` reply submit) · "This link doesn’t open anything" / "It may have been switched off, it may have expired, or it may never have been a link at all. We don’t say which." / "That is deliberate. If we told you which, anyone could use a wrong link to find out whether a particular child is on Pitch. The answer is the same either way." / "Go to the start" (every finished `/a/` link and its done page) · "Nobody has registered interest in your trials yet. Post a trial and families register from it." (`/club/register`, nobody registered).
- Removed: "Edit the words first" · "Change the address" · "Edit what {name} wrote" · "You can edit the words before you approve them." · "We asked {club} to confirm you hold a current check." (only when the coach has no club) · "{n}% of sent" when nothing was sent · "{name}’s page is approved" / "Clubs holding the link now read this version." and the "Get the share link" button (only when nothing is waiting and nothing was just approved) · the root 404's words on finished `/a/` links · "Which squad" when the club has no squads · "Send it to a club" on `/build/ready` where it would bounce · the share-card page for an adult.

Risks:
- `fn_auth_reset_live` restates `fn_use_auth_reset`'s predicate; if one changes, the other must. dfx-G-P2b compares them on four states.
- The `.opt` chosen state uses `:has()`; a browser without it shows both answers unchosen (never the wrong one).
- Not checked: the demo (`npm run demo`), where #28 renders; only a source check pins the 44px. Real handsets.

Lesson: React writes a checked radio as `checked=""` before its `value`, and a `next/link` writes `style` before `href`; a test regex that assumes attribute order fails for the wrong reason. Read the whole tag.
