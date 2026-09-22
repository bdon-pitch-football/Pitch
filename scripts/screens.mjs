// SCREENS — capture the whole product as pictures, so it can be judged by eye.
//
// The layout check measures; this one photographs. Every page, as every seat,
// at phone, tablet and laptop width, full height, written as PNGs the design
// team can open. It also records how much of each laptop screen is empty
// background, which is the question BUZ asked on 23 Sep.
//
// No dependencies: the installed Chrome over the DevTools protocol.
// Needs the dev app (3000) and the dev database.
//
//   node scripts/screens.mjs                      # 390, 820, 1280 → docs/design/screens/
//   node scripts/screens.mjs --widths 1280        # one width
//   node scripts/screens.mjs --out /tmp/shots     # somewhere else
//   node scripts/screens.mjs --base http://localhost:3030   # the club demo
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const BASE = arg('base', process.env.RENDER_BASE ?? 'http://localhost:3000');
const OUT = arg('out', fileURLToPath(new URL('../docs/design/screens', import.meta.url)));
const WIDTHS = arg('widths', '390,820,1280').split(',').map(Number).filter(Boolean);
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9334;

const ids = JSON.parse(readFileSync(new URL('../.dev-ids.json', import.meta.url), 'utf8'));
const cookieFor = (p) => `${p}.${createHmac('sha256', process.env.SESSION_SECRET || 'dev-only-secret-not-for-production').update(p).digest('base64url')}`;
const SEATS = {
  'signed-out': null,
  player: ids.people.jordan,
  'player-16-17': ids.children.nate.child_id,
  parent: ids.people.alex,
  coach: ids.people.sam,
  'club-td': ids.people.marina,
  'club-admin': ids.people.pat,
  'brand-new': ids.people.robin,
};
const PUBLIC_PATHS = ['/signin', '/join', '/trials', '/p/dev-deniz', '/fc/riverside-fc', '/c/sam-kaya', '/jobs', '/report', '/privacy', '/terms'];

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'pitch-screens-'))}`, 'about:blank',
], { stdio: 'ignore' });
const stop = () => { try { chrome.kill(); } catch { /* gone */ } };
process.on('exit', stop);

let target;
for (let i = 0; i < 50 && !target; i++) {
  await new Promise((r) => setTimeout(r, 200));
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* not up */ }
}
if (!target) { console.error('Chrome did not start. Set CHROME_PATH.'); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0; const waiting = new Map(); const events = [];
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
const evaluate = async (expr) => JSON.parse((await cdp('Runtime.evaluate', { expression: expr, returnByValue: true })).result.result.value);

// How much of the first screenful is background nobody drew anything on: the
// share of the viewport that no content box covers, measured in 24px cells so
// a gap between cards does not read as content.
const EMPTINESS = (w, h) => `(() => {
  const cell = 24, cols = Math.ceil(${w} / cell), rows = Math.ceil(${h} / cell);
  const grid = new Uint8Array(cols * rows);
  for (const el of document.querySelectorAll('body *')) {
    if (!el.getClientRects().length) continue;
    const s = getComputedStyle(el);
    const paints = (s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)')
      || (s.borderTopWidth !== '0px' || s.borderLeftWidth !== '0px')
      || (el.childElementCount === 0 && (el.textContent || '').trim().length > 0)
      || el.tagName === 'IMG' || el.tagName === 'SVG';
    if (!paints) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > ${h} || r.right < 0 || r.left > ${w}) continue;
    for (let y = Math.max(0, Math.floor(r.top / cell)); y < Math.min(rows, Math.ceil(r.bottom / cell)); y++) {
      for (let x = Math.max(0, Math.floor(r.left / cell)); x < Math.min(cols, Math.ceil(r.right / cell)); x++) grid[y * cols + x] = 1;
    }
  }
  let filled = 0; for (const g of grid) filled += g;
  const body = document.body.getBoundingClientRect();
  const content = [...document.querySelectorAll('body > div, main, .console, .reading')]
    .map((e) => e.getBoundingClientRect()).filter((r) => r.width > 100);
  const widest = content.length ? Math.max(...content.map((r) => r.width)) : body.width;
  return JSON.stringify({
    emptyPercent: Math.round((1 - filled / grid.length) * 100),
    contentWidth: Math.round(widest),
    sideGutter: Math.round((${w} - widest) / 2),
    pageHeight: Math.round(document.documentElement.scrollHeight),
  });
})()`;

mkdirSync(OUT, { recursive: true });
const rows = [];
for (const width of WIDTHS) {
  const height = width < 500 ? 844 : width < 1000 ? 1180 : 800;
  await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  for (const [seat, who] of Object.entries(SEATS)) {
    await cdp('Network.clearBrowserCookies');
    if (who) await cdp('Network.setCookie', { name: 'pitch_session', value: cookieFor(who), url: BASE });
    let paths = who ? [] : PUBLIC_PATHS;
    if (who) {
      await cdp('Page.navigate', { url: `${BASE}/home` }); await loaded();
      const links = await evaluate(`JSON.stringify([...new Set([...document.querySelectorAll('a[href^="/"]')].map(a => a.getAttribute('href').split('#')[0]))])`);
      paths = ['/home', ...links.filter((p) => !/^\/(signout|api\/)/.test(p))].slice(0, 25);
    }
    for (const path of paths) {
      await cdp('Page.navigate', { url: BASE + path }); await loaded();
      await new Promise((r) => setTimeout(r, 350));
      const m = await evaluate(EMPTINESS(width, height));
      const name = `${width}-${seat}-${(path === '/' ? 'root' : path.slice(1)).replace(/[^a-z0-9]+/gi, '_').slice(0, 60)}.png`;
      const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      if (shot.result?.data) writeFileSync(join(OUT, name), Buffer.from(shot.result.data, 'base64'));
      rows.push({ width, seat, path, file: name, ...m });
    }
  }
}
stop();

writeFileSync(join(OUT, 'index.json'), JSON.stringify(rows, null, 2) + '\n');
const wide = rows.filter((r) => r.width >= 1000).sort((a, b) => b.emptyPercent - a.emptyPercent);
console.log(`\n${rows.length} screens written to ${OUT}`);
console.log('\nEmptiest at laptop width (share of the first screenful with nothing drawn on it):');
for (const r of wide.slice(0, 15)) {
  console.log(`  ${String(r.emptyPercent).padStart(3)}%  ${r.seat.padEnd(12)} ${r.path.padEnd(34)} content ${r.contentWidth}px, gutter ${r.sideGutter}px each side`);
}
