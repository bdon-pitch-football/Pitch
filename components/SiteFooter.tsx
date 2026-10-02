'use client';
// On every page (doc 32 B4, B5): who we legally are, and a way to report a
// page without an account. The old coming-soon page carries its own footer.
import { usePathname } from 'next/navigation';
import { ENTITY_LINE } from '@/lib/entity';

// Signed-in screens carry the footer without the entity line (BUZ, 30 Sep:
// option 1). Doc 32 B5 asks that the SITE names the legal person: the public
// pages, the front page and every legal page still do. B4's "Report a page"
// stays on every page.
const SIGNED_IN = ['/home', '/build', '/coach', '/club', '/ops', '/g/', '/squad', '/manage', '/registers', '/send', '/share-card', '/register-interest'];
export const showsEntity = (path: string | null): boolean =>
  !SIGNED_IN.some((p) => path === p || path?.startsWith(p.endsWith('/') ? p : `${p}/`));

export default function SiteFooter({ onFrontPage = false }: { onFrontPage?: boolean }) {
  const path = usePathname();
  // `/` is either the front door or the old coming-soon page, and the old page
  // carries its own footer. So the layout's footer stays off `/`, and the front
  // door renders this one itself (onFrontPage).
  if (path === '/' && !onFrontPage) return null;
  // Only public addresses go into a report. Many paths carry a secret — a
  // share token (/p/…), an approval code (/a/…), a reset or undo token — and
  // a report must never store one (0010). The CV page's own link sends the
  // token's hash instead.
  const safe = path && (/^\/(c|fc)\/[a-z0-9-]+$/.test(path) || ['/trials', '/jobs'].includes(path)) ? path : '';
  return (
    <footer className="site-foot">
      {showsEntity(path) && <div>{ENTITY_LINE}</div>}
      <nav aria-label="Legal">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href={safe ? `/report?page=${encodeURIComponent(safe)}` : '/report'}>Report a page</a>
      </nav>
    </footer>
  );
}
