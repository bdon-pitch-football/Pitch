// Moves every under-18's PUBLIC photo into the private bucket (John's ruling
// §1, BUZ 1 Oct: "put the public bucket fix in this release"). From the push
// onward a new under-18 photo is private from the start; this is for the ones
// uploaded before it, which sit in the public bucket at a permanent address
// that switching a link off never stopped.
//
//   node --conditions=react-server --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --env-file=.env.production-db.local scripts/private-photos.mts --ca supabase/rehearsal-ca.crt            # plan only
//   node --conditions=react-server --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --env-file=.env.production-db.local scripts/private-photos.mts --ca supabase/rehearsal-ca.crt --apply    # do it
//
// The env file holds the database URL, the project URL, the service-role key
// and SUPABASE_PRIVATE_BUCKET. This file never reads the key: every bucket
// operation is lib/storage's, which is where the key lives (D-80 as widened to
// two files; the CI rule names them).
// `--conditions=react-server` is what lets plain node import that module,
// which is marked server-only.
//
// For each distinct public path an under-18 is shown by (the live record, or
// any version of their page), in this order:
//   1. copy the object into the private bucket under the same key;
//   2. repoint every row that names it, in one transaction;
//   3. only then delete the public object.
// A failure at 1 or 2 leaves the public copy and the rows as they were, so a
// re-run picks it up again. A failure at 3 leaves a public copy no row names,
// counted, for a second run to report. The band is the database's answer at
// the moment of the run (fn_age_band), never stored.
//
// It prints COUNTS ONLY — never a path, a key, an id or a name.
//
// Rules, as apply-migrations has them: plan by default and --apply to change
// anything; a remote database needs --ca and is verified; the shared dev and
// demo databases are refused without --i-mean-the-dev-db; a remote database
// with no bucket configured is refused, because the copies would go to this
// laptop's disk.
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { copyToPrivate, removeImage, storageConfigured } from '../lib/storage.ts';
import { REPOINT_PHOTO, UNDER_18_PUBLIC_PHOTOS } from '../lib/player-photo.ts';

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const val = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };

const raw = process.env.SUPABASE_DB_URL;
if (!raw) { console.error('SUPABASE_DB_URL is not set (load it with node --env-file=<file>; never paste it)'); process.exit(1); }
const url = new URL(raw);
const local = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
if (local && ['54322', '54323'].includes(url.port) && !has('--i-mean-the-dev-db')) {
  console.error('refusing: 54322 is the shared dev database and 54323 is the demo');
  process.exit(1);
}
if (!local && !storageConfigured()) {
  console.error('refusing: a remote database with no bucket configured would copy photos to this machine');
  process.exit(1);
}
url.searchParams.delete('sslmode');
let ssl: { ca: string; rejectUnauthorized: true } | undefined;
if (!local) {
  const ca = val('--ca');
  if (!ca) { console.error('refusing: a remote database needs --ca <Supabase CA certificate file> so the server is verified'); process.exit(1); }
  ssl = { ca: readFileSync(ca, 'utf8'), rejectUnauthorized: true };
}
const client = new pg.Client({ connectionString: url.toString(), ssl, application_name: 'pitch-private-photos' });
await client.connect();
console.log(`database: ${local ? 'local' : 'remote'} · bucket: ${storageConfigured() ? 'Supabase' : 'local folders'}`);

const paths = (await client.query(UNDER_18_PUBLIC_PHOTOS)).rows.map((r) => r.path as string);
console.log(`under-18 photos at a public address: ${paths.length}`);
if (!has('--apply')) {
  console.log('plan only — nothing changed. Re-run with --apply.');
  await client.end();
  process.exit(0);
}

const count = { moved: 0, notOurs: 0, failed: 0, rowsRepointed: 0, publicLeft: 0 };
for (const path of paths) {
  let priv: string | null;
  try {
    priv = await copyToPrivate(path);
  } catch {
    count.failed += 1;
    continue;
  }
  if (!priv) { count.notOurs += 1; continue; }
  try {
    await client.query('begin');
    for (const sql of REPOINT_PHOTO) count.rowsRepointed += (await client.query(sql, [path, priv])).rowCount ?? 0;
    await client.query('commit');
  } catch {
    await client.query('rollback');
    // The private copy is left behind with nothing pointing at it; the next
    // run copies over it (upsert) and repoints.
    count.failed += 1;
    continue;
  }
  try {
    await removeImage(path);
    count.moved += 1;
  } catch {
    count.publicLeft += 1;
  }
}
console.log(`moved: ${count.moved} · rows repointed: ${count.rowsRepointed} · not ours (left alone): ${count.notOurs} · failed (left public, re-run): ${count.failed} · moved but public copy not deleted: ${count.publicLeft}`);
await client.end();
process.exit(count.failed + count.publicLeft > 0 ? 1 : 0);
