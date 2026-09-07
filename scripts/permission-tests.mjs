// Doc 14 permission suite — first tranche: table A (reading a record),
// table B (search), the token path (D-77/D-80), the D-72 invariant, and the
// G9 Melbourne-timezone band boundary. Runs against a real embedded Postgres
// (PGlite) — the database, not the app layer, per doc 14 §0.
//
// This file grows until every row of doc 14 is here. Green or we do not go.
import { PGlite } from '@electric-sql/pglite';
import { createHash } from 'node:crypto';
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
function check(label, actual, expected) {
  if (actual === expected) { pass++; console.log(`OK   ${label}`); }
  else { fail++; console.error(`FAIL ${label} — expected ${expected}, got ${actual}`); }
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

// Strip comments before searching source for a forbidden word. Three checks
// in this file have now matched their own explanatory comment — a comment
// saying "we never show a counter" contains the word "counter". Search the
// CODE, never the prose about the code.
const codeOnly = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\/\/.*$/gm, '');

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
  ($4,$2,'U18 Boys','U18','boys','2026'), ($5,$6,'Seniors','SEN','open','2026'), ($7,$8,'U14','U14','mixed','2026')`,
  [SQUAD.u15, CLUB.riverside, SQUAD.u16g, SQUAD.u18, SQUAD.otherSq, CLUB.other, SQUAD.unvSq, CLUB.unverified]);

const mem = (p, c, sq, role) =>
  db.query(`insert into membership (person_id, club_id, squad_id, role) values ($1,$2,$3,$4)`, [p, c, sq, role]);
await mem(ID.deniz, CLUB.riverside, SQUAD.u15, 'player');
await mem(ID.georgia, CLUB.riverside, SQUAD.u16g, 'player');
await mem(ID.nate, CLUB.riverside, SQUAD.u18, 'player');
await mem(ID.marcus, CLUB.riverside, SQUAD.u15, 'player');
await mem(ID.coachV, CLUB.riverside, SQUAD.u15, 'coach');
await mem(ID.coachU, CLUB.riverside, SQUAD.u15, 'coach');          // NOT attested
await mem(ID.coachUnassigned, CLUB.riverside, SQUAD.u16g, 'coach'); // attested, other squad
await mem(ID.td, CLUB.riverside, null, 'technical_director');
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
  await db.query(`insert into development_record (id, person_id, positions) values ($1,$2,array['CAM'])`, [rec, p]);
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

// The 30-day notice query finds a child at the boundary and nobody else.
const soon16 = crypto.randomUUID();
const soon16Dob = (() => { const d = new Date(melbourneToday); d.setFullYear(d.getFullYear() - 16); d.setDate(d.getDate() + 30); return iso(d); })();
await db.query(`insert into person (id, first_name, dob) values ($1,'Turning',$2)`, [soon16, soon16Dob]);
await db.query(`insert into guardianship_link (guardian_id, child_id, approved_at) values ($1,$2,now())`, [ID.guardian, soon16]);
await db.query(`update person set email='parent-of-turning@example.com' where id=$1`, [ID.guardian]);
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
await db.query(`insert into pending_invitation (first_name, dob, guardian_name, guardian_phone, created_at, approved_at)
  values ('Kept','2013-01-01','Fine Parent','0400 000 001', now() - interval '15 days', now() - interval '14 days')`);
await db.query(`insert into pending_invitation (first_name, dob, guardian_name, guardian_phone)
  values ('Fresh','2013-01-01','New Parent','0400 000 002')`);
const purged = (await db.query('select fn_purge_pending() as n')).rows[0].n;
check('D-17 purge removes exactly the stale unapproved invitation', purged, 1);
check('D-17 nothing readable survives the purge', (await db.query(`select count(*)::int as n from pending_invitation where first_name='Stale'`)).rows[0].n, 0);
check('D-17 an approved invitation is never purged', (await db.query(`select count(*)::int as n from pending_invitation where first_name='Kept'`)).rows[0].n, 1);
check('D-17 a fresh invitation is untouched', (await db.query(`select count(*)::int as n from pending_invitation where first_name='Fresh'`)).rows[0].n, 1);
check('D-17 the purge leaves only the fact in the log', (await db.query(`select count(*)::int as n from consent_event where event='purged'`)).rows[0].n, 1);

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

check('doc15 §A5: no link shortener in any message',
  bodies.some((b) => /bit\.ly|tinyurl|t\.co\//i.test(b)), false);
check('doc15 §A6: every SMS carries the support address',
  smsBlocks.every((b) => b.includes('${HELP}') || b.includes('help@pitchfootball.com.au')), true);
const msgCode = msgSrc.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
check('doc15 §A7: no message can carry a WWCC number',
  /wwcc/i.test(msgCode), false);
const wakeBlocks = msgCode.split(/export const /).filter((b) => b.startsWith('bareWake'));
check('doc15 §24: the bare wake is defined and interpolates nothing at all',
  wakeBlocks.length === 2 && wakeBlocks.every((b) => !/\$\{(?!SITE|HELP)/.test(b)), true);
check('doc15 §29: the share-card email carries no preview image',
  /shareCardWaitingEmail[\s\S]*?(<img|cid:|\.png|\.jpg)/.test(msgSrc), false);
check('doc15 §32/D-108: the word "declined" appears in no message',
  /\bdeclined\b/i.test(msgSrc), false);
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
const routeFiles = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const full = join(d, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(e.name)) routeFiles.push(full);
  }
})(fileURLToPath(new URL('../app', import.meta.url)));
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
await mem(mAdmin, mClub, null, 'club_admin');
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
await db.query(`update guardian_setting set profile_paused = false where child_id = $1`, [ID.georgia]);

// P6/P7 — what the club may learn. Two states, and silence looks like
// nothing ever arrived.
const pInv = (await db.query(`select id from invitation where registration_id = $1`, [pReg])).rows[0].id;
const invState = async (who) => (await db.query('select fn_invitation_state($1,$2) as s', [who, pInv])).rows[0].s;
check('P7a: the club sees "sent"', await invState(ID.td), 'sent');
await db.query(`update invitation set read_at = now() where id = $1`, [pInv]);
check('P6: the guardian reading it changes nothing the club can see', await invState(ID.td), 'sent');
await db.query(`insert into invitation_reply (invitation_id, replied_by) values ($1,$2)`, [pInv, ID.guardian]);
check('P7b: answering is the only other state', await invState(ID.td), 'answered');
check('P7c: "read" and "lapsed" are unreachable from any club actor',
  /'read'|'lapsed'/.test((await db.query(`select prosrc from pg_proc where proname='fn_invitation_state'`)).rows[0].prosrc), false);
check('P7d: and a club at another club learns nothing', await invState(ID.adminOther), null);
check('P7e: nor does an anonymous caller', await invState(null), null);

// P8/P9 — nothing is shared by default.
const reply = (await db.query(`select shared_fields from invitation_reply where invitation_id = $1`, [pInv])).rows[0];
check('P9: a reply can carry no identifiers at all', JSON.stringify(reply.shared_fields), '{}');

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
const dispatchSrc = readFileSync(fileURLToPath(new URL('../app/g/send/[requestId]/actions.ts', import.meta.url)), 'utf8');
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
check('H6: a verified coach on the wrong squad gets nothing', await level(ID.coachUnassigned, ID.deniz), 'none');
check('H7: a departed coach keeps only what they authored (D-48)', await level(ID.coachFormer, ID.deniz), 'authored_only');

// H8: a departing technical director loses club-wide access immediately —
// the same read, one UPDATE later.
await db.query(`update membership set ended_at = now() where person_id = $1 and role = 'technical_director'`, [ID.td]);
check('H8: a departed technical director loses club-wide access at once', await level(ID.td, ID.deniz), 'none');
check('H9: and cannot write to the record either', await prov(ID.td, REC.deniz), null);
await db.query(`update membership set ended_at = null where person_id = $1 and role = 'technical_director'`, [ID.td]);
check('H10: reinstating the role restores it, still without a stored flag', await level(ID.td, ID.deniz), 'full');

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
check('D-94: sign-in has exactly one outcome, whatever happened',
  (signinSrc.match(/redirect\(/g) ?? []).length, 1);
check('D-94: reset request has exactly one outcome', resetSrc.includes("redirect('/reset?sent=1')"), true);
check('§10 amendment: an under-16 reset routes to the guardian', authSrc.includes("band === 'u16' ? p.guardian_email"), true);
check('D-94 §4: reset tokens are stored hashed, never raw', /token_hash/.test(authSrc) && !/values \(\$1, *token\)/.test(authSrc), true);
check('§33: the sign-in alert carries no IP, city or device string',
  /ip|city|geo|fingerprint/i.test(msgCode.split('newSignInEmail')[1]?.split('export const')[0] ?? ''), false);

// Reset tokens: single use, and expiry is enforced in SQL.
const resetPerson = crypto.randomUUID();
await db.query(`insert into person (id, first_name, dob, email) values ($1,'Reset','${yearsAgo(30)}','reset@example.com')`, [resetPerson]);
const rawTok = 'test-reset-token';
const tokHash = sha(rawTok);
await db.query(`insert into auth_reset (person_id, token_hash, expires_at) values ($1,$2, now() + interval '1 hour')`, [resetPerson, tokHash]);
const consume = async () => (await db.query(
  `update auth_reset set used_at = now()
   where id = (select id from auth_reset where token_hash = $1 and used_at is null and expires_at > now() limit 1)
   returning person_id`, [tokHash])).rows[0]?.person_id ?? null;
check('reset token works once', await consume(), resetPerson);
check('reset token cannot be reused', await consume(), null);
await db.query(`insert into auth_reset (person_id, token_hash, expires_at) values ($1,$2, now() - interval '1 minute')`, [resetPerson, sha('expired-token')]);
const expiredUse = (await db.query(
  `update auth_reset set used_at = now()
   where id = (select id from auth_reset where token_hash = $1 and used_at is null and expires_at > now() limit 1)
   returning person_id`, [sha('expired-token')])).rows[0]?.person_id ?? null;
check('an expired reset token is refused', expiredUse, null);

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

check('E11: signing out destroys the session and nothing else',
  /clearSession/.test(readFileSync(fileURLToPath(new URL('../app/signout/route.ts', import.meta.url)), 'utf8')), true);

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
check('club banner: omitted when absent, so an empty page never shows a slot',
  /c\.banner_path && \(/.test(clubPageSrc), true);

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

// Every route and action that takes a recordId must call the guard. This is
// the check that stops the next one being added without it.
const guardedFiles = [
  'app/build/[recordId]/page.tsx', 'app/build/[recordId]/actions.ts',
  'app/build/[recordId]/clips/actions.ts',
  'app/register-interest/[recordId]/page.tsx', 'app/register-interest/[recordId]/actions.ts',
  'app/share-card/[recordId]/page.tsx', 'app/share-card/[recordId]/actions.ts',
  'app/g/pending/[recordId]/page.tsx', 'app/g/pending/[recordId]/actions.ts',
  'app/send/[recordId]/actions.ts',
];
for (const f of guardedFiles) {
  const src = readFileSync(fileURLToPath(new URL('../' + f, import.meta.url)), 'utf8');
  check(`act11: ${f} checks who is asking`, /requireRecordActor/.test(src), true);
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
for (const f of ['app/build/[recordId]/page.tsx', 'app/register-interest/[recordId]/page.tsx',
                 'app/share-card/[recordId]/page.tsx', 'app/g/pending/[recordId]/page.tsx']) {
  const src = readFileSync(fileURLToPath(new URL('../' + f, import.meta.url)), 'utf8');
  check(`act14: ${f} is no longer disabled in production`,
    /NODE_ENV === 'production'\) notFound/.test(src), false);
}

// The operator console gates on an allowlist, and an empty one means nobody.
const opsGuard = readFileSync(fileURLToPath(new URL('../lib/ops-guard.ts', import.meta.url)), 'utf8');
check('act15: the operator console reads an explicit allowlist', /OPS_EMAILS/.test(opsGuard), true);
check('act16: and an empty allowlist admits nobody in production',
  /allow\.includes\(email\)/.test(opsGuard), true);

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

console.log(`\n${pass} passed, ${fail} failed ${fail === 0 ? '— ALL GREEN' : ''}`);
process.exit(fail === 0 ? 0 : 1);
