-- ---------------------------------------------------------------------------
-- 0024 — three things doc 14 asked for that did not exist.
--
-- C6/C7/C8 — REQUEST ACCESS. Pillar zero item 9 and D-77 both specify it and
-- it was never built: "One rate-limited 'request access' (one per token per
-- 24h) in which the requester types their own name and role for the guardian
-- to see." It is the ONLY affordance on the link-state page, and without it
-- that page is a dead end for a coach who was legitimately sent a link that
-- has since lapsed.
--
-- The rate limit is the interesting part. A second request inside 24h is
-- SILENTLY ACCEPTED and not sent (C7) — the response cannot differ from the
-- first, because "you have already asked" tells a stranger that the first
-- request found something. Same rule as the link-state page itself.
--
-- And C8: the guardian ignoring it is a complete answer. No follow-up, no
-- reminder, no second nudge, no state the requester can observe.
--
-- M13 — THE ONBOARDING PAUSE (D-139). A flag that refuses new verifications
-- without lowering any check. The distinction matters: it must stop the
-- transition, never weaken the requirement.
--
-- N14 — registrations do not live forever. The schema had no trial date to
-- count from, so one is added, nullable, on the registration itself: a trial
-- is a tag on a registration, never a separate object (D-108).
-- ---------------------------------------------------------------------------

create table access_request (
  id uuid primary key default gen_random_uuid(),
  share_token_id uuid not null references share_token(id) on delete cascade,
  requester_name text not null,          -- typed by the requester; hostile free text
  requester_role text not null,          -- likewise
  created_at timestamptz not null default now(),
  -- Deliberately absent: any status the requester could observe. There is no
  -- 'seen', no 'answered', no 'declined'. The guardian's silence is a valid
  -- answer (C8) and must leave nothing behind to read.
  notified_outbox_id uuid references message_outbox(id)
);
alter table access_request enable row level security;

-- C7: one per token per 24 hours. Enforced here rather than in the app so a
-- replayed request cannot route around it. The caller does not learn which
-- side of the limit it fell on — that is the app's job, and it lies.
create function fn_access_request_allowed(p_token uuid) returns boolean
language sql stable as $$
  select not exists (
    select 1 from access_request
    where share_token_id = p_token and created_at > now() - interval '24 hours')
$$;

-- ----------------------------------------------------------------------------
-- M13 — the onboarding pause. One row, one flag, and a trigger that refuses
-- the transition while it is set. It does not touch verification_call, does
-- not relax the call requirement, and cannot be used to verify anything: it
-- only ever says no.
-- ----------------------------------------------------------------------------
create table app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
insert into app_config (key, value) values ('onboarding_paused', 'false');

create function club_onboarding_pause() returns trigger
language plpgsql as $$
begin
  if new.club_state = 'verified' and coalesce(old.club_state, '') <> 'verified'
     and (select value from app_config where key = 'onboarding_paused') = 'true' then
    raise exception 'onboarding is paused; no new club can be verified right now';
  end if;
  return new;
end $$;

create trigger club_onboarding_pause
  before insert or update on club
  for each row execute function club_onboarding_pause();

-- ----------------------------------------------------------------------------
-- N14 — a registration tagged to a trial is deleted 90 days after that trial,
-- by a scheduled job, on a clock that runs identically whether or not the
-- club ever opened it.
-- ----------------------------------------------------------------------------
alter table registration add column trial_on date;

create function fn_purge_past_trials() returns int
language plpgsql as $$
declare n int;
begin
  with gone as (
    delete from registration
    where trial_on is not null
      and trial_on < (now() at time zone 'Australia/Melbourne')::date - 90
    returning 1)
  select count(*)::int into n from gone;
  return n;
end $$;
