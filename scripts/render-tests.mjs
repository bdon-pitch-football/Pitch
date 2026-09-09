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

console.log(`\n${pass} passed, ${failures.length} failed${failures.length ? ' - ' + failures.join('; ') : ' - ALL GREEN'}`);
process.exit(failures.length ? 1 : 0);
