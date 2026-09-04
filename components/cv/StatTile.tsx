'use client';
// A stat tile that counts up to its value on load — the number arrives like
// a scoreboard, then settles. Reduced-motion renders the final value flat.
import { useEffect, useRef, useState } from 'react';

export default function StatTile({ value, label, accent, delay = 0 }: {
  value: number; label: string; accent: boolean; delay?: number;
}) {
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value); setDone(true); return;
    }
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
      <div className={done ? 'settle' : undefined} style={{ fontSize: 21, fontWeight: 900, letterSpacing: '-0.04em', color: accent ? '#3ddc84' : '#eef5f0' }}>{shown}</div>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,.72)', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}
