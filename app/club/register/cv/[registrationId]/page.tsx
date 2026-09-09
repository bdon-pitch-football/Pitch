// The club's view of a registered player's CV. Access is the registration
// itself (guardian-consented, revocable): worker at THIS verified,
// subscribed club, on a live row — checked in the database, and the read
// is logged. Anything else is not-found, never forbidden.
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { assembleCv } from '@/lib/record-read';
import { getSessionPersonId } from '@/lib/session';
import PlayerCV from '@/components/cv/PlayerCV';
import type { CvData } from '@/lib/record-read';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function RegisterCv({ params }: { params: Promise<{ registrationId: string }> }) {
  const { registrationId } = await params;
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');

  // authorise: the row must be visible to this worker via the engine
  const auth = await db.query(
    `select r.player_id, r.club_id, dr.id as record_id, fn_age_band(p.dob) as band
     from registration r
     join person p on p.id = r.player_id
     join development_record dr on dr.person_id = p.id
     where r.id = $1 and r.withdrawn_at is null
       and fn_can_work_register($2, r.club_id)
       and exists (select 1 from club c where c.id = r.club_id and c.club_state = 'verified')
       and fn_register_active(r.club_id)`,
    [registrationId, me],
  );
  if (auth.rows.length === 0) notFound();
  const a = auth.rows[0];

  // The club never sees a pending edit (D-119) — but "approved snapshot" is
  // only how a u16's page exists. 16-17 and 18+ have no profile_version at
  // all, so reading one and 404ing otherwise meant a club could open the CV
  // of a fifteen-year-old and NOBODY ELSE on the list it pays for. On this
  // register, 97 of 100 rows answered 404 to the club's own TD.
  //
  // Same split the share link uses, and now the same code: snapshot for u16,
  // live assembly above it. One assembly, two authorisations.
  let cv: CvData | null;
  if (a.band === 'u16') {
    const v = await db.query(
      `select content from profile_version where record_id = $1 and status = 'approved'`,
      [a.record_id],
    );
    cv = (v.rows[0]?.content as CvData | null) ?? null;
    if (cv) cv = { ...cv, band: 'u16' };
  } else {
    cv = await assembleCv(a.record_id, a.player_id, a.band);
  }
  if (!cv) notFound();

  await db.query(
    `insert into consent_event (event, actor_id, subject_id, detail)
     values ('outside_contact_logged', $1, $2, jsonb_build_object('kind', 'register_cv_opened', 'registration_id', $3::uuid))`,
    [me, a.player_id, registrationId],
  );

  return <PlayerCV p={cv} />;
}
