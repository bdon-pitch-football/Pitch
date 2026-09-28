// The demo layer (BUZ, 19 Sep): turns the dev seed's Riverside FC into the
// club BUZ is meeting. Run by scripts/dev-db.mts when DEMO_CLUB is set, before
// the database opens to the app. Only the CLUB is renamed — every player,
// parent and coach stays fictional. A club's own children are never loaded
// into a demo, whoever asks.
import type { PGlite } from '@electric-sql/pglite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type DemoOptions = {
  club: string;          // "Albion Rovers FC"
  suburb?: string;       // "Cairnlea"
  state?: string;        // "VIC"
  crest?: string;        // path to the club's own crest image, optional
  ground?: string;       // "Kevin Flint Reserve", optional
  unclaimed?: boolean;   // --unclaimed: start the club as a compiled listing
};

// The date the seed's trial dates were written against. Trials are shifted
// by however long it has been since, so a demo always shows trials a few
// weeks out rather than ones that expired last month.
const SEED_WRITTEN = new Date('2026-09-19T00:00:00+10:00');

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// "Albion Rovers FC" → "Albion Rovers": what the seed calls "Riverside".
const shortName = (s: string) =>
  s.replace(/\s+(FC|SC|AFC|Football Club|Soccer Club|United FC)$/i, '').trim() || s;

const initials = (s: string) =>
  s.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).map((w) => w[0].toUpperCase()).join('').slice(0, 4) || 'FC';

const xml = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function applyDemo(db: PGlite, o: DemoOptions): Promise<{ slug: string; clubId: string }> {
  const club = o.club.trim();
  const short = shortName(club);
  const slug = slugify(club);
  const mailSlug = slug.replace(/-/g, '');

  const found = await db.query<{ id: string; established: string | null }>(
    `select id, established from club where name = 'Riverside FC'`);
  if (found.rows.length !== 1) throw new Error('demo: the seed has no Riverside FC to rename');
  const clubId = found.rows[0].id;

  // Every text and jsonb column in the schema, most specific string first.
  // Tables that refuse updates (the append-only logs) are skipped: nothing in
  // them names the club.
  const swaps: [string, string][] = [
    ['Riverside FC', club],
    ['riverside-fc', slug],
    ['riversidefc', mailSlug],
    ['Riverside Park', o.ground?.trim() || `${short} home ground`],
    ['Riverside', short],
    // FIXED AT SOURCE on 28 Sep: lib/fixtures.ts no longer names a real
    // organisation, so these six swaps are now no-ops. They stay as
    // belt-and-braces — the rule is that no real club or school appears on an
    // invented child's page (L15, TRAINING §3.1), and a demo run in front of a
    // technical director who knows every club in the northern suburbs is the
    // worst possible place to discover a new one has crept in. If they are
    // ever removed, the check that replaces them has to be at the seed.
    // Nothing to translate any more: every organisation in the fixtures is
    // invented, so these pairs are gone rather than left as no-ops that read
    // like they are doing something. What replaced them is a rule written
    // where the names live (lib/fixtures.ts) and enforced by nobody — which
    // is the honest state, and is why the next one will be found by a person
    // reading the file rather than by a check. A seed-side assertion belongs
    // here and does not exist yet.
  ];
  const cols = await db.query<{ table_name: string; column_name: string; data_type: string }>(
    `select c.table_name, c.column_name, c.data_type
     from information_schema.columns c
     join information_schema.tables t on t.table_name = c.table_name and t.table_schema = c.table_schema
     where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
       and c.data_type in ('text', 'jsonb', 'character varying')`);
  for (const { table_name: t, column_name: c, data_type: type } of cols.rows) {
    for (const [from, to] of swaps) {
      const expr = type === 'jsonb'
        ? `replace("${c}"::text, $1, $2)::jsonb`
        : `replace("${c}", $1, $2)`;
      try {
        await db.query(`update "${t}" set "${c}" = ${expr} where "${c}"::text like '%' || $1 || '%'`, [from, to]);
      } catch {
        // append-only table or a constraint on this column: leave it
      }
    }
  }

  // Where the club is. The seed put Riverside in Brunswick VIC; the approved
  // snapshots froze that locality, so they move with it.
  if (o.suburb) {
    const state = (o.state || 'VIC').toUpperCase();
    await db.query(`update club set suburb = $2, state = $3 where id = $1`, [clubId, o.suburb, state]);
    await db.query(
      `update profile_version set content = replace(content::text, '"Brunswick VIC"', $1)::jsonb
       where content::text like '%"${short.replace(/'/g, "''")}%'`,
      [JSON.stringify(`${o.suburb} ${state}`)]);
  }

  // Trials a few weeks out, whatever day the demo runs — and ON THE DAY THE
  // NOTICE SAYS. The seed writes the weekday into the free text ("Sun 9:00 AM
  // · …") and the shift moved only the date, so the drift was one day per day
  // and a card read "Sun 9:00 AM" above Thursday 15 October. Community trials
  // are at the weekend; a technical director sees that in two seconds.
  //
  // So the date is shifted and then rolled FORWARD to the weekday its own
  // notice names. The text is left alone: it was right, the date was wrong.
  const days = Math.max(0, Math.floor((Date.now() - SEED_WRITTEN.getTime()) / 86400000));
  if (days > 0) {
    await db.query(`update trial_notice set trial_on = trial_on + $1::int`, [days]);
    await db.query(`update registration set trial_on = trial_on + $1::int where trial_on is not null`, [days]);
  }
  await alignTrialsToTheirOwnWeekday(db);

  // A crest: the club's own if BUZ has one, otherwise a plain initials shield
  // in the house colours, so the page never shows another club's stand-in.
  const sharp = (await import('sharp')).default;
  const png = o.crest
    ? await sharp(readFileSync(o.crest)).resize(512, 512, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()
    // No year on an unclaimed listing's stand-in crest. The seed's Riverside
    // was founded in 1974 and --unclaimed deletes the year along with
    // everything else a club writes for itself — but the shield had already
    // been drawn with it, so the club typed "1958" in the room and the page
    // ended with a crest reading 1974 beside the line "Est. 1958".
    : await sharp(Buffer.from(shieldSvg(initials(club), o.unclaimed ? null : found.rows[0].established))).png().toBuffer();
  const pub = fileURLToPath(new URL('../public/', import.meta.url));
  mkdirSync(join(pub, 'dev-uploads'), { recursive: true });
  const crestRel = `/dev-uploads/demo-crest-${clubId}.png`;
  writeFileSync(join(pub, crestRel.slice(1)), png);
  await db.query(`update club set crest_path = $2 where id = $1`, [clubId, crestRel]);
  await db.query(
    `update profile_version set content = jsonb_set(content, '{clubCrestPath}', to_jsonb($2::text))
     where content ? 'clubCrestPath' and content->>'club' = $1`,
    [club, crestRel]);

  if (o.unclaimed) {
    // --unclaimed: the club has never been on Pitch. Everything a club writes
    // for itself goes, so BUZ writes it in the room (below).
    await unclaimListing(db, clubId, mailSlug);
  } else {
    await enrichRegistrants(db, clubId);
    await fillSquads(db, clubId);
    await waitingOnTheClub(db, clubId);
    await theFiltersLand(db, clubId);
  }
  await sampleMessages(db, clubId);

  return { slug, clubId };
}

// The weekday a notice names, rolled forward from wherever the shift left it.
// A registration tagged to that trial moves with it, so the club's list and
// the notice never disagree about the date.
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
async function alignTrialsToTheirOwnWeekday(db: PGlite) {
  const { rows } = await db.query<{ id: string; trial_on: string; time_venue: string }>(
    `select id, to_char(trial_on, 'YYYY-MM-DD') as trial_on, time_venue from trial_notice`);
  for (const t of rows) {
    const named = WEEKDAYS.indexOf((t.time_venue.trim().slice(0, 3)));
    if (named < 0) continue;                        // no weekday in the text
    const on = new Date(`${t.trial_on}T00:00:00Z`);
    const shift = (named - on.getUTCDay() + 7) % 7;
    if (shift === 0) continue;
    await db.query(`update trial_notice set trial_on = trial_on + $2::int where id = $1`, [t.id, shift]);
    await db.query(`update registration set trial_on = trial_on + $2::int where trial_notice_id = $1 and trial_on is not null`, [t.id, shift]);
  }
}

// ---------------------------------------------------------------------------
// --unclaimed: the club as a COMPILED LISTING and nothing else (D-90 source 2,
// D-64). BUZ's first story is a club making its own page, so the page has to
// start as the one we built from their public notices: their name, their
// suburb, their ground, their trials, the address those notices carry — and
// not one thing the club would have written itself.
//
// Everything below is deleted rather than hidden, because each of these is a
// state the product CANNOT produce for an unclaimed club and a demo that shows
// one is a demo that lies. A family cannot register interest with an unclaimed
// club (/register-interest takes claimed or verified only), so there is no
// register; nobody has been granted a seat at a club nobody has claimed, so
// there are no club people; and the squads, the philosophy, the pathway, the
// year, the alumni wall and the players-wanted notices are exactly what the
// club is about to type in front of us.
// ---------------------------------------------------------------------------
async function unclaimListing(db: PGlite, clubId: string, mailSlug: string) {
  // The address on the club's own public notices — the only place a claim
  // code may go (doc 15 §34, app/claim). example.au is reserved for examples,
  // so nothing here can reach a real inbox even if the demo could send.
  const publicAddress = `football@${mailSlug}.example.au`;

  // Anything keyed to a registration first, then the registrations.
  await db.query(`delete from register_read_log where registration_id in (select id from registration where club_id = $1)`, [clubId]);
  await db.query(`delete from invitation_reply where invitation_id in (select id from invitation where club_id = $1)`, [clubId]);
  await db.query(`delete from invitation where club_id = $1`, [clubId]);
  await db.query(`delete from registration_request where club_id = $1`, [clubId]);
  await db.query(`delete from registration where club_id = $1`, [clubId]);
  // Then the club's people and its teams.
  await db.query(`delete from squad_claim where club_id = $1`, [clubId]);
  await db.query(`delete from squad_invitation where club_id = $1`, [clubId]);
  await db.query(`delete from register_grant where club_id = $1`, [clubId]);
  await db.query(`delete from wwcc_attestation where club_id = $1`, [clubId]);
  await db.query(`delete from role_application where role_id in (select id from coaching_role where club_id = $1)`, [clubId]);
  await db.query(`delete from coaching_role where club_id = $1`, [clubId]);
  await db.query(`delete from membership where club_id = $1`, [clubId]);
  await db.query(`delete from squad where club_id = $1`, [clubId]);
  // Then everything the club authors on its own page.
  await db.query(`delete from alumni_entry where club_id = $1`, [clubId]);
  await db.query(`delete from players_wanted_notice where club_id = $1`, [clubId]);
  await db.query(`delete from club_video where club_id = $1`, [clubId]);
  // The state and the call it rests on move together: club_check refuses a
  // verified club with no verification call behind it, and refuses it in
  // either order if they are written apart. That constraint is the D-126
  // invariant in the schema, so this obeys it rather than working around it.
  await db.query(
    `update club set club_state = 'unclaimed', verified_call_id = null, subscription_status = null,
       philosophy = null, pathway_line = null, established = null, banner_path = null,
       contact_email = $2
     where id = $1`,
    [clubId, publicAddress],
  );
  await db.query(`delete from verification_call where club_id = $1`, [clubId]);
  // The trials stay, and they say where they came from: a listing Pitch
  // compiled from the club's own public notice is the whole reason the page
  // exists before the club does (D-90).
  await db.query(`update trial_notice set source = 'compiled', cv_email = $2 where club_id = $1`, [clubId, publicAddress]);
}

// ---------------------------------------------------------------------------
// The register's 96 background players were seeded to test grouping at size:
// a first name, positions and stats. Opened in front of a club they looked
// empty. In a demo only, each gets what a real page carries — a surname, their
// own line about how they play, a club before this one, a clip, and for some
// an honour. All invented. Nothing about health, school or where they live
// (D-114, D-25): the same rules a real page follows.
// ---------------------------------------------------------------------------
const SURNAMES = ['Okafor', 'Rossi', 'Tran', 'Kelly', 'Haddad', 'Singh', 'Walker', 'Novak', 'Mensah', 'Costa',
  'Brennan', 'Demir', 'Fraser', 'Lindqvist', 'Ahmadi', 'Moreau', 'Clarke', 'Papadakis', 'Nakamura', 'Osei',
  'Murphy', 'Ivanovic', 'Lopez', 'Chen', 'Barrett', 'Farah', 'Kowalski', 'Reyes', 'Sutherland', 'Aydin',
  'Baptiste', 'Cardoso', 'Delaney', 'Eriksen', 'Fitzgerald', 'Gallagher', 'Hernandez', 'Ilic', 'Jovanovic', 'Kaur',
  'Lombardi', 'Mwangi', 'Nguyen', 'O’Sullivan', 'Petrov', 'Quiroga', 'Ramos', 'Salib', 'Tuiavii', 'Ugarte',
  'Vasquez', 'Whitfield', 'Yilmaz', 'Zielinski', 'Abebe', 'Baloch', 'Carrasco', 'Drennan', 'Eze', 'Ferrante',
  'Grimaldi', 'Hoang', 'Imran', 'Jelic', 'Kalinic', 'Lattouf', 'Maalouf', 'Nowak', 'Obeng', 'Pahlavi'];
// One dispenser, so a hundred and fifty people are a hundred and fifty
// families rather than thirty surnames used five times each.
let surnameCursor = 0;
// A CV with no photo shows the player's initials in the block where the photo
// goes — and "Goran Kelly, DM" rendered a card reading **GK** beside the line
// "DM · #16", which is a contradiction on the most important page we have.
// Nobody's initials are a bug; a demo that deals them out is. So a surname
// that would spell a position code the player does not play is skipped.
// (The closed list is doc 16's, held in lib/football.ts; it cannot be imported
// here without pulling Next's module graph into a seeding script.)
const POSITION_CODES = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST'];
const nextSurname = (firstName?: string, positions: string[] = []) => {
  for (let tries = 0; tries < SURNAMES.length; tries++) {
    const surname = SURNAMES[surnameCursor++ % SURNAMES.length];
    if (!firstName) return surname;
    const initials = `${firstName[0]}${surname[0]}`.toUpperCase();
    if (!POSITION_CODES.includes(initials) || positions.includes(initials)) return surname;
  }
  return SURNAMES[surnameCursor++ % SURNAMES.length];
};

// ---------------------------------------------------------------------------
// FIRST NAMES, and there have to be enough of them. The seed draws 96
// registrants from two pools of thirty, which is three or four of each name —
// and a register shows a first name and nothing else, so the squad picker
// listed four Cormacs and two Daras and read as a bug in the product rather
// than a thinness in the fixture. These pools are long enough that a demo
// club's 150-odd people are all but unique, which is what a register of this
// size actually looks like. Every name is invented; none belongs to anyone.
// ---------------------------------------------------------------------------
const BOYS_NAMES = [
  'Amir', 'Cormac', 'Eli', 'Goran', 'Idris', 'Jonty', 'Mateo', 'Omar', 'Sione', 'Ugo',
  'Xavier', 'Yusuf', 'Arlo', 'Dara', 'Emre', 'Fintan', 'Hugo', 'Jarrah', 'Kofi', 'Milo',
  'Otto', 'Rafa', 'Sami', 'Umar', 'Vinnie', 'Zeke', 'Bo', 'Marlon', 'Tobias', 'Ari',
  'Beau', 'Caelan', 'Dev', 'Ewan', 'Felix', 'Gus', 'Hamza', 'Isaac', 'Jude', 'Kian',
  'Lorenzo', 'Musa', 'Nikola', 'Oscar', 'Paulo', 'Rory', 'Sebastian', 'Theo', 'Vasili', 'Wes',
  'Yianni', 'Zane', 'Aleksi', 'Bodhi', 'Cruz', 'Diego', 'Elias', 'Finn', 'Gabriel', 'Harun',
  'Ilias', 'Joel', 'Kaito', 'Levi', 'Mirko', 'Noah', 'Oisin', 'Pedro', 'Quade', 'Reuben',
  'Salim', 'Tomas', 'Uri', 'Viktor', 'Wael', 'Xander', 'Yannick', 'Zac', 'Abel', 'Bruno',
  'Cian', 'Damir', 'Ezra', 'Franco', 'Georgios', 'Hadi', 'Ivo', 'Jesse', 'Kerem', 'Lachie',
  'Matias', 'Nash', 'Obi', 'Patryk', 'Ramiro', 'Soren', 'Tariq', 'Ulises', 'Vito', 'Willem',
  'Yaw', 'Zoran', 'Anton', 'Bilal', 'Callum', 'Dinh', 'Ennio', 'Fabio', 'Gideon', 'Hiro',
];
const GIRLS_NAMES = [
  'Bella', 'Divya', 'Freya', 'Hana', 'Kiri', 'Lucia', 'Nadia', 'Priya', 'Rania', 'Tara',
  'Vida', 'Wanjiru', 'Zara', 'Cleo', 'Gia', 'Ines', 'Lena', 'Noor', 'Pia', 'Talia',
  'Wren', 'Yara', 'Anouk', 'Esme', 'Maeve', 'Sadia', 'Thea', 'Xanthe', 'Imogen', 'Nell',
  'Amara', 'Bronte', 'Carys', 'Delphine', 'Elke', 'Fern', 'Greta', 'Halle', 'Isla', 'Juno',
  'Keira', 'Liana', 'Mira', 'Nia', 'Odette', 'Perla', 'Quinn', 'Romy', 'Sanna', 'Tilda',
  'Uma', 'Vera', 'Willa', 'Xia', 'Yasmin', 'Zoe', 'Ayla', 'Bea', 'Cassia', 'Dilara',
  'Elodie', 'Farrah', 'Georgie', 'Harriet', 'Indira', 'Jemima', 'Kaia', 'Leila', 'Mila', 'Nkechi',
  'Orla', 'Paloma', 'Rosa', 'Sienna', 'Tamsin', 'Ursula', 'Violeta', 'Winnie', 'Yumi', 'Zuri',
  'Alina', 'Brigid', 'Chiara', 'Dara', 'Eleni', 'Fatima', 'Gwen', 'Hina', 'Iris', 'Jada',
  'Kalinda', 'Lottie', 'Manon', 'Naomi', 'Oona', 'Pearl', 'Rafaela', 'Suri', 'Theodora', 'Vivi',
];
// One dispenser for the whole demo, so the register and the squads never hand
// out the same name twice.
const names = { boys: 0, girls: 0 };
const nextFirstName = (gender: string | null): string => {
  const girls = gender === 'girls' || gender === 'women';
  const pool = girls ? GIRLS_NAMES : BOYS_NAMES;
  const i = girls ? names.girls++ : names.boys++;
  return pool[i % pool.length];
};

// Deterministic, so a demo restarted between meetings is the same demo.
let demoSeed = 20260924;
const rnd = (n: number) => {
  demoSeed = (demoSeed * 1103515245 + 12345) % 2147483648;
  return Math.floor(demoSeed / 65536) % n;
};

// The position group a stat set is chosen from (D-70, the same derivation the
// product does at read time from positions[0]).
const groupOf = (positions: string[]): 'GK' | 'DEF' | 'MID' | 'FWD' => {
  const first = positions[0] ?? '';
  if (positions.includes('GK')) return 'GK';
  if (['RB', 'CB', 'LB'].includes(first)) return 'DEF';
  if (['DM', 'CM', 'AM'].includes(first)) return 'MID';
  return 'FWD';
};

// A season that holds up in front of a technical director. The seed drew
// every number from the same 1–12 range whatever the position, so the
// register was full of strikers with fifteen assists in eleven games and
// defenders outscoring them. Nothing here can exceed the appearances, and
// nothing is ever zero (D-70: a zero is omitted, never drawn).
const seasonFor = (positions: string[]): Record<string, number> => {
  const apps = 9 + rnd(14);
  const g = groupOf(positions);
  const clean = 1 + rnd(Math.max(1, Math.floor(apps / 3)));
  if (g === 'GK') return { apps, clean_sheets: clean };
  if (g === 'DEF') return { apps, clean_sheets: clean, goals: 1 + rnd(3), assists: 1 + rnd(4) };
  if (g === 'MID') return { apps, goals: 1 + rnd(Math.min(7, apps)), assists: 2 + rnd(Math.min(7, apps)) };
  return { apps, goals: 3 + rnd(Math.min(14, apps)), assists: 1 + rnd(5) };
};

// What a family types into the register box. Short, in their words, and
// matched to where the player plays — the register's "their line" column was
// blank on half the rows, which reads as an empty product rather than as a
// family who chose not to write anything. A few are still blank, because a
// few families genuinely leave it.
//
// Two rules these lines have to keep, and both were broken by the first draft
// of them. They carry NO PRONOUN — the demo files a player into a boys' or a
// girls' squad and a line written with "she" in it lands on a boy about one
// time in two, which reads as carelessly as the repetition did. And they
// carry no banned word (D-61, D-85): "struggles with the physical side" was
// in here, and "struggling" is on the list for the same reason "potential" is.
const NOTE_GK = [
  'Kept every game last season. After a club that plays out from the back.',
  'Been behind an older keeper for two years. Want game time.',
  'Goalkeeping training is what we are after — happy to travel for it.',
  'Started in goal halfway through last season and has not come out of it since.',
  'Wants a keeper coach. That is really the whole reason we are asking.',
  'Good with the ball at their feet. Kicking distance is the bit we know needs work.',
  'Has trained with the age group above all winter and held their own.',
  'Small for a keeper and knows it. Quick off the line to make up for it.',
  'Our club folded the junior teams, so we are looking for somewhere to go.',
  'Would come to training first, before anyone decides anything.',
  'Played outfield until last year. Took to it straight away.',
  'Has kept for the school side as well as the club.',
];
const NOTE_DEF = [
  'Plays right through the back four. Comfortable on either side.',
  'Moved into the area in July and looking for a club close by.',
  'Captained the back line last season. Wants a harder level.',
  'Centre back who likes to step in rather than drop off.',
  'Has played right back and left back in the same game. Happy either.',
  'Strong in the air for the age group. Takes our defensive set pieces.',
  'Quick recovery pace. We are told that is the bit clubs look for.',
  'Two seasons at full back, and would try midfield if there is room.',
  'Travels 25 minutes to training now and would rather be local.',
  'Came back from a broken wrist in May and played every game after it.',
  'Reads it well, not the quickest. We would rather say that than not.',
  'Has been the youngest in the team for two years and coped.',
];
const NOTE_MID = [
  'Plays in front of the back four. Two seasons at this level.',
  'Played every game last season. Want a step up.',
  'Left-footed, comfortable either side.',
  'Number eight who gets forward. Six goals from midfield last year.',
  'Sees a pass early. The physical side is what needs work.',
  'Has been with the same club since under 8s and wants a change.',
  'Trains with a futsal programme over summer — the touch shows.',
  'Would like to be considered for the age group above.',
  'Takes our corners and free kicks. Left foot.',
  'Moved from Perth in August. Nobody here has seen them play yet.',
  'Runs all day. Coaches keep telling us to work on the final ball.',
  'Played six and ten last season and prefers the ten.',
];
const NOTE_FWD = [
  'Scored in most games last season and wants a tougher league.',
  'Quick, runs in behind. Happy anywhere across the front.',
  'Has been playing up an age group and would like to keep doing it.',
  'Plays wide and cuts in. Right-footed on the left.',
  'Big up front, holds it up. Not quick, and we would not pretend otherwise.',
  'Top scorer in the team two seasons running.',
  'Came to football late, at eleven. Catching up fast.',
  'After a club where there are minutes, not just a squad number.',
  'Finishing is the strength; the pressing side is what we want coached.',
  'Happy to come to a trial with the older group if that helps.',
  'Two-footed in front of goal, which the coaches keep pointing out.',
  'Has played wide and through the middle. Better through the middle.',
];
const noteFor = (positions: string[], used: Set<string>): string | null => {
  // Roughly one in eight leaves it blank, because some families do.
  if (rnd(8) === 0) return null;
  const g = groupOf(positions);
  const pool = g === 'GK' ? NOTE_GK : g === 'DEF' ? NOTE_DEF : g === 'MID' ? NOTE_MID : NOTE_FWD;
  return pickUnused(pool, used);
};
// Never the same sentence twice in one bucket. Two identical lines three rows
// apart is what makes a list look generated, however deep the pool is.
function pickUnused(pool: string[], used: Set<string>): string {
  const start = rnd(pool.length);
  // Walk the whole pool from a random start rather than rolling a die a few
  // times: with twelve sentences and twelve players in a bucket, rolling
  // gives up and repeats one about once a list.
  for (let i = 0; i < pool.length; i++) {
    const s = pool[(start + i) % pool.length];
    if (!used.has(s)) { used.add(s); return s; }
  }
  return pool[start];
}
// The player's own line on their CV. Position-specific and deep enough that a
// technical director opening ten of them reads ten people — the seed had
// three keeper paragraphs for every keeper in the club, so three keepers
// opened as the same page with different numbers on it.
const ABOUT_DEF = [
  'Centre back. I like defending the box and I want to be better on the ball.',
  'Right back who gets forward. I take the long throws.',
  'Left-sided, likes to overlap and deliver early crosses. Trains three times a week.',
  'Tall, good in the air at both ends. Comfortable stepping out with the ball.',
  'I read the game early and win it back. Captained my team for most of last season.',
  'I have played every position across the back four this season.',
  'Quick across the ground. I would rather step in than drop off.',
  'I organise the line and I talk a lot. My coach says too much.',
  'Defender first, but I have played sixes when we have been short.',
  'I want to play at a level where I am not the fastest one on the pitch.',
];
const ABOUT_MID = [
  'A ten who likes to receive between the lines. Working on finishing with my weaker foot.',
  'Box-to-box, covers a lot of ground. Took most of our set pieces this year.',
  'I sit in front of the back four and I want to learn to do it properly.',
  'Two-footed and happiest on the ball. Looking for a club that plays through the thirds.',
  'I like to turn and run at people. Losing it in our half is what I am working on.',
  'Played every minute last season. After a club where the training is harder.',
  'I am not quick, so I try to be early. Passing is the part I trust.',
  'Left foot. I play eight or ten and I take the corners.',
  'Futsal over summer, outdoor in winter. The small-space stuff is my game.',
  'I want to be coached hard. Last season nobody told me anything.',
];
const ABOUT_FWD = [
  'Direct runner in behind. Scored in both cup games this season.',
  'Holds the ball up well and links play. Started up front, now just as happy out wide.',
  'Quick over ten metres and not afraid to take a player on. Want more minutes next season.',
  'I play off the left and come inside. Right-footed.',
  'Target player. I am strong and I am working on the first touch.',
  'I press from the front — that is the bit I am proudest of.',
  'Nine goals last season and I want to double it somewhere harder.',
  'I would play anywhere across the front line to get a game.',
  'I started as a full back two years ago. Still defend when I have to.',
  'I am small and I use it. In behind, every time.',
  'I take our penalties. I have missed two and I still want them.',
  'I moved up an age group in June and it took a month to catch up.',
];
const ABOUT_GK = [
  'Keeper who likes to sweep and play out from the back. Good with both feet.',
  'Commanding on crosses and loud with my back four. Looking for more game time.',
  'Shot-stopper first. Working on distribution with the goalkeeping coach.',
  'I have kept since under 9s. One-on-ones are what I am best at.',
  'I want a club with a keeper coach. That is what I do not have now.',
  'I play out with my feet because that is how my team plays. I like it.',
  'Not the tallest keeper. I come for everything I can reach.',
  'I kept every minute last season and I would like a harder league.',
];
const aboutFor = (positions: string[], used: Set<string>): string => {
  const g = groupOf(positions);
  const pool = g === 'GK' ? ABOUT_GK : g === 'DEF' ? ABOUT_DEF : g === 'MID' ? ABOUT_MID : ABOUT_FWD;
  return pickUnused(pool, used);
};
// Kept for the squad fill, which reads by index rather than at random.
const ABOUT_OUTFIELD = [...ABOUT_DEF, ...ABOUT_MID, ...ABOUT_FWD];
// Where they play now, and where before. Seed names only, never a real club
// (L15) — a player registers interest in the demo club FROM somewhere, and
// "somewhere" was three clubs for ninety-six children.
const CURRENT = ['Northern United SC', 'Marchfield City FC', 'Westgate Rangers', 'Kingsway Rovers FC', 'Quarrymead United'];
const PREVIOUS = ['Elderslie Juniors SC', 'Kingsway Rovers FC', 'Quarrymead United', 'Northern United SC', 'Marchfield City FC', 'Westgate Rangers'];
const HONOURS = [
  ['Club best and fairest', 'Voted by the coaches'],
  ['League runners-up', 'Played every round'],
  ['Players’ player', 'Voted by teammates'],
  ['Cup winners', 'Started in the final'],
  ['Most improved', 'End of season awards'],
  ['Golden boot', 'Top scorer in the age group'],
  ['Team of the year', 'Named by the league'],
  ['Coaches’ award', 'For attitude at training'],
  ['Champions', 'Won the grade by four points'],
  ['Summer futsal winners', 'Undefeated in the pool'],
];
const CLIP_TITLES_GK = [
  'Saves and distribution, 2026', 'A season in goal, 2026', 'Shot-stopping — 2026 highlights',
  'Coming for crosses, round 8–14', 'Playing out from the back, 2026',
];
const CLIP_TITLES_OUT = [
  'Season highlights 2026', 'Goals and assists, 2026', 'Full game — round 12, 2026',
  '2026 in eight minutes', 'Every goal, 2026', 'Pressing and recovery runs, 2026',
  'Grand final, 2026', 'Winter season 2026',
];

async function enrichRegistrants(db: PGlite, clubId: string) {
  const { rows } = await db.query<{
    registration_id: string; person_id: string; record_id: string; positions: string[];
    minor: boolean; u16: boolean; squad: string | null; squad_gender: string | null;
    surfaced: string[]; note: string | null;
  }>(
    `select r.id as registration_id, p.id as person_id, dr.id as record_id, dr.positions,
            fn_age_band(p.dob) <> '18plus' as minor, fn_age_band(p.dob) = 'u16' as u16,
            s.name as squad, s.age_group as squad_age, s.competition_gender as squad_gender,
            dr.surfaced_stats as surfaced, r.note
     from registration r
     join person p on p.id = r.player_id
     join development_record dr on dr.person_id = p.id
     left join squad s on s.id = r.squad_target
     where r.club_id = $1 and p.last_name is null
     order by s.competition_gender nulls last, p.first_name, p.dob`, [clubId]);
  const clubs = (await db.query<{ id: string; name: string; crest_path: string | null; suburb: string | null; state: string | null }>(
    `select distinct on (name) id, name, crest_path, suburb, state from club where name = any($1) order by name, id`, [CURRENT])).rows;

  // One set of sentences already used per squad bucket, because the bucket is
  // what a technical director reads down in one go.
  const usedIn = new Map<string, Set<string>>();
  const bucket = (key: string) => usedIn.get(key) ?? usedIn.set(key, new Set()).get(key)!;

  for (const [i, r] of rows.entries()) {
    const gk = r.positions.includes('GK');
    const firstName = nextFirstName(r.squad_gender);
    const lastName = nextSurname(firstName, r.positions);
    const used = bucket(r.squad ?? 'unfiled');
    const about = aboutFor(r.positions, used);
    const prev = { orgName: PREVIOUS[rnd(PREVIOUS.length)], period: `${2019 + rnd(4)}–${2023 + rnd(3)}` };
    // Roughly one in seven is between clubs, which is a real state and is what
    // stops a hundred CVs carrying one of three club lines.
    const now = clubs.length && rnd(7) !== 0 ? clubs[rnd(clubs.length)] : null;
    const clip = rnd(4) === 3 ? null : {
      title: gk ? CLIP_TITLES_GK[rnd(CLIP_TITLES_GK.length)] : CLIP_TITLES_OUT[rnd(CLIP_TITLES_OUT.length)],
      url: `https://www.youtube.com/watch?v=demo-${i}`,
    };
    const honour = rnd(2) === 0 ? HONOURS[rnd(HONOURS.length)] : null;
    const achievement = honour ? { title: honour[0], detail: `${honour[1]} · ${2024 + rnd(2)}` } : null;
    const season = seasonFor(r.positions);
    // THE AGE HAS TO FIT THE TEAM. The seed gave every background registrant a
    // birth year on a rolling `2008 + i % 8` and then filed them into a squad
    // at random, so the under-13 girls' list held a grown woman and the under
    // 21s held children — and because the permission layer renders the band it
    // computes, her CV came up in the 18+ layout, with no "Parent-approved"
    // chip, inside a list of twelve-year-olds. On a child-safety product that
    // is the one sentence a technical director cannot unhear.
    //
    // Australian junior football is calendar-year banded: an under-14 in 2026
    // is a player born in 2012. Deriving the birth year from the squad the
    // family named makes the list true by construction, and leaves the natural
    // spread of thirteens and fourteens inside it.
    const dob = dobForAgeGroup(r.squad_age);
    await db.query(`update person set first_name = $2, last_name = $3, dob = $4 where id = $1`,
      [r.person_id, firstName, lastName, dob]);
    const band = (await db.query<{ b: string }>(`select fn_age_band($1::date) as b`, [dob])).rows[0].b;

    if (now) {
      await db.query(`insert into membership (person_id, club_id, role) values ($1,$2,'player')`, [r.person_id, now.id]);
    }
    await db.query(`update development_record set about = $2 where id = $1`, [r.record_id, about]);
    // The line the family wrote on the register itself. Rewritten for every
    // row: the seed's four sentences were shared between fifty-five of a
    // hundred families, one of them sixteen times over.
    const note = noteFor(r.positions, used);
    await db.query(`update registration set note = $2 where id = $1`, [r.registration_id, note]);
    // A season that adds up. Rewritten rather than added to, because the seed
    // has already written a value for each surfaced key.
    await db.query(`delete from player_stat where record_id = $1 and season = '2026'`, [r.record_id]);
    for (const key of r.surfaced ?? []) {
      const value = season[key];
      if (!value) continue;                    // omitted, never a zero (D-70)
      await db.query(
        `insert into player_stat (record_id, season, stat_key, value, provenance) values ($1,'2026',$2,$3,'self_reported')`,
        [r.record_id, key, value]);
    }
    await db.query(`insert into experience_entry (record_id, kind, org_name, season_label) values ($1,'previous_club',$2,$3)`,
      [r.record_id, prev.orgName, prev.period]);
    if (clip) {
      await db.query(`insert into highlight (record_id, url, title, added_as_minor) values ($1,$2,$3,$4)`,
        [r.record_id, clip.url, clip.title, band !== '18plus']);
    }
    if (achievement) {
      await db.query(`insert into achievement (record_id, title, detail, sort) values ($1,$2,$3,0)`,
        [r.record_id, achievement.title, achievement.detail]);
    }

    // The family, reconciled to the age we just wrote. Moving a birth year
    // moves the band, and the band decides three things the product would
    // otherwise disagree with itself about: whether there is a guardian at all
    // (A17 — an under-18 without one has no CV and no invitation link, D-96),
    // whether the page is a guardian-approved snapshot or a live record
    // (D-119), and whether a guardian is still watching at all (D-49: at
    // eighteen that ends by itself).
    await reconcileFamily(db, {
      personId: r.person_id, recordId: r.record_id, band,
      content: {
        slug: 'live', firstName, lastName, dob: '',
        positions: r.positions, squadNumber: 2 + rnd(20), foot: rnd(4) === 0 ? 'Left' : 'Right',
        about, surfacedStats: r.surfaced ?? [],
        previousClubs: [prev],
        ...(now ? {
          club: now.name,
          clubCrestPath: now.crest_path ?? undefined,
          locality: [now.suburb, now.state].filter(Boolean).join(' ') || undefined,
          squad: { name: r.squad ?? '', ageGroup: '', competitionGender: null },
        } : {}),
        stats: (r.surfaced ?? []).filter((k) => season[k])
          .map((k) => ({ season: '2026', key: k, value: season[k], provenance: 'self_reported' })),
        highlights: clip ? [clip] : [],
        highlightsUsed: clip ? 1 : 0,
        achievements: achievement ? [achievement] : [],
        otherFootball: [],
      },
    });
  }
}

// A birth date inside the age group the family named. Australian junior
// football bands by calendar year, so an under-14 in 2026 was born in 2012 and
// is thirteen or fourteen today depending on the month — which is the spread a
// real team has. No squad named: a junior somewhere in the middle of the club.
const SEASON_YEAR = 2026;
function dobForAgeGroup(ageGroup: string | null): string {
  const n = ageGroup === 'SEN' ? 19 + rnd(12) : Number((ageGroup ?? '').replace(/\D/g, '')) || 12 + rnd(6);
  const year = SEASON_YEAR - n;
  const month = 1 + rnd(12);
  const day = 1 + rnd(28);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Whatever the age now says, make the rest of the record agree with it.
async function reconcileFamily(db: PGlite, o: {
  personId: string; recordId: string; band: string; content: Record<string, unknown>;
}) {
  if (o.band === '18plus') {
    // An adult holds their own record. A guardian's visibility ends at
    // eighteen by itself (D-49), and an adult page assembles live — there is
    // no approved snapshot for one and production cannot make one.
    await db.query(`delete from guardianship_link where child_id = $1`, [o.personId]);
    await db.query(`delete from profile_version where record_id = $1`, [o.recordId]);
    return;
  }
  const guardian = await ensureGuardian(db, o.personId);
  // u16: the page IS the approved snapshot. 16–17: there is no snapshot, the
  // record assembles live. Written fresh rather than merged, so a row the seed
  // wrote against a different age cannot survive underneath.
  await db.query(`delete from profile_version where record_id = $1`, [o.recordId]);
  if (o.band === 'u16') {
    await db.query(
      `insert into profile_version (record_id, content, status, approved_by, approved_at)
       values ($1,$2,'approved',$3,now())`,
      [o.recordId, JSON.stringify(o.content), guardian]);
  }
}

// Every under-18 has a parent, and every parent has an address somebody
// proved. The seed's ninety-six parents had neither a name nor an address, so
// an invitation to any of them sent NOTHING — the club's screen said "it is in
// their parent's Pitch account" and the outbox stayed where it was. Watching
// the parent get it is the demo's best forty seconds, and for ninety-six of a
// hundred rows it did not happen.
let parentCursor = 0;
async function ensureGuardian(db: PGlite, childId: string): Promise<string> {
  const have = await db.query<{ guardian_id: string; email: string | null }>(
    `select g.guardian_id, p.email from guardianship_link g join person p on p.id = g.guardian_id
     where g.child_id = $1 and g.revoked_at is null limit 1`, [childId]);
  let guardianId = have.rows[0]?.guardian_id;
  if (!guardianId) {
    guardianId = (await db.query<{ id: string }>(
      `insert into person (first_name, last_name, dob) values ($1,$2,'1982-04-04') returning id`,
      [['Sam', 'Jo', 'Chris', 'Ali', 'Robin', 'Pat'][parentCursor % 6], nextSurname()])).rows[0].id;
    await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`,
      [guardianId, childId]);
  }
  if (!have.rows[0]?.email) {
    const address = `parent${parentCursor}@example.com`;
    await db.query(`update person set email = $2 where id = $1 and email is null`, [guardianId, address]);
    await proveAddress(db, guardianId);
  }
  parentCursor++;
  return guardianId;
}

// The evidence the database insists on before an address counts as proved
// (0056, L21): a link we sent, opened. Written exactly as scripts/dev-db.mts
// writes it for the house fixtures.
async function proveAddress(db: PGlite, personId: string) {
  const { createHash } = await import('node:crypto');
  const hash = createHash('sha256').update(`demo-proof-${personId}`).digest();
  await db.query(
    `insert into email_proof (person_id, token_hash, expires_at, used_at)
     values ($1, $2, now() + interval '7 days', now()) on conflict (token_hash) do nothing`,
    [personId, hash]);
  await db.query(`update person set email_proved_at = coalesce(email_proved_at, now()) where id = $1`, [personId]);
}

// ---------------------------------------------------------------------------
// TEAMS WITH PLAYERS IN THEM (BUZ, 23 Sep). Every squad read "0 playing", so
// the one screen that shows a club its own football was an empty team sheet
// eleven times over. Four squads — two boys', two girls' (D-68) — get a real
// squad: a keeper, a back four, a midfield and a front three, each with their
// own record, their own season and their own page, exactly as a player who
// joined through a claim or an invitation would have (0052).
//
// These are the club's CURRENT players, which is a different population from
// the register: the register is who wants in. Nobody is in both.
// ---------------------------------------------------------------------------
// A team sheet, in the order a coach reads one. The four teams BUZ opens get
// the whole fourteen; the rest of the club gets the first eleven, so no squad
// on the page says "0 playing" and none of them is a stub.
const TEAM_SHAPE: string[][] = [
  ['GK'], ['RB', 'CB'], ['CB'], ['CB', 'RB'], ['LB'],
  ['DM', 'CM'], ['CM'], ['CM', 'AM'], ['RW', 'AM'], ['LW'], ['ST'],
  ['GK'], ['ST', 'AM'], ['LB', 'LW'],
];
const FULL_SQUADS = ['U14 Boys', 'U15 Boys', 'U15 Girls', 'U17 Girls'];

async function fillSquads(db: PGlite, clubId: string) {
  const squads = (await db.query<{ id: string; name: string; age_group: string | null; competition_gender: string | null }>(
    `select id, name, age_group, competition_gender from squad where club_id = $1 order by name`,
    [clubId])).rows;
  const club = (await db.query<{ name: string; crest_path: string | null; suburb: string | null; state: string | null }>(
    `select name, crest_path, suburb, state from club where id = $1`, [clubId])).rows[0];

  for (const s of squads) {
    const size = FULL_SQUADS.includes(s.name) ? TEAM_SHAPE.length : 11;
    // A team sheet is read top to bottom too: no two players in one squad
    // open with the same sentence about themselves.
    const used = new Set<string>();
    for (const [n, positions] of TEAM_SHAPE.slice(0, size).entries()) {
      const firstName = nextFirstName(s.competition_gender);
      const lastName = nextSurname(firstName, positions);
      // The same calendar-year banding the register uses, so a squad's own
      // list can never hold somebody the age group does not fit.
      const dob = dobForAgeGroup(s.age_group);
      const gk = positions.includes('GK');
      const season = seasonFor(positions);
      const surfaced = gk
        ? ['apps', 'clean_sheets']
        : groupOf(positions) === 'DEF' ? ['apps', 'clean_sheets', 'goals', 'assists'] : ['apps', 'goals', 'assists'];
      const about = aboutFor(positions, used);
      const foot = rnd(4) === 0 ? 'Left' : 'Right';
      const number = n + 1;

      const pid = (await db.query<{ id: string }>(
        `insert into person (first_name, last_name, dob) values ($1,$2,$3) returning id`,
        [firstName, lastName, dob])).rows[0].id;
      const band = (await db.query<{ b: string }>(`select fn_age_band($1::date) as b`, [dob])).rows[0].b;

      const recId = (await db.query<{ id: string }>(
        `insert into development_record (person_id, positions, squad_number, foot, about, surfaced_stats)
         values ($1,$2,$3,$4,$5,$6) returning id`,
        [pid, positions, number, foot, about, surfaced])).rows[0].id;
      for (const key of surfaced) {
        if (!season[key]) continue;
        await db.query(
          `insert into player_stat (record_id, season, stat_key, value, provenance) values ($1,'2026',$2,$3,'self_reported')`,
          [recId, key, season[key]]);
      }
      const clip = rnd(3) === 0 ? {
        title: gk ? CLIP_TITLES_GK[rnd(CLIP_TITLES_GK.length)] : CLIP_TITLES_OUT[rnd(CLIP_TITLES_OUT.length)],
        url: `https://www.youtube.com/watch?v=demo-squad-${recId.slice(0, 8)}`,
      } : null;
      if (clip) {
        await db.query(`insert into highlight (record_id, url, title, added_as_minor) values ($1,$2,$3,$4)`,
          [recId, clip.url, clip.title, band !== '18plus']);
      }
      // The membership IS the squad (0052): the club confirmed them, so the
      // CV can show a club and the team sheet can show them.
      await db.query(
        `insert into membership (person_id, club_id, squad_id, role, season) values ($1,$2,$3,'player','2026')`,
        [pid, clubId, s.id]);

      await reconcileFamily(db, {
        personId: pid, recordId: recId, band,
        content: {
          slug: 'live', firstName, lastName, dob: '',
          positions, squadNumber: number, foot,
          club: club.name, clubCrestPath: club.crest_path ?? undefined,
          locality: [club.suburb, club.state].filter(Boolean).join(' ') || undefined,
          squad: { name: s.name, ageGroup: s.age_group ?? '', competitionGender: s.competition_gender },
          about,
          stats: surfaced.filter((k) => season[k])
            .map((k) => ({ season: '2026', key: k, value: season[k], provenance: 'self_reported' })),
          achievements: [], otherFootball: [], previousClubs: [],
          highlights: clip ? [clip] : [], highlightsUsed: clip ? 1 : 0, surfacedStats: surfaced,
        },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// THINGS WAITING ON THE CLUB (BUZ, 23 Sep). A demo where nothing needs doing
// shows a club a filing cabinet. Three families asking to be confirmed into a
// squad, and interest sitting against both trials so the trial rows on the
// club's home page carry a number rather than a dash.
//
// The invitation waiting on a parent is already in the seed (Georgia's), and
// the shortlisted rows on the register are already there to invite from.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// THE FILTERS HAVE TO LAND ON SOMEBODY.
//
// docs/DEMO-TD.md step 2 is the moment the product is sold: age group, then
// position, then "shortlisted", and the line is "that's your keeper shortage,
// in two clicks". Walked on real data it ended on **0 of 100 shown**, because
// the register's twelve shortlisted rows are dealt out by the seed and no
// keeper in the age group BUZ opens happened to be among them.
//
// The empty state is well written and it is still the wrong thing to be
// looking at while saying that sentence. So: in every age group the run sheet
// names, if the club has a keeper on its register and has shortlisted none of
// them, shortlist one. It is a club action, done by the club, in a demo that
// belongs to the club — not a number invented to look good.
// ---------------------------------------------------------------------------
async function theFiltersLand(db: PGlite, clubId: string) {
  for (const age of ['U14', 'U15', 'U16', 'U18']) {
    await db.query(
      `update registration set club_status = 'shortlisted'
       where id = (
         select r.id from registration r
         join squad s on s.id = r.squad_target
         where r.club_id = $1 and r.withdrawn_at is null
           and s.age_group = $2 and 'GK' = any(r.positions)
           and r.club_status = 'new'
           and not exists (
             select 1 from registration x join squad xs on xs.id = x.squad_target
             where x.club_id = $1 and x.withdrawn_at is null
               and xs.age_group = $2 and 'GK' = any(x.positions)
               and x.club_status <> 'new')
         limit 1)`,
      [clubId, age]);
  }
}

async function waitingOnTheClub(db: PGlite, clubId: string) {
  // 1. Families saying "we already play here — confirm us" (0052, squad_claim).
  const squads = (await db.query<{ id: string; name: string; age_group: string | null; competition_gender: string | null }>(
    `select id, name, age_group, competition_gender from squad
     where club_id = $1 and name in ('U14 Boys','U15 Girls','U18 Boys') order by name`, [clubId])).rows;
  for (const [i, s] of squads.entries()) {
    const firstName = nextFirstName(s.competition_gender);
    const positions = [['CM'], ['LB', 'CB'], ['ST', 'RW']][i % 3];
    const lastName = nextSurname(firstName, positions);
    const dob = dobForAgeGroup(s.age_group);
    const pid = (await db.query<{ id: string }>(
      `insert into person (first_name, last_name, dob) values ($1,$2,$3) returning id`,
      [firstName, lastName, dob])).rows[0].id;
    const band = (await db.query<{ b: string }>(`select fn_age_band($1::date) as b`, [dob])).rows[0].b;
    const season = seasonFor(positions);
    const surfaced = ['apps', 'goals', 'assists'];
    const about = aboutFor(positions, new Set());
    const number = 20 + i;
    const recId = (await db.query<{ id: string }>(
      `insert into development_record (person_id, positions, squad_number, foot, about, surfaced_stats)
       values ($1,$2,$3,'Right',$4,$5) returning id`,
      [pid, positions, number, about, surfaced])).rows[0].id;
    for (const key of surfaced) {
      if (!season[key]) continue;
      await db.query(
        `insert into player_stat (record_id, season, stat_key, value, provenance) values ($1,'2026',$2,$3,'self_reported')`,
        [recId, key, season[key]]);
    }
    const guardian = band === '18plus' ? null : await ensureGuardian(db, pid);
    await reconcileFamily(db, {
      personId: pid, recordId: recId, band,
      content: {
        slug: 'live', firstName, lastName, dob: '', positions, squadNumber: number, foot: 'Right',
        squad: { name: s.name, ageGroup: s.age_group ?? '', competitionGender: s.competition_gender },
        about,
        stats: surfaced.filter((k) => season[k])
          .map((k) => ({ season: '2026', key: k, value: season[k], provenance: 'self_reported' })),
        achievements: [], otherFootball: [], previousClubs: [],
        highlights: [], highlightsUsed: 0, surfacedStats: surfaced,
      },
    });
    // Who asks is the player or their guardian, and the database enforces it
    // (0052): under 18 the parent asks, because a child never acts alone
    // (D-91); an adult asks for themselves.
    await db.query(
      `insert into squad_claim (person_id, club_id, squad_id, asked_by, created_at)
       values ($1,$2,$3,$4, now() - ($5 || ' days')::interval)`,
      [pid, clubId, s.id, guardian ?? pid, String(1 + i)]);
  }

  // 2. Interest against the trials the club has posted, so "12 interested"
  //    on the club's home page is a real count of real rows.
  const trials = (await db.query<{ id: string; trial_on: string; competition_gender: string | null }>(
    `select id, trial_on, competition_gender from trial_notice
     where club_id = $1 and trial_on >= (now() at time zone 'Australia/Melbourne')::date
     order by trial_on`, [clubId])).rows;
  for (const t of trials) {
    // Age group AND the competition it is for: a trial notice carries both
    // (D-68), and matching on the age alone puts girls on a boys' trial.
    await db.query(
      `update registration set trial_notice_id = $2, trial_on = $3
       where id in (
         select r.id from registration r
         join squad s on s.id = r.squad_target
         join trial_notice_age_group ta on ta.trial_notice_id = $2 and ta.age_group = s.age_group
         where r.club_id = $1 and r.trial_notice_id is null and r.withdrawn_at is null
           and ($4::text is null or s.competition_gender = $4)
         limit 12)`,
      [clubId, t.id, t.trial_on, t.competition_gender]);
  }

  // 3. A club Pitch has NOT rung yet, with a register it cannot read.
  //
  // This is the answer to the only hard question a technical director asks —
  // "what stops you handing my players' details to anyone who signs up?" — and
  // it could not be shown, because every club seat in the demo belonged to the
  // verified, paying club. The seed's Quarrymead United is claimed and unverified
  // with four held registrations; it gets enough of them to be the real shape
  // of the screen, and a seat on /demo to sit in.
  //
  // Nothing about these children reaches that club: fn_register_rows returns
  // nothing and the page shows a count (D-126). That is the point of it.
  const unverified = (await db.query<{ id: string }>(
    `select id from club where name = 'Quarrymead United' and club_state = 'claimed'`)).rows[0];
  if (unverified) {
    await db.query(
      `insert into registration (player_id, club_id, positions, note, club_status, disclosed_by, policy_version)
       select r.player_id, $2, r.positions, r.note, 'new',
              (select guardian_id from guardianship_link g where g.child_id = r.player_id and g.revoked_at is null limit 1),
              '20@v2.4'
       from registration r
       where r.club_id = $1 and r.withdrawn_at is null
         and not exists (select 1 from registration x where x.club_id = $2 and x.player_id = r.player_id)
       limit 38`,
      [clubId, unverified.id]);
  }
}

// ---------------------------------------------------------------------------
// "What families receive" opened empty, which is the one moment in the demo
// where BUZ wants to show the message itself. Four real messages, built by the
// same functions that send them (doc 15, lib/messages) so the words are the
// approved words: a parent asked to approve, the bare wake a trial invitation
// sends, and the CV email a club receives. Needs node --conditions=react-server
// (the launcher passes it) because lib/messages is server-only.
// ---------------------------------------------------------------------------
async function sampleMessages(db: PGlite, clubId: string) {
  let m: typeof import('../lib/messages.ts');
  try {
    m = await import('../lib/messages.ts');
  } catch {
    console.warn('demo: sample messages skipped (start the demo with npm run demo)');
    return;
  }
  // Numbers from the range ACMA sets aside for fiction; never a real phone.
  const parentPhone = '+61491570156';
  const priyaPhone = '+61491570157';
  const clubMail = (await db.query<{ cv_email: string | null }>(
    `select cv_email from trial_notice where club_id = $1 and cv_email is not null limit 1`, [clubId])).rows[0]?.cv_email
    ?? 'football@club.example.au';
  const nate = (await db.query<{ positions: string[]; club: string }>(
    `select dr.positions, c.name as club from person p
     join development_record dr on dr.person_id = p.id
     join membership m on m.person_id = p.id and m.role = 'player'
     join club c on c.id = m.club_id where p.first_name = 'Nate' limit 1`)).rows[0];

  const put = async (msg: { key: string; channel: 'sms' | 'email'; subject?: string; body: string }, to: string, minutesAgo: number) =>
    db.query(
      `insert into message_outbox (message_key, channel, to_address, subject, body, created_at)
       values ($1,$2,$3,$4,$5, now() - ($6 || ' minutes')::interval)`,
      [msg.key, msg.channel, to, msg.subject ?? null, msg.body, String(minutesAgo)]);

  if (nate) {
    await put(m.cvToClubEmail('Nate', 17, nate.positions.join(' · '), nate.club, 'demo-link', 'self', '16_17'), clubMail, 1440);
  }
  await put(m.bareWakeSms(), parentPhone, 180);
  await put(m.bareWakeEmail(), 'guardian@example.com', 179);
  await put(m.guardianApprovalSms('Mila', 13, 'demo-link'), priyaPhone, 25);
  await put(m.guardianApprovalEmail('Mila', 13, 'demo-link'), 'priya@example.com', 24);
}

function shieldSvg(letters: string, year: string | null): string {
  const size = letters.length <= 2 ? 190 : letters.length === 3 ? 150 : 118;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <path d="M256 22 L476 102 V238 C476 360 384 452 256 494 C128 452 36 360 36 238 V102 Z" fill="#3ddc84"/>
  <path d="M256 44 L456 116 V238 C456 348 372 432 256 470 C140 432 56 348 56 238 V116 Z" fill="#0f3a28"/>
  <path d="M256 76 L424 136 V238 C424 332 352 404 256 438 C160 404 88 332 88 238 V136 Z" fill="none" stroke="#1f7a4d" stroke-width="4"/>
  <text x="256" y="${year ? 282 : 300}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${size}" fill="#eef5f0">${xml(letters)}</text>
  ${year ? `<text x="256" y="358" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="40" letter-spacing="6" fill="#3ddc84">${xml(year)}</text>` : ''}
</svg>`;
}
