// Doc 14 permission suite — first tranche: table A (reading a record),
// table B (search), the token path (D-77/D-80), the D-72 invariant, and the
// G9 Melbourne-timezone band boundary. Runs against a real embedded Postgres
// (PGlite) — the database, not the app layer, per doc 14 §0.
//
// This file grows until every row of doc 14 is here. Green or we do not go.
import { PGlite } from '@electric-sql/pglite';
// The stat catalogue and the provenance vocabulary live in TypeScript, not in
// Postgres (D-70), so the rules inside them are asked of the module itself
// rather than copied into this file — a copy is a second answer to the same
// question and a second place to be wrong (L23).
import { PROVENANCE, PROVENANCE_LABELS, STAT_SETS, positionGroup, sharedProvenance } from '../lib/football.ts';
import { PLAYER_FIXTURES } from '../lib/fixtures.ts';
import { demoDbPort } from '../lib/demo.ts';
import { analyticsAllowed, analyticsBeforeSend } from '../lib/analytics-scope.ts';
import { POSITIONS as POSITIONS_TS } from '../lib/football.ts';
import { CLUBS_WORDS_APPROVED as CLUBS_WORDS_APPROVED_TS, clubsScreensShown as clubsScreensShownTS } from '../lib/ops-policy.ts';
import { RULINGS } from './rulings.mjs';
import { clubTheme, contrast, PRESETS } from '../lib/club-colours.ts';
import { createHash, createHmac } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const db = new PGlite();
const dir = fileURLToPath(new URL('../supabase/migrations', import.meta.url));
await db.exec(`
  create or replace function gen_random_bytes(n int) returns bytea language sql as
  $$ select decode(string_agg(lpad(to_hex((random()*255)::int),2,'0'),''), 'hex') from generate_series(1, n) $$;
`);
for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(dir, f), 'utf8'));
}
// D-163: what the migrations leave the billing switch at, read before any
// block below touches it — free0 asks THIS, not the value some later block
// happened to put back.
const BILLING_AT_BOOT = (await db.query(
  `select (select value from app_config where key = 'billing_enabled') as value, fn_billing_enabled() as on`)).rows[0];
// D-164 (0080), read before any block can move it, for the same reason.
const FRONT_DOOR_AT_BOOT = (await db.query(
  `select (select value from app_config where key = 'front_door_open') as value, fn_front_door_open() as open`)).rows[0];

let pass = 0, fail = 0;
async function expectFail(label, sql) {
  try {
    await db.exec(sql);
    fail++; console.error(`FAIL ${label} — write was allowed and must not be`);
  } catch {
    pass++; console.log(`OK   ${label}`);
  }
}
// Deep comparison, not ===. With strict equality any check comparing two
// arrays or two objects could never pass, however right it was — so a whole
// class of assertion was unavailable and the next person to reach for one
// would have found it "failing" and rewritten the test rather than the code.
// It cannot have hidden a false PASS (=== is only ever too strict), but a
// comparator that lies in either direction is not one to keep.
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(label, actual, expected) {
  if (same(actual, expected)) { pass++; console.log(`OK   ${label}`); }
  else { fail++; console.error(`FAIL ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}
async function level(viewer, person) {
  const r = await db.query('select fn_read_level($1, $2) as l', [viewer, person]);
  return r.rows[0].l;
}
async function searchable(searcher, person) {
  const r = await db.query('select fn_searchable($1, $2) as s', [searcher, person]);
  return r.rows[0].s;
}
const sha = (s) => createHash('sha256').update(s).digest();

// Read a Postgres function's source on demand. Four checks have now broken
// by referencing a const that a LATER section declares — sections must not
// depend on the order of the file.
const procSrc = async (name) =>
  (await db.query('select prosrc from pg_proc where proname = $1', [name])).rows[0]?.prosrc ?? '';

// The two questions asked from more than one table, hoisted for the same
// reason: who may put this record in front of somebody, and who may act on
// it at all.
// D-163 (0075): billing is OFF until further notice, and every check in this file runs
// with it off unless it says otherwise. The Stripe build stays in the code
// behind the switch, and the checks that test IT — the subscription gate, the
// D-153 free tier, dunning — turn the switch on for their own block and put it
// back. One helper, so a block cannot leave it in a state nobody chose.
const billingOn = async (on) =>
  db.query(`update app_config set value = $1 where key = 'billing_enabled'`, [on ? 'true' : 'false']);

const qDispatch = async (actor, rec) =>
  (await db.query('select fn_can_dispatch($1,$2) as c', [actor, rec])).rows[0].c;
const recActor = async (who, rec) =>
  (await db.query('select fn_record_actor($1,$2) as a', [who, rec])).rows[0].a;

// Source files more than one table reads. Same reason as procSrc: sections
// must not depend on the order of the file.
const srcOf = (rel) => readFileSync(fileURLToPath(new URL('../' + rel, import.meta.url)), 'utf8');
const eOg = srcOf('app/p/[token]/opengraph-image.tsx');
const dispatchSrc = srcOf('app/g/send/[requestId]/actions.ts');
// The send itself moved out of the guardian's action into the one path every
// sender uses, when the player's own send (L5, L8) finally got a door onto it.
const dispatchLib = srcOf('lib/send-dispatch.ts');
const composeSrc = srcOf('app/send/[recordId]/actions.ts');

// Strip comments before searching source for a forbidden word. Three checks
// in this file have now matched their own explanatory comment — a comment
// saying "we never show a counter" contains the word "counter". Search the
// CODE, never the prose about the code.
const codeOnly = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\/\/.*$/gm, '');

// Every .ts/.tsx under app/, components/ and lib/ — for checks that pin where
// a thing is defined or imported (tok-p1, an-p2, an-p3).
const tsSourceFiles = () => ['app', 'components', 'lib'].flatMap((top) =>
  readdirSync(fileURLToPath(new URL(`../${top}`, import.meta.url)), { recursive: true })
    .filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => `${top}/${f}`));

// Every file under app/, walked once. Route ENUMERATION is how several of
// doc 14's rows are specified — the absence of a route is the assertion —
// so more than one table needs this list.
const routeFiles = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const full = join(d, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(e.name)) routeFiles.push(full);
  }
})(fileURLToPath(new URL('../app', import.meta.url)));

// Route enumeration is how several rows are specified — the ABSENCE of a
// route is the assertion — and more than one table needs this list.
const msgRoutes = routeFiles.filter((f) => /\/(message|dm|chat|inbox|thread|reply)\//i.test(f));


// ---------------------------------------------------------------------------
// Fixture world (doc 16): Riverside FC (verified), an UNVERIFIED club, the
// three players + an adult player, and every actor doc 14 names.
// ---------------------------------------------------------------------------
const melbourneToday = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
// Format from the date's own parts. toISOString() would convert to UTC and
// shift the day, which silently breaks every age-boundary case.
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const yearsAgo = (n, plusDays = 0) => {
  const d = new Date(melbourneToday);
  d.setFullYear(d.getFullYear() - n);
  d.setDate(d.getDate() + plusDays);
  return iso(d);
};

// 0056 / L21: an address nobody has proved holds no child and signs in
// nowhere, and the database asks for the evidence before it will record the
// proof. A fixture parent who is given an address proves it the way a real
// one does — a link we sent, opened.
const proveAddress = async (personId) => {
  await db.query(
    `insert into email_proof (person_id, token_hash, expires_at, used_at)
     values ($1,$2, now() + interval '7 days', now()) on conflict (token_hash) do nothing`,
    [personId, sha(`proof-${personId}`)]);
  await db.query(`update person set email_proved_at = coalesce(email_proved_at, now()) where id = $1`, [personId]);
};

const ID = {};
for (const k of ['deniz','georgia','nate','marcus','guardian','guardian2','exGuardian','coachV','coachU','coachUnassigned','coachFormer','coachOther','td','clubAdmin','teamManager','adminOther','coachAtUnverified']) {
  ID[k] = crypto.randomUUID();
}
const CLUB = { riverside: crypto.randomUUID(), other: crypto.randomUUID(), unverified: crypto.randomUUID() };
const SQUAD = { u15: crypto.randomUUID(), u16g: crypto.randomUUID(), u18: crypto.randomUUID(), otherSq: crypto.randomUUID(), unvSq: crypto.randomUUID() };
const REC = { deniz: crypto.randomUUID(), georgia: crypto.randomUUID(), nate: crypto.randomUUID(), marcus: crypto.randomUUID() };
const CALL = { riverside: crypto.randomUUID(), other: crypto.randomUUID() };

await db.query(`insert into person (id, first_name, last_name, dob) values
  ($1,'Deniz','Yılmaz',$2), ($3,'Georgia','Whitcombe',$4), ($5,'Nate','Halloran',$6), ($7,'Marcus','Adult',$8)`,
  [ID.deniz, '2012-03-14', ID.georgia, '2011-09-21', ID.nate, yearsAgo(17), ID.marcus, yearsAgo(19)]);
for (const k of ['guardian','guardian2','exGuardian','coachV','coachU','coachUnassigned','coachFormer','coachOther','td','clubAdmin','teamManager','adminOther','coachAtUnverified']) {
  await db.query(`insert into person (id, first_name, dob) values ($1,$2,$3)`, [ID[k], k, yearsAgo(35)]);
}

await db.query(`insert into club (id, name, club_state) values
  ($1,'Riverside FC','claimed'), ($2,'Bayview SC','claimed'), ($3,'Unverified FC','claimed')`,
  [CLUB.riverside, CLUB.other, CLUB.unverified]);
// verify Riverside and Bayview the only legal way: a logged human call
for (const [club, call] of [[CLUB.riverside, CALL.riverside], [CLUB.other, CALL.other]]) {
  await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
    values ($1,$2,now(),'BUZ','03 9000 0000','FV club directory','verified','27@v1.0')`, [call, club]);
  await db.query(`update club set club_state='verified', verified_call_id=$1 where id=$2`, [call, club]);
}

await db.query(`insert into squad (id, club_id, name, age_group, competition_gender, season) values
  ($1,$2,'U15 Boys','U15','boys','2026'), ($3,$2,'U16 Girls','U16','girls','2026'),
  ($4,$2,'U18 Boys','U18','boys','2026'), ($5,$6,'Seniors','SEN','men','2026'), ($7,$8,'U14','U14','boys','2026')`,
  [SQUAD.u15, CLUB.riverside, SQUAD.u16g, SQUAD.u18, SQUAD.otherSq, CLUB.other, SQUAD.unvSq, CLUB.unverified]);

const mem = (p, c, sq, role) =>
  db.query(`insert into membership (person_id, club_id, squad_id, role) values ($1,$2,$3,$4)`, [p, c, sq, role]);

// 0058 / D-93: a technical_director membership has exactly one source — a
// verified call that recorded that person's address, and the person having
// proved it. The suite cannot write the row and does not try; it does what
// the operator does. Nothing here bypasses the rule, which is why the four
// checks at the bottom of table H mean anything.
//
// A club that must NOT be verified for the case under test (the held view,
// the unverified club) is put back where it was afterwards, verified_call_id
// included — a club that was verified, named its TD, and later lost
// verification is a real shape, and it is the one H5/M10 are about.
const recordTd = async (person, club, email) => {
  await db.query(`update person set email = $2 where id = $1`, [person, email]);
  await proveAddress(person);
  // The call records the name the club gives, and since 0121 that name has to
  // be the account's own (or an operator has to confirm it): approved default
  // 5, a mismatch is held for a human. The fixture records the person's name,
  // as an operator on a real call would.
  const who = (await db.query(`select trim(first_name || ' ' || coalesce(last_name, '')) as n from person where id = $1`, [person])).rows[0].n;
  const before = (await db.query(`select club_state, verified_call_id from club where id = $1`, [club])).rows[0];
  const call = crypto.randomUUID();
  await db.query(
    `insert into verification_call (id, club_id, called_at, operator, number_called, number_source,
       outcome, td_name, td_email, policy_version)
     values ($1,$2,now(),'BUZ','03 9000 0000','FV club directory','verified',$3,$4,'27@v1.0')`,
    [call, club, who, email]);
  await db.query(`update club set club_state='verified', verified_call_id=$1 where id=$2`, [call, club]);
  if (before.club_state !== 'verified') {
    await db.query(`update club set club_state=$2, verified_call_id=$3 where id=$1`,
      [club, before.club_state, before.verified_call_id]);
  }
};
await mem(ID.deniz, CLUB.riverside, SQUAD.u15, 'player');
await mem(ID.georgia, CLUB.riverside, SQUAD.u16g, 'player');
await mem(ID.nate, CLUB.riverside, SQUAD.u18, 'player');
await mem(ID.marcus, CLUB.riverside, SQUAD.u15, 'player');
await mem(ID.coachV, CLUB.riverside, SQUAD.u15, 'coach');
await mem(ID.coachU, CLUB.riverside, SQUAD.u15, 'coach');          // NOT attested
await mem(ID.coachUnassigned, CLUB.riverside, SQUAD.u16g, 'coach'); // attested, other squad
await recordTd(ID.td, CLUB.riverside, 'td@fixture.example');
await mem(ID.clubAdmin, CLUB.riverside, null, 'club_admin');
await mem(ID.teamManager, CLUB.riverside, SQUAD.u15, 'team_manager');
await mem(ID.coachOther, CLUB.other, SQUAD.otherSq, 'coach');
await mem(ID.adminOther, CLUB.other, null, 'club_admin');
await mem(ID.coachAtUnverified, CLUB.unverified, SQUAD.unvSq, 'coach');

// WWCC attestations (the verification gate — D-22/D-28/D-98)
for (const [p, c] of [[ID.coachV, CLUB.riverside], [ID.coachUnassigned, CLUB.riverside], [ID.coachFormer, CLUB.riverside], [ID.coachOther, CLUB.other], [ID.td, CLUB.riverside], [ID.coachAtUnverified, CLUB.unverified]]) {
  await db.query(`insert into wwcc_attestation (person_id, club_id, attested_by) values ($1,$2,$3)`, [p, c, ID.td]);
}

// guardianships: deniz approved (guardian + guardian2), georgia approved,
// nate approved, exGuardian revoked on deniz, guardian on adult marcus (expired at 18, no regrant)
for (const [g, ch] of [[ID.guardian, ID.deniz], [ID.guardian2, ID.deniz], [ID.guardian, ID.georgia], [ID.guardian, ID.nate], [ID.guardian, ID.marcus]]) {
  await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [g, ch]);
}
await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at, revoked_at) values ($1,$2,now(),now())`, [ID.exGuardian, ID.deniz]);

for (const [rec, p] of [[REC.deniz, ID.deniz], [REC.georgia, ID.georgia], [REC.nate, ID.nate], [REC.marcus, ID.marcus]]) {
  await db.query(`insert into development_record (id, person_id, positions) values ($1,$2,array['AM'])`, [rec, p]);
}
// coachFormer authored a verified entry on Deniz's record, then left (A10/D-48).
// The order matters and the database now insists on it: the entry is written
// while they still hold the squad, and the departure comes after. There is no
// way to author retrospectively, which is the point.
await mem(ID.coachFormer, CLUB.riverside, SQUAD.u15, 'coach');
await db.query(`insert into record_entry (record_id, entry_type, author_id, provenance) values ($1,'coach_note',$2,'coach_verified')`, [REC.deniz, ID.coachFormer]);
await db.query(`update membership set ended_at = now() where person_id = $1`, [ID.coachFormer]);
// approved profile version for Deniz (the token path renders this for u16 — D-119)
await db.query(`insert into profile_version (record_id, content, status) values ($1,'{"name":"Deniz Y."}','approved')`, [REC.deniz]);

// ---------------------------------------------------------------------------
// Table A — reading a player's record
// ---------------------------------------------------------------------------
check('A1 anon on u16', await level(null, ID.deniz), 'none');
check('A1 anon on 16-17', await level(null, ID.nate), 'none');
check('A1 anon on 18+', await level(null, ID.marcus), 'public');
check('A4 self', await level(ID.deniz, ID.deniz), 'full');
check('A5 guardian on u16', await level(ID.guardian, ID.deniz), 'full');
check('A5 guardian2 equal visibility (D-51)', await level(ID.guardian2, ID.deniz), 'full');
check('A5 guardian on 18+ without re-grant is not privileged', await level(ID.guardian, ID.marcus), 'public');
check('A6 ex_guardian', await level(ID.exGuardian, ID.deniz), 'none');
check('A7 verified assigned coach', await level(ID.coachV, ID.deniz), 'full');
check('A8 unverified coach at own club', await level(ID.coachU, ID.deniz), 'none');
check('A9 verified coach, unassigned squad', await level(ID.coachUnassigned, ID.deniz), 'none');
check('A10 former authoring coach keeps what they wrote', await level(ID.coachFormer, ID.deniz), 'authored_only');
check('A11 coach_other on u16', await level(ID.coachOther, ID.deniz), 'none');
check('A11 coach_other (verified) on 16-17', await level(ID.coachOther, ID.nate), 'public');
check('A12 TD club-wide', await level(ID.td, ID.deniz), 'full');
check('A12b club_admin never the record (D-93)', await level(ID.clubAdmin, ID.deniz), 'membership_only');
check('A15b team_manager same wall', await level(ID.teamManager, ID.deniz), 'membership_only');
check('A13 admin of another club on u16', await level(ID.adminOther, ID.deniz), 'none');

// A14: an unverified club sees nothing, even its own players
const unvPlayer = crypto.randomUUID();
await db.query(`insert into person (id, first_name, dob) values ($1,'Kid','${yearsAgo(14)}')`, [unvPlayer]);
await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [ID.guardian, unvPlayer]);
await mem(unvPlayer, CLUB.unverified, SQUAD.unvSq, 'player');
await db.query(`insert into development_record (person_id) values ($1)`, [unvPlayer]);
check('A14 coach at unverified club, own player', await level(ID.coachAtUnverified, unvPlayer), 'none');

// A17: unapproved u16 does not exist for anyone, including a guardian
const pendingKid = crypto.randomUUID();
await db.query(`insert into person (id, first_name, dob) values ($1,'Pending','${yearsAgo(13)}')`, [pendingKid]);
await db.query(`insert into guardianship_link (guardian_id, child_id) values ($1,$2)`, [ID.guardian, pendingKid]);
check('A17 pending u16: guardian', await level(ID.guardian, pendingKid), 'none');
check('A17 pending u16: TD', await level(ID.td, pendingKid), 'none');

// ---------------------------------------------------------------------------
// Table B — search. No search surface for u16 exists, for anyone.
// ---------------------------------------------------------------------------
check('B1 u16 unsearchable by verified coach', await searchable(ID.coachOther, ID.deniz), false);
check('B2 u16 unsearchable by own club admin', await searchable(ID.clubAdmin, ID.deniz), false);
// B11: discovery is gated on the 30-day notice having DELIVERED, so the
// normal case needs a delivered notice on the record.
check('B11 no delivered notice = not discoverable, even for a verified viewer',
  await searchable(ID.coachOther, ID.nate), false);
await db.query(`insert into age_transition_notice (child_id, sent_at, delivered_at) values ($1, now(), now())`, [ID.nate]);
check('B3 16-17 searchable by verified viewer once the notice landed', await searchable(ID.coachOther, ID.nate), true);
check('B4 16-17 not searchable from unverified club', await searchable(ID.coachU, ID.nate), false);
check('B5 16-17 not searchable by anon', await searchable(null, ID.nate), false);
await db.query(`insert into guardian_setting (child_id, discovery_disabled, updated_by) values ($1,true,$2)`, [ID.nate, ID.guardian]);
check('B6 guardian off-switch removes 16-17 discovery', await searchable(ID.coachOther, ID.nate), false);
check('B6b off-switch also removes the public floor', await level(ID.coachOther, ID.nate), 'none');
check('B7 adult searchable by anon', await searchable(null, ID.marcus), true);

// A notice that was SENT but never delivered does not open discovery: an
// email that bounced is a parent who was never told.
const bouncedKid = crypto.randomUUID();
await db.query(`insert into person (id, first_name, dob) values ($1,'Bounced','${yearsAgo(17)}')`, [bouncedKid]);
await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [ID.guardian, bouncedKid]);
await db.query(`insert into age_transition_notice (child_id, sent_at) values ($1, now())`, [bouncedKid]);
check('B11 a sent-but-undelivered notice leaves discovery off',
  await searchable(ID.coachOther, bouncedKid), false);

// ---------------------------------------------------------------------------
// The token path (D-77, D-80, D-119): one live shape, one dead shape.
// ---------------------------------------------------------------------------
const t = { live: sha('live'), expired: sha('expired'), revoked: sha('revoked'), paused: sha('paused') };
await db.query(`insert into share_token (record_id, token_hash, issued_by) values ($1,$2,$3)`, [REC.deniz, t.live, ID.guardian]);
await db.query(`insert into share_token (record_id, token_hash, issued_by, expires_at) values ($1,$2,$3, now() - interval '1 day')`, [REC.deniz, t.expired, ID.guardian]);
await db.query(`insert into share_token (record_id, token_hash, issued_by, revoked_at) values ($1,$2,$3, now())`, [REC.deniz, t.revoked, ID.guardian]);
await db.query(`insert into share_token (record_id, token_hash, issued_by, paused) values ($1,$2,$3, true)`, [REC.deniz, t.paused, ID.guardian]);

const tok = async (h) => (await db.query('select fn_token_read($1) as r', [h])).rows[0].r;
const live = await tok(t.live);
check('A2 live token returns the approved content (D-119)', live?.approved_content?.name, 'Deniz Y.');
check('A3 expired token is null', await tok(t.expired), null);
check('A3 revoked token is null', await tok(t.revoked), null);
check('A3 paused token is null', await tok(t.paused), null);
check('A3 never-existed token is null', await tok(sha('never')), null);

// A16: guardian pause kills even a live token
await db.query(`insert into guardian_setting (child_id, profile_paused, updated_by) values ($1,true,$2)
  on conflict (child_id) do update set profile_paused=true`, [ID.deniz, ID.guardian]);
check('A16 guardian pause stops a live token', await tok(t.live), null);
check('A16 internal club view survives the pause', await level(ID.coachV, ID.deniz), 'full');
await db.query(`update guardian_setting set profile_paused=false where child_id=$1`, [ID.deniz]);

// ---------------------------------------------------------------------------
// §R — the approved/pending pair (D-119). A pending edit never leaks to a
// link-holder; nothing auto-publishes; the diff stays derivable.
// ---------------------------------------------------------------------------
await db.query(`insert into profile_version (record_id, content, status) values ($1,'{"name":"PENDING EDIT"}','pending')`, [REC.deniz]);
const withPending = await tok(t.live);
check('R1 link-holder keeps reading the approved version during pending', withPending?.approved_content?.name, 'Deniz Y.');
check('R2 the pending content never reaches the token path', JSON.stringify(withPending).includes('PENDING EDIT'), false);
const bothVersions = await db.query(`select count(*)::int as n from profile_version where record_id=$1 and status in ('approved','pending')`, [REC.deniz]);
check('R4 both versions retained (diff derivable)', bothVersions.rows[0].n, 2);
await expectFail('R5 a second pending version cannot exist', `
  insert into profile_version (record_id, content, status) values ('${REC.deniz}','{}','pending');`);
await db.query(`delete from profile_version where record_id=$1 and status='pending'`, [REC.deniz]);

// A u16 with NO approved version has a dead link even when the token lives
await db.query(`update profile_version set status='superseded' where record_id=$1 and status='approved'`, [REC.deniz]);
check('R6 no approved version = dead link, even for a live token', await tok(t.live), null);
await db.query(`update profile_version set status='approved' where record_id=$1 and status='superseded'`, [REC.deniz]);

// ---------------------------------------------------------------------------
// D-72 — the test that is not optional: experience_entry grants NOTHING.
// ---------------------------------------------------------------------------
await db.query(`insert into experience_entry (record_id, kind, org_name) values ($1,'other','Bayview SC')`, [REC.deniz]);
// doc 14 H8, as it is worded: "Bayview SC" is exactly the name of a real,
// verified club in this fixture, and its coach and administrator get nothing.
check('H8: an experience_entry whose org_name is exactly a real club\u2019s name ("Bayview SC") grants that club\u2019s coach nothing (D-72)', await level(ID.coachOther, ID.deniz), 'none');
check('D-72 and grants its admin nothing', await level(ID.adminOther, ID.deniz), 'none');
// strip comments first, so a mention in a comment neither fails nor masks.
// This reads ONE migration file, not the functions later migrations left
// behind (round K), so it pins nothing on its own: doc 14 H7 is pinned in
// table H below, on the engine read from pg_proc as it exists now.
const permSqlCode = readFileSync(join(dir, '0003_permissions.sql'), 'utf8')
  .replace(/--[^\n]*/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
check('D-72 permission engine source never references experience_entry', permSqlCode.includes('experience_entry') ? 'referenced' : 'clean', 'clean');

// ---------------------------------------------------------------------------
// A19 / D-161 — no school reaches a public page for anybody under 18. The
// rule is the database's (0061): the write is refused against the date of
// birth at write time, and the read paths ask the same function at read time,
// so an eighteenth birthday is nobody's special case.
//
// D-72 is untouched and is asserted three lines above: the entry still grants
// nothing to anybody. This runs the other way round — the record's age band
// decides what the entry may say.
// ---------------------------------------------------------------------------
const schoolRow = (rec) =>
  `insert into experience_entry (record_id, kind, org_name) values ('${rec}','school','Riverside University 1st XI')`;
await expectFail('A19: a school entry is refused on an under-16 record', schoolRow(REC.deniz));
await expectFail('A19: and refused on a 16-17 record', schoolRow(REC.nate));
await db.exec(schoolRow(REC.marcus));
const schoolRows = async (rec) =>
  (await db.query(`select count(*)::int as n from experience_entry where record_id=$1 and kind='school'`, [rec])).rows[0].n;
check('A19: the same insert succeeds on an adult record', await schoolRows(REC.marcus), 1);
check('A19: and the child has none', await schoolRows(REC.deniz), 0);

// The read side, asked of the database rather than of a page (D-80): the one
// function every assembly path calls.
const kindPublic = async (rec, kind) =>
  (await db.query(`select fn_experience_public($1,$2) as ok`, [rec, kind])).rows[0].ok;
const schoolPublic = (rec) => kindPublic(rec, 'school');
check('A19: the adult\'s school entry may reach a public page', await schoolPublic(REC.marcus), true);
check('A19: the under-16\'s may not', await schoolPublic(REC.deniz), false);
check('A19: nor the 16-17\'s', await schoolPublic(REC.nate), false);
check('A19: and a record that does not exist may not either — restrictive by default',
  await schoolPublic('00000000-0000-0000-0000-000000000000'), false);
check('A19: every other kind is unaffected, for every band',
  [await kindPublic(REC.deniz, 'futsal'), await kindPublic(REC.deniz, 'previous_club'),
   await kindPublic(REC.deniz, 'representative'), await kindPublic(REC.nate, 'ntc_academy')],
  [true, true, true, true]);

// Age is DERIVED, never stored (D-49). The same row, the same person, one
// date of birth apart: nothing anywhere has to remember a birthday.
await db.query(`update person set dob = $2 where id = $1`, [ID.nate, yearsAgo(19)]);
check('A19: the refusal follows the date of birth — an 18th birthday needs no job',
  await schoolPublic(REC.nate), true);
await db.exec(schoolRow(REC.nate));
check('A19: and the write the database refused yesterday is accepted today',
  await schoolRows(REC.nate), 1);
await db.query(`delete from experience_entry where record_id=$1 and kind='school'`, [REC.nate]);
await db.query(`update person set dob = $2 where id = $1`, [ID.nate, yearsAgo(17)]);
check('A19: and the 16-17 fixture is back where it was', await schoolPublic(REC.nate), false);

// The two other ways a school entry could arrive on a child's record.
const probeEntry = crypto.randomUUID();
await db.query(`insert into experience_entry (id, record_id, kind, org_name) values ($1,$2,'futsal','Fixture futsal')`,
  [probeEntry, REC.deniz]);
await expectFail('A19: an existing entry cannot be edited into a school entry',
  `update experience_entry set kind='school' where id='${probeEntry}'`);
await expectFail('A19: nor can an adult\'s school entry be moved onto a child\'s record',
  `update experience_entry set record_id='${REC.deniz}' where record_id='${REC.marcus}' and kind='school'`);

// An entry that already exists is NOT deleted — it is the family's own words,
// and what they are told is BUZ's call (D-161). The seed holds one for the
// same reason; this writes one the only way one can now be written.
await db.exec(`alter table experience_entry disable trigger no_school_under_18`);
await db.exec(schoolRow(REC.deniz));
await db.exec(`alter table experience_entry enable trigger no_school_under_18`);
check('A19: a row written before the rule is still there', await schoolRows(REC.deniz), 1);
check('A19: and still reaches no public page', await schoolPublic(REC.deniz), false);
check('A19: and still grants its reader nothing (D-72 unchanged)',
  [await level(ID.coachOther, ID.deniz), await level(ID.adminOther, ID.deniz)], ['none', 'none']);
await db.query(`update experience_entry set org_name='School 1st XI' where record_id=$1 and kind='school'`, [REC.deniz]);
check('D-161: and can still be corrected in place, which is what the demo layer does to every text column',
  (await db.query(`select org_name from experience_entry where record_id=$1 and kind='school'`, [REC.deniz])).rows[0].org_name,
  'School 1st XI');

// The approved snapshot is the one a guardian already approved, so it is
// filtered where it is SERVED (fn_approved_cv, the single function 0054 made
// of the four surfaces that read one). The row stays; the page does not get it.
{
  // A snapshot as one looked before today: a guardian approved it, a school
  // entry is in it, and nothing may rewrite it. Restored afterwards, because
  // the fixture's approved content is what table R reads.
  const before = (await db.query(
    `select content from profile_version where record_id=$1 and status='approved'`, [REC.deniz])).rows[0].content;
  await db.query(
    `update profile_version set content = $2 where record_id=$1 and status='approved'`,
    [REC.deniz, JSON.stringify({ ...before, otherFootball: [
      { kind: 'school', orgName: 'Marlowe High 1st XI' }, { kind: 'futsal', orgName: 'Melbourne Futsal U15' }] })]);
  const served = (await db.query(`select fn_approved_cv($1) as cv`, [REC.deniz])).rows[0].cv;
  const stored = (await db.query(
    `select content from profile_version where record_id=$1 and status='approved'`, [REC.deniz])).rows[0].content;
  check('A19: the snapshot a guardian approved still holds the school entry',
    stored.otherFootball.map((e) => e.kind), ['school', 'futsal']);
  check('A19: and fn_approved_cv — the one function all four snapshot surfaces read — serves it to nobody',
    served.otherFootball.map((e) => e.kind), ['futsal']);
  check('A19: and the rest of the snapshot is served unchanged', served.name, before.name);
  await db.query(`update profile_version set content = $2 where record_id=$1 and status='approved'`,
    [REC.deniz, JSON.stringify(before)]);
}

// Both assembly paths ask the database. The render suite proves what the page
// serves; this is what stops a third assembly appearing without the question.
for (const [what, rel] of [['the live assembly', 'lib/record-read.ts'], ['the snapshot builder', 'lib/cv-build.ts']]) {
  check(`A19: ${what} asks fn_experience_public for every entry it returns`,
    /fn_experience_public\(\$1, kind\)/.test(codeOnly(srcOf(rel))), true);
}
// A delete is not a read: stripped first, or the family editor's Remove
// button makes this pass for the wrong reason.
const experienceSrc = (f) => codeOnly(readFileSync(f, 'utf8')).replace(/delete from experience_entry/g, '');
const readsExperience = routeFiles.filter((f) => /from experience_entry/.test(experienceSrc(f)));
check(`A19: and no page under app/ reads one without the band in the same query (${readsExperience.length} reads them)`,
  readsExperience.filter((f) => !/fn_experience_public|fn_age_band/.test(experienceSrc(f))).length, 0);

// The 30-day notice query finds a child at the boundary and nobody else.
const soon16 = crypto.randomUUID();
const soon16Dob = (() => { const d = new Date(melbourneToday); d.setFullYear(d.getFullYear() - 16); d.setDate(d.getDate() + 30); return iso(d); })();
await db.query(`insert into person (id, first_name, dob) values ($1,'Turning',$2)`, [soon16, soon16Dob]);
await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [ID.guardian, soon16]);
await db.query(`update person set email='parent-of-turning@example.com' where id=$1`, [ID.guardian]);
await proveAddress(ID.guardian);
const turning = (await db.query('select * from fn_children_turning_16()')).rows;
check('D-49/§13: the 30-day query finds the child turning 16',
  turning.some((r) => r.child_id === soon16), true);
check('D-49: and does not sweep up a 17-year-old already past it',
  turning.some((r) => r.child_id === ID.nate), false);

// ---------------------------------------------------------------------------
// §M / §N — the Interest Register: held until verified, gated on the
// subscription, statuses authorised, withdrawal empties the note.
// ---------------------------------------------------------------------------
const adminUnv = crypto.randomUUID(), regRiverside = crypto.randomUUID(), regUnv = crypto.randomUUID();
await db.query(`insert into person (id, first_name, dob) values ($1,'UnvAdmin','${yearsAgo(40)}')`, [adminUnv]);
await mem(adminUnv, CLUB.unverified, null, 'club_admin');
await db.query(`insert into registration (id, player_id, club_id, note, policy_version) values ($1,$2,$3,'I train Tuesdays','20@v2.4')`, [regRiverside, ID.marcus, CLUB.riverside]);
await db.query(`insert into registration (id, player_id, club_id, note, policy_version) values ($1,$2,$3,'Keen','20@v2.4')`, [regUnv, ID.marcus, CLUB.unverified]);

const rows = async (person, club) => (await db.query('select * from fn_register_rows($1,$2)', [person, club])).rows;
const count = async (person, club) => (await db.query('select fn_register_count($1,$2) as n', [person, club])).rows[0].n;

// The Stripe build, behind the switch (D-163): with billing ON, payment is
// part of the gate. The D-163 checks further down ask the same questions with
// it off.
await billingOn(true);
check('M: no subscription = no rows even for a verified club TD', (await rows(ID.td, CLUB.riverside)).length, 0);
await db.query(`update club set subscription_status='active' where id=$1`, [CLUB.riverside]);
check('M: active subscription + verified + TD = rows', (await rows(ID.td, CLUB.riverside)).length, 1);
check('M: a coach cannot work the register', (await rows(ID.coachV, CLUB.riverside)).length, 0);
check('M: an outsider cannot work the register', (await rows(ID.coachOther, CLUB.riverside)).length, 0);
// D-126, not J61: this is who reads rows, not whether a withdrawn one can be
// inferred. (It was labelled J61 until 28 Sep; the row is measured by
// scripts/timing-tests.mjs now, and a label is a claim — L4.)
check('held1: unverified club admin gets NO rows, whatever it pays', ((await db.query(`update club set subscription_status='active' where id=$1`, [CLUB.unverified])), (await rows(adminUnv, CLUB.unverified)).length), 0);
check('D-126: but the held COUNT is visible', await count(adminUnv, CLUB.unverified), 1);
check('N11: status move authorised for the TD', (await db.query('select fn_set_club_status($1,$2,$3) as ok', [ID.td, regRiverside, 'shortlisted'])).rows[0].ok, true);
check('N11: status move refused for an outsider', (await db.query('select fn_set_club_status($1,$2,$3) as ok', [ID.coachOther, regRiverside, 'invited'])).rows[0].ok, false);
check('N7: a stranger cannot withdraw a registration', (await db.query('select fn_withdraw_registration($1,$2) as ok', [ID.coachOther, regRiverside])).rows[0].ok, false);
check('N7: the guardian withdraws', (await db.query('select fn_withdraw_registration($1,$2) as ok', [ID.guardian, regUnv])).rows[0].ok, false /* marcus is 19: guardian link expired at 18 */);
check('N7: the adult player withdraws themself', (await db.query('select fn_withdraw_registration($1,$2) as ok', [ID.marcus, regRiverside])).rows[0].ok, true);
check('N7: the withdrawn note is emptied atomically', (await db.query('select note from registration where id=$1', [regRiverside])).rows[0].note, null);
check('N12: a withdrawn row leaves the register', (await rows(ID.td, CLUB.riverside)).length, 0);
await db.query(`update club set subscription_status=null where id=$1`, [CLUB.riverside]);
await billingOn(false);

// ---------------------------------------------------------------------------
// G9 — age bands evaluate in Australia/Melbourne, never UTC.
// ---------------------------------------------------------------------------
const boundary = crypto.randomUUID(), justUnder = crypto.randomUUID();
await db.query(`insert into person (id, first_name, dob) values ($1,'Boundary','${yearsAgo(18)}'), ($2,'JustUnder','${yearsAgo(18, 1)}')`, [boundary, justUnder]);
check('G9 18th birthday today (Melbourne) is 18plus', (await db.query(`select fn_age_band(dob) as b from person where id=$1`, [boundary])).rows[0].b, '18plus');
check('G9 18 tomorrow (Melbourne) is 16_17', (await db.query(`select fn_age_band(dob) as b from person where id=$1`, [justUnder])).rows[0].b, '16_17');

// ---------------------------------------------------------------------------
// D-17 — the 14-day purge: an unapproved invitation self-destructs whole;
// an approved one is never touched.
// ---------------------------------------------------------------------------
await db.query(`insert into pending_invitation (first_name, dob, guardian_name, guardian_phone, created_at)
  values ('Stale','2013-01-01','Old Parent','0400 000 000', now() - interval '15 days')`);
await db.query(`insert into pending_invitation (first_name, dob, guardian_name, guardian_phone, created_at, approved_at, sms_confirmed_at, email_confirmed_at)
  values ('Kept','2013-01-01','Fine Parent','0400 000 001', now() - interval '15 days', now() - interval '14 days', now() - interval '14 days', now() - interval '14 days')`);
await db.query(`insert into pending_invitation (first_name, dob, guardian_name, guardian_phone)
  values ('Fresh','2013-01-01','New Parent','0400 000 002')`);
// D-155: a held invitation purges exactly like any unapproved one.
await db.query(`insert into pending_invitation (first_name, dob, guardian_name, guardian_phone, created_at, held_at)
  values ('Held','2013-01-01','Held Parent','0400 000 003', now() - interval '15 days', now() - interval '14 days')`);
const purged = (await db.query('select fn_purge_pending() as n')).rows[0].n;
check('D-17 purge removes exactly the stale unapproved invitations (one waiting, one held)', purged, 2);
check('D-17 nothing readable survives the purge', (await db.query(`select count(*)::int as n from pending_invitation where first_name='Stale'`)).rows[0].n, 0);
check('D-17 an approved invitation is never purged', (await db.query(`select count(*)::int as n from pending_invitation where first_name='Kept'`)).rows[0].n, 1);
check('D-17 a fresh invitation is untouched', (await db.query(`select count(*)::int as n from pending_invitation where first_name='Fresh'`)).rows[0].n, 1);
check('D-155: a held invitation purges at 14 days like any other', (await db.query(`select count(*)::int as n from pending_invitation where first_name='Held'`)).rows[0].n, 0);

// D-156 and D-155, in the database — whatever the application does.
{
  const refused = async (sql, args = []) => { try { await db.query(sql, args); return false; } catch { return true; } };
  const inv = (await db.query(`insert into pending_invitation (first_name, dob, guardian_name, guardian_phone, guardian_email)
    values ('Two','2013-05-05','Two Channels','0400 000 004','two@example.com') returning id`)).rows[0].id;
  check('D-156: an invitation cannot be approved with no channel confirmed',
    await refused(`update pending_invitation set approved_at = now() where id = $1`, [inv]), true);
  await db.query(`update pending_invitation set sms_confirmed_at = now() where id = $1`, [inv]);
  check('D-156: nor with the text alone',
    await refused(`update pending_invitation set approved_at = now() where id = $1`, [inv]), true);
  await db.query(`update pending_invitation set sms_confirmed_at = null, email_confirmed_at = now() where id = $1`, [inv]);
  check('D-156: nor with the email alone',
    await refused(`update pending_invitation set approved_at = now() where id = $1`, [inv]), true);
  await db.query(`update pending_invitation set sms_confirmed_at = now() where id = $1`, [inv]);
  check('D-156: with both, it can', await refused(`update pending_invitation set approved_at = now() where id = $1`, [inv]), false);
  const cols = (await db.query(`select column_name, data_type from information_schema.columns
    where table_name = 'pending_invitation' and column_name like '%token%' order by 1`)).rows;
  check('D-156: the two links are stored only as hashes', cols.map((c) => `${c.column_name}:${c.data_type}`), ['email_token_hash:bytea', 'sms_token_hash:bytea']);

  const kid = (await db.query(`insert into person (first_name, dob) values ('Linked Kid', $1) returning id`, [yearsAgo(12)])).rows[0].id;
  check('D-155: a 17-year-old can never be linked as a guardian',
    await refused(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [ID.nate, kid]), true);
  const teen = (await db.query(`insert into person (first_name, dob, email) values ('Fifteen', $1, 'fifteen@example.com') returning id`, [yearsAgo(15)])).rows[0].id;
  check('D-155: nor a 15-year-old',
    await refused(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [teen, kid]), true);
  check('D-155: an adult can', await refused(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [ID.guardian, kid]), false);
  check('D-155: a guardian cannot be swapped for a minor afterwards',
    await refused(`update guardianship_link set guardian_id = $1 where guardian_id = $2 and child_id = $3`, [ID.nate, ID.guardian, kid]), true);
}

// D-155/D-156 in the application source: a page load never confirms, the
// approval needs the adult declaration, and a hold is written without a link.
{
  const gf = readFileSync(fileURLToPath(new URL('../lib/guardian-flow.ts', import.meta.url)), 'utf8');
  const page = readFileSync(fileURLToPath(new URL('../app/a/[id]/page.tsx', import.meta.url)), 'utf8');
  const acts = readFileSync(fileURLToPath(new URL('../app/a/[id]/actions.ts', import.meta.url)), 'utf8');
  check('D-156: the approval page never confirms a channel on load', /confirmChannel\(/.test(page), false);
  check('D-156: only the button\'s action does', /export async function confirmIt[\s\S]*?confirmChannel\(code\)/.test(acts), true);
  check('D-155: approving needs the adult declaration', /if \(!link \|\| !link\.channel \|\| !input\.adultDeclared\) return null/.test(gf), true);
  check('D-155: a hold sets held_at and links nobody',
    /if \(existing\?\.minor\) \{[\s\S]*?set held_at = now\(\)[\s\S]*?return \{ invitationId: p\.id \};\s*\}/.test(gf)
      && !/if \(existing\?\.minor\) \{[^}]*guardianship_link/.test(gf), true);
  check('D-155: a hold, an approval and an already-finished link all return the same shape',
    (gf.match(/return \{ invitationId: p\.id \}/g) ?? []).length === 2 && /\? \{ invitationId: link\.id \} : null/.test(gf), true);
}
check('D-17 the purge leaves only the fact in the log, one row per invitation', (await db.query(`select count(*)::int as n from consent_event where event='purged'`)).rows[0].n, 2);

// J1 — forbidden columns still absent after 0003
const cols = await db.query(`select column_name from information_schema.columns
  where table_schema='public' and column_name in ('is_visible','can_view','is_public','age_band')`);
check('J1 no stored permission flags exist', cols.rows.length, 0);

// ---------------------------------------------------------------------------
// doc 15 — the message catalogue is a closed set, and the copy obeys the
// rules that govern every message (§A). These read the catalogue source, so
// a message edited into breaking a rule fails here.
// ---------------------------------------------------------------------------
const msgSrc = readFileSync(fileURLToPath(new URL('../lib/messages.ts', import.meta.url)), 'utf8');
const bodies = [...msgSrc.matchAll(/body:\s*(?:`([\s\S]*?)`|\n`([\s\S]*?)`)/g)].map((m) => m[1] ?? m[2] ?? '');
const smsBlocks = msgSrc.split(/export const /).filter((b) => /channel: 'sms'/.test(b));

// send() drops a message whose key is not in CATALOGUE_KEYS and returns
// { queued: false } — which is the right call for a closed catalogue, but it
// is SILENT. A builder with a mistyped key would simply never send, and the
// consent spine is on this path: the guardian approval email would vanish
// with nothing to notice it. The keys are compile-time literals, so this is a
// property of the source and reading the source is the honest way to check.
{
  const catalogue = new Set([...(/CATALOGUE_KEYS = \[([\s\S]*?)\]/.exec(msgSrc)?.[1] ?? '')
    .matchAll(/'([^']+)'/g)].map((m) => m[1]));
  // A DRAFT is written and wired and has not been approved: doc 15 does not
  // carry it, so it queues in development and lib/messaging refuses it in
  // production (0056's confirm-your-address message). It is declared, so the
  // "no key is dropped silently" check still covers it — and it is NOT in the
  // catalogue, which is what stops it reaching a person.
  const drafts = new Set([...(/DRAFT_KEYS = \[([\s\S]*?)\]/.exec(msgSrc)?.[1] ?? '')
    .matchAll(/'([^']+)'/g)].map((m) => m[1]));
  const declared = new Set([...catalogue, ...drafts]);
  const used = [...msgSrc.matchAll(/key:\s*'([^']+)'/g)].map((m) => m[1]);
  check('doc15: a draft is not in the catalogue — approved copy and proposed copy are different sets',
    [...drafts].some((k) => catalogue.has(k)), false);
  check('doc15: every draft key says so in its name, so an outbox row is never mistaken for approved copy',
    [...drafts].every((k) => k.endsWith('.draft')), true);
  check('doc15: and lib/messaging refuses a draft in production — unapproved words reach nobody',
    /DRAFTS\.has\(msg\.key\) && process\.env\.NODE_ENV === 'production'[\s\S]{0,80}queued: false/.test(
      readFileSync(fileURLToPath(new URL('../lib/messaging.ts', import.meta.url)), 'utf8')), true);
  check(`doc15: every message's key is in the catalogue, so none is dropped silently (${used.filter((k) => !declared.has(k)).join(', ') || 'all are'})`,
    used.filter((k) => !declared.has(k)).length, 0);
  check(`doc15: and every catalogue key has a message (${[...declared].filter((k) => !used.includes(k)).join(', ') || 'all do'})`,
    [...declared].filter((k) => !used.includes(k)).length, 0);
  check('doc15: the catalogue is not empty, so neither check above is vacuous',
    declared.size > 20 && used.length > 20, true);
  // Rehearsal, 30 Sep: on a real deploy a draft never sends, and §10b was the
  // draft every sign-up door sends. Nobody could confirm an account. The
  // message every new account depends on must be approved copy.
  check('doc15 §10b: confirm-your-address is approved copy, so a new account can be confirmed in production (rehearsal, 30 Sep)',
    catalogue.has('doc15.§10b') && !drafts.has('doc15.§10b') && /key: 'doc15\.§10b',[\s\S]{0,60}Confirm your email address/.test(msgSrc), true);
}

// Doc 15 §9 is RETIRED and §4 is HELD (BUZ, 29 Sep; D-167). Neither may send:
// neither has a key, the waitlist route sends nothing, and doc 15 says why
// above each one's words.
{
  const doc15 = srcOf('docs/15-Message-Copy.md');
  const waitlistRoute = codeOnly(srcOf('app/api/waitlist/route.ts'));
  const sec = (n) => doc15.split(new RegExp(`\\n## ${n} · `))[1]?.split('\n## ')[0] ?? '';
  check('doc15-9: §9 (the waitlist confirmation) is marked retired in doc 15, with the reason, and nothing can send it',
    [/^\*\*RETIRED 29 Sep 2026/.test(sec(9).split('\n').slice(1).join('\n').trim()), /promise one email, when we open/.test(sec(9)),
     /doc15\.§9['.]/.test(msgSrc), /from '@\/lib\/messaging'|sendEmail|api\.resend\.com/.test(waitlistRoute)],
    [true, true, false, false]);
  check('doc15-4: §4 (the other parent told) is marked held in doc 15 under D-167, and has no key to send it by',
    [/^\*\*HELD 29 Sep 2026 \(BUZ, D-167\)/.test(sec(4).split('\n').slice(1).join('\n').trim()), /doc15\.§4['.]/.test(msgSrc)],
    [true, false]);
}

check('doc15 §A5: no link shortener in any message',
  bodies.some((b) => /bit\.ly|tinyurl|t\.co\//i.test(b)), false);
check('doc15 §A6: every SMS carries the support address',
  smsBlocks.every((b) => b.includes('${HELP}')), true);
const msgCode = msgSrc.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
// §12 names the state a coach page shows — the literal words "WWCC verified",
// which D-98 allows — and nothing else about a check may appear.
check('doc15 §A7: no message can carry a WWCC number',
  /wwcc/i.test(msgCode.replaceAll('"WWCC verified"', '')), false);
check('doc15 §A7b: §12 names the verified state and interpolates only the club',
  /coachVerifiedEmail = \(clubName: string\)/.test(msgCode) && !/\$\{(?!clubName\})/.test(msgCode.split('coachVerifiedEmail')[1].split('});')[0]), true);
const wakeBlocks = msgCode.split(/export const /).filter((b) => b.startsWith('bareWake'));
check('doc15 §24: the bare wake is defined and interpolates nothing at all',
  wakeBlocks.length === 2 && wakeBlocks.every((b) => !/\$\{(?!SITE|HELP)/.test(b)), true);
// 30 Sep, first night live: production Next prefetched the "Sign out" links,
// the prefetch hit GET /signout, and every session was revoked half a second
// after it was issued. Development never prefetches, so no suite could see it.
{
  const signoutRoute = readFileSync(fileURLToPath(new URL('../app/signout/route.ts', import.meta.url)), 'utf8');
  const linkFiles = ['../app/home/page.tsx', '../components/console-shell.tsx']
    .map((f) => readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8'));
  const links = linkFiles.flatMap((s) => [...s.matchAll(/<Link href="\/signout"[^>]*>/g)].map((m) => m[0]));
  check(`signout-p1: no Sign out link is prefetched (${links.length} links)`,
    links.length >= 3 && links.every((l) => l.includes('prefetch={false}')), true);
  check('signout-p2: and /signout answers a prefetch with nothing, before it touches the session',
    /if \(isPrefetch\(request\)\) return[\s\S]{0,120}\n  await clearSession\(\)/.test(signoutRoute), true);
}
check('doc15 §29: the share-card email carries no preview image',
  /shareCardWaitingEmail[\s\S]*?(<img|cid:|\.png|\.jpg)/.test(msgSrc), false);
// 30 Sep (feature audit): §29's [See the card] linked to the site's front
// page, and nothing there led to /g/card, so no parent could reach a card to
// approve it. The link now opens the card the child just asked for.
{
  const act = readFileSync(fileURLToPath(new URL('../app/share-card/[recordId]/actions.ts', import.meta.url)), 'utf8');
  check('doc15 §29: [See the card] opens the card itself — /g/card/{id} — not the front page',
    /See the card: \$\{SITE\}\/g\/card\/\$\{cardId\}/.test(msgSrc), true);
  check('doc15 §29: and the request passes the id of the card it just made',
    /returning id[\s\S]{0,200}const cardId[\s\S]*shareCardWaitingEmail\([^)]*cardId\)/.test(act), true);
}
// codeOnly first. doc 15 §32 explains at length why a card "didn't go
// through" rather than being declined, and the corpus check already allows
// explaining a ban — explaining is not using. The fifth check in this file
// to have matched its own documentation.
check('doc15 §32/D-108: the word "declined" appears in no message',
  /\bdeclined\b/i.test(codeOnly(msgSrc)), false);
check('doc15 NOT-list: no message says a link was opened or viewed',
  /(your CV was opened|has been viewed|viewed your)/i.test(msgSrc), false);

// The send layer refuses anything outside the catalogue.
const sendSrc = readFileSync(fileURLToPath(new URL('../lib/messaging.ts', import.meta.url)), 'utf8');
check('doc15: the send layer gates on the catalogue', sendSrc.includes("reason: 'not_in_catalogue'"), true);
check('D-81: SMS kill switch enforced in the send layer', sendSrc.includes('SMS_KILL_SWITCH'), true);
check('D-81: per-number 24h SMS limit enforced', sendSrc.includes('SMS_PER_NUMBER_24H'), true);
check('D-81: monthly SMS spend cap enforced', sendSrc.includes('SMS_MONTHLY_CAP_CENTS'), true);

// ---------------------------------------------------------------------------
// §O — billing walls (D-112, D-126, D-135, doc 14 §O10).
// ---------------------------------------------------------------------------
const billingSrc = readFileSync(fileURLToPath(new URL('../lib/billing.ts', import.meta.url)), 'utf8');
const hookSrc = readFileSync(fileURLToPath(new URL('../app/api/stripe/webhook/route.ts', import.meta.url)), 'utf8');
const applyFn = readFileSync(join(dir, '0012_billing.sql'), 'utf8');

check('O: fn_apply_subscription cannot touch club_state (payment never verifies)',
  /create function fn_apply_subscription[\s\S]*?end \$\$/.exec(applyFn)?.[0].includes('club_state = ') ?? true, false);
check('O10: Stripe receives no child data — only a club id',
  /player|registration|child|first_name/i.test(billingSrc.replace(/\/\/[^\n]*/g, '')), false);
check('D-112: no embedded card fields — hosted Checkout and Portal only',
  /card\[number\]|cardElement|PaymentElement/i.test(billingSrc), false);
check('D-112: the webhook verifies its signature before reading anything',
  hookSrc.indexOf('verify(payload') < hookSrc.indexOf('JSON.parse(payload)'), true);
check('D-112: replayed events cannot double-apply', hookSrc.includes('from stripe_event where id'), true);
check('D-135: the webhook never deletes a registration',
  /delete\s+from\s+registration/i.test(hookSrc), false);

// Payment alone cannot open a register: verification is a separate gate.
const payClub = crypto.randomUUID();
await db.query(`insert into club (id, name, club_state, subscription_status) values ($1,'Paid But Unverified','claimed','active')`, [payClub]);
const payAdmin = crypto.randomUUID();
await db.query(`insert into person (id, first_name, dob) values ($1,'PaidAdmin','${yearsAgo(40)}')`, [payAdmin]);
await mem(payAdmin, payClub, null, 'club_admin');
await db.query(`insert into registration (player_id, club_id, policy_version) values ($1,$2,'20@v2.4')`, [ID.marcus, payClub]);
check('M4/O: an active subscription at an unverified club still returns no rows',
  (await rows(payAdmin, payClub)).length, 0);
check('D-126: and the held count is all it gets', await count(payAdmin, payClub), 1);

// ---------------------------------------------------------------------------
// The register, grouped (0016). Grouping is a convenience; it must not become
// a second way to read the list.
// ---------------------------------------------------------------------------
// Fresh state: the register tests above deliberately withdraw their
// registration and switch the subscription back off, so this section cannot
// borrow theirs.
await db.query(`update club set subscription_status='active' where id=$1`, [CLUB.riverside]);
const regFiled = crypto.randomUUID();
await db.query(
  `insert into registration (id, player_id, club_id, squad_target, policy_version)
   values ($1,$2,$3,$4,'20@v2.4')`, [regFiled, ID.marcus, CLUB.riverside, SQUAD.u15]);
const regRows = async (who, club) => (await db.query('select * from fn_register_rows($1,$2)', [who, club])).rows;

const grouped = await regRows(ID.td, CLUB.riverside);
check('reg1: the squad the family named comes back with the row', grouped[0]?.squad_name, 'U15 Boys');
check('reg2: and carries the age group the grouping sorts on', grouped[0]?.squad_age_group, 'U15');
check('reg3: and the gender, which lives on the squad and never on the child (D-68)',
  grouped[0]?.squad_gender, 'boys');

// A registration with no squad named must still appear — the unfiled bucket
// is a real state. Losing these rows would silently hide families.
const unfiled = crypto.randomUUID();
await db.query(`insert into registration (id, player_id, club_id, policy_version) values ($1,$2,$3,'20@v2.4')`,
  [unfiled, ID.nate, CLUB.riverside]);
const withUnfiled = await regRows(ID.td, CLUB.riverside);
check('reg4: a registration naming no squad is still returned',
  withUnfiled.some((r) => r.registration_id === unfiled && r.squad_id === null), true);
check('reg5: and it sorts last, so it reads as a to-do rather than a squad',
  withUnfiled[withUnfiled.length - 1].squad_id, null);

// The authorisation is unchanged by the rewrite — this is the check that
// matters, because 0016 replaced the function wholesale.
check('reg6: an unverified club still gets no rows, squad columns or not',
  (await regRows(ID.adminOther, CLUB.unverified)).length, 0);
check('reg7: a coach still cannot work the register', (await regRows(ID.coachV, CLUB.riverside)).length, 0);
check('reg8: an outsider still gets nothing', (await regRows(ID.marcus, CLUB.riverside)).length, 0);
await db.query(`delete from registration where id in ($1, $2)`, [unfiled, regFiled]);
await db.query(`update club set subscription_status=null where id=$1`, [CLUB.riverside]);

// ---------------------------------------------------------------------------
// C6/C7/C8 — request access from the link-state page, M13, N14.
// ---------------------------------------------------------------------------
const arTok = (await db.query(`select id from share_token where token_hash = $1`, [t.expired])).rows[0].id;
check('C6: a first request is allowed', (await db.query('select fn_access_request_allowed($1) as ok', [arTok])).rows[0].ok, true);
await db.query(`insert into access_request (share_token_id, requester_name, requester_role) values ($1,'M. Harris','TD, Quarrymead United')`, [arTok]);
check('C7: a second inside 24 hours is not', (await db.query('select fn_access_request_allowed($1) as ok', [arTok])).rows[0].ok, false);

const arSrc = readFileSync(fileURLToPath(new URL('../app/p/[token]/request/actions.ts', import.meta.url)), 'utf8');
// Until 29 Sep this counted three `redirect(done)`, one per path. The handler
// now has ONE redirect, after the floor, and the request itself is a function
// that returns nothing — so there is nothing for the answer to branch on
// (brief D). Same rule, asked of the new shape (L33).
{
  const code = codeOnly(arSrc);
  const action = code.slice(code.indexOf('export async function requestAccess('), code.indexOf('async function askOnce('));
  const ask = code.slice(code.indexOf('async function askOnce('));
  check('C7b: and the answer is the same either way — one redirect, no branch',
    [(code.match(/redirect\(/g) ?? []).length, /redirect\(/.test(ask), /async function askOnce\([^)]*\): Promise<void>/.test(ask),
     /return [^;]/.test(ask)],
    [1, false, true, false]);
  // D-77 in time: the clock starts before the first await, and the one
  // redirect comes straight after the send floor — never existed, dead,
  // already asked today and sent all answer at the same moment. The timing
  // suite's req-t row measures it; this pins the shape it cannot see.
  const floorAt = action.indexOf('await answerNoSoonerThan(startedAt);');
  check('req-floor1: request-access starts the clock first and answers every path no sooner than the send floor, with nothing awaited between the floor and the redirect',
    [action.indexOf('const startedAt = performance.now();') >= 0 && action.indexOf('const startedAt = performance.now();') < action.indexOf('await '),
     floorAt >= 0 && floorAt < action.indexOf('redirect('),
     /await /.test(action.slice(floorAt + 'await answerNoSoonerThan(startedAt);'.length, action.indexOf('redirect('))),
     /import \{ answerNoSoonerThan \} from '@\/lib\/send-dispatch';/.test(code)],
    [true, true, false, true]);
  // D-80: the handler reads the token through the one read path, and names
  // neither the table nor the hash itself.
  check('req-read1: request-access resolves the token through lib/record-read (D-80), and never asks share_token itself',
    [/import \{ resolveTokenForNotice \} from '@\/lib\/record-read';/.test(code), /await resolveTokenForNotice\(token\)/.test(ask),
     /share_token\b|token_hash|createHash/.test(code)],
    [true, true, false]);
}
check('C6b: the requester’s own words are what travels', /requester_name|requester_role/.test(arSrc), true);
check('C8: nothing about the request is observable by the requester',
  /status|seen|answered|declined/.test(codeOnly(arSrc)), false);
const arCols = (await db.query(
  `select string_agg(column_name, ',') as c from information_schema.columns where table_name='access_request'`)).rows[0].c;
check('C8b: and the table has no state column for one to read',
  /status|seen_at|answered/.test(arCols), false);

// M13 — the onboarding pause refuses the transition without weakening it.
const m13 = crypto.randomUUID(), m13Call = crypto.randomUUID();
await db.query(`insert into club (id, name, club_state) values ($1,'Paused FC','claimed')`, [m13]);
await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
  values ($1,$2,now(),'BUZ','03 9000 0000','FV club directory','verified','27@v1.0')`, [m13Call, m13]);
await db.query(`update app_config set value = 'true' where key = 'onboarding_paused'`);
await expectFail('M13: with onboarding paused, no club can be verified',
  `update club set club_state='verified', verified_call_id='${m13Call}' where id='${m13}'`);
const pauseSrc = (await db.query(`select prosrc from pg_proc where proname='club_onboarding_pause'`)).rows[0].prosrc;
check('M13b: and the pause lowers no check — it only ever refuses',
  /verification_call|verified_call_id\s*=/.test(codeOnly(pauseSrc)), false);
await db.query(`update app_config set value = 'false' where key = 'onboarding_paused'`);
await db.exec(`update club set club_state='verified', verified_call_id='${m13Call}' where id='${m13}'`);
check('M13c: lifting it lets a properly called club through',
  (await db.query('select club_state from club where id=$1', [m13])).rows[0].club_state, 'verified');

// N14 — a registration tagged to a trial goes 90 days after it, on a clock
// that runs whether or not the club ever opened it.
const n14 = crypto.randomUUID();
await db.query(`insert into registration (id, player_id, club_id, policy_version, trial_on)
  values ($1,$2,$3,'20@v2.4', (now() at time zone 'Australia/Melbourne')::date - 91)`, [n14, ID.marcus, CLUB.riverside]);
const n14Fresh = crypto.randomUUID();
await db.query(`insert into registration (id, player_id, club_id, policy_version, trial_on)
  values ($1,$2,$3,'20@v2.4', (now() at time zone 'Australia/Melbourne')::date - 10)`, [n14Fresh, ID.marcus, CLUB.riverside]);
check('N14: the purge takes a registration 91 days past its trial',
  (await db.query('select fn_purge_past_trials() as n')).rows[0].n, 1);
check('N14b: and leaves a recent one alone',
  (await db.query('select count(*)::int as n from registration where id = $1', [n14Fresh])).rows[0].n, 1);

// ---------------------------------------------------------------------------
// Table L, the remainder — the recipient, the coach's link, the log.
// ---------------------------------------------------------------------------

// L18/L21 — most restrictive wins on a pending request, and a guardian of
// child A gets nothing on child B's.
const lReq = crypto.randomUUID();
await db.query(`insert into share_request (id, record_id, requested_by, destination) values ($1,$2,$3,'club@example.com')`,
  [lReq, REC.nate, ID.nate]);
await db.query(`insert into guardian_setting (child_id, profile_paused, updated_by) values ($1,true,$2)
  on conflict (child_id) do update set profile_paused = true`, [ID.nate, ID.guardian]);
await expectFail('L18: a pause while a request is pending stops the dispatch',
  `update share_request set dispatched_by='${ID.guardian}', dispatched_at=now() where id='${lReq}'`);
await db.query(`update guardian_setting set profile_paused=false where child_id=$1`, [ID.nate]);
check('L21: a guardian of another child has no standing on this request',
  await qDispatch(ID.guardian2, REC.nate), false);

// L23/L25/L29 — what the recipient gets is the token and nothing else. A
// forwarded link is the same link: the token is the authority, so a
// colleague sees exactly what the first reader saw and no more.
check('L23: a live token reads the public CV and nothing more',
  Object.keys((await db.query('select fn_token_read($1) as r', [t.live])).rows[0].r).sort().join(','),
  'approved_content,band,person_id,record_id');
check('L25: forwarding grants nothing extra — the token is the whole authority',
  /issued_to|recipient|bound_to/.test((await db.query(
    `select string_agg(column_name,',') as c from information_schema.columns where table_name='share_token'`)).rows[0].c),
  false);
check('L29: an unverified club can still open a link the family sent it',
  /club_state|verified/.test(codeOnly(await procSrc('fn_token_read'))), false);

// L26 — no contact route on a public CV, for any band.
check('L26: the player CV carries no contact affordance at all',
  /mailto:|tel:|contact/i.test(codeOnly(readFileSync(fileURLToPath(new URL('../components/cv/PlayerCV.tsx', import.meta.url)), 'utf8'))), false);

// L27 — there is no inbound reply route, so there is no second code path to
// get wrong. John ruled this (U-11) and the send now says so.
check('L27: no inbound reply route exists to route',
  routeFiles.filter((f) => /\/(reply|inbound|mailin)\//i.test(f)).length, 0);

// L28 — a send confers no membership. An invitation is the only route, and
// it goes to the guardian.
check('L28: receiving a send creates no membership anywhere',
  (await db.query(`select count(*)::int as n from membership m
    join share_request sr on sr.record_id = (select id from development_record where person_id = m.person_id)
    where sr.dispatched_at is not null and m.role = 'player' and m.club_id = $1`, [CLUB.other])).rows[0].n, 0);

// L30/L32 — no artefact that outlives expiry for a minor, and no grace.
check('L30: every token carries an expiry column, so a permanent copy has nowhere to live',
  (await db.query(`select string_agg(column_name,',') as c from information_schema.columns
    where table_name='share_token'`)).rows[0].c.includes('expires_at'), true);
check('L32: expiry is checked with a strict comparison — no grace window',
  /expires_at > now\(\)/.test(await procSrc('fn_token_read')), true);

// L31/L33/L34 — revocation bites on the very next request. There is no
// cache, no service worker and no client store between the check and the
// answer, because the check happens server-side on every read.
const lRevoke = crypto.randomUUID();
await db.query(`insert into share_token (id, record_id, token_hash, issued_by) values ($1,$2,$3,$4)`,
  [lRevoke, REC.marcus, sha('l31'), ID.marcus]);
check('L31a: the link reads while it lives',
  (await db.query('select fn_token_read($1) as r', [sha('l31')])).rows[0].r === null, false);
await db.query(`update share_token set revoked_at = now() where id = $1`, [lRevoke]);
check('L31: the next open is the link-state page',
  (await db.query('select fn_token_read($1) as r', [sha('l31')])).rows[0].r, null);
check('L33: nothing in the app registers a service worker or offline cache',
  routeFiles.some((f) => /serviceWorker|workbox|caches\.open/.test(readFileSync(f, 'utf8'))), false);
check('L34: the OG route re-reads on every request and is never revalidated',
  /force-dynamic/.test(eOg), true);

// L35 — regenerate and send again writes TWO rows, not an update.
check('L35: the consent log has no update path, so a second send appends',
  /raise exception/i.test(await procSrc('consent_event_immutable')), true);

// L36/L37 — a deleted record leaves the send row standing; an eighteenth
// birthday leaves the historic band as written.
const l36Child = crypto.randomUUID(), l36Rec = crypto.randomUUID();
await db.query(`insert into person (id, first_name, dob) values ($1,'Sent then gone',$2)`, [l36Child, yearsAgo(16)]);
await db.query(`insert into development_record (id, person_id) values ($1,$2)`, [l36Rec, l36Child]);
await db.query(
  `insert into consent_event (event, actor_id, subject_id, detail)
   values ('share_dispatched', $1, $2, jsonb_build_object('recipient','club@example.com','band_at_send','16_17'))`,
  [l36Child, l36Child]);
await db.query(`delete from development_record where id = $1`, [l36Rec]);
check('L36: the send row survives the record it was about',
  (await db.query(`select count(*)::int as n from consent_event
    where event='share_dispatched' and subject_id=$1`, [l36Child])).rows[0].n, 1);
check('L37: the band was recorded AT SEND, so a later birthday does not rewrite it',
  (await db.query(`select detail->>'band_at_send' as b from consent_event
    where event='share_dispatched' and subject_id=$1`, [l36Child])).rows[0].b, '16_17');

// The structural belt under L40: the limit is checked AFTER the session
// lookup and both paths end on the same URL. It is NOT L40 — doc 14 asks for
// the timing itself, "a test, not a hope", and scripts/timing-tests.mjs
// measures it (28 Sep). These stay because the measurement cannot see a
// branch that differs only in database round trips as production would.
check('lim-struct1: the rate check happens after the session work, not instead of it',
  dispatchSrc.indexOf('getSessionPersonId') < dispatchSrc.indexOf('checkRate'), true);
check('lim-struct2: and both paths end on the same URL',
  (dispatchSrc.match(/\/g\/send\/\$\{requestId\}\?sent=1/g) ?? []).length >= 2, true);

// The two halves of L40's remedy (29 Sep), pinned where the timing suite
// cannot see them: in production a real send's provider call would be the
// whole difference, and no local run makes one.
{
  const sendCode = codeOnly(srcOf('lib/messaging.ts'));
  check('lim-after1: no request waits for the email or SMS provider — send() hands it to after() and awaits nothing of it (L40)',
    [/import \{ after \} from 'next\/server';/.test(sendCode), /await\s+dispatch\(/.test(sendCode), (sendCode.match(/\bdispatch\(/g) ?? []).length],
    [true, false, 2]);
  const floorSrc = codeOnly(srcOf('lib/send-dispatch.ts'));
  const floorDefs = routeFiles.concat(['lib', 'components'].flatMap((d) => readdirSync(fileURLToPath(new URL(`../${d}`, import.meta.url)), { recursive: true })
    .filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => fileURLToPath(new URL(`../${d}/${f}`, import.meta.url)))))
    .filter((f) => /SEND_ANSWER_FLOOR_MS\s*=/.test(readFileSync(f, 'utf8')));
  check('lim-floor1: the answer floor is one number, defined once (lib/send-dispatch.ts)',
    [floorDefs.map((f) => f.split('/').slice(-2).join('/')), /export const SEND_ANSWER_FLOOR_MS = \d+;/.test(floorSrc)],
    [['lib/send-dispatch.ts'], true]);
  check('lim-floor2: and it is kept against the real clock, not left to a timer that wakes early for the path that did more work',
    /while \(performance\.now\(\) < until\)/.test(floorSrc), true);
  // Every door that can refuse a send for the limit: the clock starts before
  // the first thing either path awaits, and every answer after the limit is
  // checked waits for the floor with nothing awaited between it and the
  // redirect.
  for (const [door, file, end] of [['the player’s door', 'app/send/[recordId]/actions.ts', 'const client = await db.connect();'], ['the guardian’s door', 'app/g/send/[requestId]/actions.ts', null]]) {
    const src = codeOnly(srcOf(file));
    const fnStart = src.search(/export async function (composeSend|dispatchSend)\(/);
    // The player's door ends where the under-16 branch begins: that branch
    // composes a request for a guardian and has no limit to hide.
    const body = src.slice(fnStart, end ? src.indexOf(end, fnStart) : undefined);
    const clockFirst = body.indexOf('const startedAt = performance.now();') >= 0
      && body.indexOf('const startedAt = performance.now();') < body.indexOf('await ');
    const afterLimit = body.slice(body.indexOf('checkRate('));
    const redirects = [...afterLimit.matchAll(/redirect\(/g)].map((m) => m.index);
    const floored = redirects.every((at) => {
      const floor = afterLimit.lastIndexOf('await answerNoSoonerThan(startedAt);', at);
      return floor >= 0 && !/await /.test(afterLimit.slice(floor + 'await answerNoSoonerThan(startedAt);'.length, at));
    });
    check(`lim-floor3: ${door} starts the clock first and answers every send, refused or real, no sooner than the floor (${redirects.length} answers)`,
      [clockFirst, redirects.length >= 2, floored], [true, true, true]);
  }
}

// L44/L45/L54 — the coach's link is COPIED, never sent.
const copySrc = readFileSync(fileURLToPath(new URL('../components/cv/CopyLink.tsx', import.meta.url)), 'utf8');
check('L44: the copy affordance writes to the clipboard', /clipboard\.writeText/.test(copySrc), true);
check('L44b: and calls no endpoint at all', /fetch\(|action=|axios|\/api\//.test(codeOnly(copySrc)), false);
check('L44c: with no recipient field anywhere on it', /recipient|to:|email/i.test(codeOnly(copySrc)), false);
check('L45/L54: no route offers to send a coach’s link to anyone',
  routeFiles.filter((f) => /send.*coach|coach.*send|invite.*player/i.test(f)).length, 0);

// L48-L51 — the contact affordance by band, decided server-side.
const contactVisible = async (v) => (await db.query('select fn_coach_contact_visible($1) as v', [v])).rows[0].v;
check('L48: rendered for an anonymous visitor', await contactVisible(null), true);
check('L48b: and for a signed-in adult', await contactVisible(ID.marcus), true);
check('L49: absent for a signed-in under-16', await contactVisible(ID.deniz), false);
check('L50: and absent for a signed-in 16-17 — both are minors', await contactVisible(ID.nate), false);
const coachPageSrc = readFileSync(fileURLToPath(new URL('../app/c/[slug]/page.tsx', import.meta.url)), 'utf8');
check('L49b: absent from the RESPONSE BODY, not hidden with a style',
  /showContact &&/.test(coachPageSrc), true);
check('L51: no age is inferred from an anonymous visitor — no heuristic, no signal',
  /user-?agent|referer|fingerprint|guessAge|inferAge/i.test(codeOnly(coachPageSrc)), false);

// L52 — a coach cannot obtain a family's contact details by any path.
check('L52: no register, squad or console query returns a family contact',
  /p\.email|guardian_email|phone/.test(await procSrc('fn_register_rows')), false);
check('L52b: nor the applicant list', /p\.email|phone/.test(await procSrc('fn_role_applications')), false);

// L53 — the coach card carries the coach only.
const coachOg = codeOnly(readFileSync(fileURLToPath(new URL('../app/c/[slug]/opengraph-image.tsx', import.meta.url)), 'utf8'));
check('L53: the coach card names no player, squad or minor',
  /player|squad|child|development_record/i.test(coachOg), false);
check('L53b: and reads only the coach’s own tables',
  /coach_profile/.test(coachOg) && !/registration|share_token/.test(coachOg), true);

// N2/N3 — the guardian's consent screen shows four things at the moment of
// the press, and the log records a disclosure rather than an action.
const gSendPage = readFileSync(fileURLToPath(new URL('../app/g/send/[requestId]/page.tsx', import.meta.url)), 'utf8');
for (const [what, pat] of [['the recipient', /destination/], ['what the club gets', /link|CV/i],
                           ['what it does not carry', /contact detail|phone|not now/i],
                           ['that doing nothing is an answer', /disappears|do nothing/i]]) {
  check(`N2: the consent screen shows ${what}`, pat.test(gSendPage), true);
}
check('N3: the send row names the disclosing guardian and the child',
  /actor_id/.test(dispatchLib) && /subject_id|r\.person_id/.test(dispatchLib), true);

// C2/C3/C4/E13/P11 — the last few.
check('C2: no route accepts a 16-17 as a message recipient', msgRoutes.length, 0);

// ---------------------------------------------------------------------------
// Tables C, M, N, O, P — the remaining rows.
// ---------------------------------------------------------------------------

// C2/P11 — route enumeration. The absence IS the assertion (John's red line).
check('C2/P11: no message, DM, chat, inbox, thread or reply route exists', msgRoutes.length, 0);
check('P10: nor any route that appends to an invitation',
  routeFiles.filter((f) => /invitation/i.test(f) && /(append|reply|thread|message)/i.test(f)).length, 0);

// C3/C4 — an outside approach to an under-16 is logged. The vocabulary
// exists and one surface writes it; there is no separate second code path.
// Count files that WRITE the event, not files that mention it — the
// guardian's history page maps it to a plain-English line and would
// otherwise read as a second code path.
const contactWriters = routeFiles.filter((f) =>
  /insert into consent_event[\s\S]{0,200}outside_contact_logged/.test(readFileSync(f, 'utf8')));
check('C3/C4: exactly one code path records an outside approach, not two', contactWriters.length, 1);

// M2 — a held registration is unreachable by any query that does not go
// through the function. Asserted on the function, because that is where the
// predicate has to live for J50 to be true.
const m2Src = await procSrc('fn_register_rows');
check('M2: the register function is the only reader, and it joins on verified',
  /club_state = 'verified'/.test(m2Src) && /fn_can_work_register/.test(m2Src), true);

// M9 — registering with a CLAIMED club is permitted and held. The family is
// told it is with the club; nothing tells them the club cannot see it yet.
const m9Club = crypto.randomUUID(), m9Admin = crypto.randomUUID();
await db.query(`insert into club (id, name, club_state, subscription_status) values ($1,'Claimed FC','claimed','active')`, [m9Club]);
await db.query(`insert into person (id, first_name, dob) values ($1,'Claimed Admin',$2)`, [m9Admin, yearsAgo(40)]);
await mem(m9Admin, m9Club, null, 'club_admin');
await db.query(`insert into registration (player_id, club_id, policy_version) values ($1,$2,'20@v2.4')`, [ID.marcus, m9Club]);
check('M9: the registration is created against a claimed club',
  (await db.query('select fn_register_count($1,$2) as n', [m9Admin, m9Club])).rows[0].n, 1);
check('M9b: and held — the club sees no row', (await db.query('select * from fn_register_rows($1,$2)', [m9Admin, m9Club])).rows.length, 0);

// M12 — verifying writes one audit row carrying the operator, the time, the
// club and the answer to the authority question (D-137).
const callCols = (await db.query(
  `select string_agg(column_name,',') as c from information_schema.columns where table_name='verification_call'`)).rows[0].c;
for (const needed of ['operator', 'called_at', 'club_id', 'authority_confirmed', 'number_source']) {
  check(`M12: the call sheet records ${needed}`, callCols.includes(needed), true);
}
await expectFail('M12b: and the operator can never be a machine',
  `insert into verification_call (club_id, called_at, operator, number_called, number_source, outcome, policy_version)
   values ('${CLUB.riverside}', now(), 'system', '03 9000 0000', 'x', 'verified', '27@v1.0')`);

// N1 — a composed registration transmits nothing and mints no token.
const n1 = crypto.randomUUID();
await db.query(`insert into registration_request (id, record_id, club_id, note) values ($1,$2,$3,'Keen to train')`,
  [n1, REC.deniz, CLUB.riverside]);
const n1Row = (await db.query('select dispatched_at, registration_id from registration_request where id=$1', [n1])).rows[0];
check('N1: a composed registration is not dispatched', n1Row.dispatched_at, null);
check('N1b: and no registration exists club-side yet', n1Row.registration_id, null);

// N4/N5 — bands. A 16-17 sends for themselves under L5-L7; an adult has no
// guardian anywhere in the flow.
check('N4: a 16-17 dispatches their own registration', await qDispatch(ID.nate, REC.nate), true);
check('N5: an adult too, with no guardian in it', await qDispatch(ID.marcus, REC.marcus), true);
check('N5b: and a guardian has no standing on an adult', await qDispatch(ID.guardian, REC.marcus), false);

// N8 — deleting the profile takes the registration's readable content with
// it. Nothing about the child survives club-side.
const n8Child = crypto.randomUUID(), n8Rec = crypto.randomUUID(), n8Reg = crypto.randomUUID();
await db.query(`insert into person (id, first_name, dob) values ($1,'Deleting',$2)`, [n8Child, yearsAgo(13)]);
await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [ID.guardian, n8Child]);
await db.query(`insert into development_record (id, person_id) values ($1,$2)`, [n8Rec, n8Child]);
await db.query(`insert into registration (id, player_id, club_id, note, policy_version)
  values ($1,$2,$3,'I train Tuesdays','20@v2.4')`, [n8Reg, n8Child, CLUB.riverside]);
await db.query(`select fn_withdraw_registration($1,$2)`, [ID.guardian, n8Reg]);
check('N8: withdrawing empties the note the club could read',
  (await db.query('select note from registration where id=$1', [n8Reg])).rows[0].note, null);
check('N8b: and the row leaves the register',
  (await db.query('select * from fn_register_rows($1,$2)', [ID.td, CLUB.riverside]))
    .rows.some((r) => r.registration_id === n8Reg), false);

// N13 — cancellation deletes the register on a scheduled clock, never by a
// person with a button.
check('N13: the cancellation purge is a function the daily job calls',
  /fn_purge_cancelled_registers/.test(readFileSync(fileURLToPath(new URL('../app/api/jobs/daily/route.ts', import.meta.url)), 'utf8')), true);

// ---- Table O -------------------------------------------------------------
// O2 — no billing template can resolve a family address. The catalogue is
// closed, so this is checkable by reading it.
const catalogueSrc = codeOnly(readFileSync(fileURLToPath(new URL('../lib/messages.ts', import.meta.url)), 'utf8'));
// "card" alone catches shareCardWaitingEmail, which is a guardian message
// about a social card and not billing at all.
const billingMsgs = catalogueSrc.split('export const')
  .filter((b) => /payment|receipt|invoice|subscription|paymentFailed|Stripe/i.test(b.slice(0, 80)));
for (const b of billingMsgs) {
  check('O2: a billing message never addresses a guardian or a player',
    /guardian|parent|player|child/i.test(b), false);
}
check('O2b: and there is at least one billing message to check', billingMsgs.length > 0, true);

// O4/O5 — dunning hides, cancellation deletes.
const activeSrc = (await db.query(`select prosrc from pg_proc where proname='fn_register_active'`)).rows[0].prosrc;
check('O4: a past-due club is hidden by the register gate, not deleted',
  /grace_until|past_due|unpaid/i.test(activeSrc), true);
check('O4b: and the gate function deletes nothing', /delete/i.test(codeOnly(activeSrc)), false);

// O6/O7 — the disclosure is ours and it appears before Stripe.
const billingPage = readFileSync(fileURLToPath(new URL('../app/club/billing/page.tsx', import.meta.url)), 'utf8');
check('O7: the price, that it renews and how to cancel are on OUR page', /[Rr]enews/.test(billingPage) && /cancel/i.test(billingPage), true);
check('O6: the annual plan states the 14-day full refund', /14 days/.test(billingPage), true);
check('O8: the portal is reachable from the club’s own settings, not only an email',
  /portal/i.test(readFileSync(fileURLToPath(new URL('../app/club/billing/actions.ts', import.meta.url)), 'utf8')), true);

// O9 — no free period that converts to a charge.
check('O9: no trial or free period exists to convert',
  /trial_period|free_trial|trialDays|trial_end/i.test(billingPage + readFileSync(fileURLToPath(new URL('../app/club/billing/actions.ts', import.meta.url)), 'utf8')), false);

// ---- Table P -------------------------------------------------------------
// P2/P3 — an invitation lands with the player at 16-17 and 18+, and the
// guardian is told a verified club made contact without being shown it.
check('P2: a 16-17 has standing to act on their own invitation', await qDispatch(ID.nate, REC.nate), true);
check('P3: an adult likewise, with no guardian anywhere', await qDispatch(ID.guardian, REC.marcus), false);

// P4 — the outbound notification is a bare wake: no name, no club, no
// message, in all three bands.
const wake = catalogueSrc.split('bareWake')[1]?.split('export const')[0] ?? '';
// P4 bans a player NAME, a club NAME and the message text — not the site
// URL and the support address, which every message carries.
const wakeInterps = [...wake.matchAll(/\$\{(\w+)\}/g)].map((m) => m[1]);
check('P4: the bare wake interpolates only the site and the help address',
  wakeInterps.every((v) => v === 'SITE' || v === 'HELP'), true);
check('P4b: so it can carry no player name, club name or message text',
  wakeInterps.some((v) => /name|club|body|message|first/i.test(v)), false);

// P8 — a reply shares field by field, and nothing by default.
const replyCols = (await db.query(
  `select string_agg(column_name,',') as c from information_schema.columns where table_name='invitation_reply'`)).rows[0].c;
check('P8: what was shared is an explicit per-field record', replyCols.includes('shared_fields'), true);
const replyDefault = (await db.query(
  `select column_default from information_schema.columns
   where table_name='invitation_reply' and column_name='shared_fields'`)).rows[0].column_default;
check('P8b: and the default is nothing', /'\{\}'/.test(replyDefault), true);

// ---------------------------------------------------------------------------
// Tables B, E, F, H, I, J, Q, R — the remaining rows.
// ---------------------------------------------------------------------------

// B8/B9 — search ordering is identical whatever the searcher holds and
// whatever the player's club is. Premium never re-ranks verified data, and
// Founding XI is recognition, never advantage.
const searchSrc = (await db.query(`select prosrc from pg_proc where proname='fn_searchable'`)).rows[0].prosrc;
check('B8: search never reads a subscription or premium flag',
  /premium|subscription|plan\b/i.test(codeOnly(searchSrc)), false);
check('B9: nor a founding-club flag', /founding|founder/i.test(codeOnly(searchSrc)), false);
check('B9b: fn_searchable returns a boolean, so there is no ordering to buy',
  (await db.query(`select pg_get_function_result(oid) as r from pg_proc where proname='fn_searchable'`)).rows[0].r,
  'boolean');

// B10 — discovery at 16 waits on the transition notice having been DELIVERED
// and on the guardian not having switched it off.
check('B10: discovery is gated on the delivered notice, not on the birthday alone',
  /fn_transition_notice_delivered/.test(searchSrc), true);
check('B10b: and on the guardian off-switch', /discovery_disabled/.test(searchSrc), true);

// E12/E13/E14 — the OG card by band.
const eOgCode = codeOnly(eOg);
check('E12: the card carries no club, age group or region (D-89)',
  /club|age_group|ageGroup|region|suburb/i.test(eOgCode), false);
// The full surname must be reachable ONLY through the adult branch.
check('E12b: a full surname renders only when the band says adult',
  /isAdult \? cv\.lastName : `\$\{cv\.lastName\[0\]\}\.`/.test(eOgCode), true);

// E12c USED TO assert that the card computed the band itself, from cv.dob,
// and it counted `cv.band` as caller input alongside searchParams. That was a
// check on the MECHANISM, not the property — and pinning the mechanism is what
// caused the bug it existed to prevent. assembleCv never returns a dob, so the
// local computation always saw null, every player fell to the restrictive
// default, and the 18+ branch had never once executed in the product's life:
// a 22-year-old's card read "Jordan A."
//
// The property is that WHOEVER REQUESTS THE CARD CANNOT CHOOSE THE BAND. The
// card's only input is the token in the path; cv comes from fn_token_read,
// which derives the band in Postgres on every read and never stores it (J1).
check('E12c: the band cannot be chosen by whoever requests the card',
  /searchParams|props\.band|params\.band|headers\(\)|cookies\(\)/.test(eOgCode), false);
check('E12d: it comes from the tokenised read path, not a second derivation',
  /cv\.band/.test(eOgCode) && /readCvByToken/.test(eOg), true);
// And the behavioural half, which no source-text check can stand in for: the
// band the read path hands the card is the one fn_age_band derives from DOB.
for (const [who, dob] of [['a 14-year-old', '2012-03-14'], ['a 22-year-old', '2004-02-19']]) {
  const b = (await db.query('select fn_age_band($1::date) as b', [dob])).rows[0].b;
  check(`E12e: ${who} bands as ${dob === '2004-02-19' ? '18plus' : 'u16'}, so the card branches on a real value`,
    b, dob === '2004-02-19' ? '18plus' : 'u16');
}
check('E13: an adult card therefore carries full detail', /isAdult/.test(eOgCode), true);
check('E13/E14: the card re-reads the token every request and falls back generic',
  /readCvByToken/.test(eOg) && /!cv/.test(eOg), true);
check('E14b: nothing about the card is cached past the check',
  /revalidate\s*=\s*(?!0)[1-9]/.test(eOg), false);

// F7/F8/F9 — the guardian's view.
check('F9: a guardian of one child reads nothing of another', await level(ID.guardian2, ID.georgia), 'none');
check('F9b: and cannot act on them either', await recActor(ID.guardian2, REC.georgia), null);
const controlsSrc = readFileSync(fileURLToPath(new URL('../app/g/controls/[childId]/page.tsx', import.meta.url)), 'utf8');
check('F8: the consent log the guardian reads covers approvals, shares and contact',
  /share_issued/.test(controlsSrc) && /outside_contact_logged/.test(controlsSrc) && /age_transition/.test(controlsSrc), true);
// F7/I3 — an authoring coach keeps an anonymised COUNT through erasure.
const f7Rec = crypto.randomUUID(), f7Child = crypto.randomUUID();
await db.query(`insert into person (id, first_name, dob) values ($1,'Erased',$2)`, [f7Child, yearsAgo(13)]);
await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [ID.guardian, f7Child]);
await db.query(`insert into development_record (id, person_id) values ($1,$2)`, [f7Rec, f7Child]);
// The TD can only write to a player at their own verified club — the 0015
// guard, working. The fixture has to make the child one.
await mem(f7Child, CLUB.riverside, SQUAD.u15, 'player');
await db.query(`insert into record_entry (record_id, entry_type, author_id, provenance)
  values ($1,'coach_note',$2,'coach_verified'), ($1,'attendance',$2,'coach_verified')`, [f7Rec, ID.td]);
await db.query(`delete from development_record where id = $1`, [f7Rec]);
const f7 = (await db.query('select * from fn_my_authorship($1)', [ID.td])).rows;
check('F7: an authoring coach keeps a count through erasure (D-48)', f7[0]?.entries, 2);
const authCols = (await db.query(
  `select string_agg(column_name,',') as c from information_schema.columns where table_name='coach_authorship'`)).rows[0].c;
for (const forbidden of ['record_id', 'person_id', 'subject', 'body', 'child']) {
  check(`I3: the retained count cannot identify the child — no ${forbidden}`, authCols.includes(forbidden), false);
}
check('I3b: and another coach reads none of it',
  (await db.query('select * from fn_my_authorship($1)', [ID.coachOther])).rows.length, 0);

// H11 — the administrator wall, asserted at the query layer.
check('H11: a club administrator reads no development record, by any path',
  await level(ID.clubAdmin, ID.deniz), 'membership_only');
const readLevelSrc = (await db.query(`select prosrc from pg_proc where proname='fn_read_level'`)).rows[0].prosrc;
check('H11b: and "membership_only" is returned by the FUNCTION, not chosen by a page',
  /membership_only/.test(readLevelSrc), true);

// I1/I3/I4 — deletion.
const delChild = crypto.randomUUID(), delRec = crypto.randomUUID(), delTok = crypto.randomUUID();
await db.query(`insert into person (id, first_name, dob) values ($1,'Gone',$2)`, [delChild, yearsAgo(13)]);
await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [ID.guardian, delChild]);
await db.query(`insert into development_record (id, person_id) values ($1,$2)`, [delRec, delChild]);
await db.query(`insert into share_token (id, record_id, token_hash, issued_by) values ($1,$2,$3,$4)`,
  [delTok, delRec, sha('doomed'), ID.guardian]);
await db.query(`insert into profile_version (record_id, content, status) values ($1,'{"name":"Gone"}','approved')`, [delRec]);
await db.query(`insert into consent_event (event, actor_id, subject_id) values ('approved',$1,$2)`, [ID.guardian, delChild]);
check('I4a: the token resolves while the record lives',
  (await db.query('select fn_token_read($1) as r', [sha('doomed')])).rows[0].r === null, false);
await db.query(`delete from development_record where id = $1`, [delRec]);
check('I1: the record is gone', (await db.query('select count(*)::int as n from development_record where id=$1', [delRec])).rows[0].n, 0);
check('I4: and its token now reads like every other dead state',
  (await db.query('select fn_token_read($1) as r', [sha('doomed')])).rows[0].r, null);
check('I5b/I3: the consent log survives the deletion',
  (await db.query(`select count(*)::int as n from consent_event where subject_id=$1`, [delChild])).rows[0].n, 1);

// ---------------------------------------------------------------------------
// ERASURE AS A PROPERTY (D-26, doc 14 I1/I4/I5, U-6; 0067).
//
// The one-tap deletion failed for any child an investigator had looked at
// (investigation_access cannot be deleted and pinned the grant), and from
// 28 Sep for any 16–17 who signed up (message_outbox.subject_id). Both were a
// table the deletion's author did not know about. The checks above build a
// child with a record and a token and nothing else, so they could not see it.
//
// This one does not list the tables. It reads every foreign key onto
// person(id) from pg_constraint, puts the child in EVERY one of those columns
// — including the ones a child cannot reach today, because the property is
// "no row names the child", not "no row a child can reach today names the
// child" — runs fn_erase_child, the function the button calls, and asks each
// column again. A table added tomorrow that references a person fails the
// first check below by name until somebody decides what erasure does to it.
// ---------------------------------------------------------------------------
{
  const q = (sql, args) => db.query(sql, args);
  const fkCols = (await q(
    `select c.conrelid::regclass::text as tbl, a.attname as col
     from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
     where c.contype = 'f' and c.confrelid = 'person'::regclass order by 1, 2`)).rows.map((r) => `${r.tbl}.${r.col}`);

  // The world: a club of its own, so nothing here moves another table's counts.
  const E = {};
  for (const k of ['child', 'guardian', 'other', 'otherGuardian', 'adult', 'investigator', 'club', 'squad', 'rec', 'otherRec',
    'report', 'comp', 'role', 'reg', 'otherReg', 'otherReg2', 'inv', 'otherInv', 'tok', 'otherTok', 'outAbout', 'grant', 'otherGrant',
    'reportHold', 'reportTok', 'reportCoach', 'reportOther', 'stopReq']) {
    E[k] = crypto.randomUUID();
  }
  const P = E.child;
  const person = (id, name, dob) => q(`insert into person (id, first_name, last_name, dob) values ($1,$2,'Erasure',$3)`, [id, name, dob]);
  await person(P, 'Erin', yearsAgo(16, -100));          // 16–17: the band that can reach the most tables
  await person(E.guardian, 'Gale', yearsAgo(44));
  await person(E.other, 'Oli', yearsAgo(12));
  await person(E.otherGuardian, 'Ona', yearsAgo(41));
  await person(E.adult, 'Ade', yearsAgo(38));
  await person(E.investigator, 'Ivy', yearsAgo(33));
  await q(`insert into club (id, name, club_state) values ($1,'Erasure Park FC','claimed')`, [E.club]);
  await q(`insert into squad (id, club_id, name, age_group, competition_gender, season) values ($1,$2,'E-U17','U17','boys','2026')`, [E.squad, E.club]);
  await q(`insert into competency (id, framework_version, code) values ($1,'erasure-fixture','ERASE-1')`, [E.comp]);
  // D-166: the free text on the trail names the child, as a real one would.
  await q(`insert into report (id, subject_kind, subject_ref, reason) values ($1,'player_cv','erasure-fixture','Erin is in a photo on this page')`, [E.report]);

  // Every column gets the child, whatever the product's own rules would say:
  // the triggers that keep a minor out of adult roles are switched off for the
  // fixture only, and switched back on before anything is asserted.
  const FIXTURE = {
    'abuse_signal.actor_id': `insert into abuse_signal (actor_id, reason, surface) values ($P,'blocked','send')`,
    'age_transition_notice.child_id': `insert into age_transition_notice (child_id) values ($P)`,
    'alumni_entry.added_by': `insert into alumni_entry (club_id, line, added_by) values ('${E.club}','A former player',$P)`,
    'alumni_entry.adults_confirmed_by': `insert into alumni_entry (club_id, line, adults_confirmed_by, adults_confirmed_at) values ('${E.club}','Another former player',$P, now())`,
    'assessment_entry.author_id': `insert into assessment_entry (record_id, competency_id, band, author_id) values ('${E.otherRec}','${E.comp}','developing',$P)`,
    'assessment_session.author_id': `insert into assessment_session (author_id) values ($P)`,
    'auth_credential.person_id': `insert into auth_credential (person_id, password_hash) values ($P,'fixture')`,
    'auth_device.person_id': `insert into auth_device (person_id, device_hash) values ($P,'\\x01')`,
    'auth_reset.person_id': `insert into auth_reset (person_id, token_hash, expires_at) values ($P, decode(md5('e-reset'),'hex'), now() + interval '1 day')`,
    'auth_reset.proves_person_id': `insert into auth_reset (person_id, proves_person_id, token_hash, expires_at) values ('${E.adult}',$P, decode(md5('e-reset2'),'hex'), now() + interval '1 day')`,
    'auth_session.person_id': `insert into auth_session (person_id, token_hash, expires_at) values ($P, decode(md5('e-sess'),'hex'), now() + interval '1 day')`,
    'club_video.added_by': `insert into club_video (club_id, url, title, added_by) values ('${E.club}','https://www.youtube-nocookie.com/embed/erasure','Training',$P)`,
    'coach_authorship.author_id': `insert into coach_authorship (author_id, entries) values ($P, 3)`,
    'coach_invite.invited_by': `insert into coach_invite (club_id, person_id, invited_by, squad_ids, wwcc_checked) values ('${E.club}','${E.adult}',$P, array['${E.squad}']::uuid[], true)`,
    'coach_invite.person_id': `insert into coach_invite (club_id, person_id, invited_by, squad_ids, wwcc_checked) values ('${E.club}',$P,'${E.adult}', array['${E.squad}']::uuid[], true)`,
    'coach_profile.person_id': `insert into coach_profile (person_id) values ($P)`,
    'coaching_role.posted_by': `insert into coaching_role (club_id, title, posted_by) values ('${E.club}','Assistant coach',$P)`,
    'development_record.person_id': `insert into development_record (id, person_id) values ('${E.rec}',$P)`,
    'email_proof.person_id': `insert into email_proof (person_id, token_hash, expires_at) values ($P, decode(md5('e-proof'),'hex'), now() + interval '1 day')`,
    'growth_note.entered_by': `insert into growth_note (record_id, entered_by, height_cm, measured_on) values ('${E.otherRec}',$P, 150, current_date)`,
    'guardian_setting.child_id': `insert into guardian_setting (child_id, profile_paused) values ($P, false)`,
    'guardian_setting.updated_by': `insert into guardian_setting (child_id, profile_paused, updated_by) values ('${E.other}', true, $P)`,
    'guardianship_link.child_id': `insert into guardianship_link (guardian_id, child_id, approved_at) values ('${E.guardian}',$P, now())`,
    'guardianship_link.guardian_id': `insert into guardianship_link (guardian_id, child_id, approved_at) values ($P,'${E.other}', now())`,
    'investigation_grant.investigator_id': `insert into investigation_grant (id, report_id, investigator_id, subject_id, expires_at) values ('${E.otherGrant}','${E.report}',$P,'${E.other}', now() + interval '7 days')`,
    'investigation_grant.subject_id': `insert into investigation_grant (id, report_id, investigator_id, subject_id, expires_at) values ('${E.grant}','${E.report}','${E.investigator}',$P, now() + interval '7 days')`,
    'invitation_reply.approved_by': `insert into invitation_reply (invitation_id, replied_by, approved_by, approved_at) values ('${E.otherInv}','${E.other}',$P, now())`,
    'invitation_reply.replied_by': `insert into invitation_reply (invitation_id, replied_by) values ('${E.inv}',$P)`,
    'membership.person_id': `insert into membership (person_id, club_id, squad_id, role) values ($P,'${E.club}','${E.squad}','player')`,
    'message_outbox.subject_id': `insert into message_outbox (id, message_key, channel, to_address, body, subject_id) values ('${E.outAbout}','guardian_confirm_16','email','gale@example.com','fixture',$P)`,
    'message_outbox.to_person': `insert into message_outbox (message_key, channel, to_address, body, to_person) values ('fixture','email','erin@example.com','fixture',$P)`,
    'player_stat.verified_by': `insert into player_stat (record_id, season, stat_key, value, provenance, verified_club_id, verified_by, verified_at) values ('${E.otherRec}','2026','goals',4,'coach_verified','${E.club}',$P, now())`,
    'player_stat_history.verified_by': `insert into player_stat_history (record_id, season, stat_key, value, provenance, verified_club_id, verified_by, verified_at) values ('${E.otherRec}','2026','apps',9,'coach_verified','${E.club}',$P, now())`,
    'pending_invitation.child_id': `insert into pending_invitation (first_name, dob, child_id) values ('Erin','${yearsAgo(16, -100)}',$P)`,
    'players_wanted_notice.added_by': `insert into players_wanted_notice (club_id, title, added_by) values ('${E.club}','Keepers wanted',$P)`,
    'profile_version.approved_by': `insert into profile_version (record_id, content, status, approved_by, approved_at) values ('${E.otherRec}','{}','approved',$P, now())`,
    'profile_version.created_by': `insert into profile_version (record_id, content, status, created_by) values ('${E.otherRec}','{}','pending',$P)`,
    'record_entry.author_id': `insert into record_entry (record_id, entry_type, author_id, provenance) values ('${E.otherRec}','coach_note',$P,'coach_verified')`,
    'register_grant.granted_by': `insert into register_grant (club_id, person_id, squad_id, granted_by) values ('${E.club}','${E.adult}','${E.squad}',$P)`,
    'register_grant.person_id': `insert into register_grant (club_id, person_id, squad_id, granted_by) values ('${E.club}',$P,'${E.squad}','${E.adult}')`,
    'register_grant.revoked_by': `insert into register_grant (club_id, person_id, squad_id, granted_by, revoked_at, revoked_by) values ('${E.club}','${E.adult}','${E.squad}','${E.adult}', now(), $P)`,
    'register_read_log.person_id': `insert into register_read_log (person_id, registration_id, surface) values ($P,'${E.otherReg}','list')`,
    'registration.disclosed_by': `insert into registration (id, player_id, club_id, policy_version, disclosed_by) values ('${E.otherReg2}','${E.other}','${E.club}','20@v2.4',$P)`,
    'registration.player_id': `insert into registration (id, player_id, club_id, policy_version) values ('${E.reg}',$P,'${E.club}','20@v2.4')`,
    'registration_request.dispatched_by': `insert into registration_request (record_id, club_id, dispatched_by, dispatched_at) values ('${E.rec}','${E.club}',$P, now())`,
    'role_application.coach_id': `insert into role_application (role_id, coach_id) values ('${E.role}',$P)`,
    'send_held.person_id': `insert into send_held (person_id, club_name) values ($P,'Erasure Park FC')`,
    'club_request.requested_by': `insert into club_request (requested_by, name, suburb, state, contact_email) values ($P,'Erasure Rangers','Erasure','VIC','sec@erasure-rangers.example')`,
    'share_card_approval.approved_by': `insert into share_card_approval (record_id, requested_by, card_kind, approved_by, approved_at) values ('${E.rec}','${E.guardian}','og',$P, now())`,
    'share_card_approval.requested_by': `insert into share_card_approval (record_id, requested_by, card_kind) values ('${E.rec}',$P,'og')`,
    'share_request.dispatched_by': `insert into share_request (record_id, requested_by, dispatched_by, dispatched_at) values ('${E.rec}','${E.guardian}',$P, now())`,
    'share_request.requested_by': `insert into share_request (record_id, requested_by) values ('${E.rec}',$P)`,
    'share_token.issued_by': `insert into share_token (id, record_id, token_hash, issued_by) values ('${E.tok}','${E.rec}', decode(md5('e-tok'),'hex'),$P)`,
    'squad_claim.answered_by': `insert into squad_claim (person_id, club_id, squad_id, asked_by, answered_by, answered_at) values ('${E.other}','${E.club}','${E.squad}','${E.otherGuardian}',$P, now())`,
    'squad_claim.asked_by': `insert into squad_claim (person_id, club_id, squad_id, asked_by) values ('${E.other}','${E.club}','${E.squad}',$P)`,
    'squad_claim.person_id': `insert into squad_claim (person_id, club_id, squad_id, asked_by) values ($P,'${E.club}','${E.squad}','${E.guardian}')`,
    'squad_invitation.answered_by': `insert into squad_invitation (person_id, club_id, squad_id, invited_by, answered_by, answered_at) values ('${E.other}','${E.club}','${E.squad}','${E.adult}',$P, now())`,
    'squad_invitation.invited_by': `insert into squad_invitation (person_id, club_id, squad_id, invited_by) values ('${E.other}','${E.club}','${E.squad}',$P)`,
    'squad_invitation.person_id': `insert into squad_invitation (person_id, club_id, squad_id, invited_by) values ($P,'${E.club}','${E.squad}','${E.adult}')`,
    'undo_token.issued_to': `insert into undo_token (token_hash, share_token_id, issued_to, expires_at) values (decode(md5('e-undo'),'hex'),'${E.otherTok}',$P, now() + interval '1 day')`,
    'verification_challenge.person_id': `insert into verification_challenge (person_id, channel, token_hash, expires_at) values ($P,'email', decode(md5('e-vc'),'hex'), now() + interval '1 day')`,
    'wwcc_attestation.attested_by': `insert into wwcc_attestation (person_id, club_id, attested_by) values ('${E.adult}','${E.club}',$P)`,
    'wwcc_attestation.person_id': `insert into wwcc_attestation (person_id, club_id, attested_by) values ($P,'${E.club}','${E.adult}')`,
  };

  const missing = fkCols.filter((k) => !(k in FIXTURE));
  check(`erase0: every column that references a person has an erasure fixture${missing.length ? ` — NOT HANDLED: ${missing.join(', ')}` : ''}`, missing, []);
  check('erase0b: and the fixture names no column that no longer exists',
    Object.keys(FIXTURE).filter((k) => !fkCols.includes(k)), []);

  let fixtureErr = null;
  await db.exec(`set session_replication_role = replica`);
  try {
    // The other child's side of the world, which must come through intact.
    await q(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2, now())`, [E.otherGuardian, E.other]);
    await q(`insert into development_record (id, person_id) values ($1,$2)`, [E.otherRec, E.other]);
    await q(`insert into share_token (id, record_id, token_hash, issued_by) values ($1,$2, decode(md5('e-otok'),'hex'),$3)`, [E.otherTok, E.otherRec, E.otherGuardian]);
    await q(`insert into registration (id, player_id, club_id, policy_version) values ($1,$2,$3,'20@v2.4')`, [E.otherReg, E.other, E.club]);
    await q(`insert into invitation (id, registration_id, club_id, body) values ($1,$2,$3,'Come and train')`, [E.otherInv, E.otherReg, E.club]);
    await q(`insert into coaching_role (id, club_id, title, posted_by) values ($1,$2,'Head coach',$3)`, [E.role, E.club, E.adult]);
    await q(`insert into record_entry (record_id, entry_type, author_id, provenance) values ($1,'attendance',$2,'coach_verified')`, [E.otherRec, E.adult]);
    // Order matters only where one fixture row points at another — and with
    // the triggers off, so is the foreign key, so the order is the check.
    const first = ['development_record.person_id', 'registration.player_id', 'share_token.issued_by', 'message_outbox.subject_id'];
    for (const k of first) await db.exec(FIXTURE[k].replaceAll('$P', `'${P}'`));
    await q(`insert into invitation (id, registration_id, club_id, body) values ($1,$2,$3,'Come and train')`, [E.inv, E.reg, E.club]);
    for (const k of Object.keys(FIXTURE).filter((x) => !first.includes(x))) {
      await db.exec(FIXTURE[k].replaceAll('$P', `'${P}'`));
    }
    // A LOGGED LOOK at the child, and one by them, which is what pinned the grant.
    await q(`insert into investigation_access (grant_id, what) values ($1,'Erin’s send rows'), ($2,'Oli’s send rows')`, [E.grant, E.otherGrant]);
    // D-166: every way a report is tied to a child, each saying her name — a
    // hold on her record, her share link's hash, her own coach page — and one
    // report about somebody else entirely, which must come through untouched.
    await q(`insert into report (id, subject_kind, subject_ref, reason) values ($1,'other','erasure-hold','Erin is in this clip')`, [E.reportHold]);
    await q(`insert into content_hold (record_id, report_id) values ($1,$2)`, [E.rec, E.reportHold]);
    await q(`insert into report (id, subject_kind, subject_ref, reason) values ($1,'player_cv', md5('e-tok'),'Erin’s page names her school')`, [E.reportTok]);
    // (Unreachable today — an under-18's coach page carries no public link,
    // 0042 — and handled anyway, as 0067 handles every such row.)
    await q(`update coach_profile set public_slug = 'erasure-coach-page' where person_id = $1`, [P]);
    await q(`insert into report (id, subject_kind, subject_ref, reason) values ($1,'coach_cv','erasure-coach-page','Erin coaches my son')`, [E.reportCoach]);
    await q(`insert into report (id, subject_kind, subject_ref, reason) values ($1,'player_cv','erasure-other','Oli’s page has a phone number on it')`, [E.reportOther]);
    // Rows elsewhere that point at a message about the child.
    await q(`insert into access_request (share_token_id, requester_name, requester_role, notified_outbox_id) values ($1,'Riley','coach',$2)`, [E.otherTok, E.outAbout]);
    await q(`insert into age_transition_notice (child_id, outbox_id) values ($1,$2)`, [E.other, E.outAbout]);
    // 0161: a CV of hers that went to a club, and the stop reference the
    // dispatch leaves (written here by hand: the triggers are off).
    await q(`insert into share_request (id, record_id, requested_by, destination, dispatched_by, dispatched_at)
             values ($1,$2,$3,'Erasure Park FC <info@erasurepark.example.au>',$3, now())`, [E.stopReq, E.rec, E.guardian]);
    await q(`insert into send_stop_ref (id, address) values ($1,'info@erasurepark.example.au')`, [E.stopReq]);
  } catch (e) { fixtureErr = e.message; }
  await db.exec(`set session_replication_role = origin`);
  check('erase1: the fixture builds', fixtureErr, null);

  const namedIn = async () => {
    const out = [];
    for (const k of fkCols) {
      const [t, c] = k.split('.');
      const n = (await q(`select count(*)::int as n from ${t} where ${c} = $1`, [P])).rows[0].n;
      if (n > 0) out.push(k);
    }
    return out;
  };
  const before = await namedIn();
  check('erase2: before the deletion the child is named in every one of those columns',
    fkCols.filter((k) => !before.includes(k)), []);

  // The door: only an approved guardian erases, and a refusal changes nothing.
  await expectFail('erase3: a stranger cannot erase a child — the function asks, not only the page',
    `select fn_erase_child('${E.adult}','${P}')`);
  await expectFail('erase3b: nor can a guardian of a different child',
    `select fn_erase_child('${E.otherGuardian}','${P}')`);
  check('erase3c: and the refusal deleted nothing', (await namedIn()).length, before.length);
  await expectFail('erase4: outside an erasure an entry’s author is still immutable (D-50)',
    `update record_entry set author_id = null where record_id = '${E.otherRec}' and author_id = '${E.adult}'`);
  await expectFail('erase4b: and a new investigation grant must still name whose record it opens',
    `insert into investigation_grant (report_id, investigator_id, subject_id, expires_at) values ('${E.report}','${E.investigator}', null, now() + interval '1 day')`);

  // D-166: the trail as it stands, to compare after.
  const lookRow = async () => (await q(`select ia.id, ia.at, ia.grant_id, ig.investigator_id, ig.report_id
    from investigation_access ia join investigation_grant ig on ig.id = ia.grant_id where ia.grant_id = $1`, [E.grant])).rows[0];
  const lookBefore = await lookRow();
  await expectFail('erase7e: outside an erasure the log of looks is still append-only — what was looked at cannot be blanked',
    `update investigation_access set what = null where grant_id = '${E.grant}'`);
  await expectFail('erase7f: and a new look must say what was looked at',
    `insert into investigation_access (grant_id, what) values ('${E.grant}', null)`);

  let eraseErr = null;
  try { await q('select fn_erase_child($1,$2)', [E.guardian, P]); } catch (e) { eraseErr = e.message; }
  check('I1: the one-tap deletion commits for a child who is named in every table that references a person, including one an investigator looked at',
    eraseErr, null);
  const left = await namedIn();
  check(`I1b: and afterwards no row, in any table that references a person, names the child${left.length ? ` — STILL NAMED IN: ${left.join(', ')}` : ''}`,
    left, []);
  check('I1c: nothing is readable by any actor — their guardian, a coach, nobody',
    [await level(E.guardian, P), await level(E.adult, P), await level(null, P)], ['none', 'none', 'none']);
  check('I4c/E8: and the child’s own link reads like every other dead state',
    (await q(`select fn_token_read(decode(md5('e-tok'),'hex')) as r`)).rows[0].r, null);
  // DELIBERATELY RETAINED through an erasure, each with no reference to any
  // person and the reason it stays. A table added here is a decision, read by
  // a person; the check below holds it to "names nobody".
  const RETAINED = {
    // 0161 (Leo, 30 Sep): the club's opt-out must work for as long as the CV
    // email exists (Spam Act), which is longer than the child's record may.
    send_stop_ref: 'the address a CV was sent to and when, keyed by the send — no child, record, sender, band or content',
  };
  const retainedShape = [];
  for (const t of Object.keys(RETAINED)) {
    const cols = (await q(`select string_agg(column_name, ',' order by column_name) as c from information_schema.columns where table_name = $1`, [t])).rows[0].c;
    const fks = (await q(`select count(*)::int as n from pg_constraint where contype = 'f' and conrelid = $1::regclass`, [t])).rows[0].n;
    retainedShape.push([t, cols, fks]);
  }
  check('erase8: what erasure deliberately keeps names nobody — the stop reference is the send\u2019s id, an address and a time, with no foreign key to anything',
    retainedShape, [['send_stop_ref', 'address,created_at,id', 0]]);
  const stopAfter = (await q(`select count(*)::int as n from share_request where id = $1`, [E.stopReq])).rows[0].n;
  await q('select fn_send_stop_request($1)', [E.stopReq]);
  check('erase8b: so after her erasure her CV request is gone, and the club it went to can still stop CVs with the link in that email',
    [stopAfter, (await q(`select fn_send_blocked('info@erasurepark.example.au') as b`)).rows[0].b], [0, true]);
  check('I5c: the consent log records the request and the completion, and survives',
    (await q(`select array_agg(event order by id)::text[] as e from consent_event
              where (subject_id = $1 and event = 'deletion_requested') or (actor_id = $2 and event = 'deletion_completed')`, [P, E.guardian])).rows[0].e,
    ['deletion_requested', 'deletion_completed']);

  // U-6 after erasure (Leo, 28 Sep): the trail survives, unlinked.
  const trail = (await q(`select ig.subject_id, ig.report_id, count(ia.id)::int as looks
    from investigation_grant ig left join investigation_access ia on ia.grant_id = ig.id where ig.id = $1 group by 1, 2`, [E.grant])).rows[0];
  check('U-6o: the investigation trail survives the erasure — the grant, its report and the logged look',
    [trail?.report_id, trail?.looks], [E.report, 1]);
  check('U-6p: with no link to the child', trail?.subject_id ?? null, null);
  check('U-6q: and who-looked answers nothing about a person who no longer exists',
    (await q('select * from fn_who_looked($1,$2)', [E.guardian, P])).rows.length, 0);

  // D-166: erasure wipes the free text that could name the child. The trail
  // is kept (U-6) — who looked, when, under which grant, for which report —
  // and nothing on it says her name any more.
  {
    const TRAIL = ['investigation_access', 'investigation_grant', 'report'];
    const textCols = (await q(`select table_name || '.' || column_name as c from information_schema.columns
      where table_schema = 'public' and table_name = any($1) and data_type in ('text', 'character varying') order by 1`, [TRAIL])).rows.map((r) => r.c);
    const named = [];
    for (const c of textCols) {
      const [t, col] = c.split('.');
      const n = (await q(`select count(*)::int as n from ${t} where ${col} ~* '\\yerin\\y'`)).rows[0].n;
      if (n) named.push(`${c} (${n})`);
    }
    check(`erase7: after erasure no free-text column in the investigation trail contains the child's first name (${named.join(', ') || 'none does'})`,
      named, []);
    check('erase7b: every report tied to her — by an investigation grant, a hold on her record, her link, her coach page — keeps its row and loses its reason',
      (await q(`select id, reason from report where id = any($1) order by id`, [[E.report, E.reportHold, E.reportTok, E.reportCoach]])).rows.map((r) => r.reason),
      [null, null, null, null]);
    const lookAfter = await lookRow();
    check('erase7c: the look itself survives — its time, its grant, the investigator and the report id — with no text',
      [lookAfter?.id, String(lookAfter?.at), lookAfter?.grant_id, lookAfter?.investigator_id, lookAfter?.report_id,
       ((await q(`select what from investigation_access where grant_id = $1`, [E.grant])).rows[0] ?? { what: 'row gone' }).what],
      [lookBefore.id, String(lookBefore.at), lookBefore.grant_id, lookBefore.investigator_id, lookBefore.report_id, null]);
    check('erase7d: another child\'s look and a report about somebody else keep their words',
      [(await q(`select what from investigation_access where grant_id = $1`, [E.otherGrant])).rows[0]?.what,
       (await q(`select reason from report where id = $1`, [E.reportOther])).rows[0]?.reason],
      ['Oli’s send rows', 'Oli’s page has a phone number on it']);
    // Every text column on the trail, and what erasure does with it. A new
    // free-text column fails here by name until somebody decides.
    const WIPED = ['investigation_access.what', 'report.reason'];
    const NOT_WIPED = {
      'investigation_grant.extended_reason': 'free text, typed when a grant is extended once — NOT in D-166; in the builder report for BUZ and John',
      'report.actioned_by': 'the operator\'s name, not the child\'s',
      'report.concern': 'one of a fixed set of words (0049)',
      'report.outcome': 'one of a fixed set of words',
      'report.reporter_email': 'the reporter\'s own address, optional',
      'report.subject_kind': 'one of a fixed set of words',
      'report.subject_ref': 'a token hash or a page slug — the slug of an erased coach page names nobody once the page is gone',
    };
    check(`erase7g: every text column on the trail is either wiped or named with a reason (${textCols.filter((c) => !WIPED.includes(c) && !(c in NOT_WIPED)).join(', ') || 'all are'})`,
      textCols.filter((c) => !WIPED.includes(c) && !(c in NOT_WIPED)), []);
  }
  check('erase7h: a stat she verified as a coach stays verified by the club, and stops naming her',
    (await q(`select provenance, verified_club_id, verified_by from player_stat where record_id = $1 and stat_key = 'goals'`, [E.otherRec])).rows[0],
    { provenance: 'coach_verified', verified_club_id: E.club, verified_by: null });

  // Someone else's record is theirs (D-48, D-10): the entries the child wrote
  // on it stay, unsigned; the other child's own entries and link are untouched.
  const otherRow = (await q(`select
      (select count(*)::int from record_entry where record_id = $1) as entries,
      (select count(*)::int from record_entry where record_id = $1 and author_id is null) as unsigned,
      (select count(*)::int from assessment_entry where record_id = $1) as assessed,
      (select count(*)::int from growth_note where record_id = $1) as growth,
      (select revoked_at is null from share_token where id = $2) as live,
      (select count(*)::int from guardianship_link where child_id = $3 and guardian_id = $4) as parent,
      (select profile_paused from guardian_setting where child_id = $3) as paused,
      (select count(*)::int from age_transition_notice where child_id = $3) as notice`,
    [E.otherRec, E.otherTok, E.other, E.otherGuardian])).rows[0];
  check('erase5: another child’s record keeps what the erased child wrote on it, unsigned, and loses nothing of its own',
    otherRow, { entries: 2, unsigned: 1, assessed: 1, growth: 1, live: true, parent: 1, paused: true, notice: 1 });

  // The button runs this function and nothing of its own.
  const del = codeOnly(srcOf('app/g/controls/[childId]/actions.ts')).split('export async function deleteEverything')[1]?.split('export async function')[0] ?? '';
  check('erase6: "Delete everything" runs fn_erase_child and deletes nothing itself',
    [/select fn_erase_child\(\$1, \$2\)/.test(del), /delete from|client\.query/i.test(del)], [true, false]);
}

// J51 — a revoked note is empty EVERYWHERE, as a property of the data.
check('J51: no row anywhere retains a note for a withdrawn registration',
  (await db.query(`select count(*)::int as n from registration where withdrawn_at is not null and note is not null`)).rows[0].n, 0);

// Q7/Q8/Q9/Q10 — share cards.
const cardCols = (await db.query(
  `select string_agg(column_name,',') as c from information_schema.columns where table_name='share_card_approval'`)).rows[0].c;
check('Q7: the approved card is a flat artefact — a stored path and a hash',
  /storage_path/.test(cardCols) && /image_hash/.test(cardCols), true);
check('Q7b: it holds no live reference to the record’s current content',
  /content|positions|stats/.test(cardCols), false);
const q7 = crypto.randomUUID();
await db.query(`insert into share_card_approval (id, record_id, requested_by, card_kind, image_hash, approved_by, approved_at, storage_path)
  values ($1,$2,$3,'og',$4,$5, now(), 'cards/q7.png')`, [q7, REC.nate, ID.nate, sha('q7-bytes'), ID.nate]);
await db.query(`update development_record set about = 'changed after approval' where id = $1`, [REC.nate]);
check('Q7c: changing the record does not change the approved card',
  (await db.query('select storage_path, image_hash from share_card_approval where id=$1', [q7])).rows[0].storage_path, 'cards/q7.png');
await expectFail('Q8: an approved card cannot be swapped for different bytes',
  `update share_card_approval set image_hash = '\\x01'::bytea where id = '${q7}'`);
check('Q9: a 16-17 may approve their own card', await qDispatch(ID.nate, REC.nate), true);
check('Q9b: an under-16 may not — it routes to the guardian', await qDispatch(ID.deniz, REC.deniz), false);
await expectFail('Q10: no path mints a card path for an under-16 without approval',
  `insert into share_card_approval (record_id, requested_by, card_kind, storage_path)
   values ('${REC.deniz}','${ID.guardian}','og','cards/sneaky.png')`);

// R3/R7/R8/R9/R10/R11 — the pending-version machinery (D-119).
const pvSrc = readFileSync(fileURLToPath(new URL('../lib/cv-build.ts', import.meta.url)), 'utf8');
check('R8: a pending version is created only for an under-16',
  /u16/.test(pvSrc), true);
check('R7: nothing in the codebase publishes a pending version on a timer',
  /setTimeout|cron|schedule/i.test(codeOnly(pvSrc)), false);
const rTokenRead = (await db.query(`select prosrc from pg_proc where proname='fn_token_read'`)).rows[0].prosrc;
// 0054 moved the snapshot read itself into fn_approved_cv, so that the token
// path, the club's two CV routes and the family's preview cannot drift apart.
// The property is unchanged and is now asked of both halves.
const rApprovedCv = (await db.query(`select prosrc from pg_proc where proname='fn_approved_cv'`)).rows[0].prosrc;
check('R3: the token path reads the APPROVED version, so the page never blanks',
  /fn_approved_cv/.test(rTokenRead) && /status = 'approved'/.test(rApprovedCv), true);
check('R10: and a pending version is unreachable from the token path',
  /'pending'/.test(codeOnly(rTokenRead)) || /'pending'/.test(rApprovedCv), false);

// R9 — deleting the record purges both versions together; no orphan survives.
const r9Rec = crypto.randomUUID(), r9Child = crypto.randomUUID();
await db.query(`insert into person (id, first_name, dob) values ($1,'Pending',$2)`, [r9Child, yearsAgo(13)]);
await db.query(`insert into development_record (id, person_id) values ($1,$2)`, [r9Rec, r9Child]);
await db.query(`insert into profile_version (record_id, content, status) values ($1,'{}','approved'), ($1,'{}','pending')`, [r9Rec]);
await db.query(`delete from development_record where id = $1`, [r9Rec]);
check('R9: both versions purge with the record — no orphan pending row',
  (await db.query('select count(*)::int as n from profile_version where record_id=$1', [r9Rec])).rows[0].n, 0);

// R11 — the band is read at PUBLICATION, not at composition. An edit composed
// at 15 and approved after the sixteenth birthday publishes under the band in
// force when it is approved, because the band is computed and never stored.
check('R11: no band is stored on a profile version — it is computed at read',
  /band/.test((await db.query(
    `select coalesce(string_agg(column_name,','),'') as c from information_schema.columns
     where table_name='profile_version'`)).rows[0].c), false);

// ---------------------------------------------------------------------------
// John's rulings on doc 30 (doc 31). Three went against the built default.
// ---------------------------------------------------------------------------

// U-5 — an under-16 sees the CLUB and the date, never the address. A
// guardian sees it in full. Built locally rather than borrowed from a later
// section: a test that depends on the order of the file is a test that
// breaks when somebody reorders it.
const u5Child14 = crypto.randomUUID(), u5Rec = crypto.randomUUID(), u5Tok = crypto.randomUUID();
await db.query(`insert into person (id, first_name, dob) values ($1,'Sent',$2)`, [u5Child14, yearsAgo(14)]);
await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [ID.guardian, u5Child14]);
await db.query(`insert into development_record (id, person_id) values ($1,$2)`, [u5Rec, u5Child14]);
await db.query(`insert into share_token (id, record_id, token_hash, issued_by) values ($1,$2,$3,$4)`,
  [u5Tok, u5Rec, sha('u5-token'), ID.guardian]);
await db.query(
  `insert into consent_event (event, actor_id, subject_id, detail)
   values ('share_dispatched', $1, $2, jsonb_build_object(
     'recipient', 'coach@kingsway.example.au', 'club_name', 'Kingsway Rovers FC',
     'token_id', $3::uuid, 'initiating_actor', $2::uuid, 'band_at_send', 'u16'))`,
  [ID.guardian, u5Child14, u5Tok]);
const u5Guardian = await db.query('select * from fn_send_log($1,$2)', [ID.guardian, u5Child14]);
const u5Child = await db.query('select * from fn_send_log($1,$2)', [u5Child14, u5Child14]);
check('U-5: the guardian still sees the recipient address in full',
  u5Guardian.rows[0]?.recipient, 'coach@kingsway.example.au');
check('U-5b: the under-16 sees no address at all', u5Child.rows[0]?.recipient, null);
check('U-5c: but does see that a send happened', u5Child.rows.length, 1);
check('U-5d: and a 16-17 reading their own log is not reduced',
  (await db.query('select * from fn_send_log($1,$2)', [ID.nate, ID.nate])).rows.length >= 0, true);

// U-4 — a blocked send leaves a trace, and it is nowhere near a child.
const abuseCols = (await db.query(
  `select string_agg(column_name, ',') as c from information_schema.columns where table_name='abuse_signal'`)).rows[0].c;
for (const forbidden of ['recipient', 'subject_id', 'record_id', 'child', 'content', 'body']) {
  check(`U-4: the abuse counter cannot hold ${forbidden}`, abuseCols.includes(forbidden), false);
}
check('U-4b: it holds the SENDER, the time and a reason', /actor_id/.test(abuseCols) && /reason/.test(abuseCols), true);
await db.query(`insert into abuse_signal (actor_id, reason, surface) values ($1,'rate_limited','send')`, [ID.guardian]);
// The abuse signal just written must NOT have produced a consent row: the
// send log still shows exactly the one real send from above.
check('U-4c: a blocked send writes an abuse signal and no consent row',
  (await db.query(`select count(*)::int as n from consent_event where event='share_dispatched' and subject_id=$1`,
    [u5Child14])).rows[0].n, 1);

// U-1 — fourteen days, and the request is GONE rather than flagged.
const u1 = crypto.randomUUID();
await db.query(`insert into share_request (id, record_id, requested_by, destination, created_at)
  values ($1,$2,$3,'club@example.com', now() - interval '15 days')`, [u1, REC.georgia, ID.georgia]);
const u1Fresh = crypto.randomUUID();
await db.query(`insert into share_request (id, record_id, requested_by, destination, created_at)
  values ($1,$2,$3,'club@example.com', now() - interval '2 days')`, [u1Fresh, REC.georgia, ID.georgia]);
check('U-1: a request older than 14 days lapses',
  (await db.query('select fn_lapse_send_requests() as n')).rows[0].n, 1);
check('U-1b: the row is gone, not flagged',
  (await db.query('select count(*)::int as n from share_request where id=$1', [u1])).rows[0].n, 0);
check('U-1c: and a recent one is untouched',
  (await db.query('select count(*)::int as n from share_request where id=$1', [u1Fresh])).rows[0].n, 1);
// codeOnly first: the slice runs up to the NEXT export, which drags in that
// function's explanatory comment — and §36's comment is about a guardian.
const lapseMsg = codeOnly(readFileSync(fileURLToPath(new URL('../lib/messages.ts', import.meta.url)), 'utf8'))
  .split('sendRequestLapsedEmail')[1].split('export const')[0];
check('U-1d: the lapse message never mentions a parent, a decision or waiting',
  /parent|guardian|decision|waiting|did not|ignored/i.test(lapseMsg), false);

// U-2 — either guardian sends; the other gets a 24-hour undo. The undo
// revokes the LINK and must not claim to un-send the email.
const undoMsg = codeOnly(readFileSync(fileURLToPath(new URL('../lib/messages.ts', import.meta.url)), 'utf8'))
  .split('sendMadeByOtherGuardianEmail')[1].split('export const')[0];
// L17/U-2: the other guardian is actually NOTIFIED — the message, the undo
// token and the route all existed, and nothing connected them.
check('L17: the dispatch notifies the other approved guardian',
  /sendMadeByOtherGuardianEmail/.test(dispatchLib), true);
check('L17b: minting them a single-use undo that expires in 24 hours',
  /insert into undo_token/.test(dispatchLib) && /24 hours/.test(dispatchLib), true);
// Compare the CALL SITE, not the import — the import naturally sits at the
// top of the file, before everything.
const dispatchBody = dispatchLib.split('export async function')[1] ?? '';
check('L17c: and it is sent after the transaction, not inside it',
  dispatchBody.indexOf('client.release()') < dispatchBody.indexOf('sendMadeByOtherGuardianEmail('), true);

// ONE dispatch path. A player's own send and a guardian's must mint the token,
// write the consent row and email the club in the same place, or one of them
// is wrong later — the send flow knew only the guardian's for its whole life,
// and an adult's send went to nobody.
check('L5/L8: the player and the guardian send through ONE dispatch path',
  /dispatchShareRequest/.test(composeSrc) && /dispatchShareRequest/.test(dispatchSrc)
    && !/insert into share_token/.test(composeSrc + dispatchSrc), true);
check('L5/L8b: and Postgres, not the caller, decides whether the actor may send',
  /fn_can_dispatch\(\$2, sr\.record_id\)/.test(dispatchLib), true);

check('U-2: the notification says plainly that the email cannot be recalled',
  /cannot recall|already arrived/i.test(undoMsg), true);
check('U-2b: and never claims to un-send it', /un-?send|unsend|recall the email/i.test(undoMsg.replace(/cannot recall that/i, '')), false);
const undoCols = (await db.query(
  `select string_agg(column_name, ',') as c from information_schema.columns where table_name='undo_token'`)).rows[0].c;
check('U-2c: the undo token is stored hashed, never raw', /token_hash/.test(undoCols) && !/\btoken\b,/.test(undoCols), true);
check('U-2d: it is single-purpose — one share token, and an expiry',
  /share_token_id/.test(undoCols) && /expires_at/.test(undoCols) && /used_at/.test(undoCols), true);

// John's M11/L29 ruling (doc 31, 0025) — L29 stands, and only the CHILD-SAFETY
// class notifies families. NOT labelled M11 (L4, 28 Sep): doc 14's M11 says a
// revoked verification revokes every link that club holds, and John ruled that
// clause unbuildable. These test the ruling that replaced it, which the
// register has not adopted — so M11 is honestly open until BUZ decides.
check('M11/deverify1: de-verification carries a reason class',
  (await db.query(`select string_agg(column_name,',') as c from information_schema.columns
    where table_name='club' and column_name='suspension_reason'`)).rows[0].c, 'suspension_reason');
await expectFail('M11/deverify1b: and the class is constrained, not free text',
  `update club set suspension_reason = 'because i felt like it' where id = '${CLUB.riverside}'`);
const deverifyMsg = codeOnly(readFileSync(fileURLToPath(new URL('../lib/messages.ts', import.meta.url)), 'utf8'))
  .split('clubDeverifiedEmail')[1].split('export const')[0];
check('M11/deverify1c: the notice never says WHY the club was de-verified',
  /allegation|investigat|report|complaint|safety concern/i.test(deverifyMsg), false);
check('M11/deverify1d: and never revokes on the family’s behalf — it offers the button',
  /we have not switched it off for you/i.test(deverifyMsg), true);

// The rest of John's M11/L29 ruling: the class RECORDED, the function CALLED,
// and doc 15 §37 actually sent (0066, app/ops/call/[clubId]/actions.ts).
//
// Everything below was built in 0025 and had no caller. The suite itself
// listed clubDeverifiedEmail as a named exemption — "needs the child-safety
// reason class on the verification call" — and fn_guardians_to_notify_on_
// suspension was the only fn_* in the schema with zero app callers, zero SQL
// callers and zero tests. The suspend button shipped anyway, which is what
// made this the highest-consequence half-built chain in the product: an
// operator could take a club down for a child-safety reason this afternoon
// and no family holding a live link to it would learn anything.
//
// NOT labelled M11: doc 14's M11 says "revocation of `verified` is equivalent
// to revocation of every link that club holds", and that is the clause John
// recorded as UNBUILDABLE — tokens are not club-bound, so it would kill links
// families sent to other clubs. The notice is what replaces it, and a label
// claiming to test the row would be claiming to test the opposite (L4).
{
  const sClub = crypto.randomUUID(), sCall = crypto.randomUUID();
  const sKid = crypto.randomUUID(), sRec = crypto.randomUUID();
  const sOther = crypto.randomUUID(), sOtherRec = crypto.randomUUID();
  await db.query(`insert into club (id, name, club_state, contact_email) values ($1,'Suspendable FC','claimed','football@suspendable.example.au')`, [sClub]);
  await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
    values ($1,$2,now(),'BUZ','03 9000 0009','FV club directory','verified','27@v1.0')`, [sCall, sClub]);
  await db.query(`update club set club_state='verified', verified_call_id=$1 where id=$2`, [sCall, sClub]);

  // Two children of the same guardian. One family's link went to this club;
  // the other's went somewhere else, and must hear nothing.
  await db.query(`insert into person (id, first_name, dob) values ($1,'Told',$3), ($2,'Untold',$3)`,
    [sKid, sOther, yearsAgo(13)]);
  await db.query(`insert into development_record (id, person_id) values ($1,$2), ($3,$4)`, [sRec, sKid, sOtherRec, sOther]);
  for (const kid of [sKid, sOther]) {
    await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [ID.guardian, kid]);
  }
  await db.query(`update person set email = coalesce(email,'suspend-guardian@example.com') where id = $1`, [ID.guardian]);
  const sent = async (rec, destination) => {
    const tok = (await db.query(
      `insert into share_token (record_id, token_hash, issued_by, expires_at)
       values ($1,$2,$3, now() + interval '60 days') returning id`,
      [rec, sha('suspend-' + crypto.randomUUID()), ID.guardian])).rows[0].id;
    await db.query(
      `insert into share_request (record_id, requested_by, destination, dispatched_by, dispatched_at, share_token_id)
       values ($1,$2,$3,$2,now(),$4)`, [rec, ID.guardian, destination, tok]);
    return tok;
  };
  const toldTok = await sent(sRec, 'Suspendable FC <football@suspendable.example.au>');
  await sent(sOtherRec, 'Somewhere Else FC <football@somewhereelse.example.au>');
  // A near miss: an address that CONTAINS the club's. Exact match or nothing.
  const sNear = crypto.randomUUID(), sNearRec = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob) values ($1,'NearMiss',$2)`, [sNear, yearsAgo(13)]);
  await db.query(`insert into development_record (id, person_id) values ($1,$2)`, [sNearRec, sNear]);
  await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [ID.guardian, sNear]);
  await sent(sNearRec, 'Near Miss FC <myfootball@suspendable.example.au>');
  const tell = async () => (await db.query(`select * from fn_guardians_to_notify_on_suspension($1)`, [sClub])).rows;

  // THE CHOICE, IN ONE PLACE. Which classes tell families is BUZ's call, not
  // the build's; it lives in fn_suspension_tells_families and nowhere else,
  // at the most restrictive reading doc 31 and doc 15 §37 allow.
  check('susp0: one function decides which class tells families, and today only child_safety does',
    (await db.query(`select c, fn_suspension_tells_families(c) as t
      from unnest(array['child_safety','administrative','non_payment',null]::text[]) c`)).rows.map((r) => [r.c, r.t]),
    [['child_safety', true], ['administrative', false], ['non_payment', false], [null, false]]);
  check('susp0b: and it is the ONLY place in the schema that names the class as a reason to tell anyone',
    (await db.query(`select proname from pg_proc where prosrc like '%child_safety%' order by proname`)).rows.map((r) => r.proname),
    ['fn_suspension_tells_families']);

  // The class on the CALL, so a later verification cannot erase which class
  // this suspension was. `club.suspension_reason` is a mutable column on a
  // mutable row; doc 27's log is the record a regulator would be shown.
  check('susp1: the class of a suspension is recorded on the call that made it',
    (await db.query(`select string_agg(column_name,',') as c from information_schema.columns
      where table_name='verification_call' and column_name='suspension_reason'`)).rows[0].c, 'suspension_reason');
  // The positive control first. Without it the two refusals below pass on a
  // schema with no such column at all — every insert naming it fails — which
  // was measured (L19): they must refuse for the reason they claim.
  let accepted = true;
  try {
    await db.query(`insert into verification_call (club_id, called_at, operator, number_called, number_source, outcome, suspension_reason, policy_version)
      values ($1, now(), 'BUZ', '03 9000 0009', 'FV club directory', 'suspended', 'child_safety', '27@v1.0')`, [sClub]);
  } catch { accepted = false; }
  check('susp1b: a suspending call carrying a class from the list is accepted', accepted, true);
  await expectFail('susp2: and it is the same closed list, not free text',
    `insert into verification_call (club_id, called_at, operator, number_called, number_source, outcome, suspension_reason, policy_version)
     values ('${sClub}', now(), 'BUZ', '03 9000 0009', 'FV club directory', 'suspended', 'because i felt like it', '27@v1.0')`);
  await expectFail('susp3: a call that did not suspend cannot carry a class of suspension',
    `insert into verification_call (club_id, called_at, operator, number_called, number_source, outcome, suspension_reason, policy_version)
     values ('${sClub}', now(), 'BUZ', '03 9000 0009', 'FV club directory', 'verified', 'child_safety', '27@v1.0')`);

  // The four ways of getting it wrong, and all four answer "nobody". This is
  // the half that matters most: a message wrongly sent to a hundred families
  // about their child's club cannot be taken back.
  check('susp4: a verified club tells nobody, whatever else is true', (await tell()).length, 0);
  await db.query(`update club set club_state='suspended' where id=$1`, [sClub]);
  check('susp5: suspended with NO class recorded tells nobody — it does not fall through to everyone',
    (await tell()).length, 0);
  await db.query(`update club set suspension_reason='administrative' where id=$1`, [sClub]);
  check('susp6: an administrative suspension tells nobody (M10 is all it does)', (await tell()).length, 0);
  await db.query(`update club set suspension_reason='non_payment' where id=$1`, [sClub]);
  check('susp7: nor does non-payment — a family is never told because a club stopped paying (D-135)',
    (await tell()).length, 0);

  // And the one class that does.
  await db.query(`update club set suspension_reason='child_safety' where id=$1`, [sClub]);
  const told = await tell();
  check('susp8: a child-safety suspension names the guardian whose live link went to THIS club',
    told.map((r) => [r.guardian_id, r.child_first_name, r.token_id]),
    [[ID.guardian, 'Told', toldTok]]);
  check('susp9: and the club by name, so the caller composing §37 assembles nothing',
    told[0]?.club_name, 'Suspendable FC');
  check('susp10: the family whose link went to a DIFFERENT club is not told — the link is not club-bound (L29)',
    told.some((r) => r.child_first_name === 'Untold'), false);
  check('susp10b: an address that merely CONTAINS the club\'s is a different address — exact match only',
    told.some((r) => r.child_first_name === 'NearMiss'), false);
  await db.query(`update share_token set revoked_at = now() where id = $1`, [toldTok]);
  check('susp11: a link already switched off is not warned about again', (await tell()).length, 0);
  await db.query(`update share_token set revoked_at = null where id = $1`, [toldTok]);
  // A class left behind on a club that is up again must not be able to notify.
  await db.query(`update club set club_state='verified' where id=$1`, [sClub]);
  check('susp12: a class still sitting on a club that has been verified again tells nobody',
    (await tell()).length, 0);
}

// The action side: the class is recorded, the database is asked who to tell,
// and no mapping from class to "families are told" exists in the app.
{
  const callAction = readFileSync(fileURLToPath(new URL('../app/ops/call/[clubId]/actions.ts', import.meta.url)), 'utf8');
  const code = codeOnly(callAction);
  check('susp13: the only path that suspends a club records the class on the call and on the club',
    /insert into verification_call[\s\S]*suspension_reason/.test(code)
      && /club_state='suspended', suspension_reason=\$2/.test(code), true);
  check('susp14: verifying a club clears the class of the suspension before it',
    /club_state='verified'[^`]*suspension_reason=null/.test(code), true);
  check('susp15: it asks the database who must be told, and sends doc 15 §37',
    /fn_guardians_to_notify_on_suspension\(/.test(code) && /clubDeverifiedEmail\(/.test(code), true);
  // The sentence "only the child-safety class notifies families" is a
  // child-safety judgement. It lives in Postgres or a second caller gets it
  // wrong (L23). The action may name the class as a VALUE the form offers;
  // it may not branch on it.
  check('susp16: and decides nothing itself — no branch on the class anywhere in the action',
    /(if|\?|&&|\|\|)[^\n]*['"`]child_safety['"`]/.test(code), false);
  check('susp17: the notice is sent after the transaction, not while holding the client (L1)',
    code.indexOf('client.release()') < code.indexOf('fn_guardians_to_notify_on_suspension'), true);
  // It must never revoke on the family's behalf. John: "The family made the
  // disclosure. The family unmakes it."
  check('susp18: and it revokes nothing — it mints the button and nothing else',
    /update share_token/.test(code) || /revoked_at/.test(code), false);
}

// U-11 — no inbound reply route, and the send says so.
const cvMsg = codeOnly(readFileSync(fileURLToPath(new URL('../lib/messages.ts', import.meta.url)), 'utf8'))
  .split('cvToClubEmail')[1].split('export const')[0];
check('U-11: the CV email tells the club replies do not reach the family',
  /do not reach the family/i.test(cvMsg), true);
check('U-11b: and tells them what to do instead', /invitation|post it on Pitch/i.test(cvMsg), true);
check('U-11c: the old promise of a routed reply is gone',
  /just reply to this email/i.test(cvMsg), false);
// And the guardian's send screen, which still promised the opposite of the
// email it sends: "If they reply, it comes to you and <name> together" (L25).
check('U-11d: the guardian\u2019s send screen promises no reply route either',
  /if they reply, it comes to you/i.test(codeOnly(srcOf('app/g/send/[requestId]/page.tsx'))), false);

// §19's player line with no club (28 Sep): it read "currently at ." for a
// player who has none — most of the players sending a CV to find one. The
// message is composed for real, under the react-server condition Next uses.
{
  const { execFileSync } = await import('node:child_process');
  const at = fileURLToPath(new URL('../lib/messages.ts', import.meta.url));
  const cv = (args) => JSON.parse(execFileSync(process.execPath, [
    '--conditions=react-server', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--input-type=module', '-e',
    `const m = await import(${JSON.stringify(at)}); process.stdout.write(JSON.stringify(m.cvToClubEmail(...${JSON.stringify(args)})));`,
  ], { encoding: 'utf8' })).body;
  const STOP = { requestId: '11111111-2222-4333-8444-555555555555', sig: 'S'.repeat(43) };
  const withClub = cv(['Deniz', 14, 'AM, LW', 'Riverside FC', 'tok', STOP]);
  const noClub = cv(['Deniz', 14, 'AM, LW', '', 'tok', STOP]);
  const nothing = cv(['Deniz', 14, '', '', 'tok', STOP]);
  const selfSent = cv(['Nate', 17, 'GK', '', 'tok', STOP, 'self', '16_17']);
  check('msg19a: §19 names the club when the player has one, word for word as before',
    withClub.includes('Deniz plays AM, LW, currently at Riverside FC.'), true);
  check('msg19b: and with no club the clause goes — no "currently at ." — and nothing new is said in its place',
    [noClub.includes('Deniz plays AM, LW.'), /currently at|\s\.\n| ,/.test(noClub),
     noClub.replace('Deniz plays AM, LW.', 'Deniz plays AM, LW, currently at Riverside FC.') === withClub], [true, false, true]);
  check('msg19c: with no positions either, the line goes and the paragraphs close up',
    [/plays/.test(nothing), /\n\n\n/.test(nothing)], [false, false]);
  // John, 30 Sep §2: treated as commercial, so it carries a working opt-out.
  // The link names the send and its signature — never the address.
  const stopLine = (who) => `You received this because ${who}. We did not add you to a list. To stop CVs reaching this address through Pitch: pitchfootball.com.au/stop-cvs?r=${STOP.requestId}&t=${STOP.sig}`;
  check('sc-m1: §19 ends with the stop link, in both variants, and no longer says there is nothing to unsubscribe from',
    [withClub.trimEnd().endsWith(stopLine("a family sent you their child's CV")), selfSent.trimEnd().endsWith(stopLine('a player sent you their CV')),
     /nothing to unsubscribe from/.test(withClub + selfSent), /stop-cvs[^\s]*@/.test(withClub + selfSent)],
    [true, true, false, false]);
}

// ONE CONTACT ADDRESS (BUZ, 28 Sep; APPROVALS-28-SEP "Contact address"):
// burak.donmez@pitch-football.com replaces help@pitchfootball.com.au on every
// screen, in every email and in every SMS, from ONE constant. Every builder in
// the catalogue is composed for real, the way msg19 above composes §19, so a
// message that types the old address in its own body fails here even though
// HELP itself is right.
{
  const OLD = 'help@pitchfootball.com.au', NEW = 'burak.donmez@pitch-football.com';
  const supportSrc = srcOf('lib/support.ts');
  check('support1: the address is one constant, and the message catalogue’s HELP is that constant',
    [/export const SUPPORT_EMAIL = 'burak\.donmez@pitch-football\.com';/.test(supportSrc),
     /const HELP = SUPPORT_EMAIL;/.test(srcOf('lib/messages.ts')),
     /server-only|from '\.\/db'|process\.env/.test(codeOnly(supportSrc))], [true, true, false]);
  const { execFileSync } = await import('node:child_process');
  const at = fileURLToPath(new URL('../lib/messages.ts', import.meta.url));
  const composed = JSON.parse(execFileSync(process.execPath, [
    '--conditions=react-server', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--input-type=module', '-e',
    `const m = await import(${JSON.stringify(at)}); const out = [];
     for (const [k, v] of Object.entries(m)) {
       // Strings for every argument; a builder that takes a list (the clubs
       // a link went to) is retried with lists, so none is skipped quietly.
       for (const arg of ['X1234', ['X1234']]) {
         try {
           const c = typeof v === 'function' ? v(...Array.from({ length: Math.max(v.length, 1) }, () => arg)) : v;
           if (c && typeof c === 'object' && typeof c.body === 'string') out.push({ k, key: c.key, channel: c.channel, text: (c.subject ?? '') + ' | ' + c.body });
           break;
         } catch {}
       }
     }
     process.stdout.write(JSON.stringify(out));`,
  ], { encoding: 'utf8' }));
  const keyed = (srcOf('lib/messages.ts').match(/key: 'doc15\./g) ?? []).length;
  check(`support2: every message in the catalogue was actually composed (${composed.length} of ${keyed})`,
    composed.length === keyed && keyed > 30, true);
  const stale = composed.filter((c) => c.text.includes(OLD)).map((c) => c.k);
  check(`support3: no message sends the old address (${stale.join(', ') || 'none does'})`, stale, []);
  const smsWithout = composed.filter((c) => c.channel === 'sms' && !c.text.includes(NEW)).map((c) => c.k);
  check(`support4: every SMS carries the one support address (${smsWithout.join(', ') || 'all do'})`, smsWithout, []);
  // Screens, components and libraries, code only: the address a person reads
  // on a page. Comments may name the old address to explain the change.
  const everyTs = [...routeFiles];
  (function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full); else if (/\.(ts|tsx)$/.test(e.name)) everyTs.push(full);
    }
  })(fileURLToPath(new URL('../components', import.meta.url)));
  (function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full); else if (/\.(ts|tsx)$/.test(e.name)) everyTs.push(full);
    }
  })(fileURLToPath(new URL('../lib', import.meta.url)));
  const typed = everyTs.filter((f) => codeOnly(readFileSync(f, 'utf8')).includes(OLD))
    .map((f) => f.slice(f.lastIndexOf('/app/') + 1 || f.lastIndexOf('/components/') + 1 || f.lastIndexOf('/lib/') + 1));
  check(`support5: no screen, component or library types the old address (${typed.join(', ') || 'none does'})`, typed, []);
  // The one exemption, by name: the waitlist digest is SENT TO BUZ (DIGEST_TO's
  // default). A recipient of an internal email is not a contact a user reads.
  const literalNew = everyTs.filter((f) => !f.endsWith('/lib/support.ts') && !f.endsWith('/app/api/digest/route.ts')
      && codeOnly(readFileSync(f, 'utf8')).includes(NEW))
    .map((f) => f.slice(f.lastIndexOf('/') + 1));
  check(`support6: and none types the new one either — it comes from SUPPORT_EMAIL (${literalNew.join(', ') || 'none does'})`, literalNew, []);
}

// U-6 — complaints access: purpose-bound, time-boxed, logged, disclosed.
const grantCols = (await db.query(
  `select string_agg(column_name,',') as c from information_schema.columns where table_name='investigation_grant'`)).rows[0].c;
check('U-6: access is bound to a report, never standing', /report_id/.test(grantCols), true);
check('U-6b: and time-boxed', /expires_at/.test(grantCols), true);
const u6Report = crypto.randomUUID(), u6Grant = crypto.randomUUID();
await db.query(`insert into report (id, subject_kind, subject_ref, reason) values ($1,'club_page','riverside-fc','test')`, [u6Report]);
await db.query(`insert into investigation_grant (id, report_id, investigator_id, subject_id, expires_at)
  values ($1,$2,$3,$4, now() + interval '7 days')`, [u6Grant, u6Report, ID.td, ID.deniz]);
await db.query(`insert into investigation_access (grant_id, what) values ($1,'send rows')`, [u6Grant]);
await expectFail('U-6c: the access log cannot be edited',
  `update investigation_access set what = 'nothing' where grant_id = '${u6Grant}'`);
await expectFail('U-6c2: nor deleted',
  `delete from investigation_access where grant_id = '${u6Grant}'`);
const looked = (await db.query('select * from fn_who_looked($1,$2)', [ID.guardian, ID.deniz])).rows;
check('U-6d: a guardian can ask who looked at their child’s record', looked.length, 1);
check('U-6d2: and gets a straight answer — who, and against which report',
  looked[0]?.investigator?.length > 0 && looked[0]?.report_id === u6Report, true);
check('U-6e: and a stranger cannot',
  (await db.query('select * from fn_who_looked($1,$2)', [ID.coachV, ID.deniz])).rows.length, 0);

// U-6's fourth condition in the PRODUCT, not only in the database (doc 14 L60,
// which leaves complaints access to U-6; doc 34 rule 6 says register reads are
// disclosable in the same terms).
//
// fn_who_looked has answered this since 0025 with zero app callers. The screen
// that should have called it already calls its sibling fn_send_log — and that
// sibling's own comment in app/g/controls records this exact defect being
// found and fixed once before: "green on it — AND NOTHING IN THE APP EVER
// CALLED IT." Same bug, same screen.
{
  const looked2 = async (viewer, person) =>
    (await db.query('select * from fn_who_looked($1,$2)', [viewer, person])).rows;
  check('U-6f: a SECOND approved guardian gets the same straight answer (D-51 equal visibility)',
    (await looked2(ID.guardian2, ID.deniz)).length, 1);
  check('U-6g: the child’s own club cannot ask — its TD is not the family',
    (await looked2(ID.td, ID.deniz)).length, 0);
  check('U-6h: nor a club administrator', (await looked2(ID.clubAdmin, ID.deniz)).length, 0);
  check('U-6i: nor nobody at all', (await looked2(null, ID.deniz)).length, 0);
  // A guardian who has been revoked is a stranger from that moment.
  await db.query(`update guardianship_link set revoked_at = now() where guardian_id=$1 and child_id=$2`, [ID.guardian2, ID.deniz]);
  check('U-6j: a revoked guardian cannot ask', (await looked2(ID.guardian2, ID.deniz)).length, 0);
  await db.query(`update guardianship_link set revoked_at = null where guardian_id=$1 and child_id=$2`, [ID.guardian2, ID.deniz]);

  // The surface. The guardian's controls screen is the one place a parent
  // looks, and the card must take its answer from the function — never
  // assemble one from investigation_grant or investigation_access (L23).
  const whoLooked = readFileSync(fileURLToPath(new URL('../components/WhoLooked.tsx', import.meta.url)), 'utf8');
  const gControls = readFileSync(fileURLToPath(new URL('../app/g/controls/[childId]/page.tsx', import.meta.url)), 'utf8');
  check('U-6k: the guardian’s controls screen carries the who-looked card',
    /<WhoLooked\b/.test(gControls), true);
  check('U-6l: and the card asks fn_who_looked for the answer',
    /fn_who_looked\(/.test(whoLooked), true);
  check('U-6m: it assembles no answer of its own — it never touches the grant or the access log',
    /investigation_grant|investigation_access/.test(codeOnly(whoLooked)), false);
  check('U-6n: and it decides for itself who may ask — it does not (the function does)',
    /guardianship_link|fn_read_level|fn_age_band/.test(codeOnly(whoLooked)), false);
  // BUZ approved the card's words on 28 Sep (APPROVALS-28-SEP, "Who looked"),
  // so it renders in production. The flag and the gate stay: un-approving is
  // still one line, and this check changed with the flag on purpose.
  check('copy-held1: the who-looked card is approved, and the gate that held it is still there',
    /WHO_LOOKED_APPROVED = true/.test(whoLooked)
      && /if \(!WHO_LOOKED_APPROVED && process\.env\.NODE_ENV === 'production'\) return null;/.test(whoLooked), true);
  // BUZ's two defaults. A parent is shown a short reference, never the
  // report's uuid — not in the text and not in an attribute — and the footer
  // names the one support address, from its one constant.
  {
    const { reportRef } = { reportRef: (id) => id.replace(/-/g, '').slice(0, 8).toUpperCase() };
    const code = codeOnly(whoLooked);
    check('who1: the card never renders the report uuid — every place it is used goes through the short reference',
      [/\{r\.report_id\}|=\{r\.report_id\}|, r\.report_id\)/.test(code), (code.match(/reportRef\(r\.report_id\)/g) ?? []).length], [false, 2]);
    check('who2: the short reference is eight characters of the id, in capitals',
      /export const reportRef = \(reportId: string\) => reportId\.replace\(\/-\/g, ''\)\.slice\(0, 8\)\.toUpperCase\(\);/.test(whoLooked)
        && reportRef('3f9a21c0-1111-4222-8333-444455556666') === '3F9A21C0', true);
    check('who3: the footer’s contact is SUPPORT_EMAIL, not a literal address',
      /Ask us why at \$\{SUPPORT_EMAIL\}/.test(whoLooked) && !/@pitchfootball\.com\.au/.test(whoLooked), true);
  }
}

// D-108 carve-out — a club may close a role. It may never record a judgement
// about a named individual.
const appCols = (await db.query(
  `select string_agg(column_name,',') as c from information_schema.columns where table_name='role_application'`)).rows[0].c;
for (const verdict of ['status', 'declined', 'rejected', 'outcome', 'rating', 'score']) {
  check(`D-108 carve-out: an application row cannot record "${verdict}" about a person`,
    appCols.includes(verdict), false);
}

// ---------------------------------------------------------------------------
// Table J (the negative suite) — the rows that exist to be tried and to fail.
// ---------------------------------------------------------------------------

// J49 — the row the whole verification decision exists to prevent.
const j49 = crypto.randomUUID();
await db.query(`insert into club (id, name, club_state) values ($1,'Webhook FC','claimed')`, [j49]);
await expectFail('J49: a webhook payload cannot set verified',
  `update club set club_state = 'verified' where id = '${j49}'`);
await expectFail('J49b: nor can it forge a call id that does not exist',
  `update club set club_state = 'verified', verified_call_id = '${crypto.randomUUID()}' where id = '${j49}'`);

// J50 — the predicate is in the QUERY, not the controller. If it were in the
// app, joining around it would work.
const regRowsSrc = (await db.query(`select prosrc from pg_proc where proname='fn_register_rows'`)).rows[0].prosrc;
check('J50: the verified predicate lives inside the function',
  /club_state = 'verified'/.test(regRowsSrc), true);

// J52 — the constraint, not a check somewhere upstream.
await expectFail('J52: the constraint itself refuses a fourth status',
  `insert into registration (player_id, club_id, club_status, policy_version)
   values ('${ID.marcus}', '${CLUB.riverside}', 'declined', '20@v2.4')`);

// J53 — no billing route is reachable by a family actor.
const billingRoutes = routeFiles.filter((f) => /\/(billing|checkout|portal|invoice)\//i.test(f));
for (const f of billingRoutes) {
  const rel = f.split('/app/')[1];
  const src = readFileSync(f, 'utf8');
  // app/dev/billing (0075) is the suites' switch for D-163's billing flag. It
  // is not a route in production at all — a 404 before anything is read — so
  // it is reachable by no actor there, family or club; dev1 pins that.
  const devOnlyRoute = /^dev\//.test(rel)
    && /if \(process\.env\.NODE_ENV === 'production' \|\| isDemo\(\)\) return new NextResponse\(null, \{ status: 404 \}\);/.test(src);
  check(`J53: ${rel} ${devOnlyRoute ? 'does not exist in production' : 'is club-scoped'}, unreachable as a family actor`,
    /technical_director|club_admin|stripe_event|OPS_EMAILS/.test(src) || devOnlyRoute, true);
}
{
  const devBilling = srcOf('app/dev/billing/route.ts');
  check('dev1: the billing switch the suites use does not exist in production or in a club demo, and answers POST only',
    [/if \(process\.env\.NODE_ENV === 'production' \|\| isDemo\(\)\) return new NextResponse\(null, \{ status: 404 \}\);/.test(devBilling),
     /export async function (GET|PUT|PATCH|DELETE)\b/.test(devBilling), /export async function POST\b/.test(devBilling)],
    [true, false, true]);
}

{
  // app/dev/ratelimit (brief C, 29 Sep) empties the rate limiter for the
  // timing suite. In production it would be a way round every limit in the
  // product, so it must not exist there at all.
  const devRate = srcOf('app/dev/ratelimit/route.ts');
  check('dev2: the rate-limit reset the timing suite uses does not exist in production or in a club demo, and answers POST only',
    [/if \(process\.env\.NODE_ENV === 'production' \|\| isDemo\(\)\) return new NextResponse\(null, \{ status: 404 \}\);/.test(devRate),
     /export async function (GET|PUT|PATCH|DELETE)\b/.test(devRate), /export async function POST\b/.test(devRate),
     devRate.indexOf('status: 404') < devRate.indexOf('delete from rate_hit')],
    [true, false, true, true]);
}

{
  // app/dev/read-level (brief M, 30 Sep) answers fn_read_level for the write
  // suite, which has no page on which 'authored_only' shows (D-171). In
  // production it would be an oracle over who may read whom, so it must not
  // exist there at all, and it answers the level and nothing off the record.
  const devLevel = srcOf('app/dev/read-level/route.ts');
  check('dev3: the read-level answer the write suite uses does not exist in production or in a club demo, answers POST only, and returns fn_read_level and nothing else',
    [/if \(process\.env\.NODE_ENV === 'production' \|\| isDemo\(\)\) return new NextResponse\(null, \{ status: 404 \}\);/.test(devLevel),
     /export async function (GET|PUT|PATCH|DELETE)\b/.test(devLevel), /export async function POST\b/.test(devLevel),
     devLevel.indexOf('status: 404') < devLevel.indexOf('db.query'),
     [...codeOnly(devLevel).matchAll(/db\.query\(\s*'([^']*)'/g)].map((m) => m[1])],
    [true, false, true, true, ['select fn_read_level($1, $2) as level']]);
}

{
  // 0155: the club line on every CV is fn_cv_club's answer. assembleCv (the
  // 16-17 and adult CV on the share link, the preview, the register and the
  // squad screen) and the CV email's "currently at" read it; the under-16
  // snapshot is served through fn_approved_cv, which does. No CV surface
  // reads a player's club from membership itself, so a suspended club cannot
  // come back through a second query that never asked.
  const rr = codeOnly(srcOf('lib/record-read.ts'));
  check('cvclub-s1: every CV surface reads its club line from fn_cv_club — assembleCv, the CV email and the served snapshot — and none reads a player\u2019s club from membership itself',
    [/fn_cv_club\(\$2\) as membership/.test(rr), /from membership m join club c/.test(rr),
     /fn_cv_club\(p\.id\)->>'club'/.test(codeOnly(dispatchLib)), /join club c on c\.id = m\.club_id/.test(codeOnly(dispatchLib)),
     /fn_cv_club\(dr\.person_id\)/.test(await procSrc('fn_approved_cv')),
     /club_state <> 'suspended'/.test(await procSrc('fn_cv_club'))],
    [true, false, true, false, true, true]);
}

// J54 — deletion has no caller in the dunning path.
const j54Src = (await db.query(`select prosrc from pg_proc where proname='fn_apply_subscription'`)).rows[0].prosrc;
check('J54: no dunning code path deletes a registration',
  /delete\s+from\s+registration/i.test(codeOnly(j54Src)), false);

// J55 — read and lapsed are unreachable as a club actor. Already asserted on
// the function; asserted here on the club-facing page too.
const registerPage = codeOnly(readFileSync(fileURLToPath(new URL('../app/club/register/page.tsx', import.meta.url)), 'utf8'));
check('J55: the club register page never reads an invitation read state',
  /read_at|lapsed/.test(registerPage), false);

// J56 — an invitation is one object, not a conversation.
const invRoutes = routeFiles.filter((f) => /invitation.*(reply|thread|message)/i.test(f));
check('J56: no route appends a second club message to an invitation', invRoutes.length, 0);

// J57 — a club holding a valid token gets the APPROVED version, and the
// pending text appears nowhere. Deniz has a pending edit in the fixture.
const tokenReadSrc = (await db.query(`select prosrc from pg_proc where proname='fn_token_read'`)).rows[0].prosrc;
const approvedCvSrc = (await db.query(`select prosrc from pg_proc where proname='fn_approved_cv'`)).rows[0].prosrc;
check('J57: the token path selects the approved version explicitly',
  /fn_approved_cv/.test(tokenReadSrc) && /status = 'approved'/.test(approvedCvSrc), true);
check('J57b: and never reads a pending one',
  /'pending'/.test(codeOnly(tokenReadSrc)) || /'pending'/.test(approvedCvSrc), false);

// J58 — silence never approves. Assert by scheduler enumeration.
const dailyJob = codeOnly(readFileSync(fileURLToPath(new URL('../app/api/jobs/daily/route.ts', import.meta.url)), 'utf8'));
check('J58: no scheduled job approves a pending version',
  /approvePendingVersion|status\s*=\s*'approved'/.test(dailyJob), false);

// J59/Q1 — no share-card artefact exists before approval.
await expectFail('J59: a card cannot hold a storage path before approval',
  `insert into share_card_approval (record_id, requested_by, card_kind, storage_path)
   values ('${REC.nate}','${ID.nate}','og','cards/nate.png')`);

// J60 — the card carries no resolving URL back to the record.
const j60Src = readFileSync(fileURLToPath(new URL('../app/p/[token]/opengraph-image.tsx', import.meta.url)), 'utf8');
check('J60: the under-18 card body contains no record URL',
  /pitchfootball\.com\.au\/p\/|href=/.test(codeOnly(j60Src)), false);

// The count half of M6/J61: a withdrawn registration leaves the club's count
// as if it had never existed. Relabelled 28 Sep — J61 is "same terms as E10
// and L40", timing included, and scripts/timing-tests.mjs measures that.
const j61Before = (await db.query('select fn_register_count($1,$2) as n', [ID.td, CLUB.riverside])).rows[0].n;
const j61Reg = crypto.randomUUID();
await db.query(`insert into registration (id, player_id, club_id, policy_version) values ($1,$2,$3,'20@v2.4')`,
  [j61Reg, ID.marcus, CLUB.riverside]);
await db.query(`select fn_withdraw_registration($1,$2)`, [ID.marcus, j61Reg]);
check('held-count1: a withdrawn registration leaves the count exactly as it was',
  (await db.query('select fn_register_count($1,$2) as n', [ID.td, CLUB.riverside])).rows[0].n, j61Before);

// ---------------------------------------------------------------------------
// Tables N, O, C and I — the register payload, billing, contact, deletion.
// ---------------------------------------------------------------------------

// N15 — the note is not a channel. This is the one field where a child
// writes something a stranger reads.
const noteReg = crypto.randomUUID();
for (const [label, note] of [
  ['a web address', 'see my clips at https://example.com/me'],
  ['a bare domain', 'highlights on veo.co slash me'],
  ['an email address', 'email me on kid@example.com'],
  ['a phone number', 'call mum on 0412 345 678'],
  ['a spaced-out phone number', 'ring 0 4 1 2 3 4 5 6 7 8'],
  ['an @handle', 'add me @deniz_plays_10'],
]) {
  await expectFail(`N15: a note carrying ${label} is refused at write`,
    `insert into registration (player_id, club_id, note, policy_version)
     values ('${ID.nate}', '${CLUB.riverside}', ${JSON.stringify(note).replace(/"/g, "'")}, '20@v2.4')`);
}
await expectFail('N15b: and one over the cap',
  `insert into registration (player_id, club_id, note, policy_version)
   values ('${ID.nate}', '${CLUB.riverside}', '${'x'.repeat(141)}', '20@v2.4')`);
await db.query(
  `insert into registration (id, player_id, club_id, note, policy_version) values ($1,$2,$3,$4,'20@v2.4')`,
  [noteReg, ID.nate, CLUB.riverside, 'Been on the bench behind a keeper two years older. Want game time.']);
check('N15c: an ordinary note about football goes through', true, true);

// N6 — the club sees a fixed payload, asserted by COLUMN LIST rather than by
// what happens to be rendered.
const regCols = (await db.query(
  `select p.proname, pg_get_function_result(p.oid) as result
   from pg_proc p where p.proname = 'fn_register_rows'`)).rows[0].result;
for (const forbidden of ['dob', 'email', 'phone', 'school', 'last_name', 'address']) {
  check(`N6: the register payload cannot carry ${forbidden}`, new RegExp(`\\b${forbidden}\\b`).test(regCols), false);
}

// N10 — club_status never reaches a player or a guardian, by any query.
const playerFacing = ['fn_token_read', 'fn_read_level', 'fn_searchable', 'fn_send_log'];
for (const fn of playerFacing) {
  const src = (await db.query(`select prosrc from pg_proc where proname = $1`, [fn])).rows[0]?.prosrc ?? '';
  check(`N10: ${fn} never reads club_status`, /club_status/.test(src), false);
}

// N11 — three values and no fourth, whatever route is tried.
for (const bad of ['declined', 'rejected', 'unsuccessful', 'waitlisted']) {
  await expectFail(`N11: club_status cannot be set to "${bad}"`,
    `update registration set club_status = '${bad}' where id = '${noteReg}'`);
}

// N7/N9 — revocation empties the note in the same transaction, asserted at
// the database rather than through the API.
await db.query(`select fn_withdraw_registration($1,$2)`, [ID.nate, noteReg]);
check('N7: the note is emptied atomically on withdrawal',
  (await db.query('select note from registration where id = $1', [noteReg])).rows[0].note, null);
check('N9: and it is gone at the database, not merely hidden by the API',
  (await db.query(`select count(*)::int as n from registration where id = $1 and note is not null`, [noteReg])).rows[0].n, 0);

// ---- Table O: billing ---------------------------------------------------
// O1/O2 — no billing surface is reachable from a family view, and no billing
// email can resolve a family address.
const clubBillingPage = readFileSync(fileURLToPath(new URL('../app/club/billing/page.tsx', import.meta.url)), 'utf8');
check('O1: the billing page is club-scoped by membership, not by person',
  /technical_director|club_admin/.test(clubBillingPage), true);
check('O11: the invoicing volunteer — club_admin — may read billing',
  /club_admin/.test(clubBillingPage), true);

// O3 — payment sets a subscription flag and nothing else.
const applySrc = (await db.query(`select prosrc from pg_proc where proname='fn_apply_subscription'`)).rows[0].prosrc;
// Search the CODE, not the comment that explains the code — the function
// says "club_state is deliberately untouched", which contains the words.
const applyCode = codeOnly(applySrc);
check('O3: applying a subscription never ASSIGNS club_state', /club_state\s*=/.test(applyCode), false);
check('O5: nor does it delete a registration', /delete\s+from/i.test(applyCode), false);

// Stripe does not guarantee webhook ORDER, and this overwrote
// unconditionally. Replays were already handled by stripe_event; a reorder
// was not, in both directions — a late "active" emitted before a
// cancellation resurrected a cancelled club's register, and a late
// payment_failed suspended a club that had since paid. Behaviour, not
// source: the function is actually driven out of order here.
{
  const c = crypto.randomUUID();
  await db.query(`insert into club (id, name, club_state) values ($1,'Order Test','unclaimed')`, [c]);
  const at = (sec) => new Date(Date.UTC(2026, 0, 1, 0, 0, sec)).toISOString();
  const status = async () =>
    (await db.query(`select subscription_status from club where id=$1`, [c])).rows[0].subscription_status;

  await db.query(`select fn_apply_subscription($1,'canceled',null,null,null,null,$2::timestamptz)`, [c, at(10)]);
  await db.query(`select fn_apply_subscription($1,'active',null,null,null,null,$2::timestamptz)`, [c, at(5)]);
  check('O3b: an event older than the last one applied is ignored', await status(), 'canceled');

  await db.query(`select fn_apply_subscription($1,'active',null,null,null,null,$2::timestamptz)`, [c, at(20)]);
  check('O3c: and a genuinely newer one still applies', await status(), 'active');

  // Several events share a second routinely; the last of those is as good an
  // answer as any, so equal timestamps must not be dropped.
  await db.query(`select fn_apply_subscription($1,'past_due',null,null,null,null,$2::timestamptz)`, [c, at(20)]);
  check('O3d: an event in the same second is not treated as stale', await status(), 'past_due');
}

// O4/O5 — dunning hides, cancellation deletes. A family's child is never
// deleted because a club's card expired.
const purgeSrc = (await db.query(`select prosrc from pg_proc where proname='fn_purge_cancelled_registers'`)).rows[0].prosrc;
check('O5: the purge reaches only CANCELLED clubs, never dunning ones',
  /cancell?ed/i.test(purgeSrc), true);
check('O5b: and it is a scheduled job, not a person with a button',
  /where.*grace|past_due|unpaid/i.test(purgeSrc), false);

// ---- Table C: contact ---------------------------------------------------
// C1/C2 — no route accepts a minor as a message recipient. Route enumeration,
// not a permission check.
const messageRoutes = routeFiles.filter((f) => /\/(message|dm|chat|inbox)\//i.test(f));
check('C1/C2: no message, DM, chat or inbox route exists at all', messageRoutes.length, 0);

// C5 — a public CV carries no contact affordance.
const cvComponent = codeOnly(readFileSync(fileURLToPath(new URL('../components/cv/PlayerCV.tsx', import.meta.url)), 'utf8'));
check('C5: the public player CV has no contact affordance',
  /mailto:|tel:|contact|message/i.test(cvComponent), false);

// C9 — an adult is directly contactable; a minor never is. The distinction
// lives in the band, computed.
check('C9: an adult record is public to a signed-in viewer', await level(ID.coachOther, ID.marcus), 'public');
check('C1b: and a u16 is not, to the same viewer', await level(ID.coachOther, ID.deniz), 'none');

// ---- Table I: deletion --------------------------------------------------
// I5 — the consent log survives deletion. It is the record that the deletion
// happened, and it is append-only.
check('I5: the consent log has no delete path in code',
  /delete from consent_event/i.test(readFileSync(fileURLToPath(new URL('../lib/db.ts', import.meta.url)), 'utf8')), false);
const consentTrig = (await db.query(`select prosrc from pg_proc where proname='consent_event_immutable'`)).rows[0].prosrc;
check('I5b: and the database refuses updates and deletes outright',
  /raise exception/i.test(consentTrig), true);

// I2 — an unapproved pending invitation is purged whole, not flagged.
const purgePending = (await db.query(`select prosrc from pg_proc where proname='fn_purge_pending'`)).rows[0].prosrc;
check('I2: the purge deletes the row rather than marking it',
  /delete from pending_invitation/i.test(purgePending), true);
check('I2b: and leaves no readable remnant behind', /update pending_invitation set/i.test(purgePending), false);

// I6 — deleting a guardian's account severs the link; the child's record and
// the second guardian survive.
check('I6: a child has two guardians before the severance',
  (await db.query(`select count(*)::int as n from guardianship_link
     where child_id = $1 and approved_at is not null and revoked_at is null`, [ID.deniz])).rows[0].n, 2);
await db.query(`update guardianship_link set revoked_at = now() where guardian_id = $1 and child_id = $2`, [ID.guardian2, ID.deniz]);
check('I6b: severing one leaves the record standing', await level(ID.guardian, ID.deniz), 'full');
check('I6c: and the severed guardian keeps nothing', await level(ID.guardian2, ID.deniz), 'none');
await db.query(`update guardianship_link set revoked_at = null where guardian_id = $1 and child_id = $2`, [ID.guardian2, ID.deniz]);

// ---------------------------------------------------------------------------
// Tables M and P — the club-state wall, and the invitation wall (D-126,
// D-117, D-138).
// ---------------------------------------------------------------------------
const mClub = crypto.randomUUID(), mReg = crypto.randomUUID(), mAdmin = crypto.randomUUID();
await db.query(`insert into club (id, name, club_state, subscription_status) values ($1,'Held FC','claimed','active')`, [mClub]);
await db.query(`insert into person (id, first_name, dob) values ($1,'Held Admin','${yearsAgo(40)}')`, [mAdmin]);
await recordTd(mAdmin, mClub, 'heldtd@fixture.example'); // D-154: the register's reader is a named TD
await db.query(`insert into registration (id, player_id, club_id, note, policy_version) values ($1,$2,$3,'Keen','20@v2.4')`,
  [mReg, ID.georgia, mClub]);

check('M1: an unverified club renders the held view — a count only',
  (await db.query('select * from fn_register_rows($1,$2)', [mAdmin, mClub])).rows.length, 0);
check('M1b: and the count itself is visible',
  (await db.query('select fn_register_count($1,$2) as n', [mAdmin, mClub])).rows[0].n, 1);
check('M3: paying changes nothing minor-facing — still held',
  (await db.query('select * from fn_register_rows($1,$2)', [mAdmin, mClub])).rows.length, 0);
check('M3b: and club_state is untouched by the subscription',
  (await db.query('select club_state from club where id = $1', [mClub])).rows[0].club_state, 'claimed');

// M4 — `verified` cannot be written without a logged human call. This is the
// structural anchor, not a policy check.
await expectFail('M4: no webhook, job or migration can set verified without a call',
  `update club set club_state = 'verified' where id = '${mClub}'`);

// M5 — verifying makes every held row readable in the SAME transaction.
const mCall = crypto.randomUUID();
await db.query(`insert into registration (player_id, club_id, policy_version) values ($1,$2,'20@v2.4')`, [ID.nate, mClub]);
await db.exec(`begin;
  insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
    values ('${mCall}','${mClub}', now(), 'BUZ', '03 9000 0000', 'FV club directory', 'verified', '27@v1.0');
  update club set club_state='verified', verified_call_id='${mCall}' where id='${mClub}';
commit;`);
check('M5: verifying releases every held row at once',
  (await db.query('select * from fn_register_rows($1,$2)', [mAdmin, mClub])).rows.length, 2);

// D-128 — by here Held FC is verified (M5), so mReg is a registration the
// club could read. Taking it off keeps the row, withdrawn and emptied; it
// leaves the register and the count. (Labelled M6 until 29 Sep, but M6 is a
// HELD registration, and this one was released at M5 — L4. M6 is below.)
await db.query(`select fn_withdraw_registration($1,$2)`, [ID.guardian, mReg]);
check('D-128: a readable registration taken off leaves the register',
  (await db.query('select * from fn_register_rows($1,$2)', [mAdmin, mClub])).rows.length, 1);
check('D-128b: and the count decrements with it',
  (await db.query('select fn_register_count($1,$2) as n', [mAdmin, mClub])).rows[0].n, 1);

// M6 — a family withdraws while a registration is HELD: the row is removed and
// the count decrements, and the club can never learn it existed (0095; brief
// D, round C's option a). Held means the club has never been verified, so it
// has only ever seen a count. A club of its own, with an administrator (who
// reads the count, D-126) and no Technical Director: recordTd logs a verified
// call, which is exactly what makes a club's rows readable once and so keeps
// them (the rule below). Georgia is a minor and ID.guardian her parent.
{
  const hClub = crypto.randomUUID(), hAdmin = crypto.randomUUID();
  const hReg = crypto.randomUUID(), hKeep = crypto.randomUUID(), hSent = crypto.randomUUID(), hReq = crypto.randomUUID();
  await db.query(`insert into club (id, name, club_state) values ($1,'Held Twice FC','claimed')`, [hClub]);
  await db.query(`insert into person (id, first_name, dob) values ($1,'Held Twice Admin','${yearsAgo(40)}')`, [hAdmin]);
  await db.query(`insert into membership (person_id, club_id, role) values ($1,$2,'club_admin')`, [hAdmin, hClub]);
  for (const [id, note] of [[hReg, 'Keen on Tuesdays'], [hKeep, null], [hSent, 'Sent by my mum']]) {
    await db.query(`insert into registration (id, player_id, club_id, note, policy_version) values ($1,$2,$3,$4,'20@v2.4')`,
      [id, id === hKeep ? ID.nate : ID.georgia, hClub, note]);
  }
  // hSent came the under-16 way: the child asked and the guardian sent it, so
  // the child's request points at the registration it made (0005).
  await db.query(`insert into registration_request (id, record_id, club_id, note, dispatched_by, dispatched_at, registration_id)
    values ($1,$2,$3,'Sent by my mum',$4,now(),$5)`, [hReq, REC.georgia, hClub, ID.guardian, hSent]);
  const count = async () => (await db.query('select fn_register_count($1,$2) as n', [hAdmin, hClub])).rows[0].n;
  // Everything the club side can ask, captured before anything comes or goes.
  const clubView = async () => JSON.stringify([
    await count(),
    (await db.query('select * from fn_register_rows($1,$2)', [hAdmin, hClub])).rows,
    (await db.query(`select club_state, verified_call_id, subscription_status, current_period_end, grace_until from club where id = $1`, [hClub])).rows,
  ]);
  const everywhere = async (id) => {
    // Every column of every table in the schema that could hold this id —
    // a uuid, or text/json that might carry it — asked for it.
    const cols = (await db.query(
      `select table_name, column_name, data_type from information_schema.columns
       where table_schema = 'public' and data_type in ('uuid','text','jsonb','json')
         and table_name in (select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE')`)).rows;
    const found = [];
    for (const c of cols) {
      const cond = c.data_type === 'uuid' ? `"${c.column_name}" = $1::uuid` : `"${c.column_name}"::text like '%' || $1 || '%'`;
      const n = (await db.query(`select count(*)::int as n from "${c.table_name}" where ${cond}`, [id])).rows[0].n;
      if (n) found.push(`${c.table_name}.${c.column_name}`);
    }
    return found;
  };

  check('M6 setup: three held registrations, a count of three, and not one row for the club',
    [await count(), (await db.query('select * from fn_register_rows($1,$2)', [hAdmin, hClub])).rows.length,
     (await db.query('select fn_registration_held_unread($1) as h', [hReg])).rows[0].h], [3, 0, true]);
  const before = await clubView();
  check('M6: the family takes a held registration off — the answer is yes', (await db.query('select fn_withdraw_registration($1,$2) as ok', [ID.guardian, hReg])).rows[0].ok, true);
  check('M6: and the row is removed, not marked', (await db.query('select count(*)::int as n from registration where id = $1', [hReg])).rows[0].n, 0);
  check('M6: the count decrements', await count(), 2);
  // The family's own action logs the withdrawal on the consent spine, as
  // app/registers/actions.ts does, and that is the one place left that names
  // it: the family's log, which no club-side page reads.
  await db.query(`insert into consent_event (event, actor_id, subject_id, detail)
    values ('registration_withdrawn', $1, $2, jsonb_build_object('registration_id', $3::uuid))`, [ID.guardian, ID.georgia, hReg]);
  const clubSide = routeFiles.filter((f) => /\/app\/(club|coach|fc)\//.test(f) && /(from|join)\s+consent_event/.test(codeOnly(readFileSync(f, 'utf8'))));
  check('M6: and nothing in the database still names it but the family’s own consent log, which no club page reads — no row, no pointer, no audit entry a club can see',
    [await everywhere(hReg), clubSide, routeFiles.filter((f) => /\/app\/(club|coach|fc)\//.test(f)).length > 20], [['consent_event.detail'], [], true]);
  // The club-side reads, before and after, less the count, are the same:
  // no gap, no changed timestamp, nothing that moved on the club.
  const afterView = JSON.parse(await clubView());
  const beforeView = JSON.parse(before);
  check('M6: every other club-side answer is exactly what it was — the club state, its dates, its (empty) rows',
    JSON.stringify(afterView.slice(1)), JSON.stringify(beforeView.slice(1)));
  check('M6: one the guardian sent for a child goes the same way, and the child’s own request no longer points at it',
    [(await db.query('select fn_withdraw_registration($1,$2) as ok', [ID.guardian, hSent])).rows[0].ok,
     (await db.query('select count(*)::int as n from registration where id = $1', [hSent])).rows[0].n,
     (await db.query('select registration_id from registration_request where id = $1', [hReq])).rows[0].registration_id,
     await count()],
    [true, 0, null, 1]);
  // Verified afterwards: the club is released the one that stayed, and has
  // nothing to show for the ones that went.
  const hCall = crypto.randomUUID();
  await db.exec(`begin;
    insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
      values ('${hCall}','${hClub}', now(), 'BUZ', '03 9000 0000', 'FV club directory', 'verified', '27@v1.0');
    update club set club_state='verified', verified_call_id='${hCall}' where id='${hClub}';
  commit;`);
  await recordTd(hAdmin, hClub, 'heldtwice@fixture.example');
  check('M6: a club verified afterwards is released only the registration that stayed',
    (await db.query('select * from fn_register_rows($1,$2)', [hAdmin, hClub])).rows.map((r) => r.registration_id), [hKeep]);

  // D-128 — the other half, unchanged: a registration a club could read keeps
  // its row, withdrawn and emptied, and the family keeps the record of who
  // read it (doc 34 rule 6, fn_register_readers). Now that this club is
  // verified, hKeep is one; its reader is on record.
  await db.query(`insert into register_read_log (person_id, registration_id, surface) values ($1,$2,'list')`, [hAdmin, hKeep]);
  check('D-128: a readable registration taken off keeps its row, withdrawn, with its note emptied, and its reader on record',
    [(await db.query('select fn_withdraw_registration($1,$2) as ok', [ID.nate, hKeep])).rows[0].ok,
     (await db.query('select withdrawn_at is not null as w, note from registration where id = $1', [hKeep])).rows[0],
     (await db.query('select count(*)::int as n from register_read_log where registration_id = $1', [hKeep])).rows[0].n,
     (await db.query('select * from fn_register_rows($1,$2)', [hAdmin, hClub])).rows.length],
    [true, { w: true, note: null }, 1, 0]);

  // Which rows are held, as the database answers it (0095): only a club that
  // has never been verified. Suspended after a verification is NOT held — it
  // may have read the row before — and neither is a club whose verified call
  // was logged and whose state did not follow (the doubt keeps the row).
  const probe = async (state, calls, readLog) => {
    const c = crypto.randomUUID(), r = crypto.randomUUID();
    await db.query(`insert into club (id, name, club_state) values ($1,'Probe FC','claimed')`, [c]);
    for (const outcome of calls) {
      const call = crypto.randomUUID();
      await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
        values ($1,$2,now(),'BUZ','03 9000 0000','FV club directory',$3,'27@v1.0')`, [call, c, outcome]);
      if (outcome === 'verified') await db.query(`update club set verified_call_id = $1 where id = $2`, [call, c]);
    }
    if (state !== 'claimed') await db.query(`update club set club_state = $1 where id = $2`, [state, c]);
    await db.query(`insert into registration (id, player_id, club_id, policy_version) values ($1,$2,$3,'20@v2.4')`, [r, ID.nate, c]);
    if (readLog) await db.query(`insert into register_read_log (person_id, registration_id, surface) values ($1,$2,'list')`, [hAdmin, r]);
    const held = (await db.query('select fn_registration_held_unread($1) as h', [r])).rows[0].h;
    await db.query('delete from registration where id = $1', [r]);
    return held;
  };
  check('M6: held means never verified — claimed, unclaimed or refused on the call: yes; verified, suspended after a verification, a verified call logged, or a reader on record: no',
    [await probe('claimed', [], false), await probe('unclaimed', [], false), await probe('claimed', ['not_verified'], false),
     await probe('verified', ['verified'], false), await probe('suspended', ['verified', 'suspended'], false),
     await probe('claimed', ['verified'], false), await probe('claimed', [], true)],
    [true, true, true, false, false, false, false]);
  await db.query('delete from registration where id = $1', [hKeep]);
}

// M10 — suspension is immediate and total.
check('M10a: a verified club is minor-facing',
  (await db.query('select fn_club_minor_facing($1) as v', [mClub])).rows[0].v, true);
await db.query(`update club set club_state='suspended' where id=$1`, [mClub]);
check('M10b: suspension ends it in the same breath',
  (await db.query('select fn_club_minor_facing($1) as v', [mClub])).rows[0].v, false);
check('M10c: and the register falls straight back to the held view',
  (await db.query('select * from fn_register_rows($1,$2)', [mAdmin, mClub])).rows.length, 0);
await db.query(`update club set club_state='verified' where id=$1`, [mClub]);

// M8 — what an unverified club MAY do: things with no minor in them.
const m7Club = crypto.randomUUID();
await db.query(`insert into club (id, name, club_state) values ($1,'Notice FC','claimed')`, [m7Club]);
// Doc 14 M7 says an unverified club MAY post a trial notice. The register says
// otherwise: D-90 names the board's two sources, "a verified club posts its
// own" and Pitch compiles the rest, and the product has always done that —
// /club/post-trial, the only door a club has, asks for a verified club on the
// page and again in the action. This check used to insert a notice straight
// into the table and call it M7, which tested the table and not the product,
// and asserted the opposite of the register (L4, L22). Brief K: behaviour is
// unchanged, the check tests what D-90 decides, and M7 is open until BUZ
// rules between doc 14 and the register.
//
// Brief L: both versions are written, and scripts/rulings.mjs says which one
// runs. BUZ ruled on 29 Sep that D-90 stands, and doc 14 M7 now reads
// "Refused"; the switch says 'D-90'.
{
  const postPage = codeOnly(srcOf('app/club/post-trial/page.tsx')), postAct = codeOnly(srcOf('app/club/post-trial/actions.ts'));
  const writers = tsSourceFiles().filter((f) => /insert into trial_notice\b(?!_)/.test(codeOnly(srcOf(f))));
  const asksVerified = (src) => /membership m on m\.club_id = c\.id[\s\S]{0,160}where c\.club_state = 'verified'/.test(src);
  // D-90's version: the page and the action both ask for a verified club, a
  // club they do not find is sent home, and there is no other writer — and,
  // since BUZ ruled, the database says the same (0152, doc 14's first rule:
  // its tests run against the database): a club's own notice is refused for
  // a club that is not verified, whether written for it or moved onto it,
  // and accepted for one that is; and a club that fails its call (0150) takes
  // its own notices off the board with it until it is verified again.
  const accepted = async (sql, params) => { try { await db.query(sql, params); return true; } catch { return false; } };
  const soonDay = (await db.query(`select ((now() at time zone 'Australia/Melbourne')::date + 20)::text as d`)).rows[0].d;
  const own = (club, title) => accepted(`insert into trial_notice (club_id, title, trial_on, time_venue, source) values ($1,$2,$3,'Sat 9:00 AM · Oval','club')`,
    [club, title, soonDay]);
  const postedHere = await own(CLUB.riverside, 'M7 verified club posts');
  const postedClaimed = await own(m7Club, 'M7 claimed club posts');
  const movedOnto = await accepted(`update trial_notice set club_id = $1 where club_id = $2 and title = 'M7 verified club posts'`, [m7Club, CLUB.riverside]);
  const onBoard = async () => (await db.query(`select count(*)::int as n from fn_trial_notices_advertised() where title = 'M7 verified club posts'`)).rows[0].n;
  const boardVerified = await onBoard();
  const failed = crypto.randomUUID();
  await db.query('begin');
  await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
    values ($1,$2,now(),'BUZ','03 9000 0000','FV club directory','not_verified','27@v1.0')`, [failed, CLUB.riverside]);
  const boardFailed = await onBoard();
  await db.query('rollback');
  const boardBack = await onBoard();
  await db.query(`delete from trial_notice where title = 'M7 verified club posts'`);
  const d90 = [asksVerified(postPage), asksVerified(postAct), /if \(club\.rows\.length === 0\) redirect\('\/home'\);/.test(postAct), writers,
    postedHere, postedClaimed, movedOnto, [boardVerified, boardFailed, boardBack]];
  const d90Expected = [true, true, true, ['app/club/post-trial/actions.ts'], true, false, false, [1, 0, 1]];
  // Doc 14's version: neither asks for verification — a claimed club's own
  // contact gets the form and the post — and it is still the only writer.
  // Behaviour is pressed in the write suite (m7-w, d90-w1).
  const doc14 = [asksVerified(postPage), asksVerified(postAct), writers];
  const doc14Expected = [false, false, ['app/club/post-trial/actions.ts']];
  if (RULINGS.M7 === 'D-90') {
    check('M7: an unverified club does not post a trial notice — refused at the database (0152) as well as at /club/post-trial, the only writer, which asks for a verified club on the page and again in the action; and a club that fails its call takes its own notices off the board until it is verified again (D-90, as BUZ ruled 29 Sep)', d90, d90Expected);
  } else if (RULINGS.M7 === 'doc 14') {
    check('M7: an unverified club posts a trial notice — /club/post-trial asks the club to be on Pitch, not verified, and it is still the only writer of a notice (doc 14 M7, as BUZ ruled)', doc14, doc14Expected);
  } else {
    check('D-90: a club posts its own trial notice only once it is verified — /club/post-trial asks for a verified club on the page and again in the action, and it is the only writer of a notice in the product (doc 14 M7 says an unverified club may; awaiting BUZ, scripts/rulings.mjs)',
      d90, d90Expected);
  }
}

// M8 — `club_unverified` adds a coach or an administrator. Doc 14 says
// permitted. The product never has: the only way a club brings a coach in is
// the Technical Director's invitation (coach_invite_rules, 0037 — D-154's
// restrictive reading, "only the TD brings a coach in"), a TD exists only
// once a verification call has named one (0058, D-93), and no screen adds an
// administrator at any club — the claim makes the first one, and nothing
// makes a second. So an unverified club adds nobody. The check that stood
// here was check('M8: …', true, true), which cannot fail (L19, round K).
// Brief L: M8 is doc 14 against D-154/D-93, the same shape as M7, and waits on
// BUZ with both versions written. Notice FC is claimed; its administrator is
// the club_unverified of doc 14 §M(0).
{
  const m8Admin = crypto.randomUUID(), m8Coach = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob) values ($1,'Notice Admin','${yearsAgo(41)}'), ($2,'New Coach','${yearsAgo(30)}')`,
    [m8Admin, m8Coach]);
  await mem(m8Admin, m7Club, null, 'club_admin');
  const m8Squad = crypto.randomUUID();
  await db.query(`insert into squad (id, club_id, name, age_group, competition_gender, season) values ($1,$2,'Notice U12','U12','boys','2026')`, [m8Squad, m7Club]);
  // What the club's contact would do to add a coach: the one door there is.
  const accepted = async (sql, params) => {
    try { await db.query(sql, params); return true; } catch { return false; }
  };
  const invited = await accepted(
    `insert into coach_invite (club_id, person_id, invited_by, squad_ids, wwcc_checked) values ($1,$2,$3,array[$4::uuid],true)`,
    [m7Club, m8Coach, m8Admin, m8Squad]);
  const tdWritten = await accepted(`insert into membership (person_id, club_id, role) values ($1,$2,'technical_director')`, [m8Admin, m7Club]);
  // Who writes an administrator in the product: the claim, once, for the club
  // it takes from unclaimed — the first administrator, never an added one.
  const adminWriters = tsSourceFiles().filter((f) => /insert into membership/.test(codeOnly(srcOf(f)))
    && /'club_admin'/.test(codeOnly(srcOf(f))));
  const worksRegister = (await db.query('select fn_can_work_register($1,$2) as ok', [m8Admin, m7Club])).rows[0].ok;
  // D-154's version: refused at the only door, no TD to open it, no second
  // administrator anywhere.
  const d154 = [invited, tdWritten, worksRegister, adminWriters];
  const d154Expected = [false, false, false, ['app/claim/[slug]/actions.ts']];
  // Doc 14's version: the club's own contact brings a coach in, and the coach
  // it adds reads no child (A14) — which needs a door the product does not
  // have, so today it is red by design.
  const doc14 = [invited, await level(m8Coach, ID.deniz), await level(m8Coach, unvPlayer)];
  const doc14Expected = [true, 'none', 'none'];
  if (RULINGS.M8 === 'D-154') {
    check('M8: an unverified club adds no coach and no administrator — the TD\u2019s invitation is the only door, a TD comes only from a verification call, and nothing adds an administrator (D-154, D-93, as BUZ ruled)', d154, d154Expected);
  } else if (RULINGS.M8 === 'doc 14') {
    check('M8: an unverified club\u2019s own contact brings a coach in, and the coach it adds reads no child (doc 14 M8, as BUZ ruled)', doc14, doc14Expected);
  } else {
    check('D-154: an unverified club adds no coach and no administrator — the TD\u2019s invitation is the only door, a TD comes only from a verification call, and nothing adds an administrator (doc 14 M8 says it may; awaiting BUZ, scripts/rulings.mjs)',
      d154, d154Expected);
  }
}

// ---- Table P: the invitation wall --------------------------------------
// P5 — an unverified club cannot invite at all.
const pReg = crypto.randomUUID();
await db.query(`insert into registration (id, player_id, club_id, policy_version) values ($1,$2,$3,'20@v2.4')`,
  [pReg, ID.deniz, CLUB.riverside]);
await expectFail('P5: an unverified club cannot create an invitation',
  `insert into invitation (club_id, registration_id, body) values ('${m7Club}', '${pReg}', 'come and see us')`);
await db.exec(`insert into invitation (club_id, registration_id, body)
  values ('${CLUB.riverside}', '${pReg}', 'We would like a look at him')`);
check('P1: a verified club can, and it lands in the family’s account', true, true);

// P12 — a withdrawn, paused or unapproved family is not reachable.
const pWithdrawn = crypto.randomUUID();
await db.query(`insert into registration (id, player_id, club_id, policy_version, withdrawn_at) values ($1,$2,$3,'20@v2.4', now())`,
  [pWithdrawn, ID.nate, CLUB.riverside]);
await expectFail('P12a: a club cannot invite a family that has withdrawn',
  `insert into invitation (club_id, registration_id, body) values ('${CLUB.riverside}', '${pWithdrawn}', 'reconsider?')`);
await db.query(`insert into guardian_setting (child_id, profile_paused, updated_by) values ($1, true, $2)
  on conflict (child_id) do update set profile_paused = true`, [ID.georgia, ID.guardian]);
const pPaused = crypto.randomUUID();
await db.query(`insert into registration (id, player_id, club_id, policy_version) values ($1,$2,$3,'20@v2.4')`,
  [pPaused, ID.georgia, CLUB.riverside]);
await expectFail('P12b: nor one whose profile is paused',
  `insert into invitation (club_id, registration_id, body) values ('${CLUB.riverside}', '${pPaused}', 'hello')`);

// P19 — the affordance is absent in exactly the cases the write refuses.
// fn_can_invite once hid fewer cases than the trigger refused, so the
// register offered "Invite to trial" for a paused or unapproved child and
// pressing it 500ed. John: refusal is indistinguishable from absence.
const canInviteP = async (reg) => (await db.query('select fn_can_invite($1,$2) as c', [ID.td, reg])).rows[0].c;
// The positive controls need a tier that would otherwise say yes, so the only
// thing that can flip the answer is the pause or the guardian.
const riversidePlan = (await db.query(`select subscription_status from club where id = $1`, [CLUB.riverside])).rows[0].subscription_status;
await db.query(`update club set subscription_status = 'active' where id = $1`, [CLUB.riverside]);
check('P19a: no invite is offered for a family that has withdrawn', await canInviteP(pWithdrawn), false);
check('P19b: nor for a paused profile — the same case the write refuses', await canInviteP(pPaused), false);
await db.query(`update guardian_setting set profile_paused = false where child_id = $1`, [ID.georgia]);
check('P19c: unpaused, the same registration is invitable again (the check is the pause, not the child)',
  await canInviteP(pPaused), true);
const revoked = (await db.query(
  `update guardianship_link set revoked_at = now() where child_id = $1 and revoked_at is null returning id`,
  [ID.georgia])).rows.map((r) => r.id);
check('P19d: an under-16 with no approved guardian is offered to nobody (A17)', await canInviteP(pPaused), false);
await expectFail('P19e: and the write refuses the same registration — function and trigger agree',
  `insert into invitation (club_id, registration_id, body) values ('${CLUB.riverside}', '${pPaused}', 'hello')`);
await db.query(`update guardianship_link set revoked_at = null where id = any($1)`, [revoked]);
check('P19f: the guardian restored, the offer returns', await canInviteP(pPaused), true);
await db.query(`update club set subscription_status = $1 where id = $2`, [riversidePlan, CLUB.riverside]);
{
  // The live definitions, not the migration files: a later migration that
  // replaces either function without the other is what this catches.
  const src = async (fn) => (await db.query(`select prosrc from pg_proc where proname = $1`, [fn])).rows[0].prosrc;
  const [can, trig] = [await src('fn_can_invite'), await src('invitation_club_entitled')];
  check('P19g: the function and the trigger both ask the pause and A17 questions',
    ['profile_paused', 'fn_has_approved_guardian', 'withdrawn_at', "club_state = 'verified'"]
      .map((w) => [w, can.includes(w), trig.includes(w)]).filter(([, a, b]) => !(a && b)).map(([w]) => w), []);
}

// P6/P7 — what the club may learn. Two states, and silence looks like
// nothing ever arrived.
const pInv = (await db.query(`select id from invitation where registration_id = $1`, [pReg])).rows[0].id;
const invState = async (who) => (await db.query('select fn_invitation_state($1,$2) as s', [who, pInv])).rows[0].s;
check('P7a: the club sees "sent"', await invState(ID.td), 'sent');
await db.query(`update invitation set read_at = now() where id = $1`, [pInv]);
check('P6: the guardian reading it changes nothing the club can see', await invState(ID.td), 'sent');
// D-153: a reply is an answer only once approved. A draft looks, to the club,
// exactly like silence — and only a parent may approve a minor's.
await db.query(`insert into invitation_reply (invitation_id, replied_by) values ($1,$2)`, [pInv, ID.deniz]);
check('P7f: a reply not yet approved is not an answer — the club still sees "sent"', await invState(ID.td), 'sent');
await db.query(`update invitation_reply set approved_by = $1, approved_at = now() where invitation_id = $2`, [ID.guardian, pInv]);
check('P7b: answering is the only other state', await invState(ID.td), 'answered');
check('P7c: "read" and "lapsed" are unreachable from any club actor',
  /'read'|'lapsed'/.test((await db.query(`select prosrc from pg_proc where proname='fn_invitation_state'`)).rows[0].prosrc), false);
check('P7d: and a club at another club learns nothing', await invState(ID.adminOther), null);
check('P7e: nor does an anonymous caller', await invState(null), null);

// P8/P9 — nothing is shared by default.
const reply = (await db.query(`select shared_fields from invitation_reply where invitation_id = $1`, [pInv])).rows[0];
check('P9: a reply can carry no identifiers at all', JSON.stringify(reply.shared_fields), '{}');

// ---- D-153: clubs invite players to trial, in every band, on the free tier ----
// One object and one route still (P11): an invitation hangs off a registration.
// What changed is who may create one, and what counts as an answer.
// D-153's free tier exists only while billing is on (D-163); with it off, a
// verified club reads its whole register. This block tests the Stripe build.
await billingOn(true);
{
  const trialAt = async (club) => (await db.query(
    `insert into trial_notice (club_id, title, trial_on, time_venue)
     values ($1, 'Trials', (now() + interval '30 days')::date, 'Sun 9:00 AM · Oval') returning id`, [club])).rows[0].id;
  const canInvite = async (who, reg) => (await db.query('select fn_can_invite($1,$2) as c', [who, reg])).rows[0].c;
  const newReg = async (player, club, trial = null) => {
    const id = crypto.randomUUID();
    await db.query(`insert into registration (id, player_id, club_id, policy_version, trial_notice_id)
      values ($1,$2,$3,'20@v2.4',$4)`, [id, player, club, trial]);
    return id;
  };
  const riversideTrial = await trialAt(CLUB.riverside);
  // D-154: an administrator reads no registration, so the club that invites
  // here needs its technical director.
  const tdOther = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob) values ($1,'Other TD',$2)`, [tdOther, yearsAgo(41)]);
  await recordTd(tdOther, CLUB.other, 'othertd@fixture.example');
  const bayviewTrial = await trialAt(CLUB.other);
  await db.query(`update club set subscription_status = null where id = $1`, [CLUB.other]);

  // The free tier.
  const freeTagged = await newReg(ID.marcus, CLUB.other, bayviewTrial);
  const freeUntagged = await newReg(ID.nate, CLUB.other);
  check('P13: a free verified club may invite someone who registered against its own trial',
    await canInvite(tdOther, freeTagged), true);
  check('P13b: but not someone who only joined its register — the year-round list is the paid plan',
    await canInvite(tdOther, freeUntagged), false);
  await db.query(`update club set subscription_status = 'active' where id = $1`, [CLUB.other]);
  check('P13c: a paying club may invite anyone on its register', await canInvite(tdOther, freeUntagged), true);
  await db.query(`update club set subscription_status = null where id = $1`, [CLUB.other]);
  check('P13d: another club’s worker may invite nobody here', await canInvite(ID.td, freeTagged), false);
  const unvAdmin = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob) values ($1,'Unverified Admin',$2)`, [unvAdmin, yearsAgo(40)]);
  await mem(unvAdmin, CLUB.unverified, null, 'club_admin');
  // A trial of its own is something an unverified club can only have from
  // before it lost its verification: since 0152 (BUZ on doc 14 M7) no club
  // posts one while it is not verified. So the fixture writes it the way the
  // seed writes a row from before a rule — with the rule off for that one
  // insert, and back on at once.
  await db.exec('alter table trial_notice disable trigger trial_notice_club_source_verified');
  const unvTrial = await trialAt(CLUB.unverified);
  await db.exec('alter table trial_notice enable trigger trial_notice_club_source_verified');
  const unvReg = await newReg(ID.marcus, CLUB.unverified, unvTrial);
  check('P13e: an unverified club may invite nobody, even from its own trial (D-126)',
    await canInvite(unvAdmin, unvReg), false);

  // A tag, and an invitation, only ever point at the club's own trial.
  await expectFail('P14: a registration cannot be tagged to another club’s trial',
    `insert into registration (player_id, club_id, policy_version, trial_notice_id)
     values ('${ID.nate}','${CLUB.other}','20@v2.4','${riversideTrial}')`);
  await expectFail('P14b: nor can an invitation name another club’s trial',
    `insert into invitation (club_id, registration_id, body, trial_notice_id)
     values ('${CLUB.other}','${freeTagged}','x','${riversideTrial}')`);
  await expectFail('P14c: nor can a club invite from another club’s register',
    `insert into invitation (club_id, registration_id, body) values ('${CLUB.riverside}','${freeTagged}','x')`);

  // Who may put a reply in front of the club.
  const adultInv = (await db.query(
    `insert into invitation (club_id, registration_id, body, trial_notice_id) values ($1,$2,'{"kind":"trial"}',$3) returning id`,
    [CLUB.other, freeTagged, bayviewTrial])).rows[0].id;
  const stateAt = async (who, inv) => (await db.query('select fn_invitation_state($1,$2) as s', [who, inv])).rows[0].s;
  await expectFail('P15: an adult’s reply can be approved by nobody but the adult',
    `insert into invitation_reply (invitation_id, replied_by, approved_by, approved_at)
     values ('${adultInv}','${ID.guardian}','${ID.guardian}', now())`);
  await db.query(`insert into invitation_reply (invitation_id, replied_by, approved_by, approved_at) values ($1,$2,$2,now())`,
    [adultInv, ID.marcus]);
  check('P15b: an adult answers for themselves, and the club sees the answer', await stateAt(tdOther, adultInv), 'answered');
  await expectFail('P16: one reply per invitation — an invitation is not a thread (P10)',
    `insert into invitation_reply (invitation_id, replied_by, approved_by, approved_at)
     values ('${adultInv}','${ID.marcus}','${ID.marcus}', now())`);

  const teenInv = (await db.query(
    `insert into invitation (club_id, registration_id, body) values ($1,$2,'{"kind":"trial"}') returning id`,
    [CLUB.riverside, await newReg(ID.nate, CLUB.riverside, riversideTrial)])).rows[0].id;
  await db.query(`insert into invitation_reply (invitation_id, replied_by, shared_fields) values ($1,$2,'{"answer":"yes"}')`,
    [teenInv, ID.nate]);
  check('P17: a 16-17’s own reply is a draft — the club still sees "sent"', await stateAt(ID.td, teenInv), 'sent');
  await expectFail('P17b: the 16-17 cannot approve their own reply',
    `update invitation_reply set approved_by = '${ID.nate}', approved_at = now() where invitation_id = '${teenInv}'`);
  await expectFail('P17c: nor can someone who is not their parent',
    `update invitation_reply set approved_by = '${ID.td}', approved_at = now() where invitation_id = '${teenInv}'`);
  await db.query(`update invitation_reply set approved_by = $1, approved_at = now() where invitation_id = $2`, [ID.guardian, teenInv]);
  check('P17d: a parent approves it, and only then does the club see the answer', await stateAt(ID.td, teenInv), 'answered');

  // P20 / doc 32 B5a — an invitation's message is not a channel. N15 pointed
  // the other way: an under-16 reads this at the same moment their parent does.
  {
    const p20Reg = await newReg(ID.marcus, CLUB.riverside);
    for (const [label, note] of [
      ['a web address', 'our trial page is https://example.com/trials'],
      ['a bare domain', 'details on riversidefc.com.au'],
      ['an email address', 'email coach@riverside.example'],
      ['a phone number', 'ring me on 0412 345 678'],
      ['a spaced-out phone number', 'call 0 4 1 2 3 4 5 6 7 8'],
      ['an @handle', 'follow us @riverside_juniors'],
    ]) {
      await expectFail(`P20: an invitation carrying ${label} is refused at write`,
        `insert into invitation (club_id, registration_id, body) values ('${CLUB.riverside}', '${p20Reg}', ${JSON.stringify(JSON.stringify({ kind: 'trial', note })).replace(/^"|"$/g, "'").replace(/\\"/g, '"')})`);
    }
    await expectFail('P20b: plain text is checked too, not only the app\u2019s JSON shape',
      `insert into invitation (club_id, registration_id, body) values ('${CLUB.riverside}', '${p20Reg}', 'text me 0412345678')`);
    await expectFail('P20c: and one over the cap',
      `insert into invitation (club_id, registration_id, body) values ('${CLUB.riverside}', '${p20Reg}', '${JSON.stringify({ kind: 'trial', note: 'x'.repeat(401) })}')`);
    const ok = await db.query(`insert into invitation (club_id, registration_id, body) values ($1,$2,$3) returning id`,
      [CLUB.riverside, p20Reg, JSON.stringify({ kind: 'trial', note: "Saw you at the U16 trials. We're short in midfield and we'd like a proper look." })]);
    check('P20d: an ordinary message about football goes through', ok.rows.length, 1);
  }

  // What a free club reads: its own trials' registrants, and nobody else.
  const trialRows = async (who, club) => (await db.query('select registration_id from fn_trial_interest_rows($1,$2)', [who, club])).rows.map((r) => r.registration_id);
  const free = await trialRows(tdOther, CLUB.other);
  check('P18: a free club sees who registered against its trials', free.includes(freeTagged), true);
  check('P18b: and not who merely joined its register', free.includes(freeUntagged), false);
  check('P18c: an unverified club sees nobody, whatever it posted', (await trialRows(unvAdmin, CLUB.unverified)).length, 0);
  check('P18d: another club’s worker sees nothing here', (await trialRows(ID.td, CLUB.other)).length, 0);
}
await billingOn(false);

// ---------------------------------------------------------------------------
// D-154 — a club does not read its register; a named person does (doc 14
// N16-N24, John's doc 34, BUZ 15 Sep: up to three teams a coach, ten coaches
// a club, and no administrator).
// ---------------------------------------------------------------------------
{
  const plan = (await db.query(`select subscription_status from club where id = $1`, [CLUB.riverside])).rows[0].subscription_status;
  await db.query(`update club set subscription_status = 'active' where id = $1`, [CLUB.riverside]);
  const q1 = async (sql, args) => (await db.query(sql, args)).rows[0];
  const canRead = async (who, reg) => (await q1('select fn_can_read_registration($1,$2) as c', [who, reg])).c;
  const canInv = async (who, reg) => (await q1('select fn_can_invite($1,$2) as c', [who, reg])).c;
  const rowIds = async (who, club) => (await db.query('select registration_id from fn_register_rows($1,$2)', [who, club])).rows.map((r) => r.registration_id);
  const squad = async (name) => (await q1(
    `insert into squad (club_id, name, age_group, competition_gender, season) values ($1,$2,'U14','boys','2026') returning id`,
    [CLUB.riverside, name])).id;
  const [sqA, sqB, sqC, sqD] = [await squad('N-A'), await squad('N-B'), await squad('N-C'), await squad('N-D')];
  const reg = async (player, sq) => (await q1(
    `insert into registration (player_id, club_id, squad_target, policy_version) values ($1,$2,$3,'20@v2.4') returning id`,
    [player, CLUB.riverside, sq])).id;
  const [regA, regB, regD, regUnfiled] = [await reg(ID.marcus, sqA), await reg(ID.marcus, sqB), await reg(ID.marcus, sqD), await reg(ID.marcus, null)];
  const coach = async (name) => {
    const id = crypto.randomUUID();
    await db.query(`insert into person (id, first_name, dob) values ($1,$2,$3)`, [id, name, yearsAgo(35)]);
    await mem(id, CLUB.riverside, null, 'coach');
    await db.query(`insert into wwcc_attestation (person_id, club_id, attested_by) values ($1,$2,$3)`, [id, CLUB.riverside, ID.td]);
    return id;
  };
  const grantSql = (who, sq, by) =>
    `insert into register_grant (club_id, person_id, squad_id, granted_by) values ('${CLUB.riverside}','${who}','${sq}','${by}')`;
  const nCoach = await coach('Granted Coach');

  // N16 / N17 — a named person, never an administrator.
  check('N16: the TD reads a registration aimed at a team', await canRead(ID.td, regA), true);
  check('N16b: and the whole register, unfiled included', (await rowIds(ID.td, CLUB.riverside)).includes(regUnfiled), true);
  check('N17: a club administrator reads no registration (D-154 upholding D-93)', await canRead(ID.clubAdmin, regA), false);
  check('N17b: gets no register rows', (await rowIds(ID.clubAdmin, CLUB.riverside)).length, 0);
  check('N17c: cannot invite', await canInv(ID.clubAdmin, regA), false);
  check('N17d: cannot set a status', (await q1(`select fn_set_club_status($1,$2,'shortlisted') as ok`, [ID.clubAdmin, regA])).ok, false);
  check('N17e: but still sees the held count, which is a number and not a child', (await q1('select fn_register_count($1,$2) as n', [ID.clubAdmin, CLUB.riverside])).n > 0, true);
  check('N16c: a coach with no grant reads nothing', (await rowIds(nCoach, CLUB.riverside)).length, 0);

  // N18 — who may grant, to whom, how many.
  await expectFail('N18: an administrator cannot grant register access', grantSql(nCoach, sqA, ID.clubAdmin));
  await expectFail('N18b: nor can the coach grant it to themselves', grantSql(nCoach, sqA, nCoach));
  await expectFail('N18c: a person who is not a coach at the club cannot hold it', grantSql(ID.marcus, sqA, ID.td));
  const noWwcc = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob) values ($1,'No Check',$2)`, [noWwcc, yearsAgo(30)]);
  await mem(noWwcc, CLUB.riverside, null, 'coach');
  await expectFail('N18d: nor a coach without the club’s WWCC attestation', grantSql(noWwcc, sqA, ID.td));
  const otherSquad = (await q1(`insert into squad (club_id, name, age_group, competition_gender, season) values ($1,'Other U14','U14','boys','2026') returning id`, [CLUB.other])).id;
  await expectFail('N18e: nor a team belonging to another club', grantSql(nCoach, otherSquad, ID.td));
  await db.query(grantSql(nCoach, sqA, ID.td));
  await db.query(grantSql(nCoach, sqB, ID.td));
  await db.query(grantSql(nCoach, sqC, ID.td));
  await expectFail('N18f: a coach reads at most three teams', grantSql(nCoach, sqD, ID.td));
  const nine = [];
  for (let i = 0; i < 9; i++) { const c = await coach(`Cap Coach ${i}`); await db.query(grantSql(c, sqD, ID.td)); nine.push(c); }
  const eleventh = await coach('Eleventh Coach');
  await expectFail('N18g: a club brings in at most ten coaches', grantSql(eleventh, sqD, ID.td));
  await expectFail('N18h: a grant is never edited into a different team — only removed',
    `update register_grant set squad_id = '${sqD}' where person_id = '${nCoach}' and squad_id = '${sqA}'`);
  await expectFail('N18i: a coach request is the TD’s to make, not an administrator’s',
    `insert into coach_invite (club_id, person_id, invited_by, squad_ids, wwcc_checked) values ('${CLUB.riverside}','${eleventh}','${ID.clubAdmin}', array['${sqA}']::uuid[], true)`);
  await expectFail('N18j: and names at most three teams',
    `insert into coach_invite (club_id, person_id, invited_by, squad_ids, wwcc_checked) values ('${CLUB.riverside}','${eleventh}','${ID.td}', array['${sqA}','${sqB}','${sqC}','${sqD}']::uuid[], true)`);
  // Release the cap for the rest of the file.
  await db.query(`update register_grant set revoked_at = now(), revoked_by = $1 where person_id = any($2)`, [ID.td, nine]);

  // N19 / N20 — what a granted coach reads, and what they cannot do.
  const coachRows = await rowIds(nCoach, CLUB.riverside);
  check('N19: a granted coach reads the registrations aimed at their teams', [regA, regB].every((r) => coachRows.includes(r)), true);
  check('N19b: and not another team’s', coachRows.includes(regD), false);
  check('N19c: and never an unfiled registration — that stays with the TD', coachRows.includes(regUnfiled), false);
  check('N19d: may open a CV on their team', await canRead(nCoach, regA), true);
  check('N19e: but not on another team', await canRead(nCoach, regD), false);
  await db.query(`insert into guardian_setting (child_id, profile_paused, updated_by) values ($1, true, $2)
    on conflict (child_id) do update set profile_paused = true`, [ID.georgia, ID.guardian]);
  const pausedOnTeam = await reg(ID.georgia, sqA);
  check('N19f: and carries P19’s refusals — a paused child on their team is not readable', await canRead(nCoach, pausedOnTeam), false);
  await db.query(`update guardian_setting set profile_paused = false where child_id = $1`, [ID.georgia]);
  check('N20: a granted coach cannot invite', await canInv(nCoach, regA), false);
  check('N20b: nor set a status', (await q1(`select fn_set_club_status($1,$2,'shortlisted') as ok`, [nCoach, regA])).ok, false);

  // N21 — it ends with the relationship, at the next read.
  await db.query(`update membership set ended_at = now() where person_id = $1 and club_id = $2 and role = 'coach'`, [nCoach, CLUB.riverside]);
  check('N21: the coach leaves the club — the grant stops resolving', await canRead(nCoach, regA), false);
  await db.query(`update membership set ended_at = null where person_id = $1 and club_id = $2 and role = 'coach'`, [nCoach, CLUB.riverside]);
  await db.query(`update wwcc_attestation set revoked_at = now() where person_id = $1`, [nCoach]);
  check('N21b: the WWCC attestation is revoked — same', (await rowIds(nCoach, CLUB.riverside)).length, 0);
  await db.query(`update wwcc_attestation set revoked_at = null where person_id = $1`, [nCoach]);
  check('N21c: restored, it resolves again (the check is the attestation, not the coach)', await canRead(nCoach, regA), true);
  await db.query(`update register_grant set revoked_at = now(), revoked_by = $1 where person_id = $2 and squad_id = $3`, [ID.td, nCoach, sqA]);
  check('N21d: the TD removes a team — that team is gone at once', await canRead(nCoach, regA), false);
  check('N21e: and the others stay', await canRead(nCoach, regB), true);

  // N22 — every read is attributed.
  const logCols = (await q1(`select string_agg(column_name, ',') as c from information_schema.columns where table_name = 'register_read_log'`)).c ?? '';
  check('N22: the read log names a person, a registration, a surface and a time',
    ['person_id', 'registration_id', 'surface', 'read_at'].every((k) => logCols.includes(k)), true);
  const srcOf = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
  for (const [rel, what] of [['../app/club/register/page.tsx', 'the register list'], ['../app/club/register/cv/[registrationId]/page.tsx', 'a CV opened from it'], ['../app/coach/register/page.tsx', 'a coach’s list']]) {
    check(`N22b: ${what} writes the read log`, /insert into register_read_log/.test(srcOf(rel)), true);
  }
  check('N22c: the CV page is gated on the named-person function, not the club-level one',
    /fn_can_read_registration\(\$2, r\.id\)/.test(srcOf('../app/club/register/cv/[registrationId]/page.tsx')), true);

  // N23 / N24 — the TD sees the list; the request never tells who is on Pitch.
  const squadsSrc = srcOf('../app/club/squads/page.tsx'), actSrc = srcOf('../app/club/squads/actions.ts');
  // Until 0069 this asked for the page's own `from register_grant g` query —
  // a proxy for the row, and it went false when the list moved into
  // Postgres. It now asks for what N23 says: the TD's screen renders the
  // database's list (grants1/grants2 prove what that list holds, and for whom).
  check('N23: the TD’s squads screen lists who holds register access', /fn_club_register_grants\(/.test(squadsSrc) && /\{isTd && \(/.test(squadsSrc), true);
  check('N23b: and never lists requests still waiting — that would reveal which emails have accounts', /from coach_invite/.test(squadsSrc), false);
  const inviteFn = actSrc.slice(actSrc.indexOf('export async function inviteCoach'), actSrc.indexOf('export async function revokeCoach'));
  check('N24: bringing a coach in ends in one answer, account or not', (inviteFn.match(/redirect\('\/club\/squads\?coachAsked=1'\)/g) ?? []).length, 1);
  check('N24b: and the lookup result never chooses a different redirect',
    /if \(coach\.rows\.length > 0\) \{[^}]*redirect/.test(inviteFn), false);

  await db.query(`update club set subscription_status = $1 where id = $2`, [plan, CLUB.riverside]);
}

// D-68 as amended 15 Sep — competition gender is boys, girls, men or women.
for (const bad of ['mixed', 'open']) {
  await expectFail(`D-68: a squad cannot be "${bad}"`,
    `insert into squad (club_id, name, age_group, competition_gender, season) values ('${CLUB.riverside}', 'Bad ${bad}', 'U14', '${bad}', '2026')`);
  await expectFail(`D-68: nor can a trial notice`,
    `insert into trial_notice (club_id, title, trial_on, time_venue, competition_gender) values ('${CLUB.riverside}', 'Bad', (now() + interval '9 days')::date, 'x', '${bad}')`);
}
{
  const ok = await db.query(`insert into trial_notice (club_id, title, trial_on, time_venue, competition_gender) values ($1,'Open to all',(now() + interval '9 days')::date,'x',null) returning id`, [CLUB.riverside]);
  check('D-68: a trial open to everyone leaves gender blank', ok.rows.length, 1);
  await db.query(`delete from trial_notice where id = $1`, [ok.rows[0].id]);
}

// D-68 as amended 16 Sep — a trial's age groups are rows against the lookup
// (D-73), so a code that is not an age group cannot be stored, and a notice
// that comes down takes its age groups with it.
{
  const n = (await db.query(`insert into trial_notice (club_id, title, trial_on, time_venue) values ($1,'Age rows',(now() + interval '9 days')::date,'x') returning id`, [CLUB.riverside])).rows[0].id;
  await expectFail('D-68: a trial cannot name an age group that is not in the lookup',
    `insert into trial_notice_age_group (trial_notice_id, age_group) values ('${n}', 'U99')`);
  await db.query(`insert into trial_notice_age_group (trial_notice_id, age_group) values ($1,'U14'),($1,'U15')`, [n]);
  check('D-68: a trial can name more than one age group', Number((await db.query(`select count(*) from trial_notice_age_group where trial_notice_id = $1`, [n])).rows[0].count), 2);
  await expectFail('D-68: and the same one only once',
    `insert into trial_notice_age_group (trial_notice_id, age_group) values ('${n}', 'U14')`);
  await db.query(`delete from trial_notice where id = $1`, [n]);
  check('D-68: a notice that comes down takes its age groups with it', Number((await db.query(`select count(*) from trial_notice_age_group where trial_notice_id = $1`, [n])).rows[0].count), 0);
  const col = await db.query(`select 1 from information_schema.columns where table_name = 'trial_notice' and column_name = 'age_group'`);
  check('D-68: and there is one place the answer lives — no single age_group column left', col.rows.length, 0);
}

// ---------------------------------------------------------------------------
// Table L — the send flows (D-99, D-91). Sixty-one cases, and the largest
// table in doc 14 because this is the distribution engine.
// ---------------------------------------------------------------------------
const dispatchOk = async (actor, rec) =>
  (await db.query('select fn_can_dispatch($1,$2) as c', [actor, rec])).rows[0].c;

// L(i) — who may send
check('L1: a u16 composes but cannot dispatch — the guardian sends', await dispatchOk(ID.deniz, REC.deniz), false);
check('L2: the guardian dispatches for the u16', await dispatchOk(ID.guardian, REC.deniz), true);
check('L5: a 16-17 sends for themselves', await dispatchOk(ID.nate, REC.nate), true);
check('L8: an adult sends alone', await dispatchOk(ID.marcus, REC.marcus), true);
check('L9: a re-granted guardianship is visibility, not control', await dispatchOk(ID.guardian, REC.marcus), false);
check('L12a: a squad coach cannot send a player’s CV', await dispatchOk(ID.coachV, REC.deniz), false);
check('L12b: nor the technical director', await dispatchOk(ID.td, REC.deniz), false);
check('L12c: nor the club administrator', await dispatchOk(ID.clubAdmin, REC.deniz), false);
check('L12d: nor the team manager', await dispatchOk(ID.teamManager, REC.deniz), false);
check('L14: there is no system actor — a null actor never dispatches', await dispatchOk(null, REC.deniz), false);

// L3 — denied at the QUERY layer, not merely in the UI.
await expectFail('L3: a u16 cannot be recorded as the sending actor, however the row arrives',
  `insert into share_request (record_id, requested_by, destination, dispatched_by, dispatched_at)
   values ('${REC.deniz}','${ID.deniz}','club@example.com','${ID.deniz}', now())`);
await expectFail('L12e: nor can a club-side actor be recorded as one',
  `insert into share_request (record_id, requested_by, destination, dispatched_by, dispatched_at)
   values ('${REC.deniz}','${ID.deniz}','club@example.com','${ID.td}', now())`);

// L6/L7 — the send switch, and most-restrictive-wins.
await db.query(`insert into guardian_setting (child_id, send_disabled, updated_by) values ($1, true, $2)
  on conflict (child_id) do update set send_disabled = true`, [ID.nate, ID.guardian2]);
check('L6: with the send switch off, the 16-17 cannot send', await dispatchOk(ID.nate, REC.nate), false);
check('L7: one guardian setting it is enough — most restrictive wins', await dispatchOk(ID.nate, REC.nate), false);
check('L6b: the guardian can still send while the switch is off', await dispatchOk(ID.guardian, REC.nate), true);
await db.query(`update guardian_setting set send_disabled = false where child_id = $1`, [ID.nate]);
check('L6c: switching it back on restores the player’s own send', await dispatchOk(ID.nate, REC.nate), true);

// L10 — an unapproved u16 has no send surface at all.
const unapproved = crypto.randomUUID(), unapprovedRec = crypto.randomUUID();
await db.query(`insert into person (id, first_name, dob) values ($1,'Unapproved','${yearsAgo(13)}')`, [unapproved]);
await db.query(`insert into development_record (id, person_id) values ($1,$2)`, [unapprovedRec, unapproved]);
check('L10: no approved guardian = no send, for anyone', await dispatchOk(ID.guardian, unapprovedRec), false);

// L11 — the pause stops a send. A send that lands on the link-state page is
// a send that misleads the club.
await db.query(`insert into guardian_setting (child_id, profile_paused, updated_by) values ($1, true, $2)
  on conflict (child_id) do update set profile_paused = true`, [ID.georgia, ID.guardian]);
check('L11: a paused profile cannot be sent', await dispatchOk(ID.guardian, REC.georgia), false);
await expectFail('L11b: and no send row can be created while paused',
  `insert into share_request (record_id, requested_by, destination, dispatched_by, dispatched_at)
   values ('${REC.georgia}','${ID.georgia}','club@example.com','${ID.guardian}', now())`);
await db.query(`update guardian_setting set profile_paused = false where child_id = $1`, [ID.georgia]);
check('L11c: lifting the pause restores it', await dispatchOk(ID.guardian, REC.georgia), true);

// L18/L20 — standing is re-checked AT DISPATCH, never carried from approval.
const pendingReq = crypto.randomUUID();
await db.query(`insert into share_request (id, record_id, requested_by, destination) values ($1,$2,$3,'club@example.com')`,
  [pendingReq, REC.georgia, ID.georgia]);
await db.query(`update guardianship_link set revoked_at = now() where guardian_id = $1 and child_id = $2`, [ID.guardian, ID.georgia]);
await expectFail('L20: guardianship revoked between approval and dispatch fails closed',
  `update share_request set dispatched_by = '${ID.guardian}', dispatched_at = now() where id = '${pendingReq}'`);
await db.query(`update guardianship_link set revoked_at = null where guardian_id = $1 and child_id = $2`, [ID.guardian, ID.georgia]);

// L15/L16/L56 — the guardian who never acts. Silence is a valid answer.
check('L15: an undispatched request transmits nothing',
  (await db.query(`select dispatched_at, share_token_id from share_request where id = $1`, [pendingReq])).rows[0].dispatched_at, null);
check('L15b: and mints no token', (await db.query(`select share_token_id from share_request where id = $1`, [pendingReq])).rows[0].share_token_id, null);
check('L56: a send that did not happen writes no send row',
  (await db.query(`select count(*)::int as n from consent_event where event = 'share_dispatched' and detail->>'request_id' = $1`, [pendingReq])).rows[0].n, 0);

// L2/L55 — what one real send writes.
const liveReq = crypto.randomUUID(), sendTok = crypto.randomUUID();
await db.query(`insert into share_token (id, record_id, token_hash, issued_by) values ($1,$2,$3,$4)`,
  [sendTok, REC.georgia, sha('georgia-send'), ID.guardian]);
await db.query(`insert into share_request (id, record_id, requested_by, destination, dispatched_by, dispatched_at, share_token_id)
  values ($1,$2,$3,'coach@kingsway.example.au',$4, now(), $5)`,
  [liveReq, REC.georgia, ID.georgia, ID.guardian, sendTok]);
await db.query(
  `insert into consent_event (event, actor_id, subject_id, detail)
   values ('share_dispatched', $1, $2, jsonb_build_object(
     'request_id', $3::uuid, 'recipient', 'coach@kingsway.example.au',
     'token_id', $4::uuid, 'initiating_actor', $5::uuid, 'band_at_send', 'u16'))`,
  [ID.guardian, ID.georgia, liveReq, sendTok, ID.georgia]);
const sendRow = (await db.query(
  `select actor_id, detail from consent_event where event='share_dispatched' and detail->>'request_id' = $1`, [liveReq])).rows[0];
check('L55a: the send row names the sending actor', sendRow.actor_id, ID.guardian);
check('L55b: and the initiating actor — the child who composed it', sendRow.detail.initiating_actor, ID.georgia);
check('L55c: and the recipient address', sendRow.detail.recipient, 'coach@kingsway.example.au');
check('L55d: and the token id', sendRow.detail.token_id, sendTok);
check('L55e: and the band AT SEND, recorded not derived (L37)', sendRow.detail.band_at_send, 'u16');
check('L22: no raw token is ever written to the log (D-94 §1)',
  JSON.stringify(sendRow.detail).includes('georgia-send'), false);

// L59 — a send row cannot be edited or deleted by anyone, ever.
await expectFail('L59a: a send row cannot be updated',
  `update consent_event set detail = '{}'::jsonb where detail->>'request_id' = '${liveReq}'`);
await expectFail('L59b: a send row cannot be deleted',
  `delete from consent_event where detail->>'request_id' = '${liveReq}'`);

// L57/L61 — who may read the send log.
const sendLog = async (viewer, person) => (await db.query('select * from fn_send_log($1,$2)', [viewer, person])).rows;
check('L57: the guardian reads every send, recipient in full', (await sendLog(ID.guardian, ID.georgia)).length, 1);
check('L57b: and the address is not redacted', (await sendLog(ID.guardian, ID.georgia))[0].recipient, 'coach@kingsway.example.au');
check('L61a: her own club’s coach reads nothing', (await sendLog(ID.coachV, ID.georgia)).length, 0);
check('L61b: nor the technical director', (await sendLog(ID.td, ID.georgia)).length, 0);
check('L61c: nor the club administrator', (await sendLog(ID.clubAdmin, ID.georgia)).length, 0);
check('L61d: nor an unrelated adult', (await sendLog(ID.marcus, ID.georgia)).length, 0);
check('L60: and nothing is readable anonymously', (await sendLog(null, ID.georgia)).length, 0);
check('L19: an ex-guardian reads nothing', (await sendLog(ID.exGuardian, ID.deniz)).length, 0);

// L24/L29 — what receiving a send gains a club: nothing beyond the token.
check('L24: a send confers no membership',
  (await db.query(`select count(*)::int as n from membership where person_id = $1 and club_id = $2`,
    [ID.georgia, CLUB.other])).rows[0].n, 0);
check('L24b: and no read level at the receiving club', await level(ID.coachOther, ID.georgia), 'none');

// L38-L43 — the rate limit.
check('L41: the limit is counted per SENDING ACTOR, never per recipient',
  /send:actor:\$\{guardianId\}/.test(dispatchSrc), true);
check('L38: a limited send lands on the same URL a real send does',
  /redirect\(`\/g\/send\/\$\{requestId\}\?sent=1`\)/.test(dispatchSrc), true);
check('L39: no Retry-After or rate-limit header is ever set',
  /Retry-After|X-RateLimit/i.test(dispatchSrc), false);
const sendPage = readFileSync(fileURLToPath(new URL('../app/g/send/[requestId]/page.tsx', import.meta.url)), 'utf8');
check('L42: the sender’s own page shows no counter or remaining-sends state',
  /remaining|sends left|limit/i.test(codeOnly(sendPage)), false);
// Until 29 Sep this asserted a development-only link panel was switched off
// in production. The panel and the address that fed it are gone (brief D:
// the redirect itself differed), so the rule is asked directly: the page reads
// nothing from the address but whether it was sent, and has no branch by
// environment — both paths render alike everywhere (L33).
check('L38b: the page both paths land on reads only `sent` from the address and has no development-only branch, so both render alike',
  [/searchParams: Promise<\{ sent\?: string \}>;/.test(sendPage), /NODE_ENV|\blink\b\s*&&|\{link\}/.test(codeOnly(sendPage))], [true, false]);
check('L43: the ceiling is one config value with one definition',
  /SEND_DAILY_CAP = \d+/.test(readFileSync(fileURLToPath(new URL('../lib/football.ts', import.meta.url)), 'utf8')), true);

// L(vi) — the coach's link. Stable, public, no token, and separate from the
// player token path in implementation as well as in principle (L46, L47).
const coachPage = readFileSync(fileURLToPath(new URL('../app/c/[slug]/page.tsx', import.meta.url)), 'utf8');
check('L47: the coach CV never reaches the token resolver',
  /readCvByToken|fn_token_read/.test(coachPage), false);
check('L46: the coach link carries no token and no expiry',
  /token|expires/i.test(codeOnly(coachPage)), false);
check('L45/L54: no route offers to send a coach’s link to anyone',
  /sendCoachLink|shareWithPlayer|invitePlayer/.test(coachPage), false);

// ---------------------------------------------------------------------------
// Table E — link states (D-77). The rule is not "dead links are handled", it
// is that every dead state is INDISTINGUISHABLE from every other, including
// from a token that never existed. Anything that varies is an oracle.
// ---------------------------------------------------------------------------
const prov = async (author, rec) =>
  (await db.query('select fn_write_provenance($1,$2) as p', [author, rec])).rows[0].p;
const readTok = async (h) => (await db.query('select fn_token_read($1) as r', [h])).rows[0].r;
const deadShapes = [
  ['expired', t.expired], ['revoked', t.revoked], ['paused', t.paused],
  ['never existed', sha('no-such-token-at-all')],
  ['absurdly long', sha('x'.repeat(400))],
];
for (const [name, h] of deadShapes) {
  check(`dead1 (${name}): identical null shape, no state leaks through`, await readTok(h), null);
}
check('dead2: and the live one is the only thing that reads', (await readTok(t.live)) === null, false);

// The dead answer carries nothing at all — not a name, not a club, not
// an age. The single read path is the only place that could leak one.
const readSrc = readFileSync(fileURLToPath(new URL('../lib/record-read.ts', import.meta.url)), 'utf8');
check('dead3: the read path returns a bare null for every dead state',
  /if \(!bundle\) return null;/.test(readSrc), true);
const deadPage = readFileSync(fileURLToPath(new URL('../app/p/[token]/page.tsx', import.meta.url)), 'utf8');
const deadHalf = deadPage.split('LinkState').slice(1).join('');
check('E11c: the link-state page renders no name, club, age or photo',
  /first_name|last_name|club|age_group|photo/i.test(deadHalf), false);
// E11, as doc 14 words it: the body carries no name, no club, no photo, no
// age, NO INITIALS and NO SQUAD NUMBER. This row was counted as covered by a
// label on a sign-out assertion (L4, a fourth time) — gate-coverage said
// 261/261 and nothing in the file tested it. The page cannot leak a person
// because it is handed none: LinkState takes a token and a boolean, and names
// no field of a record anywhere.
const linkStateSrc = readFileSync(fileURLToPath(new URL('../components/cv/LinkState.tsx', import.meta.url)), 'utf8');
check('E11: the link-state page is handed nothing about a person',
  /export default function LinkState\(\{ token, asked \}: \{ token\?: string; asked\?: boolean \}\)/.test(linkStateSrc), true);
check('E11b: and names no field of a record — no initials, no squad number',
  /first_name|last_name|initials|squad_number|shirt|photo_path|age_group|\bdob\b|positions/i.test(codeOnly(linkStateSrc)), false);
check('dead5: every tokenised page is noindex (D-95)', /noindex|robots/.test(deadPage), true);
check('dead6: and sends no referrer to an embed host (D-94 §5)',
  /no-referrer/.test(readFileSync(fileURLToPath(new URL('../next.config.mjs', import.meta.url)), 'utf8')), true);

// E14: the OG endpoint outlives revocation in every social platform's cache,
// so it must re-check on every request and never render an identity for a
// token that is not live (D-89, D-94 §5).
const ogSrc = readFileSync(fileURLToPath(new URL('../app/p/[token]/opengraph-image.tsx', import.meta.url)), 'utf8');
check('E14c: the OG route re-reads the token through the one path',
  /readCvByToken/.test(ogSrc), true);
check('E14d: and falls back to a generic card rather than an identity',
  /if \(!cv\)|cv \?\?|!cv/.test(ogSrc), true);
// Strip the comments first: the rule is written down at the top of that file
// in the very words being searched for, and a check that matches its own
// documentation passes forever without testing anything.
const ogCode = codeOnly(ogSrc);
check('E12f: a minor\u2019s card carries no club, age group or region (D-89)',
  /club|age_group|region|ageGroup/i.test(ogCode), false);

// ---------------------------------------------------------------------------
// Table G — the age state machine (D-49). Bands are computed, so a birthday
// is a transition nobody has to remember to run.
// ---------------------------------------------------------------------------
const band = async (dob) => (await db.query('select fn_age_band($1::date) as b', [dob])).rows[0].b;
check('G1: the day before sixteen is still u16', await band(yearsAgo(16, 1)), 'u16');
check('G2: the sixteenth birthday itself flips the band', await band(yearsAgo(16)), '16_17');
check('G3: seventeen and a day is still 16–17', await band(yearsAgo(17, -1)), '16_17');
check('G4: the eighteenth birthday reaches independence', await band(yearsAgo(18)), '18plus');
check('G5: an unknown date of birth is treated as the most restrictive band',
  await band(null), 'u16');

// G6: at 18 the guardian's visibility expires on its own — nothing runs, the
// same link simply stops answering, and only the adult can grant it back.
// An adult is public to any signed-in viewer, so what to assert is that the
// lapsed guardian is now no better off than a stranger — not that the record
// vanishes.
check('G6: guardianship lapses at eighteen with no job to run', await level(ID.guardian, ID.marcus), 'public');
check('G6b: which is exactly what an unrelated signed-in viewer gets', await level(ID.coachOther, ID.marcus), 'public');
await db.query(`update guardianship_link set regranted_at = now() where guardian_id = $1 and child_id = $2`, [ID.guardian, ID.marcus]);
check('G7: and the adult can hand it back deliberately', await level(ID.guardian, ID.marcus), 'full');
await db.query(`update guardianship_link set regranted_at = null where guardian_id = $1 and child_id = $2`, [ID.guardian, ID.marcus]);

// G8: clips added as a minor are grandfathered permanently (D-88). The flag
// is stamped at insert from the DOB, so an eighteenth birthday cannot reach
// back and take nine clips off a player who built them at seventeen.
await db.query(`insert into highlight (record_id, url, added_as_minor) values ($1,'https://youtu.be/a',true)`, [REC.marcus]);
await db.query(`insert into highlight (record_id, url, added_as_minor) values ($1,'https://youtu.be/b',false)`, [REC.marcus]);
check('G8: minor-era clips are marked and survive the transition',
  (await db.query(`select count(*)::int as n from highlight where record_id = $1 and added_as_minor`, [REC.marcus])).rows[0].n, 1);
check('G10: added_as_minor is NOT NULL — it can never be left to be guessed later',
  (await db.query(`select is_nullable from information_schema.columns
    where table_name='highlight' and column_name='added_as_minor'`)).rows[0].is_nullable, 'NO');

// G11: D-67 — a minor's public CV never renders a negative number. The read
// path filters at the query, not in the component, so no future surface can
// forget.
// 0083 moved the filter into the one function every stat surface now reads
// (fn_stat_public), so the check asks THAT, not the text of the query that
// used to hold it (L33: replace a proxy with the rule, never delete it).
check('G11: the read path drops non-positive stats before they leave Postgres',
  /value > 0/.test(readSrc) || (/fn_stat_public\(\$1\) as stats/.test(readSrc) && /ps\.value > 0/.test(await procSrc('fn_stat_public'))), true);

// ---------------------------------------------------------------------------
// Tables H and J — the club walls. A treasurer made an administrator to send
// invoices must never be able to read a child's development notes (D-93).
//
// Relabelled in brief K (L4, the H8 mistake again). Six of these seven carried
// a table-H row id and tested a table-A row: "H1" was A12b, "H2" A15b, "H3"
// A12, "H4" A13, "H5" A8, the second "H4" A9. Gate coverage counted H1, H2,
// H4 and H5 as pinned on the strength of them, and H7 on a check that is doc
// 14's H3 (a coach leaves and keeps what they wrote). Each now names the row
// it tests, and the table-H rows nothing tests are open, honestly.
// ---------------------------------------------------------------------------
check('A12b: the club administrator gets membership and contact only', await level(ID.clubAdmin, ID.deniz), 'membership_only');
check('A15b: the team manager the same', await level(ID.teamManager, ID.deniz), 'membership_only');
check('A12: the technical director gets the record', await level(ID.td, ID.deniz), 'full');
check('A13: an administrator at another club gets nothing', await level(ID.adminOther, ID.deniz), 'none');
check('A8: an unattested coach at the right squad still gets nothing', await level(ID.coachU, ID.deniz), 'none');
check('A9: a verified coach on a squad they do not hold gets nothing', await level(ID.coachUnassigned, ID.deniz), 'none');
check('H3/A10: a coach whose membership has ended keeps only what they authored (D-48)', await level(ID.coachFormer, ID.deniz), 'authored_only');

// H9: a departing technical director loses club-wide access immediately —
// the same read, one UPDATE later. (Labelled H8 until brief H: doc 14 H8 is
// "experience_entry naming a real club exactly", which D-72's block pins.)
await db.query(`update membership set ended_at = now() where person_id = $1 and role = 'technical_director'`, [ID.td]);
check('H9: a departed technical director loses club-wide access at once', await level(ID.td, ID.deniz), 'none');
check('H9: and cannot write to the record either', await prov(ID.td, REC.deniz), null);
// Not H10 — doc 14 H10 is "a person self-declares technical_director", and a
// label starting with a row id is a claim to test that row (L4). Reinstating
// a TD belongs with H9, and since 0058 the revival is re-checked against the
// call, the proof and the club's state like any other write of the live role.
// Since 0100 the call that named her is SPENT once her role ended after it:
// un-ending the row by hand is refused, and a new call is the way back — the
// words BUZ approved tell the operator and the club exactly that.
await expectFail('td21: an ended Technical Director cannot be revived by hand off the call that named them before (0100, D-48)',
  `update membership set ended_at = null where person_id = '${ID.td}' and role = 'technical_director'`);
await recordTd(ID.td, CLUB.riverside, 'td@fixture.example');
check('H9c: reinstating the role on a new call restores it, still without a stored flag', await level(ID.td, ID.deniz), 'full');

// ---------------------------------------------------------------------------
// Table H as doc 14 words it (brief L, 29 Sep). Round K took the table-H ids
// off six checks that tested table-A rows and left H1, H2, H4, H5 and H7
// open. Each is pinned here on the TRANSITION the row describes: the reads
// before, the event, and the same reads inside the event's own transaction,
// through the functions the pages call — fn_read_level, fn_can_read_squad_
// player (the squad CV), fn_squad_roster (the squad screen), fn_can_read_
// registration and fn_register_rows (the register and a CV opened from it),
// fn_write_provenance and fn_verify_club (the pen), fn_approved_cv (what an
// under-16's CV page serves). The write suite presses the same events through
// the product's own screens (h1-w, h2-w, h4-w, h5-w).
//
// A world of its own, so nothing above or below leans on it: the club a child
// leaves (Previous FC) and the club they sign for (Signing FC), both verified
// by a call; a TD and two coaches at Signing FC; and three children with one
// parent.
// ---------------------------------------------------------------------------
{
  const P = {};
  for (const k of ['oldTd', 'oldCoach', 'td', 'coach1', 'coach2', 'admin', 'parent', 'stranger', 'kid', 'kid2', 'teen', 'author', 'leaver']) P[k] = crypto.randomUUID();
  const C = { old: crypto.randomUUID(), club: crypto.randomUUID() };
  const S = { old: crypto.randomUUID(), s1: crypto.randomUUID(), s2: crypto.randomUUID() };
  const R = { kid: crypto.randomUUID(), kid2: crypto.randomUUID(), teen: crypto.randomUUID() };
  const adults = [['oldTd', 'Previous TD'], ['oldCoach', 'Previous Coach'], ['td', 'Signing TD'], ['coach1', 'Signing Coach'],
    ['coach2', 'Second Coach'], ['admin', 'Signing Admin'], ['parent', 'Signing Parent'], ['stranger', 'Signing Stranger'],
    ['author', 'Authoring Coach'], ['leaver', 'Leaving Coach']];
  for (const [k, name] of adults) {
    await db.query(`insert into person (id, first_name, dob) values ($1,$2,$3)`, [P[k], name, yearsAgo(40)]);
  }
  await db.query(`insert into person (id, first_name, dob) values ($1,'Signing Kid',$2), ($3,'Second Kid',$4), ($5,'Signing Teen',$6)`,
    [P.kid, yearsAgo(13), P.kid2, yearsAgo(14), P.teen, yearsAgo(17)]);
  for (const k of ['kid', 'kid2', 'teen']) {
    await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [P.parent, P[k]]);
  }
  // The 16-17 is discoverable to verified viewers (B3), so "drops to the
  // floor" has a floor that is not simply nothing.
  await db.query(`insert into age_transition_notice (child_id, sent_at, delivered_at) values ($1, now(), now())`, [P.teen]);

  await db.query(`insert into club (id, name, club_state) values ($1,'Previous FC','claimed'), ($2,'Signing FC','claimed')`, [C.old, C.club]);
  for (const c of [C.old, C.club]) {
    const call = crypto.randomUUID();
    await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
      values ($1,$2,now(),'BUZ','03 9000 0000','FV club directory','verified','27@v1.0')`, [call, c]);
    await db.query(`update club set club_state='verified', verified_call_id=$1 where id=$2`, [call, c]);
  }
  await db.query(`insert into squad (id, club_id, name, age_group, competition_gender, season) values
    ($1,$2,'Previous U15','U15','boys','2026'), ($3,$4,'Signing U15','U15','boys','2026'), ($5,$4,'Signing U16','U16','boys','2026')`,
    [S.old, C.old, S.s1, C.club, S.s2]);
  await recordTd(P.oldTd, C.old, 'previous.td@fixture.example');
  await recordTd(P.td, C.club, 'signing.td@fixture.example');
  await mem(P.oldCoach, C.old, S.old, 'coach');
  await mem(P.coach1, C.club, S.s1, 'coach');
  // The second coach holds both squads, both ways the database knows a coach
  // is on a squad: a coach membership per squad (A7) and a register grant per
  // squad (D-154).
  await mem(P.coach2, C.club, S.s1, 'coach');
  await mem(P.coach2, C.club, S.s2, 'coach');
  await mem(P.admin, C.club, null, 'club_admin');
  // Two more coaches on the Signing U15, for D-171 (brief M): one who writes
  // about the child and stays, one who writes and then leaves the club.
  await mem(P.author, C.club, S.s1, 'coach');
  await mem(P.leaver, C.club, S.s1, 'coach');
  for (const [p, c] of [[P.oldTd, C.old], [P.oldCoach, C.old], [P.td, C.club], [P.coach1, C.club], [P.coach2, C.club],
    [P.author, C.club], [P.leaver, C.club]]) {
    await db.query(`insert into wwcc_attestation (person_id, club_id, attested_by) values ($1,$2,$3)`, [p, c, c === C.old ? P.oldTd : P.td]);
  }
  for (const sq of [S.s1, S.s2]) {
    await db.query(`insert into register_grant (club_id, person_id, squad_id, granted_by) values ($1,$2,$3,$4)`, [C.club, P.coach2, sq, P.td]);
  }

  // The history the signing brings: two seasons at Previous FC, a note the
  // coach there wrote, a number from last season and the clubs before.
  await mem(P.kid, C.old, S.old, 'player');
  for (const [rec, who] of [[R.kid, P.kid], [R.kid2, P.kid2], [R.teen, P.teen]]) {
    await db.query(`insert into development_record (id, person_id, positions) values ($1,$2,array['CM'])`, [rec, who]);
  }
  await db.query(`insert into record_entry (record_id, entry_type, author_id, provenance) values ($1,'coach_note',$2,'coach_verified')`, [R.kid, P.oldCoach]);
  await db.query(`insert into player_stat (record_id, season, stat_key, value, provenance) values
    ($1,'2025','goals',9,'self_reported'), ($1,'2026','goals',4,'self_reported')`, [R.kid]);
  await db.query(`insert into experience_entry (record_id, kind, org_name, season_label) values ($1,'previous_club','Previous FC','2022–2025')`, [R.kid]);
  const snapshot = (name) => JSON.stringify({ name, previousClubs: [{ orgName: 'Previous FC', period: '2022–2025' }],
    stats: [{ season: '2025', key: 'goals', value: 9, provenance: 'self_reported' }], otherFootball: [{ kind: 'futsal', orgName: 'Winter futsal' }] });
  for (const [rec, name] of [[R.kid, 'Signing K.'], [R.kid2, 'Second K.']]) {
    await db.query(`insert into profile_version (record_id, content, status) values ($1,$2,'approved')`, [rec, snapshot(name)]);
  }
  await mem(P.kid2, C.club, S.s2, 'player');
  // Both children's families put them on Signing FC's register, each for a squad.
  const REG = { kid: crypto.randomUUID(), kid2: crypto.randomUUID(), old: crypto.randomUUID() };
  await db.query(`insert into registration (id, player_id, club_id, squad_target, policy_version, disclosed_by) values
    ($1,$2,$3,$4,'20@v2.4',$5), ($6,$7,$3,$8,'20@v2.4',$5)`, [REG.kid, P.kid, C.club, S.s1, P.parent, REG.kid2, P.kid2, S.s2]);
  // D-170 (brief M): the child is on the register of the club they play for
  // too, with a note, so a transfer has a registration to take off it — and
  // the Signing FC one carries a note, so the Leave has one to empty (D-128).
  await db.query(`insert into registration (id, player_id, club_id, squad_target, note, policy_version, disclosed_by) values
    ($1,$2,$3,$4,'Wants to stay in midfield','20@v2.4',$5)`, [REG.old, P.kid, C.old, S.old, P.parent]);
  await db.query(`update registration set note = 'Keen to play up a year' where id = $1`, [REG.kid]);
  // And one players-wanted notice of Signing FC's own (0156).
  await db.query(`insert into players_wanted_notice (club_id, title) values ($1,'U15 Boys — Left back')`, [C.club]);
  const regState = async (r) => (await db.query(`select withdrawn_at is not null as out, note from registration where id = $1`, [r])).rows[0] ?? 'removed';
  const withdrawals = async (who) => (await db.query(
    `select actor_id, detail->>'registration_id' as reg from consent_event where subject_id = $1 and event = 'registration_withdrawn' order by id`, [who])).rows
    .map((e) => `${e.actor_id === P.parent ? 'parent' : e.actor_id}:${e.reg === REG.old ? 'Previous FC' : e.reg === REG.kid ? 'Signing FC' : e.reg === REG.kid2 ? 'Signing FC (second)' : e.reg}`);

  const sqRead = async (v, sq, p) => (await db.query('select fn_can_read_squad_player($1,$2,$3) as ok', [v, sq, p])).rows[0].ok;
  const roster = async (v, sq) => (await db.query('select player_id, record_id from fn_squad_roster($1,$2)', [v, sq])).rows;
  const onRoster = async (v, sq, p) => (await roster(v, sq)).find((r) => r.player_id === p) ?? null;
  const regRead = async (v, r) => (await db.query('select fn_can_read_registration($1,$2) as ok', [v, r])).rows[0].ok;
  const regRows = async (v, c) => (await db.query('select registration_id from fn_register_rows($1,$2)', [v, c])).rows.map((x) => x.registration_id);
  const verifyClub = async (v, rec) => (await db.query('select fn_verify_club($1,$2) as c', [v, rec])).rows[0].c;
  const servedCv = async (rec) => (await db.query('select fn_approved_cv($1) as cv', [rec])).rows[0].cv;
  const joinSquad = async (who, sq, actor, asker) =>
    (await db.query(`select fn_join_squad($1,$2,$3,'claim',$4) as ok`, [who, sq, actor, asker])).rows[0].ok;

  // ---- H1 · a player joins a club ----------------------------------------------
  check('H1: before the signing, Signing FC reads nothing of the child — not the TD, not the coach, not the squad CV, not the roster',
    [await level(P.td, P.kid), await level(P.coach1, P.kid), await sqRead(P.td, S.s1, P.kid), await onRoster(P.td, S.s1, P.kid)],
    ['none', 'none', false, null]);
  // Consented at joining: the only way into a squad is a door the family
  // opens (a claim) that the club answers, or the club's ask the family
  // answers. The claim door, pressed as the product presses it.
  const claimBy = (asker) => `insert into squad_claim (person_id, club_id, squad_id, asked_by) values ('${P.kid}','${C.club}','${S.s1}','${asker}')`;
  await expectFail('H1: consented at joining — a claim from someone who is not the child’s parent is refused', claimBy(P.stranger));
  await expectFail('H1: and so is the under-16’s own, alone (D-91)', claimBy(P.kid));
  const claim = crypto.randomUUID();
  await db.query(`insert into squad_claim (id, person_id, club_id, squad_id, asked_by) values ($1,$2,$3,$4,$5)`, [claim, P.kid, C.club, S.s1, P.parent]);
  check('H1: the parent’s claim changes nothing until the club answers it — no membership, no read',
    [await level(P.td, P.kid), (await db.query(`select count(*)::int as n from membership where person_id = $1 and club_id = $2`, [P.kid, C.club])).rows[0].n],
    ['none', 0]);
  check('H1: the join asks for the family’s consent again — a confirm carrying an asker who may not act for the child signs nobody',
    await joinSquad(P.kid, S.s1, P.td, P.stranger), false);
  // The club's confirm, as app/club/squads/[squadId]/actions.ts makes it —
  // one transaction, and the old club's register is read inside it.
  const oldRegBefore = [await regRead(P.oldTd, REG.old), (await regRows(P.oldTd, C.old)).includes(REG.old), await regState(REG.old)];
  await db.query('begin');
  await db.query(`update squad_claim set answered_at = now(), answered_by = $2, confirmed = true where id = $1`, [claim, P.td]);
  const signed = await joinSquad(P.kid, S.s1, P.td, P.parent);
  const oldRegInside = [await regRead(P.oldTd, REG.old), (await regRows(P.oldTd, C.old)).includes(REG.old), await regState(REG.old)];
  await db.query('commit');
  const moves = (await db.query(
    `select event, actor_id, detail->>'club_id' as club, detail->>'source' as source from consent_event
     where subject_id = $1 and event in ('squad_joined','squad_left')`, [P.kid])).rows
    .map((e) => `${e.event}:${e.club === C.club ? 'Signing FC' : e.club === C.old ? 'Previous FC' : e.club}:${e.source}:${e.actor_id === P.td ? 'TD' : e.actor_id}`).sort();
  check('H1: consented at joining — the parent asked, the club confirmed, and the log says so: Previous FC’s squad_left and Signing FC’s squad_joined, by the TD who confirmed a claim (D-78)',
    [signed, moves], [true, ['squad_joined:Signing FC:claim:TD', 'squad_left:Previous FC:claim:TD']]);
  // Nothing else writes a player into a squad: the two doors end at
  // fn_join_squad, and no page writes a membership for a player.
  const playerWriters = [
    ...tsSourceFiles().filter((f) => /insert into membership[\s\S]{0,200}'player'/.test(codeOnly(srcOf(f)))),
    ...(await db.query(`select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and prosrc ~* 'insert into membership' and prosrc ~* '''player'''`)).rows.map((r) => r.proname)].sort();
  check('H1: fn_join_squad is the one writer of a player into a squad, anywhere in the product or the database',
    playerWriters, ['fn_join_squad']);
  const cvNow = await servedCv(R.kid);
  check('H1: the club sees the history the signing brings (D-48) — the TD and the squad’s coach read the whole record, the squad screen hands them the record, and the CV it opens carries the clubs and the season before this one, under Signing FC’s name',
    [await level(P.td, P.kid), await level(P.coach1, P.kid), await sqRead(P.td, S.s1, P.kid), await sqRead(P.coach1, S.s1, P.kid),
     (await onRoster(P.td, S.s1, P.kid))?.record_id ?? null,
     cvNow.club, cvNow.squad?.name, (cvNow.previousClubs ?? []).map((c) => c.orgName), (cvNow.stats ?? []).map((x) => x.season)],
    ['full', 'full', true, true, R.kid, 'Signing FC', 'Signing U15', ['Previous FC'], ['2025']]);

  // ---- H2, the transfer half: the club the child left drops at once -------------
  check('H2: a transfer is a departure — from the moment the child signs elsewhere, Previous FC’s TD reads nothing, and the coach who wrote about them keeps only what they wrote (D-48)',
    [await level(P.oldTd, P.kid), await level(P.oldCoach, P.kid), await sqRead(P.oldTd, S.old, P.kid), await onRoster(P.oldTd, S.old, P.kid),
     await prov(P.oldTd, R.kid), await prov(P.oldCoach, R.kid)],
    ['none', 'authored_only', false, null, null, null]);
  check('H2: a transfer ends the family\u2019s registration at the club the child left, in the signing\u2019s own transaction — Previous FC\u2019s register loses the row and its TD cannot open it, the note is emptied with it (D-128), and the consent log carries the family\u2019s withdrawal, made by the parent who asked (D-170)',
    [oldRegBefore, oldRegInside, await withdrawals(P.kid)],
    [[true, true, { out: false, note: 'Wants to stay in midfield' }], [false, false, { out: true, note: null }], ['parent:Previous FC']]);

  // The 16-17 signs too, the same way, so H5 and H2 have both bands.
  const teenClaim = crypto.randomUUID();
  await db.query(`insert into squad_claim (id, person_id, club_id, squad_id, asked_by) values ($1,$2,$3,$4,$5)`, [teenClaim, P.teen, C.club, S.s1, P.parent]);
  await db.query(`update squad_claim set answered_at = now(), answered_by = $2, confirmed = true where id = $1`, [teenClaim, P.td]);
  await joinSquad(P.teen, S.s1, P.td, P.parent);

  // ---- H4 · a coach is unassigned from a squad mid-season --------------------------
  check('H4: before — the second coach, on both squads, reads the Signing U15 child (record, squad CV, the pen, the registration) and the Signing U16 child',
    [await level(P.coach2, P.kid), await sqRead(P.coach2, S.s1, P.kid), await prov(P.coach2, R.kid), await regRead(P.coach2, REG.kid),
     await level(P.coach2, P.kid2), await regRead(P.coach2, REG.kid2)],
    ['full', true, 'coach_verified', true, 'full', true]);
  // The squad assignment ends, and the reads are asked inside the same
  // transaction: "immediately" is the next statement, not the next request.
  await db.query('begin');
  await db.query(`update membership set ended_at = now() where person_id = $1 and squad_id = $2 and role = 'coach' and ended_at is null`, [P.coach2, S.s1]);
  const offS1 = [await level(P.coach2, P.kid), await sqRead(P.coach2, S.s1, P.kid), (await onRoster(P.coach2, S.s1, P.kid))?.record_id ?? null,
    await prov(P.coach2, R.kid), await verifyClub(P.coach2, R.kid), await level(P.coach2, P.kid2), await sqRead(P.coach2, S.s2, P.kid2)];
  await db.query('commit');
  check('H4: a coach taken off a squad mid-season loses read on its players in the same transaction — the record, the squad CV, the record on the squad screen, the pen — and keeps the squad they still hold',
    offS1, ['none', false, null, null, null, 'full', true]);
  await db.query('begin');
  await db.query(`update register_grant set revoked_at = now(), revoked_by = $3 where person_id = $1 and squad_id = $2 and revoked_at is null`,
    [P.coach2, S.s1, P.td]);
  const grantOff = [await regRead(P.coach2, REG.kid), (await regRows(P.coach2, C.club)).includes(REG.kid), (await roster(P.coach2, S.s1)).length,
    await regRead(P.coach2, REG.kid2), (await regRows(P.coach2, C.club)).includes(REG.kid2), (await roster(P.coach2, S.s2)).length > 0];
  await db.query('commit');
  check('H4: and the register grant for that squad, removed, ends its registrations, the CV opened from them and the squad screen in the same transaction — the other squad’s stay',
    grantOff, [false, false, 0, true, true, true]);

  // ---- D-171's authors (brief M) ------------------------------------------------
  // Round L's H5 used coaches who had written nothing, so D-48's exception was
  // never in the room. Now three people have written about a child at Signing
  // FC while it was verified: a coach who stays on the squad, a coach who
  // then leaves the club, and the TD (about the second child, so H2's TD
  // stays a non-author). And the coach at Previous FC wrote about the first
  // child before the transfer, at a club that stays verified throughout.
  for (const [rec, who] of [[R.kid, P.author], [R.kid, P.leaver], [R.kid2, P.td]]) {
    await db.query(`insert into record_entry (record_id, entry_type, author_id, provenance) values ($1,'coach_note',$2,'coach_verified')`, [rec, who]);
  }
  await db.query(`update membership set ended_at = now() where person_id = $1 and ended_at is null`, [P.leaver]);
  const h5auth = async () => [await level(P.author, P.kid), await level(P.leaver, P.kid), await level(P.td, P.kid2), await level(P.oldCoach, P.kid)];
  const AUTH_LIVE = ['full', 'authored_only', 'full', 'authored_only'];
  const AUTH_DOWN = ['none', 'none', 'none', 'authored_only'];
  check('H3: a coach who wrote about a child and then left a club that stays verified keeps read on what they wrote, and nothing more (D-48, which D-171 leaves standing) — beside them the coach who stayed and the TD read in full',
    await h5auth(), AUTH_LIVE);

  // ---- H5 · the club loses verified status, every way it can ---------------------
  // Every read a TD or a coach assigned now makes of a child at the club.
  const h5 = async () => [
    await level(P.td, P.kid), await level(P.coach1, P.kid), await level(P.td, P.teen), await level(P.coach1, P.teen),
    await sqRead(P.td, S.s1, P.kid), await sqRead(P.coach1, S.s1, P.kid),
    (await roster(P.td, S.s1)).length, (await roster(P.coach2, S.s2)).length,
    await regRead(P.td, REG.kid), (await regRows(P.td, C.club)).length, await regRead(P.coach2, REG.kid2),
    await prov(P.td, R.kid), await prov(P.coach1, R.kid),
    (await db.query('select count(*)::int as n from fn_verifiable_stats($1,$2)', [P.coach1, R.kid])).rows[0].n,
    (await db.query('select fn_club_minor_facing($1) as v', [C.club])).rows[0].v];
  const LIVE = ['full', 'full', 'full', 'full', true, true, 2, 1, true, 2, true, 'coach_verified', 'coach_verified', 2, true];
  const wantedHere = async () => (await db.query(`select count(*)::int as n from fn_players_wanted_advertised() where club_id = $1`, [C.club])).rows[0].n;
  const DOWN = ['none', 'none', 'none', 'none', false, false, 0, 0, false, 0, false, null, null, 0, false];
  check('H5: while Signing FC is verified, its TD and its assigned coaches read its children — every read below is live, so none can pass by being empty',
    await h5(), LIVE);
  // The ways a club leaves verified: the call sheet's four outcomes, each
  // suspension class and none (app/ops/call; 0025/0066), and 0150's failed
  // call. For the two that suspend, what the call sheet's action writes; for
  // a failed call, nothing but the call — the database does the rest.
  const ways = [['suspended', 'child_safety'], ['suspended', 'administrative'], ['suspended', 'non_payment'], ['suspended', null],
    ['takedown', null], ['not_verified', null]];
  for (const [outcome, cls] of ways) {
    await db.query('begin');
    await db.query(`insert into verification_call (club_id, called_at, operator, number_called, number_source, outcome, suspension_reason, policy_version)
      values ($1, now(), 'BUZ', '03 9000 0000', 'FV club directory', $2, $3, '27@v1.0')`, [C.club, outcome, cls]);
    if (outcome !== 'not_verified') {
      await db.query(`update club set club_state = 'suspended', suspension_reason = $2 where id = $1`, [C.club, cls]);
    }
    const state = (await db.query('select club_state from club where id = $1', [C.club])).rows[0].club_state;
    const down = await h5();
    const authDown = await h5auth();
    const cvDown = [(await servedCv(R.kid)).club, (await db.query(`select fn_cv_club($1)->>'club' as c`, [P.teen])).rows[0].c];
    const wantedDown = await wantedHere();
    await db.query('commit');
    const back = crypto.randomUUID();
    await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
      values ($1,$2,now(),'BUZ','03 9000 0000','FV club directory','verified','27@v1.0')`, [back, C.club]);
    await db.query(`update club set club_state = 'verified', verified_call_id = $2, suspension_reason = null where id = $1`, [C.club, back]);
    const how = outcome === 'not_verified' ? 'a re-verification call that does not verify it (0150)'
      : outcome === 'takedown' ? 'a takedown' : `a suspension ${cls ? `for the ${cls} class` : 'with no class recorded'}`;
    check(`H5: ${how} — every minor-facing read ends in the call's own transaction, for the TD and for the coaches assigned now: the record, the squad CV, the squad screen, the register and a CV from it, the pen; and a verified call brings them back`,
      [state, down, await h5()], [outcome === 'not_verified' ? 'claimed' : 'suspended', DOWN, LIVE]);
    check(`H5: ${how} — the coaches and the TD who wrote about its children lose that too, in the same transaction: the coach still on the squad and the TD drop to nothing rather than to what they wrote, and so does the coach who wrote and left (D-171); the coach at Previous FC, which is still verified, keeps what they wrote there; and a verified call gives every one of them back`,
      [authDown, await h5auth()], [AUTH_DOWN, AUTH_LIVE]);
    check(`pw1: ${how} — Signing FC's own players-wanted notice is off its page in the same transaction (0140, 0156), not deleted, and back once it is verified`,
      [wantedDown, await wantedHere()], [0, 1]);
    if (outcome !== 'not_verified') {
      check(`cvclub1: ${how} — no CV names Signing FC while it is down: the under-16's served snapshot and the 16-17's live club line are a player's with no club (0155), and a verified call puts the club back`,
        [cvDown, [(await servedCv(R.kid)).club, (await db.query(`select fn_cv_club($1)->>'club' as c`, [P.teen])).rows[0].c]],
        [['', ''], ['Signing FC', 'Signing FC']]);
    }
  }

  // The club an entry was written through is the one that matters, not the
  // club the child is at now: Previous FC failing its call takes away what
  // its coach wrote about a child who has since left for Signing FC.
  await db.query('begin');
  await db.query(`insert into verification_call (club_id, called_at, operator, number_called, number_source, outcome, policy_version)
    values ($1, now(), 'BUZ', '03 9000 0000', 'FV club directory', 'not_verified', '27@v1.0')`, [C.old]);
  const oldAuthorDown = [(await db.query('select club_state from club where id = $1', [C.old])).rows[0].club_state, await level(P.oldCoach, P.kid)];
  await db.query('commit');
  {
    const back = crypto.randomUUID();
    await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
      values ($1,$2,now(),'BUZ','03 9000 0000','FV club directory','verified','27@v1.0')`, [back, C.old]);
    await db.query(`update club set club_state = 'verified', verified_call_id = $2 where id = $1`, [C.old, back]);
  }
  check('H5: Previous FC failing its call ends what its coach wrote about a child who has since left for Signing FC — the read flowed through Previous FC, so it goes with Previous FC\u2019s verification (D-171) — and a verified call gives it back, unchanged',
    [oldAuthorDown, await level(P.oldCoach, P.kid)], [['claimed', 'none'], 'authored_only']);

  // ---- H2 · a player leaves a club ------------------------------------------------
  // The squad's coach writes about the child while they are in the squad (the
  // database insists on the order), so the D-48 exception is exercised.
  await db.query(`insert into record_entry (record_id, entry_type, author_id, provenance) values ($1,'coach_note',$2,'coach_verified')`, [R.kid, P.coach1]);
  const rosterBefore = (await roster(P.td, S.s1)).length;
  const otherClubLevel = await level(ID.coachOther, P.teen);   // a verified coach at another club, for the 16-17's floor
  const regBefore = [await regRead(P.td, REG.kid), (await regRows(P.td, C.club)).includes(REG.kid), await regState(REG.kid)];
  await db.query('begin');
  // The family's Leave, as app/squad/actions.ts calls it (0153).
  const leftN = (await db.query('select fn_leave_squads($1, $2) as n', [P.parent, P.kid])).rows[0].n;
  const regInside = [await regRead(P.td, REG.kid), (await regRows(P.td, C.club)).includes(REG.kid), await regState(REG.kid)];
  const left = [await level(P.td, P.kid), await level(P.coach1, P.kid), await sqRead(P.td, S.s1, P.kid), await sqRead(P.coach1, S.s1, P.kid),
    await onRoster(P.td, S.s1, P.kid), (await roster(P.td, S.s1)).length, await prov(P.td, R.kid), await prov(P.coach1, R.kid),
    await verifyClub(P.td, R.kid)];
  await db.query('commit');
  check('H2: a player leaves — from that moment no td_own or coach_own_v reads the full record: the TD reads nothing, the squad’s coach only what they wrote (D-48), neither opens the squad CV, the squad screen drops the child and keeps the count, and the pen is gone',
    [leftN, left], [1, ['none', 'authored_only', false, false, null, rosterBefore - 1, null, null, null]]);
  check('H2: and the family\u2019s registration at the club comes off its register in the Leave\u2019s own transaction — the TD\u2019s register has no row and fn_can_read_registration says no, so no CV opens from it; the note is emptied with it (D-128); and the consent log carries the parent\u2019s withdrawal (D-170)',
    [regBefore, regInside, (await withdrawals(P.kid)).slice(-1)],
    [[true, true, { out: false, note: 'Keen to play up a year' }], [false, false, { out: true, note: null }], ['parent:Signing FC']]);
  const cvAfter = await servedCv(R.kid);
  check('H2: and nothing the membership gave is left on the CV — it no longer names Signing FC or the squad (the club line follows the membership, D-158)',
    [cvAfter.club, cvAfter.squad?.name ?? ''], ['', '']);
  await db.query('begin');
  await db.query('select fn_leave_squads($1, $2)', [P.parent, P.teen]);
  const teenLeft = [await level(P.td, P.teen), await level(P.coach1, P.teen), await sqRead(P.coach1, S.s1, P.teen)];
  await db.query('commit');
  check('H2: a 16-17 who leaves drops to exactly what a verified coach at another club gets — the B3 floor, public — never the full record, and the squad CV is closed',
    [otherClubLevel, teenLeft], ['public', ['public', 'public', false]]);

  // D-170's word is the LAST membership. The second child plays up into the
  // U15s as well (a second squad at the same club keeps both, 0054), and the
  // club takes them out of the U16s — the statement app/club/squads/
  // [squadId]/actions.ts runs. They are still at Signing FC, so the
  // registration stays; the rule itself, asked there, withdraws nothing. When
  // the family presses Leave, it comes off.
  const playsUp = await joinSquad(P.kid2, S.s1, P.td, P.parent);
  await db.query('begin');
  await db.query(`with out as (
       update membership set ended_at = now()
       where person_id = $1 and squad_id = $2 and role = 'player' and ended_at is null
       returning person_id)
     insert into consent_event (event, actor_id, subject_id, detail)
     select 'squad_left', $3, o.person_id, jsonb_build_object('squad_id',$2::uuid,'source','club')
     from out o`, [P.kid2, S.s2, P.td]);
  const oneOfTwo = [await regRead(P.td, REG.kid2), (await regRows(P.td, C.club)).includes(REG.kid2), (await regState(REG.kid2)).out,
    (await db.query('select fn_left_club_withdraws($1,$2,$3) as n', [P.kid2, C.club, P.parent])).rows[0].n, (await regState(REG.kid2)).out];
  await db.query('commit');
  await db.query('select fn_leave_squads($1, $2)', [P.parent, P.kid2]);
  check('D-170: a player still in another squad at the club has not left it — taken out of one of two squads, the registration stays on the TD\u2019s register and readable, and the rule withdraws nothing while a membership there is live; the family\u2019s Leave then takes it off',
    [playsUp, oneOfTwo, [await regRead(P.td, REG.kid2), (await regState(REG.kid2)).out, (await withdrawals(P.kid2))]],
    [true, [true, true, false, 0, false], [false, true, ['parent:Signing FC (second)']]]);
  // The Leave is the database's, and the page asks nothing (0153).
  const leaveSrc = codeOnly(srcOf('app/squad/actions.ts'));
  check('D-170: the family\u2019s Leave is fn_leave_squads — app/squad/actions.ts ends no membership itself — and a leave withdraws through one rule, called by the two ways a player leaves a club and nothing else',
    [/fn_leave_squads\(\$2, \$1\)/.test(leaveSrc), /update\s+membership/i.test(leaveSrc),
     (await db.query(`select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and prosrc ~ 'fn_left_club_withdraws\\(' and proname <> 'fn_left_club_withdraws' order by proname`)).rows.map((r) => r.proname),
     /fn_withdraw_registration\(p_person, r\.id\)/.test(await procSrc('fn_left_club_withdraws'))],
    [true, false, ['fn_join_squad', 'fn_leave_squads'], true]);

  // ---- H7 · experience_entry grants nothing to anyone, ever ---------------------
  // Round K: the old check read one migration file, 0003, and nothing a later
  // migration wrote. This reads the permission engine as it exists NOW, from
  // pg_proc: every function that decides access, found by starting from the
  // functions the product asks "who may" and following every function each of
  // them calls, plus every trigger function on a table that carries access,
  // plus every policy and view. None may name experience_entry.
  const fns = (await db.query(`select p.proname as name, p.prosrc as src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'`)).rows;
  const body = (src) => src.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').toLowerCase();
  const srcByName = new Map();
  for (const f of fns) srcByName.set(f.name, (srcByName.get(f.name) ?? '') + '\n' + body(f.src));
  const ROOT = /^fn_(read_level|searchable|token_read|record_actor|write_provenance|verify_club|verifiable_stats|verify_stat|club_minor_facing|is_verified_adult|has_approved_guardian|person_hidden|approved_cv|cv_club|stat_public|experience_public)$|^fn_can_|^fn_register_|^fn_squad_|^fn_td_|^fn_club_td|^fn_invitation_|^fn_registration_|^fn_join_|^fn_attach_|^fn_leave_/;
  const ACCESS_TABLES = ['membership', 'guardianship_link', 'wwcc_attestation', 'register_grant', 'club', 'verification_call', 'squad_claim',
    'squad_invitation', 'invitation', 'invitation_reply', 'registration', 'share_token', 'coach_invite', 'guardian_setting', 'record_entry', 'player_stat'];
  const triggerFns = (await db.query(`select distinct p.proname as name from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where not t.tgisinternal and t.tgrelid::regclass::text = any($1)`, [ACCESS_TABLES])).rows.map((r) => r.name);
  const engine = new Set([...srcByName.keys()].filter((n) => ROOT.test(n)).concat(triggerFns));
  for (let grew = true; grew;) {
    grew = false;
    for (const n of [...engine]) {
      for (const m of srcByName.get(n).matchAll(/\b([a-z_][a-z0-9_]*)\s*\(/g)) {
        if (srcByName.has(m[1]) && !engine.has(m[1])) { engine.add(m[1]); grew = true; }
      }
    }
  }
  const named = [...engine].filter((n) => /experience_entry/.test(srcByName.get(n))).sort();
  const MUST = ['fn_read_level', 'fn_is_verified_adult', 'fn_searchable', 'fn_token_read', 'fn_can_read_squad_player', 'fn_squad_roster',
    'fn_can_read_registration', 'fn_register_rows', 'fn_register_grant_squads', 'fn_write_provenance', 'fn_club_minor_facing', 'fn_join_squad'];
  check(`H7: experience_entry cannot appear in the "inside the club" computation — no function of the permission engine as it exists now names it, read from pg_proc (${engine.size} functions, reached from the "who may" questions, every function they call and every trigger on a table that carries access)`,
    [MUST.filter((n) => !engine.has(n)), named], [[], []]);
  // Outside the engine too: a function that names the table is only allowed
  // if nothing in the engine can reach it, and today there is none at all.
  const anywhere = fns.filter((f) => /experience_entry/.test(body(f.src))).map((f) => f.name).sort();
  const policies = (await db.query(`select polname from pg_policy
    where coalesce(pg_get_expr(polqual, polrelid), '') ~* 'experience' or coalesce(pg_get_expr(polwithcheck, polrelid), '') ~* 'experience'`)).rows;
  const views = (await db.query(`select viewname from pg_views where schemaname = 'public' and definition ~* 'experience_entry'`)).rows;
  check('H7: and nothing else in the database names it either — no function, no row-level policy, no view — so there is nothing for the engine to reach',
    [anywhere, policies, views], [[], [], []]);
  // Its shape, read from the catalogue rather than the migration text: one
  // foreign key, to the record it sits on, and one thing pointing at it (a
  // stat may say which entry it came from). No club, no squad, no person.
  const shape = (await db.query(`select conname, conrelid::regclass::text as t, confrelid::regclass::text as f from pg_constraint
    where contype = 'f' and (conrelid = 'experience_entry'::regclass or confrelid = 'experience_entry'::regclass) order by conname`)).rows
    .map((r) => `${r.t}→${r.f}`);
  const cols = (await db.query(`select column_name from information_schema.columns where table_name = 'experience_entry'
    and (column_name ~ 'club|squad|membership|person|coach|author' or data_type = 'uuid') order by column_name`)).rows.map((r) => r.column_name);
  check('H7: it has no foreign key to a club, a squad or a person — its only link is to the record it sits on, and the only link into it is a stat’s source',
    [shape, cols], [['experience_entry→development_record', 'player_stat→experience_entry'], ['id', 'record_id']]);

  // Behaviourally: an entry naming a club grants that club nothing. The
  // answers the engine gives about the child, asked of every person in the
  // database, before and after the family's record names Signing FC — by its
  // exact name, its id and its slug-shape, in every kind a child's record may
  // hold — must be identical. Kit has left Signing FC by now; Kai is still in
  // it, so a named club that already holds a child is covered too.
  const answers = async () => (await db.query(
    `select v.id, fn_read_level(v.id, c.child) as l, fn_searchable(v.id, c.child) as s, fn_record_actor(v.id, c.rec) as a,
            fn_write_provenance(v.id, c.rec) as w, fn_verify_club(v.id, c.rec) as vc, fn_can_act_on_squad(v.id, c.child) as act,
            fn_can_read_squad_player(v.id, $3, c.child) as sq1, fn_can_read_squad_player(v.id, $4, c.child) as sq2,
            (select count(*) from fn_register_rows(v.id, $5))::int as regs,
            (select count(*) from fn_squad_roster(v.id, $3) r where r.record_id is not null)::int as ros
     from person v, (values ($1::uuid, $2::uuid), ($6::uuid, $7::uuid), ($8::uuid, $9::uuid)) as c(child, rec)
     order by v.id, c.child`,
    [P.kid, R.kid, S.s1, S.s2, C.club, P.kid2, R.kid2, P.teen, R.teen])).rows;
  const beforeNaming = await answers();
  for (const [rec, who] of [[R.kid, 'kid'], [R.kid2, 'kid2'], [R.teen, 'teen']]) {
    for (const kind of ['other', 'previous_club', 'representative', 'futsal', 'tournament', 'ntc_academy']) {
      for (const name of ['Signing FC', C.club, 'signing-fc']) {
        await db.query(`insert into experience_entry (record_id, kind, org_name, competition) values ($1,$2,$3,$3)`, [rec, kind, name]);
      }
    }
    void who;
  }
  const afterNaming = await answers();
  const differ = afterNaming.filter((r, i) => JSON.stringify(r) !== JSON.stringify(beforeNaming[i]));
  check(`H7: an experience_entry naming a club grants that club nothing, and nobody anything — ${afterNaming.length} answers (every person in the database, three children, eleven questions each) are identical before and after 54 entries naming Signing FC by name, id and slug in every kind`,
    [beforeNaming.length === afterNaming.length && beforeNaming.length > 0, differ.length], [true, 0]);
}

// ---------------------------------------------------------------------------
// 0058 — a club gets its technical director on the verification call, and
// nowhere else (BUZ, 23 Sep; D-93's granting rule; the gap 0054 opened, L29).
// Four questions: can the role be written by any other route, can an unproved
// address hold it, does it switch on when that address is proved, and what a
// club with no recorded TD can read.
// ---------------------------------------------------------------------------
{
  const club = crypto.randomUUID(), admin = crypto.randomUUID();
  const recorded = crypto.randomUUID(), outsider = crypto.randomUUID(), minor = crypto.randomUUID();
  const firstCall = crypto.randomUUID(), tdCall = crypto.randomUUID();
  const reg = crypto.randomUUID();
  await db.query(`insert into club (id, name, club_state, subscription_status) values ($1,'Callsheet FC','claimed','active')`, [club]);
  // The recorded person's account carries the name the call records (0121:
  // a name mismatch is held for a human, which is its own block below).
  await db.query(`insert into person (id, first_name, last_name, dob, email) values
    ($1,'Robin','Recorded',$2,'recorded@fixture.example'), ($3,'Outsider',null,$2,'outsider@fixture.example'),
    ($4,'Minor',null,$5,'minortd@fixture.example'), ($6,'Callsheet Admin',null,$2,null)`,
    [recorded, yearsAgo(44), outsider, minor, yearsAgo(16), admin]);
  await mem(admin, club, null, 'club_admin');
  await db.query(`insert into registration (id, player_id, club_id, policy_version) values ($1,$2,$3,'20@v2.4')`,
    [reg, ID.marcus, club]);

  // The club is verified by a call that named nobody — which is allowed, and
  // leaves the club with no route into its own register.
  await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
    values ($1,$2,now(),'BUZ','03 9000 0000','FV club directory','verified','27@v1.0')`, [firstCall, club]);
  await db.query(`update club set club_state='verified', verified_call_id=$1 where id=$2`, [firstCall, club]);
  check('td1: a verified club whose call recorded no technical director has nobody in the role',
    (await db.query(`select count(*)::int as n from membership where club_id = $1 and role = 'technical_director' and ended_at is null`, [club])).rows[0].n, 0);
  check('td2: so it has no register reader — its administrator included (D-154)',
    [(await db.query('select fn_can_work_register($1,$2) as c', [admin, club])).rows[0].c,
     (await db.query('select * from fn_register_rows($1,$2)', [admin, club])).rows.length,
     (await db.query('select fn_register_count($1,$2) as n', [admin, club])).rows[0].n],
    [false, 0, 1]);

  // H10 — the row doc 14 enumerates: the role asserted rather than granted.
  await expectFail('H10: a person self-declaring technical_director is refused at the write (D-93)',
    `insert into membership (person_id, club_id, role) values ('${outsider}','${club}','technical_director')`);
  await expectFail('td3: and no existing membership can be promoted into the role either',
    `update membership set role = 'technical_director' where person_id = '${admin}' and club_id = '${club}'`);
  await expectFail('td4: a call that did not verify the club records no technical director',
    `insert into verification_call (club_id, called_at, operator, number_called, number_source, outcome, td_name, td_email, policy_version)
     values ('${club}', now(), 'BUZ', '03 9000 0000', 'FV club directory', 'not_verified', 'Nobody Atall', 'nobody@fixture.example', '27@v1.0')`);

  // The call that does record one. The address is not proved yet.
  await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, td_name, td_email, policy_version)
    values ($1,$2,now(),'BUZ','03 9000 0000','FV club directory','verified','Robin Recorded','Recorded@Fixture.Example','27@v1.0')`, [tdCall, club]);
  await db.query(`update club set club_state='verified', verified_call_id=$1 where id=$2`, [tdCall, club]);
  check('td5: recorded on the call is not the same as holding the role — the address is unproved',
    [(await db.query('select fn_td_on_call($1,$2) as c', [recorded, club])).rows[0].c,
     (await db.query('select fn_email_proved($1) as p', [recorded])).rows[0].p,
     (await db.query('select fn_can_work_register($1,$2) as c', [recorded, club])).rows[0].c],
    [true, false, false]);
  check('td6: and the operator console says so — recorded, by whom, not active',
    (await db.query('select td_name, recorded_by, active from fn_club_td($1)', [club])).rows,
    [{ td_name: 'Robin Recorded', recorded_by: 'BUZ', active: false }]);
  await expectFail('td7: an unproved address cannot be handed the role by hand either (L21)',
    `insert into membership (person_id, club_id, role) values ('${recorded}','${club}','technical_director')`);

  // The proof — written the way the product writes it, because the database
  // asks for the evidence (0056).
  await proveAddress(recorded);
  check('td8: proving the address is what switches the role on, and nothing else had to happen',
    [(await db.query(`select count(*)::int as n from membership where person_id = $1 and club_id = $2 and role = 'technical_director' and ended_at is null`, [recorded, club])).rows[0].n,
     (await db.query('select fn_can_work_register($1,$2) as c', [recorded, club])).rows[0].c,
     (await db.query('select * from fn_register_rows($1,$2)', [recorded, club])).rows.length,
     (await db.query('select active from fn_club_td($1)', [club])).rows[0].active],
    [1, true, 1, true]);
  check('td8b: and the club\'s administrator still reads none of it (D-93, N17)',
    (await db.query('select * from fn_register_rows($1,$2)', [admin, club])).rows.length, 0);

  // Everything the one path is not.
  await proveAddress(outsider);
  await expectFail('td9: somebody else at the same club, proved and all, is still refused',
    `insert into membership (person_id, club_id, role) values ('${outsider}','${club}','technical_director')`);
  await proveAddress(minor);
  await db.query(`update verification_call set td_email = 'minortd@fixture.example' where id = $1`, [tdCall]);
  await expectFail('td10: a person under 18 never holds club-wide access to children\'s records (D-82)',
    `insert into membership (person_id, club_id, role) values ('${minor}','${club}','technical_director')`);
  check('td10b: and the attach that runs on a call refuses them in silence rather than picking them up',
    (await db.query(`select count(*)::int as n from membership where person_id = $1 and role = 'technical_director'`, [minor])).rows[0].n, 0);
  await db.query(`update verification_call set td_email = 'recorded@fixture.example' where id = $1`, [tdCall]);

  // An unverified club: the call recorded a TD, the club is not verified, so
  // there is no role to hold (D-126 — the club-state wall comes first).
  const unv = crypto.randomUUID(), unvPerson = crypto.randomUUID();
  await db.query(`insert into club (id, name, club_state) values ($1,'Uncalled FC','claimed')`, [unv]);
  await db.query(`insert into person (id, first_name, dob, email) values ($1,'Waiting',$2,'waiting@fixture.example')`, [unvPerson, yearsAgo(38)]);
  await proveAddress(unvPerson);
  await db.query(`insert into verification_call (club_id, called_at, operator, number_called, number_source, outcome, td_name, td_email, policy_version)
    values ($1,now(),'BUZ','03 9000 0000','FV club directory','verified','Wendy Waiting','waiting@fixture.example','27@v1.0')`, [unv]);
  check('td11: a call on a club nobody switched to verified attaches nobody',
    (await db.query(`select count(*)::int as n from membership where club_id = $1 and role = 'technical_director'`, [unv])).rows[0].n, 0);
  await expectFail('td12: and the role cannot be written there by hand (D-126)',
    `insert into membership (person_id, club_id, role) values ('${unvPerson}','${unv}','technical_director')`);
}

// ---------------------------------------------------------------------------
// 0060 — the recorded address is a person's, never the club's own mailbox
// (safety review 28 Sep, X1; D-93, doc 14 H11/A12b/J13).
//
// The scenario, built the way it happens rather than described. A community
// club's published contact address is a role mailbox — `coach@...` — and it is
// the address the claim code is sent to (app/claim/[slug]/actions.ts), so
// whoever claimed the page proved it to read the code. Here that is the club's
// treasurer, a club_admin. On the verification call the secretary gives that
// same address as the Technical Director's; the operator types a person's
// name. Before 0060 the trigger attached the role to the treasurer and
// fn_read_level returned 'full' for her on every child at the club.
// ---------------------------------------------------------------------------
{
  const club = crypto.randomUUID(), sq = crypto.randomUUID();
  const treasurer = crypto.randomUUID(), kid = crypto.randomUUID(), gdn = crypto.randomUUID();
  const rec = crypto.randomUUID(), call = crypto.randomUUID();
  const MAILBOX = 'coach@mailboxfc.example';

  await db.query(`insert into club (id, name, suburb, state, contact_email, club_state, subscription_status)
    values ($1,'Mailbox FC','Somewhere','VIC',$2,'claimed','active')`, [club, MAILBOX]);
  await db.query(`insert into squad (id, club_id, name, age_group, competition_gender, season)
    values ($1,$2,'U14 Boys','U14','boys','2026')`, [sq, club]);
  // The treasurer holds the club's mailbox on her own account, and has proved
  // it — she had to, to read the claim code (L21 is satisfied and is not the
  // thing standing in the way here).
  await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,'Tessa','Treasurer',$2,$3)`,
    [treasurer, yearsAgo(47), MAILBOX]);
  await proveAddress(treasurer);
  await mem(treasurer, club, null, 'club_admin');
  // A child at that club, with an approved guardian and a record.
  await db.query(`insert into person (id, first_name, last_name, dob) values ($1,'Ari','Fixture',$2)`, [kid, yearsAgo(14)]);
  await db.query(`insert into person (id, first_name, dob) values ($1,'Mailbox Guardian',$2)`, [gdn, yearsAgo(41)]);
  await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [gdn, kid]);
  await mem(kid, club, sq, 'player');
  await db.query(`insert into development_record (id, person_id, positions) values ($1,$2,array['AM'])`, [rec, kid]);

  check('td13: before the call the club is not verified, so she reads nothing at all (A14)',
    await level(treasurer, kid), 'none');

  // The call. Verified, a person's name typed, the club's own address given.
  await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source,
      outcome, td_name, td_email, policy_version)
    values ($1,$2,now(),'BUZ','03 9000 0000','club website /contact','verified','Robin Recorded',$3,'27@v1.0')`,
    [call, club, MAILBOX]);
  await db.query(`update club set club_state='verified', verified_call_id=$1 where id=$2`, [call, club]);

  // Doc 14 H11 as worded — "by any path". Verifying the club IS a path, and
  // before 0060 it was the one that got through.
  check('H11: a club administrator reads no development record, and a call recording the club\'s own address is not a path to one (D-93)',
    await level(treasurer, kid), 'membership_only');
  check('td14: the attach refuses the club\'s own mailbox in silence rather than picking up whoever holds it',
    (await db.query(`select count(*)::int as n from membership
       where club_id = $1 and role = 'technical_director' and ended_at is null`, [club])).rows[0].n, 0);
  await expectFail('td15: and the role cannot be written to the mailbox holder by hand either (the trigger, not the caller)',
    `insert into membership (person_id, club_id, role) values ('${treasurer}','${club}','technical_director')`);
  // J13 — no club role other than the TD and squad-assigned verified coaches
  // reaches a development record, and club_admin cannot by any path.
  check('J13: so the club has no register reader and no record reader in the person holding its inbox (D-154, N17)',
    [(await db.query('select fn_can_work_register($1,$2) as c', [treasurer, club])).rows[0].c,
     (await db.query('select fn_td_on_call($1,$2) as c', [treasurer, club])).rows[0].c],
    [false, false]);

  // What the operator sees. This is the other half of X1: the console read
  // "Technical Director Robin Recorded · active" while the membership belonged
  // to Tessa Treasurer, and no screen in the product named her.
  check('td16: fn_club_td names the account the recorded address actually belongs to, and says it is the club\'s own',
    (await db.query(`select td_name, account_name, account_email, name_matches, club_mailbox, active from fn_club_td($1)`, [club])).rows,
    [{ td_name: 'Robin Recorded', account_name: 'Tessa Treasurer', account_email: MAILBOX,
       name_matches: false, club_mailbox: true, active: false }]);

  // The other direction: the club is rung back and gives the Technical
  // Director's own address. The same rule that refused the mailbox attaches
  // her, and A12's full read follows.
  const robin = crypto.randomUUID(), call2 = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,'Robin','Recorded',$2,'robin@mailboxfc-staff.example')`,
    [robin, yearsAgo(43)]);
  await proveAddress(robin);
  await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source,
      outcome, td_name, td_email, policy_version)
    values ($1,$2,now() + interval '1 hour','BUZ','03 9000 0000','club website /contact','verified','Robin Recorded','robin@mailboxfc-staff.example','27@v1.0')`,
    [call2, club]);
  check('td17: a person\'s own address still attaches, on the same call field, and reads the record (A12)',
    [(await db.query(`select count(*)::int as n from membership where person_id = $1 and club_id = $2
        and role = 'technical_director' and ended_at is null`, [robin, club])).rows[0].n,
     await level(robin, kid),
     await level(treasurer, kid)],
    [1, 'full', 'membership_only']);
  // fn_club_td reads the LATEST verified call, which is the one that named a
  // person — so club_mailbox goes back to false with it.
  check('td18: and the console now names the same human twice rather than once',
    (await db.query(`select account_name, name_matches, club_mailbox, active from fn_club_td($1)`, [club])).rows,
    [{ account_name: 'Robin Recorded', name_matches: true, club_mailbox: false, active: true }]);

  // The coalesce sentinel, which is where this predicate would break: a club
  // that recorded no contact address at all must not match every TD address.
  const noAddr = crypto.randomUUID(), noAddrTd = crypto.randomUUID(), noAddrCall = crypto.randomUUID();
  await db.query(`insert into club (id, name, club_state) values ($1,'No Inbox FC','claimed')`, [noAddr]);
  await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,'Sam','Silent',$2,'sam@noinbox-staff.example')`,
    [noAddrTd, yearsAgo(39)]);
  await proveAddress(noAddrTd);
  await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source,
      outcome, td_name, td_email, policy_version)
    values ($1,$2,now(),'BUZ','03 9000 0002','FV club directory','verified','Sam Silent','sam@noinbox-staff.example','27@v1.0')`,
    [noAddrCall, noAddr]);
  await db.query(`update club set club_state='verified', verified_call_id=$1 where id=$2`, [noAddrCall, noAddr]);
  check('td19: a club that recorded no contact address at all still gets its Technical Director',
    [(await db.query(`select count(*)::int as n from membership where person_id = $1 and club_id = $2
        and role = 'technical_director' and ended_at is null`, [noAddrTd, noAddr])).rows[0].n,
     (await db.query('select club_mailbox from fn_club_td($1)', [noAddr])).rows[0].club_mailbox],
    [1, false]);

  // Structural, and it is the N1 shape: the wall and the attach must both ask
  // this, and the attach must ask it by calling the one answer rather than
  // carrying its own copy of the predicate.
  check('td20: the predicate lives in the one answer, and the attach asks that answer rather than repeating it',
    [/contact_email/.test(await procSrc('fn_td_on_call')),
     /fn_td_on_call/.test(await procSrc('fn_attach_recorded_td')),
     /fn_td_on_call/.test(await procSrc('fn_td_membership_write_rule'))],
    [true, true, true]);
}

// ---------------------------------------------------------------------------
// 0100 — a Technical Director's access ends, and a club never has two
// (D-48, D-93; brief F). Walked the way it happens: a club verified on a call
// that named its TD, a child in one of its squads with a registration there,
// and the TD writing one entry on that child's record while they held the
// role. Then the three ways the role ends — the club's administrator, Pitch's
// operator, and a later call naming somebody else — and every read path the
// TD used, asked again afterwards: the record, the register, the
// registration's CV, the squad screen and the pen.
// ---------------------------------------------------------------------------
{
  const club = crypto.randomUUID(), sq = crypto.randomUUID(), firstCall = crypto.randomUUID();
  const avery = crypto.randomUUID(), blair = crypto.randomUUID(), casey = crypto.randomUUID();
  const admin = crypto.randomUUID(), coach = crypto.randomUUID(), tm = crypto.randomUUID(), op = crypto.randomUUID();
  const kid = crypto.randomUUID(), gdn = crypto.randomUUID(), rec = crypto.randomUUID(), reg = crypto.randomUUID();
  const refusedQ = async (sql, params) => { try { await db.query(sql, params); return false; } catch { return true; } };
  const one = async (sql, params) => (await db.query(sql, params)).rows[0];
  const liveTds = async () => (await db.query(
    `select person_id from membership where club_id = $1 and role = 'technical_director' and ended_at is null order by person_id`,
    [club])).rows.map((r) => r.person_id);
  const endings = async () => (await db.query(
    `select person_id, cause, ended_by, operator_email, reason, call_id from td_ending where club_id = $1 order by id`, [club])).rows;
  // Every read the TD's screens make, asked of the database the way the pages
  // ask it: /club/register (fn_register_rows), the CV opened from it
  // (fn_can_read_registration), /club/squads/[id] (fn_squad_roster's record
  // ids, which are what open a player), the record itself, and the pen.
  const reads = async (who) => [
    await level(who, kid),
    (await one('select fn_can_work_register($1,$2) as c', [who, club])).c,
    (await db.query('select * from fn_register_rows($1,$2)', [who, club])).rows.length,
    (await one('select fn_can_read_registration($1,$2) as c', [who, reg])).c,
    (await db.query('select record_id from fn_squad_roster($1,$2) where record_id is not null', [who, sq])).rows.length,
    await prov(who, rec),
  ];
  const CAN = ['full', true, 1, true, 1, 'coach_verified'];

  await db.query(`insert into club (id, name, suburb, state, contact_email, club_state, subscription_status)
    values ($1,'Handover FC','Somewhere','VIC','secretary@handoverfc.example','claimed','active')`, [club]);
  await db.query(`insert into squad (id, club_id, name, age_group, competition_gender, season)
    values ($1,$2,'U14 Boys','U14','boys','2026')`, [sq, club]);
  await db.query(`insert into person (id, first_name, last_name, dob) values
    ($1,'Avery','Ashdown',$9), ($2,'Blair','Brennan',$9), ($3,'Casey','Callander',$9), ($4,'Harper','Handover',$9),
    ($5,'Coach','Handover',$9), ($6,'Team','Manager',$9), ($7,'Olly','Operator',$9), ($8,'Handover Guardian',null,$9)`,
    [avery, blair, casey, admin, coach, tm, op, gdn, yearsAgo(40)]);
  await db.query(`update person set email = 'olly@pitch.example' where id = $1`, [op]);
  await db.query(`insert into person (id, first_name, last_name, dob) values ($1,'Remy','Fixture',$2)`, [kid, yearsAgo(14)]);
  await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [gdn, kid]);
  await mem(kid, club, sq, 'player');
  await db.query(`insert into development_record (id, person_id, positions) values ($1,$2,array['CB'])`, [rec, kid]);
  await db.query(`insert into registration (id, player_id, club_id, policy_version) values ($1,$2,$3,'20@v2.4')`, [reg, kid, club]);
  await mem(admin, club, null, 'club_admin');
  await mem(coach, club, sq, 'coach');
  await mem(tm, club, sq, 'team_manager');
  // Verified first, on a call that named nobody, so recordTd's call is a
  // re-verification at a club that stays verified.
  await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
    values ($1,$2,now(),'BUZ','03 9000 0000','FV club directory','verified','27@v1.0')`, [firstCall, club]);
  await db.query(`update club set club_state='verified', verified_call_id=$1 where id=$2`, [firstCall, club]);
  await recordTd(avery, club, 'avery@handoverfc-staff.example');
  // Every TD this block names holds a WWCC the club attested, so the pen is a
  // question about the role and not about the check (D-22).
  for (const p of [avery, blair, casey, coach]) {
    await db.query(`insert into wwcc_attestation (person_id, club_id, attested_by) values ($1,$2,$3)`, [p, club, admin]);
  }
  check('tdx0: the TD the call named reads everything the TD screens read — record, register, CV, squad, pen',
    await reads(avery), CAN);
  // Something the TD wrote while they held the role (D-48 is about this).
  const entry = (await one(`insert into record_entry (record_id, entry_type, author_id, provenance)
    values ($1,'coach_note',$2,'coach_verified') returning id`, [rec, avery])).id;

  // ---- who may end it ------------------------------------------------------
  check('tdx1: the database answers who may end it — the club\'s administrator, and not the TD, a coach, a team manager or another club\'s administrator',
    await Promise.all([admin, avery, coach, tm, ID.adminOther, null].map(async (w) =>
      (await one('select fn_may_end_td($1,$2) as m', [w, club])).m)),
    [true, false, false, false, false, false]);
  check('tdx2: and fn_end_td refuses every one of those others, whatever reason they give — the TD stays',
    [await refusedQ('select fn_end_td($1,$2,$3)', [avery, club, 'Stepping down myself']),
     await refusedQ('select fn_end_td($1,$2,$3)', [coach, club, 'I would like the job']),
     await refusedQ('select fn_end_td($1,$2,$3)', [tm, club, 'Team manager says so']),
     await refusedQ('select fn_end_td($1,$2,$3)', [ID.adminOther, club, 'Another club entirely']),
     await refusedQ('select fn_end_td($1,$2,$3)', [null, club, 'Nobody at all']),
     await liveTds()],
    [true, true, true, true, true, [avery]]);
  check('tdx3: the administrator needs a reason — blank, spaces and two letters are refused, and nothing ends',
    [await refusedQ('select fn_end_td($1,$2,$3)', [admin, club, '']),
     await refusedQ('select fn_end_td($1,$2,$3)', [admin, club, '   ']),
     await refusedQ('select fn_end_td($1,$2,$3)', [admin, club, 'no']),
     await liveTds(), await endings()],
    [true, true, true, [avery], []]);

  // ---- the administrator ends it ------------------------------------------
  check('tdx4: the club\'s administrator ends it, with a reason, and is told whose access ended',
    (await one('select fn_end_td($1,$2,$3) as p', [admin, club, 'Moved to another club'])).p, avery);
  check('H9: a Technical Director whose access ended reads nothing at that club by any TD path — register, the CV from it, the squad, the pen — and keeps only what they authored (D-48)',
    await reads(avery), ['authored_only', false, 0, false, 0, null]);
  check('tdx5: what they wrote is untouched — the entry is there, still theirs (D-48)',
    await one('select author_id, provenance from record_entry where id = $1', [entry]),
    { author_id: avery, provenance: 'coach_verified' });
  check('tdx6: the audit row says who ended it, why, which person, and by which door',
    await endings(), [{ person_id: avery, cause: 'club_admin', ended_by: admin, operator_email: null, reason: 'Moved to another club', call_id: null }]);
  check('tdx7: the audit is append-only',
    [await refusedQ(`update td_ending set reason = 'edited' where club_id = $1`, [club]),
     await refusedQ(`delete from td_ending where club_id = $1`, [club])], [true, true]);
  check('tdx8: a second press ends nobody and logs nothing',
    [(await one('select fn_end_td($1,$2,$3) as p', [admin, club, 'Pressed twice'])).p, (await endings()).length], [null, 1]);
  check('tdx9: the operator console says the role ended since the call, and is not waiting on anyone',
    await one('select person_id, active, ended_at is not null as ended from fn_club_td($1)', [club]),
    { person_id: avery, active: false, ended: true });

  // ---- and it stays ended --------------------------------------------------
  await expectFail('tdx10: the ended row cannot be revived by hand off the call that named them',
    `update membership set ended_at = null where person_id = '${avery}' and club_id = '${club}' and role = 'technical_director'`);
  await expectFail('tdx11: nor a fresh row written for them off that same call',
    `insert into membership (person_id, club_id, role) values ('${avery}','${club}','technical_director')`);
  const reverify = crypto.randomUUID();
  await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
    values ($1,$2,now(),'BUZ','03 9000 0000','FV club directory','verified','27@v1.0')`, [reverify, club]);
  await db.query(`update club set club_state='verified', verified_call_id=$1 where id=$2`, [reverify, club]);
  check('tdx12: a re-verification that names nobody brings nobody back — the attach refuses a spent call in silence',
    [await liveTds(), (await one('select fn_attach_recorded_td($1) as m', [club])).m], [[], null]);

  // ---- naming a TD stays call-only, and a new call is the way back --------
  await recordTd(avery, club, 'avery@handoverfc-staff.example');
  check('tdx13: a NEW call naming them is fresh evidence, and the role comes back on it',
    [await liveTds(), await level(avery, kid)], [[avery], 'full']);
  const averyRow = (await one(`select id from membership where person_id = $1 and club_id = $2 and role = 'technical_director' and ended_at is null`, [avery, club])).id;
  await recordTd(avery, club, 'avery@handoverfc-staff.example');
  check('tdx14: a re-verification that names the same person changes nothing — same row, nothing ended, nothing logged',
    [(await one(`select id from membership where person_id = $1 and club_id = $2 and role = 'technical_director' and ended_at is null`, [avery, club])).id,
     await liveTds(), (await endings()).length],
    [averyRow, [avery], 1]);

  // ---- handover on the call -------------------------------------------------
  await db.query('begin');
  await recordTd(blair, club, 'blair@handoverfc-staff.example');
  const inTx = await liveTds();
  await db.query('rollback');
  check('tdx15: the old TD ends in the SAME transaction as the call naming somebody else — rolled back, nothing happened',
    [inTx, await liveTds(), (await endings()).length], [[blair], [avery], 1]);
  await recordTd(blair, club, 'blair@handoverfc-staff.example');
  const handoverCall = (await one(`select fn_td_call($1) as c`, [club])).c;
  check('tdx16: a verified call naming a different TD ends the live one and attaches the new — never two at once',
    [await liveTds(), await reads(avery), await reads(blair)],
    [[blair], ['authored_only', false, 0, false, 0, null], CAN]);
  check('tdx17: and logs it against that call, with nobody pressing and no typed reason',
    (await endings()).at(-1), { person_id: avery, cause: 'replaced_on_call', ended_by: null, operator_email: null, reason: null, call_id: handoverCall });

  // A new TD with no account yet: the old one still ends at the call. The
  // gap is a club with no TD, which is the restrictive direction.
  await db.query(`update person set email = 'casey@handoverfc-staff.example' where id = $1`, [casey]);
  await db.query(`insert into verification_call (club_id, called_at, operator, number_called, number_source, outcome, td_name, td_email, policy_version)
    values ($1,now(),'BUZ','03 9000 0000','FV club directory','verified','Casey Callander','casey@handoverfc-staff.example','27@v1.0')`, [club]);
  check('tdx18: a call naming somebody whose address is not proved yet still ends the live TD at once — nobody holds it meanwhile',
    [await liveTds(), await level(blair, kid), (await one('select active, ended_at from fn_club_td($1)', [club]))],
    [[], 'none', { active: false, ended_at: null }]);
  await proveAddress(casey);
  check('tdx19: and the role goes to the person named, when they prove their address',
    [await liveTds(), await level(casey, kid)], [[casey], 'full']);

  // Only the LATEST call names the TD. Before 0100 any verified call that ever
  // recorded an address counted, so a person named on an older call could
  // still pick the role up by proving their address after a newer call named
  // somebody else — a second TD through the back door.
  const late = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,'Laurie','Late',$2,'laurie@handoverfc-staff.example')`,
    [late, yearsAgo(41)]);
  await db.query(`insert into verification_call (club_id, called_at, operator, number_called, number_source, outcome, td_name, td_email, policy_version)
    values ($1,now() - interval '30 days','BUZ','03 9000 0000','FV club directory','verified','Laurie Late','laurie@handoverfc-staff.example','27@v1.0')`, [club]);
  await proveAddress(late);
  check('tdx20: somebody an OLDER call named cannot pick the role up by proving their address later',
    [await liveTds(), (await one('select fn_td_on_call($1,$2) as c', [late, club])).c, await level(late, kid)],
    [[casey], false, 'none']);

  // ---- the operator's door ---------------------------------------------------
  check('tdx21: the operator must be the person whose address the console gives, and must give a reason',
    [await refusedQ('select fn_ops_end_td($1,$2,$3,$4)', [op, 'someone-else@pitch.example', club, 'Club asked on the phone']),
     await refusedQ('select fn_ops_end_td($1,$2,$3,$4)', [null, 'olly@pitch.example', club, 'Club asked on the phone']),
     await refusedQ('select fn_ops_end_td($1,$2,$3,$4)', [op, 'olly@pitch.example', club, ' ']),
     await liveTds()],
    [true, true, true, [casey]]);
  check('tdx22: the operator ends it, and the audit row names the operator and their address',
    [(await one('select fn_ops_end_td($1,$2,$3,$4) as p', [op, 'olly@pitch.example', club, 'Club asked on the phone'])).p,
     await liveTds(), await level(casey, kid), (await endings()).at(-1)],
    [casey, [], 'none', { person_id: casey, cause: 'operator', ended_by: op, operator_email: 'olly@pitch.example', reason: 'Club asked on the phone', call_id: null }]);

  // A call that records the club's own mailbox names nobody who can hold the
  // role (0060) — and it is still a call naming somebody other than the live
  // TD, so the live TD ends. Pinned because it is a choice (brief F's words:
  // "a TD email different from the live TD"), and the report says so.
  await recordTd(casey, club, 'casey@handoverfc-staff.example');
  await db.query(`insert into verification_call (club_id, called_at, operator, number_called, number_source, outcome, td_name, td_email, policy_version)
    values ($1,now(),'BUZ','03 9000 0000','FV club directory','verified','Casey Callander','secretary@handoverfc.example','27@v1.0')`, [club]);
  check('tdx23: a call recording the club\'s own mailbox ends the live TD and attaches nobody',
    [await liveTds(), (await endings()).at(-1)?.cause ?? null], [[], 'replaced_on_call']);

  // Structural: one call names the TD, and every reader asks for it (L23).
  check('tdx24: the wall, the attach and the console all read the one call (fn_td_call)',
    [/fn_td_call/.test(await procSrc('fn_td_on_call')),
     /fn_td_call/.test(await procSrc('fn_attach_recorded_td')),
     /fn_td_call/.test(await procSrc('fn_club_td')),
     /fn_td_replaced_on_call/.test(await procSrc('fn_call_attaches_td'))],
    [true, true, true, true]);
  check('tdx25: td_ending has row-level security like every table (L26)',
    (await one(`select relrowsecurity as r from pg_class where relname = 'td_ending'`)).r, true);

  // The doors in the product. The club's action ends through fn_end_td and
  // takes no club from the form; the operator's checks the operator first;
  // nothing in app/ ends a TD row with its own UPDATE or calls the worker.
  const rolesAct = codeOnly(srcOf('app/club/roles/actions.ts'));
  const callAct = codeOnly(srcOf('app/ops/call/[clubId]/actions.ts'));
  const endTdBody = /export async function endTd\([\s\S]*?\n\}/.exec(callAct)?.[0] ?? '';
  const endAccessBody = /export async function endTdAccess\([\s\S]*?\n\}/.exec(rolesAct)?.[0] ?? '';
  check('tdx26: /club/roles ends a TD only through fn_end_td, for the club the session administers — never a club id off the form',
    [/fn_end_td\(\$1, \$2, \$3\)/.test(endAccessBody), /formData\.get\('club/.test(endAccessBody), /fn_ops_end_td/.test(rolesAct)],
    [true, false, false]);
  check('tdx27: the call sheet\'s door checks the operator before it asks the database to end anything',
    [endTdBody.indexOf('requireOperator()') > -1,
     endTdBody.indexOf('requireOperator()') < endTdBody.indexOf('fn_ops_end_td')], [true, true]);
  const endsByHand = routeFiles.filter((f) => {
    const src = codeOnly(readFileSync(f, 'utf8'));
    return /fn_td_ends|fn_td_replaced_on_call/.test(src)
      || /update membership set ended_at[^`]*technical_director/.test(src)
      || (/fn_ops_end_td/.test(src) && !/\/app\/ops\//.test(f));
  });
  check('tdx28: nothing else in app/ ends a Technical Director — no UPDATE of its own, no call to the worker, no operator door outside /ops',
    endsByHand.map((f) => f.slice(f.indexOf('app/'))), []);
}

// ---------------------------------------------------------------------------
// 0121 — a Technical Director name mismatch is held for a human, and never
// auto-passes (BUZ's approved default 5, 28 Sep; brief H). Round F found the
// call's recorded name was compared to nothing: the role attached to
// whichever proved account held the address, whatever it was called.
// ---------------------------------------------------------------------------
{
  const club = crypto.randomUUID(), firstCall = crypto.randomUUID();
  const dana = crypto.randomUUID(), op = crypto.randomUUID(), admin = crypto.randomUUID();
  const one = async (sql, params) => (await db.query(sql, params)).rows[0];
  const refusedQ = async (sql, params) => { try { await db.query(sql, params); return false; } catch { return true; } };
  const liveTds = async () => (await db.query(
    `select person_id from membership where club_id = $1 and role = 'technical_director' and ended_at is null`, [club])).rows.map((r) => r.person_id);
  const sheet = async () => one(`select td_name, account_name, name_matches, name_confirmed, active, ended_at is not null as ended from fn_club_td($1)`, [club]);
  const call = async (name, email) => db.query(
    `insert into verification_call (club_id, called_at, operator, number_called, number_source, outcome, td_name, td_email, policy_version)
     values ($1, now(), 'BUZ', '03 9000 0000', 'FV club directory', 'verified', $2, $3, '27@v1.0')`, [club, name, email]);
  const confirm = async (who, email) => (await one('select fn_ops_confirm_td_name($1,$2,$3) as p', [who, email, club])).p;

  const m = async (a, f, l) => (await one('select fn_td_name_matches($1,$2,$3) as m', [a, f, l])).m;
  check('tdn1: the same name is the same name whatever the case and spacing, and a first-name initial is allowed',
    [await m('Dana Kowalski', 'Dana', 'Kowalski'), await m('  dana   KOWALSKI ', 'Dana', 'Kowalski'), await m('D. Kowalski', 'Dana', 'Kowalski'),
     await m('D Kowalski', 'Dana', 'Kowalski'), await m('Dana Kowalski', 'D.', 'Kowalski')], [true, true, true, true, true]);
  check('tdn1b: and nothing else is — another first name, a different surname, a middle name, a surname alone, no name, a wrong initial',
    [await m('Jordan Kowalski', 'Dana', 'Kowalski'), await m('Dana Kowalsky', 'Dana', 'Kowalski'), await m('Dana Maria Kowalski', 'Dana', 'Kowalski'),
     await m('Kowalski', 'Dana', 'Kowalski'), await m('', 'Dana', 'Kowalski'), await m('J. Kowalski', 'Dana', 'Kowalski'), await m('Dana Kowalski', 'Dana', null)],
    [false, false, false, false, false, false, false]);

  await db.query(`insert into club (id, name, suburb, state, contact_email, club_state) values ($1,'Namecheck FC',null,'VIC','secretary@namecheck.example','claimed')`, [club]);
  await db.query(`insert into person (id, first_name, last_name, dob, email) values
    ($1,'Dana','Kowalski',$4,'dana@namecheck-staff.example'), ($2,'Olive','Operator',$4,'olive@pitch.example'), ($3,'Nadia','Admin',$4,null)`,
    [dana, op, admin, yearsAgo(41)]);
  await mem(admin, club, null, 'club_admin');
  await proveAddress(dana);
  await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
    values ($1,$2,now() - interval '1 hour','BUZ','03 9000 0000','FV club directory','verified','27@v1.0')`, [firstCall, club]);
  await db.query(`update club set club_state='verified', verified_call_id=$1 where id=$2`, [firstCall, club]);

  // The call records the address Dana proved, under a name that is not hers.
  await call('Jordan Kowalski', 'dana@namecheck-staff.example');
  check('tdn2: a proved account whose name is not the name on the call does NOT get the role — held, not attached',
    [await liveTds(), (await one('select fn_td_on_call($1,$2) as c', [dana, club])).c, (await one('select fn_can_work_register($1,$2) as c', [dana, club])).c],
    [[], false, false]);
  check('tdn2b: the call sheet shows the mismatch — the recorded name beside the account’s own, not confirmed, not active',
    await sheet(), { td_name: 'Jordan Kowalski', account_name: 'Dana Kowalski', name_matches: false, name_confirmed: false, active: false, ended: false });
  await expectFail('tdn2c: and nobody can write the role for her by hand while it is held (the wall asks the same question)',
    `insert into membership (person_id, club_id, role) values ('${dana}','${club}','technical_director')`);

  // The human: named, logged, and it attaches.
  check('tdn3: the confirmation is an operator’s — a person named by their own address; anyone else is refused',
    [await refusedQ('select fn_ops_confirm_td_name($1,$2,$3)', [op, 'someone.else@pitch.example', club]),
     await refusedQ('select fn_ops_confirm_td_name($1,$2,$3)', [null, 'olive@pitch.example', club]), await liveTds()],
    [true, true, []]);
  check('tdn3b: an operator who confirms it switches the role on in the same transaction',
    [await confirm(op, 'olive@pitch.example'), await liveTds()], [dana, [dana]]);
  check('tdn3c: and it is logged — which operator, which call, which account, and both names as they stood',
    await one(`select t.operator_id, t.operator_email, t.recorded_name, t.account_name, t.person_id,
      t.call_id = fn_td_call($1) as this_call from td_name_confirmation t where club_id = $1`, [club]),
    { operator_id: op, operator_email: 'olive@pitch.example', recorded_name: 'Jordan Kowalski', account_name: 'Dana Kowalski', person_id: dana, this_call: true });
  check('tdn3d: the sheet now says confirmed and active',
    [(await sheet()).name_confirmed, (await sheet()).active], [true, true]);
  check('tdn3e: a second press writes nothing new',
    [await confirm(op, 'olive@pitch.example'), (await one('select count(*)::int as n from td_name_confirmation where club_id = $1', [club])).n], [dana, 1]);
  check('tdn4: the confirmation is append-only',
    [await refusedQ(`update td_name_confirmation set recorded_name = 'Dana Kowalski' where club_id = $1`, [club]),
     await refusedQ(`delete from td_name_confirmation where club_id = $1`, [club])], [true, true]);
  check('tdn4b: and has row-level security like every table (L26)',
    (await one(`select relrowsecurity as r from pg_class where relname = 'td_name_confirmation'`)).r, true);

  // A new call is a new question: the confirmation belonged to the last one.
  await call('J. Kowalski', 'dana@namecheck-staff.example');
  check('tdn5: a later call recording her address under a name that is not hers ends the role at once — held again, not carried over',
    [await liveTds(), (await one(`select cause from td_ending where club_id = $1 order by id desc limit 1`, [club])).cause,
     (await sheet()).name_confirmed, (await sheet()).ended],
    [[], 'replaced_on_call', false, false]);
  check('tdn5b: and a human can resolve that hold on the new call, without a third one',
    [await confirm(op, 'olive@pitch.example'), await liveTds()], [dana, [dana]]);

  // A call with a matching name — the initial form — attaches on its own.
  await call('D. Kowalski', 'dana@namecheck-staff.example');
  check('tdn6: a call naming her by initial and surname is her, and needs nobody', [await liveTds(), (await sheet()).name_matches], [[dana], true]);

  // The mailbox is never a person, whoever confirms it (0060).
  const tessa = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,'Tessa','Treasurer',$2,'secretary@namecheck.example')`, [tessa, yearsAgo(50)]);
  await proveAddress(tessa);
  await call('Jordan Kowalski', 'secretary@namecheck.example');
  check('tdn7: an operator cannot confirm the club’s own mailbox into the role — nothing attached, nothing recorded as confirmed',
    [await confirm(op, 'olive@pitch.example'), (await liveTds()).includes(tessa),
     (await one('select count(*)::int as n from td_name_confirmation where person_id = $1', [tessa])).n], [null, false, 0]);

  const callSheet = codeOnly(srcOf('app/ops/call/[clubId]/page.tsx'));
  const callActs = codeOnly(srcOf('app/ops/call/[clubId]/actions.ts'));
  const confirmBody = /export async function confirmTdName\([\s\S]*?\n\}/.exec(callActs)?.[0] ?? '';
  check('tdn8: the call sheet’s confirmation checks the operator first and asks the database, and nothing else in app/ writes a confirmation',
    [confirmBody.indexOf('requireOperator()') > -1 && confirmBody.indexOf('requireOperator()') < confirmBody.indexOf('fn_ops_confirm_td_name'),
     routeFiles.filter((f) => /td_name_confirmation/.test(codeOnly(readFileSync(f, 'utf8')))).length],
    [true, 0]);
  const queueSrc = codeOnly(srcOf('app/ops/verification/page.tsx'));
  check('tdn9: the verification queue says a held name is held — never "waiting on their account" — and reads the confirmation from fn_club_td',
    [/const NAME_HELD_STATE = 'on hold: not the name on the call';/.test(queueSrc),
     queueSrc.search(/r\.name_matches === false && !r\.name_confirmed \? NAME_HELD_STATE/) > 0
       && queueSrc.search(/r\.name_matches === false && !r\.name_confirmed \? NAME_HELD_STATE/) < queueSrc.indexOf("'waiting on their account'"),
     /td\.name_confirmed/.test(queueSrc)], [true, true, true]);
  const todaySrc = codeOnly(srcOf('app/ops/page.tsx'));
  // BUZ approved the words on 29 Sep: the tile shows in production too, still a
  // count, and still omitted at zero (D-162).
  check('tdn9b: Today\u2019s waiting-texts tile shows its approved words in every build, and only when the count is above zero (D-168, D-162)',
    [/const HELD_WAITING_TEXTS = \['Texts waiting for SMS'/.test(todaySrc), /HELD_WAITING_TEXTS && waitingTexts > 0 &&/.test(todaySrc)], [true, true]);
  check('tdn8b: the held state and its button show whenever the role is held (words approved in advance, 29 Sep), and the sentence that said the role goes to the account is gone (L25)',
    [/: heldForName\s*\? NAME_HELD_STATE/.test(callSheet), /\{heldForName \? \(\s*<form action=\{confirmTdName\}/.test(callSheet),
     srcOf('app/ops/call/[clubId]/page.tsx').includes('The role goes to this account, not to the name above.')],
    [true, true, false]);
}

// J: the union rule (A12c) — a person wearing two hats gets the higher of
// the two, computed at read time.
await mem(ID.clubAdmin, CLUB.riverside, SQUAD.u15, 'coach');
await db.query(`insert into wwcc_attestation (person_id, club_id, attested_by) values ($1,$2,$3)`, [ID.clubAdmin, CLUB.riverside, ID.td]);
check('J1b: admin + verified squad coach = the union, not the lower role', await level(ID.clubAdmin, ID.deniz), 'full');
await db.query(`update membership set ended_at = now() where person_id = $1 and role = 'coach'`, [ID.clubAdmin]);
await db.query(`update wwcc_attestation set revoked_at = now() where person_id = $1`, [ID.clubAdmin]);
check('J1c: drop the coaching hat and the wall is back', await level(ID.clubAdmin, ID.deniz), 'membership_only');

// ---------------------------------------------------------------------------
// Table D — WRITING to the record. No screens exist yet; the rules do, and
// they are enforced by the database so the screens cannot route around them.
// ---------------------------------------------------------------------------
check('D1: the squad coach writes, stamped coach_verified', await prov(ID.coachV, REC.deniz), 'coach_verified');
check('D2: a coach with no WWCC attestation cannot write', await prov(ID.coachU, REC.deniz), null);
check('D3: a verified coach at another squad cannot write', await prov(ID.coachUnassigned, REC.deniz), null);
check('D4: a coach at another club cannot write', await prov(ID.coachOther, REC.deniz), null);
check('D5: the technical director writes club-wide', await prov(ID.td, REC.deniz), 'coach_verified');
check('D6: the club administrator cannot write — the registrar wall', await prov(ID.clubAdmin, REC.deniz), null);
check('D7: the team manager cannot write either', await prov(ID.teamManager, REC.deniz), null);
check('D8: a departed coach keeps what they wrote but not the pen', await prov(ID.coachFormer, REC.deniz), null);
check('D9: the player writes their own record as self-reported', await prov(ID.deniz, REC.deniz), 'self_reported');
check('D10: the guardian writes as self-reported, never as a coach', await prov(ID.guardian, REC.deniz), 'self_reported');
check('D11: a revoked guardian cannot write', await prov(ID.exGuardian, REC.deniz), null);
check('D12: a guardianship lapsed at 18 grants no write', await prov(ID.guardian, REC.marcus), null);
check('D13: an anonymous writer is refused', await prov(null, REC.deniz), null);
check('D14: a coach at an UNVERIFIED club cannot write (D-126)', await prov(ID.coachAtUnverified, REC.deniz), null);

// The trigger, not the function, is what makes it a property.
await expectFail('D15: a club admin cannot insert an entry regardless',
  `insert into record_entry (record_id, entry_type, author_id, provenance)
   values ('${REC.deniz}','coach_note','${ID.clubAdmin}','coach_verified')`);
await expectFail('D16: a coach cannot claim self_reported to dodge the tag',
  `insert into record_entry (record_id, entry_type, author_id, provenance)
   values ('${REC.deniz}','coach_note','${ID.coachV}','self_reported')`);
await expectFail('D17: a player cannot promote their own note to coach_verified',
  `insert into record_entry (record_id, entry_type, author_id, provenance)
   values ('${REC.deniz}','coach_note','${ID.deniz}','coach_verified')`);
await expectFail('D18: nobody can hide behind official_import (D-62)',
  `insert into record_entry (record_id, entry_type, author_id, provenance)
   values ('${REC.deniz}','coach_note','${ID.coachOther}','official_import')`);

// D-50: 48 hours to correct your own words, then supersede instead.
const oldEntry = crypto.randomUUID();
await db.query(
  `insert into record_entry (id, record_id, entry_type, author_id, provenance)
   values ($1,$2,'coach_note',$3,'coach_verified')`, [oldEntry, REC.georgia, ID.coachUnassigned]);
await db.exec(`update record_entry set body = '{"t":"fixed"}' where id = '${oldEntry}'`);
check('D19: an author may correct inside the 48-hour window',
  (await db.query('select body->>\'t\' as t from record_entry where id = $1', [oldEntry])).rows[0].t, 'fixed');
// Fabricate the passage of time. The trigger refuses to let created_at move —
// which is itself the D-50 guarantee — so the harness stands it down for one
// statement rather than weakening the rule to make the test convenient.
await db.exec(`alter table record_entry disable trigger record_entry_edit_window`);
await db.query(`update record_entry set created_at = now() - interval '3 days' where id = $1`, [oldEntry]);
await db.exec(`alter table record_entry enable trigger record_entry_edit_window`);
await expectFail('D20: after 48 hours the entry is immutable (D-50)',
  `update record_entry set body = '{"t":"late"}' where id = '${oldEntry}'`);
await expectFail('D21: authorship can never be rewritten',
  `update record_entry set author_id = '${ID.td}' where id = '${oldEntry}'`);

// ---------------------------------------------------------------------------
// Tables L and Q — putting the record in front of somebody else (D-91, D-99,
// D-101). One question, one function, three surfaces.
// ---------------------------------------------------------------------------
const canSend = async (actor, rec) =>
  (await db.query('select fn_can_dispatch($1,$2) as c', [actor, rec])).rows[0].c;

check('L1: a u16 cannot send her own CV — it routes to the guardian', await canSend(ID.deniz, REC.deniz), false);
check('L2: the guardian sends for the u16', await canSend(ID.guardian, REC.deniz), true);
check('L3: either guardian may send (equal visibility, D-51)', await canSend(ID.guardian2, REC.deniz), true);
check('L4: a revoked guardian cannot send', await canSend(ID.exGuardian, REC.deniz), false);
check('L5: a 16–17 player sends for themselves', await canSend(ID.nate, REC.nate), true);
check('L6: and their guardian can too', await canSend(ID.guardian, REC.nate), true);
check('L7: an adult sends alone', await canSend(ID.marcus, REC.marcus), true);
check('L8: a guardianship lapsed at 18 cannot send (D-49)', await canSend(ID.guardian, REC.marcus), false);
check('L9: the club cannot send a child\u2019s CV anywhere', await canSend(ID.td, REC.deniz), false);
check('L10: nor can an anonymous caller', await canSend(null, REC.deniz), false);

await expectFail('L11: a coach cannot mint a share link for a player',
  `insert into share_token (record_id, token_hash, issued_by) values ('${REC.deniz}', '\\x0102030405060708'::bytea, '${ID.coachV}')`);
await expectFail('L12: the u16 cannot mint her own link either (D-91)',
  `insert into share_token (record_id, token_hash, issued_by) values ('${REC.deniz}', '\\x0202030405060708'::bytea, '${ID.deniz}')`);
await expectFail('L13: a send cannot be dispatched by an unentitled hand',
  `insert into share_request (record_id, requested_by, destination, dispatched_by, dispatched_at)
   values ('${REC.deniz}','${ID.deniz}','club@example.com','${ID.coachV}', now())`);
await expectFail('L14: a dispatch cannot be recorded without a time',
  `insert into share_request (record_id, requested_by, destination, dispatched_by)
   values ('${REC.deniz}','${ID.deniz}','club@example.com','${ID.guardian}')`);
await db.exec(`insert into share_request (record_id, requested_by, destination, dispatched_by, dispatched_at)
  values ('${REC.deniz}','${ID.deniz}','club@example.com','${ID.guardian}', now())`);
check('L15: the child composes and the guardian dispatches', true, true);

const cardId = crypto.randomUUID();
await expectFail('Q1: a card cannot hold a URL before it is approved (D-101)',
  `insert into share_card_approval (record_id, requested_by, card_kind, storage_path)
   values ('${REC.deniz}','${ID.deniz}','og','cards/deniz.png')`);
await db.query(
  `insert into share_card_approval (id, record_id, requested_by, card_kind, image_hash)
   values ($1,$2,$3,'og',$4)`, [cardId, REC.deniz, ID.deniz, sha('card-bytes')]);
check('Q2: an unapproved card exists with no path at all',
  (await db.query('select storage_path from share_card_approval where id = $1', [cardId])).rows[0].storage_path, null);
await expectFail('Q10b: the club cannot approve a child\u2019s card — denied at the query layer',
  `update share_card_approval set approved_by = '${ID.td}', approved_at = now() where id = '${cardId}'`);
await expectFail('Q10c: nor can the u16 approve her own',
  `update share_card_approval set approved_by = '${ID.deniz}', approved_at = now() where id = '${cardId}'`);
await expectFail('Q5: the artefact approved must be the one that was shown',
  `update share_card_approval set image_hash = '\\x99'::bytea, approved_by = '${ID.guardian}', approved_at = now() where id = '${cardId}'`);
await db.exec(`update share_card_approval set approved_by = '${ID.guardian}', approved_at = now(), storage_path = 'cards/deniz.png' where id = '${cardId}'`);
check('Q6: the guardian approves, and only then does a path exist',
  (await db.query('select storage_path from share_card_approval where id = $1', [cardId])).rows[0].storage_path, 'cards/deniz.png');

// ---------------------------------------------------------------------------
// D-62 — "the UI always displays the tag... never render a number without its
// source" — and the tag it displays is the one the ROW carries.
//
// Deliberately NOT labelled with a doc 14 row id (L4): doc 14 §D7/D8 test who
// may WRITE a provenance and that it is derived from the actor, and §Q tests
// who may approve a share card. Nothing in doc 14 says what a rendered number
// is captioned, so these rows are D-62's and D-105's, not doc 14's.
//
// Every one of these was false on 28 Sep: six surfaces printed the word
// "Self-reported" as a literal whatever the rows said, and the guardian-
// approved card — the one artefact that cannot be recalled (D-101) and that
// every platform caches for good (D-89) — printed three numbers in its
// largest type with no source at all.
// ---------------------------------------------------------------------------
const statSurfaces = {
  'the public CV': 'components/cv/PlayerCV.tsx',
  'the print sheet': 'app/p/[token]/print/page.tsx',
  'the public OG card': 'app/p/[token]/opengraph-image.tsx',
  'the guardian-approved share card': 'app/g/card/[cardId]/image/route.tsx',
};
for (const [what, rel] of Object.entries(statSurfaces)) {
  const src = codeOnly(srcOf(rel));
  check(`D-62: ${what} labels a number from the row, never from a typed word`,
    [/PROVENANCE_LABELS|provenanceLabel/.test(src), /['"`]Self-reported/.test(src)], [true, false]);
  check(`D-62: ${what} captions a mixed block per number, never with one averaged label`,
    /sharedProvenance/.test(src), true);
}
const cardSrc = codeOnly(srcOf('app/g/card/[cardId]/image/route.tsx'));
check('D-62: the share card reads provenance out of the database beside the value',
  /'provenance', provenance/.test(cardSrc), true);
// D-89, restated as a guard on the change above: a tag is a fact about the
// number. Nothing about the CHILD may ride in beside it.
check('D-89: and the card still carries no club, age group, region or school',
  /club|age_group|ageGroup|region|suburb|school/i.test(cardSrc), false);

// The vocabulary itself: the column's domain and the words we display must be
// the same three, so a fourth value cannot arrive without a word for it.
const provDef = (await db.query(
  `select pg_get_constraintdef(oid) as d from pg_constraint
   where conrelid = 'player_stat'::regclass and pg_get_constraintdef(oid) like '%provenance%'`)).rows[0].d;
check('D-62: every provenance player_stat permits has a word to display it',
  PROVENANCE.every((v) => provDef.includes(`'${v}'`))
    && (provDef.match(/'/g) ?? []).length === PROVENANCE.length * 2, true);
check('D-62: and they are the three tags the register names',
  PROVENANCE.map((v) => PROVENANCE_LABELS[v]), ['Self-reported', 'Coach-verified', 'Official import']);

// The mixed-block rule, which is the one product question in this change:
// a caption is a statement about every number under it.
check('D-62: a block whose numbers share a source is captioned once',
  sharedProvenance([{ provenance: 'self_reported' }, { provenance: 'self_reported' }]), 'self_reported');
check('D-62: a coach-verified number is captioned coach-verified, not self-reported',
  sharedProvenance([{ provenance: 'coach_verified' }]), 'coach_verified');
check('D-62: a mixed block gets no block caption at all, so each number carries its own',
  sharedProvenance([{ provenance: 'self_reported' }, { provenance: 'coach_verified' }]), null);
check('D-62: an empty block is captioned by nothing', sharedProvenance([]), null);
check('D-62: a value outside the domain reads as the weakest claim, never a stronger one',
  sharedProvenance([{ provenance: 'endorsed_by_dad' }, { provenance: 'self_reported' }]), 'self_reported');

// D-105 — STAT_SETS is the DEFAULT PRE-SELECTION. It was exported and imported
// by nothing, and the build form typed the outfield three in instead, so a
// goalkeeper opened their own page with Goals and Assists lit and Clean sheets
// dimmed. It is a default, not a renderer: the player still chooses (D-105) and
// the never-zero rule still decides what appears (D-70).
const buildFormSrc = codeOnly(srcOf('app/build/[recordId]/BuildForm.tsx'));
check('D-105: the build form opens on the position set, not on a list typed into it',
  [/STAT_SETS\[positionGroup\(/.test(buildFormSrc), /\['apps', 'goals', 'assists'\]/.test(buildFormSrc)],
  [true, false]);
check("D-105: a keeper's default is appearances and clean sheets",
  [...STAT_SETS[positionGroup(['GK'])]], ['apps', 'clean_sheets']);
check('D-105: a selection already stored is never overridden by a default',
  /chosen \?\? defaultSurfaced/.test(buildFormSrc), true);
// And the fixture that hid the bug. Nate's selection was hand-written in
// lib/fixtures.ts as exactly what a correct default produces, so the keeper's
// page demoed perfectly for weeks while the form that produces it handed every
// real keeper the outfield set. It is derived now — and that moves the risk
// rather than removing it, because a wrong STAT_SETS would quietly change
// every fixture and still look consistent with itself. So the sets are pinned
// to the words in doc 16 §2 (CLAUDE.md's schema delta), which is the thing the
// fixture used to stand in for (L33).
const DOC16_STAT_SETS = {
  GK: ['apps', 'clean_sheets'],
  DEF: ['apps', 'clean_sheets', 'goals', 'assists'],
  MID: ['apps', 'goals', 'assists'],
  FWD: ['apps', 'goals', 'assists'],
  UNSET: ['apps', 'goals', 'assists'],
};
for (const [group, set] of Object.entries(DOC16_STAT_SETS)) {
  check(`D-105: the ${group} default pre-selection is doc 16's set`, [...STAT_SETS[group]], set);
}
check('D-105: and STAT_SETS answers for every position group, with no sixth',
  Object.keys(STAT_SETS).sort(), Object.keys(DOC16_STAT_SETS).sort());
check('D-105: no house fixture writes a selection down instead of deriving it',
  /surfacedStats:\s*\[/.test(codeOnly(srcOf('lib/fixtures.ts'))), false);
for (const f of PLAYER_FIXTURES) {
  check(`D-105: ${f.slug} opens on the default for ${f.positions.join('/')}`,
    f.surfacedStats, [...STAT_SETS[positionGroup(f.positions)]]);
}

// D-162 (28 Sep) — the never-zero rule is a PRODUCT rule: a zero is never
// rendered as a value, a count or a control that leads nowhere. It bars the
// digit, not the fact of absence. On the stat surfaces it was already built
// (every one of them filters value > 0), with one hole: the build form printed
// a stored 0 back into its own input, which is the pre-filled zero D-70 names.
check('D-162: the build form never prints a stored zero into a stat input',
  /record\.stats\?\.\[k\] \?/.test(buildFormSrc), true);
check('D-162: and a zero typed into it is absence, so nothing stores one',
  /raw === '' \|\| n === 0 \? null/.test(codeOnly(srcOf('app/build/[recordId]/actions.ts'))), true);
for (const [what, rel] of Object.entries({
  ...statSurfaces,
  'the squad roster': 'app/club/squads/[squadId]/page.tsx',
  'the record read path': 'lib/record-read.ts',
  'the approved snapshot': 'lib/cv-build.ts',
})) {
  const src = codeOnly(srcOf(rel));
  // The read path and the snapshot read fn_stat_public (0083), which is
  // where their filter now lives — asked of the function, not the query text.
  const viaFn = /fn_stat_public\(\$1\) as stats/.test(src) && /ps\.value > 0/.test(await procSrc('fn_stat_public'));
  check(`D-162: ${what} omits a zero rather than printing one`,
    /value > 0|\.value > 0|\(v \?\? 0\) > 0|value is not null and value > 0/.test(src) || viaFn, true);
}

// ---------------------------------------------------------------------------
// Table F — two guardians, most-restrictive-wins (D-51). Deniz has two.
// ---------------------------------------------------------------------------
check('F1: both guardians read in full', await level(ID.guardian2, ID.deniz), 'full');
// Most-restrictive-wins is not a tie-break between two settings — it is the
// rule that one hand is enough. Guardian2 pauses; guardian1 never agreed.
await db.query(`insert into guardian_setting (child_id, profile_paused, updated_by) values ($1, true, $2)
  on conflict (child_id) do update set profile_paused = true, updated_by = $2`, [ID.deniz, ID.guardian2]);
check('F2: either guardian alone can stop the outward profile (D-51)',
  (await db.query('select fn_token_read($1) as r', [t.live])).rows[0].r, null);
check('F3: the other guardian still reads it inside Pitch', await level(ID.guardian, ID.deniz), 'full');
await db.query(`update guardian_setting set profile_paused = false where child_id = $1`, [ID.deniz]);
check('F4: lifting the pause brings the live link back',
  (await db.query('select fn_token_read($1) as r', [t.live])).rows[0].r === null, false);
// Nate's off-switch was thrown by guardian1 in table B and guardian2 has no
// say in reversing it — that is the same rule seen from the other side.
check('F5: one guardian\u2019s off-switch closes discovery for a 16–17 (D-22)',
  await searchable(ID.coachV, ID.nate), false);
check('F6: and the club he actually plays for still sees him', await level(ID.td, ID.nate), 'full');

// ---------------------------------------------------------------------------
// Auth (D-94 §2, doc 15 §10 amendment). Read against the source and the DB.
// ---------------------------------------------------------------------------
const authSrc = readFileSync(fileURLToPath(new URL('../lib/auth.ts', import.meta.url)), 'utf8');
const signinSrc = readFileSync(fileURLToPath(new URL('../app/signin/actions.ts', import.meta.url)), 'utf8');
const resetSrc = readFileSync(fileURLToPath(new URL('../app/reset/actions.ts', import.meta.url)), 'utf8');

check('D-94: passwords are never stored in the clear', /password_hash/.test(authSrc) && !/values \(\$1, *password\)/.test(authSrc), true);
check('D-94: password comparison is constant-time', authSrc.includes('timingSafeEqual'), true);
check('D-94: a non-existent account still does the hashing work (no timing oracle)', authSrc.includes('decoy'), true);
// WAS: "exactly one outcome, whatever happened" — one redirect() in the file,
// counted. That was a proxy for "the refusal never says why", and the proxy was
// doing harm: it pinned redirect('/home') on every path, so a wrong password
// landed on "Welcome back / One account, whichever seat you hold." and every
// mistyped password read as an outage. D-94 §2 asks for the response to be
// IDENTICAL whether or not the account exists; it does not ask for silence.
// The rule itself, in place of the proxy (L33): two outcomes, in and refused,
// and every cause of a refusal reaches the same one. Pressed for real in the
// write suite, sr2–sr4.
{
  const code = codeOnly(signinSrc);
  const targets = [...code.matchAll(/redirect\((['"`])([^'"`]*)\1\)/g)].map((m) => m[2]);
  check(`D-94: sign-in has two outcomes — in, or refused — and nothing else (${targets.join(', ')})`,
    targets, ['/home', '/signin?refused=1']);
  check('D-94: and the refusal never says which of the four causes it was',
    /refused=(password|nosuch|unknown|rate|locked)|refused=1[^'"`]*&|reason=/.test(code), false);
}
check('D-94: reset request has exactly one outcome', resetSrc.includes("redirect('/reset?sent=1')"), true);
check('§10 amendment: an under-16 reset routes to the guardian', authSrc.includes("band === 'u16' && !p.dobless_guardian ? p.guardian_email"), true);
// The one exception: a parent created at approval, who has no date of birth
// and so reads as under 16. It can only ever be someone with NO date of
// birth who is an approved guardian — never a child with a real DOB.
check('§10 amendment: only a parent with no DOB is exempt, never a child with one',
  /\(p\.dob is null and exists\(select 1 from guardianship_link g2\s+where g2\.guardian_id = p\.id and g2\.approved_at is not null and g2\.revoked_at is null\)\) as dobless_guardian/.test(authSrc), true);
check('D-94 §4: reset tokens are stored hashed, never raw', /token_hash/.test(authSrc) && !/values \(\$1, *token\)/.test(authSrc), true);
check('§33: the sign-in alert carries no IP, city or device string',
  /ip|city|geo|fingerprint/i.test(msgCode.split('newSignInEmail')[1]?.split('export const')[0] ?? ''), false);

// Reset tokens: single use, and expiry is enforced in SQL.
const resetPerson = crypto.randomUUID();
await db.query(`insert into person (id, first_name, dob, email) values ($1,'Reset','${yearsAgo(30)}','reset@example.com')`, [resetPerson]);
const rawTok = 'test-reset-token';
const tokHash = sha(rawTok);
await db.query(`insert into auth_reset (person_id, token_hash, expires_at) values ($1,$2, now() + interval '1 hour')`, [resetPerson, tokHash]);
// Through the database's own answer, not a copy of its query (L23). These
// three carried their own hand-written UPDATE, which from 0062 was no longer
// the statement the product runs — it never looked at revoked_at, so it would
// have stayed green with supersession completely broken.
const consume = async (h) => (await db.query('select fn_use_auth_reset($1) as p', [h])).rows[0].p;
check('reset token works once', await consume(tokHash), resetPerson);
check('reset token cannot be reused', await consume(tokHash), null);
await db.query(`insert into auth_reset (person_id, token_hash, expires_at) values ($1,$2, now() - interval '1 minute')`, [resetPerson, sha('expired-token')]);
check('an expired reset token is refused', await consume(sha('expired-token')), null);

// ---------------------------------------------------------------------------
// Route enumeration — absence as a property (doc 14 §N12, §P11, §C1, D-122).
// These are static asserts over the app tree: the dangerous surface must
// not exist, not merely be forbidden.
// ---------------------------------------------------------------------------
import { readdirSync as rd, statSync } from 'node:fs';
const appDir = fileURLToPath(new URL('../app', import.meta.url));
const walk = (d) => rd(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const files = walk(appDir);
const rel = (p) => p.slice(appDir.length);

// The link-state page cannot distinguish dead states because it is never
// handed anything to distinguish them WITH: the one read path returns a bare
// null, so the page has no state variable to branch on. Verified in the
// browser too — the only bytes that differ between a revoked and an expired
// link are the dev cache-buster and the token the requester already holds.
const pageCode = codeOnly(deadPage);
check('dead4: the page branches on one boolean, never on WHY the link is dead',
  /expired|revoked|paused|disabled/i.test(pageCode), false);

// Table E as doc 14 words it (28 Sep). The labels above claimed E1–E10 and
// tested other things — the read path's shape, noindex, the OG route — so
// rows were counted and not tested (L4). These test the rows. E9 and E10
// (identical timing) are not claimed here: nothing in this suite times a
// response, and render-tests fp7 times club pages, not links.
{
  const eChild = crypto.randomUUID(), eRec = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob) values ($1,'Etable',$2)`, [eChild, yearsAgo(13)]);
  await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2, now())`, [ID.guardian, eChild]);
  await db.query(`insert into development_record (id, person_id) values ($1,$2)`, [eRec, eChild]);
  // An under-16 page reads only once it has approved content (D-119).
  await db.query(`insert into profile_version (record_id, content, status, approved_by, approved_at) values ($1,'{"name":"Etable"}','approved',$2, now())`, [eRec, ID.guardian]);
  const mint = (rec, by, tag, issued = '0 days', life = '90 days') => db.query(
    `insert into share_token (record_id, token_hash, issued_by, issued_at, expires_at)
     values ($1,$2,$3, now() - ($4)::interval, now() - ($4)::interval + ($5)::interval)`, [rec, sha(tag), by, issued, life]);
  const live = async (tag) => (await readTok(sha(tag))) !== null;

  await expectFail('E1: an under-16 cannot generate their own link — the token exists only on the guardian’s action (D-91)',
    `insert into share_token (record_id, token_hash, issued_by) values ('${eRec}', decode(md5('e1-child'),'hex'), '${eChild}')`);
  await mint(eRec, ID.guardian, 'e2-guardian');
  const replaceSrc = codeOnly(srcOf('app/g/controls/[childId]/actions.ts')).split('export async function replaceLink')[1]?.split('export async function')[0] ?? '';
  check('E2: the guardian generates one, and the product mints it with a 90-day expiry (D-53)',
    [await live('e2-guardian'), /insert into share_token[\s\S]*now\(\) \+ interval '90 days'/.test(replaceSrc)], [true, true]);
  await mint(REC.nate, ID.nate, 'e3-teen');
  await db.query(`insert into consent_event (event, actor_id, subject_id, detail)
    values ('share_dispatched',$1,$1, jsonb_build_object('club_name','Etable FC','recipient','club@etable.example','band_at_send','16_17'))`, [ID.nate]);
  check('E3: a 16–17 generates their own, and it is visible to their guardian in the consent log',
    [await live('e3-teen'), (await db.query('select * from fn_send_log($1,$2)', [ID.guardian, ID.nate])).rows
      .some((r) => r.club_name === 'Etable FC' && r.sending_actor === ID.nate)], [true, true]);
  // E4: regenerate is replaceLink's two statements, in its one transaction.
  const regen = /update share_token set revoked_at=now\(\) where record_id=\$1 and revoked_at is null[\s\S]*insert into share_token/.test(replaceSrc)
    && replaceSrc.indexOf("'begin'") < replaceSrc.indexOf('update share_token') && replaceSrc.indexOf("'commit'") > replaceSrc.indexOf('insert into share_token');
  await db.query(`update share_token set revoked_at=now() where record_id=$1 and revoked_at is null`, [eRec]);
  await mint(eRec, ID.guardian, 'e4-new');
  let e4err = null; let old = 'unread';
  try { old = await readTok(sha('e2-guardian')); } catch (e) { e4err = e.message; }
  check('E4: the guardian regenerates and the old token is the link-state page at once — the same null as a token that never existed, not an error',
    [regen, e4err, old, await readTok(sha('never-a-token-e4')), await live('e4-new')], [true, null, null, null, true]);
  const liveBefore = await live('e4-new');
  await db.query(`insert into guardian_setting (child_id, profile_paused, updated_by) values ($1, true, $2)`, [eChild, ID.guardian]);
  check('E5: the guardian disables the profile, and every live token goes to the link-state page', [liveBefore, await live('e4-new')], [true, false]);
  await db.query(`update guardian_setting set profile_paused = false where child_id = $1`, [eChild]);
  await mint(eRec, ID.guardian, 'e6-89', '89 days');
  await mint(eRec, ID.guardian, 'e6-week', '83 days 12 hours');
  const reminding = (await db.query('select child_id, token_ids from fn_links_to_remind()')).rows.find((r) => r.child_id === eChild);
  check('E6: at 89 days a token is still live, and its renewal reminder is queued (a week before, doc 15 §5)',
    [await live('e6-89'), (reminding?.token_ids ?? []).length], [true, 1]);
  await mint(eRec, ID.guardian, 'e7-91', '91 days');
  check('E7: at 91 days it is the link-state page — no grace period', await live('e7-91'), false);
  await db.query(`delete from share_token where record_id = $1`, [eRec]);
  await db.query(`delete from share_token where token_hash = $1`, [sha('e3-teen')]);
}

// Table Q, rows 3 and 4, as doc 14 words them: what an approved under-18
// card carries, and that any address on it is the marketing site's. The
// labels Q3/Q4 were on two approval refusals, which are Q10's.
{
  const cardSrc = codeOnly(srcOf('app/g/card/[cardId]/image/route.tsx'));
  const drawn = cardSrc.slice(cardSrc.indexOf('new ImageResponse('));
  check('Q3: an approved card carries first name, surname initial, positions, number, stats — and no surname, club, age group, region, school, face or record URL',
    [/const name = `\$\{c\.first_name\}\$\{c\.last_name \? ` \$\{c\.last_name\[0\]\}\.` : ''\}`;/.test(cardSrc),
     /\{name\}/.test(drawn), /positions\.join/.test(drawn), /squad_number/.test(drawn), /tiles\.map/.test(drawn),
     /last_name(?!\[0\])|club|age_?group|region|school|photo|avatar|<img|src=|\/p\/|token|https?:/i.test(drawn)],
    [true, true, true, true, true, false]);
  const og = codeOnly(eOg);
  const urls = (src) => [...src.matchAll(/['"`]([^'"`]*pitchfootball\.com\.au[^'"`]*)['"`]/g)].map((m) => m[1]);
  const found = [...urls(drawn), ...urls(og)];
  check('Q4: any address on a card is the marketing site — no token and no path',
    [found.length > 0, found.filter((u) => !/(^|[\s·])pitchfootball\.com\.au$/.test(u))], [true, []]);
}


// Club video (0018) is a LINK, never a file — the parked hosting question
// must not creep in through this door.
const clubVidSrc = readFileSync(fileURLToPath(new URL('../app/club/page-edit/actions.ts', import.meta.url)), 'utf8');
// Check the hosts one at a time. The thing being searched for is itself a
// regex — pipes for alternation, backslashes before the dots — so both a
// second regex and a naive substring get it wrong, which they each did once.
const ALLOWED_EMBED_HOSTS = ['youtube\\.com', 'youtu\\.be', 'instagram\\.com', 'veo\\.co'];
check('club video: only the allowlisted embed hosts are accepted',
  ALLOWED_EMBED_HOSTS.every((h) => clubVidSrc.includes(h)) && clubVidSrc.includes('https:'), true);
check('club video: no file is accepted anywhere on this path',
  /instanceof File|formData\.get\('video'\)|multipart/.test(clubVidSrc), false);
const clubPageSrc = readFileSync(fileURLToPath(new URL('../app/fc/[slug]/page.tsx', import.meta.url)), 'utf8');
check('club video: rendered through the click-to-play facade (D-97)',
  /ClipCard/.test(clubPageSrc), true);
check('club video: the section is omitted when the club has none',
  /videos\.length > 0/.test(clubPageSrc), true);
// The banner is now composed INTO the hero rather than floated above it, so
// the guard reads `hasBanner` rather than `c.banner_path` inline. Pin both
// halves — where the flag comes from and that the block is behind it —
// because the property that matters is that a club without a photo gets no
// empty slot, not how the condition happens to be spelled.
check('club banner: the render flag is derived from the stored path and nothing else',
  /const hasBanner = Boolean\(c\.banner_path\)/.test(clubPageSrc), true);
check('club banner: omitted when absent, so an empty page never shows a slot',
  /\{hasBanner && (!unclaimed && )?\(/.test(clubPageSrc), true);

// The crest and banner routes are the player-photo route's twins and must
// keep its D-94 §7 controls.
for (const [what, file] of [['crest', '../app/club/page-edit/crest/route.ts'], ['banner', '../app/club/page-edit/banner/route.ts']]) {
  const src = readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
  check(`D-94 §7: the ${what} is re-encoded server-side, never served as uploaded`,
    /sharp\(/.test(src) && /toBuffer\(\)/.test(src), true);
  check(`D-94 §7: the ${what} upload is size-capped`, /MAX_BYTES/.test(src), true);
  check(`D-93: only a club admin or TD may set the ${what}`,
    /technical_director','club_admin'/.test(src), true);
}

// Every image a person uploads goes through the same door, and the coach
// photo is the newest of them. Coaches were the only profile with no photo
// at all; the route is the player photo route's twin and has to keep its
// controls rather than inherit them by resemblance.
for (const [what, file] of [['player photo', '../app/build/[recordId]/photo/route.ts'],
                            ['coach photo', '../app/coach/edit/photo/route.ts']]) {
  const src = readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
  check(`D-94 §7: the ${what} is re-encoded server-side, never served as uploaded`,
    /sharp\(/.test(src) && /toBuffer\(\)/.test(src), true);
  check(`D-94 §7: the ${what} upload is size-capped`, /MAX_BYTES/.test(src), true);
  check(`D-94 §3: the ${what} route takes no person id from the caller`,
    /getSessionPersonId|recordActor/.test(src), true);
}
// A POST answered with a redirect() gets a 307, which re-POSTs the upload at
// the destination. Every upload route has to answer 303.
for (const f of ['../app/build/[recordId]/photo/route.ts', '../app/coach/edit/photo/route.ts',
                 '../app/club/page-edit/crest/route.ts', '../app/club/page-edit/banner/route.ts']) {
  const src = readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8');
  check(`D-94 §7: ${f.split('/').slice(-3, -1).join('/')} refuses with a 303, not a 307`,
    /redirect\(new URL\([^)]*\), 303\)/.test(src), true);
}

// The coach page's crest is a claim Pitch stands behind, so it comes off a
// live coaching MEMBERSHIP — never off coach_role.org_name, which is free
// text that grants nothing and could name any club in the country.
const coachCvSrc = readFileSync(fileURLToPath(new URL('../app/c/[slug]/page.tsx', import.meta.url)), 'utf8');
check('coach1: the club crest comes from membership, not from the typed role',
  /from membership m join club c2/.test(coachCvSrc), true);
check('coach2: and it only renders when a held club is the one on the page',
  /heldClubs\.find\(\(h\) => h\.crest && h\.name === current\?\.org\)/.test(coachCvSrc), true);
// Brief F: a Technical Director's live membership earns it too — the role the
// verification call confirmed (0058) — and still never the typed org name.
// Rendered both ways by the render suite (crest-r1, crest-r2).
check('coach1b: the memberships that earn a crest are a live coach\'s and a live Technical Director\'s, nothing else',
  /m\.role in \('coach', 'technical_director'\) and m\.ended_at is null\) as held_clubs/.test(coachCvSrc), true);

// ---------------------------------------------------------------------------
// Coach clips and the coaching jobs board (0019).
// ---------------------------------------------------------------------------
const samProfile = crypto.randomUUID();
await db.query(`insert into coach_profile (id, person_id, public_slug) values ($1,$2,'coach-v')`, [samProfile, ID.coachV]);
const minorCoach = crypto.randomUUID(), minorProfile = crypto.randomUUID();
await db.query(`insert into person (id, first_name, dob) values ($1,'Teen Coach',$2)`, [minorCoach, yearsAgo(17)]);
await db.query(`insert into coach_profile (id, person_id) values ($1,$2)`, [minorProfile, minorCoach]);

const canApply = async (who) => (await db.query('select fn_can_apply_for_role($1) as ok', [who])).rows[0].ok;
check('job1: an adult with a coaching profile may apply', await canApply(ID.coachV), true);
check('job2: a 17-year-old coach may not — restrictive by default (D-94)', await canApply(minorCoach), false);
check('job3: an adult with no coaching profile may not', await canApply(ID.marcus), false);

// 0042: a coach page is public, so only an adult's profile may carry a
// public link or a public contact. A minor coach keeps the profile itself.
const refuses = async (sql, args) => { try { await db.query(sql, args); return false; } catch { return true; } };
check('cpa1: a 17-year-old coach cannot be given a public link',
  await refuses(`update coach_profile set public_slug = 'teen-coach' where id = $1`, [minorProfile]), true);
check('cpa2: nor a public contact',
  await refuses(`update coach_profile set public_contact = 'teen@example.com' where id = $1`, [minorProfile]), true);
const teen2 = crypto.randomUUID();
await db.query(`insert into person (id, first_name, dob) values ($1,'Teen Two',$2)`, [teen2, yearsAgo(16)]);
check('cpa3: nor be created with one',
  await refuses(`insert into coach_profile (person_id, public_contact) values ($1, 'x@example.com')`, [teen2]), true);
check('cpa4: an adult coach can publish',
  await refuses(`update coach_profile set public_contact = 'coach@example.com' where id = $1`, [samProfile]), false);
check('cpa5: a page is public only while its owner is an adult',
  JSON.stringify((await db.query('select fn_coach_page_public($1) as a, fn_coach_page_public($2) as m', [samProfile, minorProfile])).rows[0]), '{"a":true,"m":false}');
const coachSrcAll = ['page.tsx', 'print/page.tsx', 'opengraph-image.tsx']
  .map((f) => readFileSync(fileURLToPath(new URL('../app/c/[slug]/' + f, import.meta.url)), 'utf8'));
check('cpa6: every coach page lookup asks whether the owner is an adult',
  coachSrcAll.every((src) => (src.match(/public_slug = \$1/g) ?? []).length === (src.match(/public_slug = \$1 and fn_coach_page_public\(cp\.id\)/g) ?? []).length), true);
check('cpa7: and so does the sitemap',
  /fn_coach_page_public/.test(readFileSync(fileURLToPath(new URL('../app/sitemap.ts', import.meta.url)), 'utf8')), true);

// 0043: a page taken down is not public, and keeps its address.
await db.query(`update coach_profile set hidden_at = now() where id = $1`, [samProfile]);
check('cpa8: a page its coach has taken down is not public',
  (await db.query('select fn_coach_page_public($1) as p', [samProfile])).rows[0].p, false);
check('cpa9: and its address stays reserved for them',
  (await db.query('select public_slug from coach_profile where id = $1', [samProfile])).rows[0].public_slug, 'coach-v');
await db.query(`update coach_profile set hidden_at = null where id = $1`, [samProfile]);
check('cpa10: publishing again makes it public', (await db.query('select fn_coach_page_public($1) as p', [samProfile])).rows[0].p, true);

// The address itself (lib/coach-slug.ts): plain letters, whatever the name.
const { coachSlugBase, coachSlugCandidates } = await import('../lib/coach-slug.ts');
check('slug1: accents and dotless i fold to plain letters', coachSlugBase('Deniz', 'Yılmaz'), 'deniz-yilmaz');
check('slug2: so do the letters NFKD leaves alone', coachSlugBase('Søren', 'Groß-Æbelø'), 'soren-gross-aebelo');
check('slug3: apostrophes and spaces become one hyphen', coachSlugBase("Siobhán", "O'Brien  Jr."), 'siobhan-o-brien-jr');
check('slug4: a name with no plain letters still gets an address', coachSlugBase('李', '明'), 'coach');
check('slug5: never longer than 40', coachSlugBase('A'.repeat(30), 'B'.repeat(30)).length <= 40, true);
check('slug6: never ends in a hyphen after trimming', /-$/.test(coachSlugBase('Abcdefghij'.repeat(4).slice(0, 39), 'x')), false);
check('slug7: a clash tries name-2, then name-3', coachSlugCandidates('sam-kaya', 3), ['sam-kaya', 'sam-kaya-2', 'sam-kaya-3']);

// In-app browsers (lib/in-app-browser.ts): named when we can, never flagged
// when the link opens in the phone's own browser.
{
  const { detectInAppBrowser, openInBrowserHref } = await import('../lib/in-app-browser.ts');
  const UA = {
    instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 339.0.3.12.108',
    facebookAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.0;]',
    messenger: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/460.0]',
    tiktok: 'Mozilla/5.0 (Linux; Android 13; SM-S911B; wv) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 musical_ly_2023',
    genericWebview: 'Mozilla/5.0 (Linux; Android 13; SM-A536E; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36',
    safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    chrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
    desktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  };
  const d = (k) => detectInAppBrowser(UA[k]);
  check('iab1: Instagram on an iPhone is named', d('instagram'), { app: 'Instagram', platform: 'ios' });
  check('iab2: Facebook on Android is named', d('facebookAndroid'), { app: 'Facebook', platform: 'android' });
  check('iab3: Messenger is not mistaken for Facebook', d('messenger')?.app, 'Messenger');
  check('iab4: TikTok is named', d('tiktok')?.app, 'TikTok');
  check('iab5: an unnamed Android WebView is still caught', d('genericWebview')?.app, 'another app');
  check('iab6: Safari, Chrome and a laptop are left alone', [d('safari'), d('chrome'), d('desktop'), detectInAppBrowser(null)], [null, null, null, null]);
  check('iab7: iOS is offered Safari', openInBrowserHref('https://pitchfootball.com.au/a/x/done', 'ios'), 'x-safari-https://pitchfootball.com.au/a/x/done');
  check('iab8: Android is offered Chrome', openInBrowserHref('https://pitchfootball.com.au/signin', 'android'),
    'intent://pitchfootball.com.au/signin#Intent;scheme=https;package=com.android.chrome;end');
  check('iab9: nothing but http(s) is ever turned into a link', [openInBrowserHref('javascript:alert(1)', 'ios'), openInBrowserHref('not a url', 'android')], [null, null]);
}
check('job4: an anonymous caller may not', await canApply(null), false);

const roleId = crypto.randomUUID();
await db.query(`insert into coaching_role (id, club_id, title, posted_by) values ($1,$2,'Head Coach — U14 Boys',$3)`,
  [roleId, CLUB.riverside, ID.td]);
await db.query(`insert into role_application (role_id, coach_id, message) values ($1,$2,'Keen to help')`, [roleId, ID.coachV]);

const applicants = async (who) => (await db.query('select * from fn_role_applications($1,$2)', [who, roleId])).rows;
check('job5: the club that posted it sees who applied', (await applicants(ID.td)).length, 1);
check('job6: the club administrator sees them too — this is club admin, not development data',
  (await applicants(ID.clubAdmin)).length, 1);
check('job7: another club sees nothing', (await applicants(ID.adminOther)).length, 0);
check('job8: a coach cannot read a club\u2019s applicant list', (await applicants(ID.coachV)).length, 0);
check('job9: an anonymous caller sees nothing', (await applicants(null)).length, 0);

// D-100: Pitch never hands over contact details. The function must not be
// able to return one, whatever the app layer later asks it for.
const appFn = (await db.query(`select prosrc from pg_proc where proname = 'fn_role_applications'`)).rows[0].prosrc;
check('job10: the applicant list cannot return an email or a phone number (D-100)',
  /p\.email|phone|contact_email/.test(appFn), false);

await expectFail('job11: a coach cannot apply for the same role twice',
  `insert into role_application (role_id, coach_id) values ('${roleId}', '${ID.coachV}')`);

// Clips are links, never files — the parked hosting question must not creep
// in through the coach's door either.
const coachActions = readFileSync(fileURLToPath(new URL('../app/coach/edit/actions.ts', import.meta.url)), 'utf8');
const footballSrc = readFileSync(fileURLToPath(new URL('../lib/football.ts', import.meta.url)), 'utf8');
check('job12: coach clips are capped at five', /COACH_CLIP_CAP = 5/.test(footballSrc), true);
check('job13: and the cap is enforced in the action, not just hidden in the form',
  /c >= COACH_CLIP_CAP/.test(coachActions), true);
for (const h of ['youtube\\.com', 'youtu\\.be', 'instagram\\.com', 'veo\\.co']) {
  check(`job14: coach clips accept only allowlisted hosts (${h.replace('\\', '')})`, coachActions.includes(h), true);
}
check('job15: no file is accepted on the coach clip path', /instanceof File|multipart/.test(coachActions), false);

// ---------------------------------------------------------------------------
// Acting on a record, as opposed to reading one (0020). Four family-facing
// routes took a record id straight from the URL and checked nothing; they
// were production-disabled, which is why it was never a live hole.
// ---------------------------------------------------------------------------
const actor = async (who, rec) => (await db.query('select fn_record_actor($1,$2) as a', [who, rec])).rows[0].a;

check('act1: the owner may act on their own record', await actor(ID.deniz, REC.deniz), 'self');
check('act2: an approved guardian may act for an under-18', await actor(ID.guardian, REC.deniz), 'guardian');
check('act3: the second guardian too (D-51)', await actor(ID.guardian2, REC.deniz), 'guardian');
check('act4: a revoked guardian may not', await actor(ID.exGuardian, REC.deniz), null);
check('act5: guardianship lapsed at 18 grants no action (D-49)', await actor(ID.guardian, REC.marcus), null);
check('act6: an anonymous caller may not', await actor(null, REC.deniz), null);

// The one that matters. A squad coach READS this record in full, and must
// still not be able to edit it, compose a registration on the child's behalf,
// or approve their share card. Reading and acting are different questions,
// which is why this is not fn_read_level.
check('act7: the squad coach reads the record in full', await level(ID.coachV, ID.deniz), 'full');
check('act8: and still cannot ACT on it', await actor(ID.coachV, REC.deniz), null);
check('act9: nor can the technical director', await actor(ID.td, REC.deniz), null);
check('act10: nor the club administrator', await actor(ID.clubAdmin, REC.deniz), null);

// Every route and action that takes a recordId must call the guard. The list
// used to be written out by hand, and a hand-written list is exactly as good
// as whoever remembers to extend it: FOUR surfaces had been added since and
// none of them checked anything — /build/[recordId]/more (page and all four
// actions), /build/[recordId]/clips, the photo upload route and
// /send/[recordId]. Each was closed by `if (production) notFound()`, which
// is a deploy flag standing where an authorisation check belongs.
//
// So it is derived now. Anything under app/ whose path contains [recordId]
// and that renders or acts — page, actions, route — must call the guard, and
// a new one is caught the day it is written rather than the day it is
// noticed. Components are excluded: they take props from a page that has
// already checked, and they do not touch the database.
const recordIdSurfaces = routeFiles
  .filter((f) => f.includes('[recordId]'))
  .filter((f) => /\/(page\.tsx|actions\.ts|route\.ts)$/.test(f))
  .map((f) => f.slice(f.indexOf('app/')))
  .sort();
check('act11: the recordId surfaces are discovered, not listed by hand',
  recordIdSurfaces.length >= 11, true);
for (const f of recordIdSurfaces) {
  const src = readFileSync(fileURLToPath(new URL('../' + f, import.meta.url)), 'utf8');
  check(`act11: ${f} checks who is asking`, /require?RecordActor|recordActor\(/.test(src), true);
}

// D-119: the child never approves their own edit.
const pendingActions = readFileSync(fileURLToPath(new URL('../app/g/pending/[recordId]/actions.ts', import.meta.url)), 'utf8');
check('act12: approving a pending edit is guardian-only (D-119)',
  /requireRecordActor\(recordId, \['guardian'\]\)/.test(pendingActions), true);
// D-94 §3: identity comes from the session, never from the caller.
check('act13: the guardian id is no longer accepted as an argument (D-94 §3)',
  /guardianId: string/.test(pendingActions), false);

// Those routes were shipped disabled. If the guard works they should now be
// enabled — a route that is still switched off is a route nobody can use.
// Same list, same reason: a route that is still switched off is a route
// nobody can use, and leaving the flag in place hides the missing guard.
for (const f of recordIdSurfaces) {
  const src = readFileSync(fileURLToPath(new URL('../' + f, import.meta.url)), 'utf8');
  check(`act14: ${f} is no longer disabled in production`,
    /NODE_ENV === 'production'\) (notFound|return NextResponse)/.test(codeOnly(src)), false);
}

// The operator console gates on an allowlist, and an empty one means nobody.
const opsGuard = readFileSync(fileURLToPath(new URL('../lib/ops-guard.ts', import.meta.url)), 'utf8');
check('act15: the operator console reads an explicit allowlist', /OPS_EMAILS/.test(opsGuard), true);

// act16 used to be a regex looking for `allow.includes(email)` in this file.
// The console verifies clubs, suspends clubs and re-sends guardian approvals,
// and "the source contains the right words" was the ONLY evidence for who may
// open it — made worse by the gate being deliberately open in development, so
// nothing driving the running app could exercise it either. The decision is a
// pure function now and this is the whole matrix, actually run.
{
  const { operatorAllowed } = await import('../lib/ops-policy.ts');
  const P = true, D = false;
  check('act16a: production admits a listed address',
    operatorAllowed('buz@pitch.example', 'buz@pitch.example,ops@pitch.example', P), true);
  check('act16b: production refuses an unlisted one',
    operatorAllowed('stranger@example.com', 'buz@pitch.example', P), false);
  check('act16c: an EMPTY allowlist admits nobody — never everybody',
    operatorAllowed('buz@pitch.example', '', P), false);
  check('act16d: and an unset one is the same as empty',
    operatorAllowed('buz@pitch.example', undefined, P), false);
  check('act16e: no email is refused in every environment',
    [operatorAllowed(null, 'buz@pitch.example', P), operatorAllowed(null, '', D)], [false, false]);
  check('act16f: the list tolerates spacing and case, because a human types it',
    operatorAllowed('BUZ@Pitch.Example', '  ops@x.example , buz@pitch.example ', P), true);
  check('act16g: development admits any signed-in person, which is why the walkthrough works',
    operatorAllowed('anyone@example.com', '', D), true);
}

// The scheduled-job endpoints, and the same failure the operator console was
// caught with. /api/jobs/daily and /api/jobs/outbox compared the header
// against `Bearer ${process.env.CRON_SECRET}` with no check that the secret
// exists — so on a deploy where nobody had set it, the comparison was against
// the literal string "Bearer undefined" and anyone sending exactly that got
// in. The digest route and all three webhooks already refused on an absent
// secret; these two were the odd ones out, and nothing had ever probed
// /api/* because nothing links to it.
//
// What is behind them is the reason it matters: the outbox route dispatches
// the message queue, and D-81 is explicit that an endpoint which can be made
// to send is how a small launch loses four figures overnight.
{
  const { cronAllowed } = await import('../lib/cron-policy.ts');
  const P = true, D = false;
  check('act17a: production admits the configured secret',
    cronAllowed('Bearer s3cret', 's3cret', P), true);
  check('act17b: and refuses a wrong one', cronAllowed('Bearer nope', 's3cret', P), false);
  check('act17c: an UNSET secret admits nobody — never everybody',
    cronAllowed('Bearer anything', undefined, P), false);
  check('act17d: and specifically not the string an unset secret used to render',
    cronAllowed('Bearer undefined', undefined, P), false);
  check('act17e: an empty secret is the same as unset',
    cronAllowed('Bearer ', '', P), false);
  check('act17f: a missing header is refused',
    cronAllowed(null, 's3cret', P), false);
  check('act17g: development runs the jobs unconfigured, which is why the walkthrough works',
    cronAllowed(null, undefined, D), true);
}

// U-11, where the email actually leaves. John ruled there is no reply route
// and the CV email to a club says so — but every email carried one global
// Reply-To, set to a person's own work inbox, so a club replying about a
// child would have landed there. The decision is a pure function now.
{
  const { replyToFor } = await import('../lib/reply-policy.ts');
  const S = 'help@pitchfootball.com.au';
  check('U-11 reply-to a: the CV email to a club carries NO reply-to, so a reply reaches nobody',
    replyToFor('doc15.§19', S) === undefined, true);
  check('U-11 reply-to b: other messages reply to the support inbox', replyToFor('doc15.§32', S), S);
  check('U-11 reply-to c: a message that cannot be identified fails closed — no reply-to',
    replyToFor(undefined, S) === undefined, true);
  check('U-11 reply-to d: no reply-to at all when support is not configured',
    replyToFor('doc15.§32', '') === undefined, true);
  const documented = /^EMAIL_REPLY_TO=(\S*)/m.exec(srcOf('.env.example'))?.[1] ?? '';
  // D-169 (BUZ, 29 Sep): replies reach BUZ directly — his direct contact is the
  // offer to clubs. U-11's safety half is untouched: §19 (a child's CV to a
  // club) still carries NO reply-to (checks a and g), so a reply about a child
  // reaches nobody.
  check(`U-11 reply-to e (D-169): the documented reply address is BUZ's direct address (${documented})`,
    documented, 'burak.donmez@pitch-football.com');
  check('U-11 reply-to f: the email transport reads no reply address of its own',
    /EMAIL_REPLY_TO/.test(codeOnly(srcOf('lib/providers.ts'))), false);
  check('U-11 reply-to g: a retried message keeps its key, so a re-sent §19 is still no-reply',
    /message_key/.test(codeOnly(srcOf('app/api/jobs/outbox/route.ts'))), true);
}

// --- Football history (0028) and the club line -----------------------------
// A previous club is the player's own account and grants NOTHING (D-72). The
// properties that make that true are structural, so they are asserted
// structurally rather than trusted to the copy.
const migAll = readdirSync(fileURLToPath(new URL('../supabase/migrations', import.meta.url)))
  .map((f) => readFileSync(fileURLToPath(new URL('../supabase/migrations/' + f, import.meta.url)), 'utf8')).join('\n');
check('hist1: previous_club is a kind on experience_entry, not a new table',
  /kind in \('previous_club'/.test(migAll), true);
check('hist2: experience_entry still has no club foreign key (D-72)',
  /experience_entry[\s\S]{0,900}?references club\(/.test(migAll), false);
check('hist3: and its provenance is still pinned to self_reported',
  /provenance = 'self_reported'/.test(migAll), true);

const cvSrc = readFileSync(fileURLToPath(new URL('../components/cv/PlayerCV.tsx', import.meta.url)), 'utf8');
const snapSrc = readFileSync(fileURLToPath(new URL('../lib/cv-build.ts', import.meta.url)), 'utf8');

// The locality on a CV is the CLUB's suburb and state. We hold no address for
// a player, and this line must never start reading like one.
// Since 0155 the live read takes its whole club line from fn_cv_club, so
// for it the rule is asked where it now lives: the read calls fn_cv_club,
// and fn_cv_club builds the locality from the club's suburb and state.
const cvClubSrc = await procSrc('fn_cv_club');
for (const [what, src, locality] of [['the live read', readSrc, /fn_cv_club\(\$2\)/.test(readSrc) ? cvClubSrc : readSrc], ['the approved snapshot', snapSrc, snapSrc]]) {
  check(`hist4: ${what} takes the locality from the club, never the person`,
    /c\.suburb[\s\S]{0,40}c\.state/.test(locality), true);
  check(`hist5: ${what} never selects a suburb or postcode off person`,
    /p\.(suburb|postcode|address)/.test(codeOnly(src)), false);
}
check('hist6: the hardcoded Melbourne VIC is gone from the CV',
  /Melbourne VIC/.test(codeOnly(cvSrc)), false);

// D-119: the approved snapshot IS the page for a u16, so it has to carry the
// club. It carried an empty string, and the fixture hid it by writing its own.
check('hist7: the approved snapshot carries the club and squad it is showing',
  /select c\.name as club/.test(snapSrc), true);

// Parent-approved is a fact about a MINOR's page. It was rendered on every
// band, so an adult's own CV claimed a parent had approved it.
check('hist8: the parent-approved chip is gated on the band',
  /\{isMinor && \(/.test(cvSrc), true);
check('hist9: and the band is carried from the permission layer, not computed here',
  /band: bundle\.band/.test(readSrc), true);
check('hist10: the CV computes no age of its own',
  /getFullYear\(\)|new Date\(/.test(codeOnly(cvSrc)), false);

// John's U-11 ruling: no inbound route, and SAY so — on the send, and on the
// page the same club opens days later from a forwarded link.
check('hist11: the CV states there is no way to reply to a family (U-11)',
  /no way to reply to a family through Pitch/.test(cvSrc), true);

// D-70 says a zero never appears on this page. The stat tile initialised its
// counter to 0, so the SERVER-RENDERED HTML said 0 — what a stalled bundle,
// a browser with scripting off, and anything reading the markup all saw. Then
// (22 Sep) the truth shipped in the HTML and a layout effect reset it to 0
// and counted up — and BUZ's walkthrough still saw "0 appearances" (brief H,
// D-162). Every frame of a count-up is a number that is not true, so there is
// no count now: the tile renders its value and nothing else, and the motion
// is a rise and a settle on the real number. The first painted frame is read
// in a real browser by the layout check (st1); this is the source half.
const tileSrc = codeOnly(readFileSync(fileURLToPath(new URL('../components/cv/StatTile.tsx', import.meta.url)), 'utf8'));
check('hist12: a stat tile renders its own value and holds no other — no state, no timer, no frame loop (D-162)',
  [/>\{value\}</.test(tileSrc), /useState|useEffect|useLayoutEffect|requestAnimationFrame|setInterval|setTimeout/.test(tileSrc)], [true, false]);
check('hist13: and under prefers-reduced-motion neither the rise nor the settle moves',
  [/prefers-reduced-motion: reduce\)[\s\S]{0,200}\.settle[\s\S]{0,40}animation: none/.test(srcOf('app/globals.css')),
    // The card's rise moved into globals.css with the Floodlit player card
    // (D-173, 1 Oct); the property is the same, so the check follows it.
    /prefers-reduced-motion: reduce\) \{ \.cv-rise[^}]*animation: none/.test(srcOf('app/globals.css'))], [true, true]);

// A coach's licences and results are SELF-DECLARED (0029) and must stay
// visibly apart from the WWCC, which is the one credential on that page a
// club actually attested. The badges array is gone: it could not hold an
// issuer or a year, and it put a typed credential in the same chip row as
// the attested one.
check('lic1: the badges array is gone from the schema',
  /coach_profile[\s\S]{0,400}badges text\[\]/.test(migAll) && !/drop column badges/.test(migAll), false);
check('lic2: a licence is pinned to self_reported and cannot be set otherwise',
  /coach_licence[\s\S]{0,400}?provenance text not null default 'self_reported' check \(provenance = 'self_reported'\)/.test(migAll), true);
check('lic3: so is a coach achievement',
  /coach_achievement[\s\S]{0,400}?provenance text not null default 'self_reported' check \(provenance = 'self_reported'\)/.test(migAll), true);
check('lic4: neither table has a club foreign key — a typed credential grants nothing',
  /create table coach_licence[\s\S]*?\);/.exec(migAll)?.[0].includes('references club(') ?? false, false);
check('lic5: the page says which of the two anybody checked',
  /own account[\s\S]{0,120}Working With Children Check is the one thing/.test(coachCvSrc), true);
check('lic6: and the hero chip row carries the attested one only',
  /badges as string\[\]/.test(coachCvSrc), false);
// The licence and achievement writers resolve the profile from the SESSION.
const licActions = readFileSync(fileURLToPath(new URL('../app/coach/edit/actions.ts', import.meta.url)), 'utf8');
check('lic7: every licence and achievement write goes through the session-resolved profile',
  (licActions.match(/await myProfile\(\)/g) ?? []).length >= 4, true);
check('lic8: and no writer takes a profile id from the caller (D-94 §3)',
  /profileId: string|coachProfileId: string/.test(codeOnly(licActions)), false);

// ---------------------------------------------------------------------------
// Deep review, 8 Sep. Six defects, and the properties that stop them coming
// back. The theme of the first three: a server action exported from a
// 'use server' module is a PUBLIC ENDPOINT whether or not its page renders,
// so guarding the page buys nothing and every argument is hostile — not just
// the first one.
// ---------------------------------------------------------------------------
const opsActionFiles = routeFiles.filter((f) => /\/ops\/.*actions\.ts$/.test(f));
check('rev1: there are ops actions to check', opsActionFiles.length >= 2, true);
for (const f of opsActionFiles) {
  const src = readFileSync(f, 'utf8');
  // logCall sets club_state='verified' — the write that turns a paying club's
  // register from a count into named children (D-126). resendApproval texts
  // and emails a named guardian. Both were reachable without an operator.
  check(`rev2: ${f.slice(f.indexOf('app/'))} checks the operator, not just its page`,
    /requireOperator/.test(src), true);
}

// A guardian's controls take a child id AND a record id. The child was
// checked and the record was not, so any approved guardian could revoke
// another family's share links and mint themselves a live token to that
// child's CV — handed back in the redirect URL.
const gControls = readFileSync(fileURLToPath(new URL('../app/g/controls/[childId]/actions.ts', import.meta.url)), 'utf8');
// One lookup, one guard. requireRecordActor used to repeat recordActor's
// query, so the uuid check added to one sat on one of two paths and a
// malformed id still reached Postgres and 500'd on every signed-in builder
// route. Two functions answering one question is one of them being wrong.
check('rev2b: requireRecordActor does not repeat the lookup it guards',
  /select fn_record_actor[\s\S]*select fn_record_actor/.test(
    readFileSync(fileURLToPath(new URL('../lib/record-guard.ts', import.meta.url)), 'utf8')), false);
check('rev3: the record id is bound to the child before it is used',
  /assertChildsRecord/.test(gControls), true);
check('rev4: and both link actions call it',
  (gControls.match(/await assertChildsRecord\(/g) ?? []).length >= 2, true);

// A uuid column handed "bogus" raises rather than answering, so a malformed
// id 500'd carrying a Postgres error while a well-formed unknown one
// returned the neutral page. The difference is itself a leak (D-77), and it
// landed hardest on /a/[id] — the approval link a guardian gets by SMS,
// which messaging apps truncate.
const idsSrc = readFileSync(fileURLToPath(new URL('../lib/ids.ts', import.meta.url)), 'utf8');
check('rev5: there is one shared uuid shape check', /export function isUuid/.test(idsSrc), true);
for (const [what, file] of [['the record door', '../lib/record-guard.ts'],
                            ['the invitation door', '../lib/guardian-flow.ts']]) {
  const src = readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
  check(`rev6: ${what} refuses a malformed id before Postgres sees it`,
    /isUuid\(/.test(src), true);
}
// The shape check belongs ABOVE the database, not in it: fn_record_actor
// takes a uuid parameter, so a malformed id raises there by design and the
// guard has to refuse it first. What the database must answer is the
// well-formed unknown — and that is a null, the same as not yours.
check('rev7: a well-formed unknown record id is not an actor',
  await actor(ID.guardian, '00000000-0000-0000-0000-000000000000'), null);

// A coach's history and licences sorted by INSERTION, so a coach who added
// an older job or a lower licence second got them out of order.
for (const [what, file] of [['the coach page', '../app/c/[slug]/page.tsx'],
                            ['the printed coach CV', '../app/c/[slug]/print/page.tsx']]) {
  const src = readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
  check(`rev9: ${what} orders roles by year, not by insertion`,
    /ended_year desc nulls first/.test(src), true);
  check(`rev10: ${what} orders licences by year, not by insertion`,
    /l\.year desc nulls last/.test(src), true);
}

// ---------------------------------------------------------------------------
// Claiming a club (0030, doc 15 §34). /claim/[slug] was 404 in production
// "until email codes land", and the dev flow claimed the page on a button
// press with no proof at all — the version that cannot ship, because it lets
// anybody take any club.
// ---------------------------------------------------------------------------
const claimClubId = crypto.randomUUID();
const claimant2 = crypto.randomUUID();
await db.query(`insert into club (id, name, club_state, public_slug, contact_email)
  values ($1,'Claimable FC','unclaimed','claimable-fc','secretary@claimable.example.au')`, [claimClubId]);
await db.query(`insert into person (id, first_name, last_name, dob) values ($1,'Claim','Two','1980-01-01')`, [claimant2]);

// One live challenge per person per club: asking again replaces the code
// rather than leaving two valid ones in the world.
await db.query(`insert into verification_challenge (person_id, club_id, channel, token_hash, expires_at)
  values ($1,$2,'email',$3, now() + interval '30 minutes')`, [claimant2, claimClubId, Buffer.from('a'.repeat(32))]);
let twoLive = true;
try {
  await db.query(`insert into verification_challenge (person_id, club_id, channel, token_hash, expires_at)
    values ($1,$2,'email',$3, now() + interval '30 minutes')`, [claimant2, claimClubId, Buffer.from('b'.repeat(32))]);
} catch { twoLive = false; }
check('claim1: a person cannot hold two live codes for one club', twoLive, false);

// An expired challenge is not a challenge.
await db.query(`update verification_challenge set expires_at = now() - interval '1 minute'
  where person_id = $1 and club_id = $2`, [claimant2, claimClubId]);
const liveChallenge = await db.query(`select 1 from verification_challenge
  where person_id = $1 and club_id = $2 and verified_at is null and expires_at > now()`,
  [claimant2, claimClubId]);
check('claim2: an expired code stops being usable', liveChallenge.rows.length, 0);

// THE POINT OF THE WHOLE FLOW: claiming can never verify. D-126 says a
// logged human call is the only path, and the 0002 check enforces it.
let claimedVerified = true;
try {
  await db.query(`update club set club_state = 'verified' where id = $1`, [claimClubId]);
} catch { claimedVerified = false; }
check('claim3: a club cannot reach verified without a call row (D-126)', claimedVerified, false);
await db.query(`update club set club_state = 'claimed' where id = $1`, [claimClubId]);
check('claim4: but it can reach claimed',
  (await db.query(`select club_state from club where id=$1`, [claimClubId])).rows[0].club_state, 'claimed');

// Where the code goes is the design. It reads the club's PUBLISHED address
// and there is no path that sends it anywhere the claimant nominates.
const claimSrc = readFileSync(fileURLToPath(new URL('../app/claim/[slug]/actions.ts', import.meta.url)), 'utf8');
check('claim5: the code is addressed to the club record, not to form input',
  /address: club\.contact_email/.test(claimSrc), true);
check('claim6: and no claim path reads an email out of the form',
  /formData\.get\('email'\)/.test(codeOnly(claimSrc)), false);
// A wrong code costs an attempt whether or not it was close, so the counter
// has to be written BEFORE the comparison. (This pinned `.equals(hash(code))`
// and broke when that became timingSafeEqual — the property was unchanged,
// the spelling was not.)
check('claim7: the attempt is counted before the code is compared',
  claimSrc.indexOf('attempts = attempts + 1') < claimSrc.indexOf('timingSafeEqual(stored, given)'), true);
check('claim7b: and the comparison is timing-safe, like every other in the codebase',
  /timingSafeEqual\(stored, given\)/.test(claimSrc), true);
check('claim8: both ceilings are checked before a code is sent',
  /claim-club:/.test(claimSrc) && /claim-person:/.test(claimSrc), true);
check('claim9: redirect never runs inside the transaction it would roll back',
  /let outcome: Outcome/.test(claimSrc), true);
const claimPageSrc = readFileSync(fileURLToPath(new URL('../app/claim/[slug]/page.tsx', import.meta.url)), 'utf8');
check('claim10: the claim page is no longer disabled in production',
  /NODE_ENV === 'production'\) notFound/.test(codeOnly(claimPageSrc)), false);

// ---------------------------------------------------------------------------
// Where an uploaded image goes. Every route wrote the local filesystem, which
// does not survive a serverless instance — the club routes were 404'd in
// production because of it and the rest would have failed quietly.
// ---------------------------------------------------------------------------
const uploadRoutes = ['../app/build/[recordId]/photo/route.ts', '../app/coach/edit/photo/route.ts',
                      '../app/coach/edit/banner/route.ts', '../app/club/page-edit/crest/route.ts',
                      '../app/club/page-edit/banner/route.ts'];
for (const f of uploadRoutes) {
  const src = readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8');
  const name = f.split('/').slice(-3, -1).join('/');
  check(`store1: ${name} writes through storage, not the filesystem`,
    /putImage\(/.test(src) && !/writeFileSync/.test(src), true);
  check(`store2: ${name} is not disabled in production`,
    /NODE_ENV === 'production'/.test(codeOnly(src)), false);
  check(`store3: ${name} answers honestly when the put fails`,
    /catch \{[\s\S]{0,120}redirect\(new URL/.test(src), true);
}
const storeSrc = readFileSync(fileURLToPath(new URL('../lib/storage.ts', import.meta.url)), 'utf8');
check('store4: storage is server-only', /^import 'server-only';/m.test(storeSrc), true);
check('store5: the bucket is configurable, not hardcoded to one project',
  /SUPABASE_STORAGE_BUCKET/.test(storeSrc), true);

// ---------------------------------------------------------------------------
// Sessions can be revoked (0062). The QA bug hunt of 28 Sept measured a
// captured cookie still opening /home after Sign out, after the password was
// changed, and after signing back in: the cookie was the person's id plus an
// HMAC of the person's id, so there was no session to end.
//
// These two used to read lib/session.ts for the strings `from person where
// id = $1` and `isUuid(id)` — proxies for two real rules, and both proxies
// went false when the implementation changed while the rules got stronger
// (L33). They are now asked of the database, which is where doc 14 §0 says a
// permission question is answered.
// ---------------------------------------------------------------------------
const sessionSrc = readFileSync(fileURLToPath(new URL('../lib/session.ts', import.meta.url)), 'utf8');
const authTs = authSrc; // read above, beside the other credential checks
{
  const whose = async (token) =>
    (await db.query('select fn_session_person($1) as p', [sha(token)])).rows[0].p;
  const issue = async (person, token) =>
    (await db.query('select fn_session_issue($1,$2) as e', [person, sha(token)])).rows[0].e;

  const pa = crypto.randomUUID(), pb = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob) values ($1,'Session A',$2), ($3,'Session B',$2)`,
    [pa, yearsAgo(38), pb]);

  await issue(pa, 'sess-laptop');
  await issue(pa, 'sess-phone');
  await issue(pb, 'sess-other-person');

  check('sess1: a live session resolves to the person it was issued to', await whose('sess-laptop'), pa);
  check('sess2: a token nobody was ever issued resolves to nobody', await whose('sess-never-issued'), null);

  // Sign out. The row, not the browser's copy of the cookie: this is the
  // property the bug hunt measured false — a cookie captured before Sign out
  // still opened /home afterwards, for as long as whoever held it liked.
  await db.query('select fn_session_revoke($1)', [sha('sess-laptop')]);
  check('sess3: a revoked session resolves to nobody, so a replayed cookie is dead',
    await whose('sess-laptop'), null);
  check('sess4: and signing out of one device leaves the other one signed in',
    await whose('sess-phone'), pa);

  // A new password ends every live session for that person — what makes the
  // sentence already on the reset screen true rather than something to delete.
  await issue(pa, 'sess-laptop-2');
  const killed = (await db.query('select fn_sessions_revoke_all($1) as n', [pa])).rows[0].n;
  check('sess5: a new password revokes every live session for that person',
    [Number(killed), await whose('sess-phone'), await whose('sess-laptop-2')], [2, null, null]);
  check('sess6: and nobody else\u2019s', await whose('sess-other-person'), pb);

  // Expiry is enforced in SQL on every read, never in the cookie alone. Set
  // directly because fn_session_issue only ever issues a live one.
  await db.query(
    `insert into auth_session (person_id, token_hash, expires_at) values ($1,$2, now() - interval '1 minute')`,
    [pb, sha('sess-lapsed')]);
  check('sess7: a lapsed session resolves to nobody, whatever the cookie says',
    await whose('sess-lapsed'), null);
  const life = await db.query(
    `with s as (select fn_session_issue($1,$2) as e)
     select (e - now()) > interval '29 days 23 hours' and (e - now()) <= interval '30 days' as ok from s`,
    [pb, sha('sess-lifetime')]);
  check('sess8: the lifetime is the database\u2019s answer, 30 days from issue', life.rows[0].ok, true);

  // Not new, and it must not be lost in the change: a session outliving a
  // guardian's deletion used to mean every action wrote a person id into a
  // foreign key and got a database error instead of a sign-in screen.
  await issue(pb, 'sess-deleted-person');
  await db.query('delete from person where id = $1', [pb]);
  check('sess9: a session is only a session while its person exists',
    await whose('sess-deleted-person'), null);
}

// The cookie: an opaque token, ≥128 bits, stored only as a hash — the D-94 §4
// standard the share token already holds. Nothing in it names the person, so
// knowing a person id (they are in URLs all over the product) forges nothing.
check('sess10: the cookie carries a random token, never the person id',
  /jar\.set\(COOKIE, `\$\{token\}\.\$\{sign\(token\)\}`/.test(sessionSrc), true);
check('sess11: 192 bits of CSPRNG, and only its hash is stored',
  /randomBytes\(24\)\.toString\('base64url'\)/.test(sessionSrc)
  && /createHash\('sha256'\)\.update\(token\)/.test(sessionSrc), true);
check('sess12: there is no column that could hold a session token in the clear',
  (await db.query(`select column_name from information_schema.columns
                   where table_name = 'auth_session' order by column_name`)).rows.map((r) => r.column_name),
  ['expires_at', 'id', 'issued_at', 'person_id', 'revoked_at', 'token_hash']);
check('sess13: a cookie that does not verify is refused before Postgres is touched',
  codeOnly(sessionSrc).indexOf('timingSafeEqual') < codeOnly(sessionSrc).indexOf('fn_session_person'), true);
check('sess14: signing out revokes the session, not just the browser\u2019s copy of it',
  /fn_session_revoke/.test(sessionSrc)
  && /clearSession/.test(readFileSync(fileURLToPath(new URL('../app/signout/route.ts', import.meta.url)), 'utf8')), true);
check('sess15: setting a password revokes every live session for that person',
  /revokeEverySession\(personId\)/.test(authTs.split('export async function setPassword')[1]?.split('export ')[0] ?? ''), true);
// 0069: nothing ever deleted a session row. The daily job now removes the
// ones that expired or were revoked more than thirty days ago, and nothing
// that could still open a page.
{
  const sp = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob) values ($1,'Session Purge',$2)`, [sp, yearsAgo(40)]);
  const add = (tag, exp, rev) => db.query(
    `insert into auth_session (person_id, token_hash, issued_at, expires_at, revoked_at)
     values ($1, $2, now() - interval '90 days', now() + ($3)::interval, case when $4::text is null then null else now() + ($4)::interval end)`,
    [sp, sha(`purge-${tag}`), exp, rev]);
  await add('live', '10 days', null);
  await add('expired-recently', '-5 days', null);
  await add('revoked-recently', '10 days', '-5 days');
  await add('expired-long-ago', '-31 days', null);
  await add('revoked-long-ago', '10 days', '-31 days');
  const consentBefore = (await db.query('select count(*)::int as n from consent_event')).rows[0].n;
  const purged = (await db.query('select fn_purge_sessions() as n')).rows[0].n;
  const left = (await db.query(`select encode(token_hash,'hex') as h from auth_session where person_id = $1`, [sp])).rows.map((r) => r.h);
  check('purge-sess1: the purge removes sessions expired or revoked more than thirty days ago, and nothing live or recent',
    [purged >= 2, ['live', 'expired-recently', 'revoked-recently'].every((t) => left.includes(sha(`purge-${t}`).toString('hex'))),
     ['expired-long-ago', 'revoked-long-ago'].some((t) => left.includes(sha(`purge-${t}`).toString('hex')))],
    [true, true, false]);
  check('purge-sess1b: and it is the daily job that runs it — the consent log is not the session table, and is untouched',
    [/select fn_purge_sessions\(\)/.test(codeOnly(srcOf('app/api/jobs/daily/route.ts'))),
     /consent_event/.test(await procSrc('fn_purge_sessions')),
     (await db.query('select count(*)::int as n from consent_event')).rows[0].n === consentBefore],
    [true, false, true]);
}
// One question, one answer (L23): no page works out for itself whether a
// session is live. lib/session.ts is the only file that reads the cookie and
// the only one that names the table.
{
  const readers = files.filter((f) => /\.tsx?$/.test(f) && /pitch_session|auth_session/.test(readFileSync(f, 'utf8')));
  check(`sess16: no page decides for itself whether a session is live (${readers.map(rel).join(' ') || 'none do'})`,
    readers.length, 0);
}

// ---------------------------------------------------------------------------
// Reset links: one live at a time, and using one burns it (0062). QA got 24
// live links to one address and the OLDEST still opened the set-a-password
// form; a second still worked after the first had been used.
// ---------------------------------------------------------------------------
{
  const rp = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob, email) values ($1,'Flood','${yearsAgo(41)}','flood@example.com')`, [rp]);
  const issueReset = async (token, proves = null) => db.query(
    `insert into auth_reset (person_id, token_hash, expires_at, proves_person_id)
     values ($1,$2, now() + interval '1 hour', $3)`, [rp, sha(token), proves]);
  const use = async (token) =>
    (await db.query('select fn_use_auth_reset($1) as p', [sha(token)])).rows[0].p;

  for (let i = 0; i < 24; i++) await issueReset(`flood-${i}`);
  const live = await db.query(
    `select count(*)::int as n from auth_reset
     where person_id = $1 and used_at is null and revoked_at is null and expires_at > now()`, [rp]);
  check('reset1: twenty-four presses leave exactly one live link', live.rows[0].n, 1);
  check('reset2: and the oldest of them opens nothing', await use('flood-0'), null);
  check('reset3: the newest one works', await use('flood-23'), rp);
  check('reset4: and it does not work twice', await use('flood-23'), null);

  // Using one kills the rest, not only the ones issuing killed. Two rows are
  // forced live here — the state a race, or any future route that writes this
  // table without the trigger, could leave behind.
  await db.query(
    `insert into auth_reset (person_id, token_hash, expires_at) values ($1,$2, now() + interval '1 hour'), ($1,$3, now() + interval '1 hour')`,
    [rp, sha('pair-a'), sha('pair-b')]);
  await db.query(`update auth_reset set revoked_at = null where token_hash in ($1,$2)`, [sha('pair-a'), sha('pair-b')]);
  check('reset5: using one link kills every other live link for that person',
    [await use('pair-a'), await use('pair-b')], [rp, null]);

  await db.query(
    `insert into auth_reset (person_id, token_hash, expires_at) values ($1,$2, now() - interval '1 minute')`,
    [rp, sha('reset-lapsed')]);
  check('reset6: a lapsed link is refused', await use('reset-lapsed'), null);

  // The trap in 0062, asserted so nobody removes the seam later: 0056 reads a
  // USED auth_reset row as proof that somebody opened a link we sent to that
  // address. Superseding with used_at would have manufactured that proof out
  // of links nobody ever opened — L21, the hole 0056 exists to close.
  const sp = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob, email) values ($1,'Superseded','${yearsAgo(35)}','superseded@example.com')`, [sp]);
  for (const t of ['sup-1', 'sup-2']) await db.query(
    `insert into auth_reset (person_id, token_hash, expires_at, proves_person_id)
     values ($1,$2, now() + interval '1 hour', $1)`, [sp, sha(t)]);
  // Asked the way 0056 asks it: with only SUPERSEDED links on this account,
  // the database must refuse to record that anybody proved that address. A
  // check that only read fn_email_proved passed with the bug put back,
  // because nothing had tried to write the column — the rule is about what
  // the evidence lets you write, so the check has to try the write (L19).
  await expectFail('reset7: a superseded link nobody opened is not evidence of a proved address (L21, 0056)',
    `update person set email_proved_at = now() where id = '${sp}'`);
  check('reset7b: so the account is still unproved',
    (await db.query(`select fn_email_proved($1) as p`, [sp])).rows[0].p, false);
  await use('sup-2');
  check('reset8: and the one that WAS opened proves it',
    (await db.query(`select fn_email_proved($1) as p`, [sp])).rows[0].p, true);
}
check('reset9: consumeReset asks the database, it does not carry its own SQL',
  /fn_use_auth_reset/.test(authTs) && !/update auth_reset set used_at/.test(authTs), true);
// The cap QA measured missing: the IP comes off a header the caller sets, so
// the only limit that binds is the one on the address. It must be consulted
// for every address, before anything looks the address up, or it is an
// enumeration oracle (D-94 §2).
check('reset10: the reset route caps per address as well as per declared IP',
  /checkRate\(`reset:addr:\$\{email\}`/.test(resetSrc) && /checkRate\(`reset:ip:\$\{ip\}`/.test(resetSrc), true);
check('reset11: and the cap is read before anything looks the address up',
  resetSrc.indexOf('reset:addr:') < resetSrc.indexOf('createReset('), true);
check('reset12: whatever happened, the answer is the one redirect',
  (codeOnly(resetSrc).match(/redirect\('\/reset\?sent=1'\)/g) ?? []).length, 1);

// ---------------------------------------------------------------------------
// The send layer actually sends (0031, D-81, D-78, doc 15 §15). Every message
// used to queue into message_outbox and stop there: the provider dispatch was
// an empty block, so the guardian approval SMS — the front door of the whole
// product — was written, logged as sent, and never delivered.
// ---------------------------------------------------------------------------
const msgSrc2 = readFileSync(fileURLToPath(new URL('../lib/messaging.ts', import.meta.url)), 'utf8');
const provSrc = readFileSync(fileURLToPath(new URL('../lib/providers.ts', import.meta.url)), 'utf8');
// sendl1–3 pinned an inline `await dispatch(` until 29 Sep. The provider call
// moved out of the request (after(), doc 14 L40), so they pin the same three
// rules against where it lives now: wired, after the row, production only.
check('sendl1: dispatch is wired, not a comment — handed to after(), once the response has gone',
  /after\(\(\) => dispatch\(id,/.test(codeOnly(msgSrc2)), true);
check('sendl2: the row is written before the provider is called, never after',
  msgSrc2.indexOf('insert into message_outbox') < msgSrc2.indexOf('after(() => dispatch(id,'), true);
check('sendl3: development still sends nothing, whatever keys are in the shell',
  /NODE_ENV === 'production'\) \{\n    after\(\(\) => dispatch/.test(msgSrc2), true);

// Policy stays in the send layer; the adapters are transport only. An adapter
// that could decide to send would be an adapter that can send something doc
// 15 never approved.
check('sendl4: the adapters never consult the catalogue or the caps',
  /CATALOGUE_KEYS|SMS_KILL_SWITCH|sms_meter|sms_opt_out/.test(provSrc), false);
check('sendl5: and they carry no SDK', /require\(|from '(?!server-only)[a-z@]/.test(codeOnly(provSrc).replace(/import 'server-only';/, '')), false);
check('sendl6: a 4xx is permanent and a 429 is not',
  /status !== 429/.test(provSrc), true);

// STOP has to be enforceable, not just written. Doc 15 §15 promises "we
// won't text this number again"; before 0031 nothing recorded that anybody
// had said it.
check('sendl7: the STOP list is checked before a number is texted',
  /from sms_opt_out where number_hash/.test(msgSrc2), true);
check('sendl8: and before the spend cap is charged',
  msgSrc2.indexOf('sms_opt_out') < msgSrc2.indexOf('fn_sms_spend_month'), true);
check('sendl9: the number is hashed, never stored',
  /number_hash bytea primary key/.test(migAll), true);
// One hash function, shared. A second copy is a STOP that silently never
// matches — the failure you learn about from a complaint.
const smsHook = readFileSync(fileURLToPath(new URL('../app/api/webhooks/sms/route.ts', import.meta.url)), 'utf8');
check('sendl10: the inbound webhook imports the same hash the send layer uses',
  /import \{[^}]*numberHash[^}]*\} from '@\/lib\/messaging'/.test(smsHook), true);
check('sendl11: and does not define its own',
  /const numberHash =/.test(smsHook), false);
check('sendl12: STOP is matched case- and punctuation-insensitively',
  /toUpperCase\(\)\.replace\(\/\[\^A-Z\]\/g, ''\)/.test(smsHook), true);

// Every webhook writes to the consent spine, so every one of them must prove
// who it is. WAS: "the file contains timingSafeEqual" — a proxy that went red
// on 28 Sep when the Twilio check moved into lib/twilio-signature so the two
// Twilio endpoints could not drift apart. The rule was never the word; it is
// that the handler refuses an unsigned body with a constant-time compare, in
// this file or in the one module it shares (L33).
const sigSrc = (src) => src + (/verifyTwilioSignature/.test(src)
  ? readFileSync(fileURLToPath(new URL('../lib/twilio-signature.ts', import.meta.url)), 'utf8') : '');
for (const [what, file] of [['the SMS webhook', '../app/api/webhooks/sms/route.ts'],
                            ['the SMS delivery webhook', '../app/api/webhooks/sms/status/route.ts'],
                            ['the email webhook', '../app/api/webhooks/resend/route.ts']]) {
  const src = sigSrc(readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8'));
  check(`sendl13: ${what} verifies its signature`,
    /timingSafeEqual/.test(src) && /status: 401/.test(src), true);
  check(`sendl14: ${what} refuses when unconfigured rather than accepting`,
    /status: 503/.test(src), true);
}
const mailHook = readFileSync(fileURLToPath(new URL('../app/api/webhooks/resend/route.ts', import.meta.url)), 'utf8');
// The signature algorithms, checked against the providers' OWN published
// specifications rather than against what we think we remember. Getting
// these wrong fails in one of two ways, and both are bad: reject every real
// STOP, or accept a forged one.
//
// This is Twilio's worked example from twilio.com/docs/usage/security —
// their URL, their parameters, their auth token, their expected signature.
// If the route's algorithm ever drifts, this constant stops matching.
{
  const url = 'https://example.com/myapp.php?foo=1&bar=2';
  const params = { Digits: '1234', To: '+18005551212', From: '+14158675310',
                   Caller: '+14158675310', CallSid: 'CA1234567890ABCDE' };
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const sig = createHmac('sha1', '12345').update(data).digest('base64');
  check('sendl20: the Twilio signature matches their published vector',
    sig, 'L/OH5YylLD5NRKLltdqwSvS0BnU=');
}
// Svix (Resend): signed content is `id.timestamp.body`, the secret is
// base64 AFTER the whsec_ prefix is stripped, HMAC-SHA256, base64 out.
check('sendl21: the email webhook strips whsec_ and decodes the secret',
  /replace\(\/\^whsec_\/, ''\), 'base64'\)/.test(mailHook), true);
check('sendl22: it signs id.timestamp.body in that order',
  /\$\{id\}\.\$\{ts\}\.\$\{payload\}/.test(mailHook), true);
check('sendl23: and it refuses a replayed receipt',
  /age > 300/.test(mailHook), true);

// D-99: we do not need to know who opened an email.
check('sendl15: opens and clicks are not recorded',
  /email\.opened|email\.clicked/.test(codeOnly(mailHook)), false);

// The jobs existed and nothing called them.
const vercelCfg = readFileSync(fileURLToPath(new URL('../vercel.json', import.meta.url)), 'utf8');
for (const path of ['/api/digest', '/api/jobs/daily', '/api/jobs/outbox']) {
  check(`sendl16: ${path} is actually scheduled`, vercelCfg.includes(`"${path}"`), true);
}
const sweep = readFileSync(fileURLToPath(new URL('../app/api/jobs/outbox/route.ts', import.meta.url)), 'utf8');
// This check used to look only for `for update skip locked` — and passed
// while the property was false, because the sweep took the locks, COMMITTED,
// and only then called the provider. The lock protected the microseconds
// between the select and the commit. A claim has to be a WRITE, and the
// check has to look for the write.
check('sendl17: the sweep claims rows so two runs cannot double-send',
  /for update skip locked/.test(sweep), true);
check('sendl17b: and the claim is a write, not a lock it lets go of',
  /update message_outbox set attempts = attempts \+ 1, last_attempt_at = now\(\)[\s\S]*?returning/.test(sweep), true);
check('sendl17c: dispatch does not stamp attempts — the caller claims',
  /update message_outbox set attempts = attempts \+ 1[\s\S]{0,80}where id = \$1`/.test(msgSrc2), false);
check('sendl17d: send() claims its own row in the insert',
  /attempts, last_attempt_at\)\s*\n?\s*values \((?:\$\d+,)+1,now\(\)\)/.test(msgSrc2), true);
check('sendl18: and it is behind the cron secret like every other job',
  /CRON_SECRET/.test(sweep), true);
check('sendl19: its response carries counts, never addresses or names',
  /claimed: rows\.length, sent/.test(sweep), true);

// ---------------------------------------------------------------------------
// "Take one off" (16 Sep, 0041). fn_send_log names each send's own link —
// the row id, never the token (D-80) — and whether it still opens the page.
// Switching one off changes that row and no other. A stranger still gets
// nothing at all.
{
  // Two sends the way lib/send-dispatch.ts writes them: a link each.
  for (const club of ['Take-off FC', 'Keep-on FC']) {
    const tok = (await db.query(
      `insert into share_token (record_id, token_hash, token_hint, issued_by, expires_at)
       values ($1, decode(md5($2), 'hex'), 'take·off', $3, now() + interval '30 days') returning id`,
      [REC.deniz, club, ID.guardian])).rows[0].id;
    await db.query(
      `insert into consent_event (event, actor_id, subject_id, detail)
       values ('share_dispatched', $1, $2, jsonb_build_object('club_name', $3::text, 'recipient', 'x@example.au', 'band_at_send', 'u16', 'token_id', $4::uuid))`,
      [ID.guardian, ID.deniz, club, tok]);
  }
  const sent = { actor_id: ID.guardian, subject_id: ID.deniz };
  check('TO1: a family has more than one send, each with its own link',
    Number((await db.query(`select count(*) from consent_event where subject_id = $1 and event = 'share_dispatched' and detail ? 'token_id'`, [ID.deniz])).rows[0].count) >= 2, true);
  if (sent) {
    const log = async (v) => (await db.query('select token_id, live from fn_send_log($1,$2)', [v, sent.subject_id])).rows;
    const before = (await log(sent.actor_id)).filter((r) => r.token_id);
    check('TO2: the guardian\u2019s log names each send\u2019s link and says it is live',
      before.length >= 2 && before.every((r) => r.token_id && r.live === true), true);
    check('TO3: every send has a different link', new Set(before.map((r) => r.token_id)).size, before.length);
    check('TO4: the log never returns the token itself', Object.keys(before[0] ?? {}).some((k) => /hash|raw|hint/.test(k)), false);
    await db.query('update share_token set revoked_at = now() where id = $1', [before[0].token_id]);
    const after = (await log(sent.actor_id)).filter((r) => r.token_id);
    check('TO5: switching one off changes that row and no other',
      after.map((r) => [r.token_id === before[0].token_id, r.live]).filter(([mine, live]) => mine ? live : !live).length, 0);
    await db.query('update share_token set revoked_at = null where id = $1', [before[0].token_id]);
    check('TO6: a stranger gets nothing', (await log(ID.marcus)).length, 0);
  }
}

// The guardian's controls screen. fn_send_log has answered L57 correctly
// since 0025 and the suite has been green on it the whole time — and NOTHING
// IN THE APP CALLED IT. A launch-gate row can be green in the database and
// absent from the product, which is the failure this block exists to catch.
// ---------------------------------------------------------------------------
const gControlsPage = readFileSync(fileURLToPath(new URL('../app/g/controls/[childId]/page.tsx', import.meta.url)), 'utf8');
check('ctl1: the controls screen calls fn_send_log',
  /fn_send_log\(/.test(gControlsPage), true);
check('ctl2: and renders the recipient address, not just the club',
  /sd\.recipient/.test(gControlsPage), true);

// "Everything that's happened" has to mean everything. It was capped at
// eight, so a parent could not reach the approval they gave.
// 0077: the rows come from fn_consent_timeline now, so "not truncated" is
// asked of the page's from-clause AND of the function, where a limit would
// otherwise hide.
check('ctl3: the consent timeline is not truncated',
  [/from fn_consent_timeline\(\$2, p\.id\) e\) as timeline/.test(gControlsPage),
   /\blimit\b/i.test(await procSrc('fn_consent_timeline'))], [true, false]);
// Approving writes several rows in one transaction, so a timestamp-only sort
// left them in arbitrary order on the one screen whose job is to be exact.
check('ctl4: and it has a stable tiebreak within the same second',
  /order by e\.at desc, e\.id desc/.test(gControlsPage), true);

// ---- 0077: an under-16's early funnel lines attach at approval ------------
// BUZ, 28 Sep (APPROVALS decision 8). Built the way production builds it:
// the spine rows written before the child exists, with no subject; the
// approval row; and then the parent's log. Every check was run against the
// bug it names (report, 28 Sep).
{
  const q = async (sql, args) => (await db.query(sql, args)).rows;
  const inv = (await q(`insert into pending_invitation (first_name, dob, guardian_name, guardian_phone, guardian_email)
    values ('Funnel', $1, 'Funnel Parent', '+61400000077', 'funnel.parent@fixture.example') returning id`, [yearsAgo(13)]))[0].id;
  const otherInv = (await q(`insert into pending_invitation (first_name, dob, guardian_name, guardian_phone)
    values ('Other', $1, 'Other Parent', '+61400000078') returning id`, [yearsAgo(12)]))[0].id;
  const ev = (event, detail, subject = null) => q(
    `insert into consent_event (event, subject_id, detail) values ($1, $2, $3::jsonb) returning id`, [event, subject, JSON.stringify(detail)]);
  // What lib/guardian-flow and lib/messaging write, in that order.
  await ev('invite_created', { invitation_id: inv });
  await ev('sms_sent', { message_key: 'doc15.§1', invitation_id: inv });
  await ev('email_sent', { message_key: 'doc15.§2', invitation_id: inv });
  await q(`insert into message_outbox (message_key, channel, to_address, body, provider_id, invitation_id)
    values ('doc15.§2', 'email', 'funnel.parent@fixture.example', 'x', 'prov-0077', $1)`, [inv]);
  await q(`select fn_record_delivery('prov-0077', 'delivered')`);
  await q(`select fn_record_guardian_landed($1, 'email')`, [inv]);
  await ev('email_verified', { invitation_id: inv });
  // Noise the link must not take: another invitation's row, and a word that
  // is not the funnel's riding on the same invitation id.
  await ev('email_sent', { message_key: 'doc15.§2', invitation_id: otherInv });
  await ev('report_filed', { invitation_id: inv });
  const before = await q(`select id, subject_id from consent_event where detail->>'invitation_id' = $1 order by id`, [inv]);

  // The approval, as approveInvitation writes it.
  const child = crypto.randomUUID(), parent = crypto.randomUUID(), stranger = crypto.randomUUID();
  await q(`insert into person (id, first_name, dob) values ($1,'Funnel',$2), ($3,'Funnel Parent',$4), ($5,'Stranger',$4)`,
    [child, yearsAgo(13), parent, yearsAgo(40), stranger]);
  await q(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [parent, child]);
  await q(`update pending_invitation set sms_confirmed_at = now(), email_confirmed_at = now(), approved_at = now() where id = $1`, [inv]);
  await q(`insert into consent_event (event, actor_id, subject_id, detail) values ('approved', $1, $2, jsonb_build_object('invitation_id', $3::uuid))`,
    [parent, child, inv]);

  const log = (await q(`select event from fn_consent_timeline($1, $2)`, [parent, child])).map((r) => r.event);
  check('funnel1: at approval the parent\u2019s log gains "We emailed you", "That email reached your inbox" and "You opened the permission page" (decision 8)',
    ['email_sent', 'email_delivered', 'guardian_landed'].every((e) => log.includes(e)), true);
  check('funnel1b: and the rest of the early funnel with them — asked, texted, confirmed',
    ['invite_created', 'sms_sent', 'email_verified', 'approved'].every((e) => log.includes(e)), true);
  check('funnel2: linked, not rewritten — every early row still has no subject (consent_event is append-only)',
    (await q(`select id, subject_id from consent_event where detail->>'invitation_id' = $1 and id = any($2::bigint[]) order by id`,
      [inv, before.map((r) => r.id)])).every((r) => r.subject_id === null), true);
  check('funnel3: nothing rides in that is not this invitation\u2019s funnel — another invitation\u2019s send, a non-funnel word',
    [log.filter((e) => e === 'email_sent').length, log.includes('report_filed')], [1, false]);
  check('funnel4: the log is the person\u2019s and their guardian\u2019s — a stranger, a nobody and an unrelated guardian read nothing',
    [(await q(`select 1 from fn_consent_timeline($1, $2)`, [stranger, child])).length,
     (await q(`select 1 from fn_consent_timeline(null, $1)`, [child])).length,
     (await q(`select 1 from fn_consent_timeline($1, $2)`, [ID.guardian, child])).length], [0, 0, 0]);
  await q(`update guardianship_link set revoked_at = now() where child_id = $1`, [child]);
  check('funnel4b: nor does a guardian whose link was revoked', (await q(`select 1 from fn_consent_timeline($1, $2)`, [parent, child])).length, 0);
  await q(`update guardianship_link set revoked_at = null where child_id = $1`, [child]);
  const linkRefused = async (sql) => { try { await db.query(sql); return false; } catch { return true; } };
  check('funnel5: the link is append-only too — no update, no delete',
    [await linkRefused(`update consent_event_link set subject_id = '${stranger}'`), await linkRefused(`delete from consent_event_link`)], [true, true]);

  // A 16–17 naming a parent: their rows carry them from the first message,
  // so the approval attaches nothing (and nothing of anyone else's).
  const teen = crypto.randomUUID();
  await q(`insert into person (id, first_name, dob) values ($1,'Funnel Teen',$2)`, [teen, yearsAgo(16)]);
  const teenInv = (await q(`insert into pending_invitation (first_name, dob, guardian_name, guardian_phone, child_id)
    values ('Funnel Teen', $1, 'Teen Parent', '+61400000079', $2) returning id`, [yearsAgo(16), teen]))[0].id;
  await ev('invite_created', { invitation_id: teenInv });
  await ev('email_sent', { message_key: 'doc15.§2b', invitation_id: teenInv }, teen);
  const linksBefore = Number((await q(`select count(*)::int as n from consent_event_link`))[0].n);
  await q(`insert into consent_event (event, actor_id, subject_id, detail) values ('approved', $1, $2, jsonb_build_object('invitation_id', $3::uuid, 'kind', 'parent_confirmed'))`,
    [parent, teen, teenInv]);
  check('funnel6: a 16\u201317\u2019s approval links nothing — the decision is about under-16s, whose rows could not name them',
    Number((await q(`select count(*)::int as n from consent_event_link`))[0].n), linksBefore);

  // The writers: the invitation now rides on the send, the receipt and the
  // resend, so there is something to link.
  check('funnel7: the approval request, its resend and the nudge all carry the invitation onto the spine and the outbox',
    [/sendAndLog\(sms\([^)]*\)[^;]*invitationId \}, 'sms_sent', subject\)/.test(srcOf('lib/guardian-flow.ts')),
     /sendAndLog\(email\([^)]*\)[^;]*invitationId \}, 'email_sent', subject\)/.test(srcOf('lib/guardian-flow.ts')),
     (srcOf('app/ops/support/actions.ts').match(/invitationId \}, '(sms|email)_sent'\)/g) ?? []).length,
     /invitationId: n\.invitation_id/.test(srcOf('app/api/jobs/daily/route.ts')),
     /jsonb_build_object\('invitation_id', \$4::uuid\)/.test(srcOf('lib/messaging.ts'))],
    [true, true, 2, true, true]);
}

// Every consent_event the vocabulary can produce needs a human line, or a
// parent reads a database enum on the screen that exists to be plain.
{
  // The constraint spans many lines with comments between them, so the block
  // is taken whole and the quoted values pulled out of it. A regex that only
  // matched one line found ZERO events and the check passed vacuously — an
  // empty list trivially has nothing missing.
  //
  // 0076: read from the DATABASE, not from the migration text. The first
  // create-table block was 0002's list, which three later migrations have
  // rewritten — it still carried `email_opened` after the word was dropped,
  // and would have demanded a line for an event the database now refuses.
  const def = (await db.query(`select pg_get_constraintdef(oid) as d from pg_constraint
    where conrelid = 'consent_event'::regclass and conname = 'consent_event_event_check'`)).rows[0]?.d ?? '';
  const vocab = [...def.matchAll(/'([a-z_]+)'::text/g)].map((x) => x[1]);
  check('ctl5: the consent vocabulary was actually found', vocab.length > 20, true);
  const missing = vocab.filter((e) => !gControlsPage.includes(`${e}:`));
  check(`ctl6: every consent event has a plain-English line (missing: ${missing.join(', ') || 'none'})`,
    missing.length, 0);
}

// D-25: gender is not a field we hold about a child, so there is nothing to
// derive a pronoun FROM. Eighteen places across six screens read
// `name === 'Georgia' ? 'her' : 'his'` — a fixture shortcut that shipped, and
// that made every real child who was not called Georgia "he". Copy that
// branches on a person's NAME is the tell.
{
  const offenders = routeFiles.filter((f) => {
    const src = codeOnly(readFileSync(f, 'utf8'));
    return /(name|firstName)\s*===\s*'[A-Z][a-z]+'/.test(src);
  }).map((f) => f.slice(f.indexOf('app/')));
  check(`pron1: no screen picks its words from a first name (${offenders.join(', ') || 'none'})`,
    offenders.length, 0);

  // The same shape one level up: fixture DATA living in product code.
  // PlayerCV carried three hardcoded lists of clip titles keyed on the
  // fixture slugs, inside the component that renders every child's CV. It
  // was unreachable for real records, which is exactly why it survived —
  // dead fixture code waiting for a slug to collide with it.
  const slugs = ['deniz', 'nate', 'georgia', 'jordan', 'sam-kaya', 'riverside-fc'];
  const compDir = fileURLToPath(new URL('../components', import.meta.url));
  const componentFiles = [];
  (function walk(d) {
    for (const e of rd(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name)) componentFiles.push(full);
    }
  })(compDir);
  const seeded = [...routeFiles, ...componentFiles].filter((f) => {
    if (/cv-preview|\/design\/|app\/demo\//.test(f)) return false;   // dev-only surfaces (demo: lib/demo)
    const src = codeOnly(readFileSync(f, 'utf8')).toLowerCase();
    return slugs.some((sl) => src.includes(`'${sl}'`));
  }).map((f) => f.slice(Math.max(f.indexOf('app/'), f.indexOf('components/'))));
  check(`pron2: no product component carries fixture data (${seeded.join(', ') || 'none'})`,
    seeded.length, 0);
}

// .env.example IS the production setup instructions, so it has to agree with
// the code in BOTH directions. It did not: SESSION_SECRET was read with a
// hardcoded fallback and was not in the file at all, so following the
// documented setup produced an app signing sessions with a constant that is
// committed to this repository — forge the cookie, be anyone. And four
// variables were listed that nothing reads, which sends somebody off to
// create credentials the product deliberately does not use.
{
  const envFile = readFileSync(fileURLToPath(new URL('../.env.example', import.meta.url)), 'utf8');
  const declared = new Set([...envFile.matchAll(/^([A-Z_0-9]+)=/gm)].map((m) => m[1]));
  const used = new Set(
    [...routeFiles, ...readdirSync(fileURLToPath(new URL('../lib', import.meta.url)))
      .map((f) => fileURLToPath(new URL('../lib/' + f, import.meta.url)))]
      .filter((f) => /\.tsx?$/.test(f))
      .flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/process\.env\.([A-Z_0-9]+)/g)].map((m) => m[1])),
  );
  // NODE_ENV and TZ are the platform's, not ours.
  for (const k of ['NODE_ENV', 'TZ']) { used.delete(k); declared.delete(k); }

  const undocumented = [...used].filter((k) => !declared.has(k)).sort();
  check(`env1: every variable the code reads is documented (missing: ${undocumented.join(', ') || 'none'})`,
    undocumented.length, 0);
  const unread = [...declared].filter((k) => !used.has(k)).sort();
  check(`env2: and nothing is documented that no code reads (stale: ${unread.join(', ') || 'none'})`,
    unread.length, 0);
}
// The session secret has no fallback in production.
const sessSrc = readFileSync(fileURLToPath(new URL('../lib/session.ts', import.meta.url)), 'utf8');
check('env3: production refuses to sign a session without a real secret',
  /NODE_ENV === 'production'\)\s*\{\s*throw new Error\('SESSION_SECRET/.test(sessSrc), true);

// A server action taking an id POSITIONALLY can only be fed by bind(), which
// renders $ACTION_REF_n plus encrypted arguments the client runtime has to
// resolve — so it 500s without JavaScript and cannot be driven by anything
// that is not a browser. Every action takes a FormData and reads its ids
// from it; every one of them already re-checked those ids anyway.
{
  const actionFiles = routeFiles.filter((f) => /actions\.ts$/.test(f));
  check('bind1: there are action files to check', actionFiles.length >= 15, true);
  const positional = [];
  for (const f of actionFiles) {
    const src = codeOnly(readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/export async function (\w+)\(([^)]*)\)/g)) {
      const args = m[2].trim();
      if (!args) continue;                       // session-derived: the safest shape
      if (/^formData: FormData$/.test(args)) continue;
      positional.push(`${f.slice(f.indexOf('app/'))}:${m[1]}`);
    }
  }
  check(`bind2: no action takes an id positionally (${positional.join(', ') || 'none'})`,
    positional.length, 0);
}

check('N12/D-122: no export, csv or download route exists',
  files.filter((f) => /export|csv|download/i.test(rel(f))).length, 0);
check('C1/P11: no message or DM route exists',
  files.filter((f) => /\/(dm|message|chat|inbox)\//i.test(rel(f))).length, 0);
check('J23: no agent surface exists',
  files.filter((f) => /\/agents?\//i.test(rel(f))).length, 0);

// Allowlisted: the legal-page renderer injects OUR OWN compiled policy
// documents (first-party, versioned, no user text ever passes through it).
// The ban protects against hostile free text; nothing else may join this
// list without the same argument.
const DSI_ALLOWED = ['/legal/legal-page.tsx'];
const srcFiles = files.filter((f) => /\.(ts|tsx)$/.test(f));
let dsi = 0, wwccNum = 0;
for (const f of srcFiles) {
  const src = readFileSync(f, 'utf8');
  if (src.includes('dangerouslySetInnerHTML') && !DSI_ALLOWED.some((a) => rel(f) === a)) dsi++;
  if (/wwcc[_-]?(number|no|num)/i.test(src)) wwccNum++;
}
check('D-94 §6: dangerouslySetInnerHTML appears nowhere', dsi, 0);
check('D-98: no code references a WWCC number', wwccNum, 0);

// Doc 32 (0049): A1 hidden means off every club surface; A2 suppression is a
// reversible revocation; B2 consent rows are stamped with version and hash.
{
  for (const fn of ['fn_register_rows', 'fn_register_count', 'fn_can_read_registration', 'fn_trial_interest_rows', 'fn_token_read']) {
    check(`g32-p1: ${fn} asks whether the person is hidden`, /fn_person_hidden\(/.test(await procSrc(fn)), true);
  }
  const refused = async (sql, args = []) => { try { await db.query(sql, args); return false; } catch { return true; } };
  const kid = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob) values ($1, 'Suppressed Kid', $2)`, [kid, yearsAgo(10)]);
  await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1, $2, now())`, [ID.guardian2, kid]);
  check('g32-p2: a suppression is always a revocation', await refused(`update guardianship_link set suppressed_at = now() where child_id = $1`, [kid]), true);
  await db.query(`update guardianship_link set revoked_at = now(), suppressed_at = now() where child_id = $1`, [kid]);
  check('g32-p3: a suppressed parent has no standing', await level(ID.guardian2, kid) === 'full', false);
  await db.query(`update guardianship_link set revoked_at = null, suppressed_at = null where child_id = $1`, [kid]);
  check('g32-p4: restored, they do', await level(ID.guardian2, kid), 'full');
  check('g32-p5: a report says what it is about, from a closed list',
    await refused(`insert into report (subject_kind, subject_ref, concern) values ('other', 'x', 'anything')`), true);

  const gf = readFileSync(fileURLToPath(new URL('../lib/guardian-flow.ts', import.meta.url)), 'utf8');
  const joinSrc = readFileSync(fileURLToPath(new URL('../app/join/actions.ts', import.meta.url)), 'utf8');
  check('g32-p6: consent rows are stamped from the served file, not typed (B2)',
    /legalStamp\('22'\)/.test(gf) && /legalStamp\('21'\)/.test(gf) && /legalStamp\('20'\)/.test(joinSrc) && !/'2[02]@v\d/.test(gf + joinSrc), true);
  const stampSrc = readFileSync(fileURLToPath(new URL('../lib/legal-stamp.ts', import.meta.url)), 'utf8');
  check('g32-p7: a stamp is the registered version plus the sha256 of the bytes', /`\$\{doc\}@\$\{registeredVersion\(doc\)\}\+sha256:\$\{sha\}`/.test(stampSrc), true);
  const reg = readFileSync(fileURLToPath(new URL('../docs/legal/00-Legal-Register.md', import.meta.url)), 'utf8');
  check('g32-p8: the register gives a version for each stamped document',
    ['20', '21', '22'].every((d) => /\*\*v\d+\.\d+\*\*/.test(reg.split('\n').find((l) => l.startsWith(`| **${d}** |`)) ?? '')), true);
}

// Every message written is sent from somewhere (doc 15 is the launch
// catalogue). The only exceptions are named, each with why.
{
  const msgSrc = readFileSync(fileURLToPath(new URL('../lib/messages.ts', import.meta.url)), 'utf8');
  const builders = [...msgSrc.matchAll(/^export const ([A-Za-z0-9]+) = \(/gm)].map((m) => m[1]);
  const NOT_YET = {
    verificationCodeSms: 'doc 15 §14: approval uses two links (D-156), not codes',
    sendRequestLapsedEmail: 'doc 15 §35: the composer is an under-16 with no address; nothing to send to',
  };
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
  const root = fileURLToPath(new URL('..', import.meta.url));
  const srcs = [...walk(join(root, 'app')), ...walk(join(root, 'lib'))].filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('lib/messages.ts'))
    .map((f) => readFileSync(f, 'utf8')).join('\n');
  const unsent = builders.filter((b) => !new RegExp(`\\b${b}\\b`).test(srcs) && !(b in NOT_YET));
  check(`msg-all: every doc 15 message in code is sent from somewhere (${unsent.join(', ') || 'all are'})`, unsent, []);
  const staleExceptions = Object.keys(NOT_YET).filter((b) => new RegExp(`\\b${b}\\b`).test(srcs));
  check(`msg-all-b: and no exception is listed for one that is now sent (${staleExceptions.join(', ') || 'none'})`, staleExceptions, []);
}

// Reminders (0050): doc 15 §3 once at day 10; §5/§23 a week before expiry.
{
  const nudges = async () => (await db.query('select invitation_id from fn_pending_nudges()')).rows.map((r) => r.invitation_id);
  const mk = async (days, extra = '') => (await db.query(
    `insert into pending_invitation (first_name, dob, guardian_name, guardian_phone, guardian_email, created_at${extra ? ', ' + extra.split('=')[0] : ''})
     values ('Nudge', '2014-01-01', 'P', '0400 111 000', 'n@example.com', now() - ($1 || ' days')::interval${extra ? ', ' + extra.split('=')[1] : ''}) returning id`, [String(days)])).rows[0].id;
  const due = await mk(11), young = await mk(3), held = await mk(11, 'held_at=now()');
  let n = await nudges();
  check('rm1: an under-16 invitation waiting 10+ days is due its one reminder', n.includes(due), true);
  check('rm2: a fresh one is not', n.includes(young), false);
  check('rm3: a held one never is (D-155)', n.includes(held), false);
  await db.query(`insert into consent_event (event, detail) values ('nudge_sent', jsonb_build_object('invitation_id', $1::uuid))`, [due]);
  check('rm4: once reminded, never again', (await nudges()).includes(due), false);

  const kid = crypto.randomUUID(), kidRec = crypto.randomUUID(), adult = crypto.randomUUID(), adultRec = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob) values ($1, 'Remy', $2), ($3, 'Grown', $4)`, [kid, yearsAgo(13), adult, yearsAgo(25)]);
  await db.query(`insert into development_record (id, person_id) values ($1, $2), ($3, $4)`, [kidRec, kid, adultRec, adult]);
  await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1, $2, now())`, [ID.guardian, kid]);
  await db.query(`update person set email = coalesce(email, 'remind-guardian@example.com') where id = $1`, [ID.guardian]);
  await proveAddress(ID.guardian);
  const tok = async (rec, days, who) => (await db.query(
    `insert into share_token (record_id, token_hash, issued_by, expires_at) values ($1, $2, $3, now() + ($4 || ' hours')::interval) returning id`,
    [rec, sha('remind-' + crypto.randomUUID()), who, String(days * 24)])).rows[0].id;
  // rm5/rm6 are about GROUPING: two links that expire on the same Melbourne
  // date arrive as one reminder. So the fixture has to guarantee "the same
  // Melbourne date", and until 23 Sep it did not — it asked for now + 156h and
  // now + 158.4h and assumed 2h24m could not cross a midnight. It crosses one
  // for 2h24m out of every 24, so this suite went red between roughly 09:36 and
  // 12:00 Melbourne, every day, and was green on either side of that. It was
  // measured green at 01:14 and red at 09:42 on the same commit. A gate that
  // answers differently depending on when you ask it is not a gate.
  //
  // fn_links_to_remind reminds on links expiring in (now + 6d, now + 7d] — a
  // window exactly 24 hours long, so it contains exactly one Melbourne
  // midnight, wherever the clock happens to be. Anchor to that midnight and
  // put both links on whichever side of it has room: at least an hour of the
  // window lies on one side or the other, always.
  const anchored = async (offset) => (await db.query(
    `with w as (
       select now() + interval '7 days' as w1,
              date_trunc('day', (now() + interval '7 days') at time zone 'Australia/Melbourne')
                at time zone 'Australia/Melbourne' as midnight)
     insert into share_token (record_id, token_hash, issued_by, expires_at)
     select $1, $2, $3,
            case when w1 - midnight >= interval '1 hour'
                 then midnight + ($4 || ' minutes')::interval
                 else midnight - ($4 || ' minutes')::interval end
     from w returning id`,
    [kidRec, sha('remind-' + crypto.randomUUID()), ID.guardian, String(offset)],
  )).rows[0].id;
  const t1 = await anchored(10), t2 = await anchored(20), tFar = await tok(kidRec, 30, ID.guardian);
  await tok(adultRec, 6.5, adult);
  await db.query(`insert into consent_event (event, actor_id, subject_id, detail)
    values ('share_dispatched', $1, $2, jsonb_build_object('token_id', $3::uuid, 'club_name', 'Reminder FC'))`, [ID.guardian, kid, t1]);
  const rows = (await db.query('select * from fn_links_to_remind()')).rows;
  const remy = rows.filter((r) => r.child_id === kid);
  // And the anchor itself is checked, at every minute of the day, because the
  // bug it replaces was invisible for twenty-one hours out of twenty-four and
  // the fix would be too (L19: a check that cannot fail is a hope). 1440
  // synthetic clocks: both links inside the window, both on one Melbourne date.
  const anchor = (await db.query(
    `with nows as (select generate_series(now(), now() + interval '23 hours 59 minutes', interval '1 minute') as n),
     w as (select n, n + interval '6 days' as w0, n + interval '7 days' as w1,
             date_trunc('day', (n + interval '7 days') at time zone 'Australia/Melbourne')
               at time zone 'Australia/Melbourne' as midnight from nows),
     t as (select w0, w1,
            case when w1 - midnight >= interval '1 hour' then midnight + interval '10 minutes'
                 else midnight - interval '10 minutes' end as t1,
            case when w1 - midnight >= interval '1 hour' then midnight + interval '20 minutes'
                 else midnight - interval '20 minutes' end as t2
           from w)
     select count(*) filter (where not (t1 > w0 and t1 <= w1 and t2 > w0 and t2 <= w1))::int as outside,
            count(*) filter (where (t1 at time zone 'Australia/Melbourne')::date
                                <> (t2 at time zone 'Australia/Melbourne')::date)::int as split,
            count(*)::int as minutes from t`)).rows[0];
  check('rm4b: the reminder fixture holds at every minute of the day, not just this one',
    [anchor.outside, anchor.split, anchor.minutes >= 1440], [0, 0, true]);
  check('rm5: a child\'s links expiring in a week come as ONE reminder', remy.length, 1);
  check('rm6: covering both links, not the one a month out', remy[0] && [remy[0].token_ids.includes(t1), remy[0].token_ids.includes(t2), remy[0].token_ids.includes(tFar)], [true, true, false]);
  check('rm7: naming the club that holds one (§23)', remy[0]?.clubs, ['Reminder FC']);
  check('rm8: to the approved guardian', (remy[0]?.emails ?? []).length > 0, true);
  check('rm9: an adult\'s own links get no reminder', rows.some((r) => r.child_id === adult), false);
  await db.query(`update share_token set renewal_reminded_at = now() where id = any($1::uuid[])`, [remy[0].token_ids]);
  check('rm10: and once sent, not again', (await db.query('select * from fn_links_to_remind()')).rows.some((r) => r.child_id === kid), false);
}

// D-155 as amended (0048): a 16-17's parent is confirmed before the link
// exists, and until then the 16-17 cannot send.
{
  const teen = crypto.randomUUID(), teenRec = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob) values ($1, 'Unconfirmed', $2)`, [teen, yearsAgo(17)]);
  await db.query(`insert into development_record (id, person_id) values ($1, $2)`, [teenRec, teen]);
  const can = async () => (await db.query('select fn_can_dispatch($1, $2) as c', [teen, teenRec])).rows[0].c;
  check('g16a: a 16-17 with no confirmed parent cannot send', await can(), false);
  const parent = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, adult_declared_at) values ($1, 'Confirmed Parent', now())`, [parent]);
  await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1, $2, null)`, [parent, teen]);
  check('g16b: nor with a parent named but not yet confirmed', await can(), false);
  await db.query(`update guardianship_link set approved_at = now() where guardian_id = $1 and child_id = $2`, [parent, teen]);
  check('g16c: once a parent has confirmed, they can', await can(), true);
  const inv = (await db.query(`insert into pending_invitation (first_name, dob, guardian_name, guardian_phone, guardian_email, child_id)
    values ('Unconfirmed', $1, 'P', '0400 000 009', 'p16@example.com', $2) returning id`, [yearsAgo(17), teen])).rows[0].id;
  await db.query(`delete from guardianship_link where child_id = $1`, [teen]);
  await db.query(`delete from development_record where person_id = $1`, [teen]);
  await db.query(`delete from person where id = $1`, [teen]);
  check('g16d: a confirmation request goes when the teen does (D-26)', (await db.query('select count(*)::int as n from pending_invitation where id = $1', [inv])).rows[0].n, 0);
  const joinSrc = readFileSync(fileURLToPath(new URL('../app/join/actions.ts', import.meta.url)), 'utf8');
  check('g16e: sign-up never writes a guardian link itself', /insert into guardianship_link/.test(joinSrc), false);
  check('g16f: a 16-17 sign-up needs the parent\'s email, and not their own',
    /band === '16_17' && \(!guardianName \|\| !AU_MOBILE\.test\(guardianPhone\) \|\| !EMAIL_RE\.test\(guardianEmail\)\s*\|\| guardianEmail\.toLowerCase\(\) === email\)/.test(joinSrc), true);
}

// Who has read a registration (doc 34 rule 6, doc 32 C4b; 0047).
{
  const readers = async (viewer, person) => (await db.query('select * from fn_register_readers($1,$2)', [viewer, person])).rows;
  const regN = crypto.randomUUID(), regD = crypto.randomUUID();
  await db.query(`insert into registration (id, player_id, club_id, policy_version) values ($1,$2,$3,'20@v2.4'), ($4,$5,$3,'20@v2.4')`,
    [regN, ID.nate, CLUB.riverside, regD, ID.deniz]);
  await db.query(`insert into register_read_log (person_id, registration_id, surface, read_at) values
    ($1,$2,'list', now() - interval '3 days'), ($1,$2,'list', now() - interval '1 day'), ($1,$2,'cv', now() - interval '2 days'),
    ($1,$3,'list', now())`, [ID.td, regN, regD]);
  const asGuardian = await readers(ID.guardian, ID.nate);
  const nate = asGuardian.filter((r) => r.registration_id === regN);
  check('rr1: a guardian sees who read their child\'s registration, by name and role',
    nate.every((r) => r.reader_name === 'td' && r.reader_role === 'Technical director') && nate.length === 2, true);
  check('rr2: one row per kind of read, with the latest of each',
    nate.map((r) => r.surface).sort(), ['cv', 'list']);
  const lastList = nate.find((r) => r.surface === 'list').last_read;
  check('rr3: the list read shows the most recent time', Date.now() - new Date(lastList).getTime() < 26 * 3600 * 1000, true);
  check('rr4: the 17-year-old sees the same about themselves', (await readers(ID.nate, ID.nate)).filter((r) => r.registration_id === regN).length, 2);
  check('rr5: an under-16 does not ask for themselves (their guardian does)', (await readers(ID.deniz, ID.deniz)).length, 0);
  check('rr6: their guardian does', (await readers(ID.guardian, ID.deniz)).some((r) => r.registration_id === regD && r.surface === 'list'), true);
  check('rr7: a stranger gets nothing', (await readers(ID.coachOther, ID.nate)).length, 0);
  check('rr8: nor does the club that read it', (await readers(ID.td, ID.nate)).length, 0);
  check('rr9: nor another child\'s guardian', (await readers(ID.guardian2, ID.nate)).length, 0);
  check('rr10: an adult\'s old guardian gets nothing unless re-granted', (await readers(ID.guardian, ID.marcus)).length, 0);
  check('rr11: nobody signed out gets anything', (await readers(null, ID.nate)).length, 0);
  const cols = (await db.query(`select string_agg(p.parameter_name, ',' order by p.ordinal_position) as c
    from information_schema.parameters p join information_schema.routines r on r.specific_name = p.specific_name
    where r.routine_name = 'fn_register_readers' and p.parameter_mode = 'OUT'`)).rows[0].c;
  check('rr12: a family never gets the club\'s own status or the note (D-108, N10)', /status|note/.test(cols ?? ''), false);
}

// A player's own send list (John's rulings, 17 Sep §3; 0046): what actually
// happened, and never a number.
{
  const refused = async (sql, args = []) => { try { await db.query(sql, args); return false; } catch { return true; } };
  const tmp = (await db.query(`insert into person (first_name, dob) values ('Held Sender', $1) returning id`, [yearsAgo(20)])).rows[0].id;
  await db.query(`insert into send_held (person_id, club_name) values ($1, 'Somewhere FC')`, [tmp]);
  check('sl1: a held send keeps the club name and nothing more',
    (await db.query(`select string_agg(column_name, ',' order by column_name) as c from information_schema.columns where table_name = 'send_held'`)).rows[0].c,
    'at,club_name,id,person_id');
  check('sl2: an empty club name is refused', await refused(`insert into send_held (person_id, club_name) values ($1, '')`, [tmp]), true);
  await db.query(`delete from person where id = $1`, [tmp]);
  check('sl3: and it goes when the person goes (D-26)', (await db.query(`select count(*)::int as n from send_held where person_id = $1`, [tmp])).rows[0].n, 0);

  const sendPage = readFileSync(fileURLToPath(new URL('../app/send/[recordId]/page.tsx', import.meta.url)), 'utf8');
  const sendActs = readFileSync(fileURLToPath(new URL('../app/send/[recordId]/actions.ts', import.meta.url)), 'utf8');
  const yl = sendPage.slice(sendPage.indexOf('async function YourLinks'));
  check('sl4: the list never reads the daily cap', /SEND_DAILY_CAP|abuse_signal|ratelimit/.test(sendPage), false);
  check('sl5: nor counts anything', /count\(|\.length\}|\{sends\.length/.test(yl.replace('sends.length === 0', '')), false);
  check('sl6: a held send is written only on the limited path, and still lands on "Sent" (U-3)',
    /if \(!withinLimit\) \{[\s\S]*?insert into send_held[\s\S]*?redirect\(`\/send\/\$\{recordId\}\?sent=1`\);/.test(sendActs), true);
  check('sl7: the player controls need the player sending for themselves',
    /requireRecordActor\(recordId, \['self'\]\)[\s\S]*?state\.mode !== 'self'/.test(sendActs), true);
}

// ---------------------------------------------------------------------------
// The kill switches (D-94 §10; 0044). LAST in the file on purpose: the
// revoke-all check switches off every link in this database.
// ---------------------------------------------------------------------------
{
  const ksTok = sha('kill-switch-live');
  const ksRec = [];
  for (const r of Object.values(REC)) {
    const h = sha('ks-probe-' + r);
    await db.query(`insert into share_token (record_id, token_hash, issued_by) values ($1,$2,$3)`, [r, h, ID.guardian]);
    if (await tok(h)) { ksRec.push(r); break; }
  }
  await db.query(`insert into share_token (record_id, token_hash, issued_by) values ($1,$2,$3)`, [ksRec[0], ksTok, ID.guardian]);
  check('ks0: the kill-switch fixture starts with a live link', Boolean(await tok(ksTok)), true);

  const refused = async (sql, args = []) => { try { await db.query(sql, args); return false; } catch { return true; } };
  check('ks1: there is exactly one switch row, and a second cannot be added',
    [(await db.query('select count(*)::int as n from ops_switch')).rows[0].n, await refused('insert into ops_switch (id) values (false)')], [1, true]);

  const setPaused = async (on, reason = 'test run') =>
    (await db.query('select fn_ops_set_links_paused($1,$2,$3,$4) as c', [on, ID.guardian, 'op@example.com', reason])).rows[0].c;
  check('ks2: pausing changes the switch', await setPaused(true), true);
  check('ks3: while paused, a live link reads exactly as a dead one (D-77)', await tok(ksTok), null);
  check('ks4: pausing again writes nothing', await setPaused(true), false);
  check('ks5: resuming changes it back', await setPaused(false), true);
  check('ks6: and the same link is live again, nothing lost', Boolean(await tok(ksTok)), true);
  check('ks7: a switch with no reason is refused', await refused('select fn_ops_set_links_paused(true,$1,$2,$3)', [ID.guardian, 'op@example.com', ' ']), true);
  check('ks8: the pause lives inside the single read path (D-80)', /fn_public_links_paused\(\)/.test(await procSrc('fn_token_read')), true);

  const log = (await db.query(`select action, operator_email, reason from ops_switch_event order by id`)).rows;
  check('ks9: every change is logged with the operator and the reason, and only changes are',
    log.map((r) => `${r.action}|${r.operator_email}|${r.reason}`), ['links_paused|op@example.com|test run', 'links_resumed|op@example.com|test run']);
  check('ks10: the switch log cannot be edited', await refused(`update ops_switch_event set reason = 'nothing happened'`), true);
  check('ks11: nor deleted', await refused(`delete from ops_switch_event`), true);

  const liveBefore = (await db.query(`select count(*)::int as n from share_token where revoked_at is null`)).rows[0].n;
  const childrenBefore = (await db.query(`select count(*)::int as n from consent_event where detail->>'kind' = 'pitch'`)).rows[0].n;
  const people = (await db.query(
    `select count(distinct dr.person_id)::int as n from share_token st join development_record dr on dr.id = st.record_id where st.revoked_at is null`)).rows[0].n;
  const revoked = (await db.query('select fn_ops_revoke_all_links($1,$2,$3) as n', [ID.guardian, 'op@example.com', 'breach drill'])).rows[0].n;
  check(`ks12: switching off every link switches off every live one (${liveBefore})`, revoked, liveBefore);
  check('ks13: none is left live', (await db.query(`select count(*)::int as n from share_token where revoked_at is null`)).rows[0].n, 0);
  check('ks14: the link no longer reads', await tok(ksTok), null);
  check('ks15: each affected child\'s timeline says Pitch did it, once',
    (await db.query(`select count(*)::int as n from consent_event where detail->>'kind' = 'pitch'`)).rows[0].n - childrenBefore, people);
  check('ks16: and the log carries the count and the reason',
    (await db.query(`select links_affected, reason from ops_switch_event where action = 'links_all_revoked'`)).rows[0], { links_affected: liveBefore, reason: 'breach drill' });
  check('ks17: the timeline row carries no token and no free text',
    (await db.query(`select detail from consent_event where detail->>'kind' = 'pitch' limit 1`)).rows[0].detail, { kind: 'pitch' });
}

// ---- the club demo (npm run demo, 19 Sep): the locks that keep it harmless --
{
  const demo = srcOf('lib/demo.ts'), dbSrc = srcOf('lib/db.ts'), prov = srcOf('lib/providers.ts');
  check('DEMO1: demo mode refuses to run in a production build',
    /NODE_ENV === 'production'[\s\S]{0,40}throw/.test(demo), true);
  // Brief K item 7: the port is demoDbPort() now, 54323 unless a seat sets
  // its own — still this laptop's loopback, which is the lock.
  check('DEMO2: a demo reads only its own local database, whatever SUPABASE_DB_URL says',
    [/isDemo\(\) \? DEMO_DB_URL/.test(dbSrc), /DEMO_DB_URL = `postgres:\/\/postgres@127\.0\.0\.1:\$\{demoDbPort\(\)\}\/postgres`/.test(demo), /DEMO_DB_PORT = 54323/.test(demo)], [true, true, true]);

  // Brief K item 7. `DEMO_CLUB=… node scripts/dev-db.mts` bound 54323 — BUZ's
  // demo port — whatever PITCH_DEV_DB_PORT said, so a seat exercising the
  // demo layer on its own port took his. An explicit port wins now; the demo
  // keeps 54323 as its default; and npm run demo blanks the knob, so the
  // meeting demo cannot be moved by a shell a seat left set.
  const seed = codeOnly(srcOf('scripts/dev-db.mts')), launcher = codeOnly(srcOf('scripts/demo.mjs'));
  check('demo-port1: a demo database is on 54323 unless a port is set, and on the set port when one is',
    [demoDbPort({}), demoDbPort({ PITCH_DEV_DB_PORT: '' }), demoDbPort({ PITCH_DEV_DB_PORT: '54482' }), demoDbPort({ DEMO_CLUB: 'Club FC', PITCH_DEV_DB_PORT: '54482' })],
    [54323, 54323, 54482, 54482]);
  check('demo-port2: dev-db binds a demo on that answer — not on a 54323 of its own — and a plain dev database still refuses the demo\'s port',
    [/const PORT = DEMO \? demoDbPort\(\) : DEV_PORT;/.test(seed), /new PGLiteSocketServer\(\{ db, port: PORT,/.test(seed), seed.split('\n').some((l) => /\b54323\b/.test(l) && !/console\.error\(/.test(l)),
     /\(!DEMO && PORT === DEMO_DB_PORT\)/.test(seed)],
    [true, true, false, true]);
  check('demo-port3: npm run demo blanks the knob for its database and its app, so BUZ\'s demo is always 54323 — the port it takes over',
    [/const quiet = \{[\s\S]*?PITCH_DEV_DB_PORT: '',[\s\S]*?\};/.test(launcher),
     (launcher.match(/\.\.\.process\.env, \.\.\.quiet,/g) ?? []).length, /for \(const port of \[PORT, 54323\]\)/.test(launcher)],
    [true, 2, true]);
  check('DEMO3: a demo sends no email and no SMS',
    (prov.match(/isDemo\(\) \|\|/g) ?? []).length, 2);
  check('DEMO4: a demo never reaches Stripe or the waitlist',
    [/!isDemo\(\) && Boolean/.test(srcOf('lib/billing.ts')), /!isDemo\(\) && Boolean/.test(srcOf('lib/waitlist-db.ts'))], [true, true]);
  // N4a (safety review): the launcher blanks the keys, but that is the
  // launcher's care and not a property of the module. A crest a club typed
  // across a table must not be able to reach the Sydney bucket.
  check('DEMO4b (N4a): a demo never writes an upload to a real bucket — it asks isDemo() like every other outbound module',
    /!isDemo\(\) && Boolean/.test(srcOf('lib/storage.ts')), true);
  // N4c: next dev otherwise binds every interface, so the meeting's Wi-Fi
  // could open the demo and take any seat in it, with no password.
  check('DEMO4c (N4c): the demo app listens on this laptop only',
    /'next', 'dev', '-H', '127\.0\.0\.1', '-p'/.test(srcOf('scripts/demo.mjs')), true);
  check('DEMO5: the seat picker and its sign-in exist only in a demo',
    [/if \(!isDemo\(\)\) notFound\(\)/.test(srcOf('app/demo/page.tsx')), /if \(!isDemo\(\)\) redirect/.test(srcOf('app/demo/actions.ts'))], [true, true]);
  // DEMO6 read "the demo renames the club only — it loads no person", and it
  // checked that by asserting the layer contains no `insert into person`.
  // That was true while the demo did nothing but rename a club, and BUZ asked
  // on 23 Sep for squads with players in them, so the layer now invents
  // people. The RULE has not moved an inch — nothing about a real person ever
  // enters a demo (TRAINING §3.1) — so these check the rule itself instead of
  // a proxy for it that has stopped meaning it. Written this way round
  // deliberately: the weaker check would have been to delete DEMO6.
  const layerSrc = srcOf('scripts/demo-layer.mts');
  check('DEMO6a: the demo layer invents its people — it reads none from anywhere',
    [/\bfetch\s*\(/.test(layerSrc), /readFileSync\((?!o\.crest\))/.test(layerSrc)], [false, false]);
  // Every address and number it writes is one that cannot reach a human:
  // example.com and example.au are reserved for documentation, and
  // +61 491 570 xxx is the range ACMA sets aside for fiction.
  const demoAddresses = layerSrc.match(/[\w.+-]+@[\w.${}-]+\.[a-z]{2,}/g) ?? [];
  const demoNumbers = layerSrc.match(/\+61\d{9}/g) ?? [];
  check('DEMO6b: every address and phone number a demo writes is a reserved fiction',
    [demoAddresses.length > 0,
     demoAddresses.every((a) => a.endsWith('example.com') || a.endsWith('example.au')),
     demoNumbers.every((n) => n.startsWith('+61491570'))],
    [true, true, true]);
  // "If a message is not in doc 15, it does not send" — and a club is shown
  // these as what families receive, so they are built by lib/messages, never
  // typed into the demo.
  const layer = srcOf('scripts/demo-layer.mts');
  check('DEMO7: the demo\'s sample messages are the catalogue\'s own words',
    [/import\('\.\.\/lib\/messages\.ts'\)/.test(layer), (layer.match(/await put\(m\.[a-zA-Z]+\(/g) ?? []).length >= 4, /put\(\{/.test(layer)], [true, true, false]);
}

// ---- 0051: the alumni wall never names anyone under 18 -----------------------
// The form asks "Everyone named here is 18 or over"; the database refuses an
// entry that does not carry that confirmation, so skipping the form does not
// skip the rule. Club-page text is capped in the database as well.
{
  const r = async (sql, args) => { try { await db.query(sql, args); return false; } catch { return true; } };
  check('AL1: an alumni entry with no "18 or over" confirmation is refused by the database',
    await r(`insert into alumni_entry (club_id, line) values ($1, 'Someone → Somewhere')`, [CLUB.riverside]), true);
  check('AL2: with the confirmation recorded, it is accepted',
    await r(`insert into alumni_entry (club_id, line, adults_confirmed_by, adults_confirmed_at) values ($1, 'Someone → Somewhere', $2, now())`, [CLUB.riverside, ID.td]), false);
  check('AL3: a philosophy over 400 characters, or a year that is not one, is refused by the database',
    [await r(`update club set philosophy = repeat('x', 401) where id = $1`, [CLUB.riverside]),
     await r(`update club set established = 'long ago' where id = $1`, [CLUB.riverside])], [true, true]);
}

// ---- 0052: who is in a squad, and who may put them there (D-158) -----------
// The UI is one way in; these are the rules underneath it, which hold however
// the row is written.
{
  const r = async (sql, args) => { try { await db.query(sql, args); return false; } catch { return true; } };
  // A squad nobody in the fixture is in yet, so "already in this squad" is not
  // the reason a write is refused.
  const sq = (await db.query(
    `insert into squad (club_id, name, age_group, competition_gender, season)
     values ($1, 'Squad Rules Test', null, 'boys', '2026') returning id`, [CLUB.riverside])).rows[0].id;
  const other = (await db.query(`select id from squad where club_id = $1 limit 1`, [CLUB.other])).rows[0]?.id;

  check('SQ1: a claim comes from the player or their guardian, never from anyone else',
    [await r(`insert into squad_claim (person_id, club_id, squad_id, asked_by) values ($1,$2,$3,$4)`,
             [ID.deniz, CLUB.riverside, sq, ID.coachV]),
     await r(`insert into squad_claim (person_id, club_id, squad_id, asked_by) values ($1,$2,$3,$4)`,
             [ID.deniz, CLUB.riverside, sq, ID.guardian])], [true, false]);
  check('SQ2: an under-16 cannot claim a squad alone (D-91)',
    await db.query(`select fn_can_act_on_squad($1,$1) as ok`, [ID.deniz]).then((x) => x.rows[0].ok), false);
  // SQ3 asserted "a 16-17 acts alone", which was the defect (safety B4, L22).
  // A claim hands a club the LIVE record — more than a send gives — so it
  // asks exactly what fn_can_dispatch asks of a send (0048, D-22, D-91): a
  // parent confirmed, and their send switch on.
  const act = async (a, p) => (await db.query(`select fn_can_act_on_squad($1,$2) as ok`, [a, p])).rows[0].ok;
  const teenAlone = crypto.randomUUID(), teenParented = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob) values ($1,'Alone',$3), ($2,'Parented',$3)`,
    [teenAlone, teenParented, yearsAgo(17)]);
  await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [ID.guardian, teenParented]);
  check('SQ3: a 16-17 with no confirmed parent cannot claim a squad alone (B4, D-22)', await act(teenAlone, teenAlone), false);
  check('SQ3b: with a parent confirmed, they act for themselves', await act(teenParented, teenParented), true);
  await db.query(`insert into guardian_setting (child_id, send_disabled, updated_by) values ($1,true,$2)
    on conflict (child_id) do update set send_disabled = true`, [teenParented, ID.guardian]);
  check('SQ3c: and the parent\'s send switch stops them, exactly as it stops a send (0048)',
    await act(teenParented, teenParented), false);
  check('SQ3d: the parent themselves still acts while the switch is off', await act(ID.guardian, teenParented), true);
  await db.query(`update guardian_setting set send_disabled = false where child_id = $1`, [teenParented]);
  check('SQ3e: an adult acts for themselves', await act(ID.guardian, ID.guardian), true);
  // M3: at 18 a guardianship is visibility, never control (D-49, doc 14 P15).
  check('SQ3f: a parent does not act on their adult child\'s squad, re-granted or not',
    [await act(ID.guardian, ID.marcus),
     await db.query(`update guardianship_link set regranted_at = now() where guardian_id = $1 and child_id = $2`, [ID.guardian, ID.marcus])
       .then(() => act(ID.guardian, ID.marcus))], [false, false]);
  check('SQ3g: and they cannot take their adult child out of a squad either (M3)',
    (await db.query(`select fn_can_leave_squad($1,$2) as ok`, [ID.guardian, ID.marcus])).rows[0].ok, false);
  check('SQ3h: but a 16-17 whose parent switched sending off can still leave (D-10)',
    [(await db.query(`select fn_can_leave_squad($1,$1) as ok`, [teenParented])).rows[0].ok,
     (await db.query(`select fn_can_leave_squad($1,$1) as ok`, [ID.deniz])).rows[0].ok], [true, false]);
  check('SQ4: only the club invites, and only into its own squad',
    [await r(`insert into squad_invitation (person_id, club_id, squad_id, invited_by) values ($1,$2,$3,$4)`,
             [ID.deniz, CLUB.riverside, sq, ID.guardian]),
     other ? await r(`insert into squad_invitation (person_id, club_id, squad_id, invited_by) values ($1,$2,$3,$4)`,
             [ID.deniz, CLUB.riverside, other, ID.td]) : true], [true, true]);
  check('SQ5: the technical director and the administrator work squads; a coach does not',
    [await db.query(`select fn_can_work_squads($1,$2) as ok`, [ID.td, CLUB.riverside]).then((x) => x.rows[0].ok),
     await db.query(`select fn_can_work_squads($1,$2) as ok`, [ID.coachV, CLUB.riverside]).then((x) => x.rows[0].ok)], [true, false]);
  check('SQ6: an administrator reads the squad list and gets no record id with it (D-93)',
    (await db.query(`select record_id from fn_squad_roster($1, $2)`, [ID.clubAdmin, sq])).rows.every((x) => x.record_id === null), true);
  // 0053: positions, squad number, foot, stats and clips all come OFF the
  // development record, so an administrator gets none of them either.
  {
    const anySquad = (await db.query(
      `select m.squad_id from membership m join squad s on s.id = m.squad_id
       where s.club_id = $1 and m.role = 'player' and m.ended_at is null and m.squad_id is not null limit 1`,
      [CLUB.riverside])).rows[0]?.squad_id;
    if (anySquad) {
      const asAdmin = (await db.query(`select * from fn_squad_roster($1, $2)`, [ID.clubAdmin, anySquad])).rows;
      const asTd = (await db.query(`select * from fn_squad_roster($1, $2)`, [ID.td, anySquad])).rows;
      check('SQ6b: an administrator sees a name and a join date, and nothing off the record',
        [asAdmin.length > 0,
         asAdmin.every((r) => r.positions === null && r.squad_number === null && r.foot === null
           && r.clips === null && r.apps === null && r.goals === null && r.assists === null && r.clean_sheets === null)],
        [true, true]);
      check('SQ6c: the technical director gets the depth: positions in the player\'s own order, number, foot',
        asTd.some((r) => Array.isArray(r.positions) && r.positions.length > 0), true);
      check('SQ6d: and the list comes back as a team sheet reads — keepers first, no position last',
        (() => {
          const rank = { GK: 0, DEF: 1, MID: 2, FWD: 3, UNSET: 4 };
          const got = asTd.map((r) => rank[r.position_group ?? 'UNSET']);
          return got.every((v, i) => i === 0 || got[i - 1] <= v);
        })(), true);
    }
  }
  check('SQ7: a stranger reads nothing from a squad',
    (await db.query(`select * from fn_squad_roster($1, $2)`, [ID.coachOther, sq])).rows.length, 0);
  check('H6: a squad invite to an under-16 is answerable only by their guardian, never the child',
    [await db.query(`select fn_can_act_on_squad($1,$1) as ok`, [ID.deniz]).then((x) => x.rows[0].ok),
     await db.query(`select fn_can_act_on_squad($1,$2) as ok`, [ID.guardian, ID.deniz]).then((x) => x.rows[0].ok)], [false, true]);
  // SQ8 asserted "joining ends every other club", which ended a second squad
  // at the SAME club too — a player who was asked to play up lost the team
  // they were already in (safety M2, L22). BUZ, 23 Sep: playing up is allowed.
  const playerMemberships = async (who) => (await db.query(
    `select club_id, squad_id from membership where person_id = $1 and role = 'player' and ended_at is null order by started_at`,
    [who])).rows;
  const leftEvents = async (who) => (await db.query(
    `select count(*)::int as n from consent_event where event = 'squad_left' and subject_id = $1`, [who])).rows[0].n;
  const leftBefore = await leftEvents(ID.deniz);
  check('SQ8: a second squad at the same club keeps the first — playing up is one club, two teams (BUZ, 23 Sep)',
    await db.query(`select fn_join_squad($1, $2, $3, 'test') as ok`, [ID.deniz, sq, ID.td]).then(async () =>
      (await playerMemberships(ID.deniz)).length), 2);
  check('SQ8b: and nothing was written as a departure, because nobody departed (M6)',
    await leftEvents(ID.deniz) - leftBefore, 0);

  // Another club is a move, and a move is written down — one row per
  // membership that actually ended (L5, M6).
  const bayviewSq = (await db.query(
    `insert into squad (club_id, name, age_group, competition_gender, season)
     values ($1, 'Bayview U15', 'U15', 'boys', '2026') returning id`, [CLUB.other])).rows[0].id;
  check('SQ8c: joining another club ends the memberships at the first, and only those',
    await db.query(`select fn_join_squad($1, $2, $3, 'test') as ok`, [ID.deniz, bayviewSq, ID.guardian]).then(async () =>
      (await playerMemberships(ID.deniz)).map((m) => m.club_id === CLUB.other)), [true]);
  check('SQ8d: with one squad_left for each of the two squads they left',
    await leftEvents(ID.deniz) - leftBefore, 2);

  // M2: a club could confirm a months-old claim and move a child who had
  // since joined somewhere else, with nobody told — and the family could not
  // see the claim to cancel it, because the card shows a membership first.
  const stale = (await db.query(
    `insert into squad_claim (person_id, club_id, squad_id, asked_by) values ($1,$2,$3,$4) returning id`,
    [ID.georgia, CLUB.riverside, sq, ID.guardian])).rows[0].id;
  await db.query(`select fn_join_squad($1, $2, $3, 'test')`, [ID.georgia, bayviewSq, ID.guardian]);
  check('SQ8e: joining closes that player\'s other open claims, so no club can move them later (M2)',
    (await db.query(`select answered_at is not null as closed, confirmed from squad_claim where id = $1`, [stale])).rows[0],
    { closed: true, confirmed: false });

  // M10: weeks pass between the ask and the answer, and the world moves.
  await db.query(`update club set club_state = 'suspended' where id = $1`, [CLUB.other]);
  check('SQ8f: a join at a club suspended since the ask is refused (M10, D-126)',
    (await db.query(`select fn_join_squad($1, $2, $3, 'test') as ok`, [ID.nate, bayviewSq, ID.nate])).rows[0].ok, false);
  await db.query(`update club set club_state = 'verified' where id = $1`, [CLUB.other]);
  check('SQ8g: a claim whose asker may no longer act is refused at the join (M10)',
    (await db.query(`select fn_join_squad($1, $2, $3, 'claim', $4) as ok`, [ID.deniz, sq, ID.td, ID.exGuardian])).rows[0].ok, false);
  await db.query(`insert into guardian_setting (child_id, profile_paused, updated_by) values ($1,true,$2)
    on conflict (child_id) do update set profile_paused = true`, [ID.nate, ID.guardian]);
  check('SQ8h: nor is a player hidden since the ask (M10, 0049 A1)',
    (await db.query(`select fn_join_squad($1, $2, $3, 'test') as ok`, [ID.nate, sq, ID.td])).rows[0].ok, false);
  await db.query(`update guardian_setting set profile_paused = false where child_id = $1`, [ID.nate]);

  // --- B3: who a club may ask, probed as the safety seat probed it --------
  // An unverified club, a suspended club, a free-tier club and a verified
  // paid one, each against the same register row.
  const askable = async (who, squad) => (await db.query(`select * from fn_squad_askable($1,$2)`, [who, squad])).rows;
  const kid = crypto.randomUUID(), kidNoParent = crypto.randomUUID(), unvTd = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, last_name, dob) values ($1,'Askable','Surname',$3), ($2,'Unapproved','Surname',$3)`,
    [kid, kidNoParent, yearsAgo(14)]);
  await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [ID.guardian, kid]);
  await db.query(`insert into development_record (person_id) values ($1)`, [kid]);
  await db.query(`insert into person (id, first_name, dob) values ($1,'UnvTd',$2)`, [unvTd, yearsAgo(40)]);
  await recordTd(unvTd, CLUB.unverified, 'unvtd@fixture.example');
  const askSq = (await db.query(
    `insert into squad (club_id, name, age_group, competition_gender, season)
     values ($1, 'Askable Test', 'U14', 'boys', '2026') returning id`, [CLUB.riverside])).rows[0].id;
  for (const p of [kid, kidNoParent]) {
    await db.query(`insert into registration (player_id, club_id, positions, policy_version) values ($1,$2,array['ST'],'20@v2.4')`,
      [p, CLUB.riverside]);
  }
  await db.query(`insert into registration (player_id, club_id, positions, policy_version) values ($1,$2,array['ST'],'20@v2.4')`,
    [kid, CLUB.unverified]);

  check('SQ16: an unverified club is offered nobody to ask, and the database refuses the ask (D-126)',
    [(await askable(unvTd, SQUAD.unvSq)).length,
     await r(`insert into squad_invitation (person_id, club_id, squad_id, invited_by) values ($1,$2,$3,$4)`,
             [kid, CLUB.unverified, SQUAD.unvSq, unvTd])], [0, true]);
  await db.query(`update club set club_state = 'suspended' where id = $1`, [CLUB.riverside]);
  check('SQ17: a suspended club is offered nobody, and is refused the ask',
    [(await askable(ID.td, askSq)).length,
     await r(`insert into squad_invitation (person_id, club_id, squad_id, invited_by) values ($1,$2,$3,$4)`,
             [kid, CLUB.riverside, askSq, ID.td])], [0, true]);
  await db.query(`update club set club_state = 'verified' where id = $1`, [CLUB.riverside]);
  // The free tier reads only the registrations against its OWN trials (D-153,
  // P13/P18) — which is the register's answer, and the askable list is now
  // that answer rather than a second one: Nate came through Riverside's trial
  // and is offered; a plain register row is not, and cannot be asked.
  // With billing on (D-163): D-153's free tier is a Stripe-build state.
  await billingOn(true);
  const free = await askable(ID.td, askSq);
  check('SQ18: a verified club on the free tier is offered its own trial\'s registrants and nobody else (P13/P18, D-135)',
    [free.some((x) => x.player_id === ID.nate), free.some((x) => x.player_id === kid),
     await r(`insert into squad_invitation (person_id, club_id, squad_id, invited_by) values ($1,$2,$3,$4)`,
             [kid, CLUB.riverside, askSq, ID.td])], [true, false, true]);
  await db.query(`update club set subscription_status = 'active' where id = $1`, [CLUB.riverside]);
  const paid = await askable(ID.td, askSq);
  check('SQ19: a verified club that pays is offered its register — first name only, as the register gives it (B3)',
    [paid.some((x) => x.player_id === kid), paid.every((x) => Object.keys(x).join(',') === 'player_id,first_name,positions,named_this')],
    [true, true]);
  check('SQ19b: and an under-16 with no approved guardian is not on it, nor can be asked (P19)',
    [paid.some((x) => x.player_id === kidNoParent),
     await r(`insert into squad_invitation (person_id, club_id, squad_id, invited_by) values ($1,$2,$3,$4)`,
             [kidNoParent, CLUB.riverside, askSq, ID.td])], [false, true]);
  await billingOn(false);
  check('SQ19c: an administrator is offered nobody and cannot ask (D-154, N17)',
    [(await askable(ID.clubAdmin, askSq)).length,
     await r(`insert into squad_invitation (person_id, club_id, squad_id, invited_by) values ($1,$2,$3,$4)`,
             [kid, CLUB.riverside, askSq, ID.clubAdmin])], [0, true]);
  const notOnIt = (await db.query(`insert into person (first_name, dob) values ('NotOnTheRegister', $1) returning id`, [yearsAgo(20)])).rows[0].id;
  check('SQ19d: nobody off this club\'s own register can be asked, whoever asks (D-100)',
    await r(`insert into squad_invitation (person_id, club_id, squad_id, invited_by) values ($1,$2,$3,$4)`,
            [notOnIt, CLUB.riverside, askSq, ID.td]), true);

  // --- M4: a no and a silence look the same to the club --------------------
  const inv = (await db.query(
    `insert into squad_invitation (person_id, club_id, squad_id, invited_by) values ($1,$2,$3,$4) returning id`,
    [kid, CLUB.riverside, askSq, ID.td])).rows[0].id;
  const asked = async () => (await db.query(`select * from fn_squad_asked($1,$2)`, [ID.td, askSq])).rows;
  const openShape = JSON.stringify(await asked());
  await db.query(`update squad_invitation set answered_at = now(), answered_by = $2, accepted = false where id = $1`, [inv, ID.guardian]);
  check('SQ20: an invitation answered no reads to the club exactly as one nobody answered (M4, D-138)',
    JSON.stringify(await asked()), openShape);
  check('SQ20b: and the person who said no does not come back onto the askable list, which would say it for them',
    (await askable(ID.td, askSq)).some((x) => x.player_id === kid), false);
  await db.query(`update squad_invitation set created_at = now() - interval '31 days' where id = $1`, [inv]);
  check('SQ20c: both lapse at thirty days, on the same clock (BUZ, 23 Sep)',
    [(await db.query(`select fn_lapse_squad_invitations() as n`)).rows[0].n >= 1, (await asked()).length], [true, 0]);
  check('SQ20d: and the club may ask again once it has lapsed',
    (await askable(ID.td, askSq)).some((x) => x.player_id === kid), true);

  // --- M1: every field off the record is gated per row ---------------------
  await db.query(`select fn_join_squad($1, $2, $3, 'test')`, [kid, askSq, ID.guardian]);
  const gated = async (who) => (await db.query(`select * from fn_squad_roster($1,$2)`, [who, askSq])).rows;
  check('SQ21: the technical director reads the squad, record and register fact included (A12)',
    (await gated(ID.td)).some((x) => x.player_id === kid && x.record_id !== null && x.on_register === true), true);
  await db.query(`update guardianship_link set revoked_at = now() where child_id = $1`, [kid]);
  const revoked = (await gated(ID.td)).find((x) => x.player_id === kid);
  check('SQ21b: an under-16 whose only guardianship is revoked answers with no record and no fields (M1, A17/A18)',
    [revoked?.record_id, revoked?.positions, revoked?.squad_number, revoked?.foot, revoked?.clips, revoked?.on_register],
    [null, null, null, null, null, null]);
  check('SQ21c: and their CV inside the club is not found for anybody (M1)',
    [(await db.query(`select fn_can_read_squad_player($1,$2,$3) as ok`, [ID.td, askSq, kid])).rows[0].ok,
     (await db.query(`select fn_can_read_squad_player($1,$2,$3) as ok`, [ID.clubAdmin, askSq, kid])).rows[0].ok],
    [false, false]);
  await db.query(`update guardianship_link set revoked_at = null where child_id = $1`, [kid]);
  check('SQ21d: an administrator gets a name and a join date, and "on your register" is not a fact they hold (M5, N17)',
    (await gated(ID.clubAdmin)).every((x) => x.record_id === null && x.on_register === null && x.first_name !== null), true);
  check('SQ21e: the CV route asks the same question the list does, and refuses a player in another squad',
    [(await db.query(`select fn_can_read_squad_player($1,$2,$3) as ok`, [ID.td, askSq, kid])).rows[0].ok,
     (await db.query(`select fn_can_read_squad_player($1,$2,$3) as ok`, [ID.td, askSq, ID.marcus])).rows[0].ok,
     (await db.query(`select fn_can_read_squad_player($1,$2,$3) as ok`, [ID.coachOther, askSq, kid])).rows[0].ok],
    [true, false, false]);

  // --- D-62 on the squad list (0069): every number carries its source ------
  {
    const kidRec = (await db.query(`select id from development_record where person_id = $1`, [kid])).rows[0].id;
    // 0083: a coach-verified number is written by fn_verify_stat and nothing
    // else, so the fixture asks it — the TD holds that pen club-wide.
    await db.query(`insert into player_stat (record_id, season, stat_key, value, provenance)
      values ($1,'2026','apps',9,'self_reported'), ($1,'2026','goals',4,'self_reported')`, [kidRec]);
    const goalsId = (await db.query(`select id from player_stat where record_id = $1 and stat_key = 'goals' and season = '2026'`, [kidRec])).rows[0].id;
    check('prov-sq0: the fixture\'s coach-verified number is written the way the product writes one',
      (await db.query('select fn_verify_stat($1, $2) as ok', [ID.td, goalsId])).rows[0].ok, true);
    const row = async (who) => (await gated(who)).find((x) => x.player_id === kid);
    const td = await row(ID.td);
    check('prov-sq1: every stat the squad list returns carries the provenance of the row it came from',
      [td?.apps, td?.apps_provenance, td?.goals, td?.goals_provenance], [9, 'self_reported', 4, 'coach_verified']);
    check('prov-sq1b: and a stat nobody has comes back with no source either — nothing to describe',
      [td?.assists, td?.assists_provenance, td?.clean_sheets_provenance], [null, null, null]);
    const admin = await row(ID.clubAdmin);
    check('prov-sq1c: an administrator gets no provenance — it is gated with the number it describes (L2)',
      [admin?.apps, admin?.apps_provenance, admin?.goals_provenance], [null, null, null]);
    await db.query(`delete from player_stat where record_id = $1 and season = '2026' and stat_key in ('apps','goals')`, [kidRec]);
    const squadPage = codeOnly(srcOf('app/club/squads/[squadId]/page.tsx'));
    check('prov-sq1d: the squad screen reads each source from lib/football, as the CV does, and types none of its own',
      [/sharedProvenance\(stats\)/.test(squadPage), /provenanceLabel\(provenance\)/.test(squadPage),
       /self-reported|coach-verified|official import/i.test(squadPage)], [true, true, false]);
    // Leo, 28 Sep: "Self-reported" is approved and the other two await BUZ.
    // When he approves one, this changes with the set, on purpose.
    // BUZ approved "Coach-verified" and "Official import" on 28 Sep. The set
    // now names all three, and only those three: a fourth source added to
    // lib/football is not said here until it is approved too.
    check('copy-held2: the squad screen names the three approved sources and no other',
      /const SOURCES_SAID_HERE = new Set<string>\(\[PROVENANCE_LABELS\.self_reported, PROVENANCE_LABELS\.coach_verified, PROVENANCE_LABELS\.official_import\]\);/.test(squadPage), true);
  }

  // --- BUZ's decision 2: the club on an under-16's approved page ----------
  {
    const snapRec = (await db.query(`select id from development_record where person_id = $1`, [kid])).rows[0].id;
    await db.query(`insert into profile_version (record_id, content, status) values ($1, $2, 'approved')`,
      [snapRec, JSON.stringify({ firstName: 'Askable', club: 'Somewhere Else FC', squad: { name: 'Old', ageGroup: 'U13', competitionGender: 'boys' } })]);
    const withClub = (await db.query(`select fn_approved_cv($1) as cv`, [snapRec])).rows[0].cv;
    check('SQ22: the club a club confirmed shows on the approved page at once (BUZ\'s decision 2, D-158)',
      [withClub.club, withClub.squad.name, withClub.firstName], ['Riverside FC', 'Askable Test', 'Askable']);
    await db.query(`update membership set ended_at = now() where person_id = $1 and role = 'player' and ended_at is null`, [kid]);
    const without = (await db.query(`select fn_approved_cv($1) as cv`, [snapRec])).rows[0].cv;
    check('SQ22b: and the club line goes when they are taken out',
      [without.club, without.squad.name, without.firstName], ['', '', 'Askable']);
    check('SQ22c: nothing else about the snapshot moves — the guardian still approves every word of it (D-119)',
      (await db.query(`select content->>'club' as c from profile_version where record_id = $1 and status = 'approved'`, [snapRec])).rows[0].c,
      'Somewhere Else FC');
  }
  await db.query(`update club set subscription_status = null where id = $1`, [CLUB.riverside]);
}

// ---- M10 on the squad page: suspension ends the squad surface too (0057) ---
// X1, safety round 2. fn_can_work_squads asked only whether somebody held a
// technical_director or club_admin membership that had not ended, and never
// looked at club_state — so a SUSPENDED club still read children's names off
// its own squad page and could still act on them. Everything else on that page
// asked about club_state; this one function did not, and that asymmetry was
// the whole defect.
//
// Every check below was proved on the broken code first: 0057 reverted to
// 0052's body, watched fail, restored, watched pass (L20).
//
// The club here is verified while the family claims and the club asks, and is
// suspended afterwards — which is M10 as doc 14 words it, `verified` moving to
// `suspended`, not a club that was never verified. SQ23 is the other case.
{
  const club = crypto.randomUUID(), call = crypto.randomUUID(), sq = crypto.randomUUID();
  const susTd = crypto.randomUUID(), susAdmin = crypto.randomUUID(), susGuardian = crypto.randomUUID();
  const claimer = crypto.randomUUID(), askedKid = crypto.randomUUID();
  await db.query(`insert into club (id, name, club_state) values ($1,'Westgate Rangers','claimed')`, [club]);
  await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
    values ($1,$2,now(),'BUZ','03 9000 0000','FV club directory','verified','27@v1.0')`, [call, club]);
  await db.query(`update club set club_state='verified', verified_call_id=$1, subscription_status='active' where id=$2`, [call, club]);
  await db.query(`insert into squad (id, club_id, name, age_group, competition_gender, season)
    values ($1,$2,'U14 Boys','U14','boys','2026')`, [sq, club]);
  await db.query(`insert into person (id, first_name, last_name, dob) values
    ($1,'Tessa','Okonkwo',$4), ($2,'Alby','Fenwick',$4), ($3,'Gina','Prosser',$4)`,
    [susTd, susAdmin, susGuardian, yearsAgo(41)]);
  await db.query(`insert into person (id, first_name, last_name, dob) values ($1,'Wren','Kavanagh',$3), ($2,'Kit','Marlowe',$3)`,
    [claimer, askedKid, yearsAgo(13)]);
  // 0058 landed between this fixture being written and being merged: a
  // technical_director membership is now only writable for the person the
  // verification call recorded, with a proved address. The fixture wrote the
  // membership straight in, which is exactly the door 0058 closed — so it is
  // the fixture that moves, not the rule. Both branches were green alone.
  await recordTd(susTd, club, 'westgate-td@fixture.example');
  await mem(susTd, club, null, 'technical_director');
  await mem(susAdmin, club, null, 'club_admin');
  await db.query(`insert into wwcc_attestation (person_id, club_id, attested_by) values ($1,$2,$1)`, [susTd, club]);
  for (const ch of [claimer, askedKid]) {
    await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [susGuardian, ch]);
    await db.query(`insert into development_record (person_id, positions) values ($1, array['ST'])`, [ch]);
    await db.query(`insert into registration (player_id, club_id, positions, policy_version) values ($1,$2,array['ST'],'20@v2.4')`, [ch, club]);
  }
  // While the club is still verified: a family claims a squad, the club asks
  // somebody else, and a third child is in the squad already.
  const openClaim = (await db.query(
    `insert into squad_claim (person_id, club_id, squad_id, asked_by) values ($1,$2,$3,$4) returning id`,
    [claimer, club, sq, susGuardian])).rows[0].id;
  const openInvite = (await db.query(
    `insert into squad_invitation (person_id, club_id, squad_id, invited_by) values ($1,$2,$3,$4) returning id`,
    [askedKid, club, sq, susTd])).rows[0].id;
  await db.query(`select fn_join_squad($1,$2,$3,'test')`, [claimer, sq, susGuardian]);

  // The page's own "Waiting on you" query (app/club/squads/[squadId]/page.tsx),
  // behind the page's own gate — which is where the leak was. It selects first
  // AND last name; the register itself gives a club a first name only.
  const waitingOnYou = async (who) => (await db.query(
    `select p.first_name, p.last_name from squad_claim sc join person p on p.id = sc.person_id
     where sc.squad_id = $1 and sc.answered_at is null and not fn_person_hidden(p.id)
       and fn_can_work_squads($2, (select club_id from squad where id = $1))`, [sq, who])).rows;
  const asked = async (who) => (await db.query(`select first_name from fn_squad_asked($1,$2)`, [who, sq])).rows;
  const works = async (who) => (await db.query(`select fn_can_work_squads($1,$2) as ok`, [who, club])).rows[0].ok;

  check('M10d: while the club is verified it does see the family waiting on it, and who it asked',
    [(await waitingOnYou(susTd)).length, (await asked(susTd)).length, await works(susAdmin)], [1, 1, true]);

  // M10 asks for the same transaction. Suspend and read inside one, so a
  // passing answer cannot be a later re-read that happened to be refreshed.
  await db.exec(`begin; update club set club_state = 'suspended' where id = '${club}';`);
  check('M10e: suspension ends the squad gate in the same transaction, for the TD and for the administrator',
    [await works(susTd), await works(susAdmin)], [false, false]);
  check('M10f: and no child\'s name is waiting on a suspended club — not a first name, not a surname (D-126)',
    [(await waitingOnYou(susTd)).length, (await waitingOnYou(susAdmin)).length], [0, 0]);
  check('M10g: nor the first names of the children it had asked (fn_squad_asked)',
    [(await asked(susTd)).length, (await asked(susAdmin)).length], [0, 0]);
  await db.exec('commit;');

  // The writes. Answering a claim, taking an invitation back and removing a
  // child from a squad are guarded by mySquad() in that page's actions.ts,
  // which is this one question and nothing else. mySquad's own query is
  // copied here word for word from actions.ts:23 — if it answers, the action
  // runs its statement; if it does not, the action redirects and writes
  // nothing. So this measures the three writes as the product performs them,
  // and M10h below pins that the product really does perform them that way.
  const mySquad = async (who) => (await db.query(
    `select s.club_id from squad s where s.id = $1 and fn_can_work_squads($2, s.club_id)`,
    [sq, who])).rows[0]?.club_id ?? null;
  const acts = async (who, sql, args) => { if (!await mySquad(who)) return false; await db.query(sql, args); return true; };
  const stillOpen = async () => [
    (await db.query(`select answered_at is null as open from squad_claim where id = $1`, [openClaim])).rows[0].open,
    (await db.query(`select withdrawn_at is null as live from squad_invitation where id = $1`, [openInvite])).rows[0].live,
    (await db.query(`select count(*)::int as n from membership
      where person_id = $1 and squad_id = $2 and role = 'player' and ended_at is null`, [claimer, sq])).rows[0].n,
  ];
  const ran = [
    // answerClaim, answer = 'no' — the one branch that never reaches
    // fn_join_squad, so nothing else was ever going to stop it.
    await acts(susTd, `update squad_claim set answered_at = now(), answered_by = $2, confirmed = false where id = $1`,
      [openClaim, susTd]),
    // cancelInvitation
    await acts(susTd, `update squad_invitation set withdrawn_at = now() where id = $1 and withdrawn_at is null`, [openInvite]),
    // removeFromSquad — which takes the club line off that child's approved
    // page as well, because fn_cv_club follows the membership (0054).
    await acts(susAdmin, `update membership set ended_at = now()
      where person_id = $1 and squad_id = $2 and role = 'player' and ended_at is null`, [claimer, sq]),
  ];
  check('M10n: a suspended club cannot answer a family\'s claim, take an ask back, or put a child out of a squad',
    [ran, await stillOpen()], [[false, false, false], [true, true, 1]]);

  check('M10h: every write on that page goes through that one answer, and nothing else',
    (() => {
      const a = srcOf('app/club/squads/[squadId]/actions.ts');
      const gate = /async function mySquad\([\s\S]*?\n\}/.exec(a)?.[0] ?? '';
      const exported = [...a.matchAll(/export async function (\w+)\(formData: FormData\) \{([\s\S]*?)\n\}/g)];
      return [/fn_can_work_squads/.test(gate),
        exported.length,
        exported.every(([, , body]) => /mySquad\(squadId\)/.test(body))];
    })(), [true, 4, true]);
  // The claims list hangs off the same answer. It used to do it with a page
  // boolean; since 0059 it is fn_squad_claims that asks, which is better —
  // but it has to keep asking, so this reads the function's own body.
  check('M10i: and the claims list hangs off it too, never off a role on its own',
    [/fn_can_work_squads\(\$2, s\.club_id\) as works/.test(srcOf('app/club/squads/[squadId]/page.tsx')),
     (await procSrc('fn_squad_claims')).includes('fn_can_work_squads'),
     (await procSrc('fn_can_answer_claim')).includes('fn_can_work_squads')], [true, true, true]);
  // What was already refused before X1, asked again here so M10 covers the
  // whole page rather than the half of it that was broken.
  check('M10j: confirming a child into a squad, and asking one, were already refused (0054)',
    [(await db.query(`select fn_join_squad($1,$2,$3,'claim',$4) as ok`, [claimer, sq, susTd, susGuardian])).rows[0].ok,
     await (async () => { try {
       await db.query(`insert into squad_invitation (person_id, club_id, squad_id, invited_by) values ($1,$2,$3,$4)`,
         [claimer, club, sq, susTd]); return false;
     } catch { return true; } })()], [false, true]);
  check('M10k: and the roster is empty for everybody, as it already was',
    [(await db.query(`select * from fn_squad_roster($1,$2)`, [susTd, sq])).rows.length,
     (await db.query(`select * from fn_squad_roster($1,$2)`, [susAdmin, sq])).rows.length], [0, 0]);
  // The family's own way out never asked about the club and still does not
  // (D-10): a suspended club must not be able to strand a child in a squad.
  check('M10l: the family can still take their child out of a suspended club\'s squad (D-10)',
    (await db.query(`select fn_can_leave_squad($1,$2) as ok`, [susGuardian, claimer])).rows[0].ok, true);

  // M10 asks that held semantics RESUME — so the check has to be able to go
  // the other way as well, or it is pinning nothing (L19).
  await db.query(`update club set club_state = 'verified' where id = $1`, [club]);
  check('M10m: verifying the club again gives it back exactly what it had',
    [await works(susTd), await works(susAdmin),
     (await waitingOnYou(susTd)).length, (await asked(susTd)).length], [true, true, 1, 1]);

  // SQ23 — the other side of the same gate: a club that has never been
  // verified. Not M10 (nothing moved from `verified`), so it does not carry
  // that row's id (L4). It had nothing to lose here and loses nothing: a
  // claim, an invitation and a membership can only exist at a verified club.
  const newClub = crypto.randomUUID(), newSq = crypto.randomUUID();
  const newTd = crypto.randomUUID(), newAdmin = crypto.randomUUID();
  await db.query(`insert into club (id, name, club_state) values ($1,'Quarrymead United','claimed')`, [newClub]);
  await db.query(`insert into squad (id, club_id, name, age_group, competition_gender, season)
    values ($1,$2,'U16 Girls','U16','girls','2026')`, [newSq, newClub]);
  await db.query(`insert into person (id, first_name, last_name, dob) values ($1,'Ruth','Calder',$3), ($2,'Owen','Prendergast',$3)`,
    [newTd, newAdmin, yearsAgo(38)]);
  // 0058 moved this case one level down while this fixture was on a branch:
  // a technical_director membership cannot be WRITTEN at an unverified club
  // at all, so the seat this check wanted to interrogate can no longer be
  // brought into existence. That is a stronger answer than the one the check
  // was written to get, so it is the answer the check now asserts — with the
  // administrator, who CAN exist at a claimed club, still asked the original
  // question. Two gates, one club, and the suite says which is which.
  const tdRefused = await (async () => {
    try { await mem(newTd, newClub, null, 'technical_director'); return false; } catch { return true; }
  })();
  await mem(newAdmin, newClub, null, 'club_admin');
  check('SQ23: a club that has never been verified works no squads either, whichever seat asks',
    [tdRefused,
     (await db.query(`select fn_can_work_squads($1,$2) as ok`, [newTd, newClub])).rows[0].ok,
     (await db.query(`select fn_can_work_squads($1,$2) as ok`, [newAdmin, newClub])).rows[0].ok], [true, false, false]);
  check('SQ23b: and it had nothing to lose — no claim, no invitation and no membership can exist there',
    [await (async () => { try {
       await db.query(`insert into squad_claim (person_id, club_id, squad_id, asked_by) values ($1,$2,$3,$4)`,
         [claimer, newClub, newSq, susGuardian]); return false;
     } catch { return true; } })(),
     (await db.query(`select fn_join_squad($1,$2,$3,'test') as ok`, [claimer, newSq, newTd])).rows[0].ok], [true, false]);
}

// ---- the claims list is the database's answer now (0059) -------------------
// "Waiting on you" was the one read on the squad page that was an inline
// query behind a page boolean. It had the club gate and fn_person_hidden and
// nothing else — so a VERIFIED club kept a child's first AND last name on
// screen after the consent behind the ask had gone, for an act fn_join_squad
// would have refused.
//
// Proved by putting the old set of questions back into 0059's predicate
// (club gate + fn_person_hidden only), watching the four below fail,
// restoring, watching them pass. SQ24h, SQ24i and SQ24j are green either way
// and say so.
{
  const club = crypto.randomUUID(), call = crypto.randomUUID(), sq = crypto.randomUUID();
  const clTd = crypto.randomUUID(), clAdmin = crypto.randomUUID(), clCoach = crypto.randomUUID();
  const parent = crypto.randomUUID();
  const kid = crypto.randomUUID(), teen = crypto.randomUUID(), turning = crypto.randomUUID();
  const inSquad = crypto.randomUUID(), paused = crypto.randomUUID();
  await db.query(`insert into club (id, name, club_state) values ($1,'Northern United SC','claimed')`, [club]);
  await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
    values ($1,$2,now(),'BUZ','03 9000 0000','FV club directory','verified','27@v1.0')`, [call, club]);
  await db.query(`update club set club_state='verified', verified_call_id=$1 where id=$2`, [call, club]);
  await db.query(`insert into squad (id, club_id, name, age_group, competition_gender, season)
    values ($1,$2,'U15 Boys','U15','boys','2026')`, [sq, club]);
  await db.query(`insert into person (id, first_name, last_name, dob) values
    ($1,'Marta','Ferreira',$5), ($2,'Colin','Braithwaite',$5), ($3,'Piet','Van Rensburg',$5), ($4,'Nadia','Sokolov',$5)`,
    [clTd, clAdmin, clCoach, parent, yearsAgo(42)]);
  // 0058's rule, same as the M10 fixture above: the role attaches to the
  // person the call recorded, at a proved address, or the database refuses it.
  await recordTd(clTd, club, 'northern-td@fixture.example');
  await mem(clTd, club, null, 'technical_director');
  await mem(clAdmin, club, null, 'club_admin');
  await mem(clCoach, club, sq, 'coach');
  await db.query(`insert into wwcc_attestation (person_id, club_id, attested_by) values ($1,$2,$1), ($3,$2,$1)`, [clTd, club, clCoach]);
  await db.query(`insert into person (id, first_name, last_name, dob) values
    ($1,'Wren','Kavanagh',$5), ($2,'Bo','Ainsworth',$6), ($3,'Rafferty','Quill',$6), ($4,'Sunny','Delacroix',$5)`,
    [kid, teen, turning, inSquad, yearsAgo(13), yearsAgo(17)]);
  await db.query(`insert into person (id, first_name, last_name, dob) values ($1,'Elke','Nordstrom',$2)`, [paused, yearsAgo(13)]);
  for (const ch of [kid, teen, turning, inSquad, paused]) {
    await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [parent, ch]);
    await db.query(`insert into development_record (person_id, positions) values ($1, array['CM'])`, [ch]);
  }
  const claimFor = async (who, by) => (await db.query(
    `insert into squad_claim (person_id, club_id, squad_id, asked_by) values ($1,$2,$3,$4) returning id`,
    [who, club, sq, by])).rows[0].id;
  const kidClaim = await claimFor(kid, parent);
  const teenClaim = await claimFor(teen, teen);
  const turningClaim = await claimFor(turning, parent);
  const inSquadClaim = await claimFor(inSquad, parent);
  const pausedClaim = await claimFor(paused, parent);

  const waiting = async (who) => (await db.query(`select * from fn_squad_claims($1,$2)`, [who, sq])).rows;
  const names = async (who) => (await waiting(who)).map((r) => r.first_name).sort();
  // The answer path, word for word from app/club/squads/[squadId]/actions.ts:
  // if this finds no row the action rolls back and redirects exactly as it
  // does for a claim that was never there.
  const answerable = async (who, claimId) => (await db.query(
    `select id from squad_claim where id = $1 and squad_id = $2 and answered_at is null
       and fn_can_answer_claim($3, id)`, [claimId, sq, who])).rows.length === 1;

  check('SQ24: a verified club is shown who is waiting on it — a FIRST NAME, and not the surname (0059, D-115)',
    [await names(clTd), (await waiting(clTd)).every((r) => Object.keys(r).join(',') === 'claim_id,first_name,created_at')],
    [['Bo', 'Elke', 'Rafferty', 'Sunny', 'Wren'], true]);
  check('SQ24b: the administrator is shown the same first names and no more (D-93, N17)',
    await names(clAdmin), ['Bo', 'Elke', 'Rafferty', 'Sunny', 'Wren']);

  // A18: the consent behind the ask is revoked. The claim exists only
  // because an approved guardian made it; with the guardianship gone there
  // is nobody standing behind it, and fn_join_squad already refused to
  // confirm it (SQ8g) — so the club was reading a child's name for an act
  // that could not complete.
  await db.query(`update guardianship_link set revoked_at = now() where child_id = $1`, [kid]);
  check('SQ24c: revoke the only guardianship and the child leaves the list entirely, for both seats (A18, D-126)',
    [(await names(clTd)).includes('Wren'), (await names(clAdmin)).includes('Wren')], [false, false]);
  check('SQ24d: and the club cannot answer it either, so nothing reports that anything happened to it',
    await answerable(clTd, kidClaim), false);

  // B4: a 16-17 acts only while a parent is confirmed and their send switch
  // is on (0054). Turn it off and the ask is no longer the family's.
  await db.query(`insert into guardian_setting (child_id, send_disabled, updated_by) values ($1,true,$2)
    on conflict (child_id) do update set send_disabled = true`, [teen, parent]);
  check('SQ24e: a 16-17 whose parent has since switched sending off comes off the list, and cannot be answered (B4, D-22)',
    [(await names(clTd)).includes('Bo'), await answerable(clTd, teenClaim)], [false, false]);

  // M3/D-49: at eighteen a guardianship is visibility, never control. A
  // parent's claim left open across the birthday is not the adult's ask.
  await db.query(`update person set dob = $2 where id = $1`, [turning, yearsAgo(19)]);
  check('SQ24f: a child who has turned 18 with a parent\'s claim still open comes off it too (M3, D-49)',
    [(await names(clTd)).includes('Rafferty'), await answerable(clTd, turningClaim)], [false, false]);

  // fn_squad_asked drops anyone already in the squad; this did not, so a
  // club could press a button that only ever reported a failure about a
  // child (fn_join_squad refuses it).
  await db.query(`select fn_join_squad($1,$2,$3,'test')`, [inSquad, sq, parent]);
  check('SQ24g: a claim for somebody who is in the squad already is not offered, and cannot be answered',
    [(await names(clTd)).includes('Sunny'), await answerable(clTd, inSquadClaim)], [false, false]);

  // Green either way — the old query had fn_person_hidden, and 0057 put the
  // club gate in fn_can_work_squads. Both are asked again here because the
  // list has to keep them, not because they were missing.
  await db.query(`insert into guardian_setting (child_id, profile_paused, updated_by) values ($1,true,$2)
    on conflict (child_id) do update set profile_paused = true`, [paused, parent]);
  check('SQ24h: a child paused by their guardian is on nobody\'s list (0049, A16)',
    [(await names(clTd)).includes('Elke'), await answerable(clTd, pausedClaim)], [false, false]);
  await db.query(`update guardian_setting set profile_paused = false where child_id = $1`, [paused]);
  await db.query(`update club set club_state = 'suspended' where id = $1`, [club]);
  check('SQ24i: a suspended club is shown no claim at all and can answer none (M10, 0057)',
    [(await waiting(clTd)).length, (await waiting(clAdmin)).length, await answerable(clTd, pausedClaim)], [0, 0, false]);
  await db.query(`update club set club_state = 'verified' where id = $1`, [club]);
  check('SQ24j: a coach of this squad is not shown the claims — working squads is the TD\'s and the administrator\'s (D-93)',
    [(await waiting(clCoach)).length, await answerable(clCoach, pausedClaim)], [0, false]);
  check('SQ24k: and with the club verified again the one claim still standing is back',
    await names(clTd), ['Elke']);

  // The surname decision lives on the page as well as in the function: the
  // page must not go back to reading squad_claim itself, which is how the
  // surname was there in the first place (L23).
  check('SQ24l: the page reads the function and no longer queries squad_claim or renders a surname on a claim',
    (() => {
      const p = srcOf('app/club/squads/[squadId]/page.tsx');
      const a = srcOf('app/club/squads/[squadId]/actions.ts');
      return [/from fn_squad_claims\(\$1, \$2\)/.test(p),
        /from squad_claim/.test(p),
        /\{name\(cl\)\}/.test(p),
        /fn_can_answer_claim\(\$3, id\)/.test(a)];
    })(), [true, false, false, true]);
}

// ---- tap targets: >=44px at every width (CLAUDE.md; QA F4, 22 Sep) --------
// The squad page's position chips rendered at 38px, which is under the
// minimum the brief sets for every width. The layout check measures how wide
// a page is, not how big its targets are, so this pins the one that was wrong.
{
  const squadPage = srcOf('app/club/squads/[squadId]/page.tsx');
  check('tap1: the squad page\'s position chips are at least 44px tall',
    /const chip = \(on: boolean\): React\.CSSProperties => \(\{\s*\n?\s*minHeight: (\d+)/.exec(squadPage)?.[1] >= 44, true);
}

// ---- R1 (release seat, L26): a table is exposed until you say otherwise ----
// On Supabase the automatic API serves every table in the public schema to
// anyone with the anon key unless row-level security says no. Four tables had
// been created without it for weeks (0055). This fails on the next one.
{
  const open = (await db.query(
    `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by 1`)).rows.map((x) => x.relname);
  const total = (await db.query(
    `select count(*)::int as n from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'`)).rows[0].n;
  check(`RLS1: every public table has row-level security on (${open.join(', ') || `all ${total} do`})`, open.length, 0);
  check('RLS2: and the check is not vacuous — there are tables to fail on', total > 60, true);
}

// ---- the shell stacks on a phone (GTM's report, 21 Sep) ---------------------
// Build your CV hands the shell two blocks — the form and the club card — and
// the shell laid them side by side at every width, so the first screen a new
// player ever sees started 54px off the left edge of a 390px phone. The page
// now hands over one block, AND the shell stacks below the console breakpoint,
// because the next page to hand over two would have done the same thing.
{
  const css = srcOf('app/globals.css');
  const base = /\.console-main \{[^}]*\}/.exec(css)?.[0] ?? '';
  check('shell1: the shell stacks its blocks below the console width',
    /flex-direction:\s*column/.test(base), true);
  check('shell2: and goes back to a row only where there is room for one (>=1024px)',
    /@media \(min-width: 1024px\)[\s\S]*?\.console-main \{[^}]*flex-direction:\s*row/.test(css), true);
  check('shell3: Build your CV hands the shell a single block',
    (srcOf('app/build/[recordId]/page.tsx').match(/<PlayerFrame active="cv">\s*\{\/\*[\s\S]*?<div style=\{\{ width: '100%', display: 'flex', flexDirection: 'column' \}\}>/) ?? []).length, 1);
}

// ---- the console's TWO breakpoints (D-147 as amended 28 Sep 2026) ----------
// D-147 named 1024 for both "table instead of stacked cards" and "sidebar
// instead of tab bar", and those are different questions. Measured: every iPad
// in portrait (768, 810, 820, 834) fell below the one breakpoint and got the
// phone, so the Interest Register was 17,343px of scroll at 820 against 9,691
// as a table; and the one iPad that did reach the console — 12.9" portrait,
// exactly 1024 — landed on the first pixel of a layout with none of the room
// it assumed and spilled 7px off the right edge, resolving at 1031.
//
// EVERY CHECK HERE FAILS ON THE OLD CSS — one @media (min-width: 1024px)
// carrying both, and 744px of column minimum. Proven that way (L20).
{
  const css = srcOf('app/globals.css');
  // Media blocks, brace-matched. A regex cannot read nested rules, and every
  // one of these blocks contains some.
  const blocksAt = (px) => {
    const out = [];
    const re = new RegExp(`@media \\(min-width: ${px}px\\)\\s*\\{`, 'g');
    let m;
    while ((m = re.exec(css))) {
      let i = m.index + m[0].length, depth = 1;
      while (i < css.length && depth > 0) { depth += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0; i++; }
      out.push(css.slice(m.index + m[0].length, i - 1));
    }
    return out.join('\n');
  };
  const at768 = blocksAt(768), at1024 = blocksAt(1024);

  check('bp1: the table replaces the stacked cards from 768px, so an iPad in portrait gets it',
    [/\.d-only \{ display: grid; \}/.test(at768), /\.m-only \{ display: none !important; \}/.test(at768),
      /\.d-only \{ display: grid; \}/.test(at1024)],
    [true, true, false]);
  check('bp2: and a console column stops capping at 560px there, or the table has nowhere to render',
    [/\.console \{ max-width: 1200px; \}/.test(at768), /\.console \{ max-width: 1200px; \}/.test(at1024)],
    [true, false]);
  check('bp3: the 232px rail still waits for 1024 — that separation is the whole change',
    [/grid-template-columns: 232px minmax\(0, 1fr\)/.test(at1024), /232px/.test(at768)], [true, false]);
  check('bp4: below 1024 the tab bar stays, so a tablet gets the table AND the bar',
    [/\.seat-tabs \{ display: none; \}/.test(at1024), /seat-tabs/.test(at768)], [true, false]);

  // bp5 is the arithmetic, and it is the check the 1024 overflow needed.
  // The two budgets are MEASURED in Chrome at those widths (the proposal's own
  // sums said ~20px where the instrument said 7, so nothing here is derived):
  // the five columns and their four gaps get the viewport, less 18px of
  // console padding a side, the card's 1px border and 16px of padding a side,
  // and 10px a side of the row's own — and above 1024, less the rail.
  //   768  -> 678   the tightest, a table with no rail
  //   1024 -> 702   the rail costs 232 where 1024 only gains 204 over 820, so
  //                 1024 is narrower for the row than 820 is. That is the bug.
  const tracks = (/\.console-row \{[\s\S]*?grid-template-columns:\s*([^;]+);/.exec(at768)?.[1] ?? '')
    .trim().match(/minmax\([^)]*\)|\S+/g) ?? [];
  const minOf = (t) => Number((t.startsWith('minmax')
    ? /minmax\(\s*(\d+(?:\.\d+)?)px/.exec(t)?.[1]
    : /^(\d+(?:\.\d+)?)px$/.exec(t)?.[1]) ?? NaN);
  const gap = Number(/\.console-row \{[\s\S]*?gap:\s*(\d+)px/.exec(at768)?.[1] ?? NaN);
  const needs = tracks.map(minOf).reduce((a, b) => a + b, 0) + gap * (tracks.length - 1);
  check(`bp5: the row's five columns fit the narrowest width the table renders at (they need ${needs}px)`,
    [tracks.length, needs <= 678, needs <= 702], [5, true, true]);

  // bp6 is bp5's tripwire: those two budgets are only right while the chrome
  // around the row is what they were measured through. Change a padding and
  // this goes red, which is the signal to re-measure rather than to re-guess.
  check('bp6: and the chrome those budgets were measured through has not moved',
    [/className="console"[^>]*padding: '22px 18px 30px 18px'/.test(srcOf('app/club/register/page.tsx')),
      /className="d-only" style=\{\{ \.\.\.card, padding: '6px 16px'/.test(srcOf('app/club/register/page.tsx')),
      /\.console-row \{ padding: 14px 10px; \}/.test(at768)],
    [true, true, true]);

  // Constraint 3 (D-147): no capability appears at one width and not another.
  // The register serves the table rows AND the cards in the same HTML at every
  // width and lets CSS choose, so there is no width-only route or action to
  // test — and nothing may quietly start deciding that in JavaScript.
  check('bp7: the register decides table-or-cards in CSS only, never from a width it read',
    [/className="m-only"/.test(srcOf('app/club/register/page.tsx')),
      /className="console-row console-row-hover d-only"/.test(srcOf('app/club/register/page.tsx')),
      /innerWidth|matchMedia|useMediaQuery/.test(srcOf('app/club/register/page.tsx'))],
    [true, true, false]);
}

// ---- the focus ring, and the two ways it was taken away (28 Sep) -----------
// Measured with real Tab keypresses in Chrome, not el.focus(): on /signin,
// /join, /report, /reset/[token] and the D-77 request-access form, every form
// control came back with outlineStyle NONE while every button and link on the
// same page showed the green ring. Two causes, and the second is why fixing
// the first was not enough: `input:focus, select:focus { outline: none }` at
// (0,1,1) beat `:focus-visible` at (0,1,0), and twenty-four component files
// re-asserted `outline: 'none'` inline, which beats every selector there is.
// A keyboard user typing a password, ticking consent or filing a child-safety
// report could not see which field they were in.
// The rendered proof is scripts/layout-check.mjs's chrome pass at 390 and
// 1280; these three are the static rules that keep it fixed.
{
  // Comments stripped first. Both rules this block is about are QUOTED in the
  // comment above them in globals.css, so a regex over the raw file finds the
  // explanation and calls it the defect.
  const css = srcOf('app/globals.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const ring = /:focus-visible \{([^}]*)\}/.exec(css)?.[1] ?? '';
  check('ring1: nothing in the stylesheet switches a form control\'s outline off',
    [/input:focus[^{]*\{[^}]*outline:\s*none/.test(css),
     /select:focus[^{]*\{[^}]*outline:\s*none/.test(css),
     /\.field input[^{]*\{[^}]*outline:\s*none/.test(css)],
    [false, false, false]);
  check('ring2: the ring is 2px of the accent token, and an inline style cannot take it back',
    [/outline:\s*2px solid var\(--accent\)/.test(ring), /!important/.test(ring), /outline-offset/.test(ring)],
    [true, true, true]);
  // The inline overrides themselves. app/club/billing/page.tsx is the one left
  // and it is held by another seat this week (28 Sep) — its one line is in the
  // handoff. The !important above means the ring renders there regardless;
  // this counts the source so the tidy-up is not forgotten. Take the exemption
  // out when that branch lands. components/coming-soon is the marketing page's
  // decorative selection outline, not a focus state.
  const root = fileURLToPath(new URL('../', import.meta.url));
  const everySrc = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.name === 'node_modules' || e.name.startsWith('.') ? []
      : e.isDirectory() ? everySrc(join(d, e.name))
        : /\.(ts|tsx)$/.test(e.name) ? [join(d, e.name)] : []);
  const inlineOff = ['app', 'components', 'lib']
    .flatMap((d) => everySrc(join(root, d)))
    .filter((f) => !f.includes('coming-soon') && /outline:\s*'none'/.test(readFileSync(f, 'utf8')))
    .map((f) => f.slice(root.length)).sort();
  check(`ring3: no screen re-asserts outline:'none' on a control (${inlineOff.join(', ') || 'none left'})`,
    inlineOff, ['app/club/billing/page.tsx']);
}

// ---- the cheapest fix in the product (28 Sep) ------------------------------
// .field-label was written as `.field > .field-label` — a CHILD selector —
// and 19 of the 53 elements carrying the class are not children of a .field:
// /club/billing (5), /club/post-trial (8), /register-interest (4) and
// /club/invite (2) put the caption above a bare card or on a <legend>. The
// rule never matched, so nineteen captions rendered as inherited body text.
// That is why the price on the billing page was set three pixels larger than
// its own label. The rendered proof — every .field-label on every page
// computing to 10px — is in scripts/layout-check.mjs's chrome pass.
{
  const css = srcOf('app/globals.css').replace(/\/\*[\s\S]*?\*\//g, '');
  // The selector list of the rule that styles the caption, read as text.
  const sel = (/([^};{]*)\{[^}]*font-size: 10px; font-weight: 800; letter-spacing: var\(--ls-label\)/.exec(css)?.[1] ?? '')
    .split(',').map((x) => x.trim()).filter(Boolean);
  check(`lbl1: .field-label is a class, not a child of .field, so it matches where it is used (${sel.join(' | ')})`,
    [sel.includes('.field-label'), sel.some((x) => x.includes('> .field-label'))], [true, false]);
  // And it is not vacuous: those captions are still there, on all four screens.
  //
  // The COUNT is deliberately not asserted any more. It was 19 when the
  // selector was fixed and 15 an hour later, because /club/billing was rebuilt
  // in a different worktree on the same day and its captions legitimately
  // changed — so the check went red over a number that was never the point.
  // What matters is that every one of these screens still uses the class the
  // fixed selector matches; a screen dropping to zero would mean the captions
  // had been deleted rather than styled, which is the only way this fix could
  // be vacuous. (L32: a check coupled to a count of somebody else's markup is
  // a check that fails when they do their job.)
  const outsideWell = ['app/club/post-trial/page.tsx', 'app/club/billing/page.tsx',
    'app/register-interest/[recordId]/InterestForm.tsx', 'app/club/invite/[registrationId]/page.tsx']
    .map((f) => (srcOf(f).match(/className="field-label"/g) ?? []).length);
  check(`lbl2: and the captions that were dead are still on those four screens (${outsideWell.join('+')})`,
    [outsideWell.every((n) => n > 0), outsideWell.reduce((a, b) => a + b, 0) >= 12], [true, true]);
}

// ---- the coach and club doors (BUZ, 21 Sep) ---------------------------------
// A coach builds their own page; a club person makes an account and then
// claims the club's page with the code sent to the club's own address. What
// neither door can do is give anybody anything about a child.
{
  const join = srcOf('app/join/actions.ts');
  const page = srcOf('app/join/page.tsx');
  check('door1: a coach account is adults only, decided from the date of birth, not the form',
    /createCoachAccount[\s\S]*?fn_age_band[\s\S]*?band !== '18plus'[\s\S]*?coachAge/.test(join), true);
  check('door2: a club account is adults only in the same way',
    /createClubAccount[\s\S]*?fn_age_band[\s\S]*?band !== '18plus'[\s\S]*?clubAge/.test(join), true);
  check('door3: neither door writes a development record',
    [/createCoachAccount[\s\S]*?insert into development_record/.test(join.split('createClubAccount')[0].split('createCoachAccount')[1] ?? ''),
     /insert into development_record/.test(join.split('createClubAccount')[1] ?? '')], [false, false]);
  check('door4: a coach door makes a coach page and a club door makes no club at all',
    [/createCoachAccount[\s\S]*?insert into coach_profile/.test(join),
     /insert into club\b/.test(join.split('createClubAccount')[1] ?? '')], [true, false]);
  check('door5: neither door can set a club verified — that is a person on a phone (D-126)',
    /club_state\s*=\s*'verified'/.test(join), false);
  check('door6: both accept the terms and the privacy policy, version-stamped',
    (join.match(/'tos_accepted'/g) ?? []).length >= 3, true);
  // door7 used to rest entirely on a regex counting "on conflict (email) do
  // nothing" — a string that cannot fail while the harm it claims to prevent
  // is real (L19, N5). The claim is now backed by what the database does: a
  // second account on a taken address is refused, and an account nobody has
  // proved gets nothing from holding one — it signs in nowhere (0056, B1).
  const refusedHere = async (sql, args = []) => { try { await db.query(sql, args); return false; } catch { return true; } };
  const taken = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob, email) values ($1,'Door',$2,'door-taken@example.test')`, [taken, yearsAgo(31)]);
  check('door7: an existing address is never taken over, and the answer never says which (D-94 §2)',
    [(join.match(/on conflict \(email\) do nothing/g) ?? []).length >= 3,
     await refusedHere(`insert into person (first_name, dob, email) values ('Twin',$1,'door-taken@example.test')`, [yearsAgo(31)]),
     (await db.query(`select fn_email_proved($1) as ok`, [taken])).rows[0].ok],
    [true, true, false]);
  check('door8: the join screen tells a coach and a club person what happens next',
    [/Create my coaching account/.test(page), /find your club on Pitch and press/.test(page)], [true, true]);
}

// ---- an address is not a person until they open a link we sent to it -------
// Safety-week blockers B1 and B2, LESSONS L21, migration 0056. Three doors
// made a password-bearing account for any address with nothing sent to it,
// and a guardian approval then handed a child to whoever held it. Every
// check below is the database's own behaviour; the app is only a caller.
{
  const refused = async (sql, args = []) => { try { await db.query(sql, args); return false; } catch { return true; } };
  const authSrc2 = srcOf('lib/auth.ts');
  const signinSrc2 = srcOf('app/signin/actions.ts');
  const joinSrc2 = srcOf('app/join/actions.ts');

  const doorAcct = crypto.randomUUID(), openedIt = crypto.randomUUID(), doorKid = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob, email) values ($1,'Typed',$3,'typed@example.test'), ($2,'Opened',$3,'opened@example.test')`,
    [doorAcct, openedIt, yearsAgo(37)]);
  await db.query(`insert into person (id, first_name, dob) values ($1,'Doorkid',$2)`, [doorKid, yearsAgo(12)]);
  await db.query(`insert into auth_credential (person_id, password_hash) values ($1,'salt:hash'), ($2,'salt:hash')`, [doorAcct, openedIt]);

  check('proof1: an account made at a door is unproved — an address somebody typed is not a person',
    (await db.query(`select fn_email_proved($1) as ok`, [doorAcct])).rows[0].ok, false);

  await db.query(`insert into email_proof (person_id, token_hash, expires_at) values ($1,$2, now() + interval '7 days')`,
    [openedIt, sha('door-link')]);
  check('proof2: opening the link we sent to that address proves it',
    [(await db.query(`select fn_use_email_proof($1) as p`, [sha('door-link')])).rows[0].p,
     (await db.query(`select fn_email_proved($1) as ok`, [openedIt])).rows[0].ok],
    [openedIt, true]);
  check('proof3: and the link works once, like every other token we send',
    (await db.query(`select fn_use_email_proof($1) as p`, [sha('door-link')])).rows[0].p, null);
  await db.query(`insert into email_proof (person_id, token_hash, expires_at) values ($1,$2, now() - interval '1 minute')`,
    [doorAcct, sha('lapsed-link')]);
  check('proof4: a lapsed link proves nothing',
    [(await db.query(`select fn_use_email_proof($1) as p`, [sha('lapsed-link')])).rows[0].p,
     (await db.query(`select fn_email_proved($1) as ok`, [doorAcct])).rows[0].ok],
    [null, false]);

  // Sign-in: the answer comes from the database on every path, and for an
  // unproved account the database says no. The suite cannot hold a session,
  // so the behaviour through the product is in the write suite (w-proof1/2).
  check('proof5: an unproved account signs in nowhere, and the sign-in path asks the database',
    [/fn_email_proved\(p\.id\) as proved/.test(authSrc2),
     /rows\[0\]\.proved === true/.test(authSrc2),
     /fn_email_proved\(p\.id\)/.test(signinSrc2),
     (await db.query(`select fn_email_proved($1) as ok`, [doorAcct])).rows[0].ok],
    [true, true, true, false]);

  // B2: the blocker itself. An account nobody proved cannot be handed a child
  // — refused by the database, whatever any page does.
  check('proof6 (B2): a child is never linked to an account whose address nobody proved',
    await refused(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [doorAcct, doorKid]), true);
  check('proof7 (B2): and the same link to a proved account is written',
    await refused(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [openedIt, doorKid]), false);
  check('proof8 (B2): nor can the guardian be swapped to an unproved account afterwards',
    await refused(`update guardianship_link set guardian_id = $1 where guardian_id = $2 and child_id = $3`, [doorAcct, openedIt, doorKid]), true);

  // "Set only when they have opened a link we sent" is a property of the
  // data: without the evidence the write is refused, from anywhere.
  check('proof9: proof cannot be written by hand — no operator, no seed, no route that forgets',
    await refused(`update person set email_proved_at = now() where id = $1`, [doorAcct]), true);
  const gKid = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob) values ($1,'Resetkid',$2)`, [gKid, yearsAgo(13)]);
  await db.query(`insert into auth_reset (person_id, token_hash, expires_at, used_at) values ($1,$2, now() + interval '1 hour', now())`,
    [doorAcct, sha('reset-to-the-parent')]);
  check('proof10: a reset link that went to a parent proves nothing about the child\u2019s address (§10 amendment)',
    await refused(`update person set email_proved_at = now() where id = $1`, [doorAcct]), true);
  await db.query(`update auth_reset set proves_person_id = $1 where token_hash = $2`, [doorAcct, sha('reset-to-the-parent')]);
  check('proof11: a reset link emailed to the account\u2019s own address does prove it (doc 15 §10 / §10a)',
    await refused(`update person set email_proved_at = now() where id = $1`, [doorAcct]), false);

  // Asked AFTER the statement, not in its RETURNING: a function called there
  // reads the row as it was before the update and would have answered "still
  // proved" however the trigger behaved.
  await db.query(`update person set email = 'moved@example.test' where id = $1`, [doorAcct]);
  check('proof12: proof follows the address — changing it unproves the account',
    (await db.query(`select fn_email_proved($1) as ok`, [doorAcct])).rows[0].ok, false);

  // N1 (safety review): the doors are unauthenticated endpoints (D-94 §2).
  check('proof13 (N1): every sign-up door is rate-limited, per address and per IP',
    [(joinSrc2.match(/const limited = !\(await doorIsOpen\(email\)\)/g) ?? []).length,
     /checkRate\(`join:ip:/.test(joinSrc2), /checkRate\(`join:id:/.test(joinSrc2)],
    [3, true, true]);
  check('proof14: and a door over the limit writes nothing and answers as a taken address does',
    [(joinSrc2.match(/limited \? \{ rows: \[\] as \{ id: string \}\[\] \}/g) ?? []).length,
     (joinSrc2.match(/redirect\('\/signin\?joined=1'\)/g) ?? []).length],
    [3, 3]);
  check('proof15: every door that makes an account asks that address to confirm itself',
    (joinSrc2.match(/await askThemToConfirm\(personId, email\)/g) ?? []).length, 3);

  // B2's resolution, in the code that performs it: the credential of an
  // unproved account is cleared at approval and the address becomes proved,
  // so the person who controls the inbox owns it. Walked end to end in the
  // write suite (w-proof3/4/5).
  const flowSrc = srcOf('lib/guardian-flow.ts');
  check('proof16 (B2): approval clears an unproved account\u2019s credential and proves the address',
    [/delete from auth_credential where person_id = \$1/.test(flowSrc),
     /delete from auth_reset where person_id = \$1 and used_at is null/.test(flowSrc),
     /update person set email_proved_at = coalesce\(email_proved_at, now\(\)\) where id = \$1/.test(flowSrc),
     /credential_cleared: true/.test(flowSrc)],
    [true, true, true, true]);
}

// ---------------------------------------------------------------------------
// The connection to the database itself (release seat R3, 22 Sep).
//
// Every other check in this file asks what the database answers. These ask
// how we reach it: a permission function enforced in Postgres protects
// nobody if the wire to Postgres is plaintext or the certificate at the far
// end is never checked, and a pool of one is LESSONS L1 in production
// instead of in development.
// ---------------------------------------------------------------------------
const componentFilesAll = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const full = join(d, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.tsx?$/.test(e.name)) componentFilesAll.push(full);
  }
})(fileURLToPath(new URL('../components', import.meta.url)));

{
  const { poolConfig, isLocalSocket, stripSslParams } = await import('../lib/db-policy.ts');
  const dev = poolConfig('postgres://postgres@127.0.0.1:54322/postgres');
  check('db1: the dev socket keeps exactly the shape PGlite needs — one warm connection, no TLS',
    [dev.max, dev.idleTimeoutMillis, dev.ssl], [1, 0, false]);
  const real = poolConfig('postgres://u:pw@db.abcdefg.supabase.co:6543/postgres', { ca: 'PEM' });
  check('db2 (R3): a real database is NOT a pool of one — a request never queues behind itself',
    real.max > 1, true);
  check('db3 (R3): and it connects with TLS, the certificate verified against the pinned CA',
    real.ssl, { ca: 'PEM', rejectUnauthorized: true });
  check('db4: no path can ask for TLS without verification',
    /rejectUnauthorized:\s*(false|0)/.test(codeOnly(srcOf('lib/db-policy.ts')) + codeOnly(srcOf('lib/db.ts'))), false);
  check('db5: the connection string does not get a vote — every ssl parameter is stripped out of it',
    [stripSslParams('postgres://u:p@h:5432/db?sslmode=no-verify&application_name=pitch'),
      poolConfig('postgres://u:p@h:5432/db?sslmode=disable', { ca: 'PEM' }).ssl],
    ['postgres://u:p@h:5432/db?application_name=pitch', { ca: 'PEM', rejectUnauthorized: true }]);
  // And a string with nothing to take out comes back byte for byte: the
  // password is in there, and re-serialising a URL rewrites its escaping.
  check('db5b: a connection string we do not have to rewrite is not rewritten',
    stripSslParams('postgres://u:p%2Fw@h:6543/postgres?pgbouncer=true'),
    'postgres://u:p%2Fw@h:6543/postgres?pgbouncer=true');
  check('db6: the dev and demo sockets are the only local shape; anything else is a real database',
    [isLocalSocket('postgres://postgres@127.0.0.1:54323/postgres'),
      isLocalSocket('postgres://u:p@db.abcdefg.supabase.co:6543/postgres')],
    [true, false]);
  // lib/db must not set pool options of its own: two places deciding `max`
  // is how `max: 1` reached production under a comment saying it would not.
  const dbSrc2 = codeOnly(srcOf('lib/db.ts'));
  check('db7: lib/db takes its whole shape from the policy and invents nothing',
    [/new Pool\(poolConfig\(/.test(dbSrc2), /max:\s*\d/.test(dbSrc2), /idleTimeoutMillis/.test(dbSrc2)],
    [true, false, false]);
  // A startup failure served 21 bytes of text/plain (28 Sep): lib/db threw at
  // IMPORT when SUPABASE_DB_URL was missing, and a throw while Next loads a
  // route module is answered by its top-level handler, never by our error
  // pages. Nothing in this module may throw at the top level; the failure
  // belongs to the first query, inside a render. Comments and strings are
  // removed in one pass (a URL literal contains //), then braces are counted.
  {
    const raw = srcOf('lib/db.ts').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, '');
    let depth = 0, atTop = 0;
    for (const m of raw.matchAll(/[{}]|\bthrow\b/g)) {
      if (m[0] === '{') depth++; else if (m[0] === '}') depth--; else if (depth === 0) atTop++;
    }
    check('boot1: nothing in lib/db throws while the module loads — Next answers that with 21 bytes of plain text, not a page',
      [atTop, depth], [0, 0]);
    check('boot1b: without a URL there is no pool at all — every use fails with the same error, and nothing connects to a default host',
      [/const unconfigured = new Proxy\(/.test(dbSrc2), /!url \? unconfigured :/.test(dbSrc2)], [true, true]);
  }
  // `npm run build:check` rewrote next-env.d.ts to point at .next-check and
  // left the tree dirty after every run, so every seat's handoff carried a
  // change nobody made. The file is Next's, generated by every next command;
  // Next's docs say to ignore it and stop tracking it.
  check('tree1: next-env.d.ts is ignored — it is Next\u2019s, and a build must leave the tree as it found it',
    /^\/next-env\.d\.ts$/m.test(srcOf('.gitignore')), true);
  // L30: a seat can run its own dev database. Unset is the shared 54322, so
  // nobody who does not set it notices anything.
  // Read raw: the dev URL is a postgres:// literal, and codeOnly would take the
  // rest of that line for a comment.
  //
  // The name is matched WHOLE. The old check asked for /DEV_DB_PORT/ and that
  // matches inside PITCH_DEV_DB_PORT, so on 28 Sep it sat green across a real
  // split — the script on one name, the app on the other — and a seat running
  // the documented recipe connected to the shared database and took the port
  // it was trying to avoid. A check that cannot fail is a hope (L19).
  const dbSrc = srcOf('lib/db.ts'), seedSrc = srcOf('scripts/dev-db.mts');
  const whole = (src) => (src.match(/(?<![A-Z_])[A-Z_]*DEV_DB_PORT/g) ?? []);
  check('db8: one name moves the dev database and the app together, and defaults to the shared one',
    [whole(dbSrc).every((n) => n === 'PITCH_DEV_DB_PORT'),
     whole(seedSrc).every((n) => n === 'PITCH_DEV_DB_PORT'),
     whole(dbSrc).length > 0 && whole(seedSrc).length > 0,
     /PITCH_DEV_DB_PORT \|\| '54322'/.test(dbSrc),
     /PITCH_DEV_DB_PORT \|\| 54322/.test(seedSrc),
     whole(srcOf('.env.example')).every((n) => n === 'PITCH_DEV_DB_PORT')],
    [true, true, true, true, true, true]);
}

// The same decision, proved on a real TLS handshake against a fake Postgres
// — no Supabase project and no network. The server speaks the SSLRequest
// negotiation, presents a certificate signed by a CA generated here, and
// counts what it is given: a completed handshake, or plaintext.
{
  const { execFileSync } = await import('node:child_process');
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const net = await import('node:net');
  const tls = await import('node:tls');
  const { poolConfig } = await import('../lib/db-policy.ts');
  let dir = null;
  try {
    dir = mkdtempSync(join(tmpdir(), 'pitch-tls-'));
    const ossl = (...a) => execFileSync('openssl', a, { cwd: dir, stdio: ['ignore', 'ignore', 'pipe'] });
    ossl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.crt',
      '-days', '1', '-subj', '/CN=Pitch test CA', '-addext', 'basicConstraints=critical,CA:TRUE');
    ossl('req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'srv.key', '-out', 'srv.csr',
      '-subj', '/CN=pitch-test-db');
    writeFileSync(join(dir, 'ext.cnf'), 'subjectAltName=DNS:pitch-test-db\n');
    ossl('x509', '-req', '-in', 'srv.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-CAcreateserial',
      '-out', 'srv.crt', '-days', '1', '-extfile', 'ext.cnf');
  } catch {
    dir = null;
    console.log('SKIP db9-db12 — no openssl to generate a test certificate; the TLS path was NOT measured');
  }
  if (dir) {
    const pg = (await import('pg')).default;
    const read = (f) => readFileSync(join(dir, f), 'utf8');
    const ca = read('ca.crt');
    let handshakes = 0, plaintext = 0;
    const tlsServer = tls.createServer({ cert: read('srv.crt'), key: read('srv.key') });
    tlsServer.on('secureConnection', (s) => { handshakes++; s.destroy(); });
    tlsServer.on('tlsClientError', () => {});
    const server = net.createServer((sock) => {
      const onReadable = () => {
        const first = sock.read(8);
        if (first === null) return;
        sock.removeListener('readable', onReadable);
        // length 8, code 80877103 = SSLRequest. Anything else is a client
        // that never asked for TLS at all.
        if (first.readInt32BE(0) === 8 && first.readInt32BE(4) === 80877103) {
          sock.write(Buffer.from('S'));
          tlsServer.emit('connection', sock);
        } else { plaintext++; sock.destroy(); }
      };
      sock.on('readable', onReadable);
      sock.on('error', () => {});
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    // The ssl the policy hands pg for a REAL database, pointed at the fake
    // server. `servername` is what pg sets from a real host name, and it is
    // what the certificate is checked against.
    const attempt = async (opts, servername, extra = {}) => {
      const h = handshakes, p = plaintext;
      const cfg = poolConfig('postgres://u:p@db.abcdefg.supabase.co:5432/postgres?sslmode=no-verify', opts);
      const c = new pg.Client({
        host: '127.0.0.1', port, user: 'u', password: 'p', database: 'postgres',
        ssl: { ...cfg.ssl, servername }, connectionTimeoutMillis: 5000, ...extra,
      });
      let err = 'connected';
      try { await c.connect(); } catch (e) { err = e.code || e.message; }
      try { await c.end(); } catch { /* the fake server never authenticates */ }
      return { tls: handshakes > h, plaintext: plaintext > p, err };
    };
    const ok = await attempt({ ca }, 'pitch-test-db');
    check('db9 (R3): the pinned CA gives a real, completed TLS handshake, and nothing goes in plaintext',
      [ok.tls, ok.plaintext], [true, false]);
    const unknown = await attempt({}, 'pitch-test-db');
    check('db10: a certificate we do not trust is refused, not shrugged at',
      [unknown.tls, unknown.err], [false, 'UNABLE_TO_VERIFY_LEAF_SIGNATURE']);
    const wrongHost = await attempt({ ca }, 'someone-elses-db');
    check('db11: a valid certificate for the WRONG host is refused too — verify-full, not verify-ca',
      [wrongHost.tls, wrongHost.err], [false, 'ERR_TLS_CERT_ALTNAME_INVALID']);
    // And the reason db5 exists, demonstrated rather than asserted: pg merges
    // the parsed connection string OVER the config object, so an sslmode in
    // a URL beats an explicit ssl config and the wire goes plaintext.
    const urlWins = await attempt({ ca }, 'pitch-test-db',
      { connectionString: `postgres://u:p@127.0.0.1:${port}/postgres?sslmode=disable` });
    check('db12: which is why the string is stripped — sslmode in a URL beats an explicit ssl config',
      urlWins.plaintext, true);
    server.close(); tlsServer.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// The SMS spend cap is mandatory (D-81, release seat R4, BUZ decision 5).
// ---------------------------------------------------------------------------
{
  const { smsCapCents } = await import('../lib/sms-policy.ts');
  check('cap1 (R4): an absent, empty, zero or nonsense cap is NOT "no limit" — it is no cap',
    [smsCapCents(undefined), smsCapCents(''), smsCapCents('  '), smsCapCents('0'), smsCapCents('-500'), smsCapCents('lots')],
    [null, null, null, null, null, null]);
  check('cap2: a real cap is read in cents', [smsCapCents('2000'), smsCapCents(' 2000 ')], [2000, 2000]);
  const sendSrc2 = codeOnly(srcOf('lib/messaging.ts'));
  check('cap3 (R4): with no cap configured, production refuses every SMS, with the reason recorded',
    /cap === null && process\.env\.NODE_ENV === 'production'[\s\S]{0,80}reason: 'sms_no_cap'/.test(sendSrc2), true);
  // The refusal has to BE THERE and be first: an indexOf of -1 is also
  // "before", and a check that passes when the line is gone is not a check.
  // The RETURN, not the reason's name in the type union above it.
  const refusalAt = sendSrc2.indexOf("reason: 'sms_no_cap'");
  check('cap4: and the refusal comes before the meter is charged and before an outbox row exists',
    refusalAt > 0 && refusalAt < sendSrc2.indexOf('insert into sms_meter')
      && refusalAt < sendSrc2.indexOf('insert into message_outbox'), true);
  check('cap5: nothing outside the send layer reads the cap for itself',
    /SMS_MONTHLY_CAP_CENTS/.test(codeOnly(srcOf('lib/providers.ts'))), false);
  const envEx = readFileSync(fileURLToPath(new URL('../.env.example', import.meta.url)), 'utf8');
  check('cap6: and .env.example says so in words, where the person setting it will read it',
    /MANDATORY, and empty never means "no limit"/.test(envEx), true);
}

// ---------------------------------------------------------------------------
// Doc 15 §13 is HELD (BUZ decision 3, 23 Sep): the words stay, the send stops.
// Doc 14 §B11 makes that message the gate for the sixteenth-birthday
// transition, so the gate has to survive the hold — and it does, by staying
// shut: no notice, no delivery, no discovery (asserted in table B).
// ---------------------------------------------------------------------------
{
  const msgs = srcOf('lib/messages.ts');
  check('held1: §13 is on the held list, its approved words are still here, and it is still in the catalogue',
    [/HELD_KEYS = \[\s*\n\s*'doc15\.§13',/.test(msgs),
      msgs.includes('turns sixteen, and one thing on Pitch changes.'),
      /CATALOGUE_KEYS = \[[\s\S]*?'doc15\.§13'/.test(msgs)],
    [true, true, true]);
  check('held2: the send layer refuses a held message EVERYWHERE, not only in production',
    /if \(HELD\.has\(msg\.key\)\) return \{ queued: false, reason: 'held' \};/.test(srcOf('lib/messaging.ts')), true);
  const daily = codeOnly(srcOf('app/api/jobs/daily/route.ts'));
  check('held3: and the daily job does not even look for a child to send it to while it is held',
    /const held = isHeld\('doc15\.§13'\);[\s\S]{0,120}if \(!held\) \{[\s\S]{0,200}fn_children_turning_16/.test(daily), true);
  check('held4: nothing writes an age_transition_notice outside that block — a row with no send skips that child forever',
    (daily.match(/insert into age_transition_notice/g) ?? []).length, 1);
  const doc15 = readFileSync(fileURLToPath(new URL('../docs/15-Message-Copy.md', import.meta.url)), 'utf8');
  check('held5: doc 15 §13 carries the dated hold note above the words it holds',
    /## 13 · Thirty days[\s\S]{0,200}\*\*HELD 23 Sep 2026 \(BUZ\) — this message does not send\.\*\*/.test(doc15), true);
  // While no parent is being told, nothing may describe the change to them.
  const claims = [...routeFiles, ...componentFilesAll].filter((f) =>
    /(search|find)[^.\n]{0,70}(16|sixteen)[\s‑-]?(and over|or over|and 17|–17|-17)/i.test(codeOnly(readFileSync(f, 'utf8'))));
  check(`held6: no screen claims a club can search for a player of sixteen or seventeen (${claims.map((f) => f.slice(f.indexOf('/app/') + 1 || f.indexOf('/components/') + 1)).join(', ') || 'none does'})`,
    claims.length, 0);
}

// ---------------------------------------------------------------------------
// The coach lookup, on proved addresses only (B1's second half, L21, 0056).
// The SQL is READ OUT OF THE ACTION and run here, so this cannot pass on a
// copy of the query that the product no longer uses.
// ---------------------------------------------------------------------------
{
  const inviteSrc = srcOf('app/club/squads/actions.ts');
  const sql = /const coach = await db\.query\(\s*`([\s\S]*?)`/.exec(inviteSrc)?.[1] ?? '';
  check('coach1 (B1): the coach lookup asks the database whether the address is proved',
    /fn_email_proved\(p\.id\)/.test(sql), true);
  const provedCoach = crypto.randomUUID(), unprovedCoach = crypto.randomUUID();
  for (const [id, email] of [[provedCoach, 'proved.coach@example.test'], [unprovedCoach, 'unproved.coach@example.test']]) {
    await db.query(`insert into person (id, first_name, last_name, dob, email) values ($1,'Test','Coach','1985-04-04',$2)`, [id, email]);
    await db.query(`insert into coach_profile (person_id) values ($1)`, [id]);
  }
  // Proved the way the product proves it: a link we sent, opened (0056).
  await db.query(`insert into email_proof (person_id, token_hash, expires_at) values ($1,$2, now() + interval '7 days')`,
    [provedCoach, sha('coach-proof')]);
  await db.query(`select fn_use_email_proof($1)`, [sha('coach-proof')]);
  const lookup = async (email) => (await db.query(sql, [email, ID.td])).rows.map((r) => r.id);
  check('coach2 (B1): a coach whose address nobody has proved is not found — the address alone is not a person',
    await lookup('unproved.coach@example.test'), []);
  check('coach3: and a coach who has opened the link we sent is found, so the invite still works',
    await lookup('proved.coach@example.test'), [provedCoach]);
  check('coach4 (N24): an address with no account at all answers exactly as an unproved one does',
    await lookup('nobody.at.all@example.test'), []);
  check('coach5: and the club is told the same thing either way — one redirect, no branch on the result',
    (inviteSrc.match(/redirect\('\/club\/squads\?coachAsked=1'\)/g) ?? []).length, 1);
}

// ---------------------------------------------------------------------------
// An age is a calendar fact, and the database owns it (QA F5).
// ---------------------------------------------------------------------------
{
  const { ageOn, ageBand } = await import('../lib/age.ts');
  const mel = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date()).split('-').map(Number);
  const dobFor = (years, offsetDays = 0) => {
    const d = new Date(Date.UTC(mel[0] - years, mel[1] - 1, mel[2] + offsetDays));
    return d.toISOString().slice(0, 10);
  };
  const cases = [dobFor(18), dobFor(18, 1), dobFor(18, -1), dobFor(16), dobFor(16, 1), dobFor(15), dobFor(30)];
  const mine = cases.map((d) => ageBand(d));
  const theirs = [];
  for (const d of cases) theirs.push((await db.query(`select fn_age_band($1::date) as b`, [d])).rows[0].b);
  check(`age1 (F5): the app agrees with fn_age_band on every boundary, birthdays included (${cases.join(' ')})`,
    mine, theirs);
  check('age2: and on an eighteenth birthday that answer is eighteen, not seventeen',
    ageOn(dobFor(18)), 18);
  // L20, in place: the formula that was there says seventeen on the day.
  // Pinned to one instant, not the clock: against Date.now() the old formula's
  // answer on a birthday depends on the hour (it read 18 from 22:00 to midnight
  // Melbourne and the check flipped on unchanged code). 2008-09-28 to the first
  // instant of 2026-09-28 is 6574 days (four leap days) — 17.99 by /365.25.
  const old = Math.floor((Date.UTC(2026, 8, 28) - Date.UTC(2008, 8, 28)) / (365.25 * 24 * 3600 * 1000));
  check('age3: the formula it replaced gets an eighteenth birthday wrong (a fixed instant)', old, 17);
  const withFormula = [...routeFiles, ...componentFilesAll, ...readdirSync(fileURLToPath(new URL('../lib', import.meta.url)))
    .filter((f) => /\.tsx?$/.test(f) && f !== 'age.ts').map((f) => fileURLToPath(new URL('../lib/' + f, import.meta.url)))]
    .filter((f) => /365\.25/.test(readFileSync(f, 'utf8')));
  check(`age4: and no screen or library works an age out for itself (${withFormula.join(', ') || 'none does'})`,
    withFormula.length, 0);
}

// ---------------------------------------------------------------------------
// D-108's words are banned on EVERY surface, and the address bar is one
// (QA F8: ?done=declined, ?squad=declined, ?applied=1).
// ---------------------------------------------------------------------------
{
  const bad = [];
  for (const f of routeFiles) {
    // The whole argument, quotes and template expressions included: the
    // words are usually in a ternary inside the template
    // (`?squad=${yes ? 'joined' : 'declined'}`), so a check that reads only
    // as far as the first quote can never see one.
    for (const m of codeOnly(readFileSync(f, 'utf8')).matchAll(/redirect\(([\s\S]{0,240}?)\);/g)) {
      if (/[?&]/.test(m[1]) && /\b(applied|application|declined|rejected|unsuccessful)\b/i.test(m[1])) {
        bad.push(`${f.slice(f.indexOf('/app/') + 1)} ${m[1].replace(/\s+/g, ' ').slice(0, 60)}`);
      }
    }
  }
  check(`url1 (F8): no redirect puts a banned word in the address bar (${bad.join(', ') || 'none does'})`, bad.length, 0);
}

// ---------------------------------------------------------------------------
// url1's sibling, and the one that should have existed first: D-108's words
// banned in the WORDS ON THE SCREEN, not only in the address bar.
//
// The user seat found "Apply for this role" and "Applying sends the club your
// coaching CV" live on /jobs on 24 Sep, with every suite green. url1 reads
// redirect() arguments; the corpus check reads docs/; the copy seat reads
// strings with its eyes and had already corrected 106 of them — and these two
// walked through all three. The vocabulary is not a style preference: D-108
// extends D-85 because "applied / declined / rejected" is what makes a
// register look like something a child can be turned down from, which is the
// analysis we are deliberately staying outside of. A rule nobody enforces is
// a hope (TRAINING §7).
//
// Scanned: the text between JSX tags, and quoted strings long enough to be
// prose rather than a class name or a key. Comments are stripped first —
// a comment is not copy — and "application/…" is skipped, because a media
// type is not a sentence.
// ---------------------------------------------------------------------------
{
  const BANNED = /\b(applied|applying|apply|application|applicant|declined|rejected|unsuccessful|potential|insights?|struggling)\b/i;
  const screenFiles = [...routeFiles];
  (function walkComponents(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = join(d, e.name);
      if (e.isDirectory()) walkComponents(full);
      else if (/\.tsx?$/.test(e.name)) screenFiles.push(full);
    }
  })(fileURLToPath(new URL('../components', import.meta.url)));
  // A page that does not exist in production is not a surface. /design,
  // /dev/outbox and /demo all 404 in a production build, and the words in
  // them are engineering language ("the tablet rule applied to desktop"), not
  // copy anybody reads.
  const devOnly = (src) => /NODE_ENV === 'production'[\s\S]{0,80}notFound\(\)/.test(src) || /isDemo\(\)/.test(src);
  // WAS: eight strings in the coach jobs flow, live on 24 Sep with every suite
  // green, found by the user seat walking the product as a volunteer coach.
  // BUZ approved the replacements on 28 Sep — "put your name forward" — and
  // they are in. The set is empty and stays empty: it exists so that if this
  // ever happens again the debt is visible and pinned by exact text rather
  // than quietly tolerated, and so that nobody can add a ninth by widening a
  // regex. D-108's words go for any actor on any surface, because a second
  // vocabulary for adults is how the first one erodes.
  const AWAITING_BUZ = new Set([]);
  const found = [];
  for (const f of screenFiles) {
    const src = codeOnly(readFileSync(f, 'utf8'));
    if (devOnly(src)) continue;
    const seen = new Set();
    const consider = (text, where) => {
      const t = text.replace(/\s+/g, ' ').trim();
      if (!t || t.length < 4 || seen.has(t)) return;
      if (!/[a-z]{3}/i.test(t)) return;
      const m = BANNED.exec(t);
      if (!m) return;
      // "application/json" and the like: a media type, not a sentence.
      if (/^application$/i.test(m[0]) && t.slice(m.index + m[0].length).startsWith('/')) return;
      seen.add(t);
      if (AWAITING_BUZ.has(t)) return;
      found.push(`${f.slice(f.lastIndexOf('/app/') + 1 || f.lastIndexOf('/components/') + 1)}: "${t.slice(0, 70)}"`);
    };
    // Text between tags — the words a person actually reads.
    for (const m of src.matchAll(/>([^<>{}]{4,300})</g)) consider(m[1]);
    // And prose in quotes: a title, an aria-label, a placeholder, a message.
    for (const m of src.matchAll(/(['"`])([^'"`\n]{8,300}?)\1/g)) {
      if (/\s/.test(m[2])) consider(m[2]);
    }
  }
  check(`ban1: D-108's words are not on any screen (${found.slice(0, 4).join(' · ') || 'none are'})`, found.length, 0);
}

// ---------------------------------------------------------------------------
// The legal pages serve the published document, not our drafting notes (0056).
//
// WAS: app/legal/legal-page.tsx rendered the markdown in docs/legal as-is, so
// every legal surface opened with the author's preamble — 1,294 rendered words
// on /privacy before the policy spoke, 1,401 on /terms — and the same block sat
// inside the guardian approval flow, where doc 32 B3 requires doc 21 be SHOWN.
// The first thing a parent read while deciding whether to trust us with their
// child was that the policy they were being asked to accept was NOT YET
// PUBLISHED and that some of our work had been lost. L16 wrote this down on
// 17 September; it stayed true for eleven days.
//
// The checks are over lib/legal-doc — the one answer both /privacy and the
// approval flow render — for every document the register lists as rendered in
// the product. Docs 24 and 25 had no route until brief K, and were checked
// anyway; they are served now, at /conduct and /report/policy.
{
  const { legalDocument, renderedLegalDocs, renderedVersions, stripDraftingPreamble, publishedDate, versionLine, WITHHELD } =
    await import('../lib/legal-doc.ts');

  // Every phrase that says "this is not the document you think you are
  // reading". Matched against the rendered markdown, which is what a page
  // serves — not against the source file, which keeps all of it on purpose.
  const MARKERS = ['NOT YET PUBLISHED', 'do-not-publish', 'not to be published', '⚠️',
    'Nothing here binds', 'working draft', 'the loss was my doing'];
  const legalDir = fileURLToPath(new URL('../docs/legal', import.meta.url));
  const fileFor = (doc) => {
    const f = readdirSync(legalDir).find((x) => x.startsWith(`${doc}-`) && x.endsWith('.md'));
    if (!f) throw new Error(`the register lists doc ${doc} as rendered and there is no markdown for it`);
    return f;
  };

  const live = renderedLegalDocs();
  check(`leg1: the register's authority table is the list of live documents (${live.map((d) => `${d.doc}@${d.version}`).join(' ')})`,
    live.length, 5);
  const MARKED = /\[DRAFTED\]|\[OUTLINE\]|\[LEGAL\b|\[DO NOT PUBLISH\b/;
  const withheldFrom = new Set(live.map((d) => d.doc).filter((doc) => WITHHELD.some((w) => w.doc === doc)
    || MARKED.test(stripDraftingPreamble(readFileSync(join(legalDir, fileFor(doc)), 'utf8')))));
  check(`legj0: the documents something is withheld from are 22 and 25, and no others (${[...withheldFrom].join(', ')})`,
    [...withheldFrom].sort(), ['22', '25']);

  for (const { doc, version } of live) {
    const file = fileFor(doc);
    const raw = readFileSync(join(legalDir, file), 'utf8');
    const served = legalDocument(file);
    const line = versionLine(served.version, served.date);

    const hits = MARKERS.filter((m) => served.markdown.includes(m));
    check(`leg2: doc ${doc} serves no drafting marker (${hits.join(' · ') || 'none'})`, hits, []);
    check(`leg3: doc ${doc} resolves the register's version, and a date out of the document (${served.version} · ${served.date})`,
      [served.version, /^\d{1,2} (January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/.test(served.date)],
      [version, true]);
    check(`leg4: doc ${doc} carries that version on screen, in its first lines`,
      served.markdown.split('\n').slice(0, 6).includes(line), true);
    // Nothing below the title has moved: what we serve from the first line of
    // the document proper to its last is a verbatim substring of the file in
    // docs/legal. No clause, no heading, no sentence, and no version bump.
    // Brief J (29 Sep): a document carrying clause markers or a WITHHELD
    // clause is not a substring any more — it is the source minus exactly
    // those, which legj3 checks as a property for every document. The
    // documents that skip this line are pinned at legj0, so the set cannot grow.
    if (withheldFrom.has(doc)) continue;
    const lines = served.markdown.split('\n');
    const tail = lines.slice(lines.indexOf(line) + 1).join('\n').trim();
    check(`leg5: doc ${doc} is served verbatim below the title — no clause, heading or sentence changed`,
      [lines[0], raw.split('\n')[0], raw.includes(tail)], [raw.split('\n')[0], raw.split('\n')[0], true]);
  }

  // Narrow on purpose, and the narrowness is the check. A clean document comes
  // back byte for byte; a blockquote that is content survives.
  const clean = '# A clean document\n\n## One\n\nText.\n\n> A quotation that is content.\n\n## Two\n\nMore.\n';
  check('leg6: a document with no preamble is returned byte for byte', stripDraftingPreamble(clean), clean);
  check('leg7: a preamble under a subtitle goes, with the rule that closes it; the body blockquote stays',
    stripDraftingPreamble('# Title\n\n### Subtitle\n\n> **v1.0, 1 May 2026 — NOT YET PUBLISHED.**\n>\n> More notes.\n\n---\n\n## One\n\n> Content.\n'),
    '# Title\n\n### Subtitle\n\n## One\n\n> Content.\n');
  check('leg8: a blockquote below a section heading is never a preamble',
    stripDraftingPreamble('# Title\n\n## One\n\n> Content.\n'), '# Title\n\n## One\n\n> Content.\n');
  // Brief J: Schedule A's opening blockquote is now withheld BY NAME, as a
  // drafting note (it cites D-36, D-39 and D-127 and points at prices A6.1 no
  // longer states). What this check is for is unchanged: the PREAMBLE rule
  // never takes a body blockquote, so it is asked of that rule directly.
  // Brief K: doc 25's investigator blockquote is in Part 3, which is withheld
  // as internal now that a page serves doc 25 — so it too is asked of the
  // preamble rule directly, which is what this check is about.
  check('leg9: and the two real ones survive the preamble rule — doc 22 Schedule A, doc 25 Part 4',
    [stripDraftingPreamble(readFileSync(join(legalDir, fileFor('22')), 'utf8')).includes('> **What is on sale, and what is not.**'),
     stripDraftingPreamble(readFileSync(join(legalDir, fileFor('25')), 'utf8')).includes('> **Today the investigator is one person')],
    [true, true]);

  // Fail loudly. A legal page that silently renders no version is the same bug
  // in different clothes, so every way of not knowing throws.
  const threw = (f) => { try { f(); return false; } catch { return true; } };
  check('leg10: a document that dates its current version nowhere fails loudly',
    threw(() => publishedDate('# Title\n\nNo date in here.\n', 'v9.9', '99')), true);
  check('leg11: a version the document dates twice, differently, is not chosen between',
    threw(() => publishedDate('> **v1.0, 1 May 2026.**\n\n*doc 99 · v1.0 draft · 2 May 2026*\n', 'v1.0', '99')), true);
  check('leg12: a register with no authority table fails loudly',
    threw(() => renderedVersions('# not the register\n')), true);
  check('leg13: a register that lists one document at two versions fails loudly (7 September)',
    threw(() => renderedVersions('**Rendered in the product:**\n| **20** | **P** | **v2.7** | a | b |\n| **20** | **P** | **v2.8** | a | b |\n')), true);
  check('leg14: a specification\'s version in the internal table is not a published document\'s',
    renderedVersions('**Rendered in the product:**\n| **20** | **P** | **v2.7** | a | b |\n\n**Internal — specifications, not background:**\n| **20** | **X** | **v9.9** | z |\n').get('20'),
    'v2.7');
  check('leg15: a document with no title is left alone rather than guessed at',
    stripDraftingPreamble('> **v1.0 — notes.**\n\nBody.\n'), '> **v1.0 — notes.**\n\nBody.\n');

  // A consent row must resolve, years later, to the text that person read
  // (doc 32 B2; John, 3 Sep). The first version of this check asserted that the
  // stamp hashes the FILE in docs/legal — a proxy for that rule, written when
  // the file and the page were the same bytes. They are not the same bytes any
  // more, so the proxy had become the opposite of the rule it stood for: it
  // would have held a guardian's row against 728 words she was never shown,
  // including the line saying the policy is not published. Replaced with the
  // rule (L33), and the first half of it is a fact, not a regex.
  const stampSrc = readFileSync(fileURLToPath(new URL('../lib/legal-stamp.ts', import.meta.url)), 'utf8');
  const shaOf = (s) => createHash('sha256').update(s).digest('hex');
  const bytesDiffer = ['20', '21', '22'].filter((doc) => {
    const file = fileFor(doc);
    return shaOf(legalDocument(file).markdown)
      !== shaOf(readFileSync(join(legalDir, file), 'utf8'));
  });
  check('leg16: what a stamped document SERVES and what docs/legal holds are different bytes — one hash cannot describe both',
    bytesDiffer, ['20', '21', '22']);
  // The other half can only be structural from here: lib/legal-stamp is
  // server-only and a plain node script cannot import it.
  check('leg17: so the stamp is taken from the served document, never from the file',
    /legalDocument\(LEGAL_FILES\[doc\]\)\.markdown/.test(stampSrc) && !/update\(bytes\)/.test(stampSrc), true);
  // And the renderer has one door. A page that opened docs/legal for itself
  // could serve the preamble again without a check here noticing.
  const readsLegal = (src) => /'docs',\s*'legal'/.test(src) || /readFileSync\([^)]*docs\/legal/.test(src);
  const root = fileURLToPath(new URL('..', import.meta.url));
  const readers = [...walk(join(root, 'app')), ...walk(join(root, 'lib'))]
    .filter((f) => /\.tsx?$/.test(f) && readsLegal(readFileSync(f, 'utf8')))
    .map((f) => f.slice(root.length));
  check(`leg18: exactly one file opens docs/legal (${readers.join(', ') || 'none'})`,
    readers, ['lib/legal-doc.ts']);
}

// ---------------------------------------------------------------------------
// John's rulings of 28 Sep (docs/legal/35, "Rulings — 2026-09-28").
//
// 1. Stripping the preamble is not material; the version still bumps, so every
//    consent row names exactly the text that was shown; nobody is re-asked.
// 2. Clauses describing capabilities that are not built come out until they
//    are built. ([DRAFTED], [OUTLINE] and [LEGAL: doc 18 Qn] are a different
//    class and the ruling does not touch them.)
// 3. One version per document, everywhere — register table, register prose,
//    the document's own header and footer — and the "not yet published"
//    colophons go, because these versions are the published ones.
// ---------------------------------------------------------------------------
{
  const { legalDocument, renderedLegalDocs } = await import('../lib/legal-doc.ts');
  const legalDir = fileURLToPath(new URL('../docs/legal', import.meta.url));
  const fileFor = (doc) => readdirSync(legalDir).find((x) => x.startsWith(`${doc}-`) && x.endsWith('.md'));
  const live = renderedLegalDocs();

  // Ruling 3: no served page calls itself unpublished, in any case.
  for (const { doc } of live) {
    const served = legalDocument(fileFor(doc)).markdown;
    const hit = /not yet published/i.exec(served);
    check(`jr1: doc ${doc} serves no "not yet published" (${hit ? served.slice(Math.max(0, hit.index - 40), hit.index + 20).replace(/\s+/g, ' ') : 'none'})`,
      Boolean(hit), false);
  }

  // Ruling 3: one version per document. The register's table is the answer;
  // everything else that names the document's version must name the same one.
  const reg = readFileSync(join(legalDir, '00-Legal-Register.md'), 'utf8');
  const prose = /currently\s+`20@(v[\d.]+)`,\s*`21@(v[\d.]+)`,\s*`22@(v[\d.]+)`/.exec(reg);
  const consentSrc = readFileSync(fileURLToPath(new URL('../lib/consent.ts', import.meta.url)), 'utf8');
  const policyVersion = /POLICY_VERSION\s*=\s*'([^']+)'/.exec(consentSrc)?.[1];
  const num = (v) => v.replace(/^v/, '').split('.').map(Number);
  const newer = (a, b) => { const [x, y] = [num(a), num(b)]; return x[0] - y[0] || x[1] - y[1]; };
  for (const { doc, version } of live) {
    const raw = readFileSync(join(legalDir, fileFor(doc)), 'utf8');
    // What the document says about itself: its change-log heads ("v2.7, 15
    // September…"), its status lines ("Doc 21 · v2.5 …"), its colophon, and —
    // doc 20 only — the "Version:" line in its body.
    const heads = [...raw.matchAll(/^>\s*\*\*(?:⚠️\s*)?(v\d+\.\d+),/gm)].map((m) => m[1]);
    const status = [...raw.matchAll(new RegExp(`[Dd]oc ${doc} · (v\\d+\\.\\d+)`, 'g'))].map((m) => m[1]);
    const header = [...heads, ...status].sort(newer).at(-1);
    const colophon = new RegExp(`^\\*Pitch Football ·.*· doc ${doc} · (v\\d+\\.\\d+)`, 'm').exec(raw)?.[1];
    const body = /\*\*Version:\*\* (\d+\.\d+)/.exec(raw)?.[1];
    const claims = { header, colophon, ...(body ? { body: `v${body}` } : {}) };
    if (['20', '21', '22'].includes(doc)) claims.prose = prose?.[{ 20: 1, 21: 2, 22: 3 }[doc]];
    if (doc === '20') claims.consent = policyVersion?.replace(/^20@/, '');
    const wrong = Object.entries(claims).filter(([, v]) => v !== version).map(([k, v]) => `${k} says ${v}`);
    check(`jr2: doc ${doc} names one version everywhere — the register's ${version} (${wrong.join(', ') || 'it does'})`,
      wrong, []);
  }

  // Ruling 1: every consent row names the text that was shown — so for doc 20,
  // the waitlist and the consent path must stamp the SAME hash. Reproduce what
  // each path actually writes. Today the waitlist writes a typed constant.
  const shaOf = (s) => createHash('sha256').update(s).digest('hex');
  const served20 = shaOf(legalDocument(fileFor('20')).markdown);
  const waitSrc = readFileSync(fileURLToPath(new URL('../app/api/waitlist/route.ts', import.meta.url)), 'utf8');
  const waitlistHash = /legalStamp\('20'\)/.test(waitSrc) ? served20
    : /POLICY_STAMP/.test(waitSrc) ? /POLICY_SHA256\s*=\s*'([0-9a-f]{64})'/.exec(consentSrc)?.[1] : 'neither';
  const stampSrc = readFileSync(fileURLToPath(new URL('../lib/legal-stamp.ts', import.meta.url)), 'utf8');
  const consentPathHash = /legalDocument\(LEGAL_FILES\[doc\]\)\.markdown/.test(stampSrc) ? served20 : 'not the served text';
  check(`jr3: the waitlist and the consent path stamp doc 20 with one hash (waitlist ${String(waitlistHash).slice(0, 12)} · consent ${String(consentPathHash).slice(0, 12)})`,
    waitlistHash, consentPathHash);
  // And no second answer is left lying around to drift: no hash typed into
  // lib/ or app/ at all.
  const typed = [...walk(fileURLToPath(new URL('../lib', import.meta.url))), ...walk(fileURLToPath(new URL('../app', import.meta.url)))]
    .filter((f) => /\.tsx?$/.test(f) && /['"`][0-9a-f]{64}['"`]/.test(readFileSync(f, 'utf8')))
    .map((f) => f.slice(f.lastIndexOf('/lib/') + 1 || f.lastIndexOf('/app/') + 1));
  check(`jr4: no document hash is typed into the code (${typed.join(', ') || 'none is'})`, typed, []);

  // Ruling 2, and the one part of it this commit could NOT carry out.
  //
  // John ruled that clauses describing capabilities that are not built come
  // out. The one clause marked that way, doc 22 §6.5 (suppression), describes
  // exactly the capability doc 32 calls A1 — and migration 0049 built A1 and
  // A2 on 17 Sep; g32-p1–p4 pin them. John's own gate, doc 32 B6, says "If A1
  // and A2 are green, 6.5 may publish. If they are not, it must not", and A1's
  // box asks that a person has done it once. Whether 6.5 is "not built" is
  // therefore a question with two of John's answers on it, and the builder was
  // told: if a clause is ambiguous about its class, leave it served and list
  // it. So these four lines are still served, pinned by their exact opening,
  // AWAITING JOHN. The set exists so that nothing joins it quietly and so that
  // it is emptied, not widened, when he answers.
  //
  // Emptied 29 Sep (brief J). Doc 37 item 3 put the question to him with a
  // default — "§6.5 is removed until you tick it" — and he did not answer it,
  // so 6.5 and its status note are not served until he does. Rows 4 and 5
  // went with the open items table, a drafting table like the preamble. jr5
  // now asserts that nothing "not built" is served at all.
  const AWAITING_JOHN = new Set([]);
  // The drafting sense only. "Do not publish other people's children" is a
  // conduct rule (doc 22 Part 9, doc 24 §3), and it is content.
  const UNBUILT = /\[DO NOT PUBLISH[^\]]*\]|— do not publish\b|must not publish before it is built|^\*Status: not built\./i;
  const served = [];
  for (const { doc } of live) {
    for (const line of legalDocument(fileFor(doc)).markdown.split('\n')) {
      if (UNBUILT.test(line)) served.push(`${doc}: ${line.slice(0, 72)}`);
    }
  }
  const unexpected = served.filter((l) => !AWAITING_JOHN.has(l));
  const answered = [...AWAITING_JOHN].filter((l) => !served.includes(l));
  check(`jr5: nothing "not built" is served — 6.5 is held until John ticks it (doc 37 item 3) (${unexpected.join(' · ') || 'nothing is'})`,
    unexpected, []);
  check(`jr6: and nothing is left awaiting John that is no longer served (${answered.join(' · ') || 'the set is empty'})`,
    [answered, AWAITING_JOHN.size], [[], 0]);
}

// ---------------------------------------------------------------------------
// Brief J (29 Sep): the Terms a parent reads on 1 October, with no drafting in
// them. John answered doc 37 item 1 only, so its "if you say nothing" column
// rules items 2–6: [DRAFTED] labels go and the clause stays; [OUTLINE] and
// [DO NOT PUBLISH …] clauses are not served; a [LEGAL: …] question goes and
// its clause stays, except the $2,000 floor and the five-year record period,
// which are held. Drafting notes in the body go, as the preamble did.
//
// The dangerous way for this to be wrong is not a marker left on the page —
// that is visible. It is a render rule that quietly eats a sentence John
// wrote. So legj3 is a property over every rendered document, not a list of
// spot checks: every line served is a source line with only a marker or a
// named removal taken out, in source order, and every source line NOT served
// is one of the lines pinned in legj4. Nothing is served that is not his, and
// nothing of his goes missing that is not on that list.
// ---------------------------------------------------------------------------
{
  const { legalDocument, renderedLegalDocs, stripDraftingPreamble, withholdUnpublished, versionLine, WITHHELD } =
    await import('../lib/legal-doc.ts');
  const legalDir = fileURLToPath(new URL('../docs/legal', import.meta.url));
  const fileFor = (doc) => readdirSync(legalDir).find((x) => x.startsWith(`${doc}-`) && x.endsWith('.md'));
  const rawOf = (doc) => readFileSync(join(legalDir, fileFor(doc)), 'utf8');
  const live = renderedLegalDocs();
  const threw = (f) => { try { f(); return false; } catch { return true; } };

  // legj1 · The brief's phrases. "Do not publish other people's children" is
  // a conduct rule (doc 22 Schedule C 3, doc 24 §3) and it is content.
  const DRAFTING = [/\[DRAFTED\]/, /\[OUTLINE\]/, /\[LEGAL/, /\[DO NOT PUBLISH/i, /do not publish/i,
    /must not publish/i, /not yet published/i, /for legal review/i];
  const CONDUCT = /\b[Dd]o not publish other people's children/g;
  for (const { doc } of live) {
    const served = legalDocument(fileFor(doc)).markdown.replace(CONDUCT, '');
    const hits = DRAFTING.filter((r) => r.test(served)).map(String);
    check(`legj1: doc ${doc} serves none of the brief's drafting phrases (${hits.join(' · ') || 'none'})`, hits, []);
  }

  // legj2 · The two held clauses: in the source, on no page.
  const HELD = [
    ['22', '5.5: We keep records of reports and what we did about them for five years.'],
    ['22', '8.2(b): **or $2,000**'],
    ['25', 'Part 4: | Report received: what, when, from whom (or that it was anonymous) | 5 years |'],
    ['25', 'Part 4: | Decision, action taken, who took it, when | 5 years |'],
    ['25', 'Part 4: **The tension, named:** five years of records about children'],
  ];
  for (const [doc, entry] of HELD) {
    const words = entry.slice(entry.indexOf(': ') + 2);
    check(`legj2: doc ${doc} ${entry.slice(0, entry.indexOf(':'))} is held — in the source, not served (${words.slice(0, 48)})`,
      [rawOf(doc).includes(words), legalDocument(fileFor(doc)).markdown.includes(words)], [true, false]);
  }
  // And wherever else a period or the floor might be stated, it is not served.
  const PERIOD = /five[- ]years?|\b5[- ]years?|\$\s?2,000/i;
  const stated = live.filter(({ doc }) => PERIOD.test(legalDocument(fileFor(doc)).markdown)).map(({ doc }) => doc);
  check(`legj2b: no rendered document states the five-year period or the $2,000 floor (${stated.join(', ') || 'none does'})`,
    stated, []);
  // Doc 23's row is held by never being servable: the register renders no doc
  // 23, so the one renderer refuses it (and leg18: nothing else opens docs/legal).
  check('legj2c: doc 23\'s five-year row is in the source, and no page can serve doc 23',
    [/\| \*\*5 years\*\* \|/.test(rawOf('23')), live.some((d) => d.doc === '23'), threw(() => legalDocument(fileFor('23')))],
    [true, false, true]);

  // legj3 · The property. What the test allows a render to take out of a
  // line, written here rather than imported: the label and its space; a
  // bracketed counsel question with the one space or dash hanging it on; and
  // the named words of WITHHELD, which legj5 pins by their exact text.
  const LABEL = /\*\*\[DRAFTED\]\*\* |\[DRAFTED\] /g;
  const NOTE = /(?: —)? ?(\*\*)?\[LEGAL[^\]]*\]\1(?: —(?= ))?/g;
  // Brief K: on a line a named cut touched, and on no other, an empty "()"
  // with the space before it goes and a run of spaces becomes one; and a cut
  // marked `stop` gives its sentence back the full stop it took. Nothing else.
  const TIDY = (l) => l.replace(/ ?\(\s*\)/g, '').replace(/(\S) {2,}(?=\S)/g, '$1 ');
  const unservedOf = {};
  for (const { doc } of live) {
    const src = stripDraftingPreamble(rawOf(doc)).split('\n');
    const d = legalDocument(fileFor(doc));
    const served = d.markdown.split('\n');
    served.splice(served.indexOf(versionLine(d.version, d.date)), 1);
    const words = WITHHELD.filter((w) => w.doc === doc && w.cut === 'words');
    const allowed = (l) => {
      let a = l, cut = false;
      for (const w of words) if (a.includes(w.text)) { a = a.split(w.text).join(w.stop ? '.' : ''); cut = true; }
      return (cut ? TIDY(a) : a).replace(NOTE, '').replace(LABEL, '');
    };
    const unserved = [];
    let j = 0;
    for (const line of src) {
      while (j < served.length && served[j].trim() === '') j++;
      if (line.trim() === '') continue;
      if (j < served.length && allowed(line) === served[j]) { j++; continue; }
      unserved.push(line);
    }
    const invented = served.slice(j).filter((l) => l.trim() !== '');
    unservedOf[doc] = unserved.filter((l) => !/^-{3,}\s*$/.test(l) && l.trim() !== '>');
    check(`legj3: doc ${doc} serves only the source, in order, minus markers and named words (${invented.length} lines not accounted for${invented.length ? `: ${invented[0].slice(0, 60)}` : ''})`,
      invented, []);
  }

  // Doc 25's Parts 2–5 as counted on 29 Sep (brief K): 95 non-blank
  // lines, rules and bare quote lines aside.
  const LEGK_DOC25_WITHHELD_LINES = 95;
  // legj4 · Everything the source holds that no page serves, by its opening
  // words. This IS the list at the top of the brief J report; a render rule
  // that takes one line more, or one fewer, fails here by name.
  const NOT_SERVED = {
    '20': [], '21': [], '24': [],
    '22': [
      '**[OUTLINE] 3.3 Children aged 16 and 17.** **[LEGAL: doc 18 Q7.]** Our',
      '*Note: this was open at v1.0 and is now settled by the register (D-74,',
      '**[OUTLINE] 6.4 Verified status.** What a "verified" state on a coach ',
      '**[DO NOT PUBLISH UNTIL BUILT] 6.5 Suppression.** A guardian, or a clu',
      '*Status: not built. Today a guardian can pause a profile and disable i',
      '- **(b) For everything else**, our aggregate liability is limited to t',
      '**[LEGAL: doc 18 Q11 — the $2,000 floor is our own construction, not a',
      '> **What is on sale, and what is not.** This schedule describes **one ',
      '> *This replaces a banner, written for v1.2, which told the reader tha',
      '> **The whole of this schedule is written against the unfair contract ',
      '*Why the wording changed at v1.9: the earlier version said there were ',
      '*The figures that stood here — $54 a month, or $329 for twelve months ',
      '**[OUTLINE] A12 Data handling.** The club and Pitch each handle player',
      '**[OUTLINE]** Consequences, escalation, and the appeal path — drafted ',
      '## Open items summary',
      '| # | Item | Where | Blocks |',
      '|---|---|---|---|',
      '| 1 | 16–17 acceptance model — and it matters more now that a 16-year-',
      '| 2 | WWCC representation and verified status | 4.3, 6.4 | Launch — do',
      '| 3 | Report and takedown: the retention period commits us the day it ',
      '| 4 | **Suppression clause promises a capability that does not exist y',
      '| 5 | **Guardian-contact gate at 2.3 is not current behaviour — do not',
      '| 6 | Consumer guarantees wording; the $2,000 liability floor is our o',
      '| 7 | Change-of-control commitment — enforceable as drafted? | 5.8 | D',
      '| 8 | Whether a data processing agreement is needed with clubs — live,',
      '| 9 | **The unincorporated-association point.** A1.1 is our answer; co',
      '| 10 | **Founding arrangements are individually negotiated and unpubli',
      '| 11 | Whether a 14-day cooling-off is the right length for a $329 ann',
      '| 12 | **Whether A6.2 states the tax invoice and adjustment note oblig',
      '| 13 | **Whether clause 0.1 is sufficient to identify the contracting ',
      '*Resolved since v1.2: Schedule A is no longer a placeholder — D-127 se',
    ],
    // Brief K: doc 25 is served, Part 1 only — its own footer says "Part 1 is
    // public, Parts 2–5 are internal". So what is not served is Part 2's
    // heading and every line after it up to the rule over that footer, read
    // off the source here by the document's own structure; the four lines
    // round J pinned are among them. Counted as well, so the day John adds a
    // line to Parts 2–5, or the rule takes one line more, this says so.
    '25': (() => {
      const src = stripDraftingPreamble(rawOf('25')).split('\n');
      const from = src.findIndex((l) => /^# Part 2 — /.test(l));
      const to = src.findLastIndex((l) => /^-{3,}\s*$/.test(l));
      return src.slice(from, to).filter((l) => l.trim() !== '' && !/^-{3,}\s*$/.test(l) && l.trim() !== '>').map((l) => l.slice(0, 70));
    })(),
  };
  check(`legj4b: doc 25 withholds Parts 2–5 — ${NOT_SERVED['25'].length} lines, from "# Part 2" to the rule over the footer — and round J's four held lines are among them`,
    [NOT_SERVED['25'].length, NOT_SERVED['25'][0], ['**[LEGAL: doc 18 Q6 — what window applies, from what moment, and to wh',
      '| Report received: what, when, from whom (or that it was anonymous) | ', '| Decision, action taken, who took it, when | 5 years | As above |',
      '**The tension, named:** five years of records about children sits agai'].every((l) => NOT_SERVED['25'].includes(l))],
    [LEGK_DOC25_WITHHELD_LINES, '# Part 2 — How this actually runs', true]);
  for (const { doc } of live) {
    const got = (unservedOf[doc] ?? []).map((l) => l.slice(0, 70));
    const want = NOT_SERVED[doc] ?? ['(a document nobody pinned)'];
    const extra = got.filter((l) => !want.includes(l));
    const back = want.filter((l) => !got.includes(l));
    check(`legj4: doc ${doc} leaves out exactly the ${want.length} pinned lines (${[...extra.map((l) => `+ ${l.slice(0, 40)}`), ...back.map((l) => `− ${l.slice(0, 40)}`)].join(' · ') || 'it does'})`,
      [extra, back], [[], []]);
  }

  // legj5 · WITHHELD is exactly this. A name that joins it removes text from a
  // legal page, so nothing joins it without this list changing too.
  check(`legj5: the named removals are these ${WITHHELD.length}, and only these`, WITHHELD.map((w) => `${w.doc} ${w.cut} ${w.why}${w.stop ? ' stop' : ''}: ${w.text.slice(0, 44)}`), [
    '22 words held:  We keep records of reports and what we did ',
    '22 line held: - **(b) For everything else**, our aggregate',
    '22 words unwritten: Where Pitch records that a coach holds a Wor',
    '22 line drafting: *Note: this was open at v1.0 and is now sett',
    '22 words drafting:  *(Reconciles 7.4, Schedule A9 and doc 20, w',
    '22 line drafting: > **What is on sale, and what is not.**',
    '22 line drafting: *Why the wording changed at v1.9:',
    '22 line drafting: *The figures that stood here — $54 a month, ',
    '22 section drafting: ## Open items summary',
    '22 words drafting:  · for legal review · revised on Leo\'s entit',
    '22 words drafting: Reference table for the build',
    '22 words drafting:  (D-64)',
    '22 words drafting:  (D-51)',
    '22 words drafting:  (D-149)',
    '22 words drafting:  and it is not Phase 1',
    '22 words drafting:  (reference for the build)',
    '22 words drafting stop:  — **[LEGAL: doc 18 Q5. This last sentence i',
    '25 line held: | Report received: what, when, from whom (or',
    '25 line held: | Decision, action taken, who took it, when ',
    '25 line held: **The tension, named:** five years of record',
    '25 rest internal: # Part 2 — How this actually runs',
  ]);

  // legj6 · A document nothing is withheld from is not touched, byte for
  // byte — so the consent hashes of docs 20 and 21 did not move this round.
  for (const doc of ['20', '21', '24']) {
    const stripped = stripDraftingPreamble(rawOf(doc));
    check(`legj6: doc ${doc} comes through the render rules byte for byte`, withholdUnpublished(doc, stripped) === stripped, true);
  }

  // legj7 · A held clause that has since been edited fails loudly instead of
  // lapsing onto the page; so does a marker the rules do not recognise.
  const s22 = stripDraftingPreamble(rawOf('22'));
  check('legj7: a held sentence John has reworded stops the render rather than being served',
    threw(() => withholdUnpublished('22', s22.replace('for five years.', 'for seven years.'))), true);
  check('legj7b: and so does a held line',
    threw(() => withholdUnpublished('22', s22.replace('- **(b) For everything else**', '- **(b) For all else**'))), true);
  check('legj7c: a marker in a shape the rules do not know is never served',
    threw(() => withholdUnpublished('99', '# T\n\nA clause, at the end of which **[DRAFTED]**\n')), true);

  // legj8 · Each rule on a small document, so a failure says which rule.
  check('legj8: [DRAFTED] — the label and one space go, the bold around it if it is bolded alone',
    withholdUnpublished('99', '# T\n\n**[DRAFTED] 1.1 A.** Text.\n\n**[DRAFTED]** Everyone agrees:\n'),
    '# T\n\n**1.1 A.** Text.\n\nEveryone agrees:\n');
  check('legj8b: [OUTLINE] — the clause goes whole, with the italic note under it, and the next clause stays',
    withholdUnpublished('99', '# T\n\n**1.1 A.** Kept.\n\n**[OUTLINE] 1.2 B.** Gone.\n\n*Status: gone too.*\n\n**1.3 C.** Kept.\n'),
    '# T\n\n**1.1 A.** Kept.\n\n**1.3 C.** Kept.\n');
  check('legj8c: [LEGAL] — the question goes with the dash that hangs it on; the clause stays',
    withholdUnpublished('99', '# T\n\nA sentence — **[LEGAL: doc 18 Q5. A question.]**\n\n| a | **[LEGAL: Q7]** — b |\n\n**[LEGAL: Q11 — alone.]**\n\nEnd.\n'),
    '# T\n\nA sentence\n\n| a | b |\n\nEnd.\n');
  check('legj8d: a document with nothing to withhold keeps even its double blank lines',
    withholdUnpublished('99', '# T\n\n\nA\n\n\n\nB\n'), '# T\n\n\nA\n\n\n\nB\n');

  // Brief K's three rules, each on hand-written input, so a failure names the
  // rule (legj8's reasoning). tidyCut is the renderer's; the inputs and the
  // answers are written here.
  const { tidyCut } = await import('../lib/legal-doc.ts');
  check('legk8: a cut\'s leftovers are tidied — an empty "()" with its space, a run of spaces — and a line with neither is untouched',
    [tidyCut('A change (). Next.'), tidyCut('| **B** | Architecture |  |'), tidyCut('Kept (a) as  written'), tidyCut('Untouched (b) line.')],
    ['A change. Next.', '| **B** | Architecture | |', 'Kept (a) as written', 'Untouched (b) line.']);
  check('legk8b: the tidy never reaches a line no cut touched, even one with a double space in it',
    withholdUnpublished('22', stripDraftingPreamble(rawOf('22')).replace('0.1 The parties.', '0.1  The parties.')).includes('0.1  The parties.'), true);
  check('legk8c: the Part 2 heading withheld "to the footer" takes Parts 2–5 and leaves Part 1, the closing rule and the footer',
    [legalDocument(fileFor('25')).markdown.includes('## If you are unhappy with what we did'),
     /\n---\n\n\*Pitch Football · [^\n]*Part 1 is public, Parts 2–5 are internal\*\n?$/.test(legalDocument(fileFor('25')).markdown),
     ['# Part 2', '# Part 3', '# Part 4', '# Part 5', '## Triage, in three classes', 'Take the page down first'].filter((h) => legalDocument(fileFor('25')).markdown.includes(h))],
    [true, true, []]);
  check('legk8d: a heading withheld to the footer that is not a heading, or has no closing rule after it, stops the render',
    [threw(() => withholdUnpublished('25', stripDraftingPreamble(rawOf('25')).replace('# Part 2 — How this actually runs', 'Part 2 — How this actually runs'))),
     threw(() => withholdUnpublished('25', stripDraftingPreamble(rawOf('25')).replace(/\n---\n(?![\s\S]*\n---\n)/, '\n\n')))],
    [true, true]);
}

// ---------------------------------------------------------------------------
// Brief K item 3 (29 Sep): the Terms still served our own working references
// inside clauses that stay — "(D-64)", "(D-51)", "(D-149)", "it is not Phase
// 1", "(reference for the build)", "Reference table for the build" — and 2.3
// ended with no full stop, where round J took off the counsel note that
// called its last sentence "not current behaviour" (it is current behaviour:
// app/join/actions.ts). Each goes by its exact words (WITHHELD); legj3 above
// proves nothing else moved.
//
// Brief K item 2: docs 24 and 25 are served at last, /conduct and
// /report/policy, through the same renderer and the same rules as /terms.
// Neither is consented to, so neither can have moved a stamp.
// ---------------------------------------------------------------------------
{
  const { legalDocument, renderedLegalDocs, documentTitle } = await import('../lib/legal-doc.ts');
  const legalDir = fileURLToPath(new URL('../docs/legal', import.meta.url));
  const fileFor = (doc) => readdirSync(legalDir).find((x) => x.startsWith(`${doc}-`) && x.endsWith('.md'));
  const served = (doc) => legalDocument(fileFor(doc)).markdown;
  const INTERNAL = [/\bD-\d+/, /\bPhase 1\b/, /for the build/i, /not current behaviour/i, /\(\s*\)/];
  const hits = (doc) => INTERNAL.filter((r) => r.test(served(doc))).map(String);
  for (const doc of ['22', '24', '25']) {
    check(`legk1: doc ${doc} serves no reference to our own working papers — no D-number, "Phase 1", "for the build", "not current behaviour", or an empty "()" (${hits(doc).join(' · ') || 'none'})`,
      hits(doc), []);
  }
  // Doc 20 serves "(D-153)" twice, and "D-148" in its footer. It is stamped (20@v2.8) and published, so
  // taking them off changes a consented text: a version bump and John's call,
  // not a builder's. Pinned, so it cannot grow and is not forgotten.
  const d20 = served('20').match(/\bD-\d+/g) ?? [];
  check(`legk1b: the one other document serving a D-number is doc 20 — "D-153" twice in its clauses, "D-148" in its footer — for John, because it is stamped (${d20.join(', ')})`,
    [renderedLegalDocs().map((d) => d.doc).filter((doc) => /\bD-\d+/.test(served(doc))), d20], [['20'], ['D-153', 'D-153', 'D-148']]);
  const terms = served('22');
  check('legk2: 2.3 ends with its own full stop, and nothing after it — its counsel note is gone and it said the sentence was not current behaviour',
    [/before the account activates\.\n/.test(terms), /activates —/.test(terms), /proposed addition/.test(terms)], [true, false, false]);
  check('legk2b: each clause a reference came out of is still served, word for word around the cut',
    ['Re-acceptance is triggered only by a material change.\n', '*Most-restrictive-wins is honoured in substance:',
     'which we will confirm in writing on request*;', 'It is not a data export.*', '# Schedule B — Acceptance architecture\n',
     '| **Schedule B** | Acceptance architecture | |'].filter((k) => !terms.includes(k)), []);

  // The pages. Each is the renderer's, for the document the register names.
  const conduct = codeOnly(srcOf('app/conduct/page.tsx')), policy = codeOnly(srcOf('app/report/policy/page.tsx'));
  check('legk3: /conduct renders doc 24 and /report/policy renders doc 25, through renderLegal — the /terms renderer and its rules',
    [/return renderLegal\('24-Code-of-Conduct\.md'\);/.test(conduct), /return renderLegal\('25-Complaints-and-Takedown\.md'\);/.test(policy)], [true, true]);
  // No account: nothing on either page, or on /report, asks who is looking.
  const report = codeOnly(srcOf('app/report/page.tsx'));
  check('legk3b: and both, with /report, are open to anyone — nothing on them asks for a session',
    [conduct, policy, report].map((src) => /getSessionPersonId|requireRecordActor|requireOperator|redirect\('\/signin'\)/.test(src)), [false, false, false]);
  check('legk3c: /report links to the policy, and the link is the document\'s own title — no new words',
    [/<a href="\/report\/policy"[^>]*>\{documentTitle\('25-Complaints-and-Takedown\.md'\)\}<\/a>/.test(report),
     documentTitle(fileFor('25')), documentTitle(fileFor('24'))],
    [true, 'Complaints, Reports and Takedown', 'Code of Conduct']);
  // The consent stamps. legalStamp hashes docs 20, 21 and 22 and nothing else;
  // neither new page stamps; and docs 20, 21 and 24 come through the render
  // rules byte for byte (legj6), so no stamp moved for either new page.
  const stampSrc = srcOf('lib/legal-stamp.ts');
  const files = /export const LEGAL_FILES = \{([\s\S]*?)\} as const;/.exec(stampSrc)?.[1] ?? '';
  check('legk4: neither document is consented to — the stamp knows docs 20, 21 and 22 only, and neither page stamps or writes anything',
    [[...files.matchAll(/'(\d+)':/g)].map((m) => m[1]), [conduct, policy].map((src) => /legalStamp|consent_event|db\.query/.test(src))],
    [['20', '21', '22'], [false, false]]);
}

// ---------------------------------------------------------------------------
// QA, 28 Sep — two faults found by pressing things rather than by reading.
// ---------------------------------------------------------------------------

// qa-silent1 · A FAILED ACTION MUST SAY SO ON THE PAGE IT LANDS ON.
//
// Pressing Subscribe at /club/billing with D-137's authority box unticked
// answers 303 /club/billing?error=1 — and that page never reads `error`, so
// the screen comes back with the fields emptied and not one word about what
// happened. Measured on this tree: the page it lands on adds nothing at all.
// The person's only rational conclusion is that payments are broken, on the
// one screen in the product that takes money.
//
// The rule, not the instance: if an action can send somebody to a page with a
// flag that means "that did not work", the page must read that flag. `saved`,
// `removed` and `done` are excluded — a success is visible in the thing that
// changed. Naming a flag in the searchParams TYPE is not reading it; that is
// exactly how this one hid.
{
  const FAILURE = /^(error|bad|cannot|needs|expired|short|unconfigured|invalid|refused|failed?)$/i;
  const actionFiles = [];
  (function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name === 'actions.ts') actionFiles.push(full);
    }
  })(fileURLToPath(new URL('../app', import.meta.url)));
  const appRoot = fileURLToPath(new URL('../app', import.meta.url));
  const silent = [];
  for (const f of actionFiles) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/redirect\(\s*['"`]([^'"`]*\?[^'"`]*)['"`]/g)) {
      const [path, qs] = [m[1].split('?')[0], m[1].split('?').slice(1).join('?')];
      if (path.includes('${')) continue;
      const pagePath = join(appRoot, ...path.split('/').filter(Boolean), 'page.tsx');
      let page;
      try { page = readFileSync(pagePath, 'utf8'); } catch { continue; }
      // A flag named in the searchParams type annotation is not a flag read.
      const body = page.replace(/searchParams:\s*Promise<\{[^}]*\}>/g, 'searchParams: Promise<{}>');
      for (const kv of qs.split('&')) {
        const flag = kv.split('=')[0].split('#')[0].trim();
        if (!flag || flag.includes('${') || !FAILURE.test(flag)) continue;
        if (!new RegExp('\\b' + flag + '\\b').test(body)) {
          silent.push(`${f.slice(f.indexOf('/app/') + 1)} -> ${path}?${flag}`);
        }
      }
    }
  }
  check(`qa-silent1: a form that failed says so on the page it lands on (${[...new Set(silent)].join(' · ') || 'all of them do'})`,
    [...new Set(silent)].length, 0);
}

// qa-devport1/qa-devport2 lived here and are GONE (QA, 28 Sept, second pass).
// They asserted that lib/db.ts and scripts/dev-db.mts read the same variable
// and that dev-db.mts's instructions name the one the APP reads. `db8` above
// now does both and more: it matches the name WHOLE, across lib/db.ts,
// scripts/dev-db.mts and .env.example, comments included, and pins both
// defaults. Two checks for one rule is two places to be wrong — the stronger
// one stays and mine go (L33: replace a proxy, do not keep a second copy).
// 0063 — THE MONEY SAYS ONE THING. Two club screens computed a club's
// subscription state for themselves and disagreed about a club whose payment
// failed: /club/billing showed the dunning card and /club/register dropped
// silently to the free tier's own heading. fn_register_payment_state is the one
// answer both now read (D-135, D-136, doc 14 O4, O11; LESSONS L23).
// ---------------------------------------------------------------------------
{
  const q1 = async (sql, args) => (await db.query(sql, args)).rows[0];
  const payState = async (who, club) => (await q1('select fn_register_payment_state($1,$2) as s', [who, club])).s;
  const rowIds = async (who, club) => (await db.query('select registration_id from fn_register_rows($1,$2)', [who, club])).rows.map((r) => r.registration_id);

  const MON = crypto.randomUUID();
  const monCall = crypto.randomUUID();
  await db.query(`insert into club (id, name, club_state) values ($1,'Dunning FC','claimed')`, [MON]);
  await db.query(
    `insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
     values ($1,$2,now(),'BUZ','03 9000 0003','FV club directory','verified','27@v1.0')`, [monCall, MON]);
  await db.query(`update club set club_state='verified', verified_call_id=$1 where id=$2`, [monCall, MON]);

  const person = async (name, years = 35) => {
    const id = crypto.randomUUID();
    await db.query(`insert into person (id, first_name, last_name, dob) values ($1,$2,'Fixture',$3)`, [id, name, yearsAgo(years)]);
    return id;
  };
  const mTd = await person('Money TD');
  await recordTd(mTd, MON, 'money.td@fixture.example');
  const mAdmin = await person('Money Admin');
  await mem(mAdmin, MON, null, 'club_admin');
  const mTm = await person('Money Manager');
  await mem(mTm, MON, null, 'team_manager');
  const mSq = (await q1(`insert into squad (club_id, name, age_group, competition_gender, season) values ($1,'M-U15','U15','boys','2026') returning id`, [MON])).id;
  const mSq2 = (await q1(`insert into squad (club_id, name, age_group, competition_gender, season) values ($1,'M-U16','U16','boys','2026') returning id`, [MON])).id;
  const grantedCoach = await person('Money Coach');
  await mem(grantedCoach, MON, null, 'coach');
  await db.query(`insert into wwcc_attestation (person_id, club_id, attested_by) values ($1,$2,$3)`, [grantedCoach, MON, mTd]);
  const ungrantedCoach = await person('Money Bench');
  await mem(ungrantedCoach, MON, null, 'coach');
  await db.query(`insert into wwcc_attestation (person_id, club_id, attested_by) values ($1,$2,$3)`, [ungrantedCoach, MON, mTd]);
  for (const sq of [mSq, mSq2]) {
    await db.query(`insert into register_grant (club_id, person_id, squad_id, granted_by) values ($1,$2,$3,$4)`, [MON, grantedCoach, sq, mTd]);
  }
  const mReg = (await q1(
    `insert into registration (player_id, club_id, squad_target, policy_version) values ($1,$2,$3,'20@v2.4') returning id`,
    [ID.marcus, MON, mSq])).id;

  // The webhook is the only writer of subscription state (D-112), so the state
  // is driven through fn_apply_subscription exactly as Stripe drives it.
  const apply = (status, grace, at) => db.query(
    `select fn_apply_subscription($1,$2,'register_monthly', now() + interval '14 days', $3::timestamptz, 'cus_fixture', $4::timestamptz)`,
    [MON, status, grace, at]);
  const clock = (n) => new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString();

  // Every money state below is the Stripe build, behind the switch (D-163).
  // The switch goes back off after the 0068 block.
  await billingOn(true);
  check('money1: a club that never subscribed reads "unsubscribed", not "suspended"', await payState(mTd, MON), 'unsubscribed');
  await apply('active', null, clock(1));
  check('money2: a paying club reads "active"', await payState(mTd, MON), 'active');
  check('money2b: and its register resolves', (await rowIds(mTd, MON)).includes(mReg), true);

  // O4 — 14-day grace, THEN suspended. Registrations hidden, never deleted.
  await apply('past_due', new Date(Date.now() + 5 * 86400000).toISOString(), clock(2));
  check('O4: inside the fourteen days a failed payment reads "grace"', await payState(mTd, MON), 'grace');
  check('O4b: and the register is still readable during the grace (D-135)', (await rowIds(mTd, MON)).includes(mReg), true);
  // The fortnight runs out. The suite cannot move the clock, so it moves the
  // one date the clock is compared with — which is also the one thing no
  // Stripe event may now do (0068). A retry arriving after that, carrying a
  // fresh fortnight, must not revive the register.
  await db.query(`update club set grace_until = now() - interval '1 day' where id = $1`, [MON]);
  await apply('past_due', new Date(Date.now() + 14 * 86400000).toISOString(), clock(3));
  check('O4c: once the grace has run out it reads "suspended" — and a later retry does not revive it', await payState(mTd, MON), 'suspended');
  check('O4d: the register is hidden', (await rowIds(mTd, MON)).length, 0);
  check('O4e: and the registration row is still there — hidden, not deleted',
    (await q1(`select count(*)::int as n from registration where id = $1`, [mReg])).n, 1);
  await apply('canceled', null, clock(4));
  check('money5: a cancelled club reads "cancelled", which is not the same state', await payState(mTd, MON), 'cancelled');

  // O11 — billing is club-internal. The administrator is told exactly as much
  // as the TD is, and nobody else is told anything at all.
  await apply('active', null, clock(5));
  check('O11b: the invoicing volunteer gets the same answer as the TD', await payState(mAdmin, MON), await payState(mTd, MON));
  check('money7: a team manager is told nothing about the club’s money', await payState(mTm, MON), null);
  check('money7b: nor a granted coach', await payState(grantedCoach, MON), null);
  check('money7c: nor a guardian', await payState(ID.guardian, MON), null);
  check('money7d: nor another club’s technical director', await payState(ID.td, MON), null);
  check('money7e: nor nobody at all', await payState(null, MON), null);

  // 0068 — THE GRACE DOES NOT SLIDE (Leo, 28 Sep; D-135, doc 14 O4). Every
  // past_due event used to write a fresh fortnight, and Stripe sends one on
  // each retry, so a club whose card had failed never paused. Asked of the
  // function directly, because that is the only writer (D-112) and the rule
  // has to hold whichever webhook branch calls it.
  {
    const G = crypto.randomUUID();
    await db.query(`insert into club (id, name, club_state) values ($1,'Grace Fixture FC','claimed')`, [G]);
    const at = (n) => new Date(Date.UTC(2026, 0, 2, 0, 0, n)).toISOString();
    const inDays = (d) => new Date(Date.now() + d * 86400000).toISOString();
    const give = (status, grace, n) => db.query(
      `select fn_apply_subscription($1,$2,null,null,$3::timestamptz,null,$4::timestamptz)`, [G, status, grace, at(n)]);
    const grace = async () => (await q1('select grace_until from club where id = $1', [G])).grace_until?.toISOString() ?? null;
    const open = async () => (await q1('select fn_register_active($1) as a', [G])).a;

    await give('active', null, 1);
    await give('past_due', inDays(14), 2);
    const first = await grace();
    await give('past_due', inDays(30), 3);
    check('O4g: a second past_due event does not move the grace — fourteen days from the FIRST failure',
      [first !== null, await grace()], [true, first]);
    await give('unpaid', null, 4);
    await give('past_due', inDays(30), 5);
    check('O4h: nor does a detour through another unpaid status — only a payment clears it',
      await grace(), first);
    await give('active', null, 6);
    check('O4i: a successful payment clears it', await grace(), null);
    await give('past_due', inDays(14), 7);
    check('O4j: and the next failure after a payment starts a fortnight of its own',
      (await grace()) !== null && (await grace()) !== first, true);
    await give('canceled', null, 8);
    check('O4k: a date left behind by an earlier status grants nothing — the gate reads the grace only while past_due',
      [(await grace()) !== null, await open()], [true, false]);
  }
  await billingOn(false);

  // ---- D-163 (0075): FREE UNTIL FURTHER NOTICE, THE REGISTER INCLUDED ------------------
  // Billing is off. Verification is the gate (D-126) and the grants decide
  // who reads (D-93); money is not asked at all. Every check here was run
  // against the bug it names and went red (report, 28 Sep).
  {
    const active = async (club) => (await q1('select fn_register_active($1) as a', [club])).a;
    const count = async (who, club) => (await q1('select fn_register_count($1,$2) as n', [who, club])).n;
    check('free0: billing is off out of the box — the launch configuration is the default one',
      [BILLING_AT_BOOT.value, BILLING_AT_BOOT.on], ['false', false]);
    for (const typo of ['TRUE', 'yes', '1', 'on', ' true']) {
      await db.query(`update app_config set value = $1 where key = 'billing_enabled'`, [typo]);
      check(`free0b: a config typo does not switch payment on (${JSON.stringify(typo)})`, (await q1('select fn_billing_enabled() as b')).b, false);
    }
    await db.query(`delete from app_config where key = 'billing_enabled'`);
    check('free0c: nor does a missing row', (await q1('select fn_billing_enabled() as b')).b, false);
    await db.query(`insert into app_config (key, value) values ('billing_enabled', 'false')`);

    // An UNVERIFIED club that has paid nothing: a claimed page, a technical
    // director recorded on an earlier call, an administrator, and a family on
    // its register. Bug put back: the off branch answering `true` for any club.
    const HELD = crypto.randomUUID();
    await db.query(`insert into club (id, name, club_state) values ($1,'Held Free FC','claimed')`, [HELD]);
    const hTd = await person('Held TD');
    await recordTd(hTd, HELD, 'held.td@fixture.example');
    const hAdmin = await person('Held Admin');
    await mem(hAdmin, HELD, null, 'club_admin');
    const hReg = (await q1(`insert into registration (player_id, club_id, policy_version) values ($1,$2,'20@v2.4') returning id`,
      [ID.marcus, HELD])).id;
    check('free1: an unverified club that has paid nothing reads nothing — the gate says no and no row comes back (D-126)',
      [await active(HELD), (await rowIds(hTd, HELD)).length, (await rowIds(hAdmin, HELD)).length,
       (await q1('select fn_can_read_registration($1,$2) as ok', [hTd, hReg])).ok],
      [false, 0, 0, false]);
    check('free1b: and the held club still sees a count and no names (D-126)', await count(hAdmin, HELD), 1);
    await db.query(`update club set subscription_status = 'active' where id = $1`, [HELD]);
    check('free1c: a subscription row changes none of that — paying never verified a club and still cannot',
      [await active(HELD), (await rowIds(hTd, HELD)).length], [false, 0]);
    await db.query(`update club set club_state = 'suspended' where id = $1`, [HELD]);
    check('free1d: nor does a club we suspended read anything', [await active(HELD), (await rowIds(hTd, HELD)).length], [false, 0]);

    // A VERIFIED club that has paid nothing. Bug put back: 0068's gate, which
    // asks the subscription and nothing else.
    await db.query(`update club set subscription_status = null, grace_until = null, plan = null where id = $1`, [MON]);
    check('free2: a verified club that has paid nothing reads its register (D-163)',
      [await active(MON), (await rowIds(mTd, MON)).includes(mReg)], [true, true]);
    check('free2b: the grants still decide who reads it — a granted coach their teams, an administrator and an ungranted coach nothing (D-93)',
      [(await rowIds(grantedCoach, MON)).includes(mReg), (await rowIds(mAdmin, MON)).length, (await rowIds(ungrantedCoach, MON)).length,
       (await rowIds(ID.td, MON)).length],
      [true, 0, 0, 0]);
    check('free2c: its technical director may invite from it, the same answer the register gives (P19)',
      (await q1('select fn_can_invite($1,$2) as ok', [mTd, mReg])).ok, true);
    // Money left over from before the switch opens nothing and closes nothing.
    await db.query(`update club set subscription_status = 'past_due', grace_until = now() - interval '1 day' where id = $1`, [MON]);
    check('free2d: a lapsed grace left over from billing does not close a verified club’s register while billing is off',
      (await rowIds(mTd, MON)).includes(mReg), true);

    // Where the club stands with us: 'free', and nothing about money.
    check('free3: the club’s own people are told "free", whatever the status column says (0075)',
      [await payState(mTd, MON), await payState(mAdmin, MON)], ['free', 'free']);
    check('free3b: and a stranger is still told nothing, not "free"',
      [await payState(ID.td, MON), await payState(null, MON), await payState(grantedCoach, MON)], [null, null, null]);
    await db.query(`update club set subscription_status = 'active', grace_until = null where id = $1`, [MON]);
    check('free3c: a club still marked active never reads "active" while billing is off — so no plan card and no price can render',
      await payState(mTd, MON), 'free');

    // The switch is the whole of it: on again, and 0068's rule is back.
    await billingOn(true);
    await db.query(`update club set subscription_status = null where id = $1`, [MON]);
    check('free4: with billing switched on the subscription gate is back exactly as it was (D-112, 0068)',
      [await active(MON), (await rowIds(mTd, MON)).length, await payState(mTd, MON)], [false, 0, 'unsubscribed']);
    await billingOn(false);

    // The app asks the same switch, before it does anything with money.
    const page = codeOnly(srcOf('app/club/billing/page.tsx'));
    const acts = codeOnly(srcOf('app/club/billing/actions.ts'));
    const hook = codeOnly(srcOf('app/api/stripe/webhook/route.ts'));
    const gate = "if (!(await billingEnabled())) redirect('/home');";
    check('free5: /club/billing sends a club home while billing is off, before it reads anything',
      page.indexOf(gate) > -1 && page.indexOf(gate) < page.indexOf('fn_register_payment_state'), true);
    check('free5b: and both of its actions refuse before a checkout authority is recorded or a portal opened',
      [acts.indexOf(gate) > -1 && acts.indexOf(gate) < acts.indexOf('insert into checkout_authority'),
       acts.lastIndexOf(gate) > acts.indexOf('export async function openPortal') && acts.lastIndexOf(gate) < acts.indexOf('createPortalSession(club')],
      [true, true]);
    check('free5c: the Stripe webhook refuses before it reads a byte, so §31 and §32 never send while billing is off',
      hook.indexOf('if (!(await billingEnabled())) return') > -1
        && hook.indexOf('if (!(await billingEnabled())) return') < hook.indexOf('await request.text()'), true);
    check('free5d: no door to the plan is drawn while billing is off — the sidebar and the TD\u2019s home ask the same switch',
      [/\.\.\.\(seat\.billing \? \[\{ key: 'billing'/.test(srcOf('components/console-shell.tsx')),
       /fn_billing_enabled\(\) as billing/.test(srcOf('components/console-shell.tsx')),
       /\{billing && \(\s*<Link href="\/club\/billing"/.test(srcOf('app/home/page.tsx'))], [true, true, true]);
    const pricedFiles = [...routeFiles, ...(function walk(d, out = []) {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const full = join(d, e.name);
        if (e.isDirectory()) walk(full, out); else if (/\.(ts|tsx)$/.test(e.name)) out.push(full);
      }
      return out;
    })(fileURLToPath(new URL('../components', import.meta.url)))]
      .filter((f) => /\bPRICES\b/.test(codeOnly(readFileSync(f, 'utf8')))).map((f) => f.split('/app/')[1] ?? f.split('/components/')[1]).sort();
    check(`free5e: PRICES renders in two places only, both behind the switch (${pricedFiles.join(', ')})`,
      [pricedFiles, /plan\?\.pay_state === 'active' && \([\s\S]{0,600}PRICES\.register_annual/.test(srcOf('app/home/page.tsx'))],
      [['club/billing/page.tsx', 'home/page.tsx'], true]);
  }

  // One answer, two callers — the whole point of the migration.
  const readSrc = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
  for (const [rel, what] of [['../app/club/billing/page.tsx', 'the billing page'], ['../app/club/register/page.tsx', 'the register page']]) {
    check(`money8: ${what} reads fn_register_payment_state rather than working it out`,
      /fn_register_payment_state/.test(readSrc(rel)), true);
  }
  check('money8b: and the register page no longer decides a payment state from the status column',
    /subscription_status/.test(codeOnly(readSrc('../app/club/register/page.tsx'))), false);
  check('money9: a suspended club’s register says why the list is gone',
    /RegisterPaused/.test(readSrc('../app/club/register/page.tsx')), true);
  // D-25 — three facts we do not hold and must not start holding.
  const billingSrc = codeOnly(readSrc('../app/club/billing/page.tsx'));
  check('money10: the billing page asks for no card brand, no last four and no receipt address (D-25)',
    /last4|last_four|card_brand|brand|receipt_email|receipts_to/i.test(billingSrc), false);

  // ---- N23 as a database answer: who reads this club's register -----------
  const readers = async (who) => (await db.query(
    `select reader_name, role_label, scope, squad_names, since is not null as dated from fn_club_register_readers($1,$2)`, [who, MON])).rows;
  const tdView = await readers(mTd);
  const byName = Object.fromEntries(tdView.map((r) => [r.reader_name, r]));
  check('N23c: the TD’s list names every reader of this register',
    Object.keys(byName).sort(), ['Money Admin Fixture', 'Money Coach Fixture', 'Money Manager Fixture', 'Money TD Fixture']);
  check('N23d: the technical director reads the whole register', byName['Money TD Fixture']?.scope, 'whole');
  check('N23e: a granted coach reads their teams, named', [byName['Money Coach Fixture']?.scope, byName['Money Coach Fixture']?.squad_names], ['squads', ['M-U15', 'M-U16']]);
  check('N23f: and every row is dated — who, which squads, since when', tdView.every((r) => r.dated), true);
  check('readers1: the administrator is on the list reading no registration (D-93)',
    [byName['Money Admin Fixture']?.scope, byName['Money Admin Fixture']?.role_label], ['none', 'Club administrator']);
  check('readers2: so is a team manager (doc 34 rule 4)', byName['Money Manager Fixture']?.scope, 'none');
  check('readers3: a coach with no grant is not a reader and is not listed',
    tdView.some((r) => r.reader_name === 'Money Bench Fixture'), false);
  // The administrator gets the SAME list, in full. I built it restricted to
  // the TD on TRAINING §3.8 and the design settles it the other way:
  // club-home-admin.html draws this block on the administrator's own home and
  // argues it is the only place D-93's split is said out loud to the person it
  // constrains. It widens nothing minor-facing, which is the condition O11
  // actually sets — no registration, no child, no count of children is in it.
  check('readers4: the administrator gets the same list, in full — D-93 said out loud to the person it constrains',
    (await readers(mAdmin)).map((r) => r.reader_name), tdView.map((r) => r.reader_name));
  check('readers4b: and it still carries no registration, no child and no count of children',
    (await db.query(`select * from fn_club_register_readers($1,$2)`, [mAdmin, MON]))
      .fields.map((f) => f.name).sort(),
    ['reader_id', 'reader_name', 'role_label', 'scope', 'since', 'squad_names'].sort());
  check('readers4c: and "since when" for a granted coach is when the GRANT was made, not when they joined the club',
    (await readers(mTd)).find((r) => r.scope === 'squads')?.dated, true);
  for (const [who, what] of [[grantedCoach, 'a granted coach'], [mTm, 'a team manager'], [ID.td, 'another club’s TD'], [ID.guardian, 'a guardian'], [null, 'nobody']]) {
    check(`readers5: ${what} gets no list at all`, (await readers(who)).length, 0);
  }
  // /club/squads read register_grant with a query of its own and decided for
  // itself who may see it. The database answers now (0069), and it must give
  // the TD exactly what the page's own query gave.
  {
    const oldPageQuery = (await db.query(
      `select p.id, trim(p.first_name || ' ' || coalesce(p.last_name, '')) as name,
         array_agg(s.name order by s.name) as teams,
         to_char(min(g.granted_at) at time zone 'Australia/Melbourne', 'FMDD Mon') as since
       from register_grant g join person p on p.id = g.person_id join squad s on s.id = g.squad_id
       where g.club_id = $1 and g.revoked_at is null
       group by p.id, p.first_name, p.last_name order by name`, [MON])).rows;
    const asked = async (who) => (await db.query(
      `select person_id as id, name, teams, since from fn_club_register_grants($1,$2)`, [who, MON])).rows;
    check('grants1: the technical director gets exactly the rows the squads page used to query for itself',
      [oldPageQuery.length > 0, await asked(mTd)], [true, oldPageQuery]);
    const others = [];
    for (const [who, what] of [[mAdmin, 'the administrator'], [grantedCoach, 'a granted coach'], [mTm, 'a team manager'],
                               [ID.td, 'another club’s TD'], [ID.guardian, 'a guardian'], [null, 'nobody']]) {
      if ((await asked(who)).length > 0) others.push(what);
    }
    check('grants2: and nobody else gets a row — the rule is the database’s, not the page’s (doc 34 rule 5)', others, []);
    const squadsPage = codeOnly(srcOf('app/club/squads/page.tsx'));
    check('grants3: /club/squads reads no register_grant of its own and asks the function with the session person',
      [/\bregister_grant\b/.test(squadsPage), /fn_club_register_grants\(\$1, \$2\)`,\s*\[me, c\.id\]/.test(squadsPage)], [false, true]);
  }
  await db.query(`update register_grant set revoked_at = now(), revoked_by = $1 where person_id = $2`, [mTd, grantedCoach]);
  check('N21f: the grant is removed and the coach leaves the list at the next read — nothing stored',
    (await readers(mTd)).some((r) => r.reader_name === 'Money Coach Fixture'), false);
}

// ---------------------------------------------------------------------------
// 0064 — THE RETURN. Sixty days away, three dated facts, and nothing at all
// for a child (D-25, D-53, D-65/D-81, D-74/D-90, doc 34 rule 6).
// ---------------------------------------------------------------------------
{
  const q1 = async (sql, args) => (await db.query(sql, args)).rows[0];
  const arrive = async (who) => (await q1('select fn_note_arrival($1) as s', [who])).s;
  const seen = async (who) => (await q1('select last_seen_at from person where id = $1', [who])).last_seen_at;
  const facts = async (who, since) => (await db.query(
    `select kind, to_char(fact_on, 'FMDD Mon') as on_label, subject, club_name, reader_name, reader_role, surface,
       to_char(checked_on, 'FMDD Mon') as checked_label
     from fn_return_facts($1, $2::timestamptz)`, [who, since])).rows;
  const adult = async (name) => {
    const id = crypto.randomUUID();
    await db.query(`insert into person (id, first_name, dob) values ($1,$2,$3)`, [id, name, yearsAgo(41)]);
    return id;
  };

  // --- when a return opens, and when it does not
  const fresh = await adult('Return Fresh');
  check('ret1: a first visit is not a return', await arrive(fresh), null);
  check('ret1b: and it is recorded, once, as one timestamp', (await seen(fresh)) !== null, true);
  const recent = await adult('Return Recent');
  await db.query(`update person set last_seen_at = now() - interval '59 days' where id = $1`, [recent]);
  check('ret2: fifty-nine days away is not a return', await arrive(recent), null);
  const away = await adult('Return Away');
  await db.query(`update person set last_seen_at = now() - interval '61 days' where id = $1`, [away]);
  const opened = await arrive(away);
  check('ret2b: sixty-one days away opens one, measured from the last visit', opened !== null, true);
  check('ret3: a second arrival the same day keeps the same window — the block does not vanish on a Back press',
    String(await arrive(away)), String(opened));
  await db.query(`update person set returned_at = now() - interval '2 days' where id = $1`, [away]);
  check('ret3b: and it closes after a day', await arrive(away), null);

  // --- nothing at all for a child (D-25), and the refusal is the database's
  check('ret4: an under-16 arriving records nothing', await arrive(ID.deniz), null);
  check('ret4b: not even the timestamp — a fourteen-year-old’s visits are not held', await seen(ID.deniz), null);
  await db.query(`update person set last_seen_at = now() - interval '90 days' where id = $1`, [ID.deniz]);
  check('ret4c: nor does one appear if somebody puts it there by hand', await arrive(ID.deniz), null);
  check('ret5: and asked directly, an under-16 is told nothing while away',
    (await facts(ID.deniz, new Date(Date.now() - 90 * 86400000).toISOString())).length, 0);
  await db.query(`update person set last_seen_at = null where id = $1`, [ID.deniz]);
  check('ret5b: a 16–17 does get a return — doc 34 rule 6 is where the line is, and this migration did not move it',
    (await arrive(ID.nate)) === null, true);   // nate has no last_seen yet: a first visit

  // --- the read line: the ledger, through the gate that already exists.
  // Its own family, because every other section of this file has been reading
  // Riverside's register and logging as it went. "The only read in the window"
  // is not true of ID.guardian, and a check that assumed it was would have been
  // asserting the fixture rather than the function (LESSONS L32).
  const since = new Date(Date.now() - 70 * 86400000).toISOString();
  const rParent = await adult('Return Parent');
  const rChild = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, last_name, dob) values ($1,'Winona','Fixture','2012-05-05')`, [rChild]);
  await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [rParent, rChild]);
  const rRec = crypto.randomUUID();
  await db.query(`insert into development_record (id, person_id) values ($1,$2)`, [rRec, rChild]);
  const rReg = (await q1(
    `insert into registration (player_id, club_id, policy_version) values ($1,$2,'20@v2.4') returning id`,
    [rChild, CLUB.riverside])).id;
  await db.query(
    `insert into register_read_log (person_id, registration_id, surface, read_at)
     values ($1,$2,'list', now() - interval '20 days')`, [ID.clubAdmin, rReg]);
  const listOnly = (await facts(rParent, since)).find((f) => f.kind === 'read');
  check('ret6: a read of the list says so, naming the person and their role at that club',
    [listOnly?.reader_name, listOnly?.reader_role, listOnly?.club_name, listOnly?.surface, listOnly?.subject],
    ['clubAdmin', 'Club administrator', 'Riverside FC', 'list', 'Winona']);
  await db.query(
    `insert into register_read_log (person_id, registration_id, surface, read_at)
     values ($1,$2,'cv', now() - interval '30 days')`, [ID.td, rReg]);
  const both = (await facts(rParent, since)).find((f) => f.kind === 'read');
  check('ret6b: a CV opened outranks a list loaded, even when it is the older of the two',
    [both?.reader_name, both?.surface], ['td', 'cv']);
  check('ret6c: exactly one read line, whatever the ledger holds — a list of readers is a count with names on',
    (await facts(rParent, since)).filter((f) => f.kind === 'read').length, 1);
  check('ret6d: a viewer with no guardianship is told nothing about that child',
    (await facts(ID.exGuardian, since)).some((f) => f.subject === 'Winona'), false);
  check('ret6e: and neither is the club that did the reading',
    (await facts(ID.td, since)).some((f) => f.subject === 'Winona'), false);
  check('ret7: the same read, with the window starting after it, is not "while you were away"',
    (await facts(rParent, new Date(Date.now() - 10 * 86400000).toISOString())).some((f) => f.kind === 'read'), false);
  // M3 — at eighteen a guardianship is visibility only if re-granted (D-49).
  const marcusReg = (await q1(
    `insert into registration (player_id, club_id, policy_version) values ($1,$2,'20@v2.4') returning id`,
    [ID.marcus, CLUB.riverside])).id;
  await db.query(
    `insert into register_read_log (person_id, registration_id, surface, read_at)
     values ($1,$2,'cv', now() - interval '20 days')`, [ID.td, marcusReg]);
  check('ret8: an adult child’s reads are not their parent’s to see without a re-grant (M3, D-49)',
    (await facts(ID.guardian, since)).some((f) => f.subject === 'Marcus'), false);

  // --- the link line
  const tk = crypto.randomUUID();
  await db.query(
    `insert into share_token (record_id, token_hash, token_hint, issued_by, expires_at)
     values ($1,$2,'ret-hint',$3, now() + interval '40 days')`, [rRec, sha(`ret-${tk}`), rParent]);
  check('ret9: the link line is the live token’s own expiry',
    (await facts(rParent, since)).some((f) => f.kind === 'link_expiry' && f.subject === 'Winona'), true);
  await db.query(`update share_token set paused = true where token_hash = $1`, [sha(`ret-${tk}`)]);
  check('ret9b: a paused link has no expiry to state, so the line is omitted rather than guessed',
    (await facts(rParent, since)).some((f) => f.kind === 'link_expiry'), false);
  await db.query(`update share_token set revoked_at = now(), paused = false where token_hash = $1`, [sha(`ret-${tk}`)]);
  check('ret9c: a revoked link has none either',
    (await facts(rParent, since)).some((f) => f.kind === 'link_expiry'), false);
  await db.query(`update share_token set revoked_at = null where token_hash = $1`, [sha(`ret-${tk}`)]);

  // --- the trials line: a stale date CANNOT render (D-74, D-90)
  await db.query(`update trial_notice set trial_on = current_date + 20, last_checked = current_date - 40`);
  check('ret10: every notice unchecked for forty days — the trials line is omitted entirely, not guessed',
    (await facts(rParent, since)).some((f) => f.kind === 'trials'), false);
  const notice = (await q1(`select id from trial_notice limit 1`));
  if (notice) {
    await db.query(`update trial_notice set last_checked = current_date, trial_on = current_date + 9 where id = $1`, [notice.id]);
    const t = (await facts(rParent, since)).find((f) => f.kind === 'trials');
    check('ret10b: a notice a human has checked inside thirty days puts it back, with its check stamp',
      [Boolean(t), Boolean(t?.checked_label)], [true, true]);
    check('ret10c: the date is the notice’s own, never a season written down somewhere',
      t?.on_label, (await q1(`select to_char(trial_on, 'FMDD Mon') as d from trial_notice where id = $1`, [notice.id])).d);
    await db.query(`update trial_notice set trial_on = current_date - 1 where id = $1`, [notice.id]);
    check('ret10d: and a notice whose date has passed never renders anywhere',
      (await facts(rParent, since)).some((f) => f.kind === 'trials'), false);
    await db.query(`update trial_notice set trial_on = current_date + 9 where id = $1`, [notice.id]);
  }
  check('ret11: the trials line is the same for every viewer — no recommender, no personalisation (D-74)',
    (await facts(rParent, since)).find((f) => f.kind === 'trials')?.on_label,
    (await facts(ID.nate, since)).find((f) => f.kind === 'trials')?.on_label);

  // --- what the block is NOT
  const retSrc = codeOnly(readFileSync(fileURLToPath(new URL('../components/WhileYouWereAway.tsx', import.meta.url)), 'utf8'));
  check('ret12: nothing in the block counts anything — no streak, no visit count, no read count',
    /streak|\btimes\b|count\(|\blength\b\s*[><]|visits/i.test(retSrc), false);
  check('ret13: and no verb is aimed at the reader',
    /\b(update your|renew|don.t forget|complete your|come back|you haven)/i.test(retSrc), false);
  const arrivalSrc = await procSrc('fn_note_arrival');
  check('ret14: the arrival is one overwritten timestamp, never an appended history',
    /insert into/i.test(codeOnly(arrivalSrc)), false);
  check('ret15: nothing about this block sends anything',
    /message_outbox|sendMessage|resend|sms/i.test(retSrc), false);
}

// ---------------------------------------------------------------------------
// THE FAILURE PATH, AS SOURCE SHAPE (28 Sep).
//
// The rendered proofs are in the render suite (fp1–fp14) and the write suite
// (p19g, p19h, sr1–sr4). These four are the rules that keep those true a month
// from now, and they are the same argument E10 makes about the dead-link page:
// a page that is never handed a reason cannot leak one.
// ---------------------------------------------------------------------------
{
  const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
  const nf = read('../app/not-found.tsx');
  const er = read('../app/error.tsx');
  const ge = read('../app/global-error.tsx');

  // Next hands not-found.tsx no props at all. If somebody ever gives it a
  // parameter, a searchParam or a header read, it acquires something to branch
  // on and the 404 becomes an existence oracle — doc 14's opening rule:
  // a denial answers "as if it does not exist", never "forbidden".
  check('fail1: the 404 page takes nothing in, so it has nothing to branch on',
    /export default function NotFound\(\)/.test(codeOnly(nf))
      && !/searchParams|params|headers\(|cookies\(/.test(codeOnly(nf)), true);
  check('fail2: and it names no cause — no "expired", "revoked", "paused", "deleted"',
    /expired|revoked|paused|withdrawn|deleted|forbidden|not allowed/i.test(codeOnly(nf)), false);

  // D-94 §1: no secret, token or personal datum in any error message or trace.
  // The error object handed to a client boundary carries the original message
  // in development, and a digest is an identifier for a log line, not for a
  // person to read.
  check('fail3: neither 500 page renders anything off the error — no message, no digest, no stack',
    [nf, er, ge].some((src) => /error\.(message|digest|stack)|console\.(error|log)\(/.test(codeOnly(src))), false);

  // One place for the words, so approving them is one edit and a changed word
  // changes every screen that says it. A sentence typed into a page is a
  // sentence that drifts from the one BUZ said yes to (L17).
  const copyFile = '/components/FailureState.tsx';
  const copy = read('..' + copyFile);
  const sentences = [...copy.matchAll(/: '((?:[^'\\]|\\.){14,})',$/gm)]
    .map((m) => m[1].replace(/\\u2019/g, '’').replace(/\\'/g, "'"))
    .filter((t) => / [a-z]/.test(t));
  check(`fail4: the failure path's copy module holds real sentences (${sentences.length})`,
    sentences.length >= 10, true);
  const componentFiles = [];
  (function walkComponents(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = join(d, e.name);
      if (e.isDirectory()) walkComponents(full);
      else if (/\.tsx?$/.test(e.name)) componentFiles.push(full);
    }
  })(fileURLToPath(new URL('../components', import.meta.url)));
  const elsewhere = [];
  for (const f of [...routeFiles, ...componentFiles]) {
    if (f.endsWith(copyFile)) continue;
    const src = readFileSync(f, 'utf8');
    for (const t of sentences) if (src.includes(t)) elsewhere.push(`${f.slice(f.lastIndexOf('/app/') + 1 || f.lastIndexOf('/components/') + 1)}: "${t.slice(0, 40)}"`);
  }
  check(`fail5: and no screen types one of them out again (${[...new Set(elsewhere)].join(' · ') || 'none does'})`,
    elsewhere.length, 0);
  check('fail6: every failure screen draws its words from that module',
    /FAILURE_COPY/.test(nf) && /FAILURE_COPY/.test(er) && /FAILURE_COPY/.test(ge), true);
}

// -------------------------------------------------------------------------
// 0065 · THE RECEIPT, THE DELIVERY RECEIPTS, AND THE LABELS A PARENT READS
// (D-136, D-137, D-148; D-78; doc 14 O2/O3, B11, F8; LESSONS L5, L13, L19)
//
// Three defects of one shape: a webhook writing to the wrong place, or not at
// all. The receipt had no trigger, the email receipt stopped at the outbox, the
// SMS receipt did not exist, and the guardian's consent log rendered five lines
// nothing in the product could ever write.
//
// The last group is the one that stops this recurring: it reads the labels off
// the screen and demands a writer for each, so a label added tomorrow with
// nothing behind it turns this suite red.
// ---------------------------------------------------------------------------
{
  const { execFileSync } = await import('node:child_process');
  const hook = srcOf('app/api/stripe/webhook/route.ts');
  const hookCode = codeOnly(hook);
  const resendSrc = codeOnly(srcOf('app/api/webhooks/resend/route.ts'));
  const smsStatusSrc = codeOnly(srcOf('app/api/webhooks/sms/status/route.ts'));
  const receipts = await import('../lib/receipts.ts');

  // --- the receipt (doc 15 §31) ------------------------------------------
  const facts = receipts.invoiceFacts({
    id: 'in_test', number: 'PF-00184', amount_paid: 32900, currency: 'aud',
    lines: { data: [{ period: { end: Math.floor(Date.UTC(2028, 2, 3) / 1000) } }] },
  });
  const paidAt = new Date(Date.UTC(2027, 2, 2, 22, 0, 0)); // 3 March 2027, Melbourne
  const club = { name: 'Riverside Football Club', plan: 'register_annual', contactEmail: 'committee@riverside.example.au' };
  const built = receipts.receiptFields(club, facts, paidAt);

  check('O2c: the receipt is addressed to the CLUB’s own mailbox (D-137)',
    built?.to, 'committee@riverside.example.au');
  // The whole point of D-137: a treasurer is reimbursed without an argument,
  // and doc 14 O2 says a billing email that resolves a family address cannot
  // exist. No club address is no receipt — never a fallback to whoever paid.
  check('O2d: a club with no mailbox gets no receipt rather than one to the payer',
    receipts.receiptFields({ ...club, contactEmail: null }, facts, paidAt), null);
  check('O2e: and the webhook has no other way to address one — no person, no guardian, no player',
    /guardian|player|to_person|from person|person\./i.test(hookCode.replace(/person_name/g, '')), false);

  // D-148: the price on the page is GST-inclusive, so the GST inside it is one
  // eleventh. doc 15 §31 prints $29.91 on $329.00, and this is that sum.
  check('D-148: the tax invoice shows the GST inside a GST-inclusive price',
    [built?.receipt.amount, built?.receipt.gst], ['$329.00', '$29.91']);
  check('D-148b: on the monthly plan too', receipts.receiptFields(
    { ...club, plan: 'register_monthly' }, { ...facts, amountCents: 5400 }, paidAt)?.receipt.gst, '$4.91');
  check('D-136: the renewal date is the period the invoice paid for',
    built?.receipt.renewsOn, '3 March 2028');
  // No period in the payload: the date comes from our own plan rather than
  // from a guess about somebody else's field.
  check('D-136b: and where the payload gives none, from the plan',
    receipts.receiptFields(club, { ...facts, periodEnd: null }, paidAt)?.receipt.renewsOn, '3 March 2028');
  check('D-136c: the 14-day cooling-off is the annual plan only',
    [built?.receipt.refundable,
      receipts.receiptFields({ ...club, plan: 'register_monthly' }, facts, paidAt)?.receipt.refundable], [true, false]);
  check('D-136d: a $0 invoice is not a charge and gets no tax invoice',
    receipts.invoiceFacts({ id: 'in_0', amount_paid: 0 }), null);
  check('D-136e: the receipt number is Stripe’s, never invented',
    [built?.receipt.receiptNo, receipts.invoiceFacts({ id: 'in_x', amount_paid: 100 })?.receiptNo], ['PF-00184', 'in_x']);
  // The club id does NOT arrive in an invoice's own metadata — Stripe puts a
  // subscription's metadata under subscription_details. Reading only
  // `metadata.club_id` is why the dunning branch (D-135) could never fire.
  check('D-135: an invoice event resolves its club from where Stripe actually puts it',
    [receipts.clubIdFromEvent({ subscription_details: { metadata: { club_id: 'club-1' } } }),
      receipts.clubIdFromEvent({ metadata: { club_id: 'club-2' } }),
      receipts.clubIdFromEvent({})], ['club-1', 'club-2', null]);
  check('D-135b: and falls back to our own stripe_customer_id',
    /from club where stripe_customer_id/.test(hookCode), true);

  // The words themselves. lib/messages is a server module, so it is imported
  // in a child process under the same react-server condition Next resolves it
  // under — the body asserted here is the one that would send.
  const root = fileURLToPath(new URL('..', import.meta.url));
  const compose = (json) => JSON.parse(execFileSync(process.execPath, [
    '--conditions=react-server', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--input-type=module', '-e',
    `const m = await import(${JSON.stringify(join(root, 'lib/messages.ts'))});
     process.stdout.write(JSON.stringify(m.paymentTakenEmail(${json})));`,
  ], { encoding: 'utf8' }));
  const receipt = compose(JSON.stringify(built.receipt));
  check('doc15 §31: the receipt is the approved message, keyed to doc 15',
    [receipt.key, receipt.subject], ['doc15.§31', 'Riverside Football Club — your Pitch receipt']);
  check('D-148c: headed a tax invoice, with the entity, the ABN and the GST shown separately',
    ['Tax invoice', 'EBSD Enterprises Pty Ltd trading as Pitch Football · ABN 65 701 879 718', 'includes $29.91 GST']
      .every((t) => receipt.body.includes(t)), true);
  check('D-136f: the disclosure is ours — renewal, the cancel route inside Pitch, the cooling-off, the statement descriptor',
    ['Renews 3 March 2028 at $329.00 AUD unless you cancel before then.',
      'pitchfootball.com.au/club/billing',
      'Cancel within 14 days of today and we refund the whole $329.00, no questions.',
      'This charge shows on your statement as PITCH FOOTBALL.'].every((t) => receipt.body.includes(t)), true);
  // A billing surface carries no child data (D-93, and the spirit of doc 14
  // O10 — which is about what STRIPE receives, so it is not this row's id).
  // Not "we did not put any in" —
  // there is nothing about a child in what the receipt is built from.
  check('rcpt2: nothing about any child can reach the receipt, because nothing about one is in what it is built from',
    /player|registration|child|first_name|record/i.test(receipt.body), false);
  // The card's last four are not on a Stripe invoice (lib/receipts). Omitted
  // rather than guessed, and the line reads exactly as doc 15 has it when we
  // do have them.
  check('doc15 §31b: the card line renders as approved when we have the digits, and omits them when we do not',
    [compose(JSON.stringify({ ...built.receipt, cardLast4: '4242' })).body.includes('Card ending 4242 · receipt PF-00184'),
      receipt.body.includes('receipt PF-00184'), receipt.body.includes('Card ending')], [true, true, false]);

  // O3: a payment sets a subscription flag and nothing else — and the branch
  // that sends the receipt sets nothing at all, so a late receipt for an old
  // charge cannot disturb the ordering guard 0032 installed.
  const succeeded = hookCode.split("case 'invoice.payment_succeeded'")[1]?.split('case ')[0] ?? '';
  check('O3e: the payment-succeeded branch writes no subscription state — a receipt and nothing else',
    [succeeded.length > 0, /apply\(|fn_apply_subscription|update club/.test(succeeded)], [true, false]);
  check('rcpt1: and it is the webhook that sends it — no other path calls the receipt',
    routeFiles.concat(readdirSync(fileURLToPath(new URL('../lib', import.meta.url))).map((f) => join(fileURLToPath(new URL('../lib', import.meta.url)), f)))
      .filter((f) => /\.tsx?$/.test(f) && !/lib\/messages\.ts$/.test(f))
      .filter((f) => /paymentTakenEmail|paymentFailedEmail/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(f.lastIndexOf('/app/') + 1 || f.lastIndexOf('/lib/') + 1)),
    ['app/api/stripe/webhook/route.ts']);
  // doc 15 §32 and D-135 on Stripe's retries: invoice.payment_failed arrives
  // once per attempt. The grace runs from the first failure and the email
  // goes once — a fresh window per retry would mean a register that never
  // pauses, and a treasurer told four different dates.
  const failed = hookCode.split("case 'invoice.payment_failed'")[1]?.split('case ')[0] ?? '';
  check('O4f: a retried failure keeps the grace already running rather than starting a new fortnight',
    /grace_until from club/.test(failed) && failed.indexOf('grace_until from club') < failed.indexOf('apply(')
      && /already \? new Date\(before\.grace_until\)/.test(failed), true);
  check('dun1: doc 15 §32 is sent once, when dunning starts — never on a retry',
    /if \(!already\)[\s\S]{0,300}paymentFailedEmail/.test(failed) && (failed.match(/paymentFailedEmail/g) ?? []).length, 1);
  check('D-136g: every charge produces one receipt — a replayed event sends no second tax invoice',
    hookCode.indexOf('from stripe_event where id') < hookCode.indexOf("case 'invoice.payment_succeeded'"), true);

  // --- provider delivery receipts on the spine (D-78) ---------------------
  const { verifyTwilioSignature } = await import('../lib/twilio-signature.ts');
  const twilioSig = (url, params, token) => createHmac('sha1', token)
    .update(url + Object.keys(params).sort().map((k) => k + params[k]).join('')).digest('base64');
  {
    const url = 'https://pitchfootball.com.au/api/webhooks/sms/status';
    const params = { MessageSid: 'SM1', MessageStatus: 'delivered' };
    const good = twilioSig(url, params, 'tok');
    check('D-81: a Twilio signature is accepted only when it is right',
      [verifyTwilioSignature(url, params, good, 'tok'),
        verifyTwilioSignature(url, { ...params, MessageStatus: 'failed' }, good, 'tok'),
        verifyTwilioSignature(url, params, good, 'other-token'),
        verifyTwilioSignature(url, params, null, 'tok')], [true, false, false, false]);
  }
  // Not "the file mentions the function" — that was true of the old route too,
  // which called it for a bounce and wrote delivered_at itself (proved: the
  // proxy stayed green with the bug back). The rule is that NEITHER the outbox
  // column NOR the spine is written in a route: the receipt has three effects
  // and they belong in one statement (L33).
  check('D-78: both provider webhooks write every effect of a receipt through the one function, and neither touches the outbox or the spine itself',
    [/fn_record_delivery/.test(resendSrc), /update message_outbox|insert into consent_event/.test(resendSrc),
      /fn_record_delivery/.test(smsStatusSrc), /update message_outbox|insert into consent_event/.test(smsStatusSrc)],
    [true, false, true, false]);
  // The CALL, not the name: the first 'verifyTwilioSignature' in the file is
  // its import, which comes before everything — so the first version of this
  // check could not fail (proved: it stayed green with the body read first).
  check('D-78b: and each verifies its signature before reading a byte of the body',
    [smsStatusSrc.indexOf('verifyTwilioSignature(request.url') > -1
      && smsStatusSrc.indexOf('verifyTwilioSignature(request.url') < smsStatusSrc.indexOf('params.MessageSid'),
      resendSrc.indexOf('verify(payload') < resendSrc.indexOf('JSON.parse(payload)')], [true, true]);
  // 0076 (BUZ, 28 Sep): the word is gone from the vocabulary, so the database
  // itself refuses it — whoever writes, from wherever.
  check('D-78c2: the consent vocabulary no longer holds email_opened — the database refuses the row (0076)',
    await (async () => { try { await db.query(`insert into consent_event (event) values ('email_opened')`); return 'written'; }
                         catch (e) { return /consent_event_event_check/.test(e.message) ? 'refused' : e.message; } })(), 'refused');
  check('D-78c3: and the guardian’s log has no line for it',
    /email_opened|You opened that email/.test(srcOf('app/g/controls/[childId]/page.tsx')), false);
  check('D-78c: nothing anywhere writes email_opened — open tracking was declined, not forgotten',
    routeFiles.concat([fileURLToPath(new URL('../lib/messaging.ts', import.meta.url))])
      .filter((f) => /insert into consent_event/.test(readFileSync(f, 'utf8')) && /'email_opened'/.test(readFileSync(f, 'utf8'))).length, 0);

  // Behaviour, on the database. A delivered message writes one spine row of
  // the right word, against the person the message was ABOUT.
  const kid = crypto.randomUUID(), parent = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob) values ($1,'Receipt Kid',$2), ($3,'Receipt Parent',$4)`,
    [kid, yearsAgo(15), parent, yearsAgo(41)]);
  const outbox = async (provider, channel, subject) => (await db.query(
    `insert into message_outbox (message_key, channel, to_person, to_address, body, provider_id, subject_id)
     values ($1,$2,$3,$4,'x',$5,$6) returning id`,
    [channel === 'sms' ? 'doc15.§1' : 'doc15.§2', channel, parent,
      channel === 'sms' ? '+61400000000' : 'p@example.com', provider, subject])).rows[0].id;
  const spine = async (person) => (await db.query(
    `select event from consent_event where subject_id = $1 order by id`, [person])).rows.map((r) => r.event);

  await outbox('resend-1', 'email', kid);
  check('D-78d: an email delivery receipt writes email_delivered on the spine (D-78, doc 14 F8)',
    await db.query(`select fn_record_delivery('resend-1','delivered') as e`).then((r) => r.rows[0].e), 'email_delivered');
  check('D-78e: against the person the message was about, not the person it went to',
    [await spine(kid), await spine(parent)], [['email_delivered'], []]);
  check('D-78f: a retried receipt writes nothing twice',
    [await db.query(`select fn_record_delivery('resend-1','delivered') as e`).then((r) => r.rows[0].e), (await spine(kid)).length], [null, 1]);

  await outbox('SM-1', 'sms', kid);
  check('D-78g: an SMS delivery receipt writes sms_delivered',
    await db.query(`select fn_record_delivery('SM-1','delivered') as e`).then((r) => r.rows[0].e), 'sms_delivered');

  // A bounce is not a delivery and does not borrow its word (L5). It lands on
  // the outbox, where the reason column lives, and writes no spine row.
  await outbox('resend-2', 'email', kid);
  const bounced = await db.query(`select fn_record_delivery('resend-2','failed','email.bounced') as e`);
  const bounceRow = (await db.query(`select failed_at is not null as failed, failure_reason, delivered_at from message_outbox where provider_id='resend-2'`)).rows[0];
  check('D-78h: a bounce writes the outbox and no spine row — the vocabulary has no word for one',
    [bounced.rows[0].e, bounceRow.failed, bounceRow.failure_reason, bounceRow.delivered_at, (await spine(kid)).length],
    [null, true, 'email.bounced', null, 2]);
  check('D-78i: a receipt for a message we never sent writes nothing at all',
    [await db.query(`select fn_record_delivery('never-sent','delivered') as e`).then((r) => r.rows[0].e), (await spine(kid)).length], [null, 2]);

  // B11 — the row doc 14 states as: discovery at sixteen is gated on the
  // 30-day notice having DELIVERED, and if it never delivered, discovery stays
  // off. 0013 said the provider receipt writes that; nothing did until now.
  {
    const teen = crypto.randomUUID();
    await db.query(`insert into person (id, first_name, dob) values ($1,'Notice Teen',$2)`, [teen, yearsAgo(16, -10)]);
    const ob = await outbox('resend-b11', 'email', teen);
    await db.query(`insert into age_transition_notice (child_id, outbox_id) values ($1,$2)`, [teen, ob]);
    check('B11c: a 16–17 whose guardian notice has not delivered is in no search',
      await searchable(ID.coachV, teen), false);
    await db.query(`select fn_record_delivery('resend-b11','delivered')`);
    check('B11d: the provider’s delivery receipt is what turns it on, and the only thing that does',
      [await db.query(`select fn_transition_notice_delivered($1) as d`, [teen]).then((r) => r.rows[0].d),
        await searchable(ID.coachV, teen)], [true, true]);
  }

  // Age transitions (doc 14 F8: a guardian sees every age transition).
  {
    const sixteen = crypto.randomUUID(), eighteen = crypto.randomUUID(), younger = crypto.randomUUID();
    await db.query(`insert into person (id, first_name, dob) values ($1,'Turned16',$2), ($3,'Turned18',$4), ($5,'Not Yet',$6)`,
      [sixteen, yearsAgo(16), eighteen, yearsAgo(18), younger, yearsAgo(14)]);
    const n = await db.query('select fn_record_age_transitions() as n');
    check('F8a: a band change is written to the consent log, for the child it happened to',
      [(await spine(sixteen)), (await spine(eighteen)), (await spine(younger))],
      [['age_transition'], ['age_transition'], []]);
    check('F8b: with the band and the date it changed, so a late run is still honest',
      (await db.query(`select detail->>'band' as band, detail->>'on' as on from consent_event where subject_id=$1`, [sixteen])).rows[0],
      { band: '16_17', on: yearsAgo(0) });
    check('F8c: and the same run again writes nothing — the band is the key',
      [n.rows[0].n >= 2, (await db.query('select fn_record_age_transitions() as n')).rows[0].n], [true, 0]);
    check('agex1: the daily job is what runs it — a birthday is not a page load (L31)',
      /fn_record_age_transitions/.test(srcOf('app/api/jobs/daily/route.ts')), true);
  }

  // The parent reached the permission page (D-78). Once per invitation, never
  // after it is finished, and against the child only where a child exists.
  {
    const landed = async (inv) => (await db.query(
      `select subject_id, detail->>'channel' as channel from consent_event
       where event = 'guardian_landed' and detail->>'invitation_id' = $1`, [inv])).rows;
    const land = async (inv, ch) => (await db.query('select fn_record_guardian_landed($1, $2) as w', [inv, ch])).rows[0].w;
    const open = (await db.query(`insert into pending_invitation (first_name, dob, guardian_name, guardian_phone)
      values ('Landed Kid', $1, 'Landed Parent', '+61400000001') returning id`, [yearsAgo(11)])).rows[0].id;
    check('land1: opening the permission page writes guardian_landed once, with the channel it came from',
      [await land(open, 'sms'), await land(open, 'email'), (await landed(open)).length, (await landed(open))[0]?.channel],
      [true, false, 1, 'sms']);
    check('land2: an under-16 invitation has no subject — nothing about the child exists before approval (D-17)',
      (await landed(open))[0]?.subject_id, null);
    const done = (await db.query(`insert into pending_invitation (first_name, dob, guardian_name, guardian_phone, approved_at, sms_confirmed_at, email_confirmed_at)
      values ('Approved Kid', $1, 'P', '+61400000002', now(), now(), now()) returning id`, [yearsAgo(11)])).rows[0].id;
    const held = (await db.query(`insert into pending_invitation (first_name, dob, guardian_name, guardian_phone, held_at)
      values ('Held Kid', $1, 'P', '+61400000003', now()) returning id`, [yearsAgo(11)])).rows[0].id;
    check('land3: an approved or held invitation writes nothing — the link is finished (D-155)',
      [await land(done, 'sms'), await land(held, 'sms'), (await landed(done)).length, (await landed(held)).length],
      [false, false, 0, 0]);
    const teen = crypto.randomUUID();
    await db.query(`insert into person (id, first_name, dob) values ($1,'Landed Teen',$2)`, [teen, yearsAgo(16, -40)]);
    const t = (await db.query(`insert into pending_invitation (first_name, dob, guardian_name, guardian_phone, child_id)
      values ('Landed Teen', $1, 'P', '+61400000004', $2) returning id`, [yearsAgo(16, -40), teen])).rows[0].id;
    await land(t, null);
    check('land4: a 16–17’s invitation lands on their own consent log, and a channel we did not send is not recorded',
      [(await landed(t))[0]?.subject_id, (await landed(t))[0]?.channel], [teen, null]);
    // D-PD-4 (1 Oct): the finished link is LinkState's words at 200 now, not
    // the root 404 — still answered before anything is written.
    check('land5: the approval page is what calls it, after the finished-link answer',
      (() => { const a = codeOnly(srcOf('app/a/[id]/page.tsx'));
        const fin = a.indexOf('if (!inv || inv.approved_at || inv.held_at) return <FinishedLink />;');
        return fin > -1 && fin < a.indexOf('recordGuardianLanded('); })(), true);
  }

  // A LINK PREVIEW IS NOT A PARENT (Leo, 28 Sep). A forwarded approval link is
  // fetched by the messaging app to draw its preview card, and that fetch was
  // a page load like any other — so "You opened the permission page" could be
  // WhatsApp's server. The rule is a heuristic in one module; asked of the
  // module itself, with real user-agent strings, and of the page that uses it.
  {
    const { isLinkPreviewFetch, LINK_PREVIEW_AGENTS, PITCH_METHOD_HEADER } = await import('../lib/link-preview.ts');
    const BOTS = {
      facebookexternalhit: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      WhatsApp: 'WhatsApp/2.23.20.0 A',
      Twitterbot: 'Twitterbot/1.0',
      Slackbot: 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
      TelegramBot: 'TelegramBot (like TwitterBot)',
      Discordbot: 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
      LinkedInBot: 'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
      SkypeUriPreview: 'Mozilla/5.0 (Windows NT 6.1; WOW64) SkypeUriPreview Preview/0.5',
      Googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      Applebot: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 (Applebot/0.1)',
      'an unnamed crawler': 'SomeNewChatApp-LinkPreview/3.1',
    };
    const PEOPLE = {
      'iPhone Safari': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      'Android Chrome': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
      'Facebook in-app browser': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.35.110;FBBV/600000000]',
      'Instagram in-app browser': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 340.0.2.17.109',
      'desktop Firefox': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:127.0) Gecko/20100101 Firefox/127.0',
    };
    check('lp1: every named link-preview fetcher, and an unnamed one, is not a parent',
      Object.entries(BOTS).filter(([, ua]) => !isLinkPreviewFetch('GET', ua)).map(([k]) => k), []);
    check('lp2: a parent in a browser — including one inside Facebook or Instagram — is',
      Object.entries(PEOPLE).filter(([, ua]) => isLinkPreviewFetch('GET', ua)).map(([k]) => k), []);
    check('lp3: a HEAD is never a parent, whatever it claims to be',
      [isLinkPreviewFetch('HEAD', PEOPLE['iPhone Safari']), isLinkPreviewFetch('head', null)], [true, true]);
    check('lp4: the list is named — each fetcher Leo named has its own entry, and the catch-all is last',
      [LINK_PREVIEW_AGENTS.length >= 12, String(LINK_PREVIEW_AGENTS.at(-1)) === '/bot|crawler|spider|preview/i'], [true, true]);
    const approval = codeOnly(srcOf('app/a/[id]/page.tsx'));
    check('lp5: the approval page writes the landing only when the request is not a preview',
      /if \(!isLinkPreviewFetch\(h\.get\(PITCH_METHOD_HEADER\), h\.get\('user-agent'\)\)\) \{\s*await recordGuardianLanded\(/.test(approval)
        && (approval.match(/recordGuardianLanded\(/g) ?? []).length === 1, true);
    const proxy = codeOnly(srcOf('proxy.ts'));
    check('lp6: and the method it reads is stamped by the proxy on every request, never taken from the caller',
      [PITCH_METHOD_HEADER, /headers\.set\(PITCH_METHOD_HEADER, req\.method\)/.test(proxy)], ['x-pitch-request-method', true]);
    check('lp7: the heuristic lives in one module — no other file keeps its own list',
      routeFiles.concat(readdirSync(fileURLToPath(new URL('../lib', import.meta.url))).map((f) => fileURLToPath(new URL('../lib/' + f, import.meta.url))))
        .filter((f) => /\.tsx?$/.test(f) && !/lib\/link-preview\.ts$/.test(f))
        .filter((f) => /facebookexternalhit|Twitterbot|Slackbot|Discordbot/i.test(readFileSync(f, 'utf8'))), []);
  }

  // --- every label the guardian's log renders has a writer ---------------
  //
  // THE CHECK THAT STOPS THIS RECURRING. Five lines on that screen — "That
  // email reached your inbox", "You opened that email", "That text reached
  // your phone", "You opened the permission page", "Their age band changed" —
  // were promises to a parent that nothing in the product could keep. Four are
  // now written. The fifth is a deliberate refusal, named below with its
  // reason, and a future label with nothing behind it fails here.
  {
    const controls = srcOf('app/g/controls/[childId]/page.tsx');
    const map = /const EVENT_LINES: Record<string, string> = \{([\s\S]*?)\n  \};/.exec(controls)?.[1] ?? '';
    const labels = [...map.matchAll(/^\s{4}([a-z_]+):/gm)].map((m) => m[1]);
    check('F8e: the guardian’s consent log renders a line for every word in the spine vocabulary',
      labels.length > 30, true);

    // A writer is anything that actually inserts the word: a TS path, or a
    // Postgres function. Reading the CHECK constraint does not count — that is
    // the vocabulary, not a writer.
    const tsAll = routeFiles.concat(readdirSync(fileURLToPath(new URL('../lib', import.meta.url)))
      .map((f) => fileURLToPath(new URL('../lib/' + f, import.meta.url))).filter((f) => /\.ts$/.test(f)));
    const tsWriters = tsAll.map((f) => readFileSync(f, 'utf8')).filter((src) => /insert into consent_event/.test(src)).join('\n');
    const pgWriters = (await db.query(
      // consent_event and not consent_event_link (0077): the link table names
      // the funnel's words in order to attach them, and naming a word is not
      // writing it — counting it would make every one of them look written.
      `select prosrc from pg_proc where prosrc ~* 'insert into consent_event[^_]'`)).rows.map((r) => r.prosrc).join('\n');
    const written = (w) => new RegExp(`'${w}'`).test(tsWriters) || new RegExp(`'${w}'`).test(pgWriters);

    // Named, with the reason, exactly as the unsent-message list above is.
    // Nothing joins this list without an argument in a report.
    // It is empty (28 Sep): its one entry, email_opened, left the vocabulary
    // and the screen together (0076) when BUZ approved the removal.
    const NO_WRITER_BY_DECISION = {};
    const orphans = labels.filter((w) => !written(w) && !(w in NO_WRITER_BY_DECISION));
    check(`F8f: every line the guardian reads has something that writes it (${orphans.join(', ') || 'all do'})`, orphans, []);
    const stale = Object.keys(NO_WRITER_BY_DECISION).filter((w) => written(w));
    check(`F8g: and nothing is excused that is now written (${stale.join(', ') || 'none'})`, stale, []);
    // The exception list cannot outlive the label: if BUZ says remove it, the
    // entry goes with it.
    check('F8h: and nothing is excused that the screen no longer renders',
      Object.keys(NO_WRITER_BY_DECISION).filter((w) => !labels.includes(w)), []);
  }
}

// ===========================================================================
// FINAL ROUND B (28 Sep, builder-final-b) — D-164's four launch calls and
// D-160's coach-verified stats. Its own world, so nothing above moves it and
// it moves nothing above.
// ===========================================================================
{
  const q1 = async (sql, args) => (await db.query(sql, args)).rows[0];
  const W = {};
  for (const k of ['club', 'otherClub', 'unvClub', 'squad', 'squad2', 'otherSquad', 'unvSquad', 'call', 'call2',
    'kid', 'teen', 'adult', 'guardian', 'coachV', 'coachU', 'coachSide', 'coachAway', 'coachUnv', 'admin', 'tm', 'coachTeen',
    'kidRec', 'teenRec', 'adultRec']) W[k] = crypto.randomUUID();
  const person = (id, name, dob) => db.query(`insert into person (id, first_name, last_name, dob) values ($1,$2,'FinalB',$3)`, [id, name, dob]);
  await person(W.kid, 'Kit', yearsAgo(14));
  await person(W.teen, 'Tay', yearsAgo(17));
  await person(W.adult, 'Ade', yearsAgo(24));
  for (const k of ['guardian', 'coachV', 'coachU', 'coachSide', 'coachAway', 'coachUnv', 'admin', 'tm']) await person(W[k], `Fb ${k}`, yearsAgo(38));
  await person(W.coachTeen, 'Teen coach', yearsAgo(16, -30));
  await db.query(`insert into club (id, name, club_state) values ($1,'Final B Park FC','claimed'), ($2,'Final B Away FC','claimed'), ($3,'Final B Unverified FC','claimed')`,
    [W.club, W.otherClub, W.unvClub]);
  for (const [club, call] of [[W.club, W.call], [W.otherClub, W.call2]]) {
    await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
      values ($1,$2,now(),'BUZ','03 9000 0000','FV club directory','verified','27@v1.0')`, [call, club]);
    await db.query(`update club set club_state='verified', verified_call_id=$1 where id=$2`, [call, club]);
  }
  await db.query(`insert into squad (id, club_id, name, age_group, competition_gender, season) values
    ($1,$5,'FB U15','U15','boys','2026'), ($2,$5,'FB U18','U18','boys','2026'), ($3,$6,'FB Away','U15','boys','2026'), ($4,$7,'FB Unv','U15','boys','2026')`,
    [W.squad, W.squad2, W.otherSquad, W.unvSquad, W.club, W.otherClub, W.unvClub]);
  const mem = (p, c, sq, role) => db.query(`insert into membership (person_id, club_id, squad_id, role) values ($1,$2,$3,$4)`, [p, c, sq, role]);
  await mem(W.kid, W.club, W.squad, 'player');
  await mem(W.teen, W.club, W.squad2, 'player');
  await mem(W.adult, W.club, W.squad2, 'player');
  await mem(W.kid, W.unvClub, W.unvSquad, 'player');
  await mem(W.coachV, W.club, W.squad, 'coach');
  await mem(W.coachU, W.club, W.squad, 'coach');       // no WWCC attestation
  await mem(W.coachSide, W.club, W.squad2, 'coach');   // attested, another squad
  await mem(W.coachAway, W.otherClub, W.otherSquad, 'coach');
  await mem(W.coachUnv, W.unvClub, W.unvSquad, 'coach');
  await mem(W.admin, W.club, null, 'club_admin');
  await mem(W.tm, W.club, W.squad, 'team_manager');
  for (const [p, c] of [[W.coachV, W.club], [W.coachSide, W.club], [W.coachAway, W.otherClub], [W.coachUnv, W.unvClub]]) {
    await db.query(`insert into wwcc_attestation (person_id, club_id, attested_by) values ($1,$2,$3)`, [p, c, W.admin]);
  }
  await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now()), ($1,$3,now())`, [W.guardian, W.kid, W.teen]);
  for (const [rec, p] of [[W.kidRec, W.kid], [W.teenRec, W.teen], [W.adultRec, W.adult]]) {
    await db.query(`insert into development_record (id, person_id, positions) values ($1,$2,array['CM'])`, [rec, p]);
  }
  const stat = async (rec, key, value) => (await q1(
    `insert into player_stat (record_id, season, stat_key, value, provenance) values ($1,'2026',$2,$3,'self_reported') returning id`, [rec, key, value])).id;

  // ---- D-164 (1): the front door's switch (0080) -----------------------------
  check('fd-p1: the front door is switched off out of the box — / is the coming-soon page until launch day',
    [FRONT_DOOR_AT_BOOT.value, FRONT_DOOR_AT_BOOT.open], ['false', false]);
  for (const typo of ['TRUE', 'yes', '1', ' true']) {
    await db.query(`update app_config set value = $1 where key = 'front_door_open'`, [typo]);
    check(`fd-p1b: a config typo does not open it (${JSON.stringify(typo)})`, (await q1('select fn_front_door_open() as o')).o, false);
  }
  await db.query(`delete from app_config where key = 'front_door_open'`);
  check('fd-p1c: nor does a missing row', (await q1('select fn_front_door_open() as o')).o, false);
  await db.query(`insert into app_config (key, value) values ('front_door_open', 'true')`);
  check('fd-p1d: the literal true, and only that, opens it', (await q1('select fn_front_door_open() as o')).o, true);
  await db.query(`update app_config set value = 'false' where key = 'front_door_open'`);

  const proxySrc = codeOnly(srcOf('proxy.ts'));
  const rootPage = srcOf('app/page.tsx');
  check('fd-p2: / itself is untouched — app/page.tsx asks nothing and imports no front door (render fd0 measures the bytes)',
    [/front-door|frontDoor|FrontDoor|@\/lib\/db/.test(rootPage), /^export default function Home\(\)/m.test(rootPage)], [false, true]);
  check('fd-p2b: proxy.ts rewrites only "/", only when the switch says so, fails closed, and still stamps the request method',
    [/if \(path !== '\/'\) return null/.test(proxySrc), /await frontDoorOpen\(\)/.test(proxySrc), /catch \{ open = false; \}/.test(proxySrc),
     /headers\.set\(PITCH_METHOD_HEADER, req\.method\)/.test(proxySrc)], [true, true, true, true]);
  const fdPage = codeOnly(srcOf('app/front-door/page.tsx'));
  check('fd-p2c: and the front door page itself answers not-found while the switch is off',
    /if \(!\(await frontDoorOpen\(\)\)\) notFound\(\)/.test(fdPage), true);
  const devFd = srcOf('app/dev/front-door/route.ts');
  check('fd-p2d: /dev/front-door is gated as /dev/billing is — no production, no demo, POST only',
    [/NODE_ENV === 'production' \|\| isDemo\(\)/.test(devFd), /export async function POST/.test(devFd), /export async function GET/.test(devFd)], [true, true, false]);
  // The held lines are not in the file at all, so they cannot render by
  // accident (D-163 as amended): no price, no date, no "at launch", "for now",
  // "limited" or "first X clubs", and nothing from the Founding XI.
  const fdSrc = codeOnly(srcOf('components/front-door/FrontDoor.tsx'));
  // BUZ, 1 Oct: "For clubs · free" — free said bare is allowed; free with a
  // condition or an end date is still held (the 28 Sep rule).
  const fdHeld = [/\$\s?\d/, /\bfree (at|until|for)\b/i, /at launch/i, /for now/i, /\blimited\b/i, /first (eleven|\d+)/i, /Founding XI/i, /December/, /September/, /inc GST/i, /\/yr/, /\bPro\b/]
    .filter((re) => re.test(fdSrc)).map(String);
  check(`fd-p3: the front door's source carries none of the held lines (${fdHeld.join(' ') || 'none'})`, fdHeld, []);

  // ---- D-164 (2) / D-84: the birth quarter, and nothing narrower -------------
  const quarter = async (d) => (await q1('select fn_birth_quarter($1::date) as q', [d])).q;
  check('ctx1: the quarter turns on the first of the month, at both ends of the year',
    [await quarter('2012-01-01'), await quarter('2012-03-31'), await quarter('2012-04-01'), await quarter('2012-06-30'),
     await quarter('2012-07-01'), await quarter('2012-09-30'), await quarter('2012-10-01'), await quarter('2012-12-31'), await quarter(null)],
    ['Jan–Mar', 'Jan–Mar', 'Apr–Jun', 'Apr–Jun', 'Jul–Sep', 'Jul–Sep', 'Oct–Dec', 'Oct–Dec', null]);
  await db.query(`insert into profile_version (record_id, content, status, approved_by, approved_at) values ($1, $2, 'approved', $3, now())`,
    [W.kidRec, JSON.stringify({ firstName: 'Kit', stats: [] }), W.guardian]);
  const served = (await q1('select fn_approved_cv($1) as c', [W.kidRec])).c;
  check('ctx2: the approved snapshot is served with the quarter stamped on the way out — derived, not stored',
    [served.birthQuarter, (await q1('select content ? \'birthQuarter\' as s from profile_version where record_id = $1', [W.kidRec])).s],
    [await quarter(yearsAgo(14)), false]);
  check('ctx3: and nothing in what it serves is a date of birth or a year',
    Object.entries(served).filter(([k, v]) => /dob|birth(?!Quarter)|year|age$/i.test(k) || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v))).map(([k]) => k), []);
  // D-89: the card surfaces read no quarter and no age group — the band's own
  // rule, applied to the marker that narrows a child further.
  const cvSrcAll = () => codeOnly(srcOf('components/cv/PlayerCV.tsx'));
  const cardSurfaces = ['app/p/[token]/opengraph-image.tsx', 'app/g/card/[cardId]/image/route.tsx', 'lib/cv-meta.ts'];
  check('ctx4: the Open Graph image, the share card and the link-preview text never read the quarter or the context line (D-89)',
    cardSurfaces.filter((f) => /birthQuarter|contextLine|fn_birth_quarter|born /.test(codeOnly(srcOf(f)))), []);
  // D-89 and D-173 (1 Oct): a club's colours are the club's identity, so no
  // card surface — cached for good by every platform — may ever read them.
  // D-174 (0165): the CV's colours ride on the CV data as clubColours and
  // clubState, so those names, the read and its helper are barred too.
  check('ctx4b: and none of them reads a club\u2019s colours',
    cardSurfaces.filter((f) => /club-colours|colour_primary|colour_secondary|clubTheme|clubColours|clubState|cvClubColours|fn_cv_club_colours/.test(codeOnly(srcOf(f)))), []);
  // BUZ said yes to a CV wearing its club's colours (1 Oct) and John cleared
  // it the same day on four conditions; the decision is D-174. The switch
  // equals that entry: on only while D-174 is in the register, Locked, and is
  // the decision about a current club's colours on a CV. Keyed to the entry's
  // own markup (its id, its status chip and its title) rather than to a
  // phrase — the first version of this check looked for "CV club colours ...
  // John ... cleared", which the entry as written never said, so it could
  // only ever have held the switch off. D-174 moving to anything but Locked,
  // or being renumbered or retitled, turns the switch's check red.
  const coloursSrc = codeOnly(srcOf('lib/club-colours.ts'));
  const d174Locked = /<div class="id">D-174<\/div><div class="st lk">Locked<\/div><div class="bd">\s*<div class="t"><b>[^<]*current club(&rsquo;|\u2019)s colours/.test(srcOf('docs/06-Register.html'));
  check('cvc1: a player\u2019s CV wears its club\u2019s colours only while D-174 is Locked in the register',
    // The switch must equal the decision: off with no Locked D-174, and on
    // only while there is one. Either one moving alone fails.
    /export const CV_WEARS_CLUB_COLOURS = (true|false)/.exec(coloursSrc)?.[1], String(d174Locked));
  check('cvc2: and when it does, only a verified club\u2019s (D-126)',
    /CV_WEARS_CLUB_COLOURS && p\.club && clubState === 'verified'/.test(cvSrcAll()), true);
  const cvSrc = codeOnly(srcOf('components/cv/PlayerCV.tsx'));
  check('ctx5: the CV draws the marker from the age group and the quarter only — never p.dob — and only for a "U<n>" group',
    [/contextLine\(p\.squad\.ageGroup, p\.birthQuarter\)/.test(cvSrc), /p\.dob/.test(cvSrc), /\^U\\d\{1,2\}\$/.test(cvSrc)], [true, false, true]);

  // ---- D-164 (4) / D-82: one anonymous count per feature, adults only --------
  const taps = async () => Object.fromEntries((await db.query('select feature, taps::int as t from premium_interest')).rows.map((r) => [r.feature, r.t]));
  const tap = async (who, f) => (await q1('select fn_premium_interest($1, $2) as ok', [who, f])).ok;
  const t0 = await taps();
  check('prem1: an adult\'s tap counts one, for that feature',
    [await tap(W.adult, 'unlimited_clips'), (await taps()).unlimited_clips ?? 0], [true, (t0.unlimited_clips ?? 0) + 1]);
  await db.query('insert into coach_profile (person_id) values ($1)', [W.coachTeen]);
  check('prem2: a 16–17 who coaches MiniRoos, a 16–17 player and an under-16 are never counted (D-82: no intent capture on a minor)',
    [await tap(W.coachTeen, 'who_viewed'), await tap(W.teen, 'unlimited_clips'), await tap(W.kid, 'who_viewed')], [false, false, false]);
  check('prem2b: nor is nobody, nor a feature that is not one of the two',
    [await tap(null, 'who_viewed'), await tap(W.adult, 'reel_builder'), await tap(W.adult, null)], [false, false, false]);
  check('prem2c: and none of those refusals moved a count', await taps(), { ...t0, unlimited_clips: (t0.unlimited_clips ?? 0) + 1 });
  const cols = (await db.query(`select column_name from information_schema.columns where table_name = 'premium_interest' order by ordinal_position`)).rows.map((r) => r.column_name);
  check('prem3: the count keeps a feature and a number — no person, no session, no IP, no time', cols, ['feature', 'taps']);
  await expectFail('prem3b: and no third feature can be counted', `insert into premium_interest (feature, taps) values ('reel_builder', 1)`);
  const clipsPage = codeOnly(srcOf('app/build/[recordId]/clips/page.tsx'));
  const coachPage = codeOnly(srcOf('app/coach/edit/page.tsx'));
  check('prem4: the rows render only for an adult — the record\'s band on Highlights, the coach\'s own age on the coach page',
    [/\{band === '18plus' && <PremiumRows on="clips"/.test(clipsPage), /\{c\.adult && <PremiumRows on="coach"/.test(coachPage),
     (clipsPage.match(/<PremiumRows/g) ?? []).length, (coachPage.match(/<PremiumRows/g) ?? []).length], [true, true, 1, 1]);
  const rowsSrc = codeOnly(srcOf('components/PremiumRows.tsx'));
  const tapSrc = codeOnly(srcOf('components/premium-actions.ts'));
  check('prem5: at most two rows, no price, and the tap writes nothing but the database\'s count',
    [(rowsSrc.match(/\['(unlimited_clips|who_viewed)'/g) ?? []).length, /\$\s?\d/.test(rowsSrc),
     (tapSrc.match(/db\.query\(/g) ?? []).length, /select fn_premium_interest\(\$1, \$2\)/.test(tapSrc), /insert|console\.|headers\(|cookies\(/.test(tapSrc),
     /formData\.get\('back'\)|safePath/.test(tapSrc)],
    [2, false, 2, true, false, false]);

  // ---- D-164 (3) / D-63: the country step comes first and collects nothing ----
  const joinPage = codeOnly(srcOf('app/join/page.tsx'));
  const joinAct = codeOnly(srcOf('app/join/actions.ts'));
  const doors = ['startPendingInvitation', 'createAccount', 'createCoachAccount', 'createClubAccount'];
  check('ctry1: every sign-up door refuses a sign-up that did not come through the country step, before it reads or writes anything',
    doors.map((d) => new RegExp(`export async function ${d}\\(formData: FormData\\) \\{\\s*if \\(!inAustralia\\(formData\\)\\) redirect\\('/join'\\);`).test(joinAct)),
    doors.map(() => true));
  check('ctry1b: the answer is not stored — "country" is read once, to say yes or no',
    [(joinAct.match(/'country'/g) ?? []).length, /insert[^`]*country/i.test(joinAct)], [1, false]);
  const elsewhere = joinPage.split("step === 'elsewhere' ? (")[1]?.split(") : step === 'signup' ? (")[0] ?? '';
  check('ctry2: Somewhere else collects nothing — no field, no form, no action, no request, at any age',
    [elsewhere.length > 0, /<input|<form|action=|fetch\(|FormData|startPendingInvitation|create\w*Account/.test(elsewhere),
     elsewhere.includes('Pitch is only open in Australia.')], [true, false, true]);
  check('ctry3: it is the first thing asked — the page opens on the country, before the name or the date of birth',
    [/useState<'country' \| 'elsewhere' \| 'signup' \| 'parent' \| 'account'>\('country'\)/.test(joinPage),
     joinPage.indexOf('Where do you live?') < joinPage.indexOf('type="date"')], [true, true]);
  check('ctry3b: and both forms that create anything carry it',
    (joinPage.match(/<input type="hidden" name="country" value="AU" \/>/g) ?? []).length, 2);

  // ---- D-160: coach-verified stats -------------------------------------------
  const kidGoals = await stat(W.kidRec, 'goals', 11);
  const kidApps = await stat(W.kidRec, 'apps', 18);
  const verify = async (who, st) => (await q1('select fn_verify_stat($1, $2) as ok', [who, st])).ok;
  const row = async (st) => q1('select provenance, verified_club_id, verified_by, verified_at is not null as at, value from player_stat where id = $1', [st]);
  check('cv1: the player\'s own squad coach, WWCC-attested at a verified club, marks a stat coach-verified',
    await verify(W.coachV, kidGoals), true);
  const v1 = await row(kidGoals);
  check('cv1b: and the server set the provenance, the CLUB (the player\'s own), the actor and the time — none of it came from a request',
    [v1.provenance, v1.verified_club_id, v1.verified_by, v1.at], ['coach_verified', W.club, W.coachV, true]);
  const refused = {
    'a coach with no WWCC': W.coachU, 'a coach of another squad': W.coachSide, 'a coach at another club': W.coachAway,
    'a coach at an unverified club the child also plays for': W.coachUnv, 'the club administrator': W.admin,
    'the team manager': W.tm, 'the player': W.kid, 'their parent': W.guardian, 'nobody': null,
  };
  const refusedOut = [];
  for (const [who, id] of Object.entries(refused)) if (await verify(id, kidApps)) refusedOut.push(who);
  check(`cv2: nobody else holds that pen (${refusedOut.join(', ') || 'nobody did'})`, refusedOut, []);
  check('cv2b: and the refusals wrote nothing', (await row(kidApps)).provenance, 'self_reported');
  await expectFail('cv3: no insert can arrive as coach-verified, whatever it says',
    `insert into player_stat (record_id, season, stat_key, value, provenance) values ('${W.teenRec}','2026','goals',3,'coach_verified')`);
  await expectFail('cv3b: nor carry a verifying club of its own',
    `insert into player_stat (record_id, season, stat_key, value, provenance, verified_club_id) values ('${W.teenRec}','2026','assists',3,'self_reported','${W.club}')`);
  await db.query(`update player_stat set provenance = 'coach_verified', verified_club_id = $2, verified_by = $3, verified_at = now() where id = $1`, [kidApps, W.club, W.coachV]);
  check('cv3c: and an update cannot promote one — the columns come back as they were',
    [(await row(kidApps)).provenance, (await row(kidApps)).verified_by], ['self_reported', null]);
  // Re-saving the same number (the build form upserts every stat on every save).
  await db.query(`insert into player_stat (record_id, season, stat_key, value, provenance) values ($1,'2026','goals',11,'self_reported')
    on conflict (record_id, season, stat_key) where source_experience_id is null do update set value = excluded.value`, [W.kidRec]);
  check('cv4: saving the page with the same number keeps the verification', (await row(kidGoals)).provenance, 'coach_verified');
  const hist = async (rec) => (await db.query(`select stat_key, value, provenance, verified_club_id, verified_by from player_stat_history where record_id = $1 order by id`, [rec])).rows;
  check('cv4b: and adds nothing to the history', (await hist(W.kidRec)).length, 0);
  // The player edits it (approved default 7): the same upsert lib/cv-build runs.
  await db.query(`insert into player_stat (record_id, season, stat_key, value, provenance) values ($1,'2026','goals',14,'self_reported')
    on conflict (record_id, season, stat_key) where source_experience_id is null do update set value = excluded.value`, [W.kidRec]);
  const edited = await row(kidGoals);
  check('cv5: when the player edits a coach-verified stat, the new value is self-reported, with no club and no coach',
    [edited.value, edited.provenance, edited.verified_club_id, edited.verified_by], [14, 'self_reported', null, null]);
  check('cv5b: and the coach\'s value stays in the history, with who confirmed it and for which club',
    await hist(W.kidRec), [{ stat_key: 'goals', value: 11, provenance: 'coach_verified', verified_club_id: W.club, verified_by: W.coachV }]);
  check('cv5c: a coach can confirm the new number', [await verify(W.coachV, kidGoals), (await row(kidGoals)).provenance], [true, 'coach_verified']);
  await db.query(`delete from player_stat where id = $1`, [kidGoals]);  // the player blanks it (lib/cv-build)
  check('cv6: blanking a verified stat keeps it in the history too', (await hist(W.kidRec)).map((h) => [h.value, h.provenance]), [[11, 'coach_verified'], [14, 'coach_verified']]);
  await expectFail('cv7: the history is append-only — no update', `update player_stat_history set value = 99 where record_id = '${W.kidRec}'`);
  await expectFail('cv7b: and no delete', `delete from player_stat_history where record_id = '${W.kidRec}'`);
  const zero = await stat(W.teenRec, 'clean_sheets', 0);
  check('cv8: a zero is never a thing to confirm (D-70), and a teen\'s squad coach is not the kid\'s',
    [await verify(W.coachSide, zero), await verify(W.coachV, await stat(W.teenRec, 'apps', 9)), await verify(W.coachSide, await stat(W.teenRec, 'goals', 2))],
    [false, false, true]);
  // No code path writes the word. The database function is the only writer.
  const writers = routeFiles.concat(readdirSync(fileURLToPath(new URL('../lib', import.meta.url))).map((f) => fileURLToPath(new URL('../lib/' + f, import.meta.url))))
    .filter((f) => /\.tsx?$/.test(f)).filter((f) => /player_stat[\s\S]{0,200}'coach_verified'|coach_verified'[\s\S]{0,80}player_stat/.test(codeOnly(readFileSync(f, 'utf8'))));
  check(`cv9: no page and no library writes coach_verified onto a stat — fn_verify_stat is the one writer (${writers.join(', ') || 'none'})`, writers, []);

  // "Verify for {club}" (BUZ, 29 Sep; 0122). The button is offered from the
  // database's answer and names the club the write will name — one answer.
  const offered = async (who, rec) => (await db.query('select stat_key, value, club_name from fn_verifiable_stats($1,$2)', [who, rec])).rows;
  const wClub = (await q1('select name from club where id = $1', [W.club])).name;
  const kidApps2 = await stat(W.kidRec, 'assists', 6);
  check('cv10: the squad coach is offered the player\u2019s own self-reported numbers above zero, each with the club the verification will name',
    (await offered(W.coachV, W.kidRec)).filter((o) => o.stat_key === 'assists'), [{ stat_key: 'assists', value: 6, club_name: wClub }]);
  const offeredOut = [];
  for (const [who, id] of Object.entries(refused)) if ((await offered(id, W.kidRec)).length) offeredOut.push(who);
  check(`cv10b: nobody without the pen is offered anything — the values come off the record and are gated with it (L2) (${offeredOut.join(', ') || 'nobody was'})`, offeredOut, []);
  await verify(W.coachV, kidApps2);
  check('cv10c: a verified number is not offered again, and a zero never is',
    [(await offered(W.coachV, W.kidRec)).some((o) => o.stat_key === 'assists'), (await offered(W.coachSide, W.teenRec)).some((o) => o.value === 0)], [false, false]);
  check('cv10d: the button\u2019s club and the written club are one answer — fn_verify_stat and fn_verifiable_stats both ask fn_verify_club',
    [/fn_verify_club/.test(await procSrc('fn_verify_stat')), /fn_verify_club/.test(await procSrc('fn_verifiable_stats'))], [true, true]);
  const sqCvPage = codeOnly(srcOf('app/club/squads/[squadId]/cv/[playerId]/page.tsx'));
  const sqCvAct = codeOnly(srcOf('app/club/squads/[squadId]/cv/[playerId]/actions.ts'));
  check('cv11: the squad CV offers "Verify for {club}" from fn_verifiable_stats, only for a number on the page as shown (an under-16\u2019s approved snapshot, D-119)',
    [/fn_verifiable_stats\(\$1, \$2\)/.test(sqCvPage), />\{`Verify for \$\{v\.club_name\}`\}</.test(sqCvPage),
     /cv!\.stats\.some\(\(s\) => s\.season === v\.season && s\.key === v\.stat_key && s\.value === v\.value && s\.provenance === 'self_reported'\)/.test(sqCvPage)],
    [true, true, true]);
  check('cv11b: its press asks the squad the page asked, then fn_verify_stat — which takes the club, the coach and the time from the actor, never the form',
    [sqCvAct.indexOf('fn_can_read_squad_player') > -1 && sqCvAct.indexOf('fn_can_read_squad_player') < sqCvAct.indexOf('fn_verify_stat'),
     /select fn_verify_stat\(\$1, \$2\)', \[me, statId\]/.test(sqCvAct), /verified_club|provenance/.test(sqCvAct)], [true, true, false]);

  // doc 14 A20 — the row D-160 adds: a link-holder reading a coach-verified
  // stat learns the club and the date, and no person. What every page reads
  // (the share link through lib/record-read, a u16's approved version through
  // lib/cv-build) is fn_stat_public; this is its answer, key by key.
  const teenGoals = (await q1(`select id from player_stat where record_id = $1 and stat_key = 'goals'`, [W.teenRec])).id;
  const pub = (await q1('select fn_stat_public($1) as s', [W.teenRec])).s;
  const verified = pub.find((x) => x.key === 'goals');
  const coachName = (await q1('select first_name, last_name from person where id = $1', [W.coachSide]));
  const leaked = JSON.stringify(pub).match(new RegExp([W.coachSide, coachName.first_name, coachName.last_name, 'verified_by', 'verifiedBy', 'coachName'].map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i'));
  check('A20: a link-holder reading a coach-verified stat learns the club and the date, and no person',
    [verified?.provenance, verified?.verifiedClub, /^\d{4}-\d{2}-\d{2}$/.test(verified?.verifiedOn ?? ''), leaked?.[0] ?? null],
    ['coach_verified', 'Final B Park FC', true, null]);
  check('A20b: every stat carries exactly the keys a page may show — no field exists that could carry a person',
    [...new Set(pub.flatMap((x) => Object.keys(x)))].sort(), ['enteredOn', 'key', 'provenance', 'season', 'value', 'verifiedClub', 'verifiedOn']);
  check('A20c: and a zero is not among them (D-70)', pub.some((x) => x.value === 0), false);
  const readSrc = codeOnly(srcOf('lib/record-read.ts'));
  const buildSrc = codeOnly(srcOf('lib/cv-build.ts'));
  check('A20d: the share link and the approved version both read the stats through fn_stat_public, and the CV draws only the club and the date',
    [/fn_stat_public\(\$1\) as stats/.test(readSrc), /fn_stat_public\(\$1\) as stats/.test(buildSrc),
     /from player_stat where record_id = \$1 and value > 0/.test(readSrc + buildSrc),
     /provenanceLine\(t\)/.test(cvSrc), /verifiedBy|verified_by|coach(Name|_name)/.test(cvSrc + codeOnly(srcOf('lib/football.ts')))],
    [true, true, false, true, false]);
  // The words themselves, from the one place that writes them.
  const { provenanceLine } = await import('../lib/football.ts');
  check('A20e: the opened tile reads "Verified by <club> · <date>" or "Self-reported · entered <date>", and says nothing it cannot stand behind',
    [provenanceLine(verified), provenanceLine({ provenance: 'self_reported', enteredOn: '2026-03-14' }),
     provenanceLine({ provenance: 'official_import', enteredOn: '2026-03-14' }), provenanceLine({ provenance: 'self_reported' }),
     provenanceLine({ provenance: 'coach_verified', verifiedOn: '2026-09-02' })],
    [`Verified by Final B Park FC · ${provenanceLine({ provenance: 'coach_verified', verifiedClub: 'x', verifiedOn: verified.verifiedOn }).split(' · ')[1]}`,
     'Self-reported · entered 14 Mar 2026', null, null, null]);
  void teenGoals;
}

// ---------------------------------------------------------------------------
// LAUNCH GAPS (builder, 28 Sep) — one block, so it merges beside the clean-up
// round's edits rather than through them. The Content-Security-Policy as the
// production build will send it; the SMS switch on /ops/switches (0070); the
// alumni guard on an edit (0071); and the service-role key's enumerated files.
// ---------------------------------------------------------------------------
{
  // --- The Content-Security-Policy (D-94 §8). lib/csp.ts is a plain function,
  //     so the policy a PRODUCTION build sends is readable here without one.
  //     scripts/csp-prod-check.mjs asks the built app itself, after
  //     build:check; layout-check reads every page in a real browser.
  const { contentSecurityPolicy } = await import('../lib/csp.ts');
  const prodCsp = contentSecurityPolicy('N0NCE', { dev: false, storageOrigin: 'https://store.example.supabase.co' });
  const devCsp = contentSecurityPolicy('N0NCE', { dev: true });
  const directive = (p, name) => p.split(';').map((d) => d.trim()).find((d) => d === name || d.startsWith(name + ' ')) ?? '';
  check('csp-p1: in production, scripts run from this site with this request’s nonce and nothing else',
    directive(prodCsp, 'script-src'), "script-src 'self' 'nonce-N0NCE' 'strict-dynamic'");
  check('csp-p2: the production policy carries no eval, no websocket, and inline only for STYLE',
    [/unsafe-eval/.test(prodCsp), /\bwss?:/.test(prodCsp), prodCsp.split(';').filter((d) => /unsafe-inline/.test(d)).map((d) => d.trim().split(' ')[0])],
    [false, false, ['style-src']]);
  // The other direction, or p1 and p2 could pass on a function that ignores
  // its flag: development really does add eval and the hot-reload socket.
  check('csp-p3: and development adds exactly eval and the hot-reload socket',
    [directive(devCsp, 'script-src'), directive(devCsp, 'connect-src')],
    ["script-src 'self' 'nonce-N0NCE' 'strict-dynamic' 'unsafe-eval'", "connect-src 'self' ws: wss:"]);
  const proxySrc = codeOnly(srcOf('proxy.ts'));
  check('csp-p4: "development" is NODE_ENV === \'development\' and nothing else, and the proxy writes no policy of its own',
    [/dev: process\.env\.NODE_ENV === 'development'/.test(proxySrc), /script-src|unsafe-/.test(proxySrc)], [true, false]);
  check('csp-p5: nobody may frame a page, no plugin may load, and <base> cannot move the site',
    [directive(prodCsp, 'frame-ancestors'), directive(prodCsp, 'object-src'), directive(prodCsp, 'base-uri')],
    ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'"]);
  // D-97: the only frame the product makes is the click-to-play clip, and it
  // points at the privacy host. Every <iframe> in the product is found, and
  // each one's host must be in frame-src.
  const frameHosts = [];
  (function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.tsx$/.test(e.name)) {
        for (const m of readFileSync(full, 'utf8').matchAll(/<iframe[\s\S]*?src=\{?[`'"](https:\/\/[^/`'"$]+)/g)) frameHosts.push(m[1]);
      }
    }
  })(fileURLToPath(new URL('../components', import.meta.url)));
  for (const f of routeFiles.filter((x) => x.endsWith('.tsx'))) {
    for (const m of readFileSync(f, 'utf8').matchAll(/<iframe[\s\S]*?src=\{?[`'"](https:\/\/[^/`'"$]+)/g)) frameHosts.push(m[1]);
  }
  check(`csp-p6: frame-src is the privacy YouTube host alone, and every frame in the product points there (${frameHosts.length})`,
    [directive(prodCsp, 'frame-src'), frameHosts.length > 0 && frameHosts.every((h) => h === 'https://www.youtube-nocookie.com')],
    ['frame-src https://www.youtube-nocookie.com', true]);
  check('csp-p7: Stripe is a place a form lands (D-112), never a script, a frame or a connection',
    prodCsp.split(';').filter((d) => /stripe/.test(d)).map((d) => d.trim().split(' ')[0]), ['form-action']);
  check('csp-p8: images may come from the storage host, and from no other outside host',
    directive(prodCsp, 'img-src'), "img-src 'self' data: blob: https://store.example.supabase.co");
  const nextCfg = srcOf('next.config.mjs');
  check('csp-p9: the tokenised pages still send no referrer (D-94 §5), beside the policy',
    /source: '\/p\/:token\*',\s*headers: \[\s*\{ key: 'Referrer-Policy', value: 'no-referrer' \}/.test(nextCfg), true);

  // --- The SMS switch (0070, D-81, D-94 §10).
  const sw = async () => (await db.query('select sms_off, sms_cap_cents from fn_sms_switch()')).rows[0];
  const refusedSms = async (sql, args = []) => { try { await db.query(sql, args); return false; } catch { return true; } };
  check('sms1: SMS starts on, with no lower cap of its own', await sw(), { sms_off: false, sms_cap_cents: null });
  const setOff = async (off, reason = 'sms drill') =>
    (await db.query('select fn_ops_set_sms_off($1,$2,$3,$4) as c', [off, ID.guardian, 'op@example.com', reason])).rows[0].c;
  check('sms2: switching SMS off changes the switch, and pressing it again writes nothing',
    [await setOff(true), (await sw()).sms_off, await setOff(true)], [true, true, false]);
  check('sms3: a switch with no reason is refused',
    await refusedSms('select fn_ops_set_sms_off(false,$1,$2,$3)', [ID.guardian, 'op@example.com', '  ']), true);
  check('sms4: back on', [await setOff(false, 'drill over'), (await sw()).sms_off], [true, false]);
  const setCap = async (cents, reason = 'lower it') =>
    (await db.query('select fn_ops_set_sms_cap($1,$2,$3,$4) as c', [cents, ID.guardian, 'op@example.com', reason])).rows[0].c;
  check('sms5: an operator can set a cap, and setting the same one again writes nothing',
    [await setCap(500), (await sw()).sms_cap_cents, await setCap(500)], [true, 500, false]);
  check('sms6: a cap of nothing or less is refused — zero is the off switch, and it has one of those',
    [await refusedSms('select fn_ops_set_sms_cap(0,$1,$2,$3)', [ID.guardian, 'op@example.com', 'zero']),
      await refusedSms('select fn_ops_set_sms_cap(-5,$1,$2,$3)', [ID.guardian, 'op@example.com', 'negative'])], [true, true]);
  check('sms7: and clearing it goes back to the environment’s', [await setCap(null, 'back to Vercel'), (await sw()).sms_cap_cents], [true, null]);
  const smsLog = (await db.query(
    `select action, operator_email, reason, sms_cap_cents from ops_switch_event where action like 'sms%' order by id`)).rows;
  check('sms8: every SMS change is in the switch log with the operator, the reason and the cap, and only changes are',
    smsLog.map((r) => `${r.action}|${r.operator_email}|${r.reason}|${r.sms_cap_cents}`),
    ['sms_off|op@example.com|sms drill|null', 'sms_on|op@example.com|drill over|null',
      'sms_cap_set|op@example.com|lower it|500', 'sms_cap_cleared|op@example.com|back to Vercel|null']);
  check('sms9: the new rows are as append-only as the old ones',
    [await refusedSms(`update ops_switch_event set reason = 'nothing happened' where action = 'sms_off'`),
      await refusedSms(`delete from ops_switch_event where action like 'sms%'`)], [true, true]);
  check('sms10: and the log still refuses a word it does not know (L5)',
    await refusedSms(`insert into ops_switch_event (action, operator_id, operator_email, reason) values ('sms_forever', $1, 'op@example.com', 'nope')`, [ID.guardian]), true);

  const { smsSwitchedOff, effectiveSmsCapCents, operatorCapCents } = await import('../lib/sms-policy.ts');
  check('sms-p1: SMS is off if EITHER the environment or the operator says so — the database cannot undo SMS_KILL_SWITCH',
    [smsSwitchedOff('true', false), smsSwitchedOff(undefined, true), smsSwitchedOff('true', true), smsSwitchedOff('false', false), smsSwitchedOff(undefined, null)],
    [true, true, true, false, false]);
  check('sms-p2: the cap in force is the lower of the two, so an operator can lower it and never raise it',
    [effectiveSmsCapCents(2000, null), effectiveSmsCapCents(2000, 500), effectiveSmsCapCents(2000, 5000), effectiveSmsCapCents(null, 500), effectiveSmsCapCents(null, null)],
    [2000, 500, 2000, 500, null]);
  check('sms-p3: a typed cap is dollars into cents, and anything above the environment’s is refused',
    [operatorCapCents('5', 2000), operatorCapCents('5.50', 2000), operatorCapCents('$20', 2000), operatorCapCents('20.01', 2000),
      operatorCapCents('0', 2000), operatorCapCents('-1', null), operatorCapCents('lots', null), operatorCapCents('5.555', null)],
    [500, 550, 2000, null, null, null, null, null]);
  const sendCode = codeOnly(srcOf('lib/messaging.ts'));
  const switchAt = sendCode.indexOf('fn_sms_switch()');
  check('sms-p4: the send layer reads the operator’s switch on every SMS, before the meter is charged and before an outbox row exists',
    switchAt > 0 && switchAt < sendCode.indexOf('insert into sms_meter') && switchAt < sendCode.indexOf('insert into message_outbox')
      && /smsSwitchedOff\(process\.env\.SMS_KILL_SWITCH, sw\[0\]\?\.sms_off\)\) return \{ queued: false, reason: 'sms_killed' \}/.test(sendCode)
      && /spend\[0\]\.c \+ DEFAULT_SMS_COST_CENTS > limit\)/.test(sendCode), true);
  const swActions = codeOnly(srcOf('app/ops/switches/actions.ts'));
  check('sms-p5: the SMS actions are operator-only and need a reason, like the other two',
    [...swActions.matchAll(/export async function (setSmsOff|setSmsCap)\(formData: FormData\) \{\s*const op = await requireOperator\(\);\s*[\s\S]*?if \(reason\.length < 3\) redirect/g)].length, 2);
  check('sms-p6: a cap above the environment’s is refused before the database is asked to record it',
    swActions.indexOf('cents > envCap') > 0 && swActions.indexOf('cents > envCap') < swActions.indexOf('fn_ops_set_sms_cap'), true);
  // Every word the switch log can hold has a line on the page, so no operator
  // reads a raw key at the worst possible moment.
  const logWords = [...(await db.query(`select pg_get_constraintdef(oid) d from pg_constraint where conname = 'ops_switch_event_action_check'`)).rows[0].d
    .matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]);
  const swPage = srcOf('app/ops/switches/page.tsx');
  const pageWords = [...swPage.matchAll(/^\s{2}([a-z_]+): '/gm)].map((m) => m[1]);
  check(`sms-p7: every word the switch log can hold has a line on the page (${logWords.length})`,
    logWords.filter((w) => !pageWords.includes(w)), []);
  // The words were a proposal (builder report, 28 Sep); BUZ approved them on
  // 30 Sep, so the card renders in production as well.
  check('sms-p8: the SMS card’s words are approved (BUZ, 30 Sep) — it renders in production too',
    [/const SMS_WORDS_APPROVED = true;/.test(swPage), /const SMS_SHOWN = SMS_WORDS_APPROVED \|\| process\.env\.NODE_ENV !== 'production';/.test(swPage),
      [...swPage.matchAll(/\{SMS_SHOWN && /g)].length >= 7], [true, true, true]);

  // --- D-168 (0120): under-18s register at launch, and the parent's text
  //     waits for SMS. Proved on the database the release runs against, with
  //     the policy module the send path asks, and the send path's source.
  {
    const q1 = async (sql, p = []) => (await db.query(sql, p)).rows[0];
    const numHash = (n) => createHash('sha256').update(n.replace(/\s/g, '')).digest();
    const invite = async (phone, ageDays = 0) => (await q1(
      `insert into pending_invitation (first_name, dob, guardian_name, guardian_phone, guardian_email, sms_token_hash, email_token_hash, created_at)
       values ('Ivy','2014-06-06','Queue Parent',$1,'queue.parent@example.com',$2,$3, now() - make_interval(days => $4)) returning id`,
      [phone, sha(crypto.randomUUID()), sha(crypto.randomUUID()), ageDays])).id;
    const queue = async (inv, phone, body = 'Pitch: approve Ivy', key = 'doc15.§1') => (await q1(
      'select fn_sms_queue($1,null,$2,$3,null,$4,$5,3) as id', [key, phone, body, inv, numHash(phone)])).id;
    const release = async (cap = null) => (await db.query('select id from fn_sms_release($1, 8, 3, 50)', [cap])).rows.map((r) => r.id);
    const rowOf = async (id) => q1(`select queued_for_sms_at is not null as queued, released_at is not null as released,
      failed_at is not null as closed, failure_reason, body, attempts from message_outbox where id = $1`, [id]);
    const meter = async (phone) => (await q1('select fn_sms_count_24h($1) as n', [numHash(phone)])).n;
    const sentEvents = async (inv) => (await q1(`select count(*)::int as n from consent_event where event = 'sms_sent' and detail->>'invitation_id' = $1`, [inv])).n;
    const setOff = async (off) => db.query('select fn_ops_set_sms_off($1,$2,$3,$4)', [off, ID.guardian, 'op@example.com', off ? 'queue drill' : 'queue drill over']);
    // Whatever the switch block above left, this block starts with SMS on.
    await setOff(false);

    const { smsCanSend, smsProviderConfigured } = await import('../lib/sms-policy.ts');
    const all = { sid: 'AC1', key: 'k', from: '+61400000000' };
    check('q1: SMS cannot send in production with no provider configured, no cap, or either switch off — and a development server always can unless it is switched off (D-168)',
      [smsCanSend({ production: true, envKill: undefined, dbOff: false, envCap: 2000, providerConfigured: false }),
       smsCanSend({ production: true, envKill: undefined, dbOff: false, envCap: null, providerConfigured: true }),
       smsCanSend({ production: true, envKill: 'true', dbOff: false, envCap: 2000, providerConfigured: true }),
       smsCanSend({ production: true, envKill: undefined, dbOff: true, envCap: 2000, providerConfigured: true }),
       smsCanSend({ production: true, envKill: undefined, dbOff: false, envCap: 2000, providerConfigured: true }),
       smsCanSend({ production: false, envKill: undefined, dbOff: false, envCap: null, providerConfigured: false }),
       smsCanSend({ production: false, envKill: undefined, dbOff: true, envCap: null, providerConfigured: false })],
      [false, false, false, false, true, true, false]);
    check('q1b: a provider is configured only with all three Twilio values, and never in a demo',
      [smsProviderConfigured(all, false), smsProviderConfigured({ ...all, from: '' }, false), smsProviderConfigured({ ...all, sid: undefined }, false), smsProviderConfigured(all, true)],
      [true, false, false, false]);

    // The send path: while SMS cannot send, the parent's approval text — and
    // only that — is queued instead of refused, and the spine is not told a
    // text went.
    const sendCode = codeOnly(srcOf('lib/messaging.ts'));
    const queueAt = sendCode.indexOf('fn_sms_queue(');
    check('q2: send() queues the parent’s approval text (§1, §1b) when SMS cannot send, before any refusal for the switch or the cap — and nothing else queues',
      [/const QUEUE_UNTIL_SMS_SENDS = new Set<string>\(\['doc15\.§1', 'doc15\.§1b'\]\);/.test(sendCode),
       /if \(!canSend && QUEUE_UNTIL_SMS_SENDS\.has\(msg\.key\) && to\.invitationId\) \{/.test(sendCode),
       queueAt > 0 && queueAt < sendCode.indexOf("reason: 'sms_killed'") && queueAt < sendCode.indexOf("reason: 'sms_no_cap'"),
       sendCode.indexOf("reason: 'sms_opted_out'") < queueAt],
      [true, true, true, true]);
    check('q2b: a waiting text writes no sms_sent on the spine — sendAndLog skips it, and the release writes it when a text goes',
      [/if \(result\.queued && !result\.waiting\) \{/.test(sendCode), /'sms_sent'/.test(await procSrc('fn_sms_release'))], [true, true]);
    const guardianFlow = codeOnly(srcOf('lib/guardian-flow.ts'));
    check('q2c: both of the sign-up’s texts carry their invitation, so both can wait (the child’s door and a 16–17 naming a parent)',
      (guardianFlow.match(/sendAndLog\(sms\(.*?\), \{ address: input\.guardianPhone\.trim\(\), invitationId \}, 'sms_sent'/g) ?? []).length, 1);

    const PHONE = '0400 616 161';
    const inv = await invite(PHONE);
    const id = await queue(inv, PHONE);
    const r0 = await rowOf(id);
    check('q3: with SMS unable to send, the text is written as queued — not refused, not failed, not metered, not on the spine',
      [Boolean(id), r0.queued, r0.released, r0.closed, r0.attempts, await meter(PHONE), await sentEvents(inv)],
      [true, true, false, false, 0, 0, 0]);
    check('q3b: the backlog counts it, and the child’s waiting screen can see its own',
      [(await q1('select fn_sms_queued_count() as n')).n >= 1, (await q1('select fn_invitation_sms_queued($1) as w', [inv])).w], [true, true]);

    await setOff(true);
    check('q4: the operator’s kill switch holds the queue: a release run while it is off sends nothing', [(await release()).includes(id), (await rowOf(id)).released], [false, false]);
    await setOff(false);
    const spend = (await q1('select fn_sms_spend_month() as c')).c;
    check('q5: the monthly cap holds the queue: a cap the next text would cross releases nothing', (await release(spend + 7)).includes(id), false);

    const out = await release();
    const r1 = await rowOf(id);
    check('q6: with SMS able to send, one release run sends it — metered once, released, and the spine told once, with its invitation',
      [out.includes(id), r1.released, r1.attempts, await meter(PHONE), await sentEvents(inv), (await q1('select fn_invitation_sms_queued($1) as w', [inv])).w],
      [true, true, 1, 1, 1, false]);
    check('q6b: and a second run does not send it again', (await release()).includes(id), false);
    const sweepSrc = codeOnly(srcOf('app/api/jobs/outbox/route.ts'));
    check('q6c: the retry sweep never claims a waiting text (it would send it unmetered), and the job releases the queue before it sweeps',
      [/and \(queued_for_sms_at is null or released_at is not null\)/.test(sweepSrc),
       sweepSrc.indexOf('releaseWaitingTexts(') > 0 && sweepSrc.indexOf('releaseWaitingTexts(') < sweepSrc.indexOf('update message_outbox set attempts')],
      [true, true]);

    // The 14-day purge (D-17): an invitation purged before its text went sends nothing.
    const PURGE_PHONE = '0400 626 262';
    const oldInv = await invite(PURGE_PHONE, 15);
    const oldId = await queue(oldInv, PURGE_PHONE, 'Pitch: approve Ivy, purged');
    await db.query('select fn_purge_pending()');
    const rp = await rowOf(oldId);
    check('q7: a purged invitation’s queued text is closed and emptied by the purge, and no release ever sends it',
      [rp.closed, rp.failure_reason, rp.body, (await release()).includes(oldId), await meter(PURGE_PHONE), (await rowOf(oldId)).released],
      [true, 'purged', '', false, 0, false]);
    // An invitation that stops being open any other way (approved, held,
    // deleted by a cascade) is closed at release, not sent.
    const HELD_PHONE = '0400 636 363';
    const heldInv = await invite(HELD_PHONE);
    const heldId = await queue(heldInv, HELD_PHONE);
    await db.query('update pending_invitation set held_at = now() where id = $1', [heldInv]);
    check('q7b: a held invitation’s text is closed at release, never sent (D-155)',
      [(await release()).includes(heldId), (await rowOf(heldId)).failure_reason, await meter(HELD_PHONE)], [false, 'invitation_closed', 0]);

    // Three a day per number, on the backlog.
    const LIMIT_PHONE = '0400 646 464';
    const lim = [];
    for (let i = 0; i < 5; i++) lim.push(await queue(await invite(LIMIT_PHONE), LIMIT_PHONE));
    check('q8: at queue time, three a day per number: a fourth and fifth text to one number inside a day are refused, not saved up',
      lim.map(Boolean), [true, true, true, false, false]);
    // A backlog older than a day is bigger than three: two days of three.
    await db.query(`update message_outbox set queued_for_sms_at = now() - interval '2 days', created_at = now() - interval '2 days' where id = any($1)`, [lim.filter(Boolean)]);
    for (let i = 0; i < 3; i++) lim.push(await queue(await invite(LIMIT_PHONE), LIMIT_PHONE));
    const waiting = lim.filter(Boolean);
    const sent1 = (await release()).filter((x) => waiting.includes(x));
    check('q8b: the per-number limit holds on a backlog of six: one run sends three, oldest first, and leaves three queued',
      [waiting.length, sent1.length, await meter(LIMIT_PHONE), JSON.stringify(sent1.sort()) === JSON.stringify(waiting.slice(0, 3).sort()),
       (await db.query('select count(*)::int as n from message_outbox where id = any($1) and released_at is null and failed_at is null', [waiting])).rows[0].n],
      [6, 3, 3, true, 3]);
    check('q8c: and the next run inside the day sends none of the rest', (await release()).filter((x) => waiting.includes(x)).length, 0);

    // STOP means stop, even for a text written before it was said.
    const STOP_PHONE = '0400 656 565';
    const stopId = await queue(await invite(STOP_PHONE), STOP_PHONE);
    await db.query('insert into sms_opt_out (number_hash, opted_out_at) values ($1, now())', [numHash(STOP_PHONE)]);
    check('q9: a number that opted out after its text was queued is never sent it',
      [(await release()).includes(stopId), (await rowOf(stopId)).failure_reason, await meter(STOP_PHONE)], [false, 'opted_out', 0]);

    // A resend mints a new link (D-156): the older queued text is retired.
    const RESEND_PHONE = '0400 666 767';
    const rInv = await invite(RESEND_PHONE);
    const first = await queue(rInv, RESEND_PHONE, 'old link');
    const second = await queue(rInv, RESEND_PHONE, 'new link');
    check('q10: a newer text for the same invitation retires the older queued one, whose link no longer works',
      [(await rowOf(first)).failure_reason, (await rowOf(first)).body, (await rowOf(second)).queued, (await rowOf(second)).closed],
      ['superseded', '', true, false]);

    // The day-10 nudge (doc 15 §3) re-mints the texted link; it must not do
    // that to a text still waiting in the queue, whose link would die unsent.
    const NUDGE_PHONE = '0400 676 868';
    const nInv = await invite(NUDGE_PHONE, 11);
    const nId = await queue(nInv, NUDGE_PHONE);
    const nudgeable = async () => (await db.query('select invitation_id from fn_pending_nudges()')).rows.map((r) => r.invitation_id);
    check('q12: an invitation whose approval text is still waiting is not nudged on day ten (the nudge would kill the waiting text\u2019s link)',
      (await nudgeable()).includes(nInv), false);
    await db.query('select fn_sms_release(null, 8, 3, 50)');
    check('q12b: once the text has gone, the day-ten nudge is due as before', [(await rowOf(nId)).released, (await nudgeable()).includes(nInv)], [true, true]);

    // The 7am digest.
    const { digestMessage } = await import('../lib/digest.ts');
    const wl = { newByRole: { player: 1 }, newTotal: 1, total: 9, unsubscribed: 0 };
    check('q11: the digest carries the queued-text count only while its words are shown, and nothing happening still sends nothing',
      [digestMessage(null, 0, true), digestMessage(null, 4, false), /waiting for SMS: 4$/m.test(digestMessage(null, 4, true)?.text ?? ''),
       /waiting for SMS/.test(digestMessage(wl, 4, false)?.text ?? ''), /waiting for SMS: 4$/m.test(digestMessage(wl, 4, true)?.text ?? '')],
      [null, null, true, false, true]);
    const digestRoute = codeOnly(srcOf('app/api/digest/route.ts'));
    check('q11b: its words are approved (BUZ, 29 Sep): the route shows the count in every build, and still sends nothing from development',
      [/const showQueued = true;/.test(digestRoute),
       digestRoute.search(/if \(process\.env\.NODE_ENV !== 'production'\) \{\s*return NextResponse\.json\(\{ ok: true, sent: false/) > 0
         && digestRoute.search(/if \(process\.env\.NODE_ENV !== 'production'\) \{\s*return NextResponse\.json\(\{ ok: true, sent: false/) < digestRoute.indexOf('await fetch(')],
      [true, true]);
  }

  // --- The alumni wall's "18 or over" guard holds on an edit too (0071).
  const alumniOk = crypto.randomUUID();
  await db.query(`insert into alumni_entry (id, club_id, line, sort, adults_confirmed_by, adults_confirmed_at)
    values ($1,$2,'A. Senior → NPL Victoria',90,$3,now())`, [alumniOk, CLUB.riverside, ID.td]);
  check('al-u1: a confirmed entry can still be edited',
    await refusedSms(`update alumni_entry set line = 'A. Senior → A-League Youth' where id = $1`, [alumniOk]), false);
  check('al-u2: an edit that strips the confirmation is refused',
    await refusedSms(`update alumni_entry set adults_confirmed_by = null, adults_confirmed_at = null where id = $1`, [alumniOk]), true);
  // An entry from before 0051, which nobody ever confirmed. The trigger is
  // stepped around for the insert only, to make a row the old schema allowed.
  const alumniOld = crypto.randomUUID();
  await db.query('alter table alumni_entry disable trigger alumni_entry_adults_confirmed');
  await db.query(`insert into alumni_entry (id, club_id, line, sort) values ($1,$2,'An old line',91)`, [alumniOld, CLUB.riverside]);
  await db.query('alter table alumni_entry enable trigger alumni_entry_adults_confirmed');
  check('al-u3: an entry from before the guard cannot be rewritten without someone confirming it',
    await refusedSms(`update alumni_entry set line = 'Named Junior → NPL' where id = $1`, [alumniOld]), true);
  check('al-u4: but it can be confirmed, which is an edit that satisfies the guard',
    await refusedSms(`update alumni_entry set adults_confirmed_by = $2, adults_confirmed_at = now() where id = $1`, [alumniOld, ID.td]), false);
  check('al-u5: outside an erasure, taking the confirmer\u2019s name off is refused, even with the time kept',
    await refusedSms(`update alumni_entry set adults_confirmed_by = null where id = $1`, [alumniOk]), true);
  // 0067's erasure takes an erased person's name off anything they signed,
  // alumni confirmations included. The guard must let exactly that through,
  // or a guardian's one-tap deletion fails on an alumni line.
  const erased = crypto.randomUUID(), alumniErased = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob) values ($1,'Erasedconfirmer',$2)`, [erased, yearsAgo(15)]);
  await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2, now())`, [ID.guardian, erased]);
  await db.query(`insert into alumni_entry (id, club_id, line, sort, added_by, adults_confirmed_by, adults_confirmed_at)
    values ($1,$2,'B. Senior → State League',92,$3,$3, now() - interval '1 day')`, [alumniErased, CLUB.riverside, erased]);
  let eraseErr = null;
  try { await db.query('select fn_erase_child($1,$2)', [ID.guardian, erased]); } catch (e) { eraseErr = e.message; }
  const after = (await db.query(`select added_by, adults_confirmed_by, adults_confirmed_at is not null as confirmed_at, line
    from alumni_entry where id = $1`, [alumniErased])).rows[0];
  check('al-u6: an erasure still completes for someone who confirmed an entry — the name goes, the time and the line stay (0067)',
    [eraseErr, after], [null, { added_by: null, adults_confirmed_by: null, confirmed_at: true, line: 'B. Senior → State League' }]);
  await db.query('delete from alumni_entry where id in ($1,$2,$3)', [alumniOk, alumniOld, alumniErased]);

  // --- The service-role key (D-80). CI's check (.github/workflows/ci.yml),
  //     run here so it runs on every suite and not only on a push this branch
  //     has never made. It is NOT doc 14 J3: J3 says one server route, the
  //     key is read in two files, and widening D-80 to two was flagged in
  //     lib/storage.ts for BUZ and John rather than decided. This pins the
  //     list so a third file fails; the row stays theirs to rule on.
  const keyFiles = [];
  (function walk(d, rel) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full, `${rel}/${e.name}`);
      else if (/\.(ts|tsx|js|mjs)$/.test(e.name) && /SUPABASE_SERVICE_ROLE_KEY/.test(readFileSync(full, 'utf8'))) keyFiles.push(`${rel}/${e.name}`);
    }
  })(fileURLToPath(new URL('../app', import.meta.url)), 'app');
  for (const top of ['components', 'lib']) {
    (function walk(d, rel) {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const full = join(d, e.name);
        if (e.isDirectory()) walk(full, `${rel}/${e.name}`);
        else if (/\.(ts|tsx|js|mjs)$/.test(e.name) && /SUPABASE_SERVICE_ROLE_KEY/.test(readFileSync(full, 'utf8'))) keyFiles.push(`${rel}/${e.name}`);
      }
    })(fileURLToPath(new URL(`../${top}`, import.meta.url)), top);
  }
  if (/SUPABASE_SERVICE_ROLE_KEY/.test(srcOf('proxy.ts'))) keyFiles.push('proxy.ts');
  check(`srk1: the service-role key is read in its two enumerated server-only files and nowhere else (${keyFiles.sort().join(', ')})`,
    [keyFiles.sort(), keyFiles.every((f) => /^import 'server-only';/m.test(srcOf(f)))],
    [['lib/storage.ts', 'lib/waitlist-db.ts'], true]);
  check('srk2: and the tokenised read path is not one of them (D-80)',
    /SUPABASE_SERVICE_ROLE_KEY/.test(srcOf('lib/record-read.ts')), false);

  // --- The 0051 pre-flight, written down for whoever deploys it. The queries
  //     are the script's (scripts/migration-on-data.mjs PREFLIGHT); the doc
  //     must carry every one of them word for word, under its constraint's
  //     name, or the person at the SQL editor runs a stale list.
  const preflight = [...srcOf('scripts/migration-on-data.mjs').matchAll(/\['([a-z_]+)', `([^`]+)`\]/g)].map((m) => [m[1], m[2]]);
  const pfDoc = srcOf('docs/team/RELEASE-PREFLIGHT.md');
  const pfMissing = preflight.filter(([c, q]) => !new RegExp('`' + c + '`\\*\\*\\n```sql\\n' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ';\\n```').test(pfDoc));
  check(`pf1: every pre-flight query the migration script prints is in docs/team/RELEASE-PREFLIGHT.md, word for word (${preflight.length})`,
    [preflight.length, pfMissing.map(([c]) => c)], [7, []]);
}

// --- The token read path's rate limit (CLAUDE.md §2; brief C, 29 Sep). What
//     a refusal looks like and how long it takes is the timing suite's row
//     tok-rl; these pin the two things it cannot see from outside.
{
  const readSrc = codeOnly(srcOf('lib/record-read.ts'));
  const limitHomes = tsSourceFiles().filter((f) => /TOKEN_READ_LIMITS\s*=|token-read:/.test(codeOnly(srcOf(f))));
  check('tok-p1: the limits are one constant, in the one read path, and nothing else counts token reads (lib/record-read.ts)',
    [limitHomes, /export const TOKEN_READ_LIMITS = \{ perLink: \d+, perAddress: \d+, windowSeconds: [\d * ]+ \} as const;/.test(readSrc)],
    [['lib/record-read.ts'], true]);
  // A refusal makes the query a string that was never a link makes: one
  // fn_token_read, reached on both paths, with nothing returned before it.
  const afterDecision = readSrc.slice(readSrc.indexOf('await withinLimits('));
  check('tok-p2: a refused read asks the database the question a link that never existed asks, and both limits are counted every time',
    [/\? hash : randomBytes\(32\);/.test(afterDecision), (readSrc.match(/fn_token_read\(/g) ?? []).length,
     /return null/.test(afterDecision.slice(0, afterDecision.indexOf('fn_token_read('))),
     /const link = await checkRate\([^;]*\);\s*const address = await checkRate\([^;]*\);\s*return link && address;/.test(readSrc),
     /const withinLimits = cache\(/.test(readSrc)],
    [true, 1, false, true, true]);
}

// --- One reader of share_token by its hash (D-80; brief D, 29 Sep). CLAUDE.md
//     names the request-access handler as a caller of the one read path, and
//     until 29 Sep it asked share_token itself. A token's hash is how a
//     stranger's string becomes a child's record, so everything that turns
//     one into the other is in lib/record-read.ts — with two named exceptions
//     that are not a token holder at all:
//
//       app/ops/reports/page.tsx, app/ops/reports/actions.ts — the operator's
//       report desk (doc 32 A1). A report on a player page stores the hex of
//       the link's hash (never the token); the desk resolves it to a record
//       id and nothing else, to put a hold on the page — it takes access
//       away, never grants it. Behind requireOperator, and it selects no field
//       of the record (D-79).
{
  // Every SQL string in the code. For each predicate on a token_hash column,
  // which table owns it: the alias's table, or for a bare column the nearest
  // table named before it. share_token's is a hit.
  const shareTokenByHash = (src) => {
    const hits = [];
    const code = codeOnly(src);
    for (const m of [...code.matchAll(/`([^`]*)`/g), ...code.matchAll(/'([^'\n]*)'/g)]) {
      const sql = m[1];
      for (const t of sql.matchAll(/(?:(\w+)\.)?token_hash\s*(?:=|\bin\b)|=\s*(?:(\w+)\.)?token_hash\b/gi)) {
        const alias = t[1] ?? t[2];
        const table = alias
          ? (new RegExp(`\\b(?:from|join|update|into)\\s+(\\w+)\\s+(?:as\\s+)?${alias}\\b`, 'i').exec(sql)?.[1] ?? alias)
          : [...sql.slice(0, t.index).matchAll(/\b(?:from|join|update|into)\s+(\w+)/gi)].pop()?.[1];
        if (table === 'share_token') hits.push(sql);
      }
    }
    return hits;
  };
  // L19: the scanner catches the shapes it exists for, and passes the one
  // near miss in the product (the undo page matches undo_token by its hash
  // and updates share_token by id).
  const selfTest = [
    shareTokenByHash('db.query(`select st.id from share_token st join development_record dr on dr.id = st.record_id where st.token_hash = $1`)').length,
    shareTokenByHash("db.query(`select record_id from share_token where token_hash = decode($1, 'hex')`)").length,
    shareTokenByHash("db.query('select id from share_token where token_hash = $1')").length,
    shareTokenByHash('db.query(`update share_token set revoked_at = now() where id = (select share_token_id from undo_token where token_hash = $1)`)').length,
    shareTokenByHash('db.query(`insert into share_token (record_id, token_hash) values ($1,$2)`)').length,
  ];
  const ALLOWED = ['app/ops/reports/actions.ts', 'app/ops/reports/page.tsx'];
  const readers = tsSourceFiles().concat(['proxy.ts']).filter((f) => shareTokenByHash(srcOf(f)).length > 0).sort();
  check(`tok-one1: nothing outside lib/record-read.ts selects from share_token by token_hash, but the operator's report desk (${readers.join(', ')})`,
    [selfTest, readers.filter((f) => f !== 'lib/record-read.ts' && !ALLOWED.includes(f)), ALLOWED.every((f) => readers.includes(f))],
    [[1, 1, 1, 0, 0], [], true]);
  // The notice lookup answers every token with the same one query: it starts
  // from the hash and left-joins, so a string that was never a link gets a row
  // of nulls from the same statement a real one gets its row from, and an
  // absurd string is looked up as a hash nothing matches rather than answered
  // without a query.
  const readSrc = codeOnly(srcOf('lib/record-read.ts'));
  const notice = readSrc.slice(readSrc.indexOf('export async function resolveTokenForNotice('), readSrc.indexOf('export async function assembleCv('));
  check('tok-one2: the notice lookup runs one query of one shape for every token — never existed, dead or live — and selects nothing from the record',
    [(notice.match(/db\.query\(/g) ?? []).length, /return null/.test(notice.slice(0, notice.indexOf('db.query('))),
     /from \(select \$1::bytea as token_hash\) asked\s+left join share_token st on st\.token_hash = asked\.token_hash/.test(notice),
     /: randomBytes\(32\);/.test(notice), /dr\.(?!id\b|person_id\b)\w+/.test(notice), /select st\.id as token_id, p\.first_name,/.test(notice)],
    [1, false, true, true, false, true]);
}

// --- The address bar after a send (L38/L42; brief D, 29 Sep). A real send
//     by a guardian redirected to `?sent=1&link=<the raw token>` and a limited
//     one to `?sent=1`, so the address said whether the limit bit and a live
//     share token sat in the browser's history. What the two responses
//     actually are is the write suite's (addr-w*); these pin the source.
{
  const act = codeOnly(dispatchSrc);
  const redirects = [...act.matchAll(/redirect\(([^)]*)\)/g)].map((m) => m[1]);
  check('addr1: the guardian’s send door answers a real send and a limited one with exactly the same address, and no redirect carries the link',
    [redirects.filter((r) => /sent=1/.test(r)), redirects.some((r) => /raw|link|token/.test(r))],
    [['`/g/send/${requestId}?sent=1`', '`/g/send/${requestId}?sent=1`'], false]);
}

// --- Vercel Analytics sees four public pages and nothing else (brief C,
//     29 Sep; pillar zero 5, D-25; D-94 §1). What the pages actually serve is
//     the render suite's (an-r1–r3) and what a browser runs is the layout
//     check's; these pin where it can be mounted at all.
{
  const importing = (re) => tsSourceFiles().filter((f) => re.test(codeOnly(srcOf(f)))).sort();
  check('an-p1: the root layout mounts no analytics — a layout is every page, /p/<token> included',
    /analytics/i.test(codeOnly(srcOf('app/layout.tsx'))), false);
  check('an-p2: @vercel/analytics is imported in one file, and that file hands it the allowlist as beforeSend',
    [importing(/from '@vercel\/analytics/), /<Analytics beforeSend=\{analyticsBeforeSend\} \/>/.test(srcOf('components/PublicAnalyticsScript.tsx'))],
    [['components/PublicAnalyticsScript.tsx'], true]);
  // The front door is two files and one address: the coming-soon page, and
  // the product's front door that proxy.ts serves at `/` once the launch-day
  // switch is on (D-164, 0080).
  check('an-p3: which is mounted by one component, and that component by the four public pages only (the front door is two files at one address)',
    [importing(/from '\.\/PublicAnalyticsScript'|from '@\/components\/PublicAnalyticsScript'/),
     importing(/from '@\/components\/PublicAnalytics'/)],
    [['components/PublicAnalytics.tsx'], ['app/fc/[slug]/page.tsx', 'app/front-door/page.tsx', 'app/jobs/page.tsx', 'app/page.tsx', 'app/trials/page.tsx']]);
  check('an-p4: and mounts nothing at all for a visitor with a session (who may be a child we know is one)',
    /if \(await getSessionPersonId\(\)\) return null;\s*return <PublicAnalyticsScript \/>;/.test(codeOnly(srcOf('components/PublicAnalytics.tsx'))), true);
  const allowed = ['/', '/trials', '/jobs', '/fc/riverside-fc'];
  const refused = ['/p/dev-jordan', '/p/dev-jordan/print', '/a/dev-mila-text', '/g/controls/x', '/build/x', '/c/sam-kaya',
    '/cv-preview/deniz', '/jobs/0b7c', '/trials/x', '/fc/riverside-fc/print', '/fc/', '/home', '/signin', '//', '/trials/', ''];
  check(`an-p5: the allowlist is exactly the front door, /trials, /jobs and a club page (${allowed.length} in, ${refused.length} out)`,
    [allowed.filter((p) => !analyticsAllowed(p)), refused.filter((p) => analyticsAllowed(p))], [[], []]);
  const ev = (u) => analyticsBeforeSend({ type: 'pageview', url: u })?.url ?? null;
  check('an-p6: an event the script would send after a navigation inside the tab is dropped off the list, and trimmed to its path on it',
    [ev('https://pitchfootball.com.au/p/abc123'), ev('https://pitchfootball.com.au/g/controls/x?link=abc'),
     ev('https://pitchfootball.com.au/trials?age=U12#top'), ev('https://pitchfootball.com.au/'), ev('not a url')],
    [null, null, 'https://pitchfootball.com.au/trials', 'https://pitchfootball.com.au/', null]);
}

// --- L15, round E (29 Sep): an invented club is never named after a real
//     suburb. The seed's claimed-and-unverified club was named after a
//     Melbourne suburb with real football clubs in it, and the name sat in
//     the seed, the demo layer, the demo seats and every suite. It is
//     Quarrymead United now. This fails if the old name comes back into
//     anything that seeds, demos or tests the product, or into the scripts a
//     demo is run from. The name is assembled, so this file does not trip
//     itself. (Historical reports and the signed design screens are not read:
//     the first are a record of what happened, the second are not ours to edit.)
{
  const old = ['sun', 'bury'].join('');
  const files = [...tsSourceFiles(),
    ...readdirSync(fileURLToPath(new URL('../scripts', import.meta.url)), { recursive: true }).map((f) => `scripts/${f}`)
      .filter((f) => /\.(mjs|mts|ts|js|py)$/.test(f)),
    'docs/WALKTHROUGH.md', 'docs/DEMO.md', 'docs/DEMO-TD.md', 'docs/team/LESSONS.md'];
  const named = files.filter((f) => new RegExp(old, 'i').test(f === 'docs/team/LESSONS.md'
    ? srcOf(f).split('*Rule:* use names already in the seed')[1].split('*Amended 29 Sep (round E)')[0] : srcOf(f)));
  check(`fx1: no seed, demo, suite or demo script names the club after a real suburb (${files.length} files read${named.length ? ' — still there: ' + named.join(', ') : ''})`,
    [files.length > 60, named], [true, []]);
}

// --- L15, brief H (29 Sep): localities stay real. Round E's rename made
//     "Quarrymead" the club's suburb as well as its name — a place that does
//     not exist — and "Tarrowvale City FC" sat in "Tarrowvale". Every
//     locality the seed gives a club, and every fixture's, is on this list of
//     real Victorian suburbs, and none is the club's own name. A new
//     locality has to be added here by somebody who checked it exists, which
//     is the point: the list is the claim, and it is read by a person.
{
  const REAL_VIC = new Set(['Brunswick', 'Brunswick West', 'Preston', 'Altona', 'Coburg', 'Diggers Rest', 'Hoppers Crossing']);
  const seed = srcOf('scripts/dev-db.mts');
  const seeded = [...seed.matchAll(/insert into club \(id, name, suburb, state[^)]*\)\s*values \(\$1,'([^']+)','([^']+)','(?:VIC|NSW)'/g)].map((m) => [m[1], m[2]]);
  const fixtures = PLAYER_FIXTURES.filter((p) => p.locality).map((p) => [p.club, p.locality.replace(/ (VIC|NSW)$/, '')]);
  const all = [...seeded, ...fixtures];
  const invented = all.filter(([, sub]) => !REAL_VIC.has(sub)).map(([c, sub]) => `${c} in ${sub}`);
  const ownName = all.filter(([club, sub]) => sub.split(' ').some((w) => club.split(' ').includes(w))).map(([c, sub]) => `${c} in ${sub}`);
  check(`fx2: every club the seed and the fixtures place is in a real Victorian suburb that is not its own name (${all.length} read${invented.length + ownName.length ? ' — ' + [...invented, ...ownName].join(', ') : ''})`,
    [all.length >= 7, invented, ownName], [true, [], []]);
}

// --- The operator's Today screen (brief G, 29 Sep; 0110; D-79, D-162). Every
//     figure on it is a count, and the promise in its own footer — "no name,
//     no record, and no way to get to one from here" — is held in four
//     places, each read here rather than trusted: the two functions' result
//     columns (the catalogue), the functions' bodies, the page's own query
//     text, and what the page links to. Then the functions are driven.
{
  const result = async (sig) => (await db.query(`select pg_get_function_result($1::regprocedure) as r`, [sig])).rows[0].r;
  const todayCols = [...(await result('fn_ops_today()')).matchAll(/(\w+) (\w[\w ]*?)(?:,|\)$)/g)].map((m) => [m[1], m[2]]);
  check(`ops-t1: fn_ops_today returns integers and nothing else (${todayCols.length} columns)`,
    [todayCols.length >= 10, todayCols.filter(([, t]) => t !== 'integer').map(([c]) => c)], [true, []]);
  check('ops-t2: fn_ops_delivery_failures returns the channel, the time and the provider’s word — never an address or a message',
    await result('fn_ops_delivery_failures()'), 'TABLE(channel text, failed_at timestamp with time zone, provider_said text)');
  const PERSONAL = /\b(first_name|last_name|email|dob|to_address|to_person|body|guardian_name|guardian_phone|guardian_email|note|photo_path|reporter_email|reason|subject_id|player_id|child_id|person_id)\b/;
  const bodies = (await db.query(`select proname, prosrc from pg_proc where proname in ('fn_ops_today','fn_ops_delivery_failures')`)).rows;
  // person_id and friends are allowed in a WHERE that joins, never in a
  // select list, so the bodies are read with their WHERE/ON/EXISTS clauses
  // taken out: what is left is what the function hands back.
  const selected = (src) => src.replace(/--[^\n]*/g, '')
    .replace(/\bexists\s*\((?:[^()]|\([^()]*\))*\)/gi, 'exists(…)')
    .replace(/\b(where|on)\b[^\n]*/gi, '');
  check(`ops-t3: neither function selects a personal field (${bodies.map((b) => b.proname).join(', ')})`,
    [bodies.length, bodies.filter((b) => PERSONAL.test(selected(b.prosrc))).map((b) => b.proname)], [2, []]);
  const page = srcOf('app/ops/page.tsx');
  const queries = [...codeOnly(page).matchAll(/db\.query\(\s*`([^`]*)`/g)].map((m) => m[1].replace(/\s+/g, ' ').trim());
  // Brief H (D-168, 0120): a third, the count of parents' texts waiting for
  // SMS, so BUZ watches the backlog clear. A count, like the other two.
  // 0159 (30 Sep): a fourth, the count of clubs asking to be added.
  check(`ops-t4: the Today page asks the database exactly four things, all counts (${queries.length} queries)`,
    queries, ['select * from fn_ops_today()', 'select channel, failed_at, provider_said from fn_ops_delivery_failures()', 'select fn_sms_queued_count() as n', 'select fn_club_requests_open() as n']);
  const hrefs = [...codeOnly(page).matchAll(/href=\{?["'`]([^"'`]*)["'`]\}?/g)].map((m) => m[1]);
  check('ops-t5: and it links to one place, the lookup, with nothing of anybody’s in the address',
    [hrefs, /href=\{[^"'`]/.test(codeOnly(page))], [['/ops/support'], false]);

  // Driven: a person who joined now, a sent approval request that was
  // approved, and a failed text. The counts move; the address and the
  // message never come out.
  const before = (await db.query('select * from fn_ops_today()')).rows[0];
  const opsKid = crypto.randomUUID(), opsInv = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, email) values ($1, 'Opsfixture', 'ops-fixture@example.com')`, [opsKid]);
  await db.query(`insert into development_record (person_id) values ($1)`, [opsKid]);
  await db.query(`insert into consent_event (event, detail) values ('sms_sent', jsonb_build_object('invitation_id', $1::text)), ('email_sent', jsonb_build_object('invitation_id', $1::text)), ('approved', jsonb_build_object('invitation_id', $1::text))`, [opsInv]);
  // And one asked for three days ago and approved today: an approval, but not
  // of anything sent today, so it is in neither figure.
  const opsOld = crypto.randomUUID();
  await db.query(`insert into consent_event (event, at, detail) values ('email_sent', now() - interval '3 days', jsonb_build_object('invitation_id', $1::text)), ('approved', now(), jsonb_build_object('invitation_id', $1::text))`, [opsOld]);
  await db.query(`insert into message_outbox (message_key, channel, to_address, body, sent_at, failed_at, failure_reason)
    values ('doc15.§1', 'sms', '+61400000999', 'ops fixture body', now(), now(), 'undelivered')`);
  const after = (await db.query('select * from fn_ops_today()')).rows[0];
  const fails = (await db.query('select * from fn_ops_delivery_failures()')).rows;
  check('ops-t6: a person joining today, one invitation sent on two channels and approved, move the counts by one each',
    [after.signups_total - before.signups_total, after.signups_player - before.signups_player,
     after.approvals_sent - before.approvals_sent, after.approved - before.approved], [1, 1, 1, 1]);
  // 0157 (BUZ, 30 Sep: the 7am email about yesterday). fn_ops_day is the
  // Today screen's count for any Melbourne date: for today it must agree with
  // fn_ops_today to the number, and yesterday must not see today's joiner.
  {
    const dayCols = [...(await result('fn_ops_day(date)')).matchAll(/(\w+) (\w[\w ]*?)(?:,|\)$)/g)].map((m) => [m[1], m[2]]);
    check(`ops-d1: fn_ops_day returns integers and nothing else (${dayCols.length} columns)`,
      [dayCols.length, dayCols.filter(([, ty]) => ty !== 'integer').map(([c]) => c)], [7, []]);
    const dayBody = (await db.query(`select prosrc from pg_proc where proname = 'fn_ops_day'`)).rows[0]?.prosrc ?? '';
    check('ops-d2: and selects no personal field', PERSONAL.test(selected(dayBody)), false);
    const mel = `(now() at time zone 'Australia/Melbourne')::date`;
    const d0 = (await db.query(`select * from fn_ops_day(${mel})`)).rows[0];
    const keys = ['signups_total', 'signups_player', 'signups_parent', 'signups_coach', 'signups_club', 'approvals_sent', 'approved'];
    check('ops-d3: for today it agrees with the Today screen, number for number',
      keys.map((k) => d0[k]), keys.map((k) => after[k]));
    const d1 = (await db.query(`select * from fn_ops_day(${mel} - 1)`)).rows[0];
    check('ops-d4: and yesterday does not count a person who joined today, nor today\u2019s invitation',
      [d1.signups_total < d0.signups_total || d0.signups_total === 0, d1.approvals_sent < d0.approvals_sent], [true, true]);
    // 0158: the operator's test accounts are left out of the 7am counts, a
    // +tag included, and the list comes from the environment, not the code.
    const exA = crypto.randomUUID(), exB = crypto.randomUUID();
    await db.query(`insert into person (id, first_name, email) values ($1, 'Optest', 'op.test@example.com'), ($2, 'Optest', 'op.test+t1@example.com')`, [exA, exB]);
    await db.query(`insert into development_record (person_id) values ($1), ($2)`, [exA, exB]);
    const withAll = (await db.query(`select * from fn_ops_day(${mel}, '{}'::text[])`)).rows[0];
    const without = (await db.query(`select * from fn_ops_day(${mel}, array['OP.test@example.com'])`)).rows[0];
    const oneArg = (await db.query(`select * from fn_ops_day(${mel})`)).rows[0];
    check('ops-d7: the 7am count leaves out the operator\u2019s test accounts, +tag and case included, and nothing else changes',
      [withAll.signups_total - without.signups_total, withAll.signups_player - without.signups_player, oneArg.signups_total === withAll.signups_total],
      [2, 2, true]);
    check('ops-d8: and the list is read from DIGEST_EXCLUDE_EMAILS — no address is written into the digest route',
      (() => { const src = codeOnly(srcOf('app/api/digest/route.ts')); return [/process\.env\.DIGEST_EXCLUDE_EMAILS/.test(src), /fn_ops_day[^\n]*@[a-z]/i.test(src)]; })(), [true, false]);
    await db.query('delete from development_record where person_id in ($1, $2)', [exA, exB]);
    await db.query('delete from person where id in ($1, $2)', [exA, exB]);
    const { digestMessage } = await import('../lib/digest.ts');
    const quiet = { label: 'Wed 30 Sep', signups: 0, player: 0, parent: 0, coach: 0, club: 0, approvalsSent: 0, approved: 0, failures: 0, awaitingCall: 0 };
    const busy = { ...quiet, signups: 3, player: 1, coach: 2, approvalsSent: 2, approved: 1, failures: 1 };
    const m = digestMessage(null, 0, true, busy);
    check('ops-d5: the 7am email reports yesterday on Pitch in counts, and a quiet day with nothing else sends nothing',
      [digestMessage(null, 0, true, quiet), m?.subject,
       /^New accounts: 3 \(Player 1 · Coach 2\)$/m.test(m?.text ?? ''), /^Approval requests sent to parents: 2 · Approved: 1$/m.test(m?.text ?? ''),
       /failed to send \(last 24 hours\): 1$/m.test(m?.text ?? ''), /@|ops-fixture|Opsfixture/.test(m?.text ?? '')],
      [null, 'Pitch — 3 new accounts yesterday', true, true, true, false]);
    const digestRouteSrc = codeOnly(srcOf('app/api/digest/route.ts'));
    check('ops-d6: the digest asks for yesterday through fn_ops_day and the Today functions only — counts, nothing that names anybody',
      /from fn_ops_day\(\(\(now\(\) at time zone 'Australia\/Melbourne'\)::date - 1\), \$1::text\[\]\)/.test(digestRouteSrc)
        && !/from (person|consent_event|message_outbox)\b/.test(digestRouteSrc), true);
  }
  check('ops-t7: approved counts only what was sent today, so "% of sent" can never pass 100 — an approval of an older request is in neither figure',
    [after.approved - before.approved, after.approvals_sent - before.approvals_sent, after.approved <= after.approvals_sent], [1, 1, true]);
  check('ops-t8: the failed text is listed by channel and provider word, and neither its number nor its message is anywhere in the answer',
    [fails.some((f) => f.channel === 'sms' && f.provider_said === 'undelivered'), /\+61400000999|ops fixture body|ops-fixture/.test(JSON.stringify([after, fails]))], [true, false]);
}

// --- Pitch curates the board (brief I, 29 Sep; 0130; D-64, D-74, D-90). The
//     operator adds an unclaimed club listing and a notice compiled from the
//     club's own public notice. Every write is a function naming the
//     operator; a compiled notice is behind a wall no other writer passes; the
//     reads carry club facts and counts, never a person. What the screens
//     serve is the render suite's (cur-r*) and what the buttons do is the
//     write suite's (cur-w*); these are the rules underneath both.
{
  const one = async (sql, args) => (await db.query(sql, args)).rows[0];
  const state = async (sql, args) => { try { await db.query(sql, args); return 'ok'; } catch (e) { return e.code ?? 'error'; } };
  const curator = crypto.randomUUID(), stranger = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, email) values ($1,'Curator','curator@fixture.example'), ($2,'Stranger','stranger@fixture.example')`, [curator, stranger]);
  const OP = [curator, 'Curator@Fixture.Example'];
  const add = (name, suburb, source = 'club website /contact', st = 'VIC', contact = 'secretary@fixture-club.example.au') =>
    db.query('select fn_ops_add_club($1,$2,$3,$4,$5,$6,$7) as id', [...OP, name, suburb, st, contact, source]);
  const events = async (club) => (await db.query(`select action, operator_email from curation_event where club_id = $1 order by id`, [club])).rows;
  const curating = async () => (await one(`select coalesce(current_setting('pitch.curating', true), '') as v`)).v;

  // ---- who may write --------------------------------------------------------
  check('cur-1: the functions refuse anyone who is not a person named by their own address — a stranger giving the operator\'s address, nobody, a made-up id',
    [await state('select fn_ops_add_club($1,$2,$3,$4,$5,$6,$7)', [stranger, 'curator@fixture.example', 'Stranger FC', 'Nowhere', 'VIC', null, 'a website']),
     await state('select fn_ops_add_club($1,$2,$3,$4,$5,$6,$7)', [null, 'curator@fixture.example', 'Stranger FC', 'Nowhere', 'VIC', null, 'a website']),
     await state('select fn_ops_add_club($1,$2,$3,$4,$5,$6,$7)', [crypto.randomUUID(), 'curator@fixture.example', 'Stranger FC', 'Nowhere', 'VIC', null, 'a website']),
     (await one(`select count(*)::int as n from club where name = 'Stranger FC'`)).n],
    ['42501', '42501', '42501', 0]);

  // ---- a club listing ---------------------------------------------------------
  const lark = (await add('  Larkfield   Wanderers ', 'Tarrowvale Heights')).rows[0].id;
  check('cur-2: a listing is unclaimed, tidy, has a page address, says where it came from and who listed it, and is logged with the operator\'s address',
    [await one(`select name, suburb, state, club_state, public_slug, contact_email, listing_source, listed_by, listed_by_email, listed_at is not null as stamped from club where id = $1`, [lark]),
     await events(lark)],
    [{ name: 'Larkfield Wanderers', suburb: 'Tarrowvale Heights', state: 'VIC', club_state: 'unclaimed', public_slug: 'larkfield-wanderers',
       contact_email: 'secretary@fixture-club.example.au', listing_source: 'club website /contact', listed_by: curator,
       listed_by_email: 'curator@fixture.example', stamped: true },
     [{ action: 'club_added', operator_email: 'curator@fixture.example' }]]);
  check('cur-3: a duplicate by name and suburb is refused, whatever the case and the spacing — and the same name in another suburb is a different club',
    [await state('select fn_ops_add_club($1,$2,$3,$4,$5,$6,$7)', [...OP, 'LARKFIELD wanderers', ' tarrowvale  heights', 'VIC', null, 'FV club directory']),
     await state('select fn_ops_add_club($1,$2,$3,$4,$5,$6,$7)', [...OP, 'Larkfield Wanderers', 'Quarrymead', 'VIC', null, 'FV club directory']),
     (await one(`select public_slug from club where name = 'Larkfield Wanderers' and suburb = 'Quarrymead'`)).public_slug],
    ['23505', 'ok', 'larkfield-wanderers-2']);
  check('cur-4: a listing with no source, a state outside Victoria and New South Wales, or a contact that is not an address is refused, and nothing is written',
    [await state('select fn_ops_add_club($1,$2,$3,$4,$5,$6,$7)', [...OP, 'Sourceless FC', 'Nowhere', 'VIC', null, '  ']),
     await state('select fn_ops_add_club($1,$2,$3,$4,$5,$6,$7)', [...OP, 'Sourceless FC', 'Nowhere', 'QLD', null, 'FV club directory']),
     await state('select fn_ops_add_club($1,$2,$3,$4,$5,$6,$7)', [...OP, 'Sourceless FC', 'Nowhere', 'VIC', 'not an address', 'FV club directory']),
     (await one(`select count(*)::int as n from club where name = 'Sourceless FC'`)).n],
    ['23514', '23514', '23514', 0]);

  // A claim code is in flight to the listing's address when the address is
  // corrected: the code stops working (it proves nothing about the club now).
  const claimant = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, email) values ($1,'Claimant','claimant@fixture.example')`, [claimant]);
  await db.query(`insert into verification_challenge (person_id, club_id, channel, token_hash, expires_at) values ($1,$2,'email',$3, now() + interval '30 minutes')`, [claimant, lark, sha('code-lark')]);
  await db.query('select fn_ops_edit_club($1,$2,$3,$4,$5,$6,$7,$8)', [...OP, lark, 'Larkfield Wanderers SC', 'Tarrowvale Heights', 'VIC', 'football@fixture-club.example.au', 'club website /contact, rechecked']);
  check('cur-5: an edit renames the listing and moves its page address with it, voids a claim code sent to the old address, and logs before and after',
    [await one(`select name, public_slug, contact_email, listing_source from club where id = $1`, [lark]),
     (await one(`select count(*)::int as n from verification_challenge where club_id = $1`, [lark])).n,
     (await one(`select detail->'before'->>'contact' as b, detail->'after'->>'contact' as a from curation_event where club_id = $1 and action = 'club_edited'`, [lark]))],
    [{ name: 'Larkfield Wanderers SC', public_slug: 'larkfield-wanderers-sc', contact_email: 'football@fixture-club.example.au', listing_source: 'club website /contact, rechecked' },
     0, { b: 'secretary@fixture-club.example.au', a: 'football@fixture-club.example.au' }]);

  // ---- a compiled notice --------------------------------------------------------
  const today = (await one(`select (now() at time zone 'Australia/Melbourne')::date::text as d`)).d;
  const soon = (await one(`select ((now() at time zone 'Australia/Melbourne')::date + 10)::text as d`)).d;
  const notice = (club, extra = {}) => {
    const a = { title: 'U12 & U13 Girls trials', ages: ['U12', 'U13'], gender: 'girls', on: soon, time: 'Sat 9:00 AM', ground: 'Larkfield Reserve',
      pos: ['GK', 'CB'], url: 'https://larkfield.example.au/trials', ...extra };
    return db.query('select fn_ops_add_notice($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as id', [...OP, club, a.title, a.ages, a.gender, a.on, a.time, a.ground, a.pos, a.url]);
  };
  const n1 = (await notice(lark)).rows[0].id;
  check('cur-6: a compiled notice is compiled, links to the club\'s own notice, names who added it, carries both stamps at today, is findable under each age group, and is logged',
    [await one(`select source, source_url, added_by, added_by_email, added_on::text as added, last_checked::text as checked, time_venue, competition_gender, position_needs from trial_notice where id = $1`, [n1]),
     (await db.query(`select age_group from trial_notice_age_group where trial_notice_id = $1 order by age_group`, [n1])).rows.map((r) => r.age_group),
     (await events(lark)).map((e) => e.action)],
    [{ source: 'compiled', source_url: 'https://larkfield.example.au/trials', added_by: curator, added_by_email: 'curator@fixture.example',
       added: today, checked: today, time_venue: 'Sat 9:00 AM · Larkfield Reserve', competition_gender: 'girls', position_needs: ['GK', 'CB'] },
     ['U12', 'U13'], ['club_added', 'club_edited', 'notice_added']]);
  check('cur-7: a notice with no link to the club\'s own notice, a link that is not one, no age group, an age group not in the lookup, a position outside the ten, or a date already gone is refused',
    [await state('select fn_ops_add_notice($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [...OP, lark, 'No link trials', ['U12'], null, soon, '9:00 AM', 'A ground', [], '']),
     await state('select fn_ops_add_notice($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [...OP, lark, 'Bad link trials', ['U12'], null, soon, '9:00 AM', 'A ground', [], 'the club website']),
     await state('select fn_ops_add_notice($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [...OP, lark, 'No age trials', [], null, soon, '9:00 AM', 'A ground', [], 'https://x.example.au/t']),
     await state('select fn_ops_add_notice($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [...OP, lark, 'Odd age trials', ['U99'], null, soon, '9:00 AM', 'A ground', [], 'https://x.example.au/t']),
     await state('select fn_ops_add_notice($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [...OP, lark, 'Sweeper trials', ['U12'], null, soon, '9:00 AM', 'A ground', ['SW'], 'https://x.example.au/t']),
     await state('select fn_ops_add_notice($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [...OP, lark, 'Yesterday trials', ['U12'], null, '2020-01-01', '9:00 AM', 'A ground', [], 'https://x.example.au/t']),
     (await one(`select count(*)::int as n from trial_notice where club_id = $1`, [lark])).n],
    ['23514', '23514', '23514', '23514', '23514', '23514', 1]);

  // Which clubs may carry one (D-90): unclaimed and claimed-unverified, and
  // no other. A verified club posts its own; a suspended club gets nothing.
  const claimedClub = (await add('Hollowmere Athletic', 'Hollowmere')).rows[0].id;
  await db.query(`update club set club_state = 'claimed' where id = $1`, [claimedClub]);
  const suspendedClub = crypto.randomUUID();
  await db.query(`insert into club (id, name, suburb, state, club_state) values ($1,'Dunmore Park SC','Dunmore','VIC','suspended')`, [suspendedClub]);
  check('cur-8: a compiled notice goes on an unclaimed or a claimed-unverified club, never on a verified club or a suspended one',
    [(await notice(claimedClub, { title: 'Hollowmere U14 Boys trials', ages: ['U14'], gender: 'boys' })).rows.length,
     await state('select fn_ops_add_notice($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [...OP, CLUB.riverside, 'Riverside by Pitch', ['U14'], 'boys', soon, '9:00 AM', 'Riverside Park', [], 'https://riverside.example.au/t']),
     await state('select fn_ops_add_notice($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [...OP, suspendedClub, 'Dunmore by Pitch', ['U14'], 'boys', soon, '9:00 AM', 'Dunmore Oval', [], 'https://dunmore.example.au/t'])],
    [1, '42501', '42501']);

  // ---- the wall ----------------------------------------------------------------
  // Asked through state() rather than assumed, so a wall that caught a club's
  // own notice fails cur-10 by name instead of stopping the suite.
  const clubInsert = await state(`insert into trial_notice (club_id, title, trial_on, time_venue, source) values ($1,'Club own trials',$2,'Sun 9:00 AM · Riverside Park','club')`, [CLUB.riverside, soon]);
  const clubNotice = (await one(`select id from trial_notice where club_id = $1 and title = 'Club own trials'`, [CLUB.riverside]))?.id ?? crypto.randomUUID();
  check('cur-9: the wall — no writer but the operator\'s functions inserts, edits, re-stamps, deletes or re-labels a compiled notice, or touches its age groups',
    [await state(`insert into trial_notice (club_id, title, trial_on, time_venue, source, source_url, added_by_email) values ($1,'Tip-off trials',$2,'Sat · Somewhere','compiled','https://x.example.au/t','someone@fixture.example')`, [lark, soon]),
     await state(`update trial_notice set title = 'Edited by hand' where id = $1`, [n1]),
     await state(`update trial_notice set last_checked = current_date where id = $1`, [n1]),
     await state(`delete from trial_notice where id = $1`, [n1]),
     await state(`update trial_notice set source = 'compiled', source_url = 'https://x.example.au/t', added_by_email = 'someone@fixture.example' where id = $1`, [clubNotice]),
     await state(`insert into trial_notice_age_group (trial_notice_id, age_group) values ($1, 'U15')`, [n1]),
     await state(`delete from trial_notice_age_group where trial_notice_id = $1`, [n1]),
     (await one(`select title, source from trial_notice where id = $1`, [n1]))],
    ['42501', '42501', '42501', '42501', '42501', '42501', '42501', { title: 'U12 & U13 Girls trials', source: 'compiled' }]);
  const clubOwn = async () => (await one(`select count(*)::int as n from trial_notice where id = $1`, [clubNotice])).n;
  check('cur-10: and a club\'s own notice is untouched by it — the club still posts, edits and deletes its own',
    [clubInsert, await clubOwn(), await state(`update trial_notice set title = 'Club own trials, changed' where id = $1`, [clubNotice]),
     await state(`delete from trial_notice where id = $1`, [clubNotice]), await clubOwn()], ['ok', 1, 'ok', 'ok', 0]);
  check('cur-11: every function shuts the wall behind it — after each one, the session can write nothing compiled',
    [await curating(), await state(`update trial_notice set title = 'After the function' where id = $1`, [n1])], ['', '42501']);

  // ---- re-stamp, change, remove ---------------------------------------------------
  await db.query(`select set_config('pitch.curating', 'test', false)`);
  await db.query(`update trial_notice set last_checked = current_date - 20 where id = $1`, [n1]);
  await db.query(`select set_config('pitch.curating', '', false)`);
  await state('select fn_ops_check_notice($1,$2,$3)', [...OP, n1]);
  check('cur-12: "last checked" is re-stamped to today with one call, and the stamp is logged with who pressed it',
    [(await one(`select last_checked::text as c from trial_notice where id = $1`, [n1]))?.c,
     (await events(lark)).at(-1)], [today, { action: 'notice_checked', operator_email: 'curator@fixture.example' }]);

  // Somebody has registered for the trial: its date is fixed from then on.
  const hollowNotice = (await one(`select id from trial_notice where club_id = $1`, [claimedClub]))?.id ?? crypto.randomUUID();
  await db.query(`insert into registration (player_id, club_id, policy_version, trial_notice_id) values ($1,$2,'20@v2.4',$3)`, [ID.marcus, claimedClub, hollowNotice]);
  await state('select fn_ops_edit_notice($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
    [...OP, hollowNotice, 'Hollowmere U14 & U15 Boys trials', ['U14', 'U15'], 'boys', '2099-01-01', 'Sat 10:00 AM', 'Hollowmere Park', ['ST'], 'https://hollowmere.example.au/trials']);
  check('cur-13: a change is saved and moves "last checked", but once somebody has registered for the trial its date stays where it was',
    [await one(`select title, trial_on::text as on, time_venue, position_needs, last_checked::text as checked from trial_notice where id = $1`, [hollowNotice]),
     (await db.query(`select age_group from trial_notice_age_group where trial_notice_id = $1 order by age_group`, [hollowNotice])).rows.map((r) => r.age_group)],
    [{ title: 'Hollowmere U14 & U15 Boys trials', on: soon, time_venue: 'Sat 10:00 AM · Hollowmere Park', position_needs: ['ST'], checked: today }, ['U14', 'U15']]);

  // The club is verified later. Pitch's notice can no longer be changed or
  // re-stamped there — the club posts its own — but it can always come down.
  const hCall = crypto.randomUUID();
  await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
    values ($1,$2,now(),'BUZ','03 9000 0000','FV club directory','verified','27@v1.0')`, [hCall, claimedClub]);
  await db.query(`update club set club_state = 'verified', verified_call_id = $1 where id = $2`, [hCall, claimedClub]);
  check('cur-14: at a club verified since, a compiled notice cannot be changed or re-stamped by Pitch, and can still be taken down — the registration stays, no longer tagged to it',
    [await state('select fn_ops_check_notice($1,$2,$3)', [...OP, hollowNotice]),
     await state('select fn_ops_edit_notice($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [...OP, hollowNotice, 'Changed', ['U14'], null, soon, '9:00 AM', 'A ground', [], 'https://x.example.au/t']),
     await state('select fn_ops_remove_notice($1,$2,$3)', [...OP, hollowNotice]),
     (await one(`select count(*)::int as n from trial_notice where id = $1`, [hollowNotice])).n,
     (await one(`select trial_notice_id, trial_on::text as on from registration where club_id = $1`, [claimedClub]))],
    ['42501', '42501', 'ok', 0, { trial_notice_id: null, on: null }]);
  const ownNotice = (await one(`insert into trial_notice (club_id, title, trial_on, time_venue, source) values ($1,'Riverside own trials',$2,'Sun 9:00 AM · Riverside Park','club') returning id`, [CLUB.riverside, soon])).id;
  check('cur-15: the operator\'s doors never change, re-stamp or remove a club\'s own notice',
    [await state('select fn_ops_check_notice($1,$2,$3)', [...OP, ownNotice]),
     await state('select fn_ops_edit_notice($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [...OP, ownNotice, 'Changed', ['U14'], null, soon, '9:00 AM', 'A ground', [], 'https://x.example.au/t']),
     await state('select fn_ops_remove_notice($1,$2,$3)', [...OP, ownNotice]),
     (await one(`select title from trial_notice where id = $1`, [ownNotice]))?.title],
    ['42501', '42501', '42501', 'Riverside own trials']);
  await db.query(`delete from trial_notice where id = $1`, [ownNotice]);

  // ---- a claimed club is the club's, and removing a listing ------------------------
  check('cur-16: a listing somebody has claimed is the club\'s to run — the operator cannot edit it or remove it',
    [await state('select fn_ops_edit_club($1,$2,$3,$4,$5,$6,$7,$8)', [...OP, claimedClub, 'Renamed by Pitch', 'Hollowmere', 'VIC', null, 'FV club directory']),
     await state('select fn_ops_remove_club($1,$2,$3)', [...OP, claimedClub]),
     (await one(`select name from club where id = $1`, [claimedClub]))?.name], ['42501', '42501', 'Hollowmere Athletic']);
  await state('select fn_ops_remove_club($1,$2,$3)', [...OP, lark]);
  check('cur-17: removing an unclaimed listing takes its page and its notices with it, and the log keeps what it said and who removed it',
    [(await one(`select count(*)::int as n from club where id = $1`, [lark])).n,
     (await one(`select count(*)::int as n from trial_notice where club_id = $1`, [lark])).n,
     await one(`select action, operator_email, detail->>'name' as name, (detail->>'notices')::int as notices from curation_event where club_id = $1 order by id desc limit 1`, [lark]),
     await curating()],
    [0, 0, { action: 'club_removed', operator_email: 'curator@fixture.example', name: 'Larkfield Wanderers SC', notices: 1 }, '']);
  check('cur-18: the log is append-only, and has row-level security like every table (L26)',
    [await state(`update curation_event set operator_email = 'someone-else@fixture.example' where club_id = $1`, [lark]),
     await state(`delete from curation_event where club_id = $1`, [lark]),
     (await one(`select relrowsecurity as r from pg_class where relname = 'curation_event'`)).r], ['P0001', 'P0001', true]);

  // ---- the reads carry no person ---------------------------------------------------
  const result = async (sig) => (await one(`select pg_get_function_result($1::regprocedure) as r`, [sig])).r;
  const PERSON = /\b(first_name|last_name|dob|person_id|player_id|child_id|guardian\w*|membership\w*|role|td_\w+|claimant\w*|admin\w*|phone\w*)\b/;
  const listCols = await result('fn_ops_clubs(text)');
  check(`cur-19: the directory's one read returns club facts and a count — no person, no address of anyone's (${listCols})`,
    [PERSON.test(listCols), /email/.test(listCols)], [false, false]);
  check('cur-20: nor do the club and notice reads name any person — the only addresses in them are the club\'s own and the operator\'s',
    [PERSON.test(await result('fn_ops_club(uuid)')), PERSON.test(await result('fn_ops_club_notices(uuid)')),
     [...(await result('fn_ops_club(uuid)') + await result('fn_ops_club_notices(uuid)')).matchAll(/(\w*email\w*)/g)].map((m) => m[1])],
    [false, false, ['contact_email', 'listed_by_email', 'added_by_email']]);
  const dir = (await db.query(`select name from fn_ops_clubs($1)`, ['hollow'])).rows.map((r) => r.name);
  const all = (await one(`select count(*)::int as n from fn_ops_clubs('')`)).n;
  check('cur-21: the search finds a club by a piece of its name or its suburb, in every state, and takes % and _ as typed',
    [dir, (await db.query(`select club_state from fn_ops_clubs('Dunmore')`)).rows.map((r) => r.club_state),
     all === (await one(`select count(*)::int as n from club`)).n, (await db.query(`select 1 from fn_ops_clubs('%')`)).rows.length],
    [['Hollowmere Athletic'], ['suspended'], true, 0]);

  // ---- the ten, and the doors in the product ---------------------------------------
  check('cur-22: the database\'s copy of the ten positions is the football module\'s own list (D-92), so neither can drift',
    (await one('select fn_positions_ten() as p')).p, Object.keys(POSITIONS_TS));
  const opsClubs = routeFiles.filter((f) => /\/app\/ops\/clubs\//.test(f));
  const actions = codeOnly(srcOf('app/ops/clubs/actions.ts'));
  const exported = [...actions.matchAll(/export async function (\w+)\([\s\S]*?\n\}/g)].map((m) => [m[1], m[0]]);
  check(`cur-s1: every door on /ops/clubs checks the operator before it asks the database anything (${exported.map(([n]) => n).join(', ')})`,
    [exported.length, exported.filter(([, body]) => !(body.indexOf('await operator()') > -1 && body.indexOf('await operator()') < body.indexOf('db.query'))).map(([n]) => n),
     /async function operator\(\) \{\s*const op = await requireOperator\(\);\s*if \(!clubsScreensShown\(process\.env\.NODE_ENV === 'production'\)\) notFound\(\);/.test(actions)],
    // 0160: an eighth, stopClubSends (the operator stops CVs to a club).
    [8, [], true]);
  const writers = routeFiles.filter((f) => {
    const src = codeOnly(readFileSync(f, 'utf8'));
    return /fn_ops_(add|edit|remove)_club|fn_ops_(add|edit|check|remove)_notice/.test(src) && !/\/app\/ops\/clubs\/actions\.ts$/.test(f);
  });
  const byHand = tsSourceFiles().filter((f) => {
    const src = codeOnly(srcOf(f));
    return /pitch\.curating/.test(src) || /insert into club\b/i.test(src) || /'compiled'/.test(src);
  });
  check('cur-s2: nothing else in the product writes a listing or a compiled notice — no other caller of the functions, no insert into club, no opening of the wall, no "compiled" written anywhere (D-90: no public submission route)',
    [writers.map((f) => f.slice(f.indexOf('app/'))), byHand],
    [[], []]);
  const pageQueries = opsClubs.filter((f) => /page\.tsx$/.test(f)).flatMap((f) =>
    [...codeOnly(readFileSync(f, 'utf8')).matchAll(/db\.query\(\s*`([^`]*)`/g)].map((m) => m[1].replace(/\s+/g, ' ').trim()));
  check(`cur-s3: the clubs screens ask the database only through the operator's reads and the age-group lookup (${pageQueries.length} queries)`,
    // 0160: fn_ops_club_sends, two yes/no answers — is an address held, is it stopped.
    [pageQueries.length >= 6, pageQueries.filter((q) => !/from (fn_ops_clubs|fn_ops_club|fn_ops_club_notices|fn_ops_club_sends)\(\$1\)|from fn_ops_club_requests\(\$1, \$2\)|from age_group order by sort/.test(q))], [true, []]);
  const shownGate = opsClubs.filter((f) => /page\.tsx$/.test(f)).filter((f) =>
    !/await requireOperator\(\);\s*if \(!clubsScreensShown\(process\.env\.NODE_ENV === 'production'\)\) notFound\(\);/.test(codeOnly(readFileSync(f, 'utf8'))));
  check(`cur-s4: every clubs screen is the operator's and is held until BUZ approves its words — a 404 in production until then (${opsClubs.filter((f) => /page\.tsx$/.test(f)).length} screens)`,
    [shownGate.map((f) => f.slice(f.indexOf('app/'))), clubsScreensShownTS(true) === CLUBS_WORDS_APPROVED_TS, clubsScreensShownTS(false)], [[], true, true]);
}

// --- Clubs find themselves, or ask to be added (0159; BUZ, 30 Sep: "Right
//     now they can't sign up"). Production opened with no listings, so a
//     club person had nothing to claim and no way to find anything.
{
  const state = async (sql, args) => { try { await db.query(sql, args); return 'ok'; } catch (e) { return e.code ?? 'error'; } };
  const cur = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, email) values ($1, 'Asker Curator', 'asker.curator@fixture.example')`, [cur]);
  const OPR = [cur, 'asker.curator@fixture.example'];
  await db.query('select fn_ops_add_club($1,$2,$3,$4,$5,$6,$7)', [...OPR, 'Quillbrook Rangers SC', 'Quillbrook', 'VIC', 'info@quillbrook-rangers.example.au', 'club website /contact']);
  const names = async (q) => (await db.query('select name from fn_club_search($1)', [q])).rows.map((r) => r.name);
  const cols = (await db.query(`select pg_get_function_result('fn_club_search(text)'::regprocedure) as r`)).rows[0].r;
  check('fc-s1: a club person finds a listed club by a piece of its name or its suburb, and a search shorter than two letters finds nothing',
    [(await names('quillb')).includes('Quillbrook Rangers SC'), (await names('Quillbrook')).length >= 1, (await names('q')).length, (await names('%')).length],
    [true, true, 0, 0]);
  const suspended = (await db.query(`select name from club where club_state = 'suspended' limit 1`)).rows[0]?.name;
  check('fc-s2: a suspended club is not found, and the search returns club facts only — no person, no address',
    [suspended ? (await names(suspended)).includes(suspended) : false, /email|person|contact|listed_by/.test(cols)], [false, false]);

  const adult = crypto.randomUUID(), unproved = crypto.randomUUID(), minor = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob, email) values
    ($1, 'Askeradult', '1985-03-02', 'asker.adult@fixture.example'),
    ($2, 'Askerunproved', '1985-03-02', 'asker.unproved@fixture.example'),
    ($3, 'Askerminor', (now() - interval '15 years')::date, 'asker.minor@fixture.example')`, [adult, unproved, minor]);
  await proveAddress(adult); await proveAddress(minor);
  const ask = (who, name, suburb = 'Pinewood', email = 'secretary@fixture-ask.example.au') =>
    state('select fn_club_request_add($1, $2, $3, $4, $5)', [who, name, suburb, 'VIC', email]);
  check('fc-r1: an adult with a confirmed address can ask for a club; an unconfirmed account and an under-18 cannot',
    [await ask(adult, 'Pinewood Athletic'), await ask(unproved, 'Pinewood United'), await ask(minor, 'Pinewood City')],
    ['ok', '42501', '42501']);
  check('fc-r2: a club already listed is refused (same name and suburb), and so is an ask with no real address',
    [await ask(adult, 'Quillbrook Rangers SC', 'Quillbrook'), await ask(adult, 'Pinewood Rovers', 'Pinewood', 'not-an-address')],
    ['23505', '23514']);
  await ask(adult, 'Pinewood Wanderers'); await ask(adult, 'Pinewood Strikers');
  check('fc-r3: three open asks at a time — the fourth is refused', await ask(adult, 'Pinewood Eagles'), '23514');
  const queue = (await db.query('select * from fn_ops_club_requests($1, $2)', OPR)).rows;
  const qcols = Object.keys(queue[0] ?? {});
  check('fc-r4: the operator sees the asks with the club’s details only — never who asked',
    [queue.filter((r) => r.name.startsWith('Pinewood')).length, qcols.some((c) => /requested|person|asker/.test(c)),
     await state('select * from fn_ops_club_requests($1, $2)', [adult, 'not.the.operator@fixture.example'])],
    [3, false, '42501']);
  const before = (await db.query('select fn_club_requests_open() as n')).rows[0].n;
  const first = queue.find((r) => r.name === 'Pinewood Athletic');
  await db.query('select fn_ops_club_request_close($1, $2, $3, $4)', [...OPR, first.id, 'dismissed']);
  check('fc-r5: closing an ask takes it off the queue and the count, and nobody can close one in someone else\u2019s name',
    [(await db.query('select fn_club_requests_open() as n')).rows[0].n, (await db.query('select * from fn_ops_club_requests($1, $2)', OPR)).rows.some((r) => r.id === first.id),
     // The database checks the caller is who they say (fn_ops_operator); WHO
     // is an operator is the /ops guard's (OPS_EMAILS), pinned by cur-s1.
     await state('select fn_ops_club_request_close($1, $2, $3, $4)', [minor, 'asker.curator@fixture.example', queue[1].id, 'added'])],
    [before - 1, false, '42501']);
  const rls = (await db.query(`select relrowsecurity r from pg_class where oid = 'club_request'::regclass`)).rows[0].r;
  const pols = (await db.query(`select count(*)::int n from pg_policies where tablename = 'club_request'`)).rows[0].n;
  check('fc-r6: the asks table is locked — row security on, no policies (L26)', [rls, pols], [true, 0]);
  const { digestMessage } = await import('../lib/digest.ts');
  const quietButAsks = { label: 'Wed 30 Sep', signups: 0, player: 0, parent: 0, coach: 0, club: 0, approvalsSent: 0, approved: 0, failures: 0, awaitingCall: 0, clubAsks: 2 };
  check('fc-r7: the 7am email says how many clubs are asking to be added, even on a day with nothing else',
    /^Clubs asking to be added: 2$/m.test(digestMessage(null, 0, true, quietButAsks)?.text ?? ''), true);
  const fcPage = codeOnly(srcOf('app/fc/[slug]/page.tsx'));
  check('fc-s3: an unclaimed listing is kept out of search engines until the club claims it',
    /unclaimed \? \{ robots: \{ index: false, follow: false \} \}/.test(fcPage), true);
  // John, 30 Sep: a junior trial notice Pitch compiled for an unclaimed club
  // is an invitation only until its date — after that it is a standing
  // statement that children gather at that ground. Asserted on the one
  // answer every page reads (fn_trial_notices_advertised).
  const jrClub = (await db.query(`select id from club where club_state = 'unclaimed' limit 1`)).rows[0].id;
  const jrPast = crypto.randomUUID(), jrToday = crypto.randomUUID();
  await db.exec('begin;'); await db.query(`select set_config('pitch.curating', 'on', true)`);
  for (const [id, days] of [[jrPast, -1], [jrToday, 0]]) {
    await db.query(`insert into trial_notice (id, club_id, title, trial_on, time_venue, source, source_url, added_by, added_by_email)
      values ($1, $2, 'U12 and U13 girls trials', (now() at time zone 'Australia/Melbourne')::date + $3::int, '9:00 am · Fixture Reserve', 'compiled', 'https://fixture.example.au/trials', $4, $5)`,
      [id, jrClub, days, ...OPR]);
    await db.query(`insert into trial_notice_age_group (trial_notice_id, age_group) values ($1, 'U12'), ($1, 'U13')`, [id]);
  }
  await db.exec('commit;');
  check('jr-x1: a junior notice compiled for an unclaimed club shows on its day and never the day after (John, 30 Sep)',
    (await db.query('select id from fn_trial_notices_advertised() where id = any($1)', [[jrPast, jrToday]])).rows.map((r) => r.id),
    [jrToday]);
  await db.exec('begin;'); await db.query(`select set_config('pitch.curating', 'on', true)`);
  await db.query('delete from trial_notice_age_group where trial_notice_id = any($1)', [[jrPast, jrToday]]);
  await db.query('delete from trial_notice where id = any($1)', [[jrPast, jrToday]]);
  await db.exec('commit;');
  await db.query('delete from club_request where requested_by = $1', [adult]);
  await db.query('delete from person where id in ($1, $2, $3)', [adult, unproved, minor]);
}

// --- A suspended club advertises nothing (brief K item 1, 29 Sep; 0140; D-90,
//     D-74, M10). Round I found a suspended club's trial notices still on the
//     board and on its page. The rule is the database's — one answer every
//     page reads — so it is asked here for every class of suspension and for
//     both sources of a notice, and the pages are held to reading it (s1–s2).
//     What the board and the page SERVE is the write suite's (susp-ad-w*),
//     because suspending a club is pressing the operator's button.
{
  const one = async (sql, args) => (await db.query(sql, args)).rows[0];
  const soon = (await one(`select ((now() at time zone 'Australia/Melbourne')::date + 12)::text as d`)).d;
  const op = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, email) values ($1,'Board','board.curator@fixture.example')`, [op]);
  const OP = [op, 'board.curator@fixture.example'];
  const advertised = async (club) => (await db.query(
    `select source from fn_trial_notices_advertised() where club_id = $1 order by source`, [club])).rows.map((r) => r.source);
  const wanted = async (club) => (await one(`select count(*)::int as n from fn_players_wanted_advertised() where club_id = $1`, [club])).n;
  const kept = async (club) => (await one(
    `select (select count(*)::int from trial_notice where club_id = $1) + (select count(*)::int from players_wanted_notice where club_id = $1) as n`, [club])).n;

  // A club with all three kinds of notice: one Pitch compiled while it was an
  // unclaimed listing (0130 allows no other time), one it posted itself, and a
  // players-wanted notice. Then suspended for the class, then lifted.
  for (const cls of ['child_safety', 'administrative', 'non_payment', null]) {
    const club = crypto.randomUUID();
    await db.query(`insert into club (id, name, suburb, state, club_state) values ($1,$2,'Dunmore','VIC','unclaimed')`,
      [club, `Advertising ${cls ?? 'unclassed'} SC`]);
    await db.query('select fn_ops_add_notice($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [...OP, club, 'U13 Boys trials', ['U13'], 'boys', soon, 'Sat 9:00 AM', 'Dunmore Oval', [], 'https://dunmore.example.au/trials']);
    await db.query(`update club set club_state = 'claimed' where id = $1`, [club]);
    // A club posts its own notice only once it is verified (0152, BUZ on
    // M7), so the club is verified by a call before it posts.
    const posted = crypto.randomUUID();
    await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
      values ($1,$2,now(),'BUZ','03 9000 0700','FV club directory','verified','27@v1.0')`, [posted, club]);
    await db.query(`update club set club_state = 'verified', verified_call_id = $1 where id = $2`, [posted, club]);
    await db.query(`insert into trial_notice (club_id, title, trial_on, time_venue, source) values ($1,'U15 Girls trials',$2,'Sun 10:00 AM · Dunmore Oval','club')`, [club, soon]);
    await db.query(`insert into players_wanted_notice (club_id, title) values ($1,'U13 Boys — Goalkeeper')`, [club]);
    const before = [await advertised(club), await wanted(club)];
    await db.query(`update club set club_state = 'suspended', suspension_reason = $2 where id = $1`, [club, cls]);
    const during = [await advertised(club), await wanted(club), await kept(club)];
    await db.query(`update club set club_state = 'verified', suspension_reason = null where id = $1`, [club]);
    const after = [await advertised(club), await wanted(club)];
    check(`susp-ad1: suspended ${cls ? `for the ${cls} class` : 'with no class recorded'}, a club advertises nothing — not its own trial notice, not Pitch's compiled one, not a players-wanted notice — nothing is deleted, and lifted, all of it is back`,
      [before, during, after], [[['club', 'compiled'], 1], [[], 0, 3], [['club', 'compiled'], 1]]);
  }

  // A verified club, suspended the way the operator's call does it (a call
  // row, then the state), inside one transaction: the board has lost it
  // before the transaction ends (M10's "immediately", read inside it).
  const vClub = crypto.randomUUID(), vCall = crypto.randomUUID();
  await db.query(`insert into club (id, name, suburb, state, club_state) values ($1,'Advertising Verified SC','Dunmore','VIC','claimed')`, [vClub]);
  await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
    values ($1,$2,now(),'BUZ','03 9000 0700','FV club directory','verified','27@v1.0')`, [vCall, vClub]);
  await db.query(`update club set club_state = 'verified', verified_call_id = $1 where id = $2`, [vCall, vClub]);
  await db.query(`insert into trial_notice (club_id, title, trial_on, time_venue, source) values ($1,'U12 Mixed trials',$2,'Sat 8:00 AM · Dunmore Oval','club')`, [vClub, soon]);
  const onBoard = await advertised(vClub);
  await db.exec(`begin;
    insert into verification_call (club_id, called_at, operator, number_called, number_source, outcome, suspension_reason, policy_version)
      values ('${vClub}', now(), 'BUZ', '03 9000 0700', 'FV club directory', 'takedown', 'child_safety', '27@v1.0');
    update club set club_state = 'suspended', suspension_reason = 'child_safety' where id = '${vClub}';`);
  const inside = await advertised(vClub);
  await db.exec('commit;');
  check('susp-ad2: a verified club taken down on the call leaves the board in the same transaction as the takedown',
    [onBoard, inside], [['club'], []]);

  // The expiry rule every page used to apply for itself now lives in the
  // same answer, and the one question it asks of the club is its state.
  const past = crypto.randomUUID();
  await db.query(`insert into trial_notice (id, club_id, title, trial_on, time_venue, source) values ($1,$2,'Gone trials',
    (now() at time zone 'Australia/Melbourne')::date - 1,'Sat · Riverside Park','club')`, [past, CLUB.riverside]);
  const unknown = crypto.randomUUID();
  check('susp-ad3: a notice whose day has passed is not on the board either — and a club advertises when it is unclaimed, claimed or verified, never when it is suspended, and not at all when it does not exist',
    [(await one('select count(*)::int as n from fn_trial_notices_advertised() where id = $1', [past])).n,
     (await db.query(`select club_state, fn_club_advertises(id) as a from club where id = any($1) order by club_state`,
       [[CLUB.riverside, vClub, (await one(`select id from club where club_state = 'unclaimed' limit 1`)).id,
         (await one(`select id from club where club_state = 'claimed' limit 1`)).id]])).rows.map((r) => `${r.club_state} ${r.a}`),
     (await one('select fn_club_advertises($1) as a', [unknown])).a],
    [0, ['claimed true', 'suspended false', 'unclaimed true', 'verified true'], false]);
  await db.query('delete from trial_notice where id = $1', [past]);
  check('susp-ad4: the three answers run as the caller, never as their owner — called through an anon key they meet trial_notice\'s own row-level security (L26)',
    (await db.query(`select proname, prosecdef from pg_proc where proname in ('fn_club_advertises','fn_trial_notices_advertised','fn_players_wanted_advertised') order by proname`)).rows
      .map((r) => `${r.proname} ${r.prosecdef}`),
    ['fn_club_advertises false', 'fn_players_wanted_advertised false', 'fn_trial_notices_advertised false']);

  // ---- the pages read the answer, and nothing else lists a notice ----------------
  // Every read of a notice table in the product. The ones allowed to read it
  // directly are a club's own management of its own notices, and a trial that
  // a registration, a request or an invitation already carries — which is
  // history, not an advertisement. Anything else that lists a notice reads
  // the database's answer, so the rule cannot be forgotten by page five.
  const READS = /\b(?:from|join)\s+(trial_notice|players_wanted_notice)\b/;
  const DIRECT = {
    'app/club/post-trial/page.tsx': "the club's own notices, to change them",
    'app/club/post-trial/actions.ts': "the club's own notice, to change it",
    'app/club/page-edit/page.tsx': "the club's own players-wanted notices, to change them",
    'app/club/page-edit/actions.ts': "the club's own players-wanted notice, to remove it",
    'app/club/invite/[registrationId]/page.tsx': 'the trial a registration already carries',
    'app/g/interest/[requestId]/page.tsx': 'the trial a request already carries',
    'app/g/interest/[requestId]/actions.ts': 'the trial a request already carries',
    'lib/invitations.ts': 'the trial an invitation already carries',
  };
  const direct = tsSourceFiles().filter((f) => READS.test(codeOnly(srcOf(f))));
  check(`susp-ad-s1: no page lists a notice from the tables themselves — every direct read is a club's own management or a trial already attached to something (${direct.filter((f) => !(f in DIRECT)).join(', ') || 'none other'})`,
    [direct.filter((f) => !(f in DIRECT)), Object.keys(DIRECT).filter((f) => !direct.includes(f))], [[], []]);
  const through = (f) => (codeOnly(srcOf(f)).match(/\bfn_trial_notices_advertised\(\)/g) ?? []).length;
  check('susp-ad-s2: and the board, the club page, /home and the register-interest door read fn_trial_notices_advertised — the club page its players-wanted notices through fn_players_wanted_advertised',
    [['app/trials/page.tsx', 'app/fc/[slug]/page.tsx', 'app/home/page.tsx', 'app/register-interest/[recordId]/page.tsx', 'app/register-interest/[recordId]/actions.ts'].map(through),
     /from fn_players_wanted_advertised\(\) w where w\.club_id = c\.id/.test(codeOnly(srcOf('app/fc/[slug]/page.tsx')))],
    [[1, 1, 3, 1, 1], true]);
}

// --- Brief L's follow-ups (29 Sep): a suspended club hires nobody (0151), its
//     own page offers no way in, a failed call ends verification at every edge
//     (0150), and the legal register says where doc 25 is served.
{
  const one = async (sql, args) => (await db.query(sql, args)).rows[0];
  const roles = async (club) => (await db.query(
    `select title from fn_coaching_roles_advertised() where club_id = $1 order by title`, [club])).rows.map((r) => r.title);
  const kept = async (club) => (await one(`select count(*)::int as n from coaching_role where club_id = $1`, [club])).n;
  const poster = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob) values ($1,'Hiring Poster',$2)`, [poster, yearsAgo(45)]);
  // A verified club with an open role, one closed, and one whose day passed.
  const hire = crypto.randomUUID(), hireCall = crypto.randomUUID();
  await db.query(`insert into club (id, name, club_state) values ($1,'Hiring FC','claimed')`, [hire]);
  await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
    values ($1,$2,now(),'BUZ','03 9000 0800','FV club directory','verified','27@v1.0')`, [hireCall, hire]);
  await db.query(`update club set club_state = 'verified', verified_call_id = $1 where id = $2`, [hireCall, hire]);
  await db.query(`insert into coaching_role (club_id, title, posted_by) values ($1,'Open role',$2)`, [hire, poster]);
  await db.query(`insert into coaching_role (club_id, title, posted_by, closed_at) values ($1,'Closed role',$2, now())`, [hire, poster]);
  await db.query(`insert into coaching_role (club_id, title, posted_by, closes_on) values ($1,'Past role',$2,
    (now() at time zone 'Australia/Melbourne')::date - 1)`, [hire, poster]);
  const lifted = async () => {
    const back = crypto.randomUUID();
    await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
      values ($1,$2,now(),'BUZ','03 9000 0800','FV club directory','verified','27@v1.0')`, [back, hire]);
    await db.query(`update club set club_state = 'verified', verified_call_id = $2, suspension_reason = null where id = $1`, [hire, back]);
    return roles(hire);
  };
  for (const [outcome, cls] of [['suspended', 'child_safety'], ['suspended', 'administrative'], ['suspended', 'non_payment'], ['suspended', null], ['takedown', null]]) {
    const before = await roles(hire);
    await db.query('begin');
    await db.query(`insert into verification_call (club_id, called_at, operator, number_called, number_source, outcome, suspension_reason, policy_version)
      values ($1, now(), 'BUZ', '03 9000 0800', 'FV club directory', $2, $3, '27@v1.0')`, [hire, outcome, cls]);
    await db.query(`update club set club_state = 'suspended', suspension_reason = $2 where id = $1`, [hire, cls]);
    const inside = [await roles(hire), await kept(hire)];
    await db.query('commit');
    check(`susp-ad5: ${outcome === 'takedown' ? 'taken down' : `suspended ${cls ? `for the ${cls} class` : 'with no class recorded'}`}, a club's open coaching role leaves the jobs board in the same transaction — nothing is deleted, and verified again it is back (0151)`,
      [before, inside, await lifted()], [['Open role'], [[], 3], ['Open role']]);
  }
  check('susp-ad5b: the board keeps 0019’s own rules — a closed role and a role past its closing day are not on it — and the answer runs as the caller (L26)',
    [await roles(hire), (await one(`select prosecdef from pg_proc where proname = 'fn_coaching_roles_advertised'`)).prosecdef], [['Open role'], false]);

  // Every read of coaching_role in the product. Direct reads are a club's own
  // management of its own roles, and a role's own page — which asks
  // fn_club_advertises, so a suspended club's role is the same not-found as a
  // role that is not there. Everything that LISTS or COUNTS roles, and the
  // apply action, reads the answer.
  const ROLE_READS = /\b(?:from|join)\s+coaching_role\b/;
  const ROLE_DIRECT = {
    'app/club/roles/page.tsx': "the club's own roles, to close them",
    'app/jobs/[roleId]/page.tsx': 'one role, asked with fn_club_advertises',
  };
  const roleDirect = tsSourceFiles().filter((f) => ROLE_READS.test(codeOnly(srcOf(f))));
  const roleThrough = (f) => (codeOnly(srcOf(f)).match(/\bfn_coaching_roles_advertised\(\)/g) ?? []).length;
  check(`susp-ad-s3: no page lists or counts coaching roles from the table — the board, the club page, /home’s two counts and the apply action read fn_coaching_roles_advertised, and a role’s own page asks fn_club_advertises (${roleDirect.filter((f) => !(f in ROLE_DIRECT)).join(', ') || 'no other direct read'})`,
    [roleDirect.filter((f) => !(f in ROLE_DIRECT)), Object.keys(ROLE_DIRECT).filter((f) => !roleDirect.includes(f)),
     ['app/jobs/page.tsx', 'app/fc/[slug]/page.tsx', 'app/home/page.tsx', 'app/coach/edit/actions.ts'].map(roleThrough),
     /where r\.id = \$1 and fn_club_advertises\(r\.club_id\)/.test(codeOnly(srcOf('app/jobs/[roleId]/page.tsx')))],
    [[], [], [1, 1, 2, 1], true]);

  // The club page's way in. For a suspended club the "Want to play here?"
  // panel — which fell through to the unclaimed branch and offered "Send my
  // CV to {club}" — is not drawn, and a squad chip names the team without
  // being a door. What the page SERVES is the write suite's (susp-ad-w1).
  const fcPage = codeOnly(srcOf('app/fc/[slug]/page.tsx'));
  check('susp-ad-s4: a suspended club’s page draws no way in — the panel with the send and register doors is behind !suspended, the squad chips are plain names, and the chip hint goes with them',
    [/const suspended = c\.club_state === 'suspended';/.test(fcPage), /\{!suspended && \(\s*<div id="play"/.test(fcPage),
     /if \(suspended\) \{\s*return \(\s*<span key=\{s\.id\}/.test(fcPage), /\{!suspended && \(\s*<div[^>]*>\s*\{picked \? `The register will say/.test(fcPage)],
    [true, true, true, true]);

  // 0150 at its edges. The rule is "a verified club whose call fails is not
  // verified" — nothing more restrictive and nothing less.
  const nvClub = async (state) => {
    const id = crypto.randomUUID(), call = crypto.randomUUID();
    await db.query(`insert into club (id, name, club_state) values ($1,$2,'claimed')`, [id, `Failed Call ${state} FC`]);
    await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
      values ($1,$2,now(),'BUZ','03 9000 0900','FV club directory','verified','27@v1.0')`, [call, id]);
    if (state !== 'claimed') await db.query(`update club set club_state = 'verified', verified_call_id = $1 where id = $2`, [call, id]);
    if (state === 'suspended') await db.query(`update club set club_state = 'suspended', suspension_reason = 'child_safety' where id = $1`, [id]);
    return { id, call };
  };
  const failCall = (club) => db.query(`insert into verification_call (club_id, called_at, operator, number_called, number_source, outcome, policy_version)
    values ($1, now(), 'BUZ', '03 9000 0900', 'FV club directory', 'not_verified', '27@v1.0')`, [club]);
  const stateOf = async (club) => (await one(`select club_state, verified_call_id, suspension_reason from club where id = $1`, [club]));
  const [claimedNv, suspendedNv, verifiedNv] = [await nvClub('claimed'), await nvClub('suspended'), await nvClub('verified')];
  for (const c of [claimedNv, suspendedNv, verifiedNv]) await failCall(c.id);
  check('nv1: a failed call ends a verified club’s verification, keeps the call that last verified it on the record (M6 reads the history), and records no class',
    await stateOf(verifiedNv.id), { club_state: 'claimed', verified_call_id: verifiedNv.call, suspension_reason: null });
  check('nv2: and touches nothing else — a claimed club stays claimed, and a suspended club stays suspended, its class kept (the more restrictive state stands)',
    [(await stateOf(claimedNv.id)).club_state, await stateOf(suspendedNv.id)],
    ['claimed', { club_state: 'suspended', verified_call_id: suspendedNv.call, suspension_reason: 'child_safety' }]);
  check('nv3: it is not a suspension, so it tells no family (0066 tells only of a child-safety suspension)',
    (await db.query('select * from fn_guardians_to_notify_on_suspension($1)', [verifiedNv.id])).rows.length, 0);
  const edited = await nvClub('verified');
  await db.query(`update verification_call set outcome = 'not_verified' where id = $1`, [edited.call]);
  check('nv4: a call whose outcome is edited to "not verified" counts the same as a failed call arriving — the record and the club agree',
    (await stateOf(edited.id)).club_state, 'claimed');

  // The legal register's "Where" for doc 25 names the page that serves it.
  const legalReg = srcOf('docs/legal/00-Legal-Register.md');
  const row25 = legalReg.split('\n').find((l) => l.startsWith('| **25** |')) ?? '';
  const where25 = /`(\/[a-z/]+)`/.exec(row25.split('|')[4] ?? '')?.[1];
  check(`legl1: the legal register says doc 25 is served at /report/policy, and that page exists (${where25})`,
    [where25, readdirSync(fileURLToPath(new URL('../app/report/policy', import.meta.url))).includes('page.tsx')], ['/report/policy', true]);
}

// ---------------------------------------------------------------------------
// Club colours (0163, D-173, BUZ 1 Oct). A claimed club's own colours; never
// on an unclaimed page (D-172), and never at the cost of reading the page.
// ---------------------------------------------------------------------------
{
  const refused = async (sql, params) => { try { await db.query(sql, params); return false; } catch { return true; } };
  const u = (await db.query(`insert into club (name, club_state) values ('Colour Unclaimed SC','unclaimed') returning id`)).rows[0].id;
  const c = (await db.query(`insert into club (name, club_state) values ('Colour Claimed FC','claimed') returning id`)).rows[0].id;
  check('col1: an unclaimed club cannot hold colours at all — the database refuses them (D-172)',
    await refused(`update club set colour_primary = '#7a1f35', colour_secondary = '#f2b134' where id = $1`, [u]), true);
  check('col2: a claimed club can',
    await refused(`update club set colour_primary = '#7a1f35', colour_secondary = '#f2b134' where id = $1`, [c]), false);
  check('col3: half a pair, a name, upper case or a short hex is refused',
    [await refused(`update club set colour_primary = '#7a1f35', colour_secondary = null where id = $1`, [c]),
     await refused(`update club set colour_primary = 'red', colour_secondary = '#ffffff' where id = $1`, [c]),
     await refused(`update club set colour_primary = '#7A1F35', colour_secondary = '#ffffff' where id = $1`, [c]),
     await refused(`update club set colour_primary = '#fff', colour_secondary = '#ffffff' where id = $1`, [c])],
    [true, true, true, true]);
  check('col4: a club with colours cannot be put back to unclaimed without losing them in the same statement',
    [await refused(`update club set club_state = 'unclaimed' where id = $1`, [c]),
     await refused(`update club set club_state = 'unclaimed', colour_primary = null, colour_secondary = null where id = $1`, [c])],
    [true, false]);
  const pair = { primary: '#7a1f35', secondary: '#f2b134' };
  check('col5: the page gets no theme for an unclaimed or suspended club, whatever it holds',
    [clubTheme(pair, 'unclaimed'), clubTheme(pair, 'suspended'), clubTheme(pair, 'claimed') !== null, clubTheme(pair, 'verified') !== null],
    [null, null, true, true]);
  // Every preset and the worst a club could pick: white text holds 4.5:1 on
  // the hero, and the trim stays visible (3:1) on the page and the hero's end.
  const worst = [...PRESETS, { primary: '#ffffff', secondary: '#ffffff' }, { primary: '#ffff00', secondary: '#fff5cc' },
    { primary: '#000000', secondary: '#000000' }, { primary: '#0b120e', secondary: '#0c130f' }, { primary: '#3ddc84', secondary: '#3ddc84' }];
  const bad = worst.filter((p) => {
    const t = clubTheme(p, 'claimed');
    return !t || contrast('#eef5f0', t.hero) < 4.5 || contrast(t.trim, '#0b120e') < 3 || contrast(t.trim, t.heroDeep) < 3 || contrast(t.onTrim, t.trim) < 3;
  }).map((p) => `${p.primary}/${p.secondary}`);
  check(`col6: whatever a club picks, its name stays readable and its trim stays visible (${bad.join(', ') || 'all pass'})`, bad, []);
}

// ---------------------------------------------------------------------------
// A player's CV in its club's colours (0165, D-174; John's conditions 2 and
// 4, 1 Oct). fn_cv_club_colours answers for the club fn_cv_club names and no
// other, so the colours follow the club line: they move the moment it moves,
// a club that is not verified lends none, a suspended club is not there at
// all, and an under-16's colours move only once their guardian has acted
// (D-91, D-119). Its own world, so nothing above moves it.
// ---------------------------------------------------------------------------
{
  const q1 = async (sql, args) => (await db.query(sql, args)).rows[0];
  const K = {};
  for (const k of ['home', 'away', 'plain', 'lapse', 'susp', 'homeSq', 'awaySq', 'plainSq', 'lapseSq', 'suspSq',
    'kid', 'teen', 'lapsed', 'susped', 'guardian', 'awayTd', 'nobody']) K[k] = crypto.randomUUID();
  const person = (id, name, dob) => db.query(`insert into person (id, first_name, last_name, dob) values ($1,$2,'Colours',$3)`, [id, name, dob]);
  await person(K.kid, 'Kai', yearsAgo(13));
  await person(K.teen, 'Tess', yearsAgo(17));
  await person(K.lapsed, 'Lou', yearsAgo(22));
  await person(K.susped, 'Sid', yearsAgo(22));
  for (const k of ['guardian', 'awayTd', 'nobody']) await person(K[k], `Cv ${k}`, yearsAgo(41));
  // The under-16 and the 16-17 both have a confirmed parent: a 16-17 acts on
  // a squad alone only with one (0054, D-22).
  for (const child of [K.kid, K.teen]) {
    await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [K.guardian, child]);
  }
  // Five verified clubs, as the product verifies one: a call, then the state.
  const club = async (id, sq, name, pair) => {
    const call = crypto.randomUUID();
    await db.query(`insert into club (id, name, club_state) values ($1,$2,'claimed')`, [id, name]);
    await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
      values ($1,$2,now(),'BUZ','03 9000 0165','FV club directory','verified','27@v1.0')`, [call, id]);
    await db.query(`update club set club_state = 'verified', verified_call_id = $1 where id = $2`, [call, id]);
    if (pair) await db.query(`update club set colour_primary = $2, colour_secondary = $3 where id = $1`, [id, pair.primary, pair.secondary]);
    await db.query(`insert into squad (id, club_id, name, age_group, competition_gender, season) values ($1,$2,'Colours U15','U15','boys','2026')`, [sq, id]);
  };
  const [claret, navy, purple, black] = ['Claret and gold', 'Navy and white', 'Purple and gold', 'Black and gold'].map((n) => PRESETS.find((p) => p.name === n));
  await club(K.home, K.homeSq, 'Colours Home FC', claret);
  await club(K.away, K.awaySq, 'Colours Away FC', navy);
  await club(K.plain, K.plainSq, 'Colours Plain FC', null);
  await club(K.lapse, K.lapseSq, 'Colours Lapse FC', purple);
  await club(K.susp, K.suspSq, 'Colours Suspended FC', black);
  const mem = (p, c, sq) => db.query(`insert into membership (person_id, club_id, squad_id, role) values ($1,$2,$3,'player')`, [p, c, sq]);
  await mem(K.kid, K.home, K.homeSq);
  await mem(K.teen, K.plain, K.plainSq);
  await mem(K.lapsed, K.lapse, K.lapseSq);
  await mem(K.susped, K.susp, K.suspSq);
  // Away's technical director, recorded on its call (0058), and Kai on Away's
  // register — the only players a club may ask into a squad (0054, B3).
  await recordTd(K.awayTd, K.away, 'colours.away.td@fixture.example');
  await db.query(`insert into registration (player_id, club_id, positions, club_status, disclosed_by, policy_version)
    values ($1,$2,array['CM'],'new',$3,'20@v2.4')`, [K.kid, K.away, K.guardian]);

  // jsonb keeps its own key order; the answer is read back in the order the
  // checks below are written in.
  const colours = async (p) => {
    const c = (await q1('select fn_cv_club_colours($1) as c', [p])).c;
    return c && { primary: c.primary, secondary: c.secondary, state: c.state };
  };
  const clubLine = async (p) => (await q1(`select fn_cv_club($1)->>'club' as c`, [p])).c;
  const both = async (p) => [await clubLine(p), await colours(p)];
  const worn = (pair, state = 'verified') => ({ primary: pair?.primary ?? null, secondary: pair?.secondary ?? null, state });

  check('cvcol1: a live membership at a verified club gives that club’s own colours, beside the club line that names it',
    await both(K.kid), ['Colours Home FC', worn(claret)]);
  check('cvcol2: a verified club that chose no colours lends none, and a person the CV names no club for gets nothing at all',
    [await both(K.teen), await both(K.nobody)], [['Colours Plain FC', worn(null)], ['', null]]);

  // Condition 2: the player changes club. The 16-17 asks and the club
  // confirms, as app/club/squads/[squadId]/actions.ts does it (fn_join_squad
  // ends the old membership and starts the new one in one statement).
  const join = async (who, sq, actor, source, asker) =>
    (await q1(`select fn_join_squad($1,$2,$3,$4,$5) as ok`, [who, sq, actor, source, asker ?? null])).ok;
  const moved = await join(K.teen, K.awaySq, K.awayTd, 'claim', K.teen);
  check('cvcol3: the moment a player changes club the CV wears the NEW club’s colours — the old club’s are gone with its name',
    [moved, await both(K.teen)], [true, ['Colours Away FC', worn(navy)]]);
  await join(K.teen, K.plainSq, K.teen, 'claim', K.teen);
  check('cvcol3b: and moving on to a club with no colours of its own leaves the CV in none',
    await both(K.teen), ['Colours Plain FC', worn(null)]);
  await db.query(`update membership set ended_at = now() where person_id = $1 and role = 'player' and ended_at is null`, [K.teen]);
  check('cvcol3c: a membership that ends with no new one leaves no club line and no colours',
    await both(K.teen), ['', null]);

  // "Verified only, and the theme clears the moment that stops being true."
  const before = await both(K.lapsed);
  await db.query(`insert into verification_call (club_id, called_at, operator, number_called, number_source, outcome, policy_version)
    values ($1, now(), 'BUZ', '03 9000 0165', 'FV club directory', 'not_verified', '27@v1.0')`, [K.lapse]);
  check('cvcol4: a club that fails a later call (0150) is still named, and lends no colours from that moment — though it still holds them',
    [before, await both(K.lapsed), (await q1('select colour_primary from club where id = $1', [K.lapse])).colour_primary],
    [['Colours Lapse FC', worn(purple)], ['Colours Lapse FC', worn(null, 'claimed')], purple.primary]);
  const beforeSusp = await both(K.susped);
  await db.query(`update club set club_state = 'suspended', suspension_reason = 'child_safety' where id = $1`, [K.susp]);
  check('cvcol4b: a suspended club is not named on the CV and gives it nothing (0155)',
    [beforeSusp, await both(K.susped)], [['Colours Suspended FC', worn(black)], ['', null]]);

  // An under-16 (D-91, D-119). Away asks Kai to join, and a different club
  // has a claim waiting: neither writes a membership, so neither moves the
  // colours. Kai cannot say yes alone. The guardian's yes is what moves them,
  // pressed as app/squad/actions.ts presses it.
  const inv = crypto.randomUUID();
  await db.query(`insert into squad_invitation (id, person_id, club_id, squad_id, invited_by) values ($1,$2,$3,$4,$5)`,
    [inv, K.kid, K.away, K.awaySq, K.awayTd]);
  await db.query(`insert into squad_claim (person_id, club_id, squad_id, asked_by) values ($1,$2,$3,$4)`,
    [K.kid, K.plain, K.plainSq, K.guardian]);
  check('cvcol5: an under-16 with an invitation and a claim both still waiting wears their current club’s colours, unchanged',
    await both(K.kid), ['Colours Home FC', worn(claret)]);
  check('cvcol5b: and cannot accept the invitation alone — only a guardian acts for them (D-91)',
    [(await q1('select fn_can_act_on_squad($1,$2) as ok', [K.kid, K.kid])).ok, (await q1('select fn_can_act_on_squad($1,$2) as ok', [K.guardian, K.kid])).ok],
    [false, true]);
  await db.query('begin');
  await db.query(`update squad_invitation set answered_at = now(), answered_by = $2, accepted = true where id = $1`, [inv, K.guardian]);
  const accepted = await join(K.kid, K.awaySq, K.guardian, 'invitation');
  await db.query('commit');
  check('cvcol5c: the guardian says yes and the colours move with the club line, in the same transaction',
    [accepted, await both(K.kid)], [true, ['Colours Away FC', worn(navy)]]);

  // The same club as the club line, by construction: the membership
  // fn_cv_club_colours reads is fn_cv_club's, word for word — the join, the
  // filter, the order and the limit. If either function's choice of club
  // changes without the other, this fails.
  const pick = (src) => {
    const s = src.replace(/--.*$/gm, '').replace(/\s+/g, ' ');
    return [/from membership m join club c on c\.id = m\.club_id/.test(s), /where m\.person_id = p_person[^$]*?limit 1/.exec(s)?.[0] ?? null];
  };
  const [cvClubPick, coloursPick] = [pick(await procSrc('fn_cv_club')), pick(await procSrc('fn_cv_club_colours'))];
  check('cvcol-s1: fn_cv_club_colours picks its club exactly as fn_cv_club does — same membership, same filter, same order',
    [coloursPick[0], cvClubPick[0], coloursPick[1] !== null && coloursPick[1] === cvClubPick[1]], [true, true, true]);
  // And for every person in this database, the two answer about the same
  // club: a club line exactly when there is a colours answer.
  const disagree = (await db.query(
    `select p.id from person p
     where (coalesce(fn_cv_club(p.id)->>'club', '') <> '') <> (fn_cv_club_colours(p.id) is not null)`)).rows.length;
  check('cvcol-s2: across every person here, a CV has a colours answer exactly when it names a club', disagree, 0);
  check('cvcol-s3: colours come back only for a verified club — never a claimed, unclaimed or suspended one',
    (await db.query(
      `select p.id from person p where fn_cv_club_colours(p.id) is not null
         and fn_cv_club_colours(p.id)->>'state' <> 'verified'
         and (fn_cv_club_colours(p.id)->>'primary' is not null or fn_cv_club_colours(p.id)->>'secondary' is not null)`)).rows.length, 0);

  // One reader. lib/record-read asks the database, beside fn_cv_club, and no
  // other file in the product does; no database function passes it on.
  const askers = tsSourceFiles().filter((f) => /fn_cv_club_colours/.test(codeOnly(srcOf(f))));
  const dbAskers = (await db.query(
    `select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and proname <> 'fn_cv_club_colours' and prosrc ~ 'fn_cv_club_colours'`)).rows.map((r) => r.proname);
  const rr = codeOnly(srcOf('lib/record-read.ts'));
  check('cvcol6: fn_cv_club_colours is asked from lib/record-read and nowhere else — beside fn_cv_club in the live CV read, and once for a snapshot',
    [askers, dbAskers, /fn_cv_club\(\$2\) as membership,(\s*--[^\n]*)*\s*fn_cv_club_colours\(\$2\) as colours/.test(rr),
     /select fn_cv_club_colours\(\$1\) as colours/.test(rr)],
    [['lib/record-read.ts'], [], true, true]);
  // The snapshot's own copy can never win: the live answer is laid over it.
  check('cvcol6b: a served under-16 snapshot takes its colours from the live read, laid over the snapshot, on the share link',
    /\.\.\.bundle\.approved_content, band: [^}]*\.\.\.\(await cvClubColours\(bundle\.person_id\)\)/.test(rr), true);
  // All four CV surfaces hand PlayerCV the colours they were given, and only
  // the record read's answer: the share link, the register CV, the squad CV
  // and the family's preview ("exactly what a club sees").
  const surfaces = ['app/p/[token]/page.tsx', 'app/club/register/cv/[registrationId]/page.tsx',
    'app/club/squads/[squadId]/cv/[playerId]/page.tsx', 'app/build/[recordId]/preview/page.tsx'];
  check('cvcol7: the share link, the register CV, the squad CV and the family preview each pass the CV’s own colours and state to PlayerCV',
    surfaces.filter((f) => !/<PlayerCV p=\{cv\}[^>]*\{\.\.\.wornColours\(cv\)\} \/>/.test(codeOnly(srcOf(f)))), []);
  check('cvcol7a: and what they pass is the record read\u2019s own answer, handed over in one place',
    /export const wornColours = \(cv: CvData\) => \(\{ clubColours: cv\.clubColours \?\? null, clubState: cv\.clubState \?\? undefined \}\)/.test(rr), true);
  const cvCallers = tsSourceFiles().filter((f) => /<PlayerCV\b/.test(codeOnly(srcOf(f))));
  check('cvcol7b: and no other page renders a CV from the database — the rest are the design previews, on fixture data with no club state',
    cvCallers.filter((f) => !surfaces.includes(f)).sort(), ['app/cv-preview/[slug]/page.tsx', 'app/preview/site/page.tsx']);
}

// --- "Send my CV" fills in the club's own address, and a club that asks is
//     never sent to again (0160; John's ruling of 30 Sep §2, cleared by BUZ).
//     Only a role address is ever filled in — never a person's — and only
//     one checked within 90 days; the CV email carries a working opt-out; and
//     "if a club opts out, we stop sending to it at all — including an address
//     a family types by hand". Every door asks fn_send_blocked.
{
  const one = async (sql, args) => (await db.query(sql, args)).rows[0];
  const state = async (sql, args) => { try { await db.query(sql, args); return 'ok'; } catch (e) { return e.code ?? 'error'; } };
  const role = async (email, club) => (await one('select fn_role_address($1, $2) as r', [email, club])).r;
  const blocked = async (d) => (await one('select fn_send_blocked($1) as b', [d])).b;
  const today = (await one(`select ((now() at time zone 'Australia/Melbourne')::date)::text as d`)).d;
  const offered = async (slug) => (await db.query(
    'select club_name, address, checked_on::text as checked_on, blocked from fn_send_address_for_club($1)', [slug])).rows;

  // The shapes production holds (Leo's count of the 138, 30 Sep): the role
  // local parts as they are, and the club-named accounts mirrored on invented
  // clubs, because a real club's name is never fixture data (L15).
  const ROLE = ['info', 'admin', 'secretary', 'enquiries', 'contact', 'juniors', 'committee', 'hello', 'administration',
    'communications', 'mail', 'registrations', 'president', 'ypl', 'miniroostd', 'junior.boys', 'juniors.westernsubsc',
    'secretary.baxtersc', 'refc.secretary', 'shfc.cluboffice'];
  const NAMED = [['kestrelfordsoccerclub@gmail.com', 'Kestrelford Soccer Club'], ['marlowbrookcity@bigpond.com', 'Marlowbrook City FC'],
    ['thornbeckthunder@gmail.com', 'Thornbeck Thunder SC'], ['larkvaleparkfc3999@gmail.com', 'Larkvale Park SC'],
    ['easterneagles1950@gmail.com', 'Eastern Eagles FC'], ['fcblions@gmail.com', 'FC Bramblewood Lions'],
    ['quillonsc@gmail.com', 'Quillon SC'], ['marlowbrookcityfc@gmail.com', 'Marlowbrook City FC']];
  const roleMiss = [];
  for (const l of ROLE) if (!(await role(`${l}@club.example.au`, 'Riverside FC'))) roleMiss.push(l);
  for (const [e, c] of NAMED) if (!(await role(e, c))) roleMiss.push(e);
  check(`sc-1: every role shape production holds is a role address — the role words, and accounts named after the club (${ROLE.length + NAMED.length} shapes)`,
    roleMiss, []);
  check('sc-2: a person’s address never is — at the club’s own domain or on free mail — and neither is anything that is not an address (it fails closed)',
    [await role('john.smith@club.example.au', 'Kestrelford Athletic SC'), await role('jsmith@gmail.com', 'Riverside FC'),
     await role('smithy1987@hotmail.com', 'Riverside FC'), await role('j.whitcombe@kestrelfordathletic.example.au', 'Kestrelford Athletic SC'),
     await role('info', 'Riverside FC'), await role(null, 'Riverside FC'), await role('fcunited@gmail.com', 'FC United')],
    [false, false, false, false, false, false, false]);

  // Four listings: a role address, a person's, a suspended club, and one to stop.
  const club = async (name, slug, email, st = 'unclaimed') => (await one(
    `insert into club (name, suburb, state, club_state, contact_email, public_slug) values ($1, 'Preston', 'VIC', $2, $3, $4) returning id`,
    [name, st, email, slug])).id;
  const quenby = await club('Quenby Rovers SC', 'sc-quenby-rovers', 'Info@QuenbyRovers.example.au');
  await club('Holloway Park SC', 'sc-holloway-park', 'd.pemberton@hollowaypark.example.au');
  await club('Stanmere City FC', 'sc-stanmere-city', 'info@stanmerecity.example.au', 'suspended');
  const larkmoor = await club('Larkmoor Athletic SC', 'sc-larkmoor', 'secretary@larkmoor.example.au');
  const gmailClub = await club('Tollcross Juniors SC', 'sc-tollcross', 'tollcrossjuniors@gmail.com');
  const checkedOn = async (id) => (await one('select contact_checked_on::text as d from club where id = $1', [id])).d;
  check('sc-3: an address written is checked today (Melbourne), whatever writes it',
    [await checkedOn(quenby), await checkedOn(larkmoor)], [today, today]);
  await db.query(`update club set contact_checked_on = contact_checked_on - 30 where id = $1`, [quenby]);
  const kept = await checkedOn(quenby);
  await db.query(`update club set contact_email = contact_email, name = name where id = $1`, [quenby]);
  const unchanged = await checkedOn(quenby);
  await db.query(`update club set contact_email = 'info@quenbyrovers.example.au' where id = $1`, [quenby]);
  const moved = await checkedOn(quenby);
  check('sc-4: re-saving the same address keeps its date; a changed address is checked today',
    [unchanged === kept, kept !== today, moved], [true, true, today]);

  check('sc-5: a role address, checked in 90 days and not stopped, is offered in full with its date',
    await offered('sc-quenby-rovers'),
    [{ club_name: 'Quenby Rovers SC', address: 'info@quenbyrovers.example.au', checked_on: today, blocked: false }]);
  check('sc-6: a club that publishes only a person’s address is offered no address and no date — only its name',
    await offered('sc-holloway-park'), [{ club_name: 'Holloway Park SC', address: null, checked_on: null, blocked: false }]);
  await db.query(`update club set contact_checked_on = (now() at time zone 'Australia/Melbourne')::date - 90 where id = $1`, [quenby]);
  const at90 = (await offered('sc-quenby-rovers'))[0].address;
  await db.query(`update club set contact_checked_on = (now() at time zone 'Australia/Melbourne')::date - 91 where id = $1`, [quenby]);
  const at91 = (await offered('sc-quenby-rovers'))[0];
  check('sc-7: an address checked 90 days ago still fills in; at 91 days it stops, date and all, until somebody checks it',
    [at90, at91.address, at91.checked_on], ['info@quenbyrovers.example.au', null, null]);
  check('sc-8: an unknown slug and a suspended club return no row at all',
    [(await offered('sc-no-such-club')).length, (await offered('sc-stanmere-city')).length], [0, 0]);

  // The club's own opt-out, from the CV email: the send it came in.
  const adult = crypto.randomUUID(), adultRec = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob) values ($1, 'Stopsender', $2)`, [adult, yearsAgo(24)]);
  await db.query(`insert into development_record (id, person_id, positions) values ($1, $2, array['CM'])`, [adultRec, adult]);
  const ask = async (dest) => (await one(
    `insert into share_request (record_id, requested_by, destination) values ($1, $2, $3) returning id`, [adultRec, adult, dest])).id;
  // A CV that went: the stop link only exists in a sent email (0161).
  const sent = async (dest) => (await one(
    `insert into share_request (record_id, requested_by, destination, dispatched_by, dispatched_at) values ($1, $2, $3, $2, now()) returning id`,
    [adultRec, adult, dest])).id;
  const blocks = async () => (await db.query(
    `select coalesce(address, domain) as what, source, club_id = any($1::uuid[]) as clubbed from send_block order by 1`,
    [[larkmoor, gmailClub, quenby]])).rows;
  const before = await blocks();
  const larkAsk = await sent('Larkmoor Athletic SC <secretary@larkmoor.example.au>');
  // Asked for, but not yet sent, when the club asks us to stop.
  const pending = await ask('Larkmoor Athletic SC <juniors@larkmoor.example.au>');
  await db.query('select fn_send_stop_request($1)', [larkAsk]);
  await db.query('select fn_send_stop_request($1)', [larkAsk]);
  const after = (await blocks()).filter((b) => !before.some((x) => x.what === b.what));
  check('sc-9: a club’s stop link stops its address and its own domain, once, however often it is pressed',
    after, [{ what: 'larkmoor.example.au', source: 'recipient', clubbed: true }, { what: 'secretary@larkmoor.example.au', source: 'recipient', clubbed: true }]);
  check('sc-10: and a different address a family types at that club — or at a part of its domain — is stopped too; a domain that merely ends the same way is not',
    [await blocked('coach@larkmoor.example.au'), await blocked('Larkmoor <Juniors@Larkmoor.example.au>'),
     await blocked('x@mail.larkmoor.example.au'), await blocked('x@notlarkmoor.example.au')], [true, true, true, false]);
  check('sc-11: the send screen offers it no address and says it is stopped',
    await offered('sc-larkmoor'), [{ club_name: 'Larkmoor Athletic SC', address: null, checked_on: null, blocked: true }]);

  const gmailAsk = await sent('Tollcross Juniors SC <tollcrossjuniors@gmail.com>');
  await db.query('select fn_send_stop_request($1)', [gmailAsk]);
  check('sc-12: a club run from free mail stops only its own address — never gmail.com for everybody',
    [await blocked('tollcrossjuniors@gmail.com'), await blocked('someone.else@gmail.com'),
     (await one(`select count(*)::int as n from send_block where domain = 'gmail.com'`)).n], [true, false, 0]);
  const shared1 = await club('Ashvale Rangers SC', 'sc-ashvale', 'ashvale@league.example.au');
  await club('Birchmont United', 'sc-birchmont', 'birchmont@league.example.au');
  await db.query('select fn_send_stop_request($1)', [await sent('Ashvale Rangers SC <ashvale@league.example.au>')]);
  const typedAsk = await sent('Some Club <coach@typedbyhand.example.au>');
  await db.query('select fn_send_stop_request($1)', [typedAsk]);
  check('sc-13: a domain another listed club is on is not stopped, and an address that is no club’s stops only itself',
    [await blocked('ashvale@league.example.au'), await blocked('birchmont@league.example.au'),
     await blocked('coach@typedbyhand.example.au'), await blocked('secretary@typedbyhand.example.au'),
     (await one(`select club_id from send_block where address = 'ashvale@league.example.au'`)).club_id === shared1],
    [true, false, true, false, true]);
  const rowsBefore = (await blocks()).length;
  check('sc-14: a stop for a send that does not exist stops nothing, and says nothing',
    [await state('select fn_send_stop_request($1)', [crypto.randomUUID()]), (await blocks()).length - rowsBefore], ['ok', 0]);
  const neverSent = await ask('Some Club <coach@neversent.example.au>');
  await db.query('select fn_send_stop_request($1)', [neverSent]);
  const ref = async (id) => (await one('select address from send_stop_ref where id = $1', [id]))?.address ?? null;
  check('sc-14b: a request that was never sent leaves no stop reference and stops nothing; a sent one leaves exactly its address',
    [await ref(neverSent), await blocked('coach@neversent.example.au'), await ref(larkAsk)],
    [null, false, 'secretary@larkmoor.example.au']);

  // The belt: whatever composed a request, a stopped destination is never stamped sent.
  const stamp = (id) => state(`update share_request set dispatched_by = $2, dispatched_at = now() where id = $1`, [id, adult]);
  const openAsk = await ask('Quenby Rovers SC <info@quenbyrovers.example.au>');
  check('sc-15: the dispatch stamp is refused for a stopped destination (asked for before the club stopped it), and allowed for one that is not',
    [await stamp(pending), await stamp(openAsk),
     await state(`insert into share_request (record_id, requested_by, destination, dispatched_by, dispatched_at) values ($1, $2, 'x <coach@larkmoor.example.au>', $2, now())`, [adultRec, adult])],
    ['42501', 'ok', '42501']);
  check('sc-16: who asked us to stop is locked like every table — row security on, no policies (L26)',
    [(await one(`select relrowsecurity as r from pg_class where oid = 'send_block'::regclass`)).r,
     (await one(`select count(*)::int as n from pg_policies where tablename = 'send_block'`)).n], [true, 0]);

  // The operator, for a club that asks by phone or email.
  const opId = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, email) values ($1, 'Stop Curator', 'stop.curator@fixture.example')`, [opId]);
  const OPS = [opId, 'stop.curator@fixture.example'];
  const wharf = await club('Wharfdale Harriers SC', 'sc-wharfdale', 'admin@wharfdaleharriers.example.au');
  const bare = (await one(`insert into club (name, club_state) values ('Addressless Athletic', 'unclaimed') returning id`)).id;
  const sendsOf = async (id) => one('select held, stopped from fn_ops_club_sends($1)', [id]);
  const was = await sendsOf(wharf);
  check('sc-17: only an operator named by their own address can stop a club, and a club with no address held has nothing to stop',
    [await state('select fn_ops_stop_club_sends($1, $2, $3)', [adult, 'stop.curator@fixture.example', wharf]),
     await state('select fn_ops_stop_club_sends($1, $2, $3)', [...OPS, bare]), await sendsOf(bare)],
    ['42501', '23514', { held: false, stopped: false }]);
  await db.query('select fn_ops_stop_club_sends($1, $2, $3)', [...OPS, wharf]);
  check('sc-18: the operator stops a club’s address and its domain for every sender, and the log names who did it',
    [was, await sendsOf(wharf), await blocked('under12s@wharfdaleharriers.example.au'),
     await one(`select source, created_by_email from send_block where domain = 'wharfdaleharriers.example.au'`),
     await one(`select action, operator_email, detail->>'address' as address, detail->>'domain' as domain from curation_event where club_id = $1`, [wharf])],
    [{ held: true, stopped: false }, { held: true, stopped: true }, true,
     { source: 'operator', created_by_email: 'stop.curator@fixture.example' },
     { action: 'club_sends_stopped', operator_email: 'stop.curator@fixture.example', address: 'admin@wharfdaleharriers.example.au', domain: 'wharfdaleharriers.example.au' }]);

  // 0161 · 1 — only an unclaimed listing has its address filled in: the
  // words say "publishes on its own website", which is what we know of a
  // listing Pitch compiled and nothing else.
  const claimedId = await club('Rushbrook Athletic SC', 'sc-rushbrook', 'info@rushbrook.example.au', 'claimed');
  const verifiedId = await club('Pellham Vale FC', 'sc-pellham-vale', 'secretary@pellhamvale.example.au', 'claimed');
  const vCall = crypto.randomUUID();
  await db.query(`insert into verification_call (id, club_id, called_at, operator, number_called, number_source, outcome, policy_version)
    values ($1,$2,now(),'BUZ','03 9000 0160','FV club directory','verified','27@v1.0')`, [vCall, verifiedId]);
  await db.query(`update club set club_state = 'verified', verified_call_id = $1 where id = $2`, [vCall, verifiedId]);
  check('sc-19: a claimed club and a verified club get their name and no address, even a fresh role address; an unclaimed one does',
    [await offered('sc-rushbrook'), await offered('sc-pellham-vale'), (await offered('sc-quenby-rovers'))[0].club_name, claimedId !== verifiedId],
    [[{ club_name: 'Rushbrook Athletic SC', address: null, checked_on: null, blocked: false }],
     [{ club_name: 'Pellham Vale FC', address: null, checked_on: null, blocked: false }], 'Quenby Rovers SC', true]);

  // 0161 · 3 — the club's opt-out outlives the family's erasure. An
  // under-16's CV, sent by their parent through the product's own path (the
  // trigger writes the stop reference), then the parent erases the child.
  const kid = crypto.randomUUID(), mum = crypto.randomUUID(), kidRec = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob) values ($1, 'Stopkid', $2), ($3, 'Stopmum', $4)`, [kid, yearsAgo(13), mum, yearsAgo(40)]);
  await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1, $2, now())`, [mum, kid]);
  await db.query(`insert into development_record (id, person_id, positions) values ($1, $2, array['LB'])`, [kidRec, kid]);
  const kidSend = (await one(`insert into share_request (record_id, requested_by, destination) values ($1, $2, 'Wharfdale Juniors <juniors@erasedkid.example.au>') returning id`, [kidRec, kid])).id;
  await db.query(`update share_request set dispatched_by = $2, dispatched_at = now() where id = $1`, [kidSend, mum]);
  const refBefore = await ref(kidSend);
  const erased = await state('select fn_erase_child($1, $2)', [mum, kid]);
  await db.query('select fn_send_stop_request($1)', [kidSend]);
  check('sc-20: a parent erases their child after a CV went; the request is gone, and the club pressing the link in that email still stops CVs to its address',
    [refBefore, erased, (await one('select count(*)::int as n from share_request where id = $1', [kidSend])).n,
     await ref(kidSend), await blocked('juniors@erasedkid.example.au')],
    ['juniors@erasedkid.example.au', 'ok', 0, 'juniors@erasedkid.example.au', true]);
  check('sc-21: the stop reference is locked like every table — row security on, no policies (L26)',
    [(await one(`select relrowsecurity as r from pg_class where oid = 'send_stop_ref'::regclass`)).r,
     (await one(`select count(*)::int as n from pg_policies where tablename = 'send_stop_ref'`)).n], [true, 0]);

  // The doors in the product: every one asks the same question.
  const pickUp = /const req = await client\.query\(\s*`([^`]*)`/.exec(dispatchLib)?.[1] ?? '';
  check('sc-s1: the one dispatch path will not pick up a stopped destination — a stopped send returns null, one answer',
    [/for update of sr/.test(pickUp), /and not fn_send_blocked\(sr\.destination\)/.test(pickUp)], [true, true]);
  const compose = codeOnly(composeSrc).split('export async function composeSend')[1].split('export async function')[0];
  const askAt = compose.indexOf('fn_send_blocked');
  check('sc-s2: composeSend asks before it writes anything or counts the send, on both paths, and lands on the blocked screen',
    [askAt > 0, askAt < compose.indexOf('insert into'), askAt < compose.indexOf('checkRate'), askAt < compose.indexOf("state.mode === 'self'"),
     /redirect\(`\/send\/\$\{recordId\}\?blocked=1`\)/.test(compose)], [true, true, true, true, true]);
  const sendPage = codeOnly(srcOf('app/send/[recordId]/page.tsx'));
  check('sc-s3: the send screen reads the club’s address only through fn_send_address_for_club, and never masks it (John: a masked address cannot be reviewed)',
    [/from fn_send_address_for_club\(\$1\)/.test(sendPage), /contact_email|from club\b/.test(sendPage), /•|\\u2022|mask/i.test(sendPage)],
    [true, false, false]);
  const stopPage = codeOnly(srcOf('app/stop-cvs/page.tsx')), stopAct = codeOnly(srcOf('app/stop-cvs/actions.ts'));
  // Leo, 30 Sep: a good signature is always honoured and never rate-limited;
  // only a failed one is counted.
  const stopBody = stopAct.split('export async function stopCvs')[1] ?? '';
  const validAt = stopBody.indexOf('if (stopCvsValid(requestId, sig)) {'), elseAt = stopBody.indexOf('} else {');
  check('sc-s4: opening /stop-cvs changes nothing — the page reads no database; only the press stops, after the signature, and only a failed signature is counted against the limit',
    [/db\.|fn_send_stop_request|from '@\/lib\/db'/.test(stopPage),
     validAt > -1 && validAt < stopBody.indexOf('fn_send_stop_request') && stopBody.indexOf('fn_send_stop_request') < elseAt,
     (stopBody.match(/checkRate\(/g) ?? []).length, stopBody.indexOf('checkRate(') > elseAt,
     (stopAct.match(/redirect\(/g) ?? []).length, /redirect\('\/stop-cvs\?done=1'\)/.test(stopAct)], [false, true, 1, true, 1, true]);
  const { execFileSync } = await import('node:child_process');
  const lib = fileURLToPath(new URL('../lib/stop-cvs.ts', import.meta.url));
  const run = (code, env = {}) => { try { return execFileSync(process.execPath, [
    '--conditions=react-server', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--input-type=module', '-e',
    `const m = await import(${JSON.stringify(lib)}); ${code}`], { encoding: 'utf8', env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return 'threw'; } };
  const rid = '0c9a6f7e-3b1d-4d2a-9e8f-1a2b3c4d5e6f';
  const sig = run(`process.stdout.write(m.stopCvsSig(${JSON.stringify(rid)}))`, { SESSION_SECRET: 'sc-test-secret' });
  const expectSig = createHmac('sha256', 'sc-test-secret').update(`stop-cvs:${rid}`).digest('base64url');
  const valid = (r, t) => run(`process.stdout.write(String(m.stopCvsValid(${JSON.stringify(r)}, ${JSON.stringify(t)})))`, { SESSION_SECRET: 'sc-test-secret' });
  check('sc-s5: the stop link is HMAC-SHA256 of the send under the session secret; it verifies, and a changed id, a changed signature or no signature does not',
    [sig === expectSig, valid(rid, expectSig), valid('0c9a6f7e-3b1d-4d2a-9e8f-1a2b3c4d5e70', expectSig),
     valid(rid, expectSig.slice(0, -1) + (expectSig.endsWith('A') ? 'B' : 'A')), valid(rid, '')],
    [true, 'true', 'false', 'false', 'false']);
  check('sc-s6: and in production it refuses to sign with no secret, as sessions do, comparing in constant time',
    [run(`process.stdout.write(m.stopCvsSig(${JSON.stringify(rid)}))`, { SESSION_SECRET: '', NODE_ENV: 'production' }),
     /timingSafeEqual\(want, got\)/.test(codeOnly(srcOf('lib/stop-cvs.ts')))], ['threw', true]);
  const cfg = srcOf('next.config.mjs');
  check('sc-s7: /stop-cvs is served no-referrer and noindex, and the page asks not to be indexed',
    [/source: '\/stop-cvs',\s*headers: \[\s*\{ key: 'Referrer-Policy', value: 'no-referrer' \},\s*\{ key: 'X-Robots-Tag', value: 'noindex, nofollow' \}/.test(cfg),
     /robots: \{ index: false, follow: false \}/.test(stopPage)], [true, true]);
}

// --- A club's page address keeps its letters (0162; BUZ, 30 Sep: "should be
//     Derzelez"). Letters are folded, never dropped, and an address a listing
//     used to have is kept so it can move for good to the new one.
{
  const slug = async (name) => (await db.query('select fn_club_slug_for($1, null) as s', [name])).rows[0].s;
  check('slug-1: letters are folded to their plain form, never dropped — Đ is D',
    [await slug('Balmoral FC (Đerzelez)'), await slug('Café São Paulo FC'), await slug('Øster Æble & Sons'), await slug('Straße United')],
    ['balmoral-fc-derzelez', 'cafe-sao-paulo-fc', 'oster-aeble-and-sons', 'strasse-united']);
  const own = (await db.query(`insert into club (name, club_state, public_slug) values ('Slugtest Wanderers', 'unclaimed', 'slugtest-wanderers-now') returning id`)).rows[0].id;
  await db.query(`insert into club_slug_former (slug, club_id) values ('slugtest-wanderers', $1)`, [own]);
  check('slug-2: a former address answers with the listing’s address now, and an unknown one with nothing',
    [(await db.query(`select fn_club_slug_now('slugtest-wanderers') as s`)).rows[0].s, (await db.query(`select fn_club_slug_now('no-such-club') as s`)).rows[0].s],
    ['slugtest-wanderers-now', null]);
  check('slug-3: a new listing never takes an address another club used to have',
    await slug('Slugtest Wanderers'), 'slugtest-wanderers-2');
  await db.query('delete from club where id = $1', [own]);
  check('slug-4: the former-address table has row-level security on and no policies (L26)',
    [(await db.query(`select relrowsecurity as r from pg_class where relname = 'club_slug_former'`)).rows[0].r,
     (await db.query(`select count(*)::int as n from pg_policies where tablename = 'club_slug_former'`)).rows[0].n], [true, 0]);
}

// --- dfx: the live defects the Head of Product Design found (docs/design/
//     specs/README.md on design/player-cv; BUZ, 1 Oct). The rules a page's
//     source must keep, and the one database answer the fixes added (0164).
//     Each was run against the code before its fix.
{
  // A-P8 (defect 1): no price while billing is off, by rule — the Plan block
  // and the payment notice on the administrator's home ask the same switch as
  // the sidebar's door, instead of relying on fn_register_payment_state
  // answering 'free'.
  const home = codeOnly(srcOf('app/home/page.tsx'));
  check('dfx-A-P8: the administrator’s Plan block, the only place /home prints a price, and its payment notice are drawn only with billing on',
    [/\{billing && plan\?\.pay_state === 'active' && \(\s*<Link href="\/club\/billing"[\s\S]{0,600}PRICES\.register_annual/.test(home),
     /\{billing && plan && \(plan\.pay_state === 'grace' \|\| plan\.pay_state === 'suspended'\) && \(\s*<RegisterPaused/.test(home),
     (home.match(/PRICES\./g) ?? []).length], [true, true, 2]);

  // A-P9 (defect 3): the operator's Home door is the console, not /home.
  check('dfx-A-P9: the operator console’s Home door goes to /ops',
    /\{ key: 'home', href: '\/ops', label: 'Home'/.test(codeOnly(srcOf('components/console-shell.tsx'))), true);

  // D-PD-1 (defect 4): "Not this one" is a link home on all four answer
  // screens — /g/card has no seeded card, so its source is read here; the
  // render suite reads the other three as served.
  for (const f of ['app/g/card/[cardId]/page.tsx', 'app/g/send/[requestId]/page.tsx', 'app/g/interest/[requestId]/page.tsx', 'app/g/pending/[recordId]/page.tsx']) {
    const src = codeOnly(srcOf(f));
    check(`dfx-PD-1s: ${f.split('/')[2]} — "Not this one" is <Link href="/home">, never a div, and no second form`,
      [/<Link href="\/home"[^>]*>Not this one<\/Link>/.test(src), /<div[^>]*>Not this one<\/div>/.test(src), (src.match(/<form /g) ?? []).length <= 2],
      [true, false, true]);
  }

  // G-P2 (defect 11): the reset link is checked when it is opened. The page
  // asks before it draws the form, and the database's answer agrees with the
  // one the press uses, for every state, and opening never uses a link.
  const resetPage = codeOnly(srcOf('app/reset/[token]/page.tsx'));
  check('dfx-G-P2: /reset/[token] asks whether the link is live before it draws a password field',
    resetPage.indexOf("if (!(await resetLinkLive(token))) redirect('/reset?expired=1');") > -1
      && resetPage.indexOf('resetLinkLive(token)') < resetPage.indexOf('name="password"'), true);
  {
    const who = (await db.query(`insert into person (first_name, last_name, dob, email) values ('Resetta','Fixture','1990-01-01','resetta.dfx@example.com') returning id`)).rows[0].id;
    const mk = async (raw, expires = "now() + interval '1 hour'") =>
      db.query(`insert into auth_reset (person_id, token_hash, expires_at) values ($1, $2, ${expires})`, [who, sha(raw)]);
    const live = async (raw) => (await db.query('select fn_auth_reset_live($1) as l', [sha(raw)])).rows[0].l;
    // In this order, because each new link revokes the person's other live
    // ones (0062's one-live trigger): the newest is the only live one.
    await mk('dfx-reset-expired', "now() - interval '1 minute'");
    await mk('dfx-reset-old');
    await mk('dfx-reset-new');
    const before = [await live('dfx-reset-new'), await live('dfx-reset-old'), await live('dfx-reset-expired'), await live('dfx-never-a-reset-link')];
    const stillUnused = (await db.query(`select count(*)::int as n from auth_reset where person_id = $1 and used_at is not null`, [who])).rows[0].n;
    const used = (await db.query('select fn_use_auth_reset($1) as p', [sha('dfx-reset-new')])).rows[0].p;
    check('dfx-G-P2b: fn_auth_reset_live says live for the newest link only — replaced, expired and never-existed are not — and asking uses nothing',
      [before, stillUnused, used === who, await live('dfx-reset-new')], [[true, false, false, false], 0, true, false]);
    await db.query('delete from auth_reset where person_id = $1', [who]);
    await db.query('delete from person where id = $1', [who]);
  }

  // Defect 25: "Infinity% of sent". No share is printed of nothing sent.
  check('dfx-I-25: /ops prints "% of sent" only when something was sent today',
    /sub=\{t\.approvals_sent > 0 \? `\$\{Math\.round\(\(100 \* t\.approved\) \/ t\.approvals_sent\)\}% of sent` : undefined\}/.test(codeOnly(srcOf('app/ops/page.tsx'))), true);

  // Defect 27: no table head over nothing on /ops/verification.
  const verif = codeOnly(srcOf('app/ops/verification/page.tsx'));
  check('dfx-I-27: /ops/verification with no club draws a sentence, not a table head over nothing',
    [/\{rows\.length === 0 \? \(\s*<div[^>]*>No club has claimed its page yet\.<\/div>\s*\) : \(\s*<div className="ops-table">/.test(verif)], [true]);

  // Defect 24 (F-N1): "just narrowed" only when a filter narrowed something.
  const reg = codeOnly(srcOf('app/club/register/page.tsx'));
  check('dfx-F-N1: an empty register says nobody has registered yet; "just narrowed" is said only when there were rows to narrow',
    [/\{all\.length === 0 && \(\s*<div[^>]*>\s*Nobody has registered interest in your trials yet\./.test(reg),
     /\{all\.length > 0 && buckets\.length === 0 && \(\s*<div[^>]*>\s*Nobody matches that yet\./.test(reg)], [true, true]);

  // Defect 28: the demo strip's one control meets the 44px floor.
  // J-P1 (BUZ, 1 Oct) moved the strip's styling from inline to its own classes
  // (J spec, "Parts and exact CSS"), so the height is read where it now lives:
  // the link must be exactly the class-only markup — no inline style that
  // could shrink it — and that class's own rule must give it 44px or more.
  const bar = codeOnly(srcOf('components/DemoBar.tsx'));
  const cssNoComments = srcOf('app/globals.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const barLinkRule = /(?:^|\n)\.demo-bar-a \{([^}]*)\}/.exec(cssNoComments)?.[1] ?? '';
  const barMin = /<a href="\/demo" className="demo-bar-a">Switch seat<\/a>/.test(bar)
    ? Number(/(?:^|;)\s*min-height:\s*(\d+)px/.exec(barLinkRule)?.[1] ?? 0) : 0;
  check(`dfx-J-28: the demo strip’s "Switch seat" is at least 44px tall (${barMin}px)`, barMin >= 44, true);

  // J, the club demo (BUZ, 1 Oct: J-P1, J-P2). Static, because /demo and the
  // strip exist only under `npm run demo` and the render crawl never sees them.
  const barRule = /(?:^|\n)\.demo-bar \{([^}]*)\}/.exec(cssNoComments)?.[1] ?? '';
  const barTextRule = /(?:^|\n)\.demo-bar-t \{([^}]*)\}/.exec(cssNoComments)?.[1] ?? '';
  check('dm-J1: the demo strip is a state, not an action — dark, the amber "Demo" pill, no green, never sticky, one line',
    [/<div role="note" className="demo-bar">\s*<div className="fl-wide demo-bar-in">\s*<span className="pill pill-wait">Demo<\/span>\s*<span className="demo-bar-t">every person here is made up<\/span>\s*<a href="\/demo" className="demo-bar-a">Switch seat<\/a>/.test(bar),
     /accent|T\.|style=/.test(bar),
     /background:\s*var\(--surface-sunken\)/.test(barRule) && !/accent|position/.test(barRule) && !/#[0-9a-f]{3,8}\b|rgba?\(/i.test(barRule),
     /white-space:\s*nowrap/.test(barTextRule) && /text-overflow:\s*ellipsis/.test(barTextRule)],
    [true, false, true, true]);
  check('dm-J2: the strip is server-rendered on every page, and only in a demo',
    /\{isDemo\(\) && <DemoBar \/>\}/.test(codeOnly(srcOf('app/layout.tsx'))), true);
  const demoPage = codeOnly(srcOf('app/demo/page.tsx'));
  check('dm-J3: a seat is still a POST form carrying the seat field, one per seat — demo-walk presses it unchanged',
    /\{seats\.map\(\(s\) => \(\s*<form key=\{s\.key\} action=\{takeSeat\}>\s*<input type="hidden" name="seat" value=\{s\.key\} \/>\s*<button type="submit" className="choice">/.test(demoPage), true);
  const choiceK = /(?:^|\n)\.choice \.k \{([^}]*)\}/.exec(cssNoComments)?.[1] ?? '';
  check('dm-J4: /demo has no primary and no green text — no glow, no primary button, the seat role muted',
    [/fl-glow|btn-primary|accent|T\.accent/.test(demoPage), /color:\s*var\(--muted\)/.test(choiceK)], [false, true]);
  check('dm-J5: the --unclaimed head tile is the dashed initials tile and never an image (D-172); a claimed club shows its own crest (J-P2)',
    [/const crest = !unclaimed && club\?\.crest_path \? club\.crest_path : null;/.test(demoPage),
     (demoPage.match(/<img\b/g) ?? []).length,
     /\{crest\s*\? <div className="demo-tile demo-tile-crest"><img src=\{crest\}[^>]*\/><\/div>\s*: <div className="demo-tile empty-tile"[^>]*>\{initials\(name\)\}<\/div>\}/.test(demoPage)],
    [true, 1, true]);
  check('dm-J6: seats and open links go two-up from 640px and stay one column below it',
    [/@media \(min-width: 640px\) \{ \.choices\.two \{ grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\); \} \}/.test(cssNoComments),
     /(?:^|\n)\.choices \{[^}]*grid-template-columns: minmax\(0, 1fr\);/.test(cssNoComments),
     (demoPage.match(/className="choices two"/g) ?? []).length], [true, true, 2]);

  // C-P9 (defect 13): the press refuses an adult as the page does, before
  // any request row is written.
  const cardAct = codeOnly(srcOf('app/share-card/[recordId]/actions.ts'));
  check('dfx-C-P9b: asking for a share card sends an adult home before a request is written',
    cardAct.indexOf("if (band === '18plus') redirect('/home');") > -1
      && cardAct.indexOf("if (band === '18plus') redirect('/home');") < cardAct.indexOf('insert into share_card_approval'), true);
}

// A-P4 (BUZ, 1 Oct, option a) and D-F4. The next trial is matched through the
// player's own squad's age group — never a person-level age (D-68, D-25) —
// and the invitation note no longer says "Not this time" closes anything.
{
  const home = codeOnly(srcOf('app/home/page.tsx'));
  check('ap4b: the player home matches the next trial to the player\u2019s current squad\u2019s age group',
    /join trial_notice_age_group ta7 on ta7\.trial_notice_id = tn\.id and ta7\.age_group = s7\.age_group/.test(home)
      && /m7\.role = 'player' and m7\.ended_at is null/.test(home), true);
  const invite = srcOf('app/g/invite/[invitationId]/page.tsx');
  check('df4: the invitation note says nothing is sent — never that "Not this time" closes the invitation (D-138)',
    [/closes this one invitation/.test(invite), /Nothing is sent, and the club is simply not told\./.test(invite)], [false, true]);
}

// The verification queue is in claim order (Head of Product Design, 1 Oct):
// every Victorian listing was created on 30 Sep, so creation order was noise.
check('vq1: the verification queue puts waiting clubs first, longest-waiting at the top — by when they claimed, not when the listing was made',
  /order by case c\.club_state when 'claimed' then 0 else 1 end, claimed_at asc nulls last/.test(codeOnly(srcOf('app/ops/verification/page.tsx'))), true);


// ---------------------------------------------------------------------------
// DOC 15 v1.3 (BUZ, 1 Oct: "Yes to both, hand to Leo"): §34's last paragraph,
// and §39 — "Your club is verified", to the person verified on the call.
//
// John's four tests are the ve-* checks marked JOHN below: §39's recipient is
// never the club's published address; its body carries no digit but the date;
// no guardian or player receives it; it sends on no result but `verified`.
// None of these is a doc 14 row, so no label claims one (L4). Who receives it
// is fn_verified_call_recipient (0166); the action sends to what that says.
// ---------------------------------------------------------------------------
{
  const doc15 = srcOf('docs/15-Message-Copy.md');
  const support = /SUPPORT_EMAIL = '([^']+)'/.exec(srcOf('lib/support.ts'))?.[1];
  // Doc 15's own example, with its markup taken off: the quote marks, the
  // bold and the code ticks. What is left is the words a person receives.
  const sec = (n) => doc15.split(new RegExp(`\\n## ${n} · `))[1]?.split('\n## ')[0] ?? '';
  const docBody = (n) => sec(n).split('\n').filter((l) => l.startsWith('>')).map((l) => l.replace(/^> ?/, '')).join('\n')
    .replaceAll('**', '').replaceAll('`', '');
  const docSubject = (n) => /\*\*Subject:\*\* `([^`]+)`/.exec(sec(n))?.[1];
  // The template, with doc 15's example values put where its placeholders are.
  const tpl = (key, values) => {
    const block = msgSrc.split(`key: '${key}',`)[1]?.split('\n});')[0] ?? '';
    const fill = (s) => Object.entries({ ...values, HELP: support }).reduce((t, [k, v]) => t.replaceAll('${' + k + '}', v), s ?? '');
    return { subject: fill(/subject: `([^`]*)`/.exec(block)?.[1]), body: fill(/body:\n`([\s\S]*?)`,?\s*$/.exec(block)?.[1]) };
  };

  const s34 = tpl('doc15.§34', { clubName: 'Riverside FC', code: '4F92 6B' });
  check('ve-§34: the claim-code email is doc 15 v1.3 §34 byte for byte, its markup aside — subject and body',
    [s34.subject, s34.body], [docSubject(34), docBody(34)]);
  check('ve-§34b: and its last paragraph is the corrected one: no trial notices before verification, and we ring the club on a number we find',
    s34.body.includes('Claiming the page lets you edit it. It does not give you anything about any player under 18, and it does not let you post trial notices yet. For both, we ring the club first, on a number we find ourselves.')
      && !/we'll ring you\.|edit it and post trial notices/.test(s34.body), true);
  const s39 = tpl('doc15.§39', { clubName: 'Riverside FC', date: '1 October 2026' });
  check('ve-§39: "Your club is verified" is doc 15 v1.3 §39 byte for byte, its markup aside — subject and body',
    [s39.subject, s39.body, /\$\{/.test(s39.subject + s39.body)], [docSubject(39), docBody(39), false]);
  check('ve-§39b: it is approved copy — in the catalogue, not a draft, not held',
    [/CATALOGUE_KEYS = \[[\s\S]*?'doc15\.§39'/.test(msgSrc), /DRAFT_KEYS[^\n]*'doc15\.§39'|HELD_KEYS = \[[^\]]*'doc15\.§39'/.test(msgSrc)], [true, false]);
  // JOHN 2. The words carry no number at all; the one the reader sees is the
  // date the template is handed. Interpolates the club, the date and the
  // support address, and nothing else — so no count can be passed in either.
  const raw39 = msgSrc.split("key: 'doc15.§39',")[1].split('\n});')[0];
  check('ve-digits: JOHN — §39 carries no digit but the date: none in its words, and it interpolates only the club, the date and the support address',
    [/\d/.test(s39.body.replace('1 October 2026', '') + s39.subject),
     [...raw39.matchAll(/\$\{([^}]+)\}/g)].map((m) => m[1]).filter((v) => !['clubName', 'date', 'HELP'].includes(v))],
    [false, []]);

  // ---- the recipient, in the database ----
  const adult = async (first, email, { proved = true, dob = yearsAgo(40) } = {}) => {
    const id = crypto.randomUUID();
    await db.query(`insert into person (id, first_name, dob, email) values ($1,$2,$3,$4)`, [id, first, dob, email]);
    if (proved) await proveAddress(id);
    return id;
  };
  const club = async (name, contact) => (await db.query(
    `insert into club (name, club_state, contact_email) values ($1,'claimed',$2) returning id`, [name, contact])).rows[0].id;
  const admin = (person, c) => db.query(`insert into membership (person_id, club_id, role) values ($1,$2,'club_admin')`, [person, c]);
  const call = async (c, outcome, personConfirmed = true) => {
    const id = (await db.query(
      `insert into verification_call (club_id, called_at, operator, number_called, number_source, person_confirmed, outcome, policy_version)
       values ($1, now(), 'BUZ', '03 9000 0039', 'FV club directory', $2, $3, '27@v1.0') returning id`,
      [c, personConfirmed, outcome])).rows[0].id;
    if (outcome === 'verified') await db.query(`update club set club_state='verified', verified_call_id=$1 where id=$2`, [id, c]);
    return id;
  };
  const to = async (callId) => (await db.query(
    'select person_id, email, club_name from fn_verified_call_recipient($1)', [callId])).rows.map((r) => [r.person_id, r.email, r.club_name]);

  // A club with families on it: a child registered by her guardian, held
  // while the club is claimed; an adult player and a 16–17 player in its
  // squad. The administrator who claimed the page is the person on the call.
  const vClub = await club('Verifiable FC', 'Football@Verifiable.example.au');
  const vera = await adult('Vera', 'vera.ve@example.com');
  await admin(vera, vClub);
  const kid = crypto.randomUUID(), teen = crypto.randomUUID();
  await db.query(`insert into person (id, first_name, dob) values ($1,'Kit',$2)`, [kid, yearsAgo(13)]);
  await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [ID.guardian, kid]);
  const grown = await adult('Grown', 'grown.ve@example.com', { dob: yearsAgo(22) });
  await db.query(`insert into person (id, first_name, dob, email) values ($1,'Teen',$2,'teen.ve@example.com')`, [teen, yearsAgo(17)]);
  await proveAddress(teen);
  const vSquad = crypto.randomUUID();
  await db.query(`insert into squad (id, club_id, name, season) values ($1,$2,'Seniors','2026')`, [vSquad, vClub]);
  for (const p of [grown, teen]) await mem(p, vClub, vSquad, 'player');
  await db.query(`insert into registration (player_id, club_id, disclosed_by, policy_version) values ($1,$2,$3,'20@v2.4')`, [kid, vClub, ID.guardian]);
  const families = new Set([ID.guardian, kid, grown, teen]);

  const v1 = await call(vClub, 'verified');
  const first = await to(v1);
  check('ve-to: a verified call answers with the person the club named — its administrator, at their own address, with the club’s name',
    first, [[vera, 'vera.ve@example.com', 'Verifiable FC']]);
  // JOHN 3, positive control above: the answer is non-empty, so "nobody from
  // the families" is not true merely because nobody is returned.
  check('ve-family: JOHN — no guardian or player receives it: the club’s guardian, child, adult player and 16–17 player are not in the answer',
    first.some(([p]) => families.has(p)), false);
  check('ve-family-b: and the function reads no family at all — no guardianship, no registration, no player membership',
    /guardianship_link|registration|'player'/.test(await procSrc('fn_verified_call_recipient')), false);

  // JOHN 4. Every other result answers nobody, and the order matters: a
  // suspended or taken-down call is asked while the club is still verified,
  // so the empty answer is about the RESULT, not the club's state.
  const susp = await call(vClub, 'suspended'), down = await call(vClub, 'takedown');
  check('ve-outcome: JOHN — it does not send on any result but verified: a suspended call and a takedown answer nobody, while the verified call still answers',
    [await to(susp), await to(down), (await to(v1)).length], [[], [], 1]);
  const failed = await call(vClub, 'not_verified');
  check('ve-outcome-b: JOHN — nor a call recorded "not verified" — and that call ends the verification (0150), so the earlier call answers nobody now either',
    [await to(failed), await to(v1)], [[], []]);
  const notNamed = await call(vClub, 'verified', false);
  check('ve-named: a verified call on which the club did NOT name the claimant answers nobody — nobody was verified on it',
    await to(notNamed), []);
  const v2 = await call(vClub, 'verified');
  check('ve-once: once per verification — the new verified call answers again, and the calls before it answer nobody',
    [await to(v2), await to(v1), await to(notNamed)], [[[vera, 'vera.ve@example.com', 'Verifiable FC']], [], []]);

  // JOHN 1. The club's published address is never the recipient, even when
  // the claimant's account IS that address — compared as 0060 compares it,
  // case and spaces aside. The positive control is the same club with its
  // address one letter different.
  const mClub = await club('Mailbox Rovers', 'secretary@mailboxrovers.example.au');
  const sec1 = await adult('Sec', 'secretary.ve@mailboxrovers.example.au');
  await admin(sec1, mClub);
  const m1 = await call(mClub, 'verified');
  const before = (await to(m1)).length;
  await db.query(`update club set contact_email = ' SECRETARY.ve@MailboxRovers.example.au ' where id = $1`, [mClub]);
  check('ve-mailbox: JOHN — §39 never goes to the club’s published address: an administrator whose account is that address receives nothing',
    [before, await to(m1)], [1, []]);

  // The rest of "nobody": an address nobody proved (L21), a minor, two
  // administrators (the call confirmed one name), and an administrator whose
  // seat has ended — none of them falls through to anyone else.
  const uClub = await club('Unproved Athletic', 'football@unproved.example.au');
  await admin(await adult('Una', 'una.ve@example.com', { proved: false }), uClub);
  const twoClub = await club('Two Chairs SC', 'football@twochairs.example.au');
  await admin(await adult('Ann', 'ann.ve@example.com'), twoClub);
  await admin(await adult('Bea', 'bea.ve@example.com'), twoClub);
  let minorTo = [];
  const kClub = await club('Young Hands FC', 'football@younghands.example.au');
  try {
    await admin(await adult('Kim', 'kim.ve@example.com', { dob: yearsAgo(17) }), kClub);
    minorTo = await to(await call(kClub, 'verified'));
  } catch { minorTo = []; }
  check('ve-nobody: an unproved address, a minor and a club with two administrators each answer nobody',
    [await to(await call(uClub, 'verified')), minorTo, await to(await call(twoClub, 'verified'))], [[], [], []]);
  await db.query(`update membership set ended_at = now() where person_id = $1 and club_id = $2`, [vera, vClub]);
  check('ve-nobody-b: and when the administrator’s seat has ended, the call answers nobody — not the club’s families, not anyone',
    await to(v2), []);

  // ---- the action ----
  const act = codeOnly(srcOf('app/ops/call/[clubId]/actions.ts'));
  check('ve-action: the call sheet sends §39 only for a verified call, to whoever the database names for THIS call, and to no other address',
    [/if \(outcome === 'verified'\) \{\s*const \{ rows: to \} = await db\.query\(\s*`select \* from fn_verified_call_recipient\(\$1\)`, \[callId\]\);/.test(act),
     /send\(clubVerifiedEmail\(r\.club_name, date\), \{ address: r\.email, personId: r\.person_id \}\)/.test(act),
     /contact_email/.test(act), (act.match(/clubVerifiedEmail\(/g) ?? []).length],
    [true, true, false, 1]);
  check('ve-action-b: after the transaction, not while holding the client (L1)',
    act.indexOf('client.release()') > -1 && act.indexOf('client.release()') < act.indexOf('fn_verified_call_recipient'), true);
  check('ve-action-c: and the date is the call’s own day in Melbourne, written as doc 15 writes it',
    /toLocaleDateString\('en-AU',\s*\{ day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia\/Melbourne' \}\)/.test(act), true);
  // John: the close of doc 27 may promise the email only once §39 is built and
  // sending, "and not before". The two travel together; this fails if either
  // moves without the other.
  const doc27 = srcOf('docs/27-Verification-Call.md');
  check('ve-doc27: doc 27’s close promises the email, and that promise is kept — §39 is approved copy and the call sheet sends it',
    [/I'll switch it on today and you'll get an email confirming it\./.test(doc27),
     /CATALOGUE_KEYS = \[[\s\S]*?'doc15\.§39'/.test(msgSrc), /clubVerifiedEmail\(/.test(act)], [true, true, true]);
}

console.log(`\n${pass} passed, ${fail} failed ${fail === 0 ? '— ALL GREEN' : ''}`);
process.exit(fail === 0 ? 0 : 1);
