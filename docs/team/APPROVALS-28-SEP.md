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
