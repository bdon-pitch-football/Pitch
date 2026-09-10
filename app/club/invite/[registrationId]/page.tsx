// InviteCompose.dc.html — copy verbatim, templated to the player. The
// where-this-actually-goes panel is the product's honesty in four lines.
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { sendInvitation } from './actions';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
  onAccent: '#06130c', red: '#e34948', amber: '#eda100',
};

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function InviteCompose({ params }: { params: Promise<{ registrationId: string }> }) {
  const { registrationId } = await params;
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const { rows } = await db.query(
    `select p.first_name, c.name as club_name,
       to_char(r.created_at at time zone 'Australia/Melbourne', 'FMMonth') as reg_month
     from registration r join person p on p.id = r.player_id join club c on c.id = r.club_id
     where r.id = $1 and r.withdrawn_at is null and fn_can_work_register($2, r.club_id)`,
    [registrationId, me],
  );
  if (rows.length === 0) notFound();
  const r = rows[0];
  const name: string = r.first_name;
  const act = sendInvitation;

  const label: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted };
  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/club/register', label: 'The register' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.amber }}>{r.club_name}</div>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Invite {name}</div>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>{name} went on your register in {r.reg_month}. This is the only way you can reach {name}.</div>
        </div>
        <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}><input type="hidden" name="registrationId" value={registrationId} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="field-label">What you&rsquo;re sending</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ flex: 1, cursor: 'pointer' }}>
                <input type="radio" name="kind" value="trial" defaultChecked style={{ position: 'absolute', opacity: 0 }} />
                <div style={{ height: 62, borderRadius: 14, background: 'rgba(61,220,132,.14)', border: `1.5px solid ${T.accent}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: T.accent }}>A trial invitation</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: T.secondary }}>has a date</div>
                </div>
              </label>
              <label style={{ flex: 1, cursor: 'pointer' }}>
                <input type="radio" name="kind" value="interested" style={{ position: 'absolute', opacity: 0 }} />
                <div style={{ height: 62, borderRadius: 14, border: `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.muted }}>We&rsquo;re interested</div>
                  <div style={{ fontSize: 10.5, fontWeight: 500, color: T.muted }}>no date yet</div>
                </div>
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="field-label">A line from you, if you want</div>
            <div style={{ ...card, minHeight: 74 }}>
              <textarea name="body" rows={3} placeholder={`Saw ${name} at the trials. We're short in the 16s and we'd like a proper look.`} style={{ background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, fontFamily: 'inherit', width: '100%', resize: 'vertical' }} />
            </div>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>Football only. A parent reads this before {name} does.</div>
          </div>
          <div style={{ borderRadius: 16, background: 'linear-gradient(160deg, #123326 0%, #0c1d14 100%)', border: `1px solid ${T.line}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800 }}>Where this actually goes</div>
            {[
              [`Into ${name}'s parent's Pitch account. Not an email, not a text.`, true],
              [`They decide what ${name} hears about it, and when.`, true],
              ['You get no phone number and no email address — not now, and not if they say yes.', false],
              ['If they ignore it, you are told nothing. Silence is an allowed answer.', false],
            ].map(([t, ok]) => (
              <div key={t as string} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                {ok
                  ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M6 6 L18 18 M18 6 L6 18" /></svg>}
                <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>{t as string}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
            <button type="submit" className="btn btn-primary">Send it to {name}&rsquo;s parent</button>
            <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: T.muted }}>Cancel</div>
          </div>
        </form>
      </div>
    </div>
  );
}
