# Scorecard

Per seat: defects the team caught before BUZ saw the work, against defects
found after — by BUZ, by another team, or by anyone outside tech. The target is
zero after. Every "after" becomes a lesson in `../LESSONS.md`.

## Baseline — the week before the team (15–22 Sep, Leo alone)

| Defect | Found by | Before / after BUZ | Lesson |
|---|---|---|---|
| Build your CV overflowed a 390px phone | GTM (content capture) | **after** | L3 |
| Coaches could not sign themselves up | GTM and BUZ | **after** | — (scope miss; D-159) |
| No real player's CV could show a current club | Leo, while answering BUZ | **after** (BUZ asked the question that found it) | L13 |
| Squad list showed an administrator positions and numbers | Leo, building the depth view | before | L2 |
| Squad confirmation held the only connection and hung | the write suite | before | L1 |
| Doc 14 H6 counted by a check that tested H4 | Leo, reading the gate | before | L4 |
| Squad events logged as "outside contact" | the permission suite | before | L5 |
| Legal pages serve internal drafting notes | Leo, readiness sweep | before (still open — BUZ's call) | L16 |
| First layout check could not fail | its own self-test | before | L19 |

**Baseline: 3 of 9 found after BUZ or by another team.** That is the number
this team exists to bring to zero.

## From 22 Sep

| Date | Seat | Defect | Before / after | Lesson |
|---|---|---|---|---|
| 23 Sep | copy check | Corrected its own 22 Sep miscount (17 → 42 live-site items); caught that Leo's "stop sending §13" would have removed doc 14 B11's gate; kept an unapproved draft email out of the approval batches | **before** | L28 |
| 22 Sep | QA | An under-16's page never changes club (sqf6); 3 of Leo's squad checks never ran; corpus failing at HEAD on Leo's own commit; 18th-birthday refusal on /join; 38px chips; silent 60-row cap; open redirect confirmed | **before** | L27 |
| 22 Sep | release | 4 tables without row-level security; no suite can run against the real database; no TLS in the database client; an empty SMS cap means no cap; 0051 would roll back on real rows | **before** | L26 |
| 22 Sep | copy check | 106 strings to change across the app (17 on the live coming-soon page); §13 promises a switch that does not exist; /join claims a check we don't make; this week's squad copy says two untrue things | **before** (this week's) · pre-existing ones were already live | L24, L25 |
| 22 Sep | safety review | 4 blockers + 10 must-fix in Leo's 19–22 Sep work (coach takeover, guardian takeover, unverified squad list, 16–17 claim without parent, and more) | **before** | L21–L23 |
