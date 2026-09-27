// The three house fixtures (doc 16 §3) plus the club-side fixtures (§3b).
// ALL PEOPLE AND CLUBS HERE ARE FICTIONAL, deliberately and checkably so —
// no real minor's data appears in any environment, ever (doc 16 §4).
// Riverside FC, Northern United SC and Kingsway Rovers FC do not exist;
// check before inventing a fourth club.
//
// These are built before any screen because they are the test data every
// screen is built against: Deniz is the happy path, Nate proves a keeper's
// page (D-67, the GK stat set, the 16–17 band), Georgia proves a sparse CV
// and the girls' rows (D-68). No launch asset ships with only Deniz in it.
//
// Dates of birth are chosen so the ages hold through 2026 in
// Australia/Melbourne and exercise the band boundaries in doc 14 §G.

import type { ExperienceKind, PositionCode, Provenance, StatKey } from './football';

export interface FixtureStat {
  season: string;
  key: StatKey;
  value: number;
  provenance: Provenance; // all launch stats are self_reported (D-62)
}

export interface PlayerFixture {
  slug: string;
  firstName: string;
  lastName: string;
  dob: string; // ISO date — age band is ALWAYS derived at read time, never stored
  positions: PositionCode[]; // ordered, max 3 (D-69)
  squadNumber: number;
  foot: 'Left' | 'Right';
  club: string;
  clubCrestPath?: string;  // the CURRENT club's badge — from membership, never typed
  locality?: string;       // 'Brunswick VIC' — the club's, not the child's address
  squad: { name: string; ageGroup: string; competitionGender: 'boys' | 'girls' | 'men' | 'women' | null };
  // Clubs before this one. The player's own account (D-72) — free text, no
  // FK, grants nothing. Never derived from membership: membership only knows
  // clubs that were on Pitch, so deriving it would start everyone's history
  // on the day we launched.
  previousClubs?: { orgName: string; period?: string }[];
  about: string;
  stats: FixtureStat[];
  achievements: { title: string; detail: string }[];
  otherFootball: { kind: ExperienceKind; orgName: string; period: string; note?: string }[];
  highlightsUsed: number; // of CLIP_LIMIT_UNDER_18
  highlights?: { title: string; url: string }[]; // real clips when built
  photoPath?: string; // re-encoded avatar; initials fallback when absent
  // The age band the permission layer derived (fn_age_band) — 'u16',
  // '16_17' or '18plus'. Carried, never computed here and never stored
  // (doc 14 §J1). The page needs it because two things on it are only true
  // of a minor: the parent-approved chip, and who a club is pointed at.
  band?: 'u16' | '16_17' | '18plus';
  surfacedStats: StatKey[]; // D-105 — the player's selection, position set by default
}

export const DENIZ: PlayerFixture = {
  slug: 'deniz',
  firstName: 'Deniz',
  lastName: 'Yılmaz',
  dob: '2012-03-14', // 14 in 2026 — u16 band: guardian approval, no search surface, guardian-held link
  positions: ['AM', 'LW'],
  squadNumber: 10,
  foot: 'Right',
  club: 'Riverside FC',
  locality: 'Brunswick VIC',
  squad: { name: 'U15 Boys', ageGroup: 'U15', competitionGender: 'boys' },
  previousClubs: [{ orgName: 'Brunswick Juniors SC', period: '2019–2023' }],
  about:
    'Right-footed 10 who plays between the lines. Two-footed finisher, working on pressing triggers and weak-foot delivery.',
  stats: [
    { season: '2026', key: 'apps', value: 18, provenance: 'self_reported' },
    { season: '2026', key: 'goals', value: 11, provenance: 'self_reported' },
    { season: '2026', key: 'assists', value: 7, provenance: 'self_reported' },
  ],
  achievements: [
    { title: 'U15 League — Runners up', detail: '2026 season' },
    { title: "Players' Player of the Year", detail: 'Riverside FC, 2025' },
  ],
  otherFootball: [
    { kind: 'school', orgName: 'Northcote High 1st XI', period: '2026' },
    { kind: 'futsal', orgName: 'Melbourne Futsal U15', period: 'Summer 2025–26' },
  ],
  highlightsUsed: 2,
  highlights: [
    { title: 'Season highlights 2026', url: 'https://www.youtube.com/watch?v=dev-deniz-1' },
    { title: 'vs Northern Utd — full performance', url: 'https://www.youtube.com/watch?v=dev-deniz-2' },
  ],
  surfacedStats: ['apps', 'goals', 'assists'],
};

export const NATE: PlayerFixture = {
  slug: 'nate',
  firstName: 'Nate',
  lastName: 'Halloran',
  dob: '2009-06-02', // 17 in 2026 — the 16–17 band: discoverable to verified viewers, guardian off-switch, mediated contact (D-22)
  positions: ['GK'],
  squadNumber: 1,
  foot: 'Right',
  club: 'Northern United SC',
  locality: 'Preston VIC',
  squad: { name: 'U18 Boys', ageGroup: 'U18', competitionGender: 'boys' },
  previousClubs: [
    { orgName: 'Preston Lions FC', period: '2022–2024' },
    { orgName: 'Reservoir Juniors', period: '2018–2021' },
  ],
  about:
    'Reserve keeper pushing for the starting spot. Comfortable playing out under pressure, strong on crosses. Working on my distribution range and commanding the six-yard box.',
  // D-67: no negative number exists on this page. The GK set is two tiles;
  // if that fails the screenshot test the fix is a third number for GK,
  // never a relaxed never-zero rule (doc 16 §2).
  stats: [
    { season: '2026', key: 'apps', value: 22, provenance: 'self_reported' },
    { season: '2026', key: 'clean_sheets', value: 7, provenance: 'self_reported' },
  ],
  achievements: [
    { title: 'NPL U18 squad — 2 seasons', detail: '2025 and 2026' },
    { title: 'Golden Glove, Metro League', detail: 'Northern United SC, 2025' },
  ],
  otherFootball: [
    { kind: 'representative', orgName: 'Victorian Country carnival', period: '2026' },
    { kind: 'futsal', orgName: 'Brunswick Futsal U18', period: 'Summer 2025–26', note: 'outfield' },
  ],
  highlightsUsed: 3,
  highlights: [
    { title: 'Shot-stopping & sweeping 2026', url: 'https://www.youtube.com/watch?v=dev-nate-1' },
    { title: 'Penalty save — Metro League', url: 'https://www.youtube.com/watch?v=dev-nate-2' },
    { title: 'Distribution reel', url: 'https://www.youtube.com/watch?v=dev-nate-3' },
  ],
  surfacedStats: ['apps', 'clean_sheets'],
};

export const GEORGIA: PlayerFixture = {
  slug: 'georgia',
  firstName: 'Georgia',
  lastName: 'Whitcombe',
  dob: '2011-09-21', // 15 in 2026 — u16 band, and the deliberately sparse CV
  positions: ['CM', 'DM'],
  squadNumber: 6,
  foot: 'Left',
  club: 'Kingsway Rovers FC',
  locality: 'Altona VIC',
  // No previous clubs on purpose: Georgia is the sparse CV, and the section
  // must vanish rather than render an empty heading (D-70's rule, applied).

  // competition_gender and age_group live on the SQUAD, never on Georgia (D-68, D-25)
  squad: { name: 'U16 Girls', ageGroup: 'U16', competitionGender: 'girls' },
  about:
    'Left-footed six who likes the ball in tight spaces. Reads the game early and gets on the half-turn. Working on my range of passing and getting into the box more.',
  stats: [
    { season: '2026', key: 'apps', value: 16, provenance: 'self_reported' },
    { season: '2026', key: 'goals', value: 3, provenance: 'self_reported' },
    { season: '2026', key: 'assists', value: 5, provenance: 'self_reported' },
  ],
  achievements: [{ title: 'Club Player of the Year — U15 Girls', detail: 'Kingsway Rovers FC, 2025' }],
  otherFootball: [
    { kind: 'school', orgName: 'Point Cook Senior College', period: '2026' },
    { kind: 'futsal', orgName: 'Werribee summer league', period: '2025–26' },
  ],
  highlightsUsed: 1, // deliberately thin — does a modest CV still look worth sending?
  highlights: [
    { title: 'Season highlights 2026', url: 'https://www.youtube.com/watch?v=dev-georgia-1' },
  ],
  surfacedStats: ['apps', 'goals', 'assists'],
};

// The adult. There was no 18+ player fixture at all, so the one band whose
// page is assembled live with NO guardian anywhere in it could only be seen
// by creating an account by hand — which meant the differences nobody had
// looked at: no parent-approved chip, no "there is no way to reply" block,
// and a record that is the player's own with no approval step between them
// and their page.
export const JORDAN: PlayerFixture = {
  slug: 'jordan',
  firstName: 'Jordan',
  lastName: 'Abebe',
  dob: '2004-02-19', // 22 in 2026 — 18plus: own account, no guardian, live assembly
  positions: ['ST', 'LW'],
  squadNumber: 9,
  foot: 'Left',
  club: 'Coburg City FC',
  locality: 'Coburg VIC',
  squad: { name: 'Seniors Men', ageGroup: 'SEN', competitionGender: 'men' },
  previousClubs: [
    { orgName: 'Pascoe Vale SC', period: '2023–2025' },
    { orgName: 'Moreland Zebras FC', period: '2021–2023' },
  ],
  about:
    'Left-footed nine who runs the channel and finishes early. Four seasons of senior football, looking for a step up in level for 2027.',
  stats: [
    { season: '2026', key: 'apps', value: 24, provenance: 'self_reported' },
    { season: '2026', key: 'goals', value: 16, provenance: 'self_reported' },
    { season: '2026', key: 'assists', value: 6, provenance: 'self_reported' },
  ],
  achievements: [
    { title: 'Golden Boot — State League 2', detail: 'Coburg City FC, 2026' },
    { title: 'Promotion winners', detail: '2025 season' },
  ],
  otherFootball: [
    { kind: 'representative', orgName: 'FV State League All-Stars', period: '2026' },
    // The adult half of D-161: a school or university side still renders on
    // an 18+ page, and only there. The under-18 half is exercised by Deniz's
    // and Georgia's school entries, which the database now refuses to write
    // and no page renders. 'Riverside' is one of the fictional names already
    // in the seed (L15) — there is no Riverside University.
    { kind: 'school', orgName: 'Riverside University 1st XI', period: '2023–2025' },
  ],
  highlightsUsed: 2,
  highlights: [
    { title: 'Season highlights 2026', url: 'https://www.youtube.com/watch?v=dev-jordan-1' },
    { title: 'Movement & finishing reel', url: 'https://www.youtube.com/watch?v=dev-jordan-2' },
  ],
  surfacedStats: ['apps', 'goals', 'assists'],
};

export const PLAYER_FIXTURES = [DENIZ, NATE, GEORGIA, JORDAN] as const;

// --- Club-side fixtures (doc 16 §3b) — the D-93 role split, exercised -------
export interface ClubSideFixture {
  slug: string;
  firstName: string;
  lastName: string;
  role: 'coach' | 'technical_director' | 'team_manager' | 'club_admin';
  club: string;
  squad?: string;
  note: string;
}

export const CLUB_SIDE_FIXTURES: ClubSideFixture[] = [
  {
    slug: 'sam',
    firstName: 'Sam',
    lastName: 'Kaya',
    role: 'coach',
    club: 'Riverside FC',
    squad: 'U15 Boys',
    note: 'Verified coach, squad-scoped access — sees his squad and no other.',
  },
  {
    slug: 'marina',
    firstName: 'Marina',
    lastName: 'Petrovic',
    role: 'technical_director',
    club: 'Riverside FC',
    note: 'Club-wide development access. Her coach CV renders "Technical Director, Riverside FC" — not a fourth profile type (D-93).',
  },
  {
    slug: 'ash',
    firstName: 'Ash',
    lastName: 'Nguyen',
    role: 'team_manager',
    club: 'Riverside FC',
    squad: 'U16 Boys',
    note: 'Needs no product at launch; exists so the role is real in the data.',
  },
  {
    slug: 'registrar',
    firstName: 'Robyn',
    lastName: 'Callister',
    role: 'club_admin',
    club: 'Riverside FC',
    note: 'THE NEGATIVE FIXTURE. A club_admin must fail every development-record read (doc 14 §H11, §J13) — the only way to know it is prevented is to have one trying.',
  },
];
