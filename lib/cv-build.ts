// Saving a CV draft (D-70, D-105, D-119). Two rules carried here:
// 1. NEVER coerce blank to 0 — an absent stat is null, absent, unrendered.
//    A keeper, a new player and a striker in a drought must stay distinct.
// 2. For an under-16 the saved draft becomes/updates the PENDING profile
//    version. The approved version — what a link-holder sees — is untouched
//    until the guardian approves the change. No job ever auto-publishes.
// 3. Unless the guardian made it (F14; John, 1 Oct): "D-119 exists so that a
//    child's edit returns to a guardian. It was never meant to make a
//    guardian approve themselves." A guardian's own change publishes as the
//    approved version at once, with that guardian as the actor, and nobody
//    is emailed that something waits — nothing does. ONLY that change
//    (BUZ, 2 Oct, "parent's change only"; John confirmed): it is patched
//    onto the page, and nothing the child added rides with it.
import 'server-only';
import { db } from './db';
import { MAX_POSITIONS, POSITIONS, STAT_KEYS, type StatKey } from './football';
import { editWaitingEmail } from './messages';
import { send } from './messaging';
import type { RecordActor } from './record-guard';
import { isPlayerPhotoOf, PHOTO_STILL_SHOWN } from './player-photo';
import { isWaiting } from './pending-diff';
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

// `author` is who the database said may write this record
// (requireRecordAuthor, 0169): the child themselves, or an under-16's
// guardian. It decides only what happens to an under-16's versions.
export async function saveCvDraft(recordId: string, draft: CvDraft, author: { personId: string; actor: RecordActor }): Promise<void> {
  // Only the ten positions (D-92): the schema leaves the domain to TS, and a
  // posted value is text a club reads on the CV (C-P4 safety review N-5).
  const positions = [...new Set(draft.positions.map((v) => v.trim().toUpperCase()))].filter((v) => v in POSITIONS).slice(0, MAX_POSITIONS);
  // Only a child's own under-16 edit waits on a guardian, so only that one
  // tells a guardian it is waiting (doc 15 §30). A 16–17's or an adult's
  // edit publishes and waits on nobody (D-119, doc 14 R8), and a guardian's
  // own edit is its own approval (F14).
  let waitsOnGuardian = false;
  // The photos the versions named before this save rewrote them, if any (S-3).
  const replaced: string[] = [];
  const client = await db.connect();
  try {
    await client.query('begin');
    // The record's lock first, as every writer of a version takes it (one
    // order, no deadlock), and the age band asked under it — computed, never
    // stored: u16 saves land as the pending version; 16-17/18+ edit the live
    // record directly (D-119).
    const band = (await client.query(
      `select fn_age_band(p.dob) as band from development_record dr join person p on p.id = dr.person_id
       where dr.id = $1 for update of dr`,
      [recordId],
    )).rows[0]?.band as string | undefined;
    const guardianOfU16 = band === 'u16' && author.actor === 'guardian';
    // A guardian's change is what they CHANGED (safety review of "parent's
    // change only", B-1, 2 Oct). The form is prefilled from the live record —
    // for an under-16 with a change waiting, that is the child's unreviewed
    // draft — and posts every field, so a parent who fixed the squad number
    // published the child's waiting About as theirs. So the form's fields are
    // read before the write and after it, and only what moved is published.
    const before = guardianOfU16 ? await formState(client, recordId, draft.season) : null;
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

    if (guardianOfU16 && before) {
      // F14: the guardian's own edit is its own approval — the fields and
      // stats they changed, and nothing else on the page (parent's change
      // only). A save that changes nothing publishes nothing and logs
      // nothing. The photos the versions named before it are collected, and
      // forgotten after commit.
      const patch = await formPatch(client, recordId, draft.season, before, await formState(client, recordId, draft.season));
      if (patch) replaced.push(...(await publishPatch(client, recordId, author.personId, patch, draft.season)).replaced);
    } else if (band === 'u16') {
      const submitted = await submitChildChange(client, recordId, draft.season);
      replaced.push(...submitted.replaced);
      waitsOnGuardian = submitted.tell;
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  for (const r of replaced) await forgetPlayerPhoto(recordId, r);

  // doc 15 §30: tell the guardians an edit is waiting. Once — there is no
  // reminder and no timeout that publishes it (doc 14 §R7). EVERY approved,
  // unrevoked guardian, one message each (D-51, "both notified"; John, 2 Oct):
  // this went to one of them only (`limit 1`), so a second parent never
  // learned a change was waiting on them.
  if (!waitsOnGuardian) return;
  await tellGuardiansItWaits(recordId);
}

/**
 * An under-16's own change, of any kind, becomes the waiting version (D-119):
 * the record as it now stands, for a guardian to see whole on /g/pending and
 * approve or not. One path for every write a child makes for themselves — the
 * build form, a clip, an achievement, other football, the photo (John's
 * original intent; BUZ, 2 Oct, now that the parent sees every change) — so a
 * clip or a photo never again waits unseen on the live record to ride the
 * next save. On the caller's transaction, under the record's lock. Returns
 * the photo the waiting version named before, to forget after commit.
 */
async function submitChildChange(client: Client, recordId: string, season: string): Promise<{ replaced: string[]; tell: boolean }> {
  const content = await buildSnapshot(client, recordId, season);
  const versions = (await client.query(
    `select status, content from profile_version where record_id = $1 and status in ('approved', 'pending')`,
    [recordId],
  )).rows as { status: string; content: Record<string, unknown> }[];
  const approved = versions.find((v) => v.status === 'approved')?.content ?? null;
  const before = versions.find((v) => v.status === 'pending')?.content ?? null;
  const was = (before?.photoPath as string | null | undefined) ?? null;

  // A write that leaves nothing for a guardian to see — an add then a remove,
  // a change only to which stats are shown — is not a waiting version (the
  // one answer, lib/pending-diff; safety review of the review, N-3). Any
  // version that was waiting goes, nothing is sent and nothing new is
  // logged, so a child looping add and remove cannot flood their parents.
  // Nothing is lost: the live record keeps the change, and the next version
  // that does wait is built from it.
  if (!isWaiting(approved, content)) {
    await client.query(`delete from profile_version where record_id = $1 and status = 'pending'`, [recordId]);
    return { replaced: was ? [was] : [], tell: false };
  }

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
  // doc 15 §30 goes ONCE per waiting version (Leo, 2 Oct): when this write
  // first makes the version one a guardian must see — never again as the
  // child's later writes update the same waiting version.
  const tell = !isWaiting(approved, before);
  return { replaced: was ? [was] : [], tell };
}

/**
 * The records among these with a change waiting on a guardian — ONE answer
 * for every surface that says so: the parent's /home, the review on
 * /g/pending, the child's "Your parent will see this change", the preview's
 * waiting line, and the §30 email (Leo, 2 Oct). A waiting version waits only
 * if it differs from the approved page in something the review draws
 * (lib/pending-diff): not the club or squad line, which comes from the
 * membership and not from the child, and not which stats are shown, which
 * carries nothing the child wrote and rides the next approval. Map: record id
 * → when the waiting version was last written.
 */
export async function waitingRecords(recordIds: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = recordIds.filter(Boolean);
  if (ids.length === 0) return out;
  const { rows } = await db.query(
    `select record_id::text as record_id, status, content, created_at from profile_version
     where record_id = any($1::uuid[]) and status in ('approved', 'pending')`,
    [ids],
  );
  const byRecord = new Map<string, { approved?: Record<string, unknown>; pending?: Record<string, unknown>; at?: string }>();
  for (const r of rows as { record_id: string; status: string; content: Record<string, unknown>; created_at: string }[]) {
    const v = byRecord.get(r.record_id) ?? {};
    if (r.status === 'approved') v.approved = r.content;
    else { v.pending = r.content; v.at = r.created_at; }
    byRecord.set(r.record_id, v);
  }
  for (const [id, v] of byRecord) if (v.pending && isWaiting(v.approved ?? null, v.pending)) out.set(id, v.at!);
  return out;
}

// doc 15 §30, after the commit (L1): every approved, unrevoked guardian with
// an address, one message each.
async function tellGuardiansItWaits(recordId: string): Promise<void> {
  const g = await db.query(EDIT_WAITING_TO, [recordId]);
  for (const r of g.rows as { email: string; first_name: string }[]) {
    await send(editWaitingEmail(r.first_name, recordId), { address: r.email });
  }
}

/** Who doc 15 §30 goes to: every approved, unrevoked guardian with an address, once each. */
export const EDIT_WAITING_TO = `
  select distinct on (p2.email) p2.email, c.first_name from development_record dr
  join person c on c.id = dr.person_id
  join guardianship_link gl on gl.child_id = c.id and gl.approved_at is not null and gl.revoked_at is null
  join person p2 on p2.id = gl.guardian_id
  where dr.id = $1 and p2.email is not null
  order by p2.email`;

// Guardian approves the pending version: it becomes the approved one, the
// old approved version is superseded — in one transaction. Silence would
// have kept the old page live forever (doc 14 §R7).
//
// The version approved is the one the guardian was shown: `version` is
// "{pending id}:{md5 of its content}" as /g/pending drew it, and a waiting
// version that has moved since — the child saved again — is refused, so a
// press can never publish something the page did not show (BUZ, 2 Oct).
export async function approvePendingVersion(recordId: string, guardianId: string, version: string): Promise<boolean> {
  // The photo the outgoing approved version named: once it is superseded it
  // may be nothing anyone is shown, and then it goes (after the commit).
  let replaced: string | null = null;
  const client = await db.connect();
  try {
    await client.query('begin');
    // The record's lock first, the order every version writer takes
    // (safety review of "parent's change only", S-2): a guardian's patch and
    // this approval, pressed in the same second, queue rather than deadlock.
    await client.query('select 1 from development_record where id = $1 for update', [recordId]);
    const [shownId, shownHash] = version.split(':');
    const pending = await client.query(
      `select id from profile_version where record_id=$1 and status='pending'
         and id::text = $2 and md5(content::text) = $3 for update`,
      [recordId, shownId ?? '', shownHash ?? ''],
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
    // The child is its subject (John, 2 Oct; D-51), so the approval reaches
    // the family history: "You approved a change" for the approver, and
    // "{first name} approved a change." for the other guardian (BUZ, 2 Oct;
    // fn_consent_timeline). It used to carry no child, and reached no one.
    await client.query(
      `insert into consent_event (event, actor_id, subject_id, detail)
       select 'edit_approved', $2, dr.person_id, jsonb_build_object('record_id', $1::uuid)
       from development_record dr where dr.id = $1`,
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

type Client = { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }> };
export type RecordClient = Client;

/**
 * One write to a page's clips, achievements or other football, and — when an
 * under-16's guardian made it — its publication, in ONE transaction with the
 * record's lock taken first (safety review of "parent's change only", S-2).
 *
 * They were two: the live insert or delete committed, then the publication
 * ran in a fresh transaction. A guardian's removal pressed in the same second
 * as the other guardian's Approve could lose the publication to a deadlock
 * after the live row was already gone — the clip still on every club's page,
 * and nothing left on /build/clips to press — and an add could land twice in
 * the waiting version if the child's own save copied it across in between.
 * Now the write and its patch commit together or not at all, in the lock
 * order every version writer takes (the record, then its versions).
 *
 * `write` does the live write on the client it is handed and returns the
 * guardian's patch (null: nothing to publish). Only an under-16's guardian's
 * patch is published; the database asks again (fn_publish_guardian_change).
 * Photos the versions stopped naming are forgotten after the commit (L1).
 */
export async function writeRecord(
  recordId: string, author: { personId: string; actor: RecordActor },
  write: (client: RecordClient) => Promise<GuardianPatch | null>,
): Promise<void> {
  let replaced: string[] = [];
  let waits = false;
  const client = await db.connect();
  try {
    await client.query('begin');
    const band = (await client.query(
      `select fn_age_band(p.dob) as band from development_record dr join person p on p.id = dr.person_id
       where dr.id = $1 for update of dr`,
      [recordId],
    )).rows[0]?.band as string | undefined;
    const patch = await write(client);
    if (band === 'u16' && patch && author.actor === 'guardian') {
      ({ replaced } = await publishPatch(client, recordId, author.personId, patch, '2026'));
    } else if (band === 'u16' && patch && author.actor === 'self') {
      // A child's own clip, achievement, other football or photo waits on a
      // guardian, whole, like every other change of theirs (B; BUZ, 2 Oct).
      const submitted = await submitChildChange(client, recordId, '2026');
      replaced = submitted.replaced;
      waits = submitted.tell;
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  for (const r of replaced) await forgetPlayerPhoto(recordId, r);
  if (waits) await tellGuardiansItWaits(recordId);
}

/**
 * Publish a guardian's own change to an under-16's page (F14; John, 1 Oct) —
 * that change and nothing else (BUZ, 2 Oct, "parent's change only"; John
 * confirmed with four conditions).
 *
 * The change is a PATCH (fn_cv_patch, 0169): the form fields they saved, the
 * photo they uploaded, or the one clip, achievement or other-football entry
 * they added or removed. It is applied to the approved version — what every
 * link-holder reads (D-119) — with this guardian as the approver, and the
 * family history says "{guardian first name} changed the page." (BUZ, 1 Oct).
 * Anything the CHILD added that no guardian has seen stays on the live record
 * and waits, exactly as it did: it is never copied across. (As first built,
 * this snapshotted the whole live record, and a child's clip or photo reached
 * every club on the back of a parent's unrelated save: safety review B-1.)
 *
 * If a change of the child's is waiting, the same patch is applied to it, so
 * approving it later never undoes the guardian's; on a field both touched the
 * guardian's value wins, and nothing tells the child. A guardian's removal
 * reaches clubs at once even then (S-2). With no approved page yet nothing
 * publishes: the pending version carries it to the first approval.
 *
 * No message to anyone: the guardian who made it is not told it waits, and
 * the other guardian gets exactly what they get when one guardian approves
 * a child's edit, which is no message (D-51). The database decides
 * (fn_publish_guardian_change): it acts only for a person fn_record_author
 * calls this under-16's guardian, asked under the record's lock, and returns
 * null for anyone else.
 *
 * Call it AFTER the change is written, outside any open transaction (L1).
 * Every editor of a guardian's change calls it: the build form (inside its
 * own transaction, through publishPatch), clips, achievements and other
 * football, and the photo.
 */
export async function publishGuardianChange(
  recordId: string, guardianId: string, patch: GuardianPatch, season = '2026',
): Promise<PublishResult> {
  let replaced: string[] = [];
  let result: PublishResult;
  const client = await db.connect();
  try {
    await client.query('begin');
    ({ result, replaced } = await publishPatch(client, recordId, guardianId, patch, season));
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  // A photo the old versions named and nothing shows any more goes (S-3);
  // forgetPlayerPhoto keeps anything still shown.
  for (const r of replaced) await forgetPlayerPhoto(recordId, r);
  return result;
}

/** One guardian change (0169 fn_cv_patch): set fields or the photo, or add/remove one entry. */
export type GuardianList = 'highlights' | 'achievements' | 'otherFootball' | 'previousClubs';
export type GuardianPatch =
  | { set?: Record<string, unknown>; stats?: { season: string; keys: string[]; entries: unknown[] } }
  | { add: { list: GuardianList; item: Record<string, unknown> } }
  | { remove: { list: GuardianList; item: Record<string, unknown> } };
export type PublishResult = 'published' | 'unchanged' | 'pending' | 'no_page' | null;

// The photos the approved and pending versions name, read under lock before a
// publish rewrites them, so the ones nothing shows afterwards can go.
async function versionPhotos(client: Client, recordId: string): Promise<string[]> {
  const { rows } = await client.query(
    `select content ->> 'photoPath' as photo from profile_version
     where record_id = $1 and status in ('approved', 'pending') for update`,
    [recordId],
  );
  return rows.map((r) => r.photo as string | null).filter((p): p is string => Boolean(p));
}

// The step itself, on a transaction the caller holds: the record's lock, the
// photos the versions name, then the database's patch — one transaction, in
// that order. The lock comes first (safety review B-1, the race): a child's
// save in flight finishes before anything here is read, and one that starts
// later waits until this has committed.
//
// NO PAGE YET ('no_page': no approved version and none waiting). Nothing
// publishes, and the first approval carries the guardian's work: the pending
// version is opened from the record as it stands, as every under-16's first
// page was before F14, and the guardian approves it on /g/pending. This is
// the one place a guardian's save reads the whole record, and it publishes
// nothing — a first page has nothing approved to patch, and approval is the
// review. No edit_submitted (it is not the child's) and no email (F14).
async function publishPatch(client: Client, recordId: string, guardianId: string, patch: GuardianPatch, season: string) {
  await client.query('select 1 from development_record where id = $1 for update', [recordId]);
  const replaced = await versionPhotos(client, recordId);
  const { rows } = await client.query(
    'select fn_publish_guardian_change($1, $2, $3::jsonb) as r',
    [recordId, guardianId, JSON.stringify(patch)],
  );
  const result = (rows[0]?.r ?? null) as PublishResult;
  if (result === 'no_page') {
    await client.query(
      `insert into profile_version (record_id, content, status) values ($1, $2, 'pending')
       on conflict (record_id) where status = 'pending' do nothing`,
      [recordId, JSON.stringify(await buildSnapshot(client, recordId, season))],
    );
  }
  return { result, replaced };
}

// The shapes a page version stores, shared by the snapshot and by every
// guardian patch, so an item a guardian adds or removes is byte for byte the
// item the snapshot holds (fn_cv_patch removes by equality). Each is an SQL
// expression over the row's own columns.
export const ITEM_SQL = {
  highlights: `json_build_object('title', title, 'url', url)`,
  achievements: `json_build_object('title', title, 'detail', detail)`,
  otherFootball: `json_build_object('kind', kind, 'orgName', org_name, 'period', season_label, 'note', notes)`,
  previousClubs: `json_build_object('orgName', org_name, 'period', season_label)`,
} as const;

// The build form's fields as a page version stores them — the snapshot's and
// the guardian's patch, from one expression.
const FORM_FIELDS_SQL = `jsonb_build_object('positions', dr.positions, 'squadNumber', dr.squad_number, 'foot', dr.foot,
  'about', coalesce(dr.about, ''), 'surfacedStats', dr.surfaced_stats)`;

// What the build form holds for this record: its fields as a version stores
// them, and its own stats for the form's season (the rows it writes — no
// other season, no other source).
type FormState = { fields: Record<string, unknown>; stats: Record<string, unknown> };
async function formState(client: Client, recordId: string, season: string): Promise<FormState> {
  const { rows } = await client.query(
    `select ${FORM_FIELDS_SQL} as fields,
       coalesce((select jsonb_object_agg(stat_key, value) from player_stat
                 where record_id = dr.id and season = $2 and source_experience_id is null), '{}'::jsonb) as stats
     from development_record dr where dr.id = $1`,
    [recordId, season],
  );
  return rows[0] as FormState;
}

// The guardian's change, from what the form held before their save and after
// it: each field that moved, and each stat that moved — that stat's entries as
// the page shows them (fn_stat_public), for the form's season, patched in entry
// by entry so no other season, source or verification rides along. Null when
// nothing moved.
async function formPatch(client: Client, recordId: string, season: string, before: FormState, after: FormState): Promise<GuardianPatch | null> {
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const set: Record<string, unknown> = {};
  for (const k of Object.keys(after.fields)) if (!same(before.fields[k], after.fields[k])) set[k] = after.fields[k];
  const keys = [...new Set([...Object.keys(before.stats), ...Object.keys(after.stats)])]
    .filter((k) => !same(before.stats[k], after.stats[k])).sort();
  const patch: { set?: Record<string, unknown>; stats?: { season: string; keys: string[]; entries: unknown[] } } = {};
  if (Object.keys(set).length > 0) patch.set = set;
  if (keys.length > 0) {
    const entries = (await client.query(
      `select coalesce(jsonb_agg(e), '[]'::jsonb) as entries from jsonb_array_elements(fn_stat_public($1)) e
       where e->>'season' = $2 and e->>'key' = any($3::text[])`,
      [recordId, season, keys],
    )).rows[0]?.entries as unknown[];
    patch.stats = { season, keys, entries };
  }
  return patch.set || patch.stats ? (patch as GuardianPatch) : null;
}

// The renderable snapshot (same shape PlayerCV consumes).
async function buildSnapshot(client: Client, recordId: string, season: string) {
  const { rows } = await client.query(
    `select
      (select jsonb_build_object('firstName', p.first_name, 'lastName', coalesce(p.last_name,''), 'photoPath', p.photo_path)
              || ${FORM_FIELDS_SQL}
        from development_record dr join person p on p.id = dr.person_id where dr.id = $1) as core,
      -- D-160: the stats as a page may show them — source, dates, the
      -- verifying CLUB, never the coach — so the version a guardian approves
      -- carries a verification the same way the live page does (0083).
      fn_stat_public($1) as stats,
      (select coalesce(json_agg(${ITEM_SQL.achievements} order by sort), '[]'::json)
        from achievement where record_id = $1) as achievements,
      -- No school on an under-18's page (D-161, 0061). Asked of the database
      -- here too, so a snapshot approved from today carries none — the same
      -- question the live assembly asks, in the same words.
      (select coalesce(json_agg(${ITEM_SQL.otherFootball}), '[]'::json)
        from experience_entry where record_id = $1 and kind <> 'previous_club'
          and fn_experience_public($1, kind)) as other,
      (select coalesce(json_agg(${ITEM_SQL.previousClubs} order by season_label desc nulls last, created_at desc), '[]'::json)
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
      (select coalesce(json_agg(${ITEM_SQL.highlights} order by added_at), '[]'::json)
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
