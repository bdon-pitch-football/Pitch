// Is this request somebody opening a link, or a machine looking at it?
//
// A parent forwards the approval text to the other parent, or pastes the
// emailed link into a chat to ask "is this legit?". Before anybody taps it,
// the messaging app fetches the page itself to draw a preview card. That
// fetch is a page load like any other, and the approval page records the
// first page load as `guardian_landed` (D-78) — so without this, the funnel
// would say "the parent opened the permission page" when a server in Menlo
// Park did.
//
// THIS IS A HEURISTIC, and it is kept in one place so that is obvious. A
// user agent is whatever the caller says it is: a preview bot can omit it, a
// person can send a bot's, and a new messaging app will not be on the list.
// It errs one way on purpose — the words /bot|crawler|spider|preview/ will
// also catch the odd real browser whose name happens to contain them (a
// Cubot phone's user agent does) — because the cost of a missed landing is
// one line missing from a parent's log, and the cost of a false one is a
// line on that log saying they did something they did not. Nothing about
// access or consent reads this: it decides whether one funnel row is
// written, and nothing else.
//
// A HEAD request is never a person: browsers do not send one to open a page,
// and link checkers and some preview fetchers do. The method is not visible
// to a page component, so proxy.ts stamps it on the request as
// PITCH_METHOD_HEADER, overwriting anything the caller sent.

export const PITCH_METHOD_HEADER = 'x-pitch-request-method';

// Named, because a reader should be able to see who we mean. The last entry
// is the catch-all for the ones we did not name.
export const LINK_PREVIEW_AGENTS: RegExp[] = [
  /facebookexternalhit/i,  // Facebook, Messenger, Instagram
  /WhatsApp/i,             // the app's own fetcher; a tapped link opens in Safari or Chrome
  /Twitterbot/i,
  /Slackbot/i,
  /TelegramBot/i,
  /Discordbot/i,
  /LinkedInBot/i,
  /SkypeUriPreview/i,      // Skype and Teams
  /Googlebot/i,
  /bingbot/i,
  /Applebot/i,             // iMessage previews
  /bot|crawler|spider|preview/i,
];

export function isLinkPreviewFetch(method: string | null | undefined, userAgent: string | null | undefined): boolean {
  if ((method ?? '').toUpperCase() === 'HEAD') return true;
  const ua = userAgent ?? '';
  return LINK_PREVIEW_AGENTS.some((re) => re.test(ua));
}
