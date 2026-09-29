-- ---------------------------------------------------------------------------
-- 0122 — the coach's "Verify for {club}" button has something to ask
-- (D-160; BUZ 29 Sep, "recommended on all": the button's words; brief H).
--
-- WHY THIS EXISTS. 0083 built the write path — fn_verify_stat, a verified
-- coach at the player's own club marks a stat coach-verified, with the club,
-- the actor and the time set in the database — and round B held the button,
-- because it had no approved words. So nothing in production could call it
-- (L13): only the seed did. BUZ approved the words on 29 Sep. The squad CV
-- page now offers the button, and it needs two answers it must not work out
-- for itself (L23): which of this player's stats this person may verify, and
-- which club the verification would name — the club the button says.
--
-- ONE ANSWER FOR THE CLUB (fn_verify_club). The club selection lived inside
-- fn_verify_stat. It moves into its own function, and fn_verify_stat asks it,
-- so the club printed on the button and the club written on the stat cannot
-- be two answers to one question. The rule is unchanged: the player's live
-- club at which the actor is the technical director, or coaches the squad the
-- player is in, and the club is verified (D-126).
--
-- WHAT THE PAGE MAY OFFER (fn_verifiable_stats). A player's stats the actor
-- may verify: only when fn_write_provenance says this actor writes to this
-- record as 'coach_verified' (0015 — a WWCC-attested squad coach or the TD at
-- a verified club) and fn_verify_club names a club; only a number the player
-- entered directly (no source experience), above zero (D-70), and still
-- self-reported (verifying a verified number changes nothing). Every value it
-- returns comes off the record, so it is gated by the same answer as the
-- write (L2): anyone else gets no rows. The page adds the other half itself
-- — it offers only numbers that are ON the page it is showing, which for an
-- under-16 is the parent's approved snapshot (D-119), so a club is never
-- shown a number the parent has not approved.
--
-- Read with: 0083 (fn_verify_stat), 0015 (fn_write_provenance), D-160, D-62,
-- D-70, D-119, D-126.
-- ---------------------------------------------------------------------------

create function fn_verify_club(p_actor uuid, p_record uuid) returns uuid
language sql stable as $$
  select m.club_id
    from development_record dr
    join membership m on m.person_id = dr.person_id and m.role = 'player' and m.ended_at is null
    join club c on c.id = m.club_id
   where dr.id = p_record
     and c.club_state = 'verified'
     and exists (
       select 1 from membership a
       where a.person_id = p_actor and a.club_id = m.club_id and a.ended_at is null
         and (a.role = 'technical_director' or (a.role = 'coach' and a.squad_id = m.squad_id)))
   order by m.started_at desc
   limit 1
$$;

create or replace function fn_verify_stat(p_actor uuid, p_stat uuid) returns boolean
language plpgsql as $$
declare
  v_rec uuid;
  v_prov text;
  v_club uuid;
begin
  if p_actor is null or p_stat is null then return false; end if;
  select ps.record_id, ps.provenance into v_rec, v_prov
    from player_stat ps
    where ps.id = p_stat and ps.source_experience_id is null and ps.value > 0;
  if not found then return false; end if;

  if fn_write_provenance(p_actor, v_rec) is distinct from 'coach_verified' then return false; end if;

  -- The player's club at which this actor holds the pen (0122: one answer,
  -- the same one the button's words are built from).
  v_club := fn_verify_club(p_actor, v_rec);
  if v_club is null then return false; end if;

  if v_prov = 'coach_verified' then return true; end if;

  perform set_config('pitch.verifying', p_stat::text, true);
  update player_stat
     set provenance = 'coach_verified', verified_club_id = v_club,
         verified_by = p_actor, verified_at = now()
   where id = p_stat;
  perform set_config('pitch.verifying', '', true);
  return true;
end $$;

create function fn_verifiable_stats(p_actor uuid, p_record uuid)
  returns table (stat_id uuid, season text, stat_key text, value int, club_name text)
language sql stable as $$
  select ps.id, ps.season, ps.stat_key, ps.value, c.name
    from player_stat ps
    join club c on c.id = fn_verify_club(p_actor, p_record)
   where ps.record_id = p_record
     and ps.source_experience_id is null
     and ps.value > 0
     and ps.provenance = 'self_reported'
     and fn_write_provenance(p_actor, p_record) = 'coach_verified'
   order by ps.season, ps.stat_key
$$;

comment on function fn_verifiable_stats(uuid, uuid) is
  'D-160, 0122: the stats this actor may mark coach-verified on this record, and the club the verification would name. Empty for anyone without the pen.';

revoke all on function fn_verify_club(uuid, uuid) from public;
revoke all on function fn_verifiable_stats(uuid, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function fn_verify_club(uuid, uuid) from anon';
    execute 'revoke all on function fn_verifiable_stats(uuid, uuid) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function fn_verify_club(uuid, uuid) from authenticated';
    execute 'revoke all on function fn_verifiable_stats(uuid, uuid) from authenticated';
  end if;
end $$;
