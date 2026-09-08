-- ---------------------------------------------------------------------------
-- 0029 — a coach's licences, their accomplishments, and a banner
-- (BUZ, 8 Sep).
--
-- THE BADGES ARRAY GOES. coach_profile.badges was a text[] edited through a
-- single pipe-separated box — "AFC C Diploma | Community C" — which is fine
-- for one credential and useless for a coach who holds five. A licence has
-- parts a club reads: what it is, who issued it, and when. An array of
-- strings cannot hold those, so it becomes rows.
--
-- The existing arrays are migrated into the new table before the column is
-- dropped. Nothing is live, but a migration that silently loses a coach's
-- credentials is the wrong habit to build.
--
-- Everything here is SELF-DECLARED and stays that way. A licence row grants
-- nothing, unlocks nothing, and is not checked by us — the same discipline
-- as coach_role.org_name and D-72's experience entries. The one credential
-- on this page Pitch stands behind is the WWCC, and that is club-attested
-- in its own table with no number stored anywhere (D-98). The public page
-- has to keep those two things visibly apart.
-- ---------------------------------------------------------------------------
alter table coach_profile add column banner_path text;

create table coach_licence (
  id uuid primary key default gen_random_uuid(),
  coach_profile_id uuid not null references coach_profile(id) on delete cascade,
  title text not null,                  -- 'AFC B Diploma'
  issuer text,                          -- 'Football Australia' — free text, no FK
  year text,                            -- free text: '2023', 'in progress'
  provenance text not null default 'self_reported' check (provenance = 'self_reported'),
  sort int not null default 0
);

create table coach_achievement (
  id uuid primary key default gen_random_uuid(),
  coach_profile_id uuid not null references coach_profile(id) on delete cascade,
  title text not null,                  -- 'Promotion to State League 1'
  detail text,                          -- 'Riverside FC U15 Boys, 2026'
  provenance text not null default 'self_reported' check (provenance = 'self_reported'),
  sort int not null default 0
);

-- Carry the arrays across, in the order they were written.
insert into coach_licence (coach_profile_id, title, sort)
select cp.id, b.title, b.ord - 1
from coach_profile cp, unnest(cp.badges) with ordinality as b(title, ord)
where cp.badges is not null;

alter table coach_profile drop column badges;

alter table coach_licence enable row level security;
alter table coach_achievement enable row level security;
