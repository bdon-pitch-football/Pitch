# PITCH — Retention Statement

> **⚠️ v1.7, 1 October 2026 — also: a pending request a parent ends ("No, end this request").** It is deleted at once by the same deletion as the 14-day purge, with the messages sent for it, and only a subjectless `purged` event remains. The SMS meter and STOP rows now say what they keep: a keyed fingerprint, never the number. *An unkeyed sha256 of an Australian mobile was recovered in 168 ms in review; that is the number, not a fingerprint of it.*
>
> **⚠️ v1.7, 1 October 2026 — the investigation trail.** Who looked at a child's record, when and under which report **survives the child's erasure**, with the free text wiped and no key reaching the child. *A promise to tell a guardian who looked is worth nothing if the answer is deleted with the record, and the question is asked after something has gone wrong.*
>
> **⚠️ v1.6, 1 October 2026 — two records that outlive a child's record, and a sentence that had become untrue.** *Send my CV* now fills in a club's own published address, so a club must be able to stop receiving CVs — and **that stop has to keep working after the family has erased the child**, because the email in the club's inbox does not disappear when the record does. Two records are added, **both kept indefinitely and neither holding anything about any child**. The consent-log section said that after deletion the log was all that remained in Pitch; **after a send that was no longer true**, and it now names these two.
>
> **⚠️ v1.5, 7 September 2026 — this version exists to end a version collision, and the collision is worth reading about.**
>
> **There are two different documents both stamped v1.4.** One is mine, dated 3 September, which fixed a version stamp in the body. The other is the build's, dated 7 September, which applied my U-7 ruling. **Neither knew about the other**, because my complete pack was sitting in the Board Room unplaced while the ruling was applied straight to the live file.
>
> **v1.5 is both of them plus the rest of the ruling, and it is built on the live file so nothing the build wrote is lost.** From here doc 23 has one lineage.
>
> **What the live v1.4 also had wrong, which is the reason this matters and not just tidiness:** its header said v1.4, its footer said **v1.3**, and the version stamp in its body said **[1.0]** — a bracket, and the wrong number. **Three version numbers in one document, in the document whose entire purpose is that every period in it is exact.** All three now agree.
>
> **What v1.5 adds to the build's v1.4:** the U-1 lapse period and the U-4 abuse counter, which were in the same ruling and did not travel with U-7.
>
> **Doc 23 · v1.5 draft · 7 September 2026 · NOT YET PUBLISHED.**
>
> **v1.3, 1 September 2026 — the entity, and the domain.** This document is published by **EBSD Enterprises Pty Ltd (ACN 701 879 718 · ABN 65 701 879 718), trading as Pitch Football** (D-148). It carried neither the entity nor the right domain until now. **The check that caught it asserts presence rather than agreement** — nothing here contradicted anything; the legal person was simply absent, which is the shape every serious defect in this corpus has taken.
>
> **v1.4 change — one sentence, and it is a stale description rather than a broken promise (John, doc 31, U-7).** The consent-log description was written when the log recorded approvals and nothing else; the send flow arrived afterwards and the sentence was never revisited. It now says that the log holds **the fact and the recipient of a disclosure** — because a guardian's central right is to know where their child's information went, and a revocation right cannot be exercised against a recipient you cannot name. It still holds no message and nothing about the child's football. **Every deletion job implements a row of this document, so this is a build change, not an edit.**
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

**Last updated:** [date] · **Version:** 1.5

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
| First name, date of birth, guardian contact — nothing else exists at this stage | **14 days**, or **at once** when the person it was sent to ends it from its link ("No, end this request"). Purged either way, by the same deletion: not archived, not soft-deleted. **The messages sent for it go with it**: their subject, body and recipient address, and any text still waiting to send. **What survives:** one `purged` event, with no subject, the reason (expired or ended) and the channel the link came by. |

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

### Send requests that were never actioned

| What | How long |
|---|---|
| A send a child composed that a guardian never actioned | **14 days, then it lapses and is deleted** — not queued, not held. The same period as an unapproved invitation (D-17), for consistency rather than for any legal reason. *A composed request sitting indefinitely is a child's free text held for no purpose, which is the strictly-necessary bar (D-25) failing quietly.* The child is told their request expired and may make it again; **they are never told, and must not be able to infer, that a guardian did not act.** |

### Blocked and rate-limited attempts

| What | How long |
|---|---|
| Sending actor, timestamp, reason class — **no recipient, no child, no content** | **90 days**, in a store separate from the consent log, never rendered as part of any child's record. *The consent log records what happened, never what was attempted and stopped — that is right, and it is why this exists somewhere else. It answers "is somebody probing us" without answering "what happened to this child", and those two questions must not share a table.* |

### Messages and delivery

| What | How long |
|---|---|
| Email and SMS content | **A message's subject and body are cleared when it is sent, or when it finally fails.** Until then they are held only so it can be sent. **The address it went to is kept for 30 days**, so support can answer "did my message arrive?", then cleared; the count of tries stays. Our providers hold their own delivery logs to their own schedules, stated here once they are set. |
| The SMS spend meter | **Each text's cost and time, kept for the spend cap.** The number it went to is held only as a keyed fingerprint, for the 24-hour sending limit, and dropped after 24 hours. |
| SMS opt-outs (a STOP reply) | **For as long as Pitch sends SMS**, because a STOP must be honoured. Held only as a **keyed** fingerprint of the number, never the number and never an unkeyed hash. |
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

**What it does not contain:** any football content. No stats, no assessments, no photographs, no highlight links, no free text. A consent log entry says that a named guardian approved a named child's profile on a date, at a policy version — and, where a send occurred, **who it was sent to**. It holds the fact and the recipient of a disclosure. It never holds the message, and it never holds anything about the child's football. Once the record is deleted, that and **the two stop records below** are all that remains anywhere in Pitch, other than a coach's anonymised count. *Corrected at v1.6: the sentence previously said the consent log was all that remained, and after a send that is no longer true.*

---

## Stopping a club receiving CVs — two records that outlive the child's

**Neither holds anything about any child, and neither can be joined to one.**

| What | How long | Why |
|---|---|---|
| **The stop reference** — the id of a CV that was sent, the address it went to, and when. **No child, no record, no sender, no content, and no key that reaches any of them** | **Kept indefinitely** | **A club's opt-out has to keep working after the family erases the child.** The email sitting in the club's inbox has no expiry, so a stop reference with one would silently stop working and the next CV would arrive at an address that had asked us to stop. *Any period we could choose is one the email outlives, which is the argument for choosing none.* **The recipient address is already on the consent log's send row, so nothing about the child survives that did not survive before.** |
| **The stop list** — addresses and domains that have asked us to stop, who asked, and when | **Kept indefinitely** | **A stop that expires is not a stop.** |

## Who looked at a child's record, after the child is gone

| What | How long | Why |
|---|---|---|
| **The investigation trail** — that a named person looked, when, under which logged report, and which grant allowed it. **The free text of the investigation is wiped with the record; the trail is not** | **Kept after the child's record is erased**, with **no key that reaches the child** | **We promise a guardian a straight answer to "who looked at my child's record and why."** An answer that disappears when the record does is not an answer — *and the question is most likely to be asked after something went wrong, which is exactly when the record is most likely to have been deleted.* |

*Verified against the suite rather than taken on trust: the trail survives an erasure carrying the look, its time, the investigator, the grant and the report id, and losing every word of text.*

---

**A schema rule, not a description:** none of these records holds a foreign key to a person, a profile or a send, and no query can join one to a child. **If that ever stops being true, this section is wrong rather than out of date.**

*Where a family typed an address of their own choosing, that address is what the stop reference holds — an adult's address, kept so that adult can stop us, and nothing more.*

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

*Pitch Football · a registered business name of EBSD Enterprises Pty Ltd (ACN 701 879 718) · retention statement · doc 23 · v1.7 draft · 1 October 2026 · not yet published · every period here is enforced by a job, or it is not a period*
