// "Preview my page" (BUZ, 19 Sep): the player — or their parent — sees their
// page exactly as a club does, the way a club previews its own page.
//
// A player could not do this before. Their public link exists only once a
// page has been sent, and it is stored hashed (D-80), so nobody on the family
// side can ever open it. This is not a link and it is not shareable: it needs
// the session of the player or a guardian (requireRecordActor), it is
// noindexed, and it has no social card.
//
// What it shows is what a club is shown, by the same split the club's own
// view uses: an under-16's guardian-APPROVED snapshot (D-119) — never a
// pending edit, which no club can see — and the live record above 16.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PlayerCV from '@/components/cv/PlayerCV';
import { db } from '@/lib/db';
import { assembleCv, cvClubColours, withSignedPhoto, wornColours, type CvData } from '@/lib/record-read';
import { requireRecordActor } from '@/lib/record-guard';
import { waitingRecords } from '@/lib/cv-build';
import SiteNav from '@/components/floodlit/SiteNav';
import { PREVIEW_EMPTY_TITLE } from '@/lib/to-confirm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Preview your page', robots: { index: false, follow: false } };

export default async function PreviewPage({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  const { actor } = await requireRecordActor(recordId);

  const { rows } = await db.query(
    `select dr.person_id, p.first_name, fn_age_band(p.dob) as band
     from development_record dr join person p on p.id = dr.person_id where dr.id = $1`,
    [recordId],
  );
  const r = rows[0] as { person_id: string; first_name: string; band: string; has_pending: boolean } | undefined;
  if (!r) notFound();
  // Waiting is ONE answer everywhere (lib/cv-build waitingRecords, Leo 2 Oct):
  // a version waits only if it differs in something the review draws.
  r.has_pending = (await waitingRecords([recordId])).has(recordId);

  let cv: CvData | null;
  if (r.band === 'u16') {
    // The approved snapshot as a club actually reads it, club line and all
    // (0054): this page's whole claim is that it is what a club sees.
    const v = await db.query(`select fn_approved_cv($1) as content`, [recordId]);
    cv = (v.rows[0]?.content as CvData | null) ?? null;
    // And in the club's colours, as a club sees it (D-174, 0165).
    if (cv) cv = { ...cv, band: 'u16', ...(await cvClubColours(r.person_id)) };
    // Its photo as an address for this read only (John's ruling §1).
    if (cv) cv = await withSignedPhoto(cv);
  } else {
    cv = await assembleCv(recordId, r.person_id, r.band);
  }
  // B1 (BUZ, 1 Oct): an under-16 with no approved version yet has nothing
  // to preview — say so and offer the way to start, instead of a 404. The
  // top bar and the reading column, as every unframed page (spec A part 5).
  if (!cv && r.band === 'u16') {
    return (
      <div className="floodlight has-topbar" style={{ minHeight: '100dvh', color: 'var(--ink)' }}>
        <SiteNav links={[]} signIn={false} />
        <main className="reading" style={{ padding: '22px 18px 30px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Link href={actor === 'self' ? `/build/${recordId}` : `/g/controls/${r.person_id}`} className="pg-back" style={{ margin: 0, alignSelf: 'flex-start' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 5 L8 12 L15 19" /></svg>
            {actor === 'self' ? 'Back to editing' : `Back to ${r.first_name}`}
          </Link>
          <div className="pg-titles"><h1 className="pg-title" style={{ margin: 0 }}>{PREVIEW_EMPTY_TITLE}</h1></div>
          <Link href={`/build/${recordId}`} className="btn btn-primary fl-glow">Build {r.first_name}&rsquo;s page</Link>
        </main>
      </div>
    );
  }
  if (!cv) notFound();

  const mine = actor === 'self';
  const back = mine ? `/build/${recordId}` : `/g/controls/${r.person_id}`;
  const waiting = r.band === 'u16' && r.has_pending;

  // One header (spec C): the CV's own nav bar comes first, then the way back
  // and the Preview notice inside .fl-wide, aligned with the card's grid.
  // They used to sit ABOVE the CV's nav bar — two headers. The token page
  // never passes `above`, so its HTML is what it was.
  const strip = (
    <div className="fl-wide">
      <div className="pv-strip">
        <Link href={back} className="pg-back" style={{ margin: 0, alignSelf: 'flex-start' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 5 L8 12 L15 19" /></svg>
          {mine ? 'Back to editing' : `Back to ${r.first_name}`}
        </Link>
        {/* Purple when a change is waiting: the next move is the parent's. */}
        <div role="status" className={`card ${waiting ? 'card-purple' : 'card-accent'}`} style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '12px 14px' }}>
          <div className="notice-k k-accent">Preview</div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.45 }}>
            {mine ? 'This is exactly what a club sees when you send your page.' : `This is exactly what a club sees when ${r.first_name}’s page is sent.`}
          </div>
          {waiting && (
            <div className="c-s2">
              {mine
                ? 'Your latest changes are waiting for your parent. Clubs see this version until they approve them.'
                : `${r.first_name}’s latest changes are waiting for you. Clubs see this version until you approve them.`}
            </div>
          )}
          {/* QA F4: this was a 14px link inside the sentence above, and on a
              phone it wrapped over two lines — a tap between them hit
              nothing. Its own row, 44px tall, as every other tappable thing
              on this page is (CLAUDE.md: ≥44px at every width). Same words,
              same destination. */}
          {waiting && !mine && (
            <Link href={`/g/pending/${recordId}`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, alignSelf: 'flex-start', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>Review the changes</Link>
          )}
        </div>
      </div>
    </div>
  );

  return <PlayerCV p={cv} above={strip} {...wornColours(cv)} />;
}
