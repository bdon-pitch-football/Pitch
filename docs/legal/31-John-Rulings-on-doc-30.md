# John (GC & Child Safety) → BUZ and the build · Rulings on doc 30

| | |
|---|---|
| **From** | John — General Counsel & Child Safety |
| **To** | BUZ — CEO · the build |
| **Copied** | Leo — CTO |
| **Date** | 7 September 2026 |
| **Answers** | `legal/30-Open-Decisions-Brief-D14.md` — eleven items |
| **Status** | **A ruling on every one.** Three go against the built default. One goes against both clauses in the contradiction rather than picking a side. Everything here needs a D-number before it binds. |
| **Numbering** | Placed as **doc 31**. |
| **Entity** | **EBSD Enterprises Pty Ltd** (ACN 701 879 718 · ABN 65 701 879 718), trading as Pitch Football |
| **Version** | **doc 31 · v1.1 · 7 September 2026** — v1.0 was placed without an entity line or a version string and failed the corpus check's presence assertion (S9). *An instrument that names no legal person is the defect I have now found four times, and the fourth was mine.* |

---

## Before the list — one thing about the brief itself

**It marked its own defaults as decisions made by omission and said which ones it was uncomfortable with.** U-2 in particular: *"the one on this list we are least comfortable having chosen by omission."* That instinct was right, and it is the item where I have gone furthest against what is built.

**A spec that declines to answer a policy question and says so is doing its job.** Doc 14 marking eleven cases `unruled` rather than guessing is the reason this is a one-hour conversation instead of a rewrite.

---

# Part 1 · The contradiction between two documents

## U-7 · The recipient address stays. Doc 23 is what changes.

**RULING: keep the recipient address in the consent log, in full, visible to the guardian. Amend doc 23.**

**The conflict is real but it is not where the brief located it.** Doc 23's *"what it does not contain"* list is about football content, and an email address is not football content. The sentence that actually conflicts is the next one:

> *"A consent log entry says that a named guardian approved a named child's profile on a date, at a policy version."*

That reads as exhaustive, and it no longer is. **It was written when the log recorded approvals and nothing else.** The send flow arrived afterwards and the description was never revisited. **This is a description that went stale, not a promise we broke** — and the distinction matters, because the fix is honest either way but only one of them requires an apology.

**Why the address stays, and it is not a close call.**

The guardian's central right in this product is to know **where their child's information went**. Every other right depends on it: you cannot exercise a revocation right against a recipient you cannot name. A parent asking *"who did we send this to?"* and being told *"we recorded that a send happened"* has been given a log that proves we were careful and tells them nothing they need.

**And the retention cost is small and bounded.** A recipient address here is a club's contact address — business contact information, not a private individual's. It is one field, it is the material fact of the disclosure, and it is held in the one store whose entire purpose is proving what was disclosed and to whom.

**What to change in doc 23** — one sentence, replacing the exhaustive one:

> *A consent log entry says that a named guardian approved a named child's profile on a date, at a policy version — and, where a send occurred, **who it was sent to**. It holds the fact and the recipient of a disclosure. It never holds the message, and it never holds anything about the child's football.*

**Doc 23 is an internal instrument, not a rendered one**, so this is not a D-144 event and nothing re-asks. But **every deletion job implements a row of doc 23**, so it is a build change and it should land as v1.5 rather than as an edit.

---

# Part 2 · Doc 14 contradicting itself

## M11 / L29 · Neither clause is right. The answer is to tell the families.

**RULING: L29 stands — family-held links keep working. M11 is not implemented, and it should be recorded as unbuildable rather than left in the spec. But suspension for a child-safety reason triggers a notice to every affected guardian with a one-tap revoke.**

**M11 asks for something that cannot be built, and the reason is worth stating in the register so nobody writes it again.** A share token is a URL. It is not bound to a club, carries no recipient identity, and works for whoever holds it — **which is precisely what makes it the family's own act of disclosure under L29.** Any future clause that assumes a link can be revoked *from a club* is assuming a fact about the architecture that is not true.

**But the brief is right that the case that matters is the bad one**, and I am not going to rule on the tidy version. A club suspended because something went wrong is exactly the moment when "the family's links keep working" reads worst.

**So the answer is neither clause.** Force-revoking every token minted by every player registered at that club is worse than it sounds: tokens are not club-bound, so we would be killing links those families sent to **other** clubs as well — **punishing a family, invisibly, for something a club did.** That is the opposite of what the architecture is for.

**What we can actually do is tell them.** Where verification is revoked for a child-safety reason:

1. **Every guardian whose child has an unrevoked link that was sent to that club** receives a message: the club is no longer verified on Pitch, here is what that means, and **here is the button that switches your link off.**
2. **The button is in the message.** One tap, no login hunt, no explanation required of them.
3. **We do not say why the club was de-verified.** That is somebody else's information and possibly an allegation; §8.3's reasoning applies — we may withhold the reason and we must not withhold the ability to act.
4. **We do not revoke on their behalf.** The family made the disclosure. The family unmakes it. **Agency, not automation** — and a system that quietly reaches into a family's disclosures, even kindly, is a system that can do it for a worse reason later.

**This requires one thing the build does not have: a reason class on the revocation.** Ordinary de-verification — lapsed paperwork, non-payment, an admin change — triggers nothing beyond ending club-side access, which is already tested at M10. **Only the child-safety class triggers the notice.** Without that flag, either every de-verification alarms families or none does, and both are wrong.

---

# Part 3 · The seven unruled cases

## U-1 · Fourteen days. And tell the child, not the parent's story.

**RULING: an unactioned send request lapses after 14 days, matching D-17.**

Consistency is the smaller reason. **The real one is D-25** — the strictly-necessary bar. A composed-but-unsent request holds a child's free text in a pending state **for no purpose at all** once it is clear nobody is going to act on it. Indefinite is not a retention period; it is the absence of one, and this is the one document set where we have told families every period is enforced by a job.

**When it lapses, the child is told — carefully.** They should know their own request expired and that they can make it again. **They should not be told, or be able to infer, that a parent ignored them.** The wording is doc 15's, not mine, but the constraint is mine: *the request expired* — never *your parent did not act on it*.

**This does not touch D-138.** Silence stays silence is about a club's judgement. This is about the child's own action and their own record.

---

## U-2 · Either guardian may send. The other gets a 24-hour undo. — *against the built default*

**RULING: either approved guardian may send alone; the other is notified immediately; and for 24 hours the non-initiating guardian can revoke that link with one tap from the notification.**

**The brief was right to be uncomfortable, and also right not to change it unilaterally.**

**Why I am not extending most-restrictive-wins to a pre-send veto.** It sounds like the safer answer and it is not. A send that waits for a second guardian is a send that, in a large number of real families, **never goes** — the second adult is at work, is not on email, or is not really in the picture. That is the D-22 equity problem again, and worse in one specific way: **it hands one parent a standing block on the other's ordinary parenting**, exercised through our product, in exactly the families where that will be used as leverage.

**Why an undo rather than nothing.** D-51's principle is honoured in substance. The more restrictive guardian's wish still prevails — a few minutes later rather than a few minutes earlier — and **what was disclosed is a revocable link, not a copy.** The second guardian already holds the revoke right; all this does is put it in front of them at the one moment it is worth anything.

**Two boundaries on it.**

- **The undo revokes the link. It does not un-send the email**, and the notification must say so plainly. We can stop a club opening the page. We cannot make them forget the message arrived, and a product that implies otherwise is lying to a frightened parent.
- **Where a suppression or a court order is on the record against a guardian, that guardian cannot send at all** — that path already exists and this ruling does not touch it.

---

## U-3 · Ten is fine. Confirmed.

**RULING: confirm 10 sends per sending actor per 24 hours.**

There is no legal number here and I am not going to invent one. The properties that matter are already asserted — **counted per sender never per recipient, and an identical response when limited** so the ceiling is not an oracle. Ten is generous for a family and tight enough for a scraper. Change it whenever a real family hits it.

---

## U-4 · Confirm the log. Build the counter somewhere else. — *adds to the built default*

**RULING: confirm doc 14 — the consent log records what happened, never what was attempted and stopped. But a blocked send must leave a trace in a separate operational record.**

The brief called this correctly: good privacy, poor forensics. **Both halves are true and they do not have to be traded against each other**, because they want different records in different places.

**The consent log is a child's record.** It should contain the things that happened to that child, and a stranger's failed probe is not one of them.

**But doc 25 commits us to investigating reports, and the Basic Online Safety Expectations assume we can detect misuse.** A log that cannot show a pattern of blocked attempts cannot support either.

**So: an operational abuse counter** — sending actor, timestamp, reason class. **No recipient, no child, no content.** Ninety days. A different store, never rendered as part of any child's record, and not something a guardian is shown as though it were about them. **It answers "is somebody probing us" without answering "what happened to this child", and those are the right two questions to keep apart.**

---

## U-5 · Yes, reduced. The club, not the address. — *against the built default*

**RULING: an under-16 sees their own consent log showing that a send happened, when, and to which club by name. They do not see the recipient email address. The guardian sees it in full.**

**The brief found the real tension and I am ruling with it rather than around it.** A consent log is simultaneously the child's record and **a record of what an adult did on their behalf** — and in a family where that is contested, handing a twelve-year-old the full detail is not the neutral act it looks like.

**The reduction costs the child nothing.** *"Riverside FC, 12 March"* answers every question a child actually has about where their football went. **The email address answers none of them** and is the single field carrying both third-party information and family-conflict risk. Removing it is data minimisation applied to the person we minimise for hardest.

**This one lands in doc 21**, because it is a thing a child sees, and doc 21 says what a child sees in words they can read.

---

## U-6 · Yes — purpose-bound, time-boxed, logged, and disclosed. All four.

**RULING: a complaints investigator gets a distinct access path to send rows. Support does not — the restrictive reading of A15 and D-79 stands.**

**Doc 25 promises we investigate.** An investigator who cannot see the send that is the subject of the complaint cannot investigate it, and a published promise we cannot perform is the thing this whole document set exists to prevent.

**Four conditions, and none of them is optional:**

1. **Purpose-bound** — opened only against a logged report reference. No standing access, no browse.
2. **Time-boxed** — expires with the report, extendable once with a recorded reason.
3. **Logged** — who, when, which child, which report. The access record is itself append-only.
4. **Disclosed** — **a guardian may ask who at Pitch has looked at their child's record and why, and get a straight answer.** That is the condition that makes the other three real.

**And the part worth saying out loud: today the complaints investigator is BUZ.** So this is a discipline one person is imposing on himself, with nobody to notice if he skips it. **That is precisely when it has to be written down and logged by the system rather than by the person** — the log is not there to catch a stranger, it is there because in two years somebody will ask what we did and memory will not be evidence.

---

## U-11 · Confirm no inbound route. Then say so on the send.

**RULING: no inbound reply route at launch. But the send must tell the club that, and tell them what to do instead.**

**The build's view is right.** No route closes C1 and C2 by construction rather than by policy, and a contact path that exists but is "safe" is a path somebody will eventually widen.

**The gap the brief named is also right, and it is fixable with a sentence.** Today a club with a genuine question replies into their own mail client and reaches nobody. **They will conclude we are broken, not that we are careful.** The send should carry one line: *replies to this message do not reach the family; if you want this player at a trial, post it on Pitch or send an invitation through their guardian.*

**And it should be a published property, not an omission.** One line in doc 22 and one in doc 25: **there is no way to reply to a family through Pitch, at any tier, for anybody.** Stated, it is a safety feature. Unstated, it is a bug report waiting to happen.

**The "behaviour after revocation" question dissolves** — there is no route, so there is nothing to define.

---

# Part 4 · The D-108 carve-out

**RULING: confirmed, and narrower than the brief asked for.**

BUZ is right that *"registering interest"* in a coaching role would be **evasive rather than careful** — there genuinely is something to be turned down from, and the honest word is *apply*.

**The carve-out is limited to:**

- **Adult coaching-role surfaces only.** Never on any surface where a person under 18 is the subject. Never in a message a family receives.
- **The 18+ gate stays**, and it is not merely a restrictive default we happened to choose. A jobs board a minor can apply on is a different product with a different analysis.

**And the thing the carve-out would otherwise open, which the brief did not raise.** If a club can accept, it can decline — and *declined*, *rejected* and *unsuccessful* are on the same banned list for a reason.

**So: a club may close a role and tell applicants it is closed or filled. A club may not publish, send or record a judgement about a named individual.** That is doc 24 rule 7 pointed at the same problem from the other end — a club states facts about a coach; it does not publish an opinion about one. **Adults have defamation rights children do not, which makes this stricter here, not looser.**

**On the Online Safety Act reasoning in D-108** — the stated purpose was keeping the player register out of the feedback-feature analysis. **An adults-only coaching board does not touch it.** The age-restricted regime concerns under-16s, and the assessment is service-level and turns on the platform's purpose, not on one adult surface. The carve-out is safe on that ground.

---

# Part 5 · Direct video upload — my answer before you need it

**Flagged correctly, and my position is: not before there is a second person, and not without counsel.**

The brief has the shape of it exactly right. **Uploading changes what Pitch is.** Today we hold a URL and the file lives on YouTube or Veo — and **that is a safety feature, not a limitation, and it should be described as one.** The moment we hold the file:

- We are **hosting** video of children, with the detection and reporting expectations that attach to a content store rather than a link store.
- The worst-case content problem becomes ours to find, not someone else's — and **a one-person company cannot staff that**, which is the same conclusion I reached about the 24-hour takedown and for the same reason.
- **The deletion cascade has to reach the file, every transcode and every thumbnail**, or doc 23 stops being true.

**This is a question for counsel and it is the first thing I would put on the list after the fifteen already in doc 18.** Not urgent. Not close to launch.

---

# What this needs from BUZ

**Eleven rulings, and none of them binds until it has a D-number.** Three change what is built (U-2, U-4, U-5), one changes a document (U-7), one adds a mechanism (the child-safety reason class on revocation), and the rest confirm.

**If it is useful, group them:** U-3, U-4's first half, U-11 and the D-108 carve-out are confirmations of what exists. U-1, U-5 and U-7 are single changes. **U-2 and the M11/L29 notice are the two with real design work in them**, and they are also the two that matter most if something goes wrong.

---

## One thing I noticed that is not on the list

**`legal/00-Legal-Register.md` is stale.** It shows doc 26 at v1.1 and the version identifiers as `20@v2.1 · 21@v2.0 · 22@v1.4`. The real state is **20 at v2.5, 21 at v2.3, 22 at v1.7, 26 at v1.3**, and consent rows are stamped `20@v2.4`.

**That file is the index that tells anyone which copy is the document** — it is the answer to the problem D-144 was created to solve, and it is currently wrong about nine of them. Placement is Leo's lane so I have not touched it, but **an index that has fallen behind its own contents is worse than no index**, and it is the same defect I have now found in a banner, a docstring and a code comment.

---

## Alignment (Standing Order 01)

- **Serves:** pillar zero. Three of these rulings turn on the same principle — **the family discloses, the family revokes, and we do not reach into that on their behalf even when we mean well.** M11, U-2 and U-5 are all that principle in different clothes.
- **Tension:** V2 at U-2. An undo is slower than a veto and someone will one day say we should have blocked the send. I have written down why we did not.
- **Recorded:** the build's defaults were right in seven of eleven cases and it flagged the ones it was least sure of. **The two I overturned are the two it said it was uncomfortable with**, which is a good hit rate for a spec that had to choose something.

*Pitch Football · a registered business name of EBSD Enterprises Pty Ltd (ACN 701 879 718) · rulings on doc 30 · doc 31 · v1.1 · 7 September 2026 · rulings, not decisions — nothing binds until BUZ calls it in doc 06*
