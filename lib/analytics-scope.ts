// Where Vercel Web Analytics may run, and nowhere else (brief C, 29 Sep).
//
// Analytics records the path of every page it counts. It used to be mounted
// in the root layout, so the day it was switched on in the Vercel dashboard it
// would have counted /p/<token> — a child's share link, in a third party's
// log — and every guardian, CV and signed-in page with it. Pillar zero 5 allows
// no analytics on minors (D-25), and D-94 §1 allows no token in any log.
//
// So it runs on four public, token-free marketing surfaces: the front door
// (the coming-soon page, and after the launch-day switch the product's front
// door, which proxy.ts serves at `/`), the trials board, the jobs board and a club's public page. Not a coach CV
// (a CV), not one job (a signed-in coach's form), not a club page's print view.
// components/PublicAnalytics mounts it on those four pages only, and only for
// a visitor with no session: a signed-in visitor may be a child we know is a
// child, and a count of them is an analytics event on a minor. This file is
// the belt behind that: once the script is in a tab it stays there across a
// client-side navigation, so every event it would send is checked against the
// same list, and anything off it is dropped rather than trimmed.
//
// No 'server-only': the browser runs analyticsBeforeSend, and the suites
// import this file directly.

const ALLOWED: RegExp[] = [
  /^\/$/,
  /^\/trials$/,
  /^\/jobs$/,
  /^\/fc\/[a-z0-9-]+$/,
];

/** True only for a path on the allowlist: exact, no trailing segment. */
export function analyticsAllowed(pathname: string): boolean {
  return ALLOWED.some((re) => re.test(pathname));
}

/**
 * The beforeSend hook for @vercel/analytics: an event whose page is off the
 * allowlist is dropped, and one that is on it goes with its path only — no
 * query string and no fragment, because a filter or a campaign tag is not
 * something we need to know.
 */
export function analyticsBeforeSend<E extends { url: string }>(event: E): E | null {
  let url: URL;
  try {
    url = new URL(event.url);
  } catch {
    return null;
  }
  if (!analyticsAllowed(url.pathname)) return null;
  return { ...event, url: `${url.origin}${url.pathname}` };
}
