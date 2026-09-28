# Final round A — free at launch, and the approved copy goes live

For the tech-builder seat, from Leo. Read `docs/team/TRAINING.md`, `LESSONS.md`,
`docs/06-Register.html` D-163 and `docs/team/APPROVALS-28-SEP.md` first.
**APPROVALS-28-SEP.md is the only copy you may make live.** Anything else you
write stays held and goes into your report word for word.

## 1 · D-163: free at launch, the Interest Register included

- **The gate.** `fn_register_active` (0004) reads the subscription. Change it so
  that, while billing is off, a **verified** club's register is active.
  - Put that in ONE place, `app_config` or a function such as
    `fn_billing_enabled()`, with billing off by default.
  - D-126 is untouched: verification is still the gate, a held club still sees
    a count and no names, and the grants (D-93) still decide who reads.
  - Write the check that proves an unverified club with no payment reads
    nothing, and that a verified club with no payment reads its register.
    Prove each one red.
- **No price anywhere a person can reach while billing is off.** That covers:
  - `/club/billing`, the plan choice at claim, and the plan card
  - the register's free-tier heading and any upsell
  - `lib/billing.ts` `PRICES` renders
  - the demo seed and `/demo`
  - the doc 15 billing messages. They stay in the code but never send.

  Keep the whole Stripe build working behind the switch, so turning billing on
  is a config change plus BUZ's copy. A check must fail if `$` followed by a
  digit renders on any page in the render suite while billing is off.
- The claim flow's D-137 tick moves nowhere. The verification call already
  asks the authority question.

## 2 · Make the approved copy live (APPROVALS-28-SEP.md)

- **Remove `email_opened`:** take the label off the controls page, and in one
  migration drop the word from `consent_event`'s CHECK. Also delete the
  `NO_WRITER_BY_DECISION` entry; F8h will tell you where.
- **Who looked:** set `WHO_LOOKED_APPROVED = true`. The row shows a short
  report reference, never the uuid. The footer contact is
  burak.donmez@pitch-football.com (BUZ's direct address, his call), not help@.
- **Ops call sheet:** apply the approved suspension labels, and the six
  Technical Director strings (builder-td-wall).
- **Under-16 funnel lines:** attach the invitation's early spine rows to the
  child's log at approval. Do it in the database, append-only: link them, don't
  rewrite them.
- **One contact address, BUZ's (28 Sep).** Every user-facing `help@pitchfootball.com.au` becomes
  `burak.donmez@pitch-football.com`, from ONE constant (`SUPPORT_EMAIL`, defaulting to it). That covers
  `lib/messages.ts` `HELP`, the SMS bodies it feeds, `/join`, `/a/[id]/done`, `/claim/[slug]` and `WhoLooked`.
  A check must fail if the old address renders or sends anywhere.
- **Doc 15 §32:** remove the day-seven and suspension-reminder promise. Doc
  edit only.

## Machine and method

- **Your tree:** `.claude/worktrees/builder-final-a` (Leo creates it).
- **Your ports:** database 54382, app 3180, Chrome CDP 9383. Stop your processes
  by port, never by name.
- **Migrations:** 0075 and up.
- **One other builder runs alongside you.** Before each suite, check the load
  and that no other seat's Chrome is running a layout pass.
- Every new check is proven red with its bug put back. Run every suite from a
  fresh seed in TRAINING §4 order.
- Write your report in `docs/team/reports/`, with the copy held for BUZ
  verbatim.
