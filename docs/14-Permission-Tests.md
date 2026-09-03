# 14 · Permission Test Specification

> **What this file is:** the enumerated test suite for the permission matrix and the age state machine. Doc 10 states the rules; this file states the cases. Every row below is one test with one expected answer.
>
> **Why it exists:** the permission matrix is the only launch blocker (D-47) and "green or we do not go" is meaningless without a list of what green means. Written by Leo, 25 Aug 2026, from register v3.0.
>
> **Two rules that govern every test here.** They run **against the database**, not the app layer — a test that passes through the application proves nothing about a query written later. And the expected result of a denial is **"as if it does not exist"**, never "forbidden": a 403 that differs from a 404 is an existence oracle, and an existence oracle on a child is a leak.

---

## 0 · Definitions the tests use

**Actors.** Every test names one:

| Actor | Meaning |
|---|---|
| `anon` | No session. No token. A stranger with a URL. |
| `token` | No session, holding a share token. |
| `self` | The player, signed in as themselves. |
| `guardian` | A guardian on an active GuardianshipLink to this player. |
| `guardian2` | The second guardian on the same link. |
| `ex_guardian` | A guardian whose link has been revoked or has expired at 18. |
| `coach_own_v` | Verified coach, assigned to a squad this player is currently in. |
| `coach_own_u` | Coach at the same club, **not** verified (no WWCC / no club affiliation). |
| `coach_own_unassigned` | Verified coach at the club, not assigned to this player's squad. |
| `coach_former` | Verified coach who was assigned to this player's squad in a past season. |
| `coach_other` | Verified coach at a different club. |
| `td_own` | **Technical Director** of the club this player currently belongs to. Club-wide development access (D-93). |
| `club_admin_own` | **Administrator** of the club this player belongs to — registrar, secretary, treasurer. Club page, squads, memberships, notices. **No development-record access** (D-93). |
| `club_admin_other` | Admin of a different verified club. |
| `club_unverified` | Admin of a club that has not passed manual verification. |
| `team_manager` | Parent running a squad's logistics (D-02). Squad membership and fixtures; **never the development record**. |
| `reporter` | Anyone using the report affordance. **No account, no reason required.** |
| `agent` | **Does not exist and must never exist.** There is no agent role, no agent tier, no agent access — asserted, not assumed (J23). |
| `support` | Pitch support console operator. |
| `sys` | Scheduled job / server process. |

**State variables.** Each carries the values a test may set:

- `age_band` — `u16` · `16_17` · `18plus` (derived from DOB at read time; **never stored** — a test asserts this)
- `approval` — `pending` · `approved` · `revoked`
- `link_state` — `live` · `expired` · `disabled` · `regenerated_away` · `never_existed`
- `profile_state` — `active` · `paused_by_guardian`
- `guardian_count` — `1` · `2`
- `verification` — `none` · `wwcc_only` · `club_only` · `full`

---

## A · Reading a player's record

The core table. **Read as: this actor, on a player in this age band, gets this.**

| # | Actor | u16 | 16–17 | 18+ |
|---|---|---|---|---|
| A1 | `anon` (no token) | **Nothing.** Not-found. | **Nothing.** Not-found. | Public CV |
| A2 | `token` (live) | Public CV | Public CV | Public CV |
| A3 | `token` (expired / disabled / regenerated / never existed) | **Link-state page. Identical body and identical timing in all four cases** (D-77) | Same | Same |
| A4 | `self` | Own full record | Own full record | Own full record |
| A5 | `guardian` | Full record + consent log | Full record + consent log | **Nothing** unless the adult re-granted (D-49) |
| A6 | `ex_guardian` | **Nothing** | **Nothing** | **Nothing** |
| A7 | `coach_own_v` | Full record | Full record | Full record |
| A8 | `coach_own_u` | **Nothing.** Verification is a gate, not a badge (D-22, D-28) | **Nothing** | Public CV only |
| A9 | `coach_own_unassigned` | **Nothing** | **Nothing** | Public CV only |
| A10 | `coach_former` | **Only the entries they authored** (D-48) | Same | Same |
| A11 | `coach_other` | **Nothing** | Public CV via search | Public CV |
| A12 | `td_own` | Full record | Full record | Full record |
| A12b | `club_admin_own` | **Membership and contact only — never the development record** (D-93) | Same | Same |
| A13 | `club_admin_other` | **Nothing** | Public CV via search | Public CV |
| A14 | `club_unverified` | **Nothing**, even for its own players — verification gates the data flow | **Nothing** | Public CV |
| A15 | `support` | **Invitation state only. Never the record** (D-79) | Same | Same |

**A15b.** `team_manager` on a player in their own squad: **squad membership, fixtures and contact routing only — never the development record.** Same wall as `club_admin_own`.

**A16.** `profile_state = paused_by_guardian` → every row in this table that returns a CV returns the **link-state page** instead, including for `coach_own_v`. Pausing pauses everything outward-facing; the club keeps its internal record view.

**A12c.** A person may hold both roles at once (a TD who also coaches). Permissions are the **union** of their roles, computed at read time — never a stored composite.

**A17.** `approval = pending` → the player record **does not exist yet** for every actor. A pending invitation holds first name, DOB and guardian contact only (D-17). Assert that no query in the system can return a CV for a pending record.

**A18.** `approval = revoked` → same as `pending` for all readers, and the D-26 cascade has run.

---

## B · Appearing in search

| # | Case | Expected |
|---|---|---|
| B1 | u16, any searcher, any query | **No result. There is no search surface for U16s at all** (D-53) — assert at the query layer, not the UI |
| B2 | u16, searcher is `club_admin_own` | **Still no result.** Own-club access comes through Membership, never through search |
| B3 | 16–17, searcher `coach_other` verified | Result returned |
| B4 | 16–17, searcher `club_unverified` | **No result** |
| B5 | 16–17, searcher `anon` | **No result** |
| B6 | 16–17, guardian has set the discoverability off-switch | **No result** (D-22) |
| B7 | 18+, `anon` | Result returned |
| B8 | Any band, searcher holds premium | **Identical ordering to a non-premium searcher.** Premium never re-ranks verified data (D-82) |
| B9 | Any band, player's club is Founding XI | **Identical ordering.** Recognition, never advantage (D-83) |
| B10 | Search index rebuild after a player turns 16 | Appears only after the transition job runs and only if the guardian has not disabled it |
| B11 | Search index after a player turns 16 **while the guardian has never opened the setting** | **Default is off-switch available but discovery ON** per D-22 — assert the guardian was notified 30 days prior (D-49). If the notification failed to send, discovery stays **off**. |

> **B11 is a deliberate design choice, not an implementation detail.** Discovery that switches on for a 16-year-old whose parent was never successfully told is discovery without consent. The notification's delivery receipt (D-78) gates the transition.

---

## C · Contact

| # | Case | Expected |
|---|---|---|
| C1 | Any actor → DM a u16 | **No such route exists.** Assert there is no message endpoint that accepts a minor as recipient (D-21) |
| C2 | Any actor → DM a 16–17 | **No such route exists** |
| C3 | `coach_other` → contact a u16 | Routed to **guardian and child together**, logged (D-19) |
| C4 | `coach_own_v` → contact a u16 | Routed through the club, logged |
| C5 | `anon` with a live token → contact | **No contact route on a public CV.** Only the D-77 request-access affordance exists, and only on the link-state page |
| C6 | `anon` → request access via link-state page | Notification to guardian, containing the requester's typed name and role. **One per token per 24h** |
| C7 | Same requester, second request inside 24h | **Silently accepted, not sent.** The response must not differ from C6 — a rate-limit message is an oracle |
| C8 | Guardian ignores a request | **Nothing happens. No follow-up, no reminder, no second nudge.** Silence is a valid answer (D-77) |
| C9 | 18+ | Direct contact permitted |

---

## D · Writing to the record

| # | Case | Expected |
|---|---|---|
| D1 | `coach_own_v` writes an assessment entry | Permitted. Entry carries `author_person_id`, `club_id`, `framework_version`, `observed_at` (D-71) |
| D2 | `coach_own_u` writes | **Denied** |
| D3 | `coach_own_unassigned` writes | **Denied** |
| D4 | `coach_former` writes | **Denied.** Read-access to their own past entries persists; write does not (D-48) |
| D5 | `coach_other` writes | **Denied** |
| D6 | `guardian` writes an assessment | **Denied.** Guardians write growth notes (D-84) and nothing else |
| D7 | `self` writes their own stats | Permitted, `provenance = self_reported` (D-62) |
| D8 | `self` writes `provenance = coach_verified` | **Denied.** Provenance is set by the server from the actor, never accepted from the client |
| D9 | Edit an entry inside 48h, by its author | Permitted (D-50) |
| D10 | Edit the same entry after 48h | **Denied.** A correction is a new entry with `supersedes_entry_id` set |
| D11 | Edit an entry by anyone other than its author, at any time | **Denied** |
| D12 | Write an entry referencing a competency by name/slug | **Rejected at the schema level.** Entries reference `(competency_id, framework_version)` only (D-71) |
| D13 | Two entries for the same `(record_id, competency_id, block_id)` | **Permitted.** Assert no unique constraint exists — that absence is the moderation hook (D-71) |

---

## E · Share links

| # | Case | Expected |
|---|---|---|
| E1 | u16, `self` attempts to generate a link | **The child may request; the guardian dispatches** (D-91). Assert the token is created only on the guardian's action |
| E2 | u16, `guardian` generates | Token created, default 90-day expiry (D-53) |
| E3 | 16–17, `self` generates | Permitted, guardian visible in the consent log |
| E4 | Guardian regenerates | Old token → link-state page immediately. **Assert the old token does not 404 and does not error differently** |
| E5 | Guardian disables the profile | Every live token → link-state page |
| E6 | Token 89 days old | Live. Renewal reminder queued |
| E7 | Token 91 days old | Link-state page. **No grace period** |
| E8 | Token for a player who has since been deleted | Link-state page, **identical to every other dead state** |
| E9 | Random 32-byte string that was never a token | Link-state page, **identical body, identical timing** |
| E10 | Timing comparison across E4–E9 | Response times must not be distinguishable. **This is a test, not a hope** — assert within a tolerance band |
| E11 | Link-state page body | Contains **no name, no club, no photo, no age, no initials, no squad number** |
| E12 | OG/social card for a u16 token | First name + surname initial, positions, number, stats only. **No surname, no club, no age group, no region** (D-89) |
| E13 | OG card for 18+ | Full detail |
| E14 | OG card requested for a dead token | Generic Pitch card. Never a cached identity |

---

## F · Guardians

| # | Case | Expected |
|---|---|---|
| F1 | `guardian_count = 2`, one approves | Profile goes live. Either may approve (D-51) |
| F2 | Two guardians, one approves and one revokes | **Most restrictive wins.** Revoked |
| F3 | Two guardians, one sets a 30-day link expiry and the other 90 | **30 days** |
| F4 | Two guardians, one disables discovery at 16 | **Disabled** |
| F5 | Any guardian action | Both guardians notified (D-51) |
| F6 | Third guardian added | **Rejected.** Maximum two |
| F7 | Guardian revokes | Full D-26 cascade. Authoring coaches retain **anonymised counts only** (D-48) |
| F8 | Guardian views the consent log | Sees every approval, revocation, share, outside-contact attempt and age transition |
| F9 | Guardian of child A attempts to read child B | **Nothing.** A parent sees their own child only |

---

## G · Age transitions (D-49)

| # | Case | Expected |
|---|---|---|
| G1 | `age_band` is computed at read time | Assert **no stored band column exists anywhere**. A test that inserts a stale value must be impossible |
| G2 | Player turns 16 at 00:00 | Guardian was notified 30 days prior; discovery becomes available subject to B11; countdown UI shown to the player |
| G3 | Player turns 18 | Guardian visibility **auto-expires**. `ex_guardian` immediately fails every read in section A |
| G4 | Player turns 18, then re-grants guardian access | Permitted, as a new link initiated by the adult |
| G5 | Player turns 18 holding 9 highlight clips added as a minor | **All 9 survive, permanently** (D-88). The adult free cap of 3 applies only to clips added from 18 onward |
| G6 | Player turns 18 with a live share token | Token remains live. It is now the adult's to revoke |
| G7 | Transition job fails to run | **Fail closed.** The read-time derivation is authoritative; a missed job must never grant access the band would not |
| G8 | Leap-year birthday, 29 Feb | Transition fires on 28 Feb in non-leap years. One test, because it will otherwise be found in production |
| G9 | Timezone | All transitions evaluate in **Australia/Melbourne**, not UTC. A Sydney player must not become 16 an hour early or a day late |

---

## H · Clubs, squads and coach lifecycle

| # | Case | Expected |
|---|---|---|
| H1 | Player joins a club | Consented at joining; the club sees history the signing brings (D-48) |
| H2 | Player leaves a club | Club drops to **aggregates**. Assert the full record is no longer readable by `td_own` or any `coach_own_v` from that moment. (`club_admin_own` never had it — A12b.) |
| H3 | Coach leaves the club | Loses read on current players; **keeps read on entries they authored** |
| H4 | Coach is unassigned from a squad mid-season | Loses read on that squad's players immediately |
| H5 | Club loses verified status | **All minor data access is revoked immediately**, including for currently-assigned coaches and the TD |
| H9 | TD leaves the club | **Club-wide access revoked immediately.** Keeps read only on entries they personally authored (D-48). TDs move clubs often — this is a common path, not an edge case |
| H10 | A person self-declares `technical_director` | **Rejected.** TD is granted by the club and confirmed at club verification, never self-asserted (D-93) |
| H11 | `club_admin_own` attempts any development-record read, by any path | **Denied.** Assert at the query layer — an administrator is a billing and registration role |
| H6 | Squad invite to a u16 | Routes to the guardian for approval |
| H7 | `experience_entry` exists on a player | **Grants nothing to anyone, ever.** Assert it cannot appear in the "inside the club" computation (D-72) — this test is not optional |
| H8 | `experience_entry` with `org_name` matching a real club's name exactly | **Still grants nothing.** Free text never resolves to a club |

---

## I · Deletion

| # | Case | Expected |
|---|---|---|
| I1 | One-tap delete by guardian or child | Cascade completes; nothing readable by any actor in section A |
| I2 | Pending invitation, 14 days, unapproved | **Auto-purged** (D-17). Assert the purge job ran and the row is gone, not flagged |
| I3 | After deletion, authoring coaches | Anonymised counts only |
| I4 | After deletion, a previously live share token | Link-state page, identical to every other dead state |
| I5 | After deletion, consent log | **Retained** — it is the record that the deletion happened, and it is append-only |
| I6 | Deletion of a guardian's account while a child is linked | Child's record survives; the link is severed; the second guardian (if any) is unaffected |

---

## L · Sending a CV to a club, and the coach's link

D-99 and D-100. **The rule the whole section tests: Pitch never transmits a minor's record to anybody. The family does.** Every row below asserts either who may press send, or that a path which would make Pitch the sender does not exist.

**Section L takes the next free letter but sits here physically, before J and K** — the negative suite and the gate stay last. No existing cross-reference moves.

### L(0) · Definitions this section adds to §0

**Actors:** `club_recipient` — a club contact address a family has sent a CV to; **no account, no session, no membership**, holds a token and nothing else. `coach_self` — a verified coach signed in, acting on their own coach CV. `minor_viewer` — any signed-in u16 or 16–17 account viewing a surface that is not their own record.

**State:** `send_state` — `composing` · `awaiting_guardian` · `sent` · `lapsed` · `blocked`. `send_switch` — `on` · `off` (the 16–17 guardian's off-switch, D-22).

**Band derivation applies unchanged.** The band governing a send is derived **at the moment of the send**, not when the request was composed (G1). A request composed at 15 and dispatched after the sixteenth birthday is governed by the band at dispatch — assert it.

### L(i) · Who may initiate a send

| # | Case | Expected |
|---|---|---|
| L1 | u16, `self` composes a send (Deniz, 14 → Northern United SC) | Request created, `send_state = awaiting_guardian`. **Nothing is transmitted.** Assert no outbound message exists and no token has been issued to the recipient (D-99, D-91) |
| L2 | u16, `guardian` reviews the recipient and presses send | Send occurs. One consent-log row: recipient address, timestamp, sending actor = guardian, initiating actor = child, token id, band at send |
| L3 | u16, `self` attempts to send directly — API call, replayed request, deep link, or a manipulated `send_state` | **Denied at the query layer.** Assert no send row can exist whose sending actor is under 16, by any path |
| L4 | u16, `guardian` edits the recipient address on the confirm step | Permitted. Assert the address **displayed at the moment of the press** and the address stored and transmitted are the same value, compared after the fact — not merely validated before |
| L5 | 16–17, `self` sends (Nate, 17 → Kingsway Rovers FC) | Permitted. Guardian notified on **every** send. Assert one notification per send — no digest, no batching, no daily roll-up |
| L6 | 16–17, `send_switch = off` | **Denied.** The player is told plainly that sending is off — their own account, not an oracle about a third party (D-22) |
| L7 | 16–17, `send_switch = off` set by guardian 2 only | **Off.** Most restrictive wins (F2) |
| L8 | 18+, `self` sends | Permitted. No guardian, no notification, no approval |
| L9 | 18+ who has re-granted guardian access (G4) | Still permitted without approval. Re-granted visibility is visibility, not control |
| L10 | `approval = pending` or `revoked` | **No send surface exists**, and no send row can be created (A17, A18) |
| L11 | `profile_state = paused_by_guardian` | **No send surface, no send row.** A send that resolves to the link-state page is a send that misleads the club (A16) |
| L12 | `coach_own_v`, `td_own`, `club_admin_own` or `team_manager` attempts to send a player's CV | **Denied.** Only the family sends. Assert no club-side actor can create a send row for a player, in any band |
| L13 | `support` attempts to send | **Denied.** Support sees invitation state and never the record (A15) |
| L14 | `sys` (scheduled job, server process) attempts to send | **Denied.** See J33 — the row the whole decision exists to prevent |

### L(ii) · Guardian routing, and the guardian who never acts

| # | Case | Expected |
|---|---|---|
| L15 | Child composes a send; guardian never opens it | **Nothing happens. No send, no reminder, no nudge, no escalation.** Silence is a valid answer (C8, D-77) |
| L16 | Pending request reaches its lapse window | `send_state = lapsed`. Nothing transmitted; the request is gone, not queued. **Window length unruled — U-1** |
| L17 | `guardian_count = 2`, guardian 1 sends | Guardian 2 notified (F5, D-51). **Whether one guardian may send alone is unruled — U-2** |
| L18 | Guardian 2 revokes, pauses or switches sending off while a request is pending | Cannot be dispatched. Most restrictive wins (F2) |
| L19 | `ex_guardian` opens a pending send request | **Nothing.** Not-found, identical to A6 |
| L20 | Guardian approves, and guardianship is revoked between approval and dispatch | **Fail closed.** No send. Assert standing is re-checked at dispatch, never carried from approval |
| L21 | Guardian of child A opens a send request belonging to child B | **Nothing** (F9) |

### L(iii) · What the recipient gets, and what they can do with it

| # | Case | Expected |
|---|---|---|
| L22 | What is transmitted | An email to the club's own contact address carrying a **tokenised URL** (D-53) and nothing else. Assert: no attachment, no PDF, no inline stats table, no photograph, no surname beside a club name |
| L23 | `club_recipient` opens a live link | Public CV, exactly as `token` in A2. Nothing more |
| L24 | What `club_recipient` gains by receiving a send | **Nothing beyond the token.** No account, no membership, no squad, no write path, no development record, no place in the "inside the club" computation (H7) |
| L25 | `club_recipient` forwards the email to a colleague | Colleague sees the same public CV. Assert forwarding grants nothing extra, the token stays revocable, and the consent log names **the original recipient only** — we log what the family did, not what the club did |
| L26 | `club_recipient` attempts to contact the player from the CV | **No contact route on a public CV** (C5). For a u16 there is no contact affordance at all |
| L27 | `club_recipient` replies to the send email, player is u16 | Routed to **guardian and child together, and logged** — the C3 path. Assert it is the same routed-contact code path, not a second one (D-19). **Behaviour after revocation unruled — U-11** |
| L28 | `club_recipient` invites the player to a squad off the back of a send | Routes to the guardian for approval (H6). **A send is not an application and confers no membership** |
| L29 | Recipient is `club_unverified` | Receives and can open the link. Verification gates data flow **inside** the product (A14); a tokenised link is the family's own act of disclosure |
| L30 | Club asks for a copy that will not expire | **No such artefact exists for a minor** (J34) |

### L(iv) · Revocation and expiry while a club holds the link

| # | Case | Expected |
|---|---|---|
| L31 | Guardian revokes after a send | The club's next open is the **link-state page**, identical to E4 in body and timing. **Revoking the link revokes the club's copy** — the whole reason the link travels and the record does not |
| L32 | Token reaches 91 days while a club holds it | Link-state page. **No grace period** (E7) |
| L33 | Club had the CV open in a tab at revocation | Next request fails closed. Assert no service worker, offline cache or client store holds a minor's CV beyond the current paint |
| L34 | OG card for a held link, after revocation | Generic Pitch card, re-checked every request (E14, J15) |
| L35 | Guardian regenerates and sends again to the same club | **Two consent-log rows, not an update.** Old token dead immediately (E4) |
| L36 | Record deleted (I1) after a send | Link-state page (I4). The send row is **retained** in the consent log (I5) |
| L37 | Player turns 18 holding a link sent at 16 | Token live, now the adult's to revoke (G6). Historic send row stays as written, band recorded at send time |

### L(v) · The rate limit, and why its response is a lie by design

| # | Case | Expected |
|---|---|---|
| L38 | Sender at the daily limit | Response **byte-identical to a successful send** — same status, body, headers. Nothing transmitted (C7, D-77's oracle rule) |
| L39 | Headers on a limited response | Assert **no** `Retry-After`, no `X-RateLimit-*`, no differing `Content-Length`, no differing cache directive |
| L40 | Timing across L38 and a real send | Indistinguishable within the E10 tolerance band. **A test, not a hope** |
| L41 | Where the limit is counted | **Per sending actor per day.** Assert never per recipient — a per-recipient counter lets one sender learn another sender wrote to that club |
| L42 | Sender's own UI at the limit | No counter, no "sends remaining", no error, no greyed button. Any surface revealing limit state contradicts L38 |
| L43 | The ceiling itself | **Unruled — U-3.** The test asserts the property; the number is one config value with one definition |

### L(vi) · The coach's link (D-100)

| # | Case | Expected |
|---|---|---|
| L44 | `coach_self` on their own coach CV | A **copy-link** affordance. Assert it writes to the clipboard and calls no send endpoint. No recipient field on the page, none in the API |
| L45 | `coach_self` asks Pitch to send their link to a named person | **No such route exists** (J35) |
| L46 | Coach link state model | **Stable and public. No token, no expiry, no link-state page.** A professional artefact for an email signature (D-75, D-100) |
| L47 | Coach link vs player link implementation | **Separate route, separate table, separate resolver.** Assert the coach CV route does not reach the token resolver and the token resolver does not serve a coach CV (J39) |
| L48 | Contact affordance on a public coach CV, viewer `anon` | Rendered, copy addresses **clubs and adults**. Routes to the coach's own professional contact path and touches no player record |
| L49 | Same page, viewer is `minor_viewer` — u16 | **No contact affordance at all.** Not hidden, not disabled — **absent from the response body.** Assert server-side by band, never by a client conditional or CSS |
| L50 | Same page, viewer is `minor_viewer` — 16–17 | **Also absent.** Sixteen and seventeen are minors; D-22's split governs discovery, not this |
| L51 | Same page, viewer is `anon` who is in fact a child | We cannot know and must not guess. Assert **no inference attempt** — no age heuristic, no signal collection. Safety comes from where it routes, not from who is looking |
| L52 | `coach_self` requests any player's or family's contact details, by any path | **Denied everywhere** — API, CSV, club export, squad list, support console (J37) |
| L53 | Coach pastes their link into a parents' group chat | Outside the product, correctly. Assert the coach-CV OG card carries **the coach only** — no player, no squad, no minor's name |
| L54 | Any surface offering to send a coach's link to a player or parent | **Must not exist** (J43). The row D-100 was written to make findable before someone builds it as a convenience |

### L(vii) · The consent log

| # | Case | Expected |
|---|---|---|
| L55 | Every send | Exactly one append-only row: recipient address, timestamp, sending actor, initiating actor, token id, band at send. Category `share`. **Conflicts with doc 23 as written — U-7** |
| L56 | A send that did not occur — rate-limited, blocked, lapsed, denied | **No send row.** The log records what happened, never what was attempted and stopped. **U-4** |
| L57 | `guardian` reads the consent log | Every send, recipient address in full (F8) |
| L58 | `self`, u16, reads their own consent log | **Unruled — U-5** |
| L59 | Edit or delete of a send row, by anyone including `support` and the deletion cascade | **Impossible.** No update path, no delete path, anywhere (I5) |
| L60 | `support` reads send rows | **Nothing.** Invitation state only (A15). **Complaints access unruled — U-6** |
| L61 | `coach_own_v`, `td_own`, `club_admin_own`, `team_manager` read send rows | **Nothing.** A child's own club has no business knowing which other clubs the family wrote to (J44) |

> **L11 and L56 are the two rows most likely to be argued away in a sprint, so here is why they hold.** L11 looks like over-reach — the profile is paused, the link is dead, so what harm is a send? The harm is that the club receives a Pitch email about a named child and opens a page telling them nothing, which is a worse first contact than none and is not what the guardian who pressed pause chose. L56 looks like lost telemetry. It is: the alternative is a log recording a stranger's address against a child's name in cases where the family never disclosed it, and that is a record we would then have to defend keeping.

---

## M · Club verification — the gate that is not payment

D-126, D-137, D-139. **The rule the whole section tests: no fact about a person under 18 reaches a club until a human has verified that club. Payment never verifies anything.**

### M(0) · Definitions this section adds to §0

**State:** `club_state` — `unclaimed` · `claimed` · `verified` · `suspended`. **`verified` is set only by a `sys_admin` action carrying a human's name and a timestamp.** There is no code path that sets it from a payment event, a claim event, or a webhook.

**Actor:** `club_unverified` — a signed-in club contact at a `claimed` club. Has a session, has paid or not, and holds **no** minor-facing permission.

| # | Case | Expected |
|---|---|---|
| M1 | `club_unverified` opens the register | Renders the **held** view: a count, and nothing else. Assert no name, age, club, position, note text or token appears in the response body — not merely that the UI hides them |
| M2 | `club_unverified` requests a registration row by id, directly | **Denied at the query layer.** Assert the row is unreachable by any query that does not join on `club_state = verified` |
| M3 | A club pays, `club_state` stays `claimed` | **Payment changes nothing minor-facing.** Assert `verified` is unchanged and the register still renders held |
| M4 | A webhook, job or migration attempts to set `verified` | **Denied.** Assert `verified` can be written only by a `sys_admin` mutation carrying an operator identity, and that the write is refused without one |
| M5 | A club is verified while three registrations are held | All three become readable **in the same transaction**. Assert no partial state where one is visible and two are not |
| M6 | A family withdraws while a registration is held | The row is removed and the count decrements. **Assert the club is never able to learn that a held registration existed** — no gap in a sequence, no changed timestamp, no audit entry it can read (D-126) |
| M7 | `club_unverified` posts a trial notice | **Permitted.** The notice is public and carries no minor's data |
| M8 | `club_unverified` adds a coach or an administrator | **Permitted.** Club-internal, no minor involved |
| M9 | A player's `register interest` targeting a `claimed` club | **Permitted and held.** Assert the family is told the registration is with the club, and is **never** told the club is unverified — that is our problem, not a fact about a child's prospects |
| M10 | `club_state` moves `verified` → `suspended` | Every minor-facing permission ends **immediately**, in the same transaction. Assert held-view semantics resume and no cached read survives |
| M11 | Verification is revoked while a club holds a live token | The token stops resolving. Assert revocation of `verified` is equivalent to revocation of every link that club holds |
| M12 | `sys_admin` sets `verified` | One audit row: operator identity, timestamp, club id, **and the answer to the authority question** (D-137). Assert the row cannot be written without the authority field |
| M13 | Onboarding pause (D-139) | Assert a config flag exists that refuses new `claimed` → `verified` transitions **without** lowering any check, and that it is a separate flag from anything payment-related |

---

## N · The Interest Register

D-108, D-115, D-122, D-128. **The rule: what a club receives is exactly the disclosed payload and nothing else, and revocation removes the readable part of it — not merely the link.**

### N(0) · Definitions this section adds to §0

**State:** `reg_state` — `composing` · `awaiting_guardian` · `live` · `withdrawn`. `club_status` — `new` · `shortlisted` · `invited`. **`club_status` is club-side only and has no read path from any player or guardian actor.**

**Payload:** a registration carries exactly — token, squad, preferred position(s), one capped free-text `note`, and the player's name, age and current club. **Nothing else.** The closed-payload rule (D-115) is a schema assertion, not a UI one.

| # | Case | Expected |
|---|---|---|
| N1 | u16 composes a registration | `reg_state = awaiting_guardian`. **Nothing transmitted**, no token issued, nothing readable club-side (D-91) |
| N2 | u16 guardian confirms and sends | Sent. Assert the consent screen rendered **four things** at the moment of the press: recipient club, the trial, what travels in plain words, and the note itself (D-128) |
| N3 | The consent-log row | Records a **disclosure, not an action**: *guardian G disclosed link + note about child C to club X for trial T at time T, policy version V*. Assert the recipient is named on the row and that no row of the form `applied` exists |
| N4 | 16–17 registers | Player sends, guardian notified on every send, `send_switch` honoured (L5–L7 semantics apply unchanged) |
| N5 | 18+ registers | No guardian anywhere. Assert an adult registration carries a reply address and a minor's never does |
| N6 | Club reads a live registration | Sees exactly the payload above. **Assert by column list, not by rendered output** — no DOB, no contact, no school, no address, no free text beyond `note` |
| N7 | Family revokes the link | Token stops resolving **and `note` is emptied, in the same transaction** (D-128). Assert `note` is empty and the row renders withdrawn, atomically — not two statements, not a job |
| N8 | Family deletes the profile entirely | Same as N7, plus the row deletes on the D-128 clock. Assert nothing readable about the child survives in any club-side query |
| N9 | Club attempts to read `note` after withdrawal — direct query, cache, replay | **Empty.** Assert at the database, not the API |
| N10 | Club sets `club_status` | Permitted. **Assert no read path exists from any player or guardian actor to `club_status`, by any query** (D-108) |
| N11 | A fourth status value is introduced by any means | **Denied.** Assert the column is constrained to the three values and that no `declined`, `rejected` or `unsuccessful` value can be written |
| N12 | Any export, download, CSV or report endpoint | **Does not exist.** Assert by route enumeration that no endpoint returns more than one registration in a serialisable form (D-122) |
| N13 | Club cancels its subscription | Register contents deleted within 30 days, confirmed in writing. Assert the deletion is a scheduled job, not a person (D-128) |
| N14 | Registration reaches 90 days past the trial date | Deleted by scheduled job. Assert the clock is identical whether or not the club ever opened it |
| N15 | `note` exceeds the cap, or contains a URL, email or phone number | **Rejected at write.** A child's free-text field is not a channel |

---

## O · Money, and the things money must never touch

D-112, D-135, D-136, D-134. **The rule: no commercial mechanism can reach a child's record. Not payment, not failure, not cancellation, not dunning.**

| # | Case | Expected |
|---|---|---|
| O1 | Any billing surface — plan page, portal link, receipt, invoice, price | **Unreachable from every player, guardian and under-18 view**, by route and by query (D-82, D-88). Assert by enumerating routes, not by checking the UI |
| O2 | A Stripe receipt or portal email addressed to a family | **Cannot exist.** Assert no billing email template can resolve a guardian or player address |
| O3 | Card payment succeeds | Sets a subscription flag on the club record and nothing else. **Assert it does not set `verified`** (M3) |
| O4 | Card payment fails, dunning begins | 14-day grace, then `subscription = suspended`. **Assert registrations are hidden, not deleted** (D-135) |
| O5 | A deletion job runs while a club is in dunning | **No child row is touched.** Assert deletion is reachable only from cancellation + 30 days, never from a payment state |
| O6 | Club cancels mid-term | Access to end of paid period. Annual plan within 14 days → **full refund, no questions** (D-136) |
| O7 | Recurring-billing disclosure | Price, frequency, that it renews, and how to cancel **appear on our page before the Stripe redirect**. Assert the copy exists in our template, not Stripe's (D-136) |
| O8 | Customer Portal | Reachable from the club's own settings inside Pitch. Assert a route exists that is not an emailed link |
| O9 | Any free period that converts to a charge | **Assert none exists.** If one is added, D-134's three conditions are required and this row becomes a live test |
| O10 | Stripe receives any player, record, photograph, token or link | **Cannot happen.** Assert the Stripe payload contains only club, contact name, contact email and card. This is the sentence a parent will look for in doc 20 |
| O11 | `club_admin_own` (the invoicing volunteer) reads billing | **Permitted** — billing is club-internal and carries no child data. Assert this does **not** widen any minor-facing permission (D-93) |

---

## P · Invitations — the only route from a club to a family

D-117, D-138. **The rule: an invitation is the single sanctioned club-to-child contact path, it lands inside Pitch, and ignoring it is invisible.**

### P(0) · Definitions this section adds to §0

**State:** `invite_state` — `sent` · `read` · `answered` · `lapsed`. **`read` and `lapsed` have no read path from any club actor.**

**Transport:** an invitation is an in-app object. The outbound notification is a **bare wake** — no player name, no club message, no child data of any kind.

| # | Case | Expected |
|---|---|---|
| P1 | Verified club invites a u16 | Lands in the **guardian's** account. Assert the child has no read path until the guardian acts (D-117) |
| P2 | Verified club invites a 16–17 player | Lands with the **player**. Guardian is told a verified club made contact and is **not** shown its content. Assert the guardian read path returns the fact, not the message |
| P3 | Verified club invites an 18+ player | Lands with the player. No guardian anywhere |
| P4 | The outbound notification | Contains **no player name, no club name, no message text**. Assert on the rendered body, in all three bands |
| P5 | `club_unverified` attempts to invite | **Denied.** Assert no invitation row can exist whose club is not `verified` |
| P6 | Guardian ignores an invitation | **The club sees nothing.** No `read`, no `pending`, no counter, no timestamp, no difference from never-arrived (D-138) |
| P7 | Club queries invitation state | Returns `sent`, and `answered` if answered. Assert `read` and `lapsed` are unreachable from every club actor |
| P8 | Guardian replies and shares a phone number | It reaches the club **only because she chose it**. Assert nothing is shared by default and each field is independently opted in (D-117) |
| P9 | Guardian replies sharing nothing | Club receives the answer and no contact detail. Assert the reply payload can be empty of identifiers |
| P10 | Club attempts a second message on the thread | **No such path.** An invitation is one object, not a conversation |
| P11 | Any club-to-player message outside this path | **Cannot exist.** Assert by route enumeration — John's red line, structural not stylistic |
| P12 | Invitation to a player whose link is revoked or paused | **Denied.** A club may not invite a family that has withdrawn from it |

---

## Q · Share cards — the guardian approves the image

D-89, D-101. **The rule: an under-18 card is approved as an artefact by a guardian, and once approved nobody can recall it.**

| # | Case | Expected |
|---|---|---|
| Q1 | u16 requests a card | `awaiting_guardian`. **No image is generated, cached or given a URL** until approval. Assert no artefact exists in storage |
| Q2 | Guardian approves | The image the guardian saw and the image released are **byte-identical**. Assert by hash, after the fact |
| Q3 | Approved u18 card content | First name, surname initial, positions, number, stats. **Assert absence** of surname, club, age group, region, school, face, and any URL that resolves to the record (D-89) |
| Q4 | Any URL on a u18 card | Resolves to the **marketing site**, never a record. Assert the string carries no token and no path |
| Q5 | Guardian declines | No artefact, no URL, nothing cached. The child is told; the decline is reported to nobody else |
| Q6 | A second card | **Its own approval.** Assert approval is per-artefact, never per-account |
| Q7 | The record changes after approval | The card does not. Assert it is a **flat artefact**, not a live render — and that doc 21 says so to the child |
| Q8 | Guardian revokes after approval | The record's link is unaffected, and **the card cannot be recalled**. Assert doc 20 states this rather than implying a control we do not have |
| Q9 | 16–17 and 18+ share | 18+ shares directly. 16–17 follows the band at the moment of the share (G1) |
| Q10 | Any share path bypassing approval — API, deep link, replay | **Denied at the query layer**, all bands under 18 |

---

## R · The pending version — an edit is not published until an adult says so

D-103, D-119. **The rule: an under-16 record has an approved version and a pending version. Everyone outside the family reads the approved one. The pending one is personal information about a child that no adult has consented to.**

### R(0) · Definitions this section adds to §0

**State:** `record_version` — `approved` · `pending`. A record may hold one of each. **`pending` inherits the pre-approval draft rule (A17) in full:** unreachable by every query, rendered to exactly two actors, purged with the record.

| # | Case | Expected |
|---|---|---|
| R1 | u16 edits About, a clip title, a club or a stat | A `pending` version is created. **The approved version is unchanged and still serves every club** (D-119) |
| R2 | A club holding a live token reads during pending | Gets the **approved** version. Assert the pending text appears nowhere — including in metadata, ordering or length |
| R3 | The record does not blank during pending | Assert the approved version renders in full. An edit must never take a child's page down |
| R4 | Who may read `pending` | **Exactly two:** the child, and the approving guardian. Every other actor denied at the query layer |
| R5 | Guardian approves | `pending` becomes `approved` atomically. Assert no window serves both or neither |
| R6 | Guardian declines | Approved version stands, pending discarded. The child is told; no club learns an edit was attempted |
| R7 | Guardian ignores | Approved version stands indefinitely. **Assert no timeout auto-publishes** — silence never approves |
| R8 | 16–17 and 18+ edit | Publish immediately, no pending version. Assert the machinery is reachable only for u16 |
| R9 | Deletion during pending | Both versions purge together. No orphan pending row survives |
| R10 | A pending version in any search, index, cache or export | **Cannot appear.** Same rule as A17, one more state |
| R11 | Band changes between edit and approval | Governed at publication (G1). Composed at 15, approved after the sixteenth birthday, publishes under 16–17 rules |

---

## J · The negative suite — tests that must FAIL to pass

These are the ones that actually leak. Each asserts the absence of something.

- **J1** No `is_visible`, `can_view`, `is_public` or equivalent **derived-visibility** boolean exists on any user or profile row — permissions are computed (doc 09). **This does not ban recorded consent state.** A guardian's discoverability off-switch, `profile_state = paused_by_guardian` and a disabled link state are *decisions a human made*, stored deliberately and read as inputs. The ban is on caching a computed answer, not on storing a choice.
- **J2** No endpoint returns a different status, body length or timing for "exists but denied" versus "does not exist", anywhere in the product.
- **J3** The service-role key appears in **exactly one** server route. Assert by static check across the repo, in CI.
- **J4** No query path reaches a minor's record without passing through the Postgres permission function.
- **J5** No analytics, telemetry or behavioural event fires on a minor beyond what the feature itself requires (D-25).
- **J6** No geolocation is collected or stored, for anyone.
- **J7** A WWCC number is never present in any API response, log line, error message or OG image — only a boolean verified state (D-53).
- **J8** No premium, upgrade, price or payment element renders on any under-18 account (D-82).
- **J9** No negative statistic renders on any under-18 public CV — no conceded, no errors, no cards (D-67, D-66).
- **J10** No minor is named on any public surface other than their own CV — assert against club pages, alumni entries and trial notices (D-74).
- **J11** The strings "potential", "insights", "struggling" appear in no user-facing copy; "elite" appears on nothing under U13; "talent identification" on nothing under 10 (D-85). Assert in CI against the built output.
- **J12** No minor-facing list is ordered by anything other than chronology (D-21).
- **J14** No request from a tokenised page sends a `Referer` header to any third party. Verify against a real network trace with the YouTube, Instagram and Veo embeds live — **not** by reading the header config (D-94).
- **J15** The OG image endpoint re-checks the token on every request, is not cacheable beyond a short window, and returns a generic card — never a real identity — for any token that is not live.
- **J16** No secret, share token, or personal datum appears in any log line, error message or stack trace, including third-party error reporting.
- **J17** The service-role key appears in **exactly one file**, and that file exports **exactly one** token read path (J3). Enforced by a repo-wide static check in CI on every commit — J3 asserts the shape, J17 keeps it from decaying.
- **J18** Sign-in, sign-up and password-reset return identical bodies and indistinguishable timing whether or not the account exists.
- **J19** No session token is written to `localStorage` or `sessionStorage`.
- **J20** Share tokens are ≥128 bits of CSPRNG output, stored hashed, and compared in constant time. A database dump yields no working link.
- **J21** No route renders user-supplied text as HTML. `dangerouslySetInnerHTML` appears nowhere in the codebase.
- **J23** **No `agent` role exists anywhere** — not in the role enum, not in any seed, not creatable through any admin path. We promise families "no agents, ever"; that promise needs a test, not a policy.
- **J24** **A guardian's view of their own child's record renders no paid surface and is never gated by any subscription state** (D-31). J8 covers under-18 accounts; a guardian account is an adult account, and this is the one that would actually break the promise.
- **J25** No numeric rating, score, ranking or ordered comparison of players is rendered anywhere, for anyone (D-60, V3). J11 catches the words; this catches the shape.
- **J26** Every under-18 page and every tokenised page emits `noindex, nofollow`, appears in no sitemap, and is disallowed in robots.txt (D-95).
- **J27** No third-party host receives any request from a tokenised page before the viewer activates a façade (D-97). Verify in a real network trace.
- **J28** A declared date of birth cannot be amended upward without guardian or verified-club confirmation (D-96).
- **J29** A 16–17 signup with no guardian contact **cannot reach an active state** (D-96) — the account is incomplete, not merely unverified, because D-22 and D-20 are unbuildable without one.
- **J30** No WWCC number appears in any API response, log line, error, image or database view accessible to a club (D-53, D-98). The permission function reads a boolean and nothing else.
- **J22** No route accepts `role`, `age_band`, `provenance`, `club_id` or a record id from the request body as authority — each is derived server-side.
- **J13** No club role other than `technical_director` and squad-assigned verified coaches can reach a development record. Specifically: **`club_admin` cannot**, by any path (D-93).

---

- **J31** **No endpoint accepts a minor as the recipient of a send.** No send route in which the recipient resolves to a Pitch account under 18, and no route accepting a person id as recipient at all — the recipient is an address, and it is a club's (C1, D-21, D-99).
- **J32** **No bulk or batch send exists.** The send schema holds exactly one recipient; no endpoint accepts an array; no saved-recipient list, no "remember this club", no address book, no "apply to every matching trial", no CSV import of recipients, no re-send-to-last.
- **J33** **No Pitch-initiated send exists.** The send path is unreachable by `sys`, by any scheduled job, webhook handler or support action, and requires a live human session whose actor passes the band check. A send with no human at the keyboard is Pitch disclosing a child's record.
- **J34** **No file attachment on a minor's send, and no file to attach.** No PDF export, print stylesheet, image render or download route on any under-18 record, and the coach-CV PDF exporter (D-75) has **no code path accepting a player record id**. A PDF in an inbox cannot be revoked.
- **J35** **No coach-to-player send path.** No route, handler or job accepts a coach link together with a recipient. The coach link has no recipient parameter anywhere in the codebase (D-100).
- **J36** **No contact affordance is rendered to a signed-in minor**, on any coach CV or club page. Assert against the **response body**, not the rendered DOM — an element present and hidden by CSS or a client conditional is a rendered affordance and fails.
- **J37** **No player or guardian contact detail reaches a coach, TD, club admin or team manager by any path** — API, CSV, club page, squad list, error message, log line, OG image, support console. `team_manager` holds *contact routing* (A15b): routing means **Pitch delivers the message and never discloses the address**. Assert in the schema, not by convention.
- **J38** **No compiled or scraped club-address directory exists in the product.** No table, seed or import of club contact addresses that the send form reads from. An address may be pre-filled **only** where the club supplied it to Pitch itself, and is displayed for confirmation either way. The moment we pre-send to an address we compiled, we become the discloser (D-99).
- **J39** **The player token and the coach link share no implementation.** CI static check: the coach CV route does not import the token resolver; the coach-link table has no expiry column and the player-token table has no public-slug column; no function is called by both.
- **J40** **The rate-limit response is byte-identical to success** — status, body, every header, and timing within the E10 band (L38–L40). Assert by diffing two captured responses, not by reading the handler.
- **J41** **No send receipt, message or surface discloses whether the recipient opened the link.** No read receipts, no view counts, no "a club looked at your CV" — for anyone, at any age (D-65).
- **J42** **A minor's send is visible to the family and to nobody else.** No actor in section A other than `self` and `guardian` can learn that a send occurred, who it went to, or how many there have been — including the receiving club, the player's own club, and `support`.
- **J43** **No "share with a player", "invite a player" or equivalent affordance exists, under any label.** Assert in CI against the built output alongside J11 — route names, handler names, component names and copy. It will not arrive as a bad decision; it will arrive as an obvious one (D-100).
- **J44** **The 16–17 guardian off-switch cannot be bypassed by the player**, and is read **at send time** rather than carried from session start. A stored decision a human made, not a cached computed answer — the J1 carve-out applies and is deliberate.
- **J45** **No route accepts `sender`, `initiator`, `age_band`, `send_state` or `recipient_verified` from the request body as authority.** Each derived server-side (extends J22).
- **J46** **No recipient address appears in any log line, error message, stack trace, analytics event or OG image** (J16, J5). It is consent-log data and lives in exactly one place.
- **J47** **A send cannot be replayed into a second disclosure.** A replayed or duplicated request produces no second transmission and no second consent-log row, while a genuine second send (L35) produces both. The discriminator is a server-issued request id, never a client-supplied one.
- **J48** **No under-18 send surface renders any premium, upgrade or quota-purchase element** (J8), and **no send capability is gated by any subscription state on a guardian account** (J24). Sending your own child's CV is not a paid feature and must not become one by accident.
| J49 | Set `club_state = verified` from a Stripe webhook payload | **Denied.** The row the whole verification decision exists to prevent (D-126) |
| J50 | Read a held registration by joining around the `verified` predicate | **Denied.** Assert the predicate is in the query, not the controller |
| J51 | Recover a `note` after revocation from a cache, replica, restored backup or audit table | **Empty everywhere.** John's condition 3 is a property of the data, not of one code path |
| J52 | Write `declined`, `rejected` or `unsuccessful` into `club_status` | **Denied by constraint** (D-108) |
| J53 | Reach any billing route authenticated as a u16 or a guardian | **Denied**, by route enumeration (D-82) |
| J54 | Delete a child's registration from a payment-failure code path | **Denied.** Assert deletion has no caller in the dunning module (D-135) |
| J55 | Read `invite_state = read` or `lapsed` as any club actor | **Denied.** Silence must be indistinguishable from never-arrived (D-138) |
| J56 | Append a second message to an invitation as a club | **No path exists.** Route enumeration, not a permission check |
| J57 | Serve a `pending` version to a club holding a valid token | **Denied.** The approved version is returned and the pending text appears nowhere (D-119) |
| J58 | Auto-publish a pending edit after a timeout | **No such job exists.** Assert by scheduler enumeration — silence never approves |
| J59 | Generate or cache a u18 share card before guardian approval | **Denied.** No artefact in storage prior to approval (Q1) |
| J60 | Reach a u18 record from any URL printed on a u18 share card | **Impossible.** The card carries no resolving URL (D-89) |
| J61 | Enumerate registrations to learn a withdrawn one existed — sequence gaps, counts, timestamps | **Indistinguishable.** Same terms as E10 and L40 (M6) |


## K · What "green" means

The gate is not "the tests pass." It is:

1. **Every row in sections A–I and L–R has a test, and it runs against the database.**
2. **Every test in section J passes, and J3 and J11 run in CI on every commit** — they are the two that decay silently.
3. **E10 (timing indistinguishability) passes.** If it cannot be made to pass, the link-state page is not safe to ship and D-77 is unmet.
4. **No test is skipped, pending or marked known-failure.** A skipped permission test is a failed permission test.
5. **The one-action takedown has been operated from a phone**, not assumed — it is the single control that lets a company of one meet a statutory removal window, and a control nobody has used is a control nobody has.
6. **A point-in-time restore has actually been performed once**, from the real Supabase project, before launch. A backup nobody has restored is a hypothesis (D-94).
7. **L40 (send rate-limit indistinguishability) passes**, on the same terms as E10 — D-99 makes the send path a public-facing oracle if it does not, and unlike the share link a send endpoint is a surface a stranger can poke without holding a token.

8. **M4 passes — `verified` cannot be set by any automated path.** The one row that, if it fails, means a card payment is all that stands between an adult and a child’s details. Newest condition, least negotiable (D-126).
9. **N7 passes as a single transaction.** Revocation empties the note, or “nothing readable survives” is a sentence we do not get to say (D-128).
10. **J61 passes**, on the same terms as E10 and L40. Held registrations are a third oracle and were not in v1.1.

If all ten hold, we ship. If any one does not, we slip — and per D-47 that is a decision already made, not one to be re-argued in the moment.

## S · The corpus agrees with itself — mechanical, not remembered

Three defects on 27 August and six more on 28 August were all the same failure: **a fact was corrected where it was declared and left standing everywhere it was used.** Twice by Leo, twice by John. Both of us have now promised to grep. A promise is not a control — this section is.

These rows run in CI against the document set, not the database. They are cheap, they are unambiguous, and each one has already failed for real at least once.

| | Assert | Why it exists |
|---|---|---|
| **S1** | No document under `legal/` states a price that does not appear in the register as a locked figure. | The terms carried $299 for a day after D-109 was amended. A contract with a stale price is a contract we could be held to. |
| **S2** | No live document states a launch date. | D-131 removed the runway. Four references survived in doc 18 after it was reported clean. |
| **S3** | Every `D-nnn` cited in any document exists in the register, and no citation points at a decision marked superseded or displaced without saying so. | D-38 sat in the register contradicting D-120 while being cited as live. |
| **S4** | Every inline cross-reference to another document names a document that exists, and a question number that exists in it. | Eight `[LEGAL]` markers in doc 22 pointed at "doc 13" — a folder, not a document — and five carried question numbers from a superseded brief. |
| **S5** | The entity name, ACN and ABN are byte-identical everywhere they appear, and the ACN and ABN check digits validate. | A transposed digit in a privacy policy is invisible for a year. |
| **S6** | Every banned word (D-85, D-108) is absent from every rendered surface and every message in doc 15. | Already enforced in the product; the documents were never checked. |
| **S7** | The register's tally block matches the actual count of locked, proposed and open decisions. | It has drifted twice. |
| **S8** | No document claims Pitch verifies age (D-96), or describes clubs as verified as a general property (D-126). | Both are claims we may never make, and both are easy to write by accident. |

**S1 is the one to build first.** John proposed it, and he is right that it is in the build's lane rather than counsel's: *"prices, dates, entity names and cross-references are exactly the class of fact a check could assert against the register mechanically."*

---

**The date is no longer 14 September.** D-131 replaced the dated runway with a soft launch as early as we can honestly do one, and the honest date is whenever this file goes green. **Quiet is not a lower bar** — a failure with ten families is the same failure, and those are the families who tell other families.

---

*Doc 14 · Permission Test Specification · v1.2 · 27 Aug 2026 · written by Leo (CTO) · sections A–K from register v3.0; **sections M–R and J49–J61 added 27 Aug from register v3.4, incorporating John’s three build invariants** · this file is the definition of the D-47 launch gate.*
