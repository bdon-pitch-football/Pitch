-- ---------------------------------------------------------------------------
-- 0110 — the operator's Today screen reads counts, and only counts
-- (OpsToday.dc.html; brief G, 29 Sep, BUZ: "build both"; D-78, D-79, D-126,
-- D-162).
--
-- WHY A FUNCTION AND NOT A PAGE FULL OF SQL. The Today screen is the one place
-- in the console that looks across every family on Pitch at once, so it is the
-- place a careless query would most easily carry a name out with a count. The
-- rule the screen promises in its own footer — "no name, no record, and no way
-- to get to one from here" (D-79: support tooling never reads a child's
-- record) — is kept here, where it can be tested, rather than in a page:
--
--   fn_ops_today()              one row of integers. Nothing it returns can
--                               name anybody; its result columns are all int,
--                               and the permission suite asserts that from
--                               the catalogue, not from this comment.
--   fn_ops_delivery_failures()  the last 24 hours of failed sends: the
--                               channel, when, and the provider's status word
--                               (0009, 0065: failure_reason is a provider
--                               status and never message content). Never the
--                               address it went to, never the message.
--
-- Both are read-only (`stable`, no writes) and take no argument, so there is no
-- parameter through which a caller could ask about one person.
--
-- WHAT EACH COUNT MEANS, so the tiles cannot drift from the database:
--
--   signups_*        people whose account row was created today (Melbourne),
--                    by the first hat that fits: a club seat, then a coach
--                    page, then a parent of a linked child, then a player
--                    record. Sign-up writes no role (app/join), so the hat is
--                    read from what the account holds. signups_total counts
--                    every new row, including one that holds no hat yet.
--   approvals_sent   guardian approval requests sent today: distinct
--                    invitations with an email_sent or sms_sent row on the
--                    consent spine today (D-78). A resend counts its
--                    invitation once.
--   approved         of those invitations, the ones a guardian has approved —
--                    the same cohort, so "% of sent" can never pass 100.
--   registrations    live registrations (not withdrawn), and the clubs they
--                    are at.
--   held             live registrations at clubs awaiting the call (D-126):
--                    the club sees a count and nothing else. The same figure
--                    the verification queue shows.
--   awaiting         clubs claimed and not yet called, and how many
--                    Melbourne days the oldest has waited since its claim
--                    (the claimant's seat began then; 0030).
--
-- A zero is returned as 0 and never printed (D-162): the page omits a tile, or
-- a part of a line, whose count is zero.
-- ---------------------------------------------------------------------------

create function fn_ops_today() returns table (
  signups_total int, signups_player int, signups_parent int, signups_coach int, signups_club int,
  approvals_sent int, approved int,
  registrations int, registration_clubs int,
  held int, awaiting int, awaiting_oldest_days int
)
language sql stable as $$
  with today as (select (now() at time zone 'Australia/Melbourne')::date as d),
  joined as (
    select case
        when exists (select 1 from membership m where m.person_id = p.id
                     and m.role in ('technical_director','club_admin')) then 'club'
        when exists (select 1 from coach_profile cp where cp.person_id = p.id) then 'coach'
        when exists (select 1 from guardianship_link g where g.guardian_id = p.id) then 'parent'
        when exists (select 1 from development_record r where r.person_id = p.id) then 'player'
      end as hat
    from person p, today
    where (p.created_at at time zone 'Australia/Melbourne')::date = today.d
  ),
  sent as (
    select distinct e.detail->>'invitation_id' as invitation
    from consent_event e, today
    where e.event in ('email_sent','sms_sent') and e.detail ? 'invitation_id'
      and (e.at at time zone 'Australia/Melbourne')::date = today.d
  ),
  claimed as (
    select c.id,
      (select min(m.started_at) from membership m
       where m.club_id = c.id and m.role in ('technical_director','club_admin')) as claimed_at
    from club c where c.club_state = 'claimed'
  )
  select
    (select count(*)::int from joined),
    (select count(*)::int from joined where hat = 'player'),
    (select count(*)::int from joined where hat = 'parent'),
    (select count(*)::int from joined where hat = 'coach'),
    (select count(*)::int from joined where hat = 'club'),
    (select count(*)::int from sent),
    (select count(*)::int from sent s where exists (
       select 1 from consent_event a where a.event = 'approved' and a.detail->>'invitation_id' = s.invitation)),
    (select count(*)::int from registration where withdrawn_at is null),
    (select count(distinct club_id)::int from registration where withdrawn_at is null),
    (select count(*)::int from registration r join claimed c on c.id = r.club_id where r.withdrawn_at is null),
    (select count(*)::int from claimed),
    (select coalesce(max((select d from today) - (claimed_at at time zone 'Australia/Melbourne')::date), 0)::int from claimed);
$$;

comment on function fn_ops_today() is
  'The operator''s Today screen (OpsToday.dc.html, brief G): one row of counts, nothing that names anybody (D-79). Read-only.';

create function fn_ops_delivery_failures() returns table (channel text, failed_at timestamptz, provider_said text)
language sql stable as $$
  select o.channel, o.failed_at, o.failure_reason
  from message_outbox o
  where o.failed_at > now() - interval '24 hours'
  order by o.failed_at desc
  limit 50;
$$;

comment on function fn_ops_delivery_failures() is
  'Failed sends in the last 24 hours for the Today screen (brief G): channel, time and the provider''s status word. Never the address, never the message (0009, D-79).';
