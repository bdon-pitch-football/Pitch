# Final round C: the gate row that is red, and three privacy holes

For the tech-builder seat, from Leo. Read `docs/team/TRAINING.md`,
`LESSONS.md` and `CLAUDE.md` (pillar zero and the security section) first,
and then the launch-gaps report
(`docs/team/reports/2026-09-28-builder-launch-gaps.md`), which found all four
of these. **No new user-visible copy.**

## 1 · Doc 14 L40 is red. Leo's call: both remedies

A send refused by the daily limit answers about 2.4 ms faster than a real one
locally. In production a real send also calls the email provider inline, so
the gap there is tens to hundreds of ms. D-99 says the limit is
indistinguishable from success.

- **Take the provider call out of the request.** Both paths do the same
  database work, write the outbox row (or, for a refusal, nothing a reader can
  see), and return. Delivery happens after the response. Read
  `node_modules/next/dist/docs/` for how this Next version runs work after the
  response (`after()` or its equivalent). Do not guess. The follow-up
  emails move too.
- **And a floor.** Neither path answers sooner than a fixed floor. Choose it
  from the measured p99 of the real path, write the number and the reason in
  a comment, and keep it in one constant.
- **Proof:** `npm run test:timing` L40 goes green at its own resolution. Prove
  it red by putting the inline provider call back.

## 2 · Vercel Analytics must never see a minor or a token

`app/layout.tsx:79` mounts `<Analytics />` on every page, including
`/p/[token]`, `/a/[id]`, `/g/*`, `/build/*`, every signed-in page and every
CV. Analytics records paths, and the moment it is switched on in the Vercel
dashboard, share tokens and a child's pages reach a third party. Pillar zero 5
allows no analytics on minors, and the security posture allows no tokens in
logs.

- **Mount it only on the public, token-free marketing surfaces:** the front
  door `/`, `/trials`, `/jobs` and the public club page. Nowhere else.
- **Check:** crawl every seat and every route family. The analytics script is
  present only on that allowlist, and absent on every tokenised, signed-in,
  guardian or CV route. Prove it red by putting it back in the root layout.

## 3 · The token read path has no rate limit

CLAUDE.md §2 requires a rate limit on every unauthenticated endpoint,
including the token read path. Add one to the ONE tokenised read path, per
token and per IP, using the existing rate-limit module.

- The limited answer must be the D-77 link-state page: same copy, same timing,
  no leak of whether the token exists. Timing-test it with the same method as
  E10.
- A family sharing a link normally must never hit the limit. Choose the
  numbers with that in mind, write the reason down, and put them in one place.

## 4 · M6: withdrawn registrations

Doc 14 M6 says a withdrawn registration is removed. The code keeps the row
with `withdrawn_at` set, which the club cannot read.

- **First,** search the register (`docs/06-Register.html`) and doc 14 for any
  decision that keeps withdrawn rows (audit, consent or D-135-style
  retention). **If one exists, stop and report it.** Do not change behaviour
  against a decision.
- **If none exists,** build to doc 14: remove the row in the same transaction
  as the withdrawal, keep only an anonymous count if something already needs
  one, and pin M6.

## Machine and method

- **Your tree:** `.claude/worktrees/builder-final-c` (Leo creates it).
- **Your ports:** database 54402, app 3200, Chrome CDP 9403. Point
  `RENDER_BASE` and every probe at your own port.
- **Migrations:** 0090 and up. Round B holds 0080–0089.
- **One other builder runs alongside you (round B).** Before each suite,
  check the load and that port 9393 is not running a layout pass.
- Prove every new check red. Run every suite from a fresh seed in TRAINING
  §4 order, including `test:timing` and `test:csp-prod`.
- Write your report in `docs/team/reports/`.
