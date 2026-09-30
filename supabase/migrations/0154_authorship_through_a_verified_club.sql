-- ---------------------------------------------------------------------------
-- 0154 — while a club is not verified, nobody at it reads a child through it,
-- including what they wrote themselves (D-171, BUZ 30 Sep; doc 14 H5; a
-- carve-out from D-48; round L's report, "For BUZ" 4).
--
-- WHAT WAS WRONG. H5 says a club that loses verified status loses all minor
-- data access immediately, "including for currently-assigned coaches and the
-- TD". D-48 says an authoring coach keeps read access to what they wrote. At
-- one edge they disagreed: fn_read_level's A10 branch (0003) granted
-- 'authored_only' to anyone who had written a coach-verified entry on the
-- child, whatever had since happened to the club they wrote it through. So a
-- coach or a TD at a suspended club, a club taken down, or a club that failed
-- its call (0150) dropped from 'full' to 'authored_only' rather than to
-- 'none'. No screen reads 'authored_only' until the December assessments, so
-- nothing is exposed today; this settles it before anything can be.
--
-- THE RULE (D-171). An entry grants 'authored_only' only while every club it
-- was written through is verified. It comes back, unchanged, the moment a
-- verification call restores the club. Nothing is deleted and nothing is
-- stored: the answer is computed at read time, from the club's state now.
-- D-48 still holds for a coach who LEAVES a club that stays verified — the
-- entry was written through a verified club, the club is still verified, and
-- they keep 'authored_only'. Both sides are pinned (permission suite H3 and
-- H5; write suite H2 and H5).
--
-- WHICH CLUB AN ENTRY WAS WRITTEN THROUGH. record_entry carries no club (0002),
-- and it does not need one: 'coach_verified' is stamped only when the author
-- held a live coach or TD membership at a VERIFIED club where the child held a
-- live player membership (fn_write_provenance, record_entry_provenance_derived,
-- 0015). Memberships are ended, never deleted (only erasure deletes a
-- child's, and the record goes with it), so the club is read back from the two
-- memberships that were live at the entry's created_at. If more than one club
-- fits, every one of them must be verified (the restrictive reading); if none
-- fits, the entry grants nothing.
--
-- A DEPARTED AUTHOR. The brief puts it as "must not grant it through a club
-- that is not verified", and D-48 is kept for "a coach who leaves a club that
-- stays verified". So a coach who wrote at a club, left it, and whose old club
-- is then suspended loses 'authored_only' there too: the read would still
-- flow through that club. Only the club the entry was written through
-- matters — a coach whose old club stays verified is untouched by what
-- happens at the child's new one.
--
-- fn_read_level is the only function that grants 'authored_only' (grep of
-- pg_proc: 0003 A10 and nothing else). It is rewritten here whole, as 0003
-- wrote it, with the one clause added to A10.
-- ---------------------------------------------------------------------------

create function fn_authorship_stands(p_entry uuid) returns boolean
language sql stable as $$
  select coalesce(bool_and(c.club_state = 'verified'), false)
  from record_entry re
  join development_record dr on dr.id = re.record_id
  join membership a on a.person_id = re.author_id
   and a.role in ('coach', 'technical_director')
   and a.started_at <= re.created_at and (a.ended_at is null or a.ended_at >= re.created_at)
  join membership p on p.person_id = dr.person_id and p.club_id = a.club_id
   and p.role = 'player'
   and p.started_at <= re.created_at and (p.ended_at is null or p.ended_at >= re.created_at)
  join club c on c.id = a.club_id
  where re.id = p_entry;
$$;

comment on function fn_authorship_stands(uuid) is
  'D-171 (0154) — a coach-verified entry keeps its author''s authored_only read (D-48) only while every club it was written through is verified. Read at read time; nothing stored.';

create or replace function fn_read_level(p_viewer uuid, p_person uuid) returns text
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

  -- A10: a former authoring coach keeps read access to what they wrote (D-48)
  -- — through a club that is still verified (D-171, 0154). An entry written
  -- through a club that has since been suspended, taken down or has failed
  -- its call grants nothing until a verification call restores the club.
  if v_level = 'none' and exists (
    select 1 from record_entry re
    join development_record dr on dr.id = re.record_id
    where dr.person_id = p_person and re.author_id = p_viewer
      and re.provenance = 'coach_verified'
      and fn_authorship_stands(re.id)
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

-- No new table here, so nothing to enable row-level security on (L26).
