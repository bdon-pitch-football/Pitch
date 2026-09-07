-- ---------------------------------------------------------------------------
-- 0019 — coach clips, and the coaching jobs board (BUZ, 7 Sep).
--
-- CLIPS. Links, never files — the same decision as club video and the same
-- click-to-play façade (D-97). Capped at five, enforced in the action and
-- tested, because a coach reel is a shortlist not an archive.
--
-- The guardrail is the club video's, and here it bites harder: a coach's
-- footage is usually a TRAINING SESSION, which means children. A coach
-- posting "U13 session — pressing patterns" is fine; naming a child is not,
-- and neither is a title that makes a specific child the subject. Same
-- honest limit as everywhere else — we hold the title, not the footage.
--
-- ROLES. The brief already anticipates a jobs board as part of the free
-- coach tier, and D-100's first job for a coach's link is "applying to a
-- club for a position" — so this is the missing half of a decision already
-- made, not a new surface.
--
-- ON THE WORD "APPLY". D-108 bans application/applied for every actor, and
-- its stated reason is the player register: a player registers interest,
-- there is nothing to be turned down from, and that is what keeps the
-- register out of the Online Safety Act's feedback-feature analysis. An
-- adult applying for a coaching job is the opposite case — there IS
-- something to be turned down from — so calling it anything else would be
-- evasive. Used here deliberately, with D-108 to be amended to carve out
-- adult coaching roles. If the register says otherwise, this is a rename.
-- ---------------------------------------------------------------------------

create table coach_clip (
  id uuid primary key default gen_random_uuid(),
  coach_profile_id uuid not null references coach_profile(id) on delete cascade,
  url text not null,              -- host-allowlisted in the app; façade-rendered
  title text not null,            -- hostile free text: escaped on output, never HTML
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table coach_clip enable row level security;

create table coaching_role (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id) on delete cascade,
  title text not null,                       -- 'Head Coach — U14 Boys'
  age_group text references age_group(code), -- lookup, never an enum (D-73)
  detail text,                               -- hostile free text
  commitment text,                           -- 'Tue & Thu, 6-7:30pm'
  paid boolean not null default false,       -- volunteer roles are the majority
  closes_on date,                            -- null = open until filled
  posted_by uuid references person(id),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
alter table coaching_role enable row level security;

create table role_application (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references coaching_role(id) on delete cascade,
  coach_id uuid not null references person(id),
  message text,                              -- hostile free text
  created_at timestamptz not null default now(),
  unique (role_id, coach_id)                 -- one per coach per role
);
alter table role_application enable row level security;

-- ----------------------------------------------------------------------------
-- fn_can_apply_for_role — 18+ only, and a real coach profile.
--
-- The age floor is the restrictive choice (D-94's rule when a decision is
-- unclear). A 16-17 year old genuinely does run MiniRoos sessions, but a
-- minor applying for a job through us raises questions nobody has answered,
-- and opening this later is one line. Closing it later would not be.
-- ----------------------------------------------------------------------------
create function fn_can_apply_for_role(p_person uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from person p
    join coach_profile cp on cp.person_id = p.id
    where p.id = p_person and fn_age_band(p.dob) = '18plus')
$$;

-- A club sees who applied for ITS OWN roles, and nothing about anyone else.
-- Returns the coach's name, their public CV slug and their message — never a
-- phone number or an email, because we do not hold one to give and D-100 is
-- explicit that Pitch never hands over contact details. A coach who wants to
-- be reachable puts that in their own message, which is their choice to make.
create function fn_role_applications(p_person uuid, p_role uuid)
returns table (application_id uuid, coach_name text, coach_slug text, message text, applied_at timestamptz)
language plpgsql stable as $$
declare v_club uuid;
begin
  select club_id into v_club from coaching_role where id = p_role;
  if not found then return; end if;
  if not exists (
    select 1 from membership m
    where m.person_id = p_person and m.club_id = v_club
      and m.role in ('technical_director','club_admin') and m.ended_at is null
  ) then return; end if;

  return query
    select ra.id,
           trim(p.first_name || ' ' || coalesce(p.last_name, '')),
           cp.public_slug,
           ra.message,
           ra.created_at
    from role_application ra
    join person p on p.id = ra.coach_id
    left join coach_profile cp on cp.person_id = p.id
    where ra.role_id = p_role
    order by ra.created_at desc;
end $$;
