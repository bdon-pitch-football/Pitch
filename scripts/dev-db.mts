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
//   /p/dev-teodor    live token, 18+, at a club that is claimed again (D-174)
//   /p/anything-else dead — never existed
//
// All fixture people are fictional (doc 16 §4).
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createHash, randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYER_FIXTURES } from '../lib/fixtures.ts';
import { DEMO_DB_PORT, demoDbPort } from '../lib/demo.ts';
import { PRESETS } from '../lib/club-colours.ts';

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

// Prove a fixture's address the way the product proves one (0056, L21): the
// evidence — a link we sent, opened — has to be in the database or the write
// is refused. A seat nobody proved is a seat nobody can sit in, and a parent
// nobody proved cannot hold a child at all.
const proveAddress = async (personId: string) => {
  await db.query(
    `insert into email_proof (person_id, token_hash, expires_at, used_at)
     values ($1, $2, now() + interval '7 days', now())
     on conflict (token_hash) do nothing`, [personId, sha(`seed-proof-${personId}`)]);
  await db.query(`update person set email_proved_at = coalesce(email_proved_at, now()) where id = $1`, [personId]);
};

// A seat that did not attach is a seat nobody can sit in, and a silent one is
// worse than a loud one: every club-side page in this seed hangs off the TD.
const tdOrThrow = async (personId: string, clubId: string, club: string) => {
  const { rows } = await db.query(
    `select 1 from membership where person_id=$1 and club_id=$2 and role='technical_director' and ended_at is null`,
    [personId, clubId]);
  if (rows.length === 0) throw new Error(`${club}: the verification call recorded no technical director (0058)`);
};

const guardian = randomUUID();
await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,'Alex','Fixture','1985-05-05','guardian@example.com')`, [guardian]);
await proveAddress(guardian);

for (const p of PLAYER_FIXTURES) {
  const personId = randomUUID();
  const clubId = randomUUID();
  const callId = randomUUID();
  const squadId = randomUUID();
  const recordId = randomUUID();

  // An adult has no guardian, no approval step and no consent log written on
  // their behalf. The seed used to attach Alex to every fixture, which is
  // fine while every fixture is a child and wrong the moment one is not.
  const isAdult = new Date(p.dob) <= new Date('2008-09-08');
  // Jordan gets an account. The PLAYER is the primary seat in this product
  // and it was the ONLY one with no way to sign in — so the player's own
  // navigation was the one path never crawled, never render-tested and never
  // walked. The three children are guardian-managed; an adult player signs
  // in as themselves.
  // Nate gets one too. A 16-17 sends their own CV (doc 14 L5), and with no
  // way to sign in that path had never been walked by anything — which is
  // how it came to go nowhere. The two under-16s stay guardian-managed.
  const seatEmail = p.slug === 'jordan' ? 'player@example.com' : p.slug === 'nate' ? 'nate@example.com' : null;
  await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,$2,$3,$4,$5)`,
    [personId, p.firstName, p.lastName, p.dob, seatEmail]);
  if (!isAdult) {
    await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [guardian, personId]);
  }
  // The club carries the locality, not the player: the CV's "· Brunswick VIC"
  // is where the CLUB is. We hold no address for a child and this line must
  // never start looking like one.
  const cut = p.locality ? p.locality.lastIndexOf(' ') : -1;
  await db.query(`insert into club (id, name, suburb, state, club_state) values ($1,$2,$3,$4,'claimed')`,
    [clubId, p.club, cut > 0 ? p.locality!.slice(0, cut) : (p.locality ?? null), cut > 0 ? p.locality!.slice(cut + 1) : null]);
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
    // A school entry on a child's record is the one row the product can no
    // longer write (D-161, 0061). It exists in a real database only because it
    // was written before the rule, and D-161 leaves it there: nothing deletes
    // it, nothing renders it, and whether the family is told is BUZ's call.
    // The seed needs one so every check about it has a subject, so it writes
    // it the only way it can be written — with the trigger off for that
    // insert, and back on immediately. If this ever stops being necessary,
    // the database stopped refusing and that is the bug.
    const legacy = e.kind === 'school' && !isAdult;
    if (legacy) await db.query(`alter table experience_entry disable trigger no_school_under_18`);
    await db.query(`insert into experience_entry (record_id, kind, org_name, season_label, notes) values ($1,$2,$3,$4,$5)`,
      [recordId, e.kind, e.orgName, e.period, e.note ?? null]);
    if (legacy) await db.query(`alter table experience_entry enable trigger no_school_under_18`);
  }
  // A 16-17 is the ONLY under-18 band whose public page is assembled live:
  // a u16's is the guardian-approved snapshot (D-119), so Deniz's and
  // Georgia's school entries exercise fn_approved_cv and nothing else. Nate
  // gets one so the live assembly's own filter is exercised by a real rendered
  // page rather than by reading the query (D-161, 0061). It names no
  // organisation: 'School 1st XI' is the wording the demo layer already uses
  // in place of a real school (L15), and it is seeded here rather than added
  // to lib/fixtures because doc 16 is where his CV data is specified.
  if (p.slug === 'nate') {
    await db.query(`alter table experience_entry disable trigger no_school_under_18`);
    await db.query(`insert into experience_entry (record_id, kind, org_name, season_label) values ($1,'school','School 1st XI','2026')`,
      [recordId]);
    await db.query(`alter table experience_entry enable trigger no_school_under_18`);
  }
  // Clubs before this one (0028). Same table, same free text, grants nothing.
  for (const e of p.previousClubs ?? []) {
    await db.query(`insert into experience_entry (record_id, kind, org_name, season_label) values ($1,'previous_club',$2,$3)`,
      [recordId, e.orgName, e.period ?? null]);
  }
  // Clips. These were missing entirely: only Deniz's page showed any, because
  // a u16 renders the approved JSON snapshot while 16-17 and adults assemble
  // from these tables. added_as_minor is stamped from the DOB (D-88) so the
  // grandfathering survives an eighteenth birthday.
  for (const h of (p.highlights ?? []).slice(0, p.highlightsUsed)) {
    await db.query(`insert into highlight (record_id, url, title, added_as_minor) values ($1,$2,$3,$4)`,
      [recordId, h.url, h.title, true]);
  }
  // The consent log (D-78, D-144). The seed wrote none of these, so a parent
  // opening Manage saw "Everything that's happened" over an empty bar — the
  // one screen whose entire job is to show them what happened. Append-only:
  // these are inserted in the order they occurred and never updated.
  if (!isAdult) await db.query(
    `insert into consent_event (at, event, actor_id, subject_id, policy_version) values
       (now() - interval '96 days', 'invite_created', $1, $2, null),
       (now() - interval '96 days', 'email_sent',     null, $2, null),
       (now() - interval '96 days', 'sms_sent',       null, $2, null),
       (now() - interval '95 days', 'guardian_landed',$1,  $2, null),
       (now() - interval '95 days', 'tos_accepted',   $1,  $2, '01@v1.0'),
       (now() - interval '95 days', 'policy_accepted',$1,  $2, '02@v1.0'),
       (now() - interval '95 days', 'approved',       $1,  $2, null),
       (now() - interval '90 days', 'share_issued',   $1,  $2, null)`,
    [guardian, personId],
  );

  // A CV the guardian already sent, so doc 14 L57 — "every send, recipient
  // address in full" — has something to show on the controls screen. The
  // function has answered this since 0025 and no page called it, which is
  // exactly the kind of gap an empty fixture hides.
  if (p.slug === 'deniz') {
    // Each send mints its own link, exactly as lib/send-dispatch.ts does, so
    // "take one off" has something real to switch off (16 Sep).
    const sendLink = async (daysAgo: number) => (await db.query(
      `insert into share_token (record_id, token_hash, token_hint, issued_by, issued_at, expires_at)
       values ($1, $2, $3, $4, now() - ($5 || ' days')::interval, now() + interval '60 days') returning id`,
      [recordId, sha(`dev-deniz-send-${daysAgo}`), `send·${daysAgo}`, guardian, String(daysAgo)],
    )).rows[0].id as string;
    const [northern, kingswayLink] = [await sendLink(31), await sendLink(12)];
    await db.query(
      `insert into consent_event (at, event, actor_id, subject_id, detail) values
         (now() - interval '31 days', 'share_dispatched', $1, $2,
          jsonb_build_object('club_name','Northern United SC',
                             'recipient','football@northernunited.example.au',
                             'band_at_send','u16', 'token_id', $3::uuid)),
         (now() - interval '12 days', 'share_dispatched', $1, $2,
          jsonb_build_object('club_name','Kingsway Rovers FC',
                             'recipient','recruitment@kingswayrovers.example.au',
                             'band_at_send','u16', 'token_id', $4::uuid))`,
      [guardian, personId, northern, kingswayLink],
    );
  }

  // u16: the public page renders the guardian-APPROVED snapshot (D-119).
  // 16-17 and 18+ assemble live from the tables above, so no snapshot exists
  // for them and fn_token_read returns none.
  // ONLY u16 gets an approved snapshot, because lib/cv-build only writes one
  // for u16 — 16-17 and 18+ edit the live record. The seed used to write one
  // for every non-adult, including a seventeen-year-old, which is a state
  // production cannot produce. That single wrong row hid a hole where a club
  // could not open the CV of anyone over sixteen on its own register.
  const isU16 = new Date(p.dob) > new Date('2010-09-08');
  if (isU16) {
    await db.query(`insert into profile_version (record_id, content, status, approved_by, approved_at) values ($1,$2,'approved',$3,now())`,
      [recordId, JSON.stringify(p), guardian]);
  }
  // The adult issues their own link. Nobody else can.
  await db.query(`insert into share_token (record_id, token_hash, issued_by, expires_at) values ($1,$2,$3, now() + interval '90 days')`,
    [recordId, sha(`dev-${p.slug}`), isAdult ? personId : guardian]);
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
// The webhook writes plan and current_period_end in production (0012/0032);
// the seed set only the status, so /club/billing's "Next charge" had nothing to
// print and the one pair of numerals the screen exists for could not be judged
// or measured (LESSONS L13).
await db.query(
  `update club set subscription_status='active', plan='register_monthly',
     current_period_end = now() + interval '16 days' where id=$1`,
  [riverside],
);
const td = randomUUID();
await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,'Marina','Petrovic','1980-04-12','td@example.com')`, [td]);
// 0058: a club's technical director comes off its verification call and from
// nowhere else — the seed cannot write the membership, and does not try. The
// call records her; proving her address is what makes the role live, exactly
// as it will for a real club.
await db.query(`update verification_call set td_name='Marina Petrovic', td_email='td@example.com' where club_id=$1`, [riverside]);
await proveAddress(td);
await tdOrThrow(td, riverside, 'Riverside FC');
// A club ADMINISTRATOR at a verified, paying club (D-154): keeps the page,
// squads, trials and billing, and reads no registration. No seat walked
// that wall before D-154 made it the rule.
const riversideAdmin = randomUUID();
await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,'Pat','Nguyen','1983-06-14','admin@example.com')`, [riversideAdmin]);
await db.query(`insert into membership (person_id, club_id, role) values ($1,$2,'club_admin')`, [riversideAdmin, riverside]);

// Localities stay real (L15; brief H): an invented club sits in a real
// suburb that is not its own name. Round E's rename had made this club's
// suburb "Quarrymead" too, a place that does not exist.
const quarrymead = randomUUID();
await db.query(`insert into club (id, name, suburb, state, club_state, contact_email) values ($1,'Quarrymead United','Diggers Rest','VIC','claimed','football@quarrymeadunited.example.au')`, [quarrymead]);
const quarrymeadAdmin = randomUUID();
await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,'M.','Harris','1979-01-20','quarrymead@example.com')`, [quarrymeadAdmin]);
await db.query(`insert into membership (person_id, club_id, role) values ($1,$2,'club_admin')`, [quarrymeadAdmin, quarrymead]);

// registrations: fixture players onto Riverside's register (parent-sent),
// and held ones at Quarrymead
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
    [pl.id, quarrymead, ['CM'], guardian],
  );
}

// ---------------------------------------------------------------------------
// A club's worth of register, so the grouping is tested at the size it has to
// survive rather than at three rows. A real Riverside in September is 100-200
// registrations across a dozen squads; this seeds that shape.
//
// These are obviously-fictional first names with no surname, no DOB beyond
// what the age group implies, and no contact detail — the register only ever
// shows a first name, a position and the player's own line, so that is all
// there is to seed.
// ---------------------------------------------------------------------------
// What a Victorian club actually fields in 2026. The boys' and girls'
// advanced competitions do NOT share age groups — Football Victoria runs
// U13/U14/U15/U16/U18 for boys and U13/U15/U17 for girls — and a club also
// runs MiniRoos underneath and a youth grade above. Seeding the real, uneven
// shape is the point: a tidy symmetrical list would hide the whole reason
// Pitch lets the club decide.
const bulkSquads = [
  ['MiniRoos U9', 'U9', 'boys'],
  ['U13 Boys', 'U13', 'boys'], ['U13 Girls', 'U13', 'girls'],
  ['U14 Boys', 'U14', 'boys'],
  ['U15 Boys', 'U15', 'boys'], ['U15 Girls', 'U15', 'girls'],
  ['U16 Boys', 'U16', 'boys'],
  ['U17 Girls', 'U17', 'girls'],
  ['U18 Boys', 'U18', 'boys'],
  ['U21 Men', 'U21', 'men'],
];
// Reuse a squad of the same name if the house fixtures already made one —
// Deniz's seed creates Riverside's U15 Boys, and inserting a second gave the
// club two identical squads on the squads page.
const bulkSquadIds: { id: string; gender: string; name: string }[] = [];
for (const [name, ageGroup, gender] of bulkSquads) {
  const existing = await db.query(`select id from squad where club_id = $1 and name = $2 limit 1`, [riverside, name]);
  if (existing.rows.length > 0) {
    bulkSquadIds.push({ id: existing.rows[0].id as string, gender, name });
    continue;
  }
  const id = randomUUID();
  bulkSquadIds.push({ id, gender, name });
  await db.query(`insert into squad (id, club_id, name, age_group, competition_gender, season) values ($1,$2,$3,$4,$5,'2026')`,
    [id, riverside, name, ageGroup, gender]);
}
// Two name pools, picked to match the squad's competition_gender. Nothing
// about gender is stored on these people — the pool is chosen from the SQUAD
// (D-68), which is the same thing the grouping does. It only matters because
// a "Lena" in the Seniors Men bucket makes a demo look careless.
const BOYS = ['Amir','Cormac','Eli','Goran','Idris','Jonty','Mateo','Omar','Sione','Ugo',
  'Xavier','Yusuf','Arlo','Dara','Emre','Fintan','Hugo','Jarrah','Kofi','Milo',
  'Otto','Rafa','Sami','Umar','Vinnie','Zeke','Bo','Quinn','Marlon','Tobias'];
const GIRLS = ['Bella','Divya','Freya','Hana','Kiri','Lucia','Nadia','Priya','Rania','Tara',
  'Vida','Wanjiru','Zara','Cleo','Gia','Ines','Lena','Noor','Pia','Talia',
  'Wren','Yara','Anouk','Esme','Maeve','Sadia','Thea','Xanthe','Imogen','Nell'];
const POS_POOL = ['GK','RB','CB','LB','DM','CM','AM','RW','LW','ST'];
const LINES = [
  'Played every game last season. Want a step up.',
  'Left-footed, comfortable either side.',
  'Moved to the area in July. Looking for a club.',
  // No health detail in sample lines: these fixtures end up in screenshots
  // on the public site and in the decks (16 Sep).
  'Plays in front of the back four. Two seasons at this level.',
  null, null, null, null,
];
const GK_LINES = [
  'Keeper. Happy to train with the older squad.',
  'Kept for two seasons. Want a club that plays out from the back.',
  null, null,
];
// Deterministic pseudo-random so the seed is identical every run — a demo
// that reshuffles on every restart is impossible to talk about.
//
// Take the HIGH bits. The low bits of a power-of-two LCG barely vary, so
// `seed % 8` cycles almost immediately: the first version of this put 87 of
// 96 players into one squad and looked like a grouping bug rather than a
// seeding one.
let seedN = 7;
const rnd = (n: number) => {
  seedN = (seedN * 1103515245 + 12345) % 2147483648;
  return Math.floor(seedN / 65536) % n;
};
for (let i = 0; i < 96; i++) {
  const pid = randomUUID();
  const squad = bulkSquadIds[rnd(bulkSquadIds.length)];
  // A few register with the club and name no squad — the unfiled bucket is a
  // real state, not a hypothetical one.
  const target = i % 11 === 0 ? null : squad.id;
  const pool = squad.gender === 'girls' || squad.gender === 'women' ? GIRLS : BOYS;
  const first = pool[i % pool.length];
  await db.query(`insert into person (id, first_name, dob) values ($1,$2,$3)`,
    [pid, first, `${2008 + (i % 8)}-0${1 + (i % 9)}-1${i % 10}`]);
  // A PARENT, because an under-18 registrant without one cannot exist (A17,
  // D-96). Sixty-one of these had none, and the moment fn_can_invite asked
  // the trigger's A17 question (doc 14 P19) their CV and invite links went —
  // correctly. One fictional parent each, never Alex: ninety-six children on
  // the house parent's home page would be a different, worse fixture.
  const bulkParent = randomUUID();
  await db.query(`insert into person (id, first_name, last_name, dob) values ($1,'Register','Parent','1980-01-01')`, [bulkParent]);
  await db.query(
    `insert into guardianship_link (guardian_id, child_id, approved_at)
     select $1, p.id, now() from person p where p.id = $2 and fn_age_band(p.dob) <> '18plus'`,
    [bulkParent, pid]);
  const nPos = 1 + rnd(2);
  const positions: string[] = [];
  while (positions.length < nPos) {
    const p = POS_POOL[rnd(POS_POOL.length)];
    if (!positions.includes(p)) positions.push(p);
  }
  const status = i % 9 === 0 ? 'shortlisted' : i % 17 === 0 ? 'invited' : 'new';
  await db.query(
    `insert into registration (player_id, club_id, squad_target, positions, note, club_status, disclosed_by, policy_version)
     values ($1,$2,$3,$4,$5,$6,$7,'20@v2.4')`,
    [pid, riverside, target, positions,
     positions.includes('GK') ? GK_LINES[rnd(GK_LINES.length)] : LINES[rnd(LINES.length)],
     status, guardian],
  );

  // A DEVELOPMENT RECORD, because a registration without one cannot exist:
  // /register-interest takes a record id, so every real registrant has one.
  // Ninety-six of these did not, so ninety-six of the hundred rows on the
  // page clubs PAY FOR answered 404 to "Open the CV" — and the walkthrough
  // never said so, because the three house fixtures at the top all worked.
  const bulkRec = randomUUID();
  const surfaced = positions.includes('GK') ? ['apps', 'clean_sheets'] : ['apps', 'goals', 'assists'];
  await db.query(
    `insert into development_record (id, person_id, positions, squad_number, foot, about, surfaced_stats)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [bulkRec, pid, positions, 2 + rnd(20), rnd(4) === 0 ? 'Left' : 'Right',
     positions.includes('GK') ? GK_LINES[rnd(GK_LINES.length)] : LINES[rnd(LINES.length)], surfaced],
  );
  for (const key of surfaced) {
    const v = key === 'apps' ? 6 + rnd(18) : 1 + rnd(12);
    await db.query(
      `insert into player_stat (record_id, season, stat_key, value, provenance) values ($1,'2026',$2,$3,'self_reported')`,
      [bulkRec, key, v],
    );
  }
  // u16 renders the guardian-approved snapshot and nothing else (D-119), so
  // one has to exist for them exactly as it would in production.
  const dobStr = `${2008 + (i % 8)}-0${1 + (i % 9)}-1${i % 10}`;
  if (new Date(dobStr) > new Date('2010-09-08')) {
    await db.query(
      `insert into profile_version (record_id, content, status, approved_by, approved_at)
       values ($1,$2,'approved',$3,now())`,
      [bulkRec, JSON.stringify({
        slug: 'live', firstName: first, lastName: '', dob: '',
        positions, squadNumber: 2 + rnd(20), foot: 'Right',
        club: 'Riverside FC', locality: 'Brunswick VIC',
        squad: { name: squad.name ?? '', ageGroup: '', competitionGender: squad.gender },
        about: LINES[rnd(LINES.length)] ?? '',
        stats: surfaced.map((k) => ({ season: '2026', key: k, value: 4 + rnd(14), provenance: 'self_reported' })),
        achievements: [], otherFootball: [], previousClubs: [],
        highlights: [], highlightsUsed: 0, surfacedStats: surfaced,
      }), guardian],
    );
  }
}

// public club page seed (ClubCV): slug, girls'/women's squads, trials,
// players wanted, alumni wall
await db.query(`update club set public_slug='riverside-fc', established='1974', pathway_line='MiniRoos → Juniors → Seniors pathway', philosophy='Every junior plays, every junior develops. Football that is brave on the ball, and a club where families stay for a decade — not a season.' where id=$1`, [riverside]);
// A banner, so the club page can be looked at the way a club with a photo
// will see it. Put through sharp at exactly the ratio the upload route uses
// (1600x500 cover), because a fixture that skips the crop tells you nothing
// about what the crop does. The source is our own brand photography — no
// real club's ground, and the crest is a plain two-letter stand-in — neither
// is a real club's property.
{
  const sharp = (await import('sharp')).default;
  const out = await sharp(fileURLToPath(new URL('../public/assets/film-1.webp', import.meta.url)))
    .resize(1600, 500, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 82 })
    .toBuffer();
  const crest = await sharp(fileURLToPath(new URL('../public/assets/dev-crest-riverside.png', import.meta.url)))
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  const rel = `/dev-uploads/banner-${riverside}.jpg`;
  const pub = fileURLToPath(new URL('../public/', import.meta.url));
  mkdirSync(join(pub, 'dev-uploads'), { recursive: true });
  writeFileSync(join(pub, rel.slice(1)), out);
  const crestRel = `/dev-uploads/crest-${riverside}.png`;
  writeFileSync(join(pub, crestRel.slice(1)), crest);
  await db.query(`update club set banner_path = $2, crest_path = $3 where id = $1`, [riverside, rel, crestRel]);
}

// The u16 approved snapshot is written inside the player loop, BEFORE the
// club has a crest — and in production it is written by lib/cv-build, which
// now reads the club fields itself. Refresh the fixture snapshots here so a
// u16 page shows exactly what a real approved page would: the club, the
// squad, the crest and the club's locality, frozen at approval (D-119).
{
  const approved = await db.query(
    `select pv.id, pv.content, c.name, c.crest_path, c.suburb, c.state, s.name as squad_name
     from profile_version pv
     join development_record dr on dr.id = pv.record_id
     join membership m on m.person_id = dr.person_id and m.role = 'player' and m.ended_at is null
     join club c on c.id = m.club_id
     left join squad s on s.id = m.squad_id
     where pv.status = 'approved'`,
  );
  for (const r of approved.rows as Record<string, string | null>[]) {
    const content = {
      ...(r.content as unknown as Record<string, unknown>),
      club: r.name,
      clubCrestPath: r.crest_path ?? undefined,
      locality: [r.suburb, r.state].filter(Boolean).join(' ') || undefined,
    };
    await db.query(`update profile_version set content = $2 where id = $1`, [r.id, JSON.stringify(content)]);
  }
}

// Riverside's girls' and women's rows come from the squad list above — this
// used to insert its own U13 Girls as well, which gave the club two of them
// and made the squads page look broken.
await db.query(`insert into squad (club_id,name,age_group,competition_gender,season) values ($1,'Seniors Women','SEN','women','2026')`, [riverside]);
// A trial names every age group it is for (D-68 as amended 16 Sep).
const trialAges = async (id: string, ages: string[]) => {
  for (const a of ages) await db.query(`insert into trial_notice_age_group (trial_notice_id, age_group) values ($1,$2)`, [id, a]);
};
const [boysTrial, girlsTrial] = (await db.query(`insert into trial_notice (club_id,title,trial_on,time_venue,position_needs,competition_gender,cv_email) values
  ($1,'U14 & U15 Boys trials','2026-10-11','Sun 9:00 AM · Riverside Park, Pitch 2',array['GK','CB'],'boys','football@riversidefc.example.au'),
  ($1,'Girls U13–U16 trials','2026-10-18','Sun 10:00 AM · Riverside Park, Pitch 1',array[]::text[],'girls','football@riversidefc.example.au')
  returning id`, [riverside])).rows.map((r) => r.id as string);
await trialAges(boysTrial, ['U14', 'U15']);
await trialAges(girlsTrial, ['U13', 'U14', 'U15', 'U16']);
await db.query(`insert into players_wanted_notice (club_id,title,detail) values ($1,'U13 Boys — Goalkeeper','Train Tue & Thu · immediate start'),($1,'U16 Girls — 2 outfield spots','Season 2027 squad')`, [riverside]);
// Coaching roles a club is hiring for (0019), and one coach clip on Sam's
// profile. Titles describe the session, never a child.
await db.query(`insert into coaching_role (club_id,title,age_group,detail,commitment,paid,posted_by) values
  ($1,'Head Coach — U14 Boys','U14','Our U14s move up together next season and we want someone who will develop them rather than chase results. Sessions Tuesday and Thursday, games Sunday morning.','Tue & Thu, 6–7:30pm',true,$2),
  ($1,'Assistant Coach — U13 Girls','U13','Supporting our U13 Girls head coach. Great for someone building their coaching CV — we will support your C Licence.','Wed 5–6:30pm',false,$2)`,
  [riverside, td]);

// Club video: a LINK, never a file (0018). Title is about the club, never
// about a child — the alumni wall's rule, applied to video.
await db.query(`insert into club_video (club_id,url,title,sort) values
  ($1,'https://www.youtube.com/watch?v=dev-riverside-1','Our 2026 season',0),
  ($1,'https://www.youtube.com/watch?v=dev-riverside-2','A day at Riverside Park',1)`, [riverside]);
// Each entry carries the "Everyone named here is 18 or over" confirmation
// (0051) — the TD confirmed it, as a real club would when adding them.
await db.query(`insert into alumni_entry (club_id,line,detail,sort,added_by,adults_confirmed_by,adults_confirmed_at) values ($1,'Marco V. → NPL Victoria','Riverside juniors 2012–2018',0,$2,$2,now()),($1,'Aylin D. → State representative squad','Riverside juniors 2011–2017',1,$2,$2,now()),($1,'A 2019 U13 → our senior first team','Straight through the pathway, still playing',2,$2,$2,now())`, [riverside, td]);

// coach fixture: Sam Kaya (doc 16 §3b) with a published public slug
const sam = randomUUID();
await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,'Sam','Kaya','1988-02-02','coach@example.com')`, [sam]);
await db.query(`insert into membership (person_id, club_id, role) values ($1,$2,'coach')`, [sam, riverside]);
await db.query(`insert into wwcc_attestation (person_id, club_id, attested_by) values ($1,$2,$3)`, [sam, riverside, td]);
// D-154: Marina has brought Sam in for two teams, so a coach's read-only
// register exists to be walked.
await db.query(
  `insert into register_grant (club_id, person_id, squad_id, granted_by)
   select distinct on (s.name) $1::uuid, $2::uuid, s.id, $3::uuid from squad s
   where s.club_id = $1 and s.name in ('U14 Boys','U15 Girls') order by s.name, s.id`,
  [riverside, sam, td]);
// A photo, so the coach hero can be judged with a face in it rather than
// initials. Put through sharp at the same 512 square the upload route uses.
// The source is our own brand photography — it is not a real coach's
// likeness attached to a real name, and it is a local fixture only.
{
  const sharp = (await import('sharp')).default;
  const out = await sharp(fileURLToPath(new URL('../public/assets/film-4.webp', import.meta.url)))
    // Explicit crop, because sharp's attention heuristic picked the players
    // behind him and produced a team photo where a portrait belongs.
    .extract({ left: 430, top: 40, width: 560, height: 560 })
    .resize(512, 512, { fit: 'cover' })
    .jpeg({ quality: 86 })
    .toBuffer();
  const pub = fileURLToPath(new URL('../public/', import.meta.url));
  const rel = `/dev-uploads/coach-${sam}.jpg`;
  mkdirSync(join(pub, 'dev-uploads'), { recursive: true });
  writeFileSync(join(pub, rel.slice(1)), out);
  await db.query(`update person set photo_path = $2 where id = $1`, [sam, rel]);
}

const samProfile = randomUUID();
await db.query(`insert into coach_profile (id, person_id, public_slug, region, philosophy) values ($1,$2,'sam-kaya','Melbourne VIC','Possession with purpose. Every player touches the ball every drill, every session — confidence first, patterns second. Development over results at junior level, always.')`, [samProfile, sam]);
// Licences and what he has done as a coach (0029). Both self-declared; the
// page says so, once, at the foot of the pair.
await db.query(`insert into coach_licence (coach_profile_id, title, issuer, year, sort) values
  ($1,'AFC B Diploma','Football Australia','2024',0),
  ($1,'AFC C Diploma','Football Australia','2021',1),
  ($1,'Goalkeeping Level 1','Football Victoria','2022',2),
  ($1,'Youth Development Certificate','Football Australia','2020',3),
  ($1,'First Aid & CPR','St John Ambulance','2026',4)`, [samProfile]);
await db.query(`insert into coach_achievement (coach_profile_id, title, detail, sort) values
  ($1,'Promotion to NPL U15s','Riverside FC, 2026',0),
  ($1,'League runners-up','Riverside FC U15 Boys, 2026',1),
  ($1,'Four players into state squads','Across 2024 and 2025',2)`, [samProfile]);
// A banner, so the composition can be judged. Our own brand photography,
// through the same 1600x500 crop the upload route uses.
{
  const sharp = (await import('sharp')).default;
  const out = await sharp(fileURLToPath(new URL('../public/assets/film-1.webp', import.meta.url)))
    .resize(1600, 500, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 82 })
    .toBuffer();
  const pub = fileURLToPath(new URL('../public/', import.meta.url));
  const rel = `/dev-uploads/coach-banner-${samProfile}.jpg`;
  mkdirSync(join(pub, 'dev-uploads'), { recursive: true });
  writeFileSync(join(pub, rel.slice(1)), out);
  await db.query(`update coach_profile set banner_path = $2 where id = $1`, [samProfile, rel]);
}
// Coach clips (0019), capped at five. Titles describe the session, never a
// child — the same rule as the alumni wall and the club video.
await db.query(`insert into coach_clip (coach_profile_id, url, title, sort) values
  ($1,'https://www.youtube.com/watch?v=dev-sam-1','U15 session — playing out from the back',0),
  ($1,'https://www.youtube.com/watch?v=dev-sam-2','Rondo progressions, 12 minutes',1)`, [samProfile]);
await db.query(`insert into coach_role (coach_profile_id, title, org_name, started_year, ended_year, sort) values
  ($1,'Head Coach · U15 Boys','Riverside FC','2024',null,0),
  ($1,'Assistant Coach · U14 Boys','Northern United SC','2021','2023',1),
  ($1,'Junior Coach · MiniRoos','Northern United SC','2018','2021',2)`, [samProfile]);

// Marina's coaching CV. D-93 and doc 16 §3b: a Technical Director is a role,
// not a profile type — she holds a coach CV that reads "Technical Director,
// Riverside FC". The seed never gave her one, so no page in the dev database
// showed a TD's crest, and the crest a verified TD has earned (brief F) had
// nothing to render against. Her role at Riverside is the one her club's
// verification call confirmed (0058); the line she typed is free text and
// earns the crest only because it names that club.
const marinaProfile = randomUUID();
await db.query(`insert into coach_profile (id, person_id, public_slug, region) values ($1,$2,'marina-petrovic','Melbourne VIC')`, [marinaProfile, td]);
await db.query(`insert into coach_role (coach_profile_id, title, org_name, started_year, ended_year, sort) values
  ($1,'Technical Director','Riverside FC','2022',null,0),
  ($1,'Head Coach · U16 Girls','Northern United SC','2017','2022',1)`, [marinaProfile]);

// An UNCLAIMED club with a compiled listing (D-90 source 2): the board must
// show both routes — 'I'm interested' for verified clubs, 'Send my CV' for a
// listing we compiled from the club's own public notice.
// Compiled from public notices, including the address on them — which is
// where a claim code goes, and the only place it can go (doc 15 §34).
//
// Through the operator's own functions (0130), as a real listing is: the seed
// proves the path rather than writing round it, and the wall refuses a
// compiled notice written any other way. Marina is the seat the suites drive
// the console with; in development any signed-in address is an operator.
const westgate = (await db.query(
  `select fn_ops_add_club($1, 'td@example.com', 'Westgate Rangers', 'Altona', 'VIC',
     'secretary@westgaterangers.example.au', 'club website /contact') as id`, [td])).rows[0].id as string;
// The function refuses a date that has passed (it would never show), and a
// demo seeds this same database on any day of the year — so on a day after
// the 12th the date is today rather than a seed that stops starting.
await db.query(
  `select fn_ops_add_notice($1, 'td@example.com', $2, 'U13 Boys trials', array['U13'], 'boys',
     greatest('2026-10-12'::date, (now() at time zone 'Australia/Melbourne')::date),
     'Mon 5:30 PM', 'Grant Reserve', '{}', 'https://westgaterangers.example.au/trials')`, [td, westgate]);
// Trials board v2 (BUZ, 2 Oct): one row per club per day, and expressions of
// interest in their own section. A second notice from the same club, the same
// day and the same public notice — written AFTER the U13s but starting an hour
// earlier, so the row has to order its lines by time, not by insertion. Then
// two expressions of interest closing the same day from two different
// notices, so each line keeps its own stamp and link. "EOI closes" is how the
// desk writes one (the design's interim, until trial_notice carries a kind).
// Their ids go to .dev-ids.json as boardV2Notices: the write suite takes them
// off through the operator's Remove before its sweep, because its crawl stops
// at 60 pages a seat and every page a fixture adds moves which seat meets
// Jordan's forms first (L32). The render and layout suites read them.
const boardV2Notices: string[] = [];
boardV2Notices.push((await db.query(
  `select fn_ops_add_notice($1, 'td@example.com', $2, 'U12 Boys trials', array['U12'], 'boys',
     greatest('2026-10-12'::date, (now() at time zone 'Australia/Melbourne')::date),
     'Mon 4:30 PM', 'Grant Reserve', '{}', 'https://westgaterangers.example.au/trials') as id`, [td, westgate])).rows[0].id as string);
for (const [title, ages, gender, url] of [
  ['Senior women expressions of interest', ['SEN'], 'women', 'https://westgaterangers.example.au/women'],
  ['U16 Girls expressions of interest', ['U16'], 'girls', 'https://westgaterangers.example.au/girls'],
] as const) {
  boardV2Notices.push((await db.query(
    `select fn_ops_add_notice($1, 'td@example.com', $2, $3, $4::text[], $5,
       greatest('2026-11-30'::date, (now() at time zone 'Australia/Melbourne')::date + 30),
       'EOI closes', 'Online — see the club''s notice', '{}', $6) as id`, [td, westgate, title, [...ages], gender, url])).rows[0].id as string);
}

// --- walkthrough states: one of each waiting card, so every journey has
// something real to open. All fictional (doc 16 §4).
const recOf = async (name: string) =>
  (await db.query(`select dr.id from development_record dr join person p on p.id = dr.person_id where p.first_name = $1`, [name])).rows[0].id as string;
const personOf = async (name: string) =>
  (await db.query(`select id from person where first_name = $1`, [name])).rows[0].id as string;

// 1. Deniz has a pending edit waiting on his guardian (D-119)
const denizRec = await recOf('Deniz');

// D-160 (0083): a coach-verified number, written the way the product writes
// one. Doc 16 §3b makes Sam "Riverside's verified U15 Boys coach —
// squad-scoped access", and the seed never gave him the squad: so no seat in
// the dev database held the pen fn_write_provenance hands a squad coach, and
// "Verified by Riverside FC" could not be looked at anywhere. He gets Deniz's
// squad and confirms Deniz's goals through fn_verify_stat — the seed does not
// write a provenance itself, and if the function refuses, the seed stops.
{
  const sq = (await db.query(
    `select m.club_id, m.squad_id from membership m join development_record dr on dr.person_id = m.person_id
     where dr.id = $1 and m.role = 'player' and m.ended_at is null`, [denizRec])).rows[0];
  await db.query(`insert into membership (person_id, club_id, squad_id, role) values ($1,$2,$3,'coach')`, [sam, sq.club_id, sq.squad_id]);
  const goals = (await db.query(
    `select id from player_stat where record_id = $1 and season = '2026' and stat_key = 'goals' and source_experience_id is null`,
    [denizRec])).rows[0].id as string;
  if ((await db.query('select fn_verify_stat($1,$2) as ok', [sam, goals])).rows[0].ok !== true) {
    throw new Error('D-160: Sam could not verify a stat in his own squad — the seed and fn_write_provenance disagree');
  }
  // D-48 and D-171 (0154): Sam writes one coach-verified entry on Deniz while
  // he holds the squad, so the write suite has an AUTHORING coach: on the
  // squad he drops to nothing, not to what he wrote, while Riverside is not
  // verified (H5); once Deniz has left he keeps what he wrote (D-48, H2), and
  // even that goes while Riverside is not verified. No screen shows an entry
  // before December; the body is empty.
  // The provenance trigger (0015) refuses it unless he may write it.
  await db.query(`insert into record_entry (record_id, entry_type, author_id, provenance) values ($1,'coach_note',$2,'coach_verified')`,
    [denizRec, sam]);
  // A u16's page is the approved snapshot (D-119), and lib/cv-build builds a
  // snapshot's stats from fn_stat_public — so the next version his guardian
  // approves carries the verification. The seed's snapshot stands in for that
  // approval, exactly as it stands in for the first one.
  await db.query(
    `update profile_version set content = jsonb_set(content, '{stats}', fn_stat_public($1)) where record_id = $1 and status = 'approved'`,
    [denizRec]);
}
await db.query(
  // Staggered created_at across the four waiting items. They were all seeded
  // at now(), so every card read "today" and the oldest-first ordering on
  // /home could not be seen at all — a fixture that hides the behaviour it
  // exists to demonstrate.
  `insert into profile_version (record_id, content, status, created_at)
   select $1, jsonb_set(content::jsonb, '{about}', '"Right-footed 10 who plays between the lines. Two-footed now — weak-foot finishing every Thursday since March."'), 'pending', now() - interval '1 day'
   from profile_version where record_id = $1 and status = 'approved'`,
  [denizRec],
);

// 2. Georgia has asked to send her CV to a club (D-99)
const georgiaRec = await recOf('Georgia');
const georgiaAsk = (await db.query(
  `insert into share_request (record_id, requested_by, destination, created_at)
   values ($1, (select person_id from development_record where id = $1), 'Quarrymead United <football@quarrymeadunited.example.au>', now() - interval '3 days')
   returning id`,
  [georgiaRec],
)).rows[0].id as string;

// 3. Nate has asked to go on a club register (D-108 via D-91)
const nateRec = await recOf('Nate');
await db.query(
  `insert into registration_request (record_id, club_id, positions, note, created_at)
   values ($1, $2, array['GK'], 'Been on the bench behind a keeper two years older. Want game time.', now() - interval '6 days')`,
  [nateRec, riverside],
);

// 4. Riverside has invited Georgia to a trial — waiting on her guardian (D-117)
const georgiaReg = (await db.query(
  `select id from registration where player_id = $1 and club_id = $2 limit 1`,
  [await personOf('Georgia'), riverside],
)).rows[0].id as string;
await db.query(`update registration set club_status = 'invited' where id = $1`, [georgiaReg]);
await db.query(
  `insert into invitation (club_id, registration_id, body, created_at)
   values ($1, $2, $3, now() - interval '11 days')`,
  [riverside, georgiaReg, JSON.stringify({ kind: 'trial', note: "Saw Georgia at Werribee. We're light in midfield for the 16s and we'd like a proper look at her." })],
);

// 5. Nate is shortlisted on Riverside's register so the TD has an invite to send
await db.query(
  `update registration set club_status = 'shortlisted'
   where player_id = $1 and club_id = $2`,
  [await personOf('Nate'), riverside],
);

// 6. doc 31 U-6's fourth condition — "a guardian may ask who at Pitch has
// looked at their child's record and why, and get a straight answer" — and
// doc 34 rule 6, which says register reads are disclosable in the same terms.
// fn_who_looked (0025) answers it and, until 28 Sep, no page called it.
//
// Nothing in the product GRANTS an investigator access yet: while the
// complaints investigator is one person (doc 31: "today the complaints
// investigator is BUZ") the grant is made by hand, so with no fixture the
// card that answers this question renders its empty state for every child and
// the answer it exists to give is never seen by anyone. Nate's record carries
// one look. Deniz's carries none, which is the other half of the card and the
// state almost every real family will be in.
//
// The investigator is invented, like every person in this seed. A real
// person's name does not go in a fixture, and BUZ's least of all.
// Not in a club demo (npm run demo): a room full of a club's people does not
// need a line saying someone at Pitch opened a child's record, and — until the
// deletion cascade can reach investigation_access (see the builder report of
// 28 Sep) — a child carrying one cannot be deleted, and a demo is exactly where
// somebody presses Delete to see what happens.
if (!process.env.DEMO_CLUB?.trim()) {
  const investigator = randomUUID();
  await db.query(`insert into person (id, first_name, last_name, dob) values ($1,'Priya','Raman','1979-03-14')`, [investigator]);
  const u6Report = (await db.query(
    `insert into report (subject_kind, subject_ref, reason, created_at)
     values ('club_page','riverside-fc','A parent says the club page names a junior player.', now() - interval '3 days')
     returning id`)).rows[0].id as string;
  const u6Grant = (await db.query(
    `insert into investigation_grant (report_id, investigator_id, subject_id, granted_at, expires_at)
     values ($1, $2, $3, now() - interval '3 days', now() + interval '11 days') returning id`,
    [u6Report, investigator, await personOf('Nate')])).rows[0].id as string;
  await db.query(
    `insert into investigation_access (grant_id, at, what) values ($1, now() - interval '3 days', 'read the send log')`,
    [u6Grant]);
}

// A FREE verified club (D-153): verified by call, no subscription, one posted
// trial, and a family who registered interest in that trial. Riverside is on
// the paid register, so without this club "a free club can invite players to
// its trial" had no fixture at all — and the paths no fixture walks are the
// ones that turn out broken.
const kingsway = randomUUID();
const kingswayCall = randomUUID();
await db.query(`insert into club (id, name, suburb, state, club_state, public_slug, contact_email)
  values ($1,'Kingsway Rovers FC','Brunswick West','VIC','claimed','kingsway-rovers','football@kingswayrovers.example.au')`, [kingsway]);
await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
  values ($1,$2,now(),'BUZ','03 9000 0001','FV club directory','verified','27@v1.0')`, [kingswayCall, kingsway]);
await db.query(`update club set club_state='verified', verified_call_id=$1 where id=$2`, [kingswayCall, kingsway]);
const kingswayAdmin = randomUUID();
await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,'Dana','Kovac','1984-07-09','kingsway@example.com')`, [kingswayAdmin]);
// Kingsway's one seat is its technical director: under D-154 an administrator
// reads no registration, and a free club still works its own trials (D-153).
// Recorded on Kingsway's own call and switched on by the proof (0058).
await db.query(`update verification_call set td_name='Dana Kovac', td_email='kingsway@example.com' where club_id=$1`, [kingsway]);
await proveAddress(kingswayAdmin);
await tdOrThrow(kingswayAdmin, kingsway, 'Kingsway Rovers FC');
const kingswayTrial = (await db.query(
  `insert into trial_notice (club_id,title,trial_on,time_venue,position_needs,competition_gender,cv_email)
   values ($1,'U16–U18 and Seniors trials','2026-10-25','Sun 10:00 AM · Brunswick West Oval',array['GK','ST']::text[],null,'football@kingswayrovers.example.au')
   returning id`, [kingsway])).rows[0].id as string;
await trialAges(kingswayTrial, ['U16', 'U17', 'U18', 'SEN']);
await db.query(
  `insert into registration (player_id, club_id, positions, club_status, disclosed_by, policy_version, trial_notice_id, trial_on)
   values ($1,$2,array['CM'],'new',$3,'20@v2.4',$4,'2026-10-25')`,
  [await personOf('Georgia'), kingsway, guardian, kingswayTrial],
);

// A SUSPENDED club (D-135, doc 14 O4): verified by call, a subscription whose
// payment failed and whose fourteen days of grace have run out. No fixture
// walked this, and the path no fixture walks is the one that turns out broken —
// this one dropped the club silently to the free tier's "Interest in your
// trials" heading with nothing about payment anywhere near it, while
// /club/billing was the only screen that said so.
//
// Deliberately minimal: no public slug, no trial notice, no squads, so it
// appears on no public board and in no other suite's counts. Two registrations
// copied off Riverside's bulk register, so "the list is hidden, nothing is
// deleted" has something to be true about.
// An unclaimed listing Pitch compiled (D-172, John 30 Sep): a club nobody
// has claimed, built from public facts, so the suites can hold its page to
// John's six rules (U1-U6). The name is invented; the locality is real.
await db.query(`insert into club (name, suburb, state, club_state, contact_email, public_slug, listing_source, listed_at)
  values ('Brindlewood Rovers SC','Bulla','VIC','unclaimed','info@brindlewoodrovers.example.au','brindlewood-rovers-sc','club website /contact (fixture)', now())`);
// An address the listing used to have (0162): it must still land on the page.
await db.query(`insert into club_slug_former (slug, club_id) select 'brindlewood-rovers', id from club where public_slug = 'brindlewood-rovers-sc'`);
// Two more, so "Send my CV" filling in a club's address is held to both
// halves of John's rule (0160, 30 Sep §2). Kestrelford Athletic publishes
// only a person's address, so the send screen fills in nothing for it.
// Wrenmoor Wanderers asked Pitch to stop sending it CVs, so nobody can —
// its address and its own domain are stopped, as the operator's button stops
// them. Names invented, localities real (fx2).
const kestrelford = randomUUID();
await db.query(`insert into club (id, name, suburb, state, club_state, contact_email, public_slug, listing_source, listed_at)
  values ($1,'Kestrelford Athletic SC','Preston','VIC','unclaimed','j.whitcombe@kestrelfordathletic.example.au','kestrelford-athletic-sc','club website /contact (fixture)', now())`, [kestrelford]);
const wrenmoor = randomUUID();
await db.query(`insert into club (id, name, suburb, state, club_state, contact_email, public_slug, listing_source, listed_at)
  values ($1,'Wrenmoor Wanderers FC','Altona','VIC','unclaimed','secretary@wrenmoorwanderers.example.au','wrenmoor-wanderers-fc','club website /contact (fixture)', now())`, [wrenmoor]);
await db.query(`insert into send_block (address, club_id, source, created_by_email) values ('secretary@wrenmoorwanderers.example.au', $1, 'operator', 'seed@fixture.example')`, [wrenmoor]);
await db.query(`insert into send_block (domain, club_id, source, created_by_email) values ('wrenmoorwanderers.example.au', $1, 'operator', 'seed@fixture.example')`, [wrenmoor]);
const tarrowvale = randomUUID();
const tarrowvaleCall = randomUUID();
await db.query(`insert into club (id, name, suburb, state, club_state, contact_email)
  values ($1,'Tarrowvale City FC','Hoppers Crossing','VIC','claimed','football@tarrowvalecity.example.au')`, [tarrowvale]);
await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
  values ($1,$2,now(),'BUZ','03 9000 0002','FV club directory','verified','27@v1.0')`, [tarrowvaleCall, tarrowvale]);
await db.query(`update club set club_state='verified', verified_call_id=$1 where id=$2`, [tarrowvaleCall, tarrowvale]);
const tarrowvaleTd = randomUUID();
await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,'Felix','Moreau','1977-11-03','tarrowvale@example.com')`, [tarrowvaleTd]);
await db.query(`update verification_call set td_name='Felix Moreau', td_email='tarrowvale@example.com' where club_id=$1`, [tarrowvale]);
await proveAddress(tarrowvaleTd);
await tdOrThrow(tarrowvaleTd, tarrowvale, 'Tarrowvale City FC');
// Only the webhook writes subscription state in production (D-112), and this
// is the state it writes when invoice.payment_failed arrives and the grace it
// opened has since lapsed.
await db.query(
  `select fn_apply_subscription($1,'past_due','register_monthly', now() - interval '20 days',
     now() - interval '6 days', 'cus_dev_tarrowvale', now() - interval '20 days')`,
  [tarrowvale],
);
await db.query(
  `insert into registration (player_id, club_id, positions, club_status, disclosed_by, policy_version)
   select r.player_id, $1, r.positions, 'new', r.disclosed_by, '20@v2.4'
   from registration r where r.club_id = $2 and r.squad_target is not null
   order by r.created_at limit 2`,
  [tarrowvale, riverside],
);
// AND ITS ADMINISTRATOR. The administrator's /home (club-home-admin.html) is
// the first Pitch screen anybody at a club is likely to open, and until now the
// only fixture for that seat was Pat at Riverside — a club with a crest, a
// philosophy, a public slug and a paid plan, so three of the four blocks on
// that screen had nothing to render. Robyn is an administrator at a verified
// club with none of those: no crest, nothing written about how the club plays,
// no public page yet, and a payment that failed.
const tarrowvaleAdmin = randomUUID();
await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,'Robyn','Callister','1981-08-22','tarrowvale.admin@example.com')`, [tarrowvaleAdmin]);
await db.query(`insert into membership (person_id, club_id, role) values ($1,$2,'club_admin')`, [tarrowvaleAdmin, tarrowvale]);
// A team manager, because doc 34 rule 4 puts them on the same side of D-93's
// wall as an administrator and no fixture had one at a verified club.
const tarrowvaleTm = randomUUID();
await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,'Tomas','Villa','1975-03-09','tarrowvale.tm@example.com')`, [tarrowvaleTm]);
await db.query(`insert into membership (person_id, club_id, role) values ($1,$2,'team_manager')`, [tarrowvaleTm, tarrowvale]);

// Demo mode (npm run demo): rename the club to the one BUZ is meeting, and
// serve on the demo port so a demo and the dev database never meet.
const DEMO = process.env.DEMO_CLUB?.trim();

// --- A CV IN ITS CLUB'S COLOURS, AND ONE THAT MUST NOT BE (D-174, 0165) ----
// John's condition 4: the render suite watches the CV with and without a
// club's colours before the switch is on (cvcol-r1 to r5).
//   · Riverside picks "Sky blue and navy" — a preset, the club's own choice
//     (condition 1), and nothing like Pitch green, so a theme that leaked
//     somewhere it should not cannot hide. /p/dev-deniz wears it.
//   · Thornbeck Thunder SC was verified, has a player, and then failed a
//     later call, so it is 'claimed' again (0150): the state a real CV can be
//     in. It holds colours of its own ("Purple and gold"), and /p/dev-teodor
//     must wear none of them. Teodor is an adult with no account and no
//     guardian, so nothing else in the seed or the suites meets him.
// Neither in a demo: the demo renames Riverside to the club BUZ is meeting,
// and a real club's page must never wear colours that club did not choose.
if (!DEMO) {
  const riversideColours = PRESETS.find((p) => p.name === 'Sky blue and navy')!;
  await db.query(`update club set colour_primary = $2, colour_secondary = $3 where id = $1`,
    [riverside, riversideColours.primary, riversideColours.secondary]);

  const thornbeck = randomUUID(), thornbeckCall = randomUUID(), thornbeckSquad = randomUUID();
  const teodor = randomUUID(), teodorRec = randomUUID();
  await db.query(`insert into club (id, name, suburb, state, club_state) values ($1,'Thornbeck Thunder SC','Preston','VIC','claimed')`, [thornbeck]);
  await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
    values ($1,$2,now() - interval '60 days','BUZ','03 9000 0003','FV club directory','verified','27@v1.0')`, [thornbeckCall, thornbeck]);
  await db.query(`update club set club_state='verified', verified_call_id=$1 where id=$2`, [thornbeckCall, thornbeck]);
  await db.query(`insert into squad (id, club_id, name, age_group, competition_gender, season) values ($1,$2,'Seniors Men','SEN','men','2026')`,
    [thornbeckSquad, thornbeck]);
  await db.query(`insert into person (id, first_name, last_name, dob) values ($1,'Teodor','Vance','1999-05-11')`, [teodor]);
  await db.query(`insert into membership (person_id, club_id, squad_id, role) values ($1,$2,$3,'player')`, [teodor, thornbeck, thornbeckSquad]);
  await db.query(`insert into development_record (id, person_id, positions, squad_number, foot, about, surfaced_stats)
    values ($1,$2,array['CB'],5,'Right','Centre-back who talks all game and wins the ball back early.',array['apps','clean_sheets','goals','assists'])`,
    [teodorRec, teodor]);
  // The adult issues their own link, as every adult does.
  await db.query(`insert into share_token (record_id, token_hash, issued_by, expires_at) values ($1,$2,$3, now() + interval '90 days')`,
    [teodorRec, sha('dev-teodor'), teodor]);
  // The later call, written the way an operator records it: 0150 takes the
  // club back to 'claimed' in the same statement.
  await db.query(`insert into verification_call (club_id, called_at, operator, number_called, number_source, outcome, policy_version)
    values ($1, now() - interval '5 days','BUZ','03 9000 0003','FV club directory','not_verified','27@v1.0')`, [thornbeck]);
  const purpleGold = PRESETS.find((p) => p.name === 'Purple and gold')!;
  await db.query(`update club set colour_primary = $2, colour_secondary = $3 where id = $1`, [thornbeck, purpleGold.primary, purpleGold.secondary]);
  const st = (await db.query(`select club_state from club where id = $1`, [thornbeck])).rows[0] as { club_state: string };
  if (st.club_state !== 'claimed') throw new Error(`0150: Thornbeck should be claimed after its failed call, and is ${st.club_state}`);
}
let demoSlug = '';
if (DEMO) {
  const { applyDemo } = await import('./demo-layer.mts');
  demoSlug = (await applyDemo(db, {
    club: DEMO,
    suburb: process.env.DEMO_SUBURB || undefined,
    state: process.env.DEMO_STATE || undefined,
    crest: process.env.DEMO_CREST || undefined,
    ground: process.env.DEMO_GROUND || undefined,
    unclaimed: process.env.DEMO_UNCLAIMED === '1',
  })).slug;
}
// 54322 for the dev database, 54323 for a demo — unchanged for anyone who
// sets nothing. PITCH_DEV_DB_PORT gives a seat its own, so two builders in two
// worktrees stop reseeding each other's runs and stop fighting over the one
// connection PGlite serves (L30). Set it on the app too:
//   PITCH_DEV_DB_PORT=54332 node scripts/dev-db.mts
//   PITCH_DEV_DB_PORT=54332 npx next dev -p 3010
// and point SUPABASE_DB_URL at the same port.
//
// THREE seats built this knob, independently, in three worktrees, and named it
// two things. The merge is the first place anyone could see that. Fixing L30 by
// isolating builders is what made it possible: nobody was reading anybody
// else's tree. One name — the namespaced one, because PITCH_DEMO already sets
// that pattern and an un-namespaced one in a shell is a surprise — and the
// validation the third seat wrote, which is the part worth keeping (L35).
//
// A demo defaults to its own port, 54323, which is BUZ's. It used to IGNORE
// this knob, so a seat running the demo layer bound 54323 whatever it had set
// — BUZ's demo port, on a machine where his demo may be up (brief K item 7).
// An explicitly set port now wins for a demo too, and lib/demo's demoDbPort
// is the one rule both the database and a demo app read, so a seat's demo is
// read on the seat's port. `npm run demo` blanks the knob (scripts/demo.mjs),
// so the meeting demo still binds 54323. A plain dev database still refuses
// 54323: that is the demo's.
const DEV_PORT = Number(process.env.PITCH_DEV_DB_PORT || 54322);
const PORT = DEMO ? demoDbPort() : DEV_PORT;
if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535 || (!DEMO && PORT === DEMO_DB_PORT)) {
  console.error(`PITCH_DEV_DB_PORT=${process.env.PITCH_DEV_DB_PORT} is not a port a dev database may use (54323 is the demo's).`);
  process.exit(1);
}
const server = new PGLiteSocketServer({ db, port: PORT, host: '127.0.0.1', inspect: false });
await server.start();
console.log(`${DEMO ? 'demo' : 'dev'} db ready on 127.0.0.1:${PORT}${DEMO ? ` · club page /fc/${demoSlug}` : ''}`);
// Printed from the fixtures rather than typed out, so a new one appears here
// the day it is added — the old line had gone stale within one fixture.
// A BRAND-NEW SIGNUP: an account and nothing else — no record, no club, no
// coach profile. Every other fixture person already has something, so the
// first screen a real user ever sees had never been rendered by anyone.
// Empty states are where a product looks broken or looks confident, and this
// one had no fixture at all.
const robin = await db.query(
  `insert into person (first_name, last_name, dob, email) values ('Robin','Newman','1994-03-02','new@example.com') returning id`,
);
// A LIVE PASSWORD-RESET LINK, /reset/dev-reset, so the new-password form can
// be rendered at all. Since G-P2 (0163) a dead link goes straight to
// /reset?expired=1, and the layout check's focus-ring walk had only ever
// reached that form through a token that did not exist. Opening it uses
// nothing; nothing in the suites presses it.
await db.query(
  `insert into auth_reset (person_id, token_hash, expires_at) values ($1, $2, now() + interval '30 days')`,
  [robin.rows[0].id, sha('dev-reset')],
);

let pendingInvitationId = '';
// A PENDING INVITATION, so the guardian approval landing exists at all.
// /a/[id] is the screen a parent reaches from the SMS — the moment they say
// yes, and the single most important write in the product — and NO FIXTURE
// CREATED ONE, so it had never been rendered or exercised by anything. The
// walkthrough could not reach it either.
{
  const inv = await db.query(
    // Two links, one per channel (D-156), with KNOWN dev tokens like the
    // dev share links: /a/dev-mila-text and /a/dev-mila-email.
    `insert into pending_invitation (first_name, dob, guardian_name, guardian_phone, guardian_email, sms_token_hash, email_token_hash)
     values ('Mila','2013-04-18','Priya Raman','0412 345 678','priya@example.com',$1,$2) returning id`,
    [sha('dev-mila-text'), sha('dev-mila-email')],
  );
  console.log(`  approve: /a/dev-mila-text and /a/dev-mila-email (both needed) · no channel: /a/${inv.rows[0].id}`);
  pendingInvitationId = inv.rows[0].id as string;
}

// EVERY FIXTURE ADDRESS IS ONE SOMEBODY PROVED (0056, L21). An account whose
// address nobody has opened a link to signs in nowhere and can hold no child,
// so a seat with no proof behind it is a seat nobody can sit in. The evidence
// is written the way the product writes it — a used email_proof row — because
// the database refuses email_proved_at without one.
for (const r of (await db.query(`select id from person where email is not null and email_proved_at is null`)).rows) {
  await proveAddress((r as { id: string }).id);
}

// AND ONE THAT NOBODY PROVED: an account made at a door by someone who typed
// an address, with the link still sitting unopened. It signs in nowhere until
// /confirm/dev-unproved is pressed — the state B1 and B2 turn on, and the one
// the suites had no fixture for.
{
  const unproved = randomUUID();
  await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,'Casey','Duarte','1991-06-12','unproved@example.com')`, [unproved]);
  await db.query(
    `insert into email_proof (person_id, token_hash, expires_at) values ($1,$2, now() + interval '7 days')`,
    [unproved, sha('dev-unproved')],
  );
  console.log('  confirm: /confirm/dev-unproved (unproved@example.com signs in nowhere until it is pressed)');
}

// AND THE COACH-INVITE SHAPE OF THE SAME THING (B1): an account that carries
// a coach's address and a coach page, with nobody having opened the link we
// sent to it. A club typing that address must get exactly the answer it gets
// for an address with no account at all — proved in the write suite (c1c).
{
  const parkedCoach = randomUUID();
  await db.query(
    `insert into person (id, first_name, last_name, dob, email) values ($1,'Marnie','Ashworth','1988-02-09','unproved.coach@example.com')`,
    [parkedCoach],
  );
  await db.query(`insert into coach_profile (person_id) values ($1)`, [parkedCoach]);
  await db.query(
    `insert into email_proof (person_id, token_hash, expires_at) values ($1,$2, now() + interval '7 days')`,
    [parkedCoach, sha('dev-unproved-coach')],
  );
}

// AND THE B2 SHAPE ITSELF: somebody else has typed Mila's parent's address
// into a door and chosen a password on it. Nothing was sent to them and it
// gets them nothing — the account signs in nowhere, and the moment the real
// parent approves Mila on both channels the credential goes and the address
// becomes hers (lib/guardian-flow). The hash is deliberately not a real one:
// no password opens this account, at any point.
{
  const parked = randomUUID();
  await db.query(
    `insert into person (id, first_name, last_name, dob, email) values ($1,'Priya','Raman','1986-02-02','priya@example.com')`,
    [parked]);
  // A REAL scrypt hash, the shape lib/auth writes, so the suites can prove
  // the interesting thing: the RIGHT password on an unproved account still
  // signs nobody in, and after the approval it opens nothing at all.
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync('parked-password-1234', salt, 64).toString('hex');
  await db.query(
    `insert into auth_credential (person_id, password_hash) values ($1,$2)`, [parked, `${salt}:${derived}`]);
}

// --- THE RETURN (0064). A family gone from March to September, which is the
// football year rather than a failure. Two fixtures, because "while you were
// away" cannot be judged — or measured — against a database where nobody has
// ever been away:
//   · Alex last opened Pitch 80 days ago, and Nate 70, so both the guardian
//     seat and the 16-17 player seat render the block on a fresh seed.
//   · Deniz stays null: an under-16's arrivals are never recorded (D-25), and
//     a fixture that set one would hide that.
//   · Marina opened Deniz's CV 40 days ago and saw Nate in the list 50 days
//     ago, both INSIDE the away windows, so the read line has something true
//     to say on both seats. Nothing else in the seed writes register_read_log,
//     so before this the ledger only existed once a suite had happened to load
//     the club's register first (LESSONS L32).
// NOTE FOR THE NEXT SEAT: the guardian and 16-17 home pages now carry this
// block on every fresh seed. Any check that reads either page is reading this
// fixture.
{
  const alexId = (await db.query(`select id from person where email = 'guardian@example.com'`)).rows[0].id as string;
  const nateId = (await db.query(`select id from person where email = 'nate@example.com'`)).rows[0].id as string;
  await db.query(`update person set last_seen_at = now() - interval '80 days' where id = $1`, [alexId]);
  await db.query(`update person set last_seen_at = now() - interval '70 days' where id = $1`, [nateId]);
  // Two reads, two surfaces, so both halves of the line are exercised: the CV
  // opened (the strongest thing we own) and seen in the list.
  for (const [name, surface, days] of [['Deniz', 'cv', 40], ['Nate', 'list', 50]] as const) {
    const reg = await db.query(
      `select r.id from registration r
       join person p on p.id = r.player_id
       where p.first_name = $2 and r.club_id = $1 and r.withdrawn_at is null
       limit 1`,
      [riverside, name],
    );
    if (reg.rows.length === 0) continue;
    await db.query(
      `insert into register_read_log (person_id, registration_id, surface, read_at)
       values ($1,$2,$3, now() - ($4 || ' days')::interval)`,
      [td, reg.rows[0].id, surface, String(days)],
    );
  }
}

console.log(`  tokens : ${PLAYER_FIXTURES.map((p) => `dev-${p.slug}`).join(' ')} dev-expired dev-revoked`);
// Person ids, because the signed-in surfaces are the ones you cannot reach
// with a plain URL and every reseed mints fresh uuids.
{
  const who = await db.query(
    `select first_name, id from person where email is not null order by first_name`,
  );
  console.log(`  ids    : ${who.rows.map((r) => `${r.first_name}=${r.id}`).join(' ')}`);

  // A LIVE SESSION FOR EVERY FIXTURE PERSON, and its token written out with
  // the ids (0062). A session is now a row, so a suite cannot become a seat by
  // signing a person id any more — it needs a session the database issued, and
  // it cannot ask for one itself: PGlite serves one connection and next-server
  // holds it, so no script can reach this database while the app is up. The
  // seed is the only place that can mint these, which is also the honest
  // place: a session token in a gitignored file beside a throwaway database is
  // the same kind of handle the dev share tokens already are.
  //
  // Issued through fn_session_issue rather than an insert, so the fixtures
  // carry exactly the lifetime the product issues.
  // A demo signs its seats in by pressing a button (app/demo), so it needs
  // none of these and gets none.
  const sessions: Record<string, string> = {};
  for (const r of (DEMO ? [] : (await db.query(`select id from person`)).rows)) {
    const personId = (r as { id: string }).id;
    const token = randomBytes(24).toString('base64url');
    await db.query(`select fn_session_issue($1,$2)`, [personId, sha(token)]);
    sessions[personId] = token;
  }

  // Written to disk as well, because the render tests need to BE these people
  // and every reseed mints fresh uuids. Gitignored: it is a handle on a local
  // throwaway database, not a secret and not a fixture.
  const kids = await db.query(
    `select c.first_name, c.id as child_id,
       (select id from development_record where person_id = c.id) as record_id
     from guardianship_link g join person c on c.id = g.child_id
     where g.guardian_id = (select id from person where email = 'guardian@example.com')
     order by c.first_name`,
  );
  // A demo keeps its ids to itself: the tests read this file.
  if (!DEMO) writeFileSync(
    fileURLToPath(new URL('../.dev-ids.json', import.meta.url)),
    JSON.stringify({
      people: Object.fromEntries(who.rows.map((r) => [String(r.first_name).toLowerCase(), r.id])),
      sessions,
      children: Object.fromEntries(kids.rows.map((r) => [String(r.first_name).toLowerCase(), r])),
      pendingInvitation: pendingInvitationId,
      clubs: Object.fromEntries(
        (await db.query(`select public_slug, id from club where public_slug is not null`)).rows
          .map((r) => [r.public_slug, r.id]),
      ),
      // For the timing suite (scripts/timing-tests.mjs, doc 14 E10/L40/J61),
      // and read by nothing else. The club whose registrations are held (it
      // has no public slug, so it is not in `clubs`), and every adult who can
      // send their own CV — the house adult and the eighteen-year-olds on the
      // bulk register. L40 compares a real send with a limited one, and each
      // sender has ten real sends a day, so it needs more than one of them.
      heldClub: quarrymead,
      // Georgia's request to Quarrymead: the render suite opens its stop link
      // (0160) and checks that opening it stopped nothing.
      georgiaAsk,
      // Trials board v2's three Westgate fixtures (above): the write suite
      // removes them before its sweep (L32).
      boardV2Notices,
      adultPlayers: (await db.query(
        `select p.id as person_id, dr.id as record_id from person p join development_record dr on dr.person_id = p.id
         where p.dob is not null and fn_age_band(p.dob) = '18plus' order by p.first_name, p.id`)).rows,
    }, null, 2) + '\n',
  );
}
console.log('  sign-in: guardian@example.com (parent) · player@example.com (adult player) · nate@example.com (16–17 player) · td@example.com (club TD) · coach@example.com (coach) · admin@example.com (club administrator) · quarrymead@example.com (unverified club) · kingsway@example.com (free verified club, TD) · new@example.com (brand-new, nothing yet) · unproved@example.com (signs in nowhere until /confirm/dev-unproved)');
