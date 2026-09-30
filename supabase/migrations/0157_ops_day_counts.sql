-- The 7am digest reports the day before (BUZ, 30 Sep: "set up no. 2").
-- fn_ops_today answers for today; at 7am that is seven hours. This is the same
-- count for any Melbourne date, with fn_ops_today's own definitions, so the
-- email and the Today screen can never disagree about what a signup is.
-- Counts only, nothing that names anybody (D-79). Read-only.
create function fn_ops_day(p_day date) returns table (
  signups_total int, signups_player int, signups_parent int, signups_coach int, signups_club int,
  approvals_sent int, approved int
)
language sql stable as $$
  with joined as (
    select case
        when exists (select 1 from membership m where m.person_id = p.id
                     and m.role in ('technical_director','club_admin')) then 'club'
        when exists (select 1 from coach_profile cp where cp.person_id = p.id) then 'coach'
        when exists (select 1 from guardianship_link g where g.guardian_id = p.id) then 'parent'
        when exists (select 1 from development_record r where r.person_id = p.id) then 'player'
      end as hat
    from person p
    where (p.created_at at time zone 'Australia/Melbourne')::date = p_day
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
comment on function fn_ops_day(date) is
  'The 7am digest: fn_ops_today''s signup and approval counts for any Melbourne date. Counts only (D-79). Read-only.';
