// TIMING — doc 14 §K conditions 3, 7 and 10, measured against the running app.
//
//   E10  the dead-link page answers every dead state in the same time: a link
//        renewed away (E4), a profile the guardian switched off (E5), a link
//        past its date (E7), a player who has been deleted (E8), and a string
//        that was never a link (E9)
//   L40  a send refused by the daily limit answers in the same time as a real
//        send (L38 already makes the two byte-identical)
//   J61  a club cannot learn that a held registration existed and was taken
//        off: its own pages answer the same, byte for byte and in time
//   tok-rl  a read refused by the token path's rate limit (lib/record-read,
//        per link and per address) answers as a link that never existed,
//        byte for byte and in time, whether the link is live or not. Not a
//        doc 14 row: CLAUDE.md §2 asks for the limit, D-77 for the answer.
//   req-t   request-access from the dead-link page answers a string that was
//        never a link, a dead link and a live one — sent, or already asked
//        today and held — byte for byte and in time (D-77, D-80; doc 14 C6
//        and C7 ask for one answer, and this measures it). Not labelled with
//        a row id: no doc 14 row words the timing of this handler (L4).
//   jr-undo the §36/§37 undo link (G-P1; John, 1 Oct): opening a used, a
//        lapsed or an already-off one, and pressing any of them or a live
//        one that lands on Done, against one that never existed — byte for
//        byte where the answer is the same, and in time for all of them.
//        Not a doc 14 row (L4).
//
// Until 28 Sep all three were "met" by structural checks in the permission
// suite — the page branches on one boolean, the limit is checked after the
// session work, the withdrawn row leaves the count. Those are good checks and
// they stay (relabelled, so they no longer claim these rows). Doc 14 asks for
// something else: "a test, not a hope — assert within a tolerance band", "by
// diffing two captured responses, not by reading the handler". This is that.
//
//   npm run test:timing        needs the dev app and the dev database, like
//                              the render suite. RUN IT LAST: it pauses a
//                              child, replaces a link, deletes a child, sends
//                              about 120 CVs, registers and withdraws
//                              interest, and replaces Deniz's link and asks
//                              for access a few hundred times. Reseed after it.
//
// HOW IT DECIDES, and why these numbers.
//
// Every arm is sampled in the same rounds, in a fresh random order each round,
// after a warm-up, so drift in the machine lands on every arm alike. Two arms
// are compared with the Mann-Whitney U test (no assumption about the shape of
// the distribution — response times are skewed, with a long right tail) and
// the shift between them is estimated with Hodges-Lehmann (the median of every
// pairwise difference).
//
//   A comparison FAILS when the difference is real at p < 0.001, divided by
//   the number of comparisons in that row (Bonferroni). That is a one-in-a-
//   thousand chance per run of failing on noise, and it is deliberately not
//   softened by a "small enough to ignore" allowance: an attacker who can
//   send as many requests as we can sees whatever we can see, and this runs on
//   a machine with no network between client and server — the quietest line
//   anyone will ever have to this app. If we can see it here, they can see it.
//
//   A comparison PASSES only if the run could have seen a difference that
//   matters. Every row first proves its own resolution (L19): its baseline
//   arm is split in two, one half is shifted by s milliseconds, and s is
//   raised until the same test catches it. Split in two and NOT shifted, it
//   must not be caught. The smallest s caught is printed. If it is above
//   MAX_RESOLUTION_MS (1 ms) the row is INCONCLUSIVE, which fails the run: a
//   pass from an instrument that cannot see a millisecond is not a pass.
//   Why a millisecond: in production one more database round trip (Vercel to
//   Supabase, both Sydney) costs about that, and "one more query on one
//   branch" is the realistic shape of a timing leak in this code.
//
// WHAT THIS CANNOT SEE, stated rather than hidden. The dev database answers a
// query in well under a millisecond, so a branch that makes one more query
// shows here as a fraction of what it costs in production. The structural
// checks in the permission suite (lsp1, lim-struct1/2, held-count1) are the
// belt for that: they assert each path makes the same queries. A real send's
// provider call is no longer in the request at all (lib/messaging, after(),
// 29 Sep) and both send paths answer on a fixed floor (lib/send-dispatch
// SEND_ANSWER_FLOOR_MS); lim-after1 and lim-floor1–3 in the permission suite
// pin both, because no local run makes a provider call to be seen.
import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.RENDER_BASE ?? 'http://localhost:3000';
// Rounds per arm: at least N, then more in steps of STEP until the row can see
// TARGET_RESOLUTION_MS, up to MAX_ROUNDS. The machine is shared (other seats,
// BUZ's own Chrome, macOS's downloads), so how many samples a millisecond
// takes is measured each run, not assumed: the same 300 rounds resolved
// 0.75ms at 10am and 1.2ms at 3pm on 28 Sep.
const N = Number(process.env.TIMING_SAMPLES) || 300;
const STEP = 100;
const MAX_ROUNDS = Number(process.env.TIMING_MAX_ROUNDS) || 1500;
const WARMUP = 20;
const ALPHA = 0.001;
// TIMING_ROWS=L40 (or E10,tok-rl) runs only the rows named — for proving one
// row red with its bug put back, without half an hour of the others. A
// partial run says so on its last line and is never a gate result.
const ROWS = (process.env.TIMING_ROWS ?? '').split(',').map((r) => r.trim()).filter(Boolean);
const runs = (row) => ROWS.length === 0 || ROWS.includes(row);
const MAX_RESOLUTION_MS = 1;
const TARGET_RESOLUTION_MS = 0.8;

// A run that stops must say why (L37's rule for a wedged browser). The usual
// cause here is `next dev` restarting itself when its memory climbs — it
// prints "approaching the used memory threshold" and drops the request in
// flight — and a half-measured row is not a measurement.
process.on('uncaughtException', (e) => {
  console.error(`\ntiming STOPPED — ${e?.message ?? e}${e?.cause?.message ? ` (${e.cause.message})` : ''}`);
  console.error('If the app log says "approaching the used memory threshold", `next dev` restarted mid-run: restart the app, reseed, and run again. Nothing measured above this line is a result.');
  process.exit(2);
});

const ids = JSON.parse(readFileSync(new URL('../.dev-ids.json', import.meta.url), 'utf8'));
if (!ids.adultPlayers || !ids.heldClub) {
  console.error('.dev-ids.json has no adultPlayers/heldClub — reseed (node scripts/dev-db.mts) so it matches this suite');
  process.exit(2);
}
const sessionToken = (p) => {
  const t = ids.sessions?.[p];
  if (!t) throw new Error(`no seeded session for ${p} — reseed so .dev-ids.json matches the running database`);
  return t;
};
const cookieFor = (p) => {
  const t = sessionToken(p);
  return `pitch_session=${t}.${createHmac('sha256', process.env.SESSION_SECRET || 'dev-only-secret-not-for-production').update(t).digest('base64url')}`;
};
const get = async (path, who) => {
  const r = await fetch(BASE + path, { redirect: 'manual', headers: who ? { cookie: cookieFor(who) } : {} });
  return { status: r.status, location: r.headers.get('location') ?? '', html: await r.text() };
};
const post = async (path, who, fields) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const r = await fetch(BASE + path, { method: 'POST', body: fd, redirect: 'manual', headers: who ? { cookie: cookieFor(who) } : {} });
  const body = await r.text();
  return { status: r.status, location: r.headers.get('location') ?? '', body, headers: [...r.headers.entries()] };
};
/** Every <form> on a page: its hidden fields and its submit label. */
const forms = (html) => [...html.matchAll(/<form([^>]*)>([\s\S]*?)<\/form>/g)].map((m) => {
  const fields = {};
  for (const i of m[2].matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = /name="([^"]*)"/.exec(i[0])?.[1];
    if (name) fields[name] = /value="([^"]*)"/.exec(i[0])?.[1] ?? '';
  }
  const submit = (/<button[^>]*type="submit"[^>]*>([\s\S]*?)<\/button>/.exec(m[2])?.[1] ?? '').replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, "'").trim();
  const aria = /<button[^>]*aria-label="([^"]*)"/.exec(m[2])?.[1] ?? '';
  return { fields, submit, aria, body: m[2] };
});
// A client-component form has no action id in its HTML (L10); Next's own
// manifest names it, exactly as the write suite finds the sign-up actions.
const actionId = (file, name) => {
  const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../.next/dev/server/server-reference-manifest.json', import.meta.url)), 'utf8'));
  return Object.entries(manifest.node).find(([, v]) => v.filename === file && v.exportedName === name)?.[0];
};
const title = (html) => /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
// What differs between two responses that cannot tell anyone anything: the
// nonce (fresh every request, D-94 §8 — and repeated inside the page's own
// payload, so every copy of it goes), Next's per-request id, the dev
// cache-buster, and the token the requester already holds.
const normalise = (html, token) => {
  let out = html;
  for (const re of [/nonce="([^"]+)"/, /self\.__next_r="([^"]+)"/]) {
    const v = re.exec(out)?.[1];
    if (v) out = out.split(v).join('<per-request>');
  }
  out = out.replace(/\?v=\d+/g, '');
  if (token) out = out.split(token).join('<token>').split(encodeURIComponent(token)).join('<token>');
  return out;
};

// ---- timing and statistics -------------------------------------------------
const timed = async (fn) => {
  const t0 = process.hrtime.bigint();
  const out = await fn();
  return { ms: Number(process.hrtime.bigint() - t0) / 1e6, out };
};
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const quantile = (a, q) => { const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * q; const lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
// Standard normal CDF (Abramowitz & Stegun 7.1.26, |error| < 1.5e-7).
const phi = (z) => {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
};
/** Mann-Whitney U, two-sided, normal approximation with the tie correction. */
function mannWhitney(a, b) {
  const all = a.map((v) => [v, 0]).concat(b.map((v) => [v, 1])).sort((x, y) => x[0] - y[0]);
  const ranks = new Array(all.length);
  let ties = 0;
  for (let i = 0; i < all.length;) {
    let j = i;
    while (j + 1 < all.length && all[j + 1][0] === all[i][0]) j++;
    for (let k = i; k <= j; k++) ranks[k] = (i + j) / 2 + 1;
    const t = j - i + 1; ties += t * t * t - t;
    i = j + 1;
  }
  let r1 = 0;
  for (let k = 0; k < all.length; k++) if (all[k][1] === 0) r1 += ranks[k];
  const n1 = a.length, n2 = b.length, n = n1 + n2;
  const u = r1 - (n1 * (n1 + 1)) / 2;
  const sigma = Math.sqrt((n1 * n2 / 12) * ((n + 1) - ties / (n * (n - 1))));
  const z = sigma === 0 ? 0 : (u - (n1 * n2) / 2) / sigma;
  return 2 * (1 - phi(Math.abs(z)));
}
/** Hodges-Lehmann shift of b over a: the median of every pairwise difference. */
const hodgesLehmann = (a, b) => { const d = []; for (const x of a) for (const y of b) d.push(y - x); return quantile(d, 0.5); };
const describe = (a) => `median ${quantile(a, 0.5).toFixed(2)}ms (p10 ${quantile(a, 0.1).toFixed(2)}, p90 ${quantile(a, 0.9).toFixed(2)}, n ${a.length})`;

/**
 * The row's own proof that it can see what it claims to (L19). The baseline
 * arm, split at random: unshifted it must NOT be flagged; shifted, the
 * smallest shift that IS flagged is the resolution of this run.
 */
//
// Five random splits, and the median of what they say, so one lucky or
// unlucky split cannot decide the run. Halves are half the size of the real
// comparison, so the resolution printed is if anything pessimistic.
function resolution(baseline, alpha) {
  const found = [];
  let nullHits = 0;
  for (let t = 0; t < 5; t++) {
    const s = shuffle(baseline);
    const a = s.slice(0, s.length >> 1), b = s.slice(s.length >> 1);
    if (mannWhitney(a, b) < alpha) nullHits++;
    // The smallest shift caught, to 0.05ms. Catching is monotonic in the
    // shift, so a bisection finds it.
    let lo = 0, hi = 20;
    if (mannWhitney(a, b.map((x) => x + hi)) >= alpha) { found.push(Infinity); continue; }
    while (hi - lo > 0.05) {
      const mid = (lo + hi) / 2;
      if (mannWhitney(a, b.map((x) => x + mid)) < alpha) hi = mid; else lo = mid;
    }
    found.push(Math.round(hi * 100) / 100);
  }
  const med = quantile(found, 0.5);
  return { nullFlagged: nullHits >= 3, res: Number.isFinite(med) ? med : null };
}

/**
 * Run `round` until EVERY arm resolves TARGET_RESOLUTION_MS (or the cap is
 * reached): N rounds first, then STEP at a time. The same rule judge() applies
 * — the noisiest arm decides — or a row stops sampling on its quiet arm and is
 * then judged inconclusive on its loud one (E10, 28 Sep). Stopping looks only
 * at each arm's own spread, never at a difference between arms, so it cannot
 * steer a comparison towards a pass. Returns the number of rounds run.
 */
async function sampleUntilResolved(round, armsNow, alpha, minRounds = N) {
  let rounds = 0;
  for (let i = 0; i < WARMUP; i++) await round(false);
  while (rounds < MAX_ROUNDS) {
    const want = rounds < minRounds ? minRounds : rounds + STEP;
    while (rounds < want) { await round(true); rounds++; }
    const worst = Math.max(...armsNow().map((a) => resolution(a, alpha).res ?? Infinity));
    if (worst <= TARGET_RESOLUTION_MS) break;
  }
  return rounds;
}

let pass = 0; const failures = []; let inconclusive = false;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass += 1; console.log(`OK   ${name}`); }
  else { failures.push(name); console.log(`FAIL ${name} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}
/** Compare every arm against the baseline, after the row proves its resolution. */
// `family` is how many comparisons the row makes in all, when they are split
// across more than one call (J61 asks two pages); the correction covers them.
function judge(row, what, baselineName, arms, family) {
  const others = Object.keys(arms).filter((k) => k !== baselineName);
  const alpha = ALPHA / (family ?? others.length);
  // The resolution a row claims is its NOISIEST arm's, not its baseline's: a
  // quiet first block and a loud second one can see no more than the loud one
  // lets them (J61, 28 Sep: the machine's load went from 4 to 9 between its
  // two blocks and the second block's tails were four times as wide).
  const perArm = Object.values(arms).map((a) => resolution(a, alpha));
  const nullFlagged = perArm.some((r) => r.nullFlagged);
  const res = perArm.some((r) => r.res === null) ? null : Math.max(...perArm.map((r) => r.res));
  console.log(`\n${row} · ${what}`);
  for (const [k, v] of Object.entries(arms)) console.log(`     ${k.padEnd(28)} ${describe(v)}`);
  console.log(`     resolution: this run would catch a shift of ${res === null ? 'MORE THAN 20' : res.toFixed(2)}ms at p < ${alpha.toPrecision(2)} (its noisiest arm); an unshifted split was ${nullFlagged ? 'FLAGGED' : 'not flagged'}`);
  if (nullFlagged) {
    console.error(`INSTRUMENT FAILED (${row}): two halves of the same arm read as different — nothing this row says can be trusted.`);
    process.exit(2);
  }
  const flagged = [];
  for (const k of others) {
    const p = mannWhitney(arms[baselineName], arms[k]);
    const hl = hodgesLehmann(arms[baselineName], arms[k]);
    console.log(`     ${k} vs ${baselineName}: shift ${hl >= 0 ? '+' : ''}${hl.toFixed(2)}ms, p = ${p.toPrecision(2)} → ${p < alpha ? 'DISTINGUISHABLE' : 'not distinguishable'}`);
    if (p < alpha) flagged.push(`${k} ${hl >= 0 ? '+' : ''}${hl.toFixed(2)}ms`);
  }
  // Whether the ROW is inconclusive is the caller's to say: J61 judges two
  // pages, and one page caught is a conclusive failure even if the other
  // page could not be resolved.
  const conclusive = flagged.length > 0 || (res !== null && res <= MAX_RESOLUTION_MS);
  return { flagged, conclusive, res };
}

// The token path counts reads per link and per address (lib/record-read), and
// the suite is one address. /dev/ratelimit empties the counters; it does not
// exist in production (permission suite dev2).
const clearRateLimits = async () => {
  const r = await fetch(`${BASE}/dev/ratelimit`, { method: 'POST' });
  if (!r.ok) throw new Error(`could not clear the rate limiter (${r.status}) — is this the dev app?`);
};
// E10 replaces Deniz's link; the fresh one it gets back is a live link the
// rate-limit row can use. If E10 did not run, dev-deniz is still live.
let freshDeniz = null;

// ---------------------------------------------------------------------------
// E10 — every dead link, the same page in the same time (D-77).
// ---------------------------------------------------------------------------
if (runs('E10')) {
  const parent = ids.people.alex;
  const kids = ids.children;
  const deadTitle = title((await get(`/p/${randomBytes(32).toString('base64url')}`)).html);
  const live = async (tok) => title((await get(`/p/${tok}`)).html) !== deadTitle;
  check('E10 setup: the three fixture links are live before anything is done to them',
    [await live('dev-deniz'), await live('dev-georgia'), await live('dev-nate')], [true, true, true]);

  // E4 — the guardian replaces Deniz's link; dev-deniz is now renewed away.
  const denizForms = forms((await get(`/g/controls/${kids.deniz.child_id}`, parent)).html);
  const replace = denizForms.find((f) => f.submit === 'Replace');
  if (replace) {
    const replaced = await post(`/g/controls/${kids.deniz.child_id}`, parent, replace.fields);
    freshDeniz = /[?&]link=([^&#]+)/.exec(replaced.location)?.[1] ?? null;
  }
  // E5 — the guardian switches Nate's profile off.
  const nateForms = forms((await get(`/g/controls/${kids.nate.child_id}`, parent)).html);
  const pause = nateForms.find((f) => f.fields.paused === 'true');
  if (pause) await post(`/g/controls/${kids.nate.child_id}`, parent, pause.fields);
  // E8 — the guardian deletes Georgia; dev-georgia now belongs to nobody.
  // Georgia, not Nate: the seed gives Nate an investigator's look (doc 31
  // U-6) and the deletion cascade cannot reach investigation_access yet (the
  // builder report of 28 Sep), so his delete is refused.
  const georgiaForms = forms((await get(`/g/controls/${kids.georgia.child_id}`, parent)).html);
  const del = georgiaForms.find((f) => /^Delete /.test(f.submit));
  if (del) await post(`/g/controls/${kids.georgia.child_id}`, parent, del.fields);
  check('E10 setup: renewed away, switched off and deleted, each through the guardian’s own controls',
    [Boolean(replace && pause && del), await live('dev-deniz'), await live('dev-georgia'), await live('dev-nate'), await live('dev-expired')],
    [true, false, false, false, false]);

  const STATES = {
    'E9 never a link': () => randomBytes(32).toString('base64url'),
    'E4 renewed away': () => 'dev-deniz',
    'E5 profile switched off': () => 'dev-nate',
    'E7 past its date': () => 'dev-expired',
    'E8 player deleted': () => 'dev-georgia',
  };
  const arms = Object.fromEntries(Object.keys(STATES).map((k) => [k, []]));
  const bodies = {};
  // This row samples each dead link far past the token path's own rate limit
  // (lib/record-read: 300 reads of a link an hour), which exists to stop a
  // stranger doing exactly this. It measures the links, so it clears the
  // counters every 50 rounds, untimed, well inside both limits; the limit is
  // measured in its own row below (tok-rl).
  let e10Rounds = 0;
  await clearRateLimits();
  await sampleUntilResolved(async (keep) => {
    if (++e10Rounds % 50 === 0) await clearRateLimits();
    for (const k of shuffle(Object.keys(STATES))) {
      const tok = STATES[k]();
      const { ms, out } = await timed(async () => { const res = await fetch(`${BASE}/p/${tok}`); return { status: res.status, html: await res.text() }; });
      if (keep) arms[k].push(ms);
      if (keep && !bodies[k]) bodies[k] = { status: out.status, html: normalise(out.html, tok) };
    }
  }, () => Object.values(arms), ALPHA / (Object.keys(STATES).length - 1));
  const baseBody = bodies['E9 never a link'];
  const differ = Object.entries(bodies).filter(([, b]) => b.status !== baseBody.status || b.html !== baseBody.html).map(([k]) => k);
  check('E10b: every dead state is served the same status and the same bytes as a link that never existed (nonce and the token itself aside)', differ, []);
  const { flagged, conclusive, res } = judge('E10', 'the dead-link page, per dead state', 'E9 never a link', arms);
  if (!conclusive) inconclusive = true;
  check(`E10: no dead state is distinguishable from a link that never existed by response time${conclusive ? ` (resolution ${res?.toFixed(2)}ms)` : ' — INCONCLUSIVE'}`,
    conclusive ? flagged : 'inconclusive', []);
}

// ---------------------------------------------------------------------------
// tok-rl — the token path's rate limit, answered as a link that never existed
// (CLAUDE.md §2; D-77; brief C, 29 Sep). The same method as E10: the arms in
// the same rounds, in a fresh order each round, against a string that was
// never a link, after the row proves its own resolution. A refusal that a
// stranger could tell from a dead link — by its bytes or by its time — would
// tell them the link they are holding is live, which is the thing D-77 hides.
//
// The suite plays many addresses by sending its own X-Forwarded-For (Next
// keeps one that arrives; on Vercel the platform sets it). Three arms:
//   · a live link read past its own limit, from a fresh address each time;
//   · a second live link, read from an address past its limit;
//   · a string that was never a link, from that same address.
// ---------------------------------------------------------------------------
if (runs('tok-rl')) {
  const m = /TOKEN_READ_LIMITS = \{ perLink: (\d+), perAddress: (\d+)/.exec(readFileSync(new URL('../lib/record-read.ts', import.meta.url), 'utf8'));
  const [perLink, perAddress] = [Number(m?.[1]), Number(m?.[2])];
  let nIp = 0;
  const freshIp = () => { nIp++; return `10.${(nIp >> 16) & 255}.${(nIp >> 8) & 255}.${nIp & 255}`; };
  const OVER = '10.250.0.1';
  const read = async (tok, ip) => {
    const res = await fetch(`${BASE}/p/${tok}`, { headers: { 'x-forwarded-for': ip } });
    return { status: res.status, html: await res.text() };
  };
  const deadTitle = title((await read(randomBytes(32).toString('base64url'), freshIp())).html);
  const live = async (tok, ip) => title((await read(tok, ip)).html) !== deadTitle;
  const first = 'dev-jordan', second = freshDeniz ?? 'dev-deniz';
  await clearRateLimits();
  // Exactly at the boundary, so a page that counted one view twice (its title
  // and its body) would be caught refusing a family at half the number.
  // The first link: read perLink - 1 times from addresses that are all new,
  // then the last allowed read, then the first refused one.
  for (let i = 0; i < perLink - 1; i++) await read(first, freshIp());
  const linkEdge = [await live(first, freshIp()), await live(first, freshIp())];
  // One address: perAddress - 1 reads of strings that were never links, then
  // the second live link as its last allowed read and its first refused one —
  // and still live from any other address.
  for (let i = 0; i < perAddress - 1; i++) await read(randomBytes(32).toString('base64url'), OVER);
  const addressEdge = [await live(second, OVER), await live(second, OVER), await live(second, freshIp())];
  check(`tok-rl setup: a link's read ${perLink} is served and read ${perLink + 1} refused; an address's read ${perAddress} is served and read ${perAddress + 1} refused, while the same link stays live from anywhere else`,
    [Number.isFinite(perLink) && Number.isFinite(perAddress), linkEdge, addressEdge], [true, [true, false], [true, false, true]]);

  const ARMS = {
    'never a link (E9)': () => [randomBytes(32).toString('base64url'), freshIp()],
    'a live link over its own limit': () => [first, freshIp()],
    'a live link, from an address over its limit': () => [second, OVER],
    'never a link, from an address over its limit': () => [randomBytes(32).toString('base64url'), OVER],
  };
  const arms = Object.fromEntries(Object.keys(ARMS).map((k) => [k, []]));
  const bodies = {};
  await sampleUntilResolved(async (keep) => {
    for (const k of shuffle(Object.keys(ARMS))) {
      const [tok, ip] = ARMS[k]();
      const { ms, out } = await timed(() => read(tok, ip));
      if (keep) arms[k].push(ms);
      if (keep && !bodies[k]) bodies[k] = { status: out.status, html: normalise(out.html, tok) };
    }
  }, () => Object.values(arms), ALPHA / (Object.keys(ARMS).length - 1));
  const base = bodies['never a link (E9)'];
  check('tok-rl b: every refused read is served the same status and the same bytes as a link that never existed (nonce and the token itself aside)',
    Object.entries(bodies).filter(([, b]) => b.status !== base.status || b.html !== base.html).map(([k]) => k), []);
  const { flagged, conclusive, res } = judge('tok-rl', 'a read refused by the token path’s rate limit, against a link that never existed', 'never a link (E9)', arms);
  if (!conclusive) inconclusive = true;
  check(`tok-rl: a refused read is not distinguishable from a link that never existed by response time, live link or not${conclusive ? ` (resolution ${res?.toFixed(2)}ms)` : ' — INCONCLUSIVE'}`,
    conclusive ? flagged : 'inconclusive', []);
  await clearRateLimits();
}

// ---------------------------------------------------------------------------
// req-t — request access, in one time and one answer for every token (D-77,
// D-80; brief D, 29 Sep). The handler used to answer a string that was never
// a link straight away, and a real one after three more queries and a send:
// the dead-link page's own form told a stranger whether the link had been a
// child's. It now resolves the token through lib/record-read and answers
// every path no sooner than the send floor (lib/send-dispatch).
//
// E10's method: the arms in the same rounds, in a fresh order each round,
// against a string that was never a link, after the row proves its own
// resolution. Five arms, so every path the handler has is in the race:
//   · never a link;
//   · a dead link, first request today — resolved and SENT to the guardian;
//   · a live link, first request today — resolved and SENT;
//   · a dead link already asked today — resolved and HELD (C7);
//   · a live link already asked today — resolved and HELD.
// "First request today" happens once per link, so the first two arms need a
// fresh pair every round: the parent replaces Deniz's link twice, untimed —
// the first new link is renewed away by the second (dead, never asked), and
// the second is live and never asked. The held arms reuse one link each,
// asked once in setup: dev-expired (dead) and dev-jordan (live).
// ---------------------------------------------------------------------------
if (runs('req-t')) {
  const parent = ids.people.alex, deniz = ids.children.deniz;
  const deadPage = (await get(`/p/${randomBytes(32).toString('base64url')}`)).html;
  const ask = forms(deadPage).find((f) => 'token' in f.fields);
  const replace = forms((await get(`/g/controls/${deniz.child_id}`, parent)).html).find((f) => f.submit === 'Replace');
  const fresh = async () => {
    const r = await post(`/g/controls/${deniz.child_id}`, parent, replace.fields);
    return /[?&]link=([^&#]+)/.exec(r.location)?.[1] ?? null;
  };
  const request = (tok, name = 'Req Timing') => post(`/p/${tok}`, null, { ...ask.fields, token: tok, name, role: 'Coach, Coburg City FC' });
  // Setup, proved rather than assumed: the held links are asked once, and a
  // fresh pair is one dead and one live.
  await clearRateLimits();
  const deadTitle = title(deadPage);
  const liveNow = async (tok) => title((await get(`/p/${tok}`)).html) !== deadTitle;
  await request('dev-expired');
  await request('dev-jordan');
  const a = ask && replace ? await fresh() : null, b = a ? await fresh() : null;
  check('req-t setup: the dead-link page carries the request form, the parent can replace Deniz’s link, and a replaced pair is one dead link and one live one',
    [Boolean(ask), Boolean(replace), Boolean(a && b), a ? await liveNow(a) : null, b ? await liveNow(b) : null, await liveNow('dev-jordan'), await liveNow('dev-expired')],
    [true, true, true, false, true, true, false]);
  await clearRateLimits();

  const arms = Object.fromEntries(['never a link', 'a dead link, sent', 'a live link, sent', 'a dead link, held', 'a live link, held'].map((k) => [k, []]));
  const shapes = {};
  let pair = [a, b];
  let rounds = 0;
  await sampleUntilResolved(async (keep) => {
    if (++rounds % 50 === 0) await clearRateLimits();
    const [dead, live] = pair;
    const TOK = { 'never a link': randomBytes(24).toString('base64url'), 'a dead link, sent': dead, 'a live link, sent': live,
      'a dead link, held': 'dev-expired', 'a live link, held': 'dev-jordan' };
    for (const k of shuffle(Object.keys(arms))) {
      const tok = TOK[k];
      const { ms, out } = await timed(() => request(tok));
      if (keep) arms[k].push(ms);
      if (keep && !shapes[k]) {
        shapes[k] = JSON.stringify([out.status, out.location.split(tok).join('<token>').replace(BASE, ''), out.body.split(tok).join('<token>'),
          out.headers.filter(([h]) => h !== 'date').map(([h, v]) => [h, v.split(tok).join('<token>').replace(/'nonce-[^']+'/g, "'nonce-<per-request>'")])]);
      }
    }
    // The next round's pair, untimed.
    pair = [await fresh(), null];
    pair[1] = await fresh();
  }, () => Object.values(arms), ALPHA / (Object.keys(arms).length - 1));
  // Which path each arm takes is proved, not assumed, the way the arms are
  // built: a fresh pair's requests email Deniz's parent (doc 15 §6) and a
  // second request on the same links does not. Named requesters, so the
  // outbox (its newest fifty) can be read for exactly these.
  const pd = await fresh();
  const pl2 = await fresh();
  await request(pd, 'Req Proof Dead');
  await request(pl2, 'Req Proof Live');
  await request(pd, 'Req Proof Again');
  await request(pl2, 'Req Proof Again');
  const box = (await get('/dev/outbox', ids.people.marina)).html;
  check('req-t setup: a first request on a dead link and on a live one is sent to the guardian, and a second on either is held',
    [Boolean(pd && pl2), box.includes('Req Proof Dead'), box.includes('Req Proof Live'), box.includes('Req Proof Again')], [true, true, true, false]);
  check('req-t b: every path answers with the same status, the same Location (the requester’s own token aside), the same body and the same headers',
    [...new Set(Object.values(shapes))].length, 1);
  const { flagged, conclusive, res } = judge('req-t', 'request access, against a string that was never a link', 'never a link', arms);
  if (!conclusive) inconclusive = true;
  check(`req-t: a request on a dead link or a live one, sent or held, is not distinguishable from one on a string that was never a link by response time${conclusive ? ` (resolution ${res?.toFixed(2)}ms)` : ' — INCONCLUSIVE'}`,
    conclusive ? flagged : 'inconclusive', []);
  await clearRateLimits();
}

// ---------------------------------------------------------------------------
// L40 — a send refused by the daily limit, in the time a real send takes.
// ---------------------------------------------------------------------------
if (runs('L40')) {
  const SEND_DAILY_CAP = 10; // lib/football.ts
  const jordan = ids.people.jordan;
  const adults = ids.adultPlayers.filter((a) => a.person_id !== jordan);
  const jordanRec = ids.adultPlayers.find((a) => a.person_id === jordan)?.record_id;
  const composeFields = new Map();
  const composeFor = async (who, rec) => {
    if (!composeFields.has(who)) {
      const f = forms((await get(`/send/${rec}`, who)).html).find((x) => /name="clubName"/.test(x.body));
      composeFields.set(who, f?.fields ?? null);
    }
    return composeFields.get(who);
  };
  const send = async (who, rec, address) => {
    const fields = await composeFor(who, rec);
    return timed(() => post(`/send/${rec}`, who, { ...fields, clubName: 'Coburg City FC', address }));
  };
  check(`L40 setup: an adult to hit the limit and ${adults.length} more to send for real`, [Boolean(jordanRec && await composeFor(jordan, jordanRec)), adults.length >= 10], [true, true]);

  // Jordan's ten real sends are the warm-up; every send after them is limited.
  for (let i = 0; i < SEND_DAILY_CAP; i++) await send(jordan, jordanRec, `l40-warm-${i}@example.com`);
  const perActor = Math.min(SEND_DAILY_CAP - 1, Math.ceil(N / adults.length));
  const n = Math.min(N, perActor * adults.length);
  const arms = { 'limited (at the daily cap)': [], 'a real send': [] };
  const shapes = new Set();
  for (let i = 0; i < n; i++) {
    const a = adults[i % adults.length];
    for (const arm of shuffle(Object.keys(arms))) {
      const r = arm === 'a real send'
        ? await send(a.person_id, a.record_id, `l40-real-${i}@example.com`)
        : await send(jordan, jordanRec, `l40-limited-${i}@example.com`);
      arms[arm].push(r.ms);
      // L38: the same status, the same body, the same headers bar the date.
      shapes.add(JSON.stringify([r.out.status, r.out.location.replace(/\/send\/[0-9a-f-]{36}/, '/send/<rec>'), r.out.body,
        r.out.headers.filter(([k]) => !/^(date|set-cookie)$/.test(k)).map(([k]) => k)]));
    }
  }
  // Which arm each send was in is proved, not assumed: the club's email for
  // the last real send is in the outbox and the last limited one is not.
  const box = (await get('/dev/outbox', ids.people.marina)).html;
  check('L40 setup: the real sends reached the outbox and the limited ones did not',
    [box.includes(`l40-real-${n - 1}@example.com`), box.includes(`l40-limited-${n - 1}@example.com`)], [true, false]);
  check('L40b: both arms answer with one shape — status, location, body and header names (L38)', shapes.size, 1);
  const { flagged, conclusive, res } = judge('L40', 'a send at the daily limit against a real send', 'limited (at the daily cap)', arms);
  if (!conclusive) inconclusive = true;
  check(`L40: a limited send is not distinguishable from a real one by response time${conclusive ? ` (resolution ${res?.toFixed(2)}ms)` : ' — INCONCLUSIVE'}`,
    conclusive ? flagged : 'inconclusive', []);
}

// ---------------------------------------------------------------------------
// J61 / M6 — a club with held registrations cannot learn one came and went.
//
// "Never had one" cannot be put back once a registration has come and gone,
// so the club cannot be measured in both states in the same rounds, and two
// blocks measured one after the other drift apart on a shared machine by as
// much as we are trying to see: the first version of this row found both of
// the club's pages 0.7ms slower in the second block with nothing changed but
// the time of day, and correcting by a control page overshot to 0.9ms faster.
//
// So the comparison is against a TWIN, in the same rounds: a second club
// awaiting verification (Westgate Rangers, claimed here through the product
// by the brand-new seat), whose same two pages are fetched in every round
// right beside the held club's. Each round gives the held club's time less the
// twin's, page for page; drift lands on both and cancels. Then one family
// registers with the held club and takes it off again — the twin is never
// touched — and the same comparison runs again. If the held club's pages now
// stand differently against the twin's, the club could tell.
// ---------------------------------------------------------------------------
if (runs('J61')) {
  const club = ids.people['m.'];           // Quarrymead United's administrator: held, unverified
  const twinAdmin = ids.people.robin;      // the brand-new seat, who claims Westgate here
  // An eighteen-year-old off the bulk register, not the house adult: the seed
  // already has Jordan on this club's register, and a second registration
  // folds into the first (one entry per club), so nothing would come or go.
  const family = ids.adultPlayers.find((a) => a.person_id !== ids.people.jordan);
  const VIEWS = ['/home', '/club/register'];
  const waiting = async () => Number(/(\d+) waiting/.exec((await get('/club/register', club)).html.replace(/<!-- -->/g, ''))?.[1] ?? NaN);

  // The twin, claimed the way any club is: ask for a code, read it where the
  // club's inbox would, enter it.
  const claimPage = forms((await get('/claim/westgate-rangers', twinAdmin)).html);
  const ask = claimPage.find((f) => f.fields.slug && !/name="code"/.test(f.body));
  if (ask) await post('/claim/westgate-rangers', twinAdmin, ask.fields);
  const code = /claim Westgate Rangers on Pitch[\s\S]*?your code is:\s*(\d{6})/.exec(((await get('/dev/outbox', ids.people.marina)).html).replace(/<[^>]+>/g, ' '))?.[1];
  const enter = forms((await get('/claim/westgate-rangers?sent=1', twinAdmin)).html).find((f) => /name="code"/.test(f.body));
  const claimed = enter && code ? await post('/claim/westgate-rangers', twinAdmin, { ...enter.fields, code }) : { location: '' };
  // A redirect is fast and says nothing: every page measured must render.
  const statuses = [];
  for (const v of VIEWS) statuses.push((await get(v, club)).status, (await get(v, twinAdmin)).status);
  check('J61 setup: a twin club awaiting verification, claimed through the product, and all four pages render',
    [/claimed=1/.test(claimed.location), statuses], [true, [200, 200, 200, 200]]);

  // One block: both clubs' two pages, in a fresh order every round; each
  // round records held-club minus twin, per page.
  const block = async (rounds) => {
    const diffs = Object.fromEntries(VIEWS.map((v) => [v, []]));
    const raw = Object.fromEntries(VIEWS.flatMap((v) => [[`held ${v}`, []], [`twin ${v}`, []]]));
    const bodies = {};
    // Each held page is fetched back to back with its twin (in a random order
    // within the pair), so the two share whatever the machine is doing at that
    // moment. Shuffling all four apart let a load spike land on one of a pair
    // and not the other: the differences swung by ±20ms on a busy afternoon
    // and the row could not resolve a millisecond.
    const round = async (keep) => {
      const t = {};
      for (const v of shuffle(VIEWS)) {
        for (const who of shuffle(['held', 'twin'])) {
          const { ms, out } = await timed(() => get(v, who === 'held' ? club : twinAdmin));
          t[`${who} ${v}`] = ms;
          if (keep && who === 'held' && !bodies[v]) bodies[v] = normalise(out.html);
        }
      }
      if (keep) for (const v of VIEWS) { diffs[v].push(t[`held ${v}`] - t[`twin ${v}`]); raw[`held ${v}`].push(t[`held ${v}`]); raw[`twin ${v}`].push(t[`twin ${v}`]); }
    };
    if (rounds === undefined) {
      rounds = await sampleUntilResolved(round, () => VIEWS.map((v) => diffs[v]), ALPHA / VIEWS.length, 2 * N);
    } else {
      // The second block runs at least as long as the first, and longer if
      // it is noisier — it is judged by its own resolution too.
      for (let i = 0; i < WARMUP; i++) await round(false);
      for (let i = 0; i < rounds; i++) await round(true);
      while (rounds < MAX_ROUNDS && VIEWS.some((v) => (resolution(diffs[v], ALPHA / VIEWS.length).res ?? Infinity) > TARGET_RESOLUTION_MS)) {
        for (let i = 0; i < STEP; i++) await round(true);
        rounds += STEP;
      }
    }
    return { diffs, raw, bodies, rounds };
  };

  const before = await waiting();
  const A = await block();
  // A family registers with the held club, and takes it off again.
  const regsBefore = new Set(forms((await get('/home', family.person_id)).html).map((f) => f.fields.registrationId).filter(Boolean));
  // The form is a client component; its page must be compiled before Next's
  // manifest names the action.
  await get(`/register-interest/${family.record_id}`, family.person_id);
  const interestId = actionId('app/register-interest/[recordId]/actions.ts', 'composeInterest');
  await post(`/register-interest/${family.record_id}`, family.person_id,
    { [`$ACTION_ID_${interestId}`]: '', recordId: family.record_id, clubId: ids.heldClub, positions: 'CM', note: '' });
  const during = await waiting();
  const takeOff = forms((await get('/home', family.person_id)).html).find((f) => f.fields.registrationId && !regsBefore.has(f.fields.registrationId));
  if (takeOff) await post('/home', family.person_id, takeOff.fields);
  const after = await waiting();
  check('J61 setup: the registration reached the held count, and taking it off took it away again',
    [Number.isFinite(before), during - before, after - before, Boolean(takeOff)], [true, 1, 0, true]);
  const B = await block(A.rounds);

  check('J61b: every page the club has reads the same bytes after a registration came and went (M6)',
    VIEWS.filter((v) => A.bodies[v] !== B.bodies[v]), []);
  for (const v of VIEWS) {
    console.log(`\nJ61 · ${v}, raw, for the record: held club ${describe(A.raw[`held ${v}`])} then ${describe(B.raw[`held ${v}`])}; twin ${describe(A.raw[`twin ${v}`])} then ${describe(B.raw[`twin ${v}`])}`);
  }
  const results = VIEWS.map((v) => judge('J61', `${v}: the held club less its twin, in the same round`, 'never had one',
    { 'never had one': A.diffs[v], 'had one, taken off': B.diffs[v] }, VIEWS.length));
  const flagged = results.flatMap((r, i) => r.flagged.map((f) => `${VIEWS[i]}: ${f}`));
  const conclusive = results.every((r) => r.conclusive) || flagged.length > 0;
  if (!conclusive) inconclusive = true;
  check(`J61: nor in the time they take${conclusive ? ` (resolution ${results.map((r) => r.res?.toFixed(2)).join('/')}ms, ${A.rounds} and ${B.rounds} rounds)` : ' — INCONCLUSIVE'}`,
    conclusive ? flagged : 'inconclusive', []);
}

// ---------------------------------------------------------------------------
// jr-undo — the §36/§37 undo says whether it worked, and the clock says
// nothing more (G-P1; John, 1 Oct: "the not-live path must do the same work
// … asserted the way E9 and J40 already are, by diffing two captured
// responses rather than by reading the handler"). Not a doc 14 row (L4).
//
//   load:  a used, a lapsed and an already-off undo link against one that
//          never existed — one panel, byte for byte and in time;
//   press: the same three, and a LIVE press that lands on Done, against a
//          press of one that never existed — the same statement, in time.
// Live and already-off tokens are spent by a press, so each press gets a
// fresh one from the dev-only minter (app/dev/undo), minted untimed.
// ---------------------------------------------------------------------------
if (runs('jr-undo')) {
  // A child's record (S-1, 2 Oct): an undo is live only while the person it
  // was issued to is that child's guardian, and the minter issues to one
  // (app/dev/undo). Deniz's, not Nate's: E10 above pauses Nate, and a paused
  // child's record takes no new link (fn_can_dispatch), so the minter is
  // refused. The timing suite is last and is followed by a reseed, so the
  // switch-offs its live presses write to Deniz's history go with it.
  const record = ids.children.deniz.record_id;
  const mint = async (kind, n) => {
    const r = await fetch(`${BASE}/dev/undo?record=${record}&kind=${kind}&n=${n}`, { method: 'POST' });
    if (!r.ok) throw new Error(`/dev/undo answered ${r.status} — is this the dev app?`);
    return (await r.json()).tokens;
  };
  const pools = { live: [], off: [] };
  const take = async (kind) => { if (pools[kind].length === 0) pools[kind] = await mint(kind, 200); return pools[kind].pop(); };
  const [used] = await mint('used', 1), [lapsed] = await mint('lapsed', 1);
  const never = () => randomBytes(24).toString('base64url');
  const askFields = forms((await get(`/undo/${await take('live')}`)).html).find((f) => 'token' in f.fields)?.fields;
  check('jr-undo setup: a live undo link asks, with the press’s own form', Boolean(askFields), true);

  // ---- load ----
  const LOAD = { 'never a link': never, used: () => used, lapsed: () => lapsed, 'link already off': null };
  const offForLoad = await take('off'); // opening does not spend it, so one serves every round
  LOAD['link already off'] = () => offForLoad;
  const loadArms = Object.fromEntries(Object.keys(LOAD).map((k) => [k, []]));
  const loadBodies = {};
  await sampleUntilResolved(async (keep) => {
    for (const k of shuffle(Object.keys(LOAD))) {
      const tok = LOAD[k]();
      const { ms, out } = await timed(async () => { const res = await fetch(`${BASE}/undo/${tok}`); return { status: res.status, html: await res.text() }; });
      if (keep) loadArms[k].push(ms);
      // Outside Next's flight payload, which numbers its chunks in whatever
      // order they resolve in development — the same page twice differs there.
      if (keep && !loadBodies[k]) loadBodies[k] = { status: out.status, html: normalise(out.html.replace(/<script[\s\S]*?<\/script>/g, ''), tok) };
    }
  }, () => Object.values(loadArms), ALPHA / (Object.keys(LOAD).length - 1));
  const lb = loadBodies['never a link'];
  check('jr-undo-t1b: opening a used, a lapsed or an already-off undo link is served the never-a-link panel, byte for byte (nonce, the token and Next’s payload aside)',
    Object.entries(loadBodies).filter(([, b]) => b.status !== lb.status || b.html !== lb.html).map(([k]) => k), []);
  {
    const { flagged, conclusive, res } = judge('jr-undo-t1', 'opening the undo link, per not-live state', 'never a link', loadArms);
    if (!conclusive) inconclusive = true;
    check(`jr-undo-t1: no not-live undo link is distinguishable from one that never existed by response time${conclusive ? ` (resolution ${res?.toFixed(2)}ms)` : ' — INCONCLUSIVE'}`,
      conclusive ? flagged : 'inconclusive', []);
  }

  // ---- press ----
  const press = (tok) => post(`/undo/${tok}`, null, { ...askFields, token: tok });
  const PRESS = { 'never a link': never, used: () => used, lapsed: () => lapsed, 'link already off': () => take('off'), 'live (lands on Done)': () => take('live') };
  const pressArms = Object.fromEntries(Object.keys(PRESS).map((k) => [k, []]));
  const shapes = {};
  await sampleUntilResolved(async (keep) => {
    for (const k of shuffle(Object.keys(PRESS))) {
      const tok = await PRESS[k]();
      const { ms, out } = await timed(() => press(tok));
      if (keep) pressArms[k].push(ms);
      if (keep && !shapes[k]) shapes[k] = JSON.stringify([out.status, out.location.replace(BASE, '').split(tok).join('<token>'),
        normalise(out.body, tok), out.headers.filter(([h]) => !/^(date|set-cookie)$/.test(h)).map(([h]) => h)]);
    }
  }, () => Object.values(pressArms), ALPHA / (Object.keys(PRESS).length - 1));
  const notLive = ['used', 'lapsed', 'link already off'].filter((k) => shapes[k] !== shapes['never a link']);
  const doneShape = JSON.parse(shapes['live (lands on Done)'] ?? '[]');
  check('jr-undo-t2b: a press on a used, lapsed or already-off link answers exactly as one on a link that never existed — back to the not-live panel — and only the live press goes to Done',
    [notLive, JSON.parse(shapes['never a link'] ?? '[]')[1], doneShape[1]], [[], '/undo/<token>', '/undo/done']);
  {
    // The parity that protects anyone (D-77) is among the NOT-live presses:
    // a spent, lapsed or already-off link must not be told from one that
    // never existed. The live press is different by design — it lands on
    // Done (jr-undo-t2b pins that), so its time says nothing its answer does
    // not; since John's batch it also writes the family's consent event
    // (1 Oct), which costs a fraction of a millisecond. Leo, 2 Oct: the live
    // arm is measured and printed, not judged.
    const { 'live (lands on Done)': liveArm, ...notLiveArms } = pressArms;
    const { flagged, conclusive, res } = judge('jr-undo-t2', 'pressing "Switch it off", per not-live state', 'never a link', notLiveArms);
    if (!conclusive) inconclusive = true;
    check(`jr-undo-t2: no press on a spent link, a lapsed one or one already off is distinguishable from a press on a link that never existed by response time${conclusive ? ` (resolution ${res?.toFixed(2)}ms)` : ' — INCONCLUSIVE'}`,
      conclusive ? flagged : 'inconclusive', []);
    const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
    console.log(`info jr-undo-t2 live press (lands on Done, by design): median ${median(liveArm).toFixed(2)}ms vs never-a-link ${median(pressArms['never a link']).toFixed(2)}ms`);
  }
}

console.log(`\n${pass} passed, ${failures.length} failed${failures.length ? ' - ' + failures.join('; ') : ' - ALL GREEN'}`);
if (ROWS.length) console.log(`PARTIAL RUN (${ROWS.join(', ')} only) — a proof, not the gate. The gate is every row, from a fresh seed.`);
console.log('NOTE: this mutated the dev database. Restart scripts/dev-db.mts for a clean one.');
// An inconclusive row has already failed its check above; the flag only says
// which kind of failure it was, for whoever reads the exit code.
process.exit(inconclusive ? 2 : failures.length ? 1 : 0);
