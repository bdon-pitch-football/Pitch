-- ---------------------------------------------------------------------------
-- 0015 — WRITING to a record, and DISPATCHING a record outward.
--
-- Doc 14 §D (writing to the record), §L (the send flows) and §Q (share cards).
-- The brief is explicit that Phase 1 builds the write-permission functions and
-- the §D tests but no assessment screens — so these live in the database now,
-- ahead of any UI, which is also the only place they can be enforced (D-80).
--
-- Two properties, not two checks:
--
--   1. Provenance is DERIVED from the actor, never accepted from a caller
--      (D-71, D-94 §3). fn_write_provenance is the single answer to "may this
--      person write here, and as what?", and a trigger makes the answer
--      binding — an INSERT that disagrees with it fails, wherever it came from.
--
--   2. A record leaves the family only by the hand entitled to send it
--      (D-91, D-99, D-101). Under 16 that hand is the guardian's. The
--      dispatch columns carry the same trigger treatment.
-- ---------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- fn_write_provenance — doc 14 table D. Returns the provenance the server
-- will stamp, or NULL meaning "this person may not write here at all".
--
-- 'coach_verified' is reachable only by a WWCC-attested coach assigned to the
-- player's squad, or the technical director, at a VERIFIED club (D-126: no
-- fact about a child moves through an unverified club, in either direction).
-- club_admin and team_manager are absent on purpose — the registrar wall in
-- D-93 is a write wall as much as a read wall. A former coach is absent too:
-- D-48 keeps what they wrote readable, it does not keep the pen.
-- ----------------------------------------------------------------------------
create function fn_write_provenance(p_author uuid, p_record uuid) returns text
language plpgsql stable as $$
declare
  v_person uuid;
  v_band text;
  v_club uuid;
  v_squads uuid[];
begin
  if p_author is null then return null; end if;
  select dr.person_id, fn_age_band(p.dob) into v_person, v_band
    from development_record dr join person p on p.id = dr.person_id
    where dr.id = p_record;
  if not found then return null; end if;

  -- D-17: an unapproved under-16 record is not writable by anyone either.
  if v_band = 'u16' and not fn_has_approved_guardian(v_person) then
    return null;
  end if;

  -- The player writes their own record, always as self-reported (D-62). A
  -- guardian writes on an under-18's behalf under the same provenance — a
  -- parent's entry is not a coach's observation and must never be stamped
  -- as one.
  if p_author = v_person then return 'self_reported'; end if;
  if v_band <> '18plus' and exists (
    select 1 from guardianship_link g
    where g.guardian_id = p_author and g.child_id = v_person
      and g.approved_at is not null and g.revoked_at is null
  ) then return 'self_reported'; end if;

  select m.club_id into v_club
    from membership m join club c on c.id = m.club_id
    where m.person_id = v_person and m.role = 'player' and m.ended_at is null
      and c.club_state = 'verified'
    limit 1;
  if v_club is null then return null; end if;

  if exists (
    select 1 from membership m
    where m.person_id = p_author and m.club_id = v_club
      and m.role = 'technical_director' and m.ended_at is null
  ) and fn_is_verified_adult(p_author) then return 'coach_verified'; end if;

  select coalesce(array_agg(m.squad_id), '{}') into v_squads
    from membership m
    where m.person_id = v_person and m.role = 'player'
      and m.ended_at is null and m.squad_id is not null;

  if exists (
    select 1 from membership m
    where m.person_id = p_author and m.club_id = v_club
      and m.role = 'coach' and m.ended_at is null
      and m.squad_id = any (v_squads)
  ) and fn_is_verified_adult(p_author) then return 'coach_verified'; end if;

  return null;
end $$;

-- The trigger is what turns the function into a property. 'official_import'
-- is allowed only with no author at all — it is a machine lane with no
-- partner at launch (D-62), and a human must never be able to borrow it.
create function record_entry_provenance_derived() returns trigger
language plpgsql as $$
declare v_allowed text;
begin
  if new.provenance = 'official_import' then
    if new.author_id is not null then
      raise exception 'official_import cannot carry a human author';
    end if;
    return new;
  end if;
  v_allowed := fn_write_provenance(new.author_id, new.record_id);
  if v_allowed is null then
    raise exception 'not entitled to write to this record';
  end if;
  if new.provenance <> v_allowed then
    raise exception 'provenance is derived from the actor, not supplied';
  end if;
  return new;
end $$;

create trigger record_entry_provenance_derived
  before insert on record_entry
  for each row execute function record_entry_provenance_derived();

-- D-50: an entry is editable by its author for 48 hours and immutable after.
-- Corrections supersede by appending, they never overwrite — which is what
-- leaves room for a later moderation entry with no migration.
create function record_entry_edit_window() returns trigger
language plpgsql as $$
begin
  if old.created_at < now() - interval '48 hours' then
    raise exception 'the author edit window has closed; supersede instead';
  end if;
  if new.record_id <> old.record_id or new.author_id is distinct from old.author_id
     or new.provenance <> old.provenance or new.created_at <> old.created_at then
    raise exception 'authorship and provenance are immutable';
  end if;
  return new;
end $$;

create trigger record_entry_edit_window
  before update on record_entry
  for each row execute function record_entry_edit_window();

-- ----------------------------------------------------------------------------
-- fn_can_dispatch — doc 14 §L and §Q. Who may actually put this record in
-- front of somebody else: issue a share token, press send on a CV, approve a
-- share card. One function, because they are one question (D-91).
--
--   under 16   the approved guardian, and nobody else — not the child,
--              whose "Share my CV" button routes here rather than sending
--   16–17      the player or their guardian (the guardian stays visible and
--              holds the off-switch, but does not have to press the button)
--   18+        the person alone; a lapsed guardianship grants nothing back
-- ----------------------------------------------------------------------------
create function fn_can_dispatch(p_actor uuid, p_record uuid) returns boolean
language plpgsql stable as $$
declare v_person uuid; v_band text;
begin
  if p_actor is null then return false; end if;
  select dr.person_id, fn_age_band(p.dob) into v_person, v_band
    from development_record dr join person p on p.id = dr.person_id
    where dr.id = p_record;
  if not found then return false; end if;

  if v_band = 'u16' and not fn_has_approved_guardian(v_person) then
    return false;
  end if;

  if v_band = '18plus' then return p_actor = v_person; end if;
  if v_band = '16_17' and p_actor = v_person then return true; end if;

  return exists (
    select 1 from guardianship_link g
    where g.guardian_id = p_actor and g.child_id = v_person
      and g.approved_at is not null and g.revoked_at is null);
end $$;

create function share_token_issuer_entitled() returns trigger
language plpgsql as $$
begin
  if not fn_can_dispatch(new.issued_by, new.record_id) then
    raise exception 'not entitled to issue a link for this record';
  end if;
  return new;
end $$;

create trigger share_token_issuer_entitled
  before insert on share_token
  for each row execute function share_token_issuer_entitled();

create function share_request_dispatch_entitled() returns trigger
language plpgsql as $$
begin
  if new.dispatched_by is not null and not fn_can_dispatch(new.dispatched_by, new.record_id) then
    raise exception 'not entitled to send this record';
  end if;
  -- A dispatch is a fact with a time and a link, or it has not happened.
  if (new.dispatched_by is null) <> (new.dispatched_at is null) then
    raise exception 'a dispatch carries both an actor and a time';
  end if;
  return new;
end $$;

create trigger share_request_dispatch_entitled
  before insert or update on share_request
  for each row execute function share_request_dispatch_entitled();

-- D-101 as amended: no image is generated or given a URL before approval, and
-- the approved artefact is the exact one that was shown — hence image_hash is
-- fixed at request time and the storage path cannot appear before approval.
create function share_card_approval_gate() returns trigger
language plpgsql as $$
begin
  if new.approved_by is not null and not fn_can_dispatch(new.approved_by, new.record_id) then
    raise exception 'not entitled to approve a card for this record';
  end if;
  if (new.approved_by is null) <> (new.approved_at is null) then
    raise exception 'an approval carries both an actor and a time';
  end if;
  if new.storage_path is not null and new.approved_at is null then
    raise exception 'a card has no URL before it is approved';
  end if;
  if tg_op = 'UPDATE' and old.image_hash is not null
     and new.image_hash is distinct from old.image_hash then
    raise exception 'the approved artefact must be the one that was shown';
  end if;
  return new;
end $$;

create trigger share_card_approval_gate
  before insert or update on share_card_approval
  for each row execute function share_card_approval_gate();
