// Applies the NEW migrations to a database that already has data in it, and
// says what each one locked, rewrote, rejected or silently changed — and
// whether it can be run twice. validate-migrations.mjs proves the chain
// applies to an EMPTY database; after launch every migration meets live rows.
//
//   node scripts/migration-on-data.mjs              # base = 0050, new = 0051+
//   node scripts/migration-on-data.mjs --base 0053  # when 0053 is what is live
//
// Its own in-process PGlite. It never opens a port and never touches the dev
// database (54322) or the demo database (54323). Every person is fictional.
//
// Two scenarios, each on a fresh database:
//   clean  rows the product (or the seed) could plausibly have written
//   dirty  rows that break the NEW caps — what a live database might hold if
//          anything wrote those columns before the caps existed
// A migration that fails in "dirty" is not wrong by itself; it means the
// deploy must check the live data first (queries printed below).
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const argBase = process.argv.indexOf('--base');
const BASE = argBase > 0 ? process.argv[argBase + 1] : '0050';
const dir = fileURLToPath(new URL('../supabase/migrations', import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const baseFiles = files.filter((f) => f.slice(0, 4) <= BASE);
const newFiles = files.filter((f) => f.slice(0, 4) > BASE);
if (newFiles.length === 0) { console.log(`nothing newer than ${BASE}`); process.exit(0); }

let problems = 0;
// Every CHECK 0051 adds, as a read-only query for rows it would reject.
const PREFLIGHT = [
  ['club_philosophy_len', `select id from club where philosophy is not null and char_length(philosophy) > 400`],
  ['club_pathway_len', `select id from club where pathway_line is not null and char_length(pathway_line) > 80`],
  ['club_established_year', `select id from club where established is not null and established !~ '^(18|19|20)[0-9]{2}$'`],
  ['wanted_title_len', `select id from players_wanted_notice where char_length(title) not between 1 and 60`],
  ['wanted_detail_len', `select id from players_wanted_notice where detail is not null and char_length(detail) > 100`],
  ['alumni_line_len', `select id from alumni_entry where char_length(line) not between 1 and 80`],
  ['alumni_detail_len', `select id from alumni_entry where detail is not null and char_length(detail) > 80`],
];
const say = (s) => console.log(s);

async function fresh() {
  const db = new PGlite();
  // pgcrypto shim, as validate-migrations.mjs (the real project has pgcrypto)
  await db.exec(`create or replace function gen_random_bytes(n int) returns bytea language sql as
    $$ select decode(string_agg(lpad(to_hex((random()*255)::int),2,'0'),''), 'hex') from generate_series(1, n) $$;`);
  for (const f of baseFiles) await db.exec(readFileSync(join(dir, f), 'utf8'));
  return db;
}

// --- seed: realistic rows at the BASE schema --------------------------------
async function seed(db, dirty) {
  const q = (sql, p) => db.query(sql, p);
  const guardian = randomUUID(), td = randomUUID(), admin = randomUUID();
  await q(`insert into person (id, first_name, last_name, dob, email) values
    ($1,'Alex','Fixture','1985-05-05','guardian@example.com'),
    ($2,'Marina','Petrovic','1980-02-02','td@example.com'),
    ($3,'Pat','Nguyen','1979-03-03','admin@example.com')`, [guardian, td, admin]);
  const clubs = [
    ['Riverside FC', '1974', 'MiniRoos → Juniors → Seniors pathway',
      'Every junior plays, every junior develops. Football that is brave on the ball.'],
    ['Kingsway Rovers FC', '1988', null, null],
    ['Sunbury United', null, null, null],
  ];
  if (dirty) clubs.push(
    ['Marchfield City FC', 'Est. 1974', 'x'.repeat(90), 'y'.repeat(450)],   // prose year, long lines
    ['Westgate Rangers', '1974 ', null, null],                          // trailing space
    ['Elderslie Juniors SC', '1790', null, null],                       // out of range
  );
  const clubIds = [];
  for (const [name, est, path, phil] of clubs) {
    const id = randomUUID(), call = randomUUID();
    clubIds.push(id);
    await q(`insert into club (id, name, suburb, state, club_state, established, pathway_line, philosophy)
      values ($1,$2,'Brunswick','VIC','claimed',$3,$4,$5)`, [id, name, est, path, phil]);
    await q(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
      values ($1,$2,now(),'BUZ','03 9000 0000','FV club directory','verified','27@v1.0')`, [call, id]);
    await q(`update club set club_state='verified', verified_call_id=$1 where id=$2`, [call, id]);
  }
  const riverside = clubIds[0];
  await q(`insert into membership (person_id, club_id, role) values ($1,$3,'technical_director'),($2,$3,'club_admin')`, [td, admin, riverside]);
  const squad = randomUUID();
  await q(`insert into squad (id, club_id, name, age_group, competition_gender, season) values ($1,$2,'U14 Boys','U14','boys','2026')`, [squad, riverside]);
  const kids = [['Deniz', '2013-04-01', ['CM', 'AM']], ['Georgia', '2014-06-01', ['GK']], ['Nate', '2009-11-01', ['ST']], ['Jordan', '2004-01-01', []]];
  for (const [first, dob, pos] of kids) {
    const pid = randomUUID(), rid = randomUUID();
    await q(`insert into person (id, first_name, last_name, dob) values ($1,$2,'Fixture',$3)`, [pid, first, dob]);
    if (dob > '2008-09-22') await q(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [guardian, pid]);
    await q(`insert into membership (person_id, club_id, squad_id, role) values ($1,$2,$3,'player')`, [pid, riverside, squad]);
    await q(`insert into development_record (id, person_id, positions, squad_number, foot) values ($1,$2,$3,7,'Right')`, [rid, pid, pos]);
    await q(`insert into player_stat (record_id, season, stat_key, value, provenance) values ($1,'2026','apps',12,'self_reported'),($1,'2026','goals',3,'self_reported')`, [rid]);
    await q(`insert into highlight (record_id, url, title, added_as_minor) values ($1,'https://example.com/clip','Clip',true)`, [rid]);
    await q(`insert into registration (player_id, club_id, positions, club_status, disclosed_by, policy_version)
      values ($1,$2,$3,'new',$4,'20@v2.4')`, [pid, riverside, pos.length ? pos.slice(0, 1) : ['CM'], guardian]);
  }
  // one of every event word the log could hold at the base (0033's list)
  const def = (await q(`select pg_get_constraintdef(oid) d from pg_constraint where conname='consent_event_event_check'`)).rows[0].d;
  const words = [...def.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]);
  for (const w of words) await q(`insert into consent_event (event, actor_id, subject_id) values ($1,$2,$2)`, [w, guardian]);
  await q(`insert into players_wanted_notice (club_id,title,detail) values ($1,'U13 Boys — Goalkeeper','Train Tue & Thu · immediate start')`, [riverside]);
  await q(`insert into alumni_entry (club_id,line,detail,sort) values ($1,'Marco V. → NPL Victoria','Riverside juniors 2012–2018',0)`, [riverside]);
  if (dirty) {
    await q(`insert into players_wanted_notice (club_id,title,detail) values ($1,'',null),($1,$2,$3)`, [riverside, 't'.repeat(70), 'd'.repeat(120)]);
    await q(`insert into alumni_entry (club_id,line,detail,sort) values ($1,'',null,1),($1,$2,null,2)`, [riverside, 'l'.repeat(85)]);
  }
}

// --- what each migration did ------------------------------------------------
const tables = async (db) => (await db.query(
  `select c.relname, c.relfilenode, c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r'`)).rows;
const cols = async (db, t) => (await db.query(
  `select column_name from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position`, [t])).rows.map((r) => r.column_name);
async function fingerprint(db) {
  const out = {};
  for (const t of await tables(db)) {
    const c = await cols(db, t.relname);
    const r = (await db.query(`select count(*)::int n, md5(coalesce(string_agg(x::text, '|' order by x::text), '')) h
      from (select ${c.map((x) => `"${x}"`).join(',')} from "${t.relname}") x`)).rows[0];
    out[t.relname] = { cols: c, n: r.n, h: r.h, filenode: t.relfilenode };
  }
  return out;
}
async function fingerprintCols(db, t, c) {
  return (await db.query(`select count(*)::int n, md5(coalesce(string_agg(x::text, '|' order by x::text), '')) h
    from (select ${c.map((x) => `"${x}"`).join(',')} from "${t}") x`)).rows[0];
}

async function locksHeld(db) {
  // our own backend's relation locks, while the migration's transaction is open
  const r = await db.query(`select c.relname, l.mode from pg_locks l join pg_class c on c.oid=l.relation
    join pg_namespace n on n.oid=c.relnamespace
    where l.pid = pg_backend_pid() and n.nspname='public' and c.relkind in ('r','p')
    order by 1, 2`);
  const by = {};
  for (const { relname, mode } of r.rows) (by[relname] ??= new Set()).add(mode.replace('Lock', ''));
  return Object.entries(by).map(([t, m]) => `${t}(${[...m].join('+')})`);
}

async function scenario(name, dirty) {
  say(`\n=== ${name}: base 0001–${BASE} (${baseFiles.length} files), seeded, then ${newFiles.join(', ')}`);
  const db = await fresh();
  await seed(db, dirty);
  if (newFiles.some((f) => f.startsWith('0051'))) {
    // one count per constraint 0051 adds, so a failure names every offender
    for (const [c, sql] of PREFLIGHT) {
      const n = (await db.query(`select count(*)::int n from (${sql}) x`)).rows[0].n;
      say(`     pre-flight ${c}: ${n} row${n === 1 ? '' : 's'} would be rejected`);
    }
  }
  for (const f of newFiles) {
    const sql = readFileSync(join(dir, f), 'utf8');
    const before = await fingerprint(db);
    await db.exec('begin');
    try {
      await db.exec(sql);
    } catch (e) {
      await db.exec('rollback');
      say(`FAIL ${f}: ${e.message}  (rolled back; nothing applied)`);
      problems++;
      // the rest of the chain would not apply either
      return;
    }
    const locks = await locksHeld(db);
    await db.exec('commit');
    const after = await fingerprint(db);
    say(`OK   ${f}`);
    say(`     locks held until commit: ${locks.join(' ') || 'none on existing tables'}`);
    const rewritten = [], changed = [], added = [];
    for (const [t, b] of Object.entries(before)) {
      const a = after[t];
      if (!a) { changed.push(`${t} DROPPED`); continue; }
      if (a.filenode !== b.filenode) rewritten.push(t);
      const same = await fingerprintCols(db, t, b.cols);
      if (same.n !== b.n || same.h !== b.h) changed.push(`${t} (${b.n}→${same.n} rows or values changed)`);
      const newCols = a.cols.filter((c) => !b.cols.includes(c));
      if (newCols.length && b.n > 0) {
        for (const c of newCols) {
          const v = (await db.query(`select count(*)::int n, count(distinct "${c}")::int d, count("${c}")::int nn from "${t}"`)).rows[0];
          added.push(`${t}.${c}: ${v.nn}/${v.n} existing rows filled (${v.d} distinct value${v.d === 1 ? '' : 's'})`);
        }
      }
    }
    say(`     table rewrites: ${rewritten.join(', ') || 'none'}`);
    say(`     existing data changed: ${changed.join('; ') || 'none'}`);
    if (added.length) say(`     backfilled on existing rows: ${added.join('; ')}`);
    // re-run: inside a transaction we then throw away
    await db.exec('begin');
    try { await db.exec(sql); say('     re-run: applies again cleanly'); }
    catch (e) { say(`     re-run: FAILS — ${e.message.split('\n')[0]}`); }
    await db.exec('rollback');
  }
  // things the chain leaves behind that are not failures but need a decision
  const q = async (sql) => (await db.query(sql)).rows[0];
  if (newFiles.some((f) => f.startsWith('0051'))) {
    const a = await q(`select count(*)::int n from alumni_entry where adults_confirmed_by is null`);
    say(`     after 0051: ${a.n} alumni entr${a.n === 1 ? 'y has' : 'ies have'} no "18 or over" confirmation and stay on the public wall (from 0071 they cannot be edited unconfirmed; whether they stay up is BUZ's call — docs/team/RELEASE-PREFLIGHT.md)`);
    try {
      await db.exec(`update alumni_entry set line = line || '' where adults_confirmed_by is null`);
      say('     after 0051: an unconfirmed entry can still be UPDATED (edited text is not re-confirmed)');
    } catch (e) { say(`     after 0051: update refused: ${e.message}`); }
  }
  if (newFiles.some((f) => f.startsWith('0052'))) {
    const c = await q(`select count(*)::int n from consent_event`);
    say(`     after 0052: consent_event holds ${c.n} rows, every one of them still valid under the new check`);
  }
  await db.close();
}

// Self-test (L19): the detectors must be able to fail. A fake migration that
// changes a value, rewrites a table and cannot be re-run must be reported as
// all three, or nothing above is to be trusted.
async function selfTest() {
  const db = await fresh();
  await seed(db, false);
  const before = await fingerprint(db);
  await db.exec(`update alumni_entry set sort = sort + 1; alter table alumni_entry alter column sort type bigint; create table selftest_x (id int);`);
  const after = await fingerprint(db);
  const b = before.alumni_entry, a = after.alumni_entry;
  const same = await fingerprintCols(db, 'alumni_entry', b.cols);
  let rerun = true;
  try { await db.exec('create table selftest_x (id int)'); } catch { rerun = false; }
  const ok = same.h !== b.h && a.filenode !== b.filenode && !rerun;
  say(`self-test: value change ${same.h !== b.h ? 'seen' : 'MISSED'} · rewrite ${a.filenode !== b.filenode ? 'seen' : 'MISSED'} · non-rerunnable ${!rerun ? 'seen' : 'MISSED'}`);
  await db.close();
  return ok;
}

if (!(await selfTest())) { console.error('self-test failed: detectors cannot be trusted'); process.exit(2); }
const cleanBefore = problems;
await scenario('clean', false);
const cleanFailed = problems > cleanBefore;
await scenario('dirty', true);
say(`\nPre-flight on the live database before a migration that adds a CHECK (read-only):`);
for (const [c, sql] of PREFLIGHT) say(`  -- ${c}\n  ${sql};`);
say(`\n${cleanFailed ? 'CLEAN SCENARIO FAILED' : 'clean scenario applied'}; ${problems} scenario(s) stopped on a failing migration`);
// The dirty scenario is expected to stop: that is the point of it.
process.exit(cleanFailed ? 1 : 0);
