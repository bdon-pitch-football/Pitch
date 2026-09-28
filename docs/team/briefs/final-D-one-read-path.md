# Final round D: the one read path, and the address bar that told

For the tech-builder seat, from Leo. Round C found both of these (see
`docs/team/reports/2026-09-29-builder-final-c.md`, "Found outside my lane").
Read CLAUDE.md's tokenised read path section (D-80) and pillar zero 9 (D-77)
first. **No new user-visible copy.**

## 1 · Request-access goes through the one read path (D-80)

D-80 names the request-access handler as something that calls the ONE read
path internally. `app/p/[token]/request/actions.ts` queries `share_token`
directly instead. It also answers a never-existed token immediately, and a
real one after more queries: a timing tell on the page that exists to hide
whether a player exists (D-77, doc 14 C6).

- **Move the lookup into `lib/record-read.ts`.** Add a function that resolves
  a token (live or dead) to only what the notice needs: the token id, the
  child's first name and one guardian address. It selects nothing from the
  record, and it runs the same query shape whether or not the token exists.
- **The action** calls that function and then answers no sooner than one floor
  on every path: never existed, dead, limited, or sent. Reuse
  `answerNoSoonerThan` from `lib/send-dispatch.ts`.
- **A static check:** no file outside `lib/record-read.ts` selects from
  `share_token` by `token_hash`. Name any other reader and say why it is
  allowed, or move it.
- **A timing row** in `test:timing`, by E10's method: a request on a
  never-existed token, a dead token and a live token cannot be told apart.
- Prove every check red.

## 2 · The address bar after a send (L38/L42)

`app/g/send/[requestId]/actions.ts` redirects a real send to
`?sent=1&link=<the raw token>`, and a limited one to `?sent=1`. So the
address bar says whether the limit bit, and a live share token sits in
browser history and the referrer.

- **Both paths redirect to `?sent=1`, exactly.**
- The page shows the link only in development. Remove that block too: the dev
  inbox (`/dev/outbox`) already shows the email and its link.
- **Check:** the redirect after a real send and after a limited send are
  byte-identical, and no response anywhere in the render or write crawl
  carries a `/p/` token in a `Location` header or a query string. Prove both
  red.

## 3 · Doc 14 M6: held withdrawals are removed (round C's option a)

M6 is about a registration that is HELD, at a club nobody has verified yet.
The club has only ever seen a count, so no club ever read the row. D-128,
N7 and doc 34 rule 6 are about registrations a club could read, and they
stay as they are.

- **A family withdrawing a held registration:** delete the row in the same
  transaction, and the held count goes down. The club must never be able to
  learn it existed: no gap in a sequence, no changed timestamp, no audit
  entry it can read.
- **A family withdrawing a readable registration:** unchanged, and kept
  unreadable, per D-128.
- Check both, prove the held deletion red, and label the check M6.

## Machine and method

- **Tree:** `.claude/worktrees/builder-final-d`.
- **Ports:** database 54412, app 3210, Chrome CDP 9413. Point `RENDER_BASE`
  and every probe at your own port, and write your app's log inside your own
  tree.
- **Migrations:** 0095 and up, if you need any.
- **You are the only builder.** Before each suite, check the load and free
  disk.
- Run every suite from a fresh seed in TRAINING §4 order, including
  `test:timing` and `test:csp-prod`. Write your report in
  `docs/team/reports/`.
