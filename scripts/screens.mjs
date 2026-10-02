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
//
// THE REGISTERS, AND THEN A RESEED (design audit, 2 Oct). Opening /club/register
// or /coach/register is a read by a named person, logged per registration
// (register_read_log, doc 32 C4a) — and those rows are what a family later
// reads as "seen in the list". So a capture of either page changes the
// fixture every later screen is judged against. --register photographs only
// those two pages, full height (Marina, Riverside's TD; Sam, the coach she
// brought in for two squads), and then reseeds the database it just wrote
// to, so nothing after it ever sees the reads:
//
//   PITCH_DEV_DB_PORT=54621 RENDER_BASE=http://localhost:3421 SCREENS_CDP_PORT=9621 \
//     node scripts/screens.mjs --register --widths 375,820,1280 --out <dir>
//
// Run it LAST in a capture run, then restart `next dev` (L7, TRAINING §4)
// before anything else reads the database. It stops a database by its port
// and never by name (L8), so the port is required, and the demo's is refused.
import { execFileSync, spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
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
// A fixed port is a shared resource: two seats capturing at once fight over
// it exactly as they fought over the dev database (L30). Moves like
// LAYOUT_CDP_PORT does for the layout check.
const PORT = Number(process.env.SCREENS_CDP_PORT) || 9334;
const REGISTER = process.argv.includes('--register');
const DB_PORT = Number(process.env.PITCH_DEV_DB_PORT);
if (REGISTER && (!Number.isInteger(DB_PORT) || DB_PORT < 1024 || DB_PORT > 65535 || DB_PORT === 54323)) {
  console.error('--register reseeds the database afterwards, so it needs the port you seeded it on: set PITCH_DEV_DB_PORT (never 54323, the demo\u2019s).');
  process.exit(1);
}

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
const cookieFor = (p) => { const t = sessionToken(p); return `${t}.${createHmac('sha256', process.env.SESSION_SECRET || 'dev-only-secret-not-for-production').update(t).digest('base64url')}`; };
const SEATS = REGISTER ? { 'club-td': ids.people.marina, coach: ids.people.sam } : {
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
// Pages more than one step from home. This tool walks /home and follows what
// it finds, so anything two clicks deep was photographed by nothing — which is
// the whole reason /squad/[personId]?back=controls has no screenshot at any
// width, reported twice and never explained (QA, 28 Sep). The layout check has
// carried this list since 22 Sep; the capture tool never did.
//
// A cold route is the other half of that report: the first request to /squad
// in a dev server measured 28.07s on this machine against loaded()'s 30s cap,
// so a capture of an uncompiled page looks exactly like a hang. Each of these
// is fetched once before Chrome is pointed at it, which takes the compile off
// the clock.
const g = ids.children.georgia, riverside = ids.clubs['riverside-fc'];
const DEEP = REGISTER ? { 'club-td': ['/club/register'], coach: ['/coach/register'] } : {
  parent: [`/squad/${g.child_id}?back=controls`, `/squad/${g.child_id}?club=${riverside}&back=controls`,
    `/g/controls/${g.child_id}`, `/build/${ids.children.deniz.record_id}/preview`,
    `/g/pending/${ids.children.deniz.record_id}`],
  player: [`/squad/${ids.people.jordan}`],
  'club-td': ['/ops/verification', `/ops/call/${riverside}`],
};

// The profile directory is REMOVED on the way out. Chrome writes 60–160MB of
// cache into it per run, and this script used to leak one every time it was
// called: the device audit found 45 orphans totalling 4.1GB, which is what
// took this machine to zero free disk twice in one week and killed a running
// demo and an agent's shell. The screenshots themselves cost 42MB. The tool
// was the problem, not the pictures (L36).
const PROFILE = mkdtempSync(join(tmpdir(), 'pitch-screens-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: 'ignore' });
const stop = () => {
  try { chrome.kill(); } catch { /* gone */ }
  // Chrome's helper processes outlive the parent's kill by a moment and hold
  // files in the profile, so a single rmSync can throw and leave the whole
  // thing behind. Measured today: an interrupted run leaked 146MB, which is
  // L36 — the fault that took this machine to zero disk twice — arriving
  // through the error path instead of the happy one. Retry briefly.
  for (let i = 0; i < 40; i++) {
    try { rmSync(PROFILE, { recursive: true, force: true }); return; } catch { /* still held */ }
    const until = Date.now() + 50; while (Date.now() < until) { /* sync wait: this runs on exit */ }
  }
};
process.on('exit', stop);
// A signalled process does not run its 'exit' handlers, and a headless run is
// exactly the kind of thing somebody stops with a keystroke.
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { stop(); process.exit(130); });

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
  if (msg.id && waiting.has(msg.id)) { const w = waiting.get(msg.id); waiting.delete(msg.id); w.resolve(msg); }
  else if (msg.method) events.push(msg);
});
// A deadline per call — the same defect the layout check carried (QA,
// 28 Sept). Without it a browser that stops answering hangs this tool
// forever, silently, and the report reads "it hung on <whatever page it was
// on>" — which is how /squad/[personId]?back=controls got blamed twice.
const CDP_TIMEOUT_MS = Number(process.env.SCREENS_CDP_TIMEOUT_MS) || 60000;
let lastPath = '(startup)';
const failAll = (why) => {
  for (const [id, entry] of waiting) { waiting.delete(id); entry.reject(new Error(why)); }
};
ws.addEventListener('close', () => failAll('Chrome closed the debugging socket'));
ws.addEventListener('error', () => failAll('the debugging socket errored'));
const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  const timer = setTimeout(() => {
    waiting.delete(id);
    reject(new Error(`Chrome stopped answering: ${method} got no reply in ${CDP_TIMEOUT_MS}ms, at ${lastPath}`));
  }, CDP_TIMEOUT_MS);
  waiting.set(id, { resolve: (msg) => { clearTimeout(timer); resolve(msg); },
                    reject: (e) => { clearTimeout(timer); reject(e); } });
  try { ws.send(JSON.stringify({ id, method, params })); }
  catch (e) { clearTimeout(timer); waiting.delete(id); reject(e); }
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
    if (who && !REGISTER) {
      await cdp('Page.navigate', { url: `${BASE}/home` }); await loaded();
      const links = await evaluate(`JSON.stringify([...new Set([...document.querySelectorAll('a[href^="/"]')].map(a => a.getAttribute('href').split('#')[0]))])`);
      paths = ['/home', ...links.filter((p) => !/^\/(signout|api\/)/.test(p))].slice(0, 25);
    }
    for (const p of DEEP[seat] ?? []) if (!paths.includes(p)) paths.push(p);
    // Warm every route first: a cold compile is not a hang, but it reads as
    // one (see DEEP above).
    for (const p of paths) {
      try { await fetch(BASE + p, { headers: who ? { cookie: `pitch_session=${cookieFor(who)}` } : {} }); } catch { /* the capture below reports it */ }
    }
    for (const path of paths) {
      lastPath = path;
      await cdp('Page.navigate', { url: BASE + path }); await loaded();
      await new Promise((r) => setTimeout(r, 350));
      const m = await evaluate(EMPTINESS(width, height));
      const name = `${width}-${seat}-${(path === '/' ? 'root' : path.slice(1)).replace(/[^a-z0-9]+/gi, '_').slice(0, 60)}.png`;
      // A register is a long list, so --register takes the whole page.
      const shot = await cdp('Page.captureScreenshot', REGISTER
        ? { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: Math.max(height, m.pageHeight), scale: 1 } }
        : { format: 'png', captureBeyondViewport: false });
      if (shot.result?.data) writeFileSync(join(OUT, name), Buffer.from(shot.result.data, 'base64'));
      rows.push({ width, seat, path, file: name, ...m });
    }
  }
}
stop();

writeFileSync(join(OUT, 'index.json'), JSON.stringify(rows, null, 2) + '\n');
if (REGISTER) {
  // Every read those pages logged goes with the database: stop it by its
  // port (L8), start a fresh seed on the same port, and wait for it.
  const listening = () => {
    try { return execFileSync('lsof', ['-ti', `:${DB_PORT}`, '-sTCP:LISTEN']).toString().trim().split('\n').filter(Boolean).map(Number); }
    catch { return []; }
  };
  for (const pid of listening()) process.kill(pid);
  for (let i = 0; i < 100 && listening().length; i++) await new Promise((r) => setTimeout(r, 100));
  const log = join(tmpdir(), `pitch-reseed-${DB_PORT}.log`);
  const fd = openSync(log, 'w');
  spawn(process.execPath, [fileURLToPath(new URL('./dev-db.mts', import.meta.url))], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), env: { ...process.env, PITCH_DEV_DB_PORT: String(DB_PORT) },
    detached: true, stdio: ['ignore', fd, fd],
  }).unref();
  closeSync(fd);
  let ready = false;
  for (let i = 0; i < 360 && !ready; i++) {
    await new Promise((r) => setTimeout(r, 500));
    ready = existsSync(log) && /db ready on/.test(readFileSync(log, 'utf8'));
  }
  console.log(`\n${rows.length} register screens written to ${OUT}`);
  console.log(ready
    ? `Reseeded on ${DB_PORT}: the reads those pages logged are gone. Restart next dev before anything else reads it. (log: ${log})`
    : `THE RESEED DID NOT COME UP on ${DB_PORT} — the reads are gone with the old database, but there is no new one. See ${log}.`);
  process.exit(ready ? 0 : 1);
}
const wide = rows.filter((r) => r.width >= 1000).sort((a, b) => b.emptyPercent - a.emptyPercent);
console.log(`\n${rows.length} screens written to ${OUT}`);
console.log('\nEmptiest at laptop width (share of the first screenful with nothing drawn on it):');
for (const r of wide.slice(0, 15)) {
  console.log(`  ${String(r.emptyPercent).padStart(3)}%  ${r.seat.padEnd(12)} ${r.path.padEnd(34)} content ${r.contentWidth}px, gutter ${r.sideGutter}px each side`);
}
