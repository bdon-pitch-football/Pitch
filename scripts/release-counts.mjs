// Read-only counts the 1 Oct release needs from production, printed as
// numbers and nothing else (John, 1 Oct). It never changes a row and never
// prints a name, an address, a number or a body.
//
//   node --env-file=.env.production-db.local scripts/release-counts.mjs --ca supabase/prod-ca.crt
//
//   s4  messages sent for a pending invitation whose invitation is gone,
//       but which still hold a body, subject or address (purges before 0167
//       cut the link: 0077 is `on delete set null`). John approved a one-off
//       cleanup if this is above zero.
//   opt SMS opt-outs on the STOP list (re-keyed to a keyed fingerprint in
//       this release; expected zero, SMS has not been live).
//
// Same connection rules as scripts/apply-migrations.mjs: SUPABASE_DB_URL,
// never printed; TLS verified against --ca for anything that is not local.
import pg from 'pg';
import { readFileSync } from 'node:fs';

const raw = process.env.SUPABASE_DB_URL;
if (!raw) { console.error('refusing: SUPABASE_DB_URL is not set'); process.exit(1); }
const url = new URL(raw);
const local = ['localhost', '127.0.0.1'].includes(url.hostname);
url.searchParams.delete('sslmode');
const val = (flag) => { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : null; };
let ssl;
if (!local) {
  const ca = val('--ca');
  if (!ca) { console.error('refusing: a remote database needs --ca <Supabase CA certificate file> so the server is verified'); process.exit(1); }
  ssl = { ca: readFileSync(ca, 'utf8'), rejectUnauthorized: true };
}
const client = new pg.Client({ connectionString: url.toString(), ssl, application_name: 'pitch-release-counts' });
await client.connect();
try {
  // Read-only, so even a mistake here cannot write.
  await client.query('begin read only');
  const one = async (sql) => (await client.query(sql)).rows[0].n;
  const s4 = await one(`select count(*)::int as n from message_outbox
    where message_key in ('doc15.§1','doc15.§2','doc15.§1b','doc15.§2b','doc15.§3')
      and invitation_id is null and (body <> '' or subject is not null or to_address <> '')`);
  const opt = await one(`select count(*)::int as n from sms_opt_out`);
  await client.query('rollback');
  console.log(`host ${url.hostname} · database ${url.pathname.slice(1)}`);
  console.log(`s4  leftover invitation messages still holding words: ${s4}`);
  console.log(`opt SMS opt-outs on the STOP list: ${opt}`);
} finally {
  await client.end();
}
