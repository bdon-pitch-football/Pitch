// TrialsIndex.dc.html — the public trials board (D-74, D-90). One
// chronological noticeboard: no recommender, no personalisation, ever.
// Every listing carries its stamps; anything past its date never renders.
// Verified clubs get the in-Pitch route; unclaimed listings say plainly
// they were compiled and route via the club.
import { db } from '@/lib/db';
import Wordmark from '@/components/Wordmark';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
  onAccent: '#06130c', placeholder: '#6b7d73',
};

export const dynamic = 'force-dynamic';

export default async function TrialsBoard() {
  const { rows } = await db.query(
    `select t.title, t.time_venue, t.source,
       upper(to_char(t.trial_on, 'Mon')) as mon, to_char(t.trial_on, 'FMDD') as day,
       to_char(t.added_on, 'DD Mon') as listed, to_char(t.last_checked, 'DD Mon') as checked,
       c.name as club_name, c.club_state, c.public_slug
     from trial_notice t join club c on c.id = t.club_id
     where t.trial_on >= (now() at time zone 'Australia/Melbourne')::date
     order by t.trial_on`,
  );
  const listings = rows as {
    title: string; time_venue: string; source: string; mon: string; day: string;
    listed: string; checked: string; club_name: string; club_state: string; public_slug: string | null;
  }[];
  const lastChecked = listings.length ? listings[listings.length - 1].checked : null;

  const pill = (text: string, on = false): React.CSSProperties => ({
    borderRadius: 999, padding: '7px 14px', fontSize: 12, fontWeight: on ? 900 : 700,
    background: on ? T.accent : T.surface, color: on ? T.onAccent : T.secondary,
    border: on ? '1px solid transparent' : `1px solid ${T.line}`,
  });

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Wordmark size={20} /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Trials board</div>
          <div style={{ fontSize: 13.5, color: T.secondary, fontWeight: 500 }}>Club trials listed below, by trial date.</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          <div style={pill('All ages', true)}>All ages</div>
          {['U13', 'U14', 'U15', 'U16'].map((a) => <div key={a} style={pill(a)}>{a}</div>)}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: -4 }}>
          {['Boys', 'Girls', 'Mixed', 'Position', 'Region'].map((f) => <div key={f} style={pill(f)}>{f}</div>)}
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '13px 14px', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7 v5.5 l3.5 2" /></svg>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, lineHeight: 1.5 }}>Some clubs take your interest inside Pitch. The rest read a CV in their inbox like they always have — the button on each listing tells you which.{lastChecked ? ` Last checked ${lastChecked}.` : ''}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {listings.map((l) => {
            const verified = l.club_state === 'verified';
            return (
              <div key={l.club_name + l.title} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ background: verified ? 'rgba(61,220,132,.12)' : T.surface2, borderRadius: verified ? 11 : 12, padding: '7px 10px', textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.06em', color: verified ? T.accent : T.muted }}>{l.mon}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{l.day}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{l.club_name} · {l.title.replace(' trials', '')}</div>
                  <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{l.time_venue}</div>
                  <div style={{ fontSize: 10, color: T.muted, fontWeight: 700 }}>Listed {l.listed} · checked {l.checked}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 999, background: verified ? T.accent : T.placeholder }} />
                      <div style={{ fontSize: 10.5, fontWeight: verified ? 800 : 700, color: verified ? T.accent : T.muted }}>
                        {verified ? 'On Pitch — verified club' : 'Unclaimed listing · register via club'}
                      </div>
                    </div>
                    {verified ? (
                      <div style={{ background: T.accent, color: T.onAccent, borderRadius: 999, padding: '6px 11px', fontSize: 11, fontWeight: 900 }}>I&rsquo;m interested</div>
                    ) : (
                      <div style={{ border: `1px solid ${T.line}`, color: T.secondary, borderRadius: 999, padding: '6px 11px', fontSize: 11, fontWeight: 700 }}>Send my CV</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
