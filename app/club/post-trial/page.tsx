// PostATrial.dc.html — copy verbatim. Naming positions is what gets the
// right players in front of you; leaving them blank is an open trial.
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionPersonId } from '@/lib/session';
import { HeaderMark } from '@/components/Wordmark';
import { postTrial } from './actions';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84', onAccent: '#06130c',
};

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };
const label: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted };
const section: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted };
const input: React.CSSProperties = { background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 14.5, fontWeight: 700, fontFamily: 'inherit', padding: 0, width: '100%' };

export default async function PostATrial({ searchParams }: { searchParams: Promise<{ posted?: string; error?: string }> }) {
  const me = await getSessionPersonId();
  if (!me) redirect('/signin');
  const { posted } = await searchParams;
  const { rows } = await db.query(
    `select c.name, c.contact_email from club c join membership m on m.club_id = c.id and m.person_id = $1
       and m.role in ('technical_director','club_admin') and m.ended_at is null
     where c.club_state = 'verified' limit 1`,
    [me],
  );
  if (rows.length === 0) redirect('/home');
  const c = rows[0];

  if (posted) {
    return (
      <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
          <HeaderMark />
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.015em' }}>Posted. It&rsquo;s on your club page and the trials board now.</div>
          <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>It comes down by itself the day after the trial, so nobody turns up to something that already happened.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Post a trial</div>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>Goes on your club page and on the trials board the same minute. {c.name}.</div>
        </div>
        <form action={postTrial} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={section}>Which squad</div>
            <div style={card}><div className="field-label">Notice title</div><input style={input} name="title" placeholder="U14 & U15 Boys trials" required /></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={section}>When and where</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ ...card, flex: 1 }}><div className="field-label">Date</div><input style={input} name="trial_on" type="date" required /></div>
              <div style={{ ...card, flex: 1 }}><div className="field-label">Time</div><input style={input} name="time" placeholder="9:00 AM" required /></div>
            </div>
            <div style={card}><div className="field-label">Ground</div><input style={input} name="ground" placeholder="Riverside Park, Pitch 2" required /></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={section}>Positions you&rsquo;re short of</div>
            <div style={card}><div className="field-label">Codes, comma-separated — blank for an open trial</div><input style={input} name="positions" placeholder="GK, CB" /></div>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>Leave it blank for an open trial. Naming positions is what gets the right players in front of you — a keeper scanning the board sees your notice first.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={section}>How to register</div>
            <div style={card}><textarea name="how" rows={2} placeholder="Turn up 15 minutes early. Boots, shin pads, water. Registration at the clubhouse." style={{ ...input, fontWeight: 500, fontSize: 13.5, lineHeight: 1.5, resize: 'vertical' }} /></div>
            <div style={card}><div className="field-label">Where CVs should go</div><input style={{ ...input, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13.5, fontWeight: 500 }} name="cv_email" type="email" defaultValue={c.contact_email ?? ''} placeholder="football@yourclub.com.au" /></div>
          </div>
          <div className="card-sunken" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7 v5.5 l3.5 2" /></svg>
            <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>It comes down by itself the day after the trial, so nobody turns up to something that already happened. Players who want to be seen beforehand send their CV to the address above — it arrives as an ordinary email with a link.</div>
          </div>
          <button type="submit" className="btn btn-primary">Post it</button>
        </form>
      </div>
    </div>
  );
}
