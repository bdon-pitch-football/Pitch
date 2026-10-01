// One coaching role, and the form to apply for it.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { CoachConsole } from '@/components/console-shell';
import { applyForRole } from '@/app/coach/edit/actions';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Coaching role' };

export default async function Role({ params, searchParams }: {
  params: Promise<{ roleId: string }>;
  // `sent`, not `applied`: D-108's words are banned on every surface, and
  // the address bar is one.
  searchParams: Promise<{ sent?: string; cannot?: string; closed?: string }>;
}) {
  const { roleId } = await params;
  if (!isUuid(roleId)) notFound();
  const { sent, cannot, closed } = await searchParams;
  const me = await getSessionPersonId();

  const { rows } = await db.query(
    `select r.id, r.title, r.age_group, r.detail, r.commitment, r.paid, r.closes_on, r.closed_at,
       c.name as club, c.public_slug, c.club_state
     from coaching_role r join club c on c.id = r.club_id
     -- A suspended club's role is not on the board (0151), and its own page
     -- is the same not-found as a role that is not there. A closed role of a
     -- club that is up still opens, to say it closed.
     where r.id = $1 and fn_club_advertises(r.club_id)`,
    [roleId],
  );
  if (rows.length === 0) notFound();
  const r = rows[0];

  const canApply = me ? (await db.query(`select fn_can_apply_for_role($1) as ok`, [me])).rows[0].ok : false;
  const already = me
    ? (await db.query(`select 1 from role_application where role_id = $1 and coach_id = $2`, [roleId, me])).rows.length > 0
    : false;

  // Floodlit (spec E, BUZ 1 Oct): a reading page on A's parts. One glowing
  // primary in each state that has one. "This role has closed." says it
  // once: when the role is closed, the closed panel alone, never the
  // ?closed notice beside it.
  return (
    <CoachConsole active="jobs">
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div className="pg-titles">
          <h1 className="pg-title">{r.title}</h1>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 700 }}>
            {r.public_slug ? <Link href={`/fc/${r.public_slug}`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, margin: '-14px 0', color: T.secondary, textDecoration: 'none' }}>{r.club}</Link> : r.club}
            {r.club_state === 'verified' && <span style={{ color: T.accent }}> · Verified club</span>}
          </div>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>
            {[r.age_group, r.commitment, r.paid ? 'Paid' : 'Volunteer'].filter(Boolean).join(' · ')}
            {r.closes_on && ` · closes ${r.closes_on}`}
          </div>
        </div>

        {sent && <div className="card card-accent note">Sent. {r.club} has your coaching CV and your message. What happens next is up to them — we don&rsquo;t chase clubs on your behalf.</div>}
        {cannot && <div className="card card-amber note">You need a coaching profile and an adult account to put your name forward.</div>}
        {closed && !r.closed_at && <div className="card card-amber note">This role has closed.</div>}

        {r.detail && (
          <section className="stack8">
            <h2 className="sec-h">About the role</h2>
            <div style={{ fontSize: 14, lineHeight: 1.55, color: T.secondary, fontWeight: 500, whiteSpace: 'pre-wrap', maxWidth: '64ch' }}>{r.detail}</div>
          </section>
        )}

        {r.closed_at ? (
          <div className="card" style={{ fontSize: 13, color: T.muted, fontWeight: 700 }}>This role has closed.</div>
        ) : already ? (
          <div className="card" style={{ fontSize: 13, color: T.secondary, fontWeight: 700 }}>Your name is in for this one. The club has your CV.</div>
        ) : !me ? (
          <Link href="/signin" className="btn btn-primary fl-glow">Sign in to put your name forward</Link>
        ) : !canApply ? (
          <div className="card" style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
            You need a coaching profile to put your name forward. <Link href="/coach/edit" style={{ color: T.accent, fontWeight: 800, textDecoration: 'none' }}>Build one</Link> — it takes a few minutes and it is what the club reads.
          </div>
        ) : (
          <form action={applyForRole} className="card panel"><input type="hidden" name="roleId" value={roleId} />
            <div className="pn-t">Put your name forward</div>
            <label className="field">
              <textarea name="message" aria-label="Why this club" rows={5} maxLength={1200} placeholder="Why this club, and what you'd bring. If you want them to phone or email you, put it here — we don't pass it on otherwise." />
            </label>
            <button type="submit" className="btn btn-primary fl-glow">Send it to {r.club}</button>
            <div className="quiet">
              They get your coaching CV and this message. They do not get your phone number or your email address unless you write them above.
            </div>
          </form>
        )}

        <Link href="/jobs" className="btn btn-ghost">All roles</Link>
      </div>
    </CoachConsole>
  );
}
