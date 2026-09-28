# builder: the last clean-up round before launch (28 Sept 2026)

**Tree:** `.claude/worktrees/builder-cleanup`, branch `builder-cleanup`, cut from `app` at `340aae1`. `app` merged in at `6753872` (docs only, no conflicts; merged, not rebased).
**Measured on:** `83ef6b1` (the merge). Every suite below ran on that tree.
**Ports:** database 54362, app 3160, Chrome CDP 9363. Stopped by port. Nothing else touched.
**Build output:** `.next` and `.next-check` deleted. `node_modules` is back to its symlink (the runs used a `cp -al` hard-link copy).
**Migrations:** 0067, 0068, 0069 (Leo's allocation). None of 0070+.

Asked: close the found-and-unfixed items before launch, in order, with pillar zero first: the one-tap deletion rolling back, the sliding payment grace, link previews counted as `guardian_landed`, and eleven smaller findings. No new product, no new visible copy. Every new check proven red.

## Did

### 1 · One-tap deletion completes (D-26, pillar zero)

**It was broader than briefed.** Two tables made the deletion roll back, not one:
* `investigation_access` pins `investigation_grant` (append-only, no cascade). The action deleted the grant, so any child an investigator had looked at could not be deleted. This was the briefed bug.
* `message_outbox.subject_id` (0065, merged earlier today) records who a message is *about*. The guardian flow writes it for every 16–17 who names a parent, and nothing deleted it. **So from 28 Sep, every 16–17 who signed up through the product could not be deleted.** Write suite x3 stayed green because its seeded child never had an outbox row. The new property check found this by name on its first run.

**`supabase/migrations/0067_erasure_completes.sql`**
* `fn_erase_child(guardian, child)` is now the deletion. It checks that the caller is an approved guardian (the action still checks too), writes `deletion_requested` and `deletion_completed` inside the same transaction, and handles every foreign key onto `person(id)` in the schema: 60 columns across 41 tables. `revoke all` from public, and from `anon`/`authenticated` where those roles exist.
* **Investigation trail (Leo's decision):** `investigation_grant.subject_id` is set to null, not deleted. The grant, its report and every logged look survive. `fn_who_looked` keys on `subject_id`, so it returns nothing for the erased child. The same applies to `investigator_id` and `register_read_log.person_id`.
* **Three kinds of row.** The migration header has the list, table by table:
  * **Rows about or owned by the child are deleted.** That covers the record and its cascade, memberships, registrations and invitations, requests, messages to or about the child, their coach page, coach counts, and grants and invites *to* them.
  * **Rows that belong to someone else and that the child only signed keep the row and lose the name.** Examples: an entry on another player's record, a version the child approved, a club's alumni line, video, role or notice, a registration the child disclosed. This follows D-48 ("the record travels whole").
  * **Access the child granted or asked for on someone else's behalf is deleted.** That covers register grants they gave, coach invites they sent, squad claims or invitations they raised for another player, and WWCC attestations they made. This is the restrictive direction.

  Most of the second and third kinds cannot happen to a child today, because the database already refuses a minor as guardian, TD or register reader. They are handled anyway, because the property is "no row names the child".
* Six columns that name a person lose NOT NULL so the erasure can null them: `investigation_grant.subject_id` and `.investigator_id`, `assessment_entry.author_id`, `growth_note.entered_by`, `share_token.issued_by`, `register_read_log.person_id`. A new trigger, `fn_insert_names_its_person`, still refuses any *insert* without the name. The only way a row ends up nameless is an erasure.
* Two triggers refuse the update the erasure needs, on purpose: an entry's author is immutable (D-50), and an approved reply must name its approver (D-153). Both now allow exactly one update: removing the erased person's name inside this transaction (`pitch.erasing`, set local), with every other column unchanged. The rest of each rule is untouched.
* **`guardian_setting.updated_by`**: the old action deleted another child's settings row if the erased person had updated it. That would have *un-paused* that child. It now nulls the name instead.

**`app/g/controls/[childId]/actions.ts`**: the deletion path only. It is one `select fn_erase_child($1, $2)`. The header comment now says the investigation trail is also kept. The guardian-notify code is untouched.

### 2 · The payment grace does not slide (Leo's decision, D-135)

**`0068_grace_does_not_slide.sql`**
* `fn_apply_subscription`, for `past_due`, keeps a grace that is already running and only starts a new one when none is running. `active`/`trialing` clears it. Every other status leaves the date alone, so a detour through `unpaid` cannot start a new fortnight.
* `fn_register_active` reads the grace only while the club is `past_due`. A date can now outlive its status, and without this a cancelled club with days left would read as open.
* D-135 holds: neither function can delete anything.

**`app/api/stripe/webhook/route.ts`**: comments only. Two of them described the old overwrite (L25).

**O4c** still proves what it proved: grace, then suspended, rows hidden and not deleted. It used to *get* to "suspended" by re-applying `past_due` with an expired grace, which is exactly the overwrite. Now the fixture moves the stored date the way the clock would, then sends a retry carrying a fresh fortnight that must not revive the register. Per D-163 billing is off at launch, so this is dormant code, built correctly.

### 3 · A link preview is not a parent (Leo's decision)

* **`lib/link-preview.ts`** (new): the one list (facebookexternalhit, WhatsApp, Twitterbot, Slackbot, TelegramBot, Discordbot, LinkedInBot, SkypeUriPreview, Googlebot, bingbot, Applebot, and `/bot|crawler|spider|preview/i`), plus HEAD. The comment says it is a heuristic, which way it errs, and why that is the safe way.
* **`app/a/[id]/page.tsx`**: skips `recordGuardianLanded` for a preview or a HEAD.
* **`proxy.ts`**: a page cannot see the request method, so the proxy stamps `x-pitch-request-method` on every request and overwrites anything the caller sent. **The other builder is working on the CSP in this file.** My change is two lines plus a comment, next to the existing `headers.set`.
* **`lib/guardian-flow.ts`**: the "known limit" comment now describes the decision (L25).
* **Verified end to end on a fresh seed** by reading the database between requests:

  | Request | `guardian_landed` rows |
  |---|---|
  | Before any request | 0 |
  | After a WhatsApp GET, a HEAD, a bot sending a forged `x-pitch-request-method: GET`, and a HEAD sending the same forged header | 0 |
  | After one Safari GET | 1 |

### 4 · The findings

* **Route 404s need JavaScript: not fixed, and it cannot be fixed inside a page on Next 16.3.5.** I read `node_modules/next/dist/docs` and `dist/server/app-render/app-render.js`.
  * **The mechanism.** `notFound()` during a render reaches Next's shell-error recovery (`getErrorRSCPayload`), which always serves `<html id="__next_error__"><head></head><body></body></html>`. The client then draws `app/not-found.tsx` from the flight data. The only paths Next server-renders are the unmatched-URL route (`/_not-found`) and a server action's not-found (`createNotFoundLoaderTree`).
  * **Measured.** Visible text with scripts stripped: `/a/bogus`, `/jobs/bogus` and `/c/bogus-club` are empty, in dev and in a production build. `/nonexistent-route` renders fully.
  * **It is not our code.** A one-line `notFound()` page and a segment-level `not-found.tsx` behave the same. `catchError` is a client boundary and does not help.
  * **Options for Leo:**
    * (a) Proxy-level existence checks that rewrite to a not-found route. This is Next's documented route to a real 404 with content, but it is a second existence answer per route family (L23), and D-77 timing parity would have to be re-proved.
    * (b) Render FailureState inline with status 200. This is a soft 404 and breaks the status parity r15/fp5 assert.
    * (c) Accept it. The status is a correct 404 with noindex; only the body needs JS.

  I added no check, because a check for this would be red today.
* **The 21-byte "Internal Server Error": fixed at its cause.** `lib/db.ts` threw at *import* when `SUPABASE_DB_URL` was missing. An exception while Next loads a route module is answered by `base-server.js` `handleRequest`'s top-level catch with `res.body('Internal Server Error')`. That branch is not configurable and never reaches an error page. Now:
  * A missing URL gives a stand-in `db` with no pool behind it. Every method throws the same error, so nothing connects to a default host.
  * The failure happens at the first query, inside a render.
  * Measured on a production build with no URL:

    | Route | Before | After |
    |---|---|---|
    | `/home` | 500, text/plain, 21 bytes | 200 (no query when signed out) |
    | `/a/bogus` | 500, text/plain, 21 bytes | 500, text/html, 14,142 bytes |

  * **Limit:** that 500 page is the same `__next_error__` shell as above, so with JS off the body is empty. That is the same framework path as the 404.
* **Sessions purged.** `fn_purge_sessions()` (0069) deletes sessions expired or revoked more than 30 days ago. BUZ approved 30-day sessions today. `app/api/jobs/daily/route.ts` calls it and reports `sessionsPurged`. The comment says why this is allowed: a session row is operational state, and `consent_event` is a different table, untouched.
* **Squad roster provenance.**
  * **Database.** `fn_squad_roster` (0069, dropped and recreated) returns `apps_provenance`, `goals_provenance`, `assists_provenance` and `clean_sheets_provenance`. Each comes from the same row as its value: direct entry first, deterministic, where the old query used an unordered `limit 1` per value. Each is gated with its number (L2).
  * **Screen.** `app/club/squads/[squadId]/page.tsx` had "2026 · self-reported" as a literal. It now uses `sharedProvenance` and `provenanceLabel` as the CV does: one caption while the stats share a source, a source on each stat when they differ.
  * **Held labels.** Only "Self-reported" is said (`SOURCES_SAID_HERE`). A stat whose source this screen may not name is left off, never shown bare. Rendered output today is byte-identical ("2026 · self-reported"), because every stat in the product is self-reported. BUZ approved "Coach-verified" and "Official import" today. Per Leo I did not apply that; the next round adds them to that one set.
* **`/club/squads` grant list.** `fn_club_register_grants(person, club)` (0069) returns the same rows the page's inline query did. `grants1` proves this row for row against the old SQL. The "TD only" rule is now the function's. `app/club/squads/page.tsx` calls it with the session person.
* **`.kicker`** resolved to `--ls-label` (0.06em). It is 11px/800/uppercase/muted, its own comment calls it a section label, and DeskClubDashboard draws that shape at 0.14em. It is now `--ls-caps`. `scripts/palette-check.mjs` now resolves every 11px/800/uppercase rule in globals.css through `:root`, fails on anything but 0.14em, and requires `.kicker` to be one of them.
* **`build:check` dirtied `next-env.d.ts`.** The file is now in `.gitignore` and untracked, which is what Next's docs say to do (`05-config/02-typescript.md`). tsc passes without it. After `build:check`, `git status` was empty.
* **Wrong labels.** Nothing was weakened; every check still asserts what it asserted.

  | Old label | New label | What the check actually tests |
  |---|---|---|
  | `E1 <state>` | `dead1` | The read path's null shape |
  | E2 | `dead2` | The live token is the only one that reads |
  | E3 | `dead3` | The read path returns a bare null for every dead state |
  | E4 | `E11c` | The link-state page's content |
  | E5 | `dead5` | noindex on tokenised pages |
  | E6 | `dead6` | No referrer to embed hosts |
  | E7 | `E14c` | The OG route re-reads the token |
  | E8 | `E14d` | The OG route falls back to a generic card |
  | E9 | `E12f` | A minor's card carries no club, age group or region |
  | E10 | `dead4` | The page does not branch on why a link is dead |
  | Q3 | `Q10b` | The club cannot approve a child's card |
  | Q4 | `Q10c` | The u16 cannot approve her own card |
  | M11, M11b, M11c, M11d | `deverify1`, `1b`, `1c`, `1d` | John's replacement ruling |
  | `I4c` | `I4c/E8` | It already tested E8 exactly |

  New checks now test E1 to E7, Q3 and Q4 as doc 14 words them (list below).
  * **E9/E10 (timing):** tested in the render suite (new check), which gate-coverage does not read.
  * **M11 is honestly open.** Doc 14 says a revoked verification revokes every link that club holds. John ruled that unbuildable, and the register has no decision adopting his replacement. **gate-coverage now reports 3 open: E9, E10, M11. Before, 262/262 included these false pins.**
  * **N23**'s proxy (the text of the inline query) is replaced by the rule it stood for (L33).
* **TRAINING §4** now tells every seat to set all four ports, with the command lines, `LAYOUT_CDP_PORT` included.
* **§19 "currently at ."**: `lib/messages.ts` drops the clause when there is no club, and drops the whole line when there are no positions either. Both are removals. The with-club text is word for word as before (`msg19a`).
* **`/g/send` line 95**: "If they reply, it comes to you and ${name} together." is removed. It is false under U-11. The two remaining lines stand on their own. A replacement line is BUZ's call (proposal below).

### New checks, and how each was proven red (L19/L20)

For each group: the bug I put back, and what failed.

* **Erasure** (`permission-tests.mjs`, after table I): `erase0`–`erase6`, `I1`, `I1b`, `I1c`, `I4c/E8`, `I5c`, `U-6o`, `U-6p`, `U-6q`.
  * Reverted to the old `delete from investigation_grant`: 8 failed. I1 failed with the foreign-key error on `investigation_access`.
  * Dropped the outbox `subject_id` clause: 8 failed. I1 failed with `message_outbox_subject_id_fkey`.
  * Added a temporary table `zz_future(coach_id references person)`: `erase0` failed with "NOT HANDLED: zz_future.coach_id".
  * Put the old action back: `erase6` failed.
* **Grace:** `O4c` (reworked), `O4g`–`O4k`.
  * Restored `grace_until = p_grace_until`: O4c, O4d, O4g, O4h and O4k failed.
  * Restored the old gate: O4k failed.
* **Link preview:** `lp1`–`lp7`.
  * Module without HEAD and without WhatsApp: lp1, lp3 and lp4 failed.
  * The old page: lp5 failed.
  * The old proxy: lp6 failed.
* **Startup:** `boot1`, `boot1b`. The old `lib/db.ts` failed both.
* **Sessions:** `purge-sess1`, `purge-sess1b`.
  * A purge that deletes any revoked row: purge-sess1 failed.
  * A job that does not call the purge: purge-sess1b failed.
* **Roster provenance:** `prov-sq1`–`prov-sq1d`, `copy-held2`.
  * An invented source and a source not gated with its number: prov-sq1 and prov-sq1c failed.
  * An invented source for a missing stat: prov-sq1b failed.
  * The old screen: prov-sq1d and copy-held2 failed.
* **Grant list:** `grants1`–`grants3`.
  * The function without the TD rule: grants2 failed.
  * The old page: grants3 and N23 failed.
* **Palette:** section-label rule.
  * Old `.kicker`: failed ("tracked at 0.06em").
  * `.kicker` deleted: failed.
* **Tree:** `tree1`. Without the `.gitignore` line it failed.
* **E and Q rows:** `E1`–`E7`, `Q3`, `Q4`. Each was run against a generated temporary migration or a source edit:
  * E1: the issuer trigger dropped.
  * E2: a 30-day link.
  * E3: a guardian of a 16–17 shown nothing.
  * E4: regenerate without the revoke.
  * E5: the pause check removed.
  * E6: the reminder window moved.
  * E7: a 2-day grace.
  * Q3: the full surname drawn.
  * Q4: a `/p/` URL drawn.

  Each failed on its own row.
* **`E9/E10` in `render-tests.mjs`:** ran its exact code against the dev app with a 120 ms delay patched in for never-existed tokens. It failed at 33 / 31 / 136 ms and passed at 32 / 31 / 32 ms once restored.
* **§19:** `msg19b` and `msg19c` failed on the old message. `msg19a` is a guard and passes on both, by design.
* **`/g/send`:** `U-11d` failed on the old page.

## Ran

From a fresh seed on `83ef6b1`, in §4 order: reseed → perms → render → write → reseed → layout.

| Check | Result |
|---|---|
| perms | 1476 passed, 1 failed (was 1420) |
| render | 526 passed, 0 failed (was 525) |
| write | 369 passed, 0 failed |
| layout | ALL GREEN: 196 page views at 375 and 1280, 22 controls tabbed |
| tsc | exit 0 |
| palette-check | ALL GREEN, including the new section-label rule |
| corpus-check | 0 failures, 0 warnings |
| gate-coverage | 262 rows, 259 pinned, open: E9, E10, M11 (exit 1; see labels above) |
| secret-scan | no secrets found |
| build:check | exit 0; `git status` empty afterwards |

* **The one perms failure is `age3`, and it is not mine.** It asserts the replaced age formula gets an eighteenth birthday "wrong" (17). That formula divides by 365.25 days, so on a day whose 18-year span holds four leap days it reads 18 from 12:00 UTC until Melbourne midnight: 22:00–00:00 AEST today. It was green at 21:xx and turned red at 22:00 on unchanged code. This is L34's defect in another fixture.
* **Render timing:** the new E9/E10 check measured 29 / 29 / 30 ms.

## Found

1. **16–17s could not be deleted since 0065.** Fixed above. Worth a lesson: a column that names a person was added without anyone asking what erasure does to it. The property check now asks automatically.
2. **After erasure, what could still identify the child** (Leo asked me to check `investigation_access.what` and `report`):
   * `investigation_access.what` is free text. Nothing writes it today, but a future investigator typing "looked at Deniz's sends" would survive erasure. Nothing scrubs it.
   * `report.reason` is a reporter's free text and may name the child. `report.reporter_email` may be the parent's address.
   * `report.subject_ref` for a player CV is the SHA-256 of the child's share token. The token row is gone after erasure, so it resolves to nothing, but anyone still holding the raw link can hash it and match the report.
   * `consent_event.subject_id` keeps the child's uuid by design (doc 14 I5).
   * Outbox rows about an under-16 *before* approval carry no `subject_id` (D-17), so their bodies, which contain the child's first name, go to the parent's address and are not deleted.

   **Question for John:** should the investigation trail be retained at all after erasure, and if it is, should `what` and `report.reason` be redacted with it? I built retention, unlinked.
3. **A product decision I made, flagged (TRAINING §3.8).** On erasure, someone else's row the child signed keeps the row and loses the name. The alternative is deleting part of another child's record, and rolling back violates D-26. I read D-48 and D-10 as settling it, but it touches minors, so it is Leo's to confirm. Where the child granted access, it is deleted (the restrictive direction).
4. **`fn_who_looked` inner-joins the investigator.** If an investigator's own account were erased, a family would lose the line for a look that happened. That is unreachable through this path (a guardian cannot erase an investigator). Reported, not changed.
5. **No function in the schema revokes execute from the automatic API's roles** (L26 for functions). I did it for `fn_erase_child`. RLS stops the others doing damage today (no policies means no rows), but it is worth a sweep by the release seat.
6. **gate-coverage reads only the permission suite.** The render suite now tests E9/E10 honestly and it cannot count them. Proposal (not built): let gate-coverage read the render and write suites' labels too. Today that would add E9, E10 and A19 (A19 is already pinned).
7. **M11 needs BUZ.** Either doc 14's M11 is amended to John's ruling (reason class, child-safety notice, one-tap revoke) with a register entry, or M11 as worded is built, which revokes links families sent to other clubs. The gate reports it open until then.
8. **§19 edge:** with no positions but a club, the line now drops entirely, club included. Saying the club alone needs new words. The send path can supply an empty `positions` array; I did not check whether the product lets a CV be sent without one.
9. **`/g/send` line 107** still reads "No contact details for you or ${name} — not now, and not if they reply." It is true, but "if they reply" assumes a reply that cannot reach anyone. Out of my brief; for the copy seat.
10. **`.kicker` size vs design:** InterestRegister.dc.html draws its numeral captions at 9.5px / 0.06em, and the register page uses `.kicker` at 11px. The tracking is now charter-correct; the size difference predates me.
11. **Someone else hit my port.** The dev log showed `HEAD /signin` ×3 and `GET /signin?csp-probe=stripped` on 3160, none from me. It looks like the CSP builder's probe pointed at 3160. Leo may want to check their `RENDER_BASE`.
12. **Found, not built (item 5 of the brief), for BUZ:**
   * Families who sent a CV to a club's *other* address are never told of a suspension. `fn_guardians_to_notify_on_suspension` matches the destination against `club.contact_email` only.
   * Doc 15 §37 says "you sent it" to parents of 16–17s who sent their own link.
   * Nothing grants an investigator access, so the who-looked card is empty for every real family. U-6's disclosure exists; nothing produces a look to disclose.

## Copy for BUZ

No new user-visible string renders. Two removals, one held set, and one proposal:
* **Removed**, `/g/send`: "If they reply, it comes to you and ${name} together."
  * **Proposal only, not rendered:** "The club can't reply to you through Pitch. If they want ${name} at a trial, they post it on Pitch and you register from it."
* **Removed**, doc 15 §19 body, when the player has no club: ", currently at ." The line "${name} plays ${positions}." stands on its own.
* **Removed** when there are no positions either: the whole line "${name} plays …".
* **Held**, squad screen: "Coach-verified" and "Official import". You approved them today. Per Leo the next round adds them to `SOURCES_SAID_HERE`. Until then a stat with either source is not shown on the squad list; none exists today.
* **Unchanged in output:** "2026 · self-reported" on the squad list. It now comes from `lib/football` instead of a literal.

## Risks

* **`proxy.ts`**: the other builder is changing the CSP in the same file. My lines are separate and should merge cleanly, but whoever merges second must keep `headers.set(PITCH_METHOD_HEADER, req.method)`. `lp6` fails if it goes.
* **The alumni trigger** (the other builder's): `fn_erase_child` nulls `alumni_entry.added_by` and `adults_confirmed_by`. If their trigger comes to fire on UPDATE and require either column, erasure will roll back. The property check will say so by name.
* **The link-preview list will miss fetchers we did not name**, and `/bot|preview/` will catch the rare real browser whose name contains it (Cubot phones). The only effect is one funnel row.
* **Dropping NOT NULL on six columns** is guarded at insert by trigger, not by constraint. A direct UPDATE could still null one. Only erasure does that today.
* **`pitch.erasing`** can be set by any SQL session, at the same trust level as a direct write to those tables. It is not a user-reachable surface.
* **`.kicker`**: 0.14em widens every caption that uses the class, 21 in product pages (/home 6, /c 6, /club/register 4, /jobs 3, /fc 2) plus /design. Layout is green at 375 and 1280, with nothing overflowing; I did not look at 390 to 1023 or compare them with the design screens by eye.
* **Not measured:** the 404 and 500 with JS on in a real browser (unchanged behaviour); the grace fix against a real Stripe event stream (billing is off, D-163).

Lesson: a new column that names a person is a new thing for erasure to handle, and the author of the column will not be the one pressing "Delete everything". Ask pg_constraint rather than the list; the property check in the permission suite now does that on every run.
