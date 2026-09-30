# builder: Send my CV fills in the club's address; a club can stop CVs (30 Sep 2026)
Asked: build John's ruling of 30 Sep §2 (Leo's brief). From a club's page, the send screen fills in the club's own role address in full, with its source and date. It stops filling after 90 days. The CV email gets a working opt-out. A club that opts out is never sent to again, including at an address a family types by hand. The operator can stop a club.

Did (commit 8973f6a on `app`, not pushed):
- `supabase/migrations/0160_send_to_the_clubs_own_address.sql`
  - adds `club.contact_checked_on`, backfilled from `coalesce(listed_at, created_at)` as a Melbourne date. A trigger stamps today whenever `contact_email` is inserted or changes, and nulls it when the address is removed.
  - adds `fn_role_address` (immutable, fails closed). It uses Leo's role-token list and the club-name word rule.
  - adds `send_block`. RLS is on with no policies. Each row holds an address or a domain, and both are unique. `club_id` is set null when the club is deleted. `source` is 'recipient' or 'operator'.
  - adds `fn_free_mail_domain` (broad list: .com, .com.au, .net, .net.au, .on.net, .co.uk, .me), `fn_send_address` (the same parse as 0066), `fn_send_blocked` (the address, its domain or a parent domain), `fn_club_send_blocked`, `fn_club_domain_stoppable`, `fn_send_address_for_club` (the date is returned only with the address) and `fn_send_stop_request`.
  - adds `fn_ops_stop_club_sends`. It uses `fn_ops_operator`, and the `curation_event` action check is extended with `club_sends_stopped`.
  - adds `fn_ops_club_sends` (two booleans) and the `share_request_not_stopped` trigger. The trigger refuses setting `dispatched_at`, on update or insert, for a stopped destination.
- `lib/send-dispatch.ts`: the pick-up skips a stopped destination and returns null. `cvToClubEmail` now receives `{ requestId, sig }`.
- `lib/stop-cvs.ts` (new): HMAC-SHA256 of `stop-cvs:<id>` under SESSION_SECRET, base64url. It refuses in production without the secret, and compares with `timingSafeEqual`.
- `lib/messages.ts` §19: the last line now carries the stop link, in both variants. The first sentence is unchanged.
- `app/send/[recordId]/actions.ts`: `composeSend` asks `fn_send_blocked` after validation and before any insert, rate count or log, on both paths. A stopped address goes to `?blocked=1`.
- `app/send/[recordId]/page.tsx`
  - takes `?club=<slug>` (a-z, 0-9 and hyphens, up to 80 characters) and reads `fn_send_address_for_club`.
  - a stopped club, or `?blocked=1`, shows only the Status.
  - otherwise it fills in the club name, and the address in full when the database offers one, with the new line under it. Both fields stay editable.
- `app/fc/[slug]/page.tsx`: both "Send … CV to {club}" links pass `?club={slug}`.
- `app/g/send/[requestId]`
  - the page shows the same neutral Status, with no button, for a request whose destination is now stopped.
  - the action looks up "stopped?" only for the guardian's own request, before the answer floor (lim-floor3 holds), and lands back on that page. Every other failure still goes to `/home`.
- `app/stop-cvs/page.tsx` and `actions.ts` (new)
  - a GET changes nothing and shows the same page whatever the signature.
  - a POST reads its ids from the form, runs `checkRate` (20 per hour per IP), then verifies the signature and calls `fn_send_stop_request`. Every outcome lands on `?done=1`.
  - `next.config.mjs` serves `/stop-cvs` with no-referrer and X-Robots-Tag noindex.
- `app/ops/clubs/[clubId]/page.tsx` and `actions.ts`: `stopClubSends` (operator() first, one database call). The page shows the button when an address is held, and the stopped line once it is stopped.
- Seed (`scripts/dev-db.mts`)
  - Kestrelford Athletic SC (Preston) holds a personal-name address.
  - Wrenmoor Wanderers FC (Altona) has its address and domain stopped.
  - Georgia's request id is exported as `georgiaAsk`.
- `scripts/demo-layer.mts`: the new §19 argument.
- Doc 15 §19 is updated in `docs/15-Message-Copy.md` and `../15-Message-Copy.md`, marked approved 30 Sep with a pointer to APPROVALS-28-SEP.

Ran (fresh seed, app on 3280, measured on 319d8df/9dfc7c3 + this change):
- perms 1942/1942
- render 658/658
- write 517/517
- layout 238 views at 375 and 1280, 0 overflow, all green. It now measures the filled and stopped send screens and /stop-cvs.
- build:check ok
- csp-prod 5/5
- corpus clean
- secret-scan clean
- gate 263/263
- tsc 0 errors
- palette green

New checks are prefixed sc-: perms sc-1..18, sc-s1..s7 and sc-m1; render sc-r1..r10; write sc-w1..w8. Updated: cur-s1 (7 to 8 doors), cur-s3 (allowlist adds `fn_ops_club_sends`), and msg19a–c (new argument). Proven on old code:
- with the check, the trigger, the production refusal or the old §19 text removed, sc-m1, sc-15, sc-s1, sc-s2 and sc-s6 fail.
- with composeSend's refusal removed, sc-w5, sc-w6 and sc-w8 fail.

Found:
1. **"Publishes on its own website" may be untrue for some clubs.** The prefill follows the spec: any non-suspended club. For a claimed or verified club, `contact_email` may not be the address on its website. The club page only links `?club=` for unclaimed clubs, but the URL accepts any slug. Options: (a) fill in only for `unclaimed`; (b) keep as is. Not chosen.
2. **All 138 production addresses stop filling around 29 Dec.** Nothing re-stamps `contact_checked_on` except changing the address. Options: an ops "address checked today" button (new copy), or a re-stamp in the import script. Not built.
3. **A stop link can do nothing if the family has deleted the child.** The request row is deleted with the record (cascade), so the stop finds no address and the club still sees "Done". Options: keep the stopped-address reference per dispatched send beyond deletion, or accept it.
4. **The rate limit can drop a genuine opt-out.** Past 20 presses per hour from one IP, a real stop is not recorded, and the done screen looks the same. That is unlikely for a club, but it is an opt-out.
5. **One domain rule is my reading, not the brief's.** A domain is not stopped if another listed club's address is on it. Stopping it would stop a club that never asked. Leo or John to confirm.
6. **A stop is permanent.** There is no un-stop function, and the ops button has no confirm step, by design (no new copy).
7. After a validation error (`?error=1`) the filled-in values are lost, because `club` is not carried through. The fields show blank.
8. The role list lacks `treasurer`. Against the local club CSV (213 clubs, 144 addressed; counts only), `fn_role_address` accepts 143 of 144, and the one miss is `treasurer@`.
9. **Out of lane:** `../15-Message-Copy.md` has drifted from the repo copy (help@ addresses, missing HELD/RETIRED notes). I edited only §19 in both copies.
10. **Out of lane:** D-99's text ("no Pitch-initiated send to an address we compiled") may want a line recording John's clearance of the prefill. That is Leo's call.

Copy for BUZ (Leo says all approved 30 Sep and APPROVALS-28-SEP records it; I did not see BUZ's own word):
- Send screen, under a filled-in address: "The address {Club} publishes on its own website, checked {D Month}. Change it if you have a better one." (for example "checked 30 September")
- Blocked (send screen, and the guardian's /g/send page): kicker "Not sent" · title "We can’t send to this club through Pitch" · body "Nothing has been sent."
- §19, last line (family variant): "You received this because a family sent you their child's CV. We did not add you to a list. To stop CVs reaching this address through Pitch: pitchfootball.com.au/stop-cvs?r={id}&t={sig}". Self variant: "You received this because a player sent you their CV. We did not add you to a list. To stop CVs reaching this address through Pitch: …"
- /stop-cvs: "Stop CVs to this address?" (also the tab title) · "Pitch won’t send CVs to this address again. Families can still contact the club in other ways." · button "Stop them" · done: "Done" · "Pitch won’t send CVs to this address again."
- Ops: button "Stop CVs to this club" · "CVs to this club are stopped."

Risks:
- fn_role_address was measured on a local CSV, not on production.
- The free-mail list is a judgement: a missing provider would stop a whole shared domain for one club.
- The write suite cannot read the database, so "nothing created" on a refused send is observed through the product only: no outbox message and an unchanged list.
- Not checked on a real phone.

Lesson: sc-s6 ("in production it throws") first passed while `lib/stop-cvs.ts` could not be imported at all (a missing `.ts` extension). The throw came from the import, not from the rule. It was caught only because sc-s5 failed beside it. When a check asserts that something throws, assert in the same block that the same call succeeds without the condition.
