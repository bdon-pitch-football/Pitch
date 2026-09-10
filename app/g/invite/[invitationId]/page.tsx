// InviteGuardian.dc.html + GuardianReply.dc.html — the invitation as the
// guardian sees it, and the field-by-field reply where everything starts
// switched off. Copy verbatim, templated to the child.
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { sendReply } from './actions';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
  onAccent: '#06130c', purple: '#a479e2',
};

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

const label: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted };
const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };

export default async function GuardianInvite({ params, searchParams }: {
  params: Promise<{ invitationId: string }>;
  searchParams: Promise<{ reply?: string }>;
}) {
  const { invitationId } = await params;
  const { reply } = await searchParams;
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');

  const { rows } = await db.query(
    `select i.body, p.first_name, c.name as club_name, c.club_state,
       exists(select 1 from invitation_reply ir where ir.invitation_id = i.id) as replied
     from invitation i
     join registration r on r.id = i.registration_id
     join person p on p.id = r.player_id
     join club c on c.id = i.club_id
     join guardianship_link g on g.child_id = p.id and g.guardian_id = $2
       and g.approved_at is not null and g.revoked_at is null
     where i.id = $1`,
    [invitationId, me],
  );
  if (rows.length === 0) notFound();
  const r = rows[0];
  const name: string = r.first_name;
  const body = typeof r.body === 'string' ? JSON.parse(r.body) : r.body;
  const isTrial = body.kind === 'trial';

  if (r.replied) {
    return (
      <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
          <HeaderMark back={{ href: '/home', label: 'Your family' }} />
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.015em' }}>Reply sent to {r.club_name}.</div>
          <div style={{ fontSize: 13, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>Only what you switched on went with it.</div>
        </div>
      </div>
    );
  }

  if (reply) {
    const act = sendReply;
    const Toggle = ({ nameAttr, title, sub }: { nameAttr: string; title: string; sub: string }) => (
      <label style={{ ...card, display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{title}</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: T.muted, lineHeight: 1.45 }}>{sub}</div>
        </div>
        <input type="checkbox" name={nameAttr} style={{ width: 20, height: 20, accentColor: T.accent }} />
      </label>
    );
    return (
      <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
          <HeaderMark back={{ href: '/home', label: 'Your family' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.purple }}>{name}{isTrial ? ' · trial invitation' : ''}</div>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Reply to {r.club_name}</h1>
            <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500 }}>You choose what goes with your answer. Everything below starts switched off.</div>
          </div>
          <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}><input type="hidden" name="invitationId" value={invitationId} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={label}>Your answer</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ flex: 1, cursor: 'pointer' }}>
                  <input type="radio" name="answer" value="yes" defaultChecked style={{ position: 'absolute', opacity: 0 }} />
                  <div style={{ height: 52, borderRadius: 14, background: 'rgba(61,220,132,.14)', border: `1.5px solid ${T.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: T.accent }}>{name} will be there</div>
                </label>
                <label style={{ flex: 1, cursor: 'pointer' }}>
                  <input type="radio" name="answer" value="interested_not_date" style={{ position: 'absolute', opacity: 0 }} />
                  <div style={{ height: 52, borderRadius: 14, border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: T.muted }}>Interested, not that date</div>
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={label}>What you hand over</div>
              <Toggle nameAttr="share_phone" title="My phone number" sub="So they can call you about the day." />
              <Toggle nameAttr="share_email" title="My email address" sub="If you would rather they wrote." />
              <Toggle nameAttr="share_coach" title={`${name}'s current coach`} sub="Lets the two clubs talk to each other." />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={label}>Anything you want to say</div>
              <div style={{ ...card, minHeight: 74 }}>
                <textarea name="note" rows={3} style={{ background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, fontFamily: 'inherit', width: '100%', resize: 'vertical' }} />
              </div>
            </div>
            <div className="card-sunken" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7.5 v5" /><circle cx="12" cy="16.2" r="0.6" fill={T.muted} /></svg>
              <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>The moment you hand over a phone number, that part of the conversation leaves Pitch and we cannot switch it off for you. {name}&rsquo;s CV link is separate — you keep that control whatever you do here.</div>
            </div>
            <button type="submit" className="btn btn-primary">Send my reply</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/home', label: 'Your family' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.purple }}>Waiting on you</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.015em' }}>{r.club_name} would like {name} at a trial</h1>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500 }}>{name} has not been told. Nothing happens until you decide.</div>
        </div>
        <div style={{ ...card, border: `1px solid ${T.purple}`, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 13 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, color: T.secondary, flexShrink: 0 }}>{r.club_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{r.club_name}</div>
              {r.club_state === 'verified' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 999, background: T.accent }} />
                  <div style={{ fontSize: 11, fontWeight: 800, color: T.accent }}>Verified against Football Victoria</div>
                </div>
              )}
            </div>
          </div>
          {body.note && (
            <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 13 }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted, marginBottom: 4 }}>Their note</div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: T.secondary, lineHeight: 1.5 }}>&ldquo;{body.note}&rdquo;</div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {[
            `They have the CV, the name, the age and the club. They have never had your phone number or your email.`,
            'Doing nothing is a complete answer. They are told nothing either way.',
            'If you say yes, you choose what you hand over. It is not automatic.',
          ].map((t) => (
            <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
              <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>{t}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
          <a href={`/g/invite/${invitationId}?reply=1`} className="btn btn-primary">Reply to {r.club_name}</a>
          <div style={{ border: `1px solid ${T.line}`, color: T.secondary, borderRadius: 14, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>Not this time</div>
        </div>
        <div className="card-sunken" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7.5 v5" /><circle cx="12" cy="16.2" r="0.6" fill={T.muted} /></svg>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>&ldquo;Not this time&rdquo; does not remove {name} from their register and does not count against {name}. It closes this one invitation, and the club is simply not told.</div>
        </div>
      </div>
    </div>
  );
}
