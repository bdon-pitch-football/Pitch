// The printable CV (D-121) — free on every tier, for players and coaches,
// and never drawn as a paid feature. A technical director prints these for
// trial day, and a dark page drinks ink, so this is the one light surface in
// the product (the charter's planned print stylesheet).
//
// It reads through the SAME single tokenised path as the screen version, so
// a paused, expired or revoked link prints nothing.
import { notFound } from 'next/navigation';
import { readCvByToken } from '@/lib/record-read';
import { POSITIONS, STAT_LABELS, type PositionCode, type StatKey } from '@/lib/football';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function PrintCv({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cv = await readCvByToken(token);
  if (!cv) notFound();

  const stats = cv.stats.filter((s) => s.value > 0);
  const tiles = (cv.surfacedStats as StatKey[])
    .map((k) => ({ key: k, value: stats.find((s) => s.key === k)?.value }))
    .filter((t): t is { key: StatKey; value: number } => typeof t.value === 'number');

  return (
    <div style={{ background: '#ffffff', color: '#0b120e', minHeight: '100dvh', padding: '32px 28px', fontFamily: 'inherit' }}>
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 14mm; } }`}</style>
      <PrintButton />
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0b120e', paddingBottom: 14 }}>
          <div>
            <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-0.02em' }}>{cv.firstName} {cv.lastName}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#3f5145', marginTop: 4 }}>
              {cv.positions.map((c) => POSITIONS[c as PositionCode]?.label ?? c).join(' · ')}
              {cv.squadNumber ? ` · #${cv.squadNumber}` : ''}{cv.foot ? ` · ${cv.foot} footed` : ''}
            </div>
            {cv.club && <div style={{ fontSize: 13, color: '#5b6b60', marginTop: 2 }}>{cv.club}{cv.squad?.name ? ` — ${cv.squad.name}` : ''}</div>}
          </div>
          <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.08em' }}>PITCH</div>
        </div>

        {tiles.length > 0 && (
          <div style={{ display: 'flex', gap: 34, marginTop: 20 }}>
            {tiles.map((t) => (
              <div key={t.key}>
                <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1 }}>{t.value}</div>
                <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#5b6b60', marginTop: 3 }}>{STAT_LABELS[t.key]}</div>
              </div>
            ))}
            <div style={{ marginLeft: 'auto', alignSelf: 'flex-end', fontSize: 10.5, color: '#5b6b60', fontWeight: 700 }}>Self-reported</div>
          </div>
        )}

        {cv.about && (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#5b6b60' }}>About</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 5 }}>{cv.about}</div>
          </div>
        )}

        {cv.achievements.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#5b6b60' }}>Achievements</div>
            {cv.achievements.map((a) => (
              <div key={a.title} style={{ fontSize: 13, marginTop: 5 }}>
                <b>{a.title}</b>{a.detail ? ` — ${a.detail}` : ''}
              </div>
            ))}
          </div>
        )}

        {cv.otherFootball.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#5b6b60' }}>Other football</div>
            {cv.otherFootball.map((e) => (
              <div key={e.orgName} style={{ fontSize: 13, marginTop: 5 }}>
                <b>{e.orgName}</b>{e.period ? ` — ${e.period}` : ''}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 26, paddingTop: 12, borderTop: '1px solid #d7ded9', fontSize: 10.5, color: '#5b6b60' }}>
          pitchfootball.com.au · this page is a live link and the family can switch it off at any time
        </div>
      </div>
    </div>
  );
}
