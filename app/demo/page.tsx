// The demo's front door (BUZ, 19 Sep): pick a seat, one tap, no password.
// Exists only when the app was started by `npm run demo` (lib/demo).
import { notFound } from 'next/navigation';
import { HeaderMark } from '@/components/Wordmark';
import { db } from '@/lib/db';
import { isDemo } from '@/lib/demo';
import { T } from '@/lib/palette';
import { card, sectionLabel } from '@/lib/ui';
import { takeSeat } from './actions';
import { SEATS } from './seats';

export const metadata = { title: 'Demo', robots: { index: false, follow: false } };

export default async function Demo() {
  if (!isDemo()) notFound();
  const club = (await db.query(
    `select name, public_slug from club where crest_path like '/dev-uploads/demo-crest-%' limit 1`,
  )).rows[0] as { name: string; public_slug: string } | undefined;
  const name = club?.name ?? 'Your club';

  const open: [string, string, string][] = [
    [`/fc/${club?.public_slug ?? ''}`, `${name}’s page`, 'What families see before they register interest.'],
    ['/trials', 'The trials board', 'Every trial, filtered by age group, gender and position.'],
    ['/p/dev-deniz', 'A player’s CV', 'What reaches the club when a family sends it.'],
    ['/dev/outbox', 'What families receive', 'The texts and emails Pitch sends, word for word.'],
  ];

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 40px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em', textWrap: 'balance' }}>Pitch for {name}</h1>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500 }}>Choose a seat. You can switch at any time from the bar at the top.</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={sectionLabel}>Sign in as</div>
          {SEATS.map((s) => (
            <form key={s.key} action={takeSeat}>
              <input type="hidden" name="seat" value={s.key} />
              <button type="submit" style={{ ...card, width: '100%', textAlign: 'left', cursor: 'pointer', color: T.ink, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 12, minHeight: 64 }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.accent }}>{s.who}</span>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>{s.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.secondary, lineHeight: 1.45 }}>{s.what}</span>
                </span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6 l6 6 -6 6" /></svg>
              </button>
            </form>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={sectionLabel}>Open without signing in</div>
          {open.map(([href, title, what]) => (
            <a key={href} href={href} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 3, textDecoration: 'none', color: T.ink, minHeight: 44 }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{title}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: T.secondary }}>{what}</span>
            </a>
          ))}
        </div>

        <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
          Every player, parent and coach here is made up. Nothing in this demo sends an email or a text, or takes a payment.
        </div>
      </div>
    </div>
  );
}
