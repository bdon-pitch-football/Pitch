'use client';
// RegisterInterest.dc.html form body — copy verbatim, u16 variant.
import { useState } from 'react';
import { HeaderMark } from '@/components/Wordmark';
import { POSITIONS, type PositionCode } from '@/lib/football';
import { composeInterest } from './actions';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84',
  onAccent: '#06130c', red: '#e34948', purple: '#a479e2',
};

const label: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted };
const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px' };

export default function InterestForm({ recordId, club, squads, cvPositions, preselectSquad }: {
  recordId: string;
  club: { id: string; name: string; suburb: string };
  squads: { id: string; name: string }[];
  cvPositions: string[];
  preselectSquad?: string;
}) {
  const [positions, setPositions] = useState<string[]>(cvPositions);
  const [note, setNote] = useState('');
  const toggle = (code: string) =>
    setPositions((p) => (p.includes(code) ? p.filter((c) => c !== code) : p.length < 3 ? [...p, code] : p));
  const act = composeInterest;

  const Row = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
      {ok
        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M6 6 L18 18 M18 6 L6 18" /></svg>}
      <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>{children}</div>
    </div>
  );

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        <HeaderMark back={{ href: '/home' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Register your interest</div>
          <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>{club.name} keep a register of players who want to be there. Put your name on it and they have your CV when they&rsquo;re looking.</div>
        </div>
        <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}><input type="hidden" name="recordId" value={recordId} />
          <input type="hidden" name="clubId" value={club.id} />
          <input type="hidden" name="positions" value={positions.join(',')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div className="field-label">Interested in</div>
            <div style={{ ...card, border: `1px solid ${T.accent}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, color: T.secondary, flexShrink: 0 }}>{club.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{club.name}</div>
                <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{club.suburb}</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div className="field-label">Which squad</div>
            <div style={card}>
              <select name="squadId" defaultValue={preselectSquad ?? ''}>
                <option value="">—</option>
                {squads.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div className="field-label">Where you&rsquo;d play</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(Object.keys(POSITIONS) as PositionCode[]).map((code) => {
                const on = positions.includes(code);
                return (
                  <button type="button" key={code} onClick={() => toggle(code)} style={{
                    borderRadius: 999, padding: '7px 12px', fontSize: 12, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer',
                    background: on ? 'rgba(61,220,132,.14)' : 'transparent',
                    color: on ? T.accent : T.muted,
                    border: on ? '1px solid transparent' : `1px solid ${T.line}`,
                  }}>{code}</button>
                );
              })}
            </div>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>Filled in from your CV. Change it if you&rsquo;d play somewhere else for this club.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div className="field-label">One line, if you want</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted }}>{note.length} / 140</div>
            </div>
            <div style={card}>
              <textarea name="note" value={note} onChange={(e) => setNote(e.target.value.slice(0, 140))} rows={2} placeholder="Right-footed 10. Happy anywhere across the front three." style={{ background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, fontFamily: 'inherit', width: '100%', resize: 'vertical', minHeight: 40 }} />
            </div>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>Football only. Your parent reads this before it goes anywhere.</div>
          </div>
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 11 }}>
            <Row ok>A link to your CV — the live page, not a copy of it.</Row>
            <Row ok>Your name, your age, your club, the squad, where you&rsquo;d play, and your one line — what a coach picks a squad on.</Row>
            <div style={{ height: 1, background: T.line }} />
            <Row ok={false}>Not your birthday, your phone, your email, your address or your school.</Row>
            <Row ok={false}>Take yourself off and the link stops working the same minute.</Row>
          </div>
          <div style={{ borderRadius: 18, background: 'linear-gradient(160deg, #123326, #0c1d14)', border: `1px solid ${T.line}`, padding: 17, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(164,121,226,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.purple} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="2.6" /><circle cx="16.5" cy="9.5" r="2" /><path d="M4.5 20 c0-3 2-5 4.5-5 s4.5 2 4.5 5 M14 20 c0-2.4 1.2-4 2.5-4 s2.5 1.6 2.5 4" /></svg>
            </div>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 900 }}>Your parent sends this one</div>
              <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>You&rsquo;re under 16, so we ask your parent to read it and press send. It&rsquo;s the same for every club.</div>
            </div>
          </div>
          <div className="card-sunken" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7.5 v5" /><circle cx="12" cy="16.2" r="0.6" fill={T.muted} /></svg>
            <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>Being on a register isn&rsquo;t a trial spot and it isn&rsquo;t a decision, so there is nothing here to be turned down from. You stay on it until you take yourself off — this season, and the next one.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
            <button type="submit" className="btn btn-primary">Ask my parent to send it</button>
            <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: T.muted }}>Cancel</div>
          </div>
        </form>
      </div>
    </div>
  );
}
