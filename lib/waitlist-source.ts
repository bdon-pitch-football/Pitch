// Which paid ad a waitlist sign-up came from (BUZ, 17 Sep). Campaign tags
// only — the utm values in the ad's own link — never anything about the
// person. Pure, so it can be tested without a request or a database.
//
// The client sends whatever the URL said; nothing here trusts it. A value is
// kept only if it is a short lowercase slug, and anything else is dropped.
// No utm_source means plain 'web', exactly as before.
//   web:meta:vic-prelaunch:players-video

const TAG_RE = /^[a-z0-9_-]{1,40}$/;

function tag(v: unknown): string | null {
  return typeof v === 'string' && TAG_RE.test(v) ? v : null;
}

export function waitlistSource(body: {
  utm_source?: unknown;
  utm_campaign?: unknown;
  utm_content?: unknown;
}): string {
  const source = tag(body.utm_source);
  if (!source) return 'web';
  const parts = [source, tag(body.utm_campaign), tag(body.utm_content)].filter(Boolean);
  return `web:${parts.join(':')}`;
}
