// The message catalogue — doc 15, verbatim. This file IS the rule "if a
// message is not in doc 15, it does not send": the send layer accepts only
// keys defined here, so a new message cannot be invented in a route.
//
// Rules that bind every entry (doc 15 §A):
//  · Australian English, parent-readable.
//  · Never a link shortener in an SMS — always pitchfootball.com.au (D-81).
//  · Every SMS carries a support address (D-79).
//  · No message contains a WWCC number, a token, or a child's surname
//    alongside their club.
//  · A club's approach to a family is a bare wake, never content (D-117).
//  · Silence is a supported outcome — nothing here chases (D-138).
import 'server-only';
// Type only — erased at compile time, so the copy file still depends on nothing.
import type { ReceiptFields } from './receipts';
// The support address is one constant with no dependencies of its own (BUZ,
// 28 Sep: his direct address replaces help@ in every message).
import { SUPPORT_EMAIL } from './support.ts';

const SITE = 'pitchfootball.com.au';
const HELP = SUPPORT_EMAIL;

export type Channel = 'sms' | 'email';
export interface Composed {
  key: string;
  channel: Channel;
  subject?: string;
  body: string;
}

// §1 · Guardian approval request — SMS. The most important 300 characters in
// the product. Never the surname, never the club, never urgency.
export const guardianApprovalSms = (childFirstName: string, age: number, code: string): Composed => ({
  key: 'doc15.§1',
  channel: 'sms',
  body:
    `Pitch: ${childFirstName} (${age}) has started a football profile and needs your OK before anything goes live.\n` +
    `Nothing is visible to anyone until you approve it.\n` +
    `Approve or decline: ${SITE}/a/${code}\n` +
    `Not expecting this? Ignore it and nothing happens. Questions: ${HELP}`,
});

// §2 · Guardian approval request — email. The four bullets are the same four
// promises as the approval screen, in the same order. The repetition is
// deliberate.
export const guardianApprovalEmail = (childFirstName: string, age: number, code: string): Composed => ({
  key: 'doc15.§2',
  channel: 'email',
  subject: `${childFirstName} has started a football profile — your approval is needed`,
  body:
`Hi,

${childFirstName} (${age}) has started building a football profile on Pitch — a place to keep a record of their football: club, position, season stats, and links to their highlight clips.

Nothing is visible to anyone until you approve it. Not to clubs, not to coaches, not to anyone with a link.

Review and approve: ${SITE}/a/${code}

What you are agreeing to, in plain words:

- ${childFirstName} will not appear in any search. Under-16 profiles are not searchable on Pitch at all.
- No one can contact ${childFirstName} directly. Any approach from outside their club comes to you and ${childFirstName} together, and it is logged.
- You hold the share link. It works only where you send it, it expires every 90 days unless you renew it, and you can pause or replace it at any time.
- You see everything ${childFirstName} sees. Linked account, full visibility, and you can withdraw all of this whenever you want.

Approving also accepts our Terms and Privacy Policy on ${childFirstName}'s behalf. Both are written to be read, not skimmed.

If you were not expecting this, you can ignore this email — the request disappears by itself after 14 days and nothing is kept.

— Pitch
${SITE} · ${HELP}`,
});

// §1b / §2b · Confirm you're their parent (BUZ, 17 Sep; D-155 as amended). A
// 16–17 runs their own page, so this asks the named parent to confirm, not to
// approve a page. The three bullets are the controls that parent really has.
export const guardianConfirmSms16 = (childFirstName: string, age: number, code: string): Composed => ({
  key: 'doc15.§1b',
  channel: 'sms',
  body:
    `Pitch: ${childFirstName} (${age}) has named you as their parent on their football profile. Please confirm it's you: ${SITE}/a/${code}\n` +
    `Not you? Ignore it and nothing happens. Questions: ${HELP}`,
});

export const guardianConfirmEmail16 = (childFirstName: string, age: number, code: string): Composed => ({
  key: 'doc15.§2b',
  channel: 'email',
  subject: `${childFirstName} has named you as their parent on Pitch`,
  body:
`Hi,

${childFirstName} (${age}) has started a football profile on Pitch and named you as their parent or guardian.

At ${age === 16 ? 'sixteen' : 'seventeen'}, ${childFirstName} builds their own page and sends it to clubs themselves — but they can't send it until you confirm you're their parent.

Confirm it's me: ${SITE}/a/${code}

Once you confirm:

- You're told every time ${childFirstName} sends their CV to a club, and you can switch their sending off.
- No one can contact ${childFirstName} directly. Any approach from outside their club comes to you and ${childFirstName} together.
- You can pause ${childFirstName}'s page at any time. Every link stops working until you switch it back on.

If you weren't expecting this, ignore this email — nothing happens, and the request disappears after 14 days.

— Pitch
${SITE} · ${HELP}`,
});

// §3 · Day-10 nudge — SMS. Sent once. Never twice. Deletion is the headline.
export const pendingNudgeSms = (childFirstName: string, code: string): Composed => ({
  key: 'doc15.§3',
  channel: 'sms',
  body:
    `Pitch: ${childFirstName}'s football profile is still waiting on your OK. It'll be deleted in 4 days if you don't approve it — nothing will be kept.\n` +
    `${SITE}/a/${code} · ${HELP}`,
});

// §14 · The verification code — SMS. Six digits, spaced for a lock screen.
export const verificationCodeSms = (code: string): Composed => ({
  key: 'doc15.§14',
  channel: 'sms',
  body: `Pitch: your code is ${code.split('').join('-')}. It expires in 10 minutes.\nWe'll never ring you for this code. ${HELP}`,
});

// §15 · STOP and HELP auto-replies (D-81).
export const stopReplySms = (): Composed => ({
  key: 'doc15.§15.stop',
  channel: 'sms',
  body:
    `Pitch: you're unsubscribed and we won't text this number again. If you were mid-way through approving a child's profile, that will now stop too — reply START or email ${HELP} if that wasn't what you meant.`,
});
export const helpReplySms = (): Composed => ({
  key: 'doc15.§15.help',
  channel: 'sms',
  body:
    `Pitch — a football development platform. You're getting this because someone asked you to approve a child's profile, or you asked us for a code. Reply STOP to opt out. ${HELP} · ${SITE}`,
});

// §19 · A CV sent to a club — to the club. Never the surname beside the club,
// never an attachment, never a photograph, never a date of birth, never the
// word "trial".
// §19 has three senders since the send flow learned the other two bands
// (D-99): the FAMILY (a guardian, for an under-16 or on a 16-17's behalf), a
// 16-17 sending for themselves, and an adult. The first line and the
// paragraphs about under-18s follow the sender, because "Jordan's family has
// sent you Jordan's football CV" is false when a 22-year-old sent it.
export const cvToClubEmail = (
  childFirstName: string, age: number, positions: string, clubOfPlayer: string, token: string,
  sender: 'family' | 'self' = 'family', band: 'u16' | '16_17' | '18plus' = 'u16',
): Composed => {
  const self = sender === 'self';
  const adult = band === '18plus';
  const opener = self
    ? `${childFirstName} has sent you their football CV.`
    : `${childFirstName}'s family has sent you ${childFirstName}'s football CV.`;
  const control = adult
    ? `This is a link, not a file. ${childFirstName} controls it — they can switch it off or replace it at any time, and it expires on its own. If it stops working, that is their choice, not a fault.`
    : self
      ? `This is a link, not a file. ${childFirstName} and their family control it — they can pause or replace it at any time, and it expires on its own. If it stops working, that is normal and it is their choice, not a fault.`
      : `This is a link, not a file. The family controls it — they can pause or replace it at any time, and it expires on its own. If it stops working, that is normal and it is their choice, not a fault.`;
  const contact = adult
    ? `Replies to this message do not reach ${childFirstName}. Pitch does not pass messages on.`
    : `Replies to this message do not reach the family. There is no way to reply to a family through Pitch — at any tier, for anybody. That is deliberate, and it is the same rule for every under-18 on here.

If you want ${childFirstName} at a trial, post it on Pitch. Families register their interest from your trial, and that is where you can invite them — it goes to ${childFirstName} and their parent together, and a record is kept.`;
  const why = self
    ? `You received this because a player sent you their CV. We did not add you to a list and there is nothing to unsubscribe from.`
    : `You received this because a family sent you their child's CV. We did not add you to a list and there is nothing to unsubscribe from.`;
  // A player with no current club — which is most players sending a CV, since
  // finding one is why they send it — read "currently at ." (28 Sep). The
  // clause goes when there is no club, and the line goes when there are no
  // positions either. Both are removals: nothing new is said in their place.
  const plays = positions
    ? `${childFirstName} plays ${positions}${clubOfPlayer ? `, currently at ${clubOfPlayer}` : ''}.`
    : null;
  return {
    key: 'doc15.§19',
    channel: 'email',
    subject: `${childFirstName} (${age}) has sent you their football CV`,
    body:
`${opener}

Open ${childFirstName}'s CV: ${SITE}/p/${token}

${plays ? `${plays}\n\n` : ''}${control}

${contact}

— Pitch
${SITE} · ${HELP}

${why}`,
  };
};

// §20 · A send waiting on you — to the guardian. Email only, deliberately:
// an SMS manufactures pressure around a decision designed to be pressure-free.
// The address is printed in full, above the fold.
export const sendWaitingEmail = (childFirstName: string, clubName: string, address: string, requestId: string): Composed => ({
  key: 'doc15.§20',
  channel: 'email',
  subject: `${childFirstName} would like to send their CV to ${clubName}`,
  body:
`${childFirstName} has asked to send their football CV to ${clubName}.

It goes to: ${address}

Nothing has been sent. It only goes if you send it.

Check the address and send: ${SITE}/g/send/${requestId}

What the club gets is a link to ${childFirstName}'s CV — not a file, and not a copy. You can pause or replace that link later, and the club's access stops when you do.

If you'd rather not, do nothing. The request disappears by itself and ${childFirstName} can ask again another time.

— Pitch
${SITE} · ${HELP}`,
});

// §21 · Your CV has gone — to the player. Never "great news", never an
// exclamation mark, never a suggestion to send to more clubs, and never
// anything about whether the link has been opened.
export const cvSentToPlayerEmail = (clubName: string, band: 'u16' | '16_17' | '18plus' = 'u16'): Composed => {
  // John's U-11: nobody can reply to a send. This line used to promise the
  // opposite — "if anyone from the club writes back, it comes to you and your
  // parent together" — to a player who would then wait for a reply that has
  // no route to arrive by. What IS true: a club that wants them has to ask
  // through Pitch, and who hears about it follows the band (doc 15 §25-§27).
  const contact = band === '18plus'
    ? `The club can't reply to the email it got. If it wants to talk to you, it has to ask through Pitch.`
    : band === '16_17'
      ? `The club can't reply to the email it got. If it wants to talk to you, it has to ask through Pitch — it comes to you, and your parent is told.`
      : `The club can't reply to the email it got. If it wants to talk to you, it has to ask through Pitch, and it comes to you and your parent together.`;
  return {
    key: 'doc15.§21',
    channel: 'email',
    subject: `Your CV has been sent to ${clubName}`,
    body:
`Your CV has gone to ${clubName}. That is everything on your side — there is nothing else you need to do.

Clubs answer when they answer, and plenty never answer at all. That is normal and it is not about your page.

${contact}

— Pitch`,
  };
};

// §22 · Your child sent their CV — to the guardian of a 16–17. On EVERY send,
// never a digest (D-99, D-22), and to both guardians identically where there
// are two (D-51, F5). Doc 15's example says "his": the product holds no gender
// for a child (D-25), so it cannot know, and it says "their".
export const childSentCvEmail = (childFirstName: string, clubName: string, address: string, childId: string): Composed => ({
  key: 'doc15.§22',
  channel: 'email',
  subject: `${childFirstName} sent their CV to ${clubName}`,
  body:
`${childFirstName} sent their football CV to ${clubName} today, at ${address}.

${childFirstName} does not need your approval for this — at sixteen and seventeen, sending is theirs to do. You are told every time, and the switch is yours if you ever want it off.

See what they sent, or turn sending off: ${SITE}/g/controls/${childId}

Turning it off is not a punishment and ${childFirstName} will not be told it was you — they will simply see that sending is off on their account, and the two of you can sort it out between you.

— Pitch`,
});

// §24 · The bare wake (D-117, D-138). No child's name, no club name, no
// message, no hint of what it is about, and no action inside the notification.
export const bareWakeSms = (): Composed => ({
  key: 'doc15.§24.sms',
  channel: 'sms',
  body:
    `Pitch: there's something waiting for you in your account.\n` +
    `Sign in to see it: ${SITE}\n` +
    `Nothing has been shared with anyone. ${HELP}`,
});
export const bareWakeEmail = (): Composed => ({
  key: 'doc15.§24.email',
  channel: 'email',
  subject: 'Something is waiting in your Pitch account',
  body:
`There's something waiting for you in Pitch.

Open Pitch: ${SITE}

We keep messages like this inside Pitch rather than in your inbox, so that if you ever switch something off it actually stops. Nothing has been shared with anyone and nothing happens unless you choose it.

— Pitch
${SITE} · ${HELP}`,
});

// §6 · Access request — to the guardian (D-77). Someone with a dead link
// typed their own name and role and asked to see the CV. We have given them
// nothing, and they will never learn whether this was read.
export const accessRequestEmail = (childFirstName: string, typedName: string, typedRole: string) => ({
  key: 'doc15.§6',
  channel: 'email' as const,
  subject: `Someone asked to see ${childFirstName}'s football CV`,
  body: [
    `${typedName} — ${typedRole} — followed a link to ${childFirstName}'s CV that is no longer active, and asked to see it.`,
    '',
    `We have not given them anything. They cannot see ${childFirstName}'s name, club, photo or age, and they will not know whether you read this.`,
    '',
    'This is unverified. They typed their own name and role — we have not checked either. If you do not recognise them, ignoring this is the right call, and we will not ask again on their behalf.',
    '',
    '— Pitch',
  ].join('\n'),
});

// §35 · Your request expired — to the player who composed it (John, U-1).
// The constraint is absolute: they are told THEIR REQUEST expired. Never that
// a parent did not act, and never anything they could infer it from.
export const sendRequestLapsedEmail = (clubName: string) => ({
  key: 'doc15.§35',
  channel: 'email' as const,
  subject: 'Your CV request has expired',
  body: [
    `The request you made to send your CV to ${clubName} has expired, so it is no longer active.`,
    '',
    'You can ask again whenever you like. Nothing has been sent, and nothing about your page has changed.',
    '',
    '— Pitch',
  ].join('\n'),
});

// §36 · A CV was sent — to the OTHER guardian (John, U-2). Carries the
// 24-hour undo. The undo revokes the link; it does not un-send the email, and
// saying otherwise would be lying to a frightened parent.
export const sendMadeByOtherGuardianEmail = (
  otherGuardianFirstName: string, childFirstName: string, clubName: string, undoToken: string,
) => ({
  key: 'doc15.§36',
  channel: 'email' as const,
  subject: `${childFirstName}'s CV was sent to ${clubName}`,
  body: [
    `${otherGuardianFirstName} sent ${childFirstName}'s football CV to ${clubName} today.`,
    '',
    `You are being told because you are also ${childFirstName}'s parent on Pitch, and you both hold the same controls.`,
    '',
    `Switch this link off: ${SITE}/undo/${undoToken}`,
    '',
    `If you switch it off, the club can no longer open ${childFirstName}'s page. The email itself has already arrived and we cannot recall that — nobody can. What you can do is stop what it opens.`,
    '',
    '— Pitch',
  ].join('\n'),
});

// §37 · A club you sent to is no longer verified (John, M11). Sent ONLY for
// the child-safety reason class. We may withhold the reason; we must not
// withhold the ability to act — and we never revoke on the family's behalf.
export const clubDeverifiedEmail = (clubName: string, childFirstName: string, undoToken: string) => ({
  key: 'doc15.§37',
  channel: 'email' as const,
  subject: 'A club you shared with is no longer verified on Pitch',
  body: [
    `${clubName} is no longer a verified club on Pitch.`,
    '',
    `You sent them a link to ${childFirstName}'s page, and that link still works — you sent it, so it is yours to switch off.`,
    '',
    `Switch this link off: ${SITE}/undo/${undoToken}`,
    '',
    'We are not telling you why the club is no longer verified, and we are not going to. What we can tell you is that you have the control, and that this takes one tap.',
    '',
    'We have not switched it off for you. You made the decision to share; the decision to stop is yours as well.',
    '',
    '— Pitch',
  ].join('\n'),
});

// §29 · A card waiting for your approval. NO preview image — generating the
// preview is generating the image, before anyone approved it (D-101).
export const shareCardWaitingEmail = (childFirstName: string): Composed => ({
  key: 'doc15.§29',
  channel: 'email',
  subject: `${childFirstName} has made a card to share`,
  body:
`${childFirstName} has made a card and would like to post it.

See the card: ${SITE}

You'll see the exact image — the same one, not a description of it. Nothing has been made and nothing exists anywhere until you say yes.

If you approve it, ${childFirstName} can save it and post it wherever they like. Once it's out, we can't take it back — that's true of any image on any platform, and we'd rather say so than pretend we have a switch we don't have.

— Pitch`,
});

// §30 · An edit waiting on you (D-119). No countdown, no chase, no second
// reminder — and nothing here may imply a timeout publishes anything.
export const editWaitingEmail = (childFirstName: string, recordId: string): Composed => ({
  key: 'doc15.§30',
  channel: 'email',
  subject: `${childFirstName} has changed something on their page`,
  body:
`${childFirstName} has edited their Pitch page, and the change is waiting on you.

See what changed: ${SITE}/g/pending/${recordId}

Until you approve it, anyone holding ${childFirstName}'s link still sees the page you approved before. The page hasn't gone blank and nothing has been taken down.

If you do nothing, nothing publishes. There's no time limit on this and we won't chase you.

— Pitch`,
});

// §31 · Payment taken — to the CLUB, not the person who typed the card
// (D-137), so a volunteer can be reimbursed without an argument. Headed a
// tax invoice because we are GST-registered and a treasurer needs a document
// the ATO accepts: supplier identity, ABN, GST shown separately (D-148).
//
// The renewal terms repeat here even though Stripe showed them, because
// D-136 makes the disclosure OURS — and the person reading the receipt in
// March is usually not the person who clicked in September.
//
// NEVER: a player's name, a registration count, anything about who has
// registered. This lands in a club inbox and a billing surface carries no
// child data (doc 14 O10).
//
// It takes the fields as one object (lib/receipts builds them) rather than nine
// positional strings, because nine strings in a row is a receipt that says the
// GST where the amount goes and type-checks perfectly.
//
// The card fragment is conditional. A Stripe invoice does not carry the card's
// last four digits, and inventing them is not available to a tax invoice — so
// where we do not have them the line reads "receipt <n>" alone. APPROVED by
// BUZ, 28 Sep, and dormant while billing is off (D-163: so this never
// sends). Passing a last4 renders doc 15's line exactly as approved.
export const paymentTakenEmail = (r: ReceiptFields): Composed => ({
  key: 'doc15.§31',
  channel: 'email',
  subject: `${r.clubLegalName} — your Pitch receipt`,
  body:
`Tax invoice
${r.clubLegalName}
${r.planLabel}
${r.amount} AUD, paid ${r.paidOn} — includes ${r.gst} GST
${r.cardLast4 ? `Card ending ${r.cardLast4} · ` : ''}receipt ${r.receiptNo}
Renews ${r.renewsOn} at ${r.amount} AUD unless you cancel before then.

EBSD Enterprises Pty Ltd trading as Pitch Football · ABN 65 701 879 718

Manage or cancel this subscription: ${SITE}/club/billing

Cancelling lives in your club settings on Pitch and takes about as long as signing up did.${r.refundable ? ` Cancel within 14 days of today and we refund the whole ${r.amount}, no questions.` : ''}

This charge shows on your statement as PITCH FOOTBALL.
Something wrong? Reply to this email before you ring your bank — we can usually fix it the same day.

— Pitch
${SITE} · ${HELP}`,
});

// §32 · The card didn't go through — to the club. D-135 in message form.
//
// "Nothing is deleted" is bold because it is a database invariant, and
// invariants that live only in a register get eroded. It is also the
// sentence that stops a volunteer putting a club subscription on a personal
// credit card at eleven at night.
//
// It does not say "declined", even about a card: that word is banned for any
// actor on any surface, and carving an exception is how it finds its way back
// to a person. A card didn't go through.
//
// NEVER: a number of registrations at risk, a family's name, a countdown in
// hours, or a second channel. And no message goes to any family, ever, about
// a club's failed payment.
export const paymentFailedEmail = (
  clubName: string, attemptedOn: string, pausesOn: string,
): Composed => ({
  key: 'doc15.§32',
  channel: 'email',
  subject: `${clubName} — we couldn't take your payment`,
  body:
`The card for ${clubName}'s Interest Register didn't go through on ${attemptedOn}. Nothing has changed yet.

Update the card: ${SITE}/club/billing

We'll keep trying for the next fortnight. If it's still not sorted by ${pausesOn}, the register is paused — your coaches stop seeing the list.

Nothing is deleted. The families who registered stay registered, and everything comes back the moment a payment goes through.

Your club page, your trial notices and CVs arriving by email are unaffected. They're free and they stay free.

— Pitch
${SITE} · ${HELP}`,
});

// §33 · A sign-in from somewhere new. Never an IP, a map, a city or a device
// fingerprint. Goes to guardians and adults, never to an under-16 alone.
export const newSignInEmail = (whenMelbourne: string): Composed => ({
  key: 'doc15.§33',
  channel: 'email',
  subject: 'New sign-in to your Pitch account',
  body:
`Someone signed in to your Pitch account from a new device on ${whenMelbourne}.

If that was you, there's nothing to do.

If it wasn't: change your password — that signs out everywhere, on every device, straight away.

— Pitch · ${HELP}`,
});

// §34 · Your code to claim a club page. Never the number of registrations
// held, never the phrase "verified club", never a link that signs them in.
export const clubClaimCodeEmail = (clubName: string, code: string): Composed => ({
  key: 'doc15.§34',
  channel: 'email',
  subject: `Your code to claim ${clubName} on Pitch`,
  body:
`Someone asked to claim the ${clubName} page on Pitch. If that was you, your code is:

${code}

It works once and expires in 30 minutes. We'll never ring you for this code.

Claiming the page lets you edit it and post trial notices. It does not give you anything about any player under 18. For that we need to speak to someone at the club first — we'll ring you.

If this wasn't you, ignore it. Nothing changes and nobody gets access.

— Pitch · ${HELP}`,
});

// §10 · Password reset. Identical response whether or not the address exists;
// for an under-16 it routes to the guardian.
export const passwordResetEmail = (token: string): Composed => ({
  key: 'doc15.§10',
  channel: 'email',
  subject: 'Reset your Pitch password',
  body:
`Someone asked to reset the password for this account. If it was you:

Set a new password: ${SITE}/reset/${token}

This link works once and expires in an hour. If it wasn't you, ignore this — nothing changes.

— Pitch`,
});

// §10a · Set your first password (BUZ, 17 Sep; John's ruling). Sent instead
// of §10 when the account has never had one — every parent on the day they
// approve. §10's "Someone asked to reset…" reads like phishing to them. The
// child is named by first name only (rule 7).
export const firstPasswordEmail = (token: string, childFirstName: string): Composed => ({
  key: 'doc15.§10a',
  channel: 'email',
  subject: 'Set your Pitch password',
  body:
`You approved ${childFirstName}'s football page on Pitch. To sign in and see it — and every control over it — choose a password:

Set your password: ${SITE}/reset/${token}

This link works once and expires in an hour. If you didn't ask for this, ignore it — nothing changes.

— Pitch
${SITE} · ${HELP}`,
});

// §10b · DRAFT — confirm the address on a new account (B1/B2, L21). BUZ has
// NOT approved these words and doc 15 does not carry them, so this key is not
// in CATALOGUE_KEYS: it queues in development, where the outbox is the inbox,
// and lib/messaging refuses it in production. The three sign-up doors need
// this message and neither approved one can honestly do the job — §10 opens
// "Someone asked to reset the password for this account", which is untrue of
// an account made a second ago and reads as phishing (the reason §10a
// exists), and §10a names a child the person may not have.
//
// Rules it is written to: no urgency, no child's name, no clue about who else
// holds an account, and the plain reason the link exists.
export const confirmAddressEmail = (token: string): Composed => ({
  key: 'doc15.§10b.draft',
  channel: 'email',
  subject: 'Confirm your email address',
  body:
`Someone put this address into a new account on Pitch. If that was you, this link finishes it:

Confirm your address: ${SITE}/confirm/${token}

Nobody can sign in to that account until the link is opened. If it wasn't you, ignore this email — the account stays shut, and whoever typed your address gets nothing from it.

The link works once and lasts seven days. After that, use "Reset it" on the sign-in page and choose a password from the link we email you.

— Pitch
${SITE} · ${HELP}`,
});

// §13 · Thirty days before a sixteenth birthday. Doc 14 §B11 gates the
// discoverability transition on this having DELIVERED: no receipt, no
// discovery. Without this message D-22 is unbuildable.
//
// HELD 23 Sep 2026 (BUZ decision 3) — THIS MESSAGE DOES NOT SEND. The switch
// it offers does not exist: no screen in the product reads or writes
// `guardian_setting.discovery_disabled`. The words stay here, unedited,
// because doc 14 §B11 defines the sixteen-year-old transition by this message
// having been delivered — deleting them deletes the gate. They are the
// approved copy for the day the switch is built, and they are not to be
// edited to fit its absence. The key is in HELD_KEYS at the foot of this
// file; lib/messaging refuses it, and the daily job does not even look for
// children to send it to (app/api/jobs/daily). While it is held nobody is
// told about the change at sixteen, so discovery stays OFF at sixteen — the
// more restrictive answer — and no screen anywhere may say clubs can search
// for players who are sixteen or seventeen.
export const sixteenthBirthdayEmail = (childFirstName: string): Composed => ({
  key: 'doc15.§13',
  channel: 'email',
  subject: `${childFirstName} turns 16 next month — one thing changes, and you choose`,
  body:
`In thirty days ${childFirstName} turns sixteen, and one thing on Pitch changes.

Verified clubs and coaches will be able to find them in a search. Not the public. Not anyone without a verified club behind them. And nothing else changes: nobody can message them directly, any approach still comes to you and ${childFirstName} together, and you still see everything they see.

Leave it on, or turn it off: ${SITE}

The switch is yours, it stays yours, and you can change it any time — before their birthday or years afterwards. If you do nothing, it turns on when they turn sixteen.

— Pitch`,
});

// §16 · Deletion confirmation — to the guardian and the child together.
export const deletionConfirmedEmail = (childFirstName: string): Composed => ({
  key: 'doc15.§16',
  channel: 'email',
  subject: `${childFirstName}'s Pitch record has been deleted`,
  body:
`It's done. ${childFirstName}'s profile, stats, highlight links and development record are gone, and any link anyone was holding has stopped working.

Two things remain, and we want to be straight about both. A record that a consent was given and later withdrawn, with the dates — that is the only proof we did what we promised, and we cannot prove we deleted something by deleting the proof. And any coach who wrote an assessment keeps an anonymous count of how many they wrote, with nothing about ${childFirstName} in it.

Nothing else. No copy, no archive, no "in case you come back".

— Pitch`,
});

// §27 · The invitation — to an adult (18+). No guardian, no copy, no wake
// dressing: an adult gets the content. Written in doc 15 on 27 August and
// never sent by anything until D-153, because invitations only ever reached
// a guardian — so an adult a club invited was told nothing at all.
export const adultInvitationEmail = (clubName: string, invitationId: string): Composed => ({
  key: 'doc15.§27',
  channel: 'email',
  subject: `${clubName} would like to talk to you`,
  body:
`${clubName} has read your registration and would like to take it further.

Read it on Pitch: ${SITE}/g/invite/${invitationId}

They do not have your phone number or your email address. If you want them to, that is yours to hand over — Pitch will not do it for you.

— Pitch
${SITE} · ${HELP}`,
});

// §28 · A family has replied — to the club. Bare on purpose: a club inbox is
// shared and forwarded, so no player name, no squad, no note, no count. It is
// also the only version that stays true if the family later withdraws.
export const familyRepliedEmail = (clubName: string): Composed => ({
  key: 'doc15.§28',
  channel: 'email',
  subject: 'A family has replied on Pitch',
  body:
`A family has replied to ${clubName} on Pitch.

Sign in to read it: ${SITE}/club/register

We keep replies about players inside Pitch rather than in email. Signing in takes a moment and it is what lets a family switch access off and have it actually stop.

— Pitch
${SITE} · ${HELP}`,
});

// §38 · Every link switched off (BUZ, 17 Sep; John's ruling). The emergency
// switch sends it to each affected guardian and each affected player 16 or
// over. The reason is one sentence the operator writes at the time; the
// switch will not run without it. Never a child's name, a club or a count.
export const linksSwitchedOffEmail = (reason: string): Composed => ({
  key: 'doc15.§38',
  channel: 'email',
  subject: "We've switched off your Pitch share links",
  body:
`We've switched off every share link on Pitch, including the ones you sent. Anyone who had one now sees a page that says it's no longer available.

Nothing on your page has changed, and nothing has been deleted. When you're ready, you can send a new link from Pitch and it will work as normal.

${reason}

If you have questions, write to ${HELP}.

— Pitch`,
});

// §5 · Share-link renewal reminder, a week before expiry. Once. Renewing and
// letting it expire are given equal weight (D-53): expiry is a good choice.
export const linkRenewalEmail = (childFirstName: string, date: string, childId: string): Composed => ({
  key: 'doc15.§5',
  channel: 'email',
  subject: `${childFirstName}'s CV link expires in a week`,
  body:
`The link you shared for ${childFirstName}'s football CV expires on ${date}. After that, anyone who opens it sees a page telling them the profile is managed by the family — nothing else, no details.

Renew for another 90 days: ${SITE}/g/controls/${childId}
Let it expire: there's nothing to do.

Letting it expire is a perfectly good choice. You can always make a new link later.

— Pitch`,
});

// §23 · The same, when clubs hold the link — and it names them, because
// "let it expire" is only a real choice if the parent knows who loses it.
export const linkExpiringToClubsEmail = (childFirstName: string, date: string, clubs: string[], childId: string): Composed => ({
  key: 'doc15.§23',
  channel: 'email',
  subject: `${childFirstName}'s CV link expires in a week`,
  body:
`The link for ${childFirstName}'s CV expires on ${date}. ${clubs.length} club${clubs.length === 1 ? ' has' : 's have'} been sent it: ${clubs.join(', ')}.

After ${date} they will see a page saying the profile is managed by the family — no name, no club, no details.

Renew for another 90 days: ${SITE}/g/controls/${childId}
Let it expire: there's nothing to do.

Letting it expire is a perfectly good choice, including when a club still has it. You can always make a new link and send it again.

— Pitch`,
});

// §7 · Report received — to the reporter, when they left an address.
export const reportReceivedEmail = (pageDescription: string): Composed => ({
  key: 'doc15.§7',
  channel: 'email',
  subject: "We've received your report",
  body:
`Thanks — we have your report about ${pageDescription} and a person will look at it.

We aim to respond within one business day. If it concerns a child's immediate safety, contact your local police first; we are not an emergency service.

— Pitch · ${HELP}`,
});

// §8 · Report and takedown — to the affected family, when a page is hidden.
export const reportFamilyEmail = (childFirstName: string): Composed => ({
  key: 'doc15.§8',
  channel: 'email',
  subject: 'Something about your child on Pitch needs your attention',
  body:
`Someone has reported content on Pitch that involves ${childFirstName}.

While we look at it, the content is not visible to anyone.

A person from Pitch will contact you within one business day. If you would like it removed permanently, reply to this email and we will do it — you do not need to give a reason.

— Pitch`,
});

// §18 · A report we've finished with — only when something was done: the
// copy says "taken action", so a no-action close sends nothing.
export const reportFinishedEmail = (): Composed => ({
  key: 'doc15.§18',
  channel: 'email',
  subject: "We've finished looking at your report",
  body:
`Thanks for telling us. We've looked at it and taken action.

We can't tell you what we did — that would identify other people — but the report was read by a person and it was not ignored. If you see the same thing again, report it again; a second report about the same thing tells us something the first one didn't.

— Pitch · ${HELP}`,
});

// §17 · The age-contradiction hold (D-96) — the one message whose job is to
// be non-accusatory.
export const signupHoldEmail = (): Composed => ({
  key: 'doc15.§17',
  channel: 'email',
  subject: 'We need a moment on your Pitch signup',
  body:
`Thanks for signing up. Something on your form doesn't add up — the date of birth and the team don't match — so a person is taking a look before we go further. That usually takes a few hours.

If you made a typo, reply to this email and tell us what it should say.

If you're under 18: that's completely fine, and Pitch is built for you. You'll just need a parent to approve your profile first. Reply and we'll send you the right link.

— Pitch`,
});

// §12 · A club has confirmed a coach's WWCC (D-98). Rewritten 17 Sep so it
// promises only what exists: development records are Stage 2.
export const coachVerifiedEmail = (clubName: string): Composed => ({
  key: 'doc15.§12',
  channel: 'email',
  subject: "You're verified on Pitch",
  body:
`${clubName} has confirmed your Working With Children Check. Your coach page now shows "WWCC verified", and ${clubName} can give you access to the registrations for the teams you coach.

Pitch never shows your check number to anyone.

Verification is free and stays free.

— Pitch`,
});

// The closed set. A key not in here cannot be sent.
export const CATALOGUE_KEYS = [
  'doc15.§1', 'doc15.§2', 'doc15.§1b', 'doc15.§2b', 'doc15.§3', 'doc15.§10', 'doc15.§10a', 'doc15.§13', 'doc15.§14',
  'doc15.§15.stop', 'doc15.§15.help', 'doc15.§16', 'doc15.§19', 'doc15.§20',
  'doc15.§6', 'doc15.§21', 'doc15.§22', 'doc15.§31', 'doc15.§32', 'doc15.§35', 'doc15.§36', 'doc15.§37', 'doc15.§24.sms', 'doc15.§24.email', 'doc15.§29', 'doc15.§30',
  'doc15.§33', 'doc15.§34', 'doc15.§27', 'doc15.§28', 'doc15.§38',
  'doc15.§5', 'doc15.§23', 'doc15.§7', 'doc15.§8', 'doc15.§18', 'doc15.§17', 'doc15.§12',
] as const;

// Words BUZ has not approved. A draft is wired like any other message so the
// flow it belongs to can be built and tested, and it cannot reach a person:
// lib/messaging queues it in development — where nothing leaves the machine —
// and refuses it outright in production. The door that needs one cannot ship
// until doc 15 carries the words and the key moves into CATALOGUE_KEYS above.
export const DRAFT_KEYS = [
  'doc15.§10b.draft',   // confirm your address, for the three sign-up doors
] as const;

// Approved words BUZ has STOPPED sending. A held message keeps its text, its
// section number and its place in the catalogue — doc 14 can define a gate by
// one of these having delivered, and deleting the words would delete the gate
// — and lib/messaging refuses it everywhere, development included, so no new
// caller can start it again by accident.
//
// Before a key comes off this list, ALL of the following have to be true and
// the report has to say so:
//
//   doc15.§13 (held 23 Sep 2026, BUZ decision 3 — the sixteenth birthday):
//     · the switch it hands the parent EXISTS — a screen that reads and
//       writes guardian_setting.discovery_disabled (nothing does today);
//     · the search it describes exists (D-53: there is no club search yet),
//       and the sentence about it has been re-read against whatever that
//       search actually is;
//     · "Leave it on, or turn it off: pitchfootball.com.au" names the real
//       page that switch lives on;
//     · BUZ has ruled on the default at sixteen and re-approved these words,
//       and doc 15 §13 carries them with the hold note removed.
export const HELD_KEYS = [
  'doc15.§13',
] as const;

/** Is this message held? (lib/messaging asks; so does the daily job.) */
export const isHeld = (key: string): boolean => (HELD_KEYS as readonly string[]).includes(key);
