'use client';
// On every page (doc 32 B4, B5): who we legally are, and a way to report a
// page without an account. The old coming-soon page carries its own footer.
import { usePathname } from 'next/navigation';
import { ENTITY_LINE } from '@/lib/entity';

export default function SiteFooter() {
  const path = usePathname();
  if (path === '/') return null;
  // Only public addresses go into a report. Many paths carry a secret — a
  // share token (/p/…), an approval code (/a/…), a reset or undo token — and
  // a report must never store one (0010). The CV page's own link sends the
  // token's hash instead.
  const safe = path && (/^\/(c|fc)\/[a-z0-9-]+$/.test(path) || ['/trials', '/jobs'].includes(path)) ? path : '';
  return (
    <footer className="site-foot">
      <div>{ENTITY_LINE}</div>
      <nav aria-label="Legal">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href={safe ? `/report?page=${encodeURIComponent(safe)}` : '/report'}>Report a page</a>
      </nav>
    </footer>
  );
}
