-- ---------------------------------------------------------------------------
-- 0042 — a coach page is public, so it is an adult's page.
--
-- A 16-17 who coaches MiniRoos may keep a coach profile (the permission
-- tests hold one on purpose, and 0019 already stops them applying for roles).
-- What they may not have is the two things that make the profile public and
-- reachable: a public_slug (D-100: stable, no token, no expiry, in the
-- sitemap) and a public_contact (0027). A minor on Pitch is visible and never
-- contactable, and a stable public page with an email address on it is both.
--
-- Nothing in the app publishes a slug yet, so this closes the door before
-- the publish step is built rather than after. Enforced here so no route,
-- script or future screen can get round it. Restrictive by default (D-94).
-- ---------------------------------------------------------------------------
create function fn_coach_profile_adult_only() returns trigger
language plpgsql as $$
begin
  if (new.public_slug is not null or new.public_contact is not null)
     and coalesce((select fn_age_band(dob) from person where id = new.person_id), 'u16') <> '18plus' then
    raise exception 'a coach page can only be published by an adult'
      using errcode = 'check_violation';
  end if;
  return new;
end
$$;

create trigger coach_profile_adult_only
  before insert or update on coach_profile
  for each row execute function fn_coach_profile_adult_only();

-- Whether the owner of a coach profile may be shown publicly. The page and
-- the sitemap both ask, so a profile made before this trigger (or a coach
-- whose date of birth is corrected downward) never renders.
create function fn_coach_page_public(p_profile uuid) returns boolean
language sql stable as $$
  select coalesce((
    select fn_age_band(p.dob) = '18plus'
    from coach_profile cp join person p on p.id = cp.person_id
    where cp.id = p_profile), false)
$$;
