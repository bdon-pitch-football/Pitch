# 00 · The Legal Register — where John's documents live

> **This folder is the only home for Pitch's legal instruments.** If a copy of one of these documents exists anywhere else in the project, it is not the document — it is a draft, a working file or a superseded version, and this page says which.
>
> **Who owns what:** John (GC & Child Safety) owns the *content* of every instrument here. Leo (CTO) owns *placement* — moving a delivered document into this folder, versioning it, and updating what the build reads. **BUZ owns the decision to publish any of it.** No officer edits the built corpus directly (SO-02 §3).
>
> Maintained by Leo · current as of 27 August 2026 · register **v4.1 (D-01 – D-148)**

---

## Why this folder exists

Before today these documents lived in the project root **and** in four different `JOHN-pack-v1.x/` folders, and nothing said which copy the product would render. That is not a filing problem. **A privacy policy with two live copies is a privacy policy that cannot be relied on**, and the version a family consented to is a fact we may one day have to prove.

It has already cost us once. The root copy of doc 22 carried a founding-club clause (A5.3) describing a commercial arrangement Pitch does not offer. It sat in the live corpus for two days. **A single authoritative location is what makes that a bug rather than a habit.**

---

## The entity (D-148)

**EBSD Enterprises Pty Ltd** · **ACN 701 879 718** · **ABN 65 701 879 718** · trading as **Pitch Football** · GST-registered.

**Every instrument here names the legal entity, not the brand** — a trading name is not a legal person, and the privacy policies have to identify the actual APP entity holding the data. The ABN appears on every receipt, because a GST-registered supplier issues tax invoices. The Stripe statement descriptor is `PITCH FOOTBALL`.

---

## The instruments

| | Document | Version | Where it lives in the product | Who reads it |
|---|---|---|---|---|
| **20** | **Privacy Policy — adult** | v2.1 | `/privacy` · linked from every sign-up, accepted at adult sign-up | Adults, clubs, coaches |
| **21** | **Privacy Policy — child** | v2.0 | `/privacy/family` · **shown inside the guardian approval flow, not merely linked** | A parent, at the moment they decide |
| **22** | **Terms of Service** | v1.4 | `/terms` · **Schedule A shown at club checkout, before Stripe** (D-136) | Everyone; Schedule A by clubs |
| **24** | **Code of Conduct** | v1.1 | `/conduct` · linked from sign-up and from every club and coach surface | Adults who can write about others |
| **25** | **Complaints and Takedown** | v1.0 | `/report` · **reachable without an account, from any page** | Anyone, including a stranger |

**Not rendered — internal instruments, and they are specifications, not background:**

| | Document | Version | What it governs |
|---|---|---|---|
| **19** | **Privacy Impact Assessment** | v2.0 | The assessment behind the design. Re-run on any change to what data is collected or who can see it. |
| **23** | **Retention Statement** | v1.2 | **Every deletion job in the codebase implements a row of this table.** If a job and this document disagree, the document is right and the job is a bug. |
| **26** | **Access Model** | v1.1 | Who can see what, in prose. Doc 14 is the enforceable version; this is the one a human can check it against. |
| **18** | **Solicitor Brief (D-27)** | v1.2 | Fifteen questions for external Australian counsel. Not our answers — our questions. |

---

## Version stamping — the build rule

Consent is recorded against a **policy version**, and this is what makes "we did what we promised" provable rather than asserted.

**The identifier is `doc@version`** — `20@v2.1`, `21@v2.0`, `22@v1.4`. It is stored on the consent row, never a timestamp alone and never a URL.

**Three rules that follow, and all three are cheap now and expensive later:**

1. **A published version is immutable.** Once any consent has been stamped against `21@v2.0`, that text never changes. A correction — even a typo — becomes `21@v2.1`. The product must be able to render **the exact text a given parent agreed to**, years later, or the consent log records a version we can no longer produce.
2. **Every published version is retained forever**, including superseded ones. They are small. `_superseded/` holds them and nothing is ever deleted from it.
3. **A material change re-asks.** A new version of doc 21 that changes what a family is agreeing to routes back to the guardian — it does not silently apply. Whether a change is material is **John's call, not the build's**, and the register records it.

---

## What triggers a review

| Trigger | Documents | Why |
|---|---|---|
| **Any new category of data collected** | 19, 20, 21, 23 | The PIA is an assessment of a specific design; a new field makes it an assessment of a different one. |
| **Any change to who can see what** | 19, 21, 26, and doc 14 | This is the one that matters. A permission change without a policy change means the policy is now wrong. |
| **Any new money surface or price** | 20, 22 (Schedule A) | D-136 makes the disclosure ours. |
| **Any new sub-processor** | 20, 21 | Stripe is named; the next one must be too. |
| **A new decision in doc 06 touching disclosure, retention or consent** | Case by case | Leo flags; John rules. |
| **Annually, regardless** | All | Because nothing on this list fires when a law changes underneath us. |

---

## What is deliberately *not* in this folder

- **`13-Board-Room/JOHN-pack-v1.x/`** — John's delivery folders. They are **how documents arrive**, not where they live. Once placed, the pack copy is history. Four packs exist and all four contain versions that are now superseded.
- **John's memos, briefs and responses** — `LEO-to-JOHN-*`, `JOHN-to-LEO-*`, the UCT review. **Those are arguments, not instruments.** They stay in the Board Room, and doc 17 tells the build team not to read that folder as specification for exactly this reason.
- **`_superseded/`** — every previous version, kept forever per rule 2 above. It is inside this folder because the retention rule requires it, but nothing in it is live.

---

## Outstanding

**Nothing.** As of 27 August, John's items are closed:

- **Round 2** — his three conditions became D-126, D-127 and D-128; the two Stripe blockers became D-136 and D-137; the suspension requirement became D-135.
- **Round 3** — the coach reference is cut (D-133) and he confirmed there was no drafting to unwind, but kept **rule 7 in doc 24** anyway: *a club states facts about a coach; it does not publish an opinion about one.* Worth keeping even though the surface is gone, because the code of conduct is where an adult reads what they may write, and "there is nowhere to write one" is better on the record than silence.
- **The founding-club correction** — A5.3 rewritten in doc 22, the family-facing version added to doc 20, and D-134's prospective rule parked at A5.4 where it binds the first thing that ever does have a free period. **No figures in either document.**

**The one thing to watch, in John's own framing:** he can catch a document that contradicts the register. He cannot catch a brief describing a decision that was never made. Both sides now hold an end of that — Leo does not state something commercial as settled unless it is in doc 06 with a D-number, and **John asks rather than drafts when a brief asserts something commercial he cannot find there.**

---

*Legal Register · v1.0 · 27 August 2026 · Leo (CTO), placement only · content owned by John (GC & Child Safety) · publication is BUZ's call*
