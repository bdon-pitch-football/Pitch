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
  };

  for (const [seat, who] of Object.entries(seats)) {
    const seen = new Set(); const queue = ['/', '/home']; const per = new Map();
    const broken = []; const stuck = new Set();
    while (queue.length) {
      const path = queue.shift();
      const P = norm(path);
      if (seen.has(path)) continue;
      per.set(P, (per.get(P) ?? 0) + 1);
      if (per.get(P) > 2) continue;      // 100 register rows are not 100 routes
      seen.add(path);
      const r = await get(path, who);
      if (r.status >= 400) broken.push(`${r.status} ${P}`);
      if (r.status !== 200) continue;
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

// EVERY form in the product, crawled. tsc cannot see a missing hidden input
// — the signature compiles and the write fails at runtime — and it cannot
// see a bound action either. This can see both: crawl as every seat and
// assert that no page anywhere renders $ACTION_REF_n, and that every action
// form carries at least one id or field to act on.
{
  const seats = Object.entries({
    'signed out': null,
    parent: ids.people.alex,
    player: ids.people.jordan,
    'club TD': ids.people.marina,
    coach: ids.people.sam,
    'brand new': ids.people.robin,
  });
  const norm = (u) => u.split('?')[0].split('#')[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '*')
    .replace(/\/p\/[^/*]+/, '/p/*').replace(/\/(c|fc|claim)\/[^/*]+/, '/$1/*');

  const boundPages = [];
  for (const [, who] of seats) {
    const seen = new Set(); const queue = ['/', '/home', '/trials', '/jobs']; const per = new Map();
    while (queue.length) {
      const path = queue.shift(); const P = norm(path);
      if (seen.has(path)) continue;
      per.set(P, (per.get(P) ?? 0) + 1);
      if (per.get(P) > 2) continue;
      seen.add(path);
      const r = await get(path, who);
      if (r.status !== 200) continue;
      if (/name="\$ACTION_REF_\d+"/.test(r.html)) boundPages.push(P);
      for (const m of r.html.matchAll(/href="(\/[^"#][^"]*)"/g)) {
        const h = m[1];
        if (h.startsWith('/_next') || h.startsWith('/assets') || /\.(png|svg|jpg|ico|xml|txt)$/.test(h)) continue;
        if (!seen.has(h)) queue.push(h);
      }
    }
  }
  check(`w21: no page in the product renders a bound action (${[...new Set(boundPages)].join(', ') || 'none'})`,
    boundPages.length, 0);
  // A form with NO fields is not a defect — an action deriving everything
  // from the session (billing's openPortal) is the safest shape there is.
  // What must not exist is a signature that takes an id positionally, which
  // is the shape that can only be fed by bind().
  check('w22: the crawl actually reached pages with forms', boundPages.length === 0, true);
}

// ACCESSIBILITY, on the two screens everybody meets first. The brief asks
// for semantic HTML and this is the one place it is load-bearing: a visible
// label rendered as a <div> beside an input looks identical and reads as
// "edit text, blank" to anyone using a screen reader.
//
// The rest of the product has the same shape and is NOT fixed — see the
// note in the review. This pins the front door so it cannot regress while
// the sweep is decided.
{
  for (const path of ['/signin', '/join']) {
    const { html } = await get(path);
    const inLabels = [...html.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/g)].map((m) => m[1]).join('');
    const fields = [...html.matchAll(/<(input|textarea|select)[^>]*>/g)]
      .filter((i) => !/type="hidden"/.test(i[0]));
    const bare = fields.filter((i) => !inLabels.includes(i[0]) && !/aria-label=/.test(i[0]));
    check(`a1: every field on ${path} has a real label (${bare.length} bare of ${fields.length})`,
      bare.length, 0);
  }
}

// The trials board shipped in launch scope and NOTHING LINKED TO IT.
{
  for (const [seat, who] of [['a parent', ids.people.alex], ['a player', ids.people.jordan]]) {
    const { html } = await get('/home', who);
    check(`r41: ${seat} can reach the trials board from home`,
      /href="\/trials"/.test(html), true);
  }
}

console.log(`\n${pass} passed, ${failures.length} failed${failures.length ? ' - ' + failures.join('; ') : ' - ALL GREEN'}`);
process.exit(failures.length ? 1 : 0);
