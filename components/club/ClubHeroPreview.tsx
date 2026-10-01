// The club page's hero at preview size (F, 1 Oct; P4 approved by BUZ). The
// page editor draws what a family will see on /fc/[slug]: the same "Club" and
// "Verified club" pills, the crest tile, the name, "Est. · place", the
// pathway, the trim and the colours — and the banner photograph behind it
// when there is one. The colours are clubTheme()'s answer, passed in by the
// page from the same stored values /fc reads, so the two cannot disagree.
//
// No crest yet is the dashed "not yet" tile (Head of Product Design ruling 4).
// This is the club's own seat: an unclaimed club has no seat and never
// reaches it (D-172).
import type { ClubTheme } from '@/lib/club-colours';

export type HeroPreviewProps = {
  name: string;
  verified: boolean;
  crestPath: string | null;
  /** The banner, when the preview should carry it (the banner panel, the aside). */
  bannerPath?: string | null;
  established: string | number | null;
  place: string;
  pathway: string | null;
  theme: ClubTheme | null;
  /** The aside only: the counts /fc shows, and its first trial. */
  stats?: { squads: number; trials: number };
  firstTrial?: { day: string; mon: string; title: string; timeVenue: string } | null;
};

export default function ClubHeroPreview({ name, verified, crestPath, bannerPath, established, place, pathway, theme, stats, firstTrial }: HeroPreviewProps) {
  const banner = Boolean(bannerPath);
  return (
    <div className="club-hero-preview">
      <div className="chp-hero" style={{ background: theme ? `linear-gradient(115deg, ${theme.hero} 0%, ${theme.heroDeep} 70%, var(--bg) 100%)` : 'var(--hero)', borderBottom: theme ? `5px solid ${theme.trim}` : '1px solid var(--line)' }}>
        {banner && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bannerPath!} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: theme
              ? `linear-gradient(90deg, ${theme.hero} 0%, ${theme.hero}cc 38%, ${theme.heroDeep}40 100%), linear-gradient(180deg, rgba(10,21,16,0) 40%, rgba(10,21,16,.8) 100%)`
              : 'linear-gradient(90deg, rgba(10,21,16,.92) 0%, rgba(10,21,16,.7) 45%, rgba(10,21,16,.25) 100%), linear-gradient(180deg, rgba(10,21,16,0) 40%, rgba(10,21,16,.85) 100%)' }} />
          </>
        )}
        <div className="chp-in" style={banner ? { paddingTop: 54 } : undefined}>
          {crestPath ? (
            <div className="chp-crest" style={{ background: 'var(--surface-2)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={crestPath} alt="" width={56} height={56} style={{ objectFit: 'contain' }} />
            </div>
          ) : (
            <div className="chp-crest empty-tile" style={{ color: 'var(--muted)' }}>{name[0]}</div>
          )}
          <div className="chp-id">
            <div className="chp-pills">
              <span className="chp-club">Club</span>
              {verified && (
                <span className="chp-ver">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2 L20 6 V11 C20 16.5 16.6 20.6 12 22 C7.4 20.6 4 16.5 4 11 V6 Z" /><path d="M9 12 L11 14 L15 9.5" /></svg>
                  <span>Verified club</span>
                </span>
              )}
            </div>
            <div className="chp-name">{name}</div>
            {(established || place) && <div className="chp-sub">{[established ? `Est. ${established}` : null, place].filter(Boolean).join(' · ')}</div>}
            {pathway && <div className="chp-path">{pathway}</div>}
          </div>
        </div>
        {stats && (stats.squads > 0 || stats.trials > 0) && (
          <div className="chp-stats">
            {stats.squads > 0 && (
              <div>
                <div className="numeral numeral-s" style={{ color: 'var(--ink)' }}>{stats.squads}</div>
                <div className="kicker" style={{ marginTop: 5, color: 'rgba(255,255,255,.6)' }}>Squads</div>
              </div>
            )}
            {stats.trials > 0 && (
              <div>
                <div className="numeral numeral-s" style={{ color: 'var(--accent)' }}>{stats.trials}</div>
                <div className="kicker" style={{ marginTop: 5, color: 'rgba(255,255,255,.6)' }}>Trials coming</div>
              </div>
            )}
          </div>
        )}
      </div>
      {firstTrial && (
        <div className="chp-row">
          <div className="fl-trial-date">
            <div className="numeral fl-trial-day">{firstTrial.day}</div>
            <div className="fl-trial-mon" style={theme ? { color: theme.trim } : undefined}>{firstTrial.mon}</div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.3 }}>{firstTrial.title}</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>{firstTrial.timeVenue}</div>
          </div>
        </div>
      )}
    </div>
  );
}
