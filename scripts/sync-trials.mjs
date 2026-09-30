// The daily trials watch (BUZ, 30 Sep: "agents that track this every day").
// Two jobs, both through the operator's own functions (0130), so every change
// is a curation_event naming who made it:
//
//   --export <file>   every compiled notice on the board today, with its id,
//                     for the watch agents to check against the clubs' pages.
//
//   --changes <file>  the day's findings, one row each:
//                       check  the club's notice still says this  → "last checked" moves to today
//                       gone   the club has taken it down/cancelled → the notice comes down
//                       edit   the club's notice now says something else (full row given)
//                       add    a notice we don't have yet (full row given)
//     --scope safe    (default) applies check, gone, and an edit that keeps
//                     the notice's title — BUZ, 30 Sep: "update the
//                     information live as soon as non verified clubs update
//                     their dates and times". A new notice, or a changed
//                     title (new words on the site), waits for his yes.
//     --scope all     applies everything (BUZ runs this after reading the report).
//     --apply         without it, nothing changes: the plan is printed.
//
//   node --env-file=.env.production-db.local scripts/sync-trials.mjs --ca supabase/rehearsal-ca.crt \
//        --operator burak.donmez@pitch-football.com --changes <file> [--scope all] [--apply]
//
// A guard for a bad morning: a safe run that would take down more than
// MAX_GONE notices, or more than a quarter of the board, takes none of them
// down and says so — a watch agent that misread every page must not be able
// to empty the board. The output names clubs and dates, never an address.
import pg from 'pg';
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const MAX_GONE = 12;

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

const operator = (val('--operator') ?? '').trim().toLowerCase();
const exportPath = val('--export'), changesPath = val('--changes');
const scope = val('--scope') ?? 'safe';
if (!operator || (!exportPath && !changesPath) || !['safe', 'all'].includes(scope)) {
  console.error('usage: --operator <email> (--export <file> | --changes <file> [--scope safe|all] [--apply]) [--ca <cert>]');
  process.exit(1);
}
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

const client = new pg.Client({ connectionString: url.toString(), ssl, application_name: 'pitch-sync-trials' });
await client.connect();
const op = (await client.query('select id from person where lower(email) = $1', [operator])).rows[0];
if (!op) { console.error('refusing: no account with that operator address'); await client.end(); process.exit(1); }

const board = (await client.query(
  `select t.id, c.name as club, c.public_slug as slug, t.title, t.trial_on::text as on, t.time_venue, t.source_url,
          t.competition_gender as gender, t.last_checked::text as checked,
          array(select a.age_group from trial_notice_age_group a join age_group g on g.code = a.age_group
                where a.trial_notice_id = t.id order by g.sort) as ages
     from fn_trial_notices_advertised() t join club c on c.id = t.club_id
    where t.source = 'compiled' order by c.name, t.trial_on`)).rows;
const csvCell = (v) => { const s = Array.isArray(v) ? v.join(';') : String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

if (exportPath) {
  const head = ['notice_id', 'club', 'slug', 'title', 'ages', 'gender', 'trial_on', 'time_venue', 'source_url', 'last_checked'];
  const lines = [head.join(','), ...board.map((n) => [n.id, n.club, n.slug, n.title, n.ages, n.gender, n.on, n.time_venue, n.source_url, n.checked].map(csvCell).join(','))];
  writeFileSync(exportPath, lines.join('\n') + '\n');
  console.log(`exported ${board.length} compiled notices on the board to ${exportPath}`);
  if (!changesPath) { await client.end(); process.exit(0); }
}

const rows = parseCsv(readFileSync(changesPath, 'utf8'));
const tidy = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');
const list = (s) => [...new Set(tidy(s).split(/[;|]/).map((x) => x.trim().toUpperCase()).filter(Boolean))];
const onBoard = new Map(board.map((n) => [n.id, n]));
const clubs = new Map((await client.query('select id, name from club')).rows.map((c) => [c.name.toLowerCase(), c]));
const ages = new Set((await client.query('select code from age_group')).rows.map((r) => r.code));
const TEN = ['GK', 'RB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST'];
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne' }).format(new Date());
const EMAIL = /[^@\s]+@[^@\s]+\.[a-z]{2,}/i, PHONE = /(\+?61|\b0)[\s-]?[2-478](?:[\s-]?\d){8}\b/;
const there = new Set((await client.query(`select club_id, trial_on::text as on, lower(title) as t from trial_notice`)).rows.map((r) => `${r.club_id}|${r.on}|${r.t}`));
// fn_trial_notice_check's own rules (0130), checked first — as import-trials does.
const invalid = (p) => [
  !(p.title.length >= 3 && p.title.length <= 120) && 'title length',
  p.ages.length === 0 && 'no age group',
  p.ages.some((a) => !ages.has(a)) && 'age group not in the list',
  p.gender && !['boys', 'girls', 'men', 'women'].includes(p.gender) && 'gender',
  !/^\d{4}-\d{2}-\d{2}$/.test(p.on) && 'date',
  /^\d{4}-\d{2}-\d{2}$/.test(p.on) && p.on < today && 'date has passed',
  !(p.time.length >= 1 && p.time.length <= 40) && 'time length',
  !(p.ground.length >= 2 && p.ground.length <= 120) && 'ground length',
  p.positions.some((x) => !TEN.includes(x)) && 'position not in the ten',
  !(/^https?:\/\/[^\s/]+\.\S+$/.test(p.source) && p.source.length <= 500) && 'source link',
  [p.title, p.time, p.ground].some((t) => EMAIL.test(t) || PHONE.test(t)) && 'carries an email address or phone number (D-172 U2)',
].filter(Boolean);
const full = (r) => ({ club: tidy(r.club), title: tidy(r.title), ages: list(r.ages), gender: tidy(r.gender).toLowerCase(),
  on: tidy(r.trial_on), time: tidy(r.time), ground: tidy(r.ground), positions: list(r.positions), source: tidy(r.source_url),
  reason: tidy(r.reason) });

const plan = { check: [], gone: [], edit: [], add: [], waiting: [], refused: [] };
const seen = new Set();
for (const r of rows) {
  const action = tidy(r.action).toLowerCase();
  const id = tidy(r.notice_id);
  if (['check', 'gone', 'edit'].includes(action)) {
    const n = onBoard.get(id);
    if (!n) { plan.refused.push(`${action} ${id || '(no id)'}: not a compiled notice on the board`); continue; }
    if (seen.has(id)) { plan.refused.push(`${action} ${n.club} ${n.on}: the same notice twice`); continue; }
    seen.add(id);
    if (action === 'edit') {
      const p = full(r); const why = invalid(p);
      if (why.length) { plan.refused.push(`edit ${n.club} ${n.on}: ${why.join(', ')}`); continue; }
      plan.edit.push({ n, p, retitled: p.title !== n.title });
    } else plan[action].push({ n, reason: tidy(r.reason) });
  } else if (action === 'add') {
    const p = full(r); const c = clubs.get(p.club.toLowerCase());
    if (!c) { plan.refused.push(`add ${p.club}: club not listed by that exact name`); continue; }
    const why = invalid(p);
    if (why.length) { plan.refused.push(`add ${p.club} ${p.on}: ${why.join(', ')}`); continue; }
    const k = `${c.id}|${p.on}|${p.title.toLowerCase()}`;
    if (there.has(k)) { plan.refused.push(`add ${p.club} ${p.on}: already there`); continue; }
    there.add(k); plan.add.push({ ...p, clubId: c.id });
  } else plan.refused.push(`unknown action "${action}"`);
}
const goneLimit = Math.min(MAX_GONE, Math.ceil(board.length / 4));
const goneBlocked = scope === 'safe' && plan.gone.length > goneLimit;

console.log(`database: ${url.hostname} · operator: ${operator} · scope: ${scope}`);
console.log(`board: ${board.length} compiled · confirm: ${plan.check.length} · take down: ${plan.gone.length} · change: ${plan.edit.length} · add: ${plan.add.length} · refused: ${plan.refused.length}`);
for (const g of plan.gone) console.log(`  - down    ${g.n.on}  ${g.n.club} — ${g.n.title}${g.reason ? ` (${g.reason})` : ''}`);
for (const e of plan.edit) console.log(`  ${e.retitled && scope === 'safe' ? '~ waits  ' : '~ change  '}${e.n.on}→${e.p.on}  ${e.n.club} — ${e.p.title} · ${e.p.time} · ${e.p.ground}${e.p.reason ? ` (${e.p.reason})` : ''}`);
for (const a of plan.add) console.log(`  + add     ${a.on}  ${a.club} — ${a.title} [${a.ages.join(' ')}${a.gender ? ' · ' + a.gender : ''}]`);
for (const r of plan.refused) console.log(`  ! refused ${r}`);
if (goneBlocked) console.log(`HELD: ${plan.gone.length} take-downs is more than the ${goneLimit} a safe run may make. None will be taken down; BUZ decides with --scope all.`);
const waitingEdits = plan.edit.filter((e) => e.retitled).length;
if (scope === 'safe' && (waitingEdits || plan.add.length)) console.log(`waiting for BUZ: ${waitingEdits} retitled change(s) and ${plan.add.length} addition(s) — run again with --scope all to apply them.`);
if (!has('--apply')) { console.log('plan only. Nothing changed. Add --apply to do it.'); await client.end(); process.exit(0); }

const done = { check: 0, gone: 0, edit: 0, add: 0 }; const failed = [];
async function one(label, sql, params) {
  try { await client.query('begin'); await client.query(sql, params); await client.query('commit'); return true; }
  catch (e) { await client.query('rollback').catch(() => {}); failed.push(`${label}: ${String(e.message).slice(0, 80)}`); return false; }
}
for (const c of plan.check) if (await one(`check ${c.n.club} ${c.n.on}`, 'select fn_ops_check_notice($1, $2, $3)', [op.id, operator, c.n.id])) done.check++;
if (!goneBlocked) for (const g of plan.gone) if (await one(`down ${g.n.club} ${g.n.on}`, 'select fn_ops_remove_notice($1, $2, $3)', [op.id, operator, g.n.id])) done.gone++;
for (const e of plan.edit) if ((scope === 'all' || !e.retitled) && await one(`change ${e.n.club} ${e.n.on}`, 'select fn_ops_edit_notice($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
    [op.id, operator, e.n.id, e.p.title, e.p.ages, e.p.gender || null, e.p.on, e.p.time, e.p.ground, e.p.positions, e.p.source])) done.edit++;
if (scope === 'all') {
  for (const a of plan.add) if (await one(`add ${a.club} ${a.on}`, 'select fn_ops_add_notice($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
    [op.id, operator, a.clubId, a.title, a.ages, a.gender || null, a.on, a.time, a.ground, a.positions, a.source])) done.add++;
}
console.log(`done: ${done.check} confirmed · ${done.gone} taken down · ${done.edit} changed · ${done.add} added · ${failed.length} failed`);
for (const f of failed) console.log(`  failed ${f}`);
await client.end();
