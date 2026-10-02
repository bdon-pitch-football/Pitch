-- ---------------------------------------------------------------------------
-- 0171 — "Signups today" is the sum of its own line (design audit, 2 Oct,
-- finding 22; 0110, 0157, 0158; D-79, D-162).
--
-- WHAT WAS WRONG. /ops Today read "SIGNUPS TODAY 211" over a line that summed
-- to 194, on a fresh seed. Nothing was counted twice and nothing crossed a
-- Melbourne midnight: the total counted every person row created today, and
-- the line counted only the rows that wore one of four hats. 17 wore none:
--   · a team manager (Tomas, Tarrowvale). A club seat — but the club hat
--     asked for a technical director or an administrator only.
--   · three accounts holding nothing else (Robin, Casey, the B2 Priya). That
--     is exactly what the CLUB door makes (app/join createClubAccount: "an
--     ACCOUNT and nothing else ... the claim is what ties a person to a
--     club"), and it stays that way until its claim. The player door writes a
--     record and the coach door a coach page, so they were counted; the
--     club door wrote nothing a hat could see, so every club person who had
--     signed up and not yet claimed was in the total and in no part of it.
--     On launch week, with clubs the one audience, that is the gap that
--     matters in production.
--   · thirteen rows with no address and nothing on them (the seed's twelve
--     "Register Parent" rows for registrants who are 18 or over, and the
--     investigator). They are not accounts: nobody can sign in as them, and
--     no door makes one.
--
-- THE RULE NOW, in one place. A signup is an account a door made, and it has
-- exactly one hat, the first that fits:
--   club    a club seat — technical director, administrator or team manager
--   coach   a coach page, or a coach's seat at a club
--   parent  the guardian of a linked child
--   player  a development record (the child a guardian approved included)
--   club    an account (a sign-in address) holding none of the above: the
--           club door's account before its claim. The parent door is closed
--           (a parent joins through the approval, and is a parent), so this
--           is the only door that makes one.
-- A row with no hat is not a signup and is not counted, so signups_total is
-- the sum of the four by construction — the tile can no longer print a total
-- its own line does not add up to. No new label: "club" is the club door's
-- own word on /join, and the digest's.
--
-- ONE DEFINITION. 0157 and 0158 each carried a copy of 0110's hat rule. They
-- agreed, but three copies are three places to be wrong (L23), so the
-- two-argument fn_ops_day is now the rule, and the one-argument fn_ops_day
-- and fn_ops_today's signup and approval columns read it. Signatures and
-- result columns are unchanged; all three still return integers and nothing
-- else, and none takes an argument that names a person (D-79).
-- ---------------------------------------------------------------------------

create or replace function fn_ops_day(p_day date, p_exclude text[]) returns table (
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
                     and m.role in ('technical_director','club_admin','team_manager')) then 'club'
        when exists (select 1 from coach_profile cp where cp.person_id = p.id)
          or exists (select 1 from membership m where m.person_id = p.id and m.role = 'coach') then 'coach'
        when exists (select 1 from guardianship_link g where g.guardian_id = p.id) then 'parent'
        when exists (select 1 from development_record r where r.person_id = p.id) then 'player'
        -- The club door's account, before its claim: an address, nothing else.
        when exists (select 1 from person a where a.id = p.id and a.email is not null) then 'club'
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
    (select count(*)::int from joined where hat is not null),
    (select count(*)::int from joined where hat = 'player'),
    (select count(*)::int from joined where hat = 'parent'),
    (select count(*)::int from joined where hat = 'coach'),
    (select count(*)::int from joined where hat = 'club'),
    (select count(*)::int from sent),
    (select count(*)::int from sent s where exists (
       select 1 from consent_event a where a.event = 'approved' and a.detail->>'invitation_id' = s.invitation));
$$;

comment on function fn_ops_day(date, text[]) is
  'The signup and approval counts for a Melbourne date — THE definition (0171): every signup has one hat and the total is the sum of the four. Leaves out the operator''s test accounts (DIGEST_EXCLUDE_EMAILS; a +tag is ignored). Counts only (D-79). Read-only.';

create or replace function fn_ops_day(p_day date) returns table (
  signups_total int, signups_player int, signups_parent int, signups_coach int, signups_club int,
  approvals_sent int, approved int
)
language sql stable as $$
  select * from fn_ops_day(p_day, '{}'::text[]);
$$;

comment on function fn_ops_day(date) is
  'fn_ops_day(date, text[]) with nobody left out (0171): the same definition, never a copy. Counts only (D-79). Read-only.';

create or replace function fn_ops_today() returns table (
  signups_total int, signups_player int, signups_parent int, signups_coach int, signups_club int,
  approvals_sent int, approved int,
  registrations int, registration_clubs int,
  held int, awaiting int, awaiting_oldest_days int
)
language sql stable as $$
  with today as (select (now() at time zone 'Australia/Melbourne')::date as d),
  day as (select * from fn_ops_day((select d from today), '{}'::text[])),
  claimed as (
    select c.id,
      (select min(m.started_at) from membership m
       where m.club_id = c.id and m.role in ('technical_director','club_admin')) as claimed_at
    from club c where c.club_state = 'claimed'
  )
  select
    day.signups_total, day.signups_player, day.signups_parent, day.signups_coach, day.signups_club,
    day.approvals_sent, day.approved,
    (select count(*)::int from registration where withdrawn_at is null),
    (select count(distinct club_id)::int from registration where withdrawn_at is null),
    (select count(*)::int from registration r join claimed c on c.id = r.club_id where r.withdrawn_at is null),
    (select count(*)::int from claimed),
    (select coalesce(max((select d from today) - (claimed_at at time zone 'Australia/Melbourne')::date), 0)::int from claimed)
  from day;
$$;

comment on function fn_ops_today() is
  'The operator''s Today screen (OpsToday.dc.html, brief G): one row of counts, nothing that names anybody (D-79). Its signup and approval counts are fn_ops_day''s for today (0171). Read-only.';
