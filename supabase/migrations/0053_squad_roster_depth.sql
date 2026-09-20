-- ---------------------------------------------------------------------------
-- 0053 — a squad list a coach can actually work from (BUZ, 20 Sep), and one
-- defect found writing it.
--
-- THE DEFECT: 0052's roster returned positions and squad numbers to a club
-- ADMINISTRATOR. Both live on the development record, and D-93 gives an
-- administrator memberships and squads and no development-record access at
-- all. The record id was gated and these two were not, which is the same
-- mistake in a smaller place. Everything that comes off the record is now
-- gated by the same answer.
--
-- THE DEPTH: what a technical director or that squad's coach sees for each
-- player — positions IN THE PLAYER'S OWN ORDER (D-69: first choice is
-- first, and the group is derived here, never stored), squad number, foot,
-- this season's own stats, how many clips, when they joined the squad, and
-- whether they are also on the club's register. Rows come back sorted the
-- way a team sheet reads: keepers, defenders, midfielders, forwards, then
-- anyone who has not picked a position yet.
--
-- Nothing here is new data about a child. It is the data the club can
-- already open one CV at a time, in the one list where a coach needs it.
-- ---------------------------------------------------------------------------
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
    select p.id,
           p.first_name,
           p.last_name,
           case when v_reads then dr.positions end,
           case when v_reads then
             case
               when dr.positions is null or array_length(dr.positions, 1) is null then 'UNSET'
               when dr.positions[1] = 'GK' then 'GK'
               when dr.positions[1] in ('RB','CB','LB') then 'DEF'
               when dr.positions[1] in ('DM','CM','AM') then 'MID'
               when dr.positions[1] in ('RW','LW','ST') then 'FWD'
               else 'UNSET'
             end
           end,
           case when v_reads then dr.squad_number end,
           case when v_reads then dr.foot end,
           case when v_reads then dr.id end,
           m.started_at,
           case when v_reads then (select count(*)::int from highlight h where h.record_id = dr.id) end,
           case when v_reads then (select ps.value from player_stat ps
             where ps.record_id = dr.id and ps.stat_key = 'apps' and ps.season = '2026' limit 1) end,
           case when v_reads then (select ps.value from player_stat ps
             where ps.record_id = dr.id and ps.stat_key = 'goals' and ps.season = '2026' limit 1) end,
           case when v_reads then (select ps.value from player_stat ps
             where ps.record_id = dr.id and ps.stat_key = 'assists' and ps.season = '2026' limit 1) end,
           case when v_reads then (select ps.value from player_stat ps
             where ps.record_id = dr.id and ps.stat_key = 'clean_sheets' and ps.season = '2026' limit 1) end,
           exists (select 1 from registration r where r.player_id = p.id and r.club_id = v_club and r.withdrawn_at is null)
    from membership m
    join person p on p.id = m.person_id
    left join development_record dr on dr.person_id = p.id
    where m.squad_id = p_squad and m.role = 'player' and m.ended_at is null
      and not fn_person_hidden(p.id)
    order by
      case
        when not v_reads then 4
        when dr.positions is null or array_length(dr.positions, 1) is null then 4
        when dr.positions[1] = 'GK' then 0
        when dr.positions[1] in ('RB','CB','LB') then 1
        when dr.positions[1] in ('DM','CM','AM') then 2
        when dr.positions[1] in ('RW','LW','ST') then 3
        else 4
      end,
      dr.squad_number nulls last,
      p.first_name;
end $$;
