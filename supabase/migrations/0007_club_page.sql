-- ============================================================================
-- 0007 · The public club page (D-74) and the trials board (D-90)
-- competition_gender and age_group live on the NOTICE (and squad), never on
-- a person (D-68/D-25). Every notice carries added-on and last-checked
-- stamps and auto-expires past its date (rendering rule). Two sources only:
-- a verified club posts its own, or Pitch compiles one from the club's own
-- public notice (source='compiled', carrying the D-64 unclaimed disclaimer).
-- The alumni wall is club-authored free text on a public page — a pillar
-- zero surface: an entry never names a person under 18 (guardrail lives in
-- onboarding + report route; the wall renders only when it has content).
-- ============================================================================
alter table club add column public_slug text unique;
alter table club add column established text;
alter table club add column pathway_line text;

create table trial_notice (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id),
  title text not null,                  -- 'U14 & U15 Boys trials'
  age_group text references age_group(code),
  competition_gender text check (competition_gender in ('boys','girls','mixed','open','men','women')),
  position_needs text[] not null default '{}',   -- 'goalkeepers wanted' is the commonest notice
  trial_on date not null,
  time_venue text not null,             -- 'Sun 9:00 AM · Riverside Park, Pitch 2'
  how_to_register text,
  cv_email text,                        -- where CVs should go (club's own address)
  source text not null default 'club' check (source in ('club','compiled')),
  added_on date not null default (now() at time zone 'Australia/Melbourne')::date,
  last_checked date not null default (now() at time zone 'Australia/Melbourne')::date
  -- auto-expiry: renderers exclude trial_on < today (Melbourne). No cron
  -- needed; a notice past its date simply never renders anywhere.
);

create table players_wanted_notice (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id),
  title text not null,                  -- 'U13 Boys — Goalkeeper'
  detail text,                          -- 'Train Tue & Thu · immediate start'
  created_at timestamptz not null default now()
);

create table alumni_entry (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id),
  line text not null,                   -- 'Marco V. → NPL Victoria'
  detail text,                          -- 'Riverside juniors 2012–2018'
  sort int not null default 0
);

alter table trial_notice enable row level security;
alter table players_wanted_notice enable row level security;
alter table alumni_entry enable row level security;
