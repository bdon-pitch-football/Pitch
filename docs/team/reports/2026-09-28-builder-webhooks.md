# builder: the receipt, the delivery receipts, and the labels a parent reads (28 Sept 2026)

**Tree:** `.claude/worktrees/builder-webhooks`, branch `builder-webhooks`.
**Measured on:** `facb54d`, with `app` at `02552f9` merged in (merged, not rebased; three merges this task: `c979a3b`, the legal build, `02552f9`).
**Ports:** database 54352, app 3150, Chrome CDP 9353. Nobody else's. Everything stopped by port.
**Build output:** `.next`, `.next-check`, `.next-demo` deleted. The worktree's `node_modules` is back to its symlink (Turbopack refuses a symlink that points outside the project, so for the runs I used a hard-link copy, `cp -al`, which cost no disk. It is deleted too).

Asked: wire doc 15 §31/§32 to the Stripe webhook, with the receipt going to the club and not the person. Make provider delivery receipts write the consent spine (D-78), building only what `lib/providers.ts` makes verifiable for SMS. For each consent-log label that nothing writes, decide: wire it or remove it. `email_opened` is a deletion, never a build.

## Did

**The five labels nothing wrote**, all in `app/g/controls/[childId]/page.tsx` `EVENT_LINES`:

| Line | Key | Label | Decision | Why |
|---|---|---|---|---|
| 94 | `email_delivered` | "That email reached your inbox" | **Wired** | D-78 names it. The Resend receipt already arrived and stopped at the outbox column. |
| 95 | `email_opened` | "You opened that email" | **Remove (proposed, left in place)** | Only an open-tracking pixel could write it. That is surveillance of a parent reading about their own child, and doc 14 J41 refuses the same thing for links. Not built. |
| 97 | `sms_delivered` | "That text reached your phone" | **Wired** | Twilio's status callback is part of the API `lib/providers.ts` already posts to (below). |
| 98 | `guardian_landed` | "You opened the permission page" | **Wired** | The middle of D-78's funnel. Seeded in dev and written by nothing in production (L13). |
| 119 | `age_transition` | `` `${theirs} age band changed` `` | **Wired** | Doc 14 F8 requires "age transition" in what the guardian sees. |

**I changed no lines in `app/g/controls/[childId]/page.tsx`.** `git diff app..HEAD` on that file is empty, so the other builder's `fn_who_looked` card merges without guessing.

**`supabase/migrations/0065_delivery_receipts_reach_the_spine.sql`** (renumbered from 0063, which `app` took):
* `message_outbox.subject_id` records who a message is **about**, which is not who it went **to** (`to_person`). Without it a receipt has nothing to attach to.
* `fn_record_delivery(provider_id, outcome, reason)` is the one writer of a provider receipt. It moves three things together in one statement: `delivered_at`, the spine row (`email_delivered`/`sms_delivered`, chosen from the channel the message went out on), and 0013's `age_transition_notice.delivered_at`. That last one closes doc 14 B11: the notice was commented "written by the provider receipt" and nothing wrote it.
* A retried receipt writes nothing. A receipt for a message we never sent writes nothing.
* A bounce goes on the outbox row and writes no spine row, because the vocabulary has no word for one (L5).
* `fn_record_age_transitions()` writes one row per band reached (`16_17`, `18plus`), with `detail.on` set to the day the band changed. It looks back 7 days and uses the band as the key, so it never writes twice.
* `fn_record_guardian_landed(invitation, channel)` writes once per open invitation and nothing once the invitation is approved or held. The subject is the child only where a child exists (a 16–17); an under-16 has none, by D-17.

**`app/api/stripe/webhook/route.ts`**
* `invoice.payment_succeeded` is new. It sends the §31 tax invoice to `club.contact_email`, or sends nothing: it never falls back to the payer. It writes no subscription state.
* An invoice now resolves its club. Stripe puts the club id under `subscription_details.metadata`, not `metadata`, so the dunning branch never fired before this. `stripe_customer_id` is the fallback.
* `invoice.payment_failed` now sends §32 **once, when dunning starts**, and keeps a grace that is already running. Stripe fires this event on every retry, and each retry would otherwise have pushed the pause date out another 14 days (D-135, doc 14 O4) and sent another §32.

**`lib/receipts.ts`** (new, pure) builds the §31 fields.
* GST is one eleventh of the GST-inclusive total (D-148): $29.91 on $329.00.
* The renewal date comes from the invoice period, or from the plan if the invoice has none.
* The 14-day cooling-off sentence is on the annual plan only.
* A $0 invoice gets no tax invoice.
* The receipt number is Stripe's: `number`, else `id`.

**`lib/messages.ts`**: `paymentTakenEmail` takes one object instead of nine positional strings. The card fragment is omitted when we have no last four digits (copy below).

**`app/api/webhooks/resend/route.ts`**: delivered and bounced both go through `fn_record_delivery`. The comment says why `opened` is refused.

**SMS: `app/api/webhooks/sms/status/route.ts` (new), `lib/twilio-signature.ts` (new), `lib/providers.ts`, `app/api/webhooks/sms/route.ts`.** `lib/providers.ts` posts to Twilio's Messages API, so I treated that API as the contract.
* Sending now includes `StatusCallback`, but only when `NEXT_PUBLIC_SITE_URL` is https.
* The status route verifies Twilio's signature, then reads two parameters, `MessageSid` and `MessageStatus`. It acts only on the terminal statuses `delivered`, `undelivered` and `failed`.
* The signature check moved into one module shared by both Twilio routes.
* **Not verified:** a real Twilio callback. Sender registration is parked.

**`lib/messaging.ts`, `lib/guardian-flow.ts`, `app/a/[id]/page.tsx`, `app/api/jobs/daily/route.ts`**
* `sendAndLog` carries the subject onto the outbox row.
* The approval page calls `recordGuardianLanded` after its finished-link 404.
* The daily job runs `fn_record_age_transitions`.

**`scripts/permission-tests.mjs`**: 48 new checks, listed under Ran. The suite goes from 1338 to 1388 because `sendl13`/`sendl14` also run on the new route.
* Four of the 48 gate the guardian's log itself: F8e (every spine word has a line), F8f (every line has a writer), F8g and F8h (the one exception is named with its reason).
* I removed the "Stripe is not connected yet" exceptions for §31/§32.
* I made the new labels unique, because `O2`, `O2b`, `O3`, `O3b`, `O10`, `F8` and `B11` already meant something else in the suite.
* Row ids are only used where the check tests that row (L4). The receipt-body check is `rcpt2`, not `O10`, because doc 14 O10 is about what Stripe receives.

## Ran

On `facb54d`, fresh seed, TRAINING §4 order. Load 4.9–9.0 on 14 cores; 16–19 GiB free.

perms **1388/1388** · render **520/520** · write **354/355** · layout **196 views at 375 and 1280, 0 overflow, ALL GREEN** · tsc clean · gate-coverage **262/262** · palette green · corpus 0/0 · secret-scan clean · `build:check` exit 0.

**The one red, `sq8c`, is `app`'s, not mine.**
* `02552f9` (D-162) changed the U15 tile from "0 Goalkeepers" to "No goalkeeper yet".
* `write-tests.mjs:1796` still matches `/Goalkeepers/`.
* The page and the check are both byte-identical to `app`. Not fixed; it is someone else's file.

**L20: every new check went red with its bug put back, and the file was restored afterwards.** Bugs are grouped where their failures fell on separate labels.
* **Receipt:** no `payment_succeeded` branch → O3e, D-136g. Club id read from `metadata` only → D-135. Fall back to the payer → O2d. Fixed address → O2c. A person query in the hook → O2e. GST at /10 → D-148, D-148b. Renewal on the day paid → D-136, D-136b. Always refundable → D-136c. $0 is a charge → D-136d. Invoice number ignored → D-136e. Body and card line changed → D-148c, D-136f, rcpt2, §31b, §31. Second caller → rcpt1.
* **Dunning:** the previous branch → O4f, dun1.
* **Spine:** outbox written straight from the route → D-78. Body read before verify → D-78b. An `email_opened` writer → D-78c, F8g. No spine insert → D-78d/e/g/h/i and F8f (`email_delivered`, `sms_delivered`). Delivery not idempotent → D-78f. Notice update removed → B11d.
* **Signatures:** signature always accepted → D-81. 401 → 403 → sendl13. 503 removed → sendl14. Outbox not claimed → sendl17d.
* **Age transitions:** writer returns 0 → F8a/b/c and F8f (`age_transition`). No `on` → F8b. No guard → F8c. Job not calling it → agex1.
* **Landed:** no writer → F8f (`guardian_landed`). No guards → land1, land3. A subject for an under-16 → land2. Subject always null → land4. Called before the 404 → land5.
* **The screen:** map renamed → F8e. Label removed → F8h.

**Two of my own checks could not fail, and I only found out by proving them (L19):**
* **D-78** asserted the route *mentions* `fn_record_delivery`. It stayed green with the old outbox write back, because the bounce branch still called the function. It now asserts neither route writes the outbox or the spine itself.
* **D-78b** compared the index of the *import*, which always comes first. It now finds the call.

Both have been re-proven red on today's code.

**Not independently proven:** B11c. It is the precondition "no delivered notice, no discovery", true both before and after this change, and the existing `B11` (suite line 275) already pins it.

## Found

1. **Removing `email_opened` takes two changes.** The existing `ctl6` requires every vocabulary word to have a line on the page, and it went red when I removed only the label. The removal is therefore the label plus a migration dropping the word from `consent_event`'s CHECK. The word is in 0002, 0033 and 0052, so it needs a fresh `create`. F8h then tells whoever does it to delete the `NO_WRITER_BY_DECISION` entry.
2. **The grace still slides on the subscription path.** `fn_apply_subscription` (0012/0032) overwrites `grace_until` on every call, so each `customer.subscription.updated` with `past_due` restarts the fortnight. I fixed only the invoice branch I made reachable. The billing seat's O4c moves a club to "suspended" by re-applying `past_due` with an expired grace, which depends on that overwrite. Whether any later event may move a running grace needs a decision from Leo and that seat.
3. **Doc 15 §32's "one reminder at day seven, one at suspension" is not built.** Doc 15 has no text for either, so it needs copy before code.
4. **Nothing in the product writes `club.contact_email`.** Only the import and seed do (L13). Every club that reaches billing came through `/claim`, which requires one, so "no mailbox, no receipt" is unreachable today. But if an address were ever cleared, `/club/billing`'s "Payment received. Your receipt is on its way to the club." would be false.
5. **A parent of an under-16 gets no funnel lines on their child's log.** "We emailed you", "That email reached your inbox" and "You opened the permission page" all carry no subject, because no child exists before approval (D-17). This is pre-existing and not changed here. Linking those rows to the child at approval is a product decision for BUZ.
6. **`guardian_landed` can be written by a link-preview bot fetching the page, not only by a parent.** D-78 defines the state as the page being opened. Writing it on the first press instead would coincide with `*_verified`. Leo's call.
7. **For release:**
   * `StatusCallback` is only sent when `NEXT_PUBLIC_SITE_URL` is https.
   * Twilio signs callbacks with the account **auth token**. Both Twilio routes verify with `SMS_WEBHOOK_SECRET`, so that variable must hold the auth token, not the API key.
   * The status URL to register is `/api/webhooks/sms/status`.
8. `qa-silent1` is green on `app` now (it was red on this branch before the last merge).

## Copy for BUZ

* **Proposed removal (left in place until you say):** `You opened that email`. Controls page line 95; the vocabulary word `email_opened` goes with it (Found 1).
* **Now reachable for the first time.** The copy is already approved, but no parent could see these before: `That email reached your inbox` · `That text reached your phone` · `You opened the permission page` · `Georgia’s age band changed` (the form is `<name>’s age band changed`).
* **§31 card line, proposed.** A Stripe invoice has no card digits, so without them the line reads `receipt PF-00184`. With them it reads exactly as approved: `Card ending 4242 · receipt PF-00184`.
* **§31 plan lines** (the first is doc 15's): `Interest Register — 12 months` · `Interest Register — monthly` · fallback `Interest Register`.
* **Two differences from doc 15 that I inherited and did not change:**
  * The subject uses the club's stored name where doc 15 shows the short name ("Riverside FC").
  * The refund sentence prints `$329.00` where doc 15 has `$329`.

## Risks

* No real Stripe or Twilio request has touched either route. Payload shapes are read narrowly and checked at runtime, but a live test is still owed on the day each key is set.
* The render and write suites cannot reach the webhooks: the dev app has no secrets and answers 503. The webhook tests are therefore source-shape checks plus database behaviour.
* The migration number `0065` may collide with another in-flight branch.

## Lesson

Prove a new check before you trust it, including your own. Two of mine passed with their bug put back, because each matched a word in the file (an import, a bounce branch) rather than the path the rule is about.
