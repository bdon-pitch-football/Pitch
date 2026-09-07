-- ---------------------------------------------------------------------------
-- 0016 — the register, organised.
--
-- A flat list is fine at three registrations and unusable at two hundred, and
-- two hundred is the realistic number for a club in September. This groups the
-- register by the squad the FAMILY named when they registered.
--
-- Why the squad and not a computed age group: a squad carries both age_group
-- and competition_gender (D-68), and a person carries neither, deliberately
-- (D-25 — gender is not a field we hold about a child, and inferring one to
-- sort a list would be collecting it by the back door). Because the family
-- picks the squad at registration, the bucket is gendered and age-banded
-- without us learning one new thing about the player. That is the whole
-- reason this works.
--
-- Registrations with no squad named keep a bucket of their own rather than
-- being hidden or guessed at: the club files them by hand.
--
-- The authorisation is unchanged and still first — verified, subscribed,
-- authorised, or the function returns nothing at all.
-- ---------------------------------------------------------------------------
drop function if exists fn_register_rows(uuid, uuid);

create function fn_register_rows(p_person uuid, p_club uuid)
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
begin
  if not fn_can_work_register(p_person, p_club) then return; end if;
  if not exists (select 1 from club where id = p_club and club_state = 'verified') then return; end if;
  if not fn_register_active(p_club) then return; end if;
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
    -- Squads sort by age NUMERICALLY then by name, so U12 comes before U13
    -- and the two genders at one age sit next to each other. Sorting the code
    -- as text puts 'SEN' before 'U12', which reads as a bug to any junior
    -- club. Seniors and anything unrecognised sort last, and the unfiled
    -- bucket sorts last of all — it is a to-do, not a squad.
    order by
      coalesce(nullif(regexp_replace(coalesce(s.age_group, ''), '\D', '', 'g'), '')::int, 999),
      s.name nulls last,
      r.created_at desc;
end $$;
