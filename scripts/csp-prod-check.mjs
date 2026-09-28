// THE CONTENT-SECURITY-POLICY A PRODUCTION BUILD ACTUALLY SENDS (D-94 §8).
//
// `next dev` needs eval (React rebuilds server error stacks in the browser
// with it) and the hot-reload websocket, so the policy carries both in
// development — and a production build must carry neither. The permission
// suite reads lib/csp.ts and proxy.ts for that (csp-p1..p4); this asks the
// built app itself, because a policy is what the server sends, not what the
// source says it will.
//
//   SUPABASE_DB_URL=postgres://ci@127.0.0.1:5432/ci npm run build:check
//   npm run test:csp-prod            # CSP_CHECK_PORT, default 3001
//
// It starts `next start` on the .next-check build, reads three pages' headers,
// and stops the server it started (by its own pid, and it checks the port is
// free afterwards). No database is needed: the proxy sets the header before
// any page runs, so a page that cannot reach a database still answers with
// the policy on it.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.CSP_CHECK_PORT) || 3001;
const BASE = `http://127.0.0.1:${PORT}`;
const root = fileURLToPath(new URL('..', import.meta.url));
if (!existsSync(`${root}.next-check/BUILD_ID`)) {
  console.error('No production build in .next-check — run `npm run build:check` first.');
  process.exit(2);
}
const free = await new Promise((resolve) => {
  const srv = createServer().once('error', () => resolve(false)).once('listening', () => srv.close(() => resolve(true)));
  srv.listen(PORT, '127.0.0.1');
});
if (!free) { console.error(`Port ${PORT} is in use. Stop what is on it, or set CSP_CHECK_PORT.`); process.exit(2); }

let pass = 0; const failures = [];
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass += 1; console.log(`OK   ${name}`); }
  else { failures.push(name); console.log(`FAIL ${name} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}
const directive = (p, name) => (p ?? '').split(';').map((d) => d.trim()).find((d) => d === name || d.startsWith(name + ' ')) ?? '';
// What a production policy must be. Written once and asked of both the
// development policy (which must FAIL it — otherwise this checker could not
// tell the two apart, L19) and the built app's header.
const productionShape = (csp) => ({
  nonce: /'nonce-[A-Za-z0-9+/=]+'/.test(directive(csp, 'script-src')),
  strictDynamic: /'strict-dynamic'/.test(directive(csp, 'script-src')),
  noEval: !/unsafe-eval/.test(csp ?? ''),
  noInlineScript: !/unsafe-inline/.test(directive(csp, 'script-src')),
  noSocket: !/\bwss?:/.test(csp ?? ''),
  noFraming: directive(csp, 'frame-ancestors') === "frame-ancestors 'none'",
});
const ALL_TRUE = { nonce: true, strictDynamic: true, noEval: true, noInlineScript: true, noSocket: true, noFraming: true };

const { contentSecurityPolicy } = await import('../lib/csp.ts');
const devShape = productionShape(contentSecurityPolicy('selftest', { dev: true }));
if (devShape.noEval || devShape.noSocket) {
  console.error('SELF-TEST FAILED: the development policy passed as production — this check cannot tell them apart.');
  process.exit(2);
}

const server = spawn(`${root}node_modules/.bin/next`, ['start', '-p', String(PORT), '-H', '127.0.0.1'], {
  cwd: root,
  env: { ...process.env, NODE_ENV: 'production', NEXT_DIST_DIR: '.next-check',
    SUPABASE_DB_URL: process.env.SUPABASE_DB_URL || 'postgres://ci@127.0.0.1:5432/ci' },
  stdio: 'ignore',
});
const stop = () => { try { server.kill('SIGTERM'); } catch { /* gone */ } };
process.on('exit', stop);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stop(); process.exit(130); });

let up = false;
for (let i = 0; i < 120 && !up; i++) {
  await new Promise((r) => setTimeout(r, 250));
  try { await fetch(`${BASE}/robots.txt`); up = true; } catch { /* not yet */ }
}
if (!up) { console.error('The production server did not start.'); stop(); process.exit(2); }

const head = async (path) => {
  const r = await fetch(BASE + path, { redirect: 'manual' });
  await r.text();
  return { status: r.status, csp: r.headers.get('content-security-policy'), referrer: r.headers.get('referrer-policy') };
};
const signin = await head('/signin'), again = await head('/signin');
const shared = await head('/p/csp-check-never-a-link');
check('cspb1: a production build sends a Content-Security-Policy on every page', [Boolean(signin.csp), Boolean(shared.csp)], [true, true]);
check('cspb2: and it is the production policy — nonce and strict-dynamic, no eval, no inline script, no websocket, no framing',
  productionShape(signin.csp), ALL_TRUE);
check('cspb3: the nonce is fresh on every request',
  /'nonce-([^']+)'/.exec(signin.csp ?? '')?.[1] !== /'nonce-([^']+)'/.exec(again.csp ?? '')?.[1], true);
check('cspb4: a shared CV page sends no referrer, beside the policy (D-94 §5)', shared.referrer, 'no-referrer');

stop();
await new Promise((r) => setTimeout(r, 1000));
const freed = await new Promise((resolve) => {
  const srv = createServer().once('error', () => resolve(false)).once('listening', () => srv.close(() => resolve(true)));
  srv.listen(PORT, '127.0.0.1');
});
check('cspb5: and the server this started is gone', freed, true);

console.log(`\n${pass} passed, ${failures.length} failed${failures.length ? ' - ' + failures.join('; ') : ' - ALL GREEN'}`);
process.exit(failures.length ? 1 : 0);
