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

  // Trials a few weeks out, whatever day the demo runs.
  const days = Math.max(0, Math.floor((Date.now() - SEED_WRITTEN.getTime()) / 86400000));
  if (days > 0) {
    await db.query(`update trial_notice set trial_on = trial_on + $1::int`, [days]);
    await db.query(`update registration set trial_on = trial_on + $1::int where trial_on is not null`, [days]);
  }

  // A crest: the club's own if BUZ has one, otherwise a plain initials shield
  // in the house colours, so the page never shows another club's stand-in.
  const sharp = (await import('sharp')).default;
  const png = o.crest
    ? await sharp(readFileSync(o.crest)).resize(512, 512, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()
    : await sharp(Buffer.from(shieldSvg(initials(club), found.rows[0].established))).png().toBuffer();
  const pub = fileURLToPath(new URL('../public/', import.meta.url));
  mkdirSync(join(pub, 'dev-uploads'), { recursive: true });
  const crestRel = `/dev-uploads/demo-crest-${clubId}.png`;
  writeFileSync(join(pub, crestRel.slice(1)), png);
  await db.query(`update club set crest_path = $2 where id = $1`, [clubId, crestRel]);
  await db.query(
    `update profile_version set content = jsonb_set(content, '{clubCrestPath}', to_jsonb($2::text))
     where content ? 'clubCrestPath' and content->>'club' = $1`,
    [club, crestRel]);

  await enrichRegistrants(db, clubId);
  await sampleMessages(db, clubId);

  return { slug, clubId };
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
  'Murphy', 'Ivanovic', 'Lopez', 'Chen', 'Barrett', 'Farah', 'Kowalski', 'Reyes', 'Sutherland', 'Aydin'];
const ABOUT_OUTFIELD = [
  'Two-footed and happiest on the ball. Looking for a club that plays through the thirds.',
  'Quick over ten metres and not afraid to take a player on. Want more minutes next season.',
  'Holds the ball up well and links play. Started up front, now just as happy out wide.',
  'Reads the game early and wins it back. Captained my team for most of last season.',
  'Left-sided, likes to overlap and deliver early crosses. Trains three times a week.',
  'A ten who likes to receive between the lines. Working on finishing with my weaker foot.',
  'Tall, good in the air at both ends. Comfortable stepping out with the ball.',
  'Played every minute last season. After a club where the training is harder.',
  'Box-to-box, covers a lot of ground. Took most of our set pieces this year.',
  'Direct runner in behind. Scored in both cup games this season.',
];
const ABOUT_GK = [
  'Keeper who likes to sweep and play out from the back. Good with both feet.',
  'Commanding on crosses and loud with my back four. Looking for more game time.',
  'Shot-stopper first. Working on distribution with the goalkeeping coach.',
];
// Where they play now: other made-up clubs already in the seed, so the page's
// club line is a real club row, as it is for every player on Pitch. A player
// registers interest in the demo club FROM somewhere.
const CURRENT = ['Northern United SC', 'Coburg City FC', 'Westgate Rangers'];
const PREVIOUS = ['Brunswick Juniors SC', 'Kingsway Rovers FC', 'Sunbury United']; // seed names only, never a real club
const HONOURS = [
  ['Club best and fairest', 'Voted by the coaches'],
  ['League runners-up', 'Played every round'],
  ['Players’ player', 'Voted by teammates'],
  ['Cup winners', 'Started in the final'],
  ['Most improved', 'End of season awards'],
];

async function enrichRegistrants(db: PGlite, clubId: string) {
  const { rows } = await db.query<{ person_id: string; record_id: string; positions: string[]; minor: boolean; u16: boolean; squad: string | null }>(
    `select p.id as person_id, dr.id as record_id, dr.positions,
            fn_age_band(p.dob) <> '18plus' as minor, fn_age_band(p.dob) = 'u16' as u16, s.name as squad
     from registration r
     join person p on p.id = r.player_id
     join development_record dr on dr.person_id = p.id
     left join squad s on s.id = r.squad_target
     where r.club_id = $1 and p.last_name is null
     order by p.first_name, p.dob`, [clubId]);
  const clubs = (await db.query<{ id: string; name: string; crest_path: string | null; suburb: string | null; state: string | null }>(
    `select distinct on (name) id, name, crest_path, suburb, state from club where name = any($1) order by name, id`, [CURRENT])).rows;

  for (const [i, r] of rows.entries()) {
    const gk = r.positions.includes('GK');
    const lastName = SURNAMES[(i * 7) % SURNAMES.length];
    const about = gk ? ABOUT_GK[i % ABOUT_GK.length] : ABOUT_OUTFIELD[(i * 3) % ABOUT_OUTFIELD.length];
    const prev = { orgName: PREVIOUS[i % PREVIOUS.length], period: `${2020 + (i % 3)}–${2023 + (i % 2)}` };
    const now = clubs.length ? clubs[i % clubs.length] : null;
    const clip = i % 4 === 3 ? null : {
      title: gk ? 'Saves and distribution, 2026' : i % 2 ? 'Season highlights 2026' : 'Goals and assists, 2026',
      url: `https://www.youtube.com/watch?v=demo-${i}`,
    };
    const honour = i % 4 === 0 ? HONOURS[(i / 4) % HONOURS.length] : null;
    const achievement = honour ? { title: honour[0], detail: `${honour[1]} · 2025` } : null;

    await db.query(`update person set last_name = $2 where id = $1`, [r.person_id, lastName]);
    if (now) {
      await db.query(`insert into membership (person_id, club_id, role) values ($1,$2,'player')`, [r.person_id, now.id]);
    }
    await db.query(`update development_record set about = $2 where id = $1`, [r.record_id, about]);
    await db.query(`insert into experience_entry (record_id, kind, org_name, season_label) values ($1,'previous_club',$2,$3)`,
      [r.record_id, prev.orgName, prev.period]);
    if (clip) {
      await db.query(`insert into highlight (record_id, url, title, added_as_minor) values ($1,$2,$3,$4)`,
        [r.record_id, clip.url, clip.title, r.minor]);
    }
    if (achievement) {
      await db.query(`insert into achievement (record_id, title, detail, sort) values ($1,$2,$3,0)`,
        [r.record_id, achievement.title, achievement.detail]);
    }
    // An under-16's page IS the approved snapshot (D-119), so it gets the same.
    if (r.u16) {
      await db.query(
        `update profile_version set content = content || $2::jsonb where record_id = $1 and status = 'approved'`,
        [r.record_id, JSON.stringify({
          lastName, about,
          previousClubs: [prev],
          ...(now ? {
            club: now.name,
            clubCrestPath: now.crest_path ?? undefined,
            locality: [now.suburb, now.state].filter(Boolean).join(' ') || undefined,
            squad: { name: r.squad ?? '', ageGroup: '', competitionGender: null },
          } : {}),
          highlights: clip ? [clip] : [],
          highlightsUsed: clip ? 1 : 0,
          achievements: achievement ? [achievement] : [],
        })]);
    }
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
