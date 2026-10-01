// The club's view of a registered player's CV. Access is the registration
// itself (guardian-consented, revocable): worker at THIS verified,
// subscribed club, on a live row — checked in the database, and the read
// is logged. Anything else is not-found, never forbidden.
import { notFound, redirect } from 'next/navigation';
import { isUuid } from '@/lib/ids';
import { db } from '@/lib/db';
import { assembleCv, cvClubColours, withSignedPhoto, wornColours } from '@/lib/record-read';
import { getSessionPersonId } from '@/lib/session';
import PlayerCV from '@/components/cv/PlayerCV';
import type { CvData } from '@/lib/record-read';
import { HeaderMark } from '@/components/Wordmark';
import Link from 'next/link';
import { carryBackFrom, registerBackHref } from '@/lib/register-back';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Player CV', robots: { index: false, follow: false } };

export default async function RegisterCv({ params, searchParams }: {
  params: Promise<{ registrationId: string }>; searchParams: Promise<{ back?: string }>;
}) {
  const { registrationId } = await params;
  const { back } = await searchParams;
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
    // The approved snapshot, with the club line following the membership
    // (BUZ's decision 2, 23 Sep): a club that has confirmed a player shows on
    // their page at once, and comes off it when they are removed (D-158).
    const v = await db.query(`select fn_approved_cv($1) as content`, [a.record_id]);
    cv = (v.rows[0]?.content as CvData | null) ?? null;
    // The club's colours follow the membership too (D-174, 0165).
    if (cv) cv = { ...cv, band: 'u16', ...(await cvClubColours(a.player_id)) };
    // Its photo as an address for this read only (John's ruling §1).
    if (cv) cv = await withSignedPhoto(cv);
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

  // F12 (BUZ, 1 Oct, "yes to all"): the no-reply note tells a TD to invite
  // from the register, so the register row's own door comes with the CV —
  // the same label, the same /club/invite/[id], the same conditions the row
  // applies (fn_can_invite, and the paid register's shortlist-first rule),
  // and nothing for a coach, whose row has no door. Where the row says
  // "Invitation sent", so does this, with no button.
  const row = a.td ? (await db.query(
    `select r.club_status, fn_can_invite($2, r.id) as may,
            (c.club_state = 'verified' and fn_register_active(r.club_id)) as active
     from registration r join club c on c.id = r.club_id where r.id = $1`,
    [registrationId, me],
  )).rows[0] as { club_status: string; may: boolean; active: boolean } | undefined : undefined;
  const door = !row?.may ? null
    : row.club_status === 'invited' ? 'sent'
    : (row.active ? row.club_status === 'shortlisted' : true) ? 'invite' : null;

  // PlayerCV renders the public page, header and all, so the way back to the
  // register is A's page header in the CV's own column (F, 1 Oct): one nav
  // bar, and the back link's left edge is the card's at every width. Without
  // it a TD who opened a row had to use the browser's back button — and in
  // the installed app there isn't one. P1 (BUZ, 1 Oct): the TD's way back is
  // the same filtered register, at this row (lib/register-back).
  const head = (
    <>
      <HeaderMark back={a.td ? { href: registerBackHref(back, registrationId), label: 'The register' } : { href: '/coach/register', label: 'Registrations' }} />
      {door === 'invite' && (
        <div className="cv-invite">
          {/* The page's one primary, so its one glow (it is not in a row here). */}
          <Link href={`/club/invite/${registrationId}${carryBackFrom(back)}`} className="btn btn-primary fl-glow">Invite to trial</Link>
        </div>
      )}
      {door === 'sent' && <div className="cv-invite cv-invite-sent">Invitation sent</div>}
    </>
  );
  return <PlayerCV p={cv} {...wornColours(cv)} head={head} />;
}
