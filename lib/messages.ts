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

const SITE = 'pitchfootball.com.au';
const HELP = 'help@pitchfootball.com.au';

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
export const cvToClubEmail = (childFirstName: string, age: number, positions: string, clubOfPlayer: string, token: string): Composed => ({
  key: 'doc15.§19',
  channel: 'email',
  subject: `${childFirstName} (${age}) has sent you their football CV`,
  body:
`${childFirstName}'s family has sent you ${childFirstName}'s football CV.

Open ${childFirstName}'s CV: ${SITE}/p/${token}

${childFirstName} plays ${positions}, currently at ${clubOfPlayer}.

This is a link, not a file. The family controls it — they can pause or replace it at any time, and it expires on its own. If it stops working, that is normal and it is their choice, not a fault.

If you'd like to reply, just reply to this email. It goes to ${childFirstName} and their parent together, and a record is kept — that is how contact with an under-16 works on Pitch, without exception.

— Pitch
${SITE} · ${HELP}

You received this because a family sent you their child's CV. We did not add you to a list and there is nothing to unsubscribe from.`,
});

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
export const cvSentToPlayerEmail = (clubName: string): Composed => ({
  key: 'doc15.§21',
  channel: 'email',
  subject: `Your CV has been sent to ${clubName}`,
  body:
`Your CV has gone to ${clubName}. That is everything on your side — there is nothing else you need to do.

Clubs answer when they answer, and plenty never answer at all. That is normal and it is not about your page.

If anyone from the club writes back, it comes to you and your parent together.

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

// §13 · Thirty days before a sixteenth birthday. Doc 14 §B11 gates the
// discoverability transition on this having DELIVERED: no receipt, no
// discovery. Without this message D-22 is unbuildable.
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

// The closed set. A key not in here cannot be sent.
export const CATALOGUE_KEYS = [
  'doc15.§1', 'doc15.§2', 'doc15.§3', 'doc15.§10', 'doc15.§13', 'doc15.§14',
  'doc15.§15.stop', 'doc15.§15.help', 'doc15.§16', 'doc15.§19', 'doc15.§20',
  'doc15.§21', 'doc15.§24.sms', 'doc15.§24.email', 'doc15.§29', 'doc15.§30',
  'doc15.§33', 'doc15.§34',
] as const;
