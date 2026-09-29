-- ---------------------------------------------------------------------------
-- 0121 — a Technical Director whose account name is not the name on the call
-- is held for a human, and never auto-passes (BUZ's approved default 5,
-- 28 Sep; brief H; D-93, D-126, D-137; LESSONS L21, L23).
--
-- WHY THIS EXISTS. 0060 closed the mailbox case and, in its own words, left
-- the rest open: "A recorded name that resolves to a DIFFERENTLY NAMED account
-- is arguably a hold rather than an attach ... It does not refuse an attach to
-- a differently named human." BUZ decided it on 28 Sep: held for a human.
-- Round F found it still unbuilt — the call's td_name was compared to nothing
-- on the way in, and the role attached to whichever proved account held the
-- recorded address, whatever that account was called. This is the
-- highest-privilege role in the product (club-wide read across children's
-- records), and the name the club gave on the call is the one piece of the
-- call that is about the PERSON rather than the inbox.
--
-- THE RULE (fn_td_name_matches). The name recorded on the call and the name
-- on the account are the same person's when, after normalising case and
-- whitespace, they are equal — or the surnames are equal and one first name
-- is the other's initial ("D. Kovac", "D Kovac" and "Dana Kovac"). That is
-- all. A middle name, a nickname, a maiden name, a typo: a human looks.
-- "Looks like the same person" is exactly the judgement BUZ reserved for a
-- person, so the function is deliberately strict and the hold is the answer
-- for everything it does not recognise.
--
-- WHERE IT LIVES. In fn_td_on_call, the one answer 0058 built and 0060 and
-- 0100 refined, so the wall trigger (every writer of a live TD row, now and
-- later), the attach (a club verified, a call logged, an address proved) and
-- the call sheet all inherit it (L23). A mismatched account is not "on the
-- call": the attach returns null in silence, as it does for a mailbox, and a
-- hand-written row is refused by the trigger.
--
-- THE HUMAN (fn_ops_confirm_td_name). The operator sees the mismatch on the
-- call sheet — the recorded name beside the account's own (fn_club_td) — and
-- either records a new call with the right name, or confirms that the account
-- IS the person the club named. The confirmation is named and logged: which
-- operator (a real person, by their own address, 0100's rule for operators),
-- when, which call, which account, and both names as they stood at that
-- moment. It is bound to that call and that account, so a later call is a
-- fresh question, and it attaches the role in the same transaction. The
-- authority is requireOperator in the action, exactly as for every other
-- fn_ops_* function (0044, 0070, 0100); the database checks what it can.
--
-- A NEW CALL IS A NEW QUESTION. The confirmation belongs to one call. A later
-- call that records the live TD's address under a name that does not match
-- theirs does not name them, so 0100's own trigger ends them in that call's
-- transaction (cause replaced_on_call) — held, the restrictive answer — and
-- the sheet shows the hold for a human to resolve on THAT call. For that to
-- be resolvable, "spent" (0100) now means ended strictly after the call, not
-- at its own moment; see fn_td_on_call below.
--
-- WHAT IT DOES NOT DO. It does not re-ask at every sign-in or every rename
-- (L31: a capability follows the event that grants it). The name is compared
-- when the role would attach. An account renamed after the role attached is
-- not a verification event, and ending a TD has its own two doors (0100).
--
-- THE ROWS ALREADY HERE. There is no production data. A live TD whose name
-- does not match and who was never confirmed is ended through 0100's one
-- ending function (cause name_held), so the invariant is true of the whole
-- table; in the dev seed and the demo every TD's call records their own
-- name, so this ends nothing.
--
-- Read with: 0058 (the call records the person), 0060 (a mailbox is not a
-- person, and this was its open question), 0100 (one call names the TD; the
-- operator pattern), D-93, D-126, D-137, doc 14 H10.
-- ---------------------------------------------------------------------------

-- ---- 1 · the rule ----------------------------------------------------------
create function fn_td_name_norm(p text) returns text
language sql immutable as $$
  select lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'))
$$;

create function fn_td_name_matches(p_recorded text, p_first text, p_last text) returns boolean
language plpgsql immutable as $$
declare
  r text := fn_td_name_norm(p_recorded);
  a text := fn_td_name_norm(coalesce(p_first, '') || ' ' || coalesce(p_last, ''));
  r_first text; r_rest text; a_first text; a_rest text;
begin
  if r = '' or a = '' then return false; end if;
  if r = a then return true; end if;
  if position(' ' in r) = 0 or position(' ' in a) = 0 then return false; end if;
  r_first := split_part(r, ' ', 1); r_rest := substr(r, length(r_first) + 2);
  a_first := split_part(a, ' ', 1); a_rest := substr(a, length(a_first) + 2);
  if r_rest <> a_rest or r_rest = '' then return false; end if;
  -- An initial, with or without its full stop, for the other's first name.
  r_first := rtrim(r_first, '.'); a_first := rtrim(a_first, '.');
  if r_first = a_first then return true; end if;
  return (length(r_first) = 1 and length(a_first) > 1 and left(a_first, 1) = r_first)
      or (length(a_first) = 1 and length(r_first) > 1 and left(r_first, 1) = a_first);
end $$;

comment on function fn_td_name_matches(text, text, text) is
  'BUZ approved default 5 (28 Sep): the call''s TD name and the account''s name, case and whitespace aside, with a first-name initial allowed. Anything else is held for a human.';

-- ---- 2 · the human's confirmation, append-only ------------------------------
-- No foreign keys, as 0044 and 0100: a person deleted later must not take the
-- record of what was confirmed about them with them.
create table td_name_confirmation (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  club_id uuid not null,
  call_id uuid not null,
  person_id uuid not null,          -- the account confirmed as the club's TD
  operator_id uuid not null,
  operator_email text not null check (length(btrim(operator_email)) > 0),
  recorded_name text not null,      -- the name on the call, as it stood
  account_name text not null,       -- the account's own name, as it stood
  unique (call_id, person_id)
);
alter table td_name_confirmation enable row level security;

create function td_name_confirmation_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'td_name_confirmation is append-only (D-137)';
end $$;

create trigger td_name_confirmation_no_update before update or delete on td_name_confirmation
  for each row execute function td_name_confirmation_immutable();

-- ---- 3 · the one answer gains the name --------------------------------------
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
      -- 0100: spent once their role here ended after this call named them.
      -- STRICTLY after (0121; it was >=). The one ending that shares the
      -- call's own moment is the call's own trigger ending them because this
      -- call does not name them — and now that a name mismatch is one reason
      -- it may not, that ending must leave the call confirmable, or a human
      -- could never resolve the hold without a third call.
      and not exists (
        select 1 from membership m
        where m.person_id = p_person and m.club_id = p_club
          and m.role = 'technical_director'
          and m.ended_at is not null and m.ended_at > vc.called_at)
      -- 0121: the account is the person the club NAMED on this call — by
      -- name, or by a human who looked (approved default 5). Never neither.
      and (fn_td_name_matches(vc.td_name, p.first_name, p.last_name)
           or exists (select 1 from td_name_confirmation t
                       where t.call_id = vc.id and t.person_id = p_person))
  );
$$;

-- ---- 4 · the operator's named, logged confirmation -------------------------
-- Returns the confirmed person when the role is now attached, null when there
-- was nothing to confirm (no call naming anyone, no proved account at that
-- address, the club's own mailbox, a name that already matches, or an account
-- the role cannot attach to — under 18, or spent). A second press writes
-- nothing new.
create function fn_ops_confirm_td_name(p_operator uuid, p_email text, p_club uuid) returns uuid
language plpgsql as $$
declare
  v_call uuid; v_person uuid; v_recorded text; v_account text; v_mailbox boolean;
begin
  if p_operator is null or not exists (
    select 1 from person where id = p_operator
      and email is not null and lower(trim(email)) = lower(trim(coalesce(p_email, '')))) then
    raise exception 'an operator is a person, named by their own address (D-137)'
      using errcode = 'insufficient_privilege';
  end if;
  v_call := fn_td_call(p_club);
  if v_call is null then return null; end if;
  select p.id, vc.td_name, nullif(trim(p.first_name || ' ' || coalesce(p.last_name, '')), ''),
         lower(trim(vc.td_email)) = lower(trim(coalesce(c.contact_email, '~no contact address~')))
    into v_person, v_recorded, v_account, v_mailbox
    from verification_call vc
    join club c on c.id = vc.club_id
    join person p on lower(trim(p.email)) = lower(trim(vc.td_email)) and p.email_proved_at is not null
   where vc.id = v_call
   order by p.created_at
   limit 1;
  -- A mailbox is never a person, whoever confirms it (0060).
  if v_person is null or v_mailbox then return null; end if;
  if fn_td_name_matches(v_recorded, (select first_name from person where id = v_person),
                        (select last_name from person where id = v_person)) then
    return null;
  end if;
  insert into td_name_confirmation (club_id, call_id, person_id, operator_id, operator_email, recorded_name, account_name)
    values (p_club, v_call, v_person, p_operator, btrim(p_email), v_recorded, coalesce(v_account, ''))
    on conflict (call_id, person_id) do nothing;
  if fn_attach_recorded_td(p_club) is null then return null; end if;
  return v_person;
end $$;

-- ---- 5 · what the call sheet reads -----------------------------------------
-- name_matches is now the rule's own answer (it was 0060's exact compare, a
-- second answer to the same question — L23), and name_confirmed says a human
-- has looked. Every other column is 0100's.
drop function fn_club_td(uuid);
create function fn_club_td(p_club uuid)
  returns table (person_id uuid, td_name text, td_email text,
                 recorded_at timestamptz, recorded_by text, active boolean,
                 account_name text, account_email text,
                 name_matches boolean, club_mailbox boolean,
                 ended_at timestamptz, name_confirmed boolean)
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
    case when p.id is null then null else fn_td_name_matches(vc.td_name, p.first_name, p.last_name) end,
    lower(trim(vc.td_email)) = lower(trim(coalesce(c.contact_email, '~no contact address~'))),
    (select max(m.ended_at) from membership m
      where m.person_id = p.id and m.club_id = p_club
        and m.role = 'technical_director' and m.ended_at > vc.called_at),
    exists (select 1 from td_name_confirmation t where t.call_id = vc.id and t.person_id = p.id)
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

revoke all on function fn_ops_confirm_td_name(uuid, text, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function fn_ops_confirm_td_name(uuid, text, uuid) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function fn_ops_confirm_td_name(uuid, text, uuid) from authenticated';
  end if;
end $$;

-- ---- 6 · the rows that are already here -------------------------------------
-- Ended through 0100's one ending function, so td_ending says why: a cause of
-- its own (L5 — "a call named somebody else" is not what happened here).
alter table td_ending drop constraint td_ending_cause_check;
alter table td_ending add constraint td_ending_cause_check
  check (cause in ('club_admin', 'operator', 'replaced_on_call', 'name_held'));
alter table td_ending drop constraint td_ending_check;
alter table td_ending add constraint td_ending_check check (
  (cause = 'replaced_on_call' and call_id is not null and ended_by is null and reason is null)
  or (cause = 'name_held' and call_id is not null and ended_by is null and reason is null)
  or (cause = 'club_admin' and ended_by is not null and call_id is null
      and length(btrim(coalesce(reason, ''))) between 3 and 500)
  or (cause = 'operator' and ended_by is not null and call_id is null
      and length(btrim(coalesce(operator_email, ''))) > 0
      and length(btrim(coalesce(reason, ''))) between 3 and 500)
);

do $$
declare r record;
begin
  for r in select distinct m.club_id, m.person_id from membership m
            where m.role = 'technical_director' and m.ended_at is null
              and fn_td_call(m.club_id) is not null
              and not fn_td_on_call(m.person_id, m.club_id) loop
    perform fn_td_ends(r.club_id, r.person_id, 'name_held', null, null, null, fn_td_call(r.club_id));
  end loop;
end $$;
