// THE single tokenised read path (D-80). Every surface that renders a record
// to a token holder — the CV page, the OG image, the link-state page, the
// PDF export — calls THIS module and nothing else. The permission decision
// itself lives in Postgres (fn_token_read, migration 0003); this file only
// carries the answer. No other file may query record data for a token.
//
// Dead links: expired, revoked, paused, guardian-disabled and never-existed
// all return the same null. The route renders one identical page for all of
// them (D-77) — no branch in here may distinguish them.
import 'server-only';
import { createHash } from 'node:crypto';
import { db } from './db';
import type { PlayerFixture } from './fixtures';

export type CvData = PlayerFixture;

export async function readCvByToken(rawToken: string): Promise<CvData | null> {
  // tokens are >=128-bit random strings; anything absurd is dead without a query
  if (!rawToken || rawToken.length > 200) return null;
  const hash = createHash('sha256').update(rawToken).digest();

  const { rows } = await db.query('select fn_token_read($1) as bundle', [hash]);
  const bundle = rows[0]?.bundle as
    | { record_id: string; person_id: string; band: string; approved_content: CvData | null }
    | null;
  if (!bundle) return null;

  // u16: the guardian-approved snapshot is the page (D-119)
  if (bundle.approved_content) return bundle.approved_content;

  // 16–17 / 18+: assemble the live record. One round trip, all sub-queries
  // scoped by the record id that fn_token_read already authorised.
  const r = await db.query(
    `select
      (select row_to_json(x) from (
        select p.first_name, p.photo_path, p.last_name, dr.positions, dr.squad_number, dr.foot, dr.about, dr.surfaced_stats
        from development_record dr join person p on p.id = dr.person_id
        where dr.id = $1) x) as core,
      (select coalesce(json_agg(json_build_object('season', season, 'key', stat_key, 'value', value, 'provenance', provenance)), '[]'::json)
        from player_stat where record_id = $1 and value > 0) as stats,
      (select coalesce(json_agg(json_build_object('title', title, 'detail', detail) order by sort), '[]'::json)
        from achievement where record_id = $1) as achievements,
      (select coalesce(json_agg(json_build_object('kind', kind, 'orgName', org_name, 'period', season_label, 'note', notes)), '[]'::json)
        from experience_entry where record_id = $1 and kind <> 'previous_club') as other,
      (select coalesce(json_agg(json_build_object('orgName', org_name, 'period', season_label) order by season_label desc nulls last, created_at desc), '[]'::json)
        from experience_entry where record_id = $1 and kind = 'previous_club') as previous_clubs,
      (select coalesce(json_agg(json_build_object('title', title, 'url', url) order by added_at), '[]'::json)
        from highlight where record_id = $1) as highlights,
      (select row_to_json(y) from (
        select c.name as club, c.crest_path as "clubCrestPath", c.suburb, c.state,
               s.name as squad_name, s.age_group, s.competition_gender
        from membership m join club c on c.id = m.club_id left join squad s on s.id = m.squad_id
        where m.person_id = $2 and m.role = 'player' and m.ended_at is null limit 1) y) as membership`,
    [bundle.record_id, bundle.person_id],
  );
  const row = r.rows[0];
  if (!row?.core) return null;

  return {
    slug: 'live',
    band: bundle.band as CvData['band'],
    firstName: row.core.first_name,
    photoPath: row.core.photo_path ?? undefined,
    lastName: row.core.last_name ?? '',
    dob: '',
    positions: row.core.positions,
    squadNumber: row.core.squad_number,
    foot: row.core.foot,
    club: row.membership?.club ?? '',
    clubCrestPath: row.membership?.clubCrestPath ?? undefined,
    // The club's suburb and state. Never the child's — we do not hold an
    // address for a player and this line must not start looking like one.
    locality: [row.membership?.suburb, row.membership?.state].filter(Boolean).join(' ') || undefined,
    squad: {
      name: row.membership?.squad_name ?? '',
      ageGroup: row.membership?.age_group ?? '',
      competitionGender: row.membership?.competition_gender ?? 'mixed',
    },
    about: row.core.about ?? '',
    stats: row.stats,
    achievements: row.achievements,
    otherFootball: row.other,
    previousClubs: row.previous_clubs,
    highlights: row.highlights,
    highlightsUsed: row.highlights.length,
    surfacedStats: row.core.surfaced_stats,
  };
}
