# 35 · Brief for John — what needs your ruling before launch

> **Doc 35 · v1.0 · 28 September 2026.** Written by Leo (head of technology) for
> John (general counsel). Entity: **EBSD Enterprises Pty Ltd** (ACN 701 879 718 ·
> ABN 65 701 879 718), trading as Pitch Football.
>
> **Nothing in this document is a decision.** Each item is a question, the facts
> I can verify, and what we will do if you say nothing — so that silence has a
> known consequence rather than an assumed one. Nothing has been deployed and no
> real person's data exists in any environment.

---

## Why this exists now

A six-seat review of the product between 2026-09-24 and 2026-09-28 turned up four things that
are yours rather than engineering's. Two are live on pages a parent reads. One
of them, **item 1**, is the reason the legal build is finished and sitting
unmerged rather than shipped: the engineering is done and correct, and landing
it without your ruling would make a determination that the register says is
yours.

---

## 1 · The consent stamp now describes what is served — and what it serves has changed

**The question: is removing the drafting preamble from a published legal
document a material change, and does the version bump?**

**What was happening.** Every legal surface rendered the whole markdown file,
so each opened with our internal change log. On `/privacy` that is **1,294
words** before the policy speaks; on `/terms` 1,401; on the child policy 730. It
includes, verbatim:

> ⚠️ v2.3, 3 September 2026 — this restores work that was lost, and the loss was
> my doing.

and `NOT YET PUBLISHED`, and `Nothing here binds until BUZ numbers it in doc
06`.

**Where that lands worst.** Doc 21 is rendered *inside the guardian approval
flow* — doc 32 B3 requires it be shown, not merely linked. So the one screen the
entire consent funnel passes through opens by telling a parent, in our own
words, that the policy she is being asked to accept is not published and that we
lost some work.

**What has been built, and not merged.** The renderer strips that block and
nothing else. **`docs/legal/` is byte-for-byte untouched** — the drafting
history stays in the source, because doc 20's own preamble argues for why it is
retained. Measured across the five live documents: doc 20 −1,316 words, doc 21
−728, doc 22 −1,516, doc 24 −414, doc 25 −489.

**The thing that makes this yours.** `lib/legal-stamp.ts` binds a consent row to
a **sha256 of the document**, and its own header says why: *"the hash is what
lets a consent row resolve, years later, to the exact text that person read."*
My first instruction to the builder was to change the rendering and leave the
source — which would have made every stamp describe a document **nobody was
shown**. That is now fixed: the stamp hashes the served text. But it means the
hash changes for all three stamped documents the day this merges.

**The register's own rule, which is why I stopped:**

> whether a change is material is **John's call**, and the register records it

and `lib/consent.ts` *"is bumped in the same commit that changes what /privacy
serves — never separately, in either direction."*

**My reading, offered as a view and not acted on:** removing editorial
scaffolding that was never part of the agreement is not material — no clause
moves, no obligation changes, and serving a parent "the loss was my doing" at
the moment she decides is worse on any reading. The safety seat agrees. Neither
of us thinks we get to decide it.

**What we need from you:** material or not; and if not material, whether the
version still bumps because the served bytes changed.

**If you say nothing:** nothing merges. The preambles keep rendering, including
inside the approval flow.

---

## 2 · The Terms publish "do not publish" markers inside the clauses

**The question: can these be removed at all without a version bump, and which
way do you want it done?**

`22-Terms-of-Service.md` line 161 carries `[DO NOT PUBLISH UNTIL BUILT] 6.5`,
and the table at 354–355 the same. **These are inside the agreement, not in the
preamble** — which is why they were explicitly left alone when the preamble work
was done. Across docs 22 and 25 there are **86 marker occurrences** of this
class (`[DO NOT PUBLISH…]`, `[DRAFTED]`, `[OUTLINE]`, `[LEGAL: doc 18 Qn]`), all
served today.

The builder's analysis, which I have not been able to fault:

- **Stripping the marker publishes a promise we cannot keep** — 6.5 and 2.3
  describe capabilities that do not exist.
- **Removing the clause changes the terms.**
- Doc 22's own preamble records the rule that such a clause must not appear in a
  published version until it is built.

So either action is material, categorically unlike item 1.

**What we need from you:** which clauses come out, which stay with their
capability built, and the version this lands as.

**If you say nothing:** the Terms continue to serve bracketed drafting markers
to every reader.

---

## 3 · The register disagrees with itself about which versions are live

Facts, verifiable in the repository today:

| Where | Says |
|---|---|
| `00-Legal-Register.md` authority table | doc 20 **v2.7**, doc 21 **v2.5**, doc 22 **v1.8** |
| The same file's prose, line 69 | `20@v2.6`, `21@v2.4`, `22@v1.8` |
| `22-Terms-of-Service.md` itself | **v1.9** |

So `/terms` would show **1.8 at the top and 1.9 in its footer**, and the
identifier a consent row is stamped with depends on which half of the register
the reader believes. Separately, **docs 21, 22, 23, 24 and 25 all still carry
"not yet published" in their colophons** and are all served; removing that line
asserts publication, which is BUZ's act rather than mine — and for docs 24 and
25 the colophon is the only place the entity is named at all.

**What we need from you:** the authoritative version of each live document, and
whether the colophons go.

**If you say nothing:** the product keeps serving a version number that
contradicts itself.

---

## 4 · A personal address is the contact point on the privacy policy and the terms

`burak.donmez@pitch-football.com` renders as the contact address on `/privacy`
and `/terms`. It is a personal address on a domain that is **not**
`pitchfootball.com.au`, on the two pages whose entire job is a parent's trust,
against a brief that names the canonical domain as the only one a user ever
sees and sets `SUPPORT_EMAIL=help@pitchfootball.com.au`.

`00-Legal-Register.md` line 28 also gives the registered office as
**111/1150 Pascoe Vale Road, Coolaroo VIC 3048**, which is a tax agent's
address. That may be entirely correct for service; I am flagging it only so the
choice is deliberate.

**What we need from you:** the contact address that should appear, and whether
the registered office as published is the one you want on a public page.

**If you say nothing:** a founder's personal address stays on both.

---

## 5 · Two smaller ones, for completeness

**A rate limit that swallows a child-safety report.** `app/report/actions.ts`
applies the same silent rate limit used on sign-in, so an eleventh report from
one IP in an hour is **never written to the database** and the person is still
shown *"We've received your report."* For sign-in that silence is correct — a
limit that announces itself tells an attacker an account exists. For a report
about a child, we are not sure it is, and it is not an engineering call.

**16–17 acceptance.** The brief records this as an open legal question and the
guardian-acceptance path is built so it can extend to 16–17 if you require it.
Flagged because everything else in the consent chain has now been built around
it.

---

## What we will not do without you

Nothing on this list has been changed. The legal renderer is complete, proved,
and **sitting on an unmerged branch**. No version has been bumped, no clause
touched, no marker stripped, no address altered. Every string the product shows
a user still requires BUZ's approval before it ships, and that is unchanged by
anything here.

The one thing I would ask for first, if you only have time for one: **item 1**,
because it is the screen a parent reads at the moment she decides whether to
trust us with her child.

---

## Rulings — 2026-09-28, John, relayed by BUZ

John approved all six items. Where an item was a question with options, BUZ
gave the specific answer the same day. Recorded here before any code changes.

| # | Item | Ruling |
|---|---|---|
| 1 | Stripping the drafting preamble | **Not material. The version still bumps** — so every consent row names exactly the text that was shown — **and no guardian is re-asked**, because nothing in the agreement changed. |
| 2 | Markers inside the clauses | **Clauses describing capabilities that are not built are removed until they are built**, and each returns in a new version when it ships. The Terms never promise what the product cannot do. |
| 3 | The register contradicting itself | Reconciled as part of item 1: the bumped versions are written consistently into the table, the prose and each document. The "not yet published" colophons go, because these versions are the published ones. |
| 4 | The contact address | **Unchanged: `burak.donmez@pitch-football.com` stays** on the privacy policy and the terms. BUZ's decision. |
| 5a | A child-safety report over the rate limit | **Always saved.** Every report is written to the database and the person sees the same confirmation either way. The limit still slows abuse, but no report about a child is ever lost. |
| 5b | 16–17 acceptance | Approved as it stands: the guardian-acceptance path is already built so it can extend to 16–17. No change today. |
