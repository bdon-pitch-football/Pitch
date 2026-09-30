// Loads trial notices and EOIs compiled from clubs' own public notices
// (D-90, D-172), through the operator's own function (fn_ops_add_notice,
// 0130), one notice per transaction — exactly as if BUZ had typed each one
// into /ops/clubs/<club>/trial. Every notice carries who added it and the
// link to the club's own notice; it expires on its own date like any other.
//
//   node --env-file=.env.production-db.local scripts/import-trials.mjs --ca supabase/rehearsal-ca.crt \
//        --csv ../content/sales/pipeline/trials-vic-2026-a.csv --csv ../content/sales/pipeline/trials-vic-2026-b.csv \
//        --operator burak.donmez@pitch-football.com          # plan
//   ... --apply                                               # do it
//
// Columns read: club, title, ages (codes; ;-separated), gender, trial_on,
// time, ground, positions (codes; ;-separated), source_url. A club must
// already be listed, by its exact name. A notice already there (same club,
// date and title) is skipped, never duplicated. D-172 U2: a row carrying an
// email address or a phone number anywhere is refused before the database is
// asked. The output names clubs and dates, never an address.
import pg from 'pg';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const vals = (f) => args.flatMap((a, i) => (a === f && args[i + 1] ? [args[i + 1]] : []));

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

const csvPaths = vals('--csv');
const operator = (val('--operator') ?? '').trim().toLowerCase();
if (!csvPaths.length || !operator) { console.error('usage: --csv <file> [--csv <file>] --operator <operator email> [--ca <cert>] [--apply]'); process.exit(1); }
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

const rows = csvPaths.flatMap((p) => parseCsv(readFileSync(p, 'utf8')));
const client = new pg.Client({ connectionString: url.toString(), ssl, application_name: 'pitch-import-trials' });
await client.connect();
const op = (await client.query('select id from person where lower(email) = $1', [operator])).rows[0];
if (!op) { console.error('refusing: no account with that operator address'); await client.end(); process.exit(1); }

const tidy = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');
const list = (s) => [...new Set(tidy(s).split(/[;|]/).map((x) => x.trim().toUpperCase()).filter(Boolean))];
const clubs = new Map((await client.query(`select id, name from club`)).rows.map((c) => [c.name.toLowerCase(), c]));
const ages = new Set((await client.query('select code from age_group')).rows.map((r) => r.code));
const TEN = ['GK', 'RB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST'];
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne' }).format(new Date());
const nkey = (clubId, on, title) => `${clubId}|${on}|${title.toLowerCase()}`;
const there = new Set((await client.query(
  `select club_id, trial_on::text as on, title from trial_notice`)).rows.map((r) => nkey(r.club_id, r.on, r.title)));
const EMAIL = /[^@\s]+@[^@\s]+\.[a-z]{2,}/i, PHONE = /(\+?61|\b0)[\s-]?[2-478](?:[\s-]?\d){8}\b/;

const plan = { add: [], already: [], noClub: [], invalid: [] };
// fn_trial_notice_check's own rules (0130), checked here first.
const invalid = (p) => [
  !(p.title.length >= 3 && p.title.length <= 120) && 'title length',
  p.ages.length === 0 && 'no age group',
  p.ages.some((a) => !ages.has(a)) && `age group not in the list (${p.ages.filter((a) => !ages.has(a)).join(' ')})`,
  p.gender && !['boys', 'girls', 'men', 'women'].includes(p.gender) && 'gender',
  !/^\d{4}-\d{2}-\d{2}$/.test(p.on) && 'date',
  /^\d{4}-\d{2}-\d{2}$/.test(p.on) && p.on < today && 'date has passed',
  !(p.time.length >= 1 && p.time.length <= 40) && 'time length',
  !(p.ground.length >= 2 && p.ground.length <= 120) && 'ground length',
  p.positions.some((x) => !TEN.includes(x)) && 'position not in the ten',
  !(/^https?:\/\/[^\s/]+\.\S+$/.test(p.source) && p.source.length <= 500) && 'source link',
  [p.title, p.time, p.ground].some((t) => EMAIL.test(t) || PHONE.test(t)) && 'carries an email address or phone number (D-172 U2)',
].filter(Boolean);
for (const r of rows) {
  const p = {
    club: tidy(r.club), title: tidy(r.title), ages: list(r.ages), gender: tidy(r.gender).toLowerCase(),
    on: tidy(r.trial_on), time: tidy(r.time), ground: tidy(r.ground), positions: list(r.positions), source: tidy(r.source_url),
  };
  const c = clubs.get(p.club.toLowerCase());
  if (!c) { plan.noClub.push(p.club || '(no club)'); continue; }
  const why = invalid(p);
  if (why.length) { plan.invalid.push(`${p.club} ${p.on} (${why.join(', ')})`); continue; }
  const k = nkey(c.id, p.on, p.title);
  if (there.has(k)) { plan.already.push(`${p.club} ${p.on}`); continue; }
  there.add(k);
  plan.add.push({ ...p, clubId: c.id });
}
console.log(`database: ${url.hostname} · operator: ${operator}`);
console.log(`rows: ${rows.length} · to add: ${plan.add.length} (at ${new Set(plan.add.map((p) => p.clubId)).size} clubs) · already there: ${plan.already.length} · club not listed: ${plan.noClub.length} · to fix: ${plan.invalid.length}`);
for (const p of [...plan.add].sort((a, b) => a.on.localeCompare(b.on))) console.log(`  + ${p.on}  ${p.club} — ${p.title} [${p.ages.join(' ')}${p.gender ? ' · ' + p.gender : ''}]`);
if (plan.noClub.length) console.log(`club not listed (by exact name): ${[...new Set(plan.noClub)].join(', ')}`);
if (plan.invalid.length) console.log(`fix before loading: ${plan.invalid.join('; ')}`);
if (!has('--apply')) { console.log('plan only. Nothing changed. Add --apply to load them.'); await client.end(); process.exit(0); }

let ok = 0; const refused = [];
for (const p of plan.add) {
  try {
    await client.query('begin');
    await client.query('select fn_ops_add_notice($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
      [op.id, operator, p.clubId, p.title, p.ages, p.gender || null, p.on, p.time, p.ground, p.positions, p.source]);
    await client.query('commit'); ok++;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    refused.push(`${p.club} ${p.on}: ${String(e.message).slice(0, 80)}`);
  }
}
console.log(`done: ${ok} added · ${refused.length} refused`);
for (const r of refused) console.log(`  refused ${r}`);
await client.end();
