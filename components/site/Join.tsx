'use client';
// The paid-ad landing page at /join (20 Sep). Meta clicks used to land on the
// front page, where the form sits about 12,500px down: three days, 66 clicks,
// nothing. This is the same offer with nothing in front of it — a wordmark, a
// line that names the person who clicked, and the field.
//
// It does not touch the front page. Site.tsx is byte-identical on this branch,
// so an organic visitor sees exactly what they saw yesterday, and the palette,
// wordmark and form below are copies of Site.tsx's rather than imports —
// Site.tsx exports only its default, and making it export more would mean
// editing it. The values are the same values; if the site's palette ever moves,
// this file moves with it by hand.
//
// What it shares for real: CONSENT_TEXT and EMAIL_RE from lib/consent (the
// form renders the constant, never a retyped copy of it), the POST to
// /api/waitlist, and the utm tags kept in this tab's sessionStorage under the
// same key and field list the site uses, so a sign-up from here is tagged with
// the ad exactly as a sign-up from the front page is.
//
// Copy discipline: every claim below already exists in an approved caption or
// on the front page. No launch date anywhere — John, 18 Sep: no future-date
// claims on a paid surface. No trackers, no pixel, no third-party anything.
import { useEffect, useRef, useState } from 'react';
import { CONSENT_TEXT, EMAIL_RE, type Role } from '@/lib/consent';

// Site.tsx's palette, copied (see above).
const C = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84', onAccent: '#06130c',
  amber: '#eda100', purple: '#a479e2', orange: '#d95926',
};
const ACCENT: Record<Role, string> = { player: C.accent, parent: C.purple, coach: C.orange, club: C.amber };
const ROLES: Role[] = ['player', 'parent', 'coach', 'club'];

// The ad a visit came from, kept for this tab only, first touch wins — the
// same key and fields as the front page so the two surfaces agree.
const UTM_KEY = 'pitch-site-utm';
const UTM_FIELDS = ['utm_source', 'utm_campaign', 'utm_content'] as const;

const Wordmark = ({ size = 22 }: { size?: number }) => (
  <span aria-label="Pitch" style={{ display: 'inline-flex', alignItems: 'center', fontWeight: 900, fontSize: size, letterSpacing: '-.035em', color: C.ink, lineHeight: 1 }}>
    P
    <svg viewBox="0 0 74 97" style={{ height: '.715em', width: 'auto', margin: '0 -.085em', display: 'block' }} fill="none" aria-hidden>
      <line x1="37" y1="6.5" x2="37" y2="90.5" stroke={C.accent} strokeWidth="13" strokeLinecap="round" />
      <circle cx="37" cy="48.5" r="32" fill="none" stroke={C.accent} strokeWidth="10" />
    </svg>
    TCH
  </span>
);

// The four role buttons. "Parent" carries who they are joining for (BUZ,
// 20 Sep) because a parent of a 12-year-old should not have to work out
// whether this page is for them. There is deliberately no under-18 player
// button: under 18, a parent joins, which is what the consent text says.
const ROLE_LABEL: Record<Role, { label: string; note?: string }> = {
  player: { label: 'Player 18+' },
  parent: { label: 'Parent', note: 'joining for a player under 18' },
  coach: { label: 'Coach' },
  club: { label: 'Club' },
};

// One screen's worth of words per role. Every line is an approved claim: the
// reels captions (reels-clubs-v1, reels-personas-v1) and the front page's own
// "who it is for" and pricing sections. Nothing here is new, and nothing here
// is dated.
const COPY: Record<Role, { kicker: string; head: string; headAccent: string; lead: string; ticks: string[] }> = {
  club: {
    kicker: 'For football clubs',
    head: 'Every player who wants in,',
    headAccent: 'in one list.',
    lead: 'Join the waitlist. One email from us when Pitch opens, and nothing else.',
    ticks: [
      'Every player who registers interest in your club, in one list, by age group and position.',
      'A football CV behind every name, and trial invites sent inside Pitch.',
      'Your club page, squads and trial notices are free. The Interest Register is $54 a month, or $329 a year.',
    ],
  },
  player: {
    kicker: 'For players 18 and over',
    head: 'Every club. Every season.',
    headAccent: 'One link.',
    lead: 'Join the waitlist. One email from us when Pitch opens, and nothing else.',
    ticks: [
      'Every club you’ve played for, the seasons, the stats you choose to show and your clips.',
      'One football CV, sent to a club as a link. They never get your phone number, your email or your address.',
      'Free for players 18 and over. The trials board lists club trials by date.',
    ],
  },
  parent: {
    kicker: 'For parents',
    head: 'You stay in charge',
    headAccent: 'until they turn 18.',
    lead: 'Join the waitlist. One email from us when Pitch opens, and nothing else.',
    ticks: [
      'When a club wants your child at a trial, the invitation reaches you and your child at the same moment.',
      'Under 18, nothing goes back to the club until you approve the reply.',
      'Every club you’ve sent your child’s CV to, in one list. Switch one off and that club’s link stops working that minute.',
    ],
  },
  coach: {
    kicker: 'For coaches',
    head: 'Years of coaching.',
    headAccent: 'Where’s it written down?',
    lead: 'Join the waitlist. One email from us when Pitch opens, and nothing else.',
    ticks: [
      'Build your coaching CV once: every role, every licence, one link to send.',
      'Clubs post coaching roles, paid or volunteer. Apply with your coaching CV.',
      'Your phone number and email stay with you unless you choose to share them.',
    ],
  },
};

export default function Join({ initialRole }: { initialRole: Role }) {
  // The ad chose the role on the server, so the first paint is already the
  // right words: nothing swaps under the reader and nothing shifts.
  const [role, setRole] = useState<Role>(initialRole);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [tried, setTried] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Remember which ad brought this visit, if any. Nothing renders from it.
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      if (!q.get('utm_source') || window.sessionStorage.getItem(UTM_KEY)) return;
      const tags: Record<string, string> = {};
      UTM_FIELDS.forEach((k) => { const v = q.get(k); if (v) tags[k] = v; });
      window.sessionStorage.setItem(UTM_KEY, JSON.stringify(tags));
    } catch { /* storage unavailable: the sign-up just records 'web' */ }
  }, []);

  const emailOk = EMAIL_RE.test(email);
  const submit = async () => {
    setTried(true);
    if (!emailOk) return;
    setState('sending');
    const utm: Record<string, string> = {};
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(UTM_KEY) || '{}');
      UTM_FIELDS.forEach((k) => { if (typeof saved?.[k] === 'string') utm[k] = saved[k]; });
    } catch { /* no tags: the sign-up records 'web' */ }
    try {
      const r = await fetch('/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...utm, email, role }) });
      setState(r.ok ? 'done' : 'error');
    } catch { setState('error'); }
  };

  // Left/right move between the four, as they do on the front page.
  const onRoleKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = ROLES[(ROLES.indexOf(role) + (e.key === 'ArrowRight' ? 1 : ROLES.length - 1)) % ROLES.length];
    setRole(next);
    tabsRef.current?.querySelector<HTMLButtonElement>(`#join-role-${next}`)?.focus();
  };

  const copy = COPY[role];
  const accent = ACCENT[role];

  return (
    <div style={{ background: C.bg, color: C.ink, minHeight: '100dvh' }}>
      <style>{`
        .jn-btn { font-family: inherit; cursor: pointer; border-radius: 12px; transition: background .18s, border-color .18s, color .18s, filter .18s, transform .12s; }
        .jn-btn:active { transform: translateY(1px); }
        .jn-go:hover:not(:disabled) { filter: brightness(1.06); }
        .jn-go:disabled { cursor: default; opacity: .8; }
        .jn-field { background: ${C.surface2}; border: 1px solid ${C.line}; border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; transition: border-color .18s, background .18s; }
        .jn-field:focus-within { border-color: ${C.accent}; background: #1d2a24; }
        .jn-field input::placeholder { color: #6b7d73; font-weight: 500; }
        .jn-link { color: ${C.secondary}; text-decoration: none; font-weight: 700; }
        .jn-link:hover { color: ${C.ink}; }
        :focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) {
          .jn-btn, .jn-field, .jn-go { transition: none !important; }
          .jn-btn:active { transform: none; }
        }
      `}</style>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '22px 16px 40px', boxSizing: 'border-box' }}>
        <a href="/" className="jn-link" style={{ display: 'inline-flex' }} aria-label="Pitch Football home"><Wordmark /></a>

        <div style={{ marginTop: 26, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: accent }}>{copy.kicker}</div>
        <h1 style={{ fontSize: 'clamp(28px, 8vw, 34px)', lineHeight: 1.08, margin: '10px 0', fontWeight: 900, letterSpacing: '-0.02em' }}>
          {copy.head}<br /><span style={{ color: accent }}>{copy.headAccent}</span>
        </h1>
        <p style={{ color: C.secondary, fontSize: 15.5, fontWeight: 500, lineHeight: 1.5, margin: '0 0 20px' }}>{copy.lead}</p>

        {state === 'done' ? (
          <div style={{ background: C.surface, border: `1px solid ${C.accent}`, borderRadius: 18, padding: '26px 22px', textAlign: 'center' }}>
            <svg aria-hidden width="120" height="70" viewBox="0 0 120 70" style={{ marginBottom: 10 }}>
              <rect x="30" y="6" width="60" height="44" rx="2" fill="none" stroke={C.ink} strokeWidth="2.5" />
              {[42, 54, 66, 78].map((x) => <line key={x} x1={x} y1="6" x2={x} y2="50" stroke="rgba(238,245,240,.25)" strokeWidth="1" />)}
              {[17, 28, 39].map((y) => <line key={y} x1="30" y1={y} x2="90" y2={y} stroke="rgba(238,245,240,.25)" strokeWidth="1" />)}
              <line x1="0" y1="50" x2="120" y2="50" stroke={C.line} strokeWidth="2" />
              <circle cx="60" cy="30" r="7" fill={C.accent} />
            </svg>
            <div style={{ fontSize: 22, fontWeight: 900 }}>You’re on the list.</div>
            <div style={{ fontSize: 14.5, color: C.secondary, fontWeight: 500, marginTop: 6 }}>We’ll email you once, when we open.</div>
          </div>
        ) : (
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 18, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* The front page's own notice, kept word for word: this page takes the
                same sign-up, so it carries the same child-safety line (BUZ, 20 Sep). */}
            <div style={{ background: 'rgba(164,121,226,.12)', border: '1px solid rgba(164,121,226,.35)', borderRadius: 12, padding: '10px 12px', fontSize: 13, fontWeight: 600, color: C.ink, lineHeight: 1.5 }}>
              Under 18? Ask a parent to add their email instead. We never take a child’s details before there is a parent to ask.
            </div>
            <div id="join-who" style={{ fontSize: 12.5, color: C.muted, fontWeight: 700 }}>Who are you?</div>
            <div ref={tabsRef} role="radiogroup" aria-labelledby="join-who" onKeyDown={onRoleKey}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
              {ROLES.map((r) => {
                const on = role === r;
                return (
                  <button key={r} id={`join-role-${r}`} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
                    onClick={() => setRole(r)} className="jn-btn"
                    style={{ minHeight: 48, padding: '8px 4px', border: `1px solid ${on ? ACCENT[r] : C.line}`, background: on ? `${ACCENT[r]}22` : C.surface2, color: on ? C.ink : C.secondary, fontSize: 12.5, fontWeight: 800, textAlign: 'center', lineHeight: 1.2 }}>
                    {ROLE_LABEL[r].label}
                    {ROLE_LABEL[r].note ? (
                      <span style={{ display: 'block', fontWeight: 600, fontSize: 10, color: on ? C.secondary : C.muted, marginTop: 2, lineHeight: 1.15 }}>{ROLE_LABEL[r].note}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <label className="jn-field" htmlFor="join-email">
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted }}>Email · 18 and over</span>
              <input id="join-email" name="email" type="email" inputMode="email" autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                placeholder="you@example.com" aria-describedby="join-consent"
                style={{ background: 'transparent', border: 'none', outline: 'none', color: C.ink, fontSize: 16, fontWeight: 700, fontFamily: 'inherit', padding: 0, width: '100%' }} />
            </label>

            <button type="button" onClick={submit} disabled={state === 'sending'} className="jn-btn jn-go"
              style={{ width: '100%', height: 50, border: 'none', background: C.accent, color: C.onAccent, fontSize: 15.5, fontWeight: 900, letterSpacing: '0.02em' }}>
              {state === 'sending' ? 'Adding you…' : 'Join the waitlist'}
            </button>

            {/* The wording stored against this sign-up is the wording shown
                here: lib/consent's constant, rendered, never retyped. */}
            <div id="join-consent" aria-live="polite" style={{ fontSize: 12.2, color: tried && !emailOk ? C.amber : C.muted, fontWeight: 500, lineHeight: 1.45 }}>
              {tried && !emailOk ? 'Check the email address.' : state === 'error' ? 'That didn’t go through. Try again in a moment.' : CONSENT_TEXT}
            </div>
          </div>
        )}

        <ul style={{ margin: '22px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {copy.ticks.map((t) => (
            <li key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: C.secondary, fontWeight: 500, lineHeight: 1.5 }}>
              <span aria-hidden style={{ color: accent, fontWeight: 900 }}>✓</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>

        <div style={{ marginTop: 24, borderTop: `1px solid ${C.line}`, paddingTop: 14, display: 'flex', justifyContent: 'space-between', gap: 12, color: C.muted, fontSize: 12 }}>
          <span>pitchfootball.com.au</span>
          <a href="/" className="jn-link">See the full site →</a>
        </div>
      </main>
    </div>
  );
}
