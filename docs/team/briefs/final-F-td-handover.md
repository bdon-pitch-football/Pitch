# Final round F: the TD handover, and the crest a verified TD has earned

For the tech-builder seat, from Leo, at BUZ's request ("get that done now").
Read `CLAUDE.md` (D-93, D-48, club roles), migrations 0058 and 0060 (the
Technical Director is recorded on the call and attaches to a proved address),
`app/ops/call/[clubId]/actions.ts`, `app/club/roles/*`, and `app/c/[slug]/page.tsx`.

## 1 · The crest on a verified TD's coaching CV

`app/c/[slug]/page.tsx` computes `held_club` from `membership.role = 'coach'`
only, so a Technical Director confirmed on the call shows their TD line as
plain text, exactly like a claim anybody could type.

- A live `technical_director` membership earns the crest too, on the role
  line whose club matches, just as a coach's does.
- Never from the free-text `coach_role.org_name`.
- Check: the crest shows for a verified TD's matching role, and does not show
  for a typed "Technical Director, <other club>" line. Prove both red.

## 2 · Ending a TD's access (D-48: a departing TD loses club-wide access immediately)

Today nothing ends a TD's membership. A later call naming somebody else
records that person but does not end the first.

- **The rule lives in Postgres,** as one function, e.g.
  `fn_end_td(p_actor, p_club, p_reason)`. It:
  - sets `ended_at` on the live TD membership;
  - requires a reason;
  - writes an append-only audit row: who ended it, when, why, and which
    person;
  - leaves everything the TD authored untouched (D-48).
- **Who may call it:**
  - the operator, through `requireOperator` on `/ops/call/[clubId]`;
  - the club's `club_admin`, from `/club/roles`.
  - Never the TD themselves ending someone else, never a coach, never a form
    that does not check the actor in the database.
- **Naming a new TD** stays call-only. When a `verified` call records a TD
  email different from the live TD, the old membership ends in the same
  transaction (`fn_attach_recorded_td` / 0058's triggers), so two TDs never
  hold the role at once. A re-verification that names the same person
  changes nothing.
- **Access:** after ending, the person reads no registration, no squad and
  no development record at that club. Prove it through the real read paths:
  the register, the squad screen, a CV opened from the register. Do not just
  check the membership row.

## Copy

No approved words exist for this, so hold every new string and list it for
BUZ. Leo has proposed these to him:

- Ops call sheet, on the TD card:
  - button "End this Technical Director's access"
  - field "Why"
  - confirmation "{Name} no longer sees the register, the squads or any
    player's record at {Club}. What they wrote stays theirs. To name a new
    Technical Director, record them on a call."
- Club roles screen, beside the TD row:
  - button "End their access"
  - field "Why"
  - confirmation "{Name} no longer sees the register, the squads or any
    player's record. To name a new Technical Director, ring Pitch."

Render the held words in development only, until BUZ approves them.

## Machine and method

- **Tree:** `.claude/worktrees/builder-final-f`.
- **Ports:** database 54432, app 3230, Chrome CDP 9433. Point `RENDER_BASE`
  and every probe at 3230, and write your log in your tree.
- **Do not touch:** 3000, 54322, 3030 or 54323 (Leo's dev app and BUZ's
  demo, which is live in front of him).
- **Migrations:** 0100 and up.
- **You are the only builder.** Check the load and free disk before each
  suite, and run `test:timing` only under load 8.
- Prove every new check red. Run every suite from a fresh seed in TRAINING
  §4 order, plus `test:timing`, `test:csp-prod` and `build:check`.
- Write your report to `docs/team/reports/2026-09-29-builder-final-f.md`.
