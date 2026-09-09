# 30 · Open decisions blocking the launch gate

**For:** John (General Counsel)
**From:** BUZ / build
**Date:** 7 September 2026
**Entity:** EBSD Enterprises Pty Ltd (ACN 701 879 718 · ABN 65 701 879 718), trading as Pitch Football
**Version:** doc 30 · v1.1 · 7 September 2026 — *v1.0 carried no entity line and no version string and failed the corpus check's presence assertion (S9). Added, and the document kept in `legal/` rather than moved to the Board Room: by the register's rule it is an argument, but it is also the record of the eleven questions that shaped the build, and doc 31 answers it clause by clause.* **Answered in full at doc 31 v1.1.**
**Subject:** Nine decisions doc 14 leaves open, one contradiction between two published documents, and one register amendment to record.

---

## Why you are being asked

D-47 and D-131 make the launch gate **doc 14 green, or we do not go**. The permission suite now runs **397 checks, all passing**, and pins **165 of doc 14's 244 enumerated cases**.

Nine of the remaining cases **cannot be made green by writing code**. Doc 14 marks them `unruled` itself — they are policy questions the spec deliberately declined to answer. Two more are worse than unruled: **doc 14 contradicts doc 23**, and **doc 14 contradicts itself**.

Every one of these has a default behaviour in the build today, because code cannot abstain. Where the default is a real decision made by omission, it is flagged below. **Nothing is live**, so all of it is still cheap to change.

**What we need from you:** a ruling on each numbered item. Where we have a view, it is stated and marked as ours, not yours.

---

## Part 1 — The contradiction between two published documents

### U-7 · What the consent log may record about a send

**doc 14 L55** requires that every send writes exactly one append-only row carrying **recipient address**, timestamp, sending actor, initiating actor, token id, and the child's age band at the moment of sending.

**doc 23 (Retention Statement, published)** says of the consent log:

> *"**What it does not contain:** any football content. No stats, no assessments, no photographs, no highlight links, no free text."*

and separately:

> *"We do not retain message bodies… we hold the fact of sending, not the message."*

**The conflict.** A recipient address is not a message body and not football content, but it is more than "the fact of sending" — it is a permanent record of a third party's email address, held forever, in the one store we have told families is permanent.

**What is built today:** doc 14's version. The recipient address **is** written to the consent log and the guardian can read it in full.

**Why it was built that way:** doc 14 L57 requires the guardian to be able to see *"every send, recipient address in full"*. A parent asking "who did we send this to?" and being told "we don't keep that" is a worse answer than the retention cost.

**The question for you:** does the recipient address stay, and if so does doc 23 need amending, or does the log record only that a send occurred? *This is a one-line change in either direction.*

---

## Part 2 — Doc 14 contradicting itself

### The M11 / L29 problem — a token is not bound to a club

**M11** — *"Verification is revoked while a club holds a live token → the token stops resolving. Assert revocation of `verified` is equivalent to revocation of every link that club holds."*

**L29** — *"Recipient is `club_unverified` → receives and can open the link. Verification gates data flow **inside** the product; a tokenised link is the family's own act of disclosure."*

**Both cannot be true.** A share token is a URL. It is not bound to a club, has no recipient identity, and works for whoever holds it — which is exactly what makes it the family's own act of disclosure under L29. M11 asks us to revoke "every link that club holds", and we do not and structurally cannot know which links a club holds.

We could make suspension trigger a global revocation of every token minted for any player registered with that club. That is a heavy, family-facing action taken because of something a *club* did.

**What is built today:** L29's reading. Club suspension ends every club-side read immediately (verified in test — M10), and tokens already in the world keep working until the family revokes them.

**Our view:** L29 is right and M11 was written without noticing tokens are not club-bound. But this is a child-safety call in the case that matters — a club suspended *because something went wrong* — so it is yours, not ours.

**The question:** on suspension, do family-held links keep working (L29), or does suspension force-revoke tokens for every player registered with that club (M11)?

---

## Part 3 — The seven unruled cases

Each states the question, today's default, and what changes.

### U-1 · How long does an unsent request live? (L16)

A child composes a send; the guardian never acts. Doc 14: *"`send_state = lapsed`. Nothing transmitted; the request is gone, not queued. **Window length unruled.**"*

**Today:** there is no window. An unactioned request sits indefinitely. Nothing is transmitted and nothing chases anyone, so D-138 holds — but the request never expires.

**The question:** 14 days, 30, 90, never? *Our instinct is to match D-17's 14-day purge for unapproved invitations, for consistency rather than for any legal reason.*

### U-2 · May one guardian send alone when there are two? (L17)

**Today: yes.** Either approved guardian may dispatch alone; the other is notified. This is a permissive default and it is the one on this list we are least comfortable having chosen by omission.

D-51 says two guardians have equal visibility, either may approve, both are notified, and **most-restrictive-wins**. Sending a child's CV to a club is arguably the most consequential outward act in the product.

**The question:** does most-restrictive-wins extend to sending — i.e. can either guardian veto a send the other initiated — or is either-may-send correct?

### U-3 · The send rate-limit ceiling (L43)

**Today:** 10 sends per sending actor per 24 hours. One config value, one definition, per doc 14's requirement. The suite asserts the *property* (identical response when limited, counted per sender never per recipient), not the number.

**The question:** is 10 the right number? Low risk — changing it is one constant.

### U-4 · Does a blocked send leave a record? (L56)

Doc 14: *"No send row. The log records what happened, never what was attempted and stopped."*

**Today:** implemented as written. A rate-limited, blocked or lapsed send writes nothing.

**The tension worth naming:** this is good privacy and poor forensics. If someone were probing us, the log would not show it. We think doc 14 is right and mention it only so the choice is visible.

**The question:** confirm, or should blocked attempts be recorded somewhere separate from the consent log?

### U-5 · May a under-16 read their own consent log? (L58)

**Today: yes.** A child can see their own send history, including recipient addresses. This was a default, not a decision.

**Why it matters both ways.** It is their record and their right to know where it went. But a consent log is also a record of what a *parent* did on their behalf, and in a family where that is contested, a child reading it is not neutral.

**The question:** does an under-16 see their own consent log, a reduced version, or nothing until 16?

### U-6 · What may support see, and what may complaints see? (L60)

**Today:** support sees invitation state only and no send rows at all — the restrictive reading of A15 and D-79.

**The gap:** doc 14 says *"complaints access unruled"*. Doc 25 (Complaints and Takedown) commits us to investigating reports. If a family reports that a club received their child's CV improperly, the person investigating currently cannot see the send that is the subject of the complaint.

**The question:** does a complaints investigator get a distinct, logged, time-boxed access path to send rows — and if so, what is logged about their access?

### U-11 · A club replies to a send after the link has been revoked (L27)

Doc 14: a reply routes to guardian and child together, logged, via the same C3 routed-contact path. *"Behaviour after revocation unruled."*

**Today: none of this is built.** There is no inbound reply route at all. A club replying to a send email replies to their own mail client and reaches nobody, because a send carries our address, not the family's. Contact from a club runs solely through the invitation path (D-117).

**The question:** is "no inbound route exists" acceptable at launch, or must a routed reply path be built? *Our view: no route is the safest launch position and closes C1/C2 by construction, but it means a club with a genuine question has only the invitation path.*

---

## Part 4 — One amendment to record

### D-108 needs a carve-out for adult coaching roles

D-108 bars **application, applied, declined, rejected, unsuccessful** *"for any actor, on any surface"*, and the stated reason is the player register:

> *"A player registers interest. There is nothing to be turned down from, and that is load-bearing — it is what keeps the register out of the Online Safety Act's feedback-feature analysis."*

The build now includes a **coaching jobs board**: a club posts a role, an adult coach applies. That is the opposite situation — there genuinely *is* something to be turned down from, and calling it "registering interest" would be evasive rather than careful.

**BUZ has ruled that "apply" is correct for coaching roles, and the build uses it.** The register should be amended to say so rather than the code silently diverging from a stated rule. Applying requires an **18+ account** — a restrictive default we chose, easily relaxed.

**The question:** confirm the carve-out is limited to adult coaching roles and does not weaken D-108 anywhere near a player.

---

## Part 5 — Parked, not blocking, but coming to you

**Direct video upload.** BUZ has parked the question of families uploading phone video rather than linking YouTube or Veo. It is flagged here because it will need you before it needs engineering: **uploading changes Pitch from a service that links to video into a service that hosts video of children**, with the scanning, reporting and moderation obligations that follow. Club and coach video already ship as **links only** — the file stays on YouTube or Veo and we hold a URL — and nothing in the current build hosts video.

---

## What happens next

We stop here on the gate. The remaining unpinned cases are mostly variations on properties already tested, but several of them assert behaviour that **changes depending on your answers above** — writing them first would mean writing them twice.

Nothing is live. The site still serves the coming-soon page and the app has never been deployed.

**Fastest path:** rulings on U-1, U-2, U-5 and the M11/L29 contradiction unblock the largest number of remaining cases. U-3, U-4 and the D-108 amendment are confirmations. U-6 and U-11 can follow without holding anything up.

---

*Pitch Football · a registered business name of EBSD Enterprises Pty Ltd (ACN 701 879 718) · open decisions blocking the launch gate · doc 30 · v1.1 · 7 September 2026 · answered at doc 31*
