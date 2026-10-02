// WRITE PATHS — presses every button in the product.
//
// The render suite walks by following links, so it only ever GETs. That left
// 73 forms and 54 server actions, of which exactly two were ever submitted by
// anything. Every real defect this codebase has produced came from the same
// place: the paths a fixture exercises are solid, the paths nothing exercises
// are broken. This walks the other half.
//
// It cannot read the database — PGlite serves one connection and next-server
// holds it — so every property below is observed THROUGH the product, which
// is the right discipline anyway. Three properties, generic to every form:
//
//   1. it submits with no JavaScript at all (303, never a 5xx)
//   2. a different account posting the identical fields changes nothing
//   3. the owner's own page reflects what they just did
//
// It MUTATES the dev database. That is the point. The dev database is
// in-memory (scripts/dev-db.mts), so a restart is a clean reset — run this
// last, then reseed.
import { createHmac, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { watchForTokens } from './token-in-url.mjs';
import { RULINGS } from './rulings.mjs';

// A genuine 1x1 PNG. Uploads are re-encoded server-side and type-checked by
// CONTENT rather than extension (D-94 §7), so a text file pretending to be an
// image would be rejected for the right reason and prove nothing.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

const BASE = process.env.RENDER_BASE ?? 'http://localhost:3000';
// Every response from here on is watched for a share token in what it would
// put in an address bar (scripts/token-in-url.mjs; brief D). Judged at the end.
const tokenWatch = watchForTokens(BASE);
const ids = JSON.parse(readFileSync(new URL('../.dev-ids.json', import.meta.url), 'utf8'));
// A session is a row now (0062), so a cookie is not something a script can
// compute: it has to name a session the database issued. The seed issues one
// per fixture person and writes the token beside the ids — this file cannot
// ask the database itself, because PGlite serves one connection and the app
// holds it. A missing one is a stale .dev-ids.json against a running database,
// which is worth saying out loud rather than failing as "signed out" fifty
// times (F5's failure shape).
const sessionToken = (p) => {
  const t = ids.sessions?.[p];
  if (!t) throw new Error(`no seeded session for ${p} — reseed (node scripts/dev-db.mts) so .dev-ids.json matches the running database`);
  return t;
};
const signed = (t) => `${t}.${createHmac('sha256', process.env.SESSION_SECRET || 'dev-only-secret-not-for-production').update(t).digest('base64url')}`;
const cookieFor = (p) => `pitch_session=${signed(sessionToken(p))}`;

const get = async (path, who) => {
  const r = await fetch(BASE + path, { redirect: 'manual', headers: who ? { cookie: cookieFor(who) } : {} });
  return { status: r.status, html: await r.text() };
};

// D-163 (0075): billing is OFF until further notice and this suite presses the product
// with it off. The blocks that press the Stripe build — D-153's free tier,
// the checkout form — turn the switch on through the app (/dev/billing; this
// file cannot reach the database) and put it back. The answer is read back,
// so a switch that did not flip stops the run.
async function billingSwitch(on) {
  const r = await fetch(`${BASE}/dev/billing?on=${on ? 1 : 0}`, { method: 'POST' });
  const j = r.ok ? await r.json() : null;
  if (j?.billing !== on) throw new Error(`the billing switch did not turn ${on ? 'on' : 'off'} (${r.status})`);
}
await billingSwitch(false);

// A control that names its form (form="<id>") belongs to THAT form wherever it
// sits in the page — the HTML rule a browser posts by. The CV builder's Number
// and Preferred foot sit on the card, outside the story form (the photo
// upload is its own form and forms cannot nest), and join it with form="cv"
// (spec C, 1 Oct). Read by nesting alone, a post from this suite would have
// left them out and blanked a player's number and foot, which no browser does.
const CONTROL = /<input\b[^>]*>|<select\b[^>]*>[\s\S]*?<\/select>|<textarea\b[^>]*>[\s\S]*?<\/textarea>/g;
const formAttr = (tag) => /\sform="([^"]*)"/.exec(tag.slice(0, tag.indexOf('>') + 1))?.[1];
/** Every <form> on a page, with the fields a browser would send. */
function forms(html) {
  const out = [];
  for (const m of html.matchAll(/<form([^>]*)>([\s\S]*?)<\/form>/g)) {
    const id = /\sid="([^"]+)"/.exec(m[1])?.[1];
    const outside = html.slice(0, m.index) + html.slice(m.index + m[0].length);
    const body = m[2].replace(CONTROL, (c) => (formAttr(c) !== undefined && formAttr(c) !== id ? '' : c))
      + (id ? [...outside.matchAll(CONTROL)].map((c) => c[0]).filter((c) => formAttr(c) === id).join('') : '');
    // Most forms post to the page they are rendered on, which is how a
    // server action works. The upload forms do not — they carry an explicit
    // action="/coach/edit/photo" and post to a dedicated route. Posting
    // those to the page returns "Failed to find Server Action", which looks
    // exactly like a broken action and is not one.
    const action = /action="([^"]+)"/.exec(m[1])?.[1] || null;
    const fields = {}; const visible = [];
    for (const i of body.matchAll(/<input[^>]*>/g)) {
      const name = /name="([^"]*)"/.exec(i[0])?.[1]; if (!name) continue;
      const type = /type="([^"]*)"/.exec(i[0])?.[1] ?? 'text';
      const value = /value="([^"]*)"/.exec(i[0])?.[1];
      if (type === 'hidden') fields[name] = value ?? '';
      else visible.push({ name, type, value, file: type === 'file' });
    }
    for (const s of body.matchAll(/<select[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/select>/g)) {
      // Capture the ATTRS then look inside them. The obvious regex — an
      // optional value="..." group inline — can skip the group entirely and
      // fall through to the option's TEXT, so a placeholder <option value="">—
      // reads as the literal em dash and the sweep posts a value no browser
      // would ever send. That is a bug in the test, and it looked exactly
      // like a bug in the product.
      const opts = [...s[2].matchAll(/<option([^>]*)>([^<]*)</g)]
        .map((o) => /value="([^"]*)"/.exec(o[1])?.[1] ?? o[2])
        .filter((v) => v !== undefined && v.trim() !== '');
      visible.push({ name: s[1], type: 'select', options: opts });
    }
    for (const t of body.matchAll(/<textarea[^>]*name="([^"]*)"/g)) visible.push({ name: t[1], type: 'textarea' });
    const label = /name="\$ACTION_ID_([a-f0-9]+)"/.exec(body)?.[1]
      ?? Object.keys(fields).join(',') ?? '?';
    // A method="get" form (a search) is a link with a query string: a browser
    // submits it as a GET, with or without JavaScript (30 Sep, /claim).
    const method = (/method="([^"]+)"/i.exec(m[1])?.[1] ?? 'post').toLowerCase();
    out.push({ fields, visible, action, method, bound: /\$ACTION_REF_/.test(body), actionId: label,
      submit: (/<button[^>]*type="submit"[^>]*>([\s\S]*?)<\/button>/.exec(body)?.[1] ?? '')
        .replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, "'").trim().slice(0, 34) });
  }
  return out;
}

// D-174 (0165): what PlayerCV draws for a club's colours — the hero's
// background and --cv-lead — read from the card's own markup, never from
// Next's flight data, which repeats every style inside a <script>.
const cvHero = (html) => /<section class="cv-hero[^"]*" style="([^"]*)"/.exec(html.replace(/<script[\s\S]*?<\/script>/g, ' '))?.[1] ?? '';
const { clubTheme, PRESETS } = await import('../lib/club-colours.ts');
const themeOf = (name) => clubTheme(PRESETS.find((p) => p.name === name), 'verified');
const wearsTheme = (html, t) => cvHero(html).includes(`${t.hero} 0%`) && cvHero(html).includes(`--cv-lead:${t.trim}`);

const SEATS = {
  parent: ids.people.alex, player: ids.people.jordan, 'club TD': ids.people.marina,
  coach: ids.people.sam, 'unverified club': ids.people['m.'], 'brand new': ids.people.robin,
  // A 16-17 sends their own CV (doc 14 L5). No seat walked that path, and it
  // went nowhere for every player who was not under 16.
  '16–17 player': ids.children.nate.child_id,
  // D-153: a verified club with no subscription, which invites for free from
  // its own posted trial. No seat walked that path before this.
  'free club': ids.people.dana,
  // D-154: an administrator at a verified club — every form she can reach.
  'club admin': ids.people.pat,
};

// Reachable pages per seat, by following links exactly as the render crawl does.
async function reach(who, extra = []) {
  const seen = new Set(); const queue = ['/home', '/trials', '/jobs', ...extra];
  const pages = [];
  while (queue.length) {
    const path = queue.shift();
    if (seen.has(path) || seen.size > 60) continue;
    seen.add(path);
    const r = await get(path, who);
    if (r.status !== 200) continue;
    pages.push({ path, html: r.html });
    for (const m of r.html.matchAll(/href="(\/[^"#][^"]*)"/g)) {
      const h = m[1];
      // An image is not a page, whatever follows its name: an under-18's photo
      // is drawn at a signed address (/private-photo/…jpg?e=…&s=…, John's
      // ruling §1) and React preloads it with a <link href>, so the old test
      // on the end of the string followed every one as a page — two of the
      // parent's sixty, which moved who met Jordan's forms first (L32).
      if (h.startsWith('/_next') || h.startsWith('/assets') || h.startsWith('/private-photo/')
        || /\.(png|svg|jpg|ico|xml|txt|webmanifest)$/.test(h.split('?')[0])) continue;
      // Never /signout. This walk follows every link it finds, and signing out
      // now REVOKES the session rather than deleting the browser's copy of a
      // cookie (0062) — so following it once ended the seat and every check
      // after it saw a signed-out product. It cost an hour to find as
      // "cp1: an adult with no page is offered Publish my page" going red,
      // because the only Sign out link in the product is on the home screen
      // of an account with no children, and Robin is the only seat that has
      // one. Pressing it is sess-w1..w3's job, on a session opened for it.
      if (h === '/signout') continue;
      // Nor the two documents brief K serves (/conduct, /report/policy). They
      // hold no form, and this walk stops at 60 pages: /report's new link to
      // the policy spent one of them, which moved which seat met a form
      // first — the player's own register-interest page was swept as the
      // player, with the first squad in its list, and the A4 age hold took
      // him off the product for every check after it (L32: a page is a
      // fixture). The render suite reads both pages; this one presses forms.
      if (h === '/conduct' || h === '/report/policy') continue;
      // Nor the two ways in the Floodlit nav bar (D-173, 1 Oct) put on every
      // club page: the logo's `/` and "Find your club" `/claim`. Each holds
      // only a GET search, which the render suite reads (fd2, the /claim
      // checks); followed here they spent two of the 60 pages and moved which
      // seat met Jordan's forms first — ks-w0, sq2 and sq3 went red exactly as
      // brief K recorded (L32).
      if (h === '/' || h === '/claim' || h.startsWith('/?') || h.startsWith('/claim?')) continue;
      // Nor, for the parent, B1's door "Build {first}'s page" (1 Oct). The
      // parent seat walks first, so following it let the parent claim the
      // builder's forms before the player did, and the sweep pressed them on
      // a child's record instead of Jordan's own — ks-w0, sq2 and sq3 went red
      // (L32: a page is a fixture). The builder is pressed as the player, as
      // it was before the door existed; the door itself is walked by hm9 and
      // hm-w2b, and the parent can open what it points at (hm9b, hm-w2b).
      if (who === ids.people.alex && /^\/build\/[0-9a-f-]{36}$/.test(h)) continue;
      // Nor the trials board's new filtered views (filters package, BUZ 2
      // Oct): Region, Show and Club level put a chip per option on /trials,
      // each a GET view with no form. Followed, they would spend some of
      // the 60 pages and move which seat meets Jordan's forms first — L32:
      // a page is a fixture. The render suite reads every one of them.
      if (/^\/trials\?(?:[^"]*&(?:amp;)?)?(?:area|kind|level)=/.test(h)) continue;
      if (!seen.has(h)) queue.push(h);
    }
  }
  return pages;
}


let pass = 0; const failures = [];
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass += 1; console.log(`OK   ${name}`); }
  else { failures.push(name); console.log(`FAIL ${name} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

// ---------------------------------------------------------------------------
// tv-w0 — trials board v2's fixtures come off first (BUZ, 2 Oct). The seed
// gives Westgate Rangers a second trial on the same day and two expressions of
// interest, for the render and layout suites to read one row per club per day
// and the second section. This suite's sweep stops at 60 pages a seat, and
// each page those notices add (two chips, a ?trial= view each) moved which
// seat met Jordan's forms first: ks-w0, sq2 and sq3 went red (L32: a page is a
// fixture). So they come down here, through the operator's own Remove, and
// the sweep walks the board it has always walked.
// ---------------------------------------------------------------------------
{
  const op = ids.people.marina;
  const v2 = ids.boardV2Notices ?? [];
  let removed = 0;
  for (const { club, id } of v2) {
    const screen = `/ops/clubs/${ids.clubs[club]}`;
    const rm = forms((await get(screen, op)).html).find((f) => f.fields.notice_id === id && f.submit === 'Remove');
    if (!rm) continue;
    const fd = new FormData();
    for (const [k, v] of Object.entries(rm.fields)) fd.append(k, v);
    const r = await fetch(BASE + screen, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(op) } });
    await r.text();
    if (r.status === 303) removed++;
  }
  const board = (await get('/trials', null)).html;
  check(`tv-w0: the seed's four board v2 notices (Westgate three, Kestrelford one) are taken off before the sweep, and the board is the one it walked before them (${removed} of ${v2.length} removed)`,
    [v2.length, removed, board.includes('U12 Boys'), /class="tb-sec"/.test(board), (board.match(/<li\b[^>]*data-listing=""/g) ?? []).length],
    [4, 4, false, false, 4]);
}

// ---------------------------------------------------------------------------
// co-w1 — the coach screens (spec E, BUZ 1 Oct): "This role has closed." is
// said once. A role closed while the coach had it open sends them back with
// ?closed, and the page printed the amber notice AND the closed panel. Run
// against the code before this build, it counted two (L20). First in the
// run, while every club is up (the run suspends them later, and a suspended
// club's role is not found at all), and on a role Kingsway posts for it, so
// the seed's own roles stay open for the sweep.
// ---------------------------------------------------------------------------
{
  const dana = ids.people.dana, sam = ids.people.sam;
  const press = async (path, who, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual', headers: who ? { cookie: cookieFor(who) } : {} });
    await r.text();
    return { status: r.status };
  };
  const post = forms((await get('/club/roles', dana)).html).find((f) => f.visible.some((v) => v.name === 'commitment'));
  if (post) await press('/club/roles', dana, { ...post.fields, title: 'Goalkeeping Coach — co-w1', commitment: 'Wed 5–6pm' });
  const roles = (await get('/club/roles', dana)).html;
  const close = forms(roles).find((f) => 'roleId' in f.fields && f.submit === 'Close'
    && roles.indexOf('Goalkeeping Coach — co-w1') > -1 && roles.indexOf('Goalkeeping Coach — co-w1') < roles.indexOf(`value="${f.fields.roleId}"`));
  if (close) await press('/club/roles', dana, close.fields);
  const page = close ? await get(`/jobs/${close.fields.roleId}?closed=1`, sam) : { status: 0, html: '' };
  const said = (page.html.replace(/<script[\s\S]*?<\/script>/g, ' ').match(/This role has closed\./g) ?? []).length;
  check(`co-w1: a role its club closed says "This role has closed." once, with ?closed in the address as well (${said})`,
    [Boolean(post), Boolean(close), page.status, said], [true, true, 200, 1]);
}

/** A plausible, VALID value, so the happy path is what runs. */
function value(f) {
  const n = f.name.toLowerCase();
  if (f.type === 'radio' || f.type === 'checkbox') return f.value ?? 'on';
  if (f.type === 'select') return f.options?.[0] ?? '';
  if (n.includes('url')) return 'https://www.youtube.com/watch?v=sweep12345';
  if (n.includes('email')) return 'sweep@example.com';
  if (n === 'year' || n === 'from' || n === 'to') return '2024';
  if (n.includes('_on') || n.includes('closes') || n.includes('date')) return '2026-12-01';
  if (f.type === 'number' || n.includes('number') || n.startsWith('stat_')) return '7';
  if (n.includes('phone') || n.includes('mobile')) return '0400000111';
  if (n === 'password') return 'sweep-password-9876';
  return 'Sweep test value';
}

const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/\?v=\d+/g, '');

async function post(path, who, form) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(form.fields)) fd.append(k, v);
  const seen = new Set();
  for (const v of form.visible) {
    if (seen.has(v.name)) continue;             // radios: first wins
    seen.add(v.name);
    if (v.file) fd.append(v.name, new Blob([PNG], { type: 'image/png' }), 'sweep.png');
    else fd.append(v.name, value(v));
  }
  const r = form.method === 'get'
    ? await fetch(BASE + path + (path.includes('?') ? '&' : '?') + new URLSearchParams([...fd.entries()].map(([k, v]) => [k, String(v)])).toString(),
        { redirect: 'manual', headers: who ? { cookie: cookieFor(who) } : {} })
    : await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual',
        headers: who ? { cookie: cookieFor(who) } : {} });
  await r.text();
  return r.status;
}

// ---------------------------------------------------------------------------
// D-164 (4): a tap on a locked Premium row (builder-final-b) — and since
// John's ruling (2 Oct; BUZ "go with the best recommendation") there is no row
// to tap while D-163 stands: lib/premium's one switch is off. prem-w1 used to
// require the form on an adult's Highlights; it now requires there is none,
// on the same page. prem-w2, prem-w2b and prem-w3 pressed "Unlimited clips"
// and read the answer: with no form on any page there is nothing to press, so
// they are RETIRED, not rewritten. What they guarded stays guarded: the count
// (prem1–prem3b), the switch and the tap's early return (prem6) in the
// permission suite, and no row on any page for any seat (render ap-r14). Turn
// the switch on and these come back from git (c. f8fa273).
// ---------------------------------------------------------------------------
{
  const jordan = ids.people.jordan;
  const home = await get('/home', jordan);
  const clipsPath = /href="(\/build\/[0-9a-f-]{36}\/clips)"/.exec(home.html)?.[1];
  const page = clipsPath ? await get(clipsPath, jordan) : { status: 0, html: '' };
  check('prem-w1: an adult\'s Highlights carries no Premium form to press while D-163 stands',
    [page.status, forms(page.html).some((f) => f.fields.on === 'clips'), /name="feature"/.test(page.html)], [200, false, false]);
  // The same press from a 16–17 — who is never shown the rows — goes nowhere
  // a minor could see Premium on, and records nothing (prem2 proves the count).
  const coachPage = await get('/coach/edit', ids.children.nate.child_id);
  check('prem-w4: a 16–17 on the coach page is never given the form to press',
    [coachPage.status, forms(coachPage.html).some((f) => f.fields.on === 'coach')], [200, false]);
}

// ---------------------------------------------------------------------------
// "Verify for {club}" pressed (D-160; 0122). The squad's coach confirms one of
// Deniz's numbers from the squad CV. The button for that number goes, because
// it is no longer self-reported; Deniz's page is the parent's approved
// snapshot, so the number on it does not move until the next approval
// (BUZ, 29 Sep: "as built"). The same form posted by the administrator, by
// Deniz's parent and by a stranger changes nothing (asserted on the state, L12).
// ---------------------------------------------------------------------------
{
  const sam = ids.people.sam, deniz = ids.children.deniz.child_id;
  let denizCv = null;
  for (const m of new Set([...(await get('/club/squads', ids.people.marina)).html.matchAll(/href="(\/club\/squads\/[0-9a-f-]{36})"/g)].map((x) => x[1]))) {
    if ((await get(m, ids.people.marina)).html.includes(`/cv/${deniz}`)) { denizCv = `${m}/cv/${deniz}`; break; }
  }
  const offered = async () => denizCv ? forms((await get(denizCv, sam)).html).filter((f) => /^Verify for /.test(f.submit)) : [];
  const before = await offered();
  const post = async (who, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    const r = await fetch(BASE + denizCv, { method: 'POST', body: fd, redirect: 'manual', headers: who ? { cookie: cookieFor(who) } : {} });
    await r.text();
    return r;
  };
  check('vfy-w1: the squad\u2019s coach is offered the button on Deniz\u2019s numbers', [Boolean(denizCv), before.length > 0], [true, true]);
  if (before.length) {
    for (const who of [ids.people.pat, ids.people.alex, null]) await post(who, before[0].fields);
    check('vfy-w2: the administrator, the parent and a stranger posting the same form verify nothing', (await offered()).length, before.length);
    const r = await post(sam, before[0].fields);
    check('vfy-w3: the coach\u2019s press verifies it, with no JavaScript, and lands back on the CV',
      [r.status, (r.headers.get('location') ?? '').replace(BASE, ''), (await offered()).length], [303, denizCv, before.length - 1]);
  }
}



// ---------------------------------------------------------------------------
// BRIEF F (29 Sep): the crest a verified Technical Director has earned, and
// ending a TD's access (0100; D-48, D-93). Pressed through the real screens:
// the coach editor, /club/roles as the club's administrator, the operator's
// call sheet, and the sheet's call naming somebody else. Every read the TD
// made is asked again afterwards through the page that makes it — the
// register, a CV opened from it, a squad, a CV opened from the squad — not by
// reading a membership row. EARLY, on the fresh database, because the squads
// are emptied and seeded sessions ended by the time the suite is done; and it
// hands both roles back through calls at the end (tde-w15, tde-w16), so every
// block after it sees the seed's Technical Directors in their seats.
// ---------------------------------------------------------------------------
{
  const marina = ids.people.marina, pat = ids.people.pat, sam = ids.people.sam, dana = ids.people.dana;
  const op = ids.people.jordan;   // any signed-in person with an address is an operator in development (lib/ops-policy)
  const words = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&rsquo;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  const press = async (path, who, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual', headers: who ? { cookie: cookieFor(who) } : {} });
    await r.text();
    return { status: r.status, location: (r.headers.get('location') ?? '').replace(BASE, '') };
  };

  // ---- the crest ------------------------------------------------------------
  // The half the render suite cannot press: a Technical Director whose typed
  // line names ANOTHER club wears no crest, although her own club has one.
  // Any crest image in the hero: the sweep above uploaded a new crest for
  // Riverside, so its file name is not the seed's any more.
  const cv = async () => (await get('/c/marina-petrovic', null)).html;
  const hero = (h) => h.slice(0, h.indexOf('Coaching now'));
  const crestOn = (h) => /<img[^>]+src="[^"]*crest[^"]*"/.test(hero(h));
  const setRole = async (org) => {
    for (;;) {
      const rm = forms((await get('/coach/edit', marina)).html).find((f) => 'roleId' in f.fields);
      if (!rm) break;
      await press('/coach/edit', marina, rm.fields);
    }
    const add = forms((await get('/coach/edit', marina)).html).find((f) => f.visible.some((v) => v.name === 'org'));
    await press('/coach/edit', marina, { ...add.fields, title: 'Technical Director', org, from: '2022', to: '' });
  };
  check('crest-w0: the Technical Director the call confirmed wears Riverside’s crest before anything is pressed',
    crestOn(await cv()), true);
  await setRole('Northern United SC');
  const typed = await cv();
  check('crest-w1: a typed "Technical Director, Northern United SC" wears no crest — not hers, not theirs — though her own club has one',
    [/Northern United SC · Melbourne VIC/.test(words(hero(typed))), crestOn(typed)],
    [true, false]);
  await setRole('Riverside FC');
  // Her earlier role back as well, so the page is the seed's again.
  const addPast = forms((await get('/coach/edit', marina)).html).find((f) => f.visible.some((v) => v.name === 'org'));
  await press('/coach/edit', marina, { ...addPast.fields, title: 'Head Coach · U16 Girls', org: 'Northern United SC', from: '2017', to: '2022' });
  check('crest-w2: typed back to the club the call confirmed, the crest returns — so w1 saw the page move',
    crestOn(await cv()), true);

  // ---- before: what the TD reads, through the pages that read it ----------
  const reg = (await get('/club/register', marina)).html;
  const regCv = /href="(\/club\/register\/cv\/[0-9a-f-]{36})"/.exec(reg)?.[1];
  // The first squad with a player in it — some are empty by now.
  let squad = null, squadCv = null;
  for (const m of new Set([...(await get('/club/squads', marina)).html.matchAll(/href="(\/club\/squads\/[0-9a-f-]{36})"/g)].map((x) => x[1]))) {
    squadCv = /href="(\/club\/squads\/[0-9a-f-]{36}\/cv\/[0-9a-f-]{36})"/.exec((await get(m, marina)).html)?.[1] ?? null;
    if (squadCv) { squad = m; break; }
  }
  const reads = async (who) => Promise.all(['/club/register', regCv, squad, squadCv].map(async (p) => (p ? (await get(p, who)).status : null)));
  check('tde-w0: the TD reads the register, a CV opened from it, a squad and a CV opened from the squad',
    [Boolean(regCv && squad && squadCv), await reads(marina)], [true, [200, 200, 200, 200]]);

  // ---- the club administrator's door ------------------------------------------
  const rolesPat = (await get('/club/roles', pat)).html;
  const endForm = forms(rolesPat).find((f) => /^End their access/.test(f.submit));
  check('tde-w1: the club’s administrator sees the Technical Director’s row and the door, on /club/roles',
    [/Technical Director Marina Petrovic/.test(words(rolesPat)), Boolean(endForm)], [true, true]);
  const samRoles = await fetch(BASE + '/club/roles', { redirect: 'manual', headers: { cookie: cookieFor(sam) } });
  await samRoles.text();
  check('tde-w2: the TD herself is not given it, and a coach cannot open the screen',
    [forms((await get('/club/roles', marina)).html).some((f) => /^End their access/.test(f.submit)),
     samRoles.status, (samRoles.headers.get('location') ?? '').replace(BASE, '')],
    [false, 307, '/home']);
  // The same fields posted by everybody who must not end it, and by the
  // administrator without a reason. Asserted on the state (L12): the TD still
  // reads everything, whatever each press answered.
  for (const who of [marina, sam, dana, null]) await press('/club/roles', who, { ...endForm.fields, reason: 'Not mine to end' });
  await press('/club/roles', pat, { ...endForm.fields, reason: '' });
  check('tde-w3: the TD, a coach, another club’s TD and a stranger pressing it — and the administrator with no reason — end nothing',
    await reads(marina), [200, 200, 200, 200]);
  const ended = await press('/club/roles', pat, { ...endForm.fields, reason: 'Moved on at the end of the season' });
  check('tde-w4: with a reason it ends, with no JavaScript, and says so in BUZ’s words',
    [ended.status, ended.location,
     /Marina Petrovic no longer sees the register, the squads or any player['’]s record\. To name a new Technical Director, ring Pitch\./.test(words((await get('/club/roles?ended=1', pat)).html))],
    [303, '/club/roles?ended=1', true]);
  check('H9: the departed Technical Director reads no register, no CV from it, no squad and no CV from the squad — at once, through the real pages',
    await reads(marina), [307, 404, 404, 404]);
  check('tde-w5: and her coaching CV loses the crest the role earned (the line she typed stays hers)',
    [crestOn(await cv()), /Technical Director/.test(words(await cv()))], [false, true]);
  check('tde-w6: the row is gone, and a second press ends nobody',
    [/Technical Director Marina Petrovic/.test(words((await get('/club/roles', pat)).html)),
     forms((await get('/club/roles', pat)).html).some((f) => /^End their access/.test(f.submit))], [false, false]);
  // B2 (BUZ, 1 Oct): with no Technical Director holding an account, the
  // administrator's home says so in one muted line — the constant the page
  // renders — and no longer says whose the register is.
  {
    const noTd = /ADMIN_NO_TD_LINE = '([^']+)'/.exec(readFileSync(fileURLToPath(new URL('../lib/home-copy.ts', import.meta.url)), 'utf8'))?.[1] ?? 'missing';
    const patRaw = (await get('/home', pat)).html.replace(/<script[\s\S]*?<\/script>/g, ' ');
    const patHome = words(patRaw);
    check('hm-w4: once the TD’s access ends, the administrator reads that no Technical Director has an account — an amber notice directly under Post a trial notice — and not whose the register is',
      [noTd !== 'missing', patRaw.includes(`>Post a trial notice</a><div role="status" class="card card-amber" data-no-td="true" style="font-size:13.5px;font-weight:700;color:#eef5f0;line-height:1.5">${noTd}</div>`),
       /The register is Marina/.test(patHome)], [true, true, false]);
  }

  // ---- what the operator sees afterwards ----------------------------------------
  const queue = (await get('/ops/verification', op)).html;
  const sheetOf = async (club) => {
    for (const m of new Set([...queue.matchAll(/href="(\/ops\/call\/[0-9a-f-]{36})"/g)].map((x) => x[1]))) {
      if (new RegExp(`Call sheet — ${club}`).test(words((await get(m, op)).html))) return m;
    }
    return null;
  };
  const riverside = await sheetOf('Riverside FC');
  const rSheet = words((await get(riverside, op)).html);
  check('tde-w7: Riverside’s call sheet says her access ended, in BUZ’s words, and offers nothing to end',
    [/Marina Petrovic no longer sees the register, the squads or any player's record at Riverside FC\. What they wrote stays theirs\. To name a new Technical Director, record them on a call\./.test(rSheet),
     /Waiting on their account/.test(rSheet), /End this Technical Director's access/.test(rSheet)],
    [true, false, false]);
  check('tde-w8: the queue no longer says she is waiting on her account (the held state renders in development only)',
    [/Technical Director Marina Petrovic · access ended · recorded by/.test(words(queue)),
     /Technical Director Marina Petrovic · waiting on their account/.test(words(queue))], [true, false]);

  // ---- the operator's door -------------------------------------------------------
  const kingsway = await sheetOf('Kingsway Rovers FC');
  const kForm = forms((await get(kingsway, op)).html).find((f) => /^End this Technical Director/.test(f.submit));
  check('tde-w9: Kingsway’s call sheet offers the operator the door while its TD is live', Boolean(kForm), true);
  const danaReads = async () => (await get('/club/register', dana)).status;
  await press(kingsway, null, { ...kForm.fields, reason: 'Not an operator' });
  await press(kingsway, op, { ...kForm.fields, reason: '' });
  check('tde-w10: signed out, or with no reason, it ends nothing', await danaReads(), 200);
  const opEnded = await press(kingsway, op, { ...kForm.fields, reason: 'The club rang: Dana has left' });
  const kSheet = words((await get(kingsway, op)).html);
  check('tde-w11: with a reason the operator ends it, and the sheet says so in BUZ’s words',
    [opEnded.status, opEnded.location, await danaReads(),
     /Dana Kovac no longer sees the register, the squads or any player's record at Kingsway Rovers FC\. What they wrote stays theirs\. To name a new Technical Director, record them on a call\./.test(kSheet)],
    [303, kingsway, 307, true]);

  // ---- naming a TD is the call, and a call naming somebody else hands over ----
  const call = async (td_name, td_email) => {
    const form = forms((await get(riverside, op)).html).find((f) => f.visible.some((v) => v.name === 'outcome'));
    return press(riverside, op, { ...form.fields, operator: 'BUZ', number_called: '03 9000 0000', number_source: 'FV club directory',
      answered_by: 'Committee', club_confirmed: 'yes', person_confirmed: 'yes', incorporated: 'yes', authority_confirmed: 'yes',
      notes: 'handover drill', outcome: 'verified', td_name, td_email });
  };
  await call('Marina Petrovic', 'td@example.com');
  check('tde-w12: a NEW call naming her is the way back, and she reads the register again', (await get('/club/register', marina)).status, 200);
  await call('Marina Petrovic', 'td@example.com');
  check('tde-w13: a re-verification naming the same person changes nothing — still hers, still active',
    [(await get('/club/register', marina)).status, /Active\. Recorded by BUZ/.test(words((await get(riverside, op)).html))], [200, true]);
  await call('Sam Kaya', 'coach@example.com');
  check('tde-w14: a call naming somebody else hands over in one go — Marina reads nothing, Sam holds the register',
    [await reads(marina), (await get('/club/register', sam)).status,
     /Sam Kaya/.test(words((await get(riverside, op)).html)) && /Active\. Recorded by BUZ/.test(words((await get(riverside, op)).html))],
    [[307, 404, 404, 404], 200, true]);

  // ---- and back: the seed's seats restored the only way there is ----------------
  await call('Marina Petrovic', 'td@example.com');
  check('tde-w15: a call naming Marina hands Riverside back — Sam\u2019s role ends, hers is live, the squad CV opens again',
    [await reads(marina), (await get('/club/register', sam)).status], [[200, 200, 200, 200], 307]);
  const kCall = forms((await get(kingsway, op)).html).find((f) => f.visible.some((v) => v.name === 'outcome'));
  await press(kingsway, op, { ...kCall.fields, operator: 'BUZ', number_called: '03 9000 0001', number_source: 'FV club directory',
    answered_by: 'Committee', club_confirmed: 'yes', person_confirmed: 'yes', incorporated: 'yes', authority_confirmed: 'yes',
    notes: 'handover drill', outcome: 'verified', td_name: 'Dana Kovac', td_email: 'kingsway@example.com' });
  check('tde-w16: and a call naming Dana gives Kingsway its TD back', await danaReads(), 200);

  // ---- 0121: a name that is not hers is held for a human (approved default 5) ----
  await call('M. Petrovic', 'td@example.com');
  check('tdn-w0: a call naming her by initial and surname is her — still active, nobody asked', await reads(marina), [200, 200, 200, 200]);
  await call('Marina Petrovich', 'td@example.com');
  const heldSheet = await get(riverside, op);
  const heldWords = words(heldSheet.html);
  check('tdn-w1: a call recording her address under a name that is not hers holds the role — she reads nothing, and the sheet shows the mismatch',
    [await reads(marina), /This is not the name recorded on the call\./.test(heldWords), /On hold\. The role stays off until you confirm/.test(heldWords),
     /The role goes to this account/.test(heldWords), /Waiting on their account/.test(heldWords)],
    [[307, 404, 404, 404], true, true, false, false]);
  const queueLine = words((await get('/ops/verification', op)).html);
  check('tdn-w1b: and the queue says the role is on hold, not that it is waiting on her account',
    [/Technical Director Marina Petrovich · on hold: not the name on the call/.test(queueLine),
     /Technical Director Marina Petrovich · waiting on their account/.test(queueLine)], [true, false]);
  const confirmForm = forms(heldSheet.html).find((f) => f.submit === 'This is the person the club named');
  // Asserted on the state, not the answer (L12). (Not a signed-in seat: in
  // development every signed-in person with an address is an operator,
  // lib/ops-policy, so the stranger is the one refusal a dev server can show.)
  if (confirmForm) await press(riverside, null, confirmForm.fields);
  check('tdn-w2: the held state offers the confirmation, and a stranger pressing it changes nothing',
    [Boolean(confirmForm), await reads(marina)], [true, [307, 404, 404, 404]]);
  if (confirmForm) await press(riverside, op, confirmForm.fields);
  check('tdn-w3: an operator confirming it is her puts the role back at once, and the sheet says active',
    [await reads(marina), /Active\. Recorded by BUZ/.test(words((await get(riverside, op)).html)),
     forms((await get(riverside, op)).html).some((f) => f.submit === 'This is the person the club named')],
    [[200, 200, 200, 200], true, false]);
  // BUZ, 29 Sep ("yes to the four"): the first two questions start with no
  // answer and a call is not recorded without both. Posted as a browser that
  // skipped the form's `required` would post it, naming somebody else as TD —
  // so a call that WAS recorded would hand Riverside over (tde-w14), and the
  // state says whether it was (L12).
  const sheetForm = forms((await get(riverside, op)).html).find((f) => f.visible.some((v) => v.name === 'outcome'));
  const handover = { operator: 'BUZ', number_called: '03 9000 0000', number_source: 'FV club directory', answered_by: 'Committee',
    incorporated: 'yes', authority_confirmed: 'yes', notes: 'unanswered drill', outcome: 'verified', td_name: 'Sam Kaya', td_email: 'coach@example.com' };
  const noAnswer = await press(riverside, op, { ...sheetForm.fields, ...handover });
  const halfAnswer = await press(riverside, op, { ...sheetForm.fields, ...handover, club_confirmed: 'yes' });
  const nonsense = await press(riverside, op, { ...sheetForm.fields, ...handover, club_confirmed: 'maybe', person_confirmed: 'yes' });
  check('ops-w1: a call with the first two questions unanswered, half answered or answered with nonsense records nothing — the sheet comes back and the TD it names does not take over',
    [[noAnswer, halfAnswer, nonsense].map((r) => `${r.status} ${r.location}`), await reads(marina), (await get('/club/register', sam)).status],
    [[`303 ${riverside}`, `303 ${riverside}`, `303 ${riverside}`], [200, 200, 200, 200], 307]);
}


// ---------------------------------------------------------------------------
// BRIEF L (29 Sep): doc 14 table H pressed through the real screens. The
// permission suite pins H1, H2, H4 and H5 on the database functions; this is
// the product doing them, read on the pages a person opens — the register, a
// CV opened from it, the squad screen, a CV opened from the squad:
//
//   H4  the Technical Director's Remove on a coach, on /club/squads
//   H5  every outcome of the operator's call sheet that takes a club out of
//       verified: suspended for each class, a takedown, and a failed call
//       (0150)
//   H2  the family's Leave, on the parent's controls
//   H1  the family's "Ask them", and the club's confirm
//
// EARLY, straight after the TD block, on the seed's Riverside, and it hands
// everything back: Sam is brought in again for the same two teams, Riverside
// is verified again with Marina its TD, and Deniz is in U15 Boys again — so
// every block after this one sees the seed's seats. One thing does not come
// back, by design (D-170, brief M): Deniz's registration at Riverside, which
// his family's Leave took off the register.
//
// BRIEF M (30 Sep) adds the authors. The seed has Sam write one coach-verified
// entry on Deniz (D-48), and no page reads 'authored_only' until December,
// so what the database answers is read through /dev/read-level (development
// only, 404 in production — dev3). H5: Sam, on the squad and an author,
// drops to nothing, not to what he wrote, every way Riverside leaves verified
// (D-171). H2: once Deniz has left a club that stays verified, Sam keeps what
// he wrote (D-48) and loses even that every way Riverside leaves verified;
// and the Leave takes Deniz off Riverside's register (D-170). (The TD's
// Remove on /club/squads revokes a coach's register grants and not the squad
// membership the seed wrote for Sam, so it does not make him a former
// coach — L13, round L's "Found" 1.)
// ---------------------------------------------------------------------------
{
  const marina = ids.people.marina, sam = ids.people.sam, alex = ids.people.alex, robin = ids.people.robin;
  const op = ids.people.jordan;   // any signed-in person with an address is an operator in development (lib/ops-policy)
  const deniz = ids.children.deniz.child_id, riversideId = ids.clubs['riverside-fc'];
  const words = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&rsquo;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  const press = async (path, who, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) for (const x of [].concat(v)) fd.append(k, x);
    const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual', headers: who ? { cookie: cookieFor(who) } : {} });
    await r.text();
    return { status: r.status, location: (r.headers.get('location') ?? '').replace(BASE, '') };
  };
  const status = async (path, who) => (path ? (await get(path, who)).status : null);
  const levelOf = async (viewer, person) => {
    const r = await fetch(`${BASE}/dev/read-level?viewer=${viewer}&person=${person}`, { method: 'POST' });
    return r.ok ? (await r.json()).level : `status ${r.status}`;
  };

  // ---- the pages, found the way a person finds them -------------------------------
  const squadsHtml = (await get('/club/squads', marina)).html;
  const squadIds = [...new Set([...squadsHtml.matchAll(/href="\/club\/squads\/([0-9a-f-]{36})"/g)].map((m) => m[1]))];
  let u15 = null;
  for (const id of squadIds) if ((await get(`/club/squads/${id}`, marina)).html.includes(`/cv/${deniz}`)) { u15 = `/club/squads/${id}`; break; }
  const denizCv = u15 ? `${u15}/cv/${deniz}` : null;
  // Sam's two teams are the squads his register grants open (D-154).
  const samTeams = [];
  for (const id of squadIds) if ((await get(`/club/squads/${id}`, sam)).status === 200) samTeams.push(id);
  const samRegCv = /href="(\/club\/register\/cv\/[0-9a-f-]{36})"/.exec((await get('/coach/register', sam)).html)?.[1] ?? null;
  const regCv = /href="(\/club\/register\/cv\/[0-9a-f-]{36})"/.exec((await get('/club/register', marina)).html)?.[1] ?? null;
  check('h-w0: the pages exist to be read — Deniz’s squad and his CV from it, Sam’s two teams, a registration CV each for Sam and Marina',
    [Boolean(denizCv), samTeams.length, Boolean(samRegCv), Boolean(regCv)], [true, 2, true, true]);

  // What the TD reads, and what the squads' coach reads, each a page.
  const tdReads = async () => [/\/club\/register\/cv\//.test((await get('/club/register', marina)).html), await status(regCv, marina),
    (await get(u15, marina)).html.includes(`/cv/${deniz}`), await status(denizCv, marina)];
  const coachReads = async () => [await status(denizCv, sam), ...(await Promise.all(samTeams.map((t) => status(`/club/squads/${t}`, sam)))),
    await status(samRegCv, sam), await status('/coach/register', sam)];
  const TD_LIVE = [true, 200, true, 200], TD_DOWN = [false, 404, false, 404];
  const COACH_LIVE = [200, 200, 200, 200, 200], COACH_DOWN = [404, 404, 404, 404, 307];

  // The operator's call sheet, pressed for every way out of verified (H5).
  const sheet = `/ops/call/${riversideId}`;
  const logCall = async (extra) => {
    const form = forms((await get(sheet, op)).html).find((f) => f.visible.some((v) => v.name === 'outcome'));
    return press(sheet, op, { ...form.fields, operator: 'BUZ', number_called: '03 9000 0000', number_source: 'FV club directory',
      answered_by: 'Committee', club_confirmed: 'yes', person_confirmed: 'yes', incorporated: 'yes', authority_confirmed: 'yes',
      notes: 'H5 drill', ...extra });
  };
  const reverify = () => logCall({ outcome: 'verified', td_name: 'Marina Petrovic', td_email: 'td@example.com' });
  const WAYS = [['suspended', 'child_safety'], ['suspended', 'administrative'], ['suspended', 'non_payment'], ['takedown', ''], ['not_verified', '']];
  const wayName = (outcome, cls) => outcome === 'not_verified' ? 'a call recorded "not verified" (0150)'
    : outcome === 'takedown' ? 'taken down with no class recorded' : `suspended for the ${cls} class`;

  // ---- H4 · the TD takes a coach off the club's teams ------------------------------
  check('h4-w0: before — Sam reads his two teams, their registrations and a CV opened from one, and the database gives him Deniz’s whole record',
    [await coachReads(), await levelOf(sam, deniz)], [COACH_LIVE, 'full']);
  const removeForm = forms((await get('/club/squads', marina)).html).find((f) => f.fields.personId === sam);
  await press('/club/squads', marina, removeForm?.fields ?? {});
  const removed = await coachReads();
  check('H4: a coach the Technical Director takes off the club’s teams mid-season loses read on them at once — each team’s squad screen, its registrations and a CV opened from them — through the real pages',
    removed.slice(1), COACH_DOWN.slice(1));

  // Brought back the way any coach is brought in: the TD asks, Sam accepts.
  const bring = forms((await get('/club/squads', marina)).html).find((f) => f.visible.some((v) => v.name === 'wwcc'));
  await press('/club/squads', marina, { ...bring.fields, email: 'coach@example.com', squadIds: samTeams, wwcc: 'on' });
  const accept = forms((await get('/home', sam)).html).find((f) => f.fields.answer === 'accept');
  if (accept) await press('/home', sam, accept.fields);
  check('h4-w1: brought back the way a coach is brought in — asked by the TD, accepted on his own home — Sam reads his two teams again', await coachReads(), COACH_LIVE);

  // ---- H5 · Riverside loses verified status, every way the call sheet can do it ----
  // Besides the pages: the database's answer for Sam, who is on Deniz's squad
  // AND wrote about him, and for Marina (D-171); Riverside's own players-
  // wanted notices on its public page (0156); and the club line on Deniz's
  // CV, on his parent's preview and on the share link (0155) — "Riverside FC
  // — U15 Boys" and "U15 Boys · now" are that line, and nothing else on his
  // CV prints them.
  const levels = async () => [await levelOf(sam, deniz), await levelOf(marina, deniz)];
  const wantedShown = async () => words((await get('/fc/riverside-fc', null)).html).includes('Players wanted');
  const denizRec = ids.children.deniz.record_id;
  const clubLine = async () => [`/build/${denizRec}/preview`, '/p/dev-deniz'].map(async (path) => {
    const w = words((await get(path, path.startsWith('/p/') ? null : alex)).html);
    return w.includes('Riverside FC — U15 Boys') || w.includes('U15 Boys · now');
  });
  const lines = async () => Promise.all(await clubLine());
  // D-174: and the colours follow the club line, on the same two pages. The
  // seed gives Riverside "Sky blue and navy", its own pick.
  const sky = themeOf('Sky blue and navy');
  const worn = async () => Promise.all([`/build/${denizRec}/preview`, '/p/dev-deniz'].map(async (path) =>
    wearsTheme((await get(path, path.startsWith('/p/') ? null : alex)).html, sky)));
  check('cvcol-w0: before — Deniz\u2019s CV wears Riverside\u2019s colours, on his parent\u2019s preview and on his share link',
    await worn(), [true, true]);
  // D-89, read off the artefact itself: his Open Graph image is byte for byte
  // the same whether or not his CV wears Riverside's colours.
  const og = async () => Buffer.from(await (await fetch(`${BASE}/p/dev-deniz/opengraph-image`)).arrayBuffer());
  const ogWorn = await og();
  check('h5-w0: before — Riverside is verified: Marina reads the register, a CV from it, the squad and a CV from the squad; Sam the squad CV, his teams and their registrations; both read Deniz’s whole record; its page wants players; and Deniz’s CV names it',
    [await tdReads(), await coachReads(), await levels(), await wantedShown(), await lines()],
    [TD_LIVE, COACH_LIVE, ['full', 'full'], true, [true, true]]);
  for (const [outcome, cls] of WAYS) {
    await logCall({ outcome, suspension_reason: cls });
    const down = [await tdReads(), await coachReads()];
    const downMore = [await levels(), await wantedShown(), await lines()];
    const downWorn = await worn();
    const ogDown = await og();
    await reverify();
    const up = [await tdReads(), await coachReads()];
    const upMore = [await levels(), await wantedShown(), await lines()];
    const upWorn = await worn();
    const how = wayName(outcome, cls);
    // John's condition 2: verified only, and the theme clears the moment that
    // stops being true — including "not verified", where the club is still
    // named and only the colours go.
    check(`cvcol-w1: ${how}, Deniz\u2019s CV takes off Riverside\u2019s colours at once, on his parent\u2019s preview and his share link, and a verified call puts them back (D-174) — while his Open Graph image is byte for byte the same in both (D-89)`,
      [downWorn, upWorn, ogWorn.length > 1000 && ogDown.equals(ogWorn), (await og()).equals(ogWorn)], [[false, false], [true, true], true, true]);
    check(`H5: ${how} on the operator’s call sheet, Riverside’s TD and its assigned coach lose every read of its children at once — the register, a CV from it, the squad, a CV from the squad, the coach’s teams and registrations — and a verified call gives them back`,
      [down, up], [[TD_DOWN, COACH_DOWN], [TD_LIVE, COACH_LIVE]]);
    check(`H5: ${how}, and the database agrees — the coach on Deniz’s squad who wrote about him drops to nothing, not to what he wrote (D-171), and so does the TD; a verified call gives both back`,
      [downMore[0], upMore[0]], [['none', 'none'], ['full', 'full']]);
    check(`pw-w1: ${how}, Riverside’s own players-wanted notices are off its public page (0140, 0156), and back once it is verified`,
      [downMore[1], upMore[1]], [false, true]);
    if (outcome !== 'not_verified') {
      check(`cvclub-w1: ${how}, Deniz’s CV names no club — on his parent’s preview and on his share link it reads as a player’s with no club (0155) — and a verified call puts Riverside back`,
        [downMore[2], upMore[2]], [[false, false], [true, true]]);
    }
  }

  // ---- H2 · the family presses Leave -------------------------------------------------
  const ctl = `/g/controls/${deniz}`;
  // His registrations, as his parent's controls list them (each has "Take off
  // this register"); the one Riverside's TD can open is Riverside's.
  const regIds = async () => forms((await get(ctl, alex)).html).map((f) => f.fields.registrationId).filter(Boolean);
  let rivReg = null;
  for (const id of await regIds()) if ((await get(`/club/register/cv/${id}`, marina)).status === 200) { rivReg = id; break; }
  const cameOff = async () => (words((await get(ctl, alex)).html).match(/Deniz came off a club register/g) ?? []).length;
  const regBefore = [Boolean(rivReg), (await regIds()).length, (await get('/club/register', marina)).html.includes(rivReg), await cameOff()];
  const leave = forms((await get(ctl, alex)).html).find((f) => f.submit === 'Leave' && f.fields.personId === deniz);
  check('h2-w0: before — Deniz is in U15 Boys: Marina’s squad screen lists him and opens his CV, and so does the squad’s coach, and his parent has the Leave button',
    [(await get(u15, marina)).html.includes(`/cv/${deniz}`), await status(denizCv, marina), await status(denizCv, sam), Boolean(leave)],
    [true, 200, 200, true]);
  const left = await press(ctl, alex, leave?.fields ?? {});
  check('H2: his parent presses Leave, and from that moment the club drops to what it is allowed — Marina’s squad screen no longer lists Deniz, and neither she nor the squad’s coach can open his CV from it',
    [left.location, (await get(u15, marina)).html.includes(`/cv/${deniz}`), await status(denizCv, marina), await status(denizCv, sam)],
    [`${ctl}?squad=left`, false, 404, 404]);
  // D-48 through the product: Sam wrote about Deniz, and Deniz has left a
  // club that stays verified, so Sam keeps what he wrote and Marina keeps
  // nothing. D-171: while Riverside is not verified, even that goes — every
  // way the call sheet takes it there — and comes back with a verified call.
  check('cvcol-w2: and Riverside\u2019s colours leave his CV with its name — a player who left a club does not wear it (D-174)',
    await worn(), [false, false]);
  check('H2: and the club drops to what D-48 leaves it — the TD reads nothing of Deniz, and the coach who wrote about him only what he wrote',
    [await levelOf(marina, deniz), await levelOf(sam, deniz)], ['none', 'authored_only']);
  for (const [outcome, cls] of WAYS) {
    await logCall({ outcome, suspension_reason: cls });
    const down = await levelOf(sam, deniz);
    await reverify();
    check(`H5: ${wayName(outcome, cls)} on the operator’s call sheet, the coach who wrote about Deniz before he left keeps nothing of it while Riverside is not verified (D-171), and a verified call gives it back`,
      [down, await levelOf(sam, deniz)], ['none', 'authored_only']);
  }
  check('H2: and his family’s registration at Riverside goes with him (D-170) — Marina’s register no longer has it and the CV from it does not open; his parent’s controls list only his other club’s; and his timeline says he came off a club register',
    [regBefore, [await status(`/club/register/cv/${rivReg}`, marina), (await get('/club/register', marina)).html.includes(rivReg),
      (await regIds()).length, (await regIds()).includes(rivReg), await cameOff()]],
    [[true, 2, true, 0], [404, false, 1, false, 1]]);

  // ---- H1 · the family asks, the club confirms -----------------------------------------
  const askPage = `/squad/${deniz}?club=${riversideId}`;
  const askForm = forms((await get(askPage, alex)).html).find((f) => f.fields.squadId === u15.split('/').pop());
  // Somebody who is not his parent pressing the same form is sent home and
  // nothing reaches the club (asserted on the club's screen, L12).
  const strangerAsk = await press(`/squad/${deniz}`, robin, askForm?.fields ?? {});
  const waiting = async () => /says they play here/.test(words((await get(u15, marina)).html));
  check('H1: consented at joining — a stranger pressing the family’s "Ask them" for Deniz is sent home, and nothing waits on the club',
    [strangerAsk.location, await waiting()], ['/home', false]);
  await press(`/squad/${deniz}`, alex, askForm?.fields ?? {});
  check('H1: his parent asks, and it waits on the club — which reads nothing of him until it confirms',
    [await waiting(), await status(denizCv, marina)], [true, 404]);
  check('cvcol-w3: an ask still waiting on the club moves no colours — his CV is in Pitch green until the club confirms (D-174, 0165)',
    await worn(), [false, false]);
  const confirm = forms((await get(u15, marina)).html).find((f) => 'claimId' in f.fields);
  await press(u15, marina, { ...(confirm?.fields ?? {}), answer: 'yes' });
  const signedCv = words((await get(denizCv, marina)).html);
  check('H1: the club confirms, and it sees the history the signing brings (D-48) — the squad CV opens for the TD and the squad’s coach, with the club he played for before and last season’s award on it',
    [await status(denizCv, marina), await status(denizCv, sam), signedCv.includes('Elderslie Juniors SC'), signedCv.includes("Players' Player of the Year")],
    [200, 200, true, true]);
  check('cvcol-w3b: and the moment it confirms, Riverside\u2019s colours are back on his CV with its name — and on the squad CV the club opens',
    [await worn(), wearsTheme((await get(denizCv, marina)).html, sky)], [[true, true], true]);

  // The club changes its pick on its own page editor, and Deniz's CV follows
  // on the next read; it goes back to Pitch green, and so does the CV. A share
  // card his parent asks for is byte for byte the same throughout (D-89). Put
  // back to the seed's pick at the end, so the colours block below starts
  // where the seed does.
  const preview = async () => (await get(`/build/${denizRec}/preview`, alex)).html;
  const colourPress = async (fields) => {
    const f = forms((await get('/club/page-edit', marina)).html).find((x) => x.visible.some((v) => v.name === 'primary'));
    return press('/club/page-edit', marina, { ...(f?.fields ?? {}), ...fields });
  };
  const cardForm = forms((await get(`/share-card/${denizRec}`, alex)).html).find((x) => 'recordId' in x.fields);
  await press(`/share-card/${denizRec}`, alex, { ...(cardForm?.fields ?? {}), shape: 'landscape' });
  // The newest card link in his parent's outbox is the one just asked for.
  const cardId = /\/g\/card\/([0-9a-f-]{36})/.exec((await get('/dev/outbox', alex)).html)?.[1] ?? null;
  const card = async () => {
    const r = cardId ? await fetch(`${BASE}/g/card/${cardId}/image`, { headers: { cookie: cookieFor(alex) } }) : null;
    return r && r.ok && (r.headers.get('content-type') ?? '').startsWith('image/') ? Buffer.from(await r.arrayBuffer()) : null;
  };
  const card0 = await card();
  const claret = PRESETS.findIndex((p) => p.name === 'Claret and gold');
  await colourPress({ preset: String(claret) });
  const [cvClaret, cardClaret] = [await preview(), await card()];
  const clear = forms((await get('/club/page-edit', marina)).html).find((x) => /Pitch green/.test(x.submit ?? ''));
  await press('/club/page-edit', marina, clear?.fields ?? {});
  const [cvGreen, cardGreen] = [cvHero(await preview()), await card()];
  await colourPress({ preset: String(PRESETS.findIndex((p) => p.name === 'Sky blue and navy')) });
  check('cvcol-w5: Riverside picks another pair and Deniz\u2019s CV wears it on the next read; it goes back to Pitch green and so does his CV — while the share card his parent asked for never moves (D-89)',
    [wearsTheme(cvClaret, themeOf('Claret and gold')), cvGreen.includes('#2a6a49 0%') && cvGreen.includes('--cv-lead:#3ddc84'),
     Boolean(card0), Boolean(card0 && cardClaret?.equals(card0) && cardGreen?.equals(card0)), (await worn())[0]],
    [true, true, true, true, true]);
}

// ---------------------------------------------------------------------------
// BRIEF I (29 Sep): Pitch curates the board (0130; D-64, D-74, D-90). Pressed
// through the operator's own screens, and every outcome read off the product
// where a family would meet it: the club's public page and its disclaimer,
// /claim, the trials board under its filters, and the club page's trials. It
// adds one listing and one notice, changes, re-stamps and removes them, and
// takes the listing down again at the end, so every block after it sees the
// seed's board.
// ---------------------------------------------------------------------------
{
  const op = ids.people.jordan;   // any signed-in address is an operator in development (lib/ops-policy)
  const words = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&rsquo;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  const press = async (path, who, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) for (const x of [].concat(v)) fd.append(k, x);
    const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual', headers: who ? { cookie: cookieFor(who) } : {} });
    await r.text();
    return { status: r.status, location: (r.headers.get('location') ?? '').replace(BASE, '') };
  };
  const rowsNamed = async (name) => (words((await get('/ops/clubs', op)).html).match(new RegExp(name, 'g')) ?? []).length;

  // ---- a listing -------------------------------------------------------------
  const newForm = forms((await get('/ops/clubs/new', op)).html).find((f) => f.visible.some((v) => v.name === 'source'));
  check('cur-w0: the operator is given the add-a-club form, and a person signed out is sent to sign in',
    [Boolean(newForm), (await get('/ops/clubs/new', null)).status], [true, 307]);
  const listing = { name: 'Brackenfold Rovers', suburb: 'Brackenfold', state: 'VIC', contact: 'secretary@brackenfold.example.au', source: 'club website /contact' };
  await press('/ops/clubs/new', null, { ...newForm.fields, ...listing });
  const added = await press('/ops/clubs/new', op, { ...newForm.fields, ...listing });
  const clubPath = added.location;
  check('cur-w1: it is added with no JavaScript, once — signed out wrote nothing — and it is an unclaimed listing in the directory',
    [added.status, /^\/ops\/clubs\/[0-9a-f-]{36}$/.test(clubPath), await rowsNamed('Brackenfold Rovers'),
     /Brackenfold Rovers Brackenfold VIC — Unclaimed/.test(words((await get('/ops/clubs?q=brackenfold', op)).html))],
    [303, true, 1, true]);
  const pub = words((await get('/fc/brackenfold-rovers', null)).html);
  check('cur-w2: its public page is up at once, with the D-172 banner and the door to claim it',
    [/Pitch made this page from public information\. Brackenfold Rovers has not claimed it\./.test(pub), /Claim it/.test(pub)], [true, true]);
  check('cur-w3: and /claim, unchanged, would send its code to the address the listing was compiled with, and nowhere else',
    // D-172 (30 Sep): shown partly hidden, the address the listing was compiled with.
    /se••@brackenfold\.example\.au/.test(words((await get('/claim/brackenfold-rovers', ids.people.robin)).html)), true);
  const dup = await press('/ops/clubs/new', op, { ...newForm.fields, ...listing, name: 'BRACKENFOLD  rovers', suburb: ' brackenfold ' });
  const blank = await press('/ops/clubs/new', op, { ...newForm.fields, ...listing, name: 'Sourceless Rovers', source: ' ' });
  check('cur-w4: the same club again is refused by name and suburb, and a listing with no source is refused — the page says which, and nothing more is listed',
    [dup.location, /A club with that name and suburb is already listed\./.test(words((await get(dup.location, op)).html)),
     blank.location, await rowsNamed('Brackenfold Rovers'), await rowsNamed('Sourceless Rovers')],
    ['/ops/clubs/new?error=dup', true, '/ops/clubs/new?error=fields', 1, 0]);

  // ---- a notice compiled from the club's own public notice ---------------------
  const trialPath = `${clubPath}/trial`;
  const tForm = forms((await get(trialPath, op)).html).find((f) => f.visible.some((v) => v.name === 'source_url'));
  const soon = new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
  const trial = { title: 'U11 Girls trials', ages: ['U11'], gender: 'girls', trial_on: soon, time: 'Sat 9:00 AM',
    ground: 'Brackenfold Reserve', positions: ['GK'], source_url: 'https://brackenfold.example.au/trials' };
  const boardHtml = async () => (await get('/trials?age=U11&gender=girls', null)).html;
  // Trials board v2 (BUZ, 2 Oct): the club and its listing are two elements in
  // one row — one row per club per day — not one "Club · title" string. The
  // row is the club's when its name is the row's name, and it holds the
  // listing when one of its lines is that title.
  const rowOf = (html, club, title) => [...html.replace(/<!-- -->/g, '').matchAll(/<article\b[\s\S]*?<\/article>/g)].map((m) => m[0])
    .find((a) => a.includes(`<span class="fl-trial-cn">${club}</span>`)
      && [...a.matchAll(/<div class="fl-trial-lt">([^<]*)<\/div>/g)].some((x) => words(x[1]).trim() === title)) ?? null;
  const noSource = await press(trialPath, op, { ...tForm.fields, ...trial, source_url: '' });
  check('cur-w5: a notice with no link to the club\'s own notice is refused and the form says so; nothing reaches the board',
    [noSource.location, /Paste the address of the club.s own notice, starting https:\/\//.test(words((await get(noSource.location, op)).html)),
     /Brackenfold Rovers/.test(words(await boardHtml()))],
    [`${trialPath}?error=source`, true, false]);
  const posted = await press(trialPath, op, { ...tForm.fields, ...trial });
  const board = await boardHtml();
  const bRow = rowOf(board, 'Brackenfold Rovers', 'U11 Girls') ?? '';
  check('cur-w6: with the link it is posted with no JavaScript, and it is on the board under its age group and competition, in its own row marked "Unclaimed" (and data-unclaimed), with "Send my CV" to the club page',
    [posted.status, posted.location, bRow.length > 0, /^<article [^>]*data-unclaimed=""/.test(bRow) && /<span class="fl-trial-state un">Unclaimed<\/span>/.test(bRow),
     /href="\/fc\/brackenfold-rovers#play"[^>]*>Send my CV/.test(bRow)],
    [303, clubPath, true, true, true]);
  check('cur-w7: and on the club\'s own page', /U11 Girls trials/.test(words((await get('/fc/brackenfold-rovers', null)).html)), true);
  const screen = async () => (await get(clubPath, op)).html;
  const noticeId = /data-notice="([0-9a-f-]{36})"/.exec(await screen())?.[1];
  check('cur-w8: the operator\'s screen lists it with who added it, both stamps and the link it came from',
    [Boolean(noticeId), /Listed \d{1,2} [A-Z][a-z]{2} by player@example\.com · checked \d{1,2} [A-Z][a-z]{2}/.test(words(await screen())),
     (await screen()).includes('href="https://brackenfold.example.au/trials"')], [true, true, true]);

  const eForm = forms((await get(`${trialPath}?edit=${noticeId}`, op)).html).find((f) => f.fields.notice_id === noticeId);
  const changed = await press(trialPath, op, { ...eForm.fields, ...trial, title: 'U11 & U12 Girls trials', ages: ['U11', 'U12'] });
  check('cur-w9: a change is saved and shows on the board at once, under both age groups',
    [changed.location, Boolean(rowOf(await boardHtml(), 'Brackenfold Rovers', 'U11 & U12 Girls')),
     Boolean(rowOf((await get('/trials?age=U12', null)).html, 'Brackenfold Rovers', 'U11 & U12 Girls'))], [clubPath, true, true]);
  const stamp = forms(await screen()).find((f) => f.fields.notice_id === noticeId && f.submit === 'Checked today');
  const stamped = await press(clubPath, op, stamp.fields);
  check('cur-w10: "Checked today" re-stamps it with one press and comes back to the club', [stamped.status, stamped.location], [303, clubPath]);
  const rm = forms(await screen()).find((f) => f.fields.notice_id === noticeId && f.submit === 'Remove');
  await press(clubPath, null, rm.fields);
  await press(clubPath, ids.people.alex, { ...rm.fields, clubId: 'not-a-club' });
  check('cur-w11: signed out, or posted with a club id that is not one, the remove button takes nothing down (the notice is still on the board)',
    Boolean(rowOf(await boardHtml(), 'Brackenfold Rovers', 'U11 & U12 Girls')), true);
  const removed = await press(clubPath, op, rm.fields);
  check('cur-w12: the operator takes it down with one press, and it is gone from the board and the club page',
    [removed.location, /Brackenfold Rovers/.test(words(await boardHtml())), /U11 & U12 Girls trials/.test(words((await get('/fc/brackenfold-rovers', null)).html))],
    [clubPath, false, false]);

  // ---- the listing changed, then removed --------------------------------------------
  const lForm = forms(await screen()).find((f) => f.visible.some((v) => v.name === 'source'));
  const renamed = await press(clubPath, op, { ...lForm.fields, ...listing, name: 'Brackenfold Rovers FC' });
  check('cur-w13: renamed, the listing\'s page moves with its name',
    [renamed.location, (await get('/fc/brackenfold-rovers-fc', null)).status, (await get('/fc/brackenfold-rovers', null)).status], [clubPath, 200, 404]);
  const drop = forms(await screen()).find((f) => 'clubId' in f.fields && !('notice_id' in f.fields) && f.submit === 'Remove');
  const dropped = await press(clubPath, op, drop.fields);
  check('cur-w14: removing the listing takes its page down and it leaves the directory',
    [dropped.location, (await get('/fc/brackenfold-rovers-fc', null)).status, await rowsNamed('Brackenfold Rovers')], ['/ops/clubs', 404, 0]);
}


// Every page read with an under-18's photo on it, for photo-w10 below.
const photoReads = [];

// ---------------------------------------------------------------------------
// S-3 (safety review, 1 Oct; D-119): a new photo is a new object, and an
// under-16's reaches a club only through the guardian. Every upload used to
// overwrite player/{recordId}.jpg, the very URL Deniz's approved snapshot
// names, so his new face was on every club's screen and every link-holder's
// the moment he chose it. Read through the product: the squad CV Riverside's
// TD opens (fn_approved_cv), his share link signed out (fn_token_read), the
// image each of them points at, and the bytes it serves — every upload here
// is a different colour, so the bytes say whose face it is.
//
// Deniz's own new photo reaches the pending version the way every u16 edit
// outside the About form does (a clip, a stat): in the next save, which is
// what the guardian approves. The upload does not open a pending version of
// its own — that waits on the review screen showing a photo (builder report,
// 1 Oct). A photo his PARENT uploads is its own approval (John F14, 1 Oct).
//
// And an under-18's photo is PRIVATE (John's ruling §1, BUZ 1 Oct): never a
// public address, only one minted for an allowed read that dies in ten
// minutes. A photo is named here by its KEY (the address without its
// signature), since every read mints a fresh address for the same photo.
// ---------------------------------------------------------------------------
{
  const sharp = (await import('sharp')).default;
  const deniz = ids.children.deniz, alex = ids.people.alex, marina = ids.people.marina;
  const nate = ids.children.nate, jordan = ids.people.jordan;
  const unhtml = (t) => t.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const colour = (r, g, b) => sharp({ create: { width: 8, height: 8, channels: 3, background: { r, g, b } } }).png().toBuffer();
  const press = async (path, who, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(who) } });
    await r.text();
    return { status: r.status, location: (r.headers.get('location') ?? '').replace(BASE, '') };
  };
  // The photo form as a browser posts it, from the page the person is on.
  const upload = async (page, who, png) => {
    const form = forms((await get(page, who)).html).find((f) => /\/photo$/.test(f.action ?? ''));
    if (!form) return { status: 0, location: 'no photo form on ' + page };
    const fd = new FormData();
    for (const [k, v] of Object.entries(form.fields)) fd.append(k, v);
    fd.append('photo', new Blob([png], { type: 'image/png' }), 'photo.png');
    const r = await fetch(BASE + form.action, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(who) } });
    await r.text();
    return { status: r.status, location: (r.headers.get('location') ?? '').replace(BASE, '') };
  };
  // The player photo a page draws, by the record's own file name: its key,
  // with the address it was drawn at kept to fetch it by.
  const minted = new Map();
  const photoOn = (html, rec) => {
    const src = new RegExp(`<img[^>]*src="([^"]*player[-/]${rec}[^"]*)"`)
      .exec(html.replace(/<script[\s\S]*?<\/script>/g, ' '))?.[1]?.replace(/&amp;/g, '&');
    if (!src) return null;
    const key = src.split('?')[0];
    minted.set(key, src);
    return key;
  };
  // What an image answers, at the last address it was drawn at: its status,
  // and its bytes when it serves.
  const fetchImg = async (key) => (key ? fetch(BASE + (minted.get(key) ?? key)) : null);
  const status = async (src) => (await fetchImg(src))?.status ?? null;
  const bytes = async (src) => { const r = await fetchImg(src); return r?.ok ? Buffer.from(await r.arrayBuffer()) : null; };
  // Save the CV form as it stands — which is what builds the pending version.
  const saveForm = async (who) => {
    const page = `/build/${deniz.record_id}`;
    const { html } = await get(page, who);
    const form = forms(html).find((f) => 'positions' in f.fields);
    const fields = { ...form.fields };
    for (const v of form.visible) {
      if (v.file) continue;
      fields[v.name] = v.type === 'select' ? (v.options?.[0] ?? '') : (v.value ?? '');
    }
    fields.about = unhtml(/<textarea[^>]*name="about"[^>]*>([\s\S]*?)<\/textarea>/.exec(html)?.[1] ?? '');
    return press(page, who, fields);
  };
  const approve = async () => {
    const page = `/g/pending/${deniz.record_id}`;
    const form = forms((await get(page, alex)).html).find((f) => f.submit === 'Approve the change');
    return form ? press(page, alex, form.fields) : { status: 0, location: 'no approve form' };
  };

  // Riverside's squad CV of Deniz, found the way the TD finds it.
  let squadCv = null;
  for (const m of new Set([...(await get('/club/squads', marina)).html.matchAll(/href="(\/club\/squads\/[0-9a-f-]{36})"/g)].map((x) => x[1]))) {
    if ((await get(m, marina)).html.includes(`/cv/${deniz.child_id}`)) { squadCv = `${m}/cv/${deniz.child_id}`; break; }
  }
  const clubSees = async () => {
    const [club, link] = [await get(squadCv, marina), await get('/p/dev-deniz', null)];
    return [club.status, link.status, photoOn(club.html, deniz.record_id), photoOn(link.html, deniz.record_id)];
  };
  const live = async (who) => photoOn((await get(`/build/${deniz.record_id}`, who)).html, deniz.record_id);
  const [red, green, blue, amber, grey] = await Promise.all(
    [[220, 30, 30], [30, 200, 60], [30, 60, 220], [240, 170, 20], [120, 120, 120]].map((c) => colour(...c)));

  // What the club's squad CV and the share link draw, and what that address
  // serves — the bytes, because under the old code the ADDRESS never moved
  // and only what it served did.
  const drawn = async () => {
    const [club, link] = (await clubSees()).slice(2);
    return { club, link, same: club === link, bytes: club ? await bytes(club) : null };
  };

  // ---- One answer to "is something waiting", and one "edit waiting" email
  // per waiting version (Leo, 2 Oct). Here, before the sweep gives Alex a
  // coach seat — from then on his /home is the coach console, which lists no
  // child's changes — so /home can be asked as the parent reads it.
  {
    const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
    const homeLists = async () => (await get('/home', alex)).html.includes(`/g/pending/${deniz.record_id}`);
    const reviewWaits = async () => !strip((await get(`/g/pending/${deniz.record_id}`, alex)).html).includes('Nothing is waiting on you.');
    const top = async (k) => [...strip((await get('/dev/outbox', alex)).html).matchAll(/doc15\.§(\w+) → (\S+)/g)].slice(0, k).map((m) => `§${m[1]} → ${m[2]}`);
    // Deniz's seed About change waits: both surfaces say so.
    const seedAgree = [await homeLists(), await reviewWaits()];
    // The seed writes that waiting About into the version only, not onto his
    // live record, which no real save does (a child's save writes live first,
    // then the version from it). So the About he is approved into is the one
    // his form must carry, or every later save of his would read as an About
    // change.
    const seedAbout = unhtml(/The new version<\/div><div[^>]*>([^<]*)<\/div>/.exec((await get(`/g/pending/${deniz.record_id}`, alex)).html)?.[1] ?? '');
    await approve();
    const cleared = [await homeLists(), await reviewWaits()];
    // His form exactly as the page draws it, then only which stats are shown changed.
    const { html } = await get(`/build/${deniz.record_id}`, deniz.child_id);
    const form = forms(html).find((f) => 'positions' in f.fields);
    const fields = { ...(form?.fields ?? {}) };
    for (const v of form?.visible ?? []) if (!v.file && v.type !== 'select') fields[v.name] = v.value ?? '';
    const sel = /<select[^>]*name="foot"[^>]*>([\s\S]*?)<\/select>/.exec(html)?.[1] ?? '';
    const opt = /<option(?: value="([^"]*)")?[^>]*selected=""[^>]*>([^<]*)</.exec(sel);
    fields.foot = opt ? (opt[1] ?? opt[2]) : '';
    fields.about = seedAbout || unhtml(/<textarea[^>]*name="about"[^>]*>([\s\S]*?)<\/textarea>/.exec(html)?.[1] ?? '');
    const shown = String(fields.surfaced ?? '').split(',').filter(Boolean);
    const mail0 = await top(3);
    if (form) await press(`/build/${deniz.record_id}`, deniz.child_id, { ...fields, surfaced: (shown.includes('assists') ? shown.filter((k) => k !== 'assists') : [...shown, 'assists']).join(',') });
    check('bf-wait-w1: /home and /g/pending give one answer — both list Deniz’s waiting About change, and neither once it is approved; then a change only to which of his stats are shown makes nothing wait: /home lists nothing, the review says "Nothing is waiting on you.", and no "edit waiting" email goes',
      [seedAgree, cleared, Boolean(form && fields.surfaced && seedAbout), [await homeLists(), await reviewWaits()], JSON.stringify(await top(3)) === JSON.stringify(mail0)],
      [[true, true], [false, false], true, [false, false], true]);
    // Three achievements in a row: one waiting version, ONE email per guardian.
    const more = `/build/${deniz.record_id}/more`;
    for (const t of ['Mail test one of three', 'Mail test two of three', 'Mail test three of three']) {
      const f = forms((await get(more, deniz.child_id)).html).find((x) => x.visible.some((v) => v.name === 'title') && x.visible.some((v) => v.name === 'detail'));
      if (f) await press(more, deniz.child_id, { ...f.fields, title: t, detail: '' });
    }
    const mail1 = await top(4);
    check('bf-mail-w1: three achievements Deniz adds in a row open ONE waiting version and send ONE "edit waiting" email per guardian (doc 15 §30) — not one per write — and /home and the review both list it',
      [mail1[0], JSON.stringify(mail1.slice(1)) === JSON.stringify(mail0), await homeLists(), await reviewWaits()],
      ['§30 → guardian@example.com', true, true, true]);
    // doc 14 R13 (safety review of the /g/pending build, S-1): Nate is 17 and
    // his page is the live record; his parent is shown no review and can
    // approve nothing — a crafted press with the review's own form goes home.
    const deniz4 = forms((await get(`/g/pending/${deniz.record_id}`, alex)).html).find((f) => f.submit === 'Approve the change');
    const nateReview = await fetch(`${BASE}/g/pending/${nate.record_id}`, { redirect: 'manual', headers: { cookie: cookieFor(alex) } });
    await nateReview.text();
    const nateDone = await fetch(`${BASE}/g/pending/${nate.record_id}?done=1`, { redirect: 'manual', headers: { cookie: cookieFor(alex) } });
    await nateDone.text();
    const crafted = deniz4 ? await press(`/g/pending/${nate.record_id}`, alex, { ...deniz4.fields, recordId: nate.record_id }) : { location: '' };
    check('R13: a 16–17’s parent is shown no review of Nate’s page and can approve nothing — /g/pending and its approved state send them home, and a crafted Approve with the review’s own form goes home too',
      [Boolean(deniz4), [nateReview.status, (nateReview.headers.get('location') ?? '').replace(BASE, '')], [nateDone.status, (nateDone.headers.get('location') ?? '').replace(BASE, '')], crafted.location],
      [true, [307, '/home'], [307, '/home'], '/home']);
    await approve();
    // N-3: an add then a remove leaves nothing to see — no waiting version,
    // no email, nothing listed; a child looping add and remove floods nobody.
    const mail3 = await top(3);
    const f1 = forms((await get(more, deniz.child_id)).html).find((x) => x.visible.some((v) => v.name === 'title') && x.visible.some((v) => v.name === 'detail'));
    if (f1) await press(more, deniz.child_id, { ...f1.fields, title: 'Added then taken off', detail: '' });
    const moreHtml = (await get(more, deniz.child_id)).html;
    const rmForm = forms(moreHtml).filter((f) => 'achievementId' in f.fields).find((f) => {
      const start = moreHtml.lastIndexOf('<form', moreHtml.indexOf(`value="${f.fields.achievementId}"`));
      return moreHtml.slice(moreHtml.lastIndexOf('</form>', start), start).includes('Added then taken off');
    });
    if (rmForm) await press(more, deniz.child_id, rmForm.fields);
    const mail4 = await top(4);
    check('bf-mail-w2: an achievement Deniz adds and then takes off again leaves nothing for his parent to see — nothing waits on /g/pending or /home, and only the add sent an "edit waiting" email: the remove that undid it sent nothing more',
      [Boolean(f1 && rmForm), await reviewWaits(), await homeLists(), mail4[0], JSON.stringify(mail4.slice(1)) === JSON.stringify(mail3)],
      [true, false, false, '§30 → guardian@example.com', true]);
  }

  // ---- before: Deniz has an approved photo, the way any family gets one ----
  const opens = await clubSees();
  await upload(`/build/${deniz.record_id}`, deniz.child_id, await red);
  const p1 = await live(deniz.child_id);
  // His first photo waits on his parent at once (B, 2 Oct), and the review
  // draws the approved side as the empty tile: no photo was ever approved.
  const firstReview = (await get(`/g/pending/${deniz.record_id}`, alex)).html.replace(/<script[\s\S]*?<\/script>/g, ' ');
  check('bf-pend-w0: Deniz’s first photo waits at once, and /g/pending shows The photo with the approved side as "No photo yet" beside the new one, drawn at a signed private address',
    [/<h2 class="sec-h">The photo<\/h2>/.test(firstReview), /<span>No photo yet<\/span>/.test(firstReview),
     [...firstReview.matchAll(/<img[^>]*src="([^"]*)"/g)].map((m) => m[1].split('?')[0].replace(/-[0-9a-f]{32}/, '-K')), /\/dev-uploads\//.test(firstReview)],
    [true, true, [`/private-photo/player/${deniz.record_id}-K.jpg`], false]);
  await saveForm(deniz.child_id);
  await approve();
  const before = await drawn();
  const redBytes = await bytes(p1);
  check('photo-w0: before — Riverside’s TD opens Deniz’s squad CV and his share link opens; he uploads a photo, saves, his parent approves, and both now draw it',
    [Boolean(squadCv), opens[0], opens[1], Boolean(p1), before.club === p1 && before.same, Boolean(redBytes)],
    [true, 200, 200, true, true, true]);

  // ---- an under-16 uploads; nothing a club reads moves until his parent says yes ----
  await upload(`/build/${deniz.record_id}`, deniz.child_id, await green);
  const p2 = await live(deniz.child_id);
  const afterUpload = await drawn();
  await saveForm(deniz.child_id);
  const afterSave = await drawn();
  const ok = await approve();
  const afterApprove = await drawn();
  const greenBytes = await bytes(p2);
  check('photo-w1: Deniz uploads a new photo and saves — the club’s squad CV and his share link still draw the approved one, and its address still serves it byte for byte; his parent approves, and both draw the new one, at its own address (S-3: one fixed key, overwritten in place)',
    [p2 !== p1, [afterUpload.club, afterUpload.same, Boolean(afterUpload.bytes?.equals(redBytes))],
     [afterSave.club, afterSave.same, Boolean(afterSave.bytes?.equals(redBytes))],
     ok.location, [afterApprove.club, afterApprove.same, Boolean(greenBytes && afterApprove.bytes?.equals(greenBytes) && !greenBytes.equals(redBytes))]],
    [true, [p1, true, true], [p1, true, true], `/g/pending/${deniz.record_id}?done=1`, [p2, true, true]]);

  // ---- B1's parent door ("Build Deniz's page" on /home): a guardian's own
  // upload is its own approval (John F14, 1 Oct) — on the page at once, logged
  // as theirs, and no edit-waiting email to them ----
  const decode = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;|&rsquo;/g, "'").replace(/&amp;/g, '&');
  // The newest message in the outbox, whole: if the parent's upload sent
  // anything — to them, the other guardian or anyone — it would be this one.
  const newestMessage = async () => decode(/<div class="lift"[\s\S]*?<\/pre>/.exec((await get('/dev/outbox', alex)).html)?.[0] ?? '');
  // F14's history line (BUZ, 1 Oct): "{guardian first name} changed the page."
  const approvedLines = async () => (decode((await get(`/g/controls/${deniz.child_id}`, alex)).html).match(/\b[A-Z][a-z]+ changed the page\./g) ?? []).length;
  const nothingWaiting = async () => decode((await get(`/g/pending/${deniz.record_id}`, alex)).html).includes('Nothing is waiting on you.');
  const door = /href="(\/build\/[0-9a-f-]{36})"[^>]*>Build (?:<!-- -->)?Deniz/.exec((await get('/home', alex)).html)?.[1] ?? null;
  const [mail0, lines0] = [await newestMessage(), await approvedLines()];
  // D-89: no photo on an under-18's card. Read off the artefact, byte for byte.
  const og = async (link) => Buffer.from(await (await fetch(`${BASE}${link}/opengraph-image`)).arrayBuffer());
  const ogBefore = await og('/p/dev-deniz');
  const up3 = door ? await upload(door, alex, await blue) : { status: 0 };
  const p3 = await live(alex);
  const doorUpload = await drawn();
  const blueBytes = await bytes(p3);
  check('photo-w2: through his parent’s door on /home, the parent’s upload is the approved page at once — the club’s squad CV and his share link draw it at its own address, nothing waits on the parent, no message goes to anyone, the family history logs \u201c{parent} changed the page.\u201d, and the photo it superseded is deleted',
    [door, up3.status, p3 !== p2, [doorUpload.club, doorUpload.same, Boolean(blueBytes && doorUpload.bytes?.equals(blueBytes) && !blueBytes.equals(greenBytes))],
     await nothingWaiting(), mail0 !== '' && (await newestMessage()) === mail0, (await approvedLines()) - lines0, await status(p2)],
    [`/build/${deniz.record_id}`, 303, true, [p3, true, true], true, true, 1, 404]);
  const ogAfter = await og('/p/dev-deniz');
  check('photo-w2b: and his Open Graph card is byte for byte the same with the new photo on his approved page as before it — no photo, public or signed, reaches an under-18’s card (D-89)',
    [ogBefore.length > 1000, ogAfter.equals(ogBefore)], [true, true]);

  // ---- a child's upload waiting, then the parent's own (parent's change
  // only; BUZ and John, 2 Oct): the parent's photo is the page at once, and
  // the waiting version takes it too — the field both touched is the
  // parent's — so the child's photo, which nothing names any more, goes, and
  // approving the child's change later keeps the parent's photo.
  // MOVED (2 Oct): it asserted the restrictive answer pending John — the
  // parent's photo joined the waiting version and nothing published ----
  await upload(`/build/${deniz.record_id}`, deniz.child_id, await amber);
  const p4 = await live(deniz.child_id);
  await saveForm(deniz.child_id);
  const childWaits = await drawn();
  await upload(door ?? `/build/${deniz.record_id}`, alex, await grey);
  const p5 = await live(alex);
  const parentOver = await drawn();
  // MOVED again (2 Oct, the full review): his change was the photo alone, and
  // his parent's photo decided that field in both versions, so nothing of his
  // waits any more — the review says so, and there is nothing to approve.
  const leftWaiting = !(await nothingWaiting());
  const okChild = await approve();
  const afterChild = await drawn();
  const greyBytes = await bytes(p5);
  check('photo-w3: with Deniz\u2019s photo waiting, his parent\u2019s photo is the club\u2019s at once and takes the waiting version\u2019s place too; his, which nothing names any more, is deleted; and with nothing of his left to review, nothing waits and the page keeps the parent\u2019s photo',
    [new Set([p3, p4, p5]).size, childWaits.club, parentOver.club, leftWaiting, okChild.location, [afterChild.club, afterChild.same, Boolean(greyBytes && afterChild.bytes?.equals(greyBytes))], await status(p4)],
    [3, p3, p5, false, 'no approve form', [p5, true, true], 404]);

  // ---- N-10 / doc 14 R12 (John, 1 Oct): a 16–17's page is theirs. Their
  // parent has no photo form to press, and a crafted post goes home and
  // changes nothing ----
  {
    const nate = ids.children.nate;
    const nateLive = async () => photoOn((await get(`/build/${nate.record_id}`, nate.child_id)).html, nate.record_id);
    const before = await nateLive();
    const fd = new FormData();
    fd.append('photo', new Blob([await grey], { type: 'image/png' }), 'photo.png');
    const r = await fetch(`${BASE}/build/${nate.record_id}/photo`, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(alex) } });
    await r.text();
    check('photo-w11 (N-10): a 16–17\u2019s parent cannot set their photo — the build page sends them home, a crafted upload goes home too, and the photo is unchanged',
      [(await get(`/build/${nate.record_id}`, alex)).status, r.status, (r.headers.get('location') ?? '').replace(BASE, ''), (await nateLive()) === before],
      [307, 303, '/home', true]);
  }

  // ---- old files: gone once nothing shows them, never the approved one ----
  // Two child uploads with no save between: the first is replaced before any
  // version named it, and goes. Every photo an approval or the parent's
  // upload superseded is gone; the approved one serves throughout.
  await upload(`/build/${deniz.record_id}`, deniz.child_id, await red);
  const p6 = await live(deniz.child_id);
  await upload(`/build/${deniz.record_id}`, deniz.child_id, await green);
  const p7 = await live(deniz.child_id);
  const approvedNow = await drawn();
  check('photo-w4: a superseded photo nothing names is deleted — every earlier approved one, and an upload replaced before anyone saved it — while the approved one still serves byte for byte and the latest upload waits at its own address',
    [await Promise.all([p1, p2, p3, p4, p6].map(status)), [approvedNow.club, Boolean(approvedNow.bytes?.equals(greyBytes))], new Set([p5, p6, p7]).size, await status(p7)],
    [[404, 404, 404, 404, 404], [p5, true], 3, 200]);

  // ---- 16–17 and adults: the live record is the page, at a new address every time ----
  const jordanRec = /\/build\/([0-9a-f-]{36})/.exec((await get('/home', jordan)).html)?.[1];
  for (const [who, seat, record, link] of [['a 16–17', nate.child_id, nate.record_id, '/p/dev-nate'],
                                           ['an adult', jordan, jordanRec, '/p/dev-jordan']]) {
    const on = async () => photoOn((await get(link, null)).html, record);
    const cardBefore = await og(link);
    await upload(`/build/${record}`, seat, await amber);
    const a = await on();
    const aBytes = await bytes(a);
    await upload(`/build/${record}`, seat, await grey);
    const b = await on();
    const bBytes = await bytes(b);
    check(`photo-w5: ${who} uploads twice, and the live page shows each new photo at once at a new address that serves it; the one it replaced is deleted`,
      [Boolean(a), Boolean(b) && b !== a, Boolean(aBytes), Boolean(bBytes && aBytes && !bBytes.equals(aBytes)), await status(a)],
      [true, true, true, true, 404]);
    if (seat === nate.child_id) {
      check('photo-w5b: a 16–17’s Open Graph card is byte for byte the same after two photos went on the live page (D-89)',
        (await og(link)).equals(cardBefore), true);
    }
  }

  // ---- private: an under-18's photo is drawn at an address minted for the
  // read, and only an allowed read mints one (John's ruling §1) ----
  const now = () => Math.floor(Date.now() / 1000);
  const expiryOf = (src) => Number(new URL(BASE + (src ?? '/')).searchParams.get('e'));
  const signedOut = async (path, rec) => photoOn((await get(path, null)).html, rec);
  const [dKey, nKey, jKey] = [await signedOut('/p/dev-deniz', deniz.record_id), await signedOut('/p/dev-nate', nate.record_id),
    await signedOut('/p/dev-jordan', jordanRec)];
  const dUrl = minted.get(dKey);
  check('photo-w6: a link-holder is drawn an under-18’s photo — Deniz’s, Nate’s — at a signed address that serves it and expires within ten minutes, never at a public one; an adult’s stays public',
    [Boolean(dKey?.startsWith(`/private-photo/player/${deniz.record_id}-`)), Boolean(nKey?.startsWith(`/private-photo/player/${nate.record_id}-`)),
     await status(dKey), await status(nKey), expiryOf(dUrl) > now() && expiryOf(dUrl) <= now() + 600,
     Boolean(jKey?.startsWith(`/dev-uploads/player-${jordanRec}-`))],
    [true, true, 200, 200, true, true]);
  const sig = new URL(BASE + (dUrl ?? '/')).searchParams.get('s');
  const tamper = async (q, who = null) => (await fetch(`${BASE}${dKey}${q}`, { headers: who ? { cookie: cookieFor(who) } : {} })).status;
  check('photo-w7: the same photo without its signature, with its expiry moved later or earlier, or past ten minutes, is a 404 — the key alone gives a stranger nothing',
    [await tamper(''), await tamper(`?e=${expiryOf(dUrl) + 60}&s=${sig}`), await tamper(`?e=${now() + 3600}&s=${sig}`), await tamper(`?e=${now() - 1}&s=${sig}`)],
    [404, 404, 404, 404]);

  // Paused by his parent: the share link is the dead page — no photo, nothing
  // minted — and the address minted before it dies on its own clock.
  const ctl = `/g/controls/${deniz.child_id}`;
  const pauseForm = async () => forms((await get(ctl, alex)).html).find((f) => 'paused' in f.fields);
  const pause = await pauseForm();
  await press(ctl, alex, pause?.fields ?? {});
  const pausedPage = (await get('/p/dev-deniz', null)).html;
  const unpause = await pauseForm();
  await press(ctl, alex, unpause?.fields ?? {});
  const backKey = await signedOut('/p/dev-deniz', deniz.record_id);
  check('photo-w8: his parent pauses his page — the share link draws no photo and mints no address, and the one minted before expires within ten minutes; unpaused, it is drawn again at an address that serves',
    [pause?.fields.paused, photoOn(pausedPage, deniz.record_id), /\/private-photo\//.test(pausedPage), expiryOf(dUrl) <= now() + 600,
     unpause?.fields.paused, backKey === dKey, await status(backKey)],
    ['true', null, false, true, 'false', true, 200]);

  // Another club, a signed-in stranger: no page, no address, and the key alone
  // opens nothing for them either.
  const dana = ids.people.dana, robin = ids.people.robin;
  const otherClub = await get(squadCv, dana);
  const stranger = await get(`/build/${deniz.record_id}`, robin);
  check('photo-w9: another club’s Technical Director opening Riverside’s squad CV of Deniz, and a signed-in stranger opening his builder, get no page and no address for his photo — and his photo’s key fetched as either of them is a 404',
    [otherClub.status === 200, /\/private-photo\//.test(otherClub.html), stranger.status === 200, /\/private-photo\//.test(stranger.html),
     await tamper('', dana), await tamper('', robin)],
    [false, false, false, false, 404, 404]);

  // The pages only Deniz and a link-holder see; the sweep below reads every
  // other page every seat reaches, and photo-w10 is asked once it has.
  for (const path of [`/home`, `/build/${deniz.record_id}`, `/build/${deniz.record_id}/preview`]) photoReads.push([path, (await get(path, deniz.child_id)).html]);
  for (const path of ['/p/dev-deniz', '/p/dev-nate', '/p/dev-georgia', '/p/dev-deniz/print', '/p/dev-nate/print', squadCv]) {
    photoReads.push([path, (await get(path, path === squadCv ? marina : null)).html]);
  }
}

// ---------------------------------------------------------------------------
// Collect every distinct form the product renders, per seat.
// ---------------------------------------------------------------------------
const SIGNED_OUT_ROUTES = ['/signin', '/join', '/reset', '/report', '/p/dev-deniz', '/p/dev-revoked'];
const found = new Map();          // actionId -> {seat, who, path, form}
for (const [seat, who] of Object.entries(SEATS)) {
  for (const p of await reach(who)) {
    photoReads.push([`${p.path} (${seat})`, p.html]);
    for (const f of forms(p.html)) {
      const key = `${f.actionId}:${p.path.replace(/[0-9a-f-]{36}/g, '*')}`;
      if (!found.has(key)) found.set(key, { seat, who, path: p.path, form: f });
    }
  }
}
for (const route of SIGNED_OUT_ROUTES) {
  const r = await get(route, null);
  if (r.status !== 200) continue;
  for (const f of forms(r.html)) {
    const key = `${f.actionId}:${route}`;
    if (!found.has(key)) found.set(key, { seat: 'signed out', who: null, path: route, form: f });
  }
}

// photo-w10 (John's ruling §1): every page every seat reaches, read by the
// sweep just now, and the ones only Deniz and a link-holder see (above). No
// under-18's photo at a public address, and no private path left unminted —
// after the photo block put photos on Deniz's and Nate's pages.
{
  const minorRecs = ['deniz', 'nate', 'georgia'].map((k) => ids.children[k].record_id).join('|');
  const minorIds = ['deniz', 'nate', 'georgia'].map((k) => ids.children[k].child_id).join('|');
  const leak = new RegExp(`/dev-uploads/(?:player-(?:${minorRecs})|coach-photo-(?:${minorIds}))|pitch-private:`);
  const leaks = photoReads.filter(([, html]) => leak.test(html)).map(([path]) => path);
  const drawn = photoReads.filter(([, html]) => /\/private-photo\/player\//.test(html)).length;
  check(`photo-w10: no page any seat reaches — family, player, 16–17, club, coach, signed out, print (${photoReads.length} pages) — draws an under-18\u2019s photo at a public address or an unminted path (${leaks.join(', ') || 'none'}), and the private ones are drawn (${drawn})`,
    [leaks, drawn >= 5], [[], true]);
}

const all = [...found.values()];
// Destructive last, so a sweep does not delete the fixture it still needs.
const weight = (e) => /delete/i.test(e.form.submit) ? 2 : /remove|close/i.test(e.form.submit) ? 1 : 0;
all.sort((a, b) => weight(a) - weight(b));

console.log(`\n${all.length} distinct forms across ${Object.keys(SEATS).length + 1} seats\n`);

// ---------------------------------------------------------------------------
// 0 · A CV SENT FROM EACH BAND ACTUALLY ARRIVES, AND THE RIGHT PEOPLE ARE TOLD.
//
// x1 below would not have caught the bug this exists for. "Send my CV" told
// every player to ask a parent, and an adult's send — a 303 and a new row, so
// a pass by every measure x1 has — reached nobody at all. "It did not 500" is
// not "the CV got to the club". This reads the outbox, which is what the
// product would actually have sent (doc 15), and asks the question per band.
//
// Runs FIRST, on the fresh database: the generic sweep below pauses profiles
// and flips switches, and x3 deletes a child.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// A19 / D-161 - the chip that is not there, pressed anyway.
//
// A server action stays callable whether or not its page renders the control,
// so a crafted post is the only way left to ask for a school entry on a
// child's record. It must write nothing and look exactly like every other kind
// that is not on the list - and the SAME post with a kind that IS on the list
// must write, or this check passes on a post that never worked.
// ---------------------------------------------------------------------------
{
  const parent = SEATS.parent;
  const more = `/build/${ids.children.deniz.record_id}/more`;
  const add = async (kind, orgName) => {
    // The page carries TWO addExperience forms. The previous-club one has a
    // HIDDEN kind, and a duplicate key sends the first value (L10) - so
    // picking it would have posted previous_club and passed on nothing.
    const form = forms((await get(more, parent)).html)
      .find((f) => f.visible.some((v) => v.name === 'kind' && v.type === 'radio'));
    const fd = new FormData();
    for (const [k, v] of Object.entries(form.fields)) fd.append(k, v);
    fd.append('kind', kind); fd.append('orgName', orgName); fd.append('period', '2026');
    const r = await fetch(BASE + more, { method: 'POST', body: fd, redirect: 'manual',
      headers: { cookie: cookieFor(parent) } });
    await r.text();
    return { status: r.status, location: r.headers.get('location') ?? '' };
  };
  const listed = async (org) => (await get(more, parent)).html.includes(org);
  check('A19: the u16 editor offers a kind chip at all, so the post below is real',
    (await get(more, parent)).html.includes('name="kind"'), true);

  const refused = await add('school', 'Sweep School 1st XI');
  check('A19: a crafted school entry writes nothing on an under-16 record',
    await listed('Sweep School 1st XI'), false);
  const written = await add('futsal', 'Sweep futsal summer');
  check('A19: while the same post with a kind on the list does write',
    await listed('Sweep futsal summer'), true);
  check('A19: and the refused one answered exactly as the written one did',
    [refused.status, refused.location], [written.status, written.location]);
}

{
  const parent = SEATS.parent;
  const nate = ids.children.nate;
  const deniz = ids.children.deniz;
  const decode = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  const outbox = async () => decode((await get('/dev/outbox', parent)).html);
  const esc = (a) => a.replace(/[.+]/g, (c) => '\\' + c);
  const to = (text, section, address) => new RegExp(`doc15\\.§${section}\\s*→\\s*${esc(address)}`).test(text);
  const sendForm = async (who, recordId) =>
    forms((await get(`/send/${recordId}`, who)).html).find((x) => x.visible.some((v) => v.name === 'clubName'));
  const postSend = async (who, recordId, form, clubName, address) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(form.fields)) fd.append(k, v);
    fd.append('clubName', clubName); fd.append('address', address);
    const r = await fetch(BASE + `/send/${recordId}`, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(who) } });
    await r.text();
    return r.headers.get('location') ?? '';
  };

  // 18+ — Jordan, 22, no guardian. doc 14 L8.
  const jordanRec = /href="\/build\/([0-9a-f-]{36})"/.exec((await get('/home', SEATS.player)).html)?.[1];
  const jf = await sendForm(SEATS.player, jordanRec);
  const aLoc = await postSend(SEATS.player, jordanRec, jf, 'Adult Test FC', 'adult@send.example');
  let box = await outbox();
  check('x0a: an adult’s send is SENT, not asked for', aLoc.includes('sent=1'), true);
  check('x0b: AND IT REACHES THE CLUB — it used to reach nobody (L8)', to(box, 19, 'adult@send.example'), true);
  check('x0c: the club is told the player sent it, not "the family"',
    box.includes('Jordan has sent you their football CV.') && !box.includes("Jordan's family has sent you"), true);
  check('x0d: the adult gets their receipt (§21)', to(box, 21, 'player@example.com'), true);
  check('x0e: and no parent is asked, because there is no parent', box.includes('It goes to: adult@send.example'), false);

  // 16–17 — Nate, 17. doc 14 L5, doc 15 §22.
  const nf = await sendForm(nate.child_id, nate.record_id);
  const nLoc = await postSend(nate.child_id, nate.record_id, nf, 'Teen Test FC', 'teen@send.example');
  box = await outbox();
  check('x0f: a 16-17 sends for themselves (L5)', nLoc.includes('sent=1'), true);
  check('x0g: it reaches the club', to(box, 19, 'teen@send.example'), true);
  check('x0h: the 16-17 gets their receipt', to(box, 21, 'nate@example.com'), true);
  check('x0i: AND THE GUARDIAN IS TOLD, with the address it went to (§22)',
    to(box, 22, 'guardian@example.com') && box.includes('today, at teen@send.example'), true);

  // Under 16 — Deniz, 14. doc 14 L1: composed, never transmitted. L1 is the
  // child composing (`self`), so Deniz composes it in his own seat. It used to
  // be posted as the parent, which until C-P4 read the same screen; a parent
  // composing here now sends it themselves (C-P4-w, below).
  const df = await sendForm(deniz.child_id, deniz.record_id);
  const dLoc = await postSend(deniz.child_id, deniz.record_id, df, 'Child Test FC', 'child@send.example');
  box = await outbox();
  check('x0j: an under-16’s send is asked for, not sent (L1)', dLoc.includes('asked=1'), true);
  check('x0k: nothing reaches the club until a guardian presses send', to(box, 19, 'child@send.example'), false);
  check('x0l: the guardian is asked, with the address in full (§20)', box.includes('It goes to: child@send.example'), true);

  // The switch — doc 14 L6, and §22's "the switch is yours".
  const ctl = `/g/controls/${nate.child_id}`;
  const flip = async () => {
    const f = forms((await get(ctl, parent)).html).find((x) => 'sendOff' in x.fields);
    if (!f) return 0;
    const fd = new FormData();
    for (const [k, v] of Object.entries(f.fields)) fd.append(k, v);
    const r = await fetch(BASE + ctl, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(parent) } });
    await r.text();
    return r.status;
  };
  const heldForm = await sendForm(nate.child_id, nate.record_id);   // taken BEFORE the switch goes off
  check('x0m: the guardian of a 16-17 has a switch for their sending', await flip(), 303);
  const offPage = (await get(`/send/${nate.record_id}`, nate.child_id)).html;
  check('x0n: the player is told plainly that sending is off, with no form (L6)',
    offPage.includes('Sending is off on your account') && !/name="clubName"/.test(offPage), true);
  check('x0o: and never who switched it', /Alex|switched it off|your guardian turned/i.test(decode(offPage)), false);
  await postSend(nate.child_id, nate.record_id, heldForm, 'Blocked Test FC', 'blocked@send.example');
  box = await outbox();
  check('x0p: a send posted anyway, from a form held open, goes NOWHERE — the server refuses, not the page',
    box.includes('blocked@send.example'), false);
  await flip();
  check('x0q: switching it back on restores the form',
    /name="clubName"/.test((await get(`/send/${nate.record_id}`, nate.child_id)).html), true);
}

// ---------------------------------------------------------------------------
// 0160 · "SEND MY CV" FROM A CLUB'S PAGE, AND A CLUB THAT ASKS US TO STOP.
// (John, 30 Sep §2.) The whole journey, observed through the product: the
// send screen fills in the club's published address; the club gets the CV
// with a stop link; a bad signature stops nothing and says the same as a good
// one; a good one stops the club; and then nothing can be sent to it — not
// its address, not another address a family types at its domain, and not a
// request a child composed before it asked. Brindlewood is stopped for the
// rest of this run (reseed after, as always).
// ---------------------------------------------------------------------------
{
  const nate = ids.children.nate, deniz = ids.children.deniz, parent = SEATS.parent;
  const plain = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;|&rsquo;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
  const outbox = async () => plain((await get('/dev/outbox', parent)).html);
  const CLUB = 'info@brindlewoodrovers.example.au';
  const post = async (path, who, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual', headers: who ? { cookie: cookieFor(who) } : {} });
    await r.text();
    return (r.headers.get('location') ?? '').replace(BASE, '');
  };
  const filledForm = async (who, rec) => {
    const f = forms((await get(`/send/${rec}?club=brindlewood-rovers-sc`, who)).html).find((x) => x.visible.some((v) => v.name === 'clubName'));
    return f ? { ...f.fields, ...Object.fromEntries(f.visible.filter((v) => v.value !== undefined).map((v) => [v.name, v.value])) } : null;
  };
  const linksOf = async () => { const t = plain((await get(`/send/${nate.record_id}`, nate.child_id)).html); return t.slice(t.indexOf('Your links')); };

  // A child composes for their parent BEFORE the club asks us to stop — in
  // the child's own seat (C-P4: a parent composing sends it themselves).
  const denizForm = await filledForm(deniz.child_id, deniz.record_id);
  const denizLoc = await post(`/send/${deniz.record_id}`, deniz.child_id, denizForm);
  const box0 = await outbox();
  const ask = /\/g\/send\/([0-9a-f-]{36})/.exec(box0.slice(box0.indexOf(`It goes to: ${CLUB}`)))?.[1];
  const gForm = ask && forms((await get(`/g/send/${ask}`, parent)).html).find((f) => 'requestId' in f.fields);
  check('sc-w1: from the club’s page the form arrives filled in, and posted exactly as filled it asks the parent, naming that address',
    [denizForm?.clubName, denizForm?.address, /asked=1/.test(denizLoc), Boolean(ask), Boolean(gForm)],
    ['Brindlewood Rovers SC', CLUB, true, true, true]);

  const nateForm = await filledForm(nate.child_id, nate.record_id);
  // Leo, 30 Sep: a mistyped address comes back with the club still filled in.
  const typoLoc = await post(`/send/${nate.record_id}`, nate.child_id, { ...nateForm, address: 'info at brindlewood' });
  const typoPage = typoLoc ? (await get(typoLoc, nate.child_id)).html : '';
  check('sc-w1b: a mistyped address comes back to the form with the club carried through, filled in again, and the error said',
    [typoLoc, /value="Brindlewood Rovers SC"/.test(typoPage), /value="info@brindlewoodrovers\.example\.au"/.test(typoPage),
     /Check the club name and the email address/.test(plain(typoPage))],
    [`/send/${nate.record_id}?error=1&club=brindlewood-rovers-sc`, true, true, true]);
  const sentLoc = await post(`/send/${nate.record_id}`, nate.child_id, nateForm);
  const box1 = await outbox();
  const at = box1.indexOf(`doc15.§19 → ${CLUB}`);
  const card = at < 0 ? '' : box1.slice(at, box1.indexOf('doc15.§', at + 10) < 0 ? undefined : box1.indexOf('doc15.§', at + 10));
  const link = /pitchfootball\.com\.au\/stop-cvs\?r=([0-9a-f-]{36})&t=([A-Za-z0-9_-]{43})/.exec(card);
  check('sc-w2: a 16–17 sends it as filled in, and the club’s §19 ends with the stop link — and no longer says there is nothing to unsubscribe from',
    [/sent=1/.test(sentLoc), at >= 0, /We did not add you to a list\. To stop CVs reaching this address through Pitch: pitchfootball\.com\.au\/stop-cvs\?r=/.test(card),
     Boolean(link), /nothing to unsubscribe from/.test(card), /stop-cvs[^\s]*@/.test(card)],
    [true, true, true, true, false, false]);

  const [, r, t] = link ?? [];
  const stopForm = forms((await get(`/stop-cvs?r=${r}&t=${t}`, null)).html).find((f) => 'r' in f.fields);
  const stillOpen = async () => /value="info@brindlewoodrovers\.example\.au"/.test((await get(`/send/${nate.record_id}?club=brindlewood-rovers-sc`, nate.child_id)).html);
  const badLoc = await post('/stop-cvs', null, { ...stopForm.fields, t: (t?.[0] === 'A' ? 'B' : 'A') + (t ?? '').slice(1) });
  const badDone = plain((await get(badLoc, null)).html);
  const openAfterBad = await stillOpen();
  const goodLoc = await post('/stop-cvs', null, stopForm.fields);
  const goodDone = plain((await get(goodLoc, null)).html);
  check('sc-w3: pressing "Stop them" with a bad signature stops nothing, and lands on exactly the screen a good one does',
    [stopForm?.fields.r === r, badLoc, goodLoc, openAfterBad, badDone === goodDone, goodDone.includes('Done Pitch won’t send CVs to this address again.')],
    [true, '/stop-cvs?done=1', '/stop-cvs?done=1', true, true, true]);
  const stoppedPage = plain((await get(`/send/${nate.record_id}?club=brindlewood-rovers-sc`, nate.child_id)).html);
  check('sc-w4: with a good one the club is stopped: its page’s send screen says "We can’t send to this club through Pitch", with no form',
    [await stillOpen(), stoppedPage.includes('We can’t send to this club through Pitch Nothing has been sent.')], [false, true]);

  const linksBefore = await linksOf();
  const typedLoc = await post(`/send/${nate.record_id}`, nate.child_id, { ...nateForm, address: 'coach@brindlewoodrovers.example.au' });
  const box2 = await outbox();
  check('sc-w5: a self-send typed by hand to another address at that club is refused with nothing created — no send, no email to anyone, nothing on the player’s list',
    [typedLoc, box2.includes('coach@brindlewoodrovers.example.au'), await linksOf() === linksBefore],
    [`/send/${nate.record_id}?blocked=1`, false, true]);
  const denizAgain = await post(`/send/${deniz.record_id}`, deniz.child_id, denizForm);
  check('sc-w6: and an under-16’s compose to it is refused before anything is asked of the parent',
    [denizAgain, (await outbox()).split(`It goes to: ${CLUB}`).length - 1], [`/send/${deniz.record_id}?blocked=1`, 1]);
  // Safety review N-1: sc-w6 pressed from the parent's seat until C-P4 moved
  // it to the child's. The parent's own press (C-P4) to the stopped club is
  // refused the same way: nothing sent, nothing on the club's §19 count.
  const parentForm = forms((await get(`/send/${deniz.record_id}`, parent)).html).find((x) => x.visible.some((v) => v.name === 'clubName'));
  const sentBefore = (await outbox()).split(`doc15.§19 → ${CLUB}`).length - 1;
  const parentStopped = parentForm ? await post(`/send/${deniz.record_id}`, parent, { ...parentForm.fields, clubName: 'Brindlewood Rovers SC', address: CLUB }) : '';
  check('sc-w6b: and the parent’s own press to it, from their child’s Send, is refused too — "can’t send", nothing to the club',
    [Boolean(parentForm), parentStopped, (await outbox()).split(`doc15.§19 → ${CLUB}`).length - 1], [true, `/send/${deniz.record_id}?blocked=1`, sentBefore]);
  const gPage = plain((await get(`/g/send/${ask}`, parent)).html);
  const gLoc = await post(`/g/send/${ask}`, parent, gForm.fields);
  check('sc-w7: the request the child composed before the club asked now says it cannot be sent, and pressing send from the old page sends nothing',
    [gPage.includes('We can’t send to this club through Pitch Nothing has been sent.'), /Send it to/.test(gPage), gLoc,
     (await outbox()).split(`doc15.§19 → ${CLUB}`).length - 1],
    [true, false, `/g/send/${ask}`, 1]);

  // The operator, for a club that asks by phone or by email. Any signed-in
  // address is an operator in development (lib/ops-policy).
  const op = ids.people.jordan;
  const screen = `/ops/clubs/${ids.clubs['kestrelford-athletic-sc']}`;
  const stopBtn = forms((await get(screen, op)).html).find((f) => f.submit === 'Stop CVs to this club');
  await post(screen, null, stopBtn?.fields ?? {});
  const afterSignedOut = plain((await get(screen, op)).html);
  const opLoc = await post(screen, op, stopBtn?.fields ?? {});
  const afterOp = plain((await get(screen, op)).html);
  const kLoc = await post(`/send/${nate.record_id}`, nate.child_id, { ...nateForm, clubName: 'Kestrelford Athletic SC', address: 'j.whitcombe@kestrelfordathletic.example.au' });
  check('sc-w8: the operator’s "Stop CVs to this club" works with no JavaScript — signed out it stops nothing; pressed, the page says so and a family’s send to that address is refused',
    [Boolean(stopBtn), afterSignedOut.includes('CVs to this club are stopped.'), opLoc, afterOp.includes('CVs to this club are stopped.'),
     afterOp.includes('Stop CVs to this club'), kLoc],
    [true, false, screen, true, false, `/send/${nate.record_id}?blocked=1`]);

  // Leo, 30 Sep: a good signature is always honoured and never counted. From
  // one address, twenty good presses (of a link already used), then a
  // twenty-first good one, for a new send, still stops.
  const pressFrom = async (fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    const r = await fetch(BASE + '/stop-cvs', { method: 'POST', body: fd, redirect: 'manual', headers: { 'x-forwarded-for': '203.0.113.21' } });
    await r.text();
    return (r.headers.get('location') ?? '').replace(BASE, '');
  };
  const burst = [];
  for (let i = 0; i < 20; i++) burst.push(await pressFrom(stopForm.fields));
  const burstSent = await post(`/send/${nate.record_id}`, nate.child_id, { ...nateForm, clubName: 'Stopburst FC', address: 'coach@stopburst.example.au' });
  const box3 = await outbox();
  const at3 = box3.indexOf('doc15.§19 → coach@stopburst.example.au');
  const link3 = /stop-cvs\?r=([0-9a-f-]{36})&t=([A-Za-z0-9_-]{43})/.exec(box3.slice(at3));
  const twentyFirst = link3 ? await pressFrom({ ...stopForm.fields, r: link3[1], t: link3[2] }) : null;
  const afterBurst = await post(`/send/${nate.record_id}`, nate.child_id, { ...nateForm, clubName: 'Stopburst FC', address: 'coach@stopburst.example.au' });
  check('sc-w9: the 21st good stop in an hour from one address still records — the club it went to can no longer be sent to',
    [[...new Set(burst)], /sent=1/.test(burstSent), at3 >= 0, twentyFirst, afterBurst],
    [['/stop-cvs?done=1'], true, true, '/stop-cvs?done=1', `/send/${nate.record_id}?blocked=1`]);
}

// ---------------------------------------------------------------------------
// 0a1 · D-105 — THE KEEPER'S FORM OPENS WITH THE KEEPER'S SET.
//
// STAT_SETS is the brief's position-aware DEFAULT PRE-SELECTION, and until
// 28 Sep it was exported and imported by nothing: the form typed the outfield
// three in, so every goalkeeper opened their own page with Goals and Assists
// lit and Clean sheets dimmed. It demoed correctly for weeks because the GK
// fixture's selection was hand-set to exactly what a correct default produces.
//
// Nate is the keeper. His record carries a selection, so the default can only
// be seen after it is cleared — which is a real action (D-105 allows every
// stat to be switched off). Then the form is posted the way a browser with NO
// JavaScript posts it, because that is the only path on which the server, not
// the page, has to know what a keeper's default is.
//
// Pressed state is read from aria-pressed rather than from a colour: a test
// that reads a hex value is testing the palette.
// ---------------------------------------------------------------------------
{
  const nate = ids.children.nate;
  const buildPath = `/build/${nate.record_id}`;
  const pressed = (html, label) =>
    new RegExp(`<button[^>]*aria-pressed="true"[^>]*>${label}</button>`).test(html);
  const unhtml = (t) => t.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  // The form as it stands, so a post about one field does not wipe the others.
  const state = async () => {
    const { html } = await get(buildPath, nate.child_id);
    const form = forms(html).find((f) => 'positions' in f.fields);
    const fields = { ...form.fields };
    for (const v of form.visible) {
      if (v.file) continue;
      fields[v.name] = v.type === 'select' ? (v.options?.[0] ?? '') : (v.value ?? '');
    }
    fields.about = unhtml(/<textarea[^>]*name="about"[^>]*>([\s\S]*?)<\/textarea>/.exec(html)?.[1] ?? '');
    return { html, fields };
  };
  const save = async (fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    const r = await fetch(BASE + buildPath, { method: 'POST', body: fd, redirect: 'manual',
      headers: { cookie: cookieFor(nate.child_id) } });
    await r.text();
    return r.status;
  };

  const before = await state();
  check('gk-w1: the keeper\u2019s form opens on his stored selection',
    [pressed(before.html, 'Clean sheets'), pressed(before.html, 'Goals')], [true, false]);

  // He switches every stat off. Nothing is selected, so nothing is stored.
  check('gk-w2: switching every stat off saves without JavaScript',
    await save({ ...before.fields, surfaced: '' }), 303);
  const cleared = await state();
  check('gk-w3: and with no selection stored the form falls back to the KEEPER\u2019s set, not the outfield three',
    [pressed(cleared.html, 'Appearances'), pressed(cleared.html, 'Clean sheets'),
     pressed(cleared.html, 'Goals'), pressed(cleared.html, 'Assists')],
    [true, true, false, false]);

  // Now the no-JavaScript post: the page sends no selection at all, so the
  // SERVER applies the default for the positions it is saving.
  const noJs = { ...cleared.fields };
  delete noJs.surfaced;
  check('gk-w4: posting with no selection at all saves', await save(noJs), 303);
  const saved = await state();
  check('gk-w5: the keeper\u2019s default is what got stored, so his page carries clean sheets',
    [pressed(saved.html, 'Clean sheets'), pressed(saved.html, 'Goals')], [true, false]);
  const preview = (await get(`/build/${nate.record_id}/preview`, nate.child_id)).html;
  check('gk-w6: and the page a club sees shows Clean sheets and no Goals (D-67, D-70)',
    [/Clean sheets/i.test(preview), /\bGoals\b/.test(preview)], [true, false]);

  // D-162: a zero is never printed as a value. A keeper types 0 clean sheets;
  // it is absence, so the form opens on the placeholder rather than on a 0
  // that reads as already-saved, and the page omits the tile. His real number
  // goes back afterwards so nothing below inherits a changed fixture.
  const real = saved.fields.stat_clean_sheets;
  check('gk-w7: typing 0 into a stat saves', await save({ ...saved.fields, stat_clean_sheets: '0' }), 303);
  const zeroed = await state();
  const csInput = /<input[^>]*aria-label="Clean sheets"[^>]*>/.exec(zeroed.html)?.[0] ?? '';
  check('gk-w8: and the form opens on the placeholder, never a printed 0 (D-162)',
    [/value="0"/.test(csInput), /value=""/.test(csInput)], [false, true]);
  const zeroPage = (await get(`/build/${nate.record_id}/preview`, nate.child_id)).html;
  check('gk-w9: and the page shows no clean-sheets tile at all',
    /Clean sheets/i.test(zeroPage), false);
  await save({ ...zeroed.fields, stat_clean_sheets: real });

  // Spec C (1 Oct): Number and Preferred foot sit on the card, outside the
  // story form, and join it with form="cv". Every save above was the form as
  // a browser posts it; had either control not joined the form, his number
  // and foot would have been posted as nothing and blanked.
  const after = await state();
  check('pl-fl-w1: after five saves from the builder his number and foot are still his — the card’s controls posted with the form',
    [after.fields.squadNumber, /<select[^>]*name="foot"[^>]*>[\s\S]*?<option selected="" value="Right">|<option value="Right" selected=""/.test(after.html)
      || /<select[^>]*name="foot"[^>]*>[\s\S]*?<option selected="">Right<\/option>/.test(after.html)], ['1', true]);
}

// ---------------------------------------------------------------------------
// 0b · D-153 — A CLUB INVITES A PLAYER TO TRIAL, IN EVERY BAND, ON THE FREE TIER.
//
// Walked through the real screens, and the outbox read for what would actually
// have gone. Before D-153 every step of this was broken for somebody: the
// trials board's buttons did nothing, an adult or 16-17 who registered interest
// never reached a register, a free club could not invite, and an invitation
// woke one guardian and nobody else — so an adult a club invited was never told.
// ---------------------------------------------------------------------------
{
  // D-153's free tier is a Stripe-build state (D-163): with billing off every
  // verified club reads its whole register. Switched off again after g1.
  await billingSwitch(true);
  const parent = SEATS.parent, adult = SEATS.player, teen = ids.children.nate.child_id, club = ids.people.dana;
  const kingsway = ids.clubs['kingsway-rovers'];
  const decode = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;|&rsquo;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
  const outbox = async () => decode((await get('/dev/outbox', parent)).html);
  const esc = (a) => a.replace(/[.+]/g, (c) => '\\' + c);
  const count = (text, key, address) => (text.match(new RegExp(`doc15\\.§${esc(key)}\\s*→\\s*${esc(address)}`, 'g')) ?? []).length;
  const postTo = async (path, who, form, extra = {}) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(form?.fields ?? {})) fd.append(k, v);
    for (const [k, v] of Object.entries(extra)) fd.append(k, v);
    const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(who) } });
    await r.text();
    return { status: r.status, location: r.headers.get('location') ?? '' };
  };
  const formOn = (html, needle) => forms(html).find((f) => needle(f));
  const inviteLinkFor = (html, name) => new RegExp(`>${name}<[\\s\\S]*?/club/invite/([0-9a-f-]{36})`).exec(html)?.[1];

  // The trials board opens the club's door, carrying the trial.
  const board = (await get('/trials', adult)).html;
  const trialId = /href="\/fc\/kingsway-rovers\?trial=([0-9a-f-]{36})#play"/.exec(board)?.[1];
  check('d0a: "I’m interested" on the trials board is a real link, carrying the trial', Boolean(trialId), true);
  check('d0b: "Send my CV" on an unclaimed listing is a real link too', /href="\/fc\/westgate-rangers#play"/.test(board), true);
  const westgate = decode((await get('/fc/westgate-rangers', adult)).html);
  check('d0c: an unclaimed club offers "send my CV", never a register nobody reads',
    westgate.includes('Send my CV to Westgate Rangers') && !westgate.includes('Register my interest'), true);

  // ---- 18+ — Jordan ----------------------------------------------------------
  const jordanRec = /href="\/build\/([0-9a-f-]{36})"/.exec((await get('/home', adult)).html)?.[1];
  const regPath = (rec) => `/register-interest/${rec}?club=${kingsway}&trial=${trialId}`;
  let html = (await get(regPath(jordanRec), adult)).html;
  check('d1: an adult is offered the register themselves, not "ask my parent"',
    html.includes('Put me on the register') && /name="trialId"/.test(html), true);
  let res = await postTo(regPath(jordanRec), adult, formOn(html, (f) => 'trialId' in f.fields), { note: 'Left-footed nine.' });
  check('d2: AND THE ADULT GOES ON THE REGISTER — it used to reach no one', res.location.includes('registered=1'), true);

  html = (await get('/club/register', club)).html;
  check('d3: the free club sees who registered interest in its trial', decode(html).includes('Interest in your trials'), true);
  const jordanReg = inviteLinkFor(html, 'Jordan');
  check('d3b: including the adult who just did', Boolean(jordanReg), true);
  html = (await get(`/club/invite/${jordanReg}`, club)).html;
  let box0 = await outbox();
  res = await postTo(`/club/invite/${jordanReg}`, club, formOn(html, (f) => 'registrationId' in f.fields), { kind: 'trial', body: 'Come and have a look.' });
  check('d4: the FREE club can invite them to its trial', res.status, 303);
  let box = await outbox();
  check('d5: and the adult is told, by name of club (§27) — they used to be told nothing',
    count(box, '27', 'player@example.com') - count(box0, '27', 'player@example.com'), 1);
  const jordanInv = /href="\/g\/invite\/([0-9a-f-]{36})"/.exec((await get('/home', adult)).html)?.[1];
  check('d6: the invitation is on the adult’s own home', Boolean(jordanInv), true);
  html = (await get(`/g/invite/${jordanInv}?reply=1`, adult)).html;
  box0 = await outbox();
  res = await postTo(`/g/invite/${jordanInv}`, adult, formOn(html, (f) => 'invitationId' in f.fields),
    { answer: 'yes', share_email: 'on', share_phone: '0400 111 222', note: 'See you there.' });
  check('d7: an adult’s reply goes straight to the club', res.status, 303);
  box = await outbox();
  check('d8: the club is told a family replied (§28), and nothing else',
    count(box, '28', 'football@kingswayrovers.example.au') - count(box0, '28', 'football@kingswayrovers.example.au'), 1);
  const clubView = decode((await get(`/club/invite/${jordanReg}`, club)).html);
  check('d9: the club reads the answer and exactly what was handed over',
    clubView.includes('Jordan replied') && clubView.includes('player@example.com') && clubView.includes('0400 111 222'), true);

  // ---- 16–17 — Nate ----------------------------------------------------------
  const nateRec = ids.children.nate.record_id;
  html = (await get(regPath(nateRec), teen)).html;
  res = await postTo(regPath(nateRec), teen, formOn(html, (f) => 'trialId' in f.fields), {});
  check('e1: a 16-17 goes on the register themselves', res.location.includes('registered=1'), true);
  html = (await get('/club/register', club)).html;
  const nateReg = inviteLinkFor(html, 'Nate');
  html = (await get(`/club/invite/${nateReg}`, club)).html;
  box0 = await outbox();
  res = await postTo(`/club/invite/${nateReg}`, club, formOn(html, (f) => 'registrationId' in f.fields), { kind: 'trial', body: '' });
  box = await outbox();
  check('e2: the free club invites the 16-17', res.status, 303);
  check('e3: and BOTH the player and the parent are woken — a bare wake, nothing in it',
    count(box, '24.email', 'nate@example.com') - count(box0, '24.email', 'nate@example.com') === 1
      && count(box, '24.email', 'guardian@example.com') - count(box0, '24.email', 'guardian@example.com') === 1, true);
  const nateInv = /href="\/g\/invite\/([0-9a-f-]{36})"/.exec((await get('/home', teen)).html)?.[1];
  const nateSees = decode((await get(`/g/invite/${nateInv}`, teen)).html);
  check('e4: the player sees their own invitation, and that their parent can too',
    nateSees.includes('would like you at a trial') && nateSees.includes('Your parent can see this too'), true);
  html = (await get(`/g/invite/${nateInv}?reply=1`, teen)).html;
  check('e4b: a minor’s reply form offers no contact details to hand over', /name="share_email"|name="share_phone"/.test(html), false);
  box0 = await outbox();
  // The draft answers "Interested, not that date", so dfx-D-6 can see which
  // answer the parent's form draws as chosen (defect 6, 1 Oct).
  await postTo(`/g/invite/${nateInv}`, teen, formOn(html, (f) => 'invitationId' in f.fields), { answer: 'interested_not_date', note: 'Keen.' });
  box = await outbox();
  check('e5: THE CLUB SEES NOTHING until a parent approves', decode((await get(`/club/invite/${nateReg}`, club)).html).includes('Nate replied'), false);
  check('e6: the parent is woken to approve it',
    count(box, '24.email', 'guardian@example.com') - count(box0, '24.email', 'guardian@example.com'), 1);
  check('e6b: and the club is not told anything yet',
    count(box, '28', 'football@kingswayrovers.example.au') - count(box0, '28', 'football@kingswayrovers.example.au'), 0);
  check('e7: the parent’s home says the player wants to reply',
    decode((await get('/home', parent)).html).includes('Nate wants to reply to Kingsway Rovers FC'), true);
  html = (await get(`/g/invite/${nateInv}?reply=1`, parent)).html;
  check('e7b: the parent reviews it with the player’s words already in it', decode(html).includes('Approve Nate'), true);
  // Defect 6 (1 Oct): the first answer was painted chosen whatever was
  // checked. Each answer is now an .opt whose look follows its own radio, and
  // the checked radio is the draft's.
  // React writes a checked radio as checked="" before its value, so the whole
  // tag is read rather than what follows the value.
  const opt = (v) => [...html.matchAll(/<label class="opt">(<input type="radio" name="answer"[^>]*>)/g)].map((m) => m[1]).find((t) => t.includes(`value="${v}"`)) ?? null;
  check('dfx-D-6: the parent’s form draws the draft’s answer as the chosen one — "Interested, not that date", not "will be there"',
    [opt('interested_not_date') !== null && /checked/.test(opt('interested_not_date')), opt('yes') !== null && !/checked/.test(opt('yes')),
     /<label class="opt"><input[^>]*><div style=/.test(html)], [true, true, false]);
  check('dfx-PD-1b: and beside the submit, "Not this time" is a link home, not a second form',
    [/<a [^>]*href="\/home"[^>]*>Not this time<\/a>/.test(html.slice(Math.max(0, html.indexOf('name="answer"')))),
     forms(html).filter((f) => 'invitationId' in f.fields).length], [true, 1]);
  await postTo(`/g/invite/${nateInv}`, parent, formOn(html, (f) => 'invitationId' in f.fields), { answer: 'yes', note: 'Keen.' });
  check('e8: once the parent approves, the club sees the answer',
    decode((await get(`/club/invite/${nateReg}`, club)).html).includes('Nate replied'), true);

  // ---- Under 16 — Deniz ------------------------------------------------------
  // Deniz composes it in his own seat (doc 14 N1); a parent composing here
  // since C-P4 puts him on the register themselves (C-P4-w, below).
  const denizRec = ids.children.deniz.record_id, denizSeat = ids.children.deniz.child_id;
  html = (await get(regPath(denizRec), denizSeat)).html;
  res = await postTo(regPath(denizRec), denizSeat, formOn(html, (f) => 'trialId' in f.fields), {});
  check('f1: an under-16’s interest waits for the parent', res.location.includes('asked=1'), true);
  const interestReq = [...(await get('/home', parent)).html.matchAll(/href="\/g\/interest\/([0-9a-f-]{36})"/g)].map((m) => m[1]);
  for (const rid of interestReq) {
    const page = (await get(`/g/interest/${rid}`, parent)).html;
    if (!decode(page).includes('Kingsway')) continue;
    check('f2a: the parent’s consent screen shows the trial (N2)', decode(page).includes('U16–U18 and Seniors trials'), true);
    await postTo(`/g/interest/${rid}`, parent, formOn(page, (f) => 'requestId' in f.fields), {});
    // D-F3 (1 Oct): there is no page called Manage.
    const sentPage = decode((await get(`/g/interest/${rid}`, parent)).html.replace(/<!--[\s\S]*?-->/g, ''));
    // BUZ, 1 Oct (copy fix 5): the Take-off control is on the child's controls page.
    check('dfx-D-F3: once sent, it says where to take the child off — the child\u2019s controls, not "Your family" or a "Manage page" that does not exist',
      [/is on Kingsway Rovers FC.s register/.test(sentPage), /off the register any time from \S+\u2019s controls\. Their access ends when you do\./.test(sentPage),
       sentPage.includes('from Your family'), /Manage page/.test(sentPage)], [true, true, false, false]);
  }
  html = (await get('/club/register', club)).html;
  const denizReg = inviteLinkFor(html, 'Deniz');
  check('f2: once the parent sends it, the free club sees the under-16 against its trial', Boolean(denizReg), true);
  html = (await get(`/club/invite/${denizReg}`, club)).html;
  box0 = await outbox();
  await postTo(`/club/invite/${denizReg}`, club, formOn(html, (f) => 'registrationId' in f.fields), { kind: 'trial', body: '' });
  box = await outbox();
  check('f3: the parent is woken about an under-16’s invitation',
    count(box, '24.email', 'guardian@example.com') - count(box0, '24.email', 'guardian@example.com'), 1);
  let denizInv = null;
  for (const m of (await get('/home', parent)).html.matchAll(/href="\/g\/invite\/([0-9a-f-]{36})"/g)) {
    const page = decode((await get(`/g/invite/${m[1]}`, parent)).html);
    if (page.includes('Kingsway') && page.includes('Deniz')) { denizInv = m[1]; break; }
  }
  html = (await get(`/g/invite/${denizInv}?reply=1`, parent)).html;
  await postTo(`/g/invite/${denizInv}`, parent, formOn(html, (f) => 'invitationId' in f.fields), { answer: 'interested_not_date' });
  check('f4: a parent may answer directly, and the club sees it',
    decode((await get(`/club/invite/${denizReg}`, club)).html).includes('Interested, but not that date'), true);

  // ---- The free tier's edge ---------------------------------------------------
  const riversideReg = /\/club\/register\/cv\/([0-9a-f-]{36})/.exec((await get('/club/register', ids.people.marina)).html)?.[1];
  check('g1: a free club cannot open another club’s registration — not found, not "no longer accepting"',
    (await get(`/club/invite/${riversideReg}`, club)).status, 404);
  await billingSwitch(false);

  // ---- Doc 14 P19: refusal looks exactly like absence ------------------------
  // The register offered "Invite to trial" for a paused child, the database
  // refused the write, and the page 500ed. Now the links are simply not there,
  // and the pages behind them are the same not-found as a stranger's.
  const georgia = ids.children.georgia.child_id;
  const gReg = /\/club\/register\/cv\/([0-9a-f-]{36})[\s\S]*?/.exec(
    ((await get('/club/register', club)).html.split('>Georgia<')[1] ?? ''))?.[1];
  check('p19a: Kingsway can open Georgia’s CV from its trial list before anything changes', Boolean(gReg), true);
  const pauseForm = (want) => async () => formOn((await get(`/g/controls/${georgia}`, parent)).html,
    (f) => f.fields.childId === georgia && f.fields.paused === want);
  const pause = await (pauseForm('true'))();
  check('p19b: her parent has a pause switch to press', Boolean(pause), true);
  // HoPD, 1 Oct: a club page offers a parent no Send or Register button for a
  // PAUSED under-16 — both answer 'none' then, so the button was a dead end.
  const gRec = ids.children.georgia.record_id;
  const fcDoors = async () => [...(await get('/fc/riverside-fc', parent)).html.matchAll(new RegExp(`href="/(send|register-interest)/${gRec}`, 'g'))].length > 0;
  const doorsBefore = await fcDoors();
  await postTo(`/g/controls/${georgia}`, parent, pause);
  check('p19-fc: before the pause the club page offers her parent her buttons; paused, it offers none',
    [doorsBefore, await fcDoors()], [true, false]);
  const pausedRegister = (await get('/club/register', club)).html;
  // Links, not the bare id: React keys the row by its registration id in the
  // page payload, and a key is not a door — the club already sees the row.
  const doorsTo = (html) => gReg ? [`/club/register/cv/${gReg}`, `/club/invite/${gReg}`].filter((d) => html.includes(d)) : null;
  check('p19c: paused, the register carries no link to her CV or an invite', doorsTo(pausedRegister), []);
  check('p19d: and her invite page is not found — not an error, not "paused"',
    (await get(`/club/invite/${gReg}`, club)).status, 404);
  check('p19e: nor is her CV page', (await get(`/club/register/cv/${gReg}`, club)).status, 404);
  // p19g — THE ONE THING IN THE 404 WORK THAT COULD MAKE US LESS SAFE.
  // Until 28 Sep both of these served Next's stock page, so they matched by
  // accident. Now they serve app/not-found.tsx, and they have to match on
  // purpose: a club that probes a URL must not be able to tell "there is a
  // child here whose parent has just switched her off" from "there is no such
  // club". Same status, same title, same words, same speed. The render suite
  // holds the pairs that need no mutation (fp6, fp7); this is the pair that
  // needs somebody to press pause, which is why it lives here.
  {
    const prose = (html) => {
      const body = html.replace(/<template[\s\S]*?<\/template>/g, ' ');
      const hits = new Set();
      for (const m of body.matchAll(/[A-Za-z][A-Za-z0-9 ,.'\u2019\u2014\u2013:;()&!?-]{14,}/g)) {
        const t = m[0].replace(/\s+/g, ' ').trim();
        if (/node:|_next|self\.__next|function |\.js|http|localhost|[0-9a-f]{12}/.test(t)) continue;
        if (!/ [a-z]/.test(t)) continue;
        hits.add(t);
      }
      return [...hits].sort();
    };
    const title = (h) => /<title[^>]*>([^<]*)<\/title>/.exec(h)?.[1];
    // A route's own robots directive rides along in its payload and says which
    // route was typed, not whether anything was there (render suite fp6).
    const METADATA = /^(no)?index[, ]/;
    const paused = await get(`/club/register/cv/${gReg}`, club);
    const nosuch = await get('/fc/no-such-club', club);
    const pa = prose(paused.html); const pn = prose(nosuch.html);
    const diff = [...pa.filter((x) => !pn.includes(x)), ...pn.filter((x) => !pa.includes(x))].filter((x) => !METADATA.test(x));
    check(`p19g: a paused child's registration and a club that never existed answer identically${diff.length ? ` (differs: ${diff.join(' / ')})` : ''}`,
      [paused.status, nosuch.status, title(paused.html) === title(nosuch.html), diff.length,
        pa.includes('This page isn\u2019t here')], [404, 404, true, 0, true]);
    const ms = async (path) => { const t = process.hrtime.bigint(); await get(path, club); return Number(process.hrtime.bigint() - t) / 1e6; };
    const median = (xs) => xs.slice().sort((x, y) => x - y)[Math.floor(xs.length / 2)];
    const a = []; const b = [];
    for (let i = 0; i < 9; i++) { a.push(await ms(`/club/register/cv/${gReg}`)); b.push(await ms('/fc/no-such-club')); }
    const [ma, mb] = [median(a), median(b)];
    check(`p19h: and indistinguishably fast \u2014 ${ma.toFixed(0)}ms vs ${mb.toFixed(0)}ms over 9 runs`,
      Math.abs(ma - mb) < Math.max(40, 0.5 * Math.min(ma, mb)), true);
  }

  await postTo(`/g/controls/${georgia}`, parent, await (pauseForm('false'))());
  check('p19f: switched back on, the links return',
    doorsTo((await get('/club/register', club)).html)?.includes(`/club/register/cv/${gReg}`), true);
}

// A parent's press on /send, kept whole (status, Location, body, every header
// but the date), so the limited press after addr-w can be compared with a
// real one byte for byte (L38; safety review S-2). The record id and the
// page's nonce are the only things allowed to differ.
const parentPress = async (recordId, fields) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const r = await fetch(BASE + `/send/${recordId}`, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(ids.people.alex) } });
  const body = await r.text();
  const norm = (x) => x.split(recordId).join('<record>').replace(/'nonce-[^']+'/g, "'nonce-<per-request>'");
  return { location: (r.headers.get('location') ?? '').replace(BASE, ''),
    shape: JSON.stringify([r.status, norm(r.headers.get('location') ?? ''), norm(body), [...r.headers.entries()].filter(([k]) => k !== 'date').map(([k, v]) => [k, norm(v)])]) };
};
let realParentPress = null;

// ---------------------------------------------------------------------------
// C-P4 · A PARENT SENDS FOR THEIR UNDER-16 THEMSELVES, AND IT IS THE APPROVAL.
// (BUZ, 1 Oct.) From the club page a parent opened Send or Register interest
// for their under-16 and got the child's screen: the request it made came
// back to them by email, to approve. Now the parent's press does it. The
// promise is that it does EXACTLY what that approval did — the same messages
// to the same people, the same consent row, the same link on the parent's
// list, the same row on the club's register — so each path is walked here
// side by side and compared whole: the old one (the child asks, the parent
// approves on /g/send or /g/interest) against the parent's one press. Only
// the approval's own output is compared: the child's ask, and the §20 that
// asks the parent, are what the parent's press removes, and it is checked
// that they are gone.
// ---------------------------------------------------------------------------
{
  const alex = ids.people.alex, deniz = ids.children.deniz;
  const plain = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'").replace(/&rsquo;/g, '’').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
  const post = async (path, who, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(who) } });
    await r.text();
    return (r.headers.get('location') ?? '').replace(BASE, '');
  };
  // The outbox, one card per message — channel, key, address, subject and
  // body — with the minute it was queued taken out.
  const cards = async () => (await get('/dev/outbox', alex)).html.replace(/<script[\s\S]*?<\/script>/g, ' ')
    .split('class="lift"').slice(1).map((c) => plain('<' + c.slice(0, c.indexOf('</pre>'))).replace(/\b\d{2} [A-Z][a-z]{2} \d{2}:\d{2}\b/, ''));
  const fresh = (before, after) => after.filter((c) => !before.includes(c));
  // What differs between two sends by design: the club, its address, and the
  // three secrets minted for each (the link, the stop reference, any undo).
  const norm = (list, club, addr) => list.map((c) => c.split(addr).join('<address>').split(club).join('<club>')
    .replace(/\/p\/[A-Za-z0-9_-]{20,}/g, '/p/<link>').replace(/stop-cvs\?r=[0-9a-f-]{36}&t=[A-Za-z0-9_-]{43}/g, 'stop-cvs?<stop>')
    .replace(/\/undo\/[A-Za-z0-9_-]{20,}/g, '/undo/<undo>')).sort();
  const n = (t, x) => t.split(x).length - 1;

  // ---- Send: Deniz, 14 -------------------------------------------------------
  const sendForm = async (who) => forms((await get(`/send/${deniz.record_id}`, who)).html).find((f) => f.visible.some((v) => v.name === 'clubName'));
  const log = async (kid) => plain((await get(`/g/controls/${kid}`, alex)).html);
  const homeAsks = async () => ((await get('/home', alex)).html.match(/href="\/g\/(send|interest)\/[0-9a-f-]{36}"/g) ?? []).length;
  const SENT = 'Deniz’s CV was sent to a club', ASKED = 'Deniz asked you to send their CV';
  const A = { club: 'Approval Path FC', addr: 'approval@cp4.example.au' }, D = { club: 'Direct Path FC', addr: 'direct@cp4.example.au' };

  const c0 = await cards(), l0 = await log(deniz.child_id);
  await post(`/send/${deniz.record_id}`, deniz.child_id, { ...(await sendForm(deniz.child_id)).fields, clubName: A.club, address: A.addr });
  const c1 = await cards(), l1 = await log(deniz.child_id);
  const ask = /\/g\/send\/([0-9a-f-]{36})/.exec(fresh(c0, c1).find((c) => c.includes(`It goes to: ${A.addr}`)) ?? '')?.[1];
  const gForm = ask ? forms((await get(`/g/send/${ask}`, alex)).html).find((f) => 'requestId' in f.fields) : null;
  const approvedLoc = gForm ? await post(`/g/send/${ask}`, alex, gForm.fields) : '';
  const c2 = await cards(), l2 = await log(deniz.child_id), h2 = await homeAsks();
  const viaApproval = fresh(c1, c2);

  const pForm = await sendForm(alex);
  const direct = await parentPress(deniz.record_id, { ...pForm.fields, clubName: D.club, address: D.addr });
  const directLoc = direct.location;
  realParentPress = direct.shape;
  const c3 = await cards(), l3 = await log(deniz.child_id), h3 = await homeAsks();
  const viaParent = fresh(c2, c3);

  check('C-P4-w0 setup: the old path still works — Deniz asks, the parent is asked by email (§20), and sends it from /g/send',
    [Boolean(ask), n(l1, ASKED) - n(l0, ASKED), approvedLoc, viaApproval.some((c) => c.includes(`doc15.§19 → ${A.addr}`))],
    [true, 1, `/g/send/${ask}?sent=1`, true]);
  check('C-P4-w1: the parent sends their under-16’s CV in one press — it lands on "Sent", and the club gets it (§19)',
    [directLoc, viaParent.some((c) => c.includes(`doc15.§19 → ${D.addr}`))], [`/send/${deniz.record_id}?sent=1`, true]);
  check('C-P4-w2: and the press sends exactly what /g/send’s approval sends — the same messages to the same people, word for word (the club, its address and the link aside)',
    [viaParent.length > 0, norm(viaParent, D.club, D.addr)], [true, norm(viaApproval, A.club, A.addr)]);
  check('C-P4-w3: nobody is asked: no §20, nothing waiting on the parent’s home, and no "Deniz asked you" in the log',
    [viaParent.filter((c) => /It goes to:|doc15\.§20/.test(c)).length, h3 - h2, n(l3, ASKED) - n(l2, ASKED)], [0, 0, 0]);
  check('C-P4-w4: the same consent row as the approval, one "Deniz’s CV was sent to a club" each, and both clubs on the parent’s list of where it went, each with its switch',
    [n(l2, SENT) - n(l1, SENT), n(l3, SENT) - n(l2, SENT), l3.includes(`${A.club} <${A.addr}> Switch off`), l3.includes(`${D.club} <${D.addr}> Switch off`)],
    [1, 1, true, true]);
  const linkIn = (list, addr) => /\/p\/([A-Za-z0-9_-]{20,})/.exec(list.find((c) => c.includes(`doc15.§19 → ${addr}`)) ?? '')?.[1];
  const [pa, pd] = [await get(`/p/${linkIn(viaApproval, A.addr)}`, null), await get(`/p/${linkIn(viaParent, D.addr)}`, null)];
  check('C-P4-w5: and the club opens the same CV from either link',
    [pa.status, pd.status, plain(pd.html) === plain(pa.html), plain(pd.html).includes('Deniz')], [200, 200, true, true]);

  // ---- Register interest: Deniz, 14, on Kingsway Rovers FC's register ------
  // Deniz, not Georgia: H2 (D-170) later counts every "came off a club
  // register" line on Georgia's timeline from zero, and this block takes
  // entries off (L32). Deniz's own H2 ran long before this. Kingsway, not
  // Riverside: sq11 later asks Deniz from Riverside's register.
  const kingsway = ids.clubs['kingsway-rovers'], dana = ids.people.dana;
  const regPath = `/register-interest/${deniz.record_id}?club=${kingsway}`;
  const regIds = async () => [...(await get('/club/register', dana)).html.matchAll(/id="r-([0-9a-f-]{36})"/g)].map((m) => m[1]);
  // A row on the TD's register, and the squad it sits under, with its own id
  // taken out; and the club's view of the CV it opens.
  const rowOf = async (rid) => {
    const h = (await get('/club/register', dana)).html.replace(/<script[\s\S]*?<\/script>/g, ' ');
    const at = h.indexOf(`id="r-${rid}"`);
    if (at < 0) return null;
    const ends = [h.indexOf('id="r-', at + 10), h.indexOf('class="reg-bucket"', at)].filter((x) => x > 0);
    const bucket = /reg-bucket-t">([^<]*)</.exec(h.slice(h.lastIndexOf('class="reg-bucket"', at)))?.[1];
    return [bucket, h.slice(at, Math.min(...ends, at + 6000)).split(rid).join('<registration>')];
  };
  const cvOf = async (rid) => plain((await get(`/club/register/cv/${rid}`, dana)).html).split(rid).join('<registration>');
  const RLOG = 'Deniz went onto a club register';
  const kidForm = forms((await get(regPath, deniz.child_id)).html).find((f) => 'clubId' in f.fields);
  // Kingsway keeps no squads, so there is no squad to choose (C-P8).
  const choice = { positions: 'CM,AM', note: 'Two-footed. Sees the pass early.' };
  // Deniz's live entries on Kingsway's register, as his parent's controls
  // list them: the cards the TD can open (the H2 method).
  const controlsForms = async () => forms((await get(`/g/controls/${deniz.child_id}`, alex)).html);
  const liveAtKingsway = async () => {
    const out = [];
    for (const id of new Set((await controlsForms()).map((f) => f.fields.registrationId).filter(Boolean))) {
      if ((await get(`/club/register/cv/${id}`, dana)).status === 200) out.push(id);
    }
    return out.sort();
  };
  const takeOff = async (rid) => {
    const f = (await controlsForms()).find((x) => x.fields.registrationId === rid);
    return f ? post(`/g/controls/${deniz.child_id}`, alex, f.fields) : '';
  };
  const tdReads = async (list) => Promise.all(list.map(async (id) => (await get(`/club/register/cv/${id}`, dana)).status));

  // The old path, while he is already on Kingsway's register (block 0b, f2):
  // /g/interest has no one-entry rule, so this makes him a second entry.
  const k0 = await liveAtKingsway();
  const r0 = await regIds();
  const g0 = new Set([...(await get('/home', alex)).html.matchAll(/href="\/g\/interest\/([0-9a-f-]{36})"/g)].map((m) => m[1]));
  const kidLoc = await post(regPath, deniz.child_id, { ...kidForm.fields, ...choice });
  const rid = [...(await get('/home', alex)).html.matchAll(/href="\/g\/interest\/([0-9a-f-]{36})"/g)].map((m) => m[1]).find((x) => !g0.has(x));
  const iForm = rid ? forms((await get(`/g/interest/${rid}`, alex)).html).find((f) => 'requestId' in f.fields) : null;
  const gl1 = await log(deniz.child_id), m1 = await cards();
  const iLoc = iForm ? await post(`/g/interest/${rid}`, alex, iForm.fields) : '';
  const r1 = await regIds(), gl2 = await log(deniz.child_id), m2 = await cards(), hi2 = await homeAsks();
  const regA = r1.filter((x) => !r0.includes(x));
  const [rowA, cvA] = [await rowOf(regA[0]), await cvOf(regA[0])];
  check('C-P4-w6 setup: the old path still works — Deniz asks, and the parent registers it from /g/interest (a second entry: he was already on it from the trial)',
    [/asked=1/.test(kidLoc), Boolean(rid), iLoc, regA.length, k0.length > 0, (await liveAtKingsway()).length], [true, true, `/g/interest/${rid}?sent=1`, 1, true, k0.length + 1]);

  // Safety review B-1, the belt: "Take off this register" on ONE card takes
  // him off that club's register, whatever made the other entries.
  const beltLoc = await takeOff(regA[0]);
  check('C-P4-w12: "Take off this register" on one card takes every entry he has at that club off it — the TD can open none of them, and his controls list none',
    [/taken=1/.test(beltLoc), await tdReads([...k0, regA[0]]), await liveAtKingsway()], [true, [...k0, regA[0]].map(() => 404), []]);

  // The parent's one press, now that he is on nobody's register at Kingsway.
  const glBefore = await log(deniz.child_id), mBefore = await cards();
  const parentForm = forms((await get(regPath, alex)).html).find((f) => 'clubId' in f.fields);
  const parentLoc = await post(regPath, alex, { ...parentForm.fields, ...choice });
  const r2 = await regIds(), gl3 = await log(deniz.child_id), m3 = await cards(), hi3 = await homeAsks();
  const regD = r2.filter((x) => !r1.includes(x));

  check('C-P4-w6: the parent puts their under-16 on the register in one press, and the club’s register shows him',
    [parentLoc, regD.length], [`/register-interest/${deniz.record_id}?club=${kingsway}&registered=1`, 1]);
  const rowD = await rowOf(regD[0]);
  check('C-P4-w7: exactly as the approval path does — the same row in the same place on the TD’s register, and the same CV behind it',
    [rowD !== null, rowD, await cvOf(regD[0])], [true, rowA, cvA]);
  check('C-P4-w8: the same consent row as the approval ("Deniz went onto a club register", one each), no message either way, and nothing left waiting on the parent’s home',
    [n(gl2, RLOG) - n(gl1, RLOG), n(gl3, RLOG) - n(glBefore, RLOG), fresh(m1, m2), fresh(mBefore, m3), hi3 - hi2], [1, 1, [], [], 0]);

  // Safety review B-1: pressed again, and once more from Kingsway's trial,
  // he is still on its register once (the player's own rule), and taking
  // that one off ends the TD's access.
  const board = (await get('/trials', alex)).html;
  const trialId = /href="\/fc\/kingsway-rovers\?trial=([0-9a-f-]{36})#play"/.exec(board)?.[1];
  // The TD's invite page names the trial a registration carries.
  const inviteSays = async (rid) => /registered interest in /.test(plain((await get(`/club/invite/${rid}`, dana)).html));
  const trialBefore = await inviteSays(regD[0]);
  const again = await post(regPath, alex, { ...forms((await get(regPath, alex)).html).find((f) => 'clubId' in f.fields).fields, ...choice });
  const trialPath = `${regPath}&trial=${trialId}`;
  const trialForm = trialId ? forms((await get(trialPath, alex)).html).find((f) => 'trialId' in f.fields) : null;
  const fromTrial = trialForm ? await post(trialPath, alex, { ...trialForm.fields, ...choice }) : '';
  const r3 = await regIds();
  check('C-P4-w13: the parent presses twice more, once from the club’s trial — still exactly one live entry, nothing new on the TD’s register, each press landing on "on the register", and the trial now on that one entry',
    [Boolean(trialForm), again, fromTrial, await liveAtKingsway(), r3.filter((x) => !r2.includes(x)), trialBefore, await inviteSays(regD[0])],
    [true, parentLoc, parentLoc, regD, [], false, true]);
  const offLoc = await takeOff(regD[0]);
  check('C-P4-w14: and after "Take off this register" the TD reads nothing — the register CV is gone',
    [/taken=1/.test(offLoc), await tdReads(regD), await liveAtKingsway()], [true, [404], []]);

  // Safety review N-3: a pause that lands between the page and the press.
  // Deniz asks; his parent opens the ask, then pauses him (from another
  // tab, or the other parent does); the press on the open page registers
  // nothing — not even out of sight, to appear when the pause lifts. Pressed
  // again once he is unpaused, it goes, so the refusal was the pause.
  const pauseForm = async (want) => (await controlsForms()).find((f) => f.fields.childId === deniz.child_id && f.fields.paused === want);
  const h0 = new Set([...(await get('/home', alex)).html.matchAll(/href="\/g\/interest\/([0-9a-f-]{36})"/g)].map((m) => m[1]));
  await post(regPath, deniz.child_id, { ...forms((await get(regPath, deniz.child_id)).html).find((f) => 'clubId' in f.fields).fields, ...choice });
  const pausedAsk = [...(await get('/home', alex)).html.matchAll(/href="\/g\/interest\/([0-9a-f-]{36})"/g)].map((m) => m[1]).find((x) => !h0.has(x));
  const openForm = pausedAsk ? forms((await get(`/g/interest/${pausedAsk}`, alex)).html).find((f) => 'requestId' in f.fields) : null;
  const pauseOn = await pauseForm('true');
  if (pauseOn) await post(`/g/controls/${deniz.child_id}`, alex, pauseOn.fields);
  const pressedPaused = openForm ? await post(`/g/interest/${pausedAsk}`, alex, openForm.fields) : '';
  const pauseOff = await pauseForm('false');
  if (pauseOff) await post(`/g/controls/${deniz.child_id}`, alex, pauseOff.fields);
  const afterPause = await liveAtKingsway();
  const pressedLater = openForm ? await post(`/g/interest/${pausedAsk}`, alex, openForm.fields) : '';
  const afterUnpause = await liveAtKingsway();
  check('C-P4-w15: paused between the page and the press, the parent’s press registers nothing, even once the pause lifts; unpaused, the same press does',
    [Boolean(openForm && pauseOn && pauseOff), pressedPaused, afterPause, pressedLater, afterUnpause.length],
    [true, '/home', [], `/g/interest/${pausedAsk}?sent=1`, 1]);
  for (const id of afterUnpause) await takeOff(id);
}

// ---------------------------------------------------------------------------
// 0a · The launch walkthroughs, walked for real (16 Sep).
//
// "Take one off — it stops working, that minute": a parent switches off the
// link ONE club has, and the others keep working. "Post the trial once.
// Change it once": a club edits its own trial, never another club's, and the
// date stays put once families have registered for it.
// ---------------------------------------------------------------------------
{
  const alex = ids.people.alex, marina = ids.people.marina, dana = ids.people.dana;
  const submit = async (path, who, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) for (const one of [].concat(v)) fd.append(k, one);
    const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(who) } });
    await r.text();
    return r.headers.get('location') ?? '';
  };
  const text = (h) => h.replace(/<!-- -->/g, '').replace(/&#x27;|&rsquo;|&#39;|’/g, "'");

  // ---- take one off ------------------------------------------------------
  const child = ids.children.deniz.child_id;
  const ctlPath = `/g/controls/${child}`;
  const ctl0 = (await get(ctlPath, alex)).html;
  const offForms = forms(ctl0).filter((f) => f.fields.tokenId);
  check('to0: every live send on the controls screen can be switched off on its own', offForms.length >= 2, true);
  const live0 = offForms.length;
  // A link another family holds does nothing, and says nothing.
  const nate = ids.children.nate.child_id;
  const theirs = forms((await get(`/g/controls/${nate}`, alex)).html).find((f) => f.fields.tokenId);
  if (theirs) {
    const forged = await submit(ctlPath, alex, { ...offForms[0].fields, tokenId: theirs.fields.tokenId });
    check('to1: another child\'s link id does nothing on this child\'s screen', [/off=1/.test(forged), forms((await get(`/g/controls/${nate}`, alex)).html).filter((f) => f.fields.tokenId).length > 0], [false, true]);
  }
  const done = await submit(ctlPath, alex, offForms[0].fields);
  check('to2: switching one off says so', /off=1/.test(done), true);
  const ctl1 = text((await get(ctlPath, alex)).html);
  check('to3: exactly that one is off — the rest still work', forms(ctl1).filter((f) => f.fields.tokenId).length, live0 - 1);
  check('to4: and the history says one club\'s link was switched off', ctl1.includes("One club's link was switched off"), true);
  const again = await submit(ctlPath, alex, offForms[0].fields);
  check('to5: switching the same one off twice changes nothing more', [/off=1/.test(again), forms((await get(ctlPath, alex)).html).filter((f) => f.fields.tokenId).length], [false, live0 - 1]);

  // ---- change it once ----------------------------------------------------
  const board = async (q) => text((await get(`/trials${q}`, null)).html);
  const postPath = '/club/post-trial';
  const base = { time: '10:00 AM', ground: 'Riverside Park, Pitch 4', how: '', cv_email: 'football@riversidefc.example.au' };
  const action = forms((await get(postPath, marina)).html)[0].fields;
  await submit(postPath, marina, { ...action, ...base, title: 'Changeable sweep trial', trial_on: '2026-11-28', ages: ['U12'], gender: 'boys' });
  const listHtml = (await get(postPath, marina)).html;
  // The Change link sits after the title in the same row.
  const editId = /edit=([0-9a-f-]{36})/.exec(listHtml.slice(listHtml.indexOf('Changeable sweep trial')))?.[1];
  check('ct0: the club sees its posted trial with a way to change it', Boolean(editId) && listHtml.includes('Changeable sweep trial'), true);
  const edited = await submit(postPath, marina, { ...action, ...base, trial_id: editId, title: 'Changed sweep trial', trial_on: '2026-11-29', ages: ['U12', 'U13'], gender: 'girls' });
  check('ct1: a change saves', /updated=1/.test(edited), true);
  check('ct2: and shows on the board, under the new age group and competition', [(await board('?age=U13&gender=girls')).includes('Changed sweep trial'), (await board('')).includes('Changeable sweep trial')], [true, false]);
  // Another club's trial cannot be changed from here.
  const kingsway = [...(await get(postPath, dana)).html.matchAll(/edit=([0-9a-f-]{36})/g)].map((m) => m[1])[0];
  check('ct3: the other club has a trial of its own to test against', Boolean(kingsway), true);
  await submit(postPath, marina, { ...action, ...base, trial_id: kingsway, title: 'Hijacked by another club', trial_on: '2026-12-01', ages: ['U12'] });
  check('ct4: a club cannot change another club\'s trial', (await board('')).includes('Hijacked by another club'), false);
  // Families have registered for Kingsway's trial: its date stays put.
  const danaAction = forms((await get(`${postPath}?edit=${kingsway}`, dana)).html)[0].fields;
  await submit(postPath, dana, { ...danaAction, ...base, trial_id: kingsway, title: 'U16–U18 and Seniors trials', trial_on: '2026-12-20', ages: ['U16', 'U17', 'U18', 'SEN'] });
  check('ct5: once families have registered, the date does not move', [(await board('?age=SEN')).includes('25'), (await board('?age=SEN')).includes('>20<')], [true, false]);

  // D-90, and doc 14 M7 against it (brief K item 5). The register says a
  // VERIFIED club posts its own notice; M7 says an unverified one may. The
  // product follows the register, and this is that, pressed: a claimed club's
  // administrator is sent home from the door, and the verified club's own form,
  // posted in her name, puts nothing on the board. Behaviour unchanged.
  const unverified = ids.people['m.'];
  const door = await fetch(BASE + postPath, { redirect: 'manual', headers: { cookie: cookieFor(unverified) } });
  await door.text();
  const forged = await submit(postPath, unverified, { ...action, ...base, title: 'Quarrymead posts its own trial', trial_on: '2026-11-30', ages: ['U12'] });
  // Brief L: both versions are written, and scripts/rulings.mjs says which
  // one runs. BUZ ruled on 29 Sep that D-90 stands, so this is M7 now; since
  // 0152 the database refuses the forged post as well as the action.
  const d90Facts = [door.status, door.headers.get('location'), forged, (await board('')).includes('Quarrymead posts its own trial')];
  if (RULINGS.M7 === 'doc 14') {
    // Doc 14's version: the door opens for her, and the form she is given
    // puts her notice on the board.
    const own = await get(postPath, unverified);
    const ownForm = forms(own.html)[0];
    const posted = ownForm ? await submit(postPath, unverified, { ...ownForm.fields, ...base, title: 'Quarrymead posts its own trial', trial_on: '2026-11-30', ages: ['U12'] }) : '';
    check('M7: an unverified club posts a trial notice through "Post a trial", and it reaches the board (doc 14 M7, as BUZ ruled)',
      [own.status, Boolean(ownForm), /posted=1/.test(posted), (await board('')).includes('Quarrymead posts its own trial')], [200, true, true, true]);
  } else if (RULINGS.M7 === 'D-90') {
    check('M7: an unverified club is sent home from "Post a trial", and a notice posted in its name reaches no board (D-90, as BUZ ruled)',
      d90Facts, [307, '/home', '/home', false]);
  } else {
    check('d90-w1: an unverified club is sent home from "Post a trial", and a notice posted in its name reaches no board (D-90; doc 14 M7 says otherwise — awaiting BUZ, scripts/rulings.mjs)',
      d90Facts, [307, '/home', '/home', false]);
  }
}

// ---------------------------------------------------------------------------
// 0b · D-68 as amended 16 Sep — a trial names every age group it is for.
//
// A trial a club posted used to record no age group and no gender, so the
// board's filters could never find it. Posted through the real form: two age
// groups and a gender, found under both; positions checked against the ten;
// and a notice with no age group is refused rather than posted unfindable.
// ---------------------------------------------------------------------------
{
  const td = ids.people.marina;
  const postIt = async (extra) => {
    const form = forms((await get('/club/post-trial', td)).html)[0];
    const fd = new FormData();
    for (const [k, v] of Object.entries(form?.fields ?? {})) fd.append(k, v);
    for (const [k, v] of Object.entries(extra)) for (const one of [].concat(v)) fd.append(k, one);
    const r = await fetch(BASE + '/club/post-trial', { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(td) } });
    await r.text();
    return r.headers.get('location') ?? '';
  };
  const base = { trial_on: '2026-11-21', time: '9:00 AM', ground: 'Riverside Park, Pitch 3', how: '', cv_email: 'football@riversidefc.example.au' };
  const board = async (q) => (await get(`/trials${q}`, null)).html;

  const ok = await postIt({ ...base, title: 'Agegroup sweep U12 and U13 trial', ages: ['U12', 'U13'], gender: 'boys', positions: ['gk', 'CAM', 'ST'] });
  check('ag1: a trial posted with two age groups goes up', /posted=1/.test(ok), true);
  check('ag2: and is found under the first', (await board('?age=U12')).includes('Agegroup sweep U12 and U13'), true);
  check('ag3: and under the second', (await board('?age=U13')).includes('Agegroup sweep U12 and U13'), true);
  check('ag4: and under its competition, and not another', [
    (await board('?gender=boys')).includes('Agegroup sweep U12 and U13'),
    (await board('?gender=girls')).includes('Agegroup sweep U12 and U13')], [true, false]);
  check('ag5: a position typed in lower case still counts, alongside the others',
    [(await board('?pos=GK')).includes('Agegroup sweep U12 and U13'), (await board('?pos=ST')).includes('Agegroup sweep U12 and U13')], [true, true]);

  const none = await postIt({ ...base, title: 'Agegroup sweep with no age group', gender: 'girls' });
  check('ag6: a trial with no age group is sent back to say why', /error=ages/.test(none), true);
  check('ag7: and was never posted', (await board('')).includes('Agegroup sweep with no age group'), false);
  const forged = await postIt({ ...base, title: 'Agegroup sweep forged', ages: ['U99', "'; drop table trial_notice; --"] });
  check('ag8: an age group not in the lookup is refused, not stored', [/error=ages/.test(forged), (await board('')).includes('Agegroup sweep forged')], [true, false]);
}

// ---------------------------------------------------------------------------
// 0c · D-154 AND B5a — WALKED THROUGH THE REAL SCREENS.
//
// A TD brings a coach in; the answer does not say whether the email is a
// Pitch account; the coach accepts on their own home screen and reads their
// team; the TD removes them and it is gone. And an invitation carrying a
// phone number comes back to the club with the reason, and never sends.
// ---------------------------------------------------------------------------
{
  const td = ids.people.marina, sam = ids.people.sam;
  const postForm = async (path, who, form, extra = {}) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(form?.fields ?? {})) fd.append(k, v);
    for (const [k, v] of Object.entries(extra)) {
      for (const one of [].concat(v)) fd.append(k, one);
    }
    const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(who) } });
    await r.text();
    return { status: r.status, location: r.headers.get('location') ?? '' };
  };
  const strip = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&rsquo;|&#39;/g, "'").replace(/\s+/g, ' ');

  // ---- B5a: the message is not a channel --------------------------------
  const regHtml = (await get('/club/register', td)).html;
  const inviteId = /href="\/club\/invite\/([0-9a-f-]{36})"[^>]*>Invite to trial</.exec(regHtml)?.[1];
  check('b5a0: the TD has someone on the register to invite', Boolean(inviteId), true);
  const compose = (await get(`/club/invite/${inviteId}`, td)).html;
  const sendForm = forms(compose).find((f) => f.fields.registrationId === inviteId);
  const messages = async () => (strip((await get('/dev/outbox', td)).html).match(/doc15\.§/g) ?? []).length;
  const box0 = await messages();
  const bad = await postForm(`/club/invite/${inviteId}`, td, sendForm, { kind: 'trial', body: 'Ring me on 0412 345 678 about the trial' });
  check('b5a1: a message carrying a phone number comes back to the invite screen', /\/club\/invite\/[0-9a-f-]{36}\?cannot=1/.test(bad.location), true);
  check('b5a2: which says why, instead of an error page',
    strip((await get(`/club/invite/${inviteId}?cannot=1`, td)).html).includes('Take out the link, email address or phone number'), true);
  const regAfter = (await get('/club/register', td)).html;
  check('b5a3: and nothing was sent — the family still reads "Invite to trial", and the outbox is unchanged',
    [new RegExp(`href="/club/invite/${inviteId}"[^>]*>Invite to trial<`).test(regAfter),
     (await messages()) === box0], [true, true]);

  // ---- D-154: a TD brings a coach in ------------------------------------
  const squadsHtml = (await get('/club/squads', td)).html;
  const bringForm = forms(squadsHtml).find((f) => f.visible.some((v) => v.name === 'wwcc'));
  check('c0: the TD has a form to bring a coach in', Boolean(bringForm), true);
  const teamIds = [...squadsHtml.matchAll(/<input[^>]*name="squadIds"[^>]*>/g)].map((m) => ({
    id: /value="([0-9a-f-]{36})"/.exec(m[0])?.[1], name: /aria-label="([^"]+)"/.exec(m[0])?.[1],
  }));
  const u13g = teamIds.find((t) => t.name === 'U13 Girls');
  const ghost = await postForm('/club/squads', td, bringForm, { email: 'nobody-here@example.com', squadIds: [u13g.id], wwcc: 'on' });
  const real = await postForm('/club/squads', td, bringForm, { email: 'coach@example.com', squadIds: [u13g.id], wwcc: 'on' });
  check('c1: an email with no account and a real coach get the identical answer (N24)', [ghost.status, ghost.location], [real.status, real.location]);
  check('c1b: and it is the "if that is a coach" answer', /coachAsked=1/.test(real.location), true);
  // B1's second half (0056, L21): an account carrying a coach's address that
  // nobody has proved is not that coach. The club is told the same thing it
  // is told for an address with no account, so a real coach's address cannot
  // be used to find out whether they are on Pitch. That no row is written is
  // asserted against the action's own SQL in the permission suite (coach2).
  const parked = await postForm('/club/squads', td, bringForm, { email: 'unproved.coach@example.com', squadIds: [u13g.id], wwcc: 'on' });
  check('c1c (B1): an address with a coach account nobody has proved gets that identical answer too',
    [parked.status, parked.location], [ghost.status, ghost.location]);
  const noCheck = await postForm('/club/squads', td, bringForm, { email: 'coach@example.com', squadIds: [u13g.id] });
  check('c2: without the WWCC confirmation nothing is asked', /coachError=1/.test(noCheck.location), true);
  const tooMany = await postForm('/club/squads', td, bringForm, { email: 'coach@example.com', squadIds: teamIds.slice(0, 4).map((t) => t.id), wwcc: 'on' });
  check('c2b: nor for more than three teams', /coachError=1/.test(tooMany.location), true);

  const samHome = (await get('/home', sam)).html;
  check('c3: the coach sees the club’s request on their own home screen', strip(samHome).includes('wants you as their coach for U13 Girls'), true);
  // Spec A (coach), Head of Product Design 1 Oct: accepting joins the coach
  // to a club, so Accept and Not now take D-PD-0's equal weight — the same
  // secondary, still the forms they were — and the one glow stays on Edit my
  // coach CV, with or without an invitation.
  {
    const m = samHome.replace(/<script[\s\S]*?<\/script>/g, ' ');
    check('hm-w1: the coach’s invitation answers are the same secondary, and the glow stays on Edit my coach CV',
      [[...m.matchAll(/<button type="submit" class="([^"]*)"[^>]*>(Accept|Not now)</g)].map((x) => `${x[2]}|${x[1]}`),
       [...m.matchAll(/class="[^"]*\bfl-glow\b[^"]*"[^>]*>([^<]*)</g)].map((x) => x[1])],
      [['Accept|btn btn-secondary', 'Not now|btn btn-secondary'], ['Edit my coach CV']]);
  }
  const acceptForm = forms(samHome).find((f) => f.fields.answer === 'accept');
  await postForm('/home', sam, acceptForm);
  check('c4: accepted, the new team is on their registrations page',
    strip((await get('/coach/register', sam)).html).includes('U13 Girls'), true);
  check('c4b: and the TD sees who reads the register', strip((await get('/club/squads', td)).html).includes('U13 Girls'), true);

  const revokeForm = forms((await get('/club/squads', td)).html).find((f) => f.fields.personId === sam);
  await postForm('/club/squads', td, revokeForm);
  check('c5: the TD removes the coach — the registrations page is gone at once', (await get('/coach/register', sam)).status, 307);
  check('c5b: and the Registrations door leaves their home screen', /href="\/coach\/register"/.test((await get('/home', sam)).html), false);

  // ---- doc 15 §12: "You're verified", once, the first time a club attests --
  const box = async () => strip((await get('/dev/outbox', td)).html).replace(/&#x27;|&rsquo;|’/g, "'");
  const verifiedTo = (text, club) => (text.match(new RegExp(`${club} has confirmed your Working With Children Check`, 'g')) ?? []).length;
  check('v12a: Riverside had already attested Sam, so accepting again sent no "You\'re verified"',
    verifiedTo(await box(), 'Riverside FC'), 0);

  const dana = ids.people.dana;
  const addForm = forms((await get('/club/squads', dana)).html).find((f) => f.visible.some((v) => v.name === 'ageGroup'));
  await postForm('/club/squads', dana, addForm, { name: 'Kingsway Seniors', ageGroup: 'SEN', gender: 'men', season: '2026' });
  const kHtml = (await get('/club/squads', dana)).html;
  const kTeam = /<input[^>]*name="squadIds"[^>]*value="([0-9a-f-]{36})"/.exec(kHtml)?.[1];
  const kBring = forms(kHtml).find((f) => f.visible.some((v) => v.name === 'wwcc'));
  await postForm('/club/squads', dana, kBring, { email: 'coach@example.com', squadIds: [kTeam], wwcc: 'on' });
  const kAccept = forms((await get('/home', sam)).html).find((f) => f.fields.answer === 'accept');
  await postForm('/home', sam, kAccept);
  const after = await box();
  check('v12b: a club attesting Sam for the first time sends "You\'re verified" once, naming that club',
    [(after.match(/doc15\.§12\s*→\s*coach@example\.com/g) ?? []).length, verifiedTo(after, 'Kingsway Rovers FC') > 0], [1, true]);
  check('v12c: and it promises nothing Stage 2 delivers', /development record/i.test(after.slice(after.indexOf('Kingsway Rovers FC has confirmed'), after.indexOf('Kingsway Rovers FC has confirmed') + 400)), false);
}

// ---------------------------------------------------------------------------
// A coach publishes their page, takes it down, and gets the same link back
// (D-75, D-100; 0043). Robin is an adult with no coach page yet. Nate is 17,
// and a coach page is an adult's page (0042, D-100 amended 17 Sep).
// ---------------------------------------------------------------------------
{
  const robin = ids.people.robin, nate = ids.children.nate.child_id;
  const send = async (who, form) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(form.fields)) fd.append(k, v);
    const r = await fetch(BASE + '/coach/edit', { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(who) } });
    await r.text();
    return r.headers.get('location') ?? '';
  };
  const formFor = async (who, label) => forms((await get('/coach/edit', who)).html).find((f) => f.submit === label);
  const slugOf = (html) => /pitchfootball\.com\.au\/c\/([a-z0-9-]+)/.exec(html)?.[1];

  const publish = await formFor(robin, 'Publish my page');
  check('cp1: an adult with no page is offered Publish my page', Boolean(publish), true);
  check('cp2: publishing says so', /published=1/.test(await send(robin, publish)), true);
  const edit1 = (await get('/coach/edit', robin)).html;
  const slug = slugOf(edit1);
  check(`cp3: the address is made from their name (${slug})`, slug, 'robin-newman');
  check('cp4: and it opens for anyone', (await get(`/c/${slug}`, null)).status, 200);
  check('cp5: their home shows the link to copy', slugOf((await get('/home', robin)).html), slug);

  const down = await formFor(robin, 'Take my page down');
  check('cp6: a published page can be taken down', /hidden=1/.test(await send(robin, down)), true);
  check('cp7: and then it does not open', (await get(`/c/${slug}`, null)).status, 404);
  check('cp8: nor does its print view', (await get(`/c/${slug}/print`, null)).status, 404);
  check('cp9: and home no longer offers the link', slugOf((await get('/home', robin)).html), undefined);

  await send(robin, await formFor(robin, 'Publish my page'));
  check('cp10: publishing again brings back the SAME link (D-100: stable)', slugOf((await get('/coach/edit', robin)).html), slug);
  check('cp11: and it opens again', (await get(`/c/${slug}`, null)).status, 200);

  const teen = (await get('/coach/edit', nate)).html;
  check('cp12: a 17-year-old is not offered Publish my page', /Publish my page/.test(teen), false);
  check('cp13: and is told when it opens', /once you turn 18/.test(teen.replace(/&rsquo;/g, "'")), true);
  // Posting the publish action anyway, with an adult's form, changes nothing.
  await send(nate, publish);
  check('cp14: a 17-year-old who posts it anyway gets no page', slugOf((await get('/coach/edit', nate)).html), undefined);
}

// ---------------------------------------------------------------------------
// A parent approves from inside another app's browser, and can get in
// afterwards (doc 08 step 3; D-17). Two channels (D-156): the texted link
// and the emailed link each need "Yes, it's me" pressed. A guardian is an
// adult (D-155). Mila's invitation is the seeded one, with known dev links.
// Every request carries Instagram's in-app User-Agent and no cookie.
// ---------------------------------------------------------------------------
{
  const inv = ids.pendingInvitation;
  const TEXT = 'dev-mila-text', EMAIL = 'dev-mila-email';
  const IG = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 339.0.3.12.108';
  const ig = async (path, init = {}) => {
    const r = await fetch(BASE + path, { redirect: 'manual', ...init, headers: { 'user-agent': IG, ...(init.headers ?? {}) } });
    return { status: r.status, location: r.headers.get('location') ?? '', cookie: r.headers.get('set-cookie') ?? '', html: await r.text() };
  };
  const post = async (path, form, extra = {}) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(form.fields)) fd.append(k, v);
    for (const [k, v] of Object.entries(extra)) fd.append(k, v);
    return ig(path, { method: 'POST', body: fd });
  };
  const plain = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&rsquo;|&#39;/g, "'").replace(/\s+/g, ' ');
  const formWith = (html, re) => forms(html).find((f) => re.test(f.submit));
  // The approval codes on /dev/outbox, newest first, each one ONCE.
  //
  // The dedupe is the whole point. Since 23 Sep that page renders every
  // pitchfootball.com.au address in a body as a link to the same path on this
  // host as well as leaving the address in the text, so one message now yields
  // the same code twice. The two tests below want "the two newest MESSAGES",
  // took the first two matches, and silently got one message twice — which
  // confirms one channel, leaves the other unconfirmed, and makes a suite
  // about held sign-ups fail on a page that renders links. A test that reads a
  // screen is coupled to that screen: when the screen changes, the reader is
  // what has to move. (L32.)
  const approvalCodes = (html) => [...new Set([...html.matchAll(/\/a\/([A-Za-z0-9_-]{20,})/g)].map((m) => m[1]))];

  // --- B2: somebody else got here first ---------------------------------------
  // The seed has an account already sitting on Mila's parent's address, with a
  // real password on it, set by whoever typed the address in (safety review
  // B2, L21). Before the approval it opens nothing; after it, it opens nothing
  // ever again, and the parent's own password (ia11/ia12) is the only one.
  const signinFormNow = async () => formWith((await ig('/signin')).html, /^Sign in$/);
  const parkedBefore = await post('/signin', await signinFormNow(),
    { email: 'priya@example.com', password: 'parked-password-1234' });
  check('b2a: a password somebody else set on this address signs nobody in — the address was never proved',
    /pitch_session=[^;]+\./.test(parkedBefore.cookie), false);

  // --- D-156: opening confirms nothing; a press confirms one channel ----------
  const text1 = await ig(`/a/${TEXT}`);
  check('ia1: the texted link opens inside Instagram, signed out', text1.status, 200);
  await ig(`/a/${TEXT}`); await ig(`/a/${EMAIL}`); await ig(`/a/${EMAIL}`);
  const text2 = await ig(`/a/${TEXT}`);
  check('ia2: opening both links (twice) confirms nothing: no approve button, only "Yes, it\'s me"',
    Boolean(formWith(text2.html, /Yes, it/)) && !formWith(text2.html, /Approve/), true);
  const byId = await ig(`/a/${inv}`);
  check('ia2b: reached by the invitation id, the page carries no channel and no button', forms(byId.html).length, 0);
  check('ia2c: no approval page ever shows the parent\'s email or phone',
    [text1.html, text2.html, byId.html].some((h) => /priya@example\.com|0412 345 678/.test(h)), false);

  await post(`/a/${TEXT}`, formWith(text2.html, /Yes, it/));
  const text3 = await ig(`/a/${TEXT}`);
  check('ia2d: after pressing on the texted link: "One more step", and still no approve',
    /One more step/.test(plain(text3.html)) && /emailed to you/.test(plain(text3.html)) && !formWith(text3.html, /Approve/), true);
  const email1 = await ig(`/a/${EMAIL}`);
  check('ia2e: the emailed link still asks for its own press', Boolean(formWith(email1.html, /Yes, it/)), true);
  await post(`/a/${EMAIL}`, formWith(email1.html, /Yes, it/));
  const email2 = await ig(`/a/${EMAIL}`);
  const approveForm = formWith(email2.html, /Approve/);
  check('ia2f: with both pressed, the approve button appears, with the 18-or-over declaration',
    Boolean(approveForm) && /name="adult"/.test(email2.html) && /18 or over/.test(plain(email2.html)), true);

  // D-PD-0 (BUZ, 1 Oct): approving is the charter secondary, and nothing on
  // the page glows; the no-answer sits beside it in its own element, not as
  // an 11.5px footnote under a green button. The press before it ("Yes, it's
  // me") gives nothing away and keeps the one glow.
  {
    const mk = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '');
    check('pd-a1: with both channels pressed, Approve is the charter secondary, no primary or glow renders, and the no-line has its own element',
      [/<button type="submit" class="btn btn-secondary">Approve this page<\/button>/.test(mk(email2.html)), /btn-primary|fl-glow/.test(mk(email2.html)),
       /<div>Not ready\? Do nothing\. If you don.t approve, all of this is deleted after 14 days\.<\/div>/.test(mk(email2.html).replace(/&#x27;|&rsquo;/g, "'"))],
      [true, false, true]);
    check('pd-a1b: and "Yes, it\'s me" is the screen\'s one glowing primary',
      (mk(email1.html).match(/class="btn btn-primary fl-glow"[^>]*>Yes, it/g) ?? []).length, 1);
  }

  // --- D-155: the declaration is required ------------------------------------
  const noDecl = await post(`/a/${EMAIL}`, approveForm);
  check('ia2g: approving without the 18-or-over tick approves nothing', /\?adult=1/.test(noDecl.location), true);
  // D-PD-4 (1 Oct): an unapproved invitation's done page is a link that opens
  // nothing — LinkState's words at 200, not the root 404 — and no family page.
  const notYet = await ig(`/a/${inv}/done`);
  check('ia2h: and the invitation is still waiting — its done page opens nothing, and shows no family',
    [notYet.status, /This link doesn.t open anything/.test(plain(notYet.html)), /Your children/.test(plain(notYet.html))], [200, true, false]);

  const done = await post(`/a/${EMAIL}`, approveForm, { adult: 'on' });
  check('ia3: with it, approving works, with no JavaScript and no cookie', /\/a\/[0-9a-f-]+\/done/.test(done.location), true);
  // D-PD-4: finished means LinkState's words at 200, no form, and the two
  // links identical — never the root 404's "may have been taken down".
  const finText = await ig(`/a/${TEXT}`), finEmail = await ig(`/a/${EMAIL}`);
  const noScript = (h) => plain(h.replace(/<script[\s\S]*?<\/script>/g, ' '));
  // B1 / F3 (BUZ, 1 Oct): the child's waiting page after the approval is its
  // own state — not the root 404's "taken down", and not the closed state.
  const waitingApproved = await ig(`/join/waiting/${inv}`);
  check('jr-wait-w1: after approval the child’s waiting page says their parent said yes and builds the page — never "closed", never "taken down"',
    [waitingApproved.status, /Your parent said yes\./.test(plain(waitingApproved.html)),
     /They build your page from their account, so ask them to start it with you\./.test(plain(waitingApproved.html)),
     /This request has closed|taken down/.test(noScript(waitingApproved.html))],
    [200, true, true, false]);
  check('ia3b: and both links are finished — the same page, opening nothing, with no form',
    [finText.status, finEmail.status, /This link doesn.t open anything/.test(plain(finText.html)), forms(finText.html).length + forms(finEmail.html).length,
     /taken down/.test(noScript(finText.html)), noScript(finText.html) === noScript(finEmail.html)],
    [200, 200, true, 0, false, true]);

  const parkedAfter = await post('/signin', await signinFormNow(),
    { email: 'priya@example.com', password: 'parked-password-1234' });
  check('b2b: and the approval takes the account off them — that password now opens nothing at all',
    /pitch_session=[^;]+\./.test(parkedAfter.cookie), false);

  const landing = await ig(`/a/${inv}/done`);
  check('ia4: the landing names the app the parent is inside', /data-in-app="Instagram"/.test(landing.html), true);
  check('ia5: and offers Safari, with the link to copy', /x-safari-http/.test(landing.html) && /Copy the link/.test(landing.html), true);
  check('ia6: the landing never shows the parent\'s email address', /priya@example\.com/.test(landing.html), false);
  check('ia7: and has no dead buttons: the next step is a real one', /Email me the link/.test(landing.html) && !/>Manage</.test(landing.html), true);

  const setup = formWith(landing.html, /Email me the link/);
  const sentTo = await post(`/a/${inv}/done`, setup);
  check('ia8: asking for the link says it is on its way', /sent=1/.test(sentTo.location), true);
  const box = plain((await get('/dev/outbox', ids.people.alex)).html);
  const token = /\/reset\/([A-Za-z0-9_-]{20,})/.exec(box)?.[1];
  check('ia9: a NEW parent (no date of birth on file) gets the set-a-password email, to their own address',
    Boolean(token) && /priya@example\.com/.test(box), true);
  check('ia9b: and it is doc 15 §10a, naming the child they approved, not the reset email that reads like phishing',
    /Set your Pitch password/.test(box) && /You approved Mila's football page/.test(box) && !/Someone asked to reset/.test(box), true);

  const resetPage = await ig(`/reset/${token}`);
  check('ia10: the emailed link says it is inside an app too', /data-in-app="Instagram"/.test(resetPage.html), true);
  await ig(`/reset/${token}`);
  const pw = formWith(resetPage.html, /Save it/);
  const saved = await post(`/reset/${token}`, pw, { password: 'parent-password-2468' });
  check('ia11: opening the link did not use it up; setting the password works', /signin\?reset=1/.test(saved.location), true);
  const signinForm = formWith((await ig('/signin')).html, /^Sign in$/);
  const signedIn = await post('/signin', signinForm, { email: 'priya@example.com', password: 'parent-password-2468' });
  const home = await fetch(BASE + '/home', { headers: { cookie: signedIn.cookie.split(';')[0] } });
  check('ia12: and the parent is in, looking at their child', /Mila/.test(await home.text()), true);
  // F7 (BUZ, 1 Oct): Claim pressed signed out → the sign-in door carries the
  // club, and signing in lands on that club's claim page. Only a club slug
  // travels: anything else goes home as before, and a refusal keeps the club
  // on the door without saying why it refused (D-94 §2).
  const claimDoor = formWith((await ig('/signin?claim=westgate-rangers')).html, /^Sign in$/);
  const viaClaim = await post('/signin', claimDoor, { email: 'priya@example.com', password: 'parent-password-2468' });
  const viaBad = await post('/signin', signinForm, { email: 'priya@example.com', password: 'parent-password-2468', claim: '//evil.example/x' });
  const refusedClaim = await post('/signin', claimDoor, { email: 'nobody-f7@example.com', password: 'not-a-password-1' });
  check('f7-w1: signing in from a club\u2019s Claim lands on its claim page; a value that is not a slug goes home; a refusal keeps the club on the door',
    [claimDoor?.fields.claim, viaClaim.location.endsWith('/claim/westgate-rangers'), viaBad.location.endsWith('/home'), refusedClaim.location.endsWith('/signin?refused=1&claim=westgate-rangers')],
    ['westgate-rangers', true, true, true]);
  check('ia13: the landing now says sign in, not set a password', /href="\/signin"/.test((await ig(`/a/${inv}/done`)).html), true);
  const resetForm = formWith((await ig('/reset')).html, /reset link/);
  await post('/reset', resetForm, { email: 'priya@example.com' });
  const box2 = plain((await get('/dev/outbox', ids.people.alex)).html);
  check('ia13b: once the parent has a password, a reset is the ordinary §10 email again',
    box2.indexOf('Reset your Pitch password') > -1 && box2.indexOf('Reset your Pitch password') < box2.indexOf('Set your Pitch password'), true);
  check('ia14: "No password yet? Email me a link" is a real link now, not a second submit on the password form',
    /href="\/reset"[^>]*>No password yet/.test((await ig('/signin')).html), true);

  // --- The sign-up forms live in a client component, so their action ids
  //     come from Next's own manifest, and they post exactly as a
  //     no-JavaScript form would. ------------------------------------------
  await get('/join', null);
  const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../.next/dev/server/server-reference-manifest.json', import.meta.url)), 'utf8'));
  const actionId = (name) => Object.entries(manifest.node).find(([, v]) => v.filename === 'app/join/actions.ts' && v.exportedName === name)?.[0];
  // Every door now asks the country first (D-63, D-164): a form that came
  // through it carries country=AU, so every sign-up below does too.
  const joinPost = (name, fields) => post('/join', { fields: { [`$ACTION_ID_${actionId(name)}`]: '', country: 'AU' } }, fields);
  check('ia15: the sign-up actions are found', Boolean(actionId('startPendingInvitation') && actionId('createAccount')), true);

  // --- D-63 / D-164 (3): Australia only, asked of the server too ------------
  // A sign-up that did not come through the country step — a script, a stale
  // page, "Somewhere else" worked around — makes nothing: no invitation, no
  // account, no message to anybody, whatever the age.
  {
    const bare = (name, fields) => post('/join', { fields: { [`$ACTION_ID_${actionId(name)}`]: '' } }, fields);
    const kid = await bare('startPendingInvitation', { firstName: 'Nomad', dob: '2014-04-04', guardianName: 'Far Away', guardianPhone: '0400 555 666', guardianEmail: 'nomad.parent@example.com' });
    const adult = await bare('createAccount', { firstName: 'Nomad', dob: '1990-04-04', email: 'nomad@example.com', password: 'nomad-password-123' });
    const coach = await bare('createCoachAccount', { firstName: 'Nomad', lastName: 'Coach', dob: '1985-04-04', email: 'nomad.coach@example.com', password: 'nomad-password-123' });
    const club = await bare('createClubAccount', { firstName: 'Nomad', lastName: 'Club', dob: '1980-04-04', email: 'nomad.club@example.com', password: 'nomad-password-123' });
    const elsewhere = await bare('createAccount', { country: 'NZ', firstName: 'Kiwi', dob: '1990-05-05', email: 'kiwi@example.com', password: 'kiwi-password-1234' });
    check('ctry-w1: every door refuses a sign-up that did not say Australia, and goes back to the country question',
      [kid, adult, coach, club, elsewhere].map((r) => r.location.replace(BASE, '')), ['/join', '/join', '/join', '/join', '/join']);
    const after = (await get('/dev/outbox', ids.people.alex)).html;
    check('ctry-w2: and it collected nothing — no message went to any address it was given',
      /nomad|kiwi/i.test(after), false);
  }

  // --- D-157: a parent email is required -------------------------------------
  const noEmail = await joinPost('startPendingInvitation', { firstName: 'Noah', dob: '2014-02-02', guardianName: 'No Email', guardianPhone: '0400 111 222' });
  check('D-157: an under-16 sign-up without a parent email is refused', /\/join\?error=1/.test(noEmail.location), true);

  // --- D-155: the named email belongs to a 17-year-old -> held, unseen -------
  const heldJoin = await joinPost('startPendingInvitation', {
    firstName: 'Zed', dob: '2014-03-03', guardianName: 'Not A Parent', guardianPhone: '0400 333 444', guardianEmail: 'nate@example.com',
  });
  const heldId = /\/join\/waiting\/([0-9a-f-]{36})/.exec(heldJoin.location)?.[1];
  check('D-155: the sign-up itself looks ordinary', Boolean(heldId), true);
  const outbox = (await get('/dev/outbox', ids.people.alex)).html;
  const zedLinks = approvalCodes(outbox).slice(0, 2); // the two newest messages are Zed's
  for (const code of zedLinks) {
    const pg = await ig(`/a/${code}`);
    const yes = formWith(pg.html, /Yes, it/);
    if (yes) await post(`/a/${code}`, yes);
  }
  const zedPage = await ig(`/a/${zedLinks[0]}`);
  const zedApprove = formWith(zedPage.html, /Approve/);
  check('D-155: both of Zed\'s links confirmed, the approve button shows as usual', Boolean(zedApprove), true);
  const heldDone = zedApprove ? await post(`/a/${zedLinks[0]}`, zedApprove, { adult: 'on' }) : { location: '' };
  check('D-155: "approving" for a 17-year-old lands on the same done page', heldDone.location, `/a/${heldId}/done`);
  const heldLanding = plain((await ig(`/a/${heldId}/done`)).html);
  check('D-155: which reads exactly like an approval', /Approved by you on/.test(heldLanding) && /Email me the link/.test(heldLanding), true);
  // D-PD-4 (1 Oct): a finished approval link is one page whatever finished it
  // — approved (Mila's), held (Zed's) or never a link — said in LinkState's
  // words at 200. A held link that read differently from an approved one
  // would tell a stranger which it was (D-155).
  {
    const vis = (h) => plain(h.replace(/<script[\s\S]*?<\/script>/g, ' '));
    const four = [await ig(`/a/${zedLinks[0]}`), await ig(`/a/${zedLinks[1]}`), await ig(`/a/${TEXT}`), await ig('/a/no-such-approval-code')];
    check('dfx-PD-4: approved, held and never-existed /a/ links answer 200 with one identical body, in the dead-link words, with no form',
      [four.map((r) => r.status), new Set(four.map((r) => vis(r.html))).size, /This link doesn.t open anything/.test(vis(four[0].html)),
       four.reduce((n, r) => n + forms(r.html).length, 0), /taken down/.test(vis(four[0].html))],
      [[200, 200, 200, 200], 1, true, 0, false]);
  }
  const nateHome = plain((await get('/home', ids.children.nate.child_id)).html);
  check('D-155: and the 17-year-old is nobody\'s guardian', /Zed/.test(nateHome), false);
  const opsView = plain((await get(`/ops/support?q=${encodeURIComponent('nate@example.com')}`, ids.people.marina)).html);
  check('D-155: an operator sees the hold', /Held/.test(opsView) && /Zed/.test(opsView), true);
  const beforeSetup = (outbox.match(/Reset your Pitch password/g) ?? []).length;
  const heldSetup = formWith((await ig(`/a/${heldId}/done`)).html, /Email me the link/);
  const heldSent = await post(`/a/${heldId}/done`, heldSetup);
  const afterSetup = ((await get('/dev/outbox', ids.people.alex)).html.match(/Reset your Pitch password/g) ?? []).length;
  check('D-155: "Email me the link" answers the same and sends nothing to the named account',
    [/sent=1/.test(heldSent.location), afterSetup - beforeSetup], [true, 0]);

  // --- D-PD-3 (John, BUZ, 1 Oct): a parent's "No", pressed as a parent
  //     presses it, inside Instagram, no cookie, no JavaScript. -------------
  {
    const label = /const PD3_END_LABEL = '([^']*)';/.exec(readFileSync(fileURLToPath(new URL('../app/a/[id]/page.tsx', import.meta.url)), 'utf8'))?.[1];
    const vis = (h) => plain(h.replace(/<script[\s\S]*?<\/script>/g, ' '));
    const hasNo = (h) => vis(h).includes(label);
    const outboxCount = async () => ((await get('/dev/outbox', ids.people.alex)).html.match(/doc15\.§/g) ?? []).length;
    // The No's own action, from Next's manifest: before a channel is
    // confirmed the page does not render it, and a crafted press is exactly
    // what condition 1 is about.
    const endAction = Object.entries(JSON.parse(readFileSync(fileURLToPath(new URL('../.next/dev/server/server-reference-manifest.json', import.meta.url)), 'utf8')).node)
      .find(([, v]) => v.filename === 'app/a/[id]/actions.ts' && v.exportedName === 'endRequest')?.[0];
    const crafted = (code) => post(`/a/${code}`, { fields: { [`$ACTION_ID_${endAction}`]: '', code } });

    const odette = await joinPost('startPendingInvitation', { firstName: 'Odette', dob: '2014-06-06', guardianName: 'Ola Parent', guardianPhone: '0400 818 181', guardianEmail: 'ola.parent@example.com' });
    const odetteId = /\/join\/waiting\/([0-9a-f-]{36})/.exec(odette.location)?.[1];
    const [oA, oB] = approvalCodes((await get('/dev/outbox', ids.people.alex)).html).slice(0, 2);
    const fresh = [await ig(`/a/${oA}`), await ig(`/a/${oB}`)];
    const refused = [await crafted(odetteId)];
    const after = await ig(`/a/${oA}`);
    // MOVED with F15 (John, 1 Oct): before either channel is confirmed both
    // links now offer the No (it was [false, false]), and a press on a link is
    // no longer refused — jb-f15-w1 presses one. What is still refused is the
    // crafted press with the invitation id the child holds, and opening a link
    // still ends nothing.
    check('jr-pd3-w1: before either channel is confirmed both links offer the No, and a crafted press with the invitation id the child holds returns to /a as it was — and opening the links ended nothing, the request still open',
      [Boolean(label && endAction && odetteId && oA && oB), fresh.map((r) => hasNo(r.html)), refused.map((r) => r.location.replace(BASE, '')),
       Boolean(formWith(after.html, /Yes, it/)), /This link doesn.t open anything/.test(vis(after.html))],
      [true, [true, true], [`/a/${odetteId}`], true, false]);

    // F15: the person at a mistyped number. They open the text, never press
    // "Yes, it's me", and press the No straight from the unconfirmed page.
    const rhea = await joinPost('startPendingInvitation', { firstName: 'Rhea', dob: '2014-05-05', guardianName: 'Not Her Parent', guardianPhone: '0400 848 484', guardianEmail: 'wrong.number.jb@example.com' });
    const rheaId = /\/join\/waiting\/([0-9a-f-]{36})/.exec(rhea.location)?.[1];
    const [rA, rB] = approvalCodes((await get('/dev/outbox', ids.people.alex)).html).slice(0, 2);
    const rPage = await ig(`/a/${rA}`);
    const rNo = forms(rPage.html).find((f) => f.submit === label);
    const rBox = await outboxCount();
    const rPressed = rNo ? await post(`/a/${rA}`, rNo) : { location: '' };
    check('jb-f15-w1: on a link nobody confirmed, the No is there beside "Yes, it’s me" and ends the request — /a/closed, both links finished, no message to anyone',
      [Boolean(rheaId && rA && rB), Boolean(formWith(rPage.html, /Yes, it/)), Boolean(rNo), rNo?.method, rPressed.location.replace(BASE, ''),
       [await ig(`/a/${rA}`), await ig(`/a/${rB}`)].map((r) => /This link doesn.t open anything/.test(vis(r.html))), await outboxCount()],
      [true, true, true, 'post', '/a/closed', [true, true], rBox]);

    await post(`/a/${oA}`, formWith(fresh[0].html, /Yes, it/));
    const s3 = await ig(`/a/${oA}`), s3b = await ig(`/a/${oB}`);
    const endIn = (h) => forms(h).find((f) => f.submit === label);
    check('jr-pd3-w2: from the first confirmed channel the No is there, at equal weight — under "One more step" (3), and under the second link’s "Yes, it’s me" (3b) — posting only the code',
      [/One more step/.test(vis(s3.html)), Boolean(endIn(s3.html)), Boolean(endIn(s3b.html)), Boolean(formWith(s3b.html, /Yes, it/)),
       Object.keys(endIn(s3.html)?.fields ?? {}).filter((f) => !f.startsWith('$ACTION')),
       (s3.html.match(new RegExp(`<button type="submit" class="btn btn-secondary"[^>]*>${label}</button>`)) ?? []).length],
      [true, true, true, true, ['code'], 1]);
    const boxBefore = await outboxCount();
    const pressed = await post(`/a/${oA}`, endIn(s3.html));
    const closedPage = await ig('/a/closed');
    const deadA = await ig(`/a/${oA}`), deadB = await ig(`/a/${oB}`), never = await ig('/a/no-such-approval-code-jr');
    check('jr-pd3-w3: the press lands on /a/closed — "This request has closed." and "Nothing was approved, and the details we held are deleted." — and both links now open the one finished page every other cause opens',
      [pressed.location.replace(BASE, ''), /This request has closed\./.test(vis(closedPage.html)), /Nothing was approved, and the details we held are deleted\./.test(vis(closedPage.html)),
       /Odette/.test(vis(closedPage.html)), forms(closedPage.html).length,
       new Set([deadA, deadB, never].map((r) => vis(r.html))).size, /This link doesn.t open anything/.test(vis(deadA.html))],
      ['/a/closed', true, true, false, 0, 1, true]);
    check('jr-pd3-w4: and no message went to anyone — nobody is a guardian yet', await outboxCount(), boxBefore);
    // The child's page for an ended request is the page for an id that never
    // existed, byte for byte, its own id and the per-request values aside
    // (John's condition 3; D-17, U-1). Expiry reaches the same branch: the
    // row is gone either way.
    // The markup outside Next's flight payload, whose chunk numbering varies
    // between any two requests in development.
    const norm = (h, id) => {
      let out = h.replace(/<script[\s\S]*?<\/script>/g, '');
      for (const re of [/nonce="([^"]+)"/, /self\.__next_r="([^"]+)"/]) { const v = re.exec(out)?.[1]; if (v) out = out.split(v).join('<r>'); }
      return out.replace(/\?v=\d+/g, '').split(id).join('<id>');
    };
    const ghost = '6f1c0c0e-0000-4000-8000-000000000001';
    const w1 = await ig(`/join/waiting/${odetteId}`), w2 = await ig(`/join/waiting/${ghost}`);
    check('jr-pd3-w5: the child’s waiting page for the ended request is byte-identical to one for an id that never existed — "This request has closed. You can ask again whenever you like."',
      [w1.status, w2.status, norm(w1.html, odetteId) === norm(w2.html, ghost), /This request has closed\. You can ask again whenever you like\./.test(vis(w1.html))],
      [200, 200, true, true]);

    // Both channels confirmed (state 4): the No sits in the answer pair beside
    // Approve, belongs to its own form AFTER the approve form, and needs no
    // adult tick — ending declares nothing.
    await joinPost('startPendingInvitation', { firstName: 'Petra', dob: '2014-07-07', guardianName: 'Pia Parent', guardianPhone: '0400 828 282', guardianEmail: 'pia.parent@example.com' });
    const [pA, pB] = approvalCodes((await get('/dev/outbox', ids.people.alex)).html).slice(0, 2);
    for (const c of [pA, pB]) await post(`/a/${c}`, formWith((await ig(`/a/${c}`)).html, /Yes, it/));
    const s4 = (await ig(`/a/${pA}`)).html;
    const approveF = formWith(s4, /Approve/);
    const endF = forms(s4).find((f) => f !== approveF && 'code' in f.fields && f.submit === '');
    const mk = s4.replace(/<script[\s\S]*?<\/script>/g, '');
    check('jr-pd3-w6: with both confirmed, the No is the same secondary in the answer pair, pointing at its own form placed after Approve’s — which a lookup by field still finds first',
      [Boolean(approveF), Boolean(endF), new RegExp(`<button type="submit" form="pd-end" class="btn btn-secondary"[^>]*>${label}</button>`).test(mk),
       mk.indexOf('class="fl-answer"') < mk.indexOf('form="pd-end"'), mk.indexOf('id="pd-end"') > mk.lastIndexOf('name="adult"'),
       // forms() builds fresh objects on every call, so compare positions in one list.
       ((all) => all.findIndex((f) => 'code' in f.fields) === all.findIndex((f) => /Approve/.test(f.submit)))(forms(s4)),
       /Not ready\? Do nothing\. If you don.t approve, all of this is deleted after 14 days\./.test(vis(s4))],
      [true, true, true, true, true, true, true]);
    // Safety review N-3: a browser that ignored the `form` attribute would post
    // the No into Approve's form. It carries answer=end, and Approve's own
    // action ends on it — the press ends the request, it never approves.
    await joinPost('startPendingInvitation', { firstName: 'Quill', dob: '2014-08-08', guardianName: 'Qa Parent', guardianPhone: '0400 838 383', guardianEmail: 'qa.parent@example.com' });
    const [qA, qB] = approvalCodes((await get('/dev/outbox', ids.people.alex)).html).slice(0, 2);
    for (const c of [qA, qB]) await post(`/a/${c}`, formWith((await ig(`/a/${c}`)).html, /Yes, it/));
    const qApprove = formWith((await ig(`/a/${qA}`)).html, /Approve/);
    const misrouted = await post(`/a/${qA}`, qApprove, { adult: 'on', answer: 'end' });
    check('jr-pd3-w8 (N-3): the No posted into Approve\u2019s form — with the adult tick on — ends the request; nothing is approved, and neither link opens an approval afterwards',
      // Either attribute order: React writes this button's value before its
      // name (seen 2 Oct), and the order is React's, not the product's.
      [/<button[^>]*(name="answer"[^>]*value="end"|value="end"[^>]*name="answer")[^>]*>/.test(mk), misrouted.location.replace(BASE, ''), forms((await ig(`/a/${qA}`)).html).length + forms((await ig(`/a/${qB}`)).html).length],
      [true, '/a/closed', 0]);
    const endedNoTick = await post(`/a/${pA}`, endF);
    check('jr-pd3-w7: pressed without the adult tick, it still ends the request — and neither link opens an approval afterwards',
      [endedNoTick.location.replace(BASE, ''), forms((await ig(`/a/${pA}`)).html).length + forms((await ig(`/a/${pB}`)).html).length],
      ['/a/closed', 0]);
    check('jr-label-w: every /a page served here carries BUZ’s approved label, "No, end this request", and none says "Not now"',
      [label, [s3, s3b].map((r) => hasNo(r.html)).concat(hasNo(s4)), [fresh[0], s3, s3b, closedPage].some((r) => /Not now/.test(vis(r.html))) || /Not now/.test(vis(s4))],
      ['No, end this request', [true, true, true], false]);
  }

  // --- Sign-up never takes over an existing account --------------------------
  const takeover = await joinPost('createAccount', { firstName: 'Mallory', dob: '1990-01-01', email: 'priya@example.com', password: 'attacker-password-1' });
  check('join1: signing up with an existing address signs nobody in',
    [/\/signin\?joined=1/.test(takeover.location), /pitch_session=/.test(takeover.cookie)], [true, false]);
  const attackerIn = await post('/signin', signinForm, { email: 'priya@example.com', password: 'attacker-password-1' });
  check('join2: and the attacker\'s password does not open that account', /pitch_session=[^;]+\./.test(attackerIn.cookie), false);
  const ownerIn = await post('/signin', signinForm, { email: 'priya@example.com', password: 'parent-password-2468' });
  check('join3: the owner\'s password still does', /pitch_session=[^;]+\./.test(ownerIn.cookie), true);
  const fresh = await joinPost('createAccount', { firstName: 'Newt', dob: '1995-05-05', email: 'newt@example.com', password: 'newt-password-123' });
  check('join4: a genuinely new account gets the identical answer', [/\/signin\?joined=1/.test(fresh.location), /pitch_session=/.test(fresh.cookie)], [true, false]);
  // 0056 / L21. The password is set at the door and works from the moment the
  // address is proved — not before. This is the whole flow, walked: sign up,
  // try to sign in, open the link we emailed, press it, sign in.
  const newtIn = await post('/signin', signinForm, { email: 'newt@example.com', password: 'newt-password-123' });
  check('join5: a new account signs in nowhere until the address is proved (L21)',
    /pitch_session=[^;]+\./.test(newtIn.cookie), false);
  const newtBox = plain((await get('/dev/outbox', ids.people.alex)).html);
  const newtToken = /\/confirm\/([A-Za-z0-9_-]{20,})/.exec(newtBox)?.[1];
  check('join5b: the door emails that address a link to confirm it, and nothing else went anywhere',
    [Boolean(newtToken), /newt@example\.com/.test(newtBox), /Confirm your email address/.test(newtBox)], [true, true, true]);
  const confirmPage = await ig(`/confirm/${newtToken}`);
  check('join5c: opening the link confirms nothing — it asks for a press, as the D-156 links do',
    [confirmPage.status, Boolean(formWith(confirmPage.html, /Yes, it/)),
     /pitch_session=/.test((await post('/signin', signinForm, { email: 'newt@example.com', password: 'newt-password-123' })).cookie)],
    [200, true, false]);
  const confirmed = await post(`/confirm/${newtToken}`, formWith(confirmPage.html, /Yes, it/));
  check('join5d: pressing it lands on sign-in, said plainly', /\/signin\?confirmed=1/.test(confirmed.location), true);
  const newtIn2 = await post('/signin', signinForm, { email: 'newt@example.com', password: 'newt-password-123' });
  check('join5e: and now the password they chose at the door works',
    /pitch_session=[^;]+\./.test(newtIn2.cookie), true);
  const usedAgain = await ig(`/confirm/${newtToken}`);
  check('join5f: the link works once, and a finished one says nothing about any account',
    [/This link isn.t live/.test(plain(usedAgain.html)), Boolean(formWith(usedAgain.html, /Yes, it/)),
     /This link isn.t live/.test(plain((await ig('/confirm/never-existed-at-all')).html))],
    [true, false, true]);

  // --- D-155 as amended (0048): a 16-17 names a parent, who confirms ------
  const teenDob = new Date(Date.now() - 17 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const noParentEmail = await joinPost('createAccount', { firstName: 'Tess', dob: teenDob, email: 'tess@example.com', password: 'tess-password-123',
    guardianName: 'Terry Parent', guardianPhone: '0400 555 666' });
  check('t16a: a 16-17 sign-up without the parent\'s email is refused', /\/join\?error=1/.test(noParentEmail.location), true);
  const ownEmail = await joinPost('createAccount', { firstName: 'Tess', dob: teenDob, email: 'tess@example.com', password: 'tess-password-123',
    guardianName: 'Terry Parent', guardianPhone: '0400 555 666', guardianEmail: 'tess@example.com' });
  check('t16b: nor with their own address as the parent\'s', /\/join\?error=1/.test(ownEmail.location), true);
  const tessJoin = await joinPost('createAccount', { firstName: 'Tess', dob: teenDob, email: 'tess@example.com', password: 'tess-password-123',
    guardianName: 'Terry Parent', guardianPhone: '0400 555 666', guardianEmail: 'terry@example.com' });
  check('t16c: with it, the 16-17 is set up', /\/signin\?joined=1/.test(tessJoin.location), true);
  const tessOut = (await get('/dev/outbox', ids.people.alex)).html.replace(/&#x27;|&rsquo;|’/g, "'");
  check('t16d: the parent gets §1b and §2b, not the under-16 approval',
    /Tess \(17\) has named you as their parent/.test(tessOut) && /Tess has named you as their parent on Pitch/.test(tessOut), true);
  const tessToken = /\/confirm\/([A-Za-z0-9_-]{20,})/.exec(tessOut)?.[1];
  check('t16d2: and Tess is asked to confirm her own address before she can sign in (L21)',
    [Boolean(tessToken),
     /pitch_session=/.test((await post('/signin', signinForm, { email: 'tess@example.com', password: 'tess-password-123' })).cookie)],
    [true, false]);
  const tessConfirm = await ig(`/confirm/${tessToken}`);
  await post(`/confirm/${tessToken}`, formWith(tessConfirm.html, /Yes, it/));
  const tessIn = await post('/signin', signinForm, { email: 'tess@example.com', password: 'tess-password-123' });
  const tessCookie = tessIn.cookie.split(';')[0];
  const tessHome = await (await fetch(BASE + '/home', { headers: { cookie: tessCookie } })).text();
  const tessRec = /\/build\/([0-9a-f-]{36})/.exec(tessHome)?.[1];
  check('t16e: until the parent confirms, Tess sees "Waiting on your parent" and has no Send door',
    /Waiting on your parent/.test(tessHome) && !/href="\/send\//.test(tessHome), true);
  // Spec A (16–17, "Done when" 1): the waiting notice takes the primary's
  // place under the hero (A-P1) and nothing glows, because the screen's only
  // primary is unavailable. A page with no squad number draws no ghost numeral.
  {
    const m = tessHome.replace(/<script[\s\S]*?<\/script>/g, ' ');
    check('hm-w3: with no parent confirmed, the waiting notice sits under the hero, nothing glows, and no ghost numeral is drawn without a number',
      [/class="hg-lead"><div role="status" class="card card-amber"/.test(m), /fl-glow/.test(m), /class="cv-num"/.test(m)], [true, false, false]);
    // F5 (BUZ, 1 Oct): Tess's request is open, so the notice is the waiting
    // one — never "This request has closed." — and its line matches what
    // happened to the text: "We've texted…" once it went, the approved queued
    // line while it waits for SMS (D-168). This seed's dev SMS decides which.
    const ask = /data-parent-ask="([a-z-]+)"/.exec(m)?.[1] ?? 'none';
    const texted = /We(?:’|&#x27;|&rsquo;)ve texted and emailed them to confirm they(?:’|&#x27;|&rsquo;)re your parent\./.test(m);
    const queued = /We(?:’|&#x27;|&rsquo;)ve emailed them, and their text follows shortly\. Once they do, you can send\. Keep building your page in the meantime\./.test(m);
    check(`hm-w3c: an open request shows the waiting notice whose line matches the text’s state, and never the closed line (${ask})`,
      [['asked', 'text-queued'].includes(ask), ask === 'asked' ? [texted, queued] : [queued, texted], /This request has closed\./.test(m)],
      [true, [true, false], false]);
  }
  const tessSend = await fetch(BASE + `/send/${tessRec}`, { redirect: 'manual', headers: { cookie: tessCookie } });
  check('t16f: and the send screen sends Tess home', tessSend.status >= 300 && tessSend.status < 400, true);
  // C-P7 (1 Oct): /build/ready offered her "Send it to a club", which bounced.
  const tessReady = await (await fetch(BASE + `/build/${tessRec}/ready`, { headers: { cookie: tessCookie } })).text();
  check('dfx-C-P7: nor does her "page ready" screen offer a send that would bounce',
    [/Your page is (ready|live)/.test(plain(tessReady)), /href="\/send\//.test(tessReady), /Send it to a club/.test(tessReady)], [true, false, false]);

  const tessLinks = approvalCodes(tessOut).slice(0, 2);
  for (const code of tessLinks) {
    const yes = formWith((await ig(`/a/${code}`)).html, /Yes, it/);
    if (yes) await post(`/a/${code}`, yes);
  }
  const tessApprove = await ig(`/a/${tessLinks[0]}`);
  check('t16g: the parent is asked "Are you Tess\'s parent?", not to approve a page',
    /Are you Tess.s parent\?/.test(plain(tessApprove.html)) && /Confirm I.m their parent/.test(plain(tessApprove.html)) && !/Approve this page/.test(tessApprove.html), true);
  const confirmForm = formWith(tessApprove.html, /Confirm I/);
  const tessDone = await post(`/a/${tessLinks[0]}`, confirmForm, { adult: 'on' });
  const tessDonePage = plain((await ig(tessDone.location)).html);
  check('t16h: confirming lands on "You confirmed you\'re Tess\'s parent"', /You confirmed you.re Tess.s parent/.test(tessDonePage) && /Confirmed by you on/.test(tessDonePage), true);
  const tessHome2 = await (await fetch(BASE + '/home', { headers: { cookie: tessCookie } })).text();
  check('t16i: and now Tess can send', /href="\/send\//.test(tessHome2) && !/Waiting on your parent/.test(tessHome2), true);
  check('hm-w3b: and once the parent confirms, Send my CV to a club is the one glow',
    [...tessHome2.replace(/<script[\s\S]*?<\/script>/g, ' ').matchAll(/class="[^"]*\bfl-glow\b[^"]*"[^>]*>([^<]*)</g)].map((x) => x[1]), ['Send my CV to a club']);
  const tessReady2 = await (await fetch(BASE + `/build/${tessRec}/ready`, { headers: { cookie: tessCookie } })).text();
  check('dfx-C-P7b: and her "page ready" screen offers it again, to /send',
    new RegExp(`href="/send/${tessRec}"[^>]*>Send it to a club<`).test(tessReady2), true);

}

// ---------------------------------------------------------------------------
// A player's own link controls (John's rulings, 17 Sep §3): the clubs they
// sent to, a switch per club, a fresh link, and never a number.
// ---------------------------------------------------------------------------
{
  const jordan = ids.people.jordan;
  const rec = /\/build\/([0-9a-f-]{36})/.exec((await get('/home', jordan)).html)?.[1];
  const page = async () => (await get(`/send/${rec}`, jordan)).html;
  const plainP = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&rsquo;|&#39;|’/g, "'").replace(/\s+/g, ' ');
  const linksPart = (h) => { const t = plainP(h); const i = t.indexOf('Your links'); return i < 0 ? '' : t.slice(i); };
  const postTo = async (form, extra = {}) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(form.fields)) fd.append(k, v);
    for (const [k, v] of Object.entries(extra)) fd.append(k, v);
    const r = await fetch(BASE + `/send/${rec}`, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(jordan) } });
    await r.text();
    return r.headers.get('location') ?? '';
  };

  let html = await page();
  check('pl-a: an adult player sees "Your links" with a fresh-link button', /Your links/.test(plainP(html)) && /Make a fresh link/.test(html), true);
  const sendForm = forms(html).find((f) => /Send it now/.test(f.submit));
  await postTo(sendForm, { clubName: 'Links Test FC', address: 'coach@linkstest.example.au' });
  html = await page();
  check('pl-b: the club they sent to is on their list, with the address', /Links Test FC/.test(linksPart(html)) && /coach@linkstest\.example\.au/.test(linksPart(html)), true);
  const offForm = forms(html).find((f) => /Switch off/.test(f.submit) && f.fields.tokenId);
  check('pl-c: with a switch for that one club', Boolean(offForm), true);
  const offLoc = await postTo(offForm);
  check('pl-d: switching it off says so', /off=1/.test(offLoc), true);
  html = await page();
  check('pl-e: and that club now reads "Switched off"', /Links Test FC[^]*?Switched off/.test(linksPart(html)), true);

  // The daily limit: keep sending until one is held. The page for a held
  // send is the same "Sent" page (U-3); the list says it didn't go, with no number.
  let heldSeen = false;
  for (let i = 0; i < 12 && !heldSeen; i++) {
    const f = forms(await page()).find((x) => /Send it now/.test(x.submit));
    const loc = await postTo(f, { clubName: `Burst FC ${String.fromCharCode(65 + i)}`, address: `c${i}@burst.example.au` });
    check(`pl-f${i}: every send, held or not, lands on "Sent"`, /sent=1/.test(loc), true);
    heldSeen = /didn['’]t go/.test(linksPart(await page()));
  }
  const lp = linksPart(await page());
  check('pl-g: a send the limit held shows as one that didn\'t go', heldSeen, true);
  check('pl-h: and the list never names a number, a limit or what is left',
    /\b(limit|remaining|left today|of 10|out of)\b/i.test(lp) || /\b\d+\s*(sends?|of)\b/i.test(lp), false);

  const freshForm = forms(await page()).find((f) => /Make a fresh link/.test(f.submit));
  const freshLoc = await postTo(freshForm);
  const tok = /link=([A-Za-z0-9_-]{20,})/.exec(freshLoc)?.[1];
  check('pl-i: a fresh link is made and shown once', Boolean(tok), true);
  check('pl-j: it opens the player\'s CV', (await get(`/p/${tok}`, null)).status, 200);
  const deadTitle = /<title>([^<]*)</.exec((await get('/p/not-a-real-link-at-all', null)).html)?.[1];
  check('pl-k: and the old link is dead', /<title>([^<]*)</.exec((await get('/p/dev-jordan', null)).html)?.[1], deadTitle);
  check('pl-l: every club link on the list is switched off too', !/Switch off<\/button>/.test(await page()), true);

  // Nobody else gets these controls.
  const nate = ids.children.nate;
  const alexOnNate = await fetch(BASE + `/send/${nate.record_id}`, { redirect: 'manual', headers: { cookie: cookieFor(ids.people.alex) } });
  const alexHtml = alexOnNate.status === 200 ? await alexOnNate.text() : '';
  check('pl-m: a parent looking at a 16-17\'s send screen gets no player controls', /Make a fresh link/.test(alexHtml), false);
  const fd = new FormData();
  for (const [k, v] of Object.entries(freshForm.fields)) fd.append(k, v);
  fd.set('recordId', nate.record_id);
  const forged = await fetch(BASE + `/send/${nate.record_id}`, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(ids.people.alex) } });
  check('pl-n: and a parent posting "fresh link" on the 16-17\'s record gets nothing', /link=/.test(forged.headers.get('location') ?? ''), false);
  const deniz = ids.children.deniz;
  const denizPage = await fetch(BASE + `/send/${deniz.record_id}`, { redirect: 'manual', headers: { cookie: cookieFor(ids.people.alex) } });
  check('pl-o: an under-16\'s send screen has no "Your links"', /Your links/.test(denizPage.status === 200 ? await denizPage.text() : ''), false);
}

// ---------------------------------------------------------------------------
// Doc 32's controls, operated through the real pages: a report that says a
// child is involved, a page hidden without deleting it (A1, A5, C1), one
// parent's access suppressed and restored (A2), and the age check (A4).
// Marina drives the operator console (any signed-in email in development).
// ---------------------------------------------------------------------------
{
  const op = ids.people.marina, alex = ids.people.alex, nate = ids.children.nate, jordan = ids.people.jordan;
  const txt = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&rsquo;|&#39;|’/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  const title = (h) => /<title>([^<]*)<\/title>/.exec(h)?.[1];
  const dead = title((await get('/p/never-a-real-link-abc', null)).html);
  const postAs = async (who, path, form, extra = {}) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(form.fields)) fd.append(k, v);
    for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual', headers: who ? { cookie: cookieFor(who) } : {} });
    await r.text();
    return r.headers.get('location') ?? '';
  };
  const desk = async () => (await get('/ops/reports', op)).html;

  // --- A5: a report from the CV page, saying it's a child ------------------
  const cvPage = (await get('/p/dev-nate', null)).html;
  const reportHref = /href="(\/report\?kind=player_cv&(?:amp;)?page=[0-9a-f]{64})"/.exec(cvPage)?.[1]?.replace('&amp;', '&');
  check('g32-1: the CV page\'s report link carries the link\'s fingerprint, never the link', Boolean(reportHref) && !/dev-nate/.test(reportHref), true);
  const reportForm = forms((await get(reportHref, null)).html).find((f) => /Send the report/.test(f.submit));
  check('g32-2: the report form offers "this account belongs to a child"', /I think this account belongs to a child/.test(txt((await get(reportHref, null)).html)), true);
  const outbox = async () => txt((await get('/dev/outbox', op)).html);
  await postAs(null, '/report', reportForm, { concern: 'child_account', reason: 'This looks like a 12-year-old.', reporterEmail: 'reporter@example.com' });
  check('msg7: the reporter who left an address gets §7, naming the kind of page only',
    /We've received your report/.test(await outbox()) && /about a player's page/.test(await outbox()), true);
  let d = txt(await desk());
  check('g32-3: the operator sees it, labelled, with the reason', /Says this account belongs to a child/.test(d) && /This looks like a 12-year-old/.test(d), true);

  // --- rep1: A REPORT OVER THE LIMIT IS STILL SAVED (doc 35 5a) --------------
  // Until 28 Sep the rate limit gated the INSERT: the eleventh report from one
  // address in an hour was never written, and the person was still told it had
  // been received. For a report about a child that meant a real concern could
  // vanish silently. John ruled, BUZ chose: every report is saved, and only the
  // confirmation email is limited, because it goes to an address the reporter
  // typed. Twelve reports from one address; all twelve must reach the desk.
  {
    const burstIp = '203.0.113.77';               // TEST-NET-3, reaches nobody
    const burstMail = 'burst-reporter@example.com';
    for (let i = 1; i <= 12; i++) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(reportForm.fields)) fd.append(k, v);
      fd.set('concern', 'child_account');
      fd.set('reason', `Burst report ${i} of 12`);
      fd.set('reporterEmail', burstMail);
      const r = await fetch(BASE + '/report', { method: 'POST', body: fd, redirect: 'manual',
        headers: { 'x-forwarded-for': burstIp } });
      await r.text();
    }
    const onDesk = (txt(await desk()).match(/Burst report \d+ of 12/g) ?? []).length;
    check('rep1: twelve reports from one address in an hour — all twelve reach the desk', onDesk, 12);
    const mailed = (txt((await get('/dev/outbox', op)).html).match(/burst-reporter@example\.com/g) ?? []).length;
    check('rep2: and the confirmation email is still limited, so the form cannot mail anybody without end',
      mailed > 0 && mailed <= 10, true);
  }

  // --- A1/C1: hide the page without deleting it -----------------------------
  check('g32-4: before: the page opens and Riverside lists Nate',
    [title((await get('/p/dev-nate', null)).html) !== dead, /Nate/.test(txt((await get('/club/register', op)).html))], [true, true]);
  const holdForm = forms(await desk()).find((f) => /Hide this page while I look/.test(f.submit));
  check('g32-5: hiding says so', /done=held/.test(await postAs(op, '/ops/reports', holdForm, { reason: 'Checking the age' })), true);
  check('g32-6: now the link answers as dead (D-77)', title((await get('/p/dev-nate', null)).html), dead);
  check('msg8: the family is told (§8), by first name, to the parent\'s address',
    /Something about your child on Pitch needs your attention/.test(await outbox()) && /involves Nate/.test(await outbox()) && /guardian@example\.com/.test(await outbox()), true);
  check('g32-7: and the club register no longer lists Nate (A1: no club listing)', /Nate/.test(txt((await get('/club/register', op)).html)), false);
  check('g32-8: the parent still has everything: nothing was deleted', /Nate/.test(txt((await get(`/g/controls/${nate.child_id}`, alex)).html)), true);
  const release = forms(await desk()).find((f) => /Show it again/.test(f.submit));
  await postAs(op, '/ops/reports', release);
  check('g32-9: released, the page and the listing come back',
    [title((await get('/p/dev-nate', null)).html) !== dead, /Nate/.test(txt((await get('/club/register', op)).html))], [true, true]);
  const close = forms(await desk()).find((f) => /Close report/.test(f.submit));
  check('g32-10: a report closes only with an outcome', /error=outcome/.test(await postAs(op, '/ops/reports', close)), true);
  const before18 = ((await outbox()).match(/We've finished looking at your report/g) ?? []).length;
  check('g32-11: and closes with one', /done=closed/.test(await postAs(op, '/ops/reports', close, { outcome: 'removed' })), true);
  check('msg18: the reporter hears it was acted on (§18)', ((await outbox()).match(/We've finished looking at your report/g) ?? []).length, before18 + 1);

  // --- A2: one parent's access, suppressed then restored --------------------
  const found = await get(`/ops/reports?parent=${encodeURIComponent('guardian@example.com')}`, op);
  const supForm = forms(found.html).find((f) => /Suppress this parent/.test(f.submit) && f.fields.childId === nate.child_id);
  check('g32-12: the operator finds the parent\'s link to Nate', Boolean(supForm), true);
  check('g32-13: suppressing needs a reason', /error=reason/.test(await postAs(op, '/ops/reports', supForm)), true);
  await postAs(op, '/ops/reports', supForm, { reason: 'Family safety report' });
  const ctl = await get(`/g/controls/${nate.child_id}`, alex);
  check('g32-14: the suppressed parent can no longer open Nate\'s controls (the same answer as a child that is not theirs)', ctl.status !== 200 && !/Nate/.test(txt(ctl.html)), true);
  check('g32-15: and Nate still exists, with his page', title((await get('/p/dev-nate', null)).html) !== dead, true);
  const again = await get(`/ops/reports?parent=${encodeURIComponent('guardian@example.com')}`, op);
  // Floodlit (spec I, BUZ 1 Oct): the state is a pill beside the name, where it
  // was " · suppressed" in the name's own line, so it is read from the pill —
  // the suppressed (amber) one, on Nate's panel.
  check('g32-16: the link shows as suppressed, restorable, with the court-order removal beside it',
    />Parent of Nate<\/div><span class="pill pill-wait">suppressed<\/span>/.test(again.html.replace(/<!--[\s\S]*?-->/g, '')) && forms(again.html).some((f) => /Restore access/.test(f.submit)) && forms(again.html).some((f) => /Remove permanently/.test(f.submit)), true);
  // The I spec (1 Oct) read the page's !revoked as letting a suppressed link
  // draw the suppress form. It never could: 0049's check constraint makes a
  // suppressed link a revoked one. Pinned here, so the form stays off if that
  // ever changes.
  check('g32-16b: and no form offers to suppress it again',
    forms(again.html).some((f) => /Suppress this parent/.test(f.submit) && f.fields.childId === nate.child_id), false);
  const removeForm = forms(again.html).find((f) => /Remove permanently/.test(f.submit) && f.fields.childId === nate.child_id);
  check('g32-17: permanent removal needs a court order reference', /error=order/.test(await postAs(op, '/ops/reports', removeForm)), true);
  const restore = forms(again.html).find((f) => /Restore access/.test(f.submit) && f.fields.childId === nate.child_id);
  await postAs(op, '/ops/reports', restore);
  check('g32-18: restored, the parent has Nate\'s controls again', (await get(`/g/controls/${nate.child_id}`, alex)).status, 200);

  // --- A4: an adult names a U15 squad ------------------------------------------
  const jRec = /\/build\/([0-9a-f-]{36})/.exec((await get('/home', jordan)).html)?.[1];
  const riv = ids.clubs['riverside-fc'];
  const regPage = (await get(`/register-interest/${jRec}?club=${riv}`, jordan)).html;
  const u15 = [...regPage.matchAll(/<option value="([0-9a-f-]{36})"[^>]*>([^<]*U1[0-5][^<]*)<\/option>/g)].map((m) => m[1])[0];
  const regForm = forms(regPage).find((f) => f.fields.clubId === riv || /Register/.test(f.submit));
  check('g32-19: Jordan (an adult) can pick a junior squad at Riverside', Boolean(u15 && regForm), true);
  const jLive = title((await get('/p/dev-jordan', null)).html);
  const loc = await postAs(jordan, `/register-interest/${jRec}`, regForm, { clubId: riv, squadId: u15, positions: 'ST' });
  check('g32-20: the registration answers as usual', /registered=1/.test(loc), true);
  check('g32-21: but Jordan is held: the link answers as dead', title((await get('/p/dev-jordan', null)).html), dead);
  check('msg17: and gets §17, the non-accusatory note, once', ((await outbox()).match(/We need a moment on your Pitch signup/g) ?? []).length, 1);
  check('g32-22: and the operator sees the age check', /Age checks[\s\S]*Jordan/.test(txt(await desk())), true);
  const releaseAge = forms(await desk()).find((f) => /Checked — release/.test(f.submit));
  await postAs(op, '/ops/reports', releaseAge);
  check('g32-23: released after a person looked, the link works again', title((await get('/p/dev-jordan', null)).html), jLive);
}

// ---------------------------------------------------------------------------
// C-P4 · THE PARENT'S PRESS IS THE PARENT'S ALONE. The same two forms the
// parent sends and registers from, posted field for field by somebody else:
// another family's parent (Mila's, signed in by the block that approved her),
// a coach at Deniz's club (Sam; the permission suite's C-P4-2 has a coach who
// reads his record in full), the club's TD, and the
// parent themselves once an operator has suppressed their link to Deniz (a
// suppressed link is a revoked one, 0049). Each must land where a stranger
// lands and change nothing (L12): no message to the address, no row on the
// club's register, nothing in the parent's log. Then the link is restored,
// and the same post from the parent does send — or "nothing" proved nothing.
// ---------------------------------------------------------------------------
{
  const alex = ids.people.alex, marina = ids.people.marina, sam = ids.people.sam, deniz = ids.children.deniz;
  const riverside = ids.clubs['riverside-fc'];
  const plain = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'").replace(/&rsquo;/g, '’').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  const postWith = async (cookie, path, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual', headers: cookie ? { cookie } : {} });
    await r.text();
    return { location: (r.headers.get('location') ?? '').replace(BASE, ''), cookie: (r.headers.getSetCookie?.() ?? []).find((c) => c.startsWith('pitch_session=')) };
  };
  const signin = forms((await get('/signin', null)).html).find((f) => /^Sign in$/.test(f.submit));
  const priya = (await postWith(null, '/signin', { ...signin.fields, email: 'priya@example.com', password: 'parent-password-2468' })).cookie?.split(';')[0];
  const priyaHome = priya ? plain(await (await fetch(BASE + '/home', { headers: { cookie: priya } })).text()) : '';

  const sendPath = `/send/${deniz.record_id}`, regPath = `/register-interest/${deniz.record_id}?club=${riverside}`;
  // Not from Brindlewood's page: the 0160 block stopped that club for the run.
  const sendFields = { ...forms((await get(sendPath, alex)).html).find((f) => f.visible.some((v) => v.name === 'clubName')).fields,
    clubName: 'Intruder Test FC', address: 'intruder@cp4.example.au' };
  const regFields = { ...forms((await get(regPath, alex)).html).find((f) => 'clubId' in f.fields).fields, positions: 'GK', note: 'Not posted by his family.' };
  const state = async () => {
    const box = plain((await get('/dev/outbox', marina)).html), reg = plain((await get('/club/register', marina)).html);
    const log = plain((await get(`/g/controls/${deniz.child_id}`, alex)).html);
    return [box.includes('intruder@cp4.example.au'), reg.includes('Not posted by his family.'),
      n(log, 'Deniz’s CV was sent to a club'), n(log, 'Deniz went onto a club register')];
  };
  const n = (t, x) => t.split(x).length - 1;
  const both = async (cookie) => [(await postWith(cookie, sendPath, sendFields)).location, (await postWith(cookie, regPath, regFields)).location];

  const before = await state();
  const stranger = await both(priya);
  const coach = await both(cookieFor(sam));
  const td = await both(cookieFor(marina));
  const after = await state();
  check('C-P4-w9 setup: Mila’s parent is signed in, and is somebody else’s parent',
    [Boolean(priya), priyaHome.includes('Mila'), priyaHome.includes('Deniz')], [true, true, false]);
  check('C-P4-w9: another family’s parent, a coach at Deniz’s club and the club’s TD posting the parent’s two forms are sent home, and nothing is sent, registered or logged',
    [stranger, coach, td, after], [['/home', '/home'], ['/home', '/home'], ['/home', '/home'], before]);

  // The parent, with their link to Deniz suppressed by an operator.
  const op = marina;
  const opForms = async () => forms((await get(`/ops/reports?parent=${encodeURIComponent('guardian@example.com')}`, op)).html);
  const sup = (await opForms()).find((f) => /Suppress this parent/.test(f.submit) && f.fields.childId === deniz.child_id);
  if (sup) await postWith(cookieFor(op), '/ops/reports', { ...sup.fields, reason: 'C-P4 revoked-guardian check' });
  const revoked = await both(cookieFor(alex));
  const restore = (await opForms()).find((f) => /Restore access/.test(f.submit) && f.fields.childId === deniz.child_id);
  if (restore) await postWith(cookieFor(op), '/ops/reports', restore.fields);
  // Read once the link is back: while it is revoked the parent cannot open
  // Deniz's controls at all, which is g32-14's point and not this one.
  const afterRevoked = await state();
  check('C-P4-w10: a parent whose link to Deniz has been revoked posting the same two forms gets nothing either',
    [Boolean(sup), revoked, afterRevoked], [true, ['/home', '/home'], before]);
  const restored = await postWith(cookieFor(alex), sendPath, sendFields);
  check('C-P4-w11: restored, the same post from the parent sends — so the "nothing" above was the server saying no',
    [Boolean(restore), restored.location, (await state())[0]], [true, `/send/${deniz.record_id}?sent=1`, true]);
}

// ---------------------------------------------------------------------------
// "Take off this register" (D-108; doc 14 N7): a parent, or a 16-17 for
// themselves. The club's list loses the row; the club is told nothing.
// ---------------------------------------------------------------------------
{
  const nate = ids.children.nate, alex = ids.people.alex, td = ids.people.marina;
  const txt = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&rsquo;|&#39;|’/g, "'").replace(/\s+/g, ' ');
  const postAs = async (who, path, form, extra = {}) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(form.fields)) fd.append(k, v);
    for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(who) } });
    await r.text();
    return r.headers.get('location') ?? '';
  };
  const takeForms = (h) => forms(h).filter((f) => /Yes, take it off/.test(f.submit));

  check('tr0: Riverside can see Nate on its register', /Nate/.test(txt((await get('/club/register', td)).html)), true);
  const home = (await get('/home', nate.child_id)).html;
  const mine = takeForms(home);
  check('tr1: a 16-17 gets "Take off this register" on each of their registrations', mine.length >= 2, true);
  // Which form is Riverside's: the one inside the Riverside card.
  const section = home.slice(home.indexOf('id="readers"'));
  const rivId = /Riverside FC[\s\S]*?name="registrationId" value="([0-9a-f-]{36})"/.exec(section)?.[1];
  const rivForm = mine.find((f) => f.fields.registrationId === rivId);

  // A stranger posting the same form gets nothing, and a crafted "back" goes nowhere odd.
  const forged = await postAs(ids.people.jordan, '/home', rivForm, { back: 'https://evil.example.com' });
  check('tr2: someone else posting it changes nothing, and is sent to /home', [forged, /Nate/.test(txt((await get('/club/register', td)).html))], ['/home#readers', true]);

  const loc = await postAs(nate.child_id, '/home', rivForm);
  check('tr3: taking it off says so', /\/home\?taken=1#readers/.test(loc), true);
  const after = txt((await get('/home?taken=1', nate.child_id)).html);
  check('tr4: the home confirms it and shows the registration as taken off',
    /Taken off/.test(after) && /Riverside FC Registered [^·]+· taken off since/.test(after), true);
  check('tr5: and Riverside\'s register no longer has Nate on it', /Nate/.test(txt((await get('/club/register', td)).html)), false);

  const controls = (await get(`/g/controls/${nate.child_id}`, alex)).html;
  const parentForms = takeForms(controls);
  check('tr6: the parent can take off the rest', parentForms.length >= 1, true);
  let ploc = '';
  for (const f of parentForms) ploc = await postAs(alex, `/g/controls/${nate.child_id}`, f);
  check('tr7: and lands back on the child\'s controls', new RegExp(`/g/controls/${nate.child_id}\\?taken=1#readers`).test(ploc), true);
  const tl = txt((await get(`/g/controls/${nate.child_id}`, alex)).html);
  check('tr8: the timeline records it in plain words', /Nate came off a club register/.test(tl), true);
  check('tr9: a registration already taken off has no button', takeForms((await get(`/g/controls/${nate.child_id}`, alex)).html).length, 0);
}

// The daily job runs clean and reports its reminders (0050).
{
  const r = await fetch(BASE + '/api/jobs/daily');
  const j = r.ok ? await r.json() : {};
  check('job1: the daily job runs, and reports the day-10 reminders and link reminders',
    [r.status, typeof j.approvalNudges, typeof j.linkReminders], [200, 'number', 'number']);
}

// ---------------------------------------------------------------------------
// 0d · AN UNDER-16'S SQUAD, BOTH DOORS, ANSWERED BY HER PARENT (QA, 22 Sep).
//
// sq13 and sq14 in the squad block at the end only run if one of Alex's
// children is still his by then, and in a full sweep none is — so the
// parent's answer from a child's controls had never run, and sq12b passed on
// nothing. This walks the same doors here, on Georgia (15), while she is
// still her parent's: the club asks from its register, her parent answers
// from her controls, the club takes her out, and her parent puts her back
// where she started through the family's own door, confirmed by that club.
//
// sqf6/sqf8 are D-158 on an under-16: a CV shows a club only where a club has
// confirmed the player. Her page is the approved snapshot (D-119), and the
// snapshot froze the club she was at when it was approved — so a club she has
// left stayed on the page every club holds (QA, 22 Sep; open with Leo). The
// preview is what a club sees, by its own definition, so it is the surface.
// ---------------------------------------------------------------------------
{
  const td = ids.people.marina, kingsTd = ids.people.dana, alex = ids.people.alex, robin = ids.people.robin;
  const g = ids.children.georgia;
  const words = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&rsquo;/g, "'").replace(/&amp;/g, '&').replace(/&mdash;|&#8212;/g, '—').replace(/\s+/g, ' ');
  const postTo = async (path, who, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(who) } });
    await r.text();
    return { status: r.status, location: r.headers.get('location') ?? '' };
  };
  const section = (text, from, ...untils) => {
    const a = text.indexOf(from); if (a < 0) return '';
    const ends = untils.map((u) => text.indexOf(u, a + from.length)).filter((i) => i > 0);
    return text.slice(a, ends.length ? Math.min(...ends) : undefined);
  };
  const inSquad = (html) => section(words(html), 'In this squad', 'Asked, waiting on them', 'Ask someone from your register');
  const controls = async () => (await get(`/g/controls/${g.child_id}`, alex)).html;
  const card = async () => words(await controls()).split(`Where ${g.first_name} plays`)[1]?.slice(0, 400) ?? '';
  // The club line on the CV reads "<club> — <squad>". Other mentions of a club
  // (history, previous clubs) are not the line D-158 is about.
  const clubLine = async (club) => new RegExp(`${club}\\s*—`).test(words((await get(`/build/${g.record_id}/preview`, alex)).html));
  const squadLinks = async (who) => [...new Set([...(await get('/club/squads', who)).html
    .matchAll(/href="\/club\/squads\/([0-9a-f-]{36})"/g)].map((m) => m[1]))];

  // The club NAME is the assertion here, not decoration. Georgia's club was
  // renamed on 28 Sep because the seed held two clubs called Kingsway Rovers
  // FC — hers in Altona and the verified one in Brunswick West — adjacent on a
  // parent's club picker. If this ever passes against a name that also exists
  // elsewhere in the seed, it has stopped testing what it says it tests.
  check('sqf0: Georgia is her parent\'s here, and her page shows the club she plays for',
    [words((await get('/home', alex)).html).includes(g.first_name), await clubLine('Saltmarsh Rovers FC')], [true, true]);

  // The club door.
  let squadId = null, askForm = null;
  for (const id of await squadLinks(td)) {
    const f = forms((await get(`/club/squads/${id}`, td)).html).find((x) => x.fields.squadId === id && x.fields.personId === g.child_id);
    if (f) { squadId = id; askForm = f; break; }
  }
  check('sqf1: the club is offered Georgia from its own register', Boolean(askForm), true);
  check('sqf2: the club asks her', /done=asked/.test((await postTo(`/club/squads/${squadId}`, td, askForm.fields)).location), true);
  check('sqf3: her parent is told which club and which squad, on his home',
    new RegExp(`Riverside FC would like ${g.first_name} in `).test(words((await get('/home', alex)).html)), true);
  const inviteForm = forms(await controls()).find((f) => 'invitationId' in f.fields && f.fields.answer === 'yes');
  await postTo(`/g/controls/${g.child_id}`, robin, { ...inviteForm.fields });
  check('sqf4: a stranger answering changes nothing (the invitation is still open)',
    forms(await controls()).some((f) => f.fields.invitationId === inviteForm.fields.invitationId), true);

  // sqf4b-e · SAFETY N2. `back` comes off the form, so it is a place inside
  // Pitch or it is /home. On 22 Sep this measured
  // `303 Location: https://evil.example/phish?squad=asked` — a Pitch link
  // that lands a parent on somebody else's page.
  //
  // The invitation id is deliberately not a uuid, so the action returns at
  // its first check and writes nothing: this measures the redirect and only
  // the redirect, and leaves the invitation open for sqf5.
  //
  // The invitation id is a well-formed uuid that matches no row, so the
  // action runs its whole length — through the `for update` select that
  // finds nothing, to `redirect(`${back}?squad=…`)`, which is the sink that
  // actually carries `back`. Nothing is written and sqf5's invitation is
  // untouched; sqf4h says so rather than assuming it.
  //
  // The assertion is the exact header, not the origin it resolves to. An
  // origin assertion scores a 500 with no Location as a pass — the answer
  // would be `new URL('', site)`, which is the site — so it would go green
  // whether the guard worked or the action fell over (L19).
  // The value is `no`, not `declined`. These checks were written on 23 Sep
  // against a product that said `declined`, and the product was corrected —
  // D-108 bars that word on every surface and the permission suite's own
  // url1 (F8) forbids it in an address bar. So for some days this suite
  // asserted, as the expected answer, the exact string another suite exists
  // to forbid: two suites contradicting each other, and the older one wrong
  // (L22). A banned word belongs in a test only as the thing being refused.
  const missing = () => ({ ...inviteForm.fields, invitationId: randomUUID(), answer: 'no' });
  const back = async (value) =>
    (await postTo(`/g/controls/${g.child_id}`, alex, { ...missing(), back: value })).location;
  check('sqf4b: N2 — an absolute `back` is not followed off Pitch',
    await back('https://evil.example/phish'), '/home?squad=no');
  check('sqf4c: nor a protocol-relative one', await back('//evil.example/phish'), '/home?squad=no');
  check('sqf4d: nor a backslash one', await back('/\\evil.example/phish'), '/home?squad=no');
  // A browser strips tabs and newlines before it parses a Location, so this
  // one reached the parser as `//evil.example` under the 23 Sep guard.
  check('sqf4e: nor one behind a tab a browser strips before it parses',
    await back('/\t/evil.example/phish'), '/home?squad=no');
  // Same origin after one parse, off Pitch after the two Next performs when
  // JavaScript is on — which is every real parent.
  check('sqf4f: nor one that only escapes on the second parse',
    await back('/..//evil.example'), '/home?squad=no');
  check('sqf4g: and an honest `back` still takes the parent back',
    await back(`/g/controls/${g.child_id}`), `/g/controls/${g.child_id}?squad=no`);
  check('sqf4h: none of that touched the open invitation',
    forms(await controls()).some((f) => f.fields.invitationId === inviteForm.fields.invitationId), true);

  const yes = await postTo(`/g/controls/${g.child_id}`, alex, { ...inviteForm.fields });
  check('sqf5: her parent says yes from her controls, and she is in the squad',
    [/squad=joined/.test(yes.location), inSquad((await get(`/club/squads/${squadId}`, td)).html).includes(g.first_name), /Riverside FC/.test(await card())],
    [true, true, true]);
  check('sqf6: D-158 — her page no longer shows the club she has left', await clubLine('Saltmarsh Rovers FC'), false);

  // The club takes her out.
  const out = forms((await get(`/club/squads/${squadId}`, td)).html).find((f) => f.fields.personId === g.child_id && f.fields.squadId === squadId && !('invitationId' in f.fields));
  await postTo(`/club/squads/${squadId}`, td, out.fields);
  check('sqf7: the club takes her out, and her parent is offered "Add their club" again',
    [inSquad((await get(`/club/squads/${squadId}`, td)).html).includes(g.first_name), /Add their club/.test(await card())], [false, true]);
  check('sqf8: D-158 — and her page shows no club that took her out', await clubLine('Riverside FC'), false);

  // ---- 0054: a no looks like a silence, and a register is a first name ----
  // The club asks her again and her parent says NO. D-138: the club must not
  // be able to tell that from an unanswered ask, and she must not come back
  // onto the askable list — reappearing there says it for her.
  const askSection = (html) => section(words(html), 'Ask someone from your register');
  const waiting = (html) => section(words(html), 'Asked, waiting on them', 'Ask someone from your register');
  const askAgain = forms((await get(`/club/squads/${squadId}`, td)).html)
    .find((x) => x.fields.squadId === squadId && x.fields.personId === g.child_id);
  check('sqf12: with her out of the squad, the club is offered her again — by first name only (B3)',
    [Boolean(askAgain), askSection((await get(`/club/squads/${squadId}`, td)).html).includes(g.first_name),
     askSection((await get(`/club/squads/${squadId}`, td)).html).includes(g.last_name ?? 'Whitcombe')],
    [true, true, false]);
  await postTo(`/club/squads/${squadId}`, td, askAgain.fields);
  const openView = waiting((await get(`/club/squads/${squadId}`, td)).html);
  const no = forms(await controls()).find((f) => 'invitationId' in f.fields && f.fields.answer === 'no');
  // N2: the redirect target comes off the form, so it is a path inside Pitch
  // or it is /home. QA measured a 303 to an external site.
  const declined = await postTo(`/g/controls/${g.child_id}`, alex, { ...no.fields, back: 'https://evil.example/phish' });
  check('sqf13: an answer cannot be redirected off Pitch (N2)',
    declined.location.startsWith('/home'), true);
  check('sqf14: her parent says no, and the club\'s page reads exactly as it did while nobody had answered (M4, D-138)',
    waiting((await get(`/club/squads/${squadId}`, td)).html), openView);
  check('sqf15: and she is not back on the list of people it can ask, which would say it for her',
    askSection((await get(`/club/squads/${squadId}`, td)).html).includes(g.first_name), false);
  check('sqf16: while the family sees nothing left to answer',
    forms(await controls()).some((f) => 'invitationId' in f.fields), false);
  const takeBack = forms((await get(`/club/squads/${squadId}`, td)).html).find((f) => 'invitationId' in f.fields);
  await postTo(`/club/squads/${squadId}`, td, takeBack.fields);
  check('sqf17: the club takes it back, and she is askable again — the only way it clears before thirty days',
    [waiting((await get(`/club/squads/${squadId}`, td)).html).includes(g.first_name),
     askSection((await get(`/club/squads/${squadId}`, td)).html).includes(g.first_name)], [false, true]);

  // The family door. Her own club in the seed has nobody who can confirm a
  // claim, so the parent asks the club that has — and then she leaves, which
  // needs nobody's permission (D-10).
  // (Since brief M this comes after the club's ask: the family's Leave now
  // takes her off Riverside's register (D-170), and the club's no-looks-like-
  // silence checks above need her on it.)
  const riverside = ids.clubs['riverside-fc'];
  const pick = forms((await get(`/squad/${g.child_id}?club=${riverside}&back=controls`, alex)).html)
    .find((f) => f.fields.personId === g.child_id && f.fields.squadId === squadId);
  const asked = await postTo(`/squad/${g.child_id}`, alex, { ...pick.fields });
  check('sqf9: her parent asks a club to confirm where she plays, from her controls',
    [/squad=asked/.test(asked.location), /Waiting on Riverside FC/.test(await card())], [true, true]);
  const claim = forms((await get(`/club/squads/${squadId}`, td)).html).find((x) => 'claimId' in x.fields && x.fields.answer === 'yes');
  if (claim) await postTo(`/club/squads/${squadId}`, td, claim.fields);
  check('sqf10: the club confirms it, and her parent sees the club on her card',
    [Boolean(claim), inSquad((await get(`/club/squads/${squadId}`, td)).html).includes(g.first_name), /Riverside FC/.test(await card())], [true, true, true]);
  // Her registration at Riverside, as her parent's controls list it — the
  // one Riverside's TD can open.
  const regIds = async () => forms(await controls()).map((f) => f.fields.registrationId).filter(Boolean);
  let rivReg = null;
  for (const id of await regIds()) if ((await get(`/club/register/cv/${id}`, td)).status === 200) { rivReg = id; break; }
  const cameOff = async () => (words(await controls()).match(new RegExp(`${g.first_name} came off a club register`, 'g')) ?? []).length;
  const offBefore = [Boolean(rivReg), await cameOff()];
  const leave = forms(await controls()).find((f) => f.fields.personId === g.child_id && !('claimId' in f.fields) && !('squadId' in f.fields) && f.submit === 'Leave');
  const left = await postTo(`/g/controls/${g.child_id}`, alex, { ...leave.fields });
  check('sqf11: her parent takes her out with one tap, and the club no longer has her',
    [/squad=left/.test(left.location), inSquad((await get(`/club/squads/${squadId}`, td)).html).includes(g.first_name), /Add their club/.test(await card())],
    [true, false, true]);

  check('H2: D-170 — and her family’s registration at Riverside went with her: its TD cannot open the CV from it, the club is not offered her from its register, her controls no longer list it, and her timeline says she came off a club register',
    [offBefore, [(await get(`/club/register/cv/${rivReg}`, td)).status, askSection((await get(`/club/squads/${squadId}`, td)).html).includes(g.first_name),
      (await regIds()).includes(rivReg), await cameOff()]],
    [[true, 0], [404, false, false, 1]]);
}

// ---------------------------------------------------------------------------
// 1 · EVERY FORM SUBMITS WITHOUT JAVASCRIPT.
// ---------------------------------------------------------------------------
const broke = []; const skipped = [];
// Ending a Technical Director's access (0100) ends Marina's seat, which every
// block below leans on. The two doors are pressed — no JavaScript, by the
// wrong people, with and without a reason — in their own block at the end
// (tde-w), which owns them the way x3 owns delete.
const endsTd = (e) => /^End (their access|this Technical Director)/.test(e.form.submit);
for (const e of all) {
  if (/delete/i.test(e.form.submit)) continue;      // x3 owns this one
  if (endsTd(e)) continue;                          // tde-w owns these
  const status = await post(e.form.action ?? e.path, e.who, e.form);
  if (status >= 500) broke.push(`${status} ${e.seat} ${e.path} "${e.form.submit}"`);
}
check(`x1: every form in the product submits with no JavaScript (${broke.join(', ') || 'all do'})`,
  broke.length, 0);
console.log(`     (${all.length - skipped.length} of ${all.length} submitted, uploads included)`);

// ---------------------------------------------------------------------------
// 2 · A DIFFERENT ACCOUNT POSTING THE IDENTICAL FIELDS CHANGES NOTHING.
//     This is the authorisation property, and it is the one that matters:
//     every id in these forms is now a plain form field, which means anybody
//     can read it and post it back. The server has to be what says no.
// ---------------------------------------------------------------------------
const leaked = [];
// The page's CSP nonce is fresh every request (proxy.ts) and rides in
// the page payload, so it is taken out before two renders are compared.
// So is a private photo's signed address (John's ruling §1): minted per read
// with the second it was made, so two renders a second apart differ there
// and nowhere else. The photo's own key stays in; only its stamp and
// signature are taken out (seen as an intermittent x2 on /g/pending, 2 Oct).
const unstamped = (h) => h.replace(/(\/private-photo\/[^?"\s\\]+)\?e=\d+(&amp;|&|\\u0026)s=[A-Za-z0-9_%=-]+/g, '$1?e=E$2s=S');
const settled = (h) => { const n = /nonce="([^"]+)"/.exec(h)?.[1]; return strip(unstamped(n ? h.split(n).join('NONCE') : h)); };
for (const e of all) {
  if (/delete/i.test(e.form.submit)) continue;
  if (endsTd(e)) continue;
  if (!e.who) continue;
  const intruder = Object.values(SEATS).find((p) => p !== e.who);
  const before = settled((await get(e.path, e.who)).html);
  await post(e.form.action ?? e.path, intruder, e.form);
  const after = settled((await get(e.path, e.who)).html);
  if (before !== after) leaked.push(`${e.seat} ${e.path} "${e.form.submit}"`);
}
check(`x2: no form can be driven by another account (${leaked.join(', ') || 'none can'})`,
  leaked.length, 0);

// ---------------------------------------------------------------------------
// 3 · THE ONE-TAP DELETION ACTUALLY COMPLETES.
//     D-26, and the promise a parent is given in plain words on the consent
//     screen. It had NEVER completed: the action revoked the guardianship
//     link instead of deleting it, then the person delete hit that row's
//     foreign key, every press rolled back with a 500, and no test had ever
//     pressed it. "It did not 500" is not the property — the child being
//     gone is, so this checks the page before and after.
// ---------------------------------------------------------------------------
{
  const del = all.find((e) => /delete/i.test(e.form.submit));
  if (!del) {
    check('x3: the guardian can reach a delete control', false, true);
  } else {
    // The guardian's own control page, not the public one: by now the sweep
    // has pressed the pause toggle, and a paused profile goes dark too — so
    // the public page cannot tell "deleted" from "paused". This can.
    const exists = async () => (await get(del.path, del.who)).status === 200;
    check('x3: the guardian can open their child’s controls before deleting', await exists(), true);
    // D-26: the photo files go with the record (bf-erase-w1). The child x3
    // deletes is Deniz, who has photos by now (the photo block): his files on
    // the disk the app writes them to, public and private, and the address
    // his own builder drew his photo at.
    const erased = ids.children.deniz;
    const photoFiles = () => ['.dev-private-uploads', 'public/dev-uploads'].flatMap((dir) => {
      try {
        return readdirSync(fileURLToPath(new URL(`../${dir}/`, import.meta.url))).filter((f) => f.startsWith(`player-${erased.record_id}`)).map((f) => `${dir}/${f}`);
      } catch { return []; }
    });
    const drawnAt = (new RegExp(`<img[^>]*src="([^"]*player[-/]${erased.record_id}[^"]*)"`).exec(
      (await get(`/build/${erased.record_id}`, erased.child_id)).html.replace(/<script[\s\S]*?<\/script>/g, ' '))?.[1] ?? '').replace(/&amp;/g, '&');
    const imgStatus = async () => (drawnAt ? (await fetch(BASE + drawnAt)).status : null);
    const [filesBefore, servedBefore] = [photoFiles(), await imgStatus()];
    const status = await post(del.form.action ?? del.path, del.who, del.form);
    check('x3b: and the deletion completes rather than rolling back', status, 303);
    check('x3c: AND THE CHILD IS GONE — the promise on the consent screen', await exists(), false);
    check(`bf-erase-w1: and so are the child’s photos — every file his rows named (${filesBefore.length} before, public and private) is deleted from the disk, and the address his page drew one at no longer serves it (D-26)`,
      [del.path.includes(erased.child_id), filesBefore.length > 0, servedBefore, photoFiles(), await imgStatus()],
      [true, true, 200, [], 404]);
    const box = (await get('/dev/outbox', ids.people.marina)).html;
    check('x3d: and the parent is told it is done (doc 15 §16)', /Pitch record has been deleted/.test(box) && /Two things remain/.test(box.replace(/<[^>]+>/g, ' ')), true);
  }
}

// ---------------------------------------------------------------------------
// 4 · THE KILL SWITCHES WORK THROUGH THE REAL PAGE (D-94 §10; 0044).
//     Last, because the final check switches off every link in the dev
//     database. In development any signed-in person with an email is an
//     operator (lib/ops-policy), so Marina drives the console here; who may
//     open it in production is pinned by the permission suite.
// ---------------------------------------------------------------------------
{
  const op = ids.people.marina, parent = ids.people.alex;
  const title = (h) => /<title>([^<]*)<\/title>/.exec(h)?.[1];
  const deadTitle = title((await get('/p/never-a-real-link-xyz', null)).html);
  // The sweep above pressed Jordan's "Make a fresh link" too, so dev-jordan is
  // gone by now. Jordan makes a fresh one, and that is the fixture link.
  const jRec = /\/build\/([0-9a-f-]{36})/.exec((await get('/home', ids.people.jordan)).html)?.[1];
  const jFresh = forms((await get(`/send/${jRec}`, ids.people.jordan)).html).find((f) => /Make a fresh link/.test(f.submit));
  const jfd = new FormData();
  for (const [k, v] of Object.entries(jFresh.fields)) jfd.append(k, v);
  const jLoc = (await fetch(BASE + `/send/${jRec}`, { method: 'POST', body: jfd, redirect: 'manual', headers: { cookie: cookieFor(ids.people.jordan) } })).headers.get('location') ?? '';
  const FIXTURE = `/p/${/link=([A-Za-z0-9_-]{20,})/.exec(jLoc)?.[1]}`;
  const jordanLive = title((await get(FIXTURE, null)).html);
  check('ks-w0: the fixture link is live to begin with', jordanLive !== deadTitle, true);
  const drive = async (label, extra) => {
    const form = forms((await get('/ops/switches', op)).html).find((f) => f.submit.startsWith(label));
    if (!form) return 'no form';
    const fd = new FormData();
    for (const [k, v] of Object.entries(form.fields)) fd.append(k, v);
    for (const [k, v] of Object.entries(extra)) fd.append(k, v);
    const r = await fetch(BASE + '/ops/switches', { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(op) } });
    await r.text();
    return r.headers.get('location') ?? '';
  };

  check('ks-w1: a pause with no reason is refused', /error=reason/.test(await drive('Pause every shared link', { reason: '' })), true);
  check('ks-w2: and changed nothing', title((await get(FIXTURE, null)).html), jordanLive);
  check('ks-w3: the pause switches on', /done=paused/.test(await drive('Pause every shared link', { reason: 'write-test drill' })), true);
  check('ks-w4: a live link now shows the dead-link page (D-77)', title((await get(FIXTURE, null)).html), deadTitle);
  // Floodlit (spec I, BUZ 1 Oct): when something is switched off, the switch
  // that brings it back is the screen's one glow; on a normal night nothing
  // glows. Read from the served page in both states, in the markup outside
  // Next's payload.
  const glows = (h) => [...h.replace(/<script[\s\S]*?<\/script>/g, ' ').matchAll(/<button[^>]*class="([^"]*\bfl-glow\b[^"]*)"[^>]*>([^<]*)<\/button>/g)].map((m) => m[2]);
  const pausedPage = (await get('/ops/switches', op)).html.replace(/<!--[\s\S]*?-->/g, '');
  check('op-w1: paused, the one glow is "Switch shared links back on", and the panel says Paused in an amber pill on an amber edge',
    [glows(pausedPage), /<form[^>]*class="card card-amber"[^>]*>(?:(?!<\/form>)[\s\S])*?<span class="pill pill-wait">Paused<\/span>/.test(pausedPage)],
    [['Switch shared links back on'], true]);
  check('ks-w5: switching back on works', /done=resumed/.test(await drive('Switch shared links back on', { reason: 'drill over' })), true);
  check('ks-w6: and the same link is live again', title((await get(FIXTURE, null)).html), jordanLive);
  check('op-w2: back on, nothing on the switches page glows', glows((await get('/ops/switches', op)).html), []);
  const log = (await get('/ops/switches', op)).html;
  check('ks-w7: the switch log names the reason', /write-test drill/.test(log) && /drill over/.test(log), true);

  check('ks-w8: switching off every link without the exact words is refused',
    /error=confirm/.test(await drive('Switch off every link', { reason: 'drill', confirm: 'switch off every link', familyReason: 'A drill sentence that families would read here.' })), true);
  check('ks-w9: and nothing was switched off', title((await get(FIXTURE, null)).html), jordanLive);
  check('ks-w9b: without the sentence families will read, nothing is switched off (doc 15 §38)',
    /error=family/.test(await drive('Switch off every link', { reason: 'drill', confirm: 'SWITCH OFF EVERY LINK' })), true);
  check('ks-w9c: and the link still works', title((await get(FIXTURE, null)).html), jordanLive);
  const FAMILY = 'We found a problem that could have let the wrong person open a link, and we are fixing it.';
  const revoked = await drive('Switch off every link', { reason: 'breach drill', confirm: 'SWITCH OFF EVERY LINK', familyReason: FAMILY });
  check('ks-w10: with the words and the sentence, every link goes, and families are told',
    /done=revoked&n=[1-9]\d*&told=[1-9]/.test(revoked), true);
  const mail = (await get('/dev/outbox', op)).html.replace(/&#x27;|&rsquo;|&#39;/g, "'");
  const s38 = [...mail.matchAll(/We've switched off your Pitch share links/g)].length;
  check('ks-w10b: the §38 email went out, with the operator\'s sentence in it', s38 > 0 && mail.includes(FAMILY), true);
  check('ks-w10c: to the parent and to the adult player', /guardian@example\.com/.test(mail) && /player@example\.com/.test(mail), true);
  check('ks-w11: the fixture link is dead', title((await get(FIXTURE, null)).html), deadTitle);
  // x3 deleted one of Alex's children; the others are still on file.
  const timelines = [];
  for (const c of Object.values(ids.children)) {
    const r = await get(`/g/controls/${c.child_id}`, parent);
    if (r.status === 200) timelines.push(/Pitch switched off every link/.test(r.html));
  }
  check(`ks-w12: and a parent's timeline says Pitch did it, not them (${timelines.length} children)`,
    timelines.length > 0 && timelines.some(Boolean), true);
  check('ks-w13: someone signed out cannot reach the console', (await get('/ops/switches', null)).status, 307);
}

// ---- a club edits its own page (0051, BUZ 19 Sep) --------------------------
{
  const td = ids.people.marina, admin = ids.people.pat, coach = ids.people.sam, parent = ids.people.alex;
  const send = async (who, form, extra) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ ...(form?.fields ?? {}), ...extra })) fd.append(k, v);
    const r = await fetch(BASE + '/club/page-edit', { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(who) } });
    await r.text();
    return { status: r.status, location: r.headers.get('location') ?? '' };
  };
  const words = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&rsquo;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  const pub = async () => words((await get('/fc/riverside-fc', null)).html);
  const editHtml = (await get('/club/page-edit', td)).html;
  const f = forms(editHtml);
  const story = f.find((x) => x.visible.some((v) => v.name === 'philosophy'));
  const wantedForm = f.find((x) => x.visible.some((v) => v.name === 'title') && !x.visible.some((v) => v.name === 'url'));
  const alumniForm = f.find((x) => x.visible.some((v) => v.name === 'who'));
  check('ce1: the club page editor has the story, players-wanted and alumni forms', [Boolean(story), Boolean(wantedForm), Boolean(alumniForm)], [true, true, true]);

  await send(td, story, { philosophy: 'We keep kids in football. Every junior plays.', pathway: 'MiniRoos → Juniors → Seniors', founded: '1974' });
  let page = await pub();
  check('ce2: the TD saves the philosophy and it is on the public page', page.includes('We keep kids in football. Every junior plays.'), true);
  const iTrials = page.indexOf('Trials'), iPhil = page.indexOf('Our philosophy'), iPlay = page.indexOf('Want to play here?');
  check('ce3: the philosophy sits after the trials and before the way in', iTrials < iPhil && iPhil < iPlay, true);
  const badYear = await send(td, story, { philosophy: 'x', pathway: '', founded: '3024' });
  const tooLong = await send(td, story, { philosophy: 'x'.repeat(401), pathway: '', founded: '' });
  check('ce4: a year that is not a year, or 401 characters, is refused, not trimmed',
    [/story=bad/.test(badYear.location), /story=bad/.test(tooLong.location), (await pub()).includes('We keep kids in football.')], [true, true, true]);
  await send(admin, story, { philosophy: 'Set by the club administrator.', pathway: '', founded: '' });
  check('ce5: the club administrator can edit it too', (await pub()).includes('Set by the club administrator.'), true);
  await send(coach, story, { philosophy: 'A coach wrote this.', pathway: '', founded: '' });
  await send(parent, story, { philosophy: 'A parent wrote this.', pathway: '', founded: '' });
  page = await pub();
  check('ce6: a coach or a parent posting the same form changes nothing', [page.includes('A coach wrote this.'), page.includes('A parent wrote this.')], [false, false]);

  await send(td, wantedForm, { title: 'U15 Girls — Centre back', detail: 'Wednesday nights · 2027 squad' });
  check('ce7: a players-wanted notice goes up', (await pub()).includes('U15 Girls — Centre back'), true);
  for (let i = 0; i < 6; i++) await send(td, wantedForm, { title: `Filler notice ${i}`, detail: '' });
  const full = await send(td, wantedForm, { title: 'One too many', detail: '' });
  check('ce8: six notices is the most at once', [/wanted=full/.test(full.location), (await pub()).includes('One too many')], [true, false]);
  const newest = forms((await get('/club/page-edit', td)).html).filter((x) => 'wantedId' in x.fields);
  const html2 = (await get('/club/page-edit', td)).html;
  const centreId = /U15 Girls — Centre back[\s\S]*?name="wantedId" value="([0-9a-f-]{36})"/.exec(html2)?.[1];
  await send(td, newest[0], { wantedId: centreId });
  check('ce9: and one comes down', (await pub()).includes('U15 Girls — Centre back'), false);

  const noTick = await send(td, alumniForm, { who: 'Nico P.', to: 'A-League Youth', detail: 'Juniors 2014–2020' });
  check('ce10: an alumni entry without "Everyone named here is 18 or over" is refused, even without the form',
    [/alumni=tick/.test(noTick.location), (await pub()).includes('Nico P.')], [true, false]);
  await send(td, alumniForm, { who: 'Nico P.', to: 'A-League Youth', detail: 'Juniors 2014–2020', adults: 'yes' });
  page = await pub();
  check('ce11: with the tick it goes on the wall, as who → where', page.includes('Nico P.') && page.includes('A-League Youth'), true);
  await send(coach, alumniForm, { who: 'Coach Entry', to: 'Nowhere', detail: '', adults: 'yes' });
  check('ce12: a coach cannot add to the wall', (await pub()).includes('Coach Entry'), false);
  const html3 = (await get('/club/page-edit', td)).html;
  const nicoId = /Nico P\.[\s\S]*?name="alumniId" value="([0-9a-f-]{36})"/.exec(html3)?.[1];
  const af = forms(html3).find((x) => 'alumniId' in x.fields);
  await send(td, af, { alumniId: nicoId });
  check('ce13: and the TD can take it down', (await pub()).includes('Nico P.'), false);

  // Club colours (0160, D-173, BUZ 1 Oct).
  const rawPub = async () => (await get('/fc/riverside-fc', null)).html;
  const colourForm = forms((await get('/club/page-edit', td)).html).find((x) => x.visible.some((v) => v.name === 'primary'));
  check('cc1: the editor has the club colours form', Boolean(colourForm), true);
  // John's condition 3 (D-174), at the point of choosing, in BUZ's approved words.
  check('cvcol-w4: the colours form tells the club its colours also go on its players\u2019 CVs',
    words((await get('/club/page-edit', td)).html).includes('Your colours appear on your club page, and on the CV of players who list your club as their current club.'), true);
  await send(td, colourForm, { preset: '0' });
  let raw = await rawPub();
  check('cc2: the TD picks a pair and the page wears it — the trim runs under the hero and the month on a trial',
    [/border-bottom:5px solid #f2b134/.test(raw), (raw.match(/color:#f2b134/g) ?? []).length > 0], [true, true]);
  await send(admin, colourForm, { preset: 'custom', primary: '#0F3F86', secondary: '#ffffff' });
  raw = await rawPub();
  check('cc3: the administrator can set the club\u2019s own two colours (upper case is taken as the same colour)',
    /border-bottom:5px solid #ffffff/.test(raw), true);
  const badHex = await send(td, colourForm, { preset: 'custom', primary: 'red', secondary: '#ffffff' });
  const noPick = await send(td, colourForm, { preset: '99' });
  check('cc4: a colour that is not a colour, or a pair that does not exist, is refused, not guessed',
    [/colours=bad/.test(badHex.location), /colours=bad/.test(noPick.location), /border-bottom:5px solid #ffffff/.test(await rawPub())], [true, true, true]);
  await send(coach, colourForm, { preset: '4' });
  await send(parent, colourForm, { preset: '4' });
  check('cc5: a coach or a parent posting the same form changes nothing', /border-bottom:5px solid #ffffff/.test(await rawPub()), true);
  const clearForm = forms((await get('/club/page-edit', td)).html).find((x) => /Pitch green/.test(x.submit ?? ''));
  await send(td, clearForm, {});
  check('cc6: and the club can go back to Pitch green', [Boolean(clearForm), /border-bottom:5px solid/.test(await rawPub())], [true, false]);
  const unclaimedRaw = (await get('/fc/westgate-rangers', null)).html;
  check('cc7: an unclaimed page never wears club colours', /border-bottom:5px solid/.test(unclaimedRaw), false);
}

// ---- who is in each squad (0052, D-158) ------------------------------------
// The family asks and the club confirms; the club asks and the family
// accepts. Both doors end at one membership, and the membership is what puts
// a club on a public CV.
{
  const td = ids.people.marina, admin = ids.people.pat, coach = ids.people.sam;
  const jordan = ids.people.jordan, alex = ids.people.alex, nate = ids.children.nate;
  const deniz = ids.children.deniz;
  const words = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&rsquo;/g, "'").replace(/\s+/g, ' ');
  const postTo = async (path, who, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual', headers: who ? { cookie: cookieFor(who) } : {} });
    await r.text();
    return { status: r.status, location: r.headers.get('location') ?? '' };
  };
  const formOn = async (path, who, has) => forms((await get(path, who)).html).find((f) => f.visible.some((v) => v.name === has) || has in (f.fields ?? {}));
  // A section of the club's page: from its heading to whichever heading comes
  // next. Without the "whichever", a removed player reads as still there —
  // they reappear lower down as someone the club may ask again.
  const section = (html, from, ...untils) => {
    const t = words(html);
    const a = t.indexOf(from); if (a < 0) return '';
    const ends = untils.map((u) => t.indexOf(u, a + from.length)).filter((i) => i > 0);
    return t.slice(a, ends.length ? Math.min(...ends) : undefined);
  };
  const squadsHtml = (await get('/club/squads', td)).html;
  const u15 = /href="\/club\/squads\/([0-9a-f-]{36})"[^>]*>U15 Boys</.exec(squadsHtml)?.[1]
    ?? [...squadsHtml.matchAll(/href="\/club\/squads\/([0-9a-f-]{36})"/g)][0]?.[1];
  check('sq1: the squads list links into a squad', Boolean(u15), true);

  // The family door. Jordan is an adult and acts alone (D-91 from 16).
  const leaveForm = await formOn('/home', jordan, 'personId');
  await postTo('/home', jordan, { ...(leaveForm?.fields ?? {}), personId: jordan, back: '/home' });
  const ask = await postTo(`/squad/${jordan}`, jordan, {
    ...((await formOn(`/squad/${jordan}?club=${ids.clubs['riverside-fc']}`, jordan, 'squadId'))?.fields ?? {}),
    personId: jordan, squadId: u15, back: '/home',
  });
  check('sq2: an adult player asks a club to confirm where they play', /squad=asked/.test(ask.location), true);
  const clubView = words((await get(`/club/squads/${u15}`, td)).html);
  check('sq3: it lands on the club\'s squad page as something waiting on them', /says they play here/.test(clubView), true);
  // Their own page, as a club sees it (the sweep has already replaced the
  // dev share link by this point, so the preview is the honest surface).
  const jordanRec = /href="\/build\/([0-9a-f-]{36})\/preview"/.exec((await get('/home', jordan)).html)?.[1];
  check('sq4: and nothing is on their page until the club confirms it',
    words((await get(`/build/${jordanRec}/preview`, jordan)).html).includes('Riverside FC'), false);

  const claimForm = forms((await get(`/club/squads/${u15}`, td)).html).find((f) => 'claimId' in f.fields);
  check('sq5: a coach cannot confirm it', (await postTo(`/club/squads/${u15}`, coach, { ...claimForm.fields, answer: 'yes' })).location, '/home');
  await postTo(`/club/squads/${u15}`, td, { ...claimForm.fields, answer: 'yes' });
  const roster = words((await get(`/club/squads/${u15}`, td)).html);
  check('sq6: confirmed, the player is in the squad', /Jordan/.test(roster), true);
  const jordanPage = words((await get(`/build/${jordanRec}/preview`, jordan)).html);
  check('sq7: and now their page says the club and the squad',
    [jordanPage.includes('Riverside FC'), jordanPage.includes('U15 Boys')], [true, true]);

  // Who may read the squad, and how much of it.
  const adminView = words((await get(`/club/squads/${u15}`, admin)).html);
  check('sq8: an administrator sees who plays and no way into a record',
    [/Jordan/.test(adminView), /Open the CV/.test(adminView)], [true, false]);
  check('sq8b: nor anything off the record — no positions, no number, no stats (0053)',
    [/1st /.test(adminView), /self-reported/.test(adminView)], [false, false]);
  const tdView = words((await get(`/club/squads/${u15}`, td)).html);
  check('sq8c: the TD\'s list reads like a team sheet: the shape of the squad, then each player\'s own order of positions',
    // The keeper tile is there whether or not the squad has one — U15 Boys has none,
    // so it says so in words (D-162), never "0 Goalkeepers".
    [/Goalkeepers?|No goalkeeper yet/.test(tdView), /1st /.test(tdView), /In the squad since/.test(tdView)], [true, true, true]);
  check('sq8d: a squad without a keeper says so in words, never with a zero (D-162)',
    [/No goalkeeper yet/.test(tdView), /\b0\s*Goalkeepers?\b/i.test(tdView)], [true, false]);
  check('sq9: the TD can open a squad player\'s CV', /Open the CV/.test(roster), true);
  const cvHref = /href="(\/club\/squads\/[0-9a-f-]{36}\/cv\/[0-9a-f-]{36})"/.exec((await get(`/club/squads/${u15}`, td)).html)?.[1];
  check('sq10: and it opens for the TD, not for an administrator or a stranger',
    [(await get(cvHref, td)).status, (await get(cvHref, admin)).status, (await get(cvHref, ids.people.robin)).status], [200, 404, 404]);

  // The club door, and an under-16's answer is their parent's.
  // A different squad: Deniz is already in U15 Boys from the seed, and the
  // database refuses a second membership of the same squad.
  const other = [...new Set([...squadsHtml.matchAll(/href="\/club\/squads\/([0-9a-f-]{36})"/g)].map((m) => m[1]))].find((id) => id !== u15);
  // Whoever the register actually offers by this point in the sweep: earlier
  // blocks pause and hide people, and a paused child is correctly invisible.
  const askPage = (await get(`/club/squads/${other}`, td)).html;
  // A child whose parent still holds them at this point in the sweep: earlier
  // blocks pause, suppress and delete, and all three are correct reasons for
  // a child to be missing from a register or from a parent's home.
  const alexHome = words((await get('/home', alex)).html);
  const held = [deniz, ids.children.georgia, nate]
    .filter((c) => alexHome.includes(c.first_name))
    .map((c) => c.child_id);
  const askForm = forms(askPage).find((f) => f.fields.squadId === other && held.includes(f.fields.personId))
    ?? forms(askPage).find((f) => f.fields.squadId === other && f.fields.personId);
  check('sq11a: the TD is offered the players on their own register', Boolean(askForm), true);
  // The register's own positions, on the list the club picks from, with a
  // filter over them: a club filling a squad is looking for a keeper.
  const askSection = section(askPage, 'Ask someone from your register');
  check('sq11b: each of them is offered with the positions their family gave',
    [/1st /.test(askSection), /Goalkeeper|Striker|midfielder|back|wing/.test(askSection)], [true, true]);
  // Filtering means "plays there", first choice or not: a striker who also
  // keeps is exactly who a club short of a keeper wants to see.
  const rowsOf = (html) => section(html, 'Ask someone from your register')
    .split('Ask them').slice(0, -1).map((r) => r.trim()).filter(Boolean);
  const all = rowsOf(askPage);
  const gk = rowsOf((await get(`/club/squads/${other}?pos=GK`, td)).html);
  check('sq11c: filtering by a position narrows the list, and everyone left plays there',
    [gk.length > 0, gk.length < all.length, gk.every((r) => r.includes('Goalkeeper'))], [true, true, true]);
  const invitedId = askForm?.fields.personId;
  const invitedIsAlexs = held.includes(invitedId);
  const denizInvite = await postTo(`/club/squads/${other}`, td, { ...askForm.fields });
  check('sq11: the club asks a player from its own register', /done=asked/.test(denizInvite.location), true);
  // Read the club's page in sections: a player removed from a squad becomes
  // askable again, so "their name appears" is not the same question twice.
  const otherPage = (await get(`/club/squads/${other}`, td)).html;
  check('sq12: the club sees it as asked, waiting on them',
    section(otherPage, 'Asked, waiting on them', 'Ask someone from your register').length > 0, true);
  const parentHome = words((await get('/home', alex)).html);
  check('sq12b: and a parent of that child is told which club and which squad',
    !invitedIsAlexs || /would like \w+ in /.test(parentHome), true);

  // The form the person who may answer actually sees.
  const inviteForm = invitedIsAlexs
    ? forms((await get(`/g/controls/${invitedId}`, alex)).html).find((f) => 'invitationId' in f.fields)
    : null;
  if (inviteForm) {
    // A stranger's answer is a no-op that reveals nothing: same redirect as
    // the real one (D-77), and the invitation is still waiting afterwards.
    await postTo(`/g/controls/${invitedId}`, ids.people.robin, { ...inviteForm.fields, answer: 'yes' });
    const stillOpen = forms((await get(`/g/controls/${invitedId}`, alex)).html).some((f) => 'invitationId' in f.fields);
    check('sq13: a stranger answering changes nothing, and learns nothing', stillOpen, true);
    await postTo(`/g/controls/${invitedId}`, alex, { ...inviteForm.fields, answer: 'yes', back: `/g/controls/${invitedId}` });
    const after = (await get(`/club/squads/${other}`, td)).html;
    check('sq14: the person who may answer says yes, and they are in the squad',
      section(after, 'In this squad', 'Asked, waiting on them', 'Ask someone from your register').includes('Open the CV'), true);
  } else {
    // Say so rather than pass in silence (QA, 22 Sep): in a full sweep no
    // child of Alex's is left by here. sqf3-sqf5 walk the same doors earlier.
    console.log('SKIP sq12b/sq13/sq14: the club asked someone who is not Alex\'s child — covered by sqf3, sqf4, sqf5');
  }

  const inSquad = (html) => section(html, 'In this squad', 'Asked, waiting on them', 'Ask someone from your register');
  const u15Page = (await get(`/club/squads/${u15}`, td)).html;
  check('sq15a: Jordan is in the squad before the club removes him', inSquad(u15Page).includes('Jordan'), true);
  const out = forms(u15Page).find((f) => f.fields.personId === jordan && 'squadId' in f.fields);
  await postTo(`/club/squads/${u15}`, td, { ...out.fields });
  check('sq15: the club takes a player out, and nothing of theirs is deleted',
    [inSquad((await get(`/club/squads/${u15}`, td)).html).includes('Jordan'), (await get(`/build/${jordanRec}/preview`, jordan)).status],
    [false, 200]);
  void nate;
}

// ---------------------------------------------------------------------------
// THE CALL SHEET RECORDS THE TECHNICAL DIRECTOR (0058; BUZ, 23 Sep).
// Walked through the real console: the queue, the sheet, the press, and the
// person's own confirm link. LAST, because it verifies Quarrymead — the seat
// every "unverified club" check above depends on being unverified.
// ---------------------------------------------------------------------------
{
  const op = ids.people.marina;
  const words = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&rsquo;|&#39;/g, "'").replace(/\s+/g, ' ');
  const send = async (path, extra) => {
    const form = forms((await get(path, op)).html).find((f) => f.visible.some((v) => v.name === 'outcome'));
    const fd = new FormData();
    for (const [k, v] of Object.entries({ ...form.fields, ...extra })) fd.append(k, v);
    const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(op) } });
    await r.text();
    return r.headers.get('location') ?? '';
  };
  // Find Quarrymead's call sheet the way the operator does — from the queue.
  const queue = (await get('/ops/verification', op)).html;
  let sheet = null;
  for (const m of new Set([...queue.matchAll(/href="(\/ops\/call\/[0-9a-f-]{36})"/g)].map((x) => x[1]))) {
    if (/Quarrymead United/.test((await get(m, op)).html)) { sheet = m; break; }
  }
  check('td-w1: the queue links to a call sheet for the club awaiting a call', Boolean(sheet), true);
  check('td-w2: a club nobody has called has no technical director, and the console says so',
    /No Technical Director recorded/.test(words(queue)), true);

  const call = { operator: 'BUZ', number_called: '03 9000 0500', number_source: 'FV club directory',
    answered_by: 'Committee', club_confirmed: 'yes', person_confirmed: 'yes',
    incorporated: 'yes', authority_confirmed: 'yes', notes: 'write-test drill' };
  // Doc 15 §39 (0166), read off the outbox the way the operator's call
  // would have left it: each message, its address, and its words. Quarrymead
  // has never been verified, so every §39 naming it came from a press below.
  const outbox = async () => words((await get('/dev/outbox', op)).html).split(/(?=doc15\.§)/)
    .map((m) => ({ key: /^doc15\.§[^\s]+/.exec(m)?.[0], to: /^\S+ → (\S+)/.exec(m)?.[1], text: m }));
  const verifiedMails = async () => (await outbox()).filter((m) => m.key === 'doc15.§39' && m.text.includes('We spoke to Quarrymead United'));
  const melbDay = () => new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Melbourne' });
  await send(sheet, { ...call, outcome: 'not_verified', td_name: 'Nobody Atall', td_email: 'nobody@example.com' });
  check('td-w3: a call that did not verify the club records no technical director either',
    /None recorded/.test(words((await get(sheet, op)).html)), true);
  check('ve-w1: JOHN — a call recorded "not verified" sends nobody §39', (await verifiedMails()).length, 0);

  // The real thing: verified, and the person the club named. Casey Duarte's
  // address is the one nobody has proved yet (dev seed), so this is the
  // recorded-but-not-yet-active state.
  // The day is read either side of the press, so a press that straddles
  // Melbourne's midnight is not a failure (L34).
  const dayBefore = melbDay();
  await send(sheet, { ...call, outcome: 'verified', td_name: 'Casey Duarte', td_email: 'unproved@example.com' });
  const dayAfter = melbDay();
  const mails = await verifiedMails();
  const body = /We spoke to[\s\S]*?— Pitch/.exec(mails[0]?.text ?? '')?.[0] ?? '';
  const day = [dayBefore, dayAfter].find((d) => body.includes(`on ${d},`)) ?? null;
  check('ve-w2: the verified call sends §39 once, to the administrator the club named on it, at their own address, dated today in Melbourne',
    [mails.length, mails[0]?.to, /Quarrymead United is verified on Pitch/.test(mails[0]?.text ?? ''), Boolean(day)],
    [1, 'quarrymead@example.com', true, true]);
  check('ve-w3: JOHN — never to the club’s published address',
    (await outbox()).some((m) => m.key === 'doc15.§39' && /quarrymeadunited\.example\.au/i.test(m.to ?? '')), false);
  check('ve-w4: JOHN — no guardian or player receives it: not the parent, not the adult player, not the 16–17, not the Technical Director the call named',
    (await outbox()).some((m) => m.key === 'doc15.§39' && ['guardian@example.com', 'player@example.com', 'nate@example.com', 'unproved@example.com'].includes(m.to)), false);
  check('ve-w5: JOHN — its body carries no digit but the date',
    [body.length > 0, /\d/.test(body.replace(day ?? '\u0000', ''))], [true, false]);
  const recorded = words((await get(sheet, op)).html);
  check('td-w4: the call records the person, by name, against the operator who took it',
    [/Casey Duarte/.test(recorded), /unproved@example\.com/.test(recorded), /Recorded by BUZ/.test(recorded)], [true, true, true]);
  check('td-w5: and the role is waiting on that person\'s account, not live (L21)',
    [/Waiting on their account/.test(recorded), /Active\./.test(recorded)], [true, false]);
  check('td-w5b: the queue says the same in one line',
    /Technical Director Casey Duarte · waiting on their account · recorded by BUZ/.test(words((await get('/ops/verification', op)).html)), true);

  // The person confirms their own address — the link the seed left unopened.
  const confirmPage = await get('/confirm/dev-unproved', null);
  const confirmForm = forms(confirmPage.html).find((f) => /Yes, it/.test(f.submit));
  const cfd = new FormData();
  for (const [k, v] of Object.entries(confirmForm.fields)) cfd.append(k, v);
  await (await fetch(BASE + '/confirm/dev-unproved', { method: 'POST', body: cfd, redirect: 'manual' })).text();
  const live = words((await get(sheet, op)).html);
  check('td-w6: pressing their own confirm link is what switches the role on',
    [/Active\./.test(live), /Waiting on their account/.test(live)], [true, false]);
  check('td-w6b: and the queue agrees',
    /Technical Director Casey Duarte · active · recorded by BUZ/.test(words((await get('/ops/verification', op)).html)), true);

  // JOHN 4, through the real sheet: every other way out of verified sends
  // nobody §39, and a verified call afterwards sends it again — once per
  // verification. It leaves Quarrymead verified with Casey live, as the
  // suspension block below expects.
  for (const [outcome, cls] of [['suspended', 'administrative'], ['takedown', ''], ['not_verified', '']]) {
    await send(sheet, { ...call, outcome, suspension_reason: cls });
    check(`ve-w6: JOHN — a call recorded "${outcome.replace('_', ' ')}" sends nobody §39`, (await verifiedMails()).length, 1);
  }
  await send(sheet, { ...call, outcome: 'verified', td_name: 'Casey Duarte', td_email: 'unproved@example.com' });
  check('ve-w7: a re-verification sends §39 again, once, to the same named administrator — and Casey is still the live Technical Director',
    [(await verifiedMails()).map((m) => m.to), /Technical Director Casey Duarte · active/.test(words((await get('/ops/verification', op)).html))],
    [['quarrymead@example.com', 'quarrymead@example.com'], true]);
}

// ---------------------------------------------------------------------------
// A CLUB IS SUSPENDED AND THE FAMILIES ARE TOLD — or are not, which is the
// half that has to be right (doc 31 M11/L29; doc 15 §37; 0066).
//
// Every piece of this existed in 0025 and nothing connected them: the reason
// class, the recipient function, the undo token, the /undo page and the words.
// The suspend button shipped, so an operator could take a club down for a
// child-safety reason and no family holding a live link to it learnt anything.
//
// Walked through the real screens, and the outbox read for what would actually
// have gone. Straight after the Technical Director block, because it suspends
// Quarrymead — the club that block verifies, and the seat every "unverified club"
// check earlier depends on — and before the sessions block, which ends every
// session the parent holds. Georgia, not Deniz: the deletion test (x3) has
// deleted Deniz by now, and Georgia survives the suite.
// ---------------------------------------------------------------------------
{
  const op = ids.people.marina, parent = ids.people.alex, kid = ids.children.georgia;
  const plain = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&rsquo;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  const box = async () => plain((await get('/dev/outbox', parent)).html);
  const deverifies = async () => ((await box()).match(/doc15\.§37/g) ?? []).length;
  const postTo = async (path, who, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual', headers: who ? { cookie: cookieFor(who) } : {} });
    await r.text();
    return r.headers.get('location') ?? '';
  };
  const logCall = async (sheet, extra) => {
    const form = forms((await get(sheet, op)).html).find((f) => f.visible.some((v) => v.name === 'outcome'));
    return postTo(sheet, op, { ...form.fields,
      operator: 'BUZ', number_called: '03 9000 0500', number_source: 'FV club directory',
      answered_by: 'Committee', club_confirmed: 'yes', person_confirmed: 'yes',
      incorporated: 'yes', authority_confirmed: 'yes', notes: 'suspension drill', ...extra });
  };

  // Quarrymead's sheet, found the way the operator finds it. The block above left
  // it verified with a live Technical Director.
  const queue = (await get('/ops/verification', op)).html;
  let sheet = null;
  for (const m of new Set([...queue.matchAll(/href="(\/ops\/call\/[0-9a-f-]{36})"/g)].map((x) => x[1]))) {
    if (/Quarrymead United/.test((await get(m, op)).html)) { sheet = m; break; }
  }
  check('susp-w0: the call sheet now asks the operator WHY, from a closed list',
    /name="suspension_reason"/.test((await get(sheet, op)).html)
      && /value="child_safety"/.test((await get(sheet, op)).html), true);

  // A family sends Georgia's CV to Quarrymead, and to one other club, the whole
  // way: the child asks, the parent checks the address and presses send
  // (D-91, D-99). The second send is the family that must NOT be touched.
  const sendTo = async (clubName, address) => {
    // The child asks, in her own seat; the parent then presses send on /g/send.
    const sendForm = forms((await get(`/send/${kid.record_id}`, kid.child_id)).html).find((x) => x.visible.some((v) => v.name === 'clubName'));
    await postTo(`/send/${kid.record_id}`, kid.child_id, { ...sendForm.fields, clubName, address });
    // The outbox is newest first; the §20 that names this address carries
    // the parent's own confirm link.
    const text = await box();
    const at = text.indexOf(`It goes to: ${address}`);
    const ask = /\/g\/send\/([0-9a-f-]{36})/.exec(text.slice(at))?.[1];
    const gSend = forms((await get(`/g/send/${ask}`, parent)).html).find((f) => 'requestId' in f.fields);
    await postTo(`/g/send/${ask}`, parent, gSend.fields);
  };
  await sendTo('Quarrymead United', 'football@quarrymeadunited.example.au');
  await sendTo('Elsewhere FC', 'football@elsewhere.example.au');
  check('susp-w1: the parent has sent Georgia\u2019s CV to Quarrymead, and to one other club',
    [/doc15\.§19 → football@quarrymeadunited\.example\.au/.test(await box()),
     /doc15\.§19 → football@elsewhere\.example\.au/.test(await box())], [true, true]);

  // ---- The ordinary suspension. Nobody is told, and that is the ruling. ----
  const before = await deverifies();
  await logCall(sheet, { outcome: 'suspended', suspension_reason: 'administrative' });
  check('susp-w2: an ADMINISTRATIVE suspension takes the club down',
    /Quarrymead United[\s\S]{0,400}?Suspended/.test(plain((await get('/ops/verification', op)).html)), true);
  check('susp-w3: and tells NOBODY — no family is alarmed because a club’s paperwork lapsed',
    await deverifies(), before);
  // The link the family sent is untouched either way: this is L29, and it is
  // the whole reason M11 was recorded unbuildable.
  const controls = async () => plain((await get(`/g/controls/${kid.child_id}`, parent)).html);
  check('susp-w4: the family’s link still works — we never revoke on their behalf',
    /football@quarrymeadunited\.example\.au[\s\S]{0,200}?Switch off/.test(await controls()), true);

  // ---- The child-safety suspension. Every affected family, once each. ----
  await logCall(sheet, { outcome: 'verified', td_name: 'Casey Duarte', td_email: 'unproved@example.com' });
  await logCall(sheet, { outcome: 'suspended', suspension_reason: 'child_safety' });
  const after = await box();
  check('susp-w5: a CHILD-SAFETY suspension emails the guardian whose live link went to that club (§37)',
    /doc15\.§37 → guardian@example\.com/.test(after), true);
  const notice = (after.split('doc15.\u00a737')[1] ?? '').slice(0, 1200);
  check('susp-w6: naming the club and the child',
    [/Quarrymead United is no longer a verified club on Pitch/.test(notice),
     /You sent them a link to Georgia's page/.test(notice)], [true, true]);
  check('susp-w6b: and saying nothing about why — that is somebody else\u2019s information',
    /allegation|complaint|investigat|report|safety concern/i.test(notice), false);
  check('susp-w7: and it carries the one-tap switch, not a sign-in hunt',
    /Switch this link off: (https?:\/\/)?pitchfootball\.com\.au\/undo\/[A-Za-z0-9_-]{20,}/.test(notice), true);
  check('susp-w8: exactly one message, not one per suspension already sent',
    (after.match(/doc15\.§37/g) ?? []).length, 1);
  check('susp-w9: it has not switched the link off for them — the button is still to press',
    /football@quarrymeadunited\.example\.au[\s\S]{0,200}?Switch off/.test(await controls()), true);

  // The parent presses it. That is the family unmaking their own disclosure.
  const undo = /\/undo\/([A-Za-z0-9_-]{20,})/.exec(after.split('doc15.§37')[1] ?? '')?.[1];
  const undoForm = forms((await get(`/undo/${undo}`, null)).html).find((f) => 'token' in f.fields);
  // The family's history, from its heading to the delete panel (L11).
  const history = async () => (await controls()).split('Everything that’s happened')[1]?.split('Delete everything')[0] ?? '';
  const switchedOff = async () => ((await history()).match(/One club’s link was switched off/g) ?? []).length;
  const offBefore = await switchedOff();
  const pressed = await postTo(`/undo/${undo}`, null, undoForm.fields);
  check('susp-w10: one tap from the email switches that club’s link off, with no sign-in',
    /football@quarrymeadunited\.example\.au[\s\S]{0,200}?Off /.test(await controls()), true);
  // §6 (John, 1 Oct): "The undo writes no consent event: it should." The
  // family's history now says so, in its existing words for a switched-off link.
  check('jb-undo-w1: and the family history records it — one more "One club’s link was switched off", pressed by the guardian it was sent to',
    [Boolean(await history()), (await switchedOff()) - offBefore], [true, 1]);
  // G-P1 (John, 1 Oct: a live defect). The press says it worked only because
  // it did: Done is where a press that switched a link off lands, it keeps
  // the "does not un-send" box, and it offers nothing more to press.
  const doneAt = pressed.replace(BASE, '');
  const donePage = await get(doneAt, null);
  check('jr-undo-w1: the press that switched the link off lands on Done, which says so, keeps "This does not un-send the email", and has no button',
    [doneAt, donePage.status, /<h1[^>]*>Done<\/h1>/.test(donePage.html),
     /The club will not be able to open the page any more\./.test(plain(donePage.html)),
     /This does not un-send the email\./.test(plain(donePage.html)), forms(donePage.html).length],
    ['/undo/done', 200, true, true, true, 0]);
  // The same press again: the link is spent, so it switches nothing off and
  // says so, rather than showing the question again.
  const again = await postTo(`/undo/${undo}`, null, undoForm.fields);
  const reopened = await get(`/undo/${undo}`, null);
  check('jr-undo-w2: pressing the spent link again lands on the not-live panel, never Done — and opening it shows that panel with "Go to sign in"',
    [again.replace(BASE, ''), /This link isn.t live/.test(plain(reopened.html)), /href="\/signin"[^>]*>Go to sign in/.test(reopened.html),
     forms(reopened.html).length, /Switch this link off\?/.test(plain(reopened.html))],
    [`/undo/${undo}`, true, true, 0, false]);
  check('susp-w11: and every other club’s link keeps working — a family is not punished for what a club did',
    /football@elsewhere\.example\.au[\s\S]{0,200}?Switch off/.test(await controls()), true);
}

// ---------------------------------------------------------------------------
// THE ADDRESS BAR AFTER A GUARDIAN'S SEND (brief D, 29 Sep; doc 14 L38/L42).
// A real send redirected to `?sent=1&link=<the raw token>` and a limited one
// to `?sent=1`: the address said whether the limit bit, and a live link to
// the child's CV sat in the browser's history. Pressed here as the parent
// presses it, until the daily limit holds one, and the two answers compared
// whole. Which press went and which was held is read off the outbox (the
// club's §19 email goes for a real send only), never assumed. Georgia, as the
// block above; after it, because the limit it reaches is the parent's for
// the day, and before the sessions block, which signs the parent out.
// ---------------------------------------------------------------------------
{
  const parent = ids.people.alex, kid = ids.children.georgia;
  const plain = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&rsquo;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  const box = async () => plain((await get('/dev/outbox', parent)).html);
  const pressed = [];
  // The parent's allowance is ten a day (SEND_DAILY_CAP), some of it spent
  // above; twelve presses reach the limit from anywhere short of it.
  for (let i = 0; i < 12; i++) {
    const address = `press-${i}@addressbar.example.au`;
    // Georgia composes each one in her own seat; the press measured is the
    // parent's on /g/send (a parent composing on /send sends it there, C-P4).
    const sendForm = forms((await get(`/send/${kid.record_id}`, kid.child_id)).html).find((x) => x.visible.some((v) => v.name === 'clubName'));
    if (!sendForm) break;
    const fd = new FormData();
    for (const [k, v] of Object.entries({ ...sendForm.fields, clubName: 'Addressbar FC', address })) fd.append(k, v);
    await (await fetch(BASE + `/send/${kid.record_id}`, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(kid.child_id) } })).text();
    const text = await box();
    const ask = /\/g\/send\/([0-9a-f-]{36})/.exec(text.slice(text.indexOf(`It goes to: ${address}`)))?.[1];
    const gSend = ask && forms((await get(`/g/send/${ask}`, parent)).html).find((f) => 'requestId' in f.fields);
    if (!gSend) break;
    const gfd = new FormData();
    for (const [k, v] of Object.entries(gSend.fields)) gfd.append(k, v);
    const r = await fetch(BASE + `/g/send/${ask}`, { method: 'POST', body: gfd, redirect: 'manual', headers: { cookie: cookieFor(parent) } });
    const body = await r.text();
    const at = (s) => s.split(ask).join('<request>').replace(/'nonce-[^']+'/g, "'nonce-<per-request>'");
    pressed.push({ address, location: r.headers.get('location') ?? '',
      shape: JSON.stringify([r.status, at(r.headers.get('location') ?? ''), at(body),
        [...r.headers.entries()].filter(([k]) => k !== 'date').map(([k, v]) => [k, at(v)])]) });
  }
  const sent = await box();
  const real = pressed.filter((p) => sent.includes(`doc15.§19 → ${p.address}`));
  const held = pressed.filter((p) => !sent.includes(`doc15.§19 → ${p.address}`));
  check('addr-w1 setup: the parent pressed send until the daily limit held one — some went to the club, the rest did not',
    [pressed.length, real.length > 0, held.length > 0], [12, true, true]);
  check('addr-w1: a real send and a limited one answer byte for byte alike — status, Location, body, every header (the request’s own id and the date aside)',
    [...new Set([real[0]?.shape, held[0]?.shape, ...pressed.map((p) => p.shape)])].length, 1);
  check('addr-w2: and the address both land on is exactly /g/send/<request>?sent=1 — no link, no token, nothing more',
    [...new Set(pressed.map((p) => p.location.replace(BASE, '').replace(/\/g\/send\/[0-9a-f-]{36}/, '/g/send/<request>')))], ['/g/send/<request>?sent=1']);
}

// ---------------------------------------------------------------------------
// C-P4 · safety review S-2: the parent's own press, at the limit. addr-w has
// just taken the parent to the day's limit, so this press is held. It must
// answer exactly as the parent's real press did (L38), send nothing, and —
// unlike before — show on the child's controls as one that didn't go (0046),
// so the parent does not go on believing the club has the CV.
// ---------------------------------------------------------------------------
{
  const parent = ids.people.alex, kid = ids.children.georgia;
  const plain = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'").replace(/&rsquo;/g, '’').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  const form = forms((await get(`/send/${kid.record_id}`, parent)).html).find((x) => x.visible.some((v) => v.name === 'clubName'));
  const held = form ? await parentPress(kid.record_id, { ...form.fields, clubName: 'Held Parent FC', address: 'held-parent@addressbar.example.au' }) : null;
  check('C-P4-w16: the parent’s limited press answers byte for byte as their real one did — status, Location, body, every header',
    [Boolean(realParentPress), held?.shape === realParentPress, held?.location], [true, true, `/send/${kid.record_id}?sent=1`]);
  const box = plain((await get('/dev/outbox', parent)).html);
  const ctl = plain((await get(`/g/controls/${kid.child_id}`, parent)).html);
  check('C-P4-w17: nothing reaches the club, and the child’s controls list it as one that didn’t go — the club’s name, no address, no number',
    [box.includes('held-parent@addressbar.example.au'), /Held Parent FC This one didn’t go\. You can send it again later\./.test(ctl), ctl.includes('held-parent@')],
    [false, true, false]);
}

// ---------------------------------------------------------------------------
// D-137 at checkout: the name, the role and the tick. The page declared
// `error` in its searchParams type and never took it out again, so pressing
// Subscribe without the authority tick — or with a name that is only spaces,
// which `required` lets through — came back to ?error=1 with the fields
// emptied and NOT ONE WORD about what had happened. Nothing is charged either
// way; the difference is whether the treasurer is told why.
// ---------------------------------------------------------------------------
{
  const words = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&rsquo;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  const dana = ids.people.dana;                 // the free club: this page shows checkout
  // The checkout exists only with billing on (D-163). The form is read with
  // the switch on, then pressed with it off: while billing is off the action
  // itself refuses, ticked or not, before anything is recorded.
  await billingSwitch(true);
  const page = await get('/club/billing', dana);
  const form = forms(page.html).find((f) => f.visible.some((v) => v.name === 'authorised'));
  check('bw1: the checkout form is there, with the D-137 tick on it', Boolean(form), true);
  await billingSwitch(false);
  {
    const fd = new FormData();
    for (const [k, v] of Object.entries(form?.fields ?? {})) fd.append(k, v);
    for (const [k, v] of Object.entries({ plan: 'register_monthly', personName: 'Dana Kovac', roleAtClub: 'Treasurer', authorised: 'on' })) fd.append(k, v);
    const r = await fetch(BASE + '/club/billing', { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(dana) } });
    await r.text();
    check('bw0: with billing off, a fully ticked checkout goes home — nowhere near Stripe, nothing agreed (D-163)',
      r.headers.get('location'), '/home');
  }
  await billingSwitch(true);

  // A browser with the tick unticked sends no `authorised` field at all.
  const untick = async (over) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(form.fields)) fd.append(k, v);
    fd.append('plan', 'register_monthly');
    fd.append('personName', over.personName ?? 'Dana Kovac');
    fd.append('roleAtClub', over.roleAtClub ?? 'Treasurer');
    if (over.authorised) fd.append('authorised', 'on');
    const r = await fetch(BASE + '/club/billing', { method: 'POST', body: fd, redirect: 'manual',
      headers: { cookie: cookieFor(dana) } });
    await r.text();
    return r.headers.get('location');
  };

  check('bw2: with the tick unticked it goes nowhere near Stripe', await untick({}), '/club/billing?error=1');
  check('bw3: a name of nothing but spaces is the same refusal',
    await untick({ authorised: true, personName: '   ' }), '/club/billing?error=1');
  check('bw4: and a role of nothing but spaces',
    await untick({ authorised: true, roleAtClub: '  ' }), '/club/billing?error=1');

  const back = words((await get('/club/billing?error=1', dana)).html);
  check('bw5: and the page that comes back says what happened and what is needed',
    /Nothing has been charged\. We need your name, your role at the club, and the tick that says you.re authorised\./.test(back), true);
  check('bw6: the club is still on no plan — nothing was taken and nothing was agreed',
    /Choose how you pay/.test(back) && !/On your statement/.test(back), true);
  await billingSwitch(false);
}

// ---------------------------------------------------------------------------
// John's batch (1 Oct): N-10 and F14, pressed as the family presses them.
//   · N-10 / R12: Alex is Nate's parent, and Nate is seventeen. His page is
//     his: Alex cannot open its editors or post to them — and keeps the
//     controls and the preview.
//   · F14: Alex edits Georgia's page (fifteen). It publishes at once as the
//     approved version, nobody is emailed that anything waits, and the history
//     says "Alex changed the page." Georgia's own edit still waits on Alex.
// ---------------------------------------------------------------------------
{
  const alex = ids.people.alex, nate = ids.children.nate, georgia = ids.children.georgia;
  const words = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;|&rsquo;/g, '’').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
  const unhtml = (t) => t.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const formOf = async (path, who) => {
    const { html } = await get(path, who);
    const form = forms(html).find((f) => 'positions' in f.fields);
    if (!form) return null;
    const fields = { ...form.fields };
    for (const v of form.visible) {
      if (v.file) continue;
      fields[v.name] = v.type === 'select' ? (v.options?.[0] ?? '') : (v.value ?? '');
    }
    fields.about = unhtml(/<textarea[^>]*name="about"[^>]*>([\s\S]*?)<\/textarea>/.exec(html)?.[1] ?? '');
    return fields;
  };
  const postAs = async (path, who, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(who) } });
    await r.text();
    return { status: r.status, location: (r.headers.get('location') ?? '').replace(BASE, '') };
  };
  const box = async () => words((await get('/dev/outbox', alex)).html);
  // The outbox page shows the newest fifty, newest first, so "what was sent
  // since" is read off its top rather than counted across a moving window.
  const newest = async (k) => [...(await box()).matchAll(/doc15\.§(\w+) → (\S+)/g)].slice(0, k).map((m) => `§${m[1]} → ${m[2]}`);

  // ---- N-10 ----
  const nateBuild = `/build/${nate.record_id}`;
  const opened = async (path, who) => {
    const r = await fetch(BASE + path, { redirect: 'manual', headers: { cookie: cookieFor(who) } });
    await r.text();
    return [r.status, (r.headers.get('location') ?? '').replace(BASE, '')];
  };
  const doors = [];
  for (const p of [nateBuild, `${nateBuild}/clips`, `${nateBuild}/more`]) doors.push(await opened(p, alex));
  const nateForm = await formOf(nateBuild, nate.child_id);
  const aboutBefore = nateForm?.about;
  const crafted = nateForm ? await postAs(nateBuild, alex, { ...nateForm, about: 'Written by a parent — must not land (N-10).' }) : { status: 0, location: '' };
  const clipForm = forms((await get(`${nateBuild}/clips`, nate.child_id)).html).find((f) => f.visible.some((v) => v.name === 'url'));
  const clipTry = clipForm ? await postAs(`${nateBuild}/clips`, alex, { ...clipForm.fields, url: 'https://www.youtube.com/watch?v=n10parent', title: 'N-10 parent clip' }) : { location: '' };
  check('R12: Alex, a 16–17’s parent, cannot open Nate’s editors (page, clips, more — each sends him home) or write to them: a crafted save and a crafted clip both go home and change nothing',
    [Boolean(nateForm), doors, crafted.location, clipTry.location,
     (await formOf(nateBuild, nate.child_id))?.about === aboutBefore,
     words((await get(`${nateBuild}/clips`, nate.child_id)).html).includes('N-10 parent clip')],
    [true, [[307, '/home'], [307, '/home'], [307, '/home']], '/home', '/home', true, false]);
  check('jb-n10-w1: and Alex keeps everything else for Nate: his controls and the preview of his page both open',
    [(await get(`/g/controls/${nate.child_id}`, alex)).status, (await get(`${nateBuild}/preview`, alex)).status], [200, 200]);
  const nTop = await newest(3);
  check('jb-n10-w2: while Nate still writes his own page — and, a 16–17\u2019s edit waiting on nobody (doc 14 R8), no "edit waiting" email goes to his parent',
    [(await postAs(nateBuild, nate.child_id, nateForm)).status, JSON.stringify(await newest(3)) === JSON.stringify(nTop)], [303, true]);

  // ---- F14 ----
  const gBuild = `/build/${georgia.record_id}`;
  const history = async () => words((await get(`/g/controls/${georgia.child_id}`, alex)).html).split('Everything that’s happened')[1]?.split('Delete everything')[0] ?? '';
  const count = (t, s) => t.split(s).length - 1;
  const preview = async () => words((await get(`${gBuild}/preview`, alex)).html);
  const h0 = await history(), top0 = await newest(3);
  const gForm = await formOf(gBuild, alex);
  const ALEX_ABOUT = 'Two-footed left back who loves to overlap — edited by her parent (F14).';
  const saved = gForm ? await postAs(gBuild, alex, { ...gForm, about: ALEX_ABOUT }) : { status: 0 };
  const h1 = await history();
  check('jb-f14-w1: a parent’s own edit to an under-16’s page publishes at once — the preview a club sees carries it, nothing is waiting on /g/pending, and no "an edit is waiting" email goes to anyone',
    [Boolean(gForm), saved.status, (await preview()).includes(ALEX_ABOUT), words((await get(`/g/pending/${georgia.record_id}`, alex)).html).includes('Nothing is waiting on you.'),
     JSON.stringify(await newest(3)) === JSON.stringify(top0)],
    [true, 303, true, true, true]);
  check('jb-f14-w2: and the family history says "Alex changed the page." — BUZ’s line, the guardian’s first name — and never "Georgia submitted a change" for it',
    [count(h1, 'Alex changed the page.') - count(h0, 'Alex changed the page.'), count(h1, 'Georgia submitted a change') - count(h0, 'Georgia submitted a change')],
    [1, 0]);
  // Georgia's own edit still waits on her parent, exactly as before.
  const kForm = await formOf(gBuild, georgia.child_id);
  const KID_ABOUT = 'I also play futsal on Fridays (Georgia’s own edit).';
  const kSaved = kForm ? await postAs(gBuild, georgia.child_id, { ...kForm, about: KID_ABOUT }) : { status: 0 };
  const h2 = await history();
  check('jb-f14-w3: the child’s own edit still waits: the club’s preview keeps the parent’s version, /g/pending has it, the history says "Georgia submitted a change", and her parent gets the one "edit waiting" email',
    [kSaved.status, (await preview()).includes(ALEX_ABOUT), (await preview()).includes(KID_ABOUT),
     words((await get(`/g/pending/${georgia.record_id}`, alex)).html).includes('Nothing is waiting on you.'),
     count(h2, 'Georgia submitted a change') - count(h1, 'Georgia submitted a change'),
     (await newest(1))[0], JSON.stringify((await newest(4)).slice(1)) === JSON.stringify(top0)],
    [303, true, false, false, 1, '§30 → guardian@example.com', true]);
  const top2 = await newest(3);
  // And with her edit waiting, a parent's edit still publishes — their own
  // change, at once — and is patched onto her waiting version too, so that
  // approving hers later never reverts it. On the field both touched (the
  // About), the parent's value wins in both, and nothing tells Georgia
  // (parent's change only: BUZ and John, 2 Oct; John's condition 2).
  // MOVED: until 2 Oct this asserted the restrictive answer pending John —
  // the parent's edit joined the waiting change and published nothing.
  const pForm = await formOf(gBuild, alex);
  const JOINED = 'Left back. Both feet. (Parent, while Georgia’s edit waits.)';
  const pSaved = pForm ? await postAs(gBuild, alex, { ...pForm, about: JOINED }) : { status: 0 };
  const h3 = await history();
  const waitingNow = async () => words((await get(`/g/pending/${georgia.record_id}`, alex)).html).split('The new version')[1] ?? '';
  // MOVED (2 Oct, the full review): her change was only the About, which her
  // parent's value now decides in both versions — so nothing of hers is left
  // waiting, and the review says so rather than drawing an empty change.
  const reviewNow = words((await get(`/g/pending/${georgia.record_id}`, alex)).html);
  check('jb-f14-w4: while the child’s edit waits, the parent’s edit still publishes at once — the preview carries it — and on the field both touched the parent’s value wins in the waiting version too: her About is gone from the review, and with nothing else of hers waiting it says "Nothing is waiting on you."; one "Alex changed the page.", no email, and nothing sent to the child',
    [pSaved.status, (await preview()).includes(JOINED), (await preview()).includes(KID_ABOUT), reviewNow.includes(KID_ABOUT), reviewNow.includes('Nothing is waiting on you.'),
     count(h3, 'Alex changed the page.') - count(h2, 'Alex changed the page.'), JSON.stringify(await newest(3)) === JSON.stringify(top2)],
    [303, true, false, false, true, 1, true]);

  // ---- B-1, closed by "parent's change only" (BUZ and John, 2 Oct). Each
  // thing a child adds for herself — a clip, an achievement, a photo — stays
  // off the page clubs read when a parent saves something else; the parent's
  // own change is all that publishes. First with nothing waiting (the case
  // that leaked: a parent's save published the whole live page), then with a
  // change of hers waiting (S-2, and John's condition 3).
  const clipsPage = `${gBuild}/clips`, morePage = `${gBuild}/more`;
  const gClipForm = async (who) => forms((await get(clipsPage, who)).html).find((f) => f.visible.some((v) => v.name === 'url'));
  const achForm = async (who) => forms((await get(morePage, who)).html).find((f) => f.visible.some((v) => v.name === 'title') && f.visible.some((v) => v.name === 'detail'));
  const addClip = async (who, title) => { const f = await gClipForm(who); return f ? postAs(clipsPage, who, { ...f.fields, url: `https://www.youtube.com/watch?v=${title.replace(/\W/g, '')}`, title }) : { status: 0 }; };
  const addAch = async (who, title) => { const f = await achForm(who); return f ? postAs(morePage, who, { ...f.fields, title, detail: '' }) : { status: 0 }; };
  const live = async (page, who) => words((await get(page, who)).html);
  const pendingPage = `/g/pending/${georgia.record_id}`;
  const approveHers = async () => {
    const f = forms((await get(pendingPage, alex)).html).find((x) => x.submit === 'Approve the change');
    return f ? postAs(pendingPage, alex, f.fields) : { location: '' };
  };
  // Nothing waiting to begin with: her parent approves what waits.
  await approveHers();
  const nothingWaits = (await live(pendingPage, alex)).includes('Nothing is waiting on you.');
  const hB = await history();
  const G_CLIP = 'B1 clip Georgia added herself', A_ACH = 'B1 achievement her parent added';
  await addClip(georgia.child_id, G_CLIP);
  const clipBefore = (await preview()).includes(G_CLIP);
  await addAch(alex, A_ACH);
  check('bf-b1-w1: a clip Georgia adds herself stays off the page clubs read when her parent adds an achievement — the achievement publishes at once, her clip waits on her own page',
    [nothingWaits, clipBefore, (await preview()).includes(A_ACH), (await preview()).includes(G_CLIP), (await live(clipsPage, georgia.child_id)).includes(G_CLIP)],
    [true, false, true, false, true]);
  const G_ACH = 'B1 achievement Georgia added herself', A_CLIP = 'B1 clip her parent added';
  await addAch(georgia.child_id, G_ACH);
  await addClip(alex, A_CLIP);
  check('bf-b1-w2: an achievement Georgia adds herself stays off the page clubs read when her parent adds a clip — the clip publishes at once, her achievement waits',
    [(await preview()).includes(A_CLIP), (await preview()).includes(G_ACH), (await live(morePage, georgia.child_id)).includes(G_ACH)],
    [true, false, true]);
  // Her photo: uploaded by her, then her parent saves the form.
  const photoKey = (html) => new RegExp(`<img[^>]*src="([^"?]*player[-/]${georgia.record_id}[^"?]*)`).exec(html.replace(/<script[\s\S]*?<\/script>/g, ' '))?.[1] ?? null;
  const previewPhoto = async () => photoKey((await get(`${gBuild}/preview`, alex)).html);
  const photoBefore = await previewPhoto();
  const sharp = (await import('sharp')).default;
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 90, g: 20, b: 160 } } }).png().toBuffer();
  const upForm = forms((await get(gBuild, georgia.child_id)).html).find((f) => /\/photo$/.test(f.action ?? ''));
  if (upForm) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(upForm.fields)) fd.append(k, v);
    fd.append('photo', new Blob([png], { type: 'image/png' }), 'photo.png');
    await (await fetch(BASE + upForm.action, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(georgia.child_id) } })).text();
  }
  const herPhoto = photoKey((await get(gBuild, georgia.child_id)).html);
  const A_ABOUT = 'Left back. Reads the game early. (Her parent, after her photo.)';
  const aForm = await formOf(gBuild, alex);
  if (aForm) await postAs(gBuild, alex, { ...aForm, about: A_ABOUT });
  check('bf-b1-w3: a photo Georgia uploads herself stays off the page clubs read when her parent saves the form — the parent’s words publish at once, the page keeps the photo it had',
    [Boolean(upForm), Boolean(herPhoto) && herPhoto !== photoBefore, (await preview()).includes(A_ABOUT), await previewPhoto()],
    [true, true, true, photoBefore]);
  // Now a change of hers waits: she saves her own words.
  const G_ABOUT = 'Left back who loves a long throw (Georgia, waiting on her parent).';
  const gForm2 = await formOf(gBuild, georgia.child_id);
  if (gForm2) await postAs(gBuild, georgia.child_id, { ...gForm2, about: G_ABOUT });
  const herWaits = !(await live(pendingPage, alex)).includes('Nothing is waiting on you.');
  // S-2: a parent's removal reaches clubs at once while her change waits, and
  // so does anything the parent adds.
  const clipsHtml = (await get(clipsPage, alex)).html;
  const removeFor = forms(clipsHtml).filter((f) => 'clipId' in f.fields);
  // The removal form for the parent's own clip: the Remove that follows its
  // title, before the next clip's form.
  const parentClipForm = removeFor.find((f) => {
    const start = clipsHtml.lastIndexOf('<form', clipsHtml.indexOf(`value="${f.fields.clipId}"`));
    return clipsHtml.slice(clipsHtml.lastIndexOf('</form>', start), start).includes(A_CLIP);
  });
  if (parentClipForm) await postAs(clipsPage, alex, parentClipForm.fields);
  const A_ACH2 = 'B1 achievement her parent added while hers waits';
  await addAch(alex, A_ACH2);
  check('bf-b1-w4: while Georgia’s change waits, her parent removes a clip and it is off the page clubs read at once (S-2), and an achievement the parent adds is on it at once — her waiting words are not',
    [herWaits, Boolean(parentClipForm), (await preview()).includes(A_CLIP), (await preview()).includes(A_ACH2), (await preview()).includes(G_ABOUT)],
    [true, true, false, true, false]);
  // John's condition 3: approving her waiting change later never reverts the
  // parent's — what they removed stays gone, what they added stays.
  const approved = await approveHers();
  const after = await preview();
  check('bf-b1-w5: and when her parent approves Georgia’s waiting change, her words go on the page and every change the parent made meanwhile stays — the clip they removed stays gone, the achievement they added stays',
    [approved.location, after.includes(G_ABOUT), after.includes(A_CLIP), after.includes(A_ACH2), after.includes(A_ACH)],
    [`/g/pending/${georgia.record_id}?done=1`, true, false, true, true]);
  const hE = await history();
  // MOVED (2 Oct, B): her clip, achievement and photo each wait on her parent
  // now, so each is "Georgia submitted a change" too — four with her words.
  check('bf-b1-w6: the family history says "Alex changed the page." once for each change of the parent’s that reached the page — two achievements, a clip, the words, the removal — and "Georgia submitted a change" once for each change of hers: her clip, her achievement, her photo and her words',
    [count(hE, 'Alex changed the page.') - count(hB, 'Alex changed the page.'), count(hE, 'Georgia submitted a change') - count(hB, 'Georgia submitted a change')],
    [5, 4]);
  // ---- A guardian's FORM save publishes only what the guardian changed
  // (safety review of "parent's change only", B-1, 2 Oct). The form is
  // prefilled from the live record — with a change of the child's waiting,
  // her unreviewed draft — and posts every field. Read here as a browser
  // posts it: every field as the page drew it, the foot as the select has it.
  const faithful = async (who) => {
    const { html } = await get(gBuild, who);
    const form = forms(html).find((f) => 'positions' in f.fields);
    if (!form) return null;
    const fields = { ...form.fields };
    for (const v of form.visible) if (!v.file && v.type !== 'select') fields[v.name] = v.value ?? '';
    const sel = /<select[^>]*name="foot"[^>]*>([\s\S]*?)<\/select>/.exec(html)?.[1] ?? '';
    const opt = /<option(?: value="([^"]*)")?[^>]*selected=""[^>]*>([^<]*)</.exec(sel);
    fields.foot = opt ? (opt[1] ?? opt[2]) : '';
    fields.about = unhtml(/<textarea[^>]*name="about"[^>]*>([\s\S]*?)<\/textarea>/.exec(html)?.[1] ?? '');
    return fields;
  };
  const savedLine = async (who) => (await live(`${gBuild}?saved=1`, who)).includes('Your parent will see this change before it goes out.');
  // Georgia changes her About and a stat: both wait on her parent.
  const G_ABOUT2 = 'Georgia again, waiting: I train Tuesdays at the ground near my school.';
  const kf = await faithful(georgia.child_id);
  if (kf) await postAs(gBuild, georgia.child_id, { ...kf, about: G_ABOUT2, stat_apps: '87' });
  const childSees = await savedLine(georgia.child_id);
  const pageBefore = await preview(), hF0 = await history();
  // John (2 Oct): an UNCHANGED form over her waiting change publishes nothing.
  const af = await faithful(alex);
  const unchanged = af ? await postAs(gBuild, alex, af) : { status: 0 };
  const hF1 = await history();
  check('bf-form-w1: with Georgia’s About and a stat waiting, her parent’s form is prefilled with them — and saving it UNCHANGED publishes nothing: the page clubs read is word for word as it was, no history line, no event (John’s condition 1, its exact diff)',
    [Boolean(kf && af), af?.about === G_ABOUT2, af?.stat_apps, unchanged.status, (await preview()) === pageBefore, hF1 === hF0, (await preview()).includes(G_ABOUT2)],
    [true, true, '87', 303, true, true, false]);
  // Her parent changes ONLY the foot.
  const newFoot = af?.foot === 'Left' ? 'Right' : 'Left';
  if (af) await postAs(gBuild, alex, { ...af, foot: newFoot });
  const afterFoot = await preview(), hF2 = await history();
  check('bf-form-w2: her parent changes only the foot — clubs see the new foot at once, and still her OLD About and OLD stat; her About and stat still wait for him; one "Alex changed the page."',
    [Boolean(af?.foot), afterFoot.includes(`${newFoot} footed`), afterFoot.includes(G_ABOUT2), afterFoot.includes('· 87'),
     (await waitingNow()).includes(G_ABOUT2), count(hF2, 'Alex changed the page.') - count(hF1, 'Alex changed the page.')],
    [true, true, false, false, true, 1]);
  // S-1: "Your parent will see this change before it goes out." is the
  // child's line; her parent's save went out, and he reads the plain "Saved.".
  check('bf-form-w3: after a save, Georgia reads "Your parent will see this change before it goes out." — her parent, whose save has gone out, reads only "Saved."',
    [childSees, await savedLine(alex), (await live(`${gBuild}?saved=1`, alex)).includes('Saved.')], [true, false, true]);
  // The approval names the child, so it reaches the family history: the
  // approver reads "You approved a change" (the other guardian's line is the
  // permission suite's, bf-appr-1 — no fixture child has two guardians).
  const hA0 = await history();
  const okApprove = await approveHers();
  const hA1 = await history();
  check('bf-appr-w1: when her parent approves her waiting change, his family history says "You approved a change" — the approval now names Georgia — and her About and stat go on the page with his foot',
    [okApprove.location, count(hA1, 'You approved a change') - count(hA0, 'You approved a change'), (await preview()).includes(G_ABOUT2), (await preview()).includes(`${newFoot} footed`)],
    [`/g/pending/${georgia.record_id}?done=1`, 1, true, true]);
  // ---- The full review on /g/pending (BUZ, 2 Oct), and every change of a
  // child's waiting on it (B): one section per kind that changed, approved
  // seen, and the press approves exactly the version it was shown ----
  const sections = async () => [...(await get(pendingPage, alex)).html.matchAll(/<h2 class="sec-h">([^<]*)<\/h2>/g)].map((m) => m[1]);
  const waitsNot = async () => (await live(pendingPage, alex)).includes('Nothing is waiting on you.');
  const P_CLIP = 'B review clip Georgia added', P_ACH = 'B review achievement Georgia added';
  const idle0 = await waitsNot();
  await addClip(georgia.child_id, P_CLIP);
  const clipReview = [await sections(), (await live(pendingPage, alex)).includes(P_CLIP), (await live(pendingPage, alex)).includes('Added'), (await preview()).includes(P_CLIP)];
  const okClip = await approveHers();
  check('bf-pend-w1: a clip Georgia adds herself — her About untouched — waits, and /g/pending shows it under Highlights alone, Added; approved there, seen, it is on the page clubs read',
    [idle0, clipReview, okClip.location, (await preview()).includes(P_CLIP), await waitsNot()],
    [true, [['Highlights'], true, true, false], `/g/pending/${georgia.record_id}?done=1`, true, true]);
  await addAch(georgia.child_id, P_ACH);
  const achReview = [await sections(), (await live(pendingPage, alex)).includes(P_ACH), (await preview()).includes(P_ACH)];
  await approveHers();
  check('bf-pend-w2: an achievement Georgia adds herself waits the same way — Achievements alone — and goes on the page only when approved',
    [achReview, (await preview()).includes(P_ACH)], [[['Achievements'], true, false], true]);
  // Her photo: waiting at once, with no save after it (the old path, where a
  // child's photo rode the next save unseen, is gone).
  const png2 = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 20, g: 140, b: 160 } } }).png().toBuffer();
  const up2 = forms((await get(gBuild, georgia.child_id)).html).find((f) => /\/photo$/.test(f.action ?? ''));
  if (up2) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(up2.fields)) fd.append(k, v);
    fd.append('photo', new Blob([png2], { type: 'image/png' }), 'photo.png');
    await (await fetch(BASE + up2.action, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(georgia.child_id) } })).text();
  }
  const newPhoto = photoKey((await get(gBuild, georgia.child_id)).html);
  const reviewHtml = (await get(pendingPage, alex)).html;
  const reviewImgs = [...reviewHtml.replace(/<script[\s\S]*?<\/script>/g, ' ').matchAll(/<img[^>]*src="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  const photoBeforeApprove = await previewPhoto();
  await approveHers();
  check('bf-pend-w3: a photo Georgia uploads herself waits at once — no save after it — and /g/pending shows The photo alone, the approved one beside the new, both at signed private addresses and never a public one; approved, it is the page’s photo',
    [[...reviewHtml.matchAll(/<h2 class="sec-h">([^<]*)<\/h2>/g)].map((m) => m[1]), reviewImgs.length,
     reviewImgs.every((u) => u.startsWith('/private-photo/') && /[?&]s=/.test(u)), /\/dev-uploads\/|pitch-private:/.test(reviewHtml),
     photoBeforeApprove !== newPhoto, await previewPhoto()],
    [['The photo'], 2, true, false, true, newPhoto]);
  // Exactly the version shown: a press on a version she has changed since is
  // refused, publishes nothing, and lands back on the review, now drawing both.
  const X_CLIP = 'B exactness first clip', Y_CLIP = 'B exactness second clip';
  await addClip(georgia.child_id, X_CLIP);
  const shownForm = forms((await get(pendingPage, alex)).html).find((f) => f.submit === 'Approve the change');
  await addClip(georgia.child_id, Y_CLIP);
  const stale = shownForm ? await postAs(pendingPage, alex, shownForm.fields) : { location: '' };
  const afterStale = await preview();
  const redrawn = await live(pendingPage, alex);
  const okFresh = await approveHers();
  check('bf-pend-w4: the press approves exactly the version the page drew — when Georgia changes it after the page was rendered, the old press is refused, nothing is published, and the parent is back on the review, which now draws both changes; pressed again, both go up',
    [Boolean(shownForm?.fields.version), stale.location, afterStale.includes(X_CLIP), afterStale.includes(Y_CLIP), redrawn.includes(X_CLIP) && redrawn.includes(Y_CLIP),
     okFresh.location, (await preview()).includes(X_CLIP) && (await preview()).includes(Y_CLIP)],
    [true, `/g/pending/${georgia.record_id}`, false, false, true, `/g/pending/${georgia.record_id}?done=1`, true]);
  // Football details: her appearances changed and her assists blanked — one
  // row each, the new value marked self-reported, an empty one "—", never 0.
  const sf = await faithful(georgia.child_id);
  if (sf) await postAs(gBuild, georgia.child_id, { ...sf, stat_apps: '31', stat_assists: '' });
  const detHtml = (await get(pendingPage, alex)).html;
  const det = [...detHtml.matchAll(/<div class="det">([\s\S]*?)<\/div>/g)].map((m) => words(m[1]).trim().replace(/\s+/g, ' '));
  check('bf-pend-w5: a stat change of Georgia’s shows under Football details alone, "{label}: {old} → {new}", the new value marked Self-reported, a blanked stat as "—" and never a 0',
    [await sections(), det.some((r) => /^Appearances: \d+ → 31 Self-reported$/.test(r)), det.some((r) => /^Assists: \d+ → —$/.test(r) || r === 'Assists: — → —'),
     /class="det-n">0</.test(detHtml)],
    [['Football details'], true, sf?.stat_assists ? true : false, false]);
  await approveHers();
  check('bf-pend-w6: and with everything approved, the review says "Nothing is waiting on you." — and only then',
    await waitsNot(), true);
  // A 16–17's page and an adult's are their own, and their own changes are
  // the page at once, exactly as before.
  const jordanRec = /\/build\/([0-9a-f-]{36})/.exec((await get('/home', ids.people.jordan)).html)?.[1];
  const own = [];
  for (const [who, rec] of [[nate.child_id, nate.record_id], [ids.people.jordan, jordanRec]]) {
    const more = `/build/${rec}/more`;
    const f = forms((await get(more, who)).html).find((x) => x.visible.some((v) => v.name === 'title') && x.visible.some((v) => v.name === 'detail'));
    const T = `B1 own achievement ${who.slice(0, 4)}`;
    if (f) await postAs(more, who, { ...f.fields, title: T, detail: '' });
    own.push([Boolean(f), (await live(`/build/${rec}/preview`, who)).includes(T)]);
  }
  check('bf-b1-w7: a 16–17 and an adult are unchanged — an achievement each adds is on their own page at once',
    own, [[true, true], [true, true]]);
}

// ---------------------------------------------------------------------------
// John's addenda (2 Oct, §5) / doc 14 E15, pressed as the family presses it.
// Alex is Nate's parent, and Nate is seventeen: for a 16–17 the player shares
// and the guardian sees. Alex is not offered "Get the share link" for Nate,
// and a crafted press goes home and mints nothing — the same answer a
// stranger's press gets. Georgia is fifteen, so Alex's press for her still
// mints a link (the control: the rule is the 16–17's alone). Here, while
// Alex's session is live: the block after this one signs him out.
// ---------------------------------------------------------------------------
{
  const alex = ids.people.alex, marina = ids.people.marina, nate = ids.children.nate, georgia = ids.children.georgia;
  const GET = 'Get the share link';
  const offered = async (rec) => forms((await get(`/g/pending/${rec}?done=1`, alex)).html).find((f) => f.submit === GET) ?? null;
  const press = async (rec, who, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ ...fields, recordId: rec })) fd.append(k, v);
    const r = await fetch(`${BASE}/g/pending/${rec}?done=1`, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(who) } });
    await r.text();
    return [r.status, (r.headers.get('location') ?? '').replace(BASE, '')];
  };
  // What a parent sees of a child's link on their controls: the newest live
  // link and its expiry. A link minted for Nate would be the newest.
  const linkCard = async (child) => (await get(`/g/controls/${child}`, alex)).html
    .split(/<h2 class="sec-h">(?:[^<]|<!-- -->)*link<\/h2>/)[1]?.split('<h2 class="sec-h">')[0] ?? null;
  const form = await offered(georgia.record_id);
  const before = await linkCard(nate.child_id);
  const alexNate = form ? await press(nate.record_id, alex, form.fields) : null;
  const strangerNate = form ? await press(nate.record_id, marina, form.fields) : null;
  check('E15c: a 16–17’s parent is not offered "Get the share link" on /g/pending, and a crafted press goes home and mints nothing — answered exactly as a stranger’s press is; for their under-16 the same press still mints one',
    [Boolean(form), Boolean(await offered(nate.record_id)), alexNate, strangerNate, before !== null && (await linkCard(nate.child_id)) === before,
     form ? (await press(georgia.record_id, alex, form.fields))[1].startsWith(`/g/pending/${georgia.record_id}?done=1&link=`) : null],
    [true, false, [303, '/home'], [303, '/home'], true, true]);
}

// ---------------------------------------------------------------------------
// A parent gets the other person out (0062; QA's F1 and F2, 28 Sept).
//
// The four properties the bug hunt measured false, pressed through the product
// rather than asked of the database: a cookie captured beforehand still opened
// /home after Sign out, after the password was changed, and after signing back
// in; and 28 presses of /reset put 24 live links to one named person's address
// in one inbox, the oldest of which still opened the set-a-password form.
//
// LAST in this file on purpose. It signs people out, changes two passwords,
// fills a rate-limit bucket and reads /dev/outbox — which earlier checks
// scrape for "the newest messages" (L32). Nothing above it may depend on it.
// ---------------------------------------------------------------------------
{
  const raw = async (path, cookie, init = {}) => {
    const r = await fetch(BASE + path, { redirect: 'manual', ...init,
      headers: { ...(cookie ? { cookie } : {}), ...(init.headers ?? {}) } });
    return { status: r.status, location: r.headers.get('location') ?? '',
             setCookie: r.headers.get('set-cookie') ?? '', html: await r.text() };
  };
  // Every press here declares its own address unless the test says otherwise.
  // Sign-in and /reset are both capped per declared IP, and those buckets are
  // shared with every press earlier in this file — a block that fills one
  // would fail the checks after it for a reason that is not a defect.
  let presses = 0;
  const send = async (path, form, extra = {}, init = {}) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ ...form.fields, ...extra })) fd.append(k, v);
    return raw(path, init.cookie, { method: 'POST', body: fd,
      headers: { 'x-forwarded-for': `198.51.100.${(presses++ % 200) + 1}`, ...(init.headers ?? {}) } });
  };
  const flat = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&rsquo;|&#39;/g, "'").replace(/\s+/g, ' ');
  const submit = (html, re) => forms(html).find((f) => re.test(f.submit));
  const signInAs = async (email) => {
    const f = submit((await raw('/signin', null)).html, /^Sign in$/);
    const r = await send('/signin', f, { email });
    return r.setCookie.split(';')[0];
  };
  // One message per box on /dev/outbox, newest first, with its address — so a
  // link can be tied to the inbox it went to rather than to whatever the page
  // happens to render first (L32).
  const messages = async () => (await raw('/dev/outbox', cookieFor(ids.people.marina))).html
    .split('class="lift"').slice(1)
    .map((chunk) => ({
      to: (/→ ([^<\s]+@[^<\s]+)/.exec(flat(chunk)) ?? [])[1] ?? '',
      subject: (/<div style="font-size:14px;font-weight:800">([^<]*)</.exec(chunk) ?? [])[1] ?? '',
      resetToken: (/\/reset\/([A-Za-z0-9_-]{20,})/.exec(chunk) ?? [])[1] ?? '',
    }));
  const resetsTo = async (addr) => (await messages()).filter((m) => m.to === addr && m.resetToken);

  // A child's own controls screen, not /home: by the time this block runs the
  // sweep above has published a coach page for this parent, so their home is
  // the coach surface and no longer names any child — and Deniz has been
  // deleted by the deletion test, which is what that test is for. Georgia
  // survives the suite. The property is "is this cookie still a way into a
  // child's record", and this is the screen that answers it: signed out it
  // redirects to /signin, signed in it names her (L32 — a check that reads a
  // screen is coupled to that screen, and L13 — ask what the state is by the
  // time you read it).
  const childPage = '/g/controls/' + ids.children.georgia.child_id;
  const opensTheChild = async (cookie) => {
    const r = await raw(childPage, cookie);
    return r.status === 200 && /Georgia/.test(r.html);
  };

  // --- Sign out, then replay the cookie -------------------------------------
  const cookieA = await signInAs('guardian@example.com');
  check('sess-w1: signing in through the front door opens their child\'s controls, naming her',
    [/pitch_session=[^;]+\./.test(cookieA), await opensTheChild(cookieA)], [true, true]);
  const out = await raw('/signout', cookieA);
  check('sess-w2: press Sign out, replay the same cookie, and it opens nothing of hers',
    [/\/signin\?out=1/.test(out.location), await opensTheChild(cookieA)], [true, false]);
  check('sess-w3: the replayed cookie is served the signed-out product, not a session',
    /whichever seat you hold/.test(flat((await raw('/home', cookieA)).html)), true);

  // --- A new password ends every session that was already open ---------------
  // Two of them: one this script just opened, and the one the seed issued —
  // "everywhere else" has to mean every device, not the browser that asked.
  const cookieB = await signInAs('guardian@example.com');
  const seeded = cookieFor(ids.people.alex);
  check('sess-w4: two sessions are open for that parent, on two devices',
    [await opensTheChild(cookieB), await opensTheChild(seeded)], [true, true]);
  await send('/reset', submit((await raw('/reset', null)).html, /reset link/), { email: 'guardian@example.com' });
  const parentLink = (await resetsTo('guardian@example.com'))[0]?.resetToken ?? '';
  const pwForm = submit((await raw(`/reset/${parentLink}`, null)).html, /Save it/);
  const saved = await send(`/reset/${parentLink}`, pwForm, { password: 'parent-new-password-13579' });
  check('sess-w5: the new password is set, and the screen sends them to sign in',
    /\/signin\?reset=1/.test(saved.location), true);
  check('sess-w6: and BOTH sessions are over — the sentence on that screen is now true',
    [await opensTheChild(cookieB), await opensTheChild(seeded)], [false, false]);
  const backIn = await send('/signin', submit((await raw('/signin', null)).html, /^Sign in$/),
    { email: 'guardian@example.com', password: 'parent-new-password-13579' });
  check('sess-w7: the password they just chose is the way back in',
    await opensTheChild(backIn.setCookie.split(';')[0]), true);

  // --- The reset flood, and the link it leaves live --------------------------
  // Six presses for one address, each declaring a DIFFERENT x-forwarded-for,
  // which is what defeated the only limit this route had.
  const resetForm = submit((await raw('/reset', null)).html, /reset link/);
  const before = (await resetsTo('coach@example.com')).length;
  const answers = [];
  for (let i = 0; i < 6; i++) {
    answers.push(await send('/reset', resetForm, { email: 'coach@example.com' },
      { headers: { 'x-forwarded-for': `203.0.113.${10 + i}` } }));
  }
  const delivered = (await resetsTo('coach@example.com')).length - before;
  check('sess-w8: six presses from six declared addresses deliver three emails, not six', delivered, 3);
  check('sess-w9: and the press that was capped answers exactly as the first one did',
    [answers[5].status, answers[5].location, answers[5].html.length],
    [answers[0].status, answers[0].location, answers[0].html.length]);
  const noAccount = await send('/reset', resetForm, { email: 'nobody-has-this-address@example.com' });
  check('sess-w10: an address with no account gets that same answer, so the cap tells a stranger nothing',
    [noAccount.status, noAccount.location], [answers[0].status, answers[0].location]);
  check('sess-w11: and nothing was queued to it',
    (await resetsTo('nobody-has-this-address@example.com')).length, 0);

  // --- The oldest link in an inbox full of them -----------------------------
  const linksBefore = (await resetsTo('admin@example.com')).length;
  await send('/reset', resetForm, { email: 'admin@example.com' });
  await send('/reset', resetForm, { email: 'admin@example.com' });
  const two = await resetsTo('admin@example.com');
  check('sess-w12: two presses put two links in the inbox', two.length - linksBefore, 2);
  const older = two[1].resetToken, newer = two[0].resetToken;
  // G-P2 (0164): a dead link no longer draws the form at all, so the press is
  // made with the form the live link draws and the dead link's token in it —
  // the action, not the page, is what must refuse it.
  const liveForm = submit((await raw(`/reset/${newer}`, null)).html, /Save it/);
  const oldOpen = await raw(`/reset/${older}`, null);
  check('dfx-G-P2: the OLDER link, opened, goes straight to "used or expired" and draws no password field',
    [oldOpen.status, /\/reset\?expired=1/.test(oldOpen.location ?? ''), /name="password"/.test(oldOpen.html ?? '')], [307, true, false]);
  const oldTry = await send(`/reset/${older}`, liveForm, { token: older, password: 'attacker-chosen-password-1' });
  check('sess-w13: the OLDER of them sets no password — issuing the second one killed it',
    /\/reset\?expired=1/.test(oldTry.location), true);
  const newTry = await send(`/reset/${newer}`, liveForm, { token: newer, password: 'admin-new-password-24680' });
  check('sess-w14: the newest one works', /\/signin\?reset=1/.test(newTry.location), true);
  const reuse = await send(`/reset/${newer}`, liveForm, { token: newer, password: 'attacker-chosen-password-2' });
  check('sess-w15: and once used it is spent, so a second press sets nothing',
    /\/reset\?expired=1/.test(reuse.location), true);
  const usedOpen = await raw(`/reset/${newer}`, null);
  check('dfx-G-P2b: and the used link, opened again, says so before anything is typed',
    [usedOpen.status, /\/reset\?expired=1/.test(usedOpen.location ?? '')], [307, true]);
  check('sess-w16: the password the real person set is the one that works',
    /pitch_session=[^;]+\./.test((await send('/signin', submit((await raw('/signin', null)).html, /^Sign in$/),
      { email: 'admin@example.com', password: 'admin-new-password-24680' })).setCookie), true);
  check('sess-w17: and neither password an old link tried to set opens anything',
    [/pitch_session=[^;]+\./.test((await send('/signin', submit((await raw('/signin', null)).html, /^Sign in$/),
      { email: 'admin@example.com', password: 'attacker-chosen-password-1' })).setCookie),
     /pitch_session=[^;]+\./.test((await send('/signin', submit((await raw('/signin', null)).html, /^Sign in$/),
      { email: 'admin@example.com', password: 'attacker-chosen-password-2' })).setCookie)], [false, false]);
}

// ---------------------------------------------------------------------------
// A REFUSED SIGN-IN, PRESSED FOR REAL (28 Sep).
//
// signIn() ended in redirect('/home') on every path — success, wrong password,
// no such account, rate-limited — and /home signed out renders "Welcome back /
// One account, whichever seat you hold." So every mistyped password looked
// like an outage, and the code's comment cited D-94 §2 for it. D-94 §2 asks
// for the response to be IDENTICAL whether or not the account exists; it does
// not ask for silence. One line, the same line for every cause, satisfies it.
//
// These press the button rather than read the handler, because the property is
// about what four different causes produce.
// ---------------------------------------------------------------------------
{
  const signInForm = forms((await get('/signin', null)).html).find((f) => 'email' in Object.fromEntries(f.visible.map((v) => [v.name, v])));
  const press = async (email, password) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(signInForm.fields)) fd.append(k, v);
    fd.append('email', email);
    fd.append('password', password);
    const r = await fetch(BASE + '/signin', { method: 'POST', body: fd, redirect: 'manual' });
    const body = await r.text();
    return { status: r.status, location: r.headers.get('location') ?? '', setCookie: Boolean(r.headers.get('set-cookie')), body };
  };
  check('sr1: the sign-in form is reachable with no JavaScript', Boolean(signInForm), true);

  // The account is new@example.com, which no other check in any suite signs in
  // as. It was guardian@example.com, and the sessions block above (0062) gives
  // that parent a password partway through the run, so by the time this block
  // pressed anything the seed's email-only sign-in no longer applied and sr4
  // reported a wall that was not there (L32, L13: ask what the state is by the
  // time you read it, not what the seed wrote).
  const WHO = 'new@example.com';
  // An account that exists, with the wrong password.
  const wrong = await press(WHO, 'not-the-password');
  // An address no account holds.
  const nobody = await press('nobody-at-all@example.com', 'not-the-password');
  check('sr2: a wrong password is refused, and says so — it does not land on "Welcome back"',
    [wrong.location, wrong.setCookie], ['/signin?refused=1', false]);
  check('sr3: and an address no account holds answers IDENTICALLY (D-94 §2 — no enumeration oracle)',
    [nobody.status === wrong.status, nobody.location === wrong.location, nobody.body === wrong.body], [true, true, true]);

  // The refusal is not a wall: the same account still gets in.
  const ok = await press(WHO, '');
  check('sr4: the same account still signs in, so the refusal is real and not a wall',
    [ok.location, ok.setCookie], ['/home', true]);
}

// ---------------------------------------------------------------------------
// 0077 — an under-16's early funnel lines, on the parent's own log (BUZ, 28
// Sep, decision 8). Signed up through /join as a family would be, approved on
// both channels by a real adult account, and then read where the parent reads
// it. Before 0077 this log began at "You approved the profile": everything
// before it was written about a child who did not exist yet. Last in the file
// because it gives an adult seat a child, which nothing above expects.
// (No provider runs in development, so "That email reached your inbox" cannot
// happen here; the permission suite drives that one through fn_record_delivery.)
// ---------------------------------------------------------------------------
{
  const guardian = ids.people.jordan;          // player@example.com: an adult, proved, signed in
  const plainText = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, '\n')
    .replace(/&#x27;|&rsquo;|&#39;/g, "'").split('\n').map((l) => l.trim()).filter(Boolean);
  const postForm = async (path, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual' });
    await r.text();
    return r.headers.get('location') ?? '';
  };
  await get('/join', null);
  const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../.next/dev/server/server-reference-manifest.json', import.meta.url)), 'utf8'));
  const joinId = Object.entries(manifest.node).find(([, v]) => v.filename === 'app/join/actions.ts' && v.exportedName === 'startPendingInvitation')?.[0];
  const joined = await postForm('/join', { [`$ACTION_ID_${joinId}`]: '', country: 'AU', firstName: 'Ivy', dob: '2014-06-06',
    guardianName: 'Jordan Fixture', guardianPhone: '0400 777 888', guardianEmail: 'player@example.com' });
  const invId = /\/join\/waiting\/([0-9a-f-]{36})/.exec(joined)?.[1];
  check('funnel-w0: an under-16 is signed up through /join, and the parent is asked on both channels', Boolean(invId), true);
  const box = (await get('/dev/outbox', ids.people.marina)).html;
  const codes = [...new Set([...box.matchAll(/\/a\/([A-Za-z0-9_-]{20,})/g)].map((m) => m[1]))].slice(0, 2);
  for (const code of codes) {
    const pg = (await get(`/a/${code}`, null)).html;             // opening it: "You opened the permission page"
    const yes = forms(pg).find((f) => /Yes, it/.test(f.submit));
    if (yes) await postForm(`/a/${code}`, yes.fields);
  }
  const approve = forms((await get(`/a/${codes[0]}`, null)).html).find((f) => /Approve/.test(f.submit));
  const done = approve ? await postForm(`/a/${codes[0]}`, { ...approve.fields, adult: 'on' }) : '';
  check('funnel-w1: and approves', /\/a\/[0-9a-f-]+\/done/.test(done), true);
  // N1 (BUZ, 1 Oct): Jordan is now a parent whose one child was just
  // approved — no link, no register, nothing waiting. The page says so in the
  // dashed "not yet" tile (an empty space reads as a failed load), and with
  // nothing to do nothing glows.
  {
    const m = (await get('/home', guardian)).html.replace(/<script[\s\S]*?<\/script>/g, ' ');
    // B1 (spec A): with nothing waiting and an under-16 with no page yet, the
    // child's "Build {first}'s page" is the screen's one glow.
    check('hm-w2: a parent with nothing waiting reads “Nothing is waiting on you.” in the dashed tile, and the one glow is Build Ivy’s page',
      [/<div class="card empty"><div class="empty-tile" aria-hidden="true"><\/div><div><span class="empty-t">Nothing is waiting on you\.<\/span>/.test(m),
       [...m.replace(/<!-- -->/g, '').matchAll(/class="[^"]*\bfl-glow\b[^"]*"[^>]*>([^<]*)</g)].map((x) => x[1].replace(/&#x27;|&rsquo;/g, '’')),
       /Waiting on you/.test(m), /class="numeral/.test(m)], [true, ['Build Ivy’s page'], false, false]);
    // B1 (live defect, BUZ 1 Oct): the parent of a just-approved under-16 has
    // a door to start the page, and it opens the builder for them.
    const build = /<a (?=[^>]*href="(\/build\/[0-9a-f-]{36})")(?=[^>]*class="btn btn-(?:primary|secondary)[^"]*")[^>]*>Build (?:<!-- -->)?Ivy(?:<!-- -->)?(?:&#x27;|&rsquo;|’)s page</.exec(m)?.[1] ?? null;
    check('hm-w2b: and the child’s card offers “Build Ivy’s page”, which opens the builder for the parent',
      [Boolean(build), build ? (await get(build, guardian)).status : null], [true, 200]);
  }
  const childId = /\/g\/controls\/([0-9a-f-]{36})/.exec((await get('/home', guardian)).html)?.[1];
  const log = childId ? plainText((await get(`/g/controls/${childId}`, guardian)).html) : [];
  const at = (line) => log.findIndex((l) => l === line);
  check('funnel-w2: the parent’s log now starts where the story did — asked, emailed, texted, opened (decision 8)',
    ['We were asked to set up their profile', 'We emailed you to ask permission', 'We texted you as well',
     'You opened the permission page'].map((l) => at(l) > -1), [true, true, true, true]);
  check('funnel-w3: with the confirmations and the approval, newest first, the approval above the rest',
    [at('You confirmed by text') > -1, at('You confirmed by email') > -1,
     at('You approved the profile') > -1 && at('You approved the profile') < at('You opened the permission page')
       && at('You opened the permission page') < at('We emailed you to ask permission')], [true, true, true]);
}

// The one support address (BUZ, 28 Sep). The newest fifty messages this run
// queued (all the dev inbox shows), read where it shows them: not one carries
// the old address. Every builder in the catalogue is composed by the
// permission suite (support2–4); this is the same promise on real sends.
{
  // Tags out first: the dev inbox renders every pitchfootball.com.au in a
  // body as a link (L32), which splits "help@" from its domain in the HTML —
  // the first version of this check could not see the old address at all.
  const box = (await get('/dev/outbox', ids.people.marina)).html.replace(/<[^>]+>/g, '');
  const messages = (box.match(/doc15\.§/g) ?? []).length;
  check(`support-w1: nothing this run sent carries the old address (${messages} messages read)`,
    [messages >= 40, /help@pitchfootball\.com\.au/i.test(box), /burak\.donmez@pitch-football\.com/.test(box)], [true, false, true]);
}

// ---------------------------------------------------------------------------
// THE SMS SWITCH (0070, D-81, D-94 §10; builder, 28 Sep). Pressed through
// /ops/switches, and proved by what the send layer then does: a child's
// sign-up while SMS is off queues the parent's email and NO text; back on, the
// support console's resend queues one; under a cap lower than the month's
// spend, none; with the cap cleared, one again. The number is used by nothing
// else in any suite, so the three-a-day limit per number is this block's
// alone and cannot be the reason a text is missing — the two "one again"
// checks are what prove that.
// ---------------------------------------------------------------------------
{
  const op = ids.people.marina;
  const PHONE = '0400 707 070', EMAIL = 'sms-drill@example.com';
  // The rendered "→ number" line of each SMS row, and nothing else: the same
  // number appears again in the page's own payload, and counting both read
  // every text twice (found when this block was proved red, 28 Sep).
  const texts = async () => (((await get('/dev/outbox', op)).html).match(/>sms<\/span>[\s\S]{0,300}?→ (?:<!-- -->)?0400 707 070</g) ?? []).length;
  const pressSwitch = async (label, extra) => {
    const form = forms((await get('/ops/switches', op)).html).find((f) => f.submit.startsWith(label));
    if (!form) return 'no form';
    const fd = new FormData();
    for (const [k, v] of Object.entries({ ...form.fields, ...extra })) fd.append(k, v);
    const r = await fetch(BASE + '/ops/switches', { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(op) } });
    await r.text();
    return r.headers.get('location') ?? '';
  };
  const resend = async () => {
    const path = `/ops/support?q=${encodeURIComponent(PHONE)}`;
    const form = forms((await get(path, op)).html).find((f) => f.submit.startsWith('Resend the approval request'));
    if (!form) return 'no form';
    const fd = new FormData();
    for (const [k, v] of Object.entries(form.fields)) fd.append(k, v);
    const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(op) } });
    await r.text();
    return r.headers.get('location') ?? '';
  };

  check('sms-w1: switching SMS off with no reason is refused', /error=reason/.test(await pressSwitch('Switch SMS off', { reason: '' })), true);
  check('sms-w2: with a reason, SMS goes off', /done=sms-off/.test(await pressSwitch('Switch SMS off', { reason: 'sms drill' })), true);
  // Floodlit (spec I): with SMS off and links on, "Switch SMS back on" is the
  // screen's one glow.
  check('op-w3: SMS off, the one glow on the switches page is "Switch SMS back on"',
    [...(await get('/ops/switches', op)).html.replace(/<script[\s\S]*?<\/script>/g, ' ').matchAll(/<button[^>]*class="[^"]*\bfl-glow\b[^"]*"[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]),
    ['Switch SMS back on']);

  // A child's sign-up, posted as a browser with no JavaScript would (the
  // form is a client component, so its action id comes from Next's manifest).
  await get('/join', null);
  const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../.next/dev/server/server-reference-manifest.json', import.meta.url)), 'utf8'));
  const joinId = Object.entries(manifest.node).find(([, v]) => v.filename === 'app/join/actions.ts' && v.exportedName === 'startPendingInvitation')?.[0];
  const jfd = new FormData();
  // country=AU: every sign-up door asks the country first now, and the server
  // refuses one that did not come through it (D-63, builder-final-b).
  for (const [k, v] of Object.entries({ [`$ACTION_ID_${joinId}`]: '', country: 'AU', firstName: 'Ivy', dob: '2014-05-05', guardianName: 'Drill Parent', guardianPhone: PHONE, guardianEmail: EMAIL })) jfd.append(k, v);
  const joined = await fetch(BASE + '/join', { method: 'POST', body: jfd, redirect: 'manual' });
  await joined.text();
  const waitingAt = joined.headers.get('location') ?? '';
  check('sms-w3: the sign-up goes through while SMS is off (D-168: under-18s register at launch)', /\/join\/waiting\//.test(waitingAt), true);
  const boxOff = (await get('/dev/outbox', op)).html;
  // D-168 (0120): the email goes at once and the text WAITS — written down,
  // not refused and not sent, so it is not in the inbox yet.
  check('sms-w4: the parent’s email goes at once, and the text waits rather than arriving', [boxOff.includes(EMAIL), await texts()], [true, 0]);
  const plainOf = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&rsquo;|&#39;/g, "'").replace(/\s+/g, ' ');
  const waitingPage = async () => plainOf((await get(waitingAt.replace(BASE, ''), null)).html);
  const w0 = await waitingPage();
  check('sms-w4b: the child’s waiting screen says the email went and the text follows — and not that a text was sent (BUZ, 29 Sep)',
    [w0.includes('We’ve emailed your parent. Their text follows shortly.'), w0.includes('Text and email sent')], [true, false]);
  // F6 / 3q (BUZ, 1 Oct): the parent opens the emailed link while the text
  // waits. Their status line says the text follows, not "open the link we
  // texted" — and the No is there, from the first confirmed channel.
  const ivyEmail = [...new Set([...boxOff.matchAll(/\/a\/([A-Za-z0-9_-]{20,})/g)].map((m) => m[1]))][0];
  const aPost = async (code, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    const r = await fetch(BASE + `/a/${code}`, { method: 'POST', body: fd, redirect: 'manual' });
    await r.text();
  };
  const yesIvy = forms((await get(`/a/${ivyEmail}`, null)).html).find((f) => /Yes, it/.test(f.submit));
  if (yesIvy) await aPost(ivyEmail, yesIvy.fields);
  const q3 = plainOf((await get(`/a/${ivyEmail}`, null)).html);
  check('jr-3q-w1: with the email confirmed and the text still waiting, /a says "One more step. Your text follows shortly — open the link in it to finish." and not "Open the link we texted"',
    [Boolean(yesIvy), q3.includes('One more step. Your text follows shortly — open the link in it to finish.'), /Open the link we texted/.test(q3), q3.includes('No, end this request')],
    [true, true, false, true]);
  const job = async () => { const r = await fetch(BASE + '/api/jobs/outbox'); return r.ok ? (await r.json()).released : null; };
  // Today (brief G's /ops, brief H's tile): the backlog as a count.
  const todayWaiting = async () => {
    const h = (await get('/ops', op)).html;
    const tile = /data-ops-tile="Texts waiting for SMS"[\s\S]*?<\/div>\s*<div[^>]*>(\d+)<\/div>/.exec(h);
    return tile ? Number(tile[1]) : 0;
  };
  const waitingNow = await todayWaiting();
  check('sms-w4d: Today shows the waiting text as a count (held words, development only)', waitingNow >= 1, true);
  check('sms-w4c: an outbox run while SMS is off sends nothing', [await job(), await texts()], [0, 0]);

  check('sms-w5: SMS back on', /done=sms-on/.test(await pressSwitch('Switch SMS back on', { reason: 'sms drill over' })), true);
  // "With SMS then configured (the dev fake), one dispatcher run sends it."
  check('sms-w5b: one outbox run, with SMS able to send, sends the waiting text — it is in the inbox now',
    [(await job()) >= 1, await texts()], [true, 1]);
  check('sms-w5d: and once it has gone, Today\u2019s count has gone down by it', await todayWaiting(), waitingNow - 1);
  const w1 = await waitingPage();
  check('sms-w5c: and the waiting screen stops saying the text is on its way, and says both went',
    [w1.includes('Their text follows shortly.'), w1.includes('Text and email sent')], [false, true]);
  const q3after = plainOf((await get(`/a/${ivyEmail}`, null)).html);
  check('jr-3q-w2: and once the text has gone, the emailed link says to open the link we texted, as before',
    [q3after.includes('Your text follows shortly'), /One more step\. Open the link we texted to you/.test(q3after)], [false, true]);
  check('sms-w6: and the support console’s resend now sends a text straight away', [/\/ops\/support/.test(await resend()), await texts()], [true, 2]);

  check('sms-w7: a limit that is not an amount is refused', /error=cap/.test(await pressSwitch('Set this limit', { dollars: 'lots', reason: 'cap drill' })), true);
  check('sms-w8: a limit of one cent, below this month’s spend, is set', /done=cap-set/.test(await pressSwitch('Set this limit', { dollars: '0.01', reason: 'cap drill' })), true);
  await resend();
  check('sms-w9: and under it, the resend queues no text', await texts(), 2);
  check('sms-w10: going back to the environment’s limit', /done=cap-cleared/.test(await pressSwitch('Go back to the limit set in Vercel', { reason: 'cap drill over' })), true);
  await resend();
  check('sms-w11: and texts go again', await texts(), 3);
  const swLog = (await get('/ops/switches', op)).html;
  check('sms-w12: the switch log names every reason', ['sms drill', 'sms drill over', 'cap drill', 'cap drill over'].every((r) => swLog.includes(r)), true);
}

// ---------------------------------------------------------------------------
// today-w1–w3 — the operator's Today screen after a day of pressing buttons
// (brief G, 29 Sep; 0110). The seed sends no approval request, so the render
// suite can only see the tiles a fresh database fills; by this point the
// suite has asked guardians to approve children on both channels, and the
// Approvals sent and Approved tiles must have found that on the consent spine
// (D-78) — as counts, with "% of sent" a share that cannot pass 100, and with
// no zero printed anywhere (D-162).
// ---------------------------------------------------------------------------
{
  const html = (await get('/ops', ids.people.marina)).html.replace(/<!--[\s\S]*?-->/g, '');
  const tile = (label) => {
    const m = new RegExp(`data-ops-tile="${label}"[^>]*>[\\s\\S]*?<div[^>]*>[^<]*</div><div[^>]*>([^<]*)</div>(?:<div[^>]*>([^<]*)</div>)?`).exec(html);
    return m ? { value: Number(m[1]), sub: m[2] ?? '' } : null;
  };
  const sent = tile('Approvals sent'), approved = tile('Approved');
  check(`today-w1: the approval requests this suite sent today are counted (${sent ? sent.value : 'no tile'})`, Boolean(sent) && sent.value >= 1, true);
  const pct = approved ? Number(/^(\d+)% of sent$/.exec(approved.sub)?.[1]) : null;
  check(`today-w2: approved is a share of sent — never more, and its percentage agrees (${approved ? `${approved.value}, ${approved.sub}` : 'no approvals yet'})`,
    !approved ? [true, true] : sent ? [approved.value <= sent.value, pct === Math.round((100 * approved.value) / sent.value)] : [false, false], [true, true]);
  const values = [...html.matchAll(/data-ops-tile="([^"]+)"[^>]*>[\s\S]*?<div[^>]*>[^<]*<\/div><div[^>]*>([^<]*)<\/div>/g)].map((m) => m[2].trim());
  check(`today-w3: after all that, still no tile says zero (D-162) (${values.join(', ')})`, values.filter((v) => !/^[1-9]\d*$/.test(v)), []);
  // 0171 (design audit, 2 Oct, finding 22): and the signups still add up,
  // after a day of doors pressed — the club door's account included.
  const signups = tile('Signups today');
  const partsSum = signups ? [...signups.sub.matchAll(/(\d+) (player|parent|coach|club)\b/g)].reduce((n, m) => n + Number(m[1]), 0) : -1;
  check(`today-w4: Signups today is still the sum of its own line (${signups ? `${signups.value} over ${signups.sub}` : 'no tile'})`,
    [Boolean(signups), signups ? signups.value : null], [true, partsSum]);
}

// ---------------------------------------------------------------------------
// Brief K items 4 and 1, pressed (29 Sep). Late in the suite on purpose: it
// claims Westgate Rangers, and it suspends Kingsway and Westgate through the
// operator's call sheet, and nothing after it reads either club.
//
// ONE BUTTON (item 4). A club that has claimed its page and not had the call
// yet was offered two ways in: the board said "Send my CV", and its own page
// offered the register. D-90 and D-126 settle it: the family registers
// interest, and the club sees a count until it is verified — and the family
// is never told it is unverified (M9). Westgate, the seed's unclaimed listing
// with a notice Pitch compiled, is claimed here the way any club claims its
// page, and then both screens are read, and the button pressed.
//
// A SUSPENDED CLUB ADVERTISES NOTHING (item 1; 0140). Each class the call
// sheet offers, and a takedown with none, on a club with its own notice
// (Kingsway, verified), and a suspension with no class on a club with Pitch's
// compiled notice (Westgate, claimed). Read on the board and on the club's own
// page, the two places round I found them, and back when the club is verified
// again: suspension hides, it never deletes.
// ---------------------------------------------------------------------------
{
  const op = ids.people.marina, robin = ids.people.robin, adult = ids.people.jordan;
  const words = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&rsquo;|&#39;|’/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  const post = async (path, who, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) for (const x of [].concat(v)) fd.append(k, x);
    const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual', headers: who ? { cookie: cookieFor(who) } : {} });
    await r.text();
    return { status: r.status, location: (r.headers.get('location') ?? '').replace(BASE, '') };
  };
  // The board's own listing for a club: its row (trials board v2, BUZ 2 Oct —
  // one row per club per day, the club named once, its doors inside). Was a
  // slice from "Club · " to the end of its button; the name and the title are
  // two elements now, so the row is found by its name and must hold its door.
  const listingOf = (raw, club, slug) => [...raw.replace(/<!-- -->/g, '').matchAll(/<article\b[\s\S]*?<\/article>/g)].map((m) => m[0])
    .find((a) => a.includes(`<span class="fl-trial-cn">${club}</span>`) && a.includes(`href="/fc/${slug}`)) ?? null;

  // ---- one button ----------------------------------------------------------------
  const ask = forms((await get('/claim/westgate-rangers', robin)).html).find((f) => 'slug' in f.fields && !f.visible.some((v) => v.name === 'code'));
  await post('/claim/westgate-rangers', robin, ask.fields);
  const code = /claim Westgate Rangers on Pitch[\s\S]*?your code is:\s*(\d{6})/.exec(words((await get('/dev/outbox', op)).html))?.[1];
  // Read while the code is out and the club is still unclaimed (claim-w1).
  const sentPage = (await get('/claim/westgate-rangers?sent=1', robin)).html;
  const enter = forms(sentPage).find((f) => f.visible.some((v) => v.name === 'code'));
  const claimed = await post('/claim/westgate-rangers', robin, { ...enter.fields, code });
  check('one-w0: Westgate Rangers is claimed through the product — a club on Pitch, not yet verified', /claimed=1/.test(claimed.location), true);
  // The four preview fixes (BUZ, 30 Sep): the address is partly hidden, the
  // page says who made it, billing is not mentioned, and the claimed screen
  // tells the truth about trials and leads on to the club.
  const donePage = (await get('/claim/westgate-rangers?claimed=1', robin)).html;
  check('claim-w1: while claiming, the club\u2019s address is shown partly hidden, never in full, and billing is not mentioned',
    [/[\w.+-]{3,}@[\w-]+\.[\w.]+/.test(words(sentPage)), /••@/.test(sentPage), /billing/i.test(words(sentPage))], [false, true, false]);
  check('claim-w2: once claimed, trials wait for verification — never "you can post trials" — and the screen leads on to the club',
    [/Posting trials, and anything to do with players, waits for verification/.test(words(donePage)), /You can post trials/.test(words(donePage)),
     /href="\/home"[^>]*>Go to your club</.test(donePage)], [true, false, true]);
  check('ap7c: the claim confirmation says we ring on a number we find ourselves — and no longer "we\u2019ll be in touch" (BUZ, 1 Oct, option A)',
    [/a phone call from us\. We ring Westgate Rangers on a number we find ourselves, so let the club know to expect us\./.test(words(donePage)),
     /be in touch/.test(words(donePage))], [true, false]);

  const boardHtml = (await get('/trials', null)).html;
  const westListing = listingOf(boardHtml, 'Westgate Rangers', 'westgate-rangers');
  const westTrial = /href="\/fc\/westgate-rangers\?trial=([0-9a-f-]{36})#play"/.exec(westListing ?? '')?.[1];
  check('one-w1: the board offers a claimed club\'s families the register — "I’m interested", carrying the trial — not "Send my CV", and does not tell them the club is unverified',
    [Boolean(westTrial), /I(&rsquo;|’)m interested/.test(westListing ?? ''), /Send my CV/.test(westListing ?? ''),
     /Unclaimed|verified club/.test(words(westListing ?? ''))],
    [true, true, false, false]);
  // Signed out, and as an adult player: the parent's own session has been
  // ended by the sessions block by now, and this is the seat that presses it.
  const pageOut = words((await get('/fc/westgate-rangers', null)).html), pageAdult = words((await get('/fc/westgate-rangers', adult)).html);
  check('one-w2: and so does its own page, signed out and signed in — the same door, and no "Send my CV" anywhere on it',
    [pageOut.includes('Sign in to register your interest'), pageAdult.includes('Register my interest'),
     /Send my CV|send your CV|Send [A-Z][a-z]+'s CV/.test(pageOut + pageAdult)],
    [true, true, false]);

  // Pressed, by an adult, from the board's own link.
  const viaBoard = (await get(`/fc/westgate-rangers?trial=${westTrial}#play`, adult)).html;
  const regPath = /href="(\/register-interest\/[0-9a-f-]{36}\?club=[0-9a-f-]{36}(?:&amp;|&)trial=[0-9a-f-]{36})"/.exec(viaBoard)?.[1]?.replace(/&amp;/g, '&');
  const regForm = regPath ? forms((await get(regPath, adult)).html).find((f) => 'trialId' in f.fields) : null;
  const done = regForm ? await post(regPath, adult, { ...regForm.fields, note: 'Left back, both feet.' }) : { location: '' };
  const told = words((await get(done.location || '/home', adult)).html);
  check('one-w3: the button goes on the club\'s register, carrying the trial — and the family is told they are on it, never that the club is unverified (M9)',
    [Boolean(regForm?.fields.trialId === westTrial), /registered=1/.test(done.location), told.includes('on Westgate Rangers'), /unverified|not verified|isn't verified/i.test(told)],
    [true, true, true, false]);
  const held = words((await get('/club/register', robin)).html);
  check('one-w4: and the club, until it is verified, sees a count and no name (D-126)',
    [/\b\d+ waiting\b/.test(held), held.includes('Jordan')], [true, false]);

  // ---- a suspended club advertises nothing -----------------------------------------
  const kingsway = ids.clubs['kingsway-rovers'], westgate = ids.clubs['westgate-rangers'];
  const logCall = async (clubId, extra) => {
    const sheet = `/ops/call/${clubId}`;
    const form = forms((await get(sheet, op)).html).find((f) => f.visible.some((v) => v.name === 'outcome'));
    return post(sheet, op, { ...form.fields, operator: 'BUZ', number_called: '03 9000 0600', number_source: 'FV club directory',
      answered_by: 'Committee', club_confirmed: 'yes', person_confirmed: 'yes', incorporated: 'yes', authority_confirmed: 'yes',
      notes: 'advertising drill', ...extra });
  };
  // Where round I found them: the board, and the club's own page — its trial
  // rows (each links to itself on the page) and the "Trials coming" count over
  // them. By the notice's link, not its title: the form sweep renames it.
  const shown = async (club, slug) => {
    const board = (await get('/trials', null)).html, page = (await get(`/fc/${slug}`, null)).html;
    return [Boolean(listingOf(board, club, slug)), page.includes(`href="/fc/${slug}?trial=`), words(page).includes('Trials coming')];
  };
  const K = ['Kingsway Rovers FC', 'kingsway-rovers'];
  check('susp-ad-w0: Kingsway, verified, has its own trial on the board and on its page', await shown(...K), [true, true, true]);
  // Brief L's two follow-ups, read in the same places: the club page's way in
  // (the "Want to play here?" panel, its doors, and the squad chips' hint),
  // and a coaching role Kingsway posts on its own screen — on /jobs, on its
  // own page, and in the club page's "looking for coaches" card (0151).
  const dana = ids.people.dana;
  const roleForm = forms((await get('/club/roles', dana)).html).find((f) => f.visible.some((v) => v.name === 'title'));
  await post('/club/roles', dana, { ...roleForm.fields, title: 'Kingsway sweep coach', ageGroup: 'SEN', commitment: 'Tue 7pm' });
  const roleId = forms((await get('/club/roles', dana)).html).find((f) => f.fields.roleId)?.fields.roleId;
  const wayIn = async () => {
    const page = words((await get('/fc/kingsway-rovers', adult)).html), raw = (await get('/fc/kingsway-rovers', adult)).html;
    return [raw.includes('id="play"'), /Want to play here\?|Register my interest|Send my CV to Kingsway|Tap a squad to go on the register/.test(page),
      /Kingsway Rovers FC is looking for coaches/.test(page), (await get('/jobs', null)).html.includes('Kingsway sweep coach'),
      roleId ? (await get(`/jobs/${roleId}`, null)).status : null];
  };
  check('susp-ad-w4: Kingsway, verified, offers a family its way in, and its coaching role is on the jobs board, on its own page and on the club page',
    await wayIn(), [true, true, true, true, 200]);
  const reverify = () => logCall(kingsway, { outcome: 'verified', td_name: 'Dana Kovac', td_email: 'kingsway@example.com' });
  for (const [outcome, cls] of [['suspended', 'child_safety'], ['suspended', 'administrative'], ['suspended', 'non_payment'], ['takedown', '']]) {
    await logCall(kingsway, { outcome, suspension_reason: cls });
    const down = await shown(...K), downIn = await wayIn();
    await reverify();
    const up = await shown(...K), upIn = await wayIn();
    const how = outcome === 'takedown' ? 'taken down with no class recorded' : `suspended for the ${cls} class`;
    check(`susp-ad-w1: ${how}, Kingsway's trial is off the board and off its page — and verified again, it is back on both`,
      [down, up], [[false, false, false], [true, true, true]]);
    check(`susp-ad-w5: ${how}, Kingsway's page offers no way in — no "Want to play here?", no send or register door, no squad hint — and its coaching role is off the board, its own page and the club page; verified again, all of it is back (brief L, 0151)`,
      [downIn, upIn], [[false, false, false, false, 404], [true, true, true, true, 200]]);
  }
  const W = ['Westgate Rangers', 'westgate-rangers'];
  check('susp-ad-w2: Westgate, claimed, has Pitch\'s compiled trial on the board and on its page', await shown(...W), [true, true, true]);
  await logCall(westgate, { outcome: 'suspended', suspension_reason: '' });
  check('susp-ad-w3: suspended with no class, the notice Pitch compiled is off the board and off its page too — whoever posted it',
    await shown(...W), [false, false, false]);

  // ---- the empty board (BUZ, 1 Oct: P3, P4, N1) --------------------------------------
  // Last, because it takes every notice off the board: each club still listing
  // one is suspended through the call sheet, as Kingsway and Westgate were.
  // The seed always lists trials, so this is the one place the board most
  // visitors see at launch — no trials at all — can be read.
  // P3: no filters (nothing to filter) and no note about "the button on each
  // listing". N1: "No trials listed yet." when nothing is chosen, in one
  // element with the rest of the sentence. P4: a signed-out visitor is offered
  // two doors in words already approved — a family builds its CV (/join, the
  // secondary), a club claims its page (/claim, the one primary on the
  // screen). A signed-in seat sees the board in its frame, with no doors.
  {
    // Loud, never silent (safety review N1): a listed club the fixtures do not
    // know, or whose call sheet has no outcome form, is a counted FAIL — never
    // a skip, and never a crash that stops the suite before its summary.
    try {
      const plain = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<!-- -->/g, '');
      const listed = [...new Set([...(await get('/trials', null)).html.matchAll(/href="\/fc\/([a-z0-9-]+)(?:\?trial=[0-9a-f-]{36})?#play"/g)].map((m) => m[1]))];
      const missed = [];
      for (const slug of listed) {
        const clubId = ids.clubs[slug];
        if (!clubId) { missed.push(`${slug}: not a seeded club`); continue; }
        try {
          const r = await logCall(clubId, { outcome: 'suspended', suspension_reason: 'administrative' });
          if (r.status >= 400) missed.push(`${slug}: the call sheet answered ${r.status}`);
        } catch (e) { missed.push(`${slug}: the call sheet could not be pressed (${e.message})`); }
      }
      check(`empty-w0a: every club listing a notice was suspended through its call sheet (${missed.join('; ') || 'all were'})`, missed, []);
      const out = plain((await get('/trials', null)).html);
      const line = /<p><b>No trials listed yet\.<\/b> An empty week is honest — we only list what a club has posted or published itself\.<\/p>/;
      check(`empty-w0: with every club that listed a notice suspended (${listed.join(', ') || 'none listed'}), the board is empty`,
        // No count line at all, rather than "0 trials" (D-162; Product
        // Design, 2 Oct): the empty line says it in words (empty-w1).
        [listed.length > 0, /(\d+) trials?</.exec(out)?.[1] ?? null, /href="\/fc\/[^"]+#play"/.test(out)], [true, null, false]);
      check('empty-w1: the empty board shows no filters and no note about buttons that are not there, and says "No trials listed yet." as one sentence in one element (P3, N1)',
        [/trial-filters/.test(out), ['Age group', 'Competition', 'Positions wanted'].filter((g) => out.includes(g)), out.includes('the button on each listing'),
         line.test(out), out.includes('No trials listed for that yet.')],
        [false, [], false, true, false]);
      check('empty-w2: signed out, it offers the two doors — "Build a CV first" to /join as the secondary, "Claim your club page" to /claim as the one primary on the screen (P4)',
        [/href="\/join"[^>]*class="btn btn-secondary[^"]*"[^>]*>Build a CV first — it is what the club reads<|class="btn btn-secondary[^"]*"[^>]*href="\/join"[^>]*>Build a CV first — it is what the club reads</.test(out),
         /href="\/claim"[^>]*class="btn btn-primary[^"]*"[^>]*>Claim your club page<|class="btn btn-primary[^"]*"[^>]*href="\/claim"[^>]*>Claim your club page</.test(out),
         out.includes('For clubs &amp; technical directors'), out.includes('Put your trials where families can find them.'),
         (out.match(/class="btn btn-primary/g) ?? []).length],
        [true, true, true, true, 1]);
      // The doors are a visitor's (P4), so every kind of signed-in seat is
      // read (safety review N2): a player (Nate — by here Jordan has a child
      // linked and sits in the Parent frame, as on /home), a guardian (Jordan,
      // in that Parent frame) and a club seat (Marina, TD — no seat frame).
      // A rule that keyed the doors off the frame instead of the session would
      // show them to the club seat; this is where that is caught.
      const seats = [['a player', ids.children.nate.child_id, 'Player'], ['a guardian', ids.people.jordan, 'Parent'], ['a club TD', op, null]];
      for (const [label, who, frame] of seats) {
        const inside = plain((await get('/trials', who)).html);
        const frames = ['Player', 'Parent', 'Coach'].filter((f) => new RegExp(`<nav[^>]*aria-label="${f}"`).test(inside));
        check(`empty-w3: signed in as ${label}, the empty board is in ${frame ? `the ${frame} frame` : 'no seat frame'}, with the line and neither door — the doors are a visitor's`,
          [frames, line.test(inside), /trial-filters/.test(inside), inside.includes('Build a CV first'), inside.includes('Claim your club page')],
          [frame ? [frame] : [], true, false, false, false]);
      }
      const old = plain((await get('/trials?gender=girls', null)).html);
      check('empty-w4: an old link filtered to something on the empty board keeps its choice to take off, and says the approved line for a choice',
        [/aria-label="Remove Girls"/.test(old), old.includes('<b>No trials listed for that yet.</b>'), old.includes('No trials listed yet.')],
        [true, true, false]);
    } catch (e) {
      check(`empty-w: the empty-board block ran to its end (${e.message})`, false, true);
    }
  }
}

// ---------------------------------------------------------------------------
// addr-w3 — no response in the whole write crawl sends a share token into an
// address bar: not in a redirect, and not in a link a page carries (brief D;
// L38/L42). The three pages that show a new link once are named in
// scripts/token-in-url.mjs and counted here, so the watcher is seen to have
// met a token in a Location and recognised it (L19).
// ---------------------------------------------------------------------------
check(`addr-w3: no response in the write crawl carries a share token in a Location or in a link's query string, but the three that show a new link once (${tokenWatch.pages} pages, ${tokenWatch.redirects} redirects, ${tokenWatch.shownOnce} shown once)`,
  [tokenWatch.leaks, tokenWatch.redirects > 100, tokenWatch.shownOnce > 0], [[], true, true]);

console.log(`\n${pass} passed, ${failures.length} failed${failures.length ? ' - ' + failures.join('; ') : ' - ALL GREEN'}`);
console.log('NOTE: this mutated the dev database. Restart scripts/dev-db.mts for a clean one.');
process.exit(failures.length ? 1 : 0);
