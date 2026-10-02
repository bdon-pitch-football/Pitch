// InterestGuardian.dc.html — copy verbatim. The guardian reads exactly what
// the child wrote before it reaches any club's register.
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isUuid } from '@/lib/ids';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { AskHead, CalendarGlyph, CrossGlyph, InfoGlyph, ParentPage, TickGlyph } from '@/components/parent-sheet';
import { dispatchInterest } from './actions';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'A club has asked', robots: { index: false, follow: false } };

export default async function GuardianInterest({ params, searchParams }: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const { requestId } = await params;
  const { sent } = await searchParams;
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');

  // A malformed id reaches Postgres as a uuid cast and throws, which is a
  // 500 on a screen a guardian opens from an SMS. Same answer as a row
  // that is not there.
  if (!isUuid(requestId)) notFound();

  const { rows } = await db.query(
    `select rr.note, rr.positions, rr.dispatched_at, p.first_name,
       c.name as club_name, c.club_state,
       (select name from squad where id = rr.squad_target) as squad_name,
       (select row_to_json(t) from (
          select tn.title, to_char(tn.trial_on, 'Dy FMDD Mon') as date
          from trial_notice tn where tn.id = rr.trial_notice_id) t) as trial
     from registration_request rr
     join development_record dr on dr.id = rr.record_id
     join person p on p.id = dr.person_id
     join club c on c.id = rr.club_id
     join guardianship_link g on g.child_id = p.id and g.guardian_id = $2
       and g.approved_at is not null and g.revoked_at is null
     where rr.id = $1`,
    [requestId, me],
  );
  if (rows.length === 0) notFound();
  const r = rows[0];
  const name: string = r.first_name;

  if (sent || r.dispatched_at) {
    return (
      <ParentPage>
        <HeaderMark back={{ href: '/home', label: 'Your family' }} />
        <h1 style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.015em' }}>{name} is on {r.club_name}&rsquo;s register.</h1>
        {/* D-F3 (BUZ, 1 Oct): there is no page called Manage. The control,
            "Take off this register", is on the child's controls, reached from
            Your family. */}
        <div className="pd-body">You can take {name} off the register any time from {name}&rsquo;s controls. Their access ends when you do.</div>
      </ParentPage>
    );
  }

  const act = dispatchInterest;
  return (
    <ParentPage>
      <HeaderMark back={{ href: '/home', label: 'Your family' }} />
      <AskHead initial={name[0]} size={24} wait kicker={`${name} asked you to send this`}
        title={<>Put {name} on {r.club_name.replace(/ FC$| SC$/, '')}&rsquo;s register?</>}
        sub="Nothing has been sent. It only goes if you send it.">
        {/* Doc 14 N2: the consent screen shows the trial at the moment of the
            press. Ink with a calendar glyph: the same fact, without borrowing
            the action colour. */}
        {r.trial && <div className="pd-tk" style={{ fontSize: 13, fontWeight: 800, color: T.ink, alignItems: 'center' }}><CalendarGlyph /><div>For {r.trial.title} · {r.trial.date}</div></div>}
      </AskHead>

      {/* The child's words are a fact to read, not an action: no green edge. */}
      <div className="ask" style={{ gap: 9 }}>
        <h2 className="sec-h">What {name} wrote</h2>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 22 }}>
            {[['Squad', r.squad_name ?? '—'], [`Where ${name} would play`, (r.positions ?? []).join(', ') || '—']].map(([k, v]) => (
              <div key={k}>
                <div className="pd-flabel">{k}</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{v}</div>
              </div>
            ))}
          </div>
          {r.note && (
            <>
              <hr className="pd-hair" />
              <div>
                <div className="pd-flabel">{name}&rsquo;s line</div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: T.secondary, lineHeight: 1.5 }}>&ldquo;{r.note}&rdquo;</div>
              </div>
            </>
          )}
        </div>
        {/* D-PD-2 (BUZ, 1 Oct): "Edit what {name} wrote" was drawn here as a
            button with no destination. It comes back when it is built. */}
      </div>

      <div className="ask" style={{ gap: 9 }}>
        <h2 className="sec-h">It goes to</h2>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="pd-club-tile">{r.club_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800 }}>{r.club_name}</div>
            {r.club_state === 'verified' && <div><span className="pill pill-live">Verified club on Pitch</span></div>}
          </div>
        </div>
        <div className="pd-small">No email address to check this time — it goes into the club&rsquo;s own register inside Pitch, not to an inbox.</div>
      </div>

      <div className="card pd-ticks">
        <div style={{ fontSize: 13.5, fontWeight: 800 }}>What the club receives</div>
        {[
          `A link to ${name}'s CV — not a file, and not a copy. They cannot download or keep one.`,
          // BUZ's copy fix (F3), word for word as the sent state and
          // /register-interest say it: where the control is.
          `You can take ${name} off the register any time from ${name}’s controls. Their access ends when you do.`,
          `If they invite ${name} to a trial, that invitation comes to you first.`,
        ].map((t) => (
          <div key={t} className="pd-tk"><TickGlyph /><div>{t}</div></div>
        ))}
        <hr className="pd-hair" />
        {[
          `No contact details for you or ${name} — not now, and not if they reply.`,
          `They see the name, the age and the club — that is how a coach picks a squad. No birthday, no school, no address, and no way to contact either of you.`,
        ].map((t) => (
          <div key={t} className="pd-tk"><CrossGlyph /><div>{t}</div></div>
        ))}
      </div>

      <div className="card-sunken pd-info">
        <InfoGlyph />
        <div>A register is a list of who wants to be there, not a decision anyone owes {name} — so there is no result coming and nothing to be turned down from. If you&rsquo;d rather not, do nothing — this disappears by itself.</div>
      </div>

      {/* D-PD-0: two equal answers, nothing glows. D-PD-1: the No writes
          nothing (D-138). An <a>, never a second form carrying requestId. */}
      <div className="fl-answer">
        <form action={act}><input type="hidden" name="requestId" value={requestId} />
          <button type="submit" className="btn btn-secondary">Register {name}&rsquo;s interest</button>
        </form>
        <Link href="/home" className="btn btn-secondary">Not this one</Link>
      </div>
    </ParentPage>
  );
}
