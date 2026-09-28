-- ---------------------------------------------------------------------------
-- 0083 — a coach can verify a stat, and the page says which CLUB and when
-- (D-160, and BUZ's approved default 7 of 28 Sep).
--
-- D-62 put a provenance on every stat from day one; nothing could ever write
-- 'coach_verified' onto one. This builds the write path and what the page
-- reads, and nothing else.
--
-- THE WRITE PATH (fn_verify_stat).
--   · Who: the answer the database already gives to "may this person write
--     to this record, and as what" — fn_write_provenance (0015) returning
--     'coach_verified': a WWCC-attested coach of the player's squad, or the
--     technical director, at a VERIFIED club (D-126, doc 14 §D). The club the
--     verification names is the player's own club at which the actor holds
--     that pen. A player, a guardian, an administrator, a team manager, a
--     former coach, a coach at another club or at an unverified one: no.
--   · The provenance, the club, the actor and the time are set HERE, from the
--     actor, never from the request (D-94 §3). A trigger makes that binding:
--     no insert may arrive as 'coach_verified', and no update may make one,
--     except inside fn_verify_stat for the one row it is verifying.
--   · Only a stat the player entered directly (no source experience) with a
--     number above zero (D-70: a zero is never rendered, so it is never a
--     thing to confirm).
--
-- WHEN THE PLAYER EDITS A VERIFIED STAT (approved default 7, 28 Sep): the new
-- value is self-reported, and the coach's value stays in the history. The
-- same trigger does it wherever the edit comes from: a changed value on a
-- row that was not self-reported copies the old row into player_stat_history
-- and comes back self_reported, with no club and no verifier. Blanking the
-- stat (lib/cv-build deletes the row) keeps it in the history the same way.
-- Re-saving the same number changes nothing: the build form upserts every
-- stat on every save, and a verification must not fall off because a player
-- fixed a typo in their About.
--
-- WHAT THE PAGE READS (fn_stat_public). Per stat: the value, its provenance,
-- the Melbourne date it was entered, and — for a coach-verified one — the
-- verifying CLUB's name and the Melbourne date. Never the coach (BUZ, 28 Sep:
-- "just the club, not the coach's name"): the page is reachable by a stranger
-- holding a share link (D-80), and naming an adult who coaches this child to
-- that reader is a contact route nobody meant to give. The function has no
-- column that could carry a person, so no surface built on it can leak one
-- (doc 14 A20). Like lib/record-read's assembly, it is the SHAPE; the
-- authorisation is the caller's (fn_token_read, the register, the squad).
--
-- entered_at: player_stat had no time at all, so "Self-reported · entered
-- <date>" had nothing to say. A new column; rows that exist when this runs
-- take this moment, which is before any launch (the app branch has never been
-- deployed) and so describes only seed data.
--
-- verified_by names a person, so erasure handles it (fn_erase_child, 0084):
-- a coach who is erased comes off the stats they verified, which stay
-- verified by the club (D-48's rule for someone else's row).
--
-- AN UNDER-16's PAGE IS THE APPROVED SNAPSHOT (D-119). A verification does
-- not change a snapshot; the next version the guardian approves carries it
-- (lib/cv-build builds snapshot stats from fn_stat_public). Whether it should
-- appear at once, the way the club line does (fn_cv_club), is BUZ's call and
-- is in the builder's report; this builds the restrictive answer.
--
-- Read with: D-160, D-62, D-70, D-94 §3, D-119, 0015, 0054, 0069, doc 14 A20.
-- ---------------------------------------------------------------------------

alter table player_stat
  add column entered_at timestamptz not null default now(),
  add column verified_club_id uuid references club(id),
  add column verified_by uuid references person(id),
  add column verified_at timestamptz;

-- What a verification replaced, and what an edit replaced. Append-only.
create table player_stat_history (
  id bigint generated always as identity primary key,
  record_id uuid not null references development_record(id) on delete cascade,
  season text not null,
  stat_key text not null,
  value int,
  provenance text not null check (provenance in ('self_reported','coach_verified','official_import')),
  entered_at timestamptz,
  verified_club_id uuid references club(id),
  verified_by uuid references person(id),
  verified_at timestamptz,
  superseded_at timestamptz not null default now()
);
alter table player_stat_history enable row level security;
create index player_stat_history_record on player_stat_history(record_id);

create function player_stat_history_append_only() returns trigger
language plpgsql as $$
begin
  -- An erasure takes the erased verifier's name off (fn_is_erasing_name, 0067)
  -- and, when the child themselves is erased, the history goes with their
  -- record. Nothing else changes or removes a line of it.
  if tg_op = 'UPDATE' and fn_is_erasing_name(to_jsonb(old), to_jsonb(new), 'verified_by') then
    return new;
  end if;
  if tg_op = 'DELETE' and coalesce(current_setting('pitch.erasing', true), '') <> '' then
    return old;
  end if;
  raise exception 'the stat history is append-only';
end $$;

create trigger player_stat_history_append_only
  before update or delete on player_stat_history
  for each row execute function player_stat_history_append_only();

create function fn_keep_stat_history(r player_stat) returns void
language sql as $$
  insert into player_stat_history (record_id, season, stat_key, value, provenance, entered_at,
                                   verified_club_id, verified_by, verified_at)
  values (r.record_id, r.season, r.stat_key, r.value, r.provenance, r.entered_at,
          r.verified_club_id, r.verified_by, r.verified_at)
$$;

create function player_stat_provenance_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.provenance = 'coach_verified' or new.verified_club_id is not null
       or new.verified_by is not null or new.verified_at is not null then
      raise exception 'a stat is verified by a coach through fn_verify_stat, never written as verified';
    end if;
    new.entered_at := now();
    return new;
  end if;

  if tg_op = 'DELETE' then
    -- The record is being erased: its history goes with it.
    if coalesce(current_setting('pitch.erasing', true), '') <> '' then return old; end if;
    if old.provenance <> 'self_reported' then perform fn_keep_stat_history(old); end if;
    return old;
  end if;

  -- UPDATE.
  if fn_is_erasing_name(to_jsonb(old), to_jsonb(new), 'verified_by') then
    return new;
  end if;
  if coalesce(current_setting('pitch.verifying', true), '') = old.id::text then
    return new;                                   -- fn_verify_stat, this row only
  end if;
  if new.value is distinct from old.value then
    -- An edit. The new number is the player's; whatever stood before it and
    -- was not theirs is kept (approved default 7).
    if old.provenance <> 'self_reported' then perform fn_keep_stat_history(old); end if;
    new.provenance := 'self_reported';
    new.verified_club_id := null;
    new.verified_by := null;
    new.verified_at := null;
    new.entered_at := now();
    return new;
  end if;
  -- The same number: nothing about where it came from moves.
  new.provenance := old.provenance;
  new.verified_club_id := old.verified_club_id;
  new.verified_by := old.verified_by;
  new.verified_at := old.verified_at;
  new.entered_at := old.entered_at;
  return new;
end $$;

create trigger player_stat_provenance_guard
  before insert or update or delete on player_stat
  for each row execute function player_stat_provenance_guard();

-- The write path. True when the stat is (now) coach-verified; false, with
-- nothing written, for anyone not entitled and any stat that cannot be.
create function fn_verify_stat(p_actor uuid, p_stat uuid) returns boolean
language plpgsql as $$
declare
  v_rec uuid;
  v_player uuid;
  v_prov text;
  v_club uuid;
begin
  if p_actor is null or p_stat is null then return false; end if;
  select ps.record_id, dr.person_id, ps.provenance into v_rec, v_player, v_prov
    from player_stat ps join development_record dr on dr.id = ps.record_id
    where ps.id = p_stat and ps.source_experience_id is null and ps.value > 0;
  if not found then return false; end if;

  if fn_write_provenance(p_actor, v_rec) is distinct from 'coach_verified' then return false; end if;

  -- The player's club at which this actor holds the pen: the technical
  -- director, or the coach of the squad the player is in there.
  select m.club_id into v_club
    from membership m join club c on c.id = m.club_id
    where m.person_id = v_player and m.role = 'player' and m.ended_at is null
      and c.club_state = 'verified'
      and exists (
        select 1 from membership a
        where a.person_id = p_actor and a.club_id = m.club_id and a.ended_at is null
          and (a.role = 'technical_director' or (a.role = 'coach' and a.squad_id = m.squad_id)))
    order by m.started_at desc
    limit 1;
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

comment on function fn_verify_stat(uuid, uuid) is
  'D-160: a verified coach at the player''s own club (fn_write_provenance) marks a stat coach-verified. Club, actor and time come from here.';

-- What a page may show about the stats on a record: numbers above zero, the
-- source, the dates, and the verifying club. No person, by construction.
create function fn_stat_public(p_record uuid) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'season', ps.season,
           'key', ps.stat_key,
           'value', ps.value,
           'provenance', ps.provenance,
           'enteredOn', to_char((ps.entered_at at time zone 'Australia/Melbourne')::date, 'YYYY-MM-DD'),
           'verifiedClub', case when ps.provenance = 'coach_verified' then c.name end,
           'verifiedOn', case when ps.provenance = 'coach_verified'
                              then to_char((ps.verified_at at time zone 'Australia/Melbourne')::date, 'YYYY-MM-DD') end))
         order by ps.season, ps.stat_key, ps.source_experience_id nulls first), '[]'::jsonb)
  from player_stat ps
  left join club c on c.id = ps.verified_club_id
  where ps.record_id = p_record and ps.value > 0
$$;

comment on function fn_stat_public(uuid) is
  'D-160: the stats a page may render, with their source, dates and verifying CLUB. Never the coach. The caller holds the authorisation.';

revoke all on function fn_verify_stat(uuid, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function fn_verify_stat(uuid, uuid) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function fn_verify_stat(uuid, uuid) from authenticated';
  end if;
end $$;
