-- ---------------------------------------------------------------------------
-- 0174 · A birthday publishes nothing (John, 3 Oct, N-5, option (A); D-119,
-- doc 14 R11 as John rewrote it; the sixty-days note of the same day).
--
-- WHAT WAS WRONG. An under-16's own change is written to the live record and
-- copied into the waiting version (lib/cv-build). A link-holder, a club and a
-- card read the guardian-approved snapshot only while the child is UNDER 16
-- (fn_token_read 0054; the club's CV routes and the family's preview). So at
-- Melbourne midnight on the sixteenth birthday everything no guardian had
-- approved — the About, the clips, the achievements, the photo — became the
-- page every link-holder opened, and nobody pressed anything. Silence
-- publishing (D-119, doc 14 R7), with the birthday as the timer.
--
-- THE RULE (John's (A)). From 16 the page is the player's (R12), and their
-- unreviewed under-16 changes may reach it — but only by their own act at 16
-- or over, never by the clock. Until that act every surface serves the last
-- version a guardian approved, and the READ PATH enforces it, not only the
-- job (G7): a late or missed run grants nothing, and the gap between
-- Melbourne midnight and the job's run is covered.
--
--   fn_cv_held(record) — the one answer to "is this page held at the last
--   approved version?". True for an under-16 (as it always was), and for a
--   record kept while its player was under 16 until the player's own first
--   write at 16 or over. False for a record made at 16 or over (doc 14 R8:
--   it never had a version to hold). Every reader of a page asks it: the
--   token read below, the club's register rows and squad sheet below, and
--   lib/record-read's servedCv for the club's two CV routes, the family's
--   preview, the share card and the CV email.
--
--   development_record.released_at — when that own first write happened.
--   John asked for "has published since 16" to come from the log rather
--   than a stored flag "if you can". It cannot yet: every word in the
--   consent vocabulary needs a line on the guardian's history (perms ctl6),
--   and that line is BUZ's to write. So it is the moment of a fact, written
--   by one function on the player's own write, and the permission — which
--   version is served — is still computed on every read from it and the
--   date of birth (D-49: the band is never stored).
--
--   fn_clear_waiting / fn_clear_waiting_at_16 — the waiting version left
--   from under 16 is deleted (it can never be approved after the birthday,
--   R13). The daily job calls the batch; the player's first own write calls
--   it too, whichever comes first. One content-free consent_event on the
--   child, `edit_deleted`, reason turned_16: no content, no photo path, no
--   guardian named (F8 and D-94 §10 stay answerable). The photo the deleted
--   version named is handed back for the app to delete only if nothing else
--   names it (lib/cv-build forgetPlayerPhoto) — never the one the live
--   record shows, or the player's own page would break.
--
--   fn_release_own_page — the player's own first write at 16 or over. It
--   clears the waiting version, retires the approved snapshot (superseded:
--   kept as history, served to nobody, so its photo can go once nothing else
--   names it), and stamps released_at. A write by anyone else — a coach's
--   verification, say — never calls it (John: it "doesn't count as the
--   player publishing").
--
-- WHAT A HELD PAGE SERVES ON SQL SURFACES (L2: every field off the record is
-- gated with the record). The register rows' "clips" mark and the squad
-- sheet's positions, number, foot, clip count and stats come from the
-- approved snapshot while the page is held — for an under-16 as well, which
-- until now read the live record on these two screens. One answer (L23).
--
-- PRODUCTION (at 0173). Re-running is safe: the column and the vocabulary
-- word are added only if absent, and every function is create-or-replace with
-- an unchanged signature. Locks: ADD COLUMN with no default is a catalogue
-- change (ACCESS EXCLUSIVE on development_record for an instant, no rewrite);
-- the vocabulary swap takes ACCESS EXCLUSIVE on consent_event while it
-- re-validates the check over the table's rows (tens of thousands at most
-- today). No row is changed: nothing is backfilled. A child who turned 16
-- since launch and has edited since is served their last approved page until
-- their next own write — the restrictive way round, and why
-- scripts/count-pending-at-16.mjs is run against production first.
--
-- No new table, so nothing to enable row-level security on (L26).
-- ---------------------------------------------------------------------------

alter table development_record add column if not exists released_at timestamptz;
comment on column development_record.released_at is
  'N-5 (A), John 3 Oct: when the player''s own first write at 16 or over released the live record. Null on a record kept under 16: every surface serves the last version a guardian approved (fn_cv_held). A fact, never a permission.';

-- The vocabulary gains one word (L5: one event, one meaning). Read from the
-- database as 0076 does, so the words already there are kept exactly.
do $$
declare v_def text; v_new text;
begin
  select pg_get_constraintdef(c.oid) into v_def
  from pg_constraint c
  where c.conrelid = 'consent_event'::regclass and c.conname = 'consent_event_event_check';
  if v_def is null then
    raise exception '0174: consent_event_event_check was not found';
  end if;
  if position('''edit_deleted''::text' in v_def) > 0 then return; end if;
  v_new := regexp_replace(v_def, '\]\)\)\)$', ', ''edit_deleted''::text])))');
  if v_new = v_def then
    raise exception '0174: the consent vocabulary is not in the expected shape: %', v_def;
  end if;
  execute 'alter table consent_event drop constraint consent_event_event_check';
  execute 'alter table consent_event add constraint consent_event_event_check ' || v_new;
end $$;

-- ---- the one answer -------------------------------------------------------
-- Melbourne dates on both sides (G9): the record's own day and the sixteenth
-- birthday. A 29 February child turns 16 on a 29 February (G8: date + 16
-- years is always a leap year until 2100, and Postgres clamps to 28 February
-- if it is not). A record that cannot be found, or a person with no date of
-- birth (the u16 band, D-94's restrictive default), is held.
create or replace function fn_cv_held(p_record uuid) returns boolean
language sql stable as $$
  select coalesce((
    select fn_age_band(p.dob) = 'u16'
        or ((dr.created_at at time zone 'Australia/Melbourne')::date < (p.dob + interval '16 years')::date
            and (dr.released_at is null
                 or (dr.released_at at time zone 'Australia/Melbourne')::date < (p.dob + interval '16 years')::date))
    from development_record dr join person p on p.id = dr.person_id
    where dr.id = p_record), true)
$$;

comment on function fn_cv_held(uuid) is
  'N-5 (A), John 3 Oct; doc 14 R11: true while every surface must serve the last guardian-approved version — under 16, and from 16 until the player''s own first write. Asked on every read (G7).';

-- ---- the waiting version left from under 16 --------------------------------
-- One record. Deletes it only once the player is 16 or over; returns the
-- photo it named (null if none, or if nothing was deleted) for the app to
-- forget if nothing else still names it.
create or replace function fn_clear_waiting(p_record uuid) returns text
language plpgsql as $$
declare v_person uuid; v_photo text; v_gone int;
begin
  select dr.person_id into v_person
    from development_record dr join person p on p.id = dr.person_id
   where dr.id = p_record and fn_age_band(p.dob) <> 'u16';
  if v_person is null then return null; end if;
  with gone as (
    delete from profile_version where record_id = p_record and status = 'pending'
    returning content ->> 'photoPath' as photo)
  select count(*)::int, max(photo) into v_gone, v_photo from gone;
  if v_gone = 0 then return null; end if;
  -- The fact and the reason, and nothing else (John, 3 Oct, §2.5).
  insert into consent_event (event, subject_id, detail)
  values ('edit_deleted', v_person, jsonb_build_object('reason', 'turned_16'));
  return v_photo;
end $$;

-- Every record that still has one. Not only today's birthdays: a version
-- that outlived a missed run is cleared on the next, and none can ever be
-- approved after the birthday anyway (R13).
create or replace function fn_clear_waiting_at_16()
returns table (record_id uuid, photo text)
language plpgsql as $$
declare r record;
begin
  for r in
    select pv.record_id as rec
      from profile_version pv
      join development_record dr on dr.id = pv.record_id
      join person p on p.id = dr.person_id
     where pv.status = 'pending' and fn_age_band(p.dob) <> 'u16'
  loop
    record_id := r.rec;
    photo := fn_clear_waiting(r.rec);
    return next;
  end loop;
end $$;

-- ---- the player's own first write at 16 or over -----------------------------
-- Called inside the write's own transaction, under the record's lock
-- (lib/cv-build). Only the record's owner, and only at 16 or over; anything
-- else changes nothing. Idempotent: after the first, it does nothing.
create or replace function fn_release_own_page(p_person uuid, p_record uuid)
returns table (photo text)
language plpgsql as $$
declare v_waiting text; v_approved text;
begin
  if fn_record_author(p_person, p_record) is distinct from 'self' then return; end if;
  if (select fn_age_band(p.dob) from development_record dr join person p on p.id = dr.person_id
       where dr.id = p_record) = 'u16' then return; end if;
  if (select released_at from development_record where id = p_record) is not null then return; end if;
  v_waiting := fn_clear_waiting(p_record);
  update profile_version set status = 'superseded'
   where record_id = p_record and status = 'approved'
  returning content ->> 'photoPath' into v_approved;
  update development_record set released_at = now() where id = p_record;
  if v_waiting is not null then photo := v_waiting; return next; end if;
  if v_approved is not null then photo := v_approved; return next; end if;
end $$;

-- ---- the token read (0054), asking the one answer --------------------------
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

  -- A held page is the last version a guardian approved, or nothing (D-119;
  -- N-5 (A)): an under-16's, and a page kept under 16 until its player's
  -- own first write at 16 or over. The guardian requirement stays an
  -- under-16's (A17/A18).
  if fn_cv_held(v_record) then
    if v_band = 'u16' and not fn_has_approved_guardian(v_person) then return null; end if;
    v_content := fn_approved_cv(v_record);
    if v_content is null then return null; end if;
  else
    v_content := null;
  end if;

  return jsonb_build_object('record_id', v_record, 'person_id', v_person, 'band', v_band, 'approved_content', v_content);
end $$;

-- ---- the register's "clips" mark (0049), from the version a club may see ---
create or replace function fn_cv_shows_clips(p_record uuid) returns boolean
language sql stable as $$
  select case
    when fn_cv_held(p_record) then coalesce((
      select jsonb_array_length(coalesce(pv.content -> 'highlights', '[]'::jsonb)) > 0
        from profile_version pv where pv.record_id = p_record and pv.status = 'approved'), false)
    else exists (select 1 from highlight h where h.record_id = p_record)
  end
$$;

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
           coalesce((select fn_cv_shows_clips(dr.id) from development_record dr where dr.person_id = p.id), false)
    from registration r
    join person p on p.id = r.player_id
    left join squad s on s.id = r.squad_target
    where r.club_id = p_club and r.withdrawn_at is null
      and not fn_person_hidden(p.id)
      and (v_td or r.squad_target in (select fn_register_grant_squads(p_person, p_club)))
    order by
      coalesce(nullif(regexp_replace(coalesce(s.age_group, ''), '\D', '', 'g'), '')::int, 999),
      s.name nulls last,
      r.created_at desc;
end $$;

create or replace function fn_trial_interest_rows(p_person uuid, p_club uuid)
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
           coalesce((select fn_cv_shows_clips(dr.id) from development_record dr where dr.person_id = p.id), false)
    from registration r
    join trial_notice t on t.id = r.trial_notice_id and t.club_id = p_club
    join person p on p.id = r.player_id
    where r.club_id = p_club and r.withdrawn_at is null
      and not fn_person_hidden(p.id)
    order by t.trial_on, r.created_at desc;
end $$;

-- ---- the squad sheet (0069), from the version a club may see ---------------
-- One 2026 number and its source, from the approved snapshot while the page
-- is held (its stats are fn_stat_public's, own entries first), else from the
-- live rows as 0069 read them.
create or replace function fn_cv_shown_stat(p_record uuid, p_held boolean, p_snap jsonb, p_key text)
returns table (value integer, provenance text)
language plpgsql stable as $$
begin
  if p_held then
    return query
      select (e ->> 'value')::int, e ->> 'provenance'
        from jsonb_array_elements(coalesce(p_snap -> 'stats', '[]'::jsonb)) e
       where e ->> 'season' = '2026' and e ->> 'key' = p_key
       limit 1;
  else
    return query
      select ps.value, ps.provenance from player_stat ps
       where ps.record_id = p_record and ps.stat_key = p_key and ps.season = '2026'
       order by ps.source_experience_id is not null, ps.id limit 1;
  end if;
end $$;

create or replace function fn_squad_roster(p_person uuid, p_squad uuid)
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
    with members as (
      select p.id as pid, p.first_name as fn, p.last_name as ln, m.started_at as joined,
             dr.id as rec, dr.positions as live_pos, dr.squad_number as live_num, dr.foot as live_ft,
             coalesce(fn_cv_held(dr.id), true) as held,
             (select pv.content from profile_version pv where pv.record_id = dr.id and pv.status = 'approved') as snap,
             fn_can_read_squad_player(p_person, p_squad, p.id) as reads
      from membership m
      join person p on p.id = m.person_id
      left join development_record dr on dr.person_id = p.id
      where m.squad_id = p_squad and m.role = 'player' and m.ended_at is null
        and not fn_person_hidden(p.id)
    ),
    -- What a club may see of each page (N-5 (A)): the approved snapshot while
    -- it is held, the live record otherwise. Nothing of a held page with no
    -- approved version.
    roster as (
      select mb.pid, mb.fn, mb.ln, mb.joined, mb.rec, mb.held, mb.snap, mb.reads,
             case when not mb.held then mb.live_pos
                  when mb.snap is null then null::text[]
                  else array(select jsonb_array_elements_text(coalesce(mb.snap -> 'positions', '[]'::jsonb))) end as pos,
             case when not mb.held then mb.live_num else (mb.snap ->> 'squadNumber')::int end as num,
             case when not mb.held then mb.live_ft else mb.snap ->> 'foot' end as ft,
             case when not mb.held then (select count(*)::int from highlight h where h.record_id = mb.rec)
                  when mb.snap is null then 0
                  else jsonb_array_length(coalesce(mb.snap -> 'highlights', '[]'::jsonb)) end as clip_n
      from members mb
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
           case when r.reads then r.clip_n end,
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
    left join lateral fn_cv_shown_stat(r.rec, r.held, r.snap, 'apps') sa on true
    left join lateral fn_cv_shown_stat(r.rec, r.held, r.snap, 'goals') sg on true
    left join lateral fn_cv_shown_stat(r.rec, r.held, r.snap, 'assists') ss on true
    left join lateral fn_cv_shown_stat(r.rec, r.held, r.snap, 'clean_sheets') sc on true
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
