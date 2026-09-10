// Titles and social copy for the tokenised CV pages.
//
// This lives in ONE place on purpose. A platform caches og:title and
// og:description exactly as permanently as it caches the card image, so the
// D-89 band rule governs all three — and the card has already been caught
// once carrying a second, divergent copy of that rule. One function, called
// by the page, the print view and (through isAdult) the card.
import type { Metadata } from 'next';
import type { CvData } from '@/lib/record-read';
import { POSITIONS, type PositionCode } from '@/lib/football';

/** D-89: 18+ carries full detail; everyone else — and any unknown band — does not. */
export const isAdultBand = (cv: Pick<CvData, 'band'>) => cv.band === '18plus';

/** "Deniz Y." for a minor, "Jordan Abebe" for an adult. */
export function cvDisplayName(cv: Pick<CvData, 'band' | 'firstName' | 'lastName'>): string {
  if (!cv.lastName) return cv.firstName;
  return isAdultBand(cv) ? `${cv.firstName} ${cv.lastName}` : `${cv.firstName} ${cv.lastName[0]}.`;
}

/**
 * Every non-live token state shares this, byte for byte (D-77): expired,
 * revoked, paused, never existed. It is also the site default, so a dead
 * link is indistinguishable from any other Pitch page in an unfurl.
 */
export const DEAD_LINK_METADATA: Metadata = {
  title: { absolute: 'Pitch Football — every season on the record.' },
  robots: { index: false, follow: false },
};

export function cvMetadata(cv: CvData): Metadata {
  const name = cvDisplayName(cv);
  const positions = (cv.positions as PositionCode[]).map((c) => POSITIONS[c]?.label ?? c).join(' · ');
  // A minor's description carries no club, no age group and no region —
  // the same locator rule as the card, for the same caching reason.
  const detail = [positions, cv.squadNumber ? `#${cv.squadNumber}` : '', isAdultBand(cv) ? cv.club : '']
    .filter(Boolean).join(' · ');
  return {
    title: `${name} — Player CV`,
    description: detail ? `${detail}. A self-reported football record on Pitch.` : 'A self-reported football record on Pitch.',
    robots: { index: false, follow: false },
    openGraph: { title: `${name} — Player CV`, description: detail },
  };
}
