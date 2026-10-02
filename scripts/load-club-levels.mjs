// Loads each club's senior league into club_level (0172), for the trials
// board's Club level filter (BUZ approved 2 Oct; John's ruling 2 Oct).
//
//   node --env-file=.env.production-db.local scripts/load-club-levels.mjs --ca supabase/rehearsal-ca.crt \
//        --csv ../content/sales/pipeline/club-levels-2026.csv            # plan: prints what it would write
//   ... --apply                                                         # write it
//
// Columns read: club, suburb, league_as_named (or tier), level (optional:
// npl, vpl, sl or community, or NPL / Victoria Premier League / State League
// / Community — read from the league's name only when the file has no level
// column; a blank level in a file that has one is no level),
// source_url, checked_on (YYYY-MM-DD).
//
// The rules, each one a refusal printed with its reason:
//   - no source_url or no checked_on, no level (John, 2 Oct: "a club with no
//     source gets no level"); a checked date in the future is no date
//   - the club must be on Pitch already, found by name and suburb the way
//     the operator's own duplicate check finds it (fn_club_listing_key, 0130),
//     and found once; a club listed twice in the file is loaded once
//   - Alamein FC is refused, whatever the row says (BUZ, 2 Oct: "keep that
//     out of our list for now"): it gets no level and stays in no level chip
//   - a league the script cannot place in NPL, Victoria Premier League,
//     State League or Community is refused, never guessed
// A re-check (season changeover) is the same load again: a club already
// carrying a level is updated, and the plan says what changes.
//
// Plan by default; --apply writes every row in ONE transaction, so a load
// lands whole or not at all. The connection string comes from
// SUPABASE_DB_URL and is never printed; anything that is not localhost needs
// --ca and is verified (as scripts/apply-migrations.mjs). 54323 is the demo
// and is refused. The output names clubs and leagues — public facts — and
// never an address.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// BUZ's holds: a club named here gets no level whatever a file says.
export const HELD = [{ club: /\balamein\b/i, why: 'held by BUZ, 2 Oct: "keep that out of our list for now"' }];

// The league as its source names it, placed in one of the four levels.
// "NPL Women Victoria" is NPL: a club's level is the highest league any of
// its senior teams plays in, men's or women's (B1, BUZ 2 Oct).
// A file with a level column has decided every row: the level is read from
// it (as a code, or as the filter's own name for it), and a blank level is
// that file's "no level" — never a cue to guess one from the league's name
// (the FV list leaves Point Cook and Albert Park blank on purpose, 2 Oct).
const LEVEL_NAMES = { npl: 'npl', vpl: 'vpl', 'victoria premier league': 'vpl', sl: 'sl', 'state league': 'sl', community: 'community' };
export function levelOf(row) {
  if ('level' in row) return LEVEL_NAMES[String(row.level ?? '').trim().toLowerCase()] ?? null;
  const league = (row.league_as_named || row.tier || '').trim();
  if (/^NPL\b/i.test(league)) return 'npl';
  if (/^(Victoria(n)? Premier League|VPL)\b/i.test(league)) return 'vpl';
  if (/^State League\b/i.test(league)) return 'sl';
  if (/^community$/i.test(league)) return 'community';
  return null;
}

// The same reader as scripts/import-clubs.mjs: quoted cells, commas and
// newlines inside quotes, a header row naming the columns.
export function parseCsv(text) {
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
  const [head = [], ...body] = rows;
  // Headers are read case-blind: a file headed "Level" is a file with a
  // level column, never one whose levels are guessed (safety review, N2).
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim().toLowerCase(), (r[i] ?? '').trim()])));
}

const tidy = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');
const melbourneToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });

// What a load would do, asked of the database through `q(sql, params)` —
// a pg client's query, or PGlite's. Reads only.
export async function planLevels(q, rows, today = melbourneToday()) {
  const plan = { add: [], change: [], same: [], refused: [] };
  const seen = new Set();
  for (const r of rows) {
    const name = tidy(r.club), suburb = tidy(r.suburb);
    const league = tidy(r.league_as_named || r.tier), source = tidy(r.source_url), checked = tidy(r.checked_on);
    const refuse = (why) => plan.refused.push({ club: name || '(no name)', suburb, why });
    const held = HELD.find((h) => h.club.test(name));
    if (held) { refuse(held.why); continue; }
    if (!name || !suburb) { refuse('no club name or suburb'); continue; }
    if (!source) { refuse('no source_url'); continue; }
    if (!/^https?:\/\/\S+$/.test(source) || source.length > 500) { refuse('source_url is not a web address'); continue; }
    if (!checked) { refuse('no checked_on'); continue; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checked) || Number.isNaN(Date.parse(`${checked}T00:00:00Z`))
      || new Date(`${checked}T00:00:00Z`).toISOString().slice(0, 10) !== checked) { refuse('checked_on is not a date (YYYY-MM-DD)'); continue; }
    if (checked > today) { refuse('checked_on is in the future'); continue; }
    // The board shows no level checked more than twelve months ago
    // (fn_club_levels_current, 0172), so loading one would load nothing.
    const yearAgo = new Date(`${today}T00:00:00Z`); yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1);
    if (checked <= yearAgo.toISOString().slice(0, 10)) { refuse('checked_on is more than twelve months ago: re-check it first'); continue; }
    const level = levelOf(r);
    if (!level) { refuse('level' in r && !String(r.level ?? '').trim() ? 'no level in the file' : `league not placed in a level: "${r.level || league || ''}"`); continue; }
    if (league.length < 2 || league.length > 120) { refuse('league_as_named missing or too long'); continue; }
    const found = (await q(`select c.id, c.name, c.suburb, l.level, l.league_as_named, l.source_url, to_char(l.checked_on, 'YYYY-MM-DD') as checked_on
      from club c left join club_level l on l.club_id = c.id
      where fn_club_listing_key(c.name, c.suburb) = fn_club_listing_key($1, $2)`, [name, suburb])).rows;
    if (found.length === 0) { refuse('no club on Pitch with that name and suburb'); continue; }
    if (found.length > 1) { refuse(`${found.length} clubs on Pitch match that name and suburb`); continue; }
    const c = found[0];
    // And the club as Pitch names it: a hold follows the club, however the
    // file or a rename spells it (safety review, N1).
    const heldOnPitch = HELD.find((h) => h.club.test(c.name));
    if (heldOnPitch) { refuse(heldOnPitch.why); continue; }
    if (seen.has(c.id)) { refuse('listed twice in the file; the first row is loaded'); continue; }
    seen.add(c.id);
    const next = { club_id: c.id, club: c.name, suburb: c.suburb, level, league, source, checked };
    if (!c.level) plan.add.push(next);
    else if (c.level === level && c.league_as_named === league && c.source_url === source && c.checked_on === checked) plan.same.push(next);
    else plan.change.push({ ...next, was: `${c.level} · ${c.league_as_named} · checked ${c.checked_on}` });
  }
  return plan;
}

// Writes a plan, whole or not at all.
export async function applyLevels(q, plan) {
  await q('begin');
  try {
    for (const p of [...plan.add, ...plan.change]) {
      await q(`insert into club_level (club_id, level, league_as_named, source_url, checked_on)
        values ($1, $2, $3, $4, $5::date)
        on conflict (club_id) do update set level = excluded.level, league_as_named = excluded.league_as_named,
          source_url = excluded.source_url, checked_on = excluded.checked_on, loaded_at = now()`,
        [p.club_id, p.level, p.league, p.source, p.checked]);
    }
    await q('commit');
  } catch (e) { await q('rollback').catch(() => {}); throw e; }
  return plan.add.length + plan.change.length;
}

export function describe(plan) {
  const line = (p) => `${p.club} (${p.suburb}) → ${p.level} · ${p.league} · checked ${p.checked} · ${p.source}`;
  return [
    `to insert: ${plan.add.length} · to update: ${plan.change.length} · unchanged: ${plan.same.length} · refused: ${plan.refused.length}`,
    ...plan.add.map((p) => `  insert  ${line(p)}`),
    ...plan.change.map((p) => `  update  ${line(p)} (was ${p.was})`),
    ...plan.refused.map((r) => `  refuse  ${r.club}${r.suburb ? ` (${r.suburb})` : ''}: ${r.why}`),
  ].join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const has = (f) => args.includes(f);
  const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
  const csvPath = val('--csv');
  if (!csvPath) { console.error('usage: --csv <file> [--ca <cert>] [--apply]'); process.exit(1); }
  const raw = process.env.SUPABASE_DB_URL;
  if (!raw) { console.error('SUPABASE_DB_URL is not set (load it with node --env-file=<file>; never paste it)'); process.exit(1); }
  const url = new URL(raw);
  const local = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  if (local && url.port === '54323') { console.error('refusing: 54323 is the demo database'); process.exit(1); }
  url.searchParams.delete('sslmode');      // pg would let this override the explicit TLS settings below
  let ssl;
  if (!local) {
    const ca = val('--ca');
    if (!ca) { console.error('refusing: a remote database needs --ca <Supabase CA certificate file> so the server is verified'); process.exit(1); }
    ssl = { ca: readFileSync(ca, 'utf8'), rejectUnauthorized: true };
  }
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: url.toString(), ssl, application_name: 'pitch-load-club-levels' });
  await client.connect();
  const q = (sql, p) => client.query(sql, p);
  const rows = parseCsv(readFileSync(csvPath, 'utf8'));
  console.log(`database: ${url.hostname} · rows: ${rows.length}`);
  const plan = await planLevels(q, rows);
  console.log(describe(plan));
  if (!has('--apply')) { console.log('plan only. Nothing changed. Add --apply to write it.'); await client.end(); process.exit(0); }
  const n = await applyLevels(q, plan);
  console.log(`done: ${n} written in one transaction`);
  await client.end();
}
