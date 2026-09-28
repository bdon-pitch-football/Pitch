# builder: final C — L40 green, analytics scoped, the token path limited, M6 stopped (29 Sept 2026)

**Tree:** `.claude/worktrees/builder-final-c`, branch `builder-final-c`, cut from `app` at `1ad803e`. `app` moved to `36b78a1` (round B) during the round and was **merged in, not rebased**; the merge was clean.
**Measured on:** `decb934` (the merged tree, every change in), from a fresh seed, in TRAINING §4 order. Timing ran on a freshly started app and a fresh seed.
**Ports:** database 54402, app 3200, Chrome CDP 9403. Stopped by port only. 9393 was checked idle before layout and timing. Dev-server output went to `.run/` inside my tree.
**Migrations:** none. Nothing here needed a schema change, so 0090 and up are untouched.
**Machine:** load 3.2–7.2 on 14 cores throughout (mostly BUZ's own apps); free disk 17–19 GiB. `.next` and `.next-check` deleted at the end; `node_modules` is back to its symlink (the runs used a `cp -al` hard-link copy). Run logs are in `.run/` in my tree (untracked, 1.3 MB).

Asked: brief C — make doc 14 L40 green (provider call out of the request, and a floor), mount Vercel Analytics on the public marketing surfaces only, rate-limit the token read path, and build M6 to doc 14 unless a decision keeps withdrawn rows (in which case stop). No new copy.

## Did

### 1 · L40 is green. Both remedies

**The provider call is out of the request.** `lib/messaging.ts` `send()` hands the provider call to `after()` from `next/server` (read in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`: it runs once the response has gone, including after `redirect()`).
* The outbox row is still written first, inside the request. If the instance dies before `after()` runs, the row was claimed with `attempts = 1`, and the outbox sweep picks it up 5 minutes later (`app/api/jobs/outbox`), as it does for a provider timeout.
* Nothing is awaited or thrown from `after()`. `dispatch()` records a failure on the row, and an escaping error could carry an address into the platform log (D-94 §1).
* **This is in `send()`, so it moves every send out of every request**, not only the CV path's. That covers the follow-up emails the brief names (§19 to the club, §21 receipt, §22 to a 16–17's guardians, the other guardian's undo). It also removes the same provider-latency signal from request-access (C6/C7), sign-in's new-device email and reset. I think that is right, but it is wider than the brief's words, so I am saying so.

**And a floor.** `lib/send-dispatch.ts` exports `SEND_ANSWER_FLOOR_MS = 120` and `answerNoSoonerThan(startedAt)`. Both send doors take the clock first thing (`app/send/[recordId]/actions.ts`, `app/g/send/[requestId]/actions.ts`). Every answer after the limit check (refused, real, and the fail-closed ones) waits for the floor, with nothing awaited between the floor and the redirect.
* **The number.** Measured inside the action, 118 real sends: median 5.4 ms, **p99 8.5 ms**, max 8.9. Refused: median 3.3 ms. A real send makes about 13 more database round trips than a refused one, and about 20 for a guardian's send with a second guardian. At a pessimistic 3 ms per production trip (Vercel to Supabase, Sydney to Sydney), that is 8.5 + 20 × 3 ≈ 70 ms. 120 ms leaves room. The comment carries all of this, and says the number only ever goes up.
* **A timer alone leaked.** With the floor as a plain `setTimeout`, L40 went red the *other* way (−0.57 ms, p 6e-6). Logging where the floor released showed why: 121.37 vs 121.66 ms median, 0.7 ms apart at p10. Node schedules timers off the event loop's cached clock, which is staler the more work the request did, so the real send woke earlier. The floor now wakes 3 ms short on the timer and finishes against `performance.now()` one `setImmediate` turn at a time. The two paths then release at 120.011 and 120.012 ms (median).
* **Timing suite:** `TIMING_ROWS=L40` (or any list) runs single rows for proofs, and says `PARTIAL RUN … not the gate` on its last line. Its header no longer says a real send calls the provider inline.

**Permission suite** (static; the timing suite cannot see a production-only provider call):
* `sendl1`–`sendl3` pinned the inline `await dispatch(`, so they had to change with the fix. They pin the same three rules where the call now lives: wired, after the row, production only. They were not deleted (L33).
* `lim-after1`: `send()` imports `after`, awaits no `dispatch(`, and calls it in exactly one place.
* `lim-floor1`: the floor is one constant, defined once.
* `lim-floor2`: the floor finishes against the real clock.
* `lim-floor3` (one per door): the clock starts before the first await, and every answer after the limit check waits for the floor with nothing awaited in between.

The floor block sits at the end of `lib/send-dispatch.ts`, because `L17c` takes the file's first `export async function` to be the dispatch.

### 2 · Vercel Analytics: four public pages, signed out, nowhere else

* `app/layout.tsx` no longer mounts `<Analytics />`. A comment says why, so nobody helpfully puts it back.
* `lib/analytics-scope.ts` holds the allowlist (`/`, `/trials`, `/jobs`, `/fc/<slug>`, exact) and `analyticsBeforeSend`. That hook drops any event whose page is off the list and trims the rest to their path (no query, no fragment). It is a belt: the injected script stays in the tab after a client-side navigation out of the page that mounted it (read in `@vercel/analytics/dist/next/index.mjs`).
* `components/PublicAnalyticsScript.tsx` (client) is the one place `@vercel/analytics` is imported, with `beforeSend={analyticsBeforeSend}`.
* `components/PublicAnalytics.tsx` (server) renders it **only when there is no session**. See Found 7: this is stricter than the brief.
* It is mounted by `app/page.tsx`, `app/trials/page.tsx`, `app/jobs/page.tsx` and `app/fc/[slug]/page.tsx`. After the merge it is also mounted by `app/front-door/page.tsx`, round B's front door, which `proxy.ts` serves at `/` once the launch-day switch is on. It renders no DOM and sits beside each page's root in a fragment (beside `CoachConsole` on `/jobs`, per L3).
* **Not on the list:** a coach CV (`/c/`, a CV), one job (`/jobs/<id>`, a signed-in coach's form), any print view, `/p/`, `/a/`, `/g/`, `/build/`, every signed-in page.
* Round B's fd0/fd4 still hash `/` to their pinned `2babb787…`, so putting an async component on the coming-soon page changed no byte of the served document.

**Checks:**
* **render `an-r1`–`an-r4`.** `get()` now records every page the render suite is served, and whether it carried the analytics component. A sweep adds 10 seats (signed out, parent, adult player, 16–17, under-16, coach, TD, club administrator, unverified club, brand new) × 36 routes across every family. Then **every** served page is judged: 1,088 pages, 249 distinct.
  * `an-r1`: served nowhere off the four, and to nobody signed in.
  * `an-r2`: served on each of the four, signed out.
  * `an-r3`: the crawl reached a rendered page in all 9 families (share link, guardian, approval link, CV being built, coach CV, player pages, club, coach and operator consoles).
  * `an-r4`: flips the front-door switch itself. The front door carries it signed out, and not for a parent or a TD.
  * The allowlist is written out in the test, not imported, so a wrong list in the code cannot make the test agree with it.
* **layout.** Every view reads `window.va` (which the package defines when it injects) or the injected script, in real Chrome. Analytics must be off on every view except a signed-out, public, rendered one, and on there. "Signed out" is read from the session cookie, not the seat's name, because round B's front-door pass is signed out under its own label. `/` and `/jobs` are read once at 1280 for this alone.
* **perms `an-p1`–`an-p6`:**
  * `an-p1`: the root layout mounts nothing.
  * `an-p2`: one importer of the package, and it passes the belt.
  * `an-p3`: one mounting component, used by exactly the five page files at four addresses.
  * `an-p4`: the component renders nothing for a session.
  * `an-p5`: an allowlist truth table, 4 in and 16 out.
  * `an-p6`: the belt drops `/p/…` and `/g/…?link=…` and trims `/trials?age=U12#top`.

### 3 · The token read path is rate limited

`lib/record-read.ts`, the one path, and nothing else:
* **`TOKEN_READ_LIMITS = { perLink: 300, perAddress: 600, windowSeconds: 3600 }`**, with the reasoning above it.
  * Per link: the busiest plausible hour for one link is a team group chat of 25 families plus a club forwarding plus grandparents, about 60–100 opens. 300 is three times that.
  * Per address: a club office opening 60 CVs in trial week, or a school's shared connection, about 100. 600 an hour.
  * The one case the address limit could reach a family is carrier-grade NAT. At our size that is remote, and the number goes up before it bites.
  * Both are counted with the existing `lib/ratelimit-db` `checkRate` (keys hashed). Both are counted on every read, in the same order, whichever one bites.
* **A refusal is the D-77 dead-link page.** It returns the same `null` as every dead state, after the same query a never-existed link makes: `fn_token_read` against `randomBytes(32)`, a hash nothing can match. A refused read of a live link and a refused read of nothing therefore take the same time and say nothing about existence. There is no header, no status and no counter.
* **One answer per request** (`react` `cache()`). The CV page reads the token for its title and again for its body (deliberately, per its own comment). The limit decision is shared, so the two always agree and a view counts once.
* **The IP** is the first `x-forwarded-for` value, as sign-in, reset, join and report already take it (see Risks).
* **`app/dev/ratelimit/route.ts`** empties the counters for the timing suite. It is gated exactly as `/dev/billing` is (404 in production and in a demo, POST only), and `dev2` pins that.

**Timing:**
* **E10** clears the counters every 50 rounds, untimed, so it keeps measuring the dead links and not the limit. Unchanged otherwise.
* **New row `tok-rl`, E10's method:** arms in the same rounds, fresh order each round, against a never-existed link, with the row's own resolution proof.
  * **Setup pins the boundary exactly:** a link's read 300 is served and read 301 refused. An address's read 600 is served and read 601 refused, while the same link stays live from any other address.
  * **The arms:** a live link past its own limit; a second live link from an address past its limit; a never-existed string from that address.
  * **`tok-rl b`:** every refused read is byte-identical to a never-existed link (nonce and token aside).
  * The suite plays many addresses with its own `X-Forwarded-For`. Next keeps an incoming one (`base-server.js`: `??=`).
  * Not labelled with a doc 14 row id (L4): no row words this. CLAUDE.md §2 asks for the limit and D-77 for the answer.

**Permission suite:**
* `tok-p1`: the numbers live in one constant in the one path, and nothing else counts token reads.
* `tok-p2`: a refusal still reaches the one `fn_token_read`, with nothing returned before it. Both limits are counted adjacently every time, and the decision is `cache()`d.

### 4 · M6 — **stopped. A decision keeps withdrawn rows**

The brief says to stop if the register or doc 14 keeps withdrawn rows. They do, in three places, and a fourth thing depends on them:

1. **D-128 (Locked):** *"On revocation or deletion, the registration row **renders as withdrawn** and the note field is emptied, in the same database transaction."* Its retention clause runs the row's deletion on a clock: *"a registration row deletes 90 days after the trial date."*
2. **Doc 14 N7:** *"Assert `note` is empty and **the row renders withdrawn**, atomically."* N9 asserts the club reads an empty note *after withdrawal*, which presumes a row to read.
3. **Doc 34 rule 6, built as `fn_register_readers` (0047) and shown in `components/RegisterReaders.tsx`:** the family sees each registration they made and who at the club read it, with *"Registered <date> · taken off since"* for a withdrawn one. `register_read_log.registration_id` is `on delete cascade` (0037). **Deleting the row would delete the family's record of who read their child's registration.**
4. `invitation.registration_id` references `registration` with no `ON DELETE`. A delete would fail wherever an invitation exists. That cannot happen for a held registration (P12), but it can for a live one.

M6's own words are scoped to **held** registrations: *"A family withdraws while a registration is held — the row is removed and the count decrements."* Read that way it does not contradict D-128, which is about registrations a club could read. But D-128 carries no such carve-out, and the product today treats both the same. Reconciling them is a product decision, so I built nothing. **What the code does today, measured:** a withdrawn registration leaves every club-side read (`withdrawn_at is null` on every count and list). J61 is green in time and in bytes, and the held count decrements. Only "the row is removed" is unmet.

**Options for Leo and BUZ (and John, on retention):**
* **(a) Split by what the club could read.** A withdrawal while the club is unverified or suspended deletes the row (M6). A withdrawal of a registration a verified club could read keeps it, withdrawn and emptied (D-128, N7), with the family's read history intact. It needs a line in D-128, and an answer for a club verified *after* a held withdrawal (nothing to show: the row is gone).
* **(b) Amend M6 to what is built:** "the row becomes unreadable to the club, and the count decrements". J61 already asserts the part a club could observe.
* **(c) Delete on every withdrawal.** This contradicts D-128 and N7 as written. It destroys the family's doc 34 rule 6 history (the cascade), and fails on any registration with an invitation.

**A related gap, whichever option:** `fn_purge_past_trials` (0024) deletes only rows with `trial_on` set. A withdrawn registration to the **year-round register** (no trial date) is never deleted. It holds the child's name, position and squad target, with the note emptied, for good. D-128's retention clause does not say what clock that row is on.

## Ran

From a fresh seed on `decb934`, in TRAINING §4 order (reseed → perms → render → write → reseed → layout → timing → reseed), app restarted fresh before timing.

| Check | Result |
|---|---|
| perms | **1634/1634**. That is 1620 on `app` after round B, plus 14 new: lim-after1, lim-floor1, lim-floor2, lim-floor3 ×2 doors (5), an-p1–6 (6), dev2, tok-p1 and tok-p2 (3). sendl1–3 were replaced in place |
| render | **570/570** (566 on `app`, plus an-r1–r4) |
| write | **393/393** |
| layout, 375 and 1280 | **206 views, ALL GREEN**, CSP included. Analytics started in exactly 16 views: signed-out `/trials` and `/fc/riverside-fc` at both widths, round B's 5 front-door views at both widths, `/` and `/jobs` |
| timing | **15/15, ALL GREEN** on the second full run. The first full run was 14/15: J61 was INCONCLUSIVE at 1.02 ms resolution on `/home` (shifts +0.09 and +0.05 ms, nothing distinguishable), with BUZ's Chrome, TIDAL and macOS media analysis busy (load about 6). J61 reads club pages this round did not touch. Restarted the app, reseeded, and re-ran every row |
| tsc | clean |
| palette | ALL GREEN |
| corpus | 0 failures, 0 warnings |
| gate-coverage | 263/263 pinned, 0 open (unchanged: no new check claims a doc 14 row id, per L4) |
| secret-scan | no secrets |
| validate-migrations | ALL GREEN (no new migrations) |
| `build:check` | green (89 routes) |
| `test:csp-prod` | 5/5, on port 3200 with my dev app stopped; it stopped its own server |

**Timing, per row,** second full run, fresh app and fresh seed:

| Row | Result |
|---|---|
| **E10** | 300 rounds × 5 states, medians 29.76–29.87 ms. Largest shift −0.10 ms (p 0.27). **Resolution 0.55 ms.** PASS. E10b: identical bytes |
| **tok-rl** | Setup exact at 300/301 and 600/601. 300 rounds × 4 arms, medians 29.54–29.64 ms. Largest shift −0.08 ms (p 0.33). **Resolution 0.51 ms.** PASS. tok-rl b: identical bytes |
| **L40** | 108 against 108. Refused median 127.48 ms, real 127.36 ms. **−0.04 ms, p 0.65. Resolution 0.59 ms.** PASS (was +2.36 ms, p < 1e-10 on `app`). L40b: one response shape |
| **J61** | 700 and 800 rounds, each held page against its twin. Shifts −0.20 and +0.10 ms (p 0.18, 0.45). **Resolution 0.90/0.94 ms.** PASS. J61b: identical bytes |

The first full run agreed on every row it resolved: E10 at 0.66 ms, tok-rl at 0.55 ms, L40 +0.05 ms (p 0.57) at 0.63 ms.

### How each new check was proved red (L19/L20)

| Check | Bug put back | Result |
|---|---|---|
| L40 | no floor, provider already in `after()` | real **+1.99 ms**, p ≈ 0, resolution 0.66 ms: FAIL |
| L40 | the inline provider call back, 200 ms standing in for Resend (development never calls one) | **+86.54 ms**: FAIL. The same 200 ms inside `after()`: −0.43 ms, not distinguishable: the response does not wait for it |
| L40 | the floor as a plain `setTimeout` | **−0.57 ms**, p 6e-6: FAIL (the finding above) |
| sendl1–3, lim-after1 | `await dispatch(` inline again | 4 FAIL |
| lim-floor1 | a second floor constant in the guardian door | FAIL |
| lim-floor2 | timer-only floor | FAIL |
| lim-floor3 | player door: refused send answers without the floor · guardian door: `await` between floor and redirect · clock started after the session lookup | FAIL, each |
| an-p1, an-p2 | `<Analytics />` back in the root layout | 2 FAIL |
| an-p2 | mounted without `beforeSend` | FAIL |
| an-p3 | a coach CV imports it | FAIL |
| an-p4 | mounted for a session too | FAIL |
| an-p5, an-p6 | allowlist widened to `/p/` | 2 FAIL |
| an-p6 | belt keeps the query string | FAIL |
| an-r1 | `<Analytics />` back in the root layout | FAIL, naming `/g/controls/…`, `/p/dev-…`, `/build/…` and more |
| an-r2 | `/jobs` without its mount | FAIL (`/jobs`) |
| an-r3 | a family no page matches | FAIL |
| an-r4 | the front door without its mount | FAIL |
| layout analytics | `<Analytics />` back in the root layout, at 1280 | 94 of 98 views FAIL. After the cookie change, re-proved: 95 of 104 FAIL |
| dev2 | the reset route without its production gate | FAIL |
| tok-p1 | a second copy of a limit in `app/p/[token]/page.tsx` | FAIL |
| tok-p2 | refusal returns before the lookup · the address not counted when the link is refused | FAIL, each (the second passed at first: my regex allowed code between the two counts. Tightened, then red) |
| tok-rl | **P1** limit checked after the read (a refused live link still reads and builds its CV, then hides it) | live arms **+1.96 / +2.34 ms** FAIL, and `tok-rl b` FAIL (bytes differ) |
| tok-rl | **P2** a refusal that errors instead of the dead-link page | `tok-rl b` FAIL, all arms +1.9–2.2 ms FAIL |
| tok-rl setup | **P3** one page view counted twice (no `cache()`) | setup FAIL at the boundary |
| tok-rl | **P4** no limit at all | setup FAIL, `tok-rl b` FAIL, live arms +9.9 / +8.3 ms FAIL |

## Found

1. **The guardian's send door puts the raw share token in the redirect only when the send was real** (`app/g/send/[requestId]/actions.ts:57`, `?sent=1&link=${done.raw}`). The page body is identical in production, but the `Location` header differs between a refused and a real send. The URL the guardian lands on therefore shows whether the limit bit (L38 "same headers", L42). A live token also sits in the address bar and history. `L40b` measures the player's door only, so nothing caught it. Not fixed: outside the brief, and the page's dev-only link display depends on it. Options: drop `link` from the redirect and show the dev link another way, or give the refused path an equivalent parameter.
2. **The request-access action reads `share_token` directly** (`app/p/[token]/request/actions.ts`, selecting the child's first name for the email). CLAUDE.md D-80 says the request-access handler calls the one read path. It also does two more queries for a live token than for a dead one. After item 1 its email no longer waits for the provider, but I did not measure its timing (C6/C7). Not mine to change.
3. **M6's rows:** see Did 4. A decision exists, so I stopped. There is also the year-round-register retention gap.
4. **LESSONS.md skips L35 and L36** (L34 then L37). Cosmetic, but a lesson reference to either would point at nothing.
5. **`app/api/webhooks/sms/route.ts:77` still dispatches inline** (the reply to an inbound STOP/HELP). It is a provider webhook, not a surface a stranger times, so I left it.
6. **Round B's layout pass labels its signed-out views "front door".** My analytics belt first read that as a signed-in seat. It now reads the cookie. Anything else keyed on seat names in that script may have the same blind spot.
7. **A choice I made that the brief did not:** analytics runs on the four pages **only for a visitor with no session**. A signed-in visitor on `/trials` may be a child we know is a child, and pillar zero 5 allows no analytics event on a minor. The cost: signed-in adults are not counted on those pages. BUZ may want signed-in adults counted. That would need an age check in `components/PublicAnalytics.tsx`, which I did not build.

## Copy for BUZ

None. No user-visible string was added or changed. A rate-limited read shows the existing D-77 dead-link page.

## Risks

* **The floor's production number is reasoned, not measured.** 120 ms comes from a local p99 of 8.5 ms plus arithmetic about production round trips. If production's real path ever runs past 120 ms, the part past the floor is visible again. The provider is no longer in it, so only database work can push it there.
* **`after()` on Vercel** runs under `waitUntil` within the function's max duration. A provider slower than that is cut off, and the sweep resends within 5 minutes: a delayed approval email in the worst case. `after()` throws outside a request scope. Every current `send()` caller is inside one, but a future script or job calling `send()` outside Next would throw.
* **The per-address limit trusts the first `X-Forwarded-For`,** as every existing limiter here does. On Vercel the platform sets it. Anywhere else (`next start` exposed directly) it is the client's to choose.
* **A social platform's crawler** fetching preview cards for many links from one address could meet the 600/hour limit and cache the generic card. At our size that is unlikely, but a cached generic card outlives the hour.
* **The render suite's analytics marker is the module's name in the dev payload.** A production build hashes it. The layout check (`window.va`) and `an-p*` cover what that cannot. Nothing has seen the production script path `/_vercel/insights/`, because analytics is off in the dashboard and must stay so until BUZ says.
* **Local timing is local.** E10, `tok-rl`, L40 and J61 resolve 0.3–0.9 ms on `next dev` with a sub-millisecond database. They say nothing about production's resolution.
* **Not checked:** a real provider in `after()` (no keys); iOS or Android in-app browsers; the guardian door's timing (L40 measures the player's door; both share the floor and `lim-floor3` pins both).

## Lesson

**A floor built on a timer leaks the work done before it.** Node schedules `setTimeout` off the event loop's cached clock. A request that did more work before asking is scheduled from a staler clock, so it wakes earlier, here by 0.3–0.7 ms, which the suite could see. "Wait until T" has to be checked against the real clock at the end.

*Rule:* when you equalise two paths by waiting, measure where the wait **ends** on each path, not only the response times. Log `performance.now() - start` after the wait on both paths, and compare them before trusting the timing suite's verdict.
