# 15 · Transactional Message Copy

> **What this file is:** every message Pitch sends at launch, written out. Email and SMS, plus — new in v1.1 — the small number of **in-app messages a club composes and a family reads** (§§25–27), which live in this file because D-117 says they live nowhere else. No notification centre, no push, no marketing sends (D-65).
>
> **Why it exists:** the guardian approval SMS is the first thing a parent ever sees from us. It arrives on a phone, from a number they do not recognise, about their child. If that message is wrong, nothing downstream matters — and it was not written down anywhere. Written by Leo, 25 Aug 2026.

---

## Rules that govern every message here

1. **Australian English.** Plain language, parent-readable. No product vocabulary a parent has to learn.
2. **Identified sender, working unsubscribe** on anything not strictly transactional (Spam Act, D-64).
3. **No engagement bait to a minor, ever** — no streaks, no "you haven't logged in", no "3 people viewed your CV". Functional only (D-65).
4. **Anything safety-relevant goes to guardian and child together** (D-19).
5. **Never a link shortener in an SMS** — shortened links are a spam-filter signal. Always `pitchfootball.com.au` (D-81).
6. **Every SMS carries a support address**, because someone whose SMS did not arrive cannot use an in-app help link (D-79).
7. **No message ever contains a WWCC number, a token, or a child's surname alongside their club.**
8. **Banned words apply here too** (D-85).
9. **Sender identity:** email from `Pitch <hello@pitchfootball.com.au>` on the transactional subdomain; marketing sends on a separate subdomain and stream entirely (D-81).
10. **A club's approach to a family is a bare wake, never content** (D-117). The email or SMS says something is waiting; the substance is behind sign-in. See §24 — it is the shortest message here and the most load-bearing.
11. **Silence is a supported outcome everywhere** (D-138). Where a message asks for a decision, doing nothing must be a complete answer, it must cost nothing, and it must produce no state anyone else can see. No message in this file chases.

---

## 1 · Guardian approval request — SMS

**The most important 300 characters in the product.** It arrives cold. The parent's first three questions, in order, are: *is this real, is this about my kid, what is being asked of me.* Answer them in that order.

> **Pitch: Deniz (14) has started a football profile and needs your OK before anything goes live.**
> **Nothing is visible to anyone until you approve it.**
> **Approve or decline: pitchfootball.com.au/a/XXXX**
> **Not expecting this? Ignore it and nothing happens. Questions: help@pitchfootball.com.au**

**Why it is built this way.** The child's first name and age come first, because that is what makes it real rather than phishing. "Nothing is visible until you approve" is second, because it is the sentence that lowers the heart rate. The action is third. And **"ignore it and nothing happens"** is fourth on purpose — it tells a parent who did not expect this that inaction is safe, which is both true (the invitation purges after 14 days, D-17) and the single best anti-panic line we have.

**Never:** the child's surname, the club name, or any suggestion of urgency.

---

## 2 · Guardian approval request — email

**Subject:** `Deniz has started a football profile — your approval is needed`

**Preheader:** `Nothing goes live until you say so.`

> Hi,
>
> Deniz (14) has started building a football profile on Pitch — a place to keep a record of their football: club, position, season stats, and links to their highlight clips.
>
> **Nothing is visible to anyone until you approve it.** Not to clubs, not to coaches, not to anyone with a link.
>
> **[Review and approve]**
>
> **What you are agreeing to, in plain words:**
>
> - **Deniz will not appear in any search.** Under-16 profiles are not searchable on Pitch at all.
> - **No one can contact Deniz directly.** Any approach from outside their club comes to you and Deniz together, and it is logged.
> - **You hold the share link.** It works only where you send it, it expires every 90 days unless you renew it, and you can pause or replace it at any time.
> - **You see everything Deniz sees.** Linked account, full visibility, and you can withdraw all of this whenever you want.
>
> Approving also accepts our Terms and Privacy Policy on Deniz's behalf. Both are written to be read, not skimmed.
>
> If you were not expecting this, you can ignore this email — the request disappears by itself after 14 days and nothing is kept.
>
> — Pitch
> pitchfootball.com.au · help@pitchfootball.com.au

**Note for the build:** these four bullets are the same four promises as the ParentApproval screen, in the same order and near-identical words. That repetition is deliberate — a parent who reads the email and then sees the screen should recognise it.

---

## 3 · Day-10 pending-invite nudge — SMS

Sent once. Never twice.

> **Pitch: Deniz's football profile is still waiting on your OK. It'll be deleted in 4 days if you don't approve it — nothing will be kept.**
> **pitchfootball.com.au/a/XXXX · help@pitchfootball.com.au**

**Why the deletion is the headline rather than a warning.** We are not chasing the parent; we are telling them the default is deletion. That is honest, it is the actual behaviour (D-17), and it removes any sense that ignoring us is a fight.

---

## 4 · Second-guardian notification

Sent to guardian 2 whenever guardian 1 acts (D-51).

**Subject:** `Sam approved Deniz's Pitch profile`

> Sam approved Deniz's football profile on Pitch today.
>
> You have the same access and the same controls: you can see everything, change the sharing settings, or withdraw approval entirely. Where the two of you set different limits, **Pitch always applies the stricter one.**
>
> **[Open Deniz's profile]**
>
> — Pitch

---

## 5 · Share-link renewal reminder

Sent to the guardian at day 83 of 90. Once.

**Subject:** `Deniz's CV link expires in a week`

> The link you shared for Deniz's football CV expires on **[date]**. After that, anyone who opens it sees a page telling them the profile is managed by the family — nothing else, no details.
>
> **[Renew for another 90 days]** · **[Let it expire]**
>
> Letting it expire is a perfectly good choice. You can always make a new link later.
>
> — Pitch

**Note:** "Let it expire" is a real button, weighted equally. An expiry we quietly discourage is not the promise we made in D-53.

---

## 6 · Access request — to the guardian (D-77)

Triggered when someone with a dead link asks for access.

**Subject:** `Someone asked to see Deniz's football CV`

> **[Name they typed]** — **[role and club they typed]** — followed a link to Deniz's CV that is no longer active, and asked to see it.
>
> **We have not given them anything.** They cannot see Deniz's name, club, photo or age, and they will not know whether you read this.
>
> **[Share a new link]** · **[Ignore]**
>
> **This is unverified.** They typed their own name and role — we have not checked either. If you do not recognise them, ignoring this is the right call, and we will not ask again on their behalf.
>
> — Pitch

**Two things the build must not do here:** never send a second request from the same person on the same link inside 24 hours, and never tell the requester whether the guardian opened, read or ignored it.

---

## 7 · Report and takedown — confirmation to the reporter

**Subject:** `We've received your report`

> Thanks — we have your report about **[page]** and a person will look at it.
>
> We aim to respond within one business day. If it concerns a child's immediate safety, contact your local police first; we are not an emergency service.
>
> — Pitch · help@pitchfootball.com.au

---

## 8 · Report and takedown — to the affected family

**Subject:** `Something about your child on Pitch needs your attention`

> Someone has reported content on Pitch that involves **[child's first name]**.
>
> While we look at it, **the content is not visible to anyone.**
>
> A person from Pitch will contact you within one business day. If you would like it removed permanently, reply to this email and we will do it — you do not need to give a reason.
>
> — Pitch

---

## 9 · Waitlist confirmation

The highest open-rate message we will ever send. Sent once, on signup.

**Subject:** `You're on the list`

> Thanks for joining. We're building Pitch for football's people — a living record of the game, from first touch to first team.
>
> **We'll email you once, when we go live.** That's it. No newsletter, no drip campaign.
>
> One thing that would help, if you have twenty seconds: **which club are you at?** Just hit reply. It tells us where to start.
>
> — Pitch
> pitchfootball.com.au
>
> *You're receiving this because you joined the Pitch waitlist. [Unsubscribe]*

**Note:** the club question is in the confirmation email rather than on the form, because the form's job is to convert and this email's job is already done. Replies land in Elly's inbox.

---

## 10 · Password reset

**Subject:** `Reset your Pitch password`

> Someone asked to reset the password for this account. If it was you:
>
> **[Set a new password]**
>
> This link works once and expires in an hour. If it wasn't you, ignore this — nothing changes.
>
> — Pitch

---

## 11 · Squad invite to an under-16

Routes to the guardian, never the child alone (D-19).

**Subject:** `Riverside FC would like to add Deniz to a squad`

> **Riverside FC** has invited Deniz to join **U15s, Season 2027** on Pitch.
>
> If you approve, the club's verified coaches for that squad can see Deniz's development record and write to it. Coaches at other clubs cannot.
>
> **[Approve]** · **[Decline]**
>
> You can withdraw this at any time, and Deniz's record stays yours either way — it travels with Deniz, not with the club.
>
> — Pitch

---

## 12 · Verification approved — to a coach

**Subject:** `You're verified on Pitch`

> Your Working With Children Check and club affiliation have been confirmed. You can now be assigned to squads and write development records for your players.
>
> Verification is free and stays free.
>
> — Pitch

**Note:** that last line is in the message because D-82 makes it a rule, and rules that only live in a register get eroded. A coach who reads it once will notice if it ever changes.

---

---

## 13 · Thirty days before a sixteenth birthday — to the guardian

**This message is load-bearing in a way none of the others are.** Doc 14 §B11 gates the 16-year-old discoverability transition on this notice having *delivered* — no delivery receipt, no discovery. Without it in this file, and under the rule that a message not in doc 15 does not send, **D-22 is unbuildable and the 16–17 band can never switch on.** It is not optional copy.

**Subject:** `Deniz turns 16 next month — one thing changes, and you choose`

> In thirty days Deniz turns sixteen, and one thing on Pitch changes.
>
> **Verified clubs and coaches will be able to find him in a search.** Not the public. Not anyone without a verified club behind them. And nothing else changes: nobody can message him directly, any approach still comes to you and Deniz together, and you still see everything he sees.
>
> **[Leave it on]** · **[Turn it off]**
>
> The switch is yours, it stays yours, and you can change it any time — before his birthday or years afterwards. If you do nothing, it turns on when he turns sixteen.
>
> — Pitch

**Build note:** the "do nothing" default is ON, per D-22 — but the transition only fires if this message was *delivered* (D-78 receipt). If it bounced, discovery stays off and the account is flagged for a human. A guardian who was never successfully told has not chosen anything.

---

## 14 · The verification code — SMS

> **Pitch: your code is 4-8-2-9-1-6. It expires in 10 minutes.**
> **We'll never ring you for this code. help@pitchfootball.com.au**

Six digits, spaced so it is readable on a lock screen. The never-ring line is there because it is the single most effective anti-social-engineering sentence available in an OTP, and it costs nothing.

---

## 15 · STOP and HELP replies — SMS

**On STOP:**
> **Pitch: you're unsubscribed and we won't text this number again. If you were mid-way through approving a child's profile, that will now stop too — reply START or email help@pitchfootball.com.au if that wasn't what you meant.**

**On HELP:**
> **Pitch — a football development platform. You're getting this because someone asked you to approve a child's profile, or you asked us for a code. Reply STOP to opt out. help@pitchfootball.com.au · pitchfootball.com.au**

Required under Australian messaging rules (D-81). The STOP reply names the consequence, because a guardian who opts out mid-approval has silently broken their own child's signup and nobody would otherwise tell them.

---

## 16 · Deletion confirmation — to the guardian and the child together

**Subject:** `Deniz's Pitch record has been deleted`

> It's done. Deniz's profile, stats, highlight links and development record are gone, and any link anyone was holding has stopped working.
>
> **Two things remain, and we want to be straight about both.** A record that a consent was given and later withdrawn, with the dates — that is the only proof we did what we promised, and we cannot prove we deleted something by deleting the proof. And any coach who wrote an assessment keeps an anonymous count of how many they wrote, with nothing about Deniz in it.
>
> Nothing else. No copy, no archive, no "in case you come back".
>
> — Pitch

---

## 17 · A signup we've put on hold — to the person signing up

For the D-96 age-contradiction hold. **The one message in this file whose job is to be non-accusatory** — most of these are a typo, and the rest are a child we would rather not accuse of lying.

**Subject:** `We need a moment on your Pitch signup`

> Thanks for signing up. Something on your form doesn't add up — the date of birth and the team don't match — so a person is taking a look before we go further. That usually takes a few hours.
>
> If you made a typo, reply to this email and tell us what it should say.
>
> **If you're under 18: that's completely fine, and Pitch is built for you.** You'll just need a parent to approve your profile first. Reply and we'll send you the right link.
>
> — Pitch

---

## 18 · A report we've finished with — to the person who reported

**Subject:** `We've finished looking at your report`

> Thanks for telling us. We've looked at it and taken action.
>
> We can't tell you what we did — that would identify other people — but the report was read by a person and it was not ignored. If you see the same thing again, report it again; a second report about the same thing tells us something the first one didn't.
>
> — Pitch · help@pitchfootball.com.au

---

## 19 · A CV sent to a club — to the club

The first thing most Australian clubs will ever see from Pitch, arriving in a general club inbox next to registration queries and canteen rosters. Three jobs: say who sent it, say what it is, be openable in one tap on a phone in a car park.

**Subject:** `Deniz (14) has sent you their football CV`

> Deniz's family has sent you Deniz's football CV.
>
> **[Open Deniz's CV]**
>
> Deniz plays attacking midfield and left wing, currently at Riverside FC U15s.
>
> This is a link, not a file. The family controls it — they can pause or replace it at any time, and it expires on its own. If it stops working, that is normal and it is their choice, not a fault.
>
> **If you'd like to reply**, just reply to this email. It goes to Deniz and their parent together, and a record is kept — that is how contact with an under-16 works on Pitch, without exception.
>
> — Pitch
> pitchfootball.com.au · help@pitchfootball.com.au
>
> *You received this because a family sent you their child's CV. We did not add you to a list and there is nothing to unsubscribe from.*

**Why the last line is there.** A club that thinks it has been added to a marketing list marks this as spam, and one club marking us as spam costs us the next hundred. It is also simply true — there is no list, because D-99 forbids one (doc 14 §J38).

**Why the reply route is spelled out.** A coach who wants to talk to a family will find a way; the only question is whether it goes through the logged, guardian-included route or around it. Naming it makes the safe path the obvious path (C3, D-19).

**Never in this email:** the child's surname beside the club name, an attachment of any kind (D-99), a photograph, a date of birth, or the word "trial".

---

## 20 · A send waiting on you — to the guardian of an under-16

The D-91 pattern in message form: **the child asked, the parent sends.** Not an alarm, and it must not read like one.

**Subject:** `Deniz would like to send their CV to Northern United SC`

> Deniz has asked to send their football CV to **Northern United SC**.
>
> **It goes to:** `football@northernunitedsc.com.au`
>
> Nothing has been sent. It only goes if you send it.
>
> **[Check the address and send]** · **[Not this one]**
>
> What the club gets is a link to Deniz's CV — not a file, and not a copy. You can pause or replace that link later, and the club's access stops when you do.
>
> If you'd rather not, do nothing. The request disappears by itself and Deniz can ask again another time.
>
> — Pitch
> pitchfootball.com.au · help@pitchfootball.com.au

**Why the address is printed in full, in monospace, above the fold.** D-99 requires it displayed and confirmed before every send, and this is where a wrong address actually gets caught — a fourteen-year-old typing a club email from memory is the realistic failure, not a malicious one. A parent scanning a domain spots it in a second. Rendering it small, or behind a "details" toggle, defeats the control.

**No SMS version, and it is a choice worth defending.** An SMS says *urgent*. A send is never urgent — D-99 assumes a parent may take days or never act, and doc 14 §L15 makes doing nothing a supported outcome. An SMS manufactures pressure around a decision deliberately designed to be pressure-free. *(Leo's call in the draft — see U-9.)*

**Never:** "Deniz is waiting", a countdown, a second send, or the club's crest.

**Build note — the confirm step.** The guardian who taps **[Check the address and send]** lands on a screen showing the address once more and one line above the button:

> **This sends Deniz's CV link to `football@northernunitedsc.com.au`.**
> **[Send it]**

One address, one button, no "remember this club", no second recipient field — doc 14 §J32.

---

## 21 · Your CV has gone — to the player

A receipt, not a celebration. It confirms a thing the player asked for, which is the one exception to *"no message to a child about anything a guardian did"* at the foot of this file.

**Subject:** `Your CV has been sent to Northern United SC`

> Your CV has gone to **Northern United SC**. That is everything on your side — there is nothing else you need to do.
>
> Clubs answer when they answer, and plenty never answer at all. That is normal and it is not about your page.
>
> If anyone from the club writes back, it comes to you and your parent together.
>
> — Pitch

**Why the second paragraph is in the message.** It is the only line here that is for the child rather than about the process. A fourteen-year-old who sends a CV and hears nothing for three weeks will conclude something about themselves. Saying it plainly, before the silence starts, costs one sentence.

**Routing by band.** Under 16: to the child and guardian together (D-19) — the guardian is the sender and this is their receipt too. 16–17: to the player; the guardian gets §22. 18+: to the player alone.

**Never:** "great news", "good luck", an exclamation mark, a suggestion to send to more clubs, or anything about whether the link has been opened (doc 14 §J41).

---

## 22 · Your child sent their CV — to the guardian of a 16–17

Sent on **every** send, never as a digest (D-99, D-22). Nate is seventeen and sends for himself; this message exists so his parent is never surprised, and so the off-switch is a real control rather than a setting nobody remembers.

**Subject:** `Nate sent his CV to Kingsway Rovers FC`

> Nate sent his football CV to **Kingsway Rovers FC** today, at `admin@kingswayroversfc.com.au`.
>
> He does not need your approval for this — at sixteen and seventeen, sending is his to do. You are told every time, and the switch is yours if you ever want it off.
>
> **[See what he sent]** · **[Turn sending off]**
>
> Turning it off is not a punishment and he will not be told it was you — he will simply see that sending is off on his account, and the two of you can sort it out between you.
>
> — Pitch

**Why that last paragraph exists.** The off-switch is worthless if using it starts a fight, so the message tells the parent in advance what the child will and will not see. It also states what the product does: doc 14 §L6 tells the player sending is off, and nothing more.

**Second guardian:** where `guardian_count = 2`, both receive this identically (D-51, F5).

---

## 23 · A link you sent is about to expire — to the guardian

An amendment in spirit to §5, and a separate message because the fact that **clubs are holding this link** changes what the parent needs to decide.

**Subject:** `Deniz's CV link expires in a week`

> The link for Deniz's CV expires on **[date]**. **[n]** club[s] have been sent it: **[club names]**.
>
> After **[date]** they will see a page saying the profile is managed by the family — no name, no club, no details.
>
> **[Renew for another 90 days]** · **[Let it expire]**
>
> Letting it expire is a perfectly good choice, including when a club still has it. You can always make a new link and send it again.
>
> — Pitch

**Note:** this replaces §5 for any player who has sent to at least one club; §5 stands unchanged for everyone else. Naming the clubs is the point — "let it expire" is only a real choice if the parent knows who it takes the link away from. Both buttons stay weighted equally (D-53).

---

## 24 · Something is waiting for you — the bare wake to a guardian (D-117, D-138)

**This is the message with the least in it, and it is the most carefully built one in the file.** D-117 puts a club's approach *inside* Pitch and sends the guardian a bare wake to go and look. The wake carries **no child's name, no club name, no message, and no hint of what it is about** — because the whole point of keeping club content in-app is that it stays inside the permission model. A notification that names the club has already made the disclosure the design was avoiding, on a lock screen, to whoever is holding the phone.

**SMS:**

> **Pitch: there's something waiting for you in your account.**
> **Sign in to see it: pitchfootball.com.au**
> **Nothing has been shared with anyone. help@pitchfootball.com.au**

**Email — Subject:** `Something is waiting in your Pitch account`

> There's something waiting for you in Pitch.
>
> **[Open Pitch]**
>
> We keep messages like this inside Pitch rather than in your inbox, so that if you ever switch something off it actually stops. Nothing has been shared with anyone and nothing happens unless you choose it.
>
> — Pitch
> pitchfootball.com.au · help@pitchfootball.com.au

**Why it is this empty.** Three separate reasons, and each one alone would be enough. A forwarded notification leaks nothing. A phone left face-up on a kitchen bench shows nothing. And an email that names a club is content we cannot revoke sitting in an inbox we do not control — which is the exact failure mode D-117 exists to prevent.

**Why "nothing has been shared with anyone" is in a message this short.** It is the §1 line doing the same job in a different place. A parent who gets a vague notification about their child's account and cannot see what it is will assume the worst in the four seconds before they sign in. One clause removes that.

**Never:** the club's name, the child's name, the word *trial*, *invitation*, *offer* or *interest*, a count, a deadline, or any action that can be taken from inside the notification itself.

---

## 25 · The invitation — in-app, to the guardian of an under-16

**In-app copy, not email or SMS.** It is in this file because it is a message a club composes and a family reads, and D-117 says it lives nowhere else.

> **Riverside FC would like to talk to you about Deniz.**
>
> Deniz registered interest with Riverside FC on **3 March**. The club has read it and would like to take it further.
>
> **What they already have:** what you shared when you registered — Deniz's page and your note.
> **What they do not have:** your name, your phone number, your email address. They cannot get any of it from Pitch, before or after this.
>
> ---
>
> *From Riverside FC:*
> "[club's message]"
>
> ---
>
> **[Reply]** · **[Not now]**
>
> If you'd rather do nothing, do nothing — that is a complete answer and Riverside FC is not told whether you opened this.

**Why the two lists are above the club's message rather than below it.** The parent reads the club's words first if you let them, and then everything after it is read through the club's frame. What they have and cannot get is the fact that governs the decision, so it goes first.

**Why [Not now] and not [Decline].** D-138: ignoring produces no state the club can see, so the button and the silence must lead to the same place. A button labelled *Decline* implies a message going back, and one that quietly sends nothing would be a lie in a control.

**Never:** a club crest large enough to read as endorsement, a "verified against Football Victoria" badge (D-126 — that state does not exist), a response deadline, or a second invitation about the same registration.

---

## 26 · The invitation — to a 16–17 player, and the copy to their guardian

At sixteen the player answers for themselves (D-22, D-91) and the guardian is told every time (D-19). Same pattern as §22, and for the same reason: the off-switch is only a real control if it is attached to something the parent actually sees.

**To the player — bare wake, SMS or email, identical to §24.** The content is in-app:

> **Kingsway Rovers FC would like to talk to you.**
>
> You registered interest with them on **3 March**. They have read it and would like to take it further.
>
> **They don't have your phone number or your email address**, and they can't get them from Pitch. Whatever you reply, that stays true unless you hand them over yourself.
>
> **[Reply]** · **[Not now]**
>
> Your parent is told that this arrived. They can see what you send, and they don't have to approve it.

**To the guardian — Subject:** `A club has been in touch with Georgia on Pitch`

> **Kingsway Rovers FC** has been in touch with Georgia on Pitch today.
>
> At sixteen and seventeen, replying is Georgia's to do — she does not need your approval. You are told every time, you can see what she sends, and the switch is yours if you ever want it off.
>
> **[See it]** · **[Turn this off]**
>
> Turning it off is not a punishment and she will not be told it was you.
>
> — Pitch

**Why the guardian's copy names the club and §24 does not.** Different job. §24 wakes a guardian who is *about to be asked to decide something*, and naming the club there would disclose to a lock screen. This one reports something that has already happened to a player who is entitled to it happening, and a parent who is told "a club" without being told which club has been given an anxiety rather than a fact.

**Never in the player's version:** anything that reads as an offer, a place, or a selection. A club asking to talk is a club asking to talk.

---

## 27 · The invitation — to an adult (18+)

No guardian, no copy, no wake dressing. An adult gets the content.

**Subject:** `Northern United SC would like to talk to you`

> **Northern United SC** has read your registration and would like to take it further.
>
> **[Read it on Pitch]**
>
> They do not have your phone number or your email address. If you want them to, that is yours to hand over — Pitch will not do it for you.
>
> — Pitch
> pitchfootball.com.au · help@pitchfootball.com.au

**Why the contact-details line survives into the adult version.** It is the one sentence that is true on every tier and is the whole of what a person actually wants to know when a club they applied to appears in their inbox.

---

## 28 · A family has replied — to the club

**A club's general inbox is read by whoever is nearest the computer.** §19 already assumes that; this message is written on the same assumption and goes further, because a reply from a family carries more than a CV link does.

**Subject:** `A family has replied on Pitch`

> A family has replied to Riverside FC on Pitch.
>
> **[Sign in to read it]**
>
> We keep replies about players inside Pitch rather than in email. Signing in takes a moment and it is what lets a family switch access off and have it actually stop.
>
> — Pitch
> pitchfootball.com.au · help@pitchfootball.com.au

**Why the club's notification is bare too.** Not symmetry for its own sake. A club inbox is shared, forwarded, and often on a volunteer's personal phone; a child's name and a club's name together in that inbox is exactly the pairing §19 and rule 7 forbid. It is also the only version that stays true when the family later revokes — an email naming a child cannot be revoked, and a "sign in to read it" that leads to a withdrawn row can.

**Never:** the player's name, the squad, the note, a count of waiting replies, or a "3 new" badge in a subject line.

---

## 29 · A card waiting for your approval — to the guardian

The share card (D-101 as amended, BUZ 27 Aug). The guardian sees the exact image before it can leave.

**Subject:** `Deniz has made a card to share`

> Deniz has made a card and would like to post it.
>
> **[See the card]**
>
> You'll see the exact image — the same one, not a description of it. Nothing has been made and nothing exists anywhere until you say yes.
>
> If you approve it, Deniz can save it and post it wherever they like. **Once it's out, we can't take it back** — that's true of any image on any platform, and we'd rather say so than pretend we have a switch we don't have.
>
> — Pitch

**Why there is no preview image in the email.** D-101's build constraint: no image is generated or given a URL before approval. An email preview is a generated image on a public URL, sitting in an inbox, before a parent has agreed to anything. The one place the card may be rendered is behind sign-in.

**Why we say we cannot take it back.** Every other control in this product is real and reversible, and a parent has learned that from us. Letting them carry that assumption into the one irreversible act would be the most damaging thing in the file. It is one sentence and it is not softened.

**Never:** the card as an attachment or an inline image, a "Deniz is excited to share" line, a count of how many cards they have made, or any suggestion that approving is the expected answer.

---

## 30 · An edit waiting on you — to the guardian of an under-16 (D-119)

**Subject:** `Deniz has changed something on their page`

> Deniz has edited their Pitch page, and the change is waiting on you.
>
> **[See what changed]**
>
> Until you approve it, anyone holding Deniz's link still sees the page you approved before. **The page hasn't gone blank and nothing has been taken down.**
>
> If you do nothing, nothing publishes. There's no time limit on this and we won't chase you.
>
> — Pitch

**Why the second paragraph is the message.** D-119 creates a state a parent has no way to reason about — an approved version and a pending one — and the only question they will actually have is *what can people see right now.* Answering it before they ask is the difference between a control and an anxiety.

**Why "we won't chase you" is written down.** Because doc 14 §R7 says no timeout publishes an edit, and a nudge series is the shape that eventually turns into one. Saying it in the message to the parent is a constraint on us: we cannot add the reminder later without also making this message untrue.

**Never:** a countdown, "Deniz is waiting", a second reminder, or a diff so long the parent stops reading it. Show what changed, not the whole page.

---

## 31 · Payment taken — to the club

Addressed to the **club**, not to the person who typed the card (D-137), so a volunteer can be reimbursed without an argument.

**Subject:** `Riverside FC — your Pitch receipt`

> **Tax invoice**
> **Riverside Football Club**
> Interest Register — 12 months
> **$329.00 AUD**, paid 3 March 2027 — *includes $29.91 GST*
> Card ending 4242 · receipt PF-00184
> **Renews 3 March 2028 at $329.00 AUD** unless you cancel before then.
>
> *EBSD Enterprises Pty Ltd trading as Pitch Football · ABN 65 701 879 718*
>
> **[Manage or cancel this subscription]**
>
> Cancelling lives in your club settings on Pitch and takes about as long as signing up did. **Cancel within 14 days of today and we refund the whole $329, no questions.**
>
> This charge shows on your statement as **PITCH FOOTBALL**.
> Something wrong? Reply to this email before you ring your bank — we can usually fix it the same day.
>
> — Pitch

**Why this is headed *tax invoice*.** We are GST-registered, so a club treasurer needs a document that satisfies the ATO: supplier identity, ABN, and the GST amount shown separately (D-148). A receipt that is not a tax invoice generates a second email asking for one.

**Why the renewal terms are in our receipt when Stripe already showed them.** D-136: the disclosure is ours and cannot be outsourced to a processor's screen. It appears on our page before checkout, and again here, because the person reading the receipt in March is often not the person who clicked in September.

**Why the statement descriptor is named.** A treasurer who does not recognise a line on a bank statement rings the bank, and a chargeback costs more than the subscription and takes the account with it. Naming *PITCH FOOTBALL* and offering a reply-to route first is the cheapest chargeback control we have (D-136).

**Never:** any player's name, any registration count, anything at all about who has registered. This lands in a club inbox and a billing surface never carries child data (D-112, doc 14 §O10).

---

## 32 · The card didn't go through — to the club

D-135 in message form. The invariant is that suspension is not deletion, and the message's job is to say so before a treasurer panics.

**Subject:** `Riverside FC — we couldn't take your payment`

> The card for Riverside FC's Interest Register didn't go through on 3 March. **Nothing has changed yet.**
>
> **[Update the card]**
>
> We'll keep trying for the next fortnight. If it's still not sorted by **17 March**, the register is paused — your coaches stop seeing the list.
>
> **Nothing is deleted.** The families who registered stay registered, and everything comes back the moment a payment goes through.
>
> Your club page, your trial notices and CVs arriving by email are unaffected. They're free and they stay free.
>
> — Pitch

**Why "nothing is deleted" is bold in a billing email.** Because it is a database invariant (D-135, doc 14 §O4/O5) and invariants that only live in a register get eroded. It is also the sentence that stops a volunteer putting a club subscription on a personal credit card at eleven at night.

**Why it doesn't say *declined*, even about a card.** That word is banned in this product for any actor on any surface (D-108, D-85), and the CI check that enforces it does not know the difference between a declined card and a declined child. Carving an exception is how the word finds its way back to a person, so there is no exception: a card *didn't go through*.

**Never:** a number of registrations at risk, a family's name, a countdown in hours, "you're about to lose", or a second channel. One email, one reminder at day seven, one at suspension. And **no message goes to any family, ever, about a club's failed payment** — a family is not a party to it and telling them makes a commercial failure look like a safety event.

---

## 33 · A sign-in from somewhere new — to the account holder

**Subject:** `New sign-in to your Pitch account`

> Someone signed in to your Pitch account from a new device on **3 March, 8:14pm**.
>
> If that was you, there's nothing to do.
>
> If it wasn't: **[Change your password]** — that signs out everywhere, on every device, straight away.
>
> — Pitch · help@pitchfootball.com.au

**Goes to guardians and adults. It does not go to an under-16 alone** — it goes to the guardian, per D-19, because it is a safety message and the account it concerns is one the guardian is responsible for.

**Never:** an IP address, a map, a city, or a device fingerprint. We hold the minimum we can and a location string in an email is both a data disclosure and, in a household with a controlling adult in it, a hazard.

---

## 34 · Your code to claim a club page — to the club

The claim address is one already published by the club. The code proves the reader has that inbox; it does not prove anything else, and this message is careful to say so.

**Subject:** `Your code to claim Riverside FC on Pitch`

> Someone asked to claim the **Riverside FC** page on Pitch. If that was you, your code is:
>
> **`4F92 6B`**
>
> It works once and expires in 30 minutes. We'll never ring you for this code.
>
> Claiming the page lets you edit it and post trial notices. **It does not give you anything about any player under 18.** For that we need to speak to someone at the club first — we'll ring you.
>
> If this wasn't you, ignore it. Nothing changes and nobody gets access.
>
> — Pitch · help@pitchfootball.com.au

**Why D-126 is stated in an email about a code.** This is the exact moment a person forms their model of what claiming a page gets them, and the wrong model — *I'm in, the children's details follow* — is the one that makes the verification call feel like an obstacle three days later. Setting the expectation here makes the call an expected step rather than a surprise gate.

**Never:** the number of registrations held, the phrase *verified club*, an implication that payment brings the call forward, or a claim link that signs the reader straight in.

---

## An amendment to §10 · Password reset

§10 stands as written, with two things added since it was drafted.

**Where it goes for an under-16.** To the guardian. A child's account password reset is a guardian action, the same as everything else on that record (D-19).

**And the response is identical whether or not the address exists.** Doc 14's rule and D-94's: *identical responses and timing on sign-in, reset and every dead-token state.* A reset form that says "no account with that email" is an account-enumeration oracle, and on this product it enumerates families. The screen always says the same thing:

> **If there's a Pitch account for that address, a reset link is on its way.**


---

## What is deliberately NOT here

- **No message to any family when a club's payment fails or its register is suspended.** A family is not a party to a club's subscription, and telling them makes a commercial failure look like a safety event (D-135).
- **No notification that names a club on a lock screen.** The wake is bare or it is not sent (D-117, §24).
- **No "your invitation is waiting" chase to a guardian, and no state a club can read from silence.** Ignoring an approach is a complete answer and it must cost nothing (D-138).
- **No reminder that an edit is waiting re-approval, and no timeout that publishes one.** Doing nothing keeps the last approved page live, indefinitely (D-119, doc 14 §R7).
- **No preview of a share card in any email.** Generating the preview is generating the image, before anyone approved it (D-101).
- **No child's name, squad or note in any billing or claim email.** Those land in shared club inboxes and carry no child data at all (D-112, doc 14 §O10).
- **No location, city, IP or device string in a sign-in alert** (§33).
- **No account-enumeration answer on sign-in or password reset.** The response is identical whether or not the address exists (D-94).

- **No reminder to a guardian about a pending send.** One request, then silence. A parent who does not act has answered (doc 14 §L15, C8, D-77).
- **No "your CV was opened" or "a club looked at your page".** Not to a child, not to an adult, not ever. It is engagement bait, and to a fourteen-year-old refreshing for it, it is worse than that (D-65, doc 14 §J41).
- **No message to a club when a link they hold stops working.** The link-state page is the message, and it says nothing (D-77).
- **No message to a coach about their link** — not who opened it, not how many, not from where. The coach's link is a professional artefact they copy and paste; Pitch does not observe what happens to it (D-100).
- **No "send to more clubs" prompt, ever, in any message.** That is the sentence that turns a family's deliberate act into a campaign, and it is exactly what D-99 forbids in the product (doc 14 §J32).


- **No "your CV has been viewed" message.** That is a Stage 5 feature and it is engagement bait when sent to a minor.
- **No trial alerts by SMS** — email and web push at launch (D-81).
- **No welcome series, onboarding sequence or re-engagement email.** Anything that is not a response to something the user or their club did is marketing, and marketing does not go to minors (D-06).
- **No message to a child about anything a guardian did**, except where the guardian's action is something the child asked for.

---

*Doc 15 · Transactional Message Copy · **v1.1 · 27 Aug 2026** · written by Leo (CTO) from register **v3.4 (D-01 – D-139)** · every message at launch is in this file; if a message is not here, it does not send.*

*v1.1 adds §§24–34 — the eleven surfaces created on 27 August: the bare wake (D-117), the invitation at three age bands, the club's side of a reply, share-card approval, under-16 re-approval (D-119), the two billing messages (D-135, D-136, D-137), the new-device sign-in, and the club claim code (D-126) — plus an amendment to §10 and eight additions to the NOT list.*
