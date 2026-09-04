// The public player CV — the product, the marketing and the acquisition
// engine at once (CLAUDE.md). Faithful to the signed Main*.dc.html screens
// for content, order and copy; the creative layer on top (BUZ, 4 Sep:
// "add your twist") is motion and the position map — both Night Match,
// no new colours, no new type.
//
// Server component, zero JS shipped: every animation is CSS. Must be fast
// on a phone on 4G at a football ground.
import type { PlayerFixture } from '@/lib/fixtures';
import { POSITIONS, STAT_LABELS, positionGroup, type PositionCode, type StatKey } from '@/lib/football';
import { HeaderMark } from '@/components/Wordmark';
import ClipCard from '@/components/cv/ClipCard';
import StatTile from '@/components/cv/StatTile';

const T = {
  bg: '#0b120e', surface: '#121b16', line: '#24322a', ink: '#eef5f0',
  secondary: '#b9c8bf', muted: '#7d8f85', accent: '#3ddc84', onAccent: '#06130c',
};

// Position dots for the mini pitch map (attack →), x/y in % of the map box.
const POS_XY: Record<PositionCode, [number, number]> = {
  GK: [8, 50], CB: [24, 50], LB: [26, 16], RB: [26, 84], DM: [40, 50],
  CM: [54, 50], CAM: [68, 50], LW: [74, 16], RW: [74, 84], ST: [90, 50],
};

const kicker: React.CSSProperties = {
  fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted,
};
const card: React.CSSProperties = {
  background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16,
};

function StatTiles({ p }: { p: PlayerFixture }) {
  // The never-zero rule (D-70): a tile renders only for a selected stat with
  // a positive value. Nothing selected or nothing positive → no block at all.
  const bySeason = p.stats.filter((s) => s.season === '2026');
  const tiles = p.surfacedStats
    .map((key) => ({ key, value: bySeason.find((s) => s.key === key)?.value }))
    .filter((t): t is { key: StatKey; value: number } => typeof t.value === 'number' && t.value > 0);
  if (tiles.length === 0) return null;
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)' }}>Season 2026</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px solid rgba(255,255,255,.22)', borderRadius: 999, padding: '3px 9px' }}>
          <div style={{ width: 5, height: 5, borderRadius: 999, background: 'rgba(255,255,255,.5)' }} />
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,.65)' }}>Self-reported</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tiles.length}, minmax(0,1fr))`, gap: 7, position: 'relative', marginTop: -6 }}>
        {tiles.map((t, i) => (
          <StatTile key={t.key} value={t.value} label={STAT_LABELS[t.key]} accent={t.key === 'goals' || t.key === 'clean_sheets'} delay={i * 0.09} />
        ))}
      </div>
    </>
  );
}

// The twist: a quiet mini pitch inside the hero showing where they play.
// Stroke SVG only (no emoji, per the charter); reads in one glance for a TD.
function PositionMap({ positions }: { positions: PositionCode[] }) {
  return (
    <svg viewBox="0 0 100 62" width="86" height="53" aria-hidden style={{ opacity: 0.9 }}>
      <rect x="1" y="1" width="98" height="60" rx="6" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="1.5" />
      <line x1="50" y1="1" x2="50" y2="61" stroke="rgba(255,255,255,.28)" strokeWidth="1.5" />
      <circle cx="50" cy="31" r="8" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="1.5" />
      {positions.map((code, i) => {
        const [x, y] = POS_XY[code];
        return (
          <g key={code}>
            {i === 0 && <circle cx={x} cy={y * 0.62} r={5} fill="none" stroke={T.accent} strokeWidth="1.2" className="dot-ping" />}
            <circle cx={x} cy={y * 0.62} r={i === 0 ? 5 : 3.6} fill={i === 0 ? T.accent : 'rgba(61,220,132,.45)'} className="dot-in" style={{ animationDelay: `${0.35 + i * 0.18}s` }} />
          </g>
        );
      })}
    </svg>
  );
}

export default function PlayerCV({ p }: { p: PlayerFixture }) {
  const initials = `${p.firstName[0]}${p.lastName[0] ?? ''}`;
  const posLine = p.positions.map((c) => POSITIONS[c].label).join(' · ');
  const group = positionGroup(p.positions);

  const clipTitles: Record<string, string[]> = {
    deniz: ['Season highlights 2026', 'vs Northern Utd — full performance'],
    nate: ['Shot-stopping & sweeping 2026', 'Penalty save — Metro League', 'Distribution reel'],
    georgia: ['Season highlights 2026'],
  };

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <style>{`
        @keyframes cvRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes cvPulse { 0%,100% { opacity: 1; } 50% { opacity: .55; } }
        .cv-rise { animation: cvRise .6s cubic-bezier(.22,1,.36,1) both; }
        .cv-pulse { animation: cvPulse 2.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .cv-rise, .cv-pulse { animation: none; } }
      `}</style>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 22, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
        {/* logo — top right on every screen, no exceptions */}
        <HeaderMark />

        {/* hero */}
        <div className="cv-rise sheen" style={{ position: 'relative', overflow: 'hidden', borderRadius: 22, background: 'linear-gradient(160deg, #123326 0%, #0c1d14 60%, #0a1510 100%)', padding: '24px 20px 22px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ position: 'absolute', right: -14, top: -30, fontSize: 170, fontWeight: 900, letterSpacing: '-0.04em', color: 'rgba(61,220,132,.08)', lineHeight: 1 }}>{p.squadNumber}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
            {p.photoPath ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={p.photoPath} alt="" width={66} height={66} style={{ borderRadius: 20, objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 66, height: 66, borderRadius: 20, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 24 }}>{initials}</div>
            )}
            <PositionMap positions={p.positions} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
            <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.015em' }}>{p.firstName} {p.lastName}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.78)', fontWeight: 500 }}>{posLine} · #{p.squadNumber} · {p.foot} footed</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.62)', fontWeight: 500 }}>{p.club} — {p.squad.name} · Melbourne VIC</div>
          </div>
          <div style={{ display: 'flex', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.08)', borderRadius: 999, padding: '4px 10px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.7)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 L20 6 V11 C20 16.5 16.6 20.6 12 22 C7.4 20.6 4 16.5 4 11 V6 Z" /><path d="M9 12 L11 14 L15 9.5" /></svg>
              <span>Parent-approved</span>
            </div>
          </div>
          <StatTiles p={p} />
        </div>

        {/* about */}
        <div className="cv-rise" style={{ animationDelay: '.1s', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={kicker}>About</div>
          <div style={{ fontSize: 14, lineHeight: 1.55, color: T.secondary, fontWeight: 500 }}>{p.about}</div>
        </div>

        {/* highlights — click-to-play façades only (D-97); nothing loads
            from a third party until the viewer presses play */}
        <div className="cv-rise" style={{ animationDelay: '.16s', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={kicker}>Highlights</div>
          {(p.highlights ?? (clipTitles[p.slug] ?? []).map((title) => ({ title, url: undefined as string | undefined }))).slice(0, p.highlightsUsed).map((h, i) => (
            <ClipCard key={h.title} title={h.title} url={h.url} gradientAlt={i % 2 === 1} sub={group === 'GK' ? 'Veo clip' : 'Goals, assists & link play'} />
          ))}
        </div>

        {/* achievements */}
        <div className="cv-rise" style={{ animationDelay: '.22s', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={kicker}>Achievements</div>
          {p.achievements.map((a, i) => (
            <div key={a.title} className="lift" style={{ ...card, display: 'flex', alignItems: 'center', gap: 11, padding: '15px 14px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(61,220,132,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {i === 0
                  ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21 H16 M12 17 V21 M7 4 H17 V8 A5 5 0 0 1 7 8 Z M7 5 H4 V7 A3 3 0 0 0 7 9 M17 5 H20 V7 A3 3 0 0 1 17 9" /></svg>
                  : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 L14.6 8.6 L20.5 9.3 L16.2 13.4 L17.4 19.3 L12 16.3 L6.6 19.3 L7.8 13.4 L3.5 9.3 L9.4 8.6 Z" /></svg>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{a.detail}</div>
              </div>
            </div>
          ))}
        </div>

        {/* other football — experience entries; free text shown, grants nothing */}
        <div className="cv-rise" style={{ animationDelay: '.28s', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={kicker}>Other football</div>
          {p.otherFootball.map((e) => (
            <div key={e.orgName} className="lift" style={{ ...card, display: 'flex', alignItems: 'center', gap: 11, padding: '15px 14px' }}>
              <div style={{ background: 'rgba(61,220,132,.12)', color: T.accent, borderRadius: 7, padding: '3px 8px', fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>{e.kind === 'ntc_academy' ? 'NTC' : e.kind}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>{e.orgName}</div>
                <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{e.period}{e.note ? ` · ${e.note}` : ''}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: T.muted, textAlign: 'center', fontWeight: 700 }}>Report this page</div>
      </div>
    </div>
  );
}
