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
import { requireOperator } from '@/lib/ops-guard';
import { clubsScreensShown } from '@/lib/ops-policy';
import Wordmark, { HeaderMark } from '@/components/Wordmark';
import SiteNav from '@/components/floodlit/SiteNav';

export type IconKey = 'home' | 'cv' | 'trials' | 'send' | 'roles' | 'register' | 'child' | 'children'
  | 'crest' | 'page' | 'card' | 'shield' | 'help' | 'more' | 'power' | 'flag' | 'clip' | 'star';
// short: the label a phone tab uses when the full one would wrap.
// count: a number the rail shows beside the door (OpsVerification.dc.html:
// "Verification 3", "Reports 1"). Never zero (D-162): a door with nothing
// behind it carries no number rather than a 0.
export type Item = { key: string; href: string; label: string; short?: string; icon?: IconKey; count?: number };

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
  flag: <><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>,
  power: <><path d="M12 3v8" /><path d="M6.4 6.9a8 8 0 1 0 11.2 0" /></>,
  more: <><circle cx="5.5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18.5" cy="12" r="1.2" /></>,
  // The player's door list (spec A part 13): Highlights and Achievements.
  clip: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9 5 3-5 3Z" /></>,
  star: <path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6Z" />,
};

// The current door's glyph is ink, not green: green is an action and "you
// are here" is a state (D-173 (4), spec A part 2) — in the bar, the rail and
// the sheet alike.
const Glyph = ({ k, on, size }: { k: IconKey; on: boolean; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={on ? 'var(--ink)' : 'var(--muted)'}
    strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS[k]}</svg>
);

// bar: the phone half of the frame (D-147 as amended 16 Sep). Under 1024 the
// sidebar does not render, so a seat with a bar carries the SAME items along
// the bottom — never a subset, never a superset. At most four, which is why
// the club and operator frames, with more doors than that, stay rail-only.
//
// Every seat's frame paints the floodlight (spec A part 1): the club frame
// was the only one that could render without it, so `floodlight` is no
// longer a choice. The prop stays as a no-op until its callers are tidied.
//
// THE RAIL (spec A part 4): from 1024px it opens with the rail mark — the
// logo, top left (D-173 (3)) — above the seat card. The mark is NOT a link:
// HeaderMark's mark is not one, and a link to / would be a new door. The page
// header drops its own copy of the mark at the same breakpoint (globals.css,
// SHELLS part 6), so a framed page shows exactly one logo at every width.
export function Frame({ label, head, items, active, bar, children }: {
  label: string; head: React.ReactNode; items: Item[]; active: string;
  /** @deprecated every frame paints the floodlight now (spec A part 1). */
  floodlight?: boolean; bar?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="floodlight"
      style={{ minHeight: '100dvh', color: 'var(--ink)', display: 'flex', justifyContent: 'center' }}>
      <div className={bar ? 'console-frame seat-frame' : 'console-frame'}>
        <nav className="console-nav" aria-label={label}>
          <div className="rail-mark"><Wordmark size={20} /></div>
          <div className="seat-card">{head}</div>
          {items.map((it) => (
            <Link key={it.key} href={it.href} className="console-nav-link"
              aria-current={it.key === active ? 'page' : undefined}>
              {it.icon && <Glyph k={it.icon} on={it.key === active} size={18} />}
              {it.label}
              {it.count ? <span className="console-nav-count">{it.count}</span> : null}
            </Link>
          ))}
          <Link href="/signout" prefetch={false} className="console-nav-link" style={{ marginTop: 'auto' }}>Sign out</Link>
        </nav>
        <div className="console-main">{children}</div>
      </div>
      {bar && (() => {
        // Four fit. More than four: the first three, and More opening the
        // rest in a sheet — every rail door is still here, one tap deeper
        // (D-147 as amended 16 Sep). A <details>, so it works without
        // JavaScript; More reads as current when the page is in the sheet.
        // SIGN OUT LIVES HERE, for every seat, at every width (BUZ, 28 Sep).
        //
        // Until today it was linked from exactly ONE screen — inside the branch
        // that only renders for a parent with no children linked — so a player,
        // a coach, a technical director, an administrator, an operator and any
        // parent WITH a child had no way to sign out at all. 0062 made a session
        // a revocable row and sign-out the thing that revokes it; a door with no
        // handle is not a door, and the person who needs it most is the one who
        // has just realised somebody else is in their child's account.
        //
        // The threshold is 3 rather than 4 so the sheet always exists to hold
        // it: a seat with exactly four doors now shows three and a More.
        const tabs = items.length > 3 ? items.slice(0, 3) : items;
        const rest = items.length > 3 ? items.slice(3) : [];
        const inRest = rest.some((it) => it.key === active);
        return (
          <nav className="seat-tabs" aria-label={`${label} bar`}>
            {tabs.map((it) => (
              <Link key={it.key} href={it.href} className="seat-tab" aria-label={it.short ? it.label : undefined}
                aria-current={it.key === active ? 'page' : undefined}>
                {it.icon && <span className="seat-tab-ic"><Glyph k={it.icon} on={it.key === active} size={21} /></span>}
                <span>{it.short ?? it.label}</span>
              </Link>
            ))}
            {(
              <details className="seat-more">
                <summary className="seat-tab" data-current={inRest ? 'true' : undefined}>
                  <span className="seat-tab-ic"><Glyph k="more" on={inRest} size={21} /></span>
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
                  <Link href="/signout" prefetch={false} className="seat-sheet-link">
                    <span>Sign out</span>
                  </Link>
                </div>
              </details>
            )}
          </nav>
        );
      })()}
    </div>
  );
}

// THE TOP BAR (spec A part 5): every page that renders outside a seat frame
// carries the logo-only nav bar — top right on a phone, top left from 1024px
// (D-173 (3)) — and .has-topbar hides the page's own in-column mark, so no
// page shows two. homeLink={false}: none of these pages linked the mark
// anywhere, and a link to / would be a new door. The page's own header keeps
// its back link at every width (SiteNav's `back` is phone-only, which would
// make it a phone-only control, D-147).
export function TopBarShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="floodlight has-topbar" style={{ minHeight: '100dvh', color: 'var(--ink)', display: 'flex', flexDirection: 'column' }}>
      <SiteNav links={[]} signIn={false} homeLink={false} />
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>{children}</div>
    </div>
  );
}

export async function ClubConsole({ active, children }: {
  active: 'home' | 'register' | 'squads' | 'page-edit' | 'roles' | 'post-trial' | 'billing';
  /** @deprecated a no-op: every frame paints the floodlight (spec A part 1). */
  floodlight?: boolean; children: React.ReactNode;
}) {
  const me = await getSessionPersonId();
  // Same seat query as the pages' own gates and as /home. No seat, no
  // sidebar — the page has already redirected by the time this matters.
  const seat = me ? (await db.query(
    `select c.name, c.club_state, c.public_slug, m.role, fn_billing_enabled() as billing from club c
     join membership m on m.club_id = c.id and m.person_id = $1
       and m.role in ('technical_director','club_admin') and m.ended_at is null
     limit 1`,
    [me],
  )).rows[0] as { name: string; club_state: string; public_slug: string | null; role: string; billing: boolean } | undefined : undefined;

  if (!seat) return <TopBarShell>{children}</TopBarShell>;

  const verified = seat.club_state === 'verified';
  const items: Item[] = [
    { key: 'home', href: '/home', label: 'Home', icon: 'home' },
    ...(seat.role === 'technical_director' || !verified ? [{ key: 'register', href: '/club/register', label: 'Register', icon: 'register' as const }] : []),
    { key: 'squads', href: '/club/squads', label: 'Squads', icon: 'children' },
    { key: 'page-edit', href: '/club/page-edit', label: 'Crest & club page', short: 'Club page', icon: 'crest' },
    { key: 'roles', href: '/club/roles', label: 'Coaching roles', icon: 'roles' },
    ...(verified ? [{ key: 'post-trial', href: '/club/post-trial', label: 'Post a trial', icon: 'trials' as const }] : []),
    ...(seat.public_slug ? [{ key: 'public', href: `/fc/${seat.public_slug}`, label: 'Your club page', icon: 'page' as const }] : []),
    // D-163: free until further notice — no plan to show while billing is off (0075).
    ...(seat.billing ? [{ key: 'billing', href: '/club/billing', label: 'Plan & billing', icon: 'card' as const }] : []),
  ];

  // The seat card (spec A part 4): the crest tile, the club, the role, then
  // the state line as a pill — the same words, the same two conditions. The
  // long amber line wraps inside its pill (.pill-wrap).
  const head = (
    <>
      <div className="seat-card-id">
        <div style={{ width: 40, height: 40, borderRadius: 'var(--r-well)', background: 'rgba(255,255,255,.08)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, flexShrink: 0 }} aria-hidden>{seat.name[0]}</div>
        <div style={{ minWidth: 0 }}>
          <div className="seat-card-name">{seat.name}</div>
          <div className="seat-card-role">
            {seat.role === 'technical_director' ? 'Technical Director' : 'Club administrator'}
          </div>
        </div>
      </div>
      <span className={verified ? 'pill pill-live' : 'pill pill-wait pill-wrap'}>
        {verified ? 'Verified club' : 'Awaiting verification — registrations are held'}
      </span>
    </>
  );

  return <Frame label="Club" head={head} items={items} active={active} bar>{children}</Frame>;
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

  if (!seat) return <TopBarShell>{children}</TopBarShell>;

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
    <div style={{ minWidth: 0 }}>
      <div className="seat-card-name">{seat.first_name}</div>
      {seat.club && <div className="seat-card-role">{seat.club}</div>}
    </div>
  );
  return <Frame label="Coach" head={head} items={items} active={active} bar>{children}</Frame>;
}

// The operator's frame (OpsToday.dc.html, OpsVerification.dc.html, brief G).
// The rail head is the signed one — "Pitch operations" over the operator's
// own address — and two doors carry the number waiting behind them: clubs
// awaiting a call, and open reports. Both are counts; nothing here names a
// club, a family or a child. Today is the console's home (/ops).
//
// "Money" is in the signed rail and is NOT here: billing is off (D-163), and
// a door to nothing is a door nobody tested. Held for BUZ in brief G's report.
export async function OpsConsole({ active, children }: {
  active: 'today' | 'verification' | 'support' | 'switches' | 'reports' | 'clubs'; children: React.ReactNode;
}) {
  const { email } = await requireOperator();
  const n = (await db.query(
    `select (select count(*)::int from club where club_state = 'claimed') as awaiting,
       (select count(*)::int from report where actioned_at is null) as reports`,
  )).rows[0] as { awaiting: number; reports: number };
  const items: Item[] = [
    { key: 'today', href: '/ops', label: 'Today', icon: 'trials' },
    { key: 'verification', href: '/ops/verification', label: 'Verification', icon: 'shield', count: n.awaiting },
    { key: 'reports', href: '/ops/reports', label: 'Reports', icon: 'flag', count: n.reports },
    // Every club and the notices Pitch compiles (brief I, 0130). After
    // Reports, so the phone bar's three tabs are the ones they were. Held with
    // its words (lib/ops-policy): development only until BUZ approves them.
    ...(clubsScreensShown(process.env.NODE_ENV === 'production')
      ? [{ key: 'clubs', href: '/ops/clubs', label: 'Clubs', icon: 'crest' as const }] : []),
    // "Lookup", the signed design's word (BUZ, 29 Sep); the address is unchanged.
    { key: 'support', href: '/ops/support', label: 'Lookup', icon: 'help' },
    { key: 'switches', href: '/ops/switches', label: 'Emergency switches', short: 'Switches', icon: 'power' },
    // A-P9 (BUZ, 1 Oct): an operator's Home is the console. /home has no
    // operator branch, so an operator holding no other seat fell through to
    // the brand-new welcome ("Build a coach CV").
    { key: 'home', href: '/ops', label: 'Home', icon: 'home' },
  ];
  // The signed head keeps its own sizes (14px/800 over 11.5px/700); the
  // address wraps rather than truncates, as it always has.
  const head = (
    <div style={{ minWidth: 0 }}>
      <div className="seat-card-name" style={{ fontSize: 14, fontWeight: 800 }}>Pitch operations</div>
      <div className="seat-card-role" style={{ fontSize: 11.5, fontWeight: 700, marginTop: 3, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{email}</div>
    </div>
  );
  return <Frame label="Operator" head={head} items={items} active={active} bar>{children}</Frame>;
}

// The title row every operator screen opens with (the signed top bar: a
// 17px title, a muted line under it, an action at the right when there is
// one). The logo stays top right on every screen (charter), so the back link
// and the mark come first, as they do everywhere else in the product.
export function OpsHeader({ title, sub, back, action }: {
  title: React.ReactNode; sub?: React.ReactNode; back?: { href: string; label?: string }; action?: React.ReactNode;
}) {
  return (
    <>
      <HeaderMark back={back ?? { href: '/home' }} />
      <div className="ops-title">
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.25 }}>{title}</h1>
          {sub ? <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginTop: 2, lineHeight: 1.45 }}>{sub}</div> : null}
        </div>
        {action ? <div className="ops-title-action">{action}</div> : null}
      </div>
    </>
  );
}
