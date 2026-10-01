# BUZ's approvals — 28 September 2026

In chat, BUZ gave two replies: "approve all, deploy the site, post the update,
yes", then "yes approve all, defaults". This file records exactly what those
replies covered, so no builder has to infer it. The source text for each string
is the named report. **An approval covers these words and these decisions only.**
Anything new still goes to BUZ.

## Product copy — approved as written

| Where | Words | Source |
|---|---|---|
| 404 | Heading "This page isn't here" · reason "The address may be wrong, or what was here may have been taken down." · the card on why we don't say · button "Go to the start" · tab "Page not found · Pitch Football" | builder-failure-path |
| 500 | "Something went wrong at our end" · "This is a fault on Pitch, not something you did." · the "Trying again often works…" card · "Try again" · "Go to the start" · tab "Something went wrong · Pitch Football" | builder-failure-path |
| Refused sign-in | "That didn't work. Check the email address and the password and try again." | builder-failure-path |
| Coach editor, `?needs=profile` | "We couldn't save that — there is no coach page to save it to yet. Put your name and region in below and save, then add it again." | builder-failure-path |
| Report confirmation | Tab "Report received · Pitch Football", button "Go to the start", and the reordered doc 15 §7 lines | builder-failure-path |
| Empty positions | "No goalkeeper yet", and the same pattern for each position group | D-162 build |
| Stat sources | "Coach-verified" · "Official import" | builder-provenance-honesty |
| Parent's consent log | "You opened that email" is **removed**: the label goes, and the word `email_opened` leaves `consent_event`'s CHECK in one migration (see builder-webhooks, Found 1) | builder-webhooks |
| Tax invoice | Without card digits the line reads "receipt PF-00184"; with them, "Card ending 4242 · receipt PF-00184". Plan lines as proposed. **Dormant at launch (D-163).** | builder-webhooks |
| Who looked | The heading, empty state, fallback name, row and footer, as proposed. **Two defaults:** the row shows a **short report reference**, not the full uuid, and the footer's contact is **burak.donmez@pitch-football.com**, BUZ's direct address, which he restated in chat on 28 Sep (not help@). | builder-unwired-promises |
| Ops call sheet | The suspension reason label, the three options and the note, as proposed. Also the six Technical Director strings from builder-td-wall. | builder-unwired-promises, builder-td-wall |
| Billing screen | All proposed strings. **Dormant at launch (D-163):** they render only when billing is switched on. | builder-billing-and-return |
| Website | "Free for everyone at launch." · the Clubs card · the FAQ answer · the /join club line. **Live 28 Sep.** | this session |
| CV context marker | "U15 · born Jan–Mar", "Apr–Jun", "Jul–Sep" or "Oct–Dec" (D-84, D-164). **Never on the share card or the OG image.** | this session |
| Country step | "Where do you live?" · "Australia" / "Somewhere else" · "Pitch is only in Australia for now." Nothing is collected from anyone who picks Somewhere else. | this session |
| Premium rows (18+ only) | "Unlimited clips" · "See who viewed your CV", each with a PREMIUM tag and "Coming soon" · "Tap a locked feature to be first in line." · after a tap: "Premium is coming. You're first in line." | this session |

## Contact address

**burak.donmez@pitch-football.com is the one contact address a user sees**, BUZ in chat on 28 Sep: "as mentioned i want to use my direct email." It replaces help@pitchfootball.com.au everywhere, including screens, emails, SMS and the who-looked card, through one constant.

## Decisions — the defaults, now approved

1. **The 500 page shows no support reference.**
2. **"Go to the start" goes to `/home`.**
3. **Red:** one lighter red token, no second red.
4. **Sessions last 30 days.**
5. **A Technical Director name mismatch at verification is held for a human.** It never auto-passes.
6. **Families are not told about school entries removed under D-161.** Those entries never showed on an under-18 CV.
7. **A player who edits a coach-verified stat:** the edited value becomes self-reported, and the coach's verified value stays in the history. **This unblocks D-160's write path.**
8. **An under-16's early funnel lines** ("We emailed you", "That email reached your inbox", "You opened the permission page") **attach to the child's log at approval.**
9. **Doc 15 §32's day-seven and suspension reminders:** the promise comes out of doc 15 until wording exists. It is dormant at launch anyway (D-163).
10. **Only a child-safety suspension tells families** (`fn_suspension_tells_families`, as built).
11. **Leo's calls stand:** the payment grace is fixed at 14 days, and a link preview is not a `guardian_landed`.

## Later the same evening

- **M11** adopts John's ruling (D-165).
- **Wiping the free text on erasure** (D-166).
- **Route 404s:** accepted as they are. The status is a correct 404, but the page body needs JavaScript, because Next 16.3.5's render-time recovery serves an empty document. No proxy-level existence check (that would be a second existence answer) and no soft 200.

## 29 September — TD handover words (BUZ: "approve the TD words")

- **Ops call sheet, TD card:** "End this Technical Director's access" · "Why" · "{Name} no longer sees the register, the squads or any player's record at {Club}. What they wrote stays theirs. To name a new Technical Director, record them on a call."
- **Club roles screen, beside the TD row:** "End their access" · "Why" · "{Name} no longer sees the register, the squads or any player's record. To name a new Technical Director, ring Pitch."

## 29 September: three removals (BUZ: "yes to the three")

- `/home` (club administrator): "…its notices and its plan." becomes "…its notices."
- `/club/register` (held club): the sentence "Paying doesn't change it and can't." is removed.
- `/ops/verification`: the sentence "Payment does not change that and cannot." is removed.

## 29 September: "recommended on all" (BUZ)

- **SMS cost:** accepted. The bare-wake SMS goes to two segments because of the longer address. SMS is switched on last, so nothing to change now.
- **Email reply-to:** stays `help@pitchfootball.com.au` (John's U-11: a support inbox, not a person). **BUZ creates help@ as a forwarding alias to his own inbox** before launch. That is on the go-live checklist.
- **Doc 15 §4, the other parent told:** no product path creates a second guardian at launch. Recorded as D-167. "Invite a second parent" is built later; §4 stays unwired until then.
- **Doc 15 §9, the waitlist confirmation:** retired. The page and the stored consent promise one email, when we open.
- **The parent door on the front door:** the parent row reuses the approved chip text "Approve and see their record". It leads to `/join`, whose parent door already explains, in approved words, that a child starts the page and a parent approves it.
- **The coach's verify button:** "Verify for {club}".
- **Guardian step on /join:** "Give us one way to reach them." becomes "Give us their mobile and email."
- **Country line:** "Pitch is only in Australia for now." becomes "Pitch is only open in Australia." It no longer says "for now".
- **The child's waiting screen:** to be rewritten. Leo drafts; BUZ approves the words before anything renders.
- **Verified stats on an under-16's page** appear with the parent's next approved version (as built). **The front door** has three ways in, not four.

## 29 September: four operator-console calls (BUZ: "yes to the four")

- **`/ops/switches`:** "$0.00 spent this month" becomes "Nothing spent this month" when nothing has been spent (D-162: say the absence in words). Any other amount is shown as it is.
- **Call sheet:** the line saying a "no" or "unknown" answer will "flag the subscription" is removed. Billing is off (D-163).
- **The "Support" door is renamed "Lookup"**, as in the signed design (`OpsLookup.dc.html`). The nav label, the page title and Today's "Open in lookup" now agree.
- **Call sheet, the first two questions** ("Is this the club?" and "Did they independently name the claimant?") **start with no answer selected**, and the call cannot be recorded until both are answered. "Incorporated" and "authority" keep "unknown" as their starting answer.

## 29 September: the child's waiting screen, and the words still to come

**Approved (BUZ: "approve 1 and 2"):**
- `/join/waiting/[id]`:
  - tab title "Waiting for your parent · Pitch Football"
  - heading "One person to go."
  - body "We've asked your parent to approve your page. Until they say yes, nothing about you is on Pitch — not for clubs, not for coaches, not for us."
  - footer "If nobody approves within 14 days, we delete what you told us. You can start again any time."
  - The "What you made / build it while you wait / keep editing" block is removed.
  - The "Honestly? Just go and ask them" card is unchanged.
- While the parent's text is queued (D-168): "We've emailed your parent. Their text follows shortly."

**Approved in advance (BUZ: "3 & 4 approved and to you once the builders finished"):** round H's TD name-mismatch confirm wording, and round I's clubs-directory and "add a trial" wording. **BUZ delegated the review to Leo.** Leo checks each string against the copy rules (banned words, D-162, D-163's "never 'at launch' / 'for now' / 'limited'", Australian English, honesty) before it goes live, and lists what shipped.

## 29 September: round H's TD-mismatch words, reviewed by Leo under BUZ's delegation

- Call sheet: "On hold. The role stays off until you confirm this is the person the club named, or record a new call with the right name."
- Button: "This is the person the club named"
- Verification queue: "on hold: not the name on the call"

**Still held, development only, for BUZ** (operator-facing, outside the delegation):
- digest line "Parents’ texts waiting for SMS: {n}"
- digest subject "Pitch — {n} parents’ text waiting for SMS"
- Today tile "Texts waiting for SMS" / "parents’ approval requests"

## 29 September: "recommended on all, turn on clubs" (BUZ)

- **The clubs directory is on:** `CLUBS_WORDS_APPROVED = true`. The words were reviewed by Leo under delegation; the list is in round I's report.
- **A Pitch-compiled notice for a club that is later verified stays until it expires** (option a, as built).
- **The Terms defaults of doc 37 stand**, including 8.2(b), the $2,000 floor, held whole. That leaves no liability cap for ordinary claims until John clears it.
- **The queued-text words are live:** Today's tile "Texts waiting for SMS" / "parents’ approval requests", the digest line "Parents’ texts waiting for SMS: {n}", and the subject "Pitch — {n} parents’ text(s) waiting for SMS".
- **Doc 14 M7 is amended to D-90:** an unverified club may not post its own notice.

## 30 September: "recommended on all, keep going" (BUZ), on round L's four questions

- **M8: D-154 stands.** Doc 14 M8 amended to "Refused"; `scripts/rulings.mjs` M8 set to `'D-154'`. The gate reads 263/263.
- **Leaving a club withdraws that family's registrations at it** (D-170).
- **While a club is not verified, its coaches lose `authored_only` too; it returns on verification** (D-171).
- **The call sheet stays as it is:** no warning that "not verified" ends a verified club's status. No new words.
- Leo's smaller fixes, no new words: a suspended club is not named on a child's CV; a club that is not verified shows none of its own players-wanted notices (compiled ones stay).


## 30 September: doc 15 §10b, confirm your email address (BUZ: "approve as written")

- The confirm-your-address email for all three sign-up doors, word for word as drafted (doc 15 §10b). Until today it was a draft, which the app refuses to send in production; the rehearsal on the real deploy found that no new account could be confirmed. Now in `CATALOGUE_KEYS`, key `doc15.§10b`; `DRAFT_KEYS` is empty. Regression check `doc15 §10b` in the permission suite, proven red against the draft.

## 30 September: the SMS switch words (BUZ: "approve the SMS words too")

- The whole SMS card on `/ops/switches`, as listed to BUZ: heading, "Nothing spent this month", the switch-off explanation, both buttons, the off/Vercel-off/limit/no-limit lines, the limit field and its buttons, the four confirmations, the two errors and the four log lines. `SMS_WORDS_APPROVED = true`; the card now renders in production, so the launch-day "switch SMS off and on from the phone" step is possible.

## 30 September: the spam sentence after sign-up (BUZ: "approve the spam sentence")

- `/signin?joined=1`, after "…open it and you can sign in.": "If it isn't in your inbox, look in spam or junk — we're new, and some inboxes don't know us yet." Reason: the rehearsal's confirm email passed SPF, DKIM and DMARC and still went to Gmail spam (a new sending domain). Remove once mail lands in inboxes reliably. Render check fp-spam1.

## 30 September: the 7am email about yesterday (BUZ: "set up no. 2", then applied 0157 and pushed 539ea9d)

- Subject: "Pitch — {n} new account(s) yesterday" / "Pitch — no new accounts yesterday".
- Body: "Yesterday on Pitch ({Dy D Mon})"; "New accounts: {n} (Player a · Parent b · Coach c · Club d)" or "New accounts: none"; "Approval requests sent to parents: {x} · Approved: {y}"; "Clubs waiting for your verification call: {w}"; "Emails or texts that failed to send (last 24 hours): {f}"; footer "Counts only — no names or addresses in this email, by design. Today so far: pitchfootball.com.au/ops". Lines with nothing to say are left out; a day with nothing sends nothing. Cron 20:00 UTC (7am AEDT). Checks ops-d1–d6.

## 30 September: clubs can sign up (BUZ: "approve all, keep within a day")

Production opened with no club listings, so a club person had nothing to claim and no way to find anything. Approved words:
- `/claim`, **Find your club**: "Search for your club, then claim its page. We email a code to the club's own address to check it's you." · search "Club name or suburb" · **Search** · per result **Claim** or "Already claimed" · "We couldn't find "{q}"." · **Not here? Tell us your club** · fields "Club name", "Suburb", "State", "The club's email address" with help "The club's own address, the one on its website. We send the claim code there." · **Send** · signed out: **Sign in to tell us your club** · sent: "Thanks. We'll add {club} within a day. Search for it here then, and press Claim." (**BUZ keeps "within a day"**: requested clubs are added within 24 hours) · errors: "That club is already on Pitch. Search for it above." / "You've already asked for three clubs. We'll get to them soon." / "Confirm your email address first, then ask again." / "Check the club's name, suburb and email address."
- `/home` (no seat yet): **Here for a club? Find your club** · "Search for it and claim its page". The line "claiming a club page … not on this screen yet" is gone.
- `/join` club path: "Next: find your club on Pitch and press **Claim**. … If your club isn't on Pitch yet, you can ask us to add it there."
- Operator: `/ops/clubs` "Clubs asking to be added" with **Add** (pre-filled) and **Dismiss**, note "Check the email address is on the club's own website before you add it. The claim code goes there."; Today tile "Clubs asking to be added" · "see Clubs"; 7am email line "Clubs asking to be added: {n}".
- Unclaimed listings are `noindex` until claimed. The full Victorian list (scout, 30 Sep) is loaded with `scripts/import-clubs.mjs` through `fn_ops_add_club`.

## 30 September: D-172 (unclaimed club pages) and the claim screens (BUZ: "approve both", "A", "approve the four fixes")

- **D-172 numbered** (John's ruling of 30 Sep, register v4.31).
- **Unclaimed-page banner**, body text, above the fold: "Pitch made this page from public information. {Club} has not claimed it." · "Is this your club? Claim it to run the page yourself, or ask us to update or remove it." · links **Claim it** and **Ask us to update or remove it** (/report, no account). BUZ softened John's second line: "more subtle, like it's not something wrong that we are doing this" → option A.
- The unclaimed page's CV line: "{Club} hasn't claimed this page, so there is no register here. Send them your CV instead …" (was "isn't on Pitch yet": D-172 never says "on Pitch").
- **The four claim-screen fixes:**
  - claimed: "You can edit the page now. Posting trials, and anything to do with players, waits for verification — a phone call from us — and we'll be in touch." plus **Go to your club**;
  - the club's address shown partly hidden (`in••@club.example.au`);
  - "You run the page, the teams and the trial notices." (no billing);
  - "Pitch made this page from public information. Claiming it means you control what's on it."

## 30 September, late: John's four clearances, compiled trials, and Send my CV (BUZ: "approve all four and the wording, go"; "approve all five, keep going")

- **John's four clearances approved** (`JOHN-to-LEO-junior-notices-send-CV-and-held-interest-30-sep.md`): junior trial notices; Send my CV fills in the club's role address in full; held interest at unclaimed clubs (90 days, a date shown, no count under five); a link to the club's own notice.
- **Compiled notices:** "The club’s own notice" (link, opens the club's page) and "checked {D Mon}" beside each trial on the club page. 80 notices loaded at 22 clubs with `scripts/import-trials.mjs`; 24 held for confirmation.
- **Send my CV, the five:**
  1. Under the filled-in address: "The address {Club} publishes on its own website, checked {D Month}. Change it if you have a better one."
  2. Blocked club: kicker "Not sent", title "We can’t send to this club through Pitch", body "Nothing has been sent."
  3. doc 15 §19, the CV email's last line: "You received this because … We did not add you to a list. To stop CVs reaching this address through Pitch: {link}"
  4. `/stop-cvs`: "Stop CVs to this address?" · "Pitch won’t send CVs to this address again. Families can still contact the club in other ways." · **Stop them** · done: "Done" · "Pitch won’t send CVs to this address again."
  5. Operator: **Stop CVs to this club** · "CVs to this club are stopped."
- **Warm clubs:** BUZ asked for notices at his five warm clubs to be researched and posted too.

## 1 October: John's Floodlit clearances, club colours on the CV (BUZ: "approve the picker line, keep going")

- **The club colour picker, John's condition 3 (D-174):** "Your colours appear on your club page, and on the CV of players who list your club as their current club."
- John cleared all three unclaimed-page questions (the nav above the banner, the drawn pitch lines, the claim panel). U1b, U5b and U5-nav assert them. The D-172 clarifying sentence and D-174 are in the register (Head of Product Design, b409c87).
- The CV club colours switch stays off until John's four conditions are built and tested.

## 1 October: the Floodlit base pass (BUZ: "yes approve the base pass, keep going")

- Spec A steps 1–6: the shared shells and panels on all 74 pages (builder report `docs/design/reports/2026-10-01-build-base-pass.md`). No words or doors changed (923-view crawl).
- Approved with the three glows dropped under the one-glow rule: the persona landings' closing button, the unclaimed club page's send button, and a second child's button.

## 1 October: doc 15 §39's recipient (BUZ: "option A, keep going")

- §39 "Your club is verified" goes to the club's administrator who claimed the page, only when the club named them on the call (proved adult address, never the club's published address). The TD-handover case is John's to rule on (`LEO-to-JOHN-PD3-not-now-and-the-s39-recipient-1-oct.md`).

## 1 October: the two domains, decided (BUZ: "I am not changing my email. Leave as @pitch-football.com and my website domain will stay as www.pitchfootball.com.au")

- E5 (spec K) is closed: the contact address stays burak.donmez@pitch-football.com (D-169) and the site stays pitchfootball.com.au. No alias domain, no forwarding, no change to SUPPORT_EMAIL. Do not raise it again.
- Also recorded today: BUZ's go on the PD-3 deletion ("Go on the Not now deletion, hand to Leo") and its label "No, end this request"; the six copy fixes ("Yes to all, hand to Leo"); spec K emails ("Yes to all four, hand to Leo").
- **Demo script (docs/DEMO-TD.md, the unclaimed story), BUZ: "approve the demo line":** "Claiming gets you the page and your squads. It cannot make you verified — only the phone call does that, and trial notices and anything about a child wait until it happens."
- **Walkthrough B1/B2 drafts confirmed, BUZ: "approve all five":** "Nothing to preview yet" · "Your parent said yes. They build your page from their account, so ask them to start it with you." · "Before we finish — who's your Technical Director? Ask them to sign up on Pitch with their own email address, not the club's shared one. That's the account that reads the register." · "This is the club's shared address. It can run the page, but your Technical Director signs up with their own email address to read the register." · "No Technical Director has an account yet. Ask yours to sign up with their own email address." Also approved: the walkthrough's three live copy fixes (home administrator line, claim page verification line, brand-new home order).

## 1 Oct — the six walkthrough placeholders (BUZ: "yes", via the Head of Product Design)

| Where | Words (verbatim) | Builder |
|---|---|---|
| F5 · 16–17 home, the parent request has closed (either ending) | "This request has closed. You can ask again whenever you like." (John's approved line, reused) | homes |
| F5 · the re-ask door | "Ask again". **Not rendered** until John's re-ask ruling gives it a destination | — |
| F5 · 16–17 home, the text still queued | "We’ve emailed them, and their text follows shortly. Once they do, you can send." | homes |
| F6 · `/a` state 3q | "One more step. Your text follows shortly — open the link in it to finish." | john-rulings |
| F7 · signed-out Claim → sign-in door | heading "Sign in to claim {Club}"; line "New here? Make an account and we’ll bring you back to {Club}." Ships only with the return path through /signin, /join and /confirm | Leo, combined branch |
| F10 · call sheet, above Log the call (`fn_verified_call_recipient`) | will send: "Logging this call as verified emails {first name} to confirm it." · won't: "Logging this call sends no email, so don’t promise one." | john-rulings |

## 1 Oct — the parent's Send for their under-16 (BUZ: "Yes to all four", via the Head of Product Design)

Parent view only; the player's own view keeps its words.

1. `/send` sub: "Pick who it goes to. {first}'s CV goes as a link, so it always shows what's on {first}'s page today."
2. "What the club gets", row 1: "A link to {first}'s CV — the same page you'd send anyone."
3. "What the club gets", row 2: "If you switch {first}'s link off, it stops working for them."
4. `/register-interest?registered=1` title: "{first} is on {club}'s register." (as built)

Row 3 is /g/send's approved "No contact details for you or {first} — not now, and not if they reply." (N-8 (a)). The tab title is N5's "Send {first}'s CV". "Verified club on Pitch" (N-8 (b)) waits for John (M9).

BUZ, 1 Oct: "fix the photo gap in this release" (safety review S-3, part 1).

BUZ, 1 Oct: "put the public bucket fix in this release". S-3 part 2: under-18 photos go to a private bucket, served only through short-lived signed URLs, and their public copies are deleted (John's ruling, `13-Board-Room/JOHN-to-LEO-the-batch-photo-first-1-oct.md` §1).
