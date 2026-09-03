# PITCH — Complaints, Reports and Takedown

### The process, the standard we publish, and the one we actually build

> **v1.1, 1 September 2026 — the entity, and the domain.** This document is published by **EBSD Enterprises Pty Ltd (ACN 701 879 718 · ABN 65 701 879 718), trading as Pitch Football** (D-148). It carried neither the entity nor the right domain until now. **The check that caught it asserts presence rather than agreement** — nothing here contradicted anything; the legal person was simply absent, which is the shape every serious defect in this corpus has taken.
>
> **This one mattered more than the other three.** Part 1 is reachable **without an account, from any page** — it is where a stranger, or a child, or a parent who is frightened, tells us something. **A page like that must say who it is addressed to.** A complaint made to a brand is a complaint made to nobody.
>
> **Doc 25 · v1.1 draft · 1 September 2026 · NOT YET PUBLISHED.** Doc 19 recommendation 4. Two audiences in one document: Part 1 is the public-facing process, to publish at `pitchfootball.com.au/report`; Parts 2 to 5 are internal and are the runbook. Split them at publication.
>
> **This document exists because of a disagreement that was resolved rather than tidied away.** Doc 19 v1.0 recommended a 24-hour out-of-hours takedown capability. The CTO's response was that a one-person company whose founder starts a full-time job on launch day cannot staff that, and that a published standard we miss once is worse than a smaller one we always meet. **He is right.** What follows is built on his standard, not on best practice's.
>
> **[LEGAL: doc 18 Q6 — the whole of Part 4 needs counsel. In particular whether a statutory removal window applies to us, what it is, and whether the five-year record period attaches to the handling record or to the material.]**

---

# Part 1 — For anyone who needs to tell us something

## Reporting something

**Every public page on Pitch has a "Report this page" link.** Use it.

You do not need an account. You do not need to give a reason. You do not need to be sure.

**Report anything, including:**

- your child appears somewhere they should not;
- someone has published a photograph or a name without permission;
- an account you believe belongs to a child but presents as an adult;
- an adult behaving in a way that would concern you at a ground;
- something on Pitch that simply does not look right.

If your child appears in content someone else has published — a club's page, a trial notice — **tell us and we will remove it.** We do not ask you to justify that.

## What happens then

| | |
|---|---|
| **Straight away** | An automatic acknowledgment, telling you when a person will look at it. |
| **Within one business day** | A human has read it and either acted or told you what happens next. |
| **If a child is at risk** | We act immediately, whatever day it is. We do not wait for the business day. |

**One business day is the promise, and we chose it because we will keep it every time.** We are a small company. We could publish a shorter number and miss it on the first long weekend, which would help nobody. Urgent things do not wait for it — see below.

## If it is urgent

If you believe a child is in immediate danger, **call 000.** Pitch is not an emergency service and we would rather you rang the police than us.

Then tell us as well, at **burak.donmez@pitch-football.com**, putting **URGENT** in the subject line.

**Being straight with you about what that means.** Pitch is one person. That address is his, it is on his phone, and urgent mail is not left until Monday — **but he is one person and there will be hours when he is asleep or driving.** That is why the line above comes first: **if a child is in danger, ring 000.** We are the second call, not the first, and we would rather say so than let a page imply a control room.

## If you are unhappy with what we did

Reply and say so, or write to **[appeals contact]**. Someone other than whoever made the original decision will look at it wherever that is possible, and answer within **five business days**.

If you are still unhappy, you can go outside Pitch entirely, and you do not need our permission:

- **eSafety Commissioner** — esafety.gov.au — for online safety concerns, including cyberbullying material targeting an Australian child, and for image-based abuse.
- **Office of the Australian Information Commissioner** — oaic.gov.au, 1300 363 992 — for privacy complaints.
- **Kids Helpline** — 1800 55 1800 — free, any hour, for young people.
- **1800RESPECT** — 1800 737 732 — family violence and safety.

---

# Part 2 — How this actually runs

## Where reports land

One shared inbox, one named owner, per the support model already agreed. Not a personal email address, and not the founder's, so that cover is possible and nothing depends on one person being awake.

The support console can look up an invitation's state and re-send an email or a text. **It cannot read a child's record, and it cannot impersonate anyone.** Every action is logged. The alternative — running queries against the live database at 9pm — is both slower and the single worst way to leak a minor's data.

## Triage, in three classes

| Class | What it is | Response |
|---|---|---|
| **Emergency** | A child at risk. An adult attempting contact with a child. A child's identity or location exposed. Content sexualising a child. A removal notice from a regulator. | **Immediately, any hour.** Bypasses the inbox and reaches the founder's phone. Take down first, work it out second. |
| **Priority** | Anything concerning a person under 18. A privacy complaint. A named person asking to be removed. | Same business day where possible; within one business day always. |
| **Standard** | Everything else — a wrong club badge, a stale trial notice, a complaint about a decision. | One business day. |

**A report about a child is never Standard.** If triage is uncertain, it goes up a class, not down. Nobody is ever criticised for over-escalating.

## The rule that makes this workable

**Take the page down first.**

Any admin can make a page invisible in seconds, from a phone, without judging the merits and without asking anyone. It is reversible. Nothing is deleted.

That single capability is what lets a one-person company meet a removal window without a roster: the question "what if a notice arrives at 9pm on a Friday" is answered by the fact that taking a page down takes fifteen seconds, not by pretending someone is on shift. **It must be tested from a phone before launch, not assumed to work.**

The merits get decided in business hours. A page that was taken down wrongly goes back up with an apology, which costs us little. A page that stayed up wrongly costs a child.

---

# Part 3 — The specific cases

## "My child is on there and I did not agree to it"

Remove it. Now. Do not ask for proof, do not ask for a relationship to be established, do not route it to the club that published it first.

Then tell the club what was removed and why, and point them at the rule that bars naming anyone under 18 on a public page.

**Reasoning:** the cost of removing something wrongly is a club has to retype a line. The cost of leaving it up while we verify a parent's identity is a child stays exposed while we do paperwork.

## "I think that account belongs to a child"

Hold the account — no public profile, no contact, no discoverability — and look.

**What to look at first:** does the account claim to be an adult while naming a junior squad as its current team? That contradiction is visible in data we already hold and it is the strongest signal available to us. Then the account's own history, and anything the reporter said.

If it is a child: the account converts to the guardian flow. It does not get closed and thrown away — a child who wanted to be on Pitch should end up on Pitch, properly, with a parent. **Closing the account teaches them to try again with a better lie.**

## A family in danger

If a family indicates they are at risk from someone who has access to their child's record:

1. **Suppress the record immediately.** Invisible everywhere, deleted nowhere. No questions asked, no evidence requested.
2. **Point them to 1800RESPECT**, and to the police if there is immediate danger.
3. **Do not decide who the parent is.** Removing one guardian's access permanently happens on a court order, a parenting order or a police request — never on our reading of a family's situation.
4. Record what was done and why.

**This is the rule that protects the person answering the inbox as much as the family.** Adjudicating a parenting dispute is not a job a founder should be doing at 10pm on a phone, and the suppression switch means they never have to: everything goes dark for everyone, and the family gets time.

## A regulator's removal notice

Take the content down immediately, before reading the rest of the notice. Then work out what it requires, comply in full, record it, and get advice about whether anything else follows.

**[LEGAL: doc 18 Q6 — what window applies, from what moment, and to what.]**

## A club disputes a removal

The removal stands while it is discussed. Explain the rule. If we were wrong, restore it and say so.

---

# Part 4 — Records

| What | Kept | Why |
|---|---|---|
| Report received: what, when, from whom (or that it was anonymous) | 5 years | Basic Online Safety Expectations, subject to counsel |
| Decision, action taken, who took it, when | 5 years | As above |
| The reported material, where held as evidence | 12 months, separately, restricted access | Unless a legal or law-enforcement hold applies |
| Identifying detail inside the record | Minimised at the point of writing | Record what happened and what we did — not more about the child than the decision needed |

Full periods in doc 23.

**The tension, named:** five years of records about children sits against the minimisation posture asserted everywhere else in our documents. The resolution is that what must be provable is *that we handled a report properly* — which is not the same as a five-year file about a child. If counsel says the period is prudence rather than obligation, shorten it.

---

# Part 5 — Appendix: Safety by Design self-assessment

> **Prepared, not submitted.** eSafety's Safety by Design start-up self-assessment is an interactive tool at `sbd.esafety.gov.au`, free, for companies of 1–49 people, roughly 60–95 minutes. **It has to be completed by a person on the site — this office cannot submit it.** What follows is our answers, drafted, so that submitting it is twenty minutes of typing rather than an afternoon of thinking. The report it produces is the attachment doc 19 recommendation 11 asks for.

### Principle 1 — Service provider responsibility

*The burden of safety should never fall solely on the user.*

| Expectation | Our position |
|---|---|
| Named accountable person for safety | Founder, and the support owner for day-to-day. **To confirm at submission: this needs to be a role, not a name, before there is a second employee.** |
| Community guidelines, consistently enforced | Doc 24, accepted with the terms |
| Reporting infrastructure with escalation | Parts 1–3 above |
| Law enforcement and hotline pathways | Part 3. **Gap: no standing contact established with police or eSafety before we need one. Do this before launch — a first call in a crisis is the wrong first call.** |
| Proactive detection of harmful conduct | Limited by design: there is no user-to-user content between children to moderate. The age-contradiction hold is our one proactive detection measure. |
| Documented risk assessment | Doc 19 |
| Duties set out at registration | Doc 22 and doc 24 |
| Balancing security, privacy and safety | Doc 19 §4.5 |

### Principle 2 — User empowerment and autonomy

| Expectation | Our position |
|---|---|
| Safe defaults | Under-16: parent-created, invisible in search, uncontactable, link expires at 90 days. Highest-privacy defaults available. |
| Clear consequences for violations | Doc 24 |
| In-context risk flagging | Report link on every public page; the consent screen states the promises in plain language rather than burying them |
| Reporting status and appeals | Parts 1 and 3 |
| Feature-by-feature risk review across user groups | Doc 19 §4.6, and the privacy gate at recommendation 10 |

### Principle 3 — Transparency and accountability

| Expectation | Our position |
|---|---|
| Safety training for relevant roles | **Gap. One person, no training programme. Needs to exist before there is a second.** |
| Accessible, current policies | Docs 20, 21, 22, 23, 24, 25 |
| Open engagement with stakeholders | The design-partner clubs, and the shakedown families |
| Published annual assessment | **Committed but not yet done** — doc 19 recommendation 11 |
| Ongoing collaboration on safety technology | Nothing yet. Honest answer: not at this size. |

### What the self-assessment surfaces that our own documents did not

Three things, and they are the reason to do it rather than assert it:

1. **No standing law-enforcement or eSafety contact.** Establish one before launch.
2. **Safety accountability is a person, not a role.** Fine today, a single point of failure the moment it is not.
3. **No safety training exists**, because there is nobody to train. It becomes a real gap on the first hire, and it is cheaper to write the induction now than to discover its absence later.

---

*Pitch Football · a registered business name of EBSD Enterprises Pty Ltd (ACN 701 879 718) · complaints, reports and takedown · doc 25 · v1.1 draft · 1 September 2026 · not yet published · Part 1 is public, Parts 2–5 are internal*
