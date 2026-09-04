// The club's view of a registered player's CV. Access is the registration
// itself (guardian-consented, revocable): worker at THIS verified,
// subscribed club, on a live row — checked in the database, and the read
// is logged. Anything else is not-found, never forbidden.
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
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

  // Every band renders the approved snapshot here (D-119): the club never
  // sees a pending edit, and a record with no approved version shows nothing.
  const v = await db.query(`select content from profile_version where record_id = $1 and status = 'approved'`, [a.record_id]);
  const cv: CvData | null = v.rows[0]?.content ?? null;
  if (!cv) notFound();

  await db.query(
    `insert into consent_event (event, actor_id, subject_id, detail)
     values ('outside_contact_logged', $1, $2, jsonb_build_object('kind', 'register_cv_opened', 'registration_id', $3::uuid))`,
    [me, a.player_id, registrationId],
  );

  return <PlayerCV p={cv} />;
}
