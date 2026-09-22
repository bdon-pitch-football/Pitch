# copy check: whole-app string sweep (22 Sep 2026)

Asked: sweep every user-visible string in `app/`, `components/` and `lib/messages.ts` for banned words, over-promises, age/identity claims (D-96), US spelling, soccer/footy, policy narration to a player, and inconsistencies. This week's surfaces (16a8f5f..bfbb405) get particular attention.

**Strings proposed for change and awaiting BUZ: 106** (numbered 1–106 below). 17 of them sit on the live coming-soon page at `/`, and 4 on the dev-only site preview. There are also **7 decisions** that a string change cannot settle (section B).

Ran:
- `python3 scripts/corpus-check.py`: 4 failures, 0 warnings, exit 1. All four are S2 "date from the dead runway: '21 Sep'" in `docs/team/LESSONS.md`. That file is outside the product, and a dated lesson log looks like a false positive for S2. Leo's call.
- `npm run -s test:perms`: 967 passed, 0 failed.
- **Coverage gap:** neither command scans `app/` or `components/` for banned words. The corpus-check S6 test scans only `design-screens/` and doc 15. The perms suite checks only "declined" in `lib/messages.ts`. The render suite's m7 check does scan served text, but it needs a running server, and it has no pattern for soccer, footy, elite, talent identification, "applying" or "turned down". That's why the jobs-board "apply" strings (items 32–38) have never been caught. I ran my own grep over the source instead. There are no US spellings in visible copy ("program" is standard Australian English), and no "potential", "insights", "struggling", "elite", "talent identification" or "footy".

No servers were started and the dev database was not touched.

---

## A. Approval list for BUZ: current → proposed, most serious first

The proposals are the smallest wording that makes each line true. They are drafts for BUZ to accept, rewrite or reject; copy check does not write product copy of its own.

### A1. Sign-up: `/join` and the page after it (a promise or check that does not exist)

1. `app/join/page.tsx:212` (under-16 step)
   **Current:** "Put in your own number and nothing happens — the approval has to come from an adult's own phone, and we check the two are different."
   **Proposed:** "The approval has to come from your parent's own phone."
   *Rule:* honesty and D-96. The under-16 path never collects the child's number (`startPendingInvitation` takes only the guardian's details), and `lib/guardian-flow.ts` compares nothing, so no check exists. "An adult's own phone" also implies we verify that the approver is an adult. **Safety review should look at this:** a child who types their own number gets the approval SMS themselves. That's a build question, not a copy one.
2. `app/join/page.tsx:201`
   **Current:** "We send them a text and an email, each with a link. Nothing else, ever, unless you ask them for something."
   **Proposed:** "We send them a text and an email, each with a link."
   *Rule:* honesty. That parent can also get doc 15 §3 (the day-10 nudge), §13 (turning 16), §24 (the wake when a club approaches) and §8, none of which the child asked for.
3. `app/join/page.tsx:215`
   **Current:** "Why does a parent have to do this?". It is styled like a link but is a plain `div` that goes nowhere.
   **Proposed:** remove it.
   *Rule:* no control we do not have. This is a door that looks open and does nothing.
4. `app/join/page.tsx:16` (role chooser, Coach)
   **Current:** "Develop your squad"
   **Proposed:** "Build your coaching CV"
   *Rule:* honesty. Under D-159 a coach account is "their own page and nothing else". The line is from 4 Sep, but the coach door opened on 21 Sep, so it is now a live promise.
5. `app/join/page.tsx:34` and `:111`
   **Current:** ":34 "…Your club can bring you in in the meantime — email help@pitchfootball.com.au." and :111 "…Your club can set you up in the meantime: email help@pitchfootball.com.au."
   **Proposed (both):** "Until then, your club can bring you in. Questions: help@pitchfootball.com.au."
   *Rule:* consistency, since the same refusal is worded two ways, and plain words ("in in").
6. `app/join/waiting/[id]/page.tsx:39`
   **Current:** "Your page is built. One person to go."
   **Proposed:** "Your page is waiting. One person to go."
   *Rule:* honesty and consistency. Line :72 of the same screen says "Page not started yet". Nothing is built on this path.
7. `app/join/waiting/[id]/page.tsx:75`
   **Current:** "Keep editing it while you wait". This is a bordered `div` shaped like a button, with no link.
   **Proposed:** remove it.
   *Rule:* no control we do not have.

### A2. Squads, club side: `/club/squads/[squadId]` (new this week)

8. `:139` (notice after "Ask them")
   **Current:** "Asked. It's waiting in their account — we told them nothing by email."
   **Proposed:** "Asked. It's waiting in their account — the email we sent only says something is waiting."
   *Rule:* honesty. `inviteToSquad` calls `wake()`, which sends the doc 15 §24 bare-wake email to the player (16+) and every guardian.
9. `:295`
   **Current:** "Your club gave you this squad. Every CV you open here is recorded, and the family can see who read it."
   **Proposed:** "Your club gave you this squad. Every CV you open here is recorded against your name."
   *Rule:* honesty. `squad_record_opened` shows the guardian only "{Name}'s club opened their record", which does not say who. The event is not shown to a 16–17 or adult player anywhere.
10. `:138` (notice after "Not this squad")
    **Current:** "Left as it was. Nobody is told they were turned down."
    **Proposed:** "Left as it was. Nothing is sent to them."
    *Rule:* D-108. "Turned down" brings back the verdict frame the register was renamed to remove. It is also not quite true: the family's "Waiting on {club}" card disappears, so they can infer the answer.
11. `:165`
    **Current:** "Asked {date} · their family sent this"
    **Proposed:** "Asked {date}"
    *Rule:* honesty. From 16 the player sends the request themselves (SQ3).
12. `:322`
    **Current:** "For an under-16 it goes to their parent. From 16 the player answers, and their parent sees it too. Nothing reaches you unless they say yes."
    **Proposed:** "For an under-16 it goes to their parent. From 16 the player answers, and under 18 their parent sees it too. Nothing reaches you unless they say yes."
    *Rule:* accuracy. The register includes adults, who have no parent on Pitch.
13. `:338`
    **Current:** "Nobody on your register is waiting for this squad."
    **Proposed:** "Nobody else on your register to ask."
    *Rule:* honesty. The list is the whole register, not only people who named this squad.
14. `:353`
    **Current:** "· asked for this team"
    **Proposed:** "· asked for this squad"
    *Rule:* use the product's own name for it.

### A3. Squads, family side: `SquadCard`, `/home` inbox, `/squad/[personId]` (new this week)

15. `components/SquadCard.tsx:50`
    **Current:** "Saying yes puts {squad} on {name}'s page and lets that club's coaches for this team read {their} record. Doing nothing is a complete answer."
    **Proposed:** "Saying yes puts {squad} on {name}'s page and lets the club's technical director, and the coaches it gives this squad, read {their} record. Doing nothing is a complete answer."
    *Rule:* honesty. `fn_squad_roster` gives the technical director every squad (SQ6c), and a parent is consenting to that reader too.
16. `app/home/page.tsx:765` (guardian inbox)
    **Current:** "Saying yes puts the team on {name}'s page and lets that team's coaches read their record. Doing nothing is a complete answer."
    **Proposed:** the same text as item 15.
    *Rule:* consistency (the same consent is worded two ways) and honesty (the TD is left out).
17. `components/SquadCard.tsx` as rendered on an **under-16's own account** (`/build/[id]`, `/home:600`)
    **Current:** the card offers "Yes, I play there", "Not this one", "Add your club", "Leave" and "Cancel". `fn_can_act_on_squad` refuses every one of them for an under-16: "Add your club" bounces to `/home`, and the invitation answer silently does nothing.
    **Proposed:** for an under-16 on their own account, show the status line only, plus: "Your parent answers this from their account."
    *Rule:* no control we do not have. This needs a small build change as well as the string. **Safety review should also look at this:** doc 15 §11 routes a squad invite for an under-16 to the guardian, "never the child alone", yet this card shows the child the club's invitation.
18. "team" and "squad" are used for the same object across the squad flow.
    **Occurrences:**
    - `app/squad/[personId]/page.tsx:62` "Pick the club and the team."
    - `:98` "{club} — which team?"
    - `:101` "…hasn't added its teams yet. Ask them to add yours…"
    - `:123` "…the name and the team you picked…"
    - `components/SquadCard.tsx:93` "Pick the club and team you play for."
    - `app/club/squads/page.tsx:160, :164, :184` (coach grants: "teams")
    - `app/coach/register/page.tsx:93, :100, :142`
    - `app/home/page.tsx:462` "Registrations for your teams"
    - `app/fc/[slug]/page.tsx:314` "Teams & age groups"

    The club screens and doc 15 §11 (to a parent) say "squad".
    **Proposed:** "squad" everywhere, e.g. "Pick the club and the squad.", "— which squad?", "hasn't added its squads yet".
    *Rule:* the product's own names; consistency. BUZ may prefer "team" on family screens deliberately. If so, say so once and it applies everywhere.

### A4. Other family and player screens

19. `app/build/[recordId]/more/page.tsx:79`
    **Current:** "Your club now is the one you registered with — it's already at the top of your page. …"
    **Proposed:** "Your club now is the one that confirmed you in a squad — it's at the top of your page. …"
    *Rule:* honesty. Since 0052 the CV's club comes from confirmed membership (`lib/record-read.ts:82`), not registration. This week's change made the line false.
20. `app/g/send/[requestId]/page.tsx:95` (guardian confirms a send)
    **Current:** "If they reply, it comes to you and {name} together."
    **Proposed:** "The club can't reply to the email. If it wants to talk to {name}, it asks through Pitch, and that comes to you and {name} together."
    *Rule:* honesty. A club cannot reply to a send (John U-11, doc 15 §19). `lib/messages.ts` §21 was corrected for this; this screen was not.
21. `app/a/[id]/page.tsx:34` (parent approval, under 16)
    **Current:** "Every approach comes to you together."
    **Proposed:** "Any approach from outside their club comes to you both together."
    *Rule:* consistency. Doc 15 §2's build note requires "the same four promises… near-identical words", and line :28 (the 16–17 version) already reads this way.
22. `app/a/[id]/page.tsx:35` and `app/g/pending/[recordId]/page.tsx:52`
    **Current:** "…you can pause or regenerate it any time." / "You can pause or regenerate it any time."
    **Proposed:** "…pause or replace it at any time."
    *Rule:* consistency. Doc 15 §2 and the controls button both say "replace".
23. `app/build/[recordId]/clips/page.tsx:89`, shown to under-18s
    **Current:** "Ten clips, free"
    **Proposed:** "Up to ten clips"
    *Rule:* D-06/D-30. An under-18 account never carries a paid surface, and "free" implies a paid version.

### A5. Clubs: claim, public pages, editor, billing

24. `app/claim/[slug]/page.tsx:158`
    **Current:** "…Verified status is separate — a person here checks your club against Football Victoria's register, and it's what unlocks anything to do with players."
    **Proposed:** "…Verified status is separate — a person from Pitch rings your club, and it's what unlocks anything to do with players."
    *Rule:* D-126 and doc 15 §25 ("verified against Football Victoria" is a state that does not exist). Line :162 on the same screen says "Only the phone call does that".
25. `app/claim/[slug]/page.tsx:16`
    **Current:** "Runs the football side. From December, the only role that reads a player's development record."
    **Proposed:** "Runs the football side."
    *Rule:* no date for a coming-soon feature (D-131; "December" was retired). The line is also false today, because coaches granted a squad read CVs.
26. `app/c/[slug]/page.tsx:300` (public coach CV)
    **Current:** "Players developed and improvement delivered arrive here in December."
    **Proposed:** remove it, or "Coming soon."
    *Rule:* a date and content promised for a coming-soon feature.
27. `app/fc/[slug]/page.tsx:396` (public club page, alumni)
    **Current:** "Named players are 18+ and have given permission. Younger pathway stories stay unnamed."
    **Proposed:** "The club confirms everyone named here is 18 or over. Younger pathway stories stay unnamed."
    *Rule:* honesty. The editor records only an age tick (`page-edit/page.tsx:180`), and nothing records permission.
28. `app/club/page-edit/page.tsx:209`
    **Current:** "…the same rule as your pathway wall…"
    **Proposed:** "…the same rule as your alumni wall…"
    *Rule:* consistency. The section is titled "Alumni wall" at :162.
29. `app/club/billing/page.tsx:87`
    **Current:** "Both prices include GST. The same price for a club of four hundred and a club of forty."
    **Proposed:** "Both prices include GST."
    *Rule:* BUZ, 15 Sep: never add "the same for a club of four hundred and a club of forty". Whether "include GST" stays at checkout is John's call under the ACL.

### A6. Demo (new this week)

30. `app/demo/seats.ts:7`
    **Current:** "Runs the club page, teams and trials. Sees no child's details."
    **Proposed:** "Runs the club page, squads and trial notices. Never reads a player's record."
    *Rule:* honesty. An administrator sees names and join dates on squads (SQ6b). Product names.
31. `app/dev/outbox/page.tsx:30` and `app/demo/page.tsx:25`
    **Current:** "What families receive"
    **Proposed:** "What Pitch sends"
    *Rule:* honesty. The outbox also holds messages to clubs and coaches (§19, §28, §34, §12).

### A7. Coaching roles board (D-108: "application" does not appear in the product; TRAINING §3.7 bans "applied")

BUZ may want a carve-out for adult job hiring (see B4). Until then:

32. `app/jobs/[roleId]/page.tsx:81` "Apply for this role" → "Put your name forward"
33. `:74` "Sign in to apply" → "Sign in to put your name forward"
34. `:72` "You've applied for this one. The club has your CV." → "You've put your name forward. The club has your CV."
35. `:77` "You need a coaching profile to apply." → "You need a coaching profile to put your name forward."
36. `:59` "You need a coaching profile and an adult account to apply for a role." → "…to put your name forward for a role."
37. `app/jobs/page.tsx:87` "Applying sends the club your coaching CV…" → "Putting your name forward sends the club your coaching CV…"
38. `app/club/roles/page.tsx:69` "Closed. Coaches who applied are still listed below." → "Closed. Coaches who put their names forward are still listed below."

### A8. Small consistency and plain-words fixes

39. `app/demo/seats.ts:5` "…every player who has registered interest, sorted by team." → "…sorted by squad."
40. `app/demo/seats.ts:9` "…the registrations for the two teams the TD gave them." → "…the two squads the TD gave them."
41. "Working with Children Check" at `app/club/squads/page.tsx:164, :193` and `app/join/page.tsx:162` → "Working With Children Check", as in doc 15 §12 and the coach page.
42. `app/coach/edit/page.tsx:131` "Say it the way you'd say it at the coffee." → "Say it the way you'd say it over a coffee."
43. `app/p/[token]/print/page.tsx:105` "…this page is a live link and the family can switch it off at any time" → "…this page is a live link and can be switched off at any time". The print page also serves adults, who have no family on Pitch; §19's adult variant already makes this distinction.
44. `app/layout.tsx:33`: meta keywords include `'soccer'` → remove it. It is not on screen, but we publish it on every page.

### A9. Messages: text that sends but is not in doc 15 word for word (rule 5)

Each of these must either go into doc 15 verbatim with BUZ's yes or revert. The first one runs the other way: doc 15 itself carries a banned word.

45. Doc 15 §1 and `lib/messages.ts:34` "Approve or decline: pitchfootball.com.au/a/…" → "Review and approve: pitchfootball.com.au/a/…". *Rule:* D-108 bans "declined", and doc 15 §32 says there is no exception, not even about a card. This changes approved doc 15 text.
46. §19 `messages.ts:161` (self opener): "{Name} has sent you their football CV." Not in doc 15.
47. §19 (adult control): "This is a link, not a file. {Name} controls it — they can switch it off or replace it at any time, and it expires on its own. If it stops working, that is their choice, not a fault." Not in doc 15.
48. §19 (16–17 self control): "This is a link, not a file. {Name} and their family control it — …" Not in doc 15.
49. §19 (adult contact): "Replies to this message do not reach {Name}. Pitch does not pass messages on." Not in doc 15.
50. §19 (under-18 trial paragraph): "If you want {Name} at a trial, post it on Pitch. Families register their interest from your trial, and that is where you can invite them — it goes to {Name} and their parent together, and a record is kept." Doc 15 says "post it on Pitch or send an invitation through their guardian. Both go to the parent, and both keep a record."
51. §19 (self footer): "You received this because a player sent you their CV. …" Not in doc 15.
52. §21 `:221` (18+): "The club can't reply to the email it got. If it wants to talk to you, it has to ask through Pitch." Doc 15 still carries the untrue "If anyone from the club writes back…" (John U-11).
53. §21 (16–17): "…it has to ask through Pitch — it comes to you, and your parent is told."
54. §21 (under 16): "…it has to ask through Pitch, and it comes to you and your parent together."
55. §22 `:251`: the subject "{Name} sent their CV to {club}", the "their/theirs" pronouns (D-25, correct), and "See what they sent, or turn sending off: {link}" merge doc 15's two buttons into one line. Approve into doc 15.
56. §5 `:646` and §23: "Let it expire: there's nothing to do." Doc 15 makes [Let it expire] a real button weighted equally with Renew (D-53 note). The code turns it into a line of text. Either restore a real "Let it expire" link or amend doc 15 knowingly.
57. §6 `:293`: doc 15's "[Share a new link] · [Ignore]" is missing, so the guardian gets no link to act on.
58. §33 `:485`: "If it wasn't: change your password — …" has no link, where doc 15 has [Change your password]. Add `pitchfootball.com.au/reset`.
59. §31 `:430`: the 14-day refund sentence is conditional (`refundable`); doc 15 has it unconditionally. Approve the condition into doc 15.
60. §20: doc 15's "[Not this one]" is absent from the email. That's harmless because silence is the answer, but it's still a divergence. Approve into doc 15.
61. §13 `:557`: "them/their" in place of doc 15's "him/his" (D-25, correct), and the two buttons merged into "Leave it on, or turn it off: pitchfootball.com.au". **Held by B1**: do not approve this until the switch exists.

### A10. Coming-soon page: `components/coming-soon/` (live at `/`, last changed 10 Sep)

Rules: D-143 (waitlist vocabulary); BUZ 15 Sep (no "same for everyone"); D-111 (never describe what Pro contains); D-53 (never sell discovery); content rules §5 (development tracking only as wondering, never present tense); Founding XI (no cap, no badge); honesty about controls. The page is BUZ-approved copy, but these are problems regardless of age.

62. `ComingSoon.tsx:740` "Register your club's interest" → "Join the waitlist as a club". *Rule:* D-143. This names the paid product.
63. `ComingSoon.tsx:1256` "No launch pricing, no tiers to compare, no discount for signing early. Everyone is quoted the same number." → drop the last sentence. The headline "Clubs pay one price." at :1255 is a near-miss for BUZ to judge.
64. `data.ts:57` "Or $329 for twelve months. Same for every club. The players who want to be at yours, kept by squad." → drop "Same for every club."
65. `data.ts:57` "a month, cancel anytime" and bullet "Cancel anytime" → "cancel any time" / "Cancel any time", as at `ComingSoon.tsx:1262` and in the content rules.
66. `data.ts:48` Player Pro: "Where your record becomes a development trail — and clubs start coming to you." plus 4 bullets ("Know when a club opened your page", "Clubs asking for your page…", …) → "Adults only. What's in it is being decided with the people who'll use it." and no bullets. The page contradicts itself here: :1281 says "We would rather say nothing about it".
67. `data.ts:51` Coach Pro: "Where your coaching leaves a trail…" plus 4 bullets → "Shaped with the first coaches on the record, not before." and no bullets.
68. `data.ts:58` Club Pro: "Development across every squad…" plus 4 bullets → "Founding clubs get the first say in what it is." and no bullets.
69. `data.ts:46` "…Pro is where your development becomes a trail clubs follow." → "…Pro is coming soon."
70. `data.ts:49` "…Coach Pro puts your name on the players you developed." → "…Coach Pro is coming soon."
71. `data.ts:52` "…Club Pro shows the whole pathway." → "…Club Pro is coming soon."
72. `data.ts:37` "…Down the track, clubs come looking for you — not the other way round." → cut that sentence (D-53).
73. `data.ts:93` "…Down the track, clubs looking for a coach find you." → cut that sentence (D-53).
74. `ComingSoon.tsx:844` "…Send it in one tap, get seen by the right clubs, and watch your development add up season on season — until clubs are finding you." → "…Send it in one tap and get seen by the right clubs."
75. `data.ts:38` "…one record that gets you the next job. Then your word on a player's page, carried with them." → cut the second sentence.
76. `data.ts:39` "…by squad. Then the whole pathway, U8s to seniors, in one view." → cut the second sentence.
77. `data.ts:83` "…so you never rebuild it for a new club. Coaches add their word as you go." → cut the second sentence (not built).
78. `data.ts:84` "…show what makes your case. Season on season, they become your development trail." → cut the second sentence.
79. `data.ts:85` "YouTube, Instagram or Veo. Three on the free page; your whole season on Pro." → "YouTube, Instagram or Veo — up to ten under 18, three from 18." (D-120; drops the Pro content).
80. `data.ts:91` tab "The players who came through — How many you've coached and where they went…" → remove the tab. Not built: the coach page itself says it arrives later.
81. `data.ts:92` tab "Your word on a player — A line on a player's page, from you…" → remove the tab (not built).
82. `data.ts:98` "…Open the player's page as it is today, with a coach's word already on it." → "…as it is today."
83. `data.ts:99` "TD reads the football, registrar runs the squads. Then Club Pro: U8s to seniors, every coach and season, in one view." → "TD reads the football, registrar runs the squads."
84. `ComingSoon.tsx:962` "…gets you the next role — and puts your word on the players you developed, so their progress carries your name wherever they go." → end at "…gets you the next role."
85. `ComingSoon.tsx:1057` "…stop losing CVs in an inbox. Then see your whole pathway — U8s to seniors, every coach, every season — in one place." → cut the last sentence.
86. `ComingSoon.tsx:606–607`, the mock "HER WORD · ON A PLAYER'S PAGE" / "Deniz — two seasons, never missed a session. Reads the game early." → remove (it depicts an unbuilt feature).
87. `data.ts:95` "…The place players send their page to — and a founding mark if you were one of the eleven." → "…The place players send their page to." *Rule:* Founding XI: no cap stated, recognition never advantage, no public badge.
88. `data.ts:40` (parent) "Nothing about your child reaches a club until you've read it and slid to send…" → "Under 16, nothing about your child reaches a club until you've read it and sent it…" *Rule:* false at 16–17, where the player sends their own CV. There is also no slide in the product.
89. `data.ts:60` "The whole page, your keys, every send read by you first. …" (on the "Under 18" card) → "The whole page and your keys. …"
90. `data.ts:60` bullet "Nothing about your child reaches a club without you" → "Under 16, nothing reaches a club without you"
91. `data.ts:103` "They ask. You read it and slide to send. A mis-tap can't do it." → "Under 16, they ask, and you read it and send it."
92. `data.ts:104` "…and a hold-to-pause that stops everything." → "…and a pause that stops every link." The product has a toggle, not a hold.
93. `data.ts:117` FAQ "…Nothing about your child reaches a club until you've read it and sent it yourself. … you can pause everything in one hold." → "…Under 16, nothing about your child reaches a club until you've read it and sent it yourself; at 16 and 17 they send their own and you're told every time. … you can pause their page with one switch."
94. `ComingSoon.tsx:1124` "Your son or daughter builds the page and asks. You read it and slide to send. Nothing reaches a club without you — and they get a record…" → "Under 16, your son or daughter builds the page and asks, and you read it and send it. At 16 and 17 they send their own, and you're told every time. Either way they get a record…"
95. `ComingSoon.tsx:669` "Slide to send →" and `:1147` "Slide to send it →" → "Send it →" (no slide control exists).
96. `ComingSoon.tsx:1152` "A mis-tap can't send this. Only a slide." → remove.
97. `ComingSoon.tsx:1160` "Sent. Deniz gets a text." → "Sent." A send never texts the player, and an under-16 has no address (doc 15 §21, §38).
98. `ComingSoon.tsx:1206` "Hold for a second. Every link, every send, stopped." → "One switch. Every link stops working."
99. `data.ts:114` FAQ "…parents hold the keys for their kids." → "…for their children." (content rules §4: "kids" is not used in serious copy)
100. `ComingSoon.tsx:591` "WWCC checked" → "WWCC verified" (as in the product, the OG card and doc 15 §12).
101. `ComingSoon.tsx:1277` "WWCC checks recorded" and `data.ts:53` "WWCC checks shown" → "WWCC verification, free" in both.
102. `ComingSoon.tsx:1190` "Under 16, this one stays on the ring." → "Under 16, you send every one." (plain words)
103. `ComingSoon.tsx:1261` "A paid tier exists later for people who want more — what's here now stays free." → "A paid tier may come later for people who want more — what's here now stays free." (nothing is decided; D-111)

### A11. Site preview: `components/site-preview/SitePreview.tsx` (dev only, not yet approved)

104. `:112` "Browse coaching roles at clubs and apply with your page." → "Browse coaching roles at clubs and put your name forward with your page." (D-108)
105. `:301` "…If you're under 16, a parent sets it up with you." → "…If you're under 16, a parent approves it before it goes live." (BUZ 15 Sep: never "a parent sets it up")
106. `:142` "…Under 18 only with a parent's okay, and never under 16." contradicts D-22 and doc 15 §13, where discovery defaults ON at 16 and the parent has an off switch. Hold this line until B1 is settled. Line :141 ("Coaches record what they see… marked as verified") describes development tracking in the present tense (content rules §5) and should be reworded as wondering or cut.

---

## B. Problems a string change will not settle (decisions for Leo / BUZ)

- **B1. Doc 15 §13 promises a switch nobody can use (the most serious finding).** `app/api/jobs/daily/route.ts:39` sends `sixteenthBirthdayEmail`: "Leave it on, or turn it off: pitchfootball.com.au… The switch is yours, it stays yours". `guardian_setting.discovery_disabled` exists (0003), but nothing in `app/`, `lib/` or `components/` reads or writes it, and `/g/controls` has no such control. Club search is not live either (D-53), so "will be able to find them in a search" describes a feature that does not exist. Two options: hold §13 sends, or build the switch before any account can reach 30 days before a 16th birthday. Also, legal doc 26 says the opposite default (see D).
- **B2. The under-16 own-account squad card** (item 17) needs a small build change. The child is also shown a club's squad invitation, which doc 15 §11 routes to the guardian only. Safety review.
- **B3. The join phone "check"** (item 1). If a child-versus-parent number comparison is wanted, it is a build item. Today it is only a promise.
- **B4. Jobs board and D-108.** D-108 says "the word 'application' does not appear in the product", with no carve-out, but adult coaches applying for jobs is genuinely an application. BUZ either approves items 32–38 or rules a jobs-board carve-out into the register. Either way the render m7 check needs updating to match.
- **B5. Doc 15 is out of date against the code in three places.**
  - §11 (a squad invite email naming the club and squad) is never sent. The code sends the §24 bare wake instead, which is the more restrictive choice.
  - §26 says a 16–17 "don't have to approve" their reply; the product (`app/g/invite/[invitationId]/actions.ts:44`) requires parent approval, and the club screen says so (`club/invite/[registrationId]/page.tsx:97`).
  - §21's untrue "writes back" line (item 52).

  Doc 15 should be reconciled to the more restrictive behaviour, with BUZ's yes.
- **B6. Hardcoded season labels.** `app/club/squads/[squadId]/page.tsx:277` says "2026 · self-reported" and `app/p/[token]/opengraph-image.tsx:95` says "PLAYER CV · SEASON 2026". Both will be wrong from the first 2027 season. This belongs to Build; the fix is to take the label from the data.
- **B7. Redirect notices that never render.** The `?squad=asked|joined|declined|left|withdrawn` redirects (`app/squad/actions.ts:42–107`) and `?removed=` on `/club/page-edit` are sent, but no screen displays them, so a family taps "Yes" and gets no confirmation. The URL values `declined` (`app/squad/actions.ts:74`, `app/club/squads/[squadId]/actions.ts:80`) put a banned word in the address bar. Rename them to `no`.

Left in place deliberately: `ComingSoon.tsx:1390` and `SitePreview.tsx:519` "Football, not soccer." use the banned word to reject it, as a brand line. It's BUZ's call; I recommend keeping it.

## C. Risks and what I did not check

- The string extraction was regex-based. I read the new surfaces line by line, but the older screens were scanned, not read in full. `app/ops/*` (operator-only) and `app/design` were skimmed only.
- I did not render any page (servers were off limits), so strings built at runtime were judged from source.
- I did not verify "not us" at `join/waiting/[id]/page.tsx:40` ("Nobody can see it — not clubs, not coaches, not us") against the operator report console's read access. Safety review should confirm it.

## D. Legal documents: John's lane, noted only

- `docs/legal/26-Access-Model.html:146, :152`: "Club search opens in December" (a date), and search is "Only if a guardian has turned it on — off by default". That contradicts D-22 and doc 15 §13 ("If you do nothing, it turns on").
- `docs/legal/24-Code-of-Conduct.md:33`: "a name in a trial application" (D-108 vocabulary).
- `docs/legal/19-Privacy-Impact-Assessment.html:366`: "From the December release…" (a date for an unbuilt feature).

Lesson: the banned-words check does not cover the product source, which is how the jobs board kept "apply" for weeks. Add an `app/` + `components/` + `lib/messages.ts` source scan to `test:perms` that needs no server, with the full list (soccer, footy, application/applied/applying, declined/rejected/unsuccessful, turned down, potential, insights, struggling) and an allowlist for lines that name the ban.
