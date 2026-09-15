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
    ...(seat.role === 'technical_director' || !verified ? [{ key: 'register', href: '/club/register', label: 'Interest register' }] : []),
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

// The coach's frame (BUZ, 15 Sep: "give coaches the sidebar now with what
// they can already do"). The coach's three doors from /home and nothing else.
// A squad view waits for Stage 2; registrations stay with the TD unless a
// D-number and John say otherwise. Home's precedence is mirrored exactly: a
// club seat outranks a coach seat, so a TD who also keeps a coach CV sees the
// club's frame on club screens and no frame here — the same doors /home gives.
export async function CoachConsole({ active, children }: {
  active: 'edit' | 'jobs' | 'register'; children: React.ReactNode;
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

  const items: Item[] = [
    { key: 'home', href: '/home', label: 'Home' },
    { key: 'edit', href: '/coach/edit', label: 'Edit my coach CV' },
    ...(seat.register_teams > 0 ? [{ key: 'register', href: '/coach/register', label: 'Registrations' }] : []),
    ...(seat.public_slug ? [{ key: 'public', href: `/c/${seat.public_slug}`, label: 'See my public page' }] : []),
    { key: 'jobs', href: '/jobs', label: 'Coaching roles at clubs' },
  ];
  const head = (
    <div>
      <div style={{ fontSize: 14.5, fontWeight: 900, lineHeight: 1.25 }}>{seat.first_name}</div>
      {seat.club && <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginTop: 2 }}>{seat.club}</div>}
    </div>
  );
  return <Frame label="Coach" head={head} items={items} active={active} floodlight>{children}</Frame>;
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
