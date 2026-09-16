'use client';
// A stat tile that counts up to its value on load — the number arrives like
// a scoreboard, then settles. Reduced-motion renders the final value flat.
//
// It STARTS at the real value, not at zero, and that is the whole point of
// the layout effect below. The tile used to initialise to 0, so the number
// in the server-rendered HTML was 0 — which is what a phone with a stalled
// bundle, a browser with scripting off, and anything reading the markup
// rather than the paint all saw. "16 goals" reading as "0 goals" on a CV is
// worse than no animation, and D-70 exists precisely so a zero never appears
// on this page.
//
// So the truth ships in the HTML, and the animation resets it to zero in a
// layout effect — before paint, so nobody sees the flash — and counts back
// up. No JavaScript, no animation, correct number.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { T } from '@/lib/palette';

// useLayoutEffect warns when React renders this on the server; useEffect is
// the correct no-op there, because there is no paint to be ahead of.
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export default function StatTile({ value, label, accent, delay = 0 }: {
  value: number; label: string; accent: boolean; delay?: number;
}) {
  const [shown, setShown] = useState(value);
  const [done, setDone] = useState(false);
  const raf = useRef<number>(0);

  useBeforePaint(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value); setDone(true); return;
    }
    setShown(0);
    const start = performance.now() + delay * 1000;
    const dur = 700;
    const tick = (t: number) => {
      if (t < start) { raf.current = requestAnimationFrame(tick); return; }
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(eased * value));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setDone(true);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, delay]);

  return (
    <div className="cv-rise" style={{ animationDelay: `${0.28 + delay}s`, background: 'rgba(255,255,255,.08)', borderRadius: 12, padding: '10px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div className={done ? 'settle' : undefined} style={{ fontSize: 21, fontWeight: 900, letterSpacing: '-0.04em', color: accent ? T.accent : T.ink }}>{shown}</div>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,.72)', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}
