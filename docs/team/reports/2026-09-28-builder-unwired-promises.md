# builder: two unwired promises, the suspension notice and who-looked (2026-09-28)

Asked: record the class of a club suspension, call `fn_guardians_to_notify_on_suspension`, and send doc 15 §37 through the existing path. Also put `fn_who_looked` on the guardian's surface with its answer taken from the function. Write no user-visible copy, and don't decide which classes warn families.

Tree: worktree `builder-unwired-promises`, branch `builder-unwired-promises`, HEAD 5704bc9. `app` is merged in, not rebased: 75015b2 first, then 0ea623c (e066191). Ports: db 54370, app 3703, CDP 9377. Nothing is pushed or deployed. `df -h /` read 12 GiB free at the start of the first session and 20 GiB free at the end. `.next` and `.next-check` are deleted, and every process was stopped by its port.

## Did

**Is the class-to-families mapping written down?** Yes. Doc 31 M11/L29 says: "Ordinary de-verification — lapsed paperwork, non-payment, an admin change — triggers nothing … **Only the child-safety class triggers the notice.**" Doc 15 §37 says: "Sent **only** where a club's verification is withdrawn for a **child-safety** reason." Doc 32 adds that the doc 31 rulings have no D-number yet, so this is not yet binding. That is a decision for BUZ (see Found 1). As Leo asked, the choice lives in **one place** and stands at the narrowest reading those two documents allow.

- `supabase/migrations/0066_the_class_of_suspension_is_recorded.sql` (it was 0063 and then 0065; both numbers were taken on `app`)
  - Adds `verification_call.suspension_reason`, using the same closed list as 0025. A check refuses a class on any call that did not suspend. The class sits on the immutable call row, because `club.suspension_reason` is overwritten the next time the club is verified, and doc 27's log is the record a regulator would be shown.
  - **`fn_suspension_tells_families(class)` is the one place the choice lives.** Today it returns true for `child_safety` only, and false for `administrative`, `non_payment` and null. Changing that is one migration with a D-number in its header.
  - Recreates `fn_guardians_to_notify_on_suspension` so it returns nobody unless the club is `suspended` and `fn_suspension_tells_families` says its class tells families. It also returns `club_name`.
  - **Measured:** 0025's function body as written returned the guardians for any club at all: a verified club, a suspension with no class, an administrative one, a non-payment one. That is susp4–7 and susp12, all red against it. The earlier recommendation of "a send loop in the same action" would have emailed families on every suspension.
- `app/ops/call/[clubId]/actions.ts`
  - Records the operator's class on the call row and on the club. A value missing from the list records null.
  - Verifying the club clears `club.suspension_reason`.
  - After `client.release()` (L1), it asks the function who must be told. For each guardian it mints an `undo_token` and sends `clubDeverifiedEmail` through `lib/messaging.send`.
  - Nothing in the action branches on the class, and it revokes nothing.
  - The suspension still happens if no class is chosen.
- `app/ops/call/[clubId]/page.tsx` adds one select, `suspension_reason`. It shows the raw values (`child_safety`, `administrative`, `non_payment`), the same way the Outcome select above it shows its own. It reuses the existing option text "Choose one". No new prose.
- `components/WhoLooked.tsx` (new)
  - Calls `select * from fn_who_looked($1,$2)` and renders what comes back. It never reads the grant or access tables, and never decides who may ask.
  - **Its words are held.** They sit in `WHO_LOOKED_COPY` with `WHO_LOOKED_APPROVED = false`, and the card returns null in production. That is the same rule `lib/messaging` applies to draft messages. The suites find the card by its `data-who-looked` marker, never by its words.
  - It is mounted on the guardian's controls page only. Who sees what is unchanged. Whether a 16+ player should see this card about themselves is a doc 34 rule 6 / doc 31 question, and it is not built.
- `app/g/controls/[childId]/page.tsx` (the webhooks builder owns this file): **4 lines added and 0 changed.** Line 17 is the import. Lines 256–258 are a one-line comment, `<WhoLooked … />` and a blank line, placed after `<RegisterReaders>`. I did not touch the label lines 94, 95, 97, 98 or 119, and `email_opened` stays.
- `scripts/dev-db.mts` adds one fictional look at Nate's record (investigator "Priya Raman", invented), so the card's answered state can be rendered. Deniz has none, which covers the empty state. This fixture is skipped in a club demo; see Found 2.
- **The exemption is gone.** `clubDeverifiedEmail` came out of `NOT_YET` in `permission-tests.mjs`. It was at :3344 in the brief and :3883 after the merge. The merge conflict there was app taking out the two Stripe exemptions at the same time. `msg-all-b` now fails if anyone puts it back (proven).
- **U-6d2 guard:** the existing check now guards `looked[0]?.investigator`. Unguarded, a broken `fn_who_looked` crashed the whole suite at that line, so no U-6 check after it ran.

## New checks and the proof that each can fail (L20)

**perms** has 31 new checks:
- susp0, susp0b, susp1, susp1b, susp2–susp18
- U-6f–U-6n
- copy-held1

Labels: none start with M11. Doc 14's M11 says "revocation of `verified` is equivalent to revocation of every link", and John recorded that clause as unbuildable, so a check labelled M11 would claim the opposite of what it tests. The U-6 labels test John's U-6, which `gate-coverage` maps to doc 14 L60. I read the row before citing it.

**render** has 5 new checks, r5a–r5e. **write** has 13, susp-w0–w11 plus w6b.

Each check was proven red with the bug put back:

| Bug put back | Checks that went red |
|---|---|
| 0066's class and state gate removed | susp4, 5, 6, 7, 12 |
| 0066 removed entirely | susp1, 1b, 4–7, 9, 12. susp2 and 3 passed with no column at all, which is why susp1b now exists as a positive control. |
| `destination` and `revoked_at` predicates removed | susp8, 10, 11 |
| Mapping widened to `administrative`, or the class compared inline | susp0, susp0b |
| app's action | susp13, 14, 15, 17, msg-all |
| Branch on the class plus a revoke injected into the action | susp16, 18 |
| Exemption restored | msg-all-b |
| `fn_who_looked` guard weakened or removed | U-6d, d2, e, f, g, h, i, j |
| Mount removed, the component querying the tables, flag flipped | U-6k–n, copy-held1 |
| Mount removed | render r5a–d |
| The component showing another child's rows | render r5d, r5e |
| app's call sheet and action | write susp-w0, w5–w8, w10 |
| Mapping widened, a revoke of all the family's links, "complaint" added to §37 | write susp-w3, w4, w6b, w9, w11 |
| Club not actually suspended | write susp-w2 |

susp-w1 is a fixture precondition: it runs the existing send flow, which x0 already covers.

## Ran (fresh seed, TRAINING §4 order; `test:render` reseeded before write)

- perms **1419/1419** (app 1388, plus 31)
- render **525/525** (app 520, plus 5)
- write **369/369** (app 356, plus 13)
- layout 375/1280: **ALL GREEN, 196 views**, with its own CDP port
- gate-coverage 262/262, 0 open
- palette ALL GREEN
- corpus 0 failures, 0 warnings
- secret-scan clean
- `tsc --noEmit` exit 0
- `build:check` exit 0

The last seed edit (skip the fixture in a demo) came after these runs. It changes only demo mode. I re-seeded once afterwards and the seed runs.

## Found

1. **For BUZ: which suspension classes tell families.** This is built as `fn_suspension_tells_families` in 0066, currently `child_safety` only. It needs a D-number. Options:
   - (a) keep `child_safety` only, as built, doc 31 and §37;
   - (b) tell nobody until doc 31 is numbered: one line, `select false`. This is the reading doc 32 suggests for unnumbered rulings ("hold those sentences back"), but it leaves families holding live links to a club suspended for child safety uninformed;
   - (c) widen it, for example to `takedown`. Doc 27's takedown and suspended outcomes are hostility or an unrecognised claim, not child safety, so I did not tie the class to the outcome.

   I read "most restrictive" as (a): the narrowest set the written spec permits. If Leo meant (b), it is that one line.
2. **The D-26 one-tap deletion rolls back for any child who has ever been looked at.** `app/g/controls/[childId]/actions.ts:197` deletes `investigation_grant`. `investigation_access` references it with no cascade and is append-only, so the whole deletion fails. Measured with PGlite: "violates foreign key constraint investigation_access_grant_id_fkey". This is outside my lane (that file is the webhooks builder's), and doc 23 retention against D-26 is a legal decision. Note that the dev seed now carries one look, on Nate; the suite's x3 deletes Deniz, so it does not hit this.
3. **Families who sent to a club's other address are never told.** `fn_guardians_to_notify_on_suspension` matches the send's destination against the club's `contact_email` only. The seed shows the gap: Deniz's send went to `recruitment@kingswayrovers.example.au`, and Kingsway's contact address is `football@…`. If Kingsway were suspended for child safety, that family would hear nothing. Widening the match (the club's domain, or its trial notices' `cv_email`) is a safety decision, so I did not make it.
4. **Nothing in the product grants an investigator access.** `investigation_grant` and `investigation_access` have no writer outside the tests and the seed. U-6's conditions 1–3 have no product path, so the card is truthfully empty for every real family until one exists.
5. **§37 says "you sent it" to a parent whose 16–17-year-old sent the link.** The function tells the guardians of 16–17s too. This is a copy question for BUZ (L25).
6. **Stale copy on `/g/send/[requestId]` line 95.** It still says "If they reply, it comes to you and {name} together.", which contradicts U-11 (there is no inbound route).
7. **The §19 email renders "currently at ." when the child has no club.** Seen in the outbox for Georgia during the write run. `cvToClubEmail` does not drop that clause when the club is empty.
8. **The existing `M11`, `M11b`–`d` labels break L4.** They test the reason class, not doc 14 M11 as worded, and `gate-coverage` counts M11 as pinned by them. I did not change them.
9. **Two sources of truth for "a send happened".** The seed's sends for Deniz exist only as `consent_event` rows. `fn_send_log` reads those, but the notify function reads `share_request`. Production writes both, so this is an L13 fixture gap, not a product one.
10. **Seats collided on ports and migration numbers.**
    - Another seat's suite hit my app on 3070.
    - `layout-check`'s default CDP port 9333 is shared, and two seats running it talk to the same Chrome (my first three layout runs wedged). The TRAINING §4 command should set `LAYOUT_CDP_PORT`.
    - Migration 0061 was claimed in three worktrees at once, and this one was renumbered twice.
11. **The undo expiry is my own choice, for Leo to confirm.** The §37 undo lives as long as the link it switches off (90 days if the link has none). The ruling gives no window, and §36's 24 hours is U-2's. The token can only revoke that one link.
12. **The merge commit carries more than the merge.** 159bf1c also contains the rework that took my proposed copy out of the call sheet and the card.

## Copy for BUZ (none of it ships; all proposals)

**Ops call sheet.** What ships is the raw label `suspension_reason` and the raw values `child_safety`, `administrative`, `non_payment`. Proposed wording:
- Label: "Why — recorded only when the outcome is suspended or takedown. It decides whether families are told."
- Options:
  - "A child-safety reason — families are told"
  - "Administrative — paperwork, officials, a claim nobody recognised"
  - "Non-payment"
- Note: "Choose the child-safety reason only for a child-safety reason. Every family holding a live link they sent to this club is emailed once: that the club is no longer verified, nothing about why, and a button that switches their own link off. We do not switch it off for them. The other two reasons end this club’s access and tell nobody."

**Who-looked card.** These render in development only, while `WHO_LOOKED_APPROVED = false`:
- Heading: "Who at Pitch has looked at {Name}’s record"
- Empty state: "Nobody at Pitch has opened {Name}’s record."
- Fallback name: "Someone at Pitch"
- Row: "Looking into a report · {what}"
- Row date: "{date} · report {report id}". This shows a full uuid to a parent. Is that the reference you want shown?
- Footer: "Somebody at Pitch can open a child’s record only while a report about it is open, and only for as long as that report is open. Every time one of us does, it is written down here and it cannot be edited or removed. Ask us why at help@pitchfootball.com.au and we will tell you."
  - The footer depends on Found 2 and 4: "cannot be removed" is also the reason deletion fails.

**Doc 15 §37** is used verbatim, as approved, and I changed nothing in it.

## Risks

- The operator sees raw values until BUZ approves the label, so the consequence of choosing `child_safety` is not explained on screen.
- The mapping is not binding until it has a D-number.
- Found 3 means some affected families are not told.
- The layout check passed only on a private CDP port.
- I did not check production delivery through Resend.
- I did not check what a 16+ player sees about themselves.

## Lesson

A function built in advance for a ruling is not the ruling. 0025's `fn_guardians_to_notify_on_suspension` had the right recipients and no condition on when to send. The half-built chain was not safe to connect as written, and only a test that put the ordinary suspensions through it showed that.
