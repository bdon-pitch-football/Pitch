// Is this page open inside another app's built-in browser? (doc 08 step 3,
// "in-app-browser link handling".)
//
// A parent taps a link in Facebook, Instagram, Messenger, TikTok or the
// Gmail and Outlook apps on an iPhone, and the page opens inside that app.
// It works — every form on the parent's path posts without JavaScript and
// nothing is used up by opening a link — but anything the parent signs in
// to stays inside that app, and is gone the next time they open Safari or
// Chrome. So the pages where a parent is about to sign in or set a password
// say so, and offer the phone's own browser.
//
// Read from the User-Agent of this one request, used for this one page and
// never stored: this is not device tracking (D-25), it is knowing which
// sentence to show.
//
// Deliberately NOT flagged: iOS Messages and Android Messages (they open
// Safari or Chrome), and Chrome Custom Tabs on Android (Gmail, WhatsApp),
// which share Chrome's sign-in.

export type InAppBrowser = { app: string; platform: 'ios' | 'android' | 'other' } | null;

const APPS: [RegExp, string][] = [
  [/\bInstagram\b/i, 'Instagram'],
  [/\b(FBAN|FBAV|FB_IAB|FBIOS)\b/, 'Facebook'],
  [/(musical_ly|BytedanceWebview|TikTok)/i, 'TikTok'],
  [/\bSnapchat\b/i, 'Snapchat'],
  [/\bLinkedInApp\b/i, 'LinkedIn'],
  [/\bLine\//, 'LINE'],
  [/\bTwitter\b/i, 'X'],
  [/\bGSA\//, 'the Google app'],
  [/\bGmail\b|\bGoogleMail\b/i, 'Gmail'],
  [/\bOutlook-(iOS|Android)\b/i, 'Outlook'],
];

export function detectInAppBrowser(ua: string | null | undefined): InAppBrowser {
  if (!ua) return null;
  const platform = /iPhone|iPad|iPod/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android' : 'other';
  // Facebook's own tokens appear in Messenger's UA too, so Messenger first.
  if (/FBAN\/Messenger|\bMessengerForiOS\b|\bMessengerLite\b/i.test(ua)) return { app: 'Messenger', platform };
  for (const [re, app] of APPS) if (re.test(ua)) return { app, platform };
  // A generic Android WebView marks itself "; wv)". No app name to give.
  if (platform === 'android' && /; wv\)/.test(ua)) return { app: 'another app', platform };
  return null;
}

/**
 * The link that asks the phone to open this page in its own browser, where
 * one exists. iOS 17+ understands x-safari-https; Android understands an
 * intent that names Chrome. Neither is guaranteed inside every app, which is
 * why the page always offers "Copy the link" as well.
 */
export function openInBrowserHref(url: string, platform: 'ios' | 'android' | 'other'): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (platform === 'ios') return `x-safari-${u.protocol.replace(':', '')}://${u.host}${u.pathname}${u.search}`;
  if (platform === 'android') {
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;end`;
  }
  return null;
}
