-- ---------------------------------------------------------------------------
-- 0049 — the doc 32 controls that were not yet built (BUZ, 17 Sep).
--
-- A1  A record made wholly invisible on request, without deleting it: no
--     public page, no working link, no club listing. The report hold
--     (content_hold, 0010) and the parent's pause already killed the link;
--     neither took the child off a club's register. fn_person_hidden is the
--     one answer, and every club-side read now asks it. A hold now records
--     who placed it and why.
-- A2  One guardian's access removed without deleting anything: SUPPRESS
--     first (reversible), permanent removal only on a court order. A
--     suppression revokes the link — every existing check already honours
--     revoked_at — and marks it suppressed, which is what makes it
--     reversible. A permanent removal is a revocation that is not marked.
-- A4  The age-contradiction hold (D-96): person.signup_hold existed and
--     nothing set it. An adult naming a junior squad is held, never
--     rejected, and a held person is hidden exactly as in A1 until an
--     operator looks.
-- A5  A report can say "this account belongs to a child", and a report
--     now carries what the reporter said it was about.
-- ---------------------------------------------------------------------------

alter table content_hold add column held_by text, add column reason text;

alter table guardianship_link
  add column suppressed_at timestamptz,
  add column suppressed_by text,
  add column suppressed_reason text;
alter table guardianship_link add constraint guardianship_suppression_is_a_revocation
  check (suppressed_at is null or revoked_at is not null);

alter table person add column signup_hold_at timestamptz;

alter table report add column concern text not null default 'other'
  check (concern in ('child_account', 'own_child', 'family_safety', 'other'));

-- A1/A4: one question, asked by every club-side read.
create function fn_person_hidden(p_person uuid) returns boolean
language sql stable as $$
  select coalesce((select signup_hold from person where id = p_person), false)
      or coalesce((select profile_paused from guardian_setting where child_id = p_person), false)
      or exists (select 1 from content_hold h join development_record dr on dr.id = h.record_id
                 where dr.person_id = p_person and h.released_at is null)
$$;

create or replace function fn_register_count(p_person uuid, p_club uuid) returns int
language plpgsql stable as $$
begin
  if not exists (
    select 1 from membership m
    where m.person_id = p_person and m.club_id = p_club
      and m.role in ('technical_director','club_admin') and m.ended_at is null
  ) then return 0; end if;
  return (select count(*)::int from registration r
          where r.club_id = p_club and r.withdrawn_at is null and not fn_person_hidden(r.player_id));
end $$;

create or replace function fn_can_read_registration(p_person uuid, p_registration uuid) returns boolean
language plpgsql stable as $$
declare v_club uuid; v_trial uuid; v_withdrawn timestamptz; v_player uuid; v_squad uuid;
begin
  if p_person is null then return false; end if;
  select club_id, trial_notice_id, withdrawn_at, player_id, squad_target
    into v_club, v_trial, v_withdrawn, v_player, v_squad
    from registration where id = p_registration;
  if not found or v_withdrawn is not null then return false; end if;
  if not exists (select 1 from club where id = v_club and club_state = 'verified') then return false; end if;
  -- 0049: paused, held on a report, or held for an age contradiction.
  if fn_person_hidden(v_player) then return false; end if;
  if (select fn_age_band(dob) from person where id = v_player) = 'u16'
     and not fn_has_approved_guardian(v_player) then
    return false;
  end if;
  if fn_can_work_register(p_person, v_club) then
    return fn_register_active(v_club)
      or (v_trial is not null and exists (select 1 from trial_notice t where t.id = v_trial and t.club_id = v_club));
  end if;
  return fn_register_active(v_club)
    and v_squad is not null
    and v_squad in (select fn_register_grant_squads(p_person, v_club));
end $$;

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
           exists (select 1 from highlight h
                   join development_record dr on dr.id = h.record_id
                   where dr.person_id = p.id)
    from registration r
    join trial_notice t on t.id = r.trial_notice_id and t.club_id = p_club
    join person p on p.id = r.player_id
    where r.club_id = p_club and r.withdrawn_at is null
      and not fn_person_hidden(p.id)
    order by t.trial_on, r.created_at desc;
end $$;

-- A4 in the single read path too: a held person's links answer as dead.
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
    select content into v_content from profile_version
      where record_id = v_record and status = 'approved';
    if not found then return null; end if;
  else
    v_content := null;
  end if;

  return jsonb_build_object('record_id', v_record, 'person_id', v_person, 'band', v_band, 'approved_content', v_content);
end $$;
