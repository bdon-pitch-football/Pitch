// Saving a CV draft (D-70, D-105, D-119). Two rules carried here:
// 1. NEVER coerce blank to 0 — an absent stat is null, absent, unrendered.
//    A keeper, a new player and a striker in a drought must stay distinct.
// 2. For an under-16 the saved draft becomes/updates the PENDING profile
//    version. The approved version — what a link-holder sees — is untouched
//    until the guardian approves the change. No job ever auto-publishes.
import 'server-only';
import { db } from './db';
import { MAX_POSITIONS, STAT_KEYS, type StatKey } from './football';
import { editWaitingEmail } from './messages';
import { send } from './messaging';

export interface CvDraft {
  positions: string[];
  squadNumber: number | null;
  foot: 'Left' | 'Right' | null;
  about: string;
  surfacedStats: StatKey[];
  stats: Partial<Record<StatKey, number | null>>; // null/undefined = not entered
  season: string;
}

export async function saveCvDraft(recordId: string, draft: CvDraft): Promise<void> {
  const positions = draft.positions.slice(0, MAX_POSITIONS);
  const client = await db.connect();
  try {
    await client.query('begin');
    await client.query(
      `update development_record set positions=$2, squad_number=$3, foot=$4, about=$5, surfaced_stats=$6 where id=$1`,
      [recordId, positions, draft.squadNumber, draft.foot, draft.about.trim() || null, draft.surfacedStats],
    );
    for (const key of STAT_KEYS) {
      const v = draft.stats[key];
      if (typeof v === 'number' && v >= 0) {
        await client.query(
          `insert into player_stat (record_id, season, stat_key, value, provenance)
           values ($1,$2,$3,$4,'self_reported')
           on conflict (record_id, season, stat_key) where source_experience_id is null
           do update set value = excluded.value`,
          [recordId, draft.season, key, v],
        );
      } else {
        // blank means absent — the row is removed, never zeroed
        await client.query(
          `delete from player_stat where record_id=$1 and season=$2 and stat_key=$3 and source_experience_id is null`,
          [recordId, draft.season, key],
        );
      }
    }

    // Age-band branch (computed, never stored): u16 saves land as the
    // pending version; 16-17/18+ edit the live record directly (D-119).
    const band = await client.query(
      `select fn_age_band(p.dob) as band from development_record dr join person p on p.id = dr.person_id where dr.id = $1`,
      [recordId],
    );
    if (band.rows[0]?.band === 'u16') {
      const content = await buildSnapshot(client, recordId, draft.season);
      await client.query(
        `insert into profile_version (record_id, content, status)
         values ($1, $2, 'pending')
         on conflict (record_id) where status = 'pending'
         do update set content = excluded.content, created_at = now()`,
        [recordId, JSON.stringify(content)],
      );
      await client.query(
        `insert into consent_event (event, subject_id, detail)
         select 'edit_submitted', p.id, jsonb_build_object('record_id', $1::uuid)
         from development_record dr join person p on p.id = dr.person_id where dr.id = $1`,
        [recordId],
      );
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }

  // doc 15 §30: tell the guardian an edit is waiting. Once — there is no
  // reminder and no timeout that publishes it (doc 14 §R7).
  const g = await db.query(
    `select p2.email, c.first_name from development_record dr
     join person c on c.id = dr.person_id
     join guardianship_link gl on gl.child_id = c.id and gl.approved_at is not null and gl.revoked_at is null
     join person p2 on p2.id = gl.guardian_id
     where dr.id = $1 and p2.email is not null limit 1`,
    [recordId],
  );
  if (g.rows[0]) {
    await send(editWaitingEmail(g.rows[0].first_name, recordId), { address: g.rows[0].email });
  }
}

// Guardian approves the pending version: it becomes the approved one, the
// old approved version is superseded — in one transaction. Silence would
// have kept the old page live forever (doc 14 §R7).
export async function approvePendingVersion(recordId: string, guardianId: string): Promise<boolean> {
  const client = await db.connect();
  try {
    await client.query('begin');
    const pending = await client.query(
      `select id from profile_version where record_id=$1 and status='pending' for update`,
      [recordId],
    );
    if (pending.rows.length === 0) {
      await client.query('rollback');
      return false;
    }
    await client.query(`update profile_version set status='superseded' where record_id=$1 and status='approved'`, [recordId]);
    await client.query(
      `update profile_version set status='approved', approved_by=$2, approved_at=now() where id=$1`,
      [pending.rows[0].id, guardianId],
    );
    await client.query(
      `insert into consent_event (event, actor_id, detail) values ('edit_approved', $2, jsonb_build_object('record_id', $1::uuid))`,
      [recordId, guardianId],
    );
    await client.query('commit');
    return true;
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}

type Client = { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

// The renderable snapshot (same shape PlayerCV consumes).
async function buildSnapshot(client: Client, recordId: string, season: string) {
  const { rows } = await client.query(
    `select
      (select row_to_json(x) from (
        select p.first_name as "firstName", coalesce(p.last_name,'') as "lastName", p.photo_path as "photoPath",
               dr.positions, dr.squad_number as "squadNumber", dr.foot, coalesce(dr.about,'') as about,
               dr.surfaced_stats as "surfacedStats"
        from development_record dr join person p on p.id = dr.person_id where dr.id = $1) x) as core,
      (select coalesce(json_agg(json_build_object('season', season, 'key', stat_key, 'value', value, 'provenance', provenance)), '[]'::json)
        from player_stat where record_id = $1 and value > 0) as stats,
      (select coalesce(json_agg(json_build_object('title', title, 'detail', detail) order by sort), '[]'::json)
        from achievement where record_id = $1) as achievements,
      -- No school on an under-18's page (D-161, 0061). Asked of the database
      -- here too, so a snapshot approved from today carries none — the same
      -- question the live assembly asks, in the same words.
      (select coalesce(json_agg(json_build_object('kind', kind, 'orgName', org_name, 'period', season_label, 'note', notes)), '[]'::json)
        from experience_entry where record_id = $1 and kind <> 'previous_club'
          and fn_experience_public($1, kind)) as other,
      (select coalesce(json_agg(json_build_object('orgName', org_name, 'period', season_label) order by season_label desc nulls last, created_at desc), '[]'::json)
        from experience_entry where record_id = $1 and kind = 'previous_club') as previous_clubs,
      -- The club, the squad and the club's own locality. These were NOT in
      -- the snapshot, and the fixture hid it by writing its own: every real
      -- u16 approved page rendered " — · Melbourne VIC" with no club name,
      -- because the snapshot IS the page for that band (D-119). The locality
      -- is the CLUB's suburb and state — never the child's address, which we
      -- do not hold.
      (select row_to_json(y) from (
        select c.name as club, c.crest_path as "clubCrestPath", c.suburb, c.state,
               s.name as squad_name, s.age_group, s.competition_gender
        from development_record dr
        join membership m on m.person_id = dr.person_id and m.role = 'player' and m.ended_at is null
        join club c on c.id = m.club_id
        left join squad s on s.id = m.squad_id
        where dr.id = $1 limit 1) y) as membership,
      (select coalesce(json_agg(json_build_object('title', title, 'url', url) order by added_at), '[]'::json)
        from highlight where record_id = $1) as highlights`,
    [recordId],
  );
  const r = rows[0] as {
    core: Record<string, unknown>; stats: unknown; achievements: unknown; other: unknown;
    highlights: unknown[]; previous_clubs: unknown;
    membership: { club: string; clubCrestPath: string | null; suburb: string | null; state: string | null;
                  squad_name: string | null; age_group: string | null; competition_gender: string | null } | null;
  };
  const m = r.membership;
  return {
    slug: 'live', dob: '',
    club: m?.club ?? '',
    clubCrestPath: m?.clubCrestPath ?? undefined,
    locality: [m?.suburb, m?.state].filter(Boolean).join(' ') || undefined,
    squad: {
      name: m?.squad_name ?? '',
      ageGroup: m?.age_group ?? '',
      competitionGender: (m?.competition_gender ?? null) as 'boys' | 'girls' | 'men' | 'women' | null,
    },
    highlightsUsed: r.highlights.length, season,
    ...r.core,
    stats: r.stats, achievements: r.achievements, otherFootball: r.other,
    previousClubs: r.previous_clubs, highlights: r.highlights,
  };
}
