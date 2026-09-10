// ReapproveChanges.dc.html — the guardian's re-approval of a child's edit
// (D-119). Copy verbatim; the diff shows the approved About against the
// pending one. Dev-gated until sessions exist.
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';
import { approveChange, issueShareLink } from './actions';
import { requireRecordActor } from '@/lib/record-guard';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
  onAccent: '#06130c', purple: '#a479e2',
};

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Changes to approve', robots: { index: false, follow: false } };

export default async function PendingReview({ params, searchParams }: {
  params: Promise<{ recordId: string }>;
  searchParams: Promise<{ done?: string; link?: string }>;
}) {
  const { recordId } = await params;
  // Guardian only: silence never auto-publishes and the child never
  // approves their own edit (D-119).
  await requireRecordActor(recordId, ['guardian']);
  const { done, link } = await searchParams;

  const { rows } = await db.query(
    `select p.id as person_id, p.first_name,
       (select g.guardian_id from guardianship_link g where g.child_id = p.id and g.approved_at is not null and g.revoked_at is null limit 1) as guardian_id,
       (select content->>'about' from profile_version where record_id=$1 and status='approved') as approved_about,
       (select approved_at from profile_version where record_id=$1 and status='approved') as approved_at,
       (select content->>'about' from profile_version where record_id=$1 and status='pending') as pending_about
     from development_record dr join person p on p.id = dr.person_id where dr.id = $1`,
    [recordId],
  );
  if (rows.length === 0) notFound();
  const r = rows[0];
  const name: string = r.first_name;

  if (done || !r.pending_about) {
    // approved state: confirmation + the share-link affordance
    const issue = issueShareLink;
    return (
      <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
          <HeaderMark back={{ href: '/home', label: 'Your family' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>{name}&rsquo;s page is approved</h1>
            <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Clubs holding the link now read this version.</div>
          </div>
          {link ? (
            <div style={{ background: T.surface, border: `1.5px solid ${T.accent}`, borderRadius: 16, padding: '15px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>The share link — it works only where you send it</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.accent, wordBreak: 'break-all' }}>pitchfootball.com.au/p/{link}</div>
              <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 500 }}>Expires in 90 days. You can pause or regenerate it any time.</div>
            </div>
          ) : (
            <form action={issue}><input type="hidden" name="recordId" value={recordId} />
              <button type="submit" style={{ width: '100%', background: T.accent, color: T.onAccent, borderRadius: 14, height: 50, fontSize: 15, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Get the share link</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const act = approveChange;
  const approvedDate = r.approved_at
    ? new Date(r.approved_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', timeZone: 'Australia/Melbourne' })
    : null;

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/home', label: 'Your family' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.purple }}>Waiting on you</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>{name} changed the page</h1>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Only this change needs you. Everything else stays exactly as you approved it.</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted }}>The About section</div>
          <div style={{ background: T.surface, border: `1px solid ${T.purple}`, borderRadius: 16, padding: '15px 14px' }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted, marginBottom: 4 }}>{approvedDate ? `You approved this on ${approvedDate}` : 'Nothing approved yet'}</div>
              <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, color: T.muted, textDecoration: r.approved_about ? 'line-through' : 'none' }}>{r.approved_about ?? '(empty)'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.accent, marginBottom: 4 }}>The new version</div>
              <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, color: T.ink }}>{r.pending_about}</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {[
            `Until you approve it, every club holding ${name}'s link still reads the old version.`,
            'You can edit the words before you approve them.',
            'Saying no leaves the approved page exactly where it is.',
          ].map((t) => (
            <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
              <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>{t}</div>
            </div>
          ))}
        </div>

        <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 'auto' }}><input type="hidden" name="recordId" value={recordId} />
          <button type="submit" className="btn btn-primary">Approve the change</button>
          <div style={{ border: `1px solid ${T.line}`, color: T.secondary, borderRadius: 14, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>Edit the words first</div>
          <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: T.muted }}>Not this one</div>
        </form>
      </div>
    </div>
  );
}
