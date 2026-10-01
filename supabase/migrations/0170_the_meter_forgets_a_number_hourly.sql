-- ---------------------------------------------------------------------------
-- 0170 — the SMS meter forgets a number within 24 hours, every hour (John,
-- 2 Oct, §4, on Leo's addendum 5, item 2; D-81; doc 23 v1.7 "The SMS spend
-- meter … dropped after 24 hours"; 0167, 0169).
--
-- WHY THIS EXISTS. The meter keeps each text's cost and time for the spend
-- cap, and a keyed fingerprint of the number (0169) only for the three-a-day
-- limit (fn_sms_count_24h). Until now the fingerprint went to the zero
-- fingerprint inside the DAILY job (fn_purge_pending, 0167), for rows older
-- than 25 hours. A row sent just after one daily run kept its fingerprint
-- until the run after the next: about 49 hours. Doc 23 says 24. John: "Make
-- the promise true rather than vaguer. Run the scrub hourly, clearing
-- fingerprints older than 23 hours. Then 'dropped after 24 hours' holds in
-- the worst case. A retention line that's true only on average isn't a
-- retention line."
--
-- fn_sms_forget_numbers() is that scrub, and the only one: every row older
-- than 23 hours that still carries a fingerprint goes to the zero
-- fingerprint, the form 0167 and 0169 already use. The cents and the time
-- stay, so the monthly cap still counts every text. It answers how many rows
-- it changed (a count, for the job's log). Idempotent.
--   · The HOURLY outbox job (app/api/jobs/outbox, vercel.json "0 * * * *")
--     calls it on every run, before anything else and in every environment.
--     An hour between runs plus 23 hours is the 24 doc 23 says.
--   · The DAILY job keeps calling it through fn_purge_pending, redefined
--     here to ask this function instead of its own 25-hour statement. It
--     finds nothing the hourly run left; it is a belt, and there is one
--     window, not two.
--
-- What it costs (said so Leo and John can see it): fn_sms_count_24h counts a
-- number's texts in the last 24 hours by fingerprint, so a text 23 to 24
-- hours old that has already been forgotten no longer counts. The per-number
-- limit (D-81: three per number per 24 hours) is three per 23 to 24 hours
-- in the worst case. That is what clearing at 23 hours means.
--
-- No new table, so nothing to enable row-level security on (L26).
-- ---------------------------------------------------------------------------

create function fn_sms_forget_numbers() returns int
language plpgsql as $$
declare n int;
begin
  update sms_meter
     set number_hash = '\x00'::bytea
   where sent_at < now() - interval '23 hours' and number_hash <> '\x00'::bytea;
  get diagnostics n = row_count;
  return n;
end $$;

comment on function fn_sms_forget_numbers() is
  'D-81, doc 23 (0170; John, 2 Oct, §4): the SMS meter''s fingerprint of a number goes after 23 hours. Run hourly by the outbox job, so none is held past 24.';

-- The fourteen-day job, as 0167 left it, but the meter's window is the one
-- above, asked rather than repeated.
create or replace function fn_purge_pending() returns int
language plpgsql as $$
declare
  n int := 0;
  v uuid;
begin
  for v in
    select id from pending_invitation
     where approved_at is null and created_at < now() - interval '14 days'
     order by created_at
  loop
    if fn_purge_pending_invitation(v, jsonb_build_object('reason', 'expired')) then n := n + 1; end if;
  end loop;
  -- The hourly job already does this (0170); here it is a belt.
  perform fn_sms_forget_numbers();
  return n;
end $$;

comment on column sms_meter.number_hash is
  'HMAC-SHA256 of the number under NUMBER_HASH_KEY (0169), kept 23 hours for the per-number limit, then the zero fingerprint, by the hourly job (0170).';

-- The app's own connection asks this; nobody else needs to (0167).
revoke all on function fn_sms_forget_numbers() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function fn_sms_forget_numbers() from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function fn_sms_forget_numbers() from authenticated';
  end if;
end $$;
