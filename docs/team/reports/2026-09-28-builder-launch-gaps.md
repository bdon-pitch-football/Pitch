# builder: launch gaps — the CSP proved, SMS on the switchboard, timing measured (28 Sept 2026)

**Tree:** `.claude/worktrees/builder-launch-gaps`, branch `builder-launch-gaps`, cut from `app` at `340aae1`. `app` merged in at `7aa3dfe` (the clean-up round, approvals, D-163), merged, not rebased.
**Measured on:** `93a347a` for perms, render, write, layout and tsc; `3db2243` for timing, `build:check`, `test:csp-prod` and the static checks (re-run there). Between the two, only `scripts/timing-tests.mjs` and `docs/team/TRAINING.md` changed.
**Ports:** database 54372, app 3170, Chrome CDP 9373. Stopped by port. Port 9363 was checked free before each layout run.
**Migrations:** 0070 and 0071. 0067–0069 are the clean-up round's.
**Build output:** `.next` and `.next-check` deleted. `node_modules` is back to its symlink (the runs used a `cp -al` hard-link copy).

Asked: close the launch gaps in the release seat's report (Parts 4–5 and "Ranked by what it costs"):
* a real CSP, proved in a browser;
* the SMS kill switch and cap on `/ops/switches`;
* doc 15 §4 and §9 wired;
* the sitemap, the alumni guard and the 0051 pre-flight;
* real measurements for doc 14 E10, L40 and J61, and J3 running somewhere.

No new product and no new copy: unapproved words are held. Every new check proven red.

## Did

### 1 · The Content-Security-Policy (D-94 §8)

**There already was one.** `proxy.ts` has sent a nonce-based policy since 16 Sep. The release report looked for it in `next.config.mjs` only. The work was to prove it, not write it.

* **`lib/csp.ts`** (new). The policy as a plain function, directives unchanged:
  * scripts run from this site only, with this request's nonce and `strict-dynamic`, and never `unsafe-inline`;
  * inline style is allowed (the design system is style attributes);
  * `frame-ancestors 'none'`.

  "Development" now means `NODE_ENV === 'development'` only. It was `!== 'production'`, which gave a test run or an unset variable the development policy, `eval` included.
  * **Instagram and Veo are not added to `frame-src`.** `ClipCard` never frames them: it opens them in a new tab, `noopener,noreferrer`. Allowing hosts nothing uses would only widen the policy. The day the façade frames one, add it.
  * **Stripe stays in `form-action` only**, per Leo. The billing action answers with a redirect to Stripe, and a browser applies `form-action` to where a submission lands.
* **`proxy.ts`** calls `lib/csp`. It keeps the clean-up round's request-method stamp for `lib/link-preview`.
* **`scripts/layout-check.mjs`**
  * Every page view now **fails if the browser refused anything** under the policy. A `securitypolicyviolation` watcher is injected before any page script, and console lines are read too. This runs on every view at every width, including the focus-ring pages and the failure pages.
  * **First, a self-test.** The real `/signin` is intercepted over CDP with its real header, and an inline `<script>` is written into its HTML. It must be refused, and the refusal recorded. The same page served without the header must run it.
* **`scripts/csp-prod-check.mjs`** (new, `npm run test:csp-prod`). Starts the `build:check` output with `next start` and reads the header the built app sends:
  * nonce and `strict-dynamic` present; no `eval`, no inline script, no websocket; no framing;
  * `no-referrer` on `/p/`;
  * a fresh nonce per request.

  It stops its own server and checks the port is free. Its self-test: the development policy must fail the same assertion.
* **Permission suite** `csp-p1`–`csp-p9`, from `lib/csp` itself:
  * production script-src is exactly nonce plus `strict-dynamic`;
  * no `eval`, no socket, and inline only for style;
  * development adds exactly `eval` and the socket;
  * `proxy.ts` decides development by `=== 'development'` and writes no policy of its own;
  * every `<iframe>` in the product points at the one `frame-src` host;
  * Stripe appears only in `form-action`;
  * images come from the storage host and nowhere else;
  * `/p/` keeps `no-referrer`.

### 2 · The SMS kill switch on `/ops/switches` (D-81, D-94 §10)

* **`0070_sms_switch.sql`**
  * `ops_switch` gains `sms_off` and `sms_cap_cents` (positive or null: zero is the off switch, and it has one of those).
  * `ops_switch_event` learns `sms_off`, `sms_on`, `sms_cap_set` and `sms_cap_cleared`, and gets its own `sms_cap_cents` column (L5: a cap is not a count of links).
  * New functions: `fn_sms_switch()`, `fn_ops_set_sms_off()`, `fn_ops_set_sms_cap()`. Same shape as 0044: one row, and the operator's name, email and reason are written in the same transaction as the switch. The log stays append-only.
  * No table rewrite (`migration-on-data`: none).
* **`lib/sms-policy.ts`** adds three things:
  * `smsSwitchedOff`: off if the environment **or** the operator says so;
  * `effectiveSmsCapCents`: the **lower** of the two caps;
  * `operatorCapCents`: dollars as typed, into cents, refused above the environment's cap.
* **`lib/messaging.ts`** reads `fn_sms_switch()` on every SMS. The read comes after the mandatory-cap refusal and before the opt-out check, the meter and the outbox. Spend is checked against the lower cap. **The environment stays the ceiling:** the database can switch SMS off or lower the cap, and can never undo `SMS_KILL_SWITCH` or raise the cap above `SMS_MONTHLY_CAP_CENTS`. With no environment cap, production still refuses every SMS (BUZ decision 5).
* **`app/ops/switches/actions.ts`**: `setSmsOff` and `setSmsCap`. They are operator-only and need a reason, like the other two. A cap above the environment's is refused before the database is asked to record it.
* **`app/ops/switches/page.tsx`**: an SMS card in the existing switch pattern (pill, one line of state, explanation, "Why", button) and a cap form. **Its words are held** (`SMS_WORDS_APPROVED = false`). The card renders outside production only, and the production page is exactly the two switches it was. Flip the constant in the commit that records BUZ's yes. Every word is listed under Copy for BUZ. Leo confirmed they are not in `APPROVALS-28-SEP.md`.

### 3 · Doc 15 §4: not wired. The event it words cannot happen (see Found 2).

### 4 · Doc 15 §9: not wired. It conflicts with doc 29, the live page and the stored consent (see Found 3).

### 5 · The small ones

* **`app/sitemap.ts`** lists club pages that are claimed **or** verified, the same test the club page uses. Unclaimed and suspended pages stay out.
* **`0071_alumni_guard_on_update.sql`**: a `before update` trigger. An edit cannot leave an entry unconfirmed. **It lets exactly one update through: 0067's erasure** taking an erased person's name off an entry, with nothing else changed (`fn_is_erasing_name`, the database's own answer). **My first version refused that update.** The clean-up round's I1 caught it after the merge: a guardian's one-tap deletion would have failed on an alumni line. It is fixed in `eb592f3`, and `al-u5`/`al-u6` pin both halves.
* **`docs/team/RELEASE-PREFLIGHT.md`** (new):
  * when the pre-flight applies (not on an empty project);
  * how to run the queries: ids and counts only, never an alumni line pasted into chat;
  * the seven queries, each with what to do if it returns rows;
  * an eighth, for entries predating 0051, which is a decision for BUZ.

  `pf1` fails if the doc and the script's `PREFLIGHT` list ever differ.
* `scripts/migration-on-data.mjs`: one line still said "the trigger is insert-only". Corrected.

### 6 · Doc 14 rows met by proxy

**`scripts/timing-tests.mjs`** (new, `npm run test:timing`, added to TRAINING §4). It runs last and mutates. It tests the rows as doc 14 words them, against the running app.

**How the states are made.** All through the product:
* E4: the guardian replaces Deniz's link;
* E5: the guardian switches Nate's profile off;
* E7: `dev-expired`;
* E8: the guardian deletes Georgia;
* E9: 32 fresh random bytes per request;
* L40: an adult at the daily cap against twelve adults sending for real. Which arm each send landed in is proved from the outbox.
* J61: a family registers with the held club and takes it off. The twin club is claimed through the real claim-code flow.

**How it decides.** Arms are sampled in the same rounds, in a fresh random order each round, after a warm-up.
* **Comparison:** Mann-Whitney U, with the shift estimated by Hodges-Lehmann.
* **FAIL** when p < 0.001, Bonferroni-divided across the row's comparisons. There is no "small enough" allowance: the token path has no rate limit (Found 6), so an attacker can take as many samples as we can.
* **Resolution self-test (L19).** Every arm is split in half five times. Unshifted, the halves must not read as different. Shifted, the smallest shift caught is the resolution, and the row claims its **noisiest** arm's.
* **INCONCLUSIVE** above 1 ms. That is roughly one more production database round trip, and it fails the run.
* **Sampling** continues until every arm resolves 0.8 ms, capped at 1,500 rounds. The stopping rule looks only at each arm's own spread, never at a difference between arms.

**J61 is compared against a twin.** "Never had one" cannot be restored, and two blocks run one after the other drifted 0.7 ms apart with nothing changed. So the held club and an untouched twin are fetched in the same rounds, and their difference is compared before and after.

**E10b and J61b diff the captured bodies.** Nonce, request id and token are normalised.

**Proxies relabelled** so they no longer claim the rows (L4). Each keeps its place as the structural belt:
* `held1`, was J61;
* `lim-struct1` and `lim-struct2`, were L40 and L40b;
* `held-count1`, was J61;
* E10's proxy took the clean-up round's label, `dead4`.

**`scripts/gate-coverage.mjs`** now counts pins from every suite that tests a row: perms, render, write and timing (Leo's instruction).

**`scripts/dev-db.mts`**: `.dev-ids.json` gains `heldClub` and `adultPlayers`. That is output only, with no database change, and only the timing suite reads them.

**J3:** `srk1`/`srk2` bring CI's service-role check (`.github/workflows/ci.yml`, which has never run because this branch has never been pushed) into the permission suite:
* the key is read in `lib/storage.ts` and `lib/waitlist-db.ts` and nowhere else;
* both files are `server-only`;
* neither is the token read path.

**They are deliberately not labelled J3.** J3 says "exactly one server route". Widening D-80 to two files was flagged for BUZ and John in `lib/storage.ts` and never decided. `gate-coverage` does not count J1–J48 at all (they are bullets), so J3 stays uncounted rather than falsely met.

## Ran

**From a fresh seed,** in TRAINING §4 order. Timing ran on a freshly started app and a fresh seed, per the note now in TRAINING.

| Check | Result |
|---|---|
| perms | 1513/1513 |
| render | 529/529 |
| write | 381/381 |
| layout, 375 and 1280 | 196 views, ALL GREEN, CSP included: the injection probe refused under the header and ran without it, and no page refused anything |
| timing | 11/12. E10 PASS, J61 PASS, **L40 FAIL** (Found 1) |
| tsc | clean |
| palette | ALL GREEN |
| corpus | 0 failures, 0 warnings |
| gate-coverage | 262/262 pinned |
| secret-scan | no secrets |
| validate-migrations | ALL GREEN |
| `build:check` | green |
| `test:csp-prod` | 5/5, on port 3170 with the dev app stopped |

For comparison, the starting line was perms 1420, render 525 and write 369. The merge brought in the clean-up round's checks.

**Timing, per row,** final run on `3db2243`, fresh app and fresh seed:

| Row | Result |
|---|---|
| **E10** | 300 rounds × 5 states, medians 27.66–27.85 ms. Largest shift against E9 was −0.23 ms (p 0.025). **Resolution 0.63 ms.** PASS. E10b: identical bytes |
| **L40** | 108 against 108. Limited median 9.01 ms, real 11.28 ms. **+2.36 ms, p < 1e-10.** Resolution 0.63 ms. FAIL. L40b: one response shape |
| **J61** | 600 and 800 rounds, each held page against its twin. Shifts +0.06 and +0.13 ms (p 0.72, 0.32). **Resolution 0.70/0.66 ms.** PASS. J61b: identical bytes |

**Earlier runs, for the record.**
* **E10** passed on every run where it resolved, at 0.63–0.90 ms.
* **L40** failed on all eight runs, at +2.04 to +2.76 ms.
* **J61** passed once on a quiet afternoon (0.86/0.63 ms). It then reported **INCONCLUSIVE** twice at load 15–31, with resolution 1.5–2.3 ms. It did not pass on a blind instrument.

  I then paired each held page with its twin. The run after that was cut short when `next dev` restarted itself at its memory threshold, and the suite now says so in words.

### How each new check was proved red (L19/L20)

| Check | Bug put back | Result |
|---|---|---|
| layout: CSP refusals | `script-src 'self'`, no nonce | 119 refusals, exit 1 |
| layout: injection self-test | `script-src 'self' 'unsafe-inline'` | "SELF-TEST FAILED", exit 2 |
| `csp-p1`/`p2` | `eval` always on | FAIL |
| `csp-p4` | proxy back to `!== 'production'` | FAIL |
| `csp-prod-check` | a build with `dev: true` forced in `proxy.ts`; its self-test also runs the dev policy through the same assertion on every run | `cspb2` FAIL |
| `sms-p2` | the higher cap wins | FAIL |
| `sms-p4` | send layer reads the switch and ignores it | FAIL |
| `sms-p6` | ceiling refusal removed | FAIL |
| `sms-p7` | a log word without a page line | FAIL |
| `sms-p8` | `SMS_WORDS_APPROVED = true` | FAIL |
| `sms-w4`/`w6`/`w9`/`w11` | send layer ignores the switch and the cap | 4 FAIL (2/4/6/6 against 0/1/1/2). That run also exposed a counting fault in the test: each text was counted twice, because the number is in React's payload too. Fixed in `93a347a`, and the corrected counter was checked against that same outbox: 3 SMS rows read as 3. The red run was not repeated with the corrected counter |
| `al-u2`/`u3`/`u5` | no 0071 | 3 FAIL |
| `al-u6`, and the clean-up round's I1 | 0071 without the erasure exception | FAIL |
| `srk1` | the key named in a third file (`lib/ids.ts`) | FAIL |
| `pf1` | one pre-flight query changed in the doc | FAIL |
| `sm1` | sitemap back to `claimed` only | FAIL |
| gate-coverage | timing suite left out | E10, J61 and L40 open, exit 1 |
| E10 | a dead link past its date waits 2 ms; a revoked one makes one extra database query | E7 +4.94 ms and **E4 +1.06 ms**, both DISTINGUISHABLE, on the final design (29 Sep). The first design gave +4.59 and +1.37. **One extra round trip is visible locally** |
| E10b | the same bugs | FAIL. The slower branch changes React's payload row order, so it changes the bytes too |
| J61 | the register page sleeps 2 ms per withdrawn registration | `/club/register` +1.94 ms, p < 1e-10, on the final paired design. The first design gave +2.34 ms |
| L40 | none needed | it is red on the real code |

## Found

1. **L40 is red. The gate is not met, and it was green by proxy.** A send refused by the daily limit answers faster than a real send. Eight runs on 28–29 Sep, with n = 108 per arm:
   * +2.04 to +2.76 ms;
   * p below 1e-10 each time;
   * resolution 0.3–0.9 ms.

   The cause: the limited path makes two inserts, and the real path makes a transaction plus the outbox rows. **In production it is far worse.** `lib/messaging` calls the email provider inline for a real send (`dispatch()`, production only), so the gap becomes a network round trip to Resend. Doc 14 §K condition 7 names the send path as "a surface a stranger can poke". I did not fix it: when a send's work happens is a product and architecture call. Options for Leo:
   * **(a)** Answer both paths no sooner than a fixed floor measured from the request's start. Simple, but the provider's tail latency can exceed any floor.
   * **(b)** Move the provider dispatch and the post-commit emails out of the request (Next's `after()`, or leave it to the retry sweep), and give the limited path the same database shape.
   * **(c)** Both.

   The timing suite will say which works.
2. **§4 cannot be wired honestly: no product path ever creates a second guardian.**
   * `guardianship_link` is inserted in exactly one place, `approveInvitation` (`lib/guardian-flow.ts:281`).
   * An under-16's approval always creates a new child, so no other guardian can exist at that moment.
   * A 16–17 names exactly one parent, once, at sign-up (`app/join/actions.ts`, `createAccount`).

   So §4's only worded event, "Sam approved Deniz's football profile", can never occur with a second guardian present. For a 16–17 the parent's act is confirming they are the parent (§1b/§2b), and §4's words would be untrue there. **The same holds for §36 and doc 14 F1–F5 and L17: they happen on seeded data only.** Wiring §4 into an unreachable branch would be a check that cannot fail. Options for BUZ:
   * **(a)** Record that D-51's two-guardian case does not exist at launch.
   * **(b)** Design "add a second parent". That is new product: an invitation from guardian 1, two-channel proof (D-156), and doc 15 copy.
   * **(c)** Word §4 now for each guardian action, so it is ready: replace link, renew, pause, the 16–17 send switch, switch off one link, delete, take off a register, approve a card, approve an edit, answer an invitation, answer an access request.
3. **§9 conflicts with the spec, so it is not wired (L28).** Doc 29 §4 (3 Sep, the build brief for this form) says **"Send no confirmation email. The page promises 'nothing before that': one email, at launch, and no other."** The live page says the same, twice:
   * `components/coming-soon/data.ts:115`: "you'll get one email when the whistle goes — nothing before it";
   * `ComingSoon.tsx:1338`: "We'll email you once, when it opens. Nothing else until then."

   **The consent stored with every row reads "one email when we open, unsubscribe in it"** (`lib/consent.ts`). Sending §9 on signup would go beyond what each person agreed to. §9's own "We'll email you once, when we go live" would be the second email.

   The Spam Act asks for consent, an identified sender and a working unsubscribe. The consent record already exists (`consent_text`, `policy_version`). A confirmation email is not a legal requirement; John should confirm that.

   Options for BUZ:
   * **(a)** Retire §9: doc 15 defers to doc 29.
   * **(b)** Send it. That needs new page copy and new consent text, and never for people already on the list.

   If (b), the send needs the row's `unsub_token` back from `insertWaitlist` (today `return=minimal`).
4. **The release report missed the CSP in `proxy.ts`.** Its "no Content-Security-Policy header at all" was wrong. The header had never been checked in a browser, though, and now is.
5. **Vercel Web Analytics runs on every page, including `/p/[token]`** (`app/layout.tsx`, no `beforeSend`). The URL carries a child's share token. Once analytics is switched on in the Vercel dashboard, page paths, tokens included, land in analytics. That is against CLAUDE.md §1 (no token in logs) and pillar zero 5 (no analytics on minors). It is inert until switched on. Not fixed: outside my lane.
6. **The token read path has no rate limit.** CLAUDE.md §2 asks for one. This is why the timing bar is statistical rather than a tolerance.
7. **Doc 14 M6 says "the row is removed". `fn_withdraw_registration` keeps it**, setting `withdrawn_at` and emptying the note. The club cannot read it: J61b's bytes are identical and J61's timing is not distinguishable. Leo and John: is a soft withdrawal what M6 means?
8. **The clean-up round's render check "E9/E10" is coarse.** It takes 9 samples and passes unless the medians are 40 ms or more apart, and it would pass under both bugs I planted (+1.4 ms, +4.6 ms). It is theirs, so I left it. It and the timing suite both pin E9/E10 in `gate-coverage` now.
9. **Leo's "csp-probe on 3160": no request crossed ports.** The builders' sessions share one scratchpad directory, and both of us wrote dev-server output to `scratchpad/app.log`. The "3160 log" was the file my 3170 server was writing into, and their restart truncated it. My files moved to a folder of their own. The same collision can happen to any seat, and to backups kept there.
10. **Pre-0051 alumni entries are still unconfirmed on the public wall.** From 0071 they cannot be edited unconfirmed. Whether they stay up is for BUZ: the eighth query in `RELEASE-PREFLIGHT.md`.
11. `alumni_entry.added_by` and `.adults_confirmed_by` reference `person` with no `ON DELETE`. 0067 handles a child. Deleting an **adult** who added an entry would fail on the foreign key. There is no adult deletion yet.
12. **Machine.** Free disk fell to **4.5 GiB** mid-afternoon. My `.next` was 0.86 GB and `builder-final-a` had just started. I stopped my processes by port, deleted `.next` and waited for 8 GiB before going on.

    **My slip:** I started the final layout run at a one-minute load of 24.9. The command printed the number instead of waiting on it. From then on I waited for the load before starting.

## Copy for BUZ

All held. The SMS card renders outside production only (`SMS_WORDS_APPROVED = false` in `app/ops/switches/page.tsx`). Re-used words that were already on screen: "Why", "What happened", "On", "Say why. It goes in the log."

* Section label: `SMS`
* Pill: `Off`
* State line: `$1.20 of $20.00 spent this month`, or with no limit in force `$1.20 spent this month`
* Explanation, when on: `Switching SMS off stops every text Pitch sends until you switch it back on — including the approval texts parents need, so no child can be approved while it is off. Email keeps working.`
* Explanation, when off: `No texts are going out. A parent waiting to approve a child cannot finish until SMS is back on.`
* Explanation, when the environment has it off: `SMS is switched off in Vercel, so it stays off whatever you press here.`
* Buttons: `Switch SMS off` · `Switch SMS back on`
* Cap form, with a limit in Vercel: `The limit set in Vercel is $20.00 a month. You can lower it here, never raise it. A new limit applies from the next text.`
* Cap form, without one: `No limit is set in Vercel. In production that means no text is sent at all, whatever you set here.`
* Field label: `Monthly limit, in dollars` (placeholder `20.00`, or the current limit)
* Buttons: `Set this limit` · `Go back to the limit set in Vercel`
* Banners:
  * `SMS is off. No texts will go out.`
  * `SMS is back on.`
  * `The new limit applies from the next text.`
  * `The limit is back to the one set in Vercel.`
  * `Nothing was changed. Type the limit in dollars, more than zero.`
  * `Nothing was changed. That is above the limit set in Vercel. Raise it there if it has to go up.`
* Switch log lines, each followed by ` · $x.xx` where a cap was set:
  * `Switched SMS off`
  * `Switched SMS back on`
  * `Lowered the SMS limit`
  * `Put the SMS limit back to the one set in Vercel`

"Vercel" is named because the operator sets the ceiling there. If BUZ prefers "in the settings", that is one word per string.

## Risks

* **The timing suite is local.**
  * The dev database answers in well under a millisecond, so a branch that makes one more query costs here a fraction of what it costs in production. It was still caught locally (+1.37 ms).
  * A real send's provider call is not in any local run.
  * A 1 ms resolution on `next dev` is not a claim about production's resolution.
  * `RENDER_BASE` can point the suite at a production build. It has not been run there.
* **The timing suite depends on the machine's quiet.** At load 15–31 J61 correctly reported INCONCLUSIVE (1.84/1.52 ms, then 2.34/1.99 ms). On a busy day it takes longer (10–30 minutes) or fails as inconclusive. It never passes on a blind instrument.
* **`next dev` restarts itself** at its memory threshold after enough requests. One run was cut short that way. The suite now stops with a sentence saying so, and TRAINING says to start it on a fresh app.
* **E10 and J61 on the paired design were each proved red once** (above). The write checks' red run used the double-counting version of the counter (see the table).
* **E10's fixtures use short dev tokens** (`dev-deniz`, 9–11 characters) against 43-character random ones. E4/E5 leaned about 0.3 ms faster (p 0.01–0.02, not significant at the bar). That is a fixture confound, not an attack path: an attacker's guesses are all full length. Real-length dead tokens would remove it and need a seed change.
* **E10b compares one captured body per state.** React's payload rows follow render order, so a real timing difference changes the bytes. That is correct, but in principle heavy load could perturb the order. It has not been seen in five green runs.
* **The SMS switch's end-to-end proof is in development only.** In production the send layer also dispatches; the switch sits before the meter and the outbox, so it is ahead of dispatch.
* **Not checked:** a real Stripe redirect in a browser under the policy (no keys); an iframe of youtube-nocookie under the policy in the layout walk (no page plays a clip without a click).

## Lesson

**A guard you add can break a path you do not own, and "no product path updates this table" is not the same as "nothing updates this table".** 0071's first version was right about the app and wrong about the database: the clean-up round's erasure, landing on `app` the same afternoon, updates `alumni_entry` to take a child's name off. Only the merged, full permission suite showed it.

*Rule:* before adding a trigger to a table, grep every migration, not just `app/` and `lib/`, for writes to that table. Include what is on `app` now, not only what was there when you branched.

*Second, from the timing work:* two measurements taken one after the other are not a comparison on a shared machine. Put the thing you are not changing in the same rounds.
