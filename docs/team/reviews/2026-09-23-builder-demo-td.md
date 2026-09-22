# Leo's review — builder, the club demo for a Technical Director (23 Sep)

**Verdict: accepted and merged.** `9c20a5d` on `app`, with two fixes of my own
at `d9cf74f`. Measured by me, from the repo, not from the seat's worktree.

## What I checked myself

The seat's numbers were taken in its own worktree, which is the right place to
work and the wrong place to be believed from. I merged it and re-measured on
`app`, from a fresh seed, in the order TRAINING §4 gives:

| | |
|---|---|
| perms | 1023 / 1023 |
| render | 371 / 371 |
| write | 302 / 302 (after my fix, below) |
| layout | 184 page views at 375 and 1280, 0 overflowing |
| gate coverage | 261 doc 14 rows, 261 pinned, 0 open |
| corpus · palette · secrets · migrations · safe-path · tsc | all clean |
| production build | clean |
| demo walk — the run sheet | 39 checks, all green |
| demo walk — widths | 30 checks, all green |
| demo walk — the unclaimed claim, fresh demo | 51 checks, all green |

The three walks were run against `npm run demo` started from the repo the way
the run sheet tells BUZ to start it, then the demo was stopped and its ports
freed. Disk 6.6 GiB at handover.

## The one change that needed my judgement

The seat replaced `DEMO6`. It had asserted the demo layer contains no
`insert into person` — a proxy for *nothing about a real person ever enters a
demo* (TRAINING §3.1) that BUZ's 23 Sep instruction made false while leaving
the rule exactly where it was. The seat did not delete it; it wrote two checks
on the rule itself (the layer reads no person from anywhere; every address and
number it writes is reserved fiction), proved both against broken code, and
flagged it as safety-adjacent rather than quietly shipping it.

**I accept the change.** It is strictly stronger than what it replaces: the old
check would have passed a layer that fetched a real club's member list and
renamed nobody, and the new pair would not. The safety seat still reads it —
that is queued, not waived. L33 is written from it.

## What I had to fix after the merge

The write suite went red the moment the branch landed, and neither failure was
a product fault (L32). The seat's own outbox change — every real-domain address
in a message body now also rendered as a followable link — meant one message
yielded the same approval code twice, and two tests that took "the first two
matches" as "the two newest messages" silently confirmed one channel twice.
They failed honestly and pointed at the wrong thing: they said an operator
could not see a held sign-up. Deduped at the reader. The corpus check read four
dates inside the design mockups as citations of the dead runway; mockups are
skipped now on the same grounds as `docs/team` (L27).

**This is on the seat, lightly, and on me.** The seat said which suites it had
not run and why — the honest answer, and the reason the failure was cheap.
Nobody thought to ask which suites *read the page it was changing*.

## Findings it handed back, and what happens to them

Eight, none of them touched, all correctly outside the task. My order:

1. **Nothing in the product links to `/claim/[slug]`** while `/join` promises
   the button in so many words. The self-serve funnel has no front door. This
   is the largest thing on the board and it is a product decision, not a bug —
   BUZ.
2. **`lib/fixtures.ts` carries four real Melbourne clubs and two real schools**
   on the football history of invented children. The seat swapped them in the
   demo and left the file alone, which was the right call for its task and
   leaves the dev app, the render suite and any screenshot still carrying them.
   Breach of §3.1 as written. Queued next, with the D-114 school question to
   the safety seat.
3. **No CV states an age or a birth year**, and D-84's birth-quarter marker is
   not built. The first question a TD asks out loud. Product gap — BUZ.
4. `fn_squad_askable` narrows by position only — already on the board.
5. The unclaimed club page contradicts itself in two adjacent blocks.
6. `/signin` does not carry a destination, so a claim has to be found twice.
7. `/club/billing` says "$54 a month" and nothing else — D-136 wants price,
   frequency, renewal and cancellation on our page. The design round proposed
   that screen independently; they are the same finding from two directions.
8. PGlite prints its whole minified bundle on a query error, which took this
   machine to zero free disk at 07:41 and killed the demo QA was walking.

## Scoring

**Before BUZ.** Both of QA's showstoppers closed and measured in the database
rather than asserted; three suites correctly not run and named; one check
strengthened rather than deleted; eight findings handed back instead of
half-fixed. The write-suite breakage is the one thing that reached me, and it
reached me before it reached BUZ, which is the whole point of the order.
