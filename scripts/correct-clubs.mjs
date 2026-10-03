// Corrects details of clubs already listed, through the operator's own
// function (fn_ops_edit_club, 0130): one club per transaction, each edit
// recorded in curation_event with its before and after, and only while the
// club is unclaimed — a club that has claimed its page runs it (D-90).
// (BUZ, 3 Oct: the club list completion's corrections for loaded clubs.)
//
//   node --env-file=.env.production-db.local scripts/correct-clubs.mjs --ca supabase/rehearsal-ca.crt \
//        --csv <corrections-for-loaded-clubs.csv> --operator burak.donmez@pitch-football.com     # plan
//   ... --apply                                                                                   # do it
//
// Columns read: club, field, old, new. Fields Pitch holds: suburb,
// contact_email, website (the listing's source link). notes and tier are
// not held on a listing and are reported as such. A field is changed only
// when Pitch holds exactly the file's old value today — anything else is
// refused with its reason, never overwritten. The output names clubs and
// suburbs, never an address.
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };

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
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim().toLowerCase(), (r[i] ?? '').trim()])));
}

const tidy = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');
// The file's field → the listing's column, as the importer filled it.
const COLUMN = { suburb: 'suburb', contact_email: 'contact_email', website: 'listing_source' };
const same = (a, b, col) => (col === 'contact_email' ? tidy(a).toLowerCase() === tidy(b).toLowerCase() : tidy(a) === tidy(b));

// What the corrections would do, asked of the database through q(sql, params).
// Reads only.
export async function planCorrections(q, rows) {
  const byClub = new Map();
  for (const r of rows) {
    const club = tidy(r.club);
    if (!club) continue;
    byClub.set(club, [...(byClub.get(club) ?? []), r]);
  }
  const plan = { edit: [], refused: [], notHeld: [] };
  for (const [club, fixes] of byClub) {
    const found = (await q(`select id, name, suburb, state, club_state, contact_email, listing_source from club
      where regexp_replace(lower(btrim(name)), '\\s+', ' ', 'g') = $1`, [club.toLowerCase()])).rows;
    if (found.length !== 1) { plan.refused.push({ club, why: found.length ? `${found.length} clubs on Pitch have that name` : 'no club on Pitch with that name' }); continue; }
    const c = found[0];
    if (c.club_state !== 'unclaimed') { plan.refused.push({ club, why: 'claimed: the club runs its own page (D-90)' }); continue; }
    const next = { suburb: c.suburb, contact_email: c.contact_email, listing_source: c.listing_source };
    const changes = []; let ok = true;
    for (const f of fixes) {
      const field = tidy(f.field).toLowerCase(), col = COLUMN[field];
      if (!col) { plan.notHeld.push({ club, field }); continue; }
      if (!same(c[col], f.old, col)) { plan.refused.push({ club, why: `${field} on Pitch is not the file's old value` }); ok = false; break; }
      if (!tidy(f.new)) { plan.refused.push({ club, why: `${field}: no new value` }); ok = false; break; }
      next[col] = tidy(f.new);
      changes.push(field === 'suburb' ? `suburb ${tidy(f.old)} → ${tidy(f.new)}` : `${field} changes`);
    }
    if (!ok || changes.length === 0) continue;
    plan.edit.push({ id: c.id, club: c.name, state: c.state, ...next, changes });
  }
  return plan;
}

export async function applyCorrections(client, plan, opId, operator) {
  let done = 0; const failed = [];
  for (const e of plan.edit) {
    try {
      await client.query('begin');
      await client.query('select fn_ops_edit_club($1, $2, $3, $4, $5, $6, $7, $8)',
        [opId, operator, e.id, e.club, e.suburb, e.state, e.contact_email, e.listing_source]);
      await client.query('commit'); done++;
    } catch (err) {
      await client.query('rollback');
      failed.push(`${e.club}: ${String(err.message).slice(0, 100)}`);
    }
  }
  return { done, failed };
}

export function describe(plan) {
  return [
    `to correct: ${plan.edit.length} clubs · refused: ${plan.refused.length} · fields Pitch does not hold: ${plan.notHeld.length}`,
    ...plan.edit.map((e) => `  correct ${e.club}: ${e.changes.join('; ')}`),
    ...plan.refused.map((r) => `  refuse  ${r.club}: ${r.why}`),
    ...plan.notHeld.map((n) => `  skip    ${n.club}: ${n.field} (not held on a listing)`),
  ].join('\n');
}

// Run as a script (the path may hold spaces, so compare as URLs).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
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
  const client = new pg.Client({ connectionString: url.toString(), ssl, application_name: 'pitch-correct-clubs' });
  await client.connect();
  const op = (await client.query('select id from person where lower(email) = $1', [operator])).rows[0];
  if (!op) { console.error('refusing: no account with that operator address'); await client.end(); process.exit(1); }
  const plan = await planCorrections((s, p) => client.query(s, p), parseCsv(readFileSync(csvPath, 'utf8')));
  console.log(describe(plan));
  if (!has('--apply')) { console.log('plan only. Nothing changed. Add --apply to correct them.'); await client.end(); process.exit(0); }
  const { done, failed } = await applyCorrections(client, plan, op.id, operator);
  console.log(`done: ${done} corrected · ${failed.length} refused by the database`);
  for (const f of failed) console.log(`  refused ${f}`);
  await client.end();
}
