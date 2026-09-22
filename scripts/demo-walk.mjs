// DEMO WALK — the club demo, driven in a real browser at laptop width, doing
// what docs/DEMO-TD.md tells BUZ to do, in that order. The render and layout
// suites walk the dev app; nothing walked the DEMO, so the demo's own story
// (claim, page editor, register, invitation) was only ever checked by hand.
//
//   npm run demo -- "Balmoral FC" --suburb Balmoral --state VIC   (in one terminal)
//   node scripts/demo-walk.mjs steps.txt                          (in another)
//
// Steps, one per line:
//   go <path>            navigate
//   click <text>         click the first link/button whose text contains it
//   type <name>=<value>  fill a field by name (a checkbox is ticked)
//   expect <text>        FAIL unless the page contains it
//   absent <text>        FAIL if the page contains it
//   at <path>            FAIL unless we are on that path
//   text [selector]      print what is on the page
//   shot <name>          a screenshot into $DEMO_OUT
//   width <px>           change the viewport
//   note <anything>      a heading in the output
//
// Exits non-zero if any expect/absent/at failed.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.DEMO_BASE ?? 'http://localhost:3030';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = process.env.DEMO_OUT ?? tmpdir();
// A fresh port every run. A headless Chrome that outlived the last run holds
// the old one, and /json/list then hands back ITS page — with the last seat's
// session cookie still in it, so the walk silently starts signed in as
// somebody else.
const PORT = 9400 + Math.floor(Math.random() * 400);

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'pitch-demo-'))}`, 'about:blank',
], { stdio: 'ignore' });
const stop = () => { try { chrome.kill(); } catch { /* gone */ } };
process.on('exit', stop);

let target;
for (let i = 0; i < 60 && !target; i++) {
  await new Promise((r) => setTimeout(r, 200));
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ }
}
if (!target) { console.error('Chrome did not start. Set CHROME_PATH if it is somewhere else.'); process.exit(2); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const waiting = new Map();
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
});
const cdp = (method, params = {}) => new Promise((resolve) => {
  const id = ++seq; waiting.set(id, resolve); ws.send(JSON.stringify({ id, method, params }));
});
await cdp('Page.enable');
await cdp('Runtime.enable');
await cdp('Network.enable');
await cdp('Network.clearBrowserCookies');
// The width is remembered on the page as well as set on the device, because
// `wide` has to measure against the DEVICE width and window.innerWidth is not
// it (L19).
let deviceWidth = Number(process.env.DEMO_WIDTH ?? 1280);
const setWidth = async (w) => {
  deviceWidth = w;
  await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: 880, deviceScaleFactor: 1, mobile: w < 768 });
};
await setWidth(deviceWidth);

const ev = async (expr) => {
  const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true });
  return r.result?.result?.value;
};
// A server action posts and re-renders without a load event, so settling on
// readyState alone reports the OLD page. Wait for the url or the body to stop
// moving, whichever happens first.
const settle = async () => {
  let last = '';
  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const now = await ev(`document.readyState + '|' + location.href + '|' + document.body?.innerText?.length`);
    if (now === last && String(now).startsWith('complete')) return;
    last = now;
  }
};
const here = async () => ev(`location.pathname + location.search`);
const body = async () => (await ev(`document.body.innerText`)) ?? '';

const steps = readFileSync(process.argv[2], 'utf8').split('\n')
  .map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
const fails = [];
let checks = 0;
// Things read off one page and typed into the next — the claim code is
// minted fresh every run, so a walk that cannot carry it cannot finish the
// story it exists to prove.
const held = new Map();
const expand = (s) => s.replace(/\$(\w+)/g, (m, k) => (held.has(k) ? held.get(k) : m));

for (const step of steps) {
  const verb = step.split(' ')[0];
  const arg = expand(step.slice(verb.length).trim());
  if (verb === 'note') { console.log(`\n=== ${arg}`); continue; }

  if (verb === 'go') {
    await cdp('Page.navigate', { url: BASE + arg });
    await settle();
    console.log(`  go     ${arg} → ${await here()}`);
  } else if (verb === 'click') {
    const hit = await ev(`(() => {
      const want = ${JSON.stringify(arg)}.toLowerCase();
      const els = [...document.querySelectorAll('a,button,input[type=submit],[role=button]')];
      const el = els.find((e) => (e.innerText || e.value || '').trim().toLowerCase().includes(want));
      if (!el) return null;
      el.scrollIntoView({ block: 'center' }); el.click();
      return (el.innerText || el.value || '').trim().replace(/\\s+/g, ' ').slice(0, 50);
    })()`);
    await settle();
    checks++;
    if (hit === null) { fails.push(`click "${arg}" — nothing on the page says that (${await here()})`); console.log(`  CLICK? ${arg} — NOT FOUND`); }
    else console.log(`  click  "${hit}" → ${await here()}`);
  } else if (verb === 'type') {
    const i = arg.indexOf('=');
    const [name, value] = [arg.slice(0, i), arg.slice(i + 1)];
    const r = await ev(`(() => {
      const el = document.querySelector('[name=' + ${JSON.stringify(JSON.stringify(name))} + ']');
      if (!el) return null;
      if (el.type === 'checkbox') { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); return 'ticked'; }
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return el.value;
    })()`);
    checks++;
    if (r === null) { fails.push(`type ${name} — no such field on ${await here()}`); console.log(`  TYPE?  ${name} — NOT FOUND`); }
    else console.log(`  type   ${name} = ${r}`);
  } else if (verb === 'fill') {
    // /join is a client component and its first-name and date-of-birth
    // inputs are React-controlled with no name attribute (L10), so they are
    // reached by CSS selector and driven through the native setter — which is
    // what React's own change tracking listens to.
    // The LAST '=', because a CSS selector has its own ("input[name=email]").
    const i = arg.lastIndexOf('=');
    const [sel, value] = [arg.slice(0, i), arg.slice(i + 1)];
    const r = await ev(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return null;
      if (el.type === 'checkbox') { el.click(); return 'ticked'; }
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return el.value;
    })()`);
    checks++;
    if (r === null) { fails.push(`fill ${sel} — no such field on ${await here()}`); console.log(`  FILL?  ${sel} — NOT FOUND`); }
    else console.log(`  fill   ${sel} = ${r}`);
  } else if (verb === 'wide') {
    // The layout check, on the page we are standing on. Measured against the
    // DEVICE width, never window.innerWidth, which a browser widens to fit an
    // overflowing page — that is what made the first layout check blind (L19).
    const m = await ev(`(() => {
      const vw = ${deviceWidth}, doc = document.documentElement.scrollWidth;
      let widest = null, w = 0;
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        const over = Math.max(r.right - vw, -r.left);
        if (over > w) { w = over; widest = el; }
      }
      const name = (el) => el ? el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList[0] ? '.' + el.classList[0] : '') : '';
      return JSON.stringify({ vw, doc, over: Math.round(w), widest: name(widest) });
    })()`);
    const r = JSON.parse(m);
    checks++;
    const fits = r.doc <= r.vw + 1;
    if (!fits) fails.push(`wide ${await here()} — page ${r.doc}px on a ${r.vw}px screen; widest ${r.widest} by ${r.over}px`);
    console.log(`  ${fits ? 'ok    ' : 'FAIL  '} wide ${r.doc}/${r.vw}px`);
  } else if (verb === 'grab') {
    const i = arg.indexOf('=');
    const [name, pattern] = [arg.slice(0, i), arg.slice(i + 1)];
    const m = (await body()).match(new RegExp(pattern));
    checks++;
    if (!m) { fails.push(`grab ${name} — ${pattern} matched nothing on ${await here()}`); console.log(`  GRAB?  ${name} — no match`); }
    else { held.set(name, m[1] ?? m[0]); console.log(`  grab   ${name} = ${held.get(name)}`); }
  } else if (verb === 'expect' || verb === 'absent') {
    const has = (await body()).toLowerCase().includes(arg.toLowerCase());
    checks++;
    const ok = verb === 'expect' ? has : !has;
    if (!ok) fails.push(`${verb} "${arg}" on ${await here()}`);
    console.log(`  ${ok ? 'ok    ' : 'FAIL  '} ${verb} "${arg}"`);
  } else if (verb === 'at') {
    const at = await here();
    checks++;
    const ok = at === arg || at.startsWith(arg);
    if (!ok) fails.push(`at ${arg} — landed on ${at}`);
    console.log(`  ${ok ? 'ok    ' : 'FAIL  '} at ${arg}${ok ? '' : ` (${at})`}`);
  } else if (verb === 'text') {
    const sel = arg || 'body';
    console.log(`  text ${sel}:\n${(await ev(`document.querySelector(${JSON.stringify(sel)})?.innerText ?? '(no match)'`))}`);
  } else if (verb === 'shot') {
    const r = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    writeFileSync(join(OUT, `${arg}.png`), Buffer.from(r.result.data, 'base64'));
    console.log(`  shot   ${arg}.png`);
  } else if (verb === 'width') {
    await setWidth(Number(arg));
    console.log(`  width  ${arg}`);
  } else {
    console.log(`  ?      ${step}`);
  }
}

stop();
console.log(`\ndemo walk · ${checks} checks`);
if (fails.length === 0) { console.log('ALL GREEN'); process.exit(0); }
for (const f of fails) console.log(`FAIL ${f}`);
console.log(`\n${fails.length} failed`);
process.exit(1);
