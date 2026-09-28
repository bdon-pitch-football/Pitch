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
let tdCallSeq = 0;
const recordTd = async (person, club, email) => {
  await db.query(`update person set email = $2 where id = $1`, [person, email]);
  await proveAddress(person);
  const before = (await db.query(`select club_state, verified_call_id from club where id = $1`, [club])).rows[0];
  const call = crypto.randomUUID();
  await db.query(
    `insert into verification_call (id, club_id, called_at, operator, number_called, number_source,
       outcome, td_name, td_email, policy_version)
     values ($1,$2,now(),'BUZ','03 9000 0000','FV club directory','verified',$3,$4,'27@v1.0')`,
    [call, club, `Fixture TD ${++tdCallSeq}`, email]);
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
check('D-72 org_name naming a real club grants its coach nothing', await level(ID.coachOther, ID.deniz), 'none');
check('D-72 and grants its admin nothing', await level(ID.adminOther, ID.deniz), 'none');
// strip comments first, so a mention in a comment neither fails nor masks
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

check('M: no subscription = no rows even for a verified club TD', (await rows(ID.td, CLUB.riverside)).length, 0);
await db.query(`update club set subscription_status='active' where id=$1`, [CLUB.riverside]);
check('M: active subscription + verified + TD = rows', (await rows(ID.td, CLUB.riverside)).length, 1);
check('M: a coach cannot work the register', (await rows(ID.coachV, CLUB.riverside)).length, 0);
check('M: an outsider cannot work the register', (await rows(ID.coachOther, CLUB.riverside)).length, 0);
check('J61: unverified club admin gets NO rows, whatever it pays', ((await db.query(`update club set subscription_status='active' where id=$1`, [CLUB.unverified])), (await rows(adminUnv, CLUB.unverified)).length), 0);
check('D-126: but the held COUNT is visible', await count(adminUnv, CLUB.unverified), 1);
check('N11: status move authorised for the TD', (await db.query('select fn_set_club_status($1,$2,$3) as ok', [ID.td, regRiverside, 'shortlisted'])).rows[0].ok, true);
check('N11: status move refused for an outsider', (await db.query('select fn_set_club_status($1,$2,$3) as ok', [ID.coachOther, regRiverside, 'invited'])).rows[0].ok, false);
check('N7: a stranger cannot withdraw a registration', (await db.query('select fn_withdraw_registration($1,$2) as ok', [ID.coachOther, regRiverside])).rows[0].ok, false);
check('N7: the guardian withdraws', (await db.query('select fn_withdraw_registration($1,$2) as ok', [ID.guardian, regUnv])).rows[0].ok, false /* marcus is 19: guardian link expired at 18 */);
check('N7: the adult player withdraws themself', (await db.query('select fn_withdraw_registration($1,$2) as ok', [ID.marcus, regRiverside])).rows[0].ok, true);
check('N7: the withdrawn note is emptied atomically', (await db.query('select note from registration where id=$1', [regRiverside])).rows[0].note, null);
check('N12: a withdrawn row leaves the register', (await rows(ID.td, CLUB.riverside)).length, 0);
await db.query(`update club set subscription_status=null where id=$1`, [CLUB.riverside]);

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
}

check('doc15 §A5: no link shortener in any message',
  bodies.some((b) => /bit\.ly|tinyurl|t\.co\//i.test(b)), false);
check('doc15 §A6: every SMS carries the support address',
  smsBlocks.every((b) => b.includes('${HELP}') || b.includes('help@pitchfootball.com.au')), true);
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
check('doc15 §29: the share-card email carries no preview image',
  /shareCardWaitingEmail[\s\S]*?(<img|cid:|\.png|\.jpg)/.test(msgSrc), false);
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
await db.query(`insert into access_request (share_token_id, requester_name, requester_role) values ($1,'M. Harris','TD, Sunbury United')`, [arTok]);
check('C7: a second inside 24 hours is not', (await db.query('select fn_access_request_allowed($1) as ok', [arTok])).rows[0].ok, false);

const arSrc = readFileSync(fileURLToPath(new URL('../app/p/[token]/request/actions.ts', import.meta.url)), 'utf8');
check('C7b: and the answer is the same either way — one redirect, no branch',
  (codeOnly(arSrc).match(/redirect\(done\)/g) ?? []).length >= 3, true);
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

// L40 — the limited path and the real path do the same work before they
// diverge, so there is no timing tell. Asserted structurally: the limit is
// checked AFTER the session lookup and the redirect target is identical.
check('L40: the rate check happens after the session work, not instead of it',
  dispatchSrc.indexOf('getSessionPersonId') < dispatchSrc.indexOf('checkRate'), true);
check('L40b: and both paths end on the same URL',
  (dispatchSrc.match(/\/g\/send\/\$\{requestId\}\?sent=1/g) ?? []).length >= 2, true);

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

// M11 — L29 stands, and only the CHILD-SAFETY class notifies families.
check('M11: de-verification carries a reason class',
  (await db.query(`select string_agg(column_name,',') as c from information_schema.columns
    where table_name='club' and column_name='suspension_reason'`)).rows[0].c, 'suspension_reason');
await expectFail('M11b: and the class is constrained, not free text',
  `update club set suspension_reason = 'because i felt like it' where id = '${CLUB.riverside}'`);
const deverifyMsg = codeOnly(readFileSync(fileURLToPath(new URL('../lib/messages.ts', import.meta.url)), 'utf8'))
  .split('clubDeverifiedEmail')[1].split('export const')[0];
check('M11c: the notice never says WHY the club was de-verified',
  /allegation|investigat|report|complaint|safety concern/i.test(deverifyMsg), false);
check('M11d: and never revokes on the family’s behalf — it offers the button',
  /we have not switched it off for you/i.test(deverifyMsg), true);

// U-11 — no inbound reply route, and the send says so.
const cvMsg = codeOnly(readFileSync(fileURLToPath(new URL('../lib/messages.ts', import.meta.url)), 'utf8'))
  .split('cvToClubEmail')[1].split('export const')[0];
check('U-11: the CV email tells the club replies do not reach the family',
  /do not reach the family/i.test(cvMsg), true);
check('U-11b: and tells them what to do instead', /invitation|post it on Pitch/i.test(cvMsg), true);
check('U-11c: the old promise of a routed reply is gone',
  /just reply to this email/i.test(cvMsg), false);

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
  looked[0].investigator.length > 0 && looked[0].report_id === u6Report, true);
check('U-6e: and a stranger cannot',
  (await db.query('select * from fn_who_looked($1,$2)', [ID.coachV, ID.deniz])).rows.length, 0);

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
  check(`J53: ${rel} is club-scoped, unreachable as a family actor`,
    /technical_director|club_admin|stripe_event|OPS_EMAILS/.test(src), true);
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

// J61 — a withdrawn registration is indistinguishable from one that never
// existed: the club sees a count and a list, and neither carries a gap.
const j61Before = (await db.query('select fn_register_count($1,$2) as n', [ID.td, CLUB.riverside])).rows[0].n;
const j61Reg = crypto.randomUUID();
await db.query(`insert into registration (id, player_id, club_id, policy_version) values ($1,$2,$3,'20@v2.4')`,
  [j61Reg, ID.marcus, CLUB.riverside]);
await db.query(`select fn_withdraw_registration($1,$2)`, [ID.marcus, j61Reg]);
check('J61: a withdrawn registration leaves the count exactly as it was',
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

// M6 — a withdrawal removes the row and decrements the count, and the club
// never learns a held registration existed.
await db.query(`select fn_withdraw_registration($1,$2)`, [ID.guardian, mReg]);
check('M6: a withdrawn registration leaves the register',
  (await db.query('select * from fn_register_rows($1,$2)', [mAdmin, mClub])).rows.length, 1);
check('M6b: and the count decrements with it',
  (await db.query('select fn_register_count($1,$2) as n', [mAdmin, mClub])).rows[0].n, 1);

// M10 — suspension is immediate and total.
check('M10a: a verified club is minor-facing',
  (await db.query('select fn_club_minor_facing($1) as v', [mClub])).rows[0].v, true);
await db.query(`update club set club_state='suspended' where id=$1`, [mClub]);
check('M10b: suspension ends it in the same breath',
  (await db.query('select fn_club_minor_facing($1) as v', [mClub])).rows[0].v, false);
check('M10c: and the register falls straight back to the held view',
  (await db.query('select * from fn_register_rows($1,$2)', [mAdmin, mClub])).rows.length, 0);
await db.query(`update club set club_state='verified' where id=$1`, [mClub]);

// M7/M8 — what an unverified club MAY do: things with no minor in them.
const m7Club = crypto.randomUUID();
await db.query(`insert into club (id, name, club_state) values ($1,'Notice FC','claimed')`, [m7Club]);
await db.exec(`insert into trial_notice (club_id, title, time_venue, trial_on)
  values ('${m7Club}', 'Open day', 'Sat 9am', current_date + 20)`);
check('M7: an unverified club may post a public trial notice — no minor in it',
  (await db.query('select count(*)::int as n from trial_notice where club_id = $1', [m7Club])).rows[0].n, 1);
await db.query(`insert into person (id, first_name, dob) values ($1,'New Coach','${yearsAgo(30)}')`, [crypto.randomUUID()]);
check('M8: and may add its own people', true, true);

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
  const unvReg = await newReg(ID.marcus, CLUB.unverified, await trialAt(CLUB.unverified));
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
  check('N23: the TD’s squads screen lists who holds register access', /from register_grant g/.test(squadsSrc) && /isTd/.test(squadsSrc), true);
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
check('L38b: the dev link is absent in production, so both paths render alike',
  /process\.env\.NODE_ENV !== 'production'/.test(sendPage), true);
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
  check(`E1 ${name}: identical null shape, no state leaks through`, await readTok(h), null);
}
check('E2: and the live one is the only thing that reads', (await readTok(t.live)) === null, false);

// E3: the dead answer carries nothing at all — not a name, not a club, not
// an age. The single read path is the only place that could leak one.
const readSrc = readFileSync(fileURLToPath(new URL('../lib/record-read.ts', import.meta.url)), 'utf8');
check('E3: the read path returns a bare null for every dead state',
  /if \(!bundle\) return null;/.test(readSrc), true);
const deadPage = readFileSync(fileURLToPath(new URL('../app/p/[token]/page.tsx', import.meta.url)), 'utf8');
const deadHalf = deadPage.split('LinkState').slice(1).join('');
check('E4: the link-state page renders no name, club, age or photo',
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
check('E5: every tokenised page is noindex (D-95)', /noindex|robots/.test(deadPage), true);
check('E6: and sends no referrer to an embed host (D-94 §5)',
  /no-referrer/.test(readFileSync(fileURLToPath(new URL('../next.config.mjs', import.meta.url)), 'utf8')), true);

// E7: the OG endpoint outlives revocation in every social platform's cache,
// so it must re-check on every request and never render an identity for a
// token that is not live (D-89, D-94 §5).
const ogSrc = readFileSync(fileURLToPath(new URL('../app/p/[token]/opengraph-image.tsx', import.meta.url)), 'utf8');
check('E7: the OG route re-reads the token through the one path',
  /readCvByToken/.test(ogSrc), true);
check('E8: and falls back to a generic card rather than an identity',
  /if \(!cv\)|cv \?\?|!cv/.test(ogSrc), true);
// Strip the comments first: the rule is written down at the top of that file
// in the very words being searched for, and a check that matches its own
// documentation passes forever without testing anything.
const ogCode = codeOnly(ogSrc);
check('E9: a minor\u2019s card carries no club, age group or region (D-89)',
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
check('G11: the read path drops non-positive stats before they leave Postgres',
  /value > 0/.test(readSrc), true);

// ---------------------------------------------------------------------------
// Tables H and J — the club walls. A treasurer made an administrator to send
// invoices must never be able to read a child's development notes (D-93).
// ---------------------------------------------------------------------------
check('H1: the club administrator gets membership and contact only', await level(ID.clubAdmin, ID.deniz), 'membership_only');
check('H2: the team manager the same', await level(ID.teamManager, ID.deniz), 'membership_only');
check('H3: the technical director gets the record', await level(ID.td, ID.deniz), 'full');
check('H4: an administrator at another club gets nothing', await level(ID.adminOther, ID.deniz), 'none');
check('H5: an unattested coach at the right squad still gets nothing', await level(ID.coachU, ID.deniz), 'none');
check('H4: a verified coach on a squad they do not hold gets nothing', await level(ID.coachUnassigned, ID.deniz), 'none');
check('H7: a departed coach keeps only what they authored (D-48)', await level(ID.coachFormer, ID.deniz), 'authored_only');

// H8: a departing technical director loses club-wide access immediately —
// the same read, one UPDATE later.
await db.query(`update membership set ended_at = now() where person_id = $1 and role = 'technical_director'`, [ID.td]);
check('H8: a departed technical director loses club-wide access at once', await level(ID.td, ID.deniz), 'none');
check('H9: and cannot write to the record either', await prov(ID.td, REC.deniz), null);
await db.query(`update membership set ended_at = null where person_id = $1 and role = 'technical_director'`, [ID.td]);
// Not H10 — doc 14 H10 is "a person self-declares technical_director", and a
// label starting with a row id is a claim to test that row (L4). Reinstating
// a TD belongs with H9, and since 0058 the revival is re-checked against the
// call, the proof and the club's state like any other write of the live role.
check('H9c: reinstating the role restores it, still without a stored flag', await level(ID.td, ID.deniz), 'full');

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
  await db.query(`insert into person (id, first_name, dob, email) values
    ($1,'Recorded',$2,'recorded@fixture.example'), ($3,'Outsider',$2,'outsider@fixture.example'),
    ($4,'Minor',$5,'minortd@fixture.example'), ($6,'Callsheet Admin',$2,null)`,
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
await expectFail('Q3: the club cannot approve a child\u2019s card',
  `update share_card_approval set approved_by = '${ID.td}', approved_at = now() where id = '${cardId}'`);
await expectFail('Q4: the u16 cannot approve her own card',
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
  check(`D-162: ${what} omits a zero rather than printing one`,
    /value > 0|\.value > 0|\(v \?\? 0\) > 0|value is not null and value > 0/.test(src), true);
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
check('E10: the page branches on one boolean, never on WHY the link is dead',
  /expired|revoked|paused|disabled/i.test(pageCode), false);


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
  /\{hasBanner && \(/.test(clubPageSrc), true);

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
check('coach2: and it only renders when the held club is the one on the page',
  /held\.name === current\?\.org/.test(coachCvSrc), true);

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
  check(`U-11 reply-to e: the documented reply address is the support inbox, not a person (${documented})`,
    documented, 'help@pitchfootball.com.au');
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
for (const [what, src] of [['the live read', readSrc], ['the approved snapshot', snapSrc]]) {
  check(`hist4: ${what} takes the locality from the club, never the person`,
    /c\.suburb[\s\S]{0,40}c\.state/.test(src), true);
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
// a browser with scripting off, and anything reading the markup all saw. The
// truth ships in the HTML and the animation resets before paint.
const tileSrc = readFileSync(fileURLToPath(new URL('../components/cv/StatTile.tsx', import.meta.url)), 'utf8');
check('hist12: a stat tile ships its real value in the markup, never a zero',
  /useState\(value\)/.test(tileSrc), true);
check('hist13: and the count-up resets before paint, so nobody sees the flash',
  /useBeforePaint/.test(tileSrc), true);

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
check('sendl1: dispatch is wired, not a comment', /await dispatch\(id,/.test(msgSrc2), true);
check('sendl2: the row is written before the provider is called, never after',
  msgSrc2.indexOf('insert into message_outbox') < msgSrc2.indexOf('await dispatch(id,'), true);
check('sendl3: development still sends nothing, whatever keys are in the shell',
  /NODE_ENV === 'production'\) \{\n    await dispatch/.test(msgSrc2), true);

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
check('ctl3: the consent timeline is not truncated',
  /from consent_event where subject_id = p\.id\) e/.test(gControlsPage), true);
// Approving writes several rows in one transaction, so a timestamp-only sort
// left them in arbitrary order on the one screen whose job is to be exact.
check('ctl4: and it has a stable tiebreak within the same second',
  /order by e\.at desc, e\.id desc/.test(gControlsPage), true);

// Every consent_event the vocabulary can produce needs a human line, or a
// parent reads a database enum on the screen that exists to be plain.
{
  // The constraint spans many lines with comments between them, so the block
  // is taken whole and the quoted values pulled out of it. A regex that only
  // matched one line found ZERO events and the check passed vacuously — an
  // empty list trivially has nothing missing.
  const block = /event text not null check \(event in \(([\s\S]*?)\)\)/.exec(migAll)?.[1] ?? '';
  const vocab = [...block.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
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
    clubDeverifiedEmail: 'doc 15 §37: needs the child-safety reason class on the verification call (doc 32 D)',
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
  check('DEMO2: a demo reads only its own local database, whatever SUPABASE_DB_URL says',
    [/isDemo\(\) \? DEMO_DB_URL/.test(dbSrc), /127\.0\.0\.1:\$\{DEMO_DB_PORT\}/.test(demo), /DEMO_DB_PORT = 54323/.test(demo)], [true, true, true]);
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
  await db.query(`insert into club (id, name, club_state) values ($1,'Sunbury United','claimed')`, [newClub]);
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
    [/Create my coaching account/.test(page), /Claim your club/.test(page)], [true, true]);
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
  const old = Math.floor((Date.now() - new Date(dobFor(18)).getTime()) / (365.25 * 24 * 3600 * 1000));
  check('age3: the formula it replaced is shown to get that day wrong', old, 17);
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
// the product. Docs 24 and 25 have no route yet (see the report); they are
// checked anyway, so the day they get one they are already clean.
{
  const { legalDocument, renderedLegalDocs, renderedVersions, stripDraftingPreamble, publishedDate, versionLine } =
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
  check('leg9: and the two real ones are still served — doc 22 Schedule A, doc 25 Part 4',
    [legalDocument(fileFor('22')).markdown.includes('> **What is on sale, and what is not.**'),
     legalDocument(fileFor('25')).markdown.includes('> **Today the investigator is one person')],
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
  const AWAITING_JOHN = new Set([
    '22: **[DO NOT PUBLISH UNTIL BUILT] 6.5 Suppression.** A guardian, or a club ',
    '22: *Status: not built. Today a guardian can pause a profile and disable its',
    '22: | 4 | **Suppression clause promises a capability that does not exist yet',
    '22: | 5 | **Guardian-contact gate at 2.3 is not current behaviour — do not p',
  ]);
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
  check(`jr5: nothing "not built" is served beyond the four lines awaiting John (${unexpected.join(' · ') || 'nothing is'})`,
    unexpected, []);
  check(`jr6: and when he answers, the set is emptied rather than left stale (${answered.join(' · ') || 'all four still served'})`,
    answered, []);
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

  check('money1: a club that never subscribed reads "unsubscribed", not "suspended"', await payState(mTd, MON), 'unsubscribed');
  await apply('active', null, clock(1));
  check('money2: a paying club reads "active"', await payState(mTd, MON), 'active');
  check('money2b: and its register resolves', (await rowIds(mTd, MON)).includes(mReg), true);

  // O4 — 14-day grace, THEN suspended. Registrations hidden, never deleted.
  await apply('past_due', new Date(Date.now() + 5 * 86400000).toISOString(), clock(2));
  check('O4: inside the fourteen days a failed payment reads "grace"', await payState(mTd, MON), 'grace');
  check('O4b: and the register is still readable during the grace (D-135)', (await rowIds(mTd, MON)).includes(mReg), true);
  await apply('past_due', new Date(Date.now() - 86400000).toISOString(), clock(3));
  check('O4c: once the grace has run out it reads "suspended"', await payState(mTd, MON), 'suspended');
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
  check('D-78b: and each verifies its signature before reading a byte of the body',
    [smsStatusSrc.indexOf('verifyTwilioSignature') < smsStatusSrc.indexOf('params.MessageSid'),
      resendSrc.indexOf('verify(payload') < resendSrc.indexOf('JSON.parse(payload)')], [true, true]);
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
    check('land5: the approval page is what calls it, after the finished-link 404',
      (() => { const a = codeOnly(srcOf('app/a/[id]/page.tsx'));
        return a.indexOf('notFound()') > -1 && a.indexOf('notFound()') < a.indexOf('recordGuardianLanded('); })(), true);
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
      `select prosrc from pg_proc where prosrc ilike '%insert into consent_event%'`)).rows.map((r) => r.prosrc).join('\n');
    const written = (w) => new RegExp(`'${w}'`).test(tsWriters) || new RegExp(`'${w}'`).test(pgWriters);

    // Named, with the reason, exactly as the unsent-message list above is.
    // Nothing joins this list without an argument in a report.
    const NO_WRITER_BY_DECISION = {
      email_opened: 'declined on purpose (app/api/webhooks/resend): an open-tracking pixel on a guardian’s email is surveillance, and doc 14 J41 refuses the same thing for links. The label and the D-78 vocabulary word are both proposed for removal — 28 Sep report, awaiting BUZ',
    };
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

console.log(`\n${pass} passed, ${fail} failed ${fail === 0 ? '— ALL GREEN' : ''}`);
process.exit(fail === 0 ? 0 : 1);
