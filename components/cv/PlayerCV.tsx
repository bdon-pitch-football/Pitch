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
  CM: [54, 50], AM: [68, 50], LW: [74, 16], RW: [74, 84], ST: [90, 50],
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
  // Short codes on a player's page (BUZ, 16 Sep): "ST · LW", not "Striker · Left wing".
  const posLine = p.positions.join(' · ');
  const group = positionGroup(p.positions);
  // Resolve the clip list once, so the section can ask whether it has any
  // before deciding to render a heading at all.
  //
  // This used to fall back to three hardcoded lists of clip titles keyed on
  // the fixture slugs — 'deniz', 'nate', 'georgia' — inside the component
  // that renders every child's CV in the product. Real records could not
  // reach it (they carry highlights, and their slug is 'live'), so it was
  // dead rather than dangerous, but it is the same shape as the pronouns
  // that were NOT dead: fixture data living in a production component,
  // waiting for a slug to collide with it.
  //
  // The cap is enforced where caps belong — at write time, in the clips
  // action, against the band's limit. A render-time slice cannot be the
  // control, because it silently hides clips instead of refusing them.
  const clips = p.highlights ?? [];
  const previousClubs = p.previousClubs ?? [];
  // Absent band is treated as a minor — the restrictive default, the same
  // rule fn_age_band uses for an unknown DOB.
  const isMinor = p.band !== '18plus';

  return (
    <div className="floodlight" style={{ minHeight: '100dvh', color: T.ink, display: 'flex', justifyContent: 'center' }}>
      <style>{`
        @keyframes cvRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes cvPulse { 0%,100% { opacity: 1; } 50% { opacity: .55; } }
        .cv-rise { animation: cvRise .6s cubic-bezier(.22,1,.36,1) both; }
        .cv-pulse { animation: cvPulse 2.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .cv-rise, .cv-pulse { animation: none; } }
      `}</style>
      <div className="reading" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 22, padding: '22px 18px 30px 18px', boxSizing: 'border-box' }}>
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
            <h1 style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.015em' }}>{p.firstName} {p.lastName}</h1>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.78)', fontWeight: 500 }}>{posLine} · #{p.squadNumber} · {p.foot} footed</div>
            {/* The club line carried a HARDCODED 'Melbourne VIC' — every player
                in the country read as Melbourne. The locality now comes from
                the club record, and it is the CLUB's suburb and state: we do
                not hold an address for a player and this line must never
                start looking like one. The crest is the current club's, from
                membership — the only club claim on this page Pitch stands
                behind. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {p.clubCrestPath && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={p.clubCrestPath} alt="" width={24} height={24} style={{ objectFit: 'contain', flexShrink: 0 }} />
              )}
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.62)', fontWeight: 500 }}>
                {[p.club, p.squad.name].filter(Boolean).join(' — ')}{p.locality ? ` · ${p.locality}` : ''}
              </div>
            </div>
          </div>
          {/* Parent-approved was rendered on EVERY band, so an adult's own CV
              claimed a parent had approved it. It is a fact about a minor's
              page and it is now gated on the band the permission layer
              derived — never on anything stored (doc 14 §J1). */}
          {isMinor && (
          <div style={{ display: 'flex', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.08)', borderRadius: 999, padding: '4px 10px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.7)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 L20 6 V11 C20 16.5 16.6 20.6 12 22 C7.4 20.6 4 16.5 4 11 V6 Z" /><path d="M9 12 L11 14 L15 9.5" /></svg>
              <span>Parent-approved</span>
            </div>
          </div>
          )}
          <StatTiles p={p} />
        </div>

        {/* An EMPTY SECTION IS OMITTED, never rendered as a bare heading.
            This is the same rule as the never-zero stat tiles (D-70): a
            reserve keeper with no clips yet must not get a "Highlights"
            header with nothing under it, because the page then reads as
            half-finished rather than as a page about a keeper. Found
            walking Nate's CV — he has 0 clips. */}
        {p.about && (
          <div className="cv-rise" style={{ animationDelay: '.1s', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h2 style={kicker}>About</h2>
            <div style={{ fontSize: 14, lineHeight: 1.55, color: T.secondary, fontWeight: 500 }}>{p.about}</div>
          </div>
        )}

        {/* highlights — click-to-play façades only (D-97); nothing loads
            from a third party until the viewer presses play */}
        {clips.length > 0 && (
          <div className="cv-rise" style={{ animationDelay: '.16s', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={kicker}>Highlights</h2>
            {/* The subtitle used to be derived from the POSITION, so every
                card under a midfielder said "Goals, assists & link play" and
                every card under a keeper said "Veo clip". Two stacked cards
                repeating one line reads as a bug. Only the first card
                carries it now — it says what kind of footage this is, which
                is a fact about the player, not about each clip. */}
            {clips.map((h, i) => (
              <ClipCard key={h.title} title={h.title} url={h.url} gradientAlt={i % 2 === 1}
                sub={i === 0 ? (group === 'GK' ? 'Veo clip' : 'Goals, assists & link play') : undefined} />
            ))}
          </div>
        )}

        {/* achievements */}
        {p.achievements.length > 0 && (
        <div className="cv-rise" style={{ animationDelay: '.22s', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <h2 style={kicker}>Achievements</h2>
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
        )}

        {/* Football history — the clubs before this one, most recent first.
            "Most recent" is a text sort on the years the player typed, which
            works because they type them as years and sorts the ones who did
            not to the bottom. It was insertion order, which put a 2021 club
            above a 2023 one purely because it was added second. The player's own
            account (D-72): free text, no club FK, grants nothing, and it is
            said plainly at the foot of the section rather than implied. The
            CURRENT club is not repeated here; it is in the hero, where it
            carries the crest and the verification behind it. */}
        {previousClubs.length > 0 && (
        <div className="cv-rise" style={{ animationDelay: '.25s', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <h2 style={kicker}>Football history</h2>
          <div style={{ ...card, padding: '4px 15px' }}>
            {p.club && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 0' }}>
                <div style={{ width: 8, height: 8, borderRadius: 999, background: T.accent, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{p.club}</div>
                  <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{[p.squad.name, 'now'].filter(Boolean).join(' · ')}</div>
                </div>
              </div>
            )}
            {previousClubs.map((e) => (
              <div key={`${e.orgName}-${e.period ?? ''}`} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 0', borderTop: `1px solid ${T.line}` }}>
                <div style={{ width: 8, height: 8, borderRadius: 999, border: `1.5px solid ${T.muted}`, boxSizing: 'border-box', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.secondary }}>{e.orgName}</div>
                  {e.period && <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{e.period}</div>}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 500, lineHeight: 1.5 }}>
            Earlier clubs are {p.firstName}&rsquo;s own account of where they played. Only the club at the top is one we hold on Pitch.
          </div>
        </div>
        )}

        {/* other football — experience entries; free text shown, grants nothing */}
        {p.otherFootball.length > 0 && (
        <div className="cv-rise" style={{ animationDelay: '.28s', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <h2 style={kicker}>Other football</h2>
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
        )}

        {/* John's U-11 ruling put this on the SEND: no inbound reply route,
            and say so plainly or a club concludes we are broken rather than
            careful. The same club opens this page days later, often from a
            forwarded link, with no email in front of them — so the page
            carries it too, in the ruling's own words rather than new ones.
            Minors only: an adult is reachable through their own account and
            has no guardian to point at. */}
        {isMinor && (
          <div style={{ ...card, padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: T.secondary }}>There is no way to reply to a family through Pitch.</div>
            <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
              At any tier, for anybody — it is the same rule for every under-18 on here. If you want {p.firstName} at a trial, post it on Pitch: families register their interest from your trial, and that is where you can invite them. It goes to {p.firstName} and their parent together, and a record is kept.
            </div>
          </div>
        )}

        <a href="/report?kind=player_cv" style={{ display: 'block', padding: '16px 12px', margin: '-16px -12px', fontSize: 11, color: T.muted, textAlign: 'center', fontWeight: 700, textDecoration: 'none' }}>Report this page</a>
      </div>
    </div>
  );
}
