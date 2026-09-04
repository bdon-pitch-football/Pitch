// The OG card for a shared CV (D-76, D-89) — v2 after BUZ rejected the flat
// first pass. The card is a night-match moment: the pitch drawn faintly
// across the whole frame, the squad number as a stadium-scale watermark,
// the name in display weight, positions as chips, stats as lit tiles.
// Safety rules unchanged: first name + surname initial, positions, number,
// chosen stats — never a club, age or region. Token re-checked per request;
// every dead state gets the one generic card.
import { ImageResponse } from 'next/og';
import { readCvByToken } from '@/lib/record-read';
import { POSITIONS, STAT_LABELS, type PositionCode, type StatKey } from '@/lib/football';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const POS_XY: Record<string, [number, number]> = {
  GK: [8, 50], CB: [24, 50], LB: [26, 16], RB: [26, 84], DM: [40, 50],
  CM: [54, 50], CAM: [68, 50], LW: [74, 16], RW: [74, 84], ST: [90, 50],
};

const Pitch = ({ dots }: { dots: string[] }) => (
  <svg
    viewBox="0 0 100 62"
    width="560"
    height="347"
    style={{ position: 'absolute', right: -60, bottom: -40, opacity: 0.55 }}
  >
    <rect x="1" y="1" width="98" height="60" rx="4" fill="none" stroke="rgba(61,220,132,.18)" strokeWidth="1" />
    <line x1="50" y1="1" x2="50" y2="61" stroke="rgba(61,220,132,.18)" strokeWidth="1" />
    <circle cx="50" cy="31" r="9" fill="none" stroke="rgba(61,220,132,.18)" strokeWidth="1" />
    <rect x="1" y="17" width="14" height="28" fill="none" stroke="rgba(61,220,132,.14)" strokeWidth="1" />
    <rect x="85" y="17" width="14" height="28" fill="none" stroke="rgba(61,220,132,.14)" strokeWidth="1" />
    {dots.map((code, i) => {
      const [x, y] = POS_XY[code] ?? [50, 50];
      return <circle key={code} cx={x} cy={y * 0.62} r={i === 0 ? 3.4 : 2.4} fill={i === 0 ? '#3ddc84' : 'rgba(61,220,132,.5)'} />;
    })}
  </svg>
);

const Mark = (
  <div style={{ display: 'flex', alignItems: 'center', fontSize: 40, fontWeight: 900, letterSpacing: '-1.5px', color: '#eef5f0' }}>
    P
    <svg viewBox="0 0 74 97" width="24" height="31" style={{ margin: '0 -2px' }}>
      <line x1="37" y1="6.5" x2="37" y2="90.5" stroke="#3ddc84" strokeWidth="13" strokeLinecap="round" />
      <circle cx="37" cy="48.5" r="32" fill="none" stroke="#3ddc84" strokeWidth="10" />
    </svg>
    TCH
  </div>
);

export default async function OgImage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cv = await readCvByToken(token).catch(() => null);

  if (!cv) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, background: 'linear-gradient(160deg, #123326 0%, #0c1d14 60%, #0a1510 100%)' }}>
          <Pitch dots={[]} />
          {Mark}
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: '#b9c8bf' }}>Every season on the record.</div>
        </div>
      ),
      size,
    );
  }

  const name = `${cv.firstName} ${cv.lastName ? `${cv.lastName[0]}.` : ''}`.trim();
  const positions = cv.positions as PositionCode[];
  const tiles = (cv.surfacedStats as StatKey[])
    .map((key) => ({ key, value: cv.stats.find((s) => s.key === key && s.value > 0)?.value }))
    .filter((t): t is { key: StatKey; value: number } => typeof t.value === 'number')
    .slice(0, 3);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: 'linear-gradient(160deg, #123326 0%, #0c1d14 55%, #0a1510 100%)', overflow: 'hidden' }}>
        <Pitch dots={positions} />
        {cv.squadNumber ? (
          <div style={{ display: 'flex', position: 'absolute', right: 24, top: -110, fontSize: 460, fontWeight: 900, letterSpacing: '-24px', color: 'rgba(61,220,132,.09)', lineHeight: 1 }}>{String(cv.squadNumber)}</div>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '56px 64px', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {Mark}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1.5px solid rgba(255,255,255,.22)', borderRadius: 999, padding: '8px 22px', fontSize: 22, fontWeight: 800, letterSpacing: '2px', color: 'rgba(255,255,255,.7)' }}>SEASON 2026</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
              <div style={{ display: 'flex', fontSize: 96, fontWeight: 900, color: '#eef5f0', letterSpacing: '-4px', lineHeight: 1 }}>{name}</div>
              {cv.squadNumber ? <div style={{ display: 'flex', fontSize: 60, fontWeight: 900, color: '#3ddc84', letterSpacing: '-2px' }}>#{cv.squadNumber}</div> : null}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {positions.map((c, i) => (
                <div key={c} style={{ display: 'flex', borderRadius: 999, padding: '10px 26px', fontSize: 26, fontWeight: 800, background: i === 0 ? '#3ddc84' : 'rgba(61,220,132,.14)', color: i === 0 ? '#06130c' : '#3ddc84' }}>{POSITIONS[c]?.label ?? c}</div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 18 }}>
              {tiles.map((t, i) => (
                <div key={t.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'rgba(7,11,9,.55)', border: i === 1 ? '2px solid rgba(61,220,132,.55)' : '1.5px solid rgba(255,255,255,.14)', borderRadius: 22, padding: '20px 38px', boxShadow: i === 1 ? '0 0 44px rgba(61,220,132,.18)' : 'none' }}>
                  <div style={{ display: 'flex', fontSize: 58, fontWeight: 900, color: t.key === 'goals' || t.key === 'clean_sheets' ? '#3ddc84' : '#eef5f0', letterSpacing: '-2px' }}>{String(t.value)}</div>
                  <div style={{ display: 'flex', fontSize: 19, fontWeight: 800, color: 'rgba(255,255,255,.65)', textTransform: 'uppercase', letterSpacing: '3px' }}>{STAT_LABELS[t.key]}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', fontSize: 21, fontWeight: 700, color: '#7d8f85' }}>Self-reported · pitchfootball.com.au</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
