# build: proving an email address belongs to the person using it (2026-09-23)

Asked: package B — an address is not a person until they open a link we sent to it (safety-week B1/B2, LESSONS L21): proof on the person, the three sign-up doors unproved until confirmed, the guardian attachment closed, a draft confirm message, rate limits on every door.

Did:

- **`supabase/migrations/0056_email_proof.sql`** (new; my only migration number). `person.email_proved_at`; table `email_proof` (hashed, single-use, seven days, RLS per L26); `auth_reset.proves_person_id`; `fn_email_proved` (the one answer); `fn_use_email_proof` (consume the link, mark the proof, in one statement). Two triggers carry the rule:
  - `person_email_proof_has_a_reason` refuses to write `email_proved_at` unless the **evidence is in the database** — a used `email_proof` row, a used `auth_reset` that was emailed to that person's own address, or a `pending_invitation` whose email channel the parent pressed (D-156). No operator, seed or future route can set it by hand. Changing an account's address clears the proof, so proof is proof of one address.
  - `guardianship_link_guardian_proved` (B2) refuses to link a child to an account whose address nobody proved. The trigger is the guarantee; `lib/guardian-flow` is only a caller.
  - Named `proved`, not `verified`: this codebase already spends `verified` on a club (D-126) and a WWCC attestation (D-98), and `email_verified` on the D-156 channel press.
- **`lib/auth.ts`** — `verifyPassword` selects `fn_email_proved(p.id)` and returns null for an unproved account **after** the same scrypt work, so it is indistinguishable from a wrong password (D-94 §2). `createAddressProof` / `useAddressProof` / `addressProofIsLive` for the door's link. `createReset` records `proves_person_id` only when the link goes to the account holder's own address (an under-16's reset goes to the parent and proves the parent's inbox, not the child's); `consumeReset` writes the proof when it does.
- **`app/join/actions.ts`** — all three doors: `doorIsOpen()` rate-limits per address and per IP (20/IP and 10/address per 15 min, the sign-in terms) and an attempt over the limit **writes nothing, does the same password work and lands on the same screen**; `askThemToConfirm()` mints the link and sends the draft message. The account is created exactly as before and signs in nowhere until the link is pressed.
- **`app/confirm/[token]/`** (new page + action) — a **press**, never a page load (the D-156 rule: mail scanners follow links). Every non-live token — used, lapsed, never existed — serves one identical panel, as the link-state page does for share tokens (D-77).
- **`app/signin/page.tsx`** — the `joined=1` line no longer says "You're set up" (L25: it described behaviour that changed); a `confirmed=1` line. **`app/signin/actions.ts`** — the dev password-less path asks `fn_email_proved` too, so no path skips the rule.
- **`lib/guardian-flow.ts`** (B2) — `approveInvitation` now reads whether the account on that address is unproved. If it is: **the credential is deleted and any outstanding reset is deleted, the address is proved through the approval, and the child is linked to that account.** The person on the page has just proved the address on two channels (D-156), so the approval is what settles ownership: whoever controls the inbox keeps the account, whoever typed the address keeps nothing, and nobody is told (the same silence as D-155's hold). An account that was already proved is treated as today. The approval consent row carries `email_proved: true` and `credential_cleared: true` — no new event word was needed, because this can only ever happen at an approval and the row it rides on is that approval (L5 considered).
  - *Why this and not the alternatives:* creating a second, fresh guardian person would leave the child's parent holding an address that another account also claims, and would split a real parent's account in two if they later proved it. Refusing the approval outright would let anyone block a child's approval forever by pre-registering a parent's address. Asking the approver to "prove the account" is what the two D-156 channels already are.
- **`lib/messages.ts` / `lib/messaging.ts`** — `confirmAddressEmail` as **doc 15 §10b, marked `.draft`**, plus `DRAFT_KEYS`. A draft queues in development, where the outbox is the inbox, and `send()` **refuses it in production**. So the doors cannot ship before BUZ approves the words. Neither approved message can honestly do this job: §10 opens "Someone asked to reset the password for this account" (untrue of an account made a second ago, and the reason §10a exists) and §10a names a child the person may not have. The **recovery** path does reuse approved copy: a lapsed confirm link is replaced by §10/§10a from "Reset it", which sets a password and proves the address in one go.
- **`scripts/dev-db.mts`** — fixture addresses are proved the way the product proves one (a used `email_proof` row, because the database asks for evidence); plus two new fixtures: `unproved@example.com` with the link still unopened (`/confirm/dev-unproved`) and **Priya Raman's address already parked by somebody else with a real password on it**, which is the B2 shape.
- **`scripts/permission-tests.mjs`** — `proof1`–`proof16`, three `doc15` draft checks, and **door7 rebuilt**: its "no takeover" claim used to be a regex counting `on conflict (email) do nothing`, which cannot fail (L19/N5); it is now backed by the database refusing a second account on a taken address and by that account being unable to sign in. **`scripts/write-tests.mjs`** — `join5`–`join5f` walk the real flow (sign up at the door → cannot sign in → read the emailed link from the outbox → press → sign in → the link is finished), `t16d2` the same for a 16–17, `b2a`/`b2b` the B2 takeover end to end through the real approval screens. **`scripts/layout-check.mjs`** — the confirm page is reached only from an email, so it is in `DEEP`.

Ran (fresh seed, TRAINING §4 order — reseed → perms → render → write → reseed → layout):

- `npm run test:perms` **1022/1022**, 0 failed · `npm run test:render` **369/369**, 0 failed · `node scripts/write-tests.mjs` **295/295**, 0 failed · `node scripts/layout-check.mjs 375 1280` **184 page views, 0 overflow** · `node scripts/gate-coverage.mjs` **261/261 rows pinned, 0 open** · `palette-check` green · `corpus-check` 0 failures, 0 warnings · `secret-scan` none · `npx tsc --noEmit` clean · `SUPABASE_DB_URL=… npm run build:check` compiled, `/confirm/[token]` present.
- Package A committed (`7d7862a`) while I was staging, so the counts above are the final state: their squads work plus mine, run in the §4 order from a fresh seed. Earlier in the day, while their work was uncommitted, I also built and ran a my-hunks-only version of both suites (perms 983 passed / 3 failed, write 289/289): the three failures were HEAD's own `R3`, `J57` and `SQ8` against their then-uncommitted `0054`, and their commit replaces all three. Nothing my package touches failed in either version. My commit carries my hunks of the two shared suites and nothing of theirs.
- L19/L20, the new checks proved able to fail: in a throwaway in-memory database built from the migration chain **without 0056** (nothing dropped or weakened anywhere), `fn_email_proved` does not exist and the unproved account **is** handed the child — i.e. `proof1`/`proof5`/`proof6` fail on the old code. `proof12` failed for real while I wrote it (a function in `RETURNING` reads the pre-update row) and was rewritten to ask afterwards.

Found:

1. **Two builders, one working tree, one dev database.** Package A runs from a second copy (`…/scratchpad/pkgA`) but binds the same port 54322, and PGlite serves exactly one connection, so a second app cannot run at all. Each of us reseeded the other's database and restarted the other's dev server several times, and for a while the running database was built from a copy of the repo that did not contain 0056. Nothing was lost, but no count either of us reports is safe while this holds. Suggest: a port per package (a `PORT` env on `scripts/dev-db.mts`), or serialised runs.
2. **A sign-up door now has a timing oracle in production.** A free address sends an email; a taken one does not, and the provider call is the difference. The body and destination are identical, but doc 14 J18 asks for indistinguishable timing. `/reset` has had the same shape since it was written. The cheap fix for both is to let the outbox sweep dispatch rather than sending inline; I did not make it, because it is outside this package and changes delivery latency for every message.
3. **An unproved account parks an address, and the real owner cannot get past it.** The doors leave a taken address untouched (that is D-94 §2, and correct), so if somebody registers `mum@…` and never confirms, the real owner's sign-up writes nothing, sends nothing, and she is told to check an email that never arrives. B2 means parking now steals nothing, but it is still a person who cannot make an account. **This needs a product decision and I have not made one.** Options: (a) purge accounts with no proof after N days (a retention rule, and N is BUZ's); (b) re-send the confirm link to the address on a second attempt and let the inbox holder's press decide which credential stands — better for the owner, but it lets the parker re-run the door to make their password the current one just before she presses; (c) leave it, and let support clear a parked address by hand. Any of them touches a parent's ability to reach their child's account.
4. **`app/join/page.tsx:167`**, the club door: "Next: open your club's page on Pitch and press Claim your club" no longer names the step in front of it (confirm the address). It is incomplete rather than false, and the sign-in screen says the missing part. Copy seat's call; I did not rewrite it.
5. Package A's in-flight state broke my runs twice mid-suite (a mid-edit `permission-tests.mjs` crashed on a parameter count, and the app was killed during a write run). Reported, not touched.
6. **Where this package actually landed in the history, and it is not where it should be.** I staged package B's files; before I could commit, package A committed again and swept my staged index into **`e3a6039` ("Builder's report for package A…")**, which therefore contains all sixteen of my files including `0056`. My own commit, **`f7a05ac` ("An email address is not a person until they open a link we sent to it")**, carries the reasoning in its message and two lines of this report. Nothing is lost and the branch content is correct; the attribution is not, and I did not rewrite history on a shared branch to fix it. Leo's call. The underlying cause is Found 1 — two builders committing from one tree, where `git commit -a` takes the other's work.

**The coach lookup, for the later package (Leo asked).** `inviteCoach` should ask the database, not the row: match only accounts where `fn_email_proved(p.id)` is true — i.e. `lower(p.email) = lower($1) and fn_email_proved(p.id) and <18plus> and <coach_profile exists>` — and, when there is no such account, answer exactly as it does for a match (D-154's "the answer does not say whether the email is a Pitch account"). Proof is the only new condition; everything else is unchanged.

Copy for BUZ — every new or changed user-visible string, verbatim:

**1. Draft message, doc 15 §10b — NOT APPROVED, DOES NOT SEND IN PRODUCTION until BUZ approves these words and doc 15 carries them.** The three sign-up doors do not work without it.

Subject: `Confirm your email address`

```
Someone put this address into a new account on Pitch. If that was you, this link finishes it:

Confirm your address: pitchfootball.com.au/confirm/TOKEN

Nobody can sign in to that account until the link is opened. If it wasn't you, ignore this email — the account stays shut, and whoever typed your address gets nothing from it.

The link works once and lasts seven days. After that, use "Reset it" on the sign-in page and choose a password from the link we email you.

— Pitch
pitchfootball.com.au · help@pitchfootball.com.au
```

**2. Sign-in screen, after signing up (replaces "You're set up. Sign in with your email and the password you chose."):**

```
Check your email. There's a link in it that confirms the address is yours — open it and you can sign in.
```

**3. Sign-in screen, after confirming (new):**

```
Address confirmed. Sign in with the password you chose.
```

**4. The confirm page, live link (new):** heading `Confirm your email address`; body `Press the button and this address is yours on Pitch. Until then, the account it belongs to signs in nowhere.`; button `Yes, it's me — continue` (the existing D-156 wording, reused deliberately).

**5. The confirm page, any link that is not live — used, lapsed, or never existed (new):** heading `This link isn't live`; body `It may have been used already, or it may have lapsed. Either way, nothing is lost: use "Reset it" on the sign-in page and choose a password from the link we email you.`; button `Go to sign in`.

Risks, and what I did not check:

- **No account can sign in the moment 0056 is applied**, because nothing is proved yet. There is no production data, so today this costs nothing; the release seat should know that the recovery for any existing account is the §10/§10a reset link, which proves the address as it sets the password.
- I did not measure the timing of the doors (Found 2) — I reasoned about it and did not instrument it. J18/J40 want a measurement.
- I did not open `/join` in a browser. The doors are a client component (L10), so the write suite posts their server actions through Next's manifest, which is how the existing suite already reaches them; the *form itself* — that a person can type an address, see the new wording, and land where I say — is unwalked. **QA should walk `/join` in a real browser at 375 and 1280.**
- No email left the machine, here or anywhere: dev queues, and drafts are refused in production.
- I did not check what happens if a person changes their address later — no path does, today, and 0056 clears the proof if one ever does.
- The demo (`npm run demo`) needs a restart after this migration before anyone opens it (L14).

Lesson: **an address is proved by evidence, so make the database ask for the evidence.** Every "only set this when X really happened" rule I have seen in this codebase was a promise in one function; writing it as a trigger that looks for the row X leaves behind means a seed, an operator, a future route and a tired builder all get the same answer. It also made the fixtures honest — the seed now has to prove an address the way a person does, and that is what turned the B2 blocker into two lines of test.
