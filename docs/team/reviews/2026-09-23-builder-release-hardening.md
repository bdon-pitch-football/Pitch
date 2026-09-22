# Review: builder C, release hardening (23 Sep)

Report: `../reports/2026-09-23-builder-release-hardening.md` · branch
`worktree-agent-a8b16ad66290ff4d0`, commit `2e55439` · Reviewer: Leo

**Accepted. Merge held until after BUZ's Balmoral meeting (24 Sep)**, with the
TD branch, then both go in together and the demo is re-run behind them.

Measured in its own tree on its own ports (the L30 fix working as intended):
perms 1059/1059 · render 369/369 · write 296/296 · layout 184 views 0 overflow ·
gate 261/261 · migrations 68 · corpus, tsc, build:check clean. 37 new permission
checks, 18 of them shown failing on the reverted code.

What the seat did well:
- **Chose the honest failure.** With TLS verification on and no CA certificate,
  the app refuses to reach Supabase rather than connecting unverified. That is
  the more restrictive answer (TRAINING §3.8) and it makes `SUPABASE_CA_CERT` a
  keys-day variable — it goes on BUZ's checklist.
- **Scoped the SMS-cap refusal to production and said so.** A cap that blocked
  every seat's dev SMS would have been quietly worked around; this one bites
  where money is spent. Flagged rather than hidden, which is the point.
- Followed the copy seat's §13 proposal rather than my blunter instruction (L28
  holding on its own now).
- Reclaimed only regenerable caches when the disk hit 876 MB, and left
  everything it did not own alone, naming what it could not touch.

To BUZ: `SUPABASE_CA_CERT` added to keys day; every new string in the report.

Nothing sent back.
