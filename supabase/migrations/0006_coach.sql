-- ============================================================================
-- 0006 · Coach profile (doc 09 §2.2, D-75, D-100)
-- The coach link is STABLE AND PUBLIC — a slug, not a token, and it shares
-- no implementation with the player share token (doc 14 §J39: one shared
-- resolver would break the safer of the two). WWCC renders as a state from
-- wwcc_attestation; there is no number column anywhere (D-98).
-- ============================================================================
create table coach_profile (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null unique references person(id),
  public_slug text unique,              -- pitchfootball.com.au/<slug>; null until published
  region text,
  philosophy text,                      -- hostile free text
  badges text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table coach_role (
  id uuid primary key default gen_random_uuid(),
  coach_profile_id uuid not null references coach_profile(id) on delete cascade,
  title text not null,                  -- 'Head Coach · U15 Boys'
  org_name text not null,               -- free text; grants nothing (same discipline as D-72)
  started_year text,
  ended_year text,                      -- null = current
  sort int not null default 0
);

alter table coach_profile enable row level security;
alter table coach_role enable row level security;
