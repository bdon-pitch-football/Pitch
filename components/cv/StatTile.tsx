// A stat tile. The number is the real number from the first byte of HTML to
// the last frame, and it never passes through any other value (D-162).
//
// It used to count up from zero: first the tile started at 0 in the HTML,
// then (22 Sep) at the real value in the HTML with a layout effect that reset
// it to 0 and counted back up. BUZ's walkthrough (29 Sep, brief H) still saw
// "0 appearances" on a child's CV for a moment, and every frame of a count-up
// is a number that is not true — "3 goals" on the way to 16 is as false as 0.
// So the animation is decoration only: the tile rises with the block and the
// number settles into place (a scale, globals.css .settle), always showing
// its own value. Under prefers-reduced-motion neither moves. No JavaScript at
// all, so a stalled bundle, scripting off and a crawler all read the same
// number a person does.
import { T } from '@/lib/palette';

// `source` is the D-62 tag for THIS number, and it is passed only when the
// block cannot caption itself — when the numbers beside it came from somewhere
// else. While every stat in the record shares one source the block says it
// once, exactly as before, and nothing is drawn here.
export default function StatTile({ value, label, accent, delay = 0, source }: {
  value: number; label: string; accent: boolean; delay?: number; source?: string;
}) {
  return (
    <div className="cv-rise" style={{ animationDelay: `${0.28 + delay}s`, background: 'rgba(255,255,255,.08)', borderRadius: 12, padding: '10px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div className="settle" style={{ animationDelay: `${0.28 + delay}s`, fontSize: 21, fontWeight: 900, letterSpacing: '-0.04em', color: accent ? T.accent : T.ink }}>{value}</div>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,.72)', textTransform: 'uppercase' }}>{label}</div>
      {/* 9px/800 at .72 white, the same values as the block chip and the tile's
          own label: .55 measured 4.51:1 on the hero after the 28 Sep surface
          stack, which is a pass by 0.01 and not a margin to ship. */}
      {source && (
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', color: 'rgba(255,255,255,.72)', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.3 }}>{source}</div>
      )}
    </div>
  );
}
