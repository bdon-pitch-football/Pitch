-- ---------------------------------------------------------------------------
-- 0100 — a Technical Director's access can be ended, and a club never has two
-- (D-48, D-93; brief F, BUZ 29 Sep: "get that done now"; 0058's handover gap).
--
-- WHY THIS EXISTS. D-93: "A departing TD loses club-wide access immediately;
-- they keep only read on entries they personally authored (D-48)." Until now
-- nothing in the product could make a TD depart. 0058 said so out loud
-- ("HANDOVER IS OUT OF SCOPE ... a later call that records a different person
-- ADDS a TD; it does not end the previous one's membership"), so a club that
-- changed its TD kept the old one reading every child's record, and the only
-- fix was SQL by hand.
--
-- THE SHAPE.
--
--   · fn_td_call(club) — which call names this club's Technical Director: the
--     latest verified call that recorded one. 0058 and 0060 asked "did ANY
--     verified call record this address", so after a second call named
--     somebody else, the first person was still "on the call" and could still
--     be attached (a later proof, a re-verification). One call names the TD
--     now, and fn_td_on_call, fn_attach_recorded_td and fn_club_td all read
--     that one (L23).
--
--   · A call is SPENT for a person once their role at that club has ended
--     after it. fn_td_on_call says no, so neither the attach (a club
--     re-verified, an address proved) nor a hand-written row can bring back a
--     TD somebody ended. Only a NEW call naming them does — which is what the
--     approved words tell the operator and the club ("To name a new Technical
--     Director, record them on a call" / "ring Pitch"). The rule is read off
--     membership.ended_at itself, so it holds however the role ended.
--
--   · fn_td_ends(...) — the one place a TD membership is ended and logged. It
--     sets ended_at on the live row and writes td_ending: who ended it, when,
--     why, which person, and by what door. It touches nothing else: every
--     entry, assessment, grant and note the TD wrote stays exactly where it
--     is (D-48), and fn_read_level already gives a departed author
--     'authored_only' on what they wrote.
--
--   · Two doors, because there are two kinds of actor and the database can
--     only check one of them:
--       fn_end_td(actor, club, reason)          — the club's administrator,
--         from /club/roles. The DATABASE checks the actor holds a live
--         club_admin membership at that club (fn_may_end_td). A TD (ending
--         anyone), a coach, a team manager, an administrator at another club:
--         refused here, whatever the form says.
--       fn_ops_end_td(operator, email, club, reason) — Pitch's operator, from
--         /ops/call/[clubId]. There is no operator identity in the schema
--         (lib/ops-guard: an allowlist in the environment), so, exactly like
--         every other fn_ops_* function (0044, 0070), the authority is
--         requireOperator in the action. The database does what it can: the
--         operator must be a real person whose own address is the one given.
--     Both require a reason (3 to 500 characters, 0044's rule).
--
--   · A verified call that records a DIFFERENT TD ends the live one in the
--     same transaction (fn_td_replaced_on_call, from the call's own trigger),
--     before the new person is attached — even when the new person cannot
--     attach yet (no account, or an unproved address). Two TDs never hold the
--     role at once, and the gap between them is a club with no TD, which is
--     the restrictive direction. A call naming the SAME person as the live TD
--     changes nothing. A verified call that records nobody (the TD fields are
--     optional on the sheet) changes nothing either: it is not a call about
--     the TD.
--
-- NAMING A NEW TD STAYS CALL-ONLY. Nothing here writes a live
-- technical_director row except fn_attach_recorded_td, and 0058's wall still
-- refuses every other writer.
--
-- Read with: D-48, D-93, D-126, D-137; 0058 (the call records the person),
-- 0060 (a mailbox is not a person), 0044 (the ops audit pattern), doc 14 H9,
-- H10, H11.
-- ---------------------------------------------------------------------------

-- ---- 1 · the audit row ----------------------------------------------------
-- No foreign keys, on purpose (0044's reasoning): an account deleted later
-- must not be able to take the record of what was done to it, or by it, with
-- it, and an append-only row cannot be updated to null.
create table td_ending (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  club_id uuid not null,
  person_id uuid not null,          -- the Technical Director whose access ended
  membership_id uuid not null,
  cause text not null check (cause in ('club_admin', 'operator', 'replaced_on_call')),
  ended_by uuid,                    -- the person who pressed; null when a call replaced them
  operator_email text,
  reason text,
  call_id uuid,                     -- the call that named somebody else
  check (
    (cause = 'replaced_on_call' and call_id is not null and ended_by is null and reason is null)
    or (cause = 'club_admin' and ended_by is not null and call_id is null
        and length(btrim(coalesce(reason, ''))) between 3 and 500)
    or (cause = 'operator' and ended_by is not null and call_id is null
        and length(btrim(coalesce(operator_email, ''))) > 0
        and length(btrim(coalesce(reason, ''))) between 3 and 500)
  )
);
alter table td_ending enable row level security;

create function td_ending_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'td_ending is append-only (D-48, D-93)';
end $$;

create trigger td_ending_no_update before update or delete on td_ending
  for each row execute function td_ending_immutable();

-- ---- 2 · which call names the TD -----------------------------------------
create function fn_td_call(p_club uuid) returns uuid
language sql stable as $$
  select vc.id from verification_call vc
  where vc.club_id = p_club and vc.outcome = 'verified' and vc.td_email is not null
  order by vc.called_at desc, vc.id desc
  limit 1;
$$;

-- ---- 3 · the one answer, now about one call, and spent once ended --------
create or replace function fn_td_on_call(p_person uuid, p_club uuid) returns boolean
language sql stable as $$
  select exists (
    select 1
    from verification_call vc
    join club c on c.id = vc.club_id
    join person p on p.id = p_person
    where vc.id = fn_td_call(p_club)
      and p.email is not null
      and lower(trim(vc.td_email)) = lower(trim(p.email))
      -- 0060: the club's own published address is a mailbox, not a person.
      and lower(trim(vc.td_email)) <> lower(trim(coalesce(c.contact_email, '~no contact address~')))
      -- Spent: their role at this club ended after this call named them. A
      -- TD somebody ended comes back only on a newer call (D-48, D-93).
      and not exists (
        select 1 from membership m
        where m.person_id = p_person and m.club_id = p_club
          and m.role = 'technical_director'
          and m.ended_at is not null and m.ended_at >= vc.called_at)
  );
$$;

-- ---- 4 · the attach reads the same call ----------------------------------
create or replace function fn_attach_recorded_td(p_club uuid) returns uuid
language plpgsql as $$
declare v_person uuid; v_id uuid;
begin
  if not exists (select 1 from club where id = p_club and club_state = 'verified') then
    return null;
  end if;
  select p.id into v_person
  from verification_call vc
  join person p on lower(trim(p.email)) = lower(trim(vc.td_email))
  where vc.id = fn_td_call(p_club)
    and p.email_proved_at is not null
    and fn_age_band(p.dob) = '18plus'
    -- The same question the wall asks (0060, L23): the mailbox, and now a
    -- spent call, are refused in silence rather than thrown out of an
    -- operator's verification.
    and fn_td_on_call(p.id, p_club)
  order by p.created_at
  limit 1;
  if v_person is null then return null; end if;

  select id into v_id from membership
   where person_id = v_person and club_id = p_club
     and role = 'technical_director' and ended_at is null
   limit 1;
  if v_id is not null then return v_id; end if;

  insert into membership (person_id, club_id, role)
    values (v_person, p_club, 'technical_director')
    returning id into v_id;
  return v_id;
end $$;

-- ---- 5 · the one place a TD's access ends --------------------------------
-- Ends every live technical_director row at the club for the person (there is
-- one; a duplicate would be ended with it) and logs each. Returns the person
-- whose access ended, or null when there was nobody live to end — a second
-- press, or a club with no TD, writes nothing.
create function fn_td_ends(p_club uuid, p_person uuid, p_cause text, p_actor uuid,
                           p_email text, p_reason text, p_call uuid) returns uuid
language plpgsql as $$
declare v_row record; v_done boolean := false;
begin
  for v_row in
    update membership set ended_at = now()
     where club_id = p_club and person_id = p_person
       and role = 'technical_director' and ended_at is null
    returning id
  loop
    insert into td_ending (club_id, person_id, membership_id, cause, ended_by, operator_email, reason, call_id)
      values (p_club, p_person, v_row.id, p_cause, p_actor, nullif(btrim(coalesce(p_email, '')), ''),
              case when p_reason is null then null else btrim(p_reason) end, p_call);
    v_done := true;
  end loop;
  return case when v_done then p_person else null end;
end $$;

-- The club side's question, asked by the page before it offers the button and
-- by fn_end_td before it does anything: does this person administer this club.
create function fn_may_end_td(p_actor uuid, p_club uuid) returns boolean
language sql stable as $$
  select p_actor is not null and exists (
    select 1 from membership m
    where m.person_id = p_actor and m.club_id = p_club
      and m.role = 'club_admin' and m.ended_at is null);
$$;

-- The club's administrator (D-93: the administrator manages memberships).
create function fn_end_td(p_actor uuid, p_club uuid, p_reason text) returns uuid
language plpgsql as $$
declare v_td uuid;
begin
  if not fn_may_end_td(p_actor, p_club) then
    raise exception 'only the club''s administrator or a Pitch operator ends a Technical Director''s access (D-93)'
      using errcode = 'insufficient_privilege';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'ending a Technical Director''s access needs a reason' using errcode = 'check_violation';
  end if;
  select person_id into v_td from membership
   where club_id = p_club and role = 'technical_director' and ended_at is null
   limit 1;
  if v_td is null then return null; end if;
  return fn_td_ends(p_club, v_td, 'club_admin', p_actor, null, p_reason, null);
end $$;

-- Pitch's operator. Authority is requireOperator in app/ops (see the header).
create function fn_ops_end_td(p_operator uuid, p_email text, p_club uuid, p_reason text) returns uuid
language plpgsql as $$
declare v_td uuid;
begin
  if p_operator is null or not exists (
    select 1 from person where id = p_operator
      and email is not null and lower(trim(email)) = lower(trim(coalesce(p_email, '')))) then
    raise exception 'an operator is a person, named by their own address (D-137)'
      using errcode = 'insufficient_privilege';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'ending a Technical Director''s access needs a reason' using errcode = 'check_violation';
  end if;
  select person_id into v_td from membership
   where club_id = p_club and role = 'technical_director' and ended_at is null
   limit 1;
  if v_td is null then return null; end if;
  return fn_td_ends(p_club, v_td, 'operator', p_operator, p_email, p_reason, null);
end $$;

-- ---- 6 · a call naming somebody else ends the one before -----------------
create function fn_td_replaced_on_call(p_club uuid, p_call uuid) returns void
language plpgsql as $$
declare v_person uuid;
begin
  for v_person in
    select distinct m.person_id from membership m
    where m.club_id = p_club and m.role = 'technical_director' and m.ended_at is null
      and not fn_td_on_call(m.person_id, p_club)
  loop
    perform fn_td_ends(p_club, v_person, 'replaced_on_call', null, null, null, p_call);
  end loop;
end $$;

-- The call's own trigger (0058), now ending before it attaches. Same
-- transaction as the insert, so a call that fails to write ends nobody.
create or replace function fn_call_attaches_td() returns trigger
language plpgsql as $$
begin
  if new.outcome = 'verified' and new.td_email is not null then
    perform fn_td_replaced_on_call(new.club_id, new.id);
    perform fn_attach_recorded_td(new.club_id);
  end if;
  return null;
end $$;

-- ---- 7 · what the operator console reads ---------------------------------
-- Gains `ended_at`: when the person the call names had their access ended
-- since that call (null while it is live, waiting, or was never theirs). The
-- sheet must not say "waiting on their account" about somebody whose access
-- was ended on purpose. Everything else is 0060's, reading fn_td_call.
drop function fn_club_td(uuid);
create function fn_club_td(p_club uuid)
  returns table (person_id uuid, td_name text, td_email text,
                 recorded_at timestamptz, recorded_by text, active boolean,
                 account_name text, account_email text,
                 name_matches boolean, club_mailbox boolean,
                 ended_at timestamptz)
language sql stable as $$
  select
    p.id,
    vc.td_name,
    vc.td_email,
    vc.called_at,
    vc.operator,
    exists (select 1 from membership m
            where m.person_id = p.id and m.club_id = p_club
              and m.role = 'technical_director' and m.ended_at is null),
    nullif(trim(p.first_name || ' ' || coalesce(p.last_name, '')), ''),
    p.email,
    case when p.id is null then null else
      lower(regexp_replace(trim(p.first_name || ' ' || coalesce(p.last_name, '')), '\s+', ' ', 'g'))
        = lower(regexp_replace(trim(vc.td_name), '\s+', ' ', 'g'))
    end,
    lower(trim(vc.td_email)) = lower(trim(coalesce(c.contact_email, '~no contact address~'))),
    (select max(m.ended_at) from membership m
      where m.person_id = p.id and m.club_id = p_club
        and m.role = 'technical_director' and m.ended_at >= vc.called_at)
  from verification_call vc
  join club c on c.id = vc.club_id
  left join lateral (
    select p2.id, p2.first_name, p2.last_name, p2.email from person p2
    where lower(trim(p2.email)) = lower(trim(vc.td_email))
      and p2.email_proved_at is not null
    order by p2.created_at
    limit 1
  ) p on true
  where vc.id = fn_td_call(p_club);
$$;

-- ---- 8 · the rows that are already here ----------------------------------
-- The invariant this migration adds — one TD per club, the one the latest call
-- names — made true of the whole table and not only of future writes (0058's
-- reasoning). There is no production data; in the dev seed and the demo every
-- club has one call and one TD, so this ends nothing there.
do $$
declare v_club uuid;
begin
  -- A live TD at a club with no call naming anybody cannot exist after 0058's
  -- and 0060's own sweeps, and td_ending would refuse a replacement with no
  -- call; such a club is skipped rather than failing the migration.
  for v_club in select distinct club_id from membership
                where role = 'technical_director' and ended_at is null
                  and fn_td_call(club_id) is not null loop
    perform fn_td_replaced_on_call(v_club, fn_td_call(v_club));
  end loop;
end $$;
