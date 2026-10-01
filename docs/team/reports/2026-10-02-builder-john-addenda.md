# builder: John's addenda rulings: 30-day addresses, the hourly meter, E15, E.164, 0169's count (2026-10-02)

Asked: build John's 2 Oct rulings (`13-Board-Room/JOHN-to-LEO-parents-change-only-and-addenda-4-5-2-oct.md` §3, §4, §5) on `build/john-addenda`. That branch is `build/full-release` at b111127. Worktree `.claude/worktrees/john-addenda`; ports DB 54581, app 3381, CDP 9581. `lib/cv-build.ts` was not touched.

## Did

### 1. An address is kept 30 days, then cleared (§3)

- **lib/sent-bodies.ts.** The one statement, `SCRUB_SENT_BODIES`, now also blanks `to_address` on any row that ended more than 30 days ago.
  - "Ended" means sent, refused for good, or given up on (`attempts >= 6`).
  - The clock is `coalesce(sent_at, failed_at, last_attempt_at, created_at)`, so a given-up row counts from its sixth try, not from when it was made.
  - `attempts`, the provider id, the key, the times and the invitation all stay.
  - A message still to go keeps its words and its address.
  - New: `COUNT_STALE_ADDRESSES`, built from the same two clauses.
- **0169 §4 (edited in place).** It is that statement, byte for byte. The header now says addresses are kept 30 days.
- **app/api/jobs/outbox/route.ts.** Unchanged in behaviour: the hourly sweep already runs the statement after every production run. Comment updated.
- **scripts/scrub-sent-bodies.mjs.** It prints the address count beside the existing count, as numbers only.
- **app/ops/support/page.tsx.** The console counts an invitation's §1/§2 messages by the parent's address **or** by `invitation_id`, and a blank address matches nothing (`to_address <> ''`). Why:
  - With the old query, once addresses blanked, an approved invitation's count fell to 0.
  - Worse, an invitation with a blank number counted every blanked row in the outbox: 21, then 24, in the suite.

### 2. The SMS meter forgets hourly, past 23 hours (§4)

- **0170 (new), `0170_the_meter_forgets_a_number_hourly.sql`.**
  - `fn_sms_forget_numbers()` moves meter rows older than 23 hours to the zero fingerprint and returns the count. It is idempotent, and anon and authenticated are revoked.
  - `fn_purge_pending` is redefined to `perform fn_sms_forget_numbers()` in place of its own 25-hour statement, so the daily path is a harmless belt with one window.
  - The column comment now says 23 hours, hourly.
- **app/api/jobs/outbox/route.ts.** It calls the function first on every run, before the release and before the development return, so it runs in every environment. `vercel.json` already runs this job at `0 * * * *`. The JSON response gains `forgotten` (a count).

### 3. A 16–17's parent mints no share link from /g/pending (doc 14 E15)

- **app/g/pending/[recordId]/actions.ts.**
  - `issueShareLink` now guards with `requireRecordAuthor(recordId)` and refuses anything but `'guardian'` with `redirect('/home')`. That is the same answer a stranger's press gets (D-77).
  - `approveChange` is unchanged (`requireRecordActor`).
- **app/g/pending/[recordId]/page.tsx.**
  - The `?done=1` state renders "Get the share link" only when `recordAuthor` answers `'guardian'`. A 16–17's parent sees the heading and sub, and no button.
  - The page guard is unchanged, so that parent keeps the page, approving, and everything else doc 14 gives them (R12c holds).
  - No new words.
- **docs/14-Permission-Tests.md.** New row **E15**, pinned by perms E15/E15b and write E15c. Gate coverage: 265/265, 0 open.

### 4. Numbers go to Twilio in E.164 (§5)

- **lib/number-hash.ts.** `normaliseNumber` is the one function. It returns `+614…` for an Australian mobile written any common way (`04…`, `614…`, `+614…`, with spaces, dashes, dots or brackets), and `null` for anything else (D-63). `keyedNumberHash` returns null for a non-mobile. The two forms still hash as one.
- **lib/messaging.ts.**
  - `send()` refuses a non-mobile (`sms_not_a_mobile`) before the fingerprint, the STOP list, the queue, the meter or the outbox.
  - `dispatch()`, the only caller of `sendSms`, hands Twilio `normaliseNumber(address)`. A row whose address is not a mobile is closed permanently (`failure_reason 'not_a_mobile'`, words cleared) without calling the provider, the same way a provider 4xx is handled.
  - The outbox still stores the address as typed, so the support console's match by address is unchanged.
- **app/api/webhooks/sms/route.ts.** `const from = normaliseNumber(params.From ?? '')` comes before the hash, the STOP record and both replies. A sender that is not a mobile is answered 200 and not read.

### 5. 0169 prints its clean-up count (§3)

- **0169 §4** is now a `do` block. It runs the statement, takes `get diagnostics n = row_count`, and raises one notice: `0169 §4: cleared N message row(s).`
- **scripts/apply-migrations.mjs** prints a migration's notices under its file name, only while that file runs. Before this, node-pg dropped notices silently, so a `raise notice` alone would have printed nothing in the release.

### Also

- **docs/team/GO-LIVE.md §5:**
  - apply 0167 → **0170**;
  - why 0170 must go before the push;
  - keep the 0169 count line with John's note;
  - the script's address count.

## Ran

Final code, in the briefed order: reseed → `next dev -p 3381` → perms → render → write → reseed → restart → layout → the rest.

- **perms 2181/2181** (baseline 2167, plus 14 new)
- **render 826/826**
- **write 641/641**
- **layout 274 views at 375 and 1280, ALL GREEN**
- palette ALL GREEN (250 files)
- `tsc --noEmit -p .`: 0 errors
- `NEXT_DIST_DIR=.next-check next build`: exit 0
- `test:csp-prod` (port 3381, dev stopped): 5/5
- corpus-check: 0 failures
- secret-scan: none
- gate-coverage: 265/265, 0 open
- validate-migrations: ALL GREEN

My first full write run went red on E15c (640/641): the suite signs Alex out in its sign-out block before the end, where I had put the check. I moved E15c to just before that block and re-ran the whole line from a fresh reseed. After that line I edited GO-LIVE §5 only, then re-ran perms (2181/2181), corpus (0) and secret-scan (none), which read docs. Servers are stopped, and `.next` and `.next-check` are deleted.

**New checks.** Labels are `ja-` except the E15 row's:

| Suite | Check | What it pins |
|---|---|---|
| perms | ja-addr-1 | blanked at 30 days for sent, failed and given up (from the last try); kept inside 30 days; a message still to go keeps everything; `attempts` stays |
| perms | ja-addr-2 | idempotent |
| perms | ja-addr-3 | three places, one statement; the script imports and prints the address count |
| perms | ja-addr-4 | support console: [3, 0] inside 30 days, [2, 0] past them |
| perms | ja-meter-1 | the job is scheduled hourly and calls the function first |
| perms | jr-purge-4b | the daily path asks the same function and has no window of its own |
| perms | E15 | `fn_record_author` answers, and the guard comes before the insert |
| perms | E15b | the page offers the press only to an author guardian; the 16–17's guardian keeps the page and approval |
| perms | ja-e164-1 | the forms of a mobile, and the non-mobiles |
| perms | ja-e164-2 | **control:** both forms are one hash |
| perms | ja-e164-3 | dispatch, send and the only caller of `sendSms` |
| perms | ja-e164-4 | the webhook |
| perms | ja-count-1 | the block runs under PGlite and its notice equals the count |
| perms | ja-count-2 | the runner prints notices |
| write | E15c | as below |

E15c presses through the app:
- Alex is not offered the button for Nate;
- his crafted press and Marina's (a stranger's) both return `[303, '/home']`;
- Nate's link card on /g/controls is unchanged;
- Alex's press for Georgia (15) still mints.

**Moved checks (none loosened):**
- **jr-purge-4** now tests the hourly function at the 23-hour boundary, with rows at 30h, 23h05m and 22h55m:
  - no row past 23 hours keeps a fingerprint;
  - the 22h55m row keeps its fingerprint and still counts (`fn_sms_count_24h` = 2);
  - every cent stays.

  These are the same three assertions as before, at a tighter boundary, on the job that now does the work. The daily path is jr-purge-4b.
- **jb-body-2**: its regex that extracts the statement allows the longer `set` list. Its row assertions are unchanged.
- **bf-s4-1**: the import regex accepts `COUNT_STALE_ADDRESSES`.
- **em-dispatch**: pins `sendSms(smsTo, body)` instead of `sendSms(address, body)`.

**Red on the old code (L20):**
- **New perms checks against b111127's product files** (11 product files plus 0170 removed; tests and doc 14 kept new): **15 failed.**
  - The 13 new checks other than the control ja-e164-2, which passes by design: the hash already treated both forms as one, and the brief says to keep that true.
  - Plus moved jr-purge-4 and em-dispatch.
- **Old support page with the new scrub:** ja-addr-4 red. It got `[3, 21]` inside and `[0, 24]` past.
- **E15c with b111127's /g/pending files, through the app, fresh seed** (render 826/826 first): the write suite gave **640 passed, 1 failed**, E15c only. It got:
  - `[true, true, [303, "/g/pending/<nate>?done=1&link=…"], [303, "/home"], false, true]`;
  - so the button was offered, the press minted a link, and Nate's link card changed.

## Found

1. **D-81's per-number limit tightens to 3 per 23–24 hours in the worst case.**
   - `fn_sms_count_24h` counts by fingerprint over 24 hours, and a fingerprint now goes at 23 hours.
   - This is what John's 23-hour figure means. It is written in 0170's header so Leo and John can see it. Not changed.
2. **A text that waited for SMS (§1, §1b) keeps a keyed fingerprint of the parent's number on its outbox row** (`message_outbox.number_hash`, 0120) after its address is blanked at 30 days. It keeps it for good unless the invitation is purged.
   - Doc 23 v1.7 does not mention it. The brief was the address, so I did not touch it. Options for John, none chosen:
     - **(a)** Clear it with the address at 30 days, to the zero fingerprint. The queued-text constraint needs a non-null. 0167's purge matches meter rows by outbox fingerprint, so it would need a guard against matching zero.
     - **(b)** Clear it at 24 hours, as the meter is cleared.
     - **(c)** Keep it, and say so in doc 23.
3. **/g/controls "Renew" and "Replace" still let a 16–17's guardian renew or mint that child's link.**
   - E15 covers /g/pending, as ruled.
   - John's principle ("the player shares and the guardian sees") may reach Replace. Doc 14 E4 gives a guardian regeneration. **For John. Not touched.**
4. **The /g/pending `?done=1` state still tells a 16–17's parent "{name}'s page is approved / Clubs holding the link now read this version."**
   - It is reached only by typing the address, or by approving a pending version from before the sixteenth birthday (R11).
   - The button is gone. The words are unchanged, because changing them needs copy.
5. **Doc sync for Leo:**
   - Doc 14's root copy needs E15.
   - The repo's `docs/legal/23` is still the pre-v1.7 text. The v1.7 draft's lines on the 30-day address and the 24-hour meter are now true in code, and John said "v1.7 syncs once it's true".
6. **The outbox stores numbers as typed.** 0009's column comment ("email address or E.164 number") is wrong for SMS rows, and the support lookup matches the number as typed. Not changed: changing either would move the console's count.
7. **Worth confirming:** a Vercel Hobby plan runs crons once a day, and within the hour. Doc 23's 24 hours depends on the outbox job really running hourly, on time.

## Copy for BUZ

None added, changed or removed. Not user-facing, for Leo:
- 0169's notice "0169 §4: cleared N message row(s).";
- the scrub script's count lines;
- the runner's notice line;
- the internal values `sms_not_a_mobile` and `not_a_mobile`.

## Migrations

- **0169**, edited in place: §4 also blanks addresses past 30 days, and prints its count. The header says why.
- **0170** (new): `fn_sms_forget_numbers`; `fn_purge_pending` asks it; the column comment.
- No new table (L26).

## Risks

- **The hourly job calls `fn_sms_forget_numbers` first.** If the code is live before 0170, the job fails every run and nothing waiting is released or swept. GO-LIVE §5 now orders 0170 before the push.
- **apply-migrations' notice printing was not run against real Postgres.** There is none on this machine. The notice itself is proved under PGlite (ja-count-1). node-pg's `notice` event is documented behaviour.
- **A STOP from a number that is not an Australian mobile is now answered and not recorded**, where before it was recorded. We never text such a number, so it would never be consulted. With no key, such a sender gets 200, not 503.
- **An outbox row with a non-mobile SMS address is now closed in dispatch** instead of being handed to Twilio. None is expected: /join only accepts `04xx xxx xxx`.
- **The support count may now include an invitation's messages sent to an address other than the guardian's current one.** None exist in the product today.
- **E15's refusal timing was not measured.** It is a signed-in press, not a token surface.

## Lesson

A `raise notice` in a migration is only a log line if whatever runs the migration listens for it. node-pg drops notices unless something subscribes to them. Before relying on a migration's output, check the runner that will carry it.
