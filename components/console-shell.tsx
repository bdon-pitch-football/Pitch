// The console frame (D-147): "sidebar + content, max 1200px" at >=1024px.
//
// Below 1024 the sidebar does not render and the page is exactly what it was
// — its own header, its own back link, one column. At a laptop the TD works
// the register for an hour, and walking back through /home to get from the
// register to squads is the thing the sidebar removes.
//
// THE SIDEBAR IS A SECOND WAY TO THE SAME DOORS, NEVER A NEW DOOR. Every link
// here is a link /home already offers the same seat, with the same condition
// ("Post a trial" only once verified, "Your club page" only with a slug).
// D-147 forbids a desktop-only feature, because a capability on one width and
// not the other is a permission surface nobody tested. The render suite
// checks the two lists against each other.
import Link from 'next/link';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';

type Item = { key: string; href: string; label: string };

function Frame({ label, head, items, active, floodlight, children }: {
  label: string; head: React.ReactNode; items: Item[]; active: string;
  floodlight?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={floodlight ? 'floodlight' : undefined}
      style={{ minHeight: '100dvh', background: floodlight ? undefined : 'var(--bg)', color: 'var(--ink)', display: 'flex', justifyContent: 'center' }}>
      <div className="console-frame">
        <nav className="console-nav" aria-label={label}>
          <div style={{ padding: '4px 10px 18px 10px' }}>{head}</div>
          {items.map((it) => (
            <Link key={it.key} href={it.href} className="console-nav-link"
              aria-current={it.key === active ? 'page' : undefined}>
              {it.label}
            </Link>
          ))}
        </nav>
        <div className="console-main">{children}</div>
      </div>
    </div>
  );
}

export async function ClubConsole({ active, floodlight, children }: {
  active: 'register' | 'squads' | 'page-edit' | 'roles' | 'post-trial' | 'billing';
  floodlight?: boolean; children: React.ReactNode;
}) {
  const me = await getSessionPersonId();
  // Same seat query as the pages' own gates and as /home. No seat, no
  // sidebar — the page has already redirected by the time this matters.
  const seat = me ? (await db.query(
    `select c.name, c.club_state, c.public_slug, m.role from club c
     join membership m on m.club_id = c.id and m.person_id = $1
       and m.role in ('technical_director','club_admin') and m.ended_at is null
     limit 1`,
    [me],
  )).rows[0] as { name: string; club_state: string; public_slug: string | null; role: string } | undefined : undefined;

  if (!seat) {
    return (
      <div className={floodlight ? 'floodlight' : undefined}
        style={{ minHeight: '100dvh', background: floodlight ? undefined : 'var(--bg)', color: 'var(--ink)', display: 'flex', justifyContent: 'center' }}>
        {children}
      </div>
    );
  }

  const verified = seat.club_state === 'verified';
  const items: Item[] = [
    { key: 'home', href: '/home', label: 'Home' },
    { key: 'register', href: '/club/register', label: 'Interest register' },
    { key: 'squads', href: '/club/squads', label: 'Squads & age groups' },
    { key: 'page-edit', href: '/club/page-edit', label: 'Crest & club page' },
    { key: 'roles', href: '/club/roles', label: 'Coaching roles' },
    ...(verified ? [{ key: 'post-trial', href: '/club/post-trial', label: 'Post a trial' }] : []),
    ...(seat.public_slug ? [{ key: 'public', href: `/fc/${seat.public_slug}`, label: 'Your club page' }] : []),
    { key: 'billing', href: '/club/billing', label: 'Plan & billing' },
  ];

  const head = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.08)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16 }} aria-hidden>{seat.name[0]}</div>
      <div>
        <div style={{ fontSize: 14.5, fontWeight: 900, lineHeight: 1.25 }}>{seat.name}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginTop: 2 }}>
          {seat.role === 'technical_director' ? 'Technical Director' : 'Club administrator'}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 6, height: 6, borderRadius: 999, background: verified ? 'var(--accent)' : 'var(--amber)', flexShrink: 0 }} />
        <div style={{ fontSize: 11, fontWeight: 800, color: verified ? 'var(--accent)' : 'var(--amber)', lineHeight: 1.35 }}>
          {verified ? 'Verified club' : 'Awaiting verification — registrations are held'}
        </div>
      </div>
    </div>
  );

  return <Frame label="Club" head={head} items={items} active={active} floodlight={floodlight}>{children}</Frame>;
}

export function OpsConsole({ active, children }: {
  active: 'verification' | 'support'; children: React.ReactNode;
}) {
  const items: Item[] = [
    { key: 'home', href: '/home', label: 'Home' },
    { key: 'verification', href: '/ops/verification', label: 'Verification' },
    { key: 'support', href: '/ops/support', label: 'Support' },
  ];
  const head = <div className="kicker">Operator</div>;
  return <Frame label="Operator" head={head} items={items} active={active} floodlight>{children}</Frame>;
}
