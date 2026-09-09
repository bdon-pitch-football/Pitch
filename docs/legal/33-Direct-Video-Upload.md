# 33 · Direct video upload — a decision paper

> **Doc 33 · v1.0 · 9 September 2026.** Entity: **EBSD Enterprises Pty Ltd** (ACN 701 879 718 · ABN 65 701 879 718), trading as Pitch Football.
>
> **The question BUZ asked:** can families upload video directly, rather than linking YouTube or Veo?
>
> **The answer in one line: not for children yet, yes for adults sooner than you think, and the case for it is stronger than I expected.**
>
> **What this is not:** a recommendation to keep the product smaller. Link-only has a cost I had not properly counted, and it is counted below before anything else.

---

## 1 · The case for it, first, because it is real

**Link-only assumes the family already has the video hosted somewhere.** Consider who that excludes.

A father films forty seconds on his phone at a Saturday game. To get it onto his thirteen-year-old's page today he must create a YouTube account, upload, work out what *unlisted* means, and copy a link. **Four steps and an account, for one clip.**

**And here is the part that should trouble us most.** We send families to YouTube in order to avoid hosting video — **and YouTube is a service with a feed, recommendations, comments and an account.** We are routing children onto a social platform in the name of keeping them off one. Veo does not help: it is club-owned kit that most grassroots families do not have.

**So link-only quietly favours the organised, connected family.** That is the same equity failure I identified in D-22, arriving through a different door, and I would rather name it than let it hide inside a safety argument where it looks like caution.

**Nothing below outweighs that automatically.** It has to be argued.

---

## 2 · What actually changes the day we hold the file

**Two things, and both are hard law rather than best practice.**

### 2.1 Criminal Code s 474.25 — a criminal referral duty

A **hosting service provider** who becomes aware of child abuse material on its service, and does not refer it to the **Australian Federal Police** within a reasonable time, commits an offence.

**Linking is not hosting.** Today YouTube and Veo carry this. **The moment a file lands in our bucket in Sydney, the duty is ours** — the company's, and in practice BUZ's, because he is the only person who could become aware of anything.

**This is the sharpest line in the paper.** It is criminal, it attaches to the provider, and it does not care how small we are.

### 2.2 The Designated Internet Services Standard 2024

In force **22 December 2024**, compliance required from **21 June 2025**, and it **expressly covers file storage and photo-sharing services.** Providers are risk-tiered and the obligations for a service storing user material include:

- **deployed systems to detect and remove** the worst classes of material;
- published and enforced terms of use;
- complaint and reporting mechanisms;
- **notifying the Commissioner of significant changes to the service** — *turning upload on is almost certainly one.*

Penalties run to approximately **$49.5 million**.

**The tooling is not the problem.** Cloudflare offers CSAM scanning at no cost; PhotoDNA is available to qualifying organisations; Thorn's Safer is commercial. A small company can obtain detection.

**The problem is what happens after a hit.** A detection at eleven on a Saturday night needs **a human to look at it, decide, and refer it**. That is the same argument that made me withdraw the twenty-four-hour takedown promise, and nothing about it has changed: **Pitch is one person, and this is the one category where being unavailable for a weekend is not a support-ticket problem.**

---

## 3 · The things nobody lists, which are the ones that bite

**The upload field is what turns a page into a place children put things.** Every safety property this product has rests on content not accumulating here. A file input is a small change to a screen and a large change to what Pitch is.

**Most of the moderation load will not be illegal material.** It will be another child in the background of a clip, an adult who did not consent to being filmed, a fight on the sideline, a coach shouting. **None of that trips a hash match and all of it is ours once we hold the file.**

**The deletion cascade has to reach further than it does.** Doc 23 promises deletion. With upload that means the original, every transcode, every thumbnail, the CDN cache and the backup window. **A cascade that misses a thumbnail is not a cascade**, and doc 23 is the document that has to remain true.

**Cost is real and it is the one genuinely expensive thing in this product.** Storage is cheap; egress is not, and video egress scales with exactly the behaviour we want.

---

## 4 · Recommendation

### 4.1 Not for anyone under 18, and not at launch

The reasons are §2.1 and §2.2, and the reason underneath both is §2.2's last paragraph. **Adding a criminal referral duty and a detection obligation to a one-person company in the same fortnight as its first real children is not a risk profile I can support.**

### 4.2 Ship it for 18-and-over accounts first, and sooner than you would think

**Adult players and coaches only. Minors stay link-only.**

That gets the entire pipeline — storage, transcode, the deletion cascade reaching every derivative, the real cost per clip, and above all **what the moderation load actually looks like in practice** — **with none of the child-safety exposure**, and it is reversible.

**It is the same shape as everything that has worked here:** build where the stakes are lowest, learn what it costs, and decide about children with evidence rather than a guess.

*The s 474.25 duty still attaches — we would be hosting. But an adults-only surface with a handful of coaches is a duty we can actually discharge, and it is the honest way to find out whether we can discharge it at all.*

### 4.3 The conditions before it ever reaches a minor

**All five, and none of them is optional:**

1. **A detection service wired in before the first upload**, not after the first thousand.
2. **A second person who can look at a flag** — the same person section D of doc 32 has been waiting for.
3. **The PIA re-run.** The register's own trigger table says any new category of data collected re-runs it, and this is unambiguously that.
4. **Counsel.** This is the first question I would add after the fifteen already in doc 18, and I would not proceed without an answer on s 474.25 and on our tier under the DIS Standard.
5. **The deletion cascade demonstrated on a real file**, including its thumbnails and its cache, the way C1 and C2 of doc 32 demand for their controls.

---

## 5 · One thing to change either way

**Link-only is a safety feature and our documents do not say so.**

We describe it as a limitation — *we store the link, not the video* — when it is a deliberate architectural choice that keeps the worst category of content off our infrastructure entirely.

**But "we do not host video" and "we make families use YouTube" are the same sentence from two ends, and only one of them is currently in the documents.** Whichever way this decision goes, doc 20 should say both.

---

## 6 · What I need

**A D-number for 4.1 and 4.2.** Nothing here binds until BUZ calls it.

**If the answer to 4.2 is yes, it is not a launch item** — it comes after doc 32 is green, not alongside it.

---

*Pitch Football · a registered business name of EBSD Enterprises Pty Ltd (ACN 701 879 718) · direct video upload · doc 33 · v1.0 · 9 September 2026 · a recommendation, not a legal opinion · s 474.25 and the DIS Standard are questions for counsel and are marked as such*
