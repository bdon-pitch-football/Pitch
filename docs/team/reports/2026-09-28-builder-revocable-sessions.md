# Build: a session is a row, and ending it ends it everywhere (28 Sept 2026)

**Asked:** build the smallest thing that makes revocation real — a revocable session
table, sign-out that kills the cookie everywhere, a password change that ends every other
session, reset links that supersede and burn, and a per-address cap on /reset that stays
invisible — and prove every part of it fails on today's code (QA's F1 and F2).

**Measured on:** branch `builder-revocable-sessions` at `da2ecf1`, in
`repo/.claude/worktrees/builder-revocable-sessions`, on my own dev database (`54352`) and
app (`127.0.0.1:3160`). Ports 3000, 3030, 54322 and 54323 were never touched by anything I
ran on purpose (one exception, reported in **Found 3**); every stop was
`kill $(lsof -ti :54352 -sTCP:LISTEN)` (L8). Branch point `a67b70b`; **`app` moved to
`7656d0a` while I was stopped and I merged it in** (not rebased — see *Did*, item 0).
`df -h /` **20Gi available at the start, 15Gi at the end**; the difference is one APFS clone
of `node_modules` (374MB) and the dev-server cache, which I deleted at the end along with
`.next-check`. Nothing of mine is left running.

---

## Did — file by file, and why

**0 · The merge, and a migration number.** `app` gained eight commits, two of which matter
here: **0061 (D-161, no school on an under-18's record)** and the sweep that renamed every
organisation in `lib/fixtures.ts`. I **merged** rather than rebased — two of my commits were
already measured against and the merge keeps the "which side moved" question answerable
(L32) — and the merge was clean, no conflicts, the renames untouched. My migration was
**renumbered 0061 → 0062 before the merge**, in its own commit: two files numbered 0061 is a
release hazard whatever order they happen to sort in. Every comment citing it moved with it.

**1 · `supabase/migrations/0062_sessions_can_be_revoked.sql` (new, 182 lines).**

- `auth_session` — `person_id`, `token_hash bytea unique`, `issued_at`, `expires_at`,
  `revoked_at`. **No column can hold a token in the clear and there must never be one.**
  Row-level security enabled in the same file, no policies (L26, D-80).
- `fn_session_issue(person, token_hash) returns timestamptz` — the lifetime lives here and
  nowhere else, and the caller sets the cookie's expiry *from this answer*, so the cookie
  and the row cannot disagree about when the session is over.
- `fn_session_person(token_hash) returns uuid` — **the one answer**, asked on every read.
  Four ways to be nobody and they are indistinguishable: revoked, lapsed, never issued, and
  belonging to a person who has been deleted (that last one is not new and had to survive
  the change).
- `fn_session_revoke(token_hash)` — sign-out. **This session, not this person**: a parent
  signing out of the laptop is still signed in on their phone.
- `fn_sessions_revoke_all(person) returns integer` — a new password.
- `auth_reset` gains `revoked_at`, plus `auth_reset_one_live` (an **AFTER INSERT trigger**:
  issuing a link kills the ones outstanding, so no future route that sends a reset can
  forget) and `fn_use_auth_reset` (marks used in the statement that reads it, revokes every
  sibling, writes the 0056 address proof).
- **The trap in this file, written down in it:** supersession is `revoked_at` and **never**
  `used_at`, because 0056 reads a *used* `auth_reset` row as evidence that somebody opened a
  link we sent them. Marking superseded links used would have manufactured that evidence out
  of links nobody ever opened — L21, the exact hole 0056 was written to close. There is a
  check that fails if anyone changes it back (`reset7`).

**2 · `lib/session.ts`.** The cookie now carries `<token>.<hmac(token)>` where the token is
`randomBytes(24)` base64url — 192 bits, the shape and standard a share token already holds
(D-94 §4) — and only its sha256 hash is stored. `getSessionPersonId` verifies the signature
in constant time *before* the database is touched (a forged cookie never reaches the table),
then asks `fn_session_person`. It is the same one query per read the old code already did
against `person`, so no page got slower. `clearSession` **revokes the row, then** drops the
browser's copy. New export `revokeEverySession(personId)`.

**3 · `lib/auth.ts`.** `setPassword` calls `revokeEverySession` — **including the session
doing the resetting, and that is the decision, not an oversight.** Justification, since you
asked for it: a parent changing their password believes it locks the other person out; if we
exempted the acting session then whoever holds a captured cookie *and* intercepts one reset
email keeps their session while the parent is the one who has to sign in again. The
exemption would buy nothing anyway — the reset flow already ends at `/signin?reset=1` and
the sign-up doors sign nobody in, so **no path in the product loses anything it had**. It
costs one sign-in and it is the more restrictive answer (TRAINING §3.8). `consumeReset` now
calls `fn_use_auth_reset` instead of carrying its own copy of the UPDATE (L23).

**4 · `app/reset/actions.ts`.** A **per-address cap of 3 per hour** beside the existing
per-IP 10 per hour. Three is a choice I made and am flagging as one (D-94: when a security
decision is unclear, choose the more restrictive and say so): a reset token lives one hour
and issuing one now invalidates the last, so there is no legitimate use for a fourth in the
same hour, and three-per-identifier is the shape already used on the setup link
(`/a/[id]/done`) and on the D-81 SMS rule. The limit is consulted **for every address,
before anything looks the address up**, and the answer is the same single redirect either
way — a cap that only engages for real accounts, or that says it engaged, is an enumeration
oracle (D-94 §2, doc 14 J18).

**5 · Expiry — a proposal, said out loud.** **30 days from issue, absolute, no sliding
renewal.** 30 days is what the cookie already carried (`maxAge: 60*60*24*30`), so no user's
experience changes; the only change is that the server now enforces the number the browser
was trusted with. Absolute rather than idle because a sliding window means a session in
daily use never expires — and "everything is revoked eventually" would then be false for
exactly the person most likely to be being watched. **Nothing in the register settles this.**
If BUZ wants a different number it is one interval in `fn_session_issue`.

**6 · `scripts/dev-db.mts`.** The seed issues **one live session per fixture person** through
`fn_session_issue` and writes the token beside the ids in `.dev-ids.json` (gitignored). This
was forced: a suite can no longer become a seat by signing a person id, and it cannot ask
the database for a session either, because PGlite serves one connection and next-server
holds it. The seed is the only place that can mint them, which is also the honest place — a
session token in a gitignored file beside a throwaway in-memory database is the same kind of
handle the `dev-deniz` share tokens already are. A demo mints none (it signs its seats in by
pressing a button). A stale `.dev-ids.json` now **says so** rather than failing as "signed
out" fifty times.

**7 · The four suites' cookie helpers** (`write-tests`, `render-tests`, `layout-check`,
`screens`) read that token instead of signing a person id.

**8 · Three tools stopped following `/signout`, and this is the part to read.** Signing out
is a **state change** now. `scripts/write-tests.mjs`'s `reach()` and `scripts/render-tests.mjs`'s
`r43` both followed every link they found, and `/signout` is one of them — so each of them
ended the seat and everything after it saw a signed-out product. It cost me an hour, because
it surfaced four hundred lines later as *"cp1: an adult with no page is offered Publish my
page"* going red, which is the dangerous direction: the answer looked like "the product is
broken" (L34). Both now skip it, with the reason in the comment, and `r43b` asserts the door
is still there. Pressing it is the write suite's job, on a session opened for it.

**9 · The tests.** 30 new checks in the permission suite against the database
(`sess1`–`sess16`, `reset1`–`reset12`), 17 in the write suite through the product
(`sess-w1`–`sess-w17`), and three existing reset checks re-pointed at
`fn_use_auth_reset` because their hand-written UPDATE was no longer the statement the
product runs — it never looked at `revoked_at`, so it would have stayed green with
supersession completely broken.

**10 · Doc 14 E11 now has a check that tests E11.** The row id `E11` was sitting on a
sign-out assertion, so `gate-coverage` counted *"the link-state page body contains no name,
no club, no photo, no age, no initials, no squad number"* as pinned by nothing at all. That
is L4 for the **fourth** time, and it was inside the one check my work rewrote, so I fixed
it here: the sign-out assertion is now `sess14`, and `E11`/`E11b` assert the rule as doc 14
words it — `LinkState` takes a token and a boolean, and names no field of a record anywhere.
Coverage stays 262/262. **The rest of that block is not mine and is in *Found 2*.**

---

## Ran

TRAINING §4 order, with **your correction applied**: reseed → tsc → perms → render →
**reseed** → write → reseed → layout. All from a fresh seed on `da2ecf1`.

| Suite | Count |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run test:perms` | **1171 passed, 0 failed** (1119 at the branch point; +30 mine, +24 from the merge, −2 replaced) |
| `node scripts/gate-coverage.mjs` | **262 / 262 rows pinned, 0 open** |
| `npm run test:render` | **393 passed, 0 failed** |
| `node scripts/write-tests.mjs` | **332 passed, 0 failed** |
| `node scripts/layout-check.mjs 375 1280` | **188 page views, 0 overflow** |
| `node scripts/palette-check.mjs` | ALL GREEN |
| `python3 scripts/corpus-check.py` | **0 failures, 0 warnings** |
| `node scripts/secret-scan.mjs` | no secrets found |
| `SUPABASE_DB_URL=… npm run build:check` | exit 0 |

The write suite also passed **328/328** in the pre-merge tree with render's writes still in
the database — so the reseed between them is hygiene rather than a load-bearing dependency,
but I did it your way.

### Proved on the old behaviour (L20) — every defect put back, twice

**Against the database and the source (one run, all defects in at once, each failure naming
its own defect):** 1162 passed, **9 failed**.

```
FAIL sess3   a revoked session resolves to nobody … got "72329cfd-…"      ← revocation ignored
FAIL sess5   a new password revokes every live session … got 2,"72329cfd-…","72329cfd-…"
FAIL sess7   a lapsed session resolves to nobody … got "b38f3edb-…"       ← expiry ignored
FAIL sess14  signing out revokes the session, not just the browser's copy of it
FAIL sess15  setting a password revokes every live session for that person
FAIL reset1  twenty-four presses leave exactly one live link — expected 1, got 24
FAIL reset2  and the oldest of them opens nothing … got "e33bc8f9-…"
FAIL reset5  using one link kills every other live link for that person
FAIL reset10 the reset route caps per address as well as per declared IP
```

**Through the product (same defects, the write suite):** 327 passed, **5 failed**.

```
FAIL sess-w2   press Sign out, replay the same cookie, and it opens nothing of hers
               — expected [true,false], got [true,true]
FAIL sess-w3   the replayed cookie is served the signed-out product, not a session
FAIL sess-w6   and BOTH sessions are over — expected [false,false], got [true,true]
FAIL sess-w8   six presses from six declared addresses deliver three emails, not six
               — expected 3, got 6
FAIL sess-w13  the OLDER of them sets no password — expected true, got false
```

Two more proofs worth recording:

- **The cookie.** With `jar.set(COOKIE, \`${personId}.${sign(personId)}\`)` put back,
  `sess10` fails ("the cookie carries a random token, never the person id").
- **The L21 trap.** With supersession written to `used_at`, `reset7` and `reset7b` fail. My
  first draft of `reset7` **passed with that bug in place**, because it read
  `fn_email_proved` and nothing had tried to write the column — the rule is about what the
  evidence *lets you write*, so the check now attempts the write the 0056 trigger guards and
  expects a refusal (L19: a check that cannot fail is not a check). That correction is its
  own commit.

Every restore was `git checkout --` on the four files, verified with `git status` clean and a
green re-run: perms 1171/1171, render 393/393, write 332/332, layout 188 views.

### Doc 14 gains rows — proposed, not written

Doc 14 is the spec and Leo writes it; the register moves first, then the code. Here are the
rows I believe it gains, verbatim, as a new section table so `gate-coverage` can count them,
with the check that already pins each. **If you adopt them, prefix these labels with the row
ids in the same commit**, or coverage will report ten open rows.

```
## T · Sessions — the cookie is not the session

| # | Case | Expected |
|---|---|---|
| T1 | A session cookie replayed after Sign out | **Refused.** Signing out revokes the session row; the cookie is dead wherever it is held, not only in the browser that pressed it |
| T2 | A session cookie replayed after that account's password is changed | **Refused.** Setting a password revokes every live session for that person, including the one that set it |
| T3 | A cookie naming a session that was never issued | **Refused**, and identical to every other refusal — nothing distinguishes why |
| T4 | A session older than its lifetime | **Refused.** Enforced in SQL on every read, never by the cookie's own expiry |
| T5 | A session belonging to a person who has been deleted | **Refused** |
| T6 | Sign out on one device, with a session open on another | **The other stays signed in.** Revocation is per session, never per person |
| T7 | The contents of the session cookie | An opaque ≥128-bit CSPRNG token and its signature. **Never a person id, never a role, never anything forgeable from public data.** Stored hashed — a database dump yields no working session |
| T8 | A password-reset link is issued while one is outstanding | **The outstanding one is dead.** One live reset link per person, enforced by the database and not by the route that sends it |
| T9 | A reset link is used | **It is spent, and so is every other live link for that person** |
| T10 | Reset requests for one address from many declared IPs | **Capped per address.** Status, destination and body are identical whether or not the account exists and whether or not the cap engaged |
```

| Row | Pinned by |
|---|---|
| T1 | `sess3` (database) · `sess14` (the route) · `sess-w2`, `sess-w3` (the product) |
| T2 | `sess5`, `sess15`, `sess-w5`, `sess-w6`, `sess-w7` |
| T3 | `sess2` |
| T4 | `sess7`, `sess8` |
| T5 | `sess9` |
| T6 | `sess4` |
| T7 | `sess10`, `sess11`, `sess12`, `sess13`, `sess16` |
| T8 | `reset1`, `reset2`, `reset7`, `reset7b`, `sess-w12`, `sess-w13` |
| T9 | `reset3`, `reset4`, `reset5`, `sess-w14`, `sess-w15`, `sess-w16`, `sess-w17` |
| T10 | `reset10`, `reset11`, `reset12`, `sess-w8`, `sess-w9`, `sess-w10`, `sess-w11` |

---

## Found

**1 · There is one Sign out in the whole product, and almost nobody can reach it. HIGH —
and it is the thing I would put in front of BUZ first.** `app/home/page.tsx:695` is the only
`/signout` link in `app/` or `components/`, and it is inside the `children.length === 0`
branch — the home screen of an **account with nothing on it yet**. A parent, a player, a
16–17-year-old, a coach, a Technical Director, a club administrator and an operator have
**no way to sign out from any screen in the product.** I have made revocation real and the
button that fires it is unreachable for every seat that has anything to protect. I did not
add one: where it goes on seven different shells and what it says is product and design, and
a new user-visible affordance is BUZ's call, not mine. It is why I would not call F1 closed
on the strength of this commit alone.

**2 · The permission suite's whole E block is mislabelled, not just the one I fixed. MEDIUM.**
Doc 14's E rows are about generating, regenerating and expiring a share link (E1 u16 self,
E2 guardian generates, E3 16–17 self, E4 regenerate, E5 disable, E6 89 days, E7 91 days) and
about the link-state body (E11) and the OG cards (E12–E14). The suite's `E1`–`E10` sit on
the dead-token read shape, the noindex header, the referrer policy and the OG route. So
`gate-coverage` counts E1–E10 as pinned by checks testing other rows. **I verified one case
completely — E11 was pinned by nothing** — and fixed that one because it was inside my
change. The other nine I have not audited and did not touch (L4 says a label is a claim;
re-labelling nine gate rows is a decision about the gate). Suggest one pass over the E block
against doc 14, by whoever owns the gate.

**3 · I ran the write suite once against `http://localhost:3000` — another seat's app — by
forgetting `RENDER_BASE`. MEDIUM, and mine.** `RENDER_BASE` defaults to port 3000 while
`PITCH_DEV_DB_PORT` moves the database, so a seat who follows the isolation recipe still
points every suite at the **shared** app unless they remember a second, differently-named
variable. That is F5 wearing a different hat. Damage: every request was **signed out**
(that app's cookie shape and mine disagree), so only the signed-out doors — `/signin`,
`/join`, `/reset`, `/report`, `/p/*` — could have written anything, and the run died without
printing a single check. That database is in memory; **whoever owns 3000 should reseed
before trusting a count.** The fix belongs to tooling, not to me: derive the base from
`PITCH_DEV_DB_PORT`, or refuse the default base when that variable is set.

**4 · `corpus-check` was red at my branch point** — S2, two hits of "28 September" in
`docs/design/reports/2026-09-24-audit-every-device.md`, which is the commit I branched from.
It is green after the merge; `22f7c94` fixed it on `app`. Nothing to do, recorded because a
report was committed carrying a red check.

**5 · `lib/auth.ts:178` exports `newSessionId = () => randomUUID()` and nothing calls it.**
Dead before my change and actively misleading after it, sitting two files from a real session
table. Left alone — deleting it is outside what I was asked for.

**6 · Nothing purges a dead session row.** A revoked or lapsed `auth_session` row lives
forever. It holds a hash, a person id and three timestamps — no address, no device, no IP —
and it is exactly what D-94 §10 wants for *"what was accessed, by whom, when"*. But **how
long we keep a dead session is a retention decision** (D-25 says the fewer the better, the
privacy policy has a retention statement, and the answer belongs with the solicitor's
inactive-account rule). I have not invented one and no job deletes anything.

**7 · TRAINING §4's order line still reads `render → write` with no reseed between them,**
while your correction says to reseed. The caveat about render writing is in §4 now; the order
line is not. Yours to reconcile.

---

## Copy for BUZ

**No new or changed user-visible string. None.** Two things for him anyway, both about copy
that already exists:

1. `app/reset/[token]/page.tsx:34`, unchanged and now **true**:

   > This signs you out everywhere else once you sign back in.

   It is true in the stronger direction than it promises: every other session ends the
   moment the password is set, not when they sign back in. **F2 closes with no copy change.**
   If BUZ wants the screen to say the stronger thing, that is a new string and I have not
   written one.

2. **The Sign out question (Found 1)** will need a placement and a label on six or seven
   shells if he wants it. I have written neither.

---

## Risks — what could still be wrong, and what I did not check

- **Found 1 is the live risk.** Revocation works; for most accounts nothing in the product
  invokes it. A parent's only route today is the reset email.
- **I did not build "sign out everywhere" as an affordance**, only the capability. There is
  no screen listing a person's sessions and no button that ends all of them; the password
  reset is the only path to `fn_sessions_revoke_all`. That was the scope I was given.
- **Interim by design.** This is not Supabase Auth (D-80 keeps that for session only) and
  does not pre-empt it. The revocation semantics survive that migration; what will have to
  move is `lib/session.ts` and the seed's minting, and both are one file each.
- **Timing.** I did not measure response-time distributions on `/reset` for the
  exists/does-not-exist split. The pre-existing difference (a non-existent address does one
  query; a real one does a query, an insert and a send) is **unchanged by my work** and the
  new cap is keyed on the submitted address before any lookup, so it cannot tell the two
  apart — but J18's timing half is asserted by nobody, here or before me.
- **One connection.** Everything behavioural was measured against PGlite serving one
  connection. `fn_use_auth_reset` and `fn_session_revoke` are single statements and safe
  under concurrency by construction, but I could not run two clients at once to prove it.
- **A revoked cookie still costs one database round trip.** An attacker replaying a dead
  cookie in a loop gets a cheap, unmetered lookup per request. The signature check refuses
  garbage before the database, so this needs a *real* revoked token; I judged it out of
  scope and am naming it rather than leaving it unsaid.
- **I did not drive a real browser** through sign-out and replay — only HTTP with minted
  cookies plus the layout check's Chrome. Anything that only breaks with a browser's own
  cache or an in-app webview is unmeasured.
- **206 session rows per seed** is more than the fixtures need; it is one per person so that
  any id in `.dev-ids.json` works. Dev only.

---

## Lesson for the next seat

**When a no-op becomes an action, every tool that "follows every link" is now pressing a
button.** `/signout` was a GET that deleted a cookie nobody kept, so three tools walked
through it for weeks and nothing happened. The moment it revoked a session, two of them
ended their own seat — and neither said so: one reported *"an adult with no page is offered
Publish my page"* as false, four hundred lines and one suite away from the thing that had
changed. If you make something previously harmless do work, grep the suites for every walker
before you run them, and expect the failure to arrive wearing somebody else's name.
