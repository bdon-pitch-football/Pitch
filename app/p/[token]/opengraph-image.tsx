// The OG card for a shared CV (D-76, D-89). Platforms cache these more or
// less forever, so the card carries pride and never locator data: first
// name + surname initial, positions, number, chosen stats — no club, no
// age, no region, for everyone (the most restrictive rule is the default).
// The token is re-checked on every request; any non-live token gets the
// generic Pitch card, never an identity (D-94 §5).
import { ImageResponse } from 'next/og';
import { readCvByToken } from '@/lib/record-read';
import { POSITIONS, STAT_LABELS, type PositionCode, type StatKey } from '@/lib/football';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cv = await readCvByToken(token).catch(() => null);

  const Mark = (
    <div style={{ display: 'flex', alignItems: 'center', fontSize: 44, fontWeight: 900, letterSpacing: '-2px', color: '#eef5f0' }}>
      P
      <svg viewBox="0 0 74 97" width="26" height="34" style={{ margin: '0 -2px' }}>
        <line x1="37" y1="6.5" x2="37" y2="90.5" stroke="#3ddc84" strokeWidth="13" strokeLinecap="round" />
        <circle cx="37" cy="48.5" r="32" fill="none" stroke="#3ddc84" strokeWidth="10" />
      </svg>
      TCH
    </div>
  );

  if (!cv) {
    // generic card — identical for every non-live state
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, background: 'linear-gradient(160deg, #123326 0%, #0c1d14 60%, #0a1510 100%)' }}>
          {Mark}
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: '#b9c8bf' }}>Every season on the record.</div>
        </div>
      ),
      size,
    );
  }

  const name = `${cv.firstName} ${cv.lastName ? `${cv.lastName[0]}.` : ''}`.trim();
  const posLine = (cv.positions as PositionCode[]).map((c) => POSITIONS[c]?.label ?? c).join(' · ');
  const tiles = (cv.surfacedStats as StatKey[])
    .map((key) => ({ key, value: cv.stats.find((s) => s.key === key && s.value > 0)?.value }))
    .filter((t): t is { key: StatKey; value: number } => typeof t.value === 'number')
    .slice(0, 3);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 64, background: 'linear-gradient(160deg, #123326 0%, #0c1d14 60%, #0a1510 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', fontSize: 76, fontWeight: 900, color: '#eef5f0', letterSpacing: '-2px' }}>{cv.squadNumber ? `${name}  ·  #${cv.squadNumber}` : name}</div>
            <div style={{ display: 'flex', fontSize: 34, fontWeight: 500, color: 'rgba(255,255,255,0.75)' }}>{posLine}</div>
          </div>
          {Mark}
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {tiles.map((t) => (
            <div key={t.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 24, padding: '28px 44px' }}>
              <div style={{ display: 'flex', fontSize: 64, fontWeight: 900, color: t.key === 'goals' || t.key === 'clean_sheets' ? '#3ddc84' : '#eef5f0' }}>{t.value}</div>
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase', letterSpacing: '2px' }}>{STAT_LABELS[t.key]}</div>
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', marginLeft: 'auto', fontSize: 24, fontWeight: 700, color: '#7d8f85' }}>Self-reported · pitchfootball.com.au</div>
        </div>
      </div>
    ),
    size,
  );
}
