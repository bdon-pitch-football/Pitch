# 00 · The Legal Register — where Pitch's legal instruments live

> **This folder is the only home for Pitch's legal instruments.** If a copy of one of these documents exists anywhere else in the project, it is not the document — it is a draft, a working file or a superseded version, and this page says which.
>
> **Who owns what:** John (GC & Child Safety) owns the *content* of every instrument here. Leo (CTO) owns *placement*. **BUZ owns the decision to publish any of it.** No officer edits the built corpus directly (SO-02 §3).
>
> **Current as of 15 September 2026 · register v4.x (D-01 – D-152) · `JOHN-pack-v2.1` placed in full.**

---

## Why this folder exists, and the two times it has been tested

**A privacy policy with two live copies is a privacy policy that cannot be relied on**, and the version a family consented to is a fact we may one day have to prove.

**It has been tested twice, and both were real.**

**1 September — a fictional clause.** The root copy of doc 22 carried A5.3 describing a founding-club mechanism that did not exist. It sat in the live corpus for two days.

**7 September — a version collision.** Two different documents were both stamped **doc 23 v1.4**: one from John on 3 September, one from the build on 7 September applying a ruling straight to the live file. Neither knew about the other, because a finished pack was sitting unplaced while the same work was applied here. **The live file also disagreed with itself — header v1.4, footer v1.3, body stamp `[1.0]`.** Resolved at v1.5, rebuilt from the live file so nothing was lost.

**The rule that follows from the second one:** rulings are applied to the placed corpus, or delivered into it — **never both at once.** A delivery folder and a live folder being improved in parallel is how two v1.4s happen.

---

## The entity (D-148, D-149)

**EBSD Enterprises Pty Ltd** · **ACN 701 879 718** · **ABN 65 701 879 718** · trading as **Pitch Football** · GST-registered.
Registered office **111/1150 Pascoe Vale Road, Coolaroo VIC 3048**. Contact **burak.donmez@pitch-football.com**.

**Every instrument here names the legal entity, not the brand** — a trading name is not a legal person. **On screen it says Pitch; on anything about money it says Pitch Football; in these documents it says EBSD Enterprises Pty Ltd** (D-149). The Stripe statement descriptor is `PITCH FOOTBALL`, and a tax invoice that differs from the bank statement is one a treasurer cannot reconcile.

**The business name expires 1 September 2027** and ASIC's contact for it is the accountant's, so renewal notices do not reach BUZ. **A lapsed business name while trading is the same offence as never registering one.**

---

## The instruments

**Rendered in the product:**

| | Document | Version | Where | Who reads it |
|---|---|---|---|---|
| **20** | **Privacy Policy — adult** | **v2.7** | `/privacy` · **live** | Adults, clubs, coaches |
| **21** | **Privacy Policy — child** | **v2.5** | `/privacy/family` · **shown inside the guardian approval flow, not merely linked** | A child, and a parent at the moment they decide |
| **22** | **Terms of Service** | **v2.0** | `/terms` · **live** · Schedule A at club checkout, before Stripe (D-136) | Everyone; Schedule A by clubs |
| **24** | **Code of Conduct** | **v1.3** | `/conduct` | Adults who can write about others |
| **25** | **Complaints and Takedown** | **v1.3** | `/report` · **reachable without an account, from any page** | Anyone, including a stranger |

**Internal — specifications, not background:**

| | Document | Version | What it governs |
|---|---|---|---|
| **18** | **Solicitor Brief (D-27)** | **v1.4** | Fifteen questions for external counsel. Undated, so it does not go stale on the shelf. **Not our answers — our questions.** |
| **19** | **Privacy Impact Assessment** | **v2.4** | The assessment behind the design. **Four launch-blocking recommendations: 1, 2, 3 and 12.** Re-run on any change to what is collected or who can see it. |
| **23** | **Retention Statement** | **v1.5** | **Every deletion job implements a row of this table.** If a job and this document disagree, the document is right and the job is a bug. |
| **26** | **Access Model** | **v1.6** | Who can see what, in prose. Doc 14 is the enforceable version; this is the one a human can check it against. |
| **28** | **Founder IP Assignment Deed** | **v1.2** | **NOT EXECUTED.** Assigns everything made before incorporation to the company. Two blanks, both BUZ's at signing. |
| **30** | **Open decisions blocking the gate** | **v1.1** | The eleven questions doc 14 declined to answer. Answered at doc 31. |
| **31** | **Rulings on doc 30** | **v1.1** | A ruling on each. **Three went against the built default.** Nothing binds until BUZ numbers it in doc 06. |
| **32** | **The legal launch gate** | **v1.4** | **The other half of the gate.** D-47 makes doc 14 the launch blocker; the PIA calls four other things launch-blocking; **doc 14 tests three of the four nowhere at all.** Sections A, B and C block. Section D is named as not blocking so it cannot creep in on the morning. |
| **33** | **Direct video upload** | **v1.0** | Not for minors yet; **18-and-over first**. Criminal Code s 474.25 makes a referral duty ours the moment we hold a file, and the DIS Standard 2024 expects deployed detection. **The case for upload is stronger than expected and is stated first.** |
| **34** | **Register access — named persons** | **v1.0** | **Doc 14 N6 says "club reads a live registration" and there is no such actor.** `club_admin` is barred by D-93 and a verified coach is defined as assigned to a squad the player is not in. Eight rules, the core one being that **a read is attributed to a named person, logged, and disclosable to the guardian.** Recommendations; not yet called. |

---

## Version stamping — the build rule

Consent is recorded against a **policy version**, and this is what makes "we did what we promised" provable rather than asserted.

**The identifier is `doc@version`** — currently `20@v2.6`, `21@v2.4`, `22@v1.8`. It is stored on the consent row, never a timestamp alone and never a URL. **`repo/lib/consent.ts` holds it, and it is bumped in the same commit that changes what `/privacy` serves — never separately, in either direction.**

**Three rules, all cheap now and expensive later:**

1. **A published version is immutable.** Once any consent is stamped against it, that text never changes. A correction — even a typo — is a new version.
2. **Every published version is retained forever.** `_superseded/` holds them and nothing is ever deleted from it. **Rows stamped `20@v2.4` and `20@v2.5` resolve to text kept there and in git.**
3. **A material change re-asks.** Whether a change is material is **John's call**, and the register records it.

**The materiality ruling on the record (John, 7 September):** doc 20 v2.5 and v2.6 are **not material for re-asking purposes.** The only consents against `20@v2.4` are waitlist registrations — an adult giving an email address. Nothing in those versions changes what those people agreed to, because none of it existed for them to agree to. **The first guardian approval is where materiality starts to bite.**

**Still recommended and not yet built:** store a **SHA-256 of the rendered document, or the commit it was served from, on the consent row** beside the version. A version string is an assertion until it is bound to content — and **it cannot be added retrospectively to rows that already exist.**

---

## What triggers a review

| Trigger | Documents | Why |
|---|---|---|
| **Any new category of data collected** | 19, 20, 21, 23 | The PIA assesses a specific design; a new field makes it an assessment of a different one. |
| **Any change to who can see what** | 19, 21, 26, and doc 14 | **The one that matters.** A permission change without a policy change means the policy is now wrong. |
| **Any new money surface or price** | 20, 22 (Schedule A) | D-136 makes the disclosure ours. |
| **Any new sub-processor** | 20, 21 | Stripe, Resend, Twilio, Vercel and Supabase are named. The next one must be too. |
| **A new decision in doc 06 touching disclosure, retention or consent** | Case by case | Leo flags; John rules. |
| **Annually, regardless** | All | Because nothing on this list fires when a law changes underneath us. |

---

## What is deliberately *not* in this folder

- **`13-Board-Room/JOHN-pack-v*/`** — delivery folders. They are **how documents arrive**, not where they live. **`v2.1` is the last one and it is placed; everything before it is history.**
- **Memos, briefs and responses** — arguments, not instruments. Docs 30 and 31 are the exception, kept here because they are the record of eleven questions that shaped the build.
- **`_superseded/`** — every previous version, kept forever per rule 2.

---

## Outstanding

**With BUZ:**

- **Number the doc 31 rulings in doc 06.** Three change what is built: U-2 (either guardian may send, with a 24-hour undo), U-4 (a separate abuse counter), U-5 (a child sees the club, not the address). One changes a mechanism: a **child-safety reason class** on club de-verification.
- **Sign doc 28.** Schedule 2 is answered — nobody else contributed. Two blanks left: the date, and the Assignor's residential address, which goes on the paper at signing.
- **The Founding XI reconciliation.** The live site publishes four founding terms while doc 22 A5.3 says founding arrangements carry no published terms. A draft amendment is in John's site review. **"A cap of eleven" is a representation under ACL s 18, not a guideline.**
- **The site names no legal person**, and the waitlist form takes a child's email with only a small note in one seat. **Both close in one constant — `CONSENT_TEXT`.**
- **A named second responder.** Docs 22, 24 and 25 all publish a five-business-day appeal resting on one person. Honest today only because all three say so.
- **Diary 1 September 2027** — business-name renewal.

**Recorded once and not raised again:** the D-27 formal-opinion gate is unmet and BUZ directed on 27 August that documents proceed without one; the two-domain arrangement is BUZ's accepted call.

---

*Legal Register · v2.1 · 9 September 2026 · Leo (CTO) owns placement · content owned by John (GC & Child Safety) · publication is BUZ's call*
