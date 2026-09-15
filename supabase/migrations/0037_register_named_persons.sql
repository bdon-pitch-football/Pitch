-- ---------------------------------------------------------------------------
-- 0037 — D-154: a club does not read its register; a named person does.
--
-- John's doc 34, called by BUZ on 15 Sep with three changes of his own:
--   · the technical director reads the whole register, by default (D-93);
--   · a coach the club brings in may be granted up to THREE teams, and reads
--     only the registrations aimed at those teams;
--   · at most TEN coaches per club ("a club with ten age groups needs a coach
--     for each");
--   · club administrators and team managers never read it (doc 34 rule 4,
--     D-93's wall running through the register).
--
-- Where BUZ did not call it, the more restrictive reading, recorded in D-154:
-- a granted coach reads and opens the CV but does not invite or set a status;
-- registrations aimed at no team stay with the TD; only the TD brings a
-- coach in.
--
-- Doc 14 N16-N24. Everything below is computed at read from membership, the
-- WWCC attestation, verification and the grant row. Nothing stores
-- "visible".
-- ---------------------------------------------------------------------------

-- The TD brings a coach in. Held until the coach accepts inside Pitch; no
-- message is sent (doc 15 carries none). The TD attests they checked the
-- WWCC — the number is never asked for (D-98).
create table coach_invite (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id),
  person_id uuid not null references person(id),
  invited_by uuid not null references person(id),
  squad_ids uuid[] not null check (cardinality(squad_ids) between 1 and 3),
  wwcc_checked boolean not null check (wwcc_checked),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  accepted boolean
);
create unique index coach_invite_one_open on coach_invite (club_id, person_id) where answered_at is null;

-- One row per coach per team. The row is also the audit trail: who granted,
-- when, who removed it, when (doc 34 rules 1, 5).
create table register_grant (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id),
  person_id uuid not null references person(id),
  squad_id uuid not null references squad(id),
  granted_by uuid not null references person(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references person(id)
);
create unique index register_grant_one_live on register_grant (person_id, squad_id) where revoked_at is null;

-- N22 / doc 32 C4a: every register read carries a named person.
create table register_read_log (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references person(id),
  registration_id uuid not null references registration(id) on delete cascade,
  surface text not null check (surface in ('list', 'cv')),
  read_at timestamptz not null default now()
);
create index register_read_log_by_registration on register_read_log (registration_id, read_at);

-- ---- who may work the register: the TD, and nobody else (N17, N20) --------
create or replace function fn_can_work_register(p_person uuid, p_club uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from membership m
    where m.person_id = p_person and m.club_id = p_club
      and m.role = 'technical_director' and m.ended_at is null)
$$;

-- The held count is a number, not a child's details (D-126: an unverified
-- club sees a count and nothing else). The administrator keeps it.
create or replace function fn_register_count(p_person uuid, p_club uuid) returns int
language plpgsql stable as $$
begin
  if not exists (
    select 1 from membership m
    where m.person_id = p_person and m.club_id = p_club
      and m.role in ('technical_director','club_admin') and m.ended_at is null
  ) then return 0; end if;
  return (select count(*)::int from registration where club_id = p_club and withdrawn_at is null);
end $$;

-- The teams whose registrations this coach may read, right now (N19, N21).
-- A grant resolves only while the coach membership is current, the club's
-- WWCC attestation is live, and the club is verified.
create function fn_register_grant_squads(p_person uuid, p_club uuid) returns setof uuid
language sql stable as $$
  select g.squad_id
  from register_grant g
  join club c on c.id = g.club_id and c.club_state = 'verified'
  where g.person_id = p_person and g.club_id = p_club and g.revoked_at is null
    and exists (select 1 from membership m
                where m.person_id = g.person_id and m.club_id = g.club_id
                  and m.role = 'coach' and m.ended_at is null)
    and exists (select 1 from wwcc_attestation w
                where w.person_id = g.person_id and w.club_id = g.club_id and w.revoked_at is null)
$$;

-- Whether this person may read this registration and open its CV (N16,
-- N19). The same refusals as fn_can_invite (P19), asked in the same words,
-- so a granted coach can never see what the TD could not.
create function fn_can_read_registration(p_person uuid, p_registration uuid) returns boolean
language plpgsql stable as $$
declare v_club uuid; v_trial uuid; v_withdrawn timestamptz; v_player uuid; v_squad uuid;
begin
  if p_person is null then return false; end if;
  select club_id, trial_notice_id, withdrawn_at, player_id, squad_target
    into v_club, v_trial, v_withdrawn, v_player, v_squad
    from registration where id = p_registration;
  if not found or v_withdrawn is not null then return false; end if;
  if not exists (select 1 from club where id = v_club and club_state = 'verified') then return false; end if;
  if coalesce((select profile_paused from guardian_setting where child_id = v_player), false) then
    return false;
  end if;
  if (select fn_age_band(dob) from person where id = v_player) = 'u16'
     and not fn_has_approved_guardian(v_player) then
    return false;
  end if;
  if fn_can_work_register(p_person, v_club) then
    -- The TD: the paid register, or the free tier's own trials (D-153).
    return fn_register_active(v_club)
      or (v_trial is not null and exists (select 1 from trial_notice t where t.id = v_trial and t.club_id = v_club));
  end if;
  -- A granted coach: the paid register only, and only their teams.
  return fn_register_active(v_club)
    and v_squad is not null
    and v_squad in (select fn_register_grant_squads(p_person, v_club));
end $$;

-- The register list: the TD sees all of it; a granted coach sees their teams.
create or replace function fn_register_rows(p_person uuid, p_club uuid)
returns table (
  registration_id uuid,
  player_first_name text,
  positions text[],
  trial_tag text,
  note text,
  club_status text,
  created_at timestamptz,
  squad_id uuid,
  squad_name text,
  squad_age_group text,
  squad_gender text,
  has_clips boolean
)
language plpgsql stable as $$
declare v_td boolean;
begin
  if not exists (select 1 from club where id = p_club and club_state = 'verified') then return; end if;
  if not fn_register_active(p_club) then return; end if;
  v_td := fn_can_work_register(p_person, p_club);
  if not v_td and not exists (select 1 from fn_register_grant_squads(p_person, p_club)) then return; end if;
  return query
    select r.id, p.first_name, r.positions, r.trial_tag, r.note, r.club_status, r.created_at,
           s.id, s.name, s.age_group, s.competition_gender,
           exists (select 1 from highlight h
                   join development_record dr on dr.id = h.record_id
                   where dr.person_id = p.id)
    from registration r
    join person p on p.id = r.player_id
    left join squad s on s.id = r.squad_target
    where r.club_id = p_club and r.withdrawn_at is null
      and (v_td or r.squad_target in (select fn_register_grant_squads(p_person, p_club)))
    order by
      coalesce(nullif(regexp_replace(coalesce(s.age_group, ''), '\D', '', 'g'), '')::int, 999),
      s.name nulls last,
      r.created_at desc;
end $$;

-- What an invitation came to is register information: the TD's alone.
create or replace function fn_invitation_state(p_person uuid, p_invitation uuid) returns text
language plpgsql stable as $$
declare v_club uuid;
begin
  select club_id into v_club from invitation where id = p_invitation;
  if not found then return null; end if;
  if not fn_can_work_register(p_person, v_club) then return null; end if;
  return case
    when exists (select 1 from invitation_reply ir
                 where ir.invitation_id = p_invitation and ir.approved_at is not null)
      then 'answered'
    else 'sent'
  end;
end $$;

-- ---- the grant's rules, at write (N18) --------------------------------------
create function register_grant_rules() returns trigger
language plpgsql as $$
begin
  -- Removing a grant is always allowed, and only removal may change a row.
  if tg_op = 'UPDATE' then
    if old.revoked_at is null and new.revoked_at is not null
       and new.person_id = old.person_id and new.squad_id = old.squad_id
       and new.club_id = old.club_id and new.granted_by = old.granted_by then
      return new;
    end if;
    raise exception 'a register grant can only be removed';
  end if;

  if not exists (select 1 from squad where id = new.squad_id and club_id = new.club_id) then
    raise exception 'that team is not this club''s';
  end if;
  if not exists (select 1 from club where id = new.club_id and club_state = 'verified') then
    raise exception 'only a verified club grants register access';
  end if;
  if not fn_can_work_register(new.granted_by, new.club_id) then
    raise exception 'only the technical director grants register access';
  end if;
  if not exists (select 1 from membership m where m.person_id = new.person_id and m.club_id = new.club_id
                   and m.role = 'coach' and m.ended_at is null) then
    raise exception 'register access goes to a coach at this club';
  end if;
  if not exists (select 1 from wwcc_attestation w where w.person_id = new.person_id
                   and w.club_id = new.club_id and w.revoked_at is null) then
    raise exception 'register access needs the club''s WWCC attestation';
  end if;
  if (select fn_age_band(dob) from person where id = new.person_id) <> '18plus' then
    raise exception 'register access goes to an adult';
  end if;
  if (select count(*) from register_grant g where g.person_id = new.person_id
        and g.club_id = new.club_id and g.revoked_at is null) >= 3 then
    raise exception 'a coach reads at most three teams';
  end if;
  if not exists (select 1 from register_grant g where g.person_id = new.person_id
                   and g.club_id = new.club_id and g.revoked_at is null)
     and (select count(distinct g.person_id) from register_grant g
          where g.club_id = new.club_id and g.revoked_at is null) >= 10 then
    raise exception 'a club brings in at most ten coaches';
  end if;
  return new;
end $$;

create trigger register_grant_rules
  before insert or update on register_grant
  for each row execute function register_grant_rules();

-- A coach invite is written by the TD, for teams of that club, at most three.
create function coach_invite_rules() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' then return new; end if;
  if not fn_can_work_register(new.invited_by, new.club_id) then
    raise exception 'only the technical director brings a coach in';
  end if;
  if exists (select 1 from unnest(new.squad_ids) s(id)
             where not exists (select 1 from squad q where q.id = s.id and q.club_id = new.club_id)) then
    raise exception 'that team is not this club''s';
  end if;
  return new;
end $$;

create trigger coach_invite_rules
  before insert or update on coach_invite
  for each row execute function coach_invite_rules();
