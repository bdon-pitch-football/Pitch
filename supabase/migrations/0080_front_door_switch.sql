-- ---------------------------------------------------------------------------
-- 0080 — the front door flips on launch day, and it is one switch (D-164 (1)).
--
-- BUZ, 28 Sep: "the coming-soon page stays live until go-live; the product
-- front door is built now behind a switch, its words approved first." The
-- front door (LandingParent / LandingPlayer / LandingCoach / LandingClub,
-- DeskLandingClub, and the Home chooser) is built in app/page.tsx and
-- components/front-door. Until this row says 'true', `/` serves the
-- coming-soon page exactly as it does today, and nothing else about the
-- product changes either way.
--
--   app_config 'front_door_open'   'false' until launch day. The same shape
--                                  as 0075's billing switch, and for the
--                                  same reason: one answer, in one place.
--   fn_front_door_open()           the only reader of that row. The page
--                                  asks it through lib/front-door.
--
-- Anything but the literal 'true' is off, and so is a missing row: a typo in
-- a config change must not put unapproved words in front of the public. The
-- words on the front door go to BUZ before this is turned on (D-164).
--
-- Read with: 0024 (app_config), 0075 (the billing switch this copies).
-- ---------------------------------------------------------------------------

insert into app_config (key, value) values ('front_door_open', 'false')
  on conflict (key) do nothing;

create function fn_front_door_open() returns boolean
language sql stable as $$
  select coalesce((select value = 'true' from app_config where key = 'front_door_open'), false)
$$;

comment on function fn_front_door_open() is
  'D-164: the product front door replaces the coming-soon page at / only when app_config front_door_open is the literal true.';

-- No new table, so nothing to enable row-level security on (L26).
