# PITCH — Retention Statement

> **v1.3, 1 September 2026 — the entity, and the domain.** This document is published by **EBSD Enterprises Pty Ltd (ACN 701 879 718 · ABN 65 701 879 718), trading as Pitch Football** (D-148). It carried neither the entity nor the right domain until now. **The check that caught it asserts presence rather than agreement** — nothing here contradicted anything; the legal person was simply absent, which is the shape every serious defect in this corpus has taken.
>
> **Doc 23 · v1.3 draft · 1 September 2026 · NOT YET PUBLISHED.**
>
> **v1.2 changes:** the export row is **gone**, because the export is gone — a club can no longer download a list of children, which removes the one object in the product that survived revocation · payment and subscription data added, since money now moves · pending versions of an under-16 page added, since an unapproved edit is personal information about a child that no adult has approved.
>
> **Doc 23 · v1.1 / v1.0 (superseded headers retained for the change log).** Written because doc 20 points at it, and until it exists our published retention position reads as "forever" — which is the APP 1 content the privacy policy is supposed to carry. Publish at `pitchfootball.com.au/privacy/retention` and link it from the privacy policy and from Settings.
>
> **Every period below is a decision, not a discovery.** None of them comes from an authority; they are the shortest periods that let the product work, chosen by us and offered to counsel to correct (doc 18, Q3 and Q6). Where a period is set by law rather than by us, it says so.
>
> **For the build:** each row is a real deletion job with a real trigger. A retention statement whose periods are not enforced by code is worse than none, because it is a published representation we are continuously breaching.

---

**The short version.** We keep a player's record while they are using Pitch, and for two years after they stop. We delete it sooner the moment anyone asks. Deleted things are gone from the live product immediately and gone from our backups within 35 days. The only thing that outlives a deletion is the note saying a consent was given or withdrawn, which holds nothing about anyone's football.

**Last updated:** [date] · **Version:** [1.0]

---

## How to read this

Three things decide how long we hold something:

1. **Is it a child's?** If yes, the period is the shortest one that still lets the product do its job.
2. **Does someone need it later?** A player's own record is the product — losing it is the harm, not the safeguard.
3. **Do we need to prove something happened?** Consent, reports and safety decisions are evidence. Deleting the evidence that we behaved properly does not make anyone safer.

Where those pull against each other, the first wins.

---

## The periods

### A player's record

| What | How long | Trigger |
|---|---|---|
| Profile, CV, positions, stats, achievements | While the account is live, then **2 years** after it goes dormant | Dormancy = 24 months with no sign-in by the player or their guardian. We email the guardian at 21 months offering export, keep or delete, and again at 23. |
| Highlight links | With the record | As above |
| Profile photograph | With the record | Originals are never stored. The processed image goes with the record. |
| Coach assessments | With the record | The record belongs to the player, so the player's clock governs, not the club's. |
| Development targets and coach notes | With the record | As above |

**On request: immediately.** A player or guardian deleting a record does not wait for any period in this table. Deletion runs at once; see *What deletion actually does* below.

**The two-year dormancy period exists because football is seasonal and families come back.** A 13-year-old who stops for a year and returns should find their record, not an apology. Two years is long enough for that and short enough that we are not holding the football history of children who have left the game.

### The guardian

| What | How long |
|---|---|
| Name, email, mobile, stated relationship | While the guardianship link is live |
| The link itself | Ends automatically on the child's 18th birthday; the record of it stays in the consent log |
| Verification challenges (hashed tokens, attempts, timestamps) | **90 days** from creation, then deleted. They are single-use and worthless afterwards. |

### A pending invitation

| What | How long |
|---|---|
| First name, date of birth, guardian contact — nothing else exists at this stage | **14 days.** Purged automatically if no guardian approves. Not archived, not soft-deleted: purged. |

### A registration of interest

*Added 27 August 2026 with the Interest Register. It is the first time we hold a disclosure a child made to a third party, so it is set out in more detail than the rest.*

| What | How long | Trigger |
|---|---|---|
| The registration row — the squad, the position, the free-text line, and the link | **90 days after the trial date**; for a general registration with no trial attached, **12 months** from the date it was made | The trial date, not the submission date. Ninety days covers the trial and a follow-up window. |
| One the club never opened | **Same clock.** A child is not held longer because a club was inattentive | — |
| A withdrawn or revoked registration | **The note text is emptied immediately**, in the same database transaction that kills the link; the row deletes on the same clock | The moment a family revokes the link or deletes the profile |
| A suspended club's register (unpaid card) | **Hidden, not deleted.** Nothing is destroyed during a payment failure | 14-day grace, then suspension |
| The club's register on cancellation | **Deleted within 30 days**, and we confirm to the club in writing | Cancellation or termination |
| The consent-log entry for the disclosure | **Permanent**, like every consent event. It records *that* a guardian disclosed a link to a named club for a named trial. It never holds the note or anything about the child's football. | — |

**Two things worth stating rather than implying.**

**Revocation empties the note, not merely the link.** The link sits behind a token, so revoking it ends the club's access to the page. The note does not — it is a field on a row in our database that a club has already read. If revocation only killed the link, "nothing readable survives" would be untrue. So the note is emptied in the same transaction, and that is a build invariant rather than a description.

**There is no export, and that is the point.** A downloadable list was the only object in this product that created an uncontrolled copy of a child's record — it would have survived revocation, so a family who switched their link off would have had no idea a spreadsheet of their fourteen-year-old was still on a laptop. It has been removed. A club works its list inside Pitch. *A screenshot is still possible and no rule prevents one; what we can say honestly is that we do not provide the tool, and that the terms forbid taking a copy by any means.*

### Payments and subscriptions

*Added 27 August 2026, when clubs began paying by card.*

| What | How long |
|---|---|
| **Card numbers** | **Never held.** Payment runs on a hosted page belonging to our payment provider; a card number never reaches our systems at any point. |
| Subscription state on the club record — active, suspended, cancelled, and the plan | While the club account exists, then with it |
| Billing contact name and email | While the subscription exists, then **7 years** — tax and financial records |
| Invoices, receipts and payment history | **7 years**, as financial records require |
| What the payment provider holds | Its own retention, under its own terms. **It never receives anything about any child** — a club, a contact and a card, and nothing else. |

### A pending version of an under-16 page

*Added 27 August 2026 with guardian re-approval on edit.*

| What | How long |
|---|---|
| An edit a child has made that a guardian has not yet approved | Until approved, rejected, or **60 days**, whichever comes first — then discarded |
| Version history of approved pages | With the record |

**A pending edit is personal information about a child that no adult has approved**, so it inherits the same protections as the pre-approval draft: unreachable by every query in the system, rendered to exactly two people — the child who typed it and the guardian being asked — and never visible to a club, a coach, a search, a support console or a share card. A club holding a link keeps seeing the last approved version.

### A coach or club

| What | How long |
|---|---|
| Coach profile, coaching history, credentials | While the account is live, then **2 years** dormant |
| Working With Children Check number | **While the coach holds an account, and no longer.** Deleted on account closure, same day. *Subject to doc 18 Q4 — if counsel advises we should not hold the number at all, this row becomes "not held", and only a checked-on date survives.* |
| Club page, philosophy, teams, notices | While the club account is live |
| Trial notices | **Auto-expire the day after the trial**, then 12 months as a record of what was published, then deleted |
| Unclaimed listings compiled by us | Until claimed, corrected or the trial passes; then as above |

### Messages and delivery

| What | How long |
|---|---|
| Email and SMS content | **We do not retain message bodies.** Our providers hold delivery logs to their own schedules; we hold the fact of sending, not the message. |
| Consent-funnel events (invitation created, sent, delivered, opened, verified, approved, purged) | **13 months.** One full football season plus a month, which is what makes a year-on-year comparison possible. Then deleted, not aggregated into something that outlives it. |

### Safety records

| What | How long | Why |
|---|---|---|
| Report received, decision, action taken, timestamps | **5 years** | Appears to be required by the Basic Online Safety Expectations. **[LEGAL: doc 18 Q6 — confirm the provision and whether five years attaches to the record of handling or to the material itself.]** |
| The reported material itself, where we hold it as evidence | **12 months**, held separately with restricted access, unless a law-enforcement or legal hold applies | What must be provable is that we handled a report properly. That is not the same as a five-year file about a child. |
| Identifying details inside a safety record | **Minimised at the point of creation** — we record what happened and what we did, not more about the child than the decision needed | Same reasoning |
| Account suspension and closure decisions | 5 years | Pairs with the appeal right |

### The consent log

**Kept permanently, and this is the deliberate exception.**

Every approval, withdrawal, share, outside-contact attempt, terms acceptance and age transition, with who and when. It is append-only, with no update or delete path anywhere in the code.

It survives deletion of the record because it is the evidence that we did what we said we would. We cannot prove we deleted something by deleting the proof.

**What it does not contain:** any football content. No stats, no assessments, no photographs, no highlight links, no free text. A consent log entry says that a named guardian approved a named child's profile on a date, at a policy version. Once the record is deleted, that is all that remains anywhere in Pitch, other than a coach's anonymised count.

---

## What deletion actually does

When a player or guardian deletes a record:

| Where | When it goes |
|---|---|
| The live product — profile, record, photograph, highlight links, memberships | **Immediately.** The page is gone before the confirmation screen finishes. |
| Share links and tokens | Immediately and irreversibly. Any existing link stops working. |
| Cached pages and our own search index | Within 24 hours |
| Social preview cards **we** generate | Immediately — the endpoint re-checks the token on every request and returns a generic card |
| Social preview cards **other platforms have cached** | **We cannot reach these.** WhatsApp, Facebook and iMessage keep their own copies indefinitely. It is why a minor's card carries a first name, an initial and football, and nothing that locates a child — and why a guardian approves the exact image before it can leave. |
| Any club register the player appears in | Immediately — the row shows withdrawn and **the note is emptied in the same transaction** |
| Our backups | **Within 35 days.** Backups run daily on a 30-day rolling window; the last backup containing a deleted record ages out within 35 days of deletion. We do not selectively edit backups — restoring a partially-edited backup is how deleted data quietly comes back. |
| A coach's copy | Read access ends immediately. The coach keeps an anonymised count of assessments written, with no name and no content. |
| The consent log | Stays, as above. |

**35 days is the honest number and we would rather publish it than say "promptly".** If a total-loss restore ever happened inside that window, a record deleted just before it could reappear. If it did, we would find it through the consent log — which records the deletion — and delete it again, and tell the family.

---

## Holds that override everything here

We keep information longer than these periods only where:

- a law requires it;
- a court, tribunal, police force or the eSafety Commissioner requires it;
- it is needed for a legal claim that has been made or is reasonably anticipated; or
- deleting it would destroy evidence in an active child-safety matter.

A hold is recorded, is limited to what the hold actually needs, and ends when the reason ends. **A hold is never a reason to keep something convenient alongside something required.**

---

## Open items

| # | Item | Where it goes |
|---|---|---|
| 1 | Whether the five-year safety-record period is required, and of what exactly | doc 18 Q6 |
| 2 | Whether we may hold a Working With Children Check number at all | doc 18 Q4 |
| 3 | Whether 2 years' dormancy is defensible for a child's record, or whether it should be 12 months | doc 18 Q3 |
| 4 | Whether the permanent consent log is the right call, or whether it should expire — our view is that it should not, but it is the one place we deliberately keep something about a child forever, so counsel should look at it | doc 18 Q3 |
| 5 | **Whether 90 days past the trial date is right for a registration**, and whether 12 months is right for a general one with no trial attached | doc 18 Q11 |
| 6 | Whether 7 years is the correct period for financial records for a company of this size | doc 18 Q11 |

---

*Pitch Football · a registered business name of EBSD Enterprises Pty Ltd (ACN 701 879 718) · retention statement · doc 23 · v1.3 draft · 1 September 2026 · not yet published · every period here is enforced by a job, or it is not a period*
