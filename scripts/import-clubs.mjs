// Loads a list of clubs as UNCLAIMED listings, through the operator's own
// function (fn_ops_add_club, 0130), one club per transaction, so every club
// carries who added it and where its details came from, exactly as if BUZ
// had typed it into /ops/clubs/new (BUZ, 30 Sep: load the Victorian pyramid).
//
//   node --env-file=.env.production-db.local scripts/import-clubs.mjs --ca supabase/rehearsal-ca.crt \
//        --csv ../content/sales/pipeline/clubs-vic-full-2026.csv --operator burak.donmez@pitch-football.com          # plan
//   ... --apply                                                                                                         # do it
//
// Columns read: club, suburb, state, contact_email, contact_source_url, website.
// A club already listed (same name and suburb) is skipped, never duplicated.
// A row the database refuses is reported with its reason and skipped. The
// output names clubs, never an address.
import pg from 'pg';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };

function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell); if (row.some((c) => c.trim() !== '')) rows.push(row);
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const csvPath = val('--csv');
const operator = (val('--operator') ?? '').trim().toLowerCase();
if (!csvPath || !operator) { console.error('usage: --csv <file> --operator <operator email> [--ca <cert>] [--apply]'); process.exit(1); }
const raw = process.env.SUPABASE_DB_URL;
if (!raw) { console.error('SUPABASE_DB_URL is not set (load it with node --env-file=<file>; never paste it)'); process.exit(1); }
const url = new URL(raw);
const local = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
if (local && url.port === '54323') { console.error('refusing: 54323 is the demo database'); process.exit(1); }
let ssl;
if (!local) {
  const ca = val('--ca');
  if (!ca) { console.error('refusing: a remote database needs --ca <Supabase CA certificate file>'); process.exit(1); }
  ssl = { ca: readFileSync(ca, 'utf8'), rejectUnauthorized: true };
}
url.searchParams.delete('sslmode');

const rows = parseCsv(readFileSync(csvPath, 'utf8'));
const client = new pg.Client({ connectionString: url.toString(), ssl, application_name: 'pitch-import-clubs' });
await client.connect();
const op = (await client.query('select id from person where lower(email) = $1', [operator])).rows[0];
if (!op) { console.error('refusing: no account with that operator address'); await client.end(); process.exit(1); }

const key = (n, s) => `${n.toLowerCase().replace(/\s+/g, ' ')}|${s.toLowerCase().replace(/\s+/g, ' ')}`;
const listed = new Set((await client.query('select name, suburb from club')).rows.map((r) => key(r.name ?? '', r.suburb ?? '')));
const plan = { add: [], already: [], incomplete: [], invalid: [] };
const tidy = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');
// fn_club_listing_check's own rules (0130), checked here first so a bad row
// is reported and skipped before the database is asked anything.
const invalid = (p) => [
  !(p.name.length >= 2 && p.name.length <= 120) && 'name length',
  !(p.suburb.length >= 2 && p.suburb.length <= 80) && `suburb is ${p.suburb.length} characters`,
  !['VIC', 'NSW'].includes(p.state) && 'state',
  p.contact && (p.contact.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.contact)) && 'email is not an address',
  !(p.source.length >= 3 && p.source.length <= 300) && 'source length',
].filter(Boolean);
for (const r of rows) {
  const name = tidy(r.club), suburb = tidy(r.suburb), state = tidy(r.state || 'VIC').toUpperCase();
  const source = tidy(r.contact_source_url || r.website || '');
  if (!name || !suburb || source.length < 3) { plan.incomplete.push(name || '(no name)'); continue; }
  const why = invalid({ name, suburb, state, contact: tidy(r.contact_email), source });
  if (why.length) { plan.invalid.push(`${name} (${why.join(', ')})`); continue; }
  if (listed.has(key(name, suburb))) { plan.already.push(name); continue; }
  listed.add(key(name, suburb));
  plan.add.push({ name, suburb, state, contact: tidy(r.contact_email) || null, source });
}
console.log(`database: ${url.hostname} · operator: ${operator}`);
console.log(`rows: ${rows.length} · to add: ${plan.add.length} (with an email: ${plan.add.filter((p) => p.contact).length}) · already listed: ${plan.already.length} · incomplete: ${plan.incomplete.length} · to fix: ${plan.invalid.length}`);
if (plan.incomplete.length) console.log(`incomplete (no suburb or source): ${plan.incomplete.join(', ')}`);
if (plan.invalid.length) console.log(`fix before loading: ${plan.invalid.join('; ')}`);
if (!has('--apply')) { console.log('plan only. Nothing changed. Add --apply to load them.'); await client.end(); process.exit(0); }

let ok = 0; const refused = [];
for (const p of plan.add) {
  try {
    await client.query('begin');
    await client.query('select fn_ops_add_club($1, $2, $3, $4, $5, $6, $7)', [op.id, operator, p.name, p.suburb, p.state, p.contact, p.source]);
    await client.query('commit'); ok++;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    refused.push(`${p.name}: ${String(e.message).slice(0, 80)}`);
  }
}
console.log(`done: ${ok} added · ${refused.length} refused`);
for (const r of refused) console.log(`  refused ${r}`);
await client.end();
