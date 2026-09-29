# 37 · John: what we need from you before launch on 1 October

> **Doc 37 · v1.0.** From Leo (head of technology), at BUZ's request. It
> replaces reading docs 35 and 36 end to end: this is the short list.
> **Reply by 5pm on 30 September.** Each item carries a recommendation, so you
> can answer "agree" or change it. Each item also says what happens if we hear
> nothing, so silence has a known result.

## What changed since your last rulings (for information, nothing to decide)

- **D-163: Pitch is free for everyone until further notice,** the Interest
  Register included. No card is taken anywhere, and billing is switched off
  in code.
- **D-168: under-18s register from launch day.** The parent's email goes at
  once; the text is queued until our SMS number clears Twilio's review, then
  sends automatically. Approval still needs both channels (D-24, D-156),
  unchanged.
- **D-167: one parent per child at launch.** There is no second-guardian
  invitation yet, so doc 15 §4 is held.
- **D-169: replies to Pitch's emails reach BUZ directly.** This overrides the
  half of your U-11 about a support inbox. **Your child-safety half stands:**
  the CV email to a club still carries no reply address.
- **The website now serves the same legal text as the app,** with the drafting
  preamble stripped under your item-1 ruling (doc 20 v2.8, doc 22 v2.0).
- **One-tap deletion now works for every child** (D-26). It was blocked
  whenever someone at Pitch had looked at the record. See decision 5.

## The decisions: all of them are about the Terms page a parent reads

**Why this is urgent.** `/terms` is live, and today it shows Schedule A's old
price ($54/$329) and 75 `[DRAFTED]` labels, plus `[OUTLINE]` and
`[LEGAL: doc 18 …]` markers. We would like to ship one clean Terms release,
doc 22 **v2.1**, on launch day.

| # | Question | Our recommendation | If you say nothing |
|---|---|---|---|
| **1** | **Schedule A while Pitch is free.** It is written as a paid contract: A3 fees, A4 renewal, A5.1 cooling-off, A6/A6.1 prices, A6.2 tax invoices, 8.6 paid subscriptions. | **Remove the money clauses** (A3, A4, A5.1, A6, A6.1, A6.2, and 8.6's paid-subscription parts) until a price exists. **Keep the club's obligations:** A1.1 authority, A8(e) use only for the club's own trials, A8.3 no contacting a player directly, A10 the family never pays, A11 no export of the register. Returns in a new version, with club re-acceptance, when BUZ prices anything. | Schedule A keeps showing a price nobody can pay. |
| **2** | **The 75 `[DRAFTED]` labels.** Each is a label on finished clause text. | **Strip at render**, like the preamble you cleared. The version bumps; no re-acceptance. | **We strip them on 1 Oct as the fallback.** This is the same class as your item-1 ruling (editorial scaffolding). Tell us if you disagree. |
| **3** | **`[DO NOT PUBLISH UNTIL BUILT]` §6.5 Suppression.** It is built (the operator can suppress one parent's access), but your "someone has operated it once" box is unticked. | **Publish it:** Leo operates it once on the preview deploy on 30 Sep and sends you the log line. | §6.5 is removed until you tick it. |
| **4** | **Five `[OUTLINE]` clauses** with no drafted text: 3.3 (16–17 acceptance), 6.4 (what "verified" asserts), A12 (data handling), the Part 8 consequences/appeal paragraph, and one in the table. | **Remove all five until they are drafted.** Your ruling: the Terms never promise what isn't written. 16–17 co-acceptance is built and stays in the product regardless. | Removed. |
| **5** | **The investigation trail after a child is deleted.** We built this: the record of who looked, when and for which report survives with no link to the child, and the free-text notes are wiped (D-166). | **Keep it as built.** It answers "who accessed what" after an incident without identifying the child. | Stays as built. |
| **6** | **Sixteen `[LEGAL: doc 18 Qn]` counsel questions** in doc 22 (13), doc 25 (2) and doc 23 (1). Examples: the $2,000 liability floor (Q11), the five-year report-record period (Q6), the statutory removal window (Q6), the WWCC wording (Q4), 16–17 acceptance (Q7). | **For launch:** keep each clause as written but **remove the bracketed question from the page.** The page stops showing drafting notes, and the question stays open with you in doc 18. **Or name any clause you want held back.** The ones we would hold if you prefer caution: the $2,000 floor (Q11) and the five-year period (Q6), because publishing them commits us to them. | We hold back the $2,000 floor and the five-year period, keep the rest, and remove the brackets. |
| **7** | **D-169, replies to a named person.** | Tell us if the privacy policy or the retention statement needs a line, now that account emails can be answered into BUZ's own inbox. | No change. |

## What happens after you reply

Leo builds doc 22 v2.1 from your answers on 30 September:
- it renders on both the app and the website;
- its version and consent stamp are bumped;
- no guardian is re-asked, per your item-1 ruling, unless you say an item
  is material.

It ships with the launch on 1 October.

*Pitch Football · a registered business name of EBSD Enterprises Pty Ltd (ACN 701 879 718) · doc 37 · for John*
