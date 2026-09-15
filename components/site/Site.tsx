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
// Interactive layer (BUZ, 15 Sep: "a little more interactive without changing
// the content"). No words changed. No libraries. Nothing is sent anywhere:
// the chosen role is kept in this browser's localStorage only. Everything
// that moves stops for prefers-reduced-motion.
//   · the hero phone can be scrolled by hand; it resumes on its own
//   · "How it works" follows the reader's scroll: active step, travelling ball
//   · any screen opens full size (tap, Esc or the close button to shut)
//   · choosing who you are highlights your price and pre-selects the form
//   · the pitch lights up Now → Next → Later as the reader scrolls past it
//   · the header marks the section in view; questions open smoothly; a ball
//     goes in the net when someone joins the waitlist
//
// Copy discipline: D-03's phrase stays; never "potential", "insights",
// "application(s)" for players, rankings or dates; anything beyond launch
// carries COMING SOON and no tier name (D-106, D-110); never claim Pitch
// verifies age (D-96).
import { useCallback, useEffect, useRef, useState } from 'react';
import { CONSENT_TEXT, EMAIL_RE } from '@/lib/consent';

type Role = 'player' | 'parent' | 'coach' | 'club';
type Shot = { src: string; alt: string; laptop?: boolean };

const C = {
  bg: '#0b120e', surface: '#121b16', surface2: '#1a2420', line: '#24322a',
  ink: '#eef5f0', secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84', onAccent: '#06130c',
  amber: '#eda100', purple: '#a479e2', orange: '#d95926',
};
const ACCENT: Record<Role, string> = { player: C.accent, parent: C.purple, coach: C.orange, club: C.amber };
const ROLES: Role[] = ['player', 'parent', 'coach', 'club'];
const ROLE_KEY = 'pitch-site-role';

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
const Notch = () => <div aria-hidden style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 86, height: 24, borderRadius: 999, background: '#050806', pointerEvents: 'none' }} />;

// A phone holding one real screen. Tapping it opens the screen full size.
function Phone({ src, alt, width = 280, tilt = 0, eager = false, onOpen }: { src: string; alt: string; width?: number; tilt?: number; eager?: boolean; onOpen: (s: Shot) => void }) {
  const inner = width - 20;
  return (
    <button type="button" className="sp-zoomable" onClick={() => onOpen({ src, alt })} aria-label={`Open full size: ${alt}`}
      style={{ ...phoneShell, width, transform: `rotate(${tilt}deg)`, border: 'none', cursor: 'zoom-in', fontFamily: 'inherit', color: 'inherit' }}>
      <div style={{ position: 'relative', borderRadius: 34, overflow: 'hidden', height: Math.round(inner * (844 / 390)), background: C.bg }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" width={600} height={1298} loading={eager ? 'eager' : 'lazy'} decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
        <Notch />
      </div>
    </button>
  );
}

// The hero phone: a full-height capture of a real player page. It scrolls
// slowly by itself; touch, wheel or drag inside it and the reader takes over,
// and it picks up again a few seconds after they let go.
function HeroPhone({ width = 300 }: { width?: number }) {
  const inner = width - 20;
  const frame = Math.round(inner * (844 / 390));
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [manual, setManual] = useState(false);
  const idle = useRef<number | null>(null);

  const takeOver = useCallback(() => {
    const box = boxRef.current, img = imgRef.current;
    if (!box || !img) return;
    if (!manual) {
      // Start the hand scroll from wherever the animation had got to.
      const t = getComputedStyle(img).translate;
      const y = t && t !== 'none' ? parseFloat(t.split(' ')[1] ?? '0') : 0;
      setManual(true);
      requestAnimationFrame(() => { box.scrollTop = Math.max(0, -y); });
    }
    if (idle.current) window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => { box.scrollTop = 0; setManual(false); }, 4500);
  }, [manual]);

  useEffect(() => () => { if (idle.current) window.clearTimeout(idle.current); }, []);

  return (
    <div style={{ ...phoneShell, width }}>
      <div ref={boxRef} className={manual ? 'sp-hero-manual' : undefined}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') takeOver(); }}
        onPointerDown={takeOver} onWheel={takeOver} onTouchStart={takeOver} onScroll={() => manual && takeOver()}
        style={{ position: 'relative', borderRadius: 34, overflow: manual ? 'auto' : 'hidden', height: frame, background: C.bg, overscrollBehavior: 'contain' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src="/site/hero-cv.webp" alt="A player’s page on Pitch" width={600} height={2188} fetchPriority="high" className={manual ? undefined : 'sp-autoscroll'} draggable={false}
          style={{ width: '100%', height: 'auto', display: 'block', ['--frame' as never]: `${frame}px` }} />
      </div>
    </div>
  );
}

function Laptop({ src, alt, onOpen }: { src: string; alt: string; onOpen: (s: Shot) => void }) {
  return (
    <button type="button" className="sp-zoomable" onClick={() => onOpen({ src, alt, laptop: true })} aria-label={`Open full size: ${alt}`}
      style={{ width: '100%', maxWidth: 620, background: 'none', border: 'none', padding: 0, cursor: 'zoom-in', fontFamily: 'inherit', color: 'inherit' }}>
      <div style={{ borderRadius: '16px 16px 0 0', padding: '10px 10px 0', background: 'linear-gradient(160deg,#2a332e,#111714)', boxShadow: '0 0 0 1px #2f3a34 inset' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" width={1400} height={875} decoding="async" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '8px 8px 0 0' }} />
      </div>
      <div style={{ height: 14, borderRadius: '0 0 18px 18px', background: 'linear-gradient(#27302b,#161c19)', margin: '0 -18px', boxShadow: '0 30px 60px -30px rgba(0,0,0,.9)' }} />
    </button>
  );
}

// Full-size view of one screen. Esc, the backdrop or the close button shuts
// it, and focus goes back to the screen that opened it.
function Lightbox({ shot, onClose }: { shot: Shot | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!shot) return;
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; opener?.focus(); };
  }, [shot, onClose]);
  if (!shot) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={shot.alt} onClick={onClose} className="sp-lightbox"
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(5,8,6,.88)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <button ref={closeRef} type="button" onClick={onClose} aria-label="Close"
        style={{ position: 'absolute', top: 14, right: 14, width: 48, height: 48, borderRadius: 999, border: `1px solid ${C.line}`, background: C.surface, color: C.ink, fontSize: 24, lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit' }}>
        ×
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shot.src} alt={shot.alt} onClick={(e) => e.stopPropagation()} className="sp-lightbox-img"
        style={{ maxWidth: shot.laptop ? 'min(1200px, 100%)' : 'min(440px, 100%)', maxHeight: '88vh', width: 'auto', height: 'auto', borderRadius: shot.laptop ? 12 : 28, boxShadow: '0 40px 100px -30px rgba(0,0,0,.9)', cursor: 'default' }} />
    </div>
  );
}

const Kicker = ({ children, color = C.accent }: { children: React.ReactNode; color?: string }) => (
  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color, transition: 'color .3s' }}>{children}</div>
);

const Chip = ({ children, color }: { children: React.ReactNode; color: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '5px 10px', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color, background: `${color}22`, whiteSpace: 'nowrap' }}>{children}</span>
);

const WHO: Record<Role, { label: string; title: string; points: string[]; shot: Shot }> = {
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

// Which pricing card belongs to which person. A parent's child is a player.
const PRICE_FOR: Record<Role, 'Players' | 'Coaches' | 'Clubs'> = { player: 'Players', parent: 'Players', coach: 'Coaches', club: 'Clubs' };

// How far the reader has scrolled through an element: 0 as it enters the
// middle of the screen, 1 as it leaves it.
function progressThrough(el: HTMLElement | null, anchor = 0.55): number {
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  const mid = window.innerHeight * anchor;
  return Math.min(1, Math.max(0, (mid - r.top) / Math.max(1, r.height)));
}

export default function Site() {
  const [who, setWho] = useState<Role>('player');
  const [role, setRole] = useState<Role>('player');
  const [chosen, setChosen] = useState(false);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [tried, setTried] = useState(false);
  const [shot, setShot] = useState<Shot | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [howProgress, setHowProgress] = useState(0);
  const [visionProgress, setVisionProgress] = useState(0);
  const [section, setSection] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const howRef = useRef<HTMLDivElement>(null);
  const visionRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const swipe = useRef<number | null>(null);

  const openShot = useCallback((s: Shot) => setShot(s), []);

  useEffect(() => {
    const t = window.setTimeout(() => { ROLES.forEach((r) => { const img = new Image(); img.src = WHO[r].shot.src; }); }, 1500);
    return () => window.clearTimeout(t);
  }, []);
  const closeShot = useCallback(() => setShot(null), []);

  // Gentle reveal as sections enter; nothing hidden if JS never runs.
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.sp-reveal');
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('sp-in'); io.unobserve(e.target); } }), { threshold: 0.15 });
    els.forEach((el) => { el.classList.add('sp-armed'); io.observe(el); });
    return () => io.disconnect();
  }, []);

  // The person the reader picked last time, kept in this browser only.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ROLE_KEY) as Role | null;
      if (saved && ROLES.includes(saved)) { setWho(saved); setRole(saved); setChosen(true); }
    } catch { /* storage unavailable: the page works without it */ }
  }, []);

  const choose = (r: Role) => {
    setWho(r); setRole(r); setChosen(true);
    try { window.localStorage.setItem(ROLE_KEY, r); } catch { /* ignore */ }
  };

  // One scroll handler, throttled to frames: the touchline ball, the active
  // step, the pitch zones and the section marked in the header.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setHowProgress(progressThrough(howRef.current));
      setVisionProgress(progressThrough(visionRef.current, 0.9));
      const mid = window.innerHeight * 0.5;
      const steps = stepRefs.current.filter(Boolean) as HTMLDivElement[];
      const lefts = steps.map((el) => el.getBoundingClientRect().left);
      const oneRow = lefts.length > 1 && Math.max(...lefts) - Math.min(...lefts) > 100;
      if (oneRow) {
        // Side by side: step through them as the reader moves down the section.
        const hp = progressThrough(howRef.current);
        setActiveStep(hp < 0.3 ? 0 : hp < 0.5 ? 1 : 2);
      } else {
        let best = 0, bestDist = Infinity;
        steps.forEach((el, i) => {
          const r = el.getBoundingClientRect();
          const d = Math.abs(r.top + Math.min(r.height, 260) / 2 - mid);
          if (d < bestDist) { bestDist = d; best = i; }
        });
        setActiveStep(best);
      }
      let current: string | null = null;
      for (const id of ['how', 'who', 'vision', 'pricing']) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.4) current = id;
      }
      setSection(current);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (frame) cancelAnimationFrame(frame); };
  }, []);

  const joinAs = (r: Role) => { choose(r); formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
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

  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = ROLES[(ROLES.indexOf(who) + (e.key === 'ArrowRight' ? 1 : ROLES.length - 1)) % ROLES.length];
    choose(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  const section$: React.CSSProperties = { width: '100%', maxWidth: 1160, margin: '0 auto', padding: '0 22px', boxSizing: 'border-box' };
  const h2: React.CSSProperties = { fontSize: 'clamp(30px, 5vw, 46px)', fontWeight: 900, letterSpacing: '-0.015em', lineHeight: 1.05, margin: 0 };
  const lead: React.CSSProperties = { fontSize: 17, color: C.secondary, fontWeight: 500, lineHeight: 1.6, margin: 0, maxWidth: 620 };
  const litZones = Math.min(3, Math.floor(visionProgress * 3.2) + (visionProgress > 0.02 ? 1 : 0));

  return (
    <div style={{ background: C.bg, color: C.ink, minHeight: '100dvh', overflowX: 'clip' }}>
      <style>{`
        .sp-btn { display: inline-flex; align-items: center; justify-content: center; border-radius: 14px; font-family: inherit; cursor: pointer; letter-spacing: 0.02em; text-decoration: none; transition: transform .12s cubic-bezier(.22,1,.36,1), filter .18s cubic-bezier(.22,1,.36,1), background .18s cubic-bezier(.22,1,.36,1), box-shadow .18s; }
        .sp-btn:active { transform: translateY(1px) scale(.985); }
        .sp-btn-primary { height: 50px; font-size: 15px; font-weight: 800; background: #3ddc84; color: #06130c; border: none; }
        .sp-btn-primary:hover { filter: brightness(1.06); color: #06130c; box-shadow: 0 10px 30px -12px rgba(61,220,132,.7); transform: translateY(-1px); }
        .sp-btn-secondary { height: 46px; font-size: 14px; font-weight: 700; background: #1a2420; color: #eef5f0; border: 1px solid #24322a; }
        .sp-btn-secondary:hover { background: #1f2c26; color: #eef5f0; transform: translateY(-1px); }
        .sp-btn[disabled] { opacity: .45; cursor: not-allowed; }
        .sp-chip { height: 44px; border-radius: 999px; padding: 0 20px; display: inline-flex; align-items: center; font-size: 14px; font-weight: 700; white-space: nowrap; cursor: pointer; font-family: inherit; background: #1a2420; border: 1px solid #24322a; color: #b9c8bf; transition: background .2s, color .2s, border-color .2s, transform .2s; }
        .sp-chip:hover { border-color: #7d8f85; color: #eef5f0; }
        .sp-chip[aria-selected="true"] { background: var(--acc); color: #06130c; border-color: var(--acc); font-weight: 800; transform: translateY(-1px); }
        .sp-field { background: #1a2420; border: 1px solid #24322a; border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; transition: border-color .18s, background .18s; }
        .sp-field:focus-within { border-color: #3ddc84; background: #1d2a24; }
        .sp-field-label { font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #7d8f85; }
        .sp-field input::placeholder { color: #6b7d73; font-weight: 500; }
        .sp-navlink { position: relative; transition: color .2s; }
        .sp-navlink:hover, .sp-navlink[aria-current="true"] { color: #eef5f0 !important; }
        .sp-navlink::after { content: ''; position: absolute; left: 0; right: 0; bottom: 8px; height: 2px; border-radius: 2px; background: #3ddc84; transform: scaleX(0); transform-origin: left; transition: transform .3s cubic-bezier(.22,1,.36,1); }
        .sp-navlink[aria-current="true"]::after { transform: scaleX(1); }
        .sp-header { position: sticky; top: 0; z-index: 40; background: rgba(11,18,14,.72); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-bottom: 1px solid transparent; transition: border-color .3s; }
        .sp-header[data-scrolled="true"] { border-bottom-color: #24322a; }
        .sp-autoscroll { animation: spScroll 26s cubic-bezier(.45,0,.55,1) infinite alternate; }
        @keyframes spScroll { 0%, 8% { translate: 0 0; } 92%, 100% { translate: 0 calc(-100% + var(--frame)); } }
        .sp-hero-manual { scrollbar-width: none; }
        .sp-hero-manual::-webkit-scrollbar { display: none; }
        .sp-armed { opacity: 0; transform: translateY(18px); transition: opacity .7s cubic-bezier(.22,1,.36,1), transform .7s cubic-bezier(.22,1,.36,1); }
        .sp-armed.sp-in { opacity: 1; transform: none; }
        .sp-zoomable { transition: transform .35s cubic-bezier(.22,1,.36,1), box-shadow .35s; }
        .sp-zoomable:hover { transform: translateY(-4px) rotate(0deg) !important; }
        .sp-zoomable:focus-visible { outline: 2px solid #3ddc84; outline-offset: 4px; }
        .sp-step { transition: opacity .45s cubic-bezier(.22,1,.36,1), filter .45s; }
        @media (min-width: 900px) { .sp-step[data-active="false"] { opacity: .42; filter: saturate(.6); } }
        .sp-step-num { transition: transform .45s cubic-bezier(.22,1,.36,1), text-shadow .45s; }
        .sp-step[data-active="true"] .sp-step-num { transform: scale(1.08); text-shadow: 0 0 28px rgba(61,220,132,.45); }
        .sp-link { opacity: 0; }
        .sp-step[data-active="true"] .sp-link { animation: spLink 3.4s cubic-bezier(.65,0,.35,1) infinite; }
        @keyframes spLink { 0% { left: 6%; opacity: 0; } 12% { opacity: 1; } 70% { left: 78%; opacity: 1; } 84%, 100% { left: 78%; opacity: 0; } }
        .sp-ball { transition: left .18s linear; }
        .sp-panel { animation: spPanel .45s cubic-bezier(.22,1,.36,1) both; }
        @keyframes spPanel { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .sp-zone { transition: opacity .6s cubic-bezier(.22,1,.36,1), background .6s; }
        .sp-zone[data-lit="false"] { opacity: .38; }
        .sp-zone[data-lit="true"] { background: radial-gradient(420px 260px at 50% 30%, var(--zc), transparent 70%); }
        .sp-vcard { transition: transform .25s cubic-bezier(.22,1,.36,1), border-color .25s; }
        .sp-vcard:hover { transform: translateY(-3px); border-color: var(--zb) !important; }
        .sp-price-card { transition: transform .4s cubic-bezier(.22,1,.36,1), box-shadow .4s, border-color .4s; }
        .sp-price-card[data-for="true"] { transform: translateY(-6px); box-shadow: 0 0 0 1px var(--pcb), 0 24px 50px -24px var(--pc); }
        .sp-lightbox { animation: spFade .2s ease both; }
        .sp-lightbox-img { animation: spZoom .3s cubic-bezier(.22,1,.36,1) both; }
        @keyframes spFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spZoom { from { opacity: 0; transform: scale(.94); } to { opacity: 1; transform: none; } }
        .sp-goal-ball { animation: spGoal 1.1s cubic-bezier(.3,.1,.3,1) .15s both; }
        @keyframes spGoal { 0% { transform: translate(-70px, 34px) scale(.8); opacity: 0; } 15% { opacity: 1; } 100% { transform: translate(0, 0) scale(1); opacity: 1; } }
        .sp-goal-net { animation: spNet .5s ease-out 1.15s both; transform-origin: 50% 0; }
        @keyframes spNet { 0% { transform: scaleY(1); } 40% { transform: scaleY(1.12); } 100% { transform: scaleY(1); } }
        .sp-grid-2 { display: grid; grid-template-columns: 1fr; gap: 40px; align-items: center; }
        .sp-steps { display: grid; grid-template-columns: 1fr; gap: 56px; }
        .sp-vision { display: grid; grid-template-columns: 1fr; gap: 14px; }
        .sp-price { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .sp-nav { display: none !important; }
        .sp-pitchlines { display: none; }
        .sp-float { display: none !important; }
        .sp-vball { display: none; }
        @media (min-width: 900px) {
          .sp-grid-2 { grid-template-columns: 1.05fr .95fr; }
          .sp-steps { grid-template-columns: repeat(3, 1fr); gap: 28px; }
          .sp-vision { grid-template-columns: repeat(3, 1fr); gap: 0; }
          .sp-price { grid-template-columns: repeat(3, 1fr); }
          .sp-nav { display: flex !important; }
          .sp-navjoin { display: none !important; }
          .sp-pitchlines { display: block; }
          .sp-float { display: flex !important; }
          .sp-vball { display: block; }
        }
        details.sp-faq > summary { list-style: none; cursor: pointer; }
        details.sp-faq > summary::-webkit-details-marker { display: none; }
        details.sp-faq .sp-plus { transition: transform .25s cubic-bezier(.22,1,.36,1); }
        details.sp-faq[open] .sp-plus { transform: rotate(45deg); }
        details.sp-faq { interpolate-size: allow-keywords; transition: border-color .25s; }
        details.sp-faq[open] { border-color: #2f4a3a !important; }
        details.sp-faq::details-content { height: 0; overflow: clip; transition: height .35s cubic-bezier(.22,1,.36,1), content-visibility .35s allow-discrete; }
        details.sp-faq[open]::details-content { height: auto; }
        @media (prefers-reduced-motion: reduce) {
          .sp-autoscroll, .sp-step[data-active="true"] .sp-link, .sp-panel, .sp-lightbox, .sp-lightbox-img, .sp-goal-ball, .sp-goal-net { animation: none; }
          .sp-armed { opacity: 1; transform: none; transition: none; }
          .sp-ball, .sp-zone, .sp-step, .sp-price-card, .sp-zoomable, .sp-vcard { transition: none; }
          .sp-zoomable:hover, .sp-vcard:hover { transform: none !important; }
          details.sp-faq::details-content { transition: none; }
        }
      `}</style>

      {/* ---- header ---- */}
      <header className="sp-header" data-scrolled={section ? 'true' : 'false'}>
        <div style={{ ...section$, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}>
          <nav aria-label="Sections" className="sp-nav" style={{ display: 'flex', gap: 22, fontSize: 13.5, fontWeight: 700 }}>
            {[['How it works', 'how'], ['Who it’s for', 'who'], ['Where it’s going', 'vision'], ['Pricing', 'pricing']].map(([l, id]) => (
              <a key={id} href={`#${id}`} className="sp-navlink" aria-current={section === id ? 'true' : undefined}
                style={{ color: C.secondary, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>{l}</a>
            ))}
          </nav>
          <button type="button" onClick={() => joinAs(role)} className="sp-navjoin sp-btn sp-btn-primary" style={{ height: 44, padding: '0 16px', fontSize: 13.5 }}>Join the waitlist</button>
          <Wordmark />
        </div>
      </header>

      {/* ---- 1 · hero ---- */}
      <section style={{ position: 'relative' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(900px 500px at 75% 30%, rgba(61,220,132,.16), transparent 60%), radial-gradient(700px 400px at 10% 90%, rgba(164,121,226,.10), transparent 60%)' }} />
        <div className="sp-grid-2" style={{ ...section$, position: 'relative', paddingTop: 36, paddingBottom: 80 }}>
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
              <button type="button" onClick={() => joinAs(role)} className="sp-btn sp-btn-primary" style={{ padding: '0 26px' }}>Join the waitlist</button>
              <a href="#how" className="sp-btn sp-btn-secondary" style={{ padding: '0 24px' }}>See how it works</a>
            </div>
            <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Free for players and coaches.</div>
          </div>
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
            <HeroPhone width={300} />
            <div className="sp-float" style={{ position: 'absolute', left: 'max(0px, calc(50% - 330px))', top: '8%', flexDirection: 'column', background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: '10px 13px', boxShadow: '0 20px 40px -20px rgba(0,0,0,.8)', pointerEvents: 'none' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: C.muted }}>Real app screen</div>
              <div style={{ fontSize: 13, fontWeight: 800 }}>Jordan’s page, as a club sees it</div>
            </div>
            <div className="sp-float" style={{ position: 'absolute', right: 'max(0px, calc(50% - 250px))', bottom: '16%', background: C.surface, border: `1px solid ${C.accent}`, borderRadius: 14, padding: '10px 13px', gap: 9, alignItems: 'center', boxShadow: '0 20px 40px -20px rgba(0,0,0,.8)', pointerEvents: 'none' }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: C.accent }} />
              <div style={{ fontSize: 13, fontWeight: 800 }}>Sent to a club</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- 2 · how it works ---- */}
      <section id="how" style={{ padding: '90px 0', background: C.surface, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, scrollMarginTop: 72 }}>
        <div style={section$} ref={howRef}>
          <div className="sp-reveal" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 50 }}>
            <Kicker>How it works</Kicker>
            <h2 style={h2}>From your first page to a trial.</h2>
          </div>
          <div aria-hidden style={{ position: 'relative', height: 2, background: C.line, margin: '0 0 44px' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: 2, width: `${Math.round(howProgress * 100)}%`, background: C.accent, opacity: .6 }} />
            <span className="sp-ball" style={{ position: 'absolute', top: -5, left: `calc(${(howProgress * 100).toFixed(1)}% - 6px)`, width: 12, height: 12, borderRadius: 999, background: C.ink, boxShadow: `0 0 18px ${C.accent}` }} />
          </div>
          <div className="sp-steps">
            {[
              { n: '1', t: 'Build your page', b: 'Add the clubs you’ve played for, your positions, your stats and a few clips. If you’re under 16, a parent sets it up with you.', src: '/site/build.webp', alt: 'Building a player page' },
              { n: '2', t: 'Send it, or put your name down', b: 'Send your page to a club with a link, and they see it as it is today. Or find a trial on the trials board and register your interest.', src: '/site/trials.webp', alt: 'The trials board' },
              { n: '3', t: 'The club invites you to trial', b: 'If a club wants a look, they invite you through Pitch. If you’re under 18, the invite goes to you and a parent, and a parent approves your reply.', src: '/site/parent-invite.webp', alt: 'An invitation to trial' },
            ].map((s, i) => (
              <div key={s.n} ref={(el) => { stepRefs.current[i] = el; }} className="sp-reveal sp-step" data-active={activeStep === i ? 'true' : 'false'}
                style={{ display: 'flex', flexDirection: 'column', gap: 18, transitionDelay: `${i * 90}ms` }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
                  <div className="sp-step-num" style={{ fontSize: 64, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: .8, color: C.accent }}>{s.n}</div>
                  <h3 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.015em', margin: 0 }}>{s.t}</h3>
                </div>
                <p style={{ ...lead, fontSize: 15.5 }}>{s.b}</p>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', paddingTop: 6 }}>
                  <Phone src={s.src} alt={s.alt} width={250} tilt={i === 1 ? 0 : i === 0 ? -2 : 2} onOpen={openShot} />
                  {i === 1 && (
                    <span className="sp-link" aria-hidden style={{ position: 'absolute', top: '42%', background: C.accent, color: C.onAccent, borderRadius: 999, padding: '7px 12px', fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap', boxShadow: '0 10px 30px -8px rgba(61,220,132,.6)', pointerEvents: 'none' }}>
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
      <section id="who" style={{ padding: '90px 0', scrollMarginTop: 72 }}>
        <div style={section$}>
          <div className="sp-reveal" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 30 }}>
            <Kicker color={ACCENT[who]}>Who it’s for</Kicker>
            <h2 style={h2}>Players, parents, coaches and clubs.</h2>
          </div>
          <div role="tablist" aria-label="Who are you?" onKeyDown={onTabKey} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 36 }}>
            {ROLES.map((r) => (
              <button key={r} type="button" role="tab" id={`tab-${r}`} aria-controls="who-panel" aria-selected={who === r} tabIndex={who === r ? 0 : -1} className="sp-chip"
                onClick={() => choose(r)} style={{ ['--acc' as never]: ACCENT[r] }}>
                {WHO[r].label}
              </button>
            ))}
          </div>
          <div id="who-panel" role="tabpanel" aria-labelledby={`tab-${who}`} className="sp-grid-2 sp-panel" key={who}
            onTouchStart={(e) => { swipe.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (swipe.current === null) return;
              const dx = e.changedTouches[0].clientX - swipe.current;
              swipe.current = null;
              if (Math.abs(dx) < 60) return;
              choose(ROLES[(ROLES.indexOf(who) + (dx < 0 ? 1 : ROLES.length - 1)) % ROLES.length]);
            }}>
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
                ? <Laptop src={WHO[who].shot.src} alt={WHO[who].shot.alt} onOpen={openShot} />
                : <Phone src={WHO[who].shot.src} alt={WHO[who].shot.alt} width={290} eager onOpen={openShot} />}
            </div>
          </div>
        </div>
      </section>

      {/* ---- 4 · parents ---- */}
      <section style={{ padding: '70px 0', background: 'linear-gradient(160deg, #1b1426 0%, #0f0d17 60%, #0b120e 100%)', borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div style={section$}>
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
                <div key={t} className="sp-vcard" style={{ background: 'rgba(18,27,22,.7)', border: `1px solid ${C.line}`, borderRadius: 16, padding: '16px 15px', ['--zb' as never]: C.purple }}>
                  <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 6 }}>{t}</div>
                  <div style={{ fontSize: 13.5, color: C.secondary, fontWeight: 500, lineHeight: 1.55 }}>{b}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---- 5 · where it's going, across one pitch ---- */}
      <section id="vision" style={{ padding: '90px 0', scrollMarginTop: 72 }}>
        <div style={section$}>
          <div className="sp-reveal" style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 44 }}>
            <Kicker>Where it’s going</Kicker>
            <h2 style={{ ...h2, maxWidth: 900 }}>It starts with your CV.</h2>
            <p style={lead}>
              Over time, Pitch becomes a full record of how players develop, checked by their coaches, and a better way for clubs to find the right players. Here’s what’s ready at launch and what’s coming after.
            </p>
          </div>
          <div ref={visionRef} className="sp-reveal" style={{ position: 'relative', borderRadius: 22, overflow: 'hidden', border: `1px solid ${C.line}`, background: 'repeating-linear-gradient(90deg, #0f1a14 0 80px, #0d1611 80px 160px)' }}>
            <svg aria-hidden className="sp-pitchlines" viewBox="0 0 1000 400" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .35 }}>
              <rect x="10" y="10" width="980" height="380" fill="none" stroke="#3ddc84" strokeWidth="2" />
              <line x1="500" y1="10" x2="500" y2="390" stroke="#3ddc84" strokeWidth="2" />
              <circle cx="500" cy="200" r="70" fill="none" stroke="#3ddc84" strokeWidth="2" />
              <rect x="10" y="110" width="110" height="180" fill="none" stroke="#3ddc84" strokeWidth="2" />
              <rect x="880" y="110" width="110" height="180" fill="none" stroke="#3ddc84" strokeWidth="2" />
            </svg>
            <span aria-hidden className="sp-vball sp-ball" style={{ position: 'absolute', zIndex: 2, bottom: 14, left: `calc(${(4 + visionProgress * 92).toFixed(1)}% - 7px)`, width: 14, height: 14, borderRadius: 999, background: C.ink, boxShadow: `0 0 18px ${litZones >= 3 ? C.purple : litZones === 2 ? C.amber : C.accent}` }} />
            <div className="sp-vision" style={{ position: 'relative' }}>
              {VISION.map((z, i) => (
                <div key={z.zone} className="sp-zone" data-lit={i < litZones ? 'true' : 'false'}
                  style={{ padding: '26px 22px 40px', borderLeft: i === 0 ? 'none' : `1px dashed ${C.line}`, display: 'flex', flexDirection: 'column', gap: 16, ['--zc' as never]: `${z.color}1f` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.015em', color: z.color }}>{z.zone}</div>
                    <Chip color={z.color}>{z.chip}</Chip>
                  </div>
                  {z.items.map(([t, b]) => (
                    <div key={t} className="sp-vcard" style={{ background: 'rgba(11,18,14,.82)', border: `1px solid ${C.line}`, borderRadius: 14, padding: '13px 13px', ['--zb' as never]: z.color }}>
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
      <section id="pricing" style={{ padding: '80px 0', background: C.surface, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, scrollMarginTop: 72 }}>
        <div style={section$}>
          <div className="sp-reveal" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 36 }}>
            <Kicker>Pricing</Kicker>
            <h2 style={h2}>Free for players and coaches.</h2>
          </div>
          <div className="sp-price">
            {[
              { t: 'Players' as const, p: 'Free', s: '', b: 'Under 18, free and staying free. Over 18, free now, with a paid option for extra features later.', c: C.accent },
              { t: 'Coaches' as const, p: 'Free', s: '', b: 'Your coaching page, share link and the coaching roles board. We may add a paid option later.', c: C.orange },
              { t: 'Clubs' as const, p: '$54', s: 'a month, or $329 a year', b: 'Your club page, squads and trial notices are free. The Interest Register is the paid part. Cancel any time.', c: C.amber },
            ].map((x) => {
              const forYou = chosen && PRICE_FOR[who] === x.t;
              return (
                <div key={x.t} className="sp-reveal sp-price-card" data-for={forYou ? 'true' : 'false'}
                  style={{ background: C.bg, border: `1px solid ${C.line}`, borderTop: `3px solid ${x.c}`, borderRadius: 18, padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: 10, ['--pc' as never]: `${x.c}88`, ['--pcb' as never]: x.c }}>
                  <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: forYou ? x.c : C.muted, transition: 'color .3s' }}>{x.t}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <div style={{ fontSize: 46, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>{x.p}</div>
                    <div style={{ fontSize: 13.5, color: C.muted, fontWeight: 700 }}>{x.s}</div>
                  </div>
                  <div style={{ fontSize: 14.5, color: C.secondary, fontWeight: 500, lineHeight: 1.55 }}>{x.b}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---- 7 · waitlist ---- */}
      <section style={{ padding: '90px 0' }}>
        <div ref={formRef} className="sp-reveal" style={{ ...section$, maxWidth: 640 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center', alignItems: 'center', marginBottom: 26 }}>
            <Kicker>The waitlist</Kicker>
            <h2 style={h2}>We’ll let you know when we open.</h2>
            <p style={{ ...lead, fontSize: 15.5 }}>Join the waitlist and we’ll send you one email when Pitch opens.</p>
          </div>
          {state === 'done' ? (
            <div style={{ background: C.surface, border: `1px solid ${C.accent}`, borderRadius: 18, padding: '26px 22px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <svg aria-hidden width="120" height="70" viewBox="0 0 120 70" style={{ marginBottom: 10, overflow: 'visible' }}>
                <g className="sp-goal-net">
                  <rect x="30" y="6" width="60" height="44" rx="2" fill="none" stroke={C.ink} strokeWidth="2.5" />
                  {[42, 54, 66, 78].map((x) => <line key={x} x1={x} y1="6" x2={x} y2="50" stroke="rgba(238,245,240,.25)" strokeWidth="1" />)}
                  {[17, 28, 39].map((y) => <line key={y} x1="30" y1={y} x2="90" y2={y} stroke="rgba(238,245,240,.25)" strokeWidth="1" />)}
                </g>
                <line x1="0" y1="50" x2="120" y2="50" stroke={C.line} strokeWidth="2" />
                <circle className="sp-goal-ball" cx="60" cy="30" r="7" fill={C.accent} />
              </svg>
              <div style={{ fontSize: 22, fontWeight: 900 }}>You’re on the list.</div>
              <div style={{ fontSize: 14.5, color: C.secondary, fontWeight: 500, marginTop: 6 }}>We’ll email you once, when we open.</div>
            </div>
          ) : (
            <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 18, padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'rgba(164,121,226,.12)', border: '1px solid rgba(164,121,226,.35)', borderRadius: 12, padding: '10px 12px', fontSize: 13, fontWeight: 600, color: C.ink, lineHeight: 1.5 }}>
                Under 18? Ask a parent to add their email instead. We never take a child’s details before there is a parent to ask.
              </div>
              <div role="radiogroup" aria-label="I’m here as" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {ROLES.map((r) => (
                  <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => choose(r)}
                    style={{ minHeight: 44, borderRadius: 12, border: `1px solid ${role === r ? ACCENT[r] : C.line}`, background: role === r ? `${ACCENT[r]}22` : 'transparent', color: role === r ? C.ink : C.secondary, fontSize: 13.5, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', transition: 'background .2s, border-color .2s, color .2s' }}>
                    {WHO[r].label}
                  </button>
                ))}
              </div>
              <label className="sp-field">
                <span className="sp-field-label">Email · 18 and over</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="you@example.com" aria-label="Email address"
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
        <div style={{ ...section$, maxWidth: 760 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
            <Kicker>Before you ask</Kicker>
            <h2 style={h2}>Questions.</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FAQ.map(([q, a], i) => (
              <details key={q} className="sp-faq" open={i === 0} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '0 16px' }}>
                <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, minHeight: 58, fontSize: 16, fontWeight: 800 }}>
                  {q}
                  <span className="sp-plus" aria-hidden style={{ fontSize: 22, color: C.accent, lineHeight: 1 }}>+</span>
                </summary>
                <p style={{ fontSize: 15, color: C.secondary, fontWeight: 500, lineHeight: 1.65, margin: '0 0 16px' }}>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ borderTop: `1px solid ${C.line}`, padding: '26px 0 40px' }}>
        <div style={{ ...section$, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Football, not soccer. Australia first, then everywhere the game is played.</div>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <a href="/privacy" style={{ color: C.secondary, fontSize: 13, fontWeight: 700, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Privacy</a>
            <a href="/terms" style={{ color: C.secondary, fontSize: 13, fontWeight: 700, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Terms</a>
            <Wordmark size={18} />
          </div>
        </div>
      </footer>

      <Lightbox shot={shot} onClose={closeShot} />
    </div>
  );
}
