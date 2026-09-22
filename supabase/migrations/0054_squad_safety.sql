-- ---------------------------------------------------------------------------
-- 0054 — the squad rules the safety seat found missing (22 Sep review;
-- BUZ approved the fix list 23 Sep). Every rule here is enforced at the
-- database, because the page that used to ask these questions asked them
-- differently, or not at all.
--
-- B3  The "ask someone from your register" list wrote its own query and got
--     verification (D-126), the subscription and dunning state (D-135) and
--     P19's refusals wrong: an UNVERIFIED club was shown a child's first AND
--     last name where the register gives a first name only. The askable list
--     is now the register's own answer, per row (fn_can_read_registration),
--     and squad_request_rules refuses the invitation the page would have
--     hidden (L23: one answer to "who may see this child", not two).
--
-- B4  fn_can_act_on_squad let a 16-17 with no confirmed parent hand a club
--     their live record — more than a send would have given (0048 refuses the
--     send). The self branch now asks exactly what fn_can_dispatch asks: an
--     approved guardian, and the guardian's send switch on (D-22, D-91).
--
-- M3  The guardian branch had no age check, so a parent kept claiming,
--     answering and leaving for their adult child. At 18 a guardianship is
--     visibility, never control (D-49, doc 14 P15) — and a re-grant does not
--     bring control back.
--
-- M1/M5  The roster computed its own read level. Every field that comes off
--     the record — positions, number, foot, stats, clips, the record id, and
--     "on your register" (N17) — is now gated per row on fn_read_level
--     (doc 14 A7/A12) plus the under-16 approved-guardian check (A17). L2.
--
-- M2/M10 and BUZ's calls 2, 6, 7 (23 Sep):
--     · joining does NOT end a membership at the same club — playing up into
--       a second team is one club, two squads;
--     · joining closes that player's other open claims and invitations, so a
--       club cannot confirm a stale claim and move a child weeks later;
--     · every ended membership writes its own squad_left (L5, D-78);
--     · the join re-checks what the ask checked: the club is still verified,
--       the player is not hidden, and for a claim the asker may still act;
--     · a confirmed club shows on an under-16's approved page immediately
--       and comes off when they are removed — the club, squad, crest and
--       locality on the snapshot follow the membership (BUZ's decision 2:
--       the guardian already agreed to the move). D-119 is untouched:
--       everything the CHILD wrote still waits for the guardian.
--
-- M4 and BUZ's decision 7: a declined invitation looks to the club exactly
--     like one nobody answered (D-138 — silence is a complete answer and must
--     not be distinguishable), and both lapse 30 days after the ask.
-- ---------------------------------------------------------------------------

-- A club takes an invitation back; the daily job lapses it at 30 days. Both
-- are the CLUB's clock, and neither is an answer — which is what keeps a
-- decline and a silence identical on the club's screen.
alter table squad_invitation
  add column withdrawn_at timestamptz,
  add column lapsed_at timestamptz;

-- ---- who may act for a player ---------------------------------------------

-- Retracting: leaving a squad, or taking back a claim nobody has answered.
-- The old fn_can_act_on_squad, with M3's age check: an approved guardian
-- while the child is under 18, or the player themselves from 16. A child's
-- way out is never conditional on anything else (D-10, D-26's shape) — which
-- is why this is a separate question from asking.
create function fn_can_leave_squad(p_actor uuid, p_person uuid) returns boolean
language plpgsql stable as $$
declare v_band text;
begin
  if p_actor is null or p_person is null then return false; end if;
  select fn_age_band(dob) into v_band from person where id = p_person;
  if not found then return false; end if;
  if p_actor = p_person then return v_band <> 'u16'; end if;
  if v_band = '18plus' then return false; end if;       -- M3
  return exists (select 1 from guardianship_link g
                 where g.guardian_id = p_actor and g.child_id = p_person
                   and g.approved_at is not null and g.revoked_at is null);
end $$;

-- Asking: a claim, or accepting a club's invitation. Both put a club on the
-- child's page and a coach on their record, so both carry B4's conditions.
create or replace function fn_can_act_on_squad(p_actor uuid, p_person uuid) returns boolean
language plpgsql stable as $$
declare v_band text;
begin
  if p_actor is null or p_person is null then return false; end if;
  select fn_age_band(dob) into v_band from person where id = p_person;
  if not found then return false; end if;

  if p_actor = p_person then
    if v_band = 'u16' then return false; end if;        -- D-91: never alone
    if v_band = '16_17' then
      -- The whole 16-17 promise is "your parent is told every time and holds
      -- the switch" (D-22, doc 15 §22). With nobody confirmed there is
      -- nobody to tell; with the switch off, the parent acts, not the
      -- player. Word for word what fn_can_dispatch asks (0048).
      return fn_has_approved_guardian(p_person)
         and not coalesce((select send_disabled from guardian_setting where child_id = p_person), false);
    end if;
    return true;                                        -- 18+
  end if;

  return fn_can_leave_squad(p_actor, p_person);         -- an approved guardian, under 18
end $$;

-- ---- who the club may ask, and it is the register's own answer (B3) -------

-- One predicate, asked by the page and by the write. Nothing about a club's
-- verification, its subscription, the free tier's own trials (P13/P18) or
-- P19's refusals is re-derived here: fn_can_read_registration already
-- answers all of it, per registration (L23).
create function fn_can_ask_to_squad(p_person uuid, p_player uuid, p_squad uuid) returns boolean
language plpgsql stable as $$
declare v_club uuid;
begin
  if p_person is null or p_player is null then return false; end if;
  select club_id into v_club from squad where id = p_squad;
  if v_club is null then return false; end if;
  -- D-154/N17: a club does not read its register, a named person does — and
  -- acting on it is the technical director's, never an administrator's.
  if not fn_can_work_register(p_person, v_club) then return false; end if;
  if not exists (select 1 from registration r
                 where r.player_id = p_player and r.club_id = v_club
                   and fn_can_read_registration(p_person, r.id)) then
    return false;
  end if;
  if exists (select 1 from membership m
             where m.person_id = p_player and m.squad_id = p_squad
               and m.role = 'player' and m.ended_at is null) then
    return false;
  end if;
  -- While an invitation is still the club's to see, there is nothing to add.
  -- A "no" is not a door to ask again — and because a decline and a silence
  -- look the same to the club (D-138), neither one can put a player back on
  -- this list.
  if exists (select 1 from squad_invitation si
             where si.person_id = p_player and si.squad_id = p_squad
               and si.withdrawn_at is null and si.lapsed_at is null
               and coalesce(si.accepted, false) = false) then
    return false;
  end if;
  return true;
end $$;

-- The list itself: first name only, exactly as the register shows it, and
-- only people this club may actually see. A player with more than one
-- registration here appears once.
create function fn_squad_askable(p_person uuid, p_squad uuid)
returns table (player_id uuid, first_name text, positions text[], named_this boolean)
language plpgsql stable as $$
declare v_club uuid;
begin
  select club_id into v_club from squad where id = p_squad;
  if v_club is null then return; end if;
  if not fn_can_work_register(p_person, v_club) then return; end if;
  return query
    select a.player_id, a.first_name, a.positions, a.named_this
    from (
      select distinct on (r.player_id)
             r.player_id, p.first_name, r.positions,
             coalesce(r.squad_target = p_squad, false) as named_this
      from registration r
      join person p on p.id = r.player_id
      where r.club_id = v_club
        and fn_can_read_registration(p_person, r.id)
        and fn_can_ask_to_squad(p_person, r.player_id, p_squad)
      order by r.player_id, coalesce(r.squad_target = p_squad, false) desc, r.created_at desc
    ) a
    -- whoever named this squad first, then the rest of the register: a club
    -- puts a player where it needs them, not where the form guessed.
    order by a.named_this desc, a.first_name;
end $$;

-- What the club sees of the people it has asked (M4). A declined invitation
-- sits here exactly as an unanswered one does, until the club takes it back
-- or the 30 days run out. First name only, as the register gives it.
create function fn_squad_asked(p_person uuid, p_squad uuid)
returns table (invitation_id uuid, first_name text, created_at timestamptz)
language plpgsql stable as $$
declare v_club uuid;
begin
  select club_id into v_club from squad where id = p_squad;
  if v_club is null then return; end if;
  if not fn_can_work_squads(p_person, v_club) then return; end if;
  return query
    select si.id, p.first_name, si.created_at
    from squad_invitation si
    join person p on p.id = si.person_id
    where si.squad_id = p_squad
      and si.withdrawn_at is null and si.lapsed_at is null
      and coalesce(si.accepted, false) = false
      and not fn_person_hidden(si.person_id)
      and not exists (select 1 from membership m
                      where m.person_id = si.person_id and m.squad_id = p_squad
                        and m.role = 'player' and m.ended_at is null)
    order by si.created_at;
end $$;

-- ---- both doors, checked at write ------------------------------------------
create or replace function squad_request_rules() returns trigger
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
  if exists (select 1 from membership m where m.person_id = new.person_id
               and m.squad_id = new.squad_id and m.role = 'player' and m.ended_at is null) then
    raise exception 'that player is already in this squad';
  end if;
  if tg_table_name = 'squad_claim' then
    if not fn_can_act_on_squad(new.asked_by, new.person_id) then
      raise exception 'a claim comes from the player or their guardian';
    end if;
  else
    -- B3: the database refuses the invitation the page now hides.
    if not fn_can_ask_to_squad(new.invited_by, new.person_id, new.squad_id) then
      raise exception 'a club asks someone it can already see on its own register';
    end if;
  end if;
  return new;
end $$;

-- ---- who reads a squad player's record (M1) --------------------------------

-- One answer, used by the roster's per-row gate and by the CV route, so the
-- list and the page cannot disagree. fn_read_level is the product's answer
-- to "who may read this child" (doc 14 table A) — this adds only WHERE the
-- reader is standing: in this squad, at this club.
create function fn_can_read_squad_player(p_person uuid, p_squad uuid, p_player uuid) returns boolean
language plpgsql stable as $$
declare v_club uuid;
begin
  if p_person is null or p_player is null then return false; end if;
  select club_id into v_club from squad where id = p_squad;
  if v_club is null then return false; end if;
  if not exists (select 1 from club where id = v_club and club_state = 'verified') then return false; end if;
  if not exists (select 1 from membership m
                 where m.person_id = p_player and m.squad_id = p_squad
                   and m.role = 'player' and m.ended_at is null) then
    return false;
  end if;
  if fn_person_hidden(p_player) then return false; end if;
  -- A17/A18: an under-16 whose guardianship is unapproved, revoked or
  -- suppressed does not exist as a record, for anyone.
  if (select fn_age_band(dob) from person where id = p_player) = 'u16'
     and not fn_has_approved_guardian(p_player) then
    return false;
  end if;
  return fn_read_level(p_person, p_player) = 'full'
     and (fn_can_work_register(p_person, v_club)
          or exists (select 1 from fn_register_grant_squads(p_person, v_club) g where g = p_squad)
          or exists (select 1 from membership m
                     where m.person_id = p_person and m.club_id = v_club
                       and m.role = 'coach' and m.ended_at is null and m.squad_id = p_squad));
end $$;

drop function if exists fn_squad_roster(uuid, uuid);

create function fn_squad_roster(p_person uuid, p_squad uuid)
returns table (
  player_id uuid,
  first_name text,
  last_name text,
  positions text[],
  position_group text,
  squad_number int,
  foot text,
  record_id uuid,
  joined_at timestamptz,
  clips int,
  apps int,
  goals int,
  assists int,
  clean_sheets int,
  on_register boolean
)
language plpgsql stable as $$
declare v_club uuid;
begin
  select club_id into v_club from squad where id = p_squad;
  if v_club is null then return; end if;
  if not exists (select 1 from club where id = v_club and club_state = 'verified') then return; end if;

  -- Who sees the LIST: the technical director, a coach the club granted this
  -- squad, or an administrator — who gets names and nothing else (D-93).
  if not (fn_can_work_register(p_person, v_club)
          or exists (select 1 from fn_register_grant_squads(p_person, v_club) g where g = p_squad)
          or fn_can_work_squads(p_person, v_club)) then
    return;
  end if;

  return query
    with roster as (
      select p.id as pid, p.first_name as fn, p.last_name as ln, m.started_at as joined,
             dr.id as rec, dr.positions as pos, dr.squad_number as num, dr.foot as ft,
             fn_can_read_squad_player(p_person, p_squad, p.id) as reads
      from membership m
      join person p on p.id = m.person_id
      left join development_record dr on dr.person_id = p.id
      where m.squad_id = p_squad and m.role = 'player' and m.ended_at is null
        and not fn_person_hidden(p.id)
    )
    select r.pid, r.fn, r.ln,
           case when r.reads then r.pos end,
           case when r.reads then
             case
               when r.pos is null or array_length(r.pos, 1) is null then 'UNSET'
               when r.pos[1] = 'GK' then 'GK'
               when r.pos[1] in ('RB','CB','LB') then 'DEF'
               when r.pos[1] in ('DM','CM','AM') then 'MID'
               when r.pos[1] in ('RW','LW','ST') then 'FWD'
               else 'UNSET'
             end
           end,
           case when r.reads then r.num end,
           case when r.reads then r.ft end,
           case when r.reads then r.rec end,
           r.joined,
           case when r.reads then (select count(*)::int from highlight h where h.record_id = r.rec) end,
           case when r.reads then (select ps.value from player_stat ps
             where ps.record_id = r.rec and ps.stat_key = 'apps' and ps.season = '2026' limit 1) end,
           case when r.reads then (select ps.value from player_stat ps
             where ps.record_id = r.rec and ps.stat_key = 'goals' and ps.season = '2026' limit 1) end,
           case when r.reads then (select ps.value from player_stat ps
             where ps.record_id = r.rec and ps.stat_key = 'assists' and ps.season = '2026' limit 1) end,
           case when r.reads then (select ps.value from player_stat ps
             where ps.record_id = r.rec and ps.stat_key = 'clean_sheets' and ps.season = '2026' limit 1) end,
           -- M5/N17: whether a child is on the club's register is register
           -- information, and an administrator does not have the register.
           case when r.reads then exists (
             select 1 from registration g where g.player_id = r.pid
               and g.club_id = v_club and g.withdrawn_at is null) end
    from roster r
    order by
      case
        when not r.reads then 4
        when r.pos is null or array_length(r.pos, 1) is null then 4
        when r.pos[1] = 'GK' then 0
        when r.pos[1] in ('RB','CB','LB') then 1
        when r.pos[1] in ('DM','CM','AM') then 2
        when r.pos[1] in ('RW','LW','ST') then 3
        else 4
      end,
      r.num nulls last,
      r.fn;
end $$;

-- ---- the join (M2, M10, BUZ's calls 2 and 6) -------------------------------
drop function if exists fn_join_squad(uuid, uuid, uuid, text);

create function fn_join_squad(p_person uuid, p_squad uuid, p_actor uuid, p_source text,
                              p_asked_by uuid default null) returns boolean
language plpgsql as $$
declare v_club uuid;
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
    returning squad_id, club_id)
  insert into consent_event (event, actor_id, subject_id, detail)
  select 'squad_left', p_actor, p_person,
         jsonb_build_object('squad_id', e.squad_id, 'club_id', e.club_id, 'source', p_source)
  from ended e;

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

-- ---- the club on an under-16's approved page (BUZ's decision 2) ------------
--
-- An under-16's page IS the guardian-approved snapshot (D-119), and the club
-- was frozen into it at approval — so a club she had left stayed on every
-- page every club holds, and a club that confirmed her never appeared. The
-- club line is not something the child wrote: it exists only because a club
-- confirmed a membership the guardian already agreed to (D-158). So it
-- follows the membership, and nothing else about the snapshot does.
create function fn_cv_club(p_person uuid) returns jsonb
language sql stable as $$
  select coalesce(
    (select jsonb_build_object(
       'club', c.name,
       'clubCrestPath', c.crest_path,
       -- The CLUB's suburb and state. Never the child's: we hold no address
       -- for a player and this line must not start looking like one.
       'locality', nullif(trim(concat_ws(' ', c.suburb, c.state)), ''),
       'squad', jsonb_build_object(
         'name', coalesce(s.name, ''),
         'ageGroup', coalesce(s.age_group, ''),
         'competitionGender', s.competition_gender))
     from membership m
     join club c on c.id = m.club_id
     left join squad s on s.id = m.squad_id
     where m.person_id = p_person and m.role = 'player' and m.ended_at is null
     order by m.started_at desc
     limit 1),
    jsonb_build_object(
      'club', '', 'clubCrestPath', null, 'locality', null,
      'squad', jsonb_build_object('name', '', 'ageGroup', '', 'competitionGender', null)))
$$;

-- The approved snapshot as it is served, wherever it is served: the token
-- path, the club's register CV, the club's squad CV, the family's preview.
-- One function, so the four cannot drift apart.
create function fn_approved_cv(p_record uuid) returns jsonb
language sql stable as $$
  select pv.content || fn_cv_club(dr.person_id)
  from profile_version pv
  join development_record dr on dr.id = pv.record_id
  where pv.record_id = p_record and pv.status = 'approved'
$$;

create or replace function fn_token_read(p_token_hash bytea) returns jsonb
language plpgsql stable as $$
declare
  v_record uuid;
  v_person uuid;
  v_band text;
  v_content jsonb;
begin
  if fn_public_links_paused() then return null; end if;

  select st.record_id, dr.person_id
    into v_record, v_person
  from share_token st
  join development_record dr on dr.id = st.record_id
  where st.token_hash = p_token_hash
    and st.revoked_at is null
    and st.paused = false
    and (st.expires_at is null or st.expires_at > now());
  if not found then return null; end if;

  -- content hold (0010), parent's pause (A16), age-contradiction hold (0049)
  if fn_person_hidden(v_person) then return null; end if;

  select fn_age_band(dob) into v_band from person where id = v_person;

  if v_band = 'u16' then
    if not fn_has_approved_guardian(v_person) then return null; end if;
    v_content := fn_approved_cv(v_record);
    if v_content is null then return null; end if;
  else
    v_content := null;
  end if;

  return jsonb_build_object('record_id', v_record, 'person_id', v_person, 'band', v_band, 'approved_content', v_content);
end $$;

-- ---- the 30-day clock (BUZ's decision 7) -----------------------------------
-- An invitation nobody answered and an invitation answered no both lapse 30
-- days after the ask, so the club's screen can never be read as an answer
-- (D-138). Nothing is deleted: the row stays for the audit, it simply stops
-- being anybody's business.
create function fn_lapse_squad_invitations() returns int
language plpgsql as $$
declare n int;
begin
  with gone as (
    update squad_invitation set lapsed_at = now()
    where lapsed_at is null and withdrawn_at is null
      and coalesce(accepted, false) = false
      and created_at < now() - interval '30 days'
    returning 1)
  select count(*)::int into n from gone;
  return n;
end $$;
