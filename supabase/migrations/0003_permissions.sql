-- ============================================================================
-- 0003 · The permission engine (D-80) — computed in Postgres so the
-- application cannot route around it. Doc 14 is the specification; every
-- function here exists to make its rows testable against the database.
--
-- Denials answer "as if it does not exist", never "forbidden" (doc 14 §0).
-- experience_entry appears NOWHERE in this file — that absence is the D-72
-- invariant and a test asserts it.
-- ============================================================================

-- Guardian consent-state inputs (doc 09 §②: visibility is computed from age
-- band + GUARDIAN SETTINGS + membership + verification). These are stored
-- consent inputs, not stored permissions: the D-22 discovery off-switch and
-- the D-53 profile pause.
create table guardian_setting (
  child_id uuid primary key references person(id),
  discovery_disabled boolean not null default false,  -- D-22 off-switch (16–17)
  profile_paused boolean not null default false,      -- D-53 pause: everything outward-facing stops
  updated_by uuid references person(id),
  updated_at timestamptz not null default now()
);
alter table guardian_setting enable row level security;

-- A6/A18 need explicit revocation on the link
alter table guardianship_link add column revoked_at timestamptz;

-- ----------------------------------------------------------------------------
-- Age band — derived from DOB at read time, never stored (doc 14 §J1).
-- Every transition evaluates in Australia/Melbourne (§G9), never UTC.
-- Unknown DOB is treated as u16: the most restrictive band (D-94's rule —
-- when unclear, restrict).
-- ----------------------------------------------------------------------------
create function fn_age_band(p_dob date) returns text
language sql stable as $$
  select case
    when p_dob is null then 'u16'
    when p_dob + interval '18 years' <= (now() at time zone 'Australia/Melbourne')::date then '18plus'
    when p_dob + interval '16 years' <= (now() at time zone 'Australia/Melbourne')::date then '16_17'
    else 'u16'
  end
$$;

-- An approved, unrevoked guardianship exists (D-17). A u16 without one does
-- not exist as a record, for any actor (doc 14 A17/A18).
create function fn_has_approved_guardian(p_child uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from guardianship_link
    where child_id = p_child and approved_at is not null and revoked_at is null)
$$;

-- Adult verification (D-22, D-28, D-98): a club-attested WWCC boolean plus a
-- current membership at a VERIFIED club. A gate, not a badge.
create function fn_is_verified_adult(p_person uuid) returns boolean
language sql stable as $$
  select exists (
    select 1
    from wwcc_attestation w
    join membership m on m.person_id = w.person_id and m.club_id = w.club_id and m.ended_at is null
    join club c on c.id = m.club_id and c.club_state = 'verified'
    where w.person_id = p_person and w.revoked_at is null)
$$;

-- ----------------------------------------------------------------------------
-- fn_read_level — doc 14 table A as one function.
-- Returns: 'full' · 'authored_only' · 'membership_only' · 'public' · 'none'.
-- p_viewer null = anon. Union rule (A12c): a person holding several roles
-- gets the highest level any role grants, computed here, never stored.
-- ----------------------------------------------------------------------------
create function fn_read_level(p_viewer uuid, p_person uuid) returns text
language plpgsql stable as $$
declare
  v_dob date;
  v_band text;
  v_level text := 'none';
  v_player_club uuid;
  v_player_squads uuid[];
begin
  select dob into v_dob from person where id = p_person;
  if not found then return 'none'; end if;
  v_band := fn_age_band(v_dob);

  -- A17/A18: an unapproved or revoked u16 record does not exist for anyone.
  if v_band = 'u16' and not fn_has_approved_guardian(p_person) then
    return 'none';
  end if;

  -- A4: self.
  if p_viewer is not null and p_viewer = p_person then return 'full'; end if;

  -- A1: anon floor — adults are public, minors are nothing.
  if p_viewer is null then
    return case when v_band = '18plus' then 'public' else 'none' end;
  end if;

  -- A5/A6: guardian. Full until 18; after 18 only if the adult re-granted.
  if exists (
    select 1 from guardianship_link g
    where g.guardian_id = p_viewer and g.child_id = p_person
      and g.approved_at is not null and g.revoked_at is null
      and (v_band <> '18plus' or g.regranted_at is not null)
  ) then return 'full'; end if;

  -- Club-side access flows only through a VERIFIED club (A14, D-126).
  select m.club_id into v_player_club
    from membership m join club c on c.id = m.club_id
    where m.person_id = p_person and m.role = 'player' and m.ended_at is null
      and c.club_state = 'verified'
    limit 1;

  if v_player_club is not null then
    select coalesce(array_agg(m.squad_id), '{}') into v_player_squads
      from membership m
      where m.person_id = p_person and m.role = 'player'
        and m.ended_at is null and m.squad_id is not null;

    -- A12: TD — club-wide development access.
    if exists (
      select 1 from membership m
      where m.person_id = p_viewer and m.club_id = v_player_club
        and m.role = 'technical_director' and m.ended_at is null
    ) then return 'full'; end if;

    -- A7/A8/A9: squad-assigned VERIFIED coach only.
    if exists (
      select 1 from membership m
      where m.person_id = p_viewer and m.club_id = v_player_club
        and m.role = 'coach' and m.ended_at is null
        and m.squad_id = any (v_player_squads)
    ) and fn_is_verified_adult(p_viewer) then return 'full'; end if;

    -- A12b/A15b: club_admin and team_manager — membership and contact only,
    -- NEVER the development record (D-93). The registrar wall.
    if exists (
      select 1 from membership m
      where m.person_id = p_viewer and m.club_id = v_player_club
        and m.role in ('club_admin','team_manager') and m.ended_at is null
    ) then v_level := 'membership_only'; end if;
  end if;

  -- A10: a former authoring coach keeps read access to what they wrote (D-48).
  if v_level = 'none' and exists (
    select 1 from record_entry re
    join development_record dr on dr.id = re.record_id
    where dr.person_id = p_person and re.author_id = p_viewer
      and re.provenance = 'coach_verified'
  ) then v_level := 'authored_only'; end if;

  if v_level <> 'none' then return v_level; end if;

  -- Floors by band: adults are public to any signed-in viewer (A11 18+);
  -- 16–17 are public only to verified viewers via search (A11, B3/B6),
  -- and the guardian off-switch removes even that (D-22).
  if v_band = '18plus' then return 'public'; end if;
  if v_band = '16_17'
     and fn_is_verified_adult(p_viewer)
     and not coalesce((select discovery_disabled from guardian_setting where child_id = p_person), false)
  then return 'public'; end if;

  return 'none';
end $$;

-- ----------------------------------------------------------------------------
-- fn_searchable — doc 14 table B. There is NO search surface for u16 at all
-- (B1): this function is the query layer's only gate, and it never returns
-- true for a u16, whoever asks — including their own club (B2).
-- ----------------------------------------------------------------------------
create function fn_searchable(p_searcher uuid, p_person uuid) returns boolean
language plpgsql stable as $$
declare
  v_band text;
begin
  select fn_age_band(dob) into v_band from person where id = p_person;
  if not found then return false; end if;

  if v_band = 'u16' then return false; end if;                    -- B1/B2: never

  if v_band = '16_17' then
    if p_searcher is null then return false; end if;              -- B5
    if coalesce((select discovery_disabled from guardian_setting where child_id = p_person), false)
      then return false; end if;                                  -- B6
    return fn_is_verified_adult(p_searcher);                      -- B3/B4
  end if;

  return true;                                                    -- B7: adults
end $$;

-- ----------------------------------------------------------------------------
-- fn_token_read — THE single tokenised read path's decision (D-80, D-77).
-- Takes a token hash; returns the public CV bundle when the link is live,
-- and NULL otherwise. Expired, revoked, paused, disabled-by-guardian and
-- never-existed are byte-identical nulls — the route serves one link-state
-- page for all of them with equalised timing. No branch here may leak which
-- state occurred.
-- For u16 the content is the APPROVED profile version (D-119) — a pending
-- edit never renders, and if no approved version exists the link is dead.
-- ----------------------------------------------------------------------------
create function fn_token_read(p_token_hash bytea) returns jsonb
language plpgsql stable as $$
declare
  v_record uuid;
  v_person uuid;
  v_band text;
  v_content jsonb;
begin
  select st.record_id, dr.person_id
    into v_record, v_person
  from share_token st
  join development_record dr on dr.id = st.record_id
  where st.token_hash = p_token_hash
    and st.revoked_at is null
    and st.paused = false
    and (st.expires_at is null or st.expires_at > now());
  if not found then return null; end if;

  select fn_age_band(dob) into v_band from person where id = v_person;

  -- guardian pause stops everything outward-facing (A16, D-53)
  if coalesce((select profile_paused from guardian_setting where child_id = v_person), false) then
    return null;
  end if;

  if v_band = 'u16' then
    if not fn_has_approved_guardian(v_person) then return null; end if;
    select content into v_content from profile_version
      where record_id = v_record and status = 'approved';
    if not found then return null; end if;                        -- no approved version = dead link
  else
    v_content := null;  -- 16–17/18+ render the live record; the route assembles it via fn_read_level
  end if;

  return jsonb_build_object('record_id', v_record, 'person_id', v_person, 'band', v_band, 'approved_content', v_content);
end $$;
