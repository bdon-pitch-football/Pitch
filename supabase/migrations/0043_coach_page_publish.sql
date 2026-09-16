-- ---------------------------------------------------------------------------
-- 0043 — a coach publishes their page, and can take it down again.
--
-- D-75 and D-100 give a coach a stable public link. Nothing in the app ever
-- set one: public_slug was only ever written by the seed. The editor now
-- publishes (the address is made from the coach's name) and takes the page
-- down.
--
-- Taking a page down does NOT free the address. "Stable" is the point of
-- D-100: a coach who pasted the link into forty emails and hides the page
-- for a week must get the same link back, not find a stranger living at
-- it. So the slug stays reserved and hidden_at says whether it is showing.
--
-- The adults-only rule (0042, D-100 amended 17 Sep) still decides first.
-- ---------------------------------------------------------------------------
alter table coach_profile add column hidden_at timestamptz;

create or replace function fn_coach_page_public(p_profile uuid) returns boolean
language sql stable as $$
  select coalesce((
    select fn_age_band(p.dob) = '18plus' and cp.hidden_at is null
    from coach_profile cp join person p on p.id = cp.person_id
    where cp.id = p_profile), false)
$$;
