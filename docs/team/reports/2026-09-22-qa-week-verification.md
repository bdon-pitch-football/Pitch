# qa: full verification of `app` at bfbb405, and the week's new flows at 375px (2026-09-22)

Asked: run every TRAINING §4 suite from a fresh seed on `app` at bfbb405 (range 16a8f5f..bfbb405). Walk the squad, sign-up and preview flows as a user would at 375px. Add a regression check for any gap no test covers.

Did: changed tests only. No product code changed.
- `scripts/write-tests.mjs`: new block **0d** (line 1085) with checks **sqf0–sqf11** (12 checks). It walks both squad doors for an under-16 (Georgia), answered by her parent from `/g/controls/<childId>`, before the sweep's destructive blocks run. The block restores her state at the end: she leaves, and nothing later depends on it. Also added a `SKIP` line (line 1497) so that sq12b/sq13/sq14 say when they have not run. Before this change they passed or skipped without saying so (Found F2).
- `scripts/layout-check.mjs`: new `DEEP` list of pages more than one step from home. The list covers the family club picker (both steps, parent and player), one squad page (TD, TD `?pos=GK`, admin), a parent's u16 preview, and `/g/pending`. A deep page that redirects or 404s now **fails** as "never rendered, so never measured". It no longer passes in silence. 164 → 182 views.
- L20/L19 proofs (so these checks are shown to fail when the bug is there):
  - I put three bugs back in the product one at a time, then restored the files: the stranger check removed from `answerSquadInvitation`, `leaveSquad` made a no-op, and the home squad-invite card query emptied. sqf3, sqf4 and sqf11 each **failed** with the bug in place. `git diff --quiet app/` confirmed that `app/` matches HEAD after the restore. I reseeded and re-ran the block: back to 11/12.
  - sqf6 fails on today's code, which is the defect (F1). I could not show it passing on a fix, because no fix exists yet.
  - Layout: a page the seat cannot see → `FAIL … never rendered (landed on /home)`. A 444px min-width planted on the picker → `FAIL … page 410px wide on a 375px screen`, on both seats.

Ran: every run started from a fresh seed. I stopped the dev DB by port each time with `lsof -ti :54322 -sTCP:LISTEN` (L8). 54323 and 3030 were not running and were never touched.

| Suite | Run 1: HEAD as handed over | Final: HEAD + QA test changes |
|---|---|---|
| `npx tsc --noEmit` | 0 errors | 0 errors |
| `test:perms` | **967/967** | **967/967** |
| `test:render` | **369/369** | **369/369** |
| `write-tests` | **269/269**, 92/92 forms submitted | **280/281**: sqf6 fails. L7 re-run after a reseed: **280/281**, same failure |
| `layout-check 375 1280` | **164 views, 0 overflow** | **182 views, 0 overflow, 0 unrendered** |
| `gate-coverage` | **261/261** pinned, 0 open | 261/261 |
| `palette-check` | green: 14/14 colours, 175 files, 3 raw-hex infos | same |
| `corpus-check.py` | **4 failures** (S2, `docs/team/LESSONS.md`) | **8 failures**: the same 4, plus 4 in the uncommitted `reports/2026-09-22-copy-app-sweep.md` |
| `secret-scan` | no secrets | no secrets |
| `build:check` | exit 0, 22/22 static, 82 route lines. Also exit 0 from a cold cache | exit 0, 22/22, 82 |

**Working tree at test time:** bfbb405, plus changes from other seats that are not in the commit:
- modified: `next-env.d.ts` (generated), `LESSONS.md`, `SCORECARD.md`
- untracked: `docs/legal/34-…`, `scripts/apply-migrations.mjs`, `scripts/migration-on-data.mjs`, three reports and three reviews

**Browser walks:** real headless Chrome with real mouse clicks. 375px throughout; preview also at 1280. Every view was measured.
- A (family asks, club confirms), u16 and adult: 17 views, 0 overflow.
- B (club asks, parent accepts, club removes): 8 views, 0 overflow.
- C (`/join`): 16 views, 0 overflow.
- D (preview): 16 views, 0 overflow.

**`/join` in the browser (L10):**

| Case | Result |
|---|---|
| Adult coach | `/signin?joined=1`. Signs in to "Your coach page · 0 of 6 done" |
| Adult club person | `/signin?joined=1`. Signs in to "Welcome, Rowan" |
| Under-18 coach, under-18 club person | Continue disabled; the right amber notice shows |
| Server-side refusal: dob tampered to 2011 after the form approved an adult dob | `/join?coachAge=1` or `/join?clubAge=1`, and the refusal banner renders. The refused addresses cannot sign in |
| Existing address | `/signin?joined=1`, identical to a new one (D-94) |

Found:
- **F1: an under-16's club line never changes (new in 8ae11c2/79998a7; not in the safety or copy reports).** This is the flow Leo asked about, and it does not happen for an under-16.
  - *Repro:* fresh seed, Alex. On `/g/controls/<Georgia>`: **Leave** → **Add their club** → Riverside FC → **Ask them**. Marina then presses **Yes, they play here**.
  - The card now says "Riverside FC · MiniRoos U9 · 2026 · on their page".
  - But `/build/<Georgia>/preview` **and** `/p/dev-georgia` still say "Kingsway Rovers FC — U16 Girls · Altona VIC".
  - The result is the same when the club asks and the parent accepts, and after the club removes her. Every club holding her link still reads a club she has left, and that club's suburb.
  - For the adult (Jordan) the line changes correctly: Coburg → none → Riverside.
  - *Cause:* `app/build/[recordId]/preview/page.tsx:38-41` and the token read serve the u16's approved `profile_version`. The club is frozen into that version at approval (`scripts/dev-db.mts:390` says `lib/cv-build` does the same in production). `fn_join_squad` (`0052:137-153`), `leaveSquad` and `removeFromSquad` change only `membership`.
  - This contradicts D-158: a CV shows a current club only where a club has confirmed the player. It also contradicts the family copy at `components/SquadCard.tsx:70,81,93`: "on their page", "it shows on the page once they confirm it", "the page shows it".
  - *Needs a decision (it touches minors, so it is not mine to make):* what should a u16 page show when a club confirms? The check encodes the more restrictive half only: when she leaves or is removed, the old club comes off (sqf6, failing now). sqf8 guards that a future fix does not leave a removing club behind.
- **F2: the write suite's parent-answer path had never run in a full sweep (new in 8ae11c2).** An instrumented run showed `held []` at sq11: Alex's home lists none of his children by then. So sq13/sq14 were skipped and sq12b passed vacuously, and "269/269" included neither. Covered now by sqf3–sqf5 and the SKIP line.
- **F3: the layout check never measured `/squad/*`, `/club/squads/<id>`, a parent's u16 preview, or `/g/pending/*`.** An instrumented run listed every page it visits. Covered now (see Did).
- **F4: tap targets under 44px (CLAUDE.md: ≥44 at every width).**
  - The position filter chips on `/club/squads/<id>` render at 38px (`app/club/squads/[squadId]/page.tsx:128`, `minHeight: 36`; new in 6bc447e).
  - The parent's "Review the changes" is a 14px inline link wrapped over two lines (`app/build/[recordId]/preview/page.tsx:68`; new in 6ee7e6e). My first click on it landed in the gap between the two lines.
- **F5: `/join` refuses a coach or club person on their 18th birthday.** DOB 2008-09-22 → Continue disabled, and the notice says to wait "until you turn 18". `fn_age_band` says `18plus`. Cause: `app/join/page.tsx:38` divides by 365.25 days. The error only ever runs in the restrictive direction, so this is UX, not safety. The formula is pre-existing; the coach and club doors (b7ba029) are new places that reach it.
- **F6: corpus S2 is red at HEAD (new in bfbb405).** bfbb405^ and 16a8f5f are clean. The failures are the lesson datelines on L3, L10 and L14 and the date on line 122. They are on S2's dead-runway list. Leo to choose: reword the datelines, or give S2 a structural rule for a lesson dateline. The check's own notes warn against widening its exemption list.
- **F7: the "Ask someone from your register" list stops at 60 and gives no sign (`page.tsx:105`).** On the seed, every Riverside squad shows exactly 60 rows. Anyone later in the alphabet is reachable only through a position filter.
- **F8: confirmed by measurement; already reported by other seats.**
  - "we told them nothing by email" (copy): the outbox shows `doc15.§24.email → guardian@example.com` at the moment of the ask.
  - `back` open redirect (safety N2): a same-origin POST with `back=https://evil.example/phish` → `303 Location: https://evil.example/phish?squad=asked`.
  - `?done=declined` and `?squad=declined` put a banned word in the address bar (`actions.ts:80`, `app/squad/actions.ts:74`). This is related to copy B7.
- **F9: observations, product lane.**
  - A new club account lands on a home screen that offers "Build a coach CV" and has no route to "Claim your club", which `/join` told them was the next step.
  - The family picker offers every squad at a club, so a 22-year-old and a 15-year-old were both confirmed into "MiniRoos U9". The club's yes is the only check.
  - The seed has two verified "Kingsway Rovers FC" clubs. Georgia's fixture club has no staff seat, so a claim to her own club can never be confirmed in dev.

Copy for BUZ: none. Only test labels changed, and they are not product copy.

Risks:
- sqf6 has not been shown passing on a fix.
- Nothing ran on a real phone; headless Chrome emulated 375px.
- I did not walk the 16–17 self-claim path (safety B4) or a 16–17 answering their own invitation.
- The build passed with a placeholder database URL only.
- The corpus count depends on uncommitted files from other seats.
- The dev database is left freshly reseeded (pid at hand-off: 60404; app on 3000 answers 200).

Lesson: a check inside an `if` that never runs counts nothing and prints nothing. "269 passed" hid two squad checks that had never run in a full sweep. Every conditional check prints SKIP with a reason, or it is not a check.
