// The coaching jobs board (0019). D-100's first job for a coach's link is
// "applying to a club for a position" — this is the club-side half of that.
//
// Public and chronological. No recommender, no personalisation, ever — the
// same rule as the trials index (D-74), for the same reason.
import Link from 'next/link';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';
import { CoachConsole } from '@/components/console-shell';
import SiteNav from '@/components/floodlit/SiteNav';
import { getSessionPersonId } from '@/lib/session';
import PublicAnalytics from '@/components/PublicAnalytics';

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
     -- The board is the database's answer (0151): open, not past its
     -- closing day, and none at all from a suspended club, of any class.
     from fn_coaching_roles_advertised() r join club c on c.id = r.club_id
     order by r.created_at desc`,
  )).rows as {
    id: string; title: string; age_group: string | null; commitment: string | null;
    paid: boolean; closes_on: string | null; club: string; public_slug: string | null;
    club_state: string; applications: number;
  }[];

  // Floodlit (spec E, BUZ 1 Oct): the trials board's parts. E2: .fl-wide,
  // and from 1024 the numbers sit beside the title and the roles go two-up.
  // The numbers are ink: a paid role is not a better role (green is an
  // action). "Paid" and "Volunteer" are the same neutral pill. EC1: the
  // "This sends…" note is gone — nothing on this page sends; the role page
  // says it under the form that does.
  const me = await getSessionPersonId();
  const board = (
    <main className="fl-wide jb">
      <HeaderMark />
      <div className="jb-head">
        <div className="pg-titles">
          <h1 className="pg-title">Coaching roles</h1>
          <div className="pg-sub" style={{ fontSize: 13.5 }}>
            Clubs looking for coaches. Newest first — nothing here is ranked or recommended.
          </div>
        </div>
        {/* The number of open roles IS the news on this page. Never a zero:
            an empty board shows no numbers at all. */}
        {roles.length > 0 && (
          <div className="stat-row">
            <div>
              <div className="numeral numeral-l" style={{ color: 'var(--ink)' }}>{roles.length}</div>
              <div className="stat-l">{roles.length === 1 ? 'Open role' : 'Open roles'}</div>
            </div>
            <div>
              <div className="numeral numeral-m" style={{ color: 'var(--ink)' }}>{roles.filter((r) => r.paid).length}</div>
              <div className="stat-l">Paid</div>
            </div>
            <div>
              <div className="numeral numeral-m" style={{ color: 'var(--secondary)' }}>{new Set(roles.map((r) => r.club)).size}</div>
              <div className="stat-l">Clubs</div>
            </div>
          </div>
        )}
      </div>

      {roles.length === 0 ? (
        <div className="card empty">
          <span className="empty-tile" aria-hidden />
          <div className="empty-b">
            <span className="empty-t">No open roles right now.</span> Clubs post here through the season, and most of it happens between September and December.
          </div>
        </div>
      ) : (
        <div className="jobs">
          {roles.map((r) => (
            <Link key={r.id} href={`/jobs/${r.id}`} className="card row jr lift">
              <div className="row-main" style={{ gap: 4 }}>
                <div className="jr-t">{r.title}</div>
                <div className="jr-club">{r.club}{r.club_state === 'verified' && <span className="jr-v"> · Verified</span>}</div>
                <div className="row-s">{[r.age_group, r.commitment].filter(Boolean).join(' · ') || 'Details inside'}</div>
              </div>
              <div className="jr-end">
                <span className="pill">{r.paid ? 'Paid' : 'Volunteer'}</span>
                <span className="row-chev">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="jb-foot">
        <Link href="/home" className="btn btn-ghost">Back</Link>
      </div>
    </main>
  );

  // One of the four pages analytics may count (lib/analytics-scope). Beside
  // the console, not in it: the shell lays its children in a row (L3).
  // E4 (BUZ, 1 Oct): signed out, the public nav bar (Find your club ·
  // Trials · Sign in) and a logo that goes home, as on the trials board. A
  // coach seat keeps the coach's frame; any other seat the logo-only top bar.
  return (
    <>
    {me ? (
      <CoachConsole active="jobs">{board}</CoachConsole>
    ) : (
      <div className="floodlight has-topbar" style={{ minHeight: '100dvh', color: 'var(--ink)', display: 'flex', flexDirection: 'column' }}>
        <SiteNav links={[{ href: '/claim', label: 'Find your club' }, { href: '/trials', label: 'Trials' }]} />
        {board}
      </div>
    )}
    <PublicAnalytics />
    </>
  );
}
