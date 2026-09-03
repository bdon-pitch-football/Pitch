# 27 · The club verification call — script, rules and log

> **What this is:** the one-pager BUZ works from on every club verification call, and the record each call has to produce. **Print it or keep it open. Do not do a call from memory.**
>
> **Why it exists:** D-126 makes a human phone call the only thing that lets any fact about a person under 18 reach a club. There is no automated fallback and there is no second path. That means the quality of this call *is* the safety control — and a control that is performed differently each time is not a control.
>
> Written by Leo (CTO), 27 August 2026, from D-126, D-137 and John's condition 1.

---

## The one rule that makes this a verification at all

**Ring the number you found yourself. Never the number they gave you.**

Find the club's phone number on its own website, its league or association listing, or its Football Victoria / Football NSW club record. Ring **that**. If you ring the number typed into the claim form, you have confirmed that the person who filled in the form owns the phone they wrote down, which is worth nothing at all.

Everything else on this page is good practice. This part is the control. **If you cannot find an independent number, the club is not verified today** — no exceptions, and there is a fallback at the end of this page.

---

## Before you dial — two minutes

| | |
|---|---|
| **Find the independent number** | Club site, league listing, association directory. Write down **where you found it** — it goes in the log. |
| **Read the claim** | Who claims to be claiming it, what role they say they hold, what email they used. |
| **Check what's waiting** | How many registrations are held for this club. **You do not mention this number on the call.** See the boundary below. |

---

## The call

**Opening — say who you are and why you are ringing. Do not lead with the subscription.**

> "Hi, my name's [BUZ] from Pitch — we're an Australian football platform where players keep their own CV. Someone's claimed the [Club] page on Pitch and I ring every club before we switch anything on. Have I got the right number for [Club]?"

**Then, in this order:**

**1 · Confirm the club is real and this is it.**
> "Just to check I've got the right club — you're [Club], playing in [league/association], out of [ground]?"

You are listening for an ordinary yes with detail. A person at a real club corrects you if you get the ground wrong.

**2 · Confirm the person, without naming them first.**
> "Someone's claimed your page saying they're [role] at the club. Does that sound right to you — who would that be?"

**Ask it this way round.** If you say *"is Michael Harris your technical director?"* you have handed over the answer and all they have to do is agree. Let them supply the name. **If the name they supply is not the name on the claim, stop — do not verify, and see the failure path.**

**3 · The authority question (D-137).** Word it plainly:
> "Two quick admin ones. Is the club incorporated — an incorporated association, or a company? And is [name] the person who'd be authorised to take out a subscription on the club's behalf?"

Both answers get recorded exactly as given, including "I don't know". **A no, or a don't-know, does not fail the verification** — the club can still be verified and use the free tier. It is a flag on the subscription, not on the safety check. The reason we ask is that an unincorporated association has no legal personality and cannot be bound, so a tick-box from a volunteer has a defect no wording fixes.

**4 · Say what verification actually turns on.** This is the sentence that sets expectations for everything afterwards:
> "What this does is switch on your ability to receive players registering interest with the club. Until we've done this call, nothing about any player under 18 reaches you at all — that's true whether or not anyone's paid us."

**5 · Close.**
> "That's everything. I'll switch it on today and you'll get an email confirming it. If anything changes — you leave the club, someone else takes the role — email me and I'll turn it off the same day."

---

## The boundary — what you must not do on this call

You are, for the length of this call, an unverified person's only contact with Pitch. They will sometimes ask.

- **Do not say how many registrations are waiting.** Not a number, not "a few", not "you'll be pleased". A count is a fact about children who registered with a club that is not yet allowed to know about them.
- **Do not name a player, a squad, an age group or a school.** Not even to make the product concrete.
- **Do not confirm or deny that a particular player is on Pitch**, however it is asked and however casually.
- **Do not verify on the call.** Say you will switch it on today; do it afterwards, at a keyboard, from the log. A verification made while someone is talking to you is a verification made under social pressure.
- **Do not sell.** If they ask about price, answer it plainly and move on. **A verification call that turns into a sales call is a verification call where you wanted the answer to be yes.**

---

## When it does not go cleanly

| What happened | What you do |
|---|---|
| **No independent number exists** | Not verified. Ask them to email you from an address on the club's published domain, or to have the league confirm. Log it as `unverified — no independent contact`. |
| **The name they supply doesn't match the claim** | **Stop.** Not verified, and do not explain who claimed it — you would be telling a stranger a name. Log it and raise it as a possible impersonation. |
| **Nobody answers, three attempts** | Not verified. The club keeps its page. Try the league. |
| **They've never heard of the claim** | Not verified. **Suspend the claim**, log it, and contact the claimant separately by email. |
| **They're hostile or want the page taken down** | Take it down. A club page is not worth an argument, and doc 25 is the takedown route. Log it. |
| **They say yes to everything, fast, and volunteer nothing** | Trust your ear. It is fine to say you'll ring back and to do a second call. **Nothing in this process is time-critical.** |

**Unverified is not a punishment and it is not a queue.** A claimed-but-unverified club has its page, can post trial notices, and receives CVs by email like any club. It simply receives nothing about a person under 18 (D-126), and registrations arriving for it are **held** — the club sees a count and nothing else.

---

## The log — every call produces one row

This is not a notebook. These fields are the record we would produce if a family, a regulator or a court asked how we decided a stranger could receive their child's details.

| Field | Notes |
|---|---|
| `club_id` | |
| `called_at` | Timestamp, Australia/Melbourne |
| `operator` | The human. Named, every time. Never "system", never "admin". |
| `number_called` | The actual number dialled |
| `number_source` | **Where you found it** — "club website /contact", "FV club directory". **A blank here invalidates the call.** |
| `answered_by` | Name and role as they gave it |
| `club_confirmed` | yes / no — is this the club |
| `person_confirmed` | yes / no — did they independently name the claimant |
| `incorporated` | yes / no / unknown — as answered |
| `authority_confirmed` | yes / no / unknown — as answered |
| `outcome` | `verified` · `not verified` · `suspended` · `takedown` |
| `notes` | Free text. Anything that felt off belongs here even if you verified anyway. |
| `policy_version` | The version of this page the call was run against |

**Two build rules that follow from this table, and they are in doc 14 §M:**

1. **`verified` is written only by an operator action that carries `operator`, `called_at` and `number_source`.** Not a webhook, not a payment, not a claim, not a backfill, not a migration. Doc 14 §M4 asserts no automated path exists.
2. **The flag is revocable and revocation is instant.** A TD leaving a club is the ordinary case, not the exception.

---

## Re-verification

- **On any change of the claiming person** — new TD, new admin, role handover. The new person is a new call.
- **Annually**, on the anniversary, as a batch. Community club committees turn over every season and a two-year-old verification is a statement about a person who left.
- **Immediately, on any report** under doc 25.

---

## The thing to watch for, said once

John's warning, and it is the right one: **the failure mode is not a decision to weaken this check. It is a busy week in which it quietly becomes a formality** — the number from the form because it was to hand, the authority question skipped because they sounded fine, the flag set during the call because it was easier than coming back to it.

D-139 already sets the limit: **if manual verification stops being feasible before an automated equivalent exists, new club onboarding pauses rather than the check being lowered.** Manual verification is trivial at ten clubs, awkward at fifty and impossible at two hundred. The number where it stops working is a number worth noticing before you reach it.

---

*Doc 27 · Club verification call · v1.0 · 27 Aug 2026 · Leo (CTO) from D-126, D-137, D-139 and John's condition 1 · the log fields here are the source for doc 14 §M.*
