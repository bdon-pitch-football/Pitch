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
  // Spec D (1 Oct): the parent's approval page and the child's waiting page
  // are reached only from a text, an email or the child's own phone.
  // John's rulings (1 Oct): "No, end this request"'s after-state, and the
  // undo link's not-live panel and Done, all reached only from a press or an
  // email.
  'signed out': ['/confirm/dev-unproved', '/stop-cvs', `/a/${ids.pendingInvitation}`, '/a/dev-mila-text', '/a/bogus',
    `/join/waiting/${ids.pendingInvitation}`, '/join/waiting/bogus', '/privacy/family',
    '/a/closed', '/undo/never-a-live-undo-link', '/undo/done'],
  parent: [`/squad/${g.child_id}?back=controls`, `/squad/${g.child_id}?club=${riverside}&back=controls`,
    `/build/${ids.children.deniz.record_id}/preview`, `/g/pending/${ids.children.deniz.record_id}`,
    // C-P4 (1 Oct): the parent's own Send and Register interest for their
    // under-16, reached from a club page's buttons, and where each lands.
    `/send/${ids.children.deniz.record_id}?club=brindlewood-rovers-sc`, `/send/${ids.children.deniz.record_id}?sent=1`,
    `/register-interest/${ids.children.deniz.record_id}?club=${riverside}`,
    `/register-interest/${ids.children.deniz.record_id}?club=${riverside}&registered=1`],
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
  // I-P2 (1 Oct): the call sheet with a claim and its held count (Quarrymead)
  // and with no claim at all (Westgate) — the two shapes the grid places.
  'club TD': ['@squad', '@squad?pos=GK', '/ops', '/ops/verification', `/ops/call/${riverside}`,
    `/ops/call/${ids.heldClub}`, `/ops/call/${westgate}`,
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
    // Fixed 1 Oct (design checklist): the parent's text always contains the
    // link's own, so ">=" made EVERY small link "prose" and nothing ever
    // failed. Prose now means an inline link with other words beside it in
    // the same block — looked for past inline wrappers (a legal document's
    // address sits inside <strong>, whose text is only the link's).
    const ownText = (el.textContent ?? '').trim();
    let block = el.parentElement;
    while (block && getComputedStyle(block).display === 'inline') block = block.parentElement;
    const prose = tag === 'a' && !/^tel:/.test(href) && cs.display === 'inline'
      && !!block && block.textContent.trim().length > ownText.length + 1;
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
// THE WAYS IN, MEASURED (2 Oct: floodlit-join-signin-claim.html, BUZ 1 Oct).
// The post-release audit measured /join, /signin and /claim with the logo
// top right of a 604px column at 1280 (left 877, right 338) and 68–87% of
// the first screen empty. What only a browser can say, at every width this
// run was given:
//   · wi-l1  the logo is the top bar's, a link home, at the top: from 1024 it
//            leads the bar on the left; below 1024 it sits on the right
//            (D-173 (3)) — within 40px of that edge (G-C10).
//   · wi-l2  a door is a lifted panel from 640 (part 20: background and the
//            floating shadow); on a phone it is the column as drawn. Find
//            your club is a list, on the page, in no panel.
//   · wi-l3  exactly one glow is drawn, and it is on screen-visible ground.
//   · wi-l4  on sign-in, "New to Pitch? Create an account" follows the
//            content, within 40px of the well above it — it was pinned to the
//            foot of the screen, ~590px below it at 820 (audit #11).
// ---------------------------------------------------------------------------
const waysFails = [];
let waysChecked = 0;
const WAYS = [
  ['/signin', null, 'door'], ['/signin?claim=westgate-rangers', null, 'door'], ['/join', null, 'door'],
  ['/claim', null, 'list'], ['/claim?q=rovers', null, 'list'],
  ['/claim/westgate-rangers', ids.people.robin, 'door'], ['/claim/westgate-rangers?sent=1', ids.people.robin, 'door'],
  ['/claim/riverside-fc?claimed=1', ids.people.marina, 'door'],
];
const WAYS_MEASURE = `JSON.stringify((() => {
  const vw = document.documentElement.clientWidth;
  const bar = document.querySelector('header.fl-nav');
  const brand = bar?.querySelector('a.fl-nav-brand[href="/"]');
  const b = brand?.getBoundingClientRect(), hb = bar?.getBoundingClientRect();
  const door = [...document.querySelectorAll('.door')].filter((d) => d.getBoundingClientRect().height > 0);
  const ds = door[0] ? getComputedStyle(door[0]) : null;
  const glows = [...document.querySelectorAll('.fl-glow')].filter((g) => { const r = g.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  const info = document.querySelector('.door .door-info');
  const lines = [...document.querySelectorAll('.door .orline')];
  const foot = lines[lines.length - 1];
  return { vw, bar: Boolean(hb), brand: b ? { l: Math.round(b.left), r: Math.round(vw - b.right), t: Math.round(b.top - hb.top), inBar: b.bottom <= hb.bottom + 1 } : null,
    leftmost: bar ? Math.min(...[...bar.querySelectorAll('a, button')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => Math.round(e.getBoundingClientRect().left))) : null,
    doors: door.length, panel: ds ? { bg: ds.backgroundImage !== 'none' || ds.backgroundColor !== 'rgba(0, 0, 0, 0)', shadow: ds.boxShadow !== 'none' } : null,
    col: Boolean(document.querySelector('.door-col')), glows: glows.length,
    footGap: info && foot ? Math.round(foot.getBoundingClientRect().top - info.getBoundingClientRect().bottom) : null };
})())`;
for (const width of widths) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 768 });
  for (const [path, who, kind] of WAYS) {
    await cdp('Network.clearBrowserCookies');
    if (who) await cdp('Network.setCookie', { name: 'pitch_session', value: cookieFor(who), url: BASE });
    await visit(path);
    await cspDrain(width, who ? 'brand new' : 'signed out', path);
    const m = await eval_(WAYS_MEASURE);
    const bad = (what) => waysFails.push({ width, path, what });
    waysChecked++;
    if (!m.bar || !m.brand) bad('wi-l1 no top bar with the logo as a link home');
    else if (!m.brand.inBar || m.brand.t > 16) bad(`wi-l1 the logo is not at the top of the bar (${m.brand.t}px down)`);
    else if (width >= 1024 && (m.brand.l !== m.leftmost || m.brand.l > (m.vw - Math.min(m.vw, 1200)) / 2 + 41)) bad(`wi-l1 from 1024 the logo leads the bar on the left — it is ${m.brand.l}px from the left, the bar's first control at ${m.leftmost}`);
    else if (width < 1024 && m.brand.r > 40) bad(`wi-l1 below 1024 the logo sits top right — it is ${m.brand.r}px from the right edge`);
    if (kind === 'door') {
      if (m.doors !== 1) bad(`wi-l2 ${m.doors} door panels drawn, not 1`);
      else if (width >= 640 && !(m.panel.bg && m.panel.shadow)) bad('wi-l2 from 640 the door is not a lifted panel (no surface or no floating shadow)');
      else if (width < 640 && m.panel.shadow) bad('wi-l2 on a phone the door is the column as drawn, not a panel');
    } else if (m.doors !== 0 || !m.col) bad(`wi-l2 Find your club is a list on the page: ${m.doors} door panels, reading column ${m.col}`);
    if (m.glows !== (path === '/join' ? 0 : 1)) bad(`wi-l3 ${m.glows} glows drawn`);
    if (path.startsWith('/signin') && (m.footGap === null || m.footGap > 40)) bad(`wi-l4 "Create an account" is ${m.footGap}px below the well above it — pinned, not following the content`);
  }
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

  // pr1 — the Premium tap. It pressed "Unlimited clips" on the adult player's
  // Highlights and the coach's page and required the answer in view. Since
  // John's ruling (2 Oct) no locked row renders while D-163 stands
  // (lib/premium, off), so there is nothing to press: pr1 now requires that,
  // on the same two pages at the same two widths, in the browser — no row, no
  // "Premium" tag, no form. Turn the switch on and the press comes back from
  // git (f8fa273).
  for (const [who, find] of [[ids.people.jordan, 'clips'], [ids.people.sam, 'coach']]) {
    await cdp('Network.setCookie', { name: 'pitch_session', value: cookieFor(who), url: BASE });
    let path = '/coach/edit';
    if (find === 'clips') {
      await visit('/home');
      path = await eval_(`JSON.stringify(document.querySelector('a[href$="/clips"]')?.getAttribute('href') ?? '')`);
    }
    if (path) await visit(path);
    dropLoads();
    const row = await eval_(`JSON.stringify(Boolean(document.querySelector('#premium, button[name="feature"], .prem')) || [...document.querySelectorAll('button, .pill')].some((e) => /^(Unlimited clips|See who viewed your CV|Premium)/i.test(e.textContent.trim())))`);
    motionChecked++;
    if (!path) motionFails.push({ width, what: 'pr1 the adult player’s home links no Highlights page to read' });
    else if (row) motionFails.push({ width, what: `pr1 a locked Premium row is on ${path} while D-163 stands (John, 2 Oct)` });
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

// cs1 — THE CALL SHEET'S TWO COLUMNS (spec I, I-P2; BUZ "Yes", 1 Oct). Only a
// browser can say where the grid put things. At ≥1024 the claim and the
// Technical Director sit in a 320px aside right of the form, the TD straight
// under the claim (or at the form's top when nobody has claimed the club), and
// the claim is still on screen with the form scrolled well past it. Below 1024
// they are one column, claim → TD → form, 18px apart. Quarrymead has a claim
// and a held count; Westgate has no claim. The first .call-grid shipped as
// three auto rows: with no claim, the form's height was shared among them and
// the TD panel sat 676px down the page at 1280, and an empty "claim" row left
// 18px of nothing above it on a phone.
const sheetFails = [];
let sheetChecked = 0;
await cdp('Network.setCookie', { name: 'pitch_session', value: cookieFor(ids.people.marina), url: BASE });
for (const width of widths) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 768 });
  for (const [club, id] of [['Quarrymead (claimed)', ids.heldClub], ['Westgate (no claim)', westgate]]) {
    await visit(`/ops/call/${id}`);
    const box = `(s) => { const e = document.querySelector('.call-grid > ' + s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top + scrollY), b: Math.round(r.bottom + scrollY), w: Math.round(r.width) }; }`;
    const m = await eval_(`JSON.stringify((() => { const box = ${box}; const g = document.querySelector('.call-grid')?.getBoundingClientRect(); return { grid: g ? Math.round(g.top + scrollY) : null, claim: box('.ga-claim'), td: box('.ga-td'), form: box('.ga-form') }; })())`);
    sheetChecked++;
    const bad = [];
    if (!m.td || !m.form) bad.push('no .ga-td or .ga-form in a .call-grid');
    else if (club.startsWith('Quarrymead') && !m.claim) bad.push('no .ga-claim on a claimed club');
    else if (width >= 1024) {
      const aside = [m.claim, m.td].filter(Boolean);
      if (aside.some((a) => a.w !== 320 || a.l < m.form.r)) bad.push(`the aside is not a 320px column right of the form (${aside.map((a) => `${a.w}px at ${a.l}, form ends ${m.form.r}`).join('; ')})`);
      if (m.form.t !== m.grid) bad.push(`the form starts ${m.form.t - m.grid}px below the top of the grid`);
      const tdWant = m.claim ? m.claim.b + 18 : m.form.t;
      if (Math.abs(m.td.t - tdWant) > 1) bad.push(`the TD panel starts at ${m.td.t}, not ${tdWant} (${m.claim ? 'under the claim' : 'level with the form'})`);
      if (m.claim) {
        await eval_(`JSON.stringify((window.scrollTo({ top: ${Math.round(m.form.t + (m.form.b - m.form.t) / 2)}, behavior: 'instant' }), true))`);
        await new Promise((r) => setTimeout(r, 200));
        const v = await eval_(`JSON.stringify((() => { const r = document.querySelector('.ga-claim').getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), vh: innerHeight }; })())`);
        if (v.t < 0 || v.b > v.vh) bad.push(`with the form scrolled half way, the claim is off screen (${v.t}–${v.b} on ${v.vh}px)`);
      }
    } else {
      const col = [m.claim, m.td, m.form].filter(Boolean);
      if (col[0].t !== m.grid) bad.push(`the first panel starts ${col[0].t - m.grid}px below the top of the grid`);
      for (let i = 1; i < col.length; i++) if (Math.abs(col[i].t - col[i - 1].b - 18) > 1 || col[i].l !== col[0].l) bad.push(`not one column 18px apart in the order claim, TD, form (${col.map((c) => `${c.t}–${c.b} at ${c.l}`).join(', ')})`);
    }
    if (bad.length) sheetFails.push({ width, what: `cs1 ${club}: ${[...new Set(bad)].join('; ')}` });
  }
}
await cdp('Network.clearBrowserCookies');

// U5b (John, 1 Oct): D-172's banner sits ABOVE THE FOLD — on a small phone
// (375×667), the banner's first line is wholly inside the first viewport on
// every unclaimed page, so a long club name can never push it out of sight.
const foldFails = [];
await cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 1, mobile: true });
for (const path of ['/fc/brindlewood-rovers-sc', '/fc/kestrelford-athletic-sc', '/fc/wrenmoor-wanderers-fc']) {
  await visit(path);
  const r = await eval_(`JSON.stringify((() => {
    const b = document.querySelector('[data-unclaimed-banner]');
    if (!b) return { missing: true };
    const range = document.createRange(); range.selectNodeContents(b);
    const first = [...range.getClientRects()].filter((x) => x.width > 0).sort((p, q) => p.top - q.top)[0];
    return { bottom: first ? Math.ceil(first.bottom) : null, vh: window.innerHeight };
  })())`);
  if (r.missing || r.bottom === null || r.bottom > r.vh) foldFails.push({ path, ...r });
}
await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 844, deviceScaleFactor: 1, mobile: false });

// tb-foot — THE SHORTER CARD (trials board v2, BUZ 2 Oct). Only a browser can
// say the row's foot is one line: in every row whose foot holds the club's own
// notice and the button, the two boxes share a line, each is a 44px target or
// more (the notice link's box, not its words), and no divider sits above it.
const footFails = [];
let footChecked = 0;
await cdp('Network.clearBrowserCookies');
for (const width of widths) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 768 });
  await visit('/trials');
  const feet = await eval_(`JSON.stringify([...document.querySelectorAll('article.fl-trial')].map((a) => {
    const f = a.querySelector(':scope > .fl-trial-foot');
    if (!f) return { none: true };
    const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; };
    return { club: a.querySelector('.fl-trial-cn')?.textContent ?? '?', own: box(f.querySelector('.fl-own')), btn: box(f.querySelector('.btn')),
      lineOwn: [...a.querySelectorAll('.fl-trial-line .fl-own')].map(box), divider: parseFloat(getComputedStyle(f).borderTopWidth) || 0 };
  }))`);
  for (const f of feet) {
    footChecked++;
    const bad = [];
    if (f.none) bad.push('a row with no foot');
    else {
      if (f.divider) bad.push(`a ${f.divider}px divider above the foot`);
      for (const [what, b] of [['the notice link', f.own], ['the button', f.btn], ...f.lineOwn.map((b) => ['a line\'s notice link', b])]) if (b && (b.h < 44 || b.w < 44)) bad.push(`${what} is ${b.w}x${b.h}`);
      if (f.own && f.btn && (f.own.b <= f.btn.t || f.own.t >= f.btn.b)) bad.push(`the notice link (${f.own.t}–${f.own.b}) and the button (${f.btn.t}–${f.btn.b}) are not on one line`);
    }
    if (bad.length) footFails.push({ width, what: `tb-foot ${f.club ?? ''}: ${bad.join('; ')}` });
  }
  if (feet.length === 0) footFails.push({ width, what: 'tb-foot: /trials drew no rows to measure' });
}
await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 844, deviceScaleFactor: 1, mobile: false });

// tf — THE TRIALS BOARD'S FILTERS (BUZ approved 2 Oct). What only a browser
// can say about them.
//
// tf-rail2 — the laptop rail's bottom is reachable at 1280×800 (HoPD ruling
// 1, 2 Oct). The live panel was 1,097px tall before the fold, 1,168px with it
// (the proposal's measurement); the seed's is shorter. So the rail is first
// read as the seed draws it with every fold open — sticky, and never taller
// than the window under its sticky top — and then made as tall as the live panel by a spacer at its top,
// the page scrolled until the rail is stuck, the rail scrolled to its own
// end, and its last chip must then be on the screen: reachable without
// reaching the end of the board.
const tfFails = [];
let tfChecked = 0;
{
  await cdp('Network.clearBrowserCookies');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await visit('/trials'); tfChecked++;
  const fit = await eval_(`JSON.stringify((() => {
    const rail = document.querySelector('aside.tb-rail');
    if (!rail) return { none: true };
    document.querySelectorAll('aside.tb-rail .d-only details').forEach((d) => { d.open = true; });
    const cs = getComputedStyle(rail);
    return { sticky: cs.position, h: Math.round(rail.getBoundingClientRect().height), room: window.innerHeight - parseFloat(cs.top) - 16 };
  })())`);
  if (fit.none) tfFails.push({ width: 1280, what: 'tf-rail2: /trials drew no rail' });
  else if (fit.sticky !== 'sticky' || fit.h > fit.room + 1) tfFails.push({ width: 1280, what: `tf-rail2: the rail is ${fit.sticky} and ${fit.h}px tall, with ${fit.room}px under its sticky top` });
  const tall = JSON.parse((await cdp('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => JSON.stringify(await (async () => {
    const rail = document.querySelector('aside.tb-rail');
    const card = rail?.querySelector('.d-only .tb-filters');
    if (!card) return { none: true };
    const spacer = document.createElement('div');
    spacer.style.height = Math.max(0, 1168 - rail.getBoundingClientRect().height) + 'px';
    card.prepend(spacer);
    window.scrollTo({ top: 400, behavior: 'instant' });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    rail.scrollTop = rail.scrollHeight;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const chips = [...card.querySelectorAll('.chip')];
    const last = chips[chips.length - 1].getBoundingClientRect(), box = rail.getBoundingClientRect();
    return { vh: window.innerHeight, top: Math.round(box.top), bottom: Math.round(box.bottom), last: Math.round(last.bottom),
      lastText: chips[chips.length - 1].textContent.trim(), page: Math.round(document.documentElement.scrollHeight - window.innerHeight - window.scrollY) };
  })()))()` })).result.result.value);
  if (tall.none) tfFails.push({ width: 1280, what: 'tf-rail2: no filters in the rail' });
  else if (tall.last > tall.vh || tall.last > tall.bottom + 1 || tall.bottom > tall.vh) {
    tfFails.push({ width: 1280, what: `tf-rail2: a 1,168px rail at 1280×800 — its last chip ("${tall.lastText}") ends at ${tall.last}px, the rail at ${tall.bottom}px, the window at ${tall.vh}px, with ${tall.page}px of board still below` });
  }
}
await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 844, deviceScaleFactor: 1, mobile: false });

// ---------------------------------------------------------------------------
// ap — THE POST-RELEASE AUDIT'S RULINGS, MEASURED (docs/design/reports/
// 2026-10-02-audit-live-*.md, Head of Product Design; BUZ, 2 Oct). Only a
// browser can say where a column, a pill or a hairline ended up, so each
// ruling the render suite cannot read in the markup is measured here, at the
// widths the ruling is about — whatever widths this run was called with.
// Every check was run against f8fa273, the live release, and failed there.
// ---------------------------------------------------------------------------
const apFails = [];
let apChecked = 0;
const apAs = async (who) => {
  await cdp('Network.clearBrowserCookies');
  if (who) await cdp('Network.setCookie', { name: 'pitch_session', value: cookieFor(who), url: BASE });
};
const apWidth = (w) => cdp('Emulation.setDeviceMetricsOverride', { width: w, height: 844, deviceScaleFactor: 1, mobile: w < 768 });
const apFail = (id, width, path, what) => apFails.push({ id, width, path, what });
{
  const jordan = ids.people.jordan;
  await apAs(jordan);
  await apWidth(1280);
  await visit('/home');
  const rec = await eval_(`JSON.stringify((document.querySelector('a[href^="/build/"]')?.getAttribute('href') ?? '').split('/')[2] ?? '')`);

  // ap-l1 (ruling 5, D-147): a framed reading column is centred in the
  // content area, as /build is — not against the rail.
  const COL = `JSON.stringify((() => { const m = document.querySelector('.console-main'); const c = m && [...m.querySelectorAll('.reading')].find((e) => e.getBoundingClientRect().width > 200);
    if (!c) return null; const a = m.getBoundingClientRect(), b = c.getBoundingClientRect(); return Math.round(((b.left + b.right) - (a.left + a.right)) / 2); })())`;
  for (const [who, path] of [[jordan, `/build/${rec}`], [jordan, `/build/${rec}/clips`], [jordan, `/build/${rec}/more`], [jordan, `/send/${rec}`],
    [ids.people.alex, `/g/controls/${ids.children.deniz.child_id}`], [ids.people.sam, '/coach/edit']]) {
    await apAs(who); await visit(path); apChecked++;
    const off = await eval_(COL);
    if (off === null || Math.abs(off) > 1) apFail('ap-l1', 1280, path, `the reading column is ${off === null ? 'not inside the frame' : `${off}px off the content area's centre`}`);
  }

  // ap-l2 (ruling 7): between 640 and 1023 a framed home is the 560 column,
  // centred, and its page header's logo sits where /build's does.
  await apWidth(820);
  await apAs(jordan); await visit(`/build/${rec}`);
  const MARK = `JSON.stringify(Math.round(document.querySelector('.pg-head-mark')?.getBoundingClientRect().right ?? -1))`;
  const buildMark = await eval_(MARK);
  for (const [who, seat] of [[jordan, 'player'], [ids.people.alex, 'parent'], [ids.people.sam, 'coach'], [ids.people.marina, 'club TD']]) {
    await apAs(who); await visit('/home'); apChecked++;
    const g = await eval_(`JSON.stringify((() => { const g = document.querySelector('.home-grid')?.getBoundingClientRect(); return g ? { w: Math.round(g.width), mid: Math.round((g.left + g.right) / 2) } : null; })())`);
    const mark = await eval_(MARK);
    if (!g || g.w > 560 || Math.abs(g.mid - 410) > 1 || mark !== buildMark) apFail('ap-l2', 820, `/home (${seat})`, `the home grid is ${g?.w}px wide centred at ${g?.mid} and its logo ends at ${mark}, /build's at ${buildMark}`);
  }

  // ap-l3 (ruling 16): below 400px the player hero's pill drops under the
  // title, so "Your page is live" keeps one line; at a laptop it sits beside.
  await apAs(jordan);
  for (const w of [375, 1280]) {
    await apWidth(w); await visit('/home'); apChecked++;
    const h = await eval_(`JSON.stringify((() => { const t = document.querySelector('.hero-panel .hero-h'), p = document.querySelector('.hero-panel .hero-id > .pill'), v = document.querySelector('.hero-panel .hero-id > .hero-av');
      if (!t || !p || !v) return null; const a = t.getBoundingClientRect(), b = p.getBoundingClientRect(), c = v.getBoundingClientRect();
      return { lines: Math.round(a.height / parseFloat(getComputedStyle(t).lineHeight)), pillTop: Math.round(b.top), titleBottom: Math.round(a.bottom),
        besideAvatar: a.left >= c.right && a.top < c.bottom, pillUnderTitle: Math.abs(b.left - a.left) <= 1 }; })())`);
    // The title stays beside the avatar at every width; below 400 it keeps
    // one line and the pill sits under it, on its left edge.
    const ok = h && h.besideAvatar && (w < 400 ? h.lines === 1 && h.pillTop >= h.titleBottom - 1 && h.pillUnderTitle : h.pillTop < h.titleBottom);
    if (!ok) apFail('ap-l3', w, '/home (player)', h ? `title ${h.lines} line(s), beside the avatar ${h.besideAvatar}, pill top ${h.pillTop} against the title's bottom ${h.titleBottom}, pill on the title's edge ${h.pillUnderTitle}` : 'no hero title, avatar or pill');
  }

  // ap-l4 (ruling 13): the coach's and the TD's home link is one line cut
  // with an ellipsis, with Copy beside it in the same box.
  await apWidth(375);
  for (const [who, seat] of [[ids.people.sam, 'coach'], [ids.people.marina, 'club TD']]) {
    await apAs(who); await visit('/home'); apChecked++;
    const l = await eval_(`JSON.stringify((() => { const u = [...document.querySelectorAll('div')].find((d) => d.children.length === 0 && /^pitchfootball\\.com\\.au\\/(c|fc)\\//.test(d.textContent.trim()));
      if (!u) return null; const box = u.closest('.hero-well, .card'), b = box.querySelector('button'), cs = getComputedStyle(u), r = u.getBoundingClientRect();
      const br = b?.getBoundingClientRect(), kr = box.getBoundingClientRect();
      return { lines: r.height < parseFloat(cs.fontSize) * 2 ? 1 : Math.round(r.height / parseFloat(cs.fontSize) / 1.3), ellipsis: cs.textOverflow === 'ellipsis' && cs.whiteSpace === 'nowrap', copy: Boolean(b) && /Copy/.test(b.textContent),
        beside: Boolean(br) && br.left >= r.right - 1 && br.right <= kr.right + 1 && br.top < r.bottom && br.bottom > r.top }; })())`);
    if (!l || l.lines !== 1 || !l.ellipsis || !l.copy || !l.beside) apFail('ap-l4', 375, `/home (${seat})`, `the link box: ${JSON.stringify(l)}`);
  }

  // ap-l5 (ruling 8): /club/roles — every Close sits at its row's end.
  await apWidth(1280); await apAs(ids.people.marina); await visit('/club/roles'); apChecked++;
  const closes = await eval_(`JSON.stringify([...document.querySelectorAll('.jr .jr-top')].map((t) => { const b = t.querySelector('button'); if (!b) return null;
    const card = t.closest('.jr'), cs = getComputedStyle(card); return Math.round(card.getBoundingClientRect().right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth) - b.getBoundingClientRect().right); }).filter((x) => x !== null))`);
  if (closes.length === 0 || closes.some((d) => Math.abs(d) > 1)) apFail('ap-l5', 1280, '/club/roles', `Close is ${JSON.stringify(closes)}px short of its row's end`);

  // ap-l6 (public #10): /jobs' Back is its own width, its word on the
  // title's left edge — not a 652px ghost floating under nothing.
  await apAs(null);
  for (const w of [375, 1280]) {
    await apWidth(w); await visit('/jobs'); apChecked++;
    const b = await eval_(`JSON.stringify((() => { const a = document.querySelector('.jb-foot a'), h = document.querySelector('h1'); if (!a || !h) return null;
      const r = document.createRange(); r.selectNodeContents(a); const t = [...r.getClientRects()].pop(); return { w: Math.round(a.getBoundingClientRect().width), word: Math.round(t.left), title: Math.round(h.getBoundingClientRect().left) }; })())`);
    if (!b || b.w > 200 || Math.abs(b.word - b.title) > 1) apFail('ap-l6', w, '/jobs', `Back: ${JSON.stringify(b)}`);
  }

  // ap-l7 (public #14): a legal table is its well's full width at a laptop —
  // every row's hairline reaches the well's right edge.
  for (const path of ['/privacy', '/privacy/family', '/terms']) {
    await visit(path); apChecked++;
    const short = await eval_(`JSON.stringify([...document.querySelectorAll('.legal-doc table')].flatMap((t) => { const well = t.parentElement; const wr = well.getBoundingClientRect();
      if (t.scrollWidth > well.clientWidth + 1) return [];
      const inner = wr.left + well.clientLeft + well.clientWidth; return [...t.querySelectorAll('tr')].filter((tr) => tr.getBoundingClientRect().height > 0).map((tr) => Math.round(inner - tr.lastElementChild.getBoundingClientRect().right)).filter((d) => d > 1); }))`);
    if (short.length) apFail('ap-l7', 1280, path, `${short.length} table row(s) stop short of the well, by up to ${Math.max(...short)}px`);
  }

  // ap-l8 (public #4, D-173): the front door's second headline is 24px at
  // every width; the hero headline still scales. ap-l10 (ruling 6, public
  // #7): no off-scale radius on the audited screens. ap-l11 (public #15): a
  // link on a legal page, the approval flow's policy and the front door's
  // "Sign in" is a 44px target.
  const RAD = `JSON.stringify((() => { const ok = (v) => { const n = parseFloat(v); return v.endsWith('%') ? v === '50%' : [0, 12, 14, 16, 22].includes(n) || n >= 999; };
    const out = []; for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (!r.width || !r.height || el.closest('svg')) continue;
      const cs = getComputedStyle(el); const v = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'].map((k) => cs[k]).find((x) => !ok(x));
      if (v) out.push((typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : el.tagName.toLowerCase()) + ' "' + (el.textContent || '').trim().slice(0, 18) + '" ' + v); }
    return [...new Set(out)]; })())`;
  // A link in running text is measured for height (a wrapped fragment can be
  // narrow and still be pressed by its line); a stand-alone one both ways.
  const TAPS = (sel, both = false) => `JSON.stringify([...document.querySelectorAll(${JSON.stringify(sel)})].flatMap((a) => [...a.getClientRects()].filter((r) => r.width > 0 && (r.height < 44 || (${both} && r.width < 44))).map((r) => '"' + a.textContent.trim().slice(0, 24) + '" ' + Math.round(r.width * 100) / 100 + 'x' + Math.round(r.height * 100) / 100)))`;
  const fdOn = async (on) => { await fetch(`${BASE}/dev/front-door?on=${on ? 1 : 0}`, { method: 'POST' }); };
  const heroSizes = [];
  await fdOn(true);
  try {
    for (const w of [375, 1280]) {
      await apWidth(w); await apAs(null);
      await visit('/'); apChecked++;
      const f = await eval_(`JSON.stringify((() => { const h2 = [...document.querySelectorAll('h2')].find((h) => /^Somebody should be writing this down/.test(h.textContent.trim())); const h1 = document.querySelector('.fl-hero-in h1');
        return { h2: h2 ? getComputedStyle(h2).fontSize : null, h1: h1 ? getComputedStyle(h1).fontSize : null }; })())`);
      heroSizes.push(f.h1);
      if (f.h2 !== '24px') apFail('ap-l8', w, '/', `the second headline is ${f.h2}, not the 24px it is on a phone`);
      const sign = await eval_(TAPS('.fl-wide a[href="/signin"]', true));
      if (sign.length) apFail('ap-l11', w, '/', `targets under 44px: ${sign.join(', ')}`);
      for (const path of ['/', '/?for=club']) {
        await visit(path); apChecked++;
        const off = await eval_(RAD);
        if (off.length) apFail('ap-l10', w, path, `off-scale radii: ${off.join(', ')}`);
      }
    }
  } finally { await fdOn(false); }
  if (heroSizes[0] === heroSizes[1]) apFail('ap-l8', 1280, '/', `the hero headline no longer scales (${heroSizes.join(' / ')})`);
  for (const w of [375, 1280]) {
    await apWidth(w);
    for (const [who, path] of [[jordan, `/build/${rec}/preview`], [ids.people.alex, `/build/${ids.children.deniz.record_id}/preview`], [ids.people.alex, `/g/controls/${ids.children.deniz.child_id}`],
      [ids.people.alex, '@interest'], [ids.people.alex, '@invite'], [ids.people.marina, '/club/page-edit']]) {
      await apAs(who);
      let p = path;
      if (p.startsWith('@')) { await visit('/home'); p = await eval_(`JSON.stringify(document.querySelector('a[href^="/g/${p.slice(1)}/"]')?.getAttribute('href') ?? '')`); }
      if (!p) { apFail('ap-l10', w, path, 'the parent’s home links no such page to measure'); continue; }
      await visit(p); apChecked++;
      const off = await eval_(RAD);
      if (off.length) apFail('ap-l10', w, p.replace(/[0-9a-f-]{36}/g, '*'), `off-scale radii: ${off.join(', ')}`);
    }
    await apAs(null);
    for (const path of ['/privacy', '/privacy/family', '/terms', '/conduct', '/report/policy', '/a/dev-mila-text']) {
      await visit(path); apChecked++;
      const small = await eval_(TAPS('.legal-doc a'));
      if (small.length) apFail('ap-l11', w, path, `${small.length} link fragment(s) under 44px, e.g. ${small.slice(0, 3).join(', ')}`);
    }
  }

  // ap-l9 (spec A as amended; BUZ, 2 Oct): at 1280 no door the rail carries
  // shows in the home's aside unless it has a count or a reason line, and a
  // list with nothing left is not drawn; at 375 every frame door is still on
  // /home — in its bar, its More sheet or the page.
  for (const [who, seat] of [[ids.people.marina, 'club TD'], [ids.people.sam, 'coach'], [jordan, 'player'], [ids.people.alex, 'parent']]) {
    await apAs(who);
    for (const w of [1280, 375]) {
      await apWidth(w); await visit('/home'); apChecked++;
      const r = await eval_(`JSON.stringify((() => { const rail = [...document.querySelectorAll('.console-nav a[href]')].map((a) => a.getAttribute('href')).filter((h) => h !== '/signout');
        const shown = (el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
        const dup = [...document.querySelectorAll('.console-main .doors a.row')].filter((a) => shown(a) && rail.includes(a.getAttribute('href')) && !a.querySelector('.row-end, .row-s')).map((a) => a.getAttribute('href'));
        const empty = [...document.querySelectorAll('.console-main .doors')].filter((d) => shown(d) && ![...d.querySelectorAll('a.row')].some(shown)).length;
        const reach = new Set([...document.querySelectorAll('.seat-tabs a[href]')].map((a) => a.getAttribute('href')).concat([...document.querySelectorAll('.console-main a[href]')].filter(shown).map((a) => a.getAttribute('href'))));
        return { dup, empty, missing: rail.filter((h) => !reach.has(h)) }; })())`);
      if (w === 1280 && (r.dup.length || r.empty)) apFail('ap-l9', w, `/home (${seat})`, `the aside repeats the rail: ${r.dup.join(', ') || `${r.empty} empty door list(s)`}`);
      if (w === 375 && r.missing.length) apFail('ap-l9', w, `/home (${seat})`, `frame doors /home no longer offers: ${r.missing.join(', ')}`);
    }
  }
  await cdp('Network.clearBrowserCookies');
  await apWidth(1280);
}

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
console.log(`ways in      · ${waysChecked} views of /signin, /join, /claim and /claim/[slug] — the logo is the bar's (left from 1024, right below), a door is a panel from 640 and a list is not, one glow, and sign-in's foot follows its content`);
for (const f of waysFails) console.log(`FAIL ${f.width}px · ${f.path} — ${f.what}`);
console.log(`walkthrough  · ${motionChecked} views at 390 and 1280 — a stat tile shows only its real value from the first frame and is still under reduced motion, and no locked Premium row is offered to press`);
for (const f of motionFails) console.log(`FAIL ${f.width}px · ${f.what}`);
for (const f of labelFails) console.log(`FAIL ${f.width}px · ${f.seat} · ${f.path} — ${f.labels.length} .field-label not at 10px: ${f.labels.map((l) => `"${l.text}" ${l.size}/${l.weight}`).join(', ')}`);
for (const f of bodyFails) console.log(`FAIL ${f.width}px · ${f.seat} · ${f.path} — the page paints ${f.bg}, not --bg ${tokenRgb}`);
for (const f of foldFails) console.log(`FAIL 375×667 · ${f.path} — ${f.missing ? 'no D-172 banner on the page' : `the banner's first line ends at ${f.bottom}px, below the ${f.vh}px fold`} (U5b)`);
console.log(`fold         · U5b: the unclaimed banner's first line inside the first screen at 375×667 on 3 unclaimed pages`);
console.log(`audit        · ap-l1–l11: ${apChecked} views — framed columns centred, the 560 home at 820, the hero pill, the link box, Close at the row's end, /jobs' Back, legal tables full width, one headline that scales, the charter's radii, 44px links, and the home aside that does not repeat the rail`);
for (const f of apFails) console.log(`FAIL ${f.width}px · ${f.path} — ${f.id} ${f.what}`);
console.log(`call sheet   · cs1: ${sheetChecked} views — the claim and the TD in a 320px aside at ≥1024 with the claim kept in view, and one column claim → TD → form below it`);
for (const f of sheetFails) console.log(`FAIL ${f.width}px · ${f.what}`);
console.log(`trial rows   · tb-foot: ${footChecked} rows on /trials — no divider, the notice link and the button on one line, each a 44px target`);
for (const f of footFails) console.log(`FAIL ${f.width}px · ${f.what}`);
console.log(`filters      · tf: ${tfChecked} views of /trials — the laptop rail's bottom reachable at 1280×800`);
for (const f of tfFails) console.log(`FAIL ${f.width}px · ${f.what}`);
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
const chromeBad = tfFails.length + footFails.length + apFails.length + sheetFails.length + foldFails.length + ringFails.length + labelFails.length + bodyFails.length + byWhat(tapFails).length + cspFails.length + analyticsFails.length + joinFails.length + waysFails.length + squeezeKeys.length + motionFails.length;
if (failures.length === 0 && chromeBad === 0) {
  console.log('ALL GREEN — nothing is wider than the screen, every control the keyboard reaches shows its ring, every caption is 10px, every page paints --bg, every control and phone link is a 44px target, no column of words is squeezed under 120px, no page broke its Content-Security-Policy, analytics started only on the four public pages, signed out, /join answers every press, the stat tiles never show a number that is not theirs, no Premium row is offered while D-163 stands, and the call sheet keeps its claim and TD where the operator can see them');
  process.exit(0);
}
for (const f of failures) {
  if (f.unrendered) { console.log(`FAIL ${f.width}px · ${f.seat} · ${f.path} — never rendered for this seat (${f.unrendered}), so never measured`); continue; }
  console.log(`FAIL ${f.width}px · ${f.seat} · ${f.path} — page ${f.doc}px wide on a ${f.vw}px screen; widest: ${f.widest} by ${f.over}px${f.text ? ` ("${f.text}")` : ''}`);
}
console.log(`\n${failures.length} page${failures.length === 1 ? '' : 's'} failed (too wide, or never rendered)`
  + `, ${chromeBad} chrome failure${chromeBad === 1 ? '' : 's'} (focus ring ${ringFails.length}, .field-label ${labelFails.length}, page colour ${bodyFails.length}, touch targets ${byWhat(tapFails).length}, policy refusals ${cspFails.length}, /join ${joinFails.length}, ways in ${waysFails.length}, squeezed ${squeezeKeys.length}, walkthrough ${motionFails.length}, call sheet ${sheetFails.length}, trial rows ${footFails.length}, filters ${tfFails.length}, audit ${apFails.length})`);
process.exit(1);
