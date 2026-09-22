// Applies supabase/migrations/*.sql to a REAL Postgres, once each, in order,
// and records what it applied — so the same file is never run twice and an
// edited file is never silently skipped. (release, 22 Sep)
//
//   node --env-file=.env.keysday.local scripts/apply-migrations.mjs --ca supabase/prod-ca.crt            # plan only
//   node --env-file=.env.keysday.local scripts/apply-migrations.mjs --ca supabase/prod-ca.crt --apply    # do it
//   node --env-file=.env.keysday.local scripts/apply-migrations.mjs --ca supabase/prod-ca.crt --fingerprint
//   node scripts/apply-migrations.mjs --local-fingerprint     # the same fingerprint from PGlite, for comparison
//
// Reads the connection string from SUPABASE_DB_URL and never prints it (only
// host and database name). Never put production values in .env.local: `next
// dev` loads that file, and the dev app, the render suite and the write suite
// would then run against production.
//
// Rules it enforces:
//   - plan by default; --apply is required to change anything
//   - the ledger lives in its own schema (pitch_meta), not in public, so the
//     Data API never exposes it
//   - a database with tables in public but no ledger is refused: it was built
//     some other way and we do not guess what is in it
//   - a file whose contents changed after it was applied stops the run
//   - a pending file numbered below an applied one stops the run
//   - each file runs in ONE transaction together with its ledger row, with
//     lock_timeout 5s: a migration that cannot get its lock gives up rather
//     than queueing every live request behind it
//   - TLS with certificate verification for anything that is not localhost
import pg from 'pg';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const dir = fileURLToPath(new URL('../supabase/migrations', import.meta.url));
const files = readdirSync(dir).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
const sha = (s) => createHash('sha256').update(s).digest('hex');

// One catalogue query, run identically on PGlite and on the real database, so
// "the schema the suites proved" and "the schema that is live" can be compared
// by a single hash. Covers columns, constraints, indexes, triggers, function
// bodies and RLS flags in public. Ownership and grants are left out on
// purpose: Supabase's default privileges differ from PGlite's by design.
const FINGERPRINT_SQL = `
  select 'col' k, table_name||'.'||column_name||':'||data_type||':'||is_nullable||':'||coalesce(column_default,'') v
    from information_schema.columns where table_schema='public'
  union all select 'con', conrelid::regclass::text||':'||conname||':'||pg_get_constraintdef(c.oid)
    from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public'
  union all select 'idx', indexname||':'||indexdef from pg_indexes where schemaname='public'
  union all select 'trg', tgrelid::regclass::text||':'||tgname||':'||pg_get_triggerdef(t.oid)
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and not t.tgisinternal
  union all select 'fn', p.proname||'('||pg_get_function_identity_arguments(p.oid)||'):'||md5(p.prosrc)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname <> 'gen_random_bytes'
  union all select 'rls', c.relname||':'||c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'
  order by 1, 2`;
const summarise = (rows) => {
  const count = {};
  for (const r of rows) count[r.k] = (count[r.k] ?? 0) + 1;
  return { hash: sha(rows.map((r) => `${r.k}|${r.v}`).join('\n')), count };
};

if (has('--local-fingerprint')) {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  await db.exec(`create or replace function gen_random_bytes(n int) returns bytea language sql as
    $$ select decode(string_agg(lpad(to_hex((random()*255)::int),2,'0'),''), 'hex') from generate_series(1, n) $$;`);
  for (const f of files) await db.exec(readFileSync(join(dir, f), 'utf8'));
  const s = summarise((await db.query(FINGERPRINT_SQL)).rows);
  console.log(`local (PGlite, ${files.length} files): ${s.hash}  ${JSON.stringify(s.count)}`);
  if (has('--dump')) for (const r of (await db.query(FINGERPRINT_SQL)).rows) console.log(`${r.k}|${r.v}`);
  process.exit(0);
}

const raw = process.env.SUPABASE_DB_URL;
if (!raw) { console.error('SUPABASE_DB_URL is not set (load it with node --env-file=<file>; never paste it)'); process.exit(1); }
const url = new URL(raw);
const local = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
if (local && ['54322', '54323'].includes(url.port) && !has('--i-mean-the-dev-db')) {
  console.error('refusing: 54322 is the shared dev database and 54323 is the demo; neither takes migrations from here');
  process.exit(1);
}
url.searchParams.delete('sslmode');      // pg would let this override the explicit TLS settings below
let ssl;
if (!local) {
  const ca = val('--ca');
  if (!ca) { console.error('refusing: a remote database needs --ca <Supabase CA certificate file> so the server is verified'); process.exit(1); }
  ssl = { ca: readFileSync(ca, 'utf8'), rejectUnauthorized: true };
}
const client = new pg.Client({ connectionString: url.toString(), ssl, application_name: 'pitch-apply-migrations' });
await client.connect();
const q = (sql, p) => client.query(sql, p);
const who = (await q(`select current_database() db, current_setting('server_version') v, inet_server_addr()::text addr`)).rows[0];
console.log(`database: ${url.hostname}/${who.db} · Postgres ${who.v}`);

if (has('--fingerprint')) {
  const s = summarise((await q(FINGERPRINT_SQL)).rows);
  console.log(`remote: ${s.hash}  ${JSON.stringify(s.count)}`);
  if (has('--dump')) for (const r of (await q(FINGERPRINT_SQL)).rows) console.log(`${r.k}|${r.v}`);
  await client.end();
  process.exit(0);
}

const ledgerExists = (await q(`select to_regclass('pitch_meta.applied_migration') is not null e`)).rows[0].e;
const publicTables = (await q(`select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r'`)).rows[0].n;
if (!ledgerExists && publicTables > 0) {
  console.error(`refusing: public already has ${publicTables} tables and there is no ledger — this database was built another way`);
  await client.end(); process.exit(1);
}
const applied = ledgerExists
  ? new Map((await q(`select file, sha256 from pitch_meta.applied_migration`)).rows.map((r) => [r.file, r.sha256]))
  : new Map();

let bad = 0;
for (const [f, h] of applied) {
  if (!files.includes(f)) { console.error(`STOP ${f} is applied but no longer in the repo`); bad++; continue; }
  if (sha(readFileSync(join(dir, f), 'utf8')) !== h) { console.error(`STOP ${f} changed after it was applied — write a new migration instead`); bad++; }
}
const pending = files.filter((f) => !applied.has(f));
const lastApplied = [...applied.keys()].sort().pop();
for (const f of pending) if (lastApplied && f < lastApplied) { console.error(`STOP ${f} is pending but ${lastApplied} is already applied (out of order)`); bad++; }
if (bad) { await client.end(); process.exit(1); }

console.log(`applied: ${applied.size} · pending: ${pending.length}${pending.length ? ` (${pending[0]} … ${pending.at(-1)})` : ''}`);
if (!has('--apply')) {
  for (const f of pending) console.log(`  would apply ${f}`);
  console.log('plan only. Nothing changed. Add --apply to run it.');
  await client.end(); process.exit(0);
}

await q(`create schema if not exists pitch_meta`);
await q(`create table if not exists pitch_meta.applied_migration (
  file text primary key, sha256 text not null, applied_at timestamptz not null default now(), applied_by text not null default current_user)`);
for (const f of pending) {
  const body = readFileSync(join(dir, f), 'utf8');
  const t0 = Date.now();
  try {
    await q('begin');
    await q(`set local lock_timeout = '5s'`);
    await q(body);
    await q(`insert into pitch_meta.applied_migration (file, sha256) values ($1, $2)`, [f, sha(body)]);
    await q('commit');
    console.log(`OK   ${f} (${Date.now() - t0} ms)`);
  } catch (e) {
    await q('rollback').catch(() => {});
    console.error(`FAIL ${f}: ${e.message} — rolled back; nothing from this file is applied. Stopped.`);
    await client.end(); process.exit(1);
  }
}
console.log(`done: ${pending.length} applied`);
await client.end();
