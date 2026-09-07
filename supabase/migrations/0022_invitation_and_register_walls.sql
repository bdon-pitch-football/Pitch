-- ---------------------------------------------------------------------------
-- 0022 — tables P and M: the invitation wall and the club-state wall.
--
-- P5. An invitation could be created by ANY club, verified or not. D-126 is
-- the single most important decision in the register: no fact about a person
-- under 18 reaches a club before a human has verified it, and an invitation
-- is a club reaching a family. Enforced by trigger, so it holds whatever the
-- app layer later forgets.
--
-- P12. A club may not invite a family that has withdrawn from it, and may not
-- reach a paused or unapproved child.
--
-- P6/P7. `read_at` exists on the invitation and is family-private. The club
-- must be able to learn `sent` and `answered` and NOTHING else — not read,
-- not lapsed, not a timestamp, not a counter. A guardian ignoring an
-- invitation must be indistinguishable from one that never arrived (D-138),
-- so the club's view of invitation state gets its own function and read_at is
-- not in it.
-- ---------------------------------------------------------------------------
create function invitation_club_entitled() returns trigger
language plpgsql as $$
declare v_player uuid; v_band text; v_withdrawn timestamptz;
begin
  -- P5: the club must be verified at the moment the invitation is created.
  if not exists (select 1 from club where id = new.club_id and club_state = 'verified') then
    raise exception 'only a verified club may invite a family';
  end if;

  select r.player_id, r.withdrawn_at into v_player, v_withdrawn
    from registration r where r.id = new.registration_id;
  if not found then raise exception 'no such registration'; end if;

  -- P12: a family that has withdrawn is not reachable.
  if v_withdrawn is not null then
    raise exception 'that family has withdrawn from this club';
  end if;

  select fn_age_band(dob) into v_band from person where id = v_player;

  -- P12: nor is a paused profile, nor an unapproved under-16 (A17).
  if coalesce((select profile_paused from guardian_setting where child_id = v_player), false) then
    raise exception 'that profile is paused';
  end if;
  if v_band = 'u16' and not fn_has_approved_guardian(v_player) then
    raise exception 'that record is not approved';
  end if;

  return new;
end $$;

create trigger invitation_club_entitled
  before insert on invitation
  for each row execute function invitation_club_entitled();

-- ----------------------------------------------------------------------------
-- P6/P7 — what a CLUB may learn about an invitation it sent. Two states and
-- no others: it went, and it was answered. Never read, never lapsed, never a
-- timestamp of the family opening it. A guardian's silence must look exactly
-- like an invitation that never arrived.
-- ----------------------------------------------------------------------------
create function fn_invitation_state(p_person uuid, p_invitation uuid) returns text
language plpgsql stable as $$
declare v_club uuid;
begin
  select club_id into v_club from invitation where id = p_invitation;
  if not found then return null; end if;
  if not exists (
    select 1 from membership m
    where m.person_id = p_person and m.club_id = v_club
      and m.role in ('technical_director','club_admin') and m.ended_at is null
  ) then return null; end if;

  return case
    when exists (select 1 from invitation_reply ir where ir.invitation_id = p_invitation)
      then 'answered'
    else 'sent'
  end;
end $$;

-- ----------------------------------------------------------------------------
-- M10/M11 — suspension is immediate and total.
--
-- club_state moves verified -> suspended and every minor-facing permission
-- ends in the same transaction. fn_read_level and fn_register_rows already
-- test for club_state = 'verified' rather than "not unverified", so a
-- suspended club falls back to the held view by construction. This function
-- exists so the property has a name and the tests have something to call.
-- ----------------------------------------------------------------------------
create function fn_club_minor_facing(p_club uuid) returns boolean
language sql stable as $$
  select exists (select 1 from club where id = p_club and club_state = 'verified')
$$;
