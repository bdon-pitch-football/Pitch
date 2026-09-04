-- ============================================================================
-- 0008 · Scheduled work as database functions (testable against the DB,
-- called by a thin cron route).
-- fn_purge_pending (D-17): an unapproved pending invitation self-destructs
-- at 14 days — first name, DOB, guardian contact, all of it. The consent
-- log keeps only the fact a purge happened (no name, no contact).
-- ============================================================================
create function fn_purge_pending() returns int
language plpgsql as $$
declare n int;
begin
  with doomed as (
    delete from pending_invitation
    where approved_at is null
      and created_at < now() - interval '14 days'
    returning id
  )
  insert into consent_event (event, detail)
  select 'purged', jsonb_build_object('invitation_id', id) from doomed;
  get diagnostics n = row_count;
  return n;
end $$;
