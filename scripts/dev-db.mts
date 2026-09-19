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
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
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
    await db.query(`insert into experience_entry (record_id, kind, org_name, season_label, notes) values ($1,$2,$3,$4,$5)`,
      [recordId, e.kind, e.orgName, e.period, e.note ?? null]);
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
await db.query(`update club set subscription_status='active' where id=$1`, [riverside]);
const td = randomUUID();
await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,'Marina','Petrovic','1980-04-12','td@example.com')`, [td]);
await db.query(`insert into membership (person_id, club_id, role) values ($1,$2,'technical_director')`, [td, riverside]);
// A club ADMINISTRATOR at a verified, paying club (D-154): keeps the page,
// squads, trials and billing, and reads no registration. No seat walked
// that wall before D-154 made it the rule.
const riversideAdmin = randomUUID();
await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,'Pat','Nguyen','1983-06-14','admin@example.com')`, [riversideAdmin]);
await db.query(`insert into membership (person_id, club_id, role) values ($1,$2,'club_admin')`, [riversideAdmin, riverside]);

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
await db.query(`insert into alumni_entry (club_id,line,detail,sort) values ($1,'Marco V. → NPL Victoria','Riverside juniors 2012–2018',0),($1,'Aylin D. → State representative squad','Riverside juniors 2011–2017',1),($1,'A 2019 U13 → our senior first team','Straight through the pathway, still playing',2)`, [riverside]);

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

// An UNCLAIMED club with a compiled listing (D-90 source 2): the board must
// show both routes — 'I'm interested' for verified clubs, 'Send my CV' for a
// listing we compiled from the club's own public notice.
const westgate = randomUUID();
// Compiled from public notices, including the address on them — which is
// where a claim code goes, and the only place it can go (doc 15 §34).
await db.query(`insert into club (id, name, suburb, state, club_state, public_slug, contact_email) values ($1,'Westgate Rangers','Altona','VIC','unclaimed','westgate-rangers','secretary@westgaterangers.example.au')`, [westgate]);
await trialAges((await db.query(`insert into trial_notice (club_id, title, trial_on, time_venue, source, competition_gender) values ($1,'U13 Boys trials','2026-10-12','Mon 5:30 PM · Grant Reserve','compiled','boys') returning id`, [westgate])).rows[0].id, ['U13']);

// --- walkthrough states: one of each waiting card, so every journey has
// something real to open. All fictional (doc 16 §4).
const recOf = async (name: string) =>
  (await db.query(`select dr.id from development_record dr join person p on p.id = dr.person_id where p.first_name = $1`, [name])).rows[0].id as string;
const personOf = async (name: string) =>
  (await db.query(`select id from person where first_name = $1`, [name])).rows[0].id as string;

// 1. Deniz has a pending edit waiting on his guardian (D-119)
const denizRec = await recOf('Deniz');
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
await db.query(
  `insert into share_request (record_id, requested_by, destination, created_at)
   values ($1, (select person_id from development_record where id = $1), 'Sunbury United <football@sunburyunited.example.au>', now() - interval '3 days')`,
  [georgiaRec],
);

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
await db.query(`insert into membership (person_id, club_id, role) values ($1,$2,'technical_director')`, [kingswayAdmin, kingsway]);
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

// Demo mode (npm run demo): rename the club to the one BUZ is meeting, and
// serve on the demo port so a demo and the dev database never meet.
const DEMO = process.env.DEMO_CLUB?.trim();
let demoSlug = '';
if (DEMO) {
  const { applyDemo } = await import('./demo-layer.mts');
  demoSlug = (await applyDemo(db, {
    club: DEMO,
    suburb: process.env.DEMO_SUBURB || undefined,
    state: process.env.DEMO_STATE || undefined,
    crest: process.env.DEMO_CREST || undefined,
    ground: process.env.DEMO_GROUND || undefined,
  })).slug;
}
const PORT = DEMO ? 54323 : 54322;
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
await db.query(
  `insert into person (first_name, last_name, dob, email) values ('Robin','Newman','1994-03-02','new@example.com')`,
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

console.log(`  tokens : ${PLAYER_FIXTURES.map((p) => `dev-${p.slug}`).join(' ')} dev-expired dev-revoked`);
// Person ids, because the signed-in surfaces are the ones you cannot reach
// with a plain URL and every reseed mints fresh uuids.
{
  const who = await db.query(
    `select first_name, id from person where email is not null order by first_name`,
  );
  console.log(`  ids    : ${who.rows.map((r) => `${r.first_name}=${r.id}`).join(' ')}`);

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
      children: Object.fromEntries(kids.rows.map((r) => [String(r.first_name).toLowerCase(), r])),
      pendingInvitation: pendingInvitationId,
      clubs: Object.fromEntries(
        (await db.query(`select public_slug, id from club where public_slug is not null`)).rows
          .map((r) => [r.public_slug, r.id]),
      ),
    }, null, 2) + '\n',
  );
}
console.log('  sign-in: guardian@example.com (parent) · player@example.com (adult player) · nate@example.com (16–17 player) · td@example.com (club TD) · coach@example.com (coach) · admin@example.com (club administrator) · sunbury@example.com (unverified club) · kingsway@example.com (free verified club, TD) · new@example.com (brand-new, nothing yet)');
