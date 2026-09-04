// Saving a CV draft (D-70, D-105, D-119). Two rules carried here:
// 1. NEVER coerce blank to 0 — an absent stat is null, absent, unrendered.
//    A keeper, a new player and a striker in a drought must stay distinct.
// 2. For an under-16 the saved draft becomes/updates the PENDING profile
//    version. The approved version — what a link-holder sees — is untouched
//    until the guardian approves the change. No job ever auto-publishes.
import 'server-only';
import { db } from './db';
import { MAX_POSITIONS, STAT_KEYS, type StatKey } from './football';

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
      (select coalesce(json_agg(json_build_object('kind', kind, 'orgName', org_name, 'period', season_label, 'note', notes)), '[]'::json)
        from experience_entry where record_id = $1) as other,
      (select coalesce(json_agg(json_build_object('title', title, 'url', url) order by added_at), '[]'::json)
        from highlight where record_id = $1) as highlights`,
    [recordId],
  );
  const r = rows[0] as { core: Record<string, unknown>; stats: unknown; achievements: unknown; other: unknown; highlights: unknown[] };
  return {
    slug: 'live', dob: '', club: '', squad: { name: '', ageGroup: '', competitionGender: 'mixed' },
    highlightsUsed: r.highlights.length, season,
    ...r.core,
    stats: r.stats, achievements: r.achievements, otherFootball: r.other, highlights: r.highlights,
  };
}
