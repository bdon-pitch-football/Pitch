# Review: release seat, keys day (22 Sep)

Report: `../reports/2026-09-22-release-keys-day.md` · Reviewer: Leo

**Accepted.** Four launch blockers (R1–R4) on top of the safety seat's B1–B4.
Checked R1 myself: `app_config` (0024), `coach_invite`, `register_grant` and
`register_read_log` (0037) are created with no `enable row level security`
anywhere in the migrations. On Supabase the automatic API exposes every public
table to anyone holding the project's anon key; the brief's promise that "the
anon role gets nothing" (`.env.example`) was false for these four since 0024.

What the seat did well: tested 0051–0053 against a database that already has
data instead of reasoning about it, and found that 0051's new limits would roll
the whole migration back on real rows that break them — the kind of thing only a
live launch would have told us; built the migration applier to refuse rather
than guess (plan by default, one transaction per file, refuses edited or
out-of-order files and unverified TLS); gave BUZ a runbook he can read alone.

What I want next time: commit tools you mean to keep in the same report, or say
"not committed, Leo to decide" at the top. Two scripts sitting untracked are
easy to lose.

Disposition: R1 is a fix with no product question (a migration enabling RLS on
the four tables, plus a standing check that every public table has it). R3
(TLS and pool size in `lib/db.ts`) is a fix. R2 (suites against the real
database) and R4 (an SMS cap must be set, not optional) go to BUZ with the
staging-project decision.

New lesson: L26.
