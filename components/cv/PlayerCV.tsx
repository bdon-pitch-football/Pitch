// The public player CV — the product, the marketing and the acquisition
// engine at once (CLAUDE.md). Faithful to the signed Main*.dc.html screens
// for content, order and copy.
//
// Floodlit (D-173 as extended 1 Oct — BUZ: "Yes to all three, build it"):
// the page takes its look from its own social card. A full-width player card
// (the squad number stadium-tall behind the name, the position map, the
// season's numbers as one band), then the story as open sections rather than
// stacked boxes. From 1024px the card stays on the left while the story
// scrolls on the right. Every word, every field and every rule is the one
// this page already had; only the arrangement and the scale moved.
//
// Server component, zero JS shipped: every animation is CSS, and the page is
// complete at rest — nothing on it waits for an animation to become visible.
// Must be fast on a phone on 4G at a football ground.
import type { FixtureStat, PlayerFixture } from '@/lib/fixtures';
import {
  PROVENANCE_LABELS, STAT_LABELS, positionGroup, provenanceLabel, provenanceLine, renderableExperience,
  sharedProvenance, type PositionCode,
} from '@/lib/football';
import SiteNav from '@/components/floodlit/SiteNav';
import ClipCard from '@/components/cv/ClipCard';
import StatTile from '@/components/cv/StatTile';
import { T } from '@/lib/palette';
import { CV_WEARS_CLUB_COLOURS, clubTheme, type ClubColours } from '@/lib/club-colours';

// Position dots for the mini pitch map (attack →), x/y in % of the map box.
const POS_XY: Record<PositionCode, [number, number]> = {
  GK: [8, 50], CB: [24, 50], LB: [26, 16], RB: [26, 84], DM: [40, 50],
  CM: [54, 50], AM: [68, 50], LW: [74, 16], RW: [74, 84], ST: [90, 50],
};

// D-84: "U15 · born Jan–Mar" under the name. The age group is the one the
// page already carries (the confirmed squad); the quarter is the database's
// (fn_birth_quarter, 0082). A junior age group only — "U" and a number, the
// shape of every string BUZ approved — and nothing at all when either half is
// missing: a guess is worse than a blank. Never a date of birth, a year or an
// exact age, and never on a card (D-89): opengraph-image and the share card
// do not read this.
export function contextLine(ageGroup: string | undefined, quarter: string | null | undefined): string | null {
  const group = (ageGroup ?? '').trim();
  if (!/^U\d{1,2}$/.test(group) || !quarter) return null;
  return `${group} · born ${quarter}`;
}

// D-160: a number opens, in place, to where it came from — "Verified by
// Riverside FC · 2 Sep 2026" or "Self-reported · entered 14 Mar 2026"
// (provenanceLine, lib/football). The CLUB, never the coach: this page is read
// by whoever holds the link, and naming the adult who coaches this child to
// that reader is a contact route (BUZ, 28 Sep). fn_stat_public (0083) has no
// field that could carry a person, so nothing here can print one.
//
// Two levels and no more: the tile, and the well under the row. It PUSHES
// the page down and never floats over it — a modal over a child's CV is a
// second render of the most dangerous surface we have
// (docs/design/mockups/provenance-drill.html). No JavaScript: each tile is a
// label wrapping a visually hidden checkbox, and CSS :has() opens its well
// under the row — so it works with the bundle stalled, a second tap closes
// it, and the tap target is the whole tile. A tile with nothing to say (an
// official import, or a snapshot approved before 0083 with no dates) does
// not open.
function StatTiles({ p }: { p: PlayerFixture }) {
  // The never-zero rule (D-70): a tile renders only for a selected stat with
  // a positive value. Nothing selected or nothing positive → no block at all.
  const bySeason = p.stats.filter((s) => s.season === '2026');
  const tiles = p.surfacedStats
    .map((key) => bySeason.find((s) => s.key === key))
    .filter((s): s is FixtureStat => s !== undefined && typeof s.value === 'number' && s.value > 0);
  if (tiles.length === 0) return null;
  // D-62: the chip is a statement about every number under it, so it renders
  // the source the ROW carries and only while all of them carry the same one.
  // Where the rows differ there is no honest single label, so each tile
  // carries its own.
  const shared = sharedProvenance(tiles);
  const drills = tiles.map((t) => ({ key: t.key, line: provenanceLine(t) }));
  return (
    <div className="cv-stats">
      <style>{`
        .drill-in { position: absolute; opacity: 0; width: 1px; height: 1px; margin: 0; pointer-events: none; }
        .drill-wells, .drill-well { display: none; }
        .drill-row:has(.drill-in:checked) ~ .drill-wells { display: flex; }
        .drill-tile:has(> .drill-in:checked) > div { }
        .drill-tile:has(> .drill-in:focus-visible) { outline: 2px solid ${T.accent}; outline-offset: 2px; border-radius: 12px; }
        ${drills.filter((d) => d.line).map((d) => `.drill-row:has(#drill-${d.key}:checked) ~ .drill-wells #drill-well-${d.key} { display: flex; }`).join('\n        ')}
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.66)' }}>Season 2026</div>
        {shared && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px solid rgba(255,255,255,.22)', borderRadius: 999, padding: '3px 9px' }}>
            <div style={{ width: 5, height: 5, borderRadius: 999, background: 'rgba(255,255,255,.5)' }} />
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,.72)' }}>{PROVENANCE_LABELS[shared]}</div>
          </div>
        )}
      </div>
      <div className="drill-row" style={{ display: 'grid', gap: 0, gridTemplateColumns: `repeat(${tiles.length}, minmax(0,1fr))` }}>
        {tiles.map((t, i) => {
          const tile = (
            <StatTile value={t.value} label={STAT_LABELS[t.key]} accent={t.key === 'goals' || t.key === 'clean_sheets'} delay={i * 0.09}
              source={shared ? undefined : provenanceLabel(t.provenance)} />
          );
          return drills[i].line
            ? (
              <label key={t.key} className="drill-tile" style={{ display: 'block', position: 'relative', cursor: 'pointer', minWidth: 0 }}>
                <input type="checkbox" id={`drill-${t.key}`} className="drill-in" aria-controls={`drill-well-${t.key}`} aria-label={STAT_LABELS[t.key]} />
                {tile}
              </label>
            )
            : <div key={t.key} style={{ minWidth: 0 }}>{tile}</div>;
        })}
      </div>
      {drills.some((d) => d.line) && (
      <div className="drill-wells" style={{ flexDirection: 'column', gap: 7, marginTop: 10 }}>
        {tiles.map((t, i) => drills[i].line && (
          <div key={t.key} id={`drill-well-${t.key}`} className="drill-well" style={{ flexDirection: 'column', gap: 3, background: 'rgba(255,255,255,.08)', borderRadius: 12, padding: '11px 13px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,.72)' }}>{STAT_LABELS[t.key]} · {t.value}</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, lineHeight: 1.45 }}>{drills[i].line}</div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

// Where they play, on a pitch: stroke SVG only (no emoji, per the charter);
// reads in one glance for a TD. The first position is the one they lead with.
function PositionMap({ positions, lead }: { positions: PositionCode[]; lead: string }) {
  return (
    <svg viewBox="0 0 100 62" width="132" height="82" aria-hidden style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="98" height="60" rx="6" fill="rgba(0,0,0,.2)" stroke="rgba(255,255,255,.3)" strokeWidth="1.3" />
      <line x1="50" y1="1" x2="50" y2="61" stroke="rgba(255,255,255,.3)" strokeWidth="1.3" />
      <circle cx="50" cy="31" r="8" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="1.3" />
      <rect x="1" y="17" width="12" height="28" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1.1" />
      <rect x="87" y="17" width="12" height="28" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1.1" />
      {positions.map((code, i) => {
        const [x, y] = POS_XY[code];
        return (
          <g key={code}>
            {i === 0 && <circle cx={x} cy={y * 0.62} r={5.5} fill="none" stroke={lead} strokeWidth="1.2" className="dot-ping" />}
            <circle cx={x} cy={y * 0.62} r={i === 0 ? 5.5 : 4} fill={i === 0 ? lead : 'rgba(255,255,255,.55)'} />
          </g>
        );
      })}
    </svg>
  );
}

const sectionTitle = (text: string) => <h2 className="cv-h2">{text}</h2>;

// reportRef: what "Report this page" tells the operator this page was — the
// hex of the share token's stored hash, never the token itself (0010).
// clubColours: the current club's own colours (0163, D-173). Worn only while
// CV_WEARS_CLUB_COLOURS is on, only when the club is verified (the call,
// D-126), and never on a card (D-89 — opengraph-image does not read
// them). The read that supplies them belongs to the tech team (lib/record-read).
// above: what the family's own preview puts under the nav bar — the way back
// and the "Preview" notice (spec C, one header). The token page never passes
// it, so the page a club opens is unchanged.
export default function PlayerCV({ p, reportRef, clubColours, clubState, above }: {
  p: PlayerFixture; reportRef?: string; clubColours?: Partial<ClubColours> | null; clubState?: string; above?: React.ReactNode;
}) {
  const initials = `${p.firstName[0]}${p.lastName[0] ?? ''}`;
  // The name is sized by its longest word and the card's own width, so a long
  // surname (Christodoulopoulos, Papadopoulos-Nguyen) fits rather than being
  // cut at the card's edge (audit, 1 Oct). Wrapping mid-word is the last net.
  const longestWord = Math.max(...`${p.firstName} ${p.lastName}`.split(/[\s-]+/).map((w) => w.length), 4);
  const group = positionGroup(p.positions);
  // Resolve the clip list once, so the section can ask whether it has any
  // before deciding to render a heading at all. The cap is enforced where caps
  // belong — at write time, in the clips action, against the band's limit.
  const clips = p.highlights ?? [];
  const previousClubs = p.previousClubs ?? [];
  // Absent band is treated as a minor — the restrictive default, the same
  // rule fn_age_band uses for an unknown DOB.
  const isMinor = p.band !== '18plus';
  // No school on an under-18's page, whoever is reading (D-161). The database
  // refuses the write and filters the read (0061); this is the last surface,
  // and it is the one that catches an entry written before the rule.
  const otherFootball = renderableExperience(p.otherFootball, p.band);
  const context = contextLine(p.squad.ageGroup, p.birthQuarter);
  // Verified clubs only on a player's page (safety review N1): a club that has
  // claimed but not had the call is not one we stand behind on a child's CV.
  const theme = CV_WEARS_CLUB_COLOURS && p.club && clubState === 'verified' ? clubTheme(clubColours ?? null, clubState) : null;
  const lead = theme ? theme.trim : T.accent;
  const heroBg = theme
    ? `radial-gradient(120% 70% at 20% -10%, ${theme.hero} 0%, ${theme.hero} 30%, transparent 72%), linear-gradient(180deg, ${theme.heroDeep} 0%, #0b120e 100%)`
    : 'radial-gradient(120% 70% at 20% -10%, #2a6a49 0%, #1f5a3d 30%, transparent 72%), linear-gradient(180deg, #173a29 0%, #0b120e 100%)';

  return (
    <div style={{ minHeight: '100dvh', color: T.ink, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* The logo: top right on a phone, top left from 1024px (D-173). On a
          tokenised page it is not a link and there is no sign-in: the only
          link out is "Report this page". */}
      <SiteNav signIn={false} homeLink={false} />
      {above}
      {/* A container, so the card lays itself out by the room it is given,
          not by the screen — the site preview puts it in a phone frame. */}
      <div className="cv-root"><div className="fl-wide cv-grid">
        {/* ---- the player card ------------------------------------------ */}
        <div className="cv-cardcol">
          <section className="cv-hero cv-rise" style={{ background: heroBg, ['--cv-lead' as string]: lead } as React.CSSProperties} aria-labelledby="cv-name">
            <div className="cv-num" aria-hidden>{p.squadNumber}</div>
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
              {p.photoPath ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={p.photoPath} alt="" width={92} height={92} className="cv-avatar" style={{ objectFit: 'cover' }} />
              ) : (
                <div className="cv-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 32 }}>{initials}</div>
              )}
              <PositionMap positions={p.positions} lead={lead} />
            </div>
            <h1 id="cv-name" className="cv-name" style={{ ['--name-len' as string]: longestWord } as React.CSSProperties}>{p.firstName} {p.lastName}</h1>
            {context && <div className="cv-context">{context}</div>}
            {/* Short codes on a player's page (BUZ, 16 Sep): "ST · LW", not
                "Striker · Left wing". The same facts the line carried, as chips. */}
            <div className="cv-chips">
              {p.positions.map((code, i) => (
                <span key={code} className="cv-chip" style={i === 0 ? { color: lead, borderColor: lead, background: 'rgba(0,0,0,.28)' } : { background: 'rgba(255,255,255,.12)' }}>{code}</span>
              ))}
              <span className="cv-chip">#{p.squadNumber}</span>
              <span className="cv-chip">{p.foot} footed</span>
            </div>
            {/* The locality is the CLUB's suburb and state: we do not hold an
                address for a player and this line must never start looking
                like one. The crest is the current club's, from membership —
                the only club claim on this page Pitch stands behind. */}
            {(p.club || p.squad.name) && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 9, marginTop: 14 }}>
                {p.clubCrestPath ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={p.clubCrestPath} alt="" width={28} height={28} style={{ objectFit: 'contain', flexShrink: 0 }} />
                ) : p.club ? (
                  // The same line keeps its shape whether or not the club has
                  // uploaded a crest: its initials, from the name already shown.
                  <span aria-hidden style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, flexShrink: 0 }}>
                    {p.club.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && !/^(FC|SC|AFC|United|City)$/.test(w)).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || p.club[0]}
                  </span>
                ) : null}
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,.84)', fontWeight: 700, lineHeight: 1.3 }}>
                  {[p.club, p.squad.name].filter(Boolean).join(' — ')}
                  {p.locality && <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.62)', fontWeight: 500 }}>{p.locality}</div>}
                </div>
              </div>
            )}
            {/* A fact about a minor's page, gated on the band the permission
                layer derived — never on anything stored (doc 14 §J1). */}
            {isMinor && (
              <div style={{ position: 'relative', display: 'flex', marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,.3)', borderRadius: 999, padding: '5px 11px', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,.78)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2 L20 6 V11 C20 16.5 16.6 20.6 12 22 C7.4 20.6 4 16.5 4 11 V6 Z" /><path d="M9 12 L11 14 L15 9.5" /></svg>
                  <span>Parent-approved</span>
                </div>
              </div>
            )}
            <StatTiles p={p} />
          </section>
        </div>

        {/* ---- the story ------------------------------------------------- */}
        {/* An EMPTY SECTION IS OMITTED, never rendered as a bare heading —
            the same rule as the never-zero stat tiles (D-70). */}
        <div className="cv-story">
          {p.about && (
            <section>
              {sectionTitle('About')}
              <div className="cv-about">{p.about}</div>
            </section>
          )}

          {/* highlights — click-to-play façades only (D-97); nothing loads
              from a third party until the viewer presses play. Only the first
              card carries the subtitle: it is a fact about the player. */}
          {clips.length > 0 && (
            <section>
              {sectionTitle('Highlights')}
              <div className="fl-grid-2">
                {clips.map((h, i) => (
                  <ClipCard key={h.title} title={h.title} url={h.url} gradientAlt={i % 2 === 1}
                    sub={i === 0 ? (group === 'GK' ? 'Veo clip' : 'Goals, assists & link play') : undefined} />
                ))}
              </div>
            </section>
          )}

          {p.achievements.length > 0 && (
            <section>
              {sectionTitle('Achievements')}
              <div className="fl-grid-2">
                {p.achievements.map((a, i) => (
                  <div key={a.title} className="fl-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 16px' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 13, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {i === 0
                        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M8 21 H16 M12 17 V21 M7 4 H17 V8 A5 5 0 0 1 7 8 Z M7 5 H4 V7 A3 3 0 0 0 7 9 M17 5 H20 V7 A3 3 0 0 1 17 9" /></svg>
                        : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3 L14.6 8.6 L20.5 9.3 L16.2 13.4 L17.4 19.3 L12 16.3 L6.6 19.3 L7.8 13.4 L3.5 9.3 L9.4 8.6 Z" /></svg>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <div style={{ fontSize: 15.5, fontWeight: 800 }}>{a.title}</div>
                      <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{a.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Football history — the clubs before this one, most recent first
              (a text sort on the years the player typed). The player's own
              account (D-72): free text, no club FK, grants nothing, and it is
              said plainly at the foot of the section. The CURRENT club heads
              the line, because it is the one Pitch holds. */}
          {previousClubs.length > 0 && (
            <section>
              {sectionTitle('Football history')}
              <div className="cv-timeline">
                {p.club && (
                  <div className="cv-stop cv-stop-now">
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{p.club}</div>
                    <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{[p.squad.name, 'now'].filter(Boolean).join(' · ')}</div>
                  </div>
                )}
                {previousClubs.map((e) => (
                  <div key={`${e.orgName}-${e.period ?? ''}`} className="cv-stop">
                    <div style={{ fontSize: 16, fontWeight: 800, color: T.secondary }}>{e.orgName}</div>
                    {e.period && <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{e.period}</div>}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, lineHeight: 1.5, marginTop: 14, maxWidth: '60ch' }}>
                Earlier clubs are {p.firstName}&rsquo;s own account of where they played. Only the club at the top is one we hold on Pitch.
              </div>
            </section>
          )}

          {/* other football — experience entries; free text shown, grants nothing */}
          {otherFootball.length > 0 && (
            <section>
              {sectionTitle('Other football')}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {otherFootball.map((e) => (
                  <div key={e.orgName} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', borderRadius: 14, border: `1px solid ${T.line}`, background: 'rgba(255,255,255,.03)' }}>
                    <div style={{ background: 'rgba(61,220,132,.12)', color: T.accent, borderRadius: 7, padding: '3px 8px', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>{e.kind === 'ntc_academy' ? 'NTC' : e.kind}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{e.orgName}</div>
                      <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{e.period}{e.note ? ` · ${e.note}` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* John's U-11 ruling put this on the SEND: no inbound reply route,
              and say so plainly or a club concludes we are broken rather than
              careful. The page carries it too, in the ruling's own words.
              Minors only: an adult is reachable through their own account. */}
          {isMinor && (
            <div style={{ padding: '16px 18px', borderRadius: 16, border: `1px solid ${T.line}`, background: 'rgba(255,255,255,.03)', display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 680 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: T.secondary }}>There is no way to reply to a family through Pitch.</div>
              <div style={{ fontSize: 13, color: T.muted, fontWeight: 500, lineHeight: 1.55 }}>
                At any tier, for anybody — it is the same rule for every under-18 on here. If you want {p.firstName} at a trial, post it on Pitch: families register their interest from your trial, and that is where you can invite them. It goes to {p.firstName} and their parent together, and a record is kept.
              </div>
            </div>
          )}

          <a href={`/report?kind=player_cv${reportRef ? `&page=${reportRef}` : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, fontSize: 11.5, color: T.muted, fontWeight: 700, textDecoration: 'none' }}>Report this page</a>
        </div>
      </div></div>
    </div>
  );
}
