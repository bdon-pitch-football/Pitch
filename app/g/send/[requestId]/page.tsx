// SendCVGuardian.dc.html — the guardian's confirm-and-send. Copy verbatim.
// Nothing has been sent until the button is pressed; ignoring it makes it
// disappear on its own (D-138 — silence is a complete answer).
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { dispatchSend } from './actions';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
  onAccent: '#06130c', red: '#e34948', purple: '#a479e2',
};

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

const label: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted };
const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };

export default async function GuardianSend({ params, searchParams }: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ sent?: string; link?: string }>;
}) {
  const { requestId } = await params;
  const { sent, link } = await searchParams;
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');

  const { rows } = await db.query(
    `select sr.destination, sr.dispatched_at, p.first_name
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
      <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
          <HeaderMark />
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.015em' }}>Sent. {clubName} can open {name}&rsquo;s page.</div>
          {/* Development only. In production this block is absent, which is
              what makes a rate-limited send byte-identical to a real one
              (L38/L39) — there is no link to differ by. */}
          {link && process.env.NODE_ENV !== 'production' && (
            <div style={{ ...card, border: `1.5px solid ${T.accent}`, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>The link that went — dev only, email sending arrives with Resend</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.accent, wordBreak: 'break-all' }}>pitchfootball.com.au/p/{link}</div>
            </div>
          )}
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>You can pause or replace {name}&rsquo;s link any time — the club&rsquo;s access stops when you do.</div>
        </div>
      </div>
    );
  }

  const act = dispatchSend.bind(null, requestId);
  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.purple }}>{name} asked you to send this</div>
          <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.015em' }}>Send {name}&rsquo;s CV to {clubName}?</div>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500 }}>Nothing has been sent. It only goes if you send it.</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={label}>It goes to</div>
          <div style={{ ...card, border: `1px solid ${T.accent}`, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', wordBreak: 'break-all' }}>{address}</div>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{name} typed this from the club&rsquo;s trial notice</div>
          </div>
          <div style={{ border: `1px solid ${T.line}`, background: 'transparent', color: T.secondary, borderRadius: 14, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>Change the address</div>
        </div>

        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800 }}>What the club receives</div>
          {[
            `A link to ${name}'s CV — not a file, and not a copy.`,
            `You can pause or replace that link later. The club's access stops when you do.`,
            `If they reply, it comes to you and ${name} together.`,
          ].map((t) => (
            <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
              <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>{t}</div>
            </div>
          ))}
          <div style={{ height: 1, background: T.line }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M6 6 L18 18 M18 6 L6 18" /></svg>
            <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>No contact details for you or {name} — not now, and not if they reply.</div>
          </div>
        </div>

        <div className="card-sunken" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7.5 v5" /><circle cx="12" cy="16.2" r="0.6" fill={T.muted} /></svg>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>If you&rsquo;d rather not, do nothing. This disappears by itself and {name} can ask again another time.</div>
        </div>

        <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
          <button type="submit" className="btn btn-primary">Send it to {clubName}</button>
          <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: T.muted }}>Not this one</div>
        </form>
      </div>
    </div>
  );
}
