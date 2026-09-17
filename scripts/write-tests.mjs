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
import { fileURLToPath } from 'node:url';

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
  const linkTo = (re) => { const m = [...outbox.matchAll(/\/a\/([A-Za-z0-9_-]{20,})/g)].map((x) => x[1]); return m; };
  const zedLinks = linkTo().slice(0, 2); // the two newest messages are Zed's
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
  const newtIn = await post('/signin', signinForm, { email: 'newt@example.com', password: 'newt-password-123' });
  check('join5: and signs in with the password they chose', /pitch_session=[^;]+\./.test(newtIn.cookie), true);
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
  const jordanLive = title((await get('/p/dev-jordan', null)).html);
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
  check('ks-w2: and changed nothing', title((await get('/p/dev-jordan', null)).html), jordanLive);
  check('ks-w3: the pause switches on', /done=paused/.test(await drive('Pause every shared link', { reason: 'write-test drill' })), true);
  check('ks-w4: a live link now shows the dead-link page (D-77)', title((await get('/p/dev-jordan', null)).html), deadTitle);
  check('ks-w5: switching back on works', /done=resumed/.test(await drive('Switch shared links back on', { reason: 'drill over' })), true);
  check('ks-w6: and the same link is live again', title((await get('/p/dev-jordan', null)).html), jordanLive);
  const log = (await get('/ops/switches', op)).html;
  check('ks-w7: the switch log names the reason', /write-test drill/.test(log) && /drill over/.test(log), true);

  check('ks-w8: switching off every link without the exact words is refused',
    /error=confirm/.test(await drive('Switch off every link', { reason: 'drill', confirm: 'switch off every link', familyReason: 'A drill sentence that families would read here.' })), true);
  check('ks-w9: and nothing was switched off', title((await get('/p/dev-jordan', null)).html), jordanLive);
  check('ks-w9b: without the sentence families will read, nothing is switched off (doc 15 §38)',
    /error=family/.test(await drive('Switch off every link', { reason: 'drill', confirm: 'SWITCH OFF EVERY LINK' })), true);
  check('ks-w9c: and the link still works', title((await get('/p/dev-jordan', null)).html), jordanLive);
  const FAMILY = 'We found a problem that could have let the wrong person open a link, and we are fixing it.';
  const revoked = await drive('Switch off every link', { reason: 'breach drill', confirm: 'SWITCH OFF EVERY LINK', familyReason: FAMILY });
  check('ks-w10: with the words and the sentence, every link goes, and families are told',
    /done=revoked&n=[1-9]\d*&told=[1-9]/.test(revoked), true);
  const mail = (await get('/dev/outbox', op)).html.replace(/&#x27;|&rsquo;|&#39;/g, "'");
  const s38 = [...mail.matchAll(/We've switched off your Pitch share links/g)].length;
  check('ks-w10b: the §38 email went out, with the operator\'s sentence in it', s38 > 0 && mail.includes(FAMILY), true);
  check('ks-w10c: to the parent and to the adult player', /guardian@example\.com/.test(mail) && /player@example\.com/.test(mail), true);
  check('ks-w11: the fixture link is dead', title((await get('/p/dev-jordan', null)).html), deadTitle);
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

console.log(`\n${pass} passed, ${failures.length} failed${failures.length ? ' - ' + failures.join('; ') : ' - ALL GREEN'}`);
console.log('NOTE: this mutated the dev database. Restart scripts/dev-db.mts for a clean one.');
process.exit(failures.length ? 1 : 0);
