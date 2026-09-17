// The player's and the parent's frames (D-147, amended 16 Sep). Until then
// every signed-in screen outside the club console was an island: a title, a
// back link, and no way anywhere else — no bar on a phone, and at a laptop a
// 640px column beside a void.
//
// The frame is a second way to the SAME doors that seat's /home offers,
// never a new door, and the phone bar and the laptop rail carry the same
// ones (constraint 3). The render suite checks both against /home.
//
// Which frame a person gets follows /home's own precedence exactly: a club
// seat, then a coach seat, then a parent, then a player. A club or coach
// seat gets its own console on its own screens and no frame here.
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { Frame, type Item } from '@/components/console-shell';

export type PlayerTab = 'home' | 'cv' | 'trials' | 'send';

type Child = { id: string; firstName: string };
type Seat =
  | { kind: 'player'; first_name: string; photo_path: string | null; record_id: string; club: string | null; can_send: boolean }
  | { kind: 'guardian'; first_name: string; children: Child[] }
  | null;

async function resolveSeat(): Promise<Seat> {
  const me = await getSessionPersonId();
  if (!me) return null;
  const { rows } = await db.query(
    `select p.first_name, p.photo_path,
       (select id from development_record where person_id = p.id) as record_id,
       (select c.name from membership m join club c on c.id = m.club_id
         where m.person_id = p.id and m.role = 'player' and m.ended_at is null limit 1) as club,
       exists(select 1 from membership m2 where m2.person_id = p.id
         and m2.role in ('technical_director','club_admin') and m2.ended_at is null) as club_seat,
       exists(select 1 from coach_profile cp where cp.person_id = p.id) as coach_seat,
       -- 0048: a 16-17 whose parent has not confirmed has no Send door.
       not (fn_age_band(p.dob) = '16_17' and not fn_has_approved_guardian(p.id)) as can_send,
       (select coalesce(json_agg(json_build_object('id', c.id, 'firstName', c.first_name) order by g.approved_at), '[]'::json)
          from guardianship_link g join person c on c.id = g.child_id
         where g.guardian_id = p.id and g.approved_at is not null and g.revoked_at is null) as children
     from person p where p.id = $1`,
    [me],
  );
  const r = rows[0];
  if (!r || r.club_seat || r.coach_seat) return null;
  const children = r.children as Child[];
  if (children.length > 0) return { kind: 'guardian', first_name: r.first_name, children };
  if (r.record_id) return { kind: 'player', first_name: r.first_name, photo_path: r.photo_path, record_id: r.record_id, club: r.club, can_send: r.can_send };
  return null;
}

/** No frame: the page keeps the wrapper it always had. */
const Plain = ({ children }: { children: React.ReactNode }) => (
  <div className="floodlight" style={{ minHeight: '100dvh', color: 'var(--ink)', display: 'flex', justifyContent: 'center' }}>
    {children}
  </div>
);

function playerFrame(seat: Extract<Seat, { kind: 'player' }>, active: string, children: React.ReactNode) {
  const items: Item[] = [
    { key: 'home', href: '/home', label: 'Home', icon: 'home' },
    { key: 'cv', href: `/build/${seat.record_id}`, label: 'My CV', icon: 'cv' },
    { key: 'trials', href: '/trials', label: 'Trials', icon: 'trials' },
    ...(seat.can_send ? [{ key: 'send', href: `/send/${seat.record_id}`, label: 'Send', icon: 'send' as const }] : []),
  ];
  const head = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      {seat.photo_path ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={seat.photo_path} alt="" width={40} height={40} style={{ borderRadius: 999, objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div aria-hidden style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'var(--secondary)', flexShrink: 0 }}>{seat.first_name?.[0] ?? 'P'}</div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 'var(--ls-title)' }}>{seat.first_name}</div>
        {seat.club && <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seat.club}</div>}
      </div>
    </div>
  );
  return <Frame label="Player" head={head} items={items} active={active} floodlight bar>{children}</Frame>;
}

function guardianFrame(seat: Extract<Seat, { kind: 'guardian' }>, active: string, children: React.ReactNode) {
  // One tab per child while they fit; past two, one tab to the list /home
  // already shows. A child's first name is already on the parent's home.
  const kids: Item[] = seat.children.length <= 2
    ? seat.children.map((c) => ({ key: `child:${c.id}`, href: `/g/controls/${c.id}`, label: c.firstName, icon: 'child' as const }))
    : [{ key: 'children', href: '/home#children', label: 'Children', icon: 'children' as const }];
  const items: Item[] = [
    { key: 'home', href: '/home', label: 'Home', icon: 'home' },
    ...kids,
    { key: 'trials', href: '/trials', label: 'Trials', icon: 'trials' },
  ];
  const head = (
    <div>
      <div style={{ fontSize: 14.5, fontWeight: 900, lineHeight: 1.25 }}>{seat.first_name}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginTop: 2 }}>Your family</div>
    </div>
  );
  // Collapsed to one Children tab, a child's own screen marks that tab.
  const current = seat.children.length > 2 && active.startsWith('child:') ? 'children' : active;
  return <Frame label="Parent" head={head} items={items} active={current} floodlight bar>{children}</Frame>;
}

/** A player's own screens. Anyone else keeps the plain page. */
export async function PlayerFrame({ active, children }: { active: PlayerTab; children: React.ReactNode }) {
  const seat = await resolveSeat();
  return seat?.kind === 'player' ? playerFrame(seat, active, children) : <Plain>{children}</Plain>;
}

/** A parent's own screens: home, or one child's controls ('child:<id>'). */
export async function GuardianFrame({ active, children }: { active: string; children: React.ReactNode }) {
  const seat = await resolveSeat();
  return seat?.kind === 'guardian' ? guardianFrame(seat, active, children) : <Plain>{children}</Plain>;
}

/** The trials board is a door in both the player's and the parent's frame. */
export async function TrialsFrame({ children }: { children: React.ReactNode }) {
  const seat = await resolveSeat();
  if (seat?.kind === 'player') return playerFrame(seat, 'trials', children);
  if (seat?.kind === 'guardian') return guardianFrame(seat, 'trials', children);
  return <Plain>{children}</Plain>;
}
