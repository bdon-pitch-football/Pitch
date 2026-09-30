-- The 7am digest leaves out the operator's own test accounts (BUZ, 30 Sep:
-- "exclude my test accounts from the 7am email"). The list is not stored
-- here: it comes from DIGEST_EXCLUDE_EMAILS in the environment, so no address
-- is written into the schema. An address matches with or without a +tag
-- (burak+test1@x counts as burak@x). Only the signup counts change; the
-- one-argument fn_ops_day and the Today screen are untouched. Read-only.
create function fn_ops_day(p_day date, p_exclude text[]) returns table (
  signups_total int, signups_player int, signups_parent int, signups_coach int, signups_club int,
  approvals_sent int, approved int
)
language sql stable as $$
  with excluded as (
    select lower(trim(e)) as e from unnest(coalesce(p_exclude, '{}'::text[])) e where trim(e) <> ''
  ),
  joined as (
    select case
        when exists (select 1 from membership m where m.person_id = p.id
                     and m.role in ('technical_director','club_admin')) then 'club'
        when exists (select 1 from coach_profile cp where cp.person_id = p.id) then 'coach'
        when exists (select 1 from guardianship_link g where g.guardian_id = p.id) then 'parent'
        when exists (select 1 from development_record r where r.person_id = p.id) then 'player'
      end as hat
    from person p
    where (p.created_at at time zone 'Australia/Melbourne')::date = p_day
      and not exists (select 1 from excluded x
                      where x.e = lower(p.email)
                         or x.e = regexp_replace(lower(p.email), '\+[^@]*@', '@'))
  ),
  sent as (
    select distinct e.detail->>'invitation_id' as invitation
    from consent_event e
    where e.event in ('email_sent','sms_sent') and e.detail ? 'invitation_id'
      and (e.at at time zone 'Australia/Melbourne')::date = p_day
  )
  select
    (select count(*)::int from joined),
    (select count(*)::int from joined where hat = 'player'),
    (select count(*)::int from joined where hat = 'parent'),
    (select count(*)::int from joined where hat = 'coach'),
    (select count(*)::int from joined where hat = 'club'),
    (select count(*)::int from sent),
    (select count(*)::int from sent s where exists (
       select 1 from consent_event a where a.event = 'approved' and a.detail->>'invitation_id' = s.invitation));
$$;
comment on function fn_ops_day(date, text[]) is
  'The 7am digest: fn_ops_day for a Melbourne date, leaving out the operator''s test accounts (DIGEST_EXCLUDE_EMAILS; a +tag is ignored). Counts only (D-79). Read-only.';
