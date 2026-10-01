// Clears the words of every message nobody will send again, and its address
// 30 days after it ended (doc 23: "We do not retain message bodies"; John,
// 1 Oct, §5.1; safety review of John's batch, S-4 and S-5, 2 Oct; John, 2 Oct,
// §3: addresses kept 30 days, then cleared, the try count kept).
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --env-file=.env.production-db.local scripts/scrub-sent-bodies.mjs --ca supabase/prod-ca.crt            # plan only
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --env-file=.env.production-db.local scripts/scrub-sent-bodies.mjs --ca supabase/prod-ca.crt --apply    # clear
//
// WHY IT EXISTS. The release applies 0169 and then deploys. 0169 clears every
// sent, closed and given-up message's body and subject, once. In the gap
// before the new code is serving, the old dispatch() keeps the words of
// everything it sends — a share link, an undo link, a child's first name and
// age. GO-LIVE runs this straight after the deploy to clear those too.
//
// It runs lib/sent-bodies SCRUB_SENT_BODIES: the statement 0169 runs, byte for
// byte, and the one the outbox sweep runs after every run (the permission
// suite pins all three to it). Idempotent: a cleared row does not match, so a
// second run plans 0. A message still to go keeps its words and its address;
// one that ended inside the last 30 days keeps its address. It reports how
// many of the rows it clears hold an address past its 30 days, too.
//
// It prints COUNTS ONLY — never an address, a body, an id or the database URL.
//
// Connection rules, as scripts/release-counts.mjs has them: SUPABASE_DB_URL,
// never printed; a remote database needs --ca and is verified. The shared dev
// database and the demo are refused without --i-mean-the-dev-db.
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { COUNT_SENT_BODIES, COUNT_STALE_ADDRESSES, SCRUB_SENT_BODIES } from '../lib/sent-bodies.ts';

const has = (flag) => process.argv.includes(flag);
const val = (flag) => { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : null; };

const raw = process.env.SUPABASE_DB_URL;
if (!raw) { console.error('refusing: SUPABASE_DB_URL is not set (load it with node --env-file=<file>; never paste it)'); process.exit(1); }
const url = new URL(raw);
const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
if (local && ['54322', '54323'].includes(url.port) && !has('--i-mean-the-dev-db')) {
  console.error('refusing: 54322 is the shared dev database and 54323 is the demo');
  process.exit(1);
}
url.searchParams.delete('sslmode');
let ssl;
if (!local) {
  const ca = val('--ca');
  if (!ca) { console.error('refusing: a remote database needs --ca <Supabase CA certificate file> so the server is verified'); process.exit(1); }
  ssl = { ca: readFileSync(ca, 'utf8'), rejectUnauthorized: true };
}
const client = new pg.Client({ connectionString: url.toString(), ssl, application_name: 'pitch-scrub-sent-bodies' });
await client.connect();
try {
  const count = async () => (await client.query(COUNT_SENT_BODIES)).rows[0].n;
  const stale = async () => (await client.query(COUNT_STALE_ADDRESSES)).rows[0].n;
  console.log(`database: ${local ? 'local' : 'remote'}`);
  const planned = await count();
  console.log(`messages nobody will send again that still hold words, or an address past 30 days: ${planned}`);
  console.log(`  of which hold an address past 30 days: ${await stale()}`);
  if (!has('--apply')) {
    console.log('plan only — nothing changed. Re-run with --apply.');
  } else {
    await client.query('begin');
    const cleared = (await client.query(SCRUB_SENT_BODIES)).rowCount;
    await client.query('commit');
    console.log(`cleared: ${cleared}`);
    console.log(`still to clear: ${await count()} (addresses past 30 days: ${await stale()})`);
  }
} catch (e) {
  await client.query('rollback').catch(() => {});
  // The error's class, never its text: a driver message can quote a value.
  console.error(`failed: ${e?.code ?? e?.name ?? 'error'}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
