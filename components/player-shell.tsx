// The player's frame (BUZ, 16 Sep). Until now every signed-in player screen
// was an island: a title, a back link, and no way to anywhere else. A player
// on a phone got no bar, and on a laptop a 640px column in the middle of an
// empty window while the club seat had a console.
//
// SAME RULE AS THE CLUB CONSOLE (D-147): the frame is a second way to the
// SAME doors /home offers this seat, never a new door — a capability at one
// width and not the other is a permission surface nobody tested. The render
// suite checks this list against /home's links.
//
// Below 1024 the frame is a bar along the bottom; at 1024 and up it is the
// console rail. Both render the same four doors, in the same order.
import Link from 'next/link';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';

export type PlayerTab = 'home' | 'cv' | 'trials' | 'send';

type Seat = { first_name: string; photo_path: string | null; record_id: string | null; club: string | null };

export async function getPlayerSeat(): Promise<Seat | null> {
  const me = await getSessionPersonId();
  if (!me) return null;
  // A player seat is a person with a record of their own and no children on
  // their account — the same test /home applies before it draws this seat.
  const { rows } = await db.query(
    `select p.first_name, p.photo_path,
       (select id from development_record where person_id = p.id) as record_id,
       (select c.name from membership m join club c on c.id = m.club_id
         where m.person_id = p.id and m.role = 'player' and m.ended_at is null limit 1) as club,
       exists(select 1 from guardianship_link g where g.guardian_id = p.id
         and g.approved_at is not null and g.revoked_at is null) as has_children,
       exists(select 1 from membership m2 where m2.person_id = p.id
         and m2.role in ('technical_director','club_admin','coach') and m2.ended_at is null) as has_seat
     from person p where p.id = $1`,
    [me],
  );
  const r = rows[0];
  if (!r || !r.record_id || r.has_children || r.has_seat) return null;
  return { first_name: r.first_name, photo_path: r.photo_path, record_id: r.record_id, club: r.club };
}

const ICON = {
  home: <><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10.5V20h12v-9.5" /></>,
  cv: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  trials: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 11h18" /></>,
  send: <path d="M21 4 3 11l7 3 3 7 8-17Z" />,
};

function items(recordId: string): { key: PlayerTab; href: string; label: string; icon: React.ReactNode }[] {
  return [
    { key: 'home', href: '/home', label: 'Home', icon: ICON.home },
    { key: 'cv', href: `/build/${recordId}`, label: 'My CV', icon: ICON.cv },
    { key: 'trials', href: '/trials', label: 'Trials', icon: ICON.trials },
    { key: 'send', href: `/send/${recordId}`, label: 'Send', icon: ICON.send },
  ];
}

/** The frame. With no player seat it renders the page exactly as it was. */
export async function PlayerFrame({ active, children }: { active: PlayerTab; children: React.ReactNode }) {
  const seat = await getPlayerSeat();
  // No player seat — a guardian on their child's build or send screen, or a
  // signed-out visitor on the public board. They get no frame, and the page
  // keeps the wrapper it always had: nobody loses a background because the
  // frame is not theirs.
  if (!seat?.record_id) {
    return (
      <div className="floodlight" style={{ minHeight: '100dvh', color: 'var(--ink)', display: 'flex', justifyContent: 'center' }}>
        {children}
      </div>
    );
  }
  const tabs = items(seat.record_id);
  const initial = seat.first_name?.[0] ?? 'P';

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: 'var(--ink)', display: 'flex', justifyContent: 'center' }}>
      <div className="console-frame player-frame">
        <nav className="console-nav" aria-label="Player">
          <div style={{ padding: '4px 10px 18px 10px', display: 'flex', alignItems: 'center', gap: 11 }}>
            {seat.photo_path ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={seat.photo_path} alt="" width={40} height={40} style={{ borderRadius: 999, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div aria-hidden style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'var(--secondary)', flexShrink: 0 }}>{initial}</div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 'var(--ls-title)' }}>{seat.first_name}</div>
              {seat.club && <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seat.club}</div>}
            </div>
          </div>
          {tabs.map((t) => (
            <Link key={t.key} href={t.href} className="console-nav-link" aria-current={t.key === active ? 'page' : undefined}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.key === active ? 'var(--accent)' : 'var(--muted)'} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{t.icon}</svg>
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="console-main">{children}</div>
      </div>

      {/* The phone bar. Same four doors, same order. */}
      <nav className="player-tabs" aria-label="Player bar">
        {tabs.map((t) => (
          <Link key={t.key} href={t.href} className="player-tab" aria-current={t.key === active ? 'page' : undefined}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={t.key === active ? 'var(--accent)' : 'var(--muted)'} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{t.icon}</svg>
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
