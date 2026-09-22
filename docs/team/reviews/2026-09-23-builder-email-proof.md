# Review: builder B, email proof (23 Sep)

Report: `../reports/2026-09-23-builder-email-proof.md` · commits `889f136` (and
its files swept into `e3a6039`) · Reviewer: Leo

**Accepted.** I re-ran everything myself at head across both builders' work:
tsc clean · perms 1022/1022 · render 369/369 · write 295/295 · layout 184 views,
0 overflow · gate 261/261 · palette, corpus, secret-scan, migrations, build:check
all clean.

What the seat did well:
- **Put the rule in Postgres, not in the app.** `email_proved_at` can only be
  written where the evidence exists (a used confirm link, a reset to that
  person's own address, or the D-156 email press); a trigger refuses every other
  write, including by hand; changing an address clears the proof; and a
  guardianship link to an unproved address is refused by the database. That is
  D-80's rule applied to identity, and it is stronger than I asked for.
- **Sign-in asks after the same scrypt work**, so an unproved account is
  indistinguishable from a wrong password (D-94 §2).
- **Refused to ship its own new message.** The confirm email is wired as a draft
  that queues in dev and is refused in production, so the door cannot ship until
  BUZ has the words. It also checked §10 and §10a first and explained why
  neither can honestly do the job.
- Left the "parked address" question open with three options instead of choosing.

**Leo's fault, not the seat's:** I ran two builders in one working tree, one
database port and one app port. They reseeded each other, a second app could not
start, and one seat's `git commit` swept the other's staged files into its
commit, so `e3a6039` carries B's code under A's message. History is intact and
nothing is lost; the cost was a day's measurement confusion. Fixed from now:
one builder per tree (agents get their own worktree), or one builder at a time.

To BUZ: five strings from this seat, plus the confirm email's words, plus the
parked-address decision.

New lesson: L30.
