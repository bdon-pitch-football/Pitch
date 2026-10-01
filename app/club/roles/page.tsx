// The club's coaching roles: post one, see who applied, close it. And, for
// the club's administrator, the Technical Director's row with the door that
// ends their access (0100, D-48, D-93) — see endTdAccess.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { ClubConsole } from '@/components/console-shell';
import { postRole, closeRole, endTdAccess } from './actions';
import { AdderSummary } from '@/components/club/Adder';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your coaching roles', robots: { index: false, follow: false } };

export default async function ClubRoles({ searchParams }: {
  searchParams: Promise<{ saved?: string; closed?: string; error?: string; ended?: string }>;
}) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const { saved, closed, error, ended } = await searchParams;

  const club = await db.query(
    `select c.id, c.name from club c
     join membership m on m.club_id = c.id and m.person_id = $1
       and m.role in ('technical_director','club_admin') and m.ended_at is null
     limit 1`,
    [me],
  );
  if (club.rows.length === 0) redirect('/home');
  const c = club.rows[0];

  // The Technical Director's row, for whoever the DATABASE says may end their
  // access (fn_may_end_td: the club's administrator — never the TD, a coach
  // or a team manager). Nobody else is shown it. Only the TD's own name comes
  // off it; nothing about any player does.
  const mayEndTd = (await db.query('select fn_may_end_td($1, $2) as m', [me, c.id])).rows[0]?.m === true;
  const liveTd = mayEndTd ? (await db.query(
    `select nullif(trim(p.first_name || ' ' || coalesce(p.last_name, '')), '') as name
     from membership m join person p on p.id = m.person_id
     where m.club_id = $1 and m.role = 'technical_director' and m.ended_at is null
     limit 1`,
    [c.id],
  )).rows[0] as { name: string | null } | undefined : undefined;
  // Whose access this administrator just ended — read from the audit row, so
  // the name never travels in the address bar.
  const endedTd = mayEndTd && ended ? (await db.query(
    `select nullif(trim(p.first_name || ' ' || coalesce(p.last_name, '')), '') as name
     from td_ending e join person p on p.id = e.person_id
     where e.club_id = $1 and e.cause = 'club_admin' and e.ended_by = $2
     order by e.id desc limit 1`,
    [c.id, me],
  )).rows[0] as { name: string | null } | undefined : undefined;

  const ages = (await db.query(`select code, label, stage from age_group order by sort`)).rows as
    { code: string; label: string; stage: string }[];
  const stages = [...new Set(ages.map((a) => a.stage))];
  const STAGE_LABEL: Record<string, string> = { miniroos: 'MiniRoos', junior: 'Juniors', youth: 'Youth', senior: 'Seniors' };

  const roles = (await db.query(
    `select id, title, age_group, commitment, paid, closes_on, closed_at,
       (select count(*)::int from role_application ra where ra.role_id = r.id) as applications
     from coaching_role r where club_id = $1 order by closed_at nulls first, created_at desc`,
    [c.id],
  )).rows as {
    id: string; title: string; age_group: string | null; commitment: string | null;
    paid: boolean; closes_on: string | null; closed_at: string | null; applications: number;
  }[];

  // Applicants come from the Postgres function, which checks this person
  // administers this club before it returns a single name.
  const withApplicants = await Promise.all(roles.map(async (r) => ({
    role: r,
    applicants: (await db.query(`select * from fn_role_applications($1,$2)`, [me, r.id])).rows as
      { application_id: string; coach_name: string; coach_slug: string | null; message: string | null }[],
  })));

  const open = roles.filter((r) => !r.closed_at).length;

  return (
    <ClubConsole active="roles">
      <div className="console cc-page">
        <HeaderMark />
        <div className="pg-titles" style={{ gap: 2 }}>
          <h1 className="pg-title">Coaching roles</h1>
          {/* P2 (BUZ, 1 Oct): "· 0 open" is not printed. */}
          <div className="pg-sub" style={{ fontSize: 13.5 }}>{c.name}{open > 0 && <> · <b style={{ color: 'var(--ink)' }}>{open} open</b></>}</div>
        </div>

        {saved && <div className="cc-said cc-said-ok">Posted. It&rsquo;s on the board now.</div>}
        {closed && <div className="cc-said">Closed. Coaches who put their name forward are still listed below.</div>}
        {error && <div className="cc-said cc-said-warn">Give the role a title.</div>}
        {/* BUZ's words, approved 29 Sep (docs/team/APPROVALS-28-SEP.md). */}
        {endedTd?.name && (
          <div className="cc-said">
            {endedTd.name} no longer sees the register, the squads or any player&rsquo;s record. To name a new Technical Director, ring Pitch.
          </div>
        )}

        {/* "Post a role" folds behind one chip, and opens by itself when the
            club has no roles (F). Its heading is the summary: said once. */}
        <details className="cc-adder" open={roles.length === 0 || Boolean(error)}>
          <AdderSummary>Post a role</AdderSummary>
          <form action={postRole} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <label className="field">
              <div className="field-label">Role</div>
              <input name="title" aria-label="Role" placeholder="Head Coach — U14 Boys" required maxLength={80} />
            </label>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: 1, minWidth: 150 }}>
                <div className="field-label">Age group</div>
                <select name="ageGroup" aria-label="Age group" defaultValue="">
                  <option value="">Not specific</option>
                  {stages.map((st) => (
                    <optgroup key={st} label={STAGE_LABEL[st] ?? st}>
                      {ages.filter((a) => a.stage === st).map((a) => <option key={a.code} value={a.code}>{a.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <label className="field" style={{ flex: 1, minWidth: 150 }}>
                <div className="field-label">Commitment</div>
                <input name="commitment" aria-label="Commitment" placeholder="Tue & Thu, 6–7:30pm" maxLength={120} />
              </label>
              <label className="field" style={{ flex: 1, minWidth: 130 }}>
                <div className="field-label">Closes</div>
                <input name="closesOn" aria-label="Closes" type="date" />
              </label>
            </div>
            <label className="field">
              <div className="field-label">About the role</div>
              <textarea name="detail" aria-label="About the role" rows={4} maxLength={1500} placeholder="What the squad is, what you're after, and what the club offers." />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, minHeight: 44, fontSize: 13.5, fontWeight: 700, color: 'var(--secondary)', cursor: 'pointer' }}>
              <input type="checkbox" name="paid" aria-label="Paid role" style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
              This role is paid
            </label>
            <button type="submit" className="btn btn-primary btn-auto-wide">Post it</button>
          </form>
        </details>

        {/* One panel per role, drawn as the jobs board draws a role: the
            title, the Paid/Volunteer pill (neutral, E) and the line. */}
        {withApplicants.map(({ role: r, applicants }) => (
          <div key={r.id} className={r.closed_at ? 'card jr closed' : 'card jr'}>
            <div className="jr-top">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <div className="jr-t">{r.title}</div>
                <span className="pill" style={{ alignSelf: 'flex-start' }}>{r.paid ? 'Paid' : 'Volunteer'}</span>
                <div className="jr-l">
                  {[r.age_group, r.commitment, r.paid ? 'Paid' : 'Volunteer'].filter(Boolean).join(' · ')}
                  {r.closed_at && ' · closed'}
                </div>
              </div>
              {!r.closed_at && (
                <form action={closeRole}><input type="hidden" name="roleId" value={r.id} />
                  <button type="submit" className="console-btn">Close</button>
                </form>
              )}
            </div>

            {applicants.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500 }}>Nobody yet.</div>
            ) : applicants.map((a) => (
              <div key={a.application_id} className="jr-app">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{a.coach_name}</div>
                  {a.coach_slug && (
                    <Link href={`/c/${a.coach_slug}`} style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--accent)', textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Their coaching CV</Link>
                  )}
                </div>
                {a.message && <div style={{ fontSize: 13, color: 'var(--secondary)', fontWeight: 500, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{a.message}</div>}
              </div>
            ))}
          </div>
        ))}

        <div className="card-sunken" style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, lineHeight: 1.55 }}>
          You get each coach&rsquo;s CV and what they wrote. You do not get a phone number or an email unless they chose to put one in their message.
        </div>
        {liveTd?.name && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div>
              <div className="panel-h">Technical Director</div>
              <div style={{ fontSize: 15.5, fontWeight: 900 }}>{liveTd.name}</div>
            </div>
            <form action={endTdAccess} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <label className="field">
                <div className="field-label">Why</div>
                <input name="reason" aria-label="Why" required minLength={3} maxLength={500} />
              </label>
              <button type="submit" className="btn btn-secondary">End their access</button>
            </form>
          </div>
        )}
        <Link href="/home" className="btn btn-ghost">Back</Link>
      </div>
    </ClubConsole>
  );
}
