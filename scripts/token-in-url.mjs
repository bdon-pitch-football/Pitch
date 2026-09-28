// NO SHARE TOKEN IN AN ADDRESS (brief D, 29 Sep; doc 14 L38/L42; D-94 §4).
//
// A real send by a guardian used to redirect to `?sent=1&link=<the raw
// token>` and a limited one to `?sent=1`. So the address bar said whether the
// limit bit, and a live link to a child's CV sat in the browser's history,
// its sync, and any screenshot of the address bar. The render and write
// suites load this and watch every response they are served:
//
//   · a Location header never carries a token in its query string or its
//     fragment, and never sends anyone to a /p/ page but the one they posted
//     from (request-access returns the requester to the page they are on);
//   · no link a served page carries (href, action, src) has a token in its
//     query string or fragment.
//
// A TOKEN, here, is what the product mints: 24 random bytes, base64url, 32
// characters (lib/link-switch, lib/send-dispatch). Matched by shape — 24 to 64
// characters of that alphabet with an upper-case letter or an underscore in
// it, which a random one has with odds of about 1 in 40 million of not having,
// and which no slug, uuid or hex hash has at all. This file cannot ask the
// database which strings are live links: the dev database serves one
// connection and the app holds it.
//
// THREE NAMED EXCEPTIONS, found when this check first ran (brief D's report,
// "Found"). Each shows a freshly made link ONCE, by carrying it in the
// address to the page that shows it — tokens are stored hashed (D-80), so the
// page has no other way to learn it. They are not an oracle (nothing is
// refused on those paths), but the token still reaches the history. Whether
// they stay is Leo's to decide; they are listed, not waved through.
export const SHOWN_ONCE = [
  { path: /^\/g\/controls\/[0-9a-f-]{36}\?link=/, what: 'a guardian issues or replaces a link (app/g/controls/[childId]/actions.ts)' },
  { path: /^\/g\/pending\/[0-9a-f-]{36}\?done=1&link=/, what: 'a guardian approves a first CV and its first link (app/g/pending/[recordId]/actions.ts)' },
  { path: /^\/send\/[0-9a-f-]{36}\?link=[^#]*#links$/, what: 'a player 16 or over makes a fresh link (app/send/[recordId]/actions.ts freshLink)' },
];

const TOKEN = /^[A-Za-z0-9_-]{24,64}$/;
export const looksLikeToken = (v) => TOKEN.test(v) && /[A-Z_]/.test(v);

/** Every token-shaped value in a URL's query string and fragment. */
export function tokensIn(url, base) {
  let u;
  try { u = new URL(url, base); } catch { return []; }
  const found = [];
  for (const [, v] of u.searchParams) if (looksLikeToken(v)) found.push(v);
  for (const part of u.hash.slice(1).split(/[&=/]/)) if (looksLikeToken(part)) found.push(part);
  return found;
}

/**
 * Wrap global fetch for the rest of the run, and record what every response
 * would put in an address bar. Returns the record and the judge.
 */
export function watchForTokens(base) {
  const seen = { redirects: 0, shownOnce: 0, pages: 0, leaks: [] };
  const inner = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const res = await inner(input, init);
    try {
      const reqUrl = new URL(typeof input === 'string' ? input : input.url, base);
      if (reqUrl.origin !== new URL(base).origin) return res;
      const method = (init?.method ?? 'GET').toUpperCase();
      const where = `${method} ${reqUrl.pathname}`;
      const loc = res.headers.get('location');
      if (loc) {
        seen.redirects += 1;
        const to = new URL(loc, reqUrl);
        const rel = to.pathname + to.search + to.hash;
        const shownOnce = SHOWN_ONCE.find((s) => s.path.test(rel));
        if (shownOnce && to.origin === reqUrl.origin) seen.shownOnce += 1;
        else if (tokensIn(rel, base).length) seen.leaks.push(`${where} → Location ${rel}`);
        if (to.pathname.startsWith('/p/') && !(method === 'POST' && to.pathname === reqUrl.pathname)) {
          seen.leaks.push(`${where} → Location to a share link ${to.pathname}`);
        }
      }
      // What the page links to. Not the development pages (/dev/outbox shows
      // every email, and an email's own links are not an address bar).
      if (/text\/html/.test(res.headers.get('content-type') ?? '') && !reqUrl.pathname.startsWith('/dev/')) {
        seen.pages += 1;
        const html = await res.clone().text();
        for (const m of html.matchAll(/\s(?:href|action|src)="([^"]+)"/g)) {
          const url = m[1].replace(/&amp;/g, '&');
          if (/^(\/(?!\/)|https?:\/\/(localhost[:/]|127\.0\.0\.1[:/]|(www\.)?pitchfootball\.com\.au\b))/.test(url)) {
            if (tokensIn(url, base).length) seen.leaks.push(`${where} links to ${url}`);
          }
        }
      }
    } catch { /* a response this cannot read is the suite's to fail, not this watcher's */ }
    return res;
  };
  return seen;
}
