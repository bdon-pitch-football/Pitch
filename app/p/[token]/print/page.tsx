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
  POSITIONS, PROVENANCE_LABELS, STAT_LABELS, provenanceLabel, renderableExperience, sharedProvenance,
  type PositionCode, type StatKey,
} from '@/lib/football';
import PrintButton from './PrintButton';
import Wordmark from '@/components/Wordmark';
import { contextLine } from '@/components/cv/PlayerCV';

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
  // No school on an under-18's page, and a printed page is the one that
  // outlives the link (D-161). Same answer as the screen version, from the
  // same band the tokenised read path derived.
  const otherFootball = renderableExperience(cv.otherFootball, cv.band);
  const tiles = (cv.surfacedStats as StatKey[])
    .map((k) => stats.find((s) => s.key === k))
    .filter((s): s is (typeof stats)[number] => s !== undefined && typeof s.value === 'number');
  // D-62 on the sheet a technical director carries around trial day: the tag
  // is read off the row, one line for the block while they agree and one under
  // each number when they do not. It used to be the word "Self-reported",
  // typed in, whatever the rows said.
  const shared = sharedProvenance(tiles);

  const context = contextLine(cv.squad?.ageGroup, cv.birthQuarter);
  const previousClubs = cv.previousClubs ?? [];

  // THE CARD IN INK (spec C): the one light surface, on named tokens
  // (--print-*), with the CV's own section heading, the display numeral and
  // only the charter's five letter-spacings. C-P3 (BUZ, 1 Oct): the sheet a
  // TD holds on trial day carries what the screen CV carries — the D-84
  // context line and Football history — from the same read, under the same
  // rules (never a date of birth; history only when there is any).
  return (
    <div className="sheet-page">
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 14mm; } }`}</style>
      <PrintButton />
      <div className="sheet">
        <div className="sheet-head">
          <div>
            <div className="sheet-name">{cv.firstName} {cv.lastName}</div>
            <div className="sheet-l1">
              {cv.positions.join(' · ')}
              {cv.squadNumber ? ` · #${cv.squadNumber}` : ''}{cv.foot ? ` · ${cv.foot} footed` : ''}
            </div>
            {cv.club && <div className="sheet-l2">{cv.club}{cv.squad?.name ? ` — ${cv.squad.name}` : ''}</div>}
            {context && <div className="sheet-ctx">{context}</div>}
          </div>
          <span className="wordmark-ink"><Wordmark size={18} color="var(--print-ink)" /></span>
        </div>

        {tiles.length > 0 && (
          <div className="sheet-stats">
            {tiles.map((t) => (
              <div key={t.key}>
                <div className="numeral numeral-m">{t.value}</div>
                <div className="sheet-nl">{STAT_LABELS[t.key]}</div>
                {shared ? null : (
                  <div className="sheet-nl" style={{ marginTop: 2 }}>{provenanceLabel(t.provenance)}</div>
                )}
              </div>
            ))}
            {shared && <div className="sheet-src">{PROVENANCE_LABELS[shared]}</div>}
          </div>
        )}

        {cv.about && (
          <div className="sheet-sec">
            <div className="sheet-h">About</div>
            <div className="sheet-p">{cv.about}</div>
          </div>
        )}

        {cv.achievements.length > 0 && (
          <div className="sheet-sec">
            <div className="sheet-h">Achievements</div>
            {cv.achievements.map((a) => (
              <div key={a.title} className="sheet-i">
                <b>{a.title}</b>{a.detail ? ` — ${a.detail}` : ''}
              </div>
            ))}
          </div>
        )}

        {/* C-P3: the clubs before this one, most recent first, under the
            club Pitch holds — exactly as the screen CV draws them, and with
            the screen CV's own sentence: the earlier clubs are the player's
            own account (D-72; free text, grants nothing). */}
        {previousClubs.length > 0 && (
          <div className="sheet-sec">
            <div className="sheet-h">Football history</div>
            {cv.club && (
              <div className="sheet-i"><b>{cv.club}</b> — {[cv.squad?.name, 'now'].filter(Boolean).join(' · ')}</div>
            )}
            {previousClubs.map((e) => (
              <div key={`${e.orgName}-${e.period ?? ''}`} className="sheet-i">
                <b>{e.orgName}</b>{e.period ? ` — ${e.period}` : ''}
              </div>
            ))}
            <div className="sheet-note">Earlier clubs are {cv.firstName}&rsquo;s own account of where they played. Only the club at the top is one we hold on Pitch.</div>
          </div>
        )}

        {otherFootball.length > 0 && (
          <div className="sheet-sec">
            <div className="sheet-h">Other football</div>
            {otherFootball.map((e) => (
              <div key={e.orgName} className="sheet-i">
                <b>{e.orgName}</b>{e.period ? ` — ${e.period}` : ''}
              </div>
            ))}
          </div>
        )}

        <div className="sheet-foot">
          pitchfootball.com.au · this page is a live link and the family can switch it off at any time
        </div>
      </div>
    </div>
  );
}
