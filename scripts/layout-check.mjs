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
//
// IT ALSO RUNS THE CHROME PASS (28 Sep) — three things that are only true in a
// real browser, and were all false when it was first pointed at them:
//   · THE FOCUS RING. Dispatched Tab keypresses, not el.focus(), because
//     :focus-visible answers differently to the two. Every form control the
//     keyboard reaches must show a 2px ring, at 390 and 1280.
//   · .field-label. Every caption carrying the class must compute to 10px.
//     Written as `.field > .field-label`, the rule missed 19 captions that
//     are not children of a .field and they rendered as body text.
//   · body. The page must paint --bg and not the unnamed sixth level
//     (#070b09) that sat under everything.
//
// AND THE CONTENT-SECURITY-POLICY (D-94 §8, 28 Sep). Every page view fails if
// the browser refused anything under the policy (lib/csp.ts) — a policy that
// blocks the product's own scripts, fonts or images is broken, and one that
// has never been read in a browser is a guess. Before any of that is trusted,
// an inline script is injected into a real page, served with its real header,
// and must be REFUSED — and the same page served without the header must run
// it, or the probe cannot tell the two apart (L19).
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
const g = ids.children.georgia, riverside = ids.clubs['riverside-fc'], westgate = ids.clubs['westgate-rangers'];
const DEEP = {
  // The confirm-your-address page (0056) is reached only from an email, so
  // the walk above never lands on it. /confirm/dev-unproved is the seed's
  // known link, the same idea as the dev share tokens.
  // 0160 (30 Sep): the club's stop page is reached only from the CV email.
  'signed out': ['/confirm/dev-unproved', '/stop-cvs'],
  parent: [`/squad/${g.child_id}?back=controls`, `/squad/${g.child_id}?club=${riverside}&back=controls`,
    `/build/${ids.children.deniz.record_id}/preview`, `/g/pending/${ids.children.deniz.record_id}`],
  player: [`/squad/${ids.people.jordan}`, `/squad/${ids.people.jordan}?club=${riverside}`],
  // 0160: "Send my CV" from a club's page — the address filled in with its
  // line underneath, and a club that asked Pitch to stop.
  'player 16-17': [`/send/${ids.children.nate.record_id}?club=brindlewood-rovers-sc`,
    `/send/${ids.children.nate.record_id}?club=wrenmoor-wanderers-fc`],
  // The operator console: nothing in the product links to it (render suite
  // s4), so the walk never lands on it and neither the queue nor the call
  // sheet — the most field-dense form we have — had ever been measured. In
  // development any signed-in person with an address is an operator
  // (lib/ops-policy), and Marina is the seat the render suite drives it with.
  // Brief G (29 Sep) adds the rest of the console: the report desk, support
  // and the switches were measured by nothing either.
  'club TD': ['@squad', '@squad?pos=GK', '/ops', '/ops/verification', `/ops/call/${riverside}`,
    '/ops/reports', '/ops/support', '/ops/support?q=guardian@example.com', '/ops/switches',
    // Brief I (29 Sep): the clubs directory, one club of each kind, adding a
    // listing and adding a compiled notice — the rows stack under 768 and must
    // pass the squeeze rule like the queue's.
    '/ops/clubs', '/ops/clubs?q=altona', '/ops/clubs/new', `/ops/clubs/${westgate}`, `/ops/clubs/${westgate}/trial`,
    `/ops/clubs/${riverside}`],
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
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ }
}
if (!target) { console.error('Chrome did not start. Set CHROME_PATH if it is somewhere else.'); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const waiting = new Map();
const events = [];
const cspConsole = [];
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && waiting.has(msg.id)) { const w = waiting.get(msg.id); waiting.delete(msg.id); w.resolve(msg); }
  // Console lines about the policy are kept apart from the page events, so
  // loaded() never throws one away while it looks for the load event.
  else if (msg.method === 'Log.entryAdded') {
    if (/Content Security Policy/i.test(msg.params?.entry?.text ?? '')) cspConsole.push(msg.params.entry.text);
  }
  else if (msg.method) events.push(msg);
});
// EVERY CDP CALL HAS A DEADLINE (QA, 28 Sept).
//
// This used to be a promise nothing could ever reject. `loaded()` below caps
// itself at 30s, and it was the ONLY thing here that did — Page.navigate,
// Runtime.evaluate, Network.setCookie and setDeviceMetricsOverride all waited
// forever. So when Chrome's debugging endpoint stopped answering (measured:
// /json/list returned nothing while the Chrome processes sat alive at 0% CPU,
// and the dev app served the same page in 0.16s), this run sat for 34 minutes
// having written NOTHING to its log, because it only prints at the end. From
// outside, a wedged browser and a slow one look identical.
//
// That is the honest answer to "/squad/[personId]?back=controls hung a
// headless capture twice and has no screenshot at any width". It is not that
// page: it is whichever page the walk happened to be on. A hang with no
// output names an innocent bystander, and two people went looking at it.
//
// Now: a deadline per call, the socket closing rejects everything in flight,
// and the failure names the last path attempted. A tool that stops must SAY
// it stopped.
const CDP_TIMEOUT_MS = Number(process.env.LAYOUT_CDP_TIMEOUT_MS) || 60000;
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
await cdp('Log.enable');
// Every document records its own policy violations from before its first
// script runs. A script the debugger adds is not subject to the page's CSP,
// so this watcher is never itself the thing refused.
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(
    e.effectiveDirective + ' refused ' + (e.blockedURI || 'inline') + (e.sourceFile ? ' (' + e.sourceFile.split('?')[0] + ':' + e.lineNumber + ')' : '')));` });
const cspFails = [];
// What the page refused, from the page's own record and from the console. Read
// after every page view; a view that refused anything is a failure.
const cspDrain = async (width, seat, path) => {
  let seen = [];
  try { seen = JSON.parse((await cdp('Runtime.evaluate', { expression: 'JSON.stringify(window.__csp ?? [])', returnByValue: true })).result.result.value ?? '[]'); }
  catch { /* a page that never loaded is reported by the walk */ }
  const console_ = cspConsole.splice(0);
  if (seen.length || console_.length) cspFails.push({ width, seat, path, refused: [...new Set([...seen, ...console_.map((t) => t.slice(0, 140))])] });
};

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
const visit = async (path) => {
  lastPath = path;
  await cdp('Page.navigate', { url: BASE + path });
  await loaded();
  await new Promise((r) => setTimeout(r, 250));
};

// ---- the chrome pass -------------------------------------------------------
// A real Tab keypress, sent to the renderer. el.focus() is not the same event:
// :focus-visible is about HOW focus arrived, so a script that calls focus()
// can report a ring the keyboard never gets, and — as here — the reverse.
const TAB = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 };
const pressTab = async () => {
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', ...TAB });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', ...TAB });
};
// What has focus now, and what the ring on it actually computes to.
// The ELEMENT is marked, not its name, because "wrapped around to the start"
// has to be about identity. Four role chips on /join are four buttons with no
// name and no aria-label, so a name-based wrap test called the second one a
// repeat and stopped four tabs in — before the first field. It reported "the
// keyboard reached no form control", which was the instrument's answer and not
// the page's.
const FOCUSED = `(() => {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return 'null';
  const cs = getComputedStyle(el);
  const again = el.hasAttribute('data-tabbed');
  el.setAttribute('data-tabbed', '1');
  const name = el.tagName.toLowerCase() + (el.type ? '[' + el.type + ']' : '')
    + (el.name ? ' ' + el.name : (el.getAttribute('aria-label') ? ' "' + el.getAttribute('aria-label') + '"' : ''));
  return JSON.stringify({ name, again, control: /^(input|select|textarea)$/.test(el.tagName.toLowerCase()),
    style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) || 0, colour: cs.outlineColor });
})()`;
// Tab through a page and hand back every control the keyboard landed on.
const tabThrough = async (limit = 90) => {
  const seen = [];
  for (let i = 0; i < limit; i++) {
    await pressTab();
    const f = await eval_(FOCUSED);
    if (f === null) continue;
    if (f.again) break; // back to something already visited: the tab ring closed
    seen.push(f);
  }
  return seen;
};
const ringless = (controls) => controls.filter((c) => c.control && (c.style === 'none' || c.width < 2));
// Every caption carrying the class, and what size it came out.
const LABELS = `JSON.stringify([...document.querySelectorAll('.field-label')]
  .map((el) => ({ size: getComputedStyle(el).fontSize, weight: getComputedStyle(el).fontWeight, text: (el.innerText || '').trim().slice(0, 28) }))
  .filter((l) => l.size !== '10px'))`;
const BODYBG = `JSON.stringify(getComputedStyle(document.body).backgroundColor)`;
// TOUCH TARGETS (D-147 constraint 4: >=44px at every width, and the charter's
// two button heights already satisfy it — so anything failing here is a
// component nobody measured). THE EFFECTIVE BOX, not the element: .field is
// usually a <label> wrapping its input, so a 16px input inside a 50px well is
// a 50px target, and an earlier count that measured the element was wrong in
// that direction. A <label> anywhere in the ancestry activates the control it
// labels, so its box is the target.
const TARGETS = `JSON.stringify((() => {
  const box = (el) => {
    const lab = el.closest('label');
    const r = (lab ?? el).getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  };
  const out = [];
  for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button]')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const { w, h } = box(el);
    if (w >= 44 && h >= 44) continue;
    const tag = el.tagName.toLowerCase();
    const href = el.getAttribute('href') ?? '';
    // A link inside running prose is a per-screen layout decision, not a
    // component fault — whether a 16px address in a paragraph becomes a 44px
    // block is a question about that paragraph. Those are reported, not failed.
    // A tel: link is NOT one of them: it is a number a frightened parent taps
    // on a phone, so it is a control whatever it sits inside. (mailto: is
    // treated as prose: every one in the product is a citation in the legal
    // documents, inside a sentence.)
    const prose = tag === 'a' && !/^tel:/.test(href)
      && !!el.parentElement && el.parentElement.textContent.trim().length >= (el.textContent ?? '').trim().length;
    out.push({ what: tag + (el.type ? '[' + el.type + ']' : '') + (href ? ' ' + href.slice(0, 28) : '')
      + ' "' + ((el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)) + '"', w, h, prose });
  }
  return out;
})())`;
// SQUEEZED COLUMNS (brief G, 29 Sep). A page can fit the screen and still be
// unreadable: on /ops/verification at 375px each club row was one flex row of
// four things, the status chip and the button refused to shrink, and the
// club's details were squeezed into a column about one word wide ("claimed /
// by / M. / Harris"), eleven lines deep. Nothing was wider than the screen, so
// the overflow measurement above called it green.
//
// The rule: no element whose OWN text holds words may render narrower than
// 120px while that text wraps to more than three lines. Lines are counted
// from the text's own line boxes (a Range over the element's direct text
// nodes, distinct tops), not guessed from height and line-height, so a tall
// padded box with one line in it is not a squeeze and a <b> inside a sentence
// does not hide one. A failure names the element and the first words of what
// it holds. Hidden elements, the contents of a closed <details> and anything
// inside an <svg> are skipped.
const SQUEEZE_MIN_WIDTH = 120, SQUEEZE_MAX_LINES = 3;
const SQUEEZED = `JSON.stringify((() => {
  const out = [];
  const name = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList[0] ? '.' + el.classList[0] : '');
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg, script, style, noscript')) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && /[A-Za-z]{2,}/.test(n.textContent));
    if (!own.length) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.width >= ${SQUEEZE_MIN_WIDTH}) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    // A closed <details> still lays its contents out (the phone bar's More
    // sheet measured 36px wide while shut), but nobody can see them.
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) continue;
    const tops = new Set();
    for (const n of own) {
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const box of range.getClientRects()) if (box.width > 0) tops.add(Math.round(box.top));
    }
    if (tops.size > ${SQUEEZE_MAX_LINES}) {
      out.push({ what: name(el), w: Math.round(r.width), lines: tops.size,
        text: (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 48) });
    }
  }
  return out;
})())`;
const tokenRgb = (() => {
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const hex = /--bg:\s*(#[0-9a-f]{6})/i.exec(css)[1];
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
})();

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

// The squeeze check's own self-test, both ways (L19): the same sentence in a
// 60px column must be named, and in a 300px column must not be.
await cdp('Page.navigate', { url: 'data:text/html,<meta name=viewport content="width=device-width">'
  + '<div style="display:flex"><div id=narrow style="width:60px;font:14px sans-serif">claimed by M. Harris, club admin</div>'
  + '<div id=wide style="width:300px;font:14px sans-serif">claimed by M. Harris, club admin</div></div>' });
await loaded();
const selfSqueeze = await eval_(SQUEEZED);
if (!selfSqueeze.some((f) => f.what === 'div#narrow') || selfSqueeze.some((f) => f.what === 'div#wide')) {
  console.error('SELF-TEST FAILED: the squeeze check read ' + JSON.stringify(selfSqueeze)
    + ' — it must name a 60px column of words and pass a 300px one, or nothing it reports below means anything.');
  stop(); process.exit(2);
}

// The chrome pass's own self-test, in both directions. A data URL that rebuilds
// the exact cascade that broke: `:focus-visible` at (0,1,0) and
// `input:focus { outline: none }` at (0,1,1) above it. The first field must
// come back with NO ring and the second, carrying !important, must come back
// with one — otherwise the instrument cannot see either answer and nothing it
// says below means anything (L19).
await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
await cdp('Page.navigate', { url: 'data:text/html,<meta name=viewport content="width=device-width">'
  + '<style>:focus-visible{outline:2px solid rgb(61,220,132);outline-offset:2px}'
  + 'input:focus{outline:none}'
  + 'input[name=ok]:focus-visible{outline:2px solid rgb(61,220,132)!important}</style>'
  + '<input name=bad><input name=ok>' });
await loaded();
const selfRing = await tabThrough(4);
const selfBad = selfRing.find((c) => c.name.includes('bad'));
const selfOk = selfRing.find((c) => c.name.includes('ok'));
if (!selfBad || !selfOk || selfBad.style !== 'none' || selfOk.width < 2) {
  console.error('SELF-TEST FAILED: the focus pass read '
    + JSON.stringify({ suppressed: selfBad ?? null, important: selfOk ?? null })
    + ' — it cannot tell a ring from no ring, so nothing it reports below is worth anything.');
  stop(); process.exit(2);
}

// THE POLICY'S OWN SELF-TEST (D-94 §8). A real page, fetched from the app with
// its real header, with one inline script put into its HTML on the way to the
// browser — exactly what a stored XSS in a club's philosophy or a child's
// "About" would look like if escaping ever failed. Served WITH the header, the
// script must not run and the page must record the refusal; served WITHOUT
// the header, the same script must run. If either half fails, the probe cannot
// tell a working policy from a missing one and nothing below about the policy
// means anything.
const injectProbe = async (keepPolicy) => {
  const url = `${BASE}/signin?csp-probe=${keepPolicy ? 'kept' : 'stripped'}`;
  await cdp('Fetch.enable', { patterns: [{ urlPattern: `${BASE}/signin?csp-probe=*`, requestStage: 'Response' }] });
  const nav = cdp('Page.navigate', { url });
  let paused = null;
  for (let i = 0; i < 300 && !paused; i++) {
    const at = events.findIndex((e) => e.method === 'Fetch.requestPaused');
    if (at >= 0) paused = events.splice(at, 1)[0].params;
    else await new Promise((r) => setTimeout(r, 50));
  }
  if (!paused) { await cdp('Fetch.disable'); return { ran: null, refused: [] }; }
  const got = (await cdp('Fetch.getResponseBody', { requestId: paused.requestId })).result;
  const html = got.base64Encoded ? Buffer.from(got.body, 'base64').toString('utf8') : got.body;
  const injected = html.replace('</head>', '<script>window.__injected = 1</script></head>');
  // The body is handed back decoded and one script longer, so the length and
  // encoding headers no longer describe it; everything else is the app's own.
  const headers = (paused.responseHeaders ?? []).filter((h) => !/^(content-length|content-encoding)$/i.test(h.name)
    && (keepPolicy || h.name.toLowerCase() !== 'content-security-policy'));
  await cdp('Fetch.fulfillRequest', { requestId: paused.requestId, responseCode: paused.responseStatusCode ?? 200,
    responseHeaders: headers, body: Buffer.from(injected).toString('base64') });
  await nav;
  await loaded();
  await cdp('Fetch.disable');
  const out = await eval_(`JSON.stringify({ ran: window.__injected === 1, refused: window.__csp ?? [] })`);
  cspConsole.splice(0);
  return { ...out, injectedOk: injected !== html };
};
const withPolicy = await injectProbe(true);
const withoutPolicy = await injectProbe(false);
if (!withPolicy.injectedOk || withPolicy.ran !== false || !withPolicy.refused.some((r) => /^script-src/.test(r)) || withoutPolicy.ran !== true) {
  console.error('SELF-TEST FAILED: the injected inline script '
    + JSON.stringify({ withPolicy, withoutPolicy })
    + ' — it must be refused (and the refusal recorded) under the real header, and run without it.');
  stop(); process.exit(2);
}

const failures = [];
const ringFails = [], labelFails = [], bodyFails = [], tapFails = [], proseSmall = [], squeezeFails = [];
let checked = 0;
// Two builders restructured this loop on the same day: one added the two
// measurements below to every page view, the other wrapped the walk so a
// wedged browser fails loudly instead of hanging for 34 minutes. Both are
// kept — the helper stays outside the try, the walk inside it.
// Two measurements cheap enough to take on every page view the walk already
// makes, so they cover every seat and every width this is called with.
// VERCEL ANALYTICS, AS THE BROWSER RUNS IT (brief C, 29 Sep). The render
// suite reads whether a page SERVES the analytics component (an-r1–r3); this
// reads whether the browser actually started it — window.va, which the
// package defines the moment it injects its script, or the script itself. On
// for a signed-out visitor on the four public pages (the front door, /trials,
// /jobs, a club page) and off everywhere else, for every seat. The four are
// written out here rather than imported from lib/analytics-scope, so a wrong
// list there cannot make this agree with it. The script arrives after
// hydration, so a page that should carry it gets three seconds to; a view
// where it is off and should be on fails, which is what keeps this check from
// being blind (L19): the signed-out /trials and club page are walked at every
// width.
const PUBLIC_PAGES = /^\/(|trials|jobs|fc\/[a-z0-9-]+)$/;
const ANALYTICS_ON = `JSON.stringify(typeof window.va === 'function' || Boolean(document.querySelector('script[src*="vercel-scripts.com"], script[src*="/_vercel/insights/"]')))`;
const analyticsFails = [];
let analyticsOn = 0, analyticsRead = 0;
// Signed out is read from the browser — is a session cookie set? — not from
// the seat's name: round B's front-door views are signed out under a label
// of their own, and the next pass somebody adds will have one too.
const signedOut = async () => !((await cdp('Network.getCookies', { urls: [BASE] })).result.cookies ?? []).some((c) => c.name === 'pitch_session');
// A public address that answered with the failure shell (a club slug that
// does not exist) is not a public page, and carries nothing.
const analyticsPass = async (width, seat, path) => {
  const should = PUBLIC_PAGES.test(path.split(/[?#]/)[0]) && await signedOut()
    && !(await eval_(`JSON.stringify(Boolean(document.querySelector('[data-failure]')))`));
  let on = await eval_(ANALYTICS_ON);
  for (let i = 0; should && !on && i < 30; i++) { await new Promise((r) => setTimeout(r, 100)); on = await eval_(ANALYTICS_ON); }
  analyticsRead++;
  if (on) analyticsOn++;
  if (on !== should) analyticsFails.push({ width, seat, path, on });
};
const squeezePass = async (width, seat, path) => {
  for (const f of await eval_(SQUEEZED)) squeezeFails.push({ width, seat, path, ...f });
};
const chromePass = async (width, seat, path) => {
  await analyticsPass(width, seat, path);
  const labels = await eval_(LABELS);
  if (labels.length) labelFails.push({ width, seat, path, labels });
  const bg = await eval_(BODYBG);
  if (bg !== tokenRgb) bodyFails.push({ width, seat, path, bg });
  const small = await eval_(TARGETS);
  for (const t of small) (t.prose ? proseSmall : tapFails).push({ width, seat, path, ...t });
  await squeezePass(width, seat, path);
};
try {
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
        await cspDrain(width, seat, '/home');
        const links = await eval_(`JSON.stringify([...new Set([...document.querySelectorAll('a[href^="/"]')].map(a => a.getAttribute('href').split('#')[0]))])`);
        paths = ['/home', ...links.filter((p) => !/^\/(signout|dev\/|api\/)/.test(p))].slice(0, 40);
      }
      for (const path of paths) {
        await visit(path);
        const m = await eval_(MEASURE(width));
        checked++;
        if (m.doc > m.vw + 1) failures.push({ width, seat, path, ...m });
        await chromePass(width, seat, path);
        await cspDrain(width, seat, path);
      }
      if (DEEP[seat]) {
        if (seat.startsWith('club')) { await visit('/club/squads'); await cspDrain(width, seat, '/club/squads'); }
        const squad = seat.startsWith('club') ? await eval_(`JSON.stringify(document.querySelector('a[href^="/club/squads/"]')?.getAttribute('href') ?? '')`) : '';
        for (const path of DEEP[seat].map((p) => p.replace('@squad', squad))) {
          await visit(path);
          await cspDrain(width, seat, path);
          // The 404 used to be Next's stock page and was recognised by its
          // words. It is app/not-found.tsx now, and its words are a proposal
          // awaiting BUZ — so this reads the marker attribute the failure
          // shell carries instead (L32: a suite that reads a page is reading a
          // fixture, so pin it to something that does not move with the copy).
          const where = await eval_(`JSON.stringify({ at: location.pathname + location.search, missing: Boolean(document.querySelector('[data-failure="not-found"]')) })`);
          await analyticsPass(width, seat, path);
          checked++;
          if (where.at !== path || where.missing) { failures.push({ width, seat, path, unrendered: where.missing ? '404' : `landed on ${where.at}` }); continue; }
          const m = await eval_(MEASURE(width));
          if (m.doc > m.vw + 1) failures.push({ width, seat, path, ...m });
          await squeezePass(width, seat, path);
          // Today (brief G): every tile the page served is drawn — a real
          // box on the screen with its label and its number showing — and no
          // number is a zero (D-162). At least one must exist, or this reads
          // an empty page as a pass.
          if (path === '/ops') {
            const tiles = await eval_(`JSON.stringify([...document.querySelectorAll('[data-ops-tile]')].map((t) => {
              const r = t.getBoundingClientRect(), kids = [...t.children].map((c) => c.getBoundingClientRect());
              return { label: t.dataset.opsTile, drawn: r.width > 0 && r.height > 0 && kids.every((k) => k.width > 0 && k.height > 0) && r.right <= ${width} + 1,
                value: (t.children[1]?.textContent ?? '').trim() };
            }))`);
            checked++;
            const bad = tiles.filter((t) => !t.drawn || !/^[1-9]\d*$/.test(t.value));
            if (!tiles.length || bad.length) failures.push({ width, seat, path, unrendered: tiles.length ? `Today tiles not drawn, or showing a zero: ${bad.map((t) => `${t.label} "${t.value}"`).join(', ')}` : 'Today drew no tiles at all' });
          }
        }
      }
    }

    // builder-final-b. Two things the walk above cannot land on. The front
    // door (D-164) is behind the launch-day switch, so it is switched on
    // through the app for these five views and off again whatever happens —
    // the render suite's fd0 then proves `/` is the coming-soon page again.
    // And a stat tile (D-160) is closed until it is pressed, so Deniz's CV is
    // measured with every well open, which is its widest state.
    await fetch(`${BASE}/dev/front-door?on=1`, { method: 'POST' });
    try {
      await cdp('Network.clearBrowserCookies');
      for (const path of ['/', '/?for=player', '/?for=parent', '/?for=coach', '/?for=club']) {
        await visit(path);
        const m = await eval_(MEASURE(width));
        checked++;
        if (m.doc > m.vw + 1) failures.push({ width, seat: 'front door', path, ...m });
        await chromePass(width, 'front door', path);
      }
    } finally {
      await fetch(`${BASE}/dev/front-door?on=0`, { method: 'POST' });
    }
    await visit('/p/dev-deniz');
    const opened = await eval_(`JSON.stringify([...document.querySelectorAll('label.drill-tile')].map((l) => { l.click(); return 1; }).length)`);
    const wells = await eval_(`JSON.stringify([...document.querySelectorAll('.drill-well')].filter((w) => getComputedStyle(w).display !== 'none').length)`);
    const mDrill = await eval_(MEASURE(width));
    checked++;
    if (!opened || wells !== opened) failures.push({ width, seat: 'signed out', path: '/p/dev-deniz', unrendered: `opened ${opened} stat tiles, ${wells} wells showed` });
    if (mDrill.doc > mDrill.vw + 1) failures.push({ width, seat: 'signed out', path: '/p/dev-deniz (every stat opened)', ...mDrill });
  }

} catch (e) {
  // A wedged browser is a FAILED RUN, not a quiet one. Print what we had, say
  // where it stopped, and exit non-zero so nobody reads silence as green.
  stop();
  console.error(`\nlayout check STOPPED after ${checked} page views — ${e.message}`);
  console.error('Nothing below this line was measured. Re-run; if it repeats, the machine is out of room (L37) or Chrome is wedged.');
  process.exit(2);
}

// The ring walk runs after the catch closes the main walk. It drives the same
// browser, so a wedge here is caught by the per-call deadline and reported by
// the same path — silence is never green (QA, 28 Sep).
// ---- the focus ring, at 390 and 1280 ---------------------------------------
// Fixed widths, not the ones this was called with: the ring is a phone-and-
// laptop question and these are the two the defect was measured at. Signed
// out, because these are the five forms a stranger meets — the sign-in
// password, the sign-up consent, the child-safety report, a new password, and
// the D-77 request-access form on a link that is no longer live.
// /reset/dev-reset is the seeded live link (dev-db.mts): since G-P2 a dead
// one goes straight to /reset?expired=1, so dev-none no longer drew the form.
const RING_PAGES = ['/signin', '/join', '/report', '/reset', '/reset/dev-reset', '/p/dev-expired'];
let ringChecked = 0;
await cdp('Network.clearBrowserCookies');
for (const width of [390, 1280]) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 768 });
  for (const path of RING_PAGES) {
    await visit(path);
    // /join opens on the country question (D-63, builder-final-b), whose two
    // answers are buttons; the fields this pass measures appear once
    // Australia is chosen — so choose it, as a person would.
    if (path === '/join') {
      await eval_(`JSON.stringify(([...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Australia')?.click(), true))`);
    }
    const controls = await tabThrough();
    await cspDrain(width, 'signed out', path);
    const bare = ringless(controls);
    const n = controls.filter((c) => c.control).length;
    ringChecked += n;
    if (n === 0) ringFails.push({ width, path, none: true });
    else if (bare.length) ringFails.push({ width, path, bare, of: n });
  }
}

// ---------------------------------------------------------------------------
// /JOIN, PRESSED THE WAY A PERSON PRESSES IT (round E, 29 Sep).
//
// Three things the walkthrough rehearsal found by clicking, which no fetch can
// see because /join is a client page (L10):
//   · j1  Continue with a name and the tick but no date of birth did NOTHING:
//         a disabled button, no word, no prompt. Pressed here with a real
//         mouse event (a disabled button ignores one; el.click() would not be
//         the same test), and it must either move on or make the browser flag
//         the missing field — the `invalid` event is the browser's prompt.
//         Then filled in, it must move on to the next step.
//   · j2  The four role chips must be named what they show ("Player", …),
//         read from Chrome's own accessibility tree — the answer a screen
//         reader is given, not an attribute this script guesses at.
//   · j3  "Somewhere else" must carry a way back a person can see: the
//         product's back affordance, the word and not only an arrow, a 44px
//         target, and pressing it must land on the country question again.
// Signed out, at a phone and a laptop width, like the ring walk above.
const joinFails = [];
let joinChecked = 0;
const clickOn = async (find) => {
  const box = await eval_(`JSON.stringify((() => { const el = (${find})(); if (!el) return null;
    el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: Math.round(r.height) }; })())`);
  if (!box) return null;
  for (const type of ['mousePressed', 'mouseReleased']) {
    await cdp('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
  }
  await new Promise((r) => setTimeout(r, 300));
  return box;
};
const byText = (sel, t) => `() => [...document.querySelectorAll('${sel}')].find((el) => el.innerText.trim().split('\\n')[0].trim() === ${JSON.stringify(t)})`;
const H1 = `JSON.stringify(document.querySelector('h1')?.innerText.trim() ?? '')`;
const waitH1 = async (want) => {
  let h1 = '';
  for (let i = 0; i < 50; i++) { h1 = await eval_(H1).catch(() => ''); if (h1 === want) break; await new Promise((r) => setTimeout(r, 100)); }
  return h1;
};
// A click that navigated leaves its load event behind; the next visit() must
// not mistake it for its own.
const dropLoads = () => { for (let i = events.length - 1; i >= 0; i--) if (events[i].method === 'Page.loadEventFired') events.splice(i, 1); };
const ROLE_TITLES = ['Player', 'Coach', 'Parent / Guardian', 'Club'];
await cdp('Network.clearBrowserCookies');
await cdp('Accessibility.enable');
for (const width of [390, 1280]) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 768 });

  // j2 — the names, on the step that shows the chips.
  await visit('/join');
  await clickOn(byText('button', 'Australia'));
  const names = [];
  for (const title of ROLE_TITLES) {
    const obj = (await cdp('Runtime.evaluate', { expression: `(${byText('button', title)})()` })).result.result;
    if (!obj?.objectId) { names.push(null); continue; }
    const node = (await cdp('DOM.describeNode', { objectId: obj.objectId })).result.node;
    const ax = (await cdp('Accessibility.getPartialAXTree', { backendNodeId: node.backendNodeId, fetchRelatives: false })).result.nodes;
    const own = ax.find((n) => n.backendDOMNodeId === node.backendNodeId) ?? ax[0];
    names.push(own?.name?.value ?? '');
  }
  joinChecked++;
  if (JSON.stringify(names) !== JSON.stringify(ROLE_TITLES)) {
    joinFails.push({ width, what: `j2 the role chips are announced as ${JSON.stringify(names)}, not ${JSON.stringify(ROLE_TITLES)}` });
  }

  // j1 — Continue with the date of birth left empty.
  await eval_(`JSON.stringify((window.__invalid = [], document.addEventListener('invalid', (e) => window.__invalid.push(e.target.type || e.target.tagName.toLowerCase()), true), true))`);
  await clickOn(`() => document.querySelector('input:not([type])')`);
  await cdp('Input.insertText', { text: 'Rae' });
  await clickOn(`() => document.querySelector('input[type=checkbox]')`);
  const before = await eval_(H1);
  const pressed = await clickOn(byText('button', 'Continue'));
  const after = await eval_(H1);
  const flagged = await eval_(`JSON.stringify(window.__invalid)`);
  joinChecked++;
  if (!pressed) joinFails.push({ width, what: 'j1 there is no Continue button to press' });
  else if (after === before && !flagged.includes('date')) {
    joinFails.push({ width, what: `j1 Continue with no date of birth did nothing — no step, and the browser flagged ${flagged.length ? flagged.join(', ') : 'nothing'}` });
  }
  // …and filled in (an adult, so the next step is the account), it moves on.
  await eval_(`JSON.stringify((() => { const el = document.querySelector('input[type=date]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '1990-05-05');
    el.dispatchEvent(new Event('input', { bubbles: true })); return true; })())`);
  await clickOn(byText('button', 'Continue'));
  const next = await waitH1('Your account');
  joinChecked++;
  if (next !== 'Your account') joinFails.push({ width, what: `j1b filled in, Continue landed on "${next}", not the account step` });
  dropLoads();

  // j3 — the way back from Somewhere else.
  await visit('/join');
  await clickOn(byText('button', 'Somewhere else'));
  const at = await eval_(H1);
  const back = await eval_(`JSON.stringify((() => {
    const el = [...document.querySelectorAll('a, button')].find((e) => e.innerText.trim() === 'Back' && e.getBoundingClientRect().height > 0);
    return el ? Math.round(el.getBoundingClientRect().height) : 0; })())`);
  const pressedBack = back ? await clickOn(byText('a, button', 'Back')) : null;
  const landed = pressedBack ? await waitH1('Where do you live?') : '';
  dropLoads();
  joinChecked++;
  if (at !== 'Pitch is only open in Australia.') joinFails.push({ width, what: `j3 "Somewhere else" landed on "${at}"` });
  else if (!back) joinFails.push({ width, what: 'j3 "Somewhere else" has no way back a person can see (no control reading "Back")' });
  else if (back < 44) joinFails.push({ width, what: `j3 the way back from "Somewhere else" is ${back}px tall, under 44` });
  else if (landed !== 'Where do you live?') joinFails.push({ width, what: `j3 Back from "Somewhere else" landed on "${landed}", not the country question` });
}

// ---------------------------------------------------------------------------
// TWO THINGS BUZ SAW IN THE WALKTHROUGH (brief H, 29 Sep), which only a
// browser can see.
//   · st1  A stat tile counted up from 0, so for a moment a child's CV said
//          "0 appearances" (D-162). Every stat number is recorded from the
//          first frame the document has — a MutationObserver and a frame loop
//          installed before any of the page's own scripts — for three
//          seconds. Each tile must show exactly one value in all that time,
//          the value the server sent. With prefers-reduced-motion nothing on
//          the tile animates at all.
//   · pr1  Tapping a locked Premium row reloaded to ?first=1 at the TOP of
//          the page, so "Premium is coming. You're first in line." was never
//          seen. The row is pressed with a real mouse event, and after the
//          answer arrives the confirmation must be inside the viewport.
// Both at a phone and a laptop width.
// ---------------------------------------------------------------------------
const motionFails = [];
let motionChecked = 0;
const TILE_RECORDER = `window.__tiles = [];
  (() => {
    const snap = () => {
      const t = [...document.querySelectorAll('.drill-row > *')].map((l) => {
        const d = [...l.querySelectorAll('div')].find((x) => x.children.length === 0 && /^\\d+$/.test(x.textContent.trim()));
        return d ? d.textContent.trim() : '?';
      });
      if (t.length) { const k = t.join(','); if (window.__tiles[window.__tiles.length - 1] !== k) window.__tiles.push(k); }
    };
    new MutationObserver(snap).observe(document, { subtree: true, childList: true, characterData: true });
    const until = performance.now() + 3000;
    const loop = () => { snap(); if (performance.now() < until) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  })();`;
await cdp('Network.clearBrowserCookies');
for (const width of [390, 1280]) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 768 });
  // st1 — every frame of the tiles, on the share link a club opens.
  const rec = (await cdp('Page.addScriptToEvaluateOnNewDocument', { source: TILE_RECORDER })).result.identifier;
  const served = await (await fetch(BASE + '/p/dev-deniz')).text();
  const row = (served.split('class="drill-row"')[1] ?? '').split(/class="drill-wells"|<\/section>|Season 20/)[0];
  const servedNums = [...row.matchAll(/>(\d+)<\/div>/g)].map((m) => m[1]).join(',');
  await visit('/p/dev-deniz');
  await new Promise((r) => setTimeout(r, 3200));
  await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: rec });
  const frames = await eval_('JSON.stringify(window.__tiles ?? [])');
  motionChecked++;
  if (!frames.length || frames[0].split(',').length < 2) motionFails.push({ width, what: `st1 no stat tiles were seen on /p/dev-deniz (${JSON.stringify(frames)}), so nothing was measured` });
  else if (frames.length !== 1) motionFails.push({ width, what: `st1 the stat tiles showed ${frames.length} different values over the first three seconds: ${frames.slice(0, 6).join(' → ')}` });
  else if (frames[0] !== servedNums) motionFails.push({ width, what: `st1 the first frame shows ${frames[0]}, the served HTML ${servedNums || 'no numbers'}` });
  // …and with reduced motion, nothing on a tile animates.
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await visit('/p/dev-deniz');
  const moving = await eval_(`JSON.stringify([...document.querySelectorAll('.drill-row > *')].flatMap((l) => [...l.querySelectorAll('div')])
    .map((d) => getComputedStyle(d).animationName).filter((n) => n && n !== 'none'))`);
  await cdp('Emulation.setEmulatedMedia', { features: [] });
  motionChecked++;
  if (moving.length) motionFails.push({ width, what: `st1b with prefers-reduced-motion a stat tile still animates (${[...new Set(moving)].join(', ')})` });

  // pr1 — the Premium tap, on the adult player's Highlights and the coach's page.
  for (const [who, find] of [[ids.people.jordan, 'clips'], [ids.people.sam, 'coach']]) {
    await cdp('Network.setCookie', { name: 'pitch_session', value: cookieFor(who), url: BASE });
    let path = '/coach/edit';
    if (find === 'clips') {
      await visit('/home');
      path = await eval_(`JSON.stringify(document.querySelector('a[href$="/clips"]')?.getAttribute('href') ?? '')`);
    }
    await visit(path);
    dropLoads();
    // The product scrolls smoothly (globals.css), so clickOn's centre-then-
    // measure would read a box the page is still scrolling towards and press
    // beside the row. Scroll instantly, let it settle, then press where it is.
    const row = byText('button', 'Unlimited clips');
    await eval_(`JSON.stringify(((${row})()?.scrollIntoView({ block: 'center', behavior: 'instant' }), true))`);
    await new Promise((r) => setTimeout(r, 300));
    const box = await eval_(`JSON.stringify((() => { const r = (${row})()?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; })())`);
    if (box) for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
    const pressed = Boolean(box);
    const STATUS = `JSON.stringify((() => {
        const el = [...document.querySelectorAll('[role=status]')].find((e) => /Premium is coming/.test(e.textContent));
        if (!el) return { found: false, url: location.pathname + location.search + location.hash };
        const r = el.getBoundingClientRect();
        return { found: true, top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight, url: location.pathname + location.search + location.hash };
      })())`;
    let seen = null;
    for (let i = 0; i < 80 && !seen?.found; i++) {
      await new Promise((r) => setTimeout(r, 150));
      seen = await eval_(STATUS).catch(() => null);
    }
    // Where it comes to rest, not where a smooth scroll happens to be.
    if (seen?.found) { await new Promise((r) => setTimeout(r, 1500)); seen = await eval_(STATUS).catch(() => seen); }
    dropLoads();
    motionChecked++;
    if (!path || !pressed) motionFails.push({ width, what: `pr1 no locked Premium row to press on ${path || 'the Highlights page'}` });
    else if (!seen?.found) motionFails.push({ width, what: `pr1 pressing a locked row on ${path} never showed "Premium is coming. You’re first in line." (at ${seen?.url ?? 'nowhere'})` });
    else if (seen.top < 0 || seen.bottom > seen.vh) motionFails.push({ width, what: `pr1 after the tap on ${path} the confirmation is out of view (${seen.top}–${seen.bottom} on a ${seen.vh}px screen, at ${seen.url})` });
    await cdp('Network.clearBrowserCookies');
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
// The page colour, the 10px captions and the 44px targets are the chrome
// pass's measurements, not a second set: these views are handed to
// chromePass() like any other, so "not the stock white" is asserted against
// --bg read out of globals.css (tokenRgb) and there is one answer to the
// question, not two.
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
    // /home, where the shell carries sign-out for every seat. Not / — before
    // launch that is the waitlist page, with no door into the product.
    return h === '/home';
  });
  return JSON.stringify({ h1: h1 ? h1.innerText.trim().slice(0, 60) : '', mark, home });
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
    await chromePass(width, 'failure path', path);
    await cspDrain(width, 'failure path', path);
    const wrong = [];
    if (!seen.h1) wrong.push('no heading');
    if (!seen.mark) wrong.push('no Pitch mark');
    if (!seen.home) wrong.push('no way back');
    if (m.doc > m.vw + 1) wrong.push(`${m.doc}px wide on ${m.vw}px`);
    if (wrong.length) failures.push({ width, seat: 'failure path', path, unrendered: `${what} — ${wrong.join('; ')}` });
  }
}

// The two public pages the signed-out walk does not start from, read for
// analytics only (their layout is not this change's to measure).
await cdp('Network.clearBrowserCookies');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 844, deviceScaleFactor: 1, mobile: false });
for (const path of ['/', '/jobs']) { await visit(path); await analyticsPass(1280, 'signed out', path); await cspDrain(1280, 'signed out', path); }

stop();
console.log(`\nlayout check · ${checked} page views at ${widths.join(', ')}px (${failureChecks} of them failure-path views)`);
console.log(`analytics    · ${analyticsRead} views read · started in ${analyticsOn} · it may start only for a signed-out visitor on the front door, /trials, /jobs or a club page, and must start there`);
for (const f of analyticsFails) console.log(`FAIL ${f.width}px · ${f.seat} · ${f.path} — Vercel Analytics ${f.on ? 'STARTED here, off the four public pages or for a signed-in seat' : 'did not start on a public page, signed out — the check cannot see it'}`);
console.log(`chrome pass  · ${ringChecked} controls tabbed to at 390 and 1280 · ${checked} views read for .field-label and the page colour`);
console.log(`policy       · an injected inline script was refused under the real header and ran without it · every view read for a refusal`);
for (const f of cspFails) console.log(`FAIL ${f.width}px · ${f.seat} · ${f.path} — the Content-Security-Policy refused ${f.refused.length} thing${f.refused.length === 1 ? '' : 's'}: ${f.refused.join(' | ')}`);
for (const f of ringFails) {
  if (f.none) console.log(`FAIL ${f.width}px · ${f.path} — the keyboard reached no form control at all, so the ring was never measured here`);
  else console.log(`FAIL ${f.width}px · ${f.path} — ${f.bare.length} of ${f.of} controls show no focus ring: ${f.bare.map((c) => `${c.name} (outline ${c.style} ${c.width}px)`).join(', ')}`);
}
console.log(`join pass    · ${joinChecked} presses on /join at 390 and 1280 — Continue is never silent, the role chips are named what they show, and Somewhere else has a way back`);
for (const f of joinFails) console.log(`FAIL ${f.width}px · /join — ${f.what}`);
console.log(`walkthrough  · ${motionChecked} views at 390 and 1280 — a stat tile shows only its real value from the first frame and is still under reduced motion, and a Premium tap lands with its answer in view`);
for (const f of motionFails) console.log(`FAIL ${f.width}px · ${f.what}`);
for (const f of labelFails) console.log(`FAIL ${f.width}px · ${f.seat} · ${f.path} — ${f.labels.length} .field-label not at 10px: ${f.labels.map((l) => `"${l.text}" ${l.size}/${l.weight}`).join(', ')}`);
for (const f of bodyFails) console.log(`FAIL ${f.width}px · ${f.seat} · ${f.path} — the page paints ${f.bg}, not --bg ${tokenRgb}`);
// One line per distinct control, not one per view: the same component fails on
// every screen it is on, at every width, and a hundred lines saying so is a
// wall nobody reads.
const byWhat = (list) => [...list.reduce((m, f) => m.set(`${f.what} ${f.w}x${f.h}`,
  (m.get(`${f.what} ${f.w}x${f.h}`) ?? []).concat(`${f.width}px ${f.path}`)), new Map())];
for (const [what, where] of byWhat(tapFails)) {
  console.log(`FAIL touch target under 44px: ${what} — ${where.length} view${where.length === 1 ? '' : 's'}, e.g. ${where[0]}`);
}
if (proseSmall.length) {
  console.log(`info ${byWhat(proseSmall).length} small link${byWhat(proseSmall).length === 1 ? '' : 's'} inside running prose (a per-screen layout decision, not a component fault):`);
  for (const [what, where] of byWhat(proseSmall).slice(0, 12)) console.log(`     ${what} — e.g. ${where[0]}`);
}
// One line per squeezed element per page, named, with its width and lines.
const squeezeKeys = [...squeezeFails.reduce((m, f) => m.set(`${f.path} ${f.what} "${f.text}"`,
  (m.get(`${f.path} ${f.what} "${f.text}"`) ?? []).concat(`${f.width}px ${f.w}px wide, ${f.lines} lines, as ${f.seat}`)), new Map())];
console.log(`squeeze      · every view read for text narrower than ${SQUEEZE_MIN_WIDTH}px wrapping to more than ${SQUEEZE_MAX_LINES} lines`);
for (const [what, where] of squeezeKeys) console.log(`FAIL squeezed column: ${what} — ${where.join('; ')}`);
const chromeBad = ringFails.length + labelFails.length + bodyFails.length + byWhat(tapFails).length + cspFails.length + analyticsFails.length + joinFails.length + squeezeKeys.length + motionFails.length;
if (failures.length === 0 && chromeBad === 0) {
  console.log('ALL GREEN — nothing is wider than the screen, every control the keyboard reaches shows its ring, every caption is 10px, every page paints --bg, every control and phone link is a 44px target, no column of words is squeezed under 120px, no page broke its Content-Security-Policy, analytics started only on the four public pages, signed out, /join answers every press, the stat tiles never show a number that is not theirs, and a Premium tap lands in view');
  process.exit(0);
}
for (const f of failures) {
  if (f.unrendered) { console.log(`FAIL ${f.width}px · ${f.seat} · ${f.path} — never rendered for this seat (${f.unrendered}), so never measured`); continue; }
  console.log(`FAIL ${f.width}px · ${f.seat} · ${f.path} — page ${f.doc}px wide on a ${f.vw}px screen; widest: ${f.widest} by ${f.over}px${f.text ? ` ("${f.text}")` : ''}`);
}
console.log(`\n${failures.length} page${failures.length === 1 ? '' : 's'} failed (too wide, or never rendered)`
  + `, ${chromeBad} chrome failure${chromeBad === 1 ? '' : 's'} (focus ring ${ringFails.length}, .field-label ${labelFails.length}, page colour ${bodyFails.length}, touch targets ${byWhat(tapFails).length}, policy refusals ${cspFails.length}, /join ${joinFails.length}, squeezed ${squeezeKeys.length}, walkthrough ${motionFails.length})`);
process.exit(1);
