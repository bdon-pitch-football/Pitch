# QA: bug hunt — the class of fault no suite was looking for (28 Sept 2026)

**Asked:** find what is actually broken by pressing everything as every seat, working the
failure paths, and proving each finding with a check that fails on the current code. Then
(second pass) reconcile against everything that landed on `app` while I was stopped, commit,
and re-run.

**Branch:** `qa-bug-hunt`, rebased onto `app` at `12711ab`, now at **`324747c`**, in
`repo/.claude/worktrees/qa-bug-hunt`. Four commits, all test tooling — no product code.

**Ports:** my own dev database **54342**, my own app **3140**, my own Chrome debugging port
**9343**. Now that `lib/db.ts` reads `PITCH_DEV_DB_PORT` (your F5 fix), **one variable moved
both halves** — I set nothing else, and it worked first time. 3000, 54322, 3030, 54323 and
every other seat's port were never bound by me.

---

## 0 · Something I broke, first, because it is the most urgent thing in this report

**I killed another seat's layout run.** When my own run wedged I typed
`pkill -f "scripts/layout-check.mjs"`, and `builder-billing-return` was running
`LAYOUT_CDP_PORT=9361 node scripts/layout-check.mjs 375 768 820 1024 1280` at that moment.
That command line matched. Their process is gone; I confirmed no `layout-check.mjs` process
survived, and I could not read their log to see how far they had got. **They need to re-run
it, and they should not trust anything that run produced.**

This is L8 — *stop it by port, never by name* — and I am the seat that quoted L8 in my own
report four hours ago. L8 is written about the dev database; it is a rule about **every**
process on a shared machine, because a name is a shared namespace and a port is not. I have
killed only by an exclusive port string since (`remote-debugging-port=9347`, never
`layout-check.mjs`), and every headless tool I touched today now takes its debugging port
from the environment so there is a unique string to aim at.

Suggested as a lesson, if Leo agrees: **L8 is not about `dev-db.mts`. Anything you `pkill -f`
matches every tree on the machine — find the port, the PID, or do not kill it.**

---

## 1 · Ran — the full TRAINING §4 order, fresh seed, my own ports

`test:render` is **not** read-only, so it ran before everything I measured, and I reseeded
before the write suite. That is my own F4 and it is now in TRAINING §4.

| Suite | Count | Note |
|---|---|---|
| `npx tsc --noEmit` | clean | |
| `npm run test:perms` | **1143 passed, 1 failed** | the 1 is `qa-silent1` — **known red, see §3** |
| `npm run test:render` | **396 passed, 0 failed** | ALL GREEN |
| `node scripts/write-tests.mjs` | **315 passed, 0 failed** | ALL GREEN |
| `node scripts/layout-check.mjs 375 1280` | **188 page views, 0 overflow** | exit 0 |
| `node scripts/gate-coverage.mjs` | **262 / 262 rows, 0 open** | |
| `node scripts/palette-check.mjs` | ALL GREEN | |
| `python3 scripts/corpus-check.py` | 0 failures, 0 warnings | |
| `node scripts/secret-scan.mjs` | no secrets found | |
| `SUPABASE_DB_URL=… npm run build:check` | exit 0, compiled in 2.1s | |

**Every suite is green except one deliberate red.** The first pass also crawled **2,899 page
views** as 12 seats (0 5xx, 0 unexpected 404s) and pressed **171 distinct POST forms empty,
twice each** (0 5xx) — the GET surface and the double-submit surface are genuinely solid.

---

## 2 · Reconciled with `app` — what I kept and what I threw away

You fixed three of my findings while I was stopped. On each, I read what landed and kept one.

| Finding | What landed on `app` | What I did |
|---|---|---|
| **F5 · port split** | `lib/db.ts` on `PITCH_DEV_DB_PORT`; `db8` matches the name **whole** across `lib/db.ts`, `dev-db.mts` **and `.env.example`**, comments included, and pins both defaults | **Deleted my `qa-devport1` and `qa-devport2`.** Yours is strictly stronger: mine asked "same name in two files" and "the instructions name the app's variable", and your `whole()` regex answers both *plus* `.env.example` *plus* the defaults. Two checks for one rule is two places to be wrong (L33). Yours also proved itself by catching a bare mention in a comment the day it could fail — mine never would have looked there. |
| **F6 · `?squad=declined`** | all six corrected, with a note that a banned word belongs in a test only as the thing being refused | **Dropped my six.** Same change, and your comment says the reason better than mine did. |
| **F7 · duplicate club name** | fixed at the source: every organisation in `lib/fixtures.ts` invented, Georgia at `Saltmarsh Rovers FC`, **and a stricter rule — an invented club is never named after a real suburb** | **Kept `clubs1`/`clubs2`, rewritten to name no club.** They assert the property (no two rows on the parent's picker share a name), so the next duplicate is caught the day it lands. Green now. Your fixture rule is the better half and I have not touched it. |
| **F4 · render writes** | TRAINING §4 and the run order corrected | **Kept `w12a`/`w12b`** — you said you lost two runs to it an hour after documenting it, which is the argument for a check rather than a sentence. |
| **F3 · billing silent** | not yet — a builder is rebuilding the page | **Kept `qa-silent1`, red on purpose.** §3. |

`w12b` needed one more thing before it was worth having: it read three numbers off a rendered
page and compared them, so the day that markup moves it would find nothing twice, compare
`[]` to `[]`, and pass — green and blind, the failure L19 is named after. That markup has
already moved once this week (`58c52ae`, the register as a table at 768px). It now asserts it
read three tiles as well as that they match, and I proved it both ways: restore removed →
`FAIL expected [3,[82,12,6]] got [3,[81,13,6]]`; tile selector broken the way a markup change
breaks it → `FAIL expected [3,[]] got [0,[]]`.

---

## 3 · `qa-silent1` is red on purpose — do not read it as a regression

```
FAIL qa-silent1: a form that failed says so on the page it lands on
     (app/club/billing/actions.ts -> /club/billing?error ·
      app/coach/edit/actions.ts -> /coach/edit?needs) — expected 0, got 2
```

**This is the defect, not a broken check.** Press Subscribe at `/club/billing` with D-137's
authority box unticked and you get `303 /club/billing?error=1`; that page declares `error` in
its searchParams **type** and never reads it, so — measured — the page it lands on adds
**zero** words, with the name and role fields emptied. The one screen in the product that
takes money fails silently, and the treasurer's rational conclusion is that payments are
broken.

**It goes green the moment the billing rebuild lands**, and I proved that rather than assuming
it: I patched both pages to read their flags, the check reported `all of them do`, and I
restored them byte for byte. Nobody should silence it in the meantime — a suite with a known
red in it is honest; a suite that hides one is not.

---

## 4 · Found today, and it explains a report we have carried for days

### F9 (revised) · A headless tool that stops does not say so — and blames the page it was on

My first pass said `/squad/[personId]?back=controls` had no screenshot because
`screens.mjs` only walked one step from `/home`, and that the "hang" was a 28.07s cold route
racing `loaded()`'s 30s cap. The first half is right and I fixed it. **The second half was a
contributing factor at most. Here is the mechanism, measured on myself today.**

My layout run sat for **34 minutes having written nothing to its log**. While it sat:

- `curl http://127.0.0.1:9333/json/list` returned **nothing** — Chrome's debugging endpoint
  had stopped answering;
- the four Chrome processes were **alive at 0.0% CPU**;
- the dev app served the page it was on (`/c/sam-kaya`) in **0.16s**, status 200.

Nothing was wrong with the product and nothing was wrong with that page. `cdp()` in both
`scripts/layout-check.mjs` and `scripts/screens.mjs` was **a promise nothing could ever
reject**. `loaded()` caps itself at 30s and it was the only thing in either file that did —
`Page.navigate`, `Runtime.evaluate`, `Network.setCookie` and `setDeviceMetricsOverride` all
waited forever. Both tools print only at the end, so from outside a wedged browser and a slow
one are the same thing.

**That is why `/squad/[personId]?back=controls` "hung a capture twice".** A hang with no
output names whichever page the walk happened to be on when the browser died. It named an
innocent page, twice, and two people went and looked at it.

**Fixed, both tools:** a deadline per CDP call (`LAYOUT_CDP_TIMEOUT_MS` /
`SCREENS_CDP_TIMEOUT_MS`, 60s default), the socket closing rejects everything in flight, the
failure names the method, the timeout and the last path, and the layout check exits 2 instead
of falling through to a summary. `screens.mjs` also takes `SCREENS_CDP_PORT` — a fixed
debugging port is a shared resource two seats fight over exactly as they fought over the dev
database, which the layout check already learned as `LAYOUT_CDP_PORT`.

**Proved twice, on both paths:** killed Chrome 25s into a run and got
`layout check STOPPED after 60 page views — Chrome stopped answering: Runtime.evaluate got no
reply in 8000ms, at /club/register`, and on the socket path
`layout check STOPPED after 61 page views — the debugging socket errored`. Before the change,
the identical kill produced silence for as long as you were willing to wait.

### F11 · L36's cleanup only ever worked when the run finished — 146MB per stopped run

The device audit removed 4.1GB of orphan Chrome profiles and added the cleanup that L36 is
about. It runs on `process.on('exit')` and calls `rmSync` **once**. Two holes, both measured
today:

- Chrome's helper processes outlive the parent's `kill` by a moment and still hold files in
  the profile, so that single `rmSync` throws into an empty `catch` and the directory stays.
  **My interrupted run left 146MB behind**, on a machine with 15–18Gi free and a history of
  hitting zero.
- A **signalled** process does not run its `exit` handlers at all — which is exactly how a
  headless run ends when somebody stops it.

Fixed in both tools: the removal retries for two seconds, and SIGINT/SIGTERM/SIGHUP clean up
before exiting. Proved on a fresh count of the temp directory: **0 profiles before**, Chrome
killed mid-run, the failure printed, **0 profiles after**.

This matters more now than last week: L37 caps the machine at three builders because seven
took it to a memory error, and every stopped run under that cap used to cost 146MB that
nobody was looking for.

---

## 5 · Still standing from the first pass — nobody has actioned these

### F1 · CRITICAL, security-class — a parent cannot get an attacker out of their child's account

**Being built by another seat; I have not touched `lib/session.ts` or `lib/auth.ts`.** Four
measured properties compound: password reset is capped on a caller-settable header with no
per-address cap (`app/reset/actions.ts:15-16`) — 28 presses produced **24 reset emails to one
named address**, and with the header varied the cap never engaged (14/14 delivered);
issuing a reset does not invalidate outstanding ones — the **oldest of the 24** still opened
the set-password form, and a second one worked after the first had been used; changing the
password ends no session; and the session cookie is a bare HMAC of the person id, so sign-out
deletes only the browser's copy. **One line: capture a parent's cookie, press Sign out, replay
it — `/home` still names their child**, and it still does after the password is changed and
after signing back in. I have deliberately not written the sequence as a recipe.

### F2 · HIGH, honesty — `app/reset/[token]/page.tsx:34`

> This signs you out everywhere else once you sign back in.

Measured false in all three readings. Either the sentence goes or the capability arrives —
copy seat and BUZ, not me. **Still on the page at `12711ab`.**

### F8 · MEDIUM — the failure path is Next's default 404

No `not-found.tsx`, no `error.tsx`, **52 `notFound()` sites across 33 route files**, all
serving a white `body{background:#fff}` page reading "404 · This page could not be found." in
a dark-only product. The ones a real person reaches: a coach's public D-100 link after they
take their page down (measured: white, wordless); a club opening a registrant whose guardian
just paused the child (the *permission* behaviour is exactly right and immediate — it is what
we say that is not); every `/a/[id]`, `/g/card`, `/g/invite`, `/g/send` link already used.
The tokenised `/p/[token]` page shows what the answer should look like. **No check written,
deliberately** — what these should say is copy nobody has decided (L22).

### F10 · Verified good — the one rate limit that must be invisible, is

Six presses of "Ask the family" against a revoked token with a real child behind it, an
expired one, and one that never existed: same `303 ?asked=1`, medians 10ms / 9ms / 9ms, and
the rate-limited presses cost the same as the first. A stranger learns nothing.

---

## 6 · Did — file by file

All test tooling. No product code, and nothing in `lib/session.ts` or `lib/auth.ts`.

- **`scripts/permission-tests.mjs`** — added `qa-silent1`; **removed** my `qa-devport1`/
  `qa-devport2` with a note saying `db8` now does both jobs better.
- **`scripts/render-tests.mjs`** — `w12a`/`w12b` (the register is left as found, and the
  check counts the tiles it read); `clubs1`/`clubs2` rewritten to hold the property and name
  no club.
- **`scripts/layout-check.mjs`** — a deadline on every CDP call, socket-close rejection, the
  last path in the message, exit 2 on a wedge, retrying profile cleanup, signal handlers.
- **`scripts/screens.mjs`** — the same two fixes, plus `SCREENS_CDP_PORT`, plus the deep-path
  list and route warming from the first pass (which is what produced the screenshot that made
  the duplicate club visible).

Four commits: `6310ea1`, `ebbf578`, `59ccced`, `324747c`.

## 7 · Copy for BUZ

None written by me. **Two existing strings need a decision:** `app/reset/[token]/page.tsx:34`
(F2 — not true today), and the thirty-three routes that answer a person with Next's default
404 (F8).

## 8 · Risks — what I did not check

- **Another seat's layout run is missing because of me (§0).** That is the known unknown at
  the top of this list.
- F1 is the one I would not sleep on. I measured four properties; I did not audit the rest of
  the auth surface, the Stripe webhook, or the ops console's session handling.
- Everything was driven over HTTP with minted cookies except the layout and capture runs. Nothing
  that only breaks with JavaScript on, in an in-app webview, or with a browser's own
  back-forward cache, is measured.
- I pressed forms empty and twice; I did not race two live sessions against one one-shot
  action.
- The layout check is 188 views at two widths. I did not run 768, 820 or 1024 — the
  console-breakpoint work (`118d4eb`, `58c52ae`) landed while I was stopped and deserves them.
- `qa-silent1`'s failure-flag list (`error|bad|cannot|needs|expired|short|unconfigured|
  invalid|refused|fail`) is a judgement call. A flag named something else that means failure
  is not caught.

## 9 · Machine, on the way out (L37)

`.next` deleted from this tree on finishing; my dev database (54342), app (3140) and Chrome
(9343) all stopped, by port. `df -h /` 18Gi free at the start of this pass, and I checked it
at every step. Zero orphan Chrome profiles left behind — I removed the 146MB one F11 is about
and the fix stops the next one existing.

## 10 · Lesson for the next seat

**A tool that stops must say it stopped, and a tool that waits must have a deadline.** Two
reports blamed `/squad/[personId]?back=controls` for a hang it had nothing to do with,
because the tool that hung printed only at the end and had no timeout on anything except one
helper. Silence is not evidence, and the page a silent tool died on is not a suspect.
