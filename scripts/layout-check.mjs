// LAYOUT CHECK — every page, as every seat, at phone width, measured in a real
// browser. The render suite reads HTML and cannot see a layout; the 21 Sep
// overflow (Build your CV 444px wide on a 390px phone, the form 54px off the
// left edge) was found by a content capture, not by us. This is the check
// that should have found it.
//
// No dependencies: it drives the installed Chrome over the DevTools protocol
// with Node's own WebSocket. Needs the dev server (localhost:3000) and the dev
// database; reads .dev-ids.json for the seats.
//
//   node scripts/layout-check.mjs            375px (default)
//   node scripts/layout-check.mjs 390 1280   any widths
//
// GIVE IT THE BAND EDGES. D-147's console breakpoints are 768 and 1024, and
// the 1024 overflow this check now pins lived in an 8px band (1024-1031) that
// 375 and 1280 cannot see. The console widths are
//   375 768 820 834 1023 1024 1031 1032 1280
// — a phone, the table's first pixel, two iPads, both sides of the rail
// breakpoint, both sides of where the old spill resolved, and a laptop.
//
// A page FAILS when the document is wider than the viewport. The report names
// the widest element, which is almost always the one to fix.
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.RENDER_BASE ?? 'http://localhost:3000';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// The DevTools port, not a product port. Two seats running this at once in two
// worktrees would otherwise attach to each other's browser and measure each
// other's app (L30), so a seat can move it the way PITCH_DEV_DB_PORT moves the
// database. Unset is 9333, unchanged for anyone who sets nothing.
const PORT = Number(process.env.LAYOUT_CDP_PORT) || 9333;
const widths = process.argv.slice(2).map(Number).filter(Boolean);
if (widths.length === 0) widths.push(375);

const ids = JSON.parse(readFileSync(new URL('../.dev-ids.json', import.meta.url), 'utf8'));
const cookieFor = (p) => `${p}.${createHmac('sha256', process.env.SESSION_SECRET || 'dev-only-secret-not-for-production').update(p).digest('base64url')}`;
const SEATS = {
  'signed out': null,
  player: ids.people.jordan, 'player 16-17': ids.children.nate.child_id, parent: ids.people.alex,
  coach: ids.people.sam, 'club TD': ids.people.marina, 'club admin': ids.people.pat, 'brand new': ids.people.robin,
};
const START = { 'signed out': ['/signin', '/join', '/trials', '/p/dev-deniz', '/fc/riverside-fc', '/c/sam-kaya', '/report'] };
// Pages more than one step from home, where the walk above never lands. QA
// found (22 Sep) that the squad flows — the family's club picker, one squad's
// page, a parent's preview of an under-16 — were measured by nothing. Each is
// checked to have actually RENDERED for that seat: a redirect home or a 404 is
// a failure here, because a page that was never shown was never measured.
// '@squad' is replaced by the first squad the TD's squads list links to.
const g = ids.children.georgia, riverside = ids.clubs['riverside-fc'];
const DEEP = {
  // The confirm-your-address page (0056) is reached only from an email, so
  // the walk above never lands on it. /confirm/dev-unproved is the seed's
  // known link, the same idea as the dev share tokens.
  'signed out': ['/confirm/dev-unproved'],
  parent: [`/squad/${g.child_id}?back=controls`, `/squad/${g.child_id}?club=${riverside}&back=controls`,
    `/build/${ids.children.deniz.record_id}/preview`, `/g/pending/${ids.children.deniz.record_id}`],
  player: [`/squad/${ids.people.jordan}`, `/squad/${ids.people.jordan}?club=${riverside}`],
  // The operator console: nothing in the product links to it (render suite
  // s4), so the walk never lands on it and neither the queue nor the call
  // sheet — the most field-dense form we have — had ever been measured. In
  // development any signed-in person with an address is an operator
  // (lib/ops-policy), and Marina is the seat the render suite drives it with.
  'club TD': ['@squad', '@squad?pos=GK', '/ops/verification', `/ops/call/${riverside}`],
  'club admin': ['@squad'],
};

// ---- a minimal DevTools client ---------------------------------------------
// The profile directory is REMOVED on the way out. Chrome writes 60–160MB of
// cache into it per run, and this script used to leak one every time it was
// called: the device audit found 45 orphans totalling 4.1GB, which is what
// took this machine to zero free disk twice in one week and killed a running
// demo and an agent's shell. The screenshots themselves cost 42MB. The tool
// was the problem, not the pictures (L36).
const PROFILE = mkdtempSync(join(tmpdir(), 'pitch-layout-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: 'ignore' });
const stop = () => {
  try { chrome.kill(); } catch { /* gone */ }
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* already gone */ }
};
process.on('exit', stop);

let target;
for (let i = 0; i < 50 && !target; i++) {
  await new Promise((r) => setTimeout(r, 200));
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ }
}
if (!target) { console.error('Chrome did not start. Set CHROME_PATH if it is somewhere else.'); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const waiting = new Map();
const events = [];
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
  else if (msg.method) events.push(msg);
});
const cdp = (method, params = {}) => new Promise((resolve) => {
  const id = ++seq; waiting.set(id, resolve); ws.send(JSON.stringify({ id, method, params }));
});
const loaded = () => new Promise((resolve) => {
  const start = Date.now();
  const tick = () => {
    const i = events.findIndex((e) => e.method === 'Page.loadEventFired');
    if (i >= 0) { events.splice(0, i + 1); resolve(true); }
    else if (Date.now() - start > 30000) resolve(false);
    else setTimeout(tick, 50);
  };
  tick();
});
await cdp('Page.enable');
await cdp('Network.enable');

// What the page measures about itself, against the DEVICE width we set — not
// window.innerWidth. In phone emulation (and on a real phone) the browser
// widens its layout viewport to fit an overflowing page, so innerWidth grows
// with the overflow and the page can never look wider than "the screen". The
// self-test below caught exactly that: the first version of this check was
// blind and reported all green. The widest element is named by a short
// selector — tag, id, first class — enough to find it.
const MEASURE = (device) => `(() => {
  const vw = ${device}, doc = document.documentElement.scrollWidth;
  let widest = null, w = 0;
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    const over = Math.max(r.right - vw, -r.left);
    if (over > w) { w = over; widest = el; }
  }
  const name = (el) => el ? el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList[0] ? '.' + el.classList[0] : '') : '';
  const text = widest ? (widest.innerText || '').trim().slice(0, 40).replace(/\\s+/g, ' ') : '';
  return JSON.stringify({ vw, doc, over: Math.round(w), widest: name(widest), text });
})()`;

const eval_ = async (expr) => JSON.parse((await cdp('Runtime.evaluate', { expression: expr, returnByValue: true })).result.result.value);
const visit = async (path) => { await cdp('Page.navigate', { url: BASE + path }); await loaded(); await new Promise((r) => setTimeout(r, 250)); };

// A check that cannot fail is not a check. Before any page is trusted, prove
// the measurement catches a page that IS too wide.
await cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 844, deviceScaleFactor: 1, mobile: true });
await cdp('Page.navigate', { url: 'data:text/html,<meta name=viewport content="width=device-width"><div style="width:600px">too wide</div>' });
await loaded();
const control = await eval_(MEASURE(375));
if (!(control.doc > control.vw + 1)) {
  console.error(`SELF-TEST FAILED: a 600px page measured ${control.doc}px on a ${control.vw}px screen. The check is blind; nothing below would mean anything.`);
  stop(); process.exit(2);
}

const failures = [];
let checked = 0;
for (const width of widths) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 768 });
  for (const [seat, who] of Object.entries(SEATS)) {
    await cdp('Network.clearBrowserCookies');
    if (who) await cdp('Network.setCookie', { name: 'pitch_session', value: cookieFor(who), url: BASE });
    // Every page this seat can reach from home in one step, plus the fixed
    // public set when signed out — the same reach the render suite walks.
    let paths = START[seat] ?? [];
    if (who) {
      await visit('/home');
      const links = await eval_(`JSON.stringify([...new Set([...document.querySelectorAll('a[href^="/"]')].map(a => a.getAttribute('href').split('#')[0]))])`);
      paths = ['/home', ...links.filter((p) => !/^\/(signout|dev\/|api\/)/.test(p))].slice(0, 40);
    }
    for (const path of paths) {
      await visit(path);
      const m = await eval_(MEASURE(width));
      checked++;
      if (m.doc > m.vw + 1) failures.push({ width, seat, path, ...m });
    }
    if (DEEP[seat]) {
      if (seat.startsWith('club')) await visit('/club/squads');
      const squad = seat.startsWith('club') ? await eval_(`JSON.stringify(document.querySelector('a[href^="/club/squads/"]')?.getAttribute('href') ?? '')`) : '';
      for (const path of DEEP[seat].map((p) => p.replace('@squad', squad))) {
        await visit(path);
        // The 404 used to be Next's stock page and was recognised by its
        // words. It is app/not-found.tsx now, and its words are a proposal
        // awaiting BUZ — so this reads the marker attribute the failure shell
        // carries instead (L32: a suite that reads a page is reading a
        // fixture, so pin it to something that does not move with the copy).
        const where = await eval_(`JSON.stringify({ at: location.pathname + location.search, missing: Boolean(document.querySelector('[data-failure="not-found"]')) })`);
        checked++;
        if (where.at !== path || where.missing) { failures.push({ width, seat, path, unrendered: where.missing ? '404' : `landed on ${where.at}` }); continue; }
        const m = await eval_(MEASURE(width));
        if (m.doc > m.vw + 1) failures.push({ width, seat, path, ...m });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// THE FAILURE PATH, AS A PERSON SEES IT (28 Sep).
//
// This is the only suite with a browser, and the failure path needs one for
// two reasons. A colour is not a fact until something computes it: the stock
// Next 404 forces `body{color:#000;background:#fff}` inline, and on a
// dark-only product (the charter: Night Match IS the brand) the only honest
// way to say "that is not white any more" is to ask the browser. And the 500
// page is a Client Component, because Next requires an error boundary to be
// one — so its markup is in a JS chunk and not in the document a fetch reads.
// Everything a fetch CAN see is in the render suite (fp1–fp14).
//
// Four surfaces: a mistyped URL, a dead club slug (a notFound() from inside a
// route, which arrives differently), a route that threw, and the screen after
// somebody reports a concern about a child.
const NIGHT = new Set(['rgb(11, 18, 14)', 'rgb(7, 11, 9)', 'rgb(18, 27, 22)', 'rgb(26, 36, 32)', 'rgb(14, 23, 18)']);
const FAILURE_VIEWS = [
  ['a mistyped URL', '/no-such-page'],
  ['a dead club slug', '/fc/no-such-club'],
  ['a route that threw', '/dev/boom'],
  ['the screen after a report', '/report?done=1'],
];
const SEEN = `(() => {
  const h1 = document.querySelector('h1');
  const mark = [...document.querySelectorAll('svg')].some((s) => s.querySelector('circle') && s.closest('a, div'))
    && /P\\s*TCH|PTCH/.test(document.body.innerText.replace(/\\s+/g, ''));
  const home = [...document.querySelectorAll('a[href]')].some((a) => {
    const h = a.getAttribute('href');
    return h === '/' || h === '/home' || h === '/signin';
  });
  const bg = getComputedStyle(document.body).backgroundColor;
  const ink = getComputedStyle(document.body).color;
  return JSON.stringify({ h1: h1 ? h1.innerText.trim().slice(0, 60) : '', mark, home, bg, ink });
})()`;
await cdp('Network.clearBrowserCookies');
let failureChecks = 0;
for (const width of widths) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 768 });
  for (const [what, path] of FAILURE_VIEWS) {
    await visit(path);
    const seen = await eval_(SEEN);
    const m = await eval_(MEASURE(width));
    checked++; failureChecks++;
    const wrong = [];
    if (!seen.h1) wrong.push('no heading');
    if (!seen.mark) wrong.push('no Pitch mark');
    if (!seen.home) wrong.push('no way back');
    if (!NIGHT.has(seen.bg)) wrong.push(`background ${seen.bg}, not a Night Match tone`);
    if (m.doc > m.vw + 1) wrong.push(`${m.doc}px wide on ${m.vw}px`);
    if (wrong.length) failures.push({ width, seat: 'failure path', path, unrendered: `${what} — ${wrong.join('; ')}` });
  }
}

stop();
console.log(`\nlayout check · ${checked} page views at ${widths.join(', ')}px (${failureChecks} of them failure-path views)`);
if (failures.length === 0) {
  console.log('ALL GREEN — nothing is wider than the screen');
  process.exit(0);
}
for (const f of failures) {
  if (f.unrendered) { console.log(`FAIL ${f.width}px · ${f.seat} · ${f.path} — never rendered for this seat (${f.unrendered}), so never measured`); continue; }
  console.log(`FAIL ${f.width}px · ${f.seat} · ${f.path} — page ${f.doc}px wide on a ${f.vw}px screen; widest: ${f.widest} by ${f.over}px${f.text ? ` ("${f.text}")` : ''}`);
}
console.log(`\n${failures.length} page${failures.length === 1 ? '' : 's'} failed (too wide, or never rendered)`);
process.exit(1);
