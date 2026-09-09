// InterestGuardian.dc.html — copy verbatim. The guardian reads exactly what
// the child wrote before it reaches any club's register.
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { dispatchInterest } from './actions';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
  onAccent: '#06130c', red: '#e34948', purple: '#a479e2',
};

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

const label: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted };
const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };

export default async function GuardianInterest({ params, searchParams }: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const { requestId } = await params;
  const { sent } = await searchParams;
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');

  const { rows } = await db.query(
    `select rr.note, rr.positions, rr.dispatched_at, p.first_name,
       c.name as club_name, c.club_state,
       (select name from squad where id = rr.squad_target) as squad_name
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
      <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
          <HeaderMark />
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.015em' }}>{name} is on {r.club_name}&rsquo;s register.</div>
          <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>You can take {name} off the register any time from the Manage page. Their access ends when you do.</div>
        </div>
      </div>
    );
  }

  const act = dispatchInterest.bind(null, requestId);
  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.purple }}>{name} asked you to send this</div>
          <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.015em' }}>Put {name} on {r.club_name.replace(/ FC$| SC$/, '')}&rsquo;s register?</div>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500 }}>Nothing has been sent. It only goes if you send it.</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={label}>What {name} wrote</div>
          <div style={{ ...card, border: `1px solid ${T.accent}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 22 }}>
              {[['Squad', r.squad_name ?? '—'], [`Where ${name} would play`, (r.positions ?? []).join(', ') || '—']].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>{k}</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{v}</div>
                </div>
              ))}
            </div>
            {r.note && (
              <>
                <div style={{ height: 1, background: T.line }} />
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>{name}&rsquo;s line</div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: T.secondary, lineHeight: 1.5 }}>&ldquo;{r.note}&rdquo;</div>
                </div>
              </>
            )}
          </div>
          <div style={{ border: `1px solid ${T.line}`, background: 'transparent', color: T.secondary, borderRadius: 14, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>Edit what {name} wrote</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={label}>It goes to</div>
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, color: T.secondary, flexShrink: 0 }}>{r.club_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}</div>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 800 }}>{r.club_name}</div>
              {r.club_state === 'verified' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 999, background: T.accent }} />
                  <div style={{ fontSize: 11, fontWeight: 800, color: T.accent }}>Verified club on Pitch</div>
                </div>
              )}
            </div>
          </div>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>No email address to check this time — it goes into the club&rsquo;s own register inside Pitch, not to an inbox.</div>
        </div>

        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800 }}>What the club receives</div>
          {[
            `A link to ${name}'s CV — not a file, and not a copy. They cannot download or keep one.`,
            `You can take ${name} off the register any time. Their access ends when you do.`,
            `If they invite ${name} to a trial, that invitation comes to you first.`,
          ].map((t) => (
            <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
              <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>{t}</div>
            </div>
          ))}
          <div style={{ height: 1, background: T.line }} />
          {[
            `No contact details for you or ${name} — not now, and not if they reply.`,
            `They see the name, the age and the club — that is how a coach picks a squad. No birthday, no school, no address, and no way to contact either of you.`,
          ].map((t) => (
            <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M6 6 L18 18 M18 6 L6 18" /></svg>
              <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>{t}</div>
            </div>
          ))}
        </div>

        <div className="card-sunken" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7.5 v5" /><circle cx="12" cy="16.2" r="0.6" fill={T.muted} /></svg>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>A register is a list of who wants to be there, not a decision anyone owes {name} — so there is no result coming and nothing to be turned down from. If you&rsquo;d rather not, do nothing — this disappears by itself.</div>
        </div>

        <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
          <button type="submit" className="btn btn-primary">Register {name}&rsquo;s interest</button>
          <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: T.muted }}>Not this one</div>
        </form>
      </div>
    </div>
  );
}
