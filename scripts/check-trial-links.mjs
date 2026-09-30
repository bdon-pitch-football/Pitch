// Checks the link on every compiled trial notice still on the board (D-90),
// and takes down a notice whose link is dead (John, 30 Sep: "a dead link
// takes the notice down ... the check that finds it should remove it rather
// than flag it"). Through the operator's own function (fn_ops_remove_notice,
// 0130), so each removal is a curation_event carrying who did it.
//
//   node --env-file=.env.production-db.local scripts/check-trial-links.mjs --ca supabase/rehearsal-ca.crt \
//        --operator burak.donmez@pitch-football.com        # plan: what it would take down
//   ... --apply                                             # take them down
//
// Dead means the club's page is gone: 404 or 410, or the site's name no
// longer resolves. Anything else it cannot read (a timeout, a 5xx, a site
// that refuses robots with 403/429) is listed as "could not check" and left
// up — a slow club website is not a withdrawn trial. A live link does NOT
// move "last checked": that stamp says a person read the notice, and this
// only knocked on the door.
import pg from 'pg';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const operator = (val('--operator') ?? '').trim().toLowerCase();
if (!operator) { console.error('usage: --operator <operator email> [--ca <cert>] [--apply]'); process.exit(1); }
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

const client = new pg.Client({ connectionString: url.toString(), ssl, application_name: 'pitch-check-trial-links' });
await client.connect();
const op = (await client.query('select id from person where lower(email) = $1', [operator])).rows[0];
if (!op) { console.error('refusing: no account with that operator address'); await client.end(); process.exit(1); }

const notices = (await client.query(
  `select t.id, t.title, t.trial_on::text as on, t.source_url, c.name as club
     from fn_trial_notices_advertised() t join club c on c.id = t.club_id
    where t.source = 'compiled' order by t.trial_on`)).rows;

async function knock(u) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const r = await fetch(u, { method, redirect: 'follow', signal: AbortSignal.timeout(15000),
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; PitchNoticeCheck/1.0; +https://pitchfootball.com.au)' } });
      if (r.status === 405 && method === 'HEAD') continue;
      if (r.status === 404 || r.status === 410) return { dead: true, why: String(r.status) };
      if (r.ok) return { dead: false, ok: true };
      if (method === 'HEAD') continue;
      return { dead: false, why: String(r.status) };
    } catch (e) {
      const code = e?.cause?.code ?? e?.name ?? 'error';
      if (code === 'ENOTFOUND') return { dead: true, why: 'site no longer resolves' };
      if (method === 'GET') return { dead: false, why: code };
    }
  }
  return { dead: false, why: 'unreadable' };
}

const dead = [], unsure = []; let live = 0;
for (let i = 0; i < notices.length; i += 8) {
  const batch = notices.slice(i, i + 8);
  const res = await Promise.all(batch.map((n) => knock(n.source_url)));
  batch.forEach((n, j) => {
    if (res[j].dead) dead.push({ ...n, why: res[j].why });
    else if (res[j].ok) live++;
    else unsure.push({ ...n, why: res[j].why });
  });
}
console.log(`database: ${url.hostname} · operator: ${operator}`);
console.log(`compiled notices on the board: ${notices.length} · link live: ${live} · dead: ${dead.length} · could not check: ${unsure.length}`);
for (const n of dead) console.log(`  dead  ${n.on}  ${n.club} — ${n.title} (${n.why})`);
for (const n of unsure) console.log(`  ?     ${n.on}  ${n.club} — ${n.title} (${n.why})`);
if (!has('--apply')) { console.log('plan only. Nothing changed. Add --apply to take the dead ones down.'); await client.end(); process.exit(0); }

let ok = 0; const refused = [];
for (const n of dead) {
  try {
    await client.query('begin');
    await client.query('select fn_ops_remove_notice($1, $2, $3)', [op.id, operator, n.id]);
    await client.query('commit'); ok++;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    refused.push(`${n.club} ${n.on}: ${String(e.message).slice(0, 80)}`);
  }
}
console.log(`done: ${ok} taken down · ${refused.length} refused`);
for (const r of refused) console.log(`  refused ${r}`);
await client.end();
