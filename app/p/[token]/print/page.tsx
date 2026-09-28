// The printable CV (D-121) — free on every tier, for players and coaches,
// and never drawn as a paid feature. A technical director prints these for
// trial day, and a dark page drinks ink, so this is the one light surface in
// the product (the charter's planned print stylesheet).
//
// It reads through the SAME single tokenised path as the screen version, so
// a paused, expired or revoked link prints nothing.
import LinkState from '@/components/cv/LinkState';
import { readCvByToken } from '@/lib/record-read';
import { cvMetadata, DEAD_LINK_METADATA } from '@/lib/cv-meta';
import {
  POSITIONS, PROVENANCE_LABELS, STAT_LABELS, provenanceLabel, sharedProvenance,
  type PositionCode, type StatKey,
} from '@/lib/football';
import PrintButton from './PrintButton';
import { T } from '@/lib/palette';

export const dynamic = 'force-dynamic';

// The title is the default filename every browser offers when this is saved
// as a PDF, so it has to be the player's name. It was the waitlist landing
// page's title, which meant a technical director printing a CV on trial day
// got a file called "Pitch Football - every season on the record. Coming
// soon.pdf". Band-aware for the same reason the card is.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cv = await readCvByToken(token).catch(() => null);
  return cv ? cvMetadata(cv) : DEAD_LINK_METADATA;
}

export default async function PrintCv({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ asked?: string }>;
}) {
  const { token } = await params;
  const { asked } = await searchParams;
  const cv = await readCvByToken(token);
  // A dead link never 404s and never leaks existence (D-77) — and that has to
  // hold on the print route too, which used to be the one place a revoked
  // token still produced a hard 404 while the page beside it served the
  // family-managed state at 200.
  if (!cv) return <LinkState token={token} asked={asked === '1'} />;

  const stats = cv.stats.filter((s) => s.value > 0);
  const tiles = (cv.surfacedStats as StatKey[])
    .map((k) => stats.find((s) => s.key === k))
    .filter((s): s is (typeof stats)[number] => s !== undefined && typeof s.value === 'number');
  // D-62 on the sheet a technical director carries around trial day: the tag
  // is read off the row, one line for the block while they agree and one under
  // each number when they do not. It used to be the word "Self-reported",
  // typed in, whatever the rows said.
  const shared = sharedProvenance(tiles);

  return (
    <div style={{ background: '#ffffff', color: T.bg, minHeight: '100dvh', padding: '32px 28px', fontFamily: 'inherit' }}>
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 14mm; } }`}</style>
      <PrintButton />
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2px solid ${T.bg}`, paddingBottom: 14 }}>
          <div>
            <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-0.02em' }}>{cv.firstName} {cv.lastName}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#3f5145', marginTop: 4 }}>
              {cv.positions.join(' · ')}
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
                {shared ? null : (
                  <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5b6b60', marginTop: 2 }}>{provenanceLabel(t.provenance)}</div>
                )}
              </div>
            ))}
            {shared && (
              <div style={{ marginLeft: 'auto', alignSelf: 'flex-end', fontSize: 10.5, color: '#5b6b60', fontWeight: 700 }}>{PROVENANCE_LABELS[shared]}</div>
            )}
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
