-- ---------------------------------------------------------------------------
-- 0069 — three findings from the 28 Sep review, each small, each a rule that
-- belonged in Postgres and was not there.
--
-- 1 · SESSIONS ARE PURGED (D-25, D-94 §2). 0062 made a session a row, and
--     nothing ever deleted one: every sign-in since has left a row behind for
--     good, each naming a person and the moment they signed in. A revoked or
--     expired session answers nothing (fn_session_person refuses both), so
--     past a working window it is data held for no purpose. The daily job now
--     deletes sessions that expired, or were revoked, more than thirty days
--     ago. Thirty days keeps "who was signed in last week" answerable when a
--     family asks (§10: "what was accessed, by whom, when"); after that the
--     row goes. This is NOT the consent log: consent_event is append-only by
--     trigger and stays so. A session is operational state, not a record of
--     anything a family agreed to.
--
-- 2 · THE SQUAD LIST CARRIES PROVENANCE (D-62). fn_squad_roster returned four
--     stats and no source, and the squad screen captioned every one of them
--     "self-reported" as a literal — true today, and a false statement about
--     a number the first time a coach verifies one. That is exactly the
--     defect the CV had and fixed (components/cv/PlayerCV.tsx). Each stat now
--     comes with the provenance of the row it was read from, from the SAME
--     row (the old query read each value with an unordered `limit 1`; value
--     and source now come from one row, direct entry first), and it is gated
--     exactly as the value is (L2): no read, no provenance.
--
-- 3 · WHO HOLDS REGISTER ACCESS, ASKED OF THE DATABASE. /club/squads read
--     register_grant with its own query and decided for itself that only the
--     technical director may see it. Every other permission read goes through
--     a function; this one now does too (fn_club_register_grants). Same rows
--     as the inline query — live grants, whether or not they currently
--     resolve, because this is the list the TD removes them from — and the
--     "TD only" rule is the function's, not the page's (doc 34 rule 5).
-- ---------------------------------------------------------------------------

-- ---- 1 · sessions ----------------------------------------------------------
create function fn_purge_sessions() returns int
language plpgsql as $$
declare n int;
begin
  with gone as (
    delete from auth_session
    where expires_at < now() - interval '30 days'
       or revoked_at < now() - interval '30 days'
    returning 1)
  select count(*)::int into n from gone;
  return n;
end $$;

-- ---- 2 · the squad list, with the source of every number -------------------
drop function fn_squad_roster(uuid, uuid);

create function fn_squad_roster(p_person uuid, p_squad uuid)
returns table (player_id uuid, first_name text, last_name text, positions text[], position_group text,
               squad_number integer, foot text, record_id uuid, joined_at timestamptz, clips integer,
               apps integer, goals integer, assists integer, clean_sheets integer, on_register boolean,
               apps_provenance text, goals_provenance text, assists_provenance text, clean_sheets_provenance text)
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
           case when r.reads then sa.value end,
           case when r.reads then sg.value end,
           case when r.reads then ss.value end,
           case when r.reads then sc.value end,
           -- M5/N17: whether a child is on the club's register is register
           -- information, and an administrator does not have the register.
           case when r.reads then exists (
             select 1 from registration g where g.player_id = r.pid
               and g.club_id = v_club and g.withdrawn_at is null) end,
           -- D-62, gated with the number it describes (L2).
           case when r.reads and sa.value is not null then sa.provenance end,
           case when r.reads and sg.value is not null then sg.provenance end,
           case when r.reads and ss.value is not null then ss.provenance end,
           case when r.reads and sc.value is not null then sc.provenance end
    from roster r
    left join lateral (select ps.value, ps.provenance from player_stat ps
      where ps.record_id = r.rec and ps.stat_key = 'apps' and ps.season = '2026'
      order by ps.source_experience_id is not null, ps.id limit 1) sa on true
    left join lateral (select ps.value, ps.provenance from player_stat ps
      where ps.record_id = r.rec and ps.stat_key = 'goals' and ps.season = '2026'
      order by ps.source_experience_id is not null, ps.id limit 1) sg on true
    left join lateral (select ps.value, ps.provenance from player_stat ps
      where ps.record_id = r.rec and ps.stat_key = 'assists' and ps.season = '2026'
      order by ps.source_experience_id is not null, ps.id limit 1) ss on true
    left join lateral (select ps.value, ps.provenance from player_stat ps
      where ps.record_id = r.rec and ps.stat_key = 'clean_sheets' and ps.season = '2026'
      order by ps.source_experience_id is not null, ps.id limit 1) sc on true
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

-- ---- 3 · who holds register access, for the TD's squads screen -------------
create function fn_club_register_grants(p_person uuid, p_club uuid)
returns table (person_id uuid, name text, teams text[], since text)
language plpgsql stable as $$
begin
  if p_person is null or p_club is null then return; end if;
  -- D-154, doc 34 rule 5: the technical director, and nobody else.
  if not exists (
    select 1 from membership m
    where m.person_id = p_person and m.club_id = p_club
      and m.role = 'technical_director' and m.ended_at is null
  ) then
    return;
  end if;

  return query
    select p.id, trim(p.first_name || ' ' || coalesce(p.last_name, '')),
           array_agg(s.name order by s.name),
           to_char(min(g.granted_at) at time zone 'Australia/Melbourne', 'FMDD Mon')
    from register_grant g
    join person p on p.id = g.person_id
    join squad s on s.id = g.squad_id
    where g.club_id = p_club and g.revoked_at is null
    group by p.id, p.first_name, p.last_name
    order by 2;
end $$;
