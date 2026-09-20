-- ---------------------------------------------------------------------------
-- 0052 — who is in each squad (D-158, BUZ 20 Sep). Free, on every tier.
--
-- Nothing in the product put a player in a squad. membership.squad_id has
-- existed since 0002 and only the dev seed ever wrote it, which meant two
-- things nobody had noticed: a club could not see its own teams, and a REAL
-- player's public CV could never show a current club — the page shows only a
-- club that has confirmed them, and a player cannot type one in.
--
-- Two doors, one gate, in the shape the rest of the product already uses:
--
--   squad_claim       the family says "I play here" and the CLUB confirms
--   squad_invitation  the club asks and the FAMILY accepts (D-117: it lands
--                     inside Pitch; the outbound notice is the bare wake and
--                     carries no name, no club, no squad)
--
-- Neither one writes anything to a club until both sides have acted, and the
-- child's side of it follows D-91: an under-16 never acts alone, their
-- guardian does. A confirmed claim or an accepted invitation writes the
-- membership, and the membership is what the CV reads.
--
-- A player plays at one club at a time: confirming ends any other player
-- membership, so the CV cannot claim two clubs at once and a club cannot
-- keep a player who has moved on.
-- ---------------------------------------------------------------------------

-- Squads get their own words in the consent log. They were written as
-- 'outside_contact_logged' at first, which is the word for a stranger
-- approaching a child — squad news is not that, and one event meaning two
-- things is how an audit log stops answering "what happened".
alter table consent_event drop constraint consent_event_event_check;
alter table consent_event add constraint consent_event_event_check check (event in (
  'invite_created','email_sent','email_delivered','email_opened','sms_sent',
  'sms_delivered','guardian_landed','email_verified','sms_verified',
  'approved','nudge_sent','purged',
  'tos_accepted','policy_accepted','share_issued','share_revoked','share_paused',
  'share_request_created','share_dispatched','card_requested','card_approved',
  'edit_submitted','edit_approved','outside_contact_logged','age_transition',
  'registration_created','registration_withdrawn','invitation_created',
  'invitation_replied','deletion_requested','deletion_completed','report_filed',
  'send_switch_changed',
  -- 0052
  'squad_joined','squad_left','squad_record_opened'
));

create table squad_claim (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references person(id) on delete cascade,  -- the player
  club_id uuid not null references club(id),
  squad_id uuid not null references squad(id),
  asked_by uuid not null references person(id),   -- the player (16+) or their guardian
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  answered_by uuid references person(id),
  confirmed boolean
);
create unique index squad_claim_one_open on squad_claim (person_id, squad_id) where answered_at is null;

create table squad_invitation (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references person(id) on delete cascade,
  club_id uuid not null references club(id),
  squad_id uuid not null references squad(id),
  invited_by uuid not null references person(id),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  answered_by uuid references person(id),
  accepted boolean
);
create unique index squad_invitation_one_open on squad_invitation (person_id, squad_id) where answered_at is null;

alter table squad_claim enable row level security;
alter table squad_invitation enable row level security;

-- Who may confirm on the club's side: the technical director, or the club
-- administrator — D-93 gives an administrator memberships and squads, and a
-- squad list is neither a registration nor a development record.
create function fn_can_work_squads(p_person uuid, p_club uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from membership m
    where m.person_id = p_person and m.club_id = p_club
      and m.role in ('technical_director','club_admin') and m.ended_at is null)
$$;

-- Who may act for a player on the family's side (D-91): an approved guardian
-- always; the player themselves only from 16.
create function fn_can_act_on_squad(p_actor uuid, p_person uuid) returns boolean
language sql stable as $$
  select p_actor is not null and (
    (p_actor = p_person and (select fn_age_band(dob) from person where id = p_person) <> 'u16')
    or exists (select 1 from guardianship_link g
               where g.guardian_id = p_actor and g.child_id = p_person
                 and g.approved_at is not null and g.revoked_at is null))
$$;

-- Both doors, checked at write. A squad belongs to its club; the club is
-- verified (D-126: no fact about a child reaches an unverified club, and a
-- confirmed squad IS a fact about a child); a held or paused player is
-- invisible (0049).
create function squad_request_rules() returns trigger
language plpgsql as $$
declare v_club uuid;
begin
  select club_id into v_club from squad where id = new.squad_id;
  if v_club is null or v_club <> new.club_id then
    raise exception 'that squad is not this club''s';
  end if;
  if not exists (select 1 from club where id = new.club_id and club_state = 'verified') then
    raise exception 'only a verified club has squads a player can join';
  end if;
  if fn_person_hidden(new.person_id) then
    raise exception 'that player is not available';
  end if;
  if tg_table_name = 'squad_claim' then
    if not fn_can_act_on_squad(new.asked_by, new.person_id) then
      raise exception 'a claim comes from the player or their guardian';
    end if;
  else
    if not fn_can_work_squads(new.invited_by, new.club_id) then
      raise exception 'only the club invites a player to a squad';
    end if;
  end if;
  if exists (select 1 from membership m where m.person_id = new.person_id
               and m.squad_id = new.squad_id and m.role = 'player' and m.ended_at is null) then
    raise exception 'that player is already in this squad';
  end if;
  return new;
end $$;
create trigger squad_claim_rules before insert on squad_claim
  for each row execute function squad_request_rules();
create trigger squad_invitation_rules before insert on squad_invitation
  for each row execute function squad_request_rules();

-- The write both doors end at. One place, so "a player is in a squad" has one
-- meaning: the other side agreed, and it is logged (D-78).
create function fn_join_squad(p_person uuid, p_squad uuid, p_actor uuid, p_source text) returns boolean
language plpgsql as $$
declare v_club uuid;
begin
  select club_id into v_club from squad where id = p_squad;
  if v_club is null then return false; end if;
  -- one club at a time: the CV shows one, and a club that lost a player
  -- keeps nothing but what it authored (D-48).
  update membership set ended_at = now()
    where person_id = p_person and role = 'player' and ended_at is null;
  insert into membership (person_id, club_id, squad_id, role, season)
    select p_person, v_club, p_squad, 'player', s.season from squad s where s.id = p_squad;
  insert into consent_event (event, actor_id, subject_id, detail)
    values ('squad_joined', p_actor, p_person,
            jsonb_build_object('squad_id', p_squad, 'club_id', v_club, 'source', p_source));
  return true;
end $$;

-- The squad list itself. The technical director sees every squad; a coach
-- sees the squads the club granted them (0037). An administrator sees who is
-- in a squad and NOTHING ELSE — record_id comes back null, so there is no
-- door to a development record for a treasurer (D-93, D-154).
create function fn_squad_roster(p_person uuid, p_squad uuid)
returns table (player_id uuid, first_name text, last_name text, positions text[], squad_number int, record_id uuid, joined_at timestamptz)
language plpgsql stable as $$
declare v_club uuid; v_reads boolean;
begin
  select club_id into v_club from squad where id = p_squad;
  if v_club is null then return; end if;
  if not exists (select 1 from club where id = v_club and club_state = 'verified') then return; end if;

  if fn_can_work_register(p_person, v_club) then
    v_reads := true;                                   -- the technical director
  elsif exists (select 1 from fn_register_grant_squads(p_person, v_club) g where g = p_squad) then
    v_reads := true;                                   -- a coach, for their own squads
  elsif fn_can_work_squads(p_person, v_club) then
    v_reads := false;                                  -- an administrator: names only
  else
    return;
  end if;

  return query
    select p.id, p.first_name, p.last_name, dr.positions, dr.squad_number,
           case when v_reads then dr.id end, m.started_at
    from membership m
    join person p on p.id = m.person_id
    left join development_record dr on dr.person_id = p.id
    where m.squad_id = p_squad and m.role = 'player' and m.ended_at is null
      and not fn_person_hidden(p.id)
    order by p.first_name;
end $$;
