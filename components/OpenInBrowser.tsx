// Shown only when the page is open inside another app's browser (lib/
// in-app-browser). It never blocks: the page works where it is. It says what
// will not carry over, and offers the phone's own browser.
import { headers } from 'next/headers';
import CopyLink from '@/components/cv/CopyLink';
import { detectInAppBrowser, openInBrowserHref } from '@/lib/in-app-browser';
import { T } from '@/lib/palette';
import { card } from '@/lib/ui';

export default async function OpenInBrowser({ path }: { path: string }) {
  const h = await headers();
  const found = detectInAppBrowser(h.get('user-agent'));
  if (!found) return null;

  const base = process.env.NODE_ENV === 'production'
    ? (process.env.NEXT_PUBLIC_SITE_URL || 'https://pitchfootball.com.au')
    : `http://${h.get('host') ?? 'localhost:3000'}`;
  const url = new URL(path, base).toString();
  const open = openInBrowserHref(url, found.platform);
  const browser = found.platform === 'ios' ? 'Safari' : found.platform === 'android' ? 'Chrome' : 'your browser';

  return (
    <div role="note" data-in-app={found.app} style={{ ...card, border: `1px solid ${T.amber}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800 }}>You&rsquo;re inside {found.app}</div>
      <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
        This page works here. But if you sign in here, you&rsquo;ll be signed out again next time you open {browser}. Open it in {browser} to stay signed in.
      </div>
      {open && <a href={open} className="btn btn-secondary">Open in {browser}</a>}
      <CopyLink url={url} label="Copy the link" />
    </div>
  );
}
