// The club's view of a registered player's CV. Access is the registration
// itself (guardian-consented, revocable): worker at THIS verified,
// subscribed club, on a live row — checked in the database, and the read
// is logged. Anything else is not-found, never forbidden.
import { notFound, redirect } from 'next/navigation';
import { isUuid } from '@/lib/ids';
import { db } from '@/lib/db';
import { assembleCv } from '@/lib/record-read';
import { getSessionPersonId } from '@/lib/session';
import PlayerCV from '@/components/cv/PlayerCV';
import type { CvData } from '@/lib/record-read';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Player CV', robots: { index: false, follow: false } };

export default async function RegisterCv({ params }: { params: Promise<{ registrationId: string }> }) {
  const { registrationId } = await params;
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');

  // authorise: the row must be visible to this worker via the engine
  // A malformed id reaches Postgres as a uuid cast and throws, which is a
  // 500 on a screen a guardian opens from an SMS. Same answer as a row
  // that is not there.
  if (!isUuid(registrationId)) notFound();

  const auth = await db.query(
    `select r.player_id, r.club_id, dr.id as record_id, fn_age_band(p.dob) as band,
            fn_can_work_register($2, r.club_id) as td
     from registration r
     join person p on p.id = r.player_id
     join development_record dr on dr.person_id = p.id
     -- D-154: a named person reads a registration, never a club. The TD, or
     -- a coach granted this registration's team — with every refusal
     -- fn_can_invite carries (P19). An administrator gets not-found (N17).
     where r.id = $1 and fn_can_read_registration($2, r.id)`,
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
  // N22 / doc 32 C4a: the read carries a name, and a guardian can ask for it.
  await db.query(
    `insert into register_read_log (person_id, registration_id, surface) values ($1, $2, 'cv')`,
    [me, registrationId],
  );

  // PlayerCV renders the public page, header and all, so the way back to the
  // register is a bar above it. Without this a TD who opened a row had to use
  // the browser's back button — and in the installed app there isn't one.
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', background: '#0b120e' }}>
        <div className="reading" style={{ width: '100%', padding: '14px 18px 0 18px', boxSizing: 'border-box' }}>
          <a href={a.td ? '/club/register' : '/coach/register'} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, gap: 6, textDecoration: 'none', color: '#7d8f85', fontSize: 13, fontWeight: 700 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 5 L8 12 L15 19" /></svg>
            {a.td ? 'The register' : 'Registrations'}
          </a>
        </div>
      </div>
      <PlayerCV p={cv} />
    </>
  );
}
