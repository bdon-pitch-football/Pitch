// The closed football vocabulary the build validates against (doc 16).
// §1 and §2 are closed by BUZ, 25 Aug; the stat catalogue lives in TypeScript,
// not Postgres, deliberately (D-70) — adding a key later is a code change with
// zero migration.

// --- Positions (doc 16 §1, D-69) — ten codes, a closed list -----------------
// position_group is DERIVED from positions[0] at read time, never stored.
export const POSITIONS = {
  GK: { label: 'Goalkeeper', group: 'GK' },
  RB: { label: 'Right back', group: 'DEF' },
  CB: { label: 'Centre back', group: 'DEF' },
  LB: { label: 'Left back', group: 'DEF' },
  DM: { label: 'Defensive midfielder', group: 'MID' },
  CM: { label: 'Central midfielder', group: 'MID' },
  // D-92 and doc 16 name this AM. The build said CAM until 16 Sep (0039).
  AM: { label: 'Attacking midfielder', group: 'MID' },
  RW: { label: 'Right wing', group: 'FWD' },
  LW: { label: 'Left wing', group: 'FWD' },
  ST: { label: 'Striker', group: 'FWD' },
} as const;

export type PositionCode = keyof typeof POSITIONS;
export type PositionGroup = (typeof POSITIONS)[PositionCode]['group'] | 'UNSET';

// positions[] is ordered, max 3 (D-69). There is no "finding my position" state.
export const MAX_POSITIONS = 3;

export function positionGroup(positions: readonly string[]): PositionGroup {
  const first = positions[0];
  return first && first in POSITIONS ? POSITIONS[first as PositionCode].group : 'UNSET';
}

// --- Stat catalogue (doc 16 §2, D-70 as amended 27 Aug) ---------------------
// The honesty limit: only what a 15-year-old can genuinely know. Deliberately
// excluded: tackles, interceptions, duels won, saves, pass completion, and
// (since 27 Aug) minutes — it returns as a DERIVED number with D-66.
// No negative statistic exists in the catalogue at all (D-67).
export const STAT_KEYS = ['apps', 'goals', 'assists', 'clean_sheets'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const STAT_LABELS: Record<StatKey, string> = {
  apps: 'Appearances',
  goals: 'Goals',
  assists: 'Assists',
  clean_sheets: 'Clean sheets',
};

// DEFAULT SELECTION, not the renderer (D-105): the builder opens with the
// position set pre-ticked and the player changes it. All four are choosable.
// Choice selects; data decides — the never-zero rule still governs rendering:
// a tile renders only when the value is a positive number. Nothing selected →
// the stats block does not render at all. No empty frame.
export const STAT_SETS: Record<PositionGroup, readonly StatKey[]> = {
  GK: ['apps', 'clean_sheets'],
  DEF: ['apps', 'clean_sheets', 'goals', 'assists'],
  MID: ['apps', 'goals', 'assists'],
  FWD: ['apps', 'goals', 'assists'],
  UNSET: ['apps', 'goals', 'assists'],
};

// --- Provenance (D-62) — never render a number without its source -----------
export const PROVENANCE = ['self_reported', 'coach_verified', 'official_import'] as const;
export type Provenance = (typeof PROVENANCE)[number];

// The words the tag is displayed as, one per value in the domain above, so
// that adding a fourth value cannot compile without a word for it. Every
// surface that renders a number reads its label from here and never types
// one: a literal is how a coach-verified number ends up under "Self-reported".
export const PROVENANCE_LABELS: Record<Provenance, string> = {
  self_reported: 'Self-reported',
  coach_verified: 'Coach-verified',
  official_import: 'Official import',
};

// An out-of-domain value cannot come from the database — player_stat and
// record_entry both constrain the column to the three above — so this is the
// belt behind the braces, and it reads as the WEAKEST claim rather than
// silently inheriting a stronger one.
const known = (p: string | null | undefined): Provenance =>
  (PROVENANCE as readonly string[]).includes(p ?? '') ? (p as Provenance) : 'self_reported';

export const provenanceLabel = (p: string | null | undefined): string => PROVENANCE_LABELS[known(p)];

// The tag belongs to the NUMBER, not to the block. A block may caption itself
// once only while every number under it came from the same place; the moment
// two differ there is no sentence that is true of all of them, so the caller
// tags each number instead — never one averaged label over a mixed block.
// Returns the shared value, or null for "they differ" and for an empty block
// (which renders nothing to caption anyway).
export function sharedProvenance(rows: readonly { provenance?: string | null }[]): Provenance | null {
  if (rows.length === 0) return null;
  const first = known(rows[0].provenance);
  return rows.every((r) => known(r.provenance) === first) ? first : null;
}

// D-160: what an opened stat tile says about where its number came from —
// "Verified by Riverside FC · 2 Sep 2026" or "Self-reported · entered 14 Mar
// 2026". The CLUB, never the coach: the fields this reads are the ones
// fn_stat_public (0083) returns, and none of them can carry a person. Null
// when there is nothing true to say (an official import, or a snapshot
// approved before the dates existed): the tile then does not open.
// The dates arrive as Melbourne calendar dates (YYYY-MM-DD), so they are
// printed as dates, never re-read through a clock or a zone.
const calendarDay = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`;
};
export function provenanceLine(s: { provenance?: string | null; enteredOn?: string; verifiedClub?: string; verifiedOn?: string }): string | null {
  if (s.provenance === 'coach_verified' && s.verifiedClub && s.verifiedOn) return `Verified by ${s.verifiedClub} · ${calendarDay(s.verifiedOn)}`;
  if (s.provenance === 'self_reported' && s.enteredOn) return `${PROVENANCE_LABELS.self_reported} · entered ${calendarDay(s.enteredOn)}`;
  return null;
}

// --- Interest Register club-side status (doc 16 §3d, D-108) -----------------
// Three values, no fourth, and none of them is a verdict. `declined`,
// `rejected` and `unsuccessful` cannot be written — the constraint also lives
// in Postgres; this type is the app-layer mirror.
export const CLUB_STATUSES = ['new', 'shortlisted', 'invited'] as const;
export type ClubStatus = (typeof CLUB_STATUSES)[number];

// --- Clip limits (doc 16 §3c, D-120, D-88) ----------------------------------
// The split is deliberate and has been "corrected" once already: a minor
// cannot be sold anything (D-82), so the tier that cannot be monetised is the
// generous one. Clips added while a minor are grandfathered permanently.
export const CLIP_LIMIT_UNDER_18 = 10;
export const CLIP_LIMIT_ADULT_FREE = 3;
// A coach's reel is a shortlist, not an archive (BUZ, 7 Sep).
export const COACH_CLIP_CAP = 5;

// Sends per sending actor per 24 hours (doc 14 L41, L43). The number itself
// is unruled — U-3 — so it lives here as a single value with a single
// definition, and the tests assert the PROPERTY rather than the figure.
export const SEND_DAILY_CAP = 10;

// --- Experience entry kinds (D-72) ------------------------------------------
// experience_entry grants access to NOBODY, ever: no FK to club, no permission
// surface. A type chip and free text — never a taxonomy of school competitions.
export const EXPERIENCE_KINDS = ['previous_club', 'school', 'futsal', 'representative', 'ntc_academy', 'tournament', 'other'] as const;
export type ExperienceKind = (typeof EXPERIENCE_KINDS)[number];

// A previous club is an experience entry like any other — same table, same
// free text, same nothing-granted (D-72) — but it renders under its own
// heading, because a club season is not the same claim as a futsal summer.
// Splitting it here rather than at the render site keeps every surface
// agreeing about which is which.
export const PREVIOUS_CLUB: ExperienceKind = 'previous_club';
export const OTHER_FOOTBALL_KINDS = EXPERIENCE_KINDS.filter((k) => k !== PREVIOUS_CLUB);

export const EXPERIENCE_KIND_LABELS: Record<ExperienceKind, string> = {
  previous_club: 'Club', school: 'School', futsal: 'Futsal',
  representative: 'Representative', ntc_academy: 'NTC',
  tournament: 'Tournament', other: 'Other',
};

// D-161 — no school reaches a public page for anybody under 18, not as a
// field (D-114 took the field away) and not as an "other football" entry. An
// adult keeps it: a university or a school side is theirs to name.
//
// The RULE is the database's (0061) — the write is refused there, so it holds
// for the next screen somebody builds. These two exist for the two things a
// refused write cannot do: stop offering a chip nobody may use, and stop an
// entry written BEFORE the rule from rendering. The second matters because a
// u16's page is a guardian-approved snapshot (D-119) taken before today, and
// nothing deletes those rows or that snapshot — they are the family's own
// words (D-161 leaves what a family is told to BUZ).
//
// The band is the one the permission layer derived (fn_age_band), carried and
// never computed here. An absent band is treated as a minor — the same
// restrictive default fn_age_band uses for an unknown date of birth.
const ADULT_ONLY_KINDS: readonly ExperienceKind[] = ['school'];
const adultOnly = (kind: string) => ADULT_ONLY_KINDS.includes(kind as ExperienceKind);

/** The "other football" chips a record of this band may be offered. */
export function experienceKindsOffered(band?: string | null): ExperienceKind[] {
  return OTHER_FOOTBALL_KINDS.filter((k) => band === '18plus' || !adultOnly(k));
}

/** The experience entries a page of this band may render, whatever it holds. */
export function renderableExperience<T extends { kind: string }>(entries: T[], band?: string | null): T[] {
  return entries.filter((e) => band === '18plus' || !adultOnly(e.kind));
}
