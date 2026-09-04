// Runs every SQL migration against an embedded Postgres (PGlite) in order,
// then smoke-tests the structural invariants the schema claims to enforce.
// This is NOT the doc 14 suite — it is the "does the schema even hold" gate
// that runs before anything touches the real Sydney database.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const db = new PGlite();
const dir = fileURLToPath(new URL('../supabase/migrations', import.meta.url));

// PGlite does not bundle pgcrypto; the real Sydney database has it. Shim the
// one function the waitlist migration uses so structure validation can run.
await db.exec(`
  create or replace function gen_random_bytes(n int) returns bytea language sql as
  $$ select decode(string_agg(lpad(to_hex((random()*255)::int),2,'0'),''), 'hex') from generate_series(1, n) $$;
`);
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

for (const f of files) {
  try {
    await db.exec(readFileSync(join(dir, f), 'utf8'));
    console.log(`OK   ${f}`);
  } catch (e) {
    console.error(`FAIL ${f}: ${e.message}`);
    process.exit(1);
  }
}

// --- structural invariant smoke tests ---------------------------------------
let failures = 0;
async function expectFail(label, sql) {
  try {
    await db.exec(sql);
    console.error(`FAIL ${label} — write was allowed and must not be`);
    failures++;
  } catch {
    console.log(`OK   ${label}`);
  }
}
async function expectOk(label, sql) {
  try {
    await db.exec(sql);
    console.log(`OK   ${label}`);
  } catch (e) {
    console.error(`FAIL ${label}: ${e.message}`);
    failures++;
  }
}

// D-108 / N11: no fourth club_status, no verdict words
await db.exec(`insert into person (id, first_name) values ('00000000-0000-0000-0000-000000000001','Test');
insert into club (id, name) values ('00000000-0000-0000-0000-00000000000c','Fixture Club');`);
await expectFail('N11: club_status=declined is unwritable', `
  insert into registration (player_id, club_id, club_status, policy_version)
  values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','declined','20@v2.4');`);

// D-126 / M4: club_state=verified requires a logged human call
await expectFail('M4: verified without a verification_call row is impossible', `
  update club set club_state='verified' where id='00000000-0000-0000-0000-00000000000c';`);
await expectFail("M4: operator 'system' is rejected", `
  insert into verification_call (club_id, called_at, operator, number_called, number_source, outcome, policy_version)
  values ('00000000-0000-0000-0000-00000000000c', now(), 'system', '03 9000 0000', 'club website /contact', 'verified', '27@v1.0');`);
await expectFail('M4: blank number_source invalidates the call', `
  insert into verification_call (club_id, called_at, operator, number_called, number_source, outcome, policy_version)
  values ('00000000-0000-0000-0000-00000000000c', now(), 'BUZ', '03 9000 0000', '  ', 'verified', '27@v1.0');`);
await expectOk('M4: a properly logged human call inserts', `
  insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
  values ('00000000-0000-0000-0000-0000000000ca','00000000-0000-0000-0000-00000000000c', now(), 'BUZ', '03 9000 0000', 'FV club directory', 'verified', '27@v1.0');`);
await expectOk('M4: verified with the call row linked succeeds', `
  update club set club_state='verified', verified_call_id='00000000-0000-0000-0000-0000000000ca'
  where id='00000000-0000-0000-0000-00000000000c';`);

// D-128 / N7: withdrawal empties the note in the same transaction (belt trigger)
await db.exec(`
  insert into registration (id, player_id, club_id, note, policy_version)
  values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-00000000000c','I train Tuesdays','20@v2.4');`);
await db.exec(`update registration set withdrawn_at=now() where id='00000000-0000-0000-0000-0000000000e1';`);
const { rows } = await db.query(`select note from registration where id='00000000-0000-0000-0000-0000000000e1';`);
if (rows[0].note === null) console.log('OK   N7: withdrawal emptied the note atomically');
else { console.error('FAIL N7: note survived withdrawal'); failures++; }

// D-19/D-26: consent_event is append-only at the storage level
await db.exec(`insert into consent_event (event) values ('approved');`);
await expectFail('append-only: consent_event UPDATE refused', `update consent_event set event='purged';`);
await expectFail('append-only: consent_event DELETE refused', `delete from consent_event;`);

// D-60: numeric band is unwritable
await expectFail('D-60: numeric assessment band rejected', `
  insert into assessment_entry (record_id, competency_id, band, author_id)
  values (gen_random_uuid(), gen_random_uuid(), '7', gen_random_uuid());`);

// D-69: four positions rejected
await expectFail('D-69: more than three positions rejected', `
  insert into development_record (person_id, positions)
  values ('00000000-0000-0000-0000-000000000001', array['GK','CB','CM','ST']);`);

// J1: no stored permission flags / age bands anywhere
const cols = await db.query(`
  select table_name, column_name from information_schema.columns
  where table_schema='public' and (
    column_name in ('is_visible','can_view','is_public','age_band','position_status','primary_position','secondary_position','position_group','school','wwcc_number')
  );`);
if (cols.rows.length === 0) console.log('OK   J1: no forbidden stored flags/columns exist');
else { console.error('FAIL J1: forbidden columns found:', JSON.stringify(cols.rows)); failures++; }

console.log(failures === 0 ? '\nALL GREEN' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
