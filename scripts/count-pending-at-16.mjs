// How many children have turned 16 since launch with a change still waiting
// on a guardian (John, 3 Oct, N-5 §2.7: "Count first (read-only) … If any
// have, their pages are showing unreviewed content now. Fix those first, and
// tell me the number."). BUZ runs it against production BEFORE 0174 goes on.
//
//   node --env-file=.env.production-db.local scripts/count-pending-at-16.mjs --ca supabase/prod-ca.crt
//   ... --since 2026-09-30     # the Melbourne date to count from (default: launch, 30 Sep)
//
// Plans only. It runs one read-only transaction, changes nothing, and prints
// counts and nothing else — never a name, a date of birth, an id or a word
// of anyone's page. It works on a database at 0173 or later: it reads only
// columns that existed before 0174.
//
//   turned16  turned 16 (Melbourne) on or after --since and on or before
//             today, with a record that existed before the birthday (kept
//             under 16) — every page 0174 holds at its last approved version
//   waiting   of those, with a waiting version still on the record — the
//             number John asked for: their unreviewed change is the page
//             every link-holder opens until 0174 is live
//   linked    of those waiting, with a live share link — someone outside the
//             family can open it today
//   none      of those waiting, with NO approved version at all — after 0174
//             their link and club pages serve nothing until their own write
//
// Same connection rules as scripts/apply-migrations.mjs: SUPABASE_DB_URL,
// never printed; TLS verified against --ca for anything that is not local.
import pg from 'pg';
import { readFileSync } from 'node:fs';

// Exported shape for the permission suite (pc16-1), which runs the same
// statement against its own database: one source for the count.
export const COUNT_PENDING_AT_16 = `
  with turned as (
    select dr.id as record_id
      from person p
      join development_record dr on dr.person_id = p.id
     where p.dob is not null
       and (p.dob + interval '16 years')::date >= $1::date
       and (p.dob + interval '16 years')::date <= (now() at time zone 'Australia/Melbourne')::date
       and (dr.created_at at time zone 'Australia/Melbourne')::date < (p.dob + interval '16 years')::date
  ),
  waiting as (
    select t.record_id from turned t
     where exists (select 1 from profile_version pv where pv.record_id = t.record_id and pv.status = 'pending')
  )
  select (select count(*)::int from turned) as turned16,
         (select count(*)::int from waiting) as waiting,
         (select count(*)::int from waiting w where exists (
            select 1 from share_token st where st.record_id = w.record_id and st.revoked_at is null
               and st.paused = false and (st.expires_at is null or st.expires_at > now()))) as linked,
         (select count(*)::int from waiting w where not exists (
            select 1 from profile_version pv where pv.record_id = w.record_id and pv.status = 'approved')) as none`;

// Run only when called as a script, so the suite can import the statement
// without a connection string.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const val = (flag) => { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : null; };
  const since = val('--since') ?? '2026-09-30';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) { console.error('refusing: --since must be a date, YYYY-MM-DD'); process.exit(1); }
  if (process.argv.includes('--apply')) { console.error('refusing: this script only counts; there is nothing to apply'); process.exit(1); }

  const raw = process.env.SUPABASE_DB_URL;
  if (!raw) { console.error('refusing: SUPABASE_DB_URL is not set (load it with node --env-file=<file>; never paste it)'); process.exit(1); }
  const url = new URL(raw);
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  url.searchParams.delete('sslmode');
  let ssl;
  if (!local) {
    const ca = val('--ca');
    if (!ca) { console.error('refusing: a remote database needs --ca <Supabase CA certificate file> so the server is verified'); process.exit(1); }
    ssl = { ca: readFileSync(ca, 'utf8'), rejectUnauthorized: true };
  }

  const client = new pg.Client({ connectionString: url.toString(), ssl, application_name: 'pitch-count-pending-at-16' });
  await client.connect();
  try {
    // Read-only, so even a mistake here cannot write.
    await client.query('begin read only');
    const c = (await client.query(COUNT_PENDING_AT_16, [since])).rows[0];
    await client.query('rollback');
    console.log(`host ${url.hostname} · database ${url.pathname.slice(1)} · counting from ${since} (Melbourne)`);
    console.log(`turned16  turned 16 since then, page kept under 16: ${c.turned16}`);
    console.log(`waiting   of those, with a change still waiting on a guardian: ${c.waiting}`);
    console.log(`linked    of those waiting, with a live share link: ${c.linked}`);
    console.log(`none      of those waiting, with no approved version: ${c.none}`);
    console.log('plan only. Nothing changed.');
  } finally {
    await client.end();
  }
}
