# tech-builder: round M, BUZ's 30 September rulings (2026-09-30)

**Gate: 263/263.**

*Filed by Leo from the builder's handback.*

Asked: brief M. Build D-170 and D-171 in Postgres, stop a suspended club being named on a CV, and hide a non-verified club's own players-wanted notices. No new words. Prove every check red, run every suite from a fresh seed, and keep gate-coverage at 263/263.

**State**
- **Commit:** 054a1d2 on `builder-final-m`, cut from 3b29be1.
- **Nothing pushed, merged or deployed.**
- **Ports:** mine (3310, 54502, 9503) are free. 3000, 54322, 3030 and 54323 were never touched; 54322, 3030 and 54323 are still up.
- **Tidy:** `.next` and `.next-check` are deleted, and `node_modules` is the symlink again. Logs are in `.m-logs/` (5.2M, untracked).

## Did

**`supabase/migrations/0153_leaving_a_club_withdraws.sql` (D-170)**
- `fn_left_club_withdraws(person, club, actor)` holds the rule. It acts only when the player's **last** player membership at that club has ended.
- For each live registration there it calls the family's own path, `fn_withdraw_registration`: the note is emptied (D-128), and a registration no club could ever have read is removed as 0095 does. It then writes the usual `registration_withdrawn` row.
- It passes the player as the actor to `fn_withdraw_registration`, because the player may always withdraw their own. The log names the family member who acted.
- `fn_leave_squads(actor, person)` is the family's Leave. It checks `fn_can_leave_squad`, ends the memberships, writes one `squad_left` per ending, then applies D-170 for each club left.
- `fn_join_squad` is rewritten whole with D-170 added where a signing ends the old club's memberships. The log actor is the parent who asked (a claim) or who said yes (an invitation).

**`app/squad/actions.ts`:** `leaveSquad` now calls `fn_leave_squads`; the page no longer writes the membership itself.

**`supabase/migrations/0154_authorship_through_a_verified_club.sql` (D-171)**
- `fn_read_level` is rewritten whole as 0003 wrote it. Its A10 branch (authored read) now also asks `fn_authorship_stands(entry)`.
- That function answers true only if every club the entry was written through is verified now.
- `record_entry` has no club column. The club is read back from the author's coach or TD membership and the child's player membership that were both live when the entry was written. The provenance trigger (0015) only stamps `coach_verified` through such a pair at a verified club.
- If no club fits, the entry grants nothing. Nothing is stored, so a verification call restores the read unchanged.
- **Departed authors:** a coach who wrote at a club, left it, and whose old club then goes down also loses `authored_only`. The brief says "must not grant it through a club that is not verified", and D-48 is kept only for "a coach who leaves a club that stays verified". A coach whose old club stays verified is unaffected by what happens at the child's new club.

**`supabase/migrations/0155_a_suspended_club_is_not_named.sql`**
- `fn_cv_club` skips a club whose state is `suspended`, which covers every class and a takedown. The CV then renders as for a player with no club.
- `lib/record-read.ts` `assembleCv` (the 16-17 and adult CV on every surface) reads `fn_cv_club` instead of its own membership query.
- `lib/send-dispatch.ts` (the CV email's "currently at {club}") reads `fn_cv_club` too.

**`supabase/migrations/0156_only_a_verified_club_wants_players.sql`:** `fn_players_wanted_advertised` requires a verified club. Every players-wanted notice is the club's own; Pitch compiles trial notices only.

**`app/dev/read-level/route.ts` (new, development only)**
- POST only; 404 in production and in a demo.
- Returns `fn_read_level` for a viewer and a person, and nothing off the record.
- It exists because no page shows `authored_only` before December, so the write suite had nowhere to see D-171 (L19).

**`scripts/dev-db.mts`:** the seed has Sam write one coach-verified entry on Deniz while he holds the squad. The provenance trigger accepts it.

**`scripts/permission-tests.mjs`** (+25 checks)
- **Table H additions:**
  - Three new authors at Signing FC: a coach who stays, a coach who writes and leaves, and the TD (writing about the second child).
  - A Previous FC registration with a note for the transfer, and a note on the Signing FC registration for the Leave.
  - The transfer runs inside one transaction and the old club's register is read inside it.
- **H3:** the departed author keeps what they wrote at a club that stays verified.
- **H5, for every way out of verified** (the three suspension classes, no class, takedown, failed call):
  - The authors drop to nothing.
  - The Previous FC author, whose club stays verified, keeps what they wrote.
  - `pw1`: the club's players-wanted notice goes off its page.
  - `cvclub1`: no CV names the club (suspended and takedown only).
  - A failed call at Previous FC ends its coach's authored read on a child who has since left.
- **H2:**
  - The transfer withdraws the Previous FC registration in the signing's transaction: row gone, the TD cannot read it, note emptied, log row with the parent as actor.
  - The Leave does the same at Signing FC.
- **D-170 boundary:** a player in two squads at one club, taken out of one of them, keeps the registration, and the rule withdraws nothing. The family's Leave then takes it off.
- **Static checks:**
  - The Leave is `fn_leave_squads`, and only `fn_join_squad` and `fn_leave_squads` call the rule.
  - `dev3`: the new route is gated.
  - `cvclub-s1`: the three CV surfaces read `fn_cv_club`.
- **hist4 (L33):** the check was reading the live-read source for the club's suburb and state. That line now lives in `fn_cv_club`, so the check reads it there instead of being deleted.

**`scripts/write-tests.mjs`** (+22 checks)
- **H5, for each outcome pressed on the operator's call sheet:**
  - Sam (on the squad, and an author) and Marina drop to `none`, then come back `full`.
  - `pw-w1`: Riverside's "Players wanted" is off its public page.
  - `cvclub-w1`: Deniz's club line is gone from his parent's preview and from his share link.
- **H2, after Alex presses Leave:**
  - Marina reads nothing of Deniz, and Sam only what he wrote (D-48).
  - For each of the five outcomes, Sam's authored read is lost and then restored (D-171).
  - Riverside's register loses Deniz's row and the CV from it returns 404. His controls list only the other club's registration, and his timeline gains "came off a club register".
- **Squad block (Georgia):**
  - The club's ask-again / no-looks-like-silence part (sqf12–17) now runs before the family's ask-and-Leave. The old order needed Georgia still on the register after her Leave, which D-170 now ends (that is where the explore run crashed).
  - A new check after her Leave confirms the registration went with her.

## Proven red (L19/L20)

Every mutant was restored afterwards, and the migrations were compared byte for byte (`cmp`).

| Mutant | Went red |
|---|---|
| The rule withdraws nothing | perms: H2 transfer, H2 Leave, D-170 two-squad · write: H2 (Deniz), H2 D-170 (Georgia) |
| The rule ignores "last membership" | perms: D-170 two-squad |
| The D-171 clause removed | perms: H5 authors ×6, H5 Previous FC · write: H5 database ×5, H5 departed author ×5 |
| The authorship check always false (over-restrictive) | perms: H3 D-48, A10, H3/A10, H2 transfer and Leave, H9 (TD), tdx16, H5 ×7 |
| `fn_cv_club` without the suspension filter | perms: cvclub1 ×5, cvclub-s1 · write: cvclub-w1 ×4 |
| 0156 removed | perms: pw1 (failed call) · write: pw-w1 (failed call) |
| Leave back to a raw UPDATE in the action | perms: the D-170 Leave static check |
| `assembleCv` back to its own query | perms: cvclub-s1, hist4 |

## Ran

All on the final tree, from a fresh seed, in TRAINING §4 order. Load was 6–9 throughout, with 15–20 GiB free.

- **Static:** tsc 0 errors · palette ALL GREEN · corpus 0 failures, 0 warnings · secret-scan clean · validate-migrations ALL GREEN.
- **gate-coverage:** **263/263**, 0 open.
- reseed → perms **1892/1892** (+25) → render **627/627** → write **507/507** (+22).
- reseed → layout **230 views at 375 and 1280, ALL GREEN** (CDP 9503).
- **timing, on a fresh app with the 12 GB heap:**
  - Run 1: 18/19. J61 was inconclusive: its /home and /club/register arms resolved 0.90 and 1.02ms against the 0.8ms target, and no shift was seen (p = 0.98 and 0.80).
  - Run 2: 17/19. J61 was inconclusive again, and **L40 flagged "a real send +0.33ms" (p = 0.00027)**.
  - Because I changed a query on the real-send path, I ran L40 alone, each time on a fresh seed and app: +0.12ms and −0.13ms on my code, and −0.08ms with the `send-dispatch` line reverted. None was distinguishable. The changed lookup runs in `dispatchShareRequest`, which finishes before the 120ms floor is awaited.
  - J61 alone: green at 0.90/0.98ms.
  - **Run 3 (full): 19/19.** E10 0.63ms, tok-rl 0.59ms, req-t 0.35ms, L40 0.35ms, J61 0.94/0.82ms.
  - The owner's TIDAL and Chrome were at about 100% CPU each throughout.
- **build:check:** exit 0 (`/dev/read-level` is listed as a dynamic route; it 404s in production).
- **test:csp-prod:** **5/5** on 3310, with the dev app stopped.
- **After the last edits:** the edits after the official run were comments only (0154, the seed and the write-suite header). perms was re-run at **1892/1892**; render and write were not re-run for those edits.

## Found

1. **The club's own Remove on a child's last squad is not a D-170 leave.** D-170 names only Leave and signing elsewhere. The registration stays, and the club can ask the child again from it (0054, sqf12). Options: (a) keep it as now; (b) Remove from the last squad also withdraws. I did not choose.
2. **A suspended club is still named on a CV through a verified stat.** "Verified by Riverside FC · 30 Sep 2026" stays on a suspended club's player's CV; this comes from `fn_stat_public` (0083, D-160), not `fn_cv_club`. Options: (a) keep it, since the club was verified when it verified the stat; (b) drop the club from the stat while the club is suspended. (b) may need a ruling on what the stat then says. I did not choose. Family-written text (an achievement, a previous club) still names the club too; that is the family's own text.
3. **A club that failed its call (0150, now `claimed`) is still named on its players' CVs.** The brief named suspension and takedown only. Not changed.
4. **The TD's Remove on /club/squads only revokes register grants.** The seed's coach squad membership survives, so Sam keeps `full` on Deniz and his squad CV after "Remove". Round L's H4 write check leaves the squad CV out for this reason. Production has no writer of a coach's squad membership (L13), so nothing is exposed today. December's writer needs Remove to end those memberships too.
5. **The family's own squad card and player menu still name a suspended club.** They are not a CV. Not changed.
6. **`lib/cv-build` still stores its own club line in each snapshot.** It is never served, because `fn_approved_cv` overrides it with `fn_cv_club`. This is a duplicate, not a leak.
7. **`scripts/migration-on-data.mjs` is broken before my migrations (not in §4).**
   - Its default clean scenario stops at 0076, on the `consent_event` check.
   - Its dirty scenario stops at 0051.
   - With `--base 0152`, its seed is refused by `fn_td_membership_write_rule`.
   - So it did not exercise 0153–0156 on data.
8. **The write suite still prints `SKIP sq12b/sq13/sq14`**, as before.

## Copy for BUZ

There is no new string. What people now see differently, all in existing words:
- **After a family's Leave, or a signing for another club:**
  - The old club's registration is gone from the child's controls.
  - The timeline gains "{name} came off a club register".
  - The club's register no longer lists the child.
- **A suspended or taken-down club:**
  - The CV club line "{club} — {squad} · {locality}" and the "{squad} · now" history row are gone from the share link, the preview, the register CV and the squad CV.
  - The CV email leaves out ", currently at {club}" (the existing no-club branch of doc 15 §19).
- **A club that is not verified** (including after a failed call): no "Players wanted" section on /fc/{slug}.

## Risks

- **`fn_authorship_stands` depends on membership history never being edited.** Only a child's erasure and the demo reset delete memberships today. An entry with no matching pair grants nothing.
- **The departed-author reading is the restrictive one.** It is described under Did; if Leo reads D-171 differently, it is one clause in 0154.
- **`cvclub-s1` pins the three CV surfaces I know of.** It does not discover a new one.
- **`/dev/read-level` is gated in code, not tested against a production build.** `dev3` pins the code; I did not hit the route on the built server.
- **The write suite now presses the call sheet 10 more times**, which adds family notices to the outbox (L32). Everything is green.
- **Not checked:** a real phone, the website, the demo. The demo needs a restart after 0153–0156 (L14). The render suite gained no checks; the served-page effects are pressed in the write suite.

## Lesson

When a ruling changes what a button does, every later block in a suite that presses that button and carries on inherits the old behaviour as an assumption. sqf12 needed Georgia still on the register after her family's Leave, and D-170 ended that. Before running, grep the suites for each press of an action whose meaning changed, and read what the lines after it assume.
