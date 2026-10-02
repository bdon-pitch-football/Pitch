// The guardian's review of an under-16's waiting change (D-119), every change
// on it (BUZ, 2 Oct: "the parent sees every change before approving"; spec D,
// /g/pending; floodlit-parent.html #sec-pend-all, artboards 7–7e).
//
// It used to read only the About, so a photo, a clip, a list entry or a stat
// was approved unseen, and a change with an unchanged About read "Nothing is
// waiting on you." Now the approved version's content is compared with the
// waiting one's (lib/pending-diff) and one section renders for each kind that
// changed, in a fixed order: About, the photo, Highlights, Clubs before this
// one, Achievements, Other football, Football details. "Nothing is waiting on
// you." renders exactly when no kind differs. And the press approves EXACTLY
// the version drawn here: the form carries that version's id and a hash of
// its content, and the approval refuses a version that has moved since.
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { HeaderMark } from '@/components/Wordmark';
import { AskHead, ParentPage, TickGlyph } from '@/components/parent-sheet';
import { approveChange, issueShareLink } from './actions';
import ClipFacade from './ClipFacade';
import { requireRecordAuthor } from '@/lib/record-guard';
import { imageSrc } from '@/lib/storage';
import { isPrivatePhoto } from '@/lib/player-photo';
import { EMPTY, changedKinds, pendingDiff, type ListChange } from '@/lib/pending-diff';
import { EXPERIENCE_KIND_LABELS, type ExperienceKind } from '@/lib/football';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Changes to approve', robots: { index: false, follow: false } };

// The clips page's own names for the three hosts it accepts (D-97).
const sourceOf = (url: string) =>
  /youtu/i.test(url) ? 'YouTube' : /instagram/i.test(url) ? 'Instagram' : 'Veo';

// A label over a side of a diff: the About's own two labels, muted for what
// was approved and ink for the new version (a label, so never green).
const SideLabel = ({ ink, children }: { ink?: boolean; children: React.ReactNode }) => (
  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: ink ? T.ink : T.muted, marginBottom: 6 }}>{children}</div>
);

const CameraGlyph = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 8 h3 l2-2.5 h6 L17 8 h3 v11 H4 Z" /><circle cx="12" cy="13" r="3.4" /></svg>
);

export default async function PendingReview({ params, searchParams }: {
  params: Promise<{ recordId: string }>;
  searchParams: Promise<{ done?: string; link?: string }>;
}) {
  const { recordId } = await params;
  // Guardian only: silence never auto-publishes and the child never
  // approves their own edit (D-119). And an UNDER-16's guardian only — the
  // author rule, as E15 asks it (doc 14 R13; safety review of the review,
  // S-1): a 16–17's page is the live record, so their guardian has no
  // version to review or approve, and must not be drawn one left over from
  // before the sixteenth birthday (R4, R8, R11). Anyone else goes home,
  // exactly as for a record that is not theirs (D-77).
  const { actor } = await requireRecordAuthor(recordId);
  if (actor !== 'guardian') redirect('/home');
  const { done, link } = await searchParams;

  const { rows } = await db.query(
    `select p.first_name,
       (select content from profile_version where record_id=$1 and status='approved') as approved,
       (select approved_at from profile_version where record_id=$1 and status='approved') as approved_at,
       (select id from profile_version where record_id=$1 and status='pending') as pending_id,
       (select content from profile_version where record_id=$1 and status='pending') as pending,
       (select md5(content::text) from profile_version where record_id=$1 and status='pending') as pending_hash
     from development_record dr join person p on p.id = dr.person_id where dr.id = $1`,
    [recordId],
  );
  if (rows.length === 0) notFound();
  const r = rows[0];
  const name: string = r.first_name;
  const diff = pendingDiff(r.approved, r.pending);
  const kinds = changedKinds(diff);

  // D-F2 (BUZ, 1 Oct): with no change waiting and nothing just approved, say
  // so — the words are /home's, so the two places a parent learns this agree
  // (A-N1). And ONLY then (7e, 2 Oct): never because the About is blank or
  // unchanged while a photo, a clip or a stat waits.
  if (!done && (!r.pending_id || kinds.length === 0)) {
    return (
      <ParentPage>
        <HeaderMark back={{ href: '/home', label: 'Your family' }} />
        <h1 style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.015em' }}>Nothing is waiting on you.</h1>
      </ParentPage>
    );
  }

  if (done) {
    // approved state: confirmation + the share-link affordance. Only an
    // under-16's guardian reaches this page at all (the author rule above),
    // the same guardian issueShareLink lets mint (doc 14 E15), so a 16–17's
    // guardian is never offered the press it refuses.
    const issue = issueShareLink;
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
        ) : (
          // A step that gives nothing away: the charter primary, and the glow.
          <form action={issue}><input type="hidden" name="recordId" value={recordId} />
            <button type="submit" className="btn btn-primary fl-glow">Get the share link</button>
          </form>
        )}
      </ParentPage>
    );
  }

  const act = approveChange;
  const approvedDate = r.approved_at
    ? new Date(r.approved_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', timeZone: 'Australia/Melbourne' })
    : null;
  const approvedLabel = approvedDate ? `You approved this on ${approvedDate}` : 'Nothing approved yet';

  // The photos, each at a short-lived signed address minted for this read,
  // after the guardian check above (John's ruling §1). Never a public URL:
  // a path that is not in the private bucket is not drawn at all.
  const mint = async (path: string | null) => (path && isPrivatePhoto(path) ? await imageSrc(path) : null);
  const photoFrom = diff.photo ? await mint(diff.photo.from) : null;
  const photoTo = diff.photo ? await mint(diff.photo.to) : null;
  // Each photo is named for a screen reader in the approved mockup's words
  // (floodlit-parent.html #pa-all; follow-up audit #7, 2 Oct).
  const tile = (path: string | null, src: string | null, alt: string) => (
    path === null
      ? <div className="ph ph-none"><CameraGlyph /><span>No photo yet</span></div>
      : <div className="ph">{src ? <img src={src} alt={alt} /> : <CameraGlyph />}</div>
  );

  // One row of a list that changed: the entry, and whether it was added or
  // removed. A removed entry reads struck through and muted, as the About's
  // old text does.
  const changeRow = (c: ListChange, key: string, main: React.ReactNode, facade?: React.ReactNode) => (
    <div className="row chg" key={key}>
      {facade}
      <div className="row-main">{main}</div>
      <span className="pill pill-chg">{c.change === 'added' ? 'Added' : 'Removed'}</span>
    </div>
  );
  const title = (c: ListChange, t: unknown) => <div className={c.change === 'removed' ? 'row-t gone' : 'row-t'}>{String(t ?? '')}</div>;
  const sub = (t: unknown) => (t ? <div className="row-s">{String(t)}</div> : null);
  const section = (heading: string, body: React.ReactNode) => (
    <div className="ask" style={{ gap: 8 }}>
      <h2 className="sec-h">{heading}</h2>
      {/* Purple: a state, waiting on you. */}
      <div className="card card-purple">{body}</div>
    </div>
  );

  return (
    <ParentPage>
      <HeaderMark back={{ href: '/home', label: 'Your family' }} />
      <AskHead initial={name[0]} wait kicker="Waiting on you" title={`${name} changed the page`}
        sub="Everything that changed is below. The rest stays exactly as you approved it." />

      {diff.about && (
        <div className="ask">
          <h2 className="sec-h">The About section</h2>
          <div className="card card-purple">
            <div style={{ marginBottom: 14 }}>
              <SideLabel>{approvedLabel}</SideLabel>
              <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, color: T.muted, textDecoration: diff.about.from ? 'line-through' : 'none' }}>{diff.about.from || '(empty)'}</div>
            </div>
            <div>
              <SideLabel ink>The new version</SideLabel>
              <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, color: T.ink }}>{diff.about.to || EMPTY}</div>
            </div>
          </div>
        </div>
      )}

      {diff.photo && section('The photo', (
        <div className="ph-pair">
          <figure><SideLabel>{approvedLabel}</SideLabel>{tile(diff.photo.from, photoFrom, `${name}’s approved photo`)}</figure>
          <figure><SideLabel ink>The new version</SideLabel>{tile(diff.photo.to, photoTo, `${name}’s new photo`)}</figure>
        </div>
      ))}

      {diff.highlights.length > 0 && section('Highlights', diff.highlights.map((c, i) => {
        const url = String(c.item.url ?? '');
        return changeRow(c, `h${i}`, <>{title(c, c.item.title)}{sub(sourceOf(url))}</>,
          <ClipFacade title={String(c.item.title ?? '')} url={url} source={sourceOf(url)} />);
      }))}

      {diff.previousClubs.length > 0 && section('Clubs before this one', diff.previousClubs.map((c, i) =>
        changeRow(c, `c${i}`, <>{title(c, c.item.orgName)}{sub(c.item.period)}</>)))}

      {diff.achievements.length > 0 && section('Achievements', diff.achievements.map((c, i) =>
        changeRow(c, `a${i}`, <>{title(c, c.item.title)}{sub(c.item.detail)}</>)))}

      {diff.otherFootball.length > 0 && section('Other football', diff.otherFootball.map((c, i) =>
        changeRow(c, `o${i}`, <>
          <span className="pill nodot" style={{ alignSelf: 'flex-start' }}>{EXPERIENCE_KIND_LABELS[c.item.kind as ExperienceKind] ?? String(c.item.kind ?? '')}</span>
          {title(c, c.item.orgName)}{sub(c.item.period)}
        </>)))}

      {/* Spec D as amended (follow-up audit, 2 Oct): the old value is muted,
          never struck — the arrow already says "was" — and the arrow is held
          with the new value (.det-to), so a wrap never strands it at the end
          of the old line. */}
      {diff.details.length > 0 && section('Football details', diff.details.map((d) => (
        <div className="det" key={d.label + d.from + d.to}>
          <span className="det-l">{d.label}:</span>
          <span className="det-v">
            <span className="det-o">{d.from}</span>
            <span className="det-to"><span className="det-ar" aria-hidden>→</span><span className="det-n">{d.to}</span></span>
            {d.toProvenance && <span className="det-p">{d.toProvenance}</span>}
          </span>
        </div>
      )))}

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
          second form. The Approve carries the version drawn above — its id and
          a hash of its content — and the approval refuses any other. */}
      <div className="fl-answer">
        <form action={act}><input type="hidden" name="recordId" value={recordId} />
          <input type="hidden" name="version" value={`${r.pending_id}:${r.pending_hash}`} />
          <button type="submit" className="btn btn-secondary">Approve the change</button>
        </form>
        <Link href="/home" className="btn btn-secondary">Not this one</Link>
      </div>
    </ParentPage>
  );
}
