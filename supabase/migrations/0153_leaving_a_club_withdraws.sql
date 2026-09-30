-- ---------------------------------------------------------------------------
-- 0153 — leaving a club withdraws the family's registrations at it (D-170,
-- BUZ 30 Sep; doc 14 H2 and N7; D-128; round L's report, "For BUZ" 3).
--
-- WHAT WAS WRONG. Leaving a squad dropped the club to aggregates (H2), but the
-- family's interest registration at that club stayed open, so the Technical
-- Director could still open the child's CV from the register under the
-- registration's own consent (N16). A family that leaves a club expects the
-- club to stop reading their child. D-170 is the restrictive reading.
--
-- THE RULE. When a player's LAST player membership at a club ends, every
-- interest registration they hold at that club is withdrawn, in the same
-- transaction. The two ways a player leaves a club, as D-170 names them:
--   · the family's Leave (app/squad/actions.ts), which now ends the
--     memberships through fn_leave_squads below rather than its own UPDATE;
--   · signing for another club, which fn_join_squad already does by ending
--     every membership at every other club (0054). It now withdraws too.
-- A player still in another squad at the same club keeps the registration:
-- fn_left_club_withdraws asks for the last membership, not any membership.
--
-- THE FAMILY'S OWN WITHDRAWAL, NOT A SECOND ONE. Each registration goes
-- through fn_withdraw_registration (0004, 0095), exactly as "Take off this
-- register" sends it: the note is emptied in the same statement (D-128, N7),
-- a registration no club could ever have read is removed rather than marked
-- (0095, M6), and the consent log gets the row app/registers/actions.ts
-- writes, 'registration_withdrawn' with the registration's id. The actor
-- passed to the function is the player themself — the function's first rule,
-- that a player may always withdraw their own, so a leave the family was
-- entitled to make can never be half-done by an actor check written for a
-- different door. The log names who actually made the leave: the family
-- member who pressed Leave, or who asked for the signing.
--
-- WHAT IT DOES NOT DO.
--   · No new words: the family's timeline already says "{name} came off a
--     club register" for this event, and the club is told nothing (D-138).
--   · The club's own Remove on a squad (app/club/squads/[squadId]/actions.ts)
--     is not a player leaving, and D-170 does not name it. A club that takes
--     a child out of its last squad keeps the registration and may ask them
--     again from it (0054, the write suite's sqf12). Whether it should not is
--     reported, not decided.
--   · Nothing is deleted that the family's own withdrawal would not delete.
--
-- IN THE DATABASE, NOT THE PAGE (D-80, the brief §3). The Leave used to be an
-- UPDATE in the action; the rule lives with the ending now, in one function
-- each writer calls, and the page asks nothing.
-- ---------------------------------------------------------------------------

-- The one place the rule is written. Called after memberships at p_club have
-- ended in the caller's transaction. Returns how many registrations it
-- withdrew.
create function fn_left_club_withdraws(p_person uuid, p_club uuid, p_actor uuid) returns int
language plpgsql as $$
declare r record; n int := 0;
begin
  -- The LAST player membership: a player in two squads at one club who comes
  -- out of one of them has not left the club.
  if exists (select 1 from membership m
             where m.person_id = p_person and m.club_id = p_club
               and m.role = 'player' and m.ended_at is null) then
    return 0;
  end if;
  for r in select g.id from registration g
           where g.player_id = p_person and g.club_id = p_club and g.withdrawn_at is null
           order by g.created_at loop
    if fn_withdraw_registration(p_person, r.id) then
      insert into consent_event (event, actor_id, subject_id, detail)
        values ('registration_withdrawn', p_actor, p_person, jsonb_build_object('registration_id', r.id));
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

comment on function fn_left_club_withdraws(uuid, uuid, uuid) is
  'D-170 (0153) — a player whose last player membership at a club has ended comes off that club''s register, through the family''s own withdrawal (fn_withdraw_registration: the note emptied, D-128).';

-- The family's Leave, as one function: who may (fn_can_leave_squad, the
-- question retractFor already asks), every live player membership ended, one
-- squad_left per membership that actually ended (M6, L5), and D-170 for each
-- club left. Returns how many memberships ended; 0 writes nothing.
create function fn_leave_squads(p_actor uuid, p_person uuid) returns int
language plpgsql as $$
declare v_clubs uuid[]; v_club uuid; n int;
begin
  if not fn_can_leave_squad(p_actor, p_person) then return 0; end if;

  -- One statement, as the action's was: a data-modifying WITH runs to
  -- completion whether or not the outer query reads it, so the log is written
  -- and the clubs left are counted from the same rows.
  with gone as (
    update membership set ended_at = now()
    where person_id = p_person and role = 'player' and ended_at is null
    returning squad_id, club_id),
  logged as (
    insert into consent_event (event, actor_id, subject_id, detail)
    select 'squad_left', p_actor, p_person,
           jsonb_build_object('squad_id', g.squad_id, 'club_id', g.club_id, 'source', 'family')
    from gone g)
  select count(*)::int, coalesce(array_agg(distinct g.club_id), '{}') into n, v_clubs from gone g;

  foreach v_club in array v_clubs loop
    perform fn_left_club_withdraws(p_person, v_club, p_actor);
  end loop;
  return n;
end $$;

comment on function fn_leave_squads(uuid, uuid) is
  'The family''s Leave (0153): ended, logged and, for each club left, D-170''s withdrawal — in one transaction. Authority is fn_can_leave_squad.';

-- fn_join_squad as 0054 wrote it, with D-170 at the one place a signing ends
-- another club's memberships.
create or replace function fn_join_squad(p_person uuid, p_squad uuid, p_actor uuid, p_source text,
                                         p_asked_by uuid default null) returns boolean
language plpgsql as $$
declare v_club uuid; v_left uuid[]; v_old uuid;
begin
  select club_id into v_club from squad where id = p_squad;
  if v_club is null then return false; end if;

  -- M10: weeks can pass between the ask and the answer. Everything the write
  -- checked is asked again here, because the world moves: a club is
  -- suspended, a child is paused or held, a guardian is revoked.
  if not exists (select 1 from club where id = v_club and club_state = 'verified') then return false; end if;
  if fn_person_hidden(p_person) then return false; end if;
  if p_source = 'claim' and not fn_can_act_on_squad(p_asked_by, p_person) then return false; end if;
  if exists (select 1 from membership m where m.person_id = p_person and m.squad_id = p_squad
               and m.role = 'player' and m.ended_at is null) then return false; end if;

  -- One club at a time on the CV — but a club is not a squad. Playing up into
  -- a second team at the SAME club keeps both (BUZ, 23 Sep). Only another
  -- club's membership ends, and each ending is written on its own so a
  -- parent's timeline says "came out" as well as "went in" (L5, M6).
  with ended as (
    update membership set ended_at = now()
    where person_id = p_person and role = 'player' and ended_at is null
      and club_id <> v_club
    returning squad_id, club_id),
  logged as (
    insert into consent_event (event, actor_id, subject_id, detail)
    select 'squad_left', p_actor, p_person,
           jsonb_build_object('squad_id', e.squad_id, 'club_id', e.club_id, 'source', p_source)
    from ended e)
  select coalesce(array_agg(distinct e.club_id), '{}') into v_left from ended e;

  -- D-170 (0153): signing for another club is leaving the old one, and the
  -- family's registrations there come off its register now. The withdrawal
  -- is logged against the family member who asked (a claim) or who said yes
  -- (an invitation) — the person whose act this is.
  foreach v_old in array v_left loop
    perform fn_left_club_withdraws(p_person, v_old, coalesce(p_asked_by, p_actor));
  end loop;

  insert into membership (person_id, club_id, squad_id, role, season)
    select p_person, v_club, p_squad, 'player', s.season from squad s where s.id = p_squad;

  -- Joining answers what the family had open elsewhere. Without this a club
  -- could confirm a months-old claim and move a child who had since joined
  -- somewhere else, with nobody told — and the family could not see the
  -- claim to cancel it.
  update squad_claim set answered_at = now(), answered_by = p_actor, confirmed = false
    where person_id = p_person and answered_at is null and squad_id <> p_squad;
  update squad_invitation set answered_at = now(), answered_by = p_actor, accepted = false
    where person_id = p_person and answered_at is null and squad_id <> p_squad;

  insert into consent_event (event, actor_id, subject_id, detail)
    values ('squad_joined', p_actor, p_person,
            jsonb_build_object('squad_id', p_squad, 'club_id', v_club, 'source', p_source));
  return true;
end $$;

-- No new table here, so nothing to enable row-level security on (L26).
