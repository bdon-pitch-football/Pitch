# Pitch tech team — training pack

Every seat reads this, then `LESSONS.md`, before touching anything. Head of
technology: Leo (Claude). Reviewer of everything: BUZ. **Nothing reaches BUZ
without Leo's review, and nothing reaches a user without BUZ's yes.**

The spec wins over this pack on any conflict: `CLAUDE.md` (the build brief),
doc 06 (the decisions register, `docs/06-Register.html`), doc 14 (the
permission tests — the launch gate), doc 15 (every message that sends), doc 16
(positions, stats, fixtures), `docs/legal/`.

## 1. What we are building, in one breath

A player development and pathway platform where the person who can be hurt is
a child. Every feature is judged first by what it lets a stranger holding a
valid share link do. **Doc 14 green, or we do not launch** (D-47, D-131).

## 2. The seats

| Seat | Agent | Owns | Never |
|---|---|---|---|
| Build | `tech-builder` | Features and fixes on the `app` branch, with their tests | Pushes, deploys, or decides product behaviour |
| Safety review | `tech-safety-review` | An adversarial read of every change against pillar zero, doc 14 and the register | Edits code; signs off on its own |
| QA | `tech-qa` | Every suite from a fresh seed, the layout check at phone and desktop width, regression tests for anything that broke | Marks green what it did not run |
| Copy check | `tech-copy-check` | Every user-visible string: doc 15, banned words, Australian English, honesty; the approval list for BUZ | Writes new product copy of its own |
| Release | `tech-release` | Migrations order, environment, the go-live checklist, the demo | Deploys, pushes, or touches a real account or key |

Leo assigns the work, reviews every report, merges the lessons, and reports to
BUZ. A seat that finds a problem outside its lane says so in its report; it
does not fix it.

## 3. Non-negotiables (break one and the work is rejected)

1. **No real child's data anywhere** — not in seeds, tests, demos, screenshots.
   Fictional people only, and no real club's name used for fictional data.
   **The one exception, BUZ's call (23 Sep):** the club demo is renamed to the
   club he is meeting — the club's own name, suburb, ground and crest, and
   nothing else about them. Every person in it stays invented. A demo is shown
   in the room and nothing captured from one is published, because a club's
   name beside fictional children is fine across a table and is not fine on a
   screen anyone else can see.
2. **No push, no deploy, no production account, no key in chat.** The `app`
   branch has never been pushed; only BUZ says when it is.
3. **Permissions are computed in Postgres, never stored**, and every new read
   of a record goes through the database's answer (D-80, the brief §3).
4. **One tokenised read path** (`lib/record-read.ts`, D-80). Nothing else reads
   a record for a token.
5. **If a message is not in doc 15, it does not send.** Build it from
   `lib/messages.ts`; never type message text anywhere else.
6. **Every user-visible string goes to BUZ for approval**, listed verbatim in
   the handoff. Code comments are not copy.
7. **Banned words** (D-85, D-108): potential, insights, struggling; elite under
   U13; talent identification under 10; application, applied, declined,
   rejected, unsuccessful. Football, never soccer. Never claim Pitch verifies age.
8. **When a safety question is unclear, choose the more restrictive answer and
   say what you chose.** Never decide product behaviour touching minors — ask.

## 4. How to run things

```bash
# the dev database (in memory; a restart is a clean reseed)
node scripts/dev-db.mts                      # 127.0.0.1:54322, writes .dev-ids.json
# the dev app: the "coming-soon" preview in the desktop app, port 3000

npm run test:perms        # permission + static checks, against Postgres. No server needed.
npm run test:render       # every page as every seat. Needs db + app.
                          # NOT READ-ONLY (QA, 28 Sep): it shortlists a real
                          # registrant and leaves it, and renews a share token
                          # by 90 days. Three reports read the resulting
                          # "wandering" register count as a product bug, twice.
                          # Run it BEFORE anything you measure, never after.
node scripts/write-tests.mjs    # presses every button. MUTATES the db — reseed after.
node scripts/layout-check.mjs 375 1280   # real Chrome, every page, every seat
node scripts/gate-coverage.mjs  # doc 14 rows pinned by the suite
node scripts/palette-check.mjs · python3 scripts/corpus-check.py · node scripts/secret-scan.mjs
npx tsc --noEmit
SUPABASE_DB_URL=postgres://ci@127.0.0.1:5432/ci npm run build:check
```

**Order matters:** reseed → perms → render → write → reseed → layout. **Every suite in that line writes, including render** — the order is not a preference. Never run
the write suite twice without a reseed in between (LESSONS L7).

The club demo runs separately (`npm run demo -- "Club FC"`, app on 3030, its
own database on 54323). Never stop the dev database by name; stop it by port
(LESSONS L8).

## 5. Definition of done

A change is done when **all** of these are true, and the report says so with
numbers:

- It does what was asked, and nothing it was not asked to do.
- Every suite in §4 has been run from a fresh seed and is green — the counts
  are in the report, not the word "green".
- Anything that broke on the way has a regression check that fails on the old
  code (prove it: put the bug back and watch it fail — LESSONS L20).
- The safety review has read it and the copy check has read every new string.
- It is committed on `app` with a message that says why, not just what.

## 6. The handoff — every seat writes one

A report at `docs/team/reports/<YYYY-MM-DD>-<seat>-<slug>.md`:

```
# <seat>: <what> (<date>)
Asked: one line.
Did: what changed, file by file, and why.
Ran: each suite with its count (e.g. "perms 967/967 · render 369/369 ·
     write 269/269 · layout 164 views, 0 overflow").
Found: anything wrong you saw, in or out of your lane, with where.
Copy for BUZ: every new or changed user-visible string, verbatim. "None" if none.
Risks: what could still be wrong, and what you did not check.
Lesson: one thing the next seat should know, or "none".
```

Short and exact beats long and vague. A number beats an adjective.

## 7. How the team gets better

Leo reviews every report in `docs/team/reviews/`. Every defect that got past a
seat — found by another seat, by Leo, by BUZ, or by anyone outside the team —
becomes a numbered lesson in `LESSONS.md`, naming what happened, the rule, and
how to check for it. Lessons are read before every task. A lesson that keeps
recurring becomes a check in the suite, because a rule nobody enforces is a
hope. The scorecard in `reviews/SCORECARD.md` counts, per seat, defects caught
before BUZ against defects found after him. The target is zero after.
