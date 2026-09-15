'use client';
// The pre-registration site at pitchfootball.com.au (BUZ, 15 Sep: "Lets go
// live with this new design"). Replaces the coming-soon page after visitors
// said they couldn't tell what Pitch is. One idea per section, in the order a
// stranger needs them:
//   1. what it is, literally, with a real app screen in a phone
//   2. how it works: three steps, real screens
//   3. who it is for: the screen each person actually uses
//   4. what protects a child, accurate by age band
//   5. where it is going: Now, Next, Later across a pitch
//   6. what it costs
//   7. the waitlist (same API, same stored consent wording)
//   8. questions
//
// Every screen in public/site/ is a capture of the built app, signed in as
// fictional fixture people. This branch carries no app code, so the hero is a
// full-height capture of the real player page rather than the component.
//
// Copy discipline: D-03's phrase stays; never "potential", "insights",
// "application(s)" for players, rankings or dates; anything beyond launch
// carries COMING SOON and no tier name (D-106, D-110); never claim Pitch
// verifies age (D-96).
import { useEffect, useRef, useState } from 'react';
import { CONSENT_TEXT, EMAIL_RE } from '@/lib/consent';

type Role = 'player' | 'parent' | 'coach' | 'club';

const C = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84', onAccent: '#06130c',
  amber: '#eda100', purple: '#a479e2', orange: '#d95926',
};
const ACCENT: Record<Role, string> = { player: C.accent, parent: C.purple, coach: C.orange, club: C.amber };

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

const phoneShell: React.CSSProperties = { borderRadius: 44, padding: 10, background: 'linear-gradient(160deg,#2a332e,#111714)', boxShadow: '0 40px 80px -30px rgba(0,0,0,.8), 0 0 0 1px #2f3a34 inset', flexShrink: 0 };
const Notch = () => <div aria-hidden style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 86, height: 24, borderRadius: 999, background: '#050806' }} />;

// A phone holding one real screen.
function Phone({ src, alt, width = 280, tilt = 0 }: { src: string; alt: string; width?: number; tilt?: number }) {
  const inner = width - 20;
  return (
    <div style={{ ...phoneShell, width, transform: `rotate(${tilt}deg)` }}>
      <div style={{ position: 'relative', borderRadius: 34, overflow: 'hidden', height: Math.round(inner * (844 / 390)), background: C.bg }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} width={600} height={1298} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
        <Notch />
      </div>
    </div>
  );
}

// The hero phone: a full-height capture of a real player page, scrolling slowly.
function HeroPhone({ width = 300 }: { width?: number }) {
  const inner = width - 20;
  const frame = Math.round(inner * (844 / 390));
  return (
    <div style={{ ...phoneShell, width }}>
      <div style={{ position: 'relative', borderRadius: 34, overflow: 'hidden', height: frame, background: C.bg }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/site/hero-cv.webp" alt="A player’s page on Pitch" width={600} height={2188} fetchPriority="high" className="sp-autoscroll"
          style={{ width: '100%', height: 'auto', display: 'block', ['--frame' as never]: `${frame}px` }} />
        <Notch />
      </div>
    </div>
  );
}

function Laptop({ src, alt }: { src: string; alt: string }) {
  return (
    <div style={{ width: '100%', maxWidth: 620 }}>
      <div style={{ borderRadius: '16px 16px 0 0', padding: '10px 10px 0', background: 'linear-gradient(160deg,#2a332e,#111714)', boxShadow: '0 0 0 1px #2f3a34 inset' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} width={1400} height={875} loading="lazy" decoding="async" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '8px 8px 0 0' }} />
      </div>
      <div style={{ height: 14, borderRadius: '0 0 18px 18px', background: 'linear-gradient(#27302b,#161c19)', margin: '0 -18px', boxShadow: '0 30px 60px -30px rgba(0,0,0,.9)' }} />
    </div>
  );
}

const Kicker = ({ children, color = C.accent }: { children: React.ReactNode; color?: string }) => (
  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color }}>{children}</div>
);

const Chip = ({ children, color }: { children: React.ReactNode; color: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '5px 10px', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color, background: `${color}22`, whiteSpace: 'nowrap' }}>{children}</span>
);

const WHO: Record<Role, { label: string; title: string; points: string[]; shot: { src: string; alt: string; laptop?: boolean } }> = {
  player: {
    label: 'Player',
    title: 'Your football history in one place.',
    points: [
      'Every club, season and position you’ve played, plus your stats and clips.',
      'Send it to a club with a link. They see your page as it is today, not an old PDF.',
      'Find trials and register your interest with a club in a couple of taps.',
      'Free to use. If you’re under 18, it stays free.',
    ],
    shot: { src: '/site/player-cv.webp', alt: 'A player’s page on Pitch' },
  },
  parent: {
    label: 'Parent',
    title: 'You stay in charge until they turn 18.',
    points: [
      'Under 16, nothing goes to a club until you send it.',
      'At 16 and 17 they send their own page. You’re told each time, and you can turn sending off.',
      'If a club wants your child at a trial, they invite them through Pitch. You both see it, and you approve the reply.',
      'You can pause the page, or delete everything, whenever you like.',
    ],
    shot: { src: '/site/parent-invite.webp', alt: 'A parent reading a club’s invitation to trial' },
  },
  coach: {
    label: 'Coach',
    title: 'Your coaching CV.',
    points: [
      'Your roles, licences, coaching philosophy and clips on one page, with a link you can share.',
      'Browse coaching roles at clubs and apply with your page.',
      'If your club brings you in for a team, you can see who has registered for it and filter by position.',
      'Free for every coach, whether you volunteer or get paid.',
    ],
    shot: { src: '/site/coach-register.webp', alt: 'A coach reading registrations for their teams' },
  },
  club: {
    label: 'Club',
    title: 'See who wants to play for your club.',
    points: [
      'A free club page with your squads and trial notices. Player CVs arrive as live pages.',
      'The Interest Register lists everyone who wants to join, all year, by squad, age group and position.',
      'Invite players to trial through Pitch, and give your age-group coaches access to their teams.',
      'We check every club before it can see anything about a child.',
    ],
    shot: { src: '/site/club-register.webp', alt: 'A club’s Interest Register on a laptop', laptop: true },
  },
};

const VISION: { zone: string; chip: string; color: string; items: [string, string][] }[] = [
  {
    zone: 'Now', chip: 'At launch', color: C.accent, items: [
      ['Football CVs', 'Pages for players, coaches and clubs.'],
      ['Send to any club', 'Send your page with a link, or register your interest in a trial.'],
      ['The Interest Register', 'Clubs see everyone who wants to join, and invite players to trial.'],
    ],
  },
  {
    zone: 'Next', chip: 'Coming soon', color: C.amber, items: [
      ['Coach-verified development', 'Coaches record what they see in plain language, and it’s marked as verified.'],
      ['Clubs find players', 'Verified clubs and coaches can search for players 16 and over. Under 18 only with a parent’s okay, and never under 16.'],
      ['Match Day', 'Track minutes, subs and goals from the sideline.'],
    ],
  },
  {
    zone: 'Later', chip: 'Coming soon', color: C.purple, items: [
      ['Squads', 'Coaches and team managers run their squads on Pitch.'],
      ['The club pathway', 'Clubs see how every squad is developing, from MiniRoos to seniors.'],
      ['League benchmarks', 'Anonymous development trends across a league. No player or club is ever named.'],
    ],
  },
];

const FAQ: [string, string][] = [
  ['How does it work?', 'You build a page with your football on it: clubs, seasons, positions, stats and clips. You send it to a club with a link, or register your interest in a club’s trial. If a club wants you, they invite you to trial through Pitch. If you’re under 18, a parent approves before anything is sent back.'],
  ['Who is it for?', 'Anyone in football, at any level. Players, parents of players under 18, coaches and clubs. We’re starting in Australia.'],
  ['When does it open?', 'We’re building it now and we’ll open when it’s ready. Join the waitlist and we’ll email you once, when we open.'],
  ['What does it cost?', 'Players under 18 are free, and that won’t change. Players over 18 and coaches are free too, and we may add paid options for them later. Club pages are free. Clubs can add the Interest Register for $54 a month or $329 a year.'],
  ['How does Pitch treat under-18s?', 'Under 16, a parent sends everything. At 16 and 17, players send their own page, and a parent is told every time and can turn sending off. Clubs can’t message children. A club can send one invitation to trial, which goes to the child and a parent together, and nothing goes back without a parent’s okay. Under-18 pages are kept out of search engines.'],
  ['Is Pitch a social network?', 'No. Pitch is a player development and pathway platform. There’s no feed, likes or followers. It’s a page you choose to send, and a record that builds each season.'],
  ['What happens with my email address?', 'It’s stored in Australia with the exact consent wording you saw when you joined. We use it for one email when we open, and every email we send has an unsubscribe link. The privacy policy has the details.'],
];

export default function Site() {
  const [who, setWho] = useState<Role>('player');
  const [role, setRole] = useState<Role>('player');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [tried, setTried] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Gentle reveal as sections enter; nothing hidden if JS never runs.
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.sp-reveal');
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('sp-in'); io.unobserve(e.target); } }), { threshold: 0.15 });
    els.forEach((el) => { el.classList.add('sp-armed'); io.observe(el); });
    return () => io.disconnect();
  }, []);

  const joinAs = (r: Role) => { setRole(r); formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  const emailOk = EMAIL_RE.test(email);
  const submit = async () => {
    setTried(true);
    if (!emailOk) return;
    setState('sending');
    try {
      const r = await fetch('/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, role }) });
      setState(r.ok ? 'done' : 'error');
    } catch { setState('error'); }
  };

  const section: React.CSSProperties = { width: '100%', maxWidth: 1160, margin: '0 auto', padding: '0 22px', boxSizing: 'border-box' };
  const h2: React.CSSProperties = { fontSize: 'clamp(30px, 5vw, 46px)', fontWeight: 900, letterSpacing: '-0.015em', lineHeight: 1.05, margin: 0 };
  const lead: React.CSSProperties = { fontSize: 17, color: C.secondary, fontWeight: 500, lineHeight: 1.6, margin: 0, maxWidth: 620 };

  return (
    <div style={{ background: C.bg, color: C.ink, minHeight: '100dvh', overflowX: 'hidden' }}>
      <style>{`
        .sp-btn { display: inline-flex; align-items: center; justify-content: center; border-radius: 14px; font-family: inherit; cursor: pointer; letter-spacing: 0.02em; text-decoration: none; transition: transform .12s cubic-bezier(.22,1,.36,1), filter .18s cubic-bezier(.22,1,.36,1), background .18s cubic-bezier(.22,1,.36,1); }
        .sp-btn:active { transform: translateY(1px) scale(.995); }
        .sp-btn-primary { height: 50px; font-size: 15px; font-weight: 800; background: #3ddc84; color: #06130c; border: none; }
        .sp-btn-primary:hover { filter: brightness(1.06); color: #06130c; }
        .sp-btn-secondary { height: 46px; font-size: 14px; font-weight: 700; background: #1a2420; color: #eef5f0; border: 1px solid #24322a; }
        .sp-btn-secondary:hover { background: #1f2c26; color: #eef5f0; }
        .sp-btn[disabled] { opacity: .45; cursor: not-allowed; }
        .sp-chip { height: 44px; border-radius: 999px; padding: 0 20px; display: inline-flex; align-items: center; font-size: 14px; font-weight: 700; white-space: nowrap; cursor: pointer; font-family: inherit; background: #1a2420; border: 1px solid #24322a; color: #b9c8bf; transition: background .16s, color .16s, border-color .16s; }
        .sp-chip:hover { border-color: #7d8f85; color: #eef5f0; }
        .sp-chip[aria-selected="true"] { background: var(--acc); color: #06130c; border-color: var(--acc); font-weight: 800; }
        .sp-field { background: #1a2420; border: 1px solid #24322a; border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; transition: border-color .18s, background .18s; }
        .sp-field:focus-within { border-color: #3ddc84; background: #1d2a24; }
        .sp-field-label { font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #7d8f85; }
        .sp-field input::placeholder { color: #6b7d73; font-weight: 500; }
        .sp-navlink:hover { color: #eef5f0 !important; }
        .sp-autoscroll { animation: spScroll 26s cubic-bezier(.45,0,.55,1) infinite alternate; }
        @keyframes spScroll { 0%, 8% { translate: 0 0; } 92%, 100% { translate: 0 calc(-100% + var(--frame)); } }
        .sp-armed { opacity: 0; transform: translateY(18px); transition: opacity .7s cubic-bezier(.22,1,.36,1), transform .7s cubic-bezier(.22,1,.36,1); }
        .sp-armed.sp-in { opacity: 1; transform: none; }
        .sp-link { animation: spLink 3.4s cubic-bezier(.65,0,.35,1) infinite; }
        @keyframes spLink { 0% { left: 6%; opacity: 0; } 12% { opacity: 1; } 70% { left: 78%; opacity: 1; } 84%, 100% { left: 78%; opacity: 0; } }
        .sp-ball { animation: spBall 9s linear infinite; }
        @keyframes spBall { 0% { left: 4%; } 100% { left: 96%; } }
        .sp-grid-2 { display: grid; grid-template-columns: 1fr; gap: 40px; align-items: center; }
        .sp-steps { display: grid; grid-template-columns: 1fr; gap: 56px; }
        .sp-vision { display: grid; grid-template-columns: 1fr; gap: 14px; }
        .sp-price { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .sp-nav { display: none !important; }
        .sp-pitchlines { display: none; }
        .sp-float { display: none !important; }
        @media (min-width: 900px) {
          .sp-grid-2 { grid-template-columns: 1.05fr .95fr; }
          .sp-steps { grid-template-columns: repeat(3, 1fr); gap: 28px; }
          .sp-vision { grid-template-columns: repeat(3, 1fr); gap: 0; }
          .sp-price { grid-template-columns: repeat(3, 1fr); }
          .sp-nav { display: flex !important; }
          .sp-navjoin { display: none !important; }
          .sp-pitchlines { display: block; }
          .sp-float { display: flex !important; }
        }
        details.sp-faq > summary { list-style: none; cursor: pointer; }
        details.sp-faq > summary::-webkit-details-marker { display: none; }
        details.sp-faq[open] .sp-plus { transform: rotate(45deg); }
        @media (prefers-reduced-motion: reduce) {
          .sp-autoscroll, .sp-link, .sp-ball { animation: none; }
          .sp-armed { opacity: 1; transform: none; transition: none; }
        }
      `}</style>

      {/* ---- header ---- */}
      <header style={{ ...section, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}>
        <nav aria-label="Sections" className="sp-nav" style={{ display: 'flex', gap: 22, fontSize: 13.5, fontWeight: 700 }}>
          {[['How it works', '#how'], ['Who it’s for', '#who'], ['Where it’s going', '#vision'], ['Pricing', '#pricing']].map(([l, h]) => (
            <a key={h} href={h} className="sp-navlink" style={{ color: C.secondary, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>{l}</a>
          ))}
        </nav>
        <button type="button" onClick={() => joinAs('player')} className="sp-navjoin sp-btn sp-btn-primary" style={{ height: 44, padding: '0 16px', fontSize: 13.5 }}>Join the waitlist</button>
        <Wordmark />
      </header>

      {/* ---- 1 · hero ---- */}
      <section style={{ position: 'relative' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(900px 500px at 75% 30%, rgba(61,220,132,.16), transparent 60%), radial-gradient(700px 400px at 10% 90%, rgba(164,121,226,.10), transparent 60%)' }} />
        <div className="sp-grid-2" style={{ ...section, position: 'relative', paddingTop: 36, paddingBottom: 80 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <Kicker>In build · Australia first</Kicker>
            <h1 style={{ fontSize: 'clamp(44px, 8vw, 84px)', fontWeight: 900, letterSpacing: '-0.035em', lineHeight: .95, margin: 0 }}>
              Your football,<br /><span style={{ color: C.accent }}>on one page.</span>
            </h1>
            <p style={{ ...lead, fontSize: 19, color: C.ink }}>
              Build your football CV once, with your clubs, seasons, positions, stats and clips. Send it to any club with a link. It stays with you when you change clubs.
            </p>
            <p style={{ ...lead, fontSize: 14.5, color: C.muted }}>
              Pitch is a player development and pathway platform for players, parents, coaches and clubs.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => joinAs('player')} className="sp-btn sp-btn-primary" style={{ padding: '0 26px' }}>Join the waitlist</button>
              <a href="#how" className="sp-btn sp-btn-secondary" style={{ padding: '0 24px' }}>See how it works</a>
            </div>
            <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Free for players and coaches.</div>
          </div>
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
            <HeroPhone width={300} />
            <div className="sp-float" style={{ position: 'absolute', left: 'max(0px, calc(50% - 330px))', top: '8%', flexDirection: 'column', background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: '10px 13px', boxShadow: '0 20px 40px -20px rgba(0,0,0,.8)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: C.muted }}>Real app screen</div>
              <div style={{ fontSize: 13, fontWeight: 800 }}>Jordan’s page, as a club sees it</div>
            </div>
            <div className="sp-float" style={{ position: 'absolute', right: 'max(0px, calc(50% - 250px))', bottom: '16%', background: C.surface, border: `1px solid ${C.accent}`, borderRadius: 14, padding: '10px 13px', gap: 9, alignItems: 'center', boxShadow: '0 20px 40px -20px rgba(0,0,0,.8)' }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: C.accent }} />
              <div style={{ fontSize: 13, fontWeight: 800 }}>Sent to a club</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- 2 · how it works ---- */}
      <section id="how" style={{ padding: '90px 0', background: C.surface, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div style={section}>
          <div className="sp-reveal" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 50 }}>
            <Kicker>How it works</Kicker>
            <h2 style={h2}>From your first page to a trial.</h2>
          </div>
          <div aria-hidden style={{ position: 'relative', height: 2, background: C.line, margin: '0 0 44px' }}>
            <span className="sp-ball" style={{ position: 'absolute', top: -5, width: 12, height: 12, borderRadius: 999, background: C.ink, boxShadow: `0 0 18px ${C.accent}` }} />
          </div>
          <div className="sp-steps">
            {[
              { n: '1', t: 'Build your page', b: 'Add the clubs you’ve played for, your positions, your stats and a few clips. If you’re under 16, a parent sets it up with you.', src: '/site/build.webp', alt: 'Building a player page' },
              { n: '2', t: 'Send it, or put your name down', b: 'Send your page to a club with a link, and they see it as it is today. Or find a trial on the trials board and register your interest.', src: '/site/trials.webp', alt: 'The trials board' },
              { n: '3', t: 'The club invites you to trial', b: 'If a club wants a look, they invite you through Pitch. If you’re under 18, the invite goes to you and a parent, and a parent approves your reply.', src: '/site/parent-invite.webp', alt: 'An invitation to trial' },
            ].map((s, i) => (
              <div key={s.n} className="sp-reveal" style={{ display: 'flex', flexDirection: 'column', gap: 18, transitionDelay: `${i * 90}ms` }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
                  <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: .8, color: C.accent }}>{s.n}</div>
                  <h3 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.015em', margin: 0 }}>{s.t}</h3>
                </div>
                <p style={{ ...lead, fontSize: 15.5 }}>{s.b}</p>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', paddingTop: 6 }}>
                  <Phone src={s.src} alt={s.alt} width={250} tilt={i === 1 ? 0 : i === 0 ? -2 : 2} />
                  {i === 1 && (
                    <span className="sp-link" aria-hidden style={{ position: 'absolute', top: '42%', background: C.accent, color: C.onAccent, borderRadius: 999, padding: '7px 12px', fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap', boxShadow: '0 10px 30px -8px rgba(61,220,132,.6)' }}>
                      pitchfootball.com.au/p/…
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- 3 · who it's for ---- */}
      <section id="who" style={{ padding: '90px 0' }}>
        <div style={section}>
          <div className="sp-reveal" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 30 }}>
            <Kicker color={ACCENT[who]}>Who it’s for</Kicker>
            <h2 style={h2}>Players, parents, coaches and clubs.</h2>
          </div>
          <div role="tablist" aria-label="Who are you?" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 36 }}>
            {(Object.keys(WHO) as Role[]).map((r) => (
              <button key={r} type="button" role="tab" id={`tab-${r}`} aria-controls="who-panel" aria-selected={who === r} className="sp-chip"
                onClick={() => setWho(r)} style={{ ['--acc' as never]: ACCENT[r] }}>
                {WHO[r].label}
              </button>
            ))}
          </div>
          <div id="who-panel" role="tabpanel" aria-labelledby={`tab-${who}`} className="sp-grid-2" key={who}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h3 style={{ fontSize: 'clamp(26px, 3.6vw, 36px)', fontWeight: 900, letterSpacing: '-0.015em', lineHeight: 1.1, margin: 0 }}>{WHO[who].title}</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {WHO[who].points.map((p) => (
                  <li key={p} style={{ display: 'flex', gap: 12, fontSize: 16, color: C.secondary, fontWeight: 500, lineHeight: 1.55 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT[who]} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 3 }} aria-hidden><path d="M5 12.5 L10 17.5 L19 7" /></svg>
                    {p}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => joinAs(who)} className="sp-btn sp-btn-primary" style={{ alignSelf: 'flex-start', padding: '0 26px', background: ACCENT[who] }}>
                Join as a {WHO[who].label.toLowerCase()}
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {WHO[who].shot.laptop
                ? <Laptop src={WHO[who].shot.src} alt={WHO[who].shot.alt} />
                : <Phone src={WHO[who].shot.src} alt={WHO[who].shot.alt} width={290} />}
            </div>
          </div>
        </div>
      </section>

      {/* ---- 4 · parents ---- */}
      <section style={{ padding: '70px 0', background: 'linear-gradient(160deg, #1b1426 0%, #0f0d17 60%, #0b120e 100%)', borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div style={section}>
          <div className="sp-reveal sp-grid-2" style={{ alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Kicker color={C.purple}>For parents</Kicker>
              <h2 style={h2}>Built with your child’s safety first.</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {[
                ['No feed, likes or followers', 'Pitch is a page you send, not an app to scroll.'],
                ['Clubs can’t message children', 'A club can send one invitation to trial. A parent sees it at the same time and approves any reply.'],
                ['Every club is checked', 'A person at Pitch verifies each club before it can see anything about a child.'],
                ['Kept out of Google', 'Under-18 pages are never indexed. A page only opens with its link, and a parent can turn the link off.'],
              ].map(([t, b]) => (
                <div key={t} style={{ background: 'rgba(18,27,22,.7)', border: `1px solid ${C.line}`, borderRadius: 16, padding: '16px 15px' }}>
                  <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 6 }}>{t}</div>
                  <div style={{ fontSize: 13.5, color: C.secondary, fontWeight: 500, lineHeight: 1.55 }}>{b}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---- 5 · where it's going, across one pitch ---- */}
      <section id="vision" style={{ padding: '90px 0' }}>
        <div style={section}>
          <div className="sp-reveal" style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 44 }}>
            <Kicker>Where it’s going</Kicker>
            <h2 style={{ ...h2, maxWidth: 900 }}>It starts with your CV.</h2>
            <p style={lead}>
              Over time, Pitch becomes a full record of how players develop, checked by their coaches, and a better way for clubs to find the right players. Here’s what’s ready at launch and what’s coming after.
            </p>
          </div>
          <div className="sp-reveal" style={{ position: 'relative', borderRadius: 22, overflow: 'hidden', border: `1px solid ${C.line}`, background: 'repeating-linear-gradient(90deg, #0f1a14 0 80px, #0d1611 80px 160px)' }}>
            <svg aria-hidden className="sp-pitchlines" viewBox="0 0 1000 400" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .35 }}>
              <rect x="10" y="10" width="980" height="380" fill="none" stroke="#3ddc84" strokeWidth="2" />
              <line x1="500" y1="10" x2="500" y2="390" stroke="#3ddc84" strokeWidth="2" />
              <circle cx="500" cy="200" r="70" fill="none" stroke="#3ddc84" strokeWidth="2" />
              <rect x="10" y="110" width="110" height="180" fill="none" stroke="#3ddc84" strokeWidth="2" />
              <rect x="880" y="110" width="110" height="180" fill="none" stroke="#3ddc84" strokeWidth="2" />
            </svg>
            <div className="sp-vision" style={{ position: 'relative' }}>
              {VISION.map((z, i) => (
                <div key={z.zone} style={{ padding: '26px 22px', borderLeft: i === 0 ? 'none' : `1px dashed ${C.line}`, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.015em', color: z.color }}>{z.zone}</div>
                    <Chip color={z.color}>{z.chip}</Chip>
                  </div>
                  {z.items.map(([t, b]) => (
                    <div key={t} style={{ background: 'rgba(11,18,14,.82)', border: `1px solid ${C.line}`, borderRadius: 14, padding: '13px 13px' }}>
                      <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 4 }}>{t}</div>
                      <div style={{ fontSize: 13.5, color: C.secondary, fontWeight: 500, lineHeight: 1.5 }}>{b}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <p className="sp-reveal" style={{ ...lead, fontSize: 14, color: C.muted, marginTop: 18 }}>
            We don’t put dates on things we haven’t built yet.
          </p>
        </div>
      </section>

      {/* ---- 6 · pricing ---- */}
      <section id="pricing" style={{ padding: '80px 0', background: C.surface, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div style={section}>
          <div className="sp-reveal" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 36 }}>
            <Kicker>Pricing</Kicker>
            <h2 style={h2}>Free for players and coaches.</h2>
          </div>
          <div className="sp-price">
            {[
              { t: 'Players', p: 'Free', s: '', b: 'Under 18, free and staying free. Over 18, free now, with a paid option for extra features later.', c: C.accent },
              { t: 'Coaches', p: 'Free', s: '', b: 'Your coaching page, share link and the coaching roles board. We may add a paid option later.', c: C.orange },
              { t: 'Clubs', p: '$54', s: 'a month, or $329 a year', b: 'Your club page, squads and trial notices are free. The Interest Register is the paid part. Cancel any time.', c: C.amber },
            ].map((x) => (
              <div key={x.t} className="sp-reveal" style={{ background: C.bg, border: `1px solid ${C.line}`, borderTop: `3px solid ${x.c}`, borderRadius: 18, padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: C.muted }}>{x.t}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <div style={{ fontSize: 46, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>{x.p}</div>
                  <div style={{ fontSize: 13.5, color: C.muted, fontWeight: 700 }}>{x.s}</div>
                </div>
                <div style={{ fontSize: 14.5, color: C.secondary, fontWeight: 500, lineHeight: 1.55 }}>{x.b}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- 7 · waitlist ---- */}
      <section style={{ padding: '90px 0' }}>
        <div ref={formRef} className="sp-reveal" style={{ ...section, maxWidth: 640 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center', alignItems: 'center', marginBottom: 26 }}>
            <Kicker>The waitlist</Kicker>
            <h2 style={h2}>We’ll let you know when we open.</h2>
            <p style={{ ...lead, fontSize: 15.5 }}>Join the waitlist and we’ll send you one email when Pitch opens.</p>
          </div>
          {state === 'done' ? (
            <div style={{ background: C.surface, border: `1px solid ${C.accent}`, borderRadius: 18, padding: '26px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900 }}>You’re on the list.</div>
              <div style={{ fontSize: 14.5, color: C.secondary, fontWeight: 500, marginTop: 6 }}>We’ll email you once, when we open.</div>
            </div>
          ) : (
            <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 18, padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'rgba(164,121,226,.12)', border: '1px solid rgba(164,121,226,.35)', borderRadius: 12, padding: '10px 12px', fontSize: 13, fontWeight: 600, color: C.ink, lineHeight: 1.5 }}>
                Under 18? Ask a parent to add their email instead. We never take a child’s details before there is a parent to ask.
              </div>
              <div role="radiogroup" aria-label="I’m here as" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {(Object.keys(WHO) as Role[]).map((r) => (
                  <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)}
                    style={{ minHeight: 44, borderRadius: 12, border: `1px solid ${role === r ? ACCENT[r] : C.line}`, background: role === r ? `${ACCENT[r]}22` : 'transparent', color: role === r ? C.ink : C.secondary, fontSize: 13.5, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>
                    {WHO[r].label}
                  </button>
                ))}
              </div>
              <label className="sp-field">
                <span className="sp-field-label">Email · 18 and over</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email address"
                  style={{ background: 'transparent', border: 'none', outline: 'none', color: C.ink, fontSize: 16, fontWeight: 700, fontFamily: 'inherit', padding: 0 }} />
              </label>
              <button type="button" onClick={submit} disabled={state === 'sending'} className="sp-btn sp-btn-primary" style={{ width: '100%' }}>{state === 'sending' ? 'Adding you…' : 'Join the waitlist'}</button>
              <div style={{ fontSize: 12, color: tried && !emailOk ? C.amber : C.muted, fontWeight: 500, lineHeight: 1.5, textAlign: 'center' }}>
                {tried && !emailOk ? 'Check the email address.' : state === 'error' ? 'That didn’t go through. Try again in a moment.' : CONSENT_TEXT}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---- 8 · questions ---- */}
      <section style={{ padding: '10px 0 90px' }}>
        <div style={{ ...section, maxWidth: 760 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
            <Kicker>Before you ask</Kicker>
            <h2 style={h2}>Questions.</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FAQ.map(([q, a], i) => (
              <details key={q} className="sp-faq" open={i === 0} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '0 16px' }}>
                <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, minHeight: 58, fontSize: 16, fontWeight: 800 }}>
                  {q}
                  <span className="sp-plus" aria-hidden style={{ fontSize: 22, color: C.accent, transition: 'transform .2s', lineHeight: 1 }}>+</span>
                </summary>
                <p style={{ fontSize: 15, color: C.secondary, fontWeight: 500, lineHeight: 1.65, margin: '0 0 16px' }}>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ borderTop: `1px solid ${C.line}`, padding: '26px 0 40px' }}>
        <div style={{ ...section, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Football, not soccer. Australia first, then everywhere the game is played.</div>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <a href="/privacy" style={{ color: C.secondary, fontSize: 13, fontWeight: 700, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Privacy</a>
            <a href="/terms" style={{ color: C.secondary, fontSize: 13, fontWeight: 700, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Terms</a>
            <Wordmark size={18} />
          </div>
        </div>
      </footer>
    </div>
  );
}
