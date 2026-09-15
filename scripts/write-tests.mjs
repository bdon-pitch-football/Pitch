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
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

// A genuine 1x1 PNG. Uploads are re-encoded server-side and type-checked by
// CONTENT rather than extension (D-94 §7), so a text file pretending to be an
// image would be rejected for the right reason and prove nothing.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

const BASE = process.env.RENDER_BASE ?? 'http://localhost:3000';
const ids = JSON.parse(readFileSync(new URL('../.dev-ids.json', import.meta.url), 'utf8'));
const cookieFor = (p) => `pitch_session=${p}.${createHmac('sha256', process.env.SESSION_SECRET || 'dev-only-secret-not-for-production').update(p).digest('base64url')}`;

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
      if (h.startsWith('/_next') || h.startsWith('/assets') || /\.(png|svg|jpg|ico|xml|txt)$/.test(h)) continue;
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
for (const e of all) {
  if (/delete/i.test(e.form.submit)) continue;
  if (!e.who) continue;
  const intruder = Object.values(SEATS).find((p) => p !== e.who);
  const before = strip((await get(e.path, e.who)).html);
  await post(e.form.action ?? e.path, intruder, e.form);
  const after = strip((await get(e.path, e.who)).html);
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
  }
}

console.log(`\n${pass} passed, ${failures.length} failed${failures.length ? ' - ' + failures.join('; ') : ' - ALL GREEN'}`);
console.log('NOTE: this mutated the dev database. Restart scripts/dev-db.mts for a clean one.');
process.exit(failures.length ? 1 : 0);
