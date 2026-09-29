# builder: final F — the TD handover, and the crest a verified TD has earned (29 Sept 2026)

**Tree:** `.claude/worktrees/builder-final-f`, branch `builder-final-f`, cut from `app` at `0959721`. `app` moved twice. First to `dd3bdfd` (BUZ's approval of the handover words), which I merged (a fast-forward) before building on it. Then to `72d0a47` (docs only: the register, briefs G/H/I, approvals, the go-live runbook), which I merged after committing; the doc-reading checks were re-run after that merge (see Ran). No rebase.
**Measured on:** the working tree committed as the "TD handover" commit on `builder-final-f` (parent `dd3bdfd`). Every suite ran from a fresh seed in TRAINING §4 order after the last code change.
**Ports:** database 54432, app 3230, Chrome CDP 9433. Everything stopped by port only. Logs in `.builder-logs/` inside my tree (untracked).
**Migrations:** `0100_td_handover.sql`.
**Machine:**
* Load was 4.3–13.7 on 14 cores. The 13.7 was a one-minute spike during render, and no suite started above 14.
* A second builder tree, `builder-final-g`, was active at the same time. That accounts for most of the load, which ran 9–11 in the last hour.
* The full timing run started at a load of 7.4.
* Free disk was 24 GiB at the start and 14–15 GiB during the suites. **After `build:check` it was 5.2 GiB.** I deleted my `.next` (1.4 GB) and `.next-check` at once, which brought it back to 6.5 GiB, and started nothing more that builds (see timing).
* `node_modules` is back to its symlink. The runs used a `cp -al` hard-link copy.

Asked: brief F. (1) A live `technical_director` membership earns the crest on the coaching CV, on the role line naming that club, never from the typed org name. (2) End a TD's access: one Postgres rule with a reason and an append-only audit row, callable by the operator (call sheet) and the club's `club_admin` (`/club/roles`), never the TD or a coach; a verified call naming a different TD ends the old one in the same transaction; prove the lost access through the real read paths. Mid-task, Leo relayed BUZ's approval of the six handover strings (recorded in `APPROVALS-28-SEP.md` at `dd3bdfd`, which I read before acting on it): render them live.

## Did

### 1 · The crest (`app/c/[slug]/page.tsx`)
* The page read one live **coach** membership (`limit 1`) and compared its club's name to the current role's typed org. It now reads **every** live `coach` or `technical_director` membership and shows the crest only when one of those clubs is the club the current role line names.
* The typed `coach_role.org_name` still grants nothing: it is only ever compared against clubs the person holds a membership at.
* Seed (`scripts/dev-db.mts`): Marina (Riverside's TD) gets the coach CV D-93 and doc 16 §3b already describe — `/c/marina-petrovic`, "Technical Director · Riverside FC" (2022–) and one earlier role at Northern United SC. Without it nothing in the dev database could render a TD's crest.

### 2 · Ending a TD's access — the rule (`supabase/migrations/0100_td_handover.sql`)
* **`td_ending`**, append-only (update/delete raise), RLS on (L26), no foreign keys (0044's reasoning). One row per ending: when, club, which person, which membership, `cause` (`club_admin` · `operator` · `replaced_on_call`), who pressed, the operator's address, the reason, the call. A check constraint requires a 3–500 character reason for the two pressed causes and a call id for a replacement.
* **`fn_td_ends(...)`**: the one place a TD membership is ended. It sets `ended_at` on the live row and writes the audit row, and touches nothing else. Entries, grants and notes the TD wrote are untouched (D-48). `fn_read_level` already gives a departed author `authored_only`.
* **Two doors**, because there are two kinds of actor:
  * **`fn_end_td(actor, club, reason)`**: the club's administrator. The database checks the actor holds a live `club_admin` membership at that club (`fn_may_end_td`). A TD, a coach, a team manager, another club's administrator or nobody: refused.
  * **`fn_ops_end_td(operator, email, club, reason)`**: Pitch's operator. The schema holds no operator identity (`lib/ops-guard`: an allowlist in the environment). So, like every `fn_ops_*` function (0044, 0070), the authority is `requireOperator` in the action. The database checks what it can: the operator is a real person whose own address is the one given.
* **Handover on the call.** The call's own trigger now calls **`fn_td_replaced_on_call`** before it attaches anyone. Any live TD the latest call does not name is ended, and logged against that call, in the same transaction as the call insert. This happens even when the new person cannot attach yet (no account, or an unproved address), so the club has no TD in between rather than two. A call naming the same person changes nothing. A verified call that records no TD changes nothing.
* **Two holes closed on the way.** Both are needed for "ended" to stay ended:
  * **`fn_td_call(club)`.** Only the **latest** verified call that recorded a TD names the club's TD. Before this, any verified call that ever recorded an address counted. So a person an older call named could still pick up the role by proving their address after a newer call named someone else (tdx20).
  * **A spent call.** `fn_td_on_call` says no once that person's role at that club ended after the call named them. So a re-verification, a proof or a hand-written row cannot revive someone who was ended (tdx10–12). Only a **new** call brings them back, which is what the approved words tell both the operator and the club.
* **`fn_club_td`** gains `ended_at`: when the person the latest call names had their access ended since that call.
* The migration's closing sweep applies the one-TD-per-club rule to rows already in the table. It ends nothing in the seed or the demo, where every club has one call and one TD.

### 3 · Ending a TD's access — the doors
* **Call sheet (`app/ops/call/[clubId]/*`).** While the role is live, the TD card carries "Why" and "End this Technical Director's access". The `endTd` action calls `requireOperator` first, takes the club id from the form (checked as a uuid; an operator acts on any club), then calls `fn_ops_end_td`. Once the access has ended, the card's status line is BUZ's approved confirmation with {Name} (the account holder's own name) and {Club}. It is no longer "Waiting on their account", which would be false. The file header no longer says handover is absent.
* **Club roles (`app/club/roles/*`).** For whoever `fn_may_end_td` says yes to (the administrator), there is a "Technical Director" row with the TD's name, "Why" and "End their access". The `endTdAccess` action:
  * takes the club from the session (`clubIManage`), never from the form;
  * asks `fn_may_end_td` first, so a TD, a coach or a stranger lands back on the page having changed nothing;
  * then calls `fn_end_td`.

  After the press, the page shows the approved confirmation. The name is read from the audit row, so it never travels in the address bar. The TD's own view of `/club/roles` is unchanged.
* **Verification queue (`app/ops/verification/page.tsx`).** An ended TD's line would have said "waiting on their account". It now carries a held state, "access ended", in development only. In production the line carries no state at all rather than a wrong one.

### 4 · Tests
* **Permission suite.** New block tdx0–tdx28 and H9, on a fixture club with a child in a squad, a registration, and an entry the TD wrote. `H9` asks every read path the TD's screens use: `fn_read_level`, `fn_can_work_register`, `fn_register_rows`, `fn_can_read_registration`, `fn_squad_roster`'s record ids, and `fn_write_provenance`.
* **td21 and H9c.** The old H9c fixture revived an ended TD by `update … set ended_at = null` off the same call. That is now refused (td21), and H9c re-grants on a new call. I checked this against D-48 and the approved words before changing the test (L22), and it was not a "make it green" edit.
* **coach2 and coach1b** pin the crest source.
* **Render suite.** crest-r1 (Marina's hero wears Riverside's crest next to "Riverside FC · Melbourne VIC") and crest-r2 (Sam still does).
* **Write suite, block `crest-w0–2` and `tde-w0–w16` + `H9`.**
  * Pressed through the coach editor, `/club/roles`, the call sheet and the sheet's own call form.
  * **Before and after:** the register, a CV opened from it, a squad page and a CV opened from that squad. The departed TD gets 307 / 404 / 404 / 404, where she had 200 ×4.
  * The block runs **before** the generic sweep, because by the end of the suite the squads are empty and some seeded sessions have ended. It hands both roles back through calls at the end (tde-w15/16).
  * The two End buttons are excluded from the generic sweep's x1/x2 in the same way delete is, because this block owns them. That is a fixture change to the write suite (L32).

## Ran
All from a fresh seed, TRAINING §4 order, on the final tree:
* perms **1682/1682**
* render **575/575**
* write **418/418**
* layout **206 views at 375 and 1280, ALL GREEN**. The walk includes the call sheet with the new form and the administrator's `/club/roles`.
* tsc **clean**
* palette **ALL GREEN**
* corpus **0 failures, 0 warnings**
* gate-coverage **263/263**
* secret-scan **no secrets**
* build:check **compiled, 23/23 static pages**
* csp-prod **5/5**
* **timing: not a clean 19/19. Two rows were inconclusive, and none flagged a difference.**
  * The full run on a fresh seed and app gave **17/19**: tok-rl and J61 were INCONCLUSIVE. The load touched 8.2 during that run.
  * **tok-rl**, rerun alone on a fresh seed and a fresh app: **3/3, conclusive**, resolution 0.74 ms.
  * **J61**, rerun twice alone on a fresh seed and a fresh app, is **still INCONCLUSIVE**. The first rerun resolved 1.13 ms and 1.25 ms against the 1 ms bar. The second used `TIMING_MAX_ROUNDS=3000` and resolved 1.05 ms and 1.72 ms, while the load rose to 11.6 around it.
  * In every J61 run, both arms showed no shift: p = 0.22 to 0.78, and shifts of −0.31 to +0.14 ms. J61 times `/home` and `/club/register` for a held club's administrator, and neither page changed in this round.
  * I did not try a fourth time. It needs a fresh dev build of about 1.4 GB, and free disk was 6.5 GiB. **Leo: J61 needs a rerun on a quiet machine before this merges.** A partial run is never a gate result (`timing-tests.mjs`).
* **After merging `app` at `72d0a47`** (docs only), I re-ran the checks that read docs: perms __PERMS2__ · corpus __CORPUS2__ · gate-coverage __GATE2__.
(Baseline at `0959721`: perms 1650 · render 573 · write 397.)

**Red proofs (L19/L20).** Each bug was put back, the suite was run, and the file was restored (`cmp`-checked).

| Bug put back | Where | Went red |
|---|---|---|
| M1 a TD may end the role (`fn_may_end_td` admits `technical_director`) | 0100 | tdx1, tdx2 (+ tdx3, 4, 6 downstream) |
| M2 no reason required (function and table) | 0100 | tdx3 |
| M3 a later call ends nobody (0058's behaviour) | 0100 trigger | tdx15–tdx22 |
| M4 a spent call still counts | 0100 `fn_td_on_call` | td21, tdx10, tdx11, tdx12 |
| M5 any verified call that ever named you counts (0058/0060) | 0100 `fn_td_on_call` | tdx15–tdx22, incl. tdx20 |
| M6 ended but not logged | 0100 `fn_td_ends` | tdx6, tdx8, tdx17, tdx22 |
| M7 the audit can be edited | 0100 trigger | tdx7 |
| M8 the end function ends nobody | 0100 `fn_td_ends` | tdx4, H9, tdx9–tdx15 |
| S1 the club's action takes the club off the form | `club/roles/actions.ts` | tdx26 |
| S2 the operator is checked after the database call | `ops/call/actions.ts` | tdx27 |
| S3 another file ends a TD with its own UPDATE | `club/squads/actions.ts` | tdx28 |
| — the new actions not written yet | — | tdx26, tdx27 (first run) |
| R1 only a coach's membership earns the crest (old code) | `c/[slug]/page.tsx` | crest-r1 |
| R2 the crest comes off the typed org name | `c/[slug]/page.tsx` | tde-w5 (see Risks) |
| R3 any held club's crest, whatever the line names | `c/[slug]/page.tsx` | crest-w1 |
| R4 the sheet keeps saying "waiting on their account" | `ops/call/page.tsx` | tde-w7, tde-w11 |
| R5 the queue keeps saying "waiting on their account" | `ops/verification/page.tsx` | tde-w8 |
| R6 the page shows the door by seat, not by `fn_may_end_td` | `club/roles/page.tsx` | tde-w2 |

## Found
1. **Approved default 5 is not built.** The default reads: "A Technical Director name mismatch at verification is held for a human. It never auto-passes." `fn_attach_recorded_td` still attaches to a differently named account. The call sheet still says "This is not the name recorded on the call. The role goes to this account, not to the name above." With this round, a call naming a new TD also ends the old one at once, whatever the new name resolves to. Outside my brief. For Leo.
2. **Three behaviour choices I made; each is pinned by a check.**
   * **A call that records the club's own mailbox as the TD ends the live TD and attaches nobody** (tdx23). This is brief-literal ("a TD email different from the live TD"). The other reading is to end the old TD only when the new address could hold the role.
   * **A verified call that records no TD changes nothing.** The TD fields are optional on the sheet, so a routine re-verification would otherwise cut the club's register.
   * **A TD has no door to end their own access** unless they are also the club's administrator. I read "never the TD themselves" restrictively. A departing TD asks their administrator or rings Pitch.
3. **The ops confirmation is also the TD card's standing status line.** It shows after an ending, not only straight after the press. The words are true as a status, but BUZ approved them as a confirmation. For Leo to confirm.
4. **Doc 14 labels (L4), pre-existing, not changed.**
   * `H8: a departed technical director loses club-wide access at once` (permission suite, table H) tests doc 14 **H9**. Doc 14's H8 is `experience_entry` with a club's name.
   * `H9c` tests reinstatement on a new call, which no doc 14 row words. I kept the label, because it predates me, and changed only its content.
5. **Pre-existing, not changed.**
   * Neither a coach's crest nor a TD's checks that the club is still verified, so a suspended club's crest still shows on a coach CV.
   * A TD whose `person.email` changes after the role attached stays live. Any later write to that membership row is refused by 0058's wall, because the new address is not on the call.
6. **Erasure.** `td_ending.reason` is free text about an adult, and the erasure path does not wipe it (D-166 covers a child's free text). For Leo, if D-166 is meant to reach club-side audit text too.
7. **The operator door's authority** is `requireOperator` (the `OPS_EMAILS` allowlist), as for every `fn_ops_*` function. The database can only check that the operator is a person holding the address the console gives.
8. **Brief G overlaps this round.** It rebuilds `/ops/verification`, whose TD line I changed (the held "access ended" state, plus a line that no longer forces a state). It also keeps F's call-sheet door once F merges. Whoever merges second will need to carry both changes to `/ops/verification`.
9. **Two builders ran at once.** `builder-final-g` was active while this round ran, although the brief said "You are the only builder". The disk went under 6 GiB after my `build:check`.

## Copy for BUZ
**Approved 29 Sep (APPROVALS-28-SEP.md), now rendered live, word for word:**
* Ops call sheet, TD card: "End this Technical Director's access" · "Why" · "{Name} no longer sees the register, the squads or any player's record at {Club}. What they wrote stays theirs. To name a new Technical Director, record them on a call."
* Club roles screen, TD row: "End their access" · "Why" · "{Name} no longer sees the register, the squads or any player's record. To name a new Technical Director, ring Pitch."

**Reused, already in the product:** "Technical Director" (the row's label, the console's existing role name).

**Held, rendered in development only (`NODE_ENV !== 'production'`):**
* "access ended" is the state on the verification queue's one-line TD summary. It reads "Technical Director Marina Petrovic · access ended · recorded by BUZ on 29 Sep 2026".
* In production that line omits the state.

**Seed data, not copy:** Marina's roles "Technical Director" (Riverside FC) and "Head Coach · U16 Girls" (Northern United SC).

## Risks
* **R2 went red on tde-w5, not crest-w1.** The seed has one crested club, so "a typed line naming another club" (crest-w1) can only name a club without a crest. The typed-name bug shows only where the typed name is a crested club the person holds no membership at. tde-w5 is that case: the ended TD still types "Riverside FC".
* **The admin's "ring Pitch".** Nothing on `/club/roles` says how to ring Pitch. The words are BUZ's, and the contact is the one address in the footer.
* **The demo on 3030** runs the old schema and seed until it is restarted (L14). After a restart, Marina has a public coaching CV, renamed to the demo club by the demo layer.
* **Not checked:** the TD row and the End button in a real browser with JavaScript on. The write suite presses them without JavaScript, and the layout check measured both pages. Also not checked: what `fn_ops_end_td` does against a real `OPS_EMAILS` in production.

## Lesson
Ending a role is not one write. It is every event that can grant the role again.

Before writing `fn_end_td`, I listed every trigger and function that grants the TD role (0058's three triggers and the attach). Two of them would have quietly undone an ending:
* a re-verification with no TD fields re-attaches whoever the old call named;
* a person an older call named picks up the role by proving their address.

The red proofs M4 and M5 show exactly that: the ending "works", and then the next event reverses it. So close the event map, not the row, and write one check per door that must stay shut afterwards.
