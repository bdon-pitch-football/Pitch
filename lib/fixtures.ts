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
  slug: 'deniz' | 'nate' | 'georgia';
  firstName: string;
  lastName: string;
  dob: string; // ISO date — age band is ALWAYS derived at read time, never stored
  positions: PositionCode[]; // ordered, max 3 (D-69)
  squadNumber: number;
  foot: 'Left' | 'Right';
  club: string;
  squad: { name: string; ageGroup: string; competitionGender: 'boys' | 'girls' | 'mixed' | 'open' };
  about: string;
  stats: FixtureStat[];
  achievements: { title: string; detail: string }[];
  otherFootball: { kind: ExperienceKind; orgName: string; period: string; note?: string }[];
  highlightsUsed: number; // of CLIP_LIMIT_UNDER_18
  surfacedStats: StatKey[]; // D-105 — the player's selection, position set by default
}

export const DENIZ: PlayerFixture = {
  slug: 'deniz',
  firstName: 'Deniz',
  lastName: 'Yılmaz',
  dob: '2012-03-14', // 14 in 2026 — u16 band: guardian approval, no search surface, guardian-held link
  positions: ['CAM', 'LW'],
  squadNumber: 10,
  foot: 'Right',
  club: 'Riverside FC',
  squad: { name: 'U15 Boys', ageGroup: 'U15', competitionGender: 'boys' },
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
  squad: { name: 'U18 Boys', ageGroup: 'U18', competitionGender: 'boys' },
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
  surfacedStats: ['apps', 'goals', 'assists'],
};

export const PLAYER_FIXTURES = [DENIZ, NATE, GEORGIA] as const;

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
