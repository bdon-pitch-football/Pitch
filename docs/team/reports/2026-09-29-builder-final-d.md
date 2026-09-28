# builder: final D — request-access through the one read path, one address after a send, held withdrawals removed (29 Sept 2026)

**Tree:** `.claude/worktrees/builder-final-d`, branch `builder-final-d`, cut from `app` at `f46831e`. `app` did not move during the round.
**Measured on:** `8cad304` (every change in), from a fresh seed, in TRAINING §4 order. Timing ran on a freshly started app and a fresh seed.
**Ports:** database 54412, app 3210, Chrome CDP 9413 (checked idle before layout). Stopped by port only. Dev-server and suite output went to `.run/` inside my tree (untracked).
**Migrations:** one, `0095_held_withdrawal_is_removed.sql`.
**Machine:** load 5.0–9.0 on 14 cores; timing started at 7.9 and ran at 6.7–7.5. Free disk went from 19 GiB to 11 GiB during the round. My tree's share of that was 1.3 GB of `.next`; the rest was elsewhere. `.next` and `.next-check` are deleted, and `node_modules` is back to its symlink. The runs used a `cp -al` hard-link copy.

Asked: brief D. (1) Request-access through `lib/record-read`, with one floor on every path, a static check that nothing else reads `share_token` by hash, and a timing row. (2) The guardian's send redirects to `?sent=1` on both paths, the dev link block goes, and a crawl check covers it. (3) Doc 14 M6: a held withdrawal deletes the row, and a readable one is unchanged. No new copy.

## Did

### 1 · Request-access goes through the one read path (D-80, D-77)

**`lib/record-read.ts`: new `resolveTokenForNotice(rawToken)`.**
* It returns only `{ tokenId, firstName, guardianEmail }`, for a live or a dead token.
* It runs **one query of one shape** for every token. The query starts from the hash (`from (select $1::bytea as token_hash) asked left join share_token …`), so a string that was never a link gets one row of nulls from the same statement a real token gets its row from.
* An absurd string (over 200 characters) is looked up as `randomBytes(32)` rather than answered without a query.
* It selects nothing from the record: the id, the child's first name, and one approved guardian's email.
* It is not counted against `TOKEN_READ_LIMITS`, because it reads no record. The request has its own limit, one per token per day.

**`app/p/[token]/request/actions.ts`, rewritten.**
* The clock starts first.
* The request itself is `askOnce()`: resolve, `fn_access_request_allowed`, insert, `send()`. It returns `Promise<void>`, so the answer has nothing to branch on.
* The action then does `await answerNoSoonerThan(startedAt)` (reused from `lib/send-dispatch`, not a second floor) and makes its **one** `redirect(`/p/${token}?asked=…`)`.
* Never existed, dead, held (C7) and sent all answer at the same moment. The blank-field `asked=0` path also waits for the floor, so that every redirect in the file sits behind it.
* The file no longer names `share_token`, `token_hash` or `createHash`.

**The one other reader, named and kept.** `app/ops/reports/page.tsx` and `app/ops/reports/actions.ts` are the operator's report desk (doc 32 A1).
* A player-page report stores the hex of the link's hash, never the token. The desk resolves it to a `record_id` to put a hold on the page.
* It is operator-only, selects no field of the record (D-79), and only ever takes access away.
* I left it where it is rather than put operator tooling into the stranger's read path. `tok-one1` names both files.

### 2 · The address bar after a send (L38/L42)

* **`app/g/send/[requestId]/actions.ts`:** both paths now `redirect(`/g/send/${requestId}?sent=1`)`. The comment says why, and says that `/dev/outbox` carries the link.
* **`app/g/send/[requestId]/page.tsx`:** the development-only link panel is removed, and `searchParams` is `{ sent?: string }` only.
* **`scripts/token-in-url.mjs` (new), loaded by the render and write suites.** It wraps `fetch` for the whole run and records two things for every same-site response:
  * any `Location` whose query string or fragment carries a token, and any `Location` to a `/p/` page other than the one that was POSTed from (request-access sends the requester back to the page they are on);
  * any `href`, `action` or `src` in a served page (not `/dev/*`) whose query string or fragment carries a token.
* **How it recognises a token.** It matches by the shape the product mints: 24–64 base64url characters, including an upper-case letter or an underscore. A random 32-character token lacks both about once in 40 million. No slug, uuid or hex hash has either. The suites cannot ask the database which strings are live links, because the dev database serves one connection and the app holds it.
* **Three named exceptions** (`SHOWN_ONCE`). They are not waved through; see Found 1.

### 3 · Doc 14 M6: held withdrawals are removed (round C's option a)

**`0095_held_withdrawal_is_removed.sql`.** The header cites doc 14 M6, D-126, D-128 and brief D.

**`fn_registration_held_unread(registration)` answers "could any club ever have read this row?"** It is true only when all of these hold:
* the club is not verified now;
* there has **never** been a `verification_call` with outcome `verified` for the club;
* no reader is on record in `register_read_log`;
* no invitation exists for the registration.

**Why the call history and not the state:** `club_state` says what the club is now. A club that was verified and is now suspended may have read the row before. The doubt goes to keeping the row, which is D-128's answer and the one that loses nothing.

**`fn_withdraw_registration`** has the same authorisation as before. It then locks the club row (`for share`), so a verification cannot commit between the test and the delete. After that:
* **held:** it clears `registration_request.registration_id` (the child's request, which a guardian's send points at; without this the foreign key refuses the delete) and **deletes the row**. The count goes down with it.
* **readable:** unchanged: `withdrawn_at = now(), note = null`. The row stays, and the family keeps its record of who read it (`fn_register_readers`, doc 34 rule 6).

**Nothing is left on the club side.**
* Ids are uuids, so there is no sequence to show a gap.
* No club-side timestamp moves. Checked: `club_state`, `verified_call_id`, `subscription_status`, `current_period_end`, `grace_until` and the club's rows are unchanged.
* The one place that still names the id is the family's `registration_withdrawn` consent event (append-only, 0025). No page under `app/club`, `app/coach` or `app/fc` reads `consent_event`.

**J61 now measures this.** Its fixture withdraws at Sunbury United, which the seed never verified, so in this run the row was deleted and J61 passed on the deletion.

### Checks added and changed

**Permission suite: +15, three replaced in place (L33).**

Request-access:
* `C7b` now asks the new shape: one redirect in the file, none in `askOnce`, which returns `Promise<void>` and returns no value. Until 29 Sep it counted three `redirect(done)`.
* `req-floor1`: the clock starts first, the floor sits before the one redirect, and nothing is awaited between them.
* `req-read1`: the handler resolves through `lib/record-read` and never names `share_token`, `token_hash` or `createHash`.

The one reader of `share_token` by hash:
* `tok-one1`: nothing outside `lib/record-read.ts` does it, except the two report-desk files. The check carries a self-test: it catches three shapes the product could write, and passes the undo page's near miss and an insert.
* `tok-one2`: the notice lookup runs one query, returns nothing before it, starts from the hash and left-joins, never skips the query for an absurd string, and selects nothing off `development_record`.

The address bar:
* `addr1`: both `?sent=1` redirects are identical, and no redirect names `raw`, `link` or `token`.
* `L38b` replaced its proxy (the dev panel is off in production) with the rule: the page reads only `sent`, and has no branch by environment.

Withdrawals:
* The old `M6`/`M6b` withdrew a registration that M5 had already made readable, so they were relabelled `D-128`/`D-128b` (L4).
* New `M6` ×9: setup; the answer is yes; the row is removed; the count decrements; nothing in the database names it but the family's consent log, which no club page reads; every other club-side answer is unchanged; a guardian-sent one goes too and the child's request no longer points at it; a club verified afterwards is released only the one that stayed; and a truth table of what counts as held (7 cases).
* New `D-128`: a readable one keeps its row, withdrawn, note empty, reader on record.

**Render suite: +1.** `addr-r1`: the crawl met no token in any `Location` or link query. It watched 1,089 pages and 98 redirects.

**Write suite: +4.**
* `addr-w1` setup: the parent pressed send 12 times and the outbox shows some went and some were held.
* `addr-w1`: a real send and a limited one answer byte for byte alike: status, `Location`, body and every header value, with the request's own id and the date aside.
* `addr-w2`: both land on exactly `/g/send/<request>?sent=1`.
* `addr-w3`: across the whole write crawl (1,169 pages, 447 redirects), no token was met outside the 3 named shown-once doors, which it saw 4 times.

**Timing suite: new row `req-t`, E10's method, +4 checks.**
* **Five arms:** never a link; a dead link, first request (sent); a live link, first request (sent); a dead link already asked today (held); a live link already asked today (held).
* Each round the parent replaces Deniz's link twice, untimed. The first new link is renewed away by the second, which gives a fresh dead link and a fresh live one, neither of them asked. The held arms use `dev-expired` and `dev-jordan`, asked once in setup.
* **Setup, proved.** A replaced pair is one dead link and one live one. Named requesters show that a first request on each reached the guardian's outbox and a second did not.
* `req-t b`: one response shape across every path.
* Not labelled with a doc 14 row id (L4).

## Ran

From a fresh seed on `8cad304`: reseed → perms → render → write → reseed → layout → reseed, fresh app → timing → reseed.

| Check | Result |
|---|---|
| perms | **1649/1649** (1634 on `app` + 15 new; C7b, L38b and D-128/D-128b changed in place) |
| render | **571/571** (570 + addr-r1) |
| write | **397/397** (393 + addr-w1 setup, addr-w1, addr-w2, addr-w3) |
| layout, 375 and 1280 | **206 views, ALL GREEN**, CSP included; analytics started in 16, as on `app` |
| timing | **19/19, ALL GREEN** (15 + req-t ×4), first full run, no row inconclusive |
| tsc | clean |
| palette | ALL GREEN |
| corpus | 0 failures, 0 warnings |
| gate-coverage | 263/263 pinned, 0 open |
| secret-scan | no secrets |
| validate-migrations | ALL GREEN (0095 included) |
| `build:check` | green, 89 routes |
| `test:csp-prod` | 5/5, port 3210, my dev app stopped |

**Timing, per row:**

| Row | Result |
|---|---|
| **E10** | 300 rounds × 5 states, medians 29.80–30.02 ms. Largest shift −0.09 ms (p 0.37). **Resolution 0.63 ms.** PASS. E10b: identical bytes |
| **tok-rl** | Boundary exact at 300/301 and 600/601. Medians 29.75–29.85 ms. Largest shift −0.10 ms (p 0.27). **Resolution 0.51 ms.** PASS |
| **req-t** | 300 rounds × 5 arms, medians 126.87–127.03 ms. Largest shift +0.10 ms (p 0.077). **Resolution 0.39 ms.** PASS. req-t b: one shape |
| **L40** | 108 against 108, medians 126.99 / 126.96 ms. +0.03 ms, p 0.73. **Resolution 0.59 ms.** PASS |
| **J61** | 700 and 900 rounds. Shifts −0.03 and −0.01 ms. **Resolution 0.94/0.70 ms.** PASS. J61b: identical bytes |

### How each new check was proved red (L19/L20)

| Check | Bug put back | Result |
|---|---|---|
| M6 | 0095's withdrawal body back to the old `update … withdrawn_at` (helper kept) | 3 FAIL: row still there (1); the id still in `registration`; the guardian-sent row still there and still pointed at |
| M6 held truth table | "held" decided by `club_state <> 'verified'` alone (round C's option a as worded, which included suspended) | FAIL: suspended-after-verification and a logged verified call both read as held |
| C7b, req-floor1, req-read1, tok-one1 | the old request-access handler (`git show HEAD:`) | 4 FAIL. tok-one1 named `app/p/[token]/request/actions.ts` |
| tok-one2 | the notice lookup returns early for an absurd string | FAIL |
| addr1, L38b | the old guardian door and page (`&link=${done.raw}`, the dev panel) | 2 FAIL |
| addr-w1, addr-w2, addr-w3 | `&link=${done.raw}` back in the guardian door, from a fresh seed | 3 FAIL: 8 shapes not 1; 7 addresses carry `&link=…`; the watcher names every `POST /g/send/… → Location …&link=…` |
| addr-r1 | planted: `/g/send/bogus` redirects to `/home?link=<32 chars>`, and `/trials` carries a hidden link to `/trials?ref=<32 chars>` | FAIL, naming both |
| req-t | **P1** the old handler | sent arms **+0.83 / +0.79 ms**, held **+0.27 / +0.27 ms**, all p < 1e-5 at 0.35 ms resolution: FAIL |
| req-t | **P2** the new handler with the floor removed (one-shape lookup kept) | sent **+0.85 / +0.83 ms**, held **+0.20 / +0.22 ms**: FAIL. See Lesson |
| req-t b | held path redirects to `?asked=1&again=1` | FAIL (2 shapes); the timing check FAIL too (−118.8 ms) |

## Found

1. **Three more doors put a live share token in the address bar.** My crawl check would have been red on all three, so they are named exceptions in `scripts/token-in-url.mjs` `SHOWN_ONCE` rather than silently allowed:
   * `app/g/controls/[childId]/actions.ts` (`replaceLink` and issue: `?link=<raw>`);
   * `app/g/pending/[recordId]/actions.ts` (`?done=1&link=<raw>`);
   * `app/send/[recordId]/actions.ts` `freshLink` (`?link=<raw>#links`).

   Each shows a new link **once**. Tokens are stored hashed (D-80), so the address is the page's only way to learn it. None is a limit oracle (nothing is refused on those paths). Referrer leakage is limited: the default policy is `strict-origin-when-cross-origin`, and `/p/` pages send none. **But the token does sit in history, browser sync and any screenshot of the address bar.** This is Leo's to decide.

   Options:
   * (a) keep them, as the check now records;
   * (b) carry the link in a short-lived, httpOnly, path-scoped cookie the page reads. It cannot be cleared from a render in this Next, so it would need a route handler;
   * (c) a one-time reveal row keyed by a random id. That means holding the raw token server-side briefly, which cuts against D-80's "stored hashed".

   The timing suite's `req-t` and E10, and the write suite's `pl-i` and `ks-w0`, read the new token from these addresses. Changing the doors means changing those fixtures (L32).
2. **What the family sees after a held withdrawal.** The row is gone, so `fn_register_readers` no longer lists it. Before, the family's own list said "Registered <date> · taken off since". The consent log keeps `registration_withdrawn`. That is the direct consequence of "the row is removed". Whether a family should still see a line for a registration no club ever saw is BUZ's (and possibly John's) call. I built nothing extra.
3. **The child's own line outlives any withdrawal on the family side.** `registration_request.note` stays on a request a guardian sent, for held and readable withdrawals alike. No club reads that table, so D-128's "nothing readable survives" still holds for clubs. **Separately, `/g/interest/<requestId>` keeps saying "<name> is on <club>'s register"** after either kind of withdrawal. That is stale copy (L25) and out of my lane.
4. **D-128's register text does not yet carry the held carve-out.** It still reads "on revocation or deletion, the registration row renders as withdrawn". It needs a line recording option (a), in both register copies. That is Leo's lane.
5. **A choice stricter than round C's option (a) as worded.** Round C wrote "unverified or suspended deletes the row". Following the brief ("a club nobody has verified yet"), a club that was verified and is now suspended **keeps** the row, because it may have read it. The truth table pins this.
6. **Request-access is limited per token only.** CLAUDE.md §2 asks every unauthenticated endpoint, the request-access affordance included, to lock out on a single IP too. I did not build that.
7. **A failure inside `askOnce` is an oracle while it lasts.** A database or outbox error throws only for a token that resolved, and answers a 500 where a never-existed token gets the redirect. The two send doors behave the same way. I left it, because swallowing errors in a path that emails a guardian hides failures.
8. **Test fixture note.** The permission suite's `recordTd` logs a **verified** call even for a club it leaves unverified. Under 0095 such a club's rows are therefore not held, and the M-section's "Held FC" is one. The M6 block uses a club with an administrator and no `recordTd`, and says why.

## Copy for BUZ

None added. **Removed**, development-only, never rendered in production: "The link that went — dev only, email sending arrives with Resend", and the `pitchfootball.com.au/p/<token>` line under it, on the guardian's "Sent" page.

## Risks

* **Deletion is final.** A family that takes a held registration off and registers again starts fresh, and there is nothing to restore. That is M6's intent.
* **"Held" reads `verification_call` history.** If calls were ever deleted or rewritten, a once-verified club could read as never verified. Nothing in the product deletes them today; I did not check for a database-level guard.
* **The floor's production margin is reasoned, not measured** (round C's 120 ms). Request-access does less database work than a send: 3 queries plus the outbox rows.
* **The token shape is a heuristic.** It misses a minted token with neither an upper-case letter nor an underscore (about 1 in 40 million per token). It would flag a non-token of that shape, and none appeared. It sees only what the crawls reach: 1,089 pages and 98 redirects in render, 1,169 pages and 447 redirects in write.
* **Local timing is local.** All five rows resolve 0.4–0.9 ms on `next dev` with a sub-millisecond database.
* **Not checked:** a real email provider; the request-access form in a real in-app browser; a concurrent verify-and-withdraw race (the lock is reasoned, not exercised).

## Lesson

**One query shape is not one time.** I moved the lookup to one statement of one shape for every token, and measured it with the floor removed. The held path was still 0.2 ms slower than a never-existed token. It asks one more question after the lookup (has this link been asked today?), and the shape of the first query says nothing about the steps after it. Only the floor around the whole handler closed it.

*Rule:* when you equalise paths, wrap the whole handler, from its first line to its answer. Then prove the row red **with the equaliser removed and everything else kept**, so you see what the equaliser is actually hiding, not just that the old code leaked.
