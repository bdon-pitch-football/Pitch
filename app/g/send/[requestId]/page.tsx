// SendCVGuardian.dc.html — the guardian's confirm-and-send. Copy verbatim.
// Nothing has been sent until the button is pressed; ignoring it makes it
// disappear on its own (D-138 — silence is a complete answer).
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isUuid } from '@/lib/ids';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { AskHead, CrossGlyph, InfoGlyph, ParentPage, TickGlyph } from '@/components/parent-sheet';
import { dispatchSend } from './actions';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Send a CV', robots: { index: false, follow: false } };

export default async function GuardianSend({ params, searchParams }: {
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
    `select sr.destination, sr.dispatched_at, p.first_name, fn_send_blocked(sr.destination) as stopped
     from share_request sr
     join development_record dr on dr.id = sr.record_id
     join person p on p.id = dr.person_id
     join guardianship_link g on g.child_id = p.id and g.guardian_id = $2
       and g.approved_at is not null and g.revoked_at is null
     where sr.id = $1`,
    [requestId, me],
  );
  if (rows.length === 0) notFound();
  const r = rows[0];
  const name: string = r.first_name;
  const m = /^(.*) <(.*)>$/.exec(r.destination ?? '');
  const clubName = m?.[1] ?? 'the club';
  const address = m?.[2] ?? r.destination;

  if (sent || r.dispatched_at) {
    return (
      <ParentPage>
        <HeaderMark back={{ href: '/home', label: 'Your family' }} />
        <h1 style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.015em' }}>Sent. {clubName} can open {name}&rsquo;s page.</h1>
        <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>You can pause or replace {name}&rsquo;s link any time — the club&rsquo;s access stops when you do.</div>
      </ParentPage>
    );
  }

  // 0160: the club asked Pitch to stop after this was asked for. The same
  // neutral words the send screen uses, and no button: nothing can go.
  if (r.stopped) {
    return (
      <ParentPage>
        <HeaderMark back={{ href: '/home', label: 'Your family' }} />
        {/* The hero panel (spec A part 14) and the neutral pill (part 12). */}
        <div className="hero-panel" style={{ padding: 17, gap: 8 }}>
          <div style={{ display: 'flex' }}><span className="pill">Not sent</span></div>
          <h1 style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.2, letterSpacing: '-0.015em' }}>We can&rsquo;t send to this club through Pitch</h1>
          <div className="pd-sub" style={{ fontSize: 13.5 }}>Nothing has been sent.</div>
        </div>
      </ParentPage>
    );
  }

  const act = dispatchSend;
  return (
    <ParentPage>
      <HeaderMark back={{ href: '/home', label: 'Your family' }} />
      <AskHead initial={name[0]} size={24} kicker={`${name} asked you to send this`}
        title={<>Send {name}&rsquo;s CV to {clubName}?</>}
        sub="Nothing has been sent. It only goes if you send it." />

      {/* The address is a fact to check, not an action: no green edge. */}
      <div className="ask" style={{ gap: 9 }}>
        <h2 className="sec-h">It goes to</h2>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div className="pd-mono" style={{ fontSize: 15, fontWeight: 700, wordBreak: 'break-all' }}>{address}</div>
          <div className="pd-small">{name} typed this from the club&rsquo;s trial notice</div>
        </div>
        {/* D-PD-2 (BUZ, 1 Oct): "Change the address" was drawn here as a
            button with no destination. It comes back when it is built. */}
      </div>

      <div className="card pd-ticks">
        <div style={{ fontSize: 13.5, fontWeight: 800 }}>What the club receives</div>
        {[
          `A link to ${name}'s CV — not a file, and not a copy.`,
          `You can pause or replace that link later. The club's access stops when you do.`,
          // "If they reply, it comes to you and <name> together" was here, and
          // it is false: a club's reply to the §19 email reaches nobody (U-11,
          // doc 15 §19). Removed, 28 Sep; a replacement line is BUZ's to approve.
        ].map((t) => (
          <div key={t} className="pd-tk"><TickGlyph /><div>{t}</div></div>
        ))}
        <hr className="pd-hair" />
        <div className="pd-tk"><CrossGlyph /><div>No contact details for you or {name} — not now, and not if they reply.</div></div>
      </div>

      <div className="card-sunken pd-info">
        <InfoGlyph />
        <div>If you&rsquo;d rather not, do nothing. This disappears by itself and {name} can ask again another time.</div>
      </div>

      {/* D-PD-0: two equal answers, nothing glows. D-PD-1: the No writes
          nothing and goes where the back link and silence already go (D-138).
          An <a>, never a second form: the write suite finds the send form by
          its requestId field. */}
      <div className="fl-answer">
        <form action={act}><input type="hidden" name="requestId" value={requestId} />
          <button type="submit" className="btn btn-secondary">Send it to {clubName}</button>
        </form>
        <Link href="/home" className="btn btn-secondary">Not this one</Link>
      </div>
    </ParentPage>
  );
}
