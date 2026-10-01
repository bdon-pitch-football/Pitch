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
import { isPlayerPhotoOf, PHOTO_STILL_SHOWN } from './player-photo';
import { removeImage } from './storage';

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
  // The photo the pending version named before this save rewrote it, if any.
  let replaced: string | null = null;
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
      replaced = ((await client.query(
        `select content ->> 'photoPath' as photo from profile_version where record_id = $1 and status = 'pending'`,
        [recordId],
      )).rows[0]?.photo as string | null | undefined) ?? null;
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
  await forgetPlayerPhoto(recordId, replaced);

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
  // The photo the outgoing approved version named: once it is superseded it
  // may be nothing anyone is shown, and then it goes (after the commit).
  let replaced: string | null = null;
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
    replaced = ((await client.query(
      `select content ->> 'photoPath' as photo from profile_version where record_id=$1 and status='approved'`,
      [recordId],
    )).rows[0]?.photo as string | null | undefined) ?? null;
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
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  await forgetPlayerPhoto(recordId, replaced);
  return true;
}

/**
 * A guardian's photo for an under-16 is its own approval (John F14, with
 * BUZ's go, 1 Oct). D-119 sends a CHILD's edit back to a guardian; it never
 * meant a guardian approving themselves. So a photo a guardian uploads goes
 * straight onto the approved page — and onto the pending version too, if the
 * child has one waiting, or approving that later would put the old photo
 * back. Only the photo moves: the rest of the live record may hold the
 * child's unapproved edits, and those still wait.
 *
 * Logged as edit_approved with the guardian as the actor and the child as
 * the subject, so the family history shows it on the existing approved-change
 * line until BUZ approves words of its own (John proposes "{guardian first
 * name} changed the page."). No message to anyone: approving a child's edit
 * sends none today, so neither does this, and no edit-waiting email goes to
 * the guardian who did it.
 *
 * An under-16 with no approved page yet has nothing to publish onto: the
 * photo stays on the live record and the pending version, and the first
 * approval carries it. Nothing here creates a page.
 *
 * Returns the photos the two versions named before, for forgetPlayerPhoto.
 * The caller holds the authorisation (recordActor 'guardian'); it is asked
 * again here, with the band, inside the transaction.
 */
export async function publishGuardianPhoto(recordId: string, guardianId: string, path: string): Promise<string[]> {
  const replaced: string[] = [];
  const client = await db.connect();
  try {
    await client.query('begin');
    const who = await client.query(
      `select dr.person_id, fn_age_band(p.dob) = 'u16' and fn_record_actor($2, $1) = 'guardian' as ok
       from development_record dr join person p on p.id = dr.person_id where dr.id = $1`,
      [recordId, guardianId],
    );
    if (!who.rows[0]?.ok) {
      await client.query('rollback');
      return [];
    }
    const versions = await client.query(
      `select status, content ->> 'photoPath' as photo from profile_version
       where record_id = $1 and status in ('approved', 'pending') for update`,
      [recordId],
    );
    for (const v of versions.rows) if (v.photo) replaced.push(v.photo as string);
    await client.query(
      `update profile_version set content = jsonb_set(content, '{photoPath}', to_jsonb($2::text))
       where record_id = $1 and status in ('approved', 'pending')`,
      [recordId, path],
    );
    if (versions.rows.some((v) => v.status === 'approved')) {
      await client.query(
        `insert into consent_event (event, actor_id, subject_id, detail)
         values ('edit_approved', $2, $3, jsonb_build_object('record_id', $1::uuid, 'photo', true))`,
        [recordId, guardianId, who.rows[0].person_id],
      );
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  return replaced;
}

/**
 * Delete a player photo this record has stopped showing (S-3, 1 Oct).
 *
 * Called with the path something just stopped naming: the live record's
 * photo when a new one is uploaded, the pending version's when a save
 * rewrites it, the approved version's when the guardian approves the next.
 * It goes only if it is this record's own player photo and nothing that can
 * still be shown names it — never the photo an approved snapshot uses, which
 * would 404 on every club's screen. A child's face does not stay in the
 * bucket once nothing shows it (pillar zero, data minimisation).
 *
 * Never throws. It runs after the real work has committed, outside any
 * db.connect() (L1); a delete that fails leaves a file nothing points at,
 * which is the state before this existed, and must not turn a saved photo
 * or a guardian's approval into an error.
 */
export async function forgetPlayerPhoto(recordId: string, path: string | null | undefined): Promise<void> {
  if (!path || !isPlayerPhotoOf(recordId, path)) return;
  try {
    const { rows } = await db.query(PHOTO_STILL_SHOWN, [path]);
    if (rows[0]?.shown !== false) return;
    await removeImage(path);
  } catch {
    // left behind, unreferenced; see above
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
      -- D-160: the stats as a page may show them — source, dates, the
      -- verifying CLUB, never the coach — so the version a guardian approves
      -- carries a verification the same way the live page does (0083).
      fn_stat_public($1) as stats,
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
