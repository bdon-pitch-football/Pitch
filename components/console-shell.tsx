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

export type IconKey = 'home' | 'cv' | 'trials' | 'send' | 'roles' | 'register' | 'child' | 'children'
  | 'crest' | 'page' | 'card' | 'shield' | 'help' | 'more';
// short: the label a phone tab uses when the full one would wrap.
export type Item = { key: string; href: string; label: string; short?: string; icon?: IconKey };

// One stroke set for every frame, so the bar reads the same in every seat.
export const ICONS: Record<IconKey, React.ReactNode> = {
  home: <><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10.5V20h12v-9.5" /></>,
  cv: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  trials: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 11h18" /></>,
  send: <path d="M21 4 3 11l7 3 3 7 8-17Z" />,
  roles: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18" /></>,
  register: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></>,
  child: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" /></>,
  children: <><circle cx="9" cy="8.5" r="3" /><circle cx="17" cy="9.5" r="2.4" /><path d="M3 19c.9-3 3.2-4.6 6-4.6S14.1 16 15 19M16 14.2c2 .3 3.6 1.7 4.2 3.8" /></>,
  crest: <path d="M12 3 19 6v5c0 4.6-2.9 8.1-7 10-4.1-1.9-7-5.4-7-10V6Z" />,
  page: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" /></>,
  card: <><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  shield: <><path d="M12 3 19 6v5c0 4.6-2.9 8.1-7 10-4.1-1.9-7-5.4-7-10V6Z" /><path d="m9 12 2 2 4-4.5" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6M12 17h.01" /></>,
  more: <><circle cx="5.5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18.5" cy="12" r="1.2" /></>,
};

const Glyph = ({ k, on, size }: { k: IconKey; on: boolean; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={on ? 'var(--accent)' : 'var(--muted)'}
    strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS[k]}</svg>
);

// bar: the phone half of the frame (D-147 as amended 16 Sep). Under 1024 the
// sidebar does not render, so a seat with a bar carries the SAME items along
// the bottom — never a subset, never a superset. At most four, which is why
// the club and operator frames, with more doors than that, stay rail-only.
export function Frame({ label, head, items, active, floodlight, bar, children }: {
  label: string; head: React.ReactNode; items: Item[]; active: string;
  floodlight?: boolean; bar?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={floodlight ? 'floodlight' : undefined}
      style={{ minHeight: '100dvh', background: floodlight ? undefined : 'var(--bg)', color: 'var(--ink)', display: 'flex', justifyContent: 'center' }}>
      <div className={bar ? 'console-frame seat-frame' : 'console-frame'}>
        <nav className="console-nav" aria-label={label}>
          <div style={{ padding: '4px 10px 18px 10px' }}>{head}</div>
          {items.map((it) => (
            <Link key={it.key} href={it.href} className="console-nav-link"
              aria-current={it.key === active ? 'page' : undefined}>
              {it.icon && <Glyph k={it.icon} on={it.key === active} size={18} />}
              {it.label}
            </Link>
          ))}
        </nav>
        <div className="console-main">{children}</div>
      </div>
      {bar && (() => {
        // Four fit. More than four: the first three, and More opening the
        // rest in a sheet — every rail door is still here, one tap deeper
        // (D-147 as amended 16 Sep). A <details>, so it works without
        // JavaScript; More reads as current when the page is in the sheet.
        const tabs = items.length > 4 ? items.slice(0, 3) : items;
        const rest = items.length > 4 ? items.slice(3) : [];
        const inRest = rest.some((it) => it.key === active);
        return (
          <nav className="seat-tabs" aria-label={`${label} bar`}>
            {tabs.map((it) => (
              <Link key={it.key} href={it.href} className="seat-tab" aria-label={it.short ? it.label : undefined}
                aria-current={it.key === active ? 'page' : undefined}>
                {it.icon && <Glyph k={it.icon} on={it.key === active} size={21} />}
                <span>{it.short ?? it.label}</span>
              </Link>
            ))}
            {rest.length > 0 && (
              <details className="seat-more">
                <summary className="seat-tab" data-current={inRest ? 'true' : undefined}>
                  <Glyph k="more" on={inRest} size={21} />
                  <span>More</span>
                </summary>
                <div className="seat-sheet">
                  {rest.map((it) => (
                    <Link key={it.key} href={it.href} className="seat-sheet-link"
                      aria-current={it.key === active ? 'page' : undefined}>
                      {it.icon && <Glyph k={it.icon} on={it.key === active} size={19} />}
                      <span>{it.label}</span>
                    </Link>
                  ))}
                </div>
              </details>
            )}
          </nav>
        );
      })()}
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
    { key: 'home', href: '/home', label: 'Home', icon: 'home' },
    ...(seat.role === 'technical_director' || !verified ? [{ key: 'register', href: '/club/register', label: 'Interest register', short: 'Register', icon: 'register' as const }] : []),
    { key: 'squads', href: '/club/squads', label: 'Squads & age groups', short: 'Squads', icon: 'children' },
    { key: 'page-edit', href: '/club/page-edit', label: 'Crest & club page', short: 'Club page', icon: 'crest' },
    { key: 'roles', href: '/club/roles', label: 'Coaching roles', icon: 'roles' },
    ...(verified ? [{ key: 'post-trial', href: '/club/post-trial', label: 'Post a trial', icon: 'trials' as const }] : []),
    ...(seat.public_slug ? [{ key: 'public', href: `/fc/${seat.public_slug}`, label: 'Your club page', icon: 'page' as const }] : []),
    { key: 'billing', href: '/club/billing', label: 'Plan & billing', icon: 'card' },
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

  return <Frame label="Club" head={head} items={items} active={active} floodlight={floodlight} bar>{children}</Frame>;
}

// The coach's frame (BUZ, 15 Sep: "give coaches the sidebar now with what
// they can already do"). The coach's three doors from /home and nothing else.
// A squad view waits for Stage 2; registrations stay with the TD unless a
// D-number and John say otherwise. Home's precedence is mirrored exactly: a
// club seat outranks a coach seat, so a TD who also keeps a coach CV sees the
// club's frame on club screens and no frame here — the same doors /home gives.
export async function CoachConsole({ active, children }: {
  active: 'home' | 'edit' | 'jobs' | 'register'; children: React.ReactNode;
}) {
  const me = await getSessionPersonId();
  const seat = me ? (await db.query(
    `select p.first_name, cp.public_slug,
       (select c.name from membership m2 join club c on c.id = m2.club_id
        where m2.person_id = p.id and m2.role = 'coach' and m2.ended_at is null limit 1) as club,
       (select count(*)::int from register_grant g
        where g.person_id = p.id and g.revoked_at is null
          and g.squad_id in (select fn_register_grant_squads(p.id, g.club_id))) as register_teams
     from person p join coach_profile cp on cp.person_id = p.id
     where p.id = $1
       and not exists (select 1 from membership m where m.person_id = p.id
         and m.role in ('technical_director','club_admin') and m.ended_at is null)`,
    [me],
  )).rows[0] as { first_name: string; public_slug: string | null; club: string | null; register_teams: number } | undefined : undefined;

  if (!seat) {
    return (
      <div className="floodlight" style={{ minHeight: '100dvh', color: 'var(--ink)', display: 'flex', justifyContent: 'center' }}>
        {children}
      </div>
    );
  }

  // D-147 as amended 16 Sep: Home · My CV · Registrations · Roles, at both
  // widths. The public page stays a door on /home, not in the frame — five
  // doors do not fit a phone bar, and the frame may not differ by width.
  const items: Item[] = [
    { key: 'home', href: '/home', label: 'Home', icon: 'home' },
    { key: 'edit', href: '/coach/edit', label: 'My CV', icon: 'cv' },
    ...(seat.register_teams > 0 ? [{ key: 'register', href: '/coach/register', label: 'Registrations', icon: 'register' as const }] : []),
    { key: 'jobs', href: '/jobs', label: 'Roles', icon: 'roles' },
  ];
  const head = (
    <div>
      <div style={{ fontSize: 14.5, fontWeight: 900, lineHeight: 1.25 }}>{seat.first_name}</div>
      {seat.club && <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginTop: 2 }}>{seat.club}</div>}
    </div>
  );
  return <Frame label="Coach" head={head} items={items} active={active} floodlight bar>{children}</Frame>;
}

export function OpsConsole({ active, children }: {
  active: 'verification' | 'support'; children: React.ReactNode;
}) {
  const items: Item[] = [
    { key: 'home', href: '/home', label: 'Home', icon: 'home' },
    { key: 'verification', href: '/ops/verification', label: 'Verification', icon: 'shield' },
    { key: 'support', href: '/ops/support', label: 'Support', icon: 'help' },
  ];
  const head = <div className="kicker">Operator</div>;
  return <Frame label="Operator" head={head} items={items} active={active} floodlight bar>{children}</Frame>;
}
