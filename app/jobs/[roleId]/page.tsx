// One coaching role, and the form to apply for it.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { applyForRole } from '@/app/coach/edit/actions';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
  onAccent: '#06130c', amber: '#eda100',
};

export const dynamic = 'force-dynamic';

export default async function Role({ params, searchParams }: {
  params: Promise<{ roleId: string }>;
  searchParams: Promise<{ applied?: string; cannot?: string; closed?: string }>;
}) {
  const { roleId } = await params;
  if (!isUuid(roleId)) notFound();
  const { applied, cannot, closed } = await searchParams;
  const me = await getSessionPersonId();

  const { rows } = await db.query(
    `select r.id, r.title, r.age_group, r.detail, r.commitment, r.paid, r.closes_on, r.closed_at,
       c.name as club, c.public_slug, c.club_state
     from coaching_role r join club c on c.id = r.club_id where r.id = $1`,
    [roleId],
  );
  if (rows.length === 0) notFound();
  const r = rows[0];

  const canApply = me ? (await db.query(`select fn_can_apply_for_role($1) as ok`, [me])).rows[0].ok : false;
  const already = me
    ? (await db.query(`select 1 from role_application where role_id = $1 and coach_id = $2`, [roleId, me])).rows.length > 0
    : false;

  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };
  const label: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted };

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>{r.title}</div>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 700 }}>
            {r.public_slug ? <Link href={`/fc/${r.public_slug}`} style={{ color: T.secondary, textDecoration: 'none' }}>{r.club}</Link> : r.club}
            {r.club_state === 'verified' && <span style={{ color: T.accent }}> · Verified club</span>}
          </div>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>
            {[r.age_group, r.commitment, r.paid ? 'Paid' : 'Volunteer'].filter(Boolean).join(' · ')}
            {r.closes_on && ` · closes ${r.closes_on}`}
          </div>
        </div>

        {applied && <div style={{ ...card, border: `1px solid ${T.accent}`, fontSize: 13.5, fontWeight: 700, color: T.secondary, lineHeight: 1.55 }}>Sent. {r.club} has your coaching CV and your message. What happens next is up to them — we don&rsquo;t chase clubs on your behalf.</div>}
        {cannot && <div style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary, lineHeight: 1.55 }}>You need a coaching profile and an adult account to apply for a role.</div>}
        {closed && <div style={{ ...card, border: `1px solid ${T.amber}`, fontSize: 13, fontWeight: 700, color: T.secondary }}>This role has closed.</div>}

        {r.detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={label}>About the role</div>
            <div style={{ fontSize: 14, lineHeight: 1.55, color: T.secondary, fontWeight: 500, whiteSpace: 'pre-wrap' }}>{r.detail}</div>
          </div>
        )}

        {r.closed_at ? (
          <div style={{ ...card, fontSize: 13, color: T.muted, fontWeight: 700 }}>This role has closed.</div>
        ) : already ? (
          <div style={{ ...card, fontSize: 13, color: T.secondary, fontWeight: 700 }}>You&rsquo;ve applied for this one. The club has your CV.</div>
        ) : !me ? (
          <Link href="/signin" className="btn btn-primary">Sign in to apply</Link>
        ) : !canApply ? (
          <div style={{ ...card, fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
            You need a coaching profile to apply. <Link href="/coach/edit" style={{ color: T.accent, fontWeight: 800, textDecoration: 'none' }}>Build one</Link> — it takes a few minutes and it is what the club reads.
          </div>
        ) : (
          <form action={applyForRole} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}><input type="hidden" name="roleId" value={roleId} />
            <div style={{ fontSize: 14, fontWeight: 900 }}>Apply for this role</div>
            <textarea name="message" rows={5} maxLength={1200} placeholder="Why this club, and what you'd bring. If you want them to phone or email you, put it here — we don't pass it on otherwise."
              style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: '11px 12px', color: T.ink, fontSize: 14, fontWeight: 500, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }} />
            <button type="submit" className="btn btn-primary">Send it to {r.club}</button>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
              They get your coaching CV and this message. They do not get your phone number or your email address unless you write them above.
            </div>
          </form>
        )}

        <Link href="/jobs" className="btn btn-ghost">All roles</Link>
      </div>
    </div>
  );
}
