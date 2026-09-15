-- ---------------------------------------------------------------------------
-- 0034 — D-153: clubs invite players to trial, in every band, and a free
-- club can.
--
-- 1. A registration can say which trial it was registered against, and an
--    invitation which trial it is for. Before this an invitation said "a
--    trial invitation — has a date" and carried no date, and a registration
--    carried a free-text tag.
-- 2. The free tier. A verified club with no subscription may invite anyone
--    who registered interest in a trial THAT CLUB posted. The paid register
--    is still where everyone else is (fn_can_invite).
-- 3. Under 18 the player and parent both see an invitation; the player may
--    write the reply, and it reaches the club only when a parent approves
--    it. At 18 the player answers alone. Enforced here, not in the action:
--    a reply is 'answered' only once approved, and only a parent may approve
--    a minor's reply (invitation_reply_approval).
--
-- Still ONE object and one route (John, P11): an invitation hangs off a
-- registration, exactly as before. Nothing here opens a second door.
-- ---------------------------------------------------------------------------

alter table registration add column trial_notice_id uuid references trial_notice(id) on delete set null;
alter table registration_request add column trial_notice_id uuid references trial_notice(id) on delete set null;
alter table invitation add column trial_notice_id uuid references trial_notice(id) on delete set null;
alter table invitation_reply add column approved_by uuid references person(id);
alter table invitation_reply add column approved_at timestamptz;
-- P10: an invitation is one object, not a conversation — one reply, ever.
alter table invitation_reply add constraint invitation_reply_one_per_invitation unique (invitation_id);

-- A trial tag is only ever the registering club's own trial.
create function registration_trial_same_club() returns trigger
language plpgsql as $$
begin
  if new.trial_notice_id is not null and not exists (
    select 1 from trial_notice where id = new.trial_notice_id and club_id = new.club_id
  ) then
    raise exception 'a registration can only be tagged to its own club''s trial';
  end if;
  return new;
end $$;

create trigger registration_trial_same_club
  before insert or update of trial_notice_id, club_id on registration
  for each row execute function registration_trial_same_club();
create trigger registration_request_trial_same_club
  before insert or update of trial_notice_id, club_id on registration_request
  for each row execute function registration_trial_same_club();

-- The invitation wall, as 0022 built it, plus two holes it left: nothing
-- tied the invitation's club to the registration's club, and nothing checked
-- a trial belongs to the club inviting to it.
create or replace function invitation_club_entitled() returns trigger
language plpgsql as $$
declare v_player uuid; v_band text; v_withdrawn timestamptz; v_reg_club uuid;
begin
  -- P5: the club must be verified at the moment the invitation is created.
  if not exists (select 1 from club where id = new.club_id and club_state = 'verified') then
    raise exception 'only a verified club may invite a family';
  end if;

  select r.player_id, r.withdrawn_at, r.club_id into v_player, v_withdrawn, v_reg_club
    from registration r where r.id = new.registration_id;
  if not found then raise exception 'no such registration'; end if;

  -- A club invites people on ITS register, never another club's.
  if v_reg_club <> new.club_id then
    raise exception 'a club can only invite from its own register';
  end if;

  if new.trial_notice_id is not null and not exists (
    select 1 from trial_notice where id = new.trial_notice_id and club_id = new.club_id
  ) then
    raise exception 'that trial is not this club''s';
  end if;

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

-- D-153: who may put a reply in front of the club. Enforced at the database
-- so no action, replay or hand-written insert can let a child approve their
-- own reply.
create function invitation_reply_approval() returns trigger
language plpgsql as $$
declare v_player uuid; v_band text;
begin
  if new.approved_at is null then return new; end if;
  select r.player_id, fn_age_band(p.dob) into v_player, v_band
    from invitation i
    join registration r on r.id = i.registration_id
    join person p on p.id = r.player_id
    where i.id = new.invitation_id;
  if new.approved_by is null then
    raise exception 'an approved reply names who approved it';
  end if;
  if v_band = '18plus' then
    -- An adult answers for themselves. A re-granted guardianship is
    -- visibility, not control (L9's reasoning, applied here).
    if new.approved_by <> v_player then
      raise exception 'an adult answers for themselves';
    end if;
  elsif not exists (
    select 1 from guardianship_link g
    where g.guardian_id = new.approved_by and g.child_id = v_player
      and g.approved_at is not null and g.revoked_at is null
  ) then
    raise exception 'under 18, a reply goes only when a parent approves it';
  end if;
  return new;
end $$;

create trigger invitation_reply_approval
  before insert or update on invitation_reply
  for each row execute function invitation_reply_approval();

-- P6/P7 as before — two states, never read, never lapsed — with one change:
-- a reply a player has written is not an answer until a parent approves it.
-- Until then the club sees exactly what it saw before anyone opened it.
create or replace function fn_invitation_state(p_person uuid, p_invitation uuid) returns text
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
    when exists (select 1 from invitation_reply ir
                 where ir.invitation_id = p_invitation and ir.approved_at is not null)
      then 'answered'
    else 'sent'
  end;
end $$;

-- Whether this club worker may invite this registration.
create function fn_can_invite(p_person uuid, p_registration uuid) returns boolean
language plpgsql stable as $$
declare v_club uuid; v_trial uuid; v_withdrawn timestamptz;
begin
  if p_person is null then return false; end if;
  select club_id, trial_notice_id, withdrawn_at into v_club, v_trial, v_withdrawn
    from registration where id = p_registration;
  if not found or v_withdrawn is not null then return false; end if;
  if not fn_can_work_register(p_person, v_club) then return false; end if;
  -- D-126: nothing about a family reaches a club before verification.
  if not exists (select 1 from club where id = v_club and club_state = 'verified') then return false; end if;
  -- The paid register: anyone on it.
  if fn_register_active(v_club) then return true; end if;
  -- D-153, the free tier: anyone who registered interest in a trial this club posted.
  return v_trial is not null
    and exists (select 1 from trial_notice t where t.id = v_trial and t.club_id = v_club);
end $$;

-- What a FREE verified club sees: the people who registered interest in its
-- own trials, and nobody else. Same verification wall as the register.
create function fn_trial_interest_rows(p_person uuid, p_club uuid)
returns table (
  registration_id uuid, player_first_name text, positions text[], note text,
  club_status text, created_at timestamptz, trial_title text, trial_on date, has_clips boolean
)
language plpgsql stable as $$
begin
  if not fn_can_work_register(p_person, p_club) then return; end if;
  if not exists (select 1 from club where id = p_club and club_state = 'verified') then return; end if;
  return query
    select r.id, p.first_name, r.positions, r.note, r.club_status, r.created_at, t.title, t.trial_on,
           exists (select 1 from highlight h
                   join development_record dr on dr.id = h.record_id
                   where dr.person_id = p.id)
    from registration r
    join trial_notice t on t.id = r.trial_notice_id and t.club_id = p_club
    join person p on p.id = r.player_id
    where r.club_id = p_club and r.withdrawn_at is null
    order by t.trial_on, r.created_at desc;
end $$;
