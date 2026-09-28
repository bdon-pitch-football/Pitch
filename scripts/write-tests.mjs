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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// A genuine 1x1 PNG. Uploads are re-encoded server-side and type-checked by
// CONTENT rather than extension (D-94 §7), so a text file pretending to be an
// image would be rejected for the right reason and prove nothing.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

const BASE = process.env.RENDER_BASE ?? 'http://localhost:3000';
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

/** Every <form> on a page, with the fields a browser would send. */
function forms(html) {
  const out = [];
  for (const m of html.matchAll(/<form([^>]*)>([\s\S]*?)<\/form>/g)) {
    const body = m[2];
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
    out.push({ fields, visible, action, bound: /\$ACTION_REF_/.test(body), actionId: label,
      submit: (/<button[^>]*type="submit"[^>]*>([\s\S]*?)<\/button>/.exec(body)?.[1] ?? '')
        .replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, "'").trim().slice(0, 34) });
  }
  return out;
}

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
      if (h.startsWith('/_next') || h.startsWith('/assets') || /\.(png|svg|jpg|ico|xml|txt|webmanifest)$/.test(h)) continue;
      // Never /signout. This walk follows every link it finds, and signing out
      // now REVOKES the session rather than deleting the browser's copy of a
      // cookie (0062) — so following it once ended the seat and every check
      // after it saw a signed-out product. It cost an hour to find as
      // "cp1: an adult with no page is offered Publish my page" going red,
      // because the only Sign out link in the product is on the home screen
      // of an account with no children, and Robin is the only seat that has
      // one. Pressing it is sess-w1..w3's job, on a session opened for it.
      if (h === '/signout') continue;
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
  const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual',
    headers: who ? { cookie: cookieFor(who) } : {} });
  await r.text();
  return r.status;
}

// ---------------------------------------------------------------------------
// Collect every distinct form the product renders, per seat.
// ---------------------------------------------------------------------------
const SIGNED_OUT_ROUTES = ['/signin', '/join', '/reset', '/report', '/p/dev-deniz', '/p/dev-revoked'];
const found = new Map();          // actionId -> {seat, who, path, form}
for (const [seat, who] of Object.entries(SEATS)) {
  for (const p of await reach(who)) {
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

  // Under 16 — Deniz, 14. doc 14 L1: composed, never transmitted.
  const df = await sendForm(parent, deniz.record_id);
  const dLoc = await postSend(parent, deniz.record_id, df, 'Child Test FC', 'child@send.example');
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
  await postTo(`/g/invite/${nateInv}`, teen, formOn(html, (f) => 'invitationId' in f.fields), { answer: 'yes', note: 'Keen.' });
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
  await postTo(`/g/invite/${nateInv}`, parent, formOn(html, (f) => 'invitationId' in f.fields), { answer: 'yes', note: 'Keen.' });
  check('e8: once the parent approves, the club sees the answer',
    decode((await get(`/club/invite/${nateReg}`, club)).html).includes('Nate replied'), true);

  // ---- Under 16 — Deniz ------------------------------------------------------
  const denizRec = ids.children.deniz.record_id;
  html = (await get(regPath(denizRec), parent)).html;
  res = await postTo(regPath(denizRec), parent, formOn(html, (f) => 'trialId' in f.fields), {});
  check('f1: an under-16’s interest waits for the parent', res.location.includes('asked=1'), true);
  const interestReq = [...(await get('/home', parent)).html.matchAll(/href="\/g\/interest\/([0-9a-f-]{36})"/g)].map((m) => m[1]);
  for (const rid of interestReq) {
    const page = (await get(`/g/interest/${rid}`, parent)).html;
    if (!decode(page).includes('Kingsway')) continue;
    check('f2a: the parent’s consent screen shows the trial (N2)', decode(page).includes('U16–U18 and Seniors trials'), true);
    await postTo(`/g/interest/${rid}`, parent, formOn(page, (f) => 'requestId' in f.fields), {});
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
  await postTo(`/g/controls/${georgia}`, parent, pause);
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

  // --- D-155: the declaration is required ------------------------------------
  const noDecl = await post(`/a/${EMAIL}`, approveForm);
  check('ia2g: approving without the 18-or-over tick approves nothing', /\?adult=1/.test(noDecl.location), true);
  check('ia2h: and the invitation is still waiting', (await ig(`/a/${inv}/done`)).status, 404);

  const done = await post(`/a/${EMAIL}`, approveForm, { adult: 'on' });
  check('ia3: with it, approving works, with no JavaScript and no cookie', /\/a\/[0-9a-f-]+\/done/.test(done.location), true);
  check('ia3b: and both links are finished', [(await ig(`/a/${TEXT}`)).status, (await ig(`/a/${EMAIL}`)).status], [404, 404]);

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
  const joinPost = (name, fields) => post('/join', { fields: { [`$ACTION_ID_${actionId(name)}`]: '' } }, fields);
  check('ia15: the sign-up actions are found', Boolean(actionId('startPendingInvitation') && actionId('createAccount')), true);

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
  const tessSend = await fetch(BASE + `/send/${tessRec}`, { redirect: 'manual', headers: { cookie: tessCookie } });
  check('t16f: and the send screen sends Tess home', tessSend.status >= 300 && tessSend.status < 400, true);

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
  check('g32-16: the link shows as suppressed, restorable, with the court-order removal beside it',
    /Parent of Nate · suppressed/.test(txt(again.html)) && forms(again.html).some((f) => /Restore access/.test(f.submit)) && forms(again.html).some((f) => /Remove permanently/.test(f.submit)), true);
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

  // The family door. Her own club in the seed has nobody who can confirm a
  // claim, so the parent asks the club that has — and then she leaves, which
  // needs nobody's permission (D-10).
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
  const leave = forms(await controls()).find((f) => f.fields.personId === g.child_id && !('claimId' in f.fields) && !('squadId' in f.fields) && f.submit === 'Leave');
  const left = await postTo(`/g/controls/${g.child_id}`, alex, { ...leave.fields });
  check('sqf11: her parent takes her out with one tap, and the club no longer has her',
    [/squad=left/.test(left.location), inSquad((await get(`/club/squads/${squadId}`, td)).html).includes(g.first_name), /Add their club/.test(await card())],
    [true, false, true]);

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
}

// ---------------------------------------------------------------------------
// 1 · EVERY FORM SUBMITS WITHOUT JAVASCRIPT.
// ---------------------------------------------------------------------------
const broke = []; const skipped = [];
for (const e of all) {
  if (/delete/i.test(e.form.submit)) continue;      // x3 owns this one
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
const settled = (h) => { const n = /nonce="([^"]+)"/.exec(h)?.[1]; return strip(n ? h.split(n).join('NONCE') : h); };
for (const e of all) {
  if (/delete/i.test(e.form.submit)) continue;
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
    const status = await post(del.form.action ?? del.path, del.who, del.form);
    check('x3b: and the deletion completes rather than rolling back', status, 303);
    check('x3c: AND THE CHILD IS GONE — the promise on the consent screen', await exists(), false);
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
  check('ks-w5: switching back on works', /done=resumed/.test(await drive('Switch shared links back on', { reason: 'drill over' })), true);
  check('ks-w6: and the same link is live again', title((await get(FIXTURE, null)).html), jordanLive);
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
    [/Goalkeepers/.test(tdView), /1st /.test(tdView), /In the squad since/.test(tdView)], [true, true, true]);
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
// person's own confirm link. LAST, because it verifies Sunbury — the seat
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
  // Find Sunbury's call sheet the way the operator does — from the queue.
  const queue = (await get('/ops/verification', op)).html;
  let sheet = null;
  for (const m of new Set([...queue.matchAll(/href="(\/ops\/call\/[0-9a-f-]{36})"/g)].map((x) => x[1]))) {
    if (/Sunbury United/.test((await get(m, op)).html)) { sheet = m; break; }
  }
  check('td-w1: the queue links to a call sheet for the club awaiting a call', Boolean(sheet), true);
  check('td-w2: a club nobody has called has no technical director, and the console says so',
    /No Technical Director recorded/.test(words(queue)), true);

  const call = { operator: 'BUZ', number_called: '03 9000 0500', number_source: 'FV club directory',
    answered_by: 'Committee', club_confirmed: 'yes', person_confirmed: 'yes',
    incorporated: 'yes', authority_confirmed: 'yes', notes: 'write-test drill' };
  await send(sheet, { ...call, outcome: 'not_verified', td_name: 'Nobody Atall', td_email: 'nobody@example.com' });
  check('td-w3: a call that did not verify the club records no technical director either',
    /None recorded/.test(words((await get(sheet, op)).html)), true);

  // The real thing: verified, and the person the club named. Casey Duarte's
  // address is the one nobody has proved yet (dev seed), so this is the
  // recorded-but-not-yet-active state.
  await send(sheet, { ...call, outcome: 'verified', td_name: 'Casey Duarte', td_email: 'unproved@example.com' });
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
  const page = await get('/club/billing', dana);
  const form = forms(page.html).find((f) => f.visible.some((v) => v.name === 'authorised'));
  check('bw1: the checkout form is there, with the D-137 tick on it', Boolean(form), true);

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
  const oldTry = await send(`/reset/${older}`, submit((await raw(`/reset/${older}`, null)).html, /Save it/),
    { password: 'attacker-chosen-password-1' });
  check('sess-w13: the OLDER of them sets no password — issuing the second one killed it',
    /\/reset\?expired=1/.test(oldTry.location), true);
  const newTry = await send(`/reset/${newer}`, submit((await raw(`/reset/${newer}`, null)).html, /Save it/),
    { password: 'admin-new-password-24680' });
  check('sess-w14: the newest one works', /\/signin\?reset=1/.test(newTry.location), true);
  const reuse = await send(`/reset/${newer}`, submit((await raw(`/reset/${newer}`, null)).html, /Save it/),
    { password: 'attacker-chosen-password-2' });
  check('sess-w15: and once used it is spent, so a second press sets nothing',
    /\/reset\?expired=1/.test(reuse.location), true);
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
// A CLUB IS SUSPENDED AND THE FAMILIES ARE TOLD — or are not, which is the
// half that has to be right (doc 31 M11/L29; doc 15 §37; 0065).
//
// Every piece of this existed in 0025 and nothing connected them: the reason
// class, the recipient function, the undo token, the /undo page and the words.
// The suspend button shipped, so an operator could take a club down for a
// child-safety reason and no family holding a live link to it learnt anything.
//
// Walked through the real screens, and the outbox read for what would actually
// have gone. LAST, because it suspends Sunbury — the club the block above
// verifies, and the seat every "unverified club" check earlier depends on.
// ---------------------------------------------------------------------------
{
  const op = ids.people.marina, parent = ids.people.alex, deniz = ids.children.deniz;
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

  // Sunbury's sheet, found the way the operator finds it. The block above left
  // it verified with a live Technical Director.
  const queue = (await get('/ops/verification', op)).html;
  let sheet = null;
  for (const m of new Set([...queue.matchAll(/href="(\/ops\/call\/[0-9a-f-]{36})"/g)].map((x) => x[1]))) {
    if (/Sunbury United/.test((await get(m, op)).html)) { sheet = m; break; }
  }
  check('susp-w0: the call sheet now asks the operator WHY, from a closed list',
    /name="suspension_reason"/.test((await get(sheet, op)).html)
      && /value="child_safety"/.test((await get(sheet, op)).html), true);

  // A family sends Deniz's CV to Sunbury, the whole way: the child asks, the
  // parent checks the address and presses send (D-91, D-99).
  const sendForm = forms((await get(`/send/${deniz.record_id}`, parent)).html).find((x) => x.visible.some((v) => v.name === 'clubName'));
  await postTo(`/send/${deniz.record_id}`, parent, { ...sendForm.fields,
    clubName: 'Sunbury United', address: 'football@sunburyunited.example.au' });
  const ask = [...(await box()).matchAll(/\/g\/send\/([0-9a-f-]{36})/g)].map((m) => m[1]).pop();
  const gSend = forms((await get(`/g/send/${ask}`, parent)).html).find((f) => 'requestId' in f.fields);
  await postTo(`/g/send/${ask}`, parent, gSend.fields);
  check('susp-w1: the parent has sent Deniz’s CV to Sunbury, and the club has it',
    /doc15\.§19 → football@sunburyunited\.example\.au/.test(await box()), true);

  // ---- The ordinary suspension. Nobody is told, and that is the ruling. ----
  const before = await deverifies();
  await logCall(sheet, { outcome: 'suspended', suspension_reason: 'administrative' });
  check('susp-w2: an ADMINISTRATIVE suspension takes the club down',
    /Sunbury United[\s\S]{0,400}?Suspended/.test(plain((await get('/ops/verification', op)).html)), true);
  check('susp-w3: and tells NOBODY — no family is alarmed because a club’s paperwork lapsed',
    await deverifies(), before);
  // The link the family sent is untouched either way: this is L29, and it is
  // the whole reason M11 was recorded unbuildable.
  const controls = async () => plain((await get(`/g/controls/${deniz.child_id}`, parent)).html);
  check('susp-w4: the family’s link still works — we never revoke on their behalf',
    /football@sunburyunited\.example\.au[\s\S]{0,200}?Switch off/.test(await controls()), true);

  // ---- The child-safety suspension. Every affected family, once each. ----
  await logCall(sheet, { outcome: 'verified', td_name: 'Casey Duarte', td_email: 'unproved@example.com' });
  await logCall(sheet, { outcome: 'suspended', suspension_reason: 'child_safety' });
  const after = await box();
  check('susp-w5: a CHILD-SAFETY suspension emails the guardian whose live link went to that club (§37)',
    /doc15\.§37 → guardian@example\.com/.test(after), true);
  const notice = (after.split('doc15.\u00a737')[1] ?? '').slice(0, 1200);
  check('susp-w6: naming the club and the child',
    [/Sunbury United is no longer a verified club on Pitch/.test(notice),
     /You sent them a link to Deniz's page/.test(notice)], [true, true]);
  check('susp-w6b: and saying nothing about why — that is somebody else\u2019s information',
    /allegation|complaint|investigat|report|safety concern/i.test(notice), false);
  check('susp-w7: and it carries the one-tap switch, not a sign-in hunt',
    /Switch this link off: http[^ ]*\/undo\/[A-Za-z0-9_-]{20,}/.test(after), true);
  check('susp-w8: exactly one message, not one per suspension already sent',
    (after.match(/doc15\.§37/g) ?? []).length, 1);
  check('susp-w9: it has not switched the link off for them — the button is still to press',
    /football@sunburyunited\.example\.au[\s\S]{0,200}?Switch off/.test(await controls()), true);

  // The parent presses it. That is the family unmaking their own disclosure.
  const undo = /\/undo\/([A-Za-z0-9_-]{20,})/.exec(after.split('doc15.§37')[1] ?? '')?.[1];
  const undoForm = forms((await get(`/undo/${undo}`, null)).html).find((f) => 'token' in f.fields);
  await postTo(`/undo/${undo}`, null, undoForm.fields);
  check('susp-w10: one tap from the email switches that club’s link off, with no sign-in',
    /football@sunburyunited\.example\.au[\s\S]{0,200}?Off /.test(await controls()), true);
  check('susp-w11: and every other club’s link keeps working — a family is not punished for what a club did',
    /recruitment@kingswayrovers\.example\.au[\s\S]{0,200}?Switch off/.test(await controls()), true);
}

console.log(`\n${pass} passed, ${failures.length} failed${failures.length ? ' - ' + failures.join('; ') : ' - ALL GREEN'}`);
console.log('NOTE: this mutated the dev database. Restart scripts/dev-db.mts for a clean one.');
process.exit(failures.length ? 1 : 0);
