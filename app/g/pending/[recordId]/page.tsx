// ReapproveChanges.dc.html — the guardian's re-approval of a child's edit
// (D-119). Copy verbatim; the diff shows the approved About against the
// pending one. Dev-gated until sessions exist.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';
import { AskHead, ParentPage, TickGlyph } from '@/components/parent-sheet';
import { approveChange, issueShareLink } from './actions';
import { recordAuthor, requireRecordActor } from '@/lib/record-guard';
import { T } from '@/lib/palette';

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

  // D-F2 (BUZ, 1 Oct): with no change waiting and nothing just approved, say
  // so. The approved state used to render here too, telling a parent their
  // child's page "is approved" when nothing had ever been approved. The words
  // are /home's, so the two places a parent learns this agree (A-N1).
  if (!done && !r.pending_about) {
    return (
      <ParentPage>
        <HeaderMark back={{ href: '/home', label: 'Your family' }} />
        <h1 style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.015em' }}>Nothing is waiting on you.</h1>
      </ParentPage>
    );
  }

  if (done) {
    // approved state: confirmation + the share-link affordance — for an
    // under-16's guardian only. A 16–17's guardian is never offered the press
    // issueShareLink refuses them (doc 14 E15; fn_record_author, 0169).
    const issue = issueShareLink;
    const author = await recordAuthor(recordId);
    const mayIssue = author !== null && author !== 'no-session' && author.actor === 'guardian';
    return (
      <ParentPage>
        <HeaderMark back={{ href: '/home', label: 'Your family' }} />
        <div className="ask" style={{ gap: 6 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.015em' }}>{name}&rsquo;s page is approved</h1>
          <div className="pd-sub">Clubs holding the link now read this version.</div>
        </div>
        {link ? (
          // Not a link you can press: ink, in the face the send screen uses
          // for an address, on a plain panel.
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>The share link — it works only where you send it</div>
            <div className="pd-link pd-mono" style={{ fontSize: 13 }}>pitchfootball.com.au/p/{link}</div>
            <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 500 }}>Expires in 90 days. You can pause or regenerate it any time.</div>
          </div>
        ) : mayIssue ? (
          // A step that gives nothing away: the charter primary, and the glow.
          <form action={issue}><input type="hidden" name="recordId" value={recordId} />
            <button type="submit" className="btn btn-primary fl-glow">Get the share link</button>
          </form>
        ) : null}
      </ParentPage>
    );
  }

  const act = approveChange;
  const approvedDate = r.approved_at
    ? new Date(r.approved_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', timeZone: 'Australia/Melbourne' })
    : null;

  return (
    <ParentPage>
      <HeaderMark back={{ href: '/home', label: 'Your family' }} />
      <AskHead initial={name[0]} kicker="Waiting on you" title={`${name} changed the page`}
        sub="Only this change needs you. Everything else stays exactly as you approved it." />

      <div className="ask">
        <h2 className="sec-h">The About section</h2>
        {/* Purple: a state, waiting on you. */}
        <div className="card card-purple">
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted, marginBottom: 4 }}>{approvedDate ? `You approved this on ${approvedDate}` : 'Nothing approved yet'}</div>
            <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, color: T.muted, textDecoration: r.approved_about ? 'line-through' : 'none' }}>{r.approved_about ?? '(empty)'}</div>
          </div>
          <div>
            {/* A label, so ink: green is an action. */}
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.ink, marginBottom: 4 }}>The new version</div>
            <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, color: T.ink }}>{r.pending_about}</div>
          </div>
        </div>
      </div>

      <div className="pd-ticks">
        {[
          `Until you approve it, every club holding ${name}'s link still reads the old version.`,
          // D-F1 (BUZ, 1 Oct): "You can edit the words before you approve
          // them." was here, promising an edit that is not built (D-PD-2).
          'Saying no leaves the approved page exactly where it is.',
        ].map((t) => (
          <div key={t} className="pd-tk"><TickGlyph /><div>{t}</div></div>
        ))}
      </div>

      {/* D-PD-0: two equal answers, nothing glows. D-PD-2 (BUZ, 1 Oct): "Edit
          the words first" was drawn here as a button with no destination; it
          comes back when it is built. D-PD-1: the No writes nothing and goes
          where the back link and silence already go (D-138). An <a>, never a
          second form. */}
      <div className="fl-answer">
        <form action={act}><input type="hidden" name="recordId" value={recordId} />
          <button type="submit" className="btn btn-secondary">Approve the change</button>
        </form>
        <Link href="/home" className="btn btn-secondary">Not this one</Link>
      </div>
    </ParentPage>
  );
}
