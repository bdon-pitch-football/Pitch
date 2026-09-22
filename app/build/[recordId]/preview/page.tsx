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
import { assembleCv, type CvData } from '@/lib/record-read';
import { requireRecordActor } from '@/lib/record-guard';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Preview your page', robots: { index: false, follow: false } };

export default async function PreviewPage({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  const { actor } = await requireRecordActor(recordId);

  const { rows } = await db.query(
    `select dr.person_id, p.first_name, fn_age_band(p.dob) as band,
       exists(select 1 from profile_version where record_id = dr.id and status = 'pending') as has_pending
     from development_record dr join person p on p.id = dr.person_id where dr.id = $1`,
    [recordId],
  );
  const r = rows[0] as { person_id: string; first_name: string; band: string; has_pending: boolean } | undefined;
  if (!r) notFound();

  let cv: CvData | null;
  if (r.band === 'u16') {
    // The approved snapshot as a club actually reads it, club line and all
    // (0054): this page's whole claim is that it is what a club sees.
    const v = await db.query(`select fn_approved_cv($1) as content`, [recordId]);
    cv = (v.rows[0]?.content as CvData | null) ?? null;
    if (cv) cv = { ...cv, band: 'u16' };
  } else {
    cv = await assembleCv(recordId, r.person_id, r.band);
  }
  if (!cv) notFound();

  const mine = actor === 'self';
  const back = mine ? `/build/${recordId}` : `/g/controls/${r.person_id}`;
  const waiting = r.band === 'u16' && r.has_pending;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', background: T.bg }}>
        <div className="reading" style={{ width: '100%', padding: '14px 18px 0 18px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link href={back} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, gap: 6, textDecoration: 'none', color: T.muted, fontSize: 13, fontWeight: 700, alignSelf: 'flex-start' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 5 L8 12 L15 19" /></svg>
            {mine ? 'Back to editing' : `Back to ${r.first_name}`}
          </Link>
          <div role="status" style={{ background: T.surface, border: `1px solid ${T.accent}`, borderRadius: 16, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.accent }}>Preview</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, lineHeight: 1.45 }}>
              {mine ? 'This is exactly what a club sees when you send your page.' : `This is exactly what a club sees when ${r.first_name}’s page is sent.`}
            </div>
            {waiting && (
              <div style={{ fontSize: 12.5, fontWeight: 500, color: T.secondary, lineHeight: 1.5 }}>
                {mine
                  ? 'Your latest changes are waiting for your parent. Clubs see this version until they approve them.'
                  : <>{r.first_name}&rsquo;s latest changes are waiting for you. Clubs see this version until you approve them. <Link href={`/g/pending/${recordId}`} style={{ color: T.accent, fontWeight: 800 }}>Review the changes</Link></>}
              </div>
            )}
          </div>
        </div>
      </div>
      <PlayerCV p={cv} />
    </>
  );
}
