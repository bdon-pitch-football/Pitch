// Read-only counts for the guardian hotfix (0177, 0178; John, 3 Oct:
// JOHN-to-LEO-adult-guardian-3-oct.md §3 and JOHN-to-LEO-parent-door-
// findings-3-oct.md §4, C2 and C4). Numbers only: it
// never changes a row and never prints a name, an address, an id or a date
// of birth. BUZ runs it before 0177 ships, and the numbers go to John and
// BUZ.
//
//   node --env-file=.env.production-db.local scripts/count-adult-guardian-links.mjs --ca supabase/rehearsal-ca.crt
//
// What it counts, all since launch (30 Sep 2026, Melbourne):
//   1  exposure     people aged 18+ today with an approved, unrevoked guardian
//                   link; those links; how many carry regranted_at (expected
//                   0: nothing in the product writes it); re-grants ever.
//   2  acts         things a guardian did to someone who was 18+ at the time:
//                   every consent_event by event name, plus the acts that
//                   carry their actor on the row itself (a link issued, a
//                   setting changed, a registration disclosed or dispatched,
//                   a share card approved, a send dispatched).
//   3  erasures     deletion_requested by someone other than the person. The
//                   person row is gone, so their age cannot be read live:
//                   reported as "unknown", never as zero. The backup answers
//                   it (John §3 step 4). Any whose subject still exists and
//                   was 18+ are counted separately.
//   4  who-looked   of (1), how many adults have any investigation_access row.
//                   If this is not zero, John hears before anyone else.
//   C2 invitations  (John, parent-door §4) approved pending_invitation rows:
//                   in total; with child_id null; orphans, whose `approved`
//                   subject no longer exists (an erased child's invitation
//                   left behind); and older than 30 days.
//   C4 new device   (parent-door §5.1) §33 sign-in emails since launch sent
//                   to someone other than an account holder who was 16 or
//                   over at the time; and any whose address is already
//                   cleared, so who received it is unknown.
//
// Run it BEFORE 0177 and 0178: it reads nothing they add.
//
// Same connection rules as scripts/release-counts.mjs: SUPABASE_DB_URL, never
// printed; TLS verified against --ca for anything that is not local; the
// whole read in one `begin read only` transaction, rolled back.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const LAUNCH = '2026-09-30 00:00 Australia/Melbourne';

// "18 or over at that moment", in Melbourne (G9): the 18th birthday's date is
// on or before the moment's Melbourne date.
const adultAt = (dob, at) => `((${dob}) + interval '18 years' <= ((${at}) at time zone 'Australia/Melbourne')::date)`;
// Someone who is or was linked to the person as their guardian.
const wasGuardian = (actor, person) => `exists (select 1 from guardianship_link gl where gl.guardian_id = ${actor} and gl.child_id = ${person})`;

// `q(sql)` returns { rows }. Works with node-postgres and with PGlite, so the
// permission suite runs these exact queries against a fixture world (agc).
export async function adultGuardianCounts(q) {
  const n = async (sql) => Number((await q(sql)).rows[0].n);
  const since = `timestamptz '${LAUNCH}'`;
  const exposure = {
    adults: await n(`select count(distinct g.child_id)::int as n from guardianship_link g join person p on p.id = g.child_id
      where fn_age_band(p.dob) = '18plus' and g.approved_at is not null and g.revoked_at is null`),
    links: await n(`select count(*)::int as n from guardianship_link g join person p on p.id = g.child_id
      where fn_age_band(p.dob) = '18plus' and g.approved_at is not null and g.revoked_at is null`),
    regranted: await n(`select count(*)::int as n from guardianship_link g join person p on p.id = g.child_id
      where fn_age_band(p.dob) = '18plus' and g.approved_at is not null and g.revoked_at is null and g.regranted_at is not null`),
    regrantedEver: await n(`select count(*)::int as n from guardianship_link where regranted_at is not null`),
  };
  // consent_event, by event name (the vocabulary, never a person).
  const events = Object.fromEntries((await q(`select e.event, count(*)::int as n
      from consent_event e join person p on p.id = e.subject_id
     where e.at >= ${since} and e.actor_id is distinct from e.subject_id
       and ${wasGuardian('e.actor_id', 'e.subject_id')} and p.dob is not null and ${adultAt('p.dob', 'e.at')}
     group by e.event order by e.event`)).rows.map((r) => [r.event, Number(r.n)]));
  // The acts that carry their actor on the row.
  const onRow = {
    linksIssued: await n(`select count(*)::int as n from share_token st join development_record dr on dr.id = st.record_id join person p on p.id = dr.person_id
      where st.issued_at >= ${since} and st.issued_by is distinct from p.id and ${wasGuardian('st.issued_by', 'p.id')} and p.dob is not null and ${adultAt('p.dob', 'st.issued_at')}`),
    settingsChanged: await n(`select count(*)::int as n from guardian_setting gs join person p on p.id = gs.child_id
      where gs.updated_at >= ${since} and gs.updated_by is distinct from p.id and ${wasGuardian('gs.updated_by', 'p.id')} and p.dob is not null and ${adultAt('p.dob', 'gs.updated_at')}`),
    registrationsDisclosed: await n(`select count(*)::int as n from registration r join person p on p.id = r.player_id
      where r.created_at >= ${since} and r.disclosed_by is distinct from p.id and ${wasGuardian('r.disclosed_by', 'p.id')} and p.dob is not null and ${adultAt('p.dob', 'r.created_at')}`),
    requestsDispatched: await n(`select count(*)::int as n from registration_request rr join development_record dr on dr.id = rr.record_id join person p on p.id = dr.person_id
      where rr.dispatched_at >= ${since} and rr.dispatched_by is distinct from p.id and ${wasGuardian('rr.dispatched_by', 'p.id')} and p.dob is not null and ${adultAt('p.dob', 'rr.dispatched_at')}`),
    cardsApproved: await n(`select count(*)::int as n from share_card_approval sca join development_record dr on dr.id = sca.record_id join person p on p.id = dr.person_id
      where sca.approved_at >= ${since} and sca.approved_by is distinct from p.id and ${wasGuardian('sca.approved_by', 'p.id')} and p.dob is not null and ${adultAt('p.dob', 'sca.approved_at')}`),
    sendsDispatched: await n(`select count(*)::int as n from share_request sr join development_record dr on dr.id = sr.record_id join person p on p.id = dr.person_id
      where sr.dispatched_at >= ${since} and sr.dispatched_by is distinct from p.id and ${wasGuardian('sr.dispatched_by', 'p.id')} and p.dob is not null and ${adultAt('p.dob', 'sr.dispatched_at')}`),
  };
  const erasures = {
    // The person row is gone: their age at the time cannot be read live.
    unknownAge: await n(`select count(*)::int as n from consent_event e
      where e.event = 'deletion_requested' and e.at >= ${since} and e.actor_id is distinct from e.subject_id
        and not exists (select 1 from person p where p.id = e.subject_id)`),
    adultStillThere: await n(`select count(*)::int as n from consent_event e join person p on p.id = e.subject_id
      where e.event = 'deletion_requested' and e.at >= ${since} and e.actor_id is distinct from e.subject_id
        and p.dob is not null and ${adultAt('p.dob', 'e.at')}`),
  };
  const whoLooked = await n(`select count(distinct g.child_id)::int as n from guardianship_link g join person p on p.id = g.child_id
    where fn_age_band(p.dob) = '18plus' and g.approved_at is not null and g.revoked_at is null
      and exists (select 1 from investigation_grant ig join investigation_access ia on ia.grant_id = ig.id where ig.subject_id = g.child_id)`);
  const approvedLogged = (pi) => `exists (select 1 from consent_event ce where ce.event = 'approved' and ce.detail ->> 'invitation_id' = ${pi}.id::text)`;
  const c2 = {
    approved: await n(`select count(*)::int as n from pending_invitation where approved_at is not null`),
    childIdNull: await n(`select count(*)::int as n from pending_invitation where approved_at is not null and child_id is null`),
    orphans: await n(`select count(*)::int as n from pending_invitation pi where pi.approved_at is not null and ${approvedLogged('pi')}
      and not exists (select 1 from consent_event ce join person p on p.id = ce.subject_id
                       where ce.event = 'approved' and ce.detail ->> 'invitation_id' = pi.id::text)`),
    olderThan30: await n(`select count(*)::int as n from pending_invitation where approved_at is not null and approved_at < now() - interval '30 days'`),
  };
  const sixteenAt = (dob, at) => `((${dob}) + interval '16 years' <= ((${at}) at time zone 'Australia/Melbourne')::date)`;
  const c4 = {
    toAnother: await n(`select count(*)::int as n from message_outbox mo join person p on p.id = mo.to_person
      where mo.message_key = 'doc15.§33' and mo.created_at >= ${since} and p.dob is not null and ${sixteenAt('p.dob', 'mo.created_at')}
        and coalesce(mo.to_address, '') <> '' and lower(mo.to_address) is distinct from lower(p.email)`),
    addressCleared: await n(`select count(*)::int as n from message_outbox mo join person p on p.id = mo.to_person
      where mo.message_key = 'doc15.§33' and mo.created_at >= ${since} and p.dob is not null and ${sixteenAt('p.dob', 'mo.created_at')}
        and coalesce(mo.to_address, '') = ''`),
  };
  return { exposure, events, onRow, erasures, whoLooked, c2, c4 };
}

export function report(c) {
  const lines = [];
  lines.push(`1  adults (18+ today) with a live guardian link: ${c.exposure.adults} · links: ${c.exposure.links} · of those re-granted: ${c.exposure.regranted} · re-grants ever: ${c.exposure.regrantedEver}`);
  const ev = Object.entries(c.events);
  lines.push(`2  consent events by a guardian on someone 18+ at the time: ${ev.reduce((a, [, v]) => a + v, 0)}${ev.length ? ' (' + ev.map(([k, v]) => `${k} ${v}`).join(', ') + ')' : ''}`);
  lines.push(`   on the row itself — links issued ${c.onRow.linksIssued} · settings changed ${c.onRow.settingsChanged} · registrations disclosed ${c.onRow.registrationsDisclosed} · requests dispatched ${c.onRow.requestsDispatched} · share cards approved ${c.onRow.cardsApproved} · sends dispatched ${c.onRow.sendsDispatched}`);
  lines.push(`3  erasures by someone other than the person: age unknown (person row gone; check the backup): ${c.erasures.unknownAge} · subject still there and 18+ at the time: ${c.erasures.adultStillThere}`);
  lines.push(`4  of (1), adults with who-looked rows: ${c.whoLooked}`);
  lines.push(`C2 approved invitations: ${c.c2.approved} · child_id null: ${c.c2.childIdNull} · orphans (child erased, row left): ${c.c2.orphans} · older than 30 days: ${c.c2.olderThan30}`);
  lines.push(`C4 new-device emails to someone else about a person 16+ at the time: ${c.c4.toAnother} · address already cleared (recipient unknown): ${c.c4.addressCleared}`);
  return lines;
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const { default: pg } = await import('pg');
  const raw = process.env.SUPABASE_DB_URL;
  if (!raw) { console.error('refusing: SUPABASE_DB_URL is not set'); process.exit(1); }
  const url = new URL(raw);
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  url.searchParams.delete('sslmode');
  const val = (flag) => { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : null; };
  let ssl;
  if (!local) {
    const ca = val('--ca');
    if (!ca) { console.error('refusing: a remote database needs --ca <Supabase CA certificate file> so the server is verified'); process.exit(1); }
    ssl = { ca: readFileSync(ca, 'utf8'), rejectUnauthorized: true };
  }
  const client = new pg.Client({ connectionString: url.toString(), ssl, application_name: 'pitch-adult-guardian-counts' });
  await client.connect();
  try {
    // Read-only, so even a mistake here cannot write.
    await client.query('begin read only');
    const counts = await adultGuardianCounts((sql) => client.query(sql));
    await client.query('rollback');
    console.log(`host ${url.hostname} · database ${url.pathname.slice(1)} · since ${LAUNCH}`);
    for (const l of report(counts)) console.log(l);
  } finally {
    await client.end();
  }
}
