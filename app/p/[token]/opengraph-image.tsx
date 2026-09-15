// The OG card for a shared CV — v3. Night match under lights: floodlight
// falls from the top, the squad number stands stadium-tall off the right
// edge behind the centre-circle arc, the name carries the frame in Archivo
// 900, and the stats run as one editorial line — no boxes. Safety rules
// unchanged (D-89): first name + surname initial, positions, number, chosen
// stats. Never a club, an age or a region. Token re-checked every request;
// all dead states share one generic card.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { readCvByToken } from '@/lib/record-read';
import { POSITIONS, STAT_LABELS, type PositionCode, type StatKey } from '@/lib/football';

// D-94 §5: the card endpoint OUTLIVES revocation in every platform's cache,
// so it must re-check the token on every request and must never be served
// from ours. Without this, Next may cache the route and a revoked link keeps
// unfurling a child's card — the exact failure the re-check exists to stop.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const font = (w: number) => readFileSync(join(process.cwd(), 'assets/fonts', `Archivo-${w}.ttf`));
const FONTS = [
  { name: 'Archivo', data: font(500), weight: 500 as const },
  { name: 'Archivo', data: font(700), weight: 700 as const },
  { name: 'Archivo', data: font(900), weight: 900 as const },
];

const BG = 'radial-gradient(ellipse 90% 70% at 50% -10%, #1a4a34 0%, #123326 34%, #0c1d14 68%, #0a1510 100%)';

const Mark = ({ dim }: { dim?: boolean }) => (
  <div style={{ display: 'flex', alignItems: 'center', fontSize: 38, fontWeight: 900, letterSpacing: '-1.5px', color: dim ? '#b9c8bf' : '#eef5f0' }}>
    P
    <svg viewBox="0 0 74 97" width="23" height="30" style={{ margin: '0 -1px' }}>
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
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, background: BG }}>
          <Mark />
          <div style={{ display: 'flex', fontSize: 32, fontWeight: 700, color: '#b9c8bf' }}>Every season on the record.</div>
        </div>
      ),
      { ...size, fonts: FONTS },
    );
  }

  const positions = cv.positions as PositionCode[];

  // D-89 / doc 14 E12-E13: the card is band-aware. An UNDER-18 carries first
  // name + surname INITIAL and nothing that locates them — no full surname,
  // no club, no age group, no region. An adult carries full detail.
  //
  // The band comes from the read path, which derives it in Postgres on every
  // read and never stores it (doc 14 §J1). It used to be recomputed here from
  // cv.dob — a SECOND implementation of the band rule, which is exactly what
  // the single-read-path discipline exists to prevent, and it was broken:
  // assembleCv never returns a DOB, so `born` was always null, every player
  // fell to the restrictive default, and the 18+ branch had never once run.
  // A 22-year-old's card read "Jordan A." Absent band still means minor.
  const isAdult = cv.band === '18plus';
  const tiles = (cv.surfacedStats as StatKey[])
    .map((key) => ({ key, value: cv.stats.find((s) => s.key === key && s.value > 0)?.value }))
    .filter((t): t is { key: StatKey; value: number } => typeof t.value === 'number')
    .slice(0, 3);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: BG, overflow: 'hidden', fontFamily: 'Archivo' }}>
        {/* centre-circle arc, sliced by the right edge */}
        <svg width="820" height="820" viewBox="0 0 820 820" style={{ position: 'absolute', right: -410, top: -95 }}>
          <circle cx="410" cy="410" r="300" fill="none" stroke="rgba(61,220,132,.13)" strokeWidth="2.5" />
          <circle cx="410" cy="410" r="404" fill="none" stroke="rgba(61,220,132,.07)" strokeWidth="2.5" />
        </svg>
        {/* the number, stadium-tall, cropped */}
        {cv.squadNumber ? (
          <div style={{ display: 'flex', position: 'absolute', right: -30, top: -140, fontSize: 620, fontWeight: 900, letterSpacing: '-30px', color: 'rgba(61,220,132,.10)', lineHeight: 1 }}>{String(cv.squadNumber)}</div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', padding: '54px 64px 48px 64px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontSize: 21, fontWeight: 800, letterSpacing: '7px', color: '#3ddc84' }}>PLAYER CV · SEASON 2026</div>
            <Mark />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 26 }}>
                <div style={{ display: 'flex', fontSize: 124, fontWeight: 900, color: '#eef5f0', letterSpacing: '-6px', lineHeight: 0.95 }}>{cv.firstName}</div>
                <div style={{ display: 'flex', fontSize: 124, fontWeight: 900, color: 'rgba(238,245,240,.35)', letterSpacing: '-6px', lineHeight: 0.95 }}>{cv.lastName ? (isAdult ? cv.lastName : `${cv.lastName[0]}.`) : ''}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 22 }}>
                {cv.squadNumber ? (
                  <div style={{ display: 'flex', fontSize: 30, fontWeight: 900, color: '#06130c', background: '#3ddc84', borderRadius: 12, padding: '6px 18px' }}>#{cv.squadNumber}</div>
                ) : null}
                <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: '#b9c8bf' }}>{positions.join('   ·   ')}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', width: 430, height: 2, background: 'linear-gradient(90deg, rgba(61,220,132,.7), rgba(61,220,132,0))' }} />
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 52 }}>
                  {tiles.map((t) => (
                    <div key={t.key} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      <div style={{ display: 'flex', fontSize: 74, fontWeight: 900, letterSpacing: '-3px', lineHeight: 1, color: t.key === 'goals' || t.key === 'clean_sheets' ? '#3ddc84' : '#eef5f0' }}>{String(t.value)}</div>
                      <div style={{ display: 'flex', fontSize: 19, fontWeight: 700, color: '#7d8f85', textTransform: 'uppercase', letterSpacing: '3.5px', marginTop: 6 }}>{STAT_LABELS[t.key]}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', fontSize: 19, fontWeight: 500, color: '#7d8f85' }}>Self-reported · pitchfootball.com.au</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: FONTS },
  );
}
