# builder: John's rulings of 1 Oct — G-P1, PD-3, HC3, plus §39, B1/F3, B2, F6, F10 (2026-10-01)

Asked: build John's three rulings (BUZ: "Yes to the §36 window change, hand John's rulings to Leo"; "Yes to the line"), John's PD-3 sign-off with four conditions and his §39 script condition, and Leo's mid-task additions: the PD-3 label "No, end this request", B1/F3 (/join/waiting after approval), B2 (ask for the TD), F6 (state 3q), F10 (the line above "Log the call"). Worktree `build/john-rulings` off `app` at c912cf4. Ports DB 54481, app 3281, CDP 9481.

Did:
- **supabase/migrations/0167_a_parent_can_end_the_request.sql** (new). One deletion of a pending child, two triggers. `fn_purge_pending_invitation(id, detail)` is the only function that deletes a pending invitation: it locks the row (never an approved one), closes a waiting text as before (0120), empties every message of that invitation (body, subject, address), deletes the row, and writes one `purged` event with no subject and no actor. `fn_purge_pending()` (the 14-day job) now loops over the same invitations as before and calls it. `fn_end_pending_invitation(token_hash)` is the parent's press. It refuses (changing nothing) unless the hash is one of the two channel links (never the invitation id the child holds), at least one channel is confirmed, and the row is neither approved nor held. It records `reason: ended_by_recipient` and `channel: 'sms'|'email'` (the link pressed); the time is the event's own `at`. Both functions are revoked from PUBLIC/anon/authenticated (0166's pattern).
- **supabase/migrations/0168_the_call_sheet_says_whether_s39_will_send.sql** (new). `fn_verified_call_addressee(club)` is the person half of 0166's answer (one live admin, an adult, a proved address that is not the club's published one), now returning `first_name` as well. `fn_verified_call_recipient(call)` asks it and adds only the call conditions. The sheet and the send therefore cannot disagree. Before a call exists there is no call id, so the sheet asks the addressee function directly.
- **lib/send-dispatch.ts**: U-2 as amended. The §36 undo now expires `coalesce((select expires_at from share_token where id = $2), now() + interval '90 days')`, which is §37's expression. Comments updated in `lib/messages.ts` and `app/ops/call/[clubId]/actions.ts`.
- **app/undo/[token]/page.tsx**, **app/undo/done/page.tsx** (new), **components/undo.tsx** (new). G-P1.
  - On load, one statement from the hash decides "live" (undo unused, in date, and its link still on).
  - Any other token (used, lapsed, link already off, never existed) gets one not-live panel: "This link isn't live", /confirm's sentence plus N-G1, and "Go to sign in" pointing to /signin.
  - The press is one statement of one shape for every token (a data-modifying CTE). It redirects to `/undo/done` only when it actually revoked a link (count = 1); otherwise it goes back to the not-live panel.
  - Done keeps "This does not un-send the email".
- **app/a/[id]/page.tsx**, **app/a/[id]/actions.ts**, **lib/guardian-flow.ts**, **app/a/closed/page.tsx** (new). PD-3.
  - `PD3_END_LABEL = 'No, end this request'` is one constant that every suite reads.
  - The end button shows from the first confirmed channel: under the status card (3); under "Yes, it's me" on the second link (3b); and in state 4/5 in the answer pair's second cell above the unchanged do-nothing well.
  - In state 4/5 the button submits `form="pd-end"`, its own form placed after the approve form, which posts only `code` and needs no adult tick.
  - Ended goes to `/a/closed`, a fixed address that ignores the code. Refused goes back to `/a/<code>` as it was. No message is sent.
  - F6/3q: when the email is confirmed and the text is still queued (`invitationTextWaiting`, i.e. `fn_invitation_sms_queued`), the status line is BUZ's.
- **app/join/waiting/[id]/page.tsx**: B1/F3. After approval the page shows an approved state (BUZ's confirmed words) instead of `notFound()`. The closed state is untouched, so ended, expired and never-existed stay one page.
- **app/ops/call/[clubId]/page.tsx**: B2 adds the TD prompt (`TD_ASK`, BUZ-confirmed) in the Technical Director section. F10 adds the line directly above "Log the call", decided by `fn_verified_call_addressee`. It shows the first name only, never the address.
- **app/report/page.tsx**, **components/FailureState.tsx**: HC3. All three places now use doc 25's sentence word for word. No 131 444.
- **docs/27-Verification-Call.md** and root `../27-Club-Verification-Call.md`, byte-identical (cmp):
  - new step 5, the TD question (BUZ-confirmed);
  - step 6 "Close" is now conditional on the sheet's line. The no-email version ends at "today" and keeps "If anything changes…".
- **docs/14-Permission-Tests.md** L17's note: U-2 ruled and amended, "for as long as that link lives".
- **app/dev/undo/route.ts** (new, dev only, gated exactly like /dev/ratelimit). It mints undo tokens in a chosen state (live, used, lapsed, off) against throwaway share tokens, for the render and timing suites.
- Tests, all `jr-`:
  - permission-tests: 30 new;
  - render-tests: 10 new;
  - write-tests: 13 new;
  - timing-tests: new row `jr-undo` (4 checks + setup).
  - layout-check: walks /a/closed, a not-live /undo and /undo/done.
- Moved tests:
  - **L17b** asserts the coalesce expression in the actual insert and no 24 hours. `jr-u2` executes that SQL.
  - **I2/I2b** read the deletion where it now lives: the job calls the one deletion, and that function deletes and never marks.
  - **fp12** finds the urgent line by the new sentence.
  - **susp-w10** now also records where the press lands (jr-undo-w1/w2).
  - Nothing was loosened.

Ran (final code, worktree build/john-rulings):
- **perms 2050/2050**, run directly, no server.
- **render 712/712 · write 579/579**: fresh reseed, render, write.
- **layout 256 views at 375 and 1280**: reseed, restart next dev, run. 0 overflow, ALL GREEN. An extra run with Mila's two channels confirmed (state 4 with the No in the answer pair) was also 256 views, ALL GREEN.
- **timing**: fresh reseed, 12 GB-heap app on 3281. **23/24**:
  - E10 res 0.66ms;
  - tok-rl 0.70;
  - req-t 0.55;
  - L40 0.59;
  - **jr-undo-t1** (load: used −0.06ms, lapsed −0.01, already-off −0.03 vs never-a-link; res 0.74ms) green;
  - **jr-undo-t2** (press: used +0.01, lapsed +0.06, off +0.07, **live→Done +0.09ms p=0.34**; res 0.55ms) green;
  - t1b/t2b byte checks green.
- **J61 INCONCLUSIVE twice**: res 1.52/1.64ms, then 1.05/0.90ms after a fresh reseed, with no shift detected either time (p=0.79/0.43, then 0.89/0.17). J61 measures the club's register pages, which this change does not touch.
- palette ALL GREEN · corpus 0 failures · secret-scan clean · gate-coverage 263/263 · tsc 0 errors · validate-migrations ALL GREEN.
- build:check exit 0 (NEXT_DIST_DIR=.next-check) · csp-prod 5/5.
- Each new check was proven to fail on broken or old code (L20):
  - Perms: two rounds of injected bugs in a scratch copy. 23 then 12 failures; every jr- perms check failed on its bug. Bugs injected: channel check removed, contact written into the event, sent messages not emptied, purged event given the child as subject, the job keeping its own delete, a club-side reason reader, 24 hours restored, the published-address exclusion removed, placeholder label, old undo page, old doc 27 close, a digit in §39, a message sent on "No", PUBLIC execute granted, a timeline leaking purged rows, send() writing a consent row, "Not now" on /a/closed, and the /dev/undo production guard removed.
  - Render: a harness with the old pages restored on the live app. 8 of 11 checks failed. jr-undo-r1/r3 and jr-s39-r2 pass on old code by design, because they pin behaviour that already existed or an absence. The live press landing on Done failed on old code ("" both times).

Found:
1. **Message bodies outlived both purges (fixed here; my choice under §3.8).** The 14-day purge emptied only texts still waiting. Sent approval messages kept the child's first name and age, the subject, and the parent's address in `message_outbox` forever. That made "the details we held are deleted" false in the database, contradicted doc 23 ("We do not retain message bodies"), and failed John's condition 3. The one deletion now empties every message of the invitation. **This also changes the 14-day job.** The alternative is to scrub only on "No", but then the two endings would differ and one deletion would be two. Reverting is one `update` in 0167. **Leo/John to confirm.**
2. Kept on purpose, flag only: a queued text's `number_hash` stays on its closed outbox row, and `sms_meter` keeps number hashes (D-81's per-number limit). Both are hashes of the parent's number that outlive the purge. John's "not a hash" was about the event. **John to rule** whether these need a retention line.
3. **The register (doc 06) has no U-2 entry.** U-2's wording lives in John's doc 31 (`docs/legal/31`, legal, flows root→app) and `13-Board-Room/JOHN-to-LEO-doc06-entries.md`. There was no register text to move. Doc 31 says no U-ruling binds until it has a D-number. **Leo/BUZ**: U-2 still needs a D-number, now with the amended window.
4. **User-facing legal text still says 24 hours.** Privacy Policy (adult) doc 20 lines 15 and 161 ("for 24 hours, can switch that link off"), and Terms doc 22 lines 29 and 163. Both are John's documents; not edited.
5. **The renewal gap.** Renewing a link extends `share_token.expires_at`, but the undo keeps its minted expiry, so a renewed link can outlive its undo. This is the approved expression; same for §37.
6. **Undo switch-offs leave no trace on the family's consent log.** The /undo revoke writes no `share_revoked` event; the controls page's switch-off does (pre-existing, `lib/link-switch.ts`). The parent's timeline does not show an undo.
7. **HC3 has a fourth place.** The §7 email (doc 15 §7, `lib/messages.ts` `reportReceivedEmail`) still says "contact your local police first". It is doc 15 copy (John/BUZ); not edited.
8. **PD-3 state 3b and F15.** As drawn and approved, a person holding the unconfirmed link can end a request once the other channel is confirmed, without pressing "Yes, it's me" on their own link. That includes a wrong-number stranger, which John's ruling treats as an acceptable harm ceiling. HoPD F15 is the related open question for John/BUZ.
9. **The /undo page is not restyled to spec G.** The ask's hand-built button and inline styles stay, with no glyph tiles on the ask or Done; the not-live panel has the dashed tile. That restyle is the G base pass, not G-P1.
10. **/a/closed and /undo/done can be opened directly** and show their words with no context. Neither carries or reveals anything about any request or link.
11. **Doc 27's version line is still v1.0 (27 Aug).** Calls are logged as `27@v1.0`, though the script now has a new step 5 and a conditional close. **Leo** to decide on a bump; that also means changing the action's policy_version.
12. **Doc 23 v1.7 (John's pending-invitation row) is not placed.** John places it once PD-3 is green; it is green on this branch. Per his note, the sync check runs first.
13. **Process note.** The session scratchpad is shared with sibling builders (their db.log/render.log/write2.log sit beside mine). My early logs used generic names there; one of my runs overwrote an old `write2.log` from 10:58. Everything later went to `scratchpad/jr-rulings/`.
14. **Label collision.** An existing check is labelled `jr-x1` (junior notice). It is unrelated to this `jr-` series.

Copy for BUZ (every new or changed user-visible string, verbatim):
- /undo not-live: "This link isn’t live" · "It may have been used already, or it may have lapsed. Sign in, and you can switch off any club’s link from your child’s controls." · "Go to sign in". All approved: /confirm's words plus N-G1.
- /undo/done: "Done" · "The club will not be able to open the page any more. Nothing is deleted, and you can make a new link whenever you want to." · "This does not un-send the email. It has already arrived and nobody can recall it — not us, not you. What this stops is what it opens." All approved words in a new place.
- /a: "No, end this request" (BUZ, 1 Oct) · 3q: "One more step. Your text follows shortly — open the link in it to finish." (BUZ, 1 Oct).
- /a/closed: "This request has closed." · "Nothing was approved, and the details we held are deleted." (approved). **New, needs approval:** tab title "This request has closed · Pitch Football".
- /join/waiting approved: "Your parent said yes." · "They build your page from their account, so ask them to start it with you." (BUZ confirmed; rendered as heading plus line).
- /report form, last sentence: "If you believe a child is in immediate danger, call 000." (replaces "In an emergency, call 000.").
- /report?done=1: "If you believe a child is in immediate danger, call 000. Pitch is not an emergency service." (replaces "If it concerns a child’s immediate safety, contact your local police first; we are not an emergency service.").
- Call sheet:
  - "Before we finish — who’s your Technical Director? Ask them to sign up on Pitch with their own email address, not the club’s shared one. That’s the account that reads the register." (BUZ confirmed, shown in quotes);
  - "Logging this call as verified emails {first name} to confirm it." · "Logging this call sends no email, so don’t promise one." (BUZ, 1 Oct).
- Doc 27, operator-facing:
  - new step "5 · The Technical Director. The call sheet prompts it (BUZ, 1 Oct):" plus the line above;
  - "6 · Close. Read the line above "Log the call" before you say it. Promise the email only when the sheet says logging this call as verified emails someone to confirm it. At a small club the administrator's own account is often the club's published address, and that address never receives it (John, 1 Oct), so the email line would be false." · "When the sheet says logging the call emails someone to confirm it:" · "When the sheet says logging the call sends no email, the sentence ends at "today":" · and the second close: "That's everything. I'll switch it on today. If anything changes — you leave the club, someone else takes the role — email me and I'll turn it off the same day." **The doc 27 framing sentences are mine and need approval.**
- Removed: "In an emergency, call 000." (form); "If it concerns a child’s immediate safety, contact your local police first; we are not an emergency service." (received page).

Risks:
- The outbox scrub (Found 1) changes the 14-day job's footprint. A provider receipt arriving after a purge still finds its row by provider id, but support can no longer see that address in the console. That is intended.
- Undo timing was resolved to 0.55–0.74ms on a local PGlite, where the live press's two extra row writes cost little. In production each write is a Sydney round trip. The press is one statement either way, so the extra cost is in-database rather than an extra round trip, but it is not zero. If it ever measures, the fix is an answer floor like SEND_ANSWER_FLOOR_MS.
- "Admin who is also a parent" (jr-s39-parent) is asserted at the database level: the recipient function, plus the outbox row the action writes, plus a static check that `send()` writes nothing else. The write suite cannot seat an admin-parent without a seed change.
- The PD-3 child-parity checks cover the waiting page (byte-identical to never-existed, write suite) and a 16–17's own log (perms). No other child surface reads a pending invitation that I found, but I did not audit the 16–17 home's "waiting on your parent" copy (HoPD F5).
- Not checked by hand on a real phone or in an in-app webview. The `form=` attribute is standard HTML and posts without JavaScript (write suite, no JS).

Lesson: a test comparing whole HTML responses in development will flake: Next dev numbers its flight-payload chunks in resolution order, so the same page served twice differs ("95:I[" vs "7d:I["). Compare the markup outside `<script>` for byte-identity checks, as jr-undo-r1/t1b and jr-pd3-w5 now do.
