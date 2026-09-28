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

// The dev session cookie is a signed session token (lib/session.ts). Minting
// one here is how a test BECOMES a seat; there is no other way in without
// driving a browser.
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
const cookieFor = (personId) => {
  const t = sessionToken(personId);
  return `pitch_session=${t}.${createHmac('sha256', process.env.SESSION_SECRET || 'dev-only-secret-not-for-production').update(t).digest('base64url')}`;
};

async function get(path, personId) {
  const res = await fetch(BASE + path, {
    redirect: 'manual',
    headers: personId ? { cookie: cookieFor(personId) } : {},
  });
  return { status: res.status, location: res.headers.get('location'), csp: res.headers.get('content-security-policy'), html: await res.text() };
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
    order(html, 'Riverside FC', 'Elderslie Juniors SC'), true);
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
// D-62 / D-105 — where the words on a number come from.
//
// The tag was the literal "Self-reported", printed whatever the row said.
// Every stat the product can write today IS self-reported (lib/cv-build is the
// only writer), so what these pages SERVE is unchanged — which is the point:
// the change is honest about where the word comes from, not about what it
// says. The coach-verified and mixed renders cannot be reached from any suite,
// because nothing in the product writes a coach_verified stat and this suite
// cannot open the database (PGlite serves one connection and next-server holds
// it); they are pinned as rules in the permission suite and were rendered by
// hand on 28 Sep — see the handoff.
// ---------------------------------------------------------------------------
{
  const { html } = await get('/p/dev-nate');
  check('pv-r1: a keeper\u2019s CV serves clean sheets with its source beside it',
    [has(html, 'Clean sheets'), has(html, 'Self-reported')], [true, true]);
  const nate = ids.children.nate;
  const form = (await get(`/build/${nate.record_id}`, nate.child_id)).html;
  const chosen = (label) => new RegExp(`<button[^>]*aria-pressed="true"[^>]*>${label}</button>`).test(form);
  check('pv-r2: and his build form opens with the keeper\u2019s set chosen, never goals and assists (D-105)',
    [chosen('Appearances'), chosen('Clean sheets'), chosen('Goals'), chosen('Assists')],
    [true, true, false, false]);
}

// ---------------------------------------------------------------------------
// A19 / D-161 - no school on an under-18's public page, whoever is reading.
//
// Deniz and Georgia each carry a school entry written the only way one can now
// be written: with the trigger off, in the seed. That is the state a real
// database is in - the row is there, nothing deleted it, and no page shows it.
// Deniz's page is the guardian-approved SNAPSHOT (D-119), taken before the
// rule; the preview of the same record is the LIVE assembly. Both are checked,
// because they are two different queries and only one of them can be filtered
// in SQL after the fact.
// ---------------------------------------------------------------------------
{
  const SCHOOLS = ['Marlowe High 1st XI', 'Westhaven Senior College', 'School 1st XI'];
  const minorPages = [
    ['A19: the u16 public CV (approved snapshot)', '/p/dev-deniz', null],
    ['A19: the u16 print view', '/p/dev-deniz/print', null],
    ['A19: the sparse u16 CV', '/p/dev-georgia', null],
    // The 16-17 page is the LIVE assembly, not a snapshot — a different query
    // with its own filter, and the only band that exercises it under 18.
    ['A19: the 16-17 public CV (live assembly)', '/p/dev-nate', null],
    ['A19: the 16-17 print view', '/p/dev-nate/print', null],
    ['A19: the family\'s own preview of what a club sees', `/build/${deniz.record_id}/preview`, alex],
    // The fixture preview reaches no database at all — it hands PlayerCV a
    // fixture, and the fixture carries no band, which the component treats as
    // a minor (the restrictive default). It is also the page BUZ opens.
    ['A19: the fixture preview of the CV design', '/cv-preview/deniz', null],
    ['A19: the sparse fixture preview', '/cv-preview/georgia', null],
  ];
  for (const [what, path, who] of minorPages) {
    const { html } = await get(path, who);
    const found = SCHOOLS.filter((org) => has(html, org));
    check(`${what} names no school (${found.join(', ') || 'none'})`, found, []);
    // The KIND as well as the organisation: "school" in the chip above the
    // name is the disclosure D-114 removed, without the name attached.
    check(`${what} carries no school chip`,
      text(html).some((l) => l.toLowerCase() === 'school'), false);
  }
  // The other half of the same rule: an adult keeps it, so this cannot pass by
  // the block having been deleted.
  for (const path of ['/p/dev-jordan', '/p/dev-jordan/print', '/preview/site']) {
    const { html } = await get(path);
    check(`A19: ${path} still names the adult's university side`,
      has(html, 'Riverside University 1st XI'), true);
  }
  check('A19: and the minors\' other football is otherwise untouched',
    has((await get('/p/dev-deniz')).html, 'Melbourne Futsal U15'), true);
}

// The chip is not offered - the other half of the same rule, and the half a
// family actually meets. The LIST is deliberately untouched: an entry written
// before the rule is their own words, it renders nowhere public any more, and
// Remove stays theirs to press. Nothing here deletes a row and no page says
// anything about it (what a family is told is BUZ's call, D-161).
{
  // The attribute in between is React's: the first chip carries defaultChecked,
  // which renders as checked="" between name and value. A regex without it
  // could not have passed on the adult's page, whatever the code did.
  const offersSchool = (html) => /name="kind"[^>]*value="school"/.test(html);
  const { html } = await get(`/build/${deniz.record_id}/more`, alex);
  check('A19: the u16 football-history editor offers no School chip',
    offersSchool(html), false);
  check('A19: and still lists what the family already wrote, with Remove beside it',
    has(html, 'Marlowe High 1st XI') && has(html, 'Remove'), true);

  // The adult's own editor, reached the way he reaches it. Jordan's record id
  // is not in .dev-ids.json, so it comes off his own home page.
  const home = await get('/home', ids.people.jordan);
  const jordanRecord = /\/build\/([0-9a-f-]{36})/.exec(home.html)?.[1] ?? 'none';
  const adult = await get(`/build/${jordanRecord}/more`, ids.people.jordan);
  check('A19: an adult is still offered School', offersSchool(adult.html), true);
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
    if (seat === 'operator') queue.push('/ops/verification', '/ops/support', '/ops/switches');
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

      // /signout is followed by nobody here. It used to be harmless — it
      // deleted a cookie this walk does not keep — but signing out now
      // REVOKES the session (0062), so following it once would end the seat
      // and report every page after it as signed out. The layout check and
      // the capture tool have always excluded it for the same reason in
      // spirit. Pressing it is the write suite's job (sess-w1..w3).
      const links = [...new Set([...r.html.matchAll(/href="(\/[^"#][^"]*)"/g)].map((m) => m[1])
        .filter((h) => !h.startsWith('/_next') && !h.startsWith('/assets') && !/\.(png|svg|jpg|ico|xml|txt|webmanifest)$/.test(h)
          && h !== '/signout'))];
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
    .filter((h) => !h.startsWith('/_next') && !h.startsWith('/assets') && !/\.(png|svg|ico|webmanifest)$/.test(h)))];
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
  for (const path of ['/ops/verification', '/ops/support', '/ops/switches']) {
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
  // Every door except Sign out, which is now a state change rather than a
  // read: following it revokes the session (0062), and this account is the
  // ONLY one in the product whose home screen offers it — so opening it here
  // signed this seat out and w16 went red four hundred lines later, which is
  // the dangerous direction (L34: the answer was "the product is broken").
  // That door is pressed, and its answer checked, in the write suite
  // (sess-w1..w3), which is where pressing buttons belongs.
  const doors = links.filter((h) => h !== '/signout');
  check('r43: and every door it offers is one that exists',
    (await Promise.all(doors.map(async (h) => (await get(h, ids.people.robin)).status)))
      .every((st) => st === 200 || st === 307), true);
  check('r43b: Sign out is one of them, and it is only on this screen',
    links.includes('/signout'), true);
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

  // w12 · AND THE REGISTER IS PUT BACK.
  //
  // QA, 28 Sep: this suite is documented as read-only (TRAINING §4 names only
  // the write suite as mutating, and write-tests.mjs says "the render suite
  // walks by following links, so it only ever GETs"). w10 shortlists a real
  // registrant and left it that way, so every count, capture and screenshot
  // taken after a render run was measured on a moved register. Reproduced on
  // this tree: the New/Shortlisted totals went 82/12 before the suite to
  // 81/13 after it, which is exactly why the register's NEW count was read as
  // 78, 79 and 81 in captures hours apart and read as a product bug.
  //
  // The counts on the summary tiles are the thing people quote, so they are
  // the thing this asserts. Nothing here weakens w10 — the move still happens
  // and is still checked; it is undone afterwards through the product's own
  // action, which is also the first thing that proves a status can go back.
  const tiles = (html) =>
    [...html.matchAll(/numeral numeral-m" style="color:var\(--(accent|amber|purple)\)">(\d+)/g)]
      .map((m) => Number(m[2]));
  const back = new FormData();
  back.append('registrationId', f.registrationId);
  back.append('status', 'new');
  for (const [k, v] of Object.entries(f)) if (!['registrationId', 'status'].includes(k)) back.append(k, v);
  const undone = await fetch(BASE + '/club/register', { method: 'POST', body: back, redirect: 'manual', headers: { cookie: cookieFor(marina) } });
  check('w12a: a shortlisted registration can be moved back to new', undone.status, 303);
  const restored = (await get('/club/register', marina)).html;
  // The tile count is asserted too. Without it this reads a rendered page for
  // three numbers and compares [] to [] the day that markup moves — green,
  // and blind, which is the failure L19 is named after. It has already moved
  // once (58c52ae put the register in a table at 768px).
  check('w12b: and this suite leaves the register exactly as it found it',
    [tiles(before).length, tiles(restored)], [3, tiles(before)]);
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
  // D-156: reached by the invitation id there is no channel, so no button.
  check('w20: by the invitation id it offers no button at all', /<form/.test(html), false);
  const text = await get('/a/dev-mila-text');
  check('w20b: the texted link renders, with one control: "Yes, it\'s me"',
    text.status === 200 && /name="code"/.test(text.html) && /Yes, it/.test(text.html) && !/Approve this page/.test(text.html), true);
  check('w20c: and uses no bound action', (text.html.match(/name="\$ACTION_REF_\d+"/g) ?? []).length, 0);
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
  check('ch1: the coach home says how much of their page is done', /\d of 6 done/.test(coachHome), true);
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

// 0042: a public contact belongs to an adult. The coach editor does not offer
// the field to a 16-17 at all; an adult coach still sees it.
{
  const teen = await get('/coach/edit', ids.children.nate.child_id);
  check('ca1: a 16-17 opening the coach editor is not offered a public contact',
    teen.status === 200 && !/name="publicContact"/.test(teen.html), true);
  const adult = await get('/coach/edit', ids.people.sam);
  check('ca2: an adult coach is', /name="publicContact"/.test(adult.html), true);
  check('ca3: a published coach can copy the link or take the page down',
    /Copy the link/.test(adult.html) && /Take my page down/.test(adult.html), true);
  check('ca4: a 16-17 is told the page can go public at 18, and offered no publish',
    /once you turn 18/.test(teen.html.replace(/&rsquo;/g, "'")) && !/Publish my page/.test(teen.html), true);
}

// D-94 §8: a real Content-Security-Policy, no inline script. Scripts carry
// this request's nonce, and the nonce changes every request.
{
  const one = await get('/signin'), two = await get('/signin');
  const scriptSrc = (one.csp ?? '').split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src')) ?? '';
  const nonce = /'nonce-([^']+)'/.exec(scriptSrc)?.[1];
  check('csp1: every page is sent with a Content-Security-Policy', Boolean(one.csp), true);
  check('csp2: scripts run only with a nonce, never unsafe-inline', Boolean(nonce) && !/unsafe-inline/.test(scriptSrc), true);
  check('csp3: the nonce is fresh each request', nonce !== /'nonce-([^']+)'/.exec(two.csp ?? '')?.[1], true);
  const scripts = [...one.html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
  check(`csp4: every script tag on the page carries it (${scripts.length} scripts)`,
    scripts.length > 0 && scripts.every((t) => t.includes(`nonce="${nonce}"`)), true);
  check('csp5: nobody may frame a page', /frame-ancestors 'none'/.test(one.csp ?? ''), true);
  const p = await get('/p/dev-jordan');
  check('csp6: the shared CV page has it too', Boolean(p.csp), true);
}

// Installable (D-52): a manifest Android can install from, and the iOS
// home-screen tags. And the in-app browser note shows only inside an app.
{
  const m = await fetch(BASE + '/manifest.webmanifest');
  const man = m.ok ? await m.json() : {};
  check('pwa1: the manifest is served', m.headers.get('content-type')?.includes('manifest+json'), true);
  check('pwa2: it names the app and opens standalone at /home',
    [man.short_name, man.display, man.start_url], ['Pitch', 'standalone', '/home']);
  const sizes = (man.icons ?? []).map((i) => `${i.sizes}:${i.purpose}`);
  check('pwa3: with 192 and 512 icons, and a maskable one', ['192x192:any', '512x512:any', '512x512:maskable'].every((x) => sizes.includes(x)), true);
  const icons = [];
  for (const i of man.icons ?? []) icons.push((await fetch(BASE + i.src)).headers.get('content-type'));
  check('pwa4: every icon it names exists', icons.length > 0 && icons.every((t) => t === 'image/png'), true);
  const { html } = await get('/signin');
  check('pwa5: iOS gets its home-screen tags and a square icon',
    /apple-mobile-web-app-title" content="Pitch"/.test(html) && /rel="apple-touch-icon" href="\/assets\/brand\/apple-touch-icon\.png"/.test(html) && /viewport-fit=cover/.test(html), true);
  check('pwa6: every page links the manifest', /rel="manifest"/.test(html), true);

  const ig = await (await fetch(BASE + '/signin', { headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.0;]' } })).text();
  check('iab-r1: inside Facebook, sign-in says so and offers Chrome', /data-in-app="Facebook"/.test(ig) && /intent:\/\/[^"]*package=com\.android\.chrome/.test(ig), true);
  check('iab-r2: in an ordinary browser there is no note', /data-in-app=/.test(html), false);
}

// doc 34 rule 6 (0047): the family sees who read a registration.
{
  await get('/club/register', ids.people.marina);   // Marina reads the list: that read is logged
  const nate = ids.children.nate;
  const parent = text((await get(`/g/controls/${nate.child_id}`, ids.people.alex)).html).join(' ');
  check('rr-r1: the parent\'s controls say who has read the registration', /Who has read Nate.s registrations/i.test(parent), true);
  check('rr-r2: naming the technical director, and what they did', /Marina/.test(parent) && /Technical director/.test(parent) && /Saw it in the list/.test(parent), true);
  const own = text((await get('/home', nate.child_id)).html).join(' ');
  check('rr-r3: the 16-17 sees it on their own home', /Who has read your registrations/i.test(own) && /Marina/.test(own), true);
  const kid = text((await get(`/g/controls/${ids.children.deniz.child_id}`, ids.people.marina)).html).join(' ');
  check('rr-r4: a club director cannot open a family\'s controls to read it', /Who has read/.test(kid), false);
}

// Doc 32 B3/B4/B5: the child's policy inside approval; the legal person and a
// report route on every page; no secret ever in a footer link.
{
  const approval = (await get('/a/dev-mila-text')).html.replace(/<!-- -->/g, '');
  check('g32-r1: the approval page shows the child privacy policy in the flow (B3)',
    /The privacy policy we wrote for Mila/.test(approval) && /class="legal-doc"/.test(approval), true);
  check('g32-r2: and /privacy/family serves it', (await get('/privacy/family')).status, 200);
  for (const path of ['/signin', '/trials', '/p/dev-jordan', `/g/controls/${ids.children.nate.child_id}`]) {
    const who = path.startsWith('/g/') ? ids.people.alex : null;
    const html = (await get(path, who)).html;
    const foot = /<footer class="site-foot">([\s\S]*?)<\/footer>/.exec(html)?.[1] ?? '';
    check(`g32-r3: ${path.replace(/[0-9a-f-]{36}/, '*')} names the legal person and links a report (B4, B5)`,
      /EBSD Enterprises Pty Ltd/.test(foot) && /ABN 65 701 879 718/.test(foot) && /href="\/report/.test(foot), true);
    check(`g32-r4: ${path.replace(/[0-9a-f-]{36}/, '*')} footer carries no secret`, /dev-|[0-9a-f]{36}/.test(foot), false);
  }
  check('g32-r5: nothing calls itself "Pitch Football Pty Ltd"', /Pitch Football Pty Ltd/i.test((await get('/signin')).html), false);
}

// "Preview my page" (BUZ, 19 Sep): the family sees the page exactly as a club
// does — and only the family. An under-16 previews the APPROVED version, never
// the pending edit no club can see (D-119).
{
  const jordanHome = (await get('/home', ids.people.jordan)).html;
  const jordanPreview = /href="(\/build\/[0-9a-f-]{36}\/preview)"/.exec(jordanHome)?.[1];
  check('pv1: the player home offers "Preview my page"', Boolean(jordanPreview) && has(jordanHome, 'Preview my page'), true);
  const mine = await get(jordanPreview, ids.people.jordan);
  check('pv2: the player sees their own page, marked as a preview',
    [mine.status, has(mine.html, 'This is exactly what a club sees when you send your page.'), has(mine.html, 'Abebe')], [200, true, true]);
  check('pv3: it is never indexed', /<meta name="robots" content="noindex, nofollow"/.test(mine.html), true);

  const kid = await get(`/build/${deniz.record_id}/preview`, alex);
  check('pv4: a parent previews their under-16\'s APPROVED page, not the pending edit',
    [kid.status, has(kid.html, 'working on pressing triggers'), has(kid.html, 'weak-foot finishing every Thursday')], [200, true, false]);
  check('pv5: and is told the edit is waiting for them, with the way to review it',
    has(kid.html, 'latest changes are waiting for you') && kid.html.includes(`/g/pending/${deniz.record_id}`), true);
  check('pv6: the parent\'s page for the child links the preview',
    (await get(`/g/controls/${deniz.child_id}`, alex)).html.includes(`/build/${deniz.record_id}/preview`), true);

  for (const [who, id] of [['a coach', ids.people.sam], ['the club TD', ids.people.marina], ['another adult', ids.people.jordan]]) {
    const r = await get(`/build/${deniz.record_id}/preview`, id);
    check(`pv7: ${who} opening a child's preview goes home, learning nothing`, [r.status, r.location], [307, '/home']);
  }
  const anon = await get(`/build/${deniz.record_id}/preview`);
  check('pv8: signed out, the preview asks you to sign in', [anon.status, anon.location], [307, '/signin']);
}

// ---------------------------------------------------------------------------
// QA, 28 Sept · NO TWO CLUBS SHARE A NAME ON THE PARENT'S CLUB PICKER.
//
// /squad/[personId] is where a parent hands their child's name to a club. It
// lists every verified club, name over suburb. On 28 Sept the seed made TWO
// different clubs called "Kingsway Rovers FC" — they sat one above the other
// with nothing but a suburb between them, and Georgia's CV named a club that
// was not the one /fc/kingsway-rovers served.
//
// FIXED AT THE SOURCE on app (96419d4): every organisation in lib/fixtures.ts
// is invented now, Georgia plays for Saltmarsh Rovers FC, and that file
// carries a stricter rule than this check — an invented club is never named
// after a real suburb, because that is how real clubs are named and nobody
// can verify a community club does not exist.
//
// This check names no club. It asserts the property the picker has to keep:
// two rows a parent cannot tell apart are a row they can pick wrong.
{
  const alex = ids.people.alex, g = ids.children.georgia;
  const page = await get(`/squad/${g.child_id}?back=controls`, alex);
  // Each club row is an anchor to ?club=<id>; the name is the first bold line
  // inside it. Read the rows, not the styling: this is a rendered page and a
  // rendered page is a test fixture (L32).
  const rows = [...page.html.matchAll(/<a[^>]*href="\/squad\/[^"]*\?club=[^"]*"[\s\S]*?<\/a>/g)].map((m) => m[0]);
  const listed = rows.map((r) => (/>([^<>]{2,60})</.exec(r.replace(/<span[^>]*>\s*</g, '<')) ?? [])[1])
    .filter(Boolean).map((n) => n.trim());
  const dupes = [...new Set(listed.filter((n, i) => listed.indexOf(n) !== i))];
  check('clubs1: the club picker rendered for the parent, with clubs on it',
    [page.status, listed.length > 1], [200, true]);
  check(`clubs2: no two clubs on it share a name (${dupes.join(' · ') || 'none do'})`, dupes.length, 0);
}

// ---------------------------------------------------------------------------
// /club/billing — the screen attached to the money, set as a console surface
// (D-147), with the price as the display numeral it is (D-140) and the one
// fact on it that is genuinely ours: who at this club can read the register
// (D-93, doc 14 N23). 0063.
// ---------------------------------------------------------------------------
{
  const marina = ids.people.marina, pat = ids.people.pat, dana = ids.people.dana, felix = ids.people.felix;
  const b = await get('/club/billing', marina);
  check('b1: the price is a display numeral, not body text', /class="numeral numeral-l"/.test(b.html) && has(b.html, '$54'), true);
  check('b1b: with its own caption under it rather than three pixels from it', has(b.html, 'a month, including GST'), true);
  check('b2: the next charge date sits beside it at the same rank',
    has(b.html, 'Next charge') && /class="numeral numeral-m"/.test(b.html) && has(b.html, 'unless you cancel before then'), true);
  check('b3: it is a console surface, not a 604px reading column (D-147)',
    /class="console"/.test(b.html) && !/class="reading"/.test(b.html), true);
  check('b4: the statement descriptor and the state of the subscription are both on it',
    has(b.html, 'On your statement') && has(b.html, 'PITCH FOOTBALL') && has(b.html, 'Your subscription') && has(b.html, 'Active'), true);
  check('b5: D-126’s sentence is on the page whichever plan the club is on',
    has(b.html, 'Paying does not verify your club and cannot.'), true);
  // The block that is the reason this page is worth opening.
  check('b6: the page names who reads the register, computed from memberships',
    has(b.html, 'Who reads it') && has(b.html, 'Marina Petrovic') && has(b.html, 'Technical Director · the whole register'), true);
  check('b6b: a granted coach carries the team names, never the whole register',
    has(b.html, 'Sam Kaya') && has(b.html, 'Coach · U14 Boys · U15 Girls'), true);
  check('b6c: and the administrator is on it reading nothing (D-93)',
    has(b.html, 'Pat Nguyen') && has(b.html, 'Club administrator — reads no registration'), true);
  check('b6d: with no lecture attached — one sentence, and it is the one the family already reads',
    has(b.html, 'Only people a club has named can read its register, and every time they do, it’s recorded.'), true);
  check('b7: the dunning words are a standing answer, not a banner nobody meets until it is too late',
    has(b.html, 'If a payment fails') && has(b.html, 'Nothing is deleted.'), true);
  // D-25: three facts we do not hold, and the page must not imply we do.
  check('b8: nothing on the page claims to know the card (D-25, D-112)',
    /last four|••••|Visa|Mastercard|ending in|Receipts go to/i.test(b.html), false);

  const pb = await get('/club/billing', pat);
  check('b9: the invoicing volunteer reads billing (O11)', pb.status, 200);
  check('b9b: and is shown the same list of readers the TD is — including her own row, reading nothing',
    [has(pb.html, 'Pat Nguyen'), has(pb.html, 'Marina Petrovic'), has(pb.html, 'Sam Kaya'),
     has(pb.html, 'Club administrator — reads no registration')], [true, true, true, true]);

  const db_ = await get('/club/billing', dana);
  check('b10: a club with no subscription still gets the checkout, with the D-137 tick',
    has(db_.html, 'Choose how you pay') && /name="authorised"/.test(db_.html), true);
  check('b10b: and no plan card claiming a price it is not paying', has(db_.html, 'On your statement'), false);

  // The suspended club. Before 0063 this page offered "Choose how you pay" to
  // a club that already had a subscription, and never the one control that
  // replaces a declined card.
  const fb = await get('/club/billing', felix);
  check('b11: a club whose payment failed is told so, in the present tense',
    has(fb.html, 'We couldn’t take your payment') && has(fb.html, 'The register is paused — your coaches stop seeing the list.'), true);
  check('b11b: and D-135’s promise is on the same card', has(fb.html, 'Nothing is deleted.'), true);
  check('b11c: it is sent to the portal, where a declined card is replaced — not to a second checkout',
    [has(fb.html, 'Manage or cancel this subscription'), has(fb.html, 'Choose how you pay')], [true, false]);
  check('b11d: with no next-charge date, because there is no honest one to print',
    has(fb.html, 'Next charge'), false);
  check('b11e: and the state said plainly beside the descriptor', has(fb.html, 'Paused'), true);

  // O4 on the screen it costs something on. A suspended club used to drop
  // silently to the free tier's own heading with nothing about payment on it.
  const fr = await get('/club/register', felix);
  check('b12: a suspended club’s REGISTER says why the list is gone (O4, D-135)',
    has(fr.html, 'We couldn’t take your payment'), true);
  check('b12b: above the free tier’s heading, not below it',
    order(fr.html, 'We couldn’t take your payment', 'Interest in your trials'), true);
  check('b12c: with the way to sort it out', fr.html.includes('/club/billing'), true);
  check('b12d: and the list itself is still hidden, not deleted',
    has(fr.html, 'The families who registered stay registered'), true);
  const dr = await get('/club/register', dana);
  check('b13: a club that never subscribed is told nothing about a failed payment',
    has(dr.html, 'We couldn’t take your payment'), false);
  check('b13b: its free-tier copy is untouched', has(dr.html, 'Interest in your trials'), true);

  // O1 — no family seat can reach any of it.
  for (const [who, id] of [['a parent', ids.people.alex], ['an adult player', ids.people.jordan], ['a 16–17', ids.children.nate.child_id]]) {
    const r = await get('/club/billing', id);
    check(`b14: ${who} is sent home from the billing page (O1)`, [r.status, r.location], [307, '/home']);
  }
}

// ---------------------------------------------------------------------------
// /home — the return (0064). Rendered on arrival when the last session was
// sixty days or more ago, never sent, and nothing at all for an under-16.
// ---------------------------------------------------------------------------
{
  const block = (t) => {
    const i = t.findIndex((l) => /^While you were away$/.test(l));
    if (i < 0) return null;
    const j = t.findIndex((l, k) => k > i && /^(Link active|Links active|Your page|Your page is live)$/.test(l));
    return t.slice(i, j < 0 ? i + 12 : j);
  };
  const parent = text((await get('/home', alex)).html);
  const pb = block(parent);
  check('ret-r1: a parent eighty days away is told what happened, before being asked for anything',
    pb !== null, true);
  check('ret-r1b: above the queue of things waiting on them',
    order((await get('/home', alex)).html, 'While you were away', 'Waiting on you'), true);
  // The SHAPE, not the people: this suite loads club registers and opens CVs
  // as it goes, so whichever read is newest when this runs is whichever page
  // ran last. The property is that the line is a named person, their role at a
  // named club, and what they did (LESSONS L32).
  const READ_LINE = /^.+, (Technical director|Coach|Club administrator|Club staff) at .+, (opened .+\u2019s CV|opened your CV|saw .+ on their register|saw you on their register)\.$/;
  check(`ret-r2: the read line names the reader, their role at the club, and what they did (${(pb ?? []).find((l) => READ_LINE.test(l)) ?? 'no read line'})`,
    (pb ?? []).some((l) => READ_LINE.test(l)), true);
  check('ret-r3: the link line states the date and the consequence, and asks for nothing',
    (pb ?? []).some((l) => /link expires\./.test(l))
      && (pb ?? []).some((l) => /Clubs holding it stop being able to open the page that day\./.test(l)), true);
  check('ret-r4: the trials line is the notice we hold, with the day a human last checked it',
    (pb ?? []).some((l) => /The next trial we hold a notice for\./.test(l))
      && (pb ?? []).some((l) => /^Last checked \d{1,2} [A-Z][a-z]{2}\.$/.test(l)), true);
  check('ret-r5: every line is dated', (pb ?? []).filter((l) => /^\d{1,2} [A-Z][a-z]{2}$/.test(l)).length >= 3, true);
  // What it is not. Each of these was proposed in the 24 Sep review and killed
  // in the same review.
  const words = (pb ?? []).join(' ');
  check(`ret-r6: no verb aimed at the reader (${/\b(update|renew|complete|check|add|finish|don’t forget)\b/i.exec(words)?.[0] ?? 'none'})`,
    /\b(update|renew|complete|check your|add|finish|don’t forget)\b/i.test(words), false);
  check('ret-r7: no count, no score, no streak',
    /\b(\d+ times|\d+ views|\d+ reads|streak|in a row)\b/i.test(words), false);
  check('ret-r8: and no button in the block at all',
    /While you were away[\s\S]{0,900}?<(a|button)\b/.test((await get('/home', alex)).html), false);

  const sixteen = block(text((await get('/home', ids.children.nate.child_id)).html));
  check('ret-r9: a 16–17 gets it on their own home, about themselves', sixteen !== null, true);
  check('ret-r9b: in the second person, never their own name read back at them',
    (sixteen ?? []).some((l) => /Your link expires\./.test(l)) && !(sixteen ?? []).some((l) => /Nate’s/.test(l)), true);
  check('ret-r9c: and the read line says "you", from the ledger doc 34 rule 6 already gives them',
    (sixteen ?? []).some((l) => /(opened your CV|saw you on their register)\.$/.test(l)), true);

  // The under-16. fn_note_arrival records nothing for them and fn_return_facts
  // answers nothing, so there is no block on a fourteen-year-old's home — and
  // doc 34 rule 6, which is what makes the best line unavailable to them, is
  // untouched by any of this.
  check('ret-r10: a fourteen-year-old gets no block at all (D-25, doc 34 rule 6)',
    block(text((await get('/home', ids.children.deniz.child_id)).html)), null);

  for (const [who, id] of [['a club TD', ids.people.marina], ['a coach', ids.people.sam], ['an adult player just here', ids.people.jordan]]) {
    check(`ret-r11: ${who} who was here today gets nothing`,
      block(text((await get('/home', id)).html)), null);
  }
}

// ---------------------------------------------------------------------------
// A club administrator's /home (club-home-admin.html, 23 Sep; BUZ asked for it
// 28 Sep). It was the technical director's screen rendered for somebody with
// none of her access: a hero built around a register row an administrator
// correctly cannot have, and a rail that was the sidebar again as six identical
// grey buttons with no primary action anywhere. Often the first Pitch screen
// anybody at a club opens.
// ---------------------------------------------------------------------------
{
  const pat = ids.people.pat;        // Riverside: verified, paying, crest, philosophy, public page
  const robyn = ids.people.robyn;    // Tarrowvale City FC: verified, payment failed, no crest, no page
  const a = await get('/home', pat);
  const t = text(a.html);

  check('ah1: the hero carries the numbers an administrator IS entitled to',
    has(a.html, 'Squads you run') && has(a.html, 'Trials live') && has(a.html, 'Coaching roles open'), true);
  check('ah1b: and not one of them is a registration or a child',
    /On your register|Shortlisted|Invited|new on the register/.test(a.html), false);
  check('ah2: it says whose the register is, and what is hers',
    has(a.html, 'You keep the club’s page, its squads, its notices and its plan.'), true);
  check('ah3: there is exactly one accent action on the screen',
    (a.html.match(/class="btn btn-primary"/g) ?? []).length, 1);
  check('ah3b: and it is Post a trial notice', has(a.html, 'Post a trial notice'), true);
  // The rail stops being the sidebar. Measured as the thing that was wrong —
  // full-width centred grey menu cards outside the two navs — rather than by
  // counting words, because the phone tab bar legitimately carries the same
  // six labels at the other breakpoint (D-147: same doors at every width).
  const menuCards = (html) => (html.replace(/<nav[\s\S]*?<\/nav>/g, ' ').match(/text-align:center/g) ?? []).length;
  check(`ah4: the administrator's rail is not six grey menu cards (${menuCards(a.html)} left)`, menuCards(a.html), 0);
  check('ah5: the rail holds the club’s public state instead',
    has(a.html, 'Your club page') && has(a.html, 'pitchfootball.com.au/fc/riverside-fc')
      && has(a.html, 'Copy the link') && has(a.html, 'Public and live.'), true);
  check('ah6: and the D-93 wall said out loud to the person it constrains',
    has(a.html, 'Who can do what here')
      && has(a.html, 'Technical Director — the register, and the club’s development record')
      && has(a.html, 'Club administrator — the page, squads, notices, coaching roles and the plan. No registrations.')
      && has(a.html, 'A treasurer who sends the invoices should not be able to read a child’s development notes. That is on purpose.'), true);
  check('ah6b: the granted coach’s row names the teams and when the grant was made, from the database',
    t.some((l) => /^Coach — the registrations for U14 Boys and U15 Girls, since \d{1,2} [A-Z][a-z]{2}$/.test(l)), true);
  check('ah6c: her own row is marked as hers, not by repeating her name', t.includes('You'), true);
  check('ah7: the plan is a fact she may see, and it links to the page that holds it',
    has(a.html, '$54 a month') && has(a.html, 'next charge') && a.html.includes('/club/billing'), true);
  check('ah8: nothing on the screen names a child or counts one',
    /Deniz|Georgia|Nate|waiting|registered interest/i.test(t.join(' ')), false);

  const r = await get('/home', robyn);
  check('ah9: what a family cannot see yet — two things, and it is not a score',
    has(r.html, 'What a family cannot see yet') && has(r.html, 'Your crest')
      && has(r.html, 'How the club plays')
      && has(r.html, 'Two things, not a score. A club page with nothing missing is not a better club.'), true);
  check('ah9b: it is absent for a club with both of them filled in',
    has(a.html, 'What a family cannot see yet'), false);
  check('ah10: an administrator at a club whose payment failed is told so on her home',
    has(r.html, 'We couldn’t take your payment') && has(r.html, 'Nothing is deleted.'), true);
  check('ah10b: and Riverside’s administrator is not', has(a.html, 'We couldn’t take your payment'), false);
  check('ah11: a team manager is on her list reading nothing (doc 34 rule 4)',
    has(r.html, 'Tomas Villa') && has(r.html, 'Team manager — no registrations.'), true);

  const numerals = [...r.html.matchAll(/class="numeral numeral-[lms]"[^>]*>([^<]*)</g)].map((m) => m[1].trim());
  check(`ah12: no count on her screen is the digit zero (D-162) (${numerals.join(',') || 'no numerals at all'})`,
    numerals.filter((n) => n === '0').length, 0);
  check('ah12b: and the hero is omitted rather than drawn with nothing in it',
    has(r.html, 'Squads you run'), false);
  check('ah12c: an empty board says its absence in words, which is the opposite fault',
    has(r.html, 'No trials coming up. Post one and it goes on your club page and the trials board the same minute.'), true);

  const td = await get('/home', ids.people.marina);
  check('ah13: the technical director keeps her register row and her rail',
    [has(td.html, 'On your register'), menuCards(td.html) >= 5], [true, true]);
  check('ah13b: and does not get the administrator’s blocks',
    [has(td.html, 'Who can do what here'), has(td.html, 'What a family cannot see yet')], [false, false]);
}

// D-162 across every count on the two homes and on billing: no rendered
// numeral is a zero, on any seat.
{
  for (const [who, id] of [['a parent', ids.people.alex], ['an adult player', ids.people.jordan],
                           ['a 16–17', ids.children.nate.child_id], ['a coach', ids.people.sam],
                           ['a club TD', ids.people.marina], ['an administrator', ids.people.pat],
                           ['an unverified club', ids.people['m.']]]) {
    const html = (await get('/home', id)).html;
    const zeros = [...html.matchAll(/class="numeral numeral-[lms]"[^>]*>([^<]*)</g)].map((m) => m[1].trim())
      .filter((n) => n === '0');
    check(`z1: /home for ${who} renders no count as the digit zero (D-162)`, zeros.length, 0);
  }
  const bill = (await get('/club/billing', ids.people.marina)).html;
  const zeros = [...bill.matchAll(/class="numeral numeral-[lms]"[^>]*>([^<]*)</g)].map((m) => m[1].trim()).filter((n) => n === '0');
  check('z2: and /club/billing renders no count at all, let alone a zero', zeros.length, 0);
}

console.log(`\n${pass} passed, ${failures.length} failed${failures.length ? ' - ' + failures.join('; ') : ' - ALL GREEN'}`);
process.exit(failures.length ? 1 : 0);
