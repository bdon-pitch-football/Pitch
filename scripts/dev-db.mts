// Local dev database: a real Postgres (PGlite) served over the wire protocol
// so the Next app talks to it exactly as it will talk to Sydney. Runs the
// migrations, seeds the three house fixtures, and issues KNOWN dev share
// tokens so the tokenised route can be exercised end to end:
//
//   /p/dev-deniz     live token, u16 → approved profile version (D-119)
//   /p/dev-nate      live token, 16–17 → live record assembly
//   /p/dev-georgia   live token, u16
//   /p/dev-expired   dead — expired yesterday
//   /p/dev-revoked   dead — revoked
//   /p/anything-else dead — never existed
//
// All fixture people are fictional (doc 16 §4).
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYER_FIXTURES } from '../lib/fixtures.ts';

const db = new PGlite();
const dir = fileURLToPath(new URL('../supabase/migrations', import.meta.url));
await db.exec(`
  create or replace function gen_random_bytes(n int) returns bytea language sql as
  $$ select decode(string_agg(lpad(to_hex((random()*255)::int),2,'0'),''), 'hex') from generate_series(1, n) $$;
`);
for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(dir, f), 'utf8'));
}

const sha = (s: string) => createHash('sha256').update(s).digest();

const guardian = randomUUID();
await db.query(`insert into person (id, first_name, last_name, dob) values ($1,'Alex','Fixture','1985-05-05')`, [guardian]);

for (const p of PLAYER_FIXTURES) {
  const personId = randomUUID();
  const clubId = randomUUID();
  const callId = randomUUID();
  const squadId = randomUUID();
  const recordId = randomUUID();

  await db.query(`insert into person (id, first_name, last_name, dob) values ($1,$2,$3,$4)`, [personId, p.firstName, p.lastName, p.dob]);
  await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [guardian, personId]);
  await db.query(`insert into club (id, name, club_state) values ($1,$2,'claimed')`, [clubId, p.club]);
  await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
    values ($1,$2,now(),'BUZ','03 9000 0000','FV club directory','verified','27@v1.0')`, [callId, clubId]);
  await db.query(`update club set club_state='verified', verified_call_id=$1 where id=$2`, [callId, clubId]);
  await db.query(`insert into squad (id, club_id, name, age_group, competition_gender, season) values ($1,$2,$3,$4,$5,'2026')`,
    [squadId, clubId, p.squad.name, p.squad.ageGroup, p.squad.competitionGender]);
  await db.query(`insert into membership (person_id, club_id, squad_id, role) values ($1,$2,$3,'player')`, [personId, clubId, squadId]);
  await db.query(`insert into development_record (id, person_id, positions, squad_number, foot, about, surfaced_stats)
    values ($1,$2,$3,$4,$5,$6,$7)`, [recordId, personId, p.positions, p.squadNumber, p.foot, p.about, p.surfacedStats]);
  for (const s of p.stats) {
    await db.query(`insert into player_stat (record_id, season, stat_key, value, provenance) values ($1,$2,$3,$4,$5)`,
      [recordId, s.season, s.key, s.value, s.provenance]);
  }
  for (const [i, a] of p.achievements.entries()) {
    await db.query(`insert into achievement (record_id, title, detail, sort) values ($1,$2,$3,$4)`, [recordId, a.title, a.detail, i]);
  }
  for (const e of p.otherFootball) {
    await db.query(`insert into experience_entry (record_id, kind, org_name, season_label, notes) values ($1,$2,$3,$4,$5)`,
      [recordId, e.kind, e.orgName, e.period, e.note ?? null]);
  }
  // u16: the public page renders the guardian-APPROVED snapshot (D-119)
  await db.query(`insert into profile_version (record_id, content, status, approved_by, approved_at) values ($1,$2,'approved',$3,now())`,
    [recordId, JSON.stringify(p), guardian]);
  await db.query(`insert into share_token (record_id, token_hash, issued_by, expires_at) values ($1,$2,$3, now() + interval '90 days')`,
    [recordId, sha(`dev-${p.slug}`), guardian]);
  if (p.slug === 'deniz') {
    await db.query(`insert into share_token (record_id, token_hash, issued_by, expires_at) values ($1,$2,$3, now() - interval '1 day')`,
      [recordId, sha('dev-expired'), guardian]);
    await db.query(`insert into share_token (record_id, token_hash, issued_by, revoked_at) values ($1,$2,$3, now())`,
      [recordId, sha('dev-revoked'), guardian]);
  }
}

const server = new PGLiteSocketServer({ db, port: 54322, host: '127.0.0.1' });
await server.start();
console.log('dev db ready on 127.0.0.1:54322 — tokens: dev-deniz dev-nate dev-georgia dev-expired dev-revoked');
