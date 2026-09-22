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
// A page FAILS when the document is wider than the viewport. The report names
// the widest element, which is almost always the one to fix.
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.RENDER_BASE ?? 'http://localhost:3000';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
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
  parent: [`/squad/${g.child_id}?back=controls`, `/squad/${g.child_id}?club=${riverside}&back=controls`,
    `/build/${ids.children.deniz.record_id}/preview`, `/g/pending/${ids.children.deniz.record_id}`],
  player: [`/squad/${ids.people.jordan}`, `/squad/${ids.people.jordan}?club=${riverside}`],
  'club TD': ['@squad', '@squad?pos=GK'],
  'club admin': ['@squad'],
};

// ---- a minimal DevTools client ---------------------------------------------
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'pitch-layout-'))}`, 'about:blank',
], { stdio: 'ignore' });
const stop = () => { try { chrome.kill(); } catch { /* gone */ } };
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
        const where = await eval_(`JSON.stringify({ at: location.pathname + location.search, missing: document.body.innerText.includes('This page could not be found') })`);
        checked++;
        if (where.at !== path || where.missing) { failures.push({ width, seat, path, unrendered: where.missing ? '404' : `landed on ${where.at}` }); continue; }
        const m = await eval_(MEASURE(width));
        if (m.doc > m.vw + 1) failures.push({ width, seat, path, ...m });
      }
    }
  }
}

stop();
console.log(`\nlayout check · ${checked} page views at ${widths.join(', ')}px`);
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
