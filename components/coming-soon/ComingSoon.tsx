'use client';

// The coming-soon page, rebuilt from the signed design:
// site/Pitch Website - Coming Soon v2.dc.html (source of truth) + site/README.md.
// Pixel-close port — copy, colours, spacing and the interactive toys are the
// design's personality and are all in scope (doc 29 §2).

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ACC, GLOW, DOT, ORDER, SEATS, FORMS, GROUPS, POS, FILM_SRC, HI, PRICE, STORY,
  ROADMAP, LOOKS, LOOK_KEYS, FAQ, type Persona,
} from './data';
import { CONSENT_TEXT, EMAIL_RE } from '@/lib/consent';

type XY = [number, number];

interface S {
  persona: Persona; px: number; py: number;
  number: number; pos: string[]; goals: number; shots: number;
  ball: { x: number; y: number }; drag: boolean; flying: boolean; flash: string | null; netHit: number;
  formation: string; magnets: XY[]; mdrag: number; moved: number; runs: XY[][]; drawing: XY[] | null;
  group: number; whistled: boolean;
  linkOn: boolean; paused: boolean; pauseP: number; slide: number; sliding: boolean; approved: boolean; reqKey: number;
  look: string;
  email: string; role: Persona; submitted: boolean; tried: boolean; submitting: boolean; serverNote: string | null;
  fp: number; dp: number; hi: number; faq: number;
}

const chipStyle = (on: boolean, c: string) => ({
  background: on ? c : 'rgba(255,255,255,.06)',
  color: on ? '#06130c' : '#b9c8bf',
  border: `1px solid ${on ? c : 'rgba(255,255,255,.12)'}`,
});

// Pricing section hidden (BUZ, 3 Sep, on reader feedback): the page flows
// closer-look -> waitlist. The under-18-free promise still appears on the
// roadmap card; the only price left is the club-scene note. Flip to true to
// restore the full section.
const SHOW_PRICING = false;

const Check = ({ color, size = 13 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M5 12.5 l4.5 4.5 L19 7" />
  </svg>
);

const Wordmark = ({ size }: { size: number }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', fontWeight: 900, fontSize: size, letterSpacing: '-.035em', color: '#eef5f0', lineHeight: 1 }}>
    P
    <svg viewBox="0 0 74 97" style={{ height: '.715em', width: 'auto', margin: '0 -.085em', display: 'block' }} fill="none">
      <line x1="37" y1="6.5" x2="37" y2="90.5" stroke="#3ddc84" strokeWidth="13" strokeLinecap="round" />
      <circle cx="37" cy="48.5" r="32" fill="none" stroke="#3ddc84" strokeWidth="10" />
    </svg>
    TCH
  </div>
);

export default function ComingSoon() {
  const [s, setS] = useState<S>({
    persona: 'player', px: 0, py: 0,
    number: 9, pos: ['CAM', 'LW'], goals: 0, shots: 0, ball: { x: 50, y: 74 }, drag: false, flying: false, flash: null, netHit: 0,
    formation: '4-3-3', magnets: FORMS['4-3-3'].map((v) => [...v] as XY), mdrag: -1, moved: 0, runs: [], drawing: null,
    group: 0, whistled: false,
    linkOn: true, paused: false, pauseP: 0, slide: 0, sliding: false, approved: false, reqKey: 0,
    look: LOOKS.player[2][0][0],
    email: '', role: 'player', submitted: false, tried: false, submitting: false, serverNote: null,
    fp: 0, dp: 0, hi: 0, faq: 0,
  });
  const set = useCallback((patch: Partial<S>) => setS((prev) => ({ ...prev, ...patch })), []);

  const rangeRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const filmRef = useRef<HTMLDivElement>(null);
  const planRef = useRef<HTMLDivElement>(null);
  const hiRail = useRef<HTMLDivElement>(null);
  const hiRef = useRef<HTMLDivElement>(null);
  const seatRef = useRef<HTMLDivElement>(null);
  const lookRef = useRef<HTMLDivElement>(null);
  const priceRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  // Transient drag flags live in refs, not state: the first pointermove after
  // a pointerdown can otherwise read a stale closure and drop the gesture —
  // the "toys don't work on the phone" bug class.
  const ballDragRef = useRef(false);
  const ballPosRef = useRef({ x: 50, y: 74 }); // mirrors s.ball — shoot() must see the LAST move, not the last render
  const slidingRef = useRef(false);
  const shootRef = useRef<() => void>(() => {});

  // -- scroll progress (hero film + nav clock), rAF-throttled -----------------
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = filmRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const fp = Math.max(0, Math.min(1, (52 - r.top) / (r.height - vh + 52)));
        const doc = document.scrollingElement || document.documentElement;
        const dp = Math.max(0, Math.min(1, doc.scrollTop / Math.max(1, doc.scrollHeight - doc.clientHeight)));
        setS((prev) => (Math.abs(fp - prev.fp) > 0.002 || Math.abs(dp - prev.dp) > 0.004 ? { ...prev, fp, dp } : prev));
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // -- reveal-on-scroll -------------------------------------------------------
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => {
        if (e.isIntersecting) {
          (e.target as HTMLElement).style.opacity = '1';
          (e.target as HTMLElement).style.transform = 'none';
          io.unobserve(e.target);
        }
      }),
      { threshold: 0.15 },
    );
    const t = setTimeout(() => document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el)), 300);
    return () => { clearTimeout(t); io.disconnect(); };
  }, []);

  // -- persona ----------------------------------------------------------------
  // Swapping persona changes the height of sections above the fold (the seat
  // stage is auto-height on mobile), so a raw scroll restore still shifts the
  // page under the finger. Passing the tapped element as `anchor` keeps THAT
  // element stationary instead. Callers that immediately navigate (highlight
  // cards) pass restoreScroll false so the restore can't cancel the scroll.
  const pick = useCallback((persona: Persona, opts?: { anchor?: HTMLElement | null; restoreScroll?: boolean }) => {
    const anchor = opts?.anchor ?? null;
    const restore = opts?.restoreScroll ?? true;
    const anchorTop = anchor?.getBoundingClientRect().top;
    const y = window.scrollY;
    setS((prev) => ({ ...prev, persona, role: persona, look: LOOKS[persona][2][0][0] }));
    if (!restore) return;
    requestAnimationFrame(() => {
      if (anchor && anchorTop !== undefined) {
        const delta = anchor.getBoundingClientRect().top - anchorTop;
        if (delta) window.scrollTo({ top: window.scrollY + delta, behavior: 'instant' as ScrollBehavior });
      } else {
        window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
      }
    });
  }, []);
  const step = useCallback((d: number, anchor?: HTMLElement | null) => {
    setS((prev) => {
      const i = ORDER.indexOf(prev.persona);
      const persona = ORDER[(i + d + 4) % 4];
      return { ...prev, persona, role: persona, look: LOOKS[persona][2][0][0] };
    });
    // keep the tapped control stationary — scene heights differ per persona
    if (anchor) {
      const top = anchor.getBoundingClientRect().top;
      requestAnimationFrame(() => {
        const delta = anchor.getBoundingClientRect().top - top;
        if (delta) window.scrollTo({ top: window.scrollY + delta, behavior: 'instant' as ScrollBehavior });
      });
    }
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  const go = (ref: React.RefObject<HTMLDivElement | null>) => {
    const el = ref.current;
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 60, behavior: 'smooth' });
  };
  const goFormAs = (role: Persona) => { set({ role }); go(formRef); };

  const pct = (ref: React.RefObject<HTMLDivElement | null>, e: { clientX: number; clientY: number }): XY => {
    const r = ref.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100];
  };

  // setPointerCapture can throw (stale pointer id, odd browsers) — a throw here
  // must never kill the drag handler that follows it.
  const capture = (el: Element | null, pointerId: number) => {
    try { el?.setPointerCapture?.(pointerId); } catch { /* drag still works uncaptured */ }
  };

  // -- shooting range ---------------------------------------------------------
  // The timeline runs OUTSIDE the state updater — React may invoke updaters
  // twice (StrictMode), so a setTimeout inside one double-counts goals.
  const shoot = () => {
    ballDragRef.current = false;
    const b = ballPosRef.current, dx = 50 - b.x, dy = 74 - b.y, dist = Math.hypot(dx, dy);
    if (dist < 4) { ballPosRef.current = { x: 50, y: 74 }; set({ drag: false, ball: { x: 50, y: 74 } }); return; }
    const k = 2.6, tx = Math.max(-10, Math.min(110, 50 + dx * k)), ty = Math.max(-10, 74 + dy * k);
    setS((prev) => ({ ...prev, drag: false, flying: true, ball: { x: tx, y: ty }, shots: prev.shots + 1 }));
    setTimeout(() => {
      const goal = ty <= 32 && tx >= 24 && tx <= 76;
      const post = !goal && ty <= 32 && tx >= 19 && tx <= 81;
      setS((st) => ({
        ...st,
        flash: goal ? 'GOAL' : post ? 'POST!' : ty <= 32 ? 'WIDE' : 'SHORT',
        goals: st.goals + (goal ? 1 : 0),
        netHit: goal ? st.netHit + 1 : st.netHit,
      }));
      setTimeout(() => {
        ballPosRef.current = { x: 50, y: 74 };
        setS((st) => ({ ...st, flying: false, flash: null, ball: { x: 50, y: 74 } }));
      }, 1000);
    }, 620);
  };
  shootRef.current = shoot;

  // -- global drag plumbing ---------------------------------------------------
  // Ball and slider gestures are driven from WINDOW-level pointer listeners:
  // element-level move/up handlers proved unreliable on iOS (capture quirks,
  // gesture stealing). The non-passive touchmove blocker is what actually
  // stops Safari from scrolling/cancelling mid-drag — touch-action alone is
  // not honoured consistently.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (ballDragRef.current && rangeRef.current) {
        const r = rangeRef.current.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100, y = ((e.clientY - r.top) / r.height) * 100;
        const nb = { x: Math.max(0, Math.min(100, x)), y: Math.max(40, Math.min(100, y)) };
        ballPosRef.current = nb;
        setS((prev) => ({ ...prev, ball: nb }));
      } else if (slidingRef.current && slideRef.current) {
        const r = slideRef.current.getBoundingClientRect();
        const f = Math.max(0, Math.min(1, (e.clientX - r.left - 26) / (r.width - 52)));
        setS((prev) => ({ ...prev, slide: f }));
      }
    };
    const up = () => {
      if (ballDragRef.current) shootRef.current();
      if (slidingRef.current) {
        slidingRef.current = false;
        setS((prev) => (prev.slide > 0.92 ? { ...prev, sliding: false, approved: true, slide: 0 } : { ...prev, sliding: false, slide: 0 }));
      }
    };
    const cancelAll = () => {
      if (ballDragRef.current) {
        ballDragRef.current = false;
        ballPosRef.current = { x: 50, y: 74 };
        setS((prev) => ({ ...prev, drag: false, ball: { x: 50, y: 74 } }));
      }
      if (slidingRef.current) {
        slidingRef.current = false;
        setS((prev) => ({ ...prev, sliding: false, slide: 0 }));
      }
    };
    const blockScroll = (e: TouchEvent) => {
      if (ballDragRef.current || slidingRef.current) e.preventDefault();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancelAll);
    document.addEventListener('touchmove', blockScroll, { passive: false });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancelAll);
      document.removeEventListener('touchmove', blockScroll);
    };
  }, []);

  // -- hold-to-pause ----------------------------------------------------------
  const hold = (on: boolean, done?: () => void) => {
    cancelAnimationFrame(rafRef.current);
    if (!on) { set({ pauseP: 0 }); return; }
    const t0 = performance.now();
    const stepFn = (t: number) => {
      const v = Math.min(1, (t - t0) / 1200);
      setS((prev) => ({ ...prev, pauseP: v }));
      if (v >= 1) done?.();
      else rafRef.current = requestAnimationFrame(stepFn);
    };
    rafRef.current = requestAnimationFrame(stepFn);
  };

  // -- highlights rail --------------------------------------------------------
  const hiStep = (d: number) => {
    const el = hiRail.current;
    if (!el || !el.firstElementChild) return;
    const w = el.firstElementChild.getBoundingClientRect().width + 14;
    const i = Math.max(0, Math.min(HI.length - 1, s.hi + d));
    el.scrollTo({ left: i * w, behavior: 'smooth' });
    set({ hi: i });
  };

  // -- waitlist form ----------------------------------------------------------
  const emailOk = EMAIL_RE.test(s.email);
  const submit = async () => {
    if (s.submitting) return;
    if (!emailOk) { set({ tried: true }); return; }
    set({ submitting: true, serverNote: null });
    try {
      const r = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: s.email, role: s.role }),
      });
      if (r.ok) set({ submitted: true, submitting: false });
      else if (r.status === 429) set({ submitting: false, serverNote: 'Steady on — try again in a little while.' });
      else if (r.status === 503) set({ submitting: false, serverNote: 'The waitlist isn’t taking names just yet. Check back soon.' });
      else set({ submitting: false, serverNote: 'That didn’t go through. Try again.' });
    } catch {
      set({ submitting: false, serverNote: 'That didn’t go through. Try again.' });
    }
  };

  // -- derived (the prototype's renderVals) -----------------------------------
  const P = s.persona;
  const accent = ACC[P];
  const accentGlow = GLOW[P];
  const fp = s.fp;
  const ease = (a: number, b: number, v: number) => Math.max(0, Math.min(1, (v - a) / (b - a)));
  const W = 1 / 6;
  const seg = (i: number) => {
    const on = ease(i * W - 0.04, i * W + 0.012, fp), off = 1 - ease(i * W + 0.125, i * W + 0.18, fp);
    return i === 0 ? off : i === 5 ? on : Math.min(on, off);
  };
  const frameSeg = (i: number) => (i === 0 ? Math.max(seg(0), seg(1)) : seg(i + 1));
  const fr = (i: number, dir: number) => ({
    opacity: frameSeg(i).toFixed(3),
    transform: `scale(${(1.04 + fp * 0.14 - i * 0.03).toFixed(3)}) translate(${(dir * (fp * 6 - i * 1.5)).toFixed(2)}%, ${(i === 4 ? Math.sin(fp * 140) * (1 - ease(0.85, 0.97, fp)) * 1.2 : 0).toFixed(2)}%)`,
  });
  const cap = (i: number) => ({ opacity: Number(seg(i).toFixed(3)), transform: `translateY(${((1 - seg(i)) * 18).toFixed(1)}px)` });
  const filmTime = fp < 0.167 ? 'In build · Australia first' : fp < 0.333 ? 'Saturday · 3:07pm · 62nd minute' : fp < 0.5 ? 'Saturday · 3:07pm · the strike' : fp < 0.667 ? 'Saturday · 3:07pm · goal' : fp < 0.833 ? 'Saturday · 3:07pm · the sideline' : 'Saturday · 3:08pm · the fence';
  const filmHint = fp < 0.97 ? 'Scroll to play the goal' : 'Now pick your seat ↓';
  const clock = String(Math.round(s.dp * 90)).padStart(2, '0');

  const g = GROUPS[s.group];
  const whistleTot = GROUPS.reduce((a, gr) => a + gr.lines.reduce((b, l) => b + l[1], 0), 0);
  const groupCard = s.whistled
    ? { name: 'Whole club', tag: `${whistleTot} on the register`, note: 'Every squad, every line, one register. Blow again to send them back out.', lines: (['GK', 'DEF', 'MID', 'FWD'] as const).map((k, i) => ({ k, n: GROUPS.reduce((a, gr) => a + gr.lines[i][1], 0) })) }
    : { name: g.name, tag: g.tag, note: g.note, lines: g.lines.map(([k, n]) => ({ k, n })) };

  const pull = s.drag ? Math.hypot(50 - s.ball.x, 74 - s.ball.y) : 0;
  const pxA = -s.px * 14, pyA = -s.py * 8, pxB = s.px * 10;

  const lk = (k: string) => ({ opacity: s.look === k ? 1 : 0.32, outline: s.look === k ? `2px solid ${accent}` : 'none' });
  const tiers = PRICE[P][2].map((t) => ({
    name: t[0], badge: t[1], price: t[2], per: t[3], desc: t[4], items: t[5],
    itemsLabel: t[1] === 'Coming soon' ? 'Where it’s going' : 'What you get',
    c: t[6] || t[1] === 'Coming soon' ? accent : '#7d8f85',
    ...(t[1] === 'Coming soon'
      ? { bg: '#0a0f0c', bd: '1px dashed #24322a', badgeBg: 'rgba(255,255,255,.08)', badgeFg: '#b9c8bf' }
      : t[1] === 'The paid tier'
        ? { bg: 'linear-gradient(160deg, #2b2415 0%, #14170f 100%)', bd: '1px solid #4a3a12', badgeBg: '#eda100', badgeFg: '#14100a' }
        : { bg: '#0d1411', bd: '1px solid #1c2822', badgeBg: 'rgba(61,220,132,.14)', badgeFg: '#3ddc84' }),
  }));

  const seatChips = (small?: boolean) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6, paddingTop: small ? 6 : 8 }}>
      {SEATS.map(([k, label]) => {
        const on = P === k;
        // Chips carry the plain role AND the seat metaphor (BUZ, 3 Sep, on
        // reader feedback) — matches the scene headers ("Players · on the pitch")
        const role = k === 'parent' ? 'Parent' : k[0].toUpperCase() + k.slice(1);
        return (
          <div key={k} onClick={(e) => pick(k, { anchor: e.currentTarget })} style={{
            cursor: 'pointer', borderRadius: 999, padding: small ? '9px 14px' : '10px 16px', fontSize: small ? 12.5 : 13, fontWeight: 800,
            background: on ? 'rgba(255,255,255,.12)' : 'transparent', color: on ? '#eef5f0' : '#7d8f85',
            border: `1px solid ${on ? ACC[k] : 'rgba(255,255,255,.1)'}`, transition: 'all .2s', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ width: small ? 6 : 7, height: small ? 6 : 7, borderRadius: 999, background: ACC[k] }} />
            <span>{role}<span style={{ color: on ? '#7d8f85' : '#5a6a61', fontWeight: 700 }}> · {label}</span></span>
          </div>
        );
      })}
    </div>
  );

  const kicker: React.CSSProperties = { fontSize: 12, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase' };
  const sceneKicker: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase' };
  const microLabel: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7d8f85' };
  const reveal: React.CSSProperties = { opacity: 0, transform: 'translateY(24px)', transition: 'opacity .7s ease, transform .7s cubic-bezier(.22,1,.36,1)' };
  const sceneWrap: React.CSSProperties = { position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 32, padding: '40px 28px', maxWidth: 1100, width: '100%', margin: '0 auto', boxSizing: 'border-box' };
  const sceneText: React.CSSProperties = { flex: '1 1 340px', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 18, animation: 'rise .6s .15s cubic-bezier(.22,1,.36,1) both' };
  const sceneH2: React.CSSProperties = { fontSize: 'clamp(34px, 4.2vw, 54px)', fontWeight: 900, lineHeight: 1.0, letterSpacing: '-.035em', textWrap: 'pretty' as never };
  const phoneRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', background: '#121b16', borderRadius: 10, padding: '9px 11px', fontSize: 12, fontWeight: 700 };
  const phoneStat: React.CSSProperties = { flex: 1, background: '#121b16', borderRadius: 10, padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' };
  const phoneStatK: React.CSSProperties = { fontSize: 9, fontWeight: 800, letterSpacing: '.1em', color: '#7d8f85' };

  return (
    <div style={{ minHeight: '100vh', color: '#eef5f0', background: '#070b09' }}>

      {/* ===== nav ===== */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(7,11,9,.72)', backdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Wordmark size={20} /></div>
          <div className="navlinks" style={{ alignItems: 'center', gap: 22, fontSize: 12.5, fontWeight: 600, color: '#b9c8bf' }}>
            <div className="navlink" onClick={() => go(hiRef)} style={{ cursor: 'pointer' }}>Highlights</div>
            <div className="navlink" onClick={() => go(seatRef)} style={{ cursor: 'pointer' }}>Pick your seat</div>
            <div className="navlink" onClick={() => go(lookRef)} style={{ cursor: 'pointer' }}>A closer look</div>
            {SHOW_PRICING && <div className="navlink" onClick={() => go(priceRef)} style={{ cursor: 'pointer' }}>What it costs</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 800, color: '#b9c8bf', fontVariantNumeric: 'tabular-nums' }}>
              <div style={{ width: 6, height: 6, borderRadius: 999, background: '#3ddc84' }} />{clock}&apos;
            </div>
            <div onClick={() => go(formRef)} style={{ cursor: 'pointer', background: '#3ddc84', color: '#06130c', borderRadius: 999, padding: '7px 14px', fontSize: 12.5, fontWeight: 800 }}>Join the waitlist</div>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 0, bottom: -1, height: 2, width: `${(s.dp * 100).toFixed(1)}%`, background: '#3ddc84', transition: 'width .1s linear' }} />
      </div>

      {/* ===== HERO · scroll film ===== */}
      <div ref={filmRef} className="hero-film" style={{ position: 'relative' }}>
        <div style={{ position: 'sticky', top: 52, height: 'calc(100vh - 52px)', overflow: 'hidden', background: '#070b09' }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            {FILM_SRC.map((_, i) => {
              const src = `/assets/film-${i + 1}.webp`;
              const dir = i % 2 === 0 ? -1 : 1;
              const alts = ['the run, 62nd minute', 'the strike', 'the net', 'the sideline, the coach', 'the club and the fence, celebrating'];
              return (
                <div key={i} style={{ position: 'absolute', inset: 0, ...fr(i, dir), willChange: 'opacity, transform' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Frame ${i + 1} · ${alts[i]}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading={i === 0 ? 'eager' : 'lazy'} />
                </div>
              );
            })}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: '#3ddc84', mixBlendMode: 'soft-light', opacity: 0.3 }} />
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: '#fff', opacity: Number(Math.max(0, 0.9 - Math.abs(fp - 0.5) * 14).toFixed(2)) }} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: '18%', textAlign: 'center', pointerEvents: 'none', fontSize: 'clamp(90px, 22vw, 320px)', fontWeight: 900, letterSpacing: '-.07em', lineHeight: 1, color: '#3ddc84', opacity: Number(Math.min(ease(0.5, 0.53, fp), 1 - ease(0.62, 0.67, fp)).toFixed(2)), transform: `scale(${(0.7 + ease(0.5, 0.67, fp) * 0.5).toFixed(3)})`, textShadow: '0 0 80px rgba(61,220,132,.8)', mixBlendMode: 'screen' }}>GOAL</div>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(7,11,9,.45) 0%, rgba(7,11,9,0) 35%, rgba(7,11,9,.75) 80%, #070b09 100%)' }} />
            <div style={{ position: 'absolute', left: '-30%', top: '-20%', width: '40%', height: '140%', pointerEvents: 'none', background: 'linear-gradient(90deg, transparent, rgba(255,238,190,.18), transparent)', transform: `translateX(${(fp * 160 - 20).toFixed(1)}vw) rotate(12deg)`, filter: 'blur(20px)', mixBlendMode: 'screen' }} />
          </div>

          {/* caption stack */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 56px 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: 999, background: '#e34948', boxShadow: '0 0 10px #e34948', animation: 'pulse 1.6s infinite' }} />
                <div style={{ ...kicker, color: '#eef5f0' }}>{filmTime}</div>
              </div>
              <div className="hero-headline" style={{ position: 'relative', fontSize: 'clamp(40px, 7.4vw, 112px)', fontWeight: 900, lineHeight: 0.9, letterSpacing: '-.05em', color: '#fff', textShadow: '0 10px 50px rgba(0,0,0,.6)' }}>
                {([
                  [0, <>Somebody should be <span style={{ color: '#3ddc84' }}>writing this down.</span></>],
                  [1, <>A goal lasts <span style={{ color: '#3ddc84', opacity: Number(ease(0.19, 0.26, fp).toFixed(2)), transition: 'opacity .3s' }}>a second.</span></>],
                  [2, <>The run took <span style={{ color: '#3ddc84' }}>a season.</span></>],
                  [3, <>Nobody wrote <span style={{ color: '#a479e2' }}>it down.</span></>],
                  [4, <>The coach <span style={{ color: '#d95926' }}>saw it coming.</span></>],
                  [5, <>Pitch <span style={{ color: '#3ddc84' }}>keeps it.</span> For all of them.</>],
                ] as [number, React.ReactNode][]).map(([i, node]) => (
                  <div key={i} style={{ position: 'absolute', left: 0, bottom: 0, ...cap(i), transition: 'opacity .25s, transform .25s', textWrap: 'balance' as never }}>{node}</div>
                ))}
              </div>
              {/* Always-visible product clarity line (BUZ, 3 Sep, on reader feedback) —
                  reuses the highlight-card wording so the visitor knows what
                  Pitch is at first paint, on every scroll beat */}
              <div style={{ fontSize: 14, fontWeight: 700, color: '#b9c8bf', letterSpacing: '.02em' }}>
                <span style={{ color: '#3ddc84' }}>Pitch</span> — your football, finally on the record.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18 }}>
                <div style={{ position: 'relative', flex: '1 1 320px', minHeight: '3.2em', maxWidth: 520, fontSize: 'clamp(15px, 1.4vw, 19px)', color: '#dfe8e2', fontWeight: 500, lineHeight: 1.5, textShadow: '0 2px 16px rgba(0,0,0,.6)' }}>
                  {[
                    'Seasons end. Coaches move. Clubs change. The record should be the thing that stays.',
                    'Saturday, 3:07pm. Number 9 picks it up on the wing.',
                    'Every Tuesday under lights. Every position he was moved to. Every coach who moved him.',
                    'The net, the pile-on, the fence going up. It was there. Then it wasn’t.',
                    'Three seasons ago he moved a full-back to the wing. Nobody wrote that down either.',
                    'The player’s page. The coach’s record. The club’s register. One second on a Saturday, kept for every one of them.',
                  ].map((t, i) => (
                    <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: 0, opacity: cap(i).opacity, transition: 'opacity .25s' }}>{t}</div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, pointerEvents: 'auto' }}>
                  <div onClick={() => go(formRef)} style={{ cursor: 'pointer', background: '#3ddc84', color: '#06130c', fontWeight: 800, fontSize: 15, borderRadius: 14, padding: '0 22px', height: 52, display: 'flex', alignItems: 'center' }}>Join the waitlist</div>
                  <div onClick={() => go(seatRef)} style={{ cursor: 'pointer', background: 'rgba(255,255,255,.12)', backdropFilter: 'blur(10px)', color: '#fff', fontWeight: 800, fontSize: 15, borderRadius: 14, padding: '0 22px', height: 52, display: 'flex', alignItems: 'center', border: '1px solid rgba(255,255,255,.18)' }}>Pick your seat</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 6 }}>
                <div style={{ flex: 1, height: 3, borderRadius: 999, background: 'rgba(255,255,255,.14)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(fp * 100).toFixed(1)}%`, background: '#3ddc84', boxShadow: '0 0 12px rgba(61,220,132,.8)' }} />
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)', whiteSpace: 'nowrap' }}>{filmHint}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== THE DEVELOPMENT STORY ===== */}
      <div style={{ padding: '100px 0 20px 0' }}>
        <div data-reveal="1" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 34px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, ...reveal }}>
          <div style={{ ...kicker, color: '#3ddc84' }}>The development story</div>
          <div style={{ fontSize: 'clamp(36px, 5.2vw, 68px)', fontWeight: 900, letterSpacing: '-.04em', lineHeight: 0.98, maxWidth: 860, textWrap: 'balance' as never }}>What if development left a trail, not just a memory?</div>
          <div style={{ fontSize: 16, color: '#b9c8bf', fontWeight: 500, lineHeight: 1.6, maxWidth: 560, textWrap: 'pretty' as never }}>The goal took a second. The run took a season of Tuesdays. Right now all of that lives in someone’s memory — a parent’s, a coach’s, yours. We’ve been wondering what it would mean if it didn’t have to.</div>
        </div>
        <div data-reveal="1" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, ...reveal, transition: 'opacity .7s .1s ease, transform .7s .1s cubic-bezier(.22,1,.36,1)' }}>
          {STORY.map(([k, t, d, poster]) => (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ position: 'relative', borderRadius: 22, overflow: 'hidden', aspectRatio: '4 / 3', background: '#0a0f0c' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={poster} alt={k} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(7,11,9,0) 50%, rgba(7,11,9,.55) 100%)' }} />
                <div style={{ position: 'absolute', left: 14, bottom: 14, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#eef5f0', background: 'rgba(7,11,9,.62)', backdropFilter: 'blur(8px)', borderRadius: 999, padding: '6px 11px' }}>{k}</div>
              </div>
              <div style={{ padding: '0 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-.015em' }}>{t}</div>
                <div style={{ fontSize: 13.5, color: '#b9c8bf', fontWeight: 500, lineHeight: 1.55 }}>{d}</div>
              </div>
            </div>
          ))}
        </div>

        {/* roadmap */}
        <div data-reveal="1" style={{ maxWidth: 1100, margin: '40px auto 0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, ...reveal }}>
          {ROADMAP.map(([who, t, status, d, k]) => (
            <div key={who} style={{ background: '#0d1411', border: '1px solid #1c2822', borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: ACC[k] }}>{who}</div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: status === 'Settled' ? '#3ddc84' : '#b9c8bf', background: status === 'Settled' ? 'rgba(61,220,132,.14)' : 'rgba(255,255,255,.08)', borderRadius: 999, padding: '3px 8px' }}>{status}</div>
              </div>
              <div style={{ fontSize: 15.5, fontWeight: 900, lineHeight: 1.2, letterSpacing: '-.015em' }}>{t}</div>
              <div style={{ fontSize: 12.5, color: '#7d8f85', fontWeight: 500, lineHeight: 1.5 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== A CLOSER LOOK ===== */}
      <div ref={lookRef} style={{ padding: '110px 24px 40px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 40 }}>
          <div data-reveal="1" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, ...reveal }}>
            <div style={{ ...kicker, color: accent, transition: 'color .4s' }}>{LOOKS[P][0]}</div>
            <div style={{ fontSize: 'clamp(34px, 4.6vw, 56px)', fontWeight: 900, letterSpacing: '-.035em', lineHeight: 1 }}>Take a closer look.</div>
            <div style={{ fontSize: 15, color: '#b9c8bf', fontWeight: 500, maxWidth: 520, lineHeight: 1.55, textWrap: 'pretty' as never }}>{LOOKS[P][1]}</div>
            {seatChips(true)}
          </div>
          <div data-reveal="1" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 48, ...reveal }}>
            {/* phone */}
            <div style={{ width: 320, background: '#0b120e', border: '1px solid #24322a', borderRadius: 40, padding: 14, boxShadow: '0 60px 120px -40px rgba(0,0,0,1), inset 0 0 0 6px #050806' }}>
              <div key={P} style={{ borderRadius: 28, overflow: 'hidden', background: '#0b120e', display: 'flex', flexDirection: 'column', gap: 10, padding: '18px 14px 20px 14px', animation: 'rise .5s both' }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}><div style={{ width: 90, height: 24, borderRadius: 999, background: '#050806' }} /></div>

                {P === 'player' && (<>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 2px', borderRadius: 12, outlineOffset: 4, transition: 'opacity .3s', ...lk('head') }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: '#3ddc84', color: '#06130c', fontWeight: 900, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><div style={{ fontSize: 15, fontWeight: 900 }}>Nate Okafor</div><div style={{ fontSize: 11.5, color: '#7d8f85', fontWeight: 600 }}>19 · Goalkeeper · Melbourne</div></div>
                  </div>
                  <div style={{ position: 'relative', height: 96, borderRadius: 12, background: '#135a34', border: '2px solid rgba(255,255,255,.4)', overflow: 'hidden', outlineOffset: 3, transition: 'opacity .3s', ...lk('pos') }}>
                    <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,.4)' }} />
                    <div style={{ position: 'absolute', left: '8%', top: '50%', width: 22, height: 22, margin: -11, borderRadius: 999, background: '#3ddc84', color: '#06130c', fontSize: 8.5, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>GK</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, borderRadius: 12, outlineOffset: 4, transition: 'opacity .3s', ...lk('clubs') }}>
                    <div style={phoneRow}><div>Brunswick City</div><div style={{ color: '#7d8f85' }}>Seniors · 2 seasons</div></div>
                    <div style={phoneRow}><div>Kingsway Rovers</div><div style={{ color: '#7d8f85' }}>U18 · 3 seasons</div></div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, borderRadius: 12, outlineOffset: 4, transition: 'opacity .3s', ...lk('nums') }}>
                    <div style={phoneStat}><div style={{ fontSize: 18, fontWeight: 900 }}>38</div><div style={phoneStatK}>APPS</div></div>
                    <div style={phoneStat}><div style={{ fontSize: 18, fontWeight: 900 }}>14</div><div style={phoneStatK}>CLEAN</div></div>
                    <div style={phoneStat}><div style={{ fontSize: 18, fontWeight: 900 }}>6</div><div style={phoneStatK}>PENS</div></div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, borderRadius: 12, outlineOffset: 4, transition: 'opacity .3s', ...lk('clips') }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{ flex: 1, aspectRatio: '16/10', borderRadius: 10, background: 'linear-gradient(140deg, #1d3a2b, #0f1f17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#eef5f0"><path d="M8 5 l11 7 -11 7z" /></svg>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#121b16', borderRadius: 12, padding: '10px 12px', outlineOffset: 3, transition: 'opacity .3s', ...lk('link') }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}><div style={{ fontSize: 12, fontWeight: 800 }}>Link is on</div><div style={{ fontSize: 10.5, color: '#7d8f85', fontWeight: 600 }}>2 clubs can open it · 61 days left</div></div>
                    <div style={{ width: 38, height: 22, borderRadius: 999, background: '#3ddc84', position: 'relative' }}><div style={{ position: 'absolute', top: 3, left: 19, width: 16, height: 16, borderRadius: 999, background: '#fff' }} /></div>
                  </div>
                </>)}

                {P === 'coach' && (<>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 2px', borderRadius: 12, outlineOffset: 4, transition: 'opacity .3s', ...lk('chead') }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: '#d95926', color: '#14080a', fontWeight: 900, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>SH</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><div style={{ fontSize: 15, fontWeight: 900 }}>Sarah Hale</div><div style={{ fontSize: 11.5, color: '#7d8f85', fontWeight: 600 }}>Head coach · 11 seasons · Melbourne</div></div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, borderRadius: 12, outlineOffset: 4, transition: 'opacity .3s', ...lk('clic') }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, background: '#121b16', borderRadius: 10, padding: '9px 10px', fontSize: 11.5, fontWeight: 800 }}><Check color="#3ddc84" size={12} />WWCC checked</div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, background: '#121b16', borderRadius: 10, padding: '9px 10px', fontSize: 11.5, fontWeight: 800 }}><Check color="#3ddc84" size={12} />C Licence</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, borderRadius: 12, outlineOffset: 4, transition: 'opacity .3s', ...lk('csquads') }}>
                    <div style={phoneRow}><div>Kingsway Rovers · U15 Boys</div><div style={{ color: '#7d8f85' }}>2024–26</div></div>
                    <div style={phoneRow}><div>Brunswick City · U13 Girls</div><div style={{ color: '#7d8f85' }}>2021–23</div></div>
                    <div style={phoneRow}><div>Northcote FC · Seniors asst.</div><div style={{ color: '#7d8f85' }}>2015–20</div></div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, borderRadius: 12, outlineOffset: 4, transition: 'opacity .3s', ...lk('cplayers') }}>
                    <div style={phoneStat}><div style={{ fontSize: 18, fontWeight: 900 }}>11</div><div style={phoneStatK}>SEASONS</div></div>
                    <div style={phoneStat}><div style={{ fontSize: 18, fontWeight: 900 }}>9</div><div style={phoneStatK}>SQUADS</div></div>
                    <div style={phoneStat}><div style={{ fontSize: 18, fontWeight: 900 }}>140</div><div style={phoneStatK}>PLAYERS</div></div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, borderRadius: 12, outlineOffset: 4, transition: 'opacity .3s', ...lk('cword') }}>
                    <div style={{ background: '#121b16', borderRadius: 10, padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: '#d95926' }}>HER WORD · ON A PLAYER&apos;S PAGE</div>
                      <div style={{ fontSize: 11.5, color: '#c8d6cd', fontWeight: 500, lineHeight: 1.4 }}>&quot;Deniz — two seasons, never missed a session. Reads the game early.&quot;</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#121b16', borderRadius: 12, padding: '10px 12px', outlineOffset: 3, transition: 'opacity .3s', ...lk('clink') }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}><div style={{ fontSize: 12, fontWeight: 800 }}>Link is on</div><div style={{ fontSize: 10.5, color: '#7d8f85', fontWeight: 600 }}>1 club can open it · 30 days left</div></div>
                    <div style={{ width: 38, height: 22, borderRadius: 999, background: '#d95926', position: 'relative' }}><div style={{ position: 'absolute', top: 3, left: 19, width: 16, height: 16, borderRadius: 999, background: '#fff' }} /></div>
                  </div>
                </>)}

                {P === 'club' && (<>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 2px', borderRadius: 12, outlineOffset: 4, transition: 'opacity .3s', ...lk('khead') }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: '#eda100', color: '#14100a', fontWeight: 900, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>KR</div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}><div style={{ fontSize: 15, fontWeight: 900 }}>Kingsway Rovers FC</div><div style={{ fontSize: 11.5, color: '#7d8f85', fontWeight: 600 }}>Est. 1979 · 14 squads · Melbourne</div></div>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', color: '#eda100', border: '1px solid rgba(237,161,0,.4)', borderRadius: 999, padding: '3px 7px' }}>FOUNDING</div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, borderRadius: 12, outlineOffset: 4, transition: 'opacity .3s', ...lk('ksquads') }}>
                    <div style={{ flex: 1, background: '#121b16', borderRadius: 10, padding: '8px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}><div style={{ fontSize: 12, fontWeight: 900 }}>U13 G</div><div style={{ fontSize: 9, fontWeight: 800, color: '#7d8f85' }}>18 players</div></div>
                    <div style={{ flex: 1, background: '#121b16', borderRadius: 10, padding: '8px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, border: '1px solid #eda100' }}><div style={{ fontSize: 12, fontWeight: 900 }}>U15 B</div><div style={{ fontSize: 9, fontWeight: 800, color: '#eda100' }}>Trial live</div></div>
                    <div style={{ flex: 1, background: '#121b16', borderRadius: 10, padding: '8px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}><div style={{ fontSize: 12, fontWeight: 900 }}>Seniors</div><div style={{ fontSize: 9, fontWeight: 800, color: '#7d8f85' }}>25 players</div></div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, borderRadius: 12, outlineOffset: 4, transition: 'opacity .3s', ...lk('kreg') }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(160deg, #2b2415, #14170f)', border: '1px solid #4a3a12', borderRadius: 10, padding: '9px 11px', fontSize: 12, fontWeight: 700 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}><div>Interest Register · U15 Boys</div><div style={{ fontSize: 10.5, color: '#b9aa7a', fontWeight: 600 }}>16 want in · 4 new this week</div></div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#eda100' }}>16</div>
                    </div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {([['GK', 2], ['DEF', 6], ['MID', 5], ['FWD', 3]] as [string, number][]).map(([k, n]) => (
                        <div key={k} style={{ flex: 1, background: '#121b16', borderRadius: 10, padding: 7, display: 'flex', flexDirection: 'column', alignItems: 'center' }}><div style={{ fontSize: 15, fontWeight: 900 }}>{n}</div><div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '.1em', color: '#7d8f85' }}>{k}</div></div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, borderRadius: 12, outlineOffset: 4, transition: 'opacity .3s', ...lk('kcvs') }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#121b16', borderRadius: 10, padding: '9px 11px', fontSize: 12, fontWeight: 700 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 22, height: 22, borderRadius: 7, background: '#3ddc84', color: '#06130c', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>9</div>Deniz K. · CAM / LW</div>
                      <div style={{ color: '#3ddc84', fontSize: 10.5 }}>Live page</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#121b16', borderRadius: 10, padding: '9px 11px', fontSize: 12, fontWeight: 700 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 22, height: 22, borderRadius: 7, background: '#3ddc84', color: '#06130c', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</div>Nate O. · GK</div>
                      <div style={{ color: '#3ddc84', fontSize: 10.5 }}>Live page</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#121b16', borderRadius: 12, padding: '10px 12px', outlineOffset: 3, transition: 'opacity .3s', ...lk('keyes') }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}><div style={{ fontSize: 12, fontWeight: 800 }}>Two sets of eyes</div><div style={{ fontSize: 10.5, color: '#7d8f85', fontWeight: 600 }}>TD reads the record · registrar sees names and squads</div></div>
                    <div style={{ display: 'flex' }}><div style={{ width: 22, height: 22, borderRadius: 999, background: '#eda100', border: '2px solid #0b120e' }} /><div style={{ width: 22, height: 22, borderRadius: 999, background: '#7d8f85', border: '2px solid #0b120e', marginLeft: -8 }} /></div>
                  </div>
                </>)}

                {P === 'parent' && (<>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 2px', borderRadius: 12, outlineOffset: 4, transition: 'opacity .3s', ...lk('phead') }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: '#a479e2', color: '#120a1e', fontWeight: 900, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>AK</div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}><div style={{ fontSize: 15, fontWeight: 900 }}>Ayşe Kaya</div><div style={{ fontSize: 11.5, color: '#7d8f85', fontWeight: 600 }}>Guardian of 1 page · holds every key</div></div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#121b16', borderRadius: 12, padding: '10px 11px', outlineOffset: 3, transition: 'opacity .3s', ...lk('pchild') }}>
                    <div style={{ width: 34, height: 34, borderRadius: 11, background: '#3ddc84', color: '#06130c', fontWeight: 900, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>9</div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}><div style={{ fontSize: 13, fontWeight: 900 }}>Deniz · 14 · CAM / LW</div><div style={{ fontSize: 10.5, color: '#7d8f85', fontWeight: 600 }}>Kingsway Rovers U15 · his page, your keys</div></div>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', color: '#a479e2', border: '1px solid rgba(164,121,226,.4)', borderRadius: 999, padding: '3px 7px' }}>U18</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'rgba(164,121,226,.1)', border: '1px solid rgba(164,121,226,.3)', borderRadius: 12, padding: '10px 11px', outlineOffset: 3, transition: 'opacity .3s', ...lk('preq') }}>
                    <div style={{ fontSize: 12, fontWeight: 800 }}>Deniz wants to send his page</div>
                    <div style={{ fontSize: 10.5, color: '#b9aecc', fontWeight: 600 }}>to Kingsway Rovers FC · U15 Boys</div>
                    <div style={{ height: 30, borderRadius: 999, background: 'rgba(255,255,255,.07)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800, color: '#d6cde6' }}>
                      <div style={{ position: 'absolute', left: 3, top: 3, width: 24, height: 24, borderRadius: 999, background: '#a479e2' }} />
                      Slide to send →
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, borderRadius: 12, outlineOffset: 4, transition: 'opacity .3s', ...lk('pkeys') }}>
                    <div style={{ ...phoneRow, alignItems: 'center' }}><div>The page · 2 clubs can open it</div><div style={{ width: 32, height: 18, borderRadius: 999, background: '#3ddc84', position: 'relative' }}><div style={{ position: 'absolute', top: 2, left: 16, width: 14, height: 14, borderRadius: 999, background: '#fff' }} /></div></div>
                    <div style={{ ...phoneRow, alignItems: 'center' }}><div>Every send · read by you first</div><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a479e2" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11 V8 a4 4 0 0 1 8 0 v3" /></svg></div>
                    <div style={{ ...phoneRow, alignItems: 'center' }}><div>Pause everything</div><div style={{ fontSize: 10.5, color: '#7d8f85' }}>Hold 1s</div></div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, borderRadius: 12, outlineOffset: 4, transition: 'opacity .3s', ...lk('pfeed') }}>
                    {['FEED', 'MESSAGES', 'RANKING'].map((k) => (
                      <div key={k} style={phoneStat}><div style={{ fontSize: 16, fontWeight: 900, color: '#7d8f85' }}>—</div><div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '.1em', color: '#7d8f85' }}>{k}</div></div>
                    ))}
                  </div>
                </>)}
              </div>
            </div>
            {/* tabs */}
            <div style={{ flex: '1 1 300px', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {LOOKS[P][2].map(([k, title, desc]) => {
                const on = s.look === k;
                return (
                  <div key={k} onClick={() => set({ look: k })} style={{ cursor: 'pointer', borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4, background: on ? '#0d1411' : 'transparent', border: `1px solid ${on ? accent : 'transparent'}`, transition: 'all .25s' }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: on ? '#eef5f0' : '#7d8f85' }}>{title}</div>
                    <div style={{ fontSize: 13, color: '#b9c8bf', fontWeight: 500, lineHeight: 1.5, maxHeight: on ? 80 : 0, overflow: 'hidden', opacity: on ? 1 : 0, transition: 'all .3s' }}>{desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>



      {/* Mid-page conversion moment (BUZ, 3 Sep, on reader feedback) */}
      <div data-reveal="1" style={{ maxWidth: 1100, margin: '0 auto', padding: '70px 24px 0 24px', ...reveal }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '18px 28px', background: 'linear-gradient(90deg, rgba(61,220,132,.1), rgba(61,220,132,.03))', border: '1px solid rgba(61,220,132,.28)', borderRadius: 20, padding: '26px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 'clamp(20px, 2.6vw, 28px)', fontWeight: 900, letterSpacing: '-.02em', textWrap: 'balance' as never }}>Your football history shouldn’t disappear.</div>
          <div onClick={() => go(formRef)} style={{ cursor: 'pointer', background: '#3ddc84', color: '#06130c', fontWeight: 800, fontSize: 15, borderRadius: 14, padding: '0 22px', height: 50, display: 'flex', alignItems: 'center' }}>Join the waitlist</div>
        </div>
      </div>

      {/* ===== FOUNDING XI ===== */}
      <div data-reveal="1" style={{ maxWidth: 1100, margin: '0 auto', padding: '90px 24px 20px 24px', ...reveal }}>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 32, background: 'linear-gradient(160deg, #2b2415 0%, #171409 55%, #0d120e 100%)', border: '1px solid #4a3a12', padding: 'clamp(28px, 4vw, 56px)', display: 'flex', flexWrap: 'wrap', gap: 36, alignItems: 'center' }}>
          <div style={{ position: 'absolute', right: -40, top: -60, fontSize: 300, fontWeight: 900, letterSpacing: '-.08em', color: 'rgba(237,161,0,.07)', lineHeight: 1, pointerEvents: 'none' }}>XI</div>
          <div style={{ position: 'relative', flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: '#eda100' }}>For clubs · the Founding XI</div>
            <div style={{ fontSize: 'clamp(30px, 3.8vw, 48px)', fontWeight: 900, lineHeight: 1.0, letterSpacing: '-.035em', textWrap: 'balance' as never }}>Eleven clubs start this with us. Their names stay on it.</div>
            <div style={{ fontSize: 15, color: '#d9cfb3', fontWeight: 500, lineHeight: 1.6, maxWidth: 480, textWrap: 'pretty' as never }}>Eleven clubs will be the first on Pitch. They’ll see it before anyone else, tell us what’s wrong with it, and shape Club Pro and Coach Pro with us. A founding club carries the mark for good — and gets no edge in search, ranking or discovery. That’s a promise to every other club.</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
              {['Founding mark on your club page', 'A direct line to the people building it', 'Shape Club Pro and Coach Pro with us'].map((c) => (
                <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.06)', borderRadius: 999, padding: '8px 13px', fontSize: 12.5, fontWeight: 700, color: '#eef5f0' }}>
                  <Check color="#eda100" />{c}
                </div>
              ))}
            </div>
          </div>
          <div style={{ position: 'relative', flex: '0 1 320px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {Array.from({ length: 11 }, (_, i) => (
                <div key={i} style={{ aspectRatio: '1', borderRadius: 14, border: '1.5px dashed rgba(237,161,0,.35)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, color: 'rgba(237,161,0,.55)' }}>{i + 1}</div>
              ))}
              <div onClick={() => goFormAs('club')} style={{ cursor: 'pointer', aspectRatio: '1', borderRadius: 14, background: '#eda100', color: '#14100a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22 }}>+</div>
            </div>
            <div style={{ fontSize: 12, color: '#b9aa7a', fontWeight: 600, lineHeight: 1.5 }}>Eleven seats, none taken yet. Founding clubs’ names go up when we open.</div>
            <div onClick={() => goFormAs('club')} style={{ cursor: 'pointer', marginTop: 4, background: '#eda100', color: '#14100a', fontWeight: 800, fontSize: 15, borderRadius: 14, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Register your club’s interest</div>
          </div>
        </div>
      </div>

      {/* ===== HIGHLIGHTS · the replay ===== */}
      <div ref={hiRef} style={{ padding: '90px 0 40px 0' }}>
        <div data-reveal="1" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 26px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, ...reveal }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: 999, background: '#e34948', boxShadow: '0 0 10px #e34948', animation: 'pulse 1.6s infinite' }} />
              <div style={{ ...kicker, color: '#eef5f0' }}>The replay · five angles on one goal</div>
            </div>
            <div style={{ fontSize: 'clamp(34px, 4.6vw, 56px)', fontWeight: 900, letterSpacing: '-.035em', lineHeight: 1 }}>Get the highlights.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 12.5, color: '#7d8f85', fontWeight: 700 }}>{s.hi + 1} / {HI.length}</div>
            <div className="iconbtn" onClick={() => hiStep(-1)} style={{ cursor: 'pointer', width: 38, height: 38, borderRadius: 12, border: '1px solid rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#eef5f0" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5 L8 12 l7 7" /></svg>
            </div>
            <div className="iconbtn" onClick={() => hiStep(1)} style={{ cursor: 'pointer', width: 38, height: 38, borderRadius: 12, border: '1px solid rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#eef5f0" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5 l7 7 -7 7" /></svg>
            </div>
          </div>
        </div>
        <div
          ref={hiRail}
          onScroll={(e) => {
            const el = e.currentTarget, card = el.firstElementChild;
            if (!card) return;
            const w = card.getBoundingClientRect().width + 14;
            const i = Math.round(el.scrollLeft / w);
            if (i !== s.hi) set({ hi: Math.max(0, Math.min(HI.length - 1, i)) });
          }}
          style={{ display: 'flex', gap: 14, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollBehavior: 'smooth', padding: '0 max(24px, calc((100vw - 1100px) / 2 + 24px)) 20px', scrollPaddingLeft: 'max(24px, calc((100vw - 1100px) / 2 + 24px))' }}
        >
          {HI.map(([k, time, fi, t, d], i) => (
            <div key={i} className="hlcard" onClick={() => { pick(k, { restoreScroll: false }); go(seatRef); }} style={{ scrollSnapAlign: 'start', flex: '0 0 min(440px, 84vw)', height: 540, position: 'relative', overflow: 'hidden', borderRadius: 28, background: '#0a0f0c', cursor: 'pointer', boxShadow: '0 40px 80px -40px rgba(0,0,0,1)' }}>
              <div className="hlimg" style={{ position: 'absolute', inset: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={FILM_SRC[fi]} alt={t} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
              </div>
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: ACC[k], mixBlendMode: 'soft-light', opacity: 0.35 }} />
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(7,11,9,.35) 0%, rgba(7,11,9,0) 30%, rgba(7,11,9,.2) 55%, rgba(7,11,9,.92) 100%)' }} />
              <div style={{ position: 'absolute', left: 22, top: 20, right: 22, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#eef5f0', background: 'rgba(7,11,9,.55)', backdropFilter: 'blur(8px)', borderRadius: 999, padding: '6px 11px' }}>
                  <div style={{ width: 6, height: 6, borderRadius: 999, background: ACC[k] }} />
                  {SEATS.find((x) => x[0] === k)![1]}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.75)', fontVariantNumeric: 'tabular-nums' }}>{time}</div>
              </div>
              <div style={{ position: 'absolute', left: 22, right: 22, bottom: 22, pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.02, letterSpacing: '-.03em', textWrap: 'balance' as never, color: '#fff', textShadow: '0 6px 30px rgba(0,0,0,.7)' }}>{t}</div>
                <div style={{ fontSize: 13.5, color: '#dfe8e2', fontWeight: 500, lineHeight: 1.5, textWrap: 'pretty' as never, textShadow: '0 2px 12px rgba(0,0,0,.7)' }}>{d}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
                  <div style={{ flex: 1, height: 2, borderRadius: 999, background: 'rgba(255,255,255,.18)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(((i + 1) / HI.length) * 100).toFixed(0)}%`, background: ACC[k] }} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: ACC[k] }}>Take this seat →</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== PICK YOUR SEAT ===== */}
      <div ref={seatRef} style={{ padding: '80px 0 0 0' }}>
        <div data-reveal="1" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, ...reveal }}>
          <div style={{ ...kicker, color: '#3ddc84' }}>Four seats at the ground</div>
          <div style={{ fontSize: 'clamp(34px, 4.6vw, 56px)', fontWeight: 900, letterSpacing: '-.035em', lineHeight: 1 }}>Pick your seat.</div>
          <div style={{ fontSize: 16, color: '#b9c8bf', fontWeight: 500, maxWidth: 520, lineHeight: 1.55 }}>The same product looks different from the pitch, the sideline, the stands and the fence. Stand where you stand.</div>
          {seatChips()}
        </div>

        <div
          className="seat-stage"
          onPointerMove={(e) => {
            if (e.pointerType !== 'mouse') return; // parallax is a mouse affordance; on touch it fights scrolling
            const r = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width - 0.5) * 2;
            const py = ((e.clientY - r.top) / r.height - 0.5) * 2;
            if (Math.abs(px - s.px) > 0.04 || Math.abs(py - s.py) > 0.04) set({ px, py });
          }}
          style={{ position: 'relative', minHeight: 560, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderTop: '1px solid rgba(255,255,255,.06)', borderBottom: '1px solid rgba(255,255,255,.06)' }}
        >
          {/* PLAYER */}
          {P === 'player' && (
            <>
              <div key={`bg-${s.reqKey}`} style={{ position: 'absolute', inset: 0, animation: 'sceneIn .7s cubic-bezier(.22,1,.36,1) both', background: 'linear-gradient(180deg, #04070a 0%, #0a1016 36%, #0b2416 50%, #061009 100%)' }}>
                <div style={{ position: 'absolute', inset: 0, transform: `translate(${pxA.toFixed(1)}px, ${pyA.toFixed(1)}px)`, transition: 'transform .4s ease-out' }}>
                  <div style={{ position: 'absolute', left: '14%', top: '6%', width: 3, height: '40%', background: '#1a222a' }} />
                  <div style={{ position: 'absolute', left: '14%', top: '5%', width: 70, height: 14, marginLeft: -34, borderRadius: 4, background: '#fff5d6', boxShadow: '0 0 60px 30px rgba(255,238,190,.35), 0 0 220px 90px rgba(255,238,190,.12)', animation: 'flicker 6s infinite' }} />
                  <div style={{ position: 'absolute', right: '14%', top: '6%', width: 3, height: '40%', background: '#1a222a' }} />
                  <div style={{ position: 'absolute', right: '14%', top: '5%', width: 70, height: 14, marginRight: -34, borderRadius: 4, background: '#fff5d6', boxShadow: '0 0 60px 30px rgba(255,238,190,.35), 0 0 220px 90px rgba(255,238,190,.12)', animation: 'flicker 7.3s infinite' }} />
                </div>
                {/* plain ground only — no second set of pitch markings behind the goal toy (BUZ, 3 Sep) */}
                <div style={{ position: 'absolute', left: '-20%', right: '-20%', top: '46%', height: '70%', transform: `perspective(700px) rotateX(64deg) translateX(${pxB.toFixed(1)}px)`, transformOrigin: '50% 0', background: 'linear-gradient(180deg, #12522f 0%, #0e4327 100%)', transition: 'transform .4s ease-out' }} />
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '18%', background: 'linear-gradient(180deg, transparent, #05080a)' }} />
              </div>
              <div style={sceneWrap}>
                <div style={sceneText}>
                  <div style={{ ...sceneKicker, color: '#3ddc84' }}>Players · on the pitch</div>
                  <div style={{ ...sceneH2, textShadow: '0 6px 30px rgba(0,0,0,.6)' }}>Every season you’ve played, working for you.</div>
                  <div style={{ fontSize: 15.5, color: '#c8d6cd', fontWeight: 500, lineHeight: 1.6, maxWidth: 440, textWrap: 'pretty' as never, textShadow: '0 2px 12px rgba(0,0,0,.6)' }}>Build your page once and never rebuild your history for a new club again. Send it in one tap, get seen by the right clubs, and watch your development add up season on season — until clubs are finding you.</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={microLabel}>Your number</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {Array.from({ length: 11 }, (_, i) => i + 1).map((n) => (
                        <div key={n} onClick={() => set({ number: n })} style={{ cursor: 'pointer', width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, transition: 'all .15s', ...chipStyle(n === s.number, '#3ddc84') }}>{n}</div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={microLabel}>Where you play · up to three</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {Object.keys(POS).map((n) => (
                        <div key={n} onClick={() => {
                          const on = s.pos.includes(n);
                          if (on) set({ pos: s.pos.filter((x) => x !== n) });
                          else if (s.pos.length < 3) set({ pos: [...s.pos, n] });
                        }} style={{ cursor: 'pointer', borderRadius: 999, padding: '9px 13px', fontWeight: 900, fontSize: 12.5, transition: 'all .15s', ...chipStyle(s.pos.includes(n), '#3ddc84') }}>{n}</div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, paddingTop: 4 }}>
                    <div onClick={() => goFormAs('player')} style={{ cursor: 'pointer', background: '#3ddc84', color: '#06130c', fontWeight: 800, fontSize: 15, borderRadius: 14, padding: '0 22px', height: 50, display: 'flex', alignItems: 'center' }}>Join the waitlist</div>
                    <div style={{ fontSize: 12.5, color: '#9fb0a6', fontWeight: 600 }}>Under 18? A parent joins the waitlist for you.</div>
                  </div>
                </div>
                {/* live page + shooting range */}
                <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, animation: 'rise .6s .25s cubic-bezier(.22,1,.36,1) both' }}>
                  <div style={{ width: '100%', maxWidth: 300 }}>
                    <div
                      ref={rangeRef}
                      style={{ position: 'relative', width: '100%', aspectRatio: '1 / 0.9', userSelect: 'none', WebkitUserSelect: 'none' }}
                    >
                      <div style={{ position: 'absolute', left: '22%', right: '22%', top: '4%', height: '28%', border: '5px solid #f4f6f4', borderBottom: 'none', borderRadius: '3px 3px 0 0', boxShadow: '0 0 50px rgba(255,255,255,.14)' }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, rgba(255,255,255,.28) 0 1px, transparent 1px 9px), repeating-linear-gradient(0deg, rgba(255,255,255,.28) 0 1px, transparent 1px 9px)', transformOrigin: '50% 0', animation: s.netHit ? `net .6s ease ${s.netHit}` : 'none' }} />
                        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, background: 'rgba(255,255,255,.7)' }} />
                      </div>
                      {/* penalty-box markings — the ball sits on the spot, like a penalty (BUZ, 3 Sep) */}
                      <div style={{ position: 'absolute', left: '2%', right: '2%', top: '32%', height: 2, background: 'rgba(255,255,255,.35)' }} />
                      <div style={{ position: 'absolute', left: '10%', right: '10%', top: '32%', bottom: '14%', border: '2px solid rgba(255,255,255,.35)', borderTop: 'none' }} />
                      <div style={{ position: 'absolute', left: '28%', right: '28%', top: '32%', height: '17%', border: '2px solid rgba(255,255,255,.35)', borderTop: 'none' }} />
                      <div style={{ position: 'absolute', left: '50%', top: '86%', width: '26%', aspectRatio: '2 / 1', transform: 'translateX(-50%)', border: '2px solid rgba(255,255,255,.35)', borderTop: 'none', borderRadius: '0 0 999px 999px' }} />
                      <div style={{ position: 'absolute', left: '50%', top: '74%', width: 10, height: 10, margin: -5, borderRadius: 999, background: 'rgba(255,255,255,.5)' }} />
                      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
                        <line x1="50%" y1="74%" x2={`${50 + (50 - s.ball.x) * 2.6}%`} y2={`${74 + (74 - s.ball.y) * 2.6}%`} stroke="#3ddc84" strokeWidth="3" strokeDasharray="6 8" strokeLinecap="round" opacity={s.drag && pull > 4 ? 0.9 : 0} />
                      </svg>
                      <div
                        onPointerDown={() => {
                          if (s.flying) return;
                          ballDragRef.current = true;
                          set({ drag: true });
                        }}
                        style={{
                          // touch-action lives on the ball, not the whole range — a full-width
                          // no-scroll zone is a trap on a phone (README allows touch fallbacks)
                          touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
                          position: 'absolute', left: `${s.ball.x}%`, top: `${s.ball.y}%`, width: 42, height: 42, margin: -21, borderRadius: 999, cursor: 'grab',
                          transform: `scale(${s.flying ? 0.55 : s.drag ? 1.08 : 1}) rotate(${s.flying ? 540 : 0}deg)`,
                          transition: s.flying ? 'left .6s cubic-bezier(.2,.7,.3,1), top .6s cubic-bezier(.2,.7,.3,1), transform .6s ease-out' : s.drag ? 'none' : 'left .3s, top .3s, transform .2s',
                          background: 'radial-gradient(circle at 35% 30%, #ffffff 0%, #e8ebe8 45%, #a7b0aa 100%)', boxShadow: '0 16px 26px -8px rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <svg width="42" height="42" viewBox="0 0 46 46"><polygon points="23,13 31,19 28,29 18,29 15,19" fill="#1a2420" /><polygon points="7,20 13,16 15,22 10,27" fill="#1a2420" /><polygon points="39,20 33,16 31,22 36,27" fill="#1a2420" /><polygon points="17,37 23,33 29,37 26,43 20,43" fill="#1a2420" /><polygon points="23,3 28,7 18,7" fill="#1a2420" /></svg>
                      </div>
                      {s.flash && (
                        <div style={{ position: 'absolute', left: '-20%', right: '-20%', top: '34%', textAlign: 'center', fontSize: 48, fontWeight: 900, letterSpacing: '-.04em', color: s.flash === 'GOAL' ? '#3ddc84' : '#eef5f0', textShadow: '0 0 40px rgba(61,220,132,.7)', animation: 'goalFlash 1.1s ease both', pointerEvents: 'none' }}>{s.flash}</div>
                      )}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#7d8f85' }}>{s.drag ? 'Let go' : s.flying ? '' : 'Pull the ball back and let go'}</div>
                  </div>
                  <div style={{ width: '100%', maxWidth: 340, background: 'rgba(7,11,9,.86)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 24, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 40px 80px -30px rgba(0,0,0,1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 56, height: 56, borderRadius: 16, background: '#3ddc84', color: '#06130c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 26, letterSpacing: '-.04em', transition: 'all .2s' }}>{s.number}</div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7d8f85' }}>Your page · live</div>
                        <div style={{ fontSize: 16, fontWeight: 900 }}>{s.pos.length ? s.pos.join(' · ') : 'Pick a position'}</div>
                      </div>
                    </div>
                    <div style={{ position: 'relative', height: 90, borderRadius: 14, background: '#135a34', border: '2px solid rgba(255,255,255,.4)', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,.4)' }} />
                      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 36, height: 36, margin: -18, border: '2px solid rgba(255,255,255,.4)', borderRadius: 999 }} />
                      {s.pos.map((n) => (
                        <div key={n} style={{ position: 'absolute', left: `${POS[n][0]}%`, top: `${POS[n][1]}%`, width: 22, height: 22, margin: -11, borderRadius: 999, background: '#3ddc84', color: '#06130c', fontSize: 8.5, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(61,220,132,.8)', animation: 'tick .3s ease both' }}>{n}</div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1, background: '#121b16', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}><div key={`g${s.goals}`} style={{ fontSize: 22, fontWeight: 900, animation: 'tick .35s both' }}>{s.goals}</div><div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.12em', color: '#7d8f85' }}>GOALS</div></div>
                      <div style={{ flex: 1, background: '#121b16', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}><div key={`s${s.shots}`} style={{ fontSize: 22, fontWeight: 900, animation: 'tick .35s both' }}>{s.shots}</div><div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.12em', color: '#7d8f85' }}>SHOTS</div></div>
                      <div style={{ flex: 1, background: '#121b16', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}><div style={{ fontSize: 22, fontWeight: 900 }}>3</div><div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.12em', color: '#7d8f85' }}>CLUBS</div></div>
                    </div>
                    <div style={{ fontSize: 12, color: '#7d8f85', fontWeight: 600, textAlign: 'center' }}>Pull the ball back and let go. Goals write themselves in.</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* COACH */}
          {P === 'coach' && (
            <>
              <div style={{ position: 'absolute', inset: 0, animation: 'sceneIn .7s cubic-bezier(.22,1,.36,1) both', background: 'linear-gradient(180deg, #05070a 0%, #0a1017 40%, #0a1a12 62%, #061009 100%)' }}>
                <div style={{ position: 'absolute', inset: 0, transform: `translate(${pxA.toFixed(1)}px, ${pyA.toFixed(1)}px)`, transition: 'transform .4s ease-out' }}>
                  <div style={{ position: 'absolute', left: '12%', top: '6%', width: 3, height: '48%', background: '#1a222a' }} />
                  <div style={{ position: 'absolute', left: '12%', top: '5%', width: 60, height: 14, marginLeft: -29, borderRadius: 4, background: '#fff5d6', boxShadow: '0 0 60px 30px rgba(255,238,190,.35), 0 0 200px 80px rgba(255,238,190,.12)', animation: 'flicker 6s infinite' }} />
                  <div style={{ position: 'absolute', right: '18%', top: '4%', width: 3, height: '50%', background: '#1a222a' }} />
                  <div style={{ position: 'absolute', right: '18%', top: '3%', width: 60, height: 14, marginRight: -29, borderRadius: 4, background: '#fff5d6', boxShadow: '0 0 60px 30px rgba(255,238,190,.35), 0 0 200px 80px rgba(255,238,190,.12)', animation: 'flicker 7.3s infinite' }} />
                </div>
                <div style={{ position: 'absolute', left: '-10%', right: '-10%', top: '52%', height: '60%', transform: `perspective(700px) rotateX(62deg) translateX(${pxB.toFixed(1)}px)`, transformOrigin: '50% 0', background: 'repeating-linear-gradient(90deg, #17683c 0 8%, #14593a 8% 16%)', border: '4px solid rgba(255,255,255,.7)', boxSizing: 'border-box', transition: 'transform .4s ease-out' }}>
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 4, marginLeft: -2, background: 'rgba(255,255,255,.7)' }} />
                  <div style={{ position: 'absolute', left: '50%', top: '50%', width: '18%', aspectRatio: '1', margin: '-9% 0 0 -9%', border: '4px solid rgba(255,255,255,.7)', borderRadius: 999 }} />
                </div>
                <div style={{ position: 'absolute', left: 0, right: 0, top: '52%', height: 10, background: '#e8ecef', opacity: 0.9 }} />
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '12%', background: 'linear-gradient(180deg, transparent, #05080a 60%)' }} />
              </div>
              <div style={sceneWrap}>
                <div style={sceneText}>
                  <div style={{ ...sceneKicker, color: '#d95926' }}>Coaches · the sideline</div>
                  <div style={sceneH2}>Ten seasons on the touchline. Make them count.</div>
                  <div style={{ fontSize: 15.5, color: '#b9c8bf', fontWeight: 500, lineHeight: 1.6, maxWidth: 440, textWrap: 'pretty' as never }}>You’ve built squads, moved players, done the courses. Pitch turns that into a record that gets you the next role — and puts your word on the players you developed, so their progress carries your name wherever they go.</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={microLabel}>Set the shape · drag a magnet · draw a run on the board</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {Object.keys(FORMS).map((name) => (
                        <div key={name} onClick={() => set({ formation: name, magnets: FORMS[name].map((v) => [...v] as XY) })} style={{ cursor: 'pointer', borderRadius: 999, padding: '9px 14px', fontWeight: 900, fontSize: 13, transition: 'all .15s', ...chipStyle(name === s.formation, '#d95926') }}>{name}</div>
                      ))}
                      <div onClick={() => set({ runs: [], drawing: null })} style={{ cursor: 'pointer', borderRadius: 999, padding: '9px 14px', fontWeight: 800, fontSize: 13, color: '#7d8f85', border: '1px dashed rgba(255,255,255,.18)' }}>Wipe the board</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, paddingTop: 4 }}>
                    <div onClick={() => goFormAs('coach')} style={{ cursor: 'pointer', background: '#d95926', color: '#14080a', fontWeight: 800, fontSize: 15, borderRadius: 14, padding: '0 22px', height: 50, display: 'flex', alignItems: 'center' }}>Join the waitlist</div>
                    <div style={{ fontSize: 12.5, color: '#7d8f85', fontWeight: 600 }}>{s.moved || s.runs.length ? 'That’s the whole record of tonight, unless it’s kept.' : 'Formations are the easy bit. Keeping the record of them isn’t.'}</div>
                  </div>
                </div>
                <div style={{ flex: '1 1 300px', display: 'flex', justifyContent: 'center', animation: 'rise .6s .25s cubic-bezier(.22,1,.36,1) both' }}>
                  <div style={{ width: '100%', maxWidth: 330, background: '#1c1a17', borderRadius: 18, padding: 14, boxShadow: '0 40px 80px -30px rgba(0,0,0,1), inset 0 1px 0 rgba(255,255,255,.08)', transform: 'rotate(-2deg)' }}>
                    <div style={{ width: 60, height: 14, borderRadius: 6, background: '#3a3631', margin: '-22px auto 8px auto', boxShadow: '0 2px 0 #0d0c0a' }} />
                    <div
                      ref={boardRef}
                      onPointerDown={(e) => {
                        const [x, y] = pct(boardRef, e);
                        capture(boardRef.current, e.pointerId);
                        set({ drawing: [[x, y]] });
                      }}
                      onPointerMove={(e) => {
                        const [x, y] = pct(boardRef, e);
                        if (s.mdrag >= 0) {
                          const m = s.magnets.map((v) => [...v] as XY);
                          m[s.mdrag] = [Math.max(4, Math.min(96, x)), Math.max(5, Math.min(95, y))];
                          set({ magnets: m });
                        } else if (s.drawing) {
                          const last = s.drawing[s.drawing.length - 1];
                          if (Math.hypot(x - last[0], y - last[1]) > 1.5) set({ drawing: [...s.drawing, [x, y]] });
                        }
                      }}
                      onPointerUp={() => {
                        if (s.mdrag >= 0) set({ mdrag: -1, moved: s.moved + 1 });
                        else if (s.drawing) set({ runs: s.drawing.length > 3 ? [...s.runs, s.drawing] : s.runs, drawing: null });
                      }}
                      onPointerLeave={() => {
                        if (s.mdrag >= 0) set({ mdrag: -1, moved: s.moved + 1 });
                        else if (s.drawing) set({ runs: s.drawing.length > 3 ? [...s.runs, s.drawing] : s.runs, drawing: null });
                      }}
                      style={{ position: 'relative', aspectRatio: '3 / 4', borderRadius: 10, background: '#135a34', border: '2px solid rgba(255,255,255,.55)', boxSizing: 'border-box', overflow: 'hidden', touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'crosshair' }}
                    >
                      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: 'rgba(255,255,255,.5)', pointerEvents: 'none' }} />
                      <div style={{ position: 'absolute', left: '50%', top: '50%', width: '26%', aspectRatio: '1', margin: '-13% 0 0 -13%', border: '2px solid rgba(255,255,255,.5)', borderRadius: 999, pointerEvents: 'none' }} />
                      <div style={{ position: 'absolute', left: '25%', right: '25%', top: -2, height: '14%', border: '2px solid rgba(255,255,255,.5)', pointerEvents: 'none' }} />
                      <div style={{ position: 'absolute', left: '25%', right: '25%', bottom: -2, height: '14%', border: '2px solid rgba(255,255,255,.5)', pointerEvents: 'none' }} />
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                        {[...s.runs, ...(s.drawing ? [s.drawing] : [])].map((r, i) => (
                          <polyline key={i} points={r.map((p) => p.join(',')).join(' ')} fill="none" stroke="#ffd166" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 1.5" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 3 }} />
                        ))}
                      </svg>
                      {s.magnets.map(([x, y], i) => (
                        <div
                          key={i}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            capture(boardRef.current, e.pointerId);
                            set({ mdrag: i });
                          }}
                          style={{ touchAction: 'none', WebkitTouchCallout: 'none', position: 'absolute', left: `${x}%`, top: `${y}%`, width: 30, height: 30, margin: -15, borderRadius: 999, background: i === 0 ? '#eda100' : '#f3f3ee', color: '#14100a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 12, boxShadow: '0 4px 10px rgba(0,0,0,.5), inset 0 -2px 0 rgba(0,0,0,.25)', cursor: 'grab', transition: s.mdrag === i ? 'none' : 'left .45s cubic-bezier(.22,1,.36,1), top .45s cubic-bezier(.22,1,.36,1), transform .15s', transform: `scale(${s.mdrag === i ? 1.2 : 1})` }}
                        >{i === 0 ? 'GK' : i + 1}</div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 10, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#6e675d' }}>
                      <div>{s.formation}</div>
                      <div>{s.runs.length ? `${s.runs.length} run${s.runs.length > 1 ? 's' : ''} drawn` : 'Draw a run'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* CLUB */}
          {P === 'club' && (
            <>
              <div style={{ position: 'absolute', inset: 0, animation: 'sceneIn .7s cubic-bezier(.22,1,.36,1) both', background: 'linear-gradient(180deg, #05070a 0%, #0a0f14 45%, #0b1a12 70%, #05080a 100%)' }}>
                <div style={{ position: 'absolute', left: '50%', top: '26%', width: '60%', height: '34%', marginLeft: '-30%', transform: `perspective(900px) rotateX(48deg) translateX(${pxB.toFixed(1)}px)`, transformOrigin: '50% 100%', background: 'repeating-linear-gradient(90deg, #17683c 0 10%, #14593a 10% 20%)', border: '3px solid rgba(255,255,255,.6)', boxSizing: 'border-box', boxShadow: '0 0 120px 20px rgba(255,238,190,.12)', transition: 'transform .4s ease-out' }}>
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 3, marginLeft: -1, background: 'rgba(255,255,255,.6)' }} />
                  <div style={{ position: 'absolute', left: '50%', top: '50%', width: '16%', aspectRatio: '1', margin: '-8% 0 0 -8%', border: '3px solid rgba(255,255,255,.6)', borderRadius: 999 }} />
                </div>
                <div style={{ position: 'absolute', left: '50%', top: '20%', width: '20%', height: '8%', marginLeft: '-10%', background: 'radial-gradient(50% 100% at 50% 100%, rgba(255,238,190,.5), transparent)', filter: 'blur(10px)', animation: 'flicker 8s infinite' }} />
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '46%', background: 'repeating-linear-gradient(180deg, #0c1114 0 26px, #14191d 26px 30px, #0a0e11 30px 46px)' }} />
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '46%', background: 'repeating-linear-gradient(90deg, rgba(0,0,0,.35) 0 3px, transparent 3px 34px)', opacity: 0.8 }} />
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: '46%', height: 6, background: '#3b444b', boxShadow: '0 -6px 30px rgba(0,0,0,.6)' }} />
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '30%', background: 'linear-gradient(180deg, transparent, #05080a)' }} />
              </div>
              <div style={sceneWrap}>
                <div style={sceneText}>
                  <div style={{ ...sceneKicker, color: '#eda100' }}>Clubs · the stands</div>
                  <div style={sceneH2}>Know who wants to be here before trial night.</div>
                  <div style={{ fontSize: 15.5, color: '#b9c8bf', fontWeight: 500, lineHeight: 1.6, maxWidth: 440, textWrap: 'pretty' as never }}>Fill squads from players who already want in, see how deep each age group is before trials, and stop losing CVs in an inbox. Then see your whole pathway — U8s to seniors, every coach, every season — in one place.</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={microLabel}>Tap a group on the ground</div>
                      <div onClick={() => set({ whistled: !s.whistled })} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, borderRadius: 999, padding: '7px 12px', fontSize: 12, fontWeight: 800, background: s.whistled ? '#eda100' : 'transparent', color: s.whistled ? '#14100a' : '#eda100', border: `1px solid ${s.whistled ? '#eda100' : 'rgba(237,161,0,.4)'}`, transition: 'all .2s' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12 a5 5 0 1 0 10 0 v-3 h7 l-2 4 h-5" /></svg>
                        {s.whistled ? 'Back out' : 'Blow the whistle'}
                      </div>
                    </div>
                    <div style={{ background: '#121b16', border: '1px solid #24322a', borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ fontSize: 16, fontWeight: 900 }}>{groupCard.name}</div>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#eda100' }}>{groupCard.tag}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {groupCard.lines.map((l) => (
                          <div key={l.k} style={{ flex: 1, background: '#1a2420', borderRadius: 10, padding: '8px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <div key={`${l.k}${l.n}`} style={{ fontSize: 18, fontWeight: 900, animation: 'tick .3s both' }}>{l.n}</div>
                            <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.12em', color: '#7d8f85' }}>{l.k}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: 12.5, color: '#7d8f85', fontWeight: 500, lineHeight: 1.5 }}>{groupCard.note}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, paddingTop: 4 }}>
                    <div onClick={() => goFormAs('club')} style={{ cursor: 'pointer', background: '#eda100', color: '#14100a', fontWeight: 800, fontSize: 15, borderRadius: 14, padding: '0 22px', height: 50, display: 'flex', alignItems: 'center' }}>Join the waitlist</div>
                    <div style={{ fontSize: 12.5, color: '#7d8f85', fontWeight: 600 }}>Interest Register: $54 a month, cancel anytime — or $329 for twelve months.</div>
                  </div>
                </div>
                <div style={{ flex: '1 1 300px', position: 'relative', minHeight: 260, alignSelf: 'stretch' }}>
                  {GROUPS.map((gr, i) => (
                    <div key={gr.name} onClick={() => set({ group: i, whistled: false })} style={{ position: 'absolute', left: `${s.whistled ? 50 + (i - 1) * 16 : gr.x}%`, top: `${s.whistled ? 48 : gr.y}%`, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transform: 'translate(-50%, -50%)', transition: 'left .7s cubic-bezier(.22,1,.36,1), top .7s cubic-bezier(.22,1,.36,1)' }}>
                      <div style={{ position: 'relative', width: 74, height: 44 }}>
                        <div style={{ position: 'absolute', left: 6, top: 8, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '10px solid #ff7a1a' }} />
                        <div style={{ position: 'absolute', left: 60, top: 26, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '10px solid #ff7a1a' }} />
                        <div style={{ position: 'absolute', left: 30, top: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '10px solid #ff7a1a' }} />
                        {[[22, 22], [40, 16], [48, 32], [12, 32]].map(([l, t], j) => (
                          <div key={j} style={{ position: 'absolute', left: l, top: t, width: 9, height: 9, borderRadius: 999, background: gr.bib }} />
                        ))}
                        <div style={{ position: 'absolute', inset: -10, borderRadius: 999, border: '2px solid #eda100', opacity: !s.whistled && i === s.group ? 1 : 0, animation: 'pulse 2s infinite' }} />
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: i === s.group || s.whistled ? '#eda100' : '#b9c8bf', background: 'rgba(5,8,10,.7)', borderRadius: 999, padding: '4px 9px', whiteSpace: 'nowrap' }}>{gr.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* PARENT */}
          {P === 'parent' && (
            <>
              <div style={{ position: 'absolute', inset: 0, animation: 'sceneIn .7s cubic-bezier(.22,1,.36,1) both', background: 'linear-gradient(180deg, #1a1530 0%, #2a1d3c 28%, #3b2440 42%, #0c1a12 58%, #06100a 100%)' }}>
                <div style={{ position: 'absolute', left: 0, right: 0, top: '40%', height: 3, background: 'linear-gradient(90deg, transparent, rgba(255,190,140,.5), transparent)' }} />
                <div style={{ position: 'absolute', left: '-10%', right: '-10%', top: '52%', height: '55%', transform: `perspective(800px) rotateX(64deg) translateX(${pxB.toFixed(1)}px)`, transformOrigin: '50% 0', background: 'repeating-linear-gradient(90deg, #17683c 0 8%, #14593a 8% 16%)', borderTop: '4px solid rgba(255,255,255,.6)', filter: `blur(${s.linkOn ? 0 : 6}px) grayscale(${s.paused ? 1 : 0})`, transition: 'filter .5s, transform .4s ease-out', opacity: s.paused ? 0.35 : 1 }} />
                <div style={{ position: 'absolute', left: '72%', top: '8%', width: 3, height: '44%', background: '#1a1a22' }} />
                <div style={{ position: 'absolute', left: '72%', top: '7%', width: 54, height: 12, marginLeft: -26, borderRadius: 4, background: '#fff5d6', boxShadow: '0 0 60px 30px rgba(255,238,190,.3), 0 0 200px 80px rgba(255,238,190,.1)', animation: 'flicker 6.5s infinite', opacity: s.paused ? 0.25 : 1, transition: 'opacity .5s' }} />
                <div style={{ position: 'absolute', inset: 0, transform: `translate(${pxA.toFixed(1)}px, ${pyA.toFixed(1)}px)`, transition: 'transform .4s ease-out', background: 'repeating-linear-gradient(45deg, rgba(220,225,230,.22) 0 1.5px, transparent 1.5px 30px), repeating-linear-gradient(-45deg, rgba(220,225,230,.22) 0 1.5px, transparent 1.5px 30px)', maskImage: 'linear-gradient(180deg, transparent 0%, #000 14%)', WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 14%)' }} />
                <div style={{ position: 'absolute', left: 0, right: 0, top: '13%', height: 8, background: 'linear-gradient(180deg, #8a9299, #4b5359)', boxShadow: '0 4px 16px rgba(0,0,0,.6)' }} />
                <div style={{ position: 'absolute', left: '10%', top: '13%', width: 8, height: '100%', background: 'linear-gradient(90deg, #6c757c, #3c4348)' }} />
                <div style={{ position: 'absolute', left: '62%', top: '13%', width: 8, height: '100%', background: 'linear-gradient(90deg, #6c757c, #3c4348)' }} />
              </div>
              <div style={sceneWrap}>
                <div style={sceneText}>
                  <div style={{ ...sceneKicker, color: '#c9b3f0' }}>Parents · behind the fence</div>
                  <div style={{ ...sceneH2, textShadow: '0 4px 30px rgba(0,0,0,.5)' }}>You watch from behind the fence. You hold every key.</div>
                  <div style={{ fontSize: 15.5, color: '#d6cde6', fontWeight: 500, lineHeight: 1.6, maxWidth: 440, textWrap: 'pretty' as never, textShadow: '0 2px 12px rgba(0,0,0,.5)' }}>Your son or daughter builds the page and asks. You read it and slide to send. Nothing reaches a club without you — and they get a record of every season that’s theirs at 18, with no feed, messages or leaderboard to disappear into.</div>
                  {!s.approved ? (
                    <div key={s.reqKey} style={{ background: 'rgba(10,8,18,.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 30px 60px -30px rgba(0,0,0,1)', animation: s.reqKey ? 'rise .5s both' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 13, background: '#3ddc84', color: '#06130c', fontWeight: 900, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>9</div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ fontSize: 14.5, fontWeight: 800 }}>Deniz wants to send his page</div>
                          <div style={{ fontSize: 12.5, color: '#b9aecc', fontWeight: 500 }}>to Kingsway Rovers FC · U15 Boys · &quot;Right-footed 10, happy anywhere across the front three.&quot;</div>
                        </div>
                      </div>
                      <div
                        ref={slideRef}
                        // The whole track is the gesture surface — a 46px knob alone
                        // is a miserable touch target, and starting from the track is
                        // what a thumb naturally does.
                        onPointerDown={(e) => {
                          slidingRef.current = true;
                          const r = slideRef.current!.getBoundingClientRect();
                          set({ sliding: true, slide: Math.max(0, Math.min(1, (e.clientX - r.left - 26) / (r.width - 52))) });
                        }}
                        style={{ position: 'relative', height: 54, borderRadius: 999, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', overflow: 'hidden', cursor: 'grab' }}
                      >
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `calc(${(s.slide * 100).toFixed(1)}% + 54px)`, background: 'rgba(164,121,226,.35)', transition: s.sliding ? 'none' : 'all .3s cubic-bezier(.22,1,.36,1)', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#d6cde6', opacity: Math.max(0, 1 - s.slide * 1.6), letterSpacing: '.04em', pointerEvents: 'none' }}>Slide to send it →</div>
                        <div style={{ pointerEvents: 'none', position: 'absolute', top: 3, left: `calc((100% - 52px) * ${s.slide.toFixed(3)} + 3px)`, width: 46, height: 46, borderRadius: 999, background: '#a479e2', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(0,0,0,.5)', transition: s.sliding ? 'none' : 'all .3s cubic-bezier(.22,1,.36,1)' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#120a1e" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12 h14 M13 6 l6 6 -6 6" /></svg>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: '#9a8fb3', fontWeight: 600 }}>A mis-tap can’t send this. Only a slide.</div>
                    </div>
                  ) : (
                    <div style={{ background: 'rgba(10,8,18,.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(61,220,132,.4)', borderRadius: 20, padding: 16, display: 'flex', alignItems: 'center', gap: 12, animation: 'rise .4s both' }}>
                      <div style={{ width: 42, height: 42, borderRadius: 999, background: '#3ddc84', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06130c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 800 }}>Sent. Deniz gets a text.</div>
                        <div style={{ fontSize: 12.5, color: '#b9aecc', fontWeight: 500 }}>The club opens his live page. Take it back any time and the link dies the same minute.</div>
                      </div>
                      <div onClick={() => set({ approved: false, reqKey: s.reqKey + 1 })} style={{ cursor: 'pointer', fontSize: 12, fontWeight: 800, color: '#c9b3f0', whiteSpace: 'nowrap' }}>Next →</div>
                    </div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
                    <div onClick={() => goFormAs('parent')} style={{ cursor: 'pointer', background: '#a479e2', color: '#120a1e', fontWeight: 800, fontSize: 15, borderRadius: 14, padding: '0 22px', height: 50, display: 'flex', alignItems: 'center' }}>Join the waitlist</div>
                  </div>
                </div>
                <div style={{ flex: '1 1 300px', display: 'flex', justifyContent: 'center', animation: 'rise .6s .25s cubic-bezier(.22,1,.36,1) both' }}>
                  <div style={{ width: '100%', maxWidth: 340, background: 'rgba(10,8,18,.78)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 22, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 40px 80px -30px rgba(0,0,0,1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#b9aecc' }}>Your keys</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: s.paused ? '#e34948' : s.linkOn ? '#3ddc84' : '#b9aecc' }}>{s.paused ? 'Paused — nothing goes anywhere' : s.linkOn ? 'Page visible to the clubs you chose' : 'Page dark to every club'}</div>
                    </div>
                    <div onClick={() => set({ linkOn: !s.linkOn })} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: '13px 14px' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={s.linkOn ? '#3ddc84' : '#7d8f85'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="15" r="4" /><path d="M11 12 L20 3" /><path d="M16 7 l3 3" /></svg>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>The page</div>
                        <div style={{ fontSize: 12, color: '#b9aecc', fontWeight: 500 }}>{s.linkOn ? 'Link is on. Switch it off and it dies the same minute.' : 'Link is off. Every copy anyone had stopped working.'}</div>
                      </div>
                      <div style={{ width: 44, height: 26, borderRadius: 999, background: s.linkOn ? '#3ddc84' : 'rgba(255,255,255,.14)', position: 'relative', transition: 'background .25s' }}>
                        <div style={{ position: 'absolute', top: 3, left: s.linkOn ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: '#fff', transition: 'left .25s' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: '13px 14px', opacity: 0.85 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a479e2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="15" r="4" /><path d="M11 12 L20 3" /><path d="M16 7 l3 3" /></svg>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>Every send</div>
                        <div style={{ fontSize: 12, color: '#b9aecc', fontWeight: 500 }}>Under 16, this one stays on the ring.</div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a479e2" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11 V8 a4 4 0 0 1 8 0 v3" /></svg>
                    </div>
                    <div
                      onPointerDown={() => { if (!s.paused) hold(true, () => setS((prev) => ({ ...prev, paused: true, pauseP: 0 }))); }}
                      onPointerUp={() => { if (!s.paused) hold(false); }}
                      onPointerLeave={() => { if (!s.paused) hold(false); }}
                      onPointerCancel={() => { if (!s.paused) hold(false); }}
                      onClick={() => { if (s.paused) set({ paused: false }); }}
                      style={{ cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'pan-y', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,.05)', border: `1px solid ${s.paused ? '#e34948' : 'rgba(255,255,255,.08)'}`, borderRadius: 16, padding: '13px 14px', transition: 'border-color .3s' }}
                    >
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${s.paused ? 100 : s.pauseP * 100}%`, background: 'rgba(227,73,72,.35)', transition: 'width .08s linear' }} />
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={s.paused ? '#e34948' : '#b9aecc'} strokeWidth="2.2" strokeLinecap="round" style={{ position: 'relative' }}><path d="M9 6 v12" /><path d="M15 6 v12" /></svg>
                      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>{s.paused ? 'Everything paused' : 'Pause everything'}</div>
                        <div style={{ fontSize: 12, color: '#b9aecc', fontWeight: 500 }}>{s.paused ? 'Tap to pick it back up. Nothing was lost.' : 'Hold for a second. Every link, every send, stopped.'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ground plan — absolute overlay on desktop, in-flow on mobile so it
              never covers the scene content (BUZ, 3 Sep) */}
          <div className="ground-plan">
            <div ref={planRef} style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(7,11,9,.82)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 18, padding: '8px 14px 8px 10px', boxShadow: '0 30px 60px -20px rgba(0,0,0,.9)' }}>
              <svg width="120" height="66" viewBox="0 0 200 110">
                <rect x="50" y="20" width="100" height="70" rx="2" fill="#0f3a24" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" />
                <line x1="100" y1="20" x2="100" y2="90" stroke="rgba(255,255,255,.4)" strokeWidth="1.2" />
                <circle cx="100" cy="55" r="9" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="1.2" />
                <g onClick={() => pick('player', { anchor: planRef.current })} style={{ cursor: 'pointer' }}><rect x="52" y="22" width="96" height="66" fill={P === 'player' ? 'rgba(61,220,132,.3)' : 'transparent'} /></g>
                <g onClick={() => pick('coach', { anchor: planRef.current })} style={{ cursor: 'pointer' }}><rect x="34" y="30" width="12" height="50" rx="2" fill={P === 'coach' ? 'rgba(217,89,38,.6)' : '#182420'} stroke="rgba(255,255,255,.35)" strokeWidth="1.2" /></g>
                <g onClick={() => pick('club', { anchor: planRef.current })} style={{ cursor: 'pointer' }}><rect x="158" y="14" width="30" height="82" rx="4" fill={P === 'club' ? 'rgba(237,161,0,.5)' : '#182420'} stroke="rgba(255,255,255,.35)" strokeWidth="1.2" /></g>
                <g onClick={() => pick('parent', { anchor: planRef.current })} style={{ cursor: 'pointer' }}><rect x="50" y="4" width="100" height="10" rx="1" fill={P === 'parent' ? 'rgba(164,121,226,.6)' : '#182420'} stroke="rgba(255,255,255,.35)" strokeWidth="1.2" strokeDasharray="3 3" /></g>
                <circle cx={DOT[P][0]} cy={DOT[P][1]} r="5" fill={accent} style={{ transition: 'cx .5s cubic-bezier(.22,1,.36,1), cy .5s cubic-bezier(.22,1,.36,1), fill .4s' }} />
                <circle cx={DOT[P][0]} cy={DOT[P][1]} r="9" fill="none" stroke={accent} strokeWidth="1.5" style={{ transition: 'cx .5s cubic-bezier(.22,1,.36,1), cy .5s cubic-bezier(.22,1,.36,1), stroke .4s', animation: 'pulse 2s infinite', transformBox: 'fill-box', transformOrigin: 'center' }} />
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: '#7d8f85' }}>You&apos;re standing</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: accent }}>{SEATS.find((x) => x[0] === P)![1]}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                <div className="iconbtn" onClick={() => step(-1, planRef.current)} style={{ cursor: 'pointer', width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#eef5f0" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5 L8 12 l7 7" /></svg>
                </div>
                <div className="iconbtn" onClick={() => step(1, planRef.current)} style={{ cursor: 'pointer', width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#eef5f0" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5 l7 7 -7 7" /></svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== WHAT IT COSTS ===== */}
      {SHOW_PRICING && (
      <div ref={priceRef} data-reveal="1" style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 24px 80px 24px', display: 'flex', flexDirection: 'column', gap: 28, ...reveal }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
          <div style={{ ...kicker, color: accent, transition: 'color .4s' }}>{PRICE[P][0]}</div>
          <div style={{ fontSize: 'clamp(34px, 4.6vw, 56px)', fontWeight: 900, letterSpacing: '-.035em', lineHeight: 1 }}>What it costs.</div>
          <div style={{ fontSize: 15, color: '#b9c8bf', fontWeight: 500, maxWidth: 520, lineHeight: 1.55, textWrap: 'pretty' as never }}>{PRICE[P][1]}</div>
          {seatChips(true)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'linear-gradient(90deg, rgba(61,220,132,.12), rgba(61,220,132,.04))', border: '1px solid rgba(61,220,132,.3)', borderRadius: 16, padding: '14px 18px' }}>
          <Check color="#3ddc84" size={18} />
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#eef5f0' }}>Under 18 is always free. <span style={{ color: '#7d8f85', fontWeight: 600 }}>No paid tier exists on a child&apos;s account, ever.</span></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {tiers.map((t) => (
            <div key={`${P}-${t.name}`} style={{ position: 'relative', overflow: 'hidden', background: t.bg, border: t.bd, borderRadius: 24, padding: 26, display: 'flex', flexDirection: 'column', gap: 14, animation: 'rise .5s both' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: t.c }}>{t.name}</div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: t.badgeFg, background: t.badgeBg, borderRadius: 999, padding: '4px 9px' }}>{t.badge}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-.04em', lineHeight: 1 }}>{t.price}</div>
                <div style={{ fontSize: 13, color: '#b9c8bf', fontWeight: 700 }}>{t.per}</div>
              </div>
              <div style={{ fontSize: 14, color: '#b9c8bf', fontWeight: 500, lineHeight: 1.6, textWrap: 'pretty' as never }}>{t.desc}</div>
              <div style={{ marginTop: 'auto', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7d8f85', paddingBottom: 2 }}>{t.itemsLabel}</div>
                {t.items.map((it) => (
                  <div key={it} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#c8d6cd', fontWeight: 600, lineHeight: 1.45 }}>
                    <span style={{ marginTop: 3, display: 'inline-flex' }}><Check color={t.c} /></span>{it}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* ===== WAITLIST ===== */}
      <div ref={formRef} style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 60px 24px', boxSizing: 'border-box' }}>
        <div data-reveal="1" style={{ position: 'relative', overflow: 'hidden', borderRadius: 32, background: 'linear-gradient(160deg, #10201a 0%, #0b1410 60%, #080d0a 100%)', border: '1px solid #1c2822', padding: 'clamp(28px, 4vw, 56px)', display: 'flex', flexWrap: 'wrap', gap: 36, alignItems: 'center', ...reveal }}>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(60% 70% at 100% 0%, ${accentGlow} 0%, transparent 65%)`, pointerEvents: 'none', transition: 'background .5s' }} />
          <div style={{ position: 'relative', flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: accent }}>The waitlist</div>
            <div style={{ fontSize: 'clamp(30px, 3.8vw, 46px)', fontWeight: 900, lineHeight: 1.02, letterSpacing: '-.03em', textWrap: 'pretty' as never }}>Be there when the whistle goes.</div>
            <div style={{ fontSize: 14.5, color: '#b9c8bf', fontWeight: 500, lineHeight: 1.6, maxWidth: 440, textWrap: 'pretty' as never }}>One email when Pitch opens — nothing in between. No countdown, no spots left. Australia first.</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(164,121,226,.1)', border: '1px solid rgba(164,121,226,.3)', borderRadius: 14, padding: '12px 14px', maxWidth: 440 }}>
              <div style={{ width: 6, height: 6, borderRadius: 999, background: '#a479e2', flexShrink: 0, marginTop: 6 }} />
              <div style={{ fontSize: 13, color: '#d6cde6', fontWeight: 600, lineHeight: 1.5, textWrap: 'pretty' as never }}>Under 18? Ask a parent to add their email instead. <span style={{ color: '#eef5f0' }}>We never take a child&apos;s details before there is a parent to ask.</span></div>
            </div>
          </div>
          {!s.submitted ? (
            <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={microLabel}>I&apos;m here as</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {SEATS.map(([k]) => (
                    <div key={k} onClick={() => set({ role: k, tried: false })} style={{ cursor: 'pointer', borderRadius: 12, padding: '11px 6px', textAlign: 'center', fontSize: 12.5, fontWeight: 800, transition: 'all .2s', ...chipStyle(s.role === k, ACC[k]) }}>
                      {k === 'parent' ? 'Parent' : k[0].toUpperCase() + k.slice(1)}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={microLabel}>Email · 18 and over</div>
                <input
                  value={s.email}
                  onChange={(e) => set({ email: e.target.value, tried: false, serverNote: null })}
                  onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                  placeholder="you@example.com.au"
                  type="email"
                  aria-label="Email, 18 and over"
                  style={{ boxSizing: 'border-box', width: '100%', height: 52, borderRadius: 14, background: '#0a110d', border: `1px solid ${s.tried && !emailOk ? '#e34948' : '#24322a'}`, color: '#eef5f0', fontSize: 15, fontWeight: 600, padding: '0 16px' }}
                />
              </div>
              <div onClick={submit} style={{ cursor: 'pointer', height: 54, borderRadius: 14, background: emailOk ? accent : 'rgba(255,255,255,.08)', color: emailOk ? '#06130c' : '#7d8f85', fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .25s' }}>
                {s.submitting ? 'Joining…' : 'Join the waitlist'}
              </div>
              <div style={{ fontSize: 12, color: s.tried && !emailOk ? '#e34948' : s.serverNote ? '#e34948' : '#7d8f85', fontWeight: 500, lineHeight: 1.5 }}>
                {s.tried && !emailOk ? 'Check the email address.' : s.serverNote ?? CONSENT_TEXT}
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 14, animation: 'rise .5s both' }}>
              <div style={{ width: 54, height: 54, borderRadius: 999, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#06130c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 l4.5 4.5 L19 7" /></svg>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.02em', lineHeight: 1.1 }}>You&apos;re on the list.</div>
              <div style={{ fontSize: 14.5, color: '#b9c8bf', fontWeight: 500, lineHeight: 1.6 }}>We&apos;ll email you once, when it opens. Nothing else until then.</div>
              <div style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#7d8f85' }}>What we hold</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 13.5, fontWeight: 700 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email}</div>
                  <div style={{ borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 800, background: accentGlow, color: accent, flexShrink: 0 }}>{s.role === 'parent' ? 'Parent' : s.role[0].toUpperCase() + s.role.slice(1)}</div>
                </div>
                <div style={{ fontSize: 12, color: '#7d8f85', fontWeight: 600 }}>That&apos;s the whole record. No name, no phone, no club.</div>
              </div>
              <div style={{ fontSize: 13, color: '#c8d6cd', fontWeight: 600, lineHeight: 1.55, textWrap: 'pretty' as never }}>Being on this list isn&apos;t an account and doesn&apos;t hold a place. When we open, you sign up yourself — and a child&apos;s page waits for a parent&apos;s yes.</div>
              <div style={{ display: 'flex', gap: 14, fontSize: 12.5, fontWeight: 700 }}>
                <div onClick={() => set({ submitted: false, email: '' })} style={{ cursor: 'pointer', color: accent }}>Add another</div>
                <div onClick={() => set({ submitted: false, email: '' })} style={{ cursor: 'pointer', color: '#7d8f85' }}>Not you? Remove it</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== FAQ (drafted 3 Sep on BUZ's request) ===== */}
      <div data-reveal="1" style={{ maxWidth: 760, margin: '0 auto', padding: '30px 24px 80px 24px', display: 'flex', flexDirection: 'column', gap: 18, ...reveal }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
          <div style={{ ...kicker, color: '#3ddc84' }}>Before you ask</div>
          <div style={{ fontSize: 'clamp(30px, 3.8vw, 44px)', fontWeight: 900, letterSpacing: '-.03em', lineHeight: 1 }}>Questions.</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FAQ.map(([q, a], i) => {
            const open = s.faq === i;
            return (
              <div key={i} onClick={() => set({ faq: open ? -1 : i })} style={{ cursor: 'pointer', background: open ? '#0d1411' : 'transparent', border: `1px solid ${open ? '#1c2822' : 'rgba(255,255,255,.08)'}`, borderRadius: 16, padding: '16px 18px', transition: 'all .25s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 900, color: open ? '#eef5f0' : '#b9c8bf', letterSpacing: '-.015em' }}>{q}</div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={open ? '#3ddc84' : '#7d8f85'} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .25s' }}><path d="M6 9 l6 6 6-6" /></svg>
                </div>
                <div style={{ fontSize: 14, color: '#b9c8bf', fontWeight: 500, lineHeight: 1.6, maxHeight: open ? 240 : 0, opacity: open ? 1 : 0, overflow: 'hidden', transition: 'all .3s', paddingTop: open ? 8 : 0, textWrap: 'pretty' as never }}>{a}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== footer ===== */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 48px 24px', boxSizing: 'border-box', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 12, color: '#6b7d73', fontWeight: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <Wordmark size={22} />
            <div style={{ fontSize: 6.6, fontWeight: 800, letterSpacing: '.42em', color: '#3ddc84', paddingLeft: 2 }}>FOOTBALL</div>
          </div>
          <div>pitchfootball.com.au</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
          <div>Football, not soccer. Australia first, then everywhere the game is played.</div>
          {/* Doc 29 §7: the footer links the privacy policy and terms. */}
          <div style={{ display: 'flex', gap: 10 }}>
            <a href="/privacy" style={{ color: '#6b7d73' }}>Privacy</a>
            <a href="/terms" style={{ color: '#6b7d73' }}>Terms</a>
          </div>
        </div>
      </div>
    </div>
  );
}
