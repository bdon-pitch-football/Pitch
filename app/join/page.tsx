'use client';
// The sign-up door — SignUp.dc.html + ParentDetails.dc.html, copy verbatim.
// This block ships the u16 player path (the pending invitation, D-17); the
// other role doors arrive with their flows.
import { useState } from 'react';
import { startPendingInvitation } from './actions';

const T = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', placeholder: '#6b7d73',
  accent: '#3ddc84', onAccent: '#06130c',
};

const Logo = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
    <svg width="26" height="26" viewBox="0 0 26 26"><rect width="26" height="26" rx="8" fill={T.accent} /><rect x="5" y="6.5" width="16" height="13" rx="1.5" fill="none" stroke={T.onAccent} strokeWidth="1.6" /><line x1="13" y1="6.5" x2="13" y2="19.5" stroke={T.onAccent} strokeWidth="1.6" /><circle cx="13" cy="13" r="2.7" fill="none" stroke={T.onAccent} strokeWidth="1.6" /></svg>
    <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '0.02em' }}>Pitch</div>
  </div>
);

const field: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', flexDirection: 'column', gap: 3 };
const fieldLabel: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted };
const input: React.CSSProperties = { background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', padding: 0 };

const ROLES = [
  ['player', 'Player', 'Build your football CV'],
  ['coach', 'Coach', 'Develop your squad'],
  ['parent', 'Parent / Guardian', 'Approve and see their record'],
  ['club', 'Club', "Your club's home ground"],
] as const;

export default function Join() {
  const [role, setRole] = useState('player');
  const [step, setStep] = useState<'signup' | 'parent'>('signup');
  const [firstName, setFirstName] = useState('');
  const [dob, setDob] = useState('');
  const [agreed, setAgreed] = useState(false);

  const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;
  const canContinue = role === 'player' && firstName.trim() && dob && agreed;

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        {step === 'signup' ? (
          <>
            <Logo />
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>What&rsquo;s your position?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {ROLES.map(([key, title, sub]) => (
                <button key={key} onClick={() => setRole(key)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                  background: T.surface, borderRadius: 16, padding: '15px 14px',
                  border: role === key ? `1.5px solid ${T.accent}` : `1px solid ${T.line}`,
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: role === key ? 'rgba(61,220,132,.14)' : T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={role === key ? T.accent : T.secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {key === 'player' && <><circle cx="13" cy="5" r="2.4" /><path d="M9 21 l2.5-6 3-2 -1-4.5 -4 2.5 M14.5 8.5 l3.5 2 M13.5 13 l3 3.5 2 4" /></>}
                      {key === 'coach' && <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5 V3 h6 v1.5 M9 10 h6 M9 14 h6" /></>}
                      {key === 'parent' && <><circle cx="9" cy="8" r="2.6" /><circle cx="16.5" cy="9.5" r="2" /><path d="M4.5 20 c0-3 2-5 4.5-5 s4.5 2 4.5 5 M14 20 c0-2.4 1.2-4 2.5-4 s2.5 1.6 2.5 4" /></>}
                      {key === 'club' && <><path d="M6 21 V4 l11 3.5 L6 11" /></>}
                    </svg>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>{title}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: T.muted }}>{sub}</div>
                  </div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <div style={field}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>First name</div>
                <input style={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Your first name" />
              </div>
              <div style={field}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted }}>Date of birth</div>
                <input style={input} type="date" value={dob} onChange={(e) => setDob(e.target.value)} placeholder="DD / MM / YYYY" />
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, color: T.muted }}>Under 16? A parent will need to approve your profile before it goes live.</div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ width: 17, height: 17, accentColor: T.accent }} />
              <span style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>
                I agree to the <a href="/terms" style={{ color: T.accent, fontWeight: 700, textDecoration: 'none' }}>Terms</a> and <a href="/privacy" style={{ color: T.accent, fontWeight: 700, textDecoration: 'none' }}>Privacy Policy</a>
              </span>
            </label>
            <button disabled={!canContinue} onClick={() => setStep('parent')} style={{
              background: T.accent, color: T.onAccent, borderRadius: 15, padding: 15, fontSize: 15, fontWeight: 900,
              border: 'none', cursor: canContinue ? 'pointer' : 'default', opacity: canContinue ? 1 : 0.45, fontFamily: 'inherit',
            }}>Continue</button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button onClick={() => setStep('signup')} aria-label="Back" style={{ width: 44, height: 44, margin: -11, background: 'none', border: 'none', cursor: 'pointer' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.secondary} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5 L8 12 L15 19" /></svg>
              </button>
              <Logo />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.accent }}>Last step</div>
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.015em' }}>Who should we ask?</div>
              <div style={{ fontSize: 14, color: T.secondary, fontWeight: 500, lineHeight: 1.55 }}>
                You&rsquo;re {age}, so a parent has to approve your page before anyone can see it. Give us one way to reach them.
              </div>
            </div>
            <form action={startPendingInvitation} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <input type="hidden" name="firstName" value={firstName} />
              <input type="hidden" name="dob" value={dob} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div style={field}><div style={fieldLabel}>Their name</div><input style={input} name="guardianName" required /></div>
                <div style={field}><div style={fieldLabel}>Their mobile</div><input style={input} name="guardianPhone" type="tel" placeholder="0412 345 678" required /></div>
                <div style={field}><div style={fieldLabel}>Their email — optional</div><input style={input} name="guardianEmail" type="email" /></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {[
                  'We send them one text with a link. Nothing else, ever, unless you ask them for something.',
                  'They approve your page, and after that they hold the controls.',
                  'Wrong number? You can change it while you wait.',
                ].map((t) => (
                  <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
                    <div style={{ fontSize: 12.5, color: T.secondary, fontWeight: 500, lineHeight: 1.5 }}>{t}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 16, padding: '15px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7.5 v5" /><circle cx="12" cy="16.2" r="0.6" fill={T.muted} /></svg>
                <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>Put in your own number and nothing happens — the approval has to come from an adult&rsquo;s own phone, and we check the two are different.</div>
              </div>
              <button type="submit" style={{ background: T.accent, color: T.onAccent, borderRadius: 14, height: 50, fontSize: 15, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Ask them to approve it</button>
              <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.muted, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Why does a parent have to do this?</div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
