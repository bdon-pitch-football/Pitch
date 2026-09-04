-- ============================================================================
-- 0004 · Interest Register permission functions (D-108, D-126, D-130)
-- The register is worked by the club's own people, at a VERIFIED club, with
-- an active or grace-period subscription. Held state (unverified club) is
-- COMPUTED: the club sees a count and nothing else, and a held register is
-- indistinguishable by enumeration from an empty one (doc 14 §J61).
-- Payment state comes from subscription fields written only by the webhook
-- (D-112) and can never touch club_state.
-- ============================================================================

-- Who may work the register: TD or club_admin at this club, current.
-- (club_admin works the LIST — never a development record; that wall is
-- fn_read_level's and stays there.)
create function fn_can_work_register(p_person uuid, p_club uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from membership m
    where m.person_id = p_person and m.club_id = p_club
      and m.role in ('technical_director','club_admin') and m.ended_at is null)
$$;

-- The subscription gate (D-112, D-135): active or inside grace. Suspension
-- hides rows, never deletes them.
create function fn_register_active(p_club uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from club c
    where c.id = p_club
      and (c.subscription_status in ('active','trialing')
           or (c.grace_until is not null and c.grace_until > now())))
$$;

-- The register read: rows only when (worker at club) AND (club verified)
-- AND (subscription active/grace). Anything else sees nothing — the count
-- function below is the only softer surface.
create function fn_register_rows(p_person uuid, p_club uuid)
returns table (registration_id uuid, player_first_name text, positions text[], trial_tag text, note text, club_status text, created_at timestamptz)
language plpgsql stable as $$
begin
  if not fn_can_work_register(p_person, p_club) then return; end if;
  if not exists (select 1 from club where id = p_club and club_state = 'verified') then return; end if;
  if not fn_register_active(p_club) then return; end if;
  return query
    select r.id, p.first_name, r.positions, r.trial_tag, r.note, r.club_status, r.created_at
    from registration r join person p on p.id = r.player_id
    where r.club_id = p_club and r.withdrawn_at is null
    order by r.created_at desc;
end $$;

-- Held count (D-126): a claimed-but-unverified club sees how many are
-- waiting — a number, never a name.
create function fn_register_count(p_person uuid, p_club uuid) returns int
language plpgsql stable as $$
begin
  if not fn_can_work_register(p_person, p_club) then return 0; end if;
  return (select count(*)::int from registration where club_id = p_club and withdrawn_at is null);
end $$;

-- Status moves (N11): exactly new -> shortlisted -> invited territory; the
-- CHECK constraint already refuses a fourth value; this function adds the
-- authorisation. It returns nothing to the player, ever (N10) — there is
-- simply no player-facing surface that reads club_status.
create function fn_set_club_status(p_person uuid, p_registration uuid, p_status text) returns boolean
language plpgsql as $$
declare v_club uuid;
begin
  select club_id into v_club from registration where id = p_registration and withdrawn_at is null;
  if not found then return false; end if;
  if not fn_can_work_register(p_person, v_club) then return false; end if;
  if not exists (select 1 from club where id = v_club and club_state = 'verified') then return false; end if;
  update registration set club_status = p_status where id = p_registration;
  return true;
end $$;

-- Withdrawal (N7): the note empties in the SAME transaction — the belt
-- trigger from 0002 enforces it even if a future caller forgets.
create function fn_withdraw_registration(p_actor uuid, p_registration uuid) returns boolean
language plpgsql as $$
declare v_player uuid;
begin
  select player_id into v_player from registration where id = p_registration and withdrawn_at is null;
  if not found then return false; end if;
  -- the player themself, or an approved guardian. Guardianship auto-expires
  -- at 18 (D-49, computed never stored): for an adult it counts only if
  -- the adult re-granted it.
  if p_actor <> v_player and not exists (
    select 1 from guardianship_link g
    join person ch on ch.id = g.child_id
    where g.guardian_id = p_actor and g.child_id = v_player
      and g.approved_at is not null and g.revoked_at is null
      and (fn_age_band(ch.dob) <> '18plus' or g.regranted_at is not null)
  ) then return false; end if;
  update registration set withdrawn_at = now(), note = null where id = p_registration;
  return true;
end $$;
