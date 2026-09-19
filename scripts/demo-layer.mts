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

  return { slug, clubId };
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
