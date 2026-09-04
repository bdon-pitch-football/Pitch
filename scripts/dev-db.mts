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
await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,'Alex','Fixture','1985-05-05','guardian@example.com')`, [guardian]);

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

// --- club-side seed: a working register at Riverside (verified, active
// subscription, TD login) and a claimed-but-unverified club with held
// registrations for the ops console. All fictional.
const riverside = (await db.query(`select id from club where name='Riverside FC'`)).rows[0].id as string;
await db.query(`update club set subscription_status='active' where id=$1`, [riverside]);
const td = randomUUID();
await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,'Marina','Petrovic','1980-04-12','td@example.com')`, [td]);
await db.query(`insert into membership (person_id, club_id, role) values ($1,$2,'technical_director')`, [td, riverside]);

const sunbury = randomUUID();
await db.query(`insert into club (id, name, suburb, state, club_state, contact_email) values ($1,'Sunbury United','Sunbury','VIC','claimed','football@sunburyunited.example.au')`, [sunbury]);
const sunburyAdmin = randomUUID();
await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,'M.','Harris','1979-01-20','sunbury@example.com')`, [sunburyAdmin]);
await db.query(`insert into membership (person_id, club_id, role) values ($1,$2,'club_admin')`, [sunburyAdmin, sunbury]);

// registrations: fixture players onto Riverside's register (parent-sent),
// and held ones at Sunbury
const players = await db.query(`select p.id, p.first_name from person p join development_record dr on dr.person_id = p.id`);
for (const pl of players.rows as { id: string; first_name: string }[]) {
  await db.query(
    `insert into registration (player_id, club_id, positions, note, club_status, disclosed_by, policy_version)
     values ($1,$2,$3,$4,$5,$6,'20@v2.4')`,
    [pl.id, riverside, pl.first_name === 'Nate' ? ['GK'] : ['CM'],
     pl.first_name === 'Nate' ? 'Been on the bench behind a keeper two years older. Want game time.' : null,
     pl.first_name === 'Nate' ? 'shortlisted' : 'new', guardian],
  );
  await db.query(
    `insert into registration (player_id, club_id, positions, club_status, disclosed_by, policy_version)
     values ($1,$2,$3,'new',$4,'20@v2.4')`,
    [pl.id, sunbury, ['CM'], guardian],
  );
}

// public club page seed (ClubCV): slug, girls'/women's squads, trials,
// players wanted, alumni wall
await db.query(`update club set public_slug='riverside-fc', established='1974', pathway_line='MiniRoos → Juniors → Seniors pathway', philosophy='Every junior plays, every junior develops. Football that is brave on the ball, and a club where families stay for a decade — not a season.' where id=$1`, [riverside]);
await db.query(`insert into squad (club_id,name,age_group,competition_gender,season) values ($1,'U13 Girls','U13','girls','2026'),($1,'U16 Girls','U16','girls','2026'),($1,'Seniors Women','SEN','women','2026')`, [riverside]);
await db.query(`insert into trial_notice (club_id,title,trial_on,time_venue,position_needs,age_group,competition_gender,cv_email) values
  ($1,'U14 & U15 Boys trials','2026-10-11','Sun 9:00 AM · Riverside Park, Pitch 2',array['GK','CB'],'U15','boys','football@riversidefc.example.au'),
  ($1,'Girls U13–U16 trials','2026-10-18','Sun 10:00 AM · Riverside Park, Pitch 1',array[]::text[],'U16','girls','football@riversidefc.example.au')`, [riverside]);
await db.query(`insert into players_wanted_notice (club_id,title,detail) values ($1,'U13 Boys — Goalkeeper','Train Tue & Thu · immediate start'),($1,'U16 Girls — 2 outfield spots','Season 2027 squad')`, [riverside]);
await db.query(`insert into alumni_entry (club_id,line,detail,sort) values ($1,'Marco V. → NPL Victoria','Riverside juniors 2012–2018',0),($1,'Aylin D. → State representative squad','Riverside juniors 2011–2017',1),($1,'A 2019 U13 → our senior first team','Straight through the pathway, still playing',2)`, [riverside]);

// coach fixture: Sam Kaya (doc 16 §3b) with a published public slug
const sam = randomUUID();
await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,'Sam','Kaya','1988-02-02','coach@example.com')`, [sam]);
await db.query(`insert into membership (person_id, club_id, role) values ($1,$2,'coach')`, [sam, riverside]);
await db.query(`insert into wwcc_attestation (person_id, club_id, attested_by) values ($1,$2,$3)`, [sam, riverside, td]);
const samProfile = randomUUID();
await db.query(`insert into coach_profile (id, person_id, public_slug, region, philosophy, badges) values ($1,$2,'sam-kaya','Melbourne VIC','Possession with purpose. Every player touches the ball every drill, every session — confidence first, patterns second. Development over results at junior level, always.', array['AFC C Diploma'])`, [samProfile, sam]);
await db.query(`insert into coach_role (coach_profile_id, title, org_name, started_year, ended_year, sort) values
  ($1,'Head Coach · U15 Boys','Riverside FC','2024',null,0),
  ($1,'Assistant Coach · U14 Boys','Northern United SC','2021','2023',1),
  ($1,'Junior Coach · MiniRoos','Northern United SC','2018','2021',2)`, [samProfile]);

// --- walkthrough states: one of each waiting card, so every journey has
// something real to open. All fictional (doc 16 §4).
const recOf = async (name: string) =>
  (await db.query(`select dr.id from development_record dr join person p on p.id = dr.person_id where p.first_name = $1`, [name])).rows[0].id as string;
const personOf = async (name: string) =>
  (await db.query(`select id from person where first_name = $1`, [name])).rows[0].id as string;

// 1. Deniz has a pending edit waiting on his guardian (D-119)
const denizRec = await recOf('Deniz');
await db.query(
  `insert into profile_version (record_id, content, status)
   select $1, jsonb_set(content::jsonb, '{about}', '"Right-footed 10 who plays between the lines. Two-footed now — weak-foot finishing every Thursday since March."'), 'pending'
   from profile_version where record_id = $1 and status = 'approved'`,
  [denizRec],
);

// 2. Georgia has asked to send her CV to a club (D-99)
const georgiaRec = await recOf('Georgia');
await db.query(
  `insert into share_request (record_id, requested_by, destination)
   values ($1, (select person_id from development_record where id = $1), 'Sunbury United <football@sunburyunited.example.au>')`,
  [georgiaRec],
);

// 3. Nate has asked to go on a club register (D-108 via D-91)
const nateRec = await recOf('Nate');
await db.query(
  `insert into registration_request (record_id, club_id, positions, note)
   values ($1, $2, array['GK'], 'Been on the bench behind a keeper two years older. Want game time.')`,
  [nateRec, riverside],
);

// 4. Riverside has invited Georgia to a trial — waiting on her guardian (D-117)
const georgiaReg = (await db.query(
  `select id from registration where player_id = $1 and club_id = $2 limit 1`,
  [await personOf('Georgia'), riverside],
)).rows[0].id as string;
await db.query(`update registration set club_status = 'invited' where id = $1`, [georgiaReg]);
await db.query(
  `insert into invitation (club_id, registration_id, body)
   values ($1, $2, $3)`,
  [riverside, georgiaReg, JSON.stringify({ kind: 'trial', note: "Saw Georgia at Werribee. We're light in midfield for the 16s and we'd like a proper look at her." })],
);

// 5. Nate is shortlisted on Riverside's register so the TD has an invite to send
await db.query(
  `update registration set club_status = 'shortlisted'
   where player_id = $1 and club_id = $2`,
  [await personOf('Nate'), riverside],
);

const server = new PGLiteSocketServer({ db, port: 54322, host: '127.0.0.1' });
await server.start();
console.log('dev db ready on 127.0.0.1:54322');
console.log('  tokens : dev-deniz dev-nate dev-georgia dev-expired dev-revoked');
console.log('  sign-in: guardian@example.com (parent) · td@example.com (club TD) · coach@example.com (coach) · sunbury@example.com (unverified club)');
