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
import { watchForTokens } from './token-in-url.mjs';

const BASE = process.env.RENDER_BASE ?? 'http://localhost:3000';
// Every response from here on is watched for a share token in what it would
// put in an address bar (scripts/token-in-url.mjs; brief D). Judged at the end.
const tokenWatch = watchForTokens(BASE);
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

// Every page this suite is served, whoever it was served to, and whether it
// carried Vercel Analytics — read at the end ("an-r", brief C, 29 Sep), so the
// whole suite is the crawl and not only the sweep written for it. The mark is
// the client module's name in Next's payload, which the dev server spells
// out; a production build hashes it, and this suite runs against dev.
const ANALYTICS_MARK = /@vercel\/analytics|PublicAnalyticsScript/;
// THE ONE GLOW (Head of Product Design ruling 1, spec A part 18; added with
// the base pass, 1 Oct). .fl-glow goes on a screen's one primary action and
// on no other, so a stranger can see what the screen is for. Nothing else
// enforces a per-page rule, so every page this suite is served is counted —
// in the markup, not in Next's payload, which repeats every className once
// more inside a <script>. Judged at the end ("glow1").
const glowCount = (html) => (html.replace(/<script[\s\S]*?<\/script>/g, ' ').match(/\bclass="[^"]*\bfl-glow\b[^"]*"/g) ?? []).length;
const glowMany = new Set();
const served = [];
async function get(path, personId) {
  const res = await fetch(BASE + path, {
    redirect: 'manual',
    headers: personId ? { cookie: cookieFor(personId) } : {},
  });
  const html = await res.text();
  served.push({ path, who: personId ?? null, status: res.status, analytics: ANALYTICS_MARK.test(html) });
  const glows = glowCount(html);
  if (glows > 1) glowMany.add(`${path.replace(/[0-9a-f-]{36}/g, '*')} (${glows})`);
  return { status: res.status, location: res.headers.get('location'), csp: res.headers.get('content-security-policy'), robots: res.headers.get('x-robots-tag'), html };
}

// D-163 (0075): billing is OFF until further notice, and this suite renders the product
// with it off. The Stripe build stays behind the switch, and the blocks that
// test IT turn the switch on through the app (/dev/billing — this file cannot
// reach the database) and put it back. The answer is read back, so a switch
// that did not flip stops the run rather than testing the wrong product.
// How many lines of /terms state a dollar figure today (see free-r1c).
const TERMS_PRICED_LINES = 1; // Brief J (29 Sep, doc 37's defaults): of v2.1's seven, the A6.1 history note, Schedule A's opening banner (the ACL maximum) and the open items table go as drafting, and the $2,000 floor and its counsel note are held. Left: A6.2's dormant GST example, John's clause text
async function billingSwitch(on) {
  const r = await fetch(`${BASE}/dev/billing?on=${on ? 1 : 0}`, { method: 'POST' });
  const j = r.ok ? await r.json() : null;
  if (j?.billing !== on) throw new Error(`the billing switch did not turn ${on ? 'on' : 'off'} (${r.status})`);
}
await billingSwitch(false);

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
// U-6's fourth condition — the same promise, the same screen, the same bug.
//
// John: "a guardian may ask who at Pitch has looked at their child's record
// and why, and get a straight answer. That is the condition that makes the
// other three real." fn_who_looked answered it from 0025 and no page called
// it, exactly as fn_send_log above. Reading the source cannot catch that;
// rendering the page can.
// ---------------------------------------------------------------------------
{
  // The card's words are proposals awaiting BUZ (components/WhoLooked), so
  // these read its marker and the function's own values — who, what, which
  // report — never its prose (L32). The card renders in development only
  // until he approves them, which is where this suite runs.
  const nate = ids.children.nate;
  const card = (html) => html.slice(Math.max(0, html.indexOf('id="who-looked"')),
    html.indexOf('id="who-looked"') === -1 ? 0 : html.indexOf('id="who-looked"') + 4000);
  const told = card((await get(`/g/controls/${nate.child_id}`, alex)).html);
  check('r5a: the guardian’s controls page carries the who-looked card, answered',
    /data-who-looked="answered"/.test(told), true);
  check('r5b: naming WHO at Pitch looked — the investigator fn_who_looked returns',
    /data-investigator="?"?[^>]*>Priya Raman</.test(told), true);
  check('r5c: and why — what was read, and the report it was opened against',
    [told.includes('read the send log'), /data-look="[0-9A-F]{8}"/.test(told)], [true, true]);
  // BUZ's default (28 Sep): a short reference, never the report's uuid — not
  // in the text and not in an attribute.
  const ref = /data-look="([0-9A-F]{8})"/.exec(told)?.[1];
  check('r5f: the row shows the short report reference, and no uuid is anywhere on the card',
    [ref ? text(told).some((l) => l.endsWith(`· report ${ref}`)) : false,
     /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(told)], [true, false]);
  check('r5g: and the footer names the one support address',
    has(told, 'Ask us why at burak.donmez@pitch-football.com and we will tell you.'), true);

  // The other half of the card, and the state almost every real family is in.
  const none = card((await get(`/g/controls/${deniz.child_id}`, alex)).html);
  check('r5d: a child nobody has looked at gets an answer, not a missing card',
    /data-who-looked="nobody"/.test(none), true);
  check('r5e: and no other family’s answer leaks onto that page',
    none.includes('Priya Raman') || none.includes('read the send log'), false);
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

// doc 14 E9/E10: a string that was never a token, and every dead state, answer
// in indistinguishable time as well as with the identical body (r16) — "this
// is a test, not a hope". Same tolerance as fp7; the numbers are printed so a
// slow outlier is visible even when it passes.
{
  const ms = async (path) => { const t0 = process.hrtime.bigint(); await get(path); return Number(process.hrtime.bigint() - t0) / 1e6; };
  const median = (xs) => xs.slice().sort((x, y) => x - y)[Math.floor(xs.length / 2)];
  const kinds = ['dev-expired', 'dev-revoked', 'nonsense-never-existed'];
  for (const k of kinds) await get(`/p/${k}`); // warm each route once
  const times = {};
  for (const k of kinds) times[k] = [];
  for (let i = 0; i < 9; i++) for (const k of kinds) times[k].push(await ms(`/p/${k}`));
  const med = kinds.map((k) => median(times[k]));
  const lo = Math.min(...med), hi = Math.max(...med);
  check(`E9/E10: expired, revoked and never-a-token answer in indistinguishable time — ${med.map((m) => m.toFixed(0) + 'ms').join(' / ')} over 9 runs`,
    hi - lo < Math.max(40, 0.5 * lo), true);
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
// Brief F: the crest a verified Technical Director has earned. Marina's role at
// Riverside is the one Riverside's verification call confirmed (0058); before
// this the page earned the crest from a coach's membership only, so her line
// read as plain text, exactly like a claim anybody could type. The other half
// — a typed "Technical Director, <another club>" wears no crest — needs the
// line changed, so the write suite presses it (crest-w1).
// ---------------------------------------------------------------------------
{
  const crest = `src="/dev-uploads/crest-${ids.clubs['riverside-fc']}.png"`;
  const hero = (h) => h.slice(0, h.indexOf('Coaching now'));
  const td = await get('/c/marina-petrovic');
  check('crest-r1: a Technical Director the call confirmed wears the club crest on the role line naming that club',
    [td.status, hero(td.html).includes(crest), has(hero(td.html), 'Riverside FC · Melbourne VIC'), has(td.html, 'Technical Director')],
    [200, true, true, true]);
  const coach = await get('/c/sam-kaya');
  check('crest-r2: and a coach still does, on the same rule', hero(coach.html).includes(crest), true);
}

// ---------------------------------------------------------------------------
// /home - the waiting list is ordered by how long it has waited.
// ---------------------------------------------------------------------------
{
  const { html } = await get('/home', alex);
  check('r27: the oldest waiting item leads',
    order(html, 'would like Georgia at a trial', 'wants to go on Riverside FC'), true);
  check('r28: and the newest is last',
    order(html, 'wants to send a CV to Quarrymead United', 'changed the page'), true);
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
  const quarrymead = ids.people['m.'];      // claimed club, NOT verified
  const sam = ids.people.sam;            // coach
  const alex = ids.people.alex;          // parent

  for (const [who, id] of [['a coach', sam], ['a parent', alex]]) {
    const r = await get('/club/register', id);
    check(`r32: ${who} cannot open a club register`, r.status, 307);
  }

  // D-126: an unverified club sees a COUNT and no names. (The sentence about
  // paying was removed with BUZ's yes on 29 Sep — D-163, nothing is paid.)
  const { html: unv } = await get('/club/register', quarrymead);
  check('r33: an unverified club is told how many are waiting', has(unv, 'waiting'), true);
  check('r34: and is shown no name at all',
    text(unv).some((l) => /Deniz|Nate|Georgia/.test(l)), false);
  check('r35: and is told plainly that the call is what releases them, with no sentence about paying left behind (BUZ, 29 Sep)',
    [has(unv, 'Registrations are held until your club is verified'), /Paying doesn|Payment does/.test(unv)], [true, false]);
  // A-P7 (BUZ, 1 Oct, option A): the unverified club is told what happens
  // next, and the one glow is "Email us a good time to ring".
  const mailto = /href="mailto:burak\.donmez@pitch-football\.com\?subject=A%20good%20time%20to%20ring%20[^"]+"[^>]*>Email us a good time to ring</;
  check('ap7a: the held register offers the same mailto, as a secondary', [mailto.test(unv), /class="btn btn-secondary"[^>]*>Email us a good time to ring|href="mailto:[^"]*" class="btn btn-secondary"/.test(unv)], [true, true]);
  const { html: unvHome } = await get('/home', quarrymead);
  const unvMarkup = unvHome.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<!-- -->/g, '');
  check('ap7b: an unverified club’s home says what happens next — the call, a number we find ourselves — with the mailto as its one glow and Register kept as a secondary',
    [has(unvHome, 'What happens next'), has(unvHome, 'A short phone call with us'),
     /on a number we find ourselves, not one you give us\. Let the club know to expect us\./.test(unvMarkup),
     mailto.test(unvMarkup), (unvMarkup.match(/class="btn btn-primary fl-glow"/g) ?? []).length,
     /<a (?=[^>]*href="\/club\/register")(?=[^>]*class="btn btn-secondary")[^>]*>Register</.test(unvMarkup),
     (unvMarkup.match(/class="btn btn-primary[ "]/g) ?? []).length],
    [true, true, true, true, 1, true, 1]);

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
    (await get(`/club/register/cv/${links[0]}`, quarrymead)).status, 404);
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
  const priced = new Set();      // D-163: a price, while billing is off
  const termsPriced = new Set(); // …and the one exemption, counted
  const opsCost = new Set();     // the operator's own SMS spend (free-r1d)
  const oldHelp = new Set();     // the support address BUZ replaced (28 Sep)
  let fetched = 0;

  for (const [seat, who] of Object.entries(seats)) {
    const seen = new Set();
    // The signed-out entry points are in the queue too, so one walk covers
    // the public pages a seat would never link to.
    const queue = ['/', '/home', '/trials', '/jobs', '/signin', '/join'];
    // Nothing in the product links to the operator console, so it has to be
    // seeded or it is never seen.
    if (seat === 'operator') queue.push('/ops/verification', '/ops/support', '/ops/switches', '/ops/clubs');
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
      // D-163: free until further notice. No page a person can reach states a price — a
      // dollar sign followed by a digit anywhere in the text the page shows.
      // (Not the script payload: React's flight data spells references as
      // "$1", "$L2", and that is not a price anybody reads.)
      //
      // ONE NAMED EXEMPTION, and it is not ours to close: /terms renders doc
      // 22, and a legal document is not edited by a builder. John's v2.1 took
      // the D-109 price out of Schedule A (doc 36 item 1); what a dollar sign
      // is left on is his clause text. Its mentions are counted below instead,
      // so the exemption cannot grow without failing.
      for (const line of text(r.html)) {
        const m = /\$\s?\d/.exec(line);
        if (!m) continue;
        if (P === '/terms') { termsPriced.add(line); continue; }
        // The operator's own SMS spend and limit (0070, D-81) are what WE pay, shown
        // only behind requireOperator — not a price anyone is charged. Exempt on
        // that one page, on those words only; everything else stays strict.
        if (P === '/ops/switches' && /spent this month|limit|cap/i.test(line)) { opsCost.add(line); continue; }
        priced.add(`${seat} ${P}: ${line.slice(Math.max(0, m.index - 30), m.index + 30)}`);
      }
      if (/help@pitchfootball\.com\.au/i.test(text(r.html).join(' ') + r.html)) oldHelp.add(`${seat} ${P}`);
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

  // D-163. Every page every seat can reach, billing off: no price anywhere.
  check(`free-r1: no page any seat can reach states a price while billing is off (D-163) (${[...priced].slice(0, 6).join(' | ') || 'none does'})`,
    priced.size, 0);
  check(`support-r1: no page any seat can reach shows the old support address (${[...oldHelp].join(', ') || 'none does'})`,
    oldHelp.size, 0);
  check(`free-r1d: the only other exemption is the operator's own SMS spend on /ops/switches (${[...opsCost].slice(0, 2).join(' | ') || 'none'})`,
    [...opsCost].every((l) => /spent this month|limit|cap/i.test(l)), true);
  check(`free-r1b: and the crawl was a crawl (${fetched} pages fetched)`, fetched > 150, true);
  // The exemption, pinned. /terms states a dollar figure on exactly one line
  // since brief J: A6.2's GST example, in a clause dormant while Pitch is
  // free. A new line with a dollar figure on it fails here, and so does the
  // day that one goes.
  check(`free-r1c: /terms is the one exemption — ${termsPriced.size} line states a dollar figure (A6.2's dormant GST example)`,
    termsPriced.size, TERMS_PRICED_LINES);

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
  // D-163: with billing off there is no plan screen, so it is not one of the
  // doors; the billing block below turns the switch on and checks it there.
  const CLUB = { '/club/register': 'Register', '/club/squads': 'Squads',
    '/club/page-edit': 'Crest & club page', '/club/roles': 'Coaching roles',
    '/club/post-trial': 'Post a trial' };
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
  for (const path of ['/ops', '/ops/verification', '/ops/reports', '/ops/support', '/ops/switches', '/ops/clubs']) {
    const opHtml = (await get(path, ids.people.marina)).html;
    const nav = navOf(opHtml, 'Operator');
    check(`s4: ${path} carries the operator sidebar`, nav !== null, true);
    const opBar = navOf(opHtml, 'Operator bar');
    check(`s4b: ${path} carries the operator bar, with the same doors`, opBar && nav ? JSON.stringify(hrefs(opBar)) === JSON.stringify(hrefs(nav)) : false, true);
  }
  // Round E: the queue's count line said "1 clubs awaiting a call". The seed
  // has one club awaiting a call, so the singular is what this reads; both
  // counts on the line must agree with their nouns whatever they are.
  {
    // React separates the numbers from the words with <!-- --> markers; a
    // person sees one line, so this reads one.
    const line = text((await get('/ops/verification', ids.people.marina)).html.replace(/<!--[\s\S]*?-->/g, ''))
      .find((l) => /awaiting a call/.test(l)) ?? '';
    const m = /^(\d+) (clubs?) awaiting a call · (\d+) (registrations?) held$/.exec(line);
    const agrees = (n, noun, one) => noun === (Number(n) === 1 ? one : one + 's');
    check(`ops-r1: the verification queue counts in English — "${line}"`,
      [Boolean(m), m ? agrees(m[1], m[2], 'club') : false, m ? agrees(m[3], m[4], 'registration') : false], [true, true, true]);
  }
  // Brief G (29 Sep): the operator's Today screen. Counts only, never a zero
  // (D-162), the footer's promise on the page, and no door off it but the
  // lookup. Read from the page outside its two navs, so the rail's own doors
  // are not mistaken for the page's.
  {
    const html = (await get('/ops', ids.people.marina)).html.replace(/<!--[\s\S]*?-->/g, '');
    const main = html.replace(/<nav[\s\S]*?<\/nav>/g, ' ');
    const tiles = [...main.matchAll(/data-ops-tile="([^"]+)"[^>]*>[\s\S]*?<div[^>]*>[^<]*<\/div><div[^>]*>([^<]*)<\/div>/g)].map((m) => [m[1], m[2].trim()]);
    check(`ops-r2: Today shows its counts, and none of them is a zero (D-162) (${tiles.map(([l, v]) => `${l} ${v}`).join(', ') || 'no tiles'})`,
      [tiles.length >= 3, tiles.filter(([, v]) => !/^[1-9]\d*$/.test(v)).map(([l]) => l)], [true, []]);
    check('ops-r3: the seed\u2019s own figures reach the page (Held and Clubs awaiting a call)',
      ['Held', 'Clubs awaiting a call'].every((l) => tiles.some(([t]) => t === l)), true);
    check('ops-r4: the footer says what the page will not do',
      text(html).some((l) => l.startsWith('Everything on this page is a count. No name, no record, and no way to get to one from here')), true);
    const doors = hrefs(main).filter((h) => !['/home', '/signout', '/privacy', '/terms', '/report'].includes(h) && !h.startsWith('/report?'));
    check(`ops-r5: the page itself links nowhere but the lookup (${doors.join(' ') || 'nowhere'})`,
      doors.every((h) => h === '/ops/support'), true);
  }
  // Brief G (29 Sep): the call sheet as BUZ asked for it. The guidance used to
  // be written INTO the field labels in tracked capitals ("OPERATOR — THE
  // HUMAN. NAMED, EVERY TIME…"), and each yes/unknown answer was its own tall
  // select. Read from the served page: every tracked-caps caption is short,
  // and the four questions are radio groups posting the values they always
  // posted (0025's columns, write-tests td-w*).
  {
    const riv = ids.clubs['riverside-fc'];
    const html = (await get(`/ops/call/${riv}`, ids.people.marina)).html.replace(/<!--[\s\S]*?-->/g, '');
    const main = html.replace(/<nav[\s\S]*?<\/nav>/g, ' ');
    const caps = [...main.matchAll(/<(?:span|div|legend)[^>]*text-transform:uppercase[^>]*>([\s\S]*?)<\/(?:span|div|legend)>/g)]
      .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, "'").trim()).filter(Boolean);
    const long = caps.filter((c) => c.length > 32);
    check(`ops-r6: the call sheet's captions are short, the guidance is not in them (${caps.length} captions${long.length ? ' — too long: ' + long.join(' | ') : ''})`,
      [caps.length >= 8, long], [true, []]);
    const radios = (name) => [...main.matchAll(new RegExp(`<input[^>]*type="radio"[^>]*name="${name}"[^>]*value="([a-z]+)"`, 'g'))].map((m) => m[1]);
    check('ops-r7: the four questions are one-tap choices posting the values they always did',
      [radios('club_confirmed'), radios('person_confirmed'), radios('incorporated'), radios('authority_confirmed'),
       /<select[^>]*name="(club_confirmed|person_confirmed|incorporated|authority_confirmed)"/.test(main)],
      [['yes', 'no'], ['yes', 'no'], ['unknown', 'yes', 'no'], ['unknown', 'yes', 'no'], false]);
  }
  // BUZ, 29 Sep ("yes to the four"): three of the operator-console calls, as
  // the pages serve them. The fourth — a call is not recorded until the first
  // two questions are answered — is pressed by the write suite (ops-w1).
  {
    const main = (h) => h.replace(/<!--[\s\S]*?-->/g, '').replace(/<nav[\s\S]*?<\/nav>/g, ' ');
    const sheet = main((await get(`/ops/call/${ids.clubs['riverside-fc']}`, ids.people.marina)).html);
    const radio = (name, value) => new RegExp(`<input[^>]*type="radio"[^>]*name="${name}"[^>]*value="${value}"[^>]*>`).exec(sheet)?.[0] ?? '';
    check('ops-r8: the call sheet’s first two questions start with nothing chosen and must be answered; "incorporated" and "authority" still start at unknown',
      [['club_confirmed', 'person_confirmed'].flatMap((q) => ['yes', 'no'].map((v) => /checked/.test(radio(q, v)))),
       ['club_confirmed', 'person_confirmed'].map((q) => /required/.test(radio(q, 'yes'))),
       ['incorporated', 'authority_confirmed'].map((q) => /checked/.test(radio(q, 'unknown')))],
      [[false, false, false, false], [true, true], [true, true]]);
    check('ops-r9: and it no longer says a no or unknown answer will "flag the subscription" (billing is off, D-163)',
      /flag the subscription/.test(text(sheet).join(' ')), false);
    const sw = text(main((await get('/ops/switches', ids.people.marina)).html));
    const spend = sw.find((l) => /spent this month$/.test(l)) ?? '';
    check(`ops-r10: the SMS spend says the absence in words, never $0.00 (D-162) — "${spend}"`,
      [spend !== '', /\$0\.00/.test(spend), spend === 'Nothing spent this month' || /^\$(?!0\.00)\d+\.\d\d (of \$\d+\.\d\d )?spent this month$/.test(spend)],
      [true, false, true]);
    const look = (await get('/ops/support', ids.people.marina)).html;
    const rail = text(navOf(look, 'Operator') ?? '');
    check('ops-r11: the door is "Lookup" — the rail, the page’s own title and its tab agree, and nothing is called "Support" any more',
      [rail.includes('Lookup'), rail.includes('Support'), /<h1[^>]*>Lookup<\/h1>/.test(look), /<title>Lookup · Pitch Football<\/title>/.test(look)],
      [true, false, true, true]);
  }
  // Brief I (29 Sep; 0130): every club in every state, from the operator's
  // side. No person's data on the directory; the doors each state earns; the
  // search; one unclaimed listing's own screen, with the notice Pitch
  // compiled for it and its stamps; and the doors a verified club does not
  // get from here.
  {
    const op = ids.people.marina;
    const westgate = ids.clubs['westgate-rangers'], riverside = ids.clubs['riverside-fc'];
    const strip = (h) => h.replace(/<!--[\s\S]*?-->/g, '').replace(/<nav[\s\S]*?<\/nav>/g, ' ');
    const dir = strip((await get('/ops/clubs', op)).html);
    const rows = [...dir.matchAll(/data-club-row="([a-z]+)"([\s\S]*?)(?=data-club-row=|<\/main>|$)/g)].map((m) => ({ state: m[1], html: m[2] }));
    const rowOf = (name) => rows.find((r) => text(r.html).includes(name))?.html ?? '';
    check(`cur-r1: the directory lists every club in every state the seed holds (${[...new Set(rows.map((r) => r.state))].sort().join(', ')})`,
      [rows.length >= 4, ['claimed', 'unclaimed', 'verified'].every((st) => rows.some((r) => r.state === st))], [true, true]);
    check('cur-r2: each row opens its public page, and only a club somebody has claimed opens a call sheet',
      [new RegExp('href="/fc/westgate-rangers"').test(rowOf('Westgate Rangers')), /href="\/ops\/call\//.test(rowOf('Westgate Rangers')),
       new RegExp(`href="/ops/call/${riverside}"`).test(rowOf('Riverside FC')), new RegExp(`href="/ops/clubs/${westgate}"`).test(rowOf('Westgate Rangers'))],
      [true, false, true, true]);
    const people = ['Marina', 'Petrovic', 'Dana', 'Kovac', 'Sam Kaya', 'Alex', 'Robin'];
    check('cur-r3: and it carries no person’s data — no name, no address, nobody who claimed or runs a club',
      [people.filter((n) => text(dir).some((l) => l.includes(n))), text(dir).filter((l) => l.includes('@'))], [[], []]);
    const found = text(strip((await get('/ops/clubs?q=preston', op)).html)).filter((l) => /^(Northern United SC|Riverside FC|Westgate Rangers)$/.test(l));
    check('cur-r4: the search finds a club by its suburb, and says so when nothing matches',
      [found, text(strip((await get('/ops/clubs?q=nowhere-at-all', op)).html)).includes('Nothing matches that.')], [['Northern United SC'], true]);
    const wg = strip((await get(`/ops/clubs/${westgate}`, op)).html);
    check('cur-r5: an unclaimed listing’s own screen offers its listing to change, says who listed it, and the notice Pitch compiled, stamped, with the link it came from',
      [/<input[^>]*name="name"[^>]*value="Westgate Rangers"/.test(wg) || /value="Westgate Rangers"[^>]*name="name"/.test(wg),
       text(wg).some((l) => /^Listed \d{1,2} [A-Z][a-z]{2} \d{4} by td@example\.com$/.test(l)),
       text(wg).includes('U13 Boys trials'),
       text(wg).some((l) => /^Listed \d{1,2} [A-Z][a-z]{2} by td@example\.com · checked \d{1,2} [A-Z][a-z]{2}$/.test(l)),
       /href="https:\/\/westgaterangers\.example\.au\/trials"/.test(wg),
       /href="\/ops\/clubs\/[0-9a-f-]{36}\/trial"/.test(wg)],
      [true, true, true, true, true, true]);
    const rv = strip((await get(`/ops/clubs/${riverside}`, op)).html);
    check('cur-r6: a verified club’s screen has no listing to change and no "Post a trial" — it posts its own (D-90) — and its trial form is not found',
      [/name="name"/.test(rv), /\/trial"/.test(rv), /href="\/ops\/call\//.test(rv),
       (await get(`/ops/clubs/${riverside}/trial`, op)).status, (await get('/ops/clubs/not-a-club', op)).status],
      [false, false, true, 404, 404]);
    const out = await get('/ops/clubs', null);
    check('cur-r7: signed out, the directory is not there to read', [out.status, out.location?.endsWith('/signin')], [307, true]);
  }
  // D-154 — the administrator's frame and walls. The same subset rule, and
  // the register itself is not one of her doors at a verified club.
  {
    const pat = ids.people.pat;
    const patHome = new Set(hrefs((await get('/home', pat)).html));
    patHome.add('/home');
    check('s10: a verified club’s administrator is offered no register on /home', patHome.has('/club/register'), false);
    for (const path of ['/club/squads', '/club/page-edit', '/club/roles', '/club/post-trial']) {
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
    // Spec A (unverified, 1 Oct): the held count is the hero's one stat — the
    // numeral, then the word "waiting" — so the two are read as a stat pair
    // rather than as one run of text.
    check('s5e: an unverified club sees a waiting count and nothing else',
      [/class="numeral numeral-l"[^>]*>\d+<\/div><div class="stat-l"[^>]*>waiting</.test(heldHome), /On your register|interested/.test(heldHome)], [true, false]);
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
      check(`s25: ${seat} ${P} bar and rail are the same doors`,
        hrefs(bar).filter((h) => h !== '/signout'), hrefs(rail).filter((h) => h !== '/signout'));
      // Sign out is not a DOOR — it is the way out, and it is deliberately in
      // every seat's sheet and rail from 28 Sep (BUZ), because until then it
      // was linked from one screen and no seat with anything to protect could
      // reach it. The "four fit" rule is about navigation destinations, so it
      // is counted separately: the bar must still offer at most four places to
      // GO, and must always offer the way out.
      const barDoors = hrefs(bar).filter((h) => h !== '/signout');
      check(`s25b: ${seat} ${P} bar holds at most four doors`, barDoors.length <= 4, true);
      check(`s25c: ${seat} ${P} bar and rail both offer the way out`,
        [hrefs(bar).includes('/signout'), hrefs(rail).includes('/signout')], [true, true]);
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
  // Every door except Sign out, which is a state change rather than a read:
  // following it revokes the session (0062), so opening it here would sign
  // this seat out and send a check four hundred lines later red, which is the
  // dangerous direction (L34: the answer would have been "the product is
  // broken"). It is pressed, and its answer checked, in the write suite
  // (sess-w1..w3), which is where pressing buttons belongs.
  //
  // This check USED TO SAY "and it is only on this screen" — and that was
  // true, and was the defect. Sign out was linked from one branch of one page,
  // the one that renders for a parent with no children, so every seat with
  // something to protect had no way out at all. BUZ put it in every shell on
  // 28 Sep. A check that asserts the shape of a bug will defend the bug, so it
  // now asserts the decision: the way out is reachable from here too.
  const doors = links.filter((h) => h !== '/signout');
  check('r43: and every door it offers is one that exists',
    (await Promise.all(doors.map(async (h) => (await get(h, ids.people.robin)).status)))
      .every((st) => st === 200 || st === 307), true);
  check('r43b: Sign out is reachable from here, as it now is from every seat',
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

// The board, Floodlit (D-173 as extended 1 Oct; BUZ: "Yes to all" to P1-P4
// and N1). Signed out it wears the public nav bar the front door and the club
// pages link to it from (P2); signed in it stays in the seat's own frame. Each
// row's one action is on the charter's two buttons, never a third (a 44px
// pill). A board FILTERED to nothing keeps its filters, its note and the
// approved line, in one element, and offers no doors — those are the empty
// board's alone (P3, P4), and the empty board itself is pressed at the end of
// the write suite, the one place every notice comes off.
{
  const plain = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<!-- -->/g, '');
  const out = plain((await get('/trials', null)).html);
  const pub = /<nav[^>]*aria-label="Pitch"[^>]*>([\s\S]*?)<\/nav>/.exec(out)?.[1] ?? '';
  const mine = plain((await get('/trials', ids.people.jordan)).html);
  check('tb1: signed out, the board wears the public nav — Find your club, Trials marked as this page, Sign in — and a player sees it in their own frame, not under it (P2)',
    [/href="\/claim"[^>]*>Find your club</.test(pub), /href="\/trials"[^>]*aria-current="page"[^>]*>Trials<|aria-current="page"[^>]*href="\/trials"[^>]*>Trials</.test(pub),
     /href="\/signin"[^>]*>Sign in</.test(out), /<nav[^>]*aria-label="Pitch"/.test(mine), /<nav[^>]*aria-label="Player"/.test(mine)],
    [true, true, true, false, true]);
  const doors = [...out.matchAll(/<a[^>]*href="\/fc\/[^"]+#play"[^>]*>/g)].map((m) => m[0]);
  check(`tb2: every listing's one action is a charter button — "I’m interested" the primary, "Send my CV" the secondary (${doors.length} listings)`,
    // The row's primary carries no glow (ruling 1: never a button inside a
    // list row), so the class is matched exactly — a glow coming back on a
    // row fails here as well as in glow1.
    [doors.length >= 3, doors.filter((a) => !/class="btn btn-(primary|secondary)"/.test(a)).length,
     /class="btn btn-primary"[^>]*href="\/fc\/[^"]+\?trial=[0-9a-f-]{36}#play"[^>]*>I’m interested</.test(out),
     /class="btn btn-secondary"[^>]*href="\/fc\/[^"?]+#play"[^>]*>Send my CV</.test(out)],
    [true, 0, true, true]);
  const none = plain((await get('/trials?gender=girls&pos=GK', null)).html);
  check('tb3: filtered to nothing, the board keeps its filters and its note, and says the approved line as one sentence in one element',
    [/(\d+) trials?</.exec(none)?.[1], /<details[^>]*class="[^"]*trial-filters/.test(none), none.includes('Positions wanted'),
     none.includes('the button on each listing tells you which'),
     /<p><b>No trials listed for that yet\.<\/b> An empty week is honest — we only list what a club has posted or published itself\.<\/p>/.test(none),
     none.includes('No trials listed yet.')],
    ['0', true, true, true, true, false]);
  check('tb4: the two doors are the empty board\'s alone — not on a board with trials, not on one filtered to nothing (P4)',
    [out, none].map((h) => [h.includes('Build a CV first — it is what the club reads'), h.includes('Claim your club page'), h.includes('For clubs &amp; technical directors')]),
    [[false, false, false], [false, false, false]]);
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
  // BUZ, 30 Sep (option 1): the public site names the legal person (B5); a
  // signed-in screen keeps Privacy, Terms and Report a page (B4) and drops the
  // entity line.
  for (const path of ['/signin', '/trials', '/p/dev-jordan', '/terms', `/g/controls/${ids.children.nate.child_id}`, '/home']) {
    const signedIn = path.startsWith('/g/') || path === '/home';
    const who = signedIn ? ids.people.alex : null;
    const html = (await get(path, who)).html;
    const foot = /<footer class="site-foot">([\s\S]*?)<\/footer>/.exec(html)?.[1] ?? '';
    const named = /EBSD Enterprises Pty Ltd/.test(foot) && /ABN 65 701 879 718/.test(foot);
    check(`g32-r3: ${path.replace(/[0-9a-f-]{36}/, '*')} links a report (B4) and ${signedIn ? 'leaves the entity line off a signed-in screen' : 'names the legal person (B5)'}`,
      [/href="\/report/.test(foot), named], [true, !signedIn]);
    check(`g32-r4: ${path.replace(/[0-9a-f-]{36}/, '*')} footer carries no secret`, /dev-|[0-9a-f]{36}/.test(foot), false);
  }
  // The front page had no footer at all once the front door replaced the
  // coming-soon page (found 30 Sep). It renders the full one itself.
  check('g32-r6: the front door renders the full footer (B4, B5) — the layout\u2019s stays off `/` for the old page',
    /<SiteFooter onFrontPage \/>/.test(readFileSync(new URL('../app/front-door/page.tsx', import.meta.url), 'utf8')), true);
  check('g32-r5: nothing calls itself "Pitch Football Pty Ltd"', /Pitch Football Pty Ltd/i.test((await get('/signin')).html), false);
}

// ---------------------------------------------------------------------------
// What the legal surfaces SERVE (0056). The source markdown keeps its drafting
// preamble; no page may put it in front of a person. The worst of it was never
// /privacy: doc 32 B3 puts doc 21 INSIDE the guardian approval flow, so the one
// screen the whole consent funnel passes through opened by telling a parent
// that the policy they were being asked to accept was NOT YET PUBLISHED.
//
// The permission suite checks the same property against lib/legal-doc. This
// checks the page, because L16 was written about a renderer that was fine in
// theory and served the notes in practice.
// ---------------------------------------------------------------------------
{
  const MARKERS = ['NOT YET PUBLISHED', 'do-not-publish', 'not to be published', '⚠️',
    'Nothing here binds', 'working draft', 'the loss was my doing'];
  // The embedded document only — a marker anywhere else on the approval page
  // would be a different bug, and this check should not be the one to find it.
  const approval = (await get('/a/dev-mila-text')).html;
  const embedded = /<div class="legal-doc"[^>]*>([\s\S]*?)<\/div><style>/.exec(approval)?.[1] ?? '';
  check('leg-r1: the approval flow embeds the child policy, and it is not empty',
    embedded.length > 2000, true);
  check(`leg-r2: nothing in it says the policy is not published (${MARKERS.filter((m) => embedded.includes(m)).join(' · ') || 'none does'})`,
    MARKERS.filter((m) => embedded.includes(m)), []);
  // The version a page must show is the register's, read the way the page
  // reads it — not typed here, so a bump in the register cannot leave this
  // suite asserting the old number.
  const { legalDocument } = await import('../lib/legal-doc.ts');
  const line = (file) => { const d = legalDocument(file); return `Version ${d.version.replace(/^v/, '')} · ${d.date}`; };
  check(`leg-r3: and a parent can still see which version they are accepting (${line('21-Privacy-Policy-Child.md')})`,
    embedded.includes(line('21-Privacy-Policy-Child.md')), true);
  // John, 28 Sep: these versions are the published ones, so nothing a parent
  // is shown says otherwise — in the flow or on the page, in any case.
  check(`leg-r7: nothing in the approval flow's policy says "not yet published" (${/not yet published/i.test(embedded) ? 'it does' : 'nothing does'})`,
    /not yet published/i.test(embedded), false);

  // Brief K: /conduct (doc 24) and /report/policy (doc 25) are served now, by
  // the same renderer, and are held to the same four checks.
  for (const [path, file] of [['/privacy', '20-Privacy-Policy-Adult.md'], ['/privacy/family', '21-Privacy-Policy-Child.md'], ['/terms', '22-Terms-of-Service.md'],
    ['/conduct', '24-Code-of-Conduct.md'], ['/report/policy', '25-Complaints-and-Takedown.md']]) {
    const { status, html } = await get(path);
    const doc = /<div\s+class="legal-doc"[^>]*>([\s\S]*?)<\/div><style>/.exec(html)?.[1] ?? '';
    check(`leg-r4: ${path} serves the document and no drafting marker (${MARKERS.filter((m) => doc.includes(m)).join(' · ') || 'none'})`,
      [status, doc.length > 2000, MARKERS.filter((m) => doc.includes(m))], [200, true, []]);
    check(`leg-r5: ${path} carries its version and date (${line(file)})`, has(html, line(file)), true);
    check(`leg-r8: ${path} never calls itself unpublished`, /not yet published/i.test(doc), false);
    // The title is still the first thing on the page: the preamble went, and
    // nothing of the document went with it.
    // Docs 24 and 25 carry one subtitle under the title (lib/legal-doc's
    // headEnd), and the version line goes under that.
    check(`leg-r6: ${path} opens with the document, not a rule under its title`,
      /<h1[^>]*>[^<]+<\/h1>\s*(?:<h3[^>]*>[^<]+<\/h3>\s*)?<p><em>Version/.test(doc), true);
  }
}

// Brief J (29 Sep): what the Terms page serves on 1 October. The permission
// suite proves the property over lib/legal-doc (legj1–8); this reads the pages
// themselves (L16), because a renderer that is right in theory has served the
// notes in practice before. Brief K: /conduct serves doc 24 and /report/policy
// doc 25, so both are read here too; /report is the form, and still read.
{
  const DRAFTING = [/\[DRAFTED\]/, /\[OUTLINE\]/, /\[LEGAL/, /\[DO NOT PUBLISH/i, /do not publish/i,
    /must not publish/i, /not yet published/i, /for legal review/i];
  // A conduct rule, and content: doc 22 Schedule C 3.
  const CONDUCT = /\b[Dd]o not publish other people's children/g;
  const plain = (html) => text(html).join('\n').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"');
  for (const path of ['/terms', '/privacy', '/privacy/family', '/report', '/conduct', '/report/policy']) {
    const { status, html } = await get(path);
    const hits = DRAFTING.filter((r) => r.test(plain(html).replace(CONDUCT, ''))).map(String);
    check(`legj-r1: ${path} (${status}) serves none of the brief's drafting phrases (${hits.join(' · ') || 'none'})`, hits, []);
  }

  // Brief K item 3: our own working references are off the Terms page, and
  // 2.3 has its full stop. Read off the page, not the renderer (L16).
  const termsK = plain((await get('/terms')).html);
  const refs = [/\bD-\d+/, /\bPhase 1\b/, /for the build/i, /not current behaviour/i, /\(\s*\)/].filter((r) => r.test(termsK)).map(String);
  check(`legk-r1: /terms serves no D-number, "Phase 1", "for the build" or "not current behaviour", and 2.3 ends on its own full stop (${refs.join(' · ') || 'none'})`,
    [refs, /before the account activates\.(\n|$)/m.test(termsK)], [[], true]);

  // Brief K item 2: both documents, signed out, from /report with no account.
  const conduct = await get('/conduct'), policy = await get('/report/policy'), form = await get('/report');
  const policyText = plain(policy.html);
  check('legk-r2: /conduct serves the Code of Conduct to anyone signed out — its title, its eight rules, the appeal',
    [conduct.status, /<h1[^>]*>PITCH — Code of Conduct<\/h1>/.test(conduct.html), has(conduct.html, '8. If you see something, report it'), has(conduct.html, 'You can always appeal')],
    [200, true, true, true]);
  check('legk-r3: /report/policy serves doc 25\'s Part 1 to anyone signed out, and none of Parts 2–5, which the document keeps internal',
    [policy.status, /<h1[^>]*>PITCH — Complaints, Reports and Takedown<\/h1>/.test(policy.html),
     ['Reporting something', 'What happens then', 'If it is urgent', 'If you are unhappy with what we did'].every((h) => policyText.includes(h)),
     ['Part 2', 'How this actually runs', 'Triage, in three classes', 'Take the page down first', 'Safety by Design', 'What an investigator may look at'].filter((h) => policyText.includes(h))],
    [200, true, true, []]);
  const link = /<a href="\/report\/policy"[^>]*>([^<]*)<\/a>/.exec(form.html)?.[1];
  check(`legk-r4: /report links to it by the document's own title ("${link ?? 'no link'}"), signed out`,
    [form.status, link, /PITCH — (.+?)<\/h1>/.exec(policy.html)?.[1]], [200, 'Complaints, Reports and Takedown', 'Complaints, Reports and Takedown']);
  const terms = plain((await get('/terms')).html);
  check('legj-r2: /terms serves neither held clause — the five-year record period, the $2,000 floor',
    [/five[- ]years?/i.test(terms), /\$\s?2,000/.test(terms)], [false, false]);
  // Around every removal, the clause beside it is still there, word for word.
  const KEPT = ['0.1 The parties.', 'Reports concerning a person under 18 are actioned first.',
    'nothing on Pitch discharges that responsibility.', '(a) Nothing is capped where it should not be.',
    '(c) Neither of us is liable', 'Everyone using Pitch agrees:', 'Do not publish other people\'s children.',
    'A5.4 Free until further notice', 'build supports guardian co-acceptance'];
  const lost = KEPT.filter((k) => !terms.includes(k));
  check(`legj-r3: and the clauses beside each removal are still served (${lost.join(' · ') || 'all are'})`, lost, []);
}

// Brief K item 4: one button. The board and the club's own page answer "what
// does a family do here" the same way, for every listing, both ways: "I'm
// interested" on the board is a register on the page, and "Send my CV" on the
// board is a CV on the page. A claimed-but-unverified club was the case they
// disagreed on; the seed has none on the board, so the write suite claims one
// (one-w*) and this holds the rule over everything the seed does list.
{
  const board = (await get('/trials')).html;
  const doors = [...board.matchAll(/href="\/fc\/([^"?#]+)(\?trial=[0-9a-f-]{36})?#play"[^>]*>([^<]+)</g)]
    .map((m) => ({ slug: m[1], trial: Boolean(m[2]), label: m[3].replace(/&rsquo;/g, '’') }));
  const pages = {};
  for (const slug of new Set(doors.map((d) => d.slug))) pages[slug] = (await get(`/fc/${slug}`)).html;
  const disagree = doors.filter((d) => d.trial
    ? !(d.label === 'I’m interested' && has(pages[d.slug], 'Sign in to register your interest') && !has(pages[d.slug], 'Sign in to send your CV'))
    : !(d.label === 'Send my CV' && has(pages[d.slug], 'Sign in to send your CV') && !has(pages[d.slug], 'Sign in to register your interest')));
  check(`one-r1: every listing's button on the board is the door its club's page offers (${doors.length} listings; ${disagree.map((d) => d.slug).join(', ') || 'all agree'})`,
    [doors.length >= 3, doors.some((d) => d.trial) && doors.some((d) => !d.trial), disagree], [true, true, []]);
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

  // ---- D-163 first: billing OFF, the launch configuration ------------------
  // Free until further notice, the register included. Nobody reaches the plan screen,
  // nothing links to it, every verified club reads its whole register, and
  // money is said nowhere.
  for (const [who, id] of [['the TD', marina], ['the administrator', pat], ['a club that never paid', dana], ['a club whose card failed', felix]]) {
    const r = await get('/club/billing', id);
    check(`free-r2: ${who} is sent home from /club/billing while billing is off`, [r.status, r.location], [307, '/home']);
  }
  for (const [who, id, path] of [['the TD', marina, '/home'], ['the TD', marina, '/club/register'], ['the administrator', pat, '/home'],
                                  ['a club that never paid', dana, '/club/register'], ['a club whose card failed', felix, '/club/register']]) {
    const html = (await get(path, id)).html;
    check(`free-r3: ${who}’s ${path} has no door to a plan and says nothing about paying for one`,
      [html.includes('/club/billing'), has(html, 'Plan & billing'), has(html, 'We couldn’t take your payment'),
       has(html, 'See the Interest Register'), has(html, 'The whole register is a plan')], [false, false, false, false, false]);
  }
  const dFree = await get('/club/register', dana);
  check('free-r4: a verified club that never paid reads its whole register — not the trial-interest slice (D-163)',
    [has(dFree.html, 'Interest in your trials'), has(dFree.html, 'Every under-16 here was put on this register by a parent.')], [false, true]);
  const fFree = await get('/club/register', felix);
  check('free-r4b: and so does a verified club whose card once failed — money is not asked while billing is off',
    [has(fFree.html, 'Interest in your trials'), has(fFree.html, 'Every under-16 here was put on this register by a parent.')], [false, true]);
  const held = await get('/club/register', ids.people['m.']);
  check('free-r5: an unverified club still sees a count and no names (D-126), whatever billing says',
    [/\d+ waiting/.test(text(held.html).join(' ')), has(held.html, 'Every under-16 here was put on this register by a parent.')], [true, false]);

  // ---- The Stripe build, behind the switch ---------------------------------
  await billingSwitch(true);
  const b = await get('/club/billing', marina);
  check('b1: the price is a display numeral, not body text', /class="[^"]*\bnumeral-l\b[^"]*"/.test(b.html) && has(b.html, '$54'), true);
  check('b1b: with its own caption under it rather than three pixels from it', has(b.html, 'a month, including GST'), true);
  check('b2: the next charge date sits beside it at the same rank',
    has(b.html, 'Next charge') && /class="[^"]*\bnumeral-m\b[^"]*"/.test(b.html) && has(b.html, 'unless you cancel before then'), true);
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
  // With billing on, the plan is one of the club's doors again, on the rail
  // and on /home both (D-147: the sidebar is a second way to the same doors).
  for (const [who, id] of [['the TD', marina], ['the administrator', pat]]) {
    const nav = /<nav[^>]*aria-label="Club"[^>]*>([\s\S]*?)<\/nav>/.exec((await get('/club/billing', id)).html)?.[1] ?? '';
    check(`b15: with billing on, ${who}’s sidebar carries Plan & billing as the current page`,
      /href="\/club\/billing"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/club\/billing"/.test(nav), true);
  }
  // Outside the two navs: the sidebar on /home carries the door too, so a
  // check that read the whole page passed with the rail's own card missing.
  check('b15b: and the TD’s /home offers the same door, in its own rail',
    (await get('/home', marina)).html.replace(/<nav[\s\S]*?<\/nav>/g, ' ').includes('href="/club/billing"'), true);
  await billingSwitch(false);
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

  // ONE ORDER (brief H: the walkthrough saw 20 Aug, 28 Dec, 25 Oct). What has
  // happened first, newest first; then what is coming, soonest first. Each
  // "DD Mon" is placed in the year that puts it nearest today, in Melbourne.
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const todayMel = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
  todayMel.setHours(0, 0, 0, 0);
  const dated = (lines) => (lines ?? []).filter((l) => /^\d{1,2} [A-Z][a-z]{2}$/.test(l)).map((l) => {
    const [d, m] = l.split(' ');
    const at = [-1, 0, 1].map((dy) => new Date(todayMel.getFullYear() + dy, MON.indexOf(m), Number(d)))
      .sort((a, b) => Math.abs(a - todayMel) - Math.abs(b - todayMel))[0];
    return { l, t: at.getTime(), past: at <= todayMel };
  });
  const inOrder = (ds) => {
    const past = ds.filter((x) => x.past), next = ds.filter((x) => !x.past);
    return ds.slice(0, past.length).every((x) => x.past)
      && past.every((x, i) => i === 0 || past[i - 1].t >= x.t)
      && next.every((x, i) => i === 0 || next[i - 1].t <= x.t);
  };
  const pDates = dated(pb);
  check(`ret-r12: the parent\u2019s lines read in one order — what happened, newest first, then what is coming, soonest first (${pDates.map((x) => x.l).join(', ')})`,
    [pDates.length >= 3, pDates.some((x) => x.past) && pDates.some((x) => !x.past), inOrder(pDates)], [true, true, true]);

  const sixteen = block(text((await get('/home', ids.children.nate.child_id)).html));
  const sDates = dated(sixteen);
  check(`ret-r12b: and the same order on a 16\u201317\u2019s own card (${sDates.map((x) => x.l).join(', ')})`,
    [sDates.length >= 2, inOrder(sDates)], [true, true]);
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
  // D-163: with billing off (the launch configuration) her home says nothing
  // about money — no plan, no price, no dunning card.
  {
    const off = [(await get('/home', pat)).html, (await get('/home', robyn)).html];
    check('free-r6: with billing off an administrator’s home shows no plan and no price',
      [has(off[0], '$54 a month'), off[0].includes('/club/billing'), has(off[0], 'next charge')], [false, false, false]);
    check('free-r6b: and the club whose card once failed is not told about it',
      has(off[1], 'We couldn’t take your payment'), false);
  }
  // The block below is the Stripe build: its plan card and its dunning card.
  await billingSwitch(true);
  const a = await get('/home', pat);
  const t = text(a.html);

  check('ah1: the hero carries the numbers an administrator IS entitled to',
    has(a.html, 'Squads you run') && has(a.html, 'Trials live') && has(a.html, 'Coaching roles open'), true);
  check('ah1b: and not one of them is a registration or a child',
    /On your register|Shortlisted|Invited|new on the register/.test(a.html), false);
  check('ah2: it says whose the register is, and what is hers',
    [has(a.html, 'You keep the club’s page, its squads, its notices.'), /its plan/.test(a.html)], [true, false]);
  // Spec A, "Suites that will move": the one glow adds .fl-glow to the
  // primary, so the exact class string is read as its prefix. The count of
  // exactly one is unchanged.
  check('ah3: there is exactly one accent action on the screen',
    (a.html.match(/class="btn btn-primary[^"]*"/g) ?? []).length, 1);
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

  const numerals = [...r.html.matchAll(/class="[^"]*\bnumeral-[lms]\b[^"]*"[^>]*>([^<]*)</g)].map((m) => m[1].trim());
  check(`ah12: no count on her screen is the digit zero (D-162) (${numerals.join(',') || 'no numerals at all'})`,
    numerals.filter((n) => n === '0').length, 0);
  check('ah12b: and the hero is omitted rather than drawn with nothing in it',
    has(r.html, 'Squads you run'), false);
  check('ah12c: an empty board says its absence in words, which is the opposite fault',
    has(r.html, 'No trials coming up. Post one and it goes on your club page and the trials board the same minute.'), true);

  const td = await get('/home', ids.people.marina);
  // Spec A (TD, "Done when" 1, BUZ 1 Oct): her six centred grey menu cards
  // are ONE door list with the same hrefs and labels, so "her rail" is read
  // as that list rather than as five centred cards — and no centred card is
  // left (ah4's measure, now 0 on every home).
  const tdDoors = (/<div class="card rows doors">([\s\S]*?)<\/div>/.exec(td.html.replace(/<!-- -->/g, ''))?.[1] ?? '');
  check('ah13: the technical director keeps her register row and her rail, as one door list',
    [has(td.html, 'On your register'),
     [...tdDoors.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]),
     menuCards(td.html)],
    [true, ['/club/post-trial', '/club/squads', '/club/page-edit', '/club/roles', '/fc/riverside-fc', '/club/billing'], 0]);
  check('ah13b: and does not get the administrator’s blocks',
    [has(td.html, 'Who can do what here'), has(td.html, 'What a family cannot see yet')], [false, false]);
  await billingSwitch(false);
}

// D-162 across every count on the two homes and on billing: no rendered
// numeral is a zero, on any seat.
{
  for (const [who, id] of [['a parent', ids.people.alex], ['an adult player', ids.people.jordan],
                           ['a 16–17', ids.children.nate.child_id], ['a coach', ids.people.sam],
                           ['a club TD', ids.people.marina], ['an administrator', ids.people.pat],
                           ['an unverified club', ids.people['m.']]]) {
    const html = (await get('/home', id)).html;
    const zeros = [...html.matchAll(/class="[^"]*\bnumeral-[lms]\b[^"]*"[^>]*>([^<]*)</g)].map((m) => m[1].trim())
      .filter((n) => n === '0');
    check(`z1: /home for ${who} renders no count as the digit zero (D-162)`, zeros.length, 0);
  }
  await billingSwitch(true);   // the plan screen exists only with billing on (D-163)
  const bill = (await get('/club/billing', ids.people.marina)).html;
  await billingSwitch(false);
  const zeros = [...bill.matchAll(/class="[^"]*\bnumeral-[lms]\b[^"]*"[^>]*>([^<]*)</g)].map((m) => m[1].trim()).filter((n) => n === '0');
  check('z2: and /club/billing renders no count at all, let alone a zero',
    [has(bill, 'The Interest Register'), zeros.length], [true, 0]);
}

// D-162 on the three screens it was still broken on after the first pass —
// found by verifying a merged breakpoint change at tablet width, and by the
// provenance seat, which fixed zeros only in its own files.
{
  const td = ids.people.marina;
  // z3 is STRUCTURAL, and says so (L33). The fresh seed has no squad with any
  // registration or player at all, so the "0 playing" case only appears after
  // other suites have written data — a rendered check here passed on the OLD
  // code, which means it could never fail (L19). So this asserts the property
  // in the source: each figure is guarded by its own count, and neither can be
  // printed when it is zero. The rendered half still runs, for whenever the
  // fixture does produce the case.
  const squadsSrc = readFileSync(fileURLToPath(new URL('../app/club/squads/page.tsx', import.meta.url)), 'utf8');
  const guarded = /s\.registrations > 0 \? `\$\{s\.registrations\} registered`/.test(squadsSrc)
    && /s\.players > 0 \? `\$\{s\.players\} playing`/.test(squadsSrc);
  const squads = text((await get('/club/squads', td)).html).join('\n');
  check('z3: /club/squads guards each count by its own value, so neither prints as zero (was "0 playing" on ten of eleven)',
    [guarded, /(^|[^0-9])0 (playing|registered)\b/.test(squads)], [true, false]);

  const board = (await get('/trials', null)).html;
  const chipZeros = [...board.matchAll(/class="chip-count"[^>]*>\s*0\s*</g)].length;
  check('z4: /trials offers no filter chip whose count is zero (was "Men 0", "Women 0")', chipZeros, 0);

  const squadIds = [...(await get('/club/squads', td)).html.matchAll(/href="\/club\/squads\/([0-9a-f-]{36})"/g)].map((m) => m[1]);
  let tileZeros = 0, saidInWords = 0;
  for (const id of [...new Set(squadIds)]) {
    const h = (await get(`/club/squads/${id}`, td)).html;
    tileZeros += [...h.matchAll(/class="tnum"[^>]*>\s*0\s*</g)].length;
    if (/No [a-z]+ yet/.test(text(h).join('\n'))) saidInWords++;
  }
  // z5/z5b are STRUCTURAL as well as rendered, and say so (L33, L19). The seed
  // has ONE squad with players, and every position group in it is populated
  // (1, 10, 18, 11, 7) — so the case this tile exists for, a squad with players
  // and NO KEEPER, never occurs on a fresh seed. A rendered check passes on the
  // fixed code only because there is nothing to find. So the source is checked
  // for the property: the zero branch says the absence in words, and the digit
  // is drawn only when the group has somebody in it.
  const squadPageSrc = readFileSync(fileURLToPath(new URL('../app/club/squads/[squadId]/page.tsx', import.meta.url)), 'utf8');
  const digitOnlyWhenPopulated = /byGroup\(g\)\.length > 0 \?/.test(squadPageSrc);
  const absenceInWords = /No \{one\.toLowerCase\(\)\} yet/.test(squadPageSrc);
  check('z5: no squad page draws an empty position group as the digit zero',
    [digitOnlyWhenPopulated, tileZeros], [true, 0]);
  check('z5b: and an empty group is still SAID — the fact of absence stays, in words',
    absenceInWords, true);
}

// ---------------------------------------------------------------------------
// The child's waiting screen (BUZ, 29 Sep: "approve 1 and 2"). Under D-17 an
// under-16 has a first name, a date of birth and a parent's contact until the
// parent says yes; the CV is built after approval, never before. The design's
// words promised a built page, a photo and clips that do not exist, and a
// "What you made" card to keep editing. wait-r1 fails if any of that comes
// back, in the text a person reads and in the tab title.
// ---------------------------------------------------------------------------
{
  const w = await get(`/join/waiting/${ids.pendingInvitation}`, null);
  const lines = text(w.html);
  const all = lines.join(' ');
  const PROMISE = /\b(photo|photos|clip|clips|built|build it|keep editing|what you made|everything you(’|')ve made|is saved)\b|your page is/i;
  check(`wait-r1: the waiting screen promises no page, photo or clips before a parent approves (${PROMISE.exec(all)?.[0] ?? 'none'})`,
    [w.status, PROMISE.test(all)], [200, false]);
  check('wait-r2: and says what BUZ approved — the title, the heading, the body and the fourteen days',
    [/<title>Waiting for your parent · Pitch Football<\/title>/.test(w.html), lines.includes('One person to go.'),
     all.includes('We’ve asked your parent to approve your page. Until they say yes, nothing about you is on Pitch — not for clubs, not for coaches, not for us.'),
     all.includes('If nobody approves within 14 days , we delete what you told us. You can start again any time.')
       || all.includes('If nobody approves within 14 days, we delete what you told us. You can start again any time.'),
     lines.includes('Honestly? Just go and ask them.')],
    [true, true, true, true, true]);
}

// ---------------------------------------------------------------------------
// "Verify for {club}" (D-160; BUZ's words, 29 Sep; 0122). Deniz's CV opened
// from the U15 squad: the squad's coach and the TD are offered the button on
// each self-reported number the page shows, naming the club; the number on
// the button is a number on the page; and the administrator, who reads no
// record at all (D-93), has no page to be offered it on.
// ---------------------------------------------------------------------------
{
  const deniz = ids.children.deniz.child_id;
  let denizCv = null;
  for (const id of new Set([...(await get('/club/squads', ids.people.marina)).html.matchAll(/href="\/club\/squads\/([0-9a-f-]{36})"/g)].map((m) => m[1]))) {
    if ((await get(`/club/squads/${id}`, ids.people.marina)).html.includes(`/cv/${deniz}`)) { denizCv = `/club/squads/${id}/cv/${deniz}`; break; }
  }
  const offers = (html) => [...html.matchAll(/<form[^>]*>(?:(?!<\/form>)[\s\S])*?<\/form>/g)].map((m) => m[0])
    .filter((f) => />Verify for /.test(f))
    .map((f) => ({ club: text(f).find((l) => l.startsWith('Verify for ')), value: text(f).find((l) => /^\d+$/.test(l)) }));
  const samPage = denizCv ? await get(denizCv, ids.people.sam) : { status: 0, html: '' };
  const got = offers(samPage.html);
  const tiles = text(samPage.html.split('>Verify for ').at(-1) ?? '');
  check(`vfy-r1: the squad\u2019s WWCC-attested coach opening Deniz\u2019s CV from the squad is offered "Verify for Riverside FC" on numbers the page shows (${got.map((o) => o.value).join(', ') || 'none'})`,
    [samPage.status, got.length > 0, got.every((o) => o.club === 'Verify for Riverside FC'), got.every((o) => tiles.includes(o.value))],
    [200, true, true, true]);
  // The TD reads the page (D-93) but holds the pen only with a Working With
  // Children Check a club attested (0015, fn_is_verified_adult) — the seed
  // attests Sam's and not Marina's, so she is offered nothing. The button is
  // the database's answer, not the role's name.
  const tdPage = denizCv ? await get(denizCv, ids.people.marina) : { status: 0, html: '' };
  check('vfy-r1b: the technical director, with no attested check in the seed, reads the CV and is offered no button', [tdPage.status, offers(tdPage.html).length], [200, 0]);
  const admin = denizCv ? await get(denizCv, ids.people.pat) : { status: 0, html: '' };
  check('vfy-r2: the club\u2019s administrator has no such page, so no button (D-93)', [admin.status, /Verify for /.test(admin.html)], [404, false]);
}

// ---------------------------------------------------------------------------
// THE FAILURE PATH (28 Sep). Until today there was no app/not-found.tsx and no
// app/error.tsx, so 52 notFound() call sites across 33 route files and every
// uncaught render error served Next's stock page — white, system font, no
// Pitch mark, no way back, and the tab still reading "every season on the
// record." These checks are written against the property, not the words: every
// string on those pages is a proposal awaiting BUZ, so nothing below asserts a
// sentence it does not have to.
//
// HOW A ROUTE'S 404 ARRIVES, because it changes what a fetch can see. An
// unmatched URL is server-rendered: the markup is in the HTML. A notFound()
// thrown INSIDE a route is thrown after the shell has flushed, so React
// delivers the page as an RSC payload inside <script> and paints it on the
// client — the HTML body is empty and the words are in the payload. Measured
// on both the dev server and a production build (`next build && next start`);
// it is the same either way. So `prose()` below reads the whole document.
// What a person actually SEES for these is measured in real Chrome by
// scripts/layout-check.mjs, which is also where "not the stock white" is
// asserted, because a colour needs a browser to be a fact.
// ---------------------------------------------------------------------------
{
  /**
   * Every sentence the page BODY carries, wherever it carries it. The head is
   * dropped: route segments set their own metadata and it survives into their
   * 404 (/club/register/cv sets robots noindex,nofollow; /c/[slug] has its own
   * opengraph-image), so two families differ in the head while showing the
   * same page. That is not an existence oracle — it tells you the route you
   * typed, not whether anything was there — but it is reported as a finding.
   */
  const prose = (html) => {
    // Dev-only <template> error metadata holds a stack trace that names the
    // component which threw — different per route, and absent in production.
    const body = html.replace(/<head[\s\S]*?<\/head>/, ' ').replace(/<template[\s\S]*?<\/template>/g, ' ');
    const hits = new Set();
    for (const m of body.matchAll(/[A-Za-z][A-Za-z0-9 ,.'’—–:;()&!?-]{14,}/g)) {
      const t = m[0].replace(/\s+/g, ' ').trim();
      if (/node:|_next|self\.__next|function |\.js|http|localhost|[0-9a-f]{12}/.test(t)) continue;
      if (!/ [a-z]/.test(t)) continue;   // a sentence has a space in it; a nonce, a uuid and a slug do not
      hits.add(t);
    }
    return [...hits].sort();
  };
  const HEADING = 'This page isn’t here';
  const HOME = 'Go to the start';
  // The four sentences the 404 is made of. Both sides of every pair below must
  // carry all four, so "identical" cannot be satisfied by two empty pages.
  const HEADING_SET = [HEADING, HOME,
    'The address may be wrong, or what was here may have been taken down.',
    'We don’t say whether something was here and has gone, or was never here at all. The answer is the same either way, so a wrong address can’t be used to find out who is on Pitch.'];

  // ---- a mistyped URL -------------------------------------------------------
  const typo = await get('/no-such-page');
  check('fp1: a mistyped URL answers 404 on a page of ours, not Next’s stock one',
    [typo.status, /next-error-h1|This page could not be found/.test(typo.html)], [404, false]);
  // The way back is /home, not /: before launch / is the waitlist page and has
  // no door into the product, so a signed-in person sent there was stranded
  // with no sign-out. /home carries the console shell, and sign-out with it.
  check('fp2: it carries a heading, the Pitch mark and a way back to the seat\u2019s home',
    [/<h1[^>]*>[^<]/.test(typo.html), typo.html.includes('data-failure="not-found"'), has(typo.html, HEADING), /TCH/.test(typo.html), /<a href="\/home" class="btn btn-primary[^"]*">/.test(typo.html) && has(typo.html, HOME)],
    [true, true, true, true, true]);
  check('fp3: and a title of its own — not the landing page’s line',
    /<title[^>]*>([^<]*)<\/title>/.exec(typo.html)?.[1], 'Page not found · Pitch Football');
  check('fp4: the dark page is the only page — nothing forces a white body',
    /<style[^>]*>[^<]*background:\s*#fff/.test(typo.html), false);

  // ---- a notFound() from inside a route ------------------------------------
  for (const [what, path] of [['a dead club slug', '/fc/no-such-club'], ['a dead coach slug', '/c/no-such-coach'],
    ['an expired job link', '/jobs/00000000-0000-0000-0000-000000000000']]) {
    const r = await get(path);
    check(`fp5: ${what} answers 404 with our page, not Next’s`,
      [r.status, prose(r.html).includes(HEADING), /next-error-h1|This page could not be found/.test(r.html)],
      [404, true, false]);
  }

  // ---- the oracle, which is the one thing here that could make us less safe -
  // A 404 must not answer differently depending on WHAT was missing. Next
  // hands not-found.tsx no props, so the page cannot know — and these prove
  // the property rather than the argument. The paused-registrant half of it
  // needs somebody to press pause, so it lives in the write suite (p19g).
  {
    // The register's CV page sends a stranger to /signin before it looks
    // anything up, so the pair that matters there is read as the club's own
    // technical director — the seat that would be doing the probing.
    const pairs = [
      ['two dead club slugs', '/fc/no-such-club', '/fc/another-dead-club', null],
      ['two dead job links', '/jobs/00000000-0000-0000-0000-000000000000', '/jobs/11111111-1111-1111-1111-111111111111', null],
      ['a dead club slug and a dead job link', '/fc/no-such-club', '/jobs/00000000-0000-0000-0000-000000000000', null],
      ['a dead club slug and a registration nobody may read', '/fc/no-such-club', '/club/register/cv/00000000-0000-0000-0000-000000000000', ids.people.marina],
    ];
    for (const [what, a, b, who] of pairs) {
      const ra = await get(a, who); const rb = await get(b, who);
      const title = (h) => /<title[^>]*>([^<]*)<\/title>/.exec(h)?.[1];
      const pa = prose(ra.html); const pb = prose(rb.html);
      // A route's own robots directive rides along in its flight payload, so
      // /club/register/cv's "noindex, nofollow" shows up beside Next's
      // automatic "noindex" on a 404. It says which route you typed, which you
      // already know, and nothing about whether anything was there — so it is
      // allowed through by name rather than by widening the comparison.
      const METADATA = /^(no)?index[, ]/;
      const diff = [...pa.filter((x) => !pb.includes(x)), ...pb.filter((x) => !pa.includes(x))].filter((x) => !METADATA.test(x));
      check(`fp6: ${what} answer identically — same status, same title, same words${diff.length ? ` (differs: ${diff.join(' / ')})` : ''}`,
        [ra.status === rb.status, title(ra.html) === title(rb.html), diff.length,
          HEADING_SET.every((x) => pa.includes(x) && pb.includes(x))], [true, true, 0, true]);
    }
  }
  // Timing, on the same terms as doc 14 E10: a test, not a hope. Reported as
  // numbers either way, because the interesting failure is a slow one.
  {
    const ms = async (path) => { const t = process.hrtime.bigint(); await get(path); return Number(process.hrtime.bigint() - t) / 1e6; };
    const median = (xs) => xs.slice().sort((x, y) => x - y)[Math.floor(xs.length / 2)];
    const runs = 9;
    const a = []; const b = [];
    for (let i = 0; i < runs; i++) { a.push(await ms('/fc/no-such-club')); b.push(await ms('/fc/another-dead-club')); }
    const [ma, mb] = [median(a), median(b)];
    check(`fp7: and indistinguishably fast — ${ma.toFixed(0)}ms vs ${mb.toFixed(0)}ms over ${runs} runs`,
      Math.abs(ma - mb) < Math.max(40, 0.5 * Math.min(ma, mb)), true);
  }

  // ---- the 500 --------------------------------------------------------------
  // /dev/boom throws on purpose and is notFound() in production, exactly as
  // /design and /dev/outbox are. app/error.tsx is a Client Component (Next
  // requires it), so its markup is in a JS chunk rather than the document —
  // what a fetch can prove is the status and that the stock page is gone.
  {
    const boom = await get('/dev/boom');
    check('fp8: a route that throws answers 500, and not with Next’s stock page',
      [boom.status, /next-error-h1|A server error occurred|This page couldn’t load|Application error: a client-side exception/.test(boom.html)], [500, false]);
  }

  // ---- a refused sign-in ----------------------------------------------------
  // D-94 §2 wants the response identical whether or not the account exists, not
  // silent. signIn() used to redirect('/home') on every path, so a wrong
  // password landed on "Welcome back / One account, whichever seat you hold."
  // The refusal is DRIVEN for real in the write suite (sr1–sr4); here it is
  // the page that is checked.
  {
    const REFUSED = 'That didn’t work. Check the email address and the password and try again.';
    const refused = await get('/signin?refused=1');
    check('fp9: a refused sign-in has one line, the same line for every cause',
      [refused.status, has(refused.html, REFUSED), /role="alert"/.test(refused.html)], [200, true, true]);
    check('fp10: and it is on the sign-in page, not on "Welcome back"',
      has((await get('/home')).html, REFUSED), false);
  }
  // 30 Sep: clubs could not sign up — production had nothing to claim and no
  // way to find anything. Find your club, and "Tell us your club" (0159).
  {
    const find = await get('/claim');
    check('fyc-r1: /claim is Find your club, with a search by club name or suburb, and no account needed to search',
      [find.status, has(find.html, 'Find your club'), /placeholder="Club name or suburb"/.test(find.html)], [200, true, true]);
    const hit = await get('/claim?q=Riverside');
    check('fyc-r2: a claimed club is found and says so, with no Claim button for it',
      [has(hit.html, 'Riverside FC'), has(hit.html, 'Already claimed'), /href="\/claim\/riverside-fc"/.test(hit.html)], [true, true, false]);
    const miss = await get('/claim?q=Zzqxw');
    check('fyc-r3: nothing found says so, and a signed-out visitor is asked to sign in before telling us a club',
      [has(miss.html, 'We couldn’t find'), has(miss.html, 'Not here? Tell us your club'), has(miss.html, 'Sign in to tell us your club'), /name="email"/.test(miss.html)],
      [true, true, true, false]);
    const signedIn = await get('/claim?q=Zzqxw', ids.people.robin);
    check('fyc-r4: signed in, the ask form takes the club’s name, suburb, state and its own email address',
      [/name="name"/.test(signedIn.html), /name="suburb"/.test(signedIn.html), /name="state"/.test(signedIn.html), /name="email"/.test(signedIn.html),
       has(signedIn.html, 'The club’s own address, the one on its website. We send the claim code there.')], [true, true, true, true, true]);
    const home = await get('/home', ids.people.robin);
    check('fyc-r5: a brand-new account’s home offers Find your club, and no longer says claiming is not on this screen',
      [/href="\/claim"/.test(home.html), has(home.html, 'Here for a club? Find your club'), has(home.html, 'claiming a club page')], [true, true, false]);
  }
  // Rehearsal, 30 Sep: the confirm email passed SPF, DKIM and DMARC and still
  // landed in Gmail's spam, because the sending domain is new. The screen a
  // new account waits on says where to look (BUZ approved the sentence).
  {
    const joined = await get('/signin?joined=1');
    check('fp-spam1: after joining, the page says to look in spam or junk (a new sending domain, rehearsal 30 Sep)',
      [joined.status, has(joined.html, 'If it isn’t in your inbox, look in spam or junk — we’re new, and some inboxes don’t know us yet.')], [200, true]);
  }

  // ---- the screen after reporting a concern about a child -------------------
  {
    const done = await get('/report?done=1');
    const t = text(done.html);
    const iUrgent = t.findIndex((l) => l.includes('contact your local police first'));
    const iThanks = t.findIndex((l) => l.includes('a person will look at it'));
    check('fp11: /report?done=1 has a real heading, so a screen reader announces one',
      /<h1[^>]*>We’ve received your report<\/h1>/.test(done.html), true);
    check('fp12: the emergency line is ABOVE the thanks, and not in the faintest style',
      [iUrgent !== -1, iThanks !== -1, iUrgent < iThanks], [true, true, true]);
    check('fp13: and the tab no longer says "Report this page"',
      /<title[^>]*>([^<]*)<\/title>/.exec(done.html)?.[1], 'Report received · Pitch Football');
  }

  // ---- the page this one was modelled on -----------------------------------
  {
    const dead = await get('/p/dev-expired');
    check('fp14: the D-77 dead-link page carries the Pitch mark and a primary action',
      [/TCH/.test(dead.html), /class="btn btn-primary"[^>]*>Ask the family/.test(dead.html)], [true, true]);
  }
}

// ===========================================================================
// FINAL ROUND B (28 Sep) — the four launch calls (D-164) and coach-verified
// stats (D-160), read off what the product serves.
// ===========================================================================

// ---- D-164 (1): the front door, behind the launch-day switch (0080) ---------
// "With the switch off, `/` is byte-for-byte today's page." Today's page was
// measured on the dev server at ec1a03a, before the front door existed:
// nonces are per-request and every <script>/<link> names a build chunk that
// moves with any edit anywhere, so those are set aside; every other byte of
// the document — head, metadata, body — is hashed. If the coming-soon page
// is ever changed on purpose, this hash is re-pinned in the same commit, and
// the failure prints the new one.
{
  const COMING_SOON_SHA256 = '2babb787d72b63796c7a38b0a3f695f1bb1885483c583bec498aaef2928fd2c6';
  const { createHash } = await import('node:crypto');
  const doc = (html) => html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<link\b[^>]*\/?>/g, '')
    .replace(/ nonce="[^"]*"/g, '');
  const sha = (html) => createHash('sha256').update(doc(html)).digest('hex');
  async function frontDoorSwitch(on) {
    const r = await fetch(`${BASE}/dev/front-door?on=${on ? 1 : 0}`, { method: 'POST' });
    const j = r.ok ? await r.json() : null;
    if (j?.frontDoor !== on) throw new Error(`the front-door switch did not turn ${on ? 'on' : 'off'} (${r.status})`);
  }
  await frontDoorSwitch(false);
  const off = await get('/');
  const offSha = sha(off.html);
  check(`fd0: with the switch off, / is today's coming-soon page byte for byte (nonces and build chunks aside) — ${offSha}`,
    [off.status, offSha], [200, COMING_SOON_SHA256]);
  check('fd0b: and a direct request for /front-door is sent back to / (one address)',
    [(await get('/front-door?for=club')).status, (await get('/front-door?for=club')).location?.replace(BASE, '')], [307, '/?for=club']);

  await frontDoorSwitch(true);
  try {
    const pages = { '/': null, '/?for=player': 'For players · 18 and over', '/?for=parent': 'For parents',
      '/?for=coach': 'For coaches', '/?for=club': 'For clubs & technical directors' };
    const served = {};
    for (const [path, kicker] of Object.entries(pages)) served[path] = await get(path);
    check('fd1: with it on, / is the front door — the chooser and the four landings, each at /',
      Object.entries(pages).map(([path, kicker]) => [served[path].status,
        kicker ? has(served[path].html, kicker) : has(served[path].html, 'Who are you?')]),
      Object.keys(pages).map(() => [200, true]));
    check('fd1b: and none of them is the coming-soon page any more',
      Object.values(served).some((r) => sha(r.html) === COMING_SOON_SHA256), false);

    // Every link resolves — the ways in (sign up, trials, claim, sign in) and
    // the doors between the landings.
    const hrefs = new Set();
    for (const r of Object.values(served)) {
      for (const m of r.html.matchAll(/href="(\/[^"#]*)"/g)) {
        const h = m[1].replace(/&amp;/g, '&');
        if (h.startsWith('/_next') || h.startsWith('/assets') || /\.(png|svg|ico|webmanifest)$/.test(h)) continue;
        hrefs.add(h);
      }
    }
    const dead = [];
    for (const h of hrefs) { const r = await get(h); if (r.status !== 200) dead.push(`${r.status} ${h}`); }
    check(`fd2: every link on the front door resolves (${[...hrefs].sort().join(' ')})${dead.length ? ' — DEAD: ' + dead.join(', ') : ''}`,
      [hrefs.size >= 7, dead], [true, []]);
    check('fd2b: the ways in are there — find your club, sign up, trials without an account, sign in, and all four landings',
      ['/join', '/trials', '/signin', '/claim', '/?for=player', '/?for=parent', '/?for=coach', '/?for=club'].every((h) => hrefs.has(h)), true);
    // BUZ, 29 Sep ("recommended on all"): the parent's row says what a parent
    // does, in /join's approved chip words. BUZ, 1 Oct (D-173): every persona
    // has its own way in, so it now opens the parent's landing, whose button
    // is the way to /join.
    const parentRow = /<a[^>]*href="([^"]*)"[^>]*>(?:(?!<\/a>)[\s\S])*?A parent(?:(?!<\/a>)[\s\S])*?<\/a>/.exec(served['/'].html);
    check('fd2c: the chooser\u2019s parent row reads "Approve and see their record" and leads to the parent\u2019s own landing',
      [parentRow?.[1]?.replace(/&amp;/g, '&') ?? null, parentRow ? text(parentRow[0]).includes('Approve and see their record') : false,
       has(served['/'].html, 'Set up and control your child’s profile')], ['/?for=parent', true, false]);

    // No price, and none of D-163's retired phrases, on any of the five.
    // BUZ, 1 Oct: "For clubs · free" — free said bare is allowed on the
    // front door (the 28 Sep rule: say free bare, never with an end date or a
    // condition). "Free at launch", "free until…" and "free for now" stay barred.
    const retired = [];
    for (const [path, r] of Object.entries(served)) {
      for (const line of text(r.html)) {
        const m = /\$\s?\d|\bfree (at|until|for)\b|at launch|for now|\blimited\b|first (eleven|\d+) clubs|Founding XI|December|inc GST|a month|\/yr|\bPro\b/i.exec(line);
        if (m) retired.push(`${path}: ${line.slice(0, 70)}`);
      }
    }
    check(`fd3: no price renders on the front door, and no line D-163 retired (${retired.join(' | ') || 'none'})`, retired, []);

    // Round E: the one page meant to rank (doc 29 §7) must be words in the
    // document itself — what a crawler, or a slow phone before its scripts
    // arrive, is given. Read from the markup with every script removed, so
    // text that only exists in Next's payload for the browser to build later
    // does not count. Asked twice: as a browser and as a crawler, because
    // Next treats the two differently (it streams metadata for one and not
    // the other).
    const TITLES = { player: 'A player', parent: 'A parent', coach: 'A coach', club: 'A club' };
    const crawler = await (await fetch(`${BASE}/`, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' } })).text();
    const asHtml = (html) => {
      const markup = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, '');
      const h1 = text(/<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(markup)?.[1] ?? '').join(' ');
      return [h1, ...Object.entries(TITLES).map(([seat, title]) =>
        // Every persona opens its own landing (BUZ, 1 Oct, D-173).
        text(new RegExp(`<a\\b[^>]*href="/\\?for=${seat}"[^>]*>([\\s\\S]*?)</a>`).exec(markup)?.[1] ?? '').includes(title))];
    };
    // The heading is club-first (D-173): clubs are the one audience (BUZ, 28 Sep).
    const want = ['Your club’s page might already be built.', true, true, true, true];
    check('fd5: with the switch on, / serves its club-first heading and the four ways in (player, parent, coach, club) as HTML text, to a browser and to a crawler, before any script runs',
      [asHtml(served['/'].html), asHtml(crawler)], [want, want]);
  } finally {
    await frontDoorSwitch(false);
  }
  const back = await get('/');
  check('fd4: turned off again, / is today\'s page again, byte for byte', sha(back.html), COMING_SOON_SHA256);
}

// ---- D-164 (2) / D-84: the CV states its context ------------------------------
{
  const deniz = await get('/p/dev-deniz');
  const nate = await get('/p/dev-nate');
  const jordan = await get('/p/dev-jordan');
  const underName = (html, name, line) => {
    const t = text(html);
    const i = t.indexOf(line);
    // React writes "First Last" as two text nodes, so the line above the
    // marker is the surname.
    return i > 0 && name.endsWith(t[i - 1]);
  };
  check('ctx-r1: a stranger with the link reads the age group and the birth quarter, directly under the name',
    [underName(deniz.html, 'Deniz Yılmaz', 'U15 · born Jan–Mar'), underName(nate.html, 'Nate Halloran', 'U18 · born Apr–Jun')], [true, true]);
  check('ctx-r2: and never a date of birth, a year of birth or an exact age (Deniz 14 Mar 2012, Nate 2 Jun 2009)',
    [deniz, nate].map((r) => /2012|2009|14 Mar|2 Jun|\b1[4-7] years|\baged? 1\d/.test(text(r.html).join(' '))), [false, false]);
  check('ctx-r3: an adult in a senior side gets no marker — "U" and a number, or nothing (no guess)',
    has(jordan.html, 'born '), false);
  // D-89: the social card and the unfurl carry neither the band nor the quarter.
  const meta = (html) => [...html.matchAll(/<meta (?:name|property)="(?:og|twitter):[^"]*" content="([^"]*)"/g)].map((m) => m[1]).join(' | ');
  check('ctx-r4: the link preview a platform caches (og:/twitter: tags) carries no age group and no quarter',
    [deniz, nate].map((r) => /born|U1\d|Jan–Mar|Apr–Jun/.test(meta(r.html))), [false, false]);
  const og = await fetch(`${BASE}/p/dev-deniz/opengraph-image`);
  check('ctx-r5: and the Open Graph image still renders (its source reads no quarter — permission suite ctx4)',
    [og.status, (og.headers.get('content-type') ?? '').startsWith('image/')], [200, true]);
}

// ---- D-174 (0165): a CV in its club's colours, and the ones that must not be
// John's condition 4: the CV watched with and without a club's colours before
// CV_WEARS_CLUB_COLOURS was turned on. The seed gives Riverside "Sky blue and
// navy" (its own pick, condition 1); Northern United, Nate's club, picked
// none; Thornbeck Thunder SC holds "Purple and gold" but failed a later call
// and is only claimed again (0150), so Teodor's CV must wear none of it. What
// PlayerCV draws for a theme is the hero's colour in the card's background and
// --cv-lead (the first position chip, the map's marker) set to the trim; with
// no theme it is Pitch's own hero (#2a6a49) and green.
{
  const { clubTheme, PRESETS } = await import('../lib/club-colours.ts');
  const pair = (name) => PRESETS.find((p) => p.name === name);
  const sky = clubTheme(pair('Sky blue and navy'), 'verified');
  const purple = clubTheme(pair('Purple and gold'), 'verified');
  // Only the card's own markup: Next's flight data repeats every style once
  // more inside a <script>, and the question is what the page draws.
  const markup = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ');
  const hero = (html) => /<section class="cv-hero[^"]*" style="([^"]*)"/.exec(markup(html))?.[1] ?? null;
  const wears = (html, t) => {
    const s = hero(html) ?? '';
    return [s.includes(`${t.hero} 0%`), s.includes(`--cv-lead:${t.trim}`)];
  };
  const plain = (html) => {
    const s = hero(html) ?? '';
    return [s.includes('#2a6a49 0%'), s.includes('--cv-lead:#3ddc84')];
  };
  const hexes = (t, p) => [t.hero, t.heroDeep, t.trim, p.primary, p.secondary];
  const anyOf = (html, list) => list.filter((h) => markup(html).toLowerCase().includes(h));

  const deniz = await get('/p/dev-deniz');
  check('cvcol-r1: a stranger with the link sees Deniz’s CV in Riverside’s own colours — the hero in its blue, the lead in its trim, not Pitch green',
    [deniz.status, wears(deniz.html, sky), plain(deniz.html)], [200, [true, true], [false, false]]);
  const nate = await get('/p/dev-nate');
  check('cvcol-r2: a verified club that chose no colours leaves its player’s CV in Pitch’s own hero and green',
    [nate.status, plain(nate.html), anyOf(nate.html, hexes(sky, pair('Sky blue and navy')))], [200, [true, true], []]);
  const teodor = await get('/p/dev-teodor');
  check('cvcol-r3: a club that is claimed but not verified lends its player’s CV nothing — no hero, no trim, not one of its colours anywhere in the page',
    [teodor.status, has(teodor.html, 'Thornbeck Thunder SC'), plain(teodor.html), anyOf(teodor.html, hexes(purple, pair('Purple and gold')))],
    [200, true, [true, true], []]);

  // The three other CV surfaces hand PlayerCV the same answer: the club's
  // register CV and squad CV (Marina, Riverside's TD) and the family's own
  // preview, which promises "exactly what a club sees".
  const marina = ids.people.marina, alex = ids.people.alex, kid = ids.children.deniz;
  const { html: reg } = await get('/club/register', marina);
  let regCv = null;
  for (const id of new Set([...reg.matchAll(/\/club\/register\/cv\/([a-f0-9-]{36})/g)].map((m) => m[1]))) {
    const r = await get(`/club/register/cv/${id}`, marina);
    if (/<h1 id="cv-name"[^>]*>Deniz<!-- --> <!-- -->Yılmaz<\/h1>|<h1 id="cv-name"[^>]*>Deniz Yılmaz<\/h1>/.test(r.html)) { regCv = r; break; }
  }
  const { html: squads } = await get('/club/squads', marina);
  let squadCv = null;
  for (const sq of new Set([...squads.matchAll(/\/club\/squads\/([a-f0-9-]{36})(?=")/g)].map((m) => m[1]))) {
    const r = await get(`/club/squads/${sq}/cv/${kid.child_id}`, marina);
    if (r.status === 200) { squadCv = r; break; }
  }
  const preview = await get(`/build/${kid.record_id}/preview`, alex);
  check('cvcol-r4: Riverside’s register CV, its squad CV and the family’s preview of Deniz all wear Riverside’s colours, as the link does',
    [regCv && wears(regCv.html, sky), squadCv && wears(squadCv.html, sky), wears(preview.html, sky)],
    [[true, true], [true, true], [true, true]]);

  // D-89: never on a card. The link preview a platform caches carries none of
  // the colours, and neither does the Open Graph image — read pixel by pixel,
  // because an image cannot be read for a string.
  const meta = (html) => [...html.matchAll(/<meta (?:name|property)="(?:og|twitter):[^"]*" content="([^"]*)"/g)].map((m) => m[1]).join(' | ');
  const sharp = (await import('sharp')).default;
  const near = async (png, list) => {
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const rgb = list.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
    let n = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      if (rgb.some(([r, g, b]) => Math.abs(data[i] - r) + Math.abs(data[i + 1] - g) + Math.abs(data[i + 2] - b) <= 12)) n += 1;
    }
    return n;
  };
  const og = await fetch(`${BASE}/p/dev-deniz/opengraph-image`);
  const ogPng = Buffer.from(await og.arrayBuffer());
  // The counter has to be able to fail (L19): a card painted in the trim is
  // found, at every pixel.
  const painted = await sharp({ create: { width: 40, height: 20, channels: 3, background: sky.trim } }).png().toBuffer();
  check('cvcol-r5: Deniz’s link preview and Open Graph image carry none of Riverside’s colours — not one pixel of its hero or trim (D-89)',
    [/#[0-9a-f]{6}/i.test(meta(deniz.html)), og.status, await near(ogPng, [sky.hero, sky.trim]), await near(painted, [sky.hero, sky.trim])],
    [false, 200, 0, 800]);
}

// ---- D-160: a stat opens to where it came from; the CLUB, never the coach ---
{
  const deniz = await get('/p/dev-deniz');
  const sam = ids.people.sam;
  check('prov-r1: a link-holder opening a coach-verified number reads the club and the date',
    /^Verified by Riverside FC · \d{1,2} [A-Z][a-z]{2} \d{4}$/.test(text(deniz.html).find((l) => l.startsWith('Verified by')) ?? ''), true);
  check('prov-r2: and no person — the verifying coach is named nowhere in what the page serves, not even in the flight data',
    [/Kaya/.test(deniz.html), /\bSam\b/.test(text(deniz.html).join(' ')), deniz.html.includes(sam)], [false, false, false]);
  check('prov-r3: a self-reported number opens to the date it was entered',
    text(deniz.html).some((l) => /^Self-reported · entered \d{1,2} [A-Z][a-z]{2} \d{4}$/.test(l)), true);
  check('prov-r4: it opens in place, pushing the page — a checkbox and a well under the row, no dialog and no script to run',
    [/type="checkbox" id="drill-goals"/.test(deniz.html), /id="drill-well-goals"/.test(deniz.html), /role="dialog"|aria-modal/.test(deniz.html)],
    [true, true, false]);
  // A snapshot approved before 0083 has no dates, so its numbers do not open:
  // nothing is drawn rather than a guess.
  const georgia = await get('/p/dev-georgia');
  check('prov-r5: a number with nothing to say does not open (Georgia\'s approved snapshot predates the dates)',
    [/id="drill-/.test(georgia.html), has(georgia.html, 'Self-reported ·')], [false, false]);
}

// ---- D-164 (3) / D-63: the country step, before the date of birth ----------
{
  const join = await get('/join');
  const t = text(join.html);
  check('ctry-r1: /join opens on "Where do you live?" with Australia and Somewhere else',
    [t.includes('Where do you live?'), t.includes('Australia'), t.includes('Somewhere else')], [true, true, true]);
  check('ctry-r2: and asks nothing else first — no name, no date of birth, no email, no form, in what the page serves',
    [/type="date"/.test(join.html), /type="email"/.test(join.html), /<form/.test(join.html), /Date of birth|First name/.test(t.join(' '))],
    [false, false, false, false]);
}

// ---- D-164 (4) / D-82: two Premium rows on an adult's page, never under 18 --
{
  const jordanHome = await get('/home', ids.people.jordan);
  const clipsPath = /href="(\/build\/[0-9a-f-]{36}\/clips)"/.exec(jordanHome.html)?.[1];
  const adultClips = clipsPath ? await get(clipsPath, ids.people.jordan) : { html: '' };
  const coachEdit = await get('/coach/edit', ids.people.sam);
  const rows = (html) => ['Unlimited clips', 'See who viewed your CV', 'Tap a locked feature to be first in line.'].map((s) => has(html, s));
  check('prem-r1: an adult player\'s Highlights carries the two locked rows, each tagged and "Coming soon"',
    [...rows(adultClips.html), (adultClips.html.match(/>Premium</g) ?? []).length, (adultClips.html.match(/>Coming soon</g) ?? []).length],
    [true, true, true, 2, 2]);
  check('prem-r2: and so does an adult coach\'s page', rows(coachEdit.html), [true, true, true]);
  check('prem-r3: at most two rows on a screen, and no price on either', [
    (adultClips.html.match(/name="feature"/g) ?? []).length <= 2,
    (coachEdit.html.match(/name="feature"/g) ?? []).length <= 2,
    [adultClips, coachEdit].some((r) => /\$\s?\d/.test(text(r.html).join(' ')))], [true, true, false]);
  const tapped = clipsPath ? await get(`${clipsPath}?first=1`, ids.people.jordan) : { html: '' };
  check('prem-r4: after a tap the line reads "Premium is coming. You’re first in line."',
    has(tapped.html, 'Premium is coming. You’re first in line.'), true);

  // NEVER UNDER 18. Nate is 16–17: his own Highlights, and the coach page a
  // 16–17 who coaches MiniRoos would open (D-82 names exactly that person).
  const nate = ids.children.nate;
  const minorClips = await get(`/build/${nate.record_id}/clips`, nate.child_id);
  const minorCoach = await get('/coach/edit', nate.child_id);
  const guardianView = await get(`/build/${ids.children.deniz.record_id}/clips`, ids.people.alex);
  const premiumOn = (r) => /Premium|first in line/.test(text(r.html).join(' ')) || /name="feature"/.test(r.html);
  check('prem-r5: a 16–17\'s Highlights, a 16–17 on the coach page, and an under-16\'s Highlights opened by their parent carry none of it',
    [minorClips.status, minorCoach.status, guardianView.status, premiumOn(minorClips), premiumOn(minorCoach), premiumOn(guardianView)],
    [200, 200, 200, false, false, false]);
}

// ---- links that had no page pointing at them (D-164) -------------------------
{
  const westgate = await get('/fc/westgate-rangers');
  check('link-r1: an unclaimed club page carries "Claim it", to /claim/<slug> (D-172 wording, BUZ 30 Sep)',
    /href="\/claim\/westgate-rangers"[^>]*>Claim it</.test(westgate.html), true);
  const riverside = await get('/fc/riverside-fc');
  check('link-r1b: and a verified one does not', /href="\/claim\//.test(riverside.html), false);
  // D-172 (John's six rules, 30 Sep): an unclaimed page Pitch compiled.
  const brind = await get('/fc/brindlewood-rovers-sc');
  // Visible words only: scripts, tags and entities out (the page's own text).
  const bw = brind.html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&rsquo;/g, '\u2019').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  check('U1: an unclaimed page carries no image file of any kind — no crest, logo or photograph',
    // Pitch's own brand files (its app icon) are Pitch's; nothing else may be an image.
    [brind.status, /<img\b/i.test(brind.html),
     (brind.html.replace(/_next\/static[^"]*/g, '').match(/[^" ]*\.(png|jpe?g|webp|gif|svg)(\?[^"]*)?/gi) ?? []).filter((u) => !u.startsWith('/assets/brand/'))],
    [200, false, []]);
  check('U2: no personal name, email address or phone number appears on it — not even the club\u2019s own published address',
    [/[\w.+-]+@[\w-]+\.[\w.]+/.test(bw), /\b0[2-478](\s?\d){8}\b|\+61/.test(bw), /brindlewoodrovers\.example/.test(brind.html)], [false, false, false]);
  check('U3: nothing about a person under 18 — no squad, no team list, no child\u2019s name',
    [/Deniz|Georgia|Mila|Nate/.test(bw), /data-squad|href="\/squad\//.test(brind.html)], [false, false]);
  check('U4: it is kept out of search engines until the club claims it',
    // John asks for both: the meta tag and the served header.
    [/<meta name="robots" content="noindex, nofollow"/.test(brind.html), brind.robots], [true, 'noindex, nofollow']);
  // And it flips when club_state leaves 'unclaimed' — both halves, not only
  // the tag. Riverside and Kingsway were claimed and then verified; no seeded
  // club with a page sits at plain 'claimed', and the proxy's test is the
  // page's own (anything but 'unclaimed'). Riverside is already fetched above.
  const kingsway = await get('/fc/kingsway-rovers');
  check('U4b: a claimed club’s page carries neither the noindex tag nor the header',
    [riverside, kingsway].flatMap((r) => [r.status, /<meta name="robots"/.test(r.html), r.robots]),
    [200, false, null, 200, false, null]);
  const bannerAt = brind.html.indexOf('data-unclaimed-banner');
  check('U5: the banner is there, in body-text size, before anything else on the page is offered',
    [bannerAt > 0, brind.html.replace(/<!-- -->/g, '').includes('Pitch made this page from public information. Brindlewood Rovers SC has not claimed it.'),
     // Before anything the page OFFERS (safety review N2, 1 Oct): the old
     // form, Math.max(indexOf, length), was always the page length, so it
     // could not fail. Pitch's own nav bar sits above the club's name and is
     // not an offer from the club; asked of John in 13-Board-Room.
     /data-unclaimed-banner="" style="font-size:14px/.test(brind.html),
     ['>Trials</h2>', 'Want to play here?', 'This is our club'].map((w) => brind.html.indexOf(w)).filter((i) => i >= 0).every((i) => bannerAt < i)],
    [true, true, true, true]);
  check('U6: the take-it-down door is on the page and needs no account — it is /report',
    [/href="\/report\?page=%2Ffc%2Fbrindlewood-rovers-sc"[^>]*>Ask us to update or remove it</.test(brind.html), (await get('/report?page=%2Ffc%2Fbrindlewood-rovers-sc')).status],
    [true, 200]);
  // John, 30 Sep: a compiled notice shows when it was last checked, and links
  // to the club's own notice — labelled as the club's, opening the club's own
  // page in its own tab, never pulled through Pitch.
  const wg = await get('/fc/westgate-rangers');
  const wgv = wg.html.replace(/<!-- -->/g, '');
  const ownLink = /<a href="https:\/\/westgaterangers\.example\.au\/trials" target="_blank" rel="noopener noreferrer"[^>]*>The club’s own notice<\/a>/;
  check('link-n1: a notice Pitch compiled carries "checked" and a link to the club’s own notice, opening the club’s page',
    [wg.status, /checked \d{1,2} [A-Z][a-z]{2}/.test(wgv), ownLink.test(wgv)], [200, true, true]);
  const board = (await get('/trials')).html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<!-- -->/g, '');
  check('link-n2: the trials board links the same notice to the club’s own page, and a club’s own notice carries no such link',
    [ownLink.test(board), board.split('>Listed ').slice(1).filter((card) => card.includes('On Pitch — verified club') && card.includes('The club’s own notice')).length === 0],
    [true, true]);
  // 0162: an address a listing used to have moves for good to the one it has now.
  const oldFc = await get('/fc/brindlewood-rovers'), oldClaim = await get('/claim/brindlewood-rovers', ids.people.robin);
  check('slug-r1: a club’s former page address moves for good (308) to its address now — the page and its claim screen',
    [oldFc.status, oldFc.location?.endsWith('/fc/brindlewood-rovers-sc'), oldClaim.status, oldClaim.location?.endsWith('/claim/brindlewood-rovers-sc')],
    [308, true, 308, true]);
  // John, 1 Oct (Floodlit cleared on D-172). U1b: Pitch's pitch drawing is
  // generic — byte-identical on every unclaimed page, never derived from the
  // club. U5-nav: Pitch's nav above the banner is furniture only while it stays
  // generic — no club name, no link about this club, no claim.
  const pitchLines = (html) => (html.match(/<svg class="fl-pitch-lines"[\s\S]*?<\/svg>/) ?? [''])[0];
  const other = (await get('/fc/wrenmoor-wanderers-fc')).html;
  check('U1b: the drawn pitch lines are Pitch’s own — identical on two different unclaimed pages',
    [pitchLines(brind.html).length > 0, pitchLines(brind.html) === pitchLines(other)], [true, true]);
  const navOf = (html) => (html.match(/<header class="fl-nav[\s\S]*?<\/header>/) ?? [''])[0].replace(/<!-- -->/g, '');
  check('U5-nav: on an unclaimed page Pitch’s nav names no club, links nowhere about it and offers no claim',
    // "Find your club" (/claim, Pitch's own search) is furniture; a visible
    // "Claim" or a link to THIS club's claim or page is not.
    [navOf(brind.html).length > 0, /Brindlewood/i.test(navOf(brind.html)), /brindlewood-rovers-sc|\/claim\//.test(navOf(brind.html)),
     /\bclaim\b/i.test(navOf(brind.html).replace(/<[^>]*>/g, ' '))],
    [true, false, false, false]);
  // A-P4 (BUZ, 1 Oct, option a): a player's "next trial" is only ever one for
  // their own squad's age group. Jordan (22) and Nate (17) were both shown
  // Riverside's "U14 & U15 Boys trials".
  const nextFor = async (who) => (await get('/home', who)).html.replace(/<!-- -->/g, '').replace(/&amp;/g, '&');
  check('ap4: a player is never shown another age group’s trial as their next trial — Jordan (22) and Nate (17) see no U14 & U15 trial',
    [/U14 & U15 Boys/.test(await nextFor(ids.people.jordan)), /U14 & U15 Boys/.test(await nextFor(ids.people.nate))], [false, false]);
  // BUZ, 1 Oct (walkthrough fix 2): one account of verification on the claim
  // page — the call, to a number we find ourselves; Football Victoria's
  // register and the duplicate "Only the phone call does that" are gone.
  const claimForm = (await get('/claim/westgate-rangers', ids.people.robin)).html.replace(/<!-- -->/g, '');
  check('wt2: the claim page says verification is the phone call, once — never Football Victoria\u2019s register',
    [/Verified status is separate:<\/b> we ring Westgate Rangers on a number we find ourselves, and that call is what unlocks trial notices and anything to do with players\./.test(claimForm),
     /Football Victoria/.test(claimForm), /Only the phone call does that/.test(claimForm)], [true, false, false]);
  check('D-172: never "partner", "member", "joined", "on Pitch", "verified", "official" or "in association with" on an unclaimed page',
    /\b(partner|member|joined|on Pitch|verified|official|in association with)\b/i.test(bw), false);

  const nate = ids.children.nate;
  const home = await get('/home', nate.child_id);
  check('link-r2: a 16–17 with a confirmed parent is offered "Share my CV" on their home, to /share-card/<record>',
    new RegExp(`href="/share-card/${nate.record_id}"[^>]*>Share my CV<`).test(home.html), true);
  check('link-r2b: an adult is not — a share card is an under-18\'s, approved by a parent (D-101)',
    /href="\/share-card\//.test((await get('/home', ids.people.jordan)).html), false);
}

// ---- "Send my CV" fills in the club's own address (0160; John, 30 Sep §2) ---
// From a club's page the send screen fills in the club and, when the database
// says it is a role address checked within 90 days, the address IN FULL, with
// where it came from and when. A club with only a person's address gets no
// address. A club that asked Pitch to stop gets "can't send", and no reason.
// And the club's opt-out page changes nothing when it is merely opened.
{
  const nate = ids.children.nate, deniz = ids.children.deniz;
  const vis = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ')
    .replace(/&rsquo;/g, '’').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  const input = (h, name) => new RegExp(`<input[^>]*name="${name}"[^>]*>`).exec(h)?.[0] ?? '';
  const valueOf = (h, name) => /value="([^"]*)"/.exec(input(h, name))?.[1] ?? null;
  const CHECKED = /The address Brindlewood Rovers SC publishes on its own website, checked \d{1,2} (January|February|March|April|May|June|July|August|September|October|November|December)\. Change it if you have a better one\./;
  const OLD_HELP = 'From the club’s own trial notice. Check it’s right';
  const filled = await get(`/send/${nate.record_id}?club=brindlewood-rovers-sc`, nate.child_id);
  check('sc-r1: from a club’s page, a 16–17 sending their own CV finds the club and its published address filled in, in full, with where it came from and when',
    [filled.status, valueOf(filled.html, 'clubName'), valueOf(filled.html, 'address'), CHECKED.test(vis(filled.html)), vis(filled.html).includes(OLD_HELP)],
    [200, 'Brindlewood Rovers SC', 'info@brindlewoodrovers.example.au', true, false]);
  const child = await get(`/send/${deniz.record_id}?club=brindlewood-rovers-sc`, deniz.child_id);
  check('sc-r2: and an under-16 composing for their parent sees the same address in full — nothing masked, because the parent reviews exactly this (D-91)',
    [child.status, valueOf(child.html, 'address'), CHECKED.test(vis(child.html)), /•/.test(vis(child.html)), /Ask my parent to send it/.test(child.html)],
    [200, 'info@brindlewoodrovers.example.au', true, false, true]);
  const personal = await get(`/send/${nate.record_id}?club=kestrelford-athletic-sc`, nate.child_id);
  check('sc-r3: a club that publishes only a person’s address gets its name and nothing else — no address, no "publishes", and the usual line under the empty field',
    [personal.status, valueOf(personal.html, 'clubName'), valueOf(personal.html, 'address'), /whitcombe/i.test(personal.html),
     /publishes on its own website/.test(vis(personal.html)), vis(personal.html).includes(OLD_HELP)],
    [200, 'Kestrelford Athletic SC', null, false, false, true]);
  const stoppedClub = await get(`/send/${nate.record_id}?club=wrenmoor-wanderers-fc`, nate.child_id);
  const stoppedText = vis(stoppedClub.html);
  check('sc-r4: a club that asked Pitch to stop: "We can’t send to this club through Pitch" and "Nothing has been sent." — no form, no reason, nothing about the club',
    [stoppedClub.status, stoppedText.includes('Not sent We can’t send to this club through Pitch Nothing has been sent.'), /name="clubName"|name="address"/.test(stoppedClub.html),
     // The page's own address carries the slug; what it SHOWS names nothing.
     /wrenmoor/i.test(stoppedText), /Your links/.test(stoppedText)],
    [200, true, false, false, false]);
  const refusedLanding = await get(`/send/${nate.record_id}?blocked=1`, nate.child_id);
  check('sc-r5: the screen the action lands on after refusing a stopped address says exactly the same',
    [refusedLanding.status, vis(refusedLanding.html).includes('Not sent We can’t send to this club through Pitch Nothing has been sent.'), /name="clubName"/.test(refusedLanding.html)],
    [200, true, false]);
  const odd = await get(`/send/${nate.record_id}?club=Brindlewood%20Rovers%27%3B`, nate.child_id);
  check('sc-r6: a club parameter that is not a slug is ignored — the plain screen, nothing filled in',
    [odd.status, valueOf(odd.html, 'clubName'), valueOf(odd.html, 'address')], [200, null, null]);
  // 0161: a verified club — Kingsway's address is a role address — gets its
  // name and no address: "publishes on its own website" is only what we know
  // of a listing Pitch compiled.
  const verifiedClub = await get(`/send/${nate.record_id}?club=kingsway-rovers`, nate.child_id);
  check('sc-r11: a verified club gets its name filled in and no address, and the usual line under the empty field',
    [verifiedClub.status, valueOf(verifiedClub.html, 'clubName'), valueOf(verifiedClub.html, 'address'),
     /publishes on its own website/.test(vis(verifiedClub.html)), vis(verifiedClub.html).includes(OLD_HELP)],
    [200, 'Kingsway Rovers FC', null, false, true]);
  const typo = await get(`/send/${nate.record_id}?error=1&club=brindlewood-rovers-sc`, nate.child_id);
  check('sc-r12: after a mistyped address the screen says so and still carries the club — filled in, and in the form for the next press',
    [typo.status, /Check the club name and the email address/.test(vis(typo.html)), valueOf(typo.html, 'address'),
     /<input type="hidden" name="club" value="brindlewood-rovers-sc"\/?>/.test(typo.html)],
    [200, true, 'info@brindlewoodrovers.example.au', true]);
  const nateClub = await get('/fc/brindlewood-rovers-sc', nate.child_id);
  const alexClub = await get('/fc/brindlewood-rovers-sc', ids.people.alex);
  nateClub.html = nateClub.html.replace(/<!-- -->/g, ''); alexClub.html = alexClub.html.replace(/<!-- -->/g, '');
  check('sc-r7: the club page’s "Send my CV to {club}" and "Send {name}’s CV to {club}" carry the club to the send screen',
    [new RegExp(`href="/send/${nate.record_id}\\?club=brindlewood-rovers-sc"[^>]*>Send my CV to Brindlewood Rovers SC<`).test(nateClub.html),
     new RegExp(`href="/send/${deniz.record_id}\\?club=brindlewood-rovers-sc"[^>]*>Send Deniz`).test(alexClub.html)], [true, true]);

  // /stop-cvs: noindex, no referrer, and opening it — even with a real
  // signature, as a mail scanner would — stops nothing.
  const ask = ids.georgiaAsk;
  const sig = createHmac('sha256', process.env.SESSION_SECRET || 'dev-only-secret-not-for-production').update(`stop-cvs:${ask}`).digest('base64url');
  const raw = await fetch(`${BASE}/stop-cvs?r=${ask}&t=${sig}`, { redirect: 'manual' });
  const stopHtml = await raw.text();
  const bad = await get(`/stop-cvs?r=${ask}&t=${'A'.repeat(43)}`);
  const none = await get('/stop-cvs');
  const shape = (h) => vis(h.replace(/<input[^>]*type="hidden"[^>]*>/g, ''));
  check('sc-r8: /stop-cvs is noindex (tag and header) and sends no referrer, and asks before it stops anything',
    [raw.status, /<meta name="robots" content="noindex, nofollow"/.test(stopHtml), raw.headers.get('x-robots-tag'), raw.headers.get('referrer-policy'),
     shape(stopHtml).includes('Stop CVs to this address? Pitch won’t send CVs to this address again. Families can still contact the club in other ways. Stop them')],
    [200, true, 'noindex, nofollow', 'no-referrer', true]);
  check('sc-r9: a bad signature, or none, gets the same page — it tells nobody which sends exist',
    [bad.status, none.status, shape(bad.html) === shape(stopHtml), shape(none.html) === shape(stopHtml)], [200, 200, true, true]);
  const gSend = await get(`/g/send/${ask}`, ids.people.alex);
  check('sc-r10: and opening it changed nothing — the parent can still send to that club',
    [gSend.status, vis(gSend.html).includes('Send it to Quarrymead United'), vis(gSend.html).includes('We can\u2019t send to this club')], [200, true, false]);
}

// ---- the sitemap (D-95, doc 32 A6; builder, 28 Sep) -------------------------
// What search engines are told to crawl. Club pages that are on Pitch —
// claimed OR verified, the same test the club page uses — published adult
// coaches, and the three boards. Nothing tokenised, nothing about a child, and
// nothing that the page itself asks search engines to leave alone: a sitemap
// entry carrying noindex is the two halves of the product disagreeing.
{
  const r = await fetch(BASE + '/sitemap.xml');
  const xml = await r.text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  const verified = ['riverside-fc', 'kingsway-rovers'].filter((slug) => ids.clubs[slug]);
  check(`sm1: a club BUZ has verified is in the sitemap (${verified.join(', ')})`,
    verified.length === 2 && verified.every((slug) => paths.includes(`/fc/${slug}`)), true);
  check('sm2: every entry is a board, a club page or a coach page — never a tokenised or personal page',
    paths.filter((p) => !/^\/(|trials|jobs|fc\/[a-z0-9-]+|c\/[a-z0-9-]+)$/.test(p)), []);
  const noindexed = [];
  for (const p of paths.filter((x) => /^\/(fc|c)\//.test(x))) {
    const page = await get(p);
    if (page.status !== 200 || /<meta name="robots" content="[^"]*noindex/.test(page.html)) noindexed.push(`${p} (${page.status})`);
  }
  check(`sm3: and every club or coach page it lists is a live page that does not ask to be left out of search (${paths.length} entries)`,
    noindexed, []);
}

// ---- Vercel Analytics: four public pages, signed out, nowhere else ---------
// (brief C, 29 Sep.) Analytics records the path of every page it counts. It
// was mounted in the root layout, so switching it on in the Vercel dashboard
// would have sent /p/<token> — a child's share link — and every guardian, CV
// and signed-in page to a third party: against pillar zero 5 (no analytics on
// minors) and D-94 §1 (no token in any log). It now runs on the front door,
// the trials board, the jobs board and a club's public page, and only for a
// visitor with no session (a signed-in visitor may be a child we know is one).
//
// The allowlist is written out here, not imported from lib/analytics-scope:
// a check that asks the code under test what the rule is agrees with it when
// it is wrong. Every seat is sent to every route family below, and then EVERY
// page this suite fetched, from the first check to this one, is judged.
{
  const PUBLIC = /^\/(|trials|jobs|fc\/[a-z0-9-]+)$/;
  const kids = ids.children;
  const jordanRec = ids.adultPlayers.find((a) => a.person_id === ids.people.jordan)?.record_id;
  const role = /href="\/jobs\/([0-9a-f-]{36})"/.exec((await get('/jobs')).html)?.[1];
  const FAMILIES = [
    // the four
    '/', '/trials', '/jobs', '/fc/riverside-fc',
    // public, and still not marketing: one job, a coach's CV and its print
    role ? `/jobs/${role}` : '/jobs/none', '/c/sam-kaya', '/c/sam-kaya/print', '/cv-preview/deniz',
    // tokenised: a live link, its print view, a dead one, one that never was,
    // a parent's approval link and an address confirmation
    '/p/dev-jordan', '/p/dev-jordan/print', '/p/dev-expired', `/p/${createHmac('sha256', 'an-r').update(String(Date.now())).digest('base64url')}`,
    '/a/dev-mila-text', '/confirm/dev-unproved',
    // guardian
    `/g/controls/${kids.georgia.child_id}`, `/g/pending/${kids.deniz.record_id}`,
    // a child's CV being built, and a player's own pages
    `/build/${kids.deniz.record_id}`, `/build/${kids.deniz.record_id}/preview`,
    '/home', jordanRec ? `/send/${jordanRec}` : '/send/none', '/registers', `/squad/${ids.people.jordan}`,
    // club, coach and operator
    '/club/register', '/club/squads', '/coach/edit', '/ops/verification',
    // the doors and the documents
    '/signin', '/join', '/report', '/reset', '/privacy', '/privacy/family', '/terms', '/claim/westgate-rangers',
  ];
  const SEATS = {
    'signed out': null, 'a parent': ids.people.alex, 'an adult player': ids.people.jordan,
    'a 16–17 player': kids.nate.child_id, 'an under-16': kids.deniz.child_id, 'a coach': ids.people.sam,
    'a club TD': ids.people.marina, 'a club administrator': ids.people.pat, 'an unverified club': ids.people['m.'],
    'brand new': ids.people.robin,
  };
  for (const who of Object.values(SEATS)) for (const path of FAMILIES) await get(path, who);

  const seatOf = (who) => Object.entries(SEATS).find(([, id]) => id === who)?.[0] ?? `person ${who}`;
  const offList = served.filter((r) => r.analytics && !(r.who === null && PUBLIC.test(r.path.split(/[?#]/)[0])));
  check(`an-r1: the analytics script is served on no page off the four, and to no one signed in (${served.length} pages served in this suite, ${new Set(served.map((r) => r.path)).size} distinct)`,
    [...new Set(offList.map((r) => `${r.path} as ${seatOf(r.who)}`))], []);
  const missing = ['/', '/trials', '/jobs', '/fc/riverside-fc'].filter((p) => !served.some((r) => r.path === p && r.who === null && r.status === 200 && r.analytics));
  check('an-r2: and it is served on each of the four, signed out', missing, []);
  // The crawl proves nothing about a family it never reached (L19): each one
  // must have served a real page to at least one seat.
  const FAMILY_OF = [['a share link', /^\/p\//], ['a guardian page', /^\/g\//], ['an approval link', /^\/a\//],
    ['a CV being built', /^\/build\//], ['a coach CV', /^\/c\//], ['a player’s pages', /^\/(home|send|registers|squad)\b/],
    ['the club console', /^\/club\//], ['the coach console', /^\/coach\//], ['the operator console', /^\/ops\//]];
  // After the launch-day switch (D-164, 0080) `/` is the product's front
  // door, a different page at the same address. It is the front door either
  // way, so it counts either way — and still not for anyone signed in.
  const flip = async (on) => {
    const r = await fetch(`${BASE}/dev/front-door?on=${on ? 1 : 0}`, { method: 'POST' });
    if ((r.ok ? await r.json() : null)?.frontDoor !== on) throw new Error(`the front-door switch did not turn ${on ? 'on' : 'off'}`);
  };
  await flip(true);
  let open;
  try {
    open = [];
    for (const [path, who] of [['/', null], ['/?for=parent', null], ['/', ids.people.alex], ['/?for=club', ids.people.marina]]) {
      const r = await get(path, who);
      open.push([r.status, /Who are you\?|For parents|For clubs/.test(r.html), ANALYTICS_MARK.test(r.html)]);
    }
  } finally { await flip(false); }
  check('an-r4: with the launch-day switch on, the front door at / carries it too — signed out, and not for anyone signed in',
    open, [[200, true, true], [200, true, true], [200, true, false], [200, true, false]]);
  check(`an-r3: the crawl reached every family with a rendered page (${FAMILY_OF.length} families, ${Object.keys(SEATS).length} seats)`,
    FAMILY_OF.filter(([, re]) => !served.some((r) => re.test(r.path) && r.status === 200)).map(([f]) => f), []);
}

// ---------------------------------------------------------------------------
// dfx — the live defects the Head of Product Design found (docs/design/specs/
// README.md on design/player-cv, "Live defects found while designing"; BUZ,
// 1 Oct). One check per defect, each run against the code before its fix.
// Read-only: nothing here presses anything.
// ---------------------------------------------------------------------------
{
  const nate = ids.children.nate;
  const parentHome = (await get('/home', alex)).html;
  const interestId = /href="\/g\/interest\/([0-9a-f-]{36})"/.exec(parentHome)?.[1] ?? null;

  // D-PD-1 and D-PD-2: the parent's answer screens. "Not this one" was a div
  // that did nothing; three buttons were drawn with nowhere to go.
  for (const [what, path, dead] of [
    ['/g/pending', `/g/pending/${deniz.record_id}`, 'Edit the words first'],
    ['/g/send', `/g/send/${ids.georgiaAsk}`, 'Change the address'],
    ['/g/interest', interestId && `/g/interest/${interestId}`, 'Edit what'],
  ]) {
    const r = path ? await get(path, alex) : { status: 0, html: '' };
    check(`dfx-PD-1: ${what} — "Not this one" is a link home, not a div that does nothing`,
      [r.status, /<a [^>]*href="\/home"[^>]*>Not this one<\/a>/.test(r.html), /<div[^>]*>Not this one<\/div>/.test(r.html)], [200, true, false]);
    check(`dfx-PD-2: ${what} — no button drawn with nowhere to go ("${dead}")`, [r.status, has(r.html, dead)], [200, false]);
  }
  // D-F1: a promise of an edit that is not built.
  check('dfx-D-F1: /g/pending no longer promises "You can edit the words before you approve them."',
    has((await get(`/g/pending/${deniz.record_id}`, alex)).html, 'You can edit the words'), false);

  // D-F2 (defect 8): Georgia has nothing waiting and nothing was just
  // approved, so her page is not "approved" — nothing is waiting. After an
  // approval (?done=1) the approved state is still there.
  const idle = await get(`/g/pending/${georgia.record_id}`, alex);
  const justDone = await get(`/g/pending/${georgia.record_id}?done=1`, alex);
  check('dfx-D-F2: with no change waiting, /g/pending says "Nothing is waiting on you." and never "page is approved"',
    [idle.status, has(idle.html, 'Nothing is waiting on you.'), has(idle.html, 'page is approved'), /Get the share link/.test(idle.html)],
    [200, true, false, false]);
  check('dfx-D-F2b: and after an approval it still says the page is approved',
    [justDone.status, has(justDone.html, '’s page is approved')], [200, true]);

  // D-PD-4 (defect 7): a dead /a/ link is LinkState's words at 200, one body
  // for every cause, never the root 404's "taken down". (Approved and held
  // links are walked in the write suite, which can approve one.)
  {
    const dead = [];
    for (const code of ['bogus', 'never-was-an-approval-code', '00000000-0000-0000-0000-000000000000']) dead.push(await get(`/a/${code}`));
    const doneDead = await get('/a/no-such-invitation/done');
    const notYet = await get(`/a/${ids.pendingInvitation}/done`);
    check('dfx-PD-4: a dead /a/ link answers 200 in the dead-link words, one identical body, no form, no "taken down"',
      [dead.map((r) => r.status), new Set(dead.map((r) => text(r.html).join('|'))).size, has(dead[0].html, 'This link doesn’t open anything'),
       dead.some((r) => /<form/.test(r.html)), dead.some((r) => has(r.html, 'taken down')), dead.some((r) => /<div data-failure=/.test(r.html))],
      [[200, 200, 200], 1, true, false, false, false]);
    check('dfx-PD-4b: and so does its done page — dead, or not approved yet — with no family on it',
      [doneDead.status, notYet.status, text(doneDead.html).join('|') === text(notYet.html).join('|'),
       has(notYet.html, 'This link doesn’t open anything'), has(notYet.html, 'Your children')],
      [200, 200, true, true, false]);
  }

  // C-P5 and C-P8: register interest at a club with no squads (Kingsway).
  const kingsway = ids.clubs['kingsway-rovers'], riverside = ids.clubs['riverside-fc'];
  const noSquads = await get(`/register-interest/${nate.record_id}?club=${kingsway}`, nate.child_id);
  const withSquads = await get(`/register-interest/${nate.record_id}?club=${riverside}`, nate.child_id);
  check('dfx-C-P8: a club with no squads draws no "Which squad" field; a club with squads still does',
    [noSquads.status, has(noSquads.html, 'Which squad'), /name="squadId"/.test(noSquads.html), withSquads.status, has(withSquads.html, 'Which squad')],
    [200, false, false, 200, true]);
  check('dfx-C-P5: "Cancel" on /register-interest is a link home',
    [/<a [^>]*href="\/home"[^>]*>Cancel<\/a>/.test(noSquads.html), /<div[^>]*>Cancel<\/div>/.test(noSquads.html)], [true, false]);

  // C-P9 and C-P5: the share card.
  const jordanRec = /\/build\/([0-9a-f-]{36})/.exec((await get('/home', ids.people.jordan)).html)?.[1] ?? 'none';
  const adultCard = await get(`/share-card/${jordanRec}`, ids.people.jordan);
  const teenCard = await get(`/share-card/${nate.record_id}`, nate.child_id);
  check('dfx-C-P9: an adult reaching /share-card by URL is sent home — no page telling them to ask a parent',
    [adultCard.status, adultCard.location, has(adultCard.html, 'Ask my parent')], [307, '/home', false]);
  check('dfx-C-P5b: a 16–17 still gets the card page, and its "Cancel" is a link home',
    [teenCard.status, /<a [^>]*href="\/home"[^>]*>Cancel<\/a>/.test(teenCard.html), /<div[^>]*>Cancel<\/div>/.test(teenCard.html)], [200, true, false]);

  // C-P6 (defect 18): a refused photo says so. 8 MB is the route's own cap.
  const bad = await get(`/build/${deniz.record_id}?photo=bad`, alex);
  const plainBuild = await get(`/build/${deniz.record_id}`, alex);
  check('dfx-C-P6: /build?photo=bad says the photo did not upload; without it, nothing',
    [bad.status, has(bad.html, 'upload. Try a JPG or PNG under 8 MB.'), has(plainBuild.html, 'upload. Try a JPG or PNG under 8 MB.')], [200, true, false]);

  // E3 (defect 20): the coach editor's order. The add-role form sits under its
  // roles and the banner under the photo; the JSX had nested the banner,
  // licences and accomplishments inside the roles block.
  const coachEdit = (await get('/coach/edit', ids.people.sam)).html;
  const at = (s) => coachEdit.indexOf(s);
  check('dfx-E3: /coach/edit runs photo → banner → profile → roles with their add form → licences',
    [order(coachEdit, 'Your photo', 'Choose a banner'), order(coachEdit, 'Choose a banner', 'How you want to play'),
     at('Where you’ve coached') > -1 && at('Where you’ve coached') < at('name="org"') && at('name="org"') < at('Licences &amp; qualifications')],
    [true, true, true]);

  // EC4 (defect 21): "We asked your club…" only when there is a club.
  const marnie = (await get('/coach/edit', ids.people.marnie)).html;
  check('dfx-EC4: a coach with no club is not told "We asked your club to confirm"; a coach with one still is',
    [has(marnie, 'We asked'), has(marnie, 'Your club confirms it, not you.'), has(coachEdit, 'We asked')], [false, true, true]);
}

// ---------------------------------------------------------------------------
// pd — the parent screens, Floodlit (spec D, BUZ 1 Oct). D-PD-0: wherever a
// press gives something away, Yes and No are the same charter secondary and
// nothing glows; the No is a link home, never a second form. Each check was
// run against the code before this build and failed there (L20).
// ---------------------------------------------------------------------------
{
  const markup = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '');
  const pair = (h) => {
    const i = markup(h).indexOf('class="fl-answer"');
    if (i < 0) return 'no pair';
    const s = markup(h).slice(i, i + 1600);
    return [(s.match(/class="btn btn-secondary"/g) ?? []).length >= 2, /btn-primary/.test(s),
      /<a [^>]*href="\/home"[^>]*>Not this (one|time)<\/a>/.test(s)];
  };
  const parentHome = (await get('/home', alex)).html;
  const linkOf = (re) => re.exec(parentHome)?.[1] ?? null;
  const interestId = linkOf(/href="\/g\/interest\/([0-9a-f-]{36})"/), inviteId = linkOf(/href="\/g\/invite\/([0-9a-f-]{36})"/);
  for (const [what, path] of [
    ['/g/send', `/g/send/${ids.georgiaAsk}`], ['/g/interest', interestId && `/g/interest/${interestId}`],
    ['/g/pending', `/g/pending/${deniz.record_id}`], ['/g/invite', inviteId && `/g/invite/${inviteId}`],
    ['/g/invite reply', inviteId && `/g/invite/${inviteId}?reply=1`],
  ]) {
    const r = path ? await get(path, alex) : { status: 0, html: '' };
    check(`pd-r1: ${what} — the answer is an equal pair of secondaries, the No a link home, and nothing on the page glows`,
      [r.status, pair(r.html), (markup(r.html).match(/fl-glow/g) ?? []).length], [200, [true, false, true], 0]);
  }

  // John's ruling (1 Oct): the child's waiting page says the request has
  // closed — never "expired" — and one answer for every id that is not a
  // waiting request, so it cannot tell an ending from an id that never was.
  const closed = [await get('/join/waiting/bogus'), await get('/join/waiting/00000000-0000-0000-0000-000000000000')];
  const live = await get(`/join/waiting/${ids.pendingInvitation}`);
  check('pd-r2: a /join/waiting id that is not waiting says "This request has closed. You can ask again whenever you like.", one identical body, never "expired"',
    [closed.map((r) => r.status), new Set(closed.map((r) => text(r.html).join('|'))).size,
     has(closed[0].html, 'This request has closed.'), has(closed[0].html, 'You can ask again whenever you like.'),
     closed.some((r) => /expired/i.test(text(r.html).join(' '))), closed.some((r) => /<form/.test(markup(r.html)))],
    [[200, 200], 1, true, true, false, false]);
  check('pd-r2b: and a request still waiting is not told it has closed',
    [live.status, has(live.html, 'This request has closed.'), has(live.html, 'One person to go.')], [200, false, true]);

  // Controls: charter buttons only. Delete stays one tap, in the red state.
  const ctl = [];
  for (const k of ['deniz', 'georgia', 'nate']) ctl.push(markup((await get(`/g/controls/${ids.children[k].child_id}`, alex)).html));
  check('pd-r3: /g/controls draws no hand-built button, and Delete is the secondary in the red state',
    [ctl.map((h) => /<button[^>]*style="/.test(h)), ctl.map((h) => /class="btn btn-secondary is-danger"[^>]*>Delete /.test(h))],
    [[false, false, false], [true, true, true]]);
}

// ---------------------------------------------------------------------------
// hm — every seat's /home, Floodlit (spec A "Pages", mockup floodlit-homes,
// BUZ 1 Oct). Three layers: the hero, the one glowing primary (directly under
// the hero on a phone, A-P1), and everything else as quiet rows. Read-only.
// Each was run against the code before this build and failed there (L20).
// ---------------------------------------------------------------------------
{
  const markupOf = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<!-- -->/g, '');
  const glowOn = (h) => [...markupOf(h).matchAll(/class="[^"]*\bfl-glow\b[^"]*"[^>]*>([^<]*)</g)].map((m) => m[1]);
  const homeOf = async (who) => markupOf((await get('/home', who)).html);
  const seats = [
    ['an adult player', ids.people.jordan, ['Send my CV to a club']],
    ['a 16–17 with a confirmed parent', ids.children.nate.child_id, ['Send my CV to a club']],
    ['a coach', ids.people.sam, ['Edit my coach CV']],
    ['a club TD', ids.people.marina, ['Register']],
    ['a small club’s TD', ids.people.dana, ['Register']],
    ['a club administrator', ids.people.pat, ['Post a trial notice']],
    ['an unverified club', ids.people['m.'], ['Email us a good time to ring']],
    ['a parent with things waiting', alex, ['Review it']],
    ['a brand-new account', ids.people.robin, []],
    ['signed out', null, ['Sign in']],
  ];
  const html = {};
  for (const [who, id] of seats) html[who] = await homeOf(id);
  check('hm1: every seat’s home glows on its one primary and nowhere else — none on the brand-new home, where nothing says which door is theirs',
    seats.map(([who]) => glowOn(html[who])), seats.map(([, , want]) => want));

  // A-P1: the DOM order is the phone order — the hero, then the primary (the
  // first control in the lead), then the rest, then the aside.
  const p1 = (h) => {
    const at = ['class="hg-top"', 'class="hero-panel', 'class="hg-lead"', 'fl-glow', 'class="hg-main"', 'class="hg-aside"'].map((k) => h.indexOf(k));
    const lead = h.slice(at[2], at[3]);
    return at.every((x, i) => x > -1 && (i === 0 || at[i - 1] < x)) && (lead.match(/<a |<button/g) ?? []).length === 1;
  };
  check('hm2: on a phone the player’s, the coach’s and the TD’s one primary sits directly under the hero (A-P1)',
    ['an adult player', 'a 16–17 with a confirmed parent', 'a coach', 'a club TD'].map((who) => p1(html[who])), [true, true, true, true]);
  const lead = (h) => [...h.slice(h.indexOf('class="hg-lead"'), h.indexOf('class="hg-main"')).matchAll(/<a [^>]*class="([^"]*)"[^>]*>([^<]*)</g)].map((m) => `${m[1]}|${m[2]}`);
  check('hm2b: a 16–17 with a confirmed parent has Share my CV as the only secondary directly under Send; an adult has Send alone',
    [lead(html['a 16–17 with a confirmed parent']), lead(html['an adult player'])],
    [['btn btn-primary fl-glow|Send my CV to a club', 'btn btn-secondary|Share my CV'], ['btn btn-primary fl-glow|Send my CV to a club']]);

  // The centred grey menu cards are one door list: the same hrefs and words.
  const doorsOf = (h, cls = 'card rows doors') => {
    const list = new RegExp(`<div class="${cls}">([\\s\\S]*?)</div>`).exec(h)?.[1] ?? '';
    return [...list.matchAll(/<a [^>]*href="([^"]*)"[^>]*>[\s\S]*?<span class="row-t">([^<]*)<\/span>[\s\S]*?(?:<span class="row-end">([^<]*)<\/span>)?<\/a>/g)]
      .map((m) => [m[1].replace(/[0-9a-f-]{36}/, '*'), m[2].replace(/&amp;/g, '&'), m[3] ?? null]);
  };
  check('hm3: the player’s four menu cards are one door list, same four hrefs and words',
    doorsOf(html['an adult player']), [['/build/*', 'Build your CV', null], ['/trials', 'Trials near you', null], ['/build/*/clips', 'Highlights', null], ['/build/*/more', 'Achievements', null]]);
  check('hm3b: the coach’s three aside cards are one door list, same hrefs, the open roles as the row’s end',
    doorsOf(html['a coach']).map(([h, t, e]) => [h, t, e === null ? null : /^[1-9]\d* open$/.test(e)]),
    [['/c/sam-kaya', 'See my public page', null], ['/coach/register', 'Registrations', null], ['/jobs', 'Coaching roles at clubs', true]]);
  // Live copy fix 3 (BUZ, 1 Oct): with no role stored from /join, "Find your
  // club" leads — an order change only (A-P5).
  check('hm3c: the brand-new home’s four doors are one panel, each with its reason and its end word, Find your club first',
    doorsOf(html['a brand-new account'], 'card rows').map(([h, t, e]) => [h, t, e]),
    [['/claim', 'Here for a club? Find your club', 'Open'], ['/coach/edit', 'Build a coach CV', 'Start'], ['/trials', 'Trials near you', 'Open'], ['/jobs', 'Coaching roles at clubs', 'Open']]);
  const centred = (h) => (h.replace(/<nav[\s\S]*?<\/nav>/g, ' ').match(/text-align:center/g) ?? []).length;
  check('hm3d: no home has a centred menu card left outside its navs',
    seats.map(([who]) => centred(html[who])), seats.map(() => 0));

  // A-P6: "tell us" is a mailto to the one user-facing address; the line's
  // other words are unchanged.
  check('hm4: on the brand-new home “tell us” is a mailto to the one address, in the line it always sat in',
    /Adding a child and building a player CV are not on this screen yet — <a href="mailto:burak\.donmez@pitch-football\.com">tell us<\/a> which you came for and we will point you at it\./.test(html['a brand-new account']), true);

  // The parent: the queue's lead is the trial invitation, purple; every other
  // item is amber; green never marks a wait. The children sit in the second
  // column, after the queue and the trials row, so on a phone they are last.
  const p = html['a parent with things waiting'];
  const tones = [...p.matchAll(/class="notice-k" style="color:([^";]+)/g)].map((m) => m[1]);
  check(`hm5: the parent’s queue is purple for the club’s invitation, amber for everything else, never green (${tones.join(' ')})`,
    [tones[0], tones.slice(1).every((t) => t === '#eda100'), tones.includes('#3ddc84'), tones.length >= 4], ['#ab87e0', true, false, true]);
  check('hm5b: the parent’s trials row says “by date”, and the children come after it, in the grid’s second column',
    [has(p, 'Every notice we hold, by date'), has(p, 'newest first'),
     /Every notice we hold, by date[\s\S]*?<\/a><\/div><div><h2 id="children" class="sec-h">Your children<\/h2>/.test(p)], [true, false, true]);

  // The unverified club: a count and nothing else (D-126) — one numeral, and
  // no Post a trial anywhere, the bar and the rail included.
  const held = html['an unverified club'];
  const nums = [...held.matchAll(/class="numeral[^"]*"[^>]*>([^<]*)</g)].map((m) => m[1]);
  check(`hm6: an unverified club’s held count is a numeral-l and the only number on the page, and no door posts a trial (${nums.join(',')})`,
    [nums.length, /class="numeral numeral-l"[^>]*>[1-9]\d*</.test(held), /href="\/club\/post-trial"/.test(held)], [1, true, false]);

  // The administrator: Open it is the charter's secondary, and the hero's
  // numbers are ink — facts, not actions or states.
  const pat = html['a club administrator'];
  check('hm7: the administrator’s “Open it” is a secondary button and her hero numbers are ink',
    [/<a [^>]*class="btn btn-secondary[^"]*"[^>]*>Open it</.test(pat),
     [...pat.matchAll(/class="numeral numeral-[lms]" style="color:([^";]+)/g)].map((m) => m[1]).every((c) => c === '#eef5f0')], [true, true]);

  // B1 (live defect, BUZ 1 Oct): every child card a parent may act on carries
  // "Build {first}'s page" to that child's own builder, beside Manage — both
  // the charter's secondary, so the queue keeps the one glow.
  const cardDoors = [...p.slice(p.indexOf('id="children"')).matchAll(/<a (?=[^>]*href="(\/build\/[0-9a-f-]{36}|\/g\/controls\/[0-9a-f-]{36})")(?=[^>]*class="([^"]*)")[^>]*>([^<]*)</g)]
    .map((m) => `${m[1]}|${m[2]}|${m[3].replace(/&#x27;|&rsquo;/g, '’')}`);
  const kid = (k, first) => [`/build/${ids.children[k].record_id}|btn btn-secondary|Build ${first}’s page`, `/g/controls/${ids.children[k].child_id}|btn btn-secondary|Manage`];
  // Spec A (B1): an under-16's door only — Nate (17) builds his own page —
  // and with things waiting, the queue keeps the glow and the door is a
  // secondary. (The glowing case, nothing waiting and no page, is hm-w2.)
  check('hm9: each under-16’s card offers “Build {first}’s page” above Manage, both secondary while things wait; the 16–17’s card has Manage alone (B1)',
    cardDoors, [...kid('deniz', 'Deniz'), `/g/controls/${ids.children.nate.child_id}|btn btn-secondary|Manage`, ...kid('georgia', 'Georgia')]);
  check('hm9b: and the builder it points at opens for the parent', (await get(`/build/${ids.children.deniz.record_id}`, alex)).status, 200);

  // Live copy fix 1 (BUZ, 1 Oct): with billing off there is no plan, so the
  // administrator's own line leaves "and the plan" out (ah6 reads it back
  // with billing on). B2: Riverside has a TD with an account, so the no-TD
  // line is not drawn.
  const noTd = /ADMIN_NO_TD_LINE = '([^']+)'/.exec(readFileSync(new URL('../lib/home-copy.ts', import.meta.url), 'utf8'))?.[1] ?? 'missing';
  check('hm10: billing off, the administrator’s row reads “the page, squads, notices and coaching roles”, with no plan',
    [has(pat, 'Club administrator — the page, squads, notices and coaching roles. No registrations.'), has(pat, 'and the plan')], [true, false]);
  check('hm10b: a club whose TD has an account does not get the no-TD line', [noTd !== 'missing', has(pat, noTd)], [true, false]);

  // A-P9 (HoPD ruling 3, 1 Oct): an operator-only account's console has one
  // door to /ops, "Today", and no Home door, in the rail and in the bar; an
  // operator with another seat keeps Home, to /home. In development any
  // signed-in address is an operator: Robin holds no seat, Marina is a TD.
  {
    const railOf = (h, label) => new RegExp(`<nav[^>]*aria-label="${label}"[^>]*>([\\s\\S]*?)</nav>`).exec(h)?.[1] ?? '';
    const doorsIn = (nav) => [...nav.matchAll(/<a (?=[^>]*href="([^"]*)")[^>]*>([\s\S]*?)<\/a>/g)].map((m) => `${m[1]}|${m[2].replace(/<[^>]+>/g, '').trim()}`)
      .filter((d) => /^\/ops\||^\/home\|/.test(d));
    const only = markupOf((await get('/ops', ids.people.robin)).html);
    const seated = markupOf((await get('/ops', ids.people.marina)).html);
    check('hm11: an operator-only console has one door to /ops, “Today”, and no Home door, in the rail and in the bar',
      [doorsIn(railOf(only, 'Operator')), doorsIn(railOf(only, 'Operator bar'))], [['/ops|Today'], ['/ops|Today']]);
    check('hm11b: an operator who holds another seat keeps Home, and it goes to /home',
      doorsIn(railOf(seated, 'Operator')), ['/ops|Today', '/home|Home']);
  }

  // The ghost squad number on the player's hero is the CV's own .cv-num, and
  // it is the player's number.
  check('hm8: the player’s hero carries their squad number as the CV’s ghost numeral',
    /<span class="cv-num" aria-hidden="true">9<\/span>/.test(html['an adult player']), true);
}

// ---------------------------------------------------------------------------
// addr-r1 — no page this crawl was served sends a share token into an address
// bar: not in a redirect, and not in a link it carries (brief D; L38/L42).
// ---------------------------------------------------------------------------
// glow1 — the one glow, over every page the whole suite was served (see
// glowCount at the top). Proven against the trials board and a two-child
// club page, which carried three and two before the base pass.
check(`glow1: no page in the render crawl carries more than one fl-glow (${served.length} pages served)`,
  [...glowMany], []);

check(`addr-r1: no response in the render crawl carries a share token in a Location or in a link's query string (${tokenWatch.pages} pages, ${tokenWatch.redirects} redirects watched)`,
  [tokenWatch.leaks, tokenWatch.pages > 500, tokenWatch.redirects > 20], [[], true, true]);

console.log(`\n${pass} passed, ${failures.length} failed${failures.length ? ' - ' + failures.join('; ') : ' - ALL GREEN'}`);
process.exit(failures.length ? 1 : 0);
