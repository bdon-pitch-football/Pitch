-- ---------------------------------------------------------------------------
-- 0060 — a club's published address is a mailbox, not a person, and the
-- Technical Director role never attaches to one (D-93; D-126, D-137;
-- LESSONS L21, L23; safety review 28 Sep, finding X1).
--
-- WHY THIS EXISTS. 0058 says, in its own words, that a `technical_director`
-- membership is writable only for "the person the verification call
-- recorded". It was not. `td_name` was recorded and compared to nothing; the
-- whole wall was `lower(trim(vc.td_email)) = lower(trim(p.email))`, and
-- `person.email` is unique (0002_phase1_core.sql:43), so the role attached to
-- whichever single Pitch account held that address.
--
-- EXECUTED, NOT REASONED. Built against every migration in order: a club
-- whose `contact_email` is a role mailbox, a verified call recording that
-- address as its TD under a person's name, and the account holding the
-- address belonging to the club's treasurer — a `club_admin` who claimed the
-- page in August and proved that address to read the claim code. The moment
-- the call was logged, fn_attach_recorded_td wrote her a live
-- `technical_director` membership and fn_read_level(treasurer, child) went
-- from 'none' to 'full' on every child at the club. That is doc 14 H11
-- ("`club_admin_own` attempts any development-record read, by any path —
-- Denied"), A12b and J13, and it is the exact sentence D-93 exists to
-- produce: "A treasurer made an admin to send invoices must never be able to
-- read a child's development notes."
--
-- The path is not exotic. A community club gives a role mailbox, because a
-- role mailbox is what a community club has, and it is the same address the
-- claim code is sent to (app/claim/[slug]/actions.ts — `club.contact_email`).
-- Whoever claimed the page had to prove that address to read the code, so at
-- a claimed club there is always an account holding it.
--
-- THE RULE. The address a call records as the club's Technical Director is
-- never the club's own published contact address. A mailbox is not a person,
-- and 0058's entire premise is that the role attaches to a person.
--
-- WHERE THE REFUSAL LIVES, AND WHY IT IS IN TWO PLACES RATHER THAN ONE.
--   · fn_td_on_call is the single answer 0058 built for "did a call record
--     this person as this club's TD", and the wall trigger already asks it.
--     The predicate goes there, so every writer of the live role inherits it
--     — the trigger, the seed, an action, and any later route that forgets.
--     Putting it anywhere else would be a second answer to one question, and
--     a second place to be wrong (L23).
--   · fn_attach_recorded_td must ALSO refuse, on its own and in silence,
--     because it runs inside triggers on events that happen whether or not
--     there is a TD to attach: a club becoming verified, a call being logged,
--     an address being proved. If it picked the mailbox holder and let the
--     trigger raise, an operator verifying a club would get an exception
--     instead of a verified club, and D-126's release of every held
--     registration would fail with it. So it asks fn_td_on_call before it
--     writes, and returns null — which is what 0058 already promised
--     ("quiet by design ... returns null rather than raising").
--   The trigger stays the guarantee. The attach is the caller that now asks.
--
-- WHAT THE SCREEN COULD SEE, AND NOW CAN. fn_club_td returned `vc.td_name` —
-- the name the operator typed — so `/ops/verification` and the call sheet both
-- read "Technical Director Jane Doe · active" while the membership belonged to
-- somebody else. No screen in the product named the person who actually held
-- the role. It now also returns the resolved account's own name and address,
-- whether that name is the recorded one, and whether the recorded address is
-- the club's own. A mismatch is visible at the moment it happens.
--
-- NOT IN SCOPE, AND IT IS A PRODUCT DECISION (BUZ's, not the build's).
-- A recorded name that resolves to a DIFFERENTLY NAMED account is arguably a
-- hold rather than an attach. This migration refuses the mailbox case, which
-- needs no decision — a club's address cannot be a person under any reading
-- of D-93 — and makes every other mismatch visible. It does not refuse an
-- attach to a differently named human. See the handoff for what that would
-- cost.
--
-- Read with: 0058 (the call records the person), 0056 (email proof, L21),
-- D-93 (the role and the granting rule), D-126, D-137, doc 14 H10, H11,
-- A12b, J13, N17.
-- ---------------------------------------------------------------------------

-- ---- 1 · the one answer gains the missing half of the wall ----------------
create or replace function fn_td_on_call(p_person uuid, p_club uuid) returns boolean
language sql stable as $$
  select exists (
    select 1
    from verification_call vc
    join club c on c.id = vc.club_id
    join person p on p.id = p_person
    where vc.club_id = p_club
      and vc.outcome = 'verified'
      and vc.td_email is not null
      and p.email is not null
      and lower(trim(vc.td_email)) = lower(trim(p.email))
      -- The club's own published address is a mailbox. Whoever holds it holds
      -- an inbox, not a role (D-93). coalesce, because a club with no contact
      -- address recorded must not match every TD address ever recorded.
      and lower(trim(vc.td_email)) <> lower(trim(coalesce(c.contact_email, '~no contact address~')))
  );
$$;

-- ---- 2 · the attach asks that answer instead of repeating its query ------
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
  where vc.club_id = p_club
    and vc.outcome = 'verified'
    and vc.td_email is not null
    and p.email_proved_at is not null
    and fn_age_band(p.dob) = '18plus'
    -- The same question the wall asks, asked in the same words, so the attach
    -- cannot select somebody the trigger would refuse (L23). Without this the
    -- refusal would arrive as an exception thrown out of an operator's
    -- verification, not as a role that quietly did not attach.
    and fn_td_on_call(p.id, p_club)
  order by vc.called_at desc, p.created_at
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

-- ---- 3 · what the operator console can read ------------------------------
-- The return type gains four columns, so this is a drop and a create rather
-- than a replace. Every existing column keeps its name, position and meaning:
-- `person_id` is still the proved account the attach would pick, and both ops
-- screens select by name.
drop function fn_club_td(uuid);
create function fn_club_td(p_club uuid)
  returns table (person_id uuid, td_name text, td_email text,
                 recorded_at timestamptz, recorded_by text, active boolean,
                 account_name text, account_email text,
                 name_matches boolean, club_mailbox boolean)
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
    -- The account's OWN name and address, never the name the operator typed.
    -- This is the whole point: a screen that shows only what was recorded
    -- cannot show you when the role landed on a different human.
    nullif(trim(p.first_name || ' ' || coalesce(p.last_name, '')), ''),
    p.email,
    -- Compared here, once, rather than on each screen (L23). Case and
    -- doubled spaces are not a different person; null when no account
    -- resolves, because "we do not know" is not "they do not match".
    case when p.id is null then null else
      lower(regexp_replace(trim(p.first_name || ' ' || coalesce(p.last_name, '')), '\s+', ' ', 'g'))
        = lower(regexp_replace(trim(vc.td_name), '\s+', ' ', 'g'))
    end,
    lower(trim(vc.td_email)) = lower(trim(coalesce(c.contact_email, '~no contact address~')))
  from verification_call vc
  join club c on c.id = vc.club_id
  left join lateral (
    select p2.id, p2.first_name, p2.last_name, p2.email from person p2
    where lower(trim(p2.email)) = lower(trim(vc.td_email))
      and p2.email_proved_at is not null
    order by p2.created_at
    limit 1
  ) p on true
  where vc.club_id = p_club and vc.outcome = 'verified' and vc.td_email is not null
  order by vc.called_at desc
  limit 1;
$$;

-- ---- 4 · the rows that are already here ----------------------------------
-- 0058's own sweep, re-run against the rule it should have carried. A rule
-- installed with exceptions left behind is a rule with exceptions, and a
-- membership that this path would no longer write is ended now the same way a
-- departing TD's is (D-48: they keep only what they authored). There is no
-- production data; this is what makes the invariant true of the whole table
-- rather than only of future writes — the dev seed and the demo included.
update membership m set ended_at = now()
 where m.role = 'technical_director' and m.ended_at is null
   and not (
     exists (select 1 from club c where c.id = m.club_id and c.club_state = 'verified')
     and fn_td_on_call(m.person_id, m.club_id)
     and fn_email_proved(m.person_id)
   );
