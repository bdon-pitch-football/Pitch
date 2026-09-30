// The public nav bar (D-173 change 3). Phone: the way back on the left and
// the logo on the right, as every screen has had it since 24 Aug. From
// 1024px the logo leads the bar and the links follow it — the layout a
// committee member on a laptop expects from any website.
//
// Plain <a>, not <Link>, for anything that lands on `/`: a prefetch skips
// proxy.ts, so it would fetch `/` as the coming-soon page (FrontDoor, 29 Sep).
import Wordmark from '@/components/Wordmark';

type NavLink = { href: string; label: string; current?: boolean };

export default function SiteNav({ back, links = [], overlay = false, signIn = true }: {
  back?: { href: string; label?: string };
  links?: NavLink[];
  overlay?: boolean;
  signIn?: boolean;
}) {
  return (
    <header className={`fl-nav${overlay ? ' fl-nav-overlay' : ''}`}>
      <div className="fl-wide fl-nav-in">
        <a href="/" className="fl-nav-brand" aria-label="Pitch, home"><Wordmark size={20} /></a>
        {links.length > 0 && (
          <nav className="fl-nav-links" aria-label="Pitch">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="fl-nav-link" aria-current={l.current ? 'page' : undefined}>{l.label}</a>
            ))}
          </nav>
        )}
        <div className="fl-nav-left">
          {back && (
            <a href={back.href} className="fl-nav-link fl-nav-back" style={{ paddingLeft: 0, color: 'var(--muted)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ marginRight: 6 }}><path d="M15 6 l-6 6 l6 6" /></svg>
              {back.label ?? 'Back'}
            </a>
          )}
          {signIn && <a href="/signin" className="fl-nav-link">Sign in</a>}
        </div>
      </div>
    </header>
  );
}
