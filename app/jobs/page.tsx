// The coaching jobs board (0019). D-100's first job for a coach's link is
// "applying to a club for a position" — this is the club-side half of that.
//
// Public and chronological. No recommender, no personalisation, ever — the
// same rule as the trials index (D-74), for the same reason.
import Link from 'next/link';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
};

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Coaching roles',
  description: 'Clubs hiring coaches. Posted by the club, chronological, nothing ranked.',
};

export default async function Jobs() {
  const roles = (await db.query(
    `select r.id, r.title, r.age_group, r.commitment, r.paid, r.closes_on,
       c.name as club, c.public_slug, c.club_state,
       (select count(*)::int from role_application ra where ra.role_id = r.id) as applications
     from coaching_role r join club c on c.id = r.club_id
     where r.closed_at is null
       and (r.closes_on is null or r.closes_on >= (now() at time zone 'Australia/Melbourne')::date)
     order by r.created_at desc`,
  )).rows as {
    id: string; title: string; age_group: string | null; commitment: string | null;
    paid: boolean; closes_on: string | null; club: string; public_slug: string | null;
    club_state: string; applications: number;
  }[];

  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        {/* The board opened with a title and then two cards in a lot of empty
            space. The number of open roles IS the news on this page. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: 'var(--ls-title)' }}>Coaching roles</h1>
            <div style={{ fontSize: 13.5, color: 'var(--secondary)', fontWeight: 500 }}>
              Clubs looking for coaches. Newest first — nothing here is ranked or recommended.
            </div>
          </div>
          {roles.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 26, flexWrap: 'wrap' }}>
              <div>
                <div className="numeral numeral-l" style={{ color: 'var(--ink)' }}>{roles.length}</div>
                <div className="kicker" style={{ marginTop: 6 }}>{roles.length === 1 ? 'Open role' : 'Open roles'}</div>
              </div>
              <div>
                <div className="numeral numeral-m" style={{ color: 'var(--accent)' }}>{roles.filter((r) => r.paid).length}</div>
                <div className="kicker" style={{ marginTop: 6 }}>Paid</div>
              </div>
              <div>
                <div className="numeral numeral-m" style={{ color: 'var(--secondary)' }}>{new Set(roles.map((r) => r.club)).size}</div>
                <div className="kicker" style={{ marginTop: 6 }}>Clubs</div>
              </div>
            </div>
          )}
        </div>

        {roles.length === 0 ? (
          <div style={{ ...card, fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
            No open roles right now. Clubs post here through the season, and most of it happens between September and December.
          </div>
        ) : roles.map((r) => (
          <Link key={r.id} href={`/jobs/${r.id}`} className="lift" style={{ ...card, display: 'flex', flexDirection: 'column', gap: 7, textDecoration: 'none', color: T.ink }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.015em' }}>{r.title}</div>
              <div style={{ background: r.paid ? 'rgba(61,220,132,.14)' : T.surface2, color: r.paid ? T.accent : T.muted, borderRadius: 7, padding: '4px 8px', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {r.paid ? 'Paid' : 'Volunteer'}
              </div>
            </div>
            <div style={{ fontSize: 13, color: T.secondary, fontWeight: 700 }}>
              {r.club}{r.club_state === 'verified' && <span style={{ color: T.accent, fontWeight: 700 }}> · Verified</span>}
            </div>
            <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>
              {[r.age_group, r.commitment].filter(Boolean).join(' · ') || 'Details inside'}
            </div>
          </Link>
        ))}

        <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, lineHeight: 1.55 }}>
          Applying sends the club your coaching CV and whatever you write. It does not send them your phone number or your email — if you want to be reached that way, say so in your message.
        </div>
        <Link href="/home" className="btn btn-ghost">Back</Link>
      </div>
    </div>
  );
}
