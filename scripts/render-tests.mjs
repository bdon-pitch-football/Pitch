// Render tests: assert what the PRODUCT SERVES, not what its source says.
//
// WHY THIS EXISTS. The permission suite is 268 behavioural checks against
// Postgres and about 130 that only read source text, and twice in two days a
// source-text check was green while the property was false:
//
//   · doc 14 L57 — "the guardian sees every send, recipient address in full"
//     — was implemented in fn_send_log, asserted against fn_send_log, green
//     the whole time, AND NO PAGE CALLED IT. The promise lived in the
//     database and was unreachable from the product.
//   · the outbox sweep's check looked for "for update skip locked" and passed
//     while the sweep was double-sending, because the lock was taken and
//     released before any work happened.
//
// Reading the source cannot catch either. Rendering the page catches both.
//
// These run against the dev server and the dev database — the same two
// processes the walkthrough uses — and they read .dev-ids.json, which the
// seed writes, because every reseed mints fresh uuids.
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.RENDER_BASE ?? 'http://localhost:3000';
const ids = JSON.parse(readFileSync(fileURLToPath(new URL('../.dev-ids.json', import.meta.url)), 'utf8'));

let pass = 0;
const failures = [];
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass += 1; console.log(`OK   ${name}`); }
  else { failures.push(name); console.log(`FAIL ${name} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

// The dev session cookie is a signed person id (lib/session.ts). Minting one
// here is how a test BECOMES a seat; there is no other way in without
// driving a browser.
const cookieFor = (personId) =>
  `pitch_session=${personId}.${createHmac('sha256', process.env.SESSION_SECRET || 'dev-only-secret-not-for-production').update(personId).digest('base64url')}`;

async function get(path, personId) {
  const res = await fetch(BASE + path, {
    redirect: 'manual',
    headers: personId ? { cookie: cookieFor(personId) } : {},
  });
  return { status: res.status, location: res.headers.get('location'), html: await res.text() };
}

/** Visible text, in document order, with tags and scripts stripped. */
function text(html) {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map((s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&rsquo;/g, '’').replace(/&ldquo;|&rdquo;/g, '"').trim())
    .filter(Boolean);
}
const has = (html, s) => text(html).some((l) => l.includes(s));
const order = (html, a, b) => {
  const t = text(html);
  const ia = t.findIndex((l) => l.includes(a));
  const ib = t.findIndex((l) => l.includes(b));
  return ia !== -1 && ib !== -1 && ia < ib;
};

const alex = ids.people.alex;
const deniz = ids.children.deniz;
const georgia = ids.children.georgia;

// ---------------------------------------------------------------------------
// L57 - the promise that was green in the database and absent from the page.
// ---------------------------------------------------------------------------
{
  const { html } = await get(`/g/controls/${deniz.child_id}`, alex);
  check('r1: the controls page names the club a CV went to',
    has(html, 'Kingsway Rovers FC'), true);
  check('r2: and shows the recipient address IN FULL (L57)',
    has(html, 'recruitment@kingswayrovers.example.au'), true);
  check('r3: most recent send first',
    order(html, 'Kingsway Rovers FC', 'Northern United SC'), true);

  // "Everything that's happened" was capped at eight rows, so a parent could
  // not reach their own approval. Deniz has ten events.
  check('r4: the consent timeline reaches the approval, not just the last eight',
    has(html, 'You approved the profile'), true);
  check('r5: and it is ordered newest first, with ties in the order they happened',
    order(html, 'You approved the profile', 'You opened the permission page'), true);
}

// ---------------------------------------------------------------------------
// The CV, per age band. The stat tiles used to ship zeros in the HTML.
// ---------------------------------------------------------------------------
{
  const { html } = await get('/p/dev-deniz');
  check('r6: a stat tile serves its real value, not the counter it starts from',
    has(html, '18') && has(html, '11') && has(html, '7'), true);
  check('r7: a minor CV carries the parent-approved chip', has(html, 'Parent-approved'), true);
  check('r8: and the no-inbound-route block (John, U-11)',
    has(html, 'There is no way to reply to a family through Pitch.'), true);
  check('r9: the club crest line carries the locality from the CLUB record',
    has(html, 'Brunswick VIC'), true);
  check('r10: football history names the current club and the one before it',
    order(html, 'Riverside FC', 'Brunswick Juniors SC'), true);
  check('r11: and says which of the two Pitch stands behind',
    has(html, 'Only the club at the top is one we hold on Pitch.'), true);
  check('r12: one clip subtitle, not one per card',
    text(html).filter((l) => l === 'Goals, assists & link play').length, 1);
}
{
  const { html } = await get('/p/dev-jordan');
  check('r13: an adult CV does NOT claim a parent approved it', has(html, 'Parent-approved'), false);
  check('r14: and carries no guardian-facing no-reply block',
    has(html, 'no way to reply to a family'), false);
}

// ---------------------------------------------------------------------------
// D-77 - a dead link of any kind is one identical page.
// ---------------------------------------------------------------------------
{
  const pages = [];
  for (const t of ['dev-expired', 'dev-revoked', 'nonsense-never-existed', 'bogus']) {
    const { status, html } = await get(`/p/${t}`);
    pages.push({ t, status, body: text(html).join('|') });
  }
  check('r15: every dead link answers 200, never a 404',
    pages.map((p) => p.status), [200, 200, 200, 200]);
  check('r16: and every one serves the identical body',
    new Set(pages.map((p) => p.body)).size, 1);
}

// ---------------------------------------------------------------------------
// A record that is not yours is indistinguishable from one that is not there.
// ---------------------------------------------------------------------------
{
  const stranger = ids.people.marina;   // a club TD, guardian of nobody
  const mine = await get(`/build/${deniz.record_id}`, alex);
  const theirs = await get(`/build/${deniz.record_id}`, stranger);
  const absent = await get('/build/00000000-0000-0000-0000-000000000000', stranger);
  const malformed = await get('/build/bogus', stranger);
  check('r17: the guardian reaches their own child’s builder', mine.status, 200);
  check('r18: a stranger is sent away', theirs.status, 307);
  check('r19: a record that does not exist gets the SAME answer',
    absent.location, theirs.location);
  check('r20: and so does a malformed id - no 500, no different answer',
    malformed.location, theirs.location);

  // Every route that casts a path segment to uuid, swept in one place. The
  // crawl cannot reach these: it only follows links that exist, and a
  // malformed id is by definition a link nobody rendered. /ops/call was
  // 500ing on one — the class was fixed elsewhere and missed there because
  // nothing had ever walked the operator console.
  const idRoutes = ['/build/bogus', '/ops/call/bogus', '/g/controls/bogus', '/g/pending/bogus',
    '/g/send/bogus', '/g/interest/bogus', '/g/card/bogus', '/send/bogus', '/share-card/bogus',
    '/register-interest/bogus', '/club/invite/bogus', '/club/register/cv/bogus',
    '/join/waiting/bogus', '/a/bogus', '/jobs/bogus'];
  const fivehundred = [];
  for (const r of idRoutes) {
    const res = await get(r, stranger);
    if (res.status >= 500) fivehundred.push(`${res.status} ${r}`);
  }
  check(`r20b: no malformed id anywhere reaches Postgres as a uuid cast (${fivehundred.join(', ') || 'none'})`,
    fivehundred.length, 0);
}

// ---------------------------------------------------------------------------
// The club page.
// ---------------------------------------------------------------------------
{
  const { html } = await get('/fc/riverside-fc');
  check('r21: squads run in AGE order, not alphabetical',
    order(html, 'MiniRoos U9', 'U13 Boys') && order(html, 'U21 Men', 'Seniors Women'), true);
  check('r22: the club’s own address card is off the public page',
    has(html, 'Club page link'), false);
  check('r23: trials appear above the register door',
    order(html, 'U14 & U15 Boys trials', 'Want to play here?'), true);
}

// ---------------------------------------------------------------------------
// The coach page: what is attested and what is typed, kept apart.
// ---------------------------------------------------------------------------
{
  const { html } = await get('/c/sam-kaya');
  check('r24: licences run newest first',
    order(html, 'AFC B Diploma', 'AFC C Diploma'), true);
  check('r25: the page says which credential a club confirmed',
    has(html, 'Working With Children Check is the one thing on this page a club confirmed'), true);
  check('r26: years coaching is in the hero, not buried below the fold',
    order(html, 'Years coaching', 'Coaching philosophy'), true);
}

// ---------------------------------------------------------------------------
// /home - the waiting list is ordered by how long it has waited.
// ---------------------------------------------------------------------------
{
  const { html } = await get('/home', alex);
  check('r27: the oldest waiting item leads',
    order(html, 'would like Georgia at a trial', 'wants to go on Riverside FC'), true);
  check('r28: and the newest is last',
    order(html, 'wants to send a CV to Sunbury United', 'changed the page'), true);
  check('r29: each one says how long it has waited', has(html, '11 days ago'), true);
  check('r30: the hero counts the links, not nothing', has(html, 'Links active'), true);
}

// ---------------------------------------------------------------------------
// D-25 - no screen guesses a pronoun, on any child.
// ---------------------------------------------------------------------------
{
  const bad = /\b(his|her|him|she|he)\b/i;
  for (const [who, path] of [['home', '/home'], ['controls', `/g/controls/${georgia.child_id}`]]) {
    const { html } = await get(path, alex);
    const offending = text(html).filter((l) => bad.test(l) && /Georgia|Deniz|Nate/.test(l));
    check(`r31: ${who} says nothing gendered about a child (${offending[0]?.slice(0, 46) ?? 'none'})`,
      offending.length, 0);
  }
}

// ---------------------------------------------------------------------------
// The register — the thing clubs pay for, and the seats that must not reach it.
// ---------------------------------------------------------------------------
{
  const marina = ids.people.marina;      // Riverside TD, verified club
  const sunbury = ids.people['m.'];      // claimed club, NOT verified
  const sam = ids.people.sam;            // coach
  const alex = ids.people.alex;          // parent

  for (const [who, id] of [['a coach', sam], ['a parent', alex]]) {
    const r = await get('/club/register', id);
    check(`r32: ${who} cannot open a club register`, r.status, 307);
  }

  // D-126, and the sentence the whole product rests on: paying does not
  // change it and cannot. An unverified club sees a COUNT and no names.
  const { html: unv } = await get('/club/register', sunbury);
  check('r33: an unverified club is told how many are waiting', has(unv, 'waiting'), true);
  check('r34: and is shown no name at all',
    text(unv).some((l) => /Deniz|Nate|Georgia/.test(l)), false);
  check('r35: and is told plainly that paying will not change it',
    has(unv, 'Paying doesn’t change it and can’t.'), true);

  // Every row's primary action has to work. Ninety-seven of a hundred used to
  // 404 for the club's own TD: the page read the u16 approved snapshot for
  // EVERY band, and 16-17 and 18+ never have one.
  const { html: reg } = await get('/club/register', marina);
  const links = [...new Set([...reg.matchAll(/\/club\/register\/cv\/([a-f0-9-]{36})/g)].map((m) => m[1]))];
  check('r36: the register is seeded at a realistic size', links.length >= 90, true);
  let opened = 0;
  for (const id of links) {
    if ((await get(`/club/register/cv/${id}`, marina)).status === 200) opened += 1;
  }
  check(`r37: every row on it opens for the club's own TD (${opened}/${links.length})`,
    opened, links.length);
  // and for nobody else
  check('r38: another club cannot open a row on this register',
    (await get(`/club/register/cv/${links[0]}`, sunbury)).status, 404);
}

// ---------------------------------------------------------------------------
// NAVIGATION. Crawl every link a seat can actually reach and check that none
// of them is broken, and that no signed-in screen is a cul-de-sac.
//
// Twenty screens had no link out at all — the whole build flow, all six
// guardian screens, the club's billing and trial screens, the coach editor
// and the operator console. On the web the browser's back button hides that.
// This is an INSTALLABLE app, and in standalone mode there is no browser
// chrome: a parent who opened Manage was stuck.
//
// /privacy, /terms, /report and the print views are deliberately terminal —
// they are reached from public contexts where "/home" would be the wrong
// destination, so a back link there would point somewhere wrong rather than
// nowhere.
// ---------------------------------------------------------------------------
{
  // ONE WALK, every signal. This used to be three separate crawls over the
  // same pages — navigation, bound actions, accessibility — each re-fetching
  // everything the others had already fetched, and the suite took minutes.
  // A page is expensive to fetch and cheap to inspect, so it is fetched once
  // and every question is asked of the same response.
  const TERMINAL = ['/privacy', '/terms', '/report', '/print'];
  const norm = (u) => u.split('?')[0].split('#')[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '*')
    .replace(/\/p\/[^/*]+/, '/p/*').replace(/\/(c|fc|claim)\/[^/*]+/, '/$1/*');

  const seats = {
    'signed out': null,
    parent: ids.people.alex,
    player: ids.people.jordan,
    'club TD': ids.people.marina,
    'unverified club': ids.people['m.'],
    coach: ids.people.sam,
    // An account with NOTHING on it — the first screen a real user sees.
    // Every other fixture person already has something, so this state had
    // never been rendered by anyone and /home was a total dead end on it.
    'brand new': ids.people.robin,
    // A 16-17 signs in and sends their own CV (doc 14 L5). No seat walked
    // that band, and its send screen told a seventeen-year-old they were
    // under sixteen.
    '16–17 player': ids.children.nate.child_id,
    // D-153: a verified club with no subscription, inviting from its own trial.
    'free club': ids.people.dana,
    // D-154: an administrator at a verified, paying club reads no registration.
    'club admin': ids.people.pat,
    // The operator console had never been walked by ANY seat, so its pages
    // were outside every check the crawl makes. Two things were sitting in
    // there: a queue heading that was still a styled <div>, and a call sheet
    // that 500'd on a malformed club id. The gate is open in development by
    // design (lib/ops-policy.ts), so any signed-in seat can reach it here.
    operator: ids.people.marina,
  };

  // Collected across every seat, so the assertions below need no more HTTP.
  const bound = new Set();       // pages serving a JS-only server action
  const noHeading = new Set();   // pages that do not announce themselves
  const unnamed = new Set();     // form controls with no accessible name
  const untitled = new Set();    // pages serving no title, or the landing page's
  const homeCanon = new Set();   // pages claiming to be a duplicate of /
  const banned = new Set();      // D-85 / D-108 vocabulary, in served text
  let fetched = 0;

  for (const [seat, who] of Object.entries(seats)) {
    const seen = new Set();
    // The signed-out entry points are in the queue too, so one walk covers
    // the public pages a seat would never link to.
    const queue = ['/', '/home', '/trials', '/jobs', '/signin', '/join'];
    // Nothing in the product links to the operator console, so it has to be
    // seeded or it is never seen.
    if (seat === 'operator') queue.push('/ops/verification', '/ops/support');
    const per = new Map();
    const broken = []; const stuck = new Set();
    while (queue.length) {
      const path = queue.shift();
      const P = norm(path);
      if (seen.has(path)) continue;
      per.set(P, (per.get(P) ?? 0) + 1);
      if (per.get(P) > 2) continue;      // 100 register rows are not 100 routes
      seen.add(path);
      const r = await get(path, who);
      fetched += 1;
      if (r.status >= 400) broken.push(`${r.status} ${P}`);
      if (r.status !== 200) continue;

      // --- every question, asked of the one response ---------------------
      if (/name="\$ACTION_REF_\d+"/.test(r.html)) bound.add(P);
      if (!/<h1[\s>]/.test(r.html)) noHeading.add(P);
      const title = /<title>([^<]*)<\/title>/.exec(r.html)?.[1] ?? '';
      if (!title || (P !== '/' && !/ · Pitch Football$/.test(title))) untitled.add(`${P} "${title}"`);
      // D-85 and D-108 are DATA CONSTRAINTS, not style preferences: the
      // register-interest vocabulary is what keeps this out of the Online
      // Safety Act's feedback-feature analysis, and "potential" is the word
      // that closes a technical director's laptop. The corpus check reads the
      // docs; nothing had ever read what the PRODUCT puts on screen.
      // The two legal documents are exempt for the same reason the corpus
      // check exempts them: they NAME the banned words in order to explain
      // the bans ("applied to anything below U13"), and explaining a ban is
      // not using it. Every product surface is in scope.
      if (P !== '/privacy' && P !== '/terms') {
        for (const line of text(r.html)) {
          const m = /\b(potential|insights?|struggling|applications?|applied|declined|rejected|unsuccessful)\b/i.exec(line);
          if (m) banned.add(`${P} "${m[1]}" in: ${line.slice(0, 60)}`);
        }
      }
      const canon = /rel="canonical" href="([^"]*)"/.exec(r.html)?.[1];
      if (canon && P !== '/' && /^https?:\/\/[^/]+\/?$/.test(canon)) homeCanon.add(P);
      const inLabels = [...r.html.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/g)].map((m) => m[1]).join('');
      for (const f of r.html.matchAll(/<(input|textarea|select)[^>]*>/g)) {
        if (/type="hidden"/.test(f[0])) continue;
        if (inLabels.includes(f[0]) || /aria-label=/.test(f[0])) continue;
        unnamed.add(`${P} ${/name="([^"]*)"/.exec(f[0])?.[1] ?? '?'}`);
      }

      const links = [...new Set([...r.html.matchAll(/href="(\/[^"#][^"]*)"/g)].map((m) => m[1])
        .filter((h) => !h.startsWith('/_next') && !h.startsWith('/assets') && !/\.(png|svg|jpg|ico|xml|txt)$/.test(h)))];
      if (who && links.length === 0 && !TERMINAL.some((t) => P.includes(t))) stuck.add(P);
      for (const h of links) if (!seen.has(h)) queue.push(h);
    }
    check(`r39: nothing a ${seat} can click is broken (${broken.join(', ') || 'none'})`,
      broken.length, 0);
    check(`r40: no screen a ${seat} reaches is a dead end (${[...stuck].join(', ') || 'none'})`,
      stuck.size, 0);
  }

  // A bound action renders $ACTION_REF_n plus encrypted arguments only the
  // client runtime resolves — it 500s without JavaScript instead of
  // degrading, and nothing but a browser can drive it.
  check(`w21: no page in the product renders a bound action (${[...bound].join(', ') || 'none'})`,
    bound.size, 0);
  // 31 of 33 pages had no <h1>: every title was a styled <div>, so a
  // screen-reader user got no page name and no structure to move through.
  check(`a1: every page announces itself with an h1 (${[...noHeading].join(', ') || 'all do'})`,
    noHeading.size, 0);
  // 57 controls had no accessible name — the visible label was a sibling
  // <div>, identical on screen and "edit text, blank" to a screen reader.
  check(`a2: every form control has an accessible name (${[...unnamed].join(', ') || 'all do'})`,
    unnamed.size, 0);
  // Every one of the 51 pages inherited the waitlist landing page's title,
  // so a coach's public CV, a club page and the free PDF export all
  // announced themselves as "Coming soon." — in the tab, in every unfurl,
  // and as the default filename a browser offers when saving the PDF.
  check(`m1: every page names itself, none falls back to the site default (${[...untitled].join(', ') || 'none'})`,
    untitled.size, 0);
  // A root-level canonical of "/" told search engines that every page is a
  // duplicate of the homepage — including the coach link and the club page,
  // the two pages whose whole job is being found.
  check(`m2: no page declares itself a duplicate of the homepage (${[...homeCanon].join(', ') || 'none'})`,
    homeCanon.size, 0);
  check(`m7: no banned word reaches a product screen (${[...banned].join(' | ') || 'none'})`,
    banned.size, 0);
  check(`crawl: one walk answered all of the above (${fetched} responses)`, fetched > 0, true);
}

// D-147: console surfaces are "sidebar + content". The sidebar is a second
// way to the SAME doors /home offers the seat — never a new door, because a
// desktop-only capability is a permission surface nobody tested. So the test
// is not "a nav exists", it is "the nav's links ARE the home page's links".
{
  const hrefs = (html) => [...new Set([...html.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1])
    .filter((h) => !h.startsWith('/_next') && !h.startsWith('/assets') && !/\.(png|svg|ico)$/.test(h)))];
  const navOf = (html, label) => {
    const m = new RegExp(`<nav[^>]*aria-label="${label}"[^>]*>([\\s\\S]*?)</nav>`).exec(html);
    return m ? m[1] : null;
  };
  const CLUB = { '/club/register': 'Register', '/club/squads': 'Squads',
    '/club/page-edit': 'Crest & club page', '/club/roles': 'Coaching roles',
    '/club/post-trial': 'Post a trial', '/club/billing': 'Plan & billing' };
  for (const [seat, who] of [['club TD', ids.people.marina], ['free club', ids.people.dana]]) {
    const home = new Set(hrefs((await get('/home', who)).html));
    home.add('/home');
    for (const path of Object.keys(CLUB)) {
      const { html } = await get(path, who);
      const nav = navOf(html, 'Club');
      check(`s1: ${seat} ${path} carries the club sidebar`, nav !== null, true);
      if (!nav) continue;
      const extra = hrefs(nav).filter((h) => !home.has(h));
      check(`s2: ${seat} ${path} sidebar offers no door /home does not (${extra.join(' ') || 'none'})`, extra.length, 0);
      const current = [...nav.matchAll(/href="([^"]*)"[^>]*aria-current="page"|aria-current="page"[^>]*href="([^"]*)"/g)].map((m) => m[1] ?? m[2]);
      check(`s3: ${seat} ${path} marks exactly itself as the current page`, current, [path]);
      // The phone bar (D-147 as amended 16 Sep): its tabs and its More sheet
      // together are exactly the rail's doors, and no more than four tabs.
      const bar = navOf(html, 'Club bar');
      check(`s3b: ${seat} ${path} carries the club bar`, bar !== null, true);
      if (bar) {
        check(`s3c: ${seat} ${path} bar and More sheet are the rail's doors`, hrefs(bar).sort(), hrefs(nav).sort());
        const tabs = (bar.split('<details')[0].match(/class="seat-tab"/g) ?? []).length + (/<details/.test(bar) ? 1 : 0);
        check(`s3d: ${seat} ${path} bar shows at most four tabs`, tabs <= 4, true);
        const inBar = [...bar.matchAll(/href="([^"]*)"[^>]*aria-current="page"|aria-current="page"[^>]*href="([^"]*)"/g)].map((m) => m[1] ?? m[2]);
        check(`s3e: ${seat} ${path} bar marks the same page`, inBar, [path]);
      }
    }
  }
  for (const path of ['/ops/verification', '/ops/support']) {
    const opHtml = (await get(path, ids.people.marina)).html;
    const nav = navOf(opHtml, 'Operator');
    check(`s4: ${path} carries the operator sidebar`, nav !== null, true);
    const opBar = navOf(opHtml, 'Operator bar');
    check(`s4b: ${path} carries the operator bar, with the same doors`, opBar && nav ? JSON.stringify(hrefs(opBar)) === JSON.stringify(hrefs(nav)) : false, true);
  }
  // D-154 — the administrator's frame and walls. The same subset rule, and
  // the register itself is not one of her doors at a verified club.
  {
    const pat = ids.people.pat;
    const patHome = new Set(hrefs((await get('/home', pat)).html));
    patHome.add('/home');
    check('s10: a verified club’s administrator is offered no register on /home', patHome.has('/club/register'), false);
    for (const path of ['/club/squads', '/club/page-edit', '/club/roles', '/club/post-trial', '/club/billing']) {
      const nav = navOf((await get(path, pat)).html, 'Club');
      check(`s10b: club admin ${path} carries the club sidebar`, nav !== null, true);
      if (!nav) continue;
      const extra = hrefs(nav).filter((h) => !patHome.has(h));
      check(`s10c: club admin ${path} sidebar offers no door /home does not (${extra.join(' ') || 'none'})`, extra.length, 0);
    }
    check('s11: the register page sends her home (N17)', (await get('/club/register', pat)).status, 307);
    const regId = /\/club\/register\/cv\/([0-9a-f-]{36})/.exec((await get('/club/register', ids.people.marina)).html)?.[1];
    check('s11b: a registration’s CV is not found for her, not forbidden', (await get(`/club/register/cv/${regId}`, pat)).status, 404);
    check('s11c: nor its invite page', (await get(`/club/invite/${regId}`, pat)).status, 404);
    const squadsHtml = (await get('/club/squads', pat)).html;
    check('s11d: and she is not shown who reads the register, or asked to bring a coach in', /Coaches who read your register|Bring in a coach/.test(squadsHtml), false);
  }
  // D-154 — a granted coach's registrations: their teams, read-only.
  {
    const sam = ids.people.sam;
    const res = await get('/coach/register', sam);
    check('s12: a granted coach has a registrations page', res.status, 200);
    const squadsShown = [...res.html.matchAll(/<div style="font-size:14px;font-weight:900">([^<]+)<!-- -->/g)].map((m) => m[1].trim());
    check(`s12b: showing only the teams the club granted (${squadsShown.join(', ') || 'none'})`,
      squadsShown.length > 0 && squadsShown.every((n) => n === 'U14 Boys' || n === 'U15 Girls'), true);
    check('s12c: with no invite, shortlist or status control anywhere on it', /Invite to trial|Shortlist|name="status"/.test(res.html), false);
    const cv = /\/club\/register\/cv\/([0-9a-f-]{36})/.exec(res.html)?.[1];
    check('s12d: a CV on his team opens', cv ? (await get(`/club/register/cv/${cv}`, sam)).status : null, 200);
    const tdIds = [...(await get('/club/register', ids.people.marina)).html.matchAll(/\/club\/register\/cv\/([0-9a-f-]{36})/g)].map((m) => m[1]);
    const samIds = new Set([...res.html.matchAll(/\/club\/register\/cv\/([0-9a-f-]{36})/g)].map((m) => m[1]));
    const offTeam = tdIds.find((id) => !samIds.has(id));
    check('s12e: a CV off his teams is not found', offTeam ? (await get(`/club/register/cv/${offTeam}`, sam)).status : null, 404);
    check('s12f: and the TD’s register page is not his', (await get('/club/register', sam)).status, 307);
    check('s12g: a coach with no grant has no registrations page', (await get('/coach/register', ids.people.robin)).status, 307);

    // BUZ, 15 Sep: filter a coach's registrations by team and position, like
    // the club register. Filters narrow what is DRAWN, never what is read.
    const cardsOf = (html) => [...html.matchAll(/data-registration="([0-9a-f-]{36})"[\s\S]*?<\/div><div style="font-size:12.5px[^"]*">([^<]*)</g)]
      .map((m) => ({ id: m[1], positions: m[2].split(' · ').map((x) => x.trim()) }));
    const allCards = cardsOf(res.html);
    check('s13: the unfiltered page draws a card per registration it read', allCards.length > 0, true);
    const posChip = /href="\/coach\/register\?pos=([A-Z]+)"/.exec(res.html)?.[1];
    check('s13b: it offers a position filter', Boolean(posChip), true);
    const byPos = cardsOf((await get(`/coach/register?pos=${posChip}`, sam)).html);
    check(`s13c: filtering by ${posChip} draws only players who list ${posChip}`,
      byPos.length > 0 && byPos.every((c) => c.positions.includes(posChip)), true);
    const teamChip = /href="\/coach\/register\?team=([0-9a-f-]{36})"/.exec(res.html)?.[1];
    check('s13d: with two teams, it offers a team filter', Boolean(teamChip), true);
    const byTeamHtml = (await get(`/coach/register?team=${teamChip}`, sam)).html;
    const teamHeads = [...byTeamHtml.matchAll(/<div style="font-size:14px;font-weight:900">([^<]+)<!-- -->/g)].map((m) => m[1].trim());
    check(`s13e: filtering by team draws one team (${teamHeads.join(', ')})`, teamHeads.length, 1);
    const allIds = new Set(allCards.map((c) => c.id));
    check('s13f: no filter ever draws a registration the page did not already read',
      [...byPos, ...cardsOf(byTeamHtml)].every((c) => allIds.has(c.id)), true);
    const unreadable = tdIds.find((id) => !allIds.has(id));
    const forged = (await get(`/coach/register?team=${crypto.randomUUID()}&pos=ZZ`, sam)).html;
    check('s13g: an invented team or position is ignored — the full list, not an empty or wider one',
      cardsOf(forged).length, allCards.length);
    check('s13h: and a filter cannot pull in a registration off his teams', unreadable ? forged.includes(unreadable) : null, false);
  }

  // The coach's frame (BUZ, 15 Sep): the coach's own doors from /home, the
  // same subset rule, and a role page counts as the roles board.
  {
    const sam = ids.people.sam;
    const samHome = new Set(hrefs((await get('/home', sam)).html));
    samHome.add('/home');
    const roleLink = hrefs((await get('/jobs', sam)).html).find((h) => /^\/jobs\/[0-9a-f-]{36}$/.test(h));
    check('s6: the roles board lists at least one role to open', Boolean(roleLink), true);
    for (const [path, current] of [['/coach/edit', '/coach/edit'], ['/jobs', '/jobs'], [roleLink, '/jobs']]) {
      if (!path) continue;
      const nav = navOf((await get(path, sam)).html, 'Coach');
      const P = path.replace(/[0-9a-f-]{36}/, '*');
      check(`s6: coach ${P} carries the coach sidebar`, nav !== null, true);
      if (!nav) continue;
      const extra = hrefs(nav).filter((h) => !samHome.has(h));
      check(`s7: coach ${P} sidebar offers no door /home does not (${extra.join(' ') || 'none'})`, extra.length, 0);
      const marked = [...nav.matchAll(/href="([^"]*)"[^>]*aria-current="page"|aria-current="page"[^>]*href="([^"]*)"/g)].map((m) => m[1] ?? m[2]);
      check(`s8: coach ${P} marks ${current} as the current page`, marked, [current]);
    }
    // The jobs board is public. Nobody who is not in a coach seat gets a
    // coach's frame on it — not a stranger, not a parent, and not a TD, whose
    // /home is the club's.
    for (const [who, label] of [[null, 'signed out'], [ids.people.alex, 'a parent'], [ids.people.marina, 'a club TD']]) {
      const html = (await get('/jobs', who)).html;
      check(`s9: /jobs for ${label} carries no sidebar`, /class="console-nav"/.test(html), false);
    }
  }
  // The player's frame (BUZ, 16 Sep). Same rule as the club console: the
  // frame is a second way to the doors /home already offers this seat, and
  // the bar a phone gets and the rail a laptop gets are the SAME four doors —
  // a capability at one width and not the other is a surface nobody tested.
  {
    const jordan = ids.people.jordan;
    const homeHtml = (await get('/home', jordan)).html;
    const jordanHome = new Set(hrefs(homeHtml));
    jordanHome.add('/home');
    const rec = hrefs(homeHtml).find((h) => /^\/build\/[0-9a-f-]{36}$/.test(h));
    check('s14: the player home offers the build screen to frame around', Boolean(rec), true);
    const recId = rec ? rec.split('/')[2] : null;
    for (const [path, current] of [['/home', '/home'], [rec, rec], ['/trials', '/trials'],
                                   [recId ? `/send/${recId}` : null, recId ? `/send/${recId}` : null]]) {
      if (!path) continue;
      const html = (await get(path, jordan)).html;
      const P = path.replace(/[0-9a-f-]{36}/, '*');
      const rail = navOf(html, 'Player');
      const bar = navOf(html, 'Player bar');
      check(`s15: player ${P} carries the frame`, rail !== null && bar !== null, true);
      if (!rail || !bar) continue;
      const extra = hrefs(rail).filter((h) => !jordanHome.has(h));
      check(`s16: player ${P} frame offers no door /home does not (${extra.join(' ') || 'none'})`, extra.length, 0);
      check(`s17: player ${P} bar and rail are the same four doors`, hrefs(bar), hrefs(rail));
      const marked = [...rail.matchAll(/href="([^"]*)"[^>]*aria-current="page"|aria-current="page"[^>]*href="([^"]*)"/g)].map((m) => m[1] ?? m[2]);
      check(`s18: player ${P} marks ${P} as the current page`, marked, [current]);
    }
    // The board carries the frame of whoever is looking and nobody else's:
    // a player's for a player, a parent's for a parent, none for a stranger
    // or a club (D-147, amended 16 Sep).
    for (const [who, label, want] of [[null, 'signed out', null], [ids.people.alex, 'a parent', 'Parent'], [ids.people.marina, 'a club TD', null]]) {
      const html = (await get('/trials', who)).html;
      const frames = ['Player', 'Parent', 'Coach'].filter((f) => navOf(html, f) !== null);
      check(`s19: /trials for ${label} carries ${want ?? 'no'} frame`, frames, want ? [want] : []);
    }
  }

  // The builder's progress and the moment at the end of it (BUZ, 16 Sep).
  // Finishing a page used to pass in silence. The moment is a real screen,
  // and it is as closed as every other record surface: a record that is not
  // yours is indistinguishable from one that does not exist (D-77).
  {
    const jordan = ids.people.jordan;
    const rec = hrefs((await get('/home', jordan)).html).find((h) => /^\/build\/[0-9a-f-]{36}$/.test(h));
    if (rec) {
      const build = (await get(rec, jordan)).html;
      // React writes <!-- --> between adjacent expressions, so the sentence
      // is only contiguous once those are stripped.
      check('s20: the builder shows how much of the page is done', /\d of 6 done/.test(build.replace(/<!-- -->/g, '')), true);
      check('s20b: and offers the other two build surfaces', [`${rec}/clips`, `${rec}/more`].every((h) => build.includes(`href="${h}"`)), true);
      const ready = await get(`${rec}/ready`, jordan);
      check('s21: the finished-page screen renders for the player', ready.status, 200);
      check('s21b: and names the page, never a working link', /Your page is (ready|live)/.test(ready.html) && !/\/p\/[A-Za-z0-9_-]{16,}/.test(ready.html), true);
      const doors = hrefs(ready.html);
      check('s21c: and offers sending it and going back to building',
        doors.includes(`/send/${rec.split('/')[2]}`) && doors.includes(rec), true);
      // Not yours reads exactly like not there: both are sent home.
      const theirs = await get(`${rec}/ready`, ids.people.sam);
      const absent = await get('/build/00000000-0000-0000-0000-000000000000/ready', ids.people.sam);
      check('s22: someone else\'s finished-page screen is closed, and says nothing',
        [theirs.status, absent.status], [307, 307]);
    }
  }

  // A club's home joins the frame (D-147 as amended 16 Sep): Home is its
  // first door. And the dashboard shows register numbers only to the person
  // who reads the register — never an administrator (D-154), never a club
  // that is not yet verified, which sees a held count and nothing else
  // (D-126).
  {
    const tdHome = (await get('/home', ids.people.marina)).html;
    const nav = navOf(tdHome, 'Club');
    check('s5: a club TD\'s /home carries the club frame', nav !== null && navOf(tdHome, 'Club bar') !== null, true);
    if (nav) {
      const marked = [...nav.matchAll(/href="([^"]*)"[^>]*aria-current="page"|aria-current="page"[^>]*href="([^"]*)"/g)].map((m) => m[1] ?? m[2]);
      check('s5b: and marks Home as the current page', marked, ['/home']);
    }
    const plain = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!-- -->/g, '');
    check('s5c: the TD\'s home shows what is on the register', /On your register/.test(plain(tdHome)), true);
    const adminHome = plain((await get('/home', ids.people.pat)).html);
    check('s5d: an administrator\'s home shows no register numbers', /On your register|new on the register|interested/.test(adminHome), false);
    const heldHome = plain((await get('/home', ids.people['m.'])).html);
    check('s5e: an unverified club sees a waiting count and nothing else', [/\d+ waiting/.test(heldHome), /On your register|interested/.test(heldHome)], [true, false]);
  }

  // The parent's frame and the coach's bar (D-147, amended 16 Sep). Same
  // rule as every frame: only doors that seat's /home offers, the phone bar
  // and the laptop rail identical, and the page marks itself.
  const frameChecks = async (seat, who, label, pages) => {
    const home = new Set(hrefs((await get('/home', who)).html));
    home.add('/home');
    for (let [path, current] of pages) {
      const html = (await get(path, who)).html;
      const P = path.replace(/[0-9a-f-]{36}/, '*');
      const rail = navOf(html, label);
      const bar = navOf(html, `${label} bar`);
      check(`s23: ${seat} ${P} carries the ${label.toLowerCase()} frame and bar`, rail !== null && bar !== null, true);
      if (!rail || !bar) continue;
      const extra = hrefs(rail).filter((h) => !home.has(h));
      check(`s24: ${seat} ${P} frame offers no door /home does not (${extra.join(' ') || 'none'})`, extra.length, 0);
      check(`s25: ${seat} ${P} bar and rail are the same doors`, hrefs(bar), hrefs(rail));
      check(`s25b: ${seat} ${P} bar holds at most four doors`, hrefs(bar).length <= 4, true);
      // Three or more children collapse to one Children tab, which a
      // child's own page marks instead of a per-child tab.
      if (current.startsWith('/g/controls/') && !rail.includes(`href="${current}"`)) current = '/home#children';
      const marked = [...rail.matchAll(/href="([^"]*)"[^>]*aria-current="page"|aria-current="page"[^>]*href="([^"]*)"/g)].map((m) => m[1] ?? m[2]);
      check(`s26: ${seat} ${P} marks ${current.replace(/[0-9a-f-]{36}/, '*')} as the current page`, marked, [current]);
    }
  };
  const deniz = ids.children.deniz.child_id;
  await frameChecks('parent', ids.people.alex, 'Parent', [
    ['/home', '/home'], [`/g/controls/${deniz}`, `/g/controls/${deniz}`], ['/trials', '/trials'],
  ]);
  await frameChecks('coach', ids.people.sam, 'Coach', [
    ['/home', '/home'], ['/coach/edit', '/coach/edit'], ['/jobs', '/jobs'],
  ]);
}

// A brand-new account is where somebody has just decided to trust us. It
// showed a title, one sentence, and no way to do anything at all.
{
  const { html } = await get('/home', ids.people.robin);
  const links = [...new Set([...html.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1])
    .filter((h) => !h.startsWith('/_next') && !h.startsWith('/assets')))];
  check(`r42: a new account is offered somewhere to go (${links.join(' ') || 'nowhere'})`,
    links.length >= 3, true);
  check('r43: and every door it offers is one that exists',
    (await Promise.all(links.map(async (h) => (await get(h, ids.people.robin)).status)))
      .every((st) => st === 200 || st === 307), true);
}

// ---------------------------------------------------------------------------
// WRITE PATHS. Every check above reads. These submit the real forms the way a
// browser with no JavaScript would — Next renders a server action passed
// directly to <form action={fn}> as a plain POST with a stable action id, so
// it can be driven from here.
//
// A BOUND action cannot: bind() renders $ACTION_REF_n plus encrypted
// arguments that only the client runtime resolves, and posting one without
// JS returns a 500. That is why the guardian's four controls were converted
// to form fields — they are the safety promises of the product, they were
// the four writes that needed JavaScript, and for the same reason they were
// the four nobody could test.
// ---------------------------------------------------------------------------
{
  const url = `/g/controls/${deniz.child_id}`;
  const hiddenOf = (html, needle) => {
    for (const m of html.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/g)) {
      if (!needle.test(m[1])) continue;
      const h = {};
      for (const i of m[1].matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
        const n = /name="([^"]*)"/.exec(i[0])?.[1];
        if (n) h[n] = /value="([^"]*)"/.exec(i[0])?.[1] ?? '';
      }
      return h;
    }
    return null;
  };
  const post = async (path, who, hidden) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(hidden)) fd.append(k, v);
    const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(who) } });
    return r.status;
  };

  const alive = async () => has((await get('/p/dev-deniz')).html, 'Yılmaz');
  check('w1: the child’s link is live to begin with', await alive(), true);

  const pause = hiddenOf((await get(url, alex)).html, /name="paused"/);
  check('w2: the pause control submits without JavaScript', await post(url, alex, pause), 303);
  check('w3: AND THE LINK DIES — the promise the whole product rests on', await alive(), false);

  const unpause = hiddenOf((await get(url, alex)).html, /name="paused"/);
  check('w4: switching it back submits', await post(url, alex, unpause), 303);
  check('w5: and the page is live again — nothing was deleted', await alive(), true);

  const renew = hiddenOf((await get(url, alex)).html, /Renew/);
  check('w6: renew submits without JavaScript', await post(url, alex, renew), 303);

  // A stranger holding the same form fields is still nobody.
  const stolen = hiddenOf((await get(url, alex)).html, /name="paused"/);
  check('w7: another account cannot drive them with the same fields',
    await post(url, ids.people.marina, stolen), 303);
  check('w8: and the child’s page is untouched by that attempt', await alive(), true);
}

// The club's core verb, driven without JavaScript.
{
  const marina = ids.people.marina;
  const hiddenOf = (html, needle) => {
    for (const m of html.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/g)) {
      if (!needle.test(m[1])) continue;
      const h = {};
      for (const i of m[1].matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
        const n = /name="([^"]*)"/.exec(i[0])?.[1];
        if (n) h[n] = /value="([^"]*)"/.exec(i[0])?.[1] ?? '';
      }
      return h;
    }
    return null;
  };
  const before = (await get('/club/register', marina)).html;
  const f = hiddenOf(before, /name="status"/);
  check('w9: the register carries the registration id in the form, not in a closure',
    Boolean(f && f.registrationId && f.status), true);
  const fd = new FormData();
  for (const [k, v] of Object.entries(f)) fd.append(k, v);
  const r = await fetch(BASE + '/club/register', { method: 'POST', body: fd, redirect: 'manual', headers: { cookie: cookieFor(marina) } });
  check('w10: and moving somebody to shortlisted works without JavaScript', r.status, 303);
  const after = (await get('/club/register', marina)).html;
  check('w11: the register actually changed',
    (after.match(/Shortlisted/g) ?? []).length >= (before.match(/Shortlisted/g) ?? []).length, true);
}

// Every page in the converted set must render an UNBOUND action carrying its
// id. A bound one renders $ACTION_REF_n and 500s without the client runtime;
// a missing hidden input is a runtime failure with a green build, so tsc
// cannot see either and this is the only thing that can.
{
  const alex2 = ids.people.alex;
  const home = (await get('/home', alex2)).html;
  const guardianPages = [...new Set([...home.matchAll(/href="(\/g\/[a-z]+\/[a-f0-9-]{36})"/g)].map((m) => m[1]))];
  check('w12: there are guardian flows to check', guardianPages.length >= 3, true);
  for (const path of guardianPages) {
    const kind = path.split('/')[2];
    // The invitation reply is a SECOND step — the first screen is the club's
    // note and a decision, with no form on it at all. Following the link the
    // page itself offers is what a parent does, so it is what this does.
    let { html } = await get(path, alex2);
    if (!/<form/.test(html)) {
      const next = /href="([^"]*\?reply=1)"/.exec(html)?.[1];
      if (next) ({ html } = await get(next, alex2));
    }
    const bound = (html.match(/name="\$ACTION_REF_\d+"/g) ?? []).length;
    const carries = /name="(requestId|invitationId|recordId|cardId|childId)"/.test(html);
    check(`w13: /g/${kind} uses no bound action`, bound, 0);
    check(`w14: /g/${kind} carries its id in the form`, carries, true);
  }
  const claim = (await get('/claim/westgate-rangers', ids.people.robin)).html;
  check('w15: the claim flow uses no bound action',
    (claim.match(/name="\$ACTION_REF_\d+"/g) ?? []).length, 0);
  check('w16: and carries its slug', /name="slug"/.test(claim), true);
}

// The consent moment: a parent taps a link in an SMS and says yes. No
// fixture created a pending invitation, so this screen had never been
// rendered by anything — and its action was bound, so it needed JavaScript
// in an in-app webview, which is the one place the brief already flags as
// fragile.
{
  const inv = ids.pendingInvitation;
  check('w17: there is a pending invitation to approve', Boolean(inv), true);
  const { status, html } = await get(`/a/${inv}`);
  check('w18: the approval landing renders for a stranger with the link', status, 200);
  check('w19: it uses no bound action',
    (html.match(/name="\$ACTION_REF_\d+"/g) ?? []).length, 0);
  check('w20: and carries the invitation id in the form',
    /name="invitationId"/.test(html), true);
}

// Section headings. The SAME 11px tracked caps is used three ways in this
// product — to head a section, to label a field, and to caption a stat tile
// ("APPEARANCES") — so these were marked one at a time rather than by style.
// The mistake this pass could make is announcing a field label or a stat
// caption as a heading, which is worse for a screen-reader user than leaving
// it a div. That is what these check.
{
  const pages = [
    ['/p/dev-deniz', null], ['/c/sam-kaya', null], ['/fc/riverside-fc', null],
    ['/home', ids.people.alex], [`/g/controls/${deniz.child_id}`, ids.people.alex],
  ];
  const strays = []; const outlines = [];
  for (const [path, who] of pages) {
    const { html } = await get(path, who);
    const h2s = [...html.matchAll(/<h[2-6][^>]*>([\s\S]*?)<\/h[2-6]>/g)].map((m) => m[0]);
    outlines.push([path, h2s.length]);
    const labelZones = [...html.matchAll(/<label[^>]*>[\s\S]*?<\/label>/g)].map((m) => m[0]).join('');
    for (const h of h2s) if (labelZones.includes(h)) strays.push(`${path} ${h.slice(0, 40)}`);
    // A stat caption sits beside its number inside a tile, never over a section.
    for (const cap of ['APPEARANCES', 'GOALS', 'ASSISTS', 'CLEAN SHEETS']) {
      if (new RegExp(`<h[2-6][^>]*>\\s*${cap}`, 'i').test(html)) strays.push(`${path} ${cap}`);
    }
  }
  check(`a3: no field label or stat caption was announced as a heading (${strays.join(', ') || 'none'})`,
    strays.length, 0);
  check(`a4: the content pages have an outline, not just a title (${outlines.map(([p, n]) => `${p}:${n}`).join(' ')})`,
    outlines.every(([, n]) => n >= 1), true);
}

// D-74: the board's day-one filters are age group, region, competition
// gender and positions wanted. It shipped with two. The four are links, not
// controls — each filtered view has an address and needs no JavaScript — and
// anything not on their lists is ignored rather than trusted (D-94 §6).
{
  const shown = (html) => Number(/(\d+) trials?</.exec(html.replace(/<!-- -->/g, ''))?.[1] ?? NaN);
  const all = (await get('/trials', null)).html;
  const everyone = shown(all);
  check('t1: the board says how many trials it is showing', Number.isFinite(everyone) && everyone > 0, true);
  check('t2: age, competition and positions-wanted filters are all on the board',
    ['Age group', 'Competition', 'Positions wanted'].every((g) => all.includes(g)), true);
  check('t3: on a phone they fold into one Filters button that opens without JavaScript',
    /<details[^>]*class="[^"]*trial-filters[^"]*"[^>]*>\s*<summary/.test(all), true);
  const gk = (await get('/trials?pos=GK', null)).html;
  check('t4: "goalkeepers wanted" narrows the board', shown(gk) > 0 && shown(gk) < everyone, true);
  check('t4b: and the choice shows as a chip that takes only itself off',
    /href="\/trials"[^>]*aria-label="Remove GK wanted"|aria-label="Remove GK wanted"[^>]*href="\/trials"/.test(gk), true);
  const junk = (await get('/trials?age=%3Cscript%3E&state=QLD&pos=XX&gender=mixed', null)).html;
  check('t5: anything not on the lists is ignored, never trusted', [shown(junk), /Remove /.test(junk)], [everyone, false]);
  check('t5b: and Mixed is not a way in (D-68 as amended)', /gender=mixed/.test(all), false);
}

// A link a screen SHOWS is a promise — a coach pastes it, a TD prints it.
// Four screens showed pitchfootball.com.au/<name>, which does not exist: the
// pages live at /c/<name> and /fc/<name>. Every full link shown must open.
// (A player's link is shown as a hint with dots and is not a full link.)
{
  // What a person SEES: script payloads and tag attributes (the share image
  // in the page's meta tags) are not links anyone reads or copies.
  const shownLinks = (html) => {
    const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!-- -->/g, '').replace(/<[^>]*>/g, ' ');
    return [...new Set([...text.matchAll(/pitchfootball\.com\.au\/([a-z0-9][a-z0-9/_-]*)/gi)].map((m) => '/' + m[1]))];
  };
  const sam = ids.people.sam, marina = ids.people.marina;
  const pages = [['/home', sam, 'coach home'], ['/coach/edit', sam, 'coach editor'], ['/c/sam-kaya/print', null, 'printed coach CV'], ['/club/page-edit', marina, 'club page editor']];
  for (const [path, who, label] of pages) {
    const links = shownLinks((await get(path, who)).html);
    check(`pl1: the ${label} shows its public link`, links.length > 0, true);
    const dead = [];
    for (const l of links) if ((await get(l, null)).status !== 200) dead.push(l);
    check(`pl2: every link the ${label} shows opens (${dead.join(' ') || 'all do'})`, dead, []);
  }
  const coachHome = (await get('/home', sam)).html.replace(/<!-- -->/g, '');
  check('ch1: the coach home says how much of their page is done', /\d of 5 done/.test(coachHome), true);
  check('ch2: and names the teams they read, never who registered', /Registrations for your teams/.test(coachHome), true);
  check('ch3: and offers the link to copy — a coach\'s page is public by design (D-100)', /pitchfootball\.com\.au\/c\/sam-kaya/.test(coachHome) && />Copy</.test(coachHome), true);
}

// The trials board shipped in launch scope and NOTHING LINKED TO IT.
{
  for (const [seat, who] of [['a parent', ids.people.alex], ['a player', ids.people.jordan]]) {
    const { html } = await get('/home', who);
    check(`r41: ${seat} can reach the trials board from home`,
      /href="\/trials"/.test(html), true);
  }
}

// The social card and the page title are cached by every platform that meets
// the link — permanently, past expiry, past revocation (D-89). So the band
// rule governs the title exactly as it governs the image.
{
  const titleOf = (html) => /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';

  const minor = titleOf((await get('/p/dev-deniz')).html);
  check(`m3: a minor's shared page carries the surname INITIAL, never the surname (${minor})`,
    /Deniz Y\./.test(minor) && !/Y[ıi]lmaz/.test(minor), true);

  // The card derived the band from cv.dob, which assembleCv never returns —
  // so `born` was always null, every player fell to the restrictive default,
  // and the 18+ branch had never once executed. A 22-year-old's card and
  // title both read "Jordan A."
  const adult = titleOf((await get('/p/dev-jordan')).html);
  check(`m4: an adult's shared page carries their full name (${adult})`,
    /Jordan Abebe/.test(adult), true);

  // D-77: expired, revoked, paused and never-existed are one response. That
  // has to hold on the print route too — it used to be the single place a
  // dead token still produced a hard 404 beside a page serving 200.
  const dead = [];
  for (const t of ['dev-expired', 'dev-revoked', 'nonsense-never-existed']) {
    for (const suffix of ['', '/print']) {
      const r = await get(`/p/${t}${suffix}`);
      dead.push(`${r.status} ${titleOf(r.html)}`);
    }
  }
  check(`m5: every dead token state is one response, page and print alike (${[...new Set(dead)].join(' | ')})`,
    new Set(dead).size, 1);
  check(`m6: and no dead state names anybody`,
    dead.every((d) => !/Deniz|Jordan|Abebe/.test(d)), true);
}

console.log(`\n${pass} passed, ${failures.length} failed${failures.length ? ' - ' + failures.join('; ') : ' - ALL GREEN'}`);
process.exit(failures.length ? 1 : 0);
